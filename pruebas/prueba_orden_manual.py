# Pruebas del orden manual (v39.25): arrastrar papers para colocarlos dentro de su sección (ordenador y móvil), sin agrupar,
# posiciones guardadas (📌 en la barra lateral), plegar y desplegar secciones, y que lo guardado se valide al cargar.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0; db.manual = {}; db.posSaves = [];
  db.sections.push({id: 'sa', name: 'Tema A', color: '#2457c5', tagIds: []}, {id: 'sb', name: 'Tema B', color: '#c52457', tagIds: []});
  const P = (id, t, secs) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'A uno', ['sa']), P('p2', 'B dos', ['sa']), P('p3', 'C tres', ['sa']), P('p4', 'D cuatro', ['sb']));
  F.group = true; F.sorts = [{k: 'title', d: 1}]; FOLD.clear(); setView('cards'); render(); }"""
order = "[...document.querySelectorAll('#list .gbox')].map(g => g.dataset.sec + ':' + [...g.querySelectorAll('[data-id]')].map(c => c.dataset.id).join(','))"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    # ---------- ordenador
    c = b.new_context(viewport={'width': 1300, 'height': 900}, service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    eq('de partida, por título', pg.evaluate(order), ['sa:p1,p2,p3', 'sb:p4', ':'])
    def ddrop(src, dst, after):
        box = pg.locator(dst).bounding_box()
        pg.locator(src).drag_to(pg.locator(dst), target_position={'x': box['width'] / 2, 'y': box['height'] * (0.85 if after else 0.15)})
        pg.wait_for_timeout(150)
    ddrop('#list .card[data-id=p3]', '#list .card[data-id=p1]', False)
    eq('arrastrar p3 sobre la mitad de arriba de p1: queda delante', pg.evaluate(order), ['sa:p3,p1,p2', 'sb:p4', ':'])
    eq('pasa a «Orden manual» y lo guarda', pg.evaluate("[F.sorts[0].k, db.manual.sa]"), ['manual', ['p3', 'p1', 'p2']])
    ddrop('#list .card[data-id=p3]', '#list .card[data-id=p2]', True)
    eq('sobre la mitad de abajo: queda detrás', pg.evaluate(order), ['sa:p1,p2,p3', 'sb:p4', ':'])
    ddrop('#list .card[data-id=p2]', '#list .card[data-id=p4]', False)
    eq('sobre un paper de otra sección: cambia de sección y queda en esa posición', [pg.evaluate(order), pg.evaluate("db.papers.find(p => p.id === 'p2').sectionIds")], [['sa:p1,p3', 'sb:p2,p4', ':'], ['sb']])
    pg.evaluate("db.papers.push(NEWF({...structuredClone(db.papers[0]), id: 'p5', title: '0 nuevo'})); render()")
    eq('un paper nuevo va al final de su sección', pg.evaluate(order), ['sa:p1,p3,p5', 'sb:p2,p4', ':'])
    pg.evaluate("F.sorts = [{k: 'title', d: 1}]; render()")
    eq('con otro orden se ve ese orden', pg.evaluate(order)[0], 'sa:p5,p1,p3')
    pg.evaluate("F.sorts = [{k: 'manual', d: 1}]; render()")
    eq('y al volver a «Orden manual» se recupera', pg.evaluate(order)[0], 'sa:p1,p3,p5')
    # ---- posiciones guardadas
    eq('botón 📌 en la barra lateral', pg.evaluate("$('#posB').textContent.trim()"), '📌 Posiciones guardadas…')
    pg.click('#posB'); pg.fill('#posName', 'Capítulo 2'); pg.press('#posName', 'Enter'); pg.wait_for_timeout(100)
    eq('guardar con Intro', pg.evaluate("[db.posSaves.length, db.posSaves[0].name, db.posSaves[0].manual.sa, $('#ctx').hidden]"), [1, 'Capítulo 2', ['p1', 'p3', 'p5'], True])
    ddrop('#list .card[data-id=p5]', '#list .card[data-id=p1]', False)
    eq('cambio el orden', pg.evaluate(order)[0], 'sa:p5,p1,p3')
    pg.evaluate("F.sorts = [{k: 'year', d: 1}]; render()")
    pg.click('#posB'); pg.click('#ctx button:has-text("Capítulo 2")'); pg.wait_for_timeout(100)
    eq('recuperar: vuelve ese orden y «Orden manual»', [pg.evaluate(order)[0], pg.evaluate("F.sorts[0].k")], ['sa:p1,p3,p5', 'manual'])
    pg.click('#posB'); pg.click('#ctx .colr button.colmv'); pg.wait_for_timeout(100)
    eq('borrar una: el menú sigue abierto y ya no está', pg.evaluate("[db.posSaves.length, !$('#ctx').hidden, $('#ctx').querySelectorAll('.colr').length]"), [0, True, 0])
    pg.keyboard.press('Escape')
    # ---- plegar
    pg.click('#list .gbox[data-sec=sa] h2'); pg.wait_for_timeout(100)
    eq('clic en el título de la sección: se pliega', pg.evaluate("[$('#list .gbox[data-sec=sa]').classList.contains('fold'), $('#list .gbox[data-sec=sa]').querySelectorAll('[data-id]').length, $('#list .gbox[data-sec=sa] .gcar').textContent, $('#list .gbox[data-sec=sa] small').textContent]"), [True, 0, '▸', '(3)'])
    eq('se recuerda en este dispositivo', pg.evaluate("JSON.parse(localStorage.getItem('gp-fold'))"), ['sa'])
    pg.click('#list .gbox[data-sec=sa] h2'); pg.wait_for_timeout(100)
    eq('otro clic: se despliega', pg.evaluate("$('#list .gbox[data-sec=sa]').classList.contains('fold')"), False)
    pg.evaluate("gFoldAll(true)"); pg.wait_for_timeout(100)
    eq('«Plegar todas»', pg.evaluate("document.querySelectorAll('#list .gbox:not(.fold)').length"), 0)
    pg.evaluate("groupMenu(new MouseEvent('contextmenu', {clientX: 300, clientY: 200}))")
    eq('el menú de agrupar trae «Desplegar todas»', pg.evaluate("[...document.querySelectorAll('#ctx button')].some(b => b.textContent.includes('Desplegar todas'))"), True)
    pg.evaluate("ctxClose(); gFoldAll(false)"); pg.wait_for_timeout(100)
    eq('«Desplegar todas»', pg.evaluate("document.querySelectorAll('#list .gbox.fold').length"), 0)
    # ---- sin agrupar
    pg.evaluate(SEED); pg.evaluate("F.group = false; render()"); pg.wait_for_timeout(100)
    ddrop('#list .card[data-id=p4]', '#list .card[data-id=p1]', False)
    eq('sin agrupar también se colocan a mano (clave «*»)', [pg.evaluate("[...document.querySelectorAll('#list .card')].map(c => c.dataset.id)"), pg.evaluate("db.manual['*']")], [['p4', 'p1', 'p2', 'p3'], ['p4', 'p1', 'p2', 'p3']])
    # ---- tabla
    pg.evaluate("F.group = true; setView('table')"); pg.wait_for_timeout(100)
    ddrop('#list tr.rw[data-id=p3]', '#list tr.rw[data-id=p1]', False)
    eq('en la tabla también', pg.evaluate("[...document.querySelectorAll('#list .gbox[data-sec=sa] tr.rw')].map(r => r.dataset.id)"), ['p3', 'p1', 'p2'])
    # ---- validar al cargar
    eq('validar: limpia manual y posiciones guardadas mal formadas', pg.evaluate("""(() => { const d = structuredClone(db); d.manual = {sa: ['p1', 7, 'p2'], x: 'mal'}; d.posSaves = [{id: 'k', name: 'Ok', manual: {sa: ['p2']}}, {name: 3}, 'basura'];
      const v = validate(d); return [v.manual, v.posSaves.map(x => x.name)]; })()"""), [{'sa': ['p1', 'p2']}, ['Ok']])
    eq('sin errores (ordenador)', errs, [])
    c.close()
    # ---------- móvil
    c = b.new_context(**pw.devices['Pixel 7'], service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    cdp = c.new_cdp_session(pg)
    def touch(kind, x=0, y=0): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})
    def pt(sel, fy): return pg.evaluate(f"(() => {{ const r = document.querySelector({json.dumps(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * {fy}]; }})()")
    def drag(src, dst, fy):
        x, y = pt(src, 0.5); touch('touchStart', x, y); pg.wait_for_timeout(600); tx, ty = pt(dst, fy)
        for i in range(1, 9): touch('touchMove', x + (tx - x) * i / 8, y + (ty - y) * i / 8); pg.wait_for_timeout(30)
        st = pg.evaluate("[...document.querySelectorAll('.insB,.insA')].map(e => e.dataset.id + (e.classList.contains('insA') ? '↓' : '↑'))")
        touch('touchEnd'); pg.wait_for_timeout(200); return st
    st = drag('#list .card[data-id=p3] h3', '#list .card[data-id=p1]', 0.2)
    eq('móvil: mantener y mover marca dónde caerá', st, ['p1↑'])
    eq('móvil: al soltar se coloca ahí', pg.evaluate(order), ['sa:p3,p1,p2', 'sb:p4', ':'])
    drag('#list .card[data-id=p3] h3', '#list .card[data-id=p2]', 0.8)
    eq('móvil: detrás de otro', pg.evaluate(order), ['sa:p1,p2,p3', 'sb:p4', ':'])
    eq('móvil: no queda nada marcado', pg.evaluate("document.querySelectorAll('.insA,.insB,.over,.drag,.mvghost').length"), 0)
    pg.tap('#list .gbox[data-sec=sa] h2'); pg.wait_for_timeout(100)
    eq('móvil: tocar el título pliega', pg.evaluate("$('#list .gbox[data-sec=sa]').classList.contains('fold')"), True)
    eq('sin errores (móvil)', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas de orden manual OK'); sys.exit(1 if fail else 0)
