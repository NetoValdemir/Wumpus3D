// Tela "Análise de relatórios": importa relatórios exportados (HTML ou JSON) e compara os agentes.
// Só lê e mostra: nada sai do navegador, e a lista vale até fechar a página.
import { installChartHover } from './charts';
import { REPORT_CSS, describeConfig, reportSections, renderReportHtml, type NamedAgent } from './html';
import { parseReport, reportFileName, type Report } from './report';

import { $, downloadText, initOverlay, showMessage } from '../ui/dom';

let reports: Report[] = [];

export function exportReportHtml(r: Report) {
  return downloadText(reportFileName(r, 'html'), renderReportHtml(r), 'text/html');
}

export function exportReportJson(r: Report) {
  return downloadText(reportFileName(r, 'json'), JSON.stringify(r, null, 2), 'application/json');
}

const msg = (text: string, error = false) => showMessage('#analysis-msg', text, error);

export function openAnalysis() {
  $('#analysis').hidden = false;
  render();
  $('#analysis-close').focus();
}

/** Acrescenta um relatório gerado no próprio jogo (Avaliação ou Arena) e abre a tela. */
export function addReportToAnalysis(r: Report) {
  reports.push({ ...r, source: r.source ?? 'gerado agora' });
  openAnalysis();
  msg(`"${r.title}" adicionado à análise.`);
}

function render() {
  renderList();
  renderBody();
}

/** Lista dos relatórios carregados, cada um com o botão de remover. */
function renderList() {
  const list = $('#analysis-list');
  list.replaceChildren();
  for (const [i, r] of reports.entries()) {
    const li = document.createElement('li');
    li.className = 'player';
    const text = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = r.title;
    const small = document.createElement('small');
    small.textContent = ` ${r.agents.length} ${r.agents.length === 1 ? 'agente' : 'agentes'} · ${describeConfig(r)}${r.source ? ` · ${r.source}` : ''}`;
    text.append(b, small);
    text.style.flex = '1';
    const del = Object.assign(document.createElement('button'), { textContent: 'Remover' });
    del.addEventListener('click', () => {
      reports.splice(i, 1);
      render();
    });
    li.append(text, del);
    list.append(li);
  }
}

/** Nome mostrado de cada agente: nome repetido entre relatórios (o mesmo agente avaliado duas vezes) ganha a origem junto. */
function namedAgents(): NamedAgent[] {
  const all = reports.flatMap((r) => r.agents.map((agent) => ({ r, agent })));
  const repeated = (name: string) => all.filter((x) => x.agent.name === name).length > 1;
  return all.map(({ r, agent }) => ({
    label: repeated(agent.name) ? `${agent.name} · ${r.source && r.source !== 'gerado agora' ? r.source : r.title}` : agent.name,
    agent,
  }));
}

/** Tabelas e gráficos comparando todos os agentes carregados. */
function renderBody() {
  const body = $('#analysis-body');
  if (!reports.length) {
    body.innerHTML =
      '<p class="hint">Nenhum relatório carregado. Gere um em <b>Avaliação</b> (painel) ou na <b>Arena</b> e clique em "Abrir na análise", ou importe arquivos exportados antes. Para comparar agentes de forma justa, use a mesma semente e o mesmo número de partidas.</p>';
    return;
  }
  const configs = new Set(reports.map((r) => `${r.config.size}|${r.config.pitProbability}|${r.config.seed}|${r.config.maps}`));
  const warn = configs.size > 1 ? '<p class="hint msg">Os relatórios usam mapas diferentes (tamanho, poços, semente ou quantidade). A comparação vale como indicação, não como disputa justa.</p>' : '';
  body.innerHTML = warn + reportSections(namedAgents());
  installChartHover(body);
}

/** Importa relatórios exportados (HTML ou JSON); um arquivo inválido não impede os outros. */
async function importFiles(files: File[]) {
  const added: string[] = [];
  const failed: string[] = [];
  for (const f of files) {
    try {
      reports.push(parseReport(await f.text(), f.name));
      added.push(f.name);
    } catch (err) {
      failed.push(`${f.name}: ${(err as Error).message}`);
    }
  }
  render();
  if (failed.length) msg(`Não deu para importar ${failed.join(' · ')}${added.length ? ` (importados: ${added.join(', ')})` : ''}`, true);
  else if (added.length) msg(`Importado: ${added.join(', ')}.`);
}

export function initAnalysis() {
  document.head.append(Object.assign(document.createElement('style'), { textContent: REPORT_CSS }));
  initOverlay('#analysis', '#analysis-close');
  $<HTMLInputElement>('#analysis-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    await importFiles(files);
  });
  $('#analysis-clear').addEventListener('click', () => {
    reports = [];
    render();
    msg('Lista esvaziada.');
  });
}
