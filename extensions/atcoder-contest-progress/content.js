(function () {
  "use strict";

  const ROOT_ID = "atcoder-contest-progress";
  const MAX_SUBMISSION_PAGES = 10;
  const STATUS_PRIORITY = {
    AC: 3
  };

  function parseContestContext() {
    const contestMatch = location.pathname.match(/^\/contests\/([^/]+)/);

    if (contestMatch) {
      const taskMatch = location.pathname.match(
        /^\/contests\/[^/]+\/tasks\/([^/]+)/
      );

      return {
        contest: contestMatch[1],
        currentTaskId: taskMatch ? taskMatch[1] : "",
        rootUrl: `${location.origin}/contests/${contestMatch[1]}`,
        taskPathPrefix: `/contests/${contestMatch[1]}/tasks/`
      };
    }

    const oldContestMatch = location.hostname.match(/^([^.]+)\.contest\.atcoder\.jp$/);

    if (oldContestMatch) {
      const taskMatch = location.pathname.match(/^\/tasks\/([^/]+)/);

      return {
        contest: oldContestMatch[1],
        currentTaskId: taskMatch ? taskMatch[1] : "",
        rootUrl: location.origin,
        taskPathPrefix: "/tasks/"
      };
    }

    return null;
  }

  function parseDocument(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function fetchDocument(url) {
    const response = await fetch(url, {
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error(`GET ${url} failed: ${response.status}`);
    }

    return parseDocument(await response.text());
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function extractTaskIdFromHref(href, context) {
    try {
      const url = new URL(href, location.href);
      const index = url.pathname.indexOf(context.taskPathPrefix);

      if (index === -1) {
        return "";
      }

      return url.pathname.slice(index + context.taskPathPrefix.length).split("/")[0];
    } catch (_error) {
      return "";
    }
  }

  function parseTasks(doc, context) {
    const tasks = [];
    const seen = new Set();
    const rows = Array.from(doc.querySelectorAll("table tbody tr"));

    rows.forEach((row) => {
      const links = Array.from(row.querySelectorAll("a"));
      const taskLink = links.find((link) => {
        return extractTaskIdFromHref(link.getAttribute("href") || "", context);
      });

      if (!taskLink) {
        return;
      }

      const taskId = extractTaskIdFromHref(taskLink.getAttribute("href") || "", context);

      if (!taskId || seen.has(taskId)) {
        return;
      }

      const cells = row.querySelectorAll("td");
      const label = normalizeText(cells[0] ? cells[0].textContent : taskLink.textContent);
      const title = normalizeText(cells[1] ? cells[1].textContent : taskLink.textContent);

      seen.add(taskId);
      tasks.push({
        id: taskId,
        label: label || taskId,
        title: title || taskId,
        href: taskLink.href
      });
    });

    return tasks;
  }

  function normalizeResult(result) {
    const text = normalizeText(result).toUpperCase();

    if (!text) {
      return "";
    }

    if (text.includes("AC")) return "AC";
    if (text.includes("WA")) return "WA";
    if (text.includes("TLE")) return "TLE";
    if (text.includes("MLE")) return "MLE";
    if (text.includes("RE")) return "RE";
    if (text.includes("CE")) return "CE";
    if (text.includes("OLE")) return "OLE";
    if (text.includes("IE")) return "IE";
    if (text.includes("WJ") || text.includes("JUDGING")) return "WJ";

    return text.split(" ")[0];
  }

  function getResultFromSubmissionRow(row) {
    const label = row.querySelector(".label");

    if (label) {
      return normalizeResult(label.textContent);
    }

    const cells = Array.from(row.querySelectorAll("td"));
    const statusCell = cells.find((cell) => {
      return /^(AC|WA|TLE|MLE|RE|CE|OLE|IE|WJ|Judging)$/i.test(
        normalizeText(cell.textContent)
      );
    });

    return statusCell ? normalizeResult(statusCell.textContent) : "";
  }

  function shouldReplaceStatus(currentStatus, nextStatus) {
    if (!nextStatus) {
      return false;
    }

    if (!currentStatus) {
      return true;
    }

    const currentPriority = STATUS_PRIORITY[currentStatus] || 1;
    const nextPriority = STATUS_PRIORITY[nextStatus] || 1;

    return nextPriority > currentPriority;
  }

  function parseSubmissionStatuses(doc, context, statuses) {
    Array.from(doc.querySelectorAll("table tbody tr")).forEach((row) => {
      const taskLink = Array.from(row.querySelectorAll("a")).find((link) => {
        return extractTaskIdFromHref(link.getAttribute("href") || "", context);
      });

      if (!taskLink) {
        return;
      }

      const taskId = extractTaskIdFromHref(taskLink.getAttribute("href") || "", context);
      const result = getResultFromSubmissionRow(row);
      const currentStatus = statuses.get(taskId) || "";

      if (shouldReplaceStatus(currentStatus, result)) {
        statuses.set(taskId, result);
      }
    });
  }

  function getNextSubmissionPageUrl(doc, context, currentPage) {
    const nextPage = currentPage + 1;
    const links = Array.from(doc.querySelectorAll("ul.pagination a, .pagination a"));
    const nextLink = links.find((link) => normalizeText(link.textContent) === String(nextPage));

    if (nextLink) {
      return new URL(nextLink.getAttribute("href"), location.href).href;
    }

    const pagerHasNext = links.some((link) => normalizeText(link.textContent) === ">");

    if (pagerHasNext) {
      return `${context.rootUrl}/submissions/me?page=${nextPage}`;
    }

    return "";
  }

  async function fetchSubmissionStatuses(context, tasks) {
    const statuses = new Map();
    let page = 1;
    let url = `${context.rootUrl}/submissions/me`;

    while (url && page <= MAX_SUBMISSION_PAGES) {
      const doc = await fetchDocument(url);
      parseSubmissionStatuses(doc, context, statuses);

      const allAccepted = tasks.length > 0 && tasks.every((task) => statuses.get(task.id) === "AC");

      if (allAccepted) {
        break;
      }

      url = getNextSubmissionPageUrl(doc, context, page);
      page += 1;
    }

    return statuses;
  }

  function getStatusClass(status) {
    if (!status) return "none";
    if (status === "AC") return "ac";
    if (status === "WA") return "wa";
    if (status === "CE") return "ce";
    if (status === "WJ") return "pending";
    if (["TLE", "MLE", "RE", "OLE", "IE"].includes(status)) return "error";

    return "other";
  }

  function createProgressElement(context) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "atcoder-contest-progress";
    root.innerHTML = `
      <div class="atcoder-contest-progress__head">
        <span class="atcoder-contest-progress__title">Contest Progress</span>
        <button class="atcoder-contest-progress__refresh" type="button">更新</button>
      </div>
      <div class="atcoder-contest-progress__body" aria-live="polite">読み込み中...</div>
    `;

    root
      .querySelector(".atcoder-contest-progress__refresh")
      .addEventListener("click", () => {
        renderProgress(root, context);
      });

    return root;
  }

  function renderTasks(root, context, tasks, statuses, warning) {
    const body = root.querySelector(".atcoder-contest-progress__body");

    if (!tasks.length) {
      body.textContent = "問題一覧を取得できませんでした";
      return;
    }

    const taskElements = tasks.map((task) => {
      const status = statuses.get(task.id) || "";
      const link = document.createElement("a");
      link.className = [
        "atcoder-contest-progress__task",
        `atcoder-contest-progress__task--${getStatusClass(status)}`,
        task.id === context.currentTaskId
          ? "atcoder-contest-progress__task--current"
          : ""
      ]
        .filter(Boolean)
        .join(" ");
      link.href = task.href;
      link.title = `${task.label} - ${task.title}: ${status || "未提出"}`;
      link.textContent = task.label;

      if (status) {
        const statusText = document.createElement("span");
        statusText.className = "atcoder-contest-progress__status";
        statusText.textContent = status;
        link.appendChild(statusText);
      }

      return link;
    });

    if (warning) {
      const warningElement = document.createElement("span");
      warningElement.className = "atcoder-contest-progress__warning";
      warningElement.textContent = warning;
      taskElements.push(warningElement);
    }

    body.replaceChildren(...taskElements);
  }

  async function renderProgress(root, context) {
    const body = root.querySelector(".atcoder-contest-progress__body");
    const refresh = root.querySelector(".atcoder-contest-progress__refresh");

    body.textContent = "読み込み中...";
    refresh.disabled = true;

    try {
      const tasksDoc = await fetchDocument(`${context.rootUrl}/tasks`);
      const tasks = parseTasks(tasksDoc, context);
      let statuses = new Map();
      let warning = "";

      try {
        statuses = await fetchSubmissionStatuses(context, tasks);
      } catch (error) {
        console.error("[AtCoder Contest Progress]", error);
        warning = "提出状況を取得できませんでした";
      }

      renderTasks(root, context, tasks, statuses, warning);
    } catch (error) {
      console.error("[AtCoder Contest Progress]", error);
      body.textContent = "提出状況を取得できませんでした";
    } finally {
      refresh.disabled = false;
    }
  }

  function findInsertionPoint() {
    const title = document.querySelector("#main-div .row > div > .h2, #main-div h2, .row > div > .h2, h2");

    if (title && title.parentElement) {
      return title.parentElement.querySelector("hr") || title.nextElementSibling;
    }

    return document.querySelector("#task-statement");
  }

  function inject() {
    if (document.getElementById(ROOT_ID)) {
      return true;
    }

    const context = parseContestContext();

    if (!context || !context.currentTaskId) {
      return true;
    }

    const insertionPoint = findInsertionPoint();

    if (!insertionPoint || !insertionPoint.parentElement) {
      return false;
    }

    const root = createProgressElement(context);
    insertionPoint.parentElement.insertBefore(root, insertionPoint);
    renderProgress(root, context);
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
