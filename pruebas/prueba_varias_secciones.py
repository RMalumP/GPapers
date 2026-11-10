# Pruebas de v39.30: filtrar por varias secciones a la vez, arrastrar todos los seleccionados a otra sección
# y, en el ordenador, que las secciones y etiquetas de la fila de arriba que no caben pasen debajo en vez de quedar tapadas.
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SEED = """() => { db.papers.length = 0; db.tags.length = 0; db.sections.length = 0; db.manual = {}; SEL.clear();
  db.sections.push({id: 'sa', name: 'Tema A', color: '#2457c5', tagIds: []}, {id: 'sb', name: 'Tema B', color: '#c52457', tagIds: []}, {id: 'sc', name: 'Tema C', color: '#24a557', tagIds: []});
  const P = (id, t, secs) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: secs.length ? [{id: 'n' + id, sectionId: secs[0], content: 'nota ' + id}] : [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'A uno', ['sa']), P('p2', 'B dos', ['sa']), P('p3', 'C tres', ['sb']), P('p4', 'D cuatro', ['sc']), P('p5', 'E cinco', []));
  F.group = false; F.secs.clear(); F.tbSec = true; F.sorts = [{k: 'title', d: 1}]; FOLD.clear(); setView('cards'); render(); }"""
ids = "[...document.querySelectorAll('#list .card[data-id]')].map(c => c.dataset.id)"
order = "[...document.querySelectorAll('#list .gbox')].map(g => g.dataset.sec + ':' + [...g.querySelectorAll('[data-id]')].map(c => c.dataset.id).join(','))"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw)
    c = b.new_context(viewport={'width': 1300, 'height': 900}, service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    # ---------- varias secciones en el filtro
    pg.locator('#secF2 .chip', has_text='Tema A').click(); pg.locator('#secF2 .chip', has_text='Tema C').click(); pg.wait_for_timeout(100)
    eq('se marcan dos secciones y se ven los papers de cualquiera', [pg.evaluate("[...F.secs]"), pg.evaluate(ids)], [['sa', 'sc'], ['p1', 'p2', 'p4']])
    eq('las dos salen marcadas y en el resumen de filtros', [pg.evaluate("[...document.querySelectorAll('#secF2 .chip.on')].map(x => x.textContent)"), pg.evaluate("[...document.querySelectorAll('#actF .af')].map(b => b.textContent)")],
       [['Tema A', 'Tema C'], ['📁 Tema A ✕', '📁 Tema C ✕']])
    pg.locator('#secF .chip', has_text='Tema A').click(); pg.wait_for_timeout(100)
    eq('pulsar otra vez una marcada la quita (también en la barra lateral)', [pg.evaluate("[...F.secs]"), pg.evaluate(ids)], [['sc'], ['p4']])
    pg.locator('#secF2 .chip', has_text='Tema B').click(); pg.locator('#actF .af', has_text='Tema C').click(); pg.wait_for_timeout(100)
    eq('cada sección del resumen se quita sola', [pg.evaluate("[...F.secs]"), pg.evaluate(ids)], [['sb'], ['p3']])
    pg.locator('#secF2 .chip', has_text='Tema A').click(); pg.evaluate("F.group = true; render()"); pg.wait_for_timeout(100)
    eq('agrupado: solo los grupos de las secciones elegidas', pg.evaluate(order), ['sa:p1,p2', 'sb:p3'])
    pg.evaluate("openPaper()"); pg.wait_for_timeout(100)
    eq('un paper nuevo nace en las secciones elegidas', pg.evaluate("D.sectionIds"), ['sa', 'sb']); pg.evaluate("$('#dlg').close()")
    pg.evaluate("favSave('dos'); fClrAll()"); pg.wait_for_timeout(50); pg.evaluate("favApply(FAV.findIndex(f => f.name === 'dos'))"); pg.wait_for_timeout(50)
    eq('las vistas guardadas recuerdan varias secciones', pg.evaluate("[...F.secs].sort()"), ['sa', 'sb'])
    eq('una vista guardada antigua (una sola sección) sigue valiendo', pg.evaluate("F.secs = secsLoad({sec: 'sc'}); [...F.secs]"), ['sc'])
    pg.locator('#secF2 .chip', has_text='Todas').click(); pg.wait_for_timeout(100)
    eq('«Todas» quita el filtro', [pg.evaluate("F.secs.size"), pg.evaluate(order)], [0, ['sa:p1,p2', 'sb:p3', 'sc:p4', ':p5']])
    # ---------- arrastrar varios seleccionados a otra sección
    pg.evaluate("toggleSel('p1'); toggleSel('p2')")
    pg.locator('#list .card[data-id=p1]').drag_to(pg.locator('#list .gbox[data-sec=sc] h2')); pg.wait_for_timeout(200)
    eq('arrastrar un seleccionado a otra sección mueve todos los seleccionados', pg.evaluate(order), ['sa:', 'sb:p3', 'sc:p1,p2,p4', ':p5'])
    eq('con sus notas', pg.evaluate("['p1', 'p2'].map(i => db.papers.find(p => p.id === i).notes[0].sectionId)"), ['sc', 'sc'])
    eq('aviso de cuántos se movieron', '2 papers movidos a «Tema C»' in pg.evaluate("document.body.innerText"), True)
    pg.evaluate("undo()"); pg.wait_for_timeout(150)
    eq('un solo Ctrl+Z lo deshace todo', pg.evaluate(order), ['sa:p1,p2', 'sb:p3', 'sc:p4', ':p5'])
    pg.locator('#list .card[data-id=p3]').drag_to(pg.locator('#list .gbox[data-sec=sc] h2')); pg.wait_for_timeout(200)
    eq('un paper no seleccionado se mueve solo', pg.evaluate(order), ['sa:p1,p2', 'sb:', 'sc:p3,p4', ':p5'])
    box = pg.locator('#list .card[data-id=p4]').bounding_box()
    pg.locator('#list .card[data-id=p2]').drag_to(pg.locator('#list .card[data-id=p4]'), target_position={'x': box['width'] / 2, 'y': box['height'] * .15}); pg.wait_for_timeout(200)
    eq('soltarlos delante de un paper de otra sección: van todos juntos, en su orden', pg.evaluate(order), ['sa:', 'sb:', 'sc:p3,p1,p2,p4', ':p5'])
    pg.evaluate("SEL.clear(); toggleSel('p1'); toggleSel('p5')")
    pg.locator('#list .card[data-id=p1]').drag_to(pg.locator('#list .gbox[data-sec=sa] h2')); pg.wait_for_timeout(200)
    eq('cada seleccionado sale de su propia sección (o de «Sin sección»)', pg.evaluate("['p1', 'p5'].map(i => db.papers.find(p => p.id === i).sectionIds)"), [['sa'], ['sa']])
    # ---------- fila de arriba en el ordenador: lo que no cabe, debajo
    pg.evaluate("SEL.clear(); F.group = false; for (let i = 0; i < 14; i++) db.sections.push({id: 'w' + i, name: 'Sección bastante larga ' + i, color: '#8888cc', tagIds: []}); render()"); pg.wait_for_timeout(200)
    eq('si no caben, las secciones pasan debajo en varias líneas y se ven todas', pg.evaluate("""(() => { const r = $('main > .row'), s = $('#secF2'), tops = new Set([...s.children].map(x => Math.round(x.getBoundingClientRect().top)));
      return [r.classList.contains('wrapc'), s.getBoundingClientRect().top >= $('#tbSec').getBoundingClientRect().bottom - 1, tops.size > 1, s.scrollWidth <= s.clientWidth + 1, r.scrollWidth <= r.clientWidth + 1]; })()"""), [True, True, True, True, True])
    pg.screenshot(path=str(folder / 'pruebas' / '_varias_secciones.png')) if os.environ.get('SHOT') else None
    pg.evaluate("db.sections.splice(3); F.tbTag = false; render()"); pg.wait_for_timeout(200)
    eq('si caben, siguen en la misma fila', [pg.evaluate("$('main > .row').classList.contains('wrapc')"), pg.evaluate("Math.round($('main > .row').getBoundingClientRect().height) < 45")], [False, True])
    eq('sin errores', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas de varias secciones OK')
sys.exit(1 if fail else 0)
