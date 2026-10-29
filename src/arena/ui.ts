// Tela da Arena: importar agentes de outros devs, rodar a competição e mostrar o ranking.
import type { MapLayout } from '../game/world';
import { AGENTS, type AgentId } from '../agents/agents';
import { deleteExternalAgent, loadExternalAgents, saveExternalAgent, type ExternalAgent } from '../storage';
import { arenaMaps } from './rng';
import { builtinController, playEpisode, type EpisodeResult } from './runner';
import { aggregate, rank, toMarkdown, type AgentStats, type ArenaMeta } from './ranking';
import { WorkerSandbox } from './sandbox';
import type { Controller } from './protocol';
import TEMPLATE from '../../agents/exemplo-cauteloso.js?raw';
import { buildReport, type Report } from '../report/report';
import { addReportToAnalysis, exportReportHtml, exportReportJson } from '../report/ui';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

type BuiltinId = Exclude<AgentId, 'human'>;
const BUILTINS: BuiltinId[] = ['random', 'logic', 'bayes', 'genetic'];

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

// Lista em memória: continua funcionando nesta sessão mesmo se o navegador bloquear o armazenamento
let agents: ExternalAgent[] = loadExternalAgents();
const selected = new Set<string>([...BUILTINS.filter((b) => b !== 'random'), ...agents.map((a) => `ext:${a.id}`)]);
let lastRun: { meta: ArenaMeta; ranking: AgentStats[]; report: Report } | null = null;
let running = false;
let cancel = false;

export const externalAgents = () => agents;

export const externalById = (id: string) => agents.find((a) => a.id === id);

const msg = (sel: string, text: string, error = false) => {
  const el = $(sel);
  el.textContent = text;
  el.classList.toggle('error', error);
};

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

let refreshPlayers = () => {};

export function openArena() {
  refreshPlayers(); // os pesos do genético podem ter mudado desde a última vez
  $('#arena').hidden = false;
  $('#arena-close').focus();
}

export function initArena(opts: ArenaOptions) {
  const close = () => {
    $('#arena').hidden = true;
  };
  $('#arena-close').addEventListener('click', close);
  $('#arena').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation(); // teclas digitadas aqui não controlam o jogo
  });

  const addAgents = async (codes: string[]) => {
    const added: string[] = [];
    for (const code of codes) {
      try {
        const agent = await inspect(code);
        agents = [...agents.filter((a) => a.id !== agent.id), agent];
        saveExternalAgent(agent);
        selected.add(`ext:${agent.id}`);
        added.push(`"${agent.name}" de ${agent.author}`);
      } catch (err) {
        msg('#agent-msg', `Não deu para importar: ${(err as Error).message}`, true);
        renderPlayers();
        opts.onAgentsChanged();
        return;
      }
    }
    msg('#agent-msg', `Agente ${added.join(', ')} importado. Ele já aparece em "Quem joga" e na competição.`);
    renderPlayers();
    opts.onAgentsChanged();
  };

  $<HTMLInputElement>('#agent-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const codes = await Promise.all([...(input.files ?? [])].map((f) => f.text()));
    input.value = '';
    if (codes.length) addAgents(codes);
  });
  $('#agent-add').addEventListener('click', () => {
    const code = $<HTMLTextAreaElement>('#agent-code').value;
    if (!code.trim()) return msg('#agent-msg', 'Cole o código de um agente na caixa acima.', true);
    addAgents([code]);
  });
  $('#agent-template').addEventListener('click', () => {
    $<HTMLTextAreaElement>('#agent-code').value = TEMPLATE;
    $<HTMLDetailsElement>('#agent-paste').open = true;
    msg('#agent-msg', 'Este é o agente de exemplo. Edite, depois clique em "Adicionar agente", ou copie para um arquivo .js.');
  });
  $('#agent-copy').addEventListener('click', async () => {
    const box = $<HTMLTextAreaElement>('#agent-code');
    try {
      await navigator.clipboard.writeText(box.value);
      msg('#agent-msg', 'Código copiado.');
    } catch {
      box.select();
      msg('#agent-msg', 'Não deu para copiar automaticamente. O texto está selecionado: use Ctrl+C.');
    }
  });

  function renderPlayers() {
    const box = $('#arena-players');
    box.innerHTML = '';
    const row = (id: string, name: string, detail: string, external?: ExternalAgent) => {
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
          opts.onWatch(id);
        });
        const del = Object.assign(document.createElement('button'), { textContent: 'Remover' });
        del.addEventListener('click', () => {
          if (!del.dataset.confirm) {
            del.dataset.confirm = '1';
            del.textContent = 'Confirmar?';
            return;
          }
          agents = agents.filter((a) => a.id !== external.id);
          deleteExternalAgent(external.id);
          selected.delete(id);
          renderPlayers();
          opts.onAgentsChanged();
        });
        div.append(watch, del);
      }
      box.append(div);
    };
    for (const id of BUILTINS) row(id, AGENTS[id].label, id === 'genetic' && opts.trainedGenome() ? 'pesos treinados neste navegador' : 'referência');
    for (const a of agents) row(`ext:${a.id}`, a.name, `por ${a.author}`, a);
    if (!agents.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Nenhum agente importado ainda. Importe um arquivo .js ou abra o modelo para começar.';
      box.append(p);
    }
  }

  async function runCompetition() {
    if (running) {
      cancel = true;
      return;
    }
    const players = [...selected]
      .map((id) => {
        if (id.startsWith('ext:')) {
          const a = externalById(id.slice(4));
          return a && { name: a.name, author: a.author, external: a };
        }
        // Pesos treinados mudam o agente: o nome avisa, para o ranking não ser confundido com o padrão
        const trained = id === 'genetic' && opts.trainedGenome();
        return { name: `${AGENTS[id as BuiltinId].label}${trained ? ' (pesos treinados)' : ''}`, author: 'Wumpus 3D', builtin: id as BuiltinId };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!players.length) return msg('#arena-status', 'Marque pelo menos um participante.', true);

    const num = (sel: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number($<HTMLInputElement>(sel).value) || min)));
    const count = num('#arena-maps', 1, 1000);
    const size = Number($<HTMLSelectElement>('#arena-size').value);
    const pits = Number($<HTMLSelectElement>('#arena-pits').value);
    const seed = $<HTMLInputElement>('#arena-seed').value.trim() || 'wumpus';
    const timeout = num('#arena-timeout', 50, 10000);
    const useSaved = $<HTMLInputElement>('#arena-saved').checked;
    const maps = useSaved ? opts.savedMaps() : arenaMaps(seed, count, size, pits);
    if (!maps.length) return msg('#arena-status', 'Você ainda não salvou nenhum mapa. Desmarque "Usar meus mapas salvos" ou salve um mapa no painel.', true);

    running = true;
    cancel = false;
    $('#arena-run').textContent = 'Parar competição';
    const progress = $<HTMLProgressElement>('#arena-progress');
    progress.hidden = false;
    progress.max = maps.length * players.length;
    progress.value = 0;

    const controllers: Controller[] = players.map((p) =>
      p.external ? new WorkerSandbox(p.external.code, timeout) : builtinController(p.builtin!, { genome: opts.genome() }),
    );
    const results: EpisodeResult[][] = players.map(() => []);
    for (let m = 0; m < maps.length && !cancel; m++) {
      for (let i = 0; i < players.length && !cancel; i++) {
        results[i].push(await playEpisode(controllers[i], maps[m], timeout));
        progress.value++;
      }
      msg('#arena-status', `Mapa ${m + 1} de ${maps.length}...`);
      await new Promise((r) => setTimeout(r)); // deixa a tela atualizar
    }
    controllers.forEach((c) => c.dispose?.());

    const played = results[0].length;
    const meta: ArenaMeta = {
      seed: useSaved ? 'mapas salvos' : seed,
      maps: played,
      size: useSaved ? maps[0].size : size,
      pitProbability: useSaved ? maps[0].pitProbability : pits,
      date: new Date().toISOString().slice(0, 10),
    };
    const ranking = rank(players.map((p, i) => aggregate(p.name, p.author, results[i])));
    // Relatório na ordem do ranking (as cores dos gráficos seguem essa ordem)
    const order = ranking.map((s) => players.findIndex((p) => p.name === s.name && p.author === s.author));
    const report = buildReport({
      title: `Arena: ${players.length} ${players.length === 1 ? 'agente' : 'agentes'} em ${played} mapas`,
      origin: 'arena',
      config: { size: meta.size, pitProbability: meta.pitProbability, maps: played, seed: meta.seed },
      agents: order.map((i) => ({ name: players[i].name, author: players[i].author, results: results[i] })),
    });
    if (useSaved && new Set(maps.map((m) => m.size)).size > 1) report.config.size = null;
    lastRun = { meta, ranking, report };
    renderTable($('#arena-table'), ranking);
    $('#arena-results').hidden = false;
    msg('#arena-status', `${cancel ? 'Competição interrompida' : 'Competição concluída'}: ${played} mapas por agente.${useSaved ? ' (mapas salvos podem ter tamanhos diferentes)' : ''}`);
    progress.hidden = true;
    $('#arena-run').textContent = 'Iniciar competição';
    running = false;
  }
  $('#arena-run').addEventListener('click', runCompetition);

  $('#arena-copy-md').addEventListener('click', async () => {
    if (!lastRun) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(lastRun.ranking, lastRun.meta));
      msg('#arena-status', 'Ranking copiado em Markdown (pronto para colar num PR, issue ou chat).');
    } catch {
      msg('#arena-status', 'Não deu para copiar automaticamente neste navegador.', true);
    }
  });
  const blocked = () => msg('#arena-status', 'O navegador bloqueou o download. Use "Copiar ranking" ou "Abrir na análise".', true);
  $('#arena-html').addEventListener('click', () => {
    if (!lastRun) return;
    if (exportReportHtml(lastRun.report)) msg('#arena-status', 'Relatório exportado: abre em qualquer navegador e pode ser importado na Análise de relatórios.');
    else blocked();
  });
  $('#arena-export').addEventListener('click', () => {
    if (!lastRun) return;
    if (exportReportJson(lastRun.report)) msg('#arena-status', 'Dados exportados em JSON (o mesmo conteúdo do relatório, sem os gráficos).');
    else blocked();
  });
  $('#arena-analysis').addEventListener('click', () => lastRun && addReportToAnalysis(lastRun.report));

  // Ranking oficial: publicado pelo GitHub Actions junto com o site (public/ranking.json)
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

  renderPlayers();
  refreshPlayers = renderPlayers;
}

function renderTable(table: HTMLElement, ranking: AgentStats[]) {
  const pct = (v: number, n: number) => `${n ? Math.round((100 * v) / n) : 0}%`;
  const num = (v: number | null, d = 1) => (v === null ? '—' : v.toFixed(d));
  const head = ['#', 'Agente', 'Pontos', 'Vitórias', 'Mortes (poço/Wumpus)', 'Tempo esgotado', 'Erros', 'Ações/vitória', 'ms/decisão', 'Erros de lógica', 'Riscos desnecessários', 'Tiros certeiros'];
  table.innerHTML = `<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>`;
  const body = document.createElement('tbody');
  ranking.forEach((s, i) => {
    const tr = document.createElement('tr');
    const cells = [
      ['🥇', '🥈', '🥉'][i] ?? String(i + 1),
      '',
      String(Math.round(s.avgScore)),
      pct(s.wins, s.games),
      `${pct(s.deathsPit + s.deathsWumpus, s.games)} (${s.deathsPit}/${s.deathsWumpus})`,
      pct(s.timeouts, s.games),
      pct(s.errors, s.games),
      num(s.avgActionsPerWin),
      num(s.avgDecisionMs, 2),
      num(s.logicErrorsPerGame, 2),
      num(s.needlessRisksPerGame, 2),
      s.hitRate === null ? '—' : pct(s.hitRate, 1),
    ];
    cells.forEach((c, j) => {
      const td = document.createElement('td');
      if (j === 1) {
        td.innerHTML = '<b></b><small></small>';
        td.querySelector('b')!.textContent = s.name;
        td.querySelector('small')!.textContent = s.author;
        if (s.firstError) td.title = `Primeiro erro: ${s.firstError}`;
      } else td.textContent = c;
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(body);
}
