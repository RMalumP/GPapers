# Pruebas del visor (v39.36+): deshacer en la barra, tiradores para alargar un subrayado, mover la página con el dedo fuera del texto en «Subrayar».
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
PORT = 8797
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0")
        p.evaluate(f"(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Paper con PDF', {{pdf: {{name: 'prueba.pdf'}}}})); PDF_FILES.set('p1', await {FILE}); markDirty(); render(); }})()")
        p.evaluate("pdfOpen('p1', 1)"); p.wait_for_timeout(1800); return c, p
    cA, A = device()
    # subrayado de una palabra de una línea larga
    A.evaluate("""(() => { const sp = [...document.querySelectorAll('#vw .vwp[data-i="0"] .textLayer span')].sort((a, b) => b.textContent.length - a.textContent.length)[0], t = sp.firstChild;
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, Math.min(4, t.length)); getSelection().removeAllRanges(); getSelection().addRange(r); window.SPT = sp.textContent; })()""")
    A.wait_for_timeout(400); A.evaluate("vwSelColor(0)"); A.wait_for_timeout(200)
    t0 = A.evaluate("vwAnns()[0].t")
    A.wait_for_timeout(1500); A.evaluate("vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(200)
    eq('los dos tiradores salen al abrir un subrayado', A.evaluate("[...document.querySelectorAll('#vw .vwhd')].filter(h => !h.hidden).length"), 2)
    h = A.evaluate("(() => { const r = document.querySelector('#vw .vwhd1').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    A.mouse.move(h[0], h[1]); A.mouse.down(); A.mouse.move(h[0] + 60, h[1], steps=6); A.mouse.move(h[0] + 120, h[1], steps=6); A.mouse.up(); A.wait_for_timeout(300)
    t1 = A.evaluate("vwAnns()[0].t")
    eq('arrastrar el tirador de detrás alarga el subrayado', len(t1) > len(t0) and t1.startswith(t0[:3]), True)
    eq('sigue siendo una sola anotación y la ventanita vuelve', A.evaluate("[vwAnns().length, !$('#vwPop').hidden]"), [1, True])
    A.click('#vw .vwun'); A.wait_for_timeout(300)
    eq('el botón ↶ deshace el alargado', A.evaluate("vwAnns()[0]?.t"), t0)
    eq('el botón deshacer está junto a «Seleccionar»', A.evaluate("document.querySelector('#vw .vwun').nextElementSibling.dataset.m"), 'sel')
    # notas al lado del PDF: solo la sección de notas y una cabecera que cabe en un panel estrecho
    A.evaluate("vwNotes()"); A.wait_for_timeout(500)
    eq('al lado del PDF solo están las notas (sin pestañas ni datos de la cita)', A.evaluate("[!!document.querySelector('#dlg .tabs'), !!document.querySelector('#dlg input[data-k=url]'), document.querySelectorAll('#dlg .ned, #dlg [data-ed]').length > 0 || /Notas generales/.test($('#dlg').textContent)]"), [False, False, True])
    A.evaluate("vwSplitSet(22)"); A.wait_for_timeout(300)
    eq('estrecho: título en una línea y los botones caben dentro del panel', A.evaluate("""(() => { const d = $('#dlg').getBoundingClientRect(), h = document.querySelector('#dlg .dh'), bs = [...h.querySelectorAll('.dbtn button')].filter(b => b.offsetParent);
      return [h.getBoundingClientRect().height < 60, bs.length >= 2, bs.every(b => { const r = b.getBoundingClientRect(); return r.right <= d.right + 1 && r.left >= d.left - 1; })]; })()"""), [True, True, True])
    A.evaluate("$('#dlg').close()"); A.wait_for_timeout(200)
    # pantalla completa
    A.evaluate("vwFs(true)"); A.wait_for_timeout(300)
    eq('pantalla completa: sin barra del título, con la de herramientas', A.evaluate("[getComputedStyle(document.querySelector('#vw .vwh')).display, getComputedStyle(document.querySelector('#vw .vwtb')).display, !$('#vwPgTip').hidden, $('#vwPgTip').textContent]"), ['none', 'flex', True, 'Página 1 de 3'])
    A.evaluate("vwTbHide(true)"); A.wait_for_timeout(100)
    eq('la barra se oculta y queda la pestaña ▾', A.evaluate("[getComputedStyle(document.querySelector('#vw .vwtb')).display, getComputedStyle($('#vwTbTab')).display]"), ['none', 'block'])
    gap = A.evaluate("(() => { const r = VW.pages[0].el.getBoundingClientRect(); return [r.left + 3, r.top + 3]; })()")
    A.mouse.click(gap[0], gap[1]); A.wait_for_timeout(80); A.mouse.click(gap[0], gap[1]); A.wait_for_timeout(500)
    eq('doble toque en zona vacía: menú de colores', A.evaluate("!$('#vwCol').hidden"), True)
    A.evaluate("$('#vwCol .vwc[data-c=\"2\"]').click()"); A.wait_for_timeout(100)
    eq('elegir color en el menú', A.evaluate("[VW.color, $('#vwCol').hidden]"), [2, True])
    for _ in range(3): A.mouse.click(gap[0], gap[1]); A.wait_for_timeout(60)
    A.wait_for_timeout(100)
    eq('tres toques: se ven las dos barras', A.evaluate("[getComputedStyle(document.querySelector('#vw .vwh')).display, getComputedStyle(document.querySelector('#vw .vwtb')).display, $('#vwCol').hidden]"), ['flex', 'flex', True])
    A.wait_for_timeout(3200)
    eq('a los 3 s se vuelven a ocultar', A.evaluate("getComputedStyle(document.querySelector('#vw .vwh')).display"), 'none')
    A.mouse.move(gap[0], gap[1]); A.mouse.down(); A.wait_for_timeout(700); A.mouse.up()
    eq('pulsación larga: barras', A.evaluate("$('#vw').classList.contains('fsbars')"), True)
    A.evaluate("vwGo(2, true)"); A.wait_for_timeout(300)
    eq('al cambiar de página: «Página 3 de 3»', A.evaluate("[!$('#vwPgTip').hidden, $('#vwPgTip').textContent]"), [True, 'Página 3 de 3'])
    A.go_back(); A.wait_for_timeout(400)
    eq('«atrás» sale de pantalla completa sin cerrar el visor', A.evaluate("[VW.fs, $('#vw').open, getComputedStyle(document.querySelector('#vw .vwh')).display]"), [False, True, 'flex'])
    A.evaluate("vwFs(true)"); A.wait_for_timeout(200); A.keyboard.press('Escape'); A.wait_for_timeout(300)
    eq('Esc sale de pantalla completa sin cerrar el visor', A.evaluate("[VW.fs, $('#vw').open]"), [False, True])
    A.go_back(); A.wait_for_timeout(400)
    eq('y luego «atrás» cierra el visor', A.evaluate("$('#vw').open"), False)
    # móvil: en «Subrayar», arrastrar con el dedo fuera del texto mueve la página
    cB, B = device(True)
    B.evaluate("vwMode('hl'); vwZoomBy(2)"); B.wait_for_timeout(600)
    st = B.evaluate("""(() => { const sc = $('#vwScroll'), r = VW.pages[0].el.getBoundingClientRect(), R = sc.getBoundingClientRect(), x = Math.max(r.left, R.left) + 20, y = Math.max(r.top, R.top) + 6;
      const ev = (t, yy) => sc.dispatchEvent(new PointerEvent(t, {pointerId: 7, pointerType: 'touch', clientX: x, clientY: yy, bubbles: true, isPrimary: true}));
      const el = document.elementFromPoint(x, y); const t0 = sc.scrollTop; el.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true}));
      ev('pointermove', y - 80); ev('pointerup', y - 80); return [!!el.closest('.textLayer span'), sc.scrollTop - t0, vwAnns().length]; })()""")
    eq('fuera del texto, el dedo mueve la página y no subraya', [st[0], st[1] >= 70, st[2]], [False, True, 0])
    eq('palabras enteras con el dedo', B.evaluate("(() => { const n = document.createTextNode('hola mundo'); const a = vwSnap({n, o: 2}, true), z = vwSnap({n, o: 7}, false); return [a.o, z.o]; })()"), [0, 10])
    eq('sin errores', errs, [])
    srv.kill(); b.close()
print(f'{n - fail}/{n} pruebas de las fases del visor'); sys.exit(1 if fail else 0)
