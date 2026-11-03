// Trilha de IA, módulo 6, e relatório do professor: os programas de blocos dos alunos e os agentes do
// jogo jogam as mesmas cavernas, no navegador, sem servidor. Comparação justa: a sorte do mapa é igual
// para todos.
import type { MapLayout } from '../../game/world';
import { playToEnd } from '../../agents/benchmark';
import { AGENTS } from '../../agents/agents';
import type { Program } from '../program';
import { runProgram } from '../run';

export interface ArenaEntry {
  name: string;
  program: Program;
}

export interface ArenaRow {
  name: string;
  kind: 'aluno' | 'agente';
  games: number;
  avgScore: number;
  wins: number;
  deaths: number;
  timeouts: number;
  unfinished: number; // o programa acabou antes de o jogo terminar, ou deu erro
}

const row = (name: string, kind: ArenaRow['kind'], results: { status: string; score: number; error?: string | null }[]): ArenaRow => ({
  name,
  kind,
  games: results.length,
  avgScore: results.reduce((s, r) => s + r.score, 0) / (results.length || 1),
  wins: results.filter((r) => r.status === 'won').length,
  deaths: results.filter((r) => r.status === 'dead-pit' || r.status === 'dead-wumpus').length,
  timeouts: results.filter((r) => r.status === 'timeout').length,
  unfinished: results.filter((r) => r.status === 'playing' || r.error).length,
});

/** Ranking: pontuação média, depois vitórias. Os agentes de referência entram para dar a escala. */
export function classArena(entries: ArenaEntry[], maps: MapLayout[], withAgents = true): ArenaRow[] {
  const rows = entries.map((e) => row(e.name, 'aluno', maps.map((m) => runProgram(e.program, m))));
  if (withAgents) {
    for (const id of ['logic', 'bayes'] as const) rows.push(row(`${AGENTS[id].label} (referência)`, 'agente', maps.map((m) => playToEnd(id, m))));
  }
  return rows.sort((a, b) => b.avgScore - a.avgScore || b.wins - a.wins);
}
