# Gera o PDF "Manual do modo escola" (docs/wumpus3d-manual-escola.pdf): alunos e professores.
# As imagens vêm de capturas-escola.cjs; a tabela de missões é lida de src/edu/missions.ts.
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


MIS = missions()
mission_rows = [[n, f'<b>{html.escape(t)}</b>', html.escape(c), str(m), b, a] for n, t, c, b, a, m in MIS]

# ---------------------------------------------------------------- 1
section('1', 'O que é o modo escola', f'''
<p class="lead">O modo escola ("Caverna do Pensamento") é uma versão do Wumpus 3D feita para ensinar <b>pensamento computacional</b> a crianças e jovens de 10 a 18 anos. Em vez de um jogo para quem já programa, ele oferece três formas de jogar e uma área para o professor.</p>
{table(['Tela', 'O que se faz', 'Para quem'], [
    ['<b>🔎 Detetive</b>', 'Jogar com as próprias mãos e anotar no caderno o que se descobre de cada sala. Um robô-ajudante faz perguntas e confere as anotações.', 'A partir de 10 anos'],
    ['<b>🧩 Blocos</b>', 'Programar o robô encaixando blocos (avançar, repetir, se…), numa campanha de 9 missões.', '10 a 15 anos (e iniciantes de qualquer idade)'],
    ['<b>🛠️ Criador</b>', 'Montar uma caverna sala a sala e mandar para os colegas por um código.', 'Todas as idades'],
    ['<b>👩‍🏫 Professor</b>', 'Planejar a aula (atividades e cavernas), entregar aos alunos e montar o relatório da turma com tudo o que cada aluno fez.', 'Professores'],
])}
<h2>Como abrir</h2>
<ul>
<li>No navegador, acesse o endereço do jogo e acrescente <code>escola.html</code> (por exemplo, <code>…/Wumpus3D/escola.html</code>), ou clique em <b>🎒 Modo escola</b> no fim do painel do jogo 3D.</li>
<li>Funciona em computador, Chromebook, tablet e celular, em qualquer navegador atual. Não precisa instalar nada nem criar conta.</li>
<li>O link <b>Jogo 3D completo</b>, no canto de cima, volta para a versão original.</li>
</ul>
<div class="shots" style="grid-template-columns:1fr 1fr;width:70%;margin:0 auto">
{img('escola-celular-detetive.png', 'No celular: Detetive.', 'phonegrid')}
{img('escola-celular-blocos.png', 'No celular: Blocos (montagem em cima, caverna embaixo).', 'phonegrid')}
</div>
{box('tip', 'Nada sai do computador sem você querer', '<p>O modo escola não tem servidor nem login. O progresso fica guardado no próprio navegador. O professor recebe as informações só quando o aluno <b>baixa o registro</b> e entrega o arquivo. O único dado pessoal é o apelido que o aluno digita (veja o capítulo 8).</p>')}
''')

# ---------------------------------------------------------------- 2
section('2', 'Para o aluno: começando', f'''
{img('escola-inicio.png', 'Tela Início com uma atividade do professor aberta: cada atividade mostra o andamento (tentativas ou estrelas).')}
<ol>
<li><b>Digite seu apelido</b> em "Quem é você?". Use um apelido, não o nome completo (por exemplo, "Ana B."). Ele vai no registro que o professor recebe.</li>
<li><b>Abra a atividade do professor</b>: cole o código que ele passou (começa com <code>PLANO1-</code>) e clique em <b>Abrir atividade</b>, ou use <b>Abrir arquivo</b> se ele mandou um arquivo.</li>
<li>Na lista de atividades, clique em <b>Fazer</b>. A tela certa (Detetive ou Blocos) abre com a caverna escolhida pelo professor.</li>
<li>Ao voltar ao Início, cada atividade mostra como você foi: "ainda não fez", o número de tentativas, ou as estrelas conquistadas.</li>
<li><b>Terminou?</b> Clique em <b>Enviar para o professor (baixar registro)</b>. Um arquivo <code>registro-…json</code> é baixado: entregue ao professor do jeito que ele pedir (e-mail, plataforma da escola, pendrive).</li>
</ol>
{box('trap', 'O download não funcionou?', '<p>Alguns computadores da escola bloqueiam downloads. Clique em <b>Mostrar o registro como texto</b>: o texto aparece selecionado numa caixa. Copie (Ctrl+C) e cole numa mensagem para o professor; ele salva o texto num arquivo <code>.json</code>.</p>')}
<p>Sem atividade do professor, use <b>Jogar livre</b>: Detetive com cavernas sorteadas, a campanha de missões dos Blocos e o Criador. As partidas livres também ficam registradas, num registro "Jogo livre".</p>
''')

# ---------------------------------------------------------------- 3
section('3', 'Detetive', f'''
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

# ---------------------------------------------------------------- 4
section('4', 'Programador com blocos', f'''
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
''')

# ---------------------------------------------------------------- 5
section('5', 'Criador de cavernas', f'''
{img('escola-criador.png', 'Criador: poços, Wumpus e ouro colocados sala a sala; a caverna está pronta e já tem código para compartilhar.')}
<ol>
<li>Dê um nome e escolha o tamanho (3 × 3 a 8 × 8).</li>
<li>Escolha a <b>ferramenta</b> (Poço, Wumpus, Ouro ou Apagar) e toque nas salas. Tocar de novo com a mesma ferramenta tira o que estava lá.</li>
<li>A lista abaixo das ferramentas avisa o que falta. A caverna só fica pronta com ouro, Wumpus e <b>um caminho sem poço da entrada até o ouro</b>.</li>
<li><b>Salvar</b> guarda em "Minhas cavernas" (o professor pode usá-las no plano, no mesmo computador). <b>Jogar no Detetive</b> e <b>Programar nela</b> abrem a caverna nas outras telas.</li>
<li><b>Compartilhar</b>: o código (começa com <code>CAV1-</code>) leva a caverna inteira. O colega cola o código na mesma caixa e clica em <b>Abrir código</b>.</li>
</ol>
{box('decision', 'Regras da caverna', '<ul><li>A entrada, sala (1, 1), fica sempre livre.</li><li>Wumpus e ouro nunca ficam dentro de um poço; colocar um poço apaga o que havia na sala.</li><li>Wumpus e ouro podem ficar na mesma sala: aí é preciso usar a flecha antes de pegar o ouro.</li></ul>')}
<p><b>Ideia de desafio:</b> cada aluno cria uma caverna e troca o código com um colega. Quem consegue vencer no Detetive com ★★★? E um programa de blocos que vença as duas cavernas?</p>
''')

# ---------------------------------------------------------------- 6
section('6', 'Para o professor: planejar a atividade', f'''
{img('escola-professor.png', 'Professor → Planejar: dados do plano e atividades à esquerda; adicionar atividade e entregar aos alunos à direita.')}
<h2>Montar o plano</h2>
<ol>
<li>Em <b>Professor → 1. Planejar a atividade</b>, preencha título, turma, seu nome e orientações. Para começar rápido, clique em <b>Usar plano de exemplo</b> (Detetive numa caverna sorteada e as três primeiras missões).</li>
<li>Em <b>Adicionar atividade</b>, escolha o <b>modo</b> (Detetive ou Blocos) e a <b>caverna</b>:
<ul>
<li><b>Missão da campanha</b>: uma das {len(MIS)} missões (cavernas fixas e blocos liberados aos poucos).</li>
<li><b>Sorteada</b>: digite uma palavra (semente). A mesma palavra e o mesmo tamanho geram a <b>mesma caverna para todos os alunos</b>, o que permite comparar.</li>
<li><b>Uma das minhas cavernas</b>: as salvas no Criador neste computador.</li>
<li><b>Código de caverna</b>: cole um código <code>CAV1-</code> (de um aluno, de um colega professor…).</li>
</ul></li>
<li>Título e orientação são opcionais. Use ↑ ↓ para reordenar e ✕ para remover.</li>
</ol>
<p>O plano é salvo sozinho no navegador enquanto você edita.</p>
<h2>Entregar aos alunos</h2>
<ul>
<li><b>Copiar código</b>: um texto que começa com <code>PLANO1-</code>, para o chat da turma ou a plataforma da escola.</li>
<li><b>Baixar arquivo do plano</b>: o mesmo conteúdo num arquivo <code>.json</code>. Guarde-o: ele é usado no relatório.</li>
<li><b>Testar como aluno</b>: abre o plano na tela Início deste computador, para conferir antes da aula.</li>
</ul>
{box('trap', 'Mudou o plano depois de entregar?', '<p>Pode acrescentar ou reordenar atividades, mas entregue o código novo. <b>Novo plano em branco</b> cria um plano com outra identificação: os registros dos alunos de um plano não se misturam com os de outro.</p>')}
<h2>Sugestão de aula (50 minutos)</h2>
{table(['Tempo', 'O que fazer'], [
    ['10 min', 'Sem computador: um aluno é o "robô" de olhos vendados na grade desenhada no chão ou no quadro; os colegas dão os comandos e o robô só diz o que sente.'],
    ['15 min', 'Detetive numa caverna sorteada (a mesma para todos): anotar no caderno, conferir, discutir as dicas.'],
    ['20 min', 'Blocos: missões 1 a 3 (sequência e repetição). Quem terminar tenta ★★★ ou cria uma caverna.'],
    ['5 min', 'Baixar e entregar o registro. Conversa: o que o robô "sabe"? Como ele decide sem ver o mapa?'],
])}
''')

# ---------------------------------------------------------------- 7
section('7', 'Para o professor: o relatório da turma', f'''
{img('escola-relatorio.png', 'Relatório da turma: visão geral (aluno × atividade), números por atividade e, mais abaixo, tudo o que cada aluno fez.')}
<ol>
<li>Recolha os arquivos <code>registro-…json</code> dos alunos.</li>
<li>Em <b>Professor → 2. Relatório da turma</b>, clique em <b>Abrir registros dos alunos</b> e escolha todos de uma vez (pode abrir mais depois). Se o plano não estiver aberto em "Planejar" neste computador, use <b>Abrir arquivo do plano</b>.</li>
<li>O relatório aparece na tela. <b>Baixar relatório (HTML)</b> gera um arquivo que abre em qualquer navegador; <b>Baixar planilha (CSV)</b> abre no Excel ou no Google Planilhas (uma linha por tentativa); <b>Imprimir</b> imprime ou salva em PDF.</li>
</ol>
<h2>O que o relatório mostra</h2>
{table(['Parte', 'Conteúdo'], [
    ['Visão geral', 'Uma linha por aluno, uma coluna por atividade: as estrelas (se venceu) ou como terminou a última tentativa, o número de tentativas e de dicas. "—" = ainda não tentou. A última coluna soma atividades concluídas e estrelas.'],
    ['Por atividade', 'Quantos tentaram e quantos venceram, média de tentativas até vencer, média de estrelas e total de dicas pedidas. Ajuda a ver qual atividade travou a turma.'],
    ['Tudo o que cada aluno fez', 'Cada tentativa em ordem: resultado, ações, tempo e, no Detetive, quantas vezes entrou em sala comprovadamente perigosa, riscos desnecessários, dicas e anotações certas/possíveis/erradas. Nos Blocos, o número de blocos, o erro (se houve) e o <b>programa escrito como texto</b>.'],
])}
<h2>Como ler os números (pensamento computacional)</h2>
{table(['Sinal', 'Pode indicar'], [
    ['Muitas tentativas com o mesmo erro de programa', 'Dificuldade com o conceito da missão (por exemplo, condição do "repetir até"). Vale uma conversa sobre depuração.'],
    ['Venceu com ★ mas não com ★★', 'Resolveu, mas sem usar repetição ou função: hora de falar de padrões e abstração.'],
    ['Detetive: "entrou em sala comprovadamente perigosa"', 'Ainda não conecta a pista (brisa, fedor) à sala vizinha. Retome com o caderno e a conferência.'],
    ['Muitas dicas e anotações erradas', 'Está tentando raciocinar: um bom momento para mediar.'],
    ['Poucas tentativas e ★★★', 'Pronto para o próximo desafio: criar uma caverna para os colegas ou ir para o jogo 3D completo.'],
])}
{box('notdo', 'O que o relatório não faz', '<ul><li>Não junta os registros sozinho: não há servidor. Os arquivos chegam pelo canal que a escola já usa.</li><li>Não dá nota. As estrelas e contagens são pistas para a mediação, não uma avaliação pronta.</li><li>Não sabe se o aluno trocou de apelido: dois apelidos aparecem como dois alunos.</li></ul>')}
''')

# ---------------------------------------------------------------- 8
section('8', 'Privacidade e dados', f'''
<ul>
<li><b>Sem conta e sem servidor.</b> Nada é enviado pela internet. O site só baixa as próprias páginas.</li>
<li><b>Único dado pessoal: o apelido.</b> Oriente os alunos a não usar o nome completo. Isso vai ao encontro do art. 14 da LGPD (Lei 13.709/2018), que pede cuidado especial com dados de crianças e adolescentes.</li>
<li><b>O que fica no navegador</b> (localStorage): apelido, plano aberto, registros, cavernas salvas, programas das missões, estrelas e o plano que o professor está montando. Em computador compartilhado, isso fica visível para o próximo usuário do mesmo navegador.</li>
<li><b>Apagar</b>: limpar os dados do site nas configurações do navegador (ou usar uma janela anônima, que apaga tudo ao fechar — mas aí o aluno precisa baixar o registro antes de fechar).</li>
<li>Os registros que o professor recebe ficam no computador dele. O relatório baixado também.</li>
</ul>
''')

# ---------------------------------------------------------------- 9
section('9', 'Perguntas frequentes', f'''
{table(['Pergunta', 'Resposta'], [
    ['O aluno trocou de computador no meio da atividade.', 'Ele abre o mesmo plano no computador novo e continua. No fim, entrega os dois registros: o relatório junta as tentativas do mesmo apelido.'],
    ['Apareceu "registro(s) de outro plano".', 'O arquivo foi gerado com outro plano (por exemplo, o plano de exemplo ou uma versão em branco). Abra o arquivo do plano certo ou peça ao aluno para reabrir a atividade pelo código correto.'],
    ['O código do plano é muito comprido.', 'É normal: ele leva o plano inteiro, inclusive as cavernas. Prefira o arquivo, ou cole o código num documento compartilhado com a turma.'],
    ['Posso usar no celular?', 'Sim. No Blocos, a área de montagem fica em cima e a caverna embaixo; arrastar com o dedo funciona.'],
    ['O computador da escola não tem internet.', 'Depois de aberta, a página funciona sem internet. Para não depender da rede, dá para hospedar o site na rede da escola (os arquivos do <code>dist/</code> são estáticos).'],
    ['Como os alunos chegam ao jogo 3D completo?', 'Pelo link "Jogo 3D completo" no alto. Lá estão os agentes inteligentes, a Arena e o algoritmo genético (manual próprio).'],
])}
<h2>Referência rápida</h2>
{table(['Onde', 'Atalho'], [
    ['Detetive', 'W/↑ avançar · A/← girar à esquerda · D/→ girar à direita · G pegar · Espaço atirar · Tab + Enter anotar sala'],
    ['Blocos', 'Arrastar da categoria para dentro de "quando começar" · arrastar para a lixeira para apagar · Ctrl+Z desfazer'],
    ['Códigos', '<code>PLANO1-…</code> plano do professor · <code>CAV1-…</code> caverna'],
    ['Arquivos', '<code>plano-….json</code> plano · <code>registro-….json</code> registro do aluno · <code>relatorio-turma-….html/.csv</code> relatório'],
])}
''')

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)
extra = '''
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
table.compact td { vertical-align: top; }
'''
doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual do modo escola</title>
<style>{css}{extra}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Wumpus 3D · Modo escola</div>
    <h1>Caverna do Pensamento</h1>
    <p class="sub">Manual do aluno e do professor: Detetive, Programador com blocos, Criador de cavernas, planejamento da atividade e relatório da turma.</p>
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
