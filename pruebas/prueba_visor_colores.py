# Pruebas del visor (v39.51): significado de los colores, ⋯ en la barra de la selección (copiar con la cita, definición, traducir,
# Google Académico), sepia en el PDF y tiempo que falta (PDF y EPUB).
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan', 'Gómez, Ana'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
MKPDF = """async NP => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < NP; i++) { const p = d.addPage([595, 842]); for (let y = 780; y > 60; y -= 24) p.drawText(`Pagina ${i + 1} linea ${y} ballena blanca`, {x: 60, y, size: 14, font: f}); }
  return new File([await d.save()], 'colores.pdf', {type: 'application/pdf'}); }"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro</dc:title><dc:identifier id="uid">x</dc:identifier></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>')
    z.writestr('OEBPS/c1.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>Uno</h1>' + ''.join(f'<p>Parrafo {k} con ballenas blancas y arpones afilados en el mar.</p>' for k in range(400)) + '</body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
SEL = """(t => { const sp = [...document.querySelectorAll('#vw .vwp[data-i="1"] .textLayer span')].find(s => s.textContent.includes(t)); const x = sp.firstChild, i = x.data.indexOf('ballena'), r = document.createRange(); r.setStart(x, i); r.setEnd(x, i + 7); getSelection().removeAllRanges(); getSelection().addRange(r); })"""
PORT = 8817
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    def device(dev=None, init=''):
        c = b.new_context(**(pw.devices[dev] if dev else {'viewport': {'width': 1280, 'height': 900}}), service_workers='block')
        p = c.new_page(); p.set_default_timeout(20000); p.on('pageerror', lambda e: errs.append(str(e))); p.add_init_script("window.ASK_AUTO = 'accept';" + init)
        p.goto(f'http://localhost:{PORT}/index.html'); p.wait_for_timeout(1000); p.evaluate(f"window.P = {PAPER}; 0"); p.evaluate(f"window.MKPDF = {MKPDF}; 0")
        p.evaluate("window.CLIP = []; window.clipText = async t => { CLIP.push(t); }; window.OPEN = []; window.open = (u, t, f) => { OPEN.push([u, t, f]); }; 0")
        return c, p
    cA, A = device()
    A.evaluate("""async () => { db.settings.pdfTab = 'app'; db.papers.length = 0;
      const ann = [{id: 'a1', k: 'hl', p: 0, c: '#ffd400', t: 'idea uno', q: [60, 776, 300, 792], up: '2026-01-01T00:00:00Z'}, {id: 'a2', k: 'hl', p: 0, c: '#ff6b6b', t: 'critica dos', q: [60, 752, 300, 768], up: '2026-01-01T00:00:00Z'}, {id: 'a3', k: 'hl', p: 1, c: '#ffd400', t: 'idea tres', q: [60, 776, 300, 792], up: '2026-01-01T00:00:00Z'}];
      db.papers.push(P('p1', 'Colores', {pdf: {name: 'colores.pdf', ann}})); PDF_FILES.set('p1', await MKPDF(4)); markDirty(); render(); }""")
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    # ---- Significado de los colores
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(200); A.evaluate("vwCfgMenu()"); A.wait_for_timeout(150)
    eq('⚙ tiene 🏷 Significado de los colores y ⏱', A.evaluate("['Significado de los colores', 'tiempo que falta'].map(t => $('#vwMenu').textContent.includes(t))"), [True, True])
    A.evaluate("annLblMenu(false)"); A.wait_for_timeout(150)
    eq('el submenú tiene una casilla por color', A.evaluate("$('#vwMenu').querySelectorAll('.lnlbr input').length"), 5)
    A.fill('#vwMenu .lnlbr:nth-of-type(1) input', 'Idea clave'); A.press('#vwMenu .lnlbr:nth-of-type(1) input', 'Tab')
    A.evaluate("annLblSet('#ff6b6b', '  Crítica   del autor ')")
    eq('se guardan en los ajustes (limpios)', A.evaluate("db.settings.annLbl"), {'#ffd400': 'Idea clave', '#ff6b6b': 'Crítica del autor'})
    eq('el botón de color lo dice', A.evaluate("document.querySelector('#vw .vwtb .vwc[data-c=\"0\"]').title"), 'Amarillo · Idea clave')
    A.evaluate("vwPanel('ann')"); A.wait_for_timeout(200)
    eq('el filtro del panel enseña los nombres', A.evaluate("[...document.querySelectorAll('#vwSide .lnchip')].map(b => b.textContent)"), ['Idea clave', 'Crítica del autor'])
    A.evaluate("vwPopOpen('a2')"); A.wait_for_timeout(150)
    eq('la ventanita de la anotación dice su significado', A.evaluate("$('#vwPop .vwk').textContent"), '🖍 Subrayado · p. 1 · Crítica del autor')
    A.evaluate("vwPopClose()")
    t = A.evaluate("annText(vwPaper(), vwAnns(), 'txt')")
    eq('al copiarlas, agrupadas por significado', [t.startswith('IDEA CLAVE\n\n«idea uno»'), 'CRÍTICA DEL AUTOR\n\n«critica dos»' in t, t.index('idea tres') < t.index('CRÍTICA')], [True, True, True])
    eq('en Markdown, con títulos', A.evaluate("annText(vwPaper(), vwAnns(), 'md').split('\\n')[0]"), '### Idea clave')
    eq('sin nombres, como siempre', A.evaluate("(() => { const o = db.settings.annLbl; delete db.settings.annLbl; const t = annText(vwPaper(), vwAnns(), 'txt'); db.settings.annLbl = o; return t.startsWith('«idea uno»'); })()"), True)
    eq('un JSON con nombres raros se limpia', A.evaluate("(() => { const d = validate({papers: [], tags: [], sections: [], settings: {annLbl: {'#ffd400': 'Ok', 'x': 'mal', '#ff6b6b': 7}}}); return (d || {}).settings?.annLbl; })()"), {'#ffd400': 'Ok'})
    # ---- ⋯ de la selección
    A.evaluate("vwSide(false); vwGo(1)"); A.wait_for_timeout(800)
    A.evaluate(SEL + "('linea 780')"); A.wait_for_timeout(500)
    eq('la barra de la selección lleva ⋯', A.evaluate("!$('#vwSel').hidden && !!$('#vwSel [data-onclick^=\"lnSelMore\"]')"), True)
    A.click('#vwSel [data-onclick^="lnSelMore"]'); A.wait_for_timeout(200)
    eq('⋯: copiar con la cita, definición, traducir y Académico', A.evaluate("[...$('#vwMenu').querySelectorAll('button')].map(b => b.textContent)"), ['❝ Copiar con la cita', 'U̲ Subrayar con una línea', 'S̶ Tachar', '📖 Definición (RAE)', '📖 Definition (Cambridge)', '🌐 Traducir al español', '🎓 Buscar en Google Académico'])
    A.click('#vwMenu button:has-text("Copiar con la cita")'); A.wait_for_timeout(200)
    eq('copia «…» (autores, año, página)', A.evaluate("CLIP.at(-1)"), '«ballena» (Pérez y Gómez, 2024, p. 2)')
    A.evaluate(SEL + "('linea 756')"); A.wait_for_timeout(300); A.evaluate("lnSelMore(false)"); A.evaluate("lnSelWeb('rae'); lnSelWeb('tr')")
    eq('definición y traducción, en pestaña nueva', A.evaluate("OPEN.map(x => [x[0], x[1]])"), [['https://dle.rae.es/ballena', '_blank'], ['https://translate.google.com/?sl=auto&tl=es&op=translate&text=ballena', '_blank']])
    A.evaluate("getSelection().removeAllRanges()")
    # ---- Sepia
    A.evaluate("vwNight('sepia')"); A.wait_for_timeout(600)
    eq('sepia en el PDF', A.evaluate("[vwTheme(), $('#vw').classList.contains('sepia'), $('#vw').classList.contains('night'), vwPC().background]"), ['sepia', True, False, '#f4ecd8'])
    A.evaluate("vwNight('on')"); A.wait_for_timeout(300)
    eq('noche sigue igual', A.evaluate("[vwTheme(), $('#vw').classList.contains('sepia'), $('#vw').classList.contains('night')]"), ['night', False, True])
    A.evaluate("vwNight('off')"); A.wait_for_timeout(300)
    eq('normal', A.evaluate("[vwTheme(), vwPC()]"), ['', None])
    # ---- Tiempo que falta
    A.evaluate("localStorage.setItem('gp-vw-pace', 120); vwGo(0); lnLeftShow()"); A.wait_for_timeout(200)
    eq('tiempo que falta en la cabecera (3 páginas a 2 min)', A.evaluate("[$('#vwLeft').textContent, $('#vwLeft').hidden]"), ['≈ 6 min', False])
    A.evaluate("WL.act = Date.now(); LNP.pg = -1; lnPaceTick(); LNP.acc = 40; vwGo(1); lnPaceTick()")
    eq('aprende tu ritmo al pasar de página', A.evaluate("+localStorage.getItem('gp-vw-pace')"), 104)
    A.evaluate("vwFs(true)"); A.wait_for_timeout(300)
    eq('también en el aviso de la pantalla completa', A.evaluate("$('#vwPgTip').textContent"), 'Página 2 de 4 · ≈ 3 min')
    A.evaluate("vwFs(false); lnLeftSet(0)")
    eq('se puede quitar', A.evaluate("$('#vwLeft').hidden"), True)
    A.evaluate("lnLeftSet(1); vwClose()"); A.wait_for_timeout(300)
    cA.close()
    # ---- EPUB
    cC, C = device()
    C.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.settings.annLbl = {{'#5fd068': 'Ejemplo'}}; db.papers.length = 0; db.papers.push(P('p1', 'Libro', {{pdf: {{name: 'libro.epub'}}}})); PDF_FILES.set('p1', {EPF}); markDirty(); render(); }})()""")
    C.evaluate("localStorage.setItem('gp-ep-pace', 1000); pdfOpen('p1', 1)"); C.wait_for_timeout(1500); C.evaluate("lnLeftShow()")
    eq('EPUB: tiempo que falta junto al capítulo', C.evaluate("[$('#epLeft').textContent.startsWith(' · ≈ '), EP.total > 20000]"), [True, True])
    eq('EPUB: los colores con su nombre', C.evaluate("document.querySelector('#ep .vwtb .vwc[data-c=\"1\"]').title"), 'Verde · Ejemplo')
    C.evaluate("""(() => { const p = EP.secs[0].querySelectorAll('p')[3], t = p.firstChild, i = t.data.indexOf('ballenas'), r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 8); getSelection().removeAllRanges(); getSelection().addRange(r); })()"""); C.wait_for_timeout(400)
    C.click('#epSel [data-onclick^="lnSelMore"]'); C.wait_for_timeout(200); C.click('#epMenu button:has-text("Copiar con la cita")'); C.wait_for_timeout(200)
    eq('EPUB: copiar con la cita (capítulo)', C.evaluate("CLIP.at(-1)"), '«ballenas» (Pérez y Gómez, 2024, cap. 1)')
    cC.close()
    eq('sin errores en la página', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas')
sys.exit(1 if fail else 0)
