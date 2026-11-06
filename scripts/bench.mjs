// 長文ベンチ（CI 非必須）。使い方: node scripts/bench.mjs
// 10万字の集計が 30ms を超える場合に限り Web Worker 化を検討する（DESIGN.md 参照）。
import { countText, xCount } from '../src/count.js';

const unit = '吾輩は猫である。名前はまだ無い。Hello 123 😀 ガ\n';
const make = (n) => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

for (const [label, n, runs] of [['10万字', 100_000, 15], ['100万字', 1_000_000, 5]]) {
  const text = make(n);
  countText(make(1000)); // ウォームアップ
  const times = [], xTimes = [];
  for (let i = 0; i < runs; i++) {
    let t = performance.now();
    countText(text);
    times.push(performance.now() - t);
    t = performance.now();
    xCount(text);
    xTimes.push(performance.now() - t);
  }
  console.log(`${label}: countText 中央値 ${median(times).toFixed(1)}ms（最小 ${Math.min(...times).toFixed(1)} / 最大 ${Math.max(...times).toFixed(1)}）, xCount 中央値 ${median(xTimes).toFixed(1)}ms（${runs}回）`);
}
console.log(`Node ${process.version}`);
