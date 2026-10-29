// Relatórios de desempenho (src/report): montar, exportar em HTML/JSON e importar de volta.
import { describe, expect, it } from 'vitest';
import { arenaMaps } from '../src/arena/rng';
import { builtinController, playEpisode } from '../src/arena/runner';
import { buildReport, cumulativeCount, cumulativeMean, movingAverage, parseReport, summary } from '../src/report/report';
import { renderReportHtml } from '../src/report/html';

async function sampleReport() {
  const maps = arenaMaps('relatorio-teste', 12, 4, 0.2);
  const play = async (id: 'logic' | 'bayes') => {
    const ctrl = builtinController(id);
    const results = [];
    for (const m of maps) results.push(await playEpisode(ctrl, m, 1000));
    return results;
  };
  return buildReport({
    title: 'Teste </script> & cia',
    origin: 'arena',
    config: { size: 4, pitProbability: 0.2, maps: maps.length, seed: 'relatorio-teste' },
    agents: [
      { name: 'Lógico', author: 'Wumpus 3D', results: await play('logic') },
      { name: 'Probabilístico', author: 'Wumpus 3D', results: await play('bayes') },
    ],
  });
}

describe('relatórios', () => {
  it('guarda uma linha por partida e totais que batem com elas', async () => {
    const r = await sampleReport();
    expect(r.config.pitCount).toBe(3);
    for (const a of r.agents) {
      expect(a.games).toHaveLength(12);
      const s = summary(a);
      expect(s.wins).toBe(a.stats.wins);
      expect(s.avgScore).toBeCloseTo(a.stats.avgScore, 6);
      expect(a.games.map((g) => g.map)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    }
  });

  it('o HTML exportado leva os dados e é importado de volta igual, mesmo com </script> no título', async () => {
    const r = await sampleReport();
    const html = renderReportHtml(r);
    expect(html).toContain('<svg');
    const back = parseReport(html, 'rel.html');
    expect(back.title).toBe(r.title);
    expect(back.agents).toEqual(r.agents);
    expect(back.source).toBe('rel.html');
    expect(parseReport(JSON.stringify(r)).agents).toEqual(r.agents);
  });

  it('aceita a exportação antiga da Arena (só totais) e recusa arquivos estranhos', () => {
    const old = { meta: { seed: 's', maps: 10, size: 4, pitProbability: 0.2, date: '2026-10-28' }, ranking: [{ name: 'X', author: 'Y', games: 10, wins: 5 }] };
    const r = parseReport(JSON.stringify(old));
    expect(r.agents[0].games).toEqual([]);
    expect(r.agents[0].stats.wins).toBe(5);
    expect(() => parseReport('{"format":"outro"}')).toThrow('relatório do Wumpus 3D');
    expect(() => parseReport('<html></html>')).toThrow('não é um relatório');
    expect(() => parseReport('{')).toThrow('JSON válido');
  });

  it('séries acumuladas e média móvel', () => {
    expect(cumulativeMean([10, 20, 30])).toEqual([10, 15, 20]);
    expect(cumulativeCount([true, false, true])).toEqual([1, 1, 2]);
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });
});
