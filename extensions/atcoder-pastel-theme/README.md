# AtCoder Pastel Theme

AtCoder のページに淡いパステル調の色を適用するブラウザ拡張機能です。
白地の読みやすさは残しつつ、ナビゲーション、表、問題文、コードブロック、フォーム、ステータス表示を落ち着いた配色に整えます。

## 機能

- `https://atcoder.jp/*` と旧 AtCoder コンテストページで動作します。
- レイアウトや白い下地は大きく変えず、ナビゲーション、見出し、表、コードブロック、ボタンのアクセント色を調整します。
- 問題文のセクション、サンプル入出力、シンタックスハイライト、Ace エディタの枠線を淡く整えます。
- `alert`、`label`、`badge`、`panel`、`nav-tabs`、フォーム、ページネーションなど Bootstrap 系 UI にも色を当てます。
- AtCoder のレーティング色は意味が伝わる範囲で少し柔らかい色にします。
- 紫、ピンク、ミント、黄色、ブルー系のパステル色を使います。
- 拡張機能を無効化すると元の表示に戻せます。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/atcoder-pastel-theme/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/atcoder-pastel-theme/manifest.json` を選択します。

## 使い方

拡張機能を読み込んだ状態で AtCoder のページを開きます。
