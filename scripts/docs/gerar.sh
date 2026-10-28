#!/usr/bin/env bash
# Regenera os três PDFs de docs/ a partir do código atual.
# Requisitos: python3, Node com Playwright (npx playwright install chromium) e as fontes
# Inter, JetBrains Mono e Bitstream Charter instaladas (sem elas o PDF usa fontes substitutas).
# As capturas de tela ficam em scripts/docs/img; para refazê-las, veja capturas-1.cjs e capturas-2.cjs.
set -euo pipefail
cd "$(dirname "$0")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

python3 documentacao.py "$tmp/documentacao.html"
node pdf.cjs "$tmp/documentacao.html" ../../docs/wumpus3d-documentacao.pdf "Wumpus 3D — Documentação técnica"

python3 fundamentacao.py "$tmp/fundamentacao.html"
node pdf.cjs "$tmp/fundamentacao.html" ../../docs/agente-genetico-fundamentacao.pdf "Wumpus 3D — Agente genético: fundamentação teórica"

python3 manual.py "$tmp/manual.html"
node pdf.cjs "$tmp/manual.html" ../../docs/wumpus3d-manual-de-uso.pdf "Wumpus 3D — Manual de uso"

echo "PDFs atualizados em docs/"
