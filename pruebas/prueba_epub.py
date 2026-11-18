# Pruebas del lector de EPUB y de la inserción de PDF y EPUB (v39.42): leer el EPUB (ZIP, OPF, índice, portada), limpiar el contenido,
# subrayados con comentario (y deshacer), buscar, página a página y doble página, marcadores, dónde ibas, desplazamiento automático,
# tamaño de letra, bandeja con EPUB (cita como libro), portada, soltar un PDF o EPUB sobre una tarjeta o la ficha, pegarlo y completar datos.
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
SHOTS = os.environ.get('EPUB_SHOTS')   # carpeta para capturas (opcional)
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))

def epub():   # un EPUB 3 pequeño: tres capítulos, índice nav, portada, nota al pie y cosas que se deben quitar
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/content.opf', '''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Moby Dick de prueba</dc:title><dc:creator id="a1">Herman Melville</dc:creator><meta refines="#a1" property="role">aut</meta>
<dc:creator id="a2">Ana Editora</dc:creator><meta refines="#a2" property="role">edt</meta><dc:identifier id="uid">urn:isbn:978-0-14-243724-7</dc:identifier><dc:identifier>doi:10.1234/libro.5678</dc:identifier>
<dc:date>1851-10-18</dc:date><dc:publisher>Editorial Ballena</dc:publisher><dc:language>es</dc:language><meta name="cover" content="cov"/></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cov" href="img/portada.png" media-type="image/png"/>
<item id="c1" href="Text/cap1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="Text/cap%202.xhtml" media-type="application/xhtml+xml"/><item id="c3" href="Text/cap3.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>''', zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/nav.xhtml', '''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>
<li><a href="Text/cap1.xhtml">Capítulo 1. Espejismos</a></li><li><a href="Text/cap%202.xhtml">Capítulo 2. La ballena</a><ol><li><a href="Text/cap%202.xhtml#arpon">El arpón</a></li></ol></li><li><a href="Text/cap3.xhtml">Capítulo 3. Final</a></li></ol></nav></body></html>''', zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/img/portada.png', (folder / 'pruebas' / 'img_prueba.png').read_bytes())
    par = lambda i, k: f'<p>Párrafo {k} del capítulo {i}. Llamadme Ismael. Hace unos años, sin dinero en el bolsillo y nada que me interesara en tierra, pensé en navegar un poco y ver la parte acuosa del mundo.</p>'
    h = lambda body: f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title><style>body{{color:red}}</style><script>window.PWNED=1</script></head><body>{body}</body></html>'
    z.writestr('OEBPS/Text/cap1.xhtml', h('<h1>Capítulo 1. Espejismos</h1><p data-onclick="say(\'hola\')" onclick="window.PWNED=2" style="color:red;text-align:center">Texto centrado con <i>cursiva</i> y una nota<a epub:type="noteref" href="cap3.xhtml#n1">1</a>.</p><img src="../img/portada.png" alt="Portada"/><form><input value="x"/></form><iframe src="https://example.com"></iframe>' + ''.join(par(1, k) for k in range(40)) + '<p><a href="cap%202.xhtml#arpon">Ir al arpón</a> · <a href="https://example.com/x">Fuera</a></p>'), zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/Text/cap 2.xhtml', h('<h1>Capítulo 2. La ballena</h1>' + ''.join(par(2, k) for k in range(30)) + '<h2 id="arpon">El arpón</h2><p>La gran ballena blanca nadaba lejos del barco.</p>' + ''.join(par(2, k) for k in range(30, 50))), zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/Text/cap3.xhtml', h('<h1>Capítulo 3. Final</h1>' + ''.join(par(3, k) for k in range(30)) + '<aside epub:type="footnote" id="n1"><p>Esta es la nota número uno.</p></aside>'), zipfile.ZIP_DEFLATED)
    z.close(); return base64.b64encode(b.getvalue()).decode()
B64 = epub()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{B64}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
PDF = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
DROP = """async ([sel, mk]) => { const f = mk === 'pdf' ? await %s : %s, dt = new DataTransfer(); dt.items.add(f); const el = document.querySelector(sel);
  el.dispatchEvent(new DragEvent('dragover', {dataTransfer: dt, bubbles: true, cancelable: true, clientX: 5, clientY: 5})); el.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true})); }""" % (PDF, EPF)
PORT = 8811
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', device_scale_factor=2 if SHOTS else 1)
        c.route('**/api.crossref.org/**', lambda r: r.abort())
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0")
        p.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Libro', {{pdf: {{name: 'libro.epub'}}}}), P('p2', 'Paper dos'), P('p3', 'Paper tres'), P('p4', 'Paper cuatro'));
          PDF_FILES.set('p1', {EPF}); markDirty(); render(); }})()""")
        return c, p
    cA, A = device()
    # ---- abrir: lectura del ZIP, OPF, índice y limpieza
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    eq('se abre el lector de EPUB (no el de PDF)', A.evaluate("[EP.open, VW.open, $('#ep').open]"), [True, False, True])
    eq('tres capítulos y el índice (con el subapartado)', A.evaluate("[EP.secs.length, EP.bk.toc.map(x => [x.t, x.i, x.lv, x.frag])]"), [3, [['Capítulo 1. Espejismos', 0, 0, ''], ['Capítulo 2. La ballena', 1, 0, ''], ['El arpón', 1, 1, 'arpon'], ['Capítulo 3. Final', 2, 0, '']]])
    A.wait_for_timeout(300)
    eq('v40: al abrirlo se guarda el texto de cada capítulo, para buscar desde la lista', A.evaluate("idb('readonly', st => st.get('pdftx:p1')).then(r => r && [r.name, r.pages.length, /Espejismos/.test(r.pages[0])])"), ['libro.epub', 3, True])
    eq('v40: y también sin abrir el lector (Preparar la búsqueda)', A.evaluate("txFromEpub(PDF_FILES.get('p1')).then(L => [L.length, /Espejismos/.test(L[0])])"), [3, True])
    eq('v40: Ctrl+K en el lector de EPUB: sus órdenes, también las de los submenús', A.evaluate("(L => [L.length > 10, L.some(c => /^Aa Texto y colores › /.test(c.t)), L.some(c => /^📖 Modo de lectura › /.test(c.t))])(rdCmds())"), [True, True, True])
    eq('metadatos: título, autor (no el editor), año, editorial, ISBN y DOI', A.evaluate("(m => [m.title, m.authors, m.year, m.publisher, m.isbn, m.doi])(EP.bk.meta)"), ['Moby Dick de prueba', ['Melville, Herman'], '1851', 'Editorial Ballena', '9780142437247', '10.1234/libro.5678'])
    eq('limpieza: sin scripts, estilos, formularios, iframes ni data-on/on…', A.evaluate("['script', 'style', 'form', 'input', 'iframe', '[data-onclick]', '[onclick]'].map(s => $('#epDoc').querySelectorAll(s).length).concat([typeof window.PWNED])"), [0, 0, 0, 0, 0, 0, 0, 'undefined'])
    eq('del estilo del libro solo queda la alineación (y la cursiva)', A.evaluate("(p => [p.style.textAlign, p.style.color, !!p.querySelector('i')])(EP.secs[0].querySelector('p'))"), ['center', '', True])
    A.wait_for_timeout(500)
    eq('las imágenes salen del ZIP (blob:)', A.evaluate("(i => [i.src.startsWith('blob:'), i.naturalWidth > 0, i.alt])(EP.secs[0].querySelector('img'))"), [True, True, 'Portada'])
    eq('enlaces: de fuera a pestaña nueva; de dentro, al capítulo', A.evaluate("[...EP.secs[0].querySelectorAll('a')].map(a => a.dataset.go || a.target)"), ['2#n1', '1#arpon', '_blank'])
    eq('el título del paper en la cabecera', A.evaluate("$('#ep .vwt').textContent"), 'Libro')
    # ---- nota al pie: ventanita sin saltar
    A.evaluate("EP.secs[0].querySelector('a.epnr').click()"); A.wait_for_timeout(100)
    eq('la llamada a nota muestra la nota', A.evaluate("[$('#epPop').hidden, $('#epPop .epnote')?.textContent]"), [False, 'Esta es la nota número uno.'])
    A.evaluate("epPopClose()")
    # ---- enlace interno
    A.evaluate("EP.secs[0].querySelectorAll('a')[1].click()"); A.wait_for_timeout(150)
    eq('el enlace interno enseña antes una vista previa (v39.50)', A.evaluate("[!$('#epLk').hidden, epLoc().i]"), [True, 0])
    A.evaluate("lnEpGoPrev()"); A.wait_for_timeout(150)
    eq('el enlace interno lleva al arpón (capítulo 2)', A.evaluate("[epLoc().i, Math.abs(document.getElementById('ep1-arpon').getBoundingClientRect().top - $('#epScroll').getBoundingClientRect().top) < 60]"), [1, True])
    # ---- subrayar
    A.evaluate("""(() => { const sec = EP.secs[1], h = sec.querySelector('#ep1-arpon').nextElementSibling.firstChild, r = document.createRange(); r.setStart(h, 3); r.setEnd(h, 22);
      getSelection().removeAllRanges(); getSelection().addRange(r); })()"""); A.wait_for_timeout(400)
    eq('al seleccionar sale la barra de colores', A.evaluate("$('#epSel').hidden"), False)
    if SHOTS: A.screenshot(path=f'{SHOTS}/1_seleccion.png')
    A.evaluate("epSelColor(1)"); A.wait_for_timeout(100)
    a = A.evaluate("db.papers[0].pdf.ann[0]")
    eq('subrayado guardado: capítulo, posiciones, color y texto', [a['k'], a['p'], a['q'][1] == -a['q'][0], a['c'], a['t']], ['hl', 1, True, '#5fd068', 'gran ballena blanca'])
    eq('se pinta en el texto (sin cambiarlo)', A.evaluate("[[...EP.secs[1].querySelectorAll('mark.eph')].map(m => m.textContent).join(''), EP.secs[1].textContent.length === EP.len[1]]"), ['gran ballena blanca', True])
    A.wait_for_timeout(1600)   # deshacer junta los cambios de menos de 1,5 s
    A.evaluate("epPopOpen(db.papers[0].pdf.ann[0].id); $('#epCm').value = 'Un comentario'; epSaveComment(); epPopClose()")
    eq('el comentario va con el subrayado', A.evaluate("db.papers[0].pdf.ann[0].m"), 'Un comentario')
    eq('notas y resumen dicen el capítulo', A.evaluate("annText(db.papers[0], db.papers[0].pdf.ann, 'txt', true)"), '«gran ballena blanca» (cap. 2)\nUn comentario')
    A.evaluate("epPanel('ann')"); A.wait_for_timeout(100)
    eq('panel de anotaciones con el subrayado y su capítulo', A.evaluate("[...$('#epSide').querySelectorAll('.vwi small')].map(x => x.textContent)"), ['cap. 2 · Capítulo 2. La ballena'])
    if SHOTS: A.screenshot(path=f'{SHOTS}/2_subrayado_panel.png')
    A.evaluate("undo()"); A.wait_for_timeout(200)
    eq('deshacer quita el comentario', A.evaluate("[db.papers[0].pdf.ann.length, db.papers[0].pdf.ann[0].m || '']"), [1, ''])
    A.evaluate("undo()"); A.wait_for_timeout(200)
    eq('deshacer otra vez quita el subrayado (y su marca)', A.evaluate("[(db.papers[0].pdf.ann || []).length, EP.secs[1].querySelectorAll('mark.eph').length]"), [0, 0])
    A.wait_for_timeout(1600)
    # ---- subrayado que cruza capítulos: uno por capítulo
    A.evaluate("""(() => { const a = EP.secs[0].lastElementChild.firstChild, z = EP.secs[1].querySelector('h1').firstChild, r = document.createRange(); r.setStart(a, 0); r.setEnd(z, 5);
      getSelection().removeAllRanges(); getSelection().addRange(r); epSelColor(0); })()"""); A.wait_for_timeout(100)
    eq('selección entre dos capítulos: un subrayado en cada uno', A.evaluate("db.papers[0].pdf.ann.map(a => [a.p, a.t.slice(0, 7)])"), [[0, 'Ir al a'], [1, 'Capít']])
    A.evaluate("undo()"); A.wait_for_timeout(1600)
    # ---- buscar (sin tildes ni mayúsculas)
    A.evaluate("epFindToggle(true); $('#epQ').value = 'ARPON'; epFind(1)"); A.wait_for_timeout(150)
    eq('buscar sin tildes: resultados y marca', A.evaluate("[EP.find.hits.length, $('#epDoc mark.epfh')?.textContent, $('#epQn').textContent]"), [2, 'arpón', '2 de 2'])   # empieza por el siguiente a donde estás (el título «El arpón»)
    A.evaluate("epFindToggle(false)")
    # ---- tamaño de letra
    A.evaluate("epSetPut('fs', 24)")
    eq('tamaño de letra (en el dispositivo)', A.evaluate("[getComputedStyle($('#epDoc')).fontSize, JSON.parse(localStorage.getItem('gp-ep-set')).fs]"), ['24px', 24])
    A.evaluate("epSetPut('fs', 19)")
    # ---- página a página
    A.evaluate("epGoLoc({i: 1, f: 0.5}); epMode('page')"); A.wait_for_timeout(300)
    eq('página a página: columnas y sigue en el mismo capítulo', A.evaluate("[$('#ep').classList.contains('eppaged'), $('#epScroll').scrollWidth > $('#epScroll').clientWidth * 3, epLoc().i]"), [True, True, 1])
    eq('cada capítulo empieza en una página', A.evaluate("epStarts().every(x => x % EP.pw === 0)"), True)
    x0 = A.evaluate("$('#epScroll').scrollLeft"); A.evaluate("epStep(1)")
    eq('→ pasa una página exacta', A.evaluate("$('#epScroll').scrollLeft") - x0, A.evaluate("EP.pw"))
    A.mouse.click(1270 - 360 if A.evaluate("EP.side") else 1270, 400); A.wait_for_timeout(100)
    eq('toque a la derecha: página siguiente', A.evaluate("$('#epScroll').scrollLeft") - x0, 2 * A.evaluate("EP.pw"))
    A.keyboard.press('ArrowLeft'); A.wait_for_timeout(50)
    eq('← vuelve', A.evaluate("$('#epScroll').scrollLeft") - x0, A.evaluate("EP.pw"))
    A.evaluate("epSideClose(); epMode('two')"); A.wait_for_timeout(300)
    eq('doble página: dos columnas por pantalla', A.evaluate("getComputedStyle($('#epDoc')).columnCount"), '2')
    # v39.43: doble página de una en una (la de la derecha pasa a la izquierda) o de dos en dos
    x0 = A.evaluate("$('#epScroll').scrollLeft"); A.evaluate("epStep(1)")
    eq('doble página (de dos en dos): → pasa la pantalla entera', A.evaluate("$('#epScroll').scrollLeft") - x0, A.evaluate("EP.pw"))
    A.evaluate("epReadMenu()"); A.wait_for_timeout(100)
    eq('el menú ofrece de una en una y de dos en dos', A.evaluate("['Pasar de una en una', 'Pasar de dos en dos'].map(t => $('#epMenu').textContent.includes(t))"), [True, True])
    A.evaluate("$('#epMenu').hidden = true; epSetPut('one', true)"); A.wait_for_timeout(200)
    x0 = A.evaluate("$('#epScroll').scrollLeft"); A.evaluate("epStep(1)")
    eq('de una en una: → avanza una columna (media pantalla)', abs(A.evaluate("$('#epScroll').scrollLeft") - x0 - A.evaluate("EP.pw / 2")) <= 1, True)
    A.evaluate("epStep(-1)")
    eq('de una en una: ← vuelve', abs(A.evaluate("$('#epScroll').scrollLeft") - x0) <= 1, True)
    eq('se recuerda en el dispositivo', A.evaluate("JSON.parse(localStorage.getItem('gp-ep-set')).one"), True)
    A.evaluate("epSetPut('one', false)"); A.wait_for_timeout(200)
    if SHOTS: A.screenshot(path=f'{SHOTS}/3_doble_pagina.png')
    A.evaluate("epTypoMenu({currentTarget: $('#epAaB')})"); A.wait_for_timeout(100)
    if SHOTS: A.screenshot(path=f'{SHOTS}/4_menu_texto.png')
    A.evaluate("$('#epMenu').hidden = true; epMode('scroll')"); A.wait_for_timeout(200)
    eq('vuelta al modo seguido sin perder el capítulo', A.evaluate("[$('#ep').classList.contains('eppaged'), epLoc().i]"), [False, 1])
    # ---- marcadores
    A.evaluate("epBmToggle()")
    eq('marcador: capítulo × 100 + %', A.evaluate("[db.papers[0].pdf.bm.length, Math.floor(db.papers[0].pdf.bm[0] / 100), epBmHere().length, $('#epBmB').classList.contains('on')]"), [1, 1, 1, True])
    A.evaluate("epGoLoc({i: 0, f: 0}); epBmStep(1)"); A.wait_for_timeout(50)
    eq('] lleva al marcador', A.evaluate("[epLoc().i, epBmHere().length]"), [1, 1])
    # ---- desplazamiento automático
    A.evaluate("epAutoSet(20); epAutoStart()"); y0 = A.evaluate("$('#epScroll').scrollTop"); A.wait_for_timeout(1200)
    eq('desplazamiento automático: baja solo', A.evaluate("$('#epScroll').scrollTop") > y0 + 20, True)
    A.evaluate("epAutoPause(true)"); y1 = A.evaluate("$('#epScroll').scrollTop"); A.wait_for_timeout(400)
    eq('en pausa no se mueve', A.evaluate("$('#epScroll').scrollTop"), y1)
    A.evaluate("epAutoStop(); epAutoSet(7)")
    # ---- dónde ibas
    A.evaluate("epGoLoc({i: 2, f: 0.4})"); A.evaluate("epClose()"); A.wait_for_timeout(200)
    eq('al cerrar, el capítulo va con el EPUB (se sincroniza)', A.evaluate("db.papers[0].pdf.page"), 3)
    eq('y el punto exacto, en el dispositivo', A.evaluate("(r => [r[0], Math.abs(r[1] - .4) < .05])(JSON.parse(localStorage.getItem('gp-ep-pos'))[pdfKey('p1', 1)])"), [2, True])
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    eq('al volver a abrirlo sigue donde lo dejaste', A.evaluate("(l => [l.i, Math.abs(l.f - .4) < .06])(epLoc())"), [2, True])
    if SHOTS: A.screenshot(path=f'{SHOTS}/0_lector.png')
    A.evaluate("epClose()"); A.wait_for_timeout(200)
    # ---- portada como imagen del paper
    eq('la portada del EPUB es la imagen del paper', A.evaluate("covGet(db.papers[0]).then(d => d.startsWith('data:image/jpeg'))"), True)
    eq('botón 📘 en la tarjeta', A.evaluate("!!document.querySelector('.card[data-id=\"p1\"] [data-onclick^=\"pdfOpen\"]')?.textContent.includes('📘')"), True)
    # ---- soltar un EPUB sobre una tarjeta
    A.evaluate(DROP, ['.card[data-id="p2"]', 'epub']); A.wait_for_timeout(600)
    eq('soltado sobre una tarjeta: se enlaza a ese paper', A.evaluate("[db.papers[1].pdf?.name, !!PDF_FILES.get('p2'), (db.inbox || []).length]"), ['libro.epub', True, 0])
    A.wait_for_timeout(1800)
    eq('y ofrece completar con el DOI que trae', A.evaluate("$('#toast')?.textContent.includes('10.1234/libro.5678')"), True)
    # ---- soltar un PDF sobre una fila de la tabla
    A.evaluate(DROP, ['.card[data-id="p3"]', 'pdf']); A.wait_for_timeout(600)
    eq('un PDF también: soltado sobre una tarjeta', A.evaluate("db.papers[2].pdf?.name"), 'prueba.pdf')
    # ---- soltar en la ficha abierta y pegar
    A.evaluate("openPaper('p4')"); A.wait_for_timeout(200)
    eq('la ficha muestra siempre «Enlazar un PDF o EPUB…»', A.evaluate("!!document.querySelector('#dlg .pdfrow[data-pdf=\"1\"]') && $('#dlg .pdfrow').textContent.includes('suéltalo aquí')"), True)
    A.evaluate(DROP, ['#dlg .pdfrow', 'epub']); A.wait_for_timeout(500)
    eq('soltado en la ficha: va al borrador', A.evaluate("[D.pdf?.name, db.papers[3].pdf?.name || null]"), ['libro.epub', None])
    A.evaluate("""(async () => { const dt = new DataTransfer(); dt.items.add(await %s); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); })()""" % PDF); A.wait_for_timeout(500)
    eq('pegado en la ficha: segundo documento', A.evaluate("D.pdf2?.name"), 'prueba.pdf')
    eq('en la ficha, el EPUB no tiene «Página»', A.evaluate("[!!document.querySelector('#dlg .pdfrow[data-pdf=\"1\"] input[type=number]'), !!document.querySelector('#dlg .pdfrow[data-pdf=\"2\"] input[type=number]')]"), [False, True])
    A.evaluate("docFillDraft('p4', docRef({ep: true, title: 'Moby Dick', authors: ['Melville, Herman'], year: '1851', publisher: 'Editorial Ballena', isbn: '9780142437247'}))")
    eq('completar: solo los campos vacíos', A.evaluate("[D.title, D.authors, D.publisher, D.isbn, D.year]"), ['Paper cuatro', ['Pérez, Juan'], 'Editorial Ballena', '9780142437247', 2024])
    A.evaluate("commit()"); A.wait_for_timeout(200)
    eq('al guardar la ficha quedan los dos', A.evaluate("[db.papers[3].pdf?.name, db.papers[3].pdf2?.name]"), ['libro.epub', 'prueba.pdf'])
    # ---- bandeja con un EPUB: cita como libro con sus metadatos
    A.evaluate(f"(async () => inboxAdd([{{file: {EPF}}}]))()"); A.wait_for_timeout(1500)
    it = A.evaluate("db.inbox[0]")
    eq('EPUB en la bandeja: DOI y título de sus metadatos', [it['name'], it.get('doi'), it.get('guess')], ['libro.epub', '10.1234/libro.5678', 'Moby Dick de prueba · Melville'])
    eq('con su portada como miniatura', A.evaluate("idb('readonly', st => st.get('pdft:' + inKey(db.inbox[0].id))).then(t => typeof t === 'string' && t.startsWith('data:image/'))"), True)
    A.evaluate("inboxCite(db.inbox[0].id)"); A.wait_for_timeout(1500)
    nw = A.evaluate("(p => [p.type, p.title, p.authors, p.year, p.publisher, p.isbn, p.pdf.name])(db.papers.at(-1))")
    eq('sin CrossRef, la cita sale del EPUB (libro)', nw, ['libro', 'Moby Dick de prueba', ['Melville, Herman'], 1851, 'Editorial Ballena', '9780142437247', 'libro.epub'])
    A.evaluate("$('#dlg').open && $('#dlg').close()")
    # ---- un archivo que no es EPUB
    A.evaluate("db.papers.push(P('p9', 'Roto', {pdf: {name: 'roto.epub'}})); PDF_FILES.set('p9', new File(['no es un zip'], 'roto.epub')); pdfOpen('p9', 1)"); A.wait_for_timeout(600)
    eq('un EPUB roto avisa sin romper nada', A.evaluate("$('#epLoad').textContent.includes('No se pudo abrir el EPUB')"), True)
    A.evaluate("epClose()")
    cA.close()
    # ---- móvil
    cB, B = device(True)
    B.evaluate("pdfOpen('p1', 1)"); B.wait_for_timeout(1500)
    eq('móvil: abre a pantalla completa, sin desplazamiento horizontal', B.evaluate("[EP.open, document.documentElement.scrollWidth <= innerWidth, $('#epScroll').scrollWidth <= $('#epScroll').clientWidth + 1]"), [True, True, True])
    eq('móvil: la barra de herramientas abajo', B.evaluate("(r => r.bottom > innerHeight - 90)($('#ep .vwtb').getBoundingClientRect())"), True)
    if SHOTS: B.screenshot(path=f'{SHOTS}/5_movil.png')
    B.evaluate("epMode('page')"); B.wait_for_timeout(300)
    x0 = B.evaluate("$('#epScroll').scrollLeft")
    B.evaluate("""(() => { const sc = $('#epScroll'), T = (t, x) => new Touch({identifier: 1, target: sc, clientX: x, clientY: 400});
      sc.dispatchEvent(new TouchEvent('touchstart', {touches: [T('s', 300)], changedTouches: [T('s', 300)], bubbles: true}));
      sc.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [T('e', 120)], bubbles: true})); })()"""); B.wait_for_timeout(100)
    eq('móvil: deslizar pasa de página', B.evaluate("$('#epScroll').scrollLeft") - x0, B.evaluate("EP.pw"))
    if SHOTS: B.screenshot(path=f'{SHOTS}/6_movil_pagina.png')
    cB.close()
    eq('sin errores de JavaScript', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
