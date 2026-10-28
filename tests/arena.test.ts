// Arena: mapas reproduzíveis, partidas e ranking (src/arena/).
import { describe, expect, it } from 'vitest';
import { arenaMaps } from '../src/arena/rng';
import { builtinController, playEpisode } from '../src/arena/runner';
import { aggregate, rank } from '../src/arena/ranking';
import { normalizeDecision } from '../src/arena/protocol';

describe('arena', () => {
  it('a mesma semente gera os mesmos mapas', () => {
    expect(arenaMaps('final', 20, 5, 0.2)).toEqual(arenaMaps('final', 20, 5, 0.2));
    expect(arenaMaps('final', 20, 5, 0.2)).not.toEqual(arenaMaps('outra', 20, 5, 0.2));
  });

  it('os agentes de referência nunca cometem erro de lógica nem risco desnecessário', async () => {
    for (const id of ['logic', 'bayes', 'genetic'] as const) {
      const results = [];
      for (const map of arenaMaps('teste', 40, 4, 0.2)) results.push(await playEpisode(builtinController(id), map, 1000));
      const s = aggregate(id, '', results);
      expect(s.errors).toBe(0);
      expect(s.logicErrorsPerGame).toBe(0);
      expect(s.needlessRisksPerGame).toBe(0);
    }
  });

  it('o agente lógico vence o aleatório com folga', async () => {
    const maps = arenaMaps('folga', 60, 4, 0.2);
    const score = async (id: 'logic' | 'random') => {
      const r = [];
      for (const m of maps) r.push(await playEpisode(builtinController(id), m, 1000));
      return aggregate(id, '', r);
    };
    const [logic, random] = [await score('logic'), await score('random')];
    expect(rank([random, logic])[0].name).toBe('logic');
    expect(logic.wins).toBeGreaterThan(random.wins * 3);
  });

  it('decisão inválida de agente externo vira erro claro', () => {
    expect(() => normalizeDecision('fly', 4)).toThrow('Ação inválida');
    expect(normalizeDecision({ action: 'grab', thought: 'ouro!' }, 4)).toMatchObject({ action: 'grab', thought: 'ouro!' });
  });
});
