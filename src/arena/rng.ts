// Sorteio reproduzível: a mesma semente gera sempre os mesmos mapas,
// para que todos os agentes sejam testados nos mesmos cenários.
import { WumpusWorld, type MapLayout } from '../game/world';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Transforma qualquer texto (ex.: "final-2026") num número de semente. */
export function seedFromText(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

export function arenaMaps(seed: string, count: number, size: number, pitProbability: number): MapLayout[] {
  const rng = mulberry32(seedFromText(seed));
  return Array.from({ length: count }, (_, i) => new WumpusWorld(size, pitProbability, rng).toLayout(`Arena ${seed} #${i + 1}`));
}
