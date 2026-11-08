# Pruebas del visor de PDF (v39, Chromium): abrir, subrayar con colores, comentar, notas, zonas, buscar, zoom, panel, deshacer,
# fusión de anotaciones entre dispositivos, el PDF anotado (anotaciones estándar que leen Acrobat y Foxit), la bandeja «PDF por citar»,
# la copia en el Drive normal y el móvil. Usa pruebas/prueba.pdf (3 páginas, DOI en la primera y un resaltado «de Acrobat» en la segunda).
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
sys.path.insert(0, str(folder / 'pruebas'))
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
SEL = """(txt, page = 0) => { const sp = [...document.querySelectorAll(`#vw .vwp[data-i="${page}"] .textLayer span`)].find(s => s.textContent.includes(txt)); const r = document.createRange(); r.selectNodeContents(sp); getSelection().removeAllRanges(); getSelection().addRange(r); return sp.textContent; }"""
PORT = 8796
from drive_falso import STORE, GOOGLE, drive, names
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False, google=False):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        if google: c.add_init_script(GOOGLE); c.route('https://www.googleapis.com/**', drive)
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; window.TSEL = {SEL}; 0"); return c, p
    def seed(p, pid='p1'):
        p.evaluate(f"(async () => {{ db.papers.length = 0; db.papers.push(P('{pid}', 'Paper con PDF', {{pdf: {{name: 'prueba.pdf'}}}})); PDF_FILES.set('{pid}', await {FILE}); markDirty(); render(); }})()")
    cA, A = device()
    seed(A)
    eq('la tarjeta tiene el botón 📄 sin contador', A.evaluate("[!!document.querySelector('.card[data-id=p1] button[data-onclick*=pdfOpen]'), !!document.querySelector('.card[data-id=p1] .annc')]"), [True, False])
    eq('PDF.js no se carga al arrancar', A.evaluate("PDFJS === null && !document.querySelector('script[src*=pdf-lib]')"), True)
    A.click('.card[data-id=p1] button[data-onclick*=pdfOpen]'); A.wait_for_timeout(1800)
    eq('se abre dentro de la app, a pantalla completa', A.evaluate("[$('#vw').open, Math.round($('#vw').getBoundingClientRect().width) === innerWidth, VW.pages.length, $('#vwPn').textContent]"), [True, True, 3, '/ 3'])
    eq('se pintan las páginas que se ven, con su capa de texto', A.evaluate("[document.querySelectorAll('#vw .vwcv').length >= 1, document.querySelectorAll('#vw .vwp[data-i=\"0\"] .textLayer span').length > 10]"), [True, True])
    eq('ajustado al ancho', A.evaluate("Math.abs(VW.pages[0].el.getBoundingClientRect().width - ($('#vwScroll').clientWidth - 24)) < 2"), True)
    eq('el título es el del paper', A.inner_text('#vw .vwt'), 'Paper con PDF')
    # ---- subrayar seleccionando
    A.evaluate("TSEL('linea 3:')"); A.wait_for_timeout(400)
    eq('al seleccionar sale la barra de colores', A.evaluate("!$('#vwSel').hidden"), True)
    A.click('#vwSel .vwc[data-c="1"]'); A.wait_for_timeout(300)
    a = A.evaluate("db.papers[0].pdf.ann")
    eq('un clic en un color subraya: verde, página 1, con su texto y un rectángulo', (len(a), a[0]['k'], a[0]['p'], a[0]['c'], a[0]['t'], len(a[0]['q'])), (1, 'hl', 0, '#5fd068', 'Pagina 1, linea 3: el subrayado con colores ayuda a leer mejor los papers.', 4))
    eq('el rectángulo cae sobre la línea en el espacio del PDF', [round(v) for v in a[0]['q']], [60, 636, 454, 649])
    eq('se pinta encima del texto', A.evaluate("document.querySelectorAll('#vw .vwhl').length"), 1)
    eq('la selección y la barra desaparecen', A.evaluate("[getSelection().isCollapsed, $('#vwSel').hidden]"), [True, True])
    # ---- comentario
    hl = A.evaluate("document.querySelector('#vw .vwhl').getBoundingClientRect().toJSON()"); A.mouse.click(hl['x'] + 30, hl['y'] + hl['height'] / 2); A.wait_for_timeout(300)
    eq('tocar el subrayado abre su ventanita', A.evaluate("[!$('#vwPop').hidden, $('#vwPop .vwq').textContent.includes('linea 3')]"), [True, True])
    A.fill('#vwCm', 'Idea clave'); A.wait_for_timeout(900)
    eq('el comentario se guarda solo', A.evaluate("db.papers[0].pdf.ann[0].m"), 'Idea clave')
    A.click('#vwPop .vwc[style*="#ff6b6b"]'); A.wait_for_timeout(200)
    eq('cambiar el color', A.evaluate("db.papers[0].pdf.ann[0].c"), '#ff6b6b')
    A.keyboard.press('Escape'); A.wait_for_timeout(200)
    eq('Esc cierra la ventanita, no el visor', A.evaluate("[$('#vwPop').hidden, $('#vw').open]"), [True, True])
    # ---- subrayar con «Subrayar» arrastrando el ratón
    A.click('#vw .vwm[data-m=hl]'); A.click('#vw .vwtb .vwc[data-c="2"]')
    s = A.evaluate("(() => { const sp = [...document.querySelectorAll('#vw .vwp[data-i=\"0\"] .textLayer span')].find(s => s.textContent.includes('linea 5:')); return sp.getBoundingClientRect().toJSON(); })()")
    A.mouse.move(s['x'] + 2, s['y'] + s['height'] / 2); A.mouse.down(); A.mouse.move(s['x'] + 150, s['y'] + s['height'] / 2, steps=6); A.mouse.up(); A.wait_for_timeout(300)
    a = A.evaluate("db.papers[0].pdf.ann")
    eq('arrastrar en «Subrayar» subraya lo recorrido, en azul', (len(a), a[1]['c'], a[1]['t'].startswith('Pagina 1, linea 5'), len(a[1]['t']) < 40), (2, '#4dabf7', True, True))
    # ---- zona y nota
    A.click('#vw .vwm[data-m=area]'); pr = A.evaluate("VW.pages[0].el.getBoundingClientRect().toJSON()")
    A.mouse.move(pr['x'] + 100, pr['y'] + 500); A.mouse.down(); A.mouse.move(pr['x'] + 300, pr['y'] + 600, steps=4); A.mouse.up(); A.wait_for_timeout(300)
    eq('«Zona» marca un recuadro', A.evaluate("db.papers[0].pdf.ann.filter(a => a.k === 'area').length"), 1)
    A.click('#vw .vwm[data-m=note]'); A.mouse.click(pr['x'] + 500, pr['y'] + 100); A.wait_for_timeout(300)
    eq('«Nota» deja una nota y abre su texto', A.evaluate("[db.papers[0].pdf.ann.filter(a => a.k === 'note').length, document.activeElement.id]"), [1, 'vwCm'])
    A.fill('#vwCm', 'Revisar esta tabla'); A.keyboard.press('Escape'); A.wait_for_timeout(200)
    eq('la nota guarda su texto al cerrar', A.evaluate("db.papers[0].pdf.ann.find(a => a.k === 'note').m"), 'Revisar esta tabla')
    eq('la nota se ve como icono', A.evaluate("document.querySelectorAll('#vw .vwnote').length"), 1)
    A.click('#vw .vwm[data-m=sel]')
    # ---- panel
    A.evaluate("vwSide(true)"); A.wait_for_timeout(200)
    eq('el panel lista las 4 por página y orden', A.evaluate("[...document.querySelectorAll('#vwSide .vwsl .vwi small')].map(e => e.textContent)"), ['p. 1 · 🗒 Nota', 'p. 1 · 🖍', 'p. 1 · 🖍', 'p. 1 · ▭ Zona'])
    A.click('#vwSide .vwsf button[title="Solo las que tienen comentario"]')
    eq('filtro «con comentario»', A.evaluate("document.querySelectorAll('#vwSide .vwsl .vwi').length"), 2)
    A.click('#vwSide .vwsf button:has-text("Todas")')
    A.wait_for_timeout(1200)
    eq('lista también la anotación que ya traía el PDF (de Acrobat)', A.evaluate("[VW.foreign.length, VW.foreign[0].p, VW.foreign[0].m, VW.foreign[0].who, $('#vwSide .vwfr summary').textContent]"), [1, 1, 'Comentario de Acrobat', 'Ana', '1 anotación que ya traía el PDF'])
    eq('el botón del panel cuenta las anotaciones', A.inner_text('#vwAn'), '4')
    # ---- deshacer
    A.evaluate("VW.pop = null; vwDel(db.papers[0].pdf.ann[1].id)"); A.wait_for_timeout(200)
    eq('borrar una', A.evaluate("db.papers[0].pdf.ann.length"), 3)
    A.keyboard.press('Control+z'); A.wait_for_timeout(300)
    eq('Ctrl+Z dentro del visor la recupera (y se repinta)', A.evaluate("[db.papers[0].pdf.ann.length, document.querySelectorAll('#vw .vwhl').length]"), [4, 3])
    # ---- buscar y zoom
    A.keyboard.press('Control+f'); A.fill('#vwQ', 'linea 7:'); A.keyboard.press('Enter'); A.wait_for_timeout(800)
    eq('buscar: cuenta los resultados y los marca', A.evaluate("[$('#vwQn').textContent, document.querySelectorAll('#vw .vwfh').length > 0]"), ['1 de 3', True])
    A.keyboard.press('Enter'); A.wait_for_timeout(600)
    eq('Enter pasa al siguiente (página 2)', A.evaluate("[$('#vwQn').textContent, VW.cur]"), ['2 de 3', 1])
    A.keyboard.press('Escape'); A.wait_for_timeout(100)
    s0 = A.evaluate("VW.scale"); A.evaluate("vwZoomBy(1.5)"); A.wait_for_timeout(1500)
    eq('acercar cambia la escala y vuelve a pintar a esa escala', A.evaluate(f"[Math.abs(VW.scale / {s0} - 1.5) < .01, VW.pages.filter(p => p.cv && p.vis).every(p => Math.abs(p.rs - VW.scale) < .01)]"), [True, True])
    eq('los subrayados siguen sobre su línea al acercar', A.evaluate("(() => { const h = document.querySelector('#vw .vwhl').getBoundingClientRect(), p = VW.pages[0].el.getBoundingClientRect(); return Math.round((h.left - p.left) / VW.scale); })()"), 60)
    A.evaluate("vwFitW()"); A.evaluate("vwGo(2)"); A.wait_for_timeout(500)
    eq('ir a la página 3', A.evaluate("[VW.cur, $('#vwPg').value]"), [2, '3'])
    # ---- a las notas del paper
    A.evaluate("vwPopOpen(db.papers[0].pdf.ann.find(a => a.k === 'hl').id)"); A.click('#vwPop button:has-text("A las notas")'); A.wait_for_timeout(200)
    eq('«A las notas» añade el texto con la página', A.evaluate("db.papers[0].notes.map(n => n.content)"), ['«Pagina 1, linea 3: el subrayado con colores ayuda a leer mejor los papers.» (p. 1)\n\nIdea clave'])
    # ---- cerrar
    A.keyboard.press('Escape'); A.wait_for_timeout(100); A.keyboard.press('Escape'); A.wait_for_timeout(500)
    eq('Esc cierra el visor y recuerda la página', A.evaluate("[$('#vw').open, db.papers[0].pdf.page]"), [False, 3])
    eq('la tarjeta muestra cuántas anotaciones tiene', A.evaluate("document.querySelector('.card[data-id=p1] .annc').textContent"), '4')
    eq('buscar con «Incluir notas» encuentra los comentarios', A.evaluate("F.inNotes = true; qSet('revisar esta tabla'); const r = visible().map(p => p.id); F.inNotes = false; qSet(''); r"), ['p1'])
    eq('el JSON lleva las anotaciones (y no los archivos)', A.evaluate("JSON.parse(dbJSON()).papers[0].pdf.ann.map(a => a.k).sort()"), ['area', 'hl', 'hl', 'note'])
    eq('normalizar dos veces da lo mismo (no hay subidas en bucle)', A.evaluate("(() => { const x = syNorm(JSON.parse(dbJSON())); return syS(syNorm(x)) === syS(x); })()"), True)
    eq('anotaciones mal formadas se descartan', A.evaluate("annClean([{id: 'a', k: 'hl', p: 0, q: [1, 2, 3]}, {id: 'b', k: 'x', p: 0, q: [1, 2, 3, 4]}, {id: 'c', k: 'note', p: 1, q: [1, 2, 1, 2], c: 'rojo'}]).map(a => [a.id, a.c])"), [['c', '#ffd400']])
    # ---- fusión entre dispositivos
    M = lambda js: A.evaluate("(() => { " + js + " })()")
    M("window.AN = (id, o = {}) => ({id, k: 'hl', p: 0, q: [1, 2, 3, 4], c: '#ffd400', at: '2026-01-01', up: '2026-01-01', ...o}); window.LIB = papers => syNorm({version: 1, sections: [], tags: [], papers, trash: [], inbox: [], settings: defSettings()}); return 1")
    eq('anotaciones nuevas en los dos dispositivos: se juntan', M("const B = LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1')]}})]); return syMerge(LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1'), AN('2')]}})]), LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1'), AN('3')]}})]), B).papers[0].pdf.ann.map(a => a.id)"), ['1', '2', '3'])
    eq('comentada aquí y recoloreada allí: se juntan los dos cambios', M("const B = LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1')]}})]); const r = syMerge(LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1', {m: 'hola', up: '2026-02-01'})]}})]), LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1', {c: '#ff6b6b', up: '2026-03-01'})]}})]), B).papers[0].pdf.ann[0]; return [r.m, r.c]"), ['hola', '#ff6b6b'])
    eq('borrada en un lado sin cambios en el otro: se borra', M("const B = LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1'), AN('2')]}})]); return syMerge(LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1')]}})]), B, B).papers[0].pdf.ann.map(a => a.id)"), ['1'])
    eq('el cambio que sube a Drive lleva solo esa anotación', M("const a = LIB([P('x', 'X', {pdf: {name: 'a.pdf', ann: [AN('1'), AN('2')]}})]), b = structuredClone(a); b.papers[0].pdf.ann[1].m = 'nuevo'; return JSON.stringify(syDiff(a, b)).includes('\"l\":{\"2\"')"), True)
    # ---- el PDF anotado: anotaciones estándar (Acrobat, Foxit)
    out = A.evaluate(f"""(async () => {{ const f = await {FILE}, bytes = await vwPdfOut(f, db.papers[0].pdf.ann), L = await vwLib(), d = await L.getDocument({{data: bytes.slice()}}).promise, r = [];
      for (let i = 1; i <= d.numPages; i++) for (const a of await (await d.getPage(i)).getAnnotations()) r.push([i, a.subtype, a.contentsObj?.str || '', a.titleObj?.str || '', a.color ? [...a.color].join(',') : '', !!a.hasAppearance, a.quadPoints ? a.quadPoints.length : 0]);
      const again = await vwPdfOut(new File([bytes], 'x.pdf'), db.papers[0].pdf.ann.slice(0, 1)), d2 = await L.getDocument({{data: again}}).promise, n2 = [];
      for (let i = 1; i <= d2.numPages; i++) n2.push((await (await d2.getPage(i)).getAnnotations()).map(a => a.subtype).join('+'));
      return {{r, n2}}; }})()""")
    eq('PDF anotado: resaltados con su color, comentario, autor y aspecto; nota adhesiva; ventana del comentario', sorted(map(tuple, out['r'])), sorted([
        (1, 'Highlight', '', 'GPapers', '77,171,247', True, 8), (1, 'Highlight', '', 'GPapers', '77,171,247', True, 8), (1, 'Highlight', 'Idea clave', 'GPapers', '255,107,107', True, 8),
        (1, 'Popup', 'Idea clave', 'GPapers', '255,107,107', False, 0), (1, 'Popup', 'Revisar esta tabla', 'GPapers', '77,171,247', False, 0), (1, 'Text', 'Revisar esta tabla', 'GPapers', '77,171,247', True, 0),
        (2, 'Highlight', 'Comentario de Acrobat', 'Ana', '0,255,0', False, 8)]))
    eq('volver a escribirlo cambia solo las de GPapers y respeta las que traía', out['n2'], ['Highlight+Popup', 'Highlight', ''])
    # ---- reabrir: página recordada, «Hacerlas editables» y sin duplicados
    A.evaluate("pdfOpen('p1')"); A.wait_for_timeout(1800)
    eq('vuelve a abrir en la página donde lo dejaste', A.evaluate("[VW.cur, $('#vwPg').value]"), [2, '3'])
    A.wait_for_timeout(800); A.evaluate("vwImport()"); A.wait_for_timeout(300)
    eq('«Hacerlas editables» copia la de Acrobat como propia (color más parecido) y deja de pintarse dos veces', A.evaluate("(() => { const a = db.papers[0].pdf.ann.find(x => x.src); return [a.p, a.c, a.m, VW.foreign[0].dup, VW.doc.annotationStorage.getValue(VW.foreign[0].id, {}).noView]; })()"), [1, '#5fd068', 'Comentario de Acrobat', True, True])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    # ---- desde la ficha del paper: lo que se anota va también al borrador
    A.evaluate("openPaper('p1'); tab = 'data'; drawD()"); A.click('#dlg .pdfrow button:has-text("Abrir")'); A.wait_for_timeout(1500)
    eq('desde la ficha el visor queda encima', A.evaluate("[$('#vw').open, [...document.querySelectorAll('dialog[open]')].pop().id]"), [True, 'vw'])
    A.evaluate("vwGo(0)"); A.wait_for_timeout(500); A.evaluate("TSEL('linea 9:')"); A.wait_for_timeout(300); A.evaluate("vwSelColor(0)"); A.wait_for_timeout(200)
    A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("commit()"); A.wait_for_timeout(200)
    eq('al guardar la ficha no se pierde lo anotado', A.evaluate("db.papers[0].pdf.ann.some(a => (a.t || '').includes('linea 9'))"), True)
    # ---- bandeja «PDF por citar»
    A.route('https://api.crossref.org/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps({'message': {'type': 'journal-article', 'title': ['Un estudio de prueba sobre visores de PDF'], 'author': [{'family': 'Gómez', 'given': 'Ana'}], 'issued': {'date-parts': [[2026]]}, 'container-title': ['Revista de Pruebas']}})))
    eq('sin PDF en la bandeja no se ve la sección', A.evaluate("$('#inbox').hidden"), True)
    A.evaluate(f"(async () => inboxAdd([{{file: await {FILE}}}]))()"); A.wait_for_timeout(2500)
    eq('añadir un PDF: sale arriba de la lista con su nombre', A.evaluate("[$('#inbox').hidden, $('#inbox .ibname').textContent, $('#inbox .ibn').textContent]"), [False, 'prueba.pdf', '1'])
    eq('lee el DOI y el título de la primera página, y hace la miniatura', A.evaluate("[db.inbox[0].doi, db.inbox[0].guess, !!$('#inbox .ibt img')]"), ['10.1234/gpapers.2026.001', 'Un estudio de prueba sobre visores de PDF', True])
    A.evaluate("inboxOpen(db.inbox[0].id)"); A.wait_for_timeout(1500); A.evaluate("TSEL('linea 1:')"); A.wait_for_timeout(300); A.evaluate("vwSelColor(3)"); A.wait_for_timeout(200)
    eq('un PDF de la bandeja también se anota', A.evaluate("[VW.src.kind, db.inbox[0].ann.length, db.inbox[0].ann[0].c]"), ['inbox', 1, '#ff6b6b'])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    A.evaluate(f"(async () => inboxAdd([{{file: new File([await (await {FILE}).arrayBuffer()], 'otro.pdf', {{type: 'application/pdf'}})}}]))()"); A.wait_for_timeout(2000)
    eq('con dos: «1 de 2» y se pasa con ›', (A.inner_text('#inbox .ibnav span'), A.evaluate("inboxGo(1); $('#inbox .ibname').textContent")), ('2 de 2', 'prueba.pdf'))
    A.click('#inbox button:has-text("Crear cita")'); A.wait_for_timeout(800)
    np = A.evaluate("(() => { const p = db.papers.find(p => p.doi === '10.1234/gpapers.2026.001'); return p && [p.title, p.authors, p.year, p.venue, p.pdf.name, p.pdf.ann.length, p.pdf.from.startsWith('in-'), $('#dlg').open, db.inbox.length]; })()")
    eq('«Crear cita» usa CrossRef por el DOI, se lleva el PDF con sus anotaciones y abre la ficha', np, ['Un estudio de prueba sobre visores de PDF', ['Gómez, Ana'], 2026, 'Revista de Pruebas', 'prueba.pdf', 1, True, True, 1])
    A.evaluate("$('#dlg').close()")
    nid = A.evaluate("db.papers.find(p => p.doi === '10.1234/gpapers.2026.001').id")
    A.evaluate(f"pdfOpen('{nid}')"); A.wait_for_timeout(1500)
    eq('el paper nuevo abre el mismo archivo (sin pedirlo)', A.evaluate("[VW.open, VW.pages.length, VW.src.id]"), [True, 3, nid]); A.evaluate("vwClose()"); A.wait_for_timeout(200)
    A.evaluate("inboxAssign(db.inbox[0].id)"); A.wait_for_timeout(200)
    A.click('#ibpL button:has-text("Paper con PDF")'); A.wait_for_timeout(300)
    eq('«Asignar a un paper» lo pone como PDF 2 si ya tiene uno, y vacía la bandeja', A.evaluate("[db.papers[0].pdf2 && db.papers[0].pdf2.name, db.inbox.length, $('#inbox').hidden]"), ['otro.pdf', 0, True])
    A.evaluate("openCfg(); cfgTab('da')")
    eq('Configuración: copia en el Drive normal y la sección de la bandeja', ('Guardar también los PDF en mi Drive normal' in A.inner_text('#cfg'), 'Mostrar la sección «PDF por citar»' in A.inner_text('#cfg')), (True, True))
    A.evaluate("$('#cfg').close()")
    # ---- desde file:// se abre el visor del navegador, como antes
    cF = b.new_context(service_workers='block'); F = cF.new_page(); F.goto('file://' + str(folder / 'index.html')); F.wait_for_timeout(500)
    eq('desde file:// no se usa el visor propio', F.evaluate("vwCan()"), False); cF.close()
    # ---- móvil
    cM, M2 = device(mobile=True)
    seed(M2); M2.evaluate("pdfOpen('p1')"); M2.wait_for_timeout(2000)
    eq('móvil: herramientas abajo, sin scroll horizontal de la ventana', M2.evaluate("[$('#vw .vwtb').getBoundingClientRect().bottom >= innerHeight - 2, $('#vw').scrollWidth <= innerWidth, $('#vw .vwtb').scrollWidth <= $('#vw .vwtb').clientWidth + 1]"), [True, True, True])
    eq('móvil: la página ocupa el ancho', M2.evaluate("VW.pages[0].el.getBoundingClientRect().width > innerWidth * .9"), True)
    M2.evaluate("TSEL('linea 2:')"); M2.wait_for_timeout(400); M2.evaluate("vwSelColor(4)"); M2.wait_for_timeout(200)
    M2.evaluate("vwPopOpen(db.papers[0].pdf.ann[0].id)"); M2.wait_for_timeout(200)
    eq('móvil: la ventanita es una hoja abajo', M2.evaluate("(() => { const r = $('#vwPop').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right) === innerWidth, Math.abs(r.bottom - innerHeight) < 2]; })()"), [0, True, True])
    M2.evaluate("vwPopClose()")
    s0 = M2.evaluate("VW.scale"); pr = M2.evaluate("$('#vwScroll').getBoundingClientRect().toJSON()")
    cdp = cM.new_cdp_session(M2); cx, cy = pr['x'] + pr['width'] / 2, pr['y'] + 300
    pts = lambda d: [{'x': cx - d, 'y': cy}, {'x': cx + d, 'y': cy}]
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': pts(40)})
    for d in (60, 80, 100): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': pts(d)}); M2.wait_for_timeout(30)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); M2.wait_for_timeout(500)
    eq('móvil: pellizcar acerca (unas 2,5 veces)', M2.evaluate(f"Math.round(VW.scale / {s0} * 10) / 10"), 2.5)
    M2.go_back(); M2.wait_for_timeout(500)
    eq('móvil: el botón «atrás» cierra el visor sin salir de la app', M2.evaluate("[$('#vw').open, location.pathname.endsWith('index.html')]"), [False, True])
    # ---- Drive normal: copia anotada en la carpeta «GPapers»
    cD, D1 = device(google=True)
    D1.click('#syncBtn'); D1.click('#sy button:has-text("Continuar")'); D1.wait_for_timeout(1200); D1.click('#sy button:has-text("Aceptar")')
    seed(D1, 'v1'); D1.wait_for_timeout(300)
    D1.evaluate("(p => { p.pdf.ann = [{id: 'z1', k: 'hl', p: 0, q: [60, 636, 454, 649], c: '#ffd400', m: 'para Drive', at: '2026-01-01', up: '2026-01-01'}]; })(db.papers[0]); markDirty()")
    D1.evaluate("openCfg(); cfgTab('da')"); D1.click('#cfg label:has-text("Drive normal") input'); D1.wait_for_timeout(300)
    eq('activar la copia pide el permiso de Google una vez', D1.evaluate("[db.settings.pdfVis, !!$('#toast') && $('#toast').innerText.includes('Dar permiso')]"), [True, True])
    D1.evaluate("$('#cfg').close()"); D1.click('#toast button:has-text("Dar permiso")'); D1.wait_for_timeout(5000)
    vis = [f for f in STORE.values() if f.get('parents') and f['parents'] != ['appDataFolder'] and f['name'].endswith('.pdf')]
    eq('se crea la carpeta «GPapers» y dentro el PDF con nombre legible', ([f['name'] for f in STORE.values() if f.get('mime') == 'application/vnd.google-apps.folder'], [f['name'] for f in vis]), (['GPapers'], ['Pérez 2024 - Paper con PDF.pdf']))
    eq('la copia lleva la anotación dentro', [b'para Drive' in f['content'].encode('latin-1') or 'para Drive' in f['content'] or 'FEFF0070' in f['content'].upper() for f in vis], [True])
    eq('el paper recuerda el archivo para actualizarlo', D1.evaluate("!!db.papers[0].pdf.vid"), True)
    n1 = len(vis); D1.evaluate("syRun(false)"); D1.wait_for_timeout(1500)
    eq('si no cambia, no se vuelve a subir', len([f for f in STORE.values() if f['name'].endswith('.pdf') and f.get('parents') != ['appDataFolder']]), n1)
    eq('sin errores', [e for e in errs if 'could not be cloned' not in e], [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
