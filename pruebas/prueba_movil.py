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
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300); pg.evaluate(SEED)
    eq('móvil: se activa', pg.evaluate(f"[{cls}('mv'), !!$('#mvNav'), !!$('#mvMenuBtn'), !!$('#mvMoreBtn')]"), [True, True, True, True])
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
    pg.click('#mvNav [data-mv=filt]'); pg.wait_for_timeout(300)
    eq('Filtros abre el panel con los filtros desplegados', pg.evaluate(f"[{cls}('mv-dr'), !$('#sg-filt').classList.contains('fold')]"), [True, True])
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
    pg.evaluate("setView('cards')")
    eq('pulsación larga = clic derecho (valoración)', pg.evaluate("""() => new Promise(r => { const s = $('#list .stv'), o = s.getBoundingClientRect(), t = new Touch({identifier: 1, target: s, clientX: o.x + 5, clientY: o.y + 5});
        s.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, touches: [t]})); setTimeout(() => r(!$('#ctx').hidden && $('#ctx').textContent.includes('Valoración')), 700); })"""), True)
    eq('móvil: sin errores', errs, [])
    ctx.close(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
