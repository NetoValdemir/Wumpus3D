// O que o modo escola guarda no navegador. Tudo protegido por try/catch: com armazenamento bloqueado,
// funciona sem salvar (o aluno ainda pode baixar o registro antes de fechar a página).
import { parseLayout, type MapLayout } from '../game/world';
import type { WorkspaceJson } from './blockly-json';
import { newRecord, type Plan, type StudentRecord } from './plan';

const KEY = {
  student: 'wumpus3d.escola.aluno',
  plan: 'wumpus3d.escola.plano', // plano que o aluno carregou
  draft: 'wumpus3d.escola.rascunho', // plano que o professor está montando
  records: 'wumpus3d.escola.registros',
  caves: 'wumpus3d.escola.cavernas',
  programs: 'wumpus3d.escola.programas',
  stars: 'wumpus3d.escola.estrelas',
};

export function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Cópias em memória: valem na sessão mesmo sem armazenamento
let records: Record<string, StudentRecord> = read(KEY.records, {});
let programs: Record<string, WorkspaceJson> = read(KEY.programs, {});
let stars: Record<string, number> = read(KEY.stars, {});

export const loadStudent = () => read<string>(KEY.student, '');
export const saveStudent = (name: string) => write(KEY.student, name);

export const loadStudentPlan = () => read<Plan | null>(KEY.plan, null);
export const saveStudentPlan = (p: Plan | null) => write(KEY.plan, p);

export const loadDraft = () => read<Plan | null>(KEY.draft, null);
export const saveDraft = (p: Plan) => write(KEY.draft, p);

const recordKey = (student: string, planId: string) => `${student}|${planId}`;

/** Registro do aluno neste plano (criado na primeira tentativa). */
export function getRecord(student: string, plan: Pick<Plan, 'id' | 'title'> | null): StudentRecord {
  const k = recordKey(student, plan?.id ?? 'livre');
  records[k] ??= newRecord(student, plan);
  return records[k];
}

export function saveRecords() {
  return write(KEY.records, records);
}

export function clearRecord(student: string, planId: string) {
  delete records[recordKey(student, planId)];
  saveRecords();
}

export function loadCaves(): MapLayout[] {
  return read<unknown[]>(KEY.caves, []).flatMap((c) => {
    try {
      return [parseLayout(JSON.stringify(c))];
    } catch {
      return [];
    }
  });
}

export function saveCave(l: MapLayout) {
  return write(KEY.caves, [...loadCaves().filter((c) => c.name !== l.name), l]);
}

export const deleteCave = (name: string) => write(KEY.caves, loadCaves().filter((c) => c.name !== name));

/** Programa salvo por missão/atividade, para continuar de onde parou. */
export const loadProgram = (id: string) => programs[id] ?? null;
export function saveProgram(id: string, ws: WorkspaceJson) {
  programs[id] = ws;
  write(KEY.programs, programs);
}

export const bestStars = (id: string) => stars[id] ?? 0;
export function saveStars(id: string, n: number) {
  if (n <= (stars[id] ?? 0)) return;
  stars[id] = n;
  write(KEY.stars, stars);
}

/** Para os testes da interface e para recomeçar do zero. */
export function resetMemory() {
  records = read(KEY.records, {});
  programs = read(KEY.programs, {});
  stars = read(KEY.stars, {});
}

/** Todos os programas de blocos salvos neste aparelho (para a Arena da trilha). */
export const listPrograms = () => Object.entries(programs);
