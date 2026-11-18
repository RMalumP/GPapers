# Pruebas de las novedades de la v40 (Chromium), con las API de fuera simuladas:
# DOI de cualquier agencia (doi.org), arXiv y PubMed · retractados · clave de cita fija · lista vacía · relaciones y parecidos de OpenAlex ·
# repaso de subrayados · Markdown para Obsidian · estadísticas de lectura · «Seguir leyendo» · recibir documentos compartidos · accesos directos.
import sys, json, os, pathlib, subprocess, time, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = "(async () => new File([await (await fetch('pruebas/prueba.pdf')).blob()], 'prueba.pdf', {type: 'application/pdf'}))()"
PORT = 8830
CSL = {'DOI': '10.5281/zenodo.123', 'title': 'Un conjunto de datos', 'author': [{'family': 'García', 'given': 'Ana'}], 'issued': {'date-parts': [[2023]]}, 'publisher': 'Zenodo', 'type': 'dataset'}
ARX = {'DOI': '10.48550/arXiv.2101.00001', 'title': 'Un preprint', 'author': [{'family': 'Li', 'given': 'Wei'}], 'issued': {'date-parts': [[2021]]}, 'publisher': 'arXiv', 'type': 'article'}
PUB = [{'PMID': '31452104', 'DOI': '10.1000/pm.1', 'title': 'Un artículo médico', 'author': [{'family': 'Smith', 'given': 'John'}], 'issued': {'date-parts': [[2019]]}, 'container-title': 'Revista Médica', 'type': 'article-journal'}]
CALLS = []
def doi_org(r):
    CALLS.append(r.request.url)
    u = r.request.url
    if 'zenodo' in u: return r.fulfill(json=CSL, headers={'Access-Control-Allow-Origin': '*'})
    if 'arxiv' in u.lower(): return r.fulfill(json=ARX, headers={'Access-Control-Allow-Origin': '*'})
    r.fulfill(status=404, body='', headers={'Access-Control-Allow-Origin': '*'})
def openalex(r):
    u = r.request.url; CALLS.append(u)
    if 'filter=doi:' in u and 'referenced_works' in u:
        return r.fulfill(json={'results': [
            {'doi': 'https://doi.org/10.1000/a', 'id': 'https://openalex.org/W1', 'referenced_works': ['https://openalex.org/W2', 'https://openalex.org/W9', 'https://openalex.org/W8']},
            {'doi': 'https://doi.org/10.1000/b', 'id': 'https://openalex.org/W2', 'referenced_works': ['https://openalex.org/W9', 'https://openalex.org/W8']},
            {'doi': 'https://doi.org/10.1000/c', 'id': 'https://openalex.org/W3', 'referenced_works': ['https://openalex.org/W1', 'https://openalex.org/W2', 'https://openalex.org/W9']}]})
    if 'filter=doi:' in u and 'is_retracted' in u:
        return r.fulfill(json={'results': [{'doi': 'https://doi.org/10.1000/a', 'is_retracted': True}, {'doi': 'https://doi.org/10.1000/b', 'is_retracted': False}]})
    if 'filter=openalex:' in u:
        ids = u.split('filter=openalex:')[1].split('&')[0].replace('%7C', '|').split('|')
        return r.fulfill(json={'results': [{'id': 'https://openalex.org/' + i, 'doi': f'https://doi.org/10.9/{i.lower()}', 'title': 'Obra ' + i, 'publication_year': 2020,
            'authorships': [{'author': {'display_name': 'Ana Ruiz'}}], 'primary_location': {'source': {'display_name': 'Revista'}}, 'type': 'article'} for i in ids]})
    if '/works/doi:' in u:
        return r.fulfill(json={'id': 'https://openalex.org/W1', 'doi': 'https://doi.org/10.1000/a', 'title': 'Uno', 'publication_year': 2020, 'cited_by_count': 3, 'is_retracted': True,
            'related_works': ['https://openalex.org/W7', 'https://openalex.org/W6']})
    r.fulfill(status=404, body='')
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', accept_downloads=True)
    c.route('https://doi.org/**', doi_org); c.route('https://api.openalex.org/**', openalex)
    c.route('https://api.crossref.org/**', lambda r: r.fulfill(status=404, body=''))
    c.route('https://api.ncbi.nlm.nih.gov/**', lambda r: (CALLS.append(r.request.url), r.fulfill(json=PUB))[1])
    A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'"); A.on('dialog', lambda d: d.accept())
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0")

    # ---- Lista vacía útil (I1)
    A.evaluate("db.papers.length = 0; markDirty(); render()")
    eq('sin papers: botones para empezar', A.evaluate("[...document.querySelectorAll('#list .empty0 button')].map(b => b.getAttribute('data-onclick'))"), ["openImport('doi')", "openImport('file')", 'inboxPick()', 'openPaper()'])
    A.evaluate("db.papers.push(P('a', 'Uno', {doi: '10.1000/a'}), P('b', 'Dos', {doi: '10.1000/b'}), P('c', 'Tres', {doi: '10.1000/c'})); markDirty(); qSet('zzzz', true)")
    eq('con filtros sin resultados: dice cuáles y ofrece limpiarlos', A.evaluate("[!!$('#list .empty1'), /zzzz/.test($('#list .empty1').textContent)]"), [True, True])
    eq('sin nada abierto, la franja «Seguir leyendo» no ocupa sitio', A.evaluate("getComputedStyle($('#cont')).display"), 'none')
    A.click('#list .empty1 button'); A.wait_for_timeout(200)
    eq('«Limpiar filtros» vuelve a mostrarlos todos', A.evaluate("document.querySelectorAll('#list .card').length"), 3)

    # ---- DOI de cualquier agencia, arXiv y PubMed (F1)
    def imp(v):
        A.evaluate(f"openImport('doi'); $('#iDoi').value = {json.dumps(v)}; impDoi()"); A.wait_for_timeout(600)
        r = A.evaluate("IMP && IMP.refs && IMP.refs[0] ? [IMP.refs[0].title, IMP.refs[0].doi, IMP.refs[0].year] : $('#iMsg').textContent"); A.evaluate("$('#imp').close()"); return r
    eq('un DOI que CrossRef no tiene (DataCite): doi.org con CSL', imp('10.5281/zenodo.123'), ['Un conjunto de datos', '10.5281/zenodo.123', '2023'])
    eq('arXiv por su número', imp('2101.00001'), ['Un preprint', '10.48550/arxiv.2101.00001', '2021'])
    eq('arXiv no pregunta a CrossRef', any('crossref' in u and '48550' in u for u in CALLS), False)
    eq('PubMed por PMID', imp('PMID: 31452104'), ['Un artículo médico', '10.1000/pm.1', '2019'])
    eq('un DOI que no existe en ningún sitio: lo dice', 'No existe' in str(imp('10.7777/nada')), True)
    eq('reconoce los enlaces de arXiv y PubMed', A.evaluate("[arxivId('https://arxiv.org/abs/2101.00001v2'), arxivId('arXiv:2101.00001'), arxivId('1234'), pmidOf('https://pubmed.ncbi.nlm.nih.gov/31452104/'), pmidOf('31452104')]"), ['2101.00001', '2101.00001', '', '31452104', ''])

    # ---- Retractados (F2)
    A.evaluate("retrCheck()"); A.wait_for_timeout(600)
    eq('comprueba con OpenAlex y marca el retractado', A.evaluate("db.papers.map(p => !!p.retracted)"), [True, False, False])
    eq('aviso en la tarjeta', A.evaluate("['a', 'b', 'c'].map(i => !!document.querySelector(`#list .card[data-id='${i}'] .retr`))"), [True, False, False])
    A.evaluate("put(F, 'retr', true, render)")
    eq('filtro «Retractados»', A.evaluate("document.querySelectorAll('#list .card').length"), 1)
    A.evaluate("fClrAll()")
    eq('«retracted» solo se guarda si es true', A.evaluate("validate({papers: [P('x', 'X', {retracted: 'si'})], tags: [], sections: []}).papers[0].retracted"), None)

    # ---- Clave de cita fija (F6)
    A.evaluate("ex().fmt = 'bib'; db.papers.forEach(p => delete p.key)")
    bib = A.evaluate("bibtex(db.papers)")
    eq('BibTeX con claves únicas', len(set(l.split('{')[1].rstrip(',') for l in bib.splitlines() if l.startswith('@'))), 3)
    A.evaluate("keysFix()")
    eq('al exportar se fijan en el paper', A.evaluate("db.papers.every(p => typeof p.key === 'string' && p.key)"), True)
    k0 = A.evaluate("db.papers[0].key"); A.evaluate("db.papers[0].title = 'Otro título distinto'; db.papers[0].year = 1999")
    eq('la clave no cambia aunque cambie el paper', A.evaluate("bibtex([db.papers[0]]).split('{')[1].split(',')[0]"), k0)
    A.evaluate("db.papers[0].title = 'Uno'; db.papers[0].year = 2024; markDirty(); recFlush()")
    eq('una clave inválida no entra', A.evaluate("validate({papers: [P('x', 'X', {key: 'con espacio'})], tags: [], sections: []}).papers[0].key"), None)
    eq('BibTeX importado conserva su clave', A.evaluate("parseBib('@article{miClave2020, title={T}, author={A, B}, year={2020}}')[0].key"), 'miClave2020')

    # ---- Relaciones con OpenAlex (F3)
    A.evaluate("relFind()"); A.wait_for_timeout(700)
    eq('propone las «cita a» entre tus papers', A.evaluate("REL.props.map(x => x.a + '→' + x.b).sort()"), ['a→b', 'c→a', 'c→b'])
    eq('y lo que te falta: citado por 2 o más', A.evaluate("REL.miss.map(x => x[0] + ':' + x[1])"), ['W9:3', 'W8:2'])
    A.evaluate("relOn(0, false); lastRecAt = 0"); A.click('#imp button.pri'); A.wait_for_timeout(200)
    eq('añade solo las marcadas', A.evaluate("db.papers.map(p => p.id + ':' + p.refTo.join(','))"), ['a:', 'b:', 'c:a,b'])
    A.evaluate("undo()")
    eq('y se puede deshacer', A.evaluate("db.papers.every(p => !p.refTo.length)"), True)
    A.evaluate("relFind()"); A.wait_for_timeout(500); A.evaluate("relMiss()"); A.wait_for_timeout(500)
    eq('«lo que te falta» va a la vista previa, todo desmarcado', A.evaluate("[IMP.refs.map(r => r.title), IMP.refs.some(r => r.on), /citada por 3/.test($('#imp').textContent)]"), [['Obra W9', 'Obra W8'], False, True])
    A.evaluate("$('#imp').close()")

    # ---- Parecidos (F9)
    A.evaluate("openPaper('a')"); A.wait_for_timeout(300); A.evaluate("oaRelated()"); A.wait_for_timeout(600)
    eq('«Parecidos» trae los related_works para elegir', A.evaluate("[IMP.mode, IMP.refs.map(r => r.title), /Papers parecidos/.test($('#imp').textContent)]"), ['prev', ['Obra W7', 'Obra W6'], True])
    A.evaluate("$('#imp').close(); $('#dlg').close()")

    # ---- Repaso de subrayados (F7) y Markdown para Obsidian (F8)
    A.evaluate("""(() => { const p = db.papers[0]; p.pdf = {name: 'prueba.pdf', ann: [{id: 'h1', p: 0, k: 'hl', c: '#ffd400', t: 'Una frase importante', q: [.1, .1, .5, .12]}, {id: 'h2', p: 1, k: 'hl', c: '#ffd400', t: 'Otra frase', m: 'mi comentario', q: [.1, .1, .5, .12]}]};
      p.general = 'Notas generales'; markDirty(); render(); })()"""); A.wait_for_timeout(300)
    eq('la barra lateral ofrece el repaso', A.evaluate("[!$('#sg-rev').hidden, $('#revN').textContent]"), [True, '(2)'])
    A.evaluate("revOpen()"); A.wait_for_timeout(200)
    eq('el repaso muestra un subrayado con su paper', A.evaluate("[$('#rev').open, /frase/.test($('#rev .revq').textContent), /Uno/.test($('#rev').textContent)]"), [True, True, True])
    A.evaluate("revKnow()"); A.wait_for_timeout(100)
    eq('«Ya lo sé» lo aparta 30 días', A.evaluate("Object.keys(revSt().k).length"), 1)
    A.evaluate("$('#rev').close()")
    with A.expect_download() as dl: A.evaluate("obsSave()")
    z = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read()))
    names = sorted(z.namelist()); md = z.read([x for x in names if 'Uno' in x][0]).decode()
    eq('un .md por paper', len(names), 3)
    eq('con YAML, clave de cita, notas y subrayados', ['citekey:' in md, 'retracted: true' in md, 'Notas generales' in md, '«Una frase importante»' in md, 'mi comentario' in md, md.startswith('---\ntitle: "Uno"')], [True] * 6)

    # ---- Estadísticas de lectura (F10)
    A.evaluate("RL.s = 300; RL.p = 12.4; RL.ids.add('a'); rlFlush()")
    day = A.evaluate("rlDay()"); dev = A.evaluate("syDev()")
    eq('se guarda en el proyecto, por día y dispositivo', A.evaluate("db.readLog"), {day: {dev: {'s': 300, 'p': 12, 'd': ['a']}}})
    eq('lo que no llega a una página se guarda la próxima vez', A.evaluate("[RL.s, Math.round(RL.p * 10) / 10]"), [0, 0.4])
    A.evaluate("lastRecAt = 0; db.papers[1].title = 'Cambiado'; markDirty(); recFlush(); RL.s = 60; rlFlush(); undo()")
    eq('deshacer no borra lo leído', A.evaluate(f"[db.papers[1].title, db.readLog[{json.dumps(day)}][{json.dumps(dev)}].s]"), ['Dos', 360])
    eq('validar: fuera lo inválido, como mucho 400 días', A.evaluate("""(() => { const L = {'2020-01-01': {zz: {s: 'x', p: -3}}, 'mal': {a: {s: 1}}, '2020-01-02': {'A B': {s: 5}, ok: {s: 99999, p: 3, d: ['a', 'a', 7]}}};
      for (let i = 0; i < 405; i++) L[new Date(Date.UTC(2021, 0, 1 + i)).toISOString().slice(0, 10)] = {d1: {s: 10, p: 0}};
      const r = validate({papers: [], tags: [], sections: [], readLog: L}).readLog, ks = Object.keys(r).sort(); return [ks.length, ks[0], r['2020-01-02']]; })()"""), [400, '2021-01-06', None])
    eq('validar: limita y limpia una entrada', A.evaluate("validate({papers: [], tags: [], sections: [], readLog: {'2026-01-02': {ok: {s: 99999, p: 3, d: ['a', 'a', 7]}}}}).readLog"), {'2026-01-02': {'ok': {'s': 86400, 'p': 3, 'd': ['a', '7']}}})
    eq('Drive: dos dispositivos el mismo día se suman, no chocan', A.evaluate("""(() => { const B = {papers: [], readLog: {'2026-01-01': {d1: {s: 60, p: 1}}}};
      const L = {papers: [], readLog: {'2026-01-01': {d1: {s: 120, p: 2}}, '2026-01-02': {d1: {s: 30, p: 0}}}}, R = {papers: [], readLog: {'2026-01-01': {d1: {s: 60, p: 1}, d2: {s: 600, p: 9}}}};
      return syMerge(L, R, B).readLog; })()"""), {'2026-01-01': {'d1': {'s': 120, 'p': 2}, 'd2': {'s': 600, 'p': 9}}, '2026-01-02': {'d1': {'s': 30, 'p': 0}}})
    A.evaluate("render()"); A.wait_for_timeout(300)
    eq('entrada en la barra lateral con lo de hoy', A.evaluate("[!$('#sg-rl').hidden, $('#rlN').textContent]"), [True, '(6 min hoy)'])
    A.evaluate("rlOpen()"); A.wait_for_timeout(150)
    eq('la ventana: hoy, racha, 30 barras y lo más leído', A.evaluate("[$('#rl').open, /6 min/.test($('#rl .rlt b').textContent), document.querySelectorAll('#rl .rlb').length, /1 día/.test($('#rl .rlts').textContent), $('#rl .rlp li').textContent.includes('Uno')]"), [True, True, 30, True, True])
    eq('y los papers de cada mes (6 meses)', A.evaluate("[...document.querySelectorAll('#rl .rlm')[0].children].map(d => d.querySelector('b').textContent)"), ['0', '0', '0', '0', '0', '1'])
    A.evaluate("$('#rl').close()")
    # leyendo de verdad en el visor: cuenta el tiempo y las páginas al pasar
    A.evaluate(f"(async () => {{ db.settings.pdfTab = 'app'; PDF_FILES.set('a', await {FILE}); pdfOpen('a', 1); }})()"); A.wait_for_timeout(1800)
    A.evaluate("RL.s = 0; RL.p = 0; RL.ids.clear(); WL.act = Date.now(); lnPaceTick(); vwGo(1); lnPaceTick(); WL.act = Date.now(); lnPaceTick()"); A.wait_for_timeout(100)
    eq('en el visor: 5 s por tick con actividad y las páginas que pasas', A.evaluate("[RL.s, RL.p, [...RL.ids]]"), [15, 1, ['a']])
    eq('«Seguir leyendo» recuerda el documento', A.evaluate("contGet().id"), 'a')
    A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("lnPaceTick()")
    eq('al cerrar el visor se guarda', A.evaluate(f"[RL.s, db.readLog[{json.dumps(day)}][{json.dumps(dev)}].s]"), [0, 375])
    A.evaluate("render()")
    eq('la barra «Seguir leyendo» aparece en la lista', A.evaluate("[!$('#cont').hidden, /Uno/.test($('#cont').textContent)]"), [True, True])

    # ---- Buscar en el texto de los PDF (F5) y espacio usado (I6)
    A.wait_for_timeout(500)
    eq('al abrir un PDF en el visor se guarda su texto', A.evaluate("idb('readonly', st => st.get('pdftx:a')).then(r => r ? [r.name, r.pages.length, /Pagina 2, linea 1/.test(r.pages[1])] : null)"), ['prueba.pdf', 3, True])
    A.evaluate("qSet('texto:\"pagina 2\"', true)"); A.wait_for_timeout(400)
    eq('texto: encuentra el paper y dice la página', A.evaluate("[[...document.querySelectorAll('#list .card')].map(c => c.dataset.id), $('#list .txhit b').textContent, $('#list .txhit mark').textContent]"), [['a'], 'p. 2', 'Pagina 2'])
    A.evaluate("qSet('subrayado con colores', true)")
    eq('sin la casilla, una palabra normal no mira dentro de los PDF', A.evaluate("document.querySelectorAll('#list .card').length"), 0)
    A.click('#qPdf', force=True); A.wait_for_timeout(300)
    eq('con «Incluir el texto de los PDF y EPUB», sí', A.evaluate("[F.inPdf, [...document.querySelectorAll('#list .card')].map(c => c.dataset.id), $('#list .txhit b').textContent]"), [True, ['a'], 'p. 1'])
    A.evaluate("db.papers[0].pdf.name = 'otro.pdf'; markDirty(); renderQ()")
    eq('si cambia el archivo, el texto viejo no cuenta', A.evaluate("document.querySelectorAll('#list .card').length"), 0)
    A.evaluate("db.papers[0].pdf.name = 'prueba.pdf'; markDirty(); qSet('texto:\"linea 3\"', true)")
    A.click('#list .txhit'); A.wait_for_timeout(2500)
    eq('la página abre el visor ahí, buscando lo mismo', A.evaluate("[VW.open, VW.cur, $('#vwQ').value, VW.find.hits.length > 0]"), [True, 0, 'linea 3', True])
    A.evaluate("vwClose()"); A.wait_for_timeout(300)
    A.evaluate("(async () => { await idb('readwrite', st => st.delete('pdftx:a')); TX.mem = null; const b = await (await fetch('pruebas/prueba.pdf')).blob(); await idb('readwrite', st => st.put(b, 'pdfb:a')); })()")
    A.evaluate("txBuild()"); A.wait_for_timeout(3000)
    eq('«Preparar la búsqueda» lo saca de la copia del navegador', A.evaluate("idb('readonly', st => st.get('pdftx:a')).then(r => r && r.pages.length)"), 3)
    A.evaluate("qSet('', true); put(F, 'inPdf', false); CFG_TAB = 'da'; CFG_OPEN.add('sto'); STO = null; $('#cfg').showModal(); drawCfg()"); A.wait_for_timeout(1200)
    eq('Configuración → Datos: espacio usado por tipo', A.evaluate("[...document.querySelectorAll('#cfgSto .stot tbody tr')].map(r => r.cells[0].textContent + ':' + r.cells[1].textContent).filter(t => /Copias de los PDF|Texto para buscar/.test(t))"), ['Copias de los PDF y EPUB:1', 'Texto para buscar en los PDF y EPUB:1'])
    A.evaluate("stoFree('pdftx')"); A.wait_for_timeout(1200)
    eq('se puede borrar el texto (se vuelve a preparar)', A.evaluate("idb('readonly', st => st.get('pdftx:a')).then(r => r ?? null)"), None)
    A.evaluate("$('#cfg').close()")

    # ---- Órdenes dentro del visor (I5)
    A.evaluate("pdfOpen('a', 1)"); A.wait_for_timeout(1800)
    A.keyboard.press('Control+k'); A.wait_for_timeout(300)
    eq('Ctrl+K en el visor abre la paleta con sus órdenes', A.evaluate("[$('#cmdk').open, !!CMD.rd, CMD.L.length > 15, CMD.L.some(c => c.t === 'Descargar el PDF con las anotaciones' || /Descargar el PDF/.test(c.t))]"), [True, True, True, True])
    eq('incluye las de los submenús, con su ruta', A.evaluate("CMD.rd.some(c => /^📖 Modo de lectura › .*Doble página/.test(c.t)) && CMD.rd.some(c => /^🔖 Marcadores › /.test(c.t))"), True)
    A.keyboard.type('doble pagina'); A.wait_for_timeout(150)
    eq('se filtra escribiendo', A.evaluate("CMD.L.map(c => c.t).filter(t => /Doble/.test(t)).length >= 1 && CMD.L.every(c => /doble/i.test(c.t))"), True)
    A.keyboard.press('Enter'); A.wait_for_timeout(500)
    eq('Intro la ejecuta en el visor', A.evaluate("[$('#cmdk').open, VW.two, VW.open, $('#vwMenu')?.hidden ?? true]"), [False, True, True, True])
    A.evaluate("vwRdSet('two', 0); vwClose()"); A.wait_for_timeout(300)
    A.keyboard.press('Control+k'); A.wait_for_timeout(200)
    eq('fuera del visor, la paleta de siempre', A.evaluate("[$('#cmdk').open, CMD.rd]"), [True, None])
    A.keyboard.press('Escape')

    # ---- Accesos directos (I4) y recibir documentos compartidos (F4)
    eq('accesos directos: nuevo, DOI y leer', A.evaluate("[appAction('doi'), $('#imp').open, ($('#imp').close(), appAction('nada'))]"), [True, True, False])
    A.evaluate("""(async () => { const c = await caches.open('gp-share'), b = await (await fetch('pruebas/prueba.pdf')).blob();
      await c.put('/compartido/0', new Response(b, {headers: {'Content-Type': 'application/pdf', 'X-Name': encodeURIComponent('compartido.pdf')}})); })()"""); A.wait_for_timeout(200)
    A.evaluate("shareFiles()"); A.wait_for_timeout(1200)
    eq('un PDF compartido llega a la bandeja y se borra de la caché', A.evaluate("(async () => [db.inbox.some(i => i.name === 'compartido.pdf'), (await (await caches.open('gp-share')).keys()).length])()"), [True, 0])

    # ---- Trabajo pesado en un worker (R8)
    eq('normalizar en el worker da lo mismo que aquí', A.evaluate("(async () => { db.trash.push({at: new Date().toISOString(), paper: P('t9', 'En la papelera')}); db.papers[2].image = {kind: 'data', data: 'data:image/png;base64,iVBORw0KGgo='}; db.orders = [{id: 'o1', name: 'Prioridad', of: 'tag', fmt: 'num'}]; const s = syTokS(db); return [await wk('norm', {s}) === syNormRaw(JSON.parse(s)), WK.off, db.inbox.length > 0]; })()"), [True, False, True])
    eq('fusionar en el worker da lo mismo que aquí', A.evaluate("""(async () => { const L = JSON.parse(syNormS(JSON.parse(syTokS(db)))), R = structuredClone(L), B = structuredClone(L);
      L.papers[0].title = 'Cambio aquí'; R.papers[1].year = 1999; R.readLog = {'2026-01-01': {zz: {s: 9, p: 0}}};
      const lS = syNormS(L), rS = syNormS(R), w = await syMergeA(lS, rS, B), m = syNormS(syMerge(JSON.parse(lS), JSON.parse(rS), B)); const o = JSON.parse(w);
      return [w === m, o.papers[0].title, o.papers[1].year, !!o.readLog['2026-01-01'].zz]; })()"""), [True, 'Cambio aquí', 1999, True])
    big = "\n".join(f"@article{{k{i}, title={{Título {i}}}, author={{García, Ana and Li, Wei}}, year={{2020}}, journal={{Revista}}, abstract={{{'x' * 400}}}}}" for i in range(800))
    A.evaluate("t => impText(t)", big); A.wait_for_timeout(2500)
    eq('un BibTeX grande se lee en el worker', A.evaluate("[IMP.refs.length, IMP.refs[799].key, $('#imp').open]"), [800, 'k799', True])
    A.evaluate("$('#imp').close(); wkDown()")
    eq('sin worker, todo sigue funcionando aquí', A.evaluate("(async () => { const s = syTokS(db); return [await syNormA(JSON.parse(s), s + ' ') === syNormRaw(JSON.parse(s)), WK.off]; })()"), [True, True])

    # ---- Accesibilidad (I7)
    eq('en el ordenador, la barra lateral no se oculta a los lectores de pantalla', A.evaluate("[$('#side').getAttribute('aria-hidden'), $('#side').inert]"), [None, False])
    eq('los botones de solo emoji se leen con su descripción', A.evaluate("[...document.querySelectorAll('#list .card .cpb')].every(b => b.getAttribute('aria-label') === 'Copiar la cita (estilo elegido en Exportar), con cursiva al pegar en Word')"), True)
    A.evaluate("db.tags.push({id: 'ty', name: 'Amarilla', color: '#ffd400'}, {id: 'tz', name: 'Azul', color: '#1a3a8a'}); db.papers[0].tagIds = ['ty', 'tz']; markDirty(); render()"); A.wait_for_timeout(200)
    eq('etiqueta clara: letra oscura; oscura: letra blanca', A.evaluate("['ty', 'tz'].map(t => getComputedStyle([...document.querySelectorAll('#list .card .chip.on')].find(c => c.textContent === (t === 'ty' ? 'Amarilla' : 'Azul'))).color)"), ['oklch(0 0 0)', 'oklch(1 0 0)'])
    eq('sin errores', errs, [])
    b.close(); srv.terminate()
print(f'{n - fail}/{n} pruebas OK'); sys.exit(1 if fail else 0)
