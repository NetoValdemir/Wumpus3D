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

/** Inverso de `key`: "2,3" → [2, 3]. */
export const parseKey = (k: string) => k.split(',').map(Number) as [number, number];

export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/** A sala (x, y) existe num mapa `size` × `size`? */
export const inGrid = (size: number, x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;

/** Salas vizinhas (leste, norte, oeste, sul) que existem no mapa. */
export const gridNeighbors = (size: number, x: number, y: number): Cell[] =>
  Object.values(DIR_VEC)
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((c) => inGrid(size, c.x, c.y));

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

/** Valida uma sala do JSON de mapa: [coluna, linha], de 1 a `size`, fora da entrada. */
function parseLayoutCell(c: unknown, what: string, size: number): [number, number] {
  if (!Array.isArray(c) || c.length !== 2 || !c.every((v) => Number.isInteger(v) && v >= 1 && v <= size)) {
    throw new Error(`${what} precisa ser [coluna, linha] com valores de 1 a ${size}.`);
  }
  if (c[0] === 1 && c[1] === 1) throw new Error(`${what} não pode ficar na entrada (1, 1).`);
  return [c[0], c[1]];
}

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
  const cell = (c: unknown, what: string) => parseLayoutCell(c, what, n);
  if (!Array.isArray(data.pits)) throw new Error('"pits" precisa ser uma lista de salas, por exemplo [[3, 1], [2, 4]].');
  const pits = data.pits.map((p, i) => cell(p, `O poço nº ${i + 1}`));
  const wumpus = cell(data.wumpus, '"wumpus"');
  const gold = cell(data.gold, '"gold"');
  const hasPitAt = ([cx, cy]: [number, number]) => pits.some(([x, y]) => x === cx && y === cy);
  if (hasPitAt(gold)) throw new Error('O ouro está dentro de um poço: seria impossível vencer.');
  if (hasPitAt(wumpus)) throw new Error('O Wumpus está dentro de um poço: os dois não podem ficar na mesma sala.');
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

/** Posição inicial de poços, Wumpus e ouro (coordenadas 0-based). */
interface Placement {
  pits: Set<string>;
  wumpus: Cell;
  gold: Cell;
}

/** Existe caminho da entrada até `target` sem passar por poços? (o Wumpus pode ser morto com a flecha) */
function reachable(size: number, pits: Set<string>, target: Cell) {
  const seen = new Set([key(0, 0)]);
  const queue: Cell[] = [{ x: 0, y: 0 }];
  while (queue.length) {
    const c = queue.shift()!;
    if (sameCell(c, target)) return true;
    for (const n of gridNeighbors(size, c.x, c.y)) {
      const k = key(n.x, n.y);
      if (seen.has(k) || pits.has(k)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return false;
}

/** Sorteia um mapa: `pitCount` poços em salas distintas e um caminho sem poço até o ouro (D3, D15, D16). */
function randomPlacement(size: number, pitCount: number, rng: () => number): Placement {
  const free: Cell[] = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (x !== 0 || y !== 0) free.push({ x, y }); // sala inicial é sempre segura
    }
  }
  const pick = (from: Cell[]) => from[Math.floor(rng() * from.length)];
  for (;;) {
    // Embaralhamento parcial (Fisher–Yates): as primeiras `pitCount` salas viram poços
    const shuffled = [...free];
    for (let i = 0; i < pitCount; i++) {
      const j = i + Math.floor(rng() * (shuffled.length - i));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pits = new Set(shuffled.slice(0, pitCount).map((c) => key(c.x, c.y)));
    // Wumpus e ouro nunca ficam num poço; os dois podem dividir a mesma sala (aí é preciso matar o Wumpus). Ver D16.
    const noPit = free.filter((c) => !pits.has(key(c.x, c.y)));
    const wumpus = pick(noPit);
    const gold = pick(noPit);
    if (reachable(size, pits, gold)) return { pits, wumpus, gold };
  }
}

/** Converte o mapa salvo (coordenadas a partir de 1) para as posições internas (a partir de 0). */
const placementOf = (layout: MapLayout): Placement => ({
  pits: new Set(layout.pits.map(([x, y]) => key(x - 1, y - 1))),
  wumpus: { x: layout.wumpus[0] - 1, y: layout.wumpus[1] - 1 },
  gold: { x: layout.gold[0] - 1, y: layout.gold[1] - 1 },
});

/** Efeito de uma ação, antes de calcular as novas percepções. */
interface Outcome {
  message: string;
  bump?: boolean;
  scream?: boolean;
  arrow?: StepResult['arrow'];
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
    const placement = layout ? placementOf(layout) : randomPlacement(size, pitCountFor(size, pitProbability), rng);
    this.pits = placement.pits;
    this.pitCount = placement.pits.size;
    this.wumpus = placement.wumpus;
    this.gold = this.goldStart = placement.gold;
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
      pits: [...this.pits].map((k) => parseKey(k).map((v) => v + 1) as [number, number]),
      wumpus: [this.wumpus.x + 1, this.wumpus.y + 1],
      gold: [gold.x + 1, gold.y + 1],
    };
  }

  inBounds(x: number, y: number) {
    return inGrid(this.size, x, y);
  }

  hasPit(x: number, y: number) {
    return this.pits.has(key(x, y));
  }

  isVisited(x: number, y: number) {
    return this.visited.has(key(x, y));
  }

  neighbors(x: number, y: number): Cell[] {
    return gridNeighbors(this.size, x, y);
  }

  get gameOver() {
    return this.status !== 'playing';
  }

  private wumpusAt(c: Cell) {
    return this.wumpusAlive && sameCell(this.wumpus, c);
  }

  private sense(bump = false, scream = false): Percepts {
    const here = this.agent;
    const around = [here, ...this.neighbors(here.x, here.y)];
    return {
      stench: around.some((c) => sameCell(c, this.wumpus)),
      breeze: this.neighbors(here.x, here.y).some((c) => this.hasPit(c.x, c.y)),
      glitter: !!this.gold && sameCell(this.gold, here),
      bump,
      scream,
    };
  }

  step(action: Action): StepResult {
    if (this.gameOver) return { percepts: this.percepts, message: 'O jogo acabou. Pressione R para recomeçar.' };

    this.score += SCORE.action;
    this.actions++;
    const outcome = this.perform(action);
    if (this.status === 'playing' && this.actions >= this.maxActions) {
      this.status = 'timeout';
      outcome.message = `Limite de ${this.maxActions} ações atingido. Fim de jogo.`;
    }
    this.percepts = this.sense(outcome.bump, outcome.scream);
    return { percepts: this.percepts, message: outcome.message, arrow: outcome.arrow };
  }

  private perform(action: Action): Outcome {
    switch (action) {
      case 'left':
        return this.turn(1);
      case 'right':
        return this.turn(3);
      case 'forward':
        return this.moveForward();
      case 'shoot':
        return this.shoot();
      case 'grab':
        return this.grab();
    }
  }

  /** Gira `quarters` quartos de volta no sentido anti-horário (1 = esquerda, 3 = direita). */
  private turn(quarters: 1 | 3): Outcome {
    this.agent.dir = ((this.agent.dir + quarters) % 4) as Dir;
    return { message: `Virou para ${DIR_NAME[this.agent.dir]}.` };
  }

  private moveForward(): Outcome {
    const a = this.agent;
    const [dx, dy] = DIR_VEC[a.dir];
    const next = { x: a.x + dx, y: a.y + dy };
    if (!this.inBounds(next.x, next.y)) return { message: 'Bateu na parede!', bump: true };

    a.x = next.x;
    a.y = next.y;
    this.visited.add(key(next.x, next.y));
    if (this.hasPit(next.x, next.y)) return this.die('dead-pit', 'Você caiu em um poço! Fim de jogo.');
    if (this.wumpusAt(next)) return this.die('dead-wumpus', 'O Wumpus te devorou! Fim de jogo.');
    if (next.x === 0 && next.y === 0) return this.arriveAtEntrance();
    return { message: `Andou para (${next.x + 1}, ${next.y + 1}).` };
  }

  private die(status: 'dead-pit' | 'dead-wumpus', message: string): Outcome {
    this.status = status;
    this.score += SCORE.death;
    return { message };
  }

  /** Vitória só ao voltar à entrada com o ouro; sem ele a partida continua (D6). */
  private arriveAtEntrance(): Outcome {
    if (!this.hasGold) return { message: 'De volta à entrada, mas sem o ouro. A partida continua.' };
    this.score += SCORE.escape;
    this.status = 'won';
    return { message: `Você voltou à entrada com o ouro! Vitória! (+${SCORE.escape})` };
  }

  private shoot(): Outcome {
    if (!this.hasArrow) return { message: 'Você não tem mais flechas.' };
    this.hasArrow = false;
    this.score += SCORE.shoot;
    const from = { x: this.agent.x, y: this.agent.y };
    const { to, hit } = this.arrowFlight(from);
    const arrow = { from, to, hit };
    if (!hit) return { message: 'A flecha se perdeu na escuridão...', arrow };
    this.wumpusAlive = false;
    this.score += SCORE.wumpusKill;
    return { message: `AAARGH! Um grito ecoa pela caverna. O Wumpus morreu! (+${SCORE.wumpusKill})`, scream: true, arrow };
  }

  /** A flecha voa em linha reta até acertar o Wumpus ou bater na parede. */
  private arrowFlight(from: Cell) {
    const [dx, dy] = DIR_VEC[this.agent.dir];
    const to = { ...from };
    while (this.inBounds(to.x + dx, to.y + dy)) {
      to.x += dx;
      to.y += dy;
      if (this.wumpusAt(to)) return { to, hit: true };
    }
    return { to, hit: false };
  }

  private grab(): Outcome {
    if (!this.gold || !sameCell(this.gold, this.agent)) return { message: 'Não há nada para pegar aqui.' };
    this.gold = null;
    this.hasGold = true;
    this.score += SCORE.gold;
    return { message: `Você pegou o ouro! (+${SCORE.gold}) Volte para (1, 1) para vencer.` };
  }
}
