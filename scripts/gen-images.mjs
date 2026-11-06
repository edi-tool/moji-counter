// 【使わない】2026-11-06 から、ファビコンと ogp.png はハブ（edi-tool.github.io）の scripts/ogp/favicon.js・gen.js で全ツール共通に作る。
// 実行すると古い形で上書きするため、作り直すときはハブ側を使うこと。以下は旧スクリプト（記録として残す）。
// favicon.png / favicon.ico / ogp.png を生成する開発用スクリプト（本体の依存には含めない）。
// 使い方: cd tests/e2e && npm ci && cd ../.. && node scripts/gen-images.mjs
// 見た目はハブ（edi-tool.github.io）の scripts/ogp/gen.js のカード（生成り地・白カード・左のオレンジ帯・アイコン）に合わせる。
// フォントは外部フォントを使わず、実行環境の日本語システムフォントで描く（ハブの ogp は Noto Sans JP を同梱して描画）。
// 最終版のハブ共通画像にそろえる場合は、ハブ側 gen.js の TOOLS に追記して生成し直す。
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../tests/e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const out = (f) => fileURLToPath(new URL(`../${f}`, import.meta.url));

// 「type」系の線画アイコン（文字を表す）。ハブのアイコンと同じ 24x24・線幅2・丸端
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>';
const FONT = '"Noto Sans JP","Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif';

const ogpHtml = `<style>
* { box-sizing: border-box; }
body { margin: 0; width: 1200px; height: 630px; background: #f5f5f7; font-family: ${FONT}; color: #0f0f0f; }
.card { position: absolute; inset: 48px; background: #fff; border: 2px solid #e5e5ea; border-radius: 32px; padding: 64px 72px; overflow: hidden; }
.bar { position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: #ff6a00; }
.brand { font-size: 30px; font-weight: 700; color: #52525b; }
.row { display: flex; align-items: center; gap: 36px; margin-top: 40px; }
.icon { width: 132px; height: 132px; border-radius: 32px; background: #f0f0f3; color: #ff6a00; display: flex; align-items: center; justify-content: center; flex: none; }
.icon svg { width: 76px; height: 76px; }
.name { font-size: 84px; font-weight: 700; line-height: 1.15; }
.tag { font-size: 38px; color: #444; margin-top: 12px; }
.chips { position: absolute; left: 72px; bottom: 60px; display: flex; gap: 16px; }
.chip { font-size: 26px; font-weight: 700; color: #3f3f46; background: #f0f0f3; border: 2px solid #e5e5ea; border-radius: 999px; padding: 8px 24px; }
</style>
<div class="card"><div class="bar"></div>
  <div class="brand">edi-tool</div>
  <div class="row"><div class="icon">${ICON}</div>
    <div><div class="name">文字数集計さん</div><div class="tag">貼るだけで、文字数がすぐ分かる</div></div></div>
  <div class="chips"><span class="chip">改行・空白を除く</span><span class="chip">絵文字も1文字</span><span class="chip">ブラウザ完結</span></div></div>`;

const faviconHtml = (px) => `<style>
* { margin: 0; } body { width: ${px}px; height: ${px}px; background: transparent; }
.i { width: ${px}px; height: ${px}px; border-radius: ${px * 0.22}px; background: #ff6a00; color: #0a0a0a; display: flex; align-items: center; justify-content: center; }
.i svg { width: ${px * 0.6}px; height: ${px * 0.6}px; }
</style><div class="i">${ICON.replace('stroke-width="2"', 'stroke-width="2.4"')}</div>`;

/** PNG を 1 枚だけ含む ICO（Vista 以降・各ブラウザで利用可） */
function pngToIco(png, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // ICONDIR
  head.writeUInt8(size, 6); head.writeUInt8(size, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}

const browser = await chromium.launch({ channel: 'chrome' });
const shoot = async (html, w, h, omitBackground = false) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png', omitBackground });
  await page.close();
  return buf;
};
writeFileSync(out('ogp.png'), await shoot(ogpHtml, 1200, 630));
writeFileSync(out('favicon.png'), await shoot(faviconHtml(192), 192, 192, true));
writeFileSync(out('favicon.ico'), pngToIco(await shoot(faviconHtml(48), 48, 48, true), 48));
await browser.close();
console.log('ogp.png / favicon.png / favicon.ico を出力しました');
