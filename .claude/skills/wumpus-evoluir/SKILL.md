---
name: wumpus-evoluir
description: Roteiro para qualquer mudança no Wumpus 3D (nova funcionalidade, correção, novo agente, ajuste de regra, interface ou Arena) — planejar respeitando as invariantes, implementar, verificar com testes e arena, atualizar documentação e memória do projeto, e publicar. Use sempre que for alterar código ou comportamento do projeto.
---

# Evoluir o Wumpus 3D com segurança

## 1. Entender antes de mexer
1. Releia as **invariantes** do `CLAUDE.md`. Se a mudança quebra alguma, isso é uma decisão: explique o impacto ao usuário antes de implementar.
2. Procure em `docs/contexto/DECISOES.md` se o assunto já foi decidido (e por quê).
3. Leia só os arquivos envolvidos (mapa do código no `CLAUDE.md`). Para investigação ampla, use o subagente `wumpus-especialista`.

## 2. Implementar
- Siga o estilo existente: português, comentários curtos explicando o porquê, sem `enum` nem parameter properties (`erasableSyntaxOnly`).
- Regras de jogo só em `src/game/world.ts`. 3D só em `src/render/view.ts`. Agentes nunca recebem `WumpusWorld`.
- Mudou a regra ou a pontuação? Isso altera a aptidão do agente genético e os números medidos: avise e, se o usuário quiser, retreine (`src/agents/genetic.ts`) e meça de novo.

## 3. Verificar (obrigatório antes de dizer que terminou)
1. `npm run check` — tipos + testes. Tudo precisa passar.
2. Escreva ou ajuste um teste em `tests/` para o comportamento novo ou corrigido.
3. Mudou agentes, conhecimento ou arena? `npm run arena -- --maps 200 --seed verificacao` e compare com a tabela do `HISTORICO.md`.
4. Mudou interface ou 3D? `npm run build && npm run preview -- --port 4173` e verifique no navegador (Playwright está disponível nas sessões em nuvem: `require('playwright')`, `chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })`). Confira console sem erros, tela de computador (1280×800) e de celular (390×844).
5. Relate o que foi verificado e o que não foi. Não arredonde resultados nem omita falhas.

## 4. Documentar
- `README.md`: se mudou uso, comandos ou funcionalidades.
- `AGENTES.md`: se mudou o contrato dos agentes externos.
- `scripts/docs/manual.py` (manual), `documentacao.py` (técnica), `fundamentacao.py` (agente genético): ajuste os textos afetados e rode a skill `wumpus-docs`.
- `docs/contexto/HISTORICO.md`: uma entrada curta (pedido, feito, medido, pendências).
- `docs/contexto/DECISOES.md`: nova entrada se houve escolha de projeto.

## 5. Publicar
1. Commit pequeno, mensagem em português explicando o porquê.
2. `git push origin main` → o GitHub Actions roda `npm run check`, o ranking oficial e publica em https://netovaldemir.github.io/Wumpus3D/.
3. Acompanhe com `gh run list -R NetoValdemir/Wumpus3D --limit 3` e `gh run view <id> -R NetoValdemir/Wumpus3D --json jobs --jq '.jobs[].steps[] | .name + ": " + .conclusion'`.
4. Em sessões na nuvem, o site `github.io` pode estar bloqueado: diga ao usuário que a conferência final no navegador é dele.
