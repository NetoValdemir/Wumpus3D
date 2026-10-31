// "Salvar mapas": salvar, carregar, exportar e importar mapas (JSON com coordenadas 1-based, D7).
import { parseLayout, type MapLayout } from '../game/world';
import { deleteMap, loadSavedMaps, saveMap } from '../storage';
import { slugify } from '../util/format';
import { $, confirmTwice, copyFromBox, downloadText, showMessage } from './dom';
import { playLayout } from './game';
import { updateHud } from './hud';
import { currentMapName, match } from './state';

const mapMsg = (text: string, error = false) => showMessage('#map-msg', text, error);
const mapList = () => $<HTMLSelectElement>('#map-list');
const mapJson = () => $<HTMLTextAreaElement>('#map-json');

const fileName = (l: MapLayout) => `wumpus-${slugify(l.name) || 'mapa'}.json`;
const toJson = (l: MapLayout) => JSON.stringify(l, null, 2);
const currentLayout = () => ({ ...match.layout, name: currentMapName() });
const selectedMap = () => loadSavedMaps().find((m) => m.name === mapList().value);

let resetDelete = () => {};

function refreshMapList(select?: string) {
  const maps = loadSavedMaps();
  const list = mapList();
  list.innerHTML = '';
  if (!maps.length) list.add(new Option('Nenhum mapa salvo ainda', ''));
  for (const m of maps) list.add(new Option(`${m.name} (${m.size}×${m.size})`, m.name));
  if (select) list.value = select;
  for (const id of ['#map-load', '#map-export', '#map-delete']) $<HTMLButtonElement>(id).disabled = !maps.length;
  resetDelete();
}

/** Abre a caixa do JSON (e a seção, que pode estar fechada) para o usuário ver e copiar. */
function showJsonBox() {
  const paste = $<HTMLDetailsElement>('details.paste');
  paste.open = true;
  paste.closest<HTMLDetailsElement>('details.fold')!.open = true;
}

/** Baixa o JSON e também o coloca na caixa de texto (onde downloads são bloqueados, dá para copiar). */
function exportLayout(l: MapLayout) {
  mapJson().value = toJson(l);
  downloadText(fileName(l), toJson(l), 'application/json'); // bloqueado: o JSON continua na caixa de texto
  showJsonBox();
  mapMsg(`"${l.name}" exportado como ${fileName(l)}. O JSON também está na caixa abaixo para copiar.`);
}

function importJson(text: string) {
  try {
    const l = parseLayout(text);
    const saved = saveMap(l);
    refreshMapList(l.name);
    playLayout(l);
    mapMsg(saved ? `Mapa "${l.name}" importado e salvo.` : `Mapa "${l.name}" carregado (este navegador não permite salvar).`);
  } catch (err) {
    mapMsg(`Não deu para importar: ${(err as Error).message}`, true);
  }
}

function saveCurrent() {
  const input = $<HTMLInputElement>('#map-name');
  const world = match.world;
  const name = input.value.trim() || `Mapa ${world.size}×${world.size} — ${new Date().toLocaleString('pt-BR')}`;
  const l = { ...match.layout, name };
  if (!saveMap(l)) return mapMsg('Este navegador está bloqueando o armazenamento. Use "Exportar mapa atual" para guardar o arquivo.', true);
  match.layout = l;
  match.mapName = name;
  input.value = '';
  refreshMapList(name);
  updateHud();
  mapMsg(`Mapa "${name}" salvo neste navegador.`);
}

export function initMapsPanel() {
  $('#map-save').addEventListener('click', saveCurrent);
  $('#map-load').addEventListener('click', () => {
    const l = selectedMap();
    if (!l) return;
    playLayout(l);
    mapMsg(`Jogando "${l.name}".`);
  });
  $('#map-export').addEventListener('click', () => {
    const l = selectedMap();
    if (l) exportLayout(l);
  });
  $('#map-export-current').addEventListener('click', () => exportLayout(currentLayout()));

  resetDelete = confirmTwice($<HTMLButtonElement>('#map-delete'), {
    canStart: () => !!selectedMap(),
    confirmLabel: () => 'Confirmar?',
    onConfirm: () => {
      const l = selectedMap()!;
      deleteMap(l.name);
      refreshMapList();
      mapMsg(`Mapa "${l.name}" excluído.`);
    },
  });
  mapList().addEventListener('change', () => resetDelete());

  $<HTMLInputElement>('#map-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) importJson(await file.text());
    input.value = '';
  });
  $('#map-paste-load').addEventListener('click', () => importJson(mapJson().value));
  $('#map-copy').addEventListener('click', () => {
    if (!mapJson().value.trim()) mapJson().value = toJson(currentLayout());
    copyFromBox(mapJson(), (t) => mapMsg(t), 'JSON copiado.');
  });
  refreshMapList();
}
