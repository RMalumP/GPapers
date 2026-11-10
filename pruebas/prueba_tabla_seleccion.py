# Pruebas de v39.31: orden de los bloques al editar (Secciones tras Cita), poner o quitar etiquetas con un clic en la tabla,
# panel compacto de ☑ (Selección) y la portada del primer PDF como imagen de los papers sin imagen.
import sys, json, os, pathlib, subprocess, time, base64
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0; SEL.clear();
  db.sections.push({id: 'sa', name: 'Tema A', color: '#2457c5', tagIds: []}, {id: 'sb', name: 'Tema B', color: '#c52457', tagIds: []});
  db.tags.push({id: 't1', name: 'Clave', color: '#24a557'}, {id: 't2', name: 'Revisar', color: '#a57a24'}, {id: 't3', name: 'Citar', color: '#7a24a5'});
  const P = (id, t, secs, tags) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: tags, notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'A uno', ['sa'], ['t1']), P('p2', 'B dos', ['sa'], []), P('p3', 'C tres', ['sb'], ['t1', 't2']));
  F.group = false; F.sorts = [{k: 'title', d: 1}]; setView('table'); render(); }"""
port = 8793
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(port), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
  with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    c = b.new_context(viewport={'width': 1300, 'height': 900}, service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto(f'http://localhost:{port}/index.html'); pg.wait_for_timeout(1200); pg.evaluate(SEED); pg.wait_for_timeout(100)
    # ---------- editar: Secciones va justo después de Cita y antes de Etiquetas
    pg.evaluate("openPaper('p1')"); pg.wait_for_timeout(150); pg.evaluate("tab = 'all'; drawD()"); pg.wait_for_timeout(100)
    eq('«Ver todo»: … Cita, Secciones, Etiquetas, Relacionados', pg.evaluate("[...document.querySelectorAll('#dlg details.cs:not(.cgrp)>summary')].map(s => s.textContent)")[-4:], ['Cita', 'Secciones', 'Etiquetas', 'Relacionados'])
    pg.evaluate("tab = 'cls'; drawD()"); pg.wait_for_timeout(100)
    eq('pestaña de clasificación: Secciones, Etiquetas, Relacionados', pg.evaluate("[...document.querySelectorAll('#dlg details.cs>summary')].map(s => s.textContent)"), ['Secciones', 'Etiquetas', 'Relacionados'])
    pg.evaluate("$('#dlg').close()"); pg.wait_for_timeout(100)
    # ---------- tabla: clic en la celda de etiquetas
    pg.click('.tbl tr.rw[data-id=p2] td.c-tags'); pg.wait_for_timeout(100)
    eq('clic en el hueco de etiquetas abre el menú con todas', pg.evaluate("[!$('#ctx').hidden, $('#ctx').classList.contains('tpk'), [...document.querySelectorAll('#ctx .tpkc .chip')].map(c => c.textContent + (c.classList.contains('on') ? '✓' : ''))]"), [True, True, ['Clave', 'Revisar', 'Citar']])
    pg.click('#ctx .tpkc .chip:has-text("Revisar")'); pg.click('#ctx .tpkc .chip:has-text("Citar")'); pg.wait_for_timeout(100)
    eq('un clic pone cada etiqueta y el menú sigue abierto', [pg.evaluate("db.papers.find(p => p.id === 'p2').tagIds"), pg.evaluate("!$('#ctx').hidden"), pg.evaluate("[...document.querySelectorAll('#ctx .tpkc .chip.on')].map(c => c.textContent)")], [['t2', 't3'], True, ['Revisar', 'Citar']])
    eq('la fila ya las muestra', pg.evaluate("[...document.querySelectorAll('.tbl tr.rw[data-id=p2] td.c-tags .chip')].map(c => c.textContent)"), ['Revisar', 'Citar'])
    pg.click('#ctx .tpkc .chip:has-text("Revisar")'); pg.wait_for_timeout(100)
    eq('otro clic la quita', pg.evaluate("db.papers.find(p => p.id === 'p2').tagIds"), ['t3'])
    pg.mouse.click(1250, 880); pg.wait_for_timeout(80)
    eq('clic fuera lo cierra', pg.evaluate("$('#ctx').hidden"), True)
    pg.click('.tbl tr.rw[data-id=p3] td.c-tags .chip >> nth=0', button='right'); pg.wait_for_timeout(80)
    eq('clic derecho en una etiqueta sigue abriendo su menú', pg.evaluate("$('#ctx .ctxh').textContent"), 'Etiqueta «Clave»'); pg.evaluate("ctxClose()")
    pg.evaluate("undo()"); pg.wait_for_timeout(100)
    eq('se deshace con Ctrl+Z', pg.evaluate("db.papers.find(p => p.id === 'p2').tagIds"), [])
    # ---------- panel de ☑ compacto
    pg.click('#selAll', button='right'); pg.wait_for_timeout(100)
    eq('sin elegidos: solo las dos formas de elegir', pg.evaluate("[...document.querySelectorAll('#ctx button')].map(b => b.textContent)"), ['☑ Los que se ven (3)', '☑ Todo el proyecto (3)'])
    pg.click('#ctx button:has-text("los que se ven")'); pg.wait_for_timeout(150)
    eq('elegir deja el panel abierto, ya con todo lo de Selección', [pg.evaluate("!$('#ctx').hidden"), pg.evaluate("SEL.size"), pg.evaluate("[...document.querySelectorAll('#ctx .sml')].map(x => x.firstChild.textContent.trim())")], [True, 3, ['📖 Lectura', '⭐ Valoración', '🏷️ Etiqueta', '📁 Sección']])
    eq('etiquetas: llena si la tienen todos, a rayas si solo algunos', pg.evaluate("[...document.querySelectorAll('#ctx .smc')][0].innerHTML.match(/chip[^\"]*/g).map(x => x.trim())"), ['chip part', 'chip part', 'chip'])
    pg.click('#ctx .seg button:has-text("Leído")'); pg.wait_for_timeout(150)
    eq('lectura al momento y el panel sigue abierto', [pg.evaluate("db.papers.map(p => p.reading)"), pg.evaluate("!$('#ctx').hidden"), pg.evaluate("$('#ctx .seg button.on').textContent")], [['leido'] * 3, True, 'Leído'])
    pg.click('#ctx .stars button >> nth=3'); pg.wait_for_timeout(150)
    eq('valoración con las estrellas', [pg.evaluate("db.papers.map(p => p.rating)"), pg.evaluate("document.querySelectorAll('#ctx .stars button.on').length")], [[4] * 3, 4])
    pg.click('#ctx .smc >> nth=0 >> .chip:has-text("Clave")'); pg.wait_for_timeout(150)
    eq('etiqueta que solo tenían algunos: se pone a todos', [pg.evaluate("db.papers.every(p => p.tagIds.includes('t1'))"), pg.evaluate("[...document.querySelectorAll('#ctx .smc')][0].querySelector('.chip').className")], [True, 'chip on'])
    pg.click('#ctx .smc >> nth=0 >> .chip:has-text("Clave")'); pg.wait_for_timeout(150)
    eq('y si ya la tenían todos, se quita', pg.evaluate("db.papers.some(p => p.tagIds.includes('t1'))"), False)
    pg.click('#ctx .smc >> nth=1 >> .chip:has-text("Tema B")'); pg.wait_for_timeout(150)
    eq('secciones igual', pg.evaluate("db.papers.every(p => p.sectionIds.includes('sb'))"), True)
    pg.screenshot(path=str(folder / 'pruebas' / '_panel_seleccion.png'), clip={'x': 0, 'y': 0, 'width': 1300, 'height': 700}) if os.environ.get('SHOT') else None
    pg.click('#ctx button:has-text("Quitar selección")'); pg.wait_for_timeout(150)
    eq('«Quitar la selección» vacía y deja las dos formas de elegir', [pg.evaluate("SEL.size"), pg.evaluate("document.querySelectorAll('#ctx button').length")], [0, 2])
    pg.evaluate("ctxClose()")
    # ---------- portada del PDF
    pdf = base64.b64encode((folder / 'pruebas' / 'prueba.pdf').read_bytes()).decode()
    pg.evaluate(f"""async () => {{ const b = Uint8Array.from(atob('{pdf}'), c => c.charCodeAt(0)); const p = db.papers.find(x => x.id === 'p1'); p.pdf = {{name: 'prueba.pdf'}};
      await idb('readwrite', st => st.put(new Blob([b], {{type: 'application/pdf'}}), 'pdfb:p1')); setView('cards'); render(); }}""")
    for _ in range(60):
        if pg.evaluate("!!document.querySelector('#list .card[data-id=p1] .pimg.pcov img')"): break
        pg.wait_for_timeout(250)
    eq('sin imagen y con PDF: la tarjeta muestra la portada', pg.evaluate("[!!$('#list .card[data-id=p1] .pimg.pcov img').src.startsWith('data:image/jpeg'), !$('#list .card[data-id=p2] .pimg')]"), [True, True])
    eq('la portada queda guardada con el nombre del PDF', pg.evaluate("idb('readonly', st => st.get('pdft:p1')).then(t => [t.n, t.d.slice(0, 15)])"), ['prueba.pdf', 'data:image/jpeg'])
    pg.evaluate("setView('table')"); pg.wait_for_timeout(200)
    eq('en la tabla también, sin parpadeo (se pinta ya puesta)', pg.evaluate("[!$('.tbl').classList.contains('noimg'), !!$('.tbl tr.rw[data-id=p1] .pimg.pcov img'), !$('.tbl tr.rw[data-id=p1] .pimg[data-cov]')]"), [True, True, True])
    pg.evaluate("db.papers.find(x => x.id === 'p1').image = {kind: 'url', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}; render()"); pg.wait_for_timeout(100)
    eq('con imagen propia, manda la imagen', pg.evaluate("[!!$('.tbl tr.rw[data-id=p1] .pimg:not(.pcov)'), !$('.tbl tr.rw[data-id=p1] .pcov')]"), [True, True])
    pg.evaluate("db.settings.showImg = false; render()"); pg.wait_for_timeout(100)
    eq('«Mostrar la imagen» desactivado: tampoco portada', pg.evaluate("document.querySelectorAll('.tbl .pimg').length"), 0)
    eq('sin errores', errs, [])
    b.close()
finally:
    srv.terminate()
print(f'{n - fail}/{n} pruebas de tabla y selección OK')
sys.exit(1 if fail else 0)
