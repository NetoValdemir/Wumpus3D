// Capturas de tela do modo escola, usadas no manual (manual-escola.py). Rode com o site em http://localhost:4173
// (npm run build && npm run preview -- --port 4173):
//   node capturas-escola.cjs img
// Percorre o fluxo real: professor cria acesso, turma e plano; aluno entra com PIN; telas de cada área.
// Os PINs são sorteados, então mudam a cada execução; o resto sai igual.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const out = process.argv[2];
const BASE = 'http://localhost:4173/';

const start = (chain) => ({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 24, y: 24, inputs: { DO: { block: chain } } }] } });
const seq = (...list) => list.reduceRight((next, b) => ({ ...b, ...(next ? { next: { block: next } } : {}) }), null);
let n = 0;
const b = (type, extra = {}) => ({ type, id: `${type}-${n++}`, ...extra });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage();
  const shot = (name) => p.screenshot({ path: path.join(out, `escola-${name}.png`) });
  const top = () => p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });

  // Tela inicial e acesso do professor
  await p.goto(`${BASE}escola.html`);
  await shot('login');
  await p.fill('#pf-new-name', 'Profa. Lúcia');
  await p.fill('#pf-new-user', 'lucia');
  await p.fill('#pf-new-pass', 'cavernas2026');
  await p.fill('#pf-new-pass2', 'cavernas2026');
  await p.click('#pf-create-btn');
  await p.waitForURL(/professor\.html/);

  // Plano: exemplo + lição da trilha + Arena da turma
  await p.click('nav [data-tab="planejar"]');
  await p.click('#pl-sample');
  await p.fill('#pl-group', '7º ano B');
  await p.dispatchEvent('#pl-group', 'input');
  await p.selectOption('#ac-kind', 'trilha');
  await p.selectOption('#ac-lesson', 'ia2');
  await p.click('#ac-add');
  await p.selectOption('#ac-kind', 'agente');
  await p.fill('#ac-seed', 'turma7b');
  await p.click('#ac-add');
  await top();
  await shot('professor');

  // Turma com alunos e código
  await p.click('nav [data-tab="turmas"]');
  await p.fill('#tm-new-name', '7º ano B');
  await p.click('#tm-new');
  await p.fill('#tm-names', 'Ana B.\nBruno C.\nCarla D.\nDavi E.');
  await p.click('#tm-add');
  await p.click('#tm-use-plan');
  await p.click('#tm-generate');
  await p.waitForFunction(() => document.getElementById('tm-code').value.startsWith('TURMA1-'));
  const code = await p.inputValue('#tm-code');
  const pins = await p.$$eval('#tm-students tr', (rows) => Object.fromEntries(rows.map((r) => [r.cells[0].textContent, r.cells[1].textContent])));
  await top();
  await shot('turmas');

  // Aluno entra
  await p.click('#logout');
  await p.waitForURL(/escola\.html/);
  await p.fill('#al-code', code);
  await p.click('#al-code-open');
  await p.selectOption('#al-name', 'Ana B.');
  await p.fill('#al-pin', pins['Ana B.']);
  await shot('login-aluno');
  await p.click('#al-enter');
  await p.waitForURL(/aluno\.html/);

  // Detetive com anotações e conferência
  await p.click('#plan-activities li:nth-child(1) button');
  await p.click('#det-board [data-cell="0,1"]');
  await p.keyboard.press('ArrowUp');
  await p.click('#det-board [data-cell="2,0"]');
  await p.click('#det-board [data-cell="2,0"]');
  await p.click('#det-board [data-cell="1,1"]');
  await p.click('#det-board [data-cell="1,1"]');
  await p.click('#det-check');
  await p.click('#det-hint');
  await shot('detetive');
  for (let i = 0; i < 40 && !(await p.isVisible('#det-end')); i++) await p.keyboard.press(['ArrowUp', 'KeyA', 'ArrowUp', 'ArrowUp', 'KeyD'][i % 5]);
  await p.waitForTimeout(250);
  await shot('detetive-fim');
  await p.click('#det-back');

  // Blocos: missão 1 vencida, depois a lista
  await p.click('#plan-activities li:nth-child(2) button');
  await p.waitForTimeout(300);
  await p.evaluate((j) => window.escola.loadProgram(j), start(seq(b('wumpus_forward'), b('wumpus_forward'), b('wumpus_grab'), b('wumpus_left'), b('wumpus_left'), b('wumpus_forward'), b('wumpus_forward'))));
  await p.fill('#blk-speed', '10');
  await p.click('#blk-run');
  await p.waitForFunction(() => /Vitória|🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 20000 });
  await p.click('#blk-back');
  await shot('missoes');
  await p.click('#mission-list li:nth-child(6) button');
  await p.waitForTimeout(300);
  const ifWall = (turn) => b('wumpus_ifelse', { inputs: { COND: { block: b('wumpus_wall_ahead') }, DO: { block: b(turn) }, ELSE: { block: b('wumpus_forward') } } });
  await p.evaluate(
    (j) => window.escola.loadProgram(j),
    start(seq(b('wumpus_until', { inputs: { COND: { block: b('wumpus_sense', { fields: { WHAT: 'glitter' } }) }, DO: { block: ifWall('wumpus_left') } } }), b('wumpus_grab'), b('wumpus_left'), b('wumpus_left'), b('wumpus_until', { inputs: { COND: { block: b('wumpus_at_entrance') }, DO: { block: ifWall('wumpus_right') } } }))),
  );
  for (let i = 0; i < 7; i++) await p.click('#blk-step');
  await shot('blocos');
  await p.evaluate((j) => window.escola.loadProgram(j), start(b('wumpus_until', { inputs: { COND: { block: b('wumpus_sense', { fields: { WHAT: 'glitter' } }) } } })));
  await p.click('#blk-run');
  await p.waitForFunction(() => /🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 10000 });
  await shot('blocos-erro');

  // Lição da trilha pelo plano (dedução) e o resto da trilha
  await p.click('nav [data-tab="inicio"]');
  await p.locator('#plan-activities li', { hasText: 'Trilha de IA' }).locator('button').click();
  await p.click('#ls-next');
  await p.click('.lesson-play svg [data-cell="1,1"]');
  await p.click('.lesson-play svg [data-cell="2,0"]');
  await shot('trilha-deducao');
  await p.click('#ls-next');
  for (const ans of ['(2, 2)', '(3, 1)', '(1, 3)']) {
    await p.locator('.options button', { hasText: ans }).first().click();
    if (ans === '(3, 1)') await shot('trilha-pergunta');
    await p.click('#ls-next');
  }
  await p.click('#ls-back');
  await shot('trilha');
  await p.locator('#module-list li').nth(2).locator('button').click();
  await p.click('#ls-next');
  await p.locator('.lesson-play svg [data-cell="2,0"]').click();
  await shot('trilha-combinacoes');
  await p.click('#ls-back');
  await p.locator('#module-list li').nth(3).locator('button').click();
  await p.click('#ls-next');
  await p.locator('.lesson-side button', { hasText: 'Próximo passo' }).click();
  await p.locator('.lesson-side button', { hasText: 'Próximo passo' }).click();
  await p.locator('.lesson-side button', { hasText: 'Próximo passo' }).click();
  await shot('trilha-busca');
  await p.click('#ls-back');
  await p.locator('#module-list li').nth(4).locator('button').click();
  await p.click('#ls-next');
  await p.locator('button', { hasText: 'Treinar com 1 caverna' }).click();
  await p.waitForFunction(() => document.querySelectorAll('#ls-body tbody tr').length >= 2, null, { timeout: 120000 });
  await p.locator('button', { hasText: 'Treinar com 40 cavernas' }).click();
  await p.waitForFunction(() => document.querySelectorAll('#ls-body tbody tr').length >= 3, null, { timeout: 180000 });
  await shot('trilha-genetico');

  // Agente para a Arena da turma
  await p.click('nav [data-tab="inicio"]');
  await p.locator('#plan-activities li', { hasText: 'Arena' }).locator('button').click();
  await p.waitForTimeout(300);
  await p.evaluate((j) => window.escola.loadProgram(j), start(seq(b('wumpus_until', { inputs: { COND: { block: b('wumpus_sense', { fields: { WHAT: 'glitter' } }) }, DO: { block: ifWall('wumpus_left') } } }), b('wumpus_grab'), b('wumpus_left'), b('wumpus_left'), b('wumpus_until', { inputs: { COND: { block: b('wumpus_at_entrance') }, DO: { block: ifWall('wumpus_right') } } }))));
  await p.click('#blk-run');
  await p.waitForFunction(() => /Vitória|caiu|pegou|terminou|🐞|tempo/.test(document.getElementById('blk-msg').textContent) && !/Testando/.test(document.getElementById('blk-msg').textContent), null, { timeout: 60000 });
  await p.click('nav [data-tab="inicio"]');
  await top();
  await shot('inicio');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#record-download')]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escola-'));
  const ana = path.join(tmp, 'ana.json');
  await dl.saveAs(ana);
  const rec = JSON.parse(fs.readFileSync(ana, 'utf8'));
  const bruno = path.join(tmp, 'bruno.json');
  fs.writeFileSync(bruno, JSON.stringify({ ...rec, student: 'Bruno C.', attempts: [{ ...rec.attempts.at(-1), program: { blocks: { blocks: [{ type: 'wumpus_start', id: 's', inputs: { DO: { block: { type: 'wumpus_forward', id: 'f' } } } }] } }, at: '2026-11-03T13:20:00Z' }] }));

  // Criador (área do aluno)
  await p.click('nav [data-tab="criador"]');
  await p.fill('#cr-name', 'Caverna da Ana');
  await p.dispatchEvent('#cr-name', 'input');
  for (const [tool, cells] of [['poco', ['2,0', '0,2', '3,1']], ['wumpus', ['1,3']], ['ouro', ['2,2']]]) {
    await p.check(`input[name="tool"][value="${tool}"]`);
    for (const c of cells) await p.click(`#cr-board [data-cell="${c}"]`);
  }
  await p.click('#cr-save');
  await shot('criador');

  // Professor: relatório e GitHub
  await p.click('#logout');
  await p.waitForURL(/escola\.html/);
  await p.fill('#pf-user', 'lucia');
  await p.fill('#pf-pass', 'cavernas2026');
  await p.click('#pf-enter');
  await p.waitForURL(/professor\.html/);
  await p.click('nav [data-tab="relatorio"]');
  await p.selectOption('#rp-plan-select', { index: 1 });
  await p.setInputFiles('#rp-files', [ana, bruno]);
  await p.waitForTimeout(600);
  await p.evaluate(() => window.scrollTo(0, 330));
  await shot('relatorio');
  await p.evaluate(() => document.getElementById('rp-view').contentWindow.document.querySelector('h2:nth-of-type(3)')?.scrollIntoView());
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('relatorio-arena');
  await p.click('nav [data-tab="github"]');
  await shot('github');

  // Celular
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#logout');
  await p.waitForURL(/escola\.html/);
  await p.selectOption('#al-name', 'Ana B.');
  await p.fill('#al-pin', pins['Ana B.']);
  await p.click('#al-enter');
  await p.waitForURL(/aluno\.html/);
  await p.click('nav [data-tab="detetive"]');
  await p.waitForTimeout(300);
  await shot('celular-detetive');
  await p.click('nav [data-tab="trilha"]');
  await p.locator('#module-list li').nth(1).locator('button').click();
  await p.click('#ls-next');
  await p.waitForTimeout(300);
  await shot('celular-trilha');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
