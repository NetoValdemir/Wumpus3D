// Roda várias partidas sem 3D para medir o desempenho de um agente.
import { WumpusWorld, type MapLayout, type Status } from '../game/world';
import { createAgent, sensesOf, type AgentId } from './agents';

export interface BenchmarkResult {
  games: number;
  wins: number;
  deaths: number;
  timeouts: number;
  avgScore: number;
}

export interface EpisodeOptions {
  size: number;
  pitProbability: number;
  /** Se informado, joga sempre este mapa em vez de sortear */
  layout?: MapLayout | null;
  /** Pesos do agente genético */
  genome?: number[];
}

export function runEpisode(id: Exclude<AgentId, 'human'>, opts: EpisodeOptions) {
  const world = opts.layout ? WumpusWorld.fromLayout(opts.layout) : new WumpusWorld(opts.size, opts.pitProbability);
  const agent = createAgent(id, world.size, world.pitProbability, opts.genome);
  while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
  return { status: world.status as Status, score: world.score };
}

export function benchmark(id: Exclude<AgentId, 'human'>, opts: EpisodeOptions, games = 100): BenchmarkResult {
  const r: BenchmarkResult = { games, wins: 0, deaths: 0, timeouts: 0, avgScore: 0 };
  for (let i = 0; i < games; i++) {
    const e = runEpisode(id, opts);
    if (e.status === 'won') r.wins++;
    else if (e.status === 'timeout') r.timeouts++;
    else r.deaths++;
    r.avgScore += e.score / games;
  }
  return r;
}
