// Roteiro de uso do jogo 3D (index.html) que grava tudo o que aparece na tela, para comparar duas versões
// (usado na refatoração, D21). Math.random é semeado, então as duas versões jogam os mesmos mapas
// — desde que criem os mesmos objetos 3D (o Three.js também consome Math.random para os UUIDs).
//   node roteiro-jogo.cjs http://localhost:4174/ antes.json [pasta-de-capturas]
//   node roteiro-jogo.cjs http://localhost:4173/ depois.json
//   node compara-roteiros.cjs antes.json depois.json
const { chromium } = require('playwright');
const fs = require('fs');
const [, , url, out, shots] = process.argv;
const log = [];

const SEED = `(() => { let a = 12345; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(SEED);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const ids = ['score', 'pos', 'arrow', 'gold', 'goal', 'thought', 'log', 'keys', 'map-current', 'gameover', 'go-title', 'go-text', 'go-score', 'agent-desc', 'cfg-pits-hint', 'human-summary', 'human-challenge', 'map-msg', 'ga-source', 'ga-weights', 'bench-out', 'speed-out'];
  const snap = async (label) => {
    const s = await page.evaluate((ids) => {
      const o = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        o[id] = el ? (el.hidden ? '[oculto] ' : '') + el.textContent.replace(/\s+/g, ' ').trim() : null;
      }
      o.percepts = [...document.querySelectorAll('[id^="p-"]')].filter((e) => e.classList.contains('on')).map((e) => e.id);
      o.mapList = [...document.querySelectorAll('#map-list option')].map((x) => x.textContent);
      o.agentOptions = [...document.querySelectorAll('#cfg-agent option')].map((x) => x.value + '=' + x.textContent);
      o.agent = document.getElementById('cfg-agent').value;
      o.hidden = ['#human-section', '#bench-section', '#ga-section', '#row-speed', '#row-beliefs', '#agent-controls', '#setup'].map((s) => s + ':' + document.querySelector(s).hidden);
      o.disabled = [...document.querySelectorAll('button')].filter((b) => b.disabled).map((b) => b.id || b.textContent);
      o.deleteLabel = document.getElementById('map-delete').textContent;
      o.world = window.wumpus && JSON.stringify(window.wumpus.world.toLayout('x'));
      return o;
    }, ids);
    log.push({ label, ...s });
  };
  const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  const setVal = (sel, v, ev = 'change') => page.evaluate(([s, v, ev]) => { const el = document.querySelector(s); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); }, [sel, v, ev]);
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(30); };
  const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

  await page.goto(url);
  await page.waitForTimeout(1500);
  await snap('início');
  await shot('01-inicio');

  // Você joga pelo teclado
  for (const k of ['ArrowUp', 'KeyA', 'ArrowUp', 'KeyD', 'KeyW', 'Space', 'KeyG', 'ArrowLeft', 'ArrowUp']) { await key(k); await snap(`tecla ${k}`); }
  await key('KeyM'); await snap('mapa aberto'); await page.waitForTimeout(400); await shot('02-mapa-aberto'); await key('KeyM');
  await key('KeyV'); await page.waitForTimeout(600); await shot('03-camera-geral'); await key('KeyV');
  await key('KeyT'); await snap('reiniciar T');
  await key('KeyR'); await snap('novo mapa R');
  await key('KeyC'); await snap('painel fechado'); await key('KeyC');

  // Agentes passo a passo
  for (const agent of ['bayes', 'logic', 'genetic', 'random']) {
    await setVal('#cfg-agent', agent);
    await snap(`agente ${agent}`);
    for (let i = 0; i < 25; i++) { await key('KeyN'); await page.waitForTimeout(20); }
    await page.waitForTimeout(200);
    await snap(`agente ${agent} após 25 passos`);
    if (agent === 'bayes') { await page.waitForTimeout(500); await shot('04-agente-probabilistico'); }
  }
  await setVal('#cfg-agent', 'bayes');
  await setVal('#cfg-beliefs', false); await snap('crenças desligadas'); await setVal('#cfg-beliefs', true);
  await setVal('#cfg-speed', '20', 'input'); await snap('velocidade');
  await key('Space'); await page.waitForTimeout(3000); await snap('agente jogando sozinho'); 
  await shot('05-agente-jogando');
  await key('KeyT'); await snap('parar T');

  // Avaliação
  for (const agent of ['bayes', 'logic', 'genetic']) {
    await setVal('#cfg-agent', agent);
    await setVal('#bench-games', '30'); await setVal('#bench-seed', 'roteiro');
    await click('#btn-bench');
    await page.waitForFunction(() => /Pontuação média/.test(document.getElementById('bench-out').textContent), null, { timeout: 60000 });
    await snap(`avaliação ${agent}`);
  }
  await setVal('#bench-on-map', true); await click('#btn-bench');
  await page.waitForFunction(() => /no mapa/.test(document.getElementById('bench-out').textContent), null, { timeout: 60000 });
  await snap('avaliação no mapa');

  // Mapas
  await setVal('#cfg-agent', 'human');
  await setVal('#map-name', 'Teste'); await click('#map-save'); await snap('mapa salvo');
  await click('#map-export-current'); await snap('exportar atual');
  const json = await page.evaluate(() => document.getElementById('map-json').value);
  log.push({ label: 'json exportado', json });
  await setVal('#cfg-size', '6'); await snap('tamanho 6');
  await click('#map-load'); await snap('carregar Teste');
  await click('#map-delete'); await snap('excluir 1º clique');
  await setVal('#map-list', 'Teste'); await snap('troca seleção reseta');
  await click('#map-delete'); await click('#map-delete'); await snap('excluído');
  await setVal('#map-json', json.replace('"Teste"', '"Importado"'), 'input'); await click('#map-paste-load'); await snap('importado');
  await setVal('#map-json', '{"format":"x"}', 'input'); await click('#map-paste-load'); await snap('import inválido');
  await setVal('#map-json', '', 'input'); await click('#map-copy'); await snap('copiar vazio');
  log.push({ label: 'json copiado', json: await page.evaluate(() => document.getElementById('map-json').value) });

  // Minhas partidas e desafio
  await setVal('#human-name', 'Ana'); await snap('nome');
  await setVal('#human-seed', 'abc'); await snap('desafio');
  log.push({ label: 'foco', el: await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (let g = 0; g < 3; g++) {
    for (let i = 0; i < 400; i++) { await page.keyboard.press(['ArrowUp', 'ArrowUp', 'KeyG', 'KeyA', 'ArrowUp', 'KeyD', 'ArrowUp', 'KeyD'][i % 8]); if (await page.evaluate(() => window.wumpus.world.gameOver)) break; }
    await snap(`partida ${g + 1} fim`);
    if (g === 0) await shot('06-fim-de-jogo');
    if (g === 1) { await key('KeyR'); await key('KeyM'); }
    else await key('KeyR');
  }
  await snap('após 3 partidas');
  await click('#human-clear'); await snap('apagar 1º clique');
  log.push({ label: 'comparar habilitado', on: await page.evaluate(() => !document.getElementById('human-compare').disabled) });
  await click('#human-compare');
  await page.waitForFunction(() => !document.getElementById('analysis').hidden, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  log.push({ label: 'análise comparação', list: await page.evaluate(() => document.getElementById('analysis-list').innerText), body: await page.evaluate(() => document.getElementById('analysis-body').innerText.replace(/\d+[,.]?\d* ?ms/g, 'Xms')) });
  await shot('07-analise');
  await page.keyboard.press('Escape');
  await click('#human-clear'); await click('#human-clear'); await snap('partidas apagadas');

  // Arena
  await click('#open-arena'); await page.waitForTimeout(200);
  await setVal('#arena-maps', '8'); await setVal('#arena-seed', 'roteiro');
  const arena = async (label) => {
    await click('#arena-run');
    await page.waitForFunction(() => /concluída/.test(document.getElementById('arena-status').textContent), null, { timeout: 120000 });
    log.push({ label, status: await page.evaluate(() => document.getElementById('arena-status').textContent), table: await page.evaluate(() => [...document.querySelectorAll('#arena-table tr')].map((r) => [...r.cells].filter((_, i) => i !== 8).map((c) => c.innerText).join(' | '))) });
  };
  await arena('arena embutidos');
  await click('#agent-template'); await click('#agent-add');
  await page.waitForFunction(() => /importado/.test(document.getElementById('agent-msg').textContent), null, { timeout: 30000 });
  log.push({ label: 'agente importado', msg: await page.evaluate(() => document.getElementById('agent-msg').textContent), players: await page.evaluate(() => document.getElementById('arena-players').innerText) });
  await snap('após importar agente');
  await arena('arena com externo');
  await shot('08-arena');
  await page.evaluate(() => [...document.querySelectorAll('#arena-players button')].find((b) => b.textContent === 'Assistir').click());
  await snap('assistir externo');
  for (let i = 0; i < 10; i++) { await key('KeyN'); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  await snap('externo após 10 passos');
  await click('#open-arena');
  const removeBtn = () => page.evaluate(() => [...document.querySelectorAll('#arena-players button')].find((b) => /Remover|Confirmar/.test(b.textContent)).click());
  await removeBtn(); log.push({ label: 'remover 1º', players: await page.evaluate(() => document.getElementById('arena-players').innerText) });
  await removeBtn(); log.push({ label: 'removido', players: await page.evaluate(() => document.getElementById('arena-players').innerText) });
  await snap('após remover');
  await page.keyboard.press('Escape');

  // Treino genético (Worker: não usa o Math.random semeado, então só confere que conclui)
  await setVal('#cfg-agent', 'genetic');
  await setVal('#ga-gens', '2'); await setVal('#ga-pop', '6'); await setVal('#ga-maps', '3');
  await click('#ga-train');
  await page.waitForFunction(() => /Treino concluído/.test(document.getElementById('ga-msg').textContent), null, { timeout: 120000 });
  log.push({ label: 'treino', ok: true, source: await page.evaluate(() => document.getElementById('ga-source').textContent), chart: await page.evaluate(() => !document.getElementById('ga-chart').hidden) });
  await shot('09-genetico');
  await click('#ga-reset'); await snap('genoma padrão');

  // Celular
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await page.waitForTimeout(1500);
  await snap('celular');
  await shot('10-celular');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log.push({ label: 'celular sem rolagem horizontal', ok: !overflow });

  log.push({ label: 'erros no console', errors });
  fs.writeFileSync(out, JSON.stringify(log, null, 1));
  await browser.close();
})().catch((e) => { console.error(e.message); fs.writeFileSync(out, JSON.stringify(log, null, 1)); process.exit(1); });
