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
        p.goto('http://localhost:8795/index.html'); p.wait_for_timeout(1200); p.evaluate(f"window.P = {PAPER}"); return c, p
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
    eq('sin errores', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
