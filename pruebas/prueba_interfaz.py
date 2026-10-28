# Pruebas de la interfaz simplificada (Chromium): cabecera, estado de guardado, barra lateral, Configuración por pestañas y Ayuda corta.
import sys, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); errs = []
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', '8797', '-d', str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    c = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='block'); A = c.new_page()
    A.on('pageerror', lambda e: errs.append(str(e))); A.on('dialog', lambda d: d.accept())
    A.goto('http://localhost:8797/index.html'); A.wait_for_timeout(1200)
    # cabecera
    eq('cabecera: Drive, Guardar, Importar, Exportar y Archivo', A.evaluate("[...document.querySelectorAll('header .row > button, header .row > .fm > button')].map(b => b.textContent.trim().replace(/\\s+/g, ' '))"), ['🔄Conectar con Google Drive', '💾', '📥 Importar', 'Exportar citas', 'Archivo ▾'])
    eq('ya no están Abrir, Reabrir último, Guardar como ni Autoguardado a la vista', A.evaluate("['#reopen'].map(s => !!$(s)).concat([!$('#auto').offsetParent])"), [False, True])
    A.click('#fmBtn')
    eq('Archivo abre el menú y marca aria-expanded', A.evaluate("[!$('#fmenu').hidden, $('#fmBtn').getAttribute('aria-expanded')]"), [True, 'true'])
    A.mouse.click(600, 600)
    eq('un clic fuera lo cierra', A.evaluate("$('#fmenu').hidden"), True)
    A.click('#fmBtn'); A.click('#fmenu button:has-text("Pegar BibTeX")'); A.wait_for_timeout(200)
    eq('un elemento del menú lo cierra y abre su ventana', A.evaluate("[$('#fmenu').hidden, $('#imp').open]"), [True, True])
    A.evaluate("$('#imp').close()")
    # estado de guardado único
    eq('local con archivo: «Guardado» y el nombre', A.evaluate("[$('#fname').textContent, $('#fname').dataset.st]"), ['Guardado · ejemplo_papers.json', 'ok'])
    A.evaluate("db.papers[0].title = 'x'; markDirty()")
    eq('con cambios: «Sin guardar»', A.evaluate("[$('#fname').textContent, $('#fname').dataset.st]"), ['Sin guardar · ejemplo_papers.json', 'pend'])
    A.evaluate("db.settings.showFile = false; hdr()")
    eq('sin mostrar el archivo, solo el estado', A.evaluate("$('#fname').textContent"), 'Sin guardar')
    A.evaluate("db.settings.showFile = true; path = null; dirty = false; hdr()")
    eq('sin archivo', A.evaluate("[$('#fname').textContent, $('#fname').dataset.st]"), ['(sin archivo)', ''])
    # menú del proyecto: volver a leer solo con archivo
    A.click('#pjBtn')
    eq('sin archivo no hay «Volver a leer»', A.evaluate("[...document.querySelectorAll('#ctx button')].some(b => b.textContent.includes('Volver a leer'))"), False)
    eq('«Buscar duplicados» está en el menú del proyecto', A.evaluate("[...document.querySelectorAll('#ctx button')].some(b => b.textContent.includes('Buscar duplicados'))"), True)
    A.keyboard.press('Escape')
    # barra lateral
    eq('barra lateral: Buscar, Ordenar, Filtros, y Selección oculta', A.evaluate("[...document.querySelectorAll('#side > .sg')].map(g => [g.id, g.hidden])"), [['sg-search', False], ['sg-sort', False], ['sg-filt', False], ['sg-sel', True]])
    eq('Filtros reúne Secciones, Etiquetas y Lectura', A.evaluate("[...document.querySelectorAll('#sg-filt .fh2 b')].map(b => b.textContent)"), ['📁 Secciones', '🏷️ Etiquetas', '📖 Lectura'])
    eq('el botón «Visibles» (seleccionar los que se ven) está sobre la lista, con texto corto', A.evaluate("[!!$('#selAll').offsetParent, $('#selAll').closest('main') !== null, $('#selAll').textContent]"), [True, True, '☑ Visibles'])
    A.click('#selAll')
    eq('seleccionar visibles muestra la barra de Selección con su contador', A.evaluate("[$('#sg-sel').hidden, $('#selT').textContent, [...document.querySelectorAll('#sg-sel .sb button')].map(b => b.textContent)]"), [False, 'Selección (2)', ['Exportar citas…', 'Mover o copiar a otro proyecto…', 'Quitar selección']])
    A.evaluate("document.querySelector('#sg-sel .sb button:last-child').click()")
    eq('quitar la selección la oculta', A.evaluate("$('#sg-sel').hidden"), True)
    A.evaluate("F.read = 'leido'; render()")
    eq('un filtro activo marca el punto de Filtros', A.evaluate("!$('#d-filt').hidden"), True)
    A.evaluate("F.read = ''; render()")
    # Configuración por pestañas
    A.evaluate("openCfg()")
    eq('cuatro pestañas, la primera abierta', A.evaluate("[[...document.querySelectorAll('#cfg .ctabs button')].map(b => b.textContent), document.querySelector('#cfg .ctabs button.on').textContent]"), [['Apariencia', 'Notas y citas', 'Atajos', 'Datos y Drive'], 'Apariencia'])
    eq('Apariencia: nombre, paleta, imagen, archivo y progreso (desactivado)', A.evaluate("[!!$('#cfg input[data-oninput*=appName]'), !![...document.querySelectorAll('#cfg summary')].find(s => s.textContent.includes('Paleta')), document.querySelector('#cfg label:has(input[data-onchange*=showProgress]) input').checked]"), [True, True, False])
    A.evaluate("document.querySelector('#cfg input[data-onchange*=showProgress]').click()")
    eq('la casilla activa el progreso', A.evaluate("[db.settings.showProgress, !$('#pjProg').hidden]"), [True, True])
    A.click('#cfg .ctabs button:has-text("Notas y citas")')
    eq('Notas y citas: tipos, estilos y plantillas', A.evaluate("[...document.querySelectorAll('#cfg summary')].map(s => s.textContent)"), ['Tipos de documento propios', 'Estilos de cita personalizados', 'Plantillas de nota'])
    A.click('#cfg .ctabs button:has-text("Atajos")')
    eq('Atajos: ya abierto', A.evaluate("[document.querySelectorAll('#cfg summary').length, document.querySelector('#cfg details.cs').open]"), [1, True])
    A.click('#cfg .ctabs button:has-text("Datos y Drive")')
    eq('Datos y Drive: estado de Drive y subida de PDF', A.evaluate("[$('#cfg').innerText.includes('sin conectar'), $('#cfg').innerText.includes('Subir a mi Google Drive los PDF enlazados')]"), [True, True])
    A.evaluate("$('#cfg').close(); openCfg('ap')")
    # Ayuda corta
    A.evaluate("$('#cfg').close(); openHelp()")
    eq('la ayuda muestra solo «Empezar aquí» y un botón', A.evaluate("[[...document.querySelectorAll('#hpb > details')].filter(d => !d.hidden).map(d => d.querySelector('summary').textContent), $('#hpMore').textContent.includes('Ver toda la ayuda')]"), [['Empezar aquí'], True])
    A.click('#hpMore')
    eq('«Ver toda la ayuda» muestra el resto', A.evaluate("[document.querySelectorAll('#hpb > details:not([hidden])').length > 10, $('#hpMore').textContent.includes('Ocultar')]"), [True, True])
    A.click('#hpMore')
    A.fill('#hpq', 'duplicados')
    eq('al buscar se busca en toda la ayuda', A.evaluate("[...document.querySelectorAll('#hpb > details')].filter(d => !d.hidden).map(d => d.querySelector('summary').id || d.id)"), ['hp_extras'])
    A.evaluate("$('#help').close(); openHelp('extras')")
    eq('abrir un tema concreto despliega la ayuda completa', A.evaluate("[!$('#hp_extras').hidden, !$('#hp_config').hidden]"), [True, True])
    eq('sin errores', errs, [])
    srv.terminate(); b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
