(function () {
  "use strict";

  const PROBLEM_ROOT_ID = "atcoder-problem-html-copier";
  const TOOLBAR_CLASS = "atcoder-problem-html-copier";
  const INJECTED_ATTRIBUTE = "data-atcoder-html-copier-injected";
  const SCOPE_ATTRIBUTE = "data-atcoder-html-copier-scope";
  const ALL_PROBLEMS_SCOPE = "all-problems";
  const PROBLEM_BUTTON_LABEL = "問題文をコピー";
  const PRINT_PROBLEM_BUTTON_LABEL = "全問題文をコピー";
  const EDITORIAL_BUTTON_LABEL = "解説HTMLをコピー";
  const COPIED_LABEL = "コピーしました";
  const FAILED_LABEL = "コピー失敗";
  const UNNEEDED_SELECTORS = [
    `.${TOOLBAR_CLASS}`,
    ".atcoder-easy-test-btn-run-case",
    ".btn-copy",
    ".div-btn-copy",
    "#graph-toggle-container",
    ".hidden",
    "[hidden]",
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
  const EDITORIAL_CONTENT_SELECTOR = [
    "p",
    "pre",
    "table",
    "blockquote",
    "details",
    "code",
    "math",
    ".katex",
    "img:not(.user-rating-stage-s):not(.user-rating-stage-m):not(.user-rating-stage-l)"
  ].join(",");

  function isAtCoderPage() {
    return /(^|\.)atcoder\.jp$/.test(location.hostname);
  }

  function findTaskStatements() {
    return Array.from(document.querySelectorAll('[id="task-statement"]'));
  }

  function isAtCoderTasksPrintPage() {
    return /^\/contests\/[^/]+\/tasks_print\/?$/.test(location.pathname);
  }

  function isAtCoderEditorialPage() {
    return (
      /^\/contests\/[^/]+\/editorial(?:\/[^/]+)?\/?$/.test(
        location.pathname
      ) ||
      /^\/contests\/[^/]+\/tasks\/[^/]+\/editorial\/?$/.test(
        location.pathname
      )
    );
  }

  function isIndividualEditorialPage() {
    return /^\/contests\/[^/]+\/editorial\/[^/]+\/?$/.test(location.pathname);
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
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

  function hasMeaningfulHtmlContent(element) {
    return (
      normalizeText(element.textContent).length > 0 ||
      Boolean(element.querySelector("img, pre, table, math, .katex"))
    );
  }

  function removeEmptyElements(container) {
    Array.from(container.querySelectorAll("div, section, article, ul, ol, li, p"))
      .reverse()
      .forEach((element) => {
        if (!hasMeaningfulHtmlContent(element)) {
          element.remove();
        }
      });
  }

  function isIgnorableEdgeNode(node) {
    return (
      (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) ||
      (node.nodeType === Node.ELEMENT_NODE && node.matches("br"))
    );
  }

  function removeEdgeBreaks(container) {
    while (container.firstChild && isIgnorableEdgeNode(container.firstChild)) {
      container.firstChild.remove();
    }

    while (container.lastChild && isIgnorableEdgeNode(container.lastChild)) {
      container.lastChild.remove();
    }
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

  function cloneVisibleHtml(element) {
    const clone = element.cloneNode(true);

    removeHiddenLanguage(element, clone);
    removeUnneededElements(clone);
    simplifyHtml(clone);

    return clone.outerHTML;
  }

  function cloneVisibleHtmlFromNodes(nodes) {
    const wrapper = document.createElement("div");

    nodes.forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
    });

    removeUnneededElements(wrapper);
    simplifyHtml(wrapper);
    removeEmptyElements(wrapper);
    removeEdgeBreaks(wrapper);

    return wrapper.innerHTML.trim();
  }

  function getCleanProblemTitleText(title) {
    const clone = title.cloneNode(true);

    removeUnneededElements(clone);

    return normalizeText(clone.textContent);
  }

  function cloneAllProblemStatementsHtml(statements) {
    const wrapper = document.createElement("div");

    statements.forEach((statement) => {
      const section = document.createElement("section");
      const title = findProblemTitle(statement);

      if (title) {
        const heading = document.createElement("h2");
        heading.textContent = getCleanProblemTitleText(title);
        section.appendChild(heading);
      }

      const statementClone = statement.cloneNode(true);
      removeHiddenLanguage(statement, statementClone);
      section.appendChild(statementClone);
      wrapper.appendChild(section);
    });

    removeUnneededElements(wrapper);
    simplifyHtml(wrapper);
    removeEmptyElements(wrapper);
    removeEdgeBreaks(wrapper);

    return wrapper.innerHTML.trim();
  }

  function findPreviousProblemTitle(statement) {
    for (
      let element = statement.previousElementSibling;
      element;
      element = element.previousElementSibling
    ) {
      if (element.matches(".h2, h2")) {
        return element;
      }

      const title = element.querySelector(".h2, h2");
      if (title) {
        return title;
      }
    }

    return null;
  }

  function findProblemTitle(statement) {
    const previousTitle = findPreviousProblemTitle(statement);

    if (previousTitle) {
      return previousTitle;
    }

    const main =
      statement.closest("#main-div") || statement.parentElement || document;

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

  function setTemporaryLabel(button, label, defaultLabel) {
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = defaultLabel;
      button.disabled = false;
    }, 1200);
  }

  function createToolbar(label, getHtml) {
    const toolbar = document.createElement("span");
    toolbar.className = TOOLBAR_CLASS;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "atcoder-problem-html-copier__button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await copyText(getHtml());
        setTemporaryLabel(button, COPIED_LABEL, label);
      } catch (error) {
        console.error("[AtCoder HTML Copier]", error);
        setTemporaryLabel(button, FAILED_LABEL, label);
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

  function injectProblemStatement(statement, index) {
    if (!statement || !statement.parentElement) {
      return false;
    }

    if (statement.hasAttribute(INJECTED_ATTRIBUTE)) {
      return false;
    }

    const toolbar = createToolbar(PROBLEM_BUTTON_LABEL, () =>
      cloneVisibleHtml(statement)
    );
    toolbar.id =
      index === 0 ? PROBLEM_ROOT_ID : `${PROBLEM_ROOT_ID}-${index + 1}`;
    placeToolbar(toolbar, statement);
    statement.setAttribute(INJECTED_ATTRIBUTE, "true");
    return true;
  }

  function injectPrintProblemStatements(statements) {
    const existingToolbar = document.getElementById(PROBLEM_ROOT_ID);

    if (
      existingToolbar &&
      existingToolbar.getAttribute(SCOPE_ATTRIBUTE) === ALL_PROBLEMS_SCOPE
    ) {
      return true;
    }

    const firstStatement = statements[0];
    if (!firstStatement || !firstStatement.parentElement) {
      return false;
    }

    document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((toolbar) => {
      toolbar.remove();
    });

    const toolbar = createToolbar(PRINT_PROBLEM_BUTTON_LABEL, () =>
      cloneAllProblemStatementsHtml(findTaskStatements())
    );
    toolbar.id = PROBLEM_ROOT_ID;
    toolbar.setAttribute(SCOPE_ATTRIBUTE, ALL_PROBLEMS_SCOPE);
    placeToolbar(toolbar, firstStatement);

    statements.forEach((statement) => {
      statement.setAttribute(INJECTED_ATTRIBUTE, "true");
    });

    return true;
  }

  function injectProblemStatements() {
    const statements = findTaskStatements();

    if (isAtCoderTasksPrintPage() || statements.length > 1) {
      return injectPrintProblemStatements(statements);
    }

    let injected = false;

    statements.forEach((statement, index) => {
      injected = injectProblemStatement(statement, index) || injected;
    });

    return injected;
  }

  function findIndividualEditorialArticle() {
    if (!isIndividualEditorialPage()) {
      return null;
    }

    const container = document.querySelector("#main-container .row > .col-sm-12");

    if (!container) {
      return null;
    }

    const title = Array.from(container.children).find((element) =>
      element.matches("h2")
    );

    if (!title) {
      return null;
    }

    let passedHeaderSeparator = false;

    for (
      let element = title.nextElementSibling;
      element;
      element = element.nextElementSibling
    ) {
      if (element.matches("hr")) {
        passedHeaderSeparator = true;
        continue;
      }

      if (!passedHeaderSeparator) {
        continue;
      }

      if (
        element.matches(
          ".clearfix, .a2a_kit, script, style, hr, #atcoder-problem-html-copier"
        )
      ) {
        continue;
      }

      if (hasSubstantialEditorialContent([element])) {
        return {
          attachTarget: title,
          getHtml: () => cloneVisibleHtml(element)
        };
      }
    }

    return null;
  }

  function hasEditorialIdentity(element) {
    return Boolean(
      element.querySelector('a[href*="/editorial/"], a[href*="/users/"]')
    );
  }

  function findEditorialHeaderElement(element) {
    const headerSelector =
      "li, .panel-heading, .panel-title, .card-header, h1, h2, h3, h4";
    const descendantCandidates = Array.from(
      element.querySelectorAll(headerSelector)
    );
    const candidates = element.matches(headerSelector)
      ? [element, ...descendantCandidates]
      : [...descendantCandidates, element];

    return (
      candidates.find((candidate) => {
        if (candidate.closest(`.${TOOLBAR_CLASS}`)) {
          return false;
        }

        return hasEditorialIdentity(candidate);
      }) || null
    );
  }

  function looksLikeEditorialBlockStart(element) {
    if (
      !element.matches(
        "ul, li, article, section, .editorial-section, .panel, .card"
      )
    ) {
      return false;
    }

    return Boolean(findEditorialHeaderElement(element));
  }

  function isEditorialBlockBoundary(element) {
    return (
      element.matches("hr, script, style, .clearfix, .a2a_kit") ||
      looksLikeEditorialBlockStart(element)
    );
  }

  function collectEditorialBlockNodes(startElement) {
    const nodes = [startElement];

    for (
      let node = startElement.nextSibling;
      node;
      node = node.nextSibling
    ) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        isEditorialBlockBoundary(node)
      ) {
        break;
      }

      nodes.push(node);
    }

    return nodes;
  }

  function hasSubstantialEditorialContent(nodes) {
    const wrapper = document.createElement("div");

    nodes.forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
    });

    removeUnneededElements(wrapper);

    const contentElement = wrapper.querySelector(EDITORIAL_CONTENT_SELECTOR);

    if (!contentElement) {
      return false;
    }

    if (contentElement.matches("img")) {
      return true;
    }

    return normalizeText(wrapper.textContent).length > 20;
  }

  function findExpandedEditorialArticles() {
    if (!isAtCoderEditorialPage()) {
      return [];
    }

    const roots = Array.from(
      document.querySelectorAll(
        "#main-container .col-sm-12, #main-container .col-sm-12 ul, .editorial-section, .editorial-section ul"
      )
    );
    const articles = [];
    const seenStarts = new Set();

    roots.forEach((root) => {
      Array.from(root.children).forEach((startElement) => {
        if (seenStarts.has(startElement)) {
          return;
        }

        if (!looksLikeEditorialBlockStart(startElement)) {
          return;
        }

        const nodes = collectEditorialBlockNodes(startElement);

        if (!hasSubstantialEditorialContent(nodes)) {
          return;
        }

        const attachTarget = findEditorialHeaderElement(startElement);

        if (!attachTarget) {
          return;
        }

        seenStarts.add(startElement);
        articles.push({
          attachTarget,
          getHtml: () => cloneVisibleHtmlFromNodes(nodes)
        });
      });
    });

    return articles;
  }

  function injectEditorialToolbar(article) {
    if (article.attachTarget.hasAttribute(INJECTED_ATTRIBUTE)) {
      return false;
    }

    const toolbar = createToolbar(EDITORIAL_BUTTON_LABEL, article.getHtml);
    toolbar.classList.add("atcoder-problem-html-copier--editorial");
    article.attachTarget.appendChild(toolbar);
    article.attachTarget.setAttribute(INJECTED_ATTRIBUTE, "true");

    return true;
  }

  function injectEditorialArticles() {
    const articles = [];
    const individualArticle = findIndividualEditorialArticle();

    if (individualArticle) {
      articles.push(individualArticle);
    }

    articles.push(...findExpandedEditorialArticles());

    return articles.some(injectEditorialToolbar);
  }

  function inject() {
    const problemInjected = injectProblemStatements();
    const editorialInjected = injectEditorialArticles();

    return problemInjected || editorialInjected;
  }

  if (!isAtCoderPage()) {
    return;
  }

  const injectedImmediately = inject();

  if (!injectedImmediately || isAtCoderEditorialPage()) {
    const observer = new MutationObserver(() => {
      inject();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 30000);
  }
})();
