"use strict";

if (location.protocol === "file:") {
  const status = document.getElementById("converter-status");
  status.textContent =
    "PDF generation requires the online page. The Overleaf guide below works offline.";
  const link = document.createElement("a");
  link.href =
    "https://minnesotanlp.github.io/minnesota-nlp-template-project-page/#converter";
  link.className = "text-link";
  link.textContent = " Open the online converter ↗";
  status.append(link);
} else {
  import("./converter/ui.mjs").catch(() => {
    document.getElementById("converter-status").textContent =
      "The converter could not load. Reload the page, or follow the Overleaf guide below.";
  });
}

(() => {
  const modes = {
    color: {
      code: "\\usepackage{minnesotanlp}",
      image: "assets/paper-color.png",
      pdf: "demo.pdf",
      width: 983,
      height: 1390,
      description: "A4 · Single column · Maroon accents · Visible authors",
      note: "A Minnesota signature.",
      alt: "First page of the actual Minnesota-style demo PDF",
    },
    black: {
      code: "\\usepackage[black]{minnesotanlp}",
      image: "assets/paper-black.png",
      pdf: "demo_black.pdf",
      width: 983,
      height: 1390,
      description: "Same layout · Black text accents · Original logo colors",
      note: "The same layout. In black.",
      alt: "First page of the actual black-accent demo PDF",
    },
    off: {
      code: "\\usepackage[off]{minnesotanlp}",
      image: "assets/paper-conference.png",
      pdf: "demo_iclr.pdf",
      width: 1010,
      height: 1307,
      description:
        "Original conference layout · Existing review/final settings",
      note: "Your conference, as it was.",
      alt: "First page of the actual ICLR review PDF with the overlay off",
    },
  };

  let activeMode = "color";
  let toastTimer;
  const previewImage = document.getElementById("paper-preview");
  const toast = document.getElementById("toast");
  const copyTimers = new WeakMap();

  function setMode(mode) {
    if (!Object.hasOwn(modes, mode)) return;
    activeMode = mode;
    const selected = modes[mode];
    document.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-mode-code]").forEach((code) => {
      code.textContent = selected.code;
    });
    if (previewImage.getAttribute("src") !== selected.image)
      previewImage.src = selected.image;
    previewImage.width = selected.width;
    previewImage.height = selected.height;
    previewImage.alt = selected.alt;
    document.querySelector(".paper-stage").dataset.activeMode = mode;
    document.getElementById("mode-description").textContent =
      selected.description;
    document.getElementById("preview-note").textContent = selected.note;
    document.getElementById("preview-pdf").href = `downloads/${selected.pdf}`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  async function copyText(text, button) {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      /* Fall back when clipboard permission is unavailable. */
    }
    if (!copied) {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.append(input);
      input.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        /* Leave a useful manual-copy message. */
      }
      input.remove();
      button.focus({ preventScroll: true });
    }
    if (!copied) {
      showToast(
        "Please select the text in the code block and copy it manually.",
      );
      return;
    }
    clearTimeout(copyTimers.get(button));
    button.classList.add("is-copied");
    const icon = button.querySelector("use");
    if (icon) icon.setAttribute("href", "#icon-check");
    showToast("Code copied to clipboard.");
    copyTimers.set(
      button,
      setTimeout(() => {
        button.classList.remove("is-copied");
        if (icon) icon.setAttribute("href", "#icon-copy");
      }, 2200),
    );
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  document.querySelectorAll("[data-select-mode]").forEach((link) => {
    link.addEventListener("click", () => setMode(link.dataset.selectMode));
  });
  document
    .querySelectorAll("[data-copy-mode], [data-copy]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        copyText(
          button.hasAttribute("data-copy-mode")
            ? modes[activeMode].code
            : button.dataset.copy,
          button,
        ),
      );
    });

  setMode(activeMode);

  for (const mode of ["black", "off"]) {
    const image = new Image();
    image.src = modes[mode].image;
  }
})();
