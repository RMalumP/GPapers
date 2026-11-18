# Pruebas (v40.2): abrir un PDF que solo está en Google Drive.
# Antes no se veía nada hasta tenerlo descargado (a veces 10 s o más). Ahora sale al momento una ventana con el progreso y Cancelar,
# PDF.js se carga mientras tanto y, si ya se vio el archivo al listar Drive, no se busca otra vez antes de descargarlo.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
# Drive simulado dentro de la página: lista el PDF y lo entrega en 5 trozos, uno cada 300 ms (como una conexión lenta)
INIT = """localStorage.setItem('gp-sync', JSON.stringify({on: true, auto: false}));
localStorage.setItem('gp-sync-token', JSON.stringify({t: 'tok', exp: Date.now() + 3e6, c: '143923429984-45e8m3bmn1315r9ceet2sb19iuq4f9qj.apps.googleusercontent.com'}));
window.__calls = []; window.__pdf = null; const of = window.fetch.bind(window);
window.fetch = async (u, o = {}) => {
  u = String(u); if (!u.includes('googleapis.com')) return of(u, o);
  const p = new URL(u); window.__calls.push(p.searchParams.get('alt') === 'media' ? 'media:' + p.pathname.split('/').pop() : 'lista');
  if (p.searchParams.get('alt') !== 'media') { const q = p.searchParams.get('q') || '';
    return new Response(JSON.stringify({files: q.includes('gpapers-pdf-p1') ? [{id: 'F1', name: 'gpapers-pdf-p1', size: String(window.__pdf.length)}] : []}), {headers: {'content-type': 'application/json'}}); }
  if (!p.pathname.endsWith('/F1')) return new Response('{}', {status: 404});
  const b = window.__pdf, k = Math.ceil(b.length / 5); let i = 0;
  const body = new ReadableStream({async pull(c) { await new Promise(r => setTimeout(r, 300)); if (o.signal?.aborted) { c.error(new DOMException('a', 'AbortError')); return; }
    if (i >= b.length) { c.close(); return; } c.enqueue(b.slice(i, i + k)); i += k; }});
  if (o.signal?.aborted) throw new DOMException('a', 'AbortError');
  return new Response(body, {headers: {'content-type': 'application/pdf', 'content-length': String(b.length)}});
};"""
PORT = 8832
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block'); c.add_init_script(INIT)
        p = c.new_page(); errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1200)
        p.evaluate("""(async () => { window.__pdf = new Uint8Array(await (await fetch('pruebas/prueba.pdf')).arrayBuffer());
          db.settings.pdfTab = 'app'; db.papers.length = 0;
          db.papers.push(NEWF({id: 'p1', title: 'Paper', authors: [], year: 2024, type: 'articulo', tagIds: [], notes: [], cites: {}, related: [], refTo: [], sectionIds: [], pdf: {name: 'prueba.pdf'}}));
          markDirty(); render(); })()""")
        p.wait_for_timeout(400)
        st = "() => ({dlw: !!document.querySelector('#dlw[open]'), t: document.querySelector('#dlwT')?.textContent || '', n: document.querySelector('#dlw .dlwn')?.textContent || '', vw: !!document.querySelector('#vw[open]')})"
        # 1) la ventana sale al momento, con el progreso, y se cierra al abrirse el visor
        p.evaluate("__calls.length = 0; pdfOpen('p1', 1); 0"); p.wait_for_timeout(150)
        s = p.evaluate(st); eq('al momento: ventana de descarga con el nombre', [s['dlw'], s['t'], s['vw']], [True, 'Descargando «prueba.pdf» de tu Google Drive', False])
        p.wait_for_timeout(1000); s = p.evaluate(st)
        eq('a mitad: porcentaje y tamaño', [s['dlw'], '%' in s['n'] and ' de ' in s['n'] and 'KB' in s['n'] and not s['n'].startswith('100')], [True, True])
        eq('la barra dice cuánto lleva', p.evaluate("+document.querySelector('#dlw .dlwb').getAttribute('aria-valuenow') > 0"), True)
        eq('PDF.js ya se cargó mientras se descargaba', p.evaluate("!!PDFJS"), True)
        p.wait_for_timeout(2500); s = p.evaluate(st)
        eq('después: visor abierto con las páginas y sin la ventana', [s['dlw'], s['vw'], p.evaluate("document.querySelectorAll('#vw .vwp').length > 0")], [False, True, True])
        eq('la primera vez: buscar y descargar', p.evaluate("__calls"), ['lista', 'media:F1'])
        p.evaluate("vwClose()"); p.wait_for_timeout(300)
        # 1b) después, con la copia del navegador, no se va a Drive ni sale la ventana
        p.evaluate("(async () => { PDF_FILES.clear(); vwKeepDrop(); __calls.length = 0; pdfOpen('p1', 1); })(); 0"); p.wait_for_timeout(200)
        eq('con la copia: abre sin ventana ni Drive', [p.evaluate(st)['dlw'], p.evaluate("__calls")], [False, []])
        p.wait_for_timeout(1500); eq('con la copia: visor abierto', p.evaluate(st)['vw'], True)
        p.evaluate("vwClose()"); p.wait_for_timeout(300)
        # 2) otra vez sin la copia del navegador: ya sabe dónde está, no lo busca
        p.evaluate("(async () => { PDF_FILES.clear(); await pdfForget('p1'); __calls.length = 0; pdfOpen('p1', 1); })(); 0"); p.wait_for_timeout(3000)
        eq('la segunda vez: solo descargar', [p.evaluate("__calls"), p.evaluate(st)['vw']], [['media:F1'], True])
        p.evaluate("vwClose()"); p.wait_for_timeout(300)
        # 3) Cancelar: se para la descarga, no se abre el visor ni se pide el archivo
        p.evaluate("(async () => { PDF_FILES.clear(); await pdfForget('p1'); window.__chose = 0; const o = pdfChoose; pdfChoose = (...a) => { __chose++; return o(...a); }; pdfOpen('p1', 1); })(); 0"); p.wait_for_timeout(450)
        p.click('#dlw button'); p.wait_for_timeout(2000); s = p.evaluate(st)
        eq('Cancelar cierra la ventana y no abre el visor', [s['dlw'], s['vw'], p.evaluate("__chose")], [False, False, 0])
        eq('cancelado: no queda copia a medias', p.evaluate("pdfKept('p1', 'prueba.pdf').then(f => !!f)"), False)
        # 4) Escape también cancela
        p.evaluate("pdfOpen('p1', 1); 0"); p.wait_for_timeout(400); p.keyboard.press('Escape'); p.wait_for_timeout(1800); s = p.evaluate(st)
        eq('Escape cancela', [s['dlw'], s['vw']], [False, False])
        # 5) el archivo cambió de número en Drive: se vuelve a buscar
        p.evaluate("(async () => { SY_FID.set('gpapers-pdf-p1', {id: 'VIEJO', size: '10'}); __calls.length = 0; pdfOpen('p1', 1); })(); 0"); p.wait_for_timeout(3500)
        eq('número viejo: lo busca y lo abre', [p.evaluate("__calls"), p.evaluate(st)['vw']], [['media:VIEJO', 'lista', 'media:F1'], True])
        eq('sin errores', errs, [])
        # 6) en móvil, la ventana cabe en la pantalla
        p.evaluate("vwClose()"); p.wait_for_timeout(300)
        m = b.new_context(viewport={'width': 360, 'height': 740}, is_mobile=True, has_touch=True, service_workers='block'); m.add_init_script(INIT); q = m.new_page()
        q.goto(f'http://localhost:{PORT}/index.html'); q.wait_for_timeout(1200)
        q.evaluate("""(async () => { window.__pdf = new Uint8Array(await (await fetch('pruebas/prueba.pdf')).arrayBuffer()); db.papers.length = 0;
          db.papers.push(NEWF({id: 'p1', title: 'Paper', authors: [], year: 2024, type: 'articulo', tagIds: [], notes: [], cites: {}, related: [], refTo: [], sectionIds: [], pdf: {name: 'un nombre de archivo bastante largo para un móvil pequeño.pdf'}})); markDirty(); render(); pdfOpen('p1', 1); })(); 0""")
        q.wait_for_timeout(700)
        eq('móvil: la ventana cabe', q.evaluate("(() => { const r = document.querySelector('#dlw').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()"), True)
        q.wait_for_timeout(2500); eq('móvil: el visor se abre', q.evaluate(st.replace('() =>', '(() =>') + ")()")['vw'], True)
    finally:
        srv.kill(); b.close()
print(f'{n - fail}/{n} pruebas correctas' if fail else f'{n}/{n} pruebas OK'); sys.exit(1 if fail else 0)
