// Quem está jogando, qual plano está aberto e o registro de tudo o que o aluno faz.
import type { MapLayout } from '../../game/world';
import { arenaMaps } from '../../arena/rng';
import { activityGroups, activityLayouts, type Activity, type Attempt, type Plan } from '../plan';
import { ALL_GROUPS, missionById, type BlockGroup, type Mission } from '../missions';
import { getRecord, loadStudent, loadStudentPlan, saveRecords, saveStudent, saveStudentPlan } from '../edu-storage';

/** O que vai ser jogado numa tela (Detetive ou Blocos). */
export interface PlaySource {
  /** id para guardar programa e estrelas (atividade do plano, missão ou caverna) */
  id: string;
  title: string;
  goal: string;
  tip: string;
  layouts: MapLayout[];
  groups: BlockGroup[];
  mission: Mission | null;
  activity: Activity | null;
}

export const session = {
  student: loadStudent(),
  plan: loadStudentPlan() as Plan | null,
};

export const studentName = () => session.student.trim() || 'Aluno sem nome';

export function setStudent(name: string) {
  session.student = name.trim().slice(0, 40);
  saveStudent(session.student);
}

export function setPlan(plan: Plan | null) {
  session.plan = plan;
  saveStudentPlan(plan);
}

/** Registro do aluno no plano aberto (ou no "jogo livre"). */
export const currentRecord = (activity: Activity | null) => getRecord(studentName(), activity && session.plan ? session.plan : null);

export function recordAttempt(src: PlaySource, attempt: Omit<Attempt, 'activityId' | 'activityTitle' | 'at'>) {
  const rec = currentRecord(src.activity);
  rec.attempts.push({ ...attempt, activityId: src.activity?.id ?? src.id, activityTitle: src.activity?.title ?? src.title, at: new Date().toISOString() });
  saveRecords();
}

export function sourceFromActivity(a: Activity): PlaySource {
  const mission = a.cave?.type === 'missao' ? (missionById(a.cave.missionId) ?? null) : null;
  return {
    id: `${session.plan?.id ?? 'livre'}:${a.id}`,
    title: a.title,
    goal: a.instructions || mission?.goal || (a.kind === 'detetive' ? 'Encontre o ouro e volte vivo para a entrada.' : 'Programe o robô para pegar o ouro e voltar.'),
    tip: mission?.tip ?? '',
    layouts: activityLayouts(a),
    groups: activityGroups(a),
    mission,
    activity: a,
  };
}

export const sourceFromMission = (m: Mission): PlaySource => ({ id: `missao:${m.id}`, title: `Missão: ${m.title}`, goal: m.goal, tip: m.tip, layouts: m.maps, groups: m.groups, mission: m, activity: null });

export const sourceFromLayout = (l: MapLayout, kind: 'detetive' | 'blocos'): PlaySource => ({
  id: `caverna:${l.name}`,
  title: `Caverna: ${l.name}`,
  goal: kind === 'detetive' ? 'Encontre o ouro e volte vivo para a entrada.' : 'Programe o robô para pegar o ouro e voltar para a entrada.',
  tip: '',
  layouts: [l],
  groups: ALL_GROUPS,
  mission: null,
  activity: null,
});

/** Caverna sorteada para o Detetive livre (4×4, 20% de poços). */
export function randomCave(): MapLayout {
  const seed = `livre-${Date.now()}`;
  return { ...arenaMaps(seed, 1, 4, 0.2)[0], name: 'Caverna sorteada' };
}

// Navegação entre as telas, ligada por app.ts (evita importações circulares)
export const nav = {
  show: (_tab: string) => {},
  /** Abre a aba preparando a tela (lista de missões, caverna sorteada...) */
  go: (_tab: string) => {},
  detective: (_src: PlaySource) => {},
  blocks: (_src: PlaySource) => {},
  refreshHome: () => {},
};
