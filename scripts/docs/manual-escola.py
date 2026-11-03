# Gera o PDF "Manual do modo escola" (docs/wumpus3d-manual-escola.pdf): alunos e professores.
# As imagens vêm de capturas-escola.cjs; as tabelas de missões e de lições são lidas de src/edu/missions.ts
# e src/edu/trilha/lessons.ts.
import html, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1])
IMG = pathlib.Path(__file__).parent / 'img'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
_hoje = __import__('datetime').date.today()
DATE = f'{_hoje.day} de {MESES[_hoje.month - 1]} de {_hoje.year}'
COMMIT = subprocess.run(['git', '-C', str(ROOT), 'log', '-1', '--format=%h'], capture_output=True, text=True).stdout.strip()

css = re.search(r'<style>(.*?)</style>', (pathlib.Path(__file__).parent / 'documentacao.py').read_text(), re.S).group(1)
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


def img(name, caption, cls='wide'):
    return f'<figure class="shot {cls}"><img src="file://{IMG / name}"><figcaption>{caption}</figcaption></figure>'


def missions():
    """Lê título, conceito, meta de blocos e número de cavernas de cada missão direto do código."""
    src = (ROOT / 'src/edu/missions.ts').read_text()
    blocks = re.findall(r"\{\s*id: '(m\d+)',(.*?)maxActions: (\d+)", src, re.S)
    out = []
    for mid, body, actions in blocks:
        get = lambda k: re.search(rf"{k}: '((?:[^'\\]|\\.)*)'", body).group(1)
        maps = len(re.findall(r'cave\(', body))
        out.append((mid[1:], get('title'), get('concept'), re.search(r'maxBlocks: (\d+)', body).group(1), actions, maps))
    return out


def lessons():
    """Módulo, título, grande ideia, objetivo e duração de cada lição, direto do código."""
    src = (ROOT / 'src/edu/trilha/lessons.ts').read_text()
    pat = r"id: '(ia\d)',\s*module: (\d),\s*title: '([^']*)',\s*idea: '([^']*)',\s*goal: '([^']*)',\s*minutes: (\d+)"
    return re.findall(pat, src)


LES = lessons()
MIS = missions()
mission_rows = [[n, f'<b>{html.escape(t)}</b>', html.escape(c), str(m), b, a] for n, t, c, b, a, m in MIS]

# ---------------------------------------------------------------- 1
section('1', 'O que é o modo escola', f"""
<p class="lead">O modo escola ("Caverna do Pensamento") é uma versão do Wumpus 3D para ensinar <b>pensamento computacional</b> e <b>Inteligência Artificial</b> a crianças e jovens de 10 a 18 anos. Ele tem três páginas: a <b>tela inicial</b>, onde cada pessoa entra, a <b>área do aluno</b> e a <b>área do professor</b>.</p>
{table(['Área', 'Telas', 'Para quem'], [
    ['<b>🎒 Aluno</b>', '<b>Início</b> (atividades da turma) · <b>🔎 Detetive</b> (jogar e anotar pistas) · <b>🧩 Blocos</b> (programar o robô) · <b>🛠️ Criador</b> (montar cavernas) · <b>🤖 Trilha de IA</b> (seis lições)', 'Alunos de 10 a 18 anos; a Trilha de IA é pensada para o ensino médio'],
    ['<b>👩‍🏫 Professor</b>', '<b>Turmas</b> (alunos e PINs) · <b>Planejar</b> (atividades da aula) · <b>Relatório</b> (tudo o que os alunos fizeram) · <b>Criador</b> · <b>GitHub</b> (guardar no repositório privado do professor, opcional)', 'Professores'],
])}
<h2>Como abrir</h2>
<ul>
<li>No navegador, acesse o endereço do jogo e acrescente <code>escola.html</code> (por exemplo, <code>…/Wumpus3D/escola.html</code>), ou clique em <b>🎒 Modo escola</b> no fim do painel do jogo 3D.</li>
<li>Funciona em computador, Chromebook, tablet e celular, em qualquer navegador atual. Não precisa instalar nada.</li>
</ul>
{box('tip', 'Sem servidor e sem conta na internet', '<p>Logins, turmas e progresso ficam no próprio navegador. O professor recebe o que os alunos fizeram quando eles <b>baixam o registro</b> e entregam o arquivo. Opcionalmente, o professor guarda as turmas e os registros num repositório privado dele no GitHub (capítulo 11). O único dado pessoal é o apelido do aluno (capítulo 12).</p>')}
""")

# ---------------------------------------------------------------- 2
section('2', 'Tela inicial e login', f"""
{img('escola-login.png', 'Tela inicial no primeiro acesso: o aluno abre a turma com o código; o professor cria o acesso dele neste aparelho.')}
<h2>Professor</h2>
<ol>
<li><b>Primeiro acesso neste aparelho</b>: em "Sou professor", preencha nome, usuário e senha (8 caracteres ou mais) e clique em <b>Criar acesso e entrar</b>.</li>
<li>Nas próximas vezes: usuário e senha, <b>Entrar na área do professor</b>. Mais de um professor pode ter acesso no mesmo aparelho ("Criar outro acesso").</li>
<li><b>Esqueci a senha</b>: como não há servidor, ela não pode ser recuperada. Dá para apagar o acesso deste aparelho (as turmas e registros guardados aqui também são apagados) e criar outro; se você guardava tudo no GitHub, traga de volta na aba GitHub.</li>
</ol>
<h2>Aluno</h2>
{img('escola-login-aluno.png', 'Aluno: a turma já foi aberta neste aparelho; basta escolher o apelido e digitar o PIN.')}
<ol>
<li>Na primeira vez, cole o <b>código da turma</b> que o professor passou (começa com <code>TURMA1-</code>) e clique em <b>Abrir turma</b>, ou abra o arquivo da turma. O aparelho guarda a turma para as próximas vezes.</li>
<li>Escolha o <b>apelido</b> na lista e digite o <b>PIN</b> de 4 dígitos que o professor entregou. <b>Entrar</b>.</li>
<li><b>Entrar sem turma (jogar livre)</b>: abre a área do aluno sem professor; dá para jogar tudo e até abrir uma atividade por código, como visitante.</li>
</ol>
<p>A entrada vale só para a aba do navegador: ao fechá-la, ou clicar em <b>Sair</b> no alto, é preciso entrar de novo. Isso ajuda em laboratórios com computadores compartilhados.</p>
{box('trap', 'O que o login protege e o que não protege', '<p>Senhas e PINs nunca são guardados: só um resumo cifrado (PBKDF2). O código da turma leva só os resumos dos PINs, nunca os PINs. Isso separa as áreas e garante que cada aluno use o próprio apelido. Mas a conferência acontece no aparelho e o site é público: quem entende de programação consegue contornar. Por isso não há dados sensíveis no site: os registros ficam nos arquivos dos alunos, no computador do professor e, se ele quiser, no repositório privado dele.</p>')}
""")

# ---------------------------------------------------------------- 3
section('3', 'Área do aluno: Início', f"""
{img('escola-inicio.png', 'Início do aluno com login: a turma, o plano do professor e o andamento de cada atividade.')}
<ul>
<li>No alto, a turma e o professor. Abaixo, as <b>atividades da aula</b>: Detetive, Blocos, lições da Trilha de IA e Agente para a Arena. Cada uma mostra "ainda não fez", o número de tentativas ou as estrelas.</li>
<li><b>Fazer</b> abre a tela certa com a caverna ou a lição escolhida pelo professor.</li>
<li><b>Terminou?</b> <b>Enviar para o professor (baixar registro)</b> baixa um arquivo <code>registro-…json</code> com tudo o que você fez: entregue pelo canal que o professor pedir. Se o download for bloqueado, use <b>Mostrar o registro como texto</b>, copie e envie.</li>
<li><b>Jogar livre</b>: Detetive com cavernas sorteadas, as 9 missões de blocos, o Criador e a Trilha de IA.</li>
</ul>
""")

# ---------------------------------------------------------------- 4
section('4', 'Detetive', f'''
{img('escola-detetive.png', 'Detetive: o robô (azul) está em (2, 1) e sente brisa. O caderno tem anotações conferidas: verde = as pistas provam; amarelo = pode ser.')}
<h2>O objetivo</h2>
<p>Encontrar o ouro e voltar vivo para a entrada (a sala com o anel azul, no canto de baixo à esquerda). A caverna fica escondida: você só vê as salas por onde já passou.</p>
<h2>Os controles</h2>
{table(['Botão', 'Tecla', 'O que faz'], [
    ['↺ girar', 'A ou ←', 'Gira para a esquerda, sem sair da sala.'],
    ['▲ avançar', 'W ou ↑', 'Anda uma sala para a frente (o nariz amarelo do robô mostra a direção).'],
    ['↻ girar', 'D ou →', 'Gira para a direita.'],
    ['✋ pegar', 'G', 'Pega o ouro, se ele estiver na sala.'],
    ['➶ atirar', 'Espaço', 'Atira a única flecha para a frente. Se acertar o Wumpus, ele grita e morre.'],
])}
<h2>As pistas</h2>
{table(['Pista', 'Quer dizer'], [
    ['💨 brisa', 'Existe um poço numa sala vizinha (acima, abaixo, à esquerda ou à direita). Não diz qual.'],
    ['👃 fedor', 'O Wumpus está numa sala vizinha (ou nesta).'],
    ['✨ brilho', 'O ouro está nesta sala: pegue!'],
    ['🧱 parede', 'O robô tentou andar para fora da caverna.'],
    ['😱 grito', 'A flecha acertou: o Wumpus morreu.'],
])}
<h2>O caderno</h2>
<p>Toque (ou clique) numa sala desconhecida para anotar o que você acha que tem nela. Cada toque troca a anotação: <b>segura → poço? → poço! → Wumpus? → Wumpus! → apagar</b>. No teclado, use Tab para chegar à sala e Enter para anotar.</p>
<ul>
<li><b>✔ Conferir anotações</b> pinta cada anotação: <span style="background:#8fe0a5;padding:0 4px">verde</span> as pistas provam; <span style="background:#ffe08a;padding:0 4px">amarelo</span> pode ser, mas ainda não dá para ter certeza; <span style="background:#ff9d8f;padding:0 4px">vermelho</span> as pistas mostram outra coisa.</li>
<li><b>💡 Pedir dica</b>: o robô-ajudante responde com uma pergunta que leva ao próximo passo do raciocínio ("Ela é vizinha de (1, 1), onde você não sentiu brisa. Pode haver poço nela?"). Ele começa pelas anotações erradas. As dicas pedidas aparecem no relatório do professor.</li>
</ul>
<h2>O fim da partida</h2>
{img('escola-detetive-fim.png', 'Fim da partida: o mapa inteiro aparece, com o retorno sobre o raciocínio e as opções de tentar de novo.')}
{table(['Estrelas', 'Quando'], [
    ['★', 'Venceu.'],
    ['★★', 'Venceu sem entrar em nenhuma sala que as pistas já mostravam ser perigosa.'],
    ['★★★', 'Além disso, não arriscou sala incerta quando ainda havia sala garantidamente segura, e nenhuma anotação do caderno ficou errada.'],
])}
<p><b>Tentar de novo esta caverna</b> repete o mesmo mapa (agora você sabe onde estão os perigos: ótimo para entender o que as pistas diziam). <b>Outra caverna</b> sorteia outra, ou, numa atividade, recomeça a caverna do professor.</p>
''')

# ---------------------------------------------------------------- 5
section('5', 'Programador com blocos', f'''
{img('escola-blocos.png', 'Missão 6 rodando passo a passo: à esquerda, os blocos; à direita, a caverna. O bloco que o robô está executando fica destacado.')}
<h2>Como funciona</h2>
<ol>
<li>Escolha uma missão (ou abra a atividade do professor). O mapa da missão fica todo à mostra: o desafio é programar, não descobrir.</li>
<li>Clique numa categoria à esquerda (Ações, Repetir, Se…) e <b>arraste</b> os blocos para dentro de <b>quando começar</b>. Blocos soltos, fora dele, não fazem nada.</li>
<li><b>▶ Executar</b> roda o programa do começo ao fim. <b>⏭ Um passo</b> faz o robô dar uma ação por clique, com o bloco atual destacado: ótimo para achar erros. <b>⟲ Recomeçar</b> volta o robô para a entrada sem mexer no programa.</li>
<li>A velocidade da animação se ajusta no controle deslizante.</li>
<li>O programa fica salvo sozinho no navegador: ao voltar à missão, ele está lá.</li>
</ol>
<h2>Os blocos</h2>
{table(['Categoria', 'Blocos'], [
    ['Ações', 'avançar · girar à esquerda · girar à direita · pegar o ouro'],
    ['Flecha', 'atirar a flecha'],
    ['Repetir', 'repetir N vezes'],
    ['Repetir até', 'repetir até (condição) · repetir enquanto (condição)'],
    ['Se', 'se … então · se … então … senão'],
    ['Sensores', 'sentir brisa / sentir fedor / ver brilho / bater na parede / ouvir o grito · parede à frente · sala à frente já visitada · estou na entrada · estou com o ouro · tenho a flecha'],
    ['E / ou / não', '(condição) e/ou (condição) · não (condição)'],
    ['Funções', 'crie um bloco novo ("função") com os comandos que você colocar dentro e use-o quantas vezes quiser'],
])}
<p>As categorias aparecem aos poucos: cada missão libera só os blocos de que precisa.</p>
<h2>As missões</h2>
{table(['#', 'Missão', 'Conceito', 'Cavernas', 'Meta ★★ (blocos)', 'Meta ★★★ (ações)'], mission_rows)}
<p><b>Estrelas:</b> ★ vencer · ★★ vencer usando no máximo a meta de blocos · ★★★ também com no máximo a meta de ações (somando todas as cavernas da missão). O contador "blocos: 5 / 7" no alto mostra quanto falta (fica vermelho quando passa). Em cavernas criadas no Criador ou sorteadas pelo professor não há meta: vencer vale ★.</p>
<p>Missões com <b>várias cavernas</b> (botões A, B, C) testam se o programa funciona em situações diferentes: ele precisa vencer todas, uma depois da outra.</p>
<h2>Quando algo dá errado</h2>
{img('escola-blocos-erro.png', 'Um "repetir até" sem nada dentro: o programa nunca termina. O bloco com problema fica selecionado e a mensagem explica.')}
{table(['Mensagem', 'O que fazer'], [
    ['"O robô caiu num poço" / "O Wumpus pegou o robô"', 'Use ⏭ Um passo para ver em que bloco o robô tomou o caminho errado.'],
    ['"O programa ficou rodando sem o robô se mexer"', 'Há uma repetição que nunca termina (por exemplo, "repetir até ver brilho" sem "avançar" dentro).'],
    ['"Falta encaixar uma condição neste bloco"', 'Um "se" ou "repetir até" está sem a peça de condição.'],
    ['"O robô andou demais e o tempo acabou"', 'O robô está andando em círculos: confira as condições das repetições.'],
    ['"O programa terminou, mas o robô ainda não voltou"', 'Faltam blocos: o robô precisa pegar o ouro e voltar até a entrada.'],
])}
<p>Em <b>Ver o programa como texto</b> o programa aparece escrito, um comando por linha. É o mesmo texto que o professor vê no relatório.</p>
<h2>Agente para a Arena da turma</h2>
<p>Numa atividade <b>🏆 Agente para a Arena</b>, o aluno tem todos os blocos e três cavernas de treino (A, B e C). O desafio é montar um robô que funcione em <b>qualquer</b> caverna: no relatório do professor, o último programa de cada aluno joga as mesmas 20 cavernas sorteadas, junto com os agentes lógico e probabilístico do jogo. Programas que decoram um caminho costumam ir mal; os que usam os sensores (brisa, fedor, parede à frente) vão melhor.</p>
''')

# ---------------------------------------------------------------- 6
section('6', 'Criador de cavernas', f'''
{img('escola-criador.png', 'Criador: poços, Wumpus e ouro colocados sala a sala; a caverna está pronta e já tem código para compartilhar.')}
<ol>
<li>Dê um nome e escolha o tamanho (3 × 3 a 8 × 8).</li>
<li>Escolha a <b>ferramenta</b> (Poço, Wumpus, Ouro ou Apagar) e toque nas salas. Tocar de novo com a mesma ferramenta tira o que estava lá.</li>
<li>A lista abaixo das ferramentas avisa o que falta. A caverna só fica pronta com ouro, Wumpus e <b>um caminho sem poço da entrada até o ouro</b>.</li>
<li><b>Salvar</b> guarda em "Minhas cavernas" neste aparelho. O professor também tem o Criador na área dele e pode usar as cavernas salvas lá nos planos. <b>Jogar no Detetive</b> e <b>Programar nela</b> abrem a caverna nas outras telas.</li>
<li><b>Compartilhar</b>: o código (começa com <code>CAV1-</code>) leva a caverna inteira. O colega cola o código na mesma caixa e clica em <b>Abrir código</b>.</li>
</ol>
{box('decision', 'Regras da caverna', '<ul><li>A entrada, sala (1, 1), fica sempre livre.</li><li>Wumpus e ouro nunca ficam dentro de um poço; colocar um poço apaga o que havia na sala.</li><li>Wumpus e ouro podem ficar na mesma sala: aí é preciso usar a flecha antes de pegar o ouro.</li></ul>')}
<p><b>Ideia de desafio:</b> cada aluno cria uma caverna e troca o código com um colega. Quem consegue vencer no Detetive com ★★★? E um programa de blocos que vença as duas cavernas?</p>
''')

# ---------------------------------------------------------------- 7
section('7', 'Trilha de IA', f"""
<p class="lead">Seis lições curtas que mostram, por dentro do jogo, como um agente inteligente percebe o mundo, raciocina, procura caminhos e aprende. Uma lição por "grande ideia" da Inteligência Artificial (iniciativa AI4K12). Pensada para o ensino médio.</p>
{img('escola-trilha.png', 'Os seis módulos; as estrelas mostram o melhor resultado em cada lição.')}
{table(['Módulo', 'Lição', 'Grande ideia', 'Objetivo', 'Tempo'], [[m, f'<b>{html.escape(t)}</b>', html.escape(i), html.escape(g), f'{mi} min'] for _, m, t, i, g, mi in LES])}
<h2>Como uma lição funciona</h2>
<ul>
<li>Uma lição é uma sequência de passos: <b>texto</b> curto, <b>interação no tabuleiro</b> e <b>perguntas</b>. Os botões <b>Voltar</b> e <b>Avançar</b> passam de um passo a outro; numa pergunta, é preciso responder antes de avançar.</li>
<li>Perguntas de escolha ou de número são conferidas na hora, com a explicação. Errou? Tente de novo: o que conta para as estrelas é acertar de primeira.</li>
<li>No último módulo há uma <b>reflexão</b> escrita (sem resposta certa), que o professor lê no relatório.</li>
<li>Estrelas: ★ concluiu · ★★ acertou ao menos 2/3 das perguntas de primeira · ★★★ acertou todas de primeira.</li>
</ul>
{img('escola-trilha-pergunta.png', 'Pergunta conferida na hora, com a explicação.')}
<h2>As interações</h2>
{table(['Módulo', 'Interação', 'O que o aluno vê'], [
    ['1', 'Seja o robô', 'Joga só com o que os sensores dizem; ao lado, a lista do que o robô sabe de cada sala.'],
    ['2', 'Por que o robô sabe?', 'Toca nas salas e o jogo explica a dedução passo a passo ("(1, 2) não tinha brisa, então…").'],
    ['3', 'As combinações', 'A chance de poço em cada sala e, ao tocar numa delas, a tabela de todas as combinações com seus pesos: a mesma conta do agente probabilístico.'],
    ['4', 'Busca passo a passo', 'A busca em largura avançando: a sala atual, a fila e, no fim, o caminho mais curto até a entrada.'],
    ['5', 'Treine você', 'Um algoritmo genético de aula (8 agentes, 8 gerações) treina com 1 caverna e depois com 40; cada resultado é testado em 100 cavernas novas. Com 1 caverna o agente "decora" (muitos pontos no treino, menos nas novas); com 40, generaliza melhor.'],
    ['6', 'Arena', 'Um programa de blocos do aluno joga 20 cavernas contra os agentes lógico e probabilístico.'],
])}
<div class="shots2">
{img('escola-trilha-deducao.png', 'Módulo 2: a explicação da dedução.', 'half')}
{img('escola-trilha-combinacoes.png', 'Módulo 3: a tabela de combinações.', 'half')}
{img('escola-trilha-busca.png', 'Módulo 4: a busca em largura passo a passo.', 'half')}
{img('escola-trilha-genetico.png', 'Módulo 5: treino com 1 e com 40 cavernas.', 'half')}
</div>
""")

# ---------------------------------------------------------------- 8
section('8', 'Área do professor: turmas', f"""
{img('escola-turmas.png', 'Turmas: alunos com PIN, plano da turma e código da turma.')}
<ol>
<li><b>Nova turma</b>: dê um nome (por exemplo, "7º ano B") e clique em Criar.</li>
<li><b>Acrescentar alunos</b>: um apelido por linha (evite nome completo). Cada aluno ganha um PIN de 4 dígitos. <b>Novo PIN</b> troca o PIN de quem esqueceu; <b>Remover</b> tira o aluno.</li>
<li><b>Plano da turma</b>: monte o plano na aba Planejar e clique em <b>Usar o plano em edição</b>.</li>
<li><b>Gerar código da turma</b>: um texto que começa com <code>TURMA1-</code> e leva o nome da turma, os resumos dos PINs e o plano. Passe pelo quadro, chat ou plataforma da escola, ou use <b>Baixar arquivo da turma</b>. <b>Baixar cartões de PIN</b> gera uma página para imprimir e recortar.</li>
</ol>
{box('trap', 'Mudou algo? Gere o código de novo', '<p>Depois de acrescentar alunos, trocar um PIN ou mudar o plano, gere e entregue o código outra vez. O aluno cola o código novo na tela inicial ("Outra turma") e o aparelho atualiza a turma.</p>')}
""")

# ---------------------------------------------------------------- 9
section('9', 'Área do professor: planejar a aula', f"""
{img('escola-professor.png', 'Planejar: dados do plano e atividades à esquerda; adicionar atividade à direita.')}
<h2>Tipos de atividade</h2>
{table(['Modo', 'O que o aluno faz', 'O que escolher'], [
    ['🔎 Detetive', 'Joga e anota pistas no caderno.', 'A caverna: missão, sorteada por uma palavra (a mesma para todos), uma das suas cavernas ou um código <code>CAV1-</code>.'],
    ['🧩 Blocos', 'Programa o robô para vencer a caverna.', 'Uma das 9 missões (blocos liberados aos poucos) ou uma caverna (todos os blocos).'],
    ['🤖 Lição da Trilha de IA', 'Faz uma das seis lições.', 'A lição.'],
    ['🏆 Agente para a Arena', 'Monta um robô geral, testado em 3 cavernas de treino.', 'Uma palavra (semente) e o tamanho: os programas de todos jogam as mesmas 20 cavernas no relatório.'],
])}
<p>Título e orientação são opcionais; ↑ ↓ reordenam e ✕ remove. O plano fica salvo neste aparelho, no seu acesso. O código <code>PLANO1-</code> da aba Planejar serve para quem joga sem turma (visitante).</p>
<h2>Sugestões de aula (50 minutos)</h2>
{table(['Público', 'Roteiro'], [
    ['10 a 14 anos', '10 min sem computador (um aluno é o robô de olhos vendados e só diz o que sente) · 15 min Detetive numa caverna sorteada · 20 min Blocos, missões 1 a 3 · 5 min registro e conversa.'],
    ['Ensino médio (trilha em 3 aulas)', 'Aula 1: lições 1 e 2 + Detetive · Aula 2: lições 3 e 4 · Aula 3: lição 5, atividade Agente para a Arena e lição 6 com o resultado da Arena da turma projetado.'],
])}
""")

# ---------------------------------------------------------------- 10
section('10', 'Área do professor: relatório da turma', f"""
{img('escola-relatorio.png', 'Relatório: visão geral aluno × atividade, por atividade e tudo o que cada aluno fez.')}
<ol>
<li>Recolha os arquivos <code>registro-…json</code> dos alunos e, em <b>Relatório</b>, clique em <b>Abrir registros dos alunos</b> (vários de uma vez). Eles ficam guardados neste aparelho; abrir o mesmo registro de novo não duplica as tentativas.</li>
<li>Em <b>Plano do relatório</b>, escolha a turma (ou o plano em edição).</li>
<li><b>Baixar relatório (HTML)</b>, <b>Baixar planilha (CSV)</b> (uma linha por tentativa) ou <b>Imprimir</b>.</li>
</ol>
{table(['Parte', 'Conteúdo'], [
    ['Visão geral', 'Uma linha por aluno, uma coluna por atividade: estrelas ou como terminou a última tentativa, tentativas e dicas.'],
    ['Por atividade', 'Quantos tentaram e venceram, tentativas até vencer, estrelas médias e dicas pedidas.'],
    ['Arena da turma', 'Para cada atividade Agente: o último programa de cada aluno nas mesmas 20 cavernas, com os agentes de referência, em ordem de pontuação.'],
    ['Tudo o que cada aluno fez', 'Cada tentativa: no Detetive, erros de lógica, riscos, dicas e anotações; nos Blocos, os blocos e o programa como texto; nas lições, os acertos de primeira e as reflexões.'],
])}
{img('escola-relatorio-arena.png', 'Arena da turma no relatório: os programas dos alunos e os agentes do jogo nas mesmas cavernas.')}
<h2>Como ler os números</h2>
{table(['Sinal', 'Pode indicar'], [
    ['Muitas tentativas com o mesmo erro de programa', 'Dificuldade com o conceito da missão: vale uma conversa sobre depuração.'],
    ['Venceu com ★ mas não com ★★', 'Resolveu sem repetição ou função: hora de falar de padrões e abstração.'],
    ['Detetive: entrou em sala comprovadamente perigosa', 'Ainda não liga a pista à sala vizinha. Retome com o caderno.'],
    ['Lição com poucos acertos de primeira', 'Volte ao passo do tabuleiro daquela lição com a turma.'],
    ['Arena: programa com muitas mortes', 'Decorou um caminho em vez de usar os sensores.'],
])}
""")

# ---------------------------------------------------------------- 11
section('11', 'Guardar no GitHub (opcional)', f"""
{img('escola-github.png', 'Aba GitHub: repositório privado, token e o passo a passo para prepará-lo.')}
<p>Para usar as turmas em outro computador e ter o histórico de tudo, o professor pode guardar os dados num <b>repositório privado</b> do GitHub dele. É gratuito.</p>
<h2>Preparar (uma vez)</h2>
<ol>
<li>Em github.com, crie um repositório marcado como <b>Private</b> (por exemplo, <code>caverna-turmas</code>).</li>
<li>Em <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>: <b>Only select repositories</b> com só esse repositório; <b>Permissions → Contents: Read and write</b>; validade até o fim do semestre.</li>
<li>Na aba GitHub, preencha o dono, o repositório e o token. <b>Testar conexão</b>.</li>
</ol>
<h2>Usar</h2>
<ul>
<li><b>Enviar tudo para o GitHub</b> grava <code>turmas/</code>, <code>planos/</code>, <code>registros/</code> e <code>relatorios/</code> (na pasta escolhida). Cada envio vira uma versão no histórico do repositório.</li>
<li><b>Trazer do GitHub</b> junta as turmas e registros de lá com os deste aparelho.</li>
<li><b>Lembrar o token neste aparelho</b>: sem marcar, o token vale só até fechar a aba. <b>Esquecer o token</b> o apaga do aparelho.</li>
</ul>
{box('trap', 'Segurança', '<ul><li>O jogo recusa gravar num repositório <b>público</b>: as turmas levam os PINs.</li><li>O token nunca vai para o site nem para os alunos. Se ele vazar, apague-o no GitHub e crie outro.</li><li>Os alunos não usam o GitHub: continuam entregando o arquivo de registro.</li></ul>')}
""")

# ---------------------------------------------------------------- 12
section('12', 'Privacidade e dados', f"""
<ul>
<li><b>Único dado pessoal: o apelido.</b> Oriente os alunos e cadastre apelidos, não nomes completos. Isso vai ao encontro do art. 14 da LGPD (Lei 13.709/2018), que pede cuidado especial com dados de crianças e adolescentes.</li>
<li><b>No aparelho do aluno</b>: as turmas abertas (com os resumos dos PINs), o registro, programas, cavernas e estrelas.</li>
<li><b>No aparelho do professor</b>: os acessos (senha só em resumo cifrado), turmas com os PINs, planos, registros recebidos e, se pedido, o token do GitHub.</li>
<li><b>No GitHub do professor</b> (opcional): repositório privado dele, sob a conta dele.</li>
<li><b>Apagar</b>: limpar os dados do site nas configurações do navegador. Na tela inicial, "Esqueci a senha" apaga o acesso do professor e os dados dele no aparelho.</li>
</ul>
""")

# ---------------------------------------------------------------- 13
section('13', 'Perguntas frequentes', f"""
{img('escola-celular-trilha.png', 'No celular: Trilha de IA.', 'phone')}
{table(['Pergunta', 'Resposta'], [
    ['O aluno esqueceu o PIN.', 'Em Turmas, clique em Novo PIN ao lado do apelido, gere o código da turma de novo e entregue. Enquanto isso, ele pode entrar sem turma e baixar o registro depois.'],
    ['O aluno trocou de computador.', 'Ele cola o código da turma no aparelho novo e entra com apelido e PIN. No fim, entrega os registros dos dois aparelhos: o relatório junta as tentativas.'],
    ['Apareceu "registro(s) de outro plano".', 'O arquivo é de outro plano (por exemplo, de antes de mudar o plano da turma). Escolha o plano certo em "Plano do relatório".'],
    ['Posso usar no celular?', 'Sim, as duas áreas. No Blocos, a montagem fica em cima e a caverna embaixo.'],
    ['O computador da escola não tem internet.', 'Depois de abertas, as páginas funcionam sem internet (o GitHub, claro, precisa de internet).'],
    ['Como chego ao jogo 3D completo?', 'Pelo link "Jogo 3D completo" na tela inicial.'],
])}
<h2>Referência rápida</h2>
{table(['Onde', 'Atalho'], [
    ['Detetive', 'W/↑ avançar · A/← girar à esquerda · D/→ girar à direita · G pegar · Espaço atirar · Tab + Enter anotar sala'],
    ['Blocos', 'Arrastar da categoria para dentro de "quando começar" · lixeira para apagar · Ctrl+Z desfazer'],
    ['Códigos', '<code>TURMA1-…</code> turma · <code>PLANO1-…</code> plano (sem turma) · <code>CAV1-…</code> caverna'],
    ['Arquivos', '<code>turma-….json</code> · <code>pins-….html</code> · <code>registro-….json</code> · <code>relatorio-turma-….html/.csv</code>'],
])}
""")

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)
extra = '''
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.shots2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.shots2 figure.shot { width: 100%; margin: 0; }
table.compact td { vertical-align: top; }
'''
doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual do modo escola</title>
<style>{css}{extra}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Wumpus 3D · Modo escola</div>
    <h1>Caverna do Pensamento</h1>
    <p class="sub">Manual do aluno e do professor: login, Detetive, Programador com blocos, Criador de cavernas, Trilha de IA, turmas, planejamento, relatório e GitHub.</p>
    <div class="grid"><i class="e"></i><i></i><i class="p"></i><i></i><i></i><i class="w"></i><i class="g"></i><i></i><i></i><i></i><i></i><i class="p"></i><i></i><i class="p"></i><i></i><i></i></div>
  </div>
  <div class="meta">
    <span>Versão do código</span><b>{COMMIT} (branch educacional)</b>
    <span>Data</span><b>{DATE}</b>
    <span>Endereço</span><b>…/Wumpus3D/escola.html</b>
    <span>Público</span><b>Alunos de 10 a 18 anos e professores</b>
  </div>
</div>
<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol></nav>
{''.join(sections)}
</body></html>'''
OUT.write_text(doc)
print('ok')
