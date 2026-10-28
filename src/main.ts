import './style.css';
import { WumpusWorld, DIR_NAME, SCORE, type Action } from './game/world';
import { WorldView } from './render/view';
import { AGENTS, createAgent, sensesOf, type Agent, type AgentId } from './agents/agents';
import { benchmark } from './agents/benchmark';
import type { CellBelief } from './agents/knowledge';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const cfg = {
  size: $<HTMLSelectElement>('#cfg-size'),
  pits: $<HTMLSelectElement>('#cfg-pits'),
  agent: $<HTMLSelectElement>('#cfg-agent'),
  risk: $<HTMLInputElement>('#cfg-risk'),
  speed: $<HTMLInputElement>('#cfg-speed'),
  beliefs: $<HTMLInputElement>('#cfg-beliefs'),
};
for (const [id, a] of Object.entries(AGENTS)) cfg.agent.add(new Option(a.label, id));

const view = new WorldView($('#scene'));
let world: WumpusWorld;
let agentId: AgentId = 'human';
let agent: Agent | null = null;
let playing = false;
let lastStep = 0;

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

/** Só as salas que interessam: fronteira do que já foi explorado e onde o Wumpus pode estar. */
function visibleBeliefs(): Map<string, CellBelief> | null {
  if (!agent || !cfg.beliefs.checked) return null;
  const all = agent.beliefs();
  if (!all) return null;
  const nearVisited = (k: string) => {
    const [x, y] = k.split(',').map(Number);
    return world.neighbors(x, y).some((n) => world.isVisited(n.x, n.y));
  };
  const wumpusSpots = [...all.values()].filter((b) => b.wumpus > 0).length;
  return new Map([...all].filter(([k, b]) => nearVisited(k) || (b.wumpus > 0 && wumpusSpots <= 3)));
}

function updateHud() {
  const p = world.percepts;
  $('#score').textContent = String(world.score);
  $('#pos').textContent = `(${world.agent.x + 1}, ${world.agent.y + 1}) · ${DIR_NAME[world.agent.dir]}`;
  $('#arrow').textContent = world.hasArrow ? '1' : '0';
  $('#gold').textContent = world.hasGold ? 'Sim' : 'Não';

  const atEntrance = world.agent.x === 0 && world.agent.y === 0;
  $('#goal').textContent = !world.hasGold
    ? p.glitter
      ? 'O ouro está aqui! Pegue (G)'
      : 'Encontre o ouro'
    : atEntrance
      ? 'Saia da caverna (C) para vencer'
      : 'Volte para (1, 1) com o ouro';
  $('#btn-climb').classList.toggle('highlight', world.hasGold && atEntrance && !world.gameOver);
  document.querySelector('[data-action="grab"]')!.classList.toggle('highlight', p.glitter && !world.gameOver);

  const set = (id: string, on: boolean) => $(`#p-${id}`).classList.toggle('on', on);
  set('stench', p.stench);
  set('breeze', p.breeze);
  set('glitter', p.glitter);
  set('bump', p.bump);
  set('scream', p.scream);

  // Controles do modo agente
  const isAgent = agentId !== 'human';
  document.querySelectorAll<HTMLElement>('.row.manual').forEach((r) => (r.hidden = isAgent));
  $('#agent-controls').hidden = !isAgent;
  $('#btn-play').textContent = playing ? '⏸ Pausar' : '▶ Jogar';
  $<HTMLButtonElement>('#btn-play').disabled = world.gameOver;
  $<HTMLButtonElement>('#btn-step').disabled = world.gameOver;
  $('#keys').textContent = isAgent
    ? 'Espaço jogar/pausar · N um passo · V câmera · M mapa · R novo'
    : 'W/↑ andar · A D girar · Espaço atirar · G pegar · C sair · V câmera · M mapa · R novo';
  const thought = $('#thought');
  thought.hidden = !agent?.thought;
  thought.textContent = agent?.thought ? `${AGENTS[agentId].label}: ${agent.thought}` : '';

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
    const texts = {
      won: `Pegou o ouro (+${SCORE.gold}) e saiu vivo da caverna (+${SCORE.escape}).`,
      escaped: 'Saiu vivo, mas deixou o ouro para trás.',
      'dead-pit': 'Cuidado com as salas onde você sente brisa.',
      'dead-wumpus': 'Fedor indica que o Wumpus está em uma sala vizinha.',
      playing: '',
    };
    $('#gameover').dataset.status = world.status;
    $('#go-title').textContent = titles[world.status];
    $('#go-text').textContent = texts[world.status];
    $('#go-score').textContent = `Pontuação final: ${world.score}`;
  }
}

function act(action: Action) {
  const result = world.step(action);
  if (result.arrow) view.shootArrow(result.arrow.from, result.arrow.to);
  log(result.message);
  if (world.gameOver) playing = false;
  view.sync();
  view.showBeliefs(visibleBeliefs());
  updateHud();
}

function agentStep() {
  if (!agent || world.gameOver) return;
  act(agent.decide(sensesOf(world)));
}

function restart() {
  agentId = cfg.agent.value as AgentId;
  const size = Number(cfg.size.value);
  const pits = Number(cfg.pits.value);
  world = new WumpusWorld(size, pits);
  agent = agentId === 'human' ? null : createAgent(agentId, size, pits, Number(cfg.risk.value) / 100);
  playing = false;
  view.load(world);
  view.showBeliefs(visibleBeliefs());
  $('#log').innerHTML = '';
  log(agent ? `${AGENTS[agentId].label} entrou na caverna. Aperte ▶ Jogar.` : 'Você entrou na caverna. Encontre o ouro e volte vivo!');
  updateHud();
}

function updateSetup() {
  const id = cfg.agent.value as AgentId;
  $('#agent-desc').textContent = AGENTS[id].description;
  $('#row-risk').hidden = id !== 'bayes';
  $('#row-speed').hidden = id === 'human';
  $('#row-beliefs').hidden = id === 'human' || id === 'random';
  $<HTMLButtonElement>('#btn-bench').hidden = id === 'human';
  $('#risk-out').textContent = `${cfg.risk.value}%`;
  $('#speed-out').textContent = `${cfg.speed.value} passos/s`;
}

function togglePlay() {
  if (world.gameOver) return;
  playing = !playing;
  lastStep = 0;
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
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (agentId !== 'human') {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyN') agentStep();
  } else if (KEYS[e.code]) {
    e.preventDefault();
    if (!e.repeat) act(KEYS[e.code]);
  }
  if (e.code === 'KeyR') restart();
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
$('#btn-play').addEventListener('click', togglePlay);
$('#btn-step').addEventListener('click', agentStep);

// Mudar mapa ou jogador começa uma partida nova; o resto vale na hora
for (const el of [cfg.size, cfg.pits, cfg.agent]) {
  el.addEventListener('change', () => {
    updateSetup();
    restart();
    el.blur();
  });
}
cfg.risk.addEventListener('input', () => {
  updateSetup();
  if (agent && agentId === 'bayes') restart();
});
cfg.speed.addEventListener('input', updateSetup);
cfg.beliefs.addEventListener('change', () => view.showBeliefs(visibleBeliefs()));

$('#btn-bench').addEventListener('click', () => {
  const id = cfg.agent.value as AgentId;
  if (id === 'human') return;
  const out = $('#bench-out');
  out.textContent = 'Jogando 100 partidas...';
  setTimeout(() => {
    const r = benchmark(id, Number(cfg.size.value), Number(cfg.pits.value), Number(cfg.risk.value) / 100, 100);
    out.textContent =
      `${AGENTS[id].label} em ${cfg.size.value}×${cfg.size.value}: ` +
      `${r.wins} vitórias, ${r.deaths} mortes, ${r.games - r.wins - r.deaths} saídas sem ouro. ` +
      `Pontuação média: ${Math.round(r.avgScore)}.`;
  }, 20);
});

// Painel aberto em telas grandes, fechado no celular
if (window.innerWidth > 900) $('#setup').setAttribute('open', '');

updateSetup();
restart();

view.renderer.setAnimationLoop((now) => {
  if (playing && agent && !world.gameOver && now - lastStep >= 1000 / Number(cfg.speed.value)) {
    lastStep = now;
    agentStep();
  }
  view.frame();
});

// Para depuração no console do navegador
Object.assign(window, { wumpus: { get world() { return world; } } });
