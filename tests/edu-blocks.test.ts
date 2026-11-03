// Modo "Programador com blocos": conversão do JSON do Blockly, interpretador e campanha de missões.
import { describe, expect, it } from 'vitest';
import { BLOCK, programFromJson, type BlockJson, type WorkspaceJson } from '../src/edu/blockly-json';
import { MISSIONS, evaluateMission, missionById } from '../src/edu/missions';
import { programText } from '../src/edu/program';
import { runProgram } from '../src/edu/run';

let n = 0;
const b = (type: string, extra: Partial<BlockJson> = {}): BlockJson => ({ type, id: `b${n++}`, ...extra });
/** Encadeia blocos (cada um no "next" do anterior). */
const seq = (...list: BlockJson[]): BlockJson | undefined => {
  for (let i = list.length - 2; i >= 0; i--) list[i] = { ...list[i], next: { block: list[i + 1] } };
  return list[0];
};
const F = () => b(BLOCK.forward);
const L = () => b(BLOCK.left);
const R = () => b(BLOCK.right);
const G = () => b(BLOCK.grab);
const S = () => b(BLOCK.shoot);
const rep = (times: number, ...body: BlockJson[]) => b(BLOCK.repeat, { fields: { TIMES: times }, inputs: { DO: { block: seq(...body) } } });
const until = (cond: BlockJson, ...body: BlockJson[]) => b(BLOCK.until, { inputs: { COND: { block: cond }, DO: { block: seq(...body) } } });
const ifElse = (cond: BlockJson, yes: BlockJson[], no: BlockJson[]) =>
  b(BLOCK.ifElse, { inputs: { COND: { block: cond }, DO: { block: seq(...yes) }, ELSE: { block: seq(...no) } } });
const iff = (cond: BlockJson, ...yes: BlockJson[]) => b(BLOCK.if, { inputs: { COND: { block: cond }, DO: { block: seq(...yes) } } });
const sense = (what: string) => b(BLOCK.sense, { fields: { WHAT: what } });
const and = (x: BlockJson, y: BlockJson) => b(BLOCK.logic, { fields: { OP: 'and' }, inputs: { A: { block: x }, B: { block: y } } });
const call = (name: string) => b(BLOCK.callFn, { extraState: { name } });
const def = (name: string, ...body: BlockJson[]) => b(BLOCK.defineFn, { fields: { NAME: name }, inputs: { STACK: { block: seq(...body) } } });
const ws = (main: BlockJson[], ...fns: BlockJson[]): WorkspaceJson => ({ blocks: { blocks: [b(BLOCK.start, { inputs: { DO: { block: seq(...main) } } }), ...fns] } });

const step = () => [F(), L(), F(), R()];
const SOLUTIONS: Record<string, WorkspaceJson> = {
  m1: ws([F(), F(), G(), L(), L(), F(), F()]),
  m2: ws([F(), L(), F(), F(), G(), L(), L(), F(), F(), R(), F()]),
  m3: ws([rep(5, F()), G(), L(), L(), rep(5, F())]),
  m4: ws([rep(3, ...step()), G(), L(), L(), rep(3, ...step())]),
  m5: ws([until(sense('glitter'), F()), G(), L(), L(), until(b(BLOCK.atEntrance), F())]),
  m6: ws([
    until(sense('glitter'), ifElse(b(BLOCK.wallAhead), [L()], [F()])),
    G(),
    L(),
    L(),
    until(b(BLOCK.atEntrance), ifElse(b(BLOCK.wallAhead), [R()], [F()])),
  ]),
  m7: ws([call('subir'), G(), L(), L(), call('subir')], def('subir', rep(4, ...step()))),
  m8: ws([until(sense('glitter'), iff(and(sense('stench'), b(BLOCK.hasArrow)), S()), F()), G(), L(), L(), until(b(BLOCK.atEntrance), F())]),
  m9: ws([F(), L(), F(), R(), F(), L(), F(), G(), L(), L(), F(), R(), F(), L(), F(), R(), F()]),
};

describe('campanha de missões', () => {
  for (const m of MISSIONS) {
    it(`${m.id} (${m.title}) tem solução com 3 estrelas`, () => {
      const program = programFromJson(SOLUTIONS[m.id]);
      const r = evaluateMission(program, m);
      expect(r.runs.map((x) => x.status)).toEqual(m.maps.map(() => 'won'));
      expect({ blocks: r.blocks, actions: r.actions, stars: r.stars }).toEqual({ blocks: m.maxBlocks, actions: m.maxActions, stars: 3 });
    });
  }

  it('estrelas: vence com blocos demais = 1; dentro dos blocos mas com ações demais = 2', () => {
    const m = missionById('m3')!;
    const longo = programFromJson(ws([F(), F(), F(), F(), F(), G(), L(), L(), F(), F(), F(), F(), F()]));
    expect(evaluateMission(longo, m).stars).toBe(1);
    const voltas = programFromJson(ws([rep(5, F()), G(), rep(6, L()), rep(5, F())]));
    expect(evaluateMission(voltas, { ...m, maxBlocks: 99 }).stars).toBe(2);
    expect(evaluateMission(programFromJson(ws([F()])), m).stars).toBe(0);
  });

  it('a missão 8 exige a flecha: sem atirar, o Wumpus pega o robô', () => {
    const m = missionById('m8')!;
    const semTiro = programFromJson(ws([until(sense('glitter'), F()), G(), L(), L(), until(b(BLOCK.atEntrance), F())]));
    expect(evaluateMission(semTiro, m).runs.map((r) => r.status)).toEqual(['dead-wumpus', 'won', 'dead-wumpus']);
  });
});

describe('interpretador', () => {
  const layout = MISSIONS[0].maps[0];

  it('laço sem fim que não mexe o robô vira erro no bloco certo', () => {
    const loop = until(sense('glitter'));
    const r = runProgram(programFromJson(ws([loop])), layout);
    expect(r.error).toMatch(/nunca termina/);
    expect(r.errorBlock).toBe(loop.id);
  });

  it('condição vazia e função inexistente viram erro', () => {
    expect(runProgram(programFromJson(ws([b(BLOCK.until, { inputs: { DO: { block: F() } } })])), layout).error).toMatch(/condição/);
    expect(runProgram(programFromJson(ws([call('nada')])), layout).error).toMatch(/não existe/);
  });

  it('recursão infinita é barrada; o limite de ações do jogo encerra laços que andam', () => {
    expect(runProgram(programFromJson(ws([call('f')], def('f', call('f')))), layout).error).toMatch(/Funções demais/);
    const r = runProgram(programFromJson(ws([until(b(BLOCK.hasGold), L())])), layout);
    expect(r.status).toBe('timeout');
  });

  it('o programa termina sem vitória quando acabam os blocos', () => {
    expect(runProgram(programFromJson(ws([F()])), layout)).toMatchObject({ status: 'playing', actions: 1 });
  });

  it('"sala à frente já visitada" usa a memória do próprio robô', () => {
    // anda, dá meia-volta: a sala da frente (a entrada) foi visitada
    const p = programFromJson(ws([F(), L(), L(), iff(b(BLOCK.visitedAhead), F())]));
    expect(runProgram(p, layout)).toMatchObject({ actions: 4 });
  });

  it('o programa vira texto para o relatório do professor', () => {
    const text = programText(programFromJson(SOLUTIONS.m7));
    expect(text).toContain('função subir:');
    expect(text).toContain('repetir 4 vezes:');
    expect(text).toContain('quando começar:');
  });

  it('blocos soltos (fora do "quando começar") não contam nem rodam', () => {
    const p = programFromJson({ blocks: { blocks: [b(BLOCK.start), F(), G()] } });
    expect(p).toMatchObject({ main: [], blocks: 0 });
  });
});
