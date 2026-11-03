// Controle da partida no 3D: começar, jogar (você ou um agente), pausar, câmera e painel.
import { WumpusWorld, pitCountFor, type Action, type MapLayout } from '../game/world';
import { infoOf, publicSensesOf } from '../arena/protocol';
import { WorldView } from '../render/view';
import { $ } from './dom';
import { clearLog, log, updateHud, visibleBeliefs } from './hud';
import { challengeSeed, judgeAction, markRevealed, nextChallenge, observeAction, recordIfFinished, startTracking, updateHumanPanel } from './human-panel';
import { makeController, playerInfo } from './players';
import { cfg, isHuman, match } from './state';

export const view = new WorldView($('#scene'));

/** Redesenha o que depende do estado: cena, crenças do agente e painel de informações. */
function refresh() {
  view.sync();
  view.showBeliefs(visibleBeliefs());
  updateHud();
}

/** Executa uma ação (sua ou do agente) e mostra o resultado. */
export function act(action: Action) {
  const world = match.world;
  judgeAction(world, action);
  const result = world.step(action);
  observeAction(world, action);
  if (result.arrow) view.shootArrow(result.arrow.from, result.arrow.to);
  log(result.message);
  recordIfFinished(world);
  if (world.gameOver) match.playing = false;
  refresh();
}

/** Pede uma decisão ao agente e a executa. Respostas de uma partida que já acabou são ignoradas. */
export async function agentStep() {
  const { controller, world } = match;
  if (!controller || world.gameOver || match.stepping) return;
  const game = match.game;
  const current = () => game === match.game;
  match.stepping = true;
  try {
    await match.ready;
    if (!current() || match.world.gameOver) return;
    const d = await controller.decide(publicSensesOf(match.world));
    if (!current()) return;
    match.decision = d;
    act(d.action);
  } catch (err) {
    if (!current()) return;
    match.playing = false;
    log(`Erro do agente: ${(err as Error)?.message ?? err}`);
    updateHud();
  } finally {
    if (current()) match.stepping = false;
  }
}

/** Escolhe o mapa da partida: o próximo do desafio, um sorteado ou o mesmo de antes. */
function chooseMap(newMap: boolean) {
  const size = Number(cfg.size.value);
  const pits = Number(cfg.pits.value);
  const seed = challengeSeed();
  if (isHuman() && seed && (newMap || !match.layout)) {
    const next = nextChallenge(seed, size, pits);
    match.layout = next.layout;
    match.mapName = next.layout.name;
    match.challenge = next.challenge;
    match.world = WumpusWorld.fromLayout(next.layout);
  } else if (newMap || !match.layout) {
    match.world = new WumpusWorld(size, pits);
    match.layout = match.world.toLayout('Mapa sorteado');
    match.mapName = null;
    match.challenge = null;
  } else {
    match.world = WumpusWorld.fromLayout(match.layout);
  }
}

/** Prepara o agente da partida; um erro ao começar aparece no primeiro passo dele. */
function startController() {
  match.controller = isHuman() ? null : makeController(match.playerId, true);
  const c = match.controller;
  if (!c) return;
  match.ready = Promise.resolve().then(() => c.start(infoOf(match.world)));
  match.ready.catch(() => {});
}

function welcomeMessage() {
  if (match.controller) return `${playerInfo(match.playerId).label} entrou na caverna. Aperte ▶ Jogar.`;
  if (match.challenge) return `Desafio "${match.challenge.seed}", mapa nº ${match.challenge.index + 1}. Encontre o ouro e volte vivo!`;
  return 'Você entrou na caverna. Encontre o ouro e volte vivo!';
}

/** Começa uma partida. `newMap` sorteia outro mapa; senão repete o atual (útil para trocar de jogador). */
export function restart(newMap = true) {
  match.playerId = cfg.agent.value;
  match.game++;
  match.stepping = false;
  match.decision = null;
  match.controller?.dispose?.();
  chooseMap(newMap);
  startTracking(match.world, isHuman(), view.revealAll);
  startController();
  match.playing = false;
  view.load(match.world);
  view.showBeliefs(visibleBeliefs());
  clearLog();
  log(welcomeMessage());
  updateHud();
  if (isHuman()) updateHumanPanel();
}

/** Para o agente (se estiver jogando) e volta ao início, no mesmo mapa. */
export function resetSameMap() {
  const wasPlaying = match.playing;
  restart(false);
  log(wasPlaying ? 'Agente parado. A partida voltou ao início, no mesmo mapa.' : 'Partida reiniciada no mesmo mapa.');
}

/** Joga um mapa salvo ou importado. */
export function playLayout(l: MapLayout) {
  match.challenge = null;
  match.layout = l;
  match.mapName = l.name;
  if ([...cfg.size.options].some((o) => o.value === String(l.size))) cfg.size.value = String(l.size);
  restart(false);
}

export function togglePlay() {
  if (match.world.gameOver) return;
  match.playing = !match.playing;
  match.lastStep = 0;
  updateHud();
}

export function toggleCamera() {
  view.cameraMode = view.cameraMode === 'follow' ? 'overview' : 'follow';
}

/** Abre ou fecha o mapa. Espiar durante a sua partida faz ela não contar no relatório. */
export function toggleReveal() {
  view.revealAll = !view.revealAll;
  if (view.revealAll) markRevealed(match.world);
  view.sync();
}

/** O agente joga sozinho no ritmo escolhido (passos por segundo). Chamado a cada frame. */
export function tick(now: number) {
  if (match.playing && match.controller && !match.world.gameOver && now - match.lastStep >= 1000 / Number(cfg.speed.value)) {
    match.lastStep = now;
    agentStep();
  }
  view.frame();
}

// ---------- Painel de configuração ----------

export const isSetupOpen = () => !$('#setup').hidden;

/** Mostra ou esconde o painel de configuração; o mapa 3D ocupa o espaço liberado. */
export function setSetupOpen(open: boolean) {
  $('#setup').hidden = !open;
  document.body.classList.toggle('setup-open', open);
  const btn = $('#btn-setup');
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('active', open);
}

/** Mostra só as seções do painel que valem para quem joga. */
export function updateSetup() {
  const id = cfg.agent.value;
  $('#agent-desc').textContent = playerInfo(id).description;
  $('#row-speed').hidden = id === 'human';
  $('#row-beliefs').hidden = id === 'human' || id === 'random';
  $('#bench-section').hidden = id === 'human';
  $('#human-section').hidden = id !== 'human';
  $('#ga-section').hidden = id !== 'genetic';
  $('#speed-out').textContent = `${cfg.speed.value} passos/s`;
}

/** Mostra quantos poços a porcentagem escolhida dá no tamanho escolhido. */
export function updatePitHint() {
  const size = Number(cfg.size.value);
  const n = pitCountFor(size, Number(cfg.pits.value));
  $('#cfg-pits-hint').textContent = `${size} × ${size} = ${size * size} casas → ${n} ${n === 1 ? 'poço' : 'poços'} em todo mapa sorteado. Os agentes não sabem esse número.`;
}
