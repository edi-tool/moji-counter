# 文字数集計さん（moji-counter）

文章を貼るだけで、文字数・改行を除く文字数・空白と改行を除く文字数がすぐ分かる、ブラウザで使う無料ツールです（絵文字・結合文字は見た目の1文字で数え、上限までの残りも表示）。

🔗 https://edi-tool.github.io/moji-counter/ （公開予定。2026-11-06 時点では未公開）

<!-- 画面例は公開後に docs/screenshot.png を追加します -->

## 使い方

1. 入力欄に文章を貼り付ける（または入力する）。ボタンを押さなくても、すぐに数えます。
2. 上に出る「文字数」「改行を除く」「空白・改行を除く」を見る。行数・段落数も出ます。
3. 必要なら「上限」を入れる（「あと n 字」「n 字オーバー」を表示）。「詳しい集計」で字種・X 換算・原稿用紙換算なども見られます。
4. 「コピー」で入力欄の文章をコピー、「クリア」は数秒間「元に戻す」できます。「ファイルを開く」またはドラッグで .txt / .docx を読み込めます。

## データの扱い

- 文章・読み込んだファイルは **ブラウザ内で処理し、外部へ送信しません**。本文は保存もしません。
- 保存するもの: 上限・上限の基準・「詳しい集計」の開閉だけ（localStorage の `moji-counter:settings`。この端末のブラウザ内のみ）。
- 外部から読み込むもの: Word（.docx）を開いたときだけ、[mammoth](https://github.com/mwilliamson/mammoth.js) 1.13.0（BSD-2-Clause）を cdn.jsdelivr.net から読み込みます（バージョン固定・SRI 付き）。ファイル自体は送信しません。.docx を使わない限り、外部への通信はありません。
- 外部フォント・分析タグ・広告はありません。

## 判定基準・計算根拠と出典

- 数える単位は書記素（`Intl.Segmenter` による見た目の1文字）。改行は各1字。定義の全文は [docs/counting-spec.md](docs/counting-spec.md)。
- X 換算の出典: twitter-text `config/v3.json`（確認日 2026-11-06）。
- 先行サイト・OSS の調査: [docs/research.md](docs/research.md)。

## 制限事項・よくある質問

- **Word・SNS・応募フォームなどの文字数とは、数え方の違いで合わないことがあります**（完全一致は保証しません）。たとえば HTML の `maxlength` や JavaScript の `length` は UTF-16 単位で、絵文字を2と数えます（「詳しい集計」の「UTF-16 単位」で確認できます）。
- 全角・半角は簡易判定、X 換算の URL 判定は簡易版、原稿用紙は禁則処理を考慮しない目安です。
- Word の読み込みでは、ヘッダー・フッター・テキストボックスなどが抽出されない場合があり、Word の文字数と一致しないことがあります。古い .doc は読み込めません（.docx に保存し直してください）。
- ファイルは 10MB まで。UTF-8・UTF-16（BOM 付き）・Shift_JIS の .txt を読めます。読み込みに失敗したときは、0字ではなく失敗として表示します。
- 動作環境: `Intl.Segmenter` が使えるブラウザ（Chrome 87 / Safari 14.1 / Firefox 125 以降）。iPhone Safari の実機確認は公開後に行います（progress.md）。

## 開発

ビルド工程はありません。`index.html` と `src/` の ES モジュールをそのまま GitHub Pages が配信します。Vite / Vitest などのビルドツール・テストランナーは、edi-tool の規約（npm 依存ゼロ、`node:test`）に合わせて採用していません。

```bash
python -m http.server 8000   # プレビュー
npm test                     # テスト（Node.js 22 以上、依存パッケージなし）
npm run check                # HTML の静的チェック
node scripts/bench.mjs       # 長文ベンチ（10万・100万字）
cd tests/e2e && npm ci && npx playwright test   # E2E（システムの Chrome。本体の依存には含めない）
```

変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。設計判断は [DESIGN.md](DESIGN.md)。

## 関連ツール

- [edi-tool](https://edi-tool.github.io/) の他のツール

## ライセンス

MIT License © 2026 ISHIKAWA, Natsuki
第三者ライブラリはそれぞれのライセンスに従います（mammoth: BSD-2-Clause）。
