// Guardar os dados do professor num repositório PRIVADO do GitHub dele (D23, opcional).
// Usa a API REST do GitHub direto do navegador (ela aceita requisições de outras origens) com um token
// de acesso refinado criado pelo professor, limitado a esse repositório. O token nunca vai para o código
// do site; fica só no navegador do professor. Recusa gravar em repositório público (dados de alunos).
import { slugify } from '../util/format';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  folder: string; // pasta dentro do repositório
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';

/** Texto UTF-8 ↔ base64 (a API de conteúdo trabalha em base64). */
export function utf8ToB64(text: string) {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
export const b64ToUtf8 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function explain(status: number, what: string): string {
  if (status === 401) return 'O token não foi aceito (expirou, foi revogado ou foi copiado errado).';
  if (status === 403) return `O token não tem permissão para ${what}. Confira se ele dá acesso de leitura e escrita a "Contents" neste repositório.`;
  if (status === 404) return 'Repositório não encontrado, ou o token não tem acesso a ele.';
  if (status === 409 || status === 422) return 'O arquivo mudou no GitHub enquanto você salvava. Tente de novo.';
  return `O GitHub respondeu com erro ${status}.`;
}

export class GitHubStore {
  private cfg: GitHubConfig;
  private fetchFn: FetchFn;

  constructor(cfg: GitHubConfig, fetchFn: FetchFn = (u, i) => fetch(u, i)) {
    this.cfg = { ...cfg, folder: cfg.folder.replace(/^\/+|\/+$/g, '') || 'caverna' };
    this.fetchFn = fetchFn;
  }

  private headers(extra: Record<string, string> = {}) {
    return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.cfg.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...extra };
  }

  private url(path: string) {
    const enc = path.split('/').map(encodeURIComponent).join('/');
    return `${API}/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}/contents/${this.cfg.folder}/${enc}`;
  }

  /** Confere o acesso. Lança erro se o repositório for público. */
  async check(): Promise<{ fullName: string; private: boolean }> {
    const r = await this.fetchFn(`${API}/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}`, { headers: this.headers() });
    if (!r.ok) throw new GitHubError(explain(r.status, 'ler o repositório'), r.status);
    const data = (await r.json()) as { full_name: string; private: boolean; permissions?: { push?: boolean } };
    if (!data.private) throw new GitHubError('Este repositório é PÚBLICO. Os dados dos alunos só podem ser guardados num repositório privado.', 0);
    return { fullName: data.full_name, private: data.private };
  }

  /** Lê um arquivo JSON (null se não existir). */
  async read<T>(path: string): Promise<{ data: T; sha: string } | null> {
    const r = await this.fetchFn(this.url(path), { headers: this.headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new GitHubError(explain(r.status, 'ler arquivos'), r.status);
    const f = (await r.json()) as { content: string; sha: string };
    return { data: JSON.parse(b64ToUtf8(f.content)) as T, sha: f.sha };
  }

  /** Nomes dos arquivos de uma pasta (vazio se a pasta não existir). */
  async list(dir: string): Promise<string[]> {
    const r = await this.fetchFn(this.url(dir), { headers: this.headers() });
    if (r.status === 404) return [];
    if (!r.ok) throw new GitHubError(explain(r.status, 'listar arquivos'), r.status);
    const items = (await r.json()) as { name: string; type: string }[];
    return Array.isArray(items) ? items.filter((i) => i.type === 'file').map((i) => i.name) : [];
  }

  /** Cria ou substitui um arquivo (texto). Cada gravação vira um commit: o GitHub guarda o histórico. */
  async writeText(path: string, text: string, message: string): Promise<void> {
    const current = await this.fetchFn(this.url(path), { headers: this.headers() });
    let sha: string | undefined;
    if (current.ok) sha = ((await current.json()) as { sha: string }).sha;
    else if (current.status !== 404) throw new GitHubError(explain(current.status, 'ler arquivos'), current.status);
    const r = await this.fetchFn(this.url(path), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, content: utf8ToB64(text), ...(sha ? { sha } : {}) }),
    });
    if (!r.ok) throw new GitHubError(explain(r.status, 'gravar arquivos'), r.status);
  }

  writeJson(path: string, data: unknown, message: string) {
    return this.writeText(path, JSON.stringify(data, null, 2), message);
  }
}

/** Nome de arquivo seguro para pastas do repositório. */
export const fileSlug = (text: string) => slugify(text) || 'sem-nome';
