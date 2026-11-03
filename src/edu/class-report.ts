// Relatório da turma: junta os registros dos alunos (arquivos que eles enviam) e mostra, por aluno e por
// atividade, o que cada um fez. Gera HTML autossuficiente (para abrir, imprimir ou guardar) e CSV. Sem DOM.
import { escapeHtml as esc } from '../util/format';
import { describeCave, summarizeActivity, type ActivityKind, type ActivitySummary, type Attempt, type Plan, type StudentRecord } from './plan';

export interface ReportActivity {
  id: string;
  title: string;
  kind: ActivityKind;
  detail: string;
}

export interface ReportStudent {
  name: string;
  attempts: Attempt[];
  per: Map<string, ActivitySummary>;
  stars: number;
  done: number;
}

export interface ClassReport {
  title: string;
  group: string;
  teacher: string;
  created: string;
  activities: ReportActivity[];
  students: ReportStudent[];
  warnings: string[];
}

const OUTCOME: Record<Attempt['outcome'], string> = {
  won: 'venceu',
  'dead-pit': 'caiu no poço',
  'dead-wumpus': 'pego pelo Wumpus',
  timeout: 'tempo esgotado',
  playing: 'não terminou',
  erro: 'erro no programa',
};

/** Junta registros do mesmo aluno (vários arquivos) e ordena as tentativas no tempo. */
export function buildClassReport(plan: Plan | null, records: StudentRecord[]): ClassReport {
  const warnings: string[] = [];
  const own = plan ? records.filter((r) => r.planId === plan.id) : records;
  if (plan) {
    const other = records.filter((r) => r.planId !== plan.id);
    if (other.length) warnings.push(`${other.length} registro(s) são de outro plano e ficaram de fora: ${other.map((r) => `${r.student} ("${r.planTitle}")`).join(', ')}.`);
  }
  const activities: ReportActivity[] = plan
    ? plan.activities.map((a) => ({ id: a.id, title: a.title, kind: a.kind, detail: describeCave(a.cave) }))
    : [...new Map(own.flatMap((r) => r.attempts).map((a) => [a.activityId, { id: a.activityId, title: a.activityTitle, kind: a.kind, detail: '' }])).values()];
  const byName = new Map<string, Attempt[]>();
  for (const r of own) byName.set(r.student, [...(byName.get(r.student) ?? []), ...r.attempts]);
  const students = [...byName]
    .map(([name, attempts]) => {
      const seen = new Set<string>();
      const unique = attempts.filter((a) => !seen.has(a.at + a.activityId) && seen.add(a.at + a.activityId)).sort((a, b) => a.at.localeCompare(b.at));
      const per = new Map(activities.map((a) => [a.id, summarizeActivity(unique.filter((t) => t.activityId === a.id))]));
      const sums = [...per.values()];
      return { name, attempts: unique, per, stars: sums.reduce((s, x) => s + x.stars, 0), done: sums.filter((x) => x.won).length };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return {
    title: plan?.title ?? 'Registros dos alunos',
    group: plan?.group ?? '',
    teacher: plan?.teacher ?? '',
    created: new Date().toISOString(),
    activities,
    students,
    warnings,
  };
}

const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const kindLabel = (k: ActivityKind) => (k === 'detetive' ? 'Detetive' : 'Blocos');

/** Números de cada atividade para a turma inteira. */
export function activityStats(r: ClassReport, id: string) {
  const sums = r.students.map((s) => s.per.get(id)!).filter((x) => x.attempts > 0);
  const won = sums.filter((x) => x.won);
  const avg = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
  return {
    tried: sums.length,
    won: won.length,
    avgAttemptsToWin: avg(won.map((x) => x.attemptsToWin!)),
    avgStars: avg(won.map((x) => x.stars)),
    hints: sums.reduce((s, x) => s + x.hints, 0),
  };
}

const CSS = `
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:24px auto;max-width:1100px;padding:0 16px;color:#1f1a14;background:#fff;line-height:1.45}
h1{margin:0 0 4px}h2{margin:28px 0 8px;border-bottom:2px solid #e9b52e;padding-bottom:4px}
.meta{color:#5e5850;margin:0 0 16px}.warn{background:#fdf1d6;border-left:4px solid #c9932a;padding:8px 12px}
table{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:14px}th,td{border:1px solid #d6cbb8;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f3ede3}td.c{text-align:center;white-space:nowrap}.star{color:#b07a00;letter-spacing:1px}.no{color:#9a8f80}
.ok{color:#2e6b3e;font-weight:600}.bad{color:#8a3a2a}pre{background:#f6f2ea;padding:8px;border-radius:6px;font-size:12px;white-space:pre-wrap;margin:4px 0}
details{margin:6px 0 14px}summary{cursor:pointer;font-weight:600}.hint{color:#5e5850;font-size:13px}
@media print{details{page-break-inside:avoid}details>*{display:block}}`;

export function renderClassReportHtml(r: ClassReport): string {
  const head = r.activities.map((a) => `<th>${esc(a.title)}<br><span class="hint">${kindLabel(a.kind)}</span></th>`).join('');
  const rows = r.students
    .map((s) => {
      const cells = r.activities
        .map((a) => {
          const x = s.per.get(a.id)!;
          if (!x.attempts) return '<td class="c no">—</td>';
          const status = x.won ? `<span class="star">${starText(x.stars)}</span>` : `<span class="bad">${OUTCOME[x.lastOutcome!]}</span>`;
          return `<td class="c">${status}<br><span class="hint">${x.attempts} tentativa${x.attempts > 1 ? 's' : ''}${x.hints ? ` · ${x.hints} dica${x.hints > 1 ? 's' : ''}` : ''}</span></td>`;
        })
        .join('');
      return `<tr><th>${esc(s.name)}</th>${cells}<td class="c">${s.done}/${r.activities.length}<br><span class="star">${s.stars} ★</span></td></tr>`;
    })
    .join('');
  const stats = r.activities
    .map((a) => {
      const st = activityStats(r, a.id);
      return `<tr><td>${esc(a.title)}</td><td>${kindLabel(a.kind)}</td><td>${esc(a.detail)}</td><td class="c">${st.tried}</td><td class="c">${st.won}</td><td class="c">${st.avgAttemptsToWin ?? '—'}</td><td class="c">${st.avgStars ?? '—'}</td><td class="c">${st.hints}</td></tr>`;
    })
    .join('');
  const details = r.students
    .map((s) => {
      const items = s.attempts
        .map((t) => {
          const time = new Date(t.at).toLocaleString('pt-BR');
          const extra =
            t.kind === 'detetive'
              ? `entrou em sala comprovadamente perigosa: ${t.logicErrors ?? 0} · riscos desnecessários: ${t.needlessRisks ?? 0} · dicas: ${t.hints ?? 0} · anotações certas/possíveis/erradas: ${t.marks ? `${t.marks.certa}/${t.marks.possivel}/${t.marks.errada}` : '—'}`
              : `blocos: ${t.blocks ?? 0}${t.error ? ` · erro: ${esc(t.error)}` : ''}`;
          const program = t.programText ? `<pre>${esc(t.programText)}</pre>` : '';
          return `<li><b>${esc(t.activityTitle)}</b> — ${OUTCOME[t.outcome]} ${t.stars ? `<span class="star">${starText(t.stars)}</span>` : ''} · ${t.actions} ações · ${Math.round(t.ms / 1000)} s · ${time}<br><span class="hint">${extra}</span>${program}</li>`;
        })
        .join('');
      return `<details><summary>${esc(s.name)} — ${s.attempts.length} tentativa${s.attempts.length === 1 ? '' : 's'}</summary><ol>${items}</ol></details>`;
    })
    .join('');
  const meta = [r.group && `Turma: ${esc(r.group)}`, r.teacher && `Professor(a): ${esc(r.teacher)}`, `Gerado em ${new Date(r.created).toLocaleString('pt-BR')}`, `${r.students.length} aluno(s)`]
    .filter(Boolean)
    .join(' · ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.title)} — relatório da turma</title><style>${CSS}</style></head><body>
<h1>${esc(r.title)}</h1><p class="meta">${meta}</p>
${r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
<h2>Visão geral</h2>
<p class="hint">★ venceu · ★★ e com programa curto (Blocos) ou sem entrar em perigo comprovado (Detetive) · ★★★ resultado ótimo. "—" = ainda não tentou.</p>
<table><thead><tr><th>Aluno</th>${head}<th>Total</th></tr></thead><tbody>${rows || `<tr><td colspan="${r.activities.length + 2}">Nenhum registro importado.</td></tr>`}</tbody></table>
<h2>Por atividade</h2>
<table><thead><tr><th>Atividade</th><th>Modo</th><th>Caverna</th><th>Tentaram</th><th>Venceram</th><th>Tentativas até vencer (média)</th><th>Estrelas (média)</th><th>Dicas pedidas</th></tr></thead><tbody>${stats}</tbody></table>
<h2>Tudo o que cada aluno fez</h2>
${details || '<p>Nenhum registro.</p>'}
<p class="hint">Gerado pelo Wumpus 3D — modo escola. Os dados vêm dos arquivos enviados pelos alunos; nenhum dado sai do computador do professor.</p>
</body></html>`;
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Uma linha por tentativa (separador ";", que o Excel em português abre direto). */
export function classReportCsv(r: ClassReport): string {
  const head = ['aluno', 'atividade', 'modo', 'data', 'resultado', 'estrelas', 'acoes', 'segundos', 'dicas', 'erros_de_logica', 'riscos_desnecessarios', 'anotacoes_erradas', 'blocos', 'erro_programa'];
  const lines = r.students.flatMap((s) =>
    s.attempts.map((t) =>
      [s.name, t.activityTitle, kindLabel(t.kind), t.at, OUTCOME[t.outcome], t.stars, t.actions, Math.round(t.ms / 1000), t.hints ?? '', t.logicErrors ?? '', t.needlessRisks ?? '', t.marks?.errada ?? '', t.blocks ?? '', t.error ?? '']
        .map(csvCell)
        .join(';'),
    ),
  );
  return '﻿' + [head.join(';'), ...lines].join('\n');
}
