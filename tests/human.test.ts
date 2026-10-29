// Partidas de jogadores humanos (src/report/human.ts): o que conta no relatório, desafio e comparação.
import { describe, expect, it } from 'vitest';
import { WumpusWorld } from '../src/game/world';
import { challengeMap, compareWithAgents, countedGames, humanReport, nextChallengeIndex, type HumanGame } from '../src/report/human';

const game = (over: Partial<HumanGame> = {}): HumanGame => ({
  date: '2026-10-29T12:00:00Z',
  player: 'Ana',
  layout: new WumpusWorld(4, 0.2).toLayout('m'),
  challenge: null,
  outcome: 'won',
  score: 1480,
  actions: 20,
  gold: true,
  killed: false,
  shots: 0,
  bumps: 0,
  logicErrors: 0,
  needlessRisks: 0,
  ms: 60000,
  revealed: false,
  ...over,
});

describe('partidas humanas', () => {
  it('conta só a primeira vez em cada mapa, sem mapa aberto, e só do jogador', () => {
    const a = game();
    const games = [a, game({ layout: a.layout, score: 1490 }), game({ revealed: true }), game({ player: 'Bia' }), game()];
    const counted = countedGames(games, 'Ana');
    expect(counted).toHaveLength(2);
    expect(counted[0].score).toBe(1480); // a repetição do mesmo mapa (1490) não conta
  });

  it('desafio: mesma semente gera os mesmos mapas para todos, e o mapa só avança depois de terminar', () => {
    expect(challengeMap('turma', 3, 4, 0.2)).toEqual(challengeMap('turma', 3, 4, 0.2));
    expect(challengeMap('turma', 0, 4, 0.2)).not.toEqual(challengeMap('turma', 1, 4, 0.2));
    expect(nextChallengeIndex([], 'Ana', 'turma', 4, 0.2)).toBe(0);
    const done = [game({ challenge: { seed: 'turma', index: 0 }, layout: challengeMap('turma', 0, 4, 0.2) })];
    expect(nextChallengeIndex(done, 'Ana', 'turma', 4, 0.2)).toBe(1);
    expect(nextChallengeIndex(done, 'Bia', 'turma', 4, 0.2)).toBe(0); // progresso é de cada jogador
  });

  it('relatório do jogador usa o número do mapa do desafio', () => {
    const games = [1, 0].map((i) => game({ challenge: { seed: 'turma', index: i }, layout: challengeMap('turma', i, 4, 0.2) }));
    const r = humanReport(games, 'Ana');
    expect(r.agents[0].games.map((g) => g.map)).toEqual([2, 1]);
    expect(r.config.seed).toBe('desafio "turma"');
  });

  it('comparação: os agentes jogam exatamente os mapas do jogador', async () => {
    const games = [0, 1, 2].map((i) => game({ challenge: { seed: 'cmp', index: i }, layout: challengeMap('cmp', i, 4, 0.2) }));
    const r = await compareWithAgents(games, 'Ana', [-5, -0.01, 0, 0, 0, 0, 0, 0, 0, 2, -5]);
    expect(r.agents.map((a) => a.name)).toEqual(['Ana', 'Agente probabilístico', 'Agente lógico', 'Agente genético']);
    for (const a of r.agents) expect(a.games.map((g) => g.map)).toEqual([1, 2, 3]);
  });
});
