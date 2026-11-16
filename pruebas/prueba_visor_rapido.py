# Pruebas del visor (v39.44): un PDF largo con muchos subrayados se abre al momento y la app sigue respondiendo (antes cada página
# con subrayados repintaba todas y se quedaba colgada); los subrayados de cada página se pintan al acercarse a ella; y, en pantalla
# completa, sacar la barra oculta con la pestaña ▾ no mueve la hoja (la barra flota encima).
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
MKPDF = """async NP => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < NP; i++) { const p = d.addPage([595, 842]); for (let y = 780; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y}`, {x: 60, y, size: 12, font: f}); }
  return new File([await d.save()], 'largo.pdf', {type: 'application/pdf'}); }"""
SEED = """async ([NP, NA]) => { db.settings.pdfTab = 'app'; db.papers.length = 0; const ann = [];
  for (let k = 0; k < NA; k++) { const pg = k % NP, y = 780 - 24 * ((k / NP | 0) % 28); ann.push({id: 'a' + k, k: 'hl', p: pg, c: '#ffd400', t: 'texto ' + k, m: k % 3 ? '' : 'comentario ' + k, q: [60, y - 3, 400, y + 11, 60, y - 27, 300, y - 13], up: '2026-01-01T00:00:00Z'}); }
  db.papers.push(P('p1', 'Largo', {pdf: {name: 'largo.pdf', ann}})); PDF_FILES.set('p1', await MKPDF(NP)); markDirty(); render(); }"""
PORT = 8806
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False, NP=8, NA=0):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': 1400, 'height': 850}, service_workers='block')
        p = c.new_page(); p.set_default_timeout(20000); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0"); p.evaluate(f"window.MKPDF = {MKPDF}; 0")
        p.evaluate(SEED, [NP, NA]); return c, p
    # ---- PDF largo con muchos subrayados
    NP, NA = 120, 600
    cA, A = device(NP=NP, NA=NA)
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(2500); A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("vwKeepDrop()")   # la segunda vez, con los tamaños guardados (el caso que se colgaba)
    A.evaluate("""() => { window.CNT = 0; const d = vwDrawAnn; vwDrawAnn = (...a) => { CNT++; return d(...a); }; window.LT = []; window.T0 = performance.now();
      new PerformanceObserver(l => l.getEntries().forEach(e => LT.push(Math.round(e.duration)))).observe({type: 'longtask'}); pdfOpen('p1', 1); }""")
    t = time.time(); A.wait_for_function("() => !!document.querySelector('#vw .vwcv')", timeout=15000); A.wait_for_timeout(1500)
    resp = A.evaluate("(() => { const t = performance.now(); return new Promise(r => setTimeout(() => r(Math.round(performance.now() - t)), 0)); })()")
    eq('con los tamaños guardados', A.evaluate("VW.szOk"), True)
    eq('la app responde al momento mientras se abre (sin bloqueos largos)', [resp < 200, A.evaluate("Math.max(0, ...LT) < 400")], [True, True])
    eq('los subrayados se pintan una sola vez al abrir (no una vez por página)', A.evaluate("CNT"), 1)
    eq('solo se pintan los subrayados de las páginas cercanas', A.evaluate(f"(() => {{ const pg = new Set([...document.querySelectorAll('#vw .vwhl')].map(e => +e.closest('.vwp').dataset.i)); return [pg.has(0), pg.size > 0 && pg.size < 12]; }})()"), [True, True])
    eq('cada página se pide una sola vez (sin peticiones colgando)', A.evaluate("VW.pages.filter(p => p.annGet).length"), 0)
    eq('el panel lista todas, ordenadas por página', A.evaluate(f"(() => {{ vwSide(true); const L = [...document.querySelectorAll('#vwSide .vwsl .vwi small')].map(e => +e.textContent.match(/p\\. (\\d+)/)[1]); return [L.length, L.every((v, i) => !i || L[i - 1] <= v)]; }})()"), [NA, True])
    A.evaluate("vwGo(80, true)"); A.wait_for_timeout(1500)
    eq('al ir a una página lejana se pintan sus subrayados (y su 💬)', A.evaluate("[document.querySelectorAll('#vw .vwp[data-i=\"81\"] .vwhl').length, document.querySelectorAll('#vw .vwp[data-i=\"81\"] .vwcmk').length]"), [10, 5])
    eq('cada subrayado cae en su sitio', A.evaluate("(() => { const p = VW.pages[80], e = p.el.querySelector('.vwhl[data-a=\"a80\"]'), r = e.getBoundingClientRect(), R = p.el.getBoundingClientRect(), k = R.width / 595; return [Math.round((r.left - R.left) / k), Math.round((r.top - R.top) / k)]; })()"), [60, 51])
    A.evaluate("vwJump('a110')"); A.wait_for_timeout(1500)
    eq('saltar desde el panel a una página que aún no se había leído', A.evaluate("[VW.cur, !!document.querySelector('#vw .vwp[data-i=\"110\"] .vwhl[data-a=\"a110\"]'), VW.pop]"), [110, True, 'a110'])
    A.evaluate("vwPopClose(); vwUpd('a110', {c: '#5fd068'})"); A.wait_for_timeout(200)
    eq('cambiar uno repinta bien su página', A.evaluate("getComputedStyle(document.querySelector('#vw .vwhl[data-a=\"a110\"]')).getPropertyValue('--c').trim()"), '#5fd068')
    A.evaluate("vwDel('a110')"); A.wait_for_timeout(200)
    eq('y borrarlo lo quita', A.evaluate("document.querySelectorAll('#vw [data-a=\"a110\"]').length"), 0)
    cA.close()
    # ---- Pantalla completa: sacar la barra con la pestaña ▾ no mueve la hoja
    RECT = "(() => { const r = VW.pages[VW.cur].el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })()"
    def fs_case(page, name, setup, mobile=False):
        page.evaluate("pdfOpen('p1', 1)"); page.wait_for_timeout(1500); page.evaluate(setup); page.wait_for_timeout(300)
        page.evaluate("vwFs(true)"); page.wait_for_timeout(500)
        page.evaluate("vwTbHide(true)"); page.wait_for_timeout(500); r0 = page.evaluate(RECT)
        page.click('#vwTbTab'); page.wait_for_timeout(500)
        eq(f'{name}: la pestaña ▾ saca la barra', page.evaluate("[getComputedStyle(vw$('.vwtb')).display !== 'none', $('#vwTbTab').offsetParent === null]"), [True, True])
        eq(f'{name}: la hoja no se mueve ni cambia de tamaño al sacar la barra', page.evaluate(RECT), r0)
        page.evaluate("vwTbHide(true)"); page.wait_for_timeout(500)
        eq(f'{name}: ni al volver a ocultarla', page.evaluate(RECT), r0)
        page.evaluate("vwBars()"); page.wait_for_timeout(300)
        eq(f'{name}: las dos barras de 3 s tampoco la mueven, y no se tapan entre ellas', [page.evaluate(RECT), page.evaluate("mv => mv || Math.round(vw$('.vwtb').getBoundingClientRect().top) >= Math.round(vw$('.vwh').getBoundingClientRect().bottom) - 1", mobile)], [r0, True])
        page.evaluate("vwFs(false)"); page.wait_for_timeout(400)
        eq(f'{name}: al salir, la barra vuelve a su sitio', page.evaluate("[getComputedStyle(vw$('.vwtb')).position, $('#vw').classList.contains('tbx')]"), ['static', False])
        page.evaluate("vwClose()"); page.wait_for_timeout(300)
    cB, B = device(NP=8)
    fs_case(B, 'página a página ajustada', "vwRdSet('flip', true)")
    fs_case(B, 'página a página con el candado', "vwRdSet('flip', true); vwLockSet(true, true)")
    fs_case(B, 'seguido', "vwRdSet('flip', false)")
    cB.close()
    cM, M = device(mobile=True, NP=8)
    fs_case(M, 'móvil, página a página', "vwRdSet('flip', true)", True)
    eq('sin errores', errs, [])
    b.close(); srv.kill()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
