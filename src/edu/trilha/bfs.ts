// Trilha de IA, módulo 4: busca em largura passo a passo (a mesma ideia de ReasoningAgent.route),
// guardando a fila e as salas já vistas a cada passo para o aluno acompanhar.

export interface BfsStep {
  current: string; // sala tirada da fila neste passo
  queue: string[]; // fila depois de colocar as vizinhas novas
  seen: string[]; // salas já descobertas
  added: string[]; // vizinhas colocadas na fila neste passo
}

export interface BfsTrace {
  steps: BfsStep[];
  path: string[] | null; // do início ao objetivo
}

export function bfsTrace(neighbors: (k: string) => string[], passable: (k: string) => boolean, from: string, goal: string): BfsTrace {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  const steps: BfsStep[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === goal) {
      steps.push({ current, queue: [...queue], seen: [...prev.keys()], added: [] });
      const path = [current];
      for (let p = prev.get(current); p; p = prev.get(p)) path.unshift(p);
      return { steps, path };
    }
    const added = neighbors(current).filter((n) => !prev.has(n) && (passable(n) || n === goal));
    for (const n of added) {
      prev.set(n, current);
      queue.push(n);
    }
    steps.push({ current, queue: [...queue], seen: [...prev.keys()], added });
  }
  return { steps, path: null };
}
