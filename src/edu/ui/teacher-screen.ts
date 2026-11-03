// Tela do Professor: montar o plano da aula (atividades e cavernas), entregar por código ou arquivo,
// e juntar os registros dos alunos num relatório da turma.
import { $, copyFromBox, downloadText, showMessage } from '../../ui/dom';
import { slugify } from '../../util/format';
import { buildClassReport, classReportCsv, renderClassReportHtml, type ClassReport } from '../class-report';
import { parseCaveCode } from '../caves';
import { loadCaves, loadDraft, saveDraft } from '../edu-storage';
import { MISSIONS, missionById } from '../missions';
import { describeCave, emptyPlan, newId, parsePlanFile, parseRecord, planCode, samplePlan, type Activity, type CaveSource, type Plan, type StudentRecord } from '../plan';
import { nav, setPlan } from './session';

let plan: Plan = loadDraft() ?? samplePlan();
let records: StudentRecord[] = [];
let report: ClassReport | null = null;

const planMsg = (t: string, e = false) => showMessage('#pl-msg', t, e);
const acMsg = (t: string, e = false) => showMessage('#ac-msg', t, e);
const rpMsg = (t: string, e = false) => showMessage('#rp-msg', t, e);
const val = (sel: string) => $<HTMLInputElement>(sel).value.trim();

function persist() {
  saveDraft(plan);
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
      text.querySelector('small')!.textContent = `${a.kind === 'detetive' ? '🔎 Detetive' : '🧩 Blocos'} · ${describeCave(a.cave)}${a.instructions ? ` · "${a.instructions}"` : ''}`;
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

function updateSourceFields() {
  const v = $<HTMLSelectElement>('#ac-source').value;
  for (const s of ['missao', 'sorteio', 'minha', 'codigo']) $(`#ac-${s}`).hidden = s !== v;
  if (v === 'minha') {
    const caves = loadCaves();
    $<HTMLSelectElement>('#ac-cave').replaceChildren(...(caves.length ? caves.map((c) => new Option(`${c.name} (${c.size}×${c.size})`, c.name)) : [new Option('Nenhuma caverna salva no Criador', '')]));
  }
}

function caveFromForm(): CaveSource {
  switch ($<HTMLSelectElement>('#ac-source').value) {
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

function addActivity() {
  try {
    const cave = caveFromForm();
    const kind = $<HTMLSelectElement>('#ac-kind').value as Activity['kind'];
    const fallback = cave.type === 'missao' ? missionById(cave.missionId)!.title : cave.type === 'mapa' ? cave.layout.name : `Caverna "${cave.seed}"`;
    plan.activities.push({ id: newId(), kind, title: val('#ac-title') || `${kind === 'detetive' ? 'Detetive' : 'Blocos'}: ${fallback}`, instructions: val('#ac-instructions'), cave });
    $<HTMLInputElement>('#ac-title').value = '';
    $<HTMLTextAreaElement>('#ac-instructions').value = '';
    renderPlan();
    acMsg(`Atividade ${plan.activities.length} adicionada.`);
  } catch (err) {
    acMsg((err as Error).message, true);
  }
}

// ---------------------------------------------------------------- Relatório

function refreshReport() {
  report = buildClassReport(plan, records);
  const html = renderClassReportHtml(report);
  $<HTMLIFrameElement>('#rp-view').srcdoc = html;
  for (const id of ['#rp-html', '#rp-csv', '#rp-print']) $<HTMLButtonElement>(id).disabled = !records.length;
}

async function importRecords(files: File[]) {
  const ok: string[] = [];
  const bad: string[] = [];
  for (const f of files) {
    try {
      records.push(parseRecord(await f.text(), f.name));
      ok.push(f.name);
    } catch (err) {
      bad.push((err as Error).message);
    }
  }
  refreshReport();
  rpMsg(`${ok.length} registro(s) importado(s); ${report!.students.length} aluno(s) no relatório.${bad.length ? ` Problemas: ${bad.join(' · ')}` : ''}`, bad.length > 0);
}

const fileBase = () => slugify(plan.title) || 'plano';

export function initTeacher() {
  $<HTMLSelectElement>('#ac-mission').replaceChildren(...MISSIONS.map((m, i) => new Option(`${i + 1}. ${m.title} (${m.concept})`, m.id)));
  $('#ac-source').addEventListener('change', updateSourceFields);
  $('#ac-add').addEventListener('click', addActivity);
  for (const [sel, field] of [['#pl-title', 'title'], ['#pl-group', 'group'], ['#pl-teacher', 'teacher'], ['#pl-instructions', 'instructions']] as const) {
    $(sel).addEventListener('input', (e) => {
      plan[field] = (e.target as HTMLInputElement).value;
      persist();
    });
  }
  $('#pl-new').addEventListener('click', () => {
    plan = emptyPlan();
    renderPlan();
    planMsg('Plano novo. Ele tem uma identificação própria: registros de planos antigos não se misturam com este.');
  });
  $('#pl-sample').addEventListener('click', () => {
    plan = samplePlan();
    renderPlan();
    planMsg('Plano de exemplo carregado: Detetive numa caverna sorteada e as três primeiras missões de blocos.');
  });
  $('#pl-copy').addEventListener('click', () => (plan.activities.length ? copyFromBox($<HTMLTextAreaElement>('#pl-code'), (t) => planMsg(t), 'Código copiado.') : planMsg('Adicione pelo menos uma atividade.', true)));
  $('#pl-download').addEventListener('click', () => {
    if (!plan.activities.length) return planMsg('Adicione pelo menos uma atividade.', true);
    planMsg(downloadText(`plano-${fileBase()}.json`, JSON.stringify(plan, null, 2), 'application/json') ? 'Arquivo do plano baixado.' : 'O navegador bloqueou o download: use o código.', false);
  });
  $('#pl-try').addEventListener('click', () => {
    if (!plan.activities.length) return planMsg('Adicione pelo menos uma atividade.', true);
    setPlan(JSON.parse(JSON.stringify(plan)));
    nav.refreshHome();
    nav.show('inicio');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $('#sub-planejar').hidden = b.dataset.sub !== 'planejar';
      $('#sub-relatorio').hidden = b.dataset.sub !== 'relatorio';
      if (b.dataset.sub === 'relatorio') refreshReport();
    }),
  );
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
      refreshReport();
      rpMsg(`Plano "${plan.title}" aberto.`);
    } catch (err) {
      rpMsg((err as Error).message, true);
    }
  });
  $('#rp-clear').addEventListener('click', () => {
    records = [];
    refreshReport();
    rpMsg('Registros removidos desta tela.');
  });
  $('#rp-html').addEventListener('click', () => report && downloadText(`relatorio-turma-${fileBase()}.html`, renderClassReportHtml(report), 'text/html'));
  $('#rp-csv').addEventListener('click', () => report && downloadText(`relatorio-turma-${fileBase()}.csv`, classReportCsv(report), 'text/csv'));
  $('#rp-print').addEventListener('click', () => $<HTMLIFrameElement>('#rp-view').contentWindow?.print());
  updateSourceFields();
  renderPlan();
}
