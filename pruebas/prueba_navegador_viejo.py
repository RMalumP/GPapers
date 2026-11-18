# Pruebas (v40.1): el visor abre los PDF en un navegador que aún no tiene lo más nuevo de JavaScript.
# PDF.js 5 usaba Map.getOrInsertComputed, Math.sumPrecise, Promise.try… que Chrome, Edge o Chromium de hace unos meses no tienen, y ahí los PDF no se abrían (v40).
# Por eso lib/pdfjs/ vuelve a la 4.10. Aquí se quitan esas funciones del navegador y el PDF tiene que abrirse igual: avisa si una librería nueva vuelve a necesitarlas.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
OLD = """for (const [o, k] of [[Map.prototype, 'getOrInsertComputed'], [Map.prototype, 'getOrInsert'], [WeakMap.prototype, 'getOrInsertComputed'], [WeakMap.prototype, 'getOrInsert'],
  [Math, 'sumPrecise'], [Promise, 'try'], [Uint8Array, 'fromBase64'], [Uint8Array.prototype, 'toBase64'], [Uint8Array.prototype, 'toHex'], [Response.prototype, 'bytes']]) try { delete o[k]; } catch (e) {}"""
PORT = 8831
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block'); c.add_init_script(OLD)
        p = c.new_page(); errs = []
        p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'debug') and 'favicon' not in m.text else None)
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1200)
        eq('el navegador de la prueba no tiene lo más nuevo', p.evaluate("[typeof Map.prototype.getOrInsertComputed, typeof Math.sumPrecise, typeof Promise.try]"), ['undefined', 'undefined', 'undefined'])
        p.evaluate("""(async () => { db.settings.pdfTab = 'app'; db.papers.length = 0;
          db.papers.push(NEWF({id: 'p1', title: 'Paper', authors: [], year: 2024, type: 'articulo', tagIds: [], notes: [], cites: {}, related: [], refTo: [], sectionIds: [], pdf: {name: 'prueba.pdf'}}));
          PDF_FILES.set('p1', new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'})); markDirty(); render(); })()""")
        p.wait_for_timeout(500); p.evaluate("pdfOpen('p1', 1); 0"); p.wait_for_timeout(4000)
        eq('el PDF se abre: páginas pintadas y texto seleccionable', p.evaluate("[document.querySelectorAll('#vw .vwp .vwcv').length > 0, document.querySelectorAll('#vw .textLayer span').length > 0]"), [True, True])
        eq('sin errores', [e for e in errs if 'getOrInsert' in e or 'sumPrecise' in e or 'is not a function' in e], [])
    finally:
        srv.kill(); b.close()
print(f'{n - fail}/{n} pruebas correctas' if fail else f'{n}/{n} pruebas OK'); sys.exit(1 if fail else 0)
