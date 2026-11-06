# progress

## 現状（2026-11-06）

- 実装手順1〜6（骨組み・集計ロジック・UI・E2E・SEO/素材・ドキュメント）まで完了。**公開（gh repo create / push / Pages / ハブ連携）は未実施**。
- 第2段階（2文比較・履歴）は未実装（計画どおり、Opus の判定後）。

## 検証記録

- `npm test` 緑 / `npm run check` 緑 / `check-template-sync` 一致 / E2E 26件 緑（Windows の Chrome）。
- `node scripts/bench.mjs`（Node v26.12.1）: 10万字 約15ms、100万字 約130ms → 10万字が 30ms 未満のため Web Worker 化は見送り（DESIGN.md）。

## 未確認・次の一手

- [ ] ブラウザペインでの PC/スマホ表示の目視確認（手順7、Opus）。
- [ ] iPhone Safari 実機での確認（公開後にユーザー確認）: 結果バーの sticky、ファイル選択、日本語 IME、キーボード表示中の見え方。
- [ ] Word・他サイトの文字数との差の実例確認（ユーザー手元の原稿で）。
- [ ] ハブへの掲載（index.html カード・sitemap.xml・README 表・404.html・OGP）、組織プロフィールへの1行追加（ユーザー合意後）。
- [ ] ogp.png は実行環境の Noto Sans JP で生成した簡易版。ハブ共通の OGP と揃えるなら、ハブ `scripts/ogp/gen.js` の TOOLS に追記して再生成。
