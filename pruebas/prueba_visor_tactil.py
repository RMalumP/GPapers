# Pruebas del visor en táctil (v39.45): sin el menú largo de Chrome, selección propia (pulsación larga, alargar arrastrando, tiradores,
# tocar fuera la quita) en el PDF y en el EPUB; «al cambiar el color de un subrayado: solo ese o también los siguientes»; cambiar un
# subrayado repinta solo su página; y el modo ligero de los móviles de gama baja.
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
PORT = 8812
WORD = """([txt, w]) => { const sp = [...document.querySelectorAll('#vw .vwp[data-i="0"] .textLayer span')].find(s => s.textContent.includes(txt)); const t = sp.firstChild, i = t.data.indexOf(w), r = document.createRange(); r.setStart(t, i + 1); r.setEnd(t, i + 2); const c = r.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(dev='Galaxy Tab S4', init=''):
        c = b.new_context(**pw.devices[dev], service_workers='block')
        p = c.new_page(); p.set_default_timeout(20000); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept';" + init)
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0"); p.evaluate(f"window.MKPDF = {MKPDF}; 0")
        cdp = c.new_cdp_session(p); return c, p, cdp
    def touch(cdp, kind, x=0, y=0): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})
    def seed(p, NP=4, NA=0):
        p.evaluate("""async ([NP, NA]) => { db.settings.pdfTab = 'app'; db.papers.length = 0; const ann = [];
          for (let k = 0; k < NA; k++) { const pg = k % NP, y = 780 - 24 * ((k / NP | 0) % 28); ann.push({id: 'a' + k, k: 'hl', p: pg, c: '#ffd400', t: 't' + k, q: [60, y - 3, 400, y + 13], up: '2026-01-01T00:00:00Z'}); }
          db.papers.push(P('p1', 'Tactil', {pdf: {name: 'tactil.pdf', ann}})); PDF_FILES.set('p1', await MKPDF(NP)); markDirty(); render(); }""", [NP, NA])
        p.evaluate("pdfOpen('p1', 1)"); p.wait_for_timeout(1800)
    # ---- Tablet Android (como la captura): sin menú de Chrome y con selección propia
    cA, A, cdp = device()
    seed(A)
    eq('en táctil, el texto no lo selecciona el navegador', A.evaluate("[$('#vw').classList.contains('tsel'), getComputedStyle(document.querySelector('#vw .textLayer span')).userSelect]"), [True, 'none'])
    eq('la pulsación larga no abre el menú de Chrome (en la página, en los márgenes y en las barras)', A.evaluate("['#vw .vwp .textLayer span', '#vwScroll', '#vw .vwtb'].map(s => !document.querySelector(s).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true})))"), [True, True, True])
    eq('en un campo de texto sí (para pegar)', A.evaluate("(() => { const i = document.createElement('textarea'); $('#vw').append(i); const r = i.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true})); i.remove(); return r; })()"), True)
    eq('fuera del visor no cambia nada', A.evaluate("document.body.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))"), True)
    x, y = A.evaluate(WORD, ['linea 756', 'palabras'])
    touch(cdp, 'touchStart', x, y); A.wait_for_timeout(700); touch(cdp, 'touchEnd'); A.wait_for_timeout(400)
    eq('pulsación larga: selecciona la palabra y sale nuestra barra', A.evaluate("[getSelection().rangeCount ? getSelection().getRangeAt(0).toString() : '', !$('#vwSel').hidden]"), ['palabras', True])
    eq('GPapers pinta la selección y sus dos tiradores', A.evaluate("[document.querySelectorAll('#vw .tsov i').length >= 1, [...document.querySelectorAll('#vw .tsh')].filter(h => !h.hidden).length]"), [True, 2])
    eq('y no subraya nada todavía', A.evaluate("db.papers[0].pdf.ann?.length || 0"), 0)
    A.wait_for_timeout(800); touch(cdp, 'touchStart', 300, 700); touch(cdp, 'touchEnd'); A.wait_for_timeout(300)
    eq('tocar fuera quita la selección y la barra', A.evaluate("[getSelection().isCollapsed || !getSelection().rangeCount, $('#vwSel').hidden, document.querySelector('#vw .tsov').hidden]"), [True, True, True])
    x2, _ = A.evaluate(WORD, ['linea 732', 'subrayar']); x, y = A.evaluate(WORD, ['linea 732', 'palabras'])
    touch(cdp, 'touchStart', x, y); A.wait_for_timeout(700)
    for k in range(1, 6): touch(cdp, 'touchMove', x + (x2 - x) * k / 5, y); A.wait_for_timeout(60)
    touch(cdp, 'touchEnd'); A.wait_for_timeout(400)
    eq('sin soltar, arrastrar alarga la selección por palabras enteras', A.evaluate("getSelection().getRangeAt(0).toString()"), 'palabras para subrayar')
    h = A.evaluate("(r => [r.left + 10, r.top + 10])(document.querySelector('#vw .tsh.vwhd1').getBoundingClientRect())"); x3, _ = A.evaluate(WORD, ['linea 732', 'aqui'])
    touch(cdp, 'touchStart', h[0], h[1]); [touch(cdp, 'touchMove', h[0] + (x3 - h[0] + 4) * k / 4, h[1]) for k in range(1, 5)]; touch(cdp, 'touchEnd'); A.wait_for_timeout(400)
    eq('el tirador del final la alarga', A.evaluate("getSelection().getRangeAt(0).toString()"), 'palabras para subrayar aqui')
    A.click('#vwSel .vwc[data-c="1"]'); A.wait_for_timeout(300)
    eq('un color de nuestra barra la subraya', A.evaluate("(a => [a.length, a[0].t, a[0].c])(db.papers[0].pdf.ann)"), [1, 'palabras para subrayar aqui', '#5fd068'])
    # ---- color: solo ese o también los siguientes
    A.evaluate("VW.color = 0; vwColorShow(); vwPopOpen(db.papers[0].pdf.ann[0].id)"); A.evaluate("annColSet(true)"); A.evaluate("vwPopColor(3)")
    eq('«solo ese»: cambia ese subrayado y no el color para subrayar', A.evaluate("[db.papers[0].pdf.ann[0].c, VW.color]"), ['#ff6b6b', 0])
    A.evaluate("vwColor(2)")
    eq('también con los colores de la barra, con su ventanita abierta', A.evaluate("[db.papers[0].pdf.ann[0].c, VW.color]"), ['#4dabf7', 0])
    A.evaluate("annColSet(false)"); A.evaluate("vwPopColor(4)")
    eq('«ese y los siguientes» (por defecto, como antes)', A.evaluate("[db.papers[0].pdf.ann[0].c, VW.color, localStorage.getItem('gp-ann-col')]"), ['#b197fc', 4, 'next'])
    A.evaluate("vwPopClose(); vwMore({stopPropagation() {}, currentTarget: $('#vw .vwh button[data-onclick*=vwMore]') || $('#vw .vwtb')}); vwReadMenu()"); A.wait_for_timeout(200)
    eq('la opción está en ⋯ → Modo de lectura', A.evaluate("[...document.querySelectorAll('#vwMenu button')].filter(b => /Solo cambia ese|Ese y los siguientes/.test(b.textContent)).length"), 2)
    eq('en táctil, los subrayados sin «multiplicar»', A.evaluate("getComputedStyle(document.querySelector('#vw .vwhl')).mixBlendMode"), 'normal')
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    # ---- EPUB: también selección propia
    A.evaluate(f"(async () => {{ db.papers.push(P('e1', 'Libro', {{pdf: {{name: 'libro.epub'}}}})); PDF_FILES.set('e1', {EPF}); }})()"); A.wait_for_timeout(200)
    A.evaluate("pdfOpen('e1', 1)"); A.wait_for_timeout(1800)
    eq('EPUB: tampoco el menú de Chrome, y el texto no lo selecciona el navegador', A.evaluate("[!document.querySelector('#epDoc p').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true})), getComputedStyle(document.querySelector('#epDoc p')).userSelect]"), [True, 'none'])
    x, y = A.evaluate("(() => { const t = [...document.querySelectorAll('#epDoc p')][2].firstChild, i = t.data.indexOf('ballenas'), r = document.createRange(); r.setStart(t, i + 2); r.setEnd(t, i + 3); const c = r.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; })()")
    touch(cdp, 'touchStart', x, y); A.wait_for_timeout(700); touch(cdp, 'touchEnd'); A.wait_for_timeout(500)
    eq('EPUB: pulsación larga selecciona la palabra, con nuestra barra', A.evaluate("[getSelection().getRangeAt(0).toString(), !$('#epSel').hidden, document.querySelectorAll('#ep .tsov i').length >= 1]"), ['ballenas', True, True])
    A.click('#epSel .vwc >> nth=0'); A.wait_for_timeout(300)
    eq('EPUB: y se subraya', A.evaluate("(db.papers.find(p => p.id === 'e1').pdf.ann || []).map(a => a.t)"), ['ballenas'])
    cA.close()
    # ---- Cambiar un subrayado repinta solo su página
    cB, B, cdp = device('Pixel 7', "Object.defineProperty(navigator, 'deviceMemory', {get: () => 8}); Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 8});")
    seed(B, 12, 120)
    B.evaluate("vwGo(4, true)"); B.wait_for_timeout(1200)
    B.evaluate("window._L = VW.pages.map(p => p.el.querySelector('.vwa').firstElementChild)")
    B.evaluate("vwUpd('a4', {c: '#ff6b6b'})")
    eq('cambiar el color de uno repinta solo su página', B.evaluate("VW.pages.filter(p => _L[p.i] && p.el.querySelector('.vwa').firstElementChild !== _L[p.i]).map(p => p.i)"), [4])
    B.evaluate("vwDel('a5')")
    eq('borrar uno, también', B.evaluate("[VW.pages.filter(p => _L[p.i] && p.el.querySelector('.vwa').firstElementChild !== _L[p.i]).map(p => p.i), document.querySelectorAll('#vw [data-a=\"a5\"]').length]"), [[4, 5], 0])
    eq('móvil normal (8 GB): sin modo ligero', B.evaluate("[VW.lite, $('#vw').classList.contains('lite')]"), [False, False])
    cB.close()
    # ---- Móvil de gama baja: modo ligero, y abre y responde con la CPU 6 veces más lenta
    cC, C, cdp = device('Pixel 7', "Object.defineProperty(navigator, 'deviceMemory', {get: () => 2});")
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 6})
    C.evaluate("window.LT = []; new PerformanceObserver(l => l.getEntries().forEach(e => LT.push(Math.round(e.duration)))).observe({type: 'longtask'})")
    seed(C, 40, 300); C.wait_for_timeout(2500)
    eq('poca memoria: modo ligero (menos píxeles y menos páginas en memoria)', C.evaluate("[VW.lite, $('#vw').classList.contains('lite'), vwMaxPx()]"), [True, True, 3e6])
    eq('las páginas se pintan como mucho al doble de la pantalla', C.evaluate("VW.pages.filter(p => p.cv).every(p => p.os <= 2)"), True)
    C.evaluate("LT.length = 0")
    for k in range(12): C.evaluate("$('#vwScroll').scrollBy(0, 500)"); C.wait_for_timeout(200)
    C.wait_for_timeout(2500)
    eq('al desplazar, pocas páginas en memoria y capa de texto solo cerca', C.evaluate("[VW.pages.filter(p => p.cv).length <= 6, VW.pages.filter(p => p.tl && Math.abs(p.i - VW.cur) > 6).length]"), [True, 0])
    eq('al desplazar, sin bloqueos largos', C.evaluate("Math.max(0, ...LT) < 400"), True)
    C.evaluate("LT.length = 0; window._t = performance.now(); vwUpd('a' + (VW.cur + 40), {c: '#ff6b6b'}); window._d = performance.now() - _t")
    eq('cambiar el color de un subrayado, rápido también en el móvil lento', C.evaluate("_d < 150"), True)
    eq('sin errores', errs, [])
    b.close(); srv.kill()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
