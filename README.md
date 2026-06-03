# AtCoder Problem HTML Copier

AtCoder の問題ページに、問題文 HTML をコピーするボタンを追加するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- 問題本文の直前に `問題HTMLをコピー` ボタンを表示します。
- クリックすると、表示中の言語だけを残した `#task-statement` の HTML をクリップボードにコピーします。
- 新旧 AtCoder コンテスト用に `*.contest.atcoder.jp/tasks/*` にも対応しています。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリのディレクトリを選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `manifest.json` を選択します。

## 使い方

AtCoder の問題ページを開き、問題文の上に表示される `問題HTMLをコピー` ボタンを押します。
