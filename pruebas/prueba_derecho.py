# Pruebas de interfaz del estilo «Derecho y jurisprudencia» (Chromium): secciones del selector, formulario, exportación en bloques y BibTeX/RIS.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
shots = os.environ.get('SHOTS')   # carpeta opcional para guardar capturas
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.sections.length = 0; db.tags.length = 0;
  const P = o => NEWF({id: o.id, title: '', authors: [], year: '', venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: [], ...o});
  db.papers.push(
    P({id: 'd1', type: 'libro', title: 'Sistema de Derecho civil', authors: ['Díez-Picazo, Luis'], year: 2016, venue: 'Tecnos'}),
    P({id: 'l1', type: 'legislacion', place: 'España', title: 'Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público', abbr: 'LRJSP', venue: 'Boletín Oficial del Estado', pubDate: '2015-10-02', issue: '236', pages: '89411 a 89530', year: 2015}),
    P({id: 'l0', type: 'legislacion', title: 'Constitución Española', abbr: 'CE', venue: 'Boletín Oficial del Estado', pubDate: '1978-12-29', issue: '311', year: 1978}),
    P({id: 'j2', type: 'jurisprudencia', place: 'España', title: 'STS 1229/2017', venue: 'Tribunal Supremo', series: 'Sala de lo Penal, Sección 1.ª', docNumber: '1229/2017', pubDate: '2017-03-29', year: 2017}),
    P({id: 'j1', type: 'jurisprudencia', title: 'Schempp', venue: 'Tribunal de Justicia de la Unión Europea', seriesNumber: 'C-403/03', ecli: 'EU:C:2005:446', pubDate: '2005-07-12', year: 2005}));
  UNDO.length = 0; REDO.length = 0; lastSnap = JSON.stringify(db); render(); }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
    pg.evaluate(SEED)
    # ---- selector de estilos con secciones (Exportar)
    pg.evaluate("EXS = 'all'; ex().fmt = 'txt'; ex().style = 'apa'; openEx()")
    eq('Exportar: secciones del selector', pg.evaluate("[...document.querySelectorAll('#exOpts optgroup')].map(g => g.label)"), ['Estilos generales', 'Derecho y jurisprudencia'])
    eq('Exportar: el estilo de Derecho está en su sección', pg.evaluate("[...document.querySelectorAll('#exOpts optgroup[label=\"Derecho y jurisprudencia\"] option')].map(o => o.value)"), ['derecho'])
    pg.select_option('#exOpts optgroup >> xpath=..', 'derecho'); pg.wait_for_timeout(100)
    t = pg.input_value('#exText')
    heads = [h for h in ['Lista de abreviaturas', 'Bibliografía', 'Anexo de legislación', 'Anexo de jurisprudencia'] if h in t]
    eq('Exportar: los cuatro bloques', heads, ['Lista de abreviaturas', 'Bibliografía', 'Anexo de legislación', 'Anexo de jurisprudencia'])
    eq('Exportar: bloques en orden', [t.index(h) for h in heads] == sorted(t.index(h) for h in heads), True)
    eq('Exportar: anexos cronológicos', (t.index('Constitución Española.') < t.index('España. Ley 40/2015'), t.index('Caso Schempp') < t.index('Tribunal Supremo (Sala')), (True, True))
    eq('Exportar: la legislación no está en la bibliografía', 'Ley 40/2015' in t[t.index('Bibliografía'):t.index('Anexo de legislación')], False)
    eq('Exportar: abreviaturas', t[:t.index('Bibliografía')].strip().split('\n')[2:], ['CE: Constitución Española', 'LRJSP: Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público', 'STJUE: Sentencia del Tribunal de Justicia de la Unión Europea', 'STS: Sentencia del Tribunal Supremo'])
    eq('Exportar: la doctrina en APA', 'Díez-Picazo, L. (2016). Sistema de Derecho civil. Tecnos.' in t, True)
    eq('Exportar: casilla de la lista de abreviaturas', pg.evaluate("[...document.querySelectorAll('#exOpts .exchk label')].some(l => /Lista de abreviaturas/.test(l.textContent))"), True)
    if shots: pg.screenshot(path=os.path.join(shots, 'exportar_derecho.png'))
    pg.evaluate("exSet('abbrList', false)")
    eq('Exportar: sin lista de abreviaturas', 'Lista de abreviaturas' in pg.input_value('#exText'), False)
    pg.evaluate("exSet('abbrList', true)")
    eq('Exportar: Word con los bloques', pg.evaluate("(() => { const z = exDocx(exList(), ex()), s = new TextDecoder().decode(z); return ['Anexo de legislación', 'Anexo de jurisprudencia', 'Lista de abreviaturas'].every(h => s.includes(h)); })()"), True)
    eq('Exportar: copiar con formato con los bloques', pg.evaluate("(h => (h.match(/<h2/g) || []).length)(exHtml(exList(), ex()))"), 4)
    pg.evaluate("exSet('style', 'apa')")
    eq('Exportar: los demás estilos no cambian (sin bloques)', 'Anexo' in pg.input_value('#exText'), False)
    eq('Exportar: aviso de jurisprudencia en APA', 'ningún estilo general trae plantilla de jurisprudencia' in pg.inner_text('#exOpts'), True)
    pg.evaluate("$('#ex').close()")
    # ---- formulario del tipo Jurisprudencia
    pg.evaluate("openPaper('j2'); tab = 'data'; drawD()")
    labels = pg.evaluate("[...document.querySelectorAll('#dlg label')].map(l => l.childNodes[0].textContent.trim())")
    for l in ['Tribunal u órgano (p. ej. Tribunal Supremo)', 'Sala y sección (p. ej. Sala de lo Penal, Sección 1.ª; Pleno)', 'Número de la resolución (p. ej. 1229/2017)', 'Fecha de la resolución', 'Tipo de resolución (por defecto, Sentencia)', 'Base de datos (opcional; p. ej. Aranzadi Instituciones, CENDOJ)']:
        eq('Formulario de jurisprudencia: ' + l, l in labels, True)
    eq('Formulario de jurisprudencia: ECLI y abreviatura', [any(x.startswith('ECLI') for x in labels), any(x.startswith('Abreviatura propia') for x in labels)], [True, True])
    eq('Formulario: «Jurisprudencia» en el desplegable Tipo', pg.evaluate("[...document.querySelectorAll('#dlg select option')].some(o => o.value === 'jurisprudencia' && o.selected)"), True)
    if shots: pg.screenshot(path=os.path.join(shots, 'formulario_jurisprudencia.png'))
    pg.evaluate("openPaper('l1'); tab = 'data'; drawD()")
    labels = pg.evaluate("[...document.querySelectorAll('#dlg label')].map(l => l.childNodes[0].textContent.trim())")
    eq('Formulario de legislación: rango y abreviatura', ['Rango (opcional; se deduce del título)' in labels, 'Abreviatura (p. ej. CE, LOPJ, LRJSP)' in labels], [True, True])
    # ---- pestaña Cita: secciones y cita en el texto
    pg.evaluate("ex().inText = true; openPaper('j2'); tab = 'cite'; CLOC = '3'; drawD()")
    eq('Cita: títulos de sección', pg.evaluate("[...document.querySelectorAll('#dlg h2.grp')].map(h => h.textContent)"), ['Estilos generales', 'Derecho y jurisprudencia'])
    eq('Cita: anexo de Derecho', pg.input_value('#c_derecho'), 'España. Tribunal Supremo (Sala de lo Penal, Sección 1.ª). Sentencia núm. 1229/2017, de 29 de marzo de 2017.')
    eq('Cita: en el texto con FJ', 'STS 1229/2017 de 29 de marzo, FJ 3' in pg.inner_text('#it_derecho'), True)
    eq('Cita: el campo dice qué se cita', pg.get_attribute('#locIn', 'placeholder'), 'p. ej. 22.1 (artículo) o 3 (FJ, FD o apartado)')
    if shots: pg.evaluate("document.getElementById('c_derecho').scrollIntoView({block: 'center'})"); pg.screenshot(path=os.path.join(shots, 'cita_derecho.png'))
    pg.evaluate("openPaper('j2'); tab = 'all'; CITE_SEL = 'derecho'; drawD()")
    eq('Ver todo: selector de estilo con secciones', pg.evaluate("[...document.querySelectorAll('#dlg optgroup')].map(g => g.label).filter(l => /Estilos|Derecho/.test(l))"), ['Estilos generales', 'Derecho y jurisprudencia'])
    pg.evaluate("$('#dlg').close(); ex().inText = false")
    # ---- estilo propio a partir del de Derecho
    eq('Nuevo a partir de…: sección de Derecho', pg.evaluate("(() => { openCfg('no'); return [...document.querySelectorAll('#cfg optgroup')].map(g => g.label + ':' + [...g.children].map(o => o.value).join(',')).find(x => x.startsWith('Derecho')); })()"), 'Derecho y jurisprudencia:derecho')
    pg.evaluate("cuFromBase('derecho')")
    eq('Estilo propio de Derecho: plantilla de jurisprudencia', pg.evaluate("(() => { const k = Object.keys(STYLES).find(k => k.startsWith('cu_')); return citeTxt(STYLES[k].fn(db.papers.find(p => p.id === 'j2'))); })()"), 'España. Tribunal Supremo (Sala de lo Penal, Sección 1.ª). Caso STS 1229/2017. Sentencia núm. 1229/2017, de 29 de marzo de 2017.')
    eq('Estilo propio: sale en «Estilos propios»', pg.evaluate("styOpts('apa').includes('<optgroup label=\"Estilos propios\">')"), True)
    pg.evaluate("$('#cfg').close()")
    # ---- BibTeX y RIS: ida y vuelta
    rt = """(fmt) => { const p = {...db.papers.find(p => p.id === 'j2'), publisher: 'CENDOJ', abbr: 'STS', ecli: 'ECLI:ES:TS:2017:1229', subtype: 'Sentencia'}, r = (fmt === 'bib' ? parseBib(bibtex([p])) : parseRis(ris([p])))[0];
      return [r.type, r.venue, r.series, r.docNumber, r.pubDate, r.publisher, r.abbr, r.ecli, r.place, r.subtype]; }"""
    want = ['jurisprudencia', 'Tribunal Supremo', 'Sala de lo Penal, Sección 1.ª', '1229/2017', '2017-03-29', 'CENDOJ', 'STS', 'ECLI:ES:TS:2017:1229', 'España', 'Sentencia']
    eq('BibTeX: jurisprudencia de ida y vuelta', pg.evaluate(rt, 'bib'), want)
    eq('RIS: jurisprudencia de ida y vuelta', pg.evaluate(rt, 'ris'), want)
    eq('BibTeX: @jurisdiction', pg.evaluate("bibtex([db.papers.find(p => p.id === 'j2')]).startsWith('@jurisdiction{')"), True)
    eq('JSON: los campos nuevos se guardan y se leen', pg.evaluate("validate(JSON.parse(dbJSON())).papers.find(p => p.id === 'j1').ecli"), 'EU:C:2005:446')
    eq('sin errores en la consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
