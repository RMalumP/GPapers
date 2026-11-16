# Pruebas del visor (v39.48): los tiradores de un subrayado ya hecho se pueden dejar fijos (⚙ Ajustes del visor → ✋ Límites de un subrayado ya hecho).
# Por defecto, fijos con el 🔒 candado o con el ⚡ modo ligero; también «siempre fijos» o «siempre se pueden mover».
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
PORT = 8814
VIS = "[...document.querySelectorAll('#vw .vwhd:not(.tsh)')].filter(h => !h.hidden).length"
MENU = "[...document.querySelectorAll('#vwMenu button, #vwMenu .ctxh')].map(b => b.textContent.trim())"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block'); A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'")
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0")
    A.evaluate(f"(async () => {{ localStorage.setItem('gp-vw-lite', 'off'); db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Paper con PDF', {{pdf: {{name: 'prueba.pdf'}}}})); PDF_FILES.set('p1', await {FILE}); markDirty(); render(); }})()")
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    A.evaluate("""(() => { const sp = [...document.querySelectorAll('#vw .vwp[data-i="0"] .textLayer span')].sort((a, b) => b.textContent.length - a.textContent.length)[0], t = sp.firstChild;
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, Math.min(4, t.length)); getSelection().removeAllRanges(); getSelection().addRange(r); })()""")
    A.wait_for_timeout(400); A.evaluate("vwSelColor(0)"); A.wait_for_timeout(1500)
    t0 = A.evaluate("vwAnns()[0].t")
    eq('por defecto: «auto»', A.evaluate("vwHdLkPref()"), 'auto')
    A.evaluate("vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(200)
    eq('sin candado ni modo ligero, salen los dos tiradores', A.evaluate(VIS), 2)
    A.evaluate("vwRdSet('flip', true)"); A.wait_for_timeout(600); A.evaluate("vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(200)
    eq('en página a página (sin candado) siguen saliendo', A.evaluate(VIS), 2)
    A.evaluate("vwLockSet(true, true)"); A.wait_for_timeout(200)
    eq('al poner el candado se esconden (con la ventanita abierta)', [A.evaluate(VIS), A.evaluate("!$('#vwPop').hidden")], [0, True])
    A.evaluate("vwPopClose(); vwPopOpen(vwAnns()[0].id)"); A.wait_for_timeout(200)
    eq('con candado, al tocar el subrayado no salen', A.evaluate(VIS), 0)
    eq('aunque se llame al tirador a mano, no se mueve nada', A.evaluate("(() => { const h = document.querySelector('#vw .vwhd1:not(.tsh)'); vwHdDown({currentTarget: h, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}}); return !!VW.ext; })()"), False)
    A.evaluate("vwLockSet(false, true)"); A.wait_for_timeout(200)
    eq('al quitar el candado vuelven', A.evaluate(VIS), 2)
    A.evaluate("vwLiteSet('on')"); A.wait_for_timeout(200)
    eq('con el modo ligero, fijos', [A.evaluate("VW.lite"), A.evaluate(VIS)], [True, 0])
    A.evaluate("vwLiteSet('off')"); A.wait_for_timeout(200)
    eq('sin modo ligero, vuelven', A.evaluate(VIS), 2)
    # ---- en ⚙ Ajustes del visor
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200); A.evaluate("vwCfgMenu()"); A.wait_for_timeout(150); m = A.evaluate(MENU)
    eq('⚙ lleva la sección de los límites', any('Límites de un subrayado ya hecho' in x for x in m), True)
    eq('y «auto» marcado', any(x.startswith('✓') and 'candado' in x and 'ligero' in x for x in m), True)
    def pick(t):
        ok = A.evaluate("t => { const b = [...document.querySelectorAll('#vwMenu button')].find(b => b.textContent.includes(t)); if (b) b.click(); return !!b; }", t); A.wait_for_timeout(150)
        if not ok: eq('opción del menú: ' + t, False, True)
    pick('Siempre fijos')
    eq('«siempre fijos»: se guarda y se esconden', [A.evaluate("localStorage.getItem('gp-vw-hdlk')"), A.evaluate(VIS)], ['on', 0])
    pick('Siempre se pueden mover'); A.evaluate("vwLockSet(true, true)"); A.wait_for_timeout(150)
    eq('«siempre se pueden mover»: salen también con el candado', [A.evaluate("vwHdLkPref()"), A.evaluate(VIS)], ['off', 2])
    A.evaluate("vwLockSet(false, true)"); pick('Fijos con el')
    eq('y vuelta a «auto»', A.evaluate("vwHdLkPref()"), 'auto')
    eq('el subrayado no ha cambiado', A.evaluate("vwAnns()[0].t"), t0)
    A.evaluate("vwClose?.()")
    eq('sin errores en la página', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas')
sys.exit(1 if fail else 0)
