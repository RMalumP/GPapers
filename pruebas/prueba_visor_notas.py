# Pruebas de las notas del paper dentro del visor de PDF (Chromium): el editor de la ficha como panel al lado del PDF
# (mitad derecha en ordenador y tablet; pantalla completa en el móvil, con ida y vuelta al PDF sin perder lo escrito).
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
PORT = 8797
SHOTS = os.environ.get('SHOTS')
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(mobile=False, w=1280, h=800):
        c = b.new_context(**pw.devices['Pixel 7'], service_workers='block') if mobile else b.new_context(viewport={'width': w, 'height': h}, service_workers='block', device_scale_factor=2 if SHOTS else 1)
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None); p.add_init_script("window.ASK_AUTO = 'accept'")
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0")
        p.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.sections.length = 0; db.sections.push({{id: 's1', name: 'Método', color: '#2457c5', tagIds: []}});
          db.papers.push(P('p1', 'Paper con PDF', {{pdf: {{name: 'prueba.pdf'}}, general: 'Idea **general**', sectionIds: ['s1'], notes: [{{id: 'n1', sectionId: 's1', content: 'Nota de método'}}]}}));
          db.papers.push(P('p2', 'Otro', {{}})); PDF_FILES.set('p1', await {FILE}); markDirty(); render(); }})()""")
        p.click('.card[data-id=p1] button[data-onclick*=pdfOpen]'); p.wait_for_timeout(1800); return c, p
    # ---- ordenador
    c, A = device()
    eq('el visor tiene el botón 📝 Notas', A.evaluate("!$('#vw .vwnb').hidden"), True)
    pdfW0 = A.evaluate("$('#vwScroll').getBoundingClientRect().width")
    A.click('#vw .vwnb'); A.wait_for_timeout(400)
    eq('abre la ficha en «Notas», dentro del visor y sin taparlo (no modal)', A.evaluate("[$('#dlg').open, $('#dlg').parentElement === $('#vw .vwbody'), $('#dlg').matches(':modal'), $('#dlg .tabs .on').textContent, $('#vw').open]"), [True, True, False, 'Notas', True])
    eq('se ven la nota general y la de la sección, con su barra de formato', A.evaluate("[$('#ed_gen').textContent, $('#dlg .nbox[data-key=n1] .ned').textContent, document.querySelectorAll('#dlg .fmtw').length]"), ['Idea general', 'Nota de método', 2])
    r = A.evaluate("(() => { const d = $('#dlg').getBoundingClientRect(), s = $('#vwScroll').getBoundingClientRect(); return [Math.round(d.width), Math.round(s.width), Math.round(s.left), Math.round(d.left) >= Math.round(s.right) - 1]; })()")
    eq('el PDF ocupa la mitad izquierda y las notas la derecha', [abs(r[0] - 640) < 4, abs(r[1] - 640) < 4, r[2], r[3]], [True, True, 0, True])
    A.wait_for_timeout(400)
    eq('el PDF se reajusta al nuevo ancho', A.evaluate("VW.pages[0].el.getBoundingClientRect().width < $('#vwScroll').clientWidth"), True)
    eq('el botón «Ver el PDF» solo hace falta en pantallas estrechas', A.is_visible('#dlg .vwdpdf'), False)
    # escribir con el editor (formato incluido) sin que el visor se quede los atajos
    A.click('#ed_gen'); A.keyboard.press('End'); A.keyboard.type(' y más clave'); A.wait_for_timeout(200)
    eq('se escribe en la nota general (con su negrita) y el espacio no pasa página en el PDF', A.evaluate("[D.general, $('#vw').open, $('#vwScroll').scrollTop < 50]"), ['Idea **general y más clave**', True, True])
    A.click('#dlg button:has-text("+ Añadir nota")'); A.wait_for_timeout(200)
    eq('«Añadir nota» por sección funciona en el panel', A.evaluate("[D.notes.length, document.querySelectorAll('#dlg .ned').length, $('#dlg').parentElement === $('#vw .vwbody')]"), [2, 3, True])
    A.click('#dlg .nbox >> nth=2 >> .ned'); A.keyboard.type('Segunda nota')
    A.click('#dlg .nbox >> nth=2 >> .fmth'); A.wait_for_timeout(250); A.click('#dlg .nbox >> nth=2 >> button:has-text("Plantilla")'); A.wait_for_timeout(200)
    eq('el menú de plantillas se ve encima del visor', A.evaluate("!$('#ctx').hidden && $('#ctx').closest('#vw') !== null && $('#ctx').getBoundingClientRect().width > 0"), True)
    A.keyboard.press('Escape'); A.wait_for_timeout(200)
    # mientras, el PDF se sigue leyendo
    A.evaluate("$('#vwScroll').scrollTop = 600"); A.wait_for_timeout(300)
    eq('el PDF se puede desplazar con las notas abiertas', A.evaluate("$('#vwScroll').scrollTop > 0 && $('#dlg').open"), True)
    A.click('#vw .vwnb'); A.wait_for_timeout(300)
    eq('otro clic en 📝 guarda y cierra el panel; la ficha vuelve a su sitio', A.evaluate("[$('#dlg').open, $('#dlg').parentElement === document.body, $('#dlg').classList.contains('vwdock'), db.papers[0].general, db.papers[0].notes.map(n => n.content)]"),
       [False, True, False, 'Idea **general y más clave**', ['Nota de método', 'Segunda nota']])
    eq('el visor sigue abierto y ocupa todo el ancho', A.evaluate("[$('#vw').open, $('#vwScroll').getBoundingClientRect().width > 900]"), [True, True])
    A.click('#vw .vwnb'); A.wait_for_timeout(300); A.click('#ed_gen'); A.keyboard.press('Control+Home'); A.keyboard.type('X'); A.keyboard.press('Escape'); A.wait_for_timeout(300)
    eq('Esc en las notas: guarda y cierra el panel, no el visor', A.evaluate("[$('#dlg').open, $('#vw').open, db.papers[0].general.startsWith('X')]"), [False, True, True])
    A.click('#vw .vwnb'); A.wait_for_timeout(300); A.click('#ed_gen'); A.keyboard.press('Control+Home'); A.keyboard.type('Y')
    if SHOTS: A.screenshot(path=SHOTS + '/visor_notas_pc.png')
    A.click('#vw .vwh .vwib >> nth=0'); A.wait_for_timeout(400)
    eq('cerrar el visor con las notas abiertas las guarda', A.evaluate("[$('#vw').open, $('#dlg').open, db.papers[0].general.startsWith('YX'), $('#dlg').parentElement === document.body]"), [False, False, True, True])
    A.click('.card[data-id=p2] button:has-text("Editar")'); A.wait_for_timeout(200)
    eq('la ficha normal sigue siendo una ventana (modal) con todo', A.evaluate("[$('#dlg').matches(':modal'), $('#dlg .tabs .on').textContent, !!$('#dlg .vwdpdf')]"), [True, 'Ver todo', False])
    eq('sin errores (ordenador)', errs, []); c.close()
    # ---- tablet (pantalla táctil grande): también la mitad
    c, T = device(w=1024, h=768); T.click('#vw .vwnb'); T.wait_for_timeout(400)
    eq('tablet: notas en la mitad derecha', T.evaluate("Math.round($('#dlg').getBoundingClientRect().width)"), 512)
    if SHOTS: T.screenshot(path=SHOTS + '/visor_notas_tablet.png')
    c.close()
    # ---- móvil: pantalla completa e ida y vuelta al PDF
    c, M = device(mobile=True)
    M.tap('#vw .vwnb'); M.wait_for_timeout(400)
    eq('móvil: las notas tapan el PDF, pero la barra del visor sigue', M.evaluate("(() => { const d = $('#dlg').getBoundingClientRect(), b = $('#vw .vwbody').getBoundingClientRect(), t = $('#vw .vwnb').getBoundingClientRect(); return [Math.round(d.width) === Math.round(b.width), Math.round(d.height) === Math.round(b.height), t.top >= d.bottom - 1]; })()"), [True, True, True])
    eq('móvil: botón «📄 Ver el PDF»', M.is_visible('#dlg .vwdpdf'), True)
    M.tap('#ed_gen'); M.keyboard.press('Control+Home'); M.keyboard.type('Z')
    if SHOTS: M.screenshot(path=SHOTS + '/visor_notas_movil.png')
    M.tap('#dlg .vwdpdf'); M.wait_for_timeout(200)
    eq('móvil: «Ver el PDF» oculta las notas sin cerrarlas', M.evaluate("[$('#dlg').open, getComputedStyle($('#dlg')).display, D.general.startsWith('Z')]"), [True, 'none', True])
    M.tap('#vw .vwnb'); M.wait_for_timeout(200)
    eq('móvil: 📝 vuelve a las notas con lo escrito', M.evaluate("[getComputedStyle($('#dlg')).display !== 'none', $('#ed_gen').textContent.startsWith('Z')]"), [True, True])
    M.tap('#dlg button:has-text("Guardar paper")'); M.wait_for_timeout(300)
    eq('móvil: «Guardar paper» guarda y vuelve al PDF', M.evaluate("[$('#dlg').open, $('#vw').open, db.papers[0].general.startsWith('Z')]"), [False, True, True])
    eq('sin errores (móvil)', errs, []); c.close()
    b.close(); srv.terminate()
print(f'{n - fail}/{n} pruebas de notas en el visor OK'); sys.exit(1 if fail else 0)
