# Pruebas de los proyectos (Chromium): cabecera, cambiar, crear, renombrar, guardar con el nombre del proyecto, abrir un JSON como
# proyecto, borrar, paso desde la versión de una sola biblioteca y sincronización de todos los proyectos con Google Drive simulado.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
from drive_falso import *   # Drive simulado (STORE, CALLS, drive, GOOGLE, names, PNG)
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t) => NEWF({id, title: t, authors: [], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z'})"
# en Chrome/Edge: guardar en un archivo simulado (recuerda el nombre propuesto y lo escrito)
FSAFAKE = """window.__files = {}; const mk = name => ({name, kind: 'file', queryPermission: async () => 'granted', requestPermission: async () => 'granted', isSameEntry: async o => o && o.name === name,
  createWritable: async () => ({write: async t => window.__files[name] = t, close: async () => {}}), getFile: async () => new File([window.__files[name] || ''], name)});
window.showSaveFilePicker = async o => { window.__sug = o.suggestedName; return mk(o.suggestedName); };"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', '8793', '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(init=None):
        c = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); c.add_init_script(GOOGLE); c.route('https://www.googleapis.com/**', drive)
        if init: c.add_init_script(init)
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None); p.on('dialog', lambda d: d.accept())
        p.goto('http://localhost:8793/index.html'); p.wait_for_timeout(1200); p.evaluate(f"window.P = {PAPER}"); return c, p
    menu = lambda pg: pg.evaluate("[...document.querySelectorAll('#ctx .pji')].map(b => b.textContent.trim())")
    def pick(pg, name): pg.click('#pjBtn'); pg.click(f'#ctx .pji:has-text("{name}")'); pg.wait_for_timeout(500)

    # ---- En local
    cA, A = device(FSAFAKE)
    eq('cabecera: nombre de la app / nombre del proyecto ▾', A.evaluate("[$('#appName').textContent, $('#appName').nextElementSibling.querySelector('#pjName').value, $('#pjBtn').textContent]"), ['Papers', 'Ejemplo', '▾'])
    eq('primera vez: un proyecto con el ejemplo', A.evaluate("[PJ.list.length, PJ.cur, db.papers.length > 0, document.title]"), [1, 'main', True, 'Ejemplo · Gestor de papers'])
    A.fill('#pjName', 'Tesis'); A.press('#pjName', 'Enter'); A.wait_for_timeout(300)
    eq('el nombre se escribe en la cabecera', A.evaluate("[pjCur().name, document.title, document.activeElement.id]"), ['Tesis', 'Tesis · Gestor de papers', ''])
    A.fill('#pjName', 'otra cosa'); A.press('#pjName', 'Escape')
    eq('Esc deja el nombre como estaba', A.evaluate("[pjCur().name, $('#pjName').value]"), ['Tesis', 'Tesis'])
    nTesis = A.evaluate("db.papers.length")
    A.evaluate("save(true)"); A.wait_for_timeout(300)
    eq('Guardar como propone el nombre del proyecto', A.evaluate("[window.__sug, path, JSON.parse(window.__files['Tesis.json']).papers.length]"), ['Tesis.json', 'Tesis.json', nTesis])
    A.click('#pjBtn')
    eq('menú de proyectos', (menu(A), A.evaluate("[...document.querySelectorAll('#ctx > button:not(.pji)')].map(b => b.textContent)")), ([f'✓ Tesis {nTesis} papers'], ['＋ Nuevo proyecto', '📂 Abrir un JSON como proyecto…', '✏️ Cambiar el nombre', '🕘 Copias de seguridad…', '🗑 Borrar este proyecto…']))
    A.click('#ctx button:has-text("Nuevo proyecto")'); A.wait_for_timeout(500)
    eq('nuevo proyecto: vacío y con el nombre listo para escribir', A.evaluate("[PJ.list.length, db.papers.length, db.sections.length, pjCur().name, document.activeElement.id, path]"), [2, 0, 0, 'Proyecto nuevo', 'pjName', None])
    A.keyboard.type('TFM'); A.keyboard.press('Enter'); A.wait_for_timeout(200)
    A.evaluate("db.papers.push(P('t1', 'Paper del TFM')); db.settings.appName = 'Mis papers'; db.settings.palette = 'verde'; applySettings(); markDirty(); render()"); A.wait_for_timeout(900)
    pick(A, 'Tesis')
    eq('cambiar de proyecto: solo se ven sus papers', A.evaluate("[pjCur().name, db.papers.length, db.papers.some(p => p.id === 't1'), path, dirty]"), ['Tesis', nTesis, False, 'Tesis.json', False])
    eq('nombre de la app y colores comunes a todos los proyectos', A.evaluate("[db.settings.appName, db.settings.palette, $('#appName').textContent]"), ['Mis papers', 'verde', 'Mis papers'])
    A.click('#pjBtn')
    eq('el menú dice cuántos papers tiene cada uno', menu(A), [f'✓ Tesis {nTesis} papers', 'TFM 1 papers'])
    A.click('#ctx .pji:has-text("TFM")'); A.wait_for_timeout(500)
    eq('al volver, los cambios sin guardar siguen ahí', A.evaluate("[db.papers.map(p => p.title), dirty, path]"), [['Paper del TFM'], True, None])
    A.evaluate("save(false)"); A.wait_for_timeout(300)
    eq('Guardar: el archivo del TFM se llama como el proyecto y solo lleva sus papers', A.evaluate("[window.__sug, JSON.parse(window.__files['TFM.json']).papers.map(p => p.id), JSON.parse(window.__files['TFM.json']).settings.appName]"), ['TFM.json', ['t1'], 'Mis papers'])
    A.evaluate("db.papers[0].title = 'TFM autoguardado'; auto = true; markDirty()"); A.wait_for_timeout(1500)
    eq('el autoguardado escribe en el archivo de este proyecto', A.evaluate("[JSON.parse(window.__files['TFM.json']).papers[0].title, JSON.parse(window.__files['Tesis.json']).papers.length]"), ['TFM autoguardado', nTesis])
    A.evaluate("auto = false")
    A.fill('#pjName', 'TFM final'); A.press('#pjName', 'Enter'); A.wait_for_timeout(300)
    eq('renombrar: si el archivo no se puede renombrar, el siguiente Guardar crea el del nombre nuevo', A.evaluate("[path, handle]"), [None, None])
    A.evaluate("save(false)"); A.wait_for_timeout(300)
    eq('… y lo propone con el nombre nuevo', A.evaluate("[window.__sug, path]"), ['TFM final.json', 'TFM final.json'])
    A.reload(); A.wait_for_timeout(1300)
    eq('al reabrir: la misma lista y el último proyecto abierto', A.evaluate("[PJ.list.map(p => p.name), pjCur().name, db.papers[0].title, $('#pjName').value, db.settings.appName]"), [['Tesis', 'TFM final'], 'TFM final', 'TFM autoguardado', 'TFM final', 'Mis papers'])
    # abrir un JSON como proyecto
    rev = json.dumps({'version': 1, 'sections': [], 'tags': [], 'trash': [], 'papers': [{'id': 'r1', 'title': 'Revisado', 'authors': []}], 'settings': {'appName': 'Otro nombre', 'customTypes': [{'id': 'ct_poster', 'name': 'Póster', 'like': 'congreso'}]}})
    A.evaluate(f"pjOpenFile({json.dumps(rev)}, 'Revisión.json', null)"); A.wait_for_timeout(500)
    eq('un JSON nuevo se abre como proyecto con el nombre del archivo', A.evaluate("[PJ.list.length, pjCur().name, db.papers.map(p => p.title), path]"), [3, 'Revisión', ['Revisado'], 'Revisión.json'])
    eq('se quedan los ajustes comunes, pero se añaden sus tipos propios', A.evaluate("[db.settings.appName, db.settings.customTypes.some(c => c.id === 'ct_poster')]"), ['Mis papers', True])
    pick(A, 'Tesis')
    A.evaluate(f"pjOpenFile({json.dumps(rev)}, 'Revisión.json', null)"); A.wait_for_timeout(500)
    eq('abrir el archivo de un proyecto que ya existe abre ese proyecto', A.evaluate("[PJ.list.length, pjCur().name]"), [3, 'Revisión'])
    A.evaluate("pjOpenFile('{\"no\": 1}', 'malo.json', null)"); A.wait_for_timeout(300)
    eq('un archivo no válido no crea proyecto', A.evaluate("[PJ.list.length, pjCur().name]"), [3, 'Revisión'])
    A.click('#pjBtn'); A.click('#ctx button:has-text("Borrar este proyecto")'); A.wait_for_timeout(600)
    eq('borrar el proyecto abierto: se pasa a otro', A.evaluate("[PJ.list.map(p => p.name), pjCur().name !== 'Revisión']"), [['Tesis', 'TFM final'], True])
    eq('y su copia de trabajo desaparece del navegador', A.evaluate("(async () => (await idb('readonly', st => st.getAllKeys())).filter(k => String(k).startsWith('proj:')).length)()"), 2)
    cA.close()

    # ---- Paso desde la versión de una sola biblioteca: su copia de sesión pasa a ser el primer proyecto
    cM, M = device()
    old = json.dumps({'version': 1, 'sections': [], 'tags': [], 'trash': [], 'papers': [{'id': 'm1', 'title': 'Mi paper de antes', 'authors': []}], 'settings': {'appName': 'Antes'}})
    M.evaluate(f"(async () => {{ BOOTED = false; await idb('readwrite', st => {{ st.delete('projects'); st.delete('proj:main'); return st.put({{v: 1, path: 'mis-papers.json', dirty: true, json: {json.dumps(old)}}}, 'session'); }}); }})()")
    M.reload(); M.wait_for_timeout(1300)
    eq('la biblioteca de antes es el primer proyecto, con el nombre de su archivo', M.evaluate("[PJ.list.map(p => [p.id, p.name]), db.papers[0].title, dirty, db.settings.appName]"), [[['main', 'mis-papers']], 'Mi paper de antes', True, 'Antes'])
    eq('y queda guardada como proyecto', M.evaluate("(async () => [!!(await idb('readonly', st => st.get('proj:main'))), await idb('readonly', st => st.get('session'))])()"), [True, None])
    M.evaluate("save(false)")
    eq('sin archivo propio, Guardar descarga o propone «<proyecto>.json»', M.evaluate("path"), 'mis-papers.json')
    cM.close()

    # ---- Google Drive: todos los proyectos
    cX, X = device()
    X.fill('#pjName', 'Tesis'); X.press('#pjName', 'Enter')
    X.evaluate("db.papers.length = 0; db.papers.push(P('x1', 'Tesis uno')); markDirty()")
    X.evaluate("pjNew()"); X.wait_for_timeout(500); X.keyboard.type('TFM'); X.keyboard.press('Enter')
    X.evaluate("db.papers.push(P('y1', 'TFM uno'), P('y2', 'TFM dos')); markDirty()"); X.wait_for_timeout(300)
    tfm = X.evaluate("PJ.cur")
    X.click('#syncBtn'); X.click('#sy button:has-text("Continuar")'); X.wait_for_timeout(1000); X.click('#sy button:has-text("Aceptar")')
    idx = lambda: json.loads(next(f for f in STORE.values() if f['name'] == 'gpapers-projects.json')['content'])['idx']
    eq('se sube el índice con todos los proyectos y el abierto', (names(), [p['name'] for p in idx()['projects']]), (sorted(['gpapers-projects.json', f'gpapers-p-{tfm}-snap.json']), ['Tesis', 'TFM']))
    eq('el índice lleva los ajustes comunes (sin la vista, que es de cada dispositivo)', ('appName' in idx()['settings'], 'view' in idx()['settings']), (True, False))
    pick(X, 'Tesis'); X.wait_for_timeout(1200)
    eq('al abrir el otro proyecto se sube también (con los nombres de archivo de siempre)', names(), sorted(['gpapers-projects.json', f'gpapers-p-{tfm}-snap.json', 'gpapers-snap.json']))
    X.evaluate(f"db.papers[0].image = {{kind: 'data', data: '{PNG}'}}; markDirty()"); X.wait_for_timeout(3800)
    eq('las imágenes de cada proyecto van aparte', len(names('gpapers-img-')), 1)
    # otro dispositivo
    cY, Y = device()
    Y.click('#syncBtn'); Y.click('#sy button:has-text("Continuar")'); Y.wait_for_timeout(1200); Y.click('#sy button:has-text("Aceptar")')
    Y.click('#pjBtn')
    eq('el otro dispositivo ve todos los proyectos; los no descargados con ☁', (Y.evaluate("pjCur().name"), menu(Y)), ('Tesis', ['✓ Tesis 1 papers', 'TFM ☁ en Google Drive']))
    Y.click('#ctx .pji:has-text("TFM")'); Y.wait_for_timeout(1500)
    eq('al abrirlo se descarga', Y.evaluate("[pjCur().name, db.papers.map(p => p.title).sort(), !!pjCur().remote]"), ['TFM', ['TFM dos', 'TFM uno'], False])
    Y.evaluate("db.papers[0].year = 1999; markDirty()"); Y.wait_for_timeout(3800)
    pick(X, 'TFM'); X.wait_for_timeout(1200)
    eq('los cambios de un proyecto llegan al otro dispositivo', X.evaluate("db.papers.map(p => p.year).includes(1999)"), True)
    X.fill('#pjName', 'TFM 2026'); X.press('#pjName', 'Enter'); X.evaluate("db.settings.appName = 'Biblioteca'; applySettings(); markDirty()"); X.wait_for_timeout(3800)
    Y.evaluate("syRun(false)"); Y.wait_for_timeout(1000)
    eq('renombrar y cambiar ajustes llega al otro dispositivo', Y.evaluate("[pjCur().name, $('#pjName').value, db.settings.appName, $('#appName').textContent]"), ['TFM 2026', 'TFM 2026', 'Biblioteca', 'Biblioteca'])
    pick(Y, 'Tesis'); Y.wait_for_timeout(800)
    eq('los ajustes comunes siguen al cambiar de proyecto', Y.evaluate("[pjCur().name, db.settings.appName, db.papers[0].image?.data === " + json.dumps(PNG) + "]"), ['Tesis', 'Biblioteca', True])
    # borrar un proyecto en un dispositivo mientras el otro lo tiene abierto
    Y.evaluate(f"pjOpen('{tfm}')"); Y.wait_for_timeout(1200)
    X.evaluate("pjDel()"); X.wait_for_timeout(1500)
    eq('borrar un proyecto lo quita de Drive (sus archivos y del índice)', ([x for x in names() if tfm in x], [p['name'] for p in idx()['projects']], X.evaluate("pjCur().name")), ([], ['Tesis'], 'Tesis'))
    Y.evaluate("syRun(false)"); Y.wait_for_timeout(1500)
    eq('el otro dispositivo, que lo tenía abierto, pasa a otro y avisa', (Y.evaluate("[PJ.list.map(p => p.name), pjCur().name]"), 'se borró en otro dispositivo' in Y.inner_text('#toast')), ([['Tesis'], 'Tesis'], True))
    eq('no vuelve a subirlo', ([x for x in names() if tfm in x], [p['name'] for p in idx()['projects']]), ([], ['Tesis']))
    # cerrar sesión: los proyectos que solo están en Drive dejan de verse aquí
    X.evaluate("pjNew()"); X.wait_for_timeout(500); X.keyboard.type('Solo en X'); X.keyboard.press('Enter'); X.evaluate("db.papers.push(P('z1', 'z')); markDirty()"); X.wait_for_timeout(3800)
    Y.evaluate("syRun(false)"); Y.wait_for_timeout(1000)
    eq('un proyecto nuevo aparece en el otro dispositivo', Y.evaluate("PJ.list.map(p => p.name + (p.remote ? ' ☁' : ''))"), ['Tesis', 'Solo en X ☁'])
    Y.evaluate("syLogout(true)"); Y.wait_for_timeout(500)
    eq('al cerrar sesión se quitan los que solo están en Drive', Y.evaluate("PJ.list.map(p => p.name)"), ['Tesis'])
    eq('la ayuda tiene su apartado de proyectos', X.evaluate("openHelp('proyectos'); $('#hp_proyectos').open && $('#hp_proyectos').textContent.includes('Guardar como')"), True)
    eq('sin errores', [e for e in errs if 'could not be cloned' not in e], [])   # el archivo simulado no se puede guardar en IndexedDB (uno real sí)
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
