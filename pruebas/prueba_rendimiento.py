# Pruebas de rendimiento (Chromium): deshacer con imágenes, repintado de un solo paper, selección sin repintar y lista por partes.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
SEED = """N => { db.papers.length = 0; db.sections.length = 0; db.tags.length = 0; F.sorts = [{k: 'title', d: 1}]; F.group = false; F.q = ''; F.minRating = 0; F.read = ''; F.tags.clear(); SEL.clear();
  for (let i = 0; i < N; i++) db.papers.push(NEWF({id: 'p' + i, title: 'Paper ' + String(i).padStart(4, '0'), authors: ['Pérez, Juan'], year: 2000 + i % 20, venue: 'Rev', type: 'articulo', doi: '', url: '', accessed: '', general: '', notes: [], tagIds: [], sectionIds: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0}));
  UNDO.length = 0; REDO.length = 0; lastSnap = snapDb(); render(); }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
    # ---- Deshacer: las imágenes incrustadas no se copian en cada paso
    pg.evaluate(SEED, 3)
    pg.evaluate("img => { db.papers[0].image = {kind: 'data', data: img}; markDirty(); }", IMG)
    pg.evaluate("lastRecAt = 0; db.papers[1].title = 'Cambio'; markDirty()")
    eq('la copia para deshacer no lleva la imagen', pg.evaluate("img => UNDO.some(u => u.includes(img))", IMG), False)
    eq('sin imágenes la copia es el JSON de siempre', pg.evaluate("(db.papers[0].image = null, snapDb() === JSON.stringify(db))"), True)
    pg.evaluate("img => { db.papers[0].image = {kind: 'data', data: img}; }", IMG)
    pg.evaluate("undo()")
    eq('deshacer devuelve la imagen entera', pg.evaluate("[db.papers[0].image?.data?.length, db.papers[1].title]"), [len(IMG), 'Paper 0001'])
    pg.evaluate("undo()")
    eq('y el paso anterior, sin imagen', pg.evaluate("db.papers[0].image ?? null"), None)
    pg.evaluate("redo()")
    eq('rehacer también', pg.evaluate("db.papers[0].image?.data"), IMG)
    # ---- Repintado de un solo paper
    pg.evaluate(SEED, 5)
    pg.evaluate("window._other = $('#list [data-id=\"p3\"]')")
    pg.evaluate("setRating('p1', 4)")
    eq('valorar repinta solo esa tarjeta', pg.evaluate("[$('#list [data-id=\"p3\"]') === window._other, db.papers[1].rating, !!$('#list [data-id=\"p1\"] .stv')]"), [True, 4, True])
    pg.evaluate("cycleRead('p1')")
    eq('cambiar la lectura también', pg.evaluate("[$('#list [data-id=\"p3\"]') === window._other, $('#list [data-id=\"p1\"] .rd').textContent.includes(READ[db.papers[1].reading])]"), [True, True])
    pg.evaluate("toggleNotes('p1')")
    eq('desplegar notas también', pg.evaluate("[$('#list [data-id=\"p3\"]') === window._other, !!$('#list [data-id=\"p1\"] .nts')]"), [True, True])
    pg.evaluate("toggleNotes('p1'); F.minRating = 4; render(); window._other = $('#list [data-id=\"p1\"]'); setRating('p1', 0)")
    eq('con filtro de valoración se repinta la lista y el paper sale', pg.evaluate("document.querySelectorAll('#list .card').length"), 0)
    pg.evaluate("F.minRating = 0; setView('table'); window._other = $('#list tr[data-id=\"p3\"]'); toggleNotes('p1')")
    eq('en la tabla, la fila y sus notas', pg.evaluate("[$('#list tr[data-id=\"p3\"]') === window._other, $('#list tr[data-id=\"p1\"]').nextElementSibling.className]"), [True, 'rn'])
    pg.evaluate("toggleNotes('p1')")
    eq('al plegarlas desaparece la fila de notas', pg.evaluate("document.querySelectorAll('#list tr.rn').length"), 0)
    pg.evaluate("setView('cards')")
    # ---- Seleccionar no repinta la lista
    pg.evaluate("window._other = $('#list [data-id=\"p3\"]'); toggleSel('p2')")
    eq('seleccionar no repinta', pg.evaluate("[$('#list [data-id=\"p3\"]') === window._other, $('#list [data-id=\"p2\"] input[type=checkbox]').checked, $('#sg-sel').hidden, $('#count').textContent]"), [True, True, False, '5 de 5 · 1 sel.'])
    pg.evaluate("toggleSel('p2')")
    eq('quitar la selección', pg.evaluate("[$('#list [data-id=\"p2\"] input[type=checkbox]').checked, $('#sg-sel').hidden]"), [False, True])
    # ---- Listas largas por partes
    pg.evaluate(SEED, 400)
    eq('400 papers: se pintan 150 y el botón', pg.evaluate("[document.querySelectorAll('#list .card').length, !!$('#list > .more')]"), [150, True])
    eq('el contador cuenta todos', pg.evaluate("$('#count').textContent"), '400 de 400 · 0 sel.')
    pg.evaluate("listMore()")
    eq('mostrar más añade otros 150', pg.evaluate("document.querySelectorAll('#list .card').length"), 300)
    pg.evaluate("listMore()")
    eq('y al final no queda botón', pg.evaluate("[document.querySelectorAll('#list .card').length, !!$('#list > .more')]"), [400, False])
    pg.evaluate("render(); $('#list > .more').scrollIntoView()"); pg.wait_for_timeout(400)
    eq('al llegar al final se añaden solos', pg.evaluate("document.querySelectorAll('#list .card').length") > 150, True)
    pg.evaluate("setView('table')")
    eq('en la tabla también por partes', pg.evaluate("[document.querySelectorAll('#list tr.rw').length, !!$('#list > .more')]"), [150, True])
    pg.evaluate("while ($('#list > .more')) listMore()")
    eq('y las filas nuevas van en la misma tabla', pg.evaluate("[document.querySelectorAll('#list tr.rw').length, document.querySelectorAll('#list table').length]"), [400, 1])
    pg.evaluate("setView('cards'); F.group = true; render()")
    eq('agrupado por sección se pinta todo', pg.evaluate("document.querySelectorAll('#list .card').length"), 400)
    pg.evaluate("F.group = false; selVisible()")
    eq('seleccionar visibles incluye los que aún no se han pintado', pg.evaluate("SEL.size"), 400)
    pg.evaluate("selNone(); F.q = 'paper 0399'; render()")
    eq('la búsqueda encuentra los del final', pg.evaluate("[document.querySelectorAll('#list .card').length, !!$('#list > .more')]"), [1, False])
    # ---- Eventos sin manejadores en línea (CSP)
    pg.evaluate(SEED, 3)
    CHECK = """() => { const bad = [];   // cada data-on… que haya en la página se puede leer y todos sus nombres existen
      for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (a.name.startsWith('data-on')) {
        try { const walk = x => { if (x.t === 'ref') { if (!['this', 'event'].includes(x.root) && !(x.root in ON_VARS) && window[x.root] === undefined) bad.push(x.root + ' ← ' + a.value); x.ops.forEach(o => o.a && o.a.forEach(walk)); } else if (x.e) walk(x.e); else if (x.a) x.a.forEach(walk); };
          onParse(a.value).forEach(walk); } catch (e) { bad.push(String(e)); } }
      for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (/^on[a-z]+$/.test(a.name)) bad.push('en línea: ' + a.name + '=' + a.value);
      return bad; }"""
    views = ["render()", "setView('table')", "setView('cards'); F.group = true; render()", "F.group = false; render()",
      "openPaper('p0'); tab = 'data'; drawD()", "DATA_ALL = true; drawD()", "tab = 'notes'; drawD()", "tab = 'cite'; drawD()", "tab = 'rel'; drawD()", "tab = 'hist'; drawD()", "$('#dlg').close()",
      "openCfg()", "$('#cfg').close()", "openEx()", "$('#ex').close()", "openHelp()", "$('#help').close()", "openMg('tags')", "$('#mg').close()", "openMg('sections')", "$('#mg').close()",
      "openImport('text')", "$('#imp').close()", "trOpen()", "$('#tr').close()", "grOpen()", "$('#gr').close()", "svOpen('')", "$('#sv').close()", "openCred()", "$('#cr').close()", "openPriv()", "$('#pv').close()"]
    bad = []
    for v in views:
        pg.evaluate(v); pg.wait_for_timeout(50); bad += pg.evaluate(CHECK)
    eq('todos los data-on de las vistas se leen y sus nombres existen', sorted(set(bad)), [])
    pg.evaluate("document.body.insertAdjacentHTML('beforeend', '<button id=\"inl\" onclick=\"window.__inl = 1\">x</button>')"); pg.click('#inl')
    eq('la CSP bloquea un onclick en línea', pg.evaluate("window.__inl === undefined"), True)
    pg.evaluate("$('#inl').remove()")
    pg.click('#tbView')
    eq('los data-onclick funcionan (cambiar a tabla)', pg.evaluate("db.settings.view"), 'table'); pg.click('#tbView')
    pg.fill('#q', 'paper 0002'); pg.press('#q', 'Enter')
    eq('y los de teclado (Enter en la búsqueda)', pg.evaluate("document.querySelectorAll('#list .card').length"), 1); pg.fill('#q', ''); pg.press('#q', 'Enter')
    pg.click('#pjBtn')
    eq('currentTarget es el botón, como en línea (menú de proyectos)', pg.evaluate("!$('#ctx').hidden && $('#ctx').querySelectorAll('button').length > 2"), True)
    pg.mouse.click(5, 790)
    eq('y un clic fuera lo cierra', pg.evaluate("$('#ctx').hidden"), True)
    errs[:] = [e for e in errs if 'Content Security Policy' not in e and 'Content-Security-Policy' not in e]   # el aviso de la CSP al bloquear el onclick de prueba
    eq('sin errores en la consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
