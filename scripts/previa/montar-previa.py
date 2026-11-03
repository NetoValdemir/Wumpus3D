# Monta a prévia do modo escola para publicar como Artifact no claude.ai (atualizada em 3/11/2026, D23).
# A página principal do Artifact é a tela inicial (escola.html) e recebe só o conteúdo do <body> (o claude.ai
# acrescenta o resto). escola.html, aluno.html e professor.html vão também como páginas completas em "files",
# para o login levar de uma à outra. Lá downloads e impressão são bloqueados: as páginas levam um aviso e
# escondem o link do jogo 3D, que não está na prévia.
#   npm run build
#   python3 scripts/previa/montar-previa.py /pasta/de/saida
# Imprime o mapa "files" (caminho publicado → arquivo) para a ferramenta Artifact; publique
# /pasta/de/saida/caverna-do-pensamento.html com esse mapa. Para atualizar a prévia existente, use a mesma URL
# (registrada em docs/contexto/HISTORICO.md).
import json, pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
out = pathlib.Path(sys.argv[1]).resolve()
if not (DIST / 'escola.html').exists():
    sys.exit('Rode "npm run build" antes.')
shutil.rmtree(out, ignore_errors=True)
(out / 'assets').mkdir(parents=True)
(out / 'blockly-media').mkdir()

AVISO = ('<div class="previa-aviso" role="note"><b>Prévia de teste (branch educacional).</b> Aqui o claude.ai bloqueia '
         'downloads e impressão: para enviar o registro, use "Mostrar o registro como texto"; no relatório da turma, '
         'veja o resultado na própria tela. Logins e turmas ficam só neste navegador. O jogo 3D não está nesta prévia.</div>')
STYLE = """<style>
.previa-aviso { background: #3a2a10; color: #f4ecdf; border-bottom: 1px solid #8a6a2a; font: 14px/1.45 system-ui, sans-serif; padding: 8px max(16px, env(safe-area-inset-left, 0px)); }
.to3d { display: none; }
</style>"""

files = {}


def page_parts(name):
    src = (DIST / name).read_text()
    head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
    body_tag, body = re.search(r'(<body[^>]*>)(.*)</body>', src, re.S).groups()
    tags = [l.strip() for l in head.splitlines() if '<script' in l or 'stylesheet' in l or 'modulepreload' in l]
    for ref in re.findall(r'(?:src|href)="\./(assets/[^"]+)"', '\n'.join(tags)):
        if ref not in files:
            shutil.copy(DIST / ref, out / ref)
            files[ref] = str(out / ref)
    return src, head, body_tag, body, tags


for f in sorted((DIST / 'blockly-media').iterdir()):
    if f.suffix in ('.svg', '.gif', '.png'):  # sem .cur (tipo não aceito) e sem o LEIA-ME
        shutil.copy(f, out / 'blockly-media' / f.name)
        files[f'blockly-media/{f.name}'] = str(out / 'blockly-media' / f.name)

# Páginas completas (navegação entre elas)
for name in ('escola.html', 'aluno.html', 'professor.html'):
    src, head, body_tag, body, tags = page_parts(name)
    full = src.replace('</head>', STYLE + '\n</head>', 1).replace(body_tag, body_tag + AVISO, 1)
    (out / name).write_text(full)
    files[name] = str(out / name)

# Página principal do Artifact: a tela inicial, só o <body>
src, head, body_tag, body, tags = page_parts('escola.html')
cls = re.search(r'class="([^"]*)"', body_tag)
page = f'''<title>Caverna do Pensamento</title>
<script>document.body.className = '{cls.group(1) if cls else ''}';</script>
{chr(10).join(tags)}
{STYLE}
{AVISO}
{body}'''
(out / 'caverna-do-pensamento.html').write_text(page)
print(json.dumps(files, indent=1))
