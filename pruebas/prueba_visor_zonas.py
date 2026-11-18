# Pruebas (v40.3): zonas para pasar de página en página a página (PDF y EPUB). Formas hechas (izquierda y derecha, arriba y abajo,
# al revés, casi todo adelante) y tres personalizadas que se editan tocando las casillas de una rejilla de 3 × 3.
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
SHOTS = os.environ.get('ZONAS_SHOTS')   # carpeta para capturas (opcional)
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = """(async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < 8; i++) { const p = d.addPage([595, 842]); for (let y = 780; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y}`, {x: 60, y, size: 12, font: f}); }
  return new File([await d.save()], 'ocho.pdf', {type: 'application/pdf'}); })()"""
def epub():   # un EPUB mínimo con un capítulo largo (varias páginas en página a página)
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('c.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>')
    z.writestr('a.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Uno</h1>' + ''.join(f'<p>Párrafo {k}. Llamadme Ismael. Hace unos años, sin dinero en el bolsillo y nada que me interesara en tierra, pensé en navegar un poco.</p>' for k in range(200)) + '</body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
PORT = 8813
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', device_scale_factor=2 if SHOTS else 1)
    A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'")
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0")
    A.evaluate(f"(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Paper con PDF', {{pdf: {{name: 'prueba.pdf'}}}})); PDF_FILES.set('p1', await {FILE}); markDirty(); render(); }})()")
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    A.evaluate("vwRdSet('flip', 1); vwGo(2, true)"); A.wait_for_timeout(500)
    R = A.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    def tap(fx, fy):   # toca en una fracción de la zona de la página y devuelve la página actual
        A.mouse.click(R[0] + R[2] * fx, R[1] + R[3] * fy); A.wait_for_timeout(350); return A.evaluate("VW.cur")
    def go(i): A.evaluate(f"vwGo({i}, true)"); A.wait_for_timeout(250)
    # ---- por defecto, como antes: izquierda y derecha
    eq('por defecto: izquierda y derecha', A.evaluate("[pzGet().sel, pzName()]"), ['lr', 'Izquierda y derecha'])
    eq('a la derecha pasa, a la izquierda vuelve', [tap(.9, .5), tap(.1, .5), tap(.1, .1)], [3, 2, 1])
    go(2); eq('arriba en el centro no pasa', tap(.5, .1), 2)
    # ---- el menú
    A.click('#vwMoreB'); A.wait_for_timeout(150); A.click("#vwMenu button[data-onclick=\"vwReadMenu()\"]"); A.wait_for_timeout(100)
    eq('📖 Modo de lectura ofrece 👆 Zonas para pasar', A.evaluate("$('#vwMenu').textContent.includes('Zonas para pasar')"), True)
    A.click("#vwMenu button[data-onclick=\"pzMenu(false)\"]"); A.wait_for_timeout(100)
    eq('submenú: 4 formas hechas y 3 personalizadas', A.evaluate("['Izquierda y derecha', 'Arriba y abajo', 'Al revés', 'Casi todo adelante', 'Personalizada 1', 'Personalizada 2', 'Personalizada 3'].map(t => $('#vwMenu').textContent.includes(t))"), [True] * 7)
    A.click("#vwMenu button[data-onclick=\"pzSet('tb',false)\"]"); A.wait_for_timeout(150)
    eq('elegir no cierra el menú, marca la opción y enseña las zonas', A.evaluate("[!$('#vwMenu').hidden, [...$('#vwMenu').querySelectorAll('button')].find(b => b.textContent.includes('Arriba y abajo')).textContent.trim().startsWith('✓'), $('#vw .pzov').classList.contains('on'), document.querySelectorAll('#vw .pzov .pv').length, document.querySelectorAll('#vw .pzov .nx').length]"), [True, True, True, 3, 3])
    if SHOTS: A.screenshot(path=f'{SHOTS}/1_arriba_abajo.png')
    eq('se recuerda en el dispositivo', A.evaluate("JSON.parse(localStorage.getItem('gp-vw-zonas')).sel"), 'tb')
    A.evaluate("$('#vwMenu').hidden = true"); go(2)
    eq('arriba y abajo: abajo pasa, arriba vuelve, a los lados en medio nada', [tap(.5, .9), tap(.5, .1), tap(.9, .5), tap(.1, .5)], [3, 2, 2, 2])
    A.evaluate("pzSet('rl', false); $('#vwMenu').hidden = true"); go(2)
    eq('al revés: derecha vuelve, izquierda pasa', [tap(.9, .5), tap(.1, .5)], [1, 2])
    A.evaluate("pzSet('fw', false); $('#vwMenu').hidden = true"); go(2)
    eq('casi todo adelante: arriba en medio y derecha pasan; izquierda vuelve; el centro no', [tap(.5, .1), tap(.9, .5), tap(.1, .9), tap(.5, .5)], [3, 4, 3, 3])
    # ---- personalizadas
    A.evaluate("vwReadMenu(); pzMenu(false)"); A.wait_for_timeout(100)
    A.click("#vwMenu button[data-onclick=\"pzSet('c2',false)\"]"); A.wait_for_timeout(150)
    eq('personalizada: sale la rejilla de 9 casillas (empieza como izquierda y derecha)', A.evaluate("[...$('#vwMenu .pzed').children].map(b => b.textContent)"), ['◀ Anterior', '—', 'Siguiente ▶'] * 3)
    A.click("#vwMenu .pzed button:nth-child(2)"); A.wait_for_timeout(100)
    A.click("#vwMenu .pzed button:nth-child(8)"); A.wait_for_timeout(100); A.click("#vwMenu .pzed button:nth-child(8)"); A.wait_for_timeout(100)
    A.click("#vwMenu .pzed button:nth-child(1)"); A.wait_for_timeout(100); A.click("#vwMenu .pzed button:nth-child(1)"); A.wait_for_timeout(100)
    eq('cada toque cambia la casilla: — → anterior → siguiente → —', A.evaluate("pzGet().c[1]"), [0, -1, 1, -1, 0, 1, -1, 1, 1])
    if SHOTS: A.screenshot(path=f'{SHOTS}/2_personalizada.png')
    eq('el menú sigue abierto', A.evaluate("!$('#vwMenu').hidden"), True)
    A.evaluate("$('#vwMenu').hidden = true"); go(2)
    eq('personalizada 2: arriba en medio vuelve, abajo en medio pasa, arriba a la izquierda nada', [tap(.5, .1), tap(.5, .9), tap(.1, .1)], [1, 2, 2])
    eq('las otras personalizadas no cambian', A.evaluate("[pzGet().c[0], pzGet().c[2]]"), [[-1, 0, 1] * 3] * 2)
    A.evaluate("pzSet('c3', false); pzCopy('tb', false)")
    eq('copiar una forma hecha a la personalizada 3', A.evaluate("[pzGet().sel, pzGet().c[2]]"), ['c3', [-1, -1, -1, 0, 0, 0, 1, 1, 1]])
    eq('pzCell no toca las formas hechas', A.evaluate("pzSet('lr', false); pzCell(0, false); pzGrid()"), [-1, 0, 1] * 3)
    eq('el resumen del menú', A.evaluate("vwReadMenu(); [...document.querySelectorAll('#vwMenu button')].find(b => b.textContent.includes('Zonas para pasar')).textContent.includes('Izquierda y derecha')"), True)
    A.evaluate("localStorage.setItem('gp-vw-zonas', '{\"sel\":\"c9\",\"c\":[[1,2]]}')")
    eq('datos raros: vuelve a izquierda y derecha', A.evaluate("[pzGet().sel, pzGet().c.length, pzGet().c[0]]"), ['lr', 3, [-1, 0, 1] * 3])
    A.evaluate("localStorage.setItem('gp-vw-zonas', '{\"sel\":\"tb\"}'); $('#vwMenu').hidden = true"); go(2)
    # ---- sin página a página no se pasa con toques; el automático sigue igual
    A.evaluate("vwRdSet('flip', 0)"); A.wait_for_timeout(300)
    eq('sin página a página el menú no ofrece las zonas', A.evaluate("vwReadMenu(); $('#vwMenu').textContent.includes('Zonas para pasar')"), False)
    A.evaluate("$('#vwMenu').hidden = true"); A.wait_for_timeout(100)
    eq('seguido: tocar abajo no pasa de página', A.evaluate("vwReadTap(" + str(R[0] + R[2] * .5) + ", " + str(R[1] + R[3] * .9) + ", false)"), False)
    A.evaluate("vwClose()"); A.wait_for_timeout(500)
    eq('sin errores en la página (PDF)', errs, [])
    # ---- EPUB: las mismas zonas
    A.evaluate(f"(() => {{ db.papers.push(P('p2', 'Libro', {{pdf: {{name: 'libro.epub'}}}})); PDF_FILES.set('p2', {EPF}); markDirty(); render(); }})()")
    A.evaluate("pdfOpen('p2', 1)"); A.wait_for_timeout(1500)
    A.evaluate("epMode('page')"); A.wait_for_timeout(400)
    E = A.evaluate("(() => { const r = $('#epScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    def etap(fx, fy): A.mouse.click(E[0] + E[2] * fx, E[1] + E[3] * fy); A.wait_for_timeout(300); return round(A.evaluate("$('#epScroll').scrollLeft / EP.pw"))
    eq('EPUB, arriba y abajo: abajo pasa, a la derecha en medio nada, arriba vuelve', [etap(.5, .9), etap(.5, .9), etap(.9, .5), etap(.5, .1)], [1, 2, 2, 1])
    A.click('#epMoreB'); A.wait_for_timeout(150); A.click("#epMenu button[data-onclick=\"epReadMenu()\"]"); A.wait_for_timeout(100)
    eq('EPUB: 📖 Modo de lectura ofrece 👆 Zonas para pasar', A.evaluate("$('#epMenu').textContent.includes('Zonas para pasar') && $('#epMenu').textContent.includes('Arriba y abajo')"), True)
    A.click("#epMenu button[data-onclick=\"pzMenu(true)\"]"); A.wait_for_timeout(100)
    A.click("#epMenu button[data-onclick=\"pzSet('lr',true)\"]"); A.wait_for_timeout(150)
    eq('EPUB: se elige desde su menú y enseña las zonas', A.evaluate("[pzGet().sel, !$('#epMenu').hidden, $('#ep .pzov').classList.contains('on')]"), ['lr', True, True])
    if SHOTS: A.screenshot(path=f'{SHOTS}/3_epub.png')
    A.evaluate("$('#epMenu').hidden = true")
    eq('EPUB, izquierda y derecha: como antes', [etap(.9, .5), etap(.1, .5), etap(.5, .9)], [2, 1, 1])
    eq('sin errores en la página', errs, [])
    srv.kill(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
