// Mapas, genoma, agentes importados e partidas salvos no navegador (localStorage). Tudo protegido por
// try/catch: em janela anônima ou com armazenamento bloqueado, o jogo continua funcionando sem salvar.
import { parseLayout, type MapLayout } from './game/world';
import { GENES } from './agents/genome';
import type { HumanGame } from './report/human';

const MAPS_KEY = 'wumpus3d.maps';
const GENOME_KEY = 'wumpus3d.genome';
const AGENTS_KEY = 'wumpus3d.agents';
const HUMAN_KEY = 'wumpus3d.humanGames';
const PLAYER_KEY = 'wumpus3d.player';
const HUMAN_LIMIT = 1000; // guarda as últimas 1000 partidas (cada uma leva o mapa junto)

/** Valor guardado em JSON; `fallback` se não existir, estiver corrompido ou o navegador bloquear. */
function readJson(key: string, fallback: unknown): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lista guardada, só com os itens que passam em `valid`. */
function readList<T>(key: string, valid: (item: unknown) => boolean): T[] {
  const raw = readJson(key, []);
  return Array.isArray(raw) ? (raw.filter(valid) as T[]) : [];
}

/** Guarda em JSON. Devolve false se o navegador bloquear. */
function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Substitui (ou acrescenta) o item com a mesma identidade. */
const upsert = <T>(list: T[], item: T, same: (a: T) => boolean) => [...list.filter((a) => !same(a)), item];

// ---------- Mapas ----------

export function loadSavedMaps(): MapLayout[] {
  const raw = readJson(MAPS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    try {
      return [parseLayout(JSON.stringify(m))];
    } catch {
      return []; // ignora entradas corrompidas
    }
  });
}

/** Salva (ou substitui, se já existir um com o mesmo nome). Devolve false se o navegador bloquear. */
export const saveMap = (layout: MapLayout) => writeJson(MAPS_KEY, upsert(loadSavedMaps(), layout, (m) => m.name === layout.name));

export const deleteMap = (name: string) => writeJson(MAPS_KEY, loadSavedMaps().filter((m) => m.name !== name));

// ---------- Genoma treinado ----------

export function loadGenome(): number[] | null {
  const g = readJson(GENOME_KEY, null);
  return Array.isArray(g) && g.length === GENES.length && g.every((v) => typeof v === 'number') ? g : null;
}

/** null volta ao genoma padrão. Sem armazenamento, o genoma vale só nesta sessão. */
export function saveGenome(genome: number[] | null) {
  if (genome) return writeJson(GENOME_KEY, genome);
  try {
    localStorage.removeItem(GENOME_KEY);
  } catch {
    // sem armazenamento: nada a apagar
  }
}

// ---------- Agentes importados ----------

export interface ExternalAgent {
  id: string;
  name: string;
  author: string;
  description: string;
  code: string;
}

export const loadExternalAgents = () =>
  readList<ExternalAgent>(AGENTS_KEY, (a) => !!a && typeof (a as ExternalAgent).id === 'string' && typeof (a as ExternalAgent).code === 'string');

/** Guarda (ou substitui, se já existir um com o mesmo nome e autor). Devolve false se o navegador bloquear. */
export const saveExternalAgent = (agent: ExternalAgent) => writeJson(AGENTS_KEY, upsert(loadExternalAgents(), agent, (a) => a.id === agent.id));

export const deleteExternalAgent = (id: string) => writeJson(AGENTS_KEY, loadExternalAgents().filter((a) => a.id !== id));

// ---------- Partidas de jogadores humanos (D20) ----------

export const loadHumanGames = () =>
  readList<HumanGame>(HUMAN_KEY, (g) => {
    const game = g as HumanGame | null;
    return !!game && typeof game.score === 'number' && !!game.layout && typeof game.player === 'string';
  });

/** Acrescenta uma partida. Devolve false se o navegador não deixar salvar. */
export const saveHumanGame = (game: HumanGame) => writeJson(HUMAN_KEY, [...loadHumanGames(), game].slice(-HUMAN_LIMIT));

/** Apaga as partidas de um jogador (as dos outros nomes ficam). */
export const clearHumanGames = (player: string) => writeJson(HUMAN_KEY, loadHumanGames().filter((g) => g.player !== player));

export function loadPlayerName() {
  try {
    return localStorage.getItem(PLAYER_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Sem armazenamento, o nome vale só nesta sessão. */
export function savePlayerName(name: string) {
  try {
    localStorage.setItem(PLAYER_KEY, name);
  } catch {
    // sem armazenamento
  }
}
