// Leitura das opções de linha de comando dos scripts (--opcao valor), descrita como uma tabela.

/** Trata uma opção: `next()` lê o valor que vem logo depois dela. */
export type Flag<T> = (opts: T, next: () => string) => void;

/** Aplica cada opção conhecida sobre `opts`; o que não for opção vai para `positional` (ou é ignorado). */
export function parseFlags<T>(argv: string[], opts: T, flags: Record<string, Flag<T>>, positional?: (opts: T, arg: string) => void): T {
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    const flag = flags[argv[i]];
    if (flag) flag(opts, next);
    else positional?.(opts, argv[i]);
  }
  return opts;
}
