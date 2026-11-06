// @ts-check
// ファイル読み込み（TXT の文字コード判定、DOCX の抽出）。失敗は例外（FileReadError）で返し、「0字」と見せない。
// ファイルはブラウザ内で処理し、外部へ送信しない。DOCX 選択時のみ mammoth を CDN から動的に読み込む。

/** 読み込みサイズの上限（10MB） */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** mammoth（BSD-2-Clause）。版と SRI を固定。常用漢字さん（kanji-checker）と同じ。 */
export const MAMMOTH = Object.freeze({
  version: '1.13.0',
  url: 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js',
  integrity: 'sha384-8NWE3bZDrmRI4IePMoQaEoLhAQ1MmRMJkdNgnGiHRFanTqsFKr0TmK6aSZvFJ/PO',
});

export class FileReadError extends Error {
  /** @param {string} message 利用者向けの失敗理由 */
  constructor(message) {
    super(message);
    this.name = 'FileReadError';
  }
}

/**
 * バイト列を文字コード判定してデコードする。UTF-16（BOM あり）→ UTF-8（BOM 可）→ Shift_JIS の順。
 * @param {ArrayBuffer} buffer
 * @returns {{text:string, encoding:string}}
 */
export function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE' };
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); // BOM は取り除かれる
    return { text, encoding: 'UTF-8' };
  } catch { /* 次へ */ }
  try {
    const text = new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
    return { text, encoding: 'Shift_JIS' };
  } catch { /* 次へ */ }
  throw new FileReadError('文字コードを判別できませんでした（UTF-8・Shift_JIS 以外、または壊れたファイルです）。');
}

/**
 * mammoth の extractRawText は段落の間に空行（\n\n）を入れる。段落区切りを改行1つへ戻す。
 * 空の段落は空行として残る（"a\n\n\n\nc" → "a\n\nc"）。
 * @param {string} raw
 */
export function collapseDocxParagraphs(raw) {
  const unified = raw.replace(/\r\n?/g, '\n');
  // mammoth は最後の段落の後ろにも \n\n を付けるので、1回分だけ外してから戻す
  return (unified.endsWith('\n\n') ? unified.slice(0, -2) : unified).replace(/\n\n/g, '\n');
}

/** @type {Promise<any>|null} */
let mammothPromise = null;

/** mammoth を動的に読み込む（一度だけ）。失敗時は次回やり直せるよう保持しない。 */
export function loadMammoth() {
  const w = /** @type {any} */ (globalThis);
  if (w.mammoth) return Promise.resolve(w.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MAMMOTH.url;
      s.integrity = MAMMOTH.integrity;
      s.crossOrigin = 'anonymous';
      s.onload = () => (w.mammoth ? resolve(w.mammoth) : reject(new Error('mammoth が見つかりません')));
      s.onerror = () => { s.remove(); reject(new Error('mammoth の読み込みに失敗')); };
      document.head.appendChild(s);
    }).catch((e) => { mammothPromise = null; throw e; });
  }
  return mammothPromise;
}

/**
 * ファイルを読み、本文とメモを返す。失敗は FileReadError。
 * @param {File} file
 * @returns {Promise<{text:string, note:string}>} note は「UTF-8」「Word から抽出」など
 */
export async function readFileText(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new FileReadError(`ファイルが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB。上限は ${MAX_FILE_BYTES / 1024 / 1024}MB です）。`);
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    let mammoth;
    try {
      mammoth = await loadMammoth();
    } catch {
      throw new FileReadError('Word 読み込み用の部品を取得できませんでした。ネットワーク接続を確認してもう一度お試しください。');
    }
    let raw;
    try {
      raw = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } catch {
      throw new FileReadError('Word ファイルを読み取れませんでした（.docx 以外、または壊れたファイルの可能性があります）。');
    }
    const text = collapseDocxParagraphs(raw);
    if (!/\S/.test(text)) throw new FileReadError('Word ファイルから文字を取り出せませんでした（空のファイル、または画像・図形だけの可能性があります）。');
    return { text, note: 'Word から本文を抽出（ヘッダー・フッター・テキストボックス等は含まれない場合があります）' };
  }
  if (name.endsWith('.doc')) throw new FileReadError('古い形式の .doc は読み込めません。Word で .docx に保存し直してください。');
  const { text, encoding } = decodeText(await file.arrayBuffer());
  if (text.length === 0) throw new FileReadError('空のファイルでした。');
  return { text, note: encoding };
}
