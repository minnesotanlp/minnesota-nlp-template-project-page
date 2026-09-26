# Minnesota NLP LaTeX Style

A one-line style overlay for conference papers, with an interactive setup guide.

**[Open the guide](https://minnesotanlp.github.io/minnesota-nlp-template-project-page/)** ·
**[Download the style ZIP](https://minnesotanlp.github.io/minnesota-nlp-template-project-page/downloads/minnesotanlp.zip)**

## How to use

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

The site is plain HTML, CSS, and JavaScript. There is no build or package install.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`, or open `index.html` directly for an offline preview.
Edit `index.html`, `styles.css`, and `app.js` to update the guide. When refreshing
a style release, update the ZIP and demo PDFs in `downloads/` and their matching
first-page preview images in `assets/` together. Template maintainers can copy
the refreshed `docs/` contents from the style source repository.

Push to `main` to deploy automatically through
[the GitHub Pages workflow](.github/workflows/pages.yml). The workflow publishes
only the page files, `assets/`, and `downloads/`. It can also be run manually from
the repository's Actions tab. GitHub Pages uses **GitHub Actions** as its source.

The bundled, unmodified Pretendard font includes its
[SIL Open Font License](assets/fonts/LICENSE.txt).
