// Treino do agente genético na linha de comando, reproduzível pela semente.
//
//   npm run treinar -- [--seed texto] [--inicio bayes|padrao] [--pop 24] [--geracoes 20] [--mapas 120]
//                      [--size 4] [--pits 0.2] [--comparar 2000]
//
// Usa o mesmo train() da tela (genetic.ts). No fim, compara o genoma treinado com o DEFAULT_GENOME
// nos mesmos mapas novos (semente "<seed>-comparacao"), para decidir se vale trocar o genoma padrão.
import { train } from '../src/agents/genetic';
import { BAYES_LIKE_GENOME, DEFAULT_GENOME } from '../src/agents/genome';
import { createAgent, sensesOf } from '../src/agents/agents';
import { arenaMaps, mulberry32, seedFromText } from '../src/arena/rng';
import { WumpusWorld, type MapLayout } from '../src/game/world';

function parseArgs(argv: string[]) {
  const opts = { seed: 'treino', start: 'bayes', pop: 24, gens: 20, maps: 120, size: 4, pits: 0.2, compare: 2000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--seed') opts.seed = next();
    else if (a === '--inicio') opts.start = next();
    else if (a === '--pop') opts.pop = Number(next());
    else if (a === '--geracoes') opts.gens = Number(next());
    else if (a === '--mapas') opts.maps = Number(next());
    else if (a === '--size') opts.size = Number(next());
    else if (a === '--pits') opts.pits = Number(next());
    else if (a === '--comparar') opts.compare = Number(next());
  }
  return opts;
}

/** Pontos, vitórias e uso da flecha de um genoma nos mapas dados. */
function measure(genome: number[], maps: MapLayout[]) {
  let score = 0, wins = 0, shots = 0, kills = 0;
  for (const layout of maps) {
    const world = WumpusWorld.fromLayout(layout);
    const agent = createAgent('genetic', world.size, world.pitProbability, genome);
    while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
    score += world.score;
    if (world.status === 'won') wins++;
    if (!world.hasArrow) shots++;
    if (!world.wumpusAlive) kills++;
  }
  const n = maps.length;
  return { score: score / n, wins: wins / n, shots: shots / n, kills: kills / n };
}

const opts = parseArgs(process.argv.slice(2));
const start = opts.start === 'padrao' ? DEFAULT_GENOME : BAYES_LIKE_GENOME;
const t0 = Date.now();
let genome: number[] = start;
for (const r of train({
  size: opts.size,
  pitProbability: opts.pits,
  population: opts.pop,
  generations: opts.gens,
  mapsPerGeneration: opts.maps,
  seed: start,
  rng: mulberry32(seedFromText(opts.seed)),
})) {
  console.log(`${r.validated ? 'validação' : `geração ${r.generation}`}: melhor ${r.best.toFixed(1)}, média ${r.average.toFixed(1)}`);
  genome = r.bestGenome;
}
const rounded = genome.map((v) => Math.round(v * 100) / 100);
console.log(`\nGenoma treinado (${((Date.now() - t0) / 1000).toFixed(0)} s): [${rounded.join(', ')}]`);

const maps = arenaMaps(`${opts.seed}-comparacao`, opts.compare, opts.size, opts.pits);
const fmt = (m: ReturnType<typeof measure>) =>
  `${m.score.toFixed(1)} pts, ${(m.wins * 100).toFixed(1)}% vitórias, tiro em ${(m.shots * 100).toFixed(1)}%, Wumpus morto em ${(m.kills * 100).toFixed(1)}%`;
console.log(`\nComparação em ${opts.compare} mapas novos ${opts.size}×${opts.size}:`);
console.log(`  DEFAULT_GENOME atual: ${fmt(measure(DEFAULT_GENOME, maps))}`);
console.log(`  Genoma treinado:      ${fmt(measure(rounded, maps))}`);
