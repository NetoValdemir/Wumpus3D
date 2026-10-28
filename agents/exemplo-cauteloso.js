// Agente de exemplo para a Arena Wumpus 3D.
// Copie este arquivo, mude o nome e o autor e escreva a sua estratégia em decide().
// Documentação completa: AGENTES.md
//
// Estratégia: marca como seguras as vizinhas de salas sem brisa e sem fedor, explora a
// sala segura mais próxima, pega o ouro e volta pelo caminho conhecido. Sem sala segura,
// arrisca a vizinha desconhecida com menos indícios de perigo.

registerAgent({
  name: 'Explorador Cauteloso',
  author: 'Equipe Wumpus 3D',
  description: 'Exemplo simples: só pisa onde tem certeza e, sem opção, arrisca o menor perigo.',

  // Chamado no início de cada partida.
  // info = { size, pitProbability, maxActions }
  create(info) {
    const N = info.size;
    const k = (x, y) => x + ',' + y;
    const visited = new Map(); // "x,y" -> { breeze, stench }
    const safe = new Set([k(0, 0)]);
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // leste, norte, oeste, sul

    const neighbors = (x, y) =>
      DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N);

    // Busca em largura pelas salas visitadas/seguras até o primeiro alvo
    function route(fromX, fromY, isGoal) {
      const prev = new Map([[k(fromX, fromY), null]]);
      const queue = [[fromX, fromY]];
      while (queue.length) {
        const [x, y] = queue.shift();
        if (isGoal(x, y) && !(x === fromX && y === fromY)) {
          const path = [[x, y]];
          for (let p = prev.get(k(x, y)); p; p = prev.get(k(p[0], p[1]))) path.unshift(p);
          return path;
        }
        for (const [nx, ny] of neighbors(x, y)) {
          const key = k(nx, ny);
          if (prev.has(key)) continue;
          if (!safe.has(key) && !isGoal(nx, ny)) continue;
          prev.set(key, [x, y]);
          queue.push([nx, ny]);
        }
      }
      return null;
    }

    // Converte o próximo passo do caminho em ação (girar ou andar)
    function stepTo(s, path, thought) {
      const [nx, ny] = path[1];
      const want = DIRS.findIndex(([dx, dy]) => s.x + dx === nx && s.y + dy === ny);
      if (want === s.dir) return { action: 'forward', thought };
      return { action: (want - s.dir + 4) % 4 === 3 ? 'right' : 'left', thought };
    }

    // Indícios de perigo ao redor de uma sala desconhecida
    function danger(x, y) {
      let n = 0;
      for (const [a, b] of neighbors(x, y)) {
        const o = visited.get(k(a, b));
        if (o) n += (o.breeze ? 1 : 0) + (o.stench ? 1 : 0);
      }
      return n;
    }

    return {
      // Chamado a cada passo. Deve devolver uma ação ou { action, thought, beliefs }.
      // s = { x, y, dir, hasArrow, hasGold, step, percepts: { stench, breeze, glitter, bump, scream } }
      decide(s) {
        const p = s.percepts;
        visited.set(k(s.x, s.y), { breeze: p.breeze, stench: p.stench });
        safe.add(k(s.x, s.y));
        if (!p.breeze && !p.stench) for (const [a, b] of neighbors(s.x, s.y)) safe.add(k(a, b));

        // O que acredito sobre as salas desconhecidas (aparece no 3D com "Mostrar raciocínio")
        const beliefs = [];
        for (let x = 0; x < N; x++)
          for (let y = 0; y < N; y++)
            if (!visited.has(k(x, y)) && safe.has(k(x, y))) beliefs.push({ x, y, pit: 0, wumpus: 0 });

        if (p.glitter && !s.hasGold) return { action: 'grab', thought: 'Brilho! Pegando o ouro.', beliefs };

        if (s.hasGold) {
          const home = route(s.x, s.y, (x, y) => x === 0 && y === 0);
          return { ...stepTo(s, home, 'Tenho o ouro. Voltando para a entrada.'), beliefs };
        }

        const toSafe = route(s.x, s.y, (x, y) => safe.has(k(x, y)) && !visited.has(k(x, y)));
        if (toSafe) {
          const [tx, ty] = toSafe[toSafe.length - 1];
          return { ...stepTo(s, toSafe, `(${tx + 1}, ${ty + 1}) é segura. Indo explorar.`), beliefs };
        }

        // (as coordenadas do agente começam em 0; na tela elas aparecem somando 1)
        // Nenhuma sala segura: arrisca a desconhecida com menos indícios de perigo
        let best = null;
        for (const key of visited.keys()) {
          const [x, y] = key.split(',').map(Number);
          for (const [a, b] of neighbors(x, y)) {
            if (visited.has(k(a, b))) continue;
            const d = danger(a, b);
            if (!best || d < best.d) best = { x: a, y: b, d };
          }
        }
        const risky = route(s.x, s.y, (x, y) => x === best.x && y === best.y);
        return { ...stepTo(s, risky, `Sem sala segura. Arriscando (${best.x + 1}, ${best.y + 1}).`), beliefs };
      },
    };
  },
});
