# Minnesota NLP LaTeX Style

A browser converter and setup guide for the Minnesota NLP LaTeX style.

**[Open the guide](https://minnesotanlp.github.io/minnesota-nlp-template-project-page/)** ·
**[Download the style ZIP](https://minnesotanlp.github.io/minnesota-nlp-template-project-page/downloads/minnesotanlp.zip)**

## ZIP to PDF

1. Open [the converter](https://minnesotanlp.github.io/minnesota-nlp-template-project-page/#converter)
   and choose the complete source ZIP exported from Overleaf, including your
   conference style, figures, and bibliography.
2. Confirm the main `.tex` file, Minnesota or Black style, and the compiler used
   by your original project (pdfLaTeX, XeLaTeX, or LuaLaTeX). When the archive has
   several main documents, select one explicitly.
3. Click **Generate my PDF**, then download the PDF and the styled source ZIP.

The converter adds the style package and logos to the main document's folder.
Changed files are preserved as numbered `.bak` copies in the output ZIP. It
does not alter the ZIP you selected. A failed build shows the LaTeX log and still
lets you download the styled source for use with your usual Overleaf setup.

Compilation runs in a Web Worker inside your browser. Document contents and
generated PDFs are held in memory, not uploaded or stored by a compilation
server. Clearing the project or leaving the page releases those files. The page
downloads compiler assets from this site and missing TeX files by filename from
`https://texlive2026.texlyre.org`; it does not send document bodies there.

The first run downloads about **120 MB** of compiler assets. Extra TeX packages,
fonts, or Biber may require additional downloads. Internet access and a recent
desktop browser are recommended. Limits: **50 MB ZIP**, **150 MB extracted**,
**50 MB per file**, **2,000 archive entries**, and **3 minutes per compilation**.
Use UTF-8 for the main source. Native shell commands, external Python scripts,
and automatic EPS conversion are not available. Check the PDF and any warnings
in the log before sharing it.

## How to use in Overleaf

1. Upload your conference's official template to Overleaf, or open your existing
   paper project.
2. Download and unzip `minnesotanlp.zip`. Upload `minnesotanlp.sty` beside your
   main `.tex` file, and keep the two images in a folder named `logos`:

   ```text
   your-paper/
   ├── main.tex
   ├── your_conference.sty
   ├── minnesotanlp.sty
   └── logos/
       ├── university_of_minnesota_logo.png
       └── minnesota_nlp_logo.png
   ```

3. Add this line **after all other packages**, before `\begin{document}`:

   ```latex
   \usepackage{minnesotanlp}
   ```

Recompile using your conference template's usual compiler. Keep its original
style, title/author commands, paper content, bibliography, and supporting files.
No Git clone, Python installation, or conference registration is required.

| Package line | Result |
| --- | --- |
| `\usepackage{minnesotanlp}` | A4, single column, maroon accents, visible authors |
| `\usepackage[black]{minnesotanlp}` | Same layout with black text accents; logos keep their colors |
| `\usepackage[off]{minnesotanlp}` | Original conference layout and its review/final settings |

For an anonymous submission, use `[off]` together with the conference's review
setting. Minnesota and Black modes display author information. In those two
modes, single-line figure and table captions are centered; longer captions are
justified.

Optional metadata goes after the package line and is harmless in `[off]` mode:

```latex
\runningtitle{A short title for later pages}
\correspondingauthor{Correspondence: \email{author@umn.edu}}
\reportnumber{Technical Report}
```

For local writing, follow the same steps in your paper directory and compile
with your usual engine. For example, for a pdfLaTeX project with `latexmk`
installed, run `latexmk -pdf main.tex` from that directory.

## Compatibility and support

Tested with ICLR 2027, NeurIPS 2026, ACL's shared template, ICML 2025, CVPR 2026,
ICCV 2025, and plain `article`. A new year or conference can change the template
interfaces and needs its own compatibility check.

To request another version or report a problem, [open an issue](https://github.com/minnesotanlp/minnesota-nlp-template-project-page/issues/new)
with the conference/year, the official template URL, compiler, and a minimal
example or relevant error message. For missing logos, first check the filenames
and `logos/` location shown above.

## Maintain the website

The site uses plain HTML, CSS, and JavaScript. There is no npm build. To prepare
the compiler for local testing, run the asset fetcher once with Python 3.11+:

```bash
python3 tools/prepare_runtime.py
node --test tests/project.test.mjs
python3 -m http.server 8000
```

The fetcher downloads a pinned upstream release (about 500 MB), verifies its
SHA-256, and extracts only the required runtime files into the ignored
`runtime/` directory. Large compiler binaries are not committed to Git.

Open `http://localhost:8000`. Opening `index.html` directly still shows the guide;
the converter needs an HTTP(S) server. Edit `index.html`, `styles.css`, `app.js`,
and `converter/` to update the page and converter. When refreshing
a style release, update the ZIP and demo PDFs in `downloads/` and their matching
first-page preview images in `assets/` together. Template maintainers can copy
the refreshed `docs/assets/` and `docs/downloads/` from the style source repository.
Maintain the live page and converter in this repository; the template repository
also keeps a separate offline walkthrough.

Push to `main` to deploy automatically through
[the GitHub Pages workflow](.github/workflows/pages.yml). The workflow publishes
the page files, `assets/`, `downloads/`, `converter/`, `vendor/`, and the verified
compiler runtime. It can also be run manually from
the repository's Actions tab. GitHub Pages uses **GitHub Actions** as its source.

The bundled, unmodified Pretendard font includes its
[SIL Open Font License](assets/fonts/LICENSE.txt).
Browser compiler sources, pinned dependency versions, and licenses are listed in
[the compiler credits](converter/THIRD_PARTY.md).
