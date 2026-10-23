# Pruebas F4 en Chromium: cita en el texto y notas (ajuste oculto por defecto, pestaña Cita, página citada, copiar, guardado).
import sys, json, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write']); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(300)
    pg.evaluate("""() => { db.papers.length = 0; db.papers.push(NEWF({id:'p1', title:'Inside the Presidential Debates: Their Improbable Past', authors:['Minow, Newton N.', 'LaMay, Craig L.'], year:2008, venue:'University of Chicago Press', place:'Chicago', type:'libro', doi:'', url:'', accessed:'', general:'', tagIds:[], notes:[], cites:{}, related:[], refTo:[], history:[], reading:'por_leer', rating:0, sectionIds:[]})); UNDO.length = 0; REDO.length = 0; lastSnap = JSON.stringify(db); render(); openPaper('p1'); tab = 'cite'; drawD(); }""")
    eq('por defecto el ajuste está desactivado', pg.evaluate("ex().inText"), False)
    eq('desactivado: no hay cita en el texto ni campo de página', (pg.locator('.itx').count(), pg.locator('#locIn').count()), (0, 0))
    eq('JSON antiguo: el ajuste se rellena a false', pg.evaluate("(d => { validate(d); return d.settings.export.inText })({papers: [], tags: [], sections: []})"), False)
    pg.evaluate("$('#dlg').close(); openCfg()")
    eq('Configuración ofrece el ajuste', 'Mostrar la cita en el texto' in pg.inner_text('#cfg'), True)
    pg.locator('#cfg input[onchange^="setInText"]').check()
    eq('activar guarda el ajuste', (pg.evaluate("ex().inText"), pg.evaluate("JSON.parse(JSON.stringify(db)).settings.export.inText")), (True, True))
    pg.evaluate("$('#cfg').close(); openPaper('p1'); tab = 'cite'; drawD()")
    eq('activado: una zona por estilo y el campo de página', (pg.locator('.itx').count(), pg.locator('#locIn').count()), (10, 1))
    t = lambda k: pg.inner_text('#it_' + k)
    eq('APA: paréntesis y narrativa', ('(Minow y LaMay, 2008)' in t('apa'), 'Minow y LaMay (2008)' in t('apa')), (True, True))
    eq('Chicago NB: nota completa, abreviada e ibid.', pg.locator('#it_chicago_nb .row').count(), 3)
    eq('IEEE y Vancouver traen la advertencia «verificar»', ('verificar' in t('ieee'), 'verificar' in t('vancouver')), (True, True))
    # página citada: actualiza sin tocar las citas editadas a mano
    pg.fill('#c_apa', 'Cita editada a mano'); pg.fill('#locIn', '24-25')
    eq('la página se aplica a las líneas', ('pp. 24-25' in t('apa'), '24-25' in t('chicago_nb'), '(Minow y LaMay 2008, 24-25)' in t('chicago_af'), 'Said' in t('mla')), (True, True, True, False))
    eq('MLA sin coma entre autor y página', '(Minow y LaMay 24-25)' in t('mla'), True)
    eq('la cita editada a mano se conserva', (pg.input_value('#c_apa'), pg.evaluate("D.cites.apa")), ('Cita editada a mano', 'Cita editada a mano'))
    eq('la página no se guarda en el paper', pg.evaluate("JSON.stringify(D).includes('24-25')"), False)
    pg.fill('#locIn', '')
    eq('sin página vuelve al formato simple', 'pp.' in t('apa'), False)
    # cursiva en la nota de Chicago y botones de copiar
    eq('la nota completa lleva cursiva real', pg.evaluate("document.querySelector('#it_chicago_nb i')?.textContent"), 'Inside the Presidential Debates: Their Improbable Past')
    pg.evaluate("document.querySelector('#it_apa button').click()"); pg.wait_for_timeout(200)
    eq('copiar da respuesta', pg.evaluate("document.querySelector('#it_apa button').textContent"), 'Copiado ✓')
    eq('copiado al portapapeles', pg.evaluate("navigator.clipboard.readText()"), '(Minow y LaMay, 2008)')
    pg.evaluate("document.querySelectorAll('#it_chicago_nb button')[1].click()"); pg.wait_for_timeout(200)
    # inglés
    pg.evaluate("ex().lang = 'en'; drawD()")
    eq('en inglés: & entre paréntesis y «and» en narrativa', ('(Minow & LaMay, 2008)' in t('apa'), 'Minow and LaMay (2008)' in t('apa')), (True, True))
    pg.evaluate("ex().lang = 'es'; drawD()")
    # desactivar la oculta de nuevo
    pg.evaluate("$('#dlg').close(); setInText(false); openPaper('p1'); tab = 'cite'; drawD()")
    eq('desactivar vuelve a ocultarla', (pg.locator('.itx').count(), pg.locator('#locIn').count()), (0, 0))
    # el ajuste no cambia la exportación de referencias
    a = pg.evaluate("(() => { const L = db.papers, o = ex(); o.style = 'apa'; o.fmt = 'txt'; return exText(L, o); })()")
    pg.evaluate("setInText(true)"); c = pg.evaluate("(() => { const L = db.papers, o = ex(); o.style = 'apa'; o.fmt = 'txt'; return exText(L, o); })()")
    eq('la exportación de referencias no cambia con el ajuste', a, c)
    eq('sin errores de consola', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
