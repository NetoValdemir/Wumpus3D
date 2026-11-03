// Tabuleiro 2D (SVG) do modo escola: mais leve que o 3D, legível no celular e descrito para leitores de tela.
// Só desenha: quem chama diz o que mostrar em cada sala.
import { key, type Dir } from '../game/world';

export interface CellView {
  visited?: boolean;
  pit?: boolean;
  wumpus?: 'vivo' | 'morto';
  gold?: boolean;
  /** Percepções sentidas na sala (só nas visitadas) */
  breeze?: boolean;
  stench?: boolean;
  /** Anotação do caderno e, se pedida, a conferência */
  mark?: string;
  verdict?: 'certa' | 'possivel' | 'errada' | null;
}

export interface BoardOptions {
  size: number;
  cell: (x: number, y: number) => CellView;
  robot?: { x: number; y: number; dir: Dir; hasGold?: boolean; dead?: boolean } | null;
  onCell?: (x: number, y: number) => void;
  /** Texto do aria-label da sala (o padrão descreve o que está desenhado) */
  describe?: (x: number, y: number, v: CellView) => string;
}

const NS = 'http://www.w3.org/2000/svg';
const C = 64; // tamanho de cada sala no desenho
const ROT: Record<Dir, number> = { 0: 0, 1: -90, 2: 180, 3: 90 };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

export function describeCell(x: number, y: number, v: CellView) {
  const parts = [`Sala (${x + 1}, ${y + 1})`];
  if (x === 0 && y === 0) parts.push('entrada');
  parts.push(v.visited ? 'visitada' : 'desconhecida');
  if (v.breeze) parts.push('brisa');
  if (v.stench) parts.push('fedor');
  if (v.pit) parts.push('poço');
  if (v.wumpus) parts.push(v.wumpus === 'vivo' ? 'Wumpus' : 'Wumpus morto');
  if (v.gold) parts.push('ouro');
  if (v.mark) parts.push(`anotação: ${v.mark}`);
  if (v.verdict) parts.push(v.verdict === 'certa' ? 'anotação certa' : v.verdict === 'errada' ? 'anotação errada' : 'anotação possível');
  return parts.join(', ');
}

function wumpusShape(cx: number, cy: number, dead: boolean) {
  const g = el('g', { class: `wumpus${dead ? ' dead' : ''}` });
  g.append(
    el('ellipse', { cx, cy: cy + 4, rx: 19, ry: 16 }),
    el('circle', { cx: cx - 7, cy: cy, r: 4, class: 'eye' }),
    el('circle', { cx: cx + 7, cy: cy, r: 4, class: 'eye' }),
    el('path', { d: `M${cx - 16} ${cy - 8} l-5 -10 l9 6 Z M${cx + 16} ${cy - 8} l5 -10 l-9 6 Z`, class: 'horn' }),
  );
  return g;
}

/** Redesenha o tabuleiro inteiro dentro do <svg>. */
export function renderBoard(svg: SVGSVGElement, o: BoardOptions) {
  const n = o.size;
  svg.setAttribute('viewBox', `-4 -4 ${n * C + 8} ${n * C + 8}`);
  svg.replaceChildren();
  const describe = o.describe ?? describeCell;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const v = o.cell(x, y);
      const px = x * C;
      const py = (n - 1 - y) * C;
      const g = el('g', { class: `cell${v.visited ? ' visited' : ''}${o.onCell ? ' clickable' : ''}`, 'data-cell': key(x, y), role: o.onCell ? 'button' : 'img', 'aria-label': describe(x, y, v) });
      if (o.onCell) {
        g.setAttribute('tabindex', '0');
        g.addEventListener('click', () => o.onCell!(x, y));
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            o.onCell!(x, y);
          }
        });
      }
      g.append(el('rect', { x: px + 2, y: py + 2, width: C - 4, height: C - 4, rx: 6, class: 'floor' }));
      if (x === 0 && y === 0) g.append(el('circle', { cx: px + C / 2, cy: py + C / 2, r: 24, class: 'entrance' }));
      if (v.pit) g.append(el('circle', { cx: px + C / 2, cy: py + C / 2, r: 22, class: 'pit' }));
      if (v.gold) g.append(el('path', { d: `M${px + C / 2} ${py + 16} l12 14 l-12 16 l-12 -16 Z`, class: 'gold' }));
      if (v.wumpus) g.append(wumpusShape(px + C / 2, py + C / 2, v.wumpus === 'morto'));
      const icons = [v.breeze ? '💨' : '', v.stench ? '👃' : ''].filter(Boolean).join('');
      if (icons) g.append(el('text', { x: px + C - 6, y: py + 16, class: 'percept', 'text-anchor': 'end' }, icons));
      if (v.mark) {
        g.append(el('rect', { x: px + 5, y: py + C - 22, width: C - 10, height: 17, rx: 4, class: `mark ${v.verdict ?? ''}` }));
        g.append(el('text', { x: px + C / 2, y: py + C - 9, class: 'mark-text', 'text-anchor': 'middle' }, v.mark));
      }
      svg.append(g);
    }
  }
  // coordenadas (como na tela do jogo: começam em 1)
  for (let i = 0; i < n; i++) {
    svg.append(el('text', { x: i * C + C / 2, y: n * C + 2, class: 'coord', 'text-anchor': 'middle' }, String(i + 1)));
  }
  if (o.robot) {
    const r = o.robot;
    const cx = r.x * C + C / 2;
    const cy = (n - 1 - r.y) * C + C / 2;
    const g = el('g', { class: `robot${r.dead ? ' dead' : ''}`, transform: `translate(${cx} ${cy}) rotate(${ROT[r.dir]})`, 'aria-hidden': 'true' });
    g.append(el('circle', { r: 17 }), el('path', { d: 'M8 -9 L22 0 L8 9 Z', class: 'nose' }));
    if (r.hasGold) g.append(el('path', { d: 'M-6 -8 l6 7 l-6 8 l-6 -8 Z', class: 'gold', transform: 'rotate(' + -ROT[r.dir] + ')' }));
    svg.append(g);
  }
}

/** O <svg> do tabuleiro pelo seletor. */
export const boardSvg = (sel: string) => document.querySelector<SVGSVGElement>(sel)!;
