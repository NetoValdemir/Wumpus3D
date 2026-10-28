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
