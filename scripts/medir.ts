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

function measure(id: Exclude<AgentId, 'human'>, genome: number[] | undefined, maps: MapLayout[]) {
  let score = 0, wins = 0, shots = 0;
  for (const layout of maps) {
    const world = WumpusWorld.fromLayout(layout);
    const agent = createAgent(id, world.size, world.pitProbability, genome);
    while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
    score += world.score;
    if (world.status === 'won') wins++;
    if (!world.hasArrow) shots++;
  }
  const n = maps.length;
  return `${((100 * wins) / n).toFixed(1)}% vitórias, ${(score / n).toFixed(1)} pts, tiro em ${((100 * shots) / n).toFixed(0)}% das partidas`;
}

for (const [size, count] of [[4, arg('--mapas4', 5000)], [6, arg('--mapas6', 1000)]]) {
  const maps = arenaMaps(`medicao-${size}x${size}`, count, size, pits);
  console.log(`\n${size}×${size}, ${count} mapas, ${Math.round(pits * 100)}% de poços`);
  for (const [name, id, genome] of agents) console.log(`  ${name}: ${measure(id, genome, maps)}`);
}
