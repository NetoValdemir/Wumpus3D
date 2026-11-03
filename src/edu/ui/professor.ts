// Ponto de entrada da área do professor (professor.html): Turmas, Planejar, Relatório, Criador e GitHub.
import '../escola.css';
import { requireSession } from './access';
import { initCreator, openCreator } from './creator-screen';
import { initGitHub } from './github-screen';
import { nav } from './session';
import { setupTabs, setupUserBar } from './tabs';
import { initTeacher, refreshReport, refreshReportPlans } from './teacher-screen';
import { initTurmas, renderTurmas } from './turmas-screen';

const access = requireSession(['professor']);
setupUserBar(access, 'Professor(a)');

const show = setupTabs(['turmas', 'planejar', 'relatorio', 'criador', 'github'], (tab) => {
  if (tab === 'turmas') renderTurmas();
  if (tab === 'relatorio') {
    refreshReportPlans();
    refreshReport();
  }
});

nav.show = show;
nav.go = (tab) => (tab === 'criador' ? openCreator() : show(tab));

initTeacher();
initTurmas();
initCreator();
initGitHub();
// Na área do professor o Criador só monta e salva cavernas (para usar nos planos)
for (const id of ['cr-play-det', 'cr-play-blk']) document.getElementById(id)!.hidden = true;

document.querySelectorAll<HTMLElement>('nav [data-tab]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    nav.go(b.dataset.tab!);
  }),
);
window.addEventListener('hashchange', () => nav.go(location.hash.slice(1)));
nav.go(location.hash.slice(1) || 'turmas');
