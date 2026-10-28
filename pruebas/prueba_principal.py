# Pruebas de interfaz del estilo de cita principal (Chromium): Configuración, pestaña Cita, vista simplificada de Datos y barra de formato de la cita.
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
    P({id: 'a1', title: 'Deep learning', authors: ['LeCun, Yann', 'Bengio, Yoshua'], year: 2015, venue: 'Nature', volume: '521', issue: '7553', pages: '436-444', doi: '10.1038/nature14539'}),
    P({id: 'j1', type: 'jurisprudencia', place: 'España', title: 'STS 1229/2017', venue: 'Tribunal Supremo', series: 'Sala de lo Penal, Sección 1.ª', docNumber: '1229/2017', pubDate: '2017-03-29', year: 2017}));
  UNDO.length = 0; REDO.length = 0; lastSnap = JSON.stringify(db); render(); }"""
has = "k => !!document.querySelector(`#dlg [data-k=${k}]`)"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400)
    pg.evaluate(SEED)
    # ---- valores por defecto
    eq('por defecto: APA, todos los estilos y Datos simplificado', pg.evaluate("[db.settings.mainStyle, db.settings.citeOnlyMain, mainSty(), DATA_ALL]"), ['apa', False, 'apa', False])
    eq('un JSON con un estilo principal raro se sanea', pg.evaluate("(s => [s.mainStyle, s.citeOnlyMain])(validate({papers: [], tags: [], sections: [], settings: {mainStyle: 7, citeOnlyMain: 'sí'}}).settings)"), ['apa', True])
    eq('un estilo principal que ya no existe vuelve a APA', pg.evaluate("db.settings.mainStyle = 'cu_borrado'; const r = mainSty(); db.settings.mainStyle = 'apa'; r"), 'apa')
    # ---- Datos: vista simplificada
    pg.evaluate("openPaper('a1'); tab = 'data'; drawD()")
    if shots: pg.screenshot(path=os.path.join(shots, '1_datos_simplificado.png'))
    eq('Datos (artículo, APA): salen los campos que usa la cita', pg.evaluate(f"['title', 'year', 'venue', 'volume', 'issue', 'pages', 'url'].map({has})"), [True] * 7)
    eq('y se ocultan los demás', pg.evaluate(f"[...['alias', 'sortKey', 'accessed', 'issn', 'pubDate'].map({has}), !!$('#dlg .pdfrow'), !!$('#dlg .dsep')]"), [False] * 7)
    eq('el botón dice cuántos campos más hay', pg.evaluate("/^Mostrar todos los campos \\(\\d+ más\\)/.test($('#dlg .dmore button').textContent)"), True)
    eq('y nombra el estilo principal', 'APA 7' in pg.inner_text('#dlg .dmore small'), True)
    pg.evaluate("D.sortKey = 'Lecun'; drawD()")
    eq('un campo con datos nunca se oculta', pg.evaluate(f"({has})('sortKey')"), True)
    pg.click('#dlg .dmore button')
    eq('«Mostrar todos los campos» despliega el resto bajo «Otros campos»', pg.evaluate(f"[DATA_ALL, $('#dlg .dsep span').textContent, ...['alias', 'accessed', 'issn', 'pubDate'].map({has}), !!$('#dlg .pdfrow')]"), [True, 'Otros campos', True, True, True, True, True])
    eq('los del estilo van antes que «Otros campos»', pg.evaluate("(() => { const s = $('#dlg .dsep'), v = $('#dlg [data-k=volume]'), i = $('#dlg [data-k=issn]'); return [!!(s.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_PRECEDING), !!(s.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING)]; })()"), [True, True])
    eq('la elección se recuerda en la sesión', pg.evaluate("uiState().dataAll"), True)
    pg.click('#dlg .dsep button')
    eq('«Ocultar» junto a «Otros campos» vuelve a la vista simplificada', pg.evaluate("[DATA_ALL, !!$('#dlg .dsep')]"), [False, False])
    # ---- Datos según el estilo principal
    pg.evaluate("openPaper('j1'); tab = 'data'; drawD()")
    eq('jurisprudencia: tribunal, sala, número, fecha y ECLI', pg.evaluate(f"['venue', 'series', 'docNumber', 'pubDate', 'ecli'].map({has})"), [True] * 5)
    eq('relFields: Vancouver pide la fecha de consulta del libro y APA no', pg.evaluate("[relFields({type: 'libro'}, 'vancouver').has('accessed'), relFields({type: 'libro'}, 'apa').has('accessed')]"), [True, False])
    eq('relFields: Derecho usa la abreviatura de la legislación y APA no', pg.evaluate("[relFields({type: 'legislacion'}, 'derecho').has('abbr'), relFields({type: 'legislacion'}, 'apa').has('abbr')]"), [True, False])
    pg.evaluate("$('#dlg').close()")
    # ---- Configuración
    pg.evaluate("openCfg('no')")
    eq('Configuración: selector de estilo principal con sus secciones', pg.evaluate("[...document.querySelectorAll('#cfg select[data-onchange^=setMainStyle] optgroup')].map(g => g.label)"), ['Estilos generales', 'Derecho y jurisprudencia'])
    pg.evaluate("CITE_SEL = 'mla'")
    pg.select_option('#cfg select[data-onchange^=setMainStyle]', 'derecho')
    eq('elegirlo cambia el estilo de Exportar y el de «Ver todo»', pg.evaluate("[db.settings.mainStyle, ex().style, CITE_SEL, citeSel(), dirty]"), ['derecho', 'derecho', '', 'derecho', True])
    if shots: pg.screenshot(path=os.path.join(shots, '2_configuracion_estilo_principal.png'))
    pg.evaluate("$('#cfg').close()")
    # ---- pestaña Cita
    pg.evaluate("openPaper('a1'); tab = 'cite'; drawD()")
    eq('Cita: el principal va primero, con su título', pg.evaluate("[$('#dlg h2.grp').textContent, $('#dlg h3').textContent, $('#dlg .ced[id^=c_]').id]"), ['Estilo principal', 'Derecho y jurisprudencia', 'c_derecho'])
    eq('y después todos los demás, sin repetirlo', pg.evaluate("[document.querySelectorAll('#dlg .ced[id^=c_]').length === Object.keys(STYLES).length, document.querySelectorAll('#dlg #c_derecho').length]"), [True, 1])
    eq('su sección ya no sale vacía', pg.evaluate("[...document.querySelectorAll('#dlg h2.grp, #dlg details.cgrp > summary')].map(h => h.textContent)"), ['Estilo principal', 'Estilos generales (10)'])
    eq('los demás estilos van en secciones plegables, cerradas al principio', pg.evaluate("[...document.querySelectorAll('#dlg details.cgrp')].map(d => d.open)"), [False])
    pg.click('#dlg details.cgrp > summary'); pg.wait_for_timeout(100)
    eq('se abren y se recuerda', pg.evaluate("[$('#dlg details.cgrp').open, uiState().citeOpen]"), [True, ['gen']])
    pg.evaluate("drawD()")
    eq('al redibujar sigue abierta', pg.evaluate("$('#dlg details.cgrp').open"), True)
    pg.click('#dlg details.cgrp > summary'); pg.wait_for_timeout(100)
    pg.evaluate("$('#dlg').close(); openCfg('no')"); pg.check('#cfg input[data-onchange*=citeOnlyMain]'); pg.evaluate("$('#cfg').close()")
    eq('«mostrar solo el estilo principal» se guarda', pg.evaluate("db.settings.citeOnlyMain"), True)
    pg.evaluate("openPaper('a1'); tab = 'cite'; drawD()")
    eq('con la opción, solo sale el principal y un botón', pg.evaluate("[document.querySelectorAll('#dlg .ced[id^=c_]').length, !!$('#dlg button[data-onclick^=\"citeAllOn\"]')]"), [1, True])
    pg.click('#dlg button:has-text("Ver todos los estilos")')
    eq('«Ver todos los estilos» los muestra en ese paper', pg.evaluate("document.querySelectorAll('#dlg .ced[id^=c_]').length === Object.keys(STYLES).length"), True)
    pg.evaluate("$('#dlg').close(); openPaper('a1'); tab = 'cite'; drawD()")
    eq('al abrir otro paper vuelve a salir solo el principal', pg.evaluate("document.querySelectorAll('#dlg .ced[id^=c_]').length"), 1)
    pg.evaluate("tab = 'all'; drawD()")
    eq('«Ver todo» arranca con el estilo principal', pg.evaluate("$('#dlg select[data-onchange^=citeSelSet]').value"), 'derecho')
    # ---- barra de formato de la cita
    pg.evaluate("db.settings.mainStyle = 'apa'; ex().style = 'apa'; db.settings.citeOnlyMain = false; tab = 'cite'; drawD()")
    eq('barra de formato: formato, idioma y fecha', pg.evaluate("[...document.querySelectorAll('#dlg .cbar .cbt')].map(s => s.textContent)"), ['Formato', 'Idioma', 'Fecha de consulta'])
    eq('la barra no lleva texto de explicación', (pg.evaluate("!!$('#dlg .cbar small')"), 'Un asterisco literal se escribe' in pg.inner_text('#dlg')), (False, False))
    eq('la cita se ve en cursiva real, sin asteriscos', pg.evaluate("[$('#c_apa i')?.textContent, $('#c_apa').textContent.includes('*')]"), ['Nature', False])
    eq('y por dentro se guarda con las marcas de siempre', pg.evaluate("citeRaw('apa') === STYLES.apa.fn(D)"), True)
    if shots: pg.screenshot(path=os.path.join(shots, '3_cita_estilo_principal.png'))
    pg.evaluate("const t = $('#c_apa'), n = t.firstChild, i = n.data.indexOf('Deep'), r = document.createRange(); t.focus(); r.setStart(n, i); r.setEnd(n, i + 4); getSelection().removeAllRanges(); getSelection().addRange(r)")
    pg.click('#dlg .cbar button:has-text("Cursiva")')
    eq('Cursiva pone en cursiva lo seleccionado y marca la cita como editada', pg.evaluate("[D.cites.apa.includes('*Deep* learning'), [...document.querySelectorAll('#c_apa i')].some(e => e.textContent === 'Deep')]"), [True, True])
    pg.evaluate("const t = $('#c_apa'); t.focus(); const r = document.createRange(); r.setStart(t.firstChild, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r)")
    pg.keyboard.type('*')
    eq('un asterisco escrito a mano es literal (se guarda como \\*)', pg.evaluate("[D.cites.apa.startsWith('\\\\*'), $('#c_apa').textContent.startsWith('*')]"), [True, True])
    pg.evaluate("delete D.cites.apa; drawD()")
    eq('ida y vuelta: leer el cuadro da el mismo texto en todos los estilos', pg.evaluate("Object.keys(STYLES).filter(k => $('#c_' + k) && ceVal($('#c_' + k)) !== STYLES[k].fn(D))"), [])
    pg.evaluate("D.cites.apa = 'Cita con *cursiva*, un \\\\* literal y **negrita**'; drawD()")
    eq('una cita editada con marcas se muestra con formato y se lee igual', pg.evaluate("[$('#c_apa').innerHTML, ceVal($('#c_apa'))]"), ['Cita con <i>cursiva</i>, un * literal y <b>negrita</b>', 'Cita con *cursiva*, un \\* literal y **negrita**'])
    pg.evaluate("delete D.cites.apa; drawD()")
    pg.select_option('#dlg .cbar select[data-onchange*=lang]', 'en')
    eq('Idioma: el mismo ajuste que Exportar, y la cita cambia', pg.evaluate("[ex().lang, citeRaw('apa').includes('& Bengio')]"), ['en', True])
    pg.select_option('#dlg .cbar select[data-onchange*=dateFmt]', 'iso')
    eq('Fecha de consulta: también', pg.evaluate("ex().dateFmt"), 'iso')
    pg.evaluate("ex().lang = 'es'; ex().dateFmt = 'long'; $('#dlg').close()")
    eq('sin errores de JavaScript', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
