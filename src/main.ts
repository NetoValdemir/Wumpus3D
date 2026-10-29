import './style.css';
import { WumpusWorld, DIR_NAME, SCORE, parseLayout, pitCountFor, type Action, type MapLayout, type Status } from './game/world';
import { WorldView } from './render/view';
import { AGENTS, type AgentId } from './agents/agents';
import { DEFAULT_GENOME, GENES } from './agents/genome';
import type { GenerationReport } from './agents/genetic';
import type { CellBelief } from './agents/knowledge';
import { deleteMap, loadGenome, loadSavedMaps, saveGenome, saveMap } from './storage';
import GAWorker from './agents/ga.worker?worker&inline';
import { infoOf, publicSensesOf, type Controller, type Decision } from './arena/protocol';
import { builtinController, playEpisode, type EpisodeResult } from './arena/runner';
import { aggregate } from './arena/ranking';
import { arenaMaps } from './arena/rng';
import { WorkerSandbox } from './arena/sandbox';
import { externalAgents, externalById, initArena, openArena } from './arena/ui';
import { buildReport, type Report } from './report/report';
import { addReportToAnalysis, exportReportHtml, exportReportJson, initAnalysis, openAnalysis } from './report/ui';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const cfg = {
  size: $<HTMLSelectElement>('#cfg-size'),
  pits: $<HTMLSelectElement>('#cfg-pits'),
  agent: $<HTMLSelectElement>('#cfg-agent'),
  speed: $<HTMLInputElement>('#cfg-speed'),
  beliefs: $<HTMLInputElement>('#cfg-beliefs'),
};

/** Quem joga: 'human', um agente embutido ('logic', ...) ou um agente importado ('ext:<id>'). */
type PlayerId = string;

function playerInfo(id: PlayerId): { label: string; description: string } {
  if (id.startsWith('ext:')) {
    const a = externalById(id.slice(4));
    return a ? { label: a.name, description: `Agente importado, por ${a.author}. ${a.description}` } : { label: 'Agente removido', description: '' };
  }
  return AGENTS[id as AgentId];
}

/** Monta as opções de "Quem joga": embutidos e, num grupo separado, os importados. */
function refreshPlayerOptions() {
  const current = cfg.agent.value;
  cfg.agent.innerHTML = '';
  for (const [id, a] of Object.entries(AGENTS)) cfg.agent.add(new Option(a.label, id));
  const imported = externalAgents();
  if (imported.length) {
    const group = document.createElement('optgroup');
    group.label = 'Agentes importados';
    for (const a of imported) group.append(new Option(`${a.name} (${a.author})`, `ext:${a.id}`));
    cfg.agent.append(group);
  }
  cfg.agent.value = [...cfg.agent.options].some((o) => o.value === current) ? current : 'human';
}

const view = new WorldView($('#scene'));
let world: WumpusWorld;
let layout: MapLayout; // configuração do mapa atual, para repetir com outro jogador
let mapName: string | null = null; // nome do mapa salvo/importado em uso (null = sorteado)
let playerId: PlayerId = 'human';
let controller: Controller | null = null; // o agente que está jogando (null = você)
let ready: Promise<void> = Promise.resolve(); // agente pronto para a partida atual
let decision: Decision | null = null; // última decisão do agente (pensamento e crenças)
let game = 0; // muda a cada partida, para ignorar respostas atrasadas de partidas anteriores
let stepping = false;
let playing = false;
let lastStep = 0;
let genome: number[] | null = loadGenome(); // pesos treinados pelo usuário (null = padrão)

const KEYS: Record<string, Action> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'shoot',
  KeyG: 'grab',
};

const TITLES: Record<Status, string> = {
  won: 'Vitória!',
  'dead-pit': 'Caiu no poço',
  'dead-wumpus': 'Devorado pelo Wumpus',
  timeout: 'Tempo esgotado',
  playing: '',
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
  const all = decision?.beliefs;
  if (!controller || !cfg.beliefs.checked || !all) return null;
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
  $('#goal').textContent = world.hasGold
    ? 'Volte para (1, 1) para vencer'
    : p.glitter
      ? 'O ouro está aqui! Pegue (G)'
      : 'Encontre o ouro';
  document.querySelector('[data-action="grab"]')!.classList.toggle('highlight', p.glitter && !world.gameOver);

  const set = (id: string, on: boolean) => $(`#p-${id}`).classList.toggle('on', on);
  set('stench', p.stench);
  set('breeze', p.breeze);
  set('glitter', p.glitter);
  set('bump', p.bump);
  set('scream', p.scream);

  // Controles do modo agente
  const isAgent = playerId !== 'human';
  document.querySelectorAll<HTMLElement>('.row.manual').forEach((r) => (r.hidden = isAgent));
  $('#agent-controls').hidden = !isAgent;
  $('#btn-play').textContent = playing ? '⏸ Pausar' : '▶ Jogar';
  $<HTMLButtonElement>('#btn-play').disabled = world.gameOver;
  $<HTMLButtonElement>('#btn-step').disabled = world.gameOver;
  $('#keys').textContent = isAgent
    ? 'Espaço jogar/pausar · N um passo · T parar e reiniciar · V câmera · M mapa · R novo mapa · C configurar'
    : 'W/↑ andar · A D girar · Espaço atirar · G pegar · T reiniciar · V câmera · M mapa · R novo mapa · C configurar';
  const thought = $('#thought');
  thought.hidden = !decision?.thought;
  thought.textContent = decision?.thought ? `${playerInfo(playerId).label}: ${decision.thought}` : '';
  $('#map-current').textContent = `${mapName ?? 'sorteado'} (${world.size}×${world.size})`;

  const over = $('#gameover');
  over.hidden = !world.gameOver;
  if (world.gameOver) {
    const texts: Record<Status, string> = {
      won: `Pegou o ouro (+${SCORE.gold}) e voltou vivo à entrada (+${SCORE.escape}).`,
      'dead-pit': 'Cuidado com as salas onde você sente brisa.',
      'dead-wumpus': 'Fedor indica que o Wumpus está em uma sala vizinha.',
      timeout: `A partida passou de ${world.maxActions} ações sem terminar.`,
      playing: '',
    };
    over.dataset.status = world.status;
    $('#go-title').textContent = TITLES[world.status];
    // O Wumpus só morre pela flecha, então "não está vivo" = o jogador ganhou o bônus
    const kill = world.wumpusAlive ? '' : `\nMatou o Wumpus com a flecha (+${SCORE.wumpusKill}).`;
    $('#go-text').textContent = texts[world.status] + kill;
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

function makeController(id: PlayerId, withBeliefs: boolean): Controller {
  if (id.startsWith('ext:')) return new WorkerSandbox(externalById(id.slice(4))!.code, 3000);
  return builtinController(id as Exclude<AgentId, 'human'>, { genome: genome ?? DEFAULT_GENOME, withBeliefs });
}

async function agentStep() {
  if (!controller || world.gameOver || stepping) return;
  const g = game;
  stepping = true;
  try {
    await ready;
    if (g !== game || world.gameOver) return;
    const d = await controller.decide(publicSensesOf(world));
    if (g !== game) return;
    decision = d;
    act(d.action);
  } catch (err) {
    if (g !== game) return;
    playing = false;
    log(`Erro do agente: ${(err as Error)?.message ?? err}`);
    updateHud();
  } finally {
    if (g === game) stepping = false;
  }
}

/** Começa uma partida. `newMap` sorteia outro mapa; senão repete o atual (útil para trocar de jogador). */
function restart(newMap = true) {
  playerId = cfg.agent.value;
  game++;
  stepping = false;
  decision = null;
  controller?.dispose?.();
  if (newMap || !layout) {
    world = new WumpusWorld(Number(cfg.size.value), Number(cfg.pits.value));
    layout = world.toLayout('Mapa sorteado');
    mapName = null;
  } else {
    world = WumpusWorld.fromLayout(layout);
  }
  controller = playerId === 'human' ? null : makeController(playerId, true);
  if (controller) {
    const c = controller;
    ready = Promise.resolve().then(() => c.start(infoOf(world)));
    ready.catch(() => {}); // o erro aparece no primeiro passo do agente
  }
  playing = false;
  view.load(world);
  view.showBeliefs(visibleBeliefs());
  $('#log').innerHTML = '';
  log(controller ? `${playerInfo(playerId).label} entrou na caverna. Aperte ▶ Jogar.` : 'Você entrou na caverna. Encontre o ouro e volte vivo!');
  updateHud();
}

/** Para o agente (se estiver jogando) e volta ao início, no mesmo mapa. */
function resetSameMap() {
  const wasPlaying = playing;
  restart(false);
  log(wasPlaying ? 'Agente parado. A partida voltou ao início, no mesmo mapa.' : 'Partida reiniciada no mesmo mapa.');
}

const isSetupOpen = () => !$('#setup').hidden;

/** Mostra ou esconde o painel de configuração; o mapa 3D ocupa o espaço liberado. */
function setSetupOpen(open: boolean) {
  $('#setup').hidden = !open;
  document.body.classList.toggle('setup-open', open);
  const btn = $('#btn-setup');
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('active', open);
}

/** Joga um mapa salvo ou importado. */
function playLayout(l: MapLayout) {
  layout = l;
  mapName = l.name;
  if ([...cfg.size.options].some((o) => o.value === String(l.size))) cfg.size.value = String(l.size);
  restart(false);
}

function updateSetup() {
  const id = cfg.agent.value;
  $('#agent-desc').textContent = playerInfo(id).description;
  $('#row-speed').hidden = id === 'human';
  $('#row-beliefs').hidden = id === 'human' || id === 'random';
  $('#bench-section').hidden = id === 'human';
  $('#ga-section').hidden = id !== 'genetic';
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
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (playerId !== 'human') {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyN') agentStep();
  } else if (KEYS[e.code]) {
    e.preventDefault();
    if (!e.repeat) act(KEYS[e.code]);
  }
  if (e.code === 'KeyR') restart();
  else if (e.code === 'KeyT') resetSameMap();
  else if (e.code === 'KeyC') setSetupOpen(!isSetupOpen());
  else if (e.code === 'KeyV') toggleCamera();
  else if (e.code === 'KeyM') toggleReveal();
});

// Botões na tela (para celular)
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) =>
  btn.addEventListener('click', () => act(btn.dataset.action as Action)),
);
$('#btn-restart').addEventListener('click', () => restart());
$('#go-restart').addEventListener('click', () => restart());
$('#go-replay').addEventListener('click', () => restart(false));
$('#btn-stop').addEventListener('click', resetSameMap);
$('#btn-reset').addEventListener('click', resetSameMap);
$('#btn-setup').addEventListener('click', () => setSetupOpen(!isSetupOpen()));
$('#setup-close').addEventListener('click', () => setSetupOpen(false));
$('#btn-camera').addEventListener('click', toggleCamera);
$('#btn-reveal').addEventListener('click', toggleReveal);
$('#btn-play').addEventListener('click', togglePlay);
$('#btn-step').addEventListener('click', agentStep);

/** Mostra quantos poços a porcentagem escolhida dá no tamanho escolhido. */
function updatePitHint() {
  const size = Number(cfg.size.value);
  const n = pitCountFor(size, Number(cfg.pits.value));
  $('#cfg-pits-hint').textContent = `${size} × ${size} = ${size * size} casas → ${n} ${n === 1 ? 'poço' : 'poços'} em todo mapa sorteado. Os agentes não sabem esse número.`;
}

// Mudar tamanho ou porcentagem de poços sorteia outro mapa; trocar de jogador mantém o mapa
for (const el of [cfg.size, cfg.pits]) {
  el.addEventListener('change', () => {
    updatePitHint();
    restart();
    el.blur();
  });
}
cfg.agent.addEventListener('change', () => {
  updateSetup();
  restart(false);
  cfg.agent.blur();
});
cfg.speed.addEventListener('input', updateSetup);
cfg.beliefs.addEventListener('change', () => view.showBeliefs(visibleBeliefs()));

// ---------- Mapas: salvar, carregar, exportar e importar ----------

const mapMsg = (text: string, error = false) => {
  const el = $('#map-msg');
  el.textContent = text;
  el.classList.toggle('error', error);
};
const mapList = $<HTMLSelectElement>('#map-list');
const mapJson = $<HTMLTextAreaElement>('#map-json');

function refreshMapList(select?: string) {
  const maps = loadSavedMaps();
  mapList.innerHTML = '';
  if (!maps.length) mapList.add(new Option('Nenhum mapa salvo ainda', ''));
  for (const m of maps) mapList.add(new Option(`${m.name} (${m.size}×${m.size})`, m.name));
  if (select) mapList.value = select;
  for (const id of ['#map-load', '#map-export', '#map-delete']) $<HTMLButtonElement>(id).disabled = !maps.length;
  resetDelete();
}

const selectedMap = () => loadSavedMaps().find((m) => m.name === mapList.value);
const fileName = (l: MapLayout) => `wumpus-${l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mapa'}.json`;
const toJson = (l: MapLayout) => JSON.stringify(l, null, 2);

/** Baixa o JSON e também o coloca na caixa de texto (onde downloads são bloqueados, dá para copiar). */
function exportLayout(l: MapLayout) {
  const json = toJson(l);
  mapJson.value = json;
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName(l) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // download indisponível: o JSON continua na caixa de texto
  }
  $<HTMLDetailsElement>('details.paste').open = true;
  mapMsg(`"${l.name}" exportado como ${fileName(l)}. O JSON também está na caixa abaixo para copiar.`);
}

function importJson(text: string) {
  try {
    const l = parseLayout(text);
    const saved = saveMap(l);
    refreshMapList(l.name);
    playLayout(l);
    mapMsg(saved ? `Mapa "${l.name}" importado e salvo.` : `Mapa "${l.name}" carregado (este navegador não permite salvar).`);
  } catch (err) {
    mapMsg(`Não deu para importar: ${(err as Error).message}`, true);
  }
}

$('#map-save').addEventListener('click', () => {
  const input = $<HTMLInputElement>('#map-name');
  const name = input.value.trim() || `Mapa ${world.size}×${world.size} — ${new Date().toLocaleString('pt-BR')}`;
  const l = { ...layout, name };
  if (!saveMap(l)) return mapMsg('Este navegador está bloqueando o armazenamento. Use "Exportar mapa atual" para guardar o arquivo.', true);
  layout = l;
  mapName = name;
  input.value = '';
  refreshMapList(name);
  updateHud();
  mapMsg(`Mapa "${name}" salvo neste navegador.`);
});
$('#map-load').addEventListener('click', () => {
  const l = selectedMap();
  if (!l) return;
  playLayout(l);
  mapMsg(`Jogando "${l.name}".`);
});
$('#map-export').addEventListener('click', () => {
  const l = selectedMap();
  if (l) exportLayout(l);
});
$('#map-export-current').addEventListener('click', () => exportLayout({ ...layout, name: mapName ?? `Mapa ${world.size}×${world.size}` }));

// Excluir pede um segundo clique para confirmar
const delBtn = $<HTMLButtonElement>('#map-delete');
function resetDelete() {
  delBtn.dataset.confirm = '';
  delBtn.textContent = 'Excluir';
}
delBtn.addEventListener('click', () => {
  const l = selectedMap();
  if (!l) return;
  if (!delBtn.dataset.confirm) {
    delBtn.dataset.confirm = '1';
    delBtn.textContent = 'Confirmar?';
    return;
  }
  deleteMap(l.name);
  refreshMapList();
  mapMsg(`Mapa "${l.name}" excluído.`);
});
mapList.addEventListener('change', resetDelete);

$<HTMLInputElement>('#map-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) importJson(await file.text());
  input.value = '';
});
$('#map-paste-load').addEventListener('click', () => importJson(mapJson.value));
$('#map-copy').addEventListener('click', async () => {
  if (!mapJson.value.trim()) mapJson.value = toJson({ ...layout, name: mapName ?? `Mapa ${world.size}×${world.size}` });
  try {
    await navigator.clipboard.writeText(mapJson.value);
    mapMsg('JSON copiado.');
  } catch {
    mapJson.select();
    mapMsg('Não deu para copiar automaticamente. O texto está selecionado: use Ctrl+C.');
  }
});

// ---------- Agente genético: pesos e treino ----------

const gaMsg = (text: string) => ($('#ga-msg').textContent = text);
let worker: Worker | null = null;
let history: GenerationReport[] = [];
let finalReport: GenerationReport | null = null; // vencedor da validação final

function renderWeights() {
  const g = genome ?? DEFAULT_GENOME;
  $('#ga-source').textContent = genome ? 'treinados por você' : 'padrão (pré-treinado)';
  $<HTMLButtonElement>('#ga-reset').disabled = !genome;
  $('#ga-weights').innerHTML = '';
  GENES.forEach((gene, i) => {
    const row = document.createElement('div');
    row.className = 'weight';
    row.title = gene.description;
    const pct = (Math.abs(g[i]) / 5) * 50;
    row.innerHTML = `<span></span><div class="bar"><i class="${g[i] >= 0 ? 'pos' : 'neg'}" style="width:${pct}%"></i></div><b></b>`;
    row.querySelector('span')!.textContent = gene.name;
    row.querySelector('b')!.textContent = g[i].toFixed(1);
    $('#ga-weights').append(row);
  });
}

function drawChart() {
  const canvas = $<HTMLCanvasElement>('#ga-chart');
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  canvas.hidden = history.length === 0;
  if (!history.length) return;
  const values = history.flatMap((r) => [r.best, r.average]);
  const lo = Math.min(...values);
  const hi = Math.max(...values, lo + 1);
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const x = (i: number) => pad.l + (history.length === 1 ? 0 : (i / (history.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(238,230,216,0.6)';
  ctx.strokeStyle = 'rgba(238,230,216,0.15)';
  ctx.lineWidth = 1;
  for (const v of [lo, (lo + hi) / 2, hi]) {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(v));
    ctx.lineTo(w - pad.r, y(v));
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), 4, y(v) + 6);
  }
  ctx.fillText(`geração ${history.length}`, w - 150, h - 4);
  const line = (key: 'best' | 'average', color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    history.forEach((r, i) => (i ? ctx.lineTo(x(i), y(r[key])) : ctx.moveTo(x(i), y(r[key]))));
    ctx.stroke();
  };
  line('average', '#8a7a66');
  line('best', '#ffcc33');
}

function setTraining(on: boolean) {
  $('#ga-train').textContent = on ? 'Parar treino' : 'Treinar';
  for (const id of ['#ga-gens', '#ga-pop', '#ga-maps', '#ga-on-map']) $<HTMLInputElement>(id).disabled = on;
}

function finishTraining(stopped: boolean) {
  worker?.terminate();
  worker = null;
  setTraining(false);
  const last = finalReport ?? history.at(-1);
  if (!last) return gaMsg('Treino parado antes da primeira geração.');
  genome = last.bestGenome;
  saveGenome(genome);
  renderWeights();
  gaMsg(
    `${stopped ? 'Treino parado' : 'Treino concluído'} na geração ${last.generation}. ` +
      (last.validated
        ? `O vencedor da validação fez ${Math.round(last.best)} pontos por partida em mapas novos. `
        : `Melhor aptidão: ${Math.round(last.best)} pontos por partida. `) +
      'Os novos pesos já estão em uso.',
  );
  if (playerId === 'genetic') restart(false);
}

$('#ga-train').addEventListener('click', () => {
  if (worker) return finishTraining(true);
  const num = (id: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number($<HTMLInputElement>(id).value) || min)));
  const onMap = $<HTMLInputElement>('#ga-on-map').checked;
  const options = {
    size: world.size,
    pitProbability: world.pitProbability,
    generations: num('#ga-gens', 1, 200),
    population: num('#ga-pop', 6, 100),
    mapsPerGeneration: num('#ga-maps', 1, 200),
    layout: onMap ? layout : null,
    seed: genome ?? DEFAULT_GENOME,
  };
  history = [];
  finalReport = null;
  drawChart();
  setTraining(true);
  gaMsg(`Treinando em ${onMap ? 'um só mapa (o atual)' : `mapas ${options.size}×${options.size} sorteados`}... a primeira geração pode levar alguns segundos.`);
  worker = new GAWorker();
  worker.onmessage = (e) => {
    if (e.data.type === 'done') return finishTraining(false);
    const r: GenerationReport = e.data.report;
    if (r.validated) {
      finalReport = r;
      return;
    }
    history.push(r);
    drawChart();
    gaMsg(
      `Geração ${r.generation} de ${options.generations}: melhor ${Math.round(r.best)}, média ${Math.round(r.average)} pontos.` +
        (r.generation === options.generations && !onMap ? ' Validando os 5 melhores em mapas novos...' : ''),
    );
  };
  worker.onerror = () => {
    finishTraining(true);
    gaMsg('O treino falhou neste navegador.');
  };
  worker.postMessage(options);
});

$('#ga-reset').addEventListener('click', () => {
  genome = null;
  saveGenome(null);
  renderWeights();
  gaMsg('Voltou aos pesos padrão.');
  if (playerId === 'genetic') restart(false);
});

// ---------- Avaliação ----------

let benchmarking = false;
let lastReport: Report | null = null;
$('#btn-bench').addEventListener('click', async () => {
  const id = cfg.agent.value;
  if (id === 'human' || benchmarking) return;
  benchmarking = true;
  const onMap = $<HTMLInputElement>('#bench-on-map').checked;
  const games = Math.min(1000, Math.max(1, Math.round(Number($<HTMLInputElement>('#bench-games').value) || 100)));
  const seed = $<HTMLInputElement>('#bench-seed').value.trim() || 'avaliacao';
  const out = $('#bench-out');
  // Semente fixa: avaliar outro agente com a mesma semente e quantidade repete exatamente os mesmos mapas
  const maps = onMap ? Array.from({ length: games }, () => layout) : arenaMaps(seed, games, world.size, world.pitProbability);
  const ctrl = makeController(id, false);
  const results: EpisodeResult[] = [];
  for (const m of maps) {
    results.push(await playEpisode(ctrl, m, 3000));
    if (results.length % 10 === 0) {
      out.textContent = `Jogando: ${results.length} de ${games} partidas...`;
      await new Promise((r) => setTimeout(r));
    }
  }
  ctrl.dispose?.();
  const name = id === 'genetic' && genome ? `${playerInfo(id).label} (pesos treinados)` : playerInfo(id).label;
  const r = aggregate(name, '', results);
  const deaths = r.deathsPit + r.deathsWumpus;
  out.textContent =
    `${r.name} ${onMap ? `no mapa "${mapName ?? 'atual'}"` : `em mapas ${world.size}×${world.size} sorteados`}: ` +
    `${r.wins} vitórias, ${deaths} mortes${r.timeouts ? `, ${r.timeouts} por tempo esgotado` : ''}${r.errors ? `, ${r.errors} erros (${r.firstError})` : ''}. ` +
    `Pontuação média: ${Math.round(r.avgScore)}.`;
  lastReport = buildReport({
    title: `${name} em ${games} partidas`,
    origin: 'avaliacao',
    config: {
      size: world.size,
      pitProbability: onMap ? layout.pitProbability : world.pitProbability,
      maps: games,
      seed: onMap ? `mapa "${mapName ?? 'atual'}"` : seed,
    },
    agents: [{ name, author: id.startsWith('ext:') ? (externalById(id.slice(4))?.author ?? '') : 'Wumpus 3D', results }],
  });
  $('#bench-actions').hidden = false;
  benchmarking = false;
});
$('#bench-html').addEventListener('click', () => {
  if (lastReport && !exportReportHtml(lastReport)) $('#bench-out').textContent = 'O navegador bloqueou o download. Use "Abrir na análise".';
});
$('#bench-json').addEventListener('click', () => {
  if (lastReport && !exportReportJson(lastReport)) $('#bench-out').textContent = 'O navegador bloqueou o download. Use "Abrir na análise".';
});
$('#bench-analysis').addEventListener('click', () => lastReport && addReportToAnalysis(lastReport));
$('#open-analysis').addEventListener('click', openAnalysis);
initAnalysis();

// ---------- Arena ----------

initArena({
  genome: () => genome ?? DEFAULT_GENOME,
  trainedGenome: () => genome !== null,
  savedMaps: loadSavedMaps,
  onAgentsChanged: () => {
    const before = cfg.agent.value;
    refreshPlayerOptions();
    if (cfg.agent.value !== before) {
      updateSetup();
      restart(false);
    }
  },
  onWatch: (id) => {
    refreshPlayerOptions();
    cfg.agent.value = id;
    updateSetup();
    restart(false);
    setSetupOpen(true);
  },
});
$('#open-arena').addEventListener('click', openArena);

// Painel aberto em telas largas, fechado no celular
setSetupOpen(window.innerWidth > 760);

refreshPlayerOptions();
updateSetup();
updatePitHint();
refreshMapList();
renderWeights();
drawChart();
restart();

view.renderer.setAnimationLoop((now) => {
  if (playing && controller && !world.gameOver && now - lastStep >= 1000 / Number(cfg.speed.value)) {
    lastStep = now;
    agentStep();
  }
  view.frame();
});

// Para depuração no console do navegador
Object.assign(window, { wumpus: { get world() { return world; } } });
