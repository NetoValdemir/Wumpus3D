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

## D19 — Genético v2: risco e distância como características; compromisso com o alvo
- **Por quê:** pedido do dono, com base na fundamentação. (1) O AIMA define o agente racional pela utilidade esperada; na pontuação, entrar numa sala custa ~1000 × P(morte) + passos. Com "Risco" e "Distância" como genes, a regra do probabilístico vira caso particular (`BAYES_LIKE_GENOME` = risco −5, distância −0,01) e o treino parte desse nível. (2) Aptidão ruidosa: desvio pareado ~640 pts/partida → 500 mapas por geração e validação em 2000 (média explícita, Jin e Branke). (3) Treino em 4×4 e 6×6 (generalização, Hastie et al.). (4) Comparação final pareada com IC 95%.
- **Compromisso com o alvo:** o genético mantém a sala escolhida até aprender algo novo (sala nova, grito, tiro errado). Sem isso, pesos dependentes da posição faziam o agente oscilar até o tempo esgotar (visto pelo dono: 53% de tempo esgotado na Arena 6×6 com pesos treinados na tela).
- **Resultado:** empate no 4×4 (−12, IC −49 a +25), tendência a favor no 6×6 (+60, IC −18 a +138). Não comprovado estatisticamente; ganhos menores que ~±37 pts não aparecem com 5000 mapas.
- **Descartado:** rede neural no lugar da soma (Chellapilla e Fogel) — exige muito mais avaliações com o ruído atual; calibrar parâmetros do AG antes — ganho esperado menor; aprender durante a Arena — mistura treino e avaliação.
- **Custo:** 11 pesos em vez de 12; pesos treinados salvos no navegador na versão anterior são descartados.
- **Onde:** `genome.ts`, `GeneticAgent.explore()` (`plan`), `genetic.ts` (`sizes`, `validationMaps`), `scripts/treinar.ts`, `scripts/medir.ts`, `pairedDiff` em `src/report/report.ts`.

## D20 — Registro das partidas humanas e desafios por semente
- **Por quê:** pedido do dono: comparar jogadores com os agentes e com outros jogadores.
- **Como:** com "Você (teclado)", o `Referee` da Arena acompanha a partida; ao terminar, um `HumanGame` (com o mapa inteiro) vai para o `localStorage` (últimas 1000). Relatórios usam o formato de D18 (`origin: 'jogador'`). "Comparar com os agentes" faz os agentes jogarem os mapas do jogador (comparação pareada).
- **Justiça:** contam só a primeira vez em cada mapa (`layoutKey`) e partidas sem o mapa aberto (tecla M); abandonadas não são registradas. Desafio: `challengeMap` usa `arenaMaps("desafio-<semente>")`; o índice só avança depois de terminar (não dá para pular mapas difíceis); progresso por jogador.
- **Descartado:** registrar partidas de agentes vistas no 3D (a Avaliação já faz isso melhor); servidor/ranking online (sem backend; troca de arquivos basta).
- **Onde:** `src/report/human.ts`, `storage.ts` (`loadHumanGames`, `saveHumanGame`, `clearHumanGames`, nome), `main.ts` (`recordHumanGame`, `updateHumanPanel`, desafio em `restart()`), seção `#human-section` em `index.html`.

## D21 — Refatoração pelo Código Limpo, sem mudar comportamento
- **Por quê:** pedido do dono: aplicar os princípios do *Código Limpo* (Robert C. Martin) — funções pequenas com uma responsabilidade, nomes que explicam, sem duplicação (DRY), módulos coesos.
- **Como:** `main.ts` (799 linhas) dividido em `src/ui/*` (estado em `state.ts`, um módulo por seção do painel); `WumpusWorld.step()` virou um método por ação; `randomPlacement()`/`reachable()` saíram do construtor; `explore()` dos agentes quebrado em `gamble`, `planShot`, `bestCell`, `cellFeatures`...; `WorldView.load()`/`frame()`/`sync()` em construtores e animações menores; helpers repetidos reunidos (`src/ui/dom.ts`, `src/util/format.ts`, `parseKey`/`gridNeighbors`/`inGrid` em `world.ts`, `playToEnd`/`playMaps`, `failedEpisode`, `rankingCells`, `scripts/args.ts`); código morto removido (`benchmark()`).
- **Regra:** nenhuma regra, pontuação, sorteio ou decisão de agente mudou. Verificado com sementes fixas (arena 4×4 e 6×6, `medir`, `treinar`: saídas idênticas) e com o mesmo roteiro no navegador nas duas versões (67 pontos de verificação idênticos).
- **Mudanças visíveis intencionais (mínimas):** `WorldView` agora libera geometrias, materiais e texturas ao trocar de mapa, de crenças e ao fim da flecha (antes a memória de vídeo crescia: 393 geometrias após 40 mapas, agora 10); poços compartilham geometria e material; nome do arquivo de mapa exportado agora tira acentos (`ação` → `acao`, antes `a-o`).
- **Descartado:** framework de UI (D1 continua valendo); classes para cada painel (módulos com funções bastaram); mudar o formato do id dos agentes importados (quebraria agentes já salvos).
- **Onde:** `src/ui/*`, `src/util/format.ts`, `scripts/args.ts`, `tests/refatoracao.test.ts`; relatório em `docs/Wumpus3D-Refatoracao.pdf`.

## D22 — Modo escola: página separada, mesmo motor, sem servidor
- **Por quê:** pedido do dono: versão para ensinar pensamento computacional a crianças e jovens de 10 a 18 anos (proposta "Caverna do Pensamento", com base em Lightbot, Blockly Games, Karel, Scratch, CS Unplugged, Bebras; Brennan e Resnick 2012; BNCC Computação).
- **Como:** `escola.html` (segunda entrada do build) com tabuleiro 2D em SVG, sem 3D. Regras, sorteio e pontuação continuam os de `world.ts`; as estrelas são só exibição (invariante 5 intacta). Missões usam mapas fixos em JSON (sem passar pelo sorteio, como mapas importados), com o Wumpus longe da rota nas primeiras (invariante 6 intacta).
- **Blocos:** Blockly 13.4.0 (Apache-2.0), blocos próprios em português. O programa vira uma árvore de comandos (`blockly-json.ts`) executada por um interpretador próprio (`program.ts`), sem `eval`, que só recebe as percepções públicas (invariante 2). Laço sem fim (5000 passos sem ação) e recursão (40 níveis) viram erro no bloco certo. Sons desligados e imagens em `public/blockly-media` para não depender de servidor externo.
- **Detetive:** anotações conferidas com a mesma `Knowledge` dos agentes; estrelas pelo `Referee` (erros de lógica, riscos desnecessários) e pelas anotações erradas.
- **Professor e privacidade:** plano e registros trocados como arquivo ou código (base64 do JSON); o relatório da turma é montado no navegador do professor. Sem conta, sem servidor, só apelido (LGPD art. 14). `world.ts` passou a exportar `reachable()` (usado pelo criador).
- **Descartado:** servidor com turmas e login (custo, dados de menores); usar o gerador JavaScript do Blockly + `eval` (executar texto gerado e passo a passo ficaria mais difícil e menos seguro); 3D no modo escola (pesado em computadores de laboratório; o 3D continua a um clique).
- **Onde:** `escola.html`, `src/edu/*`, `tests/edu-*.test.ts`, `scripts/docs/manual-escola.py`, `capturas-escola.cjs`.

## D23 — Áreas de aluno e professor com login sem servidor; trilha de IA; GitHub opcional do professor
- **Por quê:** pedido do dono (3/11/2026, sugestões A–D do relatório de análise): separar os ambientes do aluno e do professor, com login, guardar dados "só com recursos do GitHub" e implementar a trilha de IA do ensino médio.
- **Páginas (A):** `escola.html` virou a tela inicial com login; `aluno.html` (Início, Detetive, Blocos, Criador, Trilha de IA) e `professor.html` (Turmas, Planejar, Relatório, Criador, GitHub) são entradas próprias do build. A sessão vale para a aba (`sessionStorage`); cada página exige o papel certo e volta à tela inicial se não houver.
- **Login (B):** perfis de professor no aparelho (usuário + senha ≥ 8 caracteres, PBKDF2-SHA256 150 mil iterações); alunos com apelido + PIN de 4 dígitos (PBKDF2 20 mil iterações). A lista de alunos vai **dentro do código da turma** (`TURMA1-`, base64url do JSON com os resumos dos PINs e o plano), que o aluno cola uma vez por aparelho. Dados do professor separados por usuário (`wumpus3d.escola.<o quê>.<usuário>`). Limite assumido e escrito na tela e no manual: a conferência é local e o site é público, então isso separa áreas e identifica alunos, mas não resiste a quem sabe programar; por isso nada sensível fica no site. PIN de 4 dígitos é fraco de propósito (crianças de 10 anos); a proteção real é não haver dado sensível.
- **GitHub (C):** opcional, só para o professor: repositório **privado** dele, token fine-grained com `Contents: Read and write` só nesse repositório; o navegador fala direto com `api.github.com` (CORS). O jogo recusa repositório público (as turmas levam PINs). Token só na aba, a menos que o professor marque "lembrar". Pastas `turmas/`, `planos/`, `registros/<plano>/<aluno>.json`, `relatorios/`. Alunos não usam GitHub (idade mínima 13 e não se distribui token).
- **Trilha de IA (D):** seis lições (`src/edu/trilha/lessons.ts`), uma por grande ideia do AI4K12, com passos de texto, tabuleiro e perguntas conferidas na hora; estrelas por acertos de primeira. Peças: explicação da dedução lida da `Knowledge` (`explain.ts`; `knowledge.ts` ganhou só a leitura `arrowCleared`), tabela de combinações de poços (`combos.ts`, a mesma conta do probabilístico), busca em largura passo a passo (`bfs.ts`), genético de aula (`ga-lite.ts`: 3 genes, 8 agentes, 8 gerações, população inicial com o genoma tipo bayes) e Arena da turma (`class-arena.ts`: último programa de blocos de cada aluno em 20 cavernas da semente da atividade, com os agentes lógico e probabilístico). Atividades `trilha` e `agente` no plano; o relatório mostra as lições, reflexões e a Arena.
- **Genético de aula calibrado para a lição:** com 1 caverna de treino o agente decora (medido: 1470 pts no treino, 585 nas 100 de teste); com 40 cavernas generaliza (544 no treino, 609 no teste; probabilístico 686 nas mesmas). Com 20 cavernas e população aleatória o resultado contradizia a lição; por isso 40 cavernas e o genoma tipo bayes na população inicial. Um teste trava essa narrativa.
- **Não feito (não autorizado):** distribuir token aos alunos para entregarem pelo GitHub (D da análise) e serviços externos (F). Invariantes intactas; `world.ts` sem mudança.
- **Onde:** `escola.html`, `aluno.html`, `professor.html`, `src/edu/{auth,turma,github-store}.ts`, `src/edu/trilha/*`, `src/edu/ui/{access,login,aluno,professor,tabs,teacher-data,turmas-screen,github-screen,trilha-screen}.ts`, `tests/edu-trilha.test.ts`, `tests/edu-acesso.test.ts`.

