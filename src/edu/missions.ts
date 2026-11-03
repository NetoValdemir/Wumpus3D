// Campanha do modo "Programador com blocos": cavernas fixas, um conceito novo por missão, blocos liberados
// aos poucos e estrelas por programa curto. As primeiras cavernas não têm perigo no caminho: o Wumpus fica
// longe e não há poços perto da rota (mapas fixos não passam pelo sorteio; ver D22).
import type { MapLayout } from '../game/world';
import { runProgram, type RunResult } from './run';
import type { Program } from './program';

/** Grupos de blocos que aparecem na caixa de ferramentas. */
export type BlockGroup = 'acoes' | 'flecha' | 'repetir' | 'repetirAte' | 'se' | 'sensores' | 'logica' | 'funcoes';
export const ALL_GROUPS: BlockGroup[] = ['acoes', 'flecha', 'repetir', 'repetirAte', 'se', 'sensores', 'logica', 'funcoes'];

export interface Mission {
  id: string;
  title: string;
  concept: string;
  goal: string;
  tip: string;
  groups: BlockGroup[];
  /** O programa precisa vencer todas as cavernas (testa se ele generaliza). */
  maps: MapLayout[];
  /** ★★: no máximo este número de blocos. ★★★: também no máximo este total de ações (somando as cavernas). */
  maxBlocks: number;
  maxActions: number;
}

const cave = (name: string, size: number, gold: [number, number], wumpus: [number, number], pits: [number, number][] = []): MapLayout => ({
  format: 'wumpus3d-map',
  version: 1,
  name,
  size,
  pitProbability: 0.2,
  pits,
  wumpus,
  gold,
});

export const MISSIONS: Mission[] = [
  {
    id: 'm1',
    title: 'Primeiros passos',
    concept: 'Sequência',
    goal: 'Leve o robô até o ouro, pegue-o e volte para a entrada (a sala com o anel azul).',
    tip: 'O robô começa olhando para a direita (Leste). Para voltar, ele precisa dar meia-volta: girar duas vezes.',
    groups: ['acoes'],
    maps: [cave('Missão 1', 4, [3, 1], [4, 4])],
    maxBlocks: 7,
    maxActions: 7,
  },
  {
    id: 'm2',
    title: 'Virando a esquina',
    concept: 'Sequência e direção',
    goal: 'O ouro está mais acima. Faça o robô virar no lugar certo e depois encontrar o caminho de volta.',
    tip: 'Imagine que você é o robô: para que lado é "esquerda" quando você está olhando para cima?',
    groups: ['acoes'],
    maps: [cave('Missão 2', 4, [2, 3], [4, 4], [[3, 3]])],
    maxBlocks: 11,
    maxActions: 11,
  },
  {
    id: 'm3',
    title: 'O corredor comprido',
    concept: 'Repetição',
    goal: 'O ouro está no fim de um corredor longo. Use o bloco "repetir" para não precisar de tantos blocos.',
    tip: 'Quantas vezes o robô precisa avançar para chegar ao ouro? Coloque o "avançar" dentro do "repetir".',
    groups: ['acoes', 'repetir'],
    maps: [cave('Missão 3', 6, [6, 1], [6, 6])],
    maxBlocks: 7,
    maxActions: 13,
  },
  {
    id: 'm4',
    title: 'A escada',
    concept: 'Padrões',
    goal: 'O caminho até o ouro é uma escada. Descubra o padrão que se repete em cada degrau.',
    tip: 'Um degrau é: avançar, girar, avançar, girar. Para que lado gira cada vez? E na volta, o padrão muda?',
    groups: ['acoes', 'repetir'],
    maps: [cave('Missão 4', 5, [4, 4], [5, 1], [[5, 5]])],
    maxBlocks: 13,
    maxActions: 26,
  },
  {
    id: 'm5',
    title: 'Onde está o ouro?',
    concept: 'Repetir até (laço com condição)',
    goal: 'O mesmo programa precisa vencer três cavernas. Em cada uma o ouro está num lugar diferente do corredor.',
    tip: 'O robô vê um brilho quando está na sala do ouro. Use "repetir até ver brilho".',
    groups: ['acoes', 'repetir', 'repetirAte', 'sensores'],
    maps: [cave('Missão 5 · A', 5, [3, 1], [5, 5]), cave('Missão 5 · B', 5, [5, 1], [5, 5]), cave('Missão 5 · C', 5, [4, 1], [5, 5])],
    maxBlocks: 9,
    maxActions: 27,
  },
  {
    id: 'm6',
    title: 'Siga a parede',
    concept: 'Condição: se / senão',
    goal: 'O ouro está em algum lugar junto às paredes da caverna. Ensine o robô a contornar a caverna e a voltar.',
    tip: 'Se houver parede à frente, gire; senão, avance. Repita até ver o brilho. Na volta, gire para o outro lado.',
    groups: ['acoes', 'repetir', 'repetirAte', 'se', 'sensores'],
    maps: [cave('Missão 6 · A', 5, [5, 3], [3, 3]), cave('Missão 6 · B', 5, [2, 5], [3, 3])],
    maxBlocks: 15,
    maxActions: 46,
  },
  {
    id: 'm7',
    title: 'Degraus com função',
    concept: 'Funções (abstração)',
    goal: 'Uma escada maior. Crie uma função para a subida inteira e use-a na ida e na volta.',
    tip: 'Uma função é um bloco novo que você mesmo cria. Monte "subir a escada" uma vez e chame duas vezes.',
    groups: ['acoes', 'repetir', 'funcoes'],
    maps: [cave('Missão 7', 6, [5, 5], [6, 1], [[1, 6]])],
    maxBlocks: 11,
    maxActions: 34,
  },
  {
    id: 'm8',
    title: 'Fedor quer dizer Wumpus',
    concept: 'Condições compostas (e / ou / não)',
    goal: 'Em algumas cavernas o Wumpus está no corredor. Se sentir fedor e ainda tiver a flecha, atire antes de avançar.',
    tip: 'O fedor aparece nas salas vizinhas do Wumpus. A flecha voa reto na direção em que o robô está olhando.',
    groups: ['acoes', 'flecha', 'repetir', 'repetirAte', 'se', 'sensores', 'logica'],
    maps: [cave('Missão 8 · A', 5, [5, 1], [4, 1]), cave('Missão 8 · B', 5, [5, 1], [3, 3]), cave('Missão 8 · C', 5, [5, 1], [2, 1])],
    maxBlocks: 14,
    maxActions: 35,
  },
  {
    id: 'm9',
    title: 'Caverna de verdade',
    concept: 'Juntando tudo',
    goal: 'Uma caverna com poços e o Wumpus. Use tudo o que aprendeu (e o modo Detetive) para planejar a rota.',
    tip: 'Jogue primeiro no modo Detetive para descobrir o mapa. Depois escreva o programa com a rota segura.',
    groups: ALL_GROUPS,
    maps: [cave('Missão 9', 4, [3, 3], [2, 4], [[3, 1], [1, 3]])],
    maxBlocks: 17,
    maxActions: 17,
  },
];

export interface MissionResult {
  won: boolean;
  runs: RunResult[];
  actions: number;
  blocks: number;
  stars: number;
}

/** Joga o programa em todas as cavernas da missão e calcula as estrelas (0 a 3). */
export function evaluateMission(program: Program, mission: Pick<Mission, 'maps' | 'maxBlocks' | 'maxActions'>): MissionResult {
  const runs = mission.maps.map((m) => runProgram(program, m));
  const won = runs.every((r) => r.status === 'won');
  const actions = runs.reduce((s, r) => s + r.actions, 0);
  const stars = !won ? 0 : program.blocks > mission.maxBlocks ? 1 : actions > mission.maxActions ? 2 : 3;
  return { won, runs, actions, blocks: program.blocks, stars };
}

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
