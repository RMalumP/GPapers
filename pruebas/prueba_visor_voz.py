# Pruebas del visor (v39.53): leer en voz alta (PDF y EPUB, con una voz de mentira), ✏ lápiz (trazos, juntarlos, ventanita, PDF anotado)
# y ⧉ los dos PDF del paper a la vez.
import sys, json, os, pathlib, subprocess, time, base64, io, zipfile
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
MKPDF = """async (NP, w) => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < NP; i++) { const p = d.addPage([595, 842]); let k = 0; for (let y = 760; y > 100; y -= 30) p.drawText(`Esta es la frase ${++k} de la ${w} ${i + 1}.`, {x: 70, y, size: 14, font: f}); }
  return new File([await d.save()], w + '.pdf', {type: 'application/pdf'}); }"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro</dc:title><dc:identifier id="uid">x</dc:identifier></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>')
    z.writestr('OEBPS/c1.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>Uno</h1>' + ''.join(f'<p>Parrafo {k} con ballenas. Y una segunda frase {k}.</p>' for k in range(3)) + '</body></html>')
    z.writestr('OEBPS/c2.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>y</title></head><body><h1>Dos</h1><p>Capitulo dos empieza aqui.</p></body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
# una voz de mentira: apunta lo que se le pide y termina cada frase solo cuando la prueba llama a __end()
VOZ = """(() => { const S = window.__say = {said: [], cur: null, cancels: 0};
  Object.defineProperty(window, 'speechSynthesis', {configurable: true, value: {speak(u) { S.said.push(u.text); S.cur = u; S.rate = u.rate; S.lang = u.lang; }, cancel() { S.cancels++; const u = S.cur; S.cur = null; u?.onerror?.({error: 'interrupted'}); }, getVoices: () => [], pause() {}, resume() {}}});
  window.__end = () => { const u = S.cur; S.cur = null; u?.onend?.({}); }; })()"""
PORT = 8819
MENU = "[...document.querySelectorAll('#vwMenu button')].map(b => b.textContent.trim())"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
    A = c.new_page(); A.set_default_timeout(20000); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept';"); A.add_init_script(VOZ)
    A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; 0"); A.evaluate(f"window.MKPDF = {MKPDF}; 0")
    A.evaluate(f"""async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Voz', {{pdf: {{name: 'pagina.pdf'}}, pdf2: {{name: 'hoja.pdf'}}}}), P('e1', 'Libro', {{pdf: {{name: 'libro.epub'}}}}));
      PDF_FILES.set(pdfKey('p1', 1), await MKPDF(2, 'pagina')); PDF_FILES.set(pdfKey('p1', 2), await MKPDF(3, 'hoja')); PDF_FILES.set(pdfKey('e1', 1), {EPF}); markDirty(); render(); }}""")
    A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1800)
    said = lambda: A.evaluate("__say.said")
    # ---- 🔊 Leer en voz alta (PDF)
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(150); A.evaluate("vwReadMenu()"); A.wait_for_timeout(100)
    eq('📖 Modo de lectura → 🔊 Leer en voz alta', any('Leer en voz alta' in x for x in A.evaluate(MENU)), True)
    A.click('#vwMenu button:has-text("Leer en voz alta")'); A.wait_for_timeout(600)
    eq('lee la primera frase de la página, en español, y la marca', [said(), A.evaluate("__say.lang"), A.evaluate("document.querySelectorAll('#vw .vwp[data-i=\"0\"] .lnsay').length > 0")], [['Esta es la frase 1 de la pagina 1.'], 'es-ES', True])
    eq('la barrita (⏮ ⏸ ⏭ velocidad ✕)', A.evaluate("[...document.querySelectorAll('#vw .lnsayb button')].map(b => b.textContent)"), ['⏮', '⏸', '⏭', '1×', '✕'])
    A.evaluate("__end()"); A.wait_for_timeout(100)
    eq('al acabar, la siguiente', said()[-1], 'Esta es la frase 2 de la pagina 1.')
    A.evaluate("sayStep(1)"); A.wait_for_timeout(100); eq('⏭ salta una', said()[-1], 'Esta es la frase 3 de la pagina 1.')
    A.evaluate("sayStep(-1)"); A.wait_for_timeout(100); eq('⏮ vuelve', said()[-1], 'Esta es la frase 2 de la pagina 1.')
    A.evaluate("sayToggle()"); A.wait_for_timeout(100)
    eq('⏸ pausa (y la barra lo dice)', [A.evaluate("SAY.paused"), A.evaluate("document.querySelector('#vw .lnsayp').textContent"), A.evaluate("__say.cur")], [True, '▶', None])
    A.evaluate("sayToggle()"); A.wait_for_timeout(100); eq('▶ sigue en la misma frase', said()[-1], 'Esta es la frase 2 de la pagina 1.')
    A.evaluate("sayRateStep()"); A.wait_for_timeout(100)
    eq('velocidad: 1,2× (y se recuerda)', [A.evaluate("Math.round(__say.rate * 10) / 10"), A.evaluate("JSON.parse(localStorage.getItem('gp-vw-say')).r"), A.evaluate("document.querySelector('#vw .lnsayr').textContent")], [1.2, 1.2, '1,2×'])
    A.evaluate("SAY.k = SAY.list.length - 1"); A.evaluate("sayStep(0)"); A.wait_for_timeout(100); A.evaluate("__end()"); A.wait_for_timeout(600)
    eq('al acabar la página, pasa a la siguiente', [said()[-1], A.evaluate("document.querySelectorAll('#vw .vwp[data-i=\"1\"] .lnsay').length > 0"), A.evaluate("document.querySelectorAll('#vw .vwp[data-i=\"0\"] .lnsay').length")], ['Esta es la frase 1 de la pagina 2.', True, 0])
    A.evaluate("vwEsc()"); A.wait_for_timeout(100)
    eq('Esc para de leer', [A.evaluate("SAY.on"), A.evaluate("document.querySelectorAll('#vw .lnsay, #vw .lnsayb').length")], [False, 0])
    A.evaluate("LN.sel = {t: 'frase 5 de la pagina 2', pg: 1, ep: false}; saySel(false)"); A.wait_for_timeout(500)
    eq('desde la selección: empieza en esa frase', said()[-1], 'Esta es la frase 5 de la pagina 2.')
    A.evaluate("SAY.k = SAY.list.length - 1"); A.evaluate("sayStep(0)"); A.wait_for_timeout(100); A.evaluate("__end()"); A.wait_for_timeout(500)
    eq('al final del PDF, para y lo dice', [A.evaluate("SAY.on"), A.evaluate("$('#toast')?.textContent || ''").startswith('Fin del PDF')], [False, True])
    eq('la frase partida por el guion de final de línea y las muy largas, en trozos', A.evaluate("[saySplit('Hola. ¿Qué tal? Bien!  Fin').length, saySplit('a, '.repeat(200)).every(([x, y]) => y - x <= 280)]"), [4, True])
    eq('inglés o español', A.evaluate("[sayLang('The whale and the sea are in this book'), sayLang('La ballena y el mar de la novela')]"), ['en-US', 'es-ES'])
    # ---- ✏ Lápiz
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(150); m = A.evaluate(MENU)
    eq('⋯: ✏ Lápiz y ⧉ el PDF 2 al lado', [any(x.endswith('✏ Lápiz') for x in m), any('Ver el PDF 2 al lado' in x for x in m)], [True, True])
    A.click('#vwMenu button:has-text("Lápiz")'); A.wait_for_timeout(200)
    eq('con el lápiz puesto, la píldora', [A.evaluate("$('#vw').dataset.mode"), A.evaluate("!!$('#lnInk') && $('#lnInk').textContent.includes('Lápiz')")], ['ink', True])
    A.evaluate("vwGo(0, true)"); A.wait_for_timeout(300)
    r = A.evaluate("(() => { const r = document.querySelector('#vw .vwp[data-i=\"0\"]').getBoundingClientRect(); return [r.left, r.top, r.width]; })()")
    def stroke(x0, y0, dx, dy):
        A.mouse.move(r[0] + x0, r[1] + y0); A.mouse.down()
        for k in range(1, 9): A.mouse.move(r[0] + x0 + dx * k / 8, r[1] + y0 + dy * k / 8)
        A.mouse.up(); A.wait_for_timeout(120)
    stroke(150, 150, 120, 40); stroke(150, 200, 120, 0)
    ink = lambda: A.evaluate("vwAnns().filter(a => a.k === 'ink').map(a => [a.g.length, a.g.every(s => s.length >= 6 && !(s.length % 2)), a.q.length])")
    eq('dos trazos seguidos: una anotación con dos trazos', ink(), [[2, True, 4]])
    eq('se pintan (svg)', A.evaluate("[document.querySelectorAll('#vw .vwp[data-i=\"0\"] svg.lnink').length, document.querySelectorAll('#vw svg.lnlive').length, !!document.querySelector('#vw svg.lnink path').getAttribute('d').match(/^M[\\d.]+ [\\d.]+L/)]"), [1, 0, True])
    A.wait_for_timeout(2100); stroke(150, 300, 60, 60)
    eq('pasados 2 s, otra', ink(), [[2, True, 4], [1, True, 4]])
    eq('al limpiar: los trazos se guardan; sin trazos, fuera', A.evaluate("annClean([{id: 'a', k: 'ink', p: 0, q: [1, 2, 3, 4], g: [[1, 2, 3, 4], [5]]}, {id: 'b', k: 'ink', p: 0, q: [1, 2, 3, 4]}, {id: 'c', k: 'hl', p: 0, q: [1, 2, 3, 4], g: [[1, 2]]}]).map(a => [a.id, a.g || null])"), [['a', [[1, 2, 3, 4]]], ['c', None]])
    A.evaluate("vwMode('sel')"); A.wait_for_timeout(100)
    eq('al dejar el lápiz, se va la píldora', [A.evaluate("$('#vw').dataset.mode"), A.evaluate("!!$('#lnInk')")], ['sel', False])
    A.evaluate("(() => { const a = vwAnns().find(a => a.k === 'ink'), r = document.querySelector(`#vw .vwhl.ink[data-a=\"${a.id}\"]`).getBoundingClientRect(); vwTapAt(r.left + r.width / 2, r.top + r.height / 2); })()"); A.wait_for_timeout(200)
    eq('tocar un trazo abre su ventanita', A.evaluate("[!$('#vwPop').hidden, $('#vwPop .vwk').textContent.startsWith('✏ Trazo a mano')]"), [True, True])
    A.evaluate("vwPopClose()")
    out = A.evaluate("""(async () => { const bytes = await vwPdfOut(VW.file, vwAnns()), L = await vwLib(), d = await L.getDocument({data: bytes}).promise, pg = await d.getPage(1);
      return (await pg.getAnnotations()).filter(a => a.subtype === 'Ink').map(a => a.inkLists.length).sort(); })()""")
    eq('en el PDF anotado salen como Ink', out, [1, 2])
    eq('en las notas: «Trazo a mano»', A.evaluate("annText(vwPaper(), vwAnns(), 'md').includes('Trazo a mano')"), True)
    # ---- ⧉ Los dos PDF a la vez
    w0 = A.evaluate("$('#vwScroll').clientWidth")
    A.evaluate("p2Open()"); A.wait_for_timeout(1500)
    eq('el PDF 2 al lado: cabecera, páginas y página actual', A.evaluate("[!!$('#lnP2'), $('#lnP2 .lnp2h b').textContent, document.querySelectorAll('#lnP2 .lnp2p').length, document.querySelectorAll('#lnP2 .lnp2p canvas').length > 0, $('#lnP2pg').textContent]"), [True, '📄 PDF 2', 3, True, 'p. 1/3'])
    eq('y el PDF 1 se queda con su parte (con el divisor)', [A.evaluate("$('#vwScroll').clientWidth") < w0 * .7, A.evaluate("!!$('#vwSplit') && $('#vw').classList.contains('lnp2on')")], [True, True])
    A.evaluate("p2Zoom(1)"); A.wait_for_timeout(400)
    eq('su propio zoom', A.evaluate("[P2.z, Math.round(document.querySelector('#lnP2 .lnp2p').getBoundingClientRect().width / $('#lnP2s').clientWidth * 100) > 105]"), [1.25, True])
    A.click('#vw .vwh button[data-onclick^="vwMore"]'); A.wait_for_timeout(150)
    eq('⋯ ofrece cerrarlo', any('Cerrar el PDF 2 de al lado' in x for x in A.evaluate(MENU)), True)
    A.keyboard.press('Escape'); A.evaluate("vwNotes()"); A.wait_for_timeout(500)
    eq('las notas al lado cierran el PDF 2', [A.evaluate("!!$('#lnP2')"), A.evaluate("vwDocked()")], [False, True])
    A.evaluate("p2Open()"); A.wait_for_timeout(1200)
    eq('y el PDF 2 cierra las notas', [A.evaluate("!!$('#lnP2')"), A.evaluate("vwDocked()"), A.evaluate("document.querySelectorAll('#vwSplit').length")], [True, False, 1])
    A.evaluate("p2Close()"); A.wait_for_timeout(300)
    eq('✕ lo cierra (y el divisor)', A.evaluate("[!!$('#lnP2'), !!$('#vwSplit'), $('#vw').classList.contains('lnp2on'), P2.doc]"), [False, False, False, None])
    A.evaluate("p2Open()"); A.wait_for_timeout(1000); A.evaluate("vwClose()"); A.wait_for_timeout(300)
    eq('al cerrar el visor, también', A.evaluate("[!!$('#lnP2'), P2.doc]"), [False, None])
    # ---- EPUB
    A.evaluate("pdfOpen('e1', 1)"); A.wait_for_timeout(1500); A.evaluate("__say.said = []")
    A.evaluate("epMore({stopPropagation() {}, currentTarget: $('#ep .vwh button:last-child')})"); A.wait_for_timeout(100); A.evaluate("epReadMenu()"); A.wait_for_timeout(100)
    eq('EPUB: 🔊 en el modo de lectura', any('Leer en voz alta' in x for x in A.evaluate("[...document.querySelectorAll('#epMenu button')].map(b => b.textContent)")), True)
    A.evaluate("$('#epMenu').hidden = true; sayStart(true)"); A.wait_for_timeout(300)
    eq('EPUB: lee desde el principio, cada párrafo aparte, y marca la frase', [said(), A.evaluate("[...document.querySelectorAll('#epDoc mark.lnsay')].map(m => m.textContent).join('')")], [['Uno'], 'Uno'])
    A.evaluate("__end()"); A.evaluate("__end()"); A.evaluate("__end()"); A.wait_for_timeout(100)
    eq('EPUB: frases', said(), ['Uno', 'Parrafo 0 con ballenas.', 'Y una segunda frase 0.', 'Parrafo 1 con ballenas.'])
    eq('EPUB: la marca no cambia el texto', A.evaluate("[...document.querySelectorAll('#epDoc mark.lnsay')].map(m => m.textContent).join('')"), 'Parrafo 1 con ballenas.')
    A.evaluate("SAY.k = SAY.list.length - 1"); A.evaluate("sayStep(0)"); A.evaluate("__end()"); A.wait_for_timeout(300)
    eq('EPUB: pasa al capítulo siguiente', said()[-1], 'Dos')
    A.evaluate("LN.sel = {t: 'segunda frase 2', pg: 0, ep: true}; saySel(true)"); A.wait_for_timeout(300)
    eq('EPUB: desde la selección', said()[-1], 'Y una segunda frase 2.')
    A.evaluate("epEsc()"); A.wait_for_timeout(100)
    eq('EPUB: Esc para y quita la marca', [A.evaluate("SAY.on"), A.evaluate("document.querySelectorAll('#epDoc mark.lnsay, #ep .lnsayb').length"), A.evaluate("EP.secs[0].textContent.includes('Parrafo 2 con ballenas. Y una segunda frase 2.')")], [False, 0, True])
    eq('sin errores', errs, [])
    b.close(); srv.kill()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
