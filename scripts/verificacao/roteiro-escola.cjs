// Teste de ponta a ponta do modo escola (D22, D23): tela inicial → professor cria acesso, turma, plano (com
// lição da trilha e Arena) → aluno entra com código da turma + apelido + PIN → Detetive, Blocos, lição,
// agente → registro → professor entra de novo → relatório (lições, Arena) → GitHub (API simulada) →
// lições da trilha (combinações, busca, genético, Arena) → celular. Imprime cada etapa e os erros do console.
//   npm run build && npm run preview -- --port 4173
//   node roteiro-escola.cjs http://localhost:4173/ /pasta/para/capturas
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [, , base, shots] = process.argv;
const step = (t) => console.log('•', t);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const external = [];
  page.on('request', (r) => !r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && external.push(r.url()));

  // GitHub de mentira (só para este teste): guarda os arquivos em memória
  const files = new Map();
  let sha = 0;
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.headers()['authorization'] !== 'Bearer tk-teste') return route.fulfill({ status: 401, body: '{}' });
    if (url.endsWith('/repos/prof/turmas')) return route.fulfill({ json: { full_name: 'prof/turmas', private: true } });
    const p = decodeURIComponent(url.split('/contents/')[1] || '');
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      files.set(p, { content: body.content, sha: String(++sha) });
      return route.fulfill({ status: 201, json: {} });
    }
    if (files.has(p)) return route.fulfill({ json: files.get(p) });
    const kids = [...files.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'));
    return kids.length ? route.fulfill({ json: kids.map((k) => ({ name: k.slice(p.length + 1), type: 'file' })) }) : route.fulfill({ status: 404, body: '{}' });
  });

  const shot = (n) => shots && page.screenshot({ path: path.join(shots, `${n}.png`) });
  const text = (s) => page.textContent(s);

  // 1. Professor: primeiro acesso
  await page.goto(base + 'escola.html');
  await shot('01-login');
  await page.fill('#pf-new-name', 'Profa. Lúcia');
  await page.fill('#pf-new-user', 'lucia');
  await page.fill('#pf-new-pass', 'curta');
  await page.fill('#pf-new-pass2', 'curta');
  await page.click('#pf-create-btn');
  step('senha curta: ' + (await text('#pf-msg')));
  await page.fill('#pf-new-pass', 'cavernas2026');
  await page.fill('#pf-new-pass2', 'cavernas2026');
  await page.click('#pf-create-btn');
  await page.waitForURL(/professor\.html/);
  step('professor entrou: ' + (await text('#who')));

  // 2. Turma e plano
  await page.fill('#tm-new-name', '7º ano B');
  await page.click('#tm-new');
  await page.fill('#tm-names', 'Ana B.\nBruno C.\nana b.');
  await page.click('#tm-add');
  step('alunos: ' + (await text('#tm-msg')));
  const pins = await page.$$eval('#tm-students tr', (rows) => Object.fromEntries(rows.map((r) => [r.cells[0].textContent, r.cells[1].textContent])));
  await page.click('nav [data-tab="planejar"]');
  await page.click('#pl-sample');
  await page.selectOption('#ac-kind', 'trilha');
  await page.selectOption('#ac-lesson', 'ia2');
  await page.click('#ac-add');
  await page.selectOption('#ac-kind', 'agente');
  await page.fill('#ac-seed', 'turma7b');
  await page.click('#ac-add');
  step('plano: ' + (await page.locator('#pl-activities li').count()) + ' atividades');
  await page.click('nav [data-tab="turmas"]');
  await page.click('#tm-use-plan');
  await page.click('#tm-generate');
  await page.waitForFunction(() => document.getElementById('tm-code').value.startsWith('TURMA1-'));
  const code = await page.inputValue('#tm-code');
  step(`código da turma: ${code.length} caracteres; contém algum PIN? ${Object.values(pins).some((p) => code.includes(p))}`);
  await shot('02-turmas');

  // 3. Aluno entra
  await page.click('#logout');
  await page.waitForURL(/escola\.html/);
  await page.fill('#al-code', code);
  await page.click('#al-code-open');
  await page.selectOption('#al-name', 'Ana B.');
  const wrong = String((Number(pins['Ana B.']) + 1) % 10000).padStart(4, '0');
  await page.fill('#al-pin', wrong);
  await page.click('#al-enter');
  await page.waitForFunction(() => document.getElementById('al-msg').textContent.length > 0);
  step('PIN errado: ' + (await text('#al-msg')));
  await page.fill('#al-pin', pins['Ana B.']);
  await page.click('#al-enter');
  await page.waitForURL(/aluno\.html/);
  step('aluno entrou: ' + (await text('#who')) + ' | ' + (await text('#turma-info')) + ' | atividades: ' + (await page.locator('#plan-activities li').count()));
  await shot('03-aluno-inicio');
  // Visitante não pode abrir a área do professor
  const prof = await ctx.newPage();
  await prof.goto(base + 'professor.html');
  await prof.waitForURL(/escola\.html/);
  step('professor.html sem login volta para: ' + prof.url().split('/').pop());
  await prof.close();

  // 4. Atividades: Detetive, Blocos, lição, agente
  await page.click('#plan-activities li:nth-child(1) button');
  for (let i = 0; i < 30 && !(await page.isVisible('#det-end')); i++) await page.keyboard.press(['ArrowUp', 'KeyA', 'ArrowUp', 'KeyD'][i % 4]);
  step('detetive: ' + (await text('#det-end-title')));
  await page.click('#det-back');
  await page.click('#plan-activities li:nth-child(2) button');
  await page.waitForSelector('#editor:not([hidden])');
  const chain = (types) => types.reduceRight((acc, t, i) => ({ type: t, id: 'x' + i, ...(acc ? { next: { block: acc } } : {}) }), null);
  const prog = (types) => ({ blocks: { blocks: [{ type: 'wumpus_start', id: 's', x: 20, y: 20, inputs: { DO: { block: chain(types) } } }] } });
  await page.evaluate((p) => window.escola.loadProgram(p), prog(['wumpus_forward', 'wumpus_forward', 'wumpus_grab', 'wumpus_left', 'wumpus_left', 'wumpus_forward', 'wumpus_forward']));
  await page.fill('#blk-speed', '10');
  await page.click('#blk-run');
  await page.waitForFunction(() => /Vitória|🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 20000 });
  step('blocos: ' + (await text('#blk-msg')));
  await page.click('nav [data-tab="inicio"]');
  const lessonBtn = page.locator('#plan-activities li', { hasText: 'Trilha de IA' }).locator('button');
  await lessonBtn.click();
  await page.waitForSelector('#lesson:not([hidden])');
  await page.click('#ls-next'); // texto
  await page.click('.lesson-play svg [data-cell="1,1"]');
  step('explicação: ' + (await page.locator('.lesson-side .helper').innerText()).replace(/\n/g, ' ').slice(0, 140));
  await shot('04-licao-deducao');
  await page.click('#ls-next');
  for (const ans of ['(2, 2)', '(3, 1)', '(1, 3)']) {
    await page.locator('.options button', { hasText: ans }).first().click();
    await page.click('#ls-next');
  }
  step('lição: ' + (await page.locator('#ls-body').innerText()).replace(/\n/g, ' ').slice(0, 120));
  await page.click('#ls-back');
  await page.click('nav [data-tab="inicio"]');
  await page.locator('#plan-activities li', { hasText: 'Arena' }).locator('button').click();
  await page.waitForSelector('#editor:not([hidden])');
  await page.evaluate((p) => window.escola.loadProgram(p), prog(['wumpus_forward', 'wumpus_grab']));
  await page.click('#blk-run');
  await page.waitForFunction(() => /Vitória|caiu|pegou|terminou|🐞/.test(document.getElementById('blk-msg').textContent), null, { timeout: 20000 });
  step('agente: ' + (await text('#blk-msg')));
  await page.click('nav [data-tab="inicio"]');
  step('andamento: ' + (await page.locator('#plan-activities .status').allTextContents()).join(' | '));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#record-download')]);
  const recPath = path.join(shots || require('os').tmpdir(), 'registro-ana.json');
  await dl.saveAs(recPath);
  step(`registro: ${dl.suggestedFilename()}, ${JSON.parse(fs.readFileSync(recPath, 'utf8')).attempts.length} tentativas`);

  // 5. Trilha completa (lições livres)
  await page.click('nav [data-tab="trilha"]');
  step('módulos: ' + (await page.locator('#module-list li').count()));
  await page.locator('#module-list li').nth(2).locator('button').click();
  await page.click('#ls-next');
  await page.locator('.lesson-play svg [data-cell="2,0"]').click();
  step('combinações: ' + (await page.locator('.lesson-side .helper').last().innerText()));
  await shot('05-licao-combinacoes');
  await page.click('#ls-back');
  await page.locator('#module-list li').nth(3).locator('button').click();
  await page.click('#ls-next');
  await page.locator('.lesson-side button', { hasText: 'Até o fim' }).click();
  step('busca: ' + (await page.locator('.lesson-side .helper').innerText()).replace(/\n/g, ' | '));
  await shot('06-licao-busca');
  await page.click('#ls-back');
  await page.locator('#module-list li').nth(4).locator('button').click();
  await page.click('#ls-next');
  await page.locator('button', { hasText: 'Treinar com 1 caverna' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#ls-body tbody tr').length >= 2, null, { timeout: 120000 });
  await page.locator('button', { hasText: 'Treinar com 40 cavernas' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#ls-body tbody tr').length >= 3, null, { timeout: 180000 });
  step('genético: ' + (await page.locator('#ls-body tbody').innerText()).replace(/\n/g, ' | ').replace(/\t/g, ' '));
  await shot('07-licao-genetico');
  await page.click('#ls-back');
  await page.locator('#module-list li').nth(5).locator('button').click();
  await page.click('#ls-next');
  await page.locator('button', { hasText: 'Jogar 20 cavernas' }).click();
  await page.waitForSelector('#ls-body table');
  step('arena da trilha: ' + (await page.locator('#ls-body tbody').innerText()).replace(/\n/g, ' | ').replace(/\t/g, ' '));
  await shot('08-licao-arena');

  // 6. Professor: relatório e GitHub
  await page.click('#logout');
  await page.waitForURL(/escola\.html/);
  await page.fill('#pf-user', 'lucia');
  await page.fill('#pf-pass', 'errada123');
  await page.click('#pf-enter');
  await page.waitForFunction(() => document.getElementById('pf-msg').textContent.length > 0);
  step('senha errada: ' + (await text('#pf-msg')));
  await page.fill('#pf-pass', 'cavernas2026');
  await page.click('#pf-enter');
  await page.waitForURL(/professor\.html/);
  await page.click('nav [data-tab="relatorio"]');
  await page.selectOption('#rp-plan-select', { index: 1 });
  await page.setInputFiles('#rp-files', recPath);
  await page.waitForTimeout(600);
  const frame = page.frameLocator('#rp-view');
  step('relatório: ' + (await text('#rp-msg')));
  step('arena da turma no relatório: ' + (await frame.locator('h2', { hasText: 'Arena da turma' }).count()) + ' seção · lição: ' + (await frame.locator('text=acertou de primeira').count()));
  await shot('09-relatorio');
  await page.click('nav [data-tab="github"]');
  await page.fill('#gh-owner', 'prof');
  await page.fill('#gh-repo', 'turmas');
  await page.fill('#gh-token', 'tk-errado');
  await page.click('#gh-test');
  await page.waitForFunction(() => /token|Conectado/.test(document.getElementById('gh-msg').textContent));
  step('token errado: ' + (await text('#gh-msg')));
  await page.fill('#gh-token', 'tk-teste');
  await page.click('#gh-send');
  await page.waitForFunction(() => /Enviado|erro|não/i.test(document.getElementById('gh-msg').textContent), null, { timeout: 20000 });
  step('enviar: ' + (await text('#gh-msg')) + ' | arquivos: ' + [...files.keys()].join(', '));
  await page.click('#gh-bring');
  await page.waitForFunction(() => /Trazido|erro/i.test(document.getElementById('gh-msg').textContent), null, { timeout: 20000 });
  step('trazer: ' + (await text('#gh-msg')));
  const tokenInStorage = await page.evaluate(() => JSON.stringify(localStorage).includes('tk-teste'));
  step('token no localStorage sem "lembrar": ' + tokenInStorage);
  await shot('10-github');

  // 7. Celular
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [tab, name] of [['turmas', '11-cel-turmas'], ['planejar', '12-cel-planejar']]) {
    await page.click(`nav [data-tab="${tab}"]`);
    await page.waitForTimeout(200);
    await shot(name);
    step(`celular professor ${tab}: rolagem horizontal = ${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)}`);
  }
  await page.click('#logout');
  await page.waitForURL(/escola\.html/);
  step(`celular login: rolagem horizontal = ${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)}`);
  await shot('13-cel-login');
  await page.selectOption('#al-name', 'Bruno C.');
  await page.fill('#al-pin', pins['Bruno C.']);
  await page.click('#al-enter');
  await page.waitForURL(/aluno\.html/);
  for (const tab of ['inicio', 'trilha', 'blocos']) {
    await page.click(`nav [data-tab="${tab}"]`);
    await page.waitForTimeout(250);
    step(`celular aluno ${tab}: rolagem horizontal = ${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)}`);
  }
  await shot('14-cel-trilha');
  step('requisições externas: ' + JSON.stringify(external.filter((u) => !u.startsWith('https://api.github.com'))));
  step('erros no console: ' + JSON.stringify(errors));
  await browser.close();
})().catch((e) => {
  console.error('FALHOU', e.message);
  process.exit(1);
});
