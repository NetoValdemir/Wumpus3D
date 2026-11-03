#!/usr/bin/env bash
# Confere que uma mudança não alterou o comportamento do jogo: roda arena (4×4 e 6×6), medir e treinar com
# sementes fixas na versão atual e numa versão de referência, e compara as saídas (ignorando tempos, datas e
# o agente aleatório, que usa Math.random sem semente). Foi o teste principal da refatoração (D21).
#   scripts/verificacao/compara-saidas.sh [commit-de-referência, padrão main] [--rapido]
# Requisitos: jq. Leva ~2 min (--rapido pula medir e treinar).
set -euo pipefail
cd "$(dirname "$0")/../.."
REF="${1:-main}"
RAPIDO="${2:-}"
TMP="$(mktemp -d)"
trap 'git worktree remove --force "$TMP/ref" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
git worktree add -q "$TMP/ref" "$REF"
ln -s "$PWD/node_modules" "$TMP/ref/node_modules"

roda() { # $1 = pasta do projeto, $2 = pasta de saída
  mkdir -p "$2"
  (cd "$1" && npm run arena -- --maps 300 --seed verificacao --json "$2/a4.json" --relatorio "$2/r4.json" >/dev/null 2>&1)
  (cd "$1" && npm run arena -- --maps 150 --size 6 --seed verificacao6 --json "$2/a6.json" >/dev/null 2>&1)
  if [ "$RAPIDO" != "--rapido" ]; then
    (cd "$1" && npm run medir -- --mapas4 2000 --mapas6 500 2>/dev/null | grep -v Aleat | grep '%' > "$2/medir.txt")
    (cd "$1" && npm run treinar -- --seed base --pop 6 --geracoes 3 --mapas 40 --tamanhos 4 --validacao 100 2>/dev/null | grep -v '^Genoma treinado (' > "$2/treino.txt")
  fi
}
echo "Referência ($REF)…"; roda "$TMP/ref" "$TMP/base"
echo "Versão atual…"; roda "$PWD" "$TMP/novo"
F='del(.. | .avgDecisionMs?, .ms?, .date?, .created?) | del(.ranking[]? | select(.name|test("aleat"))) | del(.agents[]? | select(.name|test("aleat")))'
falhou=0
for f in a4 a6 r4; do
  if diff <(jq -S "$F" "$TMP/base/$f.json") <(jq -S "$F" "$TMP/novo/$f.json") >/dev/null; then echo "$f: idêntico"; else echo "$f: DIFERENTE"; falhou=1; fi
done
if [ "$RAPIDO" != "--rapido" ]; then
  for f in medir treino; do
    if diff "$TMP/base/$f.txt" "$TMP/novo/$f.txt" >/dev/null; then echo "$f: idêntico"; else echo "$f: DIFERENTE"; diff "$TMP/base/$f.txt" "$TMP/novo/$f.txt" | head; falhou=1; fi
  done
fi
exit $falhou
