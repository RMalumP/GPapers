# Pruebas del visor (v39.52): subrayado con línea y tachado (también en el PDF anotado y en el EPUB), recorte a mano (y el automático
# al volver a abrir) y girar páginas.
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
  for (let i = 0; i < NP; i++) { const p = d.addPage([595, 842]); for (let y = 700; y > 160; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y} ballena blanca`, {x: 120, y, size: 14, font: f}); }
  return new File([await d.save()], 'giro.pdf', {type: 'application/pdf'}); }"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro</dc:title><dc:identifier id="uid">x</dc:identifier></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>')
    z.writestr('OEBPS/c1.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>Uno</h1>' + ''.join(f'<p>Parrafo {k} con ballenas blancas y arpones.</p>' for k in range(20)) + '</body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
SEL = """(([pg, t]) => { const sp = [...document.querySelectorAll(`#vw .vwp[data-i="${pg}"] .textLayer span`)].find(s => s.textContent.includes(t)); const x = sp.firstChild, i = x.data.indexOf('ballena'), r = document.createRange(); r.setStart(x, i); r.setEnd(x, x.data.length); getSelection().removeAllRanges(); getSelection().addRange(r); })"""
OVER = """(([id, t]) => { const h = document.querySelector(`#vw .vwhl[data-a="${id}"]`).getBoundingClientRect(), sp = [...document.querySelectorAll('#vw .vwp[data-i="0"] .textLayer span')].find(s => s.textContent.includes(t)), r = document.createRange(); r.selectNodeContents(sp); const R = [...r.getClientRects()].reduce((a, c) => ({l: Math.min(a.l, c.left), t: Math.min(a.t, c.top), r: Math.max(a.r, c.right), b: Math.max(a.b, c.bottom)}), {l: 1e9, t: 1e9, r: -1e9, b: -1e9});
  const ix = Math.max(0, Math.min(h.right, R.r) - Math.max(h.left, R.l)) * Math.max(0, Math.min(h.bottom, R.b) - Math.max(h.top, R.t)); return [Math.round(ix / (h.width * h.height) * 10) / 10 >= .6, h.height > h.width]; })"""
PORT = 8818
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
    A = c.new_page(); A.set_default_timeout(20000); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept';")
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0"); A.evaluate(f"window.MKPDF = {MKPDF}; 0")
    A.evaluate("""async () => { db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Giro', {pdf: {name: 'giro.pdf'}})); PDF_FILES.set('p1', await MKPDF(3)); markDirty(); render(); }""")
    def reopen(): A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    # ---- Línea debajo y tachado
    A.evaluate(SEL + "([0, 'linea 700'])"); A.wait_for_timeout(400); A.click('#vwSel [data-onclick^="lnSelMore"]'); A.wait_for_timeout(200)
    A.click('#vwMenu button:has-text("Subrayar con una línea")'); A.wait_for_timeout(400)
    eq('⋯ → subrayar con una línea', A.evaluate("[vwAnns().length, vwAnns()[0].s, vwAnns()[0].t, !!document.querySelector('#vw .vwhl.u')]"), [1, 'u', 'ballena blanca', True])
    A.evaluate("vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(200)
    eq('la ventanita tiene los tres estilos', A.evaluate("[...document.querySelectorAll('#vwPop .lnsty button')].map(b => [b.textContent, b.classList.contains('on')])"), [['🖍', False], ['U̲', True], ['S̶', False]])
    A.wait_for_timeout(1600); A.click('#vwPop .lnsty button[title="Tachado"]'); A.wait_for_timeout(200)   # los cambios seguidos (< 1,5 s) son un solo paso de deshacer
    eq('cambiar a tachado', A.evaluate("[vwAnns()[0].s, !!document.querySelector('#vw .vwhl.x')]"), ['x', True])
    A.evaluate("undo()"); A.wait_for_timeout(200)
    eq('se deshace', A.evaluate("vwAnns()[0].s"), 'u')
    A.evaluate("vwPopClose()"); A.evaluate(SEL + "([0, 'linea 676'])"); A.evaluate("vwFromSel(2, false, 'x')"); A.evaluate(SEL + "([0, 'linea 652'])"); A.evaluate("vwFromSel(3)"); A.wait_for_timeout(200)
    eq('el estilo se guarda (y se limpia bien)', A.evaluate("annClean([{id: 'a', k: 'hl', p: 0, q: [1, 2, 3, 4], s: 'u'}, {id: 'b', k: 'area', p: 0, q: [1, 2, 3, 4], s: 'u'}, {id: 'c', k: 'hl', p: 0, q: [1, 2, 3, 4], s: 'zz'}]).map(a => a.s || '')"), ['u', '', ''])
    out = A.evaluate("""(async () => { const bytes = await vwPdfOut(VW.file, vwAnns()), L = await vwLib(), d = await L.getDocument({data: bytes}).promise, pg = await d.getPage(1);
      return (await pg.getAnnotations()).filter(a => /^gpapers-/.test(a.annotationName || '') || a.titleObj?.str === 'GPapers').map(a => a.subtype).filter(s => s !== 'Popup').sort(); })()""")
    eq('en el PDF anotado: Underline, StrikeOut y Highlight', out, ['Highlight', 'StrikeOut', 'Underline'])
    A.evaluate("""(async () => { const bytes = await vwPdfOut(VW.file, vwAnns()); db.papers.push(P('p2', 'Otro', {pdf: {name: 'otro.pdf'}})); PDF_FILES.set('p2', new File([bytes], 'otro.pdf', {type: 'application/pdf'})); })()"""); A.wait_for_timeout(300)
    A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("pdfOpen('p2', 1)"); A.wait_for_timeout(2500)
    eq('al traerlas de otro programa, con su estilo', A.evaluate("(VW.foreign || []).map(f => f.s || '').sort()"), ['', 'u', 'x'])
    A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    # ---- Recorte
    A.evaluate("vwRdSet('crop', 1)"); A.wait_for_timeout(1500)
    auto = A.evaluate("VW.cropM && Math.round(VW.cropM.l)")
    eq('recorte automático', [auto > 50, A.evaluate("!!vwCropOn()")], [True, True])
    reopen()
    eq('al volver a abrir, el recorte sigue puesto', A.evaluate("[!!vwCropOn(), Math.round(VW.cropM?.l || 0)]"), [True, auto])
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200); A.evaluate("vwReadMenu()"); A.wait_for_timeout(100)
    eq('Modo de lectura: ajustar el recorte y girar', A.evaluate("['Ajustar el recorte', 'Girar la página 1', 'Girar todas'].map(t => $('#vwMenu').textContent.includes(t))"), [True, True, True])
    A.evaluate("lnCropMenu()"); A.wait_for_timeout(100)
    eq('cuatro barras', A.evaluate("$('#vwMenu').querySelectorAll('.lncrop input').length"), 4)
    A.evaluate("lnCropSet('l', 40)"); A.wait_for_timeout(200)
    eq('a mano: se aplica y se guarda', A.evaluate("[VW.cropM.l, VW.cropM.hand, JSON.parse(localStorage.getItem('gp-vw-crop'))[vwSrcKey(VW.src)].l]"), [40, True, 40])
    reopen()
    eq('a mano: sigue al volver a abrir', A.evaluate("[Math.round(VW.cropM.l), !!VW.cropM.hand, !!vwCropOn()]"), [40, True, True])
    A.evaluate("lnCropAuto()"); A.wait_for_timeout(1500)
    eq('↺ vuelve al automático', A.evaluate("[Math.round(VW.cropM.l), !!VW.cropM.hand, (JSON.parse(localStorage.getItem('gp-vw-crop') || '{}'))[vwSrcKey(VW.src)] || null]"), [auto, False, None])
    A.evaluate("vwRdSet('crop', 0)"); A.wait_for_timeout(500)
    # ---- Girar
    A.evaluate("vwGo(0)"); A.wait_for_timeout(300)
    eq('antes de girar', A.evaluate("[Math.round(VW.pages[0].w), Math.round(VW.pages[0].h)]"), [595, 842])
    A.evaluate("lnRotate(0)"); A.wait_for_timeout(1500)
    eq('girar la página 1: se tumba (solo ella)', A.evaluate("[Math.round(VW.pages[0].w), Math.round(VW.pages[0].h), Math.round(VW.pages[1].w), vwRot(0), vwRot(1)]"), [842, 595, 595, 90, 0])
    eq('la capa de texto gira con ella', A.evaluate("document.querySelector('#vw .vwp[data-i=\"0\"] .textLayer')?.dataset.mainRotation"), '90')
    eq('el subrayado sigue encima de su texto (y ahora en vertical)', A.evaluate(OVER + "([vwAnns()[0].id, 'linea 700'])"), [True, True])
    A.evaluate(SEL + "([0, 'linea 604'])"); A.evaluate("vwFromSel(1)"); A.wait_for_timeout(300)
    eq('subrayar en la página girada', A.evaluate("(a => [a.t, a.q.length === 4 && a.q[0] > 100 && a.q[0] < 300 && a.q[1] > 590 && a.q[3] < 625])(vwAnns().at(-1))"), ['ballena blanca', True])
    reopen()
    eq('el giro se recuerda', A.evaluate("[vwRot(0), Math.round(VW.pages[0].w)]"), [90, 842])
    A.evaluate("lnRotate('*')"); A.wait_for_timeout(1200)
    eq('girar todas', A.evaluate("[vwRot(0), vwRot(1), vwRot(2), Math.round(VW.pages[1].w)]"), [180, 90, 90, 842])
    A.evaluate("lnRotate(null)"); A.wait_for_timeout(1200)
    eq('quitar los giros', A.evaluate("[vwRot(0), vwRot(1), Math.round(VW.pages[0].w), localStorage.getItem('gp-vw-rot')]"), [0, 0, 595, '{}'])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    # ---- EPUB
    A.evaluate(f"""(async () => {{ db.papers.push(P('p3', 'Libro', {{pdf: {{name: 'libro.epub'}}}})); PDF_FILES.set('p3', {EPF}); }})()"""); A.evaluate("pdfOpen('p3', 1)"); A.wait_for_timeout(1500)
    A.evaluate("""(() => { const p = EP.secs[0].querySelectorAll('p')[2], t = p.firstChild, r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 10); getSelection().removeAllRanges(); getSelection().addRange(r); epFromSel(0, false, 'x'); })()"""); A.wait_for_timeout(300)
    eq('EPUB: tachado', A.evaluate("[epAnns()[0].s, !!document.querySelector('#ep mark.eph.x')]"), ['x', True])
    A.evaluate("epPopOpen(epAnns()[0].id)"); A.wait_for_timeout(200); A.click('#epPop .lnsty button[title="Resaltado"]'); A.wait_for_timeout(200)
    eq('EPUB: volver a resaltado', A.evaluate("['s' in epAnns()[0], !!document.querySelector('#ep mark.eph.x')]"), [False, False])
    c.close()
    eq('sin errores en la página', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas')
sys.exit(1 if fail else 0)
