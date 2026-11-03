// Trilha de IA, módulo 5: o algoritmo genético do jogo em versão de aula. Só alguns pesos evoluem
// (os outros ficam iguais aos do agente probabilístico), com população e gerações pequenas, para rodar
// em segundos no navegador. Usa a mesma aptidão do treino completo (pontuação média nas cavernas).
import type { MapLayout } from '../../game/world';
import { BAYES_LIKE_GENOME, GENES, GENE_LIMIT } from '../../agents/genome';
import { fitness } from '../../agents/genetic';
import { playToEnd } from '../../agents/benchmark';
import { arenaMaps } from '../../arena/rng';

/**
 * Cavernas e sementes fixas da lição (os alunos veem os mesmos números). Medido: com 1 caverna o melhor
 * agente faz 1470 pontos no treino e 585 em 100 cavernas novas (decorou); com 40, 544 no treino e 609 nas
 * novas. O probabilístico, ajustado à mão com muito mais testes, faz 686 nas novas.
 */
export const TRAIN_SETS = { uma: arenaMaps('trilha-ga-treino', 1, 4, 0.2), varias: arenaMaps('trilha-ga-treino', 40, 4, 0.2) };
export const TEST_SET = arenaMaps('trilha-ga-teste', 100, 4, 0.2);
export const LITE_RUN = { population: 8, generations: 8, seed: { uma: 11, varias: 22 } };

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

/** Começa do ponto de partida e de pesos sorteados nos genes da aula (o resto igual ao probabilístico) e evolui. */
export function* trainLite(o: LiteOptions): Generator<LiteGeneration> {
  const base = o.start ?? BAYES_LIKE_GENOME;
  const randomOne = () => base.map((v, i) => (LITE_GENES.includes(i) ? (o.rng() * 2 - 1) * GENE_LIMIT : v));
  // O primeiro indivíduo é o ponto de partida (os pesos do agente probabilístico): com o elitismo, o
  // treino nunca termina pior que ele nas cavernas de treino
  let pop = [base, ...Array.from({ length: o.population - 1 }, randomOne)];
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
