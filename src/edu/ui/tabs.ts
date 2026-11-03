// Abas e barra de cima das áreas do aluno e do professor.
import { $ } from '../../ui/dom';
import { endSession, type Session } from './access';

/** Liga as abas da página (botões [data-tab] e seções #tab-<nome>). Devolve a função que mostra uma aba. */
export function setupTabs(tabs: string[], onShow: (tab: string) => void = () => {}) {
  const show = (tab: string) => {
    if (!tabs.includes(tab)) tab = tabs[0];
    for (const t of tabs) $(`#tab-${t}`).hidden = t !== tab;
    document.querySelectorAll<HTMLButtonElement>('nav [data-tab]').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    onShow(tab);
    window.scrollTo(0, 0);
  };
  return show;
}

/** Nome de quem entrou e o botão Sair (volta para a tela inicial). */
export function setupUserBar(s: Session, label: string) {
  $('#who').textContent = `${label}: ${s.name}`;
  $('#logout').addEventListener('click', () => {
    endSession();
    location.href = './escola.html';
  });
}
