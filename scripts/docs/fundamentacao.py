# Gera o PDF "Agente genético — fundamentação teórica".
import html, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]  # raiz do projeto
OUT = pathlib.Path(sys.argv[1])
IMG = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).parent / 'img'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
_hoje = __import__('datetime').date.today()
DATE = f'{_hoje.day} de {MESES[_hoje.month - 1]} de {_hoje.year}'
COMMIT = subprocess.run(['git', '-C', str(ROOT), 'log', '-1', '--format=%h'], capture_output=True, text=True).stdout.strip()

# CSS: o mesmo da documentação técnica
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


def snip(path, start, end=None, lines=None, label=None):
    src = (ROOT / path).read_text().split('\n')
    i = next(n for n, l in enumerate(src) if start in l)
    j = i + lines - 1 if lines else next(n for n in range(i + 1, len(src)) if end in src[n])
    ind = min((len(l) - len(l.lstrip()) for l in src[i : j + 1] if l.strip()), default=0)
    body = '\n'.join(l[ind:] for l in src[i : j + 1])
    return f'<figure class="code"><figcaption>{esc(label or path)} <span>linhas {i + 1}–{j + 1}</span></figcaption><pre>{highlight(body)}</pre></figure>'


def box(kind, title, body):
    return f'<aside class="box {kind}"><b>{title}</b>{body}</aside>'


def table(head, rows, cls=''):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


# ---------------------------------------------------------------- Referências (todas verificadas)
# Cada entrada: chave -> (citação curta, referência completa em HTML)
REFS = {
    'aima': ('Russell e Norvig (2020)',
             'RUSSELL, Stuart; NORVIG, Peter. <i>Artificial Intelligence: A Modern Approach</i>. 4. ed. Hoboken: Pearson, 2020. ISBN 978-0-13-461099-3. '
             'Site dos autores: <a href="https://aima.cs.berkeley.edu/">aima.cs.berkeley.edu</a>. '
             'Página da editora: <a href="https://www.pearson.com/en-us/subject-catalog/p/Russell-Artificial-Intelligence-A-Modern-Approach-4th-Edition/P200000003500/9780134610993">pearson.com</a>. '
             'Capítulos usados: cap. 4 (<i>Search in Complex Environments</i>, que inclui algoritmos evolutivos), cap. 7 (<i>Logical Agents</i>, mundo de Wumpus lógico) e seção 12.7 (<i>The Wumpus World Revisited</i>, Wumpus probabilístico).'),
    'samuel': ('Samuel (1959)',
               'SAMUEL, Arthur L. Some studies in machine learning using the game of checkers. <i>IBM Journal of Research and Development</i>, v. 3, n. 3, p. 210–229, 1959. '
               'DOI: <a href="https://doi.org/10.1147/rd.33.0210">10.1147/rd.33.0210</a>. Cópia em PDF: <a href="https://people.csail.mit.edu/brooks/idocs/Samuel.pdf">people.csail.mit.edu/brooks/idocs/Samuel.pdf</a>.'),
    'chellapilla': ('Chellapilla e Fogel (1999)',
                    'CHELLAPILLA, Kumar; FOGEL, David B. Evolving neural networks to play checkers without relying on expert knowledge. <i>IEEE Transactions on Neural Networks</i>, v. 10, n. 6, p. 1382–1391, 1999. '
                    'DOI: <a href="https://doi.org/10.1109/72.809083">10.1109/72.809083</a>.'),
    'holland': ('Holland (1992)',
                'HOLLAND, John H. <i>Adaptation in Natural and Artificial Systems</i>. Cambridge: MIT Press, 1992. ISBN 978-0-262-58111-0. (Primeira edição pela MIT Press; a obra foi publicada originalmente em 1975.)'),
    'goldberg': ('Goldberg (1989)',
                 'GOLDBERG, David E. <i>Genetic Algorithms in Search, Optimization, and Machine Learning</i>. Reading: Addison-Wesley, 1989. ISBN 0-201-15767-5.'),
    'eiben': ('Eiben e Smith (2015)',
              'EIBEN, A. E.; SMITH, J. E. <i>Introduction to Evolutionary Computing</i>. 2. ed. Berlin: Springer, 2015. (Natural Computing Series). '
              'DOI: <a href="https://doi.org/10.1007/978-3-662-44874-8">10.1007/978-3-662-44874-8</a>.'),
    'michalewicz': ('Michalewicz (1996)',
                    'MICHALEWICZ, Zbigniew. <i>Genetic Algorithms + Data Structures = Evolution Programs</i>. 3. ed. rev. e ampl. Berlin: Springer, 1996. '
                    'DOI: <a href="https://doi.org/10.1007/978-3-662-03315-9">10.1007/978-3-662-03315-9</a>.'),
    'goldbergdeb': ('Goldberg e Deb (1991)',
                    'GOLDBERG, David E.; DEB, Kalyanmoy. A comparative analysis of selection schemes used in genetic algorithms. In: RAWLINS, G. J. E. (ed.). <i>Foundations of Genetic Algorithms</i>, v. 1, p. 69–93, 1991. '
                    'Cópia em PDF: <a href="https://www.cse.unr.edu/~sushil/class/gas/papers/Select.pdf">cse.unr.edu/~sushil/class/gas/papers/Select.pdf</a>.'),
    'miller': ('Miller e Goldberg (1995)',
               'MILLER, Brad L.; GOLDBERG, David E. Genetic algorithms, tournament selection, and the effects of noise. <i>Complex Systems</i>, v. 9, n. 3, 1995. '
               'Resumo: <a href="https://www.complex-systems.com/abstracts/v09_i03_a02/">complex-systems.com/abstracts/v09_i03_a02</a>.'),
    'jin': ('Jin e Branke (2005)',
            'JIN, Yaochu; BRANKE, Jürgen. Evolutionary optimization in uncertain environments — a survey. <i>IEEE Transactions on Evolutionary Computation</i>, v. 9, n. 3, p. 303–317, 2005. '
            'DOI: <a href="https://doi.org/10.1109/TEVC.2005.846356">10.1109/TEVC.2005.846356</a>. '
            'Cópia em PDF: <a href="https://www.cs.le.ac.uk/people/sy11/ECiDUE/JinBranke-TEVC05.pdf">cs.le.ac.uk/people/sy11/ECiDUE/JinBranke-TEVC05.pdf</a>.'),
    'ross': ('Ross (2013)',
             'ROSS, Sheldon M. <i>Simulation</i>. 5. ed. Amsterdam: Academic Press (Elsevier), 2013. ISBN 978-0-12-415825-2. (Capítulo de técnicas de redução de variância, que inclui o uso de números aleatórios comuns.)'),
    'hastie': ('Hastie, Tibshirani e Friedman (2009)',
               'HASTIE, Trevor; TIBSHIRANI, Robert; FRIEDMAN, Jerome. <i>The Elements of Statistical Learning</i>. 2. ed. New York: Springer, 2009. '
               'PDF hospedado pelo autor: <a href="https://web.stanford.edu/~hastie/Papers/ESLII.pdf">web.stanford.edu/~hastie/Papers/ESLII.pdf</a>. (Cap. 7, <i>Model Assessment and Selection</i>.)'),
    'boxmuller': ('Box e Muller (1958)',
                  'BOX, G. E. P.; MULLER, Mervin E. A note on the generation of random normal deviates. <i>The Annals of Mathematical Statistics</i>, v. 29, n. 2, p. 610–611, 1958. '
                  'DOI: <a href="https://doi.org/10.1214/aoms/1177706645">10.1214/aoms/1177706645</a>. Acesso aberto: <a href="https://projecteuclid.org/euclid.aoms/1177706645">projecteuclid.org/euclid.aoms/1177706645</a>.'),
}
ORDER = list(REFS)


def cite(*keys):
    return '[' + '; '.join(f'<a class="ref" href="#ref-{k}">{REFS[k][0]}</a>' for k in keys) + ']'


OWN = '<span class="own">escolha de projeto</span>'
LIT = '<span class="lit">literatura</span>'
MIX = '<span class="mix">adaptação</span>'

sections, toc = [], []


def section(num, title, body):
    sid = f's{num}'
    toc.append((num, title, sid))
    sections.append(f'<section id="{sid}" class="chapter"><h1><span class="num">{num}</span>{title}</h1>{body}</section>')


SVG_FLOW = '''
<svg viewBox="0 0 720 210" class="diagram" role="img" aria-label="Como o agente genético decide">
  <defs><marker id="f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b2f22"/></marker></defs>
  <g font-family="Inter" font-size="11.5" text-anchor="middle">
    <g stroke-width="1.2">
      <rect x="8" y="20" width="120" height="70" rx="8" fill="#f3ede3" stroke="#c9b48a"/>
      <rect x="150" y="20" width="140" height="70" rx="8" fill="#eaf4ea" stroke="#8ac99a"/>
      <rect x="312" y="20" width="130" height="70" rx="8" fill="#f7ecea" stroke="#c99a8a"/>
      <rect x="464" y="20" width="120" height="70" rx="8" fill="#f7ecea" stroke="#c99a8a"/>
      <rect x="606" y="20" width="106" height="70" rx="8" fill="#f3ede3" stroke="#c9b48a"/>
      <rect x="312" y="130" width="272" height="62" rx="8" fill="#fff6d9" stroke="#d9b54a"/>
    </g>
    <g font-weight="700" fill="#3b2f22">
      <text x="68" y="46">Percepções</text><text x="220" y="46">Base de conhecimento</text>
      <text x="377" y="46">8 características</text><text x="524" y="46">Soma ponderada</text><text x="659" y="46">Ação</text>
      <text x="448" y="152">Algoritmo genético (fora da partida)</text>
    </g>
    <g font-size="10" fill="#5b4c3b">
      <text x="68" y="64">brisa, fedor,</text><text x="68" y="77">brilho, grito</text>
      <text x="220" y="64">lógica (AIMA cap. 7) +</text><text x="220" y="77">probabilidade (AIMA 12.7)</text>
      <text x="377" y="64">por sala candidata</text><text x="377" y="77">+ 3 da opção de tiro</text>
      <text x="524" y="64">nota = Σ peso × caract.</text><text x="524" y="77">(Samuel 1959)</text>
      <text x="659" y="64">ir à sala de</text><text x="659" y="77">maior nota ou atirar</text>
      <text x="448" y="170">escolhe os 11 pesos jogando milhares de partidas</text>
      <text x="448" y="183">(Holland 1992; Goldberg 1989; Eiben e Smith 2015)</text>
    </g>
    <g stroke="#3b2f22" stroke-width="1.3" fill="none" marker-end="url(#f)">
      <path d="M128 55H147"/><path d="M290 55H309"/><path d="M442 55H461"/><path d="M584 55H603"/>
      <path d="M524 130V93" stroke-dasharray="4 3"/>
    </g>
  </g>
</svg>'''

# ---------------------------------------------------------------- 1
section('1', 'Resposta direta', f'''
<p class="lead"><b>O agente genético do Wumpus 3D não foi construído a partir de um artigo, tese ou método publicado específico.</b> Ele foi projetado durante o desenvolvimento (por mim, o assistente que escreveu o código) combinando técnicas clássicas e bem documentadas. Este documento mostra de onde vem cada técnica e separa com clareza o que tem fundamentação na literatura do que foi uma escolha de projeto sem respaldo teórico específico.</p>

<h2>O que tem base na literatura</h2>
<ul>
<li>O problema e a forma de raciocinar sobre ele (deduções lógicas e probabilidade de poço): o mundo de Wumpus do livro AIMA {cite('aima')}.</li>
<li>A ideia de decidir com uma <b>soma ponderada de características</b> cujos pesos são aprendidos: a função de avaliação de Samuel para damas {cite('samuel')}; a evolução de funções de avaliação de jogos por computação evolutiva aparece em {cite('chellapilla')}.</li>
<li>O <b>algoritmo genético</b> em si e seus operadores (população, seleção por torneio, elitismo, cruzamento aritmético, mutação gaussiana) {cite('holland', 'goldberg', 'eiben', 'michalewicz', 'goldbergdeb')}.</li>
<li>O tratamento da <b>aptidão ruidosa</b> (cada partida depende da sorte do mapa): avaliar todos nos mesmos mapas e reavaliar os melhores {cite('jin', 'miller', 'ross')}.</li>
<li>A separação entre <b>treino e validação</b> {cite('hastie')}.</li>
</ul>

<h2>O que foi escolha de projeto, sem fundamentação específica</h2>
<ul>
<li>Quais características (genes) existem e como cada uma é calculada e normalizada. Na versão atual, as duas principais (risco de morte e distância) foram escolhidas para corresponder aos termos da pontuação, inspiradas na utilidade esperada do AIMA; as demais são intuição.</li>
<li>Os valores dos parâmetros: taxa e tamanho da mutação, tamanho do torneio, número de elites, limites dos pesos, número de finalistas e tamanho da validação. Eles <b>não</b> foram tirados de nenhuma recomendação publicada nem calibrados por um estudo sistemático. Foram escolhidos por julgamento e conferidos só pelo resultado final.</li>
<li>O genoma inicial que imita o agente probabilístico e o protocolo de pré-treino.</li>
</ul>

{box('notdo', 'Sobre as referências', '<p>Todas as referências deste documento foram conferidas em buscas na web em 28/10/2026 (títulos, autores, periódicos, volumes e DOIs). O que não pôde ser confirmado foi deixado de fora e está listado no apêndice A. Os DOIs foram confirmados nas páginas das editoras ou em registros bibliográficos; o acesso direto a doi.org estava bloqueado no ambiente usado, então os links não foram abertos um a um.</p>')}
''')

# ---------------------------------------------------------------- 2
section('2', 'Como o agente funciona', f'''
{SVG_FLOW}
<p>O agente genético herda do agente probabilístico a <b>base de conhecimento</b> e duas regras fixas: pegar o ouro quando sente brilho e voltar para a entrada quando já tem o ouro. Só a parte de <b>exploração</b> (para onde ir quando ainda não achou o ouro, e se deve atirar) é decidida pela fórmula com pesos evoluídos.</p>
<p>A cada passo, para cada sala da fronteira que não é perigo comprovado:</p>
<ol>
<li>calcula 8 números (as características <i>f</i><sub>1</sub>…<i>f</i><sub>8</sub>);</li>
<li>dá uma nota: <code>nota = w1·f1 + w2·f2 + … + w8·f8</code>;</li>
<li>escolhe a sala de maior nota.</li>
</ol>
<p>Se ainda tem flecha e o Wumpus está restrito a até 3 salas, calcula também a nota da opção "atirar" com outros 3 pesos. Se ela for maior que a da melhor sala, vai atirar. Os 11 pesos formam o <b>genoma</b>, e o algoritmo genético procura os pesos que dão a maior pontuação média.</p>
{snip('src/agents/agents.ts', 'const features = [', lines=13, label='src/agents/agents.ts — características e nota de cada sala')}
{snip('src/agents/agents.ts', 'if (s.hasArrow && candidates.size > 0 && candidates.size <= 3) {', lines=7, label='src/agents/agents.ts — nota da opção de tiro')}
''')

# ---------------------------------------------------------------- 3
section('3', 'Fundamentação de cada componente', f'''
<h2>3.1 O agente baseado em conhecimento</h2>
<p><b>No jogo:</b> a classe <code>Knowledge</code> deduz salas sem poço, possíveis posições do Wumpus e poços certos, e calcula a probabilidade de poço na fronteira por enumeração.</p>
<p><b>Base:</b> o mundo de Wumpus como problema de agente lógico (cap. 7) e a sua versão probabilística, em que a probabilidade de poço na fronteira é obtida somando sobre as configurações consistentes com as brisas (seção 12.7) {cite('aima')}.</p>
<p><b>Adaptação:</b> a probabilidade de o Wumpus estar numa sala candidata é proporcional à chance de ela não ter poço (o Wumpus é sorteado entre salas sem poço), calculada sala a sala, sem enumerar poços e Wumpus juntos. Essa aproximação é minha.</p>

<h2>3.2 Decidir por soma ponderada de características</h2>
<p><b>No jogo:</b> a nota de cada sala é uma combinação linear de características com pesos.</p>
<p><b>Base:</b> Samuel usou, no programa de damas, um polinômio de avaliação formado por termos (características do tabuleiro) com coeficientes ajustados automaticamente pelo próprio programa {cite('samuel')}. A ideia de função de avaliação como soma ponderada de características também é apresentada no AIMA, no capítulo sobre jogos {cite('aima')}. Chellapilla e Fogel evoluíram funções de avaliação para damas com computação evolutiva, usando redes neurais em vez de uma soma linear {cite('chellapilla')}.</p>
<p><b>Diferença:</b> aqui a soma é usada para escolher a próxima sala a explorar, não para avaliar posições de um jogo de dois jogadores. Essa transposição é uma adaptação minha.</p>
<p><b>Características em unidades de utilidade (versão 2, D19).</b> O AIMA define o agente racional como o que escolhe a ação de <b>maior utilidade esperada</b> {cite('aima')}. Na pontuação do jogo, entrar numa sala custa, em média, cerca de 1000 × P(morrer lá) pela morte e 1 ponto por passo do caminho. Por isso as duas primeiras características passaram a ser exatamente esses termos: o <b>risco</b> P(poço) + P(Wumpus) e a <b>distância</b>. Uma soma linear com pesos nessas duas já reproduz a regra do agente probabilístico (menor risco, desempate pela distância), e os outros genes permitem ao treino corrigir o que essa conta não vê, como o valor de abrir área nova. Na versão 1 o genético pesava P(poço) e P(Wumpus) separadamente e precisava acertar a proporção entre os dois pesos para chegar ao mesmo resultado. A escolha das características é {OWN}; a ideia de utilidade esperada é da literatura.</p>

<h2>3.3 Algoritmo genético</h2>
<p><b>No jogo:</b> <code>train()</code> mantém uma população de genomas, avalia, seleciona, cruza e muta por várias gerações.</p>
<p><b>Base:</b> o algoritmo genético foi formulado por Holland {cite('holland')} e popularizado por Goldberg {cite('goldberg')}. O AIMA apresenta algoritmos evolutivos no capítulo 4 {cite('aima')}. Eiben e Smith descrevem o esquema geral (representação, mutação, recombinação, modelo de população, seleção de pais e de sobreviventes) usado como referência de terminologia {cite('eiben')}.</p>

<h2>3.4 Representação com números reais</h2>
<p><b>No jogo:</b> cada gene é um número real entre −5 e 5. A população inicial é sorteada uniformemente nesse intervalo, e os valores mutados são limitados a ele.</p>
<p><b>Base:</b> representações com valores reais e seus operadores próprios são tratados em {cite('eiben', 'michalewicz')}. O intervalo ±5 é {OWN}.</p>

<h2>3.5 Seleção por torneio</h2>
<p><b>No jogo:</b> para escolher cada pai, sorteia 3 genomas e fica com o de maior aptidão (<code>TOURNAMENT = 3</code>).</p>
<p><b>Base:</b> Goldberg e Deb comparam esquemas de seleção, incluindo o torneio {cite('goldbergdeb')}. Miller e Goldberg modelam como o tamanho do torneio controla a pressão de seleção e como ela muda quando a aptidão tem ruído, que é o caso deste jogo {cite('miller')}. O tamanho 3 é {OWN}.</p>

<h2>3.6 Elitismo</h2>
<p><b>No jogo:</b> os 2 melhores genomas passam sem alteração para a próxima geração (<code>ELITE = 2</code>).</p>
<p><b>Base:</b> preservar os melhores indivíduos entre gerações é uma forma de seleção de sobreviventes, tema tratado em {cite('eiben')}. O número 2 é {OWN}.</p>

<h2>3.7 Cruzamento aritmético</h2>
<p><b>No jogo:</b> cada peso do filho é <code>pai × t + mãe × (1 − t)</code>, com <i>t</i> sorteado entre 0 e 1 <b>separadamente para cada peso</b>.</p>
{snip('src/agents/genetic.ts', 'function crossover(', lines=7)}
<p><b>Base:</b> o cruzamento aritmético (combinação convexa dos pais) é atribuído a Michalewicz {cite('michalewicz')}; implementações como as do HeuristicLab e do Scilab o citam como fonte. Na forma descrita por essas fontes, o mesmo α vale para todos os genes.</p>
<p><b>Diferença:</b> aqui <i>t</i> é sorteado para cada gene, o que é uma {MIX} minha. Não verifiquei se essa variante tem um nome estabelecido na literatura, então não atribuo nome a ela.</p>

<h2>3.8 Mutação gaussiana</h2>
<p><b>No jogo:</b> cada peso tem 20% de chance de receber um ruído normal de desvio padrão 0,8, e o resultado é limitado a ±5.</p>
{snip('src/agents/genetic.ts', 'function gaussian(', lines=5)}
<p><b>Base:</b> a mutação por soma de ruído normal é o operador usual para representação real {cite('eiben')}. O ruído normal é gerado pela transformação de Box–Muller {cite('boxmuller')}, que é exatamente a fórmula da função <code>gaussian()</code> acima. Os valores 20% e 0,8 são {OWN}.</p>

<h2>3.9 Aptidão ruidosa: os mesmos mapas para todos</h2>
<p><b>No jogo:</b> a aptidão é a pontuação média em M mapas sorteados, e <b>todos os genomas da mesma geração jogam os mesmos M mapas</b>. A cada geração, novos mapas são sorteados.</p>
<p><b>Base:</b> como os mapas são aleatórios, a aptidão é uma medida com ruído. Esse é um dos tipos de incerteza revisados por Jin e Branke, que discutem formas de lidar com ele, como avaliar várias vezes e usar médias {cite('jin')}. Usar os mesmos cenários aleatórios para comparar alternativas corresponde à técnica de <b>números aleatórios comuns</b>, um método de redução de variância em simulação {cite('ross')}.</p>
<p><b>Adaptação:</b> a combinação "mesmos mapas dentro da geração, mapas novos entre gerações" é uma {MIX} minha dessas ideias. Como todos os genomas da geração jogam os mesmos mapas, comparar as médias é o mesmo que comparar a diferença mapa a mapa: a seleção já é <b>pareada</b>.</p>
<p><b>Quanto ruído sobra.</b> Medido nos mesmos mapas, a diferença de pontuação entre o agente probabilístico e um genoma que o imita tem desvio padrão de cerca de 640 pontos por partida: quando duas estratégias parecidas divergem num mapa, uma pode vencer (+1500) e a outra morrer (−1000). Com M mapas, a incerteza da diferença média é de cerca de 1,96 × 640 ÷ √M: ±56 pontos com 500 mapas, ±28 com 2000 e ±18 com 5000. Por isso o pré-treino da versão 2 usa 500 mapas por geração (antes 120) e a validação final usa 2000 mapas (antes 360). É a <b>média explícita</b> discutida por Jin e Branke {cite('jin')}, com os tamanhos escolhidos por mim a partir dessa conta.</p>

<h2>3.10 Validação final em mapas novos</h2>
<p><b>No jogo:</b> na última geração, os 5 melhores jogam 3 × M mapas que nunca viram, e o vencedor dessa rodada é o resultado do treino.</p>
{snip('src/agents/genetic.ts', 'if (gen === opts.generations) {', lines=10)}
<p><b>Base:</b> avaliar o modelo escolhido em dados que não foram usados para escolhê-lo, para estimar o desempenho sem o viés da seleção {cite('hastie')}; e reavaliar soluções promissoras para reduzir o efeito do ruído na aptidão {cite('jin')}.</p>
<p><b>Motivo prático:</b> sem essa etapa, o genoma evoluído chegou a ficar <b>pior</b> que o escrito à mão (725 contra 760 pontos de média nos mesmos mapas), porque o "melhor" da última geração podia ter tido apenas mapas fáceis. O procedimento específico (5 finalistas, 3 × M mapas na tela, 2000 mapas no pré-treino) é {OWN}.</p>

<h2>3.11 Treino em vários tamanhos de mapa</h2>
<p><b>No jogo:</b> no pré-treino da versão 2, os mapas de cada geração (e da validação) são divididos entre 4×4 e 6×6, e a aptidão é a média em todos eles.</p>
<p><b>Base:</b> um modelo ajustado a um único tipo de dado tende a generalizar pior para outros; a avaliação deve usar dados representativos de onde o modelo será usado {cite('hastie')}. O genoma da versão 1 foi treinado só em 4×4 e já era melhor no 6×6, sinal de que distância e informação pesam mais em mapas grandes; treinar nos dois tamanhos expõe isso à seleção.</p>
<p><b>Adaptação:</b> a divisão meio a meio entre 4×4 e 6×6 é {OWN}.</p>

<h2>3.12 Comparação final pareada, com intervalo de confiança</h2>
<p><b>No jogo:</b> <code>npm run medir</code> e <code>npm run treinar</code> comparam agentes nos mesmos mapas e mostram a diferença média por partida com um intervalo de 95% (média ± 1,96 × desvio ÷ √n, aproximação normal). Um genoma só substitui o padrão se a comparação não indicar perda.</p>
<p><b>Base:</b> comparar alternativas nos mesmos cenários e analisar a diferença é o uso dos números aleatórios comuns em simulação {cite('ross')}; a separação entre os mapas de treino, os de seleção e os da medição final segue {cite('hastie')}.</p>
<p><b>Adaptação:</b> o critério de troca é {OWN}.</p>
''')

# ---------------------------------------------------------------- 4
DEF = [-4.64, -5, 3.42, -0.05, 0.1, -0.35, -1.05, 0.63, -1.02, 0.4, 3.04, -2.35]
BAY = [-5, -5, 5, -0.5, 0, 0, 0, 0, 0, 0, 2, -5]
cell_rows = [
    ['f1 · Poço', '<code>b.pit</code>', '0 a 1', 'Probabilidade de poço na sala, calculada por enumeração da fronteira.', f'{LIT} {cite("aima")}', DEF[0], 'Forte rejeição a salas com chance de poço.'],
    ['f2 · Wumpus', '<code>b.wumpus</code>', '0 a 1', 'Probabilidade de o Wumpus estar na sala: proporcional a 1 − P(poço) entre as candidatas, ou 0.', f'{MIX} (aproximação sala a sala)', DEF[1], 'Rejeição a salas onde o Wumpus pode estar.'],
    ['f3 · Segura', '<code>safe ? 1 : 0</code>', '0 ou 1', '1 se a dedução lógica prova que não há poço nem Wumpus.', f'{LIT} {cite("aima")}', DEF[2], 'Forte preferência por salas seguras.'],
    ['f4 · Distância', '<code>(path.length − 1) / size</code>', '≥ 0', 'Passos até a sala pelo caminho conhecido, dividido pelo tamanho do mapa.', OWN, DEF[3], 'Prefere salas próximas (cada passo custa 1 ponto).'],
    ['f5 · Novidade', '<code>vizinhas não visitadas / 4</code>', '0 a 1', 'Quantas vizinhas da sala ainda são desconhecidas.', OWN, DEF[4], 'Leve preferência por salas que abrem mais área.'],
    ['f6 · Longe da entrada', '<code>(x + y) / (2·size)</code>', '0 a 1', 'Distância de Manhattan da sala até a entrada, normalizada.', OWN, DEF[5], 'Quase neutro; leve tendência a se afastar.'],
    ['f7 · Giros', '<code>0, 0,5 ou 1</code>', '0 a 1', 'Giro antes do 1º passo: 0 nenhum, 0,5 um giro de 90°, 1 meia-volta.', OWN, DEF[6], 'Leve preferência por seguir em frente.'],
    ['f8 · Brisas ao lado', '<code>vizinhas visitadas com brisa / 4</code>', '0 a 1', 'Indício direto de poço por perto.', OWN, DEF[7], 'Evita salas cercadas de brisa.'],
    ['f9 · Fedores ao lado', '<code>vizinhas visitadas com fedor / 4</code>', '0 a 1', 'Indício direto de Wumpus por perto.', OWN, DEF[8], 'Evita salas cercadas de fedor.'],
]
shoot_rows = [
    ['s1 · Tiro: viés', '<code>1</code>', '1', 'Termo constante: vontade de atirar independente do resto.', OWN, DEF[9], 'Quase neutro.'],
    ['s2 · Tiro: certeza', '<code>1 / candidatas</code>', '1/3 a 1', 'Chance de o alvo ser o Wumpus (1 se ele foi localizado).', f'{MIX} {cite("aima")}', DEF[10], 'Atira mais quando tem certeza.'],
    ['s3 · Tiro: há sala segura', '<code>anySafe ? 1 : 0</code>', '0 ou 1', '1 se ainda existe sala segura para explorar.', OWN, DEF[11], 'Não gasta a flecha enquanto houver caminho seguro.'],
]

section('4', 'Cada variável do agente', f'''
<p>Legenda da coluna "Origem": {LIT} = conceito tirado da referência indicada; {MIX} = conceito da literatura modificado por mim; {OWN} = criado por mim, sem fundamentação teórica específica.</p>

<h2>4.1 Características de cada sala candidata (genes 1 a 8)</h2>
<p>A coluna "Peso padrão" é o valor no genoma que vem com o jogo (<code>DEFAULT_GENOME</code>). Peso negativo significa que a característica <i>diminui</i> a nota da sala.</p>
{table(['Gene', 'Cálculo no código', 'Faixa', 'O que mede', 'Origem', 'Peso padrão', 'Leitura do peso'], cell_rows, 'vars')}
{box('trap', 'Redundâncias conhecidas', '<p>Algumas características se sobrepõem: uma sala "segura" (f3 = 1) sempre tem risco f1 = 0, e as brisas e fedores ao lado (f7, f8) já influenciam o risco. Elas foram mantidas porque permitem ao algoritmo genético pesar o mesmo tipo de informação de formas diferentes, mas isso não foi testado contra uma versão sem redundância.</p>')}

<h2>4.2 Características da opção de tiro (genes 9 a 11)</h2>
<p>A opção só é considerada se o agente tem a flecha e o Wumpus está restrito a no máximo 3 salas (o limite 3 é {OWN}). A nota é <code>s1 + s2·(1 ÷ candidatas) + s3·(há sala segura)</code> e é comparada com a nota da melhor sala.</p>
{table(['Gene', 'Cálculo no código', 'Faixa', 'O que mede', 'Origem', 'Peso padrão', 'Leitura do peso'], shoot_rows, 'vars')}

<h2>4.3 Parâmetros do algoritmo genético</h2>
{table(['Variável', 'Valor', 'Papel', 'Origem'], [
    ['<code>GENE_LIMIT</code>', '5', 'Cada peso fica entre −5 e 5 (inicialização e mutação).', f'{OWN}; representação real {cite("eiben")}'],
    ['<code>population</code>', '20 na tela e no pré-treino', 'Quantos genomas existem em cada geração.', OWN],
    ['<code>generations</code>', '15 na tela; 20 no pré-treino', 'Quantas gerações o treino dura.', OWN],
    ['<code>mapsPerGeneration</code>', '20 na tela; 500 no pré-treino', 'Quantos mapas cada genoma joga por geração (o M do texto).', f'{OWN}; ver 3.9 {cite("jin")}'],
    ['<code>sizes</code>', 'tamanho atual na tela; 4×4 e 6×6 no pré-treino', 'Tamanhos dos mapas de treino, divididos igualmente.', f'{OWN}; ver 3.11 {cite("hastie")}'],
    ['<code>randomGenome()</code>', 'uniforme em [−5, 5]', 'Como os genomas iniciais são sorteados.', f'{LIT} {cite("eiben")}'],
    ['<code>seed</code>', 'genoma atual', 'O genoma em uso entra na posição 0 da população inicial, para o treino continuar de onde parou.', OWN],
    ['<code>TOURNAMENT</code>', '3', 'Tamanho do torneio de seleção dos pais.', f'{LIT} {cite("goldbergdeb", "miller")}; valor: {OWN}'],
    ['<code>ELITE</code>', '2', 'Quantos melhores passam sem alteração.', f'{LIT} {cite("eiben")}; valor: {OWN}'],
    ['<code>crossover()</code>', 't ~ U(0, 1) por gene', 'Cruzamento aritmético.', f'{MIX} {cite("michalewicz")}'],
    ['<code>MUTATION_RATE</code>', '0,2', 'Chance de cada peso sofrer mutação.', f'{LIT} {cite("eiben")}; valor: {OWN}'],
    ['<code>MUTATION_SIZE</code>', '0,8', 'Desvio padrão do ruído da mutação.', f'{LIT} {cite("eiben", "boxmuller")}; valor: {OWN}'],
    ['<code>FINALISTS</code>', '5', 'Quantos melhores vão para a validação final.', f'{MIX} {cite("jin", "hastie")}; valor: {OWN}'],
    ['<code>validationMaps</code>', '3 × M na tela; 2000 no pré-treino', 'Tamanho da rodada de validação final.', f'{OWN}; ver 3.9'],
    ['<code>layout</code>', 'opcional', '"Treinar só no mapa atual": todos os genomas jogam um único mapa fixo. O agente se especializa nele e deixa de generalizar.', OWN],
    ['<code>rng</code>', '<code>Math.random</code>', 'Fonte dos sorteios do treino (mapas, pais, mutação).', '—'],
], 'vars')}

<h2>4.4 A aptidão (fitness)</h2>
<p>A aptidão é a <b>pontuação média</b> do genoma nos mapas da geração. A pontuação de cada partida segue a medida de desempenho do mundo de Wumpus do AIMA {cite('aima')}: −1 por ação, −10 pelo tiro, −1000 por morrer e +1000 pelo ouro.</p>
<p>No livro, os +1000 são ganhos ao sair da caverna com o ouro. Neste jogo eles foram divididos em +1000 ao pegar o ouro e +500 ao voltar com ele à entrada, foi criado um limite de ações por partida e matar o Wumpus passou a valer +25 (pequeno o bastante para que atirar às cegas continue dando prejuízo em média). Essas quatro mudanças são {OWN} e alteram a aptidão em relação à medida original.</p>

<h2>4.5 Os genomas prontos</h2>
{table(['Gene'] + [f'{i + 1}' for i in range(11)], [
    ['<code>BAYES_LIKE_GENOME</code>'] + [str(v) for v in BAY],
    ['<code>DEFAULT_GENOME</code>'] + [str(v) for v in DEF],
], 'genome')}
<ul>
<li><b><code>BAYES_LIKE_GENOME</code></b> ({OWN}): escrito à mão para reproduzir o agente probabilístico. Risco −5 (decide), distância −0,01 (só desempata), demais características em 0, e atira só quando não há sala segura (−5 em s3) e com certeza suficiente (+2 em s2). Serve de ponto de partida do treino.</li>
<li><b><code>DEFAULT_GENOME</code></b>: resultado de um treino a partir do <code>BAYES_LIKE_GENOME</code> em mapas 4×4 com 20% de poços, com população 24, 20 gerações, 120 mapas por geração e validação final em 360 mapas novos, já com o bônus de +25 por matar o Wumpus. Foram feitos três treinos (sementes <code>bonus25-a</code>, <code>-b</code> e <code>-c</code>) e o escolhido foi o melhor em 3000 mapas 4×4 e 600 mapas 6×6 de seleção, separados dos mapas da medição final (seção 5). Para reproduzir: <code>npm run treinar -- --seed bonus25-c</code>.</li>
</ul>
<p>Os pesos evoluídos mantiveram a estrutura do ponto de partida: forte rejeição a poço (−4,64) e ao Wumpus (−5), preferência por salas seguras (+3,42) e cautela para atirar havendo sala segura (−2,35). As mudanças maiores foram mais peso na certeza do tiro (+3,04, contra +2 no ponto de partida) e pesos pequenos nas características que começaram em zero.</p>

<h2>4.6 O que não é evoluído</h2>
<ul>
<li>Pegar o ouro quando sente brilho e voltar à entrada pelo caminho conhecido quando já tem o ouro (regras fixas herdadas do agente probabilístico).</li>
<li>Excluir da escolha as salas que são perigo comprovado (poço certo ou Wumpus localizado).</li>
<li>Como mirar e atirar depois de decidir atirar (rotina <code>planShot</code>).</li>
<li>As próprias deduções lógicas e probabilidades: o algoritmo genético só decide quanto cada informação pesa, não como ela é calculada.</li>
</ul>
''')

# ---------------------------------------------------------------- 5
section('5', 'Resultados obtidos e o que eles significam', f'''
<p>Estes números são experimentos feitos durante o desenvolvimento, não resultados da literatura. Todos os agentes jogaram exatamente os mesmos mapas, com 20% de poços (3 no 4×4, 7 no 6×6).</p>
{table(['Agente', '4×4 (5000 mapas)', '6×6 (1000 mapas)'], [
    ['Lógico', '63% de vitórias, 570 pts', '43%, 46 pts'],
    ['Probabilístico', '67%, 650 pts', '48%, 182 pts'],
    ['<code>BAYES_LIKE_GENOME</code> (ponto de partida)', '66%, 641 pts', '48%, 178 pts'],
    ['<code>DEFAULT_GENOME</code> (evoluído)', '66%, 637 pts', '51%, 255 pts'],
])}
<p>Regras atuais: bônus de +25 por matar o Wumpus, número fixo de poços e o Wumpus nunca num poço. Os mapas são sorteados pelas sementes <code>medicao-4x4</code> e <code>medicao-6x6</code>.</p>
<ul>
<li>No 4×4 o genoma evoluído empata com o ponto de partida e fica um pouco <b>abaixo</b> do agente probabilístico (637 × 650; o probabilístico ganhou 15 pts com as correções da base de conhecimento, que o genético usa só em parte). No 6×6, mapa em que ele não foi treinado, fica <b>à frente</b> (255 × 182). Não foi feito um teste estatístico formal.</li>
<li>Lotes menores enganam: em 1000 mapas 4×4 de outra semente o genético ficou 19 pts abaixo do probabilístico, e em 200 mapas, 151 pts abaixo. Como todos jogam os mesmos mapas, um lote difícil derruba todos juntos, mas a ordem entre agentes próximos muda de lote para lote.</li>
<li>O bônus de +25 não fez o agente atirar às cegas: com o bônus, a fração de partidas com tiro ficou igual entre o genoma treinado antes e depois dele.</li>
<li>Depois da mudança para número fixo de poços e Wumpus fora dos poços, três novos treinos (sementes <code>regras16-a</code>, <code>-b</code> e <code>-c</code>) ficaram de 8 a 14 pts abaixo do genoma atual em 2000 mapas, e por isso o genoma foi mantido.</li>
<li>O algoritmo genético, portanto, encontrou uma estratégia <b>equivalente</b> à inferência bayesiana escrita à mão. Isso é coerente com o fato de as 12 características descreverem essencialmente as mesmas informações que o agente probabilístico já usa.</li>
<li>Em mapas maiores o ganho relativo foi um pouco melhor, mas o genoma foi treinado só em 4×4. A generalização para outros tamanhos não foi estudada a fundo.</li>
</ul>
''')

# ---------------------------------------------------------------- 6
section('6', 'Limitações da fundamentação', f'''
<ul>
<li><b>Sem calibração de parâmetros.</b> Nenhum parâmetro (taxa e tamanho da mutação, torneio, elites, população, gerações, mapas, limites dos pesos) foi escolhido por um estudo de sensibilidade. Com outros valores o resultado pode ser melhor ou pior.</li>
<li><b>Características escolhidas à mão.</b> O conjunto de genes reflete intuições sobre o problema; não segue nenhum método publicado de seleção de características.</li>
<li><b>Análise estatística simples.</b> A comparação do capítulo 5 usa diferença pareada com intervalo de 95% pela aproximação normal; não houve correção para várias comparações nem outros testes.</li>
<li><b>Mudanças na medida de desempenho.</b> A aptidão segue o AIMA com três alterações (divisão do bônus, vitória automática, limite de ações), então os números não são diretamente comparáveis com outros trabalhos sobre o mundo de Wumpus.</li>
<li><b>Modelo do Wumpus simplificado.</b> A probabilidade do Wumpus usa a chance de poço de cada sala separadamente e ignora a correlação entre as salas da fronteira.</li>
</ul>
''')

# ---------------------------------------------------------------- Referências e apêndice
refs_html = ''.join(f'<li id="ref-{k}">{REFS[k][1]}</li>' for k in ORDER)
section('7', 'Referências', f'''<ol class="refs">{refs_html}</ol>''')

section('A', 'Apêndice: o que não foi possível verificar', f'''
<p>Estes itens foram considerados mas ficaram <b>fora</b> das referências, porque não consegui confirmar nas fontes consultadas:</p>
<ul>
<li><b>Números das subseções do AIMA (4ª edição)</b> para algoritmos evolutivos e funções de avaliação. Os títulos dos capítulos 4 e 7 e a seção 12.7 foram confirmados; as subseções não, por isso o texto cita só os capítulos.</li>
<li><b>Atribuição do elitismo a De Jong (1975).</b> A tese de De Jong existe (<i>An analysis of the behavior of a class of genetic adaptive systems</i>, University of Michigan, 1975), mas as fontes consultadas não confirmaram que ela introduz o elitismo. O elitismo é citado aqui apenas por meio de Eiben e Smith.</li>
<li><b>Livro de simulação de Law.</b> A seção sobre números aleatórios comuns foi confirmada apenas para a 4ª edição, por um programa de curso. Em seu lugar foi usado Ross (2013).</li>
<li><b>Definição literal do cruzamento aritmético em Michalewicz.</b> A atribuição foi confirmada por fontes secundárias (documentação do HeuristicLab e do Scilab), não pela leitura do trecho do livro.</li>
<li><b>Números de página de Miller e Goldberg (1995).</b> Volume e número foram confirmados; as páginas não, por isso foram omitidas.</li>
</ul>
''')

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)

extra_css = '''
.own, .lit, .mix { font-family: 'Inter', sans-serif; font-size: 7.6pt; font-weight: 600; padding: 0.2mm 1.4mm; border-radius: 2mm; white-space: nowrap; }
.own { background: #f6e3df; color: #8a3a2a; }
.lit { background: #e2efe5; color: #2e6b3e; }
.mix { background: #f6eed6; color: #7a5a0a; }
a.ref { color: #34507d; }
table.vars { font-size: 8.4pt; }
table.vars td:nth-child(6) { text-align: right; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; font-size: 8pt; }
table.genome { font-size: 8pt; }
table.genome td, table.genome th { text-align: right; padding: 1.4mm 1.2mm; font-variant-numeric: tabular-nums; }
table.genome td:first-child, table.genome th:first-child { text-align: left; }
ol.refs { padding-left: 5mm; }
ol.refs li { margin: 0 0 3mm; line-height: 1.45; }
ol.refs a { color: #34507d; word-break: break-all; }
code, pre { font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0; }
'''

doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Agente genético — fundamentação teórica</title>
<style>{css}{extra_css}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Wumpus 3D · Fundamentação teórica</div>
    <h1>Agente genético</h1>
    <p class="sub">De onde vem cada parte do agente que aprende com algoritmo genético, o que cada variável significa e o que foi escolha de projeto sem respaldo teórico.</p>
  </div>
  <div class="meta">
    <span>Versão do código</span><b>{COMMIT}</b>
    <span>Data</span><b>{DATE}</b>
    <span>Arquivos</span><b>src/agents/genome.ts · genetic.ts · agents.ts (GeneticAgent) · knowledge.ts</b>
    <span>Referências</span><b>{len(REFS)} obras, todas conferidas (ver apêndice A)</b>
  </div>
</div>
<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol></nav>
{''.join(sections)}
</body></html>'''
OUT.write_text(doc)
print('ok')
