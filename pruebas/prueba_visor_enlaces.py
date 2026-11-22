# Pruebas del visor (v39.50): enlaces del PDF (vista previa, ir y «↩ Volver», enlaces a internet), enlaces del EPUB,
# pantalla encendida (Wake Lock, simulado) y lista de resultados de la búsqueda (PDF y EPUB).
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
# PDF de 3 páginas: en la 1, «ver [2]» enlaza con la referencia 2 de la página 3 (a dos columnas) y «web» con una dirección de internet
MKPDF = """async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica), P = [];
  for (let i = 0; i < 3; i++) P.push(d.addPage([595, 842]));
  for (let y = 780; y > 400; y -= 24) P[0].drawText(`Texto de la pagina uno con palabras ${y}`, {x: 60, y, size: 12, font: f});
  P[0].drawText('Como dice el autor ver [2] en la bibliografia', {x: 60, y: 380, size: 12, font: f}); P[0].drawText('Pagina web del proyecto', {x: 60, y: 350, size: 12, font: f});
  for (let y = 780; y > 100; y -= 24) P[1].drawText(`Segunda pagina con palabras ${y}`, {x: 60, y, size: 12, font: f});
  for (let k = 0; k < 12; k++) { P[2].drawText(`[${k + 1}] Autor ${k + 1}. Titulo de la`, {x: 50, y: 780 - k * 40, size: 10, font: f}); P[2].drawText('referencia larga.', {x: 62, y: 768 - k * 40, size: 10, font: f});
    P[2].drawText(`Columna derecha ${k} palabras otras`, {x: 320, y: 780 - k * 40, size: 10, font: f}); }
  const C = d.context, N = s => L.PDFName.of(s);
  const a1 = C.register(C.obj({Type: 'Annot', Subtype: 'Link', Rect: [180, 376, 210, 392], Border: [0, 0, 0], Dest: [P[2].ref, N('XYZ'), 48, 752, null]}));
  const a2 = C.register(C.obj({Type: 'Annot', Subtype: 'Link', Rect: [60, 346, 200, 362], Border: [0, 0, 0], A: {S: 'URI', URI: L.PDFString.of('https://example.com/proyecto')}}));
  P[0].node.addAnnot(a1); P[0].node.addAnnot(a2);
  return new File([await d.save()], 'enlaces.pdf', {type: 'application/pdf'}); }"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro enlaces</dc:title><dc:identifier id="uid">x</dc:identifier></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>')
    z.writestr('OEBPS/c1.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>Uno</h1><p>Mira <a id="ln" href="c2.xhtml#ref5">la referencia cinco</a> ahora.</p>' + ''.join(f'<p>Parrafo {k} con ballenas blancas y arpones.</p>' for k in range(30)) + '</body></html>')
    z.writestr('OEBPS/c2.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>y</title></head><body><h1>Dos</h1>' + ''.join(f'<p>Mas ballenas {k} en el mar.</p>' for k in range(30)) + '<p id="ref5">Referencia cinco: Melville, Moby Dick, 1851.</p></body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
WAKE = """window.WLOG = []; Object.defineProperty(navigator, 'wakeLock', {configurable: true, value: {request: async t => { WLOG.push('req');
  const L = {}, s = {released: false, release: async () => { if (s.released) return; s.released = true; WLOG.push('rel'); (L.release || []).forEach(f => f()); }, addEventListener: (k, f) => (L[k] ||= []).push(f)}; return s; }}});"""
PORT = 8816
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(dev=None, init=''):
        c = b.new_context(**(pw.devices[dev] if dev else {'viewport': {'width': 1280, 'height': 900}}), service_workers='block')
        p = c.new_page(); p.set_default_timeout(20000); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept';" + WAKE + init)
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0"); p.evaluate(f"window.MKPDF = {MKPDF}; 0")
        return c, p
    def seed(p):
        p.evaluate("""async () => { db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Enlaces', {pdf: {name: 'enlaces.pdf'}})); PDF_FILES.set('p1', await MKPDF()); markDirty(); render(); }""")
        p.evaluate("pdfOpen('p1', 1)"); p.wait_for_timeout(1800)
    LINK = "(k => { const p = VW.pages[0], l = p.links[k], r = lnRect(p, l.r); return [r.left + r.width / 2, r.top + r.height / 2]; })"
    # ---- Ordenador: vista previa, ir, volver
    cA, A = device(); seed(A)
    eq('el visor lee los enlaces de la página', A.evaluate("VW.pages[0].links.map(l => [!!l.dest, l.url])"), [[True, None], [False, 'https://example.com/proyecto']])
    x, y = A.evaluate(LINK + "(0)"); A.mouse.click(x, y); A.wait_for_timeout(900)
    eq('tocar [2] abre la vista previa (sin moverse)', A.evaluate("[!$('#vwLk').hidden, VW.cur, !!$('#vwLk canvas')]"), [True, 0, True])
    eq('la vista previa enseña solo la columna de la referencia', A.evaluate("(async () => { const c = await lnCol(VW.pages[2], LN.t); return [Math.round(c.x), c.w < 300, c.w > 100]; })()"), [40, True, True])
    A.click('#vwLk .pri'); A.wait_for_timeout(600)
    eq('«Ir» lleva a la página 3 y sale «↩ Volver»', A.evaluate("[VW.cur, !$('#vwBack').hidden, $('#vwBack button').textContent, $('#vwLk').hidden]"), [2, True, '↩ Volver a la p. 1', True])
    A.click('#vwBack button'); A.wait_for_timeout(500)
    eq('«↩ Volver» regresa a la página 1 y deja solo «Adelante»', A.evaluate("[VW.cur, $('#vwBack .lnbk').hidden, $('#vwBack .lnfw').textContent]"), [0, True, 'p. 3 ›'])
    A.evaluate("lnSet('go')"); x, y = A.evaluate(LINK + "(0)"); A.mouse.click(x, y); A.wait_for_timeout(700)
    eq('con «Ir directamente», salta sin vista previa', A.evaluate("[VW.cur, $('#vwLk').hidden, LN.back.length]"), [2, True, 1])
    A.keyboard.press('Alt+ArrowLeft'); A.wait_for_timeout(400)
    eq('Alt + ← vuelve', A.evaluate("[VW.cur, LN.back.length]"), [0, 0])
    A.evaluate("window.OPEN = []; window.open = (u, t, f) => { OPEN.push([u, t, f]); }; 0"); x, y = A.evaluate(LINK + "(1)"); A.mouse.click(x, y); A.wait_for_timeout(400)
    eq('un enlace a internet pregunta antes', A.evaluate("[!$('#vwLk').hidden, $('#vwLk .lnurl').textContent, OPEN.length]"), [True, 'https://example.com/proyecto', 0])
    A.click('#vwLk .pri'); A.wait_for_timeout(200)
    eq('«Abrir» lo abre en una pestaña nueva', A.evaluate("OPEN"), [['https://example.com/proyecto', '_blank', 'noopener']])
    eq('fuera de un enlace, el toque no hace nada nuevo', A.evaluate("lnAt(5, 5)"), None)
    A.evaluate("vwGoSide(1)"); A.wait_for_timeout(300)
    eq('ir desde el índice o las miniaturas también deja «↩ Volver»', A.evaluate("[VW.cur, LN.back.length]"), [1, 1])
    A.evaluate("lnBackClear()")
    # ---- Lista de resultados
    A.evaluate("vwFindToggle(true); $('#vwQ').value = 'palabras'"); A.evaluate("vwFind(1)"); A.wait_for_timeout(800)
    nh = A.evaluate("VW.find.hits.length")
    eq('buscar: sale ☰ junto a la cuenta', [nh > 20, A.evaluate("!$('#vwQL').hidden")], [True, True])
    A.click('#vwQL'); A.wait_for_timeout(300)
    eq('☰ abre la pestaña de resultados con todos', A.evaluate("[VW.tab, document.querySelectorAll('#vwSide .lnres .vwi').length]"), ['find', nh])
    eq('cada resultado con su página y la frase', A.evaluate("(b => [b.querySelector('small').textContent, b.querySelector('b').textContent])(document.querySelectorAll('#vwSide .lnres .vwi')[1])"), ['p. 1', 'palabras'])
    last = nh - 1; A.evaluate(f"lnFindPick({last})"); A.wait_for_timeout(400)
    eq('elegir uno lleva a él y deja «↩ Volver»', A.evaluate("[VW.find.i, VW.cur, $('#vwQn').textContent, LN.back.length]"), [last, 2, f'{nh} de {nh}', 1])
    A.evaluate("lnFindPick(3)"); A.wait_for_timeout(200)
    eq('otro de la misma búsqueda no añade otro «Volver»', A.evaluate("LN.back.length"), 1)
    A.evaluate("$('#vwQ').value = 'zzz'; vwFindReset()"); A.wait_for_timeout(100)
    eq('al cambiar la búsqueda, ☰ se oculta y la lista lo dice', A.evaluate("[$('#vwQL').hidden, document.querySelector('#vwSide .lnres .empty')?.textContent || '']"), [True, 'Escribe en 🔍 Buscar y pulsa Intro.'])
    # ---- Pantalla encendida
    eq('al abrir el visor, la pantalla se queda encendida', A.evaluate("[!!WL.lock, WLOG.includes('req')]"), [True, True])
    A.evaluate("WL.act = Date.now() - 6 * 60e3; wlSync()"); A.wait_for_timeout(100)
    eq('tras 5 min sin tocar, se suelta', A.evaluate("[!!WL.lock, WLOG.at(-1)]"), [False, 'rel'])
    A.mouse.click(640, 450); A.wait_for_timeout(200)
    eq('al tocar, vuelve', A.evaluate("!!WL.lock"), True)
    A.evaluate("wlSetPref('auto')"); A.wait_for_timeout(100)
    eq('«solo con el automático»: parado, no', A.evaluate("!!WL.lock"), False)
    A.evaluate("vwAutoStart()"); A.wait_for_timeout(200)
    eq('«solo con el automático»: en marcha, sí', A.evaluate("!!WL.lock"), True)
    A.evaluate("vwAutoStop(); wlSetPref('read')"); A.wait_for_timeout(100)
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200); A.evaluate("vwCfgMenu()"); A.wait_for_timeout(150)
    eq('⚙ tiene 🔗 y 🔆', A.evaluate("['Al tocar un enlace', 'Pantalla encendida'].map(t => $('#vwMenu').textContent.includes(t))"), [True, True])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    eq('al cerrar el visor se suelta', A.evaluate("!!WL.lock"), False)
    cA.close()
    # ---- Móvil: tocar con el dedo un enlace
    cB, B = device('Pixel 7'); seed(B)
    x, y = B.evaluate(LINK + "(0)"); B.touchscreen.tap(x, y); B.wait_for_timeout(900)
    eq('móvil: el toque en [2] abre la vista previa abajo', B.evaluate("[!$('#vwLk').hidden, getComputedStyle($('#vwLk')).position, VW.cur]"), [True, 'fixed', 0])
    B.evaluate("lnGoPrev()"); B.wait_for_timeout(500)
    eq('móvil: «↩ Volver» se ve dentro de la pantalla', B.evaluate("(r => [r.top > 0, r.bottom < innerHeight, r.left >= 0])($('#vwBack').getBoundingClientRect())"), [True, True, True])
    cB.close()
    # ---- EPUB
    cC, C = device()
    C.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Libro', {{pdf: {{name: 'libro.epub'}}}})); PDF_FILES.set('p1', {EPF}); markDirty(); render(); }})()""")
    C.evaluate("pdfOpen('p1', 1)"); C.wait_for_timeout(1500)
    C.click('#ep a[data-go]'); C.wait_for_timeout(300)
    eq('EPUB: el enlace enseña antes la referencia', C.evaluate("[!$('#epLk').hidden, $('#epLk .epnote').textContent, epLoc().i]"), [True, 'Referencia cinco: Melville, Moby Dick, 1851.', 0])
    C.click('#epLk .pri'); C.wait_for_timeout(400)
    eq('EPUB: «Ir allí» salta y sale «↩ Volver»', C.evaluate("[epLoc().i, !$('#epBack').hidden]"), [1, True])
    C.click('#epBack button'); C.wait_for_timeout(300)
    eq('EPUB: «↩ Volver» regresa', C.evaluate("[epLoc().i, $('#epBack').hidden]"), [0, True])
    C.evaluate("epFindToggle(true); $('#epQ').value = 'ballenas'; epFind(1)"); C.wait_for_timeout(300)
    eq('EPUB: ☰ y la lista de resultados', [C.evaluate("!$('#epQL').hidden")], [True])
    C.click('#epQL'); C.wait_for_timeout(300)
    eq('EPUB: un resultado por cada aparición, con capítulo y frase', C.evaluate("[EP.tab, document.querySelectorAll('#epSide .lnres .vwi').length === EP.find.hits.length, document.querySelector('#epSide .lnres .vwi b').textContent]"), ['find', True, 'ballenas'])
    C.evaluate("lnEpFindPick(EP.find.hits.length - 1)"); C.wait_for_timeout(300)
    eq('EPUB: elegir uno lleva al capítulo 2', C.evaluate("[epLoc().i, LN.ep.length]"), [1, 1])
    eq('EPUB: la pantalla encendida también', C.evaluate("!!WL.lock"), True)
    cC.close()
    eq('sin errores en la página', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas')
sys.exit(1 if fail else 0)
