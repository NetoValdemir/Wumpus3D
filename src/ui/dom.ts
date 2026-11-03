// Pequenos utilitários de interface usados por todas as telas (painel, Arena, Análise).

/** Elemento da página pelo seletor. Os seletores são do index.html, então sempre existem. */
export const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Mostra uma mensagem num elemento; `error` pinta de vermelho. */
export function showMessage(sel: string, text: string, error = false) {
  const el = $(sel);
  el.textContent = text;
  el.classList.toggle('error', error);
}

/** Inteiro digitado num campo, limitado a [min, max]; vazio ou inválido vira `fallback`. */
export function readInt(sel: string, min: number, max: number, fallback = min) {
  return Math.min(max, Math.max(min, Math.round(Number($<HTMLInputElement>(sel).value) || fallback)));
}

/** Deixa o navegador desenhar a tela antes de continuar um trabalho longo. */
export const nextFrame = () => new Promise((r) => setTimeout(r));

/** Baixa um arquivo de texto. Devolve false se o navegador bloquear o download. */
export function downloadText(name: string, text: string, type: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Copia o texto da caixa; se o navegador não deixar, seleciona o texto para o usuário copiar. */
export async function copyFromBox(box: HTMLTextAreaElement, say: (text: string) => void, copied: string) {
  try {
    await navigator.clipboard.writeText(box.value);
    say(copied);
  } catch {
    box.select();
    say('Não deu para copiar automaticamente. O texto está selecionado: use Ctrl+C.');
  }
}

/**
 * Botão que pede um segundo clique para confirmar (excluir, apagar...). Devolve a função que
 * desfaz o pedido de confirmação, para quando o contexto muda (outra seleção, por exemplo).
 */
export function confirmTwice(btn: HTMLButtonElement, opts: { confirmLabel: () => string; onConfirm: () => void; canStart?: () => boolean }) {
  const label = btn.textContent;
  const reset = () => {
    delete btn.dataset.confirm;
    btn.textContent = label;
  };
  btn.addEventListener('click', () => {
    if (opts.canStart && !opts.canStart()) return;
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = '1';
      btn.textContent = opts.confirmLabel();
      return;
    }
    reset();
    opts.onConfirm();
  });
  return reset;
}

/** Tela sobreposta (Arena, Análise): Esc fecha, e as teclas digitadas nela não controlam o jogo. */
export function initOverlay(sel: string, closeSel: string) {
  const close = () => ($(sel).hidden = true);
  $(closeSel).addEventListener('click', close);
  $(sel).addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  return close;
}
