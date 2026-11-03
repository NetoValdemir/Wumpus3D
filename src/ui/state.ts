// Estado da partida em andamento, compartilhado pelos módulos da interface.
// Só a interface usa: as regras ficam em game/world.ts e os agentes não enxergam nada daqui.
import type { MapLayout, WumpusWorld } from '../game/world';
import type { Controller, Decision } from '../arena/protocol';
import { DEFAULT_GENOME } from '../agents/genome';
import { loadGenome } from '../storage';
import { $ } from './dom';

/** Quem joga: 'human', um agente embutido ('logic', ...) ou um agente importado ('ext:<id>'). */
export type PlayerId = string;

/** Campos de configuração do painel ("Partida"). */
export const cfg = {
  size: $<HTMLSelectElement>('#cfg-size'),
  pits: $<HTMLSelectElement>('#cfg-pits'),
  agent: $<HTMLSelectElement>('#cfg-agent'),
  speed: $<HTMLInputElement>('#cfg-speed'),
  beliefs: $<HTMLInputElement>('#cfg-beliefs'),
};

export interface Match {
  world: WumpusWorld;
  layout: MapLayout; // configuração do mapa atual, para repetir com outro jogador
  mapName: string | null; // nome do mapa salvo/importado em uso (null = sorteado)
  challenge: { seed: string; index: number } | null; // desafio por semente (D20)
  playerId: PlayerId;
  controller: Controller | null; // o agente que está jogando (null = você)
  ready: Promise<void>; // agente pronto para a partida atual
  decision: Decision | null; // última decisão do agente (pensamento e crenças)
  game: number; // muda a cada partida, para ignorar respostas atrasadas de partidas anteriores
  stepping: boolean;
  playing: boolean;
  lastStep: number;
}

// world e layout são preenchidos pelo primeiro restart(), antes de qualquer leitura
export const match: Match = {
  world: undefined!,
  layout: undefined!,
  mapName: null,
  challenge: null,
  playerId: 'human',
  controller: null,
  ready: Promise.resolve(),
  decision: null,
  game: 0,
  stepping: false,
  playing: false,
  lastStep: 0,
};

export const isHuman = () => match.playerId === 'human';

/** Pesos treinados pelo usuário neste navegador (null = usa o genoma padrão). */
export const genetics = { trained: loadGenome() as number[] | null };

export const currentGenome = () => genetics.trained ?? DEFAULT_GENOME;

/** Nome para mostrar do mapa atual. */
export const currentMapName = () => match.mapName ?? `Mapa ${match.world.size}×${match.world.size}`;
