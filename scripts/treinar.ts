// Treino do agente genético na linha de comando, reproduzível pela semente.
//
//   npm run treinar -- [--seed texto] [--inicio bayes|padrao] [--pop 24] [--geracoes 20] [--mapas 120]
//                      [--tamanhos 4,6] [--validacao 1000] [--pits 0.2] [--comparar 2000]
//
// Usa o mesmo train() da tela (genetic.ts). No fim, compara o genoma treinado com o DEFAULT_GENOME e com
// o agente probabilístico nos mesmos mapas novos (semente "<seed>-comparacao"), em cada tamanho,
// com a diferença pareada e o intervalo de 95%, para decidir se vale trocar o genoma padrão.
import { train } from '../src/agents/genetic';
import { BAYES_LIKE_GENOME, DEFAULT_GENOME } from '../src/agents/genome';
import { createAgent, sensesOf } from '../src/agents/agents';
import { arenaMaps, mulberry32, seedFromText } from '../src/arena/rng';
import { WumpusWorld, type MapLayout } from '../src/game/world';
import { pairedDiff } from '../src/report/report';

function parseArgs(argv: string[]) {
  const opts = { seed: 'treino', start: 'bayes', pop: 24, gens: 20, maps: 120, sizes: [4], validation: 0, pits: 0.2, compare: 2000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--seed') opts.seed = next();
    else if (a === '--inicio') opts.start = next();
    else if (a === '--pop') opts.pop = Number(next());
    else if (a === '--geracoes') opts.gens = Number(next());
    else if (a === '--mapas') opts.maps = Number(next());
    else if (a === '--tamanhos' || a === '--size') opts.sizes = next().split(',').map(Number);
    else if (a === '--validacao') opts.validation = Number(next());
    else if (a === '--pits') opts.pits = Number(next());
    else if (a === '--comparar') opts.compare = Number(next());
  }
  return opts;
}

/** Pontuação de cada partida, vitórias e uso da flecha nos mapas dados. */
function play(id: 'bayes' | 'genetic', genome: number[] | undefined, maps: MapLayout[]) {
  let wins = 0, shots = 0;
  const scores = maps.map((layout) => {
    const world = WumpusWorld.fromLayout(layout);
    const agent = createAgent(id, world.size, world.pitProbability, genome);
    while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
    if (world.status === 'won') wins++;
    if (!world.hasArrow) shots++;
    return world.score;
  });
  const n = maps.length;
  const avg = scores.reduce((s, v) => s + v, 0) / n;
  return { scores, text: `${avg.toFixed(1)} pts, ${((100 * wins) / n).toFixed(1)}% vitórias, tiro em ${((100 * shots) / n).toFixed(1)}%` };
}

const opts = parseArgs(process.argv.slice(2));
const start = opts.start === 'padrao' ? DEFAULT_GENOME : BAYES_LIKE_GENOME;
const t0 = Date.now();
let genome: number[] = start;
for (const r of train({
  size: opts.sizes[0],
  sizes: opts.sizes,
  pitProbability: opts.pits,
  population: opts.pop,
  generations: opts.gens,
  mapsPerGeneration: opts.maps,
  validationMaps: opts.validation || undefined,
  seed: start,
  rng: mulberry32(seedFromText(opts.seed)),
})) {
  console.log(`${r.validated ? 'validação' : `geração ${r.generation}`}: melhor ${r.best.toFixed(1)}, média ${r.average.toFixed(1)}`);
  genome = r.bestGenome;
}
const rounded = genome.map((v) => Math.round(v * 100) / 100);
console.log(`\nGenoma treinado (${((Date.now() - t0) / 1000).toFixed(0)} s): [${rounded.join(', ')}]`);

for (const size of opts.sizes) {
  const maps = arenaMaps(`${opts.seed}-comparacao-${size}`, opts.compare, size, opts.pits);
  const bayes = play('bayes', undefined, maps);
  const current = play('genetic', DEFAULT_GENOME, maps);
  const trained = play('genetic', rounded, maps);
  const vs = (a: number[], b: number[]) => {
    const p = pairedDiff(a, b);
    return `${p.mean >= 0 ? '+' : ''}${p.mean.toFixed(1)} (IC 95%: ${p.low.toFixed(1)} a ${p.high.toFixed(1)})`;
  };
  console.log(`\nComparação em ${opts.compare} mapas novos ${size}×${size}:`);
  console.log(`  Probabilístico:       ${bayes.text}`);
  console.log(`  DEFAULT_GENOME atual: ${current.text}`);
  console.log(`  Genoma treinado:      ${trained.text}`);
  console.log(`  Treinado − probabilístico: ${vs(trained.scores, bayes.scores)}; treinado − atual: ${vs(trained.scores, current.scores)}`);
}
