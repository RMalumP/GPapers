# Pruebas de importación (Chromium): botón «Importar», texto de ScienceDirect (.txt) y citas copiadas de Google Scholar (APA, MLA, Chicago, Harvard, Vancouver).
import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
shots = os.environ.get('SHOTS')   # carpeta opcional para guardar capturas
n = fail = 0
def eq(name, got, want):
    global n, fail
    n += 1
    if got != want:
        fail += 1; print('FALLA', name, '\n  got :', json.dumps(got, ensure_ascii=False), '\n  want:', json.dumps(want, ensure_ascii=False))
SD = (folder / 'pruebas' / 'ejemplo_sciencedirect.txt').read_text()
IY = ['Iyengar, S.', 'Lelkes, Y.', 'Levendusky, M.', 'Malhotra, N.', 'Westwood, S. J.']
IYT = 'The origins and consequences of affective polarization in the United States'
ART = {'y': '2019', 't': IYT, 'v': 'Annual review of political science', 'ty': 'articulo', 'vol': '22', 'is': '1', 'pp': '129-146'}
SCHOLAR = [   # [estilo, cita tal como la da el botón «Citar» de Google Scholar, autores esperados, resto esperado]
  ['APA', f'Iyengar, S., Lelkes, Y., Levendusky, M., Malhotra, N., & Westwood, S. J. (2019). {IYT}. Annual review of political science, 22(1), 129-146.', IY, ART],
  ['MLA', f'Iyengar, Shanto, et al. "{IYT}." Annual review of political science 22.1 (2019): 129-146.', ['Iyengar, Shanto'], ART],
  ['Chicago', f'Iyengar, Shanto, Yphtach Lelkes, Matthew Levendusky, Neil Malhotra, and Sean J. Westwood. "{IYT}." Annual review of political science 22, no. 1 (2019): 129-146.', ['Iyengar, Shanto', 'Lelkes, Yphtach', 'Levendusky, Matthew', 'Malhotra, Neil', 'Westwood, Sean J.'], ART],
  ['Harvard', f'Iyengar, S., Lelkes, Y., Levendusky, M., Malhotra, N. and Westwood, S.J., 2019. {IYT}. Annual review of political science, 22(1), pp.129-146.', IY, ART],
  ['Vancouver', f'Iyengar S, Lelkes Y, Levendusky M, Malhotra N, Westwood SJ. {IYT}. Annual review of political science. 2019 May 11;22(1):129-46.', IY, ART],
  ['APA, número de artículo', 'Wagner, M. (2021). Affective polarization in multiparty systems. Electoral Studies, 69, 102199.', ['Wagner, M.'], {'y': '2021', 't': 'Affective polarization in multiparty systems', 'v': 'Electoral Studies', 'ty': 'articulo', 'vol': '69', 'is': '', 'pp': '102199'}],
  ['MLA, año entre paréntesis', 'Wagner, Markus. “Affective polarization in multiparty systems.” Electoral Studies 69 (2021): 102199.', ['Wagner, Markus'], {'y': '2021', 't': 'Affective polarization in multiparty systems', 'v': 'Electoral Studies', 'ty': 'articulo', 'vol': '69', 'is': '', 'pp': '102199'}],
  ['APA, libro', 'Kahneman, D. (2011). Thinking, fast and slow. macmillan.', ['Kahneman, D.'], {'y': '2011', 't': 'Thinking, fast and slow', 'v': 'macmillan', 'ty': 'libro', 'vol': '', 'is': '', 'pp': ''}],
  ['MLA, libro', 'Kahneman, Daniel. Thinking, fast and slow. macmillan, 2011.', ['Kahneman, Daniel'], {'y': '2011', 't': 'Thinking, fast and slow', 'v': 'macmillan', 'ty': 'libro', 'vol': '', 'is': '', 'pp': ''}],
]
PICK = "r => r && {a: r.authors, y: r.year, t: r.title, v: r.venue, ty: r.type, vol: r.volume ?? null, is: r.issue ?? null, pp: r.pages ?? null}"
with sync_playwright() as pw:
    kw = {'executable_path': '/opt/pw-browsers/chromium'} if os.path.exists('/opt/pw-browsers/chromium') else {}
    b = pw.chromium.launch(**kw); ctx = b.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + str(folder / 'index.html')); pg.wait_for_timeout(400)
    # ---- botón «Importar» en la barra principal
    eq('Importar está en la cabecera, a la izquierda de Exportar citas', pg.evaluate("(b => [!!b.closest('header'), b.nextElementSibling?.textContent])([...document.querySelectorAll('button')].find(b => b.textContent === '📥 Importar'))"), [True, 'Exportar citas'])
    pg.click('button:has-text("📥 Importar")')
    eq('el botón Importar abre el menú con las tres formas', pg.evaluate("[...document.querySelectorAll('#ctx button')].map(b => b.textContent)"), ['📄 Desde archivo (.bib, .ris o .txt)', '📋 Pegar BibTeX, RIS o citas de Google Scholar', '🔎 Buscar por DOI'])
    pg.click('#ctx button:has-text("Pegar")')
    eq('pegar texto: el cuadro explica qué admite', 'Google Scholar' in pg.get_attribute('#iTxt', 'placeholder'), True)
    if shots: pg.screenshot(path=os.path.join(shots, '4_importar_pegar.png'))
    # ---- texto de ScienceDirect
    eq('ScienceDirect: se reconoce el formato', pg.evaluate("t => [isSdTxt(t), isSdTxt('Wagner, M. (2021). Título. Revista, 1, 2.')]", SD), [True, False])
    eq('ScienceDirect: todos los campos', pg.evaluate("t => parseSd(t).map(r => [r.authors, r.title, r.venue, r.year, r.type, r.volume, r.pages, r.issn, r.doi, r.url])", SD),
       [[['Wagner, Markus'], 'Affective polarization in multiparty systems', 'Electoral Studies', '2021', 'articulo', '69', '102199', '0261-3794', '10.1016/j.electstud.2020.102199', 'https://www.sciencedirect.com/science/article/pii/S0261379420300822']])
    eq('ScienceDirect: resumen y palabras clave a las notas generales', pg.evaluate("t => (g => [g.startsWith('**Resumen:** Affective polarization captures'), g.includes('**Palabras clave:** Affective polarization; Ideological')])(parseSd(t)[0].general)", SD), [True, True])
    two = SD.strip() + '\n\nAna García, Luis Pérez and John Smith,\nOtro artículo,\nRevista X,\nVolume 3,\nIssue 2,\n2020,\nPages 10-20,\nISSN 1234-5678,\nhttps://doi.org/10.1/abc.\n'
    eq('ScienceDirect: varios registros, varios autores, número y páginas', pg.evaluate("t => (r => [r.length, r[1].authors, r[1].issue, r[1].pages])(parseSd(t))", two), [2, ['García, Ana', 'Pérez, Luis', 'Smith, John'], '2', '10-20'])
    pg.evaluate("t => impText(t)", SD)
    eq('ScienceDirect: la vista previa lo lista', pg.evaluate("[IMP.mode, IMP.refs.length, IMP.refs[0].on]"), ['prev', 1, True])
    pg.click('#iGo')
    eq('y al importar el paper lleva los datos y el resumen', pg.evaluate("(p => [p.title, p.venue, p.volume, p.pages, p.issn, p.doi, p.general.slice(0, 12)])(db.papers.at(-1))"), ['Affective polarization in multiparty systems', 'Electoral Studies', '69', '102199', '0261-3794', '10.1016/j.electstud.2020.102199', '**Resumen:**'])
    # ---- citas de Google Scholar
    for name, cite, au, rest in SCHOLAR:
        got = pg.evaluate(f"c => ({PICK})(parseCite(c))", cite)
        eq(f'Google Scholar {name}', got, {'a': au, **rest})
    eq('Scholar: varias citas, una por línea (y se ignoran las vacías)', pg.evaluate("t => parseCites(t).length", '\n'.join(c for _, c, _, _ in SCHOLAR[:5]) + '\n\n'), 5)
    eq('Scholar: rango abreviado de Vancouver', pg.evaluate("[expPages('129-46'), expPages('1001-9'), expPages('45-67')]"), ['129-146', '1001-1009', '45-67'])
    eq('un texto que no es una cita no se importa', pg.evaluate("parseCites('hola qué tal\\nesto no es una referencia')"), [])
    pg.evaluate("$('#imp').close(); openImport('text')")
    pg.fill('#iTxt', SCHOLAR[0][1] + '\n' + SCHOLAR[2][1] + '\n' + SCHOLAR[7][1]); pg.click('#imp button:has-text("Analizar")')
    eq('pegar citas de Scholar: la vista previa marca el duplicado', pg.evaluate("[IMP.refs.length, IMP.refs.map(r => r.on)]"), [3, [True, False, True]])
    if shots: pg.screenshot(path=os.path.join(shots, '5_importar_scholar.png'))
    pg.click('#iGo')
    eq('y se importan con sus datos', pg.evaluate("db.papers.slice(-2).map(p => [p.type, p.authors.length, p.year, p.venue, p.volume || '', p.issue || '', p.pages || ''])"), [['articulo', 5, 2019, 'Annual review of political science', '22', '1', '129-146'], ['libro', 1, 2011, 'macmillan', '', '', '']])
    eq('los BibTeX y RIS siguen funcionando', pg.evaluate("[parseBib('@article{a, title={T}, author={Pérez, Ana}, year={2020}, journal={J}}').length, parseRis('TY  - JOUR\\nTI  - T\\nAU  - Pérez, Ana\\nER  - ').length]"), [1, 1])
    eq('sin errores de JavaScript', errs, [])
    b.close()
print(f'{n - fail}/{n} pruebas correctas'); sys.exit(1 if fail else 0)
