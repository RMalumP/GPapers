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
    # ---- Fase 2
    w0 = pg.evaluate("$('#side').getBoundingClientRect().width")
    eq('«Gestionar» está en la cabecera del grupo, a la derecha del título', pg.evaluate("[...document.querySelectorAll('.sgh')].map(g => { const a = g.querySelector('.sh .lbl').getBoundingClientRect(), b = g.querySelector('.mgb').getBoundingClientRect(), s = $('#side').getBoundingClientRect(); return b.left >= a.right - 1 && b.right <= s.right && Math.abs((a.top + a.bottom) - (b.top + b.bottom)) < 12; })"), [True, True])
    eq('el ancho de la barra no cambia', pg.evaluate("$('#side').getBoundingClientRect().width"), w0)
    pg.locator('#sg-sec .mgb').click()
    eq('el botón abre la gestión de secciones', pg.evaluate("MG"), 'sections'); pg.evaluate("$('#mg').close()")
    pg.locator('#sg-tags .mgb').click()
    eq('el botón abre la gestión de etiquetas', pg.evaluate("MG"), 'tags'); pg.evaluate("$('#mg').close()")
    eq('la barra tiene fondo y borde propios', pg.evaluate("(s => [getComputedStyle(s).backgroundColor !== getComputedStyle(document.body).backgroundColor, parseFloat(getComputedStyle(s).borderTopWidth) > 0])($('#side'))"), [True, True])
    pg.evaluate("sbToggle()")
    eq('plegada, «Gestionar» se oculta', pg.evaluate("getComputedStyle(document.querySelector('.mgb')).display"), 'none'); pg.evaluate("sbToggle()")
    # ---- Fase 3
    pg.evaluate("openCfg()")
    eq('Configuración: cerrar está a la derecha del título, en la cabecera', pg.evaluate("(h => { const t = h.querySelector('h2').getBoundingClientRect(), b = h.querySelector('button').getBoundingClientRect(); return b.left > t.right && h.parentElement.querySelectorAll('button').length > 0; })($('#cfg .dh'))"), True)
    eq('apartados plegados por defecto', pg.evaluate("[...document.querySelectorAll('#cfg details.cs')].map(d => [d.querySelector('summary').textContent, d.open])"), [['Paleta de colores', False], ['Plantillas de nota', False], ['Atajos de teclado', False]])
    pg.locator('#cfg summary', has_text='Atajos').click(); pg.locator('#cfg summary', has_text='Plantillas').click(); pg.locator('#cfg summary', has_text='Paleta').click()
    eq('se despliegan al pulsar el título', pg.evaluate("[...document.querySelectorAll('#cfg details.cs')].map(d => d.open)"), [True, True, True])
    pg.wait_for_timeout(100); pg.evaluate("setCfg('appName', 'Papers'); drawCfg()")
    eq('al redibujar se conservan abiertos', pg.evaluate("[...document.querySelectorAll('#cfg details.cs')].map(d => d.open)"), [True, True, True])
    pg.evaluate("$('#cfg').scrollTop = 400"); pg.wait_for_timeout(500)
    eq('al bajar, la cabecera se estrecha y queda fija arriba sin hueco', pg.evaluate("(d => { const h = d.querySelector('.dh'); return [h.classList.contains('sm'), Math.abs(h.getBoundingClientRect().top - (d.getBoundingClientRect().top + d.clientTop)) < 2]; })($('#cfg'))"), [True, True])
    pg.evaluate("$('#cfg').scrollTop = 0"); pg.wait_for_timeout(500)
    eq('arriba vuelve a su tamaño', pg.evaluate("$('#cfg .dh').classList.contains('sm')"), False)
    pg.evaluate("$('#cfg').close(); openPaper('p1'); tab = 'all'; drawD()")
    pg.evaluate("$('#dlg').scrollTop = 300"); pg.wait_for_timeout(500)
    eq('editar paper: misma cabecera fija sin hueco por encima', pg.evaluate("(d => { const h = d.querySelector('.dh'); return [h.classList.contains('sm'), Math.abs(h.getBoundingClientRect().top - (d.getBoundingClientRect().top + d.clientTop)) < 2]; })($('#dlg'))"), [True, True])
    pg.screenshot(path=str(pathlib.Path(os.environ.get('SHOTS', '/tmp')) / 'f3.png'))
    pg.evaluate("$('#dlg').close()")
    # ---- Fase 4
    pg.evaluate("openPaper('p1')")
    eq('pestañas: secciones, cita y etiquetas unidas', pg.evaluate("[...document.querySelectorAll('#dlg .tabs button')].map(b => b.textContent)"), ['Ver todo', 'Datos', 'Notas', 'Secciones, cita y etiquetas', 'Relacionados', 'Historial'])
    eq('Ver todo: orden de bloques con las notas por sección bajo la general', pg.evaluate("[...document.querySelectorAll('#dlg details.cs > summary')].map(s => s.textContent)"), ['Datos', 'Notas generales', 'Notas por sección', 'Secciones', 'Cita', 'Etiquetas', 'Relacionados'])
    eq('Ver todo: una sola variante de cita', pg.locator('#dlg textarea[id^=c_]').count(), 1)
    pg.select_option('#dlg select:has(option[value=mla])', 'mla')
    eq('se puede cambiar la variante', pg.evaluate("[document.querySelectorAll('#dlg textarea[id^=c_]').length, document.querySelector('#dlg textarea[id^=c_]').id]"), [1, 'c_mla'])
    pg.locator('#dlg summary', has_text='Secciones').first.click(); pg.wait_for_timeout(100)
    eq('los bloques se pliegan', pg.evaluate("[...document.querySelectorAll('#dlg details.cs')].map(d => d.open)"), [True, True, True, False, True, True, True])
    pg.evaluate("drawD()")
    eq('el plegado se conserva al redibujar', pg.evaluate("document.querySelectorAll('#dlg details.cs:not([open])').length"), 1)
    pg.evaluate("tab = 'cls'; drawD()")
    eq('pestaña Cita unida: todas las variantes', (pg.locator('#dlg textarea[id^=c_]').count(), pg.locator('#dlg details').count()), (10, 0))
    eq('la pestaña unida trae secciones, cita y etiquetas', pg.evaluate("[...document.querySelectorAll('#dlg h2.grp')].map(h => h.textContent)"), ['Secciones', 'Cita', 'Etiquetas'])
    pg.evaluate("tab = 'notes'; drawD()")
    eq('pestaña Notas: general y luego las de sección', pg.evaluate("[...document.querySelectorAll('#dlg h2.grp')].map(h => h.textContent)"), ['Notas generales', 'Notas por sección'])
    pg.evaluate("$('#dlg').close()")
    eq('sin errores de consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
