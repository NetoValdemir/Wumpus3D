// Mapas e genoma salvos no navegador (localStorage). Tudo protegido por try/catch:
// em janela anônima ou com armazenamento bloqueado, o jogo continua funcionando sem salvar.
import { parseLayout, type MapLayout } from './game/world';
import { GENES } from './agents/genome';

const MAPS_KEY = 'wumpus3d.maps';
const GENOME_KEY = 'wumpus3d.genome';

export function loadSavedMaps(): MapLayout[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MAPS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((m) => {
      try {
        return [parseLayout(JSON.stringify(m))];
      } catch {
        return []; // ignora entradas corrompidas
      }
    });
  } catch {
    return [];
  }
}

/** Salva (ou substitui, se já existir um com o mesmo nome). Devolve false se o navegador bloquear. */
export function saveMap(layout: MapLayout): boolean {
  const maps = loadSavedMaps().filter((m) => m.name !== layout.name);
  maps.push(layout);
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch {
    return false;
  }
}

export function deleteMap(name: string) {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(loadSavedMaps().filter((m) => m.name !== name)));
  } catch {
    // sem armazenamento: nada a apagar
  }
}

export function loadGenome(): number[] | null {
  try {
    const g = JSON.parse(localStorage.getItem(GENOME_KEY) ?? 'null');
    return Array.isArray(g) && g.length === GENES.length && g.every((v) => typeof v === 'number') ? g : null;
  } catch {
    return null;
  }
}

export function saveGenome(genome: number[] | null) {
  try {
    if (genome) localStorage.setItem(GENOME_KEY, JSON.stringify(genome));
    else localStorage.removeItem(GENOME_KEY);
  } catch {
    // sem armazenamento: o genoma vale só nesta sessão
  }
}

// ---------- Agentes importados ----------

const AGENTS_KEY = 'wumpus3d.agents';

export interface ExternalAgent {
  id: string;
  name: string;
  author: string;
  description: string;
  code: string;
}

export function loadExternalAgents(): ExternalAgent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(AGENTS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((a) => a && typeof a.id === 'string' && typeof a.code === 'string') : [];
  } catch {
    return [];
  }
}

/** Guarda (ou substitui, se já existir um com o mesmo nome e autor). Devolve false se o navegador bloquear. */
export function saveExternalAgent(agent: ExternalAgent): boolean {
  const list = loadExternalAgents().filter((a) => a.id !== agent.id);
  list.push(agent);
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function deleteExternalAgent(id: string) {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(loadExternalAgents().filter((a) => a.id !== id)));
  } catch {
    // sem armazenamento: nada a apagar
  }
}
