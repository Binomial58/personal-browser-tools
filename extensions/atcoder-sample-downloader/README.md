# CP Sample Downloader

AtCoder / AOJ / yukicoder の問題ページに、サンプル入出力を ZIP でダウンロードするボタンを追加するブラウザ拡張機能です。

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
