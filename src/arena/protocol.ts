// Contrato entre a arena e os agentes (embutidos ou criados por outros devs).
// Um agente externo é um arquivo .js que chama registerAgent({ name, author, create(info) { ... } }).
// Veja AGENTES.md para a documentação completa.
import type { Action, Dir, Percepts, WumpusWorld } from '../game/world';
import type { CellBelief } from '../agents/knowledge';
import { key } from '../game/world';

/** O que o agente recebe ao começar cada partida. */
export interface AgentInfo {
  size: number;
  pitProbability: number;
  maxActions: number;
}

/** O que o agente recebe a cada passo. Coordenadas começam em 0; a entrada é (0, 0). */
export interface PublicSenses {
  x: number;
  y: number;
  dir: Dir; // 0 = leste, 1 = norte, 2 = oeste, 3 = sul
  hasArrow: boolean;
  hasGold: boolean;
  step: number; // ações já feitas nesta partida
  percepts: Percepts;
}

export interface Decision {
  action: Action;
  thought?: string;
  beliefs?: Map<string, CellBelief>;
}

/** Quem joga uma partida na arena: um agente embutido ou um agente externo isolado. */
export interface Controller {
  start(info: AgentInfo): void | Promise<void>;
  decide(senses: PublicSenses): Decision | Promise<Decision>;
  dispose?(): void;
}

export interface AgentMeta {
  name: string;
  author: string;
  description: string;
}

const ACTIONS: Action[] = ['forward', 'left', 'right', 'shoot', 'grab'];

export const infoOf = (w: WumpusWorld): AgentInfo => ({ size: w.size, pitProbability: w.pitProbability, maxActions: w.maxActions });

export const publicSensesOf = (w: WumpusWorld): PublicSenses => ({
  x: w.agent.x,
  y: w.agent.y,
  dir: w.agent.dir,
  hasArrow: w.hasArrow,
  hasGold: w.hasGold,
  step: w.actions,
  percepts: { ...w.percepts },
});

/**
 * Valida o que o agente devolveu: uma ação ('forward', ...) ou { action, thought?, beliefs? }.
 * beliefs é uma lista de { x, y, pit?, wumpus? } com probabilidades de 0 a 1.
 */
export function normalizeDecision(raw: unknown, size: number): Decision {
  const obj = (typeof raw === 'string' ? { action: raw } : raw) as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') throw new Error(`decide() devolveu ${JSON.stringify(raw)}; esperado uma ação ou { action }.`);
  const action = obj.action as Action;
  if (!ACTIONS.includes(action)) throw new Error(`Ação inválida: ${JSON.stringify(obj.action)}. Use uma de: ${ACTIONS.join(', ')}.`);
  const decision: Decision = { action };
  if (typeof obj.thought === 'string') decision.thought = obj.thought.slice(0, 300);
  if (Array.isArray(obj.beliefs)) {
    const prob = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0);
    decision.beliefs = new Map();
    for (const b of obj.beliefs.slice(0, size * size)) {
      if (!b || !Number.isInteger(b.x) || !Number.isInteger(b.y) || b.x < 0 || b.y < 0 || b.x >= size || b.y >= size) continue;
      decision.beliefs.set(key(b.x, b.y), { pit: prob(b.pit), wumpus: prob(b.wumpus) });
    }
  }
  return decision;
}

/** Código que embrulha o arquivo do agente, igual no navegador (Worker) e no Node (vm). */
export const HARNESS_BEFORE = `
var __defs = [];
function registerAgent(def) { __defs.push(def); }
`;

export const HARNESS_AFTER = `
;var __def = __defs[0];
if (!__def) throw new Error('O arquivo não chamou registerAgent({ ... }).');
if (typeof __def.create !== 'function') throw new Error('registerAgent precisa de create(info), que devolve { decide(sentidos) }.');
var __meta = {
  name: String(__def.name || 'Agente sem nome').slice(0, 60),
  author: String(__def.author || 'anônimo').slice(0, 60),
  description: String(__def.description || '').slice(0, 300),
};
var __inst = null;
function __start(info) {
  __inst = __def.create(info);
  if (!__inst || typeof __inst.decide !== 'function') throw new Error('create(info) precisa devolver um objeto com decide(sentidos).');
}
function __decide(senses) { return __inst.decide(senses); }
`;
