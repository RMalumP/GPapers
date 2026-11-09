# Pruebas de las columnas de la tabla (Chromium): ordenar por Secciones y Etiquetas desde su cabecera, mover columnas (menú y arrastrando),
# ocultarlas y volver a mostrarlas (clic derecho en el ordenador; botón «Columnas» en el móvil, sin pulsaciones largas), y guardarlo en el JSON.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0; delete db.settings.tblCols;
  ['zeta', 'alfa', 'beta'].forEach((n, i) => db.tags.push({id: 't' + i, name: n, color: '#2457c5'}));
  ['Tema C', 'Tema A', 'Tema B'].forEach((n, i) => db.sections.push({id: 's' + i, name: n, color: '#888888', tagIds: []}));
  const P = (id, t, tags, secs, y) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: y, venue: 'Rev', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: tags, notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'Uno', ['t0'], ['s0'], 2001), P('p2', 'Dos', ['t1', 't0'], ['s1'], 2002), P('p3', 'Tres', ['t2'], ['s2', 's1'], 2003), P('p4', 'Cuatro', [], [], 2004));
  db.settings.view = 'table'; F.sorts = [{k: 'title', d: 1}]; render(); }"""
heads = "[...document.querySelectorAll('.tbl thead th[data-col]')].map(t => t.dataset.col)"
cells = "[...document.querySelector('.tbl tbody tr.rw').children].map(t => t.className.split(' ')[0])"
titles = "visible().map(p => p.title)"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1300, 'height': 900}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400); pg.evaluate(SEED)
    eq('columnas por defecto', pg.evaluate(heads), ['title', 'author', 'year', 'venue', 'reading', 'rating', 'sections', 'tags', 'notes'])
    eq('cada celda lleva la clase de su columna', pg.evaluate(cells), ['c-sel', 'c-img', 'c-title', 'c-author', 'c-year', 'c-venue', 'c-reading', 'c-rating', 'c-sections', 'c-tags', 'c-notes', 'c-del'])
    eq('el botón «Columnas» sale en la vista de tabla', pg.is_visible('#tbCols'), True)
    # ---- ordenar por Etiquetas y Secciones desde la cabecera
    pg.click('.tbl th.c-tags'); pg.wait_for_timeout(50)
    eq('Etiquetas ▲ sin clasificaciones: por el orden de su lista (zeta, alfa, beta); sin etiquetas al final', pg.evaluate(titles), ['Uno', 'Dos', 'Tres', 'Cuatro'])
    eq('la cabecera marca el sentido', pg.evaluate("$('.tbl th.c-tags').textContent"), 'Etiquetas ▲')
    pg.click('.tbl th.c-tags'); pg.wait_for_timeout(50)
    eq('Etiquetas ▼: al revés, y sin etiquetas sigue al final', pg.evaluate(titles), ['Tres', 'Dos', 'Uno', 'Cuatro'])
    pg.click('.tbl th.c-sections'); pg.wait_for_timeout(50)
    eq('Secciones ▲ por el orden de su lista (Tema C, Tema A, Tema A+B)', pg.evaluate(titles), ['Uno', 'Dos', 'Tres', 'Cuatro'])
    pg.click('.tbl th.c-sections', button='right'); pg.wait_for_timeout(50)
    eq('clic derecho en la cabecera: menú de la columna', pg.evaluate("[!$('#ctx').hidden, $('#ctx .ctxh').textContent]"), [True, 'Columna «Secciones»'])
    pg.click('#ctx button:has-text("Ordenar de mayor a menor")'); pg.wait_for_timeout(50)
    eq('«de mayor a menor» desde el menú', pg.evaluate(titles + ".concat(F.sorts[0].k, F.sorts[0].d)"), ['Tres', 'Dos', 'Uno', 'Cuatro', 'sections', -1])
    # ---- con clasificaciones de etiquetas: la de más arriba manda y las de debajo desempatan
    pg.evaluate("""db.orders = [{id: 'o1', name: 'Prioridad', of: 'tags', fmt: 'num'}, {id: 'o2', name: 'Sub', of: 'tags', fmt: 'num'}, {id: 'o3', name: 'Sec', of: 'sections', fmt: 'num'}];
      db.tags[0].rk = {o1: '2', o2: '2'}; db.tags[1].rk = {o1: '2', o2: '1'}; db.tags[2].rk = {o1: '1'}; F.sorts = [{k: 'title', d: 1}]; render()""")
    pg.click('.tbl th.c-tags'); pg.wait_for_timeout(50)
    eq('Etiquetas ▲ con clasificaciones: «Prioridad» manda y «Sub» desempata', pg.evaluate(titles), ['Tres', 'Dos', 'Uno', 'Cuatro'])
    pg.evaluate("openMg('tags')"); pg.select_option('#mg .mgo select', 'o2'); pg.wait_for_timeout(50)
    eq('el gestor numera las clasificaciones y ofrece «Subir»', pg.evaluate("[[...$('#mg .mgo select').options].map(o => o.text.split(' ·')[0]), !!$('#mg button[data-onclick=\"mgOrdUp()\"]')]"), [['Ninguna (solo el orden de esta lista)', '1. Prioridad', '2. Sub'], True])
    pg.click('#mg button:has-text("Subir")'); pg.wait_for_timeout(50)
    eq('«Subir» la pone encima (sin tocar las de secciones)', pg.evaluate("db.orders.map(o => o.id)"), ['o2', 'o1', 'o3'])
    pg.evaluate("$('#mg').close()")
    eq('ahora manda «Sub»; sin valor en ella, detrás (y desempata «Prioridad»)', pg.evaluate(titles), ['Dos', 'Uno', 'Tres', 'Cuatro'])
    pg.evaluate("db.orders = []; db.tags.forEach(t => delete t.rk); F.sorts = [{k: 'sections', d: -1}]; render(); UNDO.length = 0")
    eq('«Ordenar» también ofrece Secciones y Etiquetas', pg.evaluate("['sections', 'tags'].map(k => [...$('#sortUI select').options].some(o => o.value === k))"), [True, True])
    # ---- mover columnas con el menú
    pg.click('.tbl th.c-year', button='right'); pg.wait_for_timeout(50)
    pg.click('#ctx button:has-text("Mover a la izquierda")'); pg.wait_for_timeout(80)
    eq('«Mover a la izquierda»', pg.evaluate(heads)[:4], ['title', 'year', 'author', 'venue'])
    eq('el menú sigue abierto para seguir moviendo', pg.evaluate("!$('#ctx').hidden && $('#ctx .ctxh').textContent"), 'Columna «Año»')
    pg.click('#ctx button:has-text("Mover a la izquierda")'); pg.wait_for_timeout(80)
    eq('puede ir antes del título', pg.evaluate(heads)[:3], ['year', 'title', 'author'])
    eq('en el borde, «a la izquierda» queda desactivado', pg.evaluate("[...document.querySelectorAll('#ctx button')].find(b => b.textContent.includes('Mover a la izquierda')).disabled"), True)
    eq('las filas siguen el mismo orden que la cabecera', pg.evaluate(cells)[:5], ['c-sel', 'c-img', 'c-year', 'c-title', 'c-author'])
    pg.evaluate("ctxClose()")
    # ---- arrastrar una cabecera sobre otra
    pg.drag_and_drop('.tbl th.c-year', '.tbl th.c-venue', target_position={'x': 60, 'y': 8}); pg.wait_for_timeout(80)
    eq('arrastrar «Año» y soltar en la mitad derecha de «Revista»', pg.evaluate(heads)[:4], ['title', 'author', 'venue', 'year'])
    pg.drag_and_drop('.tbl th.c-tags', '.tbl th.c-title', target_position={'x': 3, 'y': 8}); pg.wait_for_timeout(80)
    eq('arrastrar «Etiquetas» a la mitad izquierda del título', pg.evaluate(heads)[:3], ['tags', 'title', 'author'])
    eq('arrastrar una columna no mueve papers ni deja marcas', pg.evaluate("[db.papers.map(p => p.sectionIds.length), document.querySelectorAll('.colL,.colR,.over').length]"), [[1, 1, 2, 0], 0])
    # ---- ocultar y volver a mostrar
    pg.click('.tbl th.c-venue', button='right'); pg.wait_for_timeout(50)
    pg.click('#ctx button:has-text("Ocultar esta columna")'); pg.wait_for_timeout(80)
    eq('«Ocultar esta columna»', pg.evaluate(heads + ".includes('venue')"), False)
    eq('las filas tampoco la tienen', pg.evaluate("document.querySelectorAll('.tbl td.c-venue').length"), 0)
    pg.click('.tbl th.c-sel', button='right'); pg.wait_for_timeout(50)
    eq('clic derecho en una cabecera fija: solo la lista de columnas', pg.evaluate("[$('#ctx .ctxh').textContent.startsWith('Columnas que se ven'), $('#ctx .colck[data-col=venue]').textContent.trim(), $('#ctx .colck[data-col=title]').disabled]"), [True, 'Revista / editorial', True])
    pg.click('#ctx .colck[data-col=rating]'); pg.wait_for_timeout(80)
    eq('quitar otra desde la lista; el menú sigue abierto', pg.evaluate("[" + heads + ".includes('rating'), !$('#ctx').hidden, $('#ctx .colck[data-col=rating]').textContent.startsWith('✓')]"), [False, True, False])
    eq('la tabla ocupa menos al ocultar columnas', pg.evaluate("parseInt($('.tbl').style.minWidth)"), 980 - 100 - 100)
    pg.click('#ctx .colck[data-col=venue]'); pg.wait_for_timeout(80)
    eq('volver a mostrar una', pg.evaluate(heads + ".includes('venue')"), True)
    eq('se guarda en el JSON del proyecto', pg.evaluate("JSON.parse(JSON.stringify(validate(structuredClone(db)).settings.tblCols))"), {'order': ['tags', 'title', 'author', 'venue', 'year', 'reading', 'rating', 'sections', 'notes'], 'hidden': ['rating']})
    eq('no crea pasos de deshacer', pg.evaluate("UNDO.length"), 0)
    eq('notas desplegadas: ocupan todo el ancho visible', pg.evaluate("toggleNotes('p1'); [$('.tbl tr.rn td:last-child').colSpan + 1, $('.tbl tr.rw').children.length]"), [11, 11])
    eq('validate limpia valores raros y deja el título siempre visible', pg.evaluate("(() => { const d = validate({version: 1, papers: [], tags: [], sections: [], settings: {tblCols: {order: ['year', 'x1', 'year', 7], hidden: ['title', 'notes']}}}); db.settings.tblCols = d.settings.tblCols; const c = tblCols(); return [d.settings.tblCols.order, c.order.slice(0, 3), [...c.hidden]]; })()"), [['year'], ['title', 'author', 'year'], ['notes']])
    eq('los ajustes de columnas son de cada dispositivo (no se sincronizan)', pg.evaluate("[SY_LOCALSET.includes('tblCols'), 'tblCols' in syShared({tblCols: {hidden: ['year']}, view: 'table'})]"), [True, False])
    pg.evaluate("ctxClose(); render()"); pg.click('#tbCols'); pg.wait_for_timeout(50)
    pg.click('#ctx button:has-text("Restablecer las columnas")'); pg.wait_for_timeout(80)
    eq('«Restablecer» vuelve al orden de siempre', pg.evaluate(heads + ".concat('tblCols' in db.settings)"), ['title', 'author', 'year', 'venue', 'reading', 'rating', 'sections', 'tags', 'notes', False])
    pg.evaluate("setView('cards')")
    eq('en tarjetas no sale el botón «Columnas»', pg.is_visible('#tbCols'), False)
    eq('sin errores (escritorio)', errs, [])
    ctx.close()
    # ---- móvil: botón «Columnas» (toques normales, sin pulsación larga)
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.wait_for_timeout(100)
    eq('móvil: el botón ⚙ «Columnas», pequeño, en la barra de Tarjetas', pg.evaluate("(() => { const a = $('#tbCols').getBoundingClientRect(), v = $('#tbView').getBoundingClientRect(); return [a.width > 0, a.width < 60, Math.abs(a.top - v.top) < 3, a.left > v.left]; })()"), [True, True, True, True])
    pg.tap('#tbCols'); pg.wait_for_timeout(80)
    eq('móvil: abre la lista de columnas', pg.evaluate("[!$('#ctx').hidden, document.querySelectorAll('#ctx .colck').length]"), [True, 9])
    pg.tap('#ctx .colck[data-col=year]'); pg.wait_for_timeout(120)
    eq('móvil: ocultar el año con un toque; el menú sigue abierto', pg.evaluate("[document.querySelectorAll('.tbl td.c-year').length, !$('#ctx').hidden]"), [0, True])
    pg.tap('#ctx .colck[data-col=year]'); pg.wait_for_timeout(120)
    pg.tap('#ctx .colr:has([data-col=tags]) .colmv >> nth=0'); pg.wait_for_timeout(120)
    eq('móvil: ↑ mueve la columna antes', pg.evaluate("tblCols().order.slice(5, 8)"), ['rating', 'tags', 'sections'])
    eq('móvil: 2.ª línea autores · año · revista', pg.evaluate("$('.tbl tr.rw .mvm').textContent"), 'Pérez, Juan·2004·Rev')
    eq('móvil: 2.ª línea, el resto en su orden (etiquetas antes que secciones tras ↑)', pg.evaluate("[...$('.tbl tr.rw .mvx').children].map(e => e.className.split(' ')[0])"), ['mvm', 'c-reading', 'c-rating', 'c-tags', 'c-sections', 'c-notes'])
    pg.evaluate("ctxClose(); setTblCols(['year', 'tags', 'title', 'author', 'venue', 'reading', 'rating', 'sections', 'notes'], ['venue', 'rating'])"); pg.wait_for_timeout(100)
    eq('móvil: con columnas ocultas y movidas la ficha sigue cabiendo en la pantalla (✕ y notas a la vista)', pg.evaluate("(() => { const r = $('.tbl tr.rw'), w = innerWidth, R = s => r.querySelector(s).getBoundingClientRect(); return [r.getBoundingClientRect().width <= w, R('.c-del').right <= w, R('.c-notes').right <= w, $('.tbl tr.rw .mvm').textContent, [...$('.tbl tr.rw .mvx').children].map(e => e.className.split(' ')[0])]; })()"),
       [True, True, True, '2004·Pérez, Juan', ['mvm', 'c-tags', 'c-reading', 'c-sections', 'c-notes']])
    eq('móvil: dos líneas: autores · año y el resto, juntos debajo del título', pg.evaluate("(() => { const r = $('.tbl tr.rw'), R = s => r.querySelector(s).getBoundingClientRect(); return [R('.mvm').top > R('.c-title').bottom - 2, Math.abs(R('.mvm').top + R('.mvm').height / 2 - (R('.c-notes').top + R('.c-notes').height / 2)) < 4]; })()"), [True, True])
    eq('móvil: las cabeceras no están (no hay toques falsos sobre ellas)', pg.is_visible('.tbl thead'), False)
    eq('sin errores (móvil)', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas de columnas OK'); sys.exit(1 if fail else 0)
