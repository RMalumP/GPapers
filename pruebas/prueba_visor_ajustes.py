# Pruebas del visor (v39.47): ⚙ Ajustes del visor (⋯ → ⚙, en el PDF y en el EPUB), los submenús más cortos y medios puntos de velocidad
# en el desplazamiento automático.
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
MKPDF = """async NP => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < NP; i++) { const p = d.addPage([595, 842]); for (let y = 780; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y} palabras para subrayar aqui`, {x: 60, y, size: 14, font: f}); }
  return new File([await d.save()], 'tactil.pdf', {type: 'application/pdf'}); }"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro táctil</dc:title><dc:identifier id="uid">x</dc:identifier></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>')
    z.writestr('OEBPS/c1.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>Uno</h1>' + ''.join(f'<p>Parrafo {k} con ballenas blancas y arpones afilados en el mar.</p>' for k in range(40)) + '</body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
PORT = 8813
MENU = "[...document.querySelectorAll('#vwMenu button, #vwMenu .ctxh')].map(b => b.textContent.trim())"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block'); A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'")
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0"); A.evaluate(f"window.MKPDF = {MKPDF}; 0")
    A.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Ajustes', {{pdf: {{name: 'a.pdf'}}}}), P('e1', 'Libro', {{pdf: {{name: 'libro.epub'}}}}));
      PDF_FILES.set('p1', await MKPDF(4)); PDF_FILES.set('e1', {EPF}); markDirty(); render(); }})()""")
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200)
    m = A.evaluate(MENU)
    eq('⋯: Modo de lectura, Marcadores y ⚙ Ajustes del visor', [any(x.startswith('📖 Modo de lectura') for x in m), any(x.startswith('🔖 Marcadores') for x in m), any(x.startswith('⚙ Ajustes del visor') for x in m)], [True, True, True])
    eq('⋯ ya no lleva el modo noche, los atajos ni el Drive normal', [any('Modo noche' in x or 'Atajos' in x or 'Drive normal' in x for x in m)], [False])
    A.evaluate("vwReadMenu()"); A.wait_for_timeout(100); m = A.evaluate(MENU)
    eq('Modo de lectura: solo lo de leer (sin gestos, pestaña ni color)', [any('Pellizcar' in x or 'pestaña' in x or 'color de un subrayado' in x for x in m), any('Doble página' in x for x in m), any('Página a página' in x for x in m)], [False, True, True])
    A.evaluate("vwCfgMenu()"); A.wait_for_timeout(100); m = A.evaluate(MENU)
    eq('⚙: todas las secciones', [any(k in x for x in m) for k in ['Al cambiar el color de un subrayado', 'Gestos de zoom', 'Pantalla completa', 'Modo noche', 'Tamaño del texto de la interfaz', 'Al abrir', 'Rendimiento', 'Atajos de teclado']], [True] * 8)
    eq('⚙: sin el desplazamiento automático', any('automático' in x.lower() and 'desplazamiento' in x.lower() for x in m), False)
    eq('el menú largo se desplaza dentro de la pantalla', A.evaluate("(m => [getComputedStyle(m).overflowY === 'auto' || getComputedStyle(m).overflow === 'auto', m.getBoundingClientRect().bottom <= innerHeight])($('#vwMenu'))"), [True, True])
    def pick(t):
        ok = A.evaluate("t => { const b = [...document.querySelectorAll('#vwMenu button')].find(b => b.textContent.includes(t)); if (b) b.click(); return !!b; }", t); A.wait_for_timeout(150)
        if not ok: eq('opción del menú: ' + t, False, True)
    pick('Solo cambia ese subrayado'); pick('🤏 Pellizcar'); pick('A la derecha'); pick('🌙 Noche'); pick('Siempre')
    eq('las opciones se aplican (color, gesto, pestaña, noche, modo ligero)', A.evaluate("[annColOnly(), VW.zPinch, VW.tbPos, vwNightPref(), $('#vw').classList.contains('night'), vwLitePref(), VW.lite, $('#vw').classList.contains('lite')]"), [True, False, 'r', 'on', True, 'on', True, True])
    eq('y el menú sigue abierto, marcándolas', A.evaluate("[!$('#vwMenu').hidden, [...document.querySelectorAll('#vwMenu button')].find(b => b.textContent.includes('Solo cambia ese')).textContent.startsWith('✓')]"), [True, True])
    pick('Los PDF, en una pestaña nueva'); pick('Con el panel de anotaciones')
    eq('al abrir: pestaña nueva y panel cerrado', A.evaluate("[db.settings.pdfTab, vwSideOn()]"), ['tab', False])
    pick('125 %')
    eq('tamaño del texto de la interfaz', A.evaluate("uiFz()"), 1.25)
    pick('100 %')
    pick('Nunca'); pick('No')
    eq('volver a como estaba', A.evaluate("[vwLitePref(), VW.lite, vwNightPref()]"), ['off', False, 'off'])
    pick('‹ Volver'); eq('‹ Volver lleva a ⋯', any(x.startswith('⚙ Ajustes del visor') for x in A.evaluate(MENU)), True)
    # ---- velocidad: medios puntos
    A.evaluate("localStorage.removeItem('gp-vw-auto'); vwAutoSpeed(1)")
    eq('cada paso de velocidad es medio punto', A.evaluate("[vwAutoLv(), $('#toast')?.textContent?.includes('7,5') ?? null]")[0], 7.5)
    A.evaluate("vwAutoSpeed(-1); vwAutoSpeed(-1)")
    eq('y hacia abajo', A.evaluate("vwAutoLv()"), 6.5)
    A.evaluate("vwAutoSet('8.3')"); eq('se redondea a medio punto', A.evaluate("vwAutoLv()"), 8.5)
    eq('la barra de velocidad va de medio en medio y lo muestra con coma', A.evaluate("[$('#vwAutoR').step, vwAutoFmt(8.5)]"), ['0.5', '8,5'])
    A.evaluate("vwRdSet('flip', 0); vwAutoStart()"); A.wait_for_timeout(200)
    eq('el desplazamiento automático usa la velocidad con medio punto', A.evaluate("[VW.auto, VW.autoLv, $('#vwAutoV').textContent]"), [True, 8.5, '8,5'])
    A.evaluate("vwAutoStop(); vwClose()"); A.wait_for_timeout(300)
    # ---- EPUB
    A.evaluate("pdfOpen('e1', 1)"); A.wait_for_timeout(1500)
    A.evaluate("epMore({stopPropagation() {}, currentTarget: $('#ep .vwh button:last-child')})"); A.wait_for_timeout(100)
    eq('EPUB: ⋯ con ⚙ Ajustes del visor y sin atajos', (lambda m: [any(x.startswith('⚙ Ajustes del visor') for x in m), any('Atajos' in x for x in m)])(A.evaluate(MENU.replace('#vwMenu', '#epMenu'))), [True, False])
    A.evaluate("epCfgMenu()"); A.wait_for_timeout(100); m = A.evaluate(MENU.replace('#vwMenu', '#epMenu'))
    eq('EPUB: ⚙ con lo suyo (sin gestos de zoom ni modo noche del PDF)', [any(k in x for x in m) for k in ['Al cambiar el color de un subrayado', 'Tamaño del texto', 'Rendimiento', 'Atajos de teclado', 'Gestos de zoom', 'Modo noche']], [True, True, True, True, False, False])
    A.evaluate("[...document.querySelectorAll('#epMenu button')].find(b => b.textContent.includes('Ese y los siguientes')).click()"); A.wait_for_timeout(100)
    eq('EPUB: la opción del color también', A.evaluate("annColOnly()"), False)
    A.evaluate("epAutoSpeed(1)"); eq('EPUB: medios puntos también', A.evaluate("vwAutoLv()"), 9)
    eq('sin errores', errs, [])
    b.close(); srv.kill()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
