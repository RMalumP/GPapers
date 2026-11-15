# Pruebas del visor (v39.41): caché para papers largos (tamaños de página, PDF recién cerrado, memoria), recordar dónde ibas (también al salir
# de la app), modo concentración (submenú del desplazamiento automático), más atajos de teclado y tamaño del texto de la interfaz.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
# un PDF largo hecho con pdf-lib: 40 páginas A4 y 40 apaisadas, con texto
LONG = """(async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < 80; i++) { const p = d.addPage(i < 40 ? [595, 842] : [792, 612]); for (let y = 760; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y}`, {x: 60, y: Math.min(y, p.getHeight() - 40), size: 12, font: f}); }
  return new File([await d.save()], 'largo.pdf', {type: 'application/pdf'}); })()"""
FILE = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
PORT = 8801
SCR = "(() => { const r = $('#vwScroll').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()"
VISB = "(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; })"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0")
        p.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Paper largo', {{pdf: {{name: 'largo.pdf'}}}}), P('p2', 'Paper corto', {{pdf: {{name: 'prueba.pdf'}}}}));
          PDF_FILES.set('p1', await {LONG}); PDF_FILES.set('p2', await {FILE}); markDirty(); render(); }})()""")
        return c, p
    cA, A = device()
    A.evaluate("window.LOADS = 0; const f0 = vwLoadDoc; window.vwLoadDoc = (...a) => { LOADS++; return f0(...a); }; 0")
    # ---- caché de tamaños de página
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(2500)
    eq('PDF largo: 80 páginas', A.evaluate("VW.pages.length"), 80)
    eq('la primera vez se miden las páginas (sin caché)', A.evaluate("VW.szOk"), False)
    sz = A.evaluate("JSON.parse(localStorage.getItem('gp-vw-sz') || '{}')[pdfKey('p1', 1)]")
    eq('tamaños guardados en tramos (2 tramos para 80 páginas)', [sz and sz['n'], sz and [t[0] for t in sz['t']]], [80, [40, 40]])
    # ---- reabrir el mismo PDF: no se vuelve a leer, y sale con los tamaños ya puestos
    A.evaluate("vwClose()"); A.wait_for_timeout(200)
    eq('el PDF cerrado se queda leído un rato', A.evaluate("VW_KEEP.k?.key === pdfKey('p1', 1)"), True)
    A.evaluate("window.T0 = performance.now(); pdfOpen('p1', 1)"); A.wait_for_timeout(1200)
    eq('al reabrirlo no se vuelve a leer el archivo', A.evaluate("LOADS"), 1)
    eq('al reabrirlo usa los tamaños guardados (sin medir)', A.evaluate("[VW.szOk, Math.round(VW.pages[50].w), Math.round(VW.pages[50].h), VW.pages[50].sized]"), [True, 792, 612, False])
    # ---- memoria: pocos lienzos a la vez aunque se recorra todo
    A.evaluate("vwGo(60, true)"); A.wait_for_timeout(800); A.evaluate("vwGo(20, true)"); A.wait_for_timeout(800)
    eq('papers largos: como mucho 14 lienzos pintados', A.evaluate("VW.pages.filter(p => p.cv).length") <= 14, True)
    eq('las páginas apaisadas se ven con su tamaño', A.evaluate("Math.round(VW.pages[60].el.offsetWidth / VW.pages[0].el.offsetWidth * 100)"), round(792 / 595 * 100))
    # ---- otro PDF: el guardado ya no sirve
    A.evaluate("vwClose()"); A.wait_for_timeout(200); A.evaluate("pdfOpen('p2', 1)"); A.wait_for_timeout(1500)
    eq('abrir otro PDF lo lee (y suelta el anterior)', [A.evaluate("LOADS"), A.evaluate("VW_KEEP.k")], [2, None])
    A.evaluate("vwClose()"); A.wait_for_timeout(200)
    # ---- recordar dónde ibas, también al salir de la app con el visor abierto
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
    A.evaluate("vwGo(30, true); const p = VW.pages[30], sc = $('#vwScroll'); sc.scrollTop = p.el.offsetTop + p.el.offsetHeight * .4; vwOnScroll()"); A.wait_for_timeout(300)
    A.evaluate("Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden")
    eq('al salir de la app con el visor abierto se guarda la página', A.evaluate("[VW.open, db.papers[0].pdf.page]"), [True, 31])
    pos = A.evaluate("JSON.parse(localStorage.getItem('gp-vw-pos'))[pdfKey('p1', 1)]")
    eq('y el punto dentro de la página (en el dispositivo)', [pos[0], abs(pos[1] - .4) < .05], [30, True])
    A.evaluate("vwClose()"); A.wait_for_timeout(200); A.evaluate("vwKeepDrop(); pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    eq('al volver a abrirlo sigue en la misma página', A.evaluate("VW.cur"), 30)
    eq('y en el mismo punto de la página', abs(A.evaluate("vwAnchor().f") - .4) < .05, True)
    eq('avisa de dónde sigue, con «Ir al principio»', A.evaluate("(() => { const t = $('#toast'); return !!t && !t.hidden && t.textContent.includes('Sigues en la página 31') && t.textContent.includes('Ir al principio'); })()"), True)
    A.evaluate("vwGo(0, true)"); A.wait_for_timeout(200)
    # ---- modo concentración, como submenú del desplazamiento automático
    A.click('#vwMoreB'); A.wait_for_timeout(150); A.click("#vwMenu button[data-onclick=\"vwReadMenu()\"]"); A.wait_for_timeout(150)
    eq('Modo de lectura: el automático es un submenú', A.evaluate("!!document.querySelector('#vwMenu button[data-onclick=\"vwAutoMenu()\"]')"), True)
    A.click("#vwMenu button[data-onclick=\"vwAutoMenu()\"]"); A.wait_for_timeout(150)
    eq('el submenú tiene empezar, velocidad y modo concentración', A.evaluate("['Empezar el desplazamiento automático', 'Velocidad', 'Modo concentración', '‹ Volver'].map(t => $('#vwMenu').textContent.includes(t))"), [True, True, True, True])
    A.click("#vwMenu button[data-onclick=\"vwConcSet(1)\"]"); A.wait_for_timeout(400)
    eq('activar la concentración empieza el automático y oculta barras y menús', [A.evaluate("VW.auto"), A.evaluate("$('#vw').classList.contains('conc')"), A.evaluate(VISB + "('#vw .vwh')"), A.evaluate(VISB + "('#vw .vwtb')"), A.evaluate(VISB + "('#vwAuto')"), A.evaluate(VISB + "('#vwMenu')")], [True, True, False, False, False, False])
    eq('se recuerda en el dispositivo', A.evaluate("localStorage.getItem('gp-vw-conc')"), '1')
    y0 = A.evaluate("$('#vwScroll').scrollTop"); A.wait_for_timeout(700)
    eq('sigue bajando sola', A.evaluate("$('#vwScroll').scrollTop") > y0 + 3, True)
    R = A.evaluate(SCR)
    A.mouse.click(R[0] + R[2] * .9, R[1] + R[3] / 2); A.wait_for_timeout(200)
    eq('un toque (aunque sea en un lado) saca las barras y pausa', [A.evaluate("VW.autoPaused"), A.evaluate("$('#vw').classList.contains('conc')"), A.evaluate(VISB + "('#vw .vwh')"), A.evaluate(VISB + "('#vwAuto')"), A.evaluate("VW.autoLv")], [True, False, True, True, 7])
    A.mouse.click(R[0] + R[2] / 2, R[1] + R[3] / 2); A.wait_for_timeout(200)
    eq('toque en el centro: sigue y vuelve a ocultarlas', [A.evaluate("VW.autoPaused"), A.evaluate("$('#vw').classList.contains('conc')")], [False, True])
    A.keyboard.press('Escape'); A.wait_for_timeout(200)
    eq('Esc saca las barras (y no cierra el visor)', [A.evaluate("VW.open"), A.evaluate("VW.autoPaused"), A.evaluate("$('#vw').classList.contains('conc')")], [True, True, False])
    A.keyboard.press(' '); A.wait_for_timeout(150)
    eq('la barra espaciadora sigue (y las oculta)', A.evaluate("$('#vw').classList.contains('conc')"), True)
    A.keyboard.press('c'); A.wait_for_timeout(150)
    eq('tecla C: quita la concentración (el automático sigue)', [A.evaluate("VW.auto"), A.evaluate("$('#vw').classList.contains('conc')"), A.evaluate("localStorage.getItem('gp-vw-conc')"), A.evaluate("$('#vwAuto .vwcb').classList.contains('on')")], [True, False, '0', False])
    A.click('#vwAuto .vwcb'); A.wait_for_timeout(150)
    eq('botón 🧘 de la barra del automático: la vuelve a poner', A.evaluate("$('#vw').classList.contains('conc')"), True)
    A.evaluate("vwAutoStop()"); A.wait_for_timeout(100)
    eq('al parar el automático vuelven las barras', [A.evaluate("$('#vw').classList.contains('conc')"), A.evaluate(VISB + "('#vw .vwh')")], [False, True])
    # ---- más atajos de teclado
    A.evaluate("document.activeElement?.blur()")
    A.keyboard.press('h'); eq('H: subrayar', A.evaluate("VW.mode"), 'hl')
    A.keyboard.press('r'); eq('R: zona', A.evaluate("VW.mode"), 'area')
    A.keyboard.press('s'); eq('S: seleccionar', A.evaluate("VW.mode"), 'sel')
    A.keyboard.press('3'); eq('3: tercer color', A.evaluate("VW.color"), 2)
    A.keyboard.press('d'); A.wait_for_timeout(200); eq('D: doble página', A.evaluate("VW.two"), True)
    A.keyboard.press('d'); A.wait_for_timeout(200); eq('D otra vez: una página', A.evaluate("VW.two"), False)
    A.keyboard.press('a'); A.wait_for_timeout(150); A.keyboard.press('ArrowUp'); A.wait_for_timeout(100)
    eq('A: automático; ↑ más deprisa', [A.evaluate("VW.auto"), A.evaluate("VW.autoLv")], [True, 8])
    A.keyboard.press('ArrowDown'); A.keyboard.press('a'); A.wait_for_timeout(100)
    eq('↓ más despacio; A otra vez lo para', [A.evaluate("VW.autoLv"), A.evaluate("VW.auto")], [7, False])
    A.keyboard.press('i'); A.wait_for_timeout(200); eq('I: índice', A.evaluate("[VW.side, VW.tab]"), [True, 'toc'])
    A.keyboard.press('l'); A.wait_for_timeout(200); eq('L: anotaciones', A.evaluate("[VW.side, VW.tab]"), [True, 'ann'])
    A.keyboard.press('l'); A.wait_for_timeout(200)
    A.keyboard.press('f'); A.wait_for_timeout(200); eq('F: pantalla completa', A.evaluate("VW.fs"), True)
    A.keyboard.press('f'); A.wait_for_timeout(200); eq('F otra vez: sale', A.evaluate("VW.fs"), False)
    A.keyboard.press('g'); eq('G: al número de página', A.evaluate("document.activeElement?.id"), 'vwPg')
    A.evaluate("document.activeElement.blur()"); A.keyboard.press('Shift+?'); A.wait_for_timeout(150)
    eq('?: lista de atajos', A.evaluate("[!$('#vwMenu').hidden, $('#vwMenu').textContent.includes('Atajos de teclado del visor'), $('#vwMenu').textContent.includes('Modo concentración')]"), [True, True, True])
    A.keyboard.press('Escape'); A.wait_for_timeout(100)
    # ---- tamaño del texto de la interfaz
    w0, s0 = A.evaluate("[VW.pages[0].el.offsetWidth, VW.scale]")
    A.keyboard.press('Alt+Shift+ArrowUp'); A.wait_for_timeout(300)
    eq('Alt+Mayús+↑ agranda el texto (también con el visor abierto)', [A.evaluate("localStorage.getItem('gp-ui-fz')"), A.evaluate("getComputedStyle(document.body).fontSize")], ['1.1', '16.5px'])
    eq('las páginas del PDF no cambian de tamaño', A.evaluate("[VW.pages[0].el.offsetWidth, Math.round(VW.scale * 1000)]"), [w0, round(s0 * 1000)])
    A.evaluate("vwClose()"); A.wait_for_timeout(200)
    A.evaluate("openCfg('ap')"); A.wait_for_timeout(200)
    eq('Configuración → Apariencia: tamaño del texto', A.evaluate("!!document.querySelector('#cfg .uifz button[data-onclick=\"uiFzSet(1.25)\"]')"), True)
    A.click("#cfg .uifz button[data-onclick=\"uiFzSet(1.25)\"]"); A.wait_for_timeout(200)
    eq('elegir 125 %', [A.evaluate("getComputedStyle(document.body).fontSize"), A.evaluate("document.querySelector('#cfg .uifz button.pri')?.textContent")], ['18.75px', '125 %'])
    A.evaluate("$('#cfg').close()"); A.reload(); A.wait_for_timeout(1200)
    eq('se recuerda al volver a abrir la app', A.evaluate("getComputedStyle(document.body).fontSize"), '18.75px')
    A.keyboard.press('Alt+Shift+ArrowDown'); A.wait_for_timeout(200)
    eq('Alt+Mayús+↓ lo reduce', A.evaluate("getComputedStyle(document.body).fontSize"), '16.5px')
    A.evaluate("uiFzSet(1)")
    eq('100 %: sin ajuste guardado', [A.evaluate("localStorage.getItem('gp-ui-fz')"), A.evaluate("getComputedStyle(document.body).fontSize")], [None, '15px'])
    eq('los atajos nuevos están en Configuración → Atajos', A.evaluate("[SC_NAMES.uiBig, db.settings.shortcuts.uiBig, db.settings.shortcuts.uiSmall]"), ['Texto de la interfaz más grande', 'Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown'])
    cA.close()
    # ---- móvil: concentración con el dedo y texto más grande que 16 px en los campos
    cB, B = device(True)
    B.evaluate("pdfOpen('p2', 1)"); B.wait_for_timeout(1800)
    B.evaluate("vwConcSet(1)"); B.wait_for_timeout(300)
    eq('móvil: en concentración no se ven las barras', [B.evaluate(VISB + "('#vw .vwh')"), B.evaluate(VISB + "('#vw .vwtb')"), B.evaluate(VISB + "('#vwAuto')")], [False, False, False])
    R = B.evaluate(SCR); B.touchscreen.tap(R[0] + R[2] / 2, R[1] + R[3] / 2); B.wait_for_timeout(300)
    eq('móvil: un toque las saca y pausa', [B.evaluate("VW.autoPaused"), B.evaluate(VISB + "('#vw .vwtb')"), B.evaluate(VISB + "('#vwAuto')")], [True, True, True])
    B.evaluate("vwAutoStop(); vwConcSet(0); vwAutoStop(); vwClose(); uiFzSet(0.9)"); B.wait_for_timeout(200)
    eq('móvil: con texto pequeño los campos siguen en 16 px (el iPhone no amplía)', B.evaluate("getComputedStyle($('#q')).fontSize"), '16px')
    B.evaluate("uiFzSet(1.4)"); B.wait_for_timeout(200)
    eq('móvil: con texto grande, la página no se desborda a lo ancho', B.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), True)
    B.screenshot(path=str(pathlib.Path(os.environ.get('SHOTS', '/tmp')) / 'visor_mejoras_movil_140.png'))
    cB.close()
    eq('sin errores de página', errs, [])
    b.close(); srv.terminate()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
