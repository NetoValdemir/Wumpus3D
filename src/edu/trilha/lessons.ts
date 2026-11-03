// Trilha de IA para o ensino médio (D23): seis módulos, um por grande ideia, cada um com uma lição curta.
// As lições são dados: texto, interação no tabuleiro e perguntas conferidas na hora. O professor coloca
// lições no plano da turma e as respostas vão para o registro do aluno.
import type { Action, MapLayout } from '../../game/world';
import { DetectiveGame } from '../detective';

export type Widget = 'percepcoes' | 'deducao' | 'crencas' | 'busca' | 'genetico' | 'arena';

export type Step =
  | { type: 'texto'; title: string; paragraphs: string[] }
  | { type: 'tabuleiro'; widget: Widget; title: string; text: string; cave?: MapLayout; moves?: Action[] }
  | { type: 'escolha'; prompt: string; options: string[]; answer: number; explain: string }
  | { type: 'numero'; prompt: string; unit: string; answer: number; tolerance: number; explain: string }
  | { type: 'reflexao'; prompt: string };

export interface Lesson {
  id: string;
  module: number;
  title: string;
  idea: string; // grande ideia do AI4K12
  goal: string;
  minutes: number;
  steps: Step[];
}

const cave = (size: number, pits: [number, number][], wumpus: [number, number], gold: [number, number]): MapLayout => ({
  format: 'wumpus3d-map',
  version: 1,
  name: 'Caverna da lição',
  size,
  pitProbability: 0.2,
  pits,
  wumpus,
  gold,
});

// Poço em (3,1), Wumpus em (1,3), ouro em (2,3): as pistas da entrada levam a deduções clássicas
const CAVE_A = cave(4, [[3, 1]], [1, 3], [2, 3]);
// Corredor e uma volta: o caminho de volta passa só por salas visitadas
const CAVE_B = cave(5, [[3, 3]], [1, 5], [5, 5]);

export const LESSONS: Lesson[] = [
  {
    id: 'ia1',
    module: 1,
    title: 'O agente e o ambiente',
    idea: 'Percepção',
    goal: 'Entender que um agente inteligente só conhece o mundo pelos sensores e age a partir disso.',
    minutes: 15,
    steps: [
      {
        type: 'texto',
        title: 'O que é um agente?',
        paragraphs: [
          'Na Inteligência Artificial, um <b>agente</b> é qualquer coisa que percebe o ambiente por sensores e age sobre ele: um robô aspirador, um carro autônomo, o personagem de um jogo.',
          'O robô da caverna não vê o mapa. Ele tem cinco sensores: <b>brisa</b> (poço numa sala vizinha), <b>fedor</b> (Wumpus por perto), <b>brilho</b> (ouro na sala), <b>batida</b> (parede) e <b>grito</b> (o Wumpus morreu).',
          'Para descrever um problema de IA, usamos quatro perguntas: qual é o <b>objetivo</b> (pegar o ouro e voltar vivo), qual é o <b>ambiente</b> (a caverna), quais são as <b>ações</b> (avançar, girar, pegar, atirar) e quais são os <b>sensores</b>.',
        ],
      },
      { type: 'tabuleiro', widget: 'percepcoes', title: 'Seja o robô', text: 'Ande pela caverna. À direita aparece só o que o robô sabe: o que ele sentiu em cada sala visitada. Repare que ele nunca "vê" o poço, só sente a brisa.', cave: CAVE_A },
      {
        type: 'escolha',
        prompt: 'Na entrada (1, 1) o robô não sente nada. O que ele pode concluir sobre as salas vizinhas (2, 1) e (1, 2)?',
        options: ['Não têm poço nem Wumpus: são seguras', 'Uma delas tem poço', 'Não dá para concluir nada', 'O ouro está numa delas'],
        answer: 0,
        explain: 'Sem brisa, nenhuma vizinha tem poço; sem fedor, o Wumpus não está em nenhuma vizinha.',
      },
      {
        type: 'escolha',
        prompt: 'Em (2, 1) o robô sente brisa. O que isso quer dizer?',
        options: ['Há um poço em (2, 1)', 'Há poço em pelo menos uma sala vizinha de (2, 1)', 'Há um poço exatamente em (3, 1)', 'O Wumpus está por perto'],
        answer: 1,
        explain: 'A brisa diz que existe poço ao lado, mas não diz em qual vizinha. Para saber, o robô precisa juntar mais pistas.',
      },
      { type: 'numero', prompt: 'Quantos sensores (tipos de percepção) o robô tem?', unit: 'sensores', answer: 5, tolerance: 0, explain: 'Brisa, fedor, brilho, batida e grito.' },
    ],
  },
  {
    id: 'ia2',
    module: 2,
    title: 'Lógica: o que dá para ter certeza',
    idea: 'Representação e raciocínio',
    goal: 'Usar regras lógicas para deduzir salas seguras e perigosas, e conferir o raciocínio do robô.',
    minutes: 20,
    steps: [
      {
        type: 'texto',
        title: 'Regras do mundo',
        paragraphs: [
          'O robô guarda o que sentiu em cada sala e aplica <b>regras</b>, como uma pessoa resolvendo um enigma:',
          '1. <b>Sem brisa → nenhuma vizinha tem poço.</b> 2. <b>Brisa → pelo menos uma vizinha tem poço.</b> Se só sobra uma vizinha que pode ter poço, o poço está nela.',
          '3. <b>Sem fedor → o Wumpus não está em nenhuma vizinha.</b> 4. <b>Fedor → o Wumpus está numa vizinha.</b> Ele só pode estar numa sala que seja vizinha de <i>todas</i> as salas com fedor.',
          'Essa forma de raciocinar é a <b>lógica</b>: a conclusão é certa sempre que as regras e as pistas são verdadeiras.',
        ],
      },
      {
        type: 'tabuleiro',
        widget: 'deducao',
        title: 'Por que o robô sabe?',
        text: 'O robô já visitou (1, 1), (2, 1) e (1, 2). Toque em cada sala para ver o que ele deduziu e o motivo.',
        cave: CAVE_A,
        moves: ['forward', 'left', 'left', 'forward', 'right', 'forward'],
      },
      { type: 'escolha', prompt: 'Qual destas salas é comprovadamente segura?', options: ['(3, 1)', '(2, 2)', '(1, 3)', '(4, 4)'], answer: 1, explain: '(2, 2) é vizinha de (1, 2), que não tinha brisa, e de (2, 1), que não tinha fedor.' },
      { type: 'escolha', prompt: 'Onde o robô tem certeza de que há um poço?', options: ['(3, 1)', '(2, 2)', '(1, 3)', 'Em nenhuma sala'], answer: 0, explain: 'A brisa de (2, 1) precisa de um poço vizinho; (1, 1) e (2, 2) não podem ter. Sobra (3, 1).' },
      { type: 'escolha', prompt: 'Onde está o Wumpus?', options: ['(2, 2)', '(1, 3)', '(3, 1)', 'Ainda não dá para saber'], answer: 1, explain: 'O fedor em (1, 2) aponta para (1, 3) ou (2, 2); (2, 2) é vizinha de (2, 1), que não tinha fedor.' },
    ],
  },
  {
    id: 'ia3',
    module: 3,
    title: 'Probabilidade: quando não dá para ter certeza',
    idea: 'Representação e raciocínio',
    goal: 'Calcular a chance de poço contando combinações e decidir pelo menor custo esperado.',
    minutes: 25,
    steps: [
      {
        type: 'texto',
        title: 'Contar as possibilidades',
        paragraphs: [
          'Às vezes a lógica não basta: a brisa de (2, 1) pode vir de (3, 1) ou de (2, 2), e nenhuma regra decide. O agente <b>probabilístico</b> conta as combinações possíveis.',
          'Cada sala tem 20% de chance de ter poço. Uma combinação com poço em (3, 1) e sem poço em (2, 2) tem peso 0,2 × 0,8 = 0,16. Só valem as combinações que explicam todas as brisas.',
          'A chance de poço numa sala é: soma dos pesos das combinações com poço nela ÷ soma dos pesos de todas as combinações válidas.',
        ],
      },
      {
        type: 'tabuleiro',
        widget: 'crencas',
        title: 'As combinações',
        text: 'O robô está em (2, 1) e sentiu brisa. O tabuleiro mostra a chance de poço em cada sala da fronteira. Toque numa delas para ver a tabela de combinações.',
        cave: CAVE_A,
        moves: ['forward'],
      },
      { type: 'numero', prompt: 'Qual a chance (em %) de haver poço em (3, 1)?', unit: '%', answer: 56, tolerance: 2, explain: 'Válidas: só (3,1) = 0,16; só (2,2) = 0,16; as duas = 0,04. Total 0,36. (0,16 + 0,04) ÷ 0,36 ≈ 56%.' },
      {
        type: 'escolha',
        prompt: 'Por que (1, 2) tem 0% de chance de poço?',
        options: ['Porque é vizinha de (1, 1), onde não havia brisa', 'Porque fica longe do ouro', 'Porque o robô ainda não foi lá', 'É sorte'],
        answer: 0,
        explain: 'A lógica continua valendo: sem brisa em (1, 1), nenhuma vizinha dela tem poço.',
      },
      {
        type: 'numero',
        prompt: 'Decidir é comparar custos. Morrer custa 1000 pontos e cada passo custa 1. Qual o custo esperado de ir até uma sala a 3 passos com 20% de risco? (1000 × 0,2 + 3)',
        unit: 'pontos',
        answer: 203,
        tolerance: 0,
        explain: 'É a "utilidade esperada": o agente escolhe a sala de menor custo esperado.',
      },
    ],
  },
  {
    id: 'ia4',
    module: 4,
    title: 'Busca: o caminho de volta',
    idea: 'Representação e raciocínio',
    goal: 'Acompanhar uma busca em largura e entender por que ela acha o caminho mais curto.',
    minutes: 15,
    steps: [
      {
        type: 'texto',
        title: 'Busca em largura',
        paragraphs: [
          'Com o ouro na mão, o robô precisa voltar à entrada pelo caminho mais curto <b>usando só salas que ele sabe que são seguras</b>.',
          'A <b>busca em largura</b> usa uma fila: tira a primeira sala, coloca no fim da fila as vizinhas ainda não vistas, e repete. Como explora primeiro as salas a 1 passo, depois a 2, e assim por diante, o primeiro caminho que chega ao objetivo é o mais curto.',
        ],
      },
      { type: 'tabuleiro', widget: 'busca', title: 'Passo a passo', text: 'O robô está em (4, 3). Avance a busca e acompanhe a fila. Ela só passa por salas visitadas.', cave: CAVE_B, moves: ['forward', 'forward', 'forward', 'left', 'forward', 'forward'] },
      { type: 'numero', prompt: 'Quantos passos ("avançar") tem o caminho mais curto de (4, 3) até a entrada?', unit: 'passos', answer: 5, tolerance: 0, explain: '(4,3) → (4,2) → (4,1) → (3,1) → (2,1) → (1,1).' },
      {
        type: 'escolha',
        prompt: 'Por que a busca do robô só usa salas já visitadas?',
        options: ['Porque são as únicas que ele sabe com certeza que são seguras', 'Porque são mais curtas', 'Porque o jogo proíbe outras salas', 'Para gastar menos memória'],
        answer: 0,
        explain: 'Uma sala desconhecida pode ter poço: o caminho de volta não arrisca.',
      },
    ],
  },
  {
    id: 'ia5',
    module: 5,
    title: 'Aprendizado: o robô que evolui',
    idea: 'Aprendizado',
    goal: 'Ver um algoritmo genético ajustar pesos e entender a diferença entre decorar e generalizar.',
    minutes: 25,
    steps: [
      {
        type: 'texto',
        title: 'Pesos, aptidão e gerações',
        paragraphs: [
          'O agente genético escolhe a próxima sala dando uma <b>nota</b> a cada uma: risco × peso + distância × peso + … Os <b>pesos</b> são o "DNA" (genoma) do agente.',
          'O algoritmo genético cria vários agentes com pesos diferentes, faz todos jogarem, mede a <b>aptidão</b> (a pontuação média), e os melhores geram os da próxima <b>geração</b>, misturando pesos (cruzamento) e mudando um pouco ao acaso (mutação).',
          'Ninguém escreve a estratégia: ela aparece com as gerações. Isso é <b>aprendizado de máquina</b>.',
        ],
      },
      { type: 'tabuleiro', widget: 'genetico', title: 'Treine você', text: 'Treine com uma caverna só e depois com várias. Em cada caso, o resultado é testado em 100 cavernas que o agente nunca viu.' },
      {
        type: 'escolha',
        prompt: 'O que é a aptidão de um agente no algoritmo genético?',
        options: ['A pontuação média dele jogando as cavernas', 'O número de pesos', 'A velocidade para decidir', 'Quantas gerações ele viveu'],
        answer: 0,
        explain: 'Aptidão é a medida de quão bem ele joga; é ela que decide quem passa adiante.',
      },
      {
        type: 'escolha',
        prompt: 'Ao treinar numa caverna só, o que costuma acontecer nas cavernas novas?',
        options: ['Vai melhor do que no treino', 'Vai bem na caverna do treino e pior nas novas: decorou em vez de aprender', 'Fica exatamente igual', 'Não consegue jogar'],
        answer: 1,
        explain: 'É o sobreajuste: o modelo se adapta aos dados de treino e generaliza mal. Por isso se treina com muitos exemplos e se testa com outros.',
      },
    ],
  },
  {
    id: 'ia6',
    module: 6,
    title: 'Avaliação e impacto',
    idea: 'Impacto social',
    goal: 'Comparar agentes de forma justa e discutir a responsabilidade de máquinas que decidem sozinhas.',
    minutes: 25,
    steps: [
      {
        type: 'texto',
        title: 'Como saber se um agente é bom?',
        paragraphs: [
          'Cavernas sorteadas mudam muito: numa o ouro está do lado, noutra atrás de três poços. Para comparar agentes, todos jogam <b>as mesmas cavernas</b>, e em <b>muitas</b> delas: com poucas, a sorte decide.',
          'Na Arena, seu programa de blocos joga contra os agentes lógico e probabilístico do jogo.',
        ],
      },
      { type: 'tabuleiro', widget: 'arena', title: 'Arena', text: 'Escolha um dos seus programas de blocos e coloque para jogar 20 cavernas contra os agentes do jogo.' },
      {
        type: 'escolha',
        prompt: 'Por que todos os agentes jogam as mesmas cavernas?',
        options: ['Para a sorte do mapa não decidir quem é melhor', 'Para ficar mais rápido', 'Porque só existem 20 cavernas', 'Para o professor corrigir mais fácil'],
        answer: 0,
        explain: 'Com os mesmos mapas, a diferença de pontuação vem da estratégia, não do sorteio.',
      },
      {
        type: 'escolha',
        prompt: 'Em 5 cavernas, o agente A fez um pouco mais de pontos que o B. O que fazer antes de dizer que A é melhor?',
        options: ['Testar os dois em muito mais cavernas', 'Nada: A é melhor', 'Testar só o B de novo', 'Trocar as regras do jogo'],
        answer: 0,
        explain: 'Poucos testes têm muito ruído. Quanto mais cavernas, mais confiável a comparação.',
      },
      { type: 'reflexao', prompt: 'Um carro autônomo também decide com informação incompleta, como o robô. Quando ele erra, quem deve responder: quem programou, quem fabricou, quem usa? Escreva sua opinião em poucas linhas.' },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

export type Question = Extract<Step, { type: 'escolha' | 'numero' }>;
export const isQuestion = (s: Step): s is Question => s.type === 'escolha' || s.type === 'numero';

/** Confere a resposta: índice da opção ou número digitado (aceita vírgula). */
export function checkAnswer(q: Question, value: string | number): boolean {
  if (q.type === 'escolha') return Number(value) === q.answer;
  const n = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && String(value).trim() !== '' && Math.abs(n - q.answer) <= q.tolerance;
}

/** ★ terminou · ★★ acertou ao menos 2/3 de primeira · ★★★ acertou todas de primeira. */
export function lessonStars(firstTry: number, total: number): number {
  if (!total) return 3;
  if (firstTry === total) return 3;
  return firstTry / total >= 2 / 3 ? 2 : 1;
}

/** Estado da caverna depois dos passos da lição (para as telas de dedução, crenças e busca). */
export function replay(c: MapLayout, moves: Action[] = []): DetectiveGame {
  const g = new DetectiveGame(c);
  for (const m of moves) g.act(m);
  return g;
}
