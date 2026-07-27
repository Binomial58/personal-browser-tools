# Codeforces Comfy Theme

Codeforces の見にくさ(小さい文字、コントラストの低さ、無機質な配色)を緩和するブラウザ拡張機能です。
AtCoder Pastel Theme と同じ Fairyfloss 系パステルカラーを使い、レイアウトは変えずに配色・余白・文字サイズだけを整えます。
あわせて、ナビゲーションや提出結果(Verdict)など、繰り返し出てくる汎用的な UI 文言を日本語に置き換えます。

## 機能

- `https://codeforces.com/*` で動作します。
- 全体の文字サイズ・行間を広げ、テーブルや問題文の余白を調整して読みやすくします。
- ナビゲーションバー、roundbox、テーブル、問題文、サンプル入出力、コードブロック、フォーム、ボタンにパステルカラーを適用します。
- レーティング色 (`user-gray` 〜 `user-legendary`) は意味が伝わる範囲で少し柔らかい色にします。
- 以下のような汎用的な UI 文言を日本語に置き換えます(問題文や投稿本文などのユーザー生成コンテンツは翻訳しません)。
  - ナビゲーション: Problemset, Contests, Gym, Groups, Rating, Standings, Status など
  - ボタン・操作: Submit, Practice, Register, Enter, Edit, Delete など
  - 問題文の構造: Input, Output, Note, Examples, time limit per test, memory limit per test など
  - 提出結果: Accepted, Wrong answer, Time limit exceeded, Compilation error など
- 拡張機能を無効化すると元の表示に戻せます。
- `https://codeforces.com/contest/{id}/problem/{index}` のページでは、問題文の下に「▶ 提出」パネルを追加します。開くと本物の提出ページ(`/contest/{id}/submit`)を iframe で埋め込み、対象の問題を自動選択します。CSRF トークンや Turnstile(キャプチャ)、ftaa/bfaa といった仕組みは Codeforces 本体のフォームがそのまま処理するため、独自に POST を組み立てるより安全です。

## 制限事項

- 翻訳は「単独のラベルとして表示されているテキストノード」に完全一致(または決まった接頭辞)する場合のみ置き換える方式です。全文翻訳ではなく、あくまで定型的な UI 文言のみが対象です。
- Codeforces のマークアップ変更により、一部のクラス名に対するスタイルが当たらなくなる可能性があります。
- 提出パネルは `/contest/{id}/problem/{index}` 形式のページのみ対応です(`/problemset/problem/...` や `/gym/...` は未対応)。

## インストール

### Chrome / Edge

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. `パッケージ化されていない拡張機能を読み込む` を押します。
4. このリポジトリ内の `extensions/codeforces-comfy-theme/` を選択します。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. `一時的なアドオンを読み込む` を押します。
3. このリポジトリ内の `extensions/codeforces-comfy-theme/manifest.json` を選択します。

## 使い方

拡張機能を読み込んだ状態で Codeforces のページを開きます。
