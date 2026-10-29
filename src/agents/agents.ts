// Agentes que jogam sozinhos. Cada um recebe só o que um jogador real saberia:
// as percepções da sala atual, a própria posição/direção e o que carrega.
import { key, type Action, type Cell, type Dir, type Percepts, type WumpusWorld } from '../game/world';
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

export const fmt = (k: string) => {
  const [x, y] = k.split(',').map(Number);
  return `(${x + 1}, ${y + 1})`;
};
export const pct = (v: number) => `${Math.round(v * 100)}%`;

class RandomAgent implements Agent {
  thought = '';

  decide(s: Senses): Action {
    if (s.percepts.glitter && !s.hasGold) return this.say('Brilho! Pegando o ouro.', 'grab');
    const r = Math.random();
    const a: Action = r < 0.6 ? 'forward' : r < 0.8 ? 'left' : 'right';
    return this.say('Escolhendo uma ação qualquer...', a);
  }

  beliefs() {
    return null;
  }

  protected say(thought: string, a: Action) {
    this.thought = thought;
    return a;
  }
}

export class ReasoningAgent implements Agent {
  thought = '';
  protected kb: Knowledge;
  private mode: 'logic' | 'bayes';
  private pendingShot: { from: Cell; dir: Dir } | null = null;

  constructor(size: number, pitProbability: number, mode: 'logic' | 'bayes') {
    this.kb = new Knowledge(size, pitProbability);
    this.mode = mode;
  }

  beliefs() {
    return this.kb.beliefs();
  }

  decide(s: Senses): Action {
    const kb = this.kb;
    const p = s.percepts;
    kb.observe(s.x, s.y, p.breeze, p.stench, p.scream);
    if (this.pendingShot && !p.scream) kb.arrowMissed(this.pendingShot.from, this.pendingShot.dir);
    this.pendingShot = null;

    // 1. Ouro aqui? Pega.
    if (p.glitter && !s.hasGold) return this.say('Brilho! O ouro está aqui.', 'grab');

    // 2. Com o ouro: volta pelo caminho conhecido (chegar na entrada com ele é a vitória).
    if (s.hasGold) return this.goHome(s, 'Tenho o ouro, voltando para a entrada.');

    return this.explore(s);
  }

  /** Decide para onde ir quando ainda não tem o ouro. */
  protected explore(s: Senses): Action {
    const kb = this.kb;
    const here = key(s.x, s.y);
    const candidates = kb.wumpusCandidates();
    const safe = (k: string) => kb.safe(k, candidates);
    const walkable = (k: string) => kb.visited.has(k) || safe(k);

    // 3. Explora a sala segura não visitada mais próxima.
    const safeTargets = kb.allCells().filter((k) => !kb.visited.has(k) && safe(k));
    const toSafe = this.route(here, new Set(safeTargets), walkable);
    if (toSafe) return this.walk(s, toSafe, `${fmt(toSafe[toSafe.length - 1])} é segura, indo explorar.`);

    // 4. Sem salas seguras: tenta abrir caminho matando o Wumpus.
    if (s.hasArrow && candidates.size > 0) {
      const shot = this.planShot(s, candidates, walkable);
      if (shot) return shot;
    }

    // 5. Sem sala segura e sem como desistir: precisa arriscar uma sala da fronteira.
    const options = this.frontier(candidates);
    if (!options.length) return this.idle();
    // Distância pelas salas já visitadas: desempate entre opções de mesmo risco (vai na mais perto)
    const paths = new Map(options.map((k) => [k, this.route(here, new Set([k]), (c) => kb.visited.has(c))!]));
    const dist = (k: string) => paths.get(k)!.length;
    if (this.mode === 'bayes') {
      const beliefs = kb.beliefs();
      const risk = (k: string) => riskOf(beliefs.get(k)!);
      const target = options.sort((a, b) => risk(a) - risk(b) || dist(a) - dist(b))[0];
      return this.walk(s, paths.get(target)!, `Nenhuma sala é garantida. ${fmt(target)} tem o menor risco (${pct(risk(target))}), arriscando.`);
    }
    // Agente lógico não usa probabilidades. A lógica só diz que estas salas "não são perigo certo";
    // para escolher entre elas, conta os indícios (brisas e fedores) ao redor, uma regra prática.
    const evidence = (k: string) =>
      kb.neighbors(k).reduce((n, v) => {
        const o = kb.visited.get(v);
        return n + (o?.breeze ? 1 : 0) + (o?.stench && !kb.wumpusDead ? 1 : 0);
      }, 0);
    const target = options.sort((a, b) => evidence(a) - evidence(b) || dist(a) - dist(b))[0];
    return this.walk(s, paths.get(target)!, `Nenhuma sala é comprovadamente segura. Chutando ${fmt(target)}, a com menos indícios de perigo.`);
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

  /** Vai até uma sala alinhada com o Wumpus e atira. */
  protected planShot(s: Senses, candidates: Set<string>, walkable: (k: string) => boolean): Action | null {
    const kb = this.kb;
    const here = key(s.x, s.y);
    // Chega aqui só sem sala segura para explorar. Atira se souber onde ele está ou se restarem
    // até 3 salas possíveis: mesmo errando, a falta do grito limpa a linha do tiro.
    const targets = candidates.size === 1 ? [...candidates] : candidates.size <= 3 ? [...candidates] : [];
    for (const target of targets) {
      const [tx, ty] = target.split(',').map(Number);
      const spots = [...kb.visited.keys()].filter((k) => {
        const [x, y] = k.split(',').map(Number);
        return x === tx || y === ty;
      });
      const path = this.route(here, new Set(spots), walkable);
      if (!path) continue;
      const certain = candidates.size === 1 ? 'Deduzi que o Wumpus está em' : 'O Wumpus pode estar em';
      if (path.length > 1) return this.walk(s, path, `${certain} ${fmt(target)}. Indo para a linha de tiro.`);
      const want = this.dirTo(s.x, s.y, tx, ty);
      if (s.dir !== want) return this.turn(s.dir, want, `${certain} ${fmt(target)}. Mirando.`);
      this.pendingShot = { from: { x: s.x, y: s.y }, dir: s.dir };
      return this.say(`${certain} ${fmt(target)}. Atirando!`, 'shoot');
    }
    return null;
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

  /** Converte o próximo passo de um caminho em ação (girar ou andar). */
  protected walk(s: Senses, path: string[], thought: string): Action {
    const [nx, ny] = path[1].split(',').map(Number);
    const want = this.dirTo(s.x, s.y, nx, ny);
    if (s.dir !== want) return this.turn(s.dir, want, thought);
    return this.say(thought, 'forward');
  }

  protected dirTo(x: number, y: number, tx: number, ty: number): Dir {
    if (tx > x) return 0;
    if (ty > y) return 1;
    if (tx < x) return 2;
    return 3;
  }

  protected turn(dir: Dir, want: Dir, thought: string): Action {
    return this.say(thought, (want - dir + 4) % 4 === 3 ? 'right' : 'left');
  }

  protected say(thought: string, a: Action) {
    this.thought = thought;
    return a;
  }
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
    const kb = this.kb;
    const size = kb.size;
    const here = key(s.x, s.y);
    const candidates = kb.wumpusCandidates();
    const walkable = (k: string) => kb.visited.has(k) || kb.safe(k, candidates);
    const beliefs = kb.beliefs();
    const g = this.genome;

    // Mantém o alvo enquanto nada novo foi aprendido (mesmas salas visitadas, mesmo estado do Wumpus)
    const plan = this.plan;
    if (plan && plan.known === kb.visited.size && plan.dead === kb.wumpusDead && plan.candidates === candidates.size) {
      const path = this.frontier(candidates).includes(plan.target) ? this.route(here, new Set([plan.target]), walkable) : null;
      if (path) return this.walk(s, path, `Seguindo para ${fmt(plan.target)}, escolhida pela fórmula evoluída.`);
    }
    this.plan = null;

    // Pontua cada sala da fronteira
    let best: { cell: string; path: string[]; score: number; safe: boolean } | null = null;
    let anySafe = false;
    for (const cell of this.frontier(candidates)) {
      const path = this.route(here, new Set([cell]), walkable);
      if (!path) continue;
      const b = beliefs.get(cell)!;
      const safe = kb.safe(cell, candidates);
      anySafe ||= safe;
      const [cx, cy] = cell.split(',').map(Number);
      const neighbors = kb.neighbors(cell);
      const [nx, ny] = path[1].split(',').map(Number);
      const diff = (this.dirTo(s.x, s.y, nx, ny) - s.dir + 4) % 4;
      const turns = diff === 0 ? 0 : diff === 2 ? 1 : 0.5;
      const features = [
        riskOf(b),
        (path.length - 1) / size,
        safe ? 1 : 0,
        neighbors.filter((n) => !kb.visited.has(n)).length / 4,
        (cx + cy) / (2 * size),
        turns,
        neighbors.filter((n) => kb.visited.get(n)?.breeze).length / 4,
        neighbors.filter((n) => kb.visited.get(n)?.stench).length / 4,
      ];
      const score = features.reduce((sum, f, i) => sum + f * g[i], 0);
      if (!best || score > best.score) best = { cell, path, score, safe };
    }

    // Pontua a opção de atirar
    if (s.hasArrow && candidates.size > 0 && candidates.size <= 3) {
      const [bias, certainty, safeLeft] = g.slice(CELL_GENES.length);
      const shootScore = bias + certainty * (1 / candidates.size) + safeLeft * (anySafe ? 1 : 0);
      if (!best || shootScore > best.score) {
        const shot = this.planShot(s, candidates, walkable);
        if (shot) return shot;
      }
    }

    if (!best) return this.idle();
    this.plan = { target: best.cell, known: kb.visited.size, dead: kb.wumpusDead, candidates: candidates.size };
    const risk = riskOf(beliefs.get(best.cell)!);
    return this.walk(
      s,
      best.path,
      `Pela fórmula evoluída, ${fmt(best.cell)} é a melhor opção (nota ${best.score.toFixed(2)}, ${best.safe ? 'segura' : `risco ${pct(risk)}`}).`,
    );
  }
}
