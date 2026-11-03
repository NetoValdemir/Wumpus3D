// Criador de cavernas, plano do professor, registro do aluno e relatório da turma.
import { describe, expect, it } from 'vitest';
import { WumpusWorld } from '../src/game/world';
import { applyTool, caveCode, caveProblems, caveToLayout, emptyCave, layoutToCave, parseCaveCode, resizeCave } from '../src/edu/caves';
import { activityLayouts, newRecord, parsePlanCode, parsePlanFile, parseRecord, planCode, samplePlan, summarizeActivity, type Attempt } from '../src/edu/plan';
import { buildClassReport, classReportCsv, renderClassReportHtml } from '../src/edu/class-report';

describe('criador de cavernas', () => {
  it('monta, valida e transforma em mapa do jogo', () => {
    const d = emptyCave(4, 'Caverna da Ana');
    expect(caveProblems(d)).toEqual(['Falta colocar o ouro.', 'Falta colocar o Wumpus.']);
    expect(applyTool(d, '0,0', 'poco')).toBe(false); // a entrada fica livre
    applyTool(d, '2,2', 'ouro');
    applyTool(d, '3,3', 'wumpus');
    applyTool(d, '1,0', 'poco');
    applyTool(d, '0,1', 'poco');
    expect(caveProblems(d)).toEqual(['Não existe caminho sem poço da entrada até o ouro: ninguém conseguiria vencer.']);
    applyTool(d, '0,1', 'poco'); // tira o poço
    const layout = caveToLayout(d);
    expect(layout).toMatchObject({ name: 'Caverna da Ana', size: 4, gold: [3, 3], wumpus: [4, 4], pits: [[2, 1]] });
    expect(WumpusWorld.fromLayout(layout).hasPit(1, 0)).toBe(true);
    expect(layoutToCave(layout)).toEqual({ ...d, name: 'Caverna da Ana' });
  });

  it('poço apaga Wumpus e ouro da sala; Wumpus e ouro podem dividir a sala (D16)', () => {
    const d = emptyCave(4);
    applyTool(d, '2,2', 'ouro');
    applyTool(d, '2,2', 'wumpus');
    expect([d.gold, d.wumpus]).toEqual(['2,2', '2,2']);
    applyTool(d, '2,2', 'poco');
    expect([d.gold, d.wumpus, d.pits.has('2,2')]).toEqual([null, null, true]);
  });

  it('diminuir a caverna descarta o que fica de fora', () => {
    const d = emptyCave(6);
    applyTool(d, '5,5', 'ouro');
    applyTool(d, '1,1', 'wumpus');
    expect(resizeCave(d, 4)).toMatchObject({ size: 4, gold: null, wumpus: '1,1' });
  });

  it('código curto vai e volta igual, com acentos; código errado dá mensagem clara', () => {
    const d = emptyCave(5, 'Caverna do João');
    applyTool(d, '4,4', 'ouro');
    applyTool(d, '2,3', 'wumpus');
    const layout = caveToLayout(d);
    const back = parseCaveCode(caveCode(layout));
    expect(back).toMatchObject({ name: 'Caverna do João', size: 5, gold: layout.gold, wumpus: layout.wumpus, pits: [] });
    expect(() => parseCaveCode('PLANO1-abc')).toThrow(/CAV1-/);
    expect(() => parseCaveCode('CAV1-%%%')).toThrow(/incompleto/);
  });
});

describe('plano do professor', () => {
  it('vai e volta por código e por arquivo', () => {
    const p = samplePlan();
    expect(parsePlanCode(planCode(p))).toEqual(p);
    expect(parsePlanFile(JSON.stringify(p))).toEqual(p);
    expect(() => parsePlanFile('{"format":"x"}')).toThrow(/plano/);
    expect(() => parsePlanFile('nada')).toThrow(/JSON/);
  });

  it('cada atividade tem suas cavernas; o sorteio é o mesmo para todos os alunos', () => {
    const p = samplePlan();
    const a = activityLayouts(p.activities[0]);
    expect(a).toHaveLength(1);
    expect(activityLayouts(p.activities[0])).toEqual(a);
    expect(activityLayouts(p.activities[1])[0].name).toBe('Missão 1');
  });
});

describe('registro do aluno e relatório da turma', () => {
  const p = samplePlan();
  const t = (activityId: string, outcome: Attempt['outcome'], stars: number, extra: Partial<Attempt> = {}, at = '2026-11-03T10:00:00Z'): Attempt => ({
    activityId,
    activityTitle: p.activities.find((a) => a.id === activityId)!.title,
    kind: p.activities.find((a) => a.id === activityId)!.kind,
    at,
    ms: 60000,
    outcome,
    stars,
    actions: 10,
    score: 0,
    ...extra,
  });

  it('resume as tentativas de uma atividade', () => {
    const s = summarizeActivity([t('a2', 'dead-pit', 0, {}, '1'), t('a2', 'won', 2, { programText: 'quando começar:\n  avançar' }, '2'), t('a2', 'won', 3, {}, '3')]);
    expect(s).toMatchObject({ attempts: 3, won: true, stars: 3, attemptsToWin: 2, minutes: 3, lastProgram: 'quando começar:\n  avançar' });
  });

  it('junta arquivos do mesmo aluno, ignora outro plano e gera HTML e CSV', () => {
    const ana1 = { ...newRecord('Ana', p), attempts: [t('a1', 'won', 3, { hints: 2, logicErrors: 0, marks: { certa: 3, possivel: 1, errada: 0 } }, '2026-11-03T10:00:00Z')] };
    const ana2 = { ...newRecord('Ana', p), attempts: [t('a2', 'erro', 0, { error: 'Falta encaixar uma condição', blocks: 3 }, '2026-11-03T10:05:00Z')] };
    const bia = { ...newRecord('Bia', p), attempts: [t('a2', 'won', 1, { programText: 'quando começar:\n  avançar' })] };
    const outro = { ...newRecord('Caio', { id: 'x', title: 'Outro plano' }), attempts: [] };
    const records = [ana1, ana2, bia, outro].map((r) => parseRecord(JSON.stringify(r)));
    const report = buildClassReport(p, records);
    expect(report.students.map((s) => [s.name, s.attempts.length, s.done, s.stars])).toEqual([
      ['Ana', 2, 1, 3],
      ['Bia', 1, 1, 1],
    ]);
    expect(report.warnings[0]).toMatch(/Caio/);
    const html = renderClassReportHtml(report);
    expect(html).toContain('<h1>Primeira aula: o robô e a caverna</h1>');
    expect(html).toContain('erro no programa');
    expect(html).toContain('★★★');
    const csv = classReportCsv(report);
    expect(csv.split('\n')).toHaveLength(4); // cabeçalho + 3 tentativas
    expect(csv).toContain('Ana;Detetive: primeira caverna;Detetive');
  });

  it('nomes com HTML não quebram o relatório', () => {
    const r = { ...newRecord('<b>Zé</b>', p), attempts: [t('a1', 'won', 1)] };
    expect(renderClassReportHtml(buildClassReport(p, [r]))).toContain('&lt;b&gt;Zé&lt;/b&gt;');
    expect(() => parseRecord('{"format":"x"}', 'ana.json')).toThrow(/ana.json/);
  });
});
