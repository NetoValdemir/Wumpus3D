// Senhas do modo escola sem servidor (D23): a senha do professor e o PIN do aluno nunca são guardados,
// só um resumo derivado por PBKDF2 (Web Crypto, disponível no navegador e no Node). Isso evita que a senha
// apareça no armazenamento ou no código da turma, mas não é proteção forte: o site é público e a conferência
// acontece no próprio aparelho. Um PIN de 4 dígitos, em especial, pode ser descoberto por tentativa.

export interface SecretHash {
  salt: string; // base64
  hash: string; // base64
  iterations: number;
}

const enc = new TextEncoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(secret: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, 128);
  return toB64(new Uint8Array(bits));
}

export const TEACHER_ITERATIONS = 150_000;
export const PIN_ITERATIONS = 20_000; // o código da turma leva um resumo por aluno: precisa ser rápido de conferir

export async function hashSecret(secret: string, iterations = TEACHER_ITERATIONS): Promise<SecretHash> {
  const salt = crypto.getRandomValues(new Uint8Array(12));
  return { salt: toB64(salt), hash: await derive(secret, salt, iterations), iterations };
}

export async function verifySecret(secret: string, h: SecretHash): Promise<boolean> {
  const got = await derive(secret, fromB64(h.salt), h.iterations);
  // comparação sem atalho (tempo constante)
  let diff = got.length ^ h.hash.length;
  for (let i = 0; i < Math.min(got.length, h.hash.length); i++) diff |= got.charCodeAt(i) ^ h.hash.charCodeAt(i);
  return diff === 0;
}

/** PIN de 4 dígitos sorteado com o gerador seguro do navegador. */
export function randomPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, '0');
}

export const validPin = (pin: string) => /^\d{4}$/.test(pin);

/** Senha do professor: pelo menos 8 caracteres (é a única barreira da área do professor no aparelho). */
export const passwordProblem = (pw: string) => (pw.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : null);
