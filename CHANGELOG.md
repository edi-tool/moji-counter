# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
### Changed
### Fixed

## [0.1.0] - 未公開（2026-11-06 ローカル実装）

- 文字数・改行を除く・空白と改行を除く、行数・段落数をリアルタイムで集計（書記素単位）。
- 上限（基準3種）と残り／超過表示、選択範囲の字数、詳しい集計（字種・全角半角・UTF 各単位・X 換算・原稿用紙）。
- コピー、クリア（元に戻す付き）、TXT（UTF-8 / Shift_JIS / UTF-16 BOM）・DOCX の読み込み。失敗は失敗として表示。
- PC は2カラム、スマホは結果バーを入力欄の上に固定。ライト／ダーク対応。
