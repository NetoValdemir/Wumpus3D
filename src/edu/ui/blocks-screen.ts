// Tela do Programador com blocos: lista de missões, área de montagem (Blockly), execução animada com o bloco
// atual destacado, estrelas e registro de cada tentativa.
import { WumpusWorld, type MapLayout } from '../../game/world';
import { $ } from '../../ui/dom';
import { boardSvg, renderBoard } from '../board';
import { programFromJson } from '../blockly-json';
import { Blockly, createWorkspace, loadWorkspace, saveWorkspace, toolboxFor, type Workspace } from '../blocks-setup';
import { bestStars, loadProgram, saveProgram, saveStars } from '../edu-storage';
import { MISSIONS, evaluateMission } from '../missions';
import { programText, type Program } from '../program';
import { ProgramRun, outcomeText } from '../run';
import { nav, recordAttempt, sourceFromMission, type PlaySource } from './session';

let ws: Workspace | null = null;
let src: PlaySource | null = null;
let mapIndex = 0;
let preview: WumpusWorld | null = null; // o que o tabuleiro mostra
let run: ProgramRun | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let runningAll = false;
let openedAt = 0;

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const msg = (text: string, kind: '' | 'ok' | 'error' = '') => {
  const el = $('#blk-msg');
  el.textContent = text;
  el.className = `helper ${kind}`;
};

function program(): Program {
  return programFromJson(saveWorkspace(ws!));
}

function drawBoard() {
  const w = preview!;
  const dead = w.status === 'dead-pit' || w.status === 'dead-wumpus';
  renderBoard(boardSvg('#blk-board'), {
    size: w.size,
    // Nas missões o mapa fica todo à mostra: o desafio é programar, não descobrir
    cell: (x, y) => ({
      visited: w.isVisited(x, y),
      pit: w.hasPit(x, y),
      gold: !!w.gold && w.gold.x === x && w.gold.y === y,
      wumpus: w.wumpus.x === x && w.wumpus.y === y ? (w.wumpusAlive ? 'vivo' : 'morto') : undefined,
    }),
    robot: { x: w.agent.x, y: w.agent.y, dir: w.agent.dir, hasGold: w.hasGold, dead },
  });
}

function showMap(i: number) {
  mapIndex = i;
  preview = WumpusWorld.fromLayout(src!.layouts[i]);
  const many = src!.layouts.length > 1;
  $('#blk-map-label').textContent = many ? `Caverna ${String.fromCharCode(65 + i)} de ${src!.layouts.length}: o programa precisa vencer todas` : '';
  document.querySelectorAll<HTMLButtonElement>('#blk-maps button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  drawBoard();
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  run = null;
  runningAll = false;
  ws?.highlightBlock(null);
  $('#blk-run').textContent = '▶ Executar';
}

function updateCount() {
  if (!ws || !src) return;
  const p = program();
  const max = src.mission?.maxBlocks;
  $('#blk-count').textContent = max ? `blocos: ${p.blocks} / ${max}` : `blocos: ${p.blocks}`;
  $('#blk-count').classList.toggle('over', !!max && p.blocks > max);
  $('#blk-text').textContent = programText(p);
}

function record(outcome: Parameters<typeof recordAttempt>[1]['outcome'], starsWon: number, actions: number, score: number, error: string | null) {
  const p = program();
  recordAttempt(src!, {
    kind: 'blocos',
    ms: Math.round(performance.now() - openedAt),
    outcome,
    stars: starsWon,
    actions,
    score,
    blocks: p.blocks,
    program: saveWorkspace(ws!),
    programText: programText(p),
    error,
  });
  openedAt = performance.now();
  nav.refreshHome();
}

/** Terminou uma caverna: segue para a próxima, ou fecha a tentativa. */
function mapFinished() {
  const r = run!.result();
  if (r.error) {
    if (r.errorBlock) ws!.getBlockById(r.errorBlock)?.select();
    msg(`🐞 ${r.error}`, 'error');
    record('erro', 0, r.actions, r.score, r.error);
    stop();
    return;
  }
  if (r.status !== 'won') {
    const which = src!.layouts.length > 1 ? `Na caverna ${String.fromCharCode(65 + mapIndex)}: ` : '';
    msg(`${which}${outcomeText(r)}`, 'error');
    if (runningAll) record(r.status, 0, r.actions, r.score, null);
    stop();
    return;
  }
  if (runningAll && mapIndex < src!.layouts.length - 1) {
    msg(`Caverna ${String.fromCharCode(65 + mapIndex)} vencida! Testando a próxima…`, 'ok');
    timer = setTimeout(() => {
      showMap(mapIndex + 1);
      run = new ProgramRun(program(), src!.layouts[mapIndex]);
      preview = run.world;
      tick();
    }, 700);
    return;
  }
  const all = runningAll || src!.layouts.length === 1;
  if (all) {
    const p = program();
    const m = src!.mission;
    const ev = evaluateMission(p, { maps: src!.layouts, maxBlocks: m?.maxBlocks ?? Infinity, maxActions: m?.maxActions ?? Infinity });
    const n = m ? ev.stars : ev.won ? 1 : 0;
    saveStars(src!.id, n);
    if (m) saveStars(`missao:${m.id}`, n); // a lista de missões mostra o melhor resultado, venha de onde vier
    const extra = m && n < 3 ? (n === 1 ? ` Dá para usar menos blocos? A meta é ${m.maxBlocks}.` : ` Dá para o robô dar menos passos? A meta é ${m.maxActions} ações.`) : '';
    msg(`${outcomeText(r)} ${m ? stars(n) : ''}${extra}`, 'ok');
    $('#blk-best').textContent = m ? stars(bestStars(src!.id)) : '';
    record('won', n, ev.actions, r.score, null);
  } else msg(outcomeText(r), 'ok');
  stop();
}

function tick() {
  if (!run) return;
  const step = run.next();
  if (step) {
    ws!.highlightBlock(step.blockId);
    drawBoard();
  }
  if (run.finished) {
    drawBoard();
    mapFinished();
    return;
  }
  if (runningAll) timer = setTimeout(tick, 1100 / Number($<HTMLInputElement>('#blk-speed').value));
}

function runAll() {
  if (runningAll) {
    stop();
    msg('Parado.');
    return;
  }
  stop();
  const p = program();
  if (!p.main.length) return msg('Encaixe blocos dentro de "quando começar" para o robô saber o que fazer.', 'error');
  runningAll = true;
  $('#blk-run').textContent = '⏸ Parar';
  msg('Executando…');
  showMap(0);
  run = new ProgramRun(p, src!.layouts[0]);
  preview = run.world;
  tick();
}

function stepOnce() {
  if (runningAll) stop();
  if (!run) {
    const p = program();
    if (!p.main.length) return msg('Encaixe blocos dentro de "quando começar" para o robô saber o que fazer.', 'error');
    run = new ProgramRun(p, src!.layouts[mapIndex]);
    preview = run.world;
    msg('Modo passo a passo: cada clique faz o robô dar uma ação.');
  }
  tick();
}

function renderMissions() {
  const ol = $('#mission-list');
  ol.replaceChildren(
    ...MISSIONS.map((m, i) => {
      const li = document.createElement('li');
      const best = bestStars(`missao:${m.id}`);
      const btn = document.createElement('button');
      btn.className = `mission${best ? ' done' : ''}`;
      btn.innerHTML = `<span class="n">${i + 1}</span><b></b><small></small><span class="stars">${stars(best)}</span>`;
      btn.querySelector('b')!.textContent = m.title;
      btn.querySelector('small')!.textContent = m.concept;
      btn.addEventListener('click', () => openBlocks(sourceFromMission(m)));
      li.append(btn);
      return li;
    }),
  );
}

function ensureWorkspace() {
  if (ws) return ws;
  ws = createWorkspace($('#blockly'), src!.groups);
  ws.addChangeListener((e) => {
    if (e.isUiEvent || !src) return;
    if (runningAll || run) {
      stop();
      showMap(mapIndex);
    }
    saveProgram(src.id, saveWorkspace(ws!));
    updateCount();
  });
  return ws;
}

/** Abre o editor para uma missão, atividade ou caverna. */
export function openBlocks(source?: PlaySource) {
  nav.show('blocos');
  if (!source) {
    renderMissions();
    $('#missions').hidden = false;
    $('#editor').hidden = true;
    return;
  }
  stop();
  src = source;
  $('#missions').hidden = true;
  $('#editor').hidden = false;
  $('#blk-title').textContent = source.title;
  $('#blk-goal').textContent = source.goal;
  $('#blk-tip').textContent = source.tip || 'Imagine que você é o robô e faça o caminho com o dedo no tabuleiro antes de montar os blocos.';
  $('#blk-best').textContent = source.mission ? stars(bestStars(source.id)) : '';
  const w = ensureWorkspace();
  w.updateToolbox(toolboxFor(source.groups) as Blockly.utils.toolbox.ToolboxDefinition);
  loadWorkspace(w, loadProgram(source.id));
  Blockly.svgResize(w);
  $('#blk-maps').replaceChildren(
    ...(source.layouts.length > 1
      ? source.layouts.map((_: MapLayout, i: number) => {
          const b = Object.assign(document.createElement('button'), { textContent: String.fromCharCode(65 + i), className: 'mapbtn', title: `Ver a caverna ${String.fromCharCode(65 + i)}` });
          b.addEventListener('click', () => {
            stop();
            showMap(i);
          });
          return b;
        })
      : []),
  );
  showMap(0);
  updateCount();
  msg('Monte o programa e clique em ▶ Executar.');
  openedAt = performance.now();
}

export function initBlocks() {
  $('#blk-run').addEventListener('click', runAll);
  $('#blk-step').addEventListener('click', stepOnce);
  $('#blk-reset').addEventListener('click', () => {
    stop();
    showMap(mapIndex);
    msg('O robô voltou para a entrada. O programa continua igual.');
  });
  $('#blk-back').addEventListener('click', () => {
    stop();
    openBlocks();
  });
  window.addEventListener('resize', () => ws && Blockly.svgResize(ws));
  renderMissions();
}

/** O Blockly mede o tamanho do contêiner: chamar quando a aba fica visível. */
export const resizeBlocks = () => ws && Blockly.svgResize(ws);

// Para depuração e testes no console do navegador: carregar um programa (JSON do Blockly) na missão aberta
Object.assign(window, {
  escola: {
    loadProgram: (json: unknown) => ws && loadWorkspace(ws, json as never),
    program: () => (ws ? saveWorkspace(ws) : null),
  },
});
