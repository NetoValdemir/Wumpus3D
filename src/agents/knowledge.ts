// Base de conhecimento do agente: tudo o que ele deduz a partir das percepções.
// O agente NÃO enxerga o mapa — só sabe onde já esteve e o que sentiu em cada sala.
import { DIR_VEC, key, type Cell, type Dir } from '../game/world';

export interface CellBelief {
  pit: number; // probabilidade de poço (0 a 1)
  wumpus: number; // probabilidade de Wumpus (0 a 1)
}

/**
 * Chance de morrer ao entrar na sala. O Wumpus nunca fica num poço (D16), então os dois
 * eventos são excludentes e as probabilidades se somam.
 */
export const riskOf = (b: CellBelief) => Math.min(1, b.pit + b.wumpus);

interface Observation {
  breeze: boolean;
  stench: boolean;
}

// Acima disso a enumeração exata fica lenta; usa uma estimativa
const MAX_ENUMERATION = 16;

export class Knowledge {
  readonly size: number;
  readonly pitPrior: number;
  readonly visited = new Map<string, Observation>();
  wumpusDead = false;
  private noWumpus = new Set<string>(); // salas limpas por uma flechada que errou

  constructor(size: number, pitPrior: number) {
    this.size = size;
    this.pitPrior = pitPrior;
  }

  neighbors(k: string): string[] {
    const [x, y] = k.split(',').map(Number);
    return Object.values(DIR_VEC)
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < this.size && ny < this.size)
      .map(([nx, ny]) => key(nx, ny));
  }

  allCells(): string[] {
    const cells: string[] = [];
    for (let x = 0; x < this.size; x++) for (let y = 0; y < this.size; y++) cells.push(key(x, y));
    return cells;
  }

  observe(x: number, y: number, breeze: boolean, stench: boolean, scream: boolean) {
    this.visited.set(key(x, y), { breeze, stench });
    if (scream) this.wumpusDead = true;
  }

  /** A flecha atravessou estas salas sem acertar nada: não há Wumpus nelas. */
  arrowMissed(from: Cell, dir: Dir) {
    const [dx, dy] = DIR_VEC[dir];
    let { x, y } = from;
    while (x + dx >= 0 && y + dy >= 0 && x + dx < this.size && y + dy < this.size) {
      x += dx;
      y += dy;
      this.noWumpus.add(key(x, y));
    }
  }

  /** Sem poço: já visitada, ou vizinha de uma sala visitada sem brisa. */
  pitFree(k: string) {
    return this.visited.has(k) || this.neighbors(k).some((n) => this.visited.get(n)?.breeze === false);
  }

  /**
   * Salas onde o Wumpus ainda pode estar, consistentes com todo fedor (e falta de fedor) sentido.
   * Poço deduzido também fica de fora: pela regra do jogo, o Wumpus nunca está num poço (D16).
   */
  wumpusCandidates(): Set<string> {
    if (this.wumpusDead) return new Set();
    const stenchCells = [...this.visited].filter(([, o]) => o.stench).map(([k]) => k);
    const pits = this.certainPits();
    return new Set(
      this.allCells().filter(
        (k) =>
          !this.visited.has(k) &&
          !this.noWumpus.has(k) &&
          !pits.has(k) &&
          !this.neighbors(k).some((n) => this.visited.get(n)?.stench === false) &&
          stenchCells.every((s) => this.neighbors(s).includes(k)),
      ),
    );
  }

  /** Salas que com certeza têm poço (dedução lógica: única explicação possível de uma brisa). */
  certainPits(): Set<string> {
    const pits = new Set<string>();
    for (const [k, o] of this.visited) {
      if (!o.breeze) continue;
      const unknown = this.neighbors(k).filter((n) => !this.pitFree(n));
      if (unknown.length === 1) pits.add(unknown[0]);
    }
    return pits;
  }

  safe(k: string, candidates = this.wumpusCandidates()) {
    return this.pitFree(k) && !candidates.has(k);
  }

  /**
   * Probabilidade de poço em cada sala não visitada (inferência bayesiana, como no cap. 12 do AIMA).
   * Enumera todas as combinações de poços na fronteira que explicam as brisas sentidas.
   */
  pitProbabilities(): Map<string, number> {
    const p = this.pitPrior;
    const result = new Map<string, number>();
    const unknown = this.allCells().filter((k) => !this.pitFree(k));
    const frontier = unknown.filter((k) => this.neighbors(k).some((n) => this.visited.has(n)));
    const breezy = [...this.visited].filter(([, o]) => o.breeze).map(([k]) => this.neighbors(k).filter((n) => frontier.includes(n)));

    for (const k of unknown) result.set(k, p); // fora da fronteira vale a probabilidade a priori

    if (frontier.length <= MAX_ENUMERATION) {
      const idx = new Map(frontier.map((k, i) => [k, i]));
      const masks = breezy.map((ns) => ns.reduce((m, n) => m | (1 << idx.get(n)!), 0));
      const weights = new Array(frontier.length).fill(0);
      let total = 0;
      for (let combo = 0; combo < 1 << frontier.length; combo++) {
        if (!masks.every((m) => (combo & m) !== 0)) continue; // não explica alguma brisa
        let w = 1;
        for (let i = 0; i < frontier.length; i++) w *= combo & (1 << i) ? p : 1 - p;
        total += w;
        for (let i = 0; i < frontier.length; i++) if (combo & (1 << i)) weights[i] += w;
      }
      frontier.forEach((k, i) => result.set(k, total ? weights[i] / total : p));
    } else {
      // Estimativa: uma brisa com u vizinhos desconhecidos dá ~1/u de chance a cada um
      for (const ns of breezy) for (const n of ns) result.set(n, Math.max(result.get(n)!, 1 / ns.length));
      for (const k of this.certainPits()) result.set(k, 1);
    }
    return result;
  }

  /**
   * Crença sobre cada sala não visitada. O Wumpus é sorteado entre as salas sem poço (D16), então
   * entre as candidatas P(Wumpus) é proporcional à chance de a sala NÃO ter poço.
   */
  beliefs(): Map<string, CellBelief> {
    const pits = this.pitProbabilities();
    const candidates = this.wumpusCandidates();
    const noPit = (k: string) => 1 - (pits.get(k) ?? 0);
    const total = [...candidates].reduce((s, k) => s + noPit(k), 0);
    const beliefs = new Map<string, CellBelief>();
    for (const k of this.allCells()) {
      if (this.visited.has(k)) continue;
      const wumpus = candidates.has(k) ? (total ? noPit(k) / total : 1 / candidates.size) : 0;
      beliefs.set(k, { pit: pits.get(k) ?? 0, wumpus });
    }
    return beliefs;
  }

  /** Sala ainda desconhecida mas vizinha de uma visitada (onde o agente pode ir em seguida). */
  isFrontier(k: string) {
    return !this.visited.has(k) && this.neighbors(k).some((n) => this.visited.has(n));
  }
}
