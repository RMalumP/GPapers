# Pruebas de los arreglos de la v40.7 (Chromium): fusionar secciones con notas sueltas, año original al importar (BibTeX, CSL JSON, RIS),
# operadores de búsqueda a medio escribir, Ctrl+K → Zonas sin pasar por ⋯, franja del visor, gráfico de Relaciones, chips de la tabla,
# fecha de ejemplo de Exportar, frase de Datos, barra del PDF en una ventana estrecha, y en el móvil: barra del visor, Exportar,
# buscador de Configuración y horizontal. También que el service worker no guarde las consultas a las API.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
FILE = """(async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < 4; i++) { const p = d.addPage([595, 842]); for (let y = 780; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y}`, {x: 60, y, size: 12, font: f}); }
  return new File([await d.save()], 'cuatro.pdf', {type: 'application/pdf'}); })()"""
SEED = f"""(async () => {{ window.P = {PAPER}; db.settings.pdfTab = 'app'; db.papers.length = 0; db.sections.length = 0; db.tags.length = 0; db.trash.length = 0;
  db.sections.push({{id: 's1', name: 'Marco teórico', description: '', color: '#2457c5', tagIds: []}}, {{id: 's2', name: 'Metodología', description: '', color: '#27ae60', tagIds: []}});
  db.tags.push({{id: 't1', name: 'Una etiqueta con un nombre muy, muy largo para ver cómo se corta', color: '#f1c40f'}});
  db.papers.push(P('p1', 'Deep learning for natural language processing: a comprehensive survey of architectures', {{authors: ['García, Ana'], sectionIds: ['s2'], tagIds: ['t1'], pdf: {{name: 'cuatro.pdf'}}, related: ['p2']}}),
    P('p2', 'Attention is all you need', {{year: 2017, related: ['p1'], sectionIds: ['s1']}}), P('p3', 'Tercero', {{sectionIds: ['s1', 's2']}}));
  PDF_FILES.set('p1', await {FILE}); F.group = false; markDirty(); render(); }})()"""
PORT = 8841
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def page(**o):
        c = b.new_context(service_workers='block', **o); c.route('https://**', lambda r: r.abort())
        A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'"); A.on('dialog', lambda d: d.accept())
        A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(900); A.evaluate(SEED); A.wait_for_timeout(200); return c, A
    try:
        c, A = page(viewport={'width': 1280, 'height': 800})
        # ---- 1. Fusionar secciones: también las notas de esa sección en papers que no la tienen marcada, y los de la papelera
        A.evaluate("db.papers[0].notes.push({id: 'n1', sectionId: 's1', content: 'Nota en Marco teórico (el paper está en Metodología)'}); db.trash.push({paper: P('pt', 'En la papelera', {sectionIds: ['s1'], notes: [{id: 'n2', sectionId: 's1', content: 'x'}]}), at: new Date().toISOString(), by: []}); markDirty()")
        A.wait_for_timeout(1700)   # los cambios seguidos (menos de 1,5 s) van en un solo paso de deshacer
        A.evaluate("openMg('sections'); mgMerge('s1', 's2')"); A.wait_for_timeout(300)
        eq('fusionar: la nota suelta pasa a la sección que queda', A.evaluate("db.papers[0].notes.map(q => q.sectionId)"), ['s2'])
        eq('fusionar: los papers de la papelera también', A.evaluate("[db.trash[0].paper.sectionIds, db.trash[0].paper.notes[0].sectionId]"), [['s2'], 's2'])
        eq('fusionar: ninguna nota apunta a una sección que ya no existe', A.evaluate("db.papers.concat(db.trash.map(t => t.paper)).flatMap(p => p.notes).filter(q => !db.sections.some(s => s.id === q.sectionId)).length"), 0)
        eq('fusionar: el aviso dice «se ha juntado con»', A.evaluate("$('#toast').textContent.includes('«Marco teórico» se ha juntado con «Metodología»')"), True)
        eq('fusionar: se puede deshacer', A.evaluate("(() => { undo(); return [db.sections.length, db.papers[0].notes[0].sectionId]; })()"), [2, 's1'])
        A.evaluate("$('#mg').close()")
        # ---- 2. Año de la publicación original al importar y exportar
        eq('BibTeX: origdate → año original', A.evaluate("parseBib('@book{f, author={Freud, Sigmund}, title={El malestar en la cultura}, year={2018}, origdate={1930}, publisher={Alianza}}')[0].origYear"), '1930')
        eq('BibTeX: origdate con fecha completa', A.evaluate("parseBib('@article{a, title={T}, journal={R}, year={2018}, origdate={1995-04-02}}')[0].origYear"), '1995')
        eq('CSL JSON: original-date → año original', A.evaluate("""parseCsl(JSON.stringify([{type: 'book', title: 'El malestar', issued: {'date-parts': [[2018]]}, 'original-date': {'date-parts': [[1930]]}, publisher: 'Alianza'}]))[0].origYear"""), '1930')
        eq('RIS: OP → año original', A.evaluate("parseRis('TY  - BOOK\\nTI  - El malestar\\nPY  - 2018\\nOP  - 1930\\nER  - ')[0].origYear"), '1930')
        eq('RIS: un OP que no es un año no se toma', A.evaluate("parseRis('TY  - BOOK\\nTI  - X\\nPY  - 2018\\nOP  - Título original\\nER  - ')[0].origYear"), '')
        eq('sin año original, vacío', A.evaluate("parseBib('@book{f, title={X}, year={2018}}')[0].origYear"), '')
        A.evaluate("db.papers.push(P('fr', 'El malestar en la cultura', {type: 'libro', authors: ['Freud, Sigmund'], year: 2018, origYear: '1930', venue: 'Alianza'}))")
        eq('ida y vuelta por BibTeX, CSL JSON y RIS', A.evaluate("(() => { const p = db.papers.find(x => x.id === 'fr'); return [parseBib(bibtex([p]))[0].origYear, parseCsl(cslJSON([p]))[0].origYear, parseRis(ris([p]))[0].origYear]; })()"), ['1930', '1930', '1930'])
        A.evaluate("db.papers = db.papers.filter(p => p.id !== 'fr'); render()")
        # ---- 3. Búsqueda: un operador a medio escribir no vacía la lista
        for q in ['autor:', 'año:', '#', '-', 'autor: ']:
            eq(f'buscar «{q}» no vacía la lista', A.evaluate(f"(() => {{ F.q = {json.dumps(q)}; render(); return visible().length; }})()"), 3)
        eq('«autor:garcia» sigue filtrando', A.evaluate("(() => { F.q = 'autor:garcia'; render(); return visible().map(p => p.id); })()"), ['p1'])
        eq('un prefijo desconocido se busca tal cual', A.evaluate("(() => { F.q = 'http:'; render(); return visible().length; })()"), 0)
        A.evaluate("F.q = ''; render()")
        # ---- 4. Tabla: los chips que no caben acaban en «…»
        A.evaluate("setView('table')"); A.wait_for_timeout(300)
        eq('tabla: chips de secciones y etiquetas con «…»', A.evaluate("[...document.querySelectorAll('.tbl td.c-tags .chip, .tbl td.c-sections .chip')].every(c => getComputedStyle(c).textOverflow === 'ellipsis' && c.getBoundingClientRect().right <= c.closest('td').getBoundingClientRect().right + 1)"), True)
        A.evaluate("setView('cards')")
        # ---- 5. Exportar y ficha → Cita: la fecha de ejemplo es la de hoy y el resumen dice el formato
        A.evaluate("openEx()"); A.wait_for_timeout(300)
        today = A.evaluate("(() => { const t = new Date(); return [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')].join('-'); })()")
        eq('Exportar: sin la fecha fija de ejemplo', A.evaluate("$('#ex').innerHTML.includes('20 de octubre de 2026')"), False)
        eq('Exportar: los formatos de fecha llevan la de hoy', A.evaluate("[...document.querySelectorAll('#ex option')].some(o => o.textContent === 'ISO (' + " + json.dumps(today) + " + ')')"), True)
        eq('Exportar: el resumen dice el formato, no una fecha', A.evaluate("$('#ex .exsum').textContent.includes('fecha de consulta larga')"), True)
        A.evaluate("$('#ex').close(); openPaper('p1'); tabSet('cite')"); A.wait_for_timeout(300)
        eq('Cita: sin la fecha fija de ejemplo', A.evaluate("[$('#dlg').innerHTML.includes('20 de octubre de 2026'), $('#dlg .cbsum').textContent.includes('fecha larga')]"), [False, True])
        A.evaluate("tabSet('data')"); A.wait_for_timeout(200)
        eq('Datos: la frase del modo va seguida (sin trozos sueltos)', A.evaluate("getComputedStyle($('#dlg .dmode>small')).display"), 'block')
        A.evaluate("$('#dlg').close()")
        # ---- 6. Relaciones: cada título con su fondo y dentro del dibujo
        A.evaluate("grOpen()"); A.wait_for_timeout(400)
        g = A.evaluate("(() => { const s = $('#grSvg'), W = s.viewBox.baseVal.width, T = [...s.querySelectorAll('.nd text')]; return [T.length, s.querySelectorAll('.grbg').length, T.every(t => { const b = t.getBBox(); return b.x >= 0 && b.x + b.width <= W + 1; }), W]; })()")
        eq('Relaciones: títulos con fondo y sin salirse', g[:3], [2, 2, True])
        A.evaluate("$('#gr').close()")
        # ---- 7. Visor: sin franja arriba y Ctrl+K → Zonas debajo de ⋯
        A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
        eq('visor: la cabecera empieza arriba del todo', A.evaluate("Math.round($('#vw .vwh').getBoundingClientRect().top)"), 0)
        A.evaluate("vwRdSet('flip', 1)"); A.wait_for_timeout(3200); n0 = len(errs)
        A.keyboard.press('Control+k'); A.wait_for_timeout(300); A.keyboard.type('zonas'); A.wait_for_timeout(200); A.keyboard.press('Enter'); A.wait_for_timeout(400)
        m = A.evaluate("(() => { const m = $('#vwMenu'), r = m.getBoundingClientRect(), k = $('#vwMoreB').getBoundingClientRect(); return [!m.hidden, m.textContent.includes('Zonas para pasar'), Math.round(r.right) <= Math.round(k.right) + 1 && r.left > innerWidth / 2, r.top >= k.bottom]; })()")
        eq('Ctrl+K → Zonas: el menú sale debajo de ⋯ y sin errores', [m, errs[n0:]], [[True, True, True, True], []])
        A.click('#vwMenu button:has-text("Volver")'); A.wait_for_timeout(300)
        eq('y «‹ Volver» lleva al modo de lectura, en el mismo sitio', A.evaluate("[!$('#vwMenu').hidden, $('#vwMenu').getBoundingClientRect().left > innerWidth / 2]"), [True, True])
        c.close()
        # ---- 8. Ventana estrecha del ordenador: la barra del PDF cabe (solo iconos)
        c, A = page(viewport={'width': 820, 'height': 700})
        A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
        eq('ventana de 820 px: la barra del PDF cabe entera', A.evaluate("(t => t.scrollWidth <= t.clientWidth)($('#vw .vwtb'))"), True)
        c.close()
        # ---- 9. Móvil
        for dev in ['Galaxy S8', 'Pixel 7']:
            c, A = page(**pw.devices[dev])
            A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
            fit = "(() => { const t = $('#vw .vwtb'), B = [...t.querySelectorAll(':scope>.vwm')].filter(e => e.offsetWidth); return [t.scrollWidth <= t.clientWidth, B.every(e => { const s = e.querySelector('small'); return !s || !s.offsetWidth || s.scrollWidth <= s.clientWidth + 1; }), [...t.querySelectorAll('.vwc')].filter(e => e.offsetWidth).length]; })()"
            eq(f'{dev}: barra del visor sin textos montados, paleta plegada', A.evaluate(fit), [True, True, 1])
            A.tap('#vw .vwtb .vwc.on'); A.wait_for_timeout(200)
            eq(f'{dev}: al tocar el color se abren los cinco', A.evaluate("[...document.querySelectorAll('#vw .vwtb .vwc')].filter(e => e.offsetWidth).length"), 5)
            A.tap('#vw .vwtb .vwc[data-c="3"]'); A.wait_for_timeout(200)
            eq(f'{dev}: al elegir uno se pliega con ese color', A.evaluate("[VW.color, [...document.querySelectorAll('#vw .vwtb .vwc')].filter(e => e.offsetWidth).map(e => e.dataset.c)]"), [3, ['3']])
            A.tap('#vw .vwtb .vwc.on'); A.wait_for_timeout(150); A.tap('#vwScroll'); A.wait_for_timeout(200)
            eq(f'{dev}: tocar fuera la vuelve a plegar', A.evaluate("document.querySelectorAll('#vw .vwtb .vwcs.open').length"), 0)
            A.evaluate("vwClose ? vwClose() : $('#vw').close()"); A.wait_for_timeout(300)
            A.evaluate("openEx(); CFG_OPEN.add('exmore'); exUI()"); A.wait_for_timeout(300)
            al = A.evaluate("[...document.querySelectorAll('#ex .exchk label.row')].filter(l => l.offsetWidth).map(l => Math.abs(l.querySelector('input').getBoundingClientRect().top - l.querySelector('.ckt').getBoundingClientRect().top) < 12)")
            eq(f'{dev}: Exportar → casillas en la misma línea que su texto', all(al) and len(al) > 1, True)
            A.evaluate("$('#ex').close(); openCfg('ap')"); A.wait_for_timeout(300); A.click('#cfgQ'); A.keyboard.type('pdf'); A.wait_for_timeout(300)
            eq(f'{dev}: al buscar en Configuración no se ven las pestañas', A.evaluate("$('#cfg .ctabs').offsetHeight"), 0)
            A.evaluate("$('#cfg').close(); grOpen()"); A.wait_for_timeout(400)
            eq(f'{dev}: Relaciones a tamaño real (no encogido)', A.evaluate("(s => s.getBoundingClientRect().width / s.viewBox.baseVal.width > .95)($('#grSvg'))"), True)
            c.close()
        c, A = page(**pw.devices['Pixel 7 landscape'])
        eq('móvil en horizontal: barra de abajo más baja y el buscador se va al desplazar', A.evaluate("[$('#mvNav').offsetHeight <= 46, getComputedStyle($('#mvTop')).position]"), [True, 'static'])
        c.close()
        # ---- 10. Service worker: las consultas a las API no se guardan; las imágenes de fuera, en su caché
        PNG = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000') + bytes.fromhex('1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082')
        c = b.new_context(service_workers='allow')
        c.route('https://api.crossref.org/**', lambda r: r.fulfill(json={'message': {}}, headers={'Access-Control-Allow-Origin': '*'}))
        c.route('https://img.example.org/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
        A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.goto(f'http://localhost:{PORT}/index.html')
        A.evaluate("navigator.serviceWorker.ready"); A.reload(); A.wait_for_timeout(800)
        A.evaluate("(async () => { await fetch('https://api.crossref.org/works/10.1/x'); await new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = 'https://img.example.org/portada.png'; }); await new Promise(ok => setTimeout(ok, 500)); })()")
        r = A.evaluate("(async () => { const out = {}; for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map(q => q.url).filter(u => !u.startsWith(location.origin)); return out; })()")
        eq('service worker controla la página', A.evaluate("!!navigator.serviceWorker.controller"), True)
        eq('service worker: ninguna consulta a CrossRef en la caché', any('crossref' in u for v in r.values() for u in v), False)
        eq('service worker: la imagen de fuera, en «gp-ext»', r.get('gp-ext'), ['https://img.example.org/portada.png'])
        c.close()
        eq('sin errores en la página', errs, [])
    finally:
        srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
