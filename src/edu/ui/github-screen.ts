// Aba GitHub da área do professor (opcional, D23): guardar turmas, planos, registros e relatórios num
// repositório PRIVADO do próprio professor, para usar de outro computador e ter o histórico das versões.
import { $, showMessage } from '../../ui/dom';
import { GitHubStore, fileSlug } from '../github-store';
import { parseRecord, type StudentRecord } from '../plan';
import { parseTurma, type Turma } from '../turma';
import { forgetGitHubToken, loadGitHub, saveGitHub } from './teacher-data';
import { addReceived, currentReportHtml, currentReportPlan, editingPlan, receivedRecords, refreshReport } from './teacher-screen';
import { allTurmas, replaceTurmas } from './turmas-screen';

const msg = (t: string, e = false) => showMessage('#gh-msg', t, e);
const val = (sel: string) => $<HTMLInputElement>(sel).value.trim();

function store(): GitHubStore | null {
  const owner = val('#gh-owner');
  const repo = val('#gh-repo');
  const token = val('#gh-token');
  if (!owner || !repo || !token) {
    msg('Preencha o dono, o repositório e o token.', true);
    return null;
  }
  const cfg = { owner, repo, token, folder: val('#gh-folder') || 'caverna' };
  saveGitHub(cfg, $<HTMLInputElement>('#gh-remember').checked);
  return new GitHubStore(cfg);
}

/** Executa uma operação mostrando o andamento e os erros em linguagem simples. */
async function run(label: string, fn: (s: GitHubStore) => Promise<string>) {
  const s = store();
  if (!s) return;
  const buttons = document.querySelectorAll<HTMLButtonElement>('#tab-github button');
  buttons.forEach((b) => (b.disabled = true));
  msg(`${label}…`);
  try {
    await s.check();
    msg(await fn(s));
  } catch (err) {
    msg((err as Error).message || 'Não deu para falar com o GitHub (sem internet?).', true);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

const recordPath = (r: StudentRecord) => `registros/${fileSlug(r.planId)}/${fileSlug(r.student)}.json`;

async function sendAll(s: GitHubStore) {
  const turmas = allTurmas();
  const plan = editingPlan();
  const records = receivedRecords();
  const when = new Date().toLocaleString('pt-BR');
  for (const t of turmas) await s.writeJson(`turmas/${t.id}.json`, t, `Turma ${t.name} (${when})`);
  await s.writeJson(`planos/${plan.id}.json`, plan, `Plano ${plan.title} (${when})`);
  for (const r of records) await s.writeJson(recordPath(r), r, `Registro de ${r.student} (${when})`);
  const html = currentReportHtml();
  if (html) await s.writeText(`relatorios/${fileSlug(currentReportPlan().title)}.html`, html, `Relatório ${currentReportPlan().title} (${when})`);
  return `Enviado: ${turmas.length} turma(s), 1 plano, ${records.length} registro(s)${html ? ' e o relatório' : ''}. Cada envio fica no histórico do repositório.`;
}

async function bringAll(s: GitHubStore) {
  const turmas: Turma[] = [];
  for (const name of await s.list('turmas')) {
    const f = await s.read<unknown>(`turmas/${name}`);
    if (f) turmas.push(parseTurma(JSON.stringify(f.data)));
  }
  // Junta com as turmas deste aparelho, ficando com a versão mais nova de cada uma
  const merged = new Map(allTurmas().map((t) => [t.id, t]));
  for (const t of turmas) if (!merged.has(t.id) || merged.get(t.id)!.updated < t.updated) merged.set(t.id, t);
  replaceTurmas([...merged.values()]);
  const planIds = new Set([editingPlan().id, ...[...merged.values()].flatMap((t) => (t.plan ? [t.plan.id] : []))]);
  const records: StudentRecord[] = [];
  for (const id of planIds) {
    for (const name of await s.list(`registros/${fileSlug(id)}`)) {
      const f = await s.read<unknown>(`registros/${fileSlug(id)}/${name}`);
      if (f) records.push(parseRecord(JSON.stringify(f.data), name));
    }
  }
  addReceived(records);
  refreshReport();
  return `Trazido do GitHub: ${turmas.length} turma(s) e ${records.length} registro(s). As turmas e registros deste aparelho foram mantidos.`;
}

export function initGitHub() {
  const c = loadGitHub();
  if (c) {
    $<HTMLInputElement>('#gh-owner').value = c.owner;
    $<HTMLInputElement>('#gh-repo').value = c.repo;
    $<HTMLInputElement>('#gh-folder').value = c.folder;
    $<HTMLInputElement>('#gh-token').value = c.token;
    $<HTMLInputElement>('#gh-remember').checked = c.remember;
  }
  $('#gh-test').addEventListener('click', () => run('Conferindo o acesso', async (s) => `Conectado a ${(await s.check()).fullName} (privado). Tudo pronto.`));
  $('#gh-send').addEventListener('click', () => run('Enviando para o GitHub', sendAll));
  $('#gh-bring').addEventListener('click', () => run('Trazendo do GitHub', bringAll));
  $('#gh-forget').addEventListener('click', () => {
    forgetGitHubToken();
    $<HTMLInputElement>('#gh-token').value = '';
    $<HTMLInputElement>('#gh-remember').checked = false;
    msg('Token apagado deste aparelho. Para revogá-lo de vez, apague-o em github.com → Settings → Developer settings → Personal access tokens.');
  });
}
