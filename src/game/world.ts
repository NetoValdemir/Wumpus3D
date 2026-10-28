// Lógica pura do Mundo de Wumpus — não depende de nada de 3D.
// Coordenadas: x = coluna (0 = oeste), y = linha (0 = sul). O agente começa em (0,0).

export type Dir = 0 | 1 | 2 | 3; // 0 = leste, 1 = norte, 2 = oeste, 3 = sul
export const DIR_VEC: Record<Dir, [number, number]> = {
  0: [1, 0],
  1: [0, 1],
  2: [-1, 0],
  3: [0, -1],
};
export const DIR_NAME: Record<Dir, string> = { 0: 'Leste', 1: 'Norte', 2: 'Oeste', 3: 'Sul' };

export type Action = 'forward' | 'left' | 'right' | 'shoot' | 'grab';
export type Status = 'playing' | 'won' | 'dead-pit' | 'dead-wumpus' | 'timeout';

export interface Cell {
  x: number;
  y: number;
}

export interface Percepts {
  stench: boolean; // fedor: Wumpus em sala adjacente (ou na mesma)
  breeze: boolean; // brisa: poço em sala adjacente
  glitter: boolean; // brilho: ouro nesta sala
  bump: boolean; // batida: andou contra a parede
  scream: boolean; // grito: a flecha matou o Wumpus
}

export interface StepResult {
  percepts: Percepts;
  message: string;
  arrow?: { from: Cell; to: Cell; hit: boolean };
}

export const SCORE = {
  action: -1,
  shoot: -10,
  // Bônus pequeno de propósito: dá lucro (+14 líquido do tiro), mas chutar às cegas segue com
  // valor esperado negativo mesmo no 3×3 (25% × 25 < 11) e não compensa desviar do ouro. Ver D14.
  wumpusKill: 25,
  death: -1000,
  gold: 1000, // ao pegar o ouro
  escape: 500, // bônus de vitória: voltar à entrada com o ouro
};

/** Limite de ações por partida, para que nenhum jogo dure para sempre. */
export const maxActionsFor = (size: number) => size * size * 20;

/**
 * Quantos poços um mapa sorteado tem: a porcentagem vale sobre o total de casas, arredondada
 * (20% de 16 casas = 3 poços no 4×4). Pelo menos 1, e sempre sobra espaço para a entrada e o ouro. Ver D15.
 */
export const pitCountFor = (size: number, pitProbability: number) =>
  pitProbability <= 0 ? 0 : Math.min(size * size - 3, Math.max(1, Math.round(pitProbability * size * size)));

export const key = (x: number, y: number) => `${x},${y}`;

/**
 * Configuração de um mapa, no formato usado para salvar, exportar e importar.
 * As coordenadas começam em 1, como aparecem na tela: [coluna, linha].
 */
export interface MapLayout {
  format: 'wumpus3d-map';
  version: 1;
  name: string;
  size: number;
  pitProbability: number;
  pits: [number, number][];
  wumpus: [number, number];
  gold: [number, number];
}

export const MIN_SIZE = 3;
export const MAX_SIZE = 12;

/** Lê e valida um mapa vindo de JSON. Lança um Error com a explicação se algo estiver errado. */
export function parseLayout(json: string): MapLayout {
  let data: Partial<MapLayout>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('O texto não é um JSON válido.');
  }
  if (!data || data.format !== 'wumpus3d-map') throw new Error('Este JSON não é um mapa do Wumpus 3D (falta "format": "wumpus3d-map").');
  const size = data.size;
  if (!Number.isInteger(size) || size! < MIN_SIZE || size! > MAX_SIZE) {
    throw new Error(`"size" precisa ser um número inteiro entre ${MIN_SIZE} e ${MAX_SIZE}.`);
  }
  const n = size!;
  const cell = (c: unknown, what: string): [number, number] => {
    if (!Array.isArray(c) || c.length !== 2 || !c.every((v) => Number.isInteger(v) && v >= 1 && v <= n)) {
      throw new Error(`${what} precisa ser [coluna, linha] com valores de 1 a ${n}.`);
    }
    if (c[0] === 1 && c[1] === 1) throw new Error(`${what} não pode ficar na entrada (1, 1).`);
    return [c[0], c[1]];
  };
  if (!Array.isArray(data.pits)) throw new Error('"pits" precisa ser uma lista de salas, por exemplo [[3, 1], [2, 4]].');
  const pits = data.pits.map((p, i) => cell(p, `O poço nº ${i + 1}`));
  const wumpus = cell(data.wumpus, '"wumpus"');
  const gold = cell(data.gold, '"gold"');
  if (pits.some(([x, y]) => x === gold[0] && y === gold[1])) throw new Error('O ouro está dentro de um poço: seria impossível vencer.');
  const pitProbability = typeof data.pitProbability === 'number' ? data.pitProbability : pits.length / (n * n - 1);
  return {
    format: 'wumpus3d-map',
    version: 1,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : 'Mapa importado',
    size: n,
    pitProbability,
    pits,
    wumpus,
    gold,
  };
}

export class WumpusWorld {
  readonly size: number;
  readonly pitProbability: number;
  /** Número de poços do mapa (não é passado aos agentes: eles só sabem a porcentagem) */
  readonly pitCount: number;
  readonly pits: Set<string>;
  readonly wumpus: Cell;
  wumpusAlive = true;
  gold: Cell | null;
  readonly goldStart: Cell; // onde o ouro estava no começo (depois de pego, `gold` vira null)

  agent: Cell & { dir: Dir } = { x: 0, y: 0, dir: 0 };
  hasArrow = true;
  hasGold = false;
  score = 0;
  actions = 0;
  readonly maxActions: number;
  status: Status = 'playing';
  readonly visited = new Set<string>([key(0, 0)]);
  percepts: Percepts;

  constructor(size = 4, pitProbability = 0.2, rng: () => number = Math.random, layout?: MapLayout) {
    this.size = layout?.size ?? size;
    this.pitProbability = layout?.pitProbability ?? pitProbability;
    this.maxActions = maxActionsFor(this.size);

    if (layout) {
      // Mapa salvo: coordenadas do arquivo começam em 1
      this.pits = new Set(layout.pits.map(([x, y]) => key(x - 1, y - 1)));
      this.wumpus = { x: layout.wumpus[0] - 1, y: layout.wumpus[1] - 1 };
      this.gold = this.goldStart = { x: layout.gold[0] - 1, y: layout.gold[1] - 1 };
      this.pitCount = this.pits.size;
      this.percepts = this.sense();
      return;
    }

    // Número fixo de poços, em salas sorteadas sem repetir; sorteia mapas até achar um em que dá para vencer
    this.pitCount = pitCountFor(size, pitProbability);
    for (;;) {
      const free: Cell[] = [];
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          if (x === 0 && y === 0) continue; // sala inicial é sempre segura
          free.push({ x, y });
        }
      }
      const shuffled = [...free];
      for (let i = 0; i < this.pitCount; i++) {
        const j = i + Math.floor(rng() * (shuffled.length - i));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const pits = new Set(shuffled.slice(0, this.pitCount).map((c) => key(c.x, c.y)));
      const pick = (from: Cell[]) => from[Math.floor(rng() * from.length)];
      const wumpus = pick(free);
      // O ouro nunca fica num poço nem na sala do Wumpus
      const goldOptions = free.filter((c) => !pits.has(key(c.x, c.y)) && !(c.x === wumpus.x && c.y === wumpus.y));
      if (goldOptions.length === 0) continue;
      const gold = pick(goldOptions);
      if (!WumpusWorld.reachable(size, pits, gold)) continue;

      this.pits = pits;
      this.wumpus = wumpus;
      this.gold = this.goldStart = gold;
      break;
    }

    this.percepts = this.sense();
  }

  static fromLayout(layout: MapLayout) {
    return new WumpusWorld(layout.size, layout.pitProbability, Math.random, layout);
  }

  /** Configuração inicial deste mapa (para salvar ou exportar), independente do andamento da partida. */
  toLayout(name: string): MapLayout {
    const gold = this.goldStart;
    return {
      format: 'wumpus3d-map',
      version: 1,
      name,
      size: this.size,
      pitProbability: this.pitProbability,
      pits: [...this.pits].map((k) => k.split(',').map((v) => Number(v) + 1) as [number, number]),
      wumpus: [this.wumpus.x + 1, this.wumpus.y + 1],
      gold: [gold.x + 1, gold.y + 1],
    };
  }

  /** Existe caminho da entrada até `target` sem passar por poços? (o Wumpus pode ser morto com a flecha) */
  private static reachable(size: number, pits: Set<string>, target: Cell) {
    const seen = new Set([key(0, 0)]);
    const queue: Cell[] = [{ x: 0, y: 0 }];
    while (queue.length) {
      const c = queue.shift()!;
      if (c.x === target.x && c.y === target.y) return true;
      for (const [dx, dy] of Object.values(DIR_VEC)) {
        const n = { x: c.x + dx, y: c.y + dy };
        const k = key(n.x, n.y);
        if (n.x < 0 || n.y < 0 || n.x >= size || n.y >= size || seen.has(k) || pits.has(k)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return false;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  hasPit(x: number, y: number) {
    return this.pits.has(key(x, y));
  }

  isVisited(x: number, y: number) {
    return this.visited.has(key(x, y));
  }

  neighbors(x: number, y: number): Cell[] {
    return Object.values(DIR_VEC)
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter((c) => this.inBounds(c.x, c.y));
  }

  get gameOver() {
    return this.status !== 'playing';
  }

  private sense(bump = false, scream = false): Percepts {
    const { x, y } = this.agent;
    const around = [{ x, y }, ...this.neighbors(x, y)];
    return {
      stench: around.some((c) => c.x === this.wumpus.x && c.y === this.wumpus.y),
      breeze: this.neighbors(x, y).some((c) => this.hasPit(c.x, c.y)),
      glitter: !!this.gold && this.gold.x === x && this.gold.y === y,
      bump,
      scream,
    };
  }

  step(action: Action): StepResult {
    if (this.gameOver) return { percepts: this.percepts, message: 'O jogo acabou. Pressione R para recomeçar.' };

    this.score += SCORE.action;
    this.actions++;
    let message = '';
    let bump = false;
    let scream = false;
    let arrow: StepResult['arrow'];
    const a = this.agent;

    switch (action) {
      case 'left':
        a.dir = ((a.dir + 1) % 4) as Dir;
        message = `Virou para ${DIR_NAME[a.dir]}.`;
        break;
      case 'right':
        a.dir = ((a.dir + 3) % 4) as Dir;
        message = `Virou para ${DIR_NAME[a.dir]}.`;
        break;
      case 'forward': {
        const [dx, dy] = DIR_VEC[a.dir];
        const nx = a.x + dx;
        const ny = a.y + dy;
        if (!this.inBounds(nx, ny)) {
          bump = true;
          message = 'Bateu na parede!';
          break;
        }
        a.x = nx;
        a.y = ny;
        this.visited.add(key(nx, ny));
        message = `Andou para (${nx + 1}, ${ny + 1}).`;
        if (this.hasPit(nx, ny)) {
          this.status = 'dead-pit';
          this.score += SCORE.death;
          message = 'Você caiu em um poço! Fim de jogo.';
        } else if (this.wumpusAlive && this.wumpus.x === nx && this.wumpus.y === ny) {
          this.status = 'dead-wumpus';
          this.score += SCORE.death;
          message = 'O Wumpus te devorou! Fim de jogo.';
        } else if (nx === 0 && ny === 0) {
          if (this.hasGold) {
            this.score += SCORE.escape;
            this.status = 'won';
            message = `Você voltou à entrada com o ouro! Vitória! (+${SCORE.escape})`;
          } else {
            message = 'De volta à entrada, mas sem o ouro. A partida continua.';
          }
        }
        break;
      }
      case 'shoot': {
        if (!this.hasArrow) {
          message = 'Você não tem mais flechas.';
          break;
        }
        this.hasArrow = false;
        this.score += SCORE.shoot;
        const [dx, dy] = DIR_VEC[a.dir];
        let cx = a.x;
        let cy = a.y;
        let hit = false;
        while (this.inBounds(cx + dx, cy + dy)) {
          cx += dx;
          cy += dy;
          if (this.wumpusAlive && this.wumpus.x === cx && this.wumpus.y === cy) {
            hit = true;
            break;
          }
        }
        arrow = { from: { x: a.x, y: a.y }, to: { x: cx, y: cy }, hit };
        if (hit) {
          this.wumpusAlive = false;
          this.score += SCORE.wumpusKill;
          scream = true;
          message = `AAARGH! Um grito ecoa pela caverna. O Wumpus morreu! (+${SCORE.wumpusKill})`;
        } else {
          message = 'A flecha se perdeu na escuridão...';
        }
        break;
      }
      case 'grab':
        if (this.gold && this.gold.x === a.x && this.gold.y === a.y) {
          this.gold = null;
          this.hasGold = true;
          this.score += SCORE.gold;
          message = `Você pegou o ouro! (+${SCORE.gold}) Volte para (1, 1) para vencer.`;
        } else {
          message = 'Não há nada para pegar aqui.';
        }
        break;
    }

    if (this.status === 'playing' && this.actions >= this.maxActions) {
      this.status = 'timeout';
      message = `Limite de ${this.maxActions} ações atingido. Fim de jogo.`;
    }

    this.percepts = this.sense(bump, scream);
    return { percepts: this.percepts, message, arrow };
  }
}
