# Wumpus 3D — guia do projeto para o Claude

Jogo do Mundo de Wumpus (AIMA) em 3D no navegador, com agentes inteligentes (lógico, probabilístico, genético),
mapas salvos/exportáveis e uma Arena onde agentes de outros devs competem num ranking.

- Site: https://netovaldemir.github.io/Wumpus3D/ (publicado pelo GitHub Actions a cada push na `main`)
- Repositório: https://github.com/NetoValdemir/Wumpus3D
- Idioma: tudo em **português do Brasil** (interface, comentários, documentação, mensagens de commit).

## Antes de responder ou mudar algo

- **Por que algo é assim?** → `docs/contexto/DECISOES.md`
- **O que já foi pedido e feito, resultados medidos, pendências** → `docs/contexto/HISTORICO.md`
- **Perguntas sobre o projeto** → skill `wumpus-consultar` (ou o subagente `wumpus-especialista` para leituras longas)
- **Qualquer mudança no código** → skill `wumpus-evoluir` (inclui verificação e atualização da documentação)
- **Regenerar os PDFs** → skill `wumpus-docs`
- Não leia os PDFs de `docs/` para tirar informação: eles são gerados a partir de `scripts/docs/*.py` e do código.

## Comandos

```bash
npm install          # dependências
npm run dev          # servidor local (http://localhost:5173)
npm run check        # tipos (tsc) + testes (vitest) — rode antes de todo commit
npm test             # só os testes
npm run build        # build de produção em dist/
npm run arena -- --maps 200 --seed treino   # competição de agentes na linha de comando
npm run treinar -- --seed bonus25-c         # treino do agente genético (reproduz o DEFAULT_GENOME)
npm run medir                               # tabela de desempenho (5000 mapas 4×4, 1000 6×6)
scripts/docs/gerar.sh                       # regenera os 3 PDFs de docs/
```

## Mapa do código

| Arquivo | Responsabilidade |
|---|---|
| `src/game/world.ts` | Regras puras (sem 3D/DOM): `WumpusWorld`, `step()`, pontuação, geração de mapa vencível, `MapLayout`, `parseLayout()` |
| `src/render/view.ts` | Cena 3D (Three.js): lê o estado, nunca muda regras |
| `src/main.ts` | Estado da partida, eventos, laço de animação, painel, mapas, treino genético, avaliação |
| `src/agents/knowledge.ts` | Base de conhecimento: deduções lógicas e P(poço) por enumeração da fronteira |
| `src/agents/agents.ts` | Agentes aleatório, lógico, probabilístico (`ReasoningAgent`) e genético (`GeneticAgent`) |
| `src/agents/genome.ts` · `genetic.ts` · `ga.worker.ts` | Genes, genoma padrão, algoritmo genético, treino em Web Worker |
| `src/arena/*` | Contrato de agentes externos, sandbox (Worker), árbitro, runner, ranking, sementes, tela da Arena |
| `src/storage.ts` | localStorage: mapas, genoma, agentes importados |
| `scripts/arena.ts` | Arena no Node (contexto `vm`) |
| `agents/*.js` | Agentes da competição (`exemplo-cauteloso.js` é o modelo) |
| `tests/*.test.ts` | Testes Vitest (regras, deduções, arena) |
| `scripts/docs/` | Geradores dos PDFs (HTML → PDF com Playwright) |

## Invariantes (não quebre sem decidir conscientemente e registrar em DECISOES.md)

1. `world.ts` não importa nada de 3D, DOM ou agentes. Roda igual no navegador, Node e Worker.
2. Agentes nunca recebem o objeto `WumpusWorld`, só percepções/sentidos. Agentes externos rodam isolados (Worker/vm) e trocam só JSON.
3. Coordenadas: **0-based** no código e na API de agentes; **1-based** na tela e no JSON de mapa (`toLayout`/`fromLayout` convertem).
4. Vitória **só** ao chegar em (1,1) com o ouro (automática). Não existe ação `climb`. Voltar sem ouro não encerra. Limite: `tamanho² × 20` ações.
5. Pontuação: −1 por ação, −10 tiro, +25 matar o Wumpus (D14), +1000 pegar ouro, +500 voltar com ele, −1000 morte. Mudar isso muda a aptidão do agente genético e invalida números medidos.
6. Mapas sorteados sempre têm caminho sem poço até o ouro e exatamente `round(p × tamanho²)` poços (D15), número que os agentes não recebem; Wumpus nunca num poço, mas pode estar na sala do ouro (D16); mapas importados não são checados (documentado no manual).
7. Mesma semente → mesmos mapas (`src/arena/rng.ts`). A semente oficial é o segredo `ARENA_SEED` — nunca a coloque no repositório (é público).
8. TypeScript com `erasableSyntaxOnly`: sem `enum`, sem parameter properties; use uniões de strings e campos declarados.

## Convenções

- Commits pequenos, mensagem em português, explicando o porquê.
- Ao mudar comportamento visível: atualize `README.md`, `AGENTES.md` (se tocar no contrato de agentes), os textos em `scripts/docs/*.py` e regenere os PDFs.
- Ao terminar uma tarefa relevante: acrescente uma linha em `docs/contexto/HISTORICO.md` e, se houve escolha de projeto, uma entrada em `DECISOES.md`.
- Números de desempenho só entram na documentação se forem medidos nos mesmos mapas para todos os agentes.

## Limites conhecidos do ambiente na nuvem (Claude Code na web)

Nas sessões em nuvem usadas até aqui: `github.io` (o site publicado), as APIs de Pages/segredos e os logs do Actions
ficam bloqueados. Dá para fazer push, ver status de execuções (`gh run list`/`gh run view`) e reexecutar (`gh run rerun`),
mas configurações do repositório e conferência do site no ar precisam ser feitas pelo dono no navegador.
