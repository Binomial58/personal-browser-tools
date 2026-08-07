/*
 * Based on the feature set and general approach of "AtCoder Listing Tasks"
 * (https://github.com/luuguas/AtCoderListingTasks) by luuguas, licensed
 * under the Apache License, Version 2.0 (see ./LICENSE). This file is an
 * independent rewrite for use as a browser extension content script rather
 * than a userscript: no jQuery dependency, chrome.storage.local instead of
 * IndexedDB, plus a new search/filter box and current-task highlighting
 * that the original did not have.
 */
(function () {
  "use strict";

  const ROOT_ID = "atcoder-listing-tasks-tab";
  const PREFIX = "alt";
  const MODAL_ID = `${PREFIX}-modal`;
  const ATONCE_TAB_MAX = 20;
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  const STORAGE_KEYS = {
    newTab: "atcoder-listing-tasks:new-tab",
    reverse: "atcoder-listing-tasks:reverse",
    listCachePrefix: "atcoder-listing-tasks:list:"
  };

  function storageGet(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (items) => resolve(items[key] ?? null));
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  function getContestName() {
    const match = location.pathname.match(/^\/contests\/([^/]+)/);
    return match ? match[1] : null;
  }

  function getCurrentTaskId() {
    const match = location.pathname.match(
      /^\/contests\/[^/]+\/tasks\/([^/]+)\/?$/
    );
    return match ? match[1] : null;
  }

  function parseTaskRows(doc) {
    const rows = Array.from(doc.querySelectorAll("table tbody tr"));
    const list = [];
    const seen = new Set();

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      const link = cells[0] ? cells[0].querySelector("a") : null;

      if (!link) {
        return;
      }

      const href = link.getAttribute("href") || "";

      if (!href || seen.has(href)) {
        return;
      }

      seen.add(href);
      list.push({
        url: href,
        diff: link.textContent.trim(),
        name: cells[1] ? cells[1].textContent.trim() : link.textContent.trim()
      });
    });

    return list;
  }

  async function fetchProblemList(contestName) {
    const cacheKey = `${STORAGE_KEYS.listCachePrefix}${contestName}`;
    const cached = await storageGet(cacheKey);

    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      return cached.list;
    }

    try {
      const response = await fetch(`/contests/${contestName}/tasks`, {
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error(`GET tasks failed: ${response.status}`);
      }

      const doc = new DOMParser().parseFromString(
        await response.text(),
        "text/html"
      );
      const list = parseTaskRows(doc);

      if (list.length > 0) {
        await storageSet(cacheKey, { list, savedAt: Date.now() });
      }

      return list;
    } catch (error) {
      console.warn("[AtCoder Listing Tasks]", error);
      return cached ? cached.list : null;
    }
  }

  function createElement(tag, options = {}) {
    const el = document.createElement(tag);

    if (options.className) {
      el.className = options.className;
    }

    if (options.text !== undefined) {
      el.textContent = options.text;
    }

    if (options.attrs) {
      for (const [key, value] of Object.entries(options.attrs)) {
        el.setAttribute(key, value);
      }
    }

    return el;
  }

  function buildProblemEntries(list, newTab, currentTaskId) {
    const fragment = document.createDocumentFragment();

    if (!list) {
      const li = createElement("li");
      li.appendChild(createElement("a", { text: "(読み込み失敗)" }));
      fragment.appendChild(li);
      return fragment;
    }

    for (const task of list) {
      const li = createElement("li", { className: `${PREFIX}-task-item` });
      const a = createElement("a", {
        text: `${task.diff} - ${task.name}`,
        attrs: { href: task.url }
      });
      a.dataset.searchText = `${task.diff} ${task.name}`.toLowerCase();

      if (newTab) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }

      if (currentTaskId && task.url.endsWith(`/${currentTaskId}`)) {
        li.classList.add(`${PREFIX}-current`);
      }

      li.appendChild(a);
      fragment.appendChild(li);
    }

    return fragment;
  }

  async function buildDropdown(tab, contestName) {
    const li = tab.parentElement;
    tab.id = ROOT_ID;
    tab.setAttribute("class", "dropdown-toggle");
    tab.setAttribute("data-toggle", "dropdown");
    tab.setAttribute("href", "#");
    tab.setAttribute("role", "button");
    tab.setAttribute("aria-haspopup", "true");
    tab.setAttribute("aria-expanded", "false");
    tab.appendChild(createElement("span", { className: "caret" }));

    const menu = createElement("ul", {
      className: `dropdown-menu ${PREFIX}-dropdown`
    });
    li.appendChild(menu);

    const searchItem = createElement("li", {
      className: `${PREFIX}-search-item`
    });
    const searchInput = createElement("input", {
      className: `${PREFIX}-search`,
      attrs: { type: "text", placeholder: "問題を検索...", autocomplete: "off" }
    });
    searchItem.appendChild(searchInput);
    menu.appendChild(searchItem);

    const taskTableItem = createElement("li");
    const taskTableLink = createElement("a", {
      attrs: { href: `/contests/${contestName}/tasks` }
    });
    taskTableLink.appendChild(
      createElement("span", {
        className: "glyphicon glyphicon-list",
        attrs: { "aria-hidden": "true" }
      })
    );
    taskTableLink.append(" 問題一覧");
    taskTableItem.appendChild(taskTableLink);
    menu.appendChild(taskTableItem);

    const atOnceItem = createElement("li");
    const atOnceLink = createElement("a", {
      attrs: { href: "#", "data-toggle": "modal", "data-target": `#${MODAL_ID}` }
    });
    atOnceLink.appendChild(
      createElement("span", {
        className: "glyphicon glyphicon-sort-by-attributes-alt",
        attrs: { "aria-hidden": "true" }
      })
    );
    atOnceLink.append(" まとめて開く...");
    atOnceItem.appendChild(atOnceLink);
    menu.appendChild(atOnceItem);

    const newTabValue = (await storageGet(STORAGE_KEYS.newTab)) ?? false;
    const newTabItem = createElement("li", {
      className: `${PREFIX}-newtab-item`
    });
    const newTabLabel = createElement("label", {
      className: `${PREFIX}-newtab-label`
    });
    const newTabCheckbox = createElement("input", {
      attrs: { type: "checkbox" }
    });
    newTabCheckbox.checked = Boolean(newTabValue);
    newTabLabel.append(newTabCheckbox, " 新しいタブで開く");
    newTabItem.appendChild(newTabLabel);
    menu.appendChild(newTabItem);

    menu.appendChild(createElement("li", { className: "divider" }));

    const listItem = createElement("li", { className: `${PREFIX}-list-item` });
    const list = createElement("ul", { className: `${PREFIX}-task-list` });
    listItem.appendChild(list);
    menu.appendChild(listItem);

    const currentTaskId = getCurrentTaskId();
    const problemList = await fetchProblemList(contestName);
    list.appendChild(
      buildProblemEntries(problemList, newTabCheckbox.checked, currentTaskId)
    );

    newTabCheckbox.addEventListener("change", () => {
      storageSet(STORAGE_KEYS.newTab, newTabCheckbox.checked);

      Array.from(list.querySelectorAll("a")).forEach((a) => {
        if (newTabCheckbox.checked) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        } else {
          a.removeAttribute("target");
          a.removeAttribute("rel");
        }
      });
    });

    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      Array.from(list.children).forEach((entry) => {
        const text = entry.querySelector("a")?.dataset.searchText || "";
        entry.hidden = query.length > 0 && !text.includes(query);
      });
    });

    // Keep the dropdown open while interacting with the search box or checkbox.
    menu.addEventListener("click", (event) => {
      if (event.target === searchInput || newTabLabel.contains(event.target)) {
        event.stopPropagation();
      }
    });

    // Bootstrap toggles a `.open` class on the <li> instead of dispatching a
    // native event we could listen for without jQuery, so watch for that.
    const observer = new MutationObserver(() => {
      if (li.classList.contains("open")) {
        searchInput.value = "";
        Array.from(list.children).forEach((entry) => {
          entry.hidden = false;
        });
        window.setTimeout(() => searchInput.focus(), 0);
      }
    });
    observer.observe(li, { attributes: true, attributeFilter: ["class"] });

    return problemList;
  }

  function buildAtOnceModal(problemList) {
    if (!problemList || problemList.length === 0) {
      return null;
    }

    const modal = createElement("div", {
      className: "modal fade",
      attrs: { id: MODAL_ID, tabindex: "-1", role: "dialog" }
    });

    const dialog = createElement("div", {
      className: "modal-dialog",
      attrs: { role: "document" }
    });
    const content = createElement("div", { className: "modal-content" });

    const header = createElement("div", { className: "modal-header" });
    const closeButton = createElement("button", {
      className: "close",
      attrs: { type: "button", "data-dismiss": "modal", "aria-label": "Close" }
    });
    closeButton.appendChild(
      createElement("span", { attrs: { "aria-hidden": "true" }, text: "×" })
    );
    header.append(
      closeButton,
      createElement("h4", { className: "modal-title", text: "まとめて開く" })
    );

    const body = createElement("div", { className: "modal-body" });
    body.appendChild(
      createElement("p", { text: "複数の問題をまとめて新しいタブで開きます。" })
    );

    const rangeRow = createElement("div", { className: `${PREFIX}-range-row` });
    const beginSelect = createElement("select", {
      className: `${PREFIX}-range-select`
    });
    const endSelect = createElement("select", {
      className: `${PREFIX}-range-select`
    });

    problemList.forEach((task, index) => {
      const optionText = `${task.diff} - ${task.name}`;
      beginSelect.appendChild(
        createElement("option", { text: optionText, attrs: { value: String(index) } })
      );
      endSelect.appendChild(
        createElement("option", { text: optionText, attrs: { value: String(index) } })
      );
    });
    endSelect.value = String(problemList.length - 1);

    rangeRow.append(
      createElement("span", { text: "範囲:" }),
      beginSelect,
      createElement("span", { text: "–", className: `${PREFIX}-between` }),
      endSelect
    );

    const reverseLabel = createElement("label", {
      className: `${PREFIX}-reverse-label`
    });
    const reverseCheckbox = createElement("input", {
      attrs: { type: "checkbox" }
    });
    reverseLabel.append(reverseCheckbox, " 逆順で開く");

    const caution = createElement("p", {
      className: `${PREFIX}-caution`,
      text: `※ 一度に開くことのできるタブは ${ATONCE_TAB_MAX} 個までです。`
    });

    body.append(rangeRow, reverseLabel, caution);

    storageGet(STORAGE_KEYS.reverse).then((value) => {
      reverseCheckbox.checked = Boolean(value);
    });

    const footer = createElement("div", { className: "modal-footer" });
    const cancelButton = createElement("button", {
      className: "btn btn-default",
      text: "キャンセル",
      attrs: { type: "button", "data-dismiss": "modal" }
    });
    const openButton = createElement("button", {
      className: "btn btn-primary",
      text: "開く",
      attrs: { type: "button" }
    });

    openButton.addEventListener("click", async () => {
      const begin = Number(beginSelect.value);
      const end = Number(endSelect.value);
      const lo = Math.min(begin, end);
      const hi = Math.max(begin, end);
      const count = hi - lo + 1;

      if (count > ATONCE_TAB_MAX) {
        window.alert(
          `一度に開くことのできるタブは ${ATONCE_TAB_MAX} 個までです。範囲を狭めてください。`
        );
        return;
      }

      const reverse = reverseCheckbox.checked;
      const indices = [];

      for (let i = lo; i <= hi; i += 1) {
        indices.push(i);
      }

      if (reverse) {
        indices.reverse();
      }

      await storageSet(STORAGE_KEYS.reverse, reverse);

      for (const index of indices) {
        window.open(problemList[index].url, "_blank", "noopener,noreferrer");
      }

      closeButton.click();
    });

    footer.append(cancelButton, openButton);
    content.append(header, body, footer);
    dialog.appendChild(content);
    modal.appendChild(dialog);

    return modal;
  }

  async function init() {
    const tabs = document.getElementById("contest-nav-tabs");

    if (!tabs || document.getElementById(ROOT_ID)) {
      return;
    }

    const tab = tabs.querySelector('a[href$="tasks"]');

    if (!tab) {
      return;
    }

    const contestName = getContestName();

    if (!contestName) {
      return;
    }

    const problemList = await buildDropdown(tab, contestName);
    const modal = buildAtOnceModal(problemList);

    if (modal) {
      const mainDiv = document.getElementById("main-div");

      if (mainDiv) {
        mainDiv.insertAdjacentElement("beforebegin", modal);
      } else {
        document.body.appendChild(modal);
      }
    }
  }

  init().catch((error) => {
    console.warn("[AtCoder Listing Tasks]", error);
  });
})();
