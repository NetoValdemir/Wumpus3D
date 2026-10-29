// Capturas de tela usadas nos PDFs (principal, genético, Arena, celular). Rode com o site em http://localhost:4173 (npm run build && npm run preview -- --port 4173):
//   node capturas-1.cjs img
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { let s = 7; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll('details.fold').forEach((d) => (d.open = true))); // seções começam fechadas
  await p.selectOption('#cfg-size', '6'); await p.selectOption('#cfg-agent', 'bayes'); await p.waitForTimeout(300);
  for (let i = 0; i < 14; i++) { if (await p.isDisabled('#btn-step')) break; await p.click('#btn-step'); await p.waitForTimeout(80); }
  await p.keyboard.press('KeyV'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/principal.png' });
  // genético
  await p.selectOption('#cfg-agent', 'genetic'); await p.waitForTimeout(300);
  await p.locator('#ga-section').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator('#setup').screenshot({ path: out + '/genetico.png' });
  // arena
  await p.click('#open-arena'); await p.click('#agent-template'); await p.click('#agent-add');
  await p.waitForFunction(() => /importado/.test(document.querySelector('#agent-msg').textContent), null, { timeout: 15000 });
  await p.fill('#arena-maps', '100'); await p.click('#arena-run');
  await p.waitForFunction(() => /concluída/.test(document.querySelector('#arena-status').textContent), null, { timeout: 180000 });
  await p.locator('#arena-results').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator('#arena .arena-box').screenshot({ path: out + '/arena.png' });
  const rows = await p.$$eval('#arena-table tbody tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim()).join(' | ')));
  console.log(rows.join('\n'));
  await p.click('#arena-close');
  // celular
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/celular.png' });
  await b.close();
})();
