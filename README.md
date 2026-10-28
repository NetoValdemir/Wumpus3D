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

**Pontuação:** −1 por ação, −10 pelo tiro, −1000 se morrer, +1000 se sair com o ouro.

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
