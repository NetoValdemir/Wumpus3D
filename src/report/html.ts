// Monta o conteúdo dos relatórios em HTML (texto, sem DOM): usado na tela de Análise e no arquivo exportado.
import type { Outcome } from '../arena/runner';
import { MAX_SERIES, OUTCOMES, installChartHover, legend, lineChart, outcomeBars, outcomeLegend, type Series } from './charts';
import { OUTCOME_LABEL, cumulativeCount, cumulativeMean, movingAverage, summary, type Report, type ReportAgent } from './report';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (v: number, n: number) => `${n ? Math.round((100 * v) / n) : 0}%`;
const num = (v: number | null, d = 1) => (v === null ? '—' : v.toFixed(d).replace('.', ','));
const pts = (v: number) => `${Math.round(v)}`;

export interface NamedAgent {
  label: string; // nome mostrado (agente, e o arquivo de origem quando há vários relatórios)
  agent: ReportAgent;
}

/** Descrição curta das condições do relatório (tamanho, poços, semente). */
export function describeConfig(r: Report) {
  const c = r.config;
  const map = c.size ? `mapas ${c.size}×${c.size}` : 'mapas de tamanhos variados';
  const pits = c.pitProbability !== null ? `, ${Math.round(c.pitProbability * 100)}% de poços${c.pitCount ? ` (${c.pitCount} por mapa)` : ''}` : '';
  return `${c.maps} ${map}${pits}, semente "${c.seed}"`;
}

function summaryTable(list: NamedAgent[]) {
  const head = ['Agente', 'Partidas', 'Pontos (média)', 'Vitórias', 'Mortes (poço / Wumpus)', 'Tempo esgotado', 'Erros', 'Pegou o ouro', 'Matou o Wumpus', 'Ações por partida', 'Ações por vitória', 'Erros de lógica por partida', 'Riscos desnecessários por partida'];
  const rows = list.map(({ label, agent }, i) => {
    const s = agent.games.length ? summary(agent) : null;
    const st = agent.stats;
    const n = s?.games ?? st.games;
    const key = i < MAX_SERIES ? `<span class="key" style="background:var(--s${i + 1})"></span>` : '';
    const cells = s
      ? [n, pts(s.avgScore), pct(s.wins, n), `${pct(s.deathsPit + s.deathsWumpus, n)} (${s.deathsPit} / ${s.deathsWumpus})`, pct(s.timeouts, n), pct(s.errors, n), pct(s.gold, n), pct(s.killed, n), num(s.avgActions), num(s.avgActionsPerWin), num(s.logicErrorsPerGame, 2), num(s.needlessRisksPerGame, 2)]
      : [n, pts(st.avgScore), pct(st.wins, n), `${pct(st.deathsPit + st.deathsWumpus, n)} (${st.deathsPit} / ${st.deathsWumpus})`, pct(st.timeouts, n), pct(st.errors, n), '—', '—', '—', num(st.avgActionsPerWin), num(st.logicErrorsPerGame, 2), num(st.needlessRisksPerGame, 2)];
    return `<tr><th scope="row">${key}${esc(label)}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  });
  return `<div class="table-wrap"><table class="report-table"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function gamesTable(a: NamedAgent) {
  const rows = a.agent.games
    .map((g) => `<tr><td>${g.map}</td><td>${OUTCOME_LABEL[g.outcome]}</td><td>${g.score}</td><td>${g.actions}</td><td>${g.gold ? 'sim' : 'não'}</td><td>${g.killed ? 'sim' : 'não'}</td><td>${g.shots}</td><td>${g.logicErrors}</td><td>${g.needlessRisks}</td></tr>`)
    .join('');
  return `<details class="games"><summary>${esc(a.label)}: as ${a.agent.games.length} partidas</summary><div class="table-wrap"><table class="report-table"><thead><tr><th scope="col">Mapa</th><th scope="col">Resultado</th><th scope="col">Pontos</th><th scope="col">Ações</th><th scope="col">Pegou o ouro</th><th scope="col">Matou o Wumpus</th><th scope="col">Tiros</th><th scope="col">Erros de lógica</th><th scope="col">Riscos desnecessários</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

/** Tabela-resumo, gráficos e partidas de uma lista de agentes (de um ou vários relatórios). */
export function reportSections(list: NamedAgent[]) {
  const withGames = list.filter((a) => a.agent.games.length);
  const charted = withGames.slice(0, MAX_SERIES);
  const names = charted.map((a) => a.label);
  const multi = charted.length > 1;
  const counts = (a: ReportAgent) => {
    const c = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
    for (const g of a.games) c[g.outcome]++;
    if (!a.games.length) {
      c.won = a.stats.wins;
      c['dead-pit'] = a.stats.deathsPit;
      c['dead-wumpus'] = a.stats.deathsWumpus;
      c.timeout = a.stats.timeouts;
      c.error = a.stats.errors;
    }
    return c;
  };
  const series = (f: (a: ReportAgent) => number[], notes?: (a: ReportAgent) => string[]): Series[] =>
    charted.map(({ label, agent }) => ({ name: label, values: f(agent), notes: notes?.(agent) }));
  const gameNote = (a: ReportAgent) => a.games.map((g) => `nesta partida: ${g.score} pts, ${OUTCOME_LABEL[g.outcome].toLowerCase()}`);
  const figure = (title: string, desc: string, chart: string) =>
    `<figure class="report-figure"><figcaption><b>${title}</b><span>${desc}</span></figcaption>${multi ? legend(names) : ''}${chart}</figure>`;

  const parts = [`<section><h3>Resumo</h3>${summaryTable(list)}</section>`];
  parts.push(
    `<section><h3>Resultado das partidas</h3>${outcomeLegend()}${outcomeBars(list.map((a) => ({ name: a.label, counts: counts(a.agent) })))}</section>`,
  );
  if (charted.length) {
    parts.push(
      `<section class="report-charts"><h3>Ao longo das partidas</h3>` +
        figure('Pontuação média acumulada', 'Média das partidas jogadas até ali. Estabiliza quando há partidas suficientes.', lineChart({ label: 'Pontuação média acumulada', series: series((a) => cumulativeMean(a.games.map((g) => g.score)), gameNote) })) +
        figure('Vitórias acumuladas', 'Quantas partidas o agente venceu até ali.', lineChart({ label: 'Vitórias acumuladas', series: series((a) => cumulativeCount(a.games.map((g) => g.outcome === 'won'))), yMin: 0 })) +
        figure('Mortes acumuladas', 'Quedas em poço e encontros com o Wumpus até ali.', lineChart({ label: 'Mortes acumuladas', series: series((a) => cumulativeCount(a.games.map((g) => g.outcome === 'dead-pit' || g.outcome === 'dead-wumpus'))), yMin: 0 })) +
        figure('Ações por partida', 'Média móvel das últimas 10 partidas; a dica mostra o número exato.', lineChart({ label: 'Ações por partida', series: series((a) => movingAverage(a.games.map((g) => g.actions), 10), (a) => a.games.map((g) => `nesta partida: ${g.actions} ações`)), yMin: 0 })) +
        `</section>`,
    );
  }
  if (withGames.length > MAX_SERIES) parts.push(`<p class="hint">Os gráficos mostram os ${MAX_SERIES} primeiros agentes; a tabela de resumo mostra todos.</p>`);
  if (list.some((a) => !a.agent.games.length)) parts.push('<p class="hint">Arquivos antigos da Arena trazem só os totais: esses agentes aparecem na tabela e nas barras, mas não nos gráficos por partida.</p>');
  if (withGames.length) parts.push(`<section><h3>Partida a partida</h3>${withGames.map(gamesTable).join('')}</section>`);
  return parts.join('');
}

/** Estilos dos relatórios (tabela, gráficos, legenda, dica). As cores ficam nas variáveis do contêiner. */
export const REPORT_CSS = `
.report-table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:13px}
.report-table th,.report-table td{padding:6px 8px;border-bottom:1px solid var(--rule);text-align:right;white-space:nowrap}
.report-table thead th{font-size:11px;font-weight:600;color:var(--muted);white-space:normal;vertical-align:bottom}
.report-table th[scope=row],.report-table th:first-child{text-align:left;font-weight:600}
.table-wrap{overflow-x:auto}
.key{display:inline-block;width:12px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.key.square{width:10px;height:10px}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;list-style:none;margin:6px 0;padding:0;font-size:12px;color:var(--muted)}
.chart{width:100%;height:auto;display:block;overflow:visible}
.chart[data-kind=bars]{max-width:720px}
.chart .grid{stroke:var(--rule);stroke-width:1}
.chart .axis{stroke:var(--muted);stroke-width:1}
.chart .tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.chart .label{fill:var(--fg);font-size:12px}
.chart .line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.chart .end{stroke:var(--surface);stroke-width:2}
.chart .crosshair{stroke:var(--muted);stroke-width:1}
.chart .seg{cursor:default}
.report-figure{margin:0 0 18px;position:relative}
.report-figure figcaption{display:flex;flex-direction:column;gap:2px;margin-bottom:4px}
.report-figure figcaption span{font-size:12px;color:var(--muted)}
.report-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:8px 24px}
.report-charts h3{grid-column:1/-1}
.games summary{cursor:pointer;padding:4px 0}
.chart-tip{position:absolute;z-index:5;pointer-events:none;background:var(--surface);color:var(--fg);border:1px solid var(--rule);border-radius:6px;padding:6px 8px;font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:320px}
.chart-tip b{display:block;margin-bottom:2px}
.chart-tip strong{font-variant-numeric:tabular-nums;margin-right:4px}
`;

/** Cores dos gráficos: paleta categórica validada (claro e escuro) e cores de estado dos resultados. */
export const REPORT_COLORS_LIGHT = '--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--s6:#008300';
export const REPORT_COLORS_DARK = '--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300';
export const OUTCOME_COLORS = "--o-won:#0ca30c;--o-dead-pit:#d03b3b;--o-dead-wumpus:#8c2a2a;--o-timeout:#fab219;--o-error:#ec835a";

/** Arquivo HTML completo e independente: abre em qualquer navegador e pode ser importado de volta na Análise. */
export function renderReportHtml(r: Report) {
  const list = r.agents.map((agent) => ({ label: agent.name, agent }));
  const data = JSON.stringify(r).replace(/<\//g, '<\\/');
  const created = new Date(r.created);
  const when = isNaN(created.getTime()) ? r.created : created.toLocaleString('pt-BR');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)} · Wumpus 3D</title>
<style>
:root{color-scheme:light;--bg:#f6f4f0;--surface:#fcfcfb;--fg:#1d1a16;--muted:#5e5850;--rule:#e2ddd4;${REPORT_COLORS_LIGHT};${OUTCOME_COLORS}}
@media (prefers-color-scheme: dark){:root{color-scheme:dark;--bg:#0f0c09;--surface:#1a1612;--fg:#efe8dc;--muted:#a99f90;--rule:#352d25;${REPORT_COLORS_DARK}}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-right)) 48px max(16px,env(safe-area-inset-left));position:relative}
header p{margin:4px 0;color:var(--muted)}
h1{font-size:22px;margin:0 0 4px;text-wrap:balance}
h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 10px}
section{background:var(--surface);border:1px solid var(--rule);border-radius:10px;padding:4px 16px 12px;margin-top:16px}
.hint{color:var(--muted);font-size:12px}
${REPORT_CSS}
</style>
</head>
<body>
<main id="report">
<header>
<h1>${esc(r.title)}</h1>
<p>${esc(describeConfig(r))}. Gerado em ${esc(when)} pelo Wumpus 3D.</p>
<p>Para comparar com outros agentes, importe este arquivo na tela <b>Análise de relatórios</b> do jogo.</p>
</header>
${reportSections(list)}
</main>
<script type="application/json" id="wumpus3d-relatorio">${data}</script>
<script>(${installChartHover.toString()})(document.getElementById('report'));</script>
</body>
</html>
`;
}
