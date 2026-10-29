// Relatório de desempenho: as partidas de um ou mais agentes, para exportar e comparar depois.
// Sem DOM: o mesmo código monta relatórios no navegador (Avaliação, Arena) e na linha de comando.
import type { EpisodeResult, Outcome } from '../arena/runner';
import { aggregate, type AgentStats } from '../arena/ranking';
import { pitCountFor } from '../game/world';

export const REPORT_FORMAT = 'wumpus3d-relatorio';

/** Uma partida, já sem os detalhes do mapa. */
export interface GameRow {
  map: number; // número do mapa (1, 2, 3...): na Arena todos os agentes jogam o mesmo mapa n
  outcome: Outcome;
  score: number;
  actions: number;
  gold: boolean; // pegou o ouro
  killed: boolean; // matou o Wumpus
  shots: number;
  bumps: number;
  logicErrors: number;
  needlessRisks: number;
  ms: number; // tempo total de decisão
}

export interface ReportAgent {
  name: string;
  author: string;
  stats: AgentStats;
  games: GameRow[];
}

export interface ReportConfig {
  size: number | null; // null quando os mapas têm tamanhos diferentes
  pitProbability: number | null;
  pitCount: number | null;
  maps: number;
  seed: string; // semente dos mapas, ou a origem deles ("mapa atual", "mapas salvos")
}

export interface Report {
  format: typeof REPORT_FORMAT;
  version: 1;
  title: string;
  created: string; // data e hora ISO
  origin: 'avaliacao' | 'arena' | 'linha-de-comando';
  config: ReportConfig;
  agents: ReportAgent[];
  /** Nome do arquivo de onde veio (preenchido ao importar) */
  source?: string;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  won: 'Vitória',
  'dead-pit': 'Caiu no poço',
  'dead-wumpus': 'Devorado pelo Wumpus',
  timeout: 'Tempo esgotado',
  error: 'Erro do agente',
};

export const toRow = (r: EpisodeResult, map: number): GameRow => ({
  map,
  outcome: r.outcome,
  score: r.score,
  actions: r.actions,
  gold: r.gold,
  killed: r.hits > 0,
  shots: r.shots,
  bumps: r.bumps,
  logicErrors: r.logicErrors,
  needlessRisks: r.needlessRisks,
  ms: Math.round(r.decisionMs * 100) / 100,
});

export function buildReport(opts: {
  title: string;
  origin: Report['origin'];
  config: Omit<ReportConfig, 'pitCount'>;
  agents: { name: string; author: string; results: EpisodeResult[] }[];
}): Report {
  const { size, pitProbability } = opts.config;
  return {
    format: REPORT_FORMAT,
    version: 1,
    title: opts.title,
    created: new Date().toISOString(),
    origin: opts.origin,
    config: { ...opts.config, pitCount: size && pitProbability !== null ? pitCountFor(size, pitProbability) : null },
    agents: opts.agents.map((a) => ({
      name: a.name,
      author: a.author,
      stats: aggregate(a.name, a.author, a.results),
      games: a.results.map((r, i) => toRow(r, i + 1)),
    })),
  };
}

/** Taxas e médias que aparecem nas tabelas e no resumo. */
export function summary(a: ReportAgent) {
  const g = a.games;
  const n = g.length || 1;
  const count = (f: (r: GameRow) => boolean) => g.filter(f).length;
  return {
    games: g.length,
    avgScore: g.reduce((s, r) => s + r.score, 0) / n,
    wins: count((r) => r.outcome === 'won'),
    deathsPit: count((r) => r.outcome === 'dead-pit'),
    deathsWumpus: count((r) => r.outcome === 'dead-wumpus'),
    timeouts: count((r) => r.outcome === 'timeout'),
    errors: count((r) => r.outcome === 'error'),
    gold: count((r) => r.gold),
    killed: count((r) => r.killed),
    avgActions: g.reduce((s, r) => s + r.actions, 0) / n,
    avgActionsPerWin: a.stats.avgActionsPerWin,
    logicErrorsPerGame: a.stats.logicErrorsPerGame,
    needlessRisksPerGame: a.stats.needlessRisksPerGame,
  };
}

/** Lê um relatório exportado: o JSON puro ou o HTML (que leva o JSON dentro). */
export function parseReport(text: string, source = ''): Report {
  let json = text.trim();
  if (json.startsWith('<')) {
    const m = json.match(/<script type="application\/json" id="wumpus3d-relatorio">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('Este HTML não é um relatório do Wumpus 3D (não tem os dados embutidos).');
    json = m[1].replace(/<\\\//g, '</');
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const d = data as Partial<Report> & { meta?: { seed: string; maps: number; size: number; pitProbability: number; date: string }; ranking?: AgentStats[] };
  // Exportação antiga da Arena ({ meta, ranking }): só tem os totais, sem as partidas
  if (d.meta && Array.isArray(d.ranking)) {
    return {
      format: REPORT_FORMAT,
      version: 1,
      title: `Arena (${d.meta.seed})`,
      created: d.meta.date,
      origin: 'arena',
      config: { size: d.meta.size, pitProbability: d.meta.pitProbability, pitCount: pitCountFor(d.meta.size, d.meta.pitProbability), maps: d.meta.maps, seed: d.meta.seed },
      agents: d.ranking.map((s) => ({ name: s.name, author: s.author, stats: s, games: [] })),
      source,
    };
  }
  if (d.format !== REPORT_FORMAT || !Array.isArray(d.agents) || !d.config) {
    throw new Error('O arquivo não é um relatório do Wumpus 3D (falta "format": "wumpus3d-relatorio").');
  }
  for (const a of d.agents) {
    if (typeof a?.name !== 'string' || !Array.isArray(a.games) || !a.stats) throw new Error('O relatório tem um agente sem nome, partidas ou estatísticas.');
  }
  return { ...(d as Report), source };
}

/** Média acumulada: o valor do ponto i é a média das partidas 1..i. */
export const cumulativeMean = (values: number[]) => {
  let sum = 0;
  return values.map((v, i) => (sum += v) / (i + 1));
};

/** Contagem acumulada de partidas que atendem à condição. */
export const cumulativeCount = (flags: boolean[]) => {
  let n = 0;
  return flags.map((f) => (n += f ? 1 : 0));
};

/** Média móvel das últimas `window` partidas (suaviza séries ruidosas como ações por partida). */
export const movingAverage = (values: number[], window: number) =>
  values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const part = values.slice(from, i + 1);
    return part.reduce((s, v) => s + v, 0) / part.length;
  });

/** Nome de arquivo seguro a partir do título. */
export const reportFileName = (r: Report, ext: 'html' | 'json') =>
  `relatorio-${r.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wumpus'}.${ext}`;

/**
 * Diferença pareada (a − b) partida a partida, com intervalo de 95% pela aproximação normal.
 * Pareada porque os dois jogaram os mesmos mapas: a sorte do mapa se cancela na diferença.
 */
export function pairedDiff(a: number[], b: number[]) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const mean = d.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const half = (1.96 * sd) / Math.sqrt(n);
  return { mean, low: mean - half, high: mean + half, sd };
}
