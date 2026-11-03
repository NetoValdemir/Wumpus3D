// Tela inicial do modo escola (escola.html): escolher "Sou aluno" ou "Sou professor" e entrar (D23).
import '../escola.css';
import { $, showMessage } from '../../ui/dom';
import { parseTurmaCode, parseTurmaFile, type TurmaPublic } from '../turma';
import { createTeacher, endSession, knownTurma, loadKnownTurmas, loadProfiles, rememberTurma, removeTeacher, studentLogin, teacherLogin, visitorLogin } from './access';

const alMsg = (t: string, e = false) => showMessage('#al-msg', t, e);
const pfMsg = (t: string, e = false) => showMessage('#pf-msg', t, e);
let turma: TurmaPublic | null = null;

// ---------- Aluno ----------

function renderTurmas() {
  const known = Object.values(loadKnownTurmas());
  const sel = $<HTMLSelectElement>('#al-turma');
  sel.replaceChildren(...known.map((t) => new Option(`${t.name}${t.teacher ? ` (${t.teacher})` : ''}`, t.id)), new Option('Outra turma (tenho o código)…', ''));
  if (turma) sel.value = turma.id;
  else if (known.length) {
    sel.value = known[0].id;
    turma = known[0];
  }
  $('#al-code-box').hidden = !!turma && sel.value !== '';
  $('#al-turma-row').hidden = !known.length;
  renderNames();
}

function renderNames() {
  const names = turma?.students.map((s) => s.name) ?? [];
  $<HTMLSelectElement>('#al-name').replaceChildren(new Option('Escolha seu apelido', ''), ...names.map((n) => new Option(n, n)));
  $('#al-who').hidden = !turma;
}

function openTurma(t: TurmaPublic) {
  rememberTurma(t);
  turma = t;
  renderTurmas();
  alMsg(`Turma "${t.name}" encontrada. Escolha seu apelido e digite o PIN.`);
  $('#al-name').focus();
}

// ---------- Professor ----------

function renderTeacher(createMode = false) {
  const profiles = loadProfiles();
  const creating = createMode || !profiles.length;
  $('#pf-login').hidden = creating;
  $('#pf-create').hidden = !creating;
  $('#pf-cancel').hidden = !profiles.length;
  $<HTMLSelectElement>('#pf-forget-user').replaceChildren(...profiles.map((p) => new Option(`${p.name} (${p.user})`, p.user)));
  $('#pf-forgot').hidden = !profiles.length;
}

async function busy<T>(btn: string, fn: () => Promise<T>) {
  const b = $<HTMLButtonElement>(btn);
  b.disabled = true;
  try {
    return await fn();
  } finally {
    b.disabled = false;
  }
}

function init() {
  endSession(); // a tela inicial sempre começa sem ninguém logado na aba
  renderTurmas();
  renderTeacher();

  $('#al-turma').addEventListener('change', (e) => {
    const id = (e.target as HTMLSelectElement).value;
    turma = id ? knownTurma(id) : null;
    $('#al-code-box').hidden = !!id;
    renderNames();
  });
  $('#al-code-open').addEventListener('click', () => {
    try {
      openTurma(parseTurmaCode($<HTMLTextAreaElement>('#al-code').value));
      $<HTMLTextAreaElement>('#al-code').value = '';
    } catch (err) {
      alMsg((err as Error).message, true);
    }
  });
  $<HTMLInputElement>('#al-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      openTurma(parseTurmaFile(await f.text()));
    } catch (err) {
      alMsg((err as Error).message, true);
    }
  });
  const studentEnter = () =>
    busy('#al-enter', async () => {
      if (!turma) return alMsg('Abra a turma com o código que o professor passou.', true);
      const err = await studentLogin(turma, $<HTMLSelectElement>('#al-name').value, $<HTMLInputElement>('#al-pin').value);
      if (err) return alMsg(err, true);
      location.href = './aluno.html';
    });
  $('#al-enter').addEventListener('click', studentEnter);
  $('#al-pin').addEventListener('keydown', (e) => e.key === 'Enter' && studentEnter());
  $('#al-visitor').addEventListener('click', (e) => {
    e.preventDefault();
    visitorLogin();
    location.href = './aluno.html';
  });

  const teacherEnter = () =>
    busy('#pf-enter', async () => {
      const err = await teacherLogin($<HTMLInputElement>('#pf-user').value, $<HTMLInputElement>('#pf-pass').value);
      if (err) return pfMsg(err, true);
      location.href = './professor.html';
    });
  $('#pf-enter').addEventListener('click', teacherEnter);
  $('#pf-pass').addEventListener('keydown', (e) => e.key === 'Enter' && teacherEnter());
  $('#pf-show-create').addEventListener('click', () => renderTeacher(true));
  $('#pf-cancel').addEventListener('click', () => renderTeacher(false));
  $('#pf-create-btn').addEventListener('click', () =>
    busy('#pf-create-btn', async () => {
      const v = (id: string) => $<HTMLInputElement>(id).value;
      const err = await createTeacher(v('#pf-new-name'), v('#pf-new-user'), v('#pf-new-pass'), v('#pf-new-pass2'));
      if (err) return pfMsg(err, true);
      await teacherLogin(v('#pf-new-user'), v('#pf-new-pass'));
      location.href = './professor.html';
    }),
  );
  const forget = $<HTMLButtonElement>('#pf-forget');
  forget.addEventListener('click', () => {
    if (!forget.dataset.confirm) {
      forget.dataset.confirm = '1';
      forget.textContent = 'Confirmar: apagar o acesso e os dados deste aparelho';
      return;
    }
    removeTeacher($<HTMLSelectElement>('#pf-forget-user').value);
    delete forget.dataset.confirm;
    forget.textContent = 'Apagar este acesso';
    renderTeacher();
    pfMsg('Acesso apagado. Crie um novo; se você usava o GitHub, traga as turmas de lá na aba GitHub.');
  });
}

init();
