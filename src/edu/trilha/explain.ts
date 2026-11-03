// Trilha de IA, módulo 2: "por que esta sala é segura (ou perigosa)?". Lê a mesma base de conhecimento
// dos agentes e devolve, em frases simples, o caminho do raciocínio. Só leitura: não muda nenhuma dedução.
import { parseKey } from '../../game/world';
import type { Knowledge } from '../../agents/knowledge';

export type CellStatus = 'visitada' | 'segura' | 'poco' | 'wumpus' | 'incerta' | 'sem-pistas';

export interface Explanation {
  status: CellStatus;
  title: string;
  reasons: string[];
}

export const cellName = (k: string) => {
  const [x, y] = parseKey(k);
  return `(${x + 1}, ${y + 1})`;
};
const list = (ks: string[]) => ks.map(cellName).join(', ');

/** Por que a sala não tem poço (ou por que ainda pode ter). */
function pitReasons(kb: Knowledge, k: string): string[] {
  const calm = kb.neighbors(k).filter((n) => kb.visited.get(n)?.breeze === false);
  if (calm.length) return [`${cellName(calm[0])} é vizinha de ${cellName(k)} e lá não havia brisa. Sem brisa, nenhuma vizinha tem poço: ${cellName(k)} não tem poço.`];
  const breezy = kb.neighbors(k).filter((n) => kb.visited.get(n)?.breeze);
  return breezy.length ? [`${cellName(k)} é vizinha de ${list(breezy)}, onde havia brisa: pode ter poço.`] : [];
}

/** Por que o Wumpus não pode (ou pode) estar na sala. */
function wumpusReasons(kb: Knowledge, k: string, candidates: Set<string>): string[] {
  if (kb.wumpusDead) return ['O Wumpus já morreu (o robô ouviu o grito).'];
  if (candidates.has(k)) {
    return candidates.size === 1
      ? [`${cellName(k)} é a única sala que é vizinha de todas as salas com fedor e não foi descartada por nenhuma pista: o Wumpus está nela.`]
      : [`O Wumpus ainda pode estar em ${cellName(k)} (e também em ${list([...candidates].filter((c) => c !== k))}).`];
  }
  const calm = kb.neighbors(k).find((n) => kb.visited.get(n)?.stench === false);
  if (calm) return [`${cellName(calm)} é vizinha de ${cellName(k)} e lá não havia fedor: o Wumpus não está em ${cellName(k)}.`];
  const stench = [...kb.visited].filter(([, o]) => o.stench).map(([c]) => c);
  const far = stench.find((s) => !kb.neighbors(s).includes(k));
  if (far) return [`Em ${cellName(far)} havia fedor, mas ${cellName(k)} não é vizinha de ${cellName(far)}: o Wumpus está ao lado de ${cellName(far)}, não aqui.`];
  if (kb.arrowCleared(k)) return [`A flecha passou por ${cellName(k)} sem acertar nada: o Wumpus não está lá.`];
  if (kb.certainPits().has(k)) return [`${cellName(k)} tem poço, e pela regra do jogo o Wumpus nunca fica num poço.`];
  return [];
}

export function explainCell(kb: Knowledge, k: string): Explanation {
  const obs = kb.visited.get(k);
  if (obs) {
    const felt = [obs.breeze && 'brisa', obs.stench && 'fedor'].filter(Boolean).join(' e ');
    return { status: 'visitada', title: `${cellName(k)}: o robô já esteve aqui`, reasons: [`Se o robô passou e continua vivo, não há poço nem Wumpus vivo aqui.`, felt ? `Aqui ele sentiu ${felt}.` : 'Aqui ele não sentiu nada.'] };
  }
  const candidates = kb.wumpusCandidates();
  const hasClue = kb.neighbors(k).some((n) => kb.visited.has(n));
  const pits = kb.certainPits();
  if (pits.has(k)) {
    const breezy = kb.neighbors(k).find((n) => kb.visited.get(n)?.breeze && kb.neighbors(n).filter((m) => !kb.pitFree(m)).length === 1)!;
    const others = kb.neighbors(breezy).filter((m) => m !== k);
    return {
      status: 'poco',
      title: `${cellName(k)}: poço com certeza`,
      reasons: [`Em ${cellName(breezy)} havia brisa: pelo menos uma vizinha tem poço.`, `As outras vizinhas de ${cellName(breezy)} (${list(others)}) não podem ter poço (já visitadas ou vizinhas de sala sem brisa).`, `Só sobra ${cellName(k)}.`],
    };
  }
  if (candidates.size === 1 && candidates.has(k)) return { status: 'wumpus', title: `${cellName(k)}: o Wumpus está aqui`, reasons: wumpusReasons(kb, k, candidates) };
  if (kb.safe(k, candidates)) return { status: 'segura', title: `${cellName(k)}: segura`, reasons: [...pitReasons(kb, k), ...wumpusReasons(kb, k, candidates)] };
  if (!hasClue) return { status: 'sem-pistas', title: `${cellName(k)}: sem pistas`, reasons: ['Nenhuma sala vizinha foi visitada ainda: o robô não tem nenhuma pista sobre ela.'] };
  return { status: 'incerta', title: `${cellName(k)}: não dá para ter certeza`, reasons: [...pitReasons(kb, k), ...wumpusReasons(kb, k, candidates)] };
}
