// Compara as saídas de roteiro-jogo.cjs de duas versões, ponto a ponto. Imprime as diferenças e o total.
//   node compara-roteiros.cjs antes.json depois.json
const [, , a, b] = process.argv;
const x = require(require('path').resolve(a));
const y = require(require('path').resolve(b));
let diffs = 0;
for (let i = 0; i < Math.max(x.length, y.length); i++) {
  const p = x[i] || {};
  const q = y[i] || {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) {
    const u = JSON.stringify(p[k]);
    const v = JSON.stringify(q[k]);
    if (u !== v && ++diffs <= 20) console.log(`#${i} ${p.label} · ${k}\n  antes:  ${u?.slice(0, 300)}\n  depois: ${v?.slice(0, 300)}`);
  }
}
console.log(`${x.length} e ${y.length} pontos de verificação; ${diffs} diferença(s).`);
process.exit(diffs ? 1 : 0);
