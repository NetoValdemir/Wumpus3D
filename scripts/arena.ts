// Arena na linha de comando: roda todos os agentes de uma pasta nos mesmos mapas e gera o ranking.
//
//   npm run arena -- [pasta-ou-arquivos...] [--seed texto] [--maps 100] [--size 4] [--pits 0.2]
//                    [--timeout 1000] [--sem-embutidos] [--ocultar-semente] [--json saida.json] [--md saida.md]
//
// Cada agente roda num contexto vm separado e só recebe as percepções (nunca o mapa).
// Atenção: vm não é uma barreira de segurança completa. Revise o código antes de rodar agentes de terceiros.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import vm from 'node:vm';
import { arenaMaps } from '../src/arena/rng';
import { builtinController, playEpisode, type EpisodeResult } from '../src/arena/runner';
import { aggregate, rank, toMarkdown, type AgentStats } from '../src/arena/ranking';
import { HARNESS_AFTER, HARNESS_BEFORE, normalizeDecision, type AgentMeta, type Controller } from '../src/arena/protocol';
import { AGENTS } from '../src/agents/agents';

function parseArgs(argv: string[]) {
  const opts = { seed: 'wumpus', maps: 100, size: 4, pits: 0.2, timeout: 1000, builtins: true, hideSeed: false, json: '', md: '', paths: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--seed') opts.seed = next();
    else if (a === '--maps') opts.maps = Number(next());
    else if (a === '--size') opts.size = Number(next());
    else if (a === '--pits') opts.pits = Number(next());
    else if (a === '--timeout') opts.timeout = Number(next());
    else if (a === '--sem-embutidos') opts.builtins = false;
    else if (a === '--ocultar-semente') opts.hideSeed = true;
    else if (a === '--json') opts.json = next();
    else if (a === '--md') opts.md = next();
    else opts.paths.push(a);
  }
  if (!opts.paths.length) opts.paths.push('agents');
  return opts;
}

function agentFiles(paths: string[]) {
  return paths.flatMap((p) =>
    statSync(p).isDirectory()
      ? readdirSync(p)
          .filter((f) => f.endsWith('.js'))
          .sort()
          .map((f) => join(p, f))
      : [p],
  );
}

/** Agente externo isolado num contexto vm. Só strings JSON entram e saem do contexto. */
class VmSandbox implements Controller {
  private ctx: vm.Context;
  private timeout: number;
  private size = 4;
  readonly meta: AgentMeta;

  constructor(code: string, file: string, timeout: number) {
    this.timeout = timeout;
    this.ctx = vm.createContext(Object.create(null));
    vm.runInContext('globalThis.console = { log() {}, warn() {}, error() {}, info() {} };', this.ctx);
    vm.runInContext(HARNESS_BEFORE + '\n' + code + '\n' + HARNESS_AFTER, this.ctx, { filename: file, timeout: timeout * 5 });
    this.meta = JSON.parse(this.run('JSON.stringify(__meta)', timeout));
  }

  private run(src: string, timeout: number): string {
    return vm.runInContext(src, this.ctx, { timeout }) as string;
  }

  start(info: { size: number; pitProbability: number; maxActions: number }) {
    this.size = info.size;
    this.ctx.__in = JSON.stringify(info);
    this.run('__start(JSON.parse(__in))', this.timeout * 5);
  }

  decide(senses: object) {
    this.ctx.__in = JSON.stringify(senses);
    const out = this.run('JSON.stringify(__decide(JSON.parse(__in)) ?? null)', this.timeout);
    return normalizeDecision(JSON.parse(out), this.size);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const maps = arenaMaps(opts.seed, opts.maps, opts.size, opts.pits);
  const participants: { name: string; author: string; make: () => Controller }[] = [];

  if (opts.builtins) {
    for (const id of ['random', 'logic', 'bayes', 'genetic'] as const) {
      participants.push({ name: `${AGENTS[id].label} (referência)`, author: 'Wumpus 3D', make: () => builtinController(id) });
    }
  }
  const failed: AgentStats[] = [];
  for (const file of agentFiles(opts.paths)) {
    const code = readFileSync(file, 'utf8');
    try {
      const probe = new VmSandbox(code, file, opts.timeout);
      participants.push({ name: probe.meta.name, author: probe.meta.author, make: () => new VmSandbox(code, file, opts.timeout) });
    } catch (err) {
      console.error(`✗ ${basename(file)}: ${(err as Error).message}`);
      failed.push({ ...aggregate(basename(file), '?', []), errors: opts.maps, games: opts.maps, avgScore: -1000, firstError: (err as Error).message });
    }
  }

  console.log(`Arena: ${participants.length} agentes × ${maps.length} mapas ${opts.size}×${opts.size} (semente ${opts.hideSeed ? 'secreta' : `"${opts.seed}"`})`);
  const stats: AgentStats[] = [];
  for (const p of participants) {
    const results: EpisodeResult[] = [];
    for (const layout of maps) {
      let ctrl: Controller;
      try {
        ctrl = p.make();
      } catch (err) {
        results.push({ outcome: 'error', score: -1000, actions: 0, decisionMs: 0, logicErrors: 0, needlessRisks: 0, bumps: 0, shots: 0, hits: 0, error: (err as Error).message });
        continue;
      }
      results.push(await playEpisode(ctrl, layout, opts.timeout));
    }
    const s = aggregate(p.name, p.author, results);
    stats.push(s);
    console.log(`  ${p.name}: média ${Math.round(s.avgScore)}, ${s.wins}/${s.games} vitórias${s.errors ? `, ${s.errors} erros (${s.firstError})` : ''}`);
  }

  const ranked = rank([...stats, ...failed]);
  // No ranking oficial a semente fica secreta, para ninguém treinar o agente nos mapas da prova
  const meta = { seed: opts.hideSeed ? 'secreta' : opts.seed, maps: opts.maps, size: opts.size, pitProbability: opts.pits, date: new Date().toISOString().slice(0, 10) };
  const md = toMarkdown(ranked, meta);
  console.log('\n' + md);
  const write = (path: string, content: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  if (opts.json) write(opts.json, JSON.stringify({ meta, ranking: ranked }, null, 2));
  if (opts.md) write(opts.md, md + '\n');
}

main();
