# Pruebas del visor (v39.49): los tiradores de un subrayado ya hecho funcionan aunque su otro extremo quede fuera de la pantalla
# (con zoom, sobre todo con el 🔒 candado, que no deja mover la hoja), con y sin modo ligero; con el dedo van por palabras enteras.
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
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
PORT = 8815
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
    for lab, lock, lite in [('sin candado', False, 'off'), ('con candado', True, 'off'), ('con candado y modo ligero', True, 'on')]:
        cA, A, cdp = device('Pixel 7', f"localStorage.setItem('gp-vw-lite', '{lite}');"); seed(A, 4, 0)
        A.evaluate("vwRdSet('flip', true)"); A.wait_for_timeout(800); A.evaluate("VW.fit = false; vwScaleSet(VW.scale * 2.5)"); A.wait_for_timeout(1500)
        A.evaluate("""(() => { const sp = [...document.querySelectorAll('#vw .vwp[data-i="0"] .textLayer span')].find(s => s.textContent.includes('linea 708')); const t = sp.firstChild, r = document.createRange(); r.setStart(t, 0); r.setEnd(t, t.data.indexOf('aqui')); getSelection().removeAllRanges(); getSelection().addRange(r); vwFromSel(0); })()""")
        A.wait_for_timeout(1000)
        A.evaluate("""(() => { const l = [...document.querySelectorAll('#vw .vwhl')].at(-1).getBoundingClientRect(), sc = $('#vwScroll'); sc.scrollLeft += l.right - innerWidth + 60; sc.scrollTop += l.top - 300; })()""")
        A.wait_for_timeout(800)
        if lock: A.evaluate("vwLockSet(true, true)"); A.wait_for_timeout(300)
        eq(lab + ': el principio del subrayado queda fuera de la pantalla', [A.evaluate("document.querySelector('#vw .vwhl').getBoundingClientRect().left") < 0, A.evaluate("[!!VW.zLock, !!VW.lite]")], [True, [lock, lite == 'on']])
        A.evaluate("vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(500)
        eq(lab + ': salen los dos tiradores', A.evaluate("[...document.querySelectorAll('#vw .vwhd:not(.tsh)')].filter(h => !h.hidden).length"), 2)
        h = A.evaluate("(r => [r.left + r.width/2, r.top + r.height/2])(document.querySelector('#vw .vwhd1:not(.tsh)').getBoundingClientRect())")
        touch(cdp, 'touchStart', h[0], h[1]); A.wait_for_timeout(50)
        for k in range(1, 7): touch(cdp, 'touchMove', h[0] - 25 * k, h[1]); A.wait_for_timeout(50)
        touch(cdp, 'touchEnd'); A.wait_for_timeout(600)
        eq(lab + ': el tirador de detrás lo acorta (por palabras enteras)', A.evaluate("[vwAnns().length, vwAnns()[0].t]"), [1, 'Pagina 1 linea 708 palabras para'])
        eq(lab + ': la ventanita vuelve', A.evaluate("!$('#vwPop').hidden"), True)
        if lock: eq(lab + ': y la hoja no se ha movido del sitio', A.evaluate("VW.zLock"), True)
        cA.close()
    # la opción de v39.48 (dejarlos fijos) ya no está
    cA, A, cdp = device('Pixel 7'); seed(A, 2, 0)
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200); A.evaluate("vwCfgMenu()"); A.wait_for_timeout(150)
    eq('⚙ ya no lleva «Límites de un subrayado ya hecho»', A.evaluate("$('#vwMenu').textContent.includes('Límites de un subrayado')"), False)
    cA.close()
    eq('sin errores en la página', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas')
sys.exit(1 if fail else 0)
