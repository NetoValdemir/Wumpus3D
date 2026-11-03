# Monta a prévia do modo escola para publicar como Artifact no claude.ai (como em 3/11/2026).
# O Artifact recebe só o conteúdo do <body> (o claude.ai acrescenta o resto da página) e bloqueia downloads,
# impressão e links para outras páginas: a prévia leva um aviso e esconde o link do jogo 3D.
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

src = (DIST / 'escola.html').read_text()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body[^>]*>(.*)</body>', src, re.S).group(1)
tags = [l.strip() for l in head.splitlines() if '<script' in l or 'stylesheet' in l or 'modulepreload' in l]

files = {}
for ref in re.findall(r'(?:src|href)="\./(assets/[^"]+)"', '\n'.join(tags)):
    shutil.copy(DIST / ref, out / ref)
    files[ref] = str(out / ref)
for f in sorted((DIST / 'blockly-media').iterdir()):
    if f.suffix in ('.svg', '.gif', '.png'):  # sem .cur (tipo não aceito) e sem o LEIA-ME
        shutil.copy(f, out / 'blockly-media' / f.name)
        files[f'blockly-media/{f.name}'] = str(out / 'blockly-media' / f.name)

aviso = ('<div class="previa-aviso" role="note"><b>Prévia de teste (branch educacional).</b> Aqui o claude.ai bloqueia '
         'downloads e impressão: para enviar o registro, use "Mostrar o registro como texto"; no relatório da turma, '
         'veja o resultado na própria tela. O link do jogo 3D não está nesta prévia.</div>')
page = f'''<title>Caverna do Pensamento</title>
<script>document.body.className = 'escola';</script>
{chr(10).join(tags)}
<style>
.previa-aviso {{ background: #3a2a10; color: #f4ecdf; border-bottom: 1px solid #8a6a2a; font: 14px/1.45 system-ui, sans-serif; padding: 8px max(16px, env(safe-area-inset-left, 0px)); }}
.to3d {{ display: none; }}
</style>
{aviso}
{body}'''
(out / 'caverna-do-pensamento.html').write_text(page)
print(json.dumps(files, indent=1))
