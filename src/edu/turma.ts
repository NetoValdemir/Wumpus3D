// Turma do professor e o "código da turma" que vai para os alunos (D23).
// O professor guarda a lista com os PINs (para reimprimir quando alguém esquecer); o código da turma leva
// só o resumo de cada PIN, o plano em uso e os dados de identificação. Sem servidor: a conferência do PIN
// acontece no aparelho do aluno.
import { PIN_ITERATIONS, hashSecret, randomPin, verifySecret, type SecretHash } from './auth';
import { fromCode, toCode } from './caves';
import { newId, parsePlanFile, type Plan } from './plan';

export interface StudentEntry {
  name: string; // apelido, único na turma
  pin: string; // 4 dígitos (só no aparelho/repositório do professor)
}

/** Turma como o professor guarda. */
export interface Turma {
  format: 'wumpus3d-turma';
  version: 1;
  id: string;
  name: string;
  teacher: string;
  students: StudentEntry[];
  plan: Plan | null;
  updated: string;
}

/** O que vai no código da turma: sem os PINs, só os resumos. */
export interface TurmaPublic {
  format: 'wumpus3d-turma-aluno';
  version: 1;
  id: string;
  name: string;
  teacher: string;
  students: ({ name: string } & SecretHash)[];
  plan: Plan | null;
}

export const newTurma = (name: string, teacher: string): Turma => ({
  format: 'wumpus3d-turma',
  version: 1,
  id: newId(),
  name: name.trim().slice(0, 40) || 'Minha turma',
  teacher,
  students: [],
  plan: null,
  updated: new Date().toISOString(),
});

const clean = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 40);

/** Acrescenta alunos (um apelido por linha) com PINs novos. Devolve os apelidos ignorados (vazios ou repetidos). */
export function addStudents(t: Turma, names: string[]): string[] {
  const skipped: string[] = [];
  const taken = new Set(t.students.map((s) => s.name.toLowerCase()));
  for (const raw of names) {
    const name = clean(raw);
    if (!name) continue;
    if (taken.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    taken.add(name.toLowerCase());
    t.students.push({ name, pin: randomPin() });
  }
  t.students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  t.updated = new Date().toISOString();
  return skipped;
}

export function resetPin(t: Turma, name: string): string | null {
  const s = t.students.find((x) => x.name === name);
  if (!s) return null;
  s.pin = randomPin();
  t.updated = new Date().toISOString();
  return s.pin;
}

export function removeStudent(t: Turma, name: string) {
  t.students = t.students.filter((s) => s.name !== name);
  t.updated = new Date().toISOString();
}

/** Versão para os alunos: troca cada PIN pelo seu resumo. */
export async function publicTurma(t: Turma): Promise<TurmaPublic> {
  const students = await Promise.all(t.students.map(async (s) => ({ name: s.name, ...(await hashSecret(s.pin, PIN_ITERATIONS)) })));
  return { format: 'wumpus3d-turma-aluno', version: 1, id: t.id, name: t.name, teacher: t.teacher, students, plan: t.plan };
}

const PREFIX = 'TURMA1';
export const turmaCode = (p: TurmaPublic) => toCode(PREFIX, p);

function validate(data: unknown): TurmaPublic {
  const t = data as Partial<TurmaPublic>;
  if (!t || t.format !== 'wumpus3d-turma-aluno' || typeof t.id !== 'string' || !Array.isArray(t.students)) {
    throw new Error('Isto não é um código de turma do Wumpus 3D.');
  }
  for (const s of t.students) if (!s || typeof s.name !== 'string' || typeof s.hash !== 'string') throw new Error('O código da turma está incompleto.');
  return { ...(t as TurmaPublic), plan: t.plan ? parsePlanFile(JSON.stringify(t.plan)) : null };
}

export const parseTurmaCode = (code: string) => validate(fromCode(PREFIX, code));

export function parseTurmaFile(text: string): TurmaPublic {
  try {
    return validate(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error('O arquivo não é um JSON válido.');
    throw err;
  }
}

/** Confere apelido e PIN. */
export async function checkStudent(t: TurmaPublic, name: string, pin: string): Promise<boolean> {
  const s = t.students.find((x) => x.name === name);
  return !!s && (await verifySecret(pin, s));
}

export function parseTurma(text: string): Turma {
  const t = JSON.parse(text) as Partial<Turma>;
  if (!t || t.format !== 'wumpus3d-turma' || typeof t.id !== 'string' || !Array.isArray(t.students)) throw new Error('Isto não é uma turma do Wumpus 3D.');
  return { ...(t as Turma), plan: t.plan ? parsePlanFile(JSON.stringify(t.plan)) : null };
}
