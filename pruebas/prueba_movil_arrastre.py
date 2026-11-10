# Pruebas del móvil (Chromium, Pixel 7 en vertical): arrastrar un paper a otra sección con el dedo (mantener pulsado y mover),
# que desplazar la lista no arrastre, y el menú del botón ☑ (mantener pulsado / clic derecho): los que se ven, todos o ninguno.
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
  const P = (id, t, secs) => NEWF({id, title: t, authors: ['Pérez, Juan'], year: 2020, venue: '', type: 'articulo', doi: '', url: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: secs});
  db.papers.push(P('p1', 'Uno', ['sa']), P('p2', 'Dos', ['sa']), P('p3', 'Tres', ['sb']));
  F.group = true; F.sorts = [{k: 'title', d: 1}]; render(); }"""
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); c = b.new_context(**pw.devices['Pixel 7'], service_workers='block'); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.add_init_script("window.ASK_AUTO = 'accept'")
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(500); pg.evaluate(SEED); pg.wait_for_timeout(100)
    cdp = c.new_cdp_session(pg)
    def touch(kind, x=0, y=0): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})
    def center(sel): r = pg.evaluate(f"(() => {{ const r = document.querySelector({json.dumps(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }})()"); return r
    secs = "db.papers.map(p => p.id + ':' + p.sectionIds.join(','))"
    eq('móvil y agrupado por sección', pg.evaluate("[document.documentElement.classList.contains('mv'), document.querySelectorAll('#list .gbox').length]"), [True, 3])
    def drag(src, dst, hold=600, steps=8):
        x, y = center(src); touch('touchStart', x, y); pg.wait_for_timeout(hold)
        tx, ty = center(dst)
        for i in range(1, steps + 1): touch('touchMove', x + (tx - x) * i / steps, y + (ty - y) * i / steps); pg.wait_for_timeout(30)
        st = pg.evaluate("[!!document.querySelector('.mvghost'), document.querySelector('#list .gbox.over')?.dataset.sec ?? null]")
        touch('touchEnd'); pg.wait_for_timeout(200); return st
    st = drag('#list .card[data-id=p1] h3', '#list .gbox[data-sec=sb] h2')
    eq('al mantener pulsado y mover: sale la etiqueta del paper y se marca la sección de debajo', st, [True, 'sb'])
    eq('al soltar, el paper pasa a esa sección', pg.evaluate(secs), ['p1:sb', 'p2:sa', 'p3:sb'])
    eq('no queda nada marcado', pg.evaluate("[!!document.querySelector('.mvghost'), document.querySelectorAll('.over,.drag').length, document.documentElement.classList.contains('mvdrag')]"), [False, 0, False])
    st = drag('#list .card[data-id=p2] h3', '#list .gbox[data-sec=sb] h2', hold=80)
    eq('mover el dedo enseguida es desplazar: no arrastra', [st[0], pg.evaluate(secs)], [False, ['p1:sb', 'p2:sa', 'p3:sb']])
    pg.evaluate("document.querySelector('#list .gbox[data-sec=\"\"]').scrollIntoView({block: 'end'})"); pg.wait_for_timeout(100)
    drag('#list .card[data-id=p3] h3', '#list .gbox[data-sec=""] h2')
    eq('también a «Sin sección»', pg.evaluate(secs), ['p1:sb', 'p2:sa', 'p3:'])
    x, y = center('#list .card[data-id=p2] h3'); touch('touchStart', x, y); pg.wait_for_timeout(600); touch('touchEnd'); pg.wait_for_timeout(200)
    eq('mantener pulsado y soltar sin moverse no cambia nada ni abre la ficha', pg.evaluate(secs + ".concat($('#dlg').open)"), ['p1:sb', 'p2:sa', 'p3:', False])
    pg.evaluate("setView('table')"); pg.wait_for_timeout(100)
    drag('#list tr.rw[data-id=p2] .c-title', '#list .gbox[data-sec=sb] h2')
    eq('en la vista de tabla también', pg.evaluate(secs), ['p1:sb', 'p2:sb', 'p3:'])
    pg.evaluate("setView('cards'); F.group = false; render()"); pg.wait_for_timeout(100)
    x, y = center('#list .card[data-id=p2] h3'); touch('touchStart', x, y); pg.wait_for_timeout(600)
    eq('sin agrupar también se arrastra (para colocar a mano)', pg.evaluate("!!document.querySelector('.mvghost')"), True); touch('touchEnd'); pg.wait_for_timeout(200)
    # ---- menú de ☑
    x, y = center('#selAll'); touch('touchStart', x, y); pg.wait_for_timeout(750); touch('touchEnd'); pg.wait_for_timeout(200)
    eq('mantener pulsado ☑ abre su menú', pg.evaluate("[!$('#ctx').hidden, [...document.querySelectorAll('#ctx button')].map(b => b.textContent)]"), [True, ['☑ Los que se ven (3)', '☑ Todo el proyecto (3)']])
    pg.evaluate("ctxClose(); F.q = 'Uno'; render()"); pg.wait_for_timeout(100)
    pg.evaluate("selMenu(new MouseEvent('contextmenu', {clientX: 300, clientY: 200}))"); pg.click('#ctx button:has-text("Todo el proyecto")'); pg.wait_for_timeout(100)
    eq('«todos los del proyecto» elige también los que no se ven', pg.evaluate("SEL.size"), 3)
    pg.evaluate("selMenu(new MouseEvent('contextmenu', {clientX: 300, clientY: 200}))"); pg.click('#ctx button:has-text("Quitar selección")'); pg.wait_for_timeout(100)
    eq('«Quitar la selección»', pg.evaluate("SEL.size"), 0)
    pg.tap('#selAll'); pg.wait_for_timeout(100)
    eq('un toque normal en ☑ sigue eligiendo los que se ven', pg.evaluate("[...SEL]"), ['p1'])
    pg.evaluate("selMenu(new MouseEvent('contextmenu', {clientX: 300, clientY: 200}))")
    eq('con algo elegido, el panel de ☑ trae todo lo de la selección', [pg.evaluate("[...document.querySelectorAll('#ctx .sml')].map(x => x.firstChild.textContent.trim())"), pg.evaluate("[...document.querySelectorAll('#ctx .sma button')].map(b => b.textContent.split(' (')[0].replace('…', ''))")],
       [['📖 Lectura', '⭐ Valoración', '🏷️ Etiqueta', '📁 Sección'], ['📤 Exportar citas', '↪ A otro proyecto', '🗑 Papelera', '☐ Quitar selección']])
    pg.tap('#ctx .seg button >> nth=2'); pg.wait_for_timeout(150)
    eq('un toque en Lectura la cambia y el panel sigue abierto', [pg.evaluate("db.papers.find(p => p.id === 'p1').reading"), pg.evaluate("!$('#ctx').hidden")], [list(pg.evaluate("Object.keys(READ)"))[2], True])
    pg.tap('#ctx button:has-text("Papelera")'); pg.wait_for_timeout(300)
    eq('«Enviar a la papelera» desde el menú', pg.evaluate("[db.papers.some(p => p.id === 'p1'), db.trash.length]"), [False, 1])
    eq('sin errores', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas de arrastre en el móvil OK'); sys.exit(1 if fail else 0)
