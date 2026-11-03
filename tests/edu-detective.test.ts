// Modo Detetive: anotações do caderno, conferência com as deduções, dicas e estrelas.
import { describe, expect, it } from 'vitest';
import type { Action, MapLayout } from '../src/game/world';
import { DetectiveGame, detectiveFeedback } from '../src/edu/detective';

// Poço em (3,1), Wumpus em (1,3), ouro em (2,3) — coordenadas da tela
const layout: MapLayout = { format: 'wumpus3d-map', version: 1, name: 't', size: 4, pitProbability: 0.2, pits: [[3, 1]], wumpus: [1, 3], gold: [2, 3] };
const k = (x: number, y: number) => `${x - 1},${y - 1}`; // tela → chave interna
const play = (g: DetectiveGame, actions: Action[]) => actions.forEach((a) => g.act(a));

describe('caderno do detetive', () => {
  it('confere cada anotação com o que as pistas permitem deduzir', () => {
    const g = new DetectiveGame(layout);
    g.act('forward'); // (2,1): brisa
    g.marks.set(k(1, 2), 'segura');
    g.marks.set(k(3, 1), 'poco?');
    g.marks.set(k(2, 2), 'poco');
    expect([g.verdict(k(1, 2)), g.verdict(k(3, 1)), g.verdict(k(2, 2))]).toEqual(['certa', 'possivel', 'possivel']);

    play(g, ['left', 'left', 'forward', 'right', 'forward']); // volta e sobe para (1,2): fedor, sem brisa
    expect(g.verdict(k(2, 2))).toBe('errada'); // (1,2) sem brisa: (2,2) não tem poço
    expect(g.verdict(k(3, 1))).toBe('certa'); // só sobrou (3,1) para a brisa de (2,1)
    g.marks.set(k(1, 3), 'wumpus');
    expect(g.verdict(k(1, 3))).toBe('certa');
    expect(g.checkMarks()).toEqual({ certa: 2, possivel: 0, errada: 1 });
    expect(g.hint()).toMatch(/\(2, 2\)/); // a dica começa pela anotação errada
    expect(g.hints).toBe(1);
  });

  it('tocar na sala troca a anotação em ciclo; salas visitadas não recebem anotação', () => {
    const g = new DetectiveGame(layout);
    expect([g.cycleMark(k(2, 2)), g.cycleMark(k(2, 2)), g.cycleMark(k(2, 2))]).toEqual(['segura', 'poco?', 'poco']);
    expect(g.cycleMark(k(1, 1))).toBeNull();
    g.marks.set(k(2, 1), 'poco');
    g.act('forward');
    expect(g.marks.has(k(2, 1))).toBe(false);
  });

  it('a dica aponta uma sala segura quando há uma', () => {
    const g = new DetectiveGame(layout);
    expect(g.hint()).toMatch(/\((2, 1|1, 2)\).*não sentiu brisa/);
  });

  it('rota segura sem erros dá 3 estrelas; entrar em perigo comprovado tira estrelas', () => {
    const g = new DetectiveGame(layout);
    play(g, ['forward', 'left', 'left', 'forward', 'right', 'forward', 'right', 'forward', 'left', 'forward', 'grab', 'left', 'left', 'forward', 'right', 'forward', 'left', 'forward']);
    expect(g.world.status).toBe('won');
    expect(g.summary()).toMatchObject({ logicErrors: 0, needlessRisks: 0, stars: 3 });
    expect(detectiveFeedback(g.summary())[0]).toMatch(/Raciocínio de detetive/);

    const ruim = new DetectiveGame(layout);
    play(ruim, ['forward', 'left', 'left', 'forward', 'right', 'forward', 'left', 'left', 'forward', 'left', 'forward', 'forward']); // entra em (3,1), poço comprovado
    expect(ruim.world.status).toBe('dead-pit');
    expect(ruim.summary()).toMatchObject({ logicErrors: 1, stars: 0 });
    expect(detectiveFeedback(ruim.summary()).join(' ')).toMatch(/pistas já mostravam/);
  });
});
