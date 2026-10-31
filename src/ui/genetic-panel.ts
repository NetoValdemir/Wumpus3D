// "Agente genético": mostra os pesos em uso e treina novos pesos num Web Worker (a tela não trava).
import { DEFAULT_GENOME, GENES, GENE_LIMIT } from '../agents/genome';
import type { GenerationReport, TrainingOptions } from '../agents/genetic';
import GAWorker from '../agents/ga.worker?worker&inline';
import { saveGenome } from '../storage';
import { $, readInt } from './dom';
import { restart } from './game';
import { genetics, match } from './state';

const TRAINING_INPUTS = ['#ga-gens', '#ga-pop', '#ga-maps', '#ga-on-map'];

let worker: Worker | null = null;
let history: GenerationReport[] = [];
let finalReport: GenerationReport | null = null; // vencedor da validação final

const gaMsg = (text: string) => ($('#ga-msg').textContent = text);

/** Pesos novos (ou null = padrão): guarda, mostra e, se o genético estiver jogando, recomeça com eles. */
function useGenome(genome: number[] | null) {
  genetics.trained = genome;
  saveGenome(genome);
  renderWeights();
  if (match.playerId === 'genetic') restart(false);
}

function renderWeights() {
  const g = genetics.trained ?? DEFAULT_GENOME;
  $('#ga-source').textContent = genetics.trained ? 'treinados por você' : 'padrão (pré-treinado)';
  $<HTMLButtonElement>('#ga-reset').disabled = !genetics.trained;
  const box = $('#ga-weights');
  box.innerHTML = '';
  GENES.forEach((gene, i) => {
    const row = document.createElement('div');
    row.className = 'weight';
    row.title = gene.description;
    const width = (Math.abs(g[i]) / GENE_LIMIT) * 50; // meia barra para cada lado do zero
    row.innerHTML = `<span></span><div class="bar"><i class="${g[i] >= 0 ? 'pos' : 'neg'}" style="width:${width}%"></i></div><b></b>`;
    row.querySelector('span')!.textContent = gene.name;
    row.querySelector('b')!.textContent = g[i].toFixed(1);
    box.append(row);
  });
}

/** Gráfico da aptidão por geração: melhor indivíduo (amarelo) e média da população (marrom). */
function drawChart() {
  const canvas = $<HTMLCanvasElement>('#ga-chart');
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  canvas.hidden = history.length === 0;
  if (!history.length) return;
  const values = history.flatMap((r) => [r.best, r.average]);
  const lo = Math.min(...values);
  const hi = Math.max(...values, lo + 1);
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const x = (i: number) => pad.l + (history.length === 1 ? 0 : (i / (history.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(238,230,216,0.6)';
  ctx.strokeStyle = 'rgba(238,230,216,0.15)';
  ctx.lineWidth = 1;
  for (const v of [lo, (lo + hi) / 2, hi]) {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(v));
    ctx.lineTo(w - pad.r, y(v));
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), 4, y(v) + 6);
  }
  ctx.fillText(`geração ${history.length}`, w - 150, h - 4);
  const line = (key: 'best' | 'average', color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    history.forEach((r, i) => (i ? ctx.lineTo(x(i), y(r[key])) : ctx.moveTo(x(i), y(r[key]))));
    ctx.stroke();
  };
  line('average', '#8a7a66');
  line('best', '#ffcc33');
}

function setTraining(on: boolean) {
  $('#ga-train').textContent = on ? 'Parar treino' : 'Treinar';
  for (const id of TRAINING_INPUTS) $<HTMLInputElement>(id).disabled = on;
}

/** Fim do treino (concluído ou parado): o melhor genoma passa a ser usado. */
function finishTraining(stopped: boolean) {
  worker?.terminate();
  worker = null;
  setTraining(false);
  const last = finalReport ?? history.at(-1);
  if (!last) return gaMsg('Treino parado antes da primeira geração.');
  useGenome(last.bestGenome);
  gaMsg(
    `${stopped ? 'Treino parado' : 'Treino concluído'} na geração ${last.generation}. ` +
      (last.validated
        ? `O vencedor da validação fez ${Math.round(last.best)} pontos por partida em mapas novos. `
        : `Melhor aptidão: ${Math.round(last.best)} pontos por partida. `) +
      'Os novos pesos já estão em uso.',
  );
}

function readTrainingOptions(onMap: boolean): TrainingOptions {
  return {
    size: match.world.size,
    pitProbability: match.world.pitProbability,
    generations: readInt('#ga-gens', 1, 200),
    population: readInt('#ga-pop', 6, 100),
    mapsPerGeneration: readInt('#ga-maps', 1, 200),
    layout: onMap ? match.layout : null,
    seed: genetics.trained ?? DEFAULT_GENOME,
  };
}

/** Cada geração chega do Worker; a última mensagem traz o vencedor da validação. */
function onGeneration(r: GenerationReport, options: TrainingOptions, onMap: boolean) {
  if (r.validated) {
    finalReport = r;
    return;
  }
  history.push(r);
  drawChart();
  gaMsg(
    `Geração ${r.generation} de ${options.generations}: melhor ${Math.round(r.best)}, média ${Math.round(r.average)} pontos.` +
      (r.generation === options.generations && !onMap ? ' Validando os 5 melhores em mapas novos...' : ''),
  );
}

function startTraining() {
  const onMap = $<HTMLInputElement>('#ga-on-map').checked;
  const options = readTrainingOptions(onMap);
  history = [];
  finalReport = null;
  drawChart();
  setTraining(true);
  gaMsg(`Treinando em ${onMap ? 'um só mapa (o atual)' : `mapas ${options.size}×${options.size} sorteados`}... a primeira geração pode levar alguns segundos.`);
  worker = new GAWorker();
  worker.onmessage = (e) => (e.data.type === 'done' ? finishTraining(false) : onGeneration(e.data.report, options, onMap));
  worker.onerror = () => {
    finishTraining(true);
    gaMsg('O treino falhou neste navegador.');
  };
  worker.postMessage(options);
}

export function initGeneticPanel() {
  $('#ga-train').addEventListener('click', () => (worker ? finishTraining(true) : startTraining()));
  $('#ga-reset').addEventListener('click', () => {
    useGenome(null);
    gaMsg('Voltou aos pesos padrão.');
  });
  renderWeights();
  drawChart();
}
