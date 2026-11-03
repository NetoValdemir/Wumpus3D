// Trilha de IA, módulo 5: o algoritmo genético do jogo em versão de aula. Só alguns pesos evoluem
// (os outros ficam iguais aos do agente probabilístico), com população e gerações pequenas, para rodar
// em segundos no navegador. Usa a mesma aptidão do treino completo (pontuação média nas cavernas).
import type { MapLayout } from '../../game/world';
import { BAYES_LIKE_GENOME, GENES, GENE_LIMIT } from '../../agents/genome';
import { fitness } from '../../agents/genetic';
import { playToEnd } from '../../agents/benchmark';

/** Pesos que a aula deixa evoluir: risco, distância e novidade (índices em GENES). */
export const LITE_GENES = [0, 1, 3];
export const geneName = (i: number) => GENES[i].name;

export interface LiteOptions {
  maps: MapLayout[]; // cavernas de treino (as mesmas em todas as gerações: é uma aula)
  population: number;
  generations: number;
  rng: () => number;
  start?: number[];
}

export interface LiteGeneration {
  generation: number;
  best: number;
  average: number;
  genome: number[];
}

const clamp = (v: number) => Math.max(-GENE_LIMIT, Math.min(GENE_LIMIT, v));

/** Começa de pesos sorteados nos genes da aula (o resto igual ao probabilístico) e evolui. */
export function* trainLite(o: LiteOptions): Generator<LiteGeneration> {
  const base = o.start ?? BAYES_LIKE_GENOME;
  const randomOne = () => base.map((v, i) => (LITE_GENES.includes(i) ? (o.rng() * 2 - 1) * GENE_LIMIT : v));
  let pop = Array.from({ length: o.population }, randomOne);
  for (let g = 1; g <= o.generations; g++) {
    const scored = pop.map((genome) => ({ genome, fit: fitness(genome, o.maps) })).sort((a, b) => b.fit - a.fit);
    yield { generation: g, best: scored[0].fit, average: scored.reduce((s, x) => s + x.fit, 0) / scored.length, genome: scored[0].genome };
    const pick = () => {
      const a = scored[Math.floor(o.rng() * scored.length)];
      const b = scored[Math.floor(o.rng() * scored.length)];
      return (a.fit >= b.fit ? a : b).genome;
    };
    const next = [scored[0].genome, scored[1]?.genome ?? scored[0].genome];
    while (next.length < o.population) {
      const [x, y] = [pick(), pick()];
      next.push(x.map((v, i) => (LITE_GENES.includes(i) ? clamp((o.rng() < 0.5 ? v : y[i]) + (o.rng() < 0.3 ? (o.rng() * 2 - 1) * 1.5 : 0)) : v)));
    }
    pop = next;
  }
}

/** Pontuação média e vitórias de um genoma em cavernas (para comparar treino × teste). */
export function evaluateGenome(genome: number[], maps: MapLayout[]) {
  let wins = 0;
  let total = 0;
  for (const m of maps) {
    const w = playToEnd('genetic', m, genome);
    total += w.score;
    if (w.status === 'won') wins++;
  }
  return { avg: total / maps.length, wins, games: maps.length };
}
