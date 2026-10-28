// Agentes que jogam sozinhos. Cada um recebe só o que um jogador real saberia:
// as percepções da sala atual, a própria posição/direção e o que carrega.
import { key, type Action, type Cell, type Dir, type Percepts, type WumpusWorld } from '../game/world';
import { Knowledge, type CellBelief } from './knowledge';

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

export type AgentId = 'human' | 'random' | 'logic' | 'bayes';

export const AGENTS: Record<AgentId, { label: string; description: string }> = {
  human: { label: 'Você (teclado)', description: 'Você joga com o teclado ou os botões.' },
  random: {
    label: 'Agente aleatório',
    description: 'Anda e gira ao acaso. Só pega o ouro se tropeçar nele. Serve de base de comparação.',
  },
  logic: {
    label: 'Agente lógico',
    description:
      'Deduz quais salas são seguras pelas percepções e só pisa onde tem certeza. Atira quando descobre onde está o Wumpus. Se não houver mais saída segura, volta e sai da caverna.',
  },
  bayes: {
    label: 'Agente probabilístico',
    description:
      'Faz as mesmas deduções do agente lógico. Quando não há sala garantidamente segura, calcula a probabilidade de poço e de Wumpus em cada sala e arrisca a de menor risco.',
  },
};

export function createAgent(
  id: Exclude<AgentId, 'human'>,
  size: number,
  pitProbability: number,
  riskTolerance = 0.3,
): Agent {
  if (id === 'random') return new RandomAgent();
  return new ReasoningAgent(size, pitProbability, id === 'bayes' ? riskTolerance : 0);
}

const fmt = (k: string) => {
  const [x, y] = k.split(',').map(Number);
  return `(${x + 1}, ${y + 1})`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

class RandomAgent implements Agent {
  thought = '';

  decide(s: Senses): Action {
    if (s.percepts.glitter && !s.hasGold) return this.say('Brilho! Pegando o ouro.', 'grab');
    if (s.hasGold && s.x === 0 && s.y === 0) return this.say('Estou na entrada com o ouro.', 'climb');
    const r = Math.random();
    const a: Action = r < 0.6 ? 'forward' : r < 0.8 ? 'left' : 'right';
    return this.say('Escolhendo uma ação qualquer...', a);
  }

  beliefs() {
    return null;
  }

  private say(thought: string, a: Action) {
    this.thought = thought;
    return a;
  }
}

class ReasoningAgent implements Agent {
  thought = '';
  private kb: Knowledge;
  private riskTolerance: number; // 0 = nunca arrisca (agente lógico)
  private pendingShot: { from: Cell; dir: Dir } | null = null;

  constructor(size: number, pitProbability: number, riskTolerance: number) {
    this.kb = new Knowledge(size, pitProbability);
    this.riskTolerance = riskTolerance;
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

    const here = key(s.x, s.y);

    // 1. Ouro aqui? Pega.
    if (p.glitter && !s.hasGold) return this.say('Brilho! O ouro está aqui.', 'grab');

    // 2. Com o ouro: volta pelo caminho conhecido e sai.
    if (s.hasGold) return this.goHome(s, 'Tenho o ouro, voltando para a entrada.');

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

    // 5. Agente probabilístico: arrisca a sala da fronteira com menor risco.
    if (this.riskTolerance > 0) {
      const beliefs = kb.beliefs();
      const risk = (k: string) => {
        const b = beliefs.get(k)!;
        return 1 - (1 - b.pit) * (1 - b.wumpus);
      };
      const options = kb
        .allCells()
        .filter((k) => kb.isFrontier(k))
        .sort((a, b) => risk(a) - risk(b));
      for (const target of options) {
        if (risk(target) > this.riskTolerance) break; // arriscado demais
        const path = this.route(here, new Set([target]), (k) => kb.visited.has(k));
        if (path) return this.walk(s, path, `Nenhuma sala é garantida. ${fmt(target)} tem o menor risco (${pct(risk(target))}), arriscando.`);
      }
      if (options.length) {
        return this.goHome(s, `A sala menos perigosa tem ${pct(risk(options[0]))} de risco, acima do limite. Voltando.`);
      }
    }

    // 6. Não há jogada segura: desiste e sai vivo.
    return this.goHome(s, 'Não há mais sala segura. Voltando para sair vivo.');
  }

  /** Vai até uma sala alinhada com o Wumpus e atira. */
  private planShot(s: Senses, candidates: Set<string>, walkable: (k: string) => boolean): Action | null {
    const kb = this.kb;
    const here = key(s.x, s.y);
    // Só atira se souber exatamente onde ele está, ou (agente lógico) se estiver travado
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

  private goHome(s: Senses, thought: string): Action {
    if (s.x === 0 && s.y === 0) return this.say(s.hasGold ? 'Na entrada com o ouro. Saindo!' : 'Na entrada. Saindo da caverna.', 'climb');
    const path = this.route(key(s.x, s.y), new Set([key(0, 0)]), (k) => this.kb.visited.has(k))!;
    return this.walk(s, path, thought);
  }

  /** Busca em largura: menor caminho até qualquer sala de `goals`, pisando só em salas `passable`. */
  private route(from: string, goals: Set<string>, passable: (k: string) => boolean): string[] | null {
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
  private walk(s: Senses, path: string[], thought: string): Action {
    const [nx, ny] = path[1].split(',').map(Number);
    const want = this.dirTo(s.x, s.y, nx, ny);
    if (s.dir !== want) return this.turn(s.dir, want, thought);
    return this.say(thought, 'forward');
  }

  private dirTo(x: number, y: number, tx: number, ty: number): Dir {
    if (tx > x) return 0;
    if (ty > y) return 1;
    if (tx < x) return 2;
    return 3;
  }

  private turn(dir: Dir, want: Dir, thought: string): Action {
    return this.say(thought, (want - dir + 4) % 4 === 3 ? 'right' : 'left');
  }

  private say(thought: string, a: Action) {
    this.thought = thought;
    return a;
  }
}
