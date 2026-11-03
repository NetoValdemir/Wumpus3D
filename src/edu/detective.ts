// Modo Detetive: o aluno joga com as próprias mãos e anota no "caderno" o que sabe de cada sala.
// O robô-ajudante compara as anotações com o que dá para deduzir das pistas sentidas (a mesma base de
// conhecimento dos agentes) e responde com perguntas, sem entregar a resposta. Sem DOM.
import { WumpusWorld, key, parseKey, type Action, type MapLayout, type StepResult } from '../game/world';
import { Knowledge } from '../agents/knowledge';
import { Referee } from '../arena/referee';

export type Mark = 'segura' | 'poco?' | 'poco' | 'wumpus?' | 'wumpus';
/** Ordem ao tocar várias vezes na mesma sala (null = sem anotação). */
export const MARK_CYCLE: (Mark | null)[] = [null, 'segura', 'poco?', 'poco', 'wumpus?', 'wumpus'];
export const MARK_LABEL: Record<Mark, string> = { segura: 'segura', 'poco?': 'poço?', poco: 'poço!', 'wumpus?': 'Wumpus?', wumpus: 'Wumpus!' };

/** certa: as pistas provam; possivel: combina com as pistas, mas ainda não dá para ter certeza; errada: as pistas desmentem. */
export type Verdict = 'certa' | 'possivel' | 'errada';

const cellName = (k: string) => {
  const [x, y] = parseKey(k);
  return `(${x + 1}, ${y + 1})`;
};

export interface DetectiveSummary {
  status: WumpusWorld['status'];
  actions: number;
  score: number;
  logicErrors: number;
  needlessRisks: number;
  hints: number;
  marks: { certa: number; possivel: number; errada: number };
  stars: number;
}

export class DetectiveGame {
  readonly world: WumpusWorld;
  readonly referee: Referee;
  readonly kb: Knowledge;
  readonly marks = new Map<string, Mark>();
  hints = 0;

  constructor(layout: MapLayout) {
    this.world = WumpusWorld.fromLayout(layout);
    this.referee = new Referee(this.world);
    this.kb = new Knowledge(this.world.size, this.world.pitProbability);
    this.observe(false);
  }

  /** Executa a ação do aluno (o árbitro julga antes e observa depois, como na Arena). */
  act(action: Action): StepResult {
    const shot = action === 'shoot' && this.world.hasArrow;
    this.referee.judge(this.world, action);
    const result = this.world.step(action);
    this.referee.observe(this.world, action === 'shoot');
    this.observe(shot);
    this.marks.delete(key(this.world.agent.x, this.world.agent.y)); // sala visitada já é conhecida
    return result;
  }

  private observe(shot: boolean) {
    const w = this.world;
    const p = w.percepts;
    if (shot && !p.scream) this.kb.arrowMissed({ x: w.agent.x, y: w.agent.y }, w.agent.dir);
    this.kb.observe(w.agent.x, w.agent.y, p.breeze, p.stench, p.scream);
  }

  /** Troca a anotação da sala para a próxima da lista. Salas visitadas não recebem anotação. */
  cycleMark(k: string): Mark | null {
    if (this.kb.visited.has(k)) return null;
    const next = MARK_CYCLE[(MARK_CYCLE.indexOf(this.marks.get(k) ?? null) + 1) % MARK_CYCLE.length];
    if (next) this.marks.set(k, next);
    else this.marks.delete(k);
    return next;
  }

  /** O que as pistas dizem sobre a anotação da sala. */
  verdict(k: string, mark = this.marks.get(k)): Verdict | null {
    if (!mark) return null;
    const kb = this.kb;
    const candidates = kb.wumpusCandidates();
    const pit = kb.certainPits().has(k);
    const wumpusHere = candidates.size === 1 && candidates.has(k);
    switch (mark) {
      case 'segura':
        if (pit || wumpusHere) return 'errada';
        return kb.safe(k, candidates) ? 'certa' : 'possivel';
      case 'poco?':
        return kb.pitFree(k) ? 'errada' : pit ? 'certa' : 'possivel';
      case 'poco':
        return kb.pitFree(k) ? 'errada' : pit ? 'certa' : 'possivel';
      case 'wumpus?':
        return candidates.has(k) ? (wumpusHere ? 'certa' : 'possivel') : 'errada';
      case 'wumpus':
        return candidates.has(k) ? (wumpusHere ? 'certa' : 'possivel') : 'errada';
    }
  }

  checkMarks() {
    const count = { certa: 0, possivel: 0, errada: 0 };
    for (const k of this.marks.keys()) count[this.verdict(k)!]++;
    return count;
  }

  /** Uma dica em forma de pergunta, da mais urgente (anotação errada) para a mais geral. */
  hint(): string {
    this.hints++;
    const kb = this.kb;
    const w = this.world;
    const candidates = kb.wumpusCandidates();
    const pits = kb.certainPits();
    const wrong = [...this.marks.keys()].find((k) => this.verdict(k) === 'errada');
    if (wrong) return this.explainWrong(wrong);
    if (w.hasGold) return 'Você está com o ouro! Qual é o caminho pelas salas que você já conhece até a entrada?';
    if (w.percepts.glitter) return 'Você está vendo um brilho. O que tem nesta sala? Qual botão pega?';
    const frontier = kb.allCells().filter((k) => kb.isFrontier(k));
    const safe = frontier.find((k) => kb.safe(k, candidates) && this.marks.get(k) !== 'segura');
    if (safe) {
      const calm = kb.neighbors(safe).find((n) => kb.visited.get(n)?.breeze === false);
      return calm
        ? `Olhe a sala ${cellName(safe)}. Ela é vizinha de ${cellName(calm)}, onde você não sentiu brisa. Pode haver poço nela? E o Wumpus, pode estar lá?`
        : `Olhe a sala ${cellName(safe)}. O que as salas vizinhas que você já visitou dizem sobre ela?`;
    }
    const pit = [...pits].find((k) => this.marks.get(k) !== 'poco');
    if (pit) {
      const breezy = kb.neighbors(pit).find((n) => kb.visited.get(n)?.breeze);
      return `Em ${cellName(breezy!)} você sentiu brisa. Das salas vizinhas dela, quais ainda podem ter poço? Se sobrar uma só…`;
    }
    if (candidates.size === 1) {
      const [wk] = candidates;
      if (this.marks.get(wk) !== 'wumpus') return 'Pense em todas as salas onde você sentiu fedor. Existe uma única sala que é vizinha de todas elas e ainda pode esconder o Wumpus?';
    }
    if (w.hasArrow && candidates.size > 0 && candidates.size <= 3)
      return 'Nenhuma sala nova é garantida. O Wumpus só pode estar em poucas salas: que tal usar a flecha? Se ninguém gritar, a linha do tiro fica livre.';
    return 'Nenhuma sala nova é garantidamente segura agora. Às vezes é preciso arriscar: escolha a sala com menos pistas de perigo ao redor.';
  }

  private explainWrong(k: string): string {
    const mark = this.marks.get(k)!;
    const name = cellName(k);
    if (mark === 'segura') return `Confira a anotação "segura" em ${name}. Alguma pista mostra que ela é perigosa?`;
    if (mark === 'poco' || mark === 'poco?') {
      const calm = this.kb.neighbors(k).find((n) => this.kb.visited.get(n)?.breeze === false);
      return calm
        ? `Você anotou poço em ${name}. Mas em ${cellName(calm)}, vizinha dela, não havia brisa. O que isso quer dizer?`
        : `Confira a anotação de poço em ${name}: as pistas combinam com ela?`;
    }
    if (this.kb.wumpusDead) return `O Wumpus já morreu (você ouviu o grito). A anotação em ${name} ainda faz sentido?`;
    return `Você anotou Wumpus em ${name}. O fedor aparece nas salas vizinhas dele. As salas ao redor de ${name} combinam com o que você sentiu?`;
  }

  /** ★ venceu · ★★ e não entrou em sala que dava para saber perigosa · ★★★ e sem riscos desnecessários nem anotações erradas. */
  stars(): number {
    if (this.world.status !== 'won') return 0;
    if (this.referee.logicErrors > 0) return 1;
    if (this.referee.needlessRisks > 0 || this.checkMarks().errada > 0) return 2;
    return 3;
  }

  summary(): DetectiveSummary {
    const w = this.world;
    return {
      status: w.status,
      actions: w.actions,
      score: w.score,
      logicErrors: this.referee.logicErrors,
      needlessRisks: this.referee.needlessRisks,
      hints: this.hints,
      marks: this.checkMarks(),
      stars: this.stars(),
    };
  }
}

/** Retorno final em linguagem simples, a partir do árbitro. */
export function detectiveFeedback(s: DetectiveSummary): string[] {
  const out: string[] = [];
  if (s.logicErrors) out.push(`Você entrou ${s.logicErrors === 1 ? 'numa sala' : `em ${s.logicErrors} salas`} que as pistas já mostravam ser perigosa${s.logicErrors === 1 ? '' : 's'}.`);
  if (s.needlessRisks) out.push(`Você arriscou ${s.needlessRisks === 1 ? 'uma vez' : `${s.needlessRisks} vezes`} quando ainda havia sala garantidamente segura para explorar.`);
  if (s.marks.errada) out.push(`${s.marks.errada} anotaç${s.marks.errada === 1 ? 'ão' : 'ões'} do caderno não combinava${s.marks.errada === 1 ? '' : 'm'} com as pistas.`);
  if (!out.length && s.status === 'won') out.push('Raciocínio de detetive: nenhum passo arriscado sem necessidade!');
  if (s.marks.certa) out.push(`${s.marks.certa} anotaç${s.marks.certa === 1 ? 'ão certeira' : 'ões certeiras'} no caderno.`);
  return out;
}
