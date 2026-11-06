const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FIXTURE_DOCX = join(__dirname, '..', 'fixtures', 'sample.docx');
// 「あいう日本語」の Shift_JIS バイト列
const SJIS = Buffer.from([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);

/** ページを開き、起動完了と console エラーなしを確認できる状態にする */
async function open(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
  await page.goto('/index.html');
  await page.locator('html[data-ready="true"]').waitFor({ timeout: 8000 });
  return problems;
}
const num = (page, k) => page.locator(`#n-${k}`);
const type = async (page, s) => { await page.locator('#text').fill(s); };

test.describe('PC 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('貼り付けると即座に集計される（日本語・英数・空白）', async ({ page }) => {
    const problems = await open(page);
    await expect(num(page, 'chars')).toHaveText('0');
    await type(page, '吾輩は猫である。Abc 123');
    await expect(num(page, 'chars')).toHaveText('15');
    await expect(num(page, 'noSpace')).toHaveText('14');
    await expect(num(page, 'noNewline')).toHaveText('15');
    expect(problems).toEqual([]);
  });

  test('改行は1字として数え、「改行を除く」から外れる。行数・段落数', async ({ page }) => {
    await open(page);
    await type(page, 'あ\n\nい\nう');
    await expect(num(page, 'chars')).toHaveText('6');
    await expect(num(page, 'noNewline')).toHaveText('3');
    await expect(page.locator('[data-k="lines"]')).toHaveText('4');
    await expect(page.locator('[data-k="paragraphs"]')).toHaveText('3');
  });

  test('絵文字（ZWJ 結合）は見た目の1文字', async ({ page }) => {
    await open(page);
    await type(page, '👨‍👩‍👧');
    await expect(num(page, 'chars')).toHaveText('1');
  });

  test('選択範囲があるときだけ「選択中 n 字」が出る', async ({ page }) => {
    await open(page);
    await type(page, 'あいうえお');
    await expect(page.locator('#selection')).toBeHidden();
    await page.locator('#text').evaluate((el) => el.setSelectionRange(1, 4));
    await expect(page.locator('#selection')).toBeVisible();
    await expect(page.locator('#n-selection')).toHaveText('3');
  });

  test('上限: あと n 字 / n 字オーバー（文字と枠で示す）。設定は残り、本文は残らない', async ({ page }) => {
    await open(page);
    await page.locator('#limit').fill('10');
    await type(page, 'あ'.repeat(7));
    await expect(page.locator('#limit-status')).toHaveText('✓ あと 3 字');
    await type(page, 'あ'.repeat(12));
    await expect(page.locator('#limit-status')).toHaveText('⚠ 2 字オーバー');
    await expect(page.locator('#limit-status')).toHaveAttribute('data-state', 'over');
    expect(await page.locator('#limit-status').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
    // 基準を変える（改行を除く）
    await type(page, 'あ\n'.repeat(6));
    await page.locator('#basis').selectOption('noNewline');
    await expect(page.locator('#limit-status')).toHaveText('✓ あと 4 字');

    await page.reload();
    await page.locator('html[data-ready="true"]').waitFor();
    await expect(page.locator('#limit')).toHaveValue('10');
    await expect(page.locator('#basis')).toHaveValue('noNewline');
    await expect(page.locator('#text')).toHaveValue(''); // 本文は保存しない
    const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    expect(stored).not.toContain('あ');
    expect(stored).toContain('moji-counter:settings');
  });

  test('上限に不正な値を入れると、エラーとして表示する', async ({ page }) => {
    await open(page);
    await page.locator('#limit').fill('abc');
    await expect(page.locator('#limit')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#limit-status')).toContainText('⚠');
  });

  test('詳しい集計: 字種・X 換算・原稿用紙。開閉は保存される', async ({ page }) => {
    await open(page);
    await type(page, 'ひらカナ漢字ABC123😀、');
    await page.locator('#details summary').click();
    await expect(page.locator('[data-k="kinds.hiragana"]')).toHaveText('2');
    await expect(page.locator('[data-k="kinds.katakana"]')).toHaveText('2');
    await expect(page.locator('[data-k="kinds.kanji"]')).toHaveText('2');
    await expect(page.locator('[data-k="kinds.latin"]')).toHaveText('3');
    await expect(page.locator('[data-k="kinds.digit"]')).toHaveText('3');
    await expect(page.locator('[data-k="kinds.emoji"]')).toHaveText('1');
    await expect(page.locator('[data-k="kinds.other"]')).toHaveText('1');
    // X: 日本語 6字×2 + ABC123 6 + 絵文字 2 + 、2 = 22
    await expect(page.locator('#x-count')).toHaveText('22 / 280');
    await expect(page.locator('#g-sheets')).toHaveText('1 枚（1 行）');
    await page.reload();
    await page.locator('html[data-ready="true"]').waitFor();
    await expect(page.locator('#details')).toHaveJSProperty('open', true);
  });

  test('コピー: 入力欄の内容がクリップボードに入り、通知される', async ({ page }) => {
    await open(page);
    await type(page, 'コピーする文章');
    await page.locator('#btn-copy').click();
    await expect(page.locator('#toast')).toContainText('コピーしました');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('コピーする文章');
  });

  test('クリア → 元に戻す', async ({ page }) => {
    await open(page);
    await type(page, '消える文章');
    await page.locator('#btn-clear').click();
    await expect(page.locator('#text')).toHaveValue('');
    await expect(num(page, 'chars')).toHaveText('0');
    await page.locator('#toast-action').click();
    await expect(page.locator('#text')).toHaveValue('消える文章');
    await expect(num(page, 'chars')).toHaveText('5');
  });

  test('TXT 読み込み: UTF-8', async ({ page }) => {
    await open(page);
    await page.locator('#file').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('吾輩は猫である。\n名前はまだ無い。', 'utf8') });
    await expect(page.locator('#text')).toHaveValue('吾輩は猫である。\n名前はまだ無い。');
    await expect(page.locator('#file-status')).toContainText('UTF-8');
    await expect(num(page, 'chars')).toHaveText('17');
  });

  test('TXT 読み込み: Shift_JIS', async ({ page }) => {
    await open(page);
    await page.locator('#file').setInputFiles({ name: 'sjis.txt', mimeType: 'text/plain', buffer: SJIS });
    await expect(page.locator('#text')).toHaveValue('あいう日本語');
    await expect(page.locator('#file-status')).toContainText('Shift_JIS');
  });

  test('TXT 読み込み失敗は「0字」にせず、失敗として表示し、入力欄は変えない', async ({ page }) => {
    await open(page);
    await type(page, '元の文章');
    await page.locator('#file').setInputFiles({ name: 'broken.txt', mimeType: 'text/plain', buffer: Buffer.from([0x81, 0x20, 0xff, 0xff]) });
    await expect(page.locator('#file-status')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#file-status')).toContainText('読み込めませんでした');
    await expect(page.locator('#text')).toHaveValue('元の文章');
    await expect(num(page, 'chars')).toHaveText('4');
  });

  test('.doc（旧形式）は失敗として案内する', async ({ page }) => {
    await open(page);
    await page.locator('#file').setInputFiles({ name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('x') });
    await expect(page.locator('#file-status')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#file-status')).toContainText('.docx');
  });

  test('DOCX 読み込み: 段落区切りが改行1つになる（mammoth は選択時だけ読み込む）', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await open(page);
    expect(requests.some((u) => u.includes('mammoth'))).toBe(false); // 初期表示では読み込まない
    await page.locator('#file').setInputFiles(FIXTURE_DOCX);
    await expect(page.locator('#file-status')).toContainText('Word から本文を抽出', { timeout: 20000 });
    expect(requests.some((u) => u.includes('mammoth@1.13.0'))).toBe(true);
    const value = await page.locator('#text').inputValue();
    // 段落3つ+空の段落1つ → 改行は3つ（空行は1つ。末尾に余分な改行を付けない）
    expect(value).toBe('吾輩は猫である。\n名前はまだ無い。\n\nどこで生れたか');
    await expect(num(page, 'chars')).toHaveText('26');
  });

  test('DOCX: 部品を取得できないときは失敗として表示する', async ({ page }) => {
    await page.route('**/mammoth*', (route) => route.abort());
    await open(page);
    await type(page, '元の文章');
    await page.locator('#file').setInputFiles(FIXTURE_DOCX);
    await expect(page.locator('#file-status')).toHaveAttribute('data-state', 'error', { timeout: 20000 });
    await expect(page.locator('#file-status')).toContainText('部品');
    await expect(page.locator('#text')).toHaveValue('元の文章');
  });

  test('キーボードだけで操作できる（Tab 順・Enter・フォーカス枠）', async ({ page }) => {
    await open(page);
    await page.locator('#text').focus();
    await page.keyboard.type('キーボード');
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-copy')).toBeFocused();
    const outline = await page.locator('#btn-copy').evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outline).toBe('3px');
    await page.keyboard.press('Enter');
    await expect(page.locator('#toast')).toContainText('コピーしました');
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-clear')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-open')).toBeFocused();
  });

  test('ダーク表示: OS 設定に追従し、トークンが切り替わる', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(28, 27, 25)');
    // アクセント色はコピーボタンだけ
    expect(await page.locator('#btn-copy').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(242, 140, 6)');
    expect(await page.locator('#btn-clear').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(242, 140, 6)');
  });

  test('PC は 2 カラム: 右の結果パネルがスクロールしても見える', async ({ page }) => {
    await open(page);
    const e = await page.locator('.editor').boundingBox();
    const s = await page.locator('.summary').boundingBox();
    expect(s.x).toBeGreaterThan(e.x + e.width - 1);
  });

  test('10 万字でも固まらず集計される', async ({ page }) => {
    await open(page);
    await page.locator('#text').evaluate((el) => { el.value = 'あいうえお'.repeat(20000); el.dispatchEvent(new Event('input')); });
    await expect(num(page, 'chars')).toHaveText('100,000');
  });
});

test.describe('スマホ 390×844（タッチ）', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('結果バーが入力欄より上にあり、ページをスクロールしても見え続ける', async ({ page }) => {
    await open(page);
    const summary = page.locator('.summary');
    const textarea = page.locator('#text');
    expect((await summary.boundingBox()).y).toBeLessThan((await textarea.boundingBox()).y);
    await page.locator('#details summary').tap(); // ページを長くする
    await type(page, 'あ'.repeat(30));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const box = await summary.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeLessThan(2);
    await expect(summary.locator('#n-chars')).toBeVisible();
    await expect(summary.locator('#n-chars')).toHaveText('30');
  });

  test('主要操作のタップ領域は 44px 以上', async ({ page }) => {
    await open(page);
    for (const sel of ['#btn-copy', '#btn-clear', '#btn-open', '#limit', '#basis', '#details summary', '.brand-link', '.site-footer a']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.height, `${sel} height`).toBeGreaterThanOrEqual(43.5);
      expect(box.width, `${sel} width`).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('13px 未満の文字を使っていない', async ({ page }) => {
    await open(page);
    await page.locator('#details summary').tap();
    await type(page, 'あ');
    const tooSmall = await page.evaluate(() => {
      const bad = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 13) bad.push(`${el.tagName}.${el.className}: ${fs}`);
      }
      return bad;
    });
    expect(tooSmall).toEqual([]);
  });
});

for (const width of [320, 390, 768, 1024]) {
  test(`幅${width}px: 横スクロールが出ない（詳しい集計を開いた状態・長い文字列・文字200%）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await page.locator('#details summary').click();
    await type(page, 'A'.repeat(300) + '\n' + 'あ'.repeat(300));
    await page.locator('#limit').fill('10');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expect(page.locator('#btn-copy')).toBeVisible();
  });
}
