import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeText, collapseDocxParagraphs, FileReadError, MAMMOTH } from '../src/file.js';
import { parseSettings, parseLimitInput, DEFAULT_SETTINGS } from '../src/settings.js';

const buf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
// 「あいう日本語」の Shift_JIS バイト列（手で固定: あ=82A0 い=82A2 う=82A4 日=93FA 本=967B 語=8CEA）
const SJIS = Uint8Array.from([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);

test('UTF-8 を判定する（日本語）', () => {
  const r = decodeText(buf(new TextEncoder().encode('あいう日本語')));
  assert.deepEqual(r, { text: 'あいう日本語', encoding: 'UTF-8' });
});

test('UTF-8 の BOM は本文に含めない', () => {
  const u = new TextEncoder().encode('あ');
  const r = decodeText(buf(Uint8Array.from([0xef, 0xbb, 0xbf, ...u])));
  assert.equal(r.text, 'あ');
  assert.equal(r.encoding, 'UTF-8');
});

test('Shift_JIS にフォールバックする', () => {
  assert.deepEqual(decodeText(buf(SJIS)), { text: 'あいう日本語', encoding: 'Shift_JIS' });
});

test('UTF-16LE（BOM あり）を判定する', () => {
  assert.deepEqual(decodeText(buf(Uint8Array.from([0xff, 0xfe, 0x42, 0x30]))), { text: 'あ', encoding: 'UTF-16LE' });
});

test('どれでもない・壊れたバイト列は失敗として FileReadError', () => {
  // 0x81 0x20 は UTF-8 としても Shift_JIS としても不正
  assert.throws(() => decodeText(buf(Uint8Array.from([0x81, 0x20, 0xff, 0xff]))), FileReadError);
});

test('DOCX: 段落区切りの空行を改行1つに戻す。空の段落は空行として残る', () => {
  assert.equal(collapseDocxParagraphs('a\n\nb\n\nc'), 'a\nb\nc');
  assert.equal(collapseDocxParagraphs('a\n\n\n\nc'), 'a\n\nc');
  assert.equal(collapseDocxParagraphs('x\ny\n\nz'), 'x\ny\nz'); // 段落内の改行（w:br）は保つ
  assert.equal(collapseDocxParagraphs('a\r\n\r\nb'), 'a\nb');
  assert.equal(collapseDocxParagraphs('a\n\nb\n\n'), 'a\nb'); // mammoth は末尾にも \n\n を付ける
  assert.equal(collapseDocxParagraphs(''), '');
});

test('mammoth は 1.13.0 に固定され、SRI（sha384）が付いている', () => {
  assert.equal(MAMMOTH.version, '1.13.0');
  assert.match(MAMMOTH.url, /\/npm\/mammoth@1\.13\.0\//);
  assert.match(MAMMOTH.integrity, /^sha384-[A-Za-z0-9+/]{64}$/);
});

test('mammoth の版・SRI は常用漢字さん（kanji-checker）と同じ', { skip: !process.env.KANJI_CHECKER_HTML }, () => {
  const html = readFileSync(process.env.KANJI_CHECKER_HTML, 'utf8');
  assert.ok(html.includes(MAMMOTH.url) && html.includes(MAMMOTH.integrity));
});

test('設定: 壊れた値は既定値に戻る。本文キーは扱わない', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{oops'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{"limit":-1,"basis":"x","detailsOpen":"yes"}'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{"limit":400,"basis":"noSpace","detailsOpen":true,"text":"本文"}'), { limit: 400, basis: 'noSpace', detailsOpen: true });
});

test('上限入力: 全角数字も受け付け、空・不正は null', () => {
  assert.equal(parseLimitInput('４００'), 400);
  assert.equal(parseLimitInput(' 0 '), 0);
  for (const bad of ['', 'abc', '-1', '1.5', '1e3', '1234567890']) assert.equal(parseLimitInput(bad), null, bad);
});
