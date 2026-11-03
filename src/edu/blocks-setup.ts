// Blocos do robô no Blockly (biblioteca de blocos de código aberto, Apache-2.0): definições, caixa de
// ferramentas por missão e criação da área de montagem. Só aqui o Blockly é importado.
import * as Blockly from 'blockly/core';
import 'blockly/blocks'; // blocos prontos (usamos as funções: procedures_*)
import * as Pt from 'blockly/msg/pt-br';
import { BLOCK, type WorkspaceJson } from './blockly-json';
import type { BlockGroup } from './missions';

let defined = false;

const COLOR = { acao: 210, flecha: 0, repetir: 35, se: 270, sensor: 160, logica: 300 };

function defineBlocks() {
  if (defined) return;
  defined = true;
  Blockly.setLocale(Pt as unknown as Record<string, string>);
  // Nomes mais simples para crianças
  Object.assign(Blockly.Msg, {
    PROCEDURES_DEFNORETURN_TITLE: 'função',
    PROCEDURES_DEFNORETURN_PROCEDURE: 'minha_função',
    PROCEDURES_DEFNORETURN_TOOLTIP: 'Crie um bloco novo com os comandos que você colocar dentro.',
    PROCEDURES_CALLNORETURN_TOOLTIP: 'Executa os comandos da função.',
  });
  const action = (type: string, text: string, colour: number, tooltip: string) => ({ type, message0: text, previousStatement: null, nextStatement: null, colour, tooltip });
  const cond = (type: string, text: string, tooltip: string) => ({ type, message0: text, output: 'Boolean', colour: COLOR.sensor, tooltip });
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: BLOCK.start,
      message0: 'quando começar %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      colour: 45,
      tooltip: 'O robô faz, em ordem, os blocos encaixados aqui dentro.',
      deletable: false,
    },
    action(BLOCK.forward, 'avançar ▲', COLOR.acao, 'Anda uma sala para a frente.'),
    action(BLOCK.left, 'girar à esquerda ↺', COLOR.acao, 'Gira 90° para a esquerda, sem sair da sala.'),
    action(BLOCK.right, 'girar à direita ↻', COLOR.acao, 'Gira 90° para a direita, sem sair da sala.'),
    action(BLOCK.grab, 'pegar o ouro', COLOR.acao, 'Pega o ouro, se ele estiver nesta sala.'),
    action(BLOCK.shoot, 'atirar a flecha ➶', COLOR.flecha, 'Atira a única flecha para a frente. Se acertar o Wumpus, ele grita.'),
    {
      type: BLOCK.repeat,
      message0: 'repetir %1 vezes %2 %3',
      args0: [{ type: 'field_number', name: 'TIMES', value: 2, min: 1, max: 100, precision: 1 }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR.repetir,
      tooltip: 'Faz os blocos de dentro várias vezes.',
    },
    {
      type: BLOCK.until,
      message0: 'repetir até %1 %2',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR.repetir,
      tooltip: 'Faz os blocos de dentro até a condição ficar verdadeira.',
    },
    {
      type: BLOCK.while,
      message0: 'repetir enquanto %1 %2',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR.repetir,
      tooltip: 'Faz os blocos de dentro enquanto a condição for verdadeira.',
    },
    {
      type: BLOCK.if,
      message0: 'se %1 então %2',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR.se,
      tooltip: 'Só faz os blocos de dentro se a condição for verdadeira.',
    },
    {
      type: BLOCK.ifElse,
      message0: 'se %1 então %2 senão %3',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }, { type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR.se,
      tooltip: 'Se a condição for verdadeira faz a primeira parte; senão, a segunda.',
    },
    {
      type: BLOCK.sense,
      message0: '%1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'WHAT',
          options: [
            ['sentir brisa 💨', 'breeze'],
            ['sentir fedor 👃', 'stench'],
            ['ver brilho ✨', 'glitter'],
            ['bater na parede', 'bump'],
            ['ouvir o grito', 'scream'],
          ],
        },
      ],
      output: 'Boolean',
      colour: COLOR.sensor,
      tooltip: 'O que o robô sente na sala onde está agora.',
    },
    cond(BLOCK.wallAhead, 'parede à frente', 'Verdadeiro se a próxima sala na frente do robô é parede (fora da caverna).'),
    cond(BLOCK.visitedAhead, 'sala à frente já visitada', 'Verdadeiro se o robô já esteve na sala da frente.'),
    cond(BLOCK.atEntrance, 'estou na entrada', 'Verdadeiro na sala (1, 1).'),
    cond(BLOCK.hasGold, 'estou com o ouro', 'Verdadeiro depois de pegar o ouro.'),
    cond(BLOCK.hasArrow, 'tenho a flecha', 'Verdadeiro enquanto a flecha não foi usada.'),
    { type: BLOCK.not, message0: 'não %1', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }], output: 'Boolean', colour: COLOR.logica, tooltip: 'Inverte a condição.' },
    {
      type: BLOCK.logic,
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A', check: 'Boolean' },
        { type: 'field_dropdown', name: 'OP', options: [['e', 'and'], ['ou', 'or']] },
        { type: 'input_value', name: 'B', check: 'Boolean' },
      ],
      inputsInline: true,
      output: 'Boolean',
      colour: COLOR.logica,
      tooltip: '"e": as duas precisam ser verdadeiras. "ou": basta uma.',
    },
  ]);
}

const blocks = (...types: string[]) => types.map((type) => ({ kind: 'block', type }));

const CATEGORIES: Record<BlockGroup, object> = {
  acoes: { kind: 'category', name: 'Ações', colour: COLOR.acao, contents: blocks(BLOCK.forward, BLOCK.left, BLOCK.right, BLOCK.grab) },
  flecha: { kind: 'category', name: 'Flecha', colour: COLOR.flecha, contents: blocks(BLOCK.shoot) },
  repetir: { kind: 'category', name: 'Repetir', colour: COLOR.repetir, contents: blocks(BLOCK.repeat) },
  repetirAte: { kind: 'category', name: 'Repetir até', colour: COLOR.repetir, contents: blocks(BLOCK.until, BLOCK.while) },
  se: { kind: 'category', name: 'Se', colour: COLOR.se, contents: blocks(BLOCK.if, BLOCK.ifElse) },
  sensores: { kind: 'category', name: 'Sensores', colour: COLOR.sensor, contents: [...blocks(BLOCK.sense), ...blocks(BLOCK.wallAhead, BLOCK.visitedAhead, BLOCK.atEntrance, BLOCK.hasGold, BLOCK.hasArrow)] },
  logica: { kind: 'category', name: 'E / ou / não', colour: COLOR.logica, contents: blocks(BLOCK.logic, BLOCK.not) },
  funcoes: { kind: 'category', name: 'Funções', colour: 120, custom: 'PROCEDURE' },
};

export function toolboxFor(groups: BlockGroup[]) {
  // "Repetir até" e "Se" juntam os sensores na mesma lista que os usa: menos cliques para quem está começando
  return { kind: 'categoryToolbox', contents: groups.map((g) => CATEGORIES[g]) };
}

export const EMPTY_PROGRAM: WorkspaceJson = { blocks: { blocks: [{ type: BLOCK.start, id: 'inicio', x: 20, y: 20 } as never] } };

/** Cria a área de montagem dentro do elemento. */
export function createWorkspace(div: HTMLElement, groups: BlockGroup[]) {
  defineBlocks();
  return Blockly.inject(div, {
    toolbox: toolboxFor(groups) as Blockly.utils.toolbox.ToolboxDefinition,
    trashcan: true,
    sounds: false, // sem isso o Blockly baixa sons de um servidor externo
    media: './blockly-media/', // imagens do Blockly servidas pelo próprio site (public/blockly-media)
    zoom: { controls: true, wheel: false, startScale: 1.05 },
    move: { scrollbars: true, drag: true, wheel: true },
    renderer: 'zelos', // blocos arredondados, mais fáceis de tocar
    grid: { spacing: 24, length: 2, colour: '#3a3026', snap: true },
    theme: Blockly.Theme.defineTheme('wumpus-escola', {
      name: 'wumpus-escola',
      base: Blockly.Themes.Classic,
      componentStyles: { workspaceBackgroundColour: '#1f1a15', toolboxBackgroundColour: '#2a221b', toolboxForegroundColour: '#f1e8d8', flyoutBackgroundColour: '#2f261e', flyoutOpacity: 0.95, scrollbarColour: '#6b5a45' },
    }),
  });
}

export const saveWorkspace = (ws: Blockly.WorkspaceSvg) => Blockly.serialization.workspaces.save(ws) as WorkspaceJson;

export function loadWorkspace(ws: Blockly.WorkspaceSvg, json: WorkspaceJson | null) {
  ws.clear();
  try {
    Blockly.serialization.workspaces.load((json ?? EMPTY_PROGRAM) as object, ws);
  } catch {
    Blockly.serialization.workspaces.load(EMPTY_PROGRAM as object, ws);
  }
  if (!ws.getBlocksByType(BLOCK.start, false).length) Blockly.serialization.blocks.append({ type: BLOCK.start, x: 20, y: 20 }, ws);
}

export type Workspace = Blockly.WorkspaceSvg;
export { Blockly };
