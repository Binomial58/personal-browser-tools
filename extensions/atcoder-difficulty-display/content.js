(function () {
  "use strict";

  const ROOT_CLASS = "atcoder-difficulty-display";
  const PROBLEM_MODELS_URL = "https://kenkoooo.com/atcoder/resources/problem-models.json";
  const PROBLEMS_URL = "https://kenkoooo.com/atcoder/resources/problems.json";
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const STORAGE_KEYS = {
    problemModels: `${ROOT_CLASS}:problem-models:v2`,
    problems: `${ROOT_CLASS}:problems:v2`
  };
  let problemModelsCache = null;
  let problemsCache = null;
  let menuDecorating = false;

  const COLOR_VALUES = {
    grey: "#808080",
    brown: "#804000",
    green: "#008000",
    cyan: "#00c0c0",
    blue: "#0000ff",
    yellow: "#c0c000",
    orange: "#ff8000",
    red: "#ff0000",
    bronze: "#965c2c",
    silver: "#808080",
    gold: "#d6a900",
    unknown: "#17a2b8"
  };

  function getStorageArea() {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return chrome.storage.local;
    }

    return null;
  }

  function readFromExtensionStorage(key) {
    const storage = getStorageArea();

    if (!storage) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      storage.get([key], (items) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(items[key] || null);
      });
    });
  }

  function writeToExtensionStorage(key, value) {
    const storage = getStorageArea();

    if (!storage) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      storage.set({ [key]: value }, () => {
        resolve(!(chrome.runtime && chrome.runtime.lastError));
      });
    });
  }

  function readFromLocalStorage(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // The extension can still work without a local fallback cache.
    }
  }

  async function readCache(key) {
    return (await readFromExtensionStorage(key)) || readFromLocalStorage(key);
  }

  async function writeCache(key, value) {
    const saved = await writeToExtensionStorage(key, value);

    if (!saved) {
      writeToLocalStorage(key, value);
    }
  }

  function isFreshCache(cache) {
    return (
      cache &&
      typeof cache.savedAt === "number" &&
      Date.now() - cache.savedAt < CACHE_TTL_MS
    );
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`GET ${url} failed: ${response.status}`);
    }

    return response.json();
  }

  async function getCachedJson(key, url) {
    const cache = await readCache(key);

    if (isFreshCache(cache)) {
      return cache.data;
    }

    try {
      const data = await fetchJson(url);
      await writeCache(key, {
        savedAt: Date.now(),
        data
      });
      return data;
    } catch (error) {
      if (cache && cache.data) {
        return cache.data;
      }

      throw error;
    }
  }

  function getCurrentTaskId() {
    if (location.hostname === "atcoder.jp") {
      const match = location.pathname.match(/^\/contests\/[^/]+\/tasks\/([^/]+)\/?$/);
      return match ? decodeURIComponent(match[1]) : "";
    }

    if (location.hostname.endsWith(".contest.atcoder.jp")) {
      const match = location.pathname.match(/^\/tasks\/([^/]+)\/?$/);
      return match ? decodeURIComponent(match[1]) : "";
    }

    return "";
  }

  function clipDifficulty(difficulty) {
    return Math.round(
      difficulty >= 400 ? difficulty : 400 / Math.exp(1.0 - difficulty / 400)
    );
  }

  function getRatingColor(difficulty) {
    if (!Number.isFinite(difficulty)) {
      return "unknown";
    }

    if (difficulty >= 4000) {
      return "gold";
    }

    if (difficulty >= 3600) {
      return "silver";
    }

    if (difficulty >= 3200) {
      return "bronze";
    }

    if (difficulty >= 2800) {
      return "red";
    }

    if (difficulty >= 2400) {
      return "orange";
    }

    if (difficulty >= 2000) {
      return "yellow";
    }

    if (difficulty >= 1600) {
      return "blue";
    }

    if (difficulty >= 1200) {
      return "cyan";
    }

    if (difficulty >= 800) {
      return "green";
    }

    if (difficulty >= 400) {
      return "brown";
    }

    return "grey";
  }

  function getFillPercent(difficulty) {
    if (!Number.isFinite(difficulty) || difficulty >= 3200) {
      return 100;
    }

    return Math.round(((difficulty % 400) / 400) * 100);
  }

  function getTypical90Difficulty(title) {
    if (title.includes("★1")) {
      return 149;
    }

    if (title.includes("★2")) {
      return 399;
    }

    if (title.includes("★3")) {
      return 799;
    }

    if (title.includes("★4")) {
      return 1199;
    }

    if (title.includes("★5")) {
      return 1599;
    }

    if (title.includes("★6")) {
      return 1999;
    }

    if (title.includes("★7")) {
      return 2399;
    }

    return NaN;
  }

  function getTypical90Description(title) {
    if (title.includes("★1")) {
      return "200 point level";
    }

    if (title.includes("★2")) {
      return "300 point level";
    }

    if (title.includes("★4")) {
      return "400 point level";
    }

    if (title.includes("★5")) {
      return "500 point level";
    }

    if (title.includes("★6")) {
      return "Advanced level";
    }

    if (title.includes("★7")) {
      return "Challenge level";
    }

    return "";
  }

  async function getProblemModels() {
    if (!problemModelsCache) {
      problemModelsCache = await getCachedJson(
        STORAGE_KEYS.problemModels,
        PROBLEM_MODELS_URL
      );
    }

    return problemModelsCache;
  }

  async function getProblems() {
    if (!problemsCache) {
      problemsCache = await getCachedJson(STORAGE_KEYS.problems, PROBLEMS_URL);
    }

    return problemsCache;
  }

  async function getProblemModel(taskId) {
    const problemModels = await getProblemModels();

    if (problemModels[taskId] || !taskId.startsWith("typical90_")) {
      return problemModels[taskId] || null;
    }

    const problems = await getProblems();
    const problem = problems.find((item) => item.id === taskId);

    if (!problem || problem.contest_id !== "typical90") {
      return null;
    }

    const title = problem.title || problem.name || "";
    const difficulty = getTypical90Difficulty(title);

    if (!Number.isFinite(difficulty)) {
      return null;
    }

    return {
      difficulty,
      is_experimental: false,
      extra_difficulty: getTypical90Description(title)
    };
  }

  function createDifficultyInfo(model) {
    const rawDifficulty = Number(model.difficulty);

    if (!Number.isFinite(rawDifficulty)) {
      return {
        title: "Difficulty is unavailable.",
        color: "unknown",
        unavailable: true
      };
    }

    const difficulty = clipDifficulty(rawDifficulty);
    const color = getRatingColor(difficulty);
    const extra = typeof model.extra_difficulty === "string" ? model.extra_difficulty : "";
    const title = extra
      ? `Difficulty: ${extra}`
      : `Difficulty: ${difficulty}${model.is_experimental ? " (experimental)" : ""}`;

    return {
      title,
      color,
      fillPercent: getFillPercent(difficulty),
      experimental: model.is_experimental === true,
      unavailable: false
    };
  }

  function createDifficultyBadge(info, options = {}) {
    const badge = document.createElement("span");
    const circle = document.createElement("span");

    badge.className = [
      `${ROOT_CLASS}__badge`,
      `${ROOT_CLASS}__badge--${options.large ? "large" : "small"}`,
      `${ROOT_CLASS}__badge--${info.color}`,
      info.experimental ? `${ROOT_CLASS}__badge--experimental` : "",
      info.unavailable ? `${ROOT_CLASS}__badge--unavailable` : ""
    ]
      .filter(Boolean)
      .join(" ");
    badge.title = info.title;
    badge.setAttribute("aria-label", info.title);
    badge.style.setProperty("--atcoder-difficulty-color", COLOR_VALUES[info.color]);
    badge.style.setProperty(
      "--atcoder-difficulty-fill",
      `${info.fillPercent ?? 100}%`
    );

    circle.className = `${ROOT_CLASS}__circle`;

    if (info.unavailable) {
      circle.textContent = "?";
    }

    badge.append(circle);
    return badge;
  }

  function findTaskTitleElement() {
    return (
      document.querySelector("#main-container span.h2") ||
      document.querySelector("#main-container h1") ||
      document.querySelector("#main-container h2")
    );
  }

  function getTaskIdFromLink(link) {
    try {
      const url = new URL(link.href, location.href);

      if (url.hostname === "atcoder.jp") {
        const match = url.pathname.match(/^\/contests\/[^/]+\/tasks\/([^/]+)\/?$/);
        return match ? decodeURIComponent(match[1]) : "";
      }

      if (url.hostname.endsWith(".contest.atcoder.jp")) {
        const match = url.pathname.match(/^\/tasks\/([^/]+)\/?$/);
        return match ? decodeURIComponent(match[1]) : "";
      }
    } catch (_error) {
      // Ignore malformed links.
    }

    return "";
  }

  function findProblemStatusElement() {
    return Array.from(document.querySelectorAll("#main-container p")).find((element) => {
      const text = element.textContent || "";
      return text.includes("Memory Limit") || text.includes("メモリ制限");
    });
  }

  function insertTitleBadge(titleElement, badge) {
    if (titleElement.dataset.atcoderDifficultyDisplay) {
      return;
    }

    titleElement.dataset.atcoderDifficultyDisplay = "true";
    titleElement.insertBefore(badge, titleElement.firstChild);
    titleElement.insertBefore(document.createTextNode(" "), badge.nextSibling);
  }

  function insertStatusDifficulty(info) {
    const statusElement = findProblemStatusElement();

    if (
      !statusElement ||
      statusElement.dataset.atcoderDifficultyDisplay ||
      statusElement.textContent.includes("Difficulty:")
    ) {
      return;
    }

    statusElement.dataset.atcoderDifficultyDisplay = "true";
    statusElement.append(
      document.createTextNode(" / Difficulty: "),
      createDifficultyBadge(info)
    );
  }

  async function decorateProblemMenuLinks() {
    if (menuDecorating) {
      return;
    }

    menuDecorating = true;

    try {
      const links = Array.from(document.querySelectorAll(".dropdown-menu a[href]"));

      for (const link of links) {
        if (link.dataset.atcoderDifficultyDisplay) {
          continue;
        }

        const taskId = getTaskIdFromLink(link);

        if (!taskId) {
          continue;
        }

        const model = await getProblemModel(taskId);

        if (!model) {
          continue;
        }

        link.dataset.atcoderDifficultyDisplay = "true";
        link.insertBefore(createDifficultyBadge(createDifficultyInfo(model)), link.firstChild);
        link.insertBefore(document.createTextNode(" "), link.childNodes[1] || null);
      }
    } finally {
      menuDecorating = false;
    }
  }

  function observeProblemMenuLinks() {
    const observer = new MutationObserver(() => {
      decorateProblemMenuLinks().catch((error) => {
        console.warn("[AtCoder Difficulty Display]", error);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
    }, 10000);
  }

  function bindProblemMenuEvents() {
    const decorate = (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (!event.target.closest(".dropdown, .dropdown-menu")) {
        return;
      }

      decorateProblemMenuLinks().catch((error) => {
        console.warn("[AtCoder Difficulty Display]", error);
      });
    };

    document.addEventListener("click", decorate, true);
    document.addEventListener("mouseover", decorate, true);
  }

  async function main() {
    const taskId = getCurrentTaskId();

    if (!taskId) {
      return;
    }

    const titleElement = findTaskTitleElement();

    if (!titleElement) {
      return;
    }

    const model = await getProblemModel(taskId);

    if (!model) {
      return;
    }

    const info = createDifficultyInfo(model);

    insertTitleBadge(
      titleElement,
      createDifficultyBadge(info, {
        large: true
      })
    );
    insertStatusDifficulty(info);
    await decorateProblemMenuLinks();
    observeProblemMenuLinks();
    bindProblemMenuEvents();
  }

  main().catch((error) => {
    console.warn("[AtCoder Difficulty Display]", error);
  });
})();
