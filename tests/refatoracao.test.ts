// Utilitários criados na refatoração (Código Limpo): formatação, grade, partidas sem 3D e ranking.
import { describe, expect, it } from 'vitest';
import { escapeHtml, fixedOrDash, percent, percentOf, slugify } from '../src/util/format';
import { WumpusWorld, gridNeighbors, inGrid, key, parseKey, sameCell } from '../src/game/world';
import { playMaps, playToEnd } from '../src/agents/benchmark';
import { arenaMaps } from '../src/arena/rng';
import { failedEpisode } from '../src/arena/runner';
import { aggregate, rankingCells, toMarkdown } from '../src/arena/ranking';

describe('formatação', () => {
  it('escapa HTML, formata porcentagens e números', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    expect(percentOf(1, 3)).toBe('33%');
    expect(percentOf(5, 0)).toBe('0%');
    expect(percent(0.256)).toBe('26%');
    expect(fixedOrDash(null)).toBe('—');
    expect(fixedOrDash(1.234, 2)).toBe('1.23');
    expect(fixedOrDash(1.234, 1, true)).toBe('1,2');
  });

  it('gera nomes de arquivo sem acentos nem símbolos', () => {
    expect(slugify('Ana × agentes em 3 mapas')).toBe('ana-agentes-em-3-mapas');
    expect(slugify('Ação Rápida!')).toBe('acao-rapida');
    expect(slugify('***')).toBe('');
  });
});

describe('grade do mapa', () => {
  it('key e parseKey são inversas', () => {
    expect(parseKey(key(3, 7))).toEqual([3, 7]);
  });

  it('vizinhas ficam dentro do mapa, na ordem leste, norte, oeste, sul', () => {
    expect(gridNeighbors(4, 0, 0)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(gridNeighbors(4, 2, 2)).toHaveLength(4);
    expect(inGrid(4, 3, 3)).toBe(true);
    expect(inGrid(4, 4, 0)).toBe(false);
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
  });

  it('o mundo usa as mesmas vizinhas que a grade', () => {
    const w = new WumpusWorld(5, 0.2);
    expect(w.neighbors(4, 4)).toEqual(gridNeighbors(5, 4, 4));
  });
});

describe('partidas sem 3D', () => {
  const maps = arenaMaps('refatoracao', 20, 4, 0.2);

  it('playToEnd joga até o fim e playMaps resume os mesmos números', () => {
    const scores = maps.map((m) => playToEnd('bayes', m).score);
    const r = playMaps('bayes', undefined, maps);
    expect(r.scores).toEqual(scores);
    expect(r.avg).toBeCloseTo(scores.reduce((s, v) => s + v, 0) / scores.length);
    expect(r.wins).toBe(maps.filter((m) => playToEnd('bayes', m).status === 'won').length);
  });

  it('agente que não carrega conta como erro com a penalidade de morte', () => {
    const r = failedEpisode('falhou');
    expect(r).toMatchObject({ outcome: 'error', score: -1000, error: 'falhou' });
    expect(aggregate('x', 'y', [r]).errors).toBe(1);
  });
});

describe('ranking', () => {
  it('as células da tabela são as mesmas no Markdown', () => {
    const stats = aggregate('Agente', 'Autor', [failedEpisode('e')]);
    const c = rankingCells(stats);
    expect(c).toMatchObject({ score: '-1000', wins: '0%', errors: '100%', actionsPerWin: '—', hitRate: '—' });
    const md = toMarkdown([stats], { seed: 's', maps: 1, size: 4, pitProbability: 0.2, date: '2026-10-31' });
    expect(md).toContain('| 1 | Agente | Autor | -1000 | 0% | 0% | 100% | — | 0.00 | 0.00 | 0.00 | — |');
  });
});
