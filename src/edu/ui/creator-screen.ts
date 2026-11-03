// Tela do Criador de cavernas: editar sala a sala, validar, salvar, jogar e compartilhar por código.
import { key } from '../../game/world';
import { $, copyFromBox, showMessage } from '../../ui/dom';
import { boardSvg, renderBoard } from '../board';
import { applyTool, caveCode, caveProblems, caveToLayout, emptyCave, layoutToCave, parseCaveCode, resizeCave, type CaveDraft, type Tool } from '../caves';
import { deleteCave, loadCaves, saveCave } from '../edu-storage';
import { nav, sourceFromLayout } from './session';

let draft: CaveDraft = emptyCave();
const say = (text: string, error = false) => showMessage('#cr-msg', text, error);
const tool = () => (document.querySelector<HTMLInputElement>('input[name="tool"]:checked')?.value ?? 'poco') as Tool;

function render() {
  const pits = draft.pits;
  renderBoard(boardSvg('#cr-board'), {
    size: draft.size,
    cell: (x, y) => {
      const k = key(x, y);
      return { visited: true, pit: pits.has(k), gold: draft.gold === k, wumpus: draft.wumpus === k ? 'vivo' : undefined };
    },
    onCell: (x, y) => {
      if (!applyTool(draft, key(x, y), tool())) say('A entrada (1, 1) precisa ficar livre: é por ela que o robô entra.', true);
      render();
    },
  });
  const problems = caveProblems(draft);
  $('#cr-problems').replaceChildren(
    ...(problems.length ? problems : ['Caverna pronta para jogar!']).map((t) => Object.assign(document.createElement('li'), { textContent: t, className: problems.length ? 'bad' : 'ok' })),
  );
  for (const id of ['#cr-save', '#cr-play-det', '#cr-play-blk', '#cr-copy']) $<HTMLButtonElement>(id).disabled = problems.length > 0;
  $<HTMLTextAreaElement>('#cr-code').value = problems.length ? '' : caveCode(caveToLayout(draft));
  $<HTMLSelectElement>('#cr-size').value = String(draft.size);
  $<HTMLInputElement>('#cr-name').value = draft.name;
}

function renderList() {
  const caves = loadCaves();
  const ul = $('#cr-list');
  ul.replaceChildren(
    ...caves.map((c) => {
      const li = document.createElement('li');
      const name = Object.assign(document.createElement('span'), { textContent: `${c.name} (${c.size}×${c.size})` });
      const edit = Object.assign(document.createElement('button'), { textContent: 'Editar' });
      edit.addEventListener('click', () => {
        draft = layoutToCave(c);
        render();
        say(`Editando "${c.name}".`);
      });
      const del = Object.assign(document.createElement('button'), { textContent: 'Apagar', className: 'ghost' });
      del.addEventListener('click', () => {
        if (del.dataset.confirm) {
          deleteCave(c.name);
          renderList();
          say(`"${c.name}" apagada.`);
        } else {
          del.dataset.confirm = '1';
          del.textContent = 'Confirmar?';
        }
      });
      li.append(name, edit, del);
      return li;
    }),
  );
  if (!caves.length) ul.append(Object.assign(document.createElement('li'), { textContent: 'Nenhuma ainda. Monte uma e clique em Salvar.', className: 'hint' }));
}

function playable() {
  const l = caveToLayout(draft);
  saveCave(l);
  renderList();
  return l;
}

export function openCreator() {
  renderList();
  render();
  nav.show('criador');
}

export function initCreator() {
  $('#cr-name').addEventListener('input', (e) => {
    draft.name = (e.target as HTMLInputElement).value;
    $<HTMLTextAreaElement>('#cr-code').value = caveProblems(draft).length ? '' : caveCode(caveToLayout(draft));
  });
  $('#cr-size').addEventListener('change', (e) => {
    draft = resizeCave(draft, Number((e.target as HTMLSelectElement).value));
    render();
  });
  $('#cr-save').addEventListener('click', () => {
    const l = playable();
    say(`"${l.name}" salva em "Minhas cavernas". O professor pode usá-la num plano neste computador, ou você pode mandar o código.`);
  });
  $('#cr-play-det').addEventListener('click', () => nav.detective(sourceFromLayout(playable(), 'detetive')));
  $('#cr-play-blk').addEventListener('click', () => nav.blocks(sourceFromLayout(playable(), 'blocos')));
  $('#cr-clear').addEventListener('click', () => {
    draft = emptyCave(draft.size);
    render();
  });
  $('#cr-copy').addEventListener('click', () => copyFromBox($<HTMLTextAreaElement>('#cr-code'), (t) => say(t), 'Código copiado. Cole para um colega!'));
  $('#cr-open').addEventListener('click', () => {
    const box = $<HTMLTextAreaElement>('#cr-code');
    try {
      const l = parseCaveCode(box.value);
      draft = layoutToCave(l);
      render();
      say(`Caverna "${l.name}" aberta. Salve para guardar ou jogue direto.`);
    } catch (err) {
      say(`Não deu para abrir: ${(err as Error).message}`, true);
    }
  });
}
