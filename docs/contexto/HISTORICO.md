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

### 18. Número fixo de poços (pedido: pelo menos 3 no 4×4)
- **Feito:** `pitCountFor(tamanho, p)` = `round(p × tamanho²)` (mín. 1); 3 poços no 4×4 com 20%, 7 no 6×6. Dica no painel com a conta. Ver D15.
- **Pedido no meio do caminho:** agentes **não** devem saber quantos poços há. Foi implementada uma inferência com o total exato (peso C(r, K − k)) e desfeita; agentes continuam com a porcentagem como chance por sala.
- **Medido:** em 40 sorteios pela tela, todos com o número exato; antes, ~4% dos mapas 4×4 vinham sem poço (20 000 sorteios).

### 19. Wumpus nunca num poço; pode ficar na sala do ouro
- **Feito:** Wumpus e ouro sorteados entre salas sem poço, independentes (~1/12 dos 4×4 com os dois juntos). `parseLayout()` recusa Wumpus em poço. Ver D16. Testes novos (29 no total).
- **Retreino:** três treinos com as regras novas (`regras16-a/b/c`) ficaram 8–14 pts abaixo do genoma atual em 2000 mapas → genoma mantido (`bonus25-c`).
- **Medido:** tabela abaixo (5000 mapas 4×4, 1000 6×6). Genético empata com o probabilístico no 4×4 (637 × 635) e fica à frente no 6×6 (255 × 174). Na arena: 200 mapas (`verificacao`) probabilístico 664 × genético 513; 1000 mapas (`verificacao-1000`) 663 × 644; conferido que arena e medição dão números idênticos nos mesmos mapas.

## Sessão 3 — agentes explicados, relatórios e análise (29/10/2026)

### 20. Diferença entre os agentes lógico e probabilístico; correções
- **Pedido:** documentar como cada agente opera, com fundamentação, e corrigir o que fosse necessário.
- **Feito:** cinco correções (D17). Manual: capítulo 11 "Como pensam os agentes lógico e probabilístico" com exemplo real (mapa 2 da semente `exemplo`: lógico escolhe sala com 56% de poço, probabilístico com 20%, porque a brisa ao lado já está explicada por poço certo). Documentação técnica: seção "Lógico × probabilístico" no cap. 8 (AIMA cap. 7 e 12; por que as deduções equivalem à verificação de modelos), tabela das correções.
- **Medido:** lógico 570 / 46 pts, probabilístico 650 / 182 (antes 564 / 20 e 635 / 174), genético igual.

### 21. Relatórios exportáveis e tela de Análise
- **Feito:** `src/report/` (D18). Avaliação com semente e nº de partidas; botões Exportar relatório (HTML), Exportar dados (JSON) e Abrir na análise na Avaliação e na Arena; `npm run arena -- --relatorio`. Tela 📊 Análise de relatórios: importa vários .html/.json, tabela-resumo, barras de resultado, 4 gráficos com dica ao passar o mouse, partida a partida; avisa quando os mapas diferem. Manual: capítulos 9 e 12; documentação técnica: cap. 9.
- **Verificado:** 35 testes (novo `tests/report.test.ts`); Playwright: avaliar 2 agentes, baixar HTML, abrir na análise, importar JSON, dica do gráfico, sem erros no console; HTML exportado em claro/escuro e 390 px sem rolagem lateral.

### 22. Genético v2: características de utilidade, treino com menos ruído, sem laços
- **Pedido:** mudar o genético com base na fundamentação (porque perdia do probabilístico no 4×4).
- **Feito (D19):** genes "Risco" (P(poço) + P(Wumpus)) e "Distância" no lugar de P(poço) e P(Wumpus) separados (11 pesos; pesos salvos antigos são descartados); `BAYES_LIKE_GENOME` novo reproduz o probabilístico; treino em vários tamanhos (`sizes`), validação configurável (`validationMaps`); `npm run treinar` com `--tamanhos`/`--validacao` e `npm run medir` com diferença pareada e IC 95% (`pairedDiff` em `report.ts`).
- **Defeito encontrado pelo dono:** na prévia, pesos treinados na tela fizeram o genético esgotar o tempo em 53% de uma Arena 6×6 (oscilava entre alvos). Corrigido com compromisso com o alvo (só reavalia ao aprender algo novo); `tests/genetic.test.ts`. A Arena mostra "(pesos treinados)".
- **Treino:** 3 sementes (`utilidade-a/b/c`), pop. 20, 20 gerações, 500 mapas/geração (4×4 + 6×6), validação 2000. Seleção em 4000 mapas 4×4 + 800 6×6 (`selecao-v2-*`): A +4 / +85 sobre o probabilístico, B +1 / +76, C +6 / +76 → A.
- **Medido (mapas de medição):** 4×4 638 × 650 (−12; IC −49 a +25); 6×6 242 × 182 (+60; IC −18 a +138). Sem diferença comprovada; tendência a favor no 6×6. Desvio pareado ~640 pts/partida: com 5000 mapas a margem ainda é ±37.

### 23. Registro e análise das partidas humanas
- **Pedido:** registrar as partidas do jogador para comparar com os agentes e com outros jogadores.
- **Feito (D20):** seção "Minhas partidas" (nome do jogador, semente de desafio, resumo, exportar HTML/JSON, abrir na análise, comparar com os agentes nos mesmos mapas, apagar). Árbitro acompanha a partida humana (erros de lógica, riscos). Só contam primeira vez por mapa e sem mapa aberto. Manual: capítulo 13 novo; documentação técnica: cap. 9.
- **Verificado:** 41 testes (novo `tests/human.test.ts`); Playwright: 4 partidas num desafio (uma com mapa aberto → não conta), resumo e índice do desafio corretos, comparação com 3 agentes nos mesmos mapas aberta na Análise, sem erros no console.

### 24. Painel: seções que abrem e fecham
- **Pedido:** renomear "Mapas" para "Salvar mapas" e deixar Partida, Salvar mapas e Minhas partidas expansíveis, começando fechadas.
- **Feito:** `<details class="fold">` nas três seções (seta ▸/▾ à esquerda, título alinhado à direita, foco visível, sem animação com redução de movimento); ordem: Partida, Arena, Minhas partidas, (Agente genético, Avaliação), Salvar mapas e, no fim do painel, Análise de relatórios; exportar mapa abre a seção para mostrar o JSON. Manual (cap. 5 e 7), README e capturas atualizados.
- **Verificado:** Playwright: as três começam fechadas, abrem e fecham, títulos em maiúsculas, sem erros no console; 41 testes.

## Resultados medidos (mesmos mapas para todos, 20% de poços)

| Agente | 4×4 (5000 mapas) | 6×6 (1000 mapas) |
|---|---|---|
| Aleatório | ~4% vitórias, −767 pts | ~2%, −854 pts |
| Lógico | 63%, 570 pts | 43%, 46 pts |
| Probabilístico | 67%, 650 pts | 48%, 182 pts |
| Genético (`BAYES_LIKE_GENOME` v2, ponto de partida) | 66%, 642 pts | 49%, 188 pts |
| Genético (`DEFAULT_GENOME` v2, semente `utilidade-a`) | 66%, 638 pts | 51%, 242 pts |

Regras atuais (D14, D15, D16), agentes com as correções de D17 e genético v2 (D19); 5000 mapas 4×4 e 1000 6×6 das sementes `medicao-4x4` e `medicao-6x6` (`arenaMaps`). Sem teste estatístico formal. Lotes de 200 a 1000 mapas variam muito: use pelo menos 5000 mapas 4×4 para comparar agentes próximos.

## Pendências e ideias (não feitas)

- Conferir no log do Actions se `ARENA_SEED` está sendo usado.
- Testes automatizados de interface/3D (Playwright) — hoje só regras, deduções e arena têm testes.
- `WorldView.load()` não chama `dispose()` nas geometrias antigas (memória de vídeo cresce em sessões longas).
- P(Wumpus) uniforme entre candidatas; enumeração aproximada com fronteira > 16 salas.
- Agente genético não supera o probabilístico; novas características ou calibração de parâmetros poderiam mudar isso.
- Bundle ~600 KB (`import * as THREE`).
- Acessibilidade do 3D (sem descrição textual para leitores de tela).
