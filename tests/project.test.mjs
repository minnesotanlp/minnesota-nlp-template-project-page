import test from "node:test";
import { unresolvedReferences } from "../converter/compiler.mjs";
import assert from "node:assert/strict";
import {
  zipSync,
  unzipSync,
  strToU8,
  strFromU8,
} from "../vendor/fflate/index.mjs";
import {
  configure,
  withoutComments,
  safePath,
  readArchive,
  mainDocuments,
  suggestedEngine,
  prepareProject,
} from "../converter/project.mjs";

const source =
  "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\nOriginal contents.\n\\end{document}\n";

test("bibliography warnings from an earlier pass do not flag a resolved PDF", () => {
  const first =
    "$ luahblatex main.tex\nLaTeX Warning: There were undefined references.\n";
  const final = "$ luahblatex main.tex\nOutput written on main.pdf\n";
  assert.equal(
    unresolvedReferences(first + "$ bibtex8 main.aux\n" + final),
    false,
  );
  assert.equal(unresolvedReferences(final + first), true);
});
const overlay = new Map([
  ["minnesotanlp.sty", strToU8("new style")],
  ["logos/university_of_minnesota_logo.png", new Uint8Array([1, 2, 3])],
  ["logos/minnesota_nlp_logo.png", new Uint8Array([4, 5, 6])],
]);
const makeZIP = (entries) =>
  zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, content]) => [
        name,
        typeof content === "string" ? strToU8(content) : content,
      ]),
    ),
  );

test("adds the overlay last, preserving comments, CRLF, and document contents", () => {
  const original =
    "% \\usepackage{minnesotanlp}\r\n" + source.replaceAll("\n", "\r\n");
  const result = configure(original);
  assert.equal(
    result,
    original.replace(
      "\\begin{document}",
      "\\usepackage{minnesotanlp}\r\n\\begin{document}",
    ),
  );
  assert.equal(configure(result), result);
});

test("switches existing modes without changing later metadata commands", () => {
  const original = source.replace(
    "\\begin{document}",
    "\\usepackage[off]{minnesotanlp}\n\\runningtitle{Short}\n\\begin{document}",
  );
  const result = configure(original, "black");
  assert.match(result, /\\usepackage\[black\]\{minnesotanlp\}\n\\runningtitle/);
  assert.equal(configure(result, "color"), original.replace("[off]", ""));
});

test("comments after escaped percentages are still comments", () => {
  const original = "Price: \\% 50 % \\begin{document}\n";
  const cleaned = withoutComments(original);
  assert.equal(cleaned.length, original.length);
  assert.ok(cleaned.startsWith("Price: \\% 50 "));
  assert.ok(!cleaned.includes("begin"));
  assert.ok(!withoutComments("\\\\% commented").includes("commented"));
});

test("ambiguous package declarations and absent main documents fail clearly", () => {
  assert.throws(() => configure("% \\begin{document}"), /main/);
  assert.throws(
    () =>
      configure(
        source.replace(
          "\\usepackage{graphicx}",
          "\\usepackage{graphicx,minnesotanlp}",
        ),
      ),
    /own/,
  );
  assert.throws(
    () =>
      configure(
        configure(source).replace(
          "\\begin{document}",
          "\\usepackage{minnesotanlp}\n\\begin{document}",
        ),
      ),
    /more than once/,
  );
  assert.throws(() => configure(source, "unknown"), /supported/);
});

test("ZIP paths cannot escape their project or collide after normalization", () => {
  for (const path of [
    "../secret.tex",
    "/main.tex",
    "C:\\main.tex",
    "safe/../../file",
    "bad\0file",
  ])
    assert.throws(() => safePath(path), /unsafe/);
  assert.equal(safePath("paper\\main.tex"), "paper/main.tex");
  assert.throws(
    () => readArchive(makeZIP({ "../main.tex": source })),
    /unsafe/,
  );
  assert.throws(
    () => readArchive(makeZIP({ "main.tex": source, "./main.tex": source })),
    /duplicate/,
  );
});

test("rejects malformed ZIPs and declared oversized entries before inflation", () => {
  assert.throws(() => readArchive(strToU8("not a ZIP")), /could not be opened/);
  const archive = makeZIP({ "main.tex": source });
  const view = new DataView(archive.buffer);
  for (let offset = 0; offset < archive.length - 28; offset++) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      view.setUint32(offset + 24, 200 * 1024 * 1024, true);
      break;
    }
  }
  assert.throws(() => readArchive(archive), /too large/);
});

test("finds multiple real main files without treating included sections or comments as mains", () => {
  const project = readArchive(
    makeZIP({
      "paper/main.tex": source,
      "paper/supplement.tex": source,
      "paper/section.tex": "\\section{Methods}",
      "paper/old.tex": "% \\documentclass{article}\n% \\begin{document}",
      "__MACOSX/._main.tex": source,
    }),
  );
  assert.deepEqual(mainDocuments(project), [
    "paper/main.tex",
    "paper/supplement.tex",
  ]);
  assert.equal(project.size, 4);
});

test("nested projects retain figures, bibliography, originals, and numbered backups", () => {
  const figure = new Uint8Array([0, 255, 127, 5]);
  const project = readArchive(
    makeZIP({
      "paper/main.tex": source,
      "paper/main.tex.bak": "previous backup",
      "paper/minnesotanlp.sty": "old style",
      "paper/figures/plot.pdf": figure,
      "paper/references.bib": "@article{test,title={Keep me}}",
      "paper/main.aux": "stale cache",
    }),
  );
  const result = prepareProject(project, "paper/main.tex", "color", overlay);
  const output = unzipSync(result.archive);
  assert.equal(strFromU8(output["paper/main.tex.bak.1"]), source);
  assert.equal(strFromU8(output["paper/minnesotanlp.sty.bak"]), "old style");
  assert.deepEqual(output["paper/figures/plot.pdf"], figure);
  assert.deepEqual(
    output["paper/logos/minnesota_nlp_logo.png"],
    overlay.get("logos/minnesota_nlp_logo.png"),
  );
  assert.equal(strFromU8(project.get("paper/main.tex")), source);
  assert.ok(
    !result.files.some((file) => /\.(?:aux|bak)(?:\.\d+)?$/.test(file.path)),
  );
  assert.ok(result.files.some((file) => file.path === "paper/references.bib"));
  const repeated = prepareProject(
    readArchive(result.archive),
    "paper/main.tex",
    "color",
    overlay,
  );
  assert.deepEqual(repeated.backups, []);
});

test("recognizes compiler directives and rejects selecting an included section", () => {
  const project = new Map([
    ["main.tex", strToU8("% !TeX program = lualatex\n" + source)],
    ["section.tex", strToU8("Content")],
  ]);
  assert.equal(suggestedEngine(project, "main.tex"), "lualatex");
  assert.throws(
    () => prepareProject(project, "section.tex", "color", overlay),
    /main document/,
  );
});

test("old output PDFs never enter the compiler and conflicting folders fail safely", () => {
  const project = new Map([
    ["main.tex", strToU8(source)],
    ["main.pdf", strToU8("old PDF")],
  ]);
  assert.ok(
    !prepareProject(project, "main.tex", "color", overlay).files.some(
      (file) => file.path === "main.pdf",
    ),
  );
  project.set("logos", strToU8("a file occupying the logo directory"));
  assert.throws(
    () => prepareProject(project, "main.tex", "color", overlay),
    /blocks the required/,
  );
  assert.equal(strFromU8(project.get("main.tex")), source);
});
