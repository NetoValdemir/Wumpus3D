# Gera docs/wumpus3d-documentacao.html a partir do código real do projeto.
# Os trechos de código são extraídos dos arquivos-fonte, então sempre batem com a versão documentada.
import html, re, subprocess, sys, base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]  # raiz do projeto
OUT = pathlib.Path(sys.argv[1])
IMG = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).parent / 'img'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
_hoje = __import__('datetime').date.today()
DATE = f'{_hoje.day} de {MESES[_hoje.month - 1]} de {_hoje.year}'
COMMIT = subprocess.run(['git', '-C', str(ROOT), 'log', '-1', '--format=%h'], capture_output=True, text=True).stdout.strip()


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


def snip(path, start, end=None, lines=None, label=None, exclusive=False):
    """Trecho real do arquivo: da primeira linha que contém `start` até a linha que contém `end` (inclusive)."""
    src = (ROOT / path).read_text().split('\n')
    i = next(n for n, l in enumerate(src) if start in l)
    if end is None and lines is None:
        raise ValueError('end ou lines')
    if lines is not None:
        j = i + lines - 1
    else:
        j = next(n for n in range(i + 1, len(src)) if end in src[n]) - (1 if exclusive else 0)
        while exclusive and not src[j].strip():
            j -= 1
    body = '\n'.join(src[i : j + 1])
    # remove indentação comum
    ind = min((len(l) - len(l.lstrip()) for l in src[i : j + 1] if l.strip()), default=0)
    body = '\n'.join(l[ind:] for l in body.split('\n'))
    return f'<figure class="code"><figcaption>{esc(label or path)} <span>linhas {i + 1}–{j + 1}</span></figcaption><pre>{highlight(body)}</pre></figure>'


def code(text, label=None, lang=''):
    cap = f'<figcaption>{esc(label)}</figcaption>' if label else ''
    return f'<figure class="code">{cap}<pre>{highlight(text.strip(chr(10)))}</pre></figure>'


def box(kind, title, body):
    return f'<aside class="box {kind}"><b>{title}</b>{body}</aside>'


def img(name, caption, cls=''):
    data = base64.b64encode((IMG / name).read_bytes()).decode()
    return f'<figure class="shot {cls}"><img src="data:image/png;base64,{data}" alt="{esc(caption)}"/><figcaption>{caption}</figcaption></figure>'


def table(head, rows, cls=''):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def exemplo_svg():
    """Situação real (mapa 2 da semente "exemplo"): mesmas pistas, escolhas diferentes."""
    c, ox, oy = 72, 34, 8  # tamanho da sala e margens
    cells = {
        (1, 1): ('vis', ['brisa']), (1, 2): ('vis', ['nada']), (2, 2): ('vis', ['brisa']), (1, 3): ('here', ['brisa', 'agente aqui']),
        (2, 1): ('pit', ['poço certo', '100%']), (1, 4): ('L', ['P(poço) 56%', 'escolha do', 'LÓGICO']),
        (2, 3): ('risk', ['P(poço) 56%']), (3, 2): ('B', ['P(poço) 20%', 'escolha do', 'PROBABILÍSTICO']),
    }
    fill = {'vis': '#e8e4dc', 'here': '#d9e6f5', 'pit': '#3a3330', 'L': '#fbe3d6', 'risk': '#ffffff', 'B': '#d8efe3'}
    ink = {'pit': '#ffffff'}
    out = [f'<svg viewBox="0 0 {ox + 4 * c + 8} {oy + 4 * c + 26}" class="diagram small" role="img" aria-label="Exemplo em que os agentes lógico e probabilístico escolhem salas diferentes">']
    for x in range(1, 5):
        for y in range(1, 5):
            kind, text = cells.get((x, y), ('unk', []))
            px, py = ox + (x - 1) * c, oy + (4 - y) * c
            out.append(f'<rect x="{px}" y="{py}" width="{c}" height="{c}" fill="{fill.get(kind, "#f6f4f0")}" stroke="#8a8173" stroke-width="1"/>')
            for i, t in enumerate(text):
                weight = ' font-weight="700"' if t in ('LÓGICO', 'PROBABILÍSTICO', 'poço certo') else ''
                size = 8.5 if t == 'PROBABILÍSTICO' else 10
                out.append(f'<text x="{px + c / 2}" y="{py + c / 2 - (len(text) - 1) * 6.5 + i * 13 + 4}" text-anchor="middle" font-size="{size}" fill="{ink.get(kind, "#1d1a16")}"{weight}>{t}</text>')
    for i in range(1, 5):
        out.append(f'<text x="{ox + (i - 0.5) * c}" y="{oy + 4 * c + 16}" text-anchor="middle" font-size="10" fill="#5e5850">{i}</text>')
        out.append(f'<text x="{ox - 10}" y="{oy + (4 - i + 0.5) * c + 4}" text-anchor="middle" font-size="10" fill="#5e5850">{i}</text>')
    out.append('</svg>')
    return ''.join(out)


def lines_of(path):
    return len((ROOT / path).read_text().split('\n')) - 1


sections = []
toc = []


def section(num, title, body, cls=''):
    sid = f's{num}'.replace('.', '-')
    toc.append((num, title, sid))
    sections.append(f'<section id="{sid}" class="chapter {cls}"><h1><span class="num">{num}</span>{title}</h1>{body}</section>')


# ---------------------------------------------------------------- Diagramas (SVG)

SVG_ARCH = '''
<svg viewBox="0 0 720 430" class="diagram" role="img" aria-label="Camadas da arquitetura">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b5a45"/></marker></defs>
  <g font-family="Inter" font-size="12">
    <rect x="10" y="10" width="700" height="70" rx="8" fill="#f3ede3" stroke="#c9b48a"/>
    <text x="24" y="32" font-weight="700" fill="#3b2f22">Interface (navegador)</text>
    <text x="24" y="52" fill="#5b4c3b">index.html · style.css · src/main.ts · src/arena/ui.ts</text>
    <text x="24" y="68" fill="#5b4c3b" font-size="11">Lê cliques e teclas, mostra placares, painel, Arena. Decide QUANDO cada coisa acontece.</text>

    <rect x="10" y="110" width="340" height="80" rx="8" fill="#e8eef7" stroke="#8aa3c9"/>
    <text x="24" y="132" font-weight="700" fill="#22324b">Renderização 3D</text>
    <text x="24" y="152" fill="#3b4c66">src/render/view.ts (Three.js)</text>
    <text x="24" y="170" fill="#3b4c66" font-size="11">Desenha o estado. Nunca muda as regras.</text>

    <rect x="370" y="110" width="340" height="80" rx="8" fill="#eaf4ea" stroke="#8ac99a"/>
    <text x="384" y="132" font-weight="700" fill="#22472b">Arena</text>
    <text x="384" y="152" fill="#3b5e43">src/arena/* · scripts/arena.ts</text>
    <text x="384" y="170" fill="#3b5e43" font-size="11">Contrato, isolamento, árbitro, ranking.</text>

    <rect x="10" y="220" width="700" height="80" rx="8" fill="#f7ecea" stroke="#c99a8a"/>
    <text x="24" y="242" font-weight="700" fill="#4b2a22">Agentes (inteligência)</text>
    <text x="24" y="262" fill="#66413b">src/agents/knowledge.ts · agents.ts · genome.ts · genetic.ts · ga.worker.ts · benchmark.ts</text>
    <text x="24" y="280" fill="#66413b" font-size="11">Recebem só percepções e devolvem uma ação. Não enxergam o mapa.</text>

    <rect x="10" y="330" width="460" height="90" rx="8" fill="#fff6d9" stroke="#d9b54a" stroke-width="2"/>
    <text x="24" y="352" font-weight="700" fill="#4b3a0a">Regras do jogo (núcleo, TypeScript puro)</text>
    <text x="24" y="372" fill="#66530f">src/game/world.ts — WumpusWorld, MapLayout, pontuação</text>
    <text x="24" y="390" fill="#66530f" font-size="11">Não importa nada de 3D nem de tela. Roda igual no navegador,</text>
    <text x="24" y="406" fill="#66530f" font-size="11">no Node (linha de comando) e dentro de um Web Worker.</text>

    <rect x="490" y="330" width="220" height="90" rx="8" fill="#f1f1f1" stroke="#aaa"/>
    <text x="504" y="352" font-weight="700" fill="#333">Armazenamento</text>
    <text x="504" y="372" fill="#555">src/storage.ts</text>
    <text x="504" y="390" fill="#555" font-size="11">localStorage: mapas, genoma,</text>
    <text x="504" y="406" fill="#555" font-size="11">agentes importados.</text>

    <g stroke="#6b5a45" stroke-width="1.5" fill="none" marker-end="url(#a)">
      <path d="M180 80 L180 108"/><path d="M540 80 L540 108"/>
      <path d="M180 190 L180 328"/><path d="M540 190 L540 218"/>
      <path d="M360 300 L360 328"/><path d="M600 80 C700 90 715 250 650 328"/>
    </g>
  </g>
  <text x="360" y="426" font-family="Inter" font-size="10" fill="#8a7a66" text-anchor="middle">As setas apontam para quem é usado. Nenhuma camada de baixo conhece as de cima.</text>
</svg>'''

SVG_STEP = '''
<svg viewBox="0 0 720 330" class="diagram" role="img" aria-label="Sequência de um passo do agente">
  <defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b2f22"/></marker></defs>
  <g font-family="Inter" font-size="11.5">
    <g font-weight="700" text-anchor="middle" fill="#3b2f22">
      <rect x="10" y="8" width="120" height="30" rx="6" fill="#f3ede3" stroke="#c9b48a"/><text x="70" y="28">laço de animação</text>
      <rect x="150" y="8" width="120" height="30" rx="6" fill="#f3ede3" stroke="#c9b48a"/><text x="210" y="28">main.ts</text>
      <rect x="290" y="8" width="130" height="30" rx="6" fill="#f7ecea" stroke="#c99a8a"/><text x="355" y="28">Controller (agente)</text>
      <rect x="440" y="8" width="130" height="30" rx="6" fill="#fff6d9" stroke="#d9b54a"/><text x="505" y="28">WumpusWorld</text>
      <rect x="590" y="8" width="120" height="30" rx="6" fill="#e8eef7" stroke="#8aa3c9"/><text x="650" y="28">WorldView</text>
    </g>
    <g stroke="#c9bfae" stroke-dasharray="4 4"><path d="M70 38V320M210 38V320M355 38V320M505 38V320M650 38V320"/></g>
    <g stroke="#3b2f22" stroke-width="1.3" marker-end="url(#b)" fill="none">
      <path d="M70 62H206"/><path d="M210 92H351"/><path d="M355 122H214" stroke-dasharray="5 3"/>
      <path d="M210 152H501"/><path d="M505 182H214" stroke-dasharray="5 3"/><path d="M210 212H646"/><path d="M210 242H646"/><path d="M210 272H230V292H214"/>
    </g>
    <g fill="#3b2f22">
      <text x="76" y="56">passou o intervalo da velocidade?</text>
      <text x="216" y="86">decide(publicSensesOf(world))</text>
      <text x="216" y="116">{ action, thought, beliefs } (pode chegar depois: Promise)</text>
      <text x="216" y="146">world.step(action) — aplica a regra, muda o estado</text>
      <text x="216" y="176">StepResult { percepts, message, arrow? }</text>
      <text x="216" y="206">view.shootArrow() se houve tiro · view.sync()</text>
      <text x="216" y="236">view.showBeliefs(crenças visíveis)</text>
      <text x="236" y="288">updateHud(): placares, percepções, fim de jogo</text>
    </g>
    <text x="10" y="316" font-size="10.5" fill="#8a7a66">A cada frame (≈60 vezes por segundo) view.frame() só anima posições e luzes; o estado só muda dentro de world.step().</text>
  </g>
</svg>'''

SVG_GRID = '''
<svg viewBox="0 0 400 300" class="diagram small" role="img" aria-label="Sistema de coordenadas">
  <g font-family="Inter" font-size="11">
    <g transform="translate(60,20)">
      <g stroke="#c9b48a" fill="#fbf7f0">
        <rect x="0" y="0" width="200" height="200"/>
      </g>
      <g stroke="#e3d8c4"><path d="M50 0V200M100 0V200M150 0V200M0 50H200M0 100H200M0 150H200"/></g>
      <circle cx="25" cy="175" r="14" fill="none" stroke="#4fa3ff" stroke-width="3"/>
      <text x="25" y="179" text-anchor="middle" font-size="9" fill="#22324b">entrada</text>
      <g fill="#8a7a66" font-size="10" text-anchor="middle">
        <text x="25" y="215">x=0</text><text x="75" y="215">x=1</text><text x="125" y="215">x=2</text><text x="175" y="215">x=3</text>
      </g>
      <g fill="#8a7a66" font-size="10" text-anchor="end">
        <text x="-6" y="179">y=0</text><text x="-6" y="129">y=1</text><text x="-6" y="79">y=2</text><text x="-6" y="29">y=3</text>
      </g>
      <text x="125" y="129" text-anchor="middle" fill="#3b2f22">(2, 1)</text>
      <text x="125" y="143" text-anchor="middle" font-size="9" fill="#8a7a66">na tela: (3, 2)</text>
    </g>
    <g transform="translate(320,120)" fill="#3b2f22" text-anchor="middle">
      <path d="M0 0L40 0M0 0L0 -40M0 0L-40 0M0 0L0 40" stroke="#6b5a45" stroke-width="1.5"/>
      <text x="56" y="4">0 leste</text><text x="0" y="-46">1 norte</text><text x="-58" y="4">2 oeste</text><text x="0" y="56">3 sul</text>
    </g>
    <text x="60" y="262" fill="#5b4c3b">No código e na API dos agentes: começa em 0.</text>
    <text x="60" y="278" fill="#5b4c3b">Na tela e nos arquivos de mapa (.json): começa em 1.</text>
    <text x="60" y="294" fill="#5b4c3b">No 3D: x vira o eixo X e y vira −Z (o norte "entra" na tela).</text>
  </g>
</svg>'''

SVG_ARENA = '''
<svg viewBox="0 0 720 250" class="diagram" role="img" aria-label="Isolamento do agente externo">
  <defs><marker id="c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b2f22"/></marker></defs>
  <g font-family="Inter" font-size="12">
    <rect x="10" y="10" width="330" height="230" rx="10" fill="#fff6d9" stroke="#d9b54a"/>
    <text x="26" y="34" font-weight="700" fill="#4b3a0a">Página (ou processo Node)</text>
    <rect x="26" y="50" width="140" height="56" rx="6" fill="#fff" stroke="#d9b54a"/><text x="36" y="72" font-weight="600">WumpusWorld</text><text x="36" y="90" font-size="10.5" fill="#66530f">o mapa vive aqui</text>
    <rect x="182" y="50" width="140" height="56" rx="6" fill="#fff" stroke="#d9b54a"/><text x="192" y="72" font-weight="600">Referee</text><text x="192" y="90" font-size="10.5" fill="#66530f">julga cada passo</text>
    <rect x="26" y="122" width="296" height="56" rx="6" fill="#fff" stroke="#d9b54a"/><text x="36" y="144" font-weight="600">playEpisode() (runner.ts)</text><text x="36" y="162" font-size="10.5" fill="#66530f">pede decisão, aplica, mede tempo, conta erros</text>
    <text x="26" y="206" font-size="10.5" fill="#66530f">Limite por decisão: se o agente não responde a tempo,</text>
    <text x="26" y="222" font-size="10.5" fill="#66530f">o Worker é encerrado e a partida conta como erro.</text>

    <rect x="420" y="10" width="290" height="230" rx="10" fill="#f7ecea" stroke="#c99a8a"/>
    <text x="436" y="34" font-weight="700" fill="#4b2a22">Web Worker (ou contexto vm)</text>
    <rect x="436" y="50" width="258" height="56" rx="6" fill="#fff" stroke="#c99a8a"/><text x="446" y="72" font-weight="600">harness (protocol.ts)</text><text x="446" y="90" font-size="10.5" fill="#66413b">registerAgent, __start, __decide</text>
    <rect x="436" y="122" width="258" height="56" rx="6" fill="#fff" stroke="#c99a8a"/><text x="446" y="144" font-weight="600">código do dev (agents/*.js)</text><text x="446" y="162" font-size="10.5" fill="#66413b">só conhece o que chega nas mensagens</text>
    <text x="436" y="206" font-size="10.5" fill="#66413b">Não tem acesso à página, ao mapa,</text>
    <text x="436" y="222" font-size="10.5" fill="#66413b">ao localStorage nem a require/process.</text>

    <g stroke="#3b2f22" stroke-width="1.4" fill="none" marker-end="url(#c)">
      <path d="M322 136 C370 120 380 100 432 90"/><path d="M432 150 C380 165 370 160 326 160"/>
    </g>
    <text x="345" y="100" font-size="10.5" fill="#3b2f22">sentidos (JSON)</text>
    <text x="340" y="188" font-size="10.5" fill="#3b2f22">ação (JSON)</text>
  </g>
</svg>'''

SVG_GA = '''
<svg viewBox="0 0 720 200" class="diagram" role="img" aria-label="Ciclo do algoritmo genético">
  <defs><marker id="d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b2f22"/></marker></defs>
  <g font-family="Inter" font-size="11.5" text-anchor="middle">
    <g fill="#fff" stroke="#c99a8a">
      <rect x="10" y="60" width="120" height="64" rx="8"/><rect x="155" y="60" width="120" height="64" rx="8"/>
      <rect x="300" y="60" width="120" height="64" rx="8"/><rect x="445" y="60" width="120" height="64" rx="8"/>
      <rect x="590" y="60" width="120" height="64" rx="8" fill="#eaf4ea" stroke="#8ac99a"/>
    </g>
    <g font-weight="700" fill="#4b2a22"><text x="70" y="86">População</text><text x="215" y="86">Avaliação</text><text x="360" y="86">Seleção</text><text x="505" y="86">Reprodução</text><text x="650" y="86" fill="#22472b">Validação</text></g>
    <g font-size="10" fill="#66413b">
      <text x="70" y="104">N genomas</text><text x="70" y="117">(11 pesos cada)</text>
      <text x="215" y="104">todos jogam os</text><text x="215" y="117">mesmos M mapas</text>
      <text x="360" y="104">2 melhores passam;</text><text x="360" y="117">torneio de 3</text>
      <text x="505" y="104">cruzamento +</text><text x="505" y="117">mutação gaussiana</text>
      <text x="650" y="104" fill="#3b5e43">top 5 em 3M mapas</text><text x="650" y="117" fill="#3b5e43">novos (só no fim)</text>
    </g>
    <g stroke="#3b2f22" stroke-width="1.4" fill="none" marker-end="url(#d)">
      <path d="M130 92H151"/><path d="M275 92H296"/><path d="M420 92H441"/>
      <path d="M505 124 C505 175 70 175 70 128"/><path d="M565 72 C580 40 600 40 612 58" stroke-dasharray="4 3"/>
    </g>
    <text x="290" y="190" font-size="10.5" fill="#66413b">repete por G gerações</text>
    <text x="600" y="34" font-size="10" fill="#3b5e43">última geração</text>
  </g>
</svg>'''

# ---------------------------------------------------------------- Conteúdo

L = lambda p: f'<code>{p}</code> ({lines_of(p)} linhas)'

section('1', 'Antes de começar', f'''
<p class="lead">Este documento explica o <b>Wumpus 3D</b> inteiro, do zero, para quem vai reimplementá-lo. Ele assume que você sabe o básico de JavaScript (variáveis, funções, objetos, arrays) e de HTML/CSS. Todo o resto (TypeScript, Three.js, Web Workers, inferência lógica, probabilidade, algoritmos genéticos) é explicado aqui, no ponto em que aparece.</p>

<h2>Como ler este documento</h2>
<ul>
<li><b>Capítulos 2 a 4</b> dão a visão geral: o que é o jogo, que tecnologias foram escolhidas e por quê, e como as peças se encaixam. Leia antes de abrir o código.</li>
<li><b>Capítulos 5 a 11</b> descrevem cada arquivo: o que ele faz, o que implementa, como funciona por dentro, que decisões foram tomadas e o que ele <i>não</i> faz.</li>
<li><b>Capítulo 12</b> é um roteiro de reimplementação em etapas, cada uma com um critério de "pronto".</li>
<li><b>Capítulos 13 e 14</b> mostram como o projeto foi verificado e quais são as limitações conhecidas.</li>
<li>O <b>glossário</b> no fim explica os termos técnicos.</li>
</ul>

<h2>Convenções</h2>
<p>Os trechos de código são copiados automaticamente dos arquivos do projeto (versão <code>{COMMIT}</code>), com o número das linhas. Ao longo do texto aparecem quatro tipos de destaque:</p>
{box('decision', 'Decisão', '<p>Por que algo foi feito de um jeito e não de outro.</p>')}
{box('notdo', 'O que não faz', '<p>Limites intencionais ou conhecidos daquele módulo.</p>')}
{box('trap', 'Armadilha comum', '<p>Erros que um dev júnior costuma cometer ao reimplementar aquela parte.</p>')}
{box('tip', 'Dica', '<p>Atalhos e formas de testar.</p>')}
''')

section('2', 'O jogo', f'''
<p>O <b>Mundo de Wumpus</b> é um problema clássico de inteligência artificial, do livro <i>Artificial Intelligence: A Modern Approach</i> (Russell e Norvig, o "AIMA"). Ele é usado para ensinar agentes que raciocinam com informação incompleta. Este projeto transforma o problema num jogo 3D no navegador, em que você pode jogar ou assistir agentes jogando.</p>

{img('principal.png', 'Tela principal: o agente probabilístico explorando um mapa 6×6. Os discos no piso mostram o que ele acredita sobre cada sala.')}

<h2>Regras</h2>
<ul>
<li>A caverna é uma grade de N×N salas (4×4 no clássico; aqui de 4×4 a 10×10). O jogador começa na sala (1, 1), a <b>entrada</b>, virado para o leste.</li>
<li>Cada sala, exceto a entrada, pode ter um <b>poço</b> (chance configurável, 20% no clássico). Cair num poço mata.</li>
<li>Existe um <b>Wumpus</b>, um monstro parado numa sala. Entrar na sala dele (vivo) mata. O jogador tem <b>uma flecha</b>, que voa em linha reta até a parede e mata o Wumpus se passar pela sala dele.</li>
<li>Existe um <b>ouro</b> numa sala. O objetivo é pegá-lo e <b>voltar à entrada</b>. Só isso é vitória: voltar à entrada sem o ouro não encerra a partida.</li>
<li>O jogador não vê o mapa. Ele só sente <b>percepções</b> na sala onde está.</li>
</ul>

{table(['Percepção', 'Quando acontece'], [
    ['Fedor (<i>stench</i>)', 'O Wumpus está numa sala vizinha (ou na mesma). Continua mesmo depois de ele morrer.'],
    ['Brisa (<i>breeze</i>)', 'Existe poço numa sala vizinha.'],
    ['Brilho (<i>glitter</i>)', 'O ouro está nesta sala.'],
    ['Batida (<i>bump</i>)', 'A última ação foi andar contra a parede.'],
    ['Grito (<i>scream</i>)', 'A flecha acabou de matar o Wumpus.'],
])}
<p>"Vizinha" quer dizer as quatro salas ao norte, sul, leste e oeste (não conta diagonal).</p>

<h2>Ações e pontuação</h2>
{table(['Ação', 'O que faz', 'Pontos'], [
    ['<code>forward</code>', 'Anda uma sala para a frente (ou bate na parede)', '−1'],
    ['<code>left</code> / <code>right</code>', 'Gira 90° sem sair do lugar', '−1'],
    ['<code>shoot</code>', 'Atira a flecha na direção em que está virado', '−1 e −10; +25 se matar o Wumpus'],
    ['<code>grab</code>', 'Pega o ouro, se ele estiver na sala', '−1 e +1000 se pegou'],
    ['(automático)', 'Chegar à entrada carregando o ouro', '+500 e vitória'],
    ['(automático)', 'Entrar num poço ou na sala do Wumpus vivo', '−1000 e derrota'],
])}
<p>A partida também termina por <b>tempo esgotado</b> depois de <code>tamanho × tamanho × 20</code> ações (320 num 4×4). Sem esse limite, um agente sem saída poderia andar para sempre.</p>

{box('decision', 'Três mudanças em relação ao livro', '''<p>No AIMA existe uma ação <code>climb</code> (sair da caverna), e o +1000 só entra ao sair com o ouro. Aqui:</p>
<ol><li>Não existe <code>climb</code>. A vitória é automática ao chegar à entrada com o ouro, e voltar sem ele não encerra a partida (pedido do dono do projeto). Por isso os agentes não podem "desistir", e o limite de ações passou a ser necessário.</li>
<li>Os pontos foram divididos: +1000 ao pegar o ouro e +500 ao voltar com ele, para o jogador ver que pegar o ouro valeu algo.</li>
<li>Matar o Wumpus dá +25 (no livro, nada). O valor é pequeno de propósito: o tiro certeiro rende +14 líquidos, mas um tiro às cegas da entrada tem valor esperado negativo mesmo no mapa 3×3 (acerta 2 de 8 salas: 25% × 25 = 6,25 &lt; 11), e nenhum desvio arriscado para caçar o Wumpus compensa perto dos 1500 pontos do ouro.</li></ol>''')}

<h2>O que mais o projeto oferece</h2>
<ul>
<li><b>Quatro agentes embutidos</b>: aleatório, lógico, probabilístico (bayesiano) e genético.</li>
<li><b>Mapas salvos</b>: salvar no navegador, repetir o mesmo mapa com outro jogador, exportar e importar em JSON.</li>
<li><b>Treino do agente genético</b> na própria tela, com gráfico.</li>
<li><b>Arena</b>: outros devs escrevem agentes num arquivo <code>.js</code>, importam e competem num ranking que mede pontos, eficiência e qualidade do raciocínio. A mesma arena roda na linha de comando e no GitHub Actions.</li>
</ul>
''')

section('3', 'Tecnologias e decisões de arquitetura', f'''
<h2>A pilha</h2>
{table(['Peça', 'Escolha', 'Para quê'], [
    ['Linguagem', 'TypeScript', 'JavaScript com tipos: o editor avisa erros antes de rodar.'],
    ['3D', 'Three.js', 'Biblioteca que esconde a complexidade do WebGL (a API 3D do navegador).'],
    ['Build', 'Vite', 'Servidor de desenvolvimento com recarga instantânea e empacotamento para produção.'],
    ['Interface', 'HTML + CSS + DOM puro', 'Sem React ou outro framework.'],
    ['Persistência', '<code>localStorage</code>', 'Guardar mapas, genoma e agentes no navegador.'],
    ['Hospedagem', 'GitHub Pages (ou qualquer site estático)', 'O resultado do build é só HTML, CSS e JS.'],
])}

{box('decision', 'Por que Three.js e não Unity, Godot ou Babylon.js', '''<p>O jogo é uma grade simples com poucos objetos. Unity e Godot exportam para a web, mas geram pacotes de 10 a 40 MB e demoram a carregar. Babylon.js é um motor completo (física, GUI), mais pesado do que o necessário. O Three.js deixa o site com ~160 KB compactados e roda em qualquer navegador moderno.</p>''')}

{box('decision', 'Por que TypeScript e não JavaScript puro', '''<p>O projeto tem muitos objetos com formato fixo (percepções, decisões, mapas, estatísticas). Com tipos, se você esquecer um campo ou escrever <code>breze</code> em vez de <code>breeze</code>, o erro aparece no editor. Os agentes externos, por outro lado, são JavaScript puro, para qualquer dev conseguir escrever um sem instalar nada.</p>''')}

{box('decision', 'Por que não usar React', '''<p>A interface é pequena: placares, um painel e uma tela de Arena. O DOM puro resolve sem dependência extra e sem passo de compilação de JSX. A contrapartida é que <code>main.ts</code> atualiza a tela "à mão" em <code>updateHud()</code>. Se a interface crescer muito, vale migrar.</p>''')}

<h2>Configuração do TypeScript</h2>
<p>O <code>tsconfig.json</code> veio do modelo do Vite e tem três opções que afetam como o código é escrito:</p>
<ul>
<li><code>noUnusedLocals</code> e <code>noUnusedParameters</code>: variável ou parâmetro sem uso é erro. Mantém o código limpo.</li>
<li><code>erasableSyntaxOnly</code>: só permite sintaxe TypeScript que some ao tirar os tipos. Na prática: <b>sem <code>enum</code></b> (use uniões de strings, como <code>'won' | 'dead-pit'</code>) e <b>sem "parameter properties"</b> (<code>constructor(private x: number)</code>). Por isso as classes declaram campos e atribuem no construtor.</li>
<li><code>verbatimModuleSyntax</code>: importações só de tipo precisam de <code>import type</code> (ou <code>type</code> dentro das chaves).</li>
</ul>

<h2>A regra de ouro da arquitetura</h2>
<p><b>As regras do jogo não sabem que existe 3D, tela ou agente.</b> O arquivo <code>src/game/world.ts</code> é TypeScript puro: recebe ações e devolve o novo estado. Isso permite:</p>
<ul><li>rodar milhares de partidas sem desenhar nada (avaliação, treino genético, arena);</li>
<li>rodar as mesmas regras no Node (linha de comando, GitHub Actions) e num Web Worker;</li>
<li>trocar o visual inteiro sem tocar nas regras.</li></ul>

{SVG_ARCH}
''')

section('4', 'Estrutura do projeto e como rodar', f'''
<h2>Rodando</h2>
<p>Pré-requisito: Node.js 20 ou superior.</p>
{code("""npm install          # instala dependências (uma vez)
npm run dev          # servidor de desenvolvimento em http://localhost:5173
npm run build        # gera a versão final em dist/ (tsc verifica os tipos antes)
npm run preview      # serve dist/ para testar a versão final
npm run arena        # competição de agentes na linha de comando""", 'Terminal')}

<h2>Arquivos</h2>
{table(['Arquivo', 'Linhas', 'Responsabilidade'], [
    ['<code>index.html</code>', lines_of('index.html'), 'Toda a estrutura da página: área 3D, placares, botões, painel, tela da Arena.'],
    ['<code>src/style.css</code>', lines_of('src/style.css'), 'Layout e aparência. Tema escuro único.'],
    ['<code>src/main.ts</code>', lines_of('src/main.ts'), 'Ponto de entrada: estado da partida, eventos, laço de animação.'],
    ['<code>src/game/world.ts</code>', lines_of('src/game/world.ts'), 'Regras do jogo, geração e validação de mapas.'],
    ['<code>src/render/view.ts</code>', lines_of('src/render/view.ts'), 'Cena 3D com Three.js.'],
    ['<code>src/agents/knowledge.ts</code>', lines_of('src/agents/knowledge.ts'), 'Base de conhecimento: deduções lógicas e probabilidades.'],
    ['<code>src/agents/agents.ts</code>', lines_of('src/agents/agents.ts'), 'Agentes aleatório, lógico, probabilístico e genético.'],
    ['<code>src/agents/genome.ts</code>', lines_of('src/agents/genome.ts'), 'Genes e genoma padrão do agente genético.'],
    ['<code>src/agents/genetic.ts</code>', lines_of('src/agents/genetic.ts'), 'Algoritmo genético.'],
    ['<code>src/agents/ga.worker.ts</code>', lines_of('src/agents/ga.worker.ts'), 'Roda o treino genético em segundo plano.'],
    ['<code>src/agents/benchmark.ts</code>', lines_of('src/agents/benchmark.ts'), 'Partidas rápidas sem 3D (usado pelo treino).'],
    ['<code>src/arena/protocol.ts</code>', lines_of('src/arena/protocol.ts'), 'Contrato com agentes externos.'],
    ['<code>src/arena/sandbox.ts</code>', lines_of('src/arena/sandbox.ts'), 'Isola agentes externos num Web Worker.'],
    ['<code>src/arena/runner.ts</code>', lines_of('src/arena/runner.ts'), 'Executa uma partida da arena.'],
    ['<code>src/arena/referee.ts</code>', lines_of('src/arena/referee.ts'), 'Árbitro: mede a qualidade do raciocínio.'],
    ['<code>src/arena/ranking.ts</code>', lines_of('src/arena/ranking.ts'), 'Estatísticas e ordenação.'],
    ['<code>src/arena/rng.ts</code>', lines_of('src/arena/rng.ts'), 'Sorteio reproduzível por semente.'],
    ['<code>src/arena/ui.ts</code>', lines_of('src/arena/ui.ts'), 'Tela da Arena.'],
    ['<code>src/report/report.ts</code>', lines_of('src/report/report.ts'), 'Relatórios: modelo de dados, leitura e séries acumuladas.'],
    ['<code>src/report/charts.ts</code>', lines_of('src/report/charts.ts'), 'Gráficos SVG dos relatórios e dicas ao passar o mouse.'],
    ['<code>src/report/html.ts</code>', lines_of('src/report/html.ts'), 'Tabelas e gráficos em HTML; arquivo de relatório exportado.'],
    ['<code>src/report/human.ts</code>', lines_of('src/report/human.ts'), 'Partidas humanas: o que conta, desafio por semente, relatório e comparação com os agentes.'],
    ['<code>src/report/ui.ts</code>', lines_of('src/report/ui.ts'), 'Tela de Análise de relatórios e downloads.'],
    ['<code>src/storage.ts</code>', lines_of('src/storage.ts'), 'Leitura e escrita no <code>localStorage</code>.'],
    ['<code>scripts/arena.ts</code>', lines_of('scripts/arena.ts'), 'Arena na linha de comando.'],
    ['<code>scripts/treinar.ts</code>, <code>scripts/medir.ts</code>', lines_of('scripts/treinar.ts') + lines_of('scripts/medir.ts'), 'Treino do agente genético e tabela de desempenho na linha de comando.'],
    ['<code>agents/exemplo-cauteloso.js</code>', lines_of('agents/exemplo-cauteloso.js'), 'Agente de exemplo para outros devs.'],
    ['<code>vite.config.ts</code>', lines_of('vite.config.ts'), 'Configuração do build.'],
    ['<code>tests/*.test.ts</code>', sum(lines_of(f'tests/{n}.test.ts') for n in ['world', 'knowledge', 'arena', 'report', 'genetic', 'human']), 'Testes automatizados (Vitest).'],
    ['<code>scripts/docs/</code>', '—', 'Geradores destes PDFs.'],
    ['<code>CLAUDE.md</code>, <code>.claude/</code>, <code>docs/contexto/</code>', '—', 'Memória do projeto para o Claude (resumo, skills, subagente, histórico e decisões).'],
    ['<code>.github/workflows/*.yml</code>', lines_of('.github/workflows/deploy.yml') + lines_of('.github/workflows/arena.yml'), 'Publicação no GitHub Pages e arena em pull requests.'],
], 'files')}

<h2>Configuração do Vite</h2>
{snip('vite.config.ts', 'import', '});')}
<p><code>base: './'</code> faz o HTML gerado usar caminhos relativos (<code>./assets/...</code>). Sem isso, no GitHub Pages o site fica em <code>/nome-do-repo/</code> e os arquivos não carregam.</p>
''')

section('5', 'Regras do jogo — src/game/world.ts', f'''
<p class="lead">O coração do projeto. Tudo o que é regra está aqui, e nada mais. {L('src/game/world.ts')}</p>

<h2>Coordenadas e direções</h2>
{SVG_GRID}
{snip('src/game/world.ts', 'export type Dir', 'DIR_NAME')}
{box('trap', 'Armadilha comum', '<p>Misturar as duas numerações. O código, o <code>key()</code> e a API dos agentes usam <b>0</b> para a entrada. A tela e o arquivo de mapa usam <b>1</b>. A conversão acontece só em três lugares: nos textos de mensagem (<code>+ 1</code>), em <code>toLayout()</code> e no construtor quando recebe um <code>layout</code>.</p>')}

<h2>Tipos principais</h2>
{snip('src/game/world.ts', 'export type Action', 'export const key')}
<p><code>key(x, y)</code> transforma uma posição na string <code>"x,y"</code>. Ela é usada como chave de <code>Set</code> e <code>Map</code>, porque em JavaScript dois objetos <code>{{x: 1, y: 2}}</code> diferentes nunca são "iguais" para um <code>Set</code>, mas duas strings <code>"1,2"</code> são.</p>

<h2>Gerando um mapa</h2>
<p>O construtor sorteia um mapa até achar um em que <b>seja possível vencer</b>:</p>
{snip('src/game/world.ts', '// Número fixo de poços, em salas sorteadas sem repetir', '    this.percepts = this.sense();', label='src/game/world.ts — construtor')}
<ol>
<li>O número de poços é fixo: <code>pitCountFor(tamanho, porcentagem)</code> = porcentagem × total de casas, arredondado (3 no 4×4 com 20%), com mínimo de 1. Eles vão para salas sorteadas sem repetição (embaralhamento de Fisher–Yates parcial), nunca na entrada.</li>
<li>O Wumpus vai para uma sala sem poço, fora da entrada.</li>
<li>O ouro vai para uma sala sem poço, fora da entrada. Pode ser a mesma sala do Wumpus: aí é obrigatório matá-lo antes de pegar o ouro.</li>
<li>Uma busca em largura (BFS, explicada no capítulo 7) confere se existe caminho da entrada até o ouro sem pisar em poço. O Wumpus não bloqueia, porque pode ser morto com a flecha.</li>
<li>Se alguma condição falha, sorteia de novo.</li>
</ol>
{box('decision', 'Por que sortear de novo em vez de aceitar qualquer mapa', '<p>Com as regras do livro, cerca de 26% dos mapas 4×4 eram impossíveis de vencer (ouro dentro de poço, junto do Wumpus ou cercado por poços). Medimos isso em 10.000 mapas. Para um jogo isso é frustrante, então só mapas vencíveis são aceitos. Repare que isso muda levemente as probabilidades reais em relação ao que os agentes supõem (veja o capítulo 14).</p>')}
{box('decision', 'Por que um número fixo de poços', '<p>Com uma chance independente por sala, cerca de 4% dos mapas 4×4 saíam sem nenhum poço. O dono do projeto pediu que a porcentagem valesse sobre o total de casas, com pelo menos 3 poços no 4×4. O número exato <b>não é passado aos agentes</b>: eles recebem só a porcentagem e continuam supondo poços independentes com essa chance.</p>')}
<p>O parâmetro <code>rng</code> é a função de sorteio. Por padrão é <code>Math.random</code>, mas a Arena passa um sorteador com semente, para gerar sempre os mesmos mapas (capítulo 9).</p>

<h2>Um passo do jogo: <code>step()</code></h2>
<p><code>step(action)</code> é a única forma de mudar o estado. Ele cobra o ponto da ação, aplica a regra e recalcula as percepções. Veja o trecho de <code>forward</code>, que concentra as regras de morte e de vitória:</p>
{snip('src/game/world.ts', "case 'forward': {", "case 'shoot'", label='src/game/world.ts — step(), ação forward', exclusive=True)}
<p>O tiro percorre a linha até a parede e para no Wumpus se o encontrar. O resultado traz <code>arrow</code> com origem e destino, para a parte 3D animar a flecha. No fim de todo passo, o limite de ações é conferido.</p>
{box('notdo', 'O que world.ts não faz', '<ul><li>Não desenha nada e não lê teclado.</li><li>Não sabe quem está jogando (pessoa ou agente).</li><li>Não guarda histórico de ações (só o contador <code>actions</code>).</li><li>Não esconde nada: quem tem o objeto <code>WumpusWorld</code> vê o mapa inteiro. Por isso os agentes nunca recebem o objeto, só as percepções.</li></ul>')}

<h2>Mapas salvos: <code>MapLayout</code></h2>
<p>Um mapa é descrito por um objeto simples, que vira JSON para salvar, exportar e importar:</p>
{code("""{
  "format": "wumpus3d-map",
  "version": 1,
  "name": "Caverna da prova",
  "size": 4,
  "pitProbability": 0.2,
  "pits": [[3, 1], [3, 3], [4, 4]],
  "wumpus": [1, 3],
  "gold": [2, 3]
}""", 'Exemplo de arquivo de mapa (coordenadas começando em 1)')}
<p><code>toLayout()</code> gera esse objeto a partir de uma partida, usando a posição <b>inicial</b> do ouro (<code>goldStart</code>), já que <code>gold</code> vira <code>null</code> quando é pego. <code>WumpusWorld.fromLayout()</code> faz o caminho inverso.</p>
<p><code>parseLayout(json)</code> valida um JSON vindo de fora e lança um <code>Error</code> com uma mensagem em português explicando o problema:</p>
{snip('src/game/world.ts', 'const cell = (c: unknown, what: string)', "if (pits.some(([x, y]) => x === gold[0] && y === gold[1]))")}
{box('trap', 'Armadilha comum', '<p>Confiar no JSON importado. Um arquivo pode ter qualquer coisa: tamanho 1000, coordenadas negativas, texto no lugar de números. Valide tudo antes de criar o mundo. <code>parseLayout</code> também é usado ao ler o <code>localStorage</code>, porque o armazenamento pode ter sido alterado ou corrompido.</p>')}
''')

section('6', 'A parte 3D — src/render/view.ts', f'''
<p class="lead">A classe <code>WorldView</code> lê o estado de um <code>WumpusWorld</code> e o desenha com Three.js. Ela nunca muda as regras. {L('src/render/view.ts')}</p>

<h2>Conceitos de Three.js que você precisa</h2>
{table(['Conceito', 'O que é'], [
    ['<code>Scene</code>', 'O "palco": a lista de tudo que existe no mundo 3D.'],
    ['<code>PerspectiveCamera</code>', 'De onde e para onde olhamos.'],
    ['<code>WebGLRenderer</code>', 'Desenha a cena vista pela câmera num <code>&lt;canvas&gt;</code>.'],
    ['<code>Mesh</code>', 'Um objeto visível = geometria (forma) + material (cor, brilho).'],
    ['<code>Group</code>', 'Junta vários objetos para mover ou apagar todos juntos.'],
    ['Luzes', '<code>HemisphereLight</code> ilumina tudo de leve; <code>PointLight</code> é uma lâmpada num ponto (a tocha do agente, o brilho do ouro).'],
    ['<code>Fog</code>', 'Névoa: objetos distantes somem no escuro, o que dá clima de caverna.'],
    ['<code>Sprite</code>', 'Imagem 2D que sempre fica de frente para a câmera (usada nos rótulos "Poço 20%").'],
])}

<h2>Do grid para o 3D</h2>
{snip('src/render/view.ts', 'const TILE = 2', 'const DIR_YAW')}
<p>Cada sala ocupa 2×2 unidades. O norte do jogo vira o eixo −Z do Three.js, porque a câmera padrão olha para −Z: assim o norte fica "para dentro" da tela.</p>

<h2>O ciclo de vida da cena</h2>
<ol>
<li><b><code>constructor(container)</code></b>: cria renderizador, cena, névoa e luz ambiente. Usa um <code>ResizeObserver</code> para ajustar o tamanho do canvas sempre que a área do mapa muda (a janela ou o painel lateral abrindo e fechando).</li>
<li><b><code>load(world)</code></b>: apaga tudo e constrói a caverna: piso, paredes, poços, Wumpus, ouro, agente e partículas. É chamado a cada partida nova.</li>
<li><b><code>sync()</code></b>: depois de cada ação, decide o que está visível. Salas não visitadas ficam escuras; poços, Wumpus e ouro só aparecem quando a sala foi visitada (ou no fim do jogo, ou com "Mapa" ligado).</li>
<li><b><code>frame()</code></b>: chamado cerca de 60 vezes por segundo. Só anima: aproxima o agente da sala atual, gira, faz a tocha tremular, gira o ouro, move partículas, anda com a flecha e com a câmera.</li>
</ol>

<h2>Movimento suave sem mexer nas regras</h2>
<p>O estado do jogo muda de uma vez (o agente "teleporta" de uma sala para a outra). O 3D esconde isso com interpolação: a cada frame, o modelo anda uma fração da distância até onde deveria estar.</p>
{snip('src/render/view.ts', '// Movimento suave do agente até a sala atual', 'this.agent.rotation.y = this.agentYaw;')}
<p><code>1 - Math.exp(-dt * 12)</code> dá uma fração que não depende da taxa de quadros: num computador rápido ou lento, o movimento leva o mesmo tempo. As linhas com <code>while</code> escolhem o caminho de giro mais curto (girar 90° em vez de 270°).</p>

<h2>Mostrando o raciocínio do agente</h2>
<p><code>showBeliefs(mapa)</code> recebe, para cada sala, a probabilidade de poço e de Wumpus, e desenha um disco colorido (verde = segura, amarelo a vermelho = risco) com um rótulo. O rótulo é texto desenhado num <code>&lt;canvas&gt;</code> 2D e usado como textura de um <code>Sprite</code>.</p>
{box('decision', 'Por que a câmera não gira com o agente', '<p>A câmera segue o agente por trás e de cima, mas sempre do lado sul. Se ela girasse junto, "esquerda" e "direita" na tela mudariam a cada giro, e fica difícil se orientar num grid. A tecla V alterna para a visão geral do mapa inteiro.</p>')}
{box('notdo', 'O que view.ts não faz', '<ul><li>Não usa modelos 3D externos (.glb): tudo é feito com formas básicas (cápsula, esfera, cone, octaedro). Isso evita arquivos extras e mantém o site leve.</li><li>Não tem som nem sombras (sombras foram removidas porque a tocha criava uma mancha preta sob o agente).</li><li>Não libera a memória de vídeo das geometrias antigas ao recomeçar (veja o capítulo 14).</li></ul>')}
''')

section('7', 'Inteligência — base de conhecimento (src/agents/knowledge.ts)', f'''
<p class="lead">A classe <code>Knowledge</code> guarda o que o agente <b>sentiu</b> e deduz o que dá para saber a partir disso. Ela é usada pelos agentes lógico, probabilístico e genético, e também pelo árbitro da Arena. {L('src/agents/knowledge.ts')}</p>

<h2>O que ela guarda</h2>
<ul>
<li><code>visited</code>: para cada sala visitada, se havia brisa e fedor.</li>
<li><code>wumpusDead</code>: se já ouviu o grito.</li>
<li><code>noWumpus</code>: salas por onde uma flecha passou sem acertar (logo, sem Wumpus).</li>
</ul>
<p>Ela <b>não</b> guarda o mapa: é exatamente o que um jogador humano anotaria num papel.</p>

<h2>Dedução 1: sala sem poço</h2>
{snip('src/agents/knowledge.ts', '/** Sem poço:', '  }')}
<p>Se eu estive numa sala e <i>não</i> senti brisa, nenhuma vizinha dela tem poço. Se eu estive na sala, ela também não tem (eu estaria morto).</p>

<h2>Dedução 2: onde o Wumpus pode estar</h2>
{snip('src/agents/knowledge.ts', 'wumpusCandidates(): Set<string> {', '/** Salas que com certeza', label='src/agents/knowledge.ts — wumpusCandidates()', exclusive=True)}
<p>Uma sala só é candidata se for consistente com <b>tudo</b> que foi sentido: não visitada, não limpa por flecha, não vizinha de sala sem fedor, vizinha de <b>todas</b> as salas com fedor (existe um só Wumpus, então ele precisa explicar todos os fedores) e sem poço deduzido (pela regra do jogo, o Wumpus nunca fica num poço). Se sobrar uma única candidata, o agente sabe onde o Wumpus está.</p>

<h2>Dedução 3: poço certo</h2>
<p><code>certainPits()</code>: se uma sala tem brisa e só <b>uma</b> vizinha ainda pode ter poço, o poço está nessa vizinha.</p>
<p>Juntando tudo: <code>safe(k)</code> = sem poço <b>e</b> fora das candidatas a Wumpus.</p>

<h2>Probabilidade de poço (inferência bayesiana)</h2>
<p>Quando nada é garantidamente seguro, o agente probabilístico precisa de números. A ideia, do capítulo 12 do AIMA:</p>
<ol>
<li>Pegue a <b>fronteira</b>: salas desconhecidas vizinhas de salas visitadas.</li>
<li>Liste todas as combinações possíveis de poços nessas salas (com 3 salas: 2<sup>3</sup> = 8 combinações).</li>
<li>Descarte as combinações que não explicam alguma brisa sentida.</li>
<li>Dê a cada combinação um peso: p<sup>k</sup>(1−p)<sup>n−k</sup>, em que <i>k</i> é o número de poços nela e <i>p</i> é a chance de poço por sala.</li>
<li>A probabilidade de poço numa sala é: soma dos pesos das combinações com poço nela ÷ soma de todos os pesos.</li>
</ol>
{box('tip', 'Exemplo para fazer no papel', '''<p>Você está em (1,1) após visitar (1,1) e (2,1), e sentiu brisa só em (2,1). A fronteira é A = (3,1) e B = (2,2) (a sala (1,2) é segura porque (1,1) não tinha brisa). Com p = 0,2, as combinações que explicam a brisa são: só A (0,2×0,8 = 0,16), só B (0,16) e A e B (0,04). Total = 0,36. P(poço em A) = (0,16 + 0,04) ÷ 0,36 ≈ <b>56%</b>. É exatamente o "Poço 56%" que aparece no jogo nessa situação.</p>''')}
{snip('src/agents/knowledge.ts', 'if (frontier.length <= MAX_ENUMERATION) {', '    } else {')}
<p>O laço usa <b>máscaras de bits</b>: cada combinação é um número inteiro, e o bit <i>i</i> ligado significa "poço na sala <i>i</i> da fronteira". <code>combo & m</code> testa se alguma sala vizinha da brisa tem poço naquela combinação.</p>
{box('decision', 'Limite de 16 salas na fronteira', '<p>O número de combinações dobra a cada sala: 16 salas são 65.536 combinações, 25 seriam 33 milhões. Acima de 16 o código usa uma estimativa simples (1 ÷ número de vizinhas desconhecidas de cada brisa). Isso só acontece em mapas grandes e é uma aproximação, não o valor exato.</p>')}
<h2>Probabilidade do Wumpus e risco da sala</h2>
<p>O Wumpus é sorteado entre as salas <b>sem poço</b>. Por isso, entre as candidatas, a chance de ele estar numa sala é proporcional à chance de ela <i>não</i> ter poço: P(Wumpus em c) = (1 − P(poço em c)) ÷ soma de (1 − P(poço)) das candidatas. Com as candidatas igualmente arriscadas, isso dá 1 ÷ número de candidatas.</p>
<p>O risco de entrar numa sala é a chance de morrer lá: <code>riskOf(b) = P(poço) + P(Wumpus)</code>. Os dois eventos se <b>excluem</b> (nunca estão na mesma sala), então as probabilidades se somam.</p>
{snip('src/agents/knowledge.ts', 'export const riskOf', lines=1)}
{box('notdo', 'O que knowledge.ts não faz', '<ul><li>A probabilidade do Wumpus usa as probabilidades de poço sala a sala, sem enumerar poços e Wumpus juntos. É uma aproximação: a correlação entre as salas da fronteira não entra nessa conta.</li><li>Ela não sabe que o gerador só aceita mapas vencíveis nem quantos poços o mapa tem; supõe poços independentes com a porcentagem configurada.</li><li>Ela não lembra a ordem das visitas, só o resultado.</li></ul>')}
''')

section('8', 'Inteligência — os agentes', f'''
<p class="lead">{L('src/agents/agents.ts')}, mais {L('src/agents/genome.ts')}, {L('src/agents/genetic.ts')}, {L('src/agents/ga.worker.ts')} e {L('src/agents/benchmark.ts')}.</p>

<h2>A interface de um agente embutido</h2>
{snip('src/agents/agents.ts', 'export interface Senses {', 'export type AgentId')}
<p>Um agente recebe <code>Senses</code> (posição, direção, se tem flecha e ouro, e as percepções) e devolve uma <code>Action</code>. <code>thought</code> é uma frase para mostrar na tela, e <code>beliefs()</code> alimenta os discos coloridos no piso.</p>

<h2>Busca em largura (BFS): como os agentes acham caminhos</h2>
<p>Quase toda decisão vira "ir até uma sala". A BFS explora a partir da posição atual, primeiro todas as salas a 1 passo, depois a 2, e assim por diante, guardando de onde veio cada uma. A primeira sala-alvo encontrada é a mais próxima, e o caminho é reconstruído voltando pelos "de onde veio".</p>
{snip('src/agents/agents.ts', '/** Busca em largura:', '/** Converte o próximo passo', label='src/agents/agents.ts — route()', exclusive=True)}
<p>O parâmetro <code>passable</code> diz por onde pode passar: só salas visitadas (o mais seguro), ou visitadas e comprovadamente seguras. O alvo em si pode ser uma sala arriscada.</p>

<h2>Agente aleatório</h2>
<p>Pega o ouro se sentir brilho; no resto escolhe <code>forward</code> (60%), <code>left</code> (20%) ou <code>right</code> (20%). Serve de base: qualquer agente que se diz inteligente precisa ganhar dele com folga.</p>

<h2>Agentes lógico e probabilístico (<code>ReasoningAgent</code>)</h2>
<p>Os dois são a mesma classe com <code>mode</code> diferente. A cada passo, em ordem de prioridade:</p>
{table(['#', 'Situação', 'O que faz'], [
    ['1', 'Sente brilho e não tem ouro', '<code>grab</code>'],
    ['2', 'Tem o ouro', 'Volta para a entrada pelas salas visitadas (a vitória é automática ao chegar)'],
    ['3', 'Existe sala segura não visitada', 'Vai até a mais próxima'],
    ['4', 'Tem flecha e no máximo 3 candidatas a Wumpus', 'Vai até uma sala alinhada com uma candidata, mira e atira'],
    ['5', 'Nenhuma sala segura', 'Lógico: a sala da fronteira com menos indícios (brisas e fedores ao lado). Probabilístico: a de menor risco P(poço) + P(Wumpus). Empate: a mais próxima'],
    ['6', 'Toda a fronteira é perigo certo', 'Gira no lugar até o limite de ações'],
])}
{box('decision', 'Por que o agente lógico também arrisca', '<p>Na versão do livro, o agente lógico desiste e sai da caverna quando não há sala segura. Como aqui não existe sair, ficar parado só levaria ao tempo esgotado. Então ele chuta, mas sem usar probabilidades: só conta indícios. Essa é a diferença que separa os dois agentes nos resultados.</p>')}
<p>Após um tiro, se não ouvir o grito, o agente marca as salas da linha do tiro como livres de Wumpus (<code>arrowMissed</code>).</p>

<h2>Lógico × probabilístico: fundamentação e diferença</h2>
<p>Os dois agentes seguem o mesmo roteiro do <b>agente híbrido</b> do capítulo 7 do AIMA: pegar o ouro e voltar; senão, ir para a sala segura mais próxima; senão, tentar matar o Wumpus; senão, arriscar uma sala que não seja perigo comprovado. Eles <b>sabem exatamente as mesmas coisas</b>, porque usam a mesma base de conhecimento. A diferença está só no passo 5, quando nenhuma sala é comprovadamente segura.</p>
{table(['', 'Agente lógico', 'Agente probabilístico'], [
    ['Base teórica', 'Lógica proposicional e inferência por verificação de modelos (AIMA, cap. 7).', 'Probabilidade e inferência por enumeração na fronteira (AIMA, cap. 12, seção 12.7), mais a escolha da ação de menor risco.'],
    ['O que conclui sobre uma sala', 'Três respostas: segura, perigo certo ou "não sei".', 'Um número: a chance de morrer ao entrar.'],
    ['Passo 5 (sem sala segura)', 'A lógica não ordena as salas "não sei". O agente usa uma regra prática: a sala com menos brisas e fedores ao redor; empate, a mais próxima.', 'A sala de menor P(poço) + P(Wumpus); empate, a mais próxima.'],
    ['Ponto forte', 'Simples e rápido; nunca entra num perigo comprovado.', 'Usa toda a evidência: percebe quando uma brisa já está "explicada" por outro poço.'],
    ['Ponto fraco', 'Contar indícios trata todas as brisas como iguais.', 'Supõe poços independentes com a porcentagem configurada, o que é só uma aproximação do sorteio real.'],
])}
<p><b>Por que as deduções são completas.</b> As pistas do jogo viram regras de um formato só: "pelo menos uma vizinha desta brisa tem poço" e "nenhuma vizinha desta sala sem brisa tem poço". Com regras assim, uma sala é poço em <b>todos</b> os modelos consistentes só quando é a única vizinha desconhecida de uma brisa, e é livre de poço em todos só quando é vizinha de uma sala sem brisa. As regras de <code>pitFree</code> e <code>certainPits</code> dão, portanto, o mesmo resultado que a verificação de modelos do livro, sem enumerar modelos.</p>
<h2>Um exemplo real em que eles divergem</h2>
<p>A situação abaixo aconteceu no mapa 2 da semente <code>exemplo</code> (4×4). O agente visitou (1,1), (1,2), (2,2) e (1,3) e sentiu brisa em (1,1), (2,2) e (1,3). Nenhuma sala desconhecida é segura.</p>
{exemplo_svg()}
<ul>
<li><b>(2,1) é poço certo</b>: a brisa de (1,1) só pode vir dela, porque (1,2) foi visitada.</li>
<li><b>(1,4) e (2,3)</b>: a brisa de (1,3) precisa de um poço numa delas. Pela enumeração, 56% cada.</li>
<li><b>(3,2)</b>: é vizinha da brisa de (2,2), mas essa brisa já está <b>explicada</b> pelo poço certo em (2,1). Então (3,2) fica com a chance a priori: 20%.</li>
<li><b>O agente lógico</b> conta 1 indício para (1,4) e 1 para (3,2), desempata pela distância e vai para (1,4): 56% de risco.</li>
<li><b>O agente probabilístico</b> vai para (3,2): 20% de risco. Esse efeito de "explicar" uma evidência por outra causa é justamente o que a contagem de indícios não capta.</li>
</ul>
<h2>Correções feitas nesta versão</h2>
{table(['O que mudou', 'Antes', 'Por quê'], [
    ['O Wumpus nunca é candidato numa sala com poço deduzido', 'Poço certo podia continuar candidato a Wumpus.', 'A regra do jogo (D16) proíbe Wumpus em poço; é uma dedução lógica válida para os dois agentes.'],
    ['P(Wumpus) proporcional à chance de a sala não ter poço', '1 ÷ número de candidatas, sempre.', 'O Wumpus é sorteado entre as salas sem poço.'],
    ['Risco = P(poço) + P(Wumpus)', '1 − (1 − P(poço))(1 − P(Wumpus)), que supõe eventos independentes.', 'Os dois eventos se excluem; a fórmula antiga subestimava o risco quando os dois eram altos.'],
    ['Empate no passo 5 decidido pela sala mais próxima', 'Empate decidido pela ordem fixa das salas.', 'O agente híbrido do livro planeja a rota mais curta; andar menos também custa menos pontos.'],
    ['Comentário do tiro corrigido', 'Dizia que só o agente lógico atirava sem certeza.', 'Os dois atiram com até 3 candidatas; o comentário estava errado.'],
])}
<p>Efeito medido (mesmos mapas, 5000 no 4×4): o lógico passou de 564 para 570 pontos de média e o probabilístico de 635 para 650. No 6×6 (1000 mapas), de 20 para 46 e de 174 para 182.</p>

<h2>Agente genético</h2>
<p>O <code>GeneticAgent</code> reaproveita a base de conhecimento e as regras 1 e 2, mas troca as regras 3 a 5 por uma <b>fórmula de pontuação</b>. Para cada sala candidata da fronteira, ele calcula 8 características e soma cada uma multiplicada por um peso. As duas primeiras são os termos da pontuação, como numa utilidade esperada: o risco de morrer (custa 1000) e a distância (cada passo custa 1).</p>
{snip('src/agents/agents.ts', 'const features = [', '];')}
<p>O agente vai para a sala de maior nota. Uma segunda fórmula, com 3 pesos (viés, certeza sobre o alvo e "ainda existe sala segura"), dá nota à opção de atirar. Os 11 pesos formam o <b>genoma</b>.</p>
{box('decision', 'Por que risco e distância como características (D19)', '<p>Na versão anterior, o genético pesava P(poço) e P(Wumpus) separadamente e precisava acertar a proporção entre os pesos para chegar à regra do probabilístico. Com o risco pronto, o <code>BAYES_LIKE_GENOME</code> (risco −5, distância −0,01) já se comporta como o probabilístico, e o treino parte desse nível para ajustar o resto.</p>')}
<p><b>Compromisso com o alvo.</b> Depois de escolher uma sala, o agente vai até ela e só refaz a escolha quando aprende algo novo: entrou numa sala nova, ouviu o grito ou errou o tiro. Sem isso, pesos que dependem da posição (distância, giros) mudavam a nota das salas a cada passo, e o agente trocava de alvo, voltava e trocava de novo, até o tempo esgotar. Com pesos treinados assim, uma Arena 6×6 chegou a 53% de tempo esgotado; o teste <code>tests/genetic.test.ts</code> garante que isso não volta.</p>
{box('decision', 'Por que evoluir pesos e não uma sequência de ações', '<p>Um algoritmo genético poderia evoluir uma lista fixa de ações ("frente, frente, esquerda...") para um mapa. Mas essa lista só funciona naquele mapa e, na prática, "decora" a resposta. Evoluindo os pesos de uma estratégia, o agente generaliza: joga qualquer mapa sem nunca vê-lo, só pelas percepções, igual aos outros agentes.</p>')}

<h2>O algoritmo genético (src/agents/genetic.ts)</h2>
{SVG_GA}
{img('genetico.png', 'Painel do agente genético: os 11 pesos do genoma padrão (verde = positivo, vermelho = negativo) e os controles de treino.', 'narrow')}
<ol>
<li><b>População</b>: N genomas com pesos aleatórios entre −5 e 5. O genoma atual entra na primeira posição, para o treino continuar de onde parou.</li>
<li><b>Avaliação</b>: cada genoma joga os <b>mesmos</b> M mapas sorteados naquela geração. A <b>aptidão</b> (fitness) é a pontuação média.</li>
<li><b>Elitismo</b>: os 2 melhores passam direto para a próxima geração.</li>
<li><b>Seleção por torneio</b>: para escolher um pai, sorteia 3 genomas e fica com o melhor.</li>
<li><b>Cruzamento aritmético</b>: cada peso do filho é um ponto entre os pesos dos pais (<code>pai × t + mãe × (1 − t)</code>, com t sorteado).</li>
<li><b>Mutação gaussiana</b>: cada peso tem 20% de chance de receber um ruído de desvio padrão 0,8.</li>
<li><b>Validação</b> (só no fim): os 5 melhores jogam 3×M mapas novos, e o vencedor dessa rodada é o resultado.</li>
</ol>
{snip('src/agents/genetic.ts', 'if (gen === opts.generations) {', '      return;')}
{box('decision', 'Por que a validação final existe', '<p>Na primeira versão, o melhor da última geração às vezes era só sortudo: com poucos mapas por geração, um genoma mediano pode ter tido mapas fáceis. O genoma "evoluído" chegou a ficar <b>pior</b> que o escrito à mão (725 contra 760 pontos). Validar os finalistas em mapas que eles nunca viram reduz esse efeito. É a mesma ideia de separar dados de treino e de teste em aprendizado de máquina.</p>')}
<p>O treino roda dentro de <code>ga.worker.ts</code>, um <b>Web Worker</b>: uma thread separada do navegador. Sem isso, a tela congelaria por segundos a cada geração. O <code>train()</code> é um <b>gerador</b> (<code>function*</code>) que entrega um relatório por geração (<code>yield</code>), e o worker repassa cada um para a tela desenhar o gráfico.</p>
<p>Leitura dos pesos: "Poço" −4,6, "Wumpus" −5 e "Segura" +3,4 dizem "fuja do risco, prefira o seguro"; "Tiro: certeza" +3,0 e "Tiro: há sala segura" −2,4 dizem "atire quando tiver certeza de onde está o Wumpus, e menos quando ainda houver sala segura para explorar". O algoritmo chegou sozinho a uma estratégia parecida com a do agente probabilístico.</p>

<h2>Resultados medidos</h2>
<p>Mesmos mapas para todos os agentes, 20% de poços (3 no 4×4, 7 no 6×6):</p>
{table(['Agente', '4×4 (5000 mapas)', '6×6 (1000 mapas)'], [
    ['Aleatório', '~4% de vitórias, −767 pts', '~2%, −854 pts'],
    ['Lógico', '63%, 570 pts', '43%, 46 pts'],
    ['Probabilístico', '67%, 650 pts', '48%, 182 pts'],
    ['Genético (genoma padrão)', '66%, 638 pts', '51%, 242 pts'],
])}
<p>Medido com o bônus de +25 por matar o Wumpus, número fixo de poços e o Wumpus fora dos poços. O genético empata com o probabilístico no 4×4 (diferença pareada de −12 pts, intervalo de 95% de −49 a +25) e tende a ficar à frente no 6×6 (+60 pts, intervalo de −18 a +138); nenhuma das diferenças é estatisticamente comprovada. Lotes de 200 a 1000 mapas variam bastante (todos os agentes ficam melhores ou piores juntos), por isso a tabela usa mais mapas.</p>
''')

section('9', 'A Arena de agentes (src/arena/)', f'''
<p class="lead">A Arena permite que outros devs escrevam agentes, importem e disputem um ranking justo. Ela tem quatro problemas para resolver: um contrato simples, isolamento contra trapaça, mapas iguais para todos e métricas que meçam mais do que sorte.</p>

<h2>1. O contrato (protocol.ts)</h2>
<p>Um agente externo é um arquivo JavaScript que chama <code>registerAgent</code>:</p>
{snip('agents/exemplo-cauteloso.js', 'registerAgent({', 'create(info) {')}
<p><code>create(info)</code> roda no início de cada partida e devolve um objeto com <code>decide(sentidos)</code>, chamado a cada passo. <code>decide</code> devolve uma ação, ou <code>{{ action, thought, beliefs }}</code> para mostrar o raciocínio. O guia completo para devs está em <code>AGENTES.md</code>.</p>
<p>O arquivo do dev é "embrulhado" por um código fixo (o <b>harness</b>), que define <code>registerAgent</code> antes e as funções <code>__start</code> e <code>__decide</code> depois:</p>
{snip('src/arena/protocol.ts', 'export const HARNESS_BEFORE', '`;')}
<p>Tudo que o agente devolve passa por <code>normalizeDecision()</code>, que confere se a ação existe e limpa o resto (textos cortados em 300 caracteres, probabilidades entre 0 e 1, coordenadas dentro do mapa).</p>

<h2>2. Isolamento (sandbox.ts e scripts/arena.ts)</h2>
{SVG_ARENA}
<p><b>No navegador</b>, cada agente externo roda num Web Worker criado a partir de um <code>Blob</code> (harness + código do dev). O Worker não acessa a página, o DOM nem o <code>localStorage</code>. A conversa é por mensagens: a página manda os sentidos, o Worker responde a ação. Cada pedido tem um prazo: se o agente não responder (por exemplo, laço infinito), o Worker é encerrado e recriado na próxima partida.</p>
<p><b>No Node</b>, cada agente roda num contexto <code>vm</code> próprio, criado com <code>Object.create(null)</code>, e só strings JSON entram e saem. O <code>vm</code> aplica o limite de tempo diretamente.</p>
{box('decision', 'Por que o motor do jogo não roda junto com o agente', '<p>Parecia mais simples rodar a partida inteira dentro do Worker do agente. Mas aí o mapa estaria no mesmo ambiente do código do dev, e um agente trapaceiro poderia, por exemplo, substituir <code>Set.prototype.has</code> e espionar as consultas que o motor faz ao conjunto de poços. Mantendo o mundo do lado de fora, o agente só conhece o que chega na mensagem.</p>')}
{box('notdo', 'O que o isolamento não garante', '<ul><li>O <code>vm</code> do Node <b>não é uma barreira de segurança completa</b> (a própria documentação do Node avisa). Os truques clássicos para chegar ao <code>process</code> foram testados e bloqueados, mas código malicioso sofisticado pode escapar. Por isso o mantenedor precisa revisar o código antes de aceitar um agente no repositório.</li><li>No navegador o Worker ainda pode usar a rede (<code>fetch</code>). Isso não dá acesso ao mapa, mas não é bloqueado.</li></ul>')}

<h2>3. Mapas iguais para todos (rng.ts)</h2>
<p><code>Math.random</code> não aceita semente: cada execução dá números diferentes. A Arena usa o <b>mulberry32</b>, um gerador pequeno que, dada a mesma semente, produz sempre a mesma sequência. A semente pode ser um texto ("final-2026"), transformado em número pelo hash FNV-1a.</p>
{snip('src/arena/rng.ts', 'export function arenaMaps', lines=4)}
<p>Isso foi conferido: a mesma competição no navegador e na linha de comando dá exatamente os mesmos números.</p>

<h2>4. Medindo o raciocínio (referee.ts)</h2>
<p>Pontos dependem muito de sorte (um mapa pode obrigar a arriscar logo no início). O <b>árbitro</b> mede a qualidade das decisões. Ele mantém sua própria base de conhecimento, alimentada com as mesmas percepções do agente, e julga cada <code>forward</code> <i>antes</i> de ele acontecer:</p>
{snip('src/arena/referee.ts', 'const candidates = kb.wumpusCandidates();', lines=7)}
<ul>
<li><b>Erro de lógica</b>: entrar numa sala que já dava para <i>provar</i> ser poço ou Wumpus.</li>
<li><b>Risco desnecessário</b>: entrar numa sala incerta quando ainda existia sala comprovadamente segura para explorar.</li>
</ul>
<p>Os agentes de referência têm zero nas duas métricas. O agente de exemplo tem alguns erros, porque a dedução dele é mais simples (não localiza o Wumpus).</p>

<h2>Executando e ranqueando (runner.ts e ranking.ts)</h2>
<p><code>playEpisode(controller, mapa, limite)</code> joga uma partida completa: pede a decisão (com prazo), consulta o árbitro, aplica a ação e mede o tempo. Exceções, ações inválidas e demoras viram <code>outcome: 'error'</code>, com pontuação de derrota. Tanto agentes embutidos quanto externos passam pela mesma interface <code>Controller</code>.</p>
<p><code>aggregate()</code> junta as partidas de um agente em médias e <code>rank()</code> ordena: pontuação média, depois vitórias, depois menos erros de lógica.</p>
{img('arena.png', 'Tela da Arena após uma competição de 100 mapas, com o agente de exemplo importado.', 'wide')}

<h2>Relatórios e Análise (src/report/)</h2>
<p>Um <b>relatório</b> guarda as partidas de um ou mais agentes para comparar depois. Ele é gerado na <b>Avaliação</b> (um agente), na <b>Arena</b> (vários agentes nos mesmos mapas) e por <code>npm run arena -- --relatorio arquivo.html</code>.</p>
{snip('src/report/report.ts', 'export interface GameRow {', '}', label='src/report/report.ts — uma linha por partida')}
<ul>
<li><code>report.ts</code> não usa DOM: monta o relatório (<code>buildReport</code>), lê arquivos (<code>parseReport</code>) e calcula séries (média acumulada, contagem acumulada, média móvel). Por isso funciona no navegador e no Node.</li>
<li><code>charts.ts</code> gera os gráficos como <b>texto SVG</b>. As cores vêm de variáveis CSS (paleta categórica validada para daltonismo, nos temas claro e escuro), e <code>installChartHover</code> liga a linha vertical e a dica ao passar o mouse.</li>
<li><code>html.ts</code> monta a tabela-resumo, as barras de resultado, quatro gráficos por partida (pontuação média acumulada, vitórias acumuladas, mortes acumuladas e ações por partida) e a tabela partida a partida. <code>renderReportHtml</code> gera um arquivo independente, que abre em qualquer navegador sem internet.</li>
<li>O HTML exportado leva os dados dentro de <code>&lt;script type="application/json" id="wumpus3d-relatorio"&gt;</code>. A tela de Análise lê tanto esse HTML quanto o JSON puro, e aceita também a exportação antiga da Arena (só totais).</li>
</ul>
<h2>Partidas humanas (src/report/human.ts)</h2>
<p>Com "Você (teclado)" em "Quem joga", <code>main.ts</code> cria um <code>Referee</code> (o árbitro da Arena) para a partida e, quando ela termina, guarda um <code>HumanGame</code> no <code>localStorage</code> (<code>storage.ts</code>, até 1000 partidas). Cada registro leva o <b>mapa inteiro</b>: é isso que permite aos agentes jogarem depois exatamente os mesmos mapas.</p>
{snip('src/report/human.ts', 'export function countedGames(', '}', label='src/report/human.ts — o que entra no relatório')}
<ul>
<li><b>Contam</b> só a primeira vez que o jogador termina cada mapa (<code>layoutKey</code>), e só se ele não abriu o mapa (tecla M).</li>
<li><b>Desafio:</b> <code>challengeMap(semente, n, ...)</code> usa o mesmo sorteador da Arena (<code>arenaMaps</code>), então jogadores diferentes com a mesma semente recebem os mesmos mapas na mesma ordem. <code>nextChallengeIndex</code> só avança depois de uma partida terminada, para ninguém pular mapas.</li>
<li><code>compareWithAgents</code> joga os agentes probabilístico, lógico e genético nos mapas que o jogador terminou e monta um relatório com todos; no desafio, o número do mapa é a posição na semente, e relatórios de jogadores diferentes ficam alinhados mapa a mapa na Análise.</li>
</ul>
{box('decision', 'Por que um HTML com os dados dentro', '<p>Um arquivo só serve para as duas coisas: qualquer pessoa abre e vê os gráficos, e o jogo importa o mesmo arquivo para comparar com outros. Não há servidor: nada sai do navegador.</p>')}
{box('tip', 'Comparando de forma justa', '<p>Na Avaliação, use a mesma <b>semente</b> e o mesmo número de partidas para todos os agentes: eles jogam exatamente os mesmos mapas, e o número do mapa (<code>map</code>) bate entre os relatórios. A tela de Análise avisa quando os relatórios usam mapas diferentes.</p>')}

<h2>Linha de comando e GitHub Actions</h2>
{code("""npm run arena -- agents/meu-agente.js --maps 200 --seed treino
npm run arena -- --maps 500 --ocultar-semente --json public/ranking.json
npm run arena -- --maps 200 --seed comparacao --relatorio relatorio.html""", 'Exemplos')}
<p><code>npm run arena</code> compila <code>scripts/arena.ts</code> com o próprio Vite (modo SSR, para Node) e executa. Não precisa de nenhuma dependência extra.</p>
<ul>
<li><code>.github/workflows/arena.yml</code>: em todo pull request que mexe em <code>agents/</code>, roda 200 mapas com uma semente nova e mostra o ranking no resumo da execução.</li>
<li><code>.github/workflows/deploy.yml</code>: a cada push na <code>main</code>, roda 500 mapas com a semente secreta <code>ARENA_SEED</code>, salva <code>public/ranking.json</code> e publica o site. A tela da Arena mostra esse "ranking oficial" se o arquivo existir.</li>
</ul>
{box('decision', 'Por que a semente oficial é secreta', '<p>O motor é aberto e determinístico. Se a semente fosse pública, um dev poderia gerar os mapas da prova e programar um agente que "reconhece" cada mapa pelas primeiras percepções. Com a semente secreta, e uma semente nova a cada PR, isso não funciona.</p>')}
''')

section('10', 'A interface — main.ts, index.html e style.css', f'''
<p class="lead"><code>main.ts</code> é o maestro: guarda o estado da partida, liga os botões às funções e roda o laço de animação. {L('src/main.ts')}</p>

<h2>O estado da partida</h2>
{snip('src/main.ts', 'const view = new WorldView', 'let genome: number[] | null')}
{table(['Variável', 'Para que serve'], [
    ['<code>world</code>', 'A partida atual (regras e estado).'],
    ['<code>layout</code>', 'A configuração do mapa atual, para repetir a mesma partida com outro jogador.'],
    ['<code>controller</code>', 'Quem está jogando. <code>null</code> quando é você.'],
    ['<code>ready</code>', 'Promessa que resolve quando o agente terminou de se preparar.'],
    ['<code>decision</code>', 'A última decisão do agente (pensamento e crenças) para mostrar na tela.'],
    ['<code>game</code>', 'Contador de partidas. Explicado abaixo.'],
    ['<code>stepping</code>', 'Evita pedir uma decisão nova enquanto a anterior não chegou.'],
])}

<h2>Um passo do agente</h2>
{SVG_STEP}
{snip('src/main.ts', 'async function agentStep() {', '/** Começa uma partida', label='src/main.ts — agentStep()', exclusive=True)}
{box('trap', 'Armadilha comum: respostas atrasadas', '<p>O agente externo responde por mensagem, então a resposta chega "depois". Imagine: o agente está pensando, você clica em <b>Parar</b> e a partida recomeça. Em seguida chega a resposta antiga e é aplicada à partida nova! O contador <code>game</code> resolve isso: cada partida tem um número, e uma resposta só é usada se o número ainda for o mesmo de quando foi pedida.</p>')}

<h2>Recomeçar: <code>restart(newMap)</code></h2>
<p><code>restart()</code> sorteia um mapa novo; <code>restart(false)</code> repete o atual. Ao trocar de jogador o mapa é mantido, para comparar agentes no mesmo cenário. O botão <b>⏹ Parar</b> (tecla T) chama <code>resetSameMap()</code>: interrompe o agente e volta ao início no mesmo mapa.</p>

<h2>O laço de animação</h2>
{snip('src/main.ts', 'view.renderer.setAnimationLoop', '});')}
<p>O laço desenha um frame sempre e, se o agente estiver jogando, dá um passo quando passou o intervalo definido pela velocidade (passos por segundo).</p>

<h2>Layout (index.html e style.css)</h2>
{img('celular.png', 'No celular (390 px): mapa em cima e botões numa barra; o painel abre embaixo.', 'phone')}
<ul>
<li><code>#layout</code> é um flex com duas partes: <code>#stage</code> (o mapa 3D e os controles) e <code>#setup</code> (o painel de configuração, 340 px).</li>
<li>Em telas com até 760 px de largura o layout vira coluna: mapa em cima, painel embaixo (45% da altura) e os botões numa barra entre os dois.</li>
<li>Placares e histórico ficam dentro de <code>#viewport</code>, por cima do canvas, com <code>position: absolute</code>.</li>
<li>A regra <code>[hidden] {{ display: none !important; }}</code> garante que o atributo <code>hidden</code> esconda mesmo os elementos com <code>display: flex</code>.</li>
</ul>
{box('decision', 'Por que o painel não flutua sobre o mapa', '<p>Na primeira versão o painel ficava por cima do mapa e cobria parte dele. Agora ele divide a tela com o mapa, e o canvas 3D se redimensiona (via <code>ResizeObserver</code>) quando o painel abre ou fecha.</p>')}

<h2>Armazenamento (storage.ts)</h2>
{table(['Chave do localStorage', 'Conteúdo'], [
    ['<code>wumpus3d.maps</code>', 'Lista de mapas salvos (<code>MapLayout</code>).'],
    ['<code>wumpus3d.genome</code>', 'Pesos treinados do agente genético.'],
    ['<code>wumpus3d.agents</code>', 'Agentes importados (nome, autor, descrição e código).'],
])}
<p>Toda leitura e escrita está dentro de <code>try/catch</code>. Em janela anônima, ou com o armazenamento bloqueado, o jogo continua funcionando e só não guarda nada. Mapas lidos do armazenamento passam de novo por <code>parseLayout</code>.</p>
{box('notdo', 'O que a interface não faz', '<ul><li>Não sincroniza nada entre dispositivos: o <code>localStorage</code> é de cada navegador. Para levar um mapa ou agente, exporte o arquivo.</li><li>Não tem tradução: os textos estão em português, direto no HTML e no código.</li><li>Não tem testes automatizados de interface (os testes do capítulo 13 cobrem regras, deduções e Arena).</li></ul>')}
''')

section('11', 'Mapas salvos, exportação e importação', f'''
<p>O fluxo completo, de ponta a ponta:</p>
<ol>
<li><b>Salvar</b>: <code>layout</code> (o mapa atual) recebe um nome e vai para <code>saveMap()</code>. Um mapa com o mesmo nome é substituído.</li>
<li><b>Jogar um salvo</b>: <code>playLayout(l)</code> troca o <code>layout</code> e chama <code>restart(false)</code>.</li>
<li><b>Exportar</b>: o JSON é baixado como arquivo e também colocado numa caixa de texto. Em ambientes que bloqueiam downloads, dá para copiar dali.</li>
<li><b>Importar</b>: o texto (de arquivo ou colado) passa por <code>parseLayout()</code>; se for válido, é salvo e carregado; se não, a mensagem de erro explica o problema.</li>
<li><b>Excluir</b>: pede um segundo clique ("Confirmar?"), porque <code>confirm()</code> nem sempre está disponível.</li>
</ol>
{snip('src/main.ts', 'function importJson(text: string) {', "$('#map-save')", label='src/main.ts — importJson()', exclusive=True)}
''')

section('12', 'Roteiro de reimplementação', f'''
<p class="lead">Uma ordem sugerida para reconstruir o projeto do zero. Cada etapa produz algo que funciona e pode ser testado antes de seguir. Não pule a verificação de cada etapa: um erro nas regras contamina tudo que vem depois.</p>
{box('tip', 'Ordem importa', '<p>As etapas 2, 3, 8 e 10 são as mais sensíveis. Escreva testes automatizados para elas (capítulo 13) antes de seguir. Depois que a interface estiver pronta, é muito mais difícil descobrir se um erro está nas regras ou no desenho.</p>')}
{table(['Etapa', 'O que construir', 'Pronto quando...'], [
    ['1', 'Projeto Vite + TypeScript (<code>npm create vite@latest -- --template vanilla-ts</code>) e instalar <code>three</code>.', '<code>npm run dev</code> abre uma página.'],
    ['2', '<code>world.ts</code>: tipos, <code>key()</code>, geração de mapa, <code>sense()</code> e <code>step()</code>.', 'Num script, você joga uma partida no console, vê as percepções mudarem e consegue morrer e vencer.'],
    ['3', 'Geração com BFS (só mapas vencíveis).', 'Em 10.000 mapas, nenhum tem ouro em poço ou sem caminho.'],
    ['4', 'Cena 3D estática: piso, paredes, câmera, luz.', 'A grade aparece no navegador.'],
    ['5', '<code>WorldView.load()</code> e <code>sync()</code>: desenhar o estado do mundo.', 'Poços e Wumpus aparecem nas posições certas com "revelar mapa".'],
    ['6', 'Teclado, botões e placares (<code>main.ts</code>, <code>updateHud</code>).', 'Você joga uma partida completa no 3D.'],
    ['7', 'Animações em <code>frame()</code> (interpolação, tocha, partículas, flecha).', 'O agente desliza entre as salas em vez de pular.'],
    ['8', '<code>Knowledge</code>: <code>pitFree</code>, <code>wumpusCandidates</code>, <code>certainPits</code>, <code>safe</code>.', 'Nos exemplos do livro, as salas seguras batem com as do AIMA.'],
    ['9', 'Agente lógico e laço de jogo automático (velocidade, um passo).', 'O agente vence a maioria dos mapas 4×4 sem nunca dar erro de lógica.'],
    ['10', 'Probabilidades (<code>pitProbabilities</code>) e agente probabilístico.', 'O exemplo do capítulo 7 dá 56%.'],
    ['11', 'Mostrar crenças no 3D e o pensamento do agente.', 'Os discos e rótulos aparecem na fronteira.'],
    ['12', 'Mapas: <code>MapLayout</code>, <code>parseLayout</code>, salvar, exportar, importar.', 'Exportar e importar devolve exatamente o mesmo mapa.'],
    ['13', 'Agente genético, algoritmo genético e Web Worker de treino.', 'O treino partindo de pesos aleatórios melhora a aptidão em poucas gerações.'],
    ['14', 'Arena: <code>protocol</code>, <code>sandbox</code>, <code>runner</code>, <code>referee</code>, <code>ranking</code>, <code>rng</code>.', 'Agentes com laço infinito, sintaxe errada ou ação inválida geram erro claro sem travar a página.'],
    ['15', 'Tela da Arena e linha de comando.', 'Mesma semente dá o mesmo ranking no navegador e no terminal.'],
    ['16', 'Workflows do GitHub e publicação.', 'O site abre no GitHub Pages com o ranking oficial.'],
], 'compact')}

''')

section('13', 'Como o projeto foi verificado', f'''
<p>A versão documentada foi verificada com scripts executados durante o desenvolvimento (fora do repositório):</p>
<ul>
<li><b>Regras</b>: partidas roteirizadas conferindo que voltar à entrada sem ouro não encerra o jogo e que voltar com ouro dá vitória com 1487 pontos.</li>
<li><b>Geração</b>: 10.000 mapas sorteados, todos vencíveis.</li>
<li><b>Agentes</b>: centenas a milhares de partidas por agente e tamanho, nos mesmos mapas (tabela do capítulo 8).</li>
<li><b>Navegador</b>: testes com Playwright (navegador automatizado) para jogar até a vitória, salvar/exportar/importar mapas, treinar o genético, parar e reiniciar, importar agentes defeituosos e rodar a Arena, em tamanhos de computador e de celular, sempre conferindo que não houve erro no console.</li>
<li><b>Arena</b>: agentes de teste com laço infinito, erro de sintaxe, ação inválida, exceção no meio da partida e tentativa de acessar o <code>process</code> do Node. Todos foram tratados com mensagem clara.</li>
</ul>
<h2>Testes automatizados</h2>
<p>O repositório tem uma suíte de testes com o Vitest, que roda com <code>npm test</code> (ou <code>npm run check</code>, que também confere os tipos). O GitHub Actions roda os testes antes de publicar o site, e uma falha impede a publicação.</p>
{table(['Arquivo', 'O que garante'], [
    ['<code>tests/world.test.ts</code>', 'Regras: vitória só com o ouro na entrada, morte, Wumpus morto, limite de ações, custos, fedor depois da morte, mapas sorteados sempre vencíveis, exportar/importar e validação de mapas inválidos.'],
    ['<code>tests/knowledge.test.ts</code>', 'Deduções: exemplo de 56% do AIMA, poço certo, localização do Wumpus, flecha que erra, Wumpus fora de poço deduzido e P(Wumpus) ponderada.'],
    ['<code>tests/arena.test.ts</code>', 'Arena: mesma semente gera os mesmos mapas, agentes de referência sem erro de lógica, lógico vence o aleatório, decisão inválida vira erro claro.'],
    ['<code>tests/genetic.test.ts</code>', 'Agente genético: pesos que dependem da posição não o fazem andar em círculos; o <code>BAYES_LIKE_GENOME</code> não esgota o tempo.'],
    ['<code>tests/human.test.ts</code>', 'Partidas humanas: só a primeira vez em cada mapa e sem mapa aberto contam, desafio reproduzível que só avança depois de terminar, agentes jogam os mesmos mapas do jogador.'],
    ['<code>tests/report.test.ts</code>', 'Relatórios: totais batem com as partidas, o HTML exportado é importado de volta igual, exportação antiga da Arena é aceita, arquivos estranhos são recusados.'],
])}
{snip('tests/world.test.ts', "describe('vitória e fim de partida'", lines=14, label='tests/world.test.ts — exemplo')}
{box('notdo', 'O que os testes não cobrem', '<p>A interface (botões, painel, Arena na tela) e o 3D não têm testes automatizados no repositório. Eles foram verificados com Playwright durante o desenvolvimento, mas esses scripts não foram incluídos.</p>')}
''')

section('14', 'Limitações conhecidas e próximos passos', f'''
{table(['Limitação', 'Por que existe / o que fazer'], [
    ['Sem testes automatizados de interface', 'As regras, as deduções e a Arena têm testes (capítulo 13); a tela e o 3D não. Testes com Playwright seriam o próximo passo.'],
    ['Probabilidade do Wumpus calculada sala a sala', 'Usa P(sem poço) de cada candidata, sem enumerar poços e Wumpus juntos. Uma enumeração conjunta seria exata e mais lenta.'],
    ['O agente probabilístico olha só o risco imediato', 'Escolhe a sala de menor risco agora, sem pesar quanto ela ajuda a achar o ouro ou o valor da informação que traria. Uma decisão por utilidade esperada (teoria da decisão) poderia ir além.'],
    ['Estimativa aproximada com mais de 16 salas na fronteira', 'Para não travar em mapas grandes. Poderia dividir a fronteira em grupos independentes e enumerar cada grupo.'],
    ['Os agentes supõem poços independentes', 'O mapa tem um número fixo de poços (que os agentes não conhecem, por escolha) e o gerador descarta mapas invencíveis; as probabilidades reais diferem um pouco das calculadas.'],
    ['Fedor continua depois que o Wumpus morre', 'Regra do livro. A base de conhecimento já ignora fedor quando <code>wumpusDead</code> é verdadeiro.'],
    ['Memória de vídeo não é liberada ao recomeçar', '<code>level.clear()</code> remove objetos, mas não chama <code>dispose()</code> nas geometrias e materiais. Em sessões muito longas a memória cresce. Corrija percorrendo a cena e chamando <code>dispose()</code>.'],
    ['Pacote de ~600 KB (160 KB compactado)', '<code>import * as THREE</code> traz a biblioteca inteira. Importar só as classes usadas pode reduzir.'],
    ['O genético ganha pouco do probabilístico no 4×4', 'Com as mesmas informações, a regra "menor risco" já está perto do melhor possível em mapas pequenos. Novas características (por exemplo, valor da informação ou distância até o ouro provável) poderiam mudar isso.'],
    ['O <code>vm</code> do Node não é uma barreira de segurança', 'Revise o código dos agentes antes do merge. Para mais isolamento, rode a arena num contêiner sem rede.'],
    ['Agentes externos com o mesmo nome e autor se substituem', 'O id é derivado de autor/nome. Use um id explícito se precisar de versões lado a lado.'],
    ['Dados só no navegador', 'O <code>localStorage</code> não sincroniza. Um backend seria necessário para contas e ranking em tempo real.'],
    ['Acessibilidade parcial', 'Botões têm foco visível e textos, mas o mapa 3D não tem descrição textual para leitores de tela.'],
])}
''')

section('15', 'Glossário', table(['Termo', 'Significado'], [
    ['Agente', 'Programa que percebe o ambiente e escolhe ações.'],
    ['Percepção', 'O que o agente sente na sala atual (brisa, fedor, brilho, batida, grito).'],
    ['Base de conhecimento', 'Tudo que o agente anotou e deduziu (classe <code>Knowledge</code>).'],
    ['Fronteira', 'Salas desconhecidas vizinhas de salas já visitadas: os próximos lugares possíveis.'],
    ['Probabilidade a priori', 'A chance antes de qualquer evidência (20% de poço por sala).'],
    ['Inferência bayesiana', 'Atualizar probabilidades com base no que foi observado.'],
    ['Enumeração', 'Listar todas as combinações possíveis e somar as que são consistentes.'],
    ['BFS (busca em largura)', 'Busca que explora por camadas de distância; acha o caminho mais curto num grid.'],
    ['Genoma', 'A lista de pesos que define a estratégia do agente genético.'],
    ['Aptidão (fitness)', 'A nota de um genoma: pontuação média nas partidas.'],
    ['Elitismo', 'Os melhores passam sem alteração para a próxima geração.'],
    ['Seleção por torneio', 'Sortear alguns indivíduos e escolher o melhor como pai.'],
    ['Mutação gaussiana', 'Somar um ruído aleatório com distribuição normal a um peso.'],
    ['Validação', 'Avaliar em dados (mapas) que não foram usados no treino.'],
    ['Web Worker', 'Código JavaScript rodando numa thread separada da página.'],
    ['Sandbox', 'Ambiente isolado para rodar código de terceiros.'],
    ['Semente (seed)', 'Valor inicial de um sorteador; a mesma semente gera os mesmos números.'],
    ['Determinístico', 'Que dá sempre o mesmo resultado para a mesma entrada.'],
    ['Interpolação (lerp)', 'Andar uma fração do caminho entre dois valores a cada frame.'],
    ['Harness', 'Código fixo que embrulha o código do dev e fala com a arena.'],
    ['Promise', 'Valor que vai chegar no futuro (resposta assíncrona).'],
    ['Gerador (<code>function*</code>)', 'Função que entrega valores aos poucos com <code>yield</code>.'],
]))

# ---------------------------------------------------------------- Montagem

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)

doc = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Wumpus 3D — Documentação técnica</title>
<style>
@page {{ size: A4; margin: 18mm 17mm 20mm 17mm; }}
:root {{ --ink: #2a2218; --muted: #6b5d4b; --rule: #e4dccd; --accent: #a8740c; --paper: #fff; --code: #f7f3ec; }}
* {{ box-sizing: border-box; }}
html {{ font-size: 10.4pt; }}
body {{ margin: 0; color: var(--ink); background: var(--paper); font-family: 'Bitstream Charter', 'Charter', Georgia, serif; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
h1, h2, h3, .cover, th, figcaption, .box > b, .toc, .num, .tnum {{ font-family: 'Inter', 'Liberation Sans', sans-serif; }}
p, li {{ orphans: 3; widows: 3; }}
code {{ font-family: 'JetBrains Mono', 'DejaVu Sans Mono', monospace; font-size: 0.86em; background: var(--code); padding: 0.05em 0.3em; border-radius: 3px; }}
a {{ color: inherit; text-decoration: none; }}

.cover {{ height: 255mm; display: flex; flex-direction: column; justify-content: space-between; padding: 18mm 4mm 6mm; break-after: page; }}
.cover .kicker {{ font-size: 10pt; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 600; }}
.cover h1 {{ font-family: 'Inter Display', 'Inter', sans-serif; font-size: 46pt; line-height: 1; margin: 6mm 0 4mm; letter-spacing: -0.02em; }}
.cover .sub {{ font-size: 15pt; color: var(--muted); max-width: 140mm; line-height: 1.35; font-family: 'Bitstream Charter', serif; }}
.cover .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; width: 70mm; margin: 14mm 0; }}
.cover .grid i {{ aspect-ratio: 1; background: #efe7d8; border-radius: 2px; }}
.cover .grid i.e {{ outline: 2.5px solid #4fa3ff; outline-offset: -5px; }}
.cover .grid i.p {{ background: #2a2218; }}
.cover .grid i.g {{ background: #e9b52e; }}
.cover .grid i.w {{ background: #8a2c22; }}
.cover .meta {{ font-size: 9.5pt; color: var(--muted); display: grid; grid-template-columns: auto 1fr; gap: 1mm 6mm; }}
.cover .meta b {{ color: var(--ink); font-weight: 600; }}

.toc {{ break-after: page; }}
.toc h1 {{ font-size: 20pt; margin: 0 0 6mm; }}
.toc ol {{ list-style: none; padding: 0; margin: 0; columns: 1; }}
.toc li {{ padding: 2.4mm 0; border-bottom: 1px solid var(--rule); font-size: 11.5pt; }}
.toc .tnum {{ display: inline-block; width: 12mm; color: var(--accent); font-weight: 700; }}
.toc .note {{ margin-top: 8mm; font-family: 'Bitstream Charter', serif; color: var(--muted); font-size: 10pt; }}

.chapter {{ break-before: page; }}
.chapter h1 {{ font-size: 21pt; line-height: 1.15; margin: 0 0 5mm; letter-spacing: -0.01em; display: flex; gap: 4mm; align-items: baseline; }}
.chapter h1 .num {{ color: var(--accent); font-size: 0.8em; }}
h2 {{ font-size: 13pt; margin: 7mm 0 2mm; break-after: avoid; }}
h3 {{ font-size: 11pt; margin: 5mm 0 1.5mm; break-after: avoid; }}
.lead {{ font-size: 11.6pt; color: #4a3d2c; }}
ul, ol {{ padding-left: 6mm; }}
li {{ margin: 0.8mm 0; }}

table {{ width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; font-size: 9.3pt; break-inside: auto; }}
thead {{ display: table-header-group; }}
tr {{ break-inside: avoid; }}
th {{ text-align: left; font-size: 8.4pt; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); border-bottom: 1.5px solid var(--ink); padding: 1.6mm 2mm; }}
td {{ border-bottom: 1px solid var(--rule); padding: 1.6mm 2mm; vertical-align: top; }}
table.compact td {{ padding: 1.1mm 2mm; font-size: 8.9pt; line-height: 1.35; }}
table.files td:nth-child(2) {{ text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }}

figure {{ margin: 3mm 0 4mm; }}
figure.code {{ break-inside: avoid; border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; }}
figure.code figcaption {{ font-size: 8pt; background: #efe8dc; color: var(--muted); padding: 1.2mm 3mm; display: flex; justify-content: space-between; }}
code, pre {{ font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0; }}
figure.code pre {{ margin: 0; padding: 2.5mm 3mm; background: var(--code); font-family: 'JetBrains Mono', monospace; font-size: 7.7pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }}
pre .c {{ color: #8a7a5c; font-style: italic; }}
figure.shot {{ break-inside: avoid; }}
figure.shot img {{ width: 100%; border-radius: 4px; border: 1px solid var(--rule); display: block; }}
figure.shot.narrow, figure.shot.phone {{ float: right; width: 58mm; margin: 0 0 3mm 6mm; }}
figure.shot.phone {{ width: 50mm; }}
figure.shot.wide {{ width: 86%; margin-left: auto; margin-right: auto; }}
h2 {{ clear: both; }}
figure.shot figcaption {{ font-size: 8.6pt; color: var(--muted); margin-top: 1.5mm; }}
svg.diagram {{ width: 100%; height: auto; margin: 3mm 0 4mm; break-inside: avoid; display: block; }}
svg.diagram.small {{ width: 75%; }}

.box {{ display: block; margin: 3.5mm 0; padding: 3mm 4mm; border-left: 3px solid; border-radius: 0 4px 4px 0; break-inside: avoid; font-size: 9.8pt; }}
.box > b {{ display: block; font-size: 8.3pt; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1mm; }}
.box p, .box ul, .box ol {{ margin: 0.8mm 0; }}
.box.decision {{ background: #fbf4e2; border-color: #c9932a; }} .box.decision > b {{ color: #8a5e0a; }}
.box.notdo {{ background: #f6ecea; border-color: #b85c4a; }} .box.notdo > b {{ color: #8a3a2a; }}
.box.trap {{ background: #eef1f7; border-color: #5b7bb0; }} .box.trap > b {{ color: #34507d; }}
.box.tip {{ background: #ecf5ee; border-color: #4f9a62; }} .box.tip > b {{ color: #2e6b3e; }}
</style></head><body>

<div class="cover">
  <div>
    <div class="kicker">Documentação técnica</div>
    <h1>Wumpus 3D</h1>
    <p class="sub">Como o jogo funciona por dentro, por que cada decisão foi tomada e como reimplementá-lo do zero. Escrito para desenvolvedores júnior.</p>
    <div class="grid">
      <i></i><i class="p"></i><i></i><i class="w"></i>
      <i></i><i></i><i class="g"></i><i></i>
      <i></i><i class="p"></i><i></i><i></i>
      <i class="e"></i><i></i><i></i><i class="p"></i>
    </div>
  </div>
  <div class="meta">
    <span>Versão do código</span><b>{COMMIT}</b>
    <span>Data</span><b>{DATE}</b>
    <span>Tecnologias</span><b>TypeScript · Three.js · Vite · Web Workers</b>
    <span>Tamanho</span><b>{sum(lines_of(p) for p in ['index.html','src/style.css','src/main.ts','src/storage.ts','src/game/world.ts','src/render/view.ts','src/agents/knowledge.ts','src/agents/agents.ts','src/agents/genome.ts','src/agents/genetic.ts','src/agents/ga.worker.ts','src/agents/benchmark.ts','src/arena/protocol.ts','src/arena/rng.ts','src/arena/referee.ts','src/arena/runner.ts','src/arena/ranking.ts','src/arena/sandbox.ts','src/arena/ui.ts','scripts/arena.ts','agents/exemplo-cauteloso.js'])} linhas em 21 arquivos de código</b>
  </div>
</div>

<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol>
<p class="note">Os trechos de código deste documento foram extraídos automaticamente dos arquivos do projeto na versão {COMMIT}, com a indicação das linhas.</p></nav>

{''.join(sections)}
</body></html>'''

OUT.write_text(doc)
print('ok', len(doc))
