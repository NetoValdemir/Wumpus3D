# Como criar um agente para a Arena Wumpus 3D

Um agente é **um único arquivo `.js`**, sem dependências, que chama `registerAgent(...)`. O mesmo arquivo roda no navegador (tela **Arena** e "Quem joga") e na linha de comando (`npm run arena`).

O ponto de partida é [`agents/exemplo-cauteloso.js`](agents/exemplo-cauteloso.js).

## Estrutura

```js
registerAgent({
  name: 'Meu Agente',          // aparece no ranking
  author: 'Seu Nome',
  description: 'Uma frase sobre a estratégia.',

  // Chamado no início de cada partida. Guarde aqui a memória do agente.
  create(info) {
    // info = { size, pitProbability, maxActions }
    return {
      // Chamado a cada passo. Precisa responder rápido (padrão: 1000 ms).
      decide(s) {
        // s = { x, y, dir, hasArrow, hasGold, step,
        //       percepts: { stench, breeze, glitter, bump, scream } }
        return 'forward';
      },
    };
  },
});
```

### O que o agente recebe

| Campo | Significado |
|---|---|
| `x`, `y` | Posição atual. **Começa em 0**: a entrada é `(0, 0)`, `x` cresce para leste e `y` para norte. (Na tela os números aparecem somando 1.) |
| `dir` | Para onde está virado: `0` leste, `1` norte, `2` oeste, `3` sul |
| `hasArrow`, `hasGold` | Se ainda tem a flecha e se já pegou o ouro |
| `step` | Quantas ações já fez nesta partida |
| `percepts.stench` | Fedor: o Wumpus está numa sala vizinha |
| `percepts.breeze` | Brisa: há poço numa sala vizinha |
| `percepts.glitter` | Brilho: o ouro está nesta sala |
| `percepts.bump` | Bateu na parede na última ação |
| `percepts.scream` | O Wumpus acabou de morrer com a flecha |

O agente **nunca** recebe o mapa: só o que sentiu. A posição e a direção são dadas para simplificar (um agente poderia calcular sozinho).

### O que o agente devolve

Uma ação: `'forward'`, `'left'`, `'right'`, `'shoot'` ou `'grab'`.

Ou, para mostrar o raciocínio na tela, um objeto:

```js
return {
  action: 'forward',
  thought: 'A sala (2, 1) é segura, indo explorar.',   // aparece no 3D
  beliefs: [{ x: 1, y: 0, pit: 0.2, wumpus: 0 }],     // pinta o piso com "Mostrar raciocínio"
};
```

`beliefs` é opcional: uma lista de salas com a probabilidade (0 a 1) de poço e de Wumpus que o agente acredita.

## Regras

- **Vitória:** pegar o ouro (`grab`) e voltar à entrada `(0, 0)`. Não existe "sair": voltar sem o ouro não encerra a partida.
- **Pontuação:** −1 por ação, −10 pelo tiro, +1000 ao pegar o ouro, +500 ao voltar com ele, −1000 se morrer.
- **Limite:** `maxActions` ações (`size × size × 20`). Ao passar disso a partida termina como "tempo esgotado".
- **Erros:** se `decide` lançar uma exceção, devolver uma ação inválida ou demorar além do limite, a partida conta como erro (−1000 e o que tinha de negativo).
- `decide` precisa ser **síncrono** (não devolva Promise). Use só JavaScript puro: não há `require`, `import`, rede nem acesso à página.

## Testando

**No navegador:** abra **⚙ Configurar → 🏆 Arena**, clique em **Importar agente (.js)** (ou cole o código). O agente aparece em "Quem joga" para assistir no 3D e pode disputar a competição contra os agentes de referência.

**Na linha de comando:**

```bash
npm run arena -- agents/meu-agente.js --maps 200 --seed treino
```

Opções: `--maps`, `--size`, `--pits`, `--seed`, `--timeout` (ms por decisão), `--sem-embutidos` (tira os agentes de referência), `--json` e `--md` (salvam o ranking).

## Como o ranking é calculado

Todos os agentes jogam **os mesmos mapas**, gerados pela semente. A ordem é pela **pontuação média**; empates são decididos por vitórias e depois por menos erros de lógica.

Além dos pontos, a arena mede:

| Métrica | O que mostra |
|---|---|
| Vitórias, mortes (poço/Wumpus), tempo esgotado, erros | Resultado das partidas |
| Ações/vitória | Eficiência do caminho |
| ms/decisão | Custo de processamento |
| **Erros de lógica** (por partida) | Passos para uma sala que, com as percepções até ali, já dava para **provar** ser poço ou Wumpus |
| **Riscos desnecessários** (por partida) | Passos para uma sala incerta quando ainda existia sala comprovadamente segura para explorar |
| Tiros certeiros | Flechas que acertaram o Wumpus |

Os erros de lógica e os riscos desnecessários são calculados por um árbitro que recebe exatamente as mesmas percepções do agente (sem ver o mapa). Eles medem a qualidade do raciocínio, não a sorte.

## Competição oficial

1. Faça um fork do repositório e crie `agents/<seu-nome>.js`.
2. Abra um pull request. O GitHub Actions roda a arena com 200 mapas novos e mostra o ranking no resumo da execução.
3. Depois que o mantenedor revisar o código e aceitar o PR, o site é publicado com o **ranking oficial**: 500 mapas gerados por uma semente secreta (segredo `ARENA_SEED` do repositório), para ninguém treinar o agente nos mapas da prova.

**Para mantenedores:** o agente roda num contexto isolado (`vm` no Node, Web Worker no navegador) e só troca texto JSON com a arena, mas o `vm` do Node não é uma barreira de segurança completa. Revise o código de cada agente antes de aceitar o PR.
