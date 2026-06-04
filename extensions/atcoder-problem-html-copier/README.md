# AtCoder Problem HTML Copier

AtCoder の問題ページに、問題文 HTML をコピーするボタンを追加するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- 問題名の隣に `問題文をコピー` ボタンを表示します。表示位置が見つからない場合は問題本文の直前に表示します。
- クリックすると、表示中の言語だけを残した `#task-statement` の HTML をクリップボードにコピーします。
- KaTeX の表示用 HTML は TeX 文字列に変換し、AtCoder の Copy / Run ボタンなど問題文理解に不要な要素は除去します。
- 新旧 AtCoder コンテスト用に `*.contest.atcoder.jp/tasks/*` にも対応しています。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/atcoder-problem-html-copier/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/atcoder-problem-html-copier/manifest.json` を選択します。

## 使い方

AtCoder の問題ページを開き、タイトル行付近に表示される `問題文をコピー` ボタンを押します。
