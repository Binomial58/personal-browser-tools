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

  translate(document.body);
  observeDynamicContent();
})();
