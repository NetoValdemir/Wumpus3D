// Programas do modo "Programador com blocos": árvore de comandos (sem DOM) e o interpretador que a executa
// passo a passo. O robô do aluno só recebe o que um agente receberia (percepções, posição, direção, o que
// carrega e o tamanho do mapa), nunca o objeto WumpusWorld (invariante 2).
import { DIR_VEC, inGrid, key, type Action } from '../game/world';
import type { PublicSenses } from '../arena/protocol';

export type SenseName = 'breeze' | 'stench' | 'glitter' | 'bump' | 'scream';

export type Condition =
  | { kind: 'sense'; what: SenseName }
  | { kind: 'hasGold' }
  | { kind: 'hasArrow' }
  | { kind: 'atEntrance' }
  | { kind: 'wallAhead' }
  | { kind: 'visitedAhead' }
  | { kind: 'not'; c: Condition | null }
  | { kind: 'and' | 'or'; a: Condition | null; b: Condition | null };

export type Stmt =
  | { kind: 'action'; action: Action; id: string }
  | { kind: 'repeat'; times: number; body: Stmt[]; id: string }
  | { kind: 'until' | 'while'; cond: Condition | null; body: Stmt[]; id: string }
  | { kind: 'if'; cond: Condition | null; then: Stmt[]; otherwise: Stmt[] | null; id: string }
  | { kind: 'call'; name: string; id: string };

export interface Program {
  main: Stmt[];
  functions: Record<string, Stmt[]>;
  /** Blocos usados (para as estrelas): comandos, condições e definições de função */
  blocks: number;
}

/** Erro do programa do aluno, com o bloco onde aconteceu (para destacar). */
export class ProgramError extends Error {
  blockId: string | null;
  constructor(message: string, blockId: string | null) {
    super(message);
    this.blockId = blockId;
  }
}

/** Um passo do programa: o bloco que está rodando e a ação que o robô vai fazer. */
export interface ProgramStep {
  blockId: string;
  action: Action;
}

const MAX_WORK = 5000; // passos de programa seguidos sem o robô fazer nada (laço sem fim)
const MAX_DEPTH = 40; // funções chamando funções

/** O que o programa sabe do robô a cada instante. */
export interface RobotSenses {
  senses: () => PublicSenses;
  size: number;
}

/**
 * Executa o programa como um gerador: a cada ação, devolve o bloco e a ação e espera o jogo executá-la.
 * Quem chama faz world.step(action) e pede o próximo passo. Lança ProgramError em laço sem fim,
 * função inexistente ou condição vazia.
 */
export function* execute(program: Program, robot: RobotSenses): Generator<ProgramStep, void, void> {
  const visited = new Set<string>();
  let work = 0;
  const remember = () => {
    const s = robot.senses();
    visited.add(key(s.x, s.y));
    return s;
  };
  const tick = (id: string) => {
    if (++work > MAX_WORK) throw new ProgramError('O programa ficou rodando sem o robô se mexer. Será que tem uma repetição que nunca termina?', id);
  };
  const test = (c: Condition | null, id: string): boolean => {
    if (!c) throw new ProgramError('Falta encaixar uma condição neste bloco.', id);
    const s = remember();
    switch (c.kind) {
      case 'sense':
        return s.percepts[c.what];
      case 'hasGold':
        return s.hasGold;
      case 'hasArrow':
        return s.hasArrow;
      case 'atEntrance':
        return s.x === 0 && s.y === 0;
      case 'wallAhead': {
        const [dx, dy] = DIR_VEC[s.dir];
        return !inGrid(robot.size, s.x + dx, s.y + dy);
      }
      case 'visitedAhead': {
        const [dx, dy] = DIR_VEC[s.dir];
        return visited.has(key(s.x + dx, s.y + dy));
      }
      case 'not':
        return !test(c.c, id);
      case 'and':
        return test(c.a, id) && test(c.b, id);
      case 'or':
        return test(c.a, id) || test(c.b, id);
    }
  };
  function* block(list: Stmt[], depth: number): Generator<ProgramStep, void, void> {
    for (const st of list) yield* run(st, depth);
  }
  function* run(st: Stmt, depth: number): Generator<ProgramStep, void, void> {
    tick(st.id);
    switch (st.kind) {
      case 'action':
        remember();
        work = 0;
        yield { blockId: st.id, action: st.action };
        remember();
        return;
      case 'repeat':
        for (let i = 0; i < st.times; i++) yield* block(st.body, depth);
        return;
      case 'until':
        while (!test(st.cond, st.id)) {
          tick(st.id);
          yield* block(st.body, depth);
        }
        return;
      case 'while':
        while (test(st.cond, st.id)) {
          tick(st.id);
          yield* block(st.body, depth);
        }
        return;
      case 'if':
        if (test(st.cond, st.id)) yield* block(st.then, depth);
        else if (st.otherwise) yield* block(st.otherwise, depth);
        return;
      case 'call': {
        const body = program.functions[st.name];
        if (!body) throw new ProgramError(`A função "${st.name}" não existe.`, st.id);
        if (depth >= MAX_DEPTH) throw new ProgramError('Funções demais chamando umas às outras.', st.id);
        yield* block(body, depth + 1);
        return;
      }
    }
  }
  remember();
  yield* block(program.main, 0);
}

// ---------------------------------------------------------------- Texto do programa (relatório do professor)

const ACTION_TEXT: Record<Action, string> = { forward: 'avançar', left: 'girar à esquerda', right: 'girar à direita', grab: 'pegar o ouro', shoot: 'atirar a flecha' };
const SENSE_TEXT: Record<SenseName, string> = { breeze: 'sentir brisa', stench: 'sentir fedor', glitter: 'ver brilho', bump: 'bater na parede', scream: 'ouvir o grito' };

export function conditionText(c: Condition | null): string {
  if (!c) return '(vazio)';
  switch (c.kind) {
    case 'sense':
      return SENSE_TEXT[c.what];
    case 'hasGold':
      return 'estar com o ouro';
    case 'hasArrow':
      return 'ter flecha';
    case 'atEntrance':
      return 'estar na entrada';
    case 'wallAhead':
      return 'parede à frente';
    case 'visitedAhead':
      return 'sala à frente já visitada';
    case 'not':
      return `não (${conditionText(c.c)})`;
    case 'and':
      return `(${conditionText(c.a)} e ${conditionText(c.b)})`;
    case 'or':
      return `(${conditionText(c.a)} ou ${conditionText(c.b)})`;
  }
}

function stmtLines(list: Stmt[], indent: string): string[] {
  return list.flatMap((st): string[] => {
    const inner = (b: Stmt[]) => (b.length ? stmtLines(b, indent + '  ') : [`${indent}  (nada)`]);
    switch (st.kind) {
      case 'action':
        return [indent + ACTION_TEXT[st.action]];
      case 'repeat':
        return [`${indent}repetir ${st.times} vezes:`, ...inner(st.body)];
      case 'until':
        return [`${indent}repetir até ${conditionText(st.cond)}:`, ...inner(st.body)];
      case 'while':
        return [`${indent}repetir enquanto ${conditionText(st.cond)}:`, ...inner(st.body)];
      case 'if':
        return [`${indent}se ${conditionText(st.cond)}:`, ...inner(st.then), ...(st.otherwise ? [`${indent}senão:`, ...inner(st.otherwise)] : [])];
      case 'call':
        return [`${indent}${st.name}()`];
    }
  });
}

/** O programa como texto simples, um comando por linha. */
export function programText(p: Program): string {
  const fns = Object.entries(p.functions).flatMap(([name, body]) => [`função ${name}:`, ...stmtLines(body, '  '), '']);
  return [...fns, 'quando começar:', ...stmtLines(p.main, '  ')].join('\n');
}
