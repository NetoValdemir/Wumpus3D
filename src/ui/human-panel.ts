// "Minhas partidas" (D20): o mesmo árbitro da Arena acompanha a partida do jogador, para medir erros
// de lógica e riscos; a partida terminada é registrada e pode ser comparada com os agentes.
import type { Action, MapLayout, WumpusWorld } from '../game/world';
import { Referee } from '../arena/referee';
import { challengeMap, compareWithAgents, humanReport, humanSummary, nextChallengeIndex, type HumanGame } from '../report/human';
import { addReportToAnalysis, exportReportHtml, exportReportJson } from '../report/ui';
import { clearHumanGames, loadHumanGames, loadPlayerName, saveHumanGame, savePlayerName } from '../storage';
import { $, confirmTwice, nextFrame } from './dom';
import { log } from './hud';
import { currentGenome, match } from './state';

/** Acompanhamento da partida humana em andamento (null quando quem joga é um agente). */
let tracking: { referee: Referee; startedAt: number; revealed: boolean; recorded: boolean } | null = null;

export const playerName = () => $<HTMLInputElement>('#human-name').value.trim() || 'Jogador';
export const challengeSeed = () => $<HTMLInputElement>('#human-seed').value.trim();

/** Próximo mapa do desafio (só avança depois de terminar o atual, então não dá para pular). */
export function nextChallenge(seed: string, size: number, pits: number): { layout: MapLayout; challenge: { seed: string; index: number } } {
  const index = nextChallengeIndex(loadHumanGames(), playerName(), seed, size, pits);
  return { layout: challengeMap(seed, index, size, pits), challenge: { seed, index } };
}

/** Começa a acompanhar uma partida. `revealed`: o mapa já estava aberto (a partida não conta). */
export function startTracking(world: WumpusWorld, human: boolean, revealed: boolean) {
  tracking = human ? { referee: new Referee(world), startedAt: performance.now(), revealed, recorded: false } : null;
}

/** Antes da ação: o árbitro julga a jogada. */
export const judgeAction = (world: WumpusWorld, action: Action) => tracking?.referee.judge(world, action);

/** Depois da ação: o árbitro vê as novas percepções. */
export const observeAction = (world: WumpusWorld, action: Action) => tracking?.referee.observe(world, action === 'shoot');

/** No fim do jogo, registra a partida (uma vez só). */
export function recordIfFinished(world: WumpusWorld) {
  if (tracking && world.gameOver && !tracking.recorded) recordGame(world);
}

/** O jogador abriu o mapa durante a partida: ela é registrada, mas não entra no relatório. */
export function markRevealed(world: WumpusWorld) {
  if (tracking && !world.gameOver) tracking.revealed = true;
}

function recordGame(world: WumpusWorld) {
  const t = tracking!;
  t.recorded = true;
  const r = t.referee;
  const game: HumanGame = {
    date: new Date().toISOString(),
    player: playerName(),
    layout: { ...match.layout, name: match.mapName ?? match.layout.name },
    challenge: match.challenge,
    outcome: world.status as HumanGame['outcome'],
    score: world.score,
    actions: world.actions,
    gold: world.hasGold,
    killed: !world.wumpusAlive,
    shots: r.shots,
    bumps: r.bumps,
    logicErrors: r.logicErrors,
    needlessRisks: r.needlessRisks,
    ms: Math.round(performance.now() - t.startedAt),
    revealed: t.revealed,
  };
  const saved = saveHumanGame(game);
  log(
    !saved
      ? 'Não deu para registrar a partida: o navegador bloqueou o armazenamento.'
      : t.revealed
        ? 'Partida registrada (com o mapa aberto: não entra no relatório).'
        : 'Partida registrada em "Minhas partidas".',
  );
  updateHumanPanel();
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function updateHumanPanel() {
  const name = playerName();
  const s = humanSummary(loadHumanGames(), name);
  $('#human-summary').textContent = s.total
    ? `${name}: ${s.counted} ${plural(s.counted, 'partida conta', 'partidas contam')} no relatório (${s.wins} vitórias, ${s.deaths} mortes, média ${Math.round(s.avg)} pts)` +
      (s.ignored ? `; ${s.ignored} não ${plural(s.ignored, 'conta', 'contam')} (mapa repetido ou aberto).` : '.')
    : `Nenhuma partida de ${name} registrada ainda.`;
  const seed = challengeSeed();
  $('#human-challenge').textContent = seed
    ? `Desafio "${seed}": ${match.challenge ? `você está no mapa nº ${match.challenge.index + 1}. ` : ''}Mesma semente, tamanho e porcentagem de poços = mesmos mapas, na mesma ordem, para qualquer jogador. Um mapa só avança depois que você termina o atual.`
    : 'Sem semente, cada "Novo mapa" é sorteado. Com uma semente, você e outros jogadores enfrentam os mesmos mapas, na mesma ordem.';
  for (const id of ['#human-html', '#human-json', '#human-analysis', '#human-compare']) $<HTMLButtonElement>(id).disabled = !s.counted;
}

/** Liga os campos e botões da seção. `restart` começa uma partida com um mapa novo. */
export function initHumanPanel(restart: () => void) {
  const say = (text: string) => ($('#human-summary').textContent = text);
  const report = () => humanReport(loadHumanGames(), playerName());
  const blocked = 'O navegador bloqueou o download. Use "Abrir na análise".';

  $<HTMLInputElement>('#human-name').value = loadPlayerName();
  $('#human-name').addEventListener('change', () => {
    savePlayerName($<HTMLInputElement>('#human-name').value.trim());
    if (challengeSeed()) restart(); // o progresso no desafio é de cada jogador
    updateHumanPanel();
  });
  $('#human-seed').addEventListener('change', () => {
    restart();
    updateHumanPanel();
  });
  $('#human-html').addEventListener('click', () => exportReportHtml(report()) || say(blocked));
  $('#human-json').addEventListener('click', () => exportReportJson(report()) || say(blocked));
  $('#human-analysis').addEventListener('click', () => addReportToAnalysis(report()));
  $('#human-compare').addEventListener('click', async () => {
    say('Os agentes estão jogando os seus mapas...');
    await nextFrame();
    addReportToAnalysis(await compareWithAgents(loadHumanGames(), playerName(), currentGenome()));
    updateHumanPanel();
  });
  confirmTwice($<HTMLButtonElement>('#human-clear'), {
    confirmLabel: () => `Confirmar: apagar as partidas de ${playerName()}?`,
    onConfirm: () => {
      clearHumanGames(playerName());
      updateHumanPanel();
    },
  });
}
