# CP Sample Downloader

AtCoder / AOJ / yukicoder の問題ページにサンプル入出力を ZIP でダウンロードするボタンを追加し、AtCoder の問題・解説ページに HTML コピーボタンを追加するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- `https://onlinejudge.u-aizu.ac.jp/problems/*` の問題ページで動作します。
- `https://yukicoder.me/problems/*` の問題ページで動作します。
- 問題名の隣に `Sample DL` ボタンを表示します。
- クリックすると、サンプル入力とサンプル出力を ZIP にまとめてダウンロードします。
- AtCoder は `入力例` / `出力例` または `Sample Input` / `Sample Output`、AOJ は `Sample Input N` / `Sample Output N`、yukicoder は `サンプルN` 配下の `入力` / `出力` を対象にします。
- ZIP 内のファイル名は `sample-0.in`, `sample-0.out`, `sample-1.in`, `sample-1.out`, ... です。
- 外部ライブラリには依存していません。
- 新旧 AtCoder コンテスト用に `*.contest.atcoder.jp/tasks/*` にも対応しています。
- 旧 AOJ の `judge.u-aizu.ac.jp/onlinejudge/description.jsp` にも対応しています。
- AtCoder の問題ページでは `問題文をコピー` ボタンを表示し、表示中の言語だけを残した問題文 HTML をコピーします。
- AtCoder の解説ページでは `解説HTMLをコピー` ボタンを表示し、その解説本文だけをコピーします。
- 複数の解説本文が展開されているページでは、各解説に `解説HTMLをコピー` ボタンを表示し、クリックした1件だけをコピーします。
- `Sample DL` ボタンは AtCoder の解説ページには表示しません。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/atcoder-sample-downloader/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/atcoder-sample-downloader/manifest.json` を選択します。

## 使い方

各サイトの問題ページを開き、問題名の隣に表示される `Sample DL` ボタンを押します。
AtCoder の問題ページでは `問題文をコピー`、解説ページでは `解説HTMLをコピー` ボタンを押します。
