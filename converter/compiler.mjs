// SPDX-License-Identifier: AGPL-3.0-or-later
const runtime = new URL("../runtime/", import.meta.url);
const drivers = {
  pdflatex: "pdftex_bibtex8",
  xelatex: "xetex_bibtex8_dvipdfmx",
  lualatex: "luahbtex_bibtex8",
};

export function unresolvedReferences(log) {
  const finalPass = log
    .split(/(?=^\$ (?:pdflatex|xelatex|luahblatex|lualatex)\b)/m)
    .at(-1);
  return /undefined references|undefined citations|Citation .+undefined|There were undefined/i.test(
    finalPass,
  );
}

export function compileProject(
  files,
  main,
  engine,
  { signal, onProgress = () => {} } = {},
) {
  if (!drivers[engine])
    return Promise.reject(new Error("Choose a supported compiler."));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("busytex_worker.js", runtime));
    let settled = false;
    let compiling = false;
    let timer;
    const abort = () =>
      finish(new DOMException("Compilation cancelled.", "AbortError"));
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    }
    function timeout(milliseconds) {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          finish(
            new Error(
              "Compilation took too long. Download the styled ZIP and compile it in Overleaf, or try a smaller project.",
            ),
          ),
        milliseconds,
      );
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onerror = (event) => {
      event.preventDefault();
      finish(
        new Error(
          "The browser compiler could not load. Check your connection and try again in a recent desktop browser.",
        ),
      );
    };
    worker.onmessage = ({ data }) => {
      if (data.exception) {
        const error = new Error(
          "The browser compiler stopped. Check the log, or download the styled ZIP and compile it in Overleaf.",
        );
        error.details = data.exception;
        return finish(error);
      }
      if (data.initialized) {
        compiling = true;
        timeout(180000);
        onProgress(
          "Compiling your paper. Bibliography and reference passes run automatically.",
        );
        worker.postMessage({
          files,
          main_tex_path: main,
          driver: drivers[engine],
          bibtex: null,
          biber: null,
          makeindex: null,
          rerun: null,
          verbose: "silent",
          data_packages_js: [],
          remote_endpoint: "https://texlive2026.texlyre.org",
          shell_escape: false,
        });
      } else if (data.pdf !== undefined) {
        const pdf = data.pdf;
        const valid =
          data.exit_code === 0 &&
          pdf?.length > 4 &&
          new TextDecoder().decode(pdf.slice(0, 4)) === "%PDF";
        finish(null, {
          success: valid,
          pdf: valid ? pdf : null,
          log: data.log || "",
          warnings: unresolvedReferences(data.log || ""),
          exitCode: data.exit_code,
        });
      } else if (data.print) {
        const progress =
          /^(?:Preparing|Downloading data)\.\.\. \((\d+)\/(\d+)\)$/.exec(
            data.print,
          );
        if (progress) {
          if (!compiling) timeout(120000);
          onProgress(
            `Loading the compiler: ${Math.round(Number(progress[1]) / 1048576)} of ${Math.round(Number(progress[2]) / 1048576)} MB of TeX files.`,
          );
        } else if (data.print.startsWith("$ ")) {
          const command = data.print.split(/\s+/)[1];
          if (["bibtex8", "biber", "makeindex"].includes(command))
            onProgress(
              `Building ${command === "makeindex" ? "the index" : "the bibliography"}…`,
            );
        }
      }
    };
    timeout(120000);
    onProgress(
      "Loading the browser compiler. The first run downloads about 120 MB; keep this tab open.",
    );
    const asset = (name) => new URL(name, runtime).href;
    worker.postMessage({
      busytex_js: asset("busytex.js"),
      busytex_wasm: asset("busytex.wasm"),
      biber_js: asset("biber.js"),
      biber_wasm: asset("biber.wasm"),
      biber_data: asset("biber.data"),
      preload_data_packages_js: [asset("texlive-basic.js")],
      data_packages_js: [],
      texmf_local: [],
      preload: true,
    });
  });
}
