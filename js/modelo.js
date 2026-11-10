'use strict';
// Modelo de datos, tipos, ordenación y utilidades comunes. Los scripts se cargan desde index.html en orden (sw.js los guarda en el mismo orden); son clásicos, así que comparten el ámbito global y la app sigue funcionando desde file://.
/* ===== Modelo de datos (JSON) =====
 {version:1, sections:[{id,name,description,color}], tags:[{id,name,color}],
  papers:[{id,title,authors[],year,url,type,venue,doi,accessed,general,
           tagIds[]            <- relación Paper–Etiqueta
           notes:[{id,sectionId,content}]   <- notas (paper_id implícito)
           cites:{apa:"..."}}]}   <- solo citas editadas a mano; el resto se genera */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xesc = s => esc(String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, ''));   // para XML (Word): además, sin los caracteres de control que XML no admite (el archivo no se abría)
/* ===== Avisos y confirmaciones propios (en lugar de alert y confirm del navegador, que en la app instalada se ven fuera de estilo y bloquean la página) =====
   say(texto) avisa; askOk(texto, {ok, danger}) pregunta y devuelve true o false. Si ya hay uno abierto, el siguiente espera su turno.
   Las pruebas pueden contestar solas con window.ASK_AUTO = 'accept' | 'dismiss'. */
let ASK_Q = Promise.resolve();
function askDlg(msg, btns) {   // btns: [{t, v, cls, cancel}] → promesa con el v del botón pulsado (Esc = el de cancelar)
  const auto = window.ASK_AUTO, cancelV = (btns.find(b => b.cancel) || btns[btns.length - 1]).v;
  if (auto) return Promise.resolve(auto === 'dismiss' ? cancelV : btns[0].v);
  const run = () => new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'ask'; d.setAttribute('role', 'alertdialog');
    d.innerHTML = `<p>${esc(msg).replace(/\n/g, '<br>')}</p><div class="row">${btns.map((b, i) => `<button data-i="${i}" class="${b.cls || ''}">${esc(b.t)}</button>`).join('')}</div>`;
    let done = false; const end = v => { if (done) return; done = true; d.close(); d.remove(); res(v); };
    d.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) end(btns[+b.dataset.i].v); });
    d.addEventListener('cancel', e => { e.preventDefault(); end(cancelV); });
    document.body.appendChild(d); d.showModal(); d.querySelector('button').focus();
  });
  return (ASK_Q = ASK_Q.then(run, run));
}
const say = msg => askDlg(String(msg), [{t: 'Aceptar', v: true, cls: 'pri'}]);
const askOk = (msg, o = {}) => askDlg(String(msg), [{t: o.ok || 'Aceptar', v: true, cls: o.danger ? 'pri danger' : 'pri'}, {t: o.no || 'Cancelar', v: false, cancel: true}]);
/* Identificadores: lo que viene de un archivo o de Drive no se fía. Un id va dentro del HTML y de los data-on…, así que solo valen letras, números, «_» y «-»;
   cualquier otro se cambia por su huella (siempre la misma: las referencias a ese id cambian igual y la sincronización compara lo mismo). */
const ID_RX = /^[\w-]{1,64}$/;
const idFix = v => typeof v === 'string' ? (!v || ID_RX.test(v) ? v : 'x' + syHash(v)) : v == null || Number.isFinite(v) ? v : 'x' + syHash(JSON.stringify(v) || '');
const idsFix = a => Array.isArray(a) ? a.map(idFix) : [];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const SC_NAMES = {open: 'Abrir archivo', save: 'Guardar', find: 'Buscar', newPaper: 'Nuevo paper', undo: 'Deshacer', redo: 'Rehacer', exportCites: 'Exportar citas', import: 'Importar referencias', side: 'Plegar o desplegar la barra lateral', bold: 'Negrita (dentro de una nota)', italic: 'Cursiva (dentro de una nota)', palette: 'Paleta de órdenes (buscar acciones y papers)'};
// Alt+N en lugar de Ctrl+N: Chrome reserva Ctrl+N, Ctrl+T y Ctrl+W y no permite cambiarlos
const SC_DEF = {open: 'Ctrl+O', save: 'Ctrl+S', find: 'Ctrl+F', newPaper: 'Alt+N', undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z', exportCites: 'Ctrl+Shift+E', import: 'Alt+I', side: 'Alt+M', bold: 'Ctrl+B', italic: 'Ctrl+I', palette: 'Ctrl+K'};
const TRASH_DAYS = 5;   // días que un paper eliminado permanece en la papelera
const trashLeft = t => Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - new Date(t.at)) / 864e5));
const TPL_DEF = [   // plantillas de nota de serie; {fecha} y {paper} se sustituyen al insertarlas
  {id: 't_res', name: 'Resumen del paper', text: '**Objetivo:** \n**Método:** \n**Resultados:** \n**Limitaciones:** '},
  {id: 't_cit', name: 'Cita textual', text: '**Cita:** \n**Página:** \n**Comentario:** '},
  {id: 't_ide', name: 'Idea propia', text: '**Idea:** \n**Relación con mi tema:** \n**Siguiente paso:** '}];
const defSettings = () => ({palette: 'azul', appName: 'Papers', showFile: true, showImg: true, showProgress: false, pdfDrive: false, pdfVis: false, showInbox: true, pdfTab: 'tab', annAuto: false, annFmt: 'txt', inboxPos: 'bottom', inboxBtn: false, customTypes: [], customStyles: [], mainStyle: 'apa', citeOnlyMain: false, aliasInMore: false, shortcuts: {...SC_DEF}, fmtOpen: false, view: 'cards', templates: TPL_DEF.map(t => ({...t})), export: {fmt: 'txt', style: 'apa', order: 'auto', num: false, notes: false, particles: false, title: '', lang: 'es', dateFmt: 'long', vanAll: false, ppChap: true, numFmt: 'auto', disamb: true, abbrList: true, inText: false}});   // ajustes por defecto (se guardan en el JSON)
let db = {version: 1, sections: [], tags: [], papers: [], trash: [], inbox: [], settings: defSettings()}, path = null, dirty = false, auto = false, D, tab = 'data', MG, timer;
const F = {q: '', sorts: [{k: 'title', d: 1}], group: false, secs: new Set(), tags: new Set(), read: '', minRating: 0, inNotes: false, mode: 'any', tbSec: false, tbTag: true, exTags: new Set(), noTag: false, noSec: false, yFrom: 0, yTo: 0, adv: {mode: 'all', rules: []}};   // secs: secciones elegidas (vale cualquiera de ellas) · exTags: etiquetas excluidas · noTag / noSec: solo papers sin etiquetas / sin sección · yFrom, yTo: años (0 = sin límite) · adv: búsqueda avanzada
const SEL = new Set();   // ids de papers seleccionados
const READ = {por_leer: 'Por leer', leyendo: 'Leyendo', leido: 'Leído'};   // estado de lectura (único por paper)
const READ_N = {por_leer: 0, leyendo: 1, leido: 2}, READ_C = {por_leer: '#888888', leyendo: '#2457c5', leido: '#27ae60'};
const SORTS = {created: 'Fecha de creación', modified: 'Última modificación', title: 'Título', author: 'Autor', year: 'Año', venue: 'Revista/editorial', accessed: 'Fecha de consulta', reading: 'Estado de lectura', rating: 'Valoración', sections: 'Secciones', tags: 'Etiquetas', manual: 'Orden manual (arrastrando)'};
/* Clasificaciones para ordenar (db.orders): varias por proyecto, cada una de etiquetas o de secciones, con su forma de escribir los valores.
   Cada etiqueta o sección guarda su valor en rk[idClasificación] (texto tal cual se escribió: «3», «C», «III»…). */
const ORD_FMT = {num: 'Números (1, 2, 3…)', alpha: 'Letras (A, B, C…)', roman: 'Números romanos (I, II, III…)', text: 'Texto libre (orden alfabético)'};
const ORD_PH = {num: '1', alpha: 'A', roman: 'I', text: 'texto'};
const ordOf = k => (db.orders || []).filter(o => o.of === k);
function romanVal(s) {
  const V = {I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000}, u = s.toUpperCase(); if (!u || !/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(u)) return null;   // solo bien escritos («IIII» no)
  let n = 0; for (let i = 0; i < u.length; i++) { const a = V[u[i]], b = V[u[i + 1]] || 0; n += a < b ? -a : a; } return n;
}
function ordVal(o, raw) {   // número para comparar (o texto, en «texto libre»); null = sin valor o mal escrito
  const s = String(raw ?? '').trim(); if (!s) return null;
  if (o.fmt === 'text') return s;
  if (o.fmt === 'roman') return romanVal(s);
  if (o.fmt === 'alpha') { if (!/^\p{L}+$/u.test(s)) return null; let n = 0; for (const c of norm(s).toUpperCase()) { const k = c.charCodeAt(0) - 64; if (k < 1 || k > 26) return null; n = n * 26 + k; } return n; }   // A=1 … Z=26, AA=27
  const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : null;
}
const KEY = {created: p => p.created || '', modified: p => p.modified || p.created || '', title: p => p.alias || p.title, author: p => p.authors[0] || '',
  year: p => +p.year || 0, venue: p => p.venue || '', accessed: p => p.accessed || '', reading: p => READ_N[p.reading] ?? 0, rating: p => p.rating || 0,
  sections: p => listKey(p.sectionIds, db.sections), tags: p => listKey(p.tagIds, db.tags)};   // por su puesto en la lista de Gestionar (la primera que tenga, luego la siguiente…); sin ninguna, al final
function listKey(ids, L) { const n = ids.map(i => L.findIndex(x => x.id === i)).filter(i => i >= 0); return n.length ? n.sort((a, b) => a - b).map(i => String(i).padStart(5, '0')).join(' ') : null; }
const TYPES = {articulo: 'Artículo de revista', libro: 'Libro', capitulo: 'Capítulo', congreso: 'Congreso', tesis: 'Tesis', web: 'Página web', prensa: 'Artículo de prensa', blog: 'Entrada de blog',
  informe: 'Informe', norma: 'Norma técnica', patente: 'Patente', mapa: 'Mapa', dataset: 'Conjunto de datos', software: 'Software o videojuego', basedatos: 'Base de datos', audiovisual: 'Audiovisual (película, serie, vídeo)',
  audio: 'Audio (podcast, canción)', redsocial: 'Publicación en red social', ia: 'IA generativa', diccionario: 'Entrada de diccionario o enciclopedia', presentacion: 'Presentación', personal: 'Comunicación personal', legislacion: 'Legislación', jurisprudencia: 'Jurisprudencia (sentencia, auto…)'};
const LINK_MODES = {auto: 'Automático (DOI si hay; si no, URL)', doi: 'Solo DOI', url: 'Solo URL (Disponible en)', none: 'Ninguno'};   // enlace que se escribe en la cita
const AUTH_T = {auto: 'Automático', persona: 'Persona', entidad: 'Entidad (organización)', sin_autor: 'Sin autor'};
const THESIS = ['Tesis doctoral', 'Trabajo fin de grado', 'Trabajo fin de máster', 'Proyecto fin de carrera'];
const STR_F = ['volume', 'issue', 'pages', 'publisher', 'place', 'edition', 'pubDate', 'thesisType',
  'isbn', 'issn', 'series', 'seriesNumber', 'institution', 'docNumber', 'conferenceName', 'conferencePlace', 'conferenceDates', 'subtype', 'authorRole', 'userHandle', 'abbr', 'ecli'];   // campos de texto (F1a y, desde F3a, los P2: aún sin plantilla de cita)
const FLD_T = {volume: ['articulo'], issue: ['articulo', 'legislacion'], pages: ['articulo', 'capitulo', 'congreso', 'prensa', 'legislacion', 'diccionario'], publisher: ['capitulo', 'congreso', 'jurisprudencia'],
  place: ['libro', 'capitulo', 'congreso', 'tesis', 'web', 'informe', 'norma', 'patente', 'mapa', 'software', 'basedatos', 'audiovisual', 'legislacion', 'jurisprudencia'],
  edition: ['libro', 'norma', 'mapa', 'dataset', 'software', 'ia', 'diccionario'], editors: ['capitulo'],
  pubDate: ['articulo', 'web', 'prensa', 'blog', 'informe', 'norma', 'patente', 'dataset', 'software', 'audiovisual', 'audio', 'redsocial', 'ia', 'presentacion', 'personal', 'legislacion', 'jurisprudencia'], thesisType: ['tesis'],
  isbn: ['libro'], issn: ['articulo'], institution: ['tesis'], series: ['informe', 'mapa', 'audiovisual', 'audio', 'ia', 'jurisprudencia'], seriesNumber: ['informe', 'mapa', 'audiovisual', 'audio', 'jurisprudencia'], docNumber: ['informe', 'norma', 'patente', 'mapa', 'legislacion', 'jurisprudencia'],
  conferenceName: [], conferencePlace: [], conferenceDates: [],
  subtype: ['mapa', 'dataset', 'software', 'audiovisual', 'audio', 'redsocial', 'ia', 'presentacion', 'personal', 'legislacion', 'jurisprudencia'], authorRole: ['audiovisual', 'audio'], userHandle: ['redsocial'],
  abbr: ['legislacion', 'jurisprudencia'], ecli: ['jurisprudencia']};   // en qué tipos se muestra cada campo en el formulario (F3a–F3e)
// etiquetas del formulario según el tipo (si no hay entrada, se usa la genérica)
const FLBL = {
  venue: {capitulo: 'Título del libro (la obra completa en la que está el capítulo)', prensa: 'Periódico o medio', blog: 'Nombre del blog', informe: 'Institución o editorial', norma: 'Organismo de normalización (p. ej. International Organization for Standardization (ISO))', patente: 'Titular o solicitante', mapa: 'Editor o impresor', dataset: 'Repositorio o editor',
    software: 'Empresa, editor o repositorio', basedatos: 'Editor o institución', audiovisual: 'Productora o distribuidora', audio: 'Discográfica, plataforma o productora', redsocial: 'Red social (Instagram, X, Facebook…)', ia: 'Empresa (OpenAI, Google…)',
    diccionario: 'Obra de referencia (diccionario o enciclopedia)', presentacion: 'Plataforma o repositorio', personal: 'Contexto (opcional)', legislacion: 'Publicación oficial (BOE, DOUE…)', jurisprudencia: 'Tribunal u órgano (p. ej. Tribunal Supremo)'},
  title: {capitulo: 'Título del capítulo *', legislacion: 'Título completo y exacto de la norma * (p. ej. Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público)', jurisprudencia: 'Caso o partes * (p. ej. Rubio dos Amantes contra España; si no hay, la identificación: STS 1229/2017)'},
  docNumber: {informe: 'Número o código del informe (p. ej. NIH Publication No. 18-2059)', norma: 'Código de la norma (p. ej. ISO 690:2010)', patente: 'Número de la patente', mapa: 'Escala (p. ej. 1:8.000.000)', legislacion: 'Código o referencia (p. ej. RCL 2018\\1629)', jurisprudencia: 'Número de la resolución (p. ej. 1229/2017)'},
  edition: {norma: 'Edición o estado (p. ej. completa)', mapa: 'Edición o versión', dataset: 'Versión', software: 'Versión', ia: 'Versión (p. ej. versión del 13 de febrero)', diccionario: 'Edición (desde la 2.ª)'},
  place: {patente: 'País (p. ej. US, ES)', legislacion: 'Ámbito territorial (p. ej. España, Extremadura, Unión Europea)', jurisprudencia: 'Ámbito (opcional; p. ej. España)'},
  series: {informe: 'Serie (p. ej. Documentos de trabajo)', mapa: 'Serie del mapa', audiovisual: 'Serie o programa (si es un episodio)', audio: 'Disco o programa (podcast)', ia: 'Herramienta (p. ej. ChatGPT)', jurisprudencia: 'Sala y sección (p. ej. Sala de lo Penal, Sección 1.ª; Pleno)'},
  seriesNumber: {informe: 'Número en la serie', mapa: 'Designación de la serie', audiovisual: 'Temporada y episodio (p. ej. Temporada 6, Episodio 5)', audio: 'Número del episodio', jurisprudencia: 'Asunto (p. ej. C-403/03; TJUE)'},
  pubDate: {articulo: 'Fecha de publicación (se usa solo el mes: Chicago, IEEE)', norma: 'Fecha de aprobación', patente: 'Fecha de concesión', personal: 'Fecha exacta', legislacion: 'Fecha de publicación en el boletín', jurisprudencia: 'Fecha de la resolución'},
  issue: {legislacion: 'Número del boletín (p. ej. 236; en el DOUE, L 94)'},
  publisher: {jurisprudencia: 'Base de datos (opcional; p. ej. Aranzadi Instituciones, CENDOJ)'},
  subtype: {legislacion: 'Rango (opcional; se deduce del título)', jurisprudencia: 'Tipo de resolución (por defecto, Sentencia)'},
  abbr: {legislacion: 'Abreviatura (p. ej. CE, LOPJ, LRJSP)', jurisprudencia: 'Abreviatura propia (opcional; se deduce: STS, STC, STSJ Madrid…)'}};
const FSUB = {mapa: ['Mapa'], dataset: ['Dataset', 'Conjunto de datos'], software: ['Software', 'Videojuego', 'Programa', 'Aplicación'], audiovisual: ['Película', 'Serie de TV', 'Capítulo de serie de televisión', 'Video'], audio: ['Audio podcast', 'Episodio de audio podcast', 'Canción'],
  redsocial: ['Post de X', 'Fotografía', 'Video', 'Actualización de estado', 'Historia de Instagram'], ia: ['Modelo de lenguaje de gran tamaño', 'Chat de IA generativa'], presentacion: ['Presentación de PowerPoint', 'Conferencia'], personal: ['Correo electrónico', 'Entrevista', 'Carta', 'Mensaje', 'Llamada telefónica'],
  legislacion: ['Constitución', 'Estatuto de Autonomía', 'Ley Orgánica', 'Ley', 'Real Decreto-ley', 'Real Decreto Legislativo', 'Real Decreto', 'Decreto', 'Orden', 'Resolución', 'Circular', 'Instrucción', 'Tratado', 'Convenio', 'Reglamento (UE)', 'Directiva', 'Decisión', 'Recomendación', 'Dictamen'],
  jurisprudencia: ['Sentencia', 'Auto', 'Declaración', 'Providencia']};
const shows = (k, t) => CTYPES.has(t) ? CTYPES.get(t).fields.includes(k) : FLD_T[k].includes(t);
const IMG_RX = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/, IMG_TK = /^@[0-9a-f]{9,40}$/;
let IMG_TK_OK = false;   // solo dentro de una vuelta de sincronización: la imagen puede ir como su huella («@huella», ver syTokS en js/drive.js)
function imgOk(i) {   // imagen del paper: URL, archivo local enlazado (solo el nombre; el enlace vive en este navegador) o copia reducida incrustada
  if (!i || typeof i !== 'object') return null;
  if (i.kind === 'url' && /^https?:\/\//i.test(i.url)) return {kind: 'url', url: i.url};
  if (i.kind === 'data' && typeof i.data === 'string' && i.data.length < 600000 && (IMG_RX.test(i.data) || IMG_TK_OK && IMG_TK.test(i.data))) return {kind: 'data', data: i.data};
  if (i.kind === 'file' && typeof i.name === 'string' && i.name) return {kind: 'file', name: i.name};
  return null;
}
function NEWF(p) {   // rellena los campos nuevos de un paper (JSON antiguo, importados, papelera) sin tocar los existentes
  for (const k of STR_F) p[k] = typeof p[k] === 'string' ? p[k] : '';
  p.editors = Array.isArray(p.editors) ? p.editors.filter(x => typeof x === 'string' && x.trim()) : [];
  p.authorType = Object.hasOwn(AUTH_T, p.authorType) ? p.authorType : 'auto';
  p.linkMode = Object.hasOwn(LINK_MODES, p.linkMode) ? p.linkMode : 'auto'; p.hideAccessed = !!p.hideAccessed; p.image = imgOk(p.image);
  for (const k of ['pdf', 'pdf2']) p[k] = pdfClean(p[k]);   // hasta dos PDF enlazados (con sus subrayados y comentarios)
  return p;
}
/* ===== PDF: subrayados, comentarios y notas (visor, js/visor.js) =====
   Cada PDF (de un paper, o de la bandeja «PDF por citar») lleva sus anotaciones en «ann»: van con la biblioteca, así se sincronizan con Drive,
   se deshacen y se copian como todo lo demás. Coordenadas en el espacio del PDF (puntos, origen abajo a la izquierda), como las anotaciones del propio PDF:
   {id, k: 'hl' (subrayado de texto) | 'area' (zona, para escaneados) | 'note' (nota en un punto), p: página desde 0, q: [x1, y1, x2, y2, …] (un rectángulo por línea),
    c: color, t: texto subrayado, m: comentario, src: id de la anotación del PDF de la que viene (al importarla), at: creada, up: cambiada}. */
const ANN_K = new Set(['hl', 'area', 'note']), HEX_RX = /^#[0-9a-f]{6}$/i;
const annStr = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
function annClean(l) {   // el mismo orden de campos siempre: normalizar dos veces da lo mismo (la sincronización compara el JSON)
  if (!Array.isArray(l)) return []; const seen = new Set(), out = [];
  for (const a of l) {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id || a.id.length > 40) continue;
    if (!ID_RX.test(a.id)) a.id = idFix(a.id);
    if (seen.has(a.id) || !ANN_K.has(a.k) || !Number.isInteger(a.p) || a.p < 0 || a.p > 99999) continue;
    const q = Array.isArray(a.q) ? a.q.filter(Number.isFinite).slice(0, 800) : []; if (!q.length || q.length % 4) continue;
    seen.add(a.id); const t = annStr(a.t, 4000), m = annStr(a.m, 20000), src = annStr(a.src, 60);
    out.push({id: a.id, k: a.k, p: a.p, q: q.map(x => Math.round(x * 100) / 100), c: HEX_RX.test(a.c) ? a.c.toLowerCase() : '#ffd400', ...(t ? {t} : {}), ...(m ? {m} : {}), ...(src ? {src} : {}), at: annStr(a.at, 40), up: annStr(a.up, 40)});
    if (out.length >= 5000) break;
  }
  return out;
}
const PDF_VIS = new Set(['si', 'no']);   // por PDF: también en el Drive normal (si), solo en la carpeta oculta (no); sin el campo, lo de Configuración
function pdfClean(v) {
  if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !v.name) return null;
  const ann = annClean(v.ann), from = annStr(v.from, 80), vid = typeof v.vid === 'string' && /^[\w-]{6,200}$/.test(v.vid) ? v.vid : '';
  return {name: v.name.slice(0, 260), ...(pdfPage(v.page) ? {page: pdfPage(v.page)} : {}), ...(ann.length ? {ann} : {}), ...(PDF_VIS.has(v.vis) ? {vis: v.vis} : {}), ...(vid ? {vid} : {}), ...(from ? {from} : {})};
}
function inboxClean(l) {   // bandeja «PDF por citar»: PDF sin paper todavía
  if (!Array.isArray(l)) return []; const seen = new Set();
  return l.map(x => { if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^[a-z0-9]{4,40}$/.test(x.id) || seen.has(x.id)) return null; seen.add(x.id);
    const p = pdfClean(x); if (!p) return null; const doi = annStr(x.doi, 200), guess = annStr(x.guess, 400);
    return {id: x.id, ...p, ...(doi ? {doi} : {}), ...(guess ? {guess} : {}), at: annStr(x.at, 40), up: annStr(x.up, 40)}; }).filter(Boolean).slice(0, 2000);
}
/* ===== Eventos de la interfaz =====
   El HTML no lleva onclick en línea (la CSP de index.html los bloquea): cada elemento dice qué hacer en data-on<evento>, p. ej. data-onclick="openPaper('p1')".
   Ese texto no se evalúa como JavaScript: lo lee onParse, un minilenguaje de llamadas y lecturas separadas por «;» (a.b(args).c(), 'texto', "texto",
   números, true/false/null, [listas], this = el elemento, event = el evento, y ! o + delante). Los nombres se buscan en ON_VARS (app.js) y, si no, entre las funciones de la aplicación (ver onFn). */
const ON_EV = ['click', 'change', 'input', 'keydown', 'contextmenu', 'mousedown', 'pointerdown', 'dblclick', 'toggle', 'error'], ON_CAPT = new Set(['toggle', 'error']);   // toggle y error no burbujean
const ON_AST = new Map();
let TYPING = false;   // dentro de un data-oninput (se está escribiendo): la copia para deshacer se hace al parar, no en cada tecla (ver markDirty)
function onParse(src) {
  let i = 0; const s = src, bad = () => { throw new SyntaxError(`data-on no válido (posición ${i}): ${s}`); };
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; }, eat = c => { ws(); if (s[i] === c) { i++; return true; } return false; };
  const str = () => { const q = s[i++]; let o = ''; while (i < s.length && s[i] !== q) { if (s[i] === '\\') { i++; o += {n: '\n', t: '\t'}[s[i]] ?? s[i]; } else o += s[i]; i++; } if (s[i++] !== q) bad(); return o; };
  const id = () => { ws(); const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i)); if (!m) bad(); i += m[0].length; return m[0]; };
  const args = () => { const a = []; if (eat(')')) return a; do a.push(expr()); while (eat(',')); if (!eat(')')) bad(); return a; };
  function expr() {
    ws(); const c = s[i];
    if (c === '!') { i++; return {t: 'not', e: expr()}; }
    if (c === '+') { i++; return {t: 'num', e: expr()}; }
    if (c === '-' || /\d/.test(c)) { const m = /^-?\d+(\.\d+)?/.exec(s.slice(i)); if (!m) bad(); i += m[0].length; return {t: 'lit', v: +m[0]}; }
    if (c === "'" || c === '"') return {t: 'lit', v: str()};
    if (c === '[') { i++; const a = []; if (!eat(']')) { do a.push(expr()); while (eat(',')); if (!eat(']')) bad(); } return {t: 'arr', a}; }
    const root = id(); if (root === 'true' || root === 'false' || root === 'null') return {t: 'lit', v: root === 'null' ? null : root === 'true'};
    const ops = []; for (;;) { if (eat('.')) ops.push({p: id()}); else if (eat('(')) ops.push({a: args()}); else break; }
    return {t: 'ref', root, ops};
  }
  const out = []; do { ws(); if (i < s.length) out.push(expr()); } while (eat(';')); ws(); if (i < s.length) bad();
  return out;
}
/* Defensa en profundidad: un data-on solo llama a funciones de la aplicación (o a lo que da ON_VARS). Ni window, ni document, ni el almacenamiento,
   ni funciones del navegador (fetch, eval…): aunque un texto ajeno llegara a un data-on, no podría leer la sesión ni enviar nada fuera. */
const ON_NAT = /\{\s*\[native code\]\s*\}\s*$/;
const onFn = k => { const f = Object.hasOwn(window, k) ? window[k] : undefined; return typeof f === 'function' && !ON_NAT.test(Function.prototype.toString.call(f)) ? f : undefined; };
const onBad = v => v === window || v === document || v === Function || typeof Storage === 'function' && v instanceof Storage || typeof Window === 'function' && v instanceof Window || typeof Document === 'function' && v instanceof Document;
function onEval(n, el, ev) {
  if (n.t === 'lit') return n.v;
  if (n.t === 'not') return !onEval(n.e, el, ev);
  if (n.t === 'num') return +onEval(n.e, el, ev);
  if (n.t === 'arr') return n.a.map(x => onEval(x, el, ev));
  let self, v = n.root === 'this' ? el : n.root === 'event' ? ev : Object.hasOwn(ON_VARS, n.root) ? ON_VARS[n.root] : onFn(n.root);
  if (v === undefined && n.root !== 'this') throw new ReferenceError(`data-on: «${n.root}» no existe`);
  for (const o of n.ops) { if (o.p) { self = v; v = v[o.p]; if (onBad(v)) throw new ReferenceError(`data-on: «${o.p}» no se puede usar`); } else { v = v.apply(self, o.a.map(x => onEval(x, el, ev))); self = undefined; if (onBad(v)) throw new ReferenceError('data-on: resultado no permitido'); } }
  return v;
}
const onRun = (src, el, ev) => { let a = ON_AST.get(src); if (!a) ON_AST.set(src, a = onParse(src)); for (const n of a) onEval(n, el, ev); };
for (const type of ON_EV) document.addEventListener(type, e => {   // se registra antes que ningún otro: así va primero, como iban los onclick en línea
  const at = 'data-on' + type;
  for (let el = e.target instanceof Element ? e.target : e.target?.parentElement; el; el = ON_CAPT.has(type) ? null : el.parentElement) {
    const src = el.getAttribute(at); if (src === null) continue;
    const ev = new Proxy(e, {get: (t, k) => k === 'currentTarget' ? el : typeof t[k] === 'function' ? t[k].bind(t) : t[k]});   // como en línea: currentTarget es el elemento
    try { TYPING = type === 'input'; onRun(src, el, ev); } catch (x) { console.error(x); } finally { TYPING = false; }
    if (e.cancelBubble) { e.stopImmediatePropagation(); break; }   // stopPropagation() en un manejador también para a los demás oyentes del documento
  }
}, ON_CAPT.has(type));
