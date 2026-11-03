// Quem está usando o modo escola neste aparelho (D23): perfis de professor (senha cifrada), turmas que o
// aluno já abriu (com os resumos dos PINs) e a sessão da aba (some ao fechar a aba: bom para laboratório).
// Sem servidor: organiza o acesso e evita uso casual, mas não é proteção forte (ver auth.ts).
import { TEACHER_ITERATIONS, hashSecret, passwordProblem, verifySecret, type SecretHash } from '../auth';
import { checkStudent, type TurmaPublic } from '../turma';
import { read, write } from '../edu-storage';

export type Role = 'professor' | 'aluno' | 'visitante';

export interface Session {
  role: Role;
  name: string; // nome do professor, apelido do aluno ou "Visitante"
  user?: string; // usuário do professor
  turmaId?: string;
}

export interface TeacherProfile extends SecretHash {
  user: string;
  name: string;
  created: string;
}

const KEY = { profiles: 'wumpus3d.escola.professores', turmas: 'wumpus3d.escola.turmas-aluno', session: 'wumpus3d.escola.sessao' };

// ---------- Sessão da aba ----------

export function currentSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY.session) ?? 'null');
  } catch {
    return null;
  }
}

function startSession(s: Session) {
  try {
    sessionStorage.setItem(KEY.session, JSON.stringify(s));
  } catch {
    // sem armazenamento da sessão: a página de destino pede o login de novo
  }
}

export function endSession() {
  try {
    sessionStorage.removeItem(KEY.session);
  } catch {
    // nada a apagar
  }
}

/** Na página de cada área: sem a sessão certa, volta para a tela inicial. */
export function requireSession(roles: Role[]): Session {
  const s = currentSession();
  if (!s || !roles.includes(s.role)) {
    location.replace('./escola.html');
    throw new Error('Sem sessão: voltando para a tela inicial.');
  }
  return s;
}

// ---------- Professor ----------

export const loadProfiles = () => read<TeacherProfile[]>(KEY.profiles, []);
const cleanUser = (u: string) => u.trim().toLowerCase().replace(/\s+/g, '.').slice(0, 40);

/** Cria o acesso do professor neste aparelho. Devolve a mensagem de erro, ou null. */
export async function createTeacher(name: string, user: string, password: string, confirm: string): Promise<string | null> {
  const u = cleanUser(user);
  if (!name.trim() || !u) return 'Preencha o nome e o usuário.';
  if (loadProfiles().some((p) => p.user === u)) return 'Já existe um professor com esse usuário neste aparelho.';
  const problem = passwordProblem(password);
  if (problem) return problem;
  if (password !== confirm) return 'As duas senhas não são iguais.';
  const h = await hashSecret(password, TEACHER_ITERATIONS);
  if (!write(KEY.profiles, [...loadProfiles(), { user: u, name: name.trim().slice(0, 60), created: new Date().toISOString(), ...h }])) {
    return 'Este navegador está bloqueando o armazenamento: não dá para criar o acesso.';
  }
  return null;
}

export async function teacherLogin(user: string, password: string): Promise<string | null> {
  const p = loadProfiles().find((x) => x.user === cleanUser(user));
  if (!p || !(await verifySecret(password, p))) return 'Usuário ou senha não conferem.';
  startSession({ role: 'professor', name: p.name, user: p.user });
  return null;
}

/** Remove o acesso (e os dados do professor neste aparelho). Usado quando a senha é esquecida. */
export function removeTeacher(user: string) {
  write(KEY.profiles, loadProfiles().filter((p) => p.user !== user));
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith(`.${user}`) && k.startsWith('wumpus3d.escola.')) localStorage.removeItem(k);
  } catch {
    // sem armazenamento
  }
}

// ---------- Aluno ----------

export const loadKnownTurmas = () => read<Record<string, TurmaPublic>>(KEY.turmas, {});
export const knownTurma = (id: string) => loadKnownTurmas()[id] ?? null;

/** Guarda (ou atualiza) a turma aberta pelo código, para os próximos logins neste aparelho. */
export function rememberTurma(t: TurmaPublic) {
  write(KEY.turmas, { ...loadKnownTurmas(), [t.id]: t });
}

export async function studentLogin(t: TurmaPublic, name: string, pin: string): Promise<string | null> {
  if (!name) return 'Escolha o seu apelido na lista.';
  if (!(await checkStudent(t, name, pin.trim()))) return 'O PIN não confere. Confira com o professor.';
  startSession({ role: 'aluno', name, turmaId: t.id });
  return null;
}

export const visitorLogin = () => startSession({ role: 'visitante', name: 'Visitante' });
