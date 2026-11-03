// Capturas de tela do modo escola, usadas no manual (manual-escola.py). Rode com o site em http://localhost:4173
// (npm run build && npm run preview -- --port 4173):
//   node capturas-escola.cjs img
// O plano de exemplo usa a caverna sorteada "aula1": as telas saem iguais a cada execução.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const BASE = 'http://localhost:4173/escola.html';

const start = (chain) => ({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 24, y: 24, inputs: { DO: { block: chain } } }] } });
const seq = (...list) => list.reduceRight((next, b) => ({ ...b, ...(next ? { next: { block: next } } : {}) }), null);
const b = (type, extra = {}) => ({ type, id: `${type}-${Math.random().toString(36).slice(2, 7)}`, ...extra });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage();
  const shot = (name) => p.screenshot({ path: path.join(out, `escola-${name}.png`) });

  // Professor: plano de exemplo
  await p.goto(`${BASE}#professor`);
  await p.click('#pl-sample');
  await p.fill('#pl-group', '7º ano B');
  await p.dispatchEvent('#pl-group', 'input');
  await p.fill('#pl-teacher', 'Profa. Lúcia');
  await p.dispatchEvent('#pl-teacher', 'input');
  await p.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await p.waitForTimeout(200);
  await shot('professor');
  const code = await p.inputValue('#pl-code');

  // Aluno abre o plano
  await p.click('nav [data-tab="inicio"]');
  await p.fill('#student-name', 'Ana B.');
  await p.dispatchEvent('#student-name', 'change');
  await p.fill('#plan-code', code);
  await p.click('#plan-load');

  // Detetive: alguns passos, anotações e conferência
  await p.click('#plan-activities li:nth-child(1) button');
  await p.waitForTimeout(200);
  await p.click('#det-board [data-cell="0,1"]'); // segura
  await p.keyboard.press('ArrowUp');
  await p.click('#det-board [data-cell="2,0"]');
  await p.click('#det-board [data-cell="2,0"]'); // poço?
  await p.click('#det-board [data-cell="1,1"]');
  await p.click('#det-board [data-cell="1,1"]'); // poço?
  await p.click('#det-check');
  await p.click('#det-hint');
  await p.waitForTimeout(250);
  await shot('detetive');
  for (let i = 0; i < 40 && !(await p.isVisible('#det-end')); i++) await p.keyboard.press(['ArrowUp', 'KeyA', 'ArrowUp', 'ArrowUp', 'KeyD'][i % 5]);
  await p.waitForTimeout(250);
  await shot('detetive-fim');
  await p.click('#det-back');

  // Blocos: atividade 2 (missão 1) vencida
  await p.click('#plan-activities li:nth-child(2) button');
  await p.waitForTimeout(300);
  await p.evaluate((j) => window.escola.loadProgram(j), start(seq(b('wumpus_forward'), b('wumpus_forward'), b('wumpus_grab'), b('wumpus_left'), b('wumpus_left'), b('wumpus_forward'), b('wumpus_forward'))));
  await p.fill('#blk-speed', '10');
  await p.click('#blk-run');
  await p.waitForFunction(() => /Vitória|🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 20000 });
  await p.click('#blk-back');
  await p.waitForTimeout(200);
  await shot('missoes');

  // Missão 6 (se/senão) no meio da execução, com o bloco atual destacado
  await p.click('#mission-list li:nth-child(6) button');
  await p.waitForTimeout(300);
  const ifWall = (turn) => b('wumpus_ifelse', { inputs: { COND: { block: b('wumpus_wall_ahead') }, DO: { block: b(turn) }, ELSE: { block: b('wumpus_forward') } } });
  await p.evaluate(
    (j) => window.escola.loadProgram(j),
    start(
      seq(
        b('wumpus_until', { inputs: { COND: { block: b('wumpus_sense', { fields: { WHAT: 'glitter' } }) }, DO: { block: ifWall('wumpus_left') } } }),
        b('wumpus_grab'),
        b('wumpus_left'),
        b('wumpus_left'),
        b('wumpus_until', { inputs: { COND: { block: b('wumpus_at_entrance') }, DO: { block: ifWall('wumpus_right') } } }),
      ),
    ),
  );
  for (let i = 0; i < 7; i++) await p.click('#blk-step');
  await p.waitForTimeout(200);
  await shot('blocos');
  // Erro: laço sem fim
  await p.evaluate((j) => window.escola.loadProgram(j), start(b('wumpus_until', { id: 'laco', inputs: { COND: { block: b('wumpus_sense', { fields: { WHAT: 'glitter' } }) } } })));
  await p.click('#blk-run');
  await p.waitForFunction(() => /🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 10000 });
  await shot('blocos-erro');

  // Criador
  await p.click('nav [data-tab="criador"]');
  await p.fill('#cr-name', 'Caverna da Ana');
  await p.dispatchEvent('#cr-name', 'input');
  for (const [tool, cells] of [['poco', ['2,0', '0,2', '3,1']], ['wumpus', ['1,3']], ['ouro', ['2,2']]]) {
    await p.check(`input[name="tool"][value="${tool}"]`);
    for (const c of cells) await p.click(`#cr-board [data-cell="${c}"]`);
  }
  await p.click('#cr-save');
  await p.waitForTimeout(200);
  await shot('criador');

  // Registro do aluno e relatório da turma (a Ana e um colega simulado)
  await p.click('nav [data-tab="inicio"]');
  await p.waitForTimeout(200);
  await shot('inicio');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#record-download')]);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'escola-'));
  const ana = path.join(tmp, 'ana.json');
  await dl.saveAs(ana);
  const rec = JSON.parse(fs.readFileSync(ana, 'utf8'));
  const bruno = path.join(tmp, 'bruno.json');
  fs.writeFileSync(bruno, JSON.stringify({ ...rec, student: 'Bruno C.', attempts: rec.attempts.slice(-1).map((a) => ({ ...a, stars: 1, at: '2026-11-03T13:20:00Z' })) }));
  await p.click('nav [data-tab="professor"]');
  await p.click('[data-sub="relatorio"]');
  await p.setInputFiles('#rp-files', [ana, bruno]);
  await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 230));
  await shot('relatorio');

  // Celular
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('nav [data-tab="detetive"]');
  await p.waitForTimeout(300);
  await shot('celular-detetive');
  await p.click('nav [data-tab="blocos"]');
  await p.click('#mission-list li:nth-child(1) button');
  await p.waitForTimeout(400);
  await shot('celular-blocos');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
