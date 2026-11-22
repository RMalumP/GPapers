# v40.9: el título de una tarjeta abre la ficha; ficha de un paper pensada para el móvil; enlaces a otras webs dentro de la app de Android (TWA).
# Uso: python3 pruebas/prueba_v409.py .
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.sections.length = 0; db.tags.length = 0; db.sections.push({id:'s1', name:'Intro', color:'#3366cc', tagIds:[]});
  db.papers.push(NEWF({id:'p1', title:'Deep learning for the analysis of political discourse in parliaments', authors:['LeCun, Yann'], year:2015, venue:'Nature', type:'articulo', doi:'10.1038/nature14539', url:'https://doi.org/10.1038/nature14539', accessed:'', general:'', tagIds:[], notes:[], cites:{}, related:[], refTo:[], history:[], reading:'leyendo', rating:3, sectionIds:['s1'], pdf:{name:'lecun2015_deep_learning_nature.pdf', page:3}}));
  db.settings.view = 'cards'; render(); }"""
DOI = '<!doctype html><title>doi</title><p>Editorial</p>'
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    def page(ctx, twa=False):
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
        if twa: pg.add_init_script("try { if (location.protocol === 'file:') sessionStorage.setItem('gp-twa', '1'); } catch (e) {}")
        pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300); pg.evaluate(SEED); pg.wait_for_timeout(100); return pg, errs
    # ---- Ordenador: clic en el título de la tarjeta → ficha
    ctx = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); pg, errs = page(ctx)
    pg.click('#list .card h3 a.ctl'); pg.wait_for_timeout(200)
    eq('ordenador: el título de la tarjeta abre la ficha', pg.evaluate("[$('#dlg').open, D.id]"), [True, 'p1'])
    eq('ordenador: los botones y pestañas de la ficha no cambian', pg.evaluate("[[...document.querySelectorAll('#dlg .dbtn button')].map(b => b.innerText), [...document.querySelectorAll('#dlg .tabs button')].map(b => b.innerText)[0]]"), [['Guardar paper', 'Cancelar'], 'Ver todo'])
    eq('ordenador: sin modo TWA', pg.evaluate("[TWA, document.documentElement.classList.contains('twa')]"), [False, False])
    pg.evaluate("$('#dlg').close()")
    ctx.route('https://doi.org/**', lambda r: r.fulfill(status=200, content_type='text/html', body=DOI))
    with ctx.expect_page() as np: pg.click('#list .card a[href^="https://doi.org"]')
    np.value.wait_for_load_state()
    eq('ordenador (navegador o PWA): el DOI se abre en una pestaña nueva', [np.value.url.startswith('https://doi.org/'), pg.url.startswith('file:')], [True, True])
    eq('ordenador: sin errores', errs, []); ctx.close()
    # ---- Móvil (Pixel 7 y 320 px)
    for dev in ('Pixel 7', 'iPhone SE'):
        ctx = b.new_context(**pw.devices[dev], service_workers='block'); pg, errs = page(ctx)
        pg.tap('#list .card h3 a.ctl'); pg.wait_for_timeout(300)
        eq(f'{dev}: tocar el título de la tarjeta abre la ficha', pg.evaluate("[$('#dlg').open, D.id]"), [True, 'p1'])
        r = pg.evaluate("""() => { const h = $('#dlg .dh'), q = s => $(s).getBoundingClientRect(), t = [...document.querySelectorAll('#dlg .tabs button')];
          return {una: new Set(['.dcan', '.dh h2', '.dsave'].map(s => Math.round(q('#dlg ' + s).top + q('#dlg ' + s).height / 2))).size === 1 || Math.abs(q('#dlg .dcan').top - q('#dlg .dsave').top) < 4,
            orden: q('#dlg .dcan').left < q('#dlg .dh h2').left && q('#dlg .dh h2').right <= q('#dlg .dsave').left + 1, alto: h.getBoundingClientRect().height <= 70,
            pestanas: t.every(b => b.getBoundingClientRect().right <= innerWidth + 1) && $('#dlg .tabs').scrollWidth <= $('#dlg .tabs').clientWidth + 1,
            cortas: getComputedStyle(t[0], '::after').content, ancho: $('#dlg').scrollWidth <= innerWidth}; }""")
        eq(f'{dev}: cabecera de la ficha en una fila (✕, título, Guardar), baja; pestañas sin desplazar; sin scroll horizontal', r, {'una': True, 'orden': True, 'alto': True, 'pestanas': True, 'cortas': '"Todo"', 'ancho': True})
        pg.evaluate("tabSet('data')"); pg.wait_for_timeout(100)
        r = pg.evaluate("""() => { const w = $('#dlg .pdfrow[data-pdf="1"]'), q = e => e.getBoundingClientRect(), pag = w.querySelector('label'), sel = w.querySelector('select');
          return [q(w).right <= innerWidth, q(pag.querySelector('input')).top < q(pag).top + 20, q(sel).width >= q(w).width * .5, [...w.children].every(c => q(c).right <= q(w).right + 1)]; }""")
        eq(f'{dev}: fila del PDF: «Página» al lado de su casilla, Drive a lo ancho, nada se sale', r, [True, True, True, True])
        pg.tap('#dlg .dcan'); pg.wait_for_timeout(200)
        eq(f'{dev}: ✕ cierra la ficha', pg.evaluate("$('#dlg').open"), False)
        eq(f'{dev}: sin errores', errs, []); ctx.close()
    # ---- App de Android (TWA): el enlace se abre en la misma ventana, sin pestañas nuevas
    ctx = b.new_context(**pw.devices['Pixel 7'], service_workers='block'); pg, errs = page(ctx, twa=True)
    pg.route('https://doi.org/**', lambda r: r.fulfill(status=200, content_type='text/html', body=DOI))
    eq('TWA: se reconoce', pg.evaluate("[TWA, document.documentElement.classList.contains('twa')]"), [True, True])
    eq('TWA: el inicio de sesión de Google no se toca', pg.evaluate("[extUrl('https://accounts.google.com/o/oauth2/auth'), extUrl('index.html'), extUrl('blob:x'), extUrl('mailto:a@b.c')]"), ['', '', '', ''])
    pages = []; ctx.on('page', lambda p: pages.append(p))
    pg.tap('#list .card a[href^="https://doi.org"]'); pg.wait_for_url('https://doi.org/**', timeout=5000)
    eq('TWA: el DOI se abre en la misma ventana, sin pestaña nueva (antes: pantalla negra)', [pg.url, len(pages)], ['https://doi.org/10.1038/nature14539', 0])
    pg.go_back(); pg.wait_for_timeout(500)
    eq('TWA: «Atrás» vuelve a GPapers', pg.url.startswith('file:'), True)
    pg.evaluate(SEED); pg.evaluate("window.open('https://doi.org/10.1/x', '_blank', 'noopener')"); pg.wait_for_url('https://doi.org/**', timeout=5000)
    eq('TWA: window.open a otra web también va en la misma ventana', [pg.url, len(pages)], ['https://doi.org/10.1/x', 0])
    eq('TWA: sin errores', errs, []); ctx.close()
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
