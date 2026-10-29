// Executa partidas da arena com qualquer Controller (embutido ou externo).
import { WumpusWorld, type MapLayout, type Status } from '../game/world';
import { createAgent, type AgentId } from '../agents/agents';
import { DEFAULT_GENOME } from '../agents/genome';
import { infoOf, publicSensesOf, type Controller, type Decision } from './protocol';
import { Referee } from './referee';

export type Outcome = Exclude<Status, 'playing'> | 'error';

export interface EpisodeResult {
  outcome: Outcome;
  score: number;
  actions: number;
  decisionMs: number; // tempo total gasto decidindo
  logicErrors: number;
  needlessRisks: number;
  bumps: number;
  shots: number;
  hits: number;
  gold: boolean; // pegou o ouro em algum momento
  error?: string;
}

export class DecisionTimeout extends Error {}

function withTimeout<T>(value: T | Promise<T>, ms: number): Promise<T> {
  if (!(value instanceof Promise)) return Promise.resolve(value);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DecisionTimeout(`O agente passou de ${ms} ms para decidir.`)), ms);
    value.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

export async function playEpisode(ctrl: Controller, layout: MapLayout, decisionTimeoutMs: number): Promise<EpisodeResult> {
  const world = WumpusWorld.fromLayout(layout);
  const referee = new Referee(world);
  let decisionMs = 0;
  let error: string | undefined;
  try {
    await withTimeout(ctrl.start(infoOf(world)), decisionTimeoutMs * 5);
    while (!world.gameOver) {
      const t = performance.now();
      const d = await withTimeout(ctrl.decide(publicSensesOf(world)), decisionTimeoutMs);
      decisionMs += performance.now() - t;
      referee.judge(world, d.action);
      world.step(d.action);
      referee.observe(world, d.action === 'shoot');
    }
  } catch (err) {
    error = (err as Error)?.message ?? String(err);
  }
  return {
    outcome: error ? 'error' : (world.status as Outcome),
    // Erro conta como derrota: perde o que tinha e a penalidade de morte
    score: error ? Math.min(world.score, 0) - 1000 : world.score,
    actions: world.actions,
    decisionMs,
    logicErrors: referee.logicErrors,
    needlessRisks: referee.needlessRisks,
    bumps: referee.bumps,
    shots: referee.shots,
    hits: referee.hits,
    gold: world.hasGold,
    error,
  };
}

/** Embrulha um agente embutido (aleatório, lógico...) como Controller. */
export function builtinController(id: Exclude<AgentId, 'human'>, opts: { genome?: number[]; withBeliefs?: boolean } = {}): Controller {
  let agent: ReturnType<typeof createAgent>;
  return {
    start(info) {
      agent = createAgent(id, info.size, info.pitProbability, opts.genome ?? DEFAULT_GENOME);
    },
    decide(s): Decision {
      const action = agent.decide(s);
      return { action, thought: agent.thought, beliefs: opts.withBeliefs ? (agent.beliefs() ?? undefined) : undefined };
    },
  };
}
