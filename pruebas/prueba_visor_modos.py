# Pruebas (v40.10): visor de PDF y EPUB en modo Sencillo o Completo, con las funciones a elegir (cada modo con sus casillas).
# En el ordenador, una tablet en vertical y dos móviles en vertical: qué botones y menús salen en cada modo, que las casillas de un modo no tocan
# las del otro, que lo que estaba en marcha se para (y vuelve), los atajos, Configuración → Apariencia, el JSON y que nada se monte ni se corte.
# Uso: python3 pruebas/prueba_visor_modos.py .   (MODOS_SHOTS=carpeta para guardar capturas)
import sys, json, os, pathlib, subprocess, time, io, zipfile, base64
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
SHOTS = os.environ.get('MODOS_SHOTS')
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
    else: print('ok  ', name)
PAPER = "(id, t, o = {}) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2024, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], reading: 'por_leer', rating: 0, sectionIds: [], created: '2026-01-01T00:00:00.000Z', ...o})"
PDF = """(async () => { const L = await vwPdfLib(), d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < 4; i++) { const p = d.addPage([595, 842]); for (let k = 0; k < 40; k++) p.drawText(`Página ${i + 1}, línea ${k + 1}: texto de prueba para leer el PDF con calma.`, {x: 90, y: 760 - k * 17, size: 10, font: f}); }
  return new File([await d.save()], 'paper.pdf', {type: 'application/pdf'}); })()"""
def epub():
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro</dc:title><dc:identifier id="uid">x</dc:identifier></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>''')
    z.writestr('OEBPS/nav.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Uno</a></li><li><a href="c2.xhtml">Dos</a></li></ol></nav></body></html>')
    for i in (1, 2): z.writestr(f'OEBPS/c{i}.xhtml', f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo {i}</h1>' + ''.join(f'<p>Párrafo {k} del capítulo {i}, con texto suficiente para leer un rato sin prisa.</p>' for k in range(40)) + '</body></html>')
    z.close(); return base64.b64encode(b.getvalue()).decode()
EPF = f"(() => {{ const b = Uint8Array.from(atob('{epub()}'), c => c.charCodeAt(0)); return new File([b], 'libro.epub', {{type: 'application/epub+zip'}}); }})()"
FITS = """(s => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e || e.hidden || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return 'no se ve: ' + s;
  const r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight; if (r.width < 1 || r.height < 1) return 'sin tamaño: ' + s;
  if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) return `se sale (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)}) de ${W}×${H}: ${s}`;
  if (document.documentElement.scrollWidth > W + 1) return 'la página se desplaza a lo ancho'; return true; })"""
# Ningún botón (o fila) visible de un bloque sale cortado ni se monta sobre otro
BTNS = """(([s, sel]) => { const bs = [...document.querySelectorAll(s + ' ' + (sel || 'button'))].filter(b => !b.hidden && b.offsetParent && getComputedStyle(b).display !== 'none').map(b => [b, b.getBoundingClientRect()]); const W = innerWidth;
  for (const [b, r] of bs) { if (r.left < -1 || r.right > W + 1) return 'se sale: ' + b.textContent.trim(); if (b.scrollWidth > b.clientWidth + 2 && getComputedStyle(b).textOverflow !== 'ellipsis' && getComputedStyle(b).overflowX !== 'auto') return 'texto cortado: ' + b.textContent.trim(); }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1 && !bs[i][0].contains(bs[j][0]) && !bs[j][0].contains(bs[i][0])) return 'se montan: ' + bs[i][0].textContent.trim().slice(0, 40) + ' / ' + bs[j][0].textContent.trim().slice(0, 40); }
  return true; })"""
VIS = "(s => [...document.querySelectorAll(s)].some(e => e.offsetParent && getComputedStyle(e).display !== 'none'))"
MENU = "(() => [...$('#vwMenu').querySelectorAll('button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()))()"
EPMENU = "(() => [...$('#epMenu').querySelectorAll('button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()))()"
has = lambda L, s: any(s in x for x in L)
PORT = 8853
DEVS = [('pc', None), ('tablet', 'iPad (gen 7)'), ('pixel7', 'Pixel 7'), ('iphonese', 'iPhone SE')]
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        for tag, dname in DEVS:
            errs = []
            if dname: dev = {k: v for k, v in pw.devices[dname].items() if k != 'default_browser_type'}; dev['device_scale_factor'] = 2 if SHOTS else dev.get('device_scale_factor', 1)
            else: dev = {'viewport': {'width': 1280, 'height': 800}, 'device_scale_factor': 2 if SHOTS else 1}
            c = b.new_context(**dev, service_workers='block'); A = c.new_page()
            A.on('pageerror', lambda e: errs.append(str(e))); A.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
            A.add_init_script("window.ASK_AUTO = 'accept'"); A.goto(f'http://localhost:{PORT}/index.html'); A.wait_for_timeout(1200); A.evaluate(f"window.P = {PAPER}; 0")
            A.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0; db.papers.push(P('p1', 'Un paper', {{pdf: {{name: 'paper.pdf'}}}}), P('p2', 'Un libro', {{pdf: {{name: 'libro.epub'}}}}));
              PDF_FILES.set('p1', await {PDF}); PDF_FILES.set('p2', {EPF}); markDirty(); render(); }})()""")
            W = A.evaluate("innerWidth"); T = f'{tag} ({W} px):'
            shot = lambda name: SHOTS and A.screenshot(path=f'{SHOTS}/{tag}_{name}.png')
            more = lambda: A.evaluate("vwMore({stopPropagation(){}, currentTarget: $('#vwMoreB')})")
            eq(f'{T} de serie, el visor sigue al modo de la app (Completo)', A.evaluate("[db.settings.vwMode, vfMode(), VF.every(f => vfOn(f[0]))]"), ['', 'full', True])
            A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(2000)
            eq(f'{T} el PDF se abre', A.evaluate("[VW.open, VW.pages.length]"), [True, 4])

            # ---- Completo: todo
            eq(f'{T} Completo: Zona, Nota, Índice y Notas en la barra', [A.evaluate(VIS, s) for s in ['#vw [data-m="area"]', '#vw [data-m="note"]', '#vw .vwtc', '#vw .vwnb']], [True, True, True, True])
            more(); L = A.evaluate(MENU)
            eq(f'{T} Completo: ⋯ con Marcadores, Lápiz, OCR y Buscar una orden', [has(L, 'Marcadores'), has(L, 'Lápiz'), has(L, 'OCR'), has(L, 'Buscar una orden')], [True, True, True, True])
            A.evaluate("vwReadMenu()"); L = A.evaluate(MENU)
            eq(f'{T} Completo: 📖 con columna, regla, texto adaptado y girar', [has(L, 'Columna a columna'), has(L, 'Regla de lectura'), has(L, 'Texto adaptado'), has(L, 'Girar la página')], [True, True, True, True])
            shot('01_completo_lectura')
            A.evaluate("$('#vwMenu').hidden = true")
            eq(f'{T} Completo: la barra cabe y nada se monta', A.evaluate(BTNS, ['#vw .vwtb', '']), True)
            shot('02_completo_barra')

            # ---- Sencillo desde ⚙ Ajustes del visor
            more(); A.evaluate("vwCfgMenu()"); L = A.evaluate(MENU)
            eq(f'{T} ⚙ Ajustes del visor empieza por Sencillo | Completo y «Elegir funciones»', [L[1:4] == ['Sencillo', 'Completo', f'☑ Elegir funciones {A.evaluate("VF.length")} de {A.evaluate("VF.length")} ›'] or L[1:4]], [True])
            A.evaluate("document.querySelector('#vwMenu .vfseg button').click()"); A.wait_for_timeout(300)
            eq(f'{T} al tocar Sencillo, el visor pasa a sencillo y se guarda en el JSON', A.evaluate("[db.settings.vwMode, vfMode(), $('#vwMenu .vfseg button.on')?.textContent]"), ['simple', 'simple', 'Sencillo'])
            eq(f'{T} ⚙ en sencillo: el menú sigue abierto y cabe', A.evaluate(FITS, '#vwMenu'), True)
            shot('03_sencillo_ajustes')
            A.evaluate("$('#vwMenu').hidden = true"); A.wait_for_timeout(200)
            eq(f'{T} Sencillo: sin Zona; con Nota, Índice, Notas, buscar y pantalla completa', [A.evaluate(VIS, s) for s in ['#vw [data-m="area"]', '#vw [data-m="note"]', '#vw .vwtc', '#vw .vwnb', '#vw [data-vf="find"]', '#vw [data-vf="fs"]']], [False, True, True, True, True, True])
            eq(f'{T} Sencillo: la barra cabe y nada se monta', A.evaluate(BTNS, ['#vw .vwtb', '']), True)
            eq(f'{T} Sencillo: el panel, si estaba abierto, ya no tiene la pestaña Figuras', A.evaluate("!VW.side || ![...document.querySelectorAll('#vwSide .vwstt button')].some(b => b.textContent.includes('Figuras'))"), True)
            eq(f'{T} Sencillo: la cabecera cabe y nada se monta', A.evaluate(BTNS, ['#vw .vwh', '']), True)
            shot('04_sencillo_barra')
            more(); L = A.evaluate(MENU)
            eq(f'{T} Sencillo: ⋯ sin Marcadores, Lápiz, OCR ni Buscar una orden; con 📖, ⚙ y descargar', [has(L, 'Marcadores'), has(L, 'Lápiz'), has(L, 'OCR'), has(L, 'Buscar una orden'), has(L, 'Modo de lectura'), has(L, 'Ajustes del visor'), has(L, 'Descargar el PDF')], [False, False, False, False, True, True, True])
            A.evaluate("vwReadMenu()"); L = A.evaluate(MENU)
            eq(f'{T} Sencillo: 📖 con doble página, página a página, automático y recorte', [has(L, 'Doble página'), has(L, 'Página a página'), has(L, 'Desplazamiento automático'), has(L, 'Recortar los márgenes')], [True, True, True, True])
            eq(f'{T} Sencillo: 📖 sin columna, regla, texto adaptado, girar ni leer en voz alta', [has(L, 'Columna a columna'), has(L, 'Regla de lectura'), has(L, 'Texto adaptado'), has(L, 'Girar'), has(L, 'voz alta')], [False, False, False, False, False])
            eq(f'{T} Sencillo: 📖 cabe en la pantalla y nada se monta', [A.evaluate(FITS, '#vwMenu'), A.evaluate(BTNS, ['#vwMenu', ''])], [True, True])
            shot('05_sencillo_lectura')
            A.evaluate("vwRdSet('flip', 1); vwReadMenu()"); L = A.evaluate(MENU)
            eq(f'{T} Sencillo, página a página: con el candado y sin zonas para pasar', [has(L, 'Candado del tamaño'), has(L, 'Zonas para pasar')], [True, False])
            A.evaluate("vwLockSet(1, true)"); eq(f'{T} el candado funciona en sencillo (y su botón se ve)', [A.evaluate("VW.zLock"), A.evaluate(VIS, '#vw .vwh [data-vf="lock"]')], [True, True])
            A.evaluate("$('#vwMenu').hidden = true"); eq(f'{T} Sencillo, página a página: la cabecera con el candado cabe', A.evaluate(BTNS, ['#vw .vwh', '']), True); shot('04b_sencillo_candado')
            A.evaluate("vwAutoMenu()"); L = A.evaluate(MENU)
            eq(f'{T} Sencillo: el automático sin modo concentración', [has(L, 'Empezar el desplazamiento'), has(L, 'concentración')], [True, False])
            more(); A.evaluate("vwCfgMenu()"); L = A.evaluate(MENU)
            eq(f'{T} Sencillo: ⚙ con modo noche; sin marcas, colores con nombre ni tiempo que falta', [has(L, 'Noche'), has(L, 'Marcas junto'), has(L, 'Significado de los colores'), has(L, 'tiempo que falta')], [True, False, False, False])

            # ---- Elegir funciones (del modo que se usa) en el propio visor
            A.evaluate("vfFunMenu(false)"); L = A.evaluate(MENU)
            eq(f'{T} ☑ Elegir funciones: todas, con su casilla', [len([x for x in L if x.startswith('✓') or x.startswith('☐') or 'tick' in x]) >= 0, A.evaluate("$('#vwMenu').querySelectorAll('[role=menuitemcheckbox]').length"), A.evaluate("VF.length")], [True, A.evaluate("VF.length"), A.evaluate("VF.length")])
            eq(f'{T} ☑ Elegir funciones cabe y nada se monta', [A.evaluate(FITS, '#vwMenu'), A.evaluate(BTNS, ['#vwMenu', ''])], [True, True])
            shot('06_elegir_funciones')
            A.evaluate("document.querySelector('#vwMenu [data-onclick^=\"vfSet(\\'simple\\',\\'area\\',1)\"]').click()"); A.wait_for_timeout(200)
            eq(f'{T} marcar Zona en el sencillo la saca en la barra (y el menú sigue abierto)', [A.evaluate(VIS, '#vw [data-m="area"]'), A.evaluate("!$('#vwMenu').hidden"), A.evaluate("db.settings.vwFeat")], [True, True, {'s': {'area': True}, 'f': {}}])
            A.evaluate("document.querySelector('#vwMenu [data-onclick^=\"vfSet(\\'simple\\',\\'crop\\',0)\"]').click()"); A.wait_for_timeout(200)
            eq(f'{T} quitar el recorte del sencillo no lo quita del completo', A.evaluate("[vfOnIn('simple','crop'), vfOnIn('full','crop'), vfOnIn('full','area')]"), [False, True, True])
            A.evaluate("$('#vwMenu').hidden = true")

            if tag == 'pc':
                # ---- atajos
                A.evaluate("vwMode('sel'); $('#vwScroll').focus()")
                A.keyboard.press('Escape') if False else None
                A.evaluate("vfSet('simple','area',false)")
                A.keyboard.press('r'); eq('pc: tecla R (Zona) no hace nada en sencillo', A.evaluate("VW.mode"), 'sel')
                A.keyboard.press('n'); eq('pc: tecla N (Nota) sí', A.evaluate("VW.mode"), 'note'); A.evaluate("vwMode('sel')")
                A.keyboard.press('m'); eq('pc: tecla M (regla) no hace nada en sencillo', A.evaluate("vxRl().on"), False)
                A.keyboard.press('b'); eq('pc: tecla B (marcador) no hace nada en sencillo', A.evaluate("vwBms().length"), 0)
                A.evaluate("vwKeysHelp()"); L = A.evaluate("$('#vwMenu').textContent")
                eq('pc: la lista de atajos no enseña los apagados', ['Herramienta Zona' in L, 'Regla de lectura' in L, 'Marcar o quitar el marcador' in L, 'Herramienta Nota' in L], [False, False, False, True])
                A.evaluate("$('#vwMenu').hidden = true")
                A.keyboard.press('Control+k'); A.wait_for_timeout(200); eq('pc: Ctrl+K no abre las órdenes en sencillo', A.evaluate("$('#cmdk').open"), False)
                # ---- lo que estaba en marcha se para y vuelve, sin perder la preferencia
                A.evaluate("vfModeSet('full'); vwRdSet('crop', 1)"); A.wait_for_timeout(700)
                eq('pc: Completo con recorte puesto', A.evaluate("[VW.crop, JSON.parse(localStorage.getItem('gp-vw-read')).crop]"), [True, True])
                A.evaluate("vfSet('full','crop',false)"); A.wait_for_timeout(300)
                eq('pc: al quitar el recorte se para, pero la preferencia se queda', A.evaluate("[VW.crop, JSON.parse(localStorage.getItem('gp-vw-read')).crop]"), [False, True])
                A.evaluate("vfSet('full','crop',true); vwClose()"); A.wait_for_timeout(300); A.evaluate("pdfOpen('p1', 1)"); A.wait_for_timeout(1500)
                eq('pc: al volver a ponerlo y abrir, el recorte vuelve', A.evaluate("VW.crop"), True)
                A.evaluate("vxRlSet({on: true})"); eq('pc: regla puesta en completo', A.evaluate("!$('#vxRl')?.hidden"), True)
                A.evaluate("vfModeSet('simple')"); A.wait_for_timeout(200)
                eq('pc: al pasar a sencillo la regla se va (y el recorte se queda: el sencillo no lo tiene quitado de serie)', A.evaluate("[!!document.querySelector('#vxRl:not([hidden])'), vxLs('gp-vw-regla', {}).on]"), [False, True])
                A.evaluate("vfModeSet('full')"); A.wait_for_timeout(200)
                eq('pc: y vuelve en completo', A.evaluate("!!document.querySelector('#vxRl:not([hidden])')"), True)
                A.evaluate("vxRlSet({on: false}); vwRdSet('crop', 0)")
                # ---- sigue a la app mientras no se elige
                A.evaluate("db.settings.vwMode = ''; uiModeSet('simple')"); eq('pc: sin elegir, el visor sigue al modo Sencillo de la app', A.evaluate("vfMode()"), 'simple')
                A.evaluate("uiModeSet('full')"); eq('pc: y al Completo', A.evaluate("vfMode()"), 'full')
                A.evaluate("vfModeSet('simple'); uiModeSet('full')"); eq('pc: elegido, ya no sigue a la app', A.evaluate("vfMode()"), 'simple')
                # ---- JSON: lo que llega mal se limpia
                eq('pc: vfNorm limpia lo que no vale', A.evaluate("(s => { vfNorm(s); return s; })({vwMode: 'raro', vwFeat: {s: {area: true, nada: true, crop: 'si'}, f: 3}})"), {'vwMode': '', 'vwFeat': {'s': {'area': True}, 'f': {}}})
                eq('pc: los ajustes del visor viajan en el JSON', A.evaluate("JSON.parse(JSON.stringify(db.settings)).vwMode"), 'simple')
                A.evaluate("vfReset('simple'); vfReset('full')"); eq('pc: «de serie» deja cada modo como venía', A.evaluate("db.settings.vwFeat"), {'s': {}, 'f': {}})

            # ---- EPUB
            A.evaluate("vwClose()"); A.wait_for_timeout(300); A.evaluate("vfModeSet('simple'); pdfOpen('p2', 1)"); A.wait_for_timeout(1800)
            eq(f'{T} EPUB abierto', A.evaluate("EP.open"), True)
            eq(f'{T} EPUB sencillo: sin 🔖 Marcador; con Índice, Notas y buscar', [A.evaluate(VIS, s) for s in ['#epBmB', '#ep .eptc', '#ep .epnb', '#ep [data-vf="find"]']], [False, True, True, True])
            eq(f'{T} EPUB sencillo: la barra cabe y nada se monta', A.evaluate(BTNS, ['#ep .vwtb', '']), True)
            A.evaluate("epMore({stopPropagation(){}, currentTarget: $('#epMoreB')})"); L = A.evaluate(EPMENU)
            eq(f'{T} EPUB sencillo: ⋯ sin Marcadores ni Buscar una orden', [has(L, 'Marcadores'), has(L, 'Buscar una orden'), has(L, 'Modo de lectura')], [False, False, True])
            A.evaluate("epReadMenu()"); L = A.evaluate(EPMENU)
            eq(f'{T} EPUB sencillo: 📖 con página a página, doble página y automático, sin concentración', [has(L, 'Página a página'), has(L, 'Doble página'), has(L, 'Desplazamiento automático'), has(L, 'concentración')], [True, True, True, False])
            shot('07_epub_sencillo_lectura')
            A.evaluate("epCfgMenu()"); L = A.evaluate(EPMENU)
            eq(f'{T} EPUB: ⚙ también con Sencillo | Completo', [L[1:3]], [['Sencillo', 'Completo']])
            A.evaluate("vfFunMenu(true)"); eq(f'{T} EPUB: ☑ Elegir funciones cabe', A.evaluate(FITS, '#epMenu'), True)
            A.evaluate("$('#epMenu').hidden = true; epClose()"); A.wait_for_timeout(300)

            # ---- Configuración → Apariencia
            A.evaluate("openCfg('ap'); CFG_OPEN.add('vf'); drawCfg()"); A.wait_for_timeout(300)
            eq(f'{T} Configuración: bloque «Visor de PDF y EPUB» con una fila por función', A.evaluate("[!!$('#cfg .vffun'), document.querySelectorAll('#cfg .vfrow:not(.vfhd)').length]"), [True, A.evaluate("VF.length")])
            A.evaluate("document.querySelector('#cfg .vffun').scrollIntoView({block: 'start'})"); A.wait_for_timeout(200)
            shot('08_config_funciones')
            eq(f'{T} Configuración: las filas no se montan ni se salen', A.evaluate(BTNS, ['#cfg .vffun', '.vfrow']), True)
            eq(f'{T} Configuración: el nombre de cada función cabe (sin cortar) y las casillas quedan en columna', A.evaluate("""(() => { const R = [...document.querySelectorAll('#cfg .vfrow:not(.vfhd)')]; const xs = new Set(), bad = [];
              for (const r of R) { const n = r.querySelector('.vfn'); if (n.scrollWidth > n.clientWidth + 1) bad.push(n.textContent); const c = r.querySelectorAll('input'); xs.add(Math.round(c[0].getBoundingClientRect().left) + '/' + Math.round(c[1].getBoundingClientRect().left)); const b = c[0].getBoundingClientRect(); if (b.width < 14) bad.push('casilla pequeña'); }
              return [bad, xs.size]; })()"""), [[], 1])
            # marcar una casilla del Completo con el dedo o el ratón
            A.evaluate("document.querySelector('#cfg .vfrow input[aria-label^=\"🖼 Pestaña Figuras en el visor completo\"]').scrollIntoView({block: 'center'})")
            A.click('#cfg .vfrow input[aria-label^="🖼 Pestaña Figuras en el visor completo"]'); A.wait_for_timeout(200)
            eq(f'{T} Configuración: quitar «Figuras» del completo lo guarda solo en el completo', A.evaluate("[db.settings.vwFeat.f.fig, vfOnIn('full','fig'), vfOnIn('simple','fig')]"), [False, False, False])
            A.evaluate("CFG_Q = 'regla'; drawCfg()"); A.wait_for_timeout(200)
            eq(f'{T} el buscador de Configuración encuentra las funciones del visor', A.evaluate("[...document.querySelectorAll('#cfg .vfrow')].filter(r => r.closest('.ci') && r.closest('.ci').offsetParent).map(r => r.querySelector('.vfn')?.firstChild?.textContent).filter(Boolean)"), ['📏 Regla de lectura'])
            A.evaluate("CFG_Q = ''; vfReset('full'); vfModeSet('full'); $('#cfg').close()")
            eq(f'{T} sin errores en la consola', errs, [])
            c.close()
    finally:
        srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
