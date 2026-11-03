// Agentes que jogam sozinhos. Cada um recebe só o que um jogador real saberia:
// as percepções da sala atual, a própria posição/direção e o que carrega.
import { key, parseKey, type Action, type Cell, type Dir, type Percepts, type WumpusWorld } from '../game/world';
import { percent } from '../util/format';
import { Knowledge, riskOf, type CellBelief } from './knowledge';
import { CELL_GENES, DEFAULT_GENOME, GENES } from './genome';

export interface Senses {
  x: number;
  y: number;
  dir: Dir;
  hasArrow: boolean;
  hasGold: boolean;
  percepts: Percepts;
}

export const sensesOf = (w: WumpusWorld): Senses => ({
  x: w.agent.x,
  y: w.agent.y,
  dir: w.agent.dir,
  hasArrow: w.hasArrow,
  hasGold: w.hasGold,
  percepts: w.percepts,
});

export interface Agent {
  /** Pensamento da última decisão, mostrado na tela */
  thought: string;
  decide(s: Senses): Action;
  /** O que o agente acredita sobre as salas não visitadas (para desenhar o raciocínio) */
  beliefs(): Map<string, CellBelief> | null;
}

export type AgentId = 'human' | 'random' | 'logic' | 'bayes' | 'genetic';

export const AGENTS: Record<AgentId, { label: string; description: string }> = {
  human: { label: 'Você (teclado)', description: 'Você joga com o teclado ou os botões.' },
  random: {
    label: 'Agente aleatório',
    description: 'Anda e gira ao acaso. Só pega o ouro se tropeçar nele. Serve de base de comparação.',
  },
  logic: {
    label: 'Agente lógico',
    description:
      'Deduz quais salas são seguras pelas percepções e pisa nelas primeiro. Atira quando descobre onde está o Wumpus. Sem sala comprovadamente segura, chuta a que tem menos indícios de perigo.',
  },
  bayes: {
    label: 'Agente probabilístico',
    description:
      'Faz as mesmas deduções do agente lógico. Quando não há sala garantidamente segura, calcula a probabilidade de poço e de Wumpus em cada sala e arrisca a de menor risco.',
  },
  genetic: {
    label: 'Agente genético',
    description:
      'Escolhe a próxima sala com uma fórmula de pesos (risco, distância, salas novas por perto...). Os pesos não foram escritos à mão: um algoritmo genético os evoluiu jogando milhares de partidas. Você pode treinar de novo abaixo.',
  },
};

export function createAgent(id: Exclude<AgentId, 'human'>, size: number, pitProbability: number, genome?: number[]): Agent {
  if (id === 'random') return new RandomAgent();
  if (id === 'genetic') return new GeneticAgent(size, pitProbability, genome ?? DEFAULT_GENOME);
  return new ReasoningAgent(size, pitProbability, id);
}

/** Sala no formato da tela (1-based): "2,0" → "(3, 1)". */
const cellName = (k: string) => {
  const [x, y] = parseKey(k);
  return `(${x + 1}, ${y + 1})`;
};

/** Direção do primeiro passo de (x, y) para uma sala vizinha (tx, ty). */
function dirTo(x: number, y: number, tx: number, ty: number): Dir {
  if (tx > x) return 0;
  if (ty > y) return 1;
  if (tx < x) return 2;
  return 3;
}

/** Base dos agentes: guarda o pensamento da última decisão. */
abstract class ThinkingAgent implements Agent {
  thought = '';

  abstract decide(s: Senses): Action;

  beliefs(): Map<string, CellBelief> | null {
    return null;
  }

  protected say(thought: string, a: Action) {
    this.thought = thought;
    return a;
  }
}

class RandomAgent extends ThinkingAgent {
  decide(s: Senses): Action {
    if (s.percepts.glitter && !s.hasGold) return this.say('Brilho! Pegando o ouro.', 'grab');
    const r = Math.random();
    const a: Action = r < 0.6 ? 'forward' : r < 0.8 ? 'left' : 'right';
    return this.say('Escolhendo uma ação qualquer...', a);
  }
}

/** O que o agente sabe sobre o Wumpus e por onde pode andar sem risco, a cada decisão. */
interface Situation {
  here: string;
  candidates: Set<string>; // salas onde o Wumpus ainda pode estar
  walkable: (k: string) => boolean; // visitada ou comprovadamente segura
}

export class ReasoningAgent extends ThinkingAgent {
  protected kb: Knowledge;
  private mode: 'logic' | 'bayes';
  private pendingShot: { from: Cell; dir: Dir } | null = null;

  constructor(size: number, pitProbability: number, mode: 'logic' | 'bayes') {
    super();
    this.kb = new Knowledge(size, pitProbability);
    this.mode = mode;
  }

  beliefs() {
    return this.kb.beliefs();
  }

  decide(s: Senses): Action {
    this.learn(s);

    // 1. Ouro aqui? Pega.
    if (s.percepts.glitter && !s.hasGold) return this.say('Brilho! O ouro está aqui.', 'grab');

    // 2. Com o ouro: volta pelo caminho conhecido (chegar na entrada com ele é a vitória).
    if (s.hasGold) return this.goHome(s, 'Tenho o ouro, voltando para a entrada.');

    return this.explore(s);
  }

  /** Registra as percepções; se o último tiro não fez o Wumpus gritar, a linha do tiro está limpa. */
  private learn(s: Senses) {
    const p = s.percepts;
    this.kb.observe(s.x, s.y, p.breeze, p.stench, p.scream);
    if (this.pendingShot && !p.scream) this.kb.arrowMissed(this.pendingShot.from, this.pendingShot.dir);
    this.pendingShot = null;
  }

  protected situation(s: Senses): Situation {
    const kb = this.kb;
    const candidates = kb.wumpusCandidates();
    return { here: key(s.x, s.y), candidates, walkable: (k) => kb.visited.has(k) || kb.safe(k, candidates) };
  }

  /** Decide para onde ir quando ainda não tem o ouro. */
  protected explore(s: Senses): Action {
    const kb = this.kb;
    const sit = this.situation(s);

    // 3. Explora a sala segura não visitada mais próxima.
    const safeTargets = kb.allCells().filter((k) => !kb.visited.has(k) && kb.safe(k, sit.candidates));
    const toSafe = this.route(sit.here, new Set(safeTargets), sit.walkable);
    if (toSafe) return this.walk(s, toSafe, `${cellName(toSafe[toSafe.length - 1])} é segura, indo explorar.`);

    // 4. Sem salas seguras: tenta abrir caminho matando o Wumpus.
    if (s.hasArrow && sit.candidates.size > 0) {
      const shot = this.planShot(s, sit);
      if (shot) return shot;
    }

    // 5. Sem sala segura e sem como desistir: precisa arriscar uma sala da fronteira.
    return this.gamble(s, sit);
  }

  /** Escolhe a sala da fronteira menos perigosa; a distância pelas salas visitadas desempata. */
  private gamble(s: Senses, sit: Situation): Action {
    const options = this.frontier(sit.candidates);
    if (!options.length) return this.idle();
    const paths = new Map(options.map((k) => [k, this.route(sit.here, new Set([k]), (c) => this.kb.visited.has(c))!]));
    const dist = (k: string) => paths.get(k)!.length;
    const danger = this.mode === 'bayes' ? this.riskMeasure() : this.evidenceCount();
    const target = options.sort((a, b) => danger(a) - danger(b) || dist(a) - dist(b))[0];
    const thought =
      this.mode === 'bayes'
        ? `Nenhuma sala é garantida. ${cellName(target)} tem o menor risco (${percent(danger(target))}), arriscando.`
        : `Nenhuma sala é comprovadamente segura. Chutando ${cellName(target)}, a com menos indícios de perigo.`;
    return this.walk(s, paths.get(target)!, thought);
  }

  /** Agente probabilístico: P(poço) + P(Wumpus) de cada sala. */
  private riskMeasure() {
    const beliefs = this.kb.beliefs();
    return (k: string) => riskOf(beliefs.get(k)!);
  }

  /**
   * Agente lógico não usa probabilidades. A lógica só diz que as salas "não são perigo certo";
   * para escolher entre elas, conta os indícios (brisas e fedores) ao redor, uma regra prática.
   */
  private evidenceCount() {
    const kb = this.kb;
    return (k: string) =>
      kb.neighbors(k).reduce((n, v) => {
        const o = kb.visited.get(v);
        return n + (o?.breeze ? 1 : 0) + (o?.stench && !kb.wumpusDead ? 1 : 0);
      }, 0);
  }

  /** Salas da fronteira que não são perigo certo (poço deduzido ou Wumpus localizado). */
  protected frontier(candidates: Set<string>): string[] {
    const kb = this.kb;
    const pits = kb.certainPits();
    return kb
      .allCells()
      .filter((k) => kb.isFrontier(k) && !pits.has(k) && !(candidates.size === 1 && candidates.has(k)));
  }

  /** Nada a fazer (todas as saídas são morte certa): gira no lugar até o limite de ações. */
  protected idle(): Action {
    return this.say('Todas as salas que restam são perigo certo. Sem jogadas possíveis.', 'left');
  }

  /**
   * Vai até uma sala alinhada com o Wumpus e atira. Chega aqui só sem sala segura para explorar.
   * Atira se souber onde ele está ou se restarem até 3 salas possíveis: mesmo errando, a falta do
   * grito limpa a linha do tiro.
   */
  protected planShot(s: Senses, sit: Situation): Action | null {
    const { candidates } = sit;
    const targets = candidates.size <= 3 ? [...candidates] : [];
    const certain = candidates.size === 1 ? 'Deduzi que o Wumpus está em' : 'O Wumpus pode estar em';
    for (const target of targets) {
      const path = this.route(sit.here, new Set(this.firingSpots(target)), sit.walkable);
      if (!path) continue;
      const aim = `${certain} ${cellName(target)}.`;
      if (path.length > 1) return this.walk(s, path, `${aim} Indo para a linha de tiro.`);
      const [tx, ty] = parseKey(target);
      const want = dirTo(s.x, s.y, tx, ty);
      if (s.dir !== want) return this.turn(s.dir, want, `${aim} Mirando.`);
      this.pendingShot = { from: { x: s.x, y: s.y }, dir: s.dir };
      return this.say(`${aim} Atirando!`, 'shoot');
    }
    return null;
  }

  /** Salas visitadas na mesma linha ou coluna do alvo (de onde a flecha o alcança). */
  private firingSpots(target: string) {
    const [tx, ty] = parseKey(target);
    return [...this.kb.visited.keys()].filter((k) => {
      const [x, y] = parseKey(k);
      return x === tx || y === ty;
    });
  }

  protected goHome(s: Senses, thought: string): Action {
    const path = this.route(key(s.x, s.y), new Set([key(0, 0)]), (k) => this.kb.visited.has(k))!;
    return this.walk(s, path, thought);
  }

  /** Busca em largura: menor caminho até qualquer sala de `goals`, pisando só em salas `passable`. */
  protected route(from: string, goals: Set<string>, passable: (k: string) => boolean): string[] | null {
    if (goals.size === 0) return null;
    const prev = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (goals.has(cur)) {
        const path = [cur];
        for (let p = prev.get(cur); p; p = prev.get(p)) path.unshift(p);
        return path;
      }
      for (const n of this.kb.neighbors(cur)) {
        if (prev.has(n) || (!passable(n) && !goals.has(n))) continue;
        prev.set(n, cur);
        queue.push(n);
      }
    }
    return null;
  }

  /** Direção do primeiro passo de um caminho. */
  protected firstStepDir(s: Senses, path: string[]): Dir {
    const [nx, ny] = parseKey(path[1]);
    return dirTo(s.x, s.y, nx, ny);
  }

  /** Converte o próximo passo de um caminho em ação (girar ou andar). */
  protected walk(s: Senses, path: string[], thought: string): Action {
    const want = this.firstStepDir(s, path);
    if (s.dir !== want) return this.turn(s.dir, want, thought);
    return this.say(thought, 'forward');
  }

  protected turn(dir: Dir, want: Dir, thought: string): Action {
    return this.say(thought, (want - dir + 4) % 4 === 3 ? 'right' : 'left');
  }
}

/** Sala candidata do agente genético, com a nota dada pela fórmula. */
interface ScoredCell {
  cell: string;
  path: string[];
  score: number;
  safe: boolean;
}

/**
 * Agente genético: usa a mesma base de conhecimento dos agentes lógico e probabilístico,
 * mas escolhe a próxima sala por uma soma ponderada de características. Os pesos (genoma)
 * vêm do algoritmo genético em genetic.ts.
 */
export class GeneticAgent extends ReasoningAgent {
  private genome: number[];
  /**
   * Sala escolhida e quanto o agente sabia ao escolher. Enquanto ele só anda por salas conhecidas,
   * nada novo é aprendido, então a escolha vale até chegar. Sem isso, pesos que dependem da posição
   * (distância, giros) faziam o agente trocar de alvo a cada passo e andar em círculos até o tempo esgotar.
   */
  private plan: { target: string; known: number; dead: boolean; candidates: number } | null = null;

  constructor(size: number, pitProbability: number, genome: number[]) {
    super(size, pitProbability, 'bayes');
    if (genome.length !== GENES.length) throw new Error(`O genoma precisa ter ${GENES.length} pesos.`);
    this.genome = genome;
  }

  protected explore(s: Senses): Action {
    const sit = this.situation(s);
    const kept = this.followPlan(s, sit);
    if (kept) return kept;
    this.plan = null;

    const beliefs = this.kb.beliefs();
    const { best, anySafe } = this.bestCell(s, sit, beliefs);
    if (this.prefersShooting(s, sit.candidates, best, anySafe)) {
      const shot = this.planShot(s, sit);
      if (shot) return shot;
    }
    if (!best) return this.idle();

    this.plan = { target: best.cell, known: this.kb.visited.size, dead: this.kb.wumpusDead, candidates: sit.candidates.size };
    const risk = riskOf(beliefs.get(best.cell)!);
    return this.walk(
      s,
      best.path,
      `Pela fórmula evoluída, ${cellName(best.cell)} é a melhor opção (nota ${best.score.toFixed(2)}, ${best.safe ? 'segura' : `risco ${percent(risk)}`}).`,
    );
  }

  /** Mantém o alvo enquanto nada novo foi aprendido (mesmas salas visitadas, mesmo estado do Wumpus). */
  private followPlan(s: Senses, sit: Situation): Action | null {
    const plan = this.plan;
    const kb = this.kb;
    if (!plan || plan.known !== kb.visited.size || plan.dead !== kb.wumpusDead || plan.candidates !== sit.candidates.size) return null;
    if (!this.frontier(sit.candidates).includes(plan.target)) return null;
    const path = this.route(sit.here, new Set([plan.target]), sit.walkable);
    return path ? this.walk(s, path, `Seguindo para ${cellName(plan.target)}, escolhida pela fórmula evoluída.`) : null;
  }

  /** Pontua cada sala alcançável da fronteira e devolve a melhor. */
  private bestCell(s: Senses, sit: Situation, beliefs: Map<string, CellBelief>) {
    let best: ScoredCell | null = null;
    let anySafe = false;
    for (const cell of this.frontier(sit.candidates)) {
      const path = this.route(sit.here, new Set([cell]), sit.walkable);
      if (!path) continue;
      const safe = this.kb.safe(cell, sit.candidates);
      anySafe ||= safe;
      const score = this.weigh(this.cellFeatures(s, cell, path, safe, beliefs.get(cell)!));
      if (!best || score > best.score) best = { cell, path, score, safe };
    }
    return { best, anySafe };
  }

  /** As características de CELL_GENES (genome.ts), na mesma ordem. */
  private cellFeatures(s: Senses, cell: string, path: string[], safe: boolean, belief: CellBelief): number[] {
    const kb = this.kb;
    const size = kb.size;
    const [cx, cy] = parseKey(cell);
    const neighbors = kb.neighbors(cell);
    const share = (test: (n: string) => boolean) => neighbors.filter(test).length / 4;
    const diff = (this.firstStepDir(s, path) - s.dir + 4) % 4;
    const turns = diff === 0 ? 0 : diff === 2 ? 1 : 0.5;
    return [
      riskOf(belief),
      (path.length - 1) / size,
      safe ? 1 : 0,
      share((n) => !kb.visited.has(n)),
      (cx + cy) / (2 * size),
      turns,
      share((n) => !!kb.visited.get(n)?.breeze),
      share((n) => !!kb.visited.get(n)?.stench),
    ];
  }

  private weigh(features: number[]) {
    return features.reduce((sum, f, i) => sum + f * this.genome[i], 0);
  }

  /** Nota da opção "atirar" (SHOOT_GENES), comparada com a da melhor sala. */
  private prefersShooting(s: Senses, candidates: Set<string>, best: ScoredCell | null, anySafe: boolean) {
    if (!s.hasArrow || candidates.size === 0 || candidates.size > 3) return false;
    const [bias, certainty, safeLeft] = this.genome.slice(CELL_GENES.length);
    const shootScore = bias + certainty * (1 / candidates.size) + safeLeft * (anySafe ? 1 : 0);
    return !best || shootScore > best.score;
  }
}
