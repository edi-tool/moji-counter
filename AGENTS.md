# moji-counter（文字数集計さん）

文章を貼るだけで、文字数・改行を除く文字数・空白と改行を除く文字数がすぐ分かるブラウザツール。公開URL（予定）: https://edi-tool.github.io/moji-counter/
`CLAUDE.md` はこのファイルを取り込むだけなので、エージェント共通の規則はここに書く。
集計の定義は `docs/counting-spec.md`、設計判断は `DESIGN.md`、先行調査は `docs/research.md`。

## 実行コマンド

- プレビュー: `python -m http.server 8000`
- テスト: `npm test`（Node.js 22 以上、`node:test`、依存なし）
- HTML 静的チェック: `npm run check`
- 長文ベンチ: `node scripts/bench.mjs`（CI 非必須）
- E2E: `cd tests/e2e && npm ci && npx playwright test`（システムの Chrome を使用。本体の依存には含めない）

## 守ること

- [edi-tool 開発原則](https://github.com/edi-tool/.github/blob/main/PRINCIPLES.md) に従う。
- 表示名は「文字数集計さん」、リポジトリ・URLスラッグは `moji-counter`。
- ビルドなしの Vanilla JS（ES モジュール、`// @ts-check` と JSDoc）。実行時の npm 依存・CDN 常時読み込みを作らない。例外は DOCX 選択時だけ動的に読む mammoth（版固定・SRI 付き）。
- 本文は保存・送信しない。localStorage に置くのは設定（`moji-counter:settings`）だけ。
- 集計ロジックは `src/count.js` の純粋関数（DOM 非依存）に置き、`node:test` で固定する。字種・X換算などの数値は実測・出典確認のうえ `docs/counting-spec.md` に記録してから変える。
- ファイル読み込み・DOCX 抽出の失敗を「0字」と表示しない（失敗として表示する）。
- 依存を足す前に、必要性・ライセンス・バージョン・容量を `DESIGN.md` に記録し、ユーザーの合意を取る。
- 既存の文字数カウントサイトのコード・文言・デザインを複製しない。
- `scripts/check-static.mjs` と `tests/helpers.js` は edi-tool/.github の原本からのコピー。直すときは原本も直し、`node ../edi-tool-.github/tools/check-template-sync.mjs ../moji-counter` で一致を確認する。
- ポータル（edi-tool.github.io）・組織プロフィール（.github）への掲載は、ユーザーの合意を得てから行う。軽微な修正での push 禁止。複数修正を1コミットに集約する。
- セッション終了時に `progress.md` を更新。
