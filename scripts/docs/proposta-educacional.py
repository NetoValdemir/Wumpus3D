# Gera o PDF "Caverna do Pensamento — proposta educacional" (docs/wumpus3d-proposta-educacional.pdf).
# É o documento de 2 de novembro de 2026 que originou o modo escola (D22): pesquisa de jogos de pensamento
# computacional, os cinco modos propostos, faixas etárias, roteiro e referências. Mantido como registro
# histórico: o que foi implementado está em HISTORICO.md (nº 26 e 27) e no manual do modo escola.
import html, re, sys, pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]
IMG = REPO / 'scripts/docs/img'
OUT = pathlib.Path(sys.argv[1])

css = re.search(r'<style>(.*?)</style>', (REPO / 'scripts/docs/documentacao.py').read_text(), re.S).group(1)
css = css.replace('{{', '{').replace('}}', '}')

sections, toc = [], []


def section(num, title, body):
    sid = f's{num}'
    toc.append((num, title, sid))
    sections.append(f'<section id="{sid}" class="chapter"><h1><span class="num">{num}</span>{title}</h1>{body}</section>')


def box(kind, title, body):
    return f'<aside class="box {kind}"><b>{title}</b>{body}</aside>'


def table(head, rows, cls='compact'):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def img(name, caption, cls=''):
    return f'<figure class="shot {cls}"><img src="file://{IMG / name}"><figcaption>{caption}</figcaption></figure>'


def fig(svg, caption):
    return f'<figure class="mock">{svg}<figcaption>{caption}</figcaption></figure>'


REFS = {}


def ref(key, short, full):
    REFS[key] = (short, full)


ref('wing', 'Wing (2006)', 'WING, Jeannette M. Computational thinking. <i>Communications of the ACM</i>, v. 49, n. 3, p. 33–35, 2006. DOI: 10.1145/1118178.1118215. Cópia da autora: cs.columbia.edu/~wing/publications/Wing06.pdf.')
ref('brennan', 'Brennan e Resnick (2012)', 'BRENNAN, Karen; RESNICK, Mitchel. New frameworks for studying and assessing the development of computational thinking. In: <i>Annual Meeting of the American Educational Research Association (AERA)</i>, Vancouver, 2012. Disponível em: scratched.gse.harvard.edu/ct/files/AERA2012.pdf.')
ref('bncc', 'Brasil (2022)', 'BRASIL. Conselho Nacional de Educação. <i>Parecer CNE/CEB nº 2/2022</i> (BNCC Computação — Complemento à BNCC), aprovado em 17 de fevereiro de 2022, homologado em 3 de outubro de 2022; e <i>Resolução CNE/CEB nº 1, de 4 de outubro de 2022</i>. Disponível em: gov.br/mec/pt-br/cne.')
ref('papert', 'Papert (1980)', 'PAPERT, Seymour. <i>Mindstorms: Children, Computers, and Powerful Ideas</i>. New York: Basic Books, 1980. Texto disponibilizado pelo MIT Media Lab (media.mit.edu/publications/mindstorms).')
ref('scratch', 'Resnick et al. (2009)', 'RESNICK, Mitchel et al. Scratch: programming for all. <i>Communications of the ACM</i>, v. 52, n. 11, p. 60–67, 2009. DOI: 10.1145/1592761.1592779.')
ref('karel', 'Pattis (1981)', 'PATTIS, Richard E. <i>Karel the Robot: A Gentle Introduction to the Art of Programming</i>. New York: John Wiley &amp; Sons, 1981.')
ref('ai4k12', 'Touretzky et al. (2019)', 'TOURETZKY, David; GARDNER-McCUNE, Christina; MARTIN, Fred; SEEHORN, Deborah. Envisioning AI for K-12: What should every child know about AI? In: <i>Proceedings of the AAAI Conference on Artificial Intelligence</i>, v. 33, p. 9795–9799, 2019. DOI: 10.1609/aaai.v33i01.33019795.')
ref('aima', 'Russell e Norvig (2020)', 'RUSSELL, Stuart; NORVIG, Peter. <i>Artificial Intelligence: A Modern Approach</i>. 4. ed. Hoboken: Pearson, 2020. (Mundo de Wumpus: cap. 7 e seção 12.7.)')
ref('lgpd', 'Brasil (2018)', 'BRASIL. <i>Lei nº 13.709, de 14 de agosto de 2018</i> — Lei Geral de Proteção de Dados Pessoais (LGPD), art. 14 (dados de crianças e adolescentes).')
ref('unplugged', 'CS Unplugged', 'CS UNPLUGGED. Universidade de Canterbury (Nova Zelândia). Atividades de computação sem computador. csunplugged.org.')
ref('bebras', 'Bebras', 'BEBRAS — International Challenge on Informatics and Computational Thinking (criado na Lituânia por Valentina Dagienė; no Brasil, organizado pela UpMat Educacional). bebras.org.')

R = lambda k: f'<span class="cite">{REFS[k][0]}</span>'

# ---------------------------------------------------------------- Mockups (SVG, ilustrativos)
MOCK_BLOCKS = '''
<svg viewBox="-3 0 646 300" class="mocksvg" role="img" aria-label="Esboço do modo Programador com blocos">
  <rect x="0" y="0" width="640" height="300" rx="8" fill="#1b1612"/>
  <text x="16" y="24" fill="#e9b52e" font-size="13" font-weight="700">Missão 7 · Repetir até achar o brilho</text>
  <text x="624" y="24" fill="#c9b48a" font-size="11" text-anchor="end">blocos: 5 / 6 · ★★☆</text>
  <!-- paleta -->
  <rect x="12" y="38" width="110" height="250" rx="6" fill="#2a221b"/>
  <g font-size="11" fill="#fff">
    <rect x="22" y="50" width="90" height="22" rx="4" fill="#4a7fc1"/><text x="30" y="65">avançar</text>
    <rect x="22" y="78" width="90" height="22" rx="4" fill="#4a7fc1"/><text x="30" y="93">girar ↺ / ↻</text>
    <rect x="22" y="106" width="90" height="22" rx="4" fill="#4a7fc1"/><text x="30" y="121">pegar ouro</text>
    <rect x="22" y="134" width="90" height="22" rx="4" fill="#c0503c"/><text x="30" y="149">atirar flecha</text>
    <rect x="22" y="162" width="90" height="22" rx="4" fill="#d08a2c"/><text x="30" y="177">repetir</text>
    <rect x="22" y="190" width="90" height="22" rx="4" fill="#7a5bb5"/><text x="30" y="205">se sentir …</text>
    <rect x="22" y="218" width="90" height="22" rx="4" fill="#3d8f5a"/><text x="30" y="233">função</text>
  </g>
  <!-- programa -->
  <rect x="132" y="38" width="250" height="250" rx="6" fill="#241d17"/>
  <g font-size="11.5" fill="#fff">
    <rect x="146" y="52" width="200" height="24" rx="4" fill="#d08a2c"/><text x="154" y="68">repetir até sentir ✨ brilho</text>
    <rect x="162" y="80" width="184" height="24" rx="4" fill="#7a5bb5"/><text x="170" y="96">se sentir 💨 brisa</text>
    <rect x="178" y="108" width="140" height="22" rx="4" fill="#4a7fc1"/><text x="186" y="123">girar ↺</text>
    <rect x="162" y="134" width="184" height="18" rx="4" fill="#7a5bb5"/><text x="170" y="147">senão</text>
    <rect x="178" y="156" width="140" height="22" rx="4" fill="#4a7fc1" stroke="#ffe27a" stroke-width="2.5"/><text x="186" y="171">avançar</text>
    <rect x="146" y="196" width="200" height="22" rx="4" fill="#4a7fc1"/><text x="154" y="211">pegar ouro</text>
    <rect x="146" y="224" width="200" height="22" rx="4" fill="#3d8f5a"/><text x="154" y="239">voltar para casa()</text>
  </g>
  <text x="150" y="276" fill="#c9b48a" font-size="10">▶ executar · ⏭ um passo · 🐢 devagar</text>
  <!-- mapa 2D -->
  <g transform="translate(400,46)">
    <g fill="#3a2f25" stroke="#1b1612" stroke-width="3">
      <rect x="0" y="0" width="56" height="56"/><rect x="56" y="0" width="56" height="56"/><rect x="112" y="0" width="56" height="56"/><rect x="168" y="0" width="56" height="56"/>
      <rect x="0" y="56" width="56" height="56"/><rect x="56" y="56" width="56" height="56"/><rect x="112" y="56" width="56" height="56"/><rect x="168" y="56" width="56" height="56"/>
      <rect x="0" y="112" width="56" height="56"/><rect x="56" y="112" width="56" height="56"/><rect x="112" y="112" width="56" height="56"/><rect x="168" y="112" width="56" height="56"/>
      <rect x="0" y="168" width="56" height="56" fill="#5a4a3a"/><rect x="56" y="168" width="56" height="56" fill="#5a4a3a"/><rect x="112" y="168" width="56" height="56"/><rect x="168" y="168" width="56" height="56"/>
    </g>
    <circle cx="84" cy="196" r="14" fill="#3d7bd9"/><polygon points="98,196 90,190 90,202" fill="#ffd27a"/>
    <text x="140" y="200" font-size="20" text-anchor="middle">❔</text>
    <text x="84" y="148" font-size="18" text-anchor="middle">💨</text>
    <rect x="0" y="232" width="224" height="20" rx="4" fill="#2a221b"/>
    <text x="8" y="246" fill="#e6dccb" font-size="10.5">Sente: 💨 brisa — tem um poço ao lado!</text>
  </g>
</svg>'''

MOCK_NOTEBOOK = '''
<svg viewBox="-3 0 646 250" class="mocksvg" role="img" aria-label="Esboço do Caderno do Detetive">
  <rect x="0" y="0" width="640" height="250" rx="8" fill="#fbf6ec" stroke="#d6cbb8"/>
  <text x="16" y="24" fill="#2a2218" font-size="13" font-weight="700">Caderno do Detetive</text>
  <g transform="translate(16,36)" font-size="12" text-anchor="middle">
    <g fill="#fff" stroke="#bfb29c">
      <rect x="0" y="0" width="48" height="48"/><rect x="48" y="0" width="48" height="48"/><rect x="96" y="0" width="48" height="48"/><rect x="144" y="0" width="48" height="48"/>
      <rect x="0" y="48" width="48" height="48"/><rect x="48" y="48" width="48" height="48"/><rect x="96" y="48" width="48" height="48"/><rect x="144" y="48" width="48" height="48"/>
      <rect x="0" y="96" width="48" height="48" fill="#e7f3e9"/><rect x="48" y="96" width="48" height="48" fill="#fdecc8"/><rect x="96" y="96" width="48" height="48"/><rect x="144" y="96" width="48" height="48"/>
      <rect x="0" y="144" width="48" height="48" fill="#e7f3e9"/><rect x="48" y="144" width="48" height="48" fill="#e7f3e9"/><rect x="96" y="144" width="48" height="48" fill="#fdecc8"/><rect x="144" y="144" width="48" height="48"/>
    </g>
    <text x="24" y="174" font-size="10.5">visitada</text><text x="72" y="174">💨</text><text x="24" y="126" font-size="10.5">segura</text>
    <text x="72" y="126">poço?</text><text x="120" y="174">poço?</text>
  </g>
  <g font-size="11.5" fill="#2a2218">
    <text x="232" y="56" font-weight="700">Minhas pistas</text>
    <text x="232" y="78">• Em (2,1) senti brisa.</text>
    <text x="232" y="98">• Em (1,1) não senti nada.</text>
    <text x="232" y="122" font-weight="700">Minha conclusão</text>
    <text x="232" y="144">O poço está em (3,1) ou em (2,2).</text>
    <rect x="232" y="158" width="390" height="56" rx="6" fill="#eef1f7" stroke="#5b7bb0"/>
    <text x="244" y="180" fill="#34507d" font-weight="700">Robô-ajudante:</text>
    <text x="244" y="200" fill="#34507d">Boa! E (1,2)? Ela é vizinha de (1,1), que não tinha brisa…</text>
  </g>
</svg>'''

PROGRESSION = '''
<svg viewBox="-3 0 646 170" class="mocksvg" role="img" aria-label="Progressão por faixa etária">
  <g font-size="11.5">
    <rect x="0" y="20" width="200" height="130" rx="8" fill="#ecf5ee" stroke="#4f9a62"/>
    <rect x="220" y="20" width="200" height="130" rx="8" fill="#fbf4e2" stroke="#c9932a"/>
    <rect x="440" y="20" width="200" height="130" rx="8" fill="#eef1f7" stroke="#5b7bb0"/>
    <text x="100" y="42" text-anchor="middle" font-weight="700" fill="#2e6b3e">10–12 anos · Explorar</text>
    <text x="320" y="42" text-anchor="middle" font-weight="700" fill="#8a5e0a">13–15 anos · Programar</text>
    <text x="540" y="42" text-anchor="middle" font-weight="700" fill="#34507d">16–18 anos · Criar agentes</text>
    <g fill="#2a2218">
      <text x="14" y="66">Detetive + desplugado</text><text x="14" y="86">Blocos: sequência,</text><text x="14" y="104">repetição</text><text x="14" y="124">Mapa 2D, sem números</text><text x="14" y="142">de pontuação</text>
      <text x="234" y="66">Blocos: condicionais,</text><text x="234" y="86">funções, variáveis</text><text x="234" y="104">Ver o código JS gerado</text><text x="234" y="124">Criar e trocar mapas</text><text x="234" y="142">Pontuação simplificada</text>
      <text x="454" y="66">Texto (JS/Python)</text><text x="454" y="86">Agentes na Arena da turma</text><text x="454" y="104">Probabilidade e IA</text><text x="454" y="124">Algoritmo genético</text><text x="454" y="142">Pontuação completa (AIMA)</text>
    </g>
  </g>
  <path d="M200,85 L220,85 M420,85 L440,85" stroke="#6b5a45" stroke-width="2"/>
</svg>'''

# ---------------------------------------------------------------- Conteúdo
section('1', 'Resumo da proposta', f'''
<p class="lead">O Wumpus 3D já é, por natureza, um <b>micromundo</b> no sentido de {R('papert')}: um robô numa grade, que só sabe o que sente, precisa planejar passos, deduzir onde está o perigo e decidir sob incerteza. Isso cobre quase tudo o que o pensamento computacional pede. O que falta para crianças e jovens de 10 a 18 anos é <b>a porta de entrada</b>: hoje, para "programar" o jogo, é preciso escrever JavaScript, e a interface fala a língua de quem estuda IA na universidade.</p>
<p>A proposta é uma <b>versão educacional</b> ("Caverna do Pensamento", nome provisório) que mantém o motor do jogo e acrescenta cinco modos, em degraus:</p>
{table(['Modo', 'Para quem', 'Ideia', 'Inspirado em'], [
    ['<b>1. Detetive</b>', '10+ anos', 'Joga com as próprias mãos e anota pistas num caderno no mapa; um robô-ajudante comenta as deduções.', 'Mundo de Wumpus do AIMA ({r}); árbitro que já existe no jogo'.format(r=R('aima'))],
    ['<b>2. Programador com blocos</b>', '10–15 anos', 'Monta o programa do robô com blocos (avançar, girar, repetir, se sentir…) numa campanha de missões curtas.', 'Lightbot, Blockly Games (Maze), Code.org/Minecraft, Karel'],
    ['<b>3. Cientista de agentes</b>', '14–18 anos', 'Passa dos blocos para o código (JavaScript ou Python) e coloca o agente para disputar a Arena da turma.', 'Blockly Games (Pond), CodeCombat, Human Resource Machine'],
    ['<b>4. Criador de cavernas</b>', 'todas', 'Desenha mapas, cria desafios e troca com colegas por um código curto.', 'Scratch (criar e remixar)'],
    ['<b>5. Desplugado</b>', 'todas', 'Tabuleiro e cartas impressos para jogar sem computador, em dupla: um "programa", o outro "é o robô".', 'Robot Turtles, CS Unplugged, Bebras'],
])}
{box('decision', 'Por que adaptar o Wumpus em vez de começar do zero', '<ul><li>As regras já estão isoladas em <code>world.ts</code>, sem 3D nem tela: dá para trocar a interface sem tocar nelas.</li><li>Os agentes já recebem só percepções e rodam isolados (Worker): um programa de blocos pode virar um agente comum, sem nenhum risco ao jogo.</li><li>O árbitro (<code>referee.ts</code>) já mede "erros de lógica" e "riscos desnecessários": é avaliação formativa pronta.</li><li>Sementes, desafios e relatórios já existem: o professor pode dar o mesmo conjunto de cavernas para a turma inteira e comparar.</li></ul>')}
{box('notdo', 'O que este documento não faz', '<p>Nada foi alterado no repositório nem no site. É uma proposta: as ideias, as telas desenhadas e o roteiro servem para decidir o que construir.</p>')}
''')

section('2', 'Pensamento computacional: o que ensinar', f'''
<p>{R('wing')} descreve o pensamento computacional como uma forma de resolver problemas que serve a todos, não só a quem programa. {R('brennan')}, estudando jovens no Scratch, propõem olhar para três dimensões, que este documento usa como guia:</p>
{table(['Dimensão', 'O que é', 'Onde aparece no Wumpus'], [
    ['<b>Conceitos</b>', 'Sequências, repetições, condicionais, eventos, dados, operadores, paralelismo.', 'Programa do robô (sequência de passos), "repetir até", "se sentir brisa", memória das salas visitadas.'],
    ['<b>Práticas</b>', 'Experimentar e iterar, testar e depurar, reutilizar e remixar, abstrair e modularizar.', 'Executar passo a passo, ver onde o robô caiu, criar funções ("voltar para casa"), remixar mapas de colegas.'],
    ['<b>Perspectivas</b>', 'Expressar-se, conectar-se com outros, questionar a tecnologia.', 'Criar cavernas, competir e colaborar na Arena, discutir "como uma máquina decide sem ver?".'],
])}
<p>Os desafios {R('bebras')} organizam suas tarefas em torno de abstração, decomposição, pensamento algorítmico, avaliação e generalização. No Wumpus, cada uma tem um momento natural:</p>
{table(['Habilidade', 'Momento no jogo'], [
    ['Decomposição', '"Achar o ouro e voltar" vira: explorar com segurança → pegar → voltar pelo caminho conhecido.'],
    ['Reconhecimento de padrões', 'Brisa sempre ao lado de poço; fedor ao lado do Wumpus; o mesmo trecho de programa serve em várias missões.'],
    ['Abstração', 'O mapa 2D e o caderno de pistas ignoram o 3D e guardam só o que importa: visitado, seguro, suspeito.'],
    ['Algoritmos', 'Regras do robô: "explore primeiro as salas seguras", "volte pelo caminho que conhece".'],
    ['Avaliação', 'Comparar dois programas pelo número de blocos, de passos e de mortes nas mesmas cavernas.'],
    ['Generalização', 'Um programa que vence uma caverna vence outras? A Arena responde com 50 cavernas sorteadas.'],
])}
<h2>Alinhamento com a BNCC Computação</h2>
<p>O Parecer CNE/CEB nº 2/2022 e a Resolução CNE/CEB nº 1/2022 ({R('bncc')}) complementam a BNCC com três eixos: <b>Pensamento Computacional</b>, <b>Mundo Digital</b> e <b>Cultura Digital</b>. A proposta toca nos três:</p>
<ul>
<li><b>Pensamento Computacional</b>: núcleo de todos os modos (algoritmos, decomposição, abstração, depuração).</li>
<li><b>Mundo Digital</b>: como um agente "percebe" o ambiente por sensores e guarda uma representação dele; o que é um sorteio com semente.</li>
<li><b>Cultura Digital</b>: trabalho colaborativo, compartilhamento de mapas, ética de agentes que decidem sozinhos.</li>
</ul>
{box('tip', 'Ligação com inteligência artificial', '<p>As "cinco grandes ideias" da iniciativa AI4K12, descritas por {r}, são percepção, representação e raciocínio, aprendizado, interação natural e impacto social. O Wumpus cobre muito bem as duas primeiras (o robô só sabe o que os sensores dizem e monta um modelo do mundo), e o agente genético dá um exemplo concreto de aprendizado para o ensino médio.</p>'.format(r=R('ai4k12')))}
<p class="small">Recomenda-se que o professor confira, no texto oficial da BNCC Computação, os códigos das habilidades de cada ano antes de montar o plano de aula; este documento cita só os eixos.</p>
''')

section('3', 'O que o Wumpus 3D já tem e o que atrapalha', f'''
{img('principal.png', 'O jogo hoje: vista 3D, percepções no topo, registro de eventos e painel lateral.', 'wide')}
<div class="cols">
<div>
<h2>Já ajuda</h2>
<ul>
<li><b>Grade e percepções simples</b>: fedor, brisa, brilho, batida e grito são "sensores" fáceis de explicar.</li>
<li><b>Crenças desenhadas no piso</b> ("Poço 56%", "Segura"): tornam visível o raciocínio do agente.</li>
<li><b>Pensamento do agente em texto</b> ("(2, 3) é segura, indo explorar").</li>
<li><b>Árbitro</b>: conta erros de lógica e riscos desnecessários de qualquer jogador, inclusive humano.</li>
<li><b>Sementes e desafios</b>: todos jogam as mesmas cavernas.</li>
<li><b>Relatórios e Análise</b>: gráficos prontos para comparar alunos e agentes.</li>
<li><b>Mapas em JSON</b>, salvar e importar.</li>
<li><b>Agentes isolados</b> num Worker, com contrato simples.</li>
</ul>
</div>
<div>
<h2>Atrapalha (para 10–18 anos)</h2>
<ul>
<li><b>Programar exige JavaScript</b> escrito à mão, e o contrato fala em <code>registerAgent</code>, <code>create(info)</code>.</li>
<li><b>Pontuação de adulto</b>: −1000 por morte, +500, −10 por tiro. Números grandes e negativos desanimam os menores.</li>
<li><b>Sem progressão</b>: o jogo começa no mapa completo, com Wumpus, poços e flecha ao mesmo tempo.</li>
<li><b>Linguagem técnica</b>: "probabilístico", "genoma", "semente", "fronteira".</li>
<li><b>Tema</b>: "O Wumpus te devorou!" funciona para adolescentes, mas pede um tom mais leve para os de 10–11 anos.</li>
<li><b>3D pesado</b> em computadores fracos de laboratório; percepções mostradas só por cor e texto pequeno.</li>
<li><b>Nada para o professor</b>: sem turmas, missões montadas ou plano de aula.</li>
</ul>
</div>
</div>
''')

section('4', 'Jogos pesquisados e o que aproveitar', f'''
<p>Foram analisados jogos e atividades usados no ensino de pensamento computacional. A coluna da direita diz o que cada um sugere para o Wumpus. Nenhum deve ser copiado: a ideia é aproveitar o <b>mecanismo pedagógico</b>, com arte, missões e textos próprios.</p>
{table(['Jogo / atividade', 'Como funciona', 'Ideia para o Wumpus'], [
    ['<b>Lightbot</b> (SpriteBox; versão "Hour of Code" gratuita)', 'Programa-se um robô numa grade com fichas de comando; poucas casas para o programa obrigam a usar procedimentos e repetições.', '<b>Limite de blocos por missão</b> e estrelas por programa curto; caixa "função" para "voltar para casa".'],
    ['<b>Blockly Games</b> (Google; Maze, Bird, Turtle, Pond)', 'Sequência de jogos com blocos, cada um focando um conceito (laços, condicionais); o último (Pond) é uma disputa de "patos" programados, com blocos ou JavaScript.', 'Usar a <b>biblioteca Blockly</b> (código aberto) para o editor; transição <b>blocos → texto</b> como no Pond, que é exatamente a nossa Arena.'],
    ['<b>Code.org — Minecraft Adventurer</b>', 'Tutoriais de uma hora com blocos num mundo conhecido; o fim é um nível livre.', 'Campanha de <b>~1 hora</b> para a primeira aula; nível livre ao final.'],
    ['<b>Karel the Robot</b> {r}'.format(r=R('karel')), 'Robô literal num mundo em grade, ensinado por refinamento passo a passo.', 'O robô do Wumpus é um "Karel com sensores": reaproveitar a ideia de <b>refinamento</b> (criar comandos novos a partir dos simples).'],
    ['<b>Human Resource Machine</b> (Tomorrow Corporation)', 'Começa com 2 comandos e chega a 11; cada fase premia programas curtos e rápidos.', '<b>Liberar blocos aos poucos</b>; dois desafios de otimização por missão: menos blocos e menos passos.'],
    ['<b>CodeCombat</b>', 'Jogo de aventura em que se digita Python ou JavaScript; painel do professor vê o código de cada aluno.', 'Modo texto com <b>Python</b> para o ensino médio e <b>painel da turma</b> com o código de cada um.'],
    ['<b>Scratch</b> {r}'.format(r=R('scratch')), 'Criar e compartilhar histórias e jogos; remixar o projeto de outro.', '<b>Editor de cavernas</b> e troca por código curto; remixar a caverna de um colega.'],
    ['<b>Robot Turtles</b> (jogo de tabuleiro)', 'A criança dá cartas de comando e um adulto "executa" como se fosse o computador.', '<b>Versão desplugada</b>: tabuleiro 4×4 impresso, cartas de comando e cartas de percepção.'],
    ['<b>CS Unplugged</b> {r}'.format(r=R('unplugged')), 'Atividades de computação com papel, cartões e movimento, sem computador.', 'Aula inicial sem tela: um aluno é o robô vendado, os colegas dão comandos e o "robô" só diz o que sente.'],
    ['<b>Desafio</b> {r}'.format(r=R('bebras')), 'Tarefas curtas de múltipla escolha, por faixa etária, sem exigir programação.', '<b>Cartões-desafio</b> de 3 minutos ("onde está o poço?") para aquecimento e avaliação diagnóstica.'],
    ['<b>Machine Learning for Kids</b> (Dale Lane)', 'Treinar modelos simples e usá-los como blocos no Scratch.', 'No ensino médio: "treine seu robô" com o <b>agente genético</b> já existente, vendo os pesos mudarem.'],
])}
{box('trap', 'Cuidado com cópias', '<p>Inspiração em mecânicas é comum e saudável; usar nomes, personagens, fases ou arte de outros jogos não. Blockly é código aberto (licença Apache 2.0) e pode ser usado como biblioteca. Vale registrar que, segundo a Wikipédia, a manutenção do Blockly passou do Google para a Raspberry Pi Foundation a partir de novembro de 2025; conferir a situação antes de adotar.</p>')}
''')

section('5', 'Os cinco modos em detalhe', f'''
{PROGRESSION}
<h2>Modo 1 — Detetive (10+ anos)</h2>
{fig(MOCK_NOTEBOOK, 'Esboço: o aluno marca no caderno o que sabe de cada sala; o robô-ajudante comenta com perguntas, sem entregar a resposta.')}
<ul>
<li>O aluno joga com teclado, toque ou botões grandes, numa <b>vista 2D de cima</b> (a 3D vira opcional).</li>
<li>Cada sala do <b>Caderno</b> recebe uma marca do aluno: visitada, segura, poço?, Wumpus?, poço certo. Isso torna a <b>abstração</b> explícita.</li>
<li>O <b>robô-ajudante</b> usa a base de conhecimento que já existe (<code>knowledge.ts</code>) para comparar a marca do aluno com o que dá para deduzir, e responde com perguntas ("E a sala (1,2)? Ela é vizinha de uma sala sem brisa…"), nunca com a resposta pronta.</li>
<li>O <b>árbitro</b> vira feedback amigável no fim: "Você entrou numa sala que dava para saber que era perigosa" em vez de "erro de lógica: 1".</li>
</ul>

<h2>Modo 2 — Programador com blocos (10–15 anos)</h2>
{fig(MOCK_BLOCKS, 'Esboço: paleta de blocos à esquerda, programa no meio (o bloco que está rodando fica destacado), caverna 2D à direita, com a percepção escrita em linguagem simples.')}
<ul>
<li><b>Blocos</b>: avançar, girar à esquerda/direita, pegar ouro, atirar; repetir N vezes, repetir até; se sentir brisa/fedor/brilho, senão; funções; e, mais tarde, "lembrar sala" (variáveis/listas).</li>
<li><b>Execução visível</b>: ▶ executar, ⏭ um passo, velocidade; o bloco atual brilha e o robô anda. Depurar fica concreto.</li>
<li><b>Campanha de missões</b> (capítulo 6), liberando blocos aos poucos (Human Resource Machine) e com limite de blocos (Lightbot).</li>
<li><b>Ver o código</b>: um botão mostra o JavaScript gerado pelos blocos, ponte para o modo 3.</li>
</ul>

<h2>Modo 3 — Cientista de agentes (14–18 anos)</h2>
<ul>
<li>Editor de texto com <b>JavaScript</b> (o contrato atual) e, como opção, <b>Python</b> (por exemplo, rodando Python no navegador, como o Pyodide, dentro do mesmo Worker isolado).</li>
<li>Modelo pronto com lacunas ("complete a regra de quando atirar"), em vez de arquivo vazio.</li>
<li><b>Arena da turma</b>: o professor cria uma competição com semente; cada aluno envia seu agente; o ranking e os relatórios já existem.</li>
<li><b>Trilha de IA</b> para 16–18 anos: ligar o desenho de crenças, mostrar a conta de probabilidade (o exemplo de 56% já está na documentação técnica) e treinar o agente genético.</li>
</ul>

<h2>Modo 4 — Criador de cavernas (todas as idades)</h2>
<ul>
<li>Editor visual: clicar para pôr poço, Wumpus e ouro; o jogo avisa se a caverna não tem solução (a busca em largura já existe em <code>world.ts</code>).</li>
<li>Compartilhar por <b>código curto</b> (o JSON de mapa já existe) e <b>remixar</b> a caverna de um colega.</li>
<li>Desafio entre pares: "minha caverna derrota o seu programa?".</li>
</ul>

<h2>Modo 5 — Desplugado (todas as idades)</h2>
<ul>
<li>PDF para imprimir: tabuleiro 4×4, fichas de poço, Wumpus e ouro, cartas de comando (avançar, girar, repetir, se…) e cartões de percepção.</li>
<li>Dinâmica em dupla: o "programador" monta a sequência de cartas; o "robô" executa sem ver o mapa e só diz o que sente; o "mestre da caverna" conhece o mapa.</li>
<li>Serve para a primeira aula, para escolas sem laboratório e para conversar sobre "o que é um algoritmo" antes da tela.</li>
</ul>
''')

LEVELS = [
    ['1', 'Primeiros passos', 'Levar o robô até o ouro, sem perigos.', 'avançar, girar', 'Sequência'],
    ['2', 'Volta para casa', 'Pegar o ouro e voltar à entrada.', '+ pegar', 'Sequência, decomposição'],
    ['3', 'O corredor longo', 'Mesmo caminho repetido muitas vezes; só cabem 4 blocos.', '+ repetir N', 'Repetição'],
    ['4', 'Escada', 'Padrão "avançar, girar, avançar, girar…".', '(mesmos)', 'Padrões, repetição aninhada'],
    ['5', 'Brisa!', 'Um poço no caminho; o robô sente brisa antes.', '+ se sentir brisa', 'Condicional'],
    ['6', 'Um programa, três cavernas', 'O mesmo programa precisa vencer 3 cavernas parecidas.', '+ senão', 'Generalização, teste'],
    ['7', 'Repetir até achar', 'O ouro está em lugar desconhecido.', '+ repetir até', 'Laço com condição'],
    ['8', 'Caminho de volta', 'Criar a função "voltar para casa" e usá-la em 2 missões.', '+ função', 'Abstração, modularização'],
    ['9', 'O monstro dorme', 'O Wumpus aparece (sem poços); fedor ao lado dele.', '+ atirar', 'Condicional composta'],
    ['10', 'Memória do robô', 'Não entrar duas vezes na mesma sala.', '+ lembrar sala', 'Variáveis, listas'],
    ['11', 'Caverna completa', 'Poços, Wumpus e ouro, como no jogo original.', 'todos', 'Integração'],
    ['12', 'Arena da turma', 'Seu programa contra 20 cavernas sorteadas pela professora.', 'todos', 'Avaliação, generalização'],
]
section('6', 'Campanha de missões (exemplo)', f'''
<p>Uma sequência possível para o modo 2, pensada para 3 a 4 aulas de 50 minutos. Cada missão tem uma meta, os blocos liberados e o conceito em foco. As primeiras usam cavernas fixas e sem perigo, uma diferença importante em relação ao jogo atual, que sempre começa completo.</p>
{table(['#', 'Missão', 'Meta', 'Blocos', 'Conceito'], LEVELS)}
<h2>Estrelas no lugar da pontuação</h2>
<p>Para 10–15 anos, cada missão dá até <b>três estrelas</b>: ★ concluiu, ★★ sem morrer em nenhuma tentativa de teste da mesma missão, ★★★ com o menor número de blocos sugerido. A pontuação original (−1, −1000, +500…) continua existindo no modo 3 e na Arena, porque é ela que dá sentido ao agente genético.</p>
{box('decision', 'Morrer não reinicia tudo', '<p>No modo educacional, cair no poço mostra <b>onde</b> o programa falhou (o bloco fica vermelho) e volta o robô ao início da mesma caverna, com o programa intacto. Errar vira parte do ciclo de testar e depurar, uma das práticas de Brennan e Resnick.</p>')}
''')

section('7', 'Faixas etárias', f'''
{table(['', '10–12 anos', '13–15 anos', '16–18 anos'], [
    ['<b>Modos</b>', 'Desplugado, Detetive, Blocos (missões 1–8)', 'Blocos (todas), Criador, primeiros passos no texto', 'Texto (JS/Python), Arena, trilha de IA'],
    ['<b>Conceitos</b>', 'Sequência, repetição, condicional simples', 'Condicionais compostas, funções, variáveis, depuração', 'Busca em largura, lógica proposicional, probabilidade, otimização, algoritmo genético'],
    ['<b>Visual</b>', 'Vista 2D, ícones grandes, tema leve ("o Wumpus te pegou")', '2D com opção 3D', '3D completo, crenças e números'],
    ['<b>Feedback</b>', 'Estrelas, robô-ajudante com perguntas', 'Estrelas + quantidade de passos e blocos', 'Pontuação AIMA, relatórios, ranking'],
    ['<b>Duração</b>', 'Atividades de 10–15 min', 'Missões de 15–20 min', 'Projetos de várias aulas'],
])}
<p>As faixas são indicativas. O que muda de verdade é o <b>degrau</b>: um aluno de 16 anos sem experiência começa nas missões; um de 12 que já programa em Scratch pode ir direto ao modo texto.</p>
<h2>Linguagem e tema</h2>
<ul>
<li>Textos curtos, em frases diretas, sem "fronteira", "genoma" ou "probabilístico" nos modos 1 e 2 (os termos aparecem num glossário com exemplos).</li>
<li>Mensagens que encorajam ("Quase! O robô caiu no poço em (3,1). Que pista avisava isso?").</li>
<li>Wumpus redesenhado com cara de criatura de desenho animado para os menores; a versão atual continua para o ensino médio.</li>
</ul>
''')

section('8', 'Professor, avaliação e inclusão', f'''
<h2>Ferramentas do professor</h2>
<ul>
<li><b>Turma por código</b>: o professor cria um código; os alunos entram com um apelido. Nada de e-mail ou nome completo.</li>
<li><b>Missões da aula</b>: escolher missões, cavernas e semente; os alunos recebem o mesmo conjunto.</li>
<li><b>Painel</b>: quem concluiu o quê, quantas tentativas, número de blocos, onde mais se erra; abrir o programa de um aluno (ideia do CodeCombat).</li>
<li><b>Planos de aula</b> prontos por faixa etária, com o eixo da BNCC Computação de cada atividade.</li>
</ul>
<h2>Como avaliar</h2>
<p>{R('brennan')} sugerem combinar análise dos projetos, entrevistas sobre os artefatos e cenários de projeto. No Wumpus, isso pode ser:</p>
{table(['Instrumento', 'Como o jogo ajuda'], [
    ['Análise dos programas', 'Guardar cada versão do programa: dá para ver se o aluno passou a usar repetições e funções.'],
    ['Entrevista sobre o artefato', 'Botão "explique seu programa": o aluno grava ou escreve por que cada bloco está ali.'],
    ['Cenários de projeto', 'Mostrar o programa de um "colega fictício" com erro e pedir para achar e corrigir.'],
    ['Diagnóstico rápido', 'Cartões-desafio no estilo Bebras no início e no fim da sequência de aulas.'],
    ['Raciocínio lógico', 'O árbitro atual: entradas em salas que já dava para saber perigosas, riscos sem necessidade.'],
])}
<h2>Acessibilidade</h2>
<ul>
<li>Percepções com <b>ícone + palavra + som</b>, nunca só cor; paleta segura para daltonismo.</li>
<li>Vista 2D navegável por teclado e leitor de tela ("Sala (2,1): você sente brisa"). A falta de descrição textual do 3D já está nas pendências do projeto.</li>
<li>Botões grandes para toque; funciona em celular e Chromebook; modo leve sem 3D para computadores antigos.</li>
<li>Leitura em voz alta das mensagens (síntese de voz do navegador).</li>
</ul>
<h2>Privacidade (LGPD)</h2>
<p>O art. 14 da LGPD ({R('lgpd')}) exige que o tratamento de dados de crianças e adolescentes atenda ao seu melhor interesse e, para crianças, consentimento específico de um dos pais ou responsável. A forma mais segura é <b>não coletar dados pessoais</b>: apelidos, progresso guardado no próprio navegador (como o jogo já faz) e exportação de arquivo para o professor. Se um dia houver servidor e contas, a escola e um especialista em proteção de dados devem participar do desenho.</p>
''')

section('9', 'Como isso entra no código atual', f'''
<p>A arquitetura do projeto separa regras, 3D, agentes e interface; quase tudo da proposta pode ser <b>acrescentado</b>, sem mexer nas regras nem na Arena atuais.</p>
{table(['Peça nova', 'Onde', 'Reaproveita'], [
    ['Missões (cavernas fixas, blocos liberados, metas, estrelas)', '<code>src/edu/missions.ts</code> (dados em JSON)', '<code>MapLayout</code>, <code>parseLayout</code>, <code>WumpusWorld.fromLayout</code>'],
    ['Editor de blocos', '<code>src/edu/blocks.ts</code> com a biblioteca Blockly', 'Gerador de JavaScript no formato do contrato de agentes (<code>registerAgent</code>)'],
    ['Execução passo a passo com destaque do bloco', '<code>src/edu/runner.ts</code>', '<code>WorkerSandbox</code> (o programa do aluno roda isolado), <code>playEpisode</code>'],
    ['Vista 2D e caderno do detetive', '<code>src/render/view2d.ts</code> (canvas ou SVG)', 'Lê o mesmo estado que <code>view.ts</code>; marcas do aluno comparadas com <code>Knowledge</code>'],
    ['Robô-ajudante', '<code>src/edu/helper.ts</code>', '<code>Knowledge</code> (deduções) e <code>Referee</code> (erros de lógica)'],
    ['Editor de cavernas', '<code>src/ui/editor-panel.ts</code>', 'Verificação de caminho (<code>reachable</code>) e JSON de mapa'],
    ['Turma, painel do professor', '<code>src/edu/class.ts</code>', 'Sementes (<code>arenaMaps</code>), relatórios e tela de Análise'],
    ['Python no navegador (opcional)', 'Worker separado', 'Mesmo contrato JSON de percepções e ações'],
    ['Material desplugado', '<code>scripts/docs/desplugado.py</code>', 'Gerador de PDF que o projeto já usa'],
])}
{box('trap', 'Invariantes do projeto que pedem decisão', '<ul><li><b>Pontuação (invariante 5)</b>: as estrelas devem ser uma camada <i>de exibição</i> do modo educacional. Mudar a pontuação do motor invalidaria o agente genético e os números medidos.</li><li><b>Mapas sorteados (invariante 6)</b>: as primeiras missões precisam de cavernas sem poço ou sem Wumpus. Como mapas importados já não são checados, as missões podem ser mapas fixos em JSON, sem mudar o sorteio.</li><li><b>Morte que não reinicia</b>: implementar como "recomeçar a mesma caverna mantendo o programa", na interface; a regra do motor continua igual.</li><li><b>Agentes isolados (invariante 2)</b>: o programa de blocos deve rodar no Worker, como os agentes importados, e nunca receber o objeto do mundo.</li></ul>')}
<h2>Escolha técnica: um site ou dois?</h2>
<p>Recomenda-se <b>o mesmo repositório e motor, com uma entrada separada</b> (por exemplo, <code>/escola/</code>), para que a versão educacional tenha tela inicial, linguagem e visual próprios sem esconder nada da versão atual, que continua servindo à universidade e à Arena dos desenvolvedores.</p>
''')

section('10', 'Roteiro sugerido', f'''
{table(['Fase', 'Entrega', 'Para validar', 'Tamanho'], [
    ['<b>0. Desplugado</b>', 'PDF de tabuleiro e cartas; roteiro de uma aula.', 'Uma turma de 10–12 anos joga sem computador.', 'Pequeno'],
    ['<b>1. Base</b>', 'Entrada <code>/escola/</code>, vista 2D, textos simples, percepções com ícone e som.', 'Crianças entendem as percepções sem ajuda?', 'Médio'],
    ['<b>2. Blocos</b>', 'Editor Blockly, execução passo a passo, missões 1–8, estrelas.', 'Teste com 2–3 turmas: onde travam? quanto tempo por missão?', 'Grande'],
    ['<b>3. Detetive</b>', 'Caderno de pistas e robô-ajudante.', 'As marcas dos alunos melhoram ao longo das cavernas?', 'Médio'],
    ['<b>4. Professor</b>', 'Turma por código, painel, exportar progresso, planos de aula.', 'Professores conseguem montar uma aula sozinhos?', 'Médio'],
    ['<b>5. Criar e competir</b>', 'Editor de cavernas, missões 9–12, modo texto e Arena da turma.', 'Alunos do ensino médio criam agentes que vencem o lógico?', 'Grande'],
    ['<b>6. IA e Python</b>', 'Trilha de probabilidade e genético; Python opcional.', 'Uso em disciplina eletiva do ensino médio.', 'Médio'],
])}
<p>"Tamanho" é relativo entre as fases. Os prazos dependem de quem vai desenvolver e de quantos testes com turmas forem possíveis; recomenda-se testar com alunos ao fim de cada fase antes de seguir.</p>
<h2>Riscos</h2>
{table(['Risco', 'Como reduzir'], [
    ['Carga cognitiva alta (3D + regras + programação ao mesmo tempo)', 'Começar desplugado e em 2D; um conceito novo por missão.'],
    ['Tema assustador para os menores', 'Arte e mensagens mais leves no modo 10–12; tema original no ensino médio.'],
    ['Computadores fracos ou sem internet', 'Vista 2D leve; o jogo já funciona offline depois de carregado e salva no navegador.'],
    ['Professores sem formação em computação', 'Planos de aula prontos, vídeos curtos e o modo desplugado.'],
    ['Dados de menores', 'Sem contas nem dados pessoais; tudo local; exportação por arquivo.'],
    ['Copiar jogos existentes', 'Usar só mecânicas pedagógicas gerais; arte, missões e textos próprios.'],
])}
''')

refs_html = ''.join(f'<li>{full}</li>' for _, (_, full) in sorted(REFS.items(), key=lambda kv: kv[1][1]))
web = [
    'Lightbot — recursos para educadores: lightbot.com/resources.html',
    'Blockly Games — sobre: blockly.games/about',
    'Blockly (biblioteca): developers.google.com/blockly; Wikipédia, verbete "Blockly" (transição para a Raspberry Pi Foundation)',
    'Code.org — Minecraft Adventurer: studio.code.org/s/mc',
    'Human Resource Machine — Wikipédia (en.wikipedia.org/wiki/Human_Resource_Machine) e página da Tomorrow Corporation no itch.io',
    'CodeCombat — análise da Common Sense Education: commonsense.org/education/reviews/codecombat',
    'Robot Turtles — reportagens da NPR (2013) e TechCrunch (2013)',
    'Bebras no Brasil — reportagens de Folha de Pernambuco e Catraca Livre sobre o desafio organizado pela UpMat Educacional',
    'Bebras — faixas etárias: bebras.uk e materiais da TU Wien',
    'Machine Learning for Kids — Dale Lane, No Starch Press, 2021 (penguinrandomhouse.com)',
    'AI4K12 — resumo das cinco grandes ideias: raspberrypi.org/blog/ai-education-ai4k12-big-ideas-ai-thinking',
]
section('11', 'Referências', f'''
<h2>Obras e documentos</h2>
<ol class="refs">{refs_html}</ol>
<h2>Páginas consultadas sobre os jogos (novembro de 2026)</h2>
<ul class="small">{''.join(f'<li>{w}</li>' for w in web)}</ul>
<p class="small">Os dados de cada jogo (comandos, conceitos, faixas etárias) vêm dessas páginas e podem mudar. Preços e disponibilidade não foram considerados.</p>
''')

extra_css = '''
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.cols ul { padding-left: 4.5mm; } .cols li { font-size: 9.6pt; margin-bottom: 1.2mm; }
figure.mock { margin: 3mm 0 4mm; break-inside: avoid; }
figure.mock figcaption { font-family: Inter, sans-serif; font-size: 8.6pt; color: #6b5f50; margin-top: 1.5mm; }
svg.mocksvg { width: 100%; font-family: Inter, sans-serif; display: block; margin: 2mm 0; }
.cite { white-space: nowrap; color: #34507d; }
.small, ul.small li { font-size: 8.8pt; color: #5e5850; }
ol.refs li { font-size: 9.2pt; margin-bottom: 2mm; line-height: 1.4; }
table.compact td { vertical-align: top; }
'''

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)
doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Wumpus 3D na escola</title>
<style>{css}{extra_css}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Wumpus 3D · Proposta educacional</div>
    <h1>Caverna do Pensamento</h1>
    <p class="sub">Como adaptar o Wumpus 3D para ensinar pensamento computacional a crianças e jovens de 10 a 18 anos, com ideias de jogos que já fazem isso.</p>
    <div class="grid"><i class="e"></i><i></i><i class="p"></i><i></i><i></i><i class="w"></i><i class="g"></i><i></i><i></i><i></i><i></i><i class="p"></i><i></i><i class="p"></i><i></i><i></i></div>
  </div>
  <div class="meta">
    <span>Tipo</span><b>Proposta de mudanças (nada foi alterado no repositório)</b>
    <span>Base</span><b>Wumpus 3D, branch refatoracao (commit 14546c8)</b>
    <span>Data</span><b>2 de novembro de 2026</b>
    <span>Público</span><b>Professores, coordenação pedagógica e quem vai desenvolver</b>
  </div>
</div>
<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol></nav>
{''.join(sections)}
</body></html>'''
OUT.write_text(doc)
print('ok')
