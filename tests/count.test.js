import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countText, xCount, limitStatus, X_CONFIG, emojiMode } from '../src/count.js';

// 期待値はすべて手計算で固定している。

test('空文字は全項目0（行数も0）', () => {
  const c = countText('');
  assert.equal(c.chars, 0);
  assert.equal(c.noNewline, 0);
  assert.equal(c.noSpace, 0);
  assert.equal(c.lines, 0);
  assert.equal(c.newlines, 0);
  assert.equal(c.paragraphs, 0);
  assert.equal(c.utf8Bytes, 0);
  assert.equal(c.genkou.rows, 0);
  assert.equal(c.genkou.sheets, 0);
});

test('日本語・英語・数字: 「吾輩は猫である。Abc 123」', () => {
  const c = countText('吾輩は猫である。Abc 123');
  // 吾輩は猫である。=8 / Abc=3 / 空白=1 / 123=3
  assert.equal(c.chars, 15);
  assert.equal(c.noNewline, 15);
  assert.equal(c.noSpace, 14);
  assert.deepEqual(c.kinds, { hiragana: 4, katakana: 0, kanji: 3, latin: 3, digit: 3, emoji: 0, other: 1 });
  assert.equal(c.utf8Bytes, 31); // 8字×3=24 + 「Abc 123」7
  assert.equal(c.widths.full, 8);
  assert.equal(c.widths.half, 6);
});

test('空白の扱い: 半角・全角スペース・タブ・NBSP は「空白・改行を除く」から外れる', () => {
  const c = countText('a b　c\td e');
  assert.equal(c.chars, 9);
  assert.equal(c.noNewline, 9);
  assert.equal(c.noSpace, 5);
});

test('ゼロ幅スペース U+200B は空白扱いせず文字として数える', () => {
  const c = countText('a​b');
  assert.equal(c.chars, 3);
  assert.equal(c.noSpace, 3);
});

test('改行: LF / CRLF / CR はそれぞれ1字・改行数1', () => {
  for (const nl of ['\n', '\r\n', '\r']) {
    const c = countText(`あ${nl}い`);
    assert.equal(c.chars, 3, JSON.stringify(nl));
    assert.equal(c.noNewline, 2);
    assert.equal(c.noSpace, 2);
    assert.equal(c.newlines, 1);
    assert.equal(c.lines, 2);
    assert.equal(c.paragraphs, 2);
  }
});

test('末尾改行・連続空行: 行数は改行数+1、段落数は空白以外を含む行だけ', () => {
  const a = countText('あ\n');
  assert.equal(a.lines, 2); // 末尾改行の後の空行も1行
  assert.equal(a.paragraphs, 1);
  assert.equal(a.chars, 2);
  const b = countText('あ\n\n\nい');
  assert.equal(b.lines, 4);
  assert.equal(b.newlines, 3);
  assert.equal(b.paragraphs, 2);
  assert.equal(b.noNewline, 2);
  const c = countText('\n');
  assert.equal(c.lines, 2);
  assert.equal(c.paragraphs, 0);
  const d = countText('あ\n  　\nい'); // 空白だけの行は段落に数えない
  assert.equal(d.paragraphs, 2);
  assert.equal(d.lines, 3);
});

test('混在した改行コード: \\r\\n と \\n と \\r', () => {
  const c = countText('a\r\nb\nc\rd');
  assert.equal(c.chars, 7);
  assert.equal(c.newlines, 3);
  assert.equal(c.lines, 4);
});

test('絵文字: 単体・ZWJ 結合・国旗・肌色修飾は各1字', () => {
  assert.equal(emojiMode, 'RGI_Emoji');
  for (const e of ['😀', '👨‍👩‍👧', '🇯🇵', '👍🏽', '❤️']) {
    const c = countText(e);
    assert.equal(c.chars, 1, e);
    assert.equal(c.kinds.emoji, 1, e);
  }
  const c = countText('👨‍👩‍👧');
  assert.equal(c.codePoints, 5);
  assert.equal(c.utf16, 8);
  assert.equal(c.utf8Bytes, 18);
  assert.equal(countText('😀').utf16, 2);
  assert.equal(countText('😀').codePoints, 1);
  assert.equal(countText('😀').utf8Bytes, 4);
});

test('絵文字ではないもの: © や数字単体は絵文字に数えない／キーキャップは絵文字', () => {
  assert.equal(countText('©').kinds.emoji, 0);
  assert.equal(countText('1').kinds.emoji, 0);
  assert.equal(countText('1️⃣').chars, 1);
  assert.equal(countText('1️⃣').kinds.emoji, 1);
});

test('結合文字: か+゛ / e+◌́ / 異体字セレクタは1字', () => {
  const ka = countText('が');
  assert.equal(ka.chars, 1);
  assert.equal(ka.codePoints, 2);
  assert.equal(ka.kinds.hiragana, 1);
  const e = countText('é');
  assert.equal(e.chars, 1);
  assert.equal(e.utf16, 2);
  assert.equal(e.kinds.latin, 1);
  const katsu = countText('葛\u{E0100}');
  assert.equal(katsu.chars, 1);
  assert.equal(katsu.codePoints, 2);
  assert.equal(katsu.utf16, 3);
  assert.equal(katsu.kinds.kanji, 1);
  assert.equal(countText('NFC é').chars, countText('NFC é').chars); // NFC/NFD で文字数は変わらない
});

test('字種の境界: 々〆ヶ ー 〇 ・ 半角カナ 全角英数', () => {
  const k = (s) => countText(s).kinds;
  assert.equal(k('々').kanji, 1); // Script=Han
  assert.equal(k('〇').kanji, 1); // Script=Han
  assert.equal(k('〆').kanji, 1); // Script=Common だが明示的に漢字へ
  assert.equal(k('ヶ').katakana, 1);
  assert.equal(k('ー').katakana, 1); // Script=Common だが明示的にカタカナへ
  assert.equal(k('ｰ').katakana, 1);
  assert.equal(k('ｱ').katakana, 1);
  assert.equal(k('・').other, 1);
  assert.equal(k('ゝ').hiragana, 1);
  assert.equal(k('ＡＢ').latin, 2);
  assert.equal(k('１２').digit, 2);
  assert.equal(k('、。!?').other, 4);
  assert.equal(k('αΩ').other, 2);
});

test('全角・半角（簡易）: ASCII と半角カナが半角', () => {
  const w = countText('Aａ1１ｱア').widths;
  assert.equal(w.half, 3); // A 1 ｱ
  assert.equal(w.full, 3); // ａ １ ア
});

test('UTF-8 バイト: LF 換算。ASCII 1 / かな 3 / 絵文字 4', () => {
  assert.equal(countText('aあ😀\n').utf8Bytes, 1 + 3 + 4 + 1);
});

test('原稿用紙: 20字折返しの行数と枚数、単純換算', () => {
  const full = 'あ'.repeat(20);
  assert.equal(countText(full).genkou.rows, 1);
  assert.equal(countText(full + 'あ').genkou.rows, 2);
  assert.equal(countText(`${full}\n\nあ`).genkou.rows, 3); // 20字行 + 空行 + 1字行
  assert.equal(countText('あ\n').genkou.rows, 1); // 末尾改行の後の空行は数えない
  assert.equal(countText('あ'.repeat(400)).genkou.sheets, 1);
  assert.equal(countText('あ'.repeat(401)).genkou.sheets, 2);
  assert.equal(countText('あ'.repeat(400)).genkou.simpleSheets, 1);
  assert.equal(countText('あ'.repeat(200)).genkou.simpleSheets, 0.5);
  assert.equal(countText(('あ'.repeat(20) + '\n').repeat(21)).genkou.sheets, 2); // 21行
});

test('100万字でも例外なく完了し、件数が合う', () => {
  const unit = '吾輩は猫である。Abc 123\n😀';
  const reps = 50000;
  const c = countText(unit.repeat(reps));
  assert.equal(c.chars, 17 * 0 + (15 + 1 + 1) * reps); // 吾輩は猫である。Abc 123=15 + \n + 😀
  assert.equal(c.newlines, reps);
  assert.equal(c.kinds.emoji, reps);
});

test('孤立サロゲートでも例外を出さない', () => {
  const c = countText('a\ud800b');
  assert.equal(c.utf16, 3);
  assert.equal(c.codePoints, 3);
  assert.equal(c.chars, 3);
});

// ---- X 換算 ----
test('X: twitter-text v3 設定値（出典 config/v3.json）が固定されている', () => {
  assert.equal(X_CONFIG.maxWeightedLength, 280);
  assert.equal(X_CONFIG.scale, 100);
  assert.equal(X_CONFIG.defaultWeight, 200);
  assert.equal(X_CONFIG.urlLength, 23);
  assert.deepEqual(X_CONFIG.ranges.map((r) => [...r]), [[0, 4351, 100], [8192, 8205, 100], [8208, 8223, 100], [8242, 8247, 100]]);
});

test('X: 英数字は1、日本語は2、絵文字は2、改行は1', () => {
  assert.equal(xCount('abc').weighted, 3);
  assert.equal(xCount('あいう').weighted, 6);
  assert.equal(xCount('😀').weighted, 2);
  assert.equal(xCount('👨‍👩‍👧').weighted, 2);
  assert.equal(xCount('a\nb').weighted, 3);
  assert.equal(xCount('“a”').weighted, 3); // U+201C/201D は範囲内
  assert.equal(xCount('、').weighted, 2);
  assert.equal(xCount('abc').remaining, 277);
});

test('X: NFC 正規化後で数える（か+゛ は が 1字分=2）', () => {
  assert.equal(xCount('が').weighted, 2);
  assert.equal(xCount('é').weighted, 1);
});

test('X: URL は一律23。末尾の句読点は URL に含めない', () => {
  assert.equal(xCount('https://example.com/very/long/path?query=1').weighted, 23);
  assert.equal(xCount('見て https://example.com/a').weighted, 2 + 2 + 1 + 23);
  const withDot = xCount('see https://example.com.');
  assert.equal(withDot.urls, 1);
  assert.equal(withDot.weighted, 4 + 23 + 1);
});

test('X: 上限280に対する残り', () => {
  assert.equal(xCount('a'.repeat(280)).remaining, 0);
  assert.equal(xCount('a'.repeat(281)).remaining, -1);
  assert.equal(xCount('あ'.repeat(140)).remaining, 0);
});

// ---- 上限 ----
test('上限: あと n 字 / n 字オーバー / 未設定', () => {
  const c = countText('あいう\nえ');
  assert.deepEqual(limitStatus(c, 10, 'chars'), { state: 'under', diff: 5 });
  assert.deepEqual(limitStatus(c, 10, 'noNewline'), { state: 'under', diff: 6 });
  assert.deepEqual(limitStatus(c, 3, 'noSpace'), { state: 'over', diff: 1 });
  assert.deepEqual(limitStatus(c, 5, 'chars'), { state: 'under', diff: 0 });
  assert.deepEqual(limitStatus(c, null, 'chars'), { state: 'none' });
  assert.deepEqual(limitStatus(c, NaN, 'chars'), { state: 'none' });
});
