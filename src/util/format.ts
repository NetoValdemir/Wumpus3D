// Formatação de texto usada em tabelas, relatórios e nomes de arquivo. Sem DOM: vale no navegador e no Node.

/** Escapa texto para dentro de HTML (conteúdo e atributos entre aspas duplas). */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `v` em `n`, como porcentagem inteira ("42%"); "0%" quando não há total. */
export const percentOf = (v: number, n: number) => `${n ? Math.round((100 * v) / n) : 0}%`;

/** Probabilidade de 0 a 1 como porcentagem inteira ("42%"). */
export const percent = (p: number) => `${Math.round(p * 100)}%`;

/** Número com `digits` casas, ou "—" quando não há valor. `comma` troca o ponto pela vírgula decimal. */
export const fixedOrDash = (v: number | null, digits = 1, comma = false) => {
  if (v === null) return '—';
  const text = v.toFixed(digits);
  return comma ? text.replace('.', ',') : text;
};

/** Trecho seguro para nome de arquivo ou identificador: minúsculas, sem acentos, palavras unidas por "-". */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
