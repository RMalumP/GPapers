# Pruebas del visor (v39.40): recorte automático de márgenes, marcadores rápidos por paper y gestos de zoom (pellizco y doble toque),
# y que siguen bien doble página, página a página y el desplazamiento automático.
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
PORT = 8799
VIS = "[...document.querySelectorAll('#vw .vwp')].filter(p => p.offsetParent).map(p => +p.dataset.i)"
VISR = "(i => { const r = vwVisRect(VW.pages[i]); return [r.left, r.top, r.width, r.height]; })"
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
    # ---- submenú: recorte y gestos de zoom
    A.click('#vwMoreB'); A.wait_for_timeout(150)
    eq('⋯ tiene «🔖 Marcadores»', A.evaluate("[...document.querySelectorAll('#vwMenu button')].some(b => b.textContent.includes('🔖 Marcadores'))"), True)
    A.click("#vwMenu button[data-onclick=\"vwReadMenu()\"]"); A.wait_for_timeout(150)
    eq('el submenú tiene el recorte y los gestos de zoom', A.evaluate("['Recortar los márgenes', 'Gestos de zoom', 'Pellizcar', 'Doble toque'].map(t => $('#vwMenu').textContent.includes(t))"), [True, True, True, True])
    eq('gestos activados por defecto, recorte no', A.evaluate("[VW.crop, VW.zPinch, VW.zDbl]"), [False, True, True])
    w0 = A.evaluate(VISR + "(0)")
    s0 = A.evaluate("VW.scale")
    A.click("#vwMenu button[data-onclick=\"vwRdSet('crop',1)\"]"); A.wait_for_timeout(1200)
    eq('recorte: mide los márgenes', A.evaluate("!!(VW.cropM && VW.cropM.any)"), True)
    eq('recorte: se recuerda en el dispositivo', A.evaluate("JSON.parse(localStorage.getItem('gp-vw-read')).crop"), True)
    eq('recorte: la página se ve más grande al ajustar al ancho', A.evaluate("VW.scale") > s0 * 1.05, True)
    w1 = A.evaluate(VISR + "(0)")
    eq('recorte: lo visible sigue ocupando el ancho', abs(w1[2] - w0[2]) < 30, True)
    eq('recorte: sin barra horizontal', A.evaluate("(() => { const sc = $('#vwScroll'); return sc.scrollWidth <= sc.clientWidth; })()"), True)
    eq('recorte: el menú lo dice', A.evaluate("vwRdSum().includes('sin márgenes')"), True)
    # un subrayado sigue en su sitio: la caja del PDF se convierte igual con o sin recorte
    A.evaluate("vwAdd({id: 'hlx', k: 'hl', p: 0, q: [100, 600, 300, 615], c: '#ffd400', at: '', up: ''})"); A.wait_for_timeout(200)
    r1 = A.evaluate("(() => { const e = document.querySelector('#vwPages .vwhl[data-a=\"hlx\"]'), p = VW.pages[0], r = e.getBoundingClientRect(); return vwRectToPdf(p, r.left, r.top, r.right, r.bottom).map(Math.round); })()")
    eq('recorte: el subrayado sigue en las mismas coordenadas del PDF', r1, [100, 600, 300, 615])
    eq('recorte: tocar justo debajo del borde de arriba da la página 2 (no la 1)', A.evaluate("(() => { const r = vwVisRect(VW.pages[1]); return vwPageAt(r.left + 20, r.top + 3)?.i; })()"), 1)
    # doble página y página a página con recorte
    A.evaluate("vwRdSet('two', 1)"); A.wait_for_timeout(500)
    pos = A.evaluate("[1, 2].map(i => { const r = vwVisRect(VW.pages[i]); return [Math.round(r.top), Math.round(r.left), Math.round(r.right)]; })")
    eq('recorte + doble página: 2 y 3 en la misma fila, sin solaparse', [pos[0][0] == pos[1][0], pos[0][2] <= pos[1][1]], [True, True])
    eq('recorte + doble página: caben a lo ancho', A.evaluate("(() => { const sc = $('#vwScroll'); return sc.scrollWidth <= sc.clientWidth; })()"), True)
    A.evaluate("vwRdSet('two', 0); vwRdSet('flip', 1); vwGo(0, true)"); A.wait_for_timeout(500)
    eq('recorte + página a página: la página entera (sin márgenes) cabe', A.evaluate("(() => { const r = vwVisRect(VW.pages[0]), R = $('#vwScroll').getBoundingClientRect(); return [r.top >= R.top - 1, r.bottom <= R.bottom + 1, " + VIS + ".join()]; })()"), [True, True, '0'])
    R = A.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(400)
    eq('recorte + página a página: toque a la derecha pasa', A.evaluate("VW.cur"), 1)
    A.evaluate("vwRdSet('flip', 0); vwGo(0, true)"); A.wait_for_timeout(300)
    A.evaluate("vwGo(2, true)"); A.wait_for_timeout(300)
    eq('recorte: ir a una página deja su parte visible arriba', A.evaluate("(() => { const r = vwVisRect(VW.pages[2]), R = $('#vwScroll').getBoundingClientRect(); return Math.abs(r.top - R.top) <= 12 || $('#vwScroll').scrollTop + $('#vwScroll').clientHeight >= $('#vwScroll').scrollHeight - 2; })()"), True)
    A.evaluate("vwGo(0, true); vwAutoStart()"); A.wait_for_timeout(200); y0 = A.evaluate("$('#vwScroll').scrollTop"); A.wait_for_timeout(900)
    eq('recorte + automático: baja solo', A.evaluate("$('#vwScroll').scrollTop") > y0 + 3, True)
    A.evaluate("vwAutoStop()")
    A.evaluate("vwRdSet('crop', 0)"); A.wait_for_timeout(400)
    eq('quitar el recorte: vuelve la página entera', [A.evaluate("$('#vw').classList.contains('crop')"), abs(A.evaluate("VW.scale") - s0) < .01], [False, True])
    A.evaluate("vwDel('hlx')")
    # ---- marcadores
    A.evaluate("vwGo(1, true)"); A.wait_for_timeout(300); A.keyboard.press('b'); A.wait_for_timeout(200)
    eq('B marca la página (guardado en el PDF del paper)', A.evaluate("[db.papers[0].pdf.bm, VW.pages[1].el.classList.contains('bm')]"), [[1], True])
    A.evaluate("vwGo(2, true)"); A.wait_for_timeout(200)
    A.click('#vwMoreB'); A.wait_for_timeout(150); A.click("#vwMenu button[data-onclick=\"vwBmMenu()\"]"); A.wait_for_timeout(150)
    eq('submenú de marcadores: marcar esta página y la lista', A.evaluate("[$('#vwMenu').textContent.includes('Marcar la página 3'), $('#vwMenu').textContent.includes('Página 2')]"), [True, True])
    A.click("#vwMenu button[data-onclick=\"vwBmToggle()\"]"); A.wait_for_timeout(200)
    eq('marcar desde el menú', A.evaluate("db.papers[0].pdf.bm"), [1, 2])
    A.evaluate("vwGo(0, true)"); A.wait_for_timeout(200); A.keyboard.press(']'); A.wait_for_timeout(300)
    eq('] salta al siguiente marcador', A.evaluate("VW.cur"), 1)
    A.keyboard.press(']'); A.wait_for_timeout(300); eq('] otra vez, al siguiente', A.evaluate("VW.cur"), 2)
    A.keyboard.press('['); A.wait_for_timeout(300); eq('[ al anterior', A.evaluate("VW.cur"), 1)
    A.evaluate("vwRdSet('two', 1); vwRdSet('flip', 1); vwGo(0, true)"); A.wait_for_timeout(400)
    A.evaluate("vwBmStep(1)"); A.wait_for_timeout(300)
    eq('marcadores con doble página y página a página: se ve el par del marcador', A.evaluate(VIS), [1, 2])
    A.evaluate("vwRdSet('two', 0); vwRdSet('flip', 0)"); A.wait_for_timeout(300)
    A.evaluate("vwBmToggle(1)"); A.wait_for_timeout(100)
    eq('quitar un marcador', A.evaluate("db.papers[0].pdf.bm"), [2])
    A.evaluate("undo()"); A.wait_for_timeout(300)
    eq('deshacer devuelve el marcador (y se repinta)', A.evaluate("[db.papers[0].pdf.bm, VW.pages[1].el.classList.contains('bm')]"), [[1, 2], True])
    eq('pdfClean conserva los marcadores ordenados y sin repetir', A.evaluate("pdfClean({name: 'a.pdf', bm: [3, 1, 1, -2, 'x', 2.5]}).bm"), [1, 3])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    eq('al volver a abrir, siguen los marcadores', A.evaluate("VW.pages.filter(p => p.el.classList.contains('bm')).map(p => p.i)"), [1, 2])
    # ---- doble toque (ratón) fuera de pantalla completa: acerca y vuelve a ajustar
    A.evaluate("vwFitW(); vwGo(0, true)"); A.wait_for_timeout(300); fs0 = A.evaluate("VW.scale")
    R = A.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    pt = (R[0] + 30, R[1] + R[3] / 2)
    A.mouse.click(*pt); A.wait_for_timeout(80); A.mouse.click(*pt); A.wait_for_timeout(300)
    eq('doble toque: acerca', A.evaluate("VW.scale") > fs0 * 2, True)
    A.mouse.click(*pt); A.wait_for_timeout(80); A.mouse.click(*pt); A.wait_for_timeout(300)
    eq('otro doble toque: vuelve a ajustar', [A.evaluate("VW.fit"), abs(A.evaluate("VW.scale") - fs0) < .01], [True, True])
    A.evaluate("vwRdSet('zDbl', 0)"); A.mouse.click(*pt); A.wait_for_timeout(80); A.mouse.click(*pt); A.wait_for_timeout(300)
    eq('sin el gesto, el doble toque no hace nada', abs(A.evaluate("VW.scale") - fs0) < .01, True)
    A.evaluate("vwRdSet('zDbl', 1)")
    A.evaluate("vwClose()"); cA.close()
    # ---- móvil: pellizco y doble toque con el dedo
    cB, B = device(True)
    R = B.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    fs0 = B.evaluate("VW.scale"); x, y = R[0] + 30, R[1] + R[3] / 2
    B.touchscreen.tap(x, y); B.wait_for_timeout(100); B.touchscreen.tap(x, y); B.wait_for_timeout(400)
    eq('móvil: doble toque acerca', B.evaluate("VW.scale") > fs0 * 2, True)
    B.touchscreen.tap(x, y); B.wait_for_timeout(100); B.touchscreen.tap(x, y); B.wait_for_timeout(400)
    eq('móvil: otro doble toque vuelve a ajustar', abs(B.evaluate("VW.scale") - fs0) < .01, True)
    PINCH = """(f => { const sc = $('#vwScroll'), r = sc.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const T = (id, x) => new Touch({identifier: id, target: sc, clientX: x, clientY: cy});
      const ev = (t, L) => sc.dispatchEvent(new TouchEvent(t, {touches: L, targetTouches: L, changedTouches: L, bubbles: true, cancelable: true}));
      ev('touchstart', [T(1, cx - 50), T(2, cx + 50)]); ev('touchmove', [T(1, cx - 50 * f), T(2, cx + 50 * f)]); ev('touchend', []); return VW.scale; })"""
    s1 = B.evaluate(PINCH + "(1.8)")
    eq('móvil: pellizco acerca', s1 > fs0 * 1.5, True)
    B.evaluate("vwFitW(); vwRdSet('zPinch', 0)"); s2 = B.evaluate(PINCH + "(1.8)")
    eq('móvil: sin el gesto de pellizco, no cambia el zoom', abs(s2 - fs0) < .01, True)
    B.evaluate("vwRdSet('zPinch', 1); vwFs(true)"); B.wait_for_timeout(300)
    B.touchscreen.tap(x + 10, y); B.wait_for_timeout(100); B.touchscreen.tap(x + 10, y); B.wait_for_timeout(500)
    eq('móvil: en pantalla completa el doble toque sigue sacando los colores', [B.evaluate("!$('#vwCol').hidden"), abs(B.evaluate("VW.scale") - B.evaluate("VW.fitS")) < .01], [True, True])
    B.evaluate("vwFs(false); vwRdSet('crop', 1)"); B.wait_for_timeout(1200)
    eq('móvil: recorte sin barra horizontal', B.evaluate("(() => { const sc = $('#vwScroll'); return [VW.cropM.any, sc.scrollWidth <= sc.clientWidth]; })()"), [True, True])
    B.screenshot(path=str(pathlib.Path(os.environ.get('SHOTS', '/tmp')) / 'visor_extras_movil.png'))
    cB.close()
    eq('sin errores de página', errs, [])
    b.close(); srv.terminate()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
