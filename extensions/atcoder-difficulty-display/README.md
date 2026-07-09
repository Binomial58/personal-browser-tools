# AtCoder Difficulty Display

AtCoder の問題ページに AtCoder Problems の difficulty 円を表示するブラウザ拡張機能です。

## 機能

- `https://atcoder.jp/contests/*/tasks/*` の問題ページで動作します。
- 問題タイトルの左に大きい difficulty 円を表示します。
- 実行時間・メモリ制限の行の `Difficulty:` には小さい difficulty 円を表示します。
- 問題タブのドロップダウン内の各問題にも小さい difficulty 円を表示します。
- 数値は画面には出さず、円にマウスを乗せると確認できます。
- difficulty データは AtCoder Problems の `problem-models.json` から取得します。
- AtCoder Problems へのアクセスを増やしすぎないよう、取得結果を 24 時間キャッシュします。
- `typical90` は AtCoder Problems の推定 difficulty がないため、問題名の星数から旧ユーザースクリプト相当の目安を補完します。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/atcoder-difficulty-display/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/atcoder-difficulty-display/manifest.json` を選択します。

## 動作しなくなった主な理由

元の実装は Tampermonkey などのユーザースクリプト環境を前提に、GreasyFork の `@require` と `GM_addStyle` / `GM_getValue` / `GM_setValue` を使っていました。通常の Chrome / Edge / Firefox 拡張機能として動かす場合はこれらの API が存在しないため、拡張機能内でデータ取得・キャッシュ・CSS 読み込みを完結させる必要があります。
