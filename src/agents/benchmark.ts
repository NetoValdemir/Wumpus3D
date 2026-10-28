// Roda várias partidas sem 3D para medir o desempenho de um agente.
import { WumpusWorld, type Status } from '../game/world';
import { createAgent, sensesOf, type AgentId } from './agents';

export interface BenchmarkResult {
  games: number;
  wins: number;
  deaths: number;
  avgScore: number;
}

export function runEpisode(id: Exclude<AgentId, 'human'>, size: number, pitProbability: number, riskTolerance: number, maxSteps = 2000) {
  const world = new WumpusWorld(size, pitProbability);
  const agent = createAgent(id, size, pitProbability, riskTolerance);
  for (let i = 0; i < maxSteps && !world.gameOver; i++) world.step(agent.decide(sensesOf(world)));
  return { status: world.status as Status, score: world.score };
}

export function benchmark(
  id: Exclude<AgentId, 'human'>,
  size: number,
  pitProbability: number,
  riskTolerance: number,
  games = 100,
): BenchmarkResult {
  let wins = 0;
  let deaths = 0;
  let total = 0;
  for (let i = 0; i < games; i++) {
    const r = runEpisode(id, size, pitProbability, riskTolerance);
    if (r.status === 'won') wins++;
    if (r.status === 'dead-pit' || r.status === 'dead-wumpus') deaths++;
    total += r.score;
  }
  return { games, wins, deaths, avgScore: total / games };
}
