(function () {
  "use strict";

  const ROOT_ID = "atcoder-problem-html-copier";
  const BUTTON_LABEL = "問題文をコピー";
  const COPIED_LABEL = "コピーしました";
  const FAILED_LABEL = "コピー失敗";
  const UNNEEDED_SELECTORS = [
    ".atcoder-easy-test-btn-run-case",
    ".btn-copy",
    ".div-btn-copy",
    "#graph-toggle-container",
    "script",
    "style"
  ];
  const ALLOWED_ATTRIBUTES = {
    a: ["href"],
    img: ["alt", "height", "src", "width"],
    ol: ["start"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"]
  };

  function findTaskStatement() {
    return document.querySelector("#task-statement");
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function removeHiddenLanguage(statement, clone) {
    const originalLanguageNodes = Array.from(
      statement.querySelectorAll(".lang-ja, .lang-en")
    );
    const clonedLanguageNodes = Array.from(
      clone.querySelectorAll(".lang-ja, .lang-en")
    );
    const visibleLanguageCount = originalLanguageNodes.filter(isVisible).length;

    if (visibleLanguageCount > 0) {
      originalLanguageNodes.forEach((node, index) => {
        if (!isVisible(node) && clonedLanguageNodes[index]) {
          clonedLanguageNodes[index].remove();
        }
      });
    }
  }

  function getTexAnnotation(element) {
    const annotation = element.querySelector(
      'annotation[encoding="application/x-tex"]'
    );

    return annotation ? annotation.textContent.trim() : "";
  }

  function replaceMathWithTex(clone) {
    clone.querySelectorAll("var").forEach((element) => {
      const tex = Array.from(
        element.querySelectorAll('annotation[encoding="application/x-tex"]')
      )
        .map((annotation) => annotation.textContent.trim())
        .filter(Boolean)
        .join(" ");

      if (!tex) {
        return;
      }

      element.replaceChildren(document.createTextNode(tex));
    });

    clone.querySelectorAll(".katex").forEach((element) => {
      const tex = getTexAnnotation(element);
      element.replaceWith(document.createTextNode(tex || element.textContent));
    });
  }

  function removeUnneededElements(clone) {
    clone.querySelectorAll(UNNEEDED_SELECTORS.join(",")).forEach((element) => {
      element.remove();
    });
  }

  function unwrapElement(element) {
    while (element.firstChild) {
      element.parentNode.insertBefore(element.firstChild, element);
    }

    element.remove();
  }

  function removeUnneededAttributes(element) {
    const allowedAttributes =
      ALLOWED_ATTRIBUTES[element.tagName.toLowerCase()] || [];

    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes.includes(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  function simplifyHtml(clone) {
    replaceMathWithTex(clone);
    clone.querySelectorAll("span").forEach(unwrapElement);

    removeUnneededAttributes(clone);
    clone.querySelectorAll("*").forEach(removeUnneededAttributes);
  }

  function cloneVisibleProblemHtml(statement) {
    const clone = statement.cloneNode(true);

    removeHiddenLanguage(statement, clone);
    removeUnneededElements(clone);
    simplifyHtml(clone);

    return clone.outerHTML;
  }

  function findProblemTitle(statement) {
    const main = statement.closest("#main-div") || document;

    return main.querySelector(".row > div > .h2, .h2, h2");
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (_error) {
        // Some browsers reject Clipboard API calls from content scripts.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      if (!copied) {
        throw new Error("document.execCommand('copy') returned false");
      }
    } finally {
      textarea.remove();
    }
  }

  function setTemporaryLabel(button, label) {
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = BUTTON_LABEL;
      button.disabled = false;
    }, 1200);
  }

  function createToolbar(statement) {
    const toolbar = document.createElement("span");
    toolbar.id = ROOT_ID;
    toolbar.className = "atcoder-problem-html-copier";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "atcoder-problem-html-copier__button";
    button.textContent = BUTTON_LABEL;
    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await copyText(cloneVisibleProblemHtml(statement));
        setTemporaryLabel(button, COPIED_LABEL);
      } catch (error) {
        console.error("[AtCoder Problem HTML Copier]", error);
        setTemporaryLabel(button, FAILED_LABEL);
      }
    });

    toolbar.appendChild(button);
    return toolbar;
  }

  function placeToolbar(toolbar, statement) {
    const title = findProblemTitle(statement);

    if (title) {
      toolbar.classList.add("atcoder-problem-html-copier--title");
      toolbar.classList.remove("atcoder-problem-html-copier--statement");
      title.appendChild(toolbar);
      return;
    }

    toolbar.classList.add("atcoder-problem-html-copier--statement");
    toolbar.classList.remove("atcoder-problem-html-copier--title");
    statement.parentElement.insertBefore(toolbar, statement);
  }

  function inject() {
    if (document.getElementById(ROOT_ID)) {
      return true;
    }

    const statement = findTaskStatement();
    if (!statement || !statement.parentElement) {
      return false;
    }

    const toolbar = createToolbar(statement);
    placeToolbar(toolbar, statement);
    return true;
  }

  if (!inject()) {
    const observer = new MutationObserver(() => {
      if (inject()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
