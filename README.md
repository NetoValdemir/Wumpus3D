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

**Vitória:** só acontece quando você pega o ouro **e** volta para a sala (1,1). Voltar à entrada sem o ouro não encerra a partida: o jogo continua. Todo mapa sorteado tem caminho sem poços até o ouro (às vezes é preciso matar o Wumpus).

**Fim de jogo:** vitória, morte (poço ou Wumpus) ou tempo esgotado, que acontece depois de `tamanho × tamanho × 20` ações (320 num 4×4) para nenhuma partida durar para sempre.

**Pontuação:** −1 por ação, −10 pelo tiro, +1000 ao pegar o ouro, +500 ao voltar com ele (vitória), −1000 se morrer.

## Agentes inteligentes

No painel **Configurar partida** você escolhe o tamanho do mapa (4×4 a 10×10), a chance de poço e quem joga. **Trocar de jogador mantém o mesmo mapa**, então dá para comparar agentes no mesmo cenário. **Novo** (ou R) sorteia outro mapa.

| Jogador | Como pensa |
|---|---|
| Você (teclado) | Você joga. |
| Agente aleatório | Age ao acaso. Serve de base de comparação. |
| Agente lógico | Deduz quais salas são seguras e vai nelas primeiro. Mata o Wumpus quando descobre onde ele está. Sem sala comprovadamente segura, chuta a com menos indícios de perigo (brisa/fedor ao redor). |
| Agente probabilístico | Faz as mesmas deduções e, quando não há sala segura, calcula P(poço) por inferência bayesiana (enumeração da fronteira, como no cap. 12 do AIMA) e P(Wumpus), e vai na de menor risco. |
| Agente genético | Dá uma nota a cada sala candidata somando características com pesos (risco, distância, salas novas ao redor...). Os pesos foram evoluídos por um algoritmo genético. |

Com **Mostrar raciocínio** ligado, cada sala da fronteira mostra no piso o que o agente acredita (verde = segura, amarelo/vermelho = risco). **Avaliar em 100 partidas** joga 100 vezes sem 3D (em mapas sorteados ou só no mapa atual) e mostra vitórias, mortes e a pontuação média.

### Agente genético

O genoma é uma lista de 12 pesos, entre −5 e 5:

- 9 pesos dão a nota de cada sala candidata: probabilidade de poço, probabilidade de Wumpus, se é segura, distância, vizinhas desconhecidas, distância da entrada, giros necessários, brisas ao lado e fedores ao lado. O agente vai para a sala de maior nota.
- 3 pesos dão a nota da opção "atirar no Wumpus": viés, certeza sobre o alvo e se ainda há sala segura. Se ela superar a melhor sala, o agente atira.

O algoritmo genético (`src/agents/genetic.ts`) funciona assim:

1. Cria uma população de genomas aleatórios (mais o genoma atual, para continuar de onde parou).
2. Cada genoma joga os mesmos mapas sorteados da geração. A **aptidão** é a pontuação média.
3. Os 2 melhores passam direto (elitismo). O resto nasce de pais escolhidos por torneio (3 sorteados, vence o melhor), com cruzamento aritmético e mutação gaussiana (20% de chance por peso).

Na seção **Agente genético** do painel você vê os pesos em uso e pode treinar de novo, com gráfico da aptidão por geração (melhor em amarelo, média em cinza). O treino roda em segundo plano (Web Worker), então a tela não trava. Marcando **Treinar só no mapa atual**, o agente se especializa naquele cenário. Os pesos treinados ficam salvos no navegador. **Usar pesos padrão** volta ao genoma que vem com o jogo.

### Desempenho medido

Mesmos mapas para todos os agentes, 20% de poços (1000 mapas no 4×4, 300 no 6×6):

| Agente | 4×4 | 6×6 |
|---|---|---|
| Aleatório | ~6% de vitórias, −660 pts | ~2%, −855 pts |
| Lógico | 70%, 725 pts | 47%, 144 pts |
| Probabilístico | 72%, 787 pts | 53%, 299 pts |
| Genético (genoma padrão) | 71%, 754 pts | 54%, 324 pts |

O agente genético chega sozinho a um desempenho equivalente ao da inferência bayesiana escrita à mão (as diferenças estão dentro da margem de ruído). Como não dá para desistir, todos precisam arriscar quando ficam sem sala segura, e parte das partidas termina em morte.

Para criar o seu agente, implemente a interface `Agent` em `src/agents/agents.ts` (o método `decide(sentidos)` devolve uma ação) e registre em `AGENTS`/`createAgent`.

## Arena: competição de agentes

Outros devs podem criar seus próprios agentes (um arquivo `.js`), importá-los e competir num ranking. O guia completo está em [AGENTES.md](AGENTES.md).

- **No navegador:** em **⚙ Configurar → 🏆 Arena** você importa agentes, assiste cada um jogando no 3D e roda uma competição. Todos jogam os mesmos mapas (gerados por uma semente), e o resultado é um ranking com pontos, vitórias, eficiência, tempo de decisão e métricas de raciocínio (erros de lógica e riscos desnecessários).
- **Na linha de comando:** `npm run arena` roda todos os agentes da pasta `agents/` e imprime o ranking em Markdown.
- **Competição oficial:** cada dev envia o agente por pull request. O GitHub Actions avalia o PR e, depois do merge, publica no site o ranking oficial, com 500 mapas de semente secreta.

Os agentes importados rodam isolados (Web Worker no navegador, `vm` no Node) e recebem só as percepções de cada passo, nunca o mapa.

## Mapas: salvar, exportar e importar

Na seção **Mapas** do painel:

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

Também dá para criar mapas à mão nesse formato. O jogo recusa, com a explicação do problema, coordenadas fora do mapa, qualquer coisa na entrada (1,1) e ouro dentro de poço.

## Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # gera a versão final em dist/
npm run preview    # testa a versão final
```

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
