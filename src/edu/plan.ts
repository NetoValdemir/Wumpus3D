// Plano de atividade do professor e registro do aluno. Tudo em arquivos/códigos trocados entre professor e
// alunos: não há servidor nem conta, e o único dado pessoal é o apelido que o aluno digita (LGPD, art. 14; D22).
import { parseLayout, type MapLayout, type Status } from '../game/world';
import { arenaMaps } from '../arena/rng';
import { MISSIONS, missionById, type BlockGroup, ALL_GROUPS } from './missions';
import { fromCode, toCode } from './caves';
import type { WorkspaceJson } from './blockly-json';
import { lessonById } from './trilha/lessons';

export type ActivityKind = 'detetive' | 'blocos' | 'trilha' | 'agente';

export const KIND_LABEL: Record<ActivityKind, string> = { detetive: '🔎 Detetive', blocos: '🧩 Blocos', trilha: '🤖 Trilha de IA', agente: '🏆 Agente para a Arena' };

export type CaveSource =
  | { type: 'missao'; missionId: string }
  | { type: 'mapa'; layout: MapLayout }
  | { type: 'sorteio'; seed: string; size: number; pits: number };

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  instructions: string;
  /** Caverna (Detetive, Blocos, Agente); null nas lições da trilha */
  cave: CaveSource | null;
  /** Lição da trilha de IA (só em 'trilha') */
  lessonId?: string;
}

export interface Plan {
  format: 'wumpus3d-plano';
  version: 1;
  id: string;
  title: string;
  teacher: string;
  group: string; // turma
  instructions: string;
  created: string;
  activities: Activity[];
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptyPlan(): Plan {
  return { format: 'wumpus3d-plano', version: 1, id: newId(), title: 'Atividade da turma', teacher: '', group: '', instructions: '', created: new Date().toISOString(), activities: [] };
}

/** Cavernas da atividade (uma missão pode ter várias; as outras fontes têm uma). */
export function activityLayouts(a: Activity): MapLayout[] {
  if (!a.cave) return [];
  if (a.kind === 'agente' && a.cave.type === 'sorteio') return arenaMaps(`agente-${a.cave.seed}`, 3, a.cave.size, a.cave.pits).map((m, i) => ({ ...m, name: `Treino ${i + 1}` }));
  switch (a.cave.type) {
    case 'missao':
      return missionById(a.cave.missionId)?.maps ?? [];
    case 'mapa':
      return [a.cave.layout];
    case 'sorteio': {
      const { seed, size, pits } = a.cave;
      return arenaMaps(`escola-${seed}`, 1, size, pits).map((m) => ({ ...m, name: `Caverna "${seed}"` }));
    }
  }
}

/** Blocos liberados: os da missão, ou todos para cavernas criadas/sorteadas. */
export const activityGroups = (a: Activity): BlockGroup[] => (a.cave?.type === 'missao' ? (missionById(a.cave.missionId)?.groups ?? ALL_GROUPS) : ALL_GROUPS);

/** Cavernas da Arena da turma: as mesmas para todos os programas (semente da atividade). */
export const arenaLayouts = (a: Activity, count = 20): MapLayout[] =>
  a.cave?.type === 'sorteio' ? arenaMaps(`arena-turma-${a.cave.seed}`, count, a.cave.size, a.cave.pits) : activityLayouts(a);

export function describeActivity(a: Activity): string {
  if (a.kind === 'trilha') return `lição "${lessonById(a.lessonId ?? '')?.title ?? a.lessonId}"`;
  if (!a.cave) return '';
  return a.kind === 'agente' ? `Arena da turma, ${describeCave(a.cave)}` : describeCave(a.cave);
}

export function describeCave(c: CaveSource): string {
  switch (c.type) {
    case 'missao':
      return `missão "${missionById(c.missionId)?.title ?? c.missionId}"`;
    case 'mapa':
      return `caverna "${c.layout.name}" (${c.layout.size}×${c.layout.size})`;
    case 'sorteio':
      return `caverna sorteada ${c.size}×${c.size} (semente "${c.seed}")`;
  }
}

function validatePlan(data: unknown): Plan {
  const p = data as Partial<Plan>;
  if (!p || p.format !== 'wumpus3d-plano' || !Array.isArray(p.activities) || typeof p.id !== 'string') {
    throw new Error('Isto não é um plano de atividade do Wumpus 3D.');
  }
  for (const a of p.activities) {
    if (!a || !(a.kind in KIND_LABEL)) throw new Error('O plano tem uma atividade incompleta.');
    if (a.kind === 'trilha') {
      if (!lessonById(a.lessonId ?? '')) throw new Error(`A lição "${a.lessonId}" não existe nesta versão.`);
      continue;
    }
    if (!a.cave) throw new Error('O plano tem uma atividade sem caverna.');
    if (a.cave.type === 'mapa') a.cave.layout = parseLayout(JSON.stringify(a.cave.layout));
    if (a.cave.type === 'missao' && !missionById(a.cave.missionId)) throw new Error(`A missão "${a.cave.missionId}" não existe nesta versão.`);
  }
  return { ...emptyPlan(), ...p } as Plan;
}

const PLAN_PREFIX = 'PLANO1';
export const planCode = (p: Plan) => toCode(PLAN_PREFIX, p);
export const parsePlanCode = (code: string) => validatePlan(fromCode(PLAN_PREFIX, code));
export function parsePlanFile(text: string): Plan {
  try {
    return validatePlan(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error('O arquivo não é um JSON válido.');
    throw err;
  }
}

/** Plano de exemplo: as primeiras missões e uma caverna no Detetive. */
export function samplePlan(): Plan {
  const p = emptyPlan();
  p.title = 'Primeira aula: o robô e a caverna';
  p.instructions = 'Comece pelo Detetive e depois programe o robô. Ao terminar, clique em "Enviar para o professor".';
  p.activities = [
    { id: 'a1', kind: 'detetive', title: 'Detetive: primeira caverna', instructions: 'Anote no caderno o que você descobre em cada sala.', cave: { type: 'sorteio', seed: 'aula1', size: 4, pits: 0.2 } },
    ...MISSIONS.slice(0, 3).map((m, i) => ({ id: `a${i + 2}`, kind: 'blocos' as const, title: `Blocos: ${m.title}`, instructions: m.goal, cave: { type: 'missao' as const, missionId: m.id } })),
  ];
  return p;
}

// ---------------------------------------------------------------- Registro do aluno

export interface Attempt {
  activityId: string; // 'livre' fora de um plano
  activityTitle: string;
  kind: ActivityKind;
  at: string; // fim da tentativa (ISO)
  ms: number;
  outcome: Status | 'erro';
  stars: number;
  actions: number;
  score: number;
  // Detetive
  logicErrors?: number;
  needlessRisks?: number;
  hints?: number;
  marks?: { certa: number; possivel: number; errada: number };
  // Trilha de IA
  lessonId?: string;
  answers?: { firstTry: number; total: number };
  reflections?: string[];
  // Blocos e Agente
  blocks?: number;
  program?: WorkspaceJson;
  programText?: string;
  error?: string | null;
}

export interface StudentRecord {
  format: 'wumpus3d-registro';
  version: 1;
  student: string;
  planId: string;
  planTitle: string;
  turmaId?: string;
  created: string;
  attempts: Attempt[];
}

export const newRecord = (student: string, plan: Pick<Plan, 'id' | 'title'> | null): StudentRecord => ({
  format: 'wumpus3d-registro',
  version: 1,
  student,
  planId: plan?.id ?? 'livre',
  planTitle: plan?.title ?? 'Jogo livre',
  created: new Date().toISOString(),
  attempts: [],
});

export function parseRecord(text: string, source = ''): StudentRecord {
  let data: Partial<StudentRecord>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${source || 'O arquivo'} não é um JSON válido.`);
  }
  if (!data || data.format !== 'wumpus3d-registro' || !Array.isArray(data.attempts) || typeof data.student !== 'string') {
    throw new Error(`${source || 'O arquivo'} não é um registro de aluno do Wumpus 3D.`);
  }
  return data as StudentRecord;
}

export interface ActivitySummary {
  attempts: number;
  won: boolean;
  stars: number; // melhor resultado
  attemptsToWin: number | null;
  minutes: number;
  hints: number;
  logicErrors: number;
  lastProgram: string | null;
  lastOutcome: Attempt['outcome'] | null;
}

/** Resumo das tentativas de um aluno numa atividade. */
export function summarizeActivity(attempts: Attempt[]): ActivitySummary {
  const firstWin = attempts.findIndex((a) => a.outcome === 'won');
  const withProgram = attempts.filter((a) => a.programText);
  return {
    attempts: attempts.length,
    won: firstWin >= 0,
    stars: Math.max(0, ...attempts.map((a) => a.stars)),
    attemptsToWin: firstWin >= 0 ? firstWin + 1 : null,
    minutes: Math.round(attempts.reduce((s, a) => s + a.ms, 0) / 6000) / 10,
    hints: attempts.reduce((s, a) => s + (a.hints ?? 0), 0),
    logicErrors: attempts.reduce((s, a) => s + (a.logicErrors ?? 0), 0),
    lastProgram: withProgram.at(-1)?.programText ?? null,
    lastOutcome: attempts.at(-1)?.outcome ?? null,
  };
}

/** Junta registros novos aos que já existem, sem repetir tentativas (mesmo aluno, plano e horário). */
export function mergeRecords(current: StudentRecord[], incoming: StudentRecord[]): StudentRecord[] {
  const out = current.map((r) => ({ ...r, attempts: [...r.attempts] }));
  for (const r of incoming) {
    const same = out.find((x) => x.student === r.student && x.planId === r.planId);
    if (!same) {
      out.push({ ...r, attempts: [...r.attempts] });
      continue;
    }
    const seen = new Set(same.attempts.map((a) => a.at + a.activityId));
    same.attempts.push(...r.attempts.filter((a) => !seen.has(a.at + a.activityId)));
    same.attempts.sort((a, b) => a.at.localeCompare(b.at));
  }
  return out;
}
