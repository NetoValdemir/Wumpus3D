import './style.css';
import { WumpusWorld, DIR_NAME, type Action } from './game/world';
import { WorldView } from './render/view';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const view = new WorldView($('#scene'));
let world = new WumpusWorld();
view.load(world);

const KEYS: Record<string, Action> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'shoot',
  KeyG: 'grab',
  KeyC: 'climb',
};

function log(msg: string) {
  const li = document.createElement('li');
  li.textContent = msg;
  const list = $('#log');
  list.prepend(li);
  while (list.children.length > 6) list.lastChild!.remove();
}

function updateHud() {
  const p = world.percepts;
  $('#score').textContent = String(world.score);
  $('#pos').textContent = `(${world.agent.x + 1}, ${world.agent.y + 1}) · ${DIR_NAME[world.agent.dir]}`;
  $('#arrow').textContent = world.hasArrow ? '1' : '0';
  $('#gold').textContent = world.hasGold ? 'Sim' : 'Não';

  const set = (id: string, on: boolean) => $(`#p-${id}`).classList.toggle('on', on);
  set('stench', p.stench);
  set('breeze', p.breeze);
  set('glitter', p.glitter);
  set('bump', p.bump);
  set('scream', p.scream);

  const over = $('#gameover');
  over.hidden = !world.gameOver;
  if (world.gameOver) {
    const titles = {
      won: 'Vitória!',
      escaped: 'Você escapou',
      'dead-pit': 'Caiu no poço',
      'dead-wumpus': 'Devorado pelo Wumpus',
      playing: '',
    };
    $('#go-title').textContent = titles[world.status];
    $('#go-score').textContent = `Pontuação final: ${world.score}`;
  }
}

function act(action: Action) {
  const result = world.step(action);
  if (result.arrow) view.shootArrow(result.arrow.from, result.arrow.to);
  log(result.message);
  view.sync();
  updateHud();
}

function restart() {
  world = new WumpusWorld();
  view.load(world);
  $('#log').innerHTML = '';
  log('Você entrou na caverna. Encontre o ouro e volte vivo!');
  updateHud();
}

function toggleCamera() {
  view.cameraMode = view.cameraMode === 'follow' ? 'overview' : 'follow';
}

function toggleReveal() {
  view.revealAll = !view.revealAll;
  view.sync();
}

window.addEventListener('keydown', (e) => {
  if (KEYS[e.code]) {
    e.preventDefault();
    if (!e.repeat) act(KEYS[e.code]);
  } else if (e.code === 'KeyR') restart();
  else if (e.code === 'KeyV') toggleCamera();
  else if (e.code === 'KeyM') toggleReveal();
});

// Botões na tela (para celular)
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) =>
  btn.addEventListener('click', () => act(btn.dataset.action as Action)),
);
$('#btn-restart').addEventListener('click', restart);
$('#go-restart').addEventListener('click', restart);
$('#btn-camera').addEventListener('click', toggleCamera);
$('#btn-reveal').addEventListener('click', toggleReveal);

log('Você entrou na caverna. Encontre o ouro e volte vivo!');
updateHud();

view.renderer.setAnimationLoop(() => view.frame());
