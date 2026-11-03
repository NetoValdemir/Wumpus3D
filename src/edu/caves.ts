// Criador de cavernas: edição de um mapa sala a sala, validação e código curto para compartilhar. Sem DOM.
import { MAX_SIZE, key, parseKey, parseLayout, reachable, type MapLayout } from '../game/world';

export type Tool = 'poco' | 'wumpus' | 'ouro' | 'apagar';

/** Caverna em edição (coordenadas internas, a partir de 0). */
export interface CaveDraft {
  name: string;
  size: number;
  pits: Set<string>;
  wumpus: string | null;
  gold: string | null;
}

export const MIN_CAVE = 3;
export const MAX_CAVE = Math.min(8, MAX_SIZE); // maior que isso fica pequeno demais na tela da escola

export const emptyCave = (size = 4, name = 'Minha caverna'): CaveDraft => ({ name, size, pits: new Set(), wumpus: null, gold: null });

/** Aplica a ferramenta na sala. A entrada (1,1) fica sempre livre; Wumpus e ouro nunca ficam num poço (D16). */
export function applyTool(d: CaveDraft, k: string, tool: Tool): boolean {
  if (k === key(0, 0)) return false;
  switch (tool) {
    case 'poco':
      if (d.pits.has(k)) d.pits.delete(k);
      else {
        d.pits.add(k);
        if (d.wumpus === k) d.wumpus = null;
        if (d.gold === k) d.gold = null;
      }
      return true;
    case 'wumpus':
      d.pits.delete(k);
      d.wumpus = d.wumpus === k ? null : k;
      return true;
    case 'ouro':
      d.pits.delete(k);
      d.gold = d.gold === k ? null : k;
      return true;
    case 'apagar':
      d.pits.delete(k);
      if (d.wumpus === k) d.wumpus = null;
      if (d.gold === k) d.gold = null;
      return true;
  }
}

/** Muda o tamanho, descartando o que ficar fora da nova grade. */
export function resizeCave(d: CaveDraft, size: number): CaveDraft {
  const inside = (k: string | null) => {
    if (!k) return null;
    const [x, y] = parseKey(k);
    return x < size && y < size ? k : null;
  };
  return { ...d, size, pits: new Set([...d.pits].filter((k) => inside(k))), wumpus: inside(d.wumpus), gold: inside(d.gold) };
}

const toScreen = (k: string): [number, number] => {
  const [x, y] = parseKey(k);
  return [x + 1, y + 1];
};

/** Problemas que impedem jogar a caverna (vazio = pronta). */
export function caveProblems(d: CaveDraft): string[] {
  const out: string[] = [];
  if (!d.gold) out.push('Falta colocar o ouro.');
  if (!d.wumpus) out.push('Falta colocar o Wumpus.');
  if (d.gold) {
    const [x, y] = parseKey(d.gold);
    if (!reachable(d.size, d.pits, { x, y })) out.push('Não existe caminho sem poço da entrada até o ouro: ninguém conseguiria vencer.');
  }
  return out;
}

/** Caverna pronta no formato de mapa do jogo (coordenadas a partir de 1). */
export function caveToLayout(d: CaveDraft): MapLayout {
  if (caveProblems(d).length) throw new Error(caveProblems(d).join(' '));
  const cells = d.size * d.size - 1;
  return {
    format: 'wumpus3d-map',
    version: 1,
    name: d.name.trim().slice(0, 60) || 'Minha caverna',
    size: d.size,
    pitProbability: Math.round((d.pits.size / cells) * 100) / 100,
    pits: [...d.pits].map(toScreen),
    wumpus: toScreen(d.wumpus!),
    gold: toScreen(d.gold!),
  };
}

export function layoutToCave(l: MapLayout): CaveDraft {
  const k = ([x, y]: [number, number]) => key(x - 1, y - 1);
  return { name: l.name, size: l.size, pits: new Set(l.pits.map(k)), wumpus: k(l.wumpus), gold: k(l.gold) };
}

// ---------------------------------------------------------------- Códigos curtos (copiar e colar)

/** Texto → base64 seguro para URL (aceita acentos). */
export function toCode(prefix: string, data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `${prefix}-${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export function fromCode(prefix: string, code: string): unknown {
  const clean = code.trim().replace(/\s+/g, '');
  if (!clean.startsWith(`${prefix}-`)) throw new Error(`Este código não começa com "${prefix}-".`);
  try {
    const b64 = clean.slice(prefix.length + 1).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    throw new Error('O código está incompleto ou foi copiado errado.');
  }
}

const CAVE_PREFIX = 'CAV1';

/** Código curto da caverna: só tamanho, poços, Wumpus, ouro e nome. */
export const caveCode = (l: MapLayout) => toCode(CAVE_PREFIX, { n: l.name, s: l.size, p: l.pits, w: l.wumpus, g: l.gold });

export function parseCaveCode(code: string): MapLayout {
  const d = fromCode(CAVE_PREFIX, code) as { n?: string; s?: number; p?: [number, number][]; w?: [number, number]; g?: [number, number] };
  const layout = parseLayout(JSON.stringify({ format: 'wumpus3d-map', version: 1, name: d.n, size: d.s, pits: d.p, wumpus: d.w, gold: d.g }));
  const problems = caveProblems(layoutToCave(layout));
  if (problems.length) throw new Error(problems.join(' '));
  return layout;
}
