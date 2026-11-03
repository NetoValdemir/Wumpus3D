// Aba Turmas da área do professor: alunos com PIN, plano da turma e o código da turma para os alunos (D23).
import { $, copyFromBox, downloadText, showMessage } from '../../ui/dom';
import { escapeHtml as esc, slugify } from '../../util/format';
import { addStudents, newTurma, publicTurma, removeStudent, resetPin, turmaCode, type Turma } from '../turma';
import { editingPlan, refreshReportPlans } from './teacher-screen';
import { loadTurmas, saveTurmas, teacher } from './teacher-data';

let turmas: Turma[] = loadTurmas();
let selectedId: string | null = turmas[0]?.id ?? null;
let codeFor: string | null = null; // turma e versão (updated) do código mostrado

const msg = (t: string, e = false) => showMessage('#tm-msg', t, e);
const selected = () => turmas.find((t) => t.id === selectedId) ?? null;

function save(t?: Turma) {
  if (t) t.updated = new Date().toISOString();
  saveTurmas(turmas);
  refreshReportPlans();
}

/** Turmas guardadas (a aba GitHub envia e traz). */
export const allTurmas = () => turmas;
export function replaceTurmas(list: Turma[]) {
  turmas = list;
  selectedId = turmas.find((t) => t.id === selectedId)?.id ?? turmas[0]?.id ?? null;
  save();
  renderTurmas();
}

function renderList() {
  const sel = $<HTMLSelectElement>('#tm-select');
  sel.replaceChildren(...(turmas.length ? turmas.map((t) => new Option(`${t.name} (${t.students.length} alunos)`, t.id)) : [new Option('Nenhuma turma ainda', '')]));
  if (selectedId) sel.value = selectedId;
}

function renderStudents(t: Turma) {
  const body = $('#tm-students');
  body.replaceChildren(
    ...t.students.map((s) => {
      const tr = document.createElement('tr');
      const name = Object.assign(document.createElement('th'), { textContent: s.name });
      const pin = Object.assign(document.createElement('td'), { textContent: s.pin, className: 'pin' });
      const tools = document.createElement('td');
      const reset = Object.assign(document.createElement('button'), { textContent: 'Novo PIN', className: 'ghost' });
      reset.addEventListener('click', () => {
        resetPin(t, s.name);
        save(t);
        renderTurmas();
        msg(`Novo PIN de ${s.name}: ${t.students.find((x) => x.name === s.name)!.pin}. Gere o código da turma de novo.`);
      });
      const del = Object.assign(document.createElement('button'), { textContent: 'Remover', className: 'ghost' });
      del.addEventListener('click', () => {
        if (!del.dataset.confirm) {
          del.dataset.confirm = '1';
          del.textContent = 'Confirmar?';
          return;
        }
        removeStudent(t, s.name);
        save(t);
        renderTurmas();
      });
      tools.append(reset, del);
      tr.append(name, pin, tools);
      return tr;
    }),
  );
  $('#tm-empty').hidden = t.students.length > 0;
}

export function renderTurmas() {
  renderList();
  const t = selected();
  $('#tm-detail').hidden = !t;
  if (!t) return;
  $<HTMLInputElement>('#tm-name').value = t.name;
  renderStudents(t);
  $('#tm-plan').textContent = t.plan ? `"${t.plan.title}" (${t.plan.activities.length} atividades)` : 'nenhum plano ainda';
  // Qualquer mudança na turma invalida o código mostrado: é preciso gerar de novo
  if (codeFor !== `${t.id}:${t.updated}`) $<HTMLTextAreaElement>('#tm-code').value = '';
}

/** Cartões de PIN para recortar e entregar (HTML para imprimir). */
function pinCards(t: Turma) {
  const cards = t.students.map((s) => `<div class="card"><b>${esc(t.name)}</b><span>Apelido</span><strong>${esc(s.name)}</strong><span>PIN</span><strong class="pin">${s.pin}</strong></div>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>PINs — ${esc(t.name)}</title><style>
body{font-family:system-ui,sans-serif;margin:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.card{border:2px dashed #999;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:2px;break-inside:avoid}
.card span{font-size:11px;color:#666}.card strong{font-size:18px}.pin{letter-spacing:4px}</style></head><body>
<p>Turma ${esc(t.name)} — entre em <b>escola.html → Sou aluno</b> com o código da turma, o apelido e o PIN.</p><div class="grid">${cards}</div></body></html>`;
}

export function initTurmas() {
  $('#tm-select').addEventListener('change', (e) => {
    selectedId = (e.target as HTMLSelectElement).value || null;
    $<HTMLTextAreaElement>('#tm-code').value = '';
    renderTurmas();
  });
  $('#tm-new').addEventListener('click', () => {
    const name = $<HTMLInputElement>('#tm-new-name').value.trim();
    if (!name) return msg('Dê um nome à turma (por exemplo, "7º ano B").', true);
    const t = newTurma(name, teacher.name);
    turmas.push(t);
    selectedId = t.id;
    $<HTMLInputElement>('#tm-new-name').value = '';
    save();
    renderTurmas();
    msg(`Turma "${t.name}" criada. Agora acrescente os alunos.`);
  });
  $('#tm-name').addEventListener('change', (e) => {
    const t = selected();
    if (!t) return;
    t.name = (e.target as HTMLInputElement).value.trim().slice(0, 40) || t.name;
    save(t);
    renderTurmas();
  });
  $('#tm-add').addEventListener('click', () => {
    const t = selected();
    if (!t) return;
    const box = $<HTMLTextAreaElement>('#tm-names');
    const skipped = addStudents(t, box.value.split('\n'));
    box.value = '';
    save(t);
    renderTurmas();
    msg(skipped.length ? `Alunos acrescentados. Já existiam: ${skipped.join(', ')}.` : 'Alunos acrescentados, cada um com seu PIN.');
  });
  $('#tm-use-plan').addEventListener('click', () => {
    const t = selected();
    if (!t) return;
    const p = editingPlan();
    if (!p.activities.length) return msg('O plano em edição (aba Planejar) ainda não tem atividades.', true);
    t.plan = JSON.parse(JSON.stringify(p));
    save(t);
    renderTurmas();
    msg(`A turma agora usa o plano "${p.title}". Gere o código da turma e entregue de novo.`);
  });
  $('#tm-generate').addEventListener('click', async () => {
    const t = selected();
    if (!t) return;
    if (!t.students.length) return msg('Acrescente os alunos antes de gerar o código.', true);
    msg('Gerando o código (cifrando os PINs)…');
    $<HTMLTextAreaElement>('#tm-code').value = turmaCode(await publicTurma(t));
    codeFor = `${t.id}:${t.updated}`;
    renderTurmas();
    msg(`Código da turma pronto. Os alunos entram em escola.html → Sou aluno.${t.plan ? '' : ' Atenção: a turma ainda não tem plano.'}`);
  });
  $('#tm-copy').addEventListener('click', () => copyFromBox($<HTMLTextAreaElement>('#tm-code'), (x) => msg(x), 'Código da turma copiado.'));
  $('#tm-download').addEventListener('click', async () => {
    const t = selected();
    if (!t || !t.students.length) return msg('Acrescente os alunos antes.', true);
    const ok = downloadText(`turma-${slugify(t.name) || 'turma'}.json`, JSON.stringify(await publicTurma(t), null, 2), 'application/json');
    msg(ok ? 'Arquivo da turma baixado (sem os PINs: só os resumos).' : 'O navegador bloqueou o download: use o código.');
  });
  $('#tm-cards').addEventListener('click', () => {
    const t = selected();
    if (!t || !t.students.length) return msg('Acrescente os alunos antes.', true);
    msg(downloadText(`pins-${slugify(t.name) || 'turma'}.html`, pinCards(t), 'text/html') ? 'Cartões baixados: abra o arquivo e imprima.' : 'O navegador bloqueou o download.');
  });
  renderTurmas();
}
