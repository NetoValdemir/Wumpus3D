# Scripts de verificação

Ferramentas usadas para provar que uma mudança não quebrou nada além dos testes (`npm run check`).
Foram criadas na refatoração (D21) e no modo escola (D22) e ficam aqui para as próximas mudanças.

| Script | Para quê | Como rodar |
|---|---|---|
| `compara-saidas.sh` | Mesmas sementes → mesmos resultados? Compara arena 4×4/6×6, `medir` e `treinar` da versão atual com um commit de referência (ignora tempos, datas e o agente aleatório). | `scripts/verificacao/compara-saidas.sh main` (≈2 min) ou `… main --rapido` (só a arena) |
| `roteiro-jogo.cjs` + `compara-roteiros.cjs` | Mesmo roteiro de uso do jogo 3D em duas versões (teclado, 4 agentes, avaliação, mapas, desafio, Minhas partidas, Análise, Arena, treino, celular), com `Math.random` semeado; compara 67 pontos de verificação. | Duas builds em portas diferentes (`git worktree add /tmp/antes <commit>` + `npx vite preview --port 4174` lá); `node roteiro-jogo.cjs http://localhost:4174/ antes.json` e `…4173/ depois.json`; `node compara-roteiros.cjs antes.json depois.json` |
| `roteiro-escola.cjs` | Fluxo completo do modo escola (professor → aluno → relatório), celular e erros do console. | `npm run build && npm run preview -- --port 4173`; `node roteiro-escola.cjs http://localhost:4173/ /tmp/capturas` |
| `metricas.cjs` | Tamanho de funções, complexidade ciclomática, aninhamento e duplicações (os números do relatório da refatoração). | Ver o cabeçalho (precisa do TypeScript 5 à parte) |

Cuidados aprendidos:
- O agente aleatório usa `Math.random` sem semente: fica fora de qualquer comparação.
- No navegador, o Three.js também consome `Math.random` (UUIDs de geometrias e materiais): duas versões que criam
  objetos 3D diferentes divergem no sorteio do mapa mesmo com o mesmo comportamento. Isole a causa antes de concluir.
- Playwright já vem instalado nas sessões em nuvem (`require('playwright')`); para o 3D use
  `chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`.
