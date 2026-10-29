// Agente genético (src/agents/agents.ts): não pode andar em círculos, quaisquer que sejam os pesos.
import { describe, expect, it } from 'vitest';
import { WumpusWorld } from '../src/game/world';
import { createAgent, sensesOf } from '../src/agents/agents';
import { BAYES_LIKE_GENOME } from '../src/agents/genome';
import { arenaMaps } from '../src/arena/rng';

const timeouts = (genome: number[]) =>
  arenaMaps('genetico-laco', 30, 6, 0.2).filter((l) => {
    const w = WumpusWorld.fromLayout(l);
    const a = createAgent('genetic', w.size, w.pitProbability, genome);
    while (!w.gameOver) w.step(a.decide(sensesOf(w)));
    return w.status === 'timeout';
  }).length;

describe('agente genético', () => {
  it('pesos que dependem da posição não fazem o agente oscilar entre alvos', () => {
    // Antes do compromisso com o alvo, estes pesos esgotavam o tempo em quase todos os mapas 6×6
    expect(timeouts([-5, 2, 0, 0, 0, 0, 0, 0, 0, 2, -5])).toBeLessThanOrEqual(3);
    expect(timeouts([-5, -0.5, 0, 0, 0, 3, 0, 0, 0, 2, -5])).toBeLessThanOrEqual(3);
  }, 60000);

  it('o BAYES_LIKE_GENOME não esgota o tempo', () => {
    expect(timeouts(BAYES_LIKE_GENOME)).toBeLessThanOrEqual(1);
  }, 60000);
});
