(function () {
  "use strict";

  const api = globalThis.browser || globalThis.chrome;
  const ROOT_ID = "atcoder-user-ac-notifier";
  const STORAGE_PREFIX = "atcoder-favorite-standings";
  const GLOBAL_FAVORITES_KEY = `${STORAGE_PREFIX}:favorites`;
  const SNAPSHOT_KEY_PREFIX = `${STORAGE_PREFIX}:snapshots:`;
  const AUTO_REFRESH_INTERVAL_MS = 30 * 1000;

  function parseContestContext() {
    const contestMatch = location.pathname.match(/^\/contests\/([^/]+)/);

    if (contestMatch) {
      const taskMatch = location.pathname.match(/^\/contests\/[^/]+\/tasks\/([^/]+)/);

      return {
        contestId: contestMatch[1],
        currentTaskId: taskMatch ? taskMatch[1] : ""
      };
    }

    const oldContestMatch = location.hostname.match(/^([^.]+)\.contest\.atcoder\.jp$/);

    if (!oldContestMatch) {
      return null;
    }

    const taskMatch = location.pathname.match(/^\/tasks\/([^/]+)/);

    return {
      contestId: oldContestMatch[1],
      currentTaskId: taskMatch ? taskMatch[1] : ""
    };
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getLocalStore(key) {
    if (globalThis.browser) {
      return api.storage.local.get(key).then((result) => result || {});
    }

    return new Promise((resolve, reject) => {
      api.storage.local.get(key, (result) => {
        const runtimeError = api.runtime && api.runtime.lastError;

        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        resolve(result || {});
      });
    });
  }

  function setLocalStore(values) {
    if (globalThis.browser) {
      return api.storage.local.set(values);
    }

    return new Promise((resolve, reject) => {
      api.storage.local.set(values, () => {
        const runtimeError = api.runtime && api.runtime.lastError;

        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        resolve();
      });
    });
  }

  function sendRuntimeMessage(type, payload) {
    if (globalThis.browser && api.runtime.sendMessage.length <= 1) {
      return api.runtime.sendMessage({
        type,
        payload
      });
    }

    return new Promise((resolve, reject) => {
      api.runtime.sendMessage(
        {
          type,
          payload
        },
        (response) => {
          const runtimeError = api.runtime && api.runtime.lastError;

          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          resolve(response);
        }
      );
    });
  }

  function normalizeFavoriteEntries(favorites) {
    const uniqueFavorites = [];
    const seen = new Set();

    favorites.forEach((favorite) => {
      const username = String(
        favorite && typeof favorite === "object" ? favorite.username : favorite || ""
      ).trim();
      const normalized = normalizeUsername(username);

      if (!username || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      uniqueFavorites.push({
        username,
        notifyEnabled:
          favorite && typeof favorite === "object" && "notifyEnabled" in favorite
            ? Boolean(favorite.notifyEnabled)
            : true
      });
    });

    return uniqueFavorites;
  }

  function parseFavoritesText(text) {
    return normalizeFavoriteEntries(
      String(text || "")
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }

  function formatFavoritesText(favorites) {
    return favorites.map((favorite) => favorite.username).join("\n");
  }

  function getSnapshotKey(contestId) {
    return `${SNAPSHOT_KEY_PREFIX}${contestId}`;
  }

  async function loadFavorites() {
    const stored = await getLocalStore(null);
    const directFavorites = stored[GLOBAL_FAVORITES_KEY];

    if (Array.isArray(directFavorites)) {
      return normalizeFavoriteEntries(directFavorites);
    }

    const legacyFavorites = Object.entries(stored)
      .filter(([key, value]) => {
        return key.startsWith(`${STORAGE_PREFIX}:favorites:`) && Array.isArray(value);
      })
      .flatMap(([, value]) => value);
    const mergedFavorites = normalizeFavoriteEntries(legacyFavorites);

    if (mergedFavorites.length > 0) {
      await setLocalStore({
        [GLOBAL_FAVORITES_KEY]: mergedFavorites
      });
    }

    return mergedFavorites;
  }

  async function saveFavorites(favorites) {
    const uniqueFavorites = normalizeFavoriteEntries(favorites);

    await setLocalStore({
      [GLOBAL_FAVORITES_KEY]: uniqueFavorites
    });
    return uniqueFavorites;
  }

  async function loadSnapshot(contestId) {
    const stored = await getLocalStore(getSnapshotKey(contestId));
    const snapshot = stored[getSnapshotKey(contestId)];
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  }

  async function saveSnapshot(contestId, snapshot) {
    await setLocalStore({
      [getSnapshotKey(contestId)]: snapshot
    });
  }

  async function fetchStandings(contestId) {
    const url = `https://atcoder.jp/contests/${contestId}/standings/json`;
    const response = await fetch(url, {
      credentials: "include",
      redirect: "follow"
    });
    const text = await response.text();
    let payload = null;

    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`順位表の取得に失敗しました: ${response.status}`);
    }

    if (!payload) {
      throw new Error("順位表を取得できませんでした。AtCoder にログインしているか確認してください。");
    }

    return payload;
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeScore(value) {
    return numberOrZero(value) / 100;
  }

  function formatElapsed(msValue) {
    const totalSeconds = Math.floor(numberOrZero(msValue) / 1000000000);

    if (!totalSeconds) {
      return "0:00";
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function isTaskAccepted(result, task) {
    if (!result || typeof result !== "object") {
      return false;
    }

    const score = numberOrZero(result.Score || result.Points);

    if (task.maxScore > 0) {
      return score >= task.maxScore;
    }

    return Boolean(
      result.Accepted ||
      result.IsAccepted ||
      result.AC ||
      result.Solved ||
      result.IsSolved ||
      score > 0
    );
  }

  function buildTaskList(payload) {
    const source = Array.isArray(payload.TaskInfo)
      ? payload.TaskInfo
      : Array.isArray(payload.TaskInfoList)
        ? payload.TaskInfoList
        : [];

    return source
      .map((task) => {
        return {
          id: String(task.TaskScreenName || task.ScreenName || task.ID || task.Id || "").trim(),
          label: String(task.Assignment || task.Label || task.TaskName || "").trim(),
          title: String(task.TaskName || task.Title || "").trim(),
          maxScore: normalizeScore(task.Score || task.MaxScore || task.MaximumScore)
        };
      })
      .filter((task) => task.id);
  }

  function getStandingRows(payload) {
    if (Array.isArray(payload.StandingsData)) {
      return payload.StandingsData;
    }

    if (Array.isArray(payload.Standings)) {
      return payload.Standings;
    }

    return [];
  }

  function extractUserName(row) {
    return String(
      row.UserScreenName ||
        row.UserName ||
        row.ScreenName ||
        row.Name ||
        ""
    ).trim();
  }

  function formatTaskResult(result, task) {
    if (!result || typeof result !== "object") {
      return {
        text: "",
        accepted: false,
        penalty: 0
      };
    }

    const penaltyCount = numberOrZero(result.Failure);
    const accepted = isTaskAccepted(result, task);
    const elapsed = numberOrZero(result.Elapsed || result.Time);

    if (accepted) {
      return {
        text: `${formatElapsed(elapsed)}${penaltyCount > 0 ? ` (+${penaltyCount})` : ""}`,
        accepted: true,
        penalty: penaltyCount
      };
    }

    if (penaltyCount > 0) {
      return {
        text: `+${penaltyCount}`,
        accepted: false,
        penalty: penaltyCount
      };
    }

    if (
      result.Status &&
      String(result.Status).trim() &&
      !/^\d+$/.test(String(result.Status).trim())
    ) {
      return {
        text: String(result.Status).trim(),
        accepted: false,
        penalty: 0
      };
    }

    return {
      text: "",
      accepted: false,
      penalty: 0
    };
  }

  function buildFilteredStandings(payload, favorites) {
    const tasks = buildTaskList(payload);
    const favoriteSet = new Set(
      favorites.map((favorite) => normalizeUsername(favorite.username))
    );
    const rows = getStandingRows(payload)
      .filter((row) => favoriteSet.has(normalizeUsername(extractUserName(row))))
      .map((row) => {
        const results = row.TaskResults && typeof row.TaskResults === "object" ? row.TaskResults : {};

        return {
          rank: numberOrZero(row.Rank || row.Place),
          username: extractUserName(row),
          score: normalizeScore(
            row.TotalResult && (row.TotalResult.Score || row.TotalResult.Points)
          ),
          penalty: numberOrZero(
            row.TotalResult && (row.TotalResult.Penalty || row.TotalResult.Failure)
          ),
          elapsed: numberOrZero(
            row.TotalResult && (row.TotalResult.Elapsed || row.TotalResult.Time)
          ),
          taskResults: tasks.map((task) => ({
            id: task.id,
            label: task.label || task.id,
            title: task.title || task.id,
            value: formatTaskResult(results[task.id], task)
          }))
        };
      })
      .sort((left, right) => {
        if (left.rank && right.rank && left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return left.username.localeCompare(right.username);
      });

    return {
      tasks,
      rows
    };
  }

  function createAcceptedSnapshot(standings) {
    const snapshot = {};

    standings.rows.forEach((row) => {
      const usernameKey = normalizeUsername(row.username);
      snapshot[usernameKey] = {};

      row.taskResults.forEach((taskResult) => {
        snapshot[usernameKey][taskResult.id] = Boolean(taskResult.value.accepted);
      });
    });

    return snapshot;
  }

  function collectNotificationChanges(context, standings, favorites, previousSnapshot) {
    if (!previousSnapshot) {
      return [];
    }

    const notifyEnabledUsers = new Map(
      favorites.map((favorite) => [normalizeUsername(favorite.username), favorite.notifyEnabled])
    );
    const changes = [];

    standings.rows.forEach((row) => {
      const usernameKey = normalizeUsername(row.username);

      if (!notifyEnabledUsers.get(usernameKey)) {
        return;
      }

      const previousUserSnapshot = previousSnapshot[usernameKey];

      if (!previousUserSnapshot || typeof previousUserSnapshot !== "object") {
        return;
      }

      row.taskResults.forEach((taskResult) => {
        const wasAccepted = Boolean(previousUserSnapshot[taskResult.id]);
        const isAccepted = Boolean(taskResult.value.accepted);

        if (!wasAccepted && isAccepted) {
          changes.push({
            contestId: context.contestId,
            username: row.username,
            id: taskResult.id,
            label: taskResult.label,
            title: taskResult.title
          });
        }
      });
    });

    return changes;
  }

  async function notifyChanges(changes) {
    if (!changes.length) {
      return;
    }

    try {
      await sendRuntimeMessage("notifyFavoriteAcs", {
        changes
      });
    } catch (_error) {
      // Ignore notification delivery failures. Standings rendering should continue.
    }
  }

  function formatDateTime(timestamp) {
    if (!timestamp) {
      return "未取得";
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    return formatter.format(new Date(timestamp));
  }

  function createRoot(context) {
    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.className = "atcoder-user-ac-notifier";
    root.innerHTML = `
      <button type="button" class="atcoder-user-ac-notifier__tab" aria-expanded="false">
        <span class="atcoder-user-ac-notifier__tab-title">Favorite Standings</span>
        <span class="atcoder-user-ac-notifier__tab-summary">読み込み中...</span>
      </button>
      <div class="atcoder-user-ac-notifier__panel" hidden>
        <div class="atcoder-user-ac-notifier__panel-head">
          <div class="atcoder-user-ac-notifier__title">Favorite Standings</div>
          <div class="atcoder-user-ac-notifier__subtitle">${context.contestId}</div>
        </div>
        <form class="atcoder-user-ac-notifier__form">
          <label class="atcoder-user-ac-notifier__field">
            <span>ユーザー名</span>
            <input class="atcoder-user-ac-notifier__input" name="username" type="text" autocomplete="off" placeholder="tourist" />
          </label>
          <div class="atcoder-user-ac-notifier__actions">
            <button type="submit" class="atcoder-user-ac-notifier__button">追加</button>
            <button type="button" class="atcoder-user-ac-notifier__button atcoder-user-ac-notifier__button--muted" data-action="refresh">更新</button>
          </div>
        </form>
        <div class="atcoder-user-ac-notifier__chips"></div>
        <details class="atcoder-user-ac-notifier__manager">
          <summary>お気に入りを一括管理</summary>
          <div class="atcoder-user-ac-notifier__manager-body">
            <label class="atcoder-user-ac-notifier__field">
              <span>1 行 1 ユーザー、またはカンマ区切り</span>
              <textarea class="atcoder-user-ac-notifier__textarea" name="favorites-bulk" rows="5" spellcheck="false"></textarea>
            </label>
            <div class="atcoder-user-ac-notifier__actions">
              <button type="button" class="atcoder-user-ac-notifier__button" data-action="save-bulk">一括保存</button>
            </div>
            <div class="atcoder-user-ac-notifier__settings"></div>
          </div>
        </details>
        <div class="atcoder-user-ac-notifier__status" aria-live="polite">読み込み中...</div>
        <div class="atcoder-user-ac-notifier__table-wrap"></div>
      </div>
    `;

    const tab = root.querySelector(".atcoder-user-ac-notifier__tab");
    const panel = root.querySelector(".atcoder-user-ac-notifier__panel");
    const form = root.querySelector("form");
    const input = root.querySelector("input[name='username']");
    const bulkInput = root.querySelector("textarea[name='favorites-bulk']");
    const refreshButton = root.querySelector("[data-action='refresh']");
    const saveBulkButton = root.querySelector("[data-action='save-bulk']");

    tab.addEventListener("click", () => {
      const expanded = tab.getAttribute("aria-expanded") === "true";
      tab.setAttribute("aria-expanded", expanded ? "false" : "true");
      panel.hidden = expanded;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = input.value.trim();

      if (!username) {
        renderStatus(root, "ユーザー名を入力してください", true);
        return;
      }

      setBusy(root, true);
        renderStatus(root, "お気に入りを保存しています...");

      try {
        const favorites = await loadFavorites();
        favorites.push({
          username,
          notifyEnabled: true
        });
        await saveFavorites(favorites);
        input.value = "";
        await render(root, context);
      } catch (error) {
        renderStatus(root, error instanceof Error ? error.message : String(error), true);
      } finally {
        setBusy(root, false);
      }
    });

    refreshButton.addEventListener("click", async () => {
      setBusy(root, true);
      renderStatus(root, "最新状況を取得しています...");

      try {
        await render(root, context);
      } catch (error) {
        renderStatus(root, error instanceof Error ? error.message : String(error), true);
      } finally {
        setBusy(root, false);
      }
    });

    saveBulkButton.addEventListener("click", async () => {
      setBusy(root, true);
      renderStatus(root, "お気に入り一覧を保存しています...");

      try {
        await saveFavorites(parseFavoritesText(bulkInput.value));
        await render(root, context);
      } catch (error) {
        renderStatus(root, error instanceof Error ? error.message : String(error), true);
      } finally {
        setBusy(root, false);
      }
    });

    return root;
  }

  function renderStatus(root, message, isError = false) {
    const status = root.querySelector(".atcoder-user-ac-notifier__status");
    status.textContent = message;
    status.classList.toggle("atcoder-user-ac-notifier__status--error", Boolean(isError));
  }

  function renderTabSummary(root, message, isError = false) {
    const summary = root.querySelector(".atcoder-user-ac-notifier__tab-summary");
    summary.textContent = message;
    summary.classList.toggle("atcoder-user-ac-notifier__tab-summary--error", Boolean(isError));
  }

  function renderFavoriteSettings(root, favorites, onToggle, onRemove) {
    const settings = root.querySelector(".atcoder-user-ac-notifier__settings");

    if (!favorites.length) {
      settings.textContent = "";
      return;
    }

    const items = favorites.map((favorite) => {
      const row = document.createElement("div");
      row.className = "atcoder-user-ac-notifier__setting-row";

      const name = document.createElement("span");
      name.className = "atcoder-user-ac-notifier__setting-name";
      name.textContent = favorite.username;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = [
        "atcoder-user-ac-notifier__notify-toggle",
        favorite.notifyEnabled
          ? "atcoder-user-ac-notifier__notify-toggle--on"
          : "atcoder-user-ac-notifier__notify-toggle--off"
      ].join(" ");
      toggle.textContent = favorite.notifyEnabled ? "通知 ON" : "通知 OFF";
      toggle.addEventListener("click", () => onToggle(favorite.username));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "atcoder-user-ac-notifier__setting-remove";
      remove.textContent = "削除";
      remove.addEventListener("click", () => onRemove(favorite.username));

      row.append(name, toggle, remove);
      return row;
    });

    settings.replaceChildren(...items);
  }

  function renderFavorites(root, favorites, onToggle, onRemove) {
    const chips = root.querySelector(".atcoder-user-ac-notifier__chips");
    const bulkInput = root.querySelector("textarea[name='favorites-bulk']");

    if (bulkInput && document.activeElement !== bulkInput) {
      bulkInput.value = formatFavoritesText(favorites);
    }

    if (!favorites.length) {
      chips.textContent = "お気に入りユーザーを追加すると、ここに絞り込み順位表を表示します。";
      renderFavoriteSettings(root, favorites, onToggle, onRemove);
      return;
    }

    const items = favorites.map((favorite) => {
      const chip = document.createElement("div");
      chip.className = "atcoder-user-ac-notifier__chip";
      chip.innerHTML = `
        <span>${favorite.username}</span>
        <button type="button" class="atcoder-user-ac-notifier__chip-notify ${favorite.notifyEnabled ? "atcoder-user-ac-notifier__chip-notify--on" : "atcoder-user-ac-notifier__chip-notify--off"}">${favorite.notifyEnabled ? "通知ON" : "通知OFF"}</button>
        <button type="button" class="atcoder-user-ac-notifier__chip-remove">×</button>
      `;
      chip
        .querySelector(".atcoder-user-ac-notifier__chip-notify")
        .addEventListener("click", () => onToggle(favorite.username));
      chip
        .querySelector(".atcoder-user-ac-notifier__chip-remove")
        .addEventListener("click", () => onRemove(favorite.username));
      return chip;
    });

    chips.replaceChildren(...items);
    renderFavoriteSettings(root, favorites, onToggle, onRemove);
  }

  function getTaskCellClass(value, isCurrentTask) {
    const classNames = ["atcoder-user-ac-notifier__task-cell"];

    if (value && value.accepted) {
      classNames.push("atcoder-user-ac-notifier__task-cell--ac");
    } else if (value && value.penalty > 0) {
      classNames.push("atcoder-user-ac-notifier__task-cell--fail");
    } else if (value && value.text) {
      classNames.push("atcoder-user-ac-notifier__task-cell--score");
    }

    if (isCurrentTask) {
      classNames.push("atcoder-user-ac-notifier__task-cell--current");
    }

    return classNames.join(" ");
  }

  function renderStandingsTable(root, context, standings) {
    const wrap = root.querySelector(".atcoder-user-ac-notifier__table-wrap");

    if (!standings.rows.length) {
      wrap.textContent = "お気に入りユーザーはまだ順位表に見つかっていません。";
      return;
    }

    const table = document.createElement("table");
    table.className = "atcoder-user-ac-notifier__table";

    const headerCells = standings.tasks
      .map((task) => {
        const th = document.createElement("th");
        th.textContent = task.label || task.id;
        th.title = task.title || task.id;
        if (task.id === context.currentTaskId) {
          th.className = "atcoder-user-ac-notifier__task-head--current";
        }
        return th;
      });
    const header = document.createElement("tr");
    ["#", "User", "Score", "Time"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });
    headerCells.forEach((cell) => header.appendChild(cell));

    const thead = document.createElement("thead");
    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    standings.rows.forEach((row) => {
      const tr = document.createElement("tr");
      const leading = [
        row.rank ? String(row.rank) : "-",
        row.username,
        String(row.score),
        formatElapsed(row.elapsed)
      ];

      leading.forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = value;
        if (index === 1) {
          td.className = "atcoder-user-ac-notifier__user-cell";
        }
        tr.appendChild(td);
      });

      row.taskResults.forEach((taskResult) => {
        const td = document.createElement("td");
        td.textContent = taskResult.value.text || "";
        td.className = getTaskCellClass(
          taskResult.value,
          taskResult.id === context.currentTaskId
        );
        td.title = taskResult.title;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.replaceChildren(table);
  }

  function setBusy(root, busy) {
    root.querySelectorAll("button, input").forEach((element) => {
      element.disabled = busy;
    });
  }

  async function removeFavorite(username) {
    const favorites = await loadFavorites();
    await saveFavorites(
      favorites.filter(
        (favorite) => normalizeUsername(favorite.username) !== normalizeUsername(username)
      )
    );
  }

  async function toggleFavoriteNotification(username) {
    const favorites = await loadFavorites();
    await saveFavorites(
      favorites.map((favorite) => {
        if (normalizeUsername(favorite.username) !== normalizeUsername(username)) {
          return favorite;
        }

        return {
          ...favorite,
          notifyEnabled: !favorite.notifyEnabled
        };
      })
    );
  }

  async function render(root, context) {
    const favorites = await loadFavorites();

    renderFavorites(
      root,
      favorites,
      async (favorite) => {
        setBusy(root, true);

        try {
          await toggleFavoriteNotification(favorite);
          await render(root, context);
        } catch (error) {
          renderStatus(root, error instanceof Error ? error.message : String(error), true);
        } finally {
          setBusy(root, false);
        }
      },
      async (favorite) => {
        setBusy(root, true);

        try {
          await removeFavorite(favorite);
          await render(root, context);
        } catch (error) {
          renderStatus(root, error instanceof Error ? error.message : String(error), true);
        } finally {
          setBusy(root, false);
        }
      }
    );

    if (!favorites.length) {
      renderTabSummary(root, "0 users");
      renderStatus(root, "お気に入りユーザーを追加すると、その人たちだけの順位表を表示します。追加した名前はブラウザに保存されます。");
      root.querySelector(".atcoder-user-ac-notifier__table-wrap").textContent = "";
      return;
    }

    const payload = await fetchStandings(context.contestId);
    const standings = buildFilteredStandings(payload, favorites);
    const previousSnapshot = await loadSnapshot(context.contestId);
    const nextSnapshot = createAcceptedSnapshot(standings);
    const changes = collectNotificationChanges(
      context,
      standings,
      favorites,
      previousSnapshot
    );

    await notifyChanges(changes);
    await saveSnapshot(context.contestId, nextSnapshot);

    renderTabSummary(root, `${standings.rows.length}/${favorites.length} users`);
    renderStatus(
      root,
      `順位表を更新しました。表示中 ${standings.rows.length} 人 / お気に入り ${favorites.length} 人。通知設定を含めてブラウザに保存されます。`
    );
    renderStandingsTable(root, context, standings);
  }

  function scheduleAutoRefresh(root, context) {
    if (root.dataset.autoRefreshBound === "true") {
      return;
    }

    root.dataset.autoRefreshBound = "true";

    const refreshIfVisible = async () => {
      if (document.hidden || !document.body.contains(root)) {
        return;
      }

      setBusy(root, true);
      renderStatus(root, "最新状況を自動更新しています...");

      try {
        await render(root, context);
      } catch (error) {
        renderStatus(root, error instanceof Error ? error.message : String(error), true);
      } finally {
        setBusy(root, false);
      }
    };

    const intervalId = window.setInterval(() => {
      refreshIfVisible();
    }, AUTO_REFRESH_INTERVAL_MS);

    const visibilityHandler = () => {
      if (!document.hidden) {
        refreshIfVisible();
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    root.dataset.autoRefreshIntervalId = String(intervalId);
    root.__atcoderAutoRefreshCleanup = () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }

  function findInsertionPoint() {
    const statement =
      document.querySelector("#task-statement") ||
      document.querySelector("#main-div .part") ||
      document.querySelector(".lang-en #task-statement");

    if (statement) {
      return {
        element: statement,
        mode: "after"
      };
    }

    const title = document.querySelector("#main-div .row > div > .h2, #main-div h2, .row > div > .h2, h2");

    if (title && title.parentElement) {
      return {
        element: title.parentElement.querySelector("hr") || title.nextElementSibling,
        mode: "before"
      };
    }

    return null;
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

    if (!insertionPoint || !insertionPoint.element || !insertionPoint.element.parentElement) {
      return false;
    }

    const root = createRoot(context);

    if (insertionPoint.mode === "after") {
      insertionPoint.element.insertAdjacentElement("afterend", root);
    } else {
      insertionPoint.element.parentElement.insertBefore(root, insertionPoint.element);
    }

    scheduleAutoRefresh(root, context);
    render(root, context).catch((error) => {
      renderStatus(root, error instanceof Error ? error.message : String(error), true);
      renderTabSummary(root, "error", true);
    });
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
