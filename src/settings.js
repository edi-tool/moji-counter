// @ts-check
// 設定の保存。本文は保存しない。保存先は localStorage の `moji-counter:settings` のみ。

export const SETTINGS_KEY = 'moji-counter:settings';

/** @typedef {{limit:number|null, basis:'chars'|'noNewline'|'noSpace', detailsOpen:boolean}} Settings */
/** @type {Settings} */
export const DEFAULT_SETTINGS = Object.freeze({ limit: null, basis: 'chars', detailsOpen: false });

/**
 * 保存された JSON 文字列を設定に直す。壊れた値・未知の値は既定値に戻す。
 * @param {string|null|undefined} raw
 * @returns {Settings}
 */
export function parseSettings(raw) {
  /** @type {any} */
  let v = null;
  try { v = raw ? JSON.parse(raw) : null; } catch { v = null; }
  if (!v || typeof v !== 'object') return { ...DEFAULT_SETTINGS };
  const limit = Number.isInteger(v.limit) && v.limit >= 0 && v.limit <= 1e9 ? v.limit : null;
  const basis = ['chars', 'noNewline', 'noSpace'].includes(v.basis) ? v.basis : DEFAULT_SETTINGS.basis;
  return { limit, basis, detailsOpen: v.detailsOpen === true };
}

/**
 * 上限の入力欄の文字列を数値に直す（空・不正は null）。全角数字も受け付ける。
 * @param {string} s
 * @returns {number|null}
 */
export function parseLimitInput(s) {
  const t = String(s).trim().replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
  if (!/^\d{1,9}$/.test(t)) return null;
  return Number(t);
}
