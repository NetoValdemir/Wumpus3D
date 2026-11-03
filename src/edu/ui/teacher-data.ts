// Dados do professor neste aparelho, separados por usuário (D23): plano em edição, turmas, registros
// recebidos dos alunos e a configuração do GitHub. O token do GitHub só fica guardado se o professor pedir.
import { read, write } from '../edu-storage';
import { loadDraft as loadOldDraft } from '../edu-storage';
import { parseRecord, samplePlan, type Plan, type StudentRecord } from '../plan';
import type { Turma } from '../turma';
import type { GitHubConfig } from '../github-store';
import { currentSession } from './access';

const user = currentSession()?.user ?? 'sem-usuario';
const key = (what: string) => `wumpus3d.escola.${what}.${user}`;

export const teacher = { user, name: currentSession()?.name ?? '' };

export const loadPlanDraft = (): Plan => read<Plan | null>(key('rascunho'), null) ?? loadOldDraft() ?? { ...samplePlan(), teacher: teacher.name };
export const savePlanDraft = (p: Plan) => write(key('rascunho'), p);

export const loadTurmas = () => read<Turma[]>(key('turmas'), []);
export const saveTurmas = (t: Turma[]) => write(key('turmas'), t);

/** Registros recebidos dos alunos (a lista do relatório sobrevive a recarregar a página). */
export const loadReceived = (): StudentRecord[] =>
  read<unknown[]>(key('registros'), []).flatMap((r) => {
    try {
      return [parseRecord(JSON.stringify(r))];
    } catch {
      return [];
    }
  });
export const saveReceived = (r: StudentRecord[]) => write(key('registros'), r);

type SavedConfig = Omit<GitHubConfig, 'token'> & { token?: string };

export function loadGitHub(): (GitHubConfig & { remember: boolean }) | null {
  const c = read<SavedConfig | null>(key('github'), null);
  if (!c) return null;
  let token = c.token ?? '';
  if (!token) {
    try {
      token = sessionStorage.getItem(key('github-token')) ?? '';
    } catch {
      // sem armazenamento da sessão
    }
  }
  return { ...c, token, remember: !!c.token };
}

/** Com "lembrar", o token fica no aparelho; sem, só até fechar a aba. */
export function saveGitHub(c: GitHubConfig, remember: boolean) {
  write(key('github'), remember ? c : { owner: c.owner, repo: c.repo, folder: c.folder });
  try {
    if (remember) sessionStorage.removeItem(key('github-token'));
    else sessionStorage.setItem(key('github-token'), c.token);
  } catch {
    // sem armazenamento da sessão
  }
}

export function forgetGitHubToken() {
  const c = loadGitHub();
  if (c) write(key('github'), { owner: c.owner, repo: c.repo, folder: c.folder });
  try {
    sessionStorage.removeItem(key('github-token'));
  } catch {
    // nada a apagar
  }
}
