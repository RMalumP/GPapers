# Pruebas de interfaz (Chromium): papelera, historial, estrellas, barra lateral, diálogos, editor de notas.
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
  db.sections.push({id:'s1', name:'Intro', color:'#3366cc', tagIds:[]}, {id:'s2', name:'Método', color:'#cc6633', tagIds:[]});
  db.papers.push(NEWF({id:'p1', title:'Paper uno', authors:['Pérez, Juan'], year:2021, venue:'Rev', type:'articulo', doi:'', url:'', accessed:'', general:'', tagIds:[], notes:[{id:'n1', sectionId:'s1', content:'Hola *mundo*'}], cites:{}, related:[], refTo:[], history:[], reading:'leyendo', rating:3, sectionIds:['s1']}));
  UNDO.length = 0; REDO.length = 0; lastSnap = JSON.stringify(db); render(); }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write'], viewport={'width': 1200, 'height': 800}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
    pg.evaluate(SEED)
    # ---- Fase 1
    eq('papelera: 5 días', pg.evaluate("TRASH_DAYS"), 5)
    eq('papelera caduca a los 5 días', pg.evaluate("validate({papers:[], tags:[], sections:[], trash:[{at:new Date(Date.now()-6*864e5).toISOString(), paper:{id:'a', title:'x', authors:[]}}, {at:new Date(Date.now()-4*864e5).toISOString(), paper:{id:'b', title:'y', authors:[]}}]}).trash.map(t => t.paper.id)"), ['b'])
    pg.evaluate("logChange(db.papers[0], 'Cambio de hoy')")
    eq('el historial no se guarda en el JSON', pg.evaluate("dbJSON().includes('history')"), False)
    eq('el JSON conserva la fecha de creación', pg.evaluate("(db.papers[0].created = '2026-01-02T00:00:00.000Z', JSON.parse(dbJSON()).papers[0].created)"), '2026-01-02T00:00:00.000Z')
    eq('un JSON con historial lo descarta al cargar', pg.evaluate("validate({papers:[{id:'z', title:'t', authors:[], history:[{t:'2020-01-01', s:'viejo'}]}], tags:[], sections:[]}).papers[0].history"), [])
    pg.evaluate("db.papers[0].history.unshift({t:'2020-01-01T10:00:00.000Z', s:'Antiguo'}); openPaper('p1'); tab='hist'; drawD()")
    h = pg.inner_text('#dlg .hist')
    eq('el historial solo muestra lo de hoy', ('Cambio de hoy' in h, 'Antiguo' in h), (True, False))
    pg.evaluate("$('#dlg').close()")
    eq('estado de lectura y estrellas junto a la X', pg.evaluate("[...document.querySelectorAll('.card .ct > *')].map(e => e.className || e.tagName).slice(-2)"), ['rd', 'x'])
    eq('no quedan duplicados en la línea de autores', pg.locator('.card .au .rd').count(), 0)
    pg.locator('.card .stv').click(button='right')
    eq('clic derecho en las estrellas abre el menú', pg.locator('#ctx button').count(), 6)
    pg.locator('#ctx button', has_text='★★★★★').first.click()
    eq('el menú cambia la valoración', pg.evaluate("db.papers[0].rating"), 5)
    pg.locator('.card .stv').click(button='right'); pg.locator('#ctx button', has_text='Sin valorar').click()
    eq('se puede quitar la valoración y las estrellas siguen visibles', (pg.evaluate("db.papers[0].rating"), pg.locator('.card .stv.none').count()), (0, 1))
    eq('sin errores de consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
