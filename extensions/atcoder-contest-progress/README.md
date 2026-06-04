# AtCoder Contest Progress

AtCoder の問題ページに、同じコンテスト内の各問題の提出状況を表示するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- 同じコンテストの問題一覧と、自分の提出一覧から問題ごとの状態を表示します。
- `AC` は緑、未提出は無色、`WA` は赤、`TLE` / `MLE` / `RE` などは橙、`CE` は灰色、判定中は青で表示します。
- いずれかの提出が `AC` なら、その問題は `AC` として表示します。
- `AC` がない場合は、取得できた最新の提出結果を表示します。
- `更新` ボタンで提出状況を再取得できます。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/atcoder-contest-progress/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/atcoder-contest-progress/manifest.json` を選択します。

## 使い方

AtCoder にログインした状態で問題ページを開きます。問題名の下付近にコンテスト全体の提出状況が表示されます。
