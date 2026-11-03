// Quem pode jogar: você, os agentes embutidos e os agentes importados na Arena.
import { AGENTS, type AgentId } from '../agents/agents';
import type { BuiltinAgentId } from '../agents/benchmark';
import type { Controller } from '../arena/protocol';
import { builtinController } from '../arena/runner';
import { WorkerSandbox } from '../arena/sandbox';
import { externalAgents, externalById } from '../arena/ui';
import { cfg, currentGenome, genetics, type PlayerId } from './state';

const EXTERNAL = 'ext:';

/** Id do agente importado, ou null se for você ou um agente embutido. */
const externalIdOf = (id: PlayerId) => (id.startsWith(EXTERNAL) ? id.slice(EXTERNAL.length) : null);

export function playerInfo(id: PlayerId): { label: string; description: string } {
  const ext = externalIdOf(id);
  if (ext === null) return AGENTS[id as AgentId];
  const a = externalById(ext);
  return a ? { label: a.name, description: `Agente importado, por ${a.author}. ${a.description}` } : { label: 'Agente removido', description: '' };
}

/** Nome usado nos relatórios: avisa quando o genético usa pesos treinados (não é o agente padrão). */
export const reportName = (id: PlayerId) => (id === 'genetic' && genetics.trained ? `${playerInfo(id).label} (pesos treinados)` : playerInfo(id).label);

export function playerAuthor(id: PlayerId) {
  const ext = externalIdOf(id);
  return ext === null ? 'Wumpus 3D' : (externalById(ext)?.author ?? '');
}

/** Monta as opções de "Quem joga": embutidos e, num grupo separado, os importados. */
export function refreshPlayerOptions() {
  const current = cfg.agent.value;
  cfg.agent.innerHTML = '';
  for (const [id, a] of Object.entries(AGENTS)) cfg.agent.add(new Option(a.label, id));
  const imported = externalAgents();
  if (imported.length) {
    const group = document.createElement('optgroup');
    group.label = 'Agentes importados';
    for (const a of imported) group.append(new Option(`${a.name} (${a.author})`, `${EXTERNAL}${a.id}`));
    cfg.agent.append(group);
  }
  cfg.agent.value = [...cfg.agent.options].some((o) => o.value === current) ? current : 'human';
}

/** Agente pronto para jogar: os importados rodam isolados num Worker (D11). */
export function makeController(id: PlayerId, withBeliefs: boolean): Controller {
  const ext = externalIdOf(id);
  if (ext !== null) return new WorkerSandbox(externalById(ext)!.code, 3000);
  return builtinController(id as BuiltinAgentId, { genome: currentGenome(), withBeliefs });
}
