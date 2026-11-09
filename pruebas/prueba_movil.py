# Pruebas de la interfaz para móviles (Chromium emulando un móvil táctil) y de que el escritorio no la activa.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.sections.length = 0; db.tags.length = 0;
  db.sections.push({id:'s1', name:'Intro', color:'#3366cc', tagIds:[]});
  db.papers.push(NEWF({id:'p1', title:'Paper uno', authors:['Pérez, Juan'], year:2021, venue:'Rev', type:'articulo', doi:'', url:'', accessed:'', general:'', tagIds:[], notes:[], cites:{}, related:[], refTo:[], history:[], reading:'leyendo', rating:3, sectionIds:['s1']}));
  render(); }"""
cls = "document.documentElement.classList.contains"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    # ---- Escritorio: no cambia nada
    for vp in ({'width': 1200, 'height': 800}, {'width': 600, 'height': 800}):
        ctx = b.new_context(viewport=vp, service_workers='block'); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
        eq(f'escritorio {vp["width"]} px: sin modo móvil', pg.evaluate(f"[{cls}('mv'), !!$('#mvNav'), !!$('#mvMenuBtn'), $('#q').parentElement.className]"), [False, False, False, 'sgh'])
        eq(f'escritorio {vp["width"]} px: sin errores', errs, []); ctx.close()
    # ---- Móvil
    ctx = b.new_context(**pw.devices['Pixel 7'], service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300); pg.evaluate(SEED)
    eq('móvil: se activa', pg.evaluate(f"[{cls}('mv'), !!$('#mvNav'), !!$('#mvMenuBtn'), !!$('#mvMoreBtn')]"), [True, True, True, True])
    pg.evaluate("""() => { db.papers.length = 0; for (let i = 0; i < 100; i++) db.papers.push(NEWF({id: 'q' + i, title: 'Paper ' + i, authors: ['Pérez, Juan'], year: 2000, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: []})); F.group = false; render(); }""")
    eq('móvil: las listas largas se pintan de 40 en 40', pg.evaluate("[document.querySelectorAll('#list .card').length, LIST.step, $('#list > .more')?.textContent.includes('Mostrar 40 más')]"), [40, 40, True])
    pg.evaluate(SEED)
    eq('móvil: la búsqueda está encima de la lista', pg.evaluate("$('#q').parentElement.id"), 'mvSearch')
    eq('móvil: sin scroll horizontal', pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), True)
    eq('móvil: el panel lateral empieza cerrado', pg.evaluate(f"{cls}('mv-dr')"), False)
    pg.click('#mvMenuBtn'); pg.wait_for_timeout(300)
    eq('☰ abre el panel', pg.evaluate(f"[{cls}('mv-dr'), $('#side').getBoundingClientRect().left >= 0]"), [True, True])
    eq('«Ver resultados» lleva la cuenta', pg.inner_text('#mvSeeBtn'), 'Ver resultados · 1 de 1')
    pg.evaluate("sbToggle()"); pg.wait_for_timeout(100)
    eq('plegar la barra no quita la búsqueda de arriba', pg.evaluate("$('#q').parentElement.id"), 'mvSearch'); pg.evaluate("sbToggle()")
    pg.click('#mvSeeBtn'); pg.wait_for_timeout(300)
    eq('«Ver resultados» cierra el panel', pg.evaluate(f"{cls}('mv-dr')"), False)
    pg.click('#mvMoreBtn'); pg.wait_for_timeout(200)
    eq('⋯ abre el menú con Archivo desplegado', pg.evaluate(f"[{cls}('mv-mo'), $('#mvHdrRow').offsetHeight > 0, $('#fmenu').offsetHeight > 0]"), [True, True, True])
    eq('los botones del menú ⋯ quedan por encima de la sombra (se pueden tocar)', pg.evaluate("""[...document.querySelectorAll('#mvHdrRow button')].filter(b => b.offsetHeight)
      .filter(b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !b.contains(e); }).map(b => b.textContent.trim())"""), [])
    pg.tap('#mvHdrRow #fmenu button:has-text("Pegar")'); pg.wait_for_timeout(300)
    eq('tocar una acción del menú ⋯ la ejecuta y cierra el menú', pg.evaluate(f"[!!$('dialog[open]'), {cls}('mv-mo')]"), [True, False])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    pg.click('#mvMoreBtn'); pg.wait_for_timeout(200)
    pg.click('#mvShade', position={'x': 20, 'y': 600}); pg.wait_for_timeout(200)
    eq('tocar fuera cierra el menú ⋯', pg.evaluate(f"{cls}('mv-mo')"), False)
    # submenú de Google Drive desde el menú ⋯ (con la sesión iniciada)
    pg.evaluate("sySet({on: true}); $('#syncBtn').hidden = false")
    for i in range(3):   # siempre, no solo algunas veces
        pg.click('#mvMoreBtn'); pg.wait_for_timeout(200); pg.tap('#syncBtn'); pg.wait_for_timeout(250)
        eq(f'Drive ({i + 1}): se cierra el menú ⋯ y el submenú se ve y se puede tocar', pg.evaluate(f"""[{cls}('mv-mo'), !$('#ctx').hidden, [...$('#ctx').querySelectorAll('button')].every(b => {{ const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }})]"""), [False, True, True])
        pg.tap('#ctx button:has-text("Cómo funciona")') if i == 2 else pg.mouse.click(20, 600)
        pg.wait_for_timeout(200)
        if i < 2: eq(f'Drive ({i + 1}): tocar fuera cierra el submenú', pg.evaluate("$('#ctx').hidden"), True)
    eq('Drive: una opción del submenú se ejecuta', pg.evaluate("[$('#sy').open, $('#ctx').hidden]"), [True, True])
    pg.evaluate("$('#sy').close(); sySet({on: false}); $('#syncBtn').hidden = true")
    NAVJ = "[...document.querySelectorAll('#mvNav button')].filter(b => !b.hidden).map(b => b.dataset.mv)"
    CUT = "[...document.querySelectorAll('#mvNav button')].filter(b => !b.hidden && b.lastElementChild.scrollWidth > b.lastElementChild.clientWidth).map(b => b.dataset.mv)"
    MID = "(r => Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1)($('#mvNav .mvnew').getBoundingClientRect())"
    eq('barra inferior sin bandeja: Papers, Configuración | ＋ | Exportar, Importar, Más', pg.evaluate(NAVJ), ['top', 'cfg', 'new', 'exp', 'imp', 'more'])
    eq('los nombres de la barra inferior caben y ＋ queda en el centro', pg.evaluate(f"[{CUT}, {MID}]"), [[], True])
    pg.evaluate("db.inbox = [{id: 'i1', name: 'sin_cita.pdf', at: Date.now()}, {id: 'i2', name: 'otro.pdf', at: Date.now()}]; inboxDraw()"); pg.wait_for_timeout(100)
    eq('con PDF por citar, 🗃️ sale entre Papers y Configuración (y ＋ sigue en el centro)', pg.evaluate(f"[{NAVJ}, $('#mvIb b').textContent, {CUT}, {MID}, getComputedStyle($('#ibBtn')).display]"), [['top', 'ib', 'cfg', 'new', 'exp', 'imp', 'more'], '2', [], True, 'none'])
    pg.evaluate("ibFoldSet(true)"); pg.click('#mvIb'); pg.wait_for_timeout(200)
    eq('🗃️ despliega la bandeja', pg.evaluate("[ibFold(), !$('#inbox').hidden, $('#mvIb').classList.contains('on')]"), [False, True, True])
    pg.evaluate("setCfg('inboxBtn', true); IB.shown = false; inboxDraw()"); pg.click('#mvIb'); pg.wait_for_timeout(200)
    eq('con la bandeja como botón, 🗃️ la muestra y la oculta', pg.evaluate("$('#inbox').hidden"), False); pg.click('#mvIb'); pg.wait_for_timeout(200)
    eq('…y la vuelve a ocultar', pg.evaluate("$('#inbox').hidden"), True)
    pg.evaluate("setCfg('inboxBtn', false); db.inbox = []; inboxDraw()"); pg.wait_for_timeout(100)
    eq('sin PDF por citar, 🗃️ desaparece', pg.evaluate("$('#mvIb').hidden"), True)
    pg.click('#mvNav [data-mv=imp]'); pg.wait_for_timeout(200)
    eq('📥 abre el menú Importar encima de la barra, entero y tocable', pg.evaluate("""[!$('#ctx').hidden, $('#ctx').textContent.includes('Desde archivo'), $('#ctx').getBoundingClientRect().bottom <= $('#mvNav').getBoundingClientRect().top, $('#ctx').getBoundingClientRect().top >= 0,
      [...$('#ctx').querySelectorAll('button')].every(b => { const r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })]"""), [True, True, True, True, True])
    pg.tap('#ctx button:has-text("Pegar")'); pg.wait_for_timeout(300)
    eq('una opción de Importar abre su ventana', pg.evaluate("[!!$('dialog[open]'), $('#ctx').hidden]"), [True, True]); pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    pg.click('#mvNav [data-mv=cfg]'); pg.wait_for_timeout(300)
    eq('Configuración (barra inferior) abre la configuración', pg.evaluate(f"[$('#cfg').open, {cls}('mv-dr'), {cls}('mv-mo')]"), [True, False, False]); pg.evaluate("$('#cfg').close()")
    pg.click('#mvSearch [data-mv=filt]'); pg.wait_for_timeout(300)
    eq('🎚️ junto al buscador abre el panel con los filtros desplegados', pg.evaluate(f"[{cls}('mv-dr'), !$('#sg-filt').classList.contains('fold')]"), [True, True])
    pg.click('#side button:has-text("Configuración")'); pg.wait_for_timeout(300)
    eq('abrir una ventana desde el panel lo cierra', pg.evaluate(f"[$('#cfg').open, {cls}('mv-dr')]"), [True, False])
    eq('las ventanas ocupan toda la pantalla', pg.evaluate("Math.round($('#cfg').getBoundingClientRect().width) === innerWidth"), True); pg.evaluate("$('#cfg').close()")
    pg.click('#mvNav .mvnew'); pg.wait_for_timeout(300)
    eq('＋ abre un paper nuevo', pg.evaluate("$('#dlg').open"), True); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.click('#mvNav [data-mv=exp]'); pg.wait_for_timeout(300)
    eq('Exportar se abre con un ✕ arriba', pg.evaluate("[$('#ex').open, !!$('#ex > .mvdx')]"), [True, True])
    eq('Exportar no se sale por la derecha', pg.evaluate("$('#ex').scrollWidth <= $('#ex').clientWidth"), True)
    pg.click('#ex > .mvdx'); pg.wait_for_timeout(200)
    eq('el ✕ cierra la ventana', pg.evaluate("$('#ex').open"), False)
    pg.evaluate("setView('table')"); pg.wait_for_timeout(200)
    eq('tabla: cada fila es una ficha (sin cabecera)', pg.evaluate("[getComputedStyle($('.tbl thead')).display, getComputedStyle($('.tbl tr.rw')).display, document.documentElement.scrollWidth <= innerWidth]"), ['none', 'flex', True])
    alto = "Math.round($('.tbl tr.rw').getBoundingClientRect().height)"; h0 = pg.evaluate(alto)
    pg.evaluate("db.tags.push(...Array.from({length: 6}, (_, i) => ({id: 'm' + i, name: 'Etiqueta larga ' + i, color: '#888888'}))); db.papers[0].tagIds = db.tags.map(t => t.id); render()"); pg.wait_for_timeout(100)
    eq('tabla: muchas etiquetas no añaden líneas a la ficha', pg.evaluate(alto), h0)
    # miniatura del paper: se ve en la tabla y en las tarjetas sin cambiar el alto
    IMG = "{kind:'data',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='}"
    pg.evaluate("db.papers[0].tagIds = []; render()"); h0 = pg.evaluate(alto)
    pg.evaluate(f"db.papers[0].image = {IMG}; render()"); pg.wait_for_timeout(100)
    eq('tabla: la miniatura es visible', pg.evaluate("(() => { const r = $('.tbl tr.rw .pimg').getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && r.right <= innerWidth; })()"), True)
    eq('tabla: la miniatura no cambia el alto de la fila', pg.evaluate(alto), h0)
    pg.evaluate("setView('cards')"); pg.wait_for_timeout(100)
    altoC = "Math.round($('.card').getBoundingClientRect().height)"; hc = pg.evaluate(altoC)
    eq('tarjeta: la miniatura es visible', pg.evaluate("(() => { const r = $('.card .pimg').getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && r.right <= innerWidth; })()"), True)
    eq('tarjeta: la miniatura está a la izquierda', pg.evaluate("$('.card .pimg').getBoundingClientRect().left < innerWidth / 4"), True)
    pg.tap('.card .pimg'); pg.wait_for_timeout(200)
    eq('tocar la miniatura la amplía en un pop-up', pg.evaluate("(() => { const i = $('#mvZoom img'); return !!i && i.getBoundingClientRect().width > 200; })()"), True)
    pg.tap('#mvZoom', position={'x': 5, 'y': 5}); pg.wait_for_timeout(200)
    eq('un toque en cualquier sitio cierra el pop-up', pg.evaluate("!$('#mvZoom')"), True)
    pg.evaluate("db.papers[0].image = null; render()")
    eq('tarjeta: la miniatura no cambia el alto', hc, pg.evaluate(altoC))
    pg.evaluate(f"Object.assign(db.papers[0], {{pdf: {{name: 'a.pdf'}}, pdf2: {{name: 'b.pdf'}}, image: {IMG}, alias: 'Alias largo del paper para que la tarjeta tenga subtítulo', url: 'https://example.org/doi/10.1000/xyz'}}); render()")
    eq('tarjeta: la miniatura no tapa botones ni etiquetas (con PDF, alias y enlace)', pg.evaluate("""(() => { const t = $('.card .pimg').getBoundingClientRect();
      return [...document.querySelectorAll('.card button, .card .rst, .card .stv, .card a')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; }).map(e => e.textContent.trim()); })()"""), [])
    pg.evaluate("db.papers[0].tagIds = []; setView('cards')")
    eq('pulsación larga = clic derecho (valoración)', pg.evaluate("""() => new Promise(r => { const s = $('#list .stv'), o = s.getBoundingClientRect(), t = new Touch({identifier: 1, target: s, clientX: o.x + 5, clientY: o.y + 5});
        s.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, touches: [t]})); setTimeout(() => r(!$('#ctx').hidden && $('#ctx').textContent.includes('Valoración')), 700); })"""), True)
    eq('móvil: sin errores', errs, [])
    ctx.close(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
