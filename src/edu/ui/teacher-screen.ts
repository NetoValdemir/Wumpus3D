// Área do professor: montar o plano da aula (Detetive, Blocos, lições da Trilha de IA, Agente para a Arena)
// e juntar os registros dos alunos no relatório da turma.
import { $, copyFromBox, downloadText, showMessage } from '../../ui/dom';
import { slugify } from '../../util/format';
import { buildClassReport, classReportCsv, renderClassReportHtml, type ClassReport } from '../class-report';
import { parseCaveCode } from '../caves';
import { loadCaves } from '../edu-storage';
import { MISSIONS, missionById } from '../missions';
import { KIND_LABEL, describeActivity, emptyPlan, mergeRecords, newId, parsePlanFile, parseRecord, planCode, samplePlan, type Activity, type CaveSource, type Plan, type StudentRecord } from '../plan';
import { LESSONS, lessonById } from '../trilha/lessons';
import { loadPlanDraft, loadReceived, loadTurmas, savePlanDraft, saveReceived, teacher } from './teacher-data';

let plan: Plan = loadPlanDraft();
let records: StudentRecord[] = loadReceived();
let report: ClassReport | null = null;

const planMsg = (t: string, e = false) => showMessage('#pl-msg', t, e);
const acMsg = (t: string, e = false) => showMessage('#ac-msg', t, e);
const rpMsg = (t: string, e = false) => showMessage('#rp-msg', t, e);
const val = (sel: string) => $<HTMLInputElement>(sel).value.trim();

/** O plano em edição (a aba Turmas usa para entregar à turma). */
export const editingPlan = () => plan;

export function setEditingPlan(p: Plan) {
  plan = p;
  renderPlan();
}

function persist() {
  savePlanDraft(plan);
  $<HTMLTextAreaElement>('#pl-code').value = plan.activities.length ? planCode(plan) : '';
}

function renderPlan() {
  $<HTMLInputElement>('#pl-title').value = plan.title;
  $<HTMLInputElement>('#pl-group').value = plan.group;
  $<HTMLInputElement>('#pl-teacher').value = plan.teacher;
  $<HTMLTextAreaElement>('#pl-instructions').value = plan.instructions;
  const ol = $('#pl-activities');
  ol.replaceChildren(
    ...plan.activities.map((a, i) => {
      const li = document.createElement('li');
      const text = document.createElement('div');
      text.innerHTML = '<b></b><small></small>';
      text.querySelector('b')!.textContent = a.title;
      text.querySelector('small')!.textContent = `${KIND_LABEL[a.kind]} · ${describeActivity(a)}${a.instructions ? ` · "${a.instructions}"` : ''}`;
      const tools = document.createElement('div');
      tools.className = 'row tight';
      const btn = (label: string, title: string, fn: () => void, disabled = false) => {
        const b = Object.assign(document.createElement('button'), { textContent: label, title, disabled, className: 'icon' });
        b.setAttribute('aria-label', title);
        b.addEventListener('click', () => {
          fn();
          persist();
          renderPlan();
        });
        return b;
      };
      const move = (d: number) => () => {
        const [x] = plan.activities.splice(i, 1);
        plan.activities.splice(i + d, 0, x);
      };
      tools.append(btn('↑', 'Subir', move(-1), i === 0), btn('↓', 'Descer', move(1), i === plan.activities.length - 1), btn('✕', 'Remover', () => plan.activities.splice(i, 1)));
      li.append(text, tools);
      return li;
    }),
  );
  $('#pl-empty').hidden = plan.activities.length > 0;
  persist();
}

/** Mostra só os campos que valem para o modo e a fonte escolhidos. */
function updateFields() {
  const kind = $<HTMLSelectElement>('#ac-kind').value as Activity['kind'];
  const source = $<HTMLSelectElement>('#ac-source');
  $('#ac-source-row').hidden = kind === 'trilha' || kind === 'agente';
  $('#ac-trilha').hidden = kind !== 'trilha';
  const v = kind === 'agente' ? 'sorteio' : kind === 'trilha' ? '' : source.value;
  for (const s of ['missao', 'sorteio', 'minha', 'codigo']) $(`#ac-${s}`).hidden = s !== v;
  if (v === 'minha') {
    const caves = loadCaves();
    $<HTMLSelectElement>('#ac-cave').replaceChildren(...(caves.length ? caves.map((c) => new Option(`${c.name} (${c.size}×${c.size})`, c.name)) : [new Option('Nenhuma caverna salva no Criador', '')]));
  }
  $('#ac-agente-hint').hidden = kind !== 'agente';
}

function caveFromForm(source: string): CaveSource {
  switch (source) {
    case 'missao':
      return { type: 'missao', missionId: $<HTMLSelectElement>('#ac-mission').value };
    case 'sorteio':
      return { type: 'sorteio', seed: val('#ac-seed') || 'turma', size: Number($<HTMLSelectElement>('#ac-size').value), pits: 0.2 };
    case 'minha': {
      const c = loadCaves().find((x) => x.name === $<HTMLSelectElement>('#ac-cave').value);
      if (!c) throw new Error('Crie e salve uma caverna no Criador primeiro.');
      return { type: 'mapa', layout: c };
    }
    default:
      return { type: 'mapa', layout: parseCaveCode($<HTMLTextAreaElement>('#ac-code').value) };
  }
}

function newActivity(): Activity {
  const kind = $<HTMLSelectElement>('#ac-kind').value as Activity['kind'];
  const base = { id: newId(), kind, instructions: val('#ac-instructions') };
  if (kind === 'trilha') {
    const lesson = lessonById($<HTMLSelectElement>('#ac-lesson').value)!;
    return { ...base, title: val('#ac-title') || `Trilha de IA: ${lesson.title}`, cave: null, lessonId: lesson.id };
  }
  const cave = caveFromForm(kind === 'agente' ? 'sorteio' : $<HTMLSelectElement>('#ac-source').value);
  const name = cave.type === 'missao' ? missionById(cave.missionId)!.title : cave.type === 'mapa' ? cave.layout.name : `caverna "${cave.seed}"`;
  const label = { detetive: 'Detetive', blocos: 'Blocos', agente: 'Arena da turma' }[kind];
  return { ...base, title: val('#ac-title') || `${label}: ${name}`, cave };
}

function addActivity() {
  try {
    plan.activities.push(newActivity());
    $<HTMLInputElement>('#ac-title').value = '';
    $<HTMLTextAreaElement>('#ac-instructions').value = '';
    renderPlan();
    acMsg(`Atividade ${plan.activities.length} adicionada. Lembre de entregar o plano à turma (aba Turmas).`);
  } catch (err) {
    acMsg((err as Error).message, true);
  }
}

// ---------------------------------------------------------------- Relatório

/** Plano usado no relatório: o de uma turma, ou o plano em edição. */
function reportPlan(): Plan {
  const v = $<HTMLSelectElement>('#rp-plan-select').value;
  return (v && loadTurmas().find((t) => t.id === v)?.plan) || plan;
}

export function refreshReportPlans() {
  const sel = $<HTMLSelectElement>('#rp-plan-select');
  const current = sel.value;
  sel.replaceChildren(new Option(`Plano em edição: ${plan.title}`, ''), ...loadTurmas().filter((t) => t.plan).map((t) => new Option(`Turma ${t.name}: ${t.plan!.title}`, t.id)));
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

export function refreshReport() {
  report = buildClassReport(reportPlan(), records);
  $<HTMLIFrameElement>('#rp-view').srcdoc = renderClassReportHtml(report);
  for (const id of ['#rp-html', '#rp-csv', '#rp-print']) $<HTMLButtonElement>(id).disabled = !records.length;
  $('#rp-count').textContent = `${records.length} registro(s) guardado(s) neste aparelho.`;
}

/** Registros recebidos (para a aba GitHub enviar e trazer). */
export const receivedRecords = () => records;

export function addReceived(incoming: StudentRecord[]) {
  records = mergeRecords(records, incoming);
  saveReceived(records);
  refreshReport();
}

async function importRecords(files: File[]) {
  const ok: StudentRecord[] = [];
  const bad: string[] = [];
  for (const f of files) {
    try {
      ok.push(parseRecord(await f.text(), f.name));
    } catch (err) {
      bad.push((err as Error).message);
    }
  }
  addReceived(ok);
  rpMsg(`${ok.length} registro(s) importado(s); ${report!.students.length} aluno(s) no relatório.${bad.length ? ` Problemas: ${bad.join(' · ')}` : ''}`, bad.length > 0);
}

const fileBase = () => slugify(reportPlan().title) || 'plano';

export function initTeacher() {
  $<HTMLSelectElement>('#ac-mission').replaceChildren(...MISSIONS.map((m, i) => new Option(`${i + 1}. ${m.title} (${m.concept})`, m.id)));
  $<HTMLSelectElement>('#ac-lesson').replaceChildren(...LESSONS.map((l) => new Option(`Módulo ${l.module}: ${l.title} (${l.minutes} min)`, l.id)));
  $('#ac-kind').addEventListener('change', updateFields);
  $('#ac-source').addEventListener('change', updateFields);
  $('#ac-add').addEventListener('click', addActivity);
  for (const [sel, field] of [['#pl-title', 'title'], ['#pl-group', 'group'], ['#pl-teacher', 'teacher'], ['#pl-instructions', 'instructions']] as const) {
    $(sel).addEventListener('input', (e) => {
      plan[field] = (e.target as HTMLInputElement).value;
      persist();
    });
  }
  $('#pl-new').addEventListener('click', () => {
    plan = { ...emptyPlan(), teacher: teacher.name };
    renderPlan();
    planMsg('Plano novo. Ele tem uma identificação própria: registros de planos antigos não se misturam com este.');
  });
  $('#pl-sample').addEventListener('click', () => {
    plan = { ...samplePlan(), teacher: teacher.name };
    renderPlan();
    planMsg('Plano de exemplo carregado: Detetive numa caverna sorteada e as três primeiras missões de blocos.');
  });
  $('#pl-copy').addEventListener('click', () => (plan.activities.length ? copyFromBox($<HTMLTextAreaElement>('#pl-code'), (t) => planMsg(t), 'Código copiado.') : planMsg('Adicione pelo menos uma atividade.', true)));
  $('#pl-download').addEventListener('click', () => {
    if (!plan.activities.length) return planMsg('Adicione pelo menos uma atividade.', true);
    planMsg(downloadText(`plano-${slugify(plan.title) || 'plano'}.json`, JSON.stringify(plan, null, 2), 'application/json') ? 'Arquivo do plano baixado.' : 'O navegador bloqueou o download: use o código.');
  });

  $<HTMLInputElement>('#rp-files').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    await importRecords(files);
  });
  $<HTMLInputElement>('#rp-plan').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      plan = parsePlanFile(await file.text());
      renderPlan();
      refreshReportPlans();
      $<HTMLSelectElement>('#rp-plan-select').value = '';
      refreshReport();
      rpMsg(`Plano "${plan.title}" aberto (agora é o plano em edição).`);
    } catch (err) {
      rpMsg((err as Error).message, true);
    }
  });
  $('#rp-plan-select').addEventListener('change', refreshReport);
  $('#rp-clear').addEventListener('click', () => {
    records = [];
    saveReceived(records);
    refreshReport();
    rpMsg('Registros removidos deste aparelho (os do GitHub, se houver, continuam lá).');
  });
  $('#rp-html').addEventListener('click', () => report && downloadText(`relatorio-turma-${fileBase()}.html`, renderClassReportHtml(report), 'text/html'));
  $('#rp-csv').addEventListener('click', () => report && downloadText(`relatorio-turma-${fileBase()}.csv`, classReportCsv(report), 'text/csv'));
  $('#rp-print').addEventListener('click', () => $<HTMLIFrameElement>('#rp-view').contentWindow?.print());
  updateFields();
  renderPlan();
  refreshReportPlans();
}

/** HTML do relatório atual (a aba GitHub guarda uma cópia). */
export const currentReportHtml = () => (report ? renderClassReportHtml(report) : null);
export const currentReportPlan = () => reportPlan();
