// Tela da Trilha de IA (ensino médio, D23): lista de módulos, lições passo a passo, as interações de cada
// módulo (percepções, dedução, combinações, busca, genético, Arena) e o registro das respostas.
import { key, type Action, type Dir } from '../../game/world';
import { arenaMaps, mulberry32 } from '../../arena/rng';
import { BAYES_LIKE_GENOME } from '../../agents/genome';
import { $ } from '../../ui/dom';
import { renderBoard, type CellView } from '../board';
import { programFromJson } from '../blockly-json';
import { bestStars, listPrograms, saveStars } from '../edu-storage';
import { missionById } from '../missions';
import type { Activity } from '../plan';
import { bfsTrace } from '../trilha/bfs';
import { classArena } from '../trilha/class-arena';
import { pitCombinations } from '../trilha/combos';
import { cellName, explainCell } from '../trilha/explain';
import { LITE_GENES, LITE_RUN, TEST_SET, TRAIN_SETS, evaluateGenome, geneName, trainLite, type LiteGeneration } from '../trilha/ga-lite';
import { LESSONS, checkAnswer, isQuestion, lessonById, lessonStars, replay, type Lesson, type Step } from '../trilha/lessons';
import type { DetectiveGame } from '../detective';
import { nav, recordAttempt, session, type PlaySource } from './session';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
/** Cria um elemento com propriedades e filhos (atalho para montar as telas da lição). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
}
const svgBoard = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'board');
  s.setAttribute('role', 'group');
  s.setAttribute('aria-label', 'Caverna da lição');
  return s;
};

// ---------- Estado da lição aberta ----------

let lesson: Lesson | null = null;
let activity: Activity | null = null;
let stepIndex = 0;
let openedAt = 0;
const firstTry = new Map<number, boolean>(); // pergunta → acertou de primeira?
const reflections = new Map<number, string>();
let cleanup: (() => void) | null = null; // para parar timers de uma interação ao trocar de passo

/** Visão comum do tabuleiro: salas visitadas com as percepções; o resto escondido. */
function knownCell(g: DetectiveGame, x: number, y: number): CellView {
  const obs = g.kb.visited.get(key(x, y));
  return { visited: !!obs, breeze: obs?.breeze, stench: obs?.stench };
}
const robotOf = (g: DetectiveGame) => ({ x: g.world.agent.x, y: g.world.agent.y, dir: g.world.agent.dir as Dir, hasGold: g.world.hasGold, dead: g.world.status.startsWith('dead') });

// ---------- Interações (uma por módulo) ----------

function widgetPercepcoes(step: Extract<Step, { type: 'tabuleiro' }>, board: SVGSVGElement, side: HTMLElement) {
  let g = replay(step.cave!);
  const known = el('ul', { className: 'known' });
  const msg = el('p', { className: 'helper' });
  const draw = () => {
    renderBoard(board, { size: g.world.size, cell: (x, y) => knownCell(g, x, y), robot: robotOf(g) });
    known.replaceChildren(
      ...[...g.kb.visited].map(([k, o]) => el('li', {}, el('b', {}, cellName(k)), `: ${[o.breeze && 'brisa', o.stench && 'fedor'].filter(Boolean).join(' e ') || 'nada'}`)),
    );
    msg.textContent = g.world.gameOver ? (g.world.status === 'won' ? 'Vitória!' : 'O robô não sobreviveu. Recomece e use as pistas.') : 'Use os botões para andar.';
  };
  const pad = el('div', { className: 'pad' });
  for (const [a, label] of [['left', '↺'], ['forward', '▲'], ['right', '↻'], ['grab', '✋'], ['shoot', '➶']] as [Action, string][]) {
    const b = el('button', { textContent: label, title: a });
    b.addEventListener('click', () => {
      if (!g.world.gameOver) g.act(a);
      draw();
    });
    pad.append(b);
  }
  const reset = el('button', { textContent: 'Recomeçar', className: 'ghost' });
  reset.addEventListener('click', () => {
    g = replay(step.cave!);
    draw();
  });
  side.append(pad, el('h3', {}, 'O que o robô sabe'), known, msg, reset);
  draw();
}

function widgetDeducao(step: Extract<Step, { type: 'tabuleiro' }>, board: SVGSVGElement, side: HTMLElement) {
  const g = replay(step.cave!, step.moves);
  const label: Record<string, [string, CellView['verdict']]> = { segura: ['segura', 'certa'], poco: ['poço!', 'errada'], wumpus: ['Wumpus!', 'errada'], incerta: ['?', 'possivel'], 'sem-pistas': ['sem pistas', null], visitada: ['', null] };
  const shown = new Map<string, string>();
  const panel = el('div', { className: 'helper' }, 'Toque numa sala do tabuleiro.');
  const draw = () =>
    renderBoard(board, {
      size: g.world.size,
      cell: (x, y) => {
        const st = shown.get(key(x, y));
        return { ...knownCell(g, x, y), ...(st && label[st][0] ? { mark: label[st][0], verdict: label[st][1] } : {}) };
      },
      robot: robotOf(g),
      onCell: (x, y) => {
        const e = explainCell(g.kb, key(x, y));
        shown.set(key(x, y), e.status);
        panel.replaceChildren(el('b', {}, e.title), el('ul', {}, ...e.reasons.map((r) => el('li', {}, r))));
        draw();
      },
    });
  side.append(panel);
  draw();
}

function widgetCrencas(step: Extract<Step, { type: 'tabuleiro' }>, board: SVGSVGElement, side: HTMLElement) {
  const g = replay(step.cave!, step.moves);
  const t = pitCombinations(g.kb);
  const panel = el('div', {}, el('p', { className: 'helper' }, t ? 'Toque numa sala com porcentagem para ver as combinações.' : 'Fronteira grande demais para mostrar a tabela.'));
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const verdict = (p: number): CellView['verdict'] => (p >= 0.5 ? 'errada' : p > 0 ? 'possivel' : 'certa');
  const showTable = (k: string) => {
    if (!t) return;
    const head = el('tr', {}, ...t.frontier.map((f) => el('th', {}, cellName(f))), el('th', {}, 'peso'), el('th', {}, 'explica a brisa?'));
    const rows = t.combos.map((c) =>
      el(
        'tr',
        { className: c.explains ? '' : 'off' },
        ...t.frontier.map((f) => el('td', { className: 'c' }, c.pits.includes(f) ? '● poço' : '○')),
        el('td', { className: 'c' }, c.weight.toFixed(2).replace('.', ',')),
        el('td', { className: 'c' }, c.explains ? 'sim' : 'não'),
      ),
    );
    const withK = t.combos.filter((c) => c.explains && c.pits.includes(k)).reduce((s, c) => s + c.weight, 0);
    panel.replaceChildren(
      el('div', { className: 'table-wrap' }, el('table', { className: 'combos' }, el('thead', {}, head), el('tbody', {}, ...rows))),
      el('p', { className: 'helper' }, `P(poço em ${cellName(k)}) = ${withK.toFixed(2).replace('.', ',')} ÷ ${t.total.toFixed(2).replace('.', ',')} = ${pct(t.probability.get(k)!)}`),
    );
  };
  renderBoard(board, {
    size: g.world.size,
    cell: (x, y) => {
      const k = key(x, y);
      const p = t?.probability.get(k);
      if (p !== undefined) return { ...knownCell(g, x, y), mark: pct(p), verdict: verdict(p) };
      const safeNeighbor = !g.kb.visited.has(k) && g.kb.isFrontier(k) && g.kb.pitFree(k);
      return { ...knownCell(g, x, y), ...(safeNeighbor ? { mark: '0%', verdict: 'certa' as const } : {}) };
    },
    robot: robotOf(g),
    onCell: (x, y) => t?.probability.has(key(x, y)) && showTable(key(x, y)),
  });
  side.append(panel);
}

function widgetBusca(step: Extract<Step, { type: 'tabuleiro' }>, board: SVGSVGElement, side: HTMLElement) {
  const g = replay(step.cave!, step.moves);
  const from = key(g.world.agent.x, g.world.agent.y);
  const trace = bfsTrace((c) => g.kb.neighbors(c), (c) => g.kb.visited.has(c), from, key(0, 0));
  let i = -1;
  const info = el('div', { className: 'helper' });
  const draw = () => {
    const st = trace.steps[i];
    const done = i >= trace.steps.length - 1;
    const path = done ? (trace.path ?? []) : [];
    renderBoard(board, {
      size: g.world.size,
      cell: (x, y) => {
        const k = key(x, y);
        const base = knownCell(g, x, y);
        if (path.includes(k)) return { ...base, mark: `${path.indexOf(k)}`, verdict: 'certa' };
        if (st?.current === k) return { ...base, mark: 'agora', verdict: 'errada' };
        if (st?.queue.includes(k)) return { ...base, mark: 'na fila', verdict: 'possivel' };
        if (st?.seen.includes(k)) return { ...base, mark: 'vista' };
        return base;
      },
      robot: robotOf(g),
    });
    info.replaceChildren(
      ...(i < 0
        ? ['A busca começa com a sala do robô na fila.']
        : [
            el('p', {}, `Passo ${i + 1} de ${trace.steps.length}: tira ${cellName(st.current)} da fila${st.added.length ? ` e coloca ${st.added.map(cellName).join(', ')}` : ''}.`),
            el('p', {}, `Fila: ${st.queue.map(cellName).join(' → ') || '(vazia)'}`),
            ...(done && trace.path ? [el('p', {}, el('b', {}, `Caminho: ${trace.path.map(cellName).join(' → ')} (${trace.path.length - 1} passos)`))] : []),
          ]),
    );
  };
  const next = el('button', { textContent: 'Próximo passo', className: 'primary' });
  next.addEventListener('click', () => {
    i = Math.min(i + 1, trace.steps.length - 1);
    draw();
  });
  const end = el('button', { textContent: 'Até o fim' });
  end.addEventListener('click', () => {
    i = trace.steps.length - 1;
    draw();
  });
  const reset = el('button', { textContent: 'Recomeçar', className: 'ghost' });
  reset.addEventListener('click', () => {
    i = -1;
    draw();
  });
  side.append(el('div', { className: 'row' }, next, end, reset), info);
  draw();
}

function widgetGenetico(_step: Step, area: HTMLElement) {
  const trainSets = TRAIN_SETS;
  const test = TEST_SET;
  const chart = el('div', { className: 'ga-chart' });
  const results = el('tbody');
  const status = el('p', { className: 'helper' }, 'Escolha como treinar. Cada treino tem 8 gerações de 8 agentes.');
  let timer: ReturnType<typeof setTimeout> | null = null;
  cleanup = () => timer && clearTimeout(timer);
  const drawChart = (gens: LiteGeneration[]) => {
    const w = 320;
    const h = 120;
    const vals = gens.map((g) => g.best);
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, lo + 1);
    const x = (i: number) => 30 + (gens.length < 2 ? 0 : (i / (gens.length - 1)) * (w - 40));
    const y = (v: number) => 10 + (1 - (v - lo) / (hi - lo)) * (h - 30);
    chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="mini-chart" role="img" aria-label="Melhor aptidão por geração"><line x1="30" y1="${y(0)}" x2="${w - 10}" y2="${y(0)}" class="zero"/><polyline points="${gens.map((g, i) => `${x(i)},${y(g.best)}`).join(' ')}"/>${gens.map((g, i) => `<circle cx="${x(i)}" cy="${y(g.best)}" r="3"/>`).join('')}<text x="${w - 10}" y="${h - 4}" text-anchor="end">geração ${gens.length}</text><text x="4" y="${y(hi) + 4}">${Math.round(hi)}</text><text x="4" y="${y(lo) + 4}">${Math.round(lo)}</text></svg>`;
  };
  const run = (which: 'uma' | 'varias') => {
    cleanup?.();
    const maps = trainSets[which];
    const it = trainLite({ maps, population: LITE_RUN.population, generations: LITE_RUN.generations, rng: mulberry32(LITE_RUN.seed[which]) });
    const gens: LiteGeneration[] = [];
    status.textContent = 'Treinando…';
    const stepOnce = () => {
      const n = it.next();
      if (!n.done) {
        gens.push(n.value);
        drawChart(gens);
        status.textContent = `Geração ${n.value.generation}: melhor aptidão ${Math.round(n.value.best)} pontos.`;
        timer = setTimeout(stepOnce, 30);
        return;
      }
      const best = gens.at(-1)!.genome;
      const onTrain = evaluateGenome(best, maps);
      const onTest = evaluateGenome(best, test);
      const weights = LITE_GENES.map((g) => `${geneName(g)} ${best[g].toFixed(1).replace('.', ',')}`).join(' · ');
      results.append(
        el('tr', {}, el('th', {}, which === 'uma' ? 'Treino com 1 caverna' : 'Treino com 40 cavernas'), el('td', { className: 'c' }, String(Math.round(onTrain.avg))), el('td', { className: 'c' }, String(Math.round(onTest.avg))), el('td', { className: 'c' }, `${onTest.wins}%`), el('td', {}, weights)),
      );
      status.textContent = which === 'uma' ? 'Pronto. Compare a pontuação no treino com a das 100 cavernas novas. Agora treine com 40.' : 'Pronto. Compare as duas linhas: qual agente decorou e qual aprendeu algo que serve em cavernas novas?';
    };
    stepOnce();
  };
  const b1 = el('button', { textContent: 'Treinar com 1 caverna' });
  b1.addEventListener('click', () => run('uma'));
  const b2 = el('button', { textContent: 'Treinar com 40 cavernas', className: 'primary' });
  b2.addEventListener('click', () => run('varias'));
  const base = evaluateGenome(BAYES_LIKE_GENOME, test);
  results.append(el('tr', { className: 'ref' }, el('th', {}, 'Pesos do agente probabilístico (referência)'), el('td', { className: 'c' }, '—'), el('td', { className: 'c' }, String(Math.round(base.avg))), el('td', { className: 'c' }, `${base.wins}%`), el('td', {}, '')));
  area.append(
    el('div', { className: 'row' }, b1, b2),
    status,
    chart,
    el('div', { className: 'table-wrap' }, el('table', { className: 'combos' }, el('thead', {}, el('tr', {}, el('th', {}, 'Agente'), el('th', {}, 'Pontos no treino'), el('th', {}, 'Pontos em 100 cavernas novas'), el('th', {}, 'Vitórias nas novas'), el('th', {}, 'Pesos aprendidos'))), results)),
  );
}

/** Nome legível de um programa salvo (missão, atividade do plano ou caverna). */
function programLabel(id: string) {
  if (id.startsWith('missao:')) return `Missão: ${missionById(id.slice(7))?.title ?? id}`;
  if (id.startsWith('caverna:')) return `Caverna: ${id.slice(8)}`;
  const act = session.plan?.activities.find((a) => id.endsWith(`:${a.id}`));
  return act ? `Atividade: ${act.title}` : id;
}

function widgetArena(_step: Step, area: HTMLElement) {
  const programs = listPrograms().filter(([, ws]) => programFromJson(ws).main.length > 0);
  if (!programs.length) {
    const go = el('button', { textContent: 'Ir para os Blocos', className: 'primary' });
    go.addEventListener('click', () => nav.go('blocos'));
    area.append(el('p', { className: 'helper' }, 'Você ainda não tem programas de blocos. Monte um nas missões (ou na atividade "Agente" do professor) e volte aqui.'), go);
    return;
  }
  const sel = el('select', { id: 'arena-program' }, ...programs.map(([id]) => new Option(programLabel(id), id)));
  const run = el('button', { textContent: 'Jogar 20 cavernas', className: 'primary' });
  const out = el('div');
  run.addEventListener('click', () => {
    const ws = programs.find(([id]) => id === sel.value)![1];
    const rows = classArena([{ name: 'Seu programa', program: programFromJson(ws) }], arenaMaps('trilha-arena', 20, 4, 0.2));
    out.replaceChildren(
      el(
        'div',
        { className: 'table-wrap' },
        el(
          'table',
          { className: 'combos' },
          el('thead', {}, el('tr', {}, ...['#', 'Agente', 'Pontos (média)', 'Vitórias', 'Mortes', 'Não terminou'].map((h) => el('th', {}, h)))),
          el('tbody', {}, ...rows.map((r, i) => el('tr', { className: r.kind === 'agente' ? 'ref' : 'me' }, el('td', { className: 'c' }, String(i + 1)), el('th', {}, r.name), el('td', { className: 'c' }, String(Math.round(r.avgScore))), el('td', { className: 'c' }, String(r.wins)), el('td', { className: 'c' }, String(r.deaths)), el('td', { className: 'c' }, String(r.unfinished + r.timeouts))))),
        ),
      ),
      el('p', { className: 'helper' }, 'Programas feitos para uma caverna só costumam ir mal em cavernas sorteadas. Para competir, o robô precisa usar os sensores.'),
    );
  });
  area.append(el('label', { htmlFor: 'arena-program' }, 'Programa'), el('div', { className: 'row' }, sel, run), out);
}

// ---------- Passos da lição ----------

function renderQuestion(step: Extract<Step, { type: 'escolha' | 'numero' }>, area: HTMLElement) {
  const feedback = el('p', { className: 'helper', role: 'status' });
  const answer = (value: string | number) => {
    const ok = checkAnswer(step, value);
    if (!firstTry.has(stepIndex)) firstTry.set(stepIndex, ok);
    feedback.className = `helper ${ok ? 'ok' : 'error'}`;
    feedback.textContent = ok ? `Certo! ${step.explain}` : 'Ainda não. Pense de novo e tente outra vez.';
    updateNav();
  };
  area.append(el('h3', { className: 'prompt' }, step.prompt));
  if (step.type === 'escolha') {
    const list = el('div', { className: 'options' });
    step.options.forEach((o, i) => {
      const b = el('button', { textContent: o });
      b.addEventListener('click', () => answer(i));
      list.append(b);
    });
    area.append(list);
  } else {
    const input = el('input', { id: 'ls-number', inputMode: 'decimal', placeholder: step.unit });
    const ok = el('button', { textContent: 'Conferir', className: 'primary' });
    ok.addEventListener('click', () => answer(input.value));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && answer(input.value));
    area.append(el('div', { className: 'row' }, input, el('span', { className: 'hint' }, step.unit), ok));
  }
  if (firstTry.has(stepIndex)) feedback.textContent = 'Você já respondeu esta pergunta.';
  area.append(feedback);
}

function renderStep() {
  cleanup?.();
  cleanup = null;
  const l = lesson!;
  const step = l.steps[stepIndex];
  const body = $('#ls-body');
  body.replaceChildren();
  if (step.type === 'texto') {
    const card = el('div', { className: 'card lesson-text' }, el('h2', {}, step.title));
    for (const p of step.paragraphs) card.append(Object.assign(el('p'), { innerHTML: p })); // texto fixo do próprio código
    body.append(card);
  } else if (step.type === 'tabuleiro') {
    const card = el('div', { className: 'card' }, el('h2', {}, step.title), el('p', { className: 'goal' }, step.text));
    if (step.widget === 'genetico' || step.widget === 'arena') {
      (step.widget === 'genetico' ? widgetGenetico : widgetArena)(step, card);
      body.append(card);
    } else {
      const board = svgBoard();
      const side = el('div', { className: 'lesson-side' });
      card.append(el('div', { className: 'lesson-play' }, el('div', { className: 'board-wrap' }, board), side));
      body.append(card);
      ({ percepcoes: widgetPercepcoes, deducao: widgetDeducao, crencas: widgetCrencas, busca: widgetBusca })[step.widget](step, board, side);
    }
  } else if (step.type === 'reflexao') {
    const box = el('textarea', { id: 'ls-reflexao', rows: 5, value: reflections.get(stepIndex) ?? '' });
    box.addEventListener('input', () => reflections.set(stepIndex, box.value));
    body.append(el('div', { className: 'card' }, el('h3', { className: 'prompt' }, step.prompt), box, el('p', { className: 'hint' }, 'Não há resposta certa: o professor lê as reflexões no relatório da turma.')));
  } else {
    const card = el('div', { className: 'card' });
    renderQuestion(step, card);
    body.append(card);
  }
  updateNav();
}

function updateNav() {
  const l = lesson!;
  const step = l.steps[stepIndex];
  const last = stepIndex === l.steps.length - 1;
  $('#ls-progress').textContent = `passo ${stepIndex + 1} de ${l.steps.length}`;
  $<HTMLButtonElement>('#ls-prev').disabled = stepIndex === 0;
  const next = $<HTMLButtonElement>('#ls-next');
  next.textContent = last ? 'Concluir a lição ✓' : 'Avançar →';
  next.disabled = isQuestion(step) && !firstTry.has(stepIndex); // responda para seguir
}

function finishLesson() {
  const l = lesson!;
  const questions = l.steps.map((s, i) => [s, i] as const).filter(([s]) => isQuestion(s));
  const right = questions.filter(([, i]) => firstTry.get(i)).length;
  const n = lessonStars(right, questions.length);
  const src: PlaySource = { id: `trilha:${l.id}`, kind: 'trilha', title: `Trilha de IA: ${l.title}`, goal: l.goal, tip: '', layouts: [], groups: [], mission: null, activity };
  recordAttempt(src, {
    kind: 'trilha',
    ms: Math.round(performance.now() - openedAt),
    outcome: 'won',
    stars: n,
    actions: 0,
    score: 0,
    lessonId: l.id,
    answers: { firstTry: right, total: questions.length },
    reflections: [...reflections.values()].filter((r) => r.trim()),
  });
  saveStars(`trilha:${l.id}`, n);
  nav.refreshHome();
  $('#ls-body').replaceChildren(
    el(
      'div',
      { className: 'card lesson-text' },
      el('h2', {}, 'Lição concluída!'),
      el('p', { className: 'stars' }, stars(n)),
      el('p', {}, `Você acertou de primeira ${right} de ${questions.length} pergunta${questions.length === 1 ? '' : 's'}.${activity ? ' O resultado já está no seu registro para o professor.' : ''}`),
    ),
  );
  $<HTMLButtonElement>('#ls-next').disabled = true;
}

function renderModules() {
  $('#module-list').replaceChildren(
    ...LESSONS.map((l) => {
      const best = bestStars(`trilha:${l.id}`);
      const b = el('button', { className: `mission${best ? ' done' : ''}` });
      b.append(el('span', { className: 'n' }, String(l.module)), el('b', {}, l.title), el('small', {}, `${l.idea} · ${l.minutes} min`), el('span', { className: 'stars' }, stars(best)));
      b.addEventListener('click', () => openLesson(l.id, null));
      return el('li', {}, b);
    }),
  );
}

/** Sem lição: mostra os módulos. Com lição: abre do começo. */
export function openLesson(lessonId?: string, act: Activity | null = null) {
  nav.show('trilha');
  cleanup?.();
  const l = lessonId ? lessonById(lessonId) : undefined;
  $('#trilha-modules').hidden = !!l;
  $('#lesson').hidden = !l;
  if (!l) return renderModules();
  lesson = l;
  activity = act;
  stepIndex = 0;
  openedAt = performance.now();
  firstTry.clear();
  reflections.clear();
  $('#ls-title').textContent = `Módulo ${l.module} · ${l.title}`;
  $('#ls-goal').textContent = l.goal;
  $('#ls-stars').textContent = stars(bestStars(`trilha:${l.id}`));
  renderStep();
}

export function initTrilha() {
  $('#ls-prev').addEventListener('click', () => {
    stepIndex = Math.max(0, stepIndex - 1);
    renderStep();
  });
  $('#ls-next').addEventListener('click', () => {
    if (stepIndex === lesson!.steps.length - 1) return finishLesson();
    stepIndex++;
    renderStep();
  });
  $('#ls-back').addEventListener('click', () => openLesson());
  renderModules();
}
