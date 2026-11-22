# Pruebas (v40.8): doce mejoras del visor de PDF. Añadir a GPapers desde una cita, columna a columna, zona → imagen, atrás y adelante, marcas junto
# a la barra, figuras y tablas, siglas, regla de lectura, texto adaptado, OCR (Tesseract en lib/), Anki y diferencias entre el PDF 1 y el PDF 2.
# Uso: python3 pruebas/prueba_visor_v408.py .   (V408_SHOTS=carpeta para guardar capturas; V408_NO_OCR=1 para saltar el OCR, que tarda)
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
SHOTS = os.environ.get('V408_SHOTS')
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
    else: print('ok  ', name)
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
# Un «paper» a dos columnas: título a todo el ancho, una figura con su pie, una tabla, una sigla definida, citas [1] [2] [3] con enlace a la bibliografía.
MAKE = r"""window.mkPaper = async (variant) => {
  const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica), fb = await d.embedFont(L.StandardFonts.HelveticaBold);
  const S = 9.5, LH = 12.5, cols = [[50, 285], [310, 545]];
  const wrap = (t, w, font = f, s = S) => { const out = []; let line = ''; for (const word of t.split(' ')) { const nl = line ? line + ' ' + word : word; if (font.widthOfTextAtSize(nl, s) > w && line) { out.push(line); line = word; } else line = nl; } if (line) out.push(line); return out; };
  const base = ['Reading on screens has changed how researchers work with papers.', 'Many tools now let readers highlight, annotate and search the text.', 'However, little is known about how these tools shape comprehension.', 'In this study we compare several reading conditions with adult readers.', 'Participants read short scientific articles and answered questions afterwards.', 'We recorded reading times, highlights and the answers of every participant.'];
  const para = k => base.map((s, j) => base[(j + k) % base.length]).join(' ');
  const pages = []; const P = () => { const p = d.addPage([595, 842]); pages.push(p); return p; };
  // página 1
  let p = P(); p.drawText('A study of reading tools and comprehension', {x: 50, y: 790, size: 16, font: fb}); p.drawText('Juan Pérez and Lucía García · Universidad de Prueba', {x: 50, y: 770, size: 10, font: f});
  const links = [];
  const col = (pg, c, y0, texts, stop = 60) => { let y = y0; for (const t of texts) { for (const ln of wrap(t, cols[c][1] - cols[c][0])) { if (y < stop) return y; pg.drawText(ln, {x: cols[c][0], y, size: S, font: f}); y -= LH; } y -= LH * .6; } return y; };
  const t1 = [variant === 2 ? 'We use a recurrent neural network (RNN) to model how people read on tablets.' : 'We use a recurrent neural network (RNN) to model how people read on screens.', para(0), 'Previous work [1] studied paper reading, and a later study [2] looked at attention.', para(1)];
  let y = col(p, 0, 740, t1, 330);
  p.drawRectangle({x: 60, y: 160, width: 210, height: 150, color: L.rgb(.75, .85, .95), borderColor: L.rgb(.2, .3, .5), borderWidth: 1});
  p.drawText('Figure 1. Reading times by condition.', {x: 50, y: 140, size: S, font: f});
  col(p, 1, 740, [para(2), 'The RNN learns the reading speed of each participant [3].', para(3), para(4), variant === 2 ? 'This sentence only exists in the second version of the paper.' : 'This sentence only exists in the first version of the paper.']);
  // página 2
  p = P(); col(p, 0, 790, [para(5), 'Table 1: Results of the experiment.'], 520);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.drawRectangle({x: 50 + c * 75, y: 480 - r * 20, width: 75, height: 20, borderColor: L.rgb(0, 0, 0), borderWidth: .6});
  col(p, 0, 380, [para(0), 'Again the RNN was the best model.']); col(p, 1, 790, [para(1), para(2), para(3), para(4), para(5)]);
  // página 3: bibliografía
  p = P(); p.drawText('References', {x: 50, y: 790, size: 12, font: fb});
  const refs = ['[1] Smith, J. (2020). Old reading habits of scientists. Journal of Tests, 3(2), 1-10.', '[2] García, L. (2019). Deep models of attention in reading. Cognitive Science, 43(1), 1-20. https://doi.org/10.1234/abcd.5678', '[3] Rayner, K. (1998). Eye movements in reading and information processing. Psychological Bulletin, 124(3), 372-422.'];
  y = 768; const dest = [];
  for (const r of refs) { dest.push(y + S); const W = wrap(r, 235); W.forEach((ln, j) => { p.drawText(ln, {x: j ? 62 : 50, y, size: S, font: f}); y -= LH; }); y -= LH * .5; }
  col(p, 1, 790, [para(2), para(3)]);
  return {d, pages, dest};
};"""
FILE = """(async () => { const L = await vwPdfLib();
  const src = await (async () => { const o = await mkPaper(1); return o; })();
  const bytes = await src.d.save(); const doc = await (await vwLib()).getDocument({data: bytes.slice()}).promise;
  // dónde están «[2]» y «[3]» en la página 1 (para poner los enlaces encima)
  const tc = await (await doc.getPage(1)).getTextContent(), find = s => tc.items.find(i => i.str.includes(s));
  const d2 = await L.PDFDocument.load(bytes), pg = d2.getPages(), ref3 = pg[2].ref;
  const mk = (it, sub, k) => { const t = it.transform, i0 = it.str.indexOf(sub), w = it.width / it.str.length; const x = t[4] + w * i0; const a = d2.context.obj({Type: 'Annot', Subtype: 'Link', Rect: [x, t[5] - 2, x + w * sub.length, t[5] + 9], Border: [0, 0, 0], Dest: [ref3, L.PDFName.of('XYZ'), 50, src.dest[k], null]}); pg[0].node.addAnnot(d2.context.register(a)); };
  mk(find('[1]'), '[1]', 0); mk(find('[2]'), '[2]', 1); mk(find('[3]'), '[3]', 2); doc.destroy();
  return new File([await d2.save()], 'paper.pdf', {type: 'application/pdf'}); })()"""
FILE2 = """(async () => { const o = await mkPaper(2); return new File([await o.d.save()], 'paper-v2.pdf', {type: 'application/pdf'}); })()"""
SCAN = """(async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create();
  const c = document.createElement('canvas'); c.width = 1240; c.height = 1754; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111'; x.font = '44px serif';
  ['Llamadme Ismael. Hace unos años, sin dinero', 'en el bolsillo y nada que me interesara', 'en tierra, pensé en navegar un poco', 'y ver la parte acuática del mundo.'].forEach((t, i) => x.fillText(t, 120, 200 + i * 70));
  const png = await d.embedPng(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()); const p = d.addPage([595, 842]); p.drawImage(png, {x: 0, y: 0, width: 595, height: 842});
  return new File([await d.save()], 'escaneado.pdf', {type: 'application/pdf'}); })()"""
CR_WORK = {'DOI': '10.1234/abcd.5678', 'title': ['Deep models of attention in reading'], 'author': [{'family': 'García', 'given': 'Lucía'}], 'issued': {'date-parts': [[2019]]}, 'container-title': ['Cognitive Science'], 'type': 'journal-article', 'volume': '43', 'issue': '1', 'page': '1-20'}
CR_OLD = {'DOI': '10.9999/old.1', 'title': ['Old reading habits of scientists'], 'author': [{'family': 'Smith', 'given': 'John'}], 'issued': {'date-parts': [[2020]]}, 'container-title': ['Journal of Tests'], 'type': 'journal-article'}
PORT = 8851
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', device_scale_factor=2 if SHOTS else 1)
        c.route('https://api.crossref.org/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps({'message': CR_WORK} if '/works/' in r.request.url else {'message': {'items': [CR_OLD, CR_WORK]}})))
        A = c.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.add_init_script("window.ASK_AUTO = 'accept'")
        A.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
        A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1000); A.evaluate(f"window.P = {PAPER}; {MAKE}; 0")
        A.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0;
          db.papers.push(P('p1', 'A study of reading tools', {{pdf: {{name: 'paper.pdf'}}, pdf2: {{name: 'paper-v2.pdf'}}}}), P('p2', 'Eye movements in reading and information processing', {{authors: ['Rayner, Keith'], year: 1998}}), P('p3', 'Escaneado', {{pdf: {{name: 'escaneado.pdf'}}}}));
          PDF_FILES.set('p1', await {FILE}); PDF_FILES.set(pdfKey('p1', 2), await {FILE2}); PDF_FILES.set('p3', await {SCAN}); markDirty(); render(); }})()""")
        A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(2200)
        eq('el PDF se abre (3 páginas)', A.evaluate("VW.pages.length"), 3)

        # ---- 5 · marcas junto a la barra
        A.evaluate("""(() => { const now = vwNow(); vwMut(l => { l.push({id: 'h1', k: 'hl', p: 0, q: [50, 700, 280, 712], c: '#ffd400', t: 'texto', at: now, up: now}, {id: 'h2', k: 'hl', p: 1, q: [50, 500, 280, 512], c: '#ff6b6b', t: 'otro', m: 'comentario', at: now, up: now}); }); vwBmSet([2]); })()"""); A.wait_for_timeout(300)
        eq('marcas: 2 subrayados y 1 marcador', A.evaluate("[document.querySelectorAll('#vxMap .vxmk:not(.bm):not(.fh)').length, document.querySelectorAll('#vxMap .vxmk.bm').length, !$('#vxMap').hidden]"), [2, 1, True])
        A.evaluate("vwFindToggle(true); $('#vwQ').value = 'RNN'"); A.evaluate("vwFind(1)"); A.wait_for_timeout(800)
        eq('marcas: también los resultados de la búsqueda', A.evaluate("document.querySelectorAll('#vxMap .vxmk.fh').length >= 3"), True)
        if SHOTS: A.screenshot(path=f'{SHOTS}/05_marcas_barra.png')
        A.evaluate("vwFindToggle(false); lnBackClear(); vwGo(0, true)"); A.wait_for_timeout(300)
        eq('⚙ Ajustes: se pueden quitar', A.evaluate("vwMore({stopPropagation(){}, currentTarget: $('#vwMoreB')}); vwCfgMenu(); $('#vwMenu').textContent.includes('Marcas junto a la barra')"), True)
        A.evaluate("vxMapSet(0)"); eq('quitadas', A.evaluate("$('#vxMap').hidden"), True); A.evaluate("vxMapSet(1); $('#vwMenu').hidden = true")
        # tocar una marca lleva a su página
        A.evaluate("lnBackClear(); vwGo(0, true)"); A.wait_for_timeout(200)
        A.evaluate("(() => { const k = document.querySelector('#vxMap .vxmk.bm').getBoundingClientRect(), m = $('#vxMap').getBoundingClientRect(); vxMapClick({clientY: k.top + 2, clientX: m.left + 5}); })()"); A.wait_for_timeout(400)
        eq('tocar la marca del marcador lleva a la p. 3 (y deja «atrás»)', A.evaluate("[VW.cur, LN.back.length]"), [2, 1])

        # ---- 4 · atrás y adelante
        A.evaluate("lnBackClear(); vwGo(0, true)"); A.wait_for_timeout(200)
        A.evaluate("vwGoN(3)"); A.wait_for_timeout(300); A.evaluate("vwGoN(2)"); A.wait_for_timeout(300)
        eq('ir a página apunta los saltos', A.evaluate("[VW.cur, LN.back.map(x => x.i)]"), [1, [0, 2]])
        A.keyboard.press('Alt+ArrowLeft'); A.wait_for_timeout(300)
        eq('Alt+← vuelve', A.evaluate("[VW.cur, LN.fwd.map(x => x.i)]"), [2, [1]])
        eq('la píldora enseña atrás y adelante', A.evaluate("[$('#vwBack .lnbk').textContent, $('#vwBack .lnfw').textContent, $('#vwBack .lnfw').hidden]"), ['‹ p. 1', 'p. 2 ›', False])
        if SHOTS: A.screenshot(path=f'{SHOTS}/04_atras_adelante.png')
        A.keyboard.press('Alt+ArrowRight'); A.wait_for_timeout(300)
        eq('Alt+→ va adelante', A.evaluate("[VW.cur, LN.fwd.length]"), [1, 0])
        A.evaluate("vwBmStep(1)"); A.wait_for_timeout(300)
        eq('ir al marcador también deja «atrás»', A.evaluate("[VW.cur, LN.back.at(-1).i]"), [2, 1])
        A.evaluate("lnBackClear(); vwGo(0, true)")

        # ---- 1 · añadir a GPapers desde una cita
        def tapLink(sub):
            r = A.evaluate(f"""(async () => {{ const p = VW.pages[0]; const tc = await p.proxy.getTextContent(); const it = tc.items.find(i => i.str.includes('{sub}')); const v = vwVp(p);
              const w = it.width / it.str.length, x = it.transform[4] + w * (it.str.indexOf('{sub}') + 1), [vx, vy] = v.convertToViewportPoint(x, it.transform[5] + 3); const R = p.el.getBoundingClientRect(), k = R.width / p.w; return [R.left + vx * k, R.top + vy * k]; }})()""")
            A.mouse.click(r[0], r[1]); A.wait_for_timeout(1300)
        tapLink('[3]')
        eq('vista previa de [3]: ya está en la biblioteca', A.evaluate("[!$('#vwLk').hidden, $('#vwLk').textContent.includes('Ya en tu biblioteca'), !!$('#vwLk button[data-onclick=\"vxRefOpen()\"]')]"), [True, True, True])
        eq('la referencia leída es la [3] entera', A.evaluate("VX.ref.s"), '[3] Rayner, K. (1998). Eye movements in reading and information processing. Psychological Bulletin, 124(3), 372-422.')
        if SHOTS: A.screenshot(path=f'{SHOTS}/01a_cita_ya_en_la_biblioteca.png')
        A.evaluate("lnClose()"); tapLink('[2]')
        eq('vista previa de [2]: ➕ Añadir a GPapers', A.evaluate("[$('#vwLk').textContent.includes('Añadir a GPapers'), VX.ref.s.includes('10.1234/abcd.5678')]"), [True, True])
        if SHOTS: A.screenshot(path=f'{SHOTS}/01b_cita_anadir.png')
        A.evaluate("vxRefAdd()"); A.wait_for_timeout(1200)
        eq('con DOI: la ventana de importar con ese trabajo', A.evaluate("[$('#imp').open, IMP.mode, IMP.refs[0]?.title, IMP.from]"), [True, 'prev', 'Deep models of attention in reading', 'p1'])
        if SHOTS: A.screenshot(path=f'{SHOTS}/01c_cita_importar.png')
        A.evaluate("impGo()"); A.wait_for_timeout(400)
        eq('se añade y queda en Relaciones (p1 cita al nuevo)', A.evaluate("(() => { const n = db.papers.find(p => p.title === 'Deep models of attention in reading'); return [!!n, db.papers.find(p => p.id === 'p1').refTo.includes(n?.id), VW.open]; })()"), [True, True, True])
        tapLink('[1]')
        A.evaluate("vxRefAdd()"); A.wait_for_timeout(1200)
        eq('sin DOI: resultados de CrossRef para elegir', A.evaluate("[IMP.mode, IMP.refs.length, IMP.from]"), ['pick', 2, 'p1'])
        A.evaluate("impPick(0)"); eq('al elegir uno se mantiene de dónde viene', A.evaluate("[IMP.mode, IMP.from]"), ['prev', 'p1'])
        A.evaluate("$('#imp').close(); lnClose()")

        # ---- 6 · figuras y tablas
        A.evaluate("vwPanel('fig')"); A.wait_for_timeout(1500)
        eq('pestaña 🖼 Figuras: la figura 1 y la tabla 1', A.evaluate("VX.figs.L.map(f => [f.tab, f.n, f.p])"), [[False, '1', 0], [True, '1', 1]])
        eq('con su miniatura', A.evaluate("document.querySelectorAll('#vwSide .vxfig canvas').length"), 2)
        if SHOTS: A.screenshot(path=f'{SHOTS}/06_figuras_y_tablas.png')
        A.evaluate("lnBackClear(); vwGo(0, true); vxFigGo(1)"); A.wait_for_timeout(400)
        eq('tocar la tabla lleva a la p. 2', A.evaluate("[VW.cur, LN.back.length]"), [1, 1])
        A.evaluate("vwSide(false); lnBackClear(); vwGo(0, true)")

        # ---- 7 · siglas
        sel = """(async (w, pg) => { const p = VW.pages[pg]; const sp = [...p.el.querySelectorAll('.textLayer span')].find(s => s.textContent.includes(w)); sp.scrollIntoView({block: 'center'}); const t = sp.firstChild, i = t.data.indexOf(w); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + w.length); getSelection().removeAllRanges(); getSelection().addRange(r); vwSelShow(); })"""
        A.evaluate("vwGo(1, true)"); A.wait_for_timeout(700)
        A.evaluate(f"({sel})('RNN', 1)"); A.wait_for_timeout(300)
        eq('al seleccionar una sigla sale 🔤 en la barra', A.evaluate("!$('#vwSel').hidden && !$('#vwSel .vxacr').hidden"), True)
        A.evaluate("vxAcr()"); A.wait_for_timeout(1200)
        eq('dice qué significa y dónde se define', A.evaluate("[$('#vxAcrPop .vxacrd')?.textContent, $('#vxAcrPop .vxacrp')?.textContent]"), ['recurrent neural network', 'Definida en la página 1'])
        if SHOTS: A.screenshot(path=f'{SHOTS}/07_siglas.png')
        A.evaluate("lnBackClear(); vxAcrGo()"); A.wait_for_timeout(800)
        eq('➜ Ir allí busca la definición en la p. 1 (con «atrás»)', A.evaluate("[VW.cur, VW.find.hits.length > 0, LN.back.length]"), [0, True, 1])
        A.evaluate("vwFindToggle(false); lnBackClear()")
        A.evaluate(f"vwGo(0, true)"); A.wait_for_timeout(300); A.evaluate(f"({sel})('reading', 0)"); A.wait_for_timeout(200)
        eq('una palabra normal no es sigla', A.evaluate("$('#vwSel .vxacr').hidden"), True)
        A.evaluate("getSelection().removeAllRanges(); $('#vwSel').hidden = true")
        eq('las formas de las siglas', A.evaluate("['RNN', 'RNNs', 'fMRI', 'COVID-19', 'Hola', 'A', 'ABCDEFGHIJKL'].map(vxAcrOf)"), ['RNN', 'RNNs', 'fMRI', 'COVID-19', '', '', ''])
        eq('Schwartz y Hearst', A.evaluate("[vxSh('RNN', 'we use a recurrent neural network'), vxSh('fMRI', 'functional magnetic resonance imaging'), vxSh('WHO', 'the World Health Organization')]"), ['recurrent neural network', 'functional magnetic resonance imaging', 'World Health Organization'])

        # ---- 3 · zona → imagen
        A.evaluate("(() => { const now = vwNow(); vwMut(l => l.push({id: 'z1', k: 'area', p: 0, q: [60, 160, 270, 310], c: '#4dabf7', at: now, up: now})); vwPopOpen('z1'); })()"); A.wait_for_timeout(300)
        eq('la ventanita de una zona ofrece imagen', A.evaluate("['📷 Copiar imagen', '⬇ PNG', '🖼 Imagen del paper'].map(t => $('#vwPop').textContent.includes(t))"), [True, True, True])
        if SHOTS: A.screenshot(path=f'{SHOTS}/03_zona_imagen.png')
        sz = A.evaluate("(async () => { const cv = await vxAreaCanvas(vwAnns().find(a => a.id === 'z1')); return [cv.width, cv.height]; })()")
        eq('el recuadro se pinta con buena resolución y su proporción', [sz[0] >= 800, abs(sz[0] / sz[1] - 210 / 150) < .05], [True, True])
        with A.expect_download() as dl: A.evaluate("vxAreaPng('z1')")
        eq('⬇ PNG descarga una imagen', dl.value.suggested_filename.endswith('p. 1.png'), True)
        A.evaluate("vxAreaCover()"); A.wait_for_timeout(500)
        eq('🖼 la pone como imagen del paper', A.evaluate("db.papers.find(p => p.id === 'p1').image?.kind === 'data' && db.papers.find(p => p.id === 'p1').image.data.startsWith('data:image/jpeg')"), True)
        A.evaluate("vwPopClose()")

        # ---- 11 · Anki
        with A.expect_download() as dl: A.evaluate("vwPanel('ann'); vxAnki()")
        txt = open(dl.value.path(), encoding='utf-8').read()
        eq('🃏 Anki: cabecera y una tarjeta por subrayado con texto', [txt.splitlines()[:3], len(txt.strip().splitlines()) - 3], [['#separator:tab', '#html:true', '#tags column:3'], 2])
        eq('el reverso lleva el comentario y la cita; las etiquetas, el color', [('comentario<br><br><small>' in txt), ('(Pérez, 2024, p. 2)' in txt), txt.splitlines()[3].split('\t')[2]], [True, True, 'gpapers Perez2024 Amarillo'])
        eq('botón 🃏 Anki en el panel', A.evaluate("!!$('#vwSide button[data-onclick=\"vxAnki()\"]')"), True)
        A.evaluate("vwSide(false)")

        # ---- 8 · regla de lectura
        A.keyboard.press('m'); A.wait_for_timeout(300)
        eq('M pone la regla', A.evaluate("[vxRl().on, !$('#vxRl').hidden]"), [True, True])
        A.mouse.move(640, 500); A.wait_for_timeout(200)
        g = A.evaluate("(() => { const t = $('#vxRl .vxrlt').getBoundingClientRect(), b = $('#vxRl .vxrlb').getBoundingClientRect(); return [t.bottom, b.top]; })()")
        eq('sigue al ratón: la franja clara rodea el puntero', [g[0] < 500 < g[1], g[1] - g[0] > 18], [True, True])
        if SHOTS: A.screenshot(path=f'{SHOTS}/08_regla_de_lectura.png')
        A.evaluate("vxRlSet({n: 5})"); g2 = A.evaluate("(() => { const t = $('#vxRl .vxrlt').getBoundingClientRect(), b = $('#vxRl .vxrlb').getBoundingClientRect(); return b.top - t.bottom; })()")
        eq('«Ancha» la hace más alta', g2 > g[1] - g[0], True)
        A.keyboard.press('m'); eq('M la quita', A.evaluate("$('#vxRl').hidden"), True); A.evaluate("vxRlSet({n: 3})")

        # ---- 2 · columna a columna
        A.evaluate("vwGo(0, true); vxColSet(1)"); A.wait_for_timeout(900)
        eq('activa página a página, una página y el primer trozo', A.evaluate("[VW.flip, VW.two, VW.col, VX.seg?.i, VX.seg?.k]"), [True, False, True, 0, 0])
        def vis():   # qué se ve: el texto de la línea en el centro
            return A.evaluate("""(() => { const sc = $('#vwScroll').getBoundingClientRect(); const els = [...document.querySelectorAll('#vwPages .vwp.cur .textLayer span')].filter(s => { const r = s.getBoundingClientRect(); return r.left >= sc.left - 2 && r.right <= sc.right + 2 && r.top >= sc.top && r.bottom <= sc.bottom; }); return els.map(s => s.textContent).join(' '); })()""")
        v0 = vis(); eq('primero, el título (a todo el ancho)', 'A study of reading tools' in v0, True)
        if SHOTS: A.screenshot(path=f'{SHOTS}/02a_columna_titulo.png')
        A.keyboard.press('ArrowRight'); A.wait_for_timeout(700)
        v1 = vis(); eq('→: la columna izquierda ampliada (y no la derecha)', ['recurrent neural network' in v1, 'The RNN learns' in v1, A.evaluate("VW.scale > VW.fitS * 1.4")], [True, False, True])
        if SHOTS: A.screenshot(path=f'{SHOTS}/02b_columna_izquierda.png')
        for _ in range(8):
            if 'The RNN learns' in vis(): break
            A.keyboard.press('ArrowRight'); A.wait_for_timeout(600)
        eq('…y luego la columna derecha', 'The RNN learns' in vis(), True)
        if SHOTS: A.screenshot(path=f'{SHOTS}/02c_columna_derecha.png')
        for _ in range(8):
            if A.evaluate("VW.cur") == 1: break
            A.keyboard.press('ArrowRight'); A.wait_for_timeout(500)
        eq('al acabar la página pasa a la siguiente', A.evaluate("[VW.cur, VX.seg.k]"), [1, 0])
        A.keyboard.press('ArrowLeft'); A.wait_for_timeout(600)
        eq('← vuelve al último trozo de la anterior', A.evaluate("[VW.cur, VX.seg.k === VX.seg.n - 1]"), [0, True])
        A.evaluate("vwReadMenu()"); eq('📖 Modo de lectura ofrece ▥ Columna a columna', A.evaluate("$('#vwMenu').textContent.includes('Columna a columna')"), True); A.evaluate("$('#vwMenu').hidden = true")
        A.evaluate("vwRdSet('flip', 0)"); A.wait_for_timeout(300)
        eq('volver a «desplazando» la quita', A.evaluate("[VW.col, VW.flip, localStorage.getItem('gp-vw-col')]"), [False, False, 'false'])

        # ---- 9 · texto adaptado
        A.evaluate("vwGo(0, true)"); A.keyboard.press('t'); A.wait_for_timeout(1200)
        eq('T abre el texto adaptado desde la página actual', A.evaluate("[vxFlowShown(), document.querySelectorAll('#vxFlA .vxflp').length >= 1, $('#vxFlA .vxflp').dataset.i]"), [True, True, '0'])
        paras = A.evaluate("[...document.querySelectorAll('#vxFlA .vxflp[data-i=\"0\"] p, #vxFlA .vxflp[data-i=\"0\"] h3')].map(e => e.textContent)")
        eq('título como título, y la columna izquierda antes que la derecha', [A.evaluate("$('#vxFlA h3')?.textContent"), any('recurrent neural network (RNN) to model' in x for x in paras), next(i for i, x in enumerate(paras) if 'recurrent neural' in x) < next(i for i, x in enumerate(paras) if 'The RNN learns' in x)], ['A study of reading tools and comprehension', True, True])
        eq('las líneas se juntan en párrafos', any(len(x) > 300 for x in paras), True)
        if SHOTS: A.screenshot(path=f'{SHOTS}/09a_texto_adaptado.png')
        A.evaluate("vxFlowFz(1)"); eq('A+ agranda la letra', A.evaluate("$('#vxFlA').style.fontSize"), '20px'); A.evaluate("vxFlowFz(-1)")
        A.keyboard.press('Escape'); A.wait_for_timeout(200)
        eq('Esc vuelve al PDF (sin cerrar el visor)', A.evaluate("[vxFlowShown(), VW.open]"), [False, True])

        # ---- 12 · diferencias entre el PDF 1 y el PDF 2
        A.evaluate("p2Open()"); A.wait_for_timeout(2000)
        eq('⧉ el PDF 2 al lado, con su botón ≠', A.evaluate("!!$('#lnP2 button[data-onclick=\"vxDiff()\"]')"), True)
        A.evaluate("vxDiff()"); A.wait_for_timeout(2500)
        eq('marca las frases distintas en los dos', A.evaluate("[VX.diff?.dA.map(x => x.t.trim()), VX.diff?.dB.map(x => x.t.trim())]"),
           [['We use a recurrent neural network (RNN) to model how people read on screens.', 'This sentence only exists in the first version of the paper.'], ['We use a recurrent neural network (RNN) to model how people read on tablets.', 'This sentence only exists in the second version of the paper.']])
        eq('…pintadas en las dos páginas y con el resumen', A.evaluate("[document.querySelectorAll('#vwPages .vxdif').length > 0, document.querySelectorAll('#lnP2 .vxdif').length > 0, $('#vxDf').textContent.includes('2 frases solo en el PDF 1')]"), [True, True, True])
        A.evaluate("vxDiffStep(1)"); A.wait_for_timeout(400)
        eq('› lleva a la primera diferencia', A.evaluate("[VW.cur, $('#vxDf .vxdfk').textContent]"), [0, '1 de 2'])
        if SHOTS: A.screenshot(path=f'{SHOTS}/12_diferencias.png')
        A.evaluate("p2Close()"); A.wait_for_timeout(300)
        eq('al cerrar el PDF 2 se quitan las marcas', A.evaluate("document.querySelectorAll('#vw .vxdif').length"), 0)

        # ---- 10 · OCR
        if not os.environ.get('V408_NO_OCR'):
            A.evaluate("vwClose()"); A.wait_for_timeout(400); A.evaluate("pdfOpen('p3', 1)"); A.wait_for_timeout(1800)
            eq('el escaneado no tiene texto', A.evaluate("(async () => (await vxLines(VW.pages[0])).length)()"), 0)
            A.evaluate("vwMore({stopPropagation(){}, currentTarget: $('#vwMoreB')})")
            eq('⋯ ofrece 🔠 Reconocer el texto', A.evaluate("$('#vwMenu').textContent.includes('Reconocer el texto (OCR)')"), True)
            A.evaluate("vxOcrMenu()")
            if SHOTS: A.screenshot(path=f'{SHOTS}/10a_ocr_menu.png')
            A.evaluate("$('#vwMenu').hidden = true; vxOcrRun(0)")
            for _ in range(120):
                A.wait_for_timeout(1000)
                if A.evaluate("!VX.ocrBusy"): break
            words = A.evaluate("(VX.ocr.get(0) || []).map(w => w.t).join(' ')")
            eq('reconoce el texto de la página', ['Ismael' in words, 'bolsillo' in words], [True, True])
            eq('…y queda como texto que se puede seleccionar', A.evaluate("document.querySelectorAll('#vwPages .vxocr span').length > 10"), True)
            A.evaluate("vwFindToggle(true); $('#vwQ').value = 'bolsillo'"); A.evaluate("vwFind(1)"); A.wait_for_timeout(800)
            eq('…y buscar', A.evaluate("[VW.find.hits.length, document.querySelectorAll('#vw .vwfh').length > 0]"), [1, True])
            r = A.evaluate("(() => { const s = [...document.querySelectorAll('#vwPages .vxocr span')].find(x => x.textContent.includes('Ismael')).getBoundingClientRect(); return [s.left, s.top, s.right, s.bottom]; })()")
            hl = A.evaluate("""(() => { const s = [...document.querySelectorAll('#vwPages .vxocr span')].find(x => x.textContent.includes('Ismael')); const r = document.createRange(); r.selectNodeContents(s); getSelection().removeAllRanges(); getSelection().addRange(r); vwSelShow(); return vwFromSel(0); })()""")
            eq('…y subrayar', A.evaluate(f"vwAnns().some(a => a.id === '{hl}' && /Ismael/.test(a.t))"), True)
            if SHOTS: A.evaluate("vwFindToggle(false)"); A.screenshot(path=f'{SHOTS}/10b_ocr_hecho.png')
            A.evaluate("vwClose()"); A.wait_for_timeout(400); A.evaluate("pdfOpen('p3', 1)"); A.wait_for_timeout(2000)
            eq('al volver a abrirlo, lo reconocido sigue', A.evaluate("[VX.ocr.size, document.querySelectorAll('#vwPages .vxocr span').length > 10]"), [1, True])
            eq('…y sirve para buscar desde la lista', A.evaluate("(async () => { const r = await idb('readonly', st => st.get('pdftx:' + pdfKey('p3', 1))); return /bolsillo/.test(r?.pages?.[0] || ''); })()"), True)

        # ---- móvil: texto adaptado y regla
        M = b.new_context(**pw.devices['Pixel 7'], service_workers='block'); Mp = M.new_page(); Mp.on('pageerror', lambda e: errs.append('móvil: ' + str(e)))
        Mp.add_init_script("window.ASK_AUTO = 'accept'"); Mp.goto(f'http://localhost:{PORT}/index.html'); Mp.wait_for_timeout(1200); Mp.evaluate(f"window.P = {PAPER}; {MAKE}; 0")
        Mp.evaluate(f"(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'A study of reading tools', {{pdf: {{name: 'paper.pdf'}}}})); PDF_FILES.set('p1', await {FILE}); markDirty(); render(); }})()")
        Mp.evaluate("pdfOpen('p1', 1)"); Mp.wait_for_timeout(2200)
        Mp.evaluate("vxFlowOpen()"); Mp.wait_for_timeout(1200)
        eq('móvil: texto adaptado sin desplazamiento a lo ancho', Mp.evaluate("[vxFlowShown(), $('#vxFlS').scrollWidth <= $('#vxFlS').clientWidth + 1]"), [True, True])
        if SHOTS: Mp.screenshot(path=f'{SHOTS}/09b_movil_texto_adaptado.png')
        Mp.evaluate("vxFlowClose(); vxColSet(1, true)"); Mp.wait_for_timeout(900)
        if SHOTS: Mp.screenshot(path=f'{SHOTS}/02d_movil_columna.png')
        eq('móvil: columna a columna amplía la columna', Mp.evaluate("VW.scale > VW.fitS * 1.5"), True)
        Mp.evaluate("vxColSet(0); vxRlSet({on: true})"); Mp.wait_for_timeout(400)
        if SHOTS: Mp.screenshot(path=f'{SHOTS}/08b_movil_regla.png')
        eq('móvil: la regla tiene su asa para arrastrarla', Mp.evaluate("!$('#vxRl .vxrlg').hidden && $('#vxRl .vxrlg').getBoundingClientRect().width >= 28"), True)
        Mp.evaluate("vxRlSet({on: false})")
        eq('sin errores en la página', errs, [])
    finally:
        srv.terminate()
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
