// Algoritmo genético que evolui os pesos (genoma) do GeneticAgent.
//
// Cada indivíduo é uma lista de pesos. A aptidão (fitness) é a pontuação média dele jogando
// os mesmos mapas sorteados na geração. A cada geração:
//   1. os melhores passam direto (elitismo);
//   2. o resto nasce do cruzamento de pais escolhidos por torneio;
//   3. cada filho sofre pequenas mutações aleatórias.
// No fim, os 5 melhores jogam mapas novos (validação) e o vencedor é o genoma devolvido:
// isso evita escolher um indivíduo que só teve sorte nos mapas da última geração.
import { WumpusWorld, type MapLayout } from '../game/world';
import { runEpisode } from './benchmark';
import { GENES, GENE_LIMIT } from './genome';

export interface TrainingOptions {
  size: number;
  /** Treina em vários tamanhos ao mesmo tempo (os mapas de cada geração são divididos entre eles) */
  sizes?: number[];
  pitProbability: number;
  population: number;
  generations: number;
  mapsPerGeneration: number;
  /** Mapas da validação final (padrão: 3 × mapsPerGeneration) */
  validationMaps?: number;
  /** Treina só neste mapa (o agente se especializa nele) */
  layout?: MapLayout | null;
  /** Indivíduo inicial opcional (ex.: o genoma atual), para continuar um treino */
  seed?: number[];
  rng?: () => number;
}

export interface GenerationReport {
  generation: number;
  best: number; // aptidão do melhor indivíduo
  average: number; // aptidão média da população
  bestGenome: number[];
  /** true no relatório final, depois da validação em mapas novos */
  validated?: boolean;
}

const MUTATION_RATE = 0.2; // chance de cada peso sofrer mutação
const MUTATION_SIZE = 0.8; // desvio padrão da mutação
const ELITE = 2;
const TOURNAMENT = 3;
const FINALISTS = 5;

const clamp = (v: number) => Math.max(-GENE_LIMIT, Math.min(GENE_LIMIT, v));

function gaussian(rng: () => number) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomGenome(rng: () => number = Math.random) {
  return GENES.map(() => (rng() * 2 - 1) * GENE_LIMIT);
}

/** Pontuação média do genoma nos mapas dados. */
export function fitness(genome: number[], maps: MapLayout[]) {
  let total = 0;
  for (const layout of maps) total += runEpisode('genetic', { size: layout.size, pitProbability: layout.pitProbability, layout, genome }).score;
  return total / maps.length;
}

function crossover(a: number[], b: number[], rng: () => number) {
  // Cruzamento aritmético por gene: o filho fica num ponto entre os dois pais
  return a.map((v, i) => {
    const t = rng();
    return v * t + b[i] * (1 - t);
  });
}

function mutate(genome: number[], rng: () => number) {
  return genome.map((v) => (rng() < MUTATION_RATE ? clamp(v + gaussian(rng) * MUTATION_SIZE) : v));
}

/** Executa o treino; o gerador devolve um relatório por geração (para mostrar o progresso). */
export function* train(opts: TrainingOptions): Generator<GenerationReport> {
  const rng = opts.rng ?? Math.random;
  let population = Array.from({ length: opts.population }, () => randomGenome(rng));
  if (opts.seed) population[0] = [...opts.seed];

  // Vários tamanhos: a aptidão vira a média em mapas de todos eles, para o agente generalizar (D19)
  const sizes = opts.sizes?.length ? opts.sizes : [opts.size];
  const sampleMaps = (count: number) =>
    opts.layout
      ? [opts.layout]
      : Array.from({ length: count }, (_, i) => new WumpusWorld(sizes[i % sizes.length], opts.pitProbability, rng).toLayout('treino'));

  for (let gen = 1; gen <= opts.generations; gen++) {
    // Todos os indivíduos jogam os mesmos mapas nesta geração (comparação justa)
    const maps = sampleMaps(opts.mapsPerGeneration);
    const scored = population
      .map((genome) => ({ genome, fit: fitness(genome, maps) }))
      .sort((a, b) => b.fit - a.fit);

    yield {
      generation: gen,
      best: scored[0].fit,
      average: scored.reduce((s, x) => s + x.fit, 0) / scored.length,
      bestGenome: scored[0].genome,
    };

    if (gen === opts.generations) {
      // Validação: os finalistas jogam mapas que nunca viram
      const validation = sampleMaps(opts.validationMaps ?? opts.mapsPerGeneration * 3);
      const finalists = scored
        .slice(0, FINALISTS)
        .map((x) => ({ genome: x.genome, fit: fitness(x.genome, validation) }))
        .sort((a, b) => b.fit - a.fit);
      yield { generation: gen, best: finalists[0].fit, average: scored[0].fit, bestGenome: finalists[0].genome, validated: true };
      return;
    }

    const pick = () => {
      let winner = scored[Math.floor(rng() * scored.length)];
      for (let i = 1; i < TOURNAMENT; i++) {
        const rival = scored[Math.floor(rng() * scored.length)];
        if (rival.fit > winner.fit) winner = rival;
      }
      return winner.genome;
    };
    const next = scored.slice(0, ELITE).map((x) => x.genome);
    while (next.length < opts.population) next.push(mutate(crossover(pick(), pick(), rng), rng));
    population = next;
  }
}
