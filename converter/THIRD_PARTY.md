# Browser compiler sources and licenses

The browser converter source (`*.mjs` in this directory) is distributed under
the [GNU Affero General Public License, version 3 or later](LICENSE.txt).
Its complete source is available in
[this repository](https://github.com/minnesotanlp/minnesota-nlp-template-project-page/tree/main/converter).

- **TeXlyre BusyTeX v1.4.0 runtime**: unmodified files from the
  [pinned release](https://github.com/TeXlyre/texlyre-busytex/releases/tag/assets-v1.4.0).
  [Runtime source and build instructions](https://github.com/TeXlyre/texlyre-busytex-build)
  and [API repository](https://github.com/TeXlyre/texlyre-busytex) are available
  upstream under AGPL-3.0-or-later. `tools/prepare_runtime.py` verifies the release
  archive's SHA-256 before extracting its compiler and base TeX files. The API
  wrapper package is not used; the converter talks directly to the worker.
- **TeX Live 2026, pdfTeX, XeTeX, LuaHBTeX, BibTeX, and Biber**: the upstream
  runtime includes these programs and base TeX packages. Their component licenses
  continue to apply; see [TeX Live copying conditions](https://tug.org/texlive/copying.html)
  and the [runtime build source](https://github.com/TeXlyre/texlyre-busytex-build).
- **fflate 0.8.2** by Arjun Barrett: the unmodified ES module in
  `vendor/fflate/index.mjs`, under its [MIT license](../vendor/fflate/LICENSE.txt).
  [Source](https://github.com/101arrowz/fflate/tree/v0.8.2).

LaTeX projects and PDFs supplied or created by users are not retained by this
application. Compiler licenses do not assign ownership of those documents to
the project. The existing style files, institutional logos, and font assets keep
their original notices.
