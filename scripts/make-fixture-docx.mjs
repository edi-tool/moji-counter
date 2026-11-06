// E2E 用の小さな見本 docx（tests/fixtures/sample.docx）を作る。依存なし（zlib のみ）。
// 本文: 「吾輩は猫である。」「名前はまだ無い。」「（空の段落）」「どこで生れたか」の4段落 → 抽出後の期待値は改行3つ・書記素 8+8+0+7=23 + 改行3 = 26
import { deflateRawSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const files = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + ['吾輩は猫である。', '名前はまだ無い。', '', 'どこで生れたか'].map((t) => (t ? `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>` : '<w:p/>')).join('')
    + '</w:body></w:document>',
};

const parts = [], central = [];
let offset = 0;
for (const [name, content] of Object.entries(files)) {
  const nameBuf = Buffer.from(name), data = Buffer.from(content), comp = deflateRawSync(data), crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0x00210000, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  parts.push(local, nameBuf, comp);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(0x00210000, 12); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
  central.push(cd, nameBuf);
  offset += local.length + nameBuf.length + comp.length;
}
const cdBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
const outUrl = new URL('../tests/fixtures/sample.docx', import.meta.url);
mkdirSync(new URL('./', outUrl), { recursive: true });
writeFileSync(fileURLToPath(outUrl), Buffer.concat([...parts, cdBuf, end]));
console.log('tests/fixtures/sample.docx を出力しました');
