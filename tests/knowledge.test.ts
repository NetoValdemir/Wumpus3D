// Deduções e probabilidades da base de conhecimento (src/agents/knowledge.ts).
import { describe, expect, it } from 'vitest';
import { Knowledge, riskOf } from '../src/agents/knowledge';

describe('Knowledge', () => {
  it('reproduz o exemplo do AIMA: P(poço) ≈ 56% nas duas salas da fronteira', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, false, false);
    kb.observe(1, 0, true, false, false);
    const p = kb.pitProbabilities();
    expect(p.get('2,0')).toBeCloseTo(0.2 / 0.36, 6);
    expect(p.get('1,1')).toBeCloseTo(0.2 / 0.36, 6);
    expect(kb.pitFree('0,1')).toBe(true);
  });

  it('deduz poço certo quando só sobra uma explicação para a brisa', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, false, false);
    kb.observe(0, 1, false, false, false);
    kb.observe(1, 1, false, false, false);
    kb.observe(1, 0, true, false, false); // vizinhas de (1,0): (0,0), (2,0), (1,1) → só (2,0) pode ter poço
    expect(kb.certainPits().has('2,0')).toBe(true);
  });

  it('localiza o Wumpus pelo cruzamento dos fedores', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, false, false);
    kb.observe(1, 0, false, true, false);
    kb.observe(0, 1, false, true, false);
    expect([...kb.wumpusCandidates()]).toEqual(['1,1']);
  });

  it('flecha que erra limpa a linha do tiro', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, true, false);
    kb.arrowMissed({ x: 0, y: 0 }, 0); // atirou para o leste
    expect([...kb.wumpusCandidates()]).toEqual(['0,1']);
  });

  it('o Wumpus nunca está num poço deduzido (D16)', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, false, false);
    kb.observe(0, 1, false, false, false);
    kb.observe(1, 1, false, true, false); // fedor: Wumpus em (2,1) ou (1,2) — (1,0) e (0,1) já são limpos
    kb.observe(1, 0, true, false, false); // brisa com uma só vizinha desconhecida: (2,0) é poço certo
    expect(kb.certainPits().has('2,0')).toBe(true);
    expect(kb.wumpusCandidates().has('2,0')).toBe(false);
  });

  it('P(Wumpus) entre candidatas pesa a chance de a sala não ter poço', () => {
    const kb = new Knowledge(4, 0.2);
    kb.observe(0, 0, false, false, false);
    kb.observe(1, 0, true, true, false); // brisa e fedor: (2,0) e (1,1) são candidatas às duas coisas
    const b = kb.beliefs();
    // Mesma chance de poço nas duas → mesma chance de Wumpus, somando 1
    expect(b.get('2,0')!.wumpus).toBeCloseTo(0.5, 6);
    expect(b.get('1,1')!.wumpus).toBeCloseTo(0.5, 6);
    // Risco = P(poço) + P(Wumpus), porque o Wumpus nunca divide a sala com um poço
    expect(riskOf(b.get('2,0')!)).toBeCloseTo(Math.min(1, b.get('2,0')!.pit + 0.5), 6);
  });
});
