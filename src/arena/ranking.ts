// Consolida os resultados das partidas em estatísticas por agente e ordena o ranking.
import type { EpisodeResult } from './runner';

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
  const wins = results.filter((r) => r.outcome === 'won');
  const actions = sum((r) => r.actions);
  const shots = sum((r) => r.shots);
  return {
    name,
    author,
    games: results.length,
    wins: wins.length,
    deathsPit: results.filter((r) => r.outcome === 'dead-pit').length,
    deathsWumpus: results.filter((r) => r.outcome === 'dead-wumpus').length,
    timeouts: results.filter((r) => r.outcome === 'timeout').length,
    errors: results.filter((r) => r.outcome === 'error').length,
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

const pct = (v: number, n: number) => `${n ? Math.round((100 * v) / n) : 0}%`;
const num = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits));

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
    lines.push(
      `| ${i + 1} | ${s.name} | ${s.author} | ${Math.round(s.avgScore)} | ${pct(s.wins, s.games)} | ${pct(s.deathsPit + s.deathsWumpus, s.games)} | ${pct(s.errors, s.games)} | ${num(s.avgActionsPerWin)} | ${num(s.avgDecisionMs, 2)} | ${num(s.logicErrorsPerGame, 2)} | ${num(s.needlessRisksPerGame, 2)} | ${s.hitRate === null ? '—' : pct(s.hitRate, 1)} |`,
    );
  });
  return lines.join('\n');
}
