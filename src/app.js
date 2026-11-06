// @ts-check
// UI: 入力 → 集計 → 描画。本文は保存しない（保存するのは上限などの設定だけ）。
import { countText, xCount, limitStatus, X_CONFIG } from './count.js';
import { readFileText, FileReadError } from './file.js';
import { SETTINGS_KEY, parseSettings, parseLimitInput } from './settings.js';

/** @param {string} id */
const $ = (id) => /** @type {any} */ (document.getElementById(id));
const nf = new Intl.NumberFormat('ja-JP');
const fmt = (n) => nf.format(n);

const text = /** @type {HTMLTextAreaElement} */ ($('text'));
const limitInput = /** @type {HTMLInputElement} */ ($('limit'));
const basisSelect = /** @type {HTMLSelectElement} */ ($('basis'));
const details = /** @type {HTMLDetailsElement} */ ($('details'));
const fileInput = /** @type {HTMLInputElement} */ ($('file'));

// ---- 設定（localStorage。使えない環境でも動く） ----
function loadSettings() {
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); } catch { return parseSettings(null); }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      limit: parseLimitInput(limitInput.value),
      basis: basisSelect.value,
      detailsOpen: details.open,
    }));
  } catch { /* 保存できなくても集計は続ける */ }
}

// ---- 描画 ----
/** @type {ReturnType<typeof countText>} */
let counts = countText('');

/** @param {string} path */
const pick = (path) => path.split('.').reduce((o, k) => o?.[k], /** @type {any} */ (counts));

function renderCounts() {
  for (const el of document.querySelectorAll('[data-k]')) {
    el.textContent = fmt(pick(/** @type {string} */ (el.getAttribute('data-k'))) ?? 0);
  }
  renderLimit();
  if (details.open) renderDetailsExtra();
}

/** X 換算・原稿用紙は「詳しい集計」を開いているときだけ計算する */
function renderDetailsExtra() {
  const x = xCount(text.value);
  $('x-count').textContent = `${fmt(x.weighted)} / ${X_CONFIG.maxWeightedLength}`;
  $('x-remaining').textContent = x.remaining >= 0 ? `あと ${fmt(x.remaining)}` : `${fmt(-x.remaining)} オーバー`;
  $('g-sheets').textContent = `${fmt(counts.genkou.sheets)} 枚（${fmt(counts.genkou.rows)} 行）`;
  $('g-simple').textContent = `${(Math.round(counts.genkou.simpleSheets * 10) / 10).toLocaleString('ja-JP')} 枚`;
}

function renderLimit() {
  const el = $('limit-status');
  const raw = limitInput.value.trim();
  const limit = parseLimitInput(raw);
  limitInput.removeAttribute('aria-invalid');
  if (raw !== '' && limit === null) {
    limitInput.setAttribute('aria-invalid', 'true');
    el.dataset.state = 'over';
    el.dataset.icon = 'warn';
    el.textContent = '上限は 0 以上の整数で入力してください。';
    return;
  }
  const s = limitStatus(counts, limit, /** @type {any} */ (basisSelect.value));
  el.dataset.state = s.state;
  el.dataset.icon = s.state === 'none' ? '' : s.state === 'under' ? 'ok' : 'warn';
  if (s.state === 'none') el.textContent = '上限を入れると、残りの字数が分かります。';
  else if (s.state === 'under') el.textContent = s.diff === 0 ? '上限ちょうどです' : `あと ${fmt(s.diff)} 字`;
  else el.textContent = `${fmt(s.diff)} 字オーバー`;
}

function renderSelection() {
  const { selectionStart: a, selectionEnd: b } = text;
  const box = $('selection');
  if (a === b) { box.hidden = true; return; }
  $('n-selection').textContent = fmt(countText(text.value.slice(a, b)).chars);
  box.hidden = false;
}

// ---- 更新の間引き（1フレーム1回。10万字超は 120ms デバウンス） ----
let raf = 0, timer = 0;
function update() {
  raf = 0; timer = 0;
  counts = countText(text.value);
  renderCounts();
  renderSelection();
}
function scheduleUpdate() {
  cancelAnimationFrame(raf);
  clearTimeout(timer);
  if (text.value.length > 100_000) timer = window.setTimeout(update, 120);
  else raf = requestAnimationFrame(update);
}
let selRaf = 0;
function scheduleSelection() {
  cancelAnimationFrame(selRaf);
  selRaf = requestAnimationFrame(renderSelection);
}

// ---- トースト ----
let toastTimer = 0;
/**
 * @param {string} message
 * @param {{label:string, onAction:() => void}|null} [action]
 * @param {number} [ms]
 */
function showToast(message, action = null, ms = 3000) {
  const toast = $('toast'), btn = $('toast-action');
  $('toast-text').textContent = message;
  btn.hidden = !action;
  btn.onclick = null;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { action.onAction(); hideToast(); };
  }
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, action ? Math.max(ms, 8000) : ms);
}
function hideToast() { $('toast').hidden = true; }

/**
 * 押したボタンの中で結果を示し、1.5 秒で元に戻す（DESIGN.md「4. 部品」押した結果）
 * @param {HTMLElement} btn
 * @param {string} label ボタンに出す短い文
 * @param {string} [spoken] 読み上げ用の文（省略時は label）
 */
function flashDone(btn, label, spoken = label) {
  if (btn.dataset.label === undefined) btn.dataset.label = btn.innerHTML;
  btn.innerHTML = '<span class="et-i et-i-check" aria-hidden="true"></span>' + label;
  btn.classList.add('is-done');
  let live = document.getElementById('et-live');
  if (!live) { live = document.createElement('p'); live.id = 'et-live'; live.className = 'et-live'; live.setAttribute('role', 'status'); document.body.append(live); }
  live.textContent = spoken;
  clearTimeout(Number(btn.dataset.timer));
  btn.dataset.timer = String(window.setTimeout(() => {
    btn.innerHTML = btn.dataset.label ?? '';
    delete btn.dataset.label;
    btn.classList.remove('is-done');
  }, 1500));
}

/** 入力欄の内容を差し替える（元に戻せるようにトーストで案内） */
function replaceText(next, message) {
  const before = text.value;
  text.value = next;
  update();
  showToast(message, before ? { label: '元に戻す', onAction: () => { text.value = before; update(); text.focus(); } } : null);
}

// ---- 操作 ----
$('btn-copy').addEventListener('click', async (ev) => {
  // await の後では ev.currentTarget が null になるため、先にボタンを取っておく
  const btn = /** @type {HTMLElement} */ (ev.currentTarget);
  if (!text.value) { showToast('コピーする文章がありません。'); return; }
  try {
    await navigator.clipboard.writeText(text.value);
    flashDone(btn, 'コピーしました', `コピーしました（${fmt(counts.chars)} 字）`);
  } catch {
    text.focus();
    text.select();
    showToast('自動でコピーできませんでした。選択した状態なので、Ctrl+C（スマホは長押し）でコピーしてください。', null, 6000);
  }
});

$('btn-clear').addEventListener('click', () => {
  if (!text.value) { showToast('すでに空です。'); return; }
  replaceText('', 'クリアしました');
  text.focus();
});

$('btn-open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = ''; // 同じファイルをもう一度選べるように
  if (file) await openFile(file);
});

/** @param {File} file */
async function openFile(file) {
  const status = $('file-status');
  status.dataset.state = 'ok';
  status.dataset.icon = '';
  status.textContent = `「${file.name}」を読み込み中…`;
  try {
    const { text: loaded, note } = await readFileText(file);
    status.textContent = `読み込みました: ${file.name}（${note}）`;
    replaceText(loaded, `「${file.name}」を読み込みました`);
  } catch (e) {
    // 失敗を「0字」に見せない: 入力欄は変えず、失敗として表示する
    status.dataset.state = 'error';
    status.dataset.icon = 'warn';
    const reason = e instanceof FileReadError ? e.message : 'ファイルを読み取れませんでした。';
    status.textContent = `「${file.name}」を読み込めませんでした。${reason}`;
  }
}

// ドラッグ&ドロップ（入力欄以外にドロップしてもブラウザが開かないようにする）
const hasFiles = (/** @type {DragEvent} */ e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });
text.addEventListener('dragover', (e) => { if (hasFiles(e)) text.classList.add('dragging'); });
text.addEventListener('dragleave', () => text.classList.remove('dragging'));
text.addEventListener('drop', async (e) => {
  text.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (file) { e.preventDefault(); await openFile(file); }
});

// ---- 入力・設定のイベント ----
// IME 変換中も表示上の文字は数える（集計は確定処理ではない）。設定の保存は変換中に走らせない。
text.addEventListener('input', scheduleUpdate);
for (const ev of ['select', 'keyup', 'mouseup', 'touchend']) text.addEventListener(ev, scheduleSelection);
document.addEventListener('selectionchange', () => { if (document.activeElement === text) scheduleSelection(); });

limitInput.addEventListener('input', (e) => {
  renderLimit();
  if (!(/** @type {InputEvent} */ (e)).isComposing) saveSettings();
});
limitInput.addEventListener('compositionend', saveSettings);
basisSelect.addEventListener('change', () => { renderLimit(); saveSettings(); });
details.addEventListener('toggle', () => {
  if (details.open) renderDetailsExtra();
  saveSettings();
});

// ---- 起動 ----
const saved = loadSettings();
limitInput.value = saved.limit === null ? '' : String(saved.limit);
basisSelect.value = saved.basis;
details.open = saved.detailsOpen;
update();
document.documentElement.dataset.ready = 'true'; // E2E が起動完了を待つための目印
