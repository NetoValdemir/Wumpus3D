// Trilha de IA, módulo 3: as combinações de poços que o agente probabilístico enumera, uma a uma,
// para o aluno conferir a conta. Mesma lógica de Knowledge.pitProbabilities (fronteira, brisas, pesos).
import type { Knowledge } from '../../agents/knowledge';

export interface Combination {
  pits: string[]; // salas da fronteira com poço nesta combinação
  weight: number; // p^k (1 − p)^(n − k)
  explains: boolean; // explica todas as brisas sentidas?
}

export interface CombinationTable {
  frontier: string[];
  prior: number;
  combos: Combination[];
  total: number; // soma dos pesos das combinações que explicam as brisas
  probability: Map<string, number>; // P(poço) em cada sala da fronteira
}

export const MAX_SHOWN = 8; // 2^8 = 256 linhas: acima disso a tabela não cabe numa aula

export function pitCombinations(kb: Knowledge): CombinationTable | null {
  const p = kb.pitPrior;
  const unknown = kb.allCells().filter((k) => !kb.pitFree(k));
  const frontier = unknown.filter((k) => kb.neighbors(k).some((n) => kb.visited.has(n)));
  if (frontier.length > MAX_SHOWN) return null;
  const breezy = [...kb.visited].filter(([, o]) => o.breeze).map(([k]) => kb.neighbors(k).filter((n) => frontier.includes(n)));
  const combos: Combination[] = [];
  for (let mask = 0; mask < 1 << frontier.length; mask++) {
    const pits = frontier.filter((_, i) => mask & (1 << i));
    const weight = frontier.reduce((w, _, i) => w * (mask & (1 << i) ? p : 1 - p), 1);
    combos.push({ pits, weight, explains: breezy.every((ns) => ns.some((n) => pits.includes(n))) });
  }
  const valid = combos.filter((c) => c.explains);
  const total = valid.reduce((s, c) => s + c.weight, 0);
  const probability = new Map(frontier.map((k) => [k, total ? valid.filter((c) => c.pits.includes(k)).reduce((s, c) => s + c.weight, 0) / total : p]));
  return { frontier, prior: p, combos, total, probability };
}
