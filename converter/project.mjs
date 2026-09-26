// SPDX-License-Identifier: AGPL-3.0-or-later
import { unzipSync, zipSync } from "../vendor/fflate/index.mjs";

export const LIMITS = Object.freeze({
  archive: 50 * 1024 * 1024,
  expanded: 150 * 1024 * 1024,
  file: 50 * 1024 * 1024,
  count: 2000,
});
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function safePath(name) {
  const path = name.replaceAll("\\", "/");
  if (
    !path ||
    path.startsWith("/") ||
    /^[a-z]:/i.test(path) ||
    /[\x00-\x1f\x7f]/.test(path) ||
    path.split("/").includes("..") ||
    path.length > 500
  )
    throw new Error("The ZIP contains an unsafe or unsupported filename.");
  return path
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}

function ignored(path) {
  return path
    .split("/")
    .some(
      (part) => part === "__MACOSX" || part === ".git" || part === ".DS_Store",
    );
}

export function withoutComments(text) {
  const characters = text.split("");
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== "%") continue;
    let previous = index - 1;
    while (previous >= 0 && text[previous] === "\\") previous--;
    if ((index - previous - 1) % 2) continue;
    while (index < text.length && !/[\r\n]/.test(text[index])) {
      characters[index++] = " ";
    }
  }
  return characters.join("");
}

export function configure(text, mode = "color") {
  if (!["color", "black", "off"].includes(mode))
    throw new Error("Choose a supported style.");
  const active = withoutComments(text);
  const begin = /\\begin\s*\{\s*document\s*\}/.exec(active);
  if (!begin)
    throw new Error("Choose the main .tex file containing \\begin{document}.");
  const packages = [
    ...active
      .slice(0, begin.index)
      .matchAll(
        /\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\]\s*)?\{([^}]*)\}/g,
      ),
  ];
  const existing = packages.filter((match) =>
    match[1].split(",").some((name) => name.trim() === "minnesotanlp"),
  );
  if (existing.length > 1)
    throw new Error(
      "This document loads minnesotanlp more than once. Keep one package line and try again.",
    );
  const command = `\\usepackage${mode === "color" ? "" : `[${mode}]`}{minnesotanlp}`;
  if (existing.length) {
    const match = existing[0];
    if (match[1].trim() !== "minnesotanlp")
      throw new Error(
        "Put minnesotanlp in its own \\usepackage line and try again.",
      );
    return (
      text.slice(0, match.index) +
      command +
      text.slice(match.index + match[0].length)
    );
  }
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  return (
    text.slice(0, begin.index) + command + newline + text.slice(begin.index)
  );
}

export function readArchive(bytes) {
  if (bytes.byteLength > LIMITS.archive)
    throw new Error("Choose a ZIP smaller than 50 MB.");
  let count = 0,
    total = 0;
  const names = new Set();
  let files;
  try {
    files = unzipSync(bytes, {
      filter(entry) {
        const path = safePath(entry.name);
        if (++count > LIMITS.count)
          throw new Error("The ZIP contains more than 2,000 entries.");
        if (
          entry.originalSize > LIMITS.file ||
          (total += entry.originalSize) > LIMITS.expanded
        ) {
          throw new Error(
            "The expanded project is too large (150 MB total, 50 MB per file).",
          );
        }
        if (names.has(path))
          throw new Error(
            "The ZIP contains duplicate filenames. Export a fresh ZIP and try again.",
          );
        names.add(path);
        return !entry.name.endsWith("/") && !ignored(path);
      },
    });
  } catch (error) {
    if (error.code !== undefined)
      throw new Error(
        "This ZIP could not be opened. Use an unencrypted ZIP exported from Overleaf.",
      );
    throw error;
  }
  const project = new Map(
    Object.entries(files).map(([path, contents]) => [safePath(path), contents]),
  );
  if (!project.size)
    throw new Error("The ZIP does not contain any project files.");
  return project;
}

export function mainDocuments(project) {
  const candidates = [];
  for (const [path, contents] of project) {
    if (!/\.tex$/i.test(path)) continue;
    let text;
    try {
      text = decoder.decode(contents);
    } catch {
      continue;
    }
    const active = withoutComments(text);
    if (
      /\\documentclass(?:\s|\[|\{)/.test(active) &&
      /\\begin\s*\{\s*document\s*\}/.test(active)
    )
      candidates.push(path);
  }
  return candidates.sort((a, b) => a.localeCompare(b));
}

export function suggestedEngine(project, path) {
  const source = decoder.decode(project.get(path));
  const magic = /%\s*!\s*tex\s+(?:ts-)?program\s*=\s*(pdf|xe|lua)latex/i.exec(
    source,
  );
  if (magic) return `${magic[1].toLowerCase()}latex`;
  if (/\\(?:setmainfont|setCJKmainfont)\b/.test(withoutComments(source)))
    return "xelatex";
  return "pdflatex";
}

function sameBytes(left, right) {
  return (
    left?.length === right.length &&
    right.every((value, index) => value === left[index])
  );
}

export function prepareProject(project, main, mode, overlay) {
  if (!mainDocuments(project).includes(main))
    throw new Error("Select the main document from this ZIP.");
  const updated = new Map(project);
  const prefix = main.includes("/")
    ? main.slice(0, main.lastIndexOf("/") + 1)
    : "";
  const backups = [];
  function replace(path, bytes) {
    const parts = path.split("/");
    if (
      [...updated.keys()].some((name) => name.startsWith(`${path}/`)) ||
      parts.some(
        (_, index) => index > 0 && updated.has(parts.slice(0, index).join("/")),
      )
    )
      throw new Error(
        `A file or folder blocks the required style path: ${path}`,
      );
    const previous = updated.get(path);
    if (sameBytes(previous, bytes)) return;
    if (previous) {
      let backup = `${path}.bak`,
        number = 1;
      while (
        updated.has(backup) ||
        [...updated.keys()].some((name) => name.startsWith(`${backup}/`))
      )
        backup = `${path}.bak.${number++}`;
      updated.set(backup, previous);
      backups.push(backup);
    }
    updated.set(path, bytes);
  }
  const source = configure(decoder.decode(project.get(main)), mode);
  replace(main, encoder.encode(source));
  for (const name of [
    "minnesotanlp.sty",
    "logos/university_of_minnesota_logo.png",
    "logos/minnesota_nlp_logo.png",
  ]) {
    if (!overlay.has(name))
      throw new Error(
        "The style download is incomplete. Reload the page and try again.",
      );
    replace(prefix + name, overlay.get(name));
  }
  const generated =
    /(?:\.(?:aux|log|fls|fdb_latexmk|out|toc|lof|lot|bcf|blg|nav|snm|vrb)|\.run\.xml|\.synctex\.gz|\.bak(?:\.\d+)?)$/i;
  const files = [...updated]
    .filter(
      ([path]) =>
        !generated.test(path) &&
        path !== main.replace(/\.tex$/i, ".pdf") &&
        path !== main.replace(/\.tex$/i, ".xdv") &&
        path !== main.replace(/\.tex$/i, ".dvi"),
    )
    .map(([path, bytes]) => {
      let contents = bytes;
      if (/\.(?:tex|sty|cls|bib|bst|cfg|def|clo)$/i.test(path)) {
        try {
          contents = decoder.decode(bytes);
        } catch {
          /* Preserve non-UTF-8 dependencies byte for byte. */
        }
      }
      return { path, contents };
    });
  return {
    files,
    archive: zipSync(Object.fromEntries(updated), { level: 6 }),
    backups,
  };
}
