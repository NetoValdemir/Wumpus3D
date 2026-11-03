// Ponto de entrada da área do aluno (aluno.html): Início, Detetive, Blocos, Criador e Trilha de IA.
import '../escola.css';
import { requireSession } from './access';
import { initBlocks, openBlocks, resizeBlocks } from './blocks-screen';
import { initCreator, openCreator } from './creator-screen';
import { initDetective, openDetective } from './detective-screen';
import { initHome, renderHome } from './home-screen';
import { nav } from './session';
import { setupTabs, setupUserBar } from './tabs';
import { initTrilha, openLesson } from './trilha-screen';

const access = requireSession(['aluno', 'visitante']);
setupUserBar(access, access.role === 'aluno' ? 'Aluno' : 'Sem turma');

const show = setupTabs(['inicio', 'detetive', 'blocos', 'criador', 'trilha'], (tab) => {
  if (tab === 'blocos') requestAnimationFrame(resizeBlocks);
  if (tab === 'inicio') renderHome();
});

/** Abre a aba preparando a tela (sem fonte: o estado em que estava, ou a escolha padrão). */
function go(tab: string) {
  if (tab === 'detetive') openDetective();
  else if (tab === 'blocos') openBlocks();
  else if (tab === 'criador') openCreator();
  else if (tab === 'trilha') openLesson();
  else show(tab);
}

nav.show = show;
nav.go = go;
nav.detective = (src) => openDetective(src);
nav.blocks = (src) => openBlocks(src);
nav.lesson = (id, activity) => openLesson(id, activity);
nav.refreshHome = renderHome;

initHome();
initDetective();
initBlocks();
initCreator();
initTrilha();

document.querySelectorAll<HTMLElement>('nav [data-tab]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    go(b.dataset.tab!);
  }),
);
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
go(location.hash.slice(1) || 'inicio');
