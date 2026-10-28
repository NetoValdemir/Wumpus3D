# Gera o "Manual de uso" do Wumpus 3D.
import base64, html, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]  # raiz do projeto
OUT = pathlib.Path(sys.argv[1])
IMG = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).parent / 'img'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
_hoje = __import__('datetime').date.today()
DATE = f'{_hoje.day} de {MESES[_hoje.month - 1]} de {_hoje.year}'
COMMIT = subprocess.run(['git', '-C', str(ROOT), 'log', '-1', '--format=%h'], capture_output=True, text=True).stdout.strip()
css = re.search(r'<style>(.*?)</style>', (pathlib.Path(__file__).parent / 'documentacao.py').read_text(), re.S).group(1)
css = css.replace('{{', '{').replace('}}', '}')


def esc(s):
    return html.escape(s, quote=False)


def box(kind, title, body):
    return f'<aside class="box {kind}"><b>{title}</b>{body}</aside>'


def table(head, rows, cls=''):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def img(name, caption, cls='', marks=()):
    data = base64.b64encode((IMG / name).read_bytes()).decode()
    pins = ''.join(f'<span class="pin" style="left:{x}%;top:{y}%">{n}</span>' for n, x, y in marks)
    return f'<figure class="shot {cls}"><div class="pinwrap"><img src="data:image/png;base64,{data}" alt="{esc(caption)}"/>{pins}</div><figcaption>{caption}</figcaption></figure>'


def kbd(*keys):
    return ' '.join(f'<kbd>{k}</kbd>' for k in keys)


def code(text, label=None):
    cap = f'<figcaption>{esc(label)}</figcaption>' if label else ''
    return f'<figure class="code">{cap}<pre>{esc(text.strip(chr(10)))}</pre></figure>'


sections, toc = [], []


def section(num, title, body):
    sid = f's{num}'
    toc.append((num, title, sid))
    sections.append(f'<section id="{sid}" class="chapter"><h1><span class="num">{num}</span>{title}</h1>{body}</section>')


# ---------------------------------------------------------------- 1
section('1', 'Primeiros passos', f'''
<p class="lead">O <b>Wumpus 3D</b> é um jogo de exploração e raciocínio. Você entra numa caverna escura dividida em salas, precisa achar o ouro e voltar vivo até a entrada, sem ver o mapa: só sente pistas na sala onde está. Você pode jogar ou assistir agentes de inteligência artificial jogando.</p>

<h2>Abrindo o jogo</h2>
<p>O jogo roda no navegador, sem instalação. Use uma versão recente do Chrome, Edge, Firefox ou Safari; o navegador precisa ter WebGL (gráficos 3D) ativo, o que é o padrão. Funciona no computador e no celular.</p>

<h2>A tela</h2>
{img('inicio.png', 'Tela do jogo no computador, logo depois do primeiro passo. Os números indicam as áreas descritas na tabela abaixo.', marks=[(1, 0.6, 8.6), (2, 48.4, 8.6), (3, 30, 30), (4, 12.5, 43), (5, 30.8, 88.5), (6, 56.6, 82), (7, 38.6, 94), (8, 72.4, 3.6)])}
{table(['#', 'Área', 'O que mostra'], [
    ['1', 'Placares', '<b>Pontos</b>, <b>Posição</b> (sala e direção), <b>Flechas</b> (0 ou 1), <b>Ouro</b> (se você já pegou) e <b>Objetivo</b> (o que fazer agora).'],
    ['2', 'Percepções', 'As cinco pistas da sala atual. A que está acesa fica colorida: Fedor (verde), Brisa (azul), Brilho (dourado), Batida (laranja), Grito (vermelho).'],
    ['3', 'Mapa 3D', 'A caverna. Salas já visitadas ficam claras; as desconhecidas ficam escuras.'],
    ['4', 'Entrada', 'O anel azul marca a sala (1, 1), onde você começa e para onde precisa voltar com o ouro.'],
    ['5', 'Histórico', 'As últimas mensagens do jogo (a mais recente em cima). Quando um agente joga, aparece também o "pensamento" dele num balão azul.'],
    ['6', 'Botões de ação', 'Girar, andar, atirar e pegar. Quando um agente joga, viram Jogar, Um passo e Parar.'],
    ['7', 'Botões gerais', 'Câmera, Mapa, Reiniciar, Novo mapa e Configurar.'],
    ['8', 'Painel de configuração', 'Todas as opções do jogo. Pode ser fechado para o mapa ocupar a tela toda.'],
])}

<h2>Sua primeira partida em 30 segundos</h2>
<ol>
<li>Confira que em <b>Quem joga</b> está selecionado <b>Você (teclado)</b>.</li>
<li>Ande com {kbd('W')} ou {kbd('↑')} e gire com {kbd('A')} / {kbd('D')} (ou as setas).</li>
<li>Observe as percepções: <b>Brisa</b> quer dizer que há um poço em alguma sala vizinha; <b>Fedor</b>, que o Wumpus está numa sala vizinha.</li>
<li>Quando aparecer <b>Brilho</b>, aperte {kbd('G')} para pegar o ouro.</li>
<li>Volte até o anel azul. Ao chegar com o ouro, você vence.</li>
</ol>
''')

# ---------------------------------------------------------------- 2
SIZES = [(4, 320), (5, 500), (6, 720), (7, 980), (8, 1280), (10, 2000)]
section('2', 'Regras completas', f'''
<h2>A caverna</h2>
<ul>
<li>A caverna é uma grade de salas quadradas: de 4 × 4 a 10 × 10, conforme a configuração.</li>
<li>As salas são numeradas como <b>(coluna, linha)</b>, começando em <b>(1, 1)</b> no canto sudoeste. A coluna cresce para o leste (direita) e a linha cresce para o norte (para dentro da tela).</li>
<li>Você começa na entrada <b>(1, 1)</b>, virado para o <b>leste</b>, com <b>uma flecha</b>.</li>
<li>Duas salas são vizinhas quando estão lado a lado ao norte, sul, leste ou oeste. Diagonal não conta.</li>
</ul>

<h2>O que existe na caverna</h2>
{table(['Elemento', 'Regra'], [
    ['Poço', 'Cada sala, exceto a entrada, pode ter um poço, com a chance escolhida em "Chance de poço por sala". Entrar numa sala com poço mata na hora. Pode haver vários poços ou nenhum.'],
    ['Wumpus', 'Um único monstro, parado numa sala que não é a entrada. Entrar na sala dele <b>enquanto ele está vivo</b> mata. Depois que ele morre, a sala dele fica segura (a não ser que também tenha um poço).'],
    ['Ouro', 'Um único ouro, numa sala que não é a entrada, não tem poço e não é a do Wumpus.'],
])}
{box('tip', 'Todo mapa sorteado tem solução', '<p>O jogo só aceita mapas sorteados em que existe um caminho da entrada até o ouro sem pisar em poço. Às vezes esse caminho passa pela sala do Wumpus, e aí é preciso matá-lo com a flecha. Mapas <b>importados</b> não passam por essa checagem (veja o capítulo 7).</p>')}

<h2>Percepções</h2>
<p>Você não vê o mapa. A cada passo, o jogo diz o que você sente <b>na sala onde está</b>:</p>
{table(['Percepção', 'Quando acende', 'Detalhes'], [
    ['<b>Fedor</b>', 'O Wumpus está numa sala vizinha.', 'O fedor <b>continua</b> depois que o Wumpus morre (o corpo ainda está lá). A névoa verde em volta do personagem some quando ele morre, mas a percepção "Fedor" continua acesa.'],
    ['<b>Brisa</b>', 'Há poço em pelo menos uma sala vizinha.', 'A brisa não diz quantos poços nem em qual vizinha. As partículas azuis em volta do personagem indicam brisa.'],
    ['<b>Brilho</b>', 'O ouro está nesta sala.', 'O ouro aparece girando no chão. O botão <b>Pegar</b> pisca.'],
    ['<b>Batida</b>', 'A última ação foi andar contra a parede.', 'Você não sai do lugar.'],
    ['<b>Grito</b>', 'A flecha acabou de matar o Wumpus.', 'Aparece só no passo do tiro.'],
])}

<h2>Ações</h2>
{table(['Ação', 'O que faz', 'Custo'], [
    ['Andar', 'Vai para a sala à frente. Contra a parede, não se move e sente Batida.', '−1'],
    ['Girar à esquerda / à direita', 'Vira 90° sem sair do lugar.', '−1'],
    ['Atirar', 'A flecha voa em linha reta na direção em que você está virado, até a parede. Se passar pela sala do Wumpus, ele morre. Você só tem uma flecha.', '−1 e −10 (mesmo errando)'],
    ['Pegar', 'Pega o ouro, se ele estiver na sala.', '−1 (e +1000 se pegou o ouro)'],
])}
<p>Toda ação custa 1 ponto, inclusive girar, bater na parede, atirar sem flecha ("Você não tem mais flechas") e tentar pegar onde não há ouro ("Não há nada para pegar aqui"). Por isso, caminhos curtos e poucos giros dão mais pontos.</p>

<h2>Pontuação</h2>
{table(['Evento', 'Pontos'], [
    ['Cada ação', '−1'],
    ['Atirar a flecha (além da ação)', '−10'],
    ['Pegar o ouro', '+1000'],
    ['Voltar à entrada com o ouro (vitória)', '+500'],
    ['Cair num poço ou ser devorado pelo Wumpus', '−1000'],
])}
<p>Exemplo: pegar o ouro e voltar em 20 ações sem atirar dá 1000 + 500 − 20 = <b>1480 pontos</b>.</p>

<h2>Como a partida termina</h2>
{table(['Resultado', 'Quando acontece'], [
    ['<b>Vitória</b>', 'Você chega à sala (1, 1) <b>carregando o ouro</b>. É automático: não precisa apertar nada.'],
    ['<b>Caiu no poço</b>', 'Você entrou numa sala com poço.'],
    ['<b>Devorado pelo Wumpus</b>', 'Você entrou na sala do Wumpus vivo.'],
    ['<b>Tempo esgotado</b>', 'Você atingiu o limite de ações da partida: tamanho × tamanho × 20. São 320 ações no 4 × 4, 500 no 5 × 5, 720 no 6 × 6, 980 no 7 × 7, 1280 no 8 × 8 e 2000 no 10 × 10.'],
])}
{box('decision', 'Voltar à entrada sem o ouro não termina o jogo', '<p>Se você passar pela entrada sem o ouro, aparece a mensagem "De volta à entrada, mas sem o ouro. A partida continua." Não existe a opção de desistir e sair da caverna.</p>')}
''')

# ---------------------------------------------------------------- 3
section('3', 'Controles', f'''
<h2>Quando você joga</h2>
{table(['Tecla', 'Botão', 'Ação'], [
    [kbd('W') + ' ou ' + kbd('↑'), '▲', 'Andar para a frente'],
    [kbd('A') + ' ou ' + kbd('←'), '⟲', 'Girar à esquerda'],
    [kbd('D') + ' ou ' + kbd('→'), '⟳', 'Girar à direita'],
    [kbd('Espaço'), 'Atirar', 'Atirar a flecha'],
    [kbd('G'), 'Pegar', 'Pegar o ouro'],
], 'compact')}

<h2>Quando um agente joga</h2>
{table(['Tecla', 'Botão', 'Ação'], [
    [kbd('Espaço'), '▶ Jogar / ⏸ Pausar', 'Começa ou pausa o agente. Pausar mantém a partida onde está.'],
    [kbd('N'), 'Um passo', 'O agente faz uma única ação. Bom para acompanhar o raciocínio.'],
    [kbd('T'), '⏹ Parar', 'Interrompe o agente e volta a partida ao início, <b>no mesmo mapa</b>.'],
], 'compact')}

<h2>Sempre disponíveis</h2>
{table(['Tecla', 'Botão', 'Ação'], [
    [kbd('V'), 'Câmera', 'Alterna entre a câmera que segue o personagem e a visão geral do mapa inteiro.'],
    [kbd('M'), 'Mapa', 'Revela ou esconde todo o mapa (poços, Wumpus e ouro). Fica ligado até você desligar, mesmo em partidas novas.'],
    [kbd('T'), 'Reiniciar', 'Volta ao início da partida no mesmo mapa (pontos zerados, flecha de volta).'],
    [kbd('R'), 'Novo mapa', 'Sorteia outro mapa com o tamanho e a chance de poço atuais.'],
    [kbd('C'), '⚙ Configurar', 'Mostra ou esconde o painel de configuração.'],
], 'compact')}
{box('trap', 'As teclas não respondem?', '<p>Quando o cursor está num campo de texto, numa lista de seleção ou na caixa de JSON, as teclas do jogo são ignoradas, para você poder digitar. Clique no mapa 3D para devolver o controle ao jogo. Na tela da Arena as teclas do jogo também não funcionam; feche a Arena primeiro.</p>')}
{box('tip', 'O modo "Mapa" é para estudar', '<p>Revelar o mapa só muda o que <b>você</b> vê. Os agentes continuam sem ver nada e decidem só pelas percepções. Use para conferir se um agente está raciocinando bem.</p>')}
''')

# ---------------------------------------------------------------- 4
section('4', 'O que se vê no mapa 3D', f'''
{table(['Elemento', 'Aparência', 'Quando aparece'], [
    ['Você (personagem)', 'Cápsula azul com um cone amarelo apontando para a frente e uma tocha', 'Sempre (some se cair num poço).'],
    ['Entrada', 'Anel azul no chão', 'Sempre.'],
    ['Sala visitada', 'Piso claro', 'Depois que você passa por ela.'],
    ['Sala desconhecida', 'Piso escuro', 'Até ser visitada.'],
    ['Poço', 'Buraco preto com borda de pedra', 'Quando você entra na sala, no fim da partida ou com "Mapa" ligado.'],
    ['Wumpus', 'Monstro vermelho com chifres e olhos amarelos; cinza e tombado quando morto', 'Quando morre, quando você entra na sala dele, no fim da partida ou com "Mapa" ligado.'],
    ['Ouro', 'Pedra dourada girando, com luz própria', 'Quando você está na sala ou já a visitou. Depois de pego, flutua sobre o personagem.'],
    ['Brisa', 'Partículas azul-claras girando em volta do personagem', 'Quando sente brisa.'],
    ['Fedor', 'Névoa verde subindo em volta do personagem', 'Quando sente fedor e o Wumpus está vivo.'],
    ['Flecha', 'Traço claro voando em linha reta', 'Logo após atirar.'],
])}
<h2>As duas câmeras</h2>
<ul>
<li><b>Seguir</b> (padrão): a câmera acompanha o personagem por trás e de cima, sempre olhando para o norte. Ela não gira com o personagem, para "esquerda" e "direita" na tela não mudarem a cada giro.</li>
<li><b>Visão geral</b> ({kbd('V')}): mostra a caverna inteira. Útil em mapas grandes e para ver o raciocínio dos agentes.</li>
</ul>
''')

# ---------------------------------------------------------------- 5
section('5', 'Painel de configuração: Partida', f'''
<p>O painel fica à direita do mapa no computador e embaixo dele no celular. Ele nunca cobre o mapa: quando está aberto, o mapa encolhe. Feche com <b>Fechar</b> ou {kbd('C')}; reabra com <b>⚙ Configurar</b> ou {kbd('C')}. No computador ele começa aberto; em telas de até 760 px de largura, começa fechado.</p>
{img('painel.png', 'Parte de cima do painel: seções Partida e Mapas.', 'narrow')}
<h2>Tamanho do mapa</h2>
<p>Opções: 4 × 4 (clássico), 5 × 5, 6 × 6, 7 × 7, 8 × 8 e 10 × 10.</p>
<ul>
<li>Ao mudar, um <b>novo mapa é sorteado</b> na hora e a partida recomeça.</li>
<li>Mapas maiores são mais difíceis e mais longos: o ouro tende a ficar mais longe e há mais poços no total. O limite de ações cresce junto (capítulo 2).</li>
</ul>
<h2>Chance de poço por sala</h2>
<p>Opções: 10%, 15%, 20% (clássico), 25% e 30%.</p>
<ul>
<li>É a probabilidade de cada sala (exceto a entrada) ter um poço. Com 20% num 4 × 4, a média é de 3 poços.</li>
<li>Ao mudar, um <b>novo mapa é sorteado</b>.</li>
<li>Os agentes inteligentes usam esse número nos cálculos de risco.</li>
</ul>
<h2>Quem joga</h2>
{table(['Opção', 'Como joga'], [
    ['Você (teclado)', 'Você controla pelo teclado ou pelos botões.'],
    ['Agente aleatório', 'Anda e gira ao acaso. Só pega o ouro se tropeçar nele. Serve como referência mínima.'],
    ['Agente lógico', 'Deduz pelas percepções quais salas são comprovadamente seguras e vai nelas primeiro. Atira quando descobre onde está o Wumpus. Sem sala segura, arrisca a que tem menos indícios de perigo.'],
    ['Agente probabilístico', 'Faz as mesmas deduções e, sem sala segura, calcula a probabilidade de poço e de Wumpus em cada sala e vai na de menor risco.'],
    ['Agente genético', 'Escolhe a próxima sala com uma fórmula de pesos aprendida por um algoritmo genético (capítulo 8).'],
    ['Agentes importados', 'Aparecem num grupo separado, com o nome do autor, depois de importados na Arena (capítulo 10).'],
])}
<p><b>Trocar de jogador mantém o mesmo mapa</b> e recomeça a partida. Assim você compara agentes no mesmo cenário. A descrição do jogador escolhido aparece logo abaixo da lista.</p>
<h2>🏆 Arena</h2>
<p>Abre a tela da Arena, onde você importa agentes e organiza competições (capítulo 10).</p>
<h2>Velocidade</h2>
<p>De 1 a 20 passos por segundo (padrão: 4). Só aparece quando um agente está jogando. Pode ser mudada durante a partida.</p>
<h2>Mostrar raciocínio do agente</h2>
{img('principal.png', 'Agente probabilístico num mapa 6 × 6 com "Mostrar raciocínio" ligado. O balão azul mostra o pensamento do agente.', 'wide')}
<p>Ligado por padrão. Aparece para os agentes lógico, probabilístico, genético e importados (não para você nem para o aleatório). Pinta no piso o que o agente acredita sobre cada sala desconhecida:</p>
{table(['Cor do disco', 'Rótulo', 'Significado'], [
    ['Verde', '"Segura"', 'O agente provou que não há poço nem Wumpus.'],
    ['Amarelo', '"Poço 20%", "Wumpus 33%"', 'Risco moderado. Os números são as probabilidades calculadas.'],
    ['Laranja a vermelho', '"Poço 100%"', 'Risco alto ou perigo certo.'],
])}
<p>Só aparecem as salas vizinhas de salas já visitadas (as próximas opções do agente) e, se o Wumpus estiver restrito a até 3 salas, as salas onde ele pode estar. Agentes importados só mostram discos se enviarem essas informações.</p>
''')

# ---------------------------------------------------------------- 6
section('6', 'Assistindo agentes', f'''
<ol>
<li>Escolha um agente em <b>Quem joga</b>.</li>
<li>Aperte <b>▶ Jogar</b> ({kbd('Espaço')}) para ele jogar sozinho na velocidade configurada, ou <b>Um passo</b> ({kbd('N')}) para avançar uma ação por vez.</li>
<li>Acompanhe o <b>pensamento</b> no balão azul, por exemplo: "(3, 3) é segura, indo explorar."</li>
<li>Use <b>⏸ Pausar</b> para congelar e <b>⏹ Parar</b> ({kbd('T')}) para interromper e voltar ao início do mesmo mapa.</li>
</ol>
{box('tip', 'Comparando agentes no mesmo mapa', '<p>Deixe um agente jogar até o fim, clique em <b>Repetir este mapa</b> e troque de jogador. O mapa continua o mesmo. Para guardar o mapa e testar outro dia, salve-o (capítulo 7).</p>')}
<h2>Situações especiais</h2>
{table(['O que você vê', 'O que significa'], [
    ['O agente gira no lugar sem parar', 'Todas as salas que restam são perigo comprovado. Não há jogada possível, e a partida termina por tempo esgotado.'],
    ['"Erro do agente: ..." no histórico', 'O agente (normalmente um importado) deu erro, devolveu uma ação inválida ou demorou mais de 3 segundos para decidir. Ele para de jogar; use Reiniciar ou troque de jogador.'],
    ['O agente atira sem ter certeza', 'Os agentes lógico e probabilístico atiram quando o Wumpus está restrito a até 3 salas e não há sala segura. Se errar, eles riscam as salas da linha do tiro.'],
    ['O agente volta para a entrada', 'Ele já tem o ouro e está voltando pelo caminho que conhece.'],
])}
''')

# ---------------------------------------------------------------- 7
section('7', 'Mapas: salvar, repetir, exportar e importar', f'''
<p>Toda partida tem um <b>mapa</b>: posição dos poços, do Wumpus e do ouro. A seção <b>Mapas</b> do painel guarda e transporta mapas. "Mapa atual" mostra o nome do mapa em uso, ou "sorteado".</p>
<h2>Salvar o mapa atual</h2>
<ol>
<li>Digite um nome no campo <b>Nome do mapa</b> (até 60 caracteres). É opcional: em branco, o nome vira algo como "Mapa 4×4 — 28/10/2026, 14:30:00".</li>
<li>Clique em <b>Salvar</b>.</li>
</ol>
<ul>
<li>O que é salvo é o mapa <b>do começo</b> da partida, não o andamento: mesmo depois de pegar o ouro, o mapa salvo tem o ouro no lugar original.</li>
<li>Salvar com um nome que já existe <b>substitui</b> o mapa antigo.</li>
<li>Os mapas ficam salvos <b>neste navegador, neste aparelho</b>. Para levar a outro computador, exporte.</li>
</ul>
<h2>Usar um mapa salvo</h2>
<p>Escolha na lista <b>Mapas salvos neste navegador</b> e clique em:</p>
{table(['Botão', 'O que faz'], [
    ['Jogar', 'Carrega o mapa e recomeça a partida com o jogador atual. Se o tamanho do mapa existir na lista "Tamanho do mapa", ela é atualizada.'],
    ['Exportar', 'Baixa o mapa como arquivo <code>.json</code> e também mostra o texto na caixa "Copiar ou colar JSON".'],
    ['Excluir', 'Pede confirmação: o botão vira "Confirmar?" e é preciso clicar de novo. Trocar o mapa selecionado cancela a confirmação.'],
])}
<h2>Exportar e importar</h2>
<ul>
<li><b>Exportar mapa atual</b>: exporta o mapa em uso, mesmo sem tê-lo salvo.</li>
<li><b>Importar .json</b>: escolha um arquivo exportado. Se for válido, ele é salvo na lista e carregado na hora.</li>
<li><b>Copiar ou colar JSON</b>: abre uma caixa de texto. <b>Copiar</b> copia o JSON (se a caixa estiver vazia, copia o mapa atual). <b>Carregar JSON</b> importa o texto colado na caixa. Útil para mandar um mapa por chat ou e-mail.</li>
</ul>
{box('trap', 'O download não começou?', '<p>Alguns ambientes bloqueiam downloads iniciados pela página (por exemplo, a versão de demonstração dentro do claude.ai). O JSON continua disponível na caixa de texto para copiar.</p>')}
<h2>Formato do arquivo</h2>
{code("""{
  "format": "wumpus3d-map",
  "version": 1,
  "name": "Caverna da prova",
  "size": 4,
  "pitProbability": 0.2,
  "pits": [[3, 1], [3, 3], [4, 4]],
  "wumpus": [1, 3],
  "gold": [2, 3]
}""", 'Exemplo de mapa (coordenadas como na tela: [coluna, linha], começando em 1)')}
<p>Você pode escrever mapas à mão nesse formato. Regras de validação na importação:</p>
{table(['Campo', 'Regra', 'Se estiver errado'], [
    ['<code>format</code>', 'Obrigatório, exatamente <code>"wumpus3d-map"</code>.', 'Recusado: "Este JSON não é um mapa do Wumpus 3D".'],
    ['<code>size</code>', 'Número inteiro de 3 a 12.', 'Recusado.'],
    ['<code>pits</code>', 'Lista de salas <code>[coluna, linha]</code>, cada uma de 1 a <code>size</code>. Pode ser vazia.', 'Recusado, dizendo qual poço está errado.'],
    ['<code>wumpus</code>, <code>gold</code>', 'Uma sala <code>[coluna, linha]</code> de 1 a <code>size</code>.', 'Recusado.'],
    ['Entrada (1, 1)', 'Nenhum poço, Wumpus ou ouro pode ficar nela.', 'Recusado: "não pode ficar na entrada (1, 1)".'],
    ['Ouro em poço', 'Não permitido (seria impossível vencer).', 'Recusado.'],
    ['<code>name</code>', 'Opcional, até 60 caracteres.', 'Em branco vira "Mapa importado".'],
    ['<code>pitProbability</code>', 'Opcional, número de 0 a 1. É usado pelos agentes nos cálculos de risco.', 'Se faltar, é calculado como número de poços ÷ (salas − 1).'],
])}
{box('notdo', 'Mapas importados podem não ter solução', '<p>Diferente dos mapas sorteados, um mapa importado <b>não</b> é testado para garantir caminho até o ouro. Ele pode ter o ouro cercado de poços, ou o ouro na mesma sala do Wumpus (aí é obrigatório matar o Wumpus antes). Mapas de tamanho 3, 9, 11 ou 12 funcionam, mas não aparecem na lista "Tamanho do mapa".</p>')}
''')

# ---------------------------------------------------------------- 8
section('8', 'Agente genético: pesos e treino', f'''
<p>Quando <b>Agente genético</b> está selecionado em "Quem joga", aparece a seção <b>Agente genético</b> no painel.</p>
{img('genetico.png', 'Seção do agente genético: os 12 pesos em barras e os controles de treino.', 'narrow')}
<h2>Os pesos</h2>
<p>O agente decide com uma fórmula de 12 pesos. Cada barra mostra um peso: verde para a direita (positivo, a característica <b>aumenta</b> a vontade de ir para uma sala) ou vermelha para a esquerda (negativo, <b>diminui</b>). "Pesos em uso" diz se são os pesos padrão (pré-treinados) ou treinados por você. Passe o mouse sobre um peso para ver a descrição.</p>
<h2>Treinar</h2>
{table(['Campo', 'Faixa', 'Padrão', 'O que controla'], [
    ['Gerações', '1 a 200', '15', 'Quantas rodadas de evolução. Mais gerações = mais tempo e, em geral, pesos melhores.'],
    ['População', '6 a 100', '20', 'Quantas versões do agente competem em cada geração.'],
    ['Mapas por geração', '1 a 200', '20', 'Quantos mapas cada versão joga por geração. Mais mapas = avaliação mais confiável e treino mais lento.'],
    ['Treinar só no mapa atual', 'ligado/desligado', 'desligado', 'Ligado: todas as versões jogam só o mapa atual. O agente fica ótimo nele, mas pior em outros mapas.'],
])}
<ul>
<li>O treino usa o <b>tamanho e a chance de poço do mapa atual</b>.</li>
<li>Clique em <b>Treinar</b>. O gráfico mostra, por geração, a melhor pontuação (amarelo) e a média (cinza). A tela continua utilizável durante o treino.</li>
<li>No fim, as 5 melhores versões jogam mapas novos, e a vencedora passa a ser usada. Os pesos ficam salvos neste navegador.</li>
<li><b>Parar treino</b> interrompe e usa a melhor versão da última geração completa.</li>
<li><b>Usar pesos padrão</b> volta aos pesos que vêm com o jogo. Fica desativado se eles já estão em uso.</li>
</ul>
{box('tip', 'Quanto tempo demora', '<p>O custo é gerações × população × mapas por geração partidas. Com os valores padrão (15 × 20 × 20 = 6.000 partidas, mais a validação final), leva por volta de 15 segundos num 4 × 4 num computador comum. Num 8 × 8 cada partida custa cerca de 15 vezes mais, então o mesmo treino passa de alguns minutos.</p>')}
''')

# ---------------------------------------------------------------- 9
section('9', 'Avaliação em 100 partidas', f'''
<p>A seção <b>Avaliação</b> aparece quando um agente está selecionado. <b>Avaliar em 100 partidas</b> faz o agente jogar 100 partidas sem animação e mostra o resultado, por exemplo:</p>
{code('Agente probabilístico em mapas 4×4 sorteados: 72 vitórias, 28 mortes. Pontuação média: 790.')}
<ul>
<li>Desligado <b>Usar só o mapa atual</b> (padrão): são 100 mapas sorteados com o tamanho e a chance de poço do mapa atual.</li>
<li>Ligado: as 100 partidas são no mapa atual. Para agentes que sempre tomam as mesmas decisões (lógico, probabilístico, genético), o resultado se repete 100 vezes; serve mais para o agente aleatório ou agentes importados com sorteio.</li>
<li>O resultado também mostra partidas por tempo esgotado e erros, quando houver.</li>
</ul>
''')

# ---------------------------------------------------------------- 10
section('10', 'Arena de agentes', f'''
<p>A Arena serve para comparar agentes, inclusive agentes escritos por outras pessoas. Abra pelo botão <b>🏆 Arena</b> no painel. Feche com <b>Fechar</b> ou {kbd('Esc')}.</p>
{img('arena.png', 'Tela da Arena depois de uma competição com 100 mapas.', 'wide')}
<h2>Participantes</h2>
<ul>
<li>Os quatro agentes de referência aparecem sempre. O aleatório começa desmarcado; os outros, marcados.</li>
<li>Marque ou desmarque quem vai competir.</li>
<li><b>Importar agente (.js)</b>: escolha um ou mais arquivos de agente. Cada um é testado na hora; se funcionar, aparece na lista e em "Quem joga".</li>
<li><b>Ver modelo de agente</b>: mostra o código do agente de exemplo na caixa "Colar código de agente", pronto para editar.</li>
<li><b>Colar código de agente</b> → <b>Adicionar agente</b>: importa o código colado. <b>Copiar</b> copia o código da caixa.</li>
<li><b>Assistir</b> (agentes importados): fecha a Arena e coloca o agente para jogar no mapa atual.</li>
<li><b>Remover</b> (agentes importados): pede confirmação ("Confirmar?").</li>
<li>Importar de novo um agente com o mesmo nome e autor <b>substitui</b> a versão anterior.</li>
</ul>
<h2>Mensagens ao importar</h2>
{table(['Mensagem', 'Causa'], [
    ['O agente passou de 1000 ms para responder', 'O código trava ou é lento demais (por exemplo, um laço infinito).'],
    ['SyntaxError: ...', 'Erro de digitação no código.'],
    ['O arquivo não chamou registerAgent({ ... })', 'O arquivo não registra nenhum agente.'],
    ['Ação inválida: "..."', 'O agente devolveu algo que não é forward, left, right, shoot ou grab.'],
])}
<h2>Regras da competição</h2>
{table(['Campo', 'Faixa', 'Padrão', 'O que controla'], [
    ['Mapas', '1 a 1000', '100', 'Quantos mapas cada agente joga.'],
    ['Tamanho', '4, 5, 6, 8, 10', '4 × 4', 'Tamanho dos mapas.'],
    ['Poços', '10%, 20%, 30%', '20%', 'Chance de poço por sala.'],
    ['Semente', 'qualquer texto', '"wumpus"', 'Define quais mapas são sorteados. A mesma semente gera sempre os mesmos mapas, em qualquer computador. Troque para outra competição.'],
    ['Limite por decisão (ms)', '50 a 10000', '1000', 'Tempo máximo que um agente pode levar para decidir cada ação. Passou disso, a partida conta como erro.'],
    ['Usar meus mapas salvos', 'ligado/desligado', 'desligado', 'Em vez de sortear, usa todos os mapas salvos neste navegador (podem ter tamanhos diferentes).'],
])}
<p><b>Iniciar competição</b> começa; a barra mostra o progresso, e o botão vira <b>Parar competição</b>. Parar no meio mostra o ranking com os mapas jogados até ali. Todos os agentes jogam exatamente os mesmos mapas.</p>
<h2>O ranking</h2>
{table(['Coluna', 'Significado'], [
    ['#', 'Posição (🥇🥈🥉 para os três primeiros).'],
    ['Agente', 'Nome e autor. Passe o mouse para ver o primeiro erro, se houve.'],
    ['Pontos', 'Pontuação média por partida. É o critério do ranking.'],
    ['Vitórias', 'Porcentagem de partidas vencidas.'],
    ['Mortes (poço/Wumpus)', 'Porcentagem de mortes e, entre parênteses, quantas foram por poço e quantas pelo Wumpus.'],
    ['Tempo esgotado', 'Partidas que atingiram o limite de ações.'],
    ['Erros', 'Partidas interrompidas por erro do agente. Contam como derrota (−1000).'],
    ['Ações/vitória', 'Média de ações nas partidas vencidas. Menor = caminho mais eficiente.'],
    ['ms/decisão', 'Tempo médio para decidir cada ação.'],
    ['Erros de lógica', 'Por partida: passos para uma sala que, pelas pistas até ali, já dava para <b>provar</b> ser poço ou Wumpus.'],
    ['Riscos desnecessários', 'Por partida: passos para uma sala incerta quando ainda havia sala comprovadamente segura para explorar.'],
    ['Tiros certeiros', 'Porcentagem de flechas que mataram o Wumpus.'],
])}
<p>Empates em pontos são decididos por mais vitórias e depois por menos erros de lógica. <b>Copiar ranking (Markdown)</b> copia a tabela pronta para colar num chat ou documento. <b>Exportar resultados (JSON)</b> baixa todos os números.</p>
<h2>Ranking oficial</h2>
<p>Quando o jogo é publicado com a competição oficial ativa (pelo GitHub), a Arena mostra também um <b>Ranking oficial</b>, calculado com uma semente secreta. Na versão local ou de demonstração, essa seção não aparece.</p>
<h2>Criando o seu agente</h2>
<p>Um agente é um arquivo <code>.js</code> que recebe as pistas de cada passo e devolve uma ação. O guia completo para programadores está no arquivo <code>AGENTES.md</code> do projeto.</p>
''')

# ---------------------------------------------------------------- 11
section('11', 'Fim da partida', f'''
{img('vitoria.png', 'Tela de vitória. No fim da partida o mapa inteiro é revelado.')}
<p>Ao terminar, aparece um quadro com o resultado, uma dica e a pontuação final. O mapa inteiro é revelado para você ver onde estavam os perigos.</p>
{table(['Título', 'Texto exibido'], [
    ['Vitória!', 'Pegou o ouro (+1000) e voltou vivo à entrada (+500).'],
    ['Caiu no poço', 'Cuidado com as salas onde você sente brisa.'],
    ['Devorado pelo Wumpus', 'Fedor indica que o Wumpus está em uma sala vizinha.'],
    ['Tempo esgotado', 'A partida passou de N ações sem terminar.'],
])}
<ul>
<li><b>Repetir este mapa</b>: joga de novo o mesmo mapa, com o jogador atual.</li>
<li><b>Novo mapa</b>: sorteia outro.</li>
</ul>
''')

# ---------------------------------------------------------------- 12
section('12', 'No celular', f'''
{img('celular.png', 'O jogo num celular, com o painel fechado.', 'phone')}
<ul>
<li>O mapa fica em cima e os botões numa barra logo abaixo dele.</li>
<li>O painel de configuração começa fechado. <b>⚙ Configurar</b> abre o painel na metade de baixo da tela; enquanto ele está aberto, o histórico de mensagens fica escondido.</li>
<li>A linha de atalhos de teclado não aparece em telas estreitas.</li>
<li>Tudo o que existe no computador também funciona no celular, inclusive a Arena e o treino genético (que podem ser lentos em aparelhos simples).</li>
</ul>
''')

# ---------------------------------------------------------------- 13
section('13', 'Onde ficam seus dados', f'''
{table(['O quê', 'Onde fica'], [
    ['Mapas salvos', 'No armazenamento do navegador (localStorage), neste aparelho.'],
    ['Pesos treinados do agente genético', 'Idem.'],
    ['Agentes importados', 'Idem (incluindo o código do agente).'],
])}
<ul>
<li>Nada é enviado para servidores. Outro navegador ou outro aparelho não vê seus dados.</li>
<li>Limpar os dados de navegação do site apaga tudo. Para guardar, exporte mapas e mantenha os arquivos dos agentes.</li>
<li>Em janela anônima ou com armazenamento bloqueado, o jogo funciona normalmente, mas nada fica salvo. Ao tentar salvar um mapa aparece um aviso sugerindo exportar.</li>
<li>Agentes importados rodam isolados: não têm acesso à página, ao mapa nem aos seus dados salvos.</li>
</ul>
''')

# ---------------------------------------------------------------- 14
section('14', 'Solução de problemas', table(['Problema', 'O que fazer'], [
    ['A tela do mapa fica preta', 'O navegador está sem WebGL. Atualize o navegador, ative a aceleração de hardware nas configurações ou tente outro navegador.'],
    ['As teclas não funcionam', 'Clique no mapa 3D: o foco provavelmente está num campo de texto ou lista. Feche a Arena se ela estiver aberta.'],
    ['Espaço não atira', 'Quando um agente está selecionado, Espaço serve para jogar/pausar. Troque para "Você (teclado)".'],
    ['O botão Exportar não baixa nada', 'O ambiente bloqueia downloads. Use a caixa "Copiar ou colar JSON" (mapas) ou "Copiar ranking" (Arena).'],
    ['O mapa salvo sumiu', 'Os dados do navegador foram limpos, ou você está em outro navegador/aparelho ou em janela anônima.'],
    ['Importar mapa dá erro', 'Leia a mensagem: ela diz qual campo está errado. Confira que as coordenadas começam em 1 e que nada está em (1, 1).'],
    ['O agente importado para com "Erro do agente"', 'O código do agente lançou um erro, devolveu ação inválida ou demorou mais de 3 s. Corrija o agente e importe de novo.'],
    ['A competição está lenta', 'Reduza o número de mapas ou o tamanho. Agentes importados lentos também atrasam tudo.'],
    ['O treino genético demora', 'Reduza gerações, população ou mapas por geração, ou treine num mapa menor.'],
    ['O agente fica girando no lugar', 'Ele não tem jogada possível; a partida vai acabar por tempo esgotado. Use Parar ou Novo mapa.'],
    ['Os discos de raciocínio não aparecem', 'Confira "Mostrar raciocínio do agente". Você e o agente aleatório não têm raciocínio para mostrar.'],
]))

# ---------------------------------------------------------------- 15
section('15', 'Referência rápida', f'''
<div class="quick">
<div><h3>Objetivo</h3><p>Pegar o ouro ({kbd('G')}) e voltar ao anel azul (1, 1). Voltar sem ouro não encerra.</p></div>
<div><h3>Perigos</h3><p>Poço e Wumpus vivo matam (−1000). Brisa = poço ao lado. Fedor = Wumpus ao lado.</p></div>
<div><h3>Pontos</h3><p>−1 por ação · −10 tiro · +1000 ouro · +500 vitória · −1000 morte.</p></div>
<div><h3>Você joga</h3><p>{kbd('W')} andar · {kbd('A')} {kbd('D')} girar · {kbd('Espaço')} atirar · {kbd('G')} pegar</p></div>
<div><h3>Agente joga</h3><p>{kbd('Espaço')} jogar/pausar · {kbd('N')} um passo · {kbd('T')} parar</p></div>
<div><h3>Sempre</h3><p>{kbd('V')} câmera · {kbd('M')} mapa · {kbd('T')} reiniciar · {kbd('R')} novo mapa · {kbd('C')} painel</p></div>
<div><h3>Limite de ações</h3><p>tamanho × tamanho × 20 (320 no 4 × 4).</p></div>
<div><h3>Mapas</h3><p>Salvar · Jogar · Exportar/Importar .json · trocar de jogador mantém o mapa.</p></div>
</div>
''')

toc_html = ''.join(f'<li><a href="#{sid}"><span class="tnum">{n}</span>{t}</a></li>' for n, t, sid in toc)
extra = '''
kbd { font-family: 'JetBrains Mono', monospace; font-size: 0.82em; border: 1px solid #c9bfae; border-bottom-width: 2px; border-radius: 3px; padding: 0.05em 0.4em; background: #fbf8f2; white-space: nowrap; }
.pinwrap { position: relative; }
.pin { position: absolute; width: 6mm; height: 6mm; margin: 0; border-radius: 50%; background: #e9b52e; color: #2a2218; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 9pt; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1.2px #2a2218; }
.quick { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.quick > div { border: 1px solid #e4dccd; border-radius: 4px; padding: 3mm 4mm; break-inside: avoid; }
.quick h3 { margin: 0 0 1.5mm; font-size: 10pt; color: #a8740c; }
.quick p { margin: 0; font-size: 9.8pt; }
code, pre { font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0; }
figure.shot.narrow, figure.shot.phone { float: right; width: 58mm; margin: 0 0 3mm 6mm; }
figure.shot.phone { width: 50mm; }
figure.shot.wide { width: 86%; margin-left: auto; margin-right: auto; }
h2 { clear: both; }
table.genome td, table.genome th { text-align: center; }
table.compact td { padding: 1.1mm 2mm; font-size: 8.9pt; line-height: 1.35; }
'''
doc = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Wumpus 3D — Manual de uso</title>
<style>{css}{extra}</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">Manual de uso</div>
    <h1>Wumpus 3D</h1>
    <p class="sub">Como jogar, o que cada configuração faz e o que acontece em cada situação do jogo.</p>
    <div class="grid">
      <i></i><i class="p"></i><i></i><i class="w"></i>
      <i></i><i></i><i class="g"></i><i></i>
      <i></i><i class="p"></i><i></i><i></i>
      <i class="e"></i><i></i><i></i><i class="p"></i>
    </div>
  </div>
  <div class="meta">
    <span>Versão do jogo</span><b>{COMMIT}</b>
    <span>Data</span><b>{DATE}</b>
    <span>Para quem</span><b>Jogadores, professores e quem vai testar agentes</b>
  </div>
</div>
<nav class="toc"><h1>Sumário</h1><ol>{toc_html}</ol></nav>
{''.join(sections)}
</body></html>'''
OUT.write_text(doc)
print('ok')
