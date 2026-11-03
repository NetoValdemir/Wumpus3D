// Converte o programa salvo pelo Blockly (formato JSON de Blockly.serialization) para a árvore de comandos
// de program.ts. Sem DOM: assim os programas dos alunos podem ser lidos e testados também no Node
// (testes, relatório do professor).
import type { Action } from '../game/world';
import type { Condition, Program, SenseName, Stmt } from './program';

/** Bloco no formato JSON do Blockly (só o que usamos). */
export interface BlockJson {
  type: string;
  id?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson }>;
  next?: { block?: BlockJson };
  extraState?: Record<string, unknown>;
}

export interface WorkspaceJson {
  blocks?: { blocks?: BlockJson[] };
}

/** Tipos de bloco do modo educacional. */
export const BLOCK = {
  start: 'wumpus_start',
  forward: 'wumpus_forward',
  left: 'wumpus_left',
  right: 'wumpus_right',
  grab: 'wumpus_grab',
  shoot: 'wumpus_shoot',
  repeat: 'wumpus_repeat',
  until: 'wumpus_until',
  while: 'wumpus_while',
  if: 'wumpus_if',
  ifElse: 'wumpus_ifelse',
  sense: 'wumpus_sense',
  hasGold: 'wumpus_has_gold',
  hasArrow: 'wumpus_has_arrow',
  atEntrance: 'wumpus_at_entrance',
  wallAhead: 'wumpus_wall_ahead',
  visitedAhead: 'wumpus_visited_ahead',
  not: 'wumpus_not',
  logic: 'wumpus_logic',
  defineFn: 'procedures_defnoreturn',
  callFn: 'procedures_callnoreturn',
} as const;

const ACTIONS: Record<string, Action> = {
  [BLOCK.forward]: 'forward',
  [BLOCK.left]: 'left',
  [BLOCK.right]: 'right',
  [BLOCK.grab]: 'grab',
  [BLOCK.shoot]: 'shoot',
};

const fnName = (b: BlockJson) => String(b.fields?.NAME ?? b.extraState?.name ?? '');

/** Converte e conta os blocos usados (comandos, condições e funções; o bloco "quando começar" não conta). */
export function programFromJson(ws: WorkspaceJson): Program {
  let blocks = 0;
  const cond = (b: BlockJson | undefined): Condition | null => {
    if (!b) return null;
    blocks++;
    const input = (name: string) => cond(b.inputs?.[name]?.block);
    switch (b.type) {
      case BLOCK.sense:
        return { kind: 'sense', what: String(b.fields?.WHAT ?? 'breeze') as SenseName };
      case BLOCK.hasGold:
        return { kind: 'hasGold' };
      case BLOCK.hasArrow:
        return { kind: 'hasArrow' };
      case BLOCK.atEntrance:
        return { kind: 'atEntrance' };
      case BLOCK.wallAhead:
        return { kind: 'wallAhead' };
      case BLOCK.visitedAhead:
        return { kind: 'visitedAhead' };
      case BLOCK.not:
        return { kind: 'not', c: input('A') };
      case BLOCK.logic:
        return { kind: b.fields?.OP === 'or' ? 'or' : 'and', a: input('A'), b: input('B') };
      default:
        return null;
    }
  };
  const stmt = (b: BlockJson): Stmt | null => {
    const id = b.id ?? '';
    const body = (name: string) => chain(b.inputs?.[name]?.block);
    if (ACTIONS[b.type]) {
      blocks++;
      return { kind: 'action', action: ACTIONS[b.type], id };
    }
    switch (b.type) {
      case BLOCK.repeat:
        blocks++;
        return { kind: 'repeat', times: Math.max(0, Math.min(100, Math.round(Number(b.fields?.TIMES ?? 0)))), body: body('DO'), id };
      case BLOCK.until:
      case BLOCK.while:
        blocks++;
        return { kind: b.type === BLOCK.until ? 'until' : 'while', cond: cond(b.inputs?.COND?.block), body: body('DO'), id };
      case BLOCK.if:
      case BLOCK.ifElse:
        blocks++;
        return { kind: 'if', cond: cond(b.inputs?.COND?.block), then: body('DO'), otherwise: b.type === BLOCK.ifElse ? body('ELSE') : null, id };
      case BLOCK.callFn:
        blocks++;
        return { kind: 'call', name: fnName(b), id };
      default:
        return null; // bloco desconhecido: ignorado
    }
  };
  function chain(first: BlockJson | undefined): Stmt[] {
    const out: Stmt[] = [];
    for (let b = first; b; b = b.next?.block) {
      const s = stmt(b);
      if (s) out.push(s);
    }
    return out;
  }
  const top = ws.blocks?.blocks ?? [];
  const main = top.filter((b) => b.type === BLOCK.start).flatMap((b) => chain(b.inputs?.DO?.block));
  const functions: Record<string, Stmt[]> = {};
  for (const b of top.filter((t) => t.type === BLOCK.defineFn)) {
    blocks++;
    functions[fnName(b)] = chain(b.inputs?.STACK?.block);
  }
  return { main, functions, blocks };
}
