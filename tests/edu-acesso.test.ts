// Acesso por perfil (D23): senhas cifradas, turma com PINs, código da turma e armazenamento no GitHub.
import { describe, expect, it } from 'vitest';
import { hashSecret, passwordProblem, randomPin, validPin, verifySecret } from '../src/edu/auth';
import { addStudents, checkStudent, newTurma, parseTurma, parseTurmaCode, publicTurma, removeStudent, resetPin, turmaCode } from '../src/edu/turma';
import { GitHubStore, b64ToUtf8, utf8ToB64 } from '../src/edu/github-store';
import { samplePlan, parsePlanFile, newRecord, type Attempt } from '../src/edu/plan';
import { buildClassReport, renderClassReportHtml } from '../src/edu/class-report';

describe('senhas e PINs', () => {
  it('guarda só o resumo e confere a senha certa', async () => {
    const h = await hashSecret('cavernas2026', 1000);
    expect(JSON.stringify(h)).not.toContain('cavernas2026');
    expect(await verifySecret('cavernas2026', h)).toBe(true);
    expect(await verifySecret('cavernas2027', h)).toBe(false);
    expect((await hashSecret('cavernas2026', 1000)).hash).not.toBe(h.hash); // sal diferente a cada vez
  });
  it('PIN de 4 dígitos; senha do professor com pelo menos 8 caracteres', () => {
    for (let i = 0; i < 50; i++) expect(validPin(randomPin())).toBe(true);
    expect(validPin('12a4')).toBe(false);
    expect(passwordProblem('curta')).toMatch(/8 caracteres/);
    expect(passwordProblem('bem-longa')).toBeNull();
  });
});

describe('turma', () => {
  it('apelidos únicos, PIN por aluno, reemissão e remoção', () => {
    const t = newTurma('7º ano B', 'Profa. Lúcia');
    expect(addStudents(t, ['Ana B.', ' bruno  c. ', '', 'ana b.'])).toEqual(['ana b.']);
    expect(t.students.map((s) => s.name)).toEqual(['Ana B.', 'bruno c.']);
    const old = t.students[0].pin;
    let novo = resetPin(t, 'Ana B.');
    while (novo === old) novo = resetPin(t, 'Ana B.'); // 1 chance em 10 mil de repetir
    expect(t.students[0].pin).toBe(novo);
    removeStudent(t, 'bruno c.');
    expect(t.students).toHaveLength(1);
    expect(parseTurma(JSON.stringify(t))).toEqual(t);
  });

  it('o código da turma não leva os PINs, e o aluno entra com apelido + PIN', async () => {
    const t = newTurma('7B', 'Lúcia');
    addStudents(t, ['Ana', 'Bia']);
    t.plan = samplePlan();
    const pub = await publicTurma(t);
    const code = turmaCode(pub);
    for (const s of t.students) expect(code.includes(s.pin) && JSON.stringify(pub).includes(`"${s.pin}"`)).toBe(false);
    const back = parseTurmaCode(code);
    expect(back.plan).toEqual(t.plan);
    expect(await checkStudent(back, 'Ana', t.students[0].pin)).toBe(true);
    const wrong = String((Number(t.students[0].pin) + 1) % 10000).padStart(4, '0');
    expect(await checkStudent(back, 'Ana', wrong)).toBe(false);
    expect(await checkStudent(back, 'Caio', '1234')).toBe(false);
    expect(() => parseTurmaCode('PLANO1-abc')).toThrow(/TURMA1-/);
  });
});

describe('plano com trilha de IA e agente', () => {
  it('aceita lições e atividades "agente"; recusa lição inexistente', () => {
    const p = samplePlan();
    p.activities.push({ id: 't1', kind: 'trilha', title: 'IA: lógica', instructions: '', cave: null, lessonId: 'ia2' });
    p.activities.push({ id: 'g1', kind: 'agente', title: 'Arena', instructions: '', cave: { type: 'sorteio', seed: 'turma', size: 4, pits: 0.2 } });
    expect(parsePlanFile(JSON.stringify(p))).toEqual(p);
    p.activities[p.activities.length - 2].lessonId = 'nao-existe';
    expect(() => parsePlanFile(JSON.stringify(p))).toThrow(/não existe/);
  });

  it('relatório: lições com acertos e Arena da turma com os programas dos alunos', () => {
    const p = samplePlan();
    p.activities = [
      { id: 't1', kind: 'trilha', title: 'IA: lógica', instructions: '', cave: null, lessonId: 'ia2' },
      { id: 'g1', kind: 'agente', title: 'Arena', instructions: '', cave: { type: 'sorteio', seed: 'turma', size: 4, pits: 0.2 } },
    ];
    const base = { ms: 1000, actions: 0, score: 0 };
    const trilha: Attempt = { ...base, activityId: 't1', activityTitle: 'IA: lógica', kind: 'trilha', at: '2026-11-03T10:00:00Z', outcome: 'won', stars: 2, lessonId: 'ia2', answers: { firstTry: 2, total: 3 }, reflections: ['Quem programou.'] };
    const program = { blocks: { blocks: [{ type: 'wumpus_start', id: 's', inputs: { DO: { block: { type: 'wumpus_forward', id: 'f' } } } }] } };
    const agente: Attempt = { ...base, activityId: 'g1', activityTitle: 'Arena', kind: 'agente', at: '2026-11-03T10:05:00Z', outcome: 'playing', stars: 0, blocks: 1, program, programText: 'quando começar:\n  avançar' };
    const r = buildClassReport(p, [{ ...newRecord('Ana', p), attempts: [trilha, agente] }]);
    expect(r.arenas).toHaveLength(1);
    expect(r.arenas[0].rows.map((x) => x.name)).toContain('Ana');
    expect(r.arenas[0].maps).toBe(20);
    const html = renderClassReportHtml(r);
    expect(html).toContain('Arena da turma: Arena');
    expect(html).toContain('acertou de primeira 2 de 3');
    expect(html).toContain('<blockquote>Quem programou.</blockquote>');
  });
});

describe('repositório privado no GitHub', () => {
  /** GitHub de mentira: guarda os arquivos num Map e responde como a API de conteúdo. */
  function fakeGitHub(isPrivate = true) {
    const files = new Map<string, { content: string; sha: number }>();
    const calls: string[] = [];
    let sha = 0;
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      if (auth !== 'Bearer tk') return new Response('{}', { status: 401 });
      if (url.endsWith('/repos/prof/turmas')) return Response.json({ full_name: 'prof/turmas', private: isPrivate });
      const path = decodeURIComponent(url.split('/contents/')[1] ?? '');
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        const cur = files.get(path);
        if (cur && body.sha !== String(cur.sha)) return new Response('{}', { status: 409 });
        files.set(path, { content: body.content, sha: ++sha });
        return Response.json({}, { status: cur ? 200 : 201 });
      }
      const f = files.get(path);
      if (f) return Response.json({ content: f.content, sha: String(f.sha) });
      const children = [...files.keys()].filter((p) => p.startsWith(`${path}/`)).map((p) => ({ name: p.slice(path.length + 1), type: 'file' }));
      return children.length ? Response.json(children) : new Response('{}', { status: 404 });
    };
    return { files, calls, fetchFn };
  }

  it('grava, lê, substitui (com sha) e lista; texto com acentos vai e volta', async () => {
    const gh = fakeGitHub();
    const store = new GitHubStore({ owner: 'prof', repo: 'turmas', token: 'tk', folder: 'caverna' }, gh.fetchFn);
    expect(await store.check()).toEqual({ fullName: 'prof/turmas', private: true });
    expect(await store.read('turmas/7b.json')).toBeNull();
    await store.writeJson('turmas/7b.json', { nome: 'Turma da Lúcia' }, 'turma');
    await store.writeJson('turmas/7b.json', { nome: 'Turma da Lúcia — 2' }, 'turma');
    expect((await store.read<{ nome: string }>('turmas/7b.json'))!.data.nome).toBe('Turma da Lúcia — 2');
    expect(await store.list('turmas')).toEqual(['7b.json']);
    expect([...gh.files.keys()]).toEqual(['caverna/turmas/7b.json']);
    expect(b64ToUtf8(utf8ToB64('ação ✓'))).toBe('ação ✓');
  });

  it('recusa repositório público e explica token inválido', async () => {
    const pub = new GitHubStore({ owner: 'prof', repo: 'turmas', token: 'tk', folder: 'caverna' }, fakeGitHub(false).fetchFn);
    await expect(pub.check()).rejects.toThrow(/PÚBLICO/);
    const bad = new GitHubStore({ owner: 'prof', repo: 'turmas', token: 'errado', folder: 'caverna' }, fakeGitHub().fetchFn);
    await expect(bad.check()).rejects.toThrow(/token não foi aceito/);
  });
});
