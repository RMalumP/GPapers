# Pruebas de la revisión v39.35 en Chromium: identificadores y data-on seguros, analizador de notas, copia de trabajo ilegible,
# limpieza de PDF, fusión de duplicados, vista agrupada por partes, deshacer al escribir, guardar con cambios en marcha y detalles de exportación.
import sys, json, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAY = 'x"><img src="nada:" class="INJ" data-onerror="put(window,\'LEAK\',1)"><i x="'
P = "(id, o = {}) => NEWF({id, title: 'T ' + id, authors: ['Autor, A.'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2024-01-01T00:00:00.000Z', ...o})"
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('requestfailed', lambda r: errs.append(r.url)); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400)
    pg.evaluate(f"window.P = {P}")

    # ---- 1. Identificadores y colores de un archivo ajeno ----
    lib = {'version': 1, 'sections': [{'id': PAY + 's', 'name': 'Sec', 'color': 'red" class="INJ', 'tagIds': [PAY + 't']}], 'tags': [{'id': PAY + 't', 'name': 'Tag', 'color': '#00ff00', 'rk': {PAY + 'o': '1'}}],
           'orders': [{'id': PAY + 'o', 'name': 'Ord', 'of': 'tags', 'fmt': 'num'}], 'posSaves': [{'id': PAY + 'ps', 'name': 'Pos', 'manual': {PAY + 's': [PAY + 'p']}}], 'manual': {PAY + 's': [PAY + 'p'], '*': [PAY + 'p'], '_': []},
           'papers': [{'id': PAY + 'p', 'title': 'Malo', 'authors': ['A, B.'], 'tagIds': [PAY + 't'], 'sectionIds': [PAY + 's'], 'related': ['bueno'], 'refTo': ['bueno'],
                       'notes': [{'id': PAY + 'n', 'sectionId': PAY + 's', 'content': 'nota'}], 'pdf': {'name': 'a.pdf', 'ann': [{'id': PAY[:30], 'k': 'hl', 'p': 0, 'q': [1, 2, 3, 4], 'c': '#ffd400'}]}},
                      {'id': 'bueno', 'title': 'Bueno', 'authors': [], 'refTo': [PAY + 'p']}, {'id': ['<img class="INJ">'], 'title': 'Lista', 'authors': []}],
           'trash': [{'at': '2999-01-01T00:00:00.000Z', 'paper': {'id': PAY + 'tr', 'title': 'Papelera', 'authors': []}}],
           'settings': {'templates': [{'id': PAY + 'tp', 'name': 'Pl', 'text': 'x'}]}}
    eq('el archivo se abre', pg.evaluate("t => loadText(t, 'malo.json', true)", json.dumps(lib)), True)
    pg.evaluate("F.group = true; F.tbSec = true; F.tbTag = true; render(); openMg('tags'); $('#mg').close(); openMg('sections'); $('#mg').close(); openCfg('no'); $('#cfg').close(); openPaper(db.papers[0].id); tab = 'notes'; drawD(); $('#dlg').close(); toggleNotes(db.papers[0].id); trOpen()")
    pg.wait_for_timeout(300)
    eq('ningún id llega al HTML como etiqueta', (pg.locator('.INJ').count(), pg.evaluate("window.LEAK === undefined")), (0, True))
    ids = pg.evaluate("[...db.papers.map(p => p.id), ...db.tags.map(t => t.id), ...db.sections.map(s => s.id), ...db.orders.map(o => o.id), ...db.posSaves.map(o => o.id), ...db.papers[0].notes.map(x => x.id), ...db.papers[0].pdf.ann.map(a => a.id), ...db.trash.map(t => t.paper.id), ...db.settings.templates.map(t => t.id), ...Object.keys(db.manual)]")
    eq('todos los ids son seguros', [i for i in ids if not isinstance(i, str) or not all(c.isalnum() or c in '_-*' for c in i)], [])
    eq('las referencias siguen apuntando a lo mismo', pg.evaluate("""(() => { const p = db.papers[0], g = db.papers[1], t = db.tags[0], s = db.sections[0], o = db.orders[0];
      return [p.tagIds[0] === t.id, p.sectionIds[0] === s.id, p.notes[0].sectionId === s.id, s.tagIds[0] === t.id, Object.keys(t.rk)[0] === o.id, db.manual[s.id][0] === p.id, db.manual['*'][0] === p.id, db.posSaves[0].manual[s.id][0] === p.id, g.refTo[0] === p.id, p.related[0] === 'bueno', g.related[0] === p.id]; })()"""), [True] * 11)
    eq('el cambio es siempre el mismo (la sincronización compara lo mismo)', pg.evaluate("t => { const a = validate(JSON.parse(t)).papers[0].id, b = validate(JSON.parse(t)).papers[0].id; syncTypes(db.settings.customTypes); return a === b && a === db.papers[0].id; }", json.dumps(lib)), True)
    eq('un color no válido se sustituye y uno válido se queda', pg.evaluate("[db.sections[0].color, db.tags[0].color]"), ['#888888', '#00ff00'])
    eq('los ids normales no cambian', pg.evaluate("t => validate(JSON.parse(t)).papers.map(p => p.id)", json.dumps({'papers': [{'id': 'p1', 'title': 'a', 'authors': []}, {'id': 'a-b_C9', 'title': 'b', 'authors': []}, {'id': 7, 'title': 'c', 'authors': []}], 'tags': [], 'sections': []})), ['p1', 'a-b_C9', 7])
    pg.evaluate("syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export)")

    # ---- 2. data-on: solo funciones de la aplicación ----
    bad = ["put(window,'X1',1)", "fetch('https://example.com')", "alert(1)", "eval('1')", "this.ownerDocument.defaultView.put(F,'q','x')", "event.view.put(F,'q','x')", "this.ownerDocument.cookie.length", "localStorage.getItem('gp-sync')",
           "this.constructor.constructor('return 1')", "this.getRootNode().defaultView.put(F,'q','x')", "this.getRootNode()", "document.write('x')", "open('https://example.com')"]
    eq('lo ajeno a la aplicación se rechaza', pg.evaluate("L => L.map(s => { try { onRun(s, document.body, new MouseEvent('click', {view: window})); return 'pasa'; } catch (e) { return 'no'; } })", bad), ['no'] * len(bad))
    eq('lo de la aplicación sigue funcionando', pg.evaluate("(() => { onRun(\"put(F,'mode','all');put(F,'mode',this.tagName.toLowerCase())\", document.body, new MouseEvent('click')); const m = F.mode; F.mode = 'any'; return m; })()"), 'body')

    # ---- 3. Notas: marcas sin cerrar ----
    eq('40 marcas sin cerrar no bloquean', pg.evaluate("(() => { const t = performance.now(); mdNodes('*a '.repeat(40) + '**b ' + '__c '.repeat(20)); return performance.now() - t < 300; })()"), True)
    eq('y el formato da lo mismo de siempre', pg.evaluate("mdInline('**n** *c* ~~t~~ __s__ *sin cerrar **x** \\\\*lit')"), '<strong>n</strong> <em>c</em> <s>t</s> <u>s</u> *sin cerrar <strong>x</strong> *lit')

    # ---- 4. Copia de trabajo ilegible: no se pisa y Drive no entiende borrados ----
    r = pg.evaluate("""(async () => { const id = 'zz9'; PJ.list.push({id, name: 'Roto', created: ''});
      await idb('readwrite', st => { st.put({v: 1, json: '{roto', img: 0}, 'proj:' + id); return st.put({papers: [{id: 'a'}]}, 'syncBase' + syNames(id).key); });
      await pjLeave(); await pjLoad(id); await new Promise(r => setTimeout(r, 900));
      return [db.papers.length, await idb('readonly', st => st.get('syncBase' + syNames(id).key)) == null, (await idb('readonly', st => st.get('projbad:' + id)))?.json, (await idb('readonly', st => st.get('proj:' + id))).json, $('#toast').textContent.includes('No se pudo leer')]; })()""")
    eq('proyecto ilegible: vacío, sin base de sincronización, copia apartada y aviso', [r[0], r[1], r[2], r[4]], [0, True, '{roto', True])

    # ---- 5. Limpieza de PDF que ya no usa nadie ----
    r = pg.evaluate("""(async () => { db.papers.push(P('k1', {pdf: {name: 'a.pdf'}, pdf2: {name: 'b.pdf', from: 'in-viejo1'}, image: {kind: 'file', name: 'i.png'}})); db.inbox = [{id: 'bandeja1', name: 'c.pdf', at: '', up: ''}]; markDirty(); await sessionNow();
      const keep = ['pdfb:k1', 'pdft:k1', 'pdf:k1~2', 'pdfb:in-viejo1', 'pdfb:in-bandeja1', 'img:k1', 'pdfUp:' + PJ.cur + ':k1', 'imgd:abc'], gone = ['pdfb:huerfano', 'pdft:huerfano', 'pdf:huerfano~2', 'pdfb:in-otro', 'img:huerfano', 'pdfUp:' + PJ.cur + ':huerfano', 'pdfVis:noexiste:k1'];
      await idb('readwrite', st => { [...keep, ...gone].forEach(k => st.put('x', k)); return null; });
      const nDel = await pdfGc(), ks = new Set(await idb('readonly', st => st.getAllKeys()));
      return [nDel, keep.filter(k => !ks.has(k)), gone.filter(k => ks.has(k))]; })()""")
    eq('se borra lo huérfano y se queda lo que se usa', r, [7, [], []])
    r = pg.evaluate("""(async () => { await idb('readwrite', st => { st.put('x', 'pdfb:huerfano'); return st.put({v: 1, json: '{roto'}, 'bkd:' + PJ.cur + ':malo'); });
      const nDel = await pdfGc(); await idb('readwrite', st => st.delete('bkd:' + PJ.cur + ':malo')); return nDel; })()""")
    eq('con una copia que no se puede leer no se borra nada', r, 0)

    # ---- 6. Fusionar duplicados: el PDF conserva su archivo ----
    r = pg.evaluate("""(async () => { db.papers.push(P('d1'), P('d2', {pdf: {name: 'dup.pdf'}})); await idb('readwrite', st => st.put('data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'pdft:d2'));
      dpMerge('d1', ['d1', 'd2']); await new Promise(r => setTimeout(r, 200));
      return [db.papers.find(p => p.id === 'd1').pdf, db.trash.some(t => t.paper.id === 'd2'), await idb('readonly', st => st.get('pdft:d1')), await idb('readonly', st => st.get('pdft:d2'))]; })()""")
    eq('el PDF pasa con su archivo y el descartado conserva el suyo', r, [{'name': 'dup.pdf', 'from': 'd2'}, True, 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='])

    # ---- 7. Vista agrupada: las secciones largas, por partes ----
    pg.evaluate("""(() => { db.sections = [{id: 's1', name: 'Uno', color: '#2457c5', tagIds: []}]; db.papers = Array.from({length: 400}, (_, i) => P('g' + i, {sectionIds: i < 380 ? ['s1'] : [], refTo: i ? ['g0'] : []}));
      db.trash = []; F.group = true; F.secs.clear(); F.tags.clear(); FOLD.clear(); F.sorts = [{k: 'title', d: 1}]; markDirty(); render(); })()""")
    step = pg.evaluate("LIST.step")
    eq('al principio solo una parte de la sección larga', (pg.locator('#list .gbox[data-sec="s1"] article.card').count(), pg.locator('#list .gbox[data-sec=""] article.card').count(), pg.locator('#list .gbox .more').count(), 'quedan %d' % (380 - step) in pg.inner_text('#list .gbox[data-sec="s1"] .more')), (step, 20, 1, True))
    eq('la cabecera cuenta todos', '(380)' in pg.inner_text('#list .gbox[data-sec="s1"] h2'), True)
    pg.evaluate("secMore('s1'); secMore('s1')")
    eq('y se añaden las siguientes sin repintar', (pg.locator('#list .gbox[data-sec="s1"] article.card').count(), pg.locator('#list .gbox .more').count()), (380, 0))
    eq('«citado por» sale de una sola pasada y cuenta bien', pg.evaluate("[relCount(db.papers[0]), relCount(db.papers[5]), (() => { const t = performance.now(); db.papers.forEach(relCount); return performance.now() - t < 50; })()]"), [399, 1, True])
    pg.evaluate("db.settings.view = 'table'; render()")
    eq('en tabla, igual', (pg.locator('#list .gbox[data-sec="s1"] tbody tr[data-id]').count(), pg.locator('#list .gbox .more').count()), (step, 1))
    pg.evaluate("secMore('s1')"); eq('más filas en la misma tabla', pg.locator('#list .gbox[data-sec="s1"] tbody tr[data-id]').count(), min(380, 2 * step))
    pg.evaluate("db.settings.view = 'cards'; F.group = false; db.papers.length = 3; markDirty(); render()")

    # ---- 8. Escribir en un campo: la copia para deshacer, al parar ----
    pg.evaluate("db.tags = [{id: 't1', name: 'Uno', color: '#2457c5'}]; markDirty(); UNDO.length = 0; lastRecAt = 0; openMg('tags')")
    inp = pg.locator('#mg input.mgn').first; inp.click(); inp.press('End'); pg.keyboard.type('abc', delay=20)
    eq('mientras se escribe no se hace la copia, pero el cambio queda pendiente', pg.evaluate("[db.tags[0].name, UNDO.length, dirty]"), ['Unoabc', 0, True])
    pg.wait_for_timeout(600)
    eq('al parar, un solo paso de deshacer', pg.evaluate("UNDO.length"), 1)
    pg.keyboard.type('d', delay=20); pg.evaluate("lastRecAt = 0; undo()")
    eq('deshacer justo después de escribir no se salta el cambio', pg.evaluate("db.tags[0].name"), 'Unoabc')
    pg.evaluate("undo()"); eq('y el siguiente vuelve al principio', pg.evaluate("db.tags[0].name"), 'Uno')
    pg.evaluate("$('#mg').close()")

    # ---- 9. Guardar: un cambio hecho mientras se escribe el archivo sigue pendiente ----
    r = pg.evaluate("""(async () => { if (!FSA) return 'sin FSA'; let out = '';
      handle = {name: 'f.json', queryPermission: async () => 'granted', createWritable: async () => ({write: async t => { out = t; db.papers[0].title = 'Cambiado durante'; markDirty(); }, close: async () => {}})};
      db.papers[0].title = 'Antes'; markDirty(); await save(false); const a = [JSON.parse(out).papers[0].title, dirty];
      handle.createWritable = async () => ({write: async t => { out = t; }, close: async () => {}}); await save(false); const r = [...a, JSON.parse(out).papers[0].title, dirty]; handle = null; return r; })()""")
    eq('guardar no da por guardado lo que cambió mientras tanto', r, ['Antes', True, 'Cambiado durante', False])

    # ---- 10. Sincronización: imágenes como huella dentro de la vuelta ----
    PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    r = pg.evaluate("""png => { const d = {version: 1, sections: [], tags: [], papers: [P('i1', {image: {kind: 'data', data: png}})], trash: [], inbox: []};
      const s = syTokS(d), t = JSON.parse(s), h = imgHash(png), nm = JSON.parse(syNormS(t)), [w, refs] = syWire(nm), back = syUntok(structuredClone(nm));
      return [s.includes('base64'), t.papers[0].image.data === '@' + h, nm.papers[0].image.data === '@' + h, w.papers[0].image, [...refs][0] === h, back.papers[0].image.data === png,
        validate({papers: [P('i2', {image: {kind: 'data', data: '@' + h}})], tags: [], sections: []}).papers[0].image, syTokIn({papers: [P('i3', {image: {kind: 'data', data: png}})]}).papers[0].image.data === '@' + h]; }""", PNG)
    h = pg.evaluate("p => imgHash(p)", PNG)
    eq('ida y vuelta de las huellas; fuera de la vuelta una huella no vale como imagen', r, [False, True, True, {'kind': 'data', 'ref': h}, True, True, None, True])
    eq('el orden manual se fusiona sección a sección', pg.evaluate("""(() => { const m = x => ({version: 1, sections: [], tags: [], papers: [], trash: [], inbox: [], manual: x});
      return syMerge(m({a: ['1', '2'], b: ['9', '8']}), m({a: ['2', '1'], b: ['8', '9']}), m({a: ['1', '2'], b: ['8', '9']})).manual; })()"""), {'a': ['2', '1'], 'b': ['9', '8']})

    # ---- 11. Exportar ----
    eq('BibTeX: barra invertida, llaves sueltas y claves repetidas', pg.evaluate("[texEsc('a\\\\b {c'), texEsc('El {ADN} y 5%'), [0, 1, 26, 27, 28].map(bibSuf)]"), ['a\\textbackslash{}b \\{c', 'El {ADN} y 5\\%', ['', 'a', 'z', 'aa', 'ab']])
    eq('Word: sin caracteres de control', pg.evaluate("[docxRuns('a\\u0001\\u000bb <c>'), noteRuns('x\\u0008y')].map(s => /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/.test(s))"), [False, False])
    eq('grafo: muchos nodos, en poco tiempo', pg.evaluate("(() => { const t = performance.now(), P = grLayout(1000, [[0, 1], [1, 2]], 1200, 800); return P.length === 1000 && performance.now() - t < 1500; })()"), True)
    eq('sin errores de consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
