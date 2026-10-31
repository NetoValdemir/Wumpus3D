// Consolida os resultados das partidas em estatísticas por agente e ordena o ranking.
import type { EpisodeResult } from './runner';
import { fixedOrDash, percentOf } from '../util/format';

export interface AgentStats {
  name: string;
  author: string;
  games: number;
  wins: number;
  deathsPit: number;
  deathsWumpus: number;
  timeouts: number; // limite de ações do jogo
  errors: number; // exceções, ações inválidas ou demora para decidir
  avgScore: number;
  avgActionsPerWin: number | null; // eficiência: quantas ações para vencer
  avgDecisionMs: number; // custo computacional por decisão
  logicErrorsPerGame: number; // passos em perigo comprovado
  needlessRisksPerGame: number; // riscos sem necessidade
  bumpsPerGame: number;
  hitRate: number | null; // flechas que acertaram o Wumpus
  firstError?: string;
}

export function aggregate(name: string, author: string, results: EpisodeResult[]): AgentStats {
  const n = results.length || 1;
  const sum = (f: (r: EpisodeResult) => number) => results.reduce((s, r) => s + f(r), 0);
  const count = (outcome: EpisodeResult['outcome']) => results.filter((r) => r.outcome === outcome).length;
  const wins = results.filter((r) => r.outcome === 'won');
  const actions = sum((r) => r.actions);
  const shots = sum((r) => r.shots);
  return {
    name,
    author,
    games: results.length,
    wins: wins.length,
    deathsPit: count('dead-pit'),
    deathsWumpus: count('dead-wumpus'),
    timeouts: count('timeout'),
    errors: count('error'),
    avgScore: sum((r) => r.score) / n,
    avgActionsPerWin: wins.length ? wins.reduce((s, r) => s + r.actions, 0) / wins.length : null,
    avgDecisionMs: actions ? sum((r) => r.decisionMs) / actions : 0,
    logicErrorsPerGame: sum((r) => r.logicErrors) / n,
    needlessRisksPerGame: sum((r) => r.needlessRisks) / n,
    bumpsPerGame: sum((r) => r.bumps) / n,
    hitRate: shots ? sum((r) => r.hits) / shots : null,
    firstError: results.find((r) => r.error)?.error,
  };
}

/** Critério do ranking: pontuação média; empate decidido por vitórias e depois por menos erros de lógica. */
export function rank(stats: AgentStats[]) {
  return [...stats].sort(
    (a, b) => b.avgScore - a.avgScore || b.wins - a.wins || a.logicErrorsPerGame - b.logicErrorsPerGame,
  );
}

/** As colunas da tabela do ranking que são iguais no Markdown e na tela da Arena. */
export const rankingCells = (s: AgentStats) => ({
  score: String(Math.round(s.avgScore)),
  wins: percentOf(s.wins, s.games),
  deaths: percentOf(s.deathsPit + s.deathsWumpus, s.games),
  timeouts: percentOf(s.timeouts, s.games),
  errors: percentOf(s.errors, s.games),
  actionsPerWin: fixedOrDash(s.avgActionsPerWin),
  msPerDecision: fixedOrDash(s.avgDecisionMs, 2),
  logicErrors: fixedOrDash(s.logicErrorsPerGame, 2),
  needlessRisks: fixedOrDash(s.needlessRisksPerGame, 2),
  hitRate: s.hitRate === null ? '—' : percentOf(s.hitRate, 1),
});

export interface ArenaMeta {
  seed: string;
  maps: number;
  size: number;
  pitProbability: number;
  date: string;
}

export function toMarkdown(ranked: AgentStats[], meta: ArenaMeta) {
  const lines = [
    `## Ranking da Arena Wumpus 3D`,
    ``,
    `${meta.maps} mapas ${meta.size}×${meta.size}, ${Math.round(meta.pitProbability * 100)}% de poços, semente \`${meta.seed}\` (${meta.date}).`,
    ``,
    `| # | Agente | Autor | Pontos (média) | Vitórias | Mortes | Erros | Ações/vitória | ms/decisão | Erros de lógica/partida | Riscos desnecessários/partida | Tiros certeiros |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ];
  ranked.forEach((s, i) => {
    const c = rankingCells(s);
    const cells = [i + 1, s.name, s.author, c.score, c.wins, c.deaths, c.errors, c.actionsPerWin, c.msPerDecision, c.logicErrors, c.needlessRisks, c.hitRate];
    lines.push(`| ${cells.join(' | ')} |`);
  });
  return lines.join('\n');
}
