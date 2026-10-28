# Wumpus 3D

O clássico **Mundo de Wumpus** em 3D, rodando no navegador. Feito com TypeScript + Three.js + Vite.

## Como jogar

Você entra na caverna pela sala (1,1), marcada com um anel azul. Seu objetivo é achar o ouro e sair pela mesma entrada.

| Tecla | Ação |
|---|---|
| W / ↑ | Andar para frente |
| A / ← e D / → | Girar para a esquerda / direita |
| Espaço | Atirar a flecha (você só tem uma) |
| G | Pegar o ouro |
| C | Sair da caverna (só na sala 1,1) |
| V | Alternar câmera (seguir / visão geral) |
| M | Revelar o mapa (modo de depuração) |
| R | Novo jogo |

**Percepções:** *Fedor* = Wumpus em sala vizinha · *Brisa* = poço em sala vizinha · *Brilho* = ouro nesta sala · *Batida* = bateu na parede · *Grito* = o Wumpus morreu.

**Vitória:** pegar o ouro, voltar para a sala (1,1) e sair da caverna. Todo mapa sorteado tem caminho seguro até o ouro (às vezes é preciso matar o Wumpus).

**Pontuação:** −1 por ação, −10 pelo tiro, +1000 ao pegar o ouro, +500 ao sair com ele (vitória), −1000 se morrer.

## Agentes inteligentes

No painel **Configurar partida** você escolhe o tamanho do mapa (4×4 a 10×10), a chance de poço e quem joga:

| Jogador | Como pensa |
|---|---|
| Você (teclado) | Você joga. |
| Agente aleatório | Age ao acaso. Serve de base de comparação. |
| Agente lógico | Deduz quais salas são seguras e só pisa nelas. Mata o Wumpus quando descobre onde ele está. Sem saída segura, volta e sai. Nunca morre. |
| Agente probabilístico | Faz as mesmas deduções e, quando não há sala segura, calcula P(poço) por inferência bayesiana (enumeração da fronteira, como no cap. 12 do AIMA) e P(Wumpus). Arrisca a sala de menor risco se ela estiver abaixo da **tolerância a risco**. |

Com **Mostrar raciocínio** ligado, cada sala da fronteira mostra no piso o que o agente acredita (verde = segura, amarelo/vermelho = risco). **Avaliar em 100 partidas** joga 100 mapas sem 3D e mostra vitórias, mortes e a pontuação média.

Desempenho medido (300 partidas, 20% de poços):

| Mapa | Aleatório | Lógico | Probabilístico (tolerância 30%) |
|---|---|---|---|
| 4×4 | 7% de vitórias | 48% (0% de mortes) | ~55% |
| 8×8 | 0% | 21% (0% de mortes) | ~30% |

Para criar o seu agente, implemente a interface `Agent` em `src/agents/agents.ts` (o método `decide(sentidos)` devolve uma ação) e registre em `AGENTS`/`createAgent`.

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
│   ├── agents.ts    # agentes aleatório, lógico e probabilístico
│   └── benchmark.ts # roda várias partidas para medir um agente
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
