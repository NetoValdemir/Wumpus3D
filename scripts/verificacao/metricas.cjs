// Métricas de código limpo (refatoração, D21): tamanho de funções, complexidade ciclomática, aninhamento
// e duplicações conhecidas, em src/ e scripts/. Precisa da API JavaScript do TypeScript 5 (o projeto usa o
// TypeScript 7, que não tem essa API):
//   npm i --prefix /tmp/ts5 typescript@5.6.3
//   NODE_PATH=/tmp/ts5/node_modules node scripts/verificacao/metricas.cjs . > depois.json
//   (para comparar com outra versão: git worktree add /tmp/antes <commit> e rode com /tmp/antes)
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } };
for (const d of ['src', 'scripts']) walk(path.join(root, d));
const fns = [];
const perFile = {};
let total = 0, code = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const rel = path.relative(root, f);
  const lines = text.split('\n');
  const codeLines = lines.filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).length;
  total += lines.length; code += codeLines;
  perFile[rel] = { lines: lines.length - (text.endsWith('\n') ? 1 : 0), code: codeLines };
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  const visit = (node, depthName) => {
    const isFn = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessor(node);
    if (isFn && node.body) {
      const start = sf.getLineAndCharacterOfPosition(node.getStart()).line;
      const end = sf.getLineAndCharacterOfPosition(node.end).line;
      let cc = 1, maxNest = 0;
      const walkC = (n, nest) => {
        if (n !== node && (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n))) return;
        let inc = 0;
        if (ts.isIfStatement(n) || ts.isConditionalExpression(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isCaseClause(n) || ts.isCatchClause(n)) inc = 1;
        if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) cc++;
        cc += inc;
        const blocky = ts.isIfStatement(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isWhileStatement(n) || ts.isSwitchStatement(n) || ts.isTryStatement(n);
        const nn = blocky ? nest + 1 : nest;
        maxNest = Math.max(maxNest, nn);
        ts.forEachChild(n, (c) => walkC(c, nn));
      };
      walkC(node, 0);
      let name = node.name ? node.name.getText() : ts.isConstructorDeclaration(node) ? 'constructor' : '';
      if (!name && node.parent && ts.isVariableDeclaration(node.parent)) name = node.parent.name.getText();
      if (!name && node.parent && ts.isPropertyAssignment(node.parent)) name = node.parent.name.getText();
      fns.push({ file: rel, name: name || '(anônima)', lines: end - start + 1, cc, nest: maxNest, top: !!name });
    }
    ts.forEachChild(node, (c) => visit(c));
  };
  visit(sf);
}
const named = fns.filter((f) => f.top);
const pct = (a) => [...a].sort((x, y) => x - y);
const median = (a) => { const s = pct(a); return s.length ? s[Math.floor(s.length / 2)] : 0; };
// Duplicações: definições de helpers repetidas
const dupPatterns = { '$ (querySelector)': /const \$ = </g, 'esc (escape HTML)': /const esc = \(s: string\) =>/g, 'pct/num locais': /const (pct|num) = \(v: number/g, 'k.split(\',\').map(Number)': /split\(','\)\.map\(Number\)/g, 'createObjectURL de download': /createObjectURL\(new Blob\(\[(json|text)\]/g, 'clipboard.writeText': /clipboard\.writeText/g, 'dataset.confirm manual': /dataset\.confirm = '1'/g, 'laço createAgent+step (partida offline)': /while \(!world\.gameOver\) world\.step\(agent\.decide/g, 'try/catch localStorage': /localStorage\.(setItem|getItem)/g };
const dups = {};
for (const [k, re] of Object.entries(dupPatterns)) dups[k] = files.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(re) || []).length, 0);
const result = {
  files: files.length, totalLines: total, codeLines: code, perFile,
  functions: named.length,
  over30: named.filter((f) => f.lines > 30).map((f) => `${f.file}:${f.name} (${f.lines})`),
  over20: named.filter((f) => f.lines > 20).length,
  maxLines: named.reduce((m, f) => (f.lines > m.lines ? f : m), { lines: 0 }),
  medianLines: median(named.map((f) => f.lines)),
  avgLines: +(named.reduce((s, f) => s + f.lines, 0) / named.length).toFixed(1),
  ccOver10: named.filter((f) => f.cc > 10).map((f) => `${f.file}:${f.name} (cc ${f.cc})`),
  maxCC: named.reduce((m, f) => (f.cc > m.cc ? f : m), { cc: 0 }),
  avgCC: +(named.reduce((s, f) => s + f.cc, 0) / named.length).toFixed(2),
  nest3: named.filter((f) => f.nest >= 3).length,
  dups,
  top10: [...named].sort((a, b) => b.lines - a.lines).slice(0, 10).map((f) => `${f.file}:${f.name} ${f.lines}l cc${f.cc}`),
};
console.log(JSON.stringify(result, null, 1));
