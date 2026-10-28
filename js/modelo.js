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
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const SC_NAMES = {open: 'Abrir archivo', save: 'Guardar', find: 'Buscar', newPaper: 'Nuevo paper', undo: 'Deshacer', redo: 'Rehacer', exportCites: 'Exportar citas', import: 'Importar referencias', bold: 'Negrita (dentro de una nota)', italic: 'Cursiva (dentro de una nota)'};
// Alt+N en lugar de Ctrl+N: Chrome reserva Ctrl+N, Ctrl+T y Ctrl+W y no permite cambiarlos
const SC_DEF = {open: 'Ctrl+O', save: 'Ctrl+S', find: 'Ctrl+F', newPaper: 'Alt+N', undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z', exportCites: 'Ctrl+Shift+E', import: 'Alt+I', bold: 'Ctrl+B', italic: 'Ctrl+I'};
const TRASH_DAYS = 5;   // días que un paper eliminado permanece en la papelera
const trashLeft = t => Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - new Date(t.at)) / 864e5));
const TPL_DEF = [   // plantillas de nota de serie; {fecha} y {paper} se sustituyen al insertarlas
  {id: 't_res', name: 'Resumen del paper', text: '**Objetivo:** \n**Método:** \n**Resultados:** \n**Limitaciones:** '},
  {id: 't_cit', name: 'Cita textual', text: '**Cita:** \n**Página:** \n**Comentario:** '},
  {id: 't_ide', name: 'Idea propia', text: '**Idea:** \n**Relación con mi tema:** \n**Siguiente paso:** '}];
const defSettings = () => ({palette: 'azul', appName: 'Papers', showFile: true, showImg: true, showProgress: false, pdfDrive: false, customTypes: [], customStyles: [], mainStyle: 'apa', citeOnlyMain: false, shortcuts: {...SC_DEF}, fmtOpen: false, view: 'cards', templates: TPL_DEF.map(t => ({...t})), export: {fmt: 'txt', style: 'apa', order: 'auto', num: false, notes: false, particles: false, title: '', lang: 'es', dateFmt: 'long', vanAll: false, ppChap: true, numFmt: 'auto', disamb: true, abbrList: true, inText: false}});   // ajustes por defecto (se guardan en el JSON)
let db = {version: 1, sections: [], tags: [], papers: [], trash: [], settings: defSettings()}, path = null, dirty = false, auto = false, D, tab = 'data', MG, timer;
const F = {q: '', sorts: [{k: 'title', d: 1}], group: false, sec: '', tags: new Set(), read: '', minRating: 0, inNotes: false, mode: 'any', tbSec: false, tbTag: true, exTags: new Set(), noTag: false, noSec: false, yFrom: 0, yTo: 0};   // exTags: etiquetas excluidas · noTag / noSec: solo papers sin etiquetas / sin sección · yFrom, yTo: años (0 = sin límite)
const SEL = new Set();   // ids de papers seleccionados
const READ = {por_leer: 'Por leer', leyendo: 'Leyendo', leido: 'Leído'};   // estado de lectura (único por paper)
const READ_N = {por_leer: 0, leyendo: 1, leido: 2}, READ_C = {por_leer: '#888888', leyendo: '#2457c5', leido: '#27ae60'};
const SORTS = {created: 'Fecha de creación', modified: 'Última modificación', title: 'Título', author: 'Autor', year: 'Año', venue: 'Revista/editorial', accessed: 'Fecha de consulta', reading: 'Estado de lectura', rating: 'Valoración'};
const KEY = {created: p => p.created || '', modified: p => p.modified || p.created || '', title: p => p.alias || p.title, author: p => p.authors[0] || '',
  year: p => +p.year || 0, venue: p => p.venue || '', accessed: p => p.accessed || '', reading: p => READ_N[p.reading] ?? 0, rating: p => p.rating || 0};
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
  venue: {prensa: 'Periódico o medio', blog: 'Nombre del blog', informe: 'Institución o editorial', norma: 'Organismo de normalización (p. ej. International Organization for Standardization (ISO))', patente: 'Titular o solicitante', mapa: 'Editor o impresor', dataset: 'Repositorio o editor',
    software: 'Empresa, editor o repositorio', basedatos: 'Editor o institución', audiovisual: 'Productora o distribuidora', audio: 'Discográfica, plataforma o productora', redsocial: 'Red social (Instagram, X, Facebook…)', ia: 'Empresa (OpenAI, Google…)',
    diccionario: 'Obra de referencia (diccionario o enciclopedia)', presentacion: 'Plataforma o repositorio', personal: 'Contexto (opcional)', legislacion: 'Publicación oficial (BOE, DOUE…)', jurisprudencia: 'Tribunal u órgano (p. ej. Tribunal Supremo)'},
  title: {legislacion: 'Título completo y exacto de la norma * (p. ej. Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público)', jurisprudencia: 'Caso o partes * (p. ej. Rubio dos Amantes contra España; si no hay, la identificación: STS 1229/2017)'},
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
const IMG_RX = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function imgOk(i) {   // imagen del paper: URL, archivo local enlazado (solo el nombre; el enlace vive en este navegador) o copia reducida incrustada
  if (!i || typeof i !== 'object') return null;
  if (i.kind === 'url' && /^https?:\/\//i.test(i.url)) return {kind: 'url', url: i.url};
  if (i.kind === 'data' && typeof i.data === 'string' && i.data.length < 600000 && IMG_RX.test(i.data)) return {kind: 'data', data: i.data};
  if (i.kind === 'file' && typeof i.name === 'string' && i.name) return {kind: 'file', name: i.name};
  return null;
}
function NEWF(p) {   // rellena los campos nuevos de un paper (JSON antiguo, importados, papelera) sin tocar los existentes
  for (const k of STR_F) p[k] = typeof p[k] === 'string' ? p[k] : '';
  p.editors = Array.isArray(p.editors) ? p.editors.filter(x => typeof x === 'string' && x.trim()) : [];
  p.authorType = Object.hasOwn(AUTH_T, p.authorType) ? p.authorType : 'auto';
  p.linkMode = Object.hasOwn(LINK_MODES, p.linkMode) ? p.linkMode : 'auto'; p.hideAccessed = !!p.hideAccessed; p.image = imgOk(p.image);
  p.pdf = p.pdf && typeof p.pdf === 'object' && typeof p.pdf.name === 'string' && p.pdf.name ? {name: p.pdf.name.slice(0, 260), ...(pdfPage(p.pdf.page) ? {page: pdfPage(p.pdf.page)} : {})} : null;
  return p;
}
/* ===== Eventos de la interfaz =====
   El HTML no lleva onclick en línea (la CSP de index.html los bloquea): cada elemento dice qué hacer en data-on<evento>, p. ej. data-onclick="openPaper('p1')".
   Ese texto no se evalúa como JavaScript: lo lee onParse, un minilenguaje de llamadas y lecturas separadas por «;» (a.b(args).c(), 'texto', "texto",
   números, true/false/null, [listas], this = el elemento, event = el evento, y ! o + delante). Los nombres se buscan en ON_VARS (app.js) y, si no, en window. */
const ON_EV = ['click', 'change', 'input', 'keydown', 'contextmenu', 'mousedown', 'toggle', 'error'], ON_CAPT = new Set(['toggle', 'error']);   // toggle y error no burbujean
const ON_AST = new Map();
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
function onEval(n, el, ev) {
  if (n.t === 'lit') return n.v;
  if (n.t === 'not') return !onEval(n.e, el, ev);
  if (n.t === 'num') return +onEval(n.e, el, ev);
  if (n.t === 'arr') return n.a.map(x => onEval(x, el, ev));
  let self, v = n.root === 'this' ? el : n.root === 'event' ? ev : n.root in ON_VARS ? ON_VARS[n.root] : window[n.root];
  if (v === undefined && n.root !== 'this') throw new ReferenceError(`data-on: «${n.root}» no existe`);
  for (const o of n.ops) { if (o.p) { self = v; v = v[o.p]; } else { v = v.apply(self, o.a.map(x => onEval(x, el, ev))); self = undefined; } }
  return v;
}
const onRun = (src, el, ev) => { let a = ON_AST.get(src); if (!a) ON_AST.set(src, a = onParse(src)); for (const n of a) onEval(n, el, ev); };
for (const type of ON_EV) document.addEventListener(type, e => {   // se registra antes que ningún otro: así va primero, como iban los onclick en línea
  const at = 'data-on' + type;
  for (let el = e.target instanceof Element ? e.target : e.target?.parentElement; el; el = ON_CAPT.has(type) ? null : el.parentElement) {
    const src = el.getAttribute(at); if (src === null) continue;
    const ev = new Proxy(e, {get: (t, k) => k === 'currentTarget' ? el : typeof t[k] === 'function' ? t[k].bind(t) : t[k]});   // como en línea: currentTarget es el elemento
    try { onRun(src, el, ev); } catch (x) { console.error(x); }
    if (e.cancelBubble) { e.stopImmediatePropagation(); break; }   // stopPropagation() en un manejador también para a los demás oyentes del documento
  }
}, ON_CAPT.has(type));
