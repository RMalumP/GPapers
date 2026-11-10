# Pruebas de pantallas táctiles grandes (tablet en horizontal, sin el modo móvil): Sección ▾ y Etiquetas ▾ abren el mismo menú que en el móvil,
# las etiquetas van en su propia fila debajo de la barra, y en el ordenador (ratón) todo sigue como siempre.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0;
  db.sections.push({id: 'sa', name: 'Tema A', color: '#2457c5', tagIds: []}, {id: 'sb', name: 'Tema B', color: '#c52457', tagIds: []});
  for (let i = 0; i < 14; i++) db.tags.push({id: 't' + i, name: 'Etiqueta número ' + i, color: '#3a7'});
  const P = (id, t, secs, tags) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: tags, notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'Uno', ['sa'], ['t0']), P('p2', 'Dos', ['sa'], ['t1']), P('p3', 'Tres', ['sb'], []));
  F.group = false; F.tbTag = true; F.tbSec = false; render(); }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    c = b.new_context(**pw.devices['Galaxy Tab S4 landscape'], service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    eq('tablet en horizontal: táctil pero sin el modo móvil', pg.evaluate("[document.documentElement.classList.contains('tb'), document.documentElement.classList.contains('mv')]"), [True, False])
    rows = "(() => { const r = $('main>.row').getBoundingClientRect(), b = $('#tbTag').getBoundingClientRect(), t = $('#tagF2').getBoundingClientRect(); return [t.top >= b.bottom - 1, Math.round(t.width) >= Math.round(r.width) - 2, $('#tagF2').scrollWidth <= $('#tagF2').clientWidth + 1]; })()"
    eq('las etiquetas, en su propia fila debajo, a todo el ancho y sin desplazamiento lateral', pg.evaluate(rows), [True, True, True])
    eq('la página no se sale por la derecha', pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), True)
    pg.tap('#tbTag'); pg.wait_for_timeout(200)
    eq('tocar Etiquetas abre el menú (no oculta la fila)', pg.evaluate("[!$('#ctx').hidden, $('#ctx').dataset.mvf, F.tbTag]"), [True, 'tag', True])
    pg.tap('#ctx button:has-text("Etiqueta número 3")'); pg.wait_for_timeout(200)
    eq('elegir una etiqueta filtra y el menú sigue abierto', pg.evaluate("[[...F.tags], !$('#ctx').hidden]"), [['t3'], True])
    pg.tap('#ctx button:has-text("Mostrarlas debajo")'); pg.wait_for_timeout(200)
    eq('«Mostrarlas debajo» oculta la fila', pg.evaluate("[F.tbTag, $('#tagF2').hidden]"), [False, True])
    pg.tap('#tbTag'); pg.wait_for_timeout(200)
    eq('otro toque en el botón cierra el menú', pg.evaluate("$('#ctx').hidden"), True)
    pg.tap('#tbSec'); pg.wait_for_timeout(200)
    eq('Sección abre su menú', pg.evaluate("[!$('#ctx').hidden, $('#ctx').dataset.mvf, [...$('#ctx').querySelectorAll('button')].map(b => b.textContent.replace(/[\\d✓\\u2003]/g, '').trim())]"),
       [True, 'sec', ['Mostrarlas debajo', 'Agrupar por sección', 'Todas', 'Tema A', 'Tema B', 'Sin sección', '✎ Gestionar secciones']])
    pg.tap('#ctx button:has-text("Mostrarlas debajo")'); pg.wait_for_timeout(200)
    pg.tap('#ctx button:has-text("Tema B")'); pg.wait_for_timeout(200)
    eq('elegir una sección filtra y deja el menú abierto', pg.evaluate("[[...F.secs], $('#ctx').hidden, F.tbSec, !$('#secF2').hidden]"), [['sb'], False, True, True])
    pg.evaluate("ctxClose()"); pg.wait_for_timeout(200)
    eq('la fila de secciones también va debajo', pg.evaluate("$('#secF2').getBoundingClientRect().top >= $('#tbSec').getBoundingClientRect().bottom - 1"), True)
    eq('sin errores (tablet)', errs, [])
    c.close()
    c = b.new_context(viewport={'width': 1300, 'height': 800}, service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    eq('ordenador: sin la clase táctil', pg.evaluate("document.documentElement.classList.contains('tb')"), False)
    pg.click('#tbTag'); pg.wait_for_timeout(150)
    eq('ordenador: el clic sigue mostrando u ocultando la fila', pg.evaluate("[F.tbTag, $('#ctx').hidden]"), [False, True])
    eq('sin errores (ordenador)', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas de tablet en horizontal OK'); sys.exit(1 if fail else 0)
