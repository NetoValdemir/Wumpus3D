# Registro de decisões

Cada decisão: o que foi decidido, por quê, o que foi descartado e onde está no código.
Antes de mudar algo listado aqui, leia o motivo. Ao decidir algo novo, acrescente uma entrada no fim.

## D1 — TypeScript + Three.js + Vite, sem framework de UI
- **Por quê:** site estático leve (~160 KB gzip), roda em qualquer navegador, sem passo de instalação para o jogador. Tipos evitam erros em objetos de formato fixo (percepções, mapas, estatísticas).
- **Descartado:** Unity/Godot (builds de 10–40 MB), Babylon.js (mais pesado que o necessário), React (interface pequena; DOM puro basta).
- **Onde:** `package.json`, `src/main.ts` (atualiza a tela à mão em `updateHud()`).

## D2 — Regras puras separadas do 3D
- **Por quê:** permite milhares de partidas sem desenhar (avaliação, treino, arena) e rodar as regras no Node e em Workers.
- **Onde:** `src/game/world.ts` não importa nada de fora; `src/render/view.ts` só lê o estado.

## D3 — Só mapas sorteados vencíveis
- **Por quê:** ~26% dos mapas 4×4 eram impossíveis com as regras do livro.
- **Custo:** muda levemente as probabilidades reais em relação ao que os agentes supõem (poços independentes).
- **Onde:** construtor de `WumpusWorld` + `reachable()`.

## D4 — Agente lógico e probabilístico na mesma classe
- **Por quê:** compartilham base de conhecimento, rotas e tiro; diferem só quando não há sala segura.
- **Onde:** `ReasoningAgent` em `src/agents/agents.ts` (`mode: 'logic' | 'bayes'`).

## D5 — P(poço) por enumeração exata até 16 salas de fronteira
- **Por quê:** 2^16 = 65.536 combinações ainda é rápido; acima disso cresce demais.
- **Custo:** acima de 16 usa estimativa (1 ÷ vizinhas desconhecidas). P(Wumpus) é uniforme entre candidatas (simplificação).
- **Onde:** `Knowledge.pitProbabilities()`.

## D6 — Vitória automática ao voltar com o ouro; sem `climb`; limite de ações
- **Por quê:** pedido do dono: voltar à entrada sem o ouro não pode encerrar. Sem "desistir", agentes podiam ficar presos para sempre → limite `tamanho² × 20`.
- **Consequências:** agentes arriscam quando não há sala segura (mais mortes); "tolerância a risco" removida; +1000 ao pegar e +500 ao voltar (no AIMA são +1000 ao sair).
- **Onde:** `step()` em `world.ts`, `maxActionsFor()`.

## D7 — Formato de mapa JSON com coordenadas 1-based
- **Por quê:** é o que o jogador vê na tela; arquivos escritos à mão ficam intuitivos.
- **Custo:** conversão 0↔1 em `toLayout()`/construtor. Mapas importados não são checados quanto a ter solução.
- **Onde:** `MapLayout`, `parseLayout()` em `world.ts`.

## D8 — Agente genético evolui pesos de uma estratégia, não sequências de ações
- **Por quê:** sequência fixa só serve para um mapa (decora a resposta); pesos generalizam e o agente continua vendo só percepções.
- **Onde:** `GeneticAgent` (`agents.ts`), `genome.ts`, `genetic.ts`. Fundamentação em `docs/agente-genetico-fundamentacao.pdf`.

## D9 — Validação final do AG em mapas novos; semente "imita o bayesiano"
- **Por quê:** aptidão ruidosa fez o "melhor" da última geração ser só sortudo (725 × 760). Validar os 5 melhores em 3×M mapas novos reduz isso.
- **Parâmetros (escolha de projeto, sem calibração):** torneio 3, elite 2, mutação 20% σ 0,8, pesos ±5.
- **Onde:** `train()` em `genetic.ts`; `BAYES_LIKE_GENOME`, `DEFAULT_GENOME` em `genome.ts`.

## D10 — Painel lateral que divide a tela com o mapa
- **Por quê:** painel flutuante cobria o mapa. Agora `#layout` é flex; no celular (≤ 760 px) vira coluna e os botões saem de cima do mapa.
- **Onde:** `index.html` (`#layout`, `#stage`, `#viewport`, `#setup`), `style.css`, `ResizeObserver` em `view.ts`.

## D11 — Motor do jogo fora do sandbox do agente
- **Por quê:** se o mundo rodasse junto do código do dev, um agente poderia espionar o mapa (ex.: sobrescrever `Set.prototype.has`). Mundo fica na página/processo; agente recebe só JSON.
- **Custo:** uma troca de mensagens por passo; na prática, centenas de partidas ainda rodam em segundos.
- **Limite:** `vm` do Node não é barreira de segurança completa → mantenedor revisa agentes antes do merge.
- **Onde:** `src/arena/sandbox.ts`, `scripts/arena.ts`, `src/arena/protocol.ts`.

## D12 — Ranking oficial com semente secreta
- **Por quê:** motor aberto e determinístico; semente pública permitiria reconhecer os mapas da prova. PRs usam semente nova a cada execução.
- **Onde:** `.github/workflows/deploy.yml` (`ARENA_SEED`, `--ocultar-semente`), `.github/workflows/arena.yml`.

## D13 — Memória do projeto no repositório
- **Por quê:** a conversa original ficou longa demais para caber num contexto. `CLAUDE.md` curto + documentos sob demanda + skills + subagente permitem retomar sem reler tudo.
- **Onde:** `CLAUDE.md`, `docs/contexto/`, `.claude/skills/`, `.claude/agents/`.
