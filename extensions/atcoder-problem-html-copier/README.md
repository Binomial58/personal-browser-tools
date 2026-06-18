# AtCoder Problem HTML Copier

AtCoder の問題ページと解説ページに、HTML をコピーするボタンを追加するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- 問題名の隣に `問題文をコピー` ボタンを表示します。表示位置が見つからない場合は問題本文の直前に表示します。
- クリックすると、表示中の言語だけを残した `#task-statement` の HTML をクリップボードにコピーします。
- `https://atcoder.jp/contests/*/editorial/*` の個別解説ページで動作します。
- 解説本文の見出し付近に `解説HTMLをコピー` ボタンを表示し、その解説本文だけをコピーします。
- 問題別解説ページなどで複数の解説本文が展開されている場合は、各解説に `解説HTMLをコピー` ボタンを表示し、クリックした1件だけをコピーします。
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

AtCoder の問題ページでは、タイトル行付近に表示される `問題文をコピー` ボタンを押します。
解説ページでは、各解説の見出し付近に表示される `解説HTMLをコピー` ボタンを押します。
