# Pruebas de las mejoras de motor, funciones e interfaz (v38): sincronización sin trabajo repetido, búsqueda por palabras,
# acciones en lote, varias pestañas, copias de seguridad ligeras… (Chromium)
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
SEED = """() => { db.papers.length = 0; db.sections.length = 0; db.tags.length = 0; db.trash.length = 0; F.sorts = [{k: 'title', d: 1}]; F.group = false; F.q = ''; F.inNotes = false; F.tags.clear(); SEL.clear();
  db.tags.push({id: 'tml', name: 'Machine learning', color: '#3366aa'}, {id: 'tbio', name: 'Biología', color: '#33aa66'});
  db.sections.push({id: 'sint', name: 'Introducción', tagIds: []}, {id: 'smet', name: 'Métodos', tagIds: []});
  const P = (id, o) => NEWF({id, title: '', authors: [], year: '', venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', notes: [], tagIds: [], sectionIds: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, ...o});
  db.papers.push(P('a', {title: 'Redes neuronales profundas', authors: ['García, Ana', 'Smith, John'], year: 2020, venue: 'Nature', doi: '10.1000/abc', tagIds: ['tml'], sectionIds: ['sint']}),
    P('b', {title: 'Genética de poblaciones', authors: ['Pérez, Luis'], year: 2015, venue: 'Cell', tagIds: ['tbio'], sectionIds: ['smet'], general: 'resumen sobre tempestades'}),
    P('c', {title: 'Aprendizaje por refuerzo', authors: ['García, Marta'], year: 2010, venue: 'Science'}));
  UNDO.length = 0; REDO.length = 0; lastSnap = snapDb(); render(); }"""
P1 = "NEWF({id: 'p1', title: 'Uno', authors: [], year: 2020, type: 'articulo', tagIds: [], sectionIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0})"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500)

    # ---- M1: normalizar para Drive no repite el trabajo
    pg.evaluate(SEED)
    eq('normalizar dos veces lo mismo solo trabaja una vez', pg.evaluate("""() => { SY_NM.clear(); let c = 0; const raw = syNormRaw; syNormRaw = d => (c++, raw(d));
      const d = syPlain(db), a = syNormS(d), b2 = syNormS(JSON.parse(JSON.stringify(d))), c2 = syNormS(JSON.parse(a)); syNormRaw = raw; return [c, a === b2, a === c2]; }"""), [1, True, True])
    eq('el resultado es el de siempre', pg.evaluate("syNormS(syPlain(db)) === syS(syPlain(validate(structuredClone(syPlain(db)))))"), True)
    eq('cambiar algo vuelve a normalizar', pg.evaluate("() => { const a = syNormS(syPlain(db)); db.papers[0].title = 'Otro'; const r = syNormS(syPlain(db)) !== a; db.papers[0].title = 'Redes neuronales profundas'; return r; }"), True)
    eq('recuerda pocos resultados', pg.evaluate("() => { for (let i = 0; i < 20; i++) { db.papers[0].year = 1900 + i; syNormS(syPlain(db)); } db.papers[0].year = 2020; return SY_NM.size <= SY_NM_MAX; }"), True)

    # ---- F1 + U4: búsqueda por palabras con resaltado
    pg.evaluate(SEED)
    Q = lambda q: pg.evaluate("q => { F.q = q; return visible().map(p => p.id); }", q)
    eq('palabras en cualquier orden', Q('garcia 2020'), ['a'])
    eq('sin tildes ni mayúsculas', Q('GENÉTICA'), ['b'])
    eq('busca en revista y DOI', [Q('nature'), Q('10.1000/abc')], [['a'], ['a']])
    eq('busca en etiquetas y secciones', [Q('machine'), Q('metodos')], [['a'], ['b']])
    eq('autor: solo mira los autores', sorted(Q('autor:garcia')), ['a', 'c'])
    eq('año: exacto y por rango', [Q('año:2015'), sorted(Q('año:2010-2015')), sorted(Q('year:2012-'))], [['b'], ['b', 'c'], ['a', 'b']])
    eq('#etiqueta y etiqueta:', [Q('#bio'), Q('etiqueta:machine')], [['b'], ['a']])
    eq('-palabra excluye', sorted(Q('-garcia')), ['b'])
    eq('"frase exacta"', [Q('"redes neuronales"'), Q('"neuronales redes"')], [['a'], []])
    eq('revista: y seccion:', [Q('revista:cell'), Q('seccion:intro')], [['b'], ['a']])
    eq('un prefijo desconocido se busca tal cual', Q('http:'), [])
    eq('las notas solo con la casilla', [Q('tempestades'), pg.evaluate("() => { F.inNotes = true; F.q = 'tempestades'; const r = visible().map(p => p.id); F.inNotes = false; return r; }")], [[], ['b']])
    pg.evaluate("F.q = 'garcia redes'; render()")
    eq('resalta las palabras en título y autores', pg.evaluate("[...document.querySelectorAll('#list .card mark')].map(m => m.textContent)"), ['Redes', 'García'])
    eq('resaltar respeta las tildes del texto', pg.evaluate("hl('Árbol de García', ['arbol', 'garcia'])"), '<mark>Árbol</mark> de <mark>García</mark>')
    eq('resaltar escapa el HTML', pg.evaluate("hl('<b>x</b> y', ['y'])"), '&lt;b&gt;x&lt;/b&gt; <mark>y</mark>')
    pg.evaluate("setView('table'); render()")
    eq('también en la tabla', pg.evaluate("document.querySelectorAll('#list .tbl mark').length"), 2)
    pg.evaluate("setView('cards'); F.q = ''; render()")
    eq('sin búsqueda no se marca nada', pg.evaluate("document.querySelectorAll('#list mark').length"), 0)

    # ---- U1: acciones en lote
    pg.evaluate(SEED)
    pg.evaluate("SEL.add('a'); SEL.add('b'); render()")
    eq('la selección muestra las acciones en lote', pg.evaluate("[!$('#sg-sel').hidden, document.querySelectorAll('#sg-sel .blk button').length]"), [True, 4])
    pg.evaluate("bulkRead('leido')")
    eq('lectura en lote', pg.evaluate("db.papers.map(p => p.reading)"), ['leido', 'leido', 'por_leer'])
    pg.evaluate("bulkRate(4)")
    eq('valoración en lote', pg.evaluate("db.papers.map(p => p.rating)"), [4, 4, 0])
    pg.evaluate("bulkTag('tbio', 1)")
    eq('añadir etiqueta en lote', pg.evaluate("db.papers.map(p => p.tagIds.join())"), ['tml,tbio', 'tbio', ''])
    pg.evaluate("bulkTag('tbio', 0); bulkSec('smet', 1)")
    eq('quitar etiqueta y añadir sección', pg.evaluate("db.papers.map(p => p.tagIds.join() + '|' + p.sectionIds.join())"), ['tml|sint,smet', '|smet', '|'])
    pg.evaluate("bulkMenu({preventDefault() {}, stopPropagation() {}, clientX: 10, clientY: 10}, 'tag')")
    eq('el menú de etiquetas ofrece añadir y quitar', pg.evaluate("[...$('#ctx').querySelectorAll('button')].map(b => b.textContent)"), ['＋ Machine learning', '＋ Biología', '− Machine learning'])
    pg.evaluate("ctxClose(); lastRecAt = 0; bulkTrash()")
    eq('a la papelera en lote', pg.evaluate("[db.papers.map(p => p.id), db.trash.length, SEL.size]"), [['c'], 2, 0])
    pg.evaluate("undo()")
    eq('un solo Ctrl+Z lo devuelve', pg.evaluate("db.papers.map(p => p.id).sort()"), ['a', 'b', 'c'])

    # ---- M4: copias de seguridad ligeras
    pg.evaluate(SEED)
    pg.evaluate("img => { db.papers[0].image = {kind: 'data', data: img}; }", IMG)
    pg.evaluate("bkTake('Prueba', true)"); pg.wait_for_timeout(300)
    eq('el índice no lleva las copias dentro', pg.evaluate("bkList().then(L => [L[0].why, 'json' in L[0], typeof L[0].k, typeof L[0].h])"), ['Prueba', False, 'string', 'string'])
    eq('la copia va aparte y sin la imagen dentro', pg.evaluate("img => bkList().then(L => idb('readonly', st => st.get(bkKey(PJ.cur, L[0].k)))).then(r => [r.img, r.json.includes(img), r.json.includes('Redes neuronales')])", IMG), [1, False, True])
    eq('al descargarla lleva la imagen', pg.evaluate("img => bkList().then(L => bkJSON(L[0])).then(j => [JSON.parse(j).papers[0].image.data === img, JSON.parse(j).papers.length])", IMG), [True, 3])
    eq('sin cambios no se repite', pg.evaluate("bkTake('Otra').then(() => bkList()).then(L => L.length)"), 1)
    pg.evaluate("""() => idb('readwrite', st => st.put([{at: '2020-01-01T00:00:00Z', why: 'Antigua', n: 1, size: 10, json: JSON.stringify({version: 1, papers: [], tags: [], sections: [], trash: []})}], 'bk:' + PJ.cur))""")
    pg.evaluate("bkTake('Nueva', true)"); pg.wait_for_timeout(300)
    eq('una copia antigua se convierte al guardar otra', pg.evaluate("bkList().then(L => [L.map(c => c.why), L.some(c => 'json' in c)])"), [['Nueva', 'Antigua'], False])
    eq('y se sigue pudiendo leer', pg.evaluate("bkList().then(L => bkJSON(L[1])).then(j => JSON.parse(j).papers.length)"), 0)
    pg.evaluate("bkDelete(1)"); pg.wait_for_timeout(300)
    eq('borrar una copia borra sus datos', pg.evaluate("idb('readonly', st => st.getAllKeys(bkRange(PJ.cur))).then(ks => ks.length)"), 1)
    pg.evaluate("db.papers[0].image = null; sessionNow()"); pg.wait_for_timeout(200)
    pg.evaluate("imgGc()"); pg.wait_for_timeout(300)
    eq('las imágenes de las copias no se borran', pg.evaluate("img => idb('readonly', st => st.get('imgd:' + imgHash(img)))", IMG), IMG)

    # ---- F2: buscar por ISBN (Open Library) y por título (CrossRef), con respuestas simuladas
    CR_ITEM = {'DOI': '10.5555/xyz', 'type': 'journal-article', 'title': ['Deep learning'], 'author': [{'family': 'LeCun', 'given': 'Yann'}], 'issued': {'date-parts': [[2015, 5, 28]]}, 'container-title': ['Nature'], 'volume': '521', 'page': '436-444'}
    ctx.route('https://api.crossref.org/works?**', lambda r: r.fulfill(json={'message': {'items': [CR_ITEM, {**CR_ITEM, 'DOI': '10.5555/otro', 'title': ['Deep learning II']}]}}))
    ctx.route('https://api.crossref.org/works/**', lambda r: r.fulfill(json={'message': CR_ITEM}))
    ctx.route('https://openlibrary.org/**', lambda r: r.fulfill(json={'ISBN:9780262035613': {'title': 'Deep Learning', 'authors': [{'name': 'Ian Goodfellow'}, {'name': 'Yoshua Bengio'}], 'publishers': [{'name': 'MIT Press'}], 'publish_date': '2016', 'publish_places': [{'name': 'Cambridge'}], 'url': 'https://openlibrary.org/books/x'}}))
    pg.evaluate(SEED)
    eq('reconoce DOI, ISBN y título', pg.evaluate("[isDoi('https://doi.org/10.1000/abc'), isIsbn('978-0-262-03561-3'), isIsbn('ISBN 0-306-40615-2'), isDoi('redes neuronales'), isIsbn('12345')]"), [True, '9780262035613', '0306406152', False, ''])
    pg.evaluate("openImport('doi'); $('#iDoi').value = '978-0-262-03561-3'; impDoi()"); pg.wait_for_timeout(500)
    eq('por ISBN trae el libro de Open Library', pg.evaluate("[IMP.mode, IMP.refs[0].title, IMP.refs[0].authors, IMP.refs[0].year, IMP.refs[0].venue, IMP.refs[0].type, IMP.refs[0].isbn, IMP.refs[0].place]"),
       ['prev', 'Deep Learning', ['Goodfellow, Ian', 'Bengio, Yoshua'], '2016', 'MIT Press', 'libro', '9780262035613', 'Cambridge'])
    pg.evaluate("openImport('doi'); $('#iDoi').value = 'deep learning lecun'; impDoi()"); pg.wait_for_timeout(500)
    eq('por título propone varios resultados', pg.evaluate("[IMP.mode, IMP.refs.length, document.querySelectorAll('#imp .irow button').length]"), ['pick', 2, 2])
    pg.click('#imp .irow button >> nth=1'); pg.wait_for_timeout(200)
    eq('al elegir uno pasa a la vista previa para importarlo', pg.evaluate("[IMP.mode, IMP.refs.length, IMP.refs[0].doi, IMP.refs[0].on, $('#iGo').textContent]"), ['prev', 1, '10.5555/otro', True, 'Importar 1'])
    pg.evaluate("$('#imp').close()")

    # ---- F5: CSL-JSON
    pg.evaluate(SEED)
    pg.evaluate("db.papers[0].pubDate = '2020-03-05'; db.papers[0].volume = '12'; db.papers[0].pages = '1-10'; db.papers[0].accessed = '2024-01-02'")
    csl = pg.evaluate("JSON.parse(cslJSON(db.papers))")
    eq('exporta CSL-JSON', [csl[0]['type'], csl[0]['author'], csl[0]['issued'], csl[0]['container-title'], csl[0]['DOI'], csl[0]['volume'], csl[0]['page'], csl[0]['accessed']],
       ['article-journal', [{'family': 'García', 'given': 'Ana'}, {'family': 'Smith', 'given': 'John'}], {'date-parts': [[2020, 3, 5]]}, 'Nature', '10.1000/abc', '12', '1-10', {'date-parts': [[2024, 1, 2]]}])
    eq('el formato sale en Exportar', pg.evaluate("'csl' in EXF"), True)
    pg.evaluate("t => impText(t)", json.dumps(csl + [{'type': 'book', 'title': 'Libro de entidad', 'author': [{'literal': 'OMS'}], 'publisher': 'Ginebra Press', 'issued': {'date-parts': [['2019']]}, 'ISBN': ['978-1']}]))
    eq('lo importa de vuelta', pg.evaluate("IMP.refs.map(r => [r.title, r.authors.join('; '), r.year, r.venue, r.type, r.dup])"),
       [['Redes neuronales profundas', 'García, Ana; Smith, John', '2020', 'Nature', 'articulo', True], ['Genética de poblaciones', 'Pérez, Luis', '2015', 'Cell', 'articulo', True],
        ['Aprendizaje por refuerzo', 'García, Marta', '2010', 'Science', 'articulo', True], ['Libro de entidad', 'OMS', '2019', 'Ginebra Press', 'libro', False]])
    eq('con fechas, páginas e ISBN', pg.evaluate("[IMP.refs[0].pubDate, IMP.refs[0].pages, IMP.refs[0].accessed, IMP.refs[3].isbn, IMP.refs[3].authorType]"), ['2020-03-05', '1-10', '2024-01-02', '978-1', 'entidad'])
    pg.evaluate("$('#imp').close()")

    # ---- F4: soltar archivos en la ventana
    DROP = """([name, text]) => { const dt = new DataTransfer(); dt.items.add(new File([text], name)); 
      document.dispatchEvent(new DragEvent('dragover', {dataTransfer: dt, bubbles: true, cancelable: true})); const over = document.body.classList.contains('fdrop');
      document.body.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true})); return over; }"""
    pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    eq('al arrastrar un archivo se avisa dónde soltarlo', pg.evaluate(DROP, ['refs.bib', '@article{a, title={Soltado}, author={Ruiz, Eva}, year={2021}}']), True)
    pg.wait_for_timeout(300)
    eq('un .bib soltado abre Importar', pg.evaluate("[$('#imp').open, IMP.refs.map(r => r.title), document.body.classList.contains('fdrop')]"), [True, ['Soltado'], False])
    pg.evaluate("$('#imp').close()")
    pg.evaluate(DROP, ['Otro proyecto.json', json.dumps({'version': 1, 'papers': [], 'tags': [], 'sections': []})]); pg.wait_for_timeout(800)
    eq('un JSON de la aplicación se abre como proyecto', pg.evaluate("pjCur().name"), 'Otro proyecto')
    pg.evaluate(DROP, ['paper.pdf', '%PDF']); pg.wait_for_timeout(200)
    eq('un PDF explica dónde enlazarlo', pg.evaluate("$('#toast').textContent.includes('PDF')"), True)

    eq('sin errores', errs, [])

    # ---- M3: varias pestañas con el mismo proyecto
    ctx2 = b.new_context(service_workers='block'); errs2 = []
    A = ctx2.new_page(); A.on('pageerror', lambda e: errs2.append(str(e))); A.goto('file://' + str(folder / 'index.html')); A.wait_for_timeout(800)
    A.evaluate(f"db.papers.push({P1}); markDirty()")
    B = ctx2.new_page(); B.on('pageerror', lambda e: errs2.append(str(e))); B.goto('file://' + str(folder / 'index.html')); B.wait_for_timeout(1200)
    eq('la segunda pestaña queda en pausa con un aviso', [A.evaluate("TAB.passive"), B.evaluate("TAB.passive"), B.is_visible('#tabLock')], [False, True, True])
    eq('en pausa no guarda la copia de trabajo', B.evaluate("db.papers.push({id: 'zz'}); sessionNow().then(() => idb('readonly', st => st.get('proj:' + PJ.cur))).then(r => r.json.includes('zz'))"), False)
    B.click('#tabLock button.pri'); B.wait_for_timeout(2500)
    eq('«Usar en esta pestaña» cambia los papeles y trae lo último', [A.evaluate("TAB.passive"), A.is_visible('#tabLock'), B.evaluate("TAB.passive"), B.evaluate("db.papers.map(p => p.title)")], [True, True, False, ['Uno']])
    eq('en pausa los atajos no hacen nada', A.evaluate("() => { const n = db.papers.length; document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true})); return db.papers.length === n; }"), True)
    eq('sin errores con varias pestañas', errs2, [])
    b.close()

# ---- F3: compartir con la aplicación (share_target)
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ctx.route('https://api.crossref.org/works/**', lambda r: r.fulfill(json={'message': {'DOI': '10.1016/j.cell.2020.01.001', 'type': 'journal-article', 'title': ['Compartido'], 'author': [], 'issued': {'date-parts': [[2020]]}}}))
    man = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    eq('el manifiesto ofrece compartir con la app', man.get('share_target', {}).get('params'), {'title': 'title', 'text': 'text', 'url': 'url'})
    pg.goto('file://' + str(folder / 'index.html') + '?title=Un%20art%C3%ADculo&url=https%3A%2F%2Fdoi.org%2F10.1016%2Fj.cell.2020.01.001'); pg.wait_for_timeout(2500)
    eq('lo compartido abre Importar con el DOI encontrado', pg.evaluate("[$('#imp').open, IMP.mode, IMP.refs[0]?.title, location.search]"), [True, 'prev', 'Compartido', ''])
    eq('saca el DOI de un texto con enlaces', pg.evaluate("('Mira https://onlinelibrary.wiley.com/doi/full/10.1002/anie.202000001/full.').match(DOI_RE)[0].replace(/[.,;:)\\]}>'\"]+$/, '').replace(/\\/(full|abstract|pdf|epdf)$/i, '')"), '10.1002/anie.202000001')
    eq('sin errores al compartir', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas (total)')
sys.exit(1 if fail else 0)
