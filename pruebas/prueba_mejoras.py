# Pruebas de las mejoras (Chromium): copias de seguridad, duplicados, mover/copiar entre proyectos, PDF enlazados y extras.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: [], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', '8795', '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device():
        c = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block')
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None); p.on('dialog', lambda d: d.accept())
        p.goto('http://localhost:8795/index.html'); p.wait_for_timeout(1200); p.evaluate(f"window.P = {PAPER}"); p.evaluate("DATA_ALL = true"); return c, p
    cA, A = device()
    A.evaluate("db.papers.length = 0; db.papers.push(P('a', 'Uno'), P('b', 'Dos')); markDirty(); render()")

    # ---- 1. Copias de seguridad
    eq('al abrir se crea la copia del día', A.evaluate("bkList().then(L => [L.length, L[0].why])"), [1, 'Automática'])
    A.evaluate("bkDaily()"); A.wait_for_timeout(200)
    eq('solo una al día', A.evaluate("bkList().then(L => L.length)"), 1)
    A.evaluate("bkTake('Manual', true)"); A.wait_for_timeout(300)
    A.evaluate("db.papers.length = 0; markDirty(); render()")
    A.click('#pjBtn'); A.click('#ctx button:has-text("Copias de seguridad")'); A.wait_for_timeout(300)
    eq('el menú abre la ventana con las copias (la manual, con 2 papers)', ('2 papers' in A.inner_text('#bk'), A.evaluate("$('#bk').open")), (True, True))
    A.click('#bk button:has-text("Restaurar")'); A.wait_for_timeout(500)
    eq('restaurar recupera los papers (y se puede deshacer)', A.evaluate("[db.papers.map(p => p.id), (undo(), db.papers.length)]"), [['a', 'b'], 0])
    eq('antes de restaurar guarda el estado actual', A.evaluate("bkList().then(L => L.map(c => c.why))"), ['Antes de restaurar', 'Manual', 'Automática'])
    A.evaluate("redo(); db.settings.appName = 'Mi app'; applySettings(); bkTake('Prueba', true)"); A.wait_for_timeout(300)
    A.evaluate("bkRestore(2)"); A.wait_for_timeout(500)
    eq('restaurar no cambia los ajustes comunes', A.evaluate("[db.settings.appName, db.papers.length]"), ['Mi app', 2])
    A.evaluate("$('#bk').close(); bkDelete(0)"); A.wait_for_timeout(300)
    eq('se puede borrar una copia', A.evaluate("bkList().then(L => L.length)"), 4)
    A.evaluate("(async () => { for (let i = 0; i < 14; i++) { db.papers[0].title = 'v' + i; await bkTake('x' + i, true); } })()"); A.wait_for_timeout(800)
    eq('solo se guardan las últimas 10', A.evaluate("bkList().then(L => L.length)"), 10)
    A.evaluate("$('#bk').close()")

    # ---- 2. Duplicados
    A.evaluate("db.papers.length = 0; db.tags.push({id: 't1', name: 'Clave', color: '#000'}, {id: 't2', name: 'Otra', color: '#000'});"
      "db.papers.push(P('d1', 'Deep Learning: una revisión', {doi: '10.1/abc', tagIds: ['t1'], notes: [{id: 'n1', sectionId: '', content: 'nota uno'}], related: ['r1'], rating: 2}),"
      "P('d2', 'Otro título', {doi: 'https://doi.org/10.1/ABC', venue: 'Revista X', tagIds: ['t2'], notes: [{id: 'n2', sectionId: '', content: 'nota dos'}], related: ['r2'], rating: 5, reading: 'leido', general: 'Texto general'}),"
      "P('d3', 'deep learning una REVISIÓN'), P('r1', 'Relacionado 1', {related: ['d1']}), P('r2', 'Relacionado 2', {related: ['d2'], notes: [{id: 'n3', sectionId: '', content: 'ver [[p:d2]]'}]}), P('s1', 'Solo'));"
      "markDirty(); render(); dpOpen()")
    eq('encuentra el grupo por DOI (con o sin https://) y por título (sin tildes ni mayúsculas)', A.evaluate("dpGroups().map(g => g.map(p => p.id).sort())"), [['d1', 'd2', 'd3']])
    eq('lo muestra en una ventana', ('3 papers' in A.inner_text('#dp'), 'Quedarme con este' in A.inner_text('#dp')), (True, True))
    A.evaluate("dpMerge('d1', ['d1', 'd2', 'd3']); dpDraw()")
    eq('fusionar: el elegido completa vacíos y une etiquetas, notas y relaciones', A.evaluate("(k => [k.venue, k.tagIds, k.notes.map(n => n.content), k.related.sort(), k.rating, k.reading, k.general])(db.papers.find(p => p.id === 'd1'))"), ['Revista X', ['t1', 't2'], ['nota uno', 'nota dos'], ['r1', 'r2'], 5, 'leido', 'Texto general'])
    eq('los otros van a la papelera y sus relaciones apuntan al elegido', A.evaluate("[db.papers.map(p => p.id), db.trash.map(t => t.paper.id).sort(), db.papers.find(p => p.id === 'r2').related, db.papers.find(p => p.id === 'r2').notes[0].content]"), [['d1', 'r1', 'r2', 's1'], ['d2', 'd3'], ['d1'], 'ver [[p:d1]]'])
    eq('ya no quedan duplicados', A.evaluate("[dpGroups().length, $('#dp').innerText.includes('No hay papers duplicados')]"), [0, True])
    A.evaluate("$('#dp').close(); db.papers.push(P('z1', 'Mismo título'), P('z2', 'Mismo título')); dpOpen()")
    A.click('#dp button:has-text("No son duplicados")'); A.wait_for_timeout(100)
    eq('«No son duplicados» lo descarta', A.evaluate("dpGroups().length"), 0)
    A.evaluate("$('#dp').close(); db.papers = db.papers.filter(p => !p.id.startsWith('z'))")

    # ---- 3. Mover y copiar entre proyectos
    A.evaluate("db.sections.push({id: 'sc1', name: 'Intro', color: '#123456', tagIds: ['t1']}); db.papers.find(p => p.id === 'd1').sectionIds = ['sc1']; db.papers.find(p => p.id === 'd1').notes[0].sectionId = 'sc1'; db.papers.find(p => p.id === 'r1').related = ['d1']; db.papers.find(p => p.id === 'd1').related = ['r1']; markDirty()")
    A.evaluate("psOpen()"); A.wait_for_timeout(200)
    eq('sin papers seleccionados avisa', ('Selecciona antes' in A.inner_text('#toast'), A.evaluate("$('#ps').open")), (True, False))
    A.evaluate("pjNew()"); A.wait_for_timeout(600); A.keyboard.type('Destino'); A.keyboard.press('Enter'); A.evaluate("db.tags.push({id: 'zz', name: 'clave', color: '#999'}); markDirty()"); A.wait_for_timeout(600)
    A.evaluate("pjOpen(PJ.list[0].id)"); A.wait_for_timeout(800)
    A.evaluate("SEL.add('d1'); SEL.add('r1'); psOpen()"); A.wait_for_timeout(200)
    eq('ventana de destino con el otro proyecto', ('Destino' in A.inner_text('#ps'), A.evaluate("$('#ps').open")), (True, True))
    dest = A.evaluate("PJ.list.find(p => p.name === 'Destino').id")
    A.click('#ps .pji2'); A.wait_for_timeout(800)
    eq('copiar: siguen aquí', A.evaluate("[db.papers.some(p => p.id === 'd1'), db.papers.some(p => p.id === 'r1'), SEL.size]"), [True, True, 0])
    A.evaluate(f"pjOpen('{dest}')"); A.wait_for_timeout(800)
    eq('en el destino: papers, notas y relaciones entre ellos', A.evaluate("[db.papers.map(p => p.id).sort(), db.papers.find(p => p.id === 'd1').related, db.papers.find(p => p.id === 'd1').notes.map(n => n.content), db.papers.find(p => p.id === 'd1').related.length]"), [['d1', 'r1'], ['r1'], ['nota uno', 'nota dos'], 1])
    eq('las etiquetas se buscan por nombre (sin duplicar «Clave») y las que faltan se crean', A.evaluate("[db.tags.map(t => t.name).sort(), db.papers.find(p => p.id === 'd1').tagIds.includes('zz'), db.papers.find(p => p.id === 'd1').tagIds.length]"), [['Otra', 'clave'], True, 2])
    eq('la sección se crea con su nota enlazada', A.evaluate("[db.sections.map(s => s.name), db.papers.find(p => p.id === 'd1').notes[0].sectionId === db.sections[0].id, db.sections[0].tagIds]"), [['Intro'], True, ['zz']])
    A.evaluate("SEL.add('d1'); psOpen()"); A.click('#ps input[value=move]'); A.evaluate("document.querySelector('#ps .pji2').click()"); A.wait_for_timeout(500)
    eq('mover a un proyecto que ya tiene ese paper: llega con otro id', A.evaluate("[db.papers.map(p => p.id), db.papers[0].related]"), [['r1'], []])
    A.evaluate("pjOpen(PJ.list[0].id)"); A.wait_for_timeout(800)
    A.evaluate("SEL.add('s1'); psOpen()"); A.click('#ps input[value=move]'); A.evaluate("document.querySelector('#ps .pji2').click()"); A.wait_for_timeout(800)
    eq('mover: ya no está aquí', A.evaluate("[db.papers.some(p => p.id === 's1'), $('#toast').innerText.includes('movido')]"), [False, True])
    A.evaluate(f"pjOpen('{dest}')"); A.wait_for_timeout(800)
    eq('y está en el destino', A.evaluate("db.papers.some(p => p.id === 's1')"), True)
    # ---- 4. PDF enlazado
    A.evaluate("pjOpen(PJ.list[0].id)"); A.wait_for_timeout(800)
    A.evaluate("""window.__open = []; window.open = u => { window.__open.push(u); };
      window.__pickN = 0; window.showOpenFilePicker = async () => { window.__pickN++; return [{name: 'articulo.pdf', queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => new File(['%PDF-1.4 prueba'], 'articulo.pdf', {type: 'application/pdf'})}]; }; null""")
    A.evaluate("openPaper('d1'); tab = 'data'; drawD()")
    eq('en Datos hay una fila para enlazar el PDF', ('Enlazar un PDF' in A.inner_text('#dlg .pdfrow'), 'ninguno' in A.inner_text('#dlg .pdfrow')), (True, True))
    A.click('#dlg .pdfrow button:has-text("Enlazar")'); A.wait_for_timeout(300)
    eq('al elegirlo se guarda solo el nombre', A.evaluate("[D.pdf, window.__pickN]"), [{'name': 'articulo.pdf'}, 1])
    A.fill('#dlg .pdfrow input[type=number]', '7')
    eq('y la página donde abrirlo', A.evaluate("D.pdf"), {'name': 'articulo.pdf', 'page': 7})
    A.click('#dlg .pdfrow button:has-text("Abrir")'); A.wait_for_timeout(300)
    eq('abrir lo abre en otra pestaña en esa página, sin volver a pedirlo', A.evaluate("[window.__open.length, window.__open[0].startsWith('blob:'), window.__open[0].endsWith('#page=7'), window.__pickN]"), [1, True, True, 1])
    A.evaluate("commit()"); A.wait_for_timeout(300)
    eq('el JSON lleva el nombre y la página, sin datos del archivo', A.evaluate("JSON.parse(dbJSON()).papers.find(p => p.id === 'd1').pdf"), {'name': 'articulo.pdf', 'page': 7})
    eq('la tarjeta muestra el botón del PDF', A.evaluate("!!document.querySelector('.card[data-id=d1] button[data-onclick*=pdfOpen]')"), True)
    A.evaluate("PEND_PDF.clear(); window.__open = []; pdfOpen('d1')"); A.wait_for_timeout(400)
    eq('sin enlace en este navegador (otro dispositivo) pide elegir el archivo', A.evaluate("[window.__pickN, window.__open.length]"), [2, 1])
    eq('un JSON con datos raros en pdf se sanea', A.evaluate("[validate({papers: [{id: 'q', title: 't', authors: [], pdf: {name: 5}}, {id: 'r', title: 't', authors: [], pdf: {name: 'a.pdf', page: -3}}], tags: [], sections: []}).papers.map(p => p.pdf)]"), [[None, {'name': 'a.pdf'}]])
    A.evaluate("openPaper('d1'); tab = 'data'; drawD()"); A.click('#dlg .pdfrow button.x'); A.evaluate("commit()"); A.wait_for_timeout(300)
    eq('quitar el enlace', A.evaluate("db.papers.find(p => p.id === 'd1').pdf"), None)
    # ---- 5. Extras
    A.evaluate("""db.papers.length = 0; db.sections.length = 0; db.tags.length = 0; db.tags.push({id: 'tg1', name: 'Clave', color: '#000'});
      db.papers.push(P('c1', 'Primero', {authors: ['Pérez, Ana'], year: 2020, venue: 'Revista X', reading: 'leido', tagIds: ['tg1']}), P('c2', 'Segundo', {reading: 'leyendo'}), P('c3', 'Tercero'), P('c4', 'Cuarto', {reading: 'leido'}));
      markDirty(); render(); null""")
    eq('el progreso está desactivado por defecto', A.evaluate("[db.settings.showProgress, $('#pjProg').hidden]"), [False, True])
    A.evaluate("setCfg('showProgress', true)")
    eq('progreso en la cabecera: leídos del total', A.evaluate("[$('#pjProg').hidden, $('#pjProg small').textContent, $('#pjProg').title]"), [False, '2/4 leídos', 'Leído: 2 · Leyendo: 1 · Por leer: 1 (de 4 papers)'])
    eq('la barra tiene un tramo de leídos y otro de leyendo', A.evaluate("[...document.querySelectorAll('#pjProg .pjb i')].map(i => i.style.width)"), ['50%', '25%'])
    A.evaluate("db.papers.length = 0; render()")
    eq('sin papers no hay barra', A.evaluate("$('#pjProg').hidden"), True)
    A.evaluate("db.papers.push(P('c1', 'Primero', {authors: ['Pérez, Ana'], year: 2020, venue: 'Revista X', reading: 'leido', tagIds: ['tg1']}), P('c2', 'Segundo', {reading: 'leyendo'}), P('c3', 'Tercero')); render(); window.__clip = []; navigator.clipboard.write = async items => { window.__clip.push(await (await items[0].getType('text/plain')).text(), await (await items[0].getType('text/html')).text()); }; null")
    A.click('.card[data-id=c1] .cpb'); A.wait_for_timeout(300)
    eq('copiar cita: texto plano sin marcas y HTML con cursiva', A.evaluate("[window.__clip[0].includes('*'), window.__clip[0].includes('Pérez'), window.__clip[1].includes('<i>')]"), [False, True, True])
    A.evaluate("setView('table')"); A.wait_for_timeout(200)
    eq('en la tabla también está el botón', A.evaluate("!!document.querySelector('tr[data-id=c1] .cpb')"), True)
    A.evaluate("setView('cards')")
    # filtros guardados
    A.evaluate("F.read = 'leido'; F.tags.add('tg1'); F.sorts = [{k: 'year', d: -1}]; F.q = 'prim'; $('#q').value = 'prim'; render()")
    A.on('dialog', lambda d: None)   # (el manejador de la página ya acepta; el nombre llega con page.once más abajo)
    A.evaluate("window.prompt = () => 'Leídos de la clave'")
    A.click('#favSel + button'); A.wait_for_timeout(200)
    eq('guardar los filtros actuales con un nombre', A.evaluate("[FAV.map(f => f.name), $('#favSel').value, [...$('#favSel').options].map(o => o.textContent)]"), [['Leídos de la clave'], '0', ['⭐ Filtros guardados (1)…', 'Leídos de la clave']])
    A.evaluate("F.read = ''; F.tags.clear(); F.q = ''; $('#q').value = ''; F.sorts = [{k: 'title', d: 1}]; render()")
    A.select_option('#favSel', '0'); A.wait_for_timeout(200)
    eq('aplicarlos devuelve búsqueda, orden, etiquetas y lectura', A.evaluate("[F.q, F.read, [...F.tags], F.sorts, document.querySelectorAll('#list .card').length]"), ['prim', 'leido', ['tg1'], [{'k': 'year', 'd': -1}], 1])
    eq('se recuerdan al recargar (por proyecto)', (A.evaluate("idb('readonly', st => st.get('fav:' + PJ.cur)).then(a => a.length)")), 1)
    A.evaluate("db.tags.length = 0; render()"); A.select_option('#favSel', ''); A.select_option('#favSel', '0')
    eq('si una etiqueta ya no existe se ignora sin romper', A.evaluate("[F.tags.size, F.read]"), [0, 'leido'])
    A.evaluate("window.confirm = () => true"); A.select_option('#favSel', '0'); A.click('#favDel'); A.wait_for_timeout(200)
    eq('borrar los filtros guardados', A.evaluate("[FAV.length, $('#favDel').hidden]"), [0, True])
    # ---- 6. PDF a Google Drive
    from drive_falso import STORE, GOOGLE, drive, names, now
    def devD():
        c = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); c.add_init_script(GOOGLE); c.route('https://www.googleapis.com/**', drive)
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); p.on('dialog', lambda d: d.accept())
        p.goto('http://localhost:8795/index.html'); p.wait_for_timeout(1200); p.evaluate(f"window.P = {PAPER}"); p.evaluate("DATA_ALL = true"); return c, p
    cP, P1 = devD()
    P1.evaluate("db.papers.length = 0; db.papers.push(P('k1', 'Con PDF'), P('k2', 'Sin PDF')); markDirty(); null")
    P1.click('#syncBtn'); P1.click('#sy button:has-text("Continuar")'); P1.wait_for_timeout(1000); P1.click('#sy button:has-text("Aceptar")')
    P1.evaluate("""window.showOpenFilePicker = async () => [{name: 'articulo.pdf', queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFile: async () => new File(['%PDF-1.4 prueba'], 'articulo.pdf', {type: 'application/pdf'})}]; null""")
    P1.evaluate("openPaper('k1'); tab = 'data'; drawD()"); P1.click('#dlg .pdfrow button:has-text("Enlazar")'); P1.wait_for_timeout(200); P1.evaluate("commit()"); P1.wait_for_timeout(3800)
    eq('con la opción desactivada el PDF no se sube', names('gpapers-pdf-'), [])
    P1.evaluate("openCfg('da')")
    eq('en Configuración está la opción, con su explicación', ('Subir a mi Google Drive los PDF enlazados' in P1.inner_text('#cfg'), 'carpeta privada y oculta' in P1.inner_text('#cfg')), (True, True))
    P1.click('#cfg label:has-text("Subir a mi Google Drive") input'); P1.wait_for_timeout(300); P1.evaluate("$('#cfg').close()"); P1.wait_for_timeout(4200)
    eq('al activarla se sube el PDF a la carpeta oculta, tal cual', (names('gpapers-pdf-'), [f['content'] for f in STORE.values() if f['name'].startswith('gpapers-pdf-')], [f['parents'] for f in STORE.values() if f['name'].startswith('gpapers-pdf-')]), (['gpapers-pdf-k1'], ['%PDF-1.4 prueba'], [['appDataFolder']]))
    n1 = len([f for f in STORE.values() if f['name'].startswith('gpapers-pdf-')]); P1.evaluate("syRun(false)"); P1.wait_for_timeout(800)
    eq('si no cambia no se vuelve a subir', len([f for f in STORE.values() if f['name'].startswith('gpapers-pdf-')]), n1)
    eq('la opción se sincroniza con los ajustes comunes', P1.evaluate("db.settings.pdfDrive"), True)
    cQ, Q1 = devD()
    Q1.click('#syncBtn'); Q1.click('#sy button:has-text("Continuar")'); Q1.wait_for_timeout(1200); Q1.click('#sy button:has-text("Aceptar")')
    Q1.evaluate("window.__open = []; window.open = u => { window.__open.push(u); }; window.showOpenFilePicker = async () => { window.__pick = 1; throw Object.assign(Error('x'), {name: 'AbortError'}); }; null")
    eq('otro dispositivo: el paper llega con su PDF', Q1.evaluate("db.papers.find(p => p.id === 'k1').pdf"), {'name': 'articulo.pdf'})
    Q1.evaluate("pdfOpen('k1')"); Q1.wait_for_timeout(1000)
    eq('y lo abre descargándolo de Drive, sin pedir el archivo', Q1.evaluate("[window.__open.length, (window.__open[0] || '').startsWith('blob:'), window.__pick || 0]"), [1, True, 0])
    P1.evaluate("db.papers.find(p => p.id === 'k1').pdf = null; markDirty()"); P1.wait_for_timeout(3800)
    for f in STORE.values():
        if f['name'].startswith('gpapers-pdf-'): f['mt'] = '2020-01-01T00:00:00.000Z'
    P1.evaluate("syRun(false)"); P1.wait_for_timeout(1000)
    eq('al quitar el enlace se borra de Drive (pasado un día)', names('gpapers-pdf-'), [])
    eq('sin errores', [e for e in errs if 'could not be cloned' not in e], [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
