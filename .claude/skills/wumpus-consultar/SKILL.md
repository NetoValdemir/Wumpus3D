---
name: wumpus-consultar
description: Responder perguntas sobre o projeto Wumpus 3D — como algo funciona, por que foi decidido assim, onde fica no código, o que já foi feito, resultados medidos ou pendências — gastando o mínimo de contexto. Use sempre que a pergunta for sobre o próprio projeto e não pedir mudança no código.
---

# Consultar o projeto Wumpus 3D

Objetivo: responder com precisão lendo só o necessário. Nunca invente: se a resposta não está nos arquivos, diga que não encontrou.

## 1. Escolha a fonte certa (do mais barato para o mais caro)

| Tipo de pergunta | Leia primeiro |
|---|---|
| Visão geral, comandos, mapa do código, regras do jogo | `CLAUDE.md` (já está no contexto) |
| "Por que foi feito assim?", "o que foi descartado?" | `docs/contexto/DECISOES.md` |
| "O que já foi pedido/feito?", números medidos, pendências | `docs/contexto/HISTORICO.md` |
| Como jogar, o que cada configuração faz | textos em `scripts/docs/manual.py` |
| Contrato para agentes externos | `AGENTES.md` |
| Fundamentação teórica do agente genético e referências | textos em `scripts/docs/fundamentacao.py` |
| Comportamento exato de uma regra ou função | o código-fonte (passo 2) |

Não abra os PDFs de `docs/`: são gerados a partir de `scripts/docs/*.py` e do código, e consomem muito contexto.

## 2. Perguntas sobre código

1. Use o mapa do código do `CLAUDE.md` para escolher o arquivo.
2. Procure com `Grep` pelo nome da função, mensagem ou campo e leia só o trecho (`Read` com `offset`/`limit`), não o arquivo inteiro.
3. Se a resposta envolve vários arquivos ou exigiria ler mais de ~3 arquivos inteiros, delegue ao subagente `wumpus-especialista` com uma pergunta objetiva e peça a resposta com citações `arquivo:linha`.

## 3. Quando a pergunta depende de execução

- Comportamento de regra: prefira citar o teste em `tests/*.test.ts` que o cobre; se não houver, rode um script curto ou `npx vitest run -t "<nome>"`.
- Desempenho de agentes: use números de `HISTORICO.md` (mesmos mapas para todos). Para números novos, rode `npm run arena -- --maps 300 --seed <texto>` e diga a semente e o número de mapas.

## 4. Formato da resposta

- Responda primeiro, depois a evidência (`arquivo:linha`, teste, decisão Dn).
- Separe o que está no código do que é interpretação sua.
- Se encontrar contradição entre documentação e código, o código vale; aponte a contradição e sugira corrigir a documentação.
