(function () {
  "use strict";

  const ROOT_ID = "atcoder-problem-html-copier";
  const BUTTON_LABEL = "問題HTMLをコピー";
  const COPIED_LABEL = "コピーしました";
  const FAILED_LABEL = "コピー失敗";

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

  function cloneVisibleProblemHtml(statement) {
    const clone = statement.cloneNode(true);
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

    return clone.outerHTML;
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
    const toolbar = document.createElement("div");
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

  function inject() {
    if (document.getElementById(ROOT_ID)) {
      return true;
    }

    const statement = findTaskStatement();
    if (!statement || !statement.parentElement) {
      return false;
    }

    statement.parentElement.insertBefore(createToolbar(statement), statement);
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
