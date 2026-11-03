// Tela Início (aluno): apelido, abrir a atividade do professor, ver o andamento e enviar o registro.
import { $, downloadText, showMessage } from '../../ui/dom';
import { slugify } from '../../util/format';
import { parsePlanCode, parsePlanFile, summarizeActivity, type Plan } from '../plan';
import { clearRecord } from '../edu-storage';
import { currentRecord, nav, session, setPlan, setStudent, sourceFromActivity, studentName } from './session';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

function openPlan(p: Plan) {
  setPlan(p);
  renderHome();
  showMessage('#plan-msg', `Atividade "${p.title}" aberta.`);
}

export function renderHome() {
  $<HTMLInputElement>('#student-name').value = session.student;
  const p = session.plan;
  $('#plan-box').hidden = !p;
  if (!p) return;
  $('#plan-title').textContent = p.title;
  $('#plan-meta').textContent = [p.group && `Turma ${p.group}`, p.teacher && `Professor(a) ${p.teacher}`, `${p.activities.length} atividade${p.activities.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
  $('#plan-instructions').textContent = p.instructions;
  const rec = currentRecord(p.activities[0] ?? null);
  $('#plan-activities').replaceChildren(
    ...p.activities.map((a, i) => {
      const s = summarizeActivity(rec.attempts.filter((t) => t.activityId === a.id));
      const li = document.createElement('li');
      li.className = s.won ? 'done' : '';
      const info = document.createElement('div');
      info.innerHTML = `<b></b><small></small>`;
      info.querySelector('b')!.textContent = `${i + 1}. ${a.title}`;
      info.querySelector('small')!.textContent = `${a.kind === 'detetive' ? '🔎 Detetive' : '🧩 Blocos'}${a.instructions ? ` · ${a.instructions}` : ''}`;
      const status = Object.assign(document.createElement('span'), {
        className: 'status',
        textContent: s.attempts ? (s.won ? stars(s.stars) : `${s.attempts} tentativa${s.attempts > 1 ? 's' : ''}`) : 'ainda não fez',
      });
      const go = Object.assign(document.createElement('button'), { textContent: s.attempts ? 'Continuar' : 'Fazer', className: 'primary' });
      go.addEventListener('click', () => {
        if (!session.student.trim()) {
          showMessage('#plan-msg', 'Digite seu apelido antes de começar: ele vai no registro para o professor.', true);
          $('#student-name').focus();
          return;
        }
        const src = sourceFromActivity(a);
        if (a.kind === 'detetive') nav.detective(src);
        else nav.blocks(src);
      });
      li.append(info, status, go);
      return li;
    }),
  );
  const total = rec.attempts.length;
  showMessage('#record-msg', total ? `Seu registro tem ${total} tentativa${total > 1 ? 's' : ''}.` : 'Seu registro ainda está vazio.');
}

export function initHome() {
  $('#student-name').addEventListener('change', (e) => {
    setStudent((e.target as HTMLInputElement).value);
    renderHome();
  });
  $('#plan-load').addEventListener('click', () => {
    try {
      openPlan(parsePlanCode($<HTMLTextAreaElement>('#plan-code').value));
      $<HTMLTextAreaElement>('#plan-code').value = '';
    } catch (err) {
      showMessage('#plan-msg', (err as Error).message, true);
    }
  });
  $<HTMLInputElement>('#plan-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      openPlan(parsePlanFile(await f.text()));
    } catch (err) {
      showMessage('#plan-msg', (err as Error).message, true);
    }
  });
  $('#plan-close').addEventListener('click', () => {
    setPlan(null);
    renderHome();
    showMessage('#plan-msg', 'Atividade fechada. Seu registro continua guardado neste navegador.');
  });
  $('#record-download').addEventListener('click', () => {
    const p = session.plan!;
    const rec = currentRecord(p.activities[0] ?? null);
    const name = `registro-${slugify(studentName()) || 'aluno'}-${slugify(p.title) || 'atividade'}.json`;
    const ok = downloadText(name, JSON.stringify(rec, null, 2), 'application/json');
    showMessage('#record-msg', ok ? `Arquivo "${name}" baixado. Entregue ao professor.` : 'O navegador bloqueou o download. Use "Mostrar o registro como texto", copie e envie.', !ok);
  });
  $('#record-show').addEventListener('click', () => {
    const box = $<HTMLTextAreaElement>('#record-text');
    box.hidden = !box.hidden;
    box.value = JSON.stringify(currentRecord(session.plan?.activities[0] ?? null), null, 2);
    if (!box.hidden) box.select();
  });
  // Recomeçar o registro (útil para o professor que testou o plano no próprio computador)
  $('#plan-close').addEventListener('dblclick', () => session.plan && clearRecord(studentName(), session.plan.id));
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => nav.go(b.dataset.go!)));
  renderHome();
}
