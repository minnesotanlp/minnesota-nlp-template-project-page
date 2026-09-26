// SPDX-License-Identifier: AGPL-3.0-or-later
import { compileProject } from "./compiler.mjs";

const $ = (id) => document.getElementById(id);
const form = $("converter-form");
const input = $("project-zip");
const main = $("project-main");
const mode = $("project-style");
const engine = $("project-engine");
const status = $("converter-status");
const dropzone = $("zip-dropzone");
let projectWorker,
  selectedFile,
  metadata,
  controller,
  busy = false,
  reading = false;
let generation = 0,
  requestId = 0,
  elapsedTimer,
  started;
const requests = new Map();
const blobURLs = [];

function showStatus(message, state = "idle") {
  status.textContent = message;
  $("converter").dataset.state = state;
}

function revokeDownloads() {
  for (const url of blobURLs.splice(0)) URL.revokeObjectURL(url);
  for (const id of ["result-pdf", "result-open", "result-zip", "result-log"]) {
    $(id).removeAttribute("href");
    $(id).hidden = true;
  }
  $("converter-results").hidden = true;
  $("compiler-log").textContent = "";
  $("compiler-log-details").hidden = true;
  $("compiler-log-details").open = false;
}

function downloadLink(id, data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  blobURLs.push(url);
  const link = $(id);
  link.href = url;
  if (filename) link.download = filename;
  link.hidden = false;
  return url;
}

function controls() {
  const working = busy || reading;
  input.disabled = working;
  for (const field of [main, mode, engine])
    field.disabled = working || !metadata;
  $("generate-pdf").disabled = working || !main.value || !metadata;
  $("converter-cancel").hidden = !working;
  $("converter-reset").hidden = !selectedFile || working;
  form.setAttribute("aria-busy", String(working));
  dropzone.classList.toggle("is-disabled", working);
}

function stopProjectWorker() {
  projectWorker?.terminate();
  projectWorker = null;
  for (const request of requests.values()) {
    clearTimeout(request.timer);
    request.reject(new DOMException("Cancelled", "AbortError"));
  }
  requests.clear();
}

function projectRequest(data, transfer = []) {
  return new Promise((resolve, reject) => {
    if (!projectWorker) {
      reject(new Error("Choose your ZIP again before generating the PDF."));
      return;
    }
    const id = ++requestId;
    const timer = setTimeout(() => {
      requests.delete(id);
      metadata = null;
      reject(
        new Error("The ZIP took too long to process. Try a smaller project."),
      );
      stopProjectWorker();
    }, 60000);
    requests.set(id, { resolve, reject, timer });
    projectWorker.postMessage({ ...data, id }, transfer);
  });
}

function createProjectWorker() {
  stopProjectWorker();
  projectWorker = new Worker(new URL("./project-worker.mjs", import.meta.url), {
    type: "module",
  });
  projectWorker.onmessage = ({ data }) => {
    const request = requests.get(data.id);
    if (!request) return;
    clearTimeout(request.timer);
    requests.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data);
  };
  projectWorker.onerror = (event) => {
    event.preventDefault();
    for (const request of requests.values())
      request.reject(
        new Error(
          "The ZIP could not be read. Try a recent desktop browser or a smaller ZIP.",
        ),
      );
    stopProjectWorker();
  };
}

async function chooseFile(file) {
  if (busy || reading || !file) return;
  const current = ++generation;
  revokeDownloads();
  metadata = null;
  main.replaceChildren();
  $("project-options").hidden = true;
  selectedFile = file;
  $("zip-filename").textContent = file.name;
  $("zip-meta").textContent = `${(file.size / 1048576).toFixed(1)} MB`;
  reading = true;
  controls();
  showStatus("Reading your project…", "working");
  try {
    if (!/\.zip$/i.test(file.name))
      throw new Error("Choose a LaTeX project in .zip format.");
    if (file.size > 50 * 1024 * 1024)
      throw new Error("Choose a ZIP smaller than 50 MB.");
    createProjectWorker();
    const archive = await file.arrayBuffer();
    if (current !== generation) return;
    metadata = await projectRequest({ action: "inspect", archive }, [archive]);
    if (current !== generation) return;
    if (metadata.mains.length > 1)
      main.add(new Option("Choose the main .tex file", ""));
    for (const path of metadata.mains) main.add(new Option(path, path));
    engine.value = metadata.engines[main.value] || "pdflatex";
    $("zip-meta").textContent =
      `${(file.size / 1048576).toFixed(1)} MB · ${metadata.count} files`;
    $("project-options").hidden = false;
    showStatus(
      metadata.mains.length > 1
        ? "More than one main document found. Choose the one you want to compile."
        : "Ready. Check the compiler, then generate your PDF.",
    );
  } catch (error) {
    if (current !== generation || error.name === "AbortError") return;
    metadata = null;
    stopProjectWorker();
    showStatus(error.message, "error");
  } finally {
    if (current === generation) {
      reading = false;
      controls();
    }
  }
}

function stopElapsed() {
  clearInterval(elapsedTimer);
  $("converter-elapsed").textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || reading || !metadata || !main.value) return;
  const current = ++generation;
  busy = true;
  controller = new AbortController();
  const { signal } = controller;
  revokeDownloads();
  controls();
  showStatus("Adding the Minnesota style and logos…", "working");
  started = Date.now();
  elapsedTimer = setInterval(() => {
    $("converter-elapsed").textContent =
      `${Math.floor((Date.now() - started) / 1000)}s`;
  }, 1000);
  const basename =
    selectedFile.name.replace(/\.zip$/i, "").replace(/[^a-z0-9._-]+/gi, "-") ||
    "paper";
  try {
    const response = await fetch(
      new URL("../downloads/minnesotanlp.zip", import.meta.url),
      { signal, cache: "no-cache" },
    );
    if (!response.ok)
      throw new Error(
        "The style files could not be downloaded. Check your connection and try again.",
      );
    const overlay = await response.arrayBuffer();
    if (signal.aborted) return;
    const project = await projectRequest(
      { action: "prepare", main: main.value, mode: mode.value, overlay },
      [overlay],
    );
    if (current !== generation || signal.aborted) return;
    downloadLink(
      "result-zip",
      project.archive,
      "application/zip",
      `${basename}-minnesota.zip`,
    );
    $("converter-results").hidden = false;
    $("result-heading").textContent = "Your styled source is ready.";
    $("result-description").textContent =
      "The ZIP includes the style, logos, and .bak copies of any files that changed. Your original ZIP stays untouched.";
    const result = await compileProject(
      project.files,
      main.value,
      engine.value,
      {
        signal,
        onProgress: (text) => {
          if (current === generation) showStatus(text, "working");
        },
      },
    );
    if (current !== generation || signal.aborted) return;
    $("compiler-log").textContent = result.log.slice(-250000);
    $("compiler-log-details").hidden = false;
    downloadLink(
      "result-log",
      result.log,
      "text/plain",
      `${basename}-compile.log`,
    );
    if (!result.success) {
      $("result-heading").textContent =
        "Your source is ready. The PDF needs a fix.";
      $("compiler-log-details").open = true;
      showStatus(
        "LaTeX could not finish. Check the log below, confirm the main file and compiler, or use the styled ZIP in Overleaf.",
        "error",
      );
      return;
    }
    const pdfURL = downloadLink(
      "result-pdf",
      result.pdf,
      "application/pdf",
      `${basename}-minnesota.pdf`,
    );
    $("result-open").href = pdfURL;
    $("result-open").hidden = false;
    $("result-heading").textContent = "Your Minnesota PDF is ready.";
    showStatus(
      result.warnings
        ? "PDF created. LaTeX reported unresolved references or citations; review the compilation log."
        : "Done. Download your PDF and the styled project below.",
      "success",
    );
    $("result-pdf").focus({ preventScroll: true });
    $("converter-results").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  } catch (error) {
    if (current !== generation || error.name === "AbortError") return;
    if (error.details) {
      $("compiler-log").textContent = error.details.slice(-250000);
      $("compiler-log-details").hidden = false;
      $("compiler-log-details").open = true;
      $("converter-results").hidden = false;
      downloadLink(
        "result-log",
        error.details,
        "text/plain",
        `${basename}-compile.log`,
      );
    }
    showStatus(
      error.message ||
        "Compilation failed. You can still use the styled ZIP in Overleaf.",
      "error",
    );
  } finally {
    if (current === generation) {
      busy = false;
      controller = null;
      stopElapsed();
      controls();
    }
  }
});

$("converter-cancel").addEventListener("click", () => {
  ++generation;
  controller?.abort();
  controller = null;
  // A pending archive operation must finish before its worker can be reused.
  if (reading || requests.size) {
    stopProjectWorker();
    metadata = null;
  }
  reading = busy = false;
  stopElapsed();
  showStatus(
    metadata
      ? "Cancelled. You can generate the PDF again."
      : "Cancelled. Choose your ZIP again.",
  );
  controls();
});

$("converter-reset").addEventListener("click", () => {
  ++generation;
  stopProjectWorker();
  selectedFile = metadata = null;
  input.value = "";
  main.replaceChildren();
  revokeDownloads();
  $("project-options").hidden = true;
  $("zip-filename").textContent = "Drop your LaTeX ZIP here";
  $("zip-meta").textContent = "or choose a file · up to 50 MB";
  showStatus(
    "Your files stay in this browser. Nothing is uploaded to a compilation server.",
  );
  controls();
  input.focus();
});

input.addEventListener("change", () => {
  const file = input.files[0];
  input.value = "";
  chooseFile(file);
});
main.addEventListener("change", () => {
  engine.value = metadata?.engines[main.value] || "pdflatex";
  revokeDownloads();
  showStatus(
    main.value
      ? "Ready. Check the compiler, then generate your PDF."
      : "Choose the main .tex file to continue.",
  );
  controls();
});
for (const field of [mode, engine])
  field.addEventListener("change", () => {
    revokeDownloads();
    showStatus("Settings changed. Generate a new PDF to apply them.");
  });
for (const name of ["dragenter", "dragover"])
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    if (!busy && !reading) dropzone.classList.add("is-dragging");
  });
for (const name of ["dragleave", "drop"])
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
dropzone.addEventListener("drop", (event) => {
  if (event.dataTransfer.files.length !== 1)
    return showStatus("Choose one LaTeX project ZIP at a time.", "error");
  chooseFile(event.dataTransfer.files[0]);
});
window.addEventListener("pagehide", () => {
  ++generation;
  controller?.abort();
  stopProjectWorker();
  stopElapsed();
  revokeDownloads();
  selectedFile = metadata = controller = null;
  reading = busy = false;
  input.value = "";
  main.replaceChildren();
  $("project-options").hidden = true;
  $("zip-filename").textContent = "Drop your LaTeX ZIP here";
  $("zip-meta").textContent = "or choose a file · up to 50 MB";
  showStatus(
    "Your files stay in this browser. Nothing is uploaded to a compilation server.",
  );
  controls();
});

if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
  showStatus(
    "Use a recent desktop browser for PDF generation, or follow the Overleaf guide below.",
    "error",
  );
} else {
  input.disabled = false;
  showStatus(
    "Your files stay in this browser. Nothing is uploaded to a compilation server.",
  );
}
