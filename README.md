# Wumpus 3D

O clássico **Mundo de Wumpus** em 3D, rodando no navegador. Feito com TypeScript + Three.js + Vite.

O manual de uso (como jogar e o que cada configuração faz) está em [docs/wumpus3d-manual-de-uso.pdf](docs/wumpus3d-manual-de-uso.pdf).

A documentação técnica completa (arquitetura, decisões e funcionamento de cada arquivo, escrita para quem vai reimplementar o jogo) está em [docs/wumpus3d-documentacao.pdf](docs/wumpus3d-documentacao.pdf).

## Como jogar

Você entra na caverna pela sala (1,1), marcada com um anel azul. Seu objetivo é achar o ouro e voltar com ele até a entrada.

| Tecla | Ação |
|---|---|
| W / ↑ | Andar para frente |
| A / ← e D / → | Girar para a esquerda / direita |
| Espaço | Atirar a flecha (você só tem uma) |
| G | Pegar o ouro |
| V | Alternar câmera (seguir / visão geral) |
| M | Revelar o mapa (modo de depuração) |
| T | Reiniciar a partida no mesmo mapa |
| R | Novo mapa |
| C | Mostrar ou esconder o painel de configuração |

Quando um agente está jogando, **Espaço** joga ou pausa, **N** dá um passo e **⏹ Parar** (ou T) interrompe o agente e volta a partida ao início, mantendo o mesmo mapa.

O painel de configuração fica ao lado do mapa (embaixo dele em telas estreitas) e nunca o cobre. Ao fechá-lo, o mapa ocupa a tela inteira.

**Percepções:** *Fedor* = Wumpus em sala vizinha · *Brisa* = poço em sala vizinha · *Brilho* = ouro nesta sala · *Batida* = bateu na parede · *Grito* = o Wumpus morreu.

**Vitória:** só acontece quando você pega o ouro **e** volta para a sala (1,1). Voltar à entrada sem o ouro não encerra a partida: o jogo continua. Todo mapa sorteado tem caminho sem poços até o ouro (às vezes é preciso matar o Wumpus). O Wumpus nunca fica numa sala com poço, mas pode estar na sala do ouro.

**Fim de jogo:** vitória, morte (poço ou Wumpus) ou tempo esgotado, que acontece depois de `tamanho × tamanho × 20` ações (320 num 4×4) para nenhuma partida durar para sempre.

**Pontuação:** −1 por ação, −10 pelo tiro, +25 se a flecha matar o Wumpus, +1000 ao pegar o ouro, +500 ao voltar com ele (vitória), −1000 se morrer.

## Agentes inteligentes

No painel **Configurar partida** você escolhe o tamanho do mapa (4×4 a 10×10), a porcentagem de poços e quem joga. A porcentagem vale sobre o total de casas: todo mapa sorteado tem exatamente esse número de poços (20% num 4×4 = 3 poços; num 6×6 = 7), e o painel mostra a conta. Os agentes não sabem quantos poços há: só recebem a porcentagem e a usam como chance de poço por sala. **Trocar de jogador mantém o mesmo mapa**, então dá para comparar agentes no mesmo cenário. **Novo** (ou R) sorteia outro mapa.

| Jogador | Como pensa |
|---|---|
| Você (teclado) | Você joga. |
| Agente aleatório | Age ao acaso. Serve de base de comparação. |
| Agente lógico | Deduz quais salas são seguras e vai nelas primeiro (agente baseado em conhecimento, cap. 7 do AIMA). Mata o Wumpus quando descobre onde ele está. Sem sala comprovadamente segura, chuta a com menos indícios de perigo (brisa/fedor ao redor), e a mais próxima no empate. |
| Agente probabilístico | Faz as mesmas deduções e, quando não há sala segura, calcula P(poço) por inferência bayesiana (enumeração da fronteira, cap. 12 do AIMA) e P(Wumpus), e vai na de menor risco P(poço) + P(Wumpus). |

**Lógico × probabilístico:** os dois sabem as mesmas coisas e seguem a mesma ordem de decisões; só se separam quando é preciso arriscar. O lógico conta indícios; o probabilístico percebe, por exemplo, quando uma brisa já está explicada por um poço certo e a sala ao lado fica com só 20% de risco. O capítulo 11 do manual e o capítulo 8 da documentação técnica explicam com um exemplo real.
| Agente genético | Dá uma nota a cada sala candidata somando características com pesos (risco, distância, salas novas ao redor...). Os pesos foram evoluídos por um algoritmo genético. |

Com **Mostrar raciocínio** ligado, cada sala da fronteira mostra no piso o que o agente acredita (verde = segura, amarelo/vermelho = risco). **Avaliação** joga várias partidas sem 3D (100 por padrão, em mapas sorteados por uma semente ou só no mapa atual) e mostra vitórias, mortes e a pontuação média. Mesma semente e mesmo número de partidas = mesmos mapas, para comparar agentes.

### Relatórios e Análise

A Avaliação e a Arena exportam um **relatório**: um arquivo HTML que abre em qualquer navegador (sem internet) com a tabela-resumo, as barras de resultado, os gráficos de pontuação média acumulada, vitórias e mortes acumuladas e ações por partida, e a lista partida a partida. O mesmo arquivo (ou o `.json`) pode ser importado na tela **📊 Análise de relatórios**, que junta vários relatórios para comparar agentes. Na linha de comando: `npm run arena -- --relatorio relatorio.html`.

**Suas partidas:** jogando você mesmo, toda partida terminada fica registrada (seção **Minhas partidas** do painel), com as mesmas medidas dos agentes. Dá para exportar o seu relatório e **comparar com os agentes nos mesmos mapas** que você jogou. Com uma **semente de desafio**, vários jogadores enfrentam os mesmos mapas na mesma ordem e comparam os relatórios na Análise. Só contam a primeira vez em cada mapa e partidas sem o mapa aberto.

### Agente genético

O genoma é uma lista de 11 pesos, entre −5 e 5:

- 8 pesos dão a nota de cada sala candidata: **risco de morte** (P(poço) + P(Wumpus)), **distância**, se é segura, vizinhas desconhecidas, distância da entrada, giros necessários, brisas ao lado e fedores ao lado. Risco e distância são os dois termos da pontuação (a morte custa 1000, cada passo 1), como numa utilidade esperada; com só esses dois, a fórmula já reproduz o agente probabilístico. O agente vai para a sala de maior nota.
- 3 pesos dão a nota da opção "atirar no Wumpus": viés, certeza sobre o alvo e se ainda há sala segura. Se ela superar a melhor sala, o agente atira.

O algoritmo genético (`src/agents/genetic.ts`) funciona assim:

1. Cria uma população de genomas aleatórios (mais o genoma atual, para continuar de onde parou).
2. Cada genoma joga os mesmos mapas sorteados da geração. A **aptidão** é a pontuação média.
3. Os 2 melhores passam direto (elitismo). O resto nasce de pais escolhidos por torneio (3 sorteados, vence o melhor), com cruzamento aritmético e mutação gaussiana (20% de chance por peso).

Na seção **Agente genético** do painel você vê os pesos em uso e pode treinar de novo, com gráfico da aptidão por geração (melhor em amarelo, média em cinza). O treino roda em segundo plano (Web Worker), então a tela não trava. Marcando **Treinar só no mapa atual**, o agente se especializa naquele cenário. Os pesos treinados ficam salvos no navegador. **Usar pesos padrão** volta ao genoma que vem com o jogo.

Na linha de comando, `npm run treinar -- --seed texto` faz o mesmo treino com semente fixa (reproduzível) e compara o resultado com o genoma padrão nos mesmos mapas.

### Desempenho medido

Mesmos mapas para todos os agentes, 20% de poços, ou seja, 3 poços no 4×4 e 7 no 6×6 (5000 mapas no 4×4, 1000 no 6×6; refaça com `npm run medir`):

| Agente | 4×4 | 6×6 |
|---|---|---|
| Aleatório | ~4% de vitórias, −767 pts | ~2%, −854 pts |
| Lógico | 63%, 570 pts | 43%, 46 pts |
| Probabilístico | 67%, 650 pts | 48%, 182 pts |
| Genético (genoma padrão) | 66%, 638 pts | 51%, 242 pts |

O agente genético empata com o probabilístico no 4×4 e tende a ficar à frente no 6×6 (+60 pts por partida, intervalo de 95% de −18 a +138, ou seja, ainda sem comprovação estatística). `npm run medir` mostra essa comparação pareada. Como não dá para desistir, todos precisam arriscar quando ficam sem sala segura, e parte das partidas termina em morte.

Para criar o seu agente, implemente a interface `Agent` em `src/agents/agents.ts` (o método `decide(sentidos)` devolve uma ação) e registre em `AGENTS`/`createAgent`.

## Arena: competição de agentes

Outros devs podem criar seus próprios agentes (um arquivo `.js`), importá-los e competir num ranking. O guia completo está em [AGENTES.md](AGENTES.md).

- **No navegador:** em **⚙ Configurar → 🏆 Arena** você importa agentes, assiste cada um jogando no 3D e roda uma competição. Todos jogam os mesmos mapas (gerados por uma semente), e o resultado é um ranking com pontos, vitórias, eficiência, tempo de decisão e métricas de raciocínio (erros de lógica e riscos desnecessários).
- **Na linha de comando:** `npm run arena` roda todos os agentes da pasta `agents/` e imprime o ranking em Markdown (`--relatorio arquivo.html` também salva o relatório com gráficos).
- **Competição oficial:** cada dev envia o agente por pull request. O GitHub Actions avalia o PR e, depois do merge, publica no site o ranking oficial, com 500 mapas de semente secreta.

Os agentes importados rodam isolados (Web Worker no navegador, `vm` no Node) e recebem só as percepções de cada passo, nunca o mapa.

## Mapas: salvar, exportar e importar

Na seção **Salvar mapas** do painel (as seções Partida, Salvar mapas e Minhas partidas começam fechadas; clique no título para abrir):

- **Salvar** guarda o mapa atual neste navegador, com um nome.
- **Jogar** carrega um mapa salvo, para testá-lo com outro agente quando quiser.
- **Exportar** baixa o mapa como `.json`. **Importar .json** carrega um arquivo exportado (o mapa também é salvo na lista).
- **Copiar ou colar JSON** permite levar o mapa como texto, por exemplo por e-mail ou chat.

Formato do arquivo (coordenadas como na tela, começando em 1: `[coluna, linha]`):

```json
{
  "format": "wumpus3d-map",
  "version": 1,
  "name": "Caverna da prova",
  "size": 4,
  "pitProbability": 0.2,
  "pits": [[3, 1], [3, 3], [4, 4]],
  "wumpus": [1, 3],
  "gold": [2, 3]
}
```

Também dá para criar mapas à mão nesse formato. O jogo recusa, com a explicação do problema, coordenadas fora do mapa, qualquer coisa na entrada (1,1) e ouro ou Wumpus dentro de poço.

## Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # gera a versão final em dist/
npm run preview    # testa a versão final
```

## Testes

```bash
npm run check   # tipos (tsc) + testes (vitest)
npm test        # só os testes
```

Os testes ficam em `tests/` e cobrem as regras do jogo, as deduções da base de conhecimento e a Arena. O GitHub Actions roda `npm run check` antes de publicar o site.

## Trabalhando no projeto com o Claude

O repositório guarda a memória do projeto, para qualquer sessão nova do Claude Code retomar o trabalho sem precisar da conversa original:

| Arquivo | Para quê |
|---|---|
| `CLAUDE.md` | Resumo carregado automaticamente: comandos, mapa do código, invariantes e convenções. |
| `docs/contexto/HISTORICO.md` | Tudo o que foi pedido e feito, resultados medidos e pendências. |
| `docs/contexto/DECISOES.md` | Cada decisão de projeto, com o motivo e o que foi descartado. |
| `.claude/skills/wumpus-consultar` | Como responder perguntas sobre o projeto lendo só o necessário. |
| `.claude/skills/wumpus-evoluir` | Roteiro para mudanças: invariantes, testes, arena, documentação e publicação. |
| `.claude/skills/wumpus-docs` | Como atualizar e regenerar os PDFs. |
| `.claude/agents/wumpus-especialista.md` | Subagente somente-leitura para investigações longas no código. |

**No Claude Code** (terminal, app ou claude.ai/code): abra uma sessão com este repositório e peça o que quiser ("explique como o árbitro mede erros de lógica", "adicione sons ao jogo"). O `CLAUDE.md` é lido sozinho, e as skills são usadas conforme a tarefa. Também dá para chamá-las pelo nome, como `/wumpus-evoluir`.

**No chat do claude.ai** (sem acesso ao código): crie um Projeto e adicione como conhecimento `CLAUDE.md`, `docs/contexto/HISTORICO.md`, `docs/contexto/DECISOES.md` e, se quiser, os PDFs de `docs/`. Assim o chat responde sobre o projeto, mas não consegue alterar nem testar o código.

## Documentação em PDF

Os PDFs de `docs/` são gerados por `scripts/docs/gerar.sh` a partir do código (os trechos de código são copiados dos arquivos reais). Requer python3, Playwright e as fontes Inter, JetBrains Mono e Bitstream Charter.

## Estrutura

```
src/
├── game/world.ts    # regras do jogo (puro TypeScript, sem 3D)
├── agents/
│   ├── knowledge.ts # base de conhecimento: deduções lógicas e probabilidades
│   ├── agents.ts    # agentes aleatório, lógico, probabilístico e genético
│   ├── genome.ts    # genes (pesos) do agente genético e o genoma padrão
│   ├── genetic.ts   # algoritmo genético (seleção, cruzamento, mutação)
│   ├── ga.worker.ts # roda o treino em segundo plano
│   └── benchmark.ts # roda várias partidas para medir um agente
├── arena/
│   ├── protocol.ts  # contrato com os agentes externos (registerAgent, sentidos, decisão)
│   ├── sandbox.ts   # roda agentes externos isolados num Web Worker
│   ├── referee.ts   # árbitro: erros de lógica e riscos desnecessários
│   ├── runner.ts    # executa partidas da arena
│   ├── ranking.ts   # estatísticas e ordenação do ranking
│   ├── rng.ts       # mapas reproduzíveis a partir de uma semente
│   └── ui.ts        # tela da Arena
├── storage.ts       # mapas, genoma e agentes importados salvos no navegador
scripts/arena.ts     # arena na linha de comando (npm run arena)
scripts/treinar.ts   # treino do agente genético na linha de comando (npm run treinar)
scripts/medir.ts     # tabela de desempenho dos agentes (npm run medir)
scripts/docs/        # geradores dos PDFs de docs/
tests/               # testes automatizados (vitest)
agents/              # agentes da competição (um arquivo .js cada)
├── render/view.ts   # cena 3D com Three.js (lê o estado do mundo e desenha)
├── main.ts          # teclado, botões e HUD
└── style.css        # interface sobre o canvas
```

A lógica fica separada da renderização. Assim você pode trocar o visual sem mexer nas regras, ou colocar um agente de IA jogando sozinho chamando `world.step(acao)`.

## Publicando de graça

O `dist/` é um site estático, então qualquer hospedagem estática serve:

- **GitHub Pages** (já configurado): suba o projeto para um repositório no GitHub, vá em *Settings → Pages → Source* e escolha **GitHub Actions**. Cada push na `main` publica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
- **Netlify**: em app.netlify.com, use *Add new site → Import from Git*, com build `npm run build` e pasta `dist`. Também dá para arrastar a pasta `dist` em app.netlify.com/drop.
- **Vercel**: em vercel.com/new, importe o repositório. Ele detecta o Vite sozinho.
- **Cloudflare Pages**: build `npm run build` e pasta de saída `dist`.
- **itch.io**: compacte o conteúdo de `dist/` em um .zip e envie como projeto HTML. É bom para divulgar o jogo.
