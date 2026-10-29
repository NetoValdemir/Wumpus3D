// Tela "Análise de relatórios": importa relatórios exportados (HTML ou JSON) e compara os agentes.
// Só lê e mostra: nada sai do navegador, e a lista vale até fechar a página.
import { installChartHover } from './charts';
import { REPORT_CSS, describeConfig, reportSections, renderReportHtml, type NamedAgent } from './html';
import { parseReport, reportFileName, type Report } from './report';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

let reports: Report[] = [];

/** Baixa um arquivo de texto. Devolve false se o navegador bloquear o download. */
export function downloadText(name: string, text: string, type: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export function exportReportHtml(r: Report) {
  return downloadText(reportFileName(r, 'html'), renderReportHtml(r), 'text/html');
}

export function exportReportJson(r: Report) {
  return downloadText(reportFileName(r, 'json'), JSON.stringify(r, null, 2), 'application/json');
}

const msg = (text: string, error = false) => {
  const el = $('#analysis-msg');
  el.textContent = text;
  el.classList.toggle('error', error);
};

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

  const body = $('#analysis-body');
  if (!reports.length) {
    body.innerHTML =
      '<p class="hint">Nenhum relatório carregado. Gere um em <b>Avaliação</b> (painel) ou na <b>Arena</b> e clique em "Abrir na análise", ou importe arquivos exportados antes. Para comparar agentes de forma justa, use a mesma semente e o mesmo número de partidas.</p>';
    return;
  }
  // Nome repetido entre relatórios (o mesmo agente avaliado duas vezes) ganha a origem junto
  const all = reports.flatMap((r) => r.agents.map((agent) => ({ r, agent })));
  const repeated = (name: string) => all.filter((x) => x.agent.name === name).length > 1;
  const named: NamedAgent[] = all.map(({ r, agent }) => ({
    label: repeated(agent.name) ? `${agent.name} · ${r.source && r.source !== 'gerado agora' ? r.source : r.title}` : agent.name,
    agent,
  }));
  const configs = new Set(reports.map((r) => `${r.config.size}|${r.config.pitProbability}|${r.config.seed}|${r.config.maps}`));
  const warn = configs.size > 1 ? '<p class="hint msg">Os relatórios usam mapas diferentes (tamanho, poços, semente ou quantidade). A comparação vale como indicação, não como disputa justa.</p>' : '';
  body.innerHTML = warn + reportSections(named);
  installChartHover(body);
}

export function initAnalysis() {
  document.head.append(Object.assign(document.createElement('style'), { textContent: REPORT_CSS }));
  const close = () => ($('#analysis').hidden = true);
  $('#analysis-close').addEventListener('click', close);
  $('#analysis').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation(); // teclas aqui não controlam o jogo
  });
  $<HTMLInputElement>('#analysis-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
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
  });
  $('#analysis-clear').addEventListener('click', () => {
    reports = [];
    render();
    msg('Lista esvaziada.');
  });
}
