# Gera o relatório "Refatoração pelo Código Limpo" (docs/Wumpus3D-Refatoracao.pdf).
# Os números foram medidos na refatoração (D21, HISTORICO nº 25), comparando o commit 8544609 com a branch refatoracao.
import html, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1])
IMG = pathlib.Path(__file__).parent / 'img'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
_hoje = __import__('datetime').date.today()
DATE = f'{_hoje.day} de {MESES[_hoje.month - 1]} de {_hoje.year}'
BASE = '8544609'

css = re.search(r'<style>(.*?)</style>', (pathlib.Path(__file__).parent / 'documentacao.py').read_text(), re.S).group(1)
css = css.replace('{{', '{').replace('}}', '}')


def esc(s):
    return html.escape(s, quote=False)


def highlight(code):
    out = []
    for line in esc(code).split('\n'):
        m = re.search(r'(^|\s)(//.*)$', line)
        if m:
            before = line[: m.start(2)]
            if all(before.count(q) % 2 == 0 for q in ("'", '"', '`')):
                line = before + f'<span class="c">{m.group(2)}</span>'
        out.append(line)
    return '\n'.join(out)


def code(text, label):
    return f'<figure class="code"><figcaption>{esc(label)}</figcaption><pre>{highlight(text.strip(chr(10)))}</pre></figure>'


def box(kind, title, body):
    return f'<aside class="box {kind}"><b>{title}</b>{body}</aside>'


def table(head, rows, cls='compact'):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def img(name, caption, cls=''):
    return f'<figure class="shot {cls}"><img src="file://{IMG / name}"><figcaption>{caption}</figcaption></figure>'


def lines_of(path):
    return len((ROOT / path).read_text().split('\n')) - 1


def lines_before(path):
    text = subprocess.run(['git', '-C', str(ROOT), 'show', f'{BASE}:{path}'], capture_output=True, text=True).stdout
    return len(text.split('\n')) - 1 if text else 0


sections, toc = [], []


def section(num, title, body):
    sid = f's{num}'
    toc.append((num, title, sid))
    sections.append(f'<section id="{sid}" class="chapter"><h1><span class="num">{num}</span>{title}</h1>{body}</section>')


# ---------------------------------------------------------------- Gráficos (SVG estático: o PDF não tem passar o mouse)
ANTES, DEPOIS = '#c07a3c', '#2f6fb0'  # validados (daltonismo, contraste) com o validador de paletas


def bars(title, before, after, unit=''):
    """Um gráfico por métrica (cada um com o próprio eixo, nunca dois eixos juntos), com o valor escrito ao lado."""
    w, bh, gap, left = 250, 13, 4, 46
    top = 22
    mx = max(before, after) or 1
    scale = (w - left - 48) / mx
    rows = []
    for i, (lab, v, color) in enumerate([('antes', before, ANTES), ('depois', after, DEPOIS)]):
        y = top + i * (bh + gap)
        bw = max(2, v * scale)
        rows.append(f'<text x="{left - 6}" y="{y + bh - 3}" text-anchor="end" class="lab">{lab}</text>'
                    f'<rect x="{left}" y="{y}" width="{bw:.1f}" height="{bh}" rx="3" fill="{color}"/>'
                    f'<text x="{left + bw + 5:.1f}" y="{y + bh - 3}" class="val">{str(v).replace(".", ",")}{unit}</text>')
    h = top + 2 * (bh + gap) + 2
    return (f'<svg viewBox="0 0 {w} {h}" class="minibar" role="img" aria-label="{esc(title)}: antes {before}, depois {after}">'
            f'<text x="0" y="12" class="tt">{esc(title)}</text>'
            f'<line x1="{left}" x2="{left}" y1="{top - 3}" y2="{h - 2}" stroke="#d6cbb8"/>{"".join(rows)}</svg>')


METRICS = [
    ('Linhas do main.ts', 799, 140, ''),
    ('Maior função (linhas)', 224, 56, ''),
    ('Linhas por função (média)', 11.7, 7.9, ''),
    ('Funções com mais de 30 linhas', 26, 12, ''),
    ('Complexidade ciclomática máxima', 26, 13, ''),
    ('Funções com complexidade > 10', 17, 4, ''),
    ('Trechos duplicados', 48, 14, ''),
    ('Geometrias na GPU após 40 mapas', 393, 10, ''),
]
legend = (f'<p class="legend"><span class="key" style="background:{ANTES}"></span>antes (commit {BASE}) '
          f'<span class="key" style="background:{DEPOIS}"></span>depois (branch refatoracao) — em todos, menor é melhor</p>')
charts = legend + '<div class="charts">' + ''.join(bars(*m) for m in METRICS) + '</div>'

extra_css = f'''
.charts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 8mm; margin: 2mm 0 4mm; }}
svg.minibar {{ width: 100%; font-family: Inter, sans-serif; }}
svg.minibar .tt {{ font-size: 9px; font-weight: 600; fill: #2a2218; }}
svg.minibar .lab {{ font-size: 8px; fill: #6b5f50; }}
svg.minibar .val {{ font-size: 8.5px; fill: #2a2218; font-variant-numeric: tabular-nums; }}
p.legend {{ font-family: Inter, sans-serif; font-size: 8.6pt; color: #6b5f50; margin: 2mm 0; }}
.key {{ display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin: 0 1.5mm 0 3mm; vertical-align: -1px; }}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }}
.pair figure.code pre {{ font-size: 6.9pt; }}
.shots {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; align-items: start; }}
.shots figure.shot.phone {{ float: none; width: 60%; margin: 0 auto; }}
.shots figure.shot figcaption {{ font-size: 7.6pt; }}
td.n {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
.big {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 4mm 0; }}
.big div {{ border: 1px solid var(--rule); border-radius: 4px; padding: 3mm; font-family: Inter, sans-serif; }}
.big b {{ display: block; font-size: 17pt; color: {DEPOIS}; }}
.big span {{ font-size: 8pt; color: #6b5f50; }}
'''

# ---------------------------------------------------------------- 1 Resumo
section('1', 'Resumo', f'''
<p class="lead">O código do Wumpus 3D foi reorganizado seguindo os princípios do livro <i>Código Limpo</i>, de Robert C. Martin: funções pequenas que fazem uma coisa só, nomes que explicam a intenção, nada de repetição, e cada módulo com uma única responsabilidade. <b>Nenhuma regra do jogo, pontuação, sorteio de mapa ou decisão de agente mudou</b> — e isso foi comprovado, não só suposto (capítulo 4).</p>
<div class="big">
  <div><b>−82%</b><span>linhas no main.ts (799 → 140)</span></div>
  <div><b>−75%</b><span>tamanho da maior função (224 → 56 linhas)</span></div>
  <div><b>−71%</b><span>trechos duplicados (48 → 14)</span></div>
  <div><b>−97%</b><span>geometrias acumuladas na GPU após 40 mapas (393 → 10)</span></div>
</div>
{charts}
{box('decision', 'O que foi feito, em uma frase por parte', '''<ul>
<li><b>Interface</b>: o <code>main.ts</code>, que fazia tudo, virou o ponto de entrada de 9 módulos em <code>src/ui/</code> (um por seção do painel, mais estado, HUD e controle da partida).</li>
<li><b>Regras</b>: <code>step()</code> (102 linhas) virou um método por ação; o sorteio do mapa saiu do construtor.</li>
<li><b>Agentes</b>: as decisões longas (<code>explore()</code>, 40 e 64 linhas) foram divididas em passos com nome.</li>
<li><b>3D</b>: <code>load()</code>, <code>sync()</code> e <code>frame()</code> divididos; a cena agora libera a memória de vídeo do mapa anterior.</li>
<li><b>Arena, relatórios, armazenamento e scripts</b>: funções gigantes divididas e utilitários repetidos reunidos num lugar só.</li></ul>''')}
''')

# ---------------------------------------------------------------- 2 Princípios
section('2', 'Princípios aplicados', f'''
<p>Cada mudança segue uma regra do livro. A tabela liga o princípio ao que mudou no projeto:</p>
{table(['Princípio (Código Limpo)', 'Antes', 'Depois'], [
    ['<b>Funções pequenas</b> (cap. 3)', '<code>initArena</code> com 224 linhas; <code>step</code> com 102; <code>load</code> com 92.', 'Maior função com 56 linhas (um gráfico SVG); média de 7,9 linhas.'],
    ['<b>Fazer uma coisa só</b> (cap. 3)', '<code>runCompetition</code> lia a tela, jogava, montava o ranking e o relatório.', '<code>readSettings</code>, <code>playMaps</code>, <code>summarize</code>, <code>runCompetition</code> só coordena.'],
    ['<b>Um nível de abstração por função</b> (cap. 3)', '<code>explore()</code> misturava busca de caminho, probabilidade e textos.', '<code>explore</code> chama <code>planShot</code>, <code>gamble</code>, <code>riskMeasure</code>, <code>evidenceCount</code>.'],
    ['<b>Não se repita (DRY)</b> (cap. 17)', '<code>$</code> definido 3 vezes; <code>esc</code> 2; <code>pct/num</code> 7; laço de partida offline 3; download, cópia e confirmação em 2–3 lugares.', '<code>src/ui/dom.ts</code>, <code>src/util/format.ts</code>, <code>playToEnd</code>/<code>playMaps</code>, <code>rankingCells</code>, <code>confirmTwice</code>.'],
    ['<b>Nomes que revelam a intenção</b> (cap. 2)', '<code>fmt</code>, <code>pct</code>, <code>g</code>, <code>r</code>, <code>k.split(\',\').map(Number)</code> espalhado.', '<code>cellName</code>, <code>percent</code>, <code>parseKey</code>, <code>firingSpots</code>, <code>followPlan</code>, <code>prefersShooting</code>.'],
    ['<b>Responsabilidade única</b> (cap. 10)', '<code>main.ts</code>: estado, HUD, mapas, treino, avaliação, partidas humanas e eventos.', 'Um módulo por responsabilidade em <code>src/ui/</code>; <code>main.ts</code> só liga as peças.'],
    ['<b>Código morto sai</b> (cap. 17)', '<code>benchmark()</code> sem uso; <code>fmt</code>/<code>pct</code> exportados sem uso.', 'Removidos.'],
    ['<b>Tabela em vez de if/else</b> (cap. 3, switch)', '<code>parseArgs</code> com cadeias de <code>else if</code> nos scripts; teclas e botões em sequências de <code>if</code>.', '<code>parseFlags</code> (<code>scripts/args.ts</code>), mapas <code>COMMON_KEYS</code> e <code>clicks</code> em <code>main.ts</code>.'],
    ['<b>Comentários explicam o porquê</b> (cap. 4)', 'Bons comentários já existiam.', 'Mantidos; cada função nova tem uma linha dizendo para que serve.'],
])}
{box('notdo', 'O que a refatoração não mudou de propósito', '<ul><li>Nenhuma das 8 invariantes do projeto (<code>CLAUDE.md</code>) e nenhuma decisão D1–D20.</li><li>Sem framework de interface (D1 continua valendo): os módulos são funções simples.</li><li>O id dos agentes importados continua com a mesma fórmula, para não perder agentes já salvos nos navegadores.</li><li>Os 41 testes existentes não foram alterados.</li></ul>')}
''')

# ---------------------------------------------------------------- 3 Mudanças
STEP_BEFORE = '''step(action: Action): StepResult {
  // ... cobra a ação ...
  switch (action) {
    case 'left': ...
    case 'right': ...
    case 'forward': {
      const [dx, dy] = DIR_VEC[a.dir];
      const nx = a.x + dx;
      const ny = a.y + dy;
      if (!this.inBounds(nx, ny)) {
        bump = true;
        message = 'Bateu na parede!';
        break;
      }
      a.x = nx; a.y = ny;
      this.visited.add(key(nx, ny));
      message = `Andou para (${nx + 1}, ${ny + 1}).`;
      if (this.hasPit(nx, ny)) {
        this.status = 'dead-pit';
        this.score += SCORE.death;
        message = 'Você caiu em um poço! ...';
      } else if (this.wumpusAlive && ...) {
        // ... mais 15 linhas ...
      }
      break;
    }
    case 'shoot': { /* 30 linhas */ }
    case 'grab': ...
  }
  // ... limite de ações, percepções ...
}  // 102 linhas no total'''
STEP_AFTER = '''step(action: Action): StepResult {
  if (this.gameOver) return { ... };
  this.score += SCORE.action;
  this.actions++;
  const outcome = this.perform(action);
  if (this.status === 'playing' && this.actions >= this.maxActions) {
    this.status = 'timeout';
    outcome.message = `Limite de ...`;
  }
  this.percepts = this.sense(outcome.bump, outcome.scream);
  return { percepts: this.percepts, message: outcome.message, arrow: outcome.arrow };
}

private moveForward(): Outcome {
  const a = this.agent;
  const [dx, dy] = DIR_VEC[a.dir];
  const next = { x: a.x + dx, y: a.y + dy };
  if (!this.inBounds(next.x, next.y)) return { message: 'Bateu na parede!', bump: true };
  a.x = next.x;
  a.y = next.y;
  this.visited.add(key(next.x, next.y));
  if (this.hasPit(next.x, next.y)) return this.die('dead-pit', '...');
  if (this.wumpusAt(next)) return this.die('dead-wumpus', '...');
  if (next.x === 0 && next.y === 0) return this.arriveAtEntrance();
  return { message: `Andou para (${next.x + 1}, ${next.y + 1}).` };
}'''

MAIN_AFTER = '''window.addEventListener('keydown', onKeyDown);
initGameButtons();
initConfigFields();
initMapsPanel();
initGeneticPanel();
initBenchPanel();
initHumanPanel(() => restart());
initAnalysis();
initArenaScreen();

setSetupOpen(window.innerWidth > 760);
refreshPlayerOptions();
updateSetup();
updatePitHint();
updateHumanPanel();
restart();
view.renderer.setAnimationLoop(tick);'''

DUP_BEFORE = '''// main.ts — excluir mapa
if (!delBtn.dataset.confirm) {
  delBtn.dataset.confirm = '1';
  delBtn.textContent = 'Confirmar?';
  return;
}
// arena/ui.ts — remover agente
if (!del.dataset.confirm) {
  del.dataset.confirm = '1';
  del.textContent = 'Confirmar?';
  return;
}
// main.ts — apagar partidas
if (!btn.dataset.confirm) {
  btn.dataset.confirm = '1';
  btn.textContent = `Confirmar: apagar ...`;
  return;
}'''
DUP_AFTER = '''// src/ui/dom.ts — uma vez só
export function confirmTwice(btn, opts) { ... }

// maps-panel.ts
confirmTwice(deleteButton, {
  canStart: () => !!selectedMap(),
  confirmLabel: () => 'Confirmar?',
  onConfirm: () => { deleteMap(...); ... },
});
// arena/ui.ts
confirmTwice(del, {
  confirmLabel: () => 'Confirmar?',
  onConfirm: () => removeAgent(external),
});
// human-panel.ts
confirmTwice(clear, {
  confirmLabel: () => `Confirmar: apagar ...`,
  onConfirm: () => { clearHumanGames(...); ... },
});'''

files_rows = []
for path, what in [
    ('src/main.ts', 'Só liga teclado, botões e painéis aos módulos.'),
    ('src/ui/state.ts', 'novo: estado da partida (<code>match</code>) e campos de configuração.'),
    ('src/ui/game.ts', 'novo: <code>act</code>, <code>agentStep</code>, <code>restart</code>, câmera, laço <code>tick</code>.'),
    ('src/ui/hud.ts', 'novo: placares, percepções, pensamento, registro e fim de jogo.'),
    ('src/ui/players.ts', 'novo: quem joga, seletor, criação do agente.'),
    ('src/ui/maps-panel.ts', 'novo: seção "Salvar mapas".'),
    ('src/ui/genetic-panel.ts', 'novo: seção "Agente genético".'),
    ('src/ui/bench-panel.ts', 'novo: seção "Avaliação".'),
    ('src/ui/human-panel.ts', 'novo: seção "Minhas partidas" e árbitro da partida humana.'),
    ('src/ui/dom.ts', 'novo: <code>$</code>, mensagens, download, copiar, confirmar, telas sobrepostas.'),
    ('src/util/format.ts', 'novo: porcentagens, números, escape de HTML, nomes de arquivo (sem DOM).'),
    ('src/game/world.ts', '<code>step</code> por ação; <code>randomPlacement</code>, <code>reachable</code>, <code>parseLayoutCell</code>; <code>parseKey</code>, <code>gridNeighbors</code>, <code>inGrid</code>, <code>sameCell</code>.'),
    ('src/agents/agents.ts', 'Classe base <code>ThinkingAgent</code>; <code>explore</code> dividido; características do genético em <code>cellFeatures</code>.'),
    ('src/agents/knowledge.ts', 'Enumeração de poços em <code>enumeratePits</code>; vizinhas pela grade comum.'),
    ('src/agents/genetic.ts', '<code>validate</code>, <code>tournament</code>, <code>nextGeneration</code> saíram de <code>train</code>.'),
    ('src/agents/benchmark.ts', '<code>playToEnd</code>/<code>playMaps</code> (usados por treino, medir e treinar); <code>benchmark()</code> morto removido.'),
    ('src/render/view.ts', '<code>load</code> em 5 construtores; <code>sync</code> e <code>frame</code> divididos; <code>disposeTree</code>.'),
    ('src/arena/ui.ts', '<code>initArena</code> (224 linhas) em 15 funções; tabela usa <code>rankingCells</code>.'),
    ('src/arena/ranking.ts', '<code>rankingCells</code> compartilhado com a tela.'),
    ('src/arena/runner.ts', '<code>failedEpisode</code> (antes montado à mão no script da Arena).'),
    ('src/arena/protocol.ts', '<code>normalizeBeliefs</code> separado.'),
    ('src/report/ui.ts', '<code>render</code> dividido; usa <code>dom.ts</code>.'),
    ('src/storage.ts', '<code>readJson</code>/<code>readList</code>/<code>writeJson</code>/<code>upsert</code> no lugar de 13 blocos try/catch.'),
    ('scripts/arena.ts', '<code>main</code> (66 linhas) em <code>loadParticipants</code>, <code>playAll</code>, <code>writeReport</code>.'),
    ('scripts/args.ts', 'novo: opções de linha de comando como tabela (arena e treinar).'),
]:
    before = lines_before(path)
    files_rows.append([f'<code>{path}</code>', f'<span class="tnum">{before or "—"}</span>', f'<span class="tnum">{lines_of(path)}</span>', what])

section('3', 'O que mudou, parte por parte', f'''
<h2>Interface: o main.ts deixou de fazer tudo</h2>
<p>Antes, 799 linhas misturavam estado da partida, placares, mapas, treino genético, avaliação, partidas humanas e eventos. Mexer em "Salvar mapas" exigia ler o arquivo inteiro. Agora cada seção é um módulo, e o <code>main.ts</code> ficou assim (o arquivo inteiro tem 140 linhas):</p>
{code(MAIN_AFTER, 'src/main.ts — o fim do arquivo: cada linha liga uma parte')}

<h2>Repetição: escrito uma vez, usado em vários lugares</h2>
<div class="pair">{code(DUP_BEFORE, 'antes — a mesma lógica em 3 arquivos')}{code(DUP_AFTER, 'depois — confirmTwice() em src/ui/dom.ts')}</div>

<h2>Regras: um método por ação</h2>
<div class="pair">{code(STEP_BEFORE, f'antes — world.ts, step() ({BASE})')}{code(STEP_AFTER, 'depois — step() e moveForward()')}</div>
<p>Com um método por ação, a regra de morte, a de vitória (D6) e a do tiro ficam cada uma num lugar com nome. O sorteio do mapa também saiu do construtor para <code>randomPlacement()</code>, preservando a ordem exata das chamadas ao sorteador — por isso os mapas de cada semente continuam os mesmos (invariante 7).</p>

<h2>Todos os arquivos tocados</h2>
{table(['Arquivo', 'Linhas antes', 'Linhas depois', 'O que mudou'], files_rows, 'compact files')}
<p>Também mudaram, sem alterar o conteúdo dos textos: <code>report/html.ts</code> e <code>report/charts.ts</code> (usam <code>format.ts</code>), <code>report/report.ts</code> (<code>slugify</code>), <code>scripts/medir.ts</code> e <code>scripts/treinar.ts</code> (usam <code>playMaps</code>).</p>
''')

# ---------------------------------------------------------------- 4 Verificação
section('4', 'Como foi comprovado que nada quebrou', f'''
<p class="lead">Refatorar é mudar a estrutura <b>sem mudar o comportamento</b>. Antes de mexer em qualquer linha, a versão original gravou uma "linha de base"; depois, as mesmas execuções foram repetidas e comparadas.</p>
{table(['Verificação', 'Como', 'Resultado'], [
    ['Tipos e testes', '<code>npm run check</code> (tsc + Vitest)', '<b>49 de 49</b> passando: os 41 originais, sem alteração, e 8 novos (<code>tests/refatoracao.test.ts</code>).'],
    ['Arena 4×4', '300 mapas, semente <code>verificacao</code>, JSON completo e relatório com as 1500 partidas', '<b>Idêntico</b> (fora tempo de decisão e data).'],
    ['Arena 6×6', '150 mapas, semente <code>verificacao6</code>', '<b>Idêntico</b>.'],
    ['Medição', '<code>npm run medir</code> com 2000 mapas 4×4 e 500 6×6', '<b>Idêntico</b>, incluindo os intervalos de confiança.'],
    ['Treino genético', '<code>npm run treinar</code> com semente fixa', '<b>Mesmo genoma</b>, mesmas aptidões por geração.'],
    ['Ranking em Markdown', 'Arena só com o agente de exemplo', '<b>Idêntico</b>.'],
    ['Navegador', 'Mesmo roteiro do Playwright nas duas versões, com <code>Math.random</code> semeado: teclado, 4 agentes passo a passo e jogando sozinhos, avaliação, salvar/carregar/exportar/importar/excluir mapas, desafio por semente, Minhas partidas, Análise, Arena com agente importado (assistir e remover), treino genético, celular', '<b>67 de 67</b> pontos de verificação idênticos; nenhum erro no console; sem rolagem horizontal no celular (390 px).'],
    ['Memória de vídeo', '40 mapas novos seguidos (tecla R), lendo <code>renderer.info.memory</code>', 'Antes: 9 → <b>393</b> geometrias. Depois: 10 → <b>10</b>.'],
])}
{box('trap', 'Por que o agente aleatório ficou de fora das comparações por semente', '<p>Ele usa <code>Math.random</code>, que não tem semente nos scripts: dá números diferentes a cada execução, antes e depois da refatoração. Todos os outros agentes são determinísticos e deram resultados idênticos.</p>')}
{box('trap', 'Um detalhe do teste no navegador', '<p>Com <code>Math.random</code> semeado, a primeira comparação divergiu no "novo mapa": o Three.js também usa <code>Math.random</code> para criar o identificador de cada geometria e material, e a versão nova cria <b>menos</b> objetos (os poços passaram a compartilhar geometria). Uma build de teste com os poços criados como antes deu os 67 pontos idênticos, isolando a causa. Em uso normal, sem semente, isso não tem efeito visível.</p>')}
''')

# ---------------------------------------------------------------- 5 Benefícios
section('5', 'Benefícios', f'''
<h2>Manutenção e leitura</h2>
<ul>
<li><b>Achar onde mexer ficou direto.</b> "Salvar mapas" está em <code>maps-panel.ts</code>; a regra de vitória, em <code>arriveAtEntrance()</code>; a nota do tiro do genético, em <code>prefersShooting()</code>. O nome do arquivo ou da função diz o que tem dentro.</li>
<li><b>Menos lugares para corrigir o mesmo erro.</b> Download, cópia, confirmação, formatação de porcentagem e a partida sem 3D agora têm um só código. Antes, uma correção no download precisava ser feita em dois arquivos.</li>
<li><b>Funções testáveis.</b> Peças que só existiam dentro de funções grandes viraram funções com entrada e saída (<code>enumeratePits</code>, <code>playMaps</code>, <code>rankingCells</code>, <code>slugify</code>, <code>gridNeighbors</code>) e ganharam testes.</li>
<li><b>Complexidade menor.</b> Complexidade ciclomática média 2,96 → 2,22; funções com 3 ou mais níveis de aninhamento 12 → 7. Menos caminhos por função = menos casos para pensar ao mudar.</li>
</ul>
<h2>Otimização</h2>
<ul>
<li><b>Vazamento de memória de vídeo corrigido</b> (estava nas pendências do HISTÓRICO): <code>disposeTree()</code> libera geometrias, materiais e texturas ao trocar de mapa, ao redesenhar as crenças do agente e quando a flecha termina. Em sessões longas, a memória da placa de vídeo para de crescer.</li>
<li><b>Poços compartilham geometria e material</b>: um mapa 6×6 com 7 poços cria 4 objetos em vez de 28.</li>
<li><b>Velocidade dos agentes</b>: a lógica de decisão é a mesma, passo a passo; não houve ganho nem perda de desempenho a medir.</li>
</ul>
<h2>Redução de código</h2>
{box('notdo', 'Sendo honesto sobre o total de linhas', '<p>O total <b>aumentou</b> 12%. Dividir uma função de 100 linhas em seis funções pequenas acrescenta seis assinaturas, seis linhas de comentário dizendo para que cada uma serve e linhas em branco entre elas. O <i>Código Limpo</i> aceita essa troca: o objetivo é que cada pedaço seja fácil de entender, não que o arquivo seja o mais curto possível. A redução real está onde importa — no arquivo que fazia tudo (−82%) e nas repetições (−71%). O bundle cresceu 2,6% (gzip) pelos nomes de funções a mais; ele é dominado pelo Three.js (~600 KB), uma pendência antiga.</p>')}
{table(['Medida', 'Antes', 'Depois', 'Variação'], [
    ['<code>main.ts</code>', '<span class="tnum">799</span>', '<span class="tnum">140</span>', '−82%'],
    ['Trechos duplicados (ocorrências)', '<span class="tnum">48</span>', '<span class="tnum">14</span>', '−71% (o que sobra é a definição única de cada um)'],
    ['Código morto', '<code>benchmark()</code>, 2 exportações sem uso', 'nenhum', 'removido'],
    ['<code>storage.ts</code>', '<span class="tnum">153</span>', f'<span class="tnum">{lines_of("src/storage.ts")}</span>', '−18%'],
    ['<code>agents/benchmark.ts</code>', '<span class="tnum">39</span>', f'<span class="tnum">{lines_of("src/agents/benchmark.ts")}</span>', '−31%'],
    ['Linhas totais em <code>src/</code> e <code>scripts/</code>', '<span class="tnum">4324</span>', '<span class="tnum">4862</span>', '+12%'],
    ['Linhas de código, sem comentários e linhas vazias', '<span class="tnum">3605</span>', '<span class="tnum">3902</span>', '+8%'],
])}
''')

# ---------------------------------------------------------------- 6 Prévia
section('6', 'Prévia do jogo depois da refatoração', f'''
<p>Capturas feitas pelo roteiro de verificação, na build de produção da branch <code>refatoracao</code> (computador 1280×800 e celular 390×844). A aparência é a mesma da versão anterior.</p>
<div class="shots">
{img('refatoracao-01-inicio.png', 'Início de partida, com o painel aberto.')}
{img('refatoracao-04-agente-probabilistico.png', 'Agente probabilístico jogando: crenças sobre as salas desenhadas no piso e o pensamento do agente.')}
{img('refatoracao-02-mapa-aberto.png', 'Mapa aberto (tecla M).')}
{img('refatoracao-08-arena.png', 'Arena: competição com o agente de exemplo importado.')}
{img('refatoracao-07-analise.png', 'Análise de relatórios: você × agentes nos mesmos mapas.')}
{img('refatoracao-10-celular.png', 'No celular.', 'phone')}
</div>
''')

# ---------------------------------------------------------------- 7 Limites
section('7', 'O que ficou para depois', f'''
<ul>
<li>Funções ainda acima de 30 linhas: <code>installChartHover</code> (56), <code>reportSections</code> (42), <code>renderReportHtml</code> (40) e o gráfico do treino (35). São montagens de HTML/SVG com pouca lógica (complexidade 2 a 5); dividi-las mais espalharia o desenho sem ganho de clareza.</li>
<li>Complexidade ainda acima de 10: <code>parseLayout</code> e <code>parseReport</code> (validações em sequência, uma por campo), <code>Referee.judge</code> e <code>agentStep</code> (11). Cada <code>if</code> ali é uma regra a conferir.</li>
<li>Testes automáticos de interface: o roteiro do Playwright usado aqui comparou as duas versões, mas não está no <code>npm run check</code>. É a pendência "testes de interface" do HISTÓRICO.</li>
<li>Bundle de ~650 KB por causa do <code>import * as THREE</code> (pendência antiga).</li>
</ul>
<p>Como as métricas foram medidas: análise da árvore sintática do TypeScript (compilador 5.6) sobre <code>src/</code> e <code>scripts/</code>, contando funções e métodos nomeados; complexidade ciclomática = 1 + <code>if</code>, <code>?:</code>, laços, <code>case</code>, <code>catch</code>, <code>&amp;&amp;</code>, <code>||</code> e <code>??</code>. Duplicações: contagem de padrões conhecidos (definições de <code>$</code>, <code>esc</code>, <code>pct</code>/<code>num</code>, download, cópia, confirmação, laço de partida offline, <code>split(',').map(Number)</code> e acessos ao <code>localStorage</code>).</p>
''')

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{num}</span>{t}</a></li>' for num, t, sid in toc)
doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Refatoração pelo Código Limpo</title>
<style>{css}{extra_css}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Wumpus 3D · Relatório de refatoração</div>
    <h1>Código Limpo</h1>
    <p class="sub">O que mudou na organização do código, como foi comprovado que o jogo continua igual e o que se ganhou em leitura, manutenção, memória e repetição.</p>
  </div>
  <div class="meta">
    <span>Base</span><b>commit {BASE} (main)</b>
    <span>Branch</span><b>refatoracao</b>
    <span>Data</span><b>{DATE}</b>
    <span>Referência</span><b>MARTIN, Robert C. <i>Clean Code: A Handbook of Agile Software Craftsmanship</i>. Upper Saddle River: Prentice Hall, 2008. ISBN 978-0-13-235088-4. (Em português: <i>Código Limpo</i>, Alta Books.)</b>
  </div>
</div>
<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol></nav>
{''.join(sections)}
</body></html>'''
OUT.write_text(doc)
print('ok')
