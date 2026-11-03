// Tela do Detetive: tabuleiro 2D, controles, caderno de anotações, dicas e registro de cada tentativa.
import { key, type Action, type MapLayout, type StepResult } from '../../game/world';
import { $, showMessage } from '../../ui/dom';
import { boardSvg, renderBoard } from '../board';
import { DetectiveGame, MARK_LABEL, detectiveFeedback } from '../detective';
import { loadCaves } from '../edu-storage';
import { nav, randomCave, recordAttempt, sourceFromLayout, type PlaySource } from './session';

const KEYS: Record<string, Action> = { ArrowUp: 'forward', KeyW: 'forward', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'shoot', KeyG: 'grab' };

let src: PlaySource | null = null;
let layout: MapLayout;
let game: DetectiveGame;
let startedAt = 0;
let showCheck = false;
let recorded = false;

/** Mensagens do jogo num tom mais leve para crianças. */
function friendly(r: StepResult) {
  return r.message.replace('O Wumpus te devorou! Fim de jogo.', 'O Wumpus pegou você!').replace(' Fim de jogo.', '').replace('Pressione R para recomeçar.', '');
}

function log(text: string) {
  const ul = $('#det-log');
  const li = document.createElement('li');
  li.textContent = text;
  ul.prepend(li);
  while (ul.children.length > 5) ul.lastChild!.remove();
}

function sensesText() {
  const p = game.world.percepts;
  const list = [p.breeze && '💨 brisa (poço numa sala vizinha)', p.stench && '👃 fedor (Wumpus numa sala vizinha ou nesta)', p.glitter && '✨ brilho (o ouro está aqui!)', p.bump && '🧱 parede', p.scream && '😱 um grito: o Wumpus morreu'];
  return list.filter(Boolean).join(' · ') || 'nada de diferente';
}

function render() {
  const w = game.world;
  const over = w.gameOver;
  renderBoard(boardSvg('#det-board'), {
    size: w.size,
    cell: (x, y) => {
      const k = key(x, y);
      const obs = game.kb.visited.get(k);
      const visited = !!obs;
      const shown = visited || over;
      const mark = game.marks.get(k);
      return {
        visited,
        breeze: obs?.breeze,
        stench: obs?.stench,
        pit: shown && w.hasPit(x, y),
        gold: !!w.gold && w.gold.x === x && w.gold.y === y && (shown || w.percepts.glitter),
        wumpus: (shown || !w.wumpusAlive) && w.wumpus.x === x && w.wumpus.y === y ? (w.wumpusAlive ? 'vivo' : 'morto') : undefined,
        mark: mark ? MARK_LABEL[mark] : undefined,
        verdict: showCheck && mark ? game.verdict(k) : null,
      };
    },
    robot: { x: w.agent.x, y: w.agent.y, dir: w.agent.dir, hasGold: w.hasGold, dead: w.status === 'dead-pit' || w.status === 'dead-wumpus' },
    onCell: over ? undefined : (x, y) => {
      game.cycleMark(key(x, y));
      render();
    },
  });
  $('#det-senses').textContent = sensesText();
  document.querySelectorAll<HTMLButtonElement>('#tab-detetive [data-act]').forEach((b) => (b.disabled = over));
  boardSvg('#det-board').classList.toggle('over', over);
}

function finish() {
  const s = game.summary();
  if (src && !recorded) {
    recorded = true;
    recordAttempt(src, {
      kind: 'detetive',
      ms: Math.round(performance.now() - startedAt),
      outcome: s.status,
      stars: s.stars,
      actions: s.actions,
      score: s.score,
      logicErrors: s.logicErrors,
      needlessRisks: s.needlessRisks,
      hints: s.hints,
      marks: s.marks,
    });
    nav.refreshHome();
  }
  const titles = { won: 'Você venceu! 🎉', 'dead-pit': 'Caiu num poço…', 'dead-wumpus': 'O Wumpus pegou você…', timeout: 'O tempo acabou', playing: '' };
  $('#det-end-title').textContent = titles[s.status];
  $('#det-end-stars').textContent = s.status === 'won' ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : '';
  const ul = $('#det-end-feedback');
  ul.replaceChildren(...detectiveFeedback(s).map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  if (s.status !== 'won') ul.prepend(Object.assign(document.createElement('li'), { textContent: 'O mapa inteiro agora está à mostra: veja onde estavam os perigos e tente de novo.' }));
  $('#det-end').hidden = false;
}

function act(a: Action) {
  if (game.world.gameOver) return;
  const r = game.act(a);
  log(friendly(r));
  render();
  if (game.world.gameOver) finish();
}

/** Começa (ou recomeça) a caverna. */
function start(source: PlaySource, l = source.layouts[0]) {
  src = source;
  layout = l;
  game = new DetectiveGame(layout);
  startedAt = performance.now();
  recorded = false;
  $('#det-end').hidden = true;
  $('#det-title').textContent = source.title;
  $('#det-goal').textContent = source.goal;
  $('#det-helper').textContent = 'Dica: comece olhando o que você sente na entrada. Depois toque nas salas vizinhas para anotar o que descobriu.';
  $('#det-log').replaceChildren();
  log('Você entrou na caverna pela sala (1, 1), olhando para a direita.');
  render();
}

function fillSources() {
  const sel = $<HTMLSelectElement>('#det-source');
  sel.replaceChildren(new Option('Trocar caverna…', ''), new Option('Caverna sorteada (4 × 4)', 'sorteio'), ...loadCaves().map((c) => new Option(`Minha: ${c.name}`, `cave:${c.name}`)));
}

export function openDetective(source?: PlaySource) {
  fillSources();
  if (source) start(source);
  else if (!src) start(sourceFromLayout(randomCave(), 'detetive'));
  nav.show('detetive');
}

export function initDetective() {
  document.querySelectorAll<HTMLButtonElement>('#tab-detetive [data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act as Action)));
  window.addEventListener('keydown', (e) => {
    if ($('#tab-detetive').hidden || !KEYS[e.code]) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if ((e.target as Element)?.closest?.('.cell')) return; // Enter/espaço numa sala anotam
    e.preventDefault();
    if (!e.repeat) act(KEYS[e.code]);
  });
  $('#det-hint').addEventListener('click', () => showMessage('#det-helper', game.world.gameOver ? 'A partida acabou. Tente de novo!' : game.hint()));
  $('#det-check').addEventListener('click', () => {
    showCheck = !showCheck;
    $('#det-check').setAttribute('aria-pressed', String(showCheck));
    const c = game.checkMarks();
    showMessage(
      '#det-helper',
      showCheck
        ? game.marks.size
          ? `Verde: as pistas provam. Amarelo: pode ser, mas ainda não dá para ter certeza. Vermelho: as pistas mostram outra coisa. (${c.certa} verde, ${c.possivel} amarela, ${c.errada} vermelha)`
          : 'Você ainda não anotou nada no caderno. Toque numa sala desconhecida para anotar.'
        : 'Conferência escondida.',
    );
    render();
  });
  $('#det-retry').addEventListener('click', () => src && start(src, layout));
  $('#det-new').addEventListener('click', () => start(src?.activity ? src : sourceFromLayout(randomCave(), 'detetive'), src?.activity ? src.layouts[0] : undefined));
  $('#det-back').addEventListener('click', () => nav.show('inicio'));
  $<HTMLSelectElement>('#det-source').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    (e.target as HTMLSelectElement).value = '';
    if (v === 'sorteio') start(sourceFromLayout(randomCave(), 'detetive'));
    else if (v.startsWith('cave:')) {
      const c = loadCaves().find((x) => x.name === v.slice(5));
      if (c) start(sourceFromLayout(c, 'detetive'));
    }
  });
}
