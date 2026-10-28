// Roda o código de um agente externo isolado num Web Worker.
// O agente só recebe as percepções de cada passo: o mapa fica na página, fora do alcance dele.
// Se o agente travar (laço infinito) ou demorar demais, o Worker é encerrado e recriado.
import { HARNESS_AFTER, HARNESS_BEFORE, normalizeDecision, type AgentInfo, type AgentMeta, type Controller, type Decision, type PublicSenses } from './protocol';
import { DecisionTimeout } from './runner';

const WORKER_LOOP = `
self.onmessage = function (e) {
  var m = e.data;
  try {
    if (m.type === 'meta') { postMessage({ id: m.id, ok: true, value: __meta }); return; }
    if (m.type === 'start') { __start(m.info); postMessage({ id: m.id, ok: true }); return; }
    if (m.type === 'decide') { postMessage({ id: m.id, ok: true, value: JSON.parse(JSON.stringify(__decide(m.senses))) }); return; }
  } catch (err) {
    postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
`;

export class WorkerSandbox implements Controller {
  private url: string;
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private size = 4;
  private timeoutMs: number;

  constructor(code: string, timeoutMs = 1000) {
    this.url = URL.createObjectURL(new Blob([HARNESS_BEFORE, '\n', code, '\n', HARNESS_AFTER, WORKER_LOOP], { type: 'text/javascript' }));
    this.timeoutMs = timeoutMs;
  }

  private spawn() {
    const worker = new Worker(this.url);
    worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      clearTimeout(p.timer);
      if (e.data.ok) p.resolve(e.data.value);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      e.preventDefault();
      this.failAll(new Error((e.message || 'Erro ao carregar o código do agente.').replace(/^Uncaught /, '')));
    };
    return worker;
  }

  private failAll(err: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private call(msg: object, timeoutMs: number): Promise<unknown> {
    this.worker ??= this.spawn();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.failAll(new DecisionTimeout(`O agente passou de ${timeoutMs} ms para responder.`)), timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  /** Carrega o código e devolve nome, autor e descrição (lança erro se o arquivo for inválido). */
  async meta(): Promise<AgentMeta> {
    return (await this.call({ type: 'meta' }, 3000)) as AgentMeta;
  }

  async start(info: AgentInfo) {
    this.size = info.size;
    await this.call({ type: 'start', info }, this.timeoutMs * 5);
  }

  async decide(senses: PublicSenses): Promise<Decision> {
    return normalizeDecision(await this.call({ type: 'decide', senses }, this.timeoutMs), this.size);
  }

  dispose() {
    this.failAll(new Error('Agente encerrado.'));
    URL.revokeObjectURL(this.url);
  }
}
