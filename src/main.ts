// Ponto de entrada da página: liga teclado, botões e painéis aos módulos de src/ui e começa a primeira partida.
import './style.css';
import type { Action } from './game/world';
import { initArena, openArena } from './arena/ui';
import { initAnalysis, openAnalysis } from './report/ui';
import { loadSavedMaps } from './storage';
import { $ } from './ui/dom';
import { act, agentStep, isSetupOpen, resetSameMap, restart, setSetupOpen, tick, toggleCamera, togglePlay, toggleReveal, updatePitHint, updateSetup, view } from './ui/game';
import { initBenchPanel } from './ui/bench-panel';
import { visibleBeliefs } from './ui/hud';
import { initGeneticPanel } from './ui/genetic-panel';
import { initHumanPanel, updateHumanPanel } from './ui/human-panel';
import { initMapsPanel } from './ui/maps-panel';
import { refreshPlayerOptions } from './ui/players';
import { cfg, currentGenome, genetics, isHuman, match } from './ui/state';

/** Teclas de quem joga com o teclado. */
const HUMAN_KEYS: Record<string, Action> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'shoot',
  KeyG: 'grab',
};

/** Teclas que valem para qualquer jogador. */
const COMMON_KEYS: Record<string, () => void> = {
  KeyR: () => restart(),
  KeyT: resetSameMap,
  KeyC: () => setSetupOpen(!isSetupOpen()),
  KeyV: toggleCamera,
  KeyM: toggleReveal,
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLSelectElement || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

function onKeyDown(e: KeyboardEvent) {
  if (isTyping(e.target)) return;
  if (!isHuman()) {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyN') agentStep();
  } else if (HUMAN_KEYS[e.code]) {
    e.preventDefault();
    if (!e.repeat) act(HUMAN_KEYS[e.code]);
  }
  COMMON_KEYS[e.code]?.();
}

/** Botões sobre o mapa e do painel "Partida". */
function initGameButtons() {
  // Botões de ação na tela (para celular)
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => btn.addEventListener('click', () => act(btn.dataset.action as Action)));
  const clicks: Record<string, () => void> = {
    '#btn-restart': () => restart(),
    '#go-restart': () => restart(),
    '#go-replay': () => restart(false),
    '#btn-stop': resetSameMap,
    '#btn-reset': resetSameMap,
    '#btn-setup': () => setSetupOpen(!isSetupOpen()),
    '#setup-close': () => setSetupOpen(false),
    '#btn-camera': toggleCamera,
    '#btn-reveal': toggleReveal,
    '#btn-play': togglePlay,
    '#btn-step': agentStep,
    '#open-analysis': openAnalysis,
    '#open-arena': openArena,
  };
  for (const [sel, handler] of Object.entries(clicks)) $(sel).addEventListener('click', handler);
}

/** Mudar tamanho ou porcentagem de poços sorteia outro mapa; trocar de jogador mantém o mapa. */
function initConfigFields() {
  for (const el of [cfg.size, cfg.pits]) {
    el.addEventListener('change', () => {
      updatePitHint();
      restart();
      el.blur();
    });
  }
  cfg.agent.addEventListener('change', () => {
    updateSetup();
    restart(false);
    cfg.agent.blur();
  });
  cfg.speed.addEventListener('input', updateSetup);
  cfg.beliefs.addEventListener('change', () => view.showBeliefs(visibleBeliefs()));
}

/** Troca quem joga para `id` e recomeça no mesmo mapa. */
function switchPlayer(id?: string) {
  if (id) cfg.agent.value = id;
  updateSetup();
  restart(false);
}

function initArenaScreen() {
  initArena({
    genome: currentGenome,
    trainedGenome: () => genetics.trained !== null,
    savedMaps: loadSavedMaps,
    onAgentsChanged: () => {
      const before = cfg.agent.value;
      refreshPlayerOptions();
      if (cfg.agent.value !== before) switchPlayer();
    },
    onWatch: (id) => {
      refreshPlayerOptions();
      switchPlayer(id);
      setSetupOpen(true);
    },
  });
}

window.addEventListener('keydown', onKeyDown);
initGameButtons();
initConfigFields();
initMapsPanel();
initGeneticPanel();
initBenchPanel();
initHumanPanel(() => restart());
initAnalysis();
initArenaScreen();

// Painel aberto em telas largas, fechado no celular
setSetupOpen(window.innerWidth > 760);
refreshPlayerOptions();
updateSetup();
updatePitHint();
updateHumanPanel();
restart();
view.renderer.setAnimationLoop(tick);

// Para depuração no console do navegador
Object.assign(window, { wumpus: { get world() { return match.world; } } });
