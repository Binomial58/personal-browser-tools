(function () {
  "use strict";

  // Exact-match dictionary: only applied when a text node's trimmed content
  // equals a key exactly. This targets short standalone UI labels (nav items,
  // buttons, headings) without touching prose inside problem statements,
  // comments or user-submitted content, where the same word would appear as
  // part of a longer sentence rather than as an isolated text node.
  const EXACT_DICTIONARY = {
    // Top navigation
    Problemset: "問題セット",
    Contests: "コンテスト",
    Gym: "ジム",
    Groups: "グループ",
    Rating: "レーティング",
    Edu: "教育",
    Calendar: "カレンダー",
    Blog: "ブログ",
    Blogs: "ブログ",
    Catalog: "カタログ",
    Help: "ヘルプ",
    Enter: "ログイン",
    Register: "新規登録",
    "Log out": "ログアウト",
    Settings: "設定",
    "Job talks": "求人トーク",

    // Contest-level navigation
    Problems: "問題",
    "Submit Code": "コード提出",
    "My Submissions": "自分の提出",
    Status: "ステータス",
    Standings: "順位表",
    Hacks: "ハック",
    "Contest materials": "コンテスト資料",
    Discussion: "ディスカッション",
    Registrants: "参加登録者",
    "Virtual participation": "バーチャル参加",

    // Sidebar
    Info: "情報",
    Actions: "アクション",
    "Find user": "ユーザー検索",
    "Recent Actions": "最近のアクション",
    "Clarification requests": "質問",
    "Existing contests": "開催予定のコンテスト",
    Participation: "参加状況",

    // Common buttons / actions
    Submit: "提出",
    Send: "送信",
    View: "表示",
    Edit: "編集",
    Delete: "削除",
    Practice: "練習",
    Compete: "参加する",
    Reply: "返信",
    Save: "保存",
    Cancel: "キャンセル",

    // Problem statement structure
    Input: "入力",
    Output: "出力",
    Note: "注記",
    Examples: "例",
    Example: "例",
    "standard input": "標準入力",
    "standard output": "標準出力",

    // Table headers
    Problem: "問題",
    Difficulty: "難易度",
    Tags: "タグ",
    When: "日時",
    Who: "ユーザー",
    Verdict: "結果",
    Time: "実行時間",
    Memory: "メモリ",
    Lang: "言語"
  };

  // Prefix patterns for labels that Codeforces renders with a variable
  // suffix in the same text node (e.g. "Wrong answer on test 5").
  const PREFIX_PATTERNS = [
    [/^time limit per test$/i, "実行時間制限"],
    [/^memory limit per test$/i, "メモリ制限"],
    [/^Accepted\b/, "正解"],
    [/^Wrong answer\b/, "不正解"],
    [/^Time limit exceeded\b/, "実行時間制限超過"],
    [/^Memory limit exceeded\b/, "メモリ制限超過"],
    [/^Runtime error\b/, "実行時エラー"],
    [/^Compilation error\b/, "コンパイルエラー"],
    [/^Idleness limit exceeded\b/, "アイドル時間制限超過"],
    [/^Denial of judgement\b/, "判定拒否"],
    [/^Partial result\b/, "部分正解"],
    [/^Security violated\b/, "セキュリティ違反"],
    [/^Judgement failed\b/, "ジャッジ失敗"],
    [/^In queue\b/, "キュー待ち"],
    [/^Running\b/, "実行中"],
    [/^Rejected\b/, "却下"],
    [/^Skipped\b/, "スキップ"]
  ];

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "PRE",
    "CODE"
  ]);

  function translateText(original) {
    const trimmed = original.trim();

    if (!trimmed) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(EXACT_DICTIONARY, trimmed)) {
      return original.replace(trimmed, EXACT_DICTIONARY[trimmed]);
    }

    for (const [pattern, replacement] of PREFIX_PATTERNS) {
      if (pattern.test(trimmed)) {
        return original.replace(pattern, replacement);
      }
    }

    return null;
  }

  function shouldSkipElement(element) {
    if (!element) {
      return false;
    }

    if (SKIP_TAGS.has(element.tagName)) {
      return true;
    }

    return element.isContentEditable === true;
  }

  function translateWithinNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipElement(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let current = walker.nextNode();

    while (current) {
      textNodes.push(current);
      current = walker.nextNode();
    }

    for (const node of textNodes) {
      const translated = translateText(node.nodeValue);

      if (translated !== null && translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
    }
  }

  function translateSubmitButtons(root) {
    const buttons = root.querySelectorAll(
      'input[type="submit"], input[type="button"]'
    );

    for (const button of buttons) {
      const translated = translateText(button.value || "");

      if (translated !== null && translated !== button.value) {
        button.value = translated;
      }
    }
  }

  function translate(root) {
    translateWithinNode(root);
    translateSubmitButtons(root);
  }

  function observeDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translate(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Codeforces' own submit page aborts rendering when it detects it is
  // framed (`if (window.parent.frames.length > 0) { window.stop(); }`), so
  // an <iframe> of the real form is not viable. Instead we stash a draft in
  // chrome.storage and hand off to the real submit page by navigating to it;
  // that page's own content script instance then fills in the draft and
  // leaves the actual submit button (CSRF/Turnstile/etc.) to the user.
  const DRAFT_STORAGE_KEY = "cct:pending-submission";
  const DRAFT_MAX_AGE_MS = 5 * 60 * 1000;
  const LAST_LANGUAGE_STORAGE_KEY = "cct:last-language";

  // Mirrors the options Codeforces itself renders on the submit page.
  // programTypeId values are global, not per-contest.
  const LANGUAGE_OPTIONS = [
    ["43", "GNU GCC C11 5.1.0"],
    ["54", "GNU G++17 7.3.0"],
    ["89", "GNU G++20 13.2 (64 bit, winlibs)"],
    ["91", "GNU G++23 14.2 (64 bit, msys2)"],
    ["65", "C# 8, .NET Core 3.1"],
    ["79", "C# 10, .NET SDK 6.0"],
    ["96", "C# 13, .NET SDK 9"],
    ["9", "C# Mono 6.8"],
    ["28", "D DMD32 v2.105.0"],
    ["97", "F# 9, .NET SDK 9"],
    ["32", "Go 1.22.2"],
    ["12", "Haskell GHC 8.10.1"],
    ["87", "Java 21 64bit"],
    ["36", "Java 8 32bit"],
    ["83", "Kotlin 1.7.20"],
    ["88", "Kotlin 1.9.21"],
    ["99", "Kotlin 2.2.0"],
    ["19", "OCaml 4.02.1"],
    ["3", "Delphi 7"],
    ["4", "Free Pascal 3.2.2"],
    ["51", "PascalABC.NET 3.8.3"],
    ["13", "Perl 5.20.1"],
    ["6", "PHP 8.1.7"],
    ["7", "Python 2.7.18"],
    ["31", "Python 3.13.2"],
    ["40", "PyPy 2.7.13 (7.3.0)"],
    ["41", "PyPy 3.6.9 (7.3.0)"],
    ["70", "PyPy 3.10 (7.3.15, 64bit)"],
    ["67", "Ruby 3.2.2"],
    ["75", "Rust 1.89.0 (2021)"],
    ["98", "Rust 1.89.0 (2024)"],
    ["20", "Scala 2.12.8"],
    ["34", "JavaScript V8 4.8.0"],
    ["55", "Node.js 15.8.0 (64bit)"]
  ];

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

  function storageRemove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => resolve());
    });
  }

  function getContestProblemContext() {
    const match = location.pathname.match(
      /^\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)\/?$/
    );

    if (!match) {
      return null;
    }

    return { contestId: match[1], problemIndex: match[2] };
  }

  function getSubmitPageContestId() {
    const match = location.pathname.match(/^\/contest\/(\d+)\/submit\/?$/);
    return match ? match[1] : null;
  }

  function createDraftPanel(context) {
    const section = document.createElement("div");
    section.className = "cct-submit-panel";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cct-submit-panel__toggle";
    toggle.textContent = `▶ ${context.problemIndex} を提出`;

    const body = document.createElement("div");
    body.className = "cct-submit-panel__body";
    body.hidden = true;

    const languageRow = document.createElement("div");
    languageRow.className = "cct-submit-panel__row";

    const languageLabel = document.createElement("label");
    languageLabel.textContent = "言語:";
    languageLabel.className = "cct-submit-panel__label";

    const languageSelect = document.createElement("select");
    languageSelect.className = "cct-submit-panel__language";

    for (const [value, label] of LANGUAGE_OPTIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      languageSelect.appendChild(option);
    }

    languageRow.append(languageLabel, languageSelect);

    const textarea = document.createElement("textarea");
    textarea.className = "cct-submit-panel__source";
    textarea.spellcheck = false;
    textarea.placeholder = "ここにコードを貼り付け...";

    const actionRow = document.createElement("div");
    actionRow.className = "cct-submit-panel__actions";

    const submitButton = document.createElement("button");
    submitButton.type = "button";
    submitButton.className = "cct-submit-panel__submit";
    submitButton.textContent = "提出ページを開く →";

    const hint = document.createElement("span");
    hint.className = "cct-submit-panel__hint";
    hint.textContent =
      "問題・言語・コードが入力された状態で提出ページを開きます。最後の送信ボタンは提出ページ側で押してください。";

    actionRow.append(submitButton, hint);

    storageGet(LAST_LANGUAGE_STORAGE_KEY).then((value) => {
      if (value) {
        languageSelect.value = value;
      }
    });

    submitButton.addEventListener("click", async () => {
      const source = textarea.value;

      if (!source.trim()) {
        textarea.focus();
        return;
      }

      await storageSet(DRAFT_STORAGE_KEY, {
        contestId: context.contestId,
        problemIndex: context.problemIndex,
        programTypeId: languageSelect.value,
        source,
        savedAt: Date.now()
      });
      await storageSet(LAST_LANGUAGE_STORAGE_KEY, languageSelect.value);

      location.href = `/contest/${context.contestId}/submit`;
    });

    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = `${body.hidden ? "▶" : "▼"} ${
        context.problemIndex
      } を提出`;
    });

    body.append(languageRow, textarea, actionRow);
    section.append(toggle, body);
    return section;
  }

  function initDraftPanel() {
    if (window.self !== window.top) {
      return;
    }

    const context = getContestProblemContext();

    if (!context) {
      return;
    }

    const statement = document.querySelector(".problem-statement");

    if (!statement || document.querySelector(".cct-submit-panel")) {
      return;
    }

    statement.insertAdjacentElement("afterend", createDraftPanel(context));
  }

  async function applyPendingSubmissionIfAny() {
    const contestId = getSubmitPageContestId();

    if (!contestId) {
      return;
    }

    const pending = await storageGet(DRAFT_STORAGE_KEY);

    if (!pending || pending.contestId !== contestId) {
      return;
    }

    if (Date.now() - pending.savedAt > DRAFT_MAX_AGE_MS) {
      await storageRemove(DRAFT_STORAGE_KEY);
      return;
    }

    const problemSelect = document.querySelector(
      "select[name='submittedProblemIndex']"
    );
    const languageSelect = document.querySelector(
      "select[name='programTypeId']"
    );
    const sourceTextarea = document.querySelector(
      "#sourceCodeTextarea, textarea[name='source']"
    );

    if (!problemSelect || !languageSelect || !sourceTextarea) {
      return;
    }

    const fill = () => {
      problemSelect.value = pending.problemIndex;
      problemSelect.dispatchEvent(new Event("change", { bubbles: true }));

      languageSelect.value = pending.programTypeId;
      languageSelect.dispatchEvent(new Event("change", { bubbles: true }));

      sourceTextarea.value = pending.source;
      sourceTextarea.dispatchEvent(new Event("change", { bubbles: true }));
    };

    // The ACE editor attaches its own sync listeners slightly after load,
    // so re-apply a couple of times to make sure the visible editor (not
    // just the underlying hidden textarea that actually gets submitted)
    // ends up showing the pasted code too.
    fill();
    window.setTimeout(fill, 300);
    window.setTimeout(fill, 1000);

    await storageRemove(DRAFT_STORAGE_KEY);
  }

  translate(document.body);
  observeDynamicContent();
  initDraftPanel();
  applyPendingSubmissionIfAny();
})();
