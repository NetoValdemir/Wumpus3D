// Gráficos dos relatórios em SVG, gerados como texto: os mesmos servem na tela de Análise
// e dentro do HTML exportado. As cores vêm de variáveis CSS (--s1..--s6, --o-*), definidas por quem
// mostra o gráfico, para valer no tema claro e no escuro.
import type { Outcome } from '../arena/runner';
import { OUTCOME_LABEL } from './report';

export const MAX_SERIES = 6; // a paleta validada tem 6 cores distintas; acima disso, só a tabela

export interface Series {
  name: string;
  values: number[];
  /** Texto extra por ponto, mostrado na dica (ex.: a pontuação daquela partida) */
  notes?: string[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const W = 640;
const H = 240;
const M = { l: 52, r: 16, t: 12, b: 34 };

/** Divisões "redondas" para o eixo (1, 2, 5 × 10^n). */
function niceTicks(min: number, max: number, count = 5) {
  if (min === max) [min, max] = [min - 1, max + 1];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}K`.replace('.', ',') : `${Math.round(v * 10) / 10}`.replace('.', ','));

/**
 * Gráfico de linhas, uma por agente, com o número da partida no eixo x.
 * A dica (crosshair) lê os dados de `data-tips`; quem instala é installChartHover().
 */
export function lineChart(opts: { label: string; series: Series[]; yFormat?: (v: number) => string; yMin?: number }) {
  const series = opts.series.slice(0, MAX_SERIES).filter((s) => s.values.length);
  const fmt = opts.yFormat ?? compact;
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(opts.yMin ?? Infinity, ...all), Math.max(...all));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const px = (i: number) => M.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - M.l - M.r);
  const py = (v: number) => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const xTicks = niceTicks(1, n, 6).filter((t) => t >= 1 && t <= n && Number.isInteger(t));

  const grid = ticks
    .map((t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${py(t)}" y2="${py(t)}" class="grid"/><text x="${M.l - 6}" y="${py(t) + 4}" class="tick" text-anchor="end">${esc(fmt(t))}</text>`)
    .join('');
  const xAxis = xTicks.map((t) => `<text x="${px(t - 1)}" y="${H - M.b + 16}" class="tick" text-anchor="middle">${t}</text>`).join('');
  const lines = series
    .map((s, i) => {
      const d = s.values.map((v, j) => `${j ? 'L' : 'M'}${px(j).toFixed(1)},${py(v).toFixed(1)}`).join('');
      const last = s.values.length - 1;
      return `<path d="${d}" class="line" style="stroke:var(--s${i + 1})"/><circle cx="${px(last)}" cy="${py(s.values[last])}" r="4" class="end" style="fill:var(--s${i + 1})"/>`;
    })
    .join('');
  // Dica por partida: todas as séries naquele x
  const tips = Array.from({ length: n }, (_, j) => ({
    t: `Partida ${j + 1}`,
    r: series.map((s, i) => ({ c: i + 1, n: s.name, v: j < s.values.length ? fmt(s.values[j]) : '—', x: s.notes?.[j] ?? '' })),
  }));
  return (
    `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.label)}" data-kind="line" data-n="${n}" data-x0="${M.l}" data-x1="${W - M.r}" data-tips="${esc(JSON.stringify(tips))}">` +
    `${grid}<line x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}" class="axis"/>${xAxis}` +
    `<text x="${(M.l + W - M.r) / 2}" y="${H - 2}" class="tick" text-anchor="middle">partida</text>` +
    `${lines}<line class="crosshair" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/></svg>`
  );
}

export const OUTCOMES: Outcome[] = ['won', 'dead-pit', 'dead-wumpus', 'timeout', 'error'];

/** Barras 100% empilhadas: como terminaram as partidas de cada agente. */
export function outcomeBars(rows: { name: string; counts: Record<Outcome, number> }[]) {
  const barH = 20;
  const gap = 14;
  const labelW = 170;
  const h = rows.length * (barH + gap) + 4;
  const x0 = labelW;
  const x1 = W - 56;
  const bars = rows
    .map((r, i) => {
      const total = OUTCOMES.reduce((s, o) => s + r.counts[o], 0) || 1;
      const y = 2 + i * (barH + gap);
      let x = x0;
      const segs = OUTCOMES.filter((o) => r.counts[o] > 0)
        .map((o) => {
          const w = ((x1 - x0) * r.counts[o]) / total;
          const tip = `${r.name} · ${OUTCOME_LABEL[o]}: ${r.counts[o]} (${Math.round((100 * r.counts[o]) / total)}%)`;
          // 2px de folga entre segmentos (cor da superfície), sem borda desenhada
          const seg = `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(0, w - 2).toFixed(1)}" height="${barH}" rx="2" class="seg" style="fill:var(--o-${o})" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>`;
          x += w;
          return seg;
        })
        .join('');
      const wins = Math.round((100 * r.counts.won) / total);
      return `<text x="${labelW - 8}" y="${y + 14}" class="label" text-anchor="end">${esc(r.name.length > 24 ? r.name.slice(0, 23) + '…' : r.name)}</text>${segs}<text x="${x1 + 6}" y="${y + 14}" class="tick">${wins}% vit.</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" aria-label="Resultado das partidas por agente" data-kind="bars">${bars}</svg>`;
}

/** Legenda HTML (identidade nunca só pela cor: marca colorida + nome em texto normal). */
export function legend(names: string[]) {
  return `<ul class="legend">${names
    .slice(0, MAX_SERIES)
    .map((n, i) => `<li><span class="key" style="background:var(--s${i + 1})"></span>${esc(n)}</li>`)
    .join('')}</ul>`;
}

export function outcomeLegend() {
  return `<ul class="legend">${OUTCOMES.map((o) => `<li><span class="key square" style="background:var(--o-${o})"></span>${OUTCOME_LABEL[o]}</li>`).join('')}</ul>`;
}

/**
 * Liga as dicas dos gráficos dentro de `root`: crosshair nas linhas, dica por segmento nas barras.
 * Sem dependências externas: o HTML exportado leva uma cópia desta função (veja html.ts).
 */
export function installChartHover(root: HTMLElement) {
  let tip = root.querySelector<HTMLDivElement>('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    root.append(tip);
  }
  const box = tip;
  const show = (e: PointerEvent, title: string, rows: { c: number; n: string; v: string; x: string }[]) => {
    box.replaceChildren();
    const h = document.createElement('b');
    h.textContent = title;
    box.append(h);
    for (const r of rows) {
      const line = document.createElement('div');
      const key = document.createElement('span');
      key.className = 'key';
      key.style.background = `var(--s${r.c})`;
      const v = document.createElement('strong');
      v.textContent = r.v;
      line.append(key, v, document.createTextNode(` ${r.n}${r.x ? ` · ${r.x}` : ''}`));
      box.append(line);
    }
    box.hidden = false;
    const rect = root.getBoundingClientRect();
    const left = Math.min(e.clientX - rect.left + 14, rect.width - box.offsetWidth - 4);
    box.style.left = `${Math.max(4, left)}px`;
    box.style.top = `${e.clientY - rect.top + 14}px`;
  };
  root.querySelectorAll<SVGSVGElement>('svg.chart[data-kind="line"]').forEach((svg) => {
    const n = Number(svg.dataset.n);
    const x0 = Number(svg.dataset.x0);
    const x1 = Number(svg.dataset.x1);
    const tips = JSON.parse(svg.dataset.tips ?? '[]');
    const cross = svg.querySelector<SVGLineElement>('.crosshair')!;
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * Number(svg.viewBox.baseVal.width);
      const i = n === 1 ? 0 : Math.round(((Math.min(x1, Math.max(x0, x)) - x0) / (x1 - x0)) * (n - 1));
      const cx = x0 + (n === 1 ? 0.5 : i / (n - 1)) * (x1 - x0);
      cross.setAttribute('x1', String(cx));
      cross.setAttribute('x2', String(cx));
      cross.setAttribute('visibility', 'visible');
      show(e, tips[i].t, tips[i].r);
    });
    svg.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      box.hidden = true;
    });
  });
  root.querySelectorAll<SVGRectElement>('svg.chart rect[data-tip]').forEach((rect) => {
    rect.addEventListener('pointermove', (e) => show(e, rect.dataset.tip ?? '', []));
    rect.addEventListener('pointerleave', () => (box.hidden = true));
  });
}
