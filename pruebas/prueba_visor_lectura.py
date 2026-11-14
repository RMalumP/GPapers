# Pruebas del modo de lectura del visor (v39.39): submenú en ⋯, doble página, página a página con toques y desplazamiento automático.
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
PORT = 8798
VIS = "[...document.querySelectorAll('#vw .vwp')].filter(p => p.offsetParent).map(p => +p.dataset.i)"
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
    # el submenú dentro de ⋯
    A.click('#vwMoreB'); A.wait_for_timeout(150)
    eq('⋯ tiene «📖 Modo de lectura» arriba', A.evaluate("$('#vwMenu button').textContent.trim().startsWith('📖 Modo de lectura')"), True)
    A.click('#vwMenu button[data-keep]'); A.wait_for_timeout(150)
    eq('abre el submenú sin cerrarse', A.evaluate("[!$('#vwMenu').hidden, /Doble página/.test($('#vwMenu').textContent), /Desplazamiento automático/.test($('#vwMenu').textContent), /Página a página/.test($('#vwMenu').textContent)]"), [True, True, True, True])
    A.click('#vwMenu button[data-keep]'); A.wait_for_timeout(150)
    eq('«‹ Volver» regresa al menú ⋯', A.evaluate("[!$('#vwMenu').hidden, /Descargar el PDF/.test($('#vwMenu').textContent)]"), [True, True])
    A.click('#vwMenu button[data-keep]'); A.wait_for_timeout(150)
    A.click("#vwMenu button[data-onclick=\"vwRdSet('two',1)\"]"); A.wait_for_timeout(500)
    # doble página: portada sola, luego 2-3
    pos = A.evaluate("VW.pages.map(p => { const r = p.el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left)]; })")
    eq('el menú se cierra al elegir', A.evaluate("$('#vwMenu').hidden"), True)
    eq('doble página con portada: la 2 y la 3 en la misma fila, la 1 sola arriba', [pos[1][0] == pos[2][0], pos[0][0] < pos[1][0], pos[1][1] < pos[2][1]], [True, True, True])
    eq('las dos páginas caben a lo ancho', A.evaluate("(() => { const sc = $('#vwScroll'); return sc.scrollWidth <= sc.clientWidth; })()"), True)
    eq('se recuerda en el dispositivo', A.evaluate("JSON.parse(localStorage.getItem('gp-vw-read'))"), {'two': True, 'cover': True, 'flip': False})
    A.evaluate("vwRdSet('cover', 0)"); A.wait_for_timeout(300)
    pos = A.evaluate("VW.pages.map(p => Math.round(p.el.getBoundingClientRect().top))")
    eq('sin portada: la 1 y la 2 juntas', pos[0] == pos[1] and pos[2] > pos[0], True)
    A.keyboard.press('ArrowRight'); A.wait_for_timeout(300)
    eq('→ va al par siguiente (página 3)', A.evaluate("VW.cur"), 2)
    # página a página
    A.evaluate("vwRdSet('two', 0); vwRdSet('flip', 1); vwGo(0, true)"); A.wait_for_timeout(500)
    eq('página a página: solo se ve una', A.evaluate(VIS), [0])
    eq('la página entera cabe a la vista', A.evaluate("(() => { const sc = $('#vwScroll'), r = VW.pages[0].el.getBoundingClientRect(), R = sc.getBoundingClientRect(); return r.bottom <= R.bottom + 1 && r.top >= R.top - 1; })()"), True)
    R = A.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(400)
    eq('toque a la derecha: siguiente página', [A.evaluate("VW.cur"), A.evaluate(VIS), A.evaluate("$('#vwPg').value")], [1, [1], '2'])
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(400)
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(400)
    eq('en la última no pasa de ahí', A.evaluate("VW.cur"), 2)
    A.mouse.click(R[0] + R[2] * .1, R[1] + R[3] / 2); A.wait_for_timeout(400)
    eq('toque a la izquierda: anterior', A.evaluate("VW.cur"), 1)
    A.mouse.click(R[0] + R[2] * .5, R[1] + R[3] / 2); A.wait_for_timeout(400)
    eq('toque en el centro: no pasa de página', A.evaluate("VW.cur"), 1)
    eq('la página que se ve está pintada', A.evaluate("!!VW.pages[1].cv"), True)
    A.evaluate("vwRdSet('two', 1); vwRdSet('cover', 1); vwGo(0, true)"); A.wait_for_timeout(400)
    A.keyboard.press('ArrowRight'); A.wait_for_timeout(400)
    eq('página a página con doble página: se ve el par 2-3', A.evaluate(VIS), [1, 2])
    A.evaluate("vwRdSet('two', 0)"); A.wait_for_timeout(300)
    # desplazamiento automático (pasa a la vista seguida)
    A.evaluate("vwZoomBy(2); vwGo(0, true)"); A.wait_for_timeout(300)
    A.evaluate("vwAutoStart()"); A.wait_for_timeout(300)
    eq('el automático usa la vista seguida y saca la barra de abajo', A.evaluate("[VW.flip, !$('#vwAuto').hidden, $('#vwAutoV').textContent]"), [False, True, '7'])
    eq('la barra está abajo', A.evaluate("(() => { const b = $('#vwAuto').getBoundingClientRect(), s = $('#vwScroll').getBoundingClientRect(); return b.bottom > s.bottom - 40 && b.bottom <= s.bottom; })()"), True)
    y0 = A.evaluate("$('#vwScroll').scrollTop"); A.wait_for_timeout(1200); y1 = A.evaluate("$('#vwScroll').scrollTop")
    eq('baja solo', y1 > y0 + 5, True)
    A.evaluate("vwAutoSet(15)"); A.wait_for_timeout(100); a = A.evaluate("$('#vwScroll').scrollTop"); A.wait_for_timeout(1000); c = A.evaluate("$('#vwScroll').scrollTop")
    eq('más velocidad, baja más', c - a > (y1 - y0) * 1.5, True)
    A.click('#vwAuto .vwap'); A.wait_for_timeout(100); a = A.evaluate("$('#vwScroll').scrollTop"); A.wait_for_timeout(600)
    eq('⏸ pausa', [A.evaluate("$('#vwScroll').scrollTop") == a, A.evaluate("$('#vwAuto .vwap').textContent")], [True, '▶'])
    A.mouse.click(R[0] + R[2] * .5, R[1] + R[3] / 2); A.wait_for_timeout(150)
    eq('toque en el centro: sigue', A.evaluate("[VW.autoPaused, $('#vwAuto .vwap').textContent]"), [False, '⏸'])
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(150)
    eq('toque a la derecha: más deprisa', A.evaluate("VW.autoLv"), 16)
    A.mouse.click(R[0] + R[2] * .1, R[1] + R[3] / 2); A.wait_for_timeout(150); A.mouse.click(R[0] + R[2] * .1, R[1] + R[3] / 2); A.wait_for_timeout(150)
    eq('toque a la izquierda: más despacio (y se recuerda)', A.evaluate("[VW.autoLv, localStorage.getItem('gp-vw-auto'), $('#vwAutoR').value]"), [14, '14', '14'])
    A.keyboard.press(' '); A.wait_for_timeout(100)
    eq('la barra espaciadora pausa', A.evaluate("VW.autoPaused"), True)
    A.evaluate("vwRdSet('flip', 1)"); A.wait_for_timeout(200)
    eq('al pasar a página a página se para', A.evaluate("[VW.auto, $('#vwAuto').hidden]"), [False, True])
    A.evaluate("vwRdSet('flip', 0); vwAutoStart(); const sc = $('#vwScroll'); sc.scrollTop = sc.scrollHeight"); A.wait_for_timeout(500)
    eq('al llegar al final se pausa', A.evaluate("VW.autoPaused"), True)
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    eq('al cerrar el visor se para', A.evaluate("VW.auto"), False)
    # se recuerda al volver a abrir
    A.evaluate("localStorage.setItem('gp-vw-read', JSON.stringify({two: true, cover: true, flip: true})); pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    eq('al abrir, el modo guardado (página a página, doble) y en el par de la página donde lo dejaste', A.evaluate(VIS), [1, 2])
    A.evaluate("vwClose()"); cA.close()
    # móvil: toques con el dedo
    cB, B = device(True)
    B.evaluate("vwRdSet('flip', 1); vwGo(0, true)"); B.wait_for_timeout(500)
    R = B.evaluate("(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    B.touchscreen.tap(R[0] + R[2] * .92, R[1] + R[3] / 2); B.wait_for_timeout(400)
    eq('móvil: toque a la derecha, siguiente página', B.evaluate("VW.cur"), 1)
    B.evaluate("vwRdSet('flip', 0); vwAutoStart()"); B.wait_for_timeout(300)
    eq('móvil: la barra del automático cabe y queda encima de la barra de herramientas', B.evaluate("(() => { const a = $('#vwAuto').getBoundingClientRect(), t = document.querySelector('#vw .vwtb').getBoundingClientRect(); return [a.bottom <= t.top, a.left >= 0, a.right <= innerWidth]; })()"), [True, True, True])
    B.touchscreen.tap(R[0] + R[2] * .5, R[1] + R[3] / 2); B.wait_for_timeout(200)
    eq('móvil: toque en el centro, pausa', B.evaluate("VW.autoPaused"), True)
    B.screenshot(path=str(pathlib.Path(os.environ.get('SHOTS', '/tmp')) / 'lectura_movil.png'))
    cB.close()
    eq('sin errores de página', errs, [])
    b.close(); srv.terminate()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
