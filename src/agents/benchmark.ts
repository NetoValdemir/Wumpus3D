// Partidas rápidas sem 3D nem árbitro: usadas pelo treino do agente genético e pelos scripts de medição.
import { WumpusWorld, type MapLayout } from '../game/world';
import { createAgent, sensesOf, type AgentId } from './agents';

export type BuiltinAgentId = Exclude<AgentId, 'human'>;

/** Joga o mapa do começo ao fim com um agente embutido e devolve o mundo no estado final. */
export function playToEnd(id: BuiltinAgentId, layout: MapLayout, genome?: number[]): WumpusWorld {
  const world = WumpusWorld.fromLayout(layout);
  const agent = createAgent(id, world.size, world.pitProbability, genome);
  while (!world.gameOver) world.step(agent.decide(sensesOf(world)));
  return world;
}

/** Pontuação de cada partida, vitórias e partidas em que a flecha foi usada, nos mapas dados. */
export function playMaps(id: BuiltinAgentId, genome: number[] | undefined, maps: MapLayout[]) {
  let wins = 0;
  let shots = 0;
  const scores = maps.map((layout) => {
    const world = playToEnd(id, layout, genome);
    if (world.status === 'won') wins++;
    if (!world.hasArrow) shots++;
    return world.score;
  });
  const avg = scores.reduce((s, v) => s + v, 0) / maps.length;
  return { scores, wins, shots, avg };
}
