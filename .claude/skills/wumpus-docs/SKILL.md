---
name: wumpus-docs
description: Atualizar e regenerar os PDFs do Wumpus 3D (documentação técnica, fundamentação teórica do agente genético e manual de uso) a partir dos geradores em scripts/docs. Use quando o código ou o comportamento mudou e a documentação precisa acompanhar, ou quando o usuário pedir um PDF novo ou revisado.
---

# Documentação em PDF do Wumpus 3D

## Onde fica cada coisa
| PDF (em `docs/`) | Gerador (em `scripts/docs/`) | Público |
|---|---|---|
| `wumpus3d-documentacao.pdf` | `documentacao.py` | dev júnior que vai reimplementar |
| `agente-genetico-fundamentacao.pdf` | `fundamentacao.py` | quem quer a base teórica do agente genético |
| `wumpus3d-manual-de-uso.pdf` | `manual.py` | jogadores, professores |

- `documentacao.py` define o CSS compartilhado (os outros dois o leem) e a função `snip()`, que copia trechos **reais** do código pelo texto da primeira linha. Se um trecho sumir ou mudar de forma, ajuste o `start`/`lines`/`end` da chamada.
- Imagens em `scripts/docs/img/`. Para refazer: rode o site (`npm run build && npm run preview -- --port 4173`) e `node scripts/docs/capturas-1.cjs scripts/docs/img` e `capturas-2.cjs`.
- `pdf.cjs` imprime HTML → PDF A4 com Playwright e rodapé numerado.

## Regenerar
```bash
scripts/docs/gerar.sh
```
Requer python3, Node com Playwright e as fontes Inter, JetBrains Mono e Bitstream Charter (sem elas, o layout muda).

## Revisar antes de entregar
1. Gere miniaturas e procure páginas quase vazias, tabelas cortadas e imagens sozinhas: `pdftoppm -r 50 -png docs/<arquivo>.pdf /tmp/prev`.
2. Abra em resolução real ao menos uma página densa (tabela ou código).
3. Confira afirmações numéricas contra o código ou contra `docs/contexto/HISTORICO.md`.

## Regras de conteúdo
- Escreva em português, para o público da tabela acima.
- **Referências** (fundamentação): só inclua obra que você verificou (título, autores, ano, DOI/ISBN). O que não puder verificar vai para o apêndice "não foi possível verificar", nunca para a lista de referências.
- Marque o que é escolha de projeto como escolha de projeto; não atribua à literatura o que não veio dela.
