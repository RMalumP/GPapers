# Pruebas de la sincronización con Google Drive (Chromium) con un Drive y un acceso de Google simulados:
# fusión a tres bandas, conexión, autoguardado, varios dispositivos, primera vez con datos en los dos lados, ventanas abiertas,
# acceso caducado, cerrar sesión, borrar la copia y el apartado de Privacidad.
import sys, json, os, pathlib, subprocess, time, urllib.parse
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))

STORE = {}   # Drive simulado: id -> {name, content}
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE'}
def drive(route, req):
    u = urllib.parse.urlparse(req.url); m = req.method; p = u.path
    if m == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    if req.headers.get('authorization') != 'Bearer tok': return route.fulfill(status=401, headers=CORS, body='{}')
    ok = lambda j: route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps(j))
    if m == 'GET' and p == '/drive/v3/files': return ok({'files': [{'id': i, 'name': f['name']} for i, f in STORE.items()]})
    if m == 'GET' and p == '/drive/v3/about': return ok({'user': {'emailAddress': 'yo@example.com'}})
    if m == 'GET' and p.startswith('/drive/v3/files/'): return route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body=STORE[p.split('/')[-1]]['content'])
    if m == 'PATCH' and p.startswith('/upload/drive/v3/files/'): STORE[p.split('/')[-1]]['content'] = req.post_data; return ok({})
    if m == 'POST' and p == '/upload/drive/v3/files':
        bnd = req.headers['content-type'].split('boundary=')[1]
        parts = [x.split('\r\n\r\n', 1)[1] for x in req.post_data.split('--' + bnd) if '\r\n\r\n' in x]
        meta = json.loads(parts[0].strip()); STORE['f%d' % (len(STORE) + 1)] = {'name': meta['name'], 'content': parts[1].rstrip('\r\n'), 'parents': meta['parents']}; return ok({})
    if m == 'DELETE' and p.startswith('/drive/v3/files/'): STORE.pop(p.split('/')[-1], None); return route.fulfill(status=204, headers=CORS)
    return route.fulfill(status=404, headers=CORS, body='{}')
GOOGLE = """window.google = {accounts: {oauth2: {initTokenClient: c => ({requestAccessToken: o => { window.__tok = (window.__tok || 0) + 1;
  setTimeout(() => window.__deny ? c.error_callback({type: 'popup_failed_to_open'}) : c.callback({access_token: 'tok', expires_in: 3600}), 5); }}), revoke: (t, cb) => cb && cb()}}};"""
remote = lambda: json.loads(next(iter(STORE.values()))['content']) if STORE else None

with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    # ---- Núcleo: fusión (sin red)
    c0 = b.new_context(service_workers='block'); pg = c0.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
    eq('en file:// no aparece el botón (Google no lo admite)', pg.evaluate("$('#syncBtn').hidden"), True)
    pg.evaluate("""() => { window.P = (id, o = {}) => NEWF({id, title: 'T' + id, authors: [], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o});
      window.LIB = (papers, o = {}) => syNorm({version: 1, sections: [], tags: [], papers, trash: [], settings: defSettings(), ...o}); }""")
    M = lambda js: pg.evaluate("(() => { " + js + " })()")
    eq('altas en los dos lados', M("const B = LIB([P('a')]); const r = syMerge(LIB([P('a'), P('l')]), LIB([P('a'), P('r')]), B); return r.papers.map(p => p.id)"), ['a', 'l', 'r'])
    eq('borrado aquí, sin cambios allí: se borra', M("const B = LIB([P('a'), P('b')]); return syMerge(LIB([P('a')]), B, B).papers.map(p => p.id)"), ['a'])
    eq('borrado allí, sin cambios aquí: se borra', M("const B = LIB([P('a'), P('b')]); return syMerge(B, LIB([P('b')]), B).papers.map(p => p.id)"), ['b'])
    eq('un cambio gana a un borrado', M("const B = LIB([P('a'), P('b')]); return syMerge(LIB([P('a')]), LIB([P('a'), P('b', {title: 'editado'})]), B).papers.map(p => p.title)"), ['Ta', 'editado'])
    eq('campos distintos del mismo paper: se juntan', M("const B = LIB([P('a')]); const r = syMerge(LIB([P('a', {title: 'nuevo'})]), LIB([P('a', {year: 1999})]), B).papers[0]; return [r.title, r.year]"), ['nuevo', 1999])
    eq('el mismo campo: gana el modificado más tarde', M("const B = LIB([P('a')]); return [syMerge(LIB([P('a', {title: 'L', modified: '2026-05-01'})]), LIB([P('a', {title: 'R', modified: '2026-06-01'})]), B).papers[0].title, syMerge(LIB([P('a', {title: 'L', modified: '2026-07-01'})]), LIB([P('a', {title: 'R', modified: '2026-06-01'})]), B).papers[0].title]"), ['R', 'L'])
    eq('notas: se combinan una a una', M("const n = (id, c) => ({id, sectionId: '', content: c}); const B = LIB([P('a', {notes: [n('1', 'x'), n('2', 'y')]})]); return syMerge(LIB([P('a', {notes: [n('1', 'x editada'), n('2', 'y')]})]), LIB([P('a', {notes: [n('1', 'x'), n('2', 'y'), n('3', 'z')]})]), B).papers[0].notes.map(x => x.content)"), ['x editada', 'y', 'z'])
    eq('etiqueta borrada en el otro lado: se quita de los papers', M("const t = [{id: 't1', name: 'E', color: '#000'}]; const B = LIB([P('a', {tagIds: ['t1']})], {tags: t}); return syMerge(LIB([P('a', {tagIds: ['t1'], title: 'cambio'})], {tags: t}), LIB([P('a', {tagIds: ['t1']})]), B).papers[0].tagIds"), [])
    eq('a la papelera aquí y editado antes allí: gana la papelera', M("const B = LIB([P('a'), P('b')]); const L = LIB([P('a')], {trash: [{paper: P('b'), at: new Date().toISOString(), by: []}]}); const r = syMerge(L, LIB([P('a'), P('b', {title: 'otro', modified: new Date(Date.now() - 864e5).toISOString()})]), B); return [r.papers.map(p => p.id), r.trash.map(t => t.paper.id)]"), [['a'], ['b']])
    eq('ajustes: la vista es de cada dispositivo, la paleta se sincroniza', M("const s = defSettings(); const B = LIB([], {settings: s}); const r = syMerge(LIB([], {settings: {...s, view: 'table'}}), LIB([], {settings: {...s, view: 'cards', palette: 'verde'}}), B).settings; return [r.view, r.palette]"), ['table', 'verde'])
    eq('sin base (primera vez) se unen', M("return syMerge(LIB([P('a', {title: 'L'})]), LIB([P('a', {title: 'R'}), P('b')]), null).papers.map(p => p.id)"), ['a', 'b'])
    eq('si solo el otro lado reordenó las secciones, se respeta su orden', M("const s = id => ({id, name: id, color: '#000', tagIds: []}); const B = LIB([], {sections: [s('x'), s('y')]}); return syMerge(B, LIB([], {sections: [s('y'), s('x')]}), B).sections.map(x => x.id)"), ['y', 'x'])
    eq('normalizar dos veces da lo mismo (no hay subidas en bucle)', M("const x = LIB([P('a', {notes: [{id: 'n', sectionId: '', content: 'c'}]})]); return syS(syNorm(x)) === syS(x)"), True)
    eq('la normalización no cambia los tipos propios de la app', M("const before = [...CTYPES.keys()].join(); syNorm({version: 1, sections: [], tags: [], papers: [], settings: {customTypes: [{id: 'ct_zz', name: 'Z', like: 'libro'}]}}); return [...CTYPES.keys()].join() === before"), True)
    c0.close()

    # ---- Con servidor y Google simulado
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', '8792', '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(sw='block'):
        c = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers=sw); c.add_init_script(GOOGLE); c.route('https://www.googleapis.com/**', drive)
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None); p.on('dialog', lambda d: d.accept())
        p.goto('http://localhost:8792/index.html'); p.wait_for_timeout(1200); return c, p
    cA, A = device('allow')
    eq('el botón de sincronizar está a la izquierda de Guardar', A.evaluate("[!$('#syncBtn').hidden, $('#syncBtn').nextElementSibling.getAttribute('aria-label'), $('#syncBtn').dataset.st]"), [True, 'Guardar', 'off'])
    eq('Privacidad está justo debajo de la Papelera', A.evaluate("$('#side .trb').nextElementSibling.textContent.trim()"), '🔒Privacidad')
    A.click('#syncBtn')
    eq('sin sesión, el icono explica cómo funciona', (A.evaluate("$('#sy').open"), 'carpeta privada y oculta' in A.inner_text('#sy')), (True, True))
    A.click('#sy button:has-text("Continuar")'); A.wait_for_timeout(800)
    eq('primera conexión: crea la copia en la carpeta oculta', (len(STORE), next(iter(STORE.values()))['parents'], next(iter(STORE.values()))['name']), (1, ['appDataFolder'], 'gpapers-sync.json'))
    eq('la copia lleva la biblioteca', (remote()['app'], len(remote()['db']['papers']) == A.evaluate("db.papers.length"), 'history' in json.dumps(remote())), ('gpapers', True, False))
    eq('mensaje de sincronizado y autoguardado activado', ('Sincronizado' in A.inner_text('#sy'), A.evaluate("[syOn(), syAuto(), $('#auto').checked, $('#syncBtn').dataset.st]")), (True, [True, True, True, 'ok']))
    eq('recuerda la cuenta', A.evaluate("syP().who"), 'yo@example.com')
    A.click('#sy button:has-text("Aceptar")')
    A.evaluate("db.papers[0].title = 'Cambio en A'; markDirty()")
    eq('un cambio deja el icono pendiente', A.evaluate("$('#syncBtn').dataset.st"), 'pend')
    A.wait_for_timeout(3800)
    eq('autoguardado: el cambio se sube solo', remote()['db']['papers'][0]['title'], 'Cambio en A')
    eq('y queda guardado (sin «sin guardar»)', (A.evaluate("dirty"), A.evaluate("$('#syncBtn').dataset.st")), (False, 'ok'))
    eq('el service worker se instala con la página de privacidad y no guarda nada de Google', A.evaluate("(async () => { const k = await caches.keys(), c = await caches.open(k[0]); const urls = (await c.keys()).map(r => r.url); return [urls.some(u => u.endsWith('/privacidad.html')), urls.some(u => u.includes('google'))]; })()"), [True, False])

    # segundo dispositivo: solo tenía el ejemplo, así que manda Drive sin preguntar
    cB, B = device()
    B.click('#syncBtn'); B.click('#sy button:has-text("Continuar")'); B.wait_for_timeout(800)
    eq('otro dispositivo con el ejemplo recibe la biblioteca sin preguntar', (B.evaluate("db.papers[0].title"), 'Ya tienes una biblioteca' in B.inner_text('#sy')), ('Cambio en A', False))
    B.click('#sy button:has-text("Aceptar")')
    pid = B.evaluate("db.papers[1].id")
    B.evaluate("db.papers[1].year = 1999; markDirty()"); B.wait_for_timeout(3800)
    A.evaluate("db.papers[0].venue = 'Revista A'; markDirty()"); A.wait_for_timeout(3800)
    eq('A recibe el cambio de B y sube el suyo', (A.evaluate(f"db.papers.find(p => p.id === '{pid}').year"), remote()['db']['papers'][0]['venue']), (1999, 'Revista A'))
    v0 = B.evaluate("db.papers[0].venue"); B.evaluate("syRun(false)"); B.wait_for_timeout(600)
    eq('B recibe el cambio de A sin perder el suyo', B.evaluate(f"[db.papers[0].venue, db.papers.find(p => p.id === '{pid}').year]"), ['Revista A', 1999])
    eq('lo que llega de Drive se puede deshacer', B.evaluate("undo(); db.papers[0].venue"), v0)
    B.evaluate("redo()"); B.wait_for_timeout(3800)
    B.evaluate(f"trashPaper('{pid}'); markDirty()"); B.wait_for_timeout(3800)
    A.evaluate("syRun(false)"); A.wait_for_timeout(600)
    eq('un paper borrado en B va a la papelera de A', A.evaluate(f"[db.papers.some(p => p.id === '{pid}'), db.trash.some(t => t.paper.id === '{pid}')]"), [False, True])

    # con una ventana de edición abierta no se cambia nada debajo: se espera a que se cierre
    A.evaluate("openPaper(db.papers[0].id)")
    B.evaluate("db.papers[0].rating = 2; markDirty()"); B.wait_for_timeout(3800)
    A.evaluate("syRun(false)"); A.wait_for_timeout(600)
    eq('con el editor abierto espera', (A.evaluate("db.papers[0].rating"), A.evaluate("$('#syncBtn').dataset.st")), (4, 'wait'))
    A.evaluate("$('#dlg').close()"); A.wait_for_timeout(1000)
    eq('al cerrarlo llega el cambio', A.evaluate("db.papers[0].rating"), 2)

    # acceso caducado: no se insiste y se avisa para volver a conectar
    A.evaluate("sessionStorage.clear(); window.__deny = true; syRun(false)"); A.wait_for_timeout(400)
    eq('acceso caducado: icono amarillo y aviso con «Conectar»', (A.evaluate("$('#syncBtn').dataset.st"), 'Conectar' in A.inner_text('#toast')), ('reconnect', True))
    t0 = A.evaluate("window.__tok"); A.evaluate("db.papers[0].title = 'sin acceso'; markDirty()"); A.wait_for_timeout(3500)
    eq('sin acceso no vuelve a pedirlo solo', A.evaluate("window.__tok"), t0)
    A.evaluate("window.__deny = false"); A.click('#syncBtn')
    eq('el menú ofrece volver a conectar y cerrar sesión', [x for x in A.evaluate("[...document.querySelectorAll('#ctx button')].map(b => b.textContent)") if 'conectar' in x or 'Cerrar sesión' in x], ['🔑 Volver a conectar', '🚪 Cerrar sesión'])
    A.click('#ctx button:has-text("Volver a conectar")'); A.wait_for_timeout(800)
    eq('al reconectar se sube lo pendiente', (remote()['db']['papers'][0]['title'], A.evaluate("$('#syncBtn').dataset.st")), ('sin acceso', 'ok'))
    A.click('#sy button:has-text("Aceptar")')

    # autoguardado desactivado desde la casilla: sincroniza a mano
    A.click('#auto')
    eq('casilla sin marcar: autoguardado en Drive desactivado', A.evaluate("syAuto()"), False)
    A.evaluate("db.papers[0].title = 'manual'; markDirty()"); A.wait_for_timeout(3500)
    eq('no se sube solo', (remote()['db']['papers'][0]['title'], A.evaluate("$('#syncBtn').dataset.st")), ('sin acceso', 'manual'))
    A.click('#syncBtn'); A.click('#ctx button:has-text("Sincronizar ahora")'); A.wait_for_timeout(600)
    eq('«Sincronizar ahora» lo sube', remote()['db']['papers'][0]['title'], 'manual')
    A.click('#auto'); eq('se vuelve a activar', A.evaluate("syAuto()"), True)

    # al recargar sigue la sesión y se traen los cambios
    B.evaluate("db.papers[0].title = 'desde B'; markDirty()"); B.wait_for_timeout(3800)
    A.reload(); A.wait_for_timeout(1800)
    eq('al abrir la app se trae lo último (la sesión se recuerda)', (A.evaluate("db.papers[0].title"), A.evaluate("$('#auto').checked")), ('desde B', True))

    # tercer dispositivo con su propia biblioteca: pregunta cómo juntarlas
    cC, C = device()
    C.evaluate("db.papers.length = 0; db.papers.push(NEWF({id: 'mio', title: 'Mío', authors: [], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01'})); path = 'mio.json'; markDirty(); render()")
    C.click('#syncBtn'); C.click('#sy button:has-text("Continuar")'); C.wait_for_timeout(600)
    eq('con datos en los dos lados pregunta', ('Ya tienes una biblioteca en Google Drive' in C.inner_text('#sy'), C.locator('#sy button').all_inner_texts()), (True, ['Combinar las dos', 'Usar la de Google Drive', 'Usar la de este dispositivo', 'Cancelar']))
    C.click('#sy button:has-text("Combinar las dos")'); C.wait_for_timeout(800)
    eq('combinar junta las dos', (C.evaluate("db.papers.some(p => p.id === 'mio') && db.papers.some(p => p.title === 'desde B')"), any(p['id'] == 'mio' for p in remote()['db']['papers'])), (True, True))
    C.click('#sy button:has-text("Aceptar")')
    C.click('#syncBtn'); C.click('#ctx button:has-text("Cerrar sesión")'); C.wait_for_timeout(400)
    eq('cerrar sesión: deja de sincronizar y conserva los datos', (C.evaluate("[syOn(), $('#syncBtn').dataset.st, sessionStorage.length, db.papers.some(p => p.id === 'mio')]"), len(STORE)), ([False, 'off', 0, True], 1))

    # Privacidad
    B.click('#side button:has-text("Privacidad")')
    eq('Privacidad explica el permiso y la carpeta oculta', all(s in B.inner_text('#pv') for s in ['drive.appdata', 'carpeta privada y oculta', 'myaccount.google.com/permissions', 'yo@example.com']), True)
    B.click('#pv button:has-text("Borrar mi copia")'); B.wait_for_timeout(600)
    eq('borrar la copia de Drive y cerrar sesión', (len(STORE), B.evaluate("syOn()")), (0, False))
    B.evaluate("$('#pv').close(); openHelp('sync')")
    eq('la ayuda tiene su apartado', 'Autoguardado activado' in B.inner_text('#hp_sync'), True)
    eq('sin errores', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
