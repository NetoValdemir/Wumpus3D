// Ponto de entrada do modo escola (escola.html): liga as abas às telas.
import '../escola.css';
import { $ } from '../../ui/dom';
import { initBlocks, openBlocks, resizeBlocks } from './blocks-screen';
import { initCreator, openCreator } from './creator-screen';
import { initDetective, openDetective } from './detective-screen';
import { initHome, renderHome } from './home-screen';
import { nav } from './session';
import { initTeacher } from './teacher-screen';

const TABS = ['inicio', 'detetive', 'blocos', 'criador', 'professor'];

function show(tab: string) {
  if (!TABS.includes(tab)) tab = 'inicio';
  for (const t of TABS) $(`#tab-${t}`).hidden = t !== tab;
  document.querySelectorAll<HTMLButtonElement>('nav [data-tab]').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  if (tab === 'blocos') requestAnimationFrame(resizeBlocks);
  if (tab === 'inicio') renderHome();
  window.scrollTo(0, 0);
}

nav.show = show;
nav.detective = (src) => openDetective(src);
nav.blocks = (src) => openBlocks(src);
nav.refreshHome = renderHome;

initHome();
initDetective();
initBlocks();
initCreator();
initTeacher();

/** Abre a aba (sem fonte: o estado em que a tela estava, ou a escolha padrão). */
function go(tab: string) {
  if (tab === 'detetive') openDetective();
  else if (tab === 'blocos') openBlocks();
  else if (tab === 'criador') openCreator();
  else show(tab);
}
document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    go(b.dataset.tab!);
  }),
);
nav.go = go;
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
go(location.hash.slice(1) || 'inicio');
