// Árbitro: acompanha as mesmas percepções que o agente recebeu e avalia a qualidade de cada passo.
// Ele não vê o mapa: só julga o que o agente PODERIA ter deduzido com o que sentiu até ali.
import { DIR_VEC, key, type Action, type WumpusWorld } from '../game/world';
import { Knowledge } from '../agents/knowledge';

export class Referee {
  private kb: Knowledge;
  logicErrors = 0; // andou para uma sala que já dava para provar ser poço ou Wumpus
  needlessRisks = 0; // arriscou uma sala incerta havendo sala comprovadamente segura para explorar
  bumps = 0; // andou contra a parede
  shots = 0;
  hits = 0;

  constructor(world: WumpusWorld) {
    this.kb = new Knowledge(world.size, world.pitProbability);
    this.observe(world, false);
  }

  /** Chamado ANTES de executar a ação: julga a jogada. */
  judge(world: WumpusWorld, action: Action) {
    if (action === 'shoot' && world.hasArrow) this.shots++;
    if (action !== 'forward') return;
    const [dx, dy] = DIR_VEC[world.agent.dir];
    const tx = world.agent.x + dx;
    const ty = world.agent.y + dy;
    if (!world.inBounds(tx, ty)) {
      this.bumps++;
      return;
    }
    const target = key(tx, ty);
    const kb = this.kb;
    if (kb.visited.has(target)) return;
    const candidates = kb.wumpusCandidates();
    if (kb.certainPits().has(target) || (candidates.size === 1 && candidates.has(target))) {
      this.logicErrors++;
    } else if (!kb.safe(target, candidates)) {
      const safeLeft = kb.allCells().some((k) => !kb.visited.has(k) && kb.safe(k, candidates));
      if (safeLeft) this.needlessRisks++;
    }
  }

  /** Chamado DEPOIS da ação, com as novas percepções. */
  observe(world: WumpusWorld, shot: boolean) {
    const p = world.percepts;
    if (shot && !p.scream) this.kb.arrowMissed({ x: world.agent.x, y: world.agent.y }, world.agent.dir);
    if (p.scream) this.hits++;
    this.kb.observe(world.agent.x, world.agent.y, p.breeze, p.stench, p.scream);
  }
}
