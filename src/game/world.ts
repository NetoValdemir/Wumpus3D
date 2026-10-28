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

export type Action = 'forward' | 'left' | 'right' | 'shoot' | 'grab' | 'climb';
export type Status = 'playing' | 'won' | 'escaped' | 'dead-pit' | 'dead-wumpus';

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
  death: -1000,
  goldEscape: 1000,
};

const key = (x: number, y: number) => `${x},${y}`;

export class WumpusWorld {
  readonly size: number;
  readonly pits = new Set<string>();
  readonly wumpus: Cell;
  wumpusAlive = true;
  gold: Cell | null;

  agent: Cell & { dir: Dir } = { x: 0, y: 0, dir: 0 };
  hasArrow = true;
  hasGold = false;
  score = 0;
  status: Status = 'playing';
  readonly visited = new Set<string>([key(0, 0)]);
  percepts: Percepts;

  constructor(size = 4, pitProbability = 0.2, rng: () => number = Math.random) {
    this.size = size;

    const free: Cell[] = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (x === 0 && y === 0) continue; // sala inicial é sempre segura
        free.push({ x, y });
        if (rng() < pitProbability) this.pits.add(key(x, y));
      }
    }
    const pick = () => free[Math.floor(rng() * free.length)];
    this.wumpus = pick();
    this.gold = pick();

    this.percepts = this.sense();
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
          scream = true;
          message = 'AAARGH! Um grito ecoa pela caverna. O Wumpus morreu!';
        } else {
          message = 'A flecha se perdeu na escuridão...';
        }
        break;
      }
      case 'grab':
        if (this.gold && this.gold.x === a.x && this.gold.y === a.y) {
          this.gold = null;
          this.hasGold = true;
          message = 'Você pegou o ouro! Volte para (1, 1) e saia (C).';
        } else {
          message = 'Não há nada para pegar aqui.';
        }
        break;
      case 'climb':
        if (a.x === 0 && a.y === 0) {
          if (this.hasGold) {
            this.score += SCORE.goldEscape;
            this.status = 'won';
            message = 'Você escapou com o ouro! Vitória!';
          } else {
            this.status = 'escaped';
            message = 'Você saiu da caverna sem o ouro.';
          }
        } else {
          message = 'Só dá para sair pela entrada, em (1, 1).';
        }
        break;
    }

    this.percepts = this.sense(bump, scream);
    return { percepts: this.percepts, message, arrow };
  }
}
