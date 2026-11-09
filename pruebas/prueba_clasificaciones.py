# Pruebas de las clasificaciones para ordenar (Chromium): crearlas en Gestionar etiquetas/secciones, poner valores (números, letras,
# romanos, texto), ordenar los papers por ellas, guardarlas en el JSON y fusionarlas con Google Drive.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
DAYS = ['viernes', 'lunes', 'miércoles', 'martes', 'jueves']
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0; db.orders = [];
  %s.forEach((n, i) => db.tags.push({id: 'd' + i, name: n, color: '#2457c5'}));
  ['Tema A', 'Tema B', 'Tema C'].forEach((n, i) => db.sections.push({id: 's' + i, name: n, color: '#888888', tagIds: []}));
  const P = (id, t, tags, secs) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: tags, notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  %s.forEach((n, i) => db.papers.push(P('p' + i, 'Seminario del ' + n, ['d' + i], ['s' + (i %% 3)])));
  db.papers.push(P('px', 'Sin día', [], []));
  F.sorts = [{k: 'title', d: 1}]; render(); }""" % (json.dumps(DAYS), json.dumps(DAYS))
titles = "visible().map(p => p.title.replace('Seminario del ', ''))"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400); pg.evaluate(SEED)
    # ---- valores
    eq('números', pg.evaluate("['1', '2,5', '10', 'x'].map(v => ordVal({fmt: 'num'}, v))"), [1, 2.5, 10, None])
    eq('letras (A=1 … Z=26, AA=27; minúsculas también)', pg.evaluate("['A', 'c', 'Z', 'AA', '1'].map(v => ordVal({fmt: 'alpha'}, v))"), [1, 3, 26, 27, None])
    eq('números romanos', pg.evaluate("['I', 'iv', 'IX', 'XIV', 'MCMXCIV', 'ABC'].map(v => ordVal({fmt: 'roman'}, v))"), [1, 4, 9, 14, 1994, None])
    eq('texto libre y vacío', pg.evaluate("[ordVal({fmt: 'text'}, ' Beta '), ordVal({fmt: 'num'}, '')]"), ['Beta', None])
    # ---- crear una clasificación desde Gestionar etiquetas y poner valores
    pg.evaluate("openMg('tags')"); pg.click('#mg button:has-text("Nueva clasificación")'); pg.fill('#mgoName', 'Días'); pg.click('#mg .mgof button:has-text("Guardar")'); pg.wait_for_timeout(100)
    eq('se crea, de etiquetas y con números, y queda elegida', pg.evaluate("[db.orders.length, db.orders[0].name, db.orders[0].of, db.orders[0].fmt, MGO === db.orders[0].id, document.querySelectorAll('#mg .mgk').length]"), [1, 'Días', 'tags', 'num', True, 5])
    V = {'lunes': '1', 'martes': '2', 'miércoles': '3', 'jueves': '4', 'viernes': '5'}
    for i, d in enumerate(DAYS): pg.fill(f'#mg .mgr >> nth={i} >> .mgk', V[d])
    eq('cada etiqueta guarda su valor', pg.evaluate("db.tags.map(t => t.rk[db.orders[0].id])"), [V[d] for d in DAYS])
    pg.click('#mg button:has-text("Ordenar los papers")'); pg.wait_for_timeout(100)
    eq('ordena los papers por la clasificación; sin valor, al final', pg.evaluate(titles), ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'Sin día'])
    pg.evaluate("sortFlip(0)")
    eq('al revés, y los que no tienen valor siguen al final', pg.evaluate(titles), ['viernes', 'jueves', 'miércoles', 'martes', 'lunes', 'Sin día'])
    eq('«Ordenar» la ofrece entre sus criterios', pg.evaluate("[...$('#sortUI select').options].some(o => o.text === '🏷️ Días' && o.selected)"), True)
    pg.evaluate("sortFlip(0)")
    # ---- otra clasificación, en romanos, y un valor mal escrito
    pg.evaluate("openMg('tags')"); pg.click('#mg button:has-text("Nueva clasificación")'); pg.fill('#mgoName', 'Bloques'); pg.select_option('#mgoFmt', 'roman'); pg.click('#mg .mgof button:has-text("Guardar")'); pg.wait_for_timeout(100)
    R = {'lunes': 'III', 'martes': 'II', 'miércoles': 'I', 'jueves': 'IIII', 'viernes': 'IV'}
    for i, d in enumerate(DAYS): pg.fill(f'#mg .mgr >> nth={i} >> .mgk', R[d])
    eq('varias clasificaciones a la vez, cada una con sus valores', pg.evaluate("[db.orders.length, db.tags.find(t => t.name === 'lunes').rk]").__len__(), 2)
    eq('un valor que no se entiende se marca', pg.evaluate("[...document.querySelectorAll('#mg .mgk.bad')].map(i => i.value)"), ['IIII'])
    pg.click('#mg button:has-text("Ordenar también esta lista")'); pg.wait_for_timeout(100)
    eq('«Ordenar también esta lista» reordena las etiquetas (las que no tienen valor válido, al final)', pg.evaluate("db.tags.map(t => t.name)"), ['miércoles', 'martes', 'lunes', 'viernes', 'jueves'])
    pg.evaluate("$('#mg').close(); F.sorts = [{k: 'o:' + db.orders[1].id, d: 1}, {k: 'title', d: 1}]; render()")
    eq('ordena con romanos y desempata con el siguiente criterio', pg.evaluate(titles), ['miércoles', 'martes', 'lunes', 'viernes', 'jueves', 'Sin día'])
    # ---- secciones, con letras
    pg.evaluate("openMg('sections')")
    eq('las clasificaciones de etiquetas no salen en secciones', pg.evaluate("[...document.querySelectorAll('#mg .mgo select option')].length"), 1)
    pg.click('#mg button:has-text("Nueva clasificación")'); pg.fill('#mgoName', 'Prioridad'); pg.select_option('#mgoFmt', 'alpha'); pg.click('#mg .mgof button:has-text("Guardar")'); pg.wait_for_timeout(100)
    for i, v in enumerate(['C', 'A', 'B']): pg.fill(f'#mg .mgr >> nth={i} >> .mgk', v)
    eq('dos líneas por sección también con el valor (escritorio: una fila)', pg.evaluate("document.querySelectorAll('#mg .mgr .mgk').length"), 3)
    pg.click('#mg button:has-text("Ordenar los papers")'); pg.wait_for_timeout(100)
    eq('ordena por secciones con letras', pg.evaluate("visible().map(p => p.sectionIds[0] || '-')"), ['s1', 's1', 's2', 's0', 's0', '-'])
    # ---- editar y borrar
    pg.evaluate("openMg('tags'); mgOrdSel(db.orders[0].id)"); pg.click('#mg button:has-text("Editar")'); pg.fill('#mgoName', 'Días de la semana'); pg.click('#mg .mgof button:has-text("Guardar")')
    eq('se renombra', pg.evaluate("db.orders[0].name"), 'Días de la semana')
    pg.evaluate("F.sorts = [{k: 'o:' + db.orders[0].id, d: 1}]; render()"); pg.click('#mg button:has-text("Borrar")'); pg.wait_for_timeout(200)
    eq('al borrarla se quitan sus valores y deja de ordenar (vuelve a Título)', pg.evaluate("[db.orders.map(o => o.name), db.tags.every(t => !t.rk || !(Object.keys(t.rk).length > 1)), F.sorts.map(s => s.k)]"), [['Bloques', 'Prioridad'], True, ['title']])
    pg.evaluate("$('#mg').close()")
    # ---- JSON y Google Drive
    eq('se guardan en el JSON y se leen igual', pg.evaluate("(d => [d.orders.map(o => [o.name, o.of, o.fmt]), d.tags.find(t => t.name === 'lunes').rk[d.orders[0].id]])(validate(JSON.parse(JSON.stringify(db))))"), [[['Bloques', 'tags', 'roman'], ['Prioridad', 'sections', 'alpha']], 'III'])
    eq('un JSON con clasificaciones raras se sanea', pg.evaluate("(d => [d.orders.map(o => [o.name, o.fmt]), d.tags[0].rk])(validate({papers: [], sections: [], tags: [{id: 't', name: 'x', rk: {a: 3, b: 'II'}}], orders: [{id: 'b', name: 'B', of: 'tags', fmt: 'raro'}, {id: 'c', of: 'tags'}, {id: 'd', name: 'D', of: 'otro'}]}))"), [[['B', 'num']], {'b': 'II'}])
    eq('Drive: las clasificaciones creadas en dos dispositivos se unen y los valores también', pg.evaluate("""(() => { const B = {papers: [], tags: [{id: 't', name: 'x'}], sections: [], orders: []};
      const L = structuredClone(B); L.orders.push({id: 'o1', name: 'Uno', of: 'tags', fmt: 'num'}); L.tags[0].rk = {o1: '1'};
      const R = structuredClone(B); R.orders.push({id: 'o2', name: 'Dos', of: 'tags', fmt: 'alpha'}); R.tags[0].rk = {o2: 'B'};
      const M = syMerge(L, R, B); return [M.orders.map(o => o.id).sort(), M.tags[0].rk]; })()"""), [['o1', 'o2'], {'o1': '1', 'o2': 'B'}])
    eq('una vista guardada con la clasificación la recuerda', pg.evaluate("F.sorts = [{k: 'o:' + db.orders[0].id, d: -1}]; favSave('Por bloques'); F.sorts = [{k: 'title', d: 1}]; favApply(String(FAV.findIndex(f => f.name === 'Por bloques'))); F.sorts.map(s => [s.k.startsWith('o:'), s.d])"), [[True, -1]])
    eq('sin errores', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
