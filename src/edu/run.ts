// Executa um programa de blocos numa caverna: passo a passo (tela) ou de uma vez (testes, estrelas).
import { WumpusWorld, type MapLayout, type StepResult, type Status } from '../game/world';
import { publicSensesOf } from '../arena/protocol';
import { execute, ProgramError, type Program, type ProgramStep } from './program';

export interface RunResult {
  status: Status; // 'playing' = o programa terminou antes de o jogo acabar
  actions: number;
  score: number;
  error: string | null;
  errorBlock: string | null;
}

/** Uma execução em andamento: cada next() faz o robô dar uma ação. */
export class ProgramRun {
  readonly world: WumpusWorld;
  private steps: Generator<ProgramStep, void, void>;
  finished = false;
  error: ProgramError | null = null;

  constructor(program: Program, layout: MapLayout) {
    this.world = WumpusWorld.fromLayout(layout);
    const world = this.world;
    this.steps = execute(program, { senses: () => publicSensesOf(world), size: world.size });
  }

  /** Próxima ação. Devolve o bloco executado e o resultado, ou null quando acabou. */
  next(): { blockId: string; result: StepResult } | null {
    if (this.finished) return null;
    try {
      const it = this.steps.next();
      if (it.done) return this.finish();
      const result = this.world.step(it.value.action);
      if (this.world.gameOver) this.finished = true;
      return { blockId: it.value.blockId, result };
    } catch (err) {
      this.error = err instanceof ProgramError ? err : new ProgramError(String((err as Error)?.message ?? err), null);
      return this.finish();
    }
  }

  private finish() {
    this.finished = true;
    return null;
  }

  result(): RunResult {
    const w = this.world;
    return { status: w.status, actions: w.actions, score: w.score, error: this.error?.message ?? null, errorBlock: this.error?.blockId ?? null };
  }
}

/** Executa até o fim (o limite de ações do jogo garante que termina). */
export function runProgram(program: Program, layout: MapLayout): RunResult {
  const run = new ProgramRun(program, layout);
  while (run.next());
  return run.result();
}

/** Texto curto para o aluno sobre como a execução terminou. */
export function outcomeText(r: RunResult): string {
  if (r.error) return r.error;
  switch (r.status) {
    case 'won':
      return 'Vitória! O robô voltou para a entrada com o ouro.';
    case 'dead-pit':
      return 'O robô caiu num poço. Que pista avisava desse perigo?';
    case 'dead-wumpus':
      return 'O Wumpus pegou o robô! O fedor avisa que ele está numa sala vizinha.';
    case 'timeout':
      return 'O robô andou demais e o tempo acabou. Será que ele está andando em círculos?';
    case 'playing':
      return 'O programa terminou, mas o robô ainda não voltou para a entrada com o ouro.';
  }
}
