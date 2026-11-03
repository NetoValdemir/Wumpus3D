// Trilha de IA: explicações, combinações, busca, genético de aula, Arena da turma e as lições.
// As respostas das lições são conferidas contra o que o próprio jogo deduz nas mesmas cavernas.
import { describe, expect, it } from 'vitest';
import { key } from '../src/game/world';
import { arenaMaps, mulberry32 } from '../src/arena/rng';
import { explainCell } from '../src/edu/trilha/explain';
import { pitCombinations } from '../src/edu/trilha/combos';
import { bfsTrace } from '../src/edu/trilha/bfs';
import { LITE_GENES, evaluateGenome, trainLite } from '../src/edu/trilha/ga-lite';
import { classArena } from '../src/edu/trilha/class-arena';
import { LESSONS, checkAnswer, isQuestion, lessonById, lessonStars, replay, type Question } from '../src/edu/trilha/lessons';
import { programFromJson } from '../src/edu/blockly-json';
import { BAYES_LIKE_GENOME } from '../src/agents/genome';

const k = (x: number, y: number) => key(x - 1, y - 1); // coordenadas da tela → chave interna
const board = (id: string) => LESSONS.find((l) => l.id === id)!.steps.find((s) => s.type === 'tabuleiro') as Extract<(typeof LESSONS)[number]['steps'][number], { type: 'tabuleiro' }>;
const questions = (id: string) => lessonById(id)!.steps.filter(isQuestion) as Question[];
const answerText = (q: Question) => (q.type === 'escolha' ? q.options[q.answer] : String(q.answer));

describe('explicações das deduções (módulo 2)', () => {
  const g = replay(board('ia2').cave!, board('ia2').moves);
  it('a sala segura, o poço certo e o Wumpus das perguntas são os que o jogo deduz', () => {
    expect(explainCell(g.kb, k(2, 2)).status).toBe('segura');
    expect(explainCell(g.kb, k(3, 1)).status).toBe('poco');
    expect(explainCell(g.kb, k(1, 3)).status).toBe('wumpus');
    const [segura, poco, wumpus] = questions('ia2').map(answerText);
    expect([segura, poco, wumpus]).toEqual(['(2, 2)', '(3, 1)', '(1, 3)']);
  });
  it('cada conclusão vem com os motivos', () => {
    expect(explainCell(g.kb, k(3, 1)).reasons.join(' ')).toMatch(/Em \(2, 1\) havia brisa.*Só sobra \(3, 1\)/);
    expect(explainCell(g.kb, k(2, 2)).reasons.join(' ')).toMatch(/\(1, 2\).*não havia brisa/);
    expect(explainCell(g.kb, k(1, 1)).status).toBe('visitada');
    expect(explainCell(g.kb, k(4, 4)).status).toBe('sem-pistas');
  });
});

describe('combinações de poços (módulo 3)', () => {
  const g = replay(board('ia3').cave!, board('ia3').moves);
  const t = pitCombinations(g.kb)!;
  it('a tabela reproduz as chances do agente probabilístico', () => {
    const official = g.kb.pitProbabilities();
    for (const f of t.frontier) expect(t.probability.get(f)).toBeCloseTo(official.get(f)!, 10);
    expect(t.frontier.sort()).toEqual([k(2, 2), k(3, 1)].sort());
    expect(t.combos.filter((c) => c.explains)).toHaveLength(3);
    expect(t.total).toBeCloseTo(0.36);
  });
  it('a resposta da lição (56%) é a do jogo', () => {
    const q = questions('ia3')[0];
    expect(Math.round(t.probability.get(k(3, 1))! * 100)).toBe(q.answer);
    expect(checkAnswer(q, '55,6')).toBe(true);
    expect(checkAnswer(q, '40')).toBe(false);
  });
});

describe('busca em largura (módulo 4)', () => {
  it('acha o caminho mais curto de volta pelas salas visitadas, com o número de passos da lição', () => {
    const g = replay(board('ia4').cave!, board('ia4').moves);
    const here = key(g.world.agent.x, g.world.agent.y);
    expect(here).toBe(k(4, 3));
    const t = bfsTrace((c) => g.kb.neighbors(c), (c) => g.kb.visited.has(c), here, k(1, 1));
    expect(t.path).toEqual([k(4, 3), k(4, 2), k(4, 1), k(3, 1), k(2, 1), k(1, 1)]);
    expect(t.path!.length - 1).toBe(questions('ia4')[0].answer);
    expect(t.steps[0]).toMatchObject({ current: here, added: [k(4, 2)] });
  });
  it('sem caminho, devolve null', () => {
    expect(bfsTrace(() => [], () => true, 'a', 'b').path).toBeNull();
  });
});

describe('genético de aula (módulo 5)', () => {
  it('só os pesos da aula mudam; com a mesma semente, o mesmo resultado', () => {
    const maps = arenaMaps('aula', 6, 4, 0.2);
    const run = () => [...trainLite({ maps, population: 6, generations: 3, rng: mulberry32(1) })];
    const a = run();
    expect(a).toHaveLength(3);
    expect(run().at(-1)!.genome).toEqual(a.at(-1)!.genome);
    const g = a.at(-1)!.genome;
    g.forEach((v, i) => !LITE_GENES.includes(i) && expect(v).toBe(BAYES_LIKE_GENOME[i]));
    expect(a.at(-1)!.best).toBeGreaterThanOrEqual(a[0].best - 1e-9); // elitismo: o melhor nunca piora
    expect(evaluateGenome(g, maps).games).toBe(6);
  });
});

describe('Arena da turma (módulo 6)', () => {
  it('programas e agentes jogam as mesmas cavernas; o ranking vem ordenado', () => {
    const maps = arenaMaps('arena', 8, 4, 0.2);
    const parado = programFromJson({ blocks: { blocks: [{ type: 'wumpus_start', id: 's' }] } });
    const rows = classArena([{ name: 'Parado', program: parado }], maps);
    expect(rows.map((r) => r.name)).toContain('Parado');
    expect(rows.find((r) => r.name === 'Parado')).toMatchObject({ games: 8, wins: 0, unfinished: 8 });
    expect(rows.map((r) => r.avgScore)).toEqual([...rows.map((r) => r.avgScore)].sort((x, y) => y - x));
    expect(rows.filter((r) => r.kind === 'agente')).toHaveLength(2);
  });
});

describe('lições', () => {
  it('seis módulos, um por grande ideia, com perguntas bem formadas', () => {
    expect(LESSONS.map((l) => l.module)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const l of LESSONS) {
      for (const q of l.steps.filter(isQuestion)) {
        if (q.type === 'escolha') expect(q.answer).toBeLessThan(q.options.length);
        expect(checkAnswer(q, q.type === 'escolha' ? q.answer : String(q.answer))).toBe(true);
      }
    }
  });
  it('as cavernas das lições são vencíveis e os passos não matam o robô', () => {
    for (const l of LESSONS) {
      const b = l.steps.find((s) => s.type === 'tabuleiro');
      if (b?.type === 'tabuleiro' && b.cave) expect(replay(b.cave, b.moves).world.gameOver).toBe(false);
    }
  });
  it('estrelas da lição', () => {
    expect([lessonStars(3, 3), lessonStars(2, 3), lessonStars(1, 3), lessonStars(0, 0)]).toEqual([3, 2, 1, 3]);
  });
});
