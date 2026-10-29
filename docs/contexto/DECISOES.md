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
- **Custo:** muda levemente as probabilidades reais em relação ao que os agentes supõem (poços independentes). Com o número fixo de poços (D15), a diferença aumenta um pouco.
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

## D14 — Bônus de +25 por matar o Wumpus
- **Por quê:** pedido do dono: matar o Wumpus não rendia nada (no AIMA também não). O bônus precisa recompensar sem tirar o foco do ouro. Três condições: (1) dar lucro sobre o tiro (> 11 = −10 do tiro −1 da ação); (2) tiro às cegas da entrada continuar com valor esperado negativo — o limite é o menor mapa, 3×3, onde a linha cobre 2 de 8 salas possíveis (25%): exige bônus < 44 (4×4: < 55); (3) desvio para caçar não compensar: lucro líquido +14 equivale a ~14 ações ou ~1,4% de risco de morte.
- **Descartado:** +50 a +100 (chute às cegas passa a dar lucro no 3×3/4×4 e o genético aprenderia a atirar no primeiro turno); < 15 (lucro quase invisível).
- **Custo:** quebra a invariante 5 de forma consciente: aptidão do genético e números de ranking anteriores deixam de ser comparáveis. Medido: as decisões dos agentes de referência não mudaram (mesmas vitórias), só +5 a +6 pts de média.
- **Onde:** `SCORE.wumpusKill` e o `case 'shoot'` de `step()` em `src/game/world.ts`.

## D15 — Número fixo de poços; agentes não sabem quantos são
- **Por quê:** pedido do dono. Com chance independente por sala, ~4% dos mapas 4×4 saíam sem poço. Agora a porcentagem vale sobre o total de casas: `pitCountFor(tamanho, p)` = `round(p × tamanho²)`, no mínimo 1 e no máximo tamanho² − 3. Com 20%: 2 poços no 3×3, 3 no 4×4, 7 no 6×6.
- **Agentes não recebem o número** (pedido do dono): `AgentInfo` continua com `pitProbability`, e a base de conhecimento continua supondo poços independentes com essa chance. Foi implementada e descartada uma inferência que usava o total exato (peso C(r, K − k) por combinação da fronteira).
- **Limite:** um agente externo pode calcular o número a partir de `pitProbability` e do tamanho, porque a regra é pública.
- **Custo:** os mapas ficaram mais difíceis (sem mapas vazios); números medidos antes não valem mais.
- **Onde:** `pitCountFor()` e o construtor de `WumpusWorld` em `world.ts`; dica no painel em `updatePitHint()` (`main.ts`).

## D16 — Wumpus nunca num poço; pode dividir a sala com o ouro
- **Por quê:** pedido do dono. Antes o Wumpus era sorteado entre todas as salas (podia cair num poço) e o ouro nunca ficava com ele. Agora os dois são sorteados entre as salas sem poço, de forma independente: em ~1/12 dos mapas 4×4 o ouro está na sala do Wumpus e é obrigatório matá-lo.
- **Importação:** `parseLayout()` recusa Wumpus dentro de poço, como já recusava ouro.
- **Não mudou:** a base de conhecimento continua não usando essa regra (P(Wumpus) uniforme entre candidatas, sem descartar poços certos).
- **Onde:** construtor de `WumpusWorld` e `parseLayout()` em `world.ts`.

## D17 — Correções nos agentes lógico e probabilístico
- **Por quê:** revisão pedida pelo dono ao documentar a diferença entre os dois agentes.
- **O que mudou:** (1) Wumpus nunca é candidato em poço deduzido (regra D16, vale para os dois); (2) P(Wumpus) entre candidatas ∝ 1 − P(poço), em vez de uniforme; (3) risco = P(poço) + P(Wumpus) (`riskOf`), porque os eventos se excluem; antes 1 − (1−P)(1−W) supunha independência; (4) empate no passo 5 decidido pela sala mais próxima, como o agente híbrido do AIMA, cap. 7; (5) comentário errado sobre o tiro corrigido.
- **Medido (5000 mapas 4×4 / 1000 6×6, `npm run medir`):** lógico 564 → 570 / 20 → 46; probabilístico 635 → 650 / 174 → 182; genético igual (637 / 255).
- **Descartado:** dar ao lógico alguma forma de probabilidade. A regra prática de contar indícios fica, documentada como regra prática e não como dedução: é o que separa os dois agentes.
- **Onde:** `riskOf`, `wumpusCandidates()`, `beliefs()` em `knowledge.ts`; `explore()` e `planShot()` em `agents.ts`; `view.ts` usa `riskOf` nos discos.

## D18 — Relatórios em HTML com os dados dentro; tela de Análise só de leitura
- **Por quê:** pedido do dono: exportar gráficos de pontuação, vitórias, mortes e ações por partida para comparar agentes, e importar relatórios para análise.
- **Formato:** `wumpus3d-relatorio` v1 (JSON) com uma linha por partida (`GameRow`). O HTML exportado é independente (sem internet), com SVG gerado em `charts.ts`, e leva o JSON em `<script type="application/json" id="wumpus3d-relatorio">`; um arquivo serve para ler e para importar. A Análise também aceita o JSON e a exportação antiga da Arena (`{ meta, ranking }`, só totais).
- **Comparabilidade:** a Avaliação ganhou semente e número de partidas (antes a semente era aleatória). Mesma semente + mesma quantidade = mesmos mapas.
- **Cores:** paleta categórica validada (CVD) em claro e escuro; até 6 agentes nos gráficos, a tabela mostra todos. Resultados usam cores de estado (vitória verde, poço/Wumpus vermelhos, tempo amarelo, erro laranja), sempre com legenda.
- **Descartado:** guardar relatórios no `localStorage` (podem ser grandes; o arquivo exportado já é o armazenamento); biblioteca de gráficos (SVG à mão é pequeno e funciona no Node).
- **Onde:** `src/report/` (report, charts, html, ui); botões na Avaliação (`main.ts`) e na Arena (`arena/ui.ts`); `--relatorio` em `scripts/arena.ts`.
