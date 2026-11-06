// @ts-check
// 集計ロジック（純粋関数・DOM 非依存）。定義の正本は docs/counting-spec.md。
// 数える単位は書記素（見た目の1文字）= Intl.Segmenter の grapheme。正規化（NFC 等）はしない。

/**
 * @typedef {Object} Counts
 * @property {number} chars 文字数（書記素。改行も各1字）
 * @property {number} noNewline 改行を除く文字数
 * @property {number} noSpace 空白・改行を除く文字数
 * @property {number} lines 行数（改行数+1。空文字は0）
 * @property {number} newlines 改行数（CRLF/LF/CR 各1）
 * @property {number} paragraphs 段落数（空白以外を含む行の数）
 * @property {number} codePoints コードポイント数
 * @property {number} utf16 UTF-16 コードユニット数（String#length）
 * @property {number} utf8Bytes UTF-8 バイト数
 * @property {{hiragana:number, katakana:number, kanji:number, latin:number, digit:number, emoji:number, other:number}} kinds 字種別（改行を除く書記素）
 * @property {{full:number, half:number}} widths 全角・半角（簡易。改行を除く書記素）
 * @property {{rows:number, sheets:number, simpleSheets:number}} genkou 原稿用紙（20×20）換算
 */

/** 原稿用紙の1行の字数・1枚の行数 */
export const GENKOU_COLS = 20;
export const GENKOU_ROWS = 20;

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

// RGI_Emoji は v フラグが必要。非対応環境では Extended_Pictographic などで代替する（精度が少し下がる）。
/** @type {(g: string) => boolean} */
let isEmojiGrapheme;
try {
  const re = new RegExp('^\\p{RGI_Emoji}$', 'v');
  isEmojiGrapheme = (g) => re.test(g);
} catch {
  const re = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u;
  isEmojiGrapheme = (g) => re.test(g) && !/^[©®™]$/.test(g);
}
export const emojiMode = (() => {
  try { new RegExp('\\p{RGI_Emoji}', 'v'); return 'RGI_Emoji'; } catch { return 'Extended_Pictographic'; }
})();

const RE_WHITE_SPACE = /^\p{White_Space}+$/u;
const RE_HIRAGANA = /^\p{Script=Hiragana}/u;
// 長音符「ー」(U+30FC) と半角長音符 (U+FF70) は Script=Common のため明示的にカタカナへ含める
const RE_KATAKANA = /^(?:\p{Script=Katakana}|[ーｰ])/u;
// 「々」(U+3005) と「〇」(U+3007) は Script=Han。「〆」(U+3006) は Script=Common のため明示的に漢字へ含める
const RE_KANJI = /^(?:\p{Script=Han}|〆)/u;
const RE_LATIN = /^\p{Script=Latin}/u;

/**
 * 改行以外の書記素を字種に分類する（絵文字以外は先頭コードポイントで判定）。
 * @param {string} g 書記素
 * @param {number} c 先頭コードユニット
 * @returns {'hiragana'|'katakana'|'kanji'|'latin'|'digit'|'emoji'|'other'}
 */
function kindOf(g, c) {
  if (c < 0x80) {
    if (c >= 0x30 && c <= 0x39) return g.length === 1 ? 'digit' : (isEmojiGrapheme(g) ? 'emoji' : 'digit'); // 1️⃣ は絵文字
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return 'latin';
    return g.length === 1 ? 'other' : (isEmojiGrapheme(g) ? 'emoji' : 'other'); // #️⃣ *️⃣
  }
  if (c >= 0x3041 && c <= 0x3096) return 'hiragana';
  if (c >= 0x30a1 && c <= 0x30fa) return 'katakana';
  if (c >= 0x4e00 && c <= 0x9fff) return 'kanji';
  if (c >= 0xff10 && c <= 0xff19) return 'digit';
  if (c >= 0xff21 && c <= 0xff3a || c >= 0xff41 && c <= 0xff5a) return 'latin';
  // 絵文字: 1コードユニットで 0x2000 未満のものは対象外（© ® は RGI_Emoji ではない）
  if (!(g.length === 1 && c < 0x2000) && isEmojiGrapheme(g)) return 'emoji';
  if (RE_HIRAGANA.test(g)) return 'hiragana';
  if (RE_KATAKANA.test(g)) return 'katakana';
  if (RE_KANJI.test(g)) return 'kanji';
  if (RE_LATIN.test(g)) return 'latin';
  return 'other';
}

/** 空白（White_Space のみで構成）か。ゼロ幅スペース U+200B は White_Space ではないので false */
function isSpaceGrapheme(g, c) {
  if (c === 0x20 || (c >= 0x09 && c <= 0x0d)) return true;
  if (c < 0x80) return false;
  return RE_WHITE_SPACE.test(g);
}

/** UTF-16 コードユニット列からコードポイント数を数える（孤立サロゲートは各1） */
function countCodePoints(text) {
  let n = text.length;
  for (let i = 0; i < text.length - 1; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { n--; i++; }
    }
  }
  return n;
}

/** UTF-8 バイト数。TextEncoder と同じく孤立サロゲートは U+FFFD（3バイト）として数える */
function countUtf8(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * 全項目を書記素の1回の走査で集計する。
 * @param {string} text
 * @returns {Counts}
 */
export function countText(text) {
  const kinds = { hiragana: 0, katakana: 0, kanji: 0, latin: 0, digit: 0, emoji: 0, other: 0 };
  const widths = { full: 0, half: 0 };
  let chars = 0, newlines = 0, spaces = 0, paragraphs = 0;
  let lineHasContent = false, lineLen = 0, rows = 0;
  let sawAny = false;

  const closeLine = () => {
    if (lineHasContent) paragraphs++;
    rows += Math.max(1, Math.ceil(lineLen / GENKOU_COLS));
    lineHasContent = false;
    lineLen = 0;
  };

  for (const { segment: g } of segmenter.segment(text)) {
    sawAny = true;
    chars++;
    const c = g.charCodeAt(0);
    if (c === 0x0a || c === 0x0d) { // "\n" "\r" "\r\n"（書記素として分離されるのはこの3通りだけ）
      newlines++;
      closeLine();
      continue;
    }
    lineLen++;
    if (isSpaceGrapheme(g, c)) { spaces++; continue; }
    lineHasContent = true;
    kinds[kindOf(g, c)]++;
    if (c <= 0x7e || (c >= 0xff61 && c <= 0xff9f)) widths.half++; else widths.full++;
  }
  // 末尾が改行で終わるときの最後の空行は、原稿用紙の行には数えない
  if (sawAny) {
    const endsWithNewline = /[\r\n]$/.test(text);
    if (!endsWithNewline) closeLine();
  }
  // 空白だけの書記素（スペース・タブ）も字種・全半角には含めないので、widths/kinds は「空白・改行を除く」基準
  const noNewline = chars - newlines;
  const lines = sawAny ? newlines + 1 : 0;
  const sheets = Math.ceil(rows / GENKOU_ROWS);
  return {
    chars,
    noNewline,
    noSpace: noNewline - spaces,
    lines,
    newlines,
    paragraphs,
    codePoints: countCodePoints(text),
    utf16: text.length,
    utf8Bytes: countUtf8(text),
    kinds,
    widths,
    genkou: { rows, sheets, simpleSheets: noNewline / 400 },
  };
}

// ---- X（旧 Twitter）換算 ----
// 出典: twitter-text config/v3.json（docs/counting-spec.md 参照）。範囲は両端を含む。
export const X_CONFIG = Object.freeze({
  maxWeightedLength: 280,
  scale: 100,
  defaultWeight: 200,
  urlLength: 23,
  ranges: Object.freeze([
    [0, 4351, 100],
    [8192, 8205, 100],
    [8208, 8223, 100],
    [8242, 8247, 100],
  ]),
});

// 簡易 URL 判定: https?:// で始まる、空白以外の連続。末尾の句読点・閉じ括弧は URL に含めない
const RE_URL = /https?:\/\/[^\s　]+/g;
const RE_URL_TRAIL = /[.,;:!?)\]}'"。、」』）]+$/u;

/** コードポイントの重み（100 = 1字） */
function xCodePointWeight(cp) {
  for (const [start, end, weight] of X_CONFIG.ranges) {
    if (cp >= start && cp <= end) return weight;
  }
  return X_CONFIG.defaultWeight;
}

/**
 * X の文字数換算（簡易版。公式 twitter-text の parseTweet と一致しない場合がある）。
 * NFC 正規化後、範囲内=1・範囲外=2・絵文字1つ=2・URL=23。
 * @param {string} text
 * @returns {{weighted:number, max:number, remaining:number, urls:number}}
 */
export function xCount(text) {
  const normalized = text.normalize('NFC');
  let urls = 0;
  let weight = 0;
  let rest = '';
  let last = 0;
  for (const m of normalized.matchAll(RE_URL)) {
    const trail = m[0].match(RE_URL_TRAIL)?.[0].length ?? 0;
    const urlLen = m[0].length - trail;
    if (urlLen <= 'https://'.length - 1) continue;
    rest += normalized.slice(last, m.index);
    last = m.index + urlLen;
    urls++;
    weight += X_CONFIG.urlLength * X_CONFIG.scale;
  }
  rest += normalized.slice(last);
  for (const { segment: g } of segmenter.segment(rest)) {
    const c = g.charCodeAt(0);
    if (g.length > 1 || c >= 0x2000) {
      if (isEmojiGrapheme(g)) { weight += X_CONFIG.defaultWeight; continue; }
    }
    for (const ch of g) weight += xCodePointWeight(/** @type {number} */ (ch.codePointAt(0)));
  }
  const weighted = Math.ceil(weight / X_CONFIG.scale);
  return { weighted, max: X_CONFIG.maxWeightedLength, remaining: X_CONFIG.maxWeightedLength - weighted, urls };
}

// ---- 上限 ----
/** @typedef {'chars'|'noNewline'|'noSpace'} Basis */
export const BASIS_LABELS = Object.freeze({ chars: '文字数', noNewline: '改行を除く', noSpace: '空白・改行を除く' });

/**
 * 上限に対する残り。
 * @param {Counts} counts
 * @param {number|null} limit 0 以上の整数。null/不正なら未設定
 * @param {Basis} basis
 * @returns {{state:'none'}|{state:'under'|'over', diff:number}}
 */
export function limitStatus(counts, limit, basis) {
  if (limit === null || !Number.isFinite(limit) || limit < 0) return { state: 'none' };
  const used = counts[basis] ?? counts.chars;
  const diff = limit - used;
  return diff >= 0 ? { state: 'under', diff } : { state: 'over', diff: -diff };
}
