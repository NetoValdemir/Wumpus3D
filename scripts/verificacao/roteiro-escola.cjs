// Teste de ponta a ponta do modo escola (escola.html): professor monta o plano → aluno abre pelo código →
// Detetive (dica, caderno, conferência) → Blocos (arrastar bloco do Blockly, vitória, erro de laço, missão
// com 3 cavernas) → Criador → registro baixado → relatório da turma (HTML/CSV) → telas de celular.
// Imprime cada etapa e os erros do console. Usa o gancho window.escola (blocks-screen.ts).
//   npm run build && npm run preview -- --port 4173
//   node roteiro-escola.cjs http://localhost:4173/ /pasta/para/capturas
const { chromium } = require('playwright');
const fs = require('fs');
const [, , base, shots] = process.argv;
const log = [];
const step = (t) => { log.push(t); console.log('•', t); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: `${shots}/${n}.png` });
  const text = (s) => page.textContent(s);

  await page.goto(base + 'escola.html');
  await page.waitForTimeout(500);
  await shot('01-inicio');
  step('início carregou');

  // Professor: plano de exemplo + atividade com caverna criada depois
  await page.click('nav [data-tab="professor"]');
  await shot('02-professor-planejar');
  const code = await page.inputValue('#pl-code');
  step(`código do plano gerado (${code.slice(0, 12)}…, ${code.length} caracteres)`);

  // Aluno abre o plano pelo código
  await page.click('nav [data-tab="inicio"]');
  await page.fill('#student-name', 'Ana B.');
  await page.dispatchEvent('#student-name', 'change');
  await page.fill('#plan-code', code);
  await page.click('#plan-load');
  step('plano aberto: ' + (await text('#plan-title')) + ' / ' + (await page.locator('#plan-activities li').count()) + ' atividades');
  await shot('03-aluno-plano');

  // Atividade 1: Detetive
  await page.click('#plan-activities li:nth-child(1) button');
  await page.waitForSelector('#tab-detetive:not([hidden])');
  step('Detetive aberto: ' + (await text('#det-title')) + ' | sente: ' + (await text('#det-senses')));
  await page.click('#det-hint');
  step('dica: ' + (await text('#det-helper')));
  // anota a sala (2,1) como segura, se não for a dica... toca duas vezes numa sala desconhecida
  await page.click('#det-board [data-cell="0,1"]');
  await page.click('#det-board [data-cell="1,0"]');
  await page.click('#det-board [data-cell="1,0"]');
  await page.click('#det-check');
  step('conferência: ' + (await text('#det-helper')));
  await shot('04-detetive-caderno');
  // joga até acabar: anda para a frente (pode cair ou não)
  for (let i = 0; i < 60 && !(await page.isVisible('#det-end')); i++) {
    await page.keyboard.press(['ArrowUp', 'ArrowUp', 'KeyA', 'ArrowUp', 'KeyG', 'KeyD'][i % 6]);
  }
  step('fim do Detetive: ' + (await text('#det-end-title')) + ' ' + (await text('#det-end-feedback')));
  await shot('05-detetive-fim');
  await page.click('#det-back');

  // Atividade 2: Blocos (missão 1) com a solução carregada pelo gancho de teste
  await page.click('#plan-activities li:nth-child(2) button');
  await page.waitForSelector('#editor:not([hidden])');
  await page.waitForTimeout(300);
  // arrasta um bloco de verdade da caixa de ferramentas
  await page.locator('.blocklyToolboxCategory', { hasText: 'Ações' }).click({ force: true });
  await page.waitForTimeout(300);
  const fly = page.locator('.blocklyFlyout .blocklyDraggable').first();
  const box = await fly.boundingBox();
  const start = await page.locator('.blocklyBlockCanvas .blocklyDraggable').first().boundingBox();
  await page.mouse.move(box.x + 12, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 55, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  step('arrastar bloco: ' + (await text('#blk-count')));
  const F = (id, next) => ({ type: 'wumpus_forward', id, ...(next ? { next: { block: next } } : {}) });
  const chain = (types) => types.reduceRight((acc, t, i) => ({ type: t, id: 'x' + i, ...(acc ? { next: { block: acc } } : {}) }), null);
  await page.evaluate((c) => window.escola.loadProgram({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 20, y: 20, inputs: { DO: { block: c } } }] } }), chain(['wumpus_forward', 'wumpus_forward', 'wumpus_grab', 'wumpus_left', 'wumpus_left', 'wumpus_forward', 'wumpus_forward']));
  await page.waitForTimeout(200);
  step('programa carregado: ' + (await text('#blk-count')));
  await page.fill('#blk-speed', '10');
  await page.click('#blk-step');
  await page.click('#blk-step');
  await shot('06-blocos-passo');
  await page.click('#blk-reset');
  await page.click('#blk-run');
  await page.waitForFunction(() => /Vitória|caiu|pegou|terminou|🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 30000 });
  step('execução: ' + (await text('#blk-msg')) + ' | melhor: ' + (await text('#blk-best')));
  await shot('07-blocos-vitoria');
  // tentativa com erro: laço sem fim
  await page.evaluate(() => window.escola.loadProgram({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 20, y: 20, inputs: { DO: { block: { type: 'wumpus_until', id: 'u', inputs: { COND: { block: { type: 'wumpus_sense', id: 'c', fields: { WHAT: 'glitter' } } } } } } } }] } }));
  await page.click('#blk-run');
  await page.waitForFunction(() => /🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 10000 });
  step('erro mostrado: ' + (await text('#blk-msg')));
  await shot('08-blocos-erro');

  // Missões livres
  await page.click('#blk-back');
  step('missões: ' + (await page.locator('#mission-list li').count()) + ' | 1ª: ' + (await text('#mission-list li:nth-child(1)')));
  await shot('09-missoes');
  // missão 5 (várias cavernas)
  await page.click('#mission-list li:nth-child(5) button');
  await page.evaluate(() => window.escola.loadProgram({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 20, y: 20, inputs: { DO: { block: {
    type: 'wumpus_until', id: 'u1', inputs: { COND: { block: { type: 'wumpus_sense', id: 'c1', fields: { WHAT: 'glitter' } } }, DO: { block: { type: 'wumpus_forward', id: 'f1' } } },
    next: { block: { type: 'wumpus_grab', id: 'g', next: { block: { type: 'wumpus_left', id: 'l1', next: { block: { type: 'wumpus_left', id: 'l2', next: { block: {
      type: 'wumpus_until', id: 'u2', inputs: { COND: { block: { type: 'wumpus_at_entrance', id: 'c2' } }, DO: { block: { type: 'wumpus_forward', id: 'f2' } } } } } } } } } } } } } } }] } }));
  await page.click('#blk-run');
  await page.waitForFunction(() => /Vitória|caiu|pegou|terminou|🐞/.test(document.getElementById('blk-msg').textContent) && !/Testando/.test(document.getElementById('blk-msg').textContent), null, { timeout: 60000 });
  step('missão 5: ' + (await text('#blk-msg')));
  await shot('10-missao5');

  // Criador
  await page.click('nav [data-tab="criador"]');
  await page.fill('#cr-name', 'Caverna da Ana');
  await page.dispatchEvent('#cr-name', 'input');
  await page.check('input[name="tool"][value="poco"]');
  await page.click('#cr-board [data-cell="2,0"]');
  await page.click('#cr-board [data-cell="0,2"]');
  await page.check('input[name="tool"][value="wumpus"]');
  await page.click('#cr-board [data-cell="3,3"]');
  step('problemas: ' + (await text('#cr-problems')));
  await page.check('input[name="tool"][value="ouro"]');
  await page.click('#cr-board [data-cell="2,2"]');
  step('pronta: ' + (await text('#cr-problems')) + ' | código ' + (await page.inputValue('#cr-code')).slice(0, 10));
  await page.click('#cr-save');
  await shot('11-criador');
  const caveCode = await page.inputValue('#cr-code');
  await page.click('#cr-play-det');
  step('criador → detetive: ' + (await text('#det-title')));

  // Professor: adiciona a caverna criada e gera novo código
  await page.click('nav [data-tab="professor"]');
  await page.selectOption('#ac-kind', 'blocos');
  await page.selectOption('#ac-source', 'codigo');
  await page.fill('#ac-code', caveCode);
  await page.click('#ac-add');
  step('atividade adicionada: ' + (await text('#ac-msg')) + ' | total ' + (await page.locator('#pl-activities li').count()));

  // Aluno baixa o registro
  await page.click('nav [data-tab="inicio"]');
  step('status das atividades: ' + (await page.locator('#plan-activities .status').allTextContents()).join(' | '));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#record-download')]);
  const recPath = `${shots}/registro.json`;
  await dl.saveAs(recPath);
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  step(`registro baixado: ${dl.suggestedFilename()} com ${rec.attempts.length} tentativas`);
  // segundo aluno (simulado): mesmo arquivo com outro nome
  fs.writeFileSync(`${shots}/registro2.json`, JSON.stringify({ ...rec, student: 'Bruno', attempts: rec.attempts.slice(0, 1) }));

  // Professor: relatório
  await page.click('nav [data-tab="professor"]');
  await page.click('[data-sub="relatorio"]');
  await page.setInputFiles('#rp-files', [recPath, `${shots}/registro2.json`]);
  await page.waitForTimeout(500);
  step('relatório: ' + (await text('#rp-msg')));
  const frame = page.frameLocator('#rp-view');
  step('tabela do relatório: ' + (await frame.locator('table').first().innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await shot('12-relatorio');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#rp-csv')]);
  await csv.saveAs(`${shots}/turma.csv`);
  const [html] = await Promise.all([page.waitForEvent('download'), page.click('#rp-html')]);
  await html.saveAs(`${shots}/turma.html`);
  step('CSV linhas: ' + fs.readFileSync(`${shots}/turma.csv`, 'utf8').trim().split('\n').length);

  // Celular
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [tab, name] of [['inicio', '13-cel-inicio'], ['detetive', '14-cel-detetive'], ['blocos', '15-cel-blocos'], ['criador', '16-cel-criador']]) {
    await page.click(`nav [data-tab="${tab}"]`);
    await page.waitForTimeout(300);
    await shot(name);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    step(`celular ${tab}: rolagem horizontal = ${over}`);
  }
  step('erros no console: ' + JSON.stringify(errors));
  fs.writeFileSync(`${shots}/log.txt`, log.join('\n'));
  await browser.close();
})().catch((e) => { console.error('FALHOU', e.message); process.exit(1); });
