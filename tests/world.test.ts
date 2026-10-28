// Regras do jogo (src/game/world.ts). Coordenadas no código começam em 0; no JSON de mapa, em 1.
import { describe, expect, it } from 'vitest';
import { SCORE, WumpusWorld, key, maxActionsFor, parseLayout, type Action } from '../src/game/world';

// Mapa fixo: poço em (4,4), Wumpus em (1,4) e ouro em (3,1), na numeração da tela
const layout = (extra: object = {}) =>
  parseLayout(JSON.stringify({ format: 'wumpus3d-map', size: 4, pits: [[4, 4]], wumpus: [1, 4], gold: [3, 1], ...extra }));
const play = (w: WumpusWorld, actions: Action[]) => actions.forEach((a) => w.step(a));

describe('vitória e fim de partida', () => {
  it('voltar à entrada sem o ouro não encerra a partida', () => {
    const w = WumpusWorld.fromLayout(layout());
    play(w, ['forward', 'left', 'left', 'forward']);
    expect(w.status).toBe('playing');
  });

  it('pegar o ouro e voltar à entrada dá vitória com +1000 e +500', () => {
    const w = WumpusWorld.fromLayout(layout());
    play(w, ['forward', 'forward', 'grab', 'left', 'left', 'forward', 'forward']);
    expect(w.status).toBe('won');
    expect(w.score).toBe(SCORE.gold + SCORE.escape - 7);
  });

  it('cair no poço mata', () => {
    const w = WumpusWorld.fromLayout(layout({ pits: [[2, 1]], gold: [3, 2] }));
    w.step('forward');
    expect(w.status).toBe('dead-pit');
  });

  it('a sala do Wumpus morto é segura', () => {
    const w = WumpusWorld.fromLayout(layout({ wumpus: [3, 1], gold: [4, 1] }));
    play(w, ['shoot']); // atira para o leste, na linha do Wumpus
    expect(w.wumpusAlive).toBe(false);
    expect(w.percepts.scream).toBe(true);
    play(w, ['forward', 'forward']);
    expect(w.status).toBe('playing');
  });

  it('o limite de ações encerra como tempo esgotado', () => {
    const w = WumpusWorld.fromLayout(layout());
    for (let i = 0; i < maxActionsFor(4); i++) w.step('left');
    expect(w.status).toBe('timeout');
    expect(w.actions).toBe(320);
  });
});

describe('custos e percepções', () => {
  it('atirar custa 10 além da ação, mesmo errando; sem flecha custa só 1', () => {
    const w = WumpusWorld.fromLayout(layout());
    w.step('shoot');
    expect(w.score).toBe(-11);
    w.step('shoot');
    expect(w.score).toBe(-12);
  });

  it('andar contra a parede custa 1, não move e acende Batida', () => {
    const w = WumpusWorld.fromLayout(layout());
    play(w, ['right', 'forward']); // virado para o sul, na borda
    expect([w.agent.x, w.agent.y]).toEqual([0, 0]);
    expect(w.percepts.bump).toBe(true);
    expect(w.score).toBe(-2);
  });

  it('o fedor continua depois que o Wumpus morre', () => {
    const w = WumpusWorld.fromLayout(layout({ wumpus: [2, 1], gold: [4, 1] }));
    expect(w.percepts.stench).toBe(true);
    w.step('shoot');
    expect(w.percepts.stench).toBe(true);
  });
});

describe('mapas', () => {
  it('todo mapa sorteado tem caminho sem poço até o ouro', () => {
    for (let i = 0; i < 300; i++) {
      const w = new WumpusWorld(4 + (i % 5), 0.25);
      const g = w.gold!;
      expect(w.hasPit(g.x, g.y)).toBe(false);
      const seen = new Set([key(0, 0)]);
      const queue = [{ x: 0, y: 0 }];
      while (queue.length) {
        const c = queue.shift()!;
        for (const n of w.neighbors(c.x, c.y)) {
          if (seen.has(key(n.x, n.y)) || w.hasPit(n.x, n.y)) continue;
          seen.add(key(n.x, n.y));
          queue.push(n);
        }
      }
      expect(seen.has(key(g.x, g.y))).toBe(true);
    }
  });

  it('exportar e importar devolve o mesmo mapa', () => {
    const w = new WumpusWorld(6, 0.2);
    const again = WumpusWorld.fromLayout(parseLayout(JSON.stringify(w.toLayout('teste'))));
    expect(again.toLayout('teste')).toEqual(w.toLayout('teste'));
  });

  it.each([
    [{ wumpus: [1, 1] }, 'entrada'],
    [{ gold: [4, 4] }, 'poço'],
    [{ size: 13 }, 'size'],
    [{ format: 'outro' }, 'não é um mapa'],
    [{ pits: [[0, 2]] }, 'poço nº 1'],
  ])('recusa mapa inválido %j', (extra, msg) => {
    expect(() => layout(extra)).toThrow(msg);
  });
});
