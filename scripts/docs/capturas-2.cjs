// Capturas de tela do manual (início, painel, vitória). Mesmo uso de capturas-1.cjs:
//   node capturas-2.cjs img
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
  // procura um mapa em que a primeira sala à frente seja segura e haja caminho até o ouro
  let moves = null;
  for (let tries = 0; tries < 30 && !moves; tries++) {
    moves = await p.evaluate(() => {
      const w = window.wumpus.world, g = w.gold;
      const bad = (x,y) => w.hasPit(x,y) || (x===w.wumpus.x && y===w.wumpus.y);
      if (bad(1,0)) return null;
      const prev = new Map([['0,0', null]]), q = [[0,0]];
      while (q.length) { const [x,y] = q.shift(); for (const n of w.neighbors(x,y)) { const k = n.x+','+n.y; if (prev.has(k) || bad(n.x,n.y)) continue; prev.set(k, x+','+y); q.push([n.x,n.y]); } }
      if (!prev.has(g.x+','+g.y)) return null;
      const path = []; for (let k = g.x+','+g.y; k; k = prev.get(k)) path.unshift(k.split(',').map(Number));
      if (path.length < 4) return null;
      const route = [...path, ...path.slice(0,-1).reverse()], keys = []; let d = 0;
      const dirOf = (dx,dy) => dx===1?0:dy===1?1:dx===-1?2:3;
      for (let i=1;i<route.length;i++){ const want = dirOf(route[i][0]-route[i-1][0], route[i][1]-route[i-1][1]); while(d!==want){keys.push('KeyA'); d=(d+1)%4;} keys.push('KeyW'); if(i===path.length-1) keys.push('KeyG'); }
      return keys;
    });
    if (!moves) { await p.click('#btn-restart'); await p.waitForTimeout(200); }
  }
  // tela inicial (modo você), depois de dar 1 passo para ter percepções e histórico
  await p.keyboard.press('KeyW'); await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/inicio.png' });
  await p.locator('#setup').screenshot({ path: out + '/painel.png' });
  // jogar até vencer (desfaz o passo dado: recomeça o mesmo mapa)
  await p.click('#btn-reset'); await p.waitForTimeout(300);
  for (const k of moves) { await p.keyboard.press(k); await p.waitForTimeout(50); }
  await p.waitForTimeout(900);
  console.log('status', await p.evaluate(() => window.wumpus.world.status));
  await p.screenshot({ path: out + '/vitoria.png' });
  await b.close();
})();
