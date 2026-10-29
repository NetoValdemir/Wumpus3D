// Partidas de jogadores humanos: registro, desafio por semente e relatórios (D20).
// Sem DOM: quem guarda no navegador é storage.ts e quem liga na tela é main.ts.
import type { MapLayout } from '../game/world';
import { arenaMaps } from '../arena/rng';
import { builtinController, playEpisode, type EpisodeResult, type Outcome } from '../arena/runner';
import { AGENTS } from '../agents/agents';
import { buildReport, type Report } from './report';

/** Uma partida humana terminada. Guarda o mapa para os agentes poderem jogar exatamente o mesmo. */
export interface HumanGame {
  date: string; // data e hora ISO do fim da partida
  player: string;
  layout: MapLayout;
  /** Partida de um desafio: mesma semente = mesmos mapas, na mesma ordem, para todos os jogadores */
  challenge: { seed: string; index: number } | null;
  outcome: Outcome;
  score: number;
  actions: number;
  gold: boolean;
  killed: boolean;
  shots: number;
  bumps: number;
  logicErrors: number;
  needlessRisks: number;
  ms: number; // tempo total da partida
  revealed: boolean; // o jogador abriu o mapa (tecla M) durante a partida
}

/** Identidade do mapa (sem o nome): mesmo tamanho, poços, Wumpus e ouro. */
export const layoutKey = (l: MapLayout) =>
  JSON.stringify([l.size, l.pits.map((p) => p.join(',')).sort(), l.wumpus, l.gold]);

/** Mapa nº `index` (começa em 0) de um desafio. É o mesmo mapa que a Arena sortearia com essa semente. */
export function challengeMap(seed: string, index: number, size: number, pitProbability: number): MapLayout {
  const map = arenaMaps(`desafio-${seed}`, index + 1, size, pitProbability)[index];
  return { ...map, name: `Desafio "${seed}" nº ${index + 1}` };
}

/** Próximo mapa de um desafio para este jogador: depois do último que ele já terminou. */
export function nextChallengeIndex(games: HumanGame[], player: string, seed: string, size: number, pitProbability: number) {
  const done = games.filter(
    (g) => g.player === player && g.challenge?.seed === seed && g.layout.size === size && g.layout.pitProbability === pitProbability,
  );
  return done.length ? Math.max(...done.map((g) => g.challenge!.index)) + 1 : 0;
}

/**
 * Partidas que entram nos relatórios: só a primeira vez que o jogador terminou cada mapa,
 * e só se ele não abriu o mapa. Repetir um mapa já conhecido, ou espiar, não seria justo
 * com os agentes nem com os outros jogadores.
 */
export function countedGames(games: HumanGame[], player: string) {
  const seen = new Set<string>();
  return games.filter((g) => {
    if (g.player !== player || g.revealed) return false;
    const k = layoutKey(g.layout);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const toResult = (g: HumanGame): EpisodeResult => ({
  outcome: g.outcome,
  score: g.score,
  actions: g.actions,
  decisionMs: g.ms,
  logicErrors: g.logicErrors,
  needlessRisks: g.needlessRisks,
  bumps: g.bumps,
  shots: g.shots,
  hits: g.killed ? 1 : 0,
  gold: g.gold,
});

/** Número do mapa no relatório: a posição no desafio (para alinhar jogadores) ou a ordem das partidas. */
const mapNumbers = (games: HumanGame[]) => games.map((g, i) => (g.challenge ? g.challenge.index + 1 : i + 1));

function configOf(games: HumanGame[]) {
  const sizes = new Set(games.map((g) => g.layout.size));
  const pits = new Set(games.map((g) => g.layout.pitProbability));
  const seeds = new Set(games.map((g) => g.challenge?.seed ?? ''));
  const size = sizes.size === 1 ? [...sizes][0] : null;
  const pitProbability = pits.size === 1 ? [...pits][0] : null;
  const seed = seeds.size === 1 && [...seeds][0] ? `desafio "${[...seeds][0]}"` : 'partidas do jogador';
  return { size, pitProbability, maps: games.length, seed };
}

/** Relatório das partidas de um jogador (as que contam: veja countedGames). */
export function humanReport(games: HumanGame[], player: string): Report {
  const counted = countedGames(games, player);
  return buildReport({
    title: `${player}: ${counted.length} ${counted.length === 1 ? 'partida' : 'partidas'}`,
    origin: 'jogador',
    config: configOf(counted),
    agents: [{ name: player, author: 'jogador humano', results: counted.map(toResult), maps: mapNumbers(counted) }],
  });
}

/**
 * O jogador e os agentes nos mesmos mapas: os agentes jogam cada mapa que o jogador terminou.
 * A comparação fica pareada, como na Arena.
 */
export async function compareWithAgents(games: HumanGame[], player: string, genome: number[]): Promise<Report> {
  const counted = countedGames(games, player);
  const agents: { name: string; author: string; results: EpisodeResult[]; maps: number[] }[] = [
    { name: player, author: 'jogador humano', results: counted.map(toResult), maps: mapNumbers(counted) },
  ];
  for (const id of ['bayes', 'logic', 'genetic'] as const) {
    const ctrl = builtinController(id, { genome });
    const results: EpisodeResult[] = [];
    for (const g of counted) results.push(await playEpisode(ctrl, g.layout, 3000));
    agents.push({ name: AGENTS[id].label, author: 'Wumpus 3D', results, maps: mapNumbers(counted) });
  }
  return buildReport({
    title: `${player} × agentes em ${counted.length} ${counted.length === 1 ? 'mapa' : 'mapas'}`,
    origin: 'jogador',
    config: configOf(counted),
    agents,
  });
}

/** Resumo curto para o painel. */
export function humanSummary(games: HumanGame[], player: string) {
  const mine = games.filter((g) => g.player === player);
  const counted = countedGames(games, player);
  const wins = counted.filter((g) => g.outcome === 'won').length;
  const deaths = counted.filter((g) => g.outcome === 'dead-pit' || g.outcome === 'dead-wumpus').length;
  const avg = counted.length ? counted.reduce((s, g) => s + g.score, 0) / counted.length : 0;
  return { total: mine.length, counted: counted.length, wins, deaths, avg, ignored: mine.length - counted.length };
}

