// "Avaliação": o agente escolhido joga várias partidas sem 3D; o resultado vira um relatório.
import type { MapLayout } from '../game/world';
import { aggregate, type AgentStats } from '../arena/ranking';
import { arenaMaps } from '../arena/rng';
import { playEpisode, type EpisodeResult } from '../arena/runner';
import type { Controller } from '../arena/protocol';
import { buildReport, type Report } from '../report/report';
import { addReportToAnalysis, exportReportHtml, exportReportJson } from '../report/ui';
import { $, nextFrame, readInt } from './dom';
import { makeController, playerAuthor, reportName } from './players';
import { cfg, match } from './state';

let benchmarking = false;
let lastReport: Report | null = null;

const out = (text: string) => ($('#bench-out').textContent = text);

/** Joga os mapas mostrando o progresso a cada 10 partidas. */
async function playAll(ctrl: Controller, maps: MapLayout[]) {
  const results: EpisodeResult[] = [];
  for (const m of maps) {
    results.push(await playEpisode(ctrl, m, 3000));
    if (results.length % 10 === 0) {
      out(`Jogando: ${results.length} de ${maps.length} partidas...`);
      await nextFrame();
    }
  }
  return results;
}

function describeResult(r: AgentStats, where: string) {
  const deaths = r.deathsPit + r.deathsWumpus;
  return (
    `${r.name} ${where}: ` +
    `${r.wins} vitórias, ${deaths} mortes${r.timeouts ? `, ${r.timeouts} por tempo esgotado` : ''}${r.errors ? `, ${r.errors} erros (${r.firstError})` : ''}. ` +
    `Pontuação média: ${Math.round(r.avgScore)}.`
  );
}

async function runBenchmark() {
  const id = cfg.agent.value;
  if (id === 'human' || benchmarking) return;
  benchmarking = true;
  const { world, layout, mapName } = match;
  const onMap = $<HTMLInputElement>('#bench-on-map').checked;
  const games = readInt('#bench-games', 1, 1000, 100);
  const seed = $<HTMLInputElement>('#bench-seed').value.trim() || 'avaliacao';
  // Semente fixa: avaliar outro agente com a mesma semente e quantidade repete exatamente os mesmos mapas
  const maps = onMap ? Array.from({ length: games }, () => layout) : arenaMaps(seed, games, world.size, world.pitProbability);
  const ctrl = makeController(id, false);
  const results = await playAll(ctrl, maps);
  ctrl.dispose?.();

  const name = reportName(id);
  out(describeResult(aggregate(name, '', results), onMap ? `no mapa "${mapName ?? 'atual'}"` : `em mapas ${world.size}×${world.size} sorteados`));
  lastReport = buildReport({
    title: `${name} em ${games} partidas`,
    origin: 'avaliacao',
    config: {
      size: world.size,
      pitProbability: onMap ? layout.pitProbability : world.pitProbability,
      maps: games,
      seed: onMap ? `mapa "${mapName ?? 'atual'}"` : seed,
    },
    agents: [{ name, author: playerAuthor(id), results }],
  });
  $('#bench-actions').hidden = false;
  benchmarking = false;
}

export function initBenchPanel() {
  const blocked = 'O navegador bloqueou o download. Use "Abrir na análise".';
  $('#btn-bench').addEventListener('click', runBenchmark);
  $('#bench-html').addEventListener('click', () => lastReport && !exportReportHtml(lastReport) && out(blocked));
  $('#bench-json').addEventListener('click', () => lastReport && !exportReportJson(lastReport) && out(blocked));
  $('#bench-analysis').addEventListener('click', () => lastReport && addReportToAnalysis(lastReport));
}
