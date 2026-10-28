# Histórico do projeto

Resumo de tudo o que foi pedido e feito, em ordem. Serve para retomar o projeto sem reler as conversas.
Cada entrada: o pedido, o que foi feito, o que foi medido e o que ficou de fora.
Acrescente novas entradas no fim.

## Sessão 1 — criação do jogo (28/10/2026)

### 1. Escolha da tecnologia
- **Pedido:** jogo estilo Mundo de Wumpus, 3D, na web, leve.
- **Feito:** recomendado TypeScript + Three.js + Vite (alternativas analisadas: Babylon.js, React Three Fiber, Godot, Unity, Rust/WASM). Ver D1.

### 2. Protótipo, passo a passo e hospedagem gratuita
- **Feito:** protótipo jogável 4×4 (andar, girar, atirar, pegar, percepções, flecha animada, câmera que segue), passo a passo de implementação, workflow do GitHub Pages; comparadas hospedagens gratuitas (GitHub Pages, Netlify, Vercel, Cloudflare Pages, itch.io).

### 3. "Falta a condição de vitória e a pontuação do ouro"
- **Encontrado:** ~26% dos mapas 4×4 eram impossíveis (ouro em poço ~20%, junto do Wumpus ~7%, ou cercado). Pegar o ouro não dava pontos.
- **Feito:** geração só aceita mapas vencíveis (BFS sem poços até o ouro; 0 de 10.000 impossíveis), +1000 ao pegar o ouro, campo "Objetivo" no HUD. Ver D3.

### 4. Agentes inteligentes e tamanho do mapa
- **Feito:** mapas 4×4 a 10×10, chance de poço configurável, agentes aleatório, lógico e probabilístico (inferência bayesiana por enumeração da fronteira), "Mostrar raciocínio" (discos de risco no piso), "Avaliar em 100 partidas". Ver D4, D5.

### 5. Três alterações: vitória, mapas salvos, agente genético
- **Vitória só ao voltar a (1,1) com o ouro**, automática; voltar sem ouro não encerra; removida a ação `climb` e a "tolerância a risco"; agentes passaram a arriscar em vez de desistir; criado limite de ações `tamanho² × 20`. Ver D6.
- **Mapas:** salvar no navegador, repetir com outro agente (trocar de jogador mantém o mapa), exportar/importar JSON (formato `wumpus3d-map`, coordenadas 1-based) com validação. Ver D7.
- **Agente genético:** 12 pesos (9 por sala candidata + 3 da opção de tiro), AG com torneio 3, elitismo 2, cruzamento aritmético, mutação gaussiana (20%, σ 0,8), validação final dos 5 melhores em mapas novos; treino na tela em Web Worker. Ver D8, D9.
- **Medido:** a primeira evolução ficou pior que o genoma escrito à mão (725 × 760 pts) por ruído; com validação e semente "imita o bayesiano" o genoma evoluído empatou com o probabilístico (tabela abaixo).

### 6. Parar e reiniciar no mesmo mapa; painel sem cobrir o mapa
- **Feito:** botão ⏹ Parar (tecla T) e Reiniciar; painel virou coluna lateral (faixa inferior no celular) e o canvas redimensiona com `ResizeObserver`; no celular os botões viraram barra abaixo do mapa. Ver D10.

### 7. Arena: agentes de outros devs, competição e ranking
- **Feito:** contrato `registerAgent({ name, author, create(info) { return { decide(s) } } })`; sandbox em Web Worker (navegador) e `vm` (Node), só JSON entra/sai; árbitro mede erros de lógica e riscos desnecessários; ranking por pontos médios; semente reproduzível; `npm run arena`; workflow de PR (200 mapas, semente nova) e ranking oficial no deploy (500 mapas, semente secreta `ARENA_SEED`). `AGENTES.md` e `agents/exemplo-cauteloso.js`. Ver D11, D12.
- **Testado:** agentes com laço infinito, erro de sintaxe, ação inválida, exceção e tentativa de acessar `process` — todos viram erro claro sem travar. Navegador e CLI dão números idênticos com a mesma semente.

### 8–10. Documentação em PDF (em `docs/`)
- `wumpus3d-documentacao.pdf` — documentação técnica para dev júnior reimplementar (arquitetura, cada arquivo, algoritmos, roteiro, limitações).
- `agente-genetico-fundamentacao.pdf` — fundamentação teórica do agente genético. **Não houve artigo-base único**: técnicas padrão combinadas; cada variável marcada como literatura / adaptação / escolha de projeto; 13 referências verificadas na web; itens não verificados listados no apêndice A (subseções do AIMA 4ª ed., elitismo atribuído a De Jong, edição do Law, texto literal de Michalewicz, páginas de Miller & Goldberg).
- `wumpus3d-manual-de-uso.pdf` — manual do jogador: regras, controles, cada configuração e casos especiais.
- Geradores em `scripts/docs/` (`gerar.sh`).

### 11–12. Arquivos para download e HTML único
- Entregue `.zip` do projeto e `wumpus3d-jogavel.html` (jogo em um arquivo, ~640 KB, sem internet: testado offline, nenhum acesso à rede). No celular abrir HTML local é ruim → usar o site.

### 13. GitHub e GitHub Pages
- Código enviado para `NetoValdemir/Wumpus3D` (main). Pages ativado pelo dono (Source: GitHub Actions). Site: https://netovaldemir.github.io/Wumpus3D/.
- Segredo `ARENA_SEED` criado pelo dono. **Não verificado** se a execução usou o segredo (logs inacessíveis da sessão): conferir na etapa "Ranking oficial da arena" se aparece `--seed "***"`.

### 14. Memória do projeto para o Claude
- **Feito:** `CLAUDE.md`, este histórico, `DECISOES.md`, skills `wumpus-consultar`, `wumpus-evoluir`, `wumpus-docs`, subagente `wumpus-especialista`, testes Vitest (`npm run check`, também no CI antes de publicar), geradores dos PDFs no repositório.

## Sessão 2 — bônus por matar o Wumpus (28/10/2026)

### 15. "Matar o Wumpus não dá pontos"
- **Pedido:** bônus ao matar o Wumpus sem desviar o agente do ouro.
- **Feito:** `SCORE.wumpusKill = 25` em `world.ts` (tiro certeiro rende +14 líquidos); teste em `tests/world.test.ts`; README, AGENTES.md, textos dos 3 PDFs e PDFs regenerados. Ver D14.
- **Medido (200 mapas 4×4, semente `verificacao`, antes → depois):** genético 753 → 759, probabilístico 716 → 722, lógico 667 → 672, Cauteloso 222 → 222; vitórias e mortes idênticas (nenhum agente mudou de decisão; agentes de referência não leem `SCORE`).
- **Pendente (resolvido no item 17):** atualizar a tabela de resultados e retreinar o genético.

### 16. Bônus na tela de fim de partida
- **Pedido:** o quadro final deve dizer que o Wumpus foi morto e quanto isso rendeu.
- **Feito:** `updateHud()` em `main.ts` acrescenta a linha "Matou o Wumpus com a flecha (+25)." quando `wumpusAlive` é falso, em qualquer resultado (vitória, morte ou tempo esgotado). Manual atualizado.
- **Verificado:** Playwright no build (1280×800), mapa com Wumpus em (3,1): vitória com 1505 pts e a linha nova, console sem erros.

### 17. Retreino do agente genético com o bônus
- **Feito:** `npm run treinar` (`scripts/treinar.ts`, semente fixa, mesmo `train()` da tela). Três treinos (pop. 24, 20 gerações, 120 mapas/geração): `bonus25-a` e `bonus25-c` a partir do `BAYES_LIKE_GENOME`, `bonus25-b` a partir do genoma anterior. Escolhido o C pelo desempenho em mapas de seleção (3000 4×4: antigo 752, A 760, B 733, C 765; 600 6×6: antigo 293, A 332, B 298, C 358), separados dos mapas da medição final. `DEFAULT_GENOME` atualizado.
- **Medido:** tabela abaixo. O bônus não aumentou o uso da flecha (tiro em ~31% das partidas 4×4 antes e depois).
- **Atenção:** na arena de 200 mapas (semente `verificacao`) o genoma novo fez 736 pts contra 759 do anterior (vitórias 70% × 71%). Nos conjuntos maiores (3000 de seleção e 1000 de medição) o novo ficou à frente; com 200 mapas a diferença está dentro do ruído.

## Resultados medidos (mesmos mapas para todos, 20% de poços)

| Agente | 4×4 (1000 mapas) | 6×6 (300 mapas) |
|---|---|---|
| Aleatório | ~6% vitórias, −675 pts | ~2%, −857 pts |
| Lógico | 68%, 676 pts | 54%, 331 pts |
| Probabilístico | 69%, 718 pts | 57%, 395 pts |
| Genético (`BAYES_LIKE_GENOME`, ponto de partida) | 69%, 716 pts | 57%, 405 pts |
| Genético (`DEFAULT_GENOME` anterior, sem o bônus) | 69%, 702 pts | 57%, 387 pts |
| Genético (`DEFAULT_GENOME`, retreinado com o bônus) | 70%, 744 pts | 57%, 406 pts |

Com o bônus de +25 (D14); mapas das sementes `medicao-4x4` e `medicao-6x6` (`arenaMaps`). Sem teste estatístico formal; as diferenças entre probabilístico e genético são pequenas.

## Pendências e ideias (não feitas)

- Conferir no log do Actions se `ARENA_SEED` está sendo usado.
- Testes automatizados de interface/3D (Playwright) — hoje só regras, deduções e arena têm testes.
- `WorldView.load()` não chama `dispose()` nas geometrias antigas (memória de vídeo cresce em sessões longas).
- P(Wumpus) uniforme entre candidatas; enumeração aproximada com fronteira > 16 salas.
- Agente genético não supera o probabilístico; novas características ou calibração de parâmetros poderiam mudar isso.
- Bundle ~600 KB (`import * as THREE`).
- Acessibilidade do 3D (sem descrição textual para leitores de tela).
