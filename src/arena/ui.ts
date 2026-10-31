// Tela da Arena: importar agentes de outros devs, rodar a competição e mostrar o ranking.
import type { MapLayout } from '../game/world';
import { AGENTS } from '../agents/agents';
import type { BuiltinAgentId } from '../agents/benchmark';
import { deleteExternalAgent, loadExternalAgents, saveExternalAgent, type ExternalAgent } from '../storage';
import { arenaMaps } from './rng';
import { builtinController, playEpisode, type EpisodeResult } from './runner';
import { aggregate, rank, rankingCells, toMarkdown, type AgentStats, type ArenaMeta } from './ranking';
import { WorkerSandbox } from './sandbox';
import type { Controller } from './protocol';
import TEMPLATE from '../../agents/exemplo-cauteloso.js?raw';
import { buildReport, type Report } from '../report/report';
import { addReportToAnalysis, exportReportHtml, exportReportJson } from '../report/ui';
import { $, confirmTwice, copyFromBox, initOverlay, nextFrame, readInt, showMessage } from '../ui/dom';

const BUILTINS: BuiltinAgentId[] = ['random', 'logic', 'bayes', 'genetic'];

interface ArenaOptions {
  genome: () => number[];
  /** true quando o genético usa pesos treinados neste navegador (não os padrão) */
  trainedGenome: () => boolean;
  savedMaps: () => MapLayout[];
  /** Avisado quando a lista de agentes importados muda (para atualizar o seletor "Quem joga") */
  onAgentsChanged: () => void;
  /** Pede para assistir um agente importado jogando no 3D */
  onWatch: (playerId: string) => void;
}

/** Participante da competição: um agente embutido ou um importado. */
interface Player {
  name: string;
  author: string;
  builtin?: BuiltinAgentId;
  external?: ExternalAgent;
}

interface ArenaSettings {
  maps: MapLayout[];
  timeout: number;
  useSaved: boolean;
  seed: string;
  size: number;
  pits: number;
}

// Lista em memória: continua funcionando nesta sessão mesmo se o navegador bloquear o armazenamento
let agents: ExternalAgent[] = loadExternalAgents();
const selected = new Set<string>([...BUILTINS.filter((b) => b !== 'random'), ...agents.map((a) => `ext:${a.id}`)]);
let lastRun: { meta: ArenaMeta; ranking: AgentStats[]; report: Report } | null = null;
let running = false;
let cancel = false;
let options: ArenaOptions;

export const externalAgents = () => agents;

export const externalById = (id: string) => agents.find((a) => a.id === id);

const status = (text: string, error = false) => showMessage('#arena-status', text, error);
const agentMsg = (text: string, error = false) => showMessage('#agent-msg', text, error);

/** Valida o código num Worker isolado e devolve o agente pronto para guardar. */
async function inspect(code: string): Promise<ExternalAgent> {
  const sandbox = new WorkerSandbox(code);
  try {
    const meta = await sandbox.meta();
    // Joga um passo de teste para pegar erros óbvios logo na importação
    await sandbox.start({ size: 4, pitProbability: 0.2, maxActions: 320 });
    await sandbox.decide({ x: 0, y: 0, dir: 0, hasArrow: true, hasGold: false, step: 0, percepts: { stench: false, breeze: false, glitter: false, bump: false, scream: false } });
    const id = `${meta.author}/${meta.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { id, ...meta, code };
  } finally {
    sandbox.dispose();
  }
}

export function openArena() {
  renderPlayers(); // os pesos do genético podem ter mudado desde a última vez
  $('#arena').hidden = false;
  $('#arena-close').focus();
}

export function initArena(opts: ArenaOptions) {
  options = opts;
  initOverlay('#arena', '#arena-close');
  initImport();
  initResultButtons();
  $('#arena-run').addEventListener('click', runCompetition);
  loadOfficialRanking();
  renderPlayers();
}

// ---------- Importar agentes ----------

function agentsChanged() {
  renderPlayers();
  options.onAgentsChanged();
}

/** Importa um ou mais agentes; para no primeiro que falhar, mantendo os que já entraram. */
async function addAgents(codes: string[]) {
  const added: string[] = [];
  for (const code of codes) {
    try {
      const agent = await inspect(code);
      agents = [...agents.filter((a) => a.id !== agent.id), agent];
      saveExternalAgent(agent);
      selected.add(`ext:${agent.id}`);
      added.push(`"${agent.name}" de ${agent.author}`);
    } catch (err) {
      agentMsg(`Não deu para importar: ${(err as Error).message}`, true);
      agentsChanged();
      return;
    }
  }
  agentMsg(`Agente ${added.join(', ')} importado. Ele já aparece em "Quem joga" e na competição.`);
  agentsChanged();
}

function initImport() {
  const codeBox = $<HTMLTextAreaElement>('#agent-code');
  $<HTMLInputElement>('#agent-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const codes = await Promise.all([...(input.files ?? [])].map((f) => f.text()));
    input.value = '';
    if (codes.length) addAgents(codes);
  });
  $('#agent-add').addEventListener('click', () => {
    if (!codeBox.value.trim()) return agentMsg('Cole o código de um agente na caixa acima.', true);
    addAgents([codeBox.value]);
  });
  $('#agent-template').addEventListener('click', () => {
    codeBox.value = TEMPLATE;
    $<HTMLDetailsElement>('#agent-paste').open = true;
    agentMsg('Este é o agente de exemplo. Edite, depois clique em "Adicionar agente", ou copie para um arquivo .js.');
  });
  $('#agent-copy').addEventListener('click', () => copyFromBox(codeBox, agentMsg, 'Código copiado.'));
}

// ---------- Participantes ----------

function removeAgent(external: ExternalAgent) {
  agents = agents.filter((a) => a.id !== external.id);
  deleteExternalAgent(external.id);
  selected.delete(`ext:${external.id}`);
  agentsChanged();
}

/** Linha de um participante: caixa de seleção e, nos importados, os botões Assistir e Remover. */
function playerRow(id: string, name: string, detail: string, external?: ExternalAgent) {
  const div = document.createElement('div');
  div.className = 'player';
  const label = document.createElement('label');
  label.className = 'check';
  const check = Object.assign(document.createElement('input'), { type: 'checkbox', checked: selected.has(id) });
  check.addEventListener('change', () => (check.checked ? selected.add(id) : selected.delete(id)));
  const text = document.createElement('span');
  text.innerHTML = '<b></b> <small></small>';
  text.querySelector('b')!.textContent = name;
  text.querySelector('small')!.textContent = detail;
  label.append(check, text);
  div.append(label);
  if (external) {
    const watch = Object.assign(document.createElement('button'), { textContent: 'Assistir', title: 'Ver este agente jogando no mapa atual' });
    watch.addEventListener('click', () => {
      $('#arena').hidden = true;
      options.onWatch(id);
    });
    const del = Object.assign(document.createElement('button'), { textContent: 'Remover' });
    confirmTwice(del, { confirmLabel: () => 'Confirmar?', onConfirm: () => removeAgent(external) });
    div.append(watch, del);
  }
  return div;
}

function renderPlayers() {
  const box = $('#arena-players');
  box.innerHTML = '';
  for (const id of BUILTINS) box.append(playerRow(id, AGENTS[id].label, id === 'genetic' && options.trainedGenome() ? 'pesos treinados neste navegador' : 'referência'));
  for (const a of agents) box.append(playerRow(`ext:${a.id}`, a.name, `por ${a.author}`, a));
  if (!agents.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Nenhum agente importado ainda. Importe um arquivo .js ou abra o modelo para começar.';
    box.append(p);
  }
}

/** Participantes marcados (agentes removidos desde a marcação ficam de fora). */
function selectedPlayers(): Player[] {
  return [...selected]
    .map((id): Player | undefined => {
      if (id.startsWith('ext:')) {
        const a = externalById(id.slice(4));
        return a && { name: a.name, author: a.author, external: a };
      }
      // Pesos treinados mudam o agente: o nome avisa, para o ranking não ser confundido com o padrão
      const trained = id === 'genetic' && options.trainedGenome();
      return { name: `${AGENTS[id as BuiltinAgentId].label}${trained ? ' (pesos treinados)' : ''}`, author: 'Wumpus 3D', builtin: id as BuiltinAgentId };
    })
    .filter((p): p is Player => !!p);
}

// ---------- Competição ----------

function readSettings(): ArenaSettings {
  const size = Number($<HTMLSelectElement>('#arena-size').value);
  const pits = Number($<HTMLSelectElement>('#arena-pits').value);
  const seed = $<HTMLInputElement>('#arena-seed').value.trim() || 'wumpus';
  const useSaved = $<HTMLInputElement>('#arena-saved').checked;
  const maps = useSaved ? options.savedMaps() : arenaMaps(seed, readInt('#arena-maps', 1, 1000), size, pits);
  return { maps, timeout: readInt('#arena-timeout', 50, 10000), useSaved, seed, size, pits };
}

function setRunning(on: boolean, total = 0) {
  running = on;
  $('#arena-run').textContent = on ? 'Parar competição' : 'Iniciar competição';
  const progress = $<HTMLProgressElement>('#arena-progress');
  progress.hidden = !on;
  if (on) {
    progress.max = total;
    progress.value = 0;
  }
}

/** Todos os participantes jogam cada mapa antes de passar ao próximo (dá para interromper no meio). */
async function playMaps(players: Player[], settings: ArenaSettings) {
  const progress = $<HTMLProgressElement>('#arena-progress');
  const controllers: Controller[] = players.map((p) =>
    p.external ? new WorkerSandbox(p.external.code, settings.timeout) : builtinController(p.builtin!, { genome: options.genome() }),
  );
  const results: EpisodeResult[][] = players.map(() => []);
  const { maps } = settings;
  for (let m = 0; m < maps.length && !cancel; m++) {
    for (let i = 0; i < players.length && !cancel; i++) {
      results[i].push(await playEpisode(controllers[i], maps[m], settings.timeout));
      progress.value++;
    }
    status(`Mapa ${m + 1} de ${maps.length}...`);
    await nextFrame();
  }
  controllers.forEach((c) => c.dispose?.());
  return results;
}

/** Ranking e relatório (na ordem do ranking, que é a ordem das cores dos gráficos). */
function summarize(players: Player[], results: EpisodeResult[][], settings: ArenaSettings) {
  const { maps, useSaved } = settings;
  const played = results[0].length;
  const meta: ArenaMeta = {
    seed: useSaved ? 'mapas salvos' : settings.seed,
    maps: played,
    size: useSaved ? maps[0].size : settings.size,
    pitProbability: useSaved ? maps[0].pitProbability : settings.pits,
    date: new Date().toISOString().slice(0, 10),
  };
  const ranking = rank(players.map((p, i) => aggregate(p.name, p.author, results[i])));
  const order = ranking.map((s) => players.findIndex((p) => p.name === s.name && p.author === s.author));
  const report = buildReport({
    title: `Arena: ${players.length} ${players.length === 1 ? 'agente' : 'agentes'} em ${played} mapas`,
    origin: 'arena',
    config: { size: meta.size, pitProbability: meta.pitProbability, maps: played, seed: meta.seed },
    agents: order.map((i) => ({ name: players[i].name, author: players[i].author, results: results[i] })),
  });
  if (useSaved && new Set(maps.map((m) => m.size)).size > 1) report.config.size = null;
  return { meta, ranking, report };
}

async function runCompetition() {
  if (running) {
    cancel = true;
    return;
  }
  const players = selectedPlayers();
  if (!players.length) return status('Marque pelo menos um participante.', true);
  const settings = readSettings();
  if (!settings.maps.length) return status('Você ainda não salvou nenhum mapa. Desmarque "Usar meus mapas salvos" ou salve um mapa no painel.', true);

  cancel = false;
  setRunning(true, settings.maps.length * players.length);
  const results = await playMaps(players, settings);
  lastRun = summarize(players, results, settings);
  renderTable($('#arena-table'), lastRun.ranking);
  $('#arena-results').hidden = false;
  status(`${cancel ? 'Competição interrompida' : 'Competição concluída'}: ${lastRun.meta.maps} mapas por agente.${settings.useSaved ? ' (mapas salvos podem ter tamanhos diferentes)' : ''}`);
  setRunning(false);
}

// ---------- Resultados ----------

function initResultButtons() {
  $('#arena-copy-md').addEventListener('click', async () => {
    if (!lastRun) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(lastRun.ranking, lastRun.meta));
      status('Ranking copiado em Markdown (pronto para colar num PR, issue ou chat).');
    } catch {
      status('Não deu para copiar automaticamente neste navegador.', true);
    }
  });
  const exportWith = (save: (r: Report) => boolean, done: string) => () => {
    if (!lastRun) return;
    if (save(lastRun.report)) status(done);
    else status('O navegador bloqueou o download. Use "Copiar ranking" ou "Abrir na análise".', true);
  };
  $('#arena-html').addEventListener('click', exportWith(exportReportHtml, 'Relatório exportado: abre em qualquer navegador e pode ser importado na Análise de relatórios.'));
  $('#arena-export').addEventListener('click', exportWith(exportReportJson, 'Dados exportados em JSON (o mesmo conteúdo do relatório, sem os gráficos).'));
  $('#arena-analysis').addEventListener('click', () => lastRun && addReportToAnalysis(lastRun.report));
}

/** Ranking oficial: publicado pelo GitHub Actions junto com o site (public/ranking.json). */
function loadOfficialRanking() {
  fetch('ranking.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { meta: ArenaMeta; ranking: AgentStats[] } | null) => {
      if (!data?.ranking) return;
      const m = data.meta;
      $('#arena-official-meta').textContent = `${m.maps} mapas ${m.size}×${m.size}, ${Math.round(m.pitProbability * 100)}% de poços, atualizado em ${m.date}. Semente secreta, para ninguém treinar nos mapas da prova.`;
      renderTable($('#arena-official-table'), data.ranking);
      $('#arena-official').hidden = false;
    })
    .catch(() => {
      // sem ranking oficial (rodando localmente ou fora do GitHub Pages)
    });
}

const TABLE_HEAD = ['#', 'Agente', 'Pontos', 'Vitórias', 'Mortes (poço/Wumpus)', 'Tempo esgotado', 'Erros', 'Ações/vitória', 'ms/decisão', 'Erros de lógica', 'Riscos desnecessários', 'Tiros certeiros'];

/** Célula do agente: nome e autor; o primeiro erro aparece ao passar o mouse. */
function agentCell(s: AgentStats) {
  const td = document.createElement('td');
  td.innerHTML = '<b></b><small></small>';
  td.querySelector('b')!.textContent = s.name;
  td.querySelector('small')!.textContent = s.author;
  if (s.firstError) td.title = `Primeiro erro: ${s.firstError}`;
  return td;
}

function renderTable(table: HTMLElement, ranking: AgentStats[]) {
  table.innerHTML = `<thead><tr>${TABLE_HEAD.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>`;
  const body = document.createElement('tbody');
  ranking.forEach((s, i) => {
    const c = rankingCells(s);
    const tr = document.createElement('tr');
    const text = (t: string) => Object.assign(document.createElement('td'), { textContent: t });
    tr.append(
      text(['🥇', '🥈', '🥉'][i] ?? String(i + 1)),
      agentCell(s),
      ...[c.score, c.wins, `${c.deaths} (${s.deathsPit}/${s.deathsWumpus})`, c.timeouts, c.errors, c.actionsPerWin, c.msPerDecision, c.logicErrors, c.needlessRisks, c.hitRate].map(text),
    );
    body.append(tr);
  });
  table.append(body);
}
