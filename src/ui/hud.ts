// Informações sobre o mapa 3D: pontuação, percepções, pensamento do agente, registro de eventos e fim de jogo.
import { DIR_NAME, SCORE, parseKey, type Status, type WumpusWorld } from '../game/world';
import type { CellBelief } from '../agents/knowledge';
import { $ } from './dom';
import { playerInfo } from './players';
import { cfg, isHuman, match } from './state';

const LOG_SIZE = 6;

const TITLES: Record<Status, string> = {
  won: 'Vitória!',
  'dead-pit': 'Caiu no poço',
  'dead-wumpus': 'Devorado pelo Wumpus',
  timeout: 'Tempo esgotado',
  playing: '',
};

const KEYS_HELP = {
  agent: 'Espaço jogar/pausar · N um passo · T parar e reiniciar · V câmera · M mapa · R novo mapa · C configurar',
  human: 'W/↑ andar · A D girar · Espaço atirar · G pegar · T reiniciar · V câmera · M mapa · R novo mapa · C configurar',
};

/** Acrescenta uma linha no topo do registro de eventos (guarda só as últimas). */
export function log(msg: string) {
  const li = document.createElement('li');
  li.textContent = msg;
  const list = $('#log');
  list.prepend(li);
  while (list.children.length > LOG_SIZE) list.lastChild!.remove();
}

export const clearLog = () => ($('#log').innerHTML = '');

/** Só as salas que interessam: fronteira do que já foi explorado e onde o Wumpus pode estar. */
export function visibleBeliefs(): Map<string, CellBelief> | null {
  const all = match.decision?.beliefs;
  if (!match.controller || !cfg.beliefs.checked || !all) return null;
  const world = match.world;
  const nearVisited = (k: string) => {
    const [x, y] = parseKey(k);
    return world.neighbors(x, y).some((n) => world.isVisited(n.x, n.y));
  };
  const wumpusSpots = [...all.values()].filter((b) => b.wumpus > 0).length;
  return new Map([...all].filter(([k, b]) => nearVisited(k) || (b.wumpus > 0 && wumpusSpots <= 3)));
}

export function updateHud() {
  const world = match.world;
  updateStatus(world);
  updatePercepts(world);
  updateControls(world);
  updateThought();
  $('#map-current').textContent = `${match.mapName ?? 'sorteado'} (${world.size}×${world.size})`;
  updateGameOver(world);
}

function updateStatus(world: WumpusWorld) {
  const p = world.percepts;
  $('#score').textContent = String(world.score);
  $('#pos').textContent = `(${world.agent.x + 1}, ${world.agent.y + 1}) · ${DIR_NAME[world.agent.dir]}`;
  $('#arrow').textContent = world.hasArrow ? '1' : '0';
  $('#gold').textContent = world.hasGold ? 'Sim' : 'Não';
  $('#goal').textContent = world.hasGold ? 'Volte para (1, 1) para vencer' : p.glitter ? 'O ouro está aqui! Pegue (G)' : 'Encontre o ouro';
  document.querySelector('[data-action="grab"]')!.classList.toggle('highlight', p.glitter && !world.gameOver);
}

function updatePercepts(world: WumpusWorld) {
  for (const [name, on] of Object.entries(world.percepts)) $(`#p-${name}`).classList.toggle('on', on);
}

/** Botões de jogar (agente) ou de ações (você), e a ajuda do teclado. */
function updateControls(world: WumpusWorld) {
  const isAgent = !isHuman();
  document.querySelectorAll<HTMLElement>('.row.manual').forEach((r) => (r.hidden = isAgent));
  $('#agent-controls').hidden = !isAgent;
  $('#btn-play').textContent = match.playing ? '⏸ Pausar' : '▶ Jogar';
  $<HTMLButtonElement>('#btn-play').disabled = world.gameOver;
  $<HTMLButtonElement>('#btn-step').disabled = world.gameOver;
  $('#keys').textContent = isAgent ? KEYS_HELP.agent : KEYS_HELP.human;
}

function updateThought() {
  const thought = $('#thought');
  const text = match.decision?.thought;
  thought.hidden = !text;
  thought.textContent = text ? `${playerInfo(match.playerId).label}: ${text}` : '';
}

function gameOverText(world: WumpusWorld) {
  const texts: Record<Status, string> = {
    won: `Pegou o ouro (+${SCORE.gold}) e voltou vivo à entrada (+${SCORE.escape}).`,
    'dead-pit': 'Cuidado com as salas onde você sente brisa.',
    'dead-wumpus': 'Fedor indica que o Wumpus está em uma sala vizinha.',
    timeout: `A partida passou de ${world.maxActions} ações sem terminar.`,
    playing: '',
  };
  // O Wumpus só morre pela flecha, então "não está vivo" = o jogador ganhou o bônus
  const kill = world.wumpusAlive ? '' : `\nMatou o Wumpus com a flecha (+${SCORE.wumpusKill}).`;
  return texts[world.status] + kill;
}

function updateGameOver(world: WumpusWorld) {
  const over = $('#gameover');
  over.hidden = !world.gameOver;
  if (!world.gameOver) return;
  over.dataset.status = world.status;
  $('#go-title').textContent = TITLES[world.status];
  $('#go-text').textContent = gameOverText(world);
  $('#go-score').textContent = `Pontuação final: ${world.score}`;
}
