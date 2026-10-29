// Mede os agentes embutidos nos mesmos mapas: é daqui que saem as tabelas de desempenho da documentação.
//
//   npm run medir -- [--mapas4 5000] [--mapas6 1000] [--pits 0.2]
//
// Mapas das sementes "medicao-4x4" e "medicao-6x6". Lotes pequenos variam muito (um lote difícil
// derruba todos os agentes juntos, mas a ordem entre agentes próximos muda): compare com 5000 mapas 4×4.
import { createAgent, sensesOf, type AgentId } from '../src/agents/agents';
import { BAYES_LIKE_GENOME, DEFAULT_GENOME } from '../src/agents/genome';
import { arenaMaps } from '../src/arena/rng';
import { WumpusWorld, type MapLayout } from '../src/game/world';
import { pairedDiff } from '../src/report/report';

const args = process.argv.slice(2);
const arg = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const pits = arg('--pits', 0.2);

const agents: [string, Exclude<AgentId, 'human'>, number[] | undefined][] = [
  ['Aleatório', 'random', undefined],
  ['Lógico', 'logic', undefined],
  ['Probabilístico', 'bayes', undefined],
  ['Genético (BAYES_LIKE_GENOME)', 'genetic', BAYES_LIKE_GENOME],
  ['Genético (DEFAULT_GENOME)', 'genetic', DEFAULT_GENOME],
];

/** Joga os mapas e devolve a pontuação de cada partida, mais um resumo em texto. */
function measure(id: Exclude<AgentId, 'human'>, genome: number[] | undefined, maps: MapLayout[]) {
  let wins = 0, shots = 0;
  const scores: number[] = [];
  for (const layout of maps) {
    const world = WumpusWorld.fromLayout(layout);
    const agent = createAgent(id, world.size, world.pitProbability, genome);
    while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
    scores.push(world.score);
    if (world.status === 'won') wins++;
    if (!world.hasArrow) shots++;
  }
  const n = maps.length;
  const avg = scores.reduce((s, v) => s + v, 0) / n;
  return { scores, text: `${((100 * wins) / n).toFixed(1)}% vitórias, ${avg.toFixed(1)} pts, tiro em ${((100 * shots) / n).toFixed(0)}% das partidas` };
}

for (const [size, count] of [[4, arg('--mapas4', 5000)], [6, arg('--mapas6', 1000)]]) {
  const maps = arenaMaps(`medicao-${size}x${size}`, count, size, pits);
  console.log(`\n${size}×${size}, ${count} mapas, ${Math.round(pits * 100)}% de poços`);
  const all = new Map<string, number[]>();
  for (const [name, id, genome] of agents) {
    const r = measure(id, genome, maps);
    all.set(name, r.scores);
    console.log(`  ${name}: ${r.text}`);
  }
  const base = all.get('Probabilístico')!;
  for (const name of ['Genético (BAYES_LIKE_GENOME)', 'Genético (DEFAULT_GENOME)']) {
    const p = pairedDiff(all.get(name)!, base);
    const verdict = p.low > 0 ? 'melhor que o probabilístico' : p.high < 0 ? 'pior que o probabilístico' : 'sem diferença comprovada';
    console.log(`  ${name} − Probabilístico: ${p.mean.toFixed(1)} pts por partida (IC 95%: ${p.low.toFixed(1)} a ${p.high.toFixed(1)}) → ${verdict}`);
  }
}
