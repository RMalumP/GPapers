# Pruebas (v40.8) de las doce mejoras del visor en el MÓVIL, en vertical: Pixel 7 (412 px) e iPhone SE (375 px).
# Comprueba que cada ventanita, barra y botón cabe en la pantalla, que nada se desplaza a lo ancho y que se puede usar con el dedo.
# Uso: python3 pruebas/prueba_visor_v408_movil.py .   (V408_SHOTS=carpeta para guardar capturas; V408_NO_OCR=1 para saltar el OCR)
import sys, json, os, pathlib, subprocess, time, re
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
# El PDF de prueba (dos columnas, figura, tabla, sigla, citas con enlace), el PDF 2 y el escaneado: los mismos que en prueba_visor_v408.py
_src = (pathlib.Path(__file__).parent / 'prueba_visor_v408.py').read_text(encoding='utf-8')
_g = {}; exec(compile(_src[_src.index('PAPER = '):_src.index('PORT = ')], 'prueba_visor_v408.py', 'exec'), _g)
PAPER, MAKE, FILE, FILE2, SCAN, CR_WORK = (_g[k] for k in ('PAPER', 'MAKE', 'FILE', 'FILE2', 'SCAN', 'CR_WORK'))
SHOTS = os.environ.get('V408_SHOTS')
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want: fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
    else: print('ok  ', name)
# ¿Cabe el elemento en la pantalla? (visible, dentro a lo ancho y a lo alto) y ¿la página no se desplaza a lo ancho?
FITS = """(s => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e || e.hidden || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return 'no se ve: ' + s;
  const r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight; if (r.width < 1 || r.height < 1) return 'sin tamaño: ' + s;
  if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) return `se sale (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)}) de ${W}×${H}: ${s}`;
  if (document.documentElement.scrollWidth > W + 1) return 'la página se desplaza a lo ancho'; return true; })"""
# Ningún botón visible de un bloque sale cortado ni se monta sobre otro
BTNS = """(s => { const bs = [...document.querySelectorAll(s + ' button')].filter(b => !b.hidden && b.offsetParent).map(b => [b, b.getBoundingClientRect()]); const W = innerWidth;
  for (const [b, r] of bs) { if (r.left < -1 || r.right > W + 1) return 'se sale: ' + b.textContent.trim(); if (b.scrollWidth > b.clientWidth + 2 && getComputedStyle(b).textOverflow !== 'ellipsis') return 'texto cortado: ' + b.textContent.trim(); }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) return 'se montan: ' + bs[i][0].textContent.trim() + ' / ' + bs[j][0].textContent.trim(); }
  return true; })"""
PORT = 8852
DEVS = [('pixel7', 'Pixel 7'), ('iphonese', 'iPhone SE')]
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        for tag, dname in DEVS:
            errs = []; dev = {k: v for k, v in pw.devices[dname].items() if k != 'default_browser_type'}
            c = b.new_context(**dev, service_workers='block')
            c.route('https://api.crossref.org/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps({'message': CR_WORK})))
            M = c.new_page(); M.on('pageerror', lambda e: errs.append(str(e))); M.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
            M.add_init_script("window.ASK_AUTO = 'accept'"); M.goto(f'http://localhost:{PORT}/index.html'); M.wait_for_timeout(1200); M.evaluate(f"window.P = {PAPER}; {MAKE}; 0")
            M.evaluate(f"""(async () => {{ db.settings.pdfTab = 'app'; db.papers.length = 0;
              db.papers.push(P('p1', 'A study of reading tools', {{pdf: {{name: 'paper.pdf'}}, pdf2: {{name: 'paper-v2.pdf'}}}}), P('p2', 'Eye movements in reading and information processing', {{authors: ['Rayner, Keith'], year: 1998}}), P('p3', 'Escaneado', {{pdf: {{name: 'escaneado.pdf'}}}}));
              PDF_FILES.set('p1', await {FILE}); PDF_FILES.set(pdfKey('p1', 2), await {FILE2}); PDF_FILES.set('p3', await {SCAN}); markDirty(); render(); }})()""")
            M.evaluate("pdfOpen('p1', 1)"); M.wait_for_timeout(2200)
            W = M.evaluate("innerWidth"); T = f'{tag} ({W} px):'
            shot = lambda name: SHOTS and M.screenshot(path=f'{SHOTS}/m_{tag}_{name}.png')
            fits = lambda s: M.evaluate(FITS, s)
            eq(f'{T} el PDF se abre en el móvil', [M.evaluate("[VW.open, VW.pages.length, document.documentElement.classList.contains('mv')]")], [[True, 3, True]])
            eq(f'{T} la barra de abajo cabe', M.evaluate(BTNS, '#vw .vwtb'), True)

            # 5 · marcas junto a la barra
            M.evaluate("""(() => { const now = vwNow(); vwMut(l => { l.push({id: 'h1', k: 'hl', p: 0, q: [50, 700, 280, 712], c: '#ffd400', t: 'texto', at: now, up: now}, {id: 'h2', k: 'hl', p: 1, q: [50, 500, 280, 512], c: '#ff6b6b', t: 'otro', m: 'comentario', at: now, up: now}); }); vwBmSet([2]); })()"""); M.wait_for_timeout(400)
            eq(f'{T} 5 · las marcas se ven, dentro de la pantalla', [fits('#vxMap'), M.evaluate("document.querySelectorAll('#vxMap .vxmk').length")], [True, 3])
            shot('05_marcas')

            # 1 · cita → GPapers, con el dedo
            def tapLink(sub):
                r = M.evaluate(f"""(async () => {{ const p = VW.pages[0]; const tc = await p.proxy.getTextContent(); const it = tc.items.find(i => i.str.includes('{sub}')); const v = vwVp(p);
                  const w = it.width / it.str.length, x = it.transform[4] + w * (it.str.indexOf('{sub}') + 1), [vx, vy] = v.convertToViewportPoint(x, it.transform[5] + 3);
                  const R = p.el.getBoundingClientRect(), k = R.width / p.w, Y = R.top + vy * k; if (Y < 80 || Y > innerHeight - 120) {{ $('#vwScroll').scrollTop += Y - innerHeight / 2; }}
                  const R2 = p.el.getBoundingClientRect(); return [R2.left + vx * k, R2.top + vy * k]; }})()""")
                M.wait_for_timeout(300); M.touchscreen.tap(r[0], r[1]); M.wait_for_timeout(1400)
            tapLink('[2]')
            eq(f'{T} 1 · tocar [2] enseña la referencia con «Añadir a GPapers»', M.evaluate("[!$('#vwLk').hidden, $('#vwLk').textContent.includes('Añadir a GPapers')]"), [True, True])
            eq(f'{T} 1 · la vista previa cabe y sus botones también', [fits('#vwLk'), M.evaluate(BTNS, '#vwLk')], [True, True])
            shot('01_cita')
            M.evaluate("vxRefAdd()"); M.wait_for_timeout(1300)
            eq(f'{T} 1 · Importar se abre con el trabajo y cabe', [M.evaluate("[$('#imp').open, IMP.refs[0]?.title]"), fits('#imp')], [[True, 'Deep models of attention in reading'], True])
            shot('01_importar')
            M.evaluate("$('#imp').close(); lnClose()"); M.wait_for_timeout(200)

            # 4 · atrás y adelante
            M.evaluate("lnBackClear(); vwGo(0, true)"); M.wait_for_timeout(200); M.evaluate("vwGoN(3)"); M.wait_for_timeout(300); M.evaluate("vwGoN(2)"); M.wait_for_timeout(300); M.evaluate("lnBack()"); M.wait_for_timeout(400)
            eq(f'{T} 4 · la píldora atrás/adelante cabe, con los dos botones', [fits('#vwBack'), M.evaluate(BTNS, '#vwBack'), M.evaluate("[!$('#vwBack .lnbk').hidden, !$('#vwBack .lnfw').hidden]")], [True, True, [True, True]])
            shot('04_atras_adelante')
            M.locator('#vwBack .lnfw').tap(); M.wait_for_timeout(400)
            eq(f'{T} 4 · tocar «adelante» va adelante', M.evaluate("VW.cur"), 1)
            M.evaluate("lnBackClear(); vwGo(0, true)")

            # 6 · pestaña Figuras
            M.evaluate("vwPanel('fig')"); M.wait_for_timeout(1600)
            eq(f'{T} 6 · el panel cabe y lista la figura y la tabla con miniatura', [fits('#vwSide'), M.evaluate("[VX.figs.L.length, document.querySelectorAll('#vwSide .vxfig canvas').length]")], [True, [2, 2]])
            eq(f'{T} 6 · la pestaña elegida se lee entera', M.evaluate("(b => b.scrollWidth <= b.clientWidth + 1)($('#vwSide button[role=tab].on'))"), True)
            eq(f'{T} 6 · las pestañas no se montan', M.evaluate(BTNS, '#vwSide .vwst'), True)
            shot('06_figuras')
            M.locator('#vwSide .vxfig').nth(1).tap(); M.wait_for_timeout(600)
            eq(f'{T} 6 · tocar la tabla lleva a la p. 2', M.evaluate("VW.cur"), 1)
            M.evaluate("vwSide(false); lnBackClear()"); M.wait_for_timeout(200)

            # 7 · siglas
            sel = """(async (w, pg) => { const p = VW.pages[pg]; const sp = [...p.el.querySelectorAll('.textLayer span')].find(s => s.textContent.includes(w)); sp.scrollIntoView({block: 'center'}); const t = sp.firstChild, i = t.data.indexOf(w); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + w.length); getSelection().removeAllRanges(); getSelection().addRange(r); vwSelShow(); })"""
            M.evaluate("vwGo(1, true)"); M.wait_for_timeout(700); M.evaluate(f"({sel})('RNN', 1)"); M.wait_for_timeout(400)
            eq(f'{T} 7 · la barra de selección con 🔤 cabe', [M.evaluate("!$('#vwSel .vxacr').hidden"), fits('#vwSel')], [True, True])
            if W >= 360: eq(f'{T} 7 · …con todos sus botones a la vista', M.evaluate(BTNS, '#vwSel'), True)
            else: eq(f'{T} 7 · …y en 320 px se desliza para llegar a 🔤', M.evaluate("(b => { b.scrollLeft = b.scrollWidth; const r = $('#vwSel .vxacr').getBoundingClientRect(); return b.scrollWidth > b.clientWidth && r.right <= innerWidth && r.left >= 0; })($('#vwSel'))"), True)
            shot('07_seleccion')
            M.locator('#vwSel .vxacr').tap(); M.wait_for_timeout(1300)
            eq(f'{T} 7 · la ventanita de la sigla cabe y dice qué es', [fits('#vxAcrPop'), M.evaluate("$('#vxAcrPop .vxacrd')?.textContent"), M.evaluate(BTNS, '#vxAcrPop')], [True, 'recurrent neural network', True])
            shot('07_siglas')
            M.evaluate("vxPopClose('vxAcrPop'); getSelection().removeAllRanges(); $('#vwSel').hidden = true; lnBackClear()")

            # 3 · zona → imagen
            M.evaluate("vwGo(0, true)"); M.wait_for_timeout(300)
            M.evaluate("(() => { const now = vwNow(); vwMut(l => l.push({id: 'z1', k: 'area', p: 0, q: [60, 160, 270, 310], c: '#4dabf7', at: now, up: now})); vwPopOpen('z1'); })()"); M.wait_for_timeout(400)
            eq(f'{T} 3 · la ventanita de la zona cabe, con sus botones de imagen', [fits('#vwPop'), M.evaluate(BTNS, '#vwPop'), M.evaluate("['📷 Copiar imagen', '⬇ PNG', '🖼 Imagen del paper'].every(t => $('#vwPop').textContent.includes(t))")], [True, True, True])
            shot('03_zona')
            M.evaluate("vwPopClose()")

            # 11 · Anki (en el panel de anotaciones)
            M.evaluate("vwPanel('ann')"); M.wait_for_timeout(500)
            M.evaluate("(() => { const b = $('#vwSide button[data-onclick=\"vxAnki()\"]'); b && b.scrollIntoView({block: 'center'}); })()"); M.wait_for_timeout(200)
            eq(f'{T} 11 · el botón 🃏 Anki se ve y cabe con los demás', [fits('#vwSide button[data-onclick="vxAnki()"]'), M.evaluate(BTNS, '#vwSide .vwsx')], [True, True])
            shot('11_anki')
            with M.expect_download() as dl: M.locator('#vwSide button[data-onclick="vxAnki()"]').tap()
            eq(f'{T} 11 · tocarlo descarga las tarjetas', open(dl.value.path(), encoding='utf-8').read().startswith('#separator:tab'), True)
            M.evaluate("vwSide(false)")

            # 8 · regla de lectura: con el dedo, por su asa
            M.evaluate("vxRlSet({on: true})"); M.wait_for_timeout(300)
            eq(f'{T} 8 · la regla y su asa caben', [fits('#vxRl .vxrlg'), M.evaluate("$('#vxRl .vxrlg').getBoundingClientRect().width >= 28")], [True, True])
            y0 = M.evaluate("$('#vxRl .vxrlt').getBoundingClientRect().bottom")
            g = M.evaluate("(r => [r.left + r.width / 2, r.top + r.height / 2])($('#vxRl .vxrlg').getBoundingClientRect())")
            cdp = c.new_cdp_session(M); tp = lambda t, y: cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': g[0], 'y': y}]})
            tp('touchStart', g[1]); M.wait_for_timeout(50)
            for k in range(1, 7): tp('touchMove', g[1] + 25 * k); M.wait_for_timeout(30)
            tp('touchEnd', 0); M.wait_for_timeout(300)
            eq(f'{T} 8 · arrastrar el asa baja la franja', M.evaluate("$('#vxRl .vxrlt').getBoundingClientRect().bottom") > y0 + 100, True)
            shot('08_regla')
            M.evaluate("vxRlSet({on: false})")

            # 9 · texto adaptado
            M.evaluate("vwGo(0, true); vxFlowOpen()"); M.wait_for_timeout(1300)
            eq(f'{T} 9 · texto adaptado: cabe, sin desplazarse a lo ancho', [fits('#vxFlow'), M.evaluate("$('#vxFlS').scrollWidth <= $('#vxFlS').clientWidth + 1")], [True, True])
            eq(f'{T} 9 · sus botones (A− A+ Aa ✕) caben en la cabecera', M.evaluate(BTNS, '#vxFlow .vxflh'), True)
            eq(f'{T} 9 · letra legible (≥ 16 px)', M.evaluate("parseFloat(getComputedStyle($('#vxFlA p')).fontSize) >= 16"), True)
            shot('09_texto_adaptado')
            M.evaluate("vxFlowClose()"); M.wait_for_timeout(200)

            # 2 · columna a columna, con toques
            M.evaluate("vwGo(0, true); vxColSet(1, true)"); M.wait_for_timeout(1000)
            k0 = M.evaluate("VX.seg?.k"); M.touchscreen.tap(W - 40, M.evaluate("innerHeight / 2")); M.wait_for_timeout(800)
            eq(f'{T} 2 · tocar a la derecha pasa al siguiente trozo', [k0, M.evaluate("VX.seg?.k")], [0, 1])
            eq(f'{T} 2 · el trozo de columna llena el ancho (ampliado)', M.evaluate("VW.scale > VW.fitS * 1.5"), True)
            eq(f'{T} 2 · el aviso de página/trozo cabe', fits('#vxTip') if M.evaluate("!!$('#vxTip') && !$('#vxTip').hidden") else True, True)
            shot('02_columna')
            ty = M.evaluate("(() => { for (let y = innerHeight * .35; y < innerHeight * .85; y += 12) { const e = document.elementFromPoint(40, y); if (e && !e.closest('.vwa, .vwhl, [data-a], .vwlk, a, #vwBack, #vwPgTip, #toast')) return y; } return innerHeight / 2; })()")   # un sitio sin subrayado ni enlace
            M.touchscreen.tap(40, ty); M.wait_for_timeout(800)
            eq(f'{T} 2 · tocar a la izquierda vuelve', M.evaluate("VX.seg?.k"), 0)
            M.evaluate("vxColSet(0, true); vwRdSet('flip', 0)"); M.wait_for_timeout(400)

            # menú de lectura con las opciones nuevas
            M.evaluate("vxRlSet({on: true}); vwReadMenu()"); M.wait_for_timeout(300)
            eq(f'{T} el menú de lectura cabe, con columna, regla (fina/media/ancha) y texto adaptado', [fits('#vwMenu'), M.evaluate(BTNS, '#vwMenu'), M.evaluate("['Columna a columna', 'Regla', 'Fina', 'Ancha', 'Texto adaptado'].every(t => $('#vwMenu').textContent.includes(t))")], [True, True, True])
            shot('lectura_menu')
            M.evaluate("$('#vwMenu').hidden = true; vxRlSet({on: false})")

            # 12 · diferencias PDF 1 / PDF 2
            M.evaluate("p2Open()"); M.wait_for_timeout(2200)
            p2 = M.evaluate("!!$('#lnP2') && !$('#lnP2').hidden && !!$('#lnP2 button[data-onclick=\"vxDiff()\"]')")
            eq(f'{T} 12 · el PDF 2 se abre con su botón ≠', p2, True)
            if p2:
                M.locator('#lnP2 button[data-onclick="vxDiff()"]').tap(); M.wait_for_timeout(2600)
                eq(f'{T} 12 · encuentra las 2 + 2 frases distintas', M.evaluate("[VX.diff?.dA.length, VX.diff?.dB.length]"), [2, 2])
                eq(f'{T} 12 · la barra de diferencias cabe, con ‹ ›', [fits('#vxDf'), M.evaluate(BTNS, '#vxDf')], [True, True])
                eq(f'{T} 12 · la cabecera del PDF 2 cabe', M.evaluate(BTNS, '#lnP2 .lnp2h') if M.evaluate("!!$('#lnP2 .lnp2h')") else M.evaluate(BTNS, '#lnP2'), True)
                M.evaluate("vxDiffStep(1)"); M.wait_for_timeout(500)
                shot('12_diferencias')
                M.evaluate("p2Close()"); M.wait_for_timeout(300)

            # 10 · OCR
            M.evaluate("vwClose()"); M.wait_for_timeout(400); M.evaluate("pdfOpen('p3', 1)"); M.wait_for_timeout(1800)
            M.evaluate("vwMore({stopPropagation(){}, currentTarget: $('#vwMoreB')})"); M.wait_for_timeout(200)
            eq(f'{T} 10 · ⋯ ofrece «Reconocer el texto (OCR)» y el menú cabe', [M.evaluate("$('#vwMenu').textContent.includes('Reconocer el texto (OCR)')"), fits('#vwMenu')], [True, True])
            M.evaluate("vxOcrMenu()"); M.wait_for_timeout(200)
            eq(f'{T} 10 · el menú del OCR cabe', [fits('#vwMenu'), M.evaluate(BTNS, '#vwMenu')], [True, True])
            shot('10_ocr_menu')
            M.evaluate("$('#vwMenu').hidden = true")
            if not os.environ.get('V408_NO_OCR'):
                M.evaluate(f"(() => {{ const F = {FITS}, o = toast; window.__tt = []; toast = (m, a = [], ...r) => {{ o(m, a, ...r); __tt.push([m, a.map(x => x.t).join(), F('#toast')]); }}; vxOcrRun(0); }})()")
                for _ in range(120):
                    M.wait_for_timeout(1000)
                    if M.evaluate("!VX.ocrBusy"): break
                eq(f'{T} 10 · el aviso de progreso cabe, con ✕ Parar', M.evaluate("(() => { const t = __tt.find(x => /Reconociendo|Preparando/.test(x[0])); return t ? [t[1], t[2]] : null; })()"), ['✕ Parar', True])
                eq(f'{T} 10 · reconoce el texto en el móvil', M.evaluate("/bolsillo/.test((VX.ocr.get(0) || []).map(w => w.t).join(' '))"), True)
                shot('10_ocr_hecho')
            eq(f'{T} sin desplazamiento a lo ancho al final', M.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), True)
            eq(f'{T} sin errores en la página', errs, [])
            c.close()
    finally:
        srv.terminate()
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
