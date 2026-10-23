'use strict';
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
const defSettings = () => ({palette: 'azul', appName: 'Papers', showFile: true, showImg: true, customTypes: [], customStyles: [], shortcuts: {...SC_DEF}, fmtOpen: false, view: 'cards', templates: TPL_DEF.map(t => ({...t})), export: {fmt: 'txt', style: 'apa', order: 'auto', num: false, notes: false, particles: false, title: '', lang: 'es', dateFmt: 'long', vanAll: false, ppChap: true, numFmt: 'auto', disamb: true, inText: false}});   // ajustes por defecto (se guardan en el JSON)
let db = {version: 1, sections: [], tags: [], papers: [], trash: [], settings: defSettings()}, path = null, dirty = false, auto = false, D, tab = 'data', MG, timer;
const F = {q: '', sorts: [{k: 'title', d: 1}], group: false, sec: '', tags: new Set(), read: '', minRating: 0, inNotes: false, mode: 'any', tbSec: false, tbTag: true};
const SEL = new Set();   // ids de papers seleccionados
const READ = {por_leer: 'Por leer', leyendo: 'Leyendo', leido: 'Leído'};   // estado de lectura (único por paper)
const READ_N = {por_leer: 0, leyendo: 1, leido: 2}, READ_C = {por_leer: '#888888', leyendo: '#2457c5', leido: '#27ae60'};
const SORTS = {created: 'Fecha de creación', modified: 'Última modificación', title: 'Título', author: 'Autor', year: 'Año', venue: 'Revista/editorial', accessed: 'Fecha de consulta', reading: 'Estado de lectura', rating: 'Valoración'};
const KEY = {created: p => p.created || '', modified: p => p.modified || p.created || '', title: p => p.alias || p.title, author: p => p.authors[0] || '',
  year: p => +p.year || 0, venue: p => p.venue || '', accessed: p => p.accessed || '', reading: p => READ_N[p.reading] ?? 0, rating: p => p.rating || 0};
const TYPES = {articulo: 'Artículo de revista', libro: 'Libro', capitulo: 'Capítulo', congreso: 'Congreso', tesis: 'Tesis', web: 'Página web', prensa: 'Artículo de prensa', blog: 'Entrada de blog',
  informe: 'Informe', norma: 'Norma técnica', patente: 'Patente', mapa: 'Mapa', dataset: 'Conjunto de datos', software: 'Software o videojuego', basedatos: 'Base de datos', audiovisual: 'Audiovisual (película, serie, vídeo)',
  audio: 'Audio (podcast, canción)', redsocial: 'Publicación en red social', ia: 'IA generativa', diccionario: 'Entrada de diccionario o enciclopedia', presentacion: 'Presentación', personal: 'Comunicación personal', legislacion: 'Legislación'};
const LINK_MODES = {auto: 'Automático (DOI si hay; si no, URL)', doi: 'Solo DOI', url: 'Solo URL (Disponible en)', none: 'Ninguno'};   // enlace que se escribe en la cita
const AUTH_T = {auto: 'Automático', persona: 'Persona', entidad: 'Entidad (organización)', sin_autor: 'Sin autor'};
const THESIS = ['Tesis doctoral', 'Trabajo fin de grado', 'Trabajo fin de máster', 'Proyecto fin de carrera'];
const STR_F = ['volume', 'issue', 'pages', 'publisher', 'place', 'edition', 'pubDate', 'thesisType',
  'isbn', 'issn', 'series', 'seriesNumber', 'institution', 'docNumber', 'conferenceName', 'conferencePlace', 'conferenceDates', 'subtype', 'authorRole', 'userHandle'];   // campos de texto (F1a y, desde F3a, los P2: aún sin plantilla de cita)
const FLD_T = {volume: ['articulo'], issue: ['articulo', 'legislacion'], pages: ['articulo', 'capitulo', 'congreso', 'prensa', 'legislacion', 'diccionario'], publisher: ['capitulo', 'congreso'],
  place: ['libro', 'capitulo', 'congreso', 'tesis', 'web', 'informe', 'norma', 'patente', 'mapa', 'software', 'basedatos', 'audiovisual', 'legislacion'],
  edition: ['libro', 'norma', 'mapa', 'dataset', 'software', 'ia', 'diccionario'], editors: ['capitulo'],
  pubDate: ['articulo', 'web', 'prensa', 'blog', 'informe', 'norma', 'patente', 'dataset', 'software', 'audiovisual', 'audio', 'redsocial', 'ia', 'presentacion', 'personal', 'legislacion'], thesisType: ['tesis'],
  isbn: ['libro'], issn: ['articulo'], institution: ['tesis'], series: ['informe', 'mapa', 'audiovisual', 'audio', 'ia'], seriesNumber: ['informe', 'mapa', 'audiovisual', 'audio'], docNumber: ['informe', 'norma', 'patente', 'mapa', 'legislacion'],
  conferenceName: [], conferencePlace: [], conferenceDates: [],
  subtype: ['mapa', 'dataset', 'software', 'audiovisual', 'audio', 'redsocial', 'ia', 'presentacion', 'personal'], authorRole: ['audiovisual', 'audio'], userHandle: ['redsocial']};   // en qué tipos se muestra cada campo en el formulario (F3a–F3e)
// etiquetas del formulario según el tipo (si no hay entrada, se usa la genérica)
const FLBL = {
  venue: {prensa: 'Periódico o medio', blog: 'Nombre del blog', informe: 'Institución o editorial', norma: 'Organismo de normalización (p. ej. International Organization for Standardization (ISO))', patente: 'Titular o solicitante', mapa: 'Editor o impresor', dataset: 'Repositorio o editor',
    software: 'Empresa, editor o repositorio', basedatos: 'Editor o institución', audiovisual: 'Productora o distribuidora', audio: 'Discográfica, plataforma o productora', redsocial: 'Red social (Instagram, X, Facebook…)', ia: 'Empresa (OpenAI, Google…)',
    diccionario: 'Obra de referencia (diccionario o enciclopedia)', presentacion: 'Plataforma o repositorio', personal: 'Contexto (opcional)', legislacion: 'Publicación oficial (BOE, DOUE…)'},
  docNumber: {informe: 'Número o código del informe (p. ej. NIH Publication No. 18-2059)', norma: 'Código de la norma (p. ej. ISO 690:2010)', patente: 'Número de la patente', mapa: 'Escala (p. ej. 1:8.000.000)', legislacion: 'Código o referencia (p. ej. RCL 2018\\1629)'},
  edition: {norma: 'Edición o estado (p. ej. completa)', mapa: 'Edición o versión', dataset: 'Versión', software: 'Versión', ia: 'Versión (p. ej. versión del 13 de febrero)', diccionario: 'Edición (desde la 2.ª)'},
  place: {patente: 'País (p. ej. US, ES)', legislacion: 'Ámbito territorial (p. ej. España)'},
  series: {informe: 'Serie (p. ej. Documentos de trabajo)', mapa: 'Serie del mapa', audiovisual: 'Serie o programa (si es un episodio)', audio: 'Disco o programa (podcast)', ia: 'Herramienta (p. ej. ChatGPT)'},
  seriesNumber: {informe: 'Número en la serie', mapa: 'Designación de la serie', audiovisual: 'Temporada y episodio (p. ej. Temporada 6, Episodio 5)', audio: 'Número del episodio'},
  pubDate: {articulo: 'Fecha de publicación (se usa solo el mes: Chicago, IEEE)', norma: 'Fecha de aprobación', patente: 'Fecha de concesión', personal: 'Fecha exacta', legislacion: 'Fecha de publicación'},
  issue: {legislacion: 'Número del boletín'}};
const FSUB = {mapa: ['Mapa'], dataset: ['Dataset', 'Conjunto de datos'], software: ['Software', 'Videojuego', 'Programa', 'Aplicación'], audiovisual: ['Película', 'Serie de TV', 'Capítulo de serie de televisión', 'Video'], audio: ['Audio podcast', 'Episodio de audio podcast', 'Canción'],
  redsocial: ['Post de X', 'Fotografía', 'Video', 'Actualización de estado', 'Historia de Instagram'], ia: ['Modelo de lenguaje de gran tamaño', 'Chat de IA generativa'], presentacion: ['Presentación de PowerPoint', 'Conferencia'], personal: ['Correo electrónico', 'Entrevista', 'Carta', 'Mensaje', 'Llamada telefónica']};
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
  return p;
}

/* ===== Citas (extensible: añade una entrada a STYLES) =====
   Cada fn(p, o) devuelve la cita con marcas: *cursiva* y **negrita** (igual que las notas); un asterisco literal
   se escribe \*. txt y vista previa quitan las marcas (citeTxt); Word y «Copiar con formato» las convierten (citeHtml).
   `o` son las opciones de exportación (settings.export): lang, dateFmt, vanAll… */
const parse = a => a.map(x => { x = x.trim(); const i = x.indexOf(',');
  return i < 0 ? {l: x.split(' ').pop(), g: x.split(' ').slice(0, -1).join(' ')} : {l: x.slice(0, i).trim(), g: x.slice(i + 1).trim()}; });
// iniciales: con punto «N. G.» (guion: «S.-Y.»); sin punto «NG» (Vancouver). Acepta nombres ya abreviados («J.C.»)
const ini = (g, dot) => g.replace(/(\p{Lu})\.(?=\p{L})/gu, '$1. ').split(/\s+/).filter(Boolean)
  .map(w => w.split('-').filter(x => /\p{L}/u.test(x)).map(x => x[0].toUpperCase() + (dot ? '.' : '')).join(dot ? '-' : '')).filter(Boolean).join(dot ? ' ' : '');
const ea = s => String(s ?? '').replace(/\*/g, '\\*');   // escapa los asteriscos de los datos
const it = s => s ? '*' + s + '*' : '';
const endDot = s => !s || /[.?!…]\*?$/.test(s) ? s : s + '.';
const citeTxt = s => String(s ?? '').replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\u0001/g, '*');
const citeHtml = s => esc(s).replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\u0001/g, '*');
// Autor entidad (provisional hasta tener el campo authorType): sin coma y con una palabra típica de organización, o siglas en mayúsculas
const ORG_RX = /(?<!\p{L})(organi[sz]aci[oó]n|organi[sz]ation|asociaci[oó]n|association|academia|academy|instituto|institute|instituci[oó]n|universidad|university|ministerio|ministry|sociedad|society|agencia|agency|fundaci[oó]n|foundation|comisi[oó]n|commission|comit[eé]|committee|consejo|council|departamento|department|centro|center|centre|servicio|ayuntamiento|federaci[oó]n|federation|corporaci[oó]n|corporation|laboratorio|laboratory|hospital|naciones|nations|gobierno|government|banco|world|national|nacional|inc|ltd|llc|gmbh)(?!\p{L})/iu;
const isOrg = s => !s.includes(',') && (ORG_RX.test(s) || /^[\p{Lu}0-9&.\-]{2,}$/u.test(s));
const pAuth = (a, t = 'auto') => t === 'sin_autor' ? [] : a.map(x => { x = x.trim();   // t = authorType del paper
  return t === 'entidad' || (t !== 'persona' && isOrg(x)) ? {l: x, g: '', org: true} : parse([x])[0]; });
const pAuthP = p => pAuth(p.authors, p.authorType);
// enlace de la cita según p.linkMode (por defecto automático: DOI y, si no hay, URL)
const citeLink = p => { const m = p.linkMode || 'auto', d = p.doi ? 'https://doi.org/' + normDoi(p.doi) : '', u = p.url || '';
  return m === 'none' ? '' : m === 'doi' ? d : m === 'url' ? u : d || u; };
const MES = {es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']};
function fdate(s, o) {   // fecha de consulta (aaaa-mm-dd) según la opción dateFmt
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return s || '';
  const [, y, mo, d] = m, i = +mo - 1; if (i < 0 || i > 11 || o.dateFmt === 'iso') return s;
  if (o.dateFmt === 'dmy') return `${d}-${mo}-${y}`;
  return o.lang === 'en' ? `${y} ${MES.en[i]} ${+d}` : `${+d} de ${MES.es[i]} de ${y}`;
}
const L10 = {   // conectores y etiquetas según la opción lang
  es: {and: 'y', in: 'En', cons: 'consultado', avail: 'Disponible en', sd: 's.f.', conf: 'Comunicación en congreso', thesis: 'Tesis', thesisNet: 'Tesis en Internet', eds: ['editor', 'editores']},
  en: {and: '&', in: 'In', cons: 'cited', avail: 'Available from', sd: 'n.d.', conf: 'Paper presentation', thesis: 'Thesis', thesisNet: 'Thesis on the Internet', eds: ['editor', 'editors']}};
const MESF = {es: MES.es, en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']};
const okDate = s => /^(\d{4})-(\d{2})-(\d{2})$/.test(s || '') && +s.slice(5, 7) >= 1 && +s.slice(5, 7) <= 12;
const NEWS = p => p.type === 'prensa' || p.type === 'blog';   // F3b: tipos con fecha completa (día, mes, año)
const fdOk = p => okDate(p.pubDate) && (!p.year || p.pubDate.slice(0, 4) === String(p.year));   // fecha completa utilizable: si el año no coincide con «year», manda el año
const apaDate = (s, o) => { const [y, m, d] = s.split('-'), mo = MESF[o.lang === 'en' ? 'en' : 'es'][+m - 1], Y = y + (o.ys || '');   // (24 de octubre, 2017) · (2017, October 24)
  return o.lang === 'en' ? `${Y}, ${mo} ${+d}` : `${+d} de ${mo}, ${Y}`; };
const edLbl = (e, lang) => { e = String(e ?? '').trim(); if (!e) return '';   // edición: «2» → «2.ª ed.» / «2nd ed.»; texto libre → se añade «ed.»
  if (/^\d+$/.test(e)) { const n = +e; return n < 2 ? '' : lang === 'en' ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : {1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'} ed.` : `${n}.ª ed.`; }
  return /\bed\.?$/i.test(e) ? e : e + ' ed.'; };
const pgs = (s, pp) => { s = String(s ?? '').trim(); return !s ? '' : pp ? (/^\d+$|^[A-Za-z]?\d+$/.test(s) ? 'p. ' : 'pp. ') + s : s; };   // páginas con o sin «p.»/«pp.»
const yE = l => /^(i|hi(?!e))/i.test(String(l).normalize('NFD').replace(/[̀-ͯ]/g, '')) ? ' e' : ' y';   // conjunción española: «e» ante i-/hi- (no hie-)
const yD = a => yE(a.org || !a.g ? a.l : a.g);   // autor en orden directo («Nombre Apellido»): la palabra que sigue a la conjunción es el nombre de pila
const apaJoin = (A, P, o) => {   // lista de autores/editores APA: «A», «A y B», «A, B y C» (en inglés «, &»)
  if (A.length < 2) return A[0] || '';
  const c = o.lang === 'en' ? ', &' : yE(P.at(-1).l);   // «e» ante i-/hi-
  return A.slice(0, -1).join(', ') + c + ' ' + A.at(-1); };
const hasFull = g => g.split(/\s+/).some(w => !/^(\p{Lu}\.?)(-?\p{Lu}\.?)*$/u.test(w));   // ¿el nombre tiene alguna palabra que no sea inicial?
const apaFn = (p, o, full) => {   // full = variante 2: nombre completo entre corchetes tras las iniciales
    const L = L10[o.lang] || L10.es, P = pAuthP(p);
    const A = P.map(a => a.org ? ea(a.l) : a.g ? `${ea(a.l)}, ${ini(a.g, 1)}${full && hasFull(a.g) ? ` [${ea(a.g)}]` : ''}` : ea(a.l));
    let au = A[0] || '';
    if (A.length > 20) au = A.slice(0, 19).join(', ') + ', . . . ' + A.at(-1);
    else au = apaJoin(A, P, o);
    if (P.at(-1)?.org) au = endDot(au);
    const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = citeLink(p);
    const Y = (p.type === 'web' ? okDate(p.pubDate) : NEWS(p) && fdOk(p)) ? apaDate(p.pubDate, o) : p.year ? p.year + (o.ys || '') : L.sd + (o.ys ? '-' + o.ys : '');   // o.ys = letra de desambiguación (2020a)
    let t = ['libro', 'tesis', 'web', 'congreso'].includes(p.type) ? it(T) : T, rest;   // título en cursiva en obras independientes
    if (p.type === 'libro' && edLbl(p.edition, o.lang)) t += ` (${ea(edLbl(p.edition, o.lang))})`;
    if (p.type === 'congreso') t += ` [${L.conf}]`;
    if (p.type === 'tesis') { const tt = ea(p.thesisType || L.thesis); t += ` [${V ? tt + ', ' + V : tt}]`; }
    if (p.type === 'libro' || p.type === 'web') rest = [endDot(V)];
    else if (p.type === 'capitulo') {   // En I. Apellido (Ed.), *Libro* (pp. x-y). Editorial.
      const E = pAuth(p.editors || []), eds = apaJoin(E.map(e => e.org || !e.g ? ea(e.l) : `${ini(e.g, 1)} ${ea(e.l)}`), E, o), pg = pgs(ea(p.pages), o.ppChap !== false);
      rest = [V ? endDot(`${L.in} ${eds ? `${eds} (${E.length > 1 ? 'Eds.' : 'Ed.'}), ` : ''}${it(V)}${pg ? ` (${pg})` : ''}`) : '', endDot(ea(p.publisher || ''))]; }
    else if (p.type === 'congreso') rest = [endDot([V, ea(p.place || '')].filter(Boolean).join(', '))];
    else if (p.type === 'tesis') rest = [];
    else if (p.type === 'prensa') rest = link ? [endDot(it(V))] : [endDot([V ? it(V) : '', ea(p.pages || '')].filter(Boolean).join(', '))];   // digital: *Periódico*. url · impresa (sin enlace): *Periódico*, B5.
    else if (p.type === 'blog') rest = [endDot(it(V))];   // título del post sin cursiva, blog en cursiva
    else {   // artículo (y tipo desconocido): *Revista*, *vol*(núm), pp-pp
      const vi = [p.volume ? it(ea(p.volume)) : '', p.issue ? `(${ea(p.issue)})` : ''].join('');
      rest = [endDot([V ? it(V) : '', vi, ea(p.pages || '')].filter(Boolean).join(', '))]; }
    return [au ? `${au} (${Y}).` : `${endDot(t)} (${Y}).`, au ? endDot(t) : '', ...rest, p.type === 'prensa' && !link ? '' : link].filter(Boolean).join(' ').trim(); };
const vanFn = (p, o, full) => {   // full = variante 2: «Apellido, Nombre» separados por «;»
    const L = L10[o.lang] || L10.es;
    const nm = a => a.org ? ea(a.l) : full ? `${ea(a.l)}${a.g ? ', ' + ea(a.g) : ''}` : `${ea(a.l)}${a.g ? ' ' + ini(a.g) : ''}`, sp = full ? '; ' : ', ';
    const A = pAuthP(p).map(nm);
    const au = !o.vanAll && A.length > 6 ? A.slice(0, 6).join(sp) + sp + 'et al' : A.join(sp);
    const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = citeLink(p);
    const online = !!link || p.type === 'web' || p.type === 'blog', net = online ? ' [Internet]' : '';
    const yr = (p.type === 'web' ? okDate(p.pubDate) : NEWS(p) && fdOk(p)) ? fdate(p.pubDate, o) : p.year;
    const cons = online && p.accessed && !p.hideAccessed ? `[${L.cons} ${fdate(p.accessed, o)}]` : '';
    const dat = [yr, cons].filter(Boolean).join(' ');   // «2021 [consultado …]»
    const ed = edLbl(p.edition, o.lang), plc = ea(p.place || ''), pb = ea(p.publisher || '');
    const join = (a, b, sep) => a && b ? a + sep + b : a || b;
    const pubOf = pubr => { const lp = join(plc, pubr, ': '); return join(lp, dat, '; '); };   // «Lugar: Editorial; año [consultado …]»
    let b;
    if (p.type === 'libro' || p.type === 'web') b = [endDot(T + net), ed && p.type === 'libro' ? endDot(ea(ed)) : '', endDot(pubOf(V))];
    else if (p.type === 'tesis') { const tt = p.thesisType ? p.thesisType[0].toLowerCase() + p.thesisType.slice(1) : '';
      b = [endDot(`${T} [${tt ? ea(tt) + (online ? ' en Internet' : '') : online ? L.thesisNet : L.thesis}]`), endDot(pubOf(V))]; }
    else if (p.type === 'blog') b = [endDot(T), dat ? endDot(dat) : '', V ? endDot(`${L.in}: ${V}${net}`) : ''];   // contribución: Autor. Título. fecha [consultado …]. En: Blog [Internet].
    else if (p.type === 'capitulo' || p.type === 'congreso') {
      const E = pAuth(p.editors || []).map(nm), w = L.eds[E.length > 1 ? 1 : 0], pg = ea(p.pages || '');
      const cont = V ? endDot(`${L.in}: ${E.length ? E.join(sp) + ', ' + w + '. ' : ''}${V}${net}`) : '';
      b = [endDot(T), cont, endDot(pubOf(pb)), pg ? endDot(`p. ${pg}`) : '']; }
    else {   // artículo: Revista [Internet]. año [consultado …]; vol(núm):pp-pp.
      const vol = p.volume ? ea(p.volume) + (p.issue ? `(${ea(p.issue)})` : '') : p.issue ? `(${ea(p.issue)})` : '', vp = vol + (p.pages ? (vol ? ':' : '') + ea(p.pages) : '');   // sin volumen no hay «:» huérfano (prensa: 2017;B5)
      const sep = cons ? '; ' : ';';
      b = [endDot(T), V ? endDot(V + net) : '', endDot(vp ? (dat ? dat + sep + vp : vp) : dat)]; }
    return [endDot(au), ...b, link && `${L.avail}: ${link}`].filter(Boolean).join(' ').trim(); };

// ---- MLA 8.ª/9.ª (F2a): Autor. Título. Contenedor, colaboradores, versión, número, editorial, fecha, localización.
const MLA_M = {es: ['ene.', 'feb.', 'mar.', 'abr.', 'mayo', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'], en: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']};
const mlaPub = (s, o) => { const [y, m, d] = s.split('-'); return `${+d} ${MLA_M[o.lang === 'en' ? 'en' : 'es'][+m - 1]} ${y}`; };   // 28 Nov. 2003 (meses abreviados; verificar en español)
const mlaLong = (s, o) => o.lang === 'en' ? mlaPub(s, o) : `${+s.slice(8)} de ${MES.es[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;   // prensa y blog: «22 de octubre de 2020» (guía MLA-BLOG) / «22 Oct. 2020»
const mlaAcc = (s, o) => okDate(s) && o.lang === 'en' && (o.dateFmt || 'long') === 'long' ? mlaPub(s, o) : fdate(s, o);   // fecha de consulta: 20 Oct. 2026 / 20 de octubre de 2026
const mlaLink = p => { const l = citeLink(p); return /^https?:\/\/(dx\.)?doi\.org\//i.test(l) ? l : l.replace(/^https?:\/\//i, ''); };   // se quita https:// de las URL, no de los DOI
const mlaFn = (p, o) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase();
  const inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
  let A = pAuthP(p);
  if ((p.type === 'libro' || p.type === 'web') && A.length === 1 && A[0].org && norm(A[0].l) === norm(p.venue)) A = [];   // entidad = editorial/sitio: se empieza por el título
  const au = A.length === 1 ? inv(A[0]) : A.length === 2 ? `${inv(A[0])}${en ? ' and' : yD(A[1])} ${dir(A[1])}` : A.length > 2 ? inv(A[0]) + ', et al.' : '';
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(mlaLink(p));
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`;   // español: punto fuera de las comillas (guía S5); inglés: dentro
  const cont = a => endDot(a.filter(Boolean).join(', '));
  const yr = p.type === 'web' && okDate(p.pubDate) ? mlaPub(p.pubDate, o) : NEWS(p) && fdOk(p) ? mlaLong(p.pubDate, o) : p.year ? String(p.year) : '';
  const acc = link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Consultado el'} ${mlaAcc(p.accessed, o)}.` : '';
  const pg = pgs(ea(p.pages), true), ed = ea(edLbl(p.edition, o.lang));
  let ti, ct;
  if (p.type === 'libro') { ti = endDot(it(T)); ct = cont([ed, V, yr, link]); }
  else if (p.type === 'tesis') { ti = endDot(it(T)); ct = cont([ea(p.thesisType || L.thesis), V, yr, link]); }
  else if (p.type === 'web' || p.type === 'blog') { ti = qt(T); ct = cont([V ? it(V) : '', yr, link]); }
  else if (p.type === 'capitulo' || (p.type === 'congreso' && (p.publisher || p.pages))) {   // actas publicadas = capítulo
    const E = pAuth(p.editors || []).map(dir), eds = E.length > 2 ? E[0] + ' et al.' : E.length === 2 ? `${E[0]}${en ? ' and' : yD(pAuth(p.editors)[1])} ${E[1]}` : E[0] || '';
    ti = qt(T); ct = cont([V ? it(V) : '', eds && `${en ? 'edited by' : 'editado por'} ${eds}`, ea(p.publisher || ''), yr, pg, link]); }
  else if (p.type === 'congreso') { ti = qt(T); ct = cont([V, yr, ea(p.place || ''), link]); }   // conferencia no impresa: evento, fecha, lugar
  else { ti = qt(T); ct = cont([V ? it(V) : '', p.volume ? `vol. ${ea(p.volume)}` : '', p.issue ? `${en ? 'no.' : 'núm.'} ${ea(p.issue)}` : '', yr, pg, link]); }   // artículo
  return [au && endDot(au), ti, ct, acc].filter(Boolean).join(' ').trim();
};

// ---- IEEE (F2b): inglés fijo, numerado. [n] I. Apellido, “Título,” Contenedor, vol., no., pp., Mes Año.
const ieeeThesis = t => { t = String(t ?? '').trim(); return !t ? 'Thesis' : /doctor|ph\.?\s?d/i.test(t) ? 'Ph.D. dissertation' : /m[aá]ster|master|\bm\.?\s?s\b/i.test(t) ? 'M.S. thesis' : /grado|bachelor|\bb\.?\s?s\b|carrera|licenciatura/i.test(t) ? 'B.S. thesis' : t; };
const ieeeFn = (p, o) => {
  const P = pAuthP(p), nm = a => a.org || !a.g ? ea(a.l) : `${ini(a.g, 1)} ${ea(a.l)}`;
  const list = (E, et) => !E.length ? '' : et && E.length > 6 ? nm(E[0]) + ' et al.' : E.length === 1 ? nm(E[0]) : E.length === 2 ? `${nm(E[0])} and ${nm(E[1])}` : E.slice(0, -1).map(nm).join(', ') + ', and ' + nm(E.at(-1));
  const au = list(P, true), lead = au ? au + ', ' : '';
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p)), yr = p.year ? String(p.year) : '';
  const my = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? `${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${p.pubDate.slice(0, 4)}` : yr;   // «June 1997»
  const dl = NEWS(p) && fdOk(p) ? `${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${+p.pubDate.slice(8)}, ${p.pubDate.slice(0, 4)}` : my;   // prensa: «October 24, 2017»
  const pg = pgs(ea(p.pages), true), plc = ea(p.place || ''), join = (a, b, sep) => a && b ? a + sep + b : a || b;
  const fin = x => /[.?!…][”*]*$/.test(x) ? x : x + '.';
  const quoted = rest => rest ? (/[?!]$/.test(T) ? `“${T}” ` : `“${T},” `) + fin(rest) : `“${fin(T)}”`;   // coma dentro de las comillas
  const onl = link ? ` [Online]. Available: ${link}` : '';
  let body;
  if (p.type === 'web' || p.type === 'blog') {   // guía: Autor. (año, Mes día). Título [Online]. Available: url (el sitio va tras el título: verificar; el blog usa la plantilla de Internet)
    const m = (p.type === 'web' ? okDate(p.pubDate) : fdOk(p)) ? `${p.pubDate.slice(0, 4)}, ${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${+p.pubDate.slice(8)}` : yr, dt = m ? `(${m}).` : '', ts = T + (V ? '. ' + V : '');
    body = au ? [fin(au), dt, ts].filter(Boolean).join(' ') : [fin(T), dt, V].filter(Boolean).join(' ');
    return link ? body.replace(/\.$/, '') + onl : fin(body); }
  if (p.type === 'libro') {
    const ed = ea(edLbl(p.edition, 'en')), tail = [join(plc, V, ': '), my].filter(Boolean).join(', ');
    body = `${lead}${ed ? it(T) + ', ' + ed : endDot(it(T))}${tail ? ' ' + fin(tail) : ''}`; }
  else if (p.type === 'tesis') body = lead + quoted([ea(ieeeThesis(p.thesisType)), V, plc, my].filter(Boolean).join(', '));
  else if (p.type === 'capitulo') {
    const E = pAuth(p.editors || []), eds = E.length ? `${list(E, false)}, ${E.length > 1 ? 'Eds.' : 'Ed.'}` : '', tail = [join(plc, ea(p.publisher || ''), ': '), my, pg].filter(Boolean).join(', ');
    body = lead + quoted(V ? `in ${it(V)}${eds ? ', ' + eds + (tail ? ' ' + tail : '') : tail ? ', ' + tail : ''}` : tail); }
  else if (p.type === 'congreso') {
    body = lead + quoted(p.publisher || p.pages ? [V && `in ${V}`, plc, my, pg].filter(Boolean).join(', ') : [V && `presented at ${V}`, plc, my].filter(Boolean).join(', ')); }   // actas publicadas / ponencia no publicada
  else if (p.type === 'prensa') body = lead + quoted([V ? it(V) : '', dl, pg].filter(Boolean).join(', '));   // «T,» *Periódico*, October 24, 2017, p. B5.
  else body = lead + quoted([V ? it(V) : '', p.volume ? `vol. ${ea(p.volume)}` : '', p.issue ? `no. ${ea(p.issue)}` : '', pg, my].filter(Boolean).join(', '));   // artículo
  return fin(body) + onl;
};

// ---- Chicago 17.ª ed. (F2c autor-fecha, F2d notas y bibliografía: af=false): lista de referencias / bibliografía
const chiAcc = (s, o) => okDate(s) && o.lang === 'en' && (o.dateFmt || 'long') === 'long' ? `${MESF.en[+s.slice(5, 7) - 1]} ${+s.slice(8)}, ${s.slice(0, 4)}` : fdate(s, o);   // May 1, 2017 / 1 de mayo de 2017
const chiLong = (s, o) => o.lang === 'en' ? `${MESF.en[+s.slice(5, 7) - 1]} ${+s.slice(8)}, ${s.slice(0, 4)}` : `${+s.slice(8)} de ${MES.es[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;   // fecha larga de publicación (no depende de dateFmt)
const chiFn = (p, o, af) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase();
  const P = pAuthP(p), inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
  const chList = (E, fst) => {   // 1.º invertido (autores) o todos directos (editores); >10 → 7 + et al.; «y»/«e» en español, «, and» en inglés
    const nm = (a, i) => i ? dir(a) : fst(a);
    if (!E.length) return ''; if (E.length > 10) return E.slice(0, 7).map(nm).join(', ') + ', et al.'; if (E.length === 1) return nm(E[0], 0);
    const c = en ? (E.length === 2 && fst === dir ? ' and' : ', and') : yD(E.at(-1));
    return E.slice(0, -1).map(nm).join(', ') + c + ' ' + nm(E.at(-1), E.length - 1); };
  const au = chList(P, inv), T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p));
  const yr = p.year ? String(p.year) : '', Y = yr ? yr + (o.ys || '') : 'n.d.' + (o.ys ? '-' + o.ys : ''), yn = af ? '' : yr;   // yn = año dentro de la entrada (notas-bibl.)
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`, join = (a, b, sep) => a && b ? a + sep + b : a || b;
  const plc = ea(p.place || ''), pb = ea(p.publisher || ''), pg = ea(p.pages || ''), cj = a => endDot(a.filter(Boolean).join(', '));
  const mon = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? MESF[en ? 'en' : 'es'][+p.pubDate.slice(5, 7) - 1] : '';   // solo el mes (guía: «(April)»)
  const acc = !yr && link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Acceso el'} ${chiAcc(p.accessed, o)}.` : '';
  let ti, ct = [];
  const actas = () => {   // capítulo o ponencia publicada en actas: En *Libro*, editado por X, páginas. Lugar: Editorial[, año].
    const E = pAuth(p.editors || []), eds = chList(E, dir);
    if (V) ct.push(endDot(`${L.in} ${it(V)}${eds ? `, ${en ? 'edited by' : 'editado por'} ${eds}` : ''}${pg ? ', ' + pg : ''}`));
    const tail = [join(plc, pb, ': '), yn].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); };
  if (p.type === 'libro') {
    ti = endDot(it(T)); const ed = ea(edLbl(p.edition, o.lang)); if (ed) ct.push(ed);
    const tail = [join(plc, V, ': '), yn].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); }
  else if (p.type === 'tesis') { ti = qt(T); ct.push(cj([ea(p.thesisType || L.thesis), V, yn])); }
  else if (p.type === 'web') { ti = qt(T); ct.push(cj([norm(V) === norm(P.length === 1 ? p.authors[0] : '') ? '' : V, yn])); }
  else if (p.type === 'capitulo') { ti = qt(T); actas(); }
  else if (p.type === 'congreso') { ti = qt(T);
    if (p.publisher || p.pages) actas(); else ct.push(cj([V && `${en ? 'Paper presented at' : 'Comunicación presentada en'} ${V}`, plc, yn])); }
  else if (NEWS(p)) {   // prensa y blog: “T.” *Medio*, 8 de marzo de 2017. url. (páginas: solo en nota, se omiten)
    ti = qt(T); const dl = fdOk(p) ? chiLong(p.pubDate, o) : af ? '' : yr; ct.push(cj([V ? it(V) : '', dl])); }
  else {   // artículo: *Revista* 111, n.º 2 (abril): 165–76
    ti = qt(T); const a1 = [V ? it(V) : '', p.volume ? ea(p.volume) : ''].filter(Boolean).join(' '), iss = p.issue ? `${a1 ? ', ' : ''}${en ? 'no.' : 'n.º'} ${ea(p.issue)}` : '';
    const dt = [mon, yn].filter(Boolean).join(' ');
    ct.push(endDot(`${a1}${iss}${dt ? ` (${dt})` : ''}${pg ? (a1 || iss || dt ? ': ' : '') + pg : ''}`)); }
  const head = af ? (au ? [endDot(au), endDot(Y), ti] : [ti, endDot(Y)]) : [au && endDot(au), ti];
  return [...head, ...ct.filter(Boolean), acc, link && endDot(link)].filter(Boolean).join(' ').trim();
};
// ---- UNE-ISO 690:2024 (F2e). nf = true: nombre-fecha (año tras el creador); nf = false: numérico (año al final). Orden de elementos DERIVADO de los ejemplos de la guía (9.2–9.3): verificar
const uneFn = (p, o, nf) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase(), UP = x => String(x).toLocaleUpperCase('es');
  const du = x => fdate(x, {...o, dateFmt: o.dateFmt === 'iso' ? 'iso' : 'dmy'});   // UNE escribe dd-mm-aaaa (o ISO); la fecha larga no se usa
  const inv = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(UP(a.l))}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`;   // APELLIDO, Nombre · Nombre APELLIDO
  const list = (E, fst) => {   // 1.º invertido (autores) o todos directos (editores); más de 3 → primero + et al.; «y»/«e» según el nombre de pila que sigue
    const f = (a, i) => i ? dir(a) : fst(a);
    if (!E.length) return ''; if (E.length > 3) return fst === dir ? `${dir(E[0])} et al.` : `${fst(E[0])}, et al.`; if (E.length === 1) return f(E[0], 0);
    return E.slice(0, -1).map(f).join(', ') + (en ? ' and' : yD(E.at(-1))) + ' ' + f(E.at(-1), E.length - 1); };
  const P = pAuthP(p), au = list(P, inv), T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p)), plc = ea(p.place || ''), pb = ea(p.publisher || '');
  const yr = p.year ? String(p.year) : '', Y = yr ? yr + (o.ys || '') : `[${L.sd}]` + (o.ys ? '-' + o.ys : ''), yEnd = !nf ? yr : '';   // yEnd = año al final (numérico)
  const join = (a, b, sep) => a && b ? a + sep + b : a || b, on = link ? (en ? 'Online.' : 'En línea.') : '', pg = ea(pgs(p.pages, true));
  const pub = (a, ...r) => endDot([a, ...r].filter(Boolean).join(', '));
  let ti, ct = [];
  if (p.type === 'libro') { ti = endDot(it(T)); const ed = ea(edLbl(p.edition, o.lang)); if (ed) ct.push(ed); ct.push(pub(join(plc, V, ': '), yEnd)); }
  else if (p.type === 'tesis') { ti = endDot(it(T)); ct.push(endDot(ea(p.thesisType || L.thesis)), pub(join(plc, V, ': '), yEnd)); }
  else if (p.type === 'capitulo' || p.type === 'congreso') {   // comunicación = parte de una monografía: En: Editor (ed.). *Obra*. Lugar: Editorial, año, pp. x-y.
    ti = endDot(T); const E = pAuth(p.editors || []), eds = list(E, dir), er = E.length > 1 ? 'eds.' : 'ed.';
    const inb = [eds && `${eds} (${er})`, V && it(V)].filter(Boolean); if (inb.length) ct.push(`${L.in}: ${inb.map(endDot).join(' ')}`);   // En: Editor (ed.). *Obra*.
    ct.push(pub(join(plc, pb, ': '), yEnd, pg)); }
  else if (p.type === 'web') {
    ti = endDot(T); if (V && norm(V) !== norm(P.length === 1 ? p.authors[0] : '')) ct.push(endDot(V));
    ct.push(on); const dt = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? du(p.pubDate) : yEnd; if (dt) ct.push(endDot(dt)); }
  else if (NEWS(p)) {   // periódico: la fecha sustituye a volumen y número; blog: «Entrada de blog.» tras el título (designación de tipo, 9.2)
    ti = endDot(T); if (p.type === 'blog') ct.push(en ? 'Blog post.' : 'Entrada de blog.'); ct.push(on, endDot(V ? it(V) : ''));
    const tail = [fdOk(p) ? du(p.pubDate) : yEnd, p.type === 'prensa' ? pg : ''].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); }
  else {   // artículo: *Revista*, **vol**(núm), pp. x-y  (numérico: *Revista*. año, **vol**(núm), pp. x-y)
    ti = endDot(T); const vi = [p.volume ? `**${ea(p.volume)}**` : '', p.issue ? (p.volume ? `(${ea(p.issue)})` : `${en ? 'no.' : 'n.º'} ${ea(p.issue)}`) : ''].join('');
    ct.push(on); if (nf) ct.push(pub([V ? it(V) : '', vi].filter(Boolean).join(', '), pg)); else ct.push(endDot(V ? it(V) : ''), pub(yEnd, vi, pg)); }
  if (p.type !== 'web' && p.type !== 'articulo' && !NEWS(p)) ct.unshift(on);
  const lk = link ? endDot(`${L.avail}: ${link}`) : '', acc = link && p.accessed && !p.hideAccessed ? `[${en ? 'Viewed' : 'Consulta'}: ${du(p.accessed)}].` : '';
  const head = nf ? (au ? [`${au}, ${Y}.`, ti] : [ti, endDot(Y)]) : [au && endDot(au), ti];
  return [...head, ...ct.filter(Boolean), lk, acc].filter(Boolean).join(' ').trim();
};
/* ---- F3c–F3e: tipos nuevos (informe, norma, patente, mapa, dataset, software, basedatos, audiovisual, audio, redsocial, ia, diccionario, presentacion, personal, legislacion).
   Un solo motor xFn(p, o, estilo): reutiliza el formato de autores de cada estilo (XAU) y aplica la plantilla de la guía donde la hay; el resto es genérica y se avisa (XCOVER/typeWarn). ---- */
const XTYPES = new Set(['informe', 'norma', 'patente', 'mapa', 'dataset', 'software', 'basedatos', 'audiovisual', 'audio', 'redsocial', 'ia', 'diccionario', 'presentacion', 'personal', 'legislacion']);
const XDEF = {mapa: ['Mapa', 'Map'], dataset: ['Conjunto de datos', 'Dataset'], software: ['Software', 'Software'], audiovisual: ['Película', 'Film'], audio: ['Audio podcast', 'Audio podcast'], redsocial: ['Publicación', 'Post'],
  ia: ['Modelo de lenguaje de gran tamaño', 'Large language model'], presentacion: ['Presentación de PowerPoint', 'PowerPoint presentation'], personal: ['Comunicación personal', 'Personal communication']};   // designación por defecto [es, en]
const verLbl = (x, en) => !x ? '' : /^(v\d|vers|ver\b|edici|edition|release|ed\.)/i.test(x) ? x : (en ? 'Version ' : 'Versión ') + x;   // «2.1» → «Versión 2.1»; «Edición para empresas» y «v26» se dejan
const noAbbr = s => String(s ?? '').replace(/\s*\([^()]{1,12}\)\s*$/, '').trim();   // «Organismo (ISO)» → «Organismo»
const abbrOf = s => (/\(([^()]{1,12})\)\s*$/.exec(String(s ?? '')) || [])[1] || '';   // siglas entre paréntesis al final
const OWN = p => ['informe', 'norma', 'software', 'ia'].includes(p.type) && p.authorType !== 'sin_autor' && !pAuthP(p).length && String(p.venue ?? '').trim();   // sin autor: el organismo o la empresa ocupa su lugar
const authP = p => OWN(p) ? [{l: noAbbr(p.venue), g: '', org: true}] : pAuthP(p);
const XAU = {   // autores según el estilo (misma lógica que apaFn, vanFn, mlaFn, ieeeFn, chiFn y uneFn)
  apa: (P, o, full) => { const A = P.map(a => a.org ? ea(a.l) : a.g ? `${ea(a.l)}, ${ini(a.g, 1)}${full && hasFull(a.g) ? ` [${ea(a.g)}]` : ''}` : ea(a.l)); return A.length > 20 ? A.slice(0, 19).join(', ') + ', . . . ' + A.at(-1) : apaJoin(A, P, o); },
  van: (P, o, full) => { const nm = a => a.org ? ea(a.l) : full ? `${ea(a.l)}${a.g ? ', ' + ea(a.g) : ''}` : `${ea(a.l)}${a.g ? ' ' + ini(a.g) : ''}`, sp = full ? '; ' : ', ', A = P.map(nm); return !o.vanAll && A.length > 6 ? A.slice(0, 6).join(sp) + sp + 'et al' : A.join(sp); },
  mla: (P, o) => { const en = o.lang === 'en', inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
    return P.length === 1 ? inv(P[0]) : P.length === 2 ? `${inv(P[0])}${en ? ' and' : yD(P[1])} ${dir(P[1])}` : P.length > 2 ? inv(P[0]) + ', et al.' : ''; },
  ieee: P => { const nm = a => a.org || !a.g ? ea(a.l) : `${ini(a.g, 1)} ${ea(a.l)}`; return !P.length ? '' : P.length > 6 ? nm(P[0]) + ' et al.' : P.length === 1 ? nm(P[0]) : P.length === 2 ? `${nm(P[0])} and ${nm(P[1])}` : P.slice(0, -1).map(nm).join(', ') + ', and ' + nm(P.at(-1)); },
  chi: (P, o) => { const en = o.lang === 'en', inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`, nm = (a, i) => i ? dir(a) : inv(a);
    if (!P.length) return ''; if (P.length > 10) return P.slice(0, 7).map(nm).join(', ') + ', et al.'; if (P.length === 1) return nm(P[0], 0);
    return P.slice(0, -1).map(nm).join(', ') + (en ? ', and' : yD(P.at(-1))) + ' ' + nm(P.at(-1), P.length - 1); },
  une: (P, o) => { const en = o.lang === 'en', UP = x => String(x).toLocaleUpperCase('es'), inv = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(UP(a.l))}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`, f = (a, i) => i ? dir(a) : inv(a);
    if (!P.length) return ''; if (P.length > 3) return `${inv(P[0])}, et al.`; if (P.length === 1) return f(P[0], 0);
    return P.slice(0, -1).map(f).join(', ') + (en ? ' and' : yD(P.at(-1))) + ' ' + f(P.at(-1), P.length - 1); }};
const xFn = (p, o, st) => {
  const ty = p.type, en = o.lang === 'en', L = L10[en ? 'en' : 'es'], norm = x => String(x ?? '').trim().toLowerCase();
  const fam = st.replace(/2$/, '').replace(/^chicago_.*/, 'chi').replace(/^une_.*/, 'une'), full = st === 'apa2' || st === 'vancouver2', af = st === 'chicago_af', nf = st === 'une_nf';
  const P = authP(p), ownV = !!OWN(p), sameV = P.length === 1 && P[0].org && norm(noAbbr(p.venue)) === norm(P[0].l), V0 = ea(p.venue || ''), V = ownV || sameV ? '' : V0;
  const T = ea((p.title || '').replace(/\.$/, '')), plc = ea(p.place || ''), ed = ea(p.edition || ''), doc = ea(p.docNumber || ''), ser = ea(p.series || ''), sn = ea(p.seriesNumber || ''), pg = ea(p.pages || ''), iss = ea(p.issue || '');
  const hand = ea(String(p.userHandle || '').replace(/^@/, '')), role = ea(p.authorRole || '');
  const kind = ty === 'audio' ? (/episod/i.test(p.subtype) ? 'ep' : /canci|song/i.test(p.subtype) ? 'song' : 'pod') : ty === 'audiovisual' ? (ser || /episod|cap[ií]tulo|episode/i.test(p.subtype) ? 'ep' : /v[ií]deo/i.test(p.subtype) ? 'vid' : 'film') : '';
  const DK = {ep: ty === 'audio' ? ['Episodio de audio podcast', 'Audio podcast episode'] : ['Capítulo de serie de televisión', 'TV series episode'], vid: ['Video', 'Video']}[kind] || XDEF[ty] || ['', ''];
  const sub = ea(p.subtype || '') || DK[en ? 1 : 0] || '';
  const link = ea(citeLink(p)), yr = p.year ? String(p.year) : '', fd = fdOk(p) ? p.pubDate : '', accOk = link && p.accessed && !p.hideAccessed;
  const join = (a, b, sep) => a && b ? a + sep + b : a || b, serSn = join(ser, sn, ' '), docE = ty === 'norma' && ed && doc ? `${doc} (${ed})` : doc, code = ty === 'informe' ? [serSn, doc].filter(Boolean).join('; ') : docE;   // norma: la edición (completa…) va entre paréntesis tras el código
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`, patN = `${plc ? plc + ' ' : ''}Patent ${doc}`.trim();
  const noInd = ['ep', 'song'].includes(kind) || ['personal', 'redsocial', 'legislacion', 'diccionario'].includes(ty);   // título sin cursiva

  if (fam === 'apa') {
    const fullD = ['redsocial', 'audio', 'ia'].includes(ty) || kind === 'vid' || kind === 'ep';
    const Y = fullD && fd ? apaDate(fd, o) : yr ? yr + (o.ys || '') : L.sd + (o.ys ? '-' + o.ys : '');
    let au = XAU.apa(P, o, full); if (au && hand) au += ` [@${hand}]`; if (au && role) au += ` (${role})`;
    const hd = au && (hand || role || P.at(-1)?.org) ? endDot(au) : au, head = t => [hd ? `${hd} (${Y}).` : `${endDot(t)} (${Y}).`, hd ? endDot(t) : ''];
    if (ty === 'legislacion') { const dt = fd ? chiLong(fd, o) : yr; return [endDot(T + (doc ? ` (${doc})` : '')), V ? endDot([it(V), dt, iss, pg].filter(Boolean).join(', ')) : '', link].filter(Boolean).join(' ').trim(); }
    if (ty === 'diccionario') {
      const paren = [edLbl(p.edition, o.lang) && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true)].filter(Boolean).join(', '), rd = p.accessed ? (en ? chiLong(p.accessed, o) : apaDate(p.accessed, {...o, ys: ''})) : '';
      const rec = !yr && link && rd ? `${en ? 'Retrieved' : 'Recuperado el'} ${rd}, ${en ? 'from' : 'de'} ${link}` : link;
      return [...head(T), V ? endDot(`${L.in} ${it(V)}${paren ? ` (${paren})` : ''}`) : '', rec].filter(Boolean).join(' ').trim(); }
    let t = noInd ? T : it(T);
    const par = ({informe: code, norma: doc, software: ed, dataset: ed, ia: ed, mapa: ed, patente: doc && patN})[ty] || (kind === 'ep' ? (ty === 'audio' && sn ? `${en ? 'No.' : 'Nº'} ${sn}` : sn) : '');
    if (par) t += ` (${par})`;
    const des = ty === 'dataset' && !p.subtype ? 'Dataset' : ['informe', 'norma', 'basedatos', 'patente'].includes(ty) ? '' : sub; if (des) t += ` [${des}]`;
    const tail = ty === 'audiovisual' && kind === 'ep' ? [ser && `${L.in} ${it(ser)}`, V] : kind === 'ep' ? [it(ser)] : kind === 'song' ? [ser && `${L.in} ${it(ser)}`, V] : ty === 'ia' ? [ser, V] : [V];
    return [...head(t), ...tail.filter(Boolean).map(endDot), link].filter(Boolean).join(' ').trim(); }

  if (fam === 'vancouver') {
    const online = !!link || ty === 'basedatos', yv = fd ? fdate(fd, o) : yr, cons = online && p.accessed && !p.hideAccessed ? `[${L.cons} ${fdate(p.accessed, o)}]` : '', dat = [yv, cons].filter(Boolean).join(' ');
    const bt = ['informe', 'norma', 'basedatos', 'patente', 'legislacion', 'diccionario', 'personal'].includes(ty) ? '' : sub, br = bt ? (online ? `${bt} ${en ? 'on the Internet' : 'en Internet'}` : bt) : online ? 'Internet' : '';
    const ver = ed && ty !== 'norma' ? (['software', 'dataset', 'ia', 'mapa'].includes(ty) ? verLbl(ed, en) : ea(edLbl(p.edition, o.lang))) : '';
    const pubL = ty === 'diccionario' ? join(V ? `${L.in}: ${V}` : '', dat, '. ') : join(join(plc, V, ': '), dat, ty === 'basedatos' ? '. ' : '; ');
    const extra = ty === 'patente' ? (doc && patN) : ['informe', 'norma'].includes(ty) ? code : ty === 'legislacion' ? [doc, iss && `${en ? 'no.' : 'n.º'} ${iss}`, pg && `p. ${pg}`].filter(Boolean).join('; ') : ty === 'diccionario' ? pgs(pg, true) : ['audiovisual', 'audio'].includes(ty) ? [ser, sn].filter(Boolean).join('. ') : '';
    return [endDot(XAU.van(P, o, full)), endDot(T + (br ? ` [${br}]` : '')), ver && endDot(ver), endDot(pubL), extra && endDot(extra), link && `${L.avail}: ${link}`].filter(Boolean).join(' ').trim(); }

  if (fam === 'mla') {
    const dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`, cont = a => endDot(a.filter(Boolean).join(', ')), lk = ea(mlaLink(p)), yrS = fd ? mlaLong(fd, o) : yr;
    let au = ownV || sameV ? '' : XAU.mla(P, o), ti, ct;
    const acc = lk && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Consultado el'} ${mlaAcc(p.accessed, o)}.` : '';
    if (ty === 'dataset') return [au && endDot(au), qt(T), endDot(yr), lk ? endDot(lk) : 'Web.'].filter(Boolean).join(' ');   // guía: Autor. “Título.” año. Web.
    if (ty === 'redsocial') { au = hand ? `@${hand}` : au; ti = `“${endDot(T)}”`; ct = cont([V0, yrS, lk]); }   // el punto va dentro de las comillas (guía)
    else if (ty === 'audiovisual' && kind === 'film') { const dn = P.length > 2 ? dir(P[0]) + ' et al.' : P.map(dir).join(en ? ' and ' : ' y '); au = ''; ti = endDot(it(T)); ct = cont([dn && `${en ? 'Directed by' : 'Dirigida por'} ${dn}`, V0, yr, lk]); }
    else if (ty === 'audiovisual' && kind === 'ep') { au = ''; ti = qt(T); ct = cont([ser && it(ser), sn && sn[0].toLowerCase() + sn.slice(1), V0, yrS, lk]); }
    else if (ty === 'audiovisual') { ti = qt(T); ct = cont([V0 ? it(V0) : '', yrS, lk]); }   // vídeo en línea
    else if (ty === 'legislacion') { au = plc; ti = endDot(T); ct = cont([V0 && it(V0), iss && `no. ${iss}`, yr, pg && pgs(pg, true)]); }
    else if (ty === 'ia') { au = ''; if (ser) { ti = qt(T); ct = cont([it(ser), ed, V0, yrS, lk]); } else { ti = ''; ct = cont([it(T), ed, V0, yrS, lk]); } }
    else if (kind === 'ep' || kind === 'song') { ti = qt(T); ct = cont([ser && it(ser), V0, yrS, lk]); }
    else if (ty === 'personal') { ti = qt(T); ct = cont([sub, yrS]); }
    else if (ty === 'diccionario') { ti = qt(T); ct = cont([V0 && it(V0), ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), yr, lk]); }
    else { ti = endDot(it(T)); ct = cont([['mapa', 'software', 'presentacion'].includes(ty) ? sub : '', ty === 'norma' ? '' : ed, code, V0, yrS, lk]); }
    return [au && endDot(au), ti, ct, acc].filter(Boolean).join(' ').trim(); }

  if (fam === 'ieee') {
    const au = XAU.ieee(P), lead = au ? au + ', ' : '', fin = x => /[.?!…][”*]*$/.test(x) ? x : x + '.', quoted = rest => rest ? (/[?!]$/.test(T) ? `“${T}” ` : `“${T},” `) + fin(rest) : `“${fin(T)}”`;
    const dEn = fd ? `${MESF.en[+fd.slice(5, 7) - 1]} ${+fd.slice(8)}, ${fd.slice(0, 4)}` : yr, onl = link ? ` [Online]. Available: ${link}` : '', j2 = a => a.filter(Boolean).join(', ');
    if (ty === 'personal') return `${au ? au + ' ' : ''}(private communication)${yr ? ', ' + yr : ''}.`;   // I. Apellido (private communication), año.
    let body;
    if (ty === 'informe') body = lead + quoted(j2([V, plc, doc ? (/rep|publication|no\./i.test(doc) ? doc : `Tech. Rep. ${doc}`) : serSn, yr]));
    else if (ty === 'patente') body = lead + quoted(j2([patN, dEn]));
    else if (ty === 'dataset') body = lead + `“${fin(T)}” ` + fin(j2([V, yr]));
    else if (ty === 'norma') body = lead + it(T) + ', ' + fin(j2([docE, V, plc, yr]));
    else if (ty === 'legislacion') body = lead + quoted(j2([V, iss && `no. ${iss}`, pg && pgs(pg, true), dEn]));
    else if (['mapa', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || kind === 'film' || kind === 'pod') { const r = j2([sub, ed, V, plc, dEn]); body = lead + it(T) + (r ? ', ' + r : ''); }
    else body = lead + quoted(j2([kind === 'ep' ? ser : '', sub, ty === 'diccionario' ? ea(edLbl(p.edition, 'en')) : ed, V, plc, pg && pgs(pg, true), dEn]));
    return fin(body) + onl; }

  if (fam === 'chi') {
    const abbr = abbrOf(p.venue), au = ty === 'norma' && ownV && abbr && af ? `${ea(abbr)} (${P[0].l})` : XAU.chi(P, o), cj = a => endDot(a.filter(Boolean).join(', '));
    const Y = yr ? yr + (o.ys || '') : 'n.d.' + (o.ys ? '-' + o.ys : ''), yn = af ? '' : yr, dl = fd ? chiLong(fd, o) : yn;
    const acc = !yr && link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Acceso el'} ${chiAcc(p.accessed, o)}.` : '';
    let ti, ct = [], A = au;
    if (ty === 'informe') { ti = qt(T); ct.push(cj([serSn, doc, V, plc, fd ? chiLong(fd, o) : yn])); }
    else if (ty === 'norma') { ti = endDot(it(T)); const ap = fd ? (en ? `approved ${chiLong(fd, o)}` : `aprobada el ${chiLong(fd, o)}`) : yn; if (docE) ct.push(endDot(docE)); ct.push(endDot([join(plc, ownV ? ea(abbr) : V, ': '), ap].filter(Boolean).join(', '))); }
    else if (ty === 'patente') { ti = endDot(T); ct.push(endDot([patN, fd && (en ? `granted ${chiLong(fd, o)}` : `concedida el ${chiLong(fd, o)}`)].filter(Boolean).join(', '))); }
    else if (ty === 'mapa') { ti = endDot(it(T) + ` [${(sub || 'mapa').toLowerCase()}]`); if (ed) ct.push(endDot(ed)); if (doc) ct.push(endDot(doc)); if (serSn) ct.push(endDot(ser && sn ? `${ser}; ${sn}` : serSn)); ct.push(endDot([join(plc, V, ': '), dl].filter(Boolean).join(', '))); }
    else if (ty === 'audiovisual' && (kind === 'film' || kind === 'ep')) {
      if (A) A += ', dir.'; if (kind === 'film') { ti = endDot(it(T)); } else { ti = endDot(it(ser || T)); ct.push(endDot([sn, `“${T}”`].filter(Boolean).join(', '))); }
      ct.push(endDot([join(plc, V, ': '), yn].filter(Boolean).join(', '))); if (p.subtype) ct.push(endDot(sub)); }
    else if (ty === 'diccionario') { ti = qt(T); ct.push(cj([`${L.in} ${it(V0)}`, ed && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), dl])); }
    else if (ty === 'legislacion') { ti = endDot(T); ct.push(cj([V0 && it(V0), iss, doc, dl, pg])); }
    else { ti = ['dataset', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || kind === 'pod' || kind === 'vid' ? endDot(it(T)) : qt(T);
      if (sub && !['basedatos', 'personal'].includes(ty)) ct.push(endDot(sub)); if (ed) ct.push(endDot(verLbl(ed, en))); ct.push(cj([join(plc, V, ': '), dl])); }
    const head = af ? (A ? [endDot(A), endDot(Y), ti] : [ti, endDot(Y)]) : [A && endDot(A), ti];
    return [...head, ...ct.filter(Boolean), acc, link && endDot(link)].filter(Boolean).join(' ').trim(); }

  // UNE-ISO 690:2024 (nombre-fecha / numérico)
  const UP = x => String(x).toLocaleUpperCase('es'), du = x => fdate(x, {...o, dateFmt: o.dateFmt === 'iso' ? 'iso' : 'dmy'});
  const Y = yr ? yr + (o.ys || '') : `[${L.sd}]` + (o.ys ? '-' + o.ys : ''), yEnd = !nf ? yr : '', pub = (...r) => endDot(r.filter(Boolean).join(', '));
  const lk = link ? endDot(`${L.avail}: ${link}`) : '', acc = accOk ? `[${en ? 'Viewed' : 'Consulta'}: ${du(p.accessed)}].` : '';
  let au = XAU.une(P, o); if (ty === 'norma' && ownV && abbrOf(p.venue)) au += ` (${ea(abbrOf(p.venue))})`; if (hand) au += ` [${V0 || 'Red'}: @${hand}]`; if (role) au += ` (${role.toLowerCase()})`;
  const head = ti => nf ? (au ? [`${au}, ${Y}.`, ti] : [ti, endDot(Y)]) : [au && endDot(au), ti], ind = ['mapa', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || ['film', 'pod', 'vid'].includes(kind);
  if (ty === 'norma') return [endDot(au), endDot(`${doc ? `${doc}${ed ? ` (${ed})` : ''}, ` : ''}${T}`), !doc && yr ? endDot(yr) : '', lk, acc].filter(Boolean).join(' ').trim();
  if (ty === 'informe') { const ss = ser ? ser + (sn ? `, ${en ? 'no.' : 'nº'} ${sn}` : '') : sn ? `${en ? 'no.' : 'nº'} ${sn}` : '';
    return [...head(endDot(it(T))), pub(join(plc, V, ': '), yEnd), ss && endDot(ss), doc && endDot(doc), lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'patente') { const inv = P.map(a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`), il = inv.length > 1 ? inv.slice(0, -1).join(', ') + (en ? ' and ' : yD(P.at(-1)) + ' ') + inv.at(-1) : inv[0] || '';
    const tit = V0 ? ea(UP(V0)) + (plc ? ` (${plc})` : '') : XAU.une(P, o);
    return [endDot(tit), endDot(T), V0 && il && endDot(`${en ? 'Inventors' : 'Inventores'}: ${il}`), doc && endDot(`${plc ? plc + ' ' : ''}${en ? 'patent' : 'patente'} ${doc}`), fd && `Conc.: ${du(fd)}.`, lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'redsocial') return [endDot(au), endDot(T), sub && endDot(sub), (fd || yr) && endDot(fd || yr), link && endDot(`${L.avail}: ${join(V0, link, ', ')}`), acc].filter(Boolean).join(' ').trim();   // fecha ISO (guía)
  if (ty === 'personal') return [endDot(au), (fd ? du(fd) : yr) && endDot(fd ? du(fd) : yr), `[${T}].`, `[${(sub || '').toLowerCase()}].`].filter(Boolean).join(' ').trim();
  if (ty === 'legislacion') { const a2 = plc ? ea(UP(plc)) : au; return [endDot(a2), endDot(T), pub(V0 && it(V0), iss && `${en ? 'no.' : 'nº'} ${iss}`, fd ? du(fd) : yr, pg && pgs(pg, true)), doc && endDot(doc), lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'dataset') return [...head(endDot(T)), sub && endDot(sub), ed && endDot(verLbl(ed, en)), pub(V, plc, yEnd), lk, acc].filter(Boolean).join(' ').trim();
  if (ty === 'diccionario') return [...head(endDot(T)), V0 && pub(`${L.in}: ${it(V0)}`, ed && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), yEnd), lk, acc].filter(Boolean).join(' ').trim();
  const dsg = ty === 'software' && !p.subtype ? (en ? 'Software' : 'Programa') : sub;
  return [...head(endDot(ind ? it(T) : T)), dsg && !['basedatos', 'diccionario'].includes(ty) && endDot(dsg), ed && endDot(['software', 'ia', 'mapa'].includes(ty) ? verLbl(ed, en) : ea(edLbl(p.edition, o.lang))), kind === 'ep' && ser && endDot(`${L.in}: ${it(ser)}`), pub(join(plc, V, ': '), yEnd), code && ty !== 'informe' && endDot(code), lk, acc].filter(Boolean).join(' ').trim();
};
const withX = (fn, st) => (p, o = ex()) => XTYPES.has(p.type) ? xFn(p, o, st) : fn(p, o);
// estilos donde la guía trae plantilla propia para cada tipo nuevo (en los demás se usa la genérica y se avisa)
const XCOVER = {informe: ['apa', 'apa2', 'chicago_nb', 'ieee', 'une_nf', 'une_num'], norma: ['apa', 'apa2', 'chicago_af', 'chicago_nb', 'une_nf', 'une_num'], patente: ['chicago_af', 'chicago_nb', 'ieee', 'une_nf', 'une_num'], mapa: ['chicago_af', 'chicago_nb', 'une_nf', 'une_num'],
  dataset: ['apa', 'apa2', 'mla', 'ieee', 'une_nf', 'une_num'], software: ['apa', 'apa2', 'une_nf', 'une_num'], basedatos: ['vancouver', 'vancouver2'], audiovisual: ['apa', 'apa2', 'chicago_af', 'chicago_nb', 'mla', 'une_nf', 'une_num'], audio: ['apa', 'apa2'],
  redsocial: ['apa', 'apa2', 'mla', 'une_nf', 'une_num'], ia: ['apa', 'apa2', 'mla'], diccionario: ['apa', 'apa2'], presentacion: ['apa', 'apa2'], personal: ['ieee', 'une_nf', 'une_num'], legislacion: ['apa', 'apa2', 'mla', 'une_nf', 'une_num']};
const XNOTE = {   // avisos concretos adicionales (estilo → tipo)
  apa: {personal: 'APA no incluye las comunicaciones personales en la lista de referencias (solo en el texto): se omiten al exportar.', legislacion: 'APA no cubre la legislación: es la adaptación española de la guía. Verificar.'},
  chicago_af: {informe: 'La forma autor-fecha del informe es una extrapolación de la guía. Verificar.', personal: 'Chicago no incluye las comunicaciones personales en la bibliografía: se omiten al exportar.', ia: 'Chicago no cita la IA en la bibliografía salvo que haya un enlace público: se omite si no lo hay.', patente: 'El ejemplo de patente de la guía está truncado (sin fecha de solicitud). Verificar.', legislacion: 'Chicago 17.ª ed. no cubre la legislación. Verificar.'},
  chicago_nb: {personal: 'Chicago no incluye las comunicaciones personales en la bibliografía: se omiten al exportar.', redsocial: 'Chicago omite las redes sociales de la bibliografía (basta citarlas en el texto o en nota): se omiten al exportar.', ia: 'Chicago no cita la IA en la bibliografía salvo que haya un enlace público: se omite si no lo hay.', patente: 'El ejemplo de patente de la guía está truncado (sin fecha de solicitud). Verificar.', legislacion: 'Chicago 17.ª ed. no cubre la legislación. Verificar.'},
  mla: {legislacion: 'MLA no cubre documentos jurídicos: es una adaptación. Verificar.'}, une_nf: {legislacion: 'UNE solo trae un ejemplo de legislación. Verificar.'}, une_num: {legislacion: 'UNE solo trae un ejemplo de legislación. Verificar.'}};
XNOTE.apa2 = XNOTE.apa;
const xWarn = (st, ty) => { const s = STYLES[st]; if (!s) return ''; return [XCOVER[ty]?.includes(st) ? '' : `${s.name}: la guía no trae plantilla de ${TYPES[ty].toLowerCase()}; se usa una genérica. Verificar.`, XNOTE[st]?.[ty]].filter(Boolean).join(' '); };
const STYLES = {   // order: 'alpha' = bibliografía alfabética; 'list' = en el orden de la lista · dis: true = estilo autor-año que distingue 2020a/2020b · numFmt: numeración propia ('br' = [1]; por defecto 'dot' = 1.)
  apa: {name: 'APA 7 · Variante 1', order: 'alpha', dis: true, omit: p => p.type === 'personal', fn: withX((p, o) => apaFn(p, o, false), 'apa')},
  apa2: {name: 'APA 7 · Variante 2 (nombre completo)', order: 'alpha', dis: true, omit: p => p.type === 'personal', fn: withX((p, o) => apaFn(p, o, true), 'apa2')},
  vancouver: {name: 'Vancouver · Variante 1 (iniciales)', order: 'list', fn: withX((p, o) => vanFn(p, o, false), 'vancouver')},
  vancouver2: {name: 'Vancouver · Variante 2 (nombre completo)', order: 'list', fn: withX((p, o) => vanFn(p, o, true), 'vancouver2')},
  mla: {name: 'MLA', order: 'alpha', fn: withX((p, o) => mlaFn(p, o), 'mla'), note: 'MLA 8.ª/9.ª. Sin autor, o con entidad igual a la editorial, empieza por el título. En español el punto va fuera de las comillas; en inglés, dentro. Meses abreviados en fechas completas (solo web): verificar.'},
  ieee: {name: 'IEEE', order: 'list', numbered: true, numFmt: 'br', fixedLang: 'en', fn: withX((p, o) => ieeeFn(p, o), 'ieee'), note: 'IEEE: siempre en inglés y numerado [1]. El número sigue el orden de la lista (la cita [n] en el texto no existe hasta la fase F4). Sin fecha de consulta. Verificar: más de 6 autores (primero + et al.), tesis de grado, nombre del sitio en páginas web y mes completo.'},
  chicago_af: {name: 'Chicago · Autor-fecha', order: 'alpha', dis: true, omit: p => p.type === 'personal' || (p.type === 'ia' && !citeLink(p)), fn: withX((p, o) => chiFn(p, o, true), 'chicago_af'), note: 'Chicago 17.ª ed., lista de referencias autor-fecha (la cita «(Autor año, pág)» en el texto llega en la fase F4). Más de 10 autores: 7 + et al. Sin año: n.d. y fecha de acceso. El mes del artículo sale solo si rellenas «Fecha de publicación» (se usa solo el mes). En español el punto va fuera de las comillas; en inglés, dentro. Verificar: congreso inédito, tesis y nombre del sitio web (la guía tiene puntuación inconsistente).'},
  chicago_nb: {name: 'Chicago · Notas y bibliografía', order: 'alpha', omit: p => p.type === 'personal' || p.type === 'redsocial' || (p.type === 'ia' && !citeLink(p)), fn: withX((p, o) => chiFn(p, o, false), 'chicago_nb'), note: 'Chicago 17.ª ed., solo la bibliografía del sistema notas y bibliografía: año tras la editorial (Lugar: Editorial, Año). Las notas a pie (completas y abreviadas, ibid.) llegan en la fase F4; Chicago prefiere notas abreviadas. Más de 10 autores: 7 + et al. Sin año no se escribe n.d. y se añade la fecha de acceso. El mes del artículo sale solo si rellenas «Fecha de publicación» (las estaciones, p. ej. Spring 2017, no existen en la app). En español el punto va fuera de las comillas; en inglés, dentro. El congreso inédito lleva solo el año (la app no guarda las fechas del congreso). Verificar: congreso inédito, tesis y nombre del sitio web (la guía tiene puntuación inconsistente).'},
  une_nf: {name: 'UNE-ISO 690 · Nombre-fecha', order: 'alpha', dis: true, fn: withX((p, o) => uneFn(p, o, true), 'une_nf'), note: 'UNE-ISO 690:2024, lista de referencias nombre-fecha: APELLIDO, Nombre, año. Título… Los apellidos van en mayúsculas y las entidades enteras en mayúsculas; el 2.º y siguientes autores en orden directo (PARKER, T. J. y W. A. HASWELL). Más de 3 autores: primero + et al. Sin año: [s.f.]. Fecha de consulta en dd-mm-aaaa (ISO aaaa-mm-dd si lo eliges; la fecha larga no se usa). TODO este estilo es «verificar»: el orden de los elementos está deducido de los ejemplos de la guía, porque las tablas oficiales de metadatos no se incluyeron. No hay ISBN/ISSN (fase F3) ni cita en el texto (fase F4). Capítulos y comunicaciones: páginas tras el año.'},
  une_num: {name: 'UNE-ISO 690 · Numérico', order: 'list', numbered: true, numFmt: 'br', fn: withX((p, o) => uneFn(p, o, false), 'une_num'), note: 'UNE-ISO 690:2024, lista numérica: el año va al final (tras la editorial) y la lista se numera siempre; el formato [1] / 1. / (1) se elige abajo. La app no conoce las citas del texto (fase F4): el número sigue el orden de la lista que fijes a mano, no el de primera cita. Más de 3 autores: primero + et al. Fecha de consulta en dd-mm-aaaa (ISO si lo eliges). TODO este estilo es «verificar»: el orden de los elementos está deducido de los ejemplos de la guía (las tablas oficiales no se incluyeron). No hay ISBN/ISSN (fase F3).'}
};
/* ---- F4: cita en el texto y notas (opcional; oculta salvo que se active settings.export.inText). Reglas: guía 4.4 (APA), 5.3 (Chicago), 6.4 (MLA), 7.6 (IEEE), 8.4 (Vancouver), 9.4 (UNE). IEEE y Vancouver: convención NO incluida en la guía → «verificar». ---- */
const IND_T = new Set(['libro', 'tesis', 'congreso', 'web', 'informe', 'norma', 'dataset', 'software', 'mapa', 'basedatos', 'audiovisual', 'audio', 'presentacion', 'ia']);   // título en cursiva (obra independiente); el resto, entre comillas
const shortT = (t, n = 4) => { const w = String(t ?? '').split(/[:.?!–—]/)[0].trim().split(/\s+/).filter(Boolean); return w.slice(0, n).join(' '); };   // título acortado: primeras palabras antes de «:»
const locLbl = (loc, bare) => {   // página o parte citada: «87» → «p. 87», «87-90» → «pp. 87-90»; bare = sin etiqueta (MLA, Chicago)
  loc = String(loc ?? '').trim(); if (!loc) return ''; const num = loc.replace(/^(pp?\.|págs?\.|pages?)\s*/i, '');
  if (bare) return num; if (/^(párr|cap|sec|fig|tabla|vol|art|ch)/i.test(loc)) return loc; return (/^[A-Za-z]?\d+$/.test(num) ? 'p. ' : 'pp. ') + num; };
const inTextFn = (p, o, st, loc) => {   // devuelve [{k: etiqueta, t: texto con *cursiva*}]; loc = página o parte citada (opcional)
  const en = o.lang === 'en', L = L10[en ? 'en' : 'es'], P = authP(p), n = P.length, yr = p.year ? String(p.year) : '', Y = (yr || L.sd) + (o.ys || ''), tl = String(loc ?? '').trim();
  const nm = a => ea(noAbbr(a.l)), ab = a => a.org ? abbrOf(a.l) || (n === 1 && OWN(p) ? abbrOf(p.venue) : '') : '';
  const title = ea(shortT(p.title, /^(apa|mla)/.test(st) ? 5 : 4)), tt = IND_T.has(p.type) ? it(title) : `“${title}”`;   // APA: primeras palabras (la guía muestra 5)
  const and2 = (a, b, amp) => `${a}${en ? (amp ? ' &' : ' and') : yE(b)} ${b}`;   // «A y B» / «A e Isabel» / «A & B»
  const fam = st.replace(/2$/, '').replace(/^chicago_af$/, 'chiaf').replace(/^chicago_nb$/, 'chinb').replace(/^une_nf$/, 'unenf').replace(/^une_num$/, 'unenum');
  if (fam === 'apa') {
    const lc = locLbl(tl), ph = lc ? `, ${lc}` : '';
    if (p.type === 'personal') { const a = P[0], who = a ? (a.g ? `${ini(a.g, 1)} ${nm(a)}` : nm(a)) : '', d = okDate(p.pubDate) ? chiLong(p.pubDate, o) : yr, pc = en ? 'personal communication' : 'comunicación personal';
      return [{k: 'Entre paréntesis', t: `(${who}, ${pc}, ${d})`}, {k: 'Narrativa', t: `${who} (${pc[0].toUpperCase() + pc.slice(1)}, ${d})`}]; }
    const names = amp => !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1]), amp) : `${nm(P[0])} et al.`;
    if (!n) return [{k: 'Entre paréntesis', t: `(${tt}, ${Y}${ph})`}, {k: 'Narrativa', t: `${tt} (${Y}${ph})`}];
    if (n === 1 && ab(P[0])) return [{k: 'Primera cita', t: `(${nm(P[0])} [${ab(P[0])}], ${Y}${ph})`}, {k: 'Siguientes', t: `(${ab(P[0])}, ${Y}${ph})`}, {k: 'Narrativa (primera / siguientes)', t: `${nm(P[0])} [${ab(P[0])}] (${Y}${ph}) / ${ab(P[0])} (${Y}${ph})`}];
    return [{k: 'Entre paréntesis', t: `(${names(true)}, ${Y}${ph})`}, {k: 'Narrativa', t: `${names(false)} (${Y}${ph})`}]; }
  if (fam === 'chiaf') {
    const lc = tl ? `, ${locLbl(tl, true)}` : '', names = !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1])) : n === 3 ? `${nm(P[0])}, ${and2(nm(P[1]), nm(P[2]))}` : `${nm(P[0])} ${en ? 'et al.' : 'y otros'}`;
    if (p.type === 'ia' && !pAuthP(p).length) { const d = okDate(p.pubDate) ? chiLong(p.pubDate, o) : yr; return [{k: 'Entre paréntesis', t: `(${ea(p.series || p.title)}, ${d})`}]; }   // guía: (ChatGPT, 7 de marzo de 2023)
    return [{k: 'Entre paréntesis', t: `(${n ? names : tt} ${Y}${lc})`}, {k: 'Narrativa', t: `${n ? names : tt} (${Y}${lc})`}]; }
  if (fam === 'chinb') return [{k: 'Nota completa (primera vez)', t: chiNote(p, o, tl)}, {k: 'Nota abreviada (siguientes; la 17.ª ed. la prefiere a ibid.)', t: chiNote(p, o, tl, true)}, {k: 'Ibid. (mismo recurso, nota consecutiva)', t: tl ? `Ibid., ${locLbl(tl, true)}.` : 'Ibid.'}];
  if (fam === 'mla') {   // sin coma entre autor y página
    const lc = tl ? ' ' + locLbl(tl, true) : '', names = !n ? '' : n === 1 ? (ab(P[0]) || nm(P[0])) : n === 2 ? and2(nm(P[0]), nm(P[1])) : `${nm(P[0])} et al.`;
    const out = [{k: 'Autor + página', t: `(${n ? names : tt}${lc})`}]; if (tl) out.push({k: 'Autor mencionado en el texto', t: `(${locLbl(tl, true)})`}); return out; }
  if (fam === 'ieee') return [{k: 'Número de la lista (convención, verificar)', t: tl ? `[n, ${locLbl(tl)}]` : '[n]'}, {k: 'Varios / rango', t: '[1], [3] · [2]–[5]'}];
  if (fam === 'vancouver') { const lc = tl ? ' ' + locLbl(tl) : ''; return [{k: 'Entre paréntesis (convención, verificar)', t: `(n${lc})`}, {k: 'Entre corchetes', t: `[n${lc}]`}, {k: 'Superíndice', t: 'ⁿ'}]; }
  if (fam === 'unenum') { const lc = tl ? ' ' + locLbl(tl) : ''; return [{k: 'Numérico (por orden de primera cita)', t: `(n${lc})`}, {k: 'Entre corchetes', t: `[n${lc}]`}, {k: 'Superíndice', t: 'ⁿ'}]; }
  const lc = tl ? `, ${locLbl(tl)}` : '', names = !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1])) : `${nm(P[0])} et al.`;   // UNE nombre-fecha: (Crane 1988) · Stieg (1981b, p. 556)
  return [{k: 'Entre paréntesis', t: `(${n ? names : tt} ${Y}${lc})`}, {k: 'Creador en el texto', t: `${n ? names : tt} (${Y}${lc})`}];
};
const chiNote = (p, o, loc, short) => {   // notas de Chicago (notas y bibliografía): completa o abreviada
  const en = o.lang === 'en', L = L10[en ? 'en' : 'es'], P = authP(p), n = P.length, ty = p.type, join = (a, b, sep) => a && b ? a + sep + b : a || b, ind = IND_T.has(ty);
  const dir = a => a.org || !a.g ? ea(noAbbr(a.l)) : `${ea(a.g)} ${ea(a.l)}`, sr = a => ea(noAbbr(a.l)), f = short ? sr : dir;
  const au = !n ? '' : n === 1 ? f(P[0]) : n === 2 ? `${f(P[0])}${en ? ' and' : yD(P[1])} ${f(P[1])}` : n === 3 ? `${f(P[0])}, ${f(P[1])}${en ? ', and' : yD(P[2])} ${f(P[2])}` : `${f(P[0])} et al.`;   // 4 o más: primero + et al.
  const lc = locLbl(loc, true);
  if (short) { const st = ea(shortT(p.title));   // Apellido, *título breve*, páginas. · Apellido, “Título breve,” páginas.
    if (ind) return endDot([au, it(st), lc].filter(Boolean).join(', '));
    return lc ? `${au ? au + ', ' : ''}“${st},” ${lc}.` : `${au ? au + ', ' : ''}“${st}.”`; }
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), plc = ea(p.place || ''), pb = ea(p.publisher || ''), yr = p.year ? String(p.year) : '', ed = ea(edLbl(p.edition, o.lang));
  const link = ea(citeLink(p)), dt = fdOk(p) ? chiLong(p.pubDate, o) : yr, lead = au ? au + ', ' : '';
  let r;
  if (ty === 'ia' && !pAuthP(p).length) r = `${en ? 'Text generated by' : 'Texto generado por'} ${ea(p.series || p.title)}, ${V}, ${dt}${link ? ', ' + link : ''}`;   // guía: Texto generado por ChatGPT, OpenAI, 7 de marzo de 2023, url.
  else if (ty === 'libro') r = `${lead}${it(T)}${ed ? ', ' + ed : ''} (${[join(plc, V, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}`;
  else if (ty === 'articulo') r = `${lead}“${T},” ${it(V)}${p.volume ? ' ' + ea(p.volume) : ''}${p.issue ? `, ${en ? 'no.' : 'n.º'} ${ea(p.issue)}` : ''} (${yr})${lc ? ': ' + lc : p.pages ? ': ' + ea(p.pages) : ''}${link ? ', ' + link : ''}`;
  else if (ty === 'capitulo' || (ty === 'congreso' && (p.publisher || p.pages))) { const E = pAuth(p.editors || []).map(dir), eds = E.length > 2 ? E[0] + ' et al.' : E.length === 2 ? `${E[0]}${en ? ' and' : yD(pAuth(p.editors)[1])} ${E[1]}` : E[0] || '';
    r = `${lead}“${T},” ${en ? 'in' : 'en'} ${it(V)}${eds ? `, ed. ${eds}` : ''} (${[join(plc, pb, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : p.pages ? ', ' + ea(p.pages) : ''}`; }
  else if (ty === 'tesis') r = `${lead}“${T}” (${[ea(p.thesisType || L.thesis), V, yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}`;
  else if (['prensa', 'blog', 'web', 'redsocial'].includes(ty)) r = `${lead}“${T},” ${V ? (ty === 'web' ? V : it(V)) + ', ' : ''}${dt}${link ? ', ' + link : ''}`;
  else r = `${lead}${ind ? it(T) : `“${T},”`} (${[ea(p.series || ''), ea(p.docNumber || ''), join(plc, OWN(p) ? '' : V, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}${link ? ', ' + link : ''}`;
  return endDot(r.replace(/ \(\)/g, '').replace(/ ,/g, ','));
};
for (const k of Object.keys(STYLES)) STYLES[k].inText = (p, o = ex(), loc = '') => inTextFn(p, o, k, loc);
// avisos por estilo y tipo (F3b): la guía no trae plantilla propia → se usa una adaptada y se marca «verificar»
const TYPE_WARN = {
  prensa: {vancouver: 'Vancouver no tiene plantilla de prensa en la guía: se usa la de artículo con la fecha completa. Verificar.', vancouver2: 'Vancouver no tiene plantilla de prensa en la guía: se usa la de artículo con la fecha completa. Verificar.',
    mla: 'MLA: la guía no trae plantilla de prensa; se adapta la de artículo de revista (fecha completa y página). Verificar.', ieee: 'IEEE: la guía no trae plantilla de prensa; se adapta la de artículo (fecha completa y luego la página). Verificar.',
    une_nf: 'UNE-ISO 690: la guía no cubre la prensa impresa; en línea sigue el ejemplo de periódico (la fecha sustituye a volumen y número). Verificar.', une_num: 'UNE-ISO 690: la guía no cubre la prensa impresa; en línea sigue el ejemplo de periódico (la fecha sustituye a volumen y número). Verificar.'},
  blog: {vancouver: 'Vancouver: solo se cita la contribución (autor, título, fecha) y «En: blog [Internet]»; lugar y editorial del blog no se guardan. Verificar.', vancouver2: 'Vancouver: solo se cita la contribución (autor, título, fecha) y «En: blog [Internet]»; lugar y editorial del blog no se guardan. Verificar.',
    ieee: 'IEEE: la guía no trae plantilla de blog; se usa la de Internet. Verificar.', une_nf: 'UNE-ISO 690: la guía no trae plantilla de blog; se usa la de sitio web con «Entrada de blog.» tras el título. Verificar.', une_num: 'UNE-ISO 690: la guía no trae plantilla de blog; se usa la de sitio web con «Entrada de blog.» tras el título. Verificar.'}};
const typeWarn = (style, type) => STYLES[style]?.custom ? '' : TYPE_WARN[baseT(type)]?.[style] || (XTYPES.has(baseT(type)) ? xWarn(style, baseT(type)) : '');
// estilo con numeración propia (IEEE, UNE numérico…): numbered: true · idioma fijo: fixedLang: 'en' · aviso en Exportar: note
const BASADO = 'Basado en: Chicago 17.ª ed., MLA 8.ª/9.ª, APA 7.ª, UNE-ISO 690:2024, IEEE (guía fuente), Vancouver (variante con nombre completo).';
/* ===== Tipos de documento propios (Configuración → settings.customTypes del JSON) =====
   Un tipo propio (clave ct_<id>) decide qué campos enseña el formulario y cómo se llaman; los estilos de serie lo tratan como
   el tipo predefinido en «Se cita como» y los estilos propios pueden tener plantilla específica para él. */
const CT_NAMES = {volume: 'Volumen', issue: 'Número', pages: 'Páginas', publisher: 'Editorial (del libro o actas)', place: 'Lugar de edición', edition: 'Edición', editors: 'Editores del libro', pubDate: 'Fecha de publicación completa', thesisType: 'Tipo de trabajo',
  isbn: 'ISBN', issn: 'ISSN', institution: 'Institución', series: 'Serie o colección', seriesNumber: 'Número en la serie', docNumber: 'Número de documento', conferenceName: 'Nombre del congreso', conferencePlace: 'Lugar del congreso', conferenceDates: 'Fechas del congreso',
  subtype: 'Designación', authorRole: 'Función del autor', userHandle: 'Usuario (@)'};
const CTYPES = new Map();   // clave ct_<id> → {id, name, like, fields, labels}
const baseT = t => CTYPES.get(t)?.like || t;
const effP = p => CTYPES.has(p.type) ? {...p, type: CTYPES.get(p.type).like} : p;   // los estilos de serie ven el tipo predefinido equivalente
const ctFieldsOf = like => Object.keys(CT_NAMES).filter(k => FLD_T[k].includes(like));
function ctClean(c) {
  if (!c || typeof c !== 'object') return null; const like = Object.hasOwn(TYPES, c.like) && !c.like.startsWith('ct_') ? c.like : 'articulo';
  const d = {id: String(c.id || uid()).replace(/[^\w-]/g, '') || uid(), name: String(c.name || 'Tipo propio').slice(0, 60), like, fields: Array.isArray(c.fields) ? [...new Set(c.fields.filter(k => Object.hasOwn(CT_NAMES, k)))] : ctFieldsOf(like), labels: {}};
  if (c.labels && typeof c.labels === 'object') for (const [k, v] of Object.entries(c.labels)) if ((k === 'venue' || Object.hasOwn(CT_NAMES, k)) && typeof v === 'string' && v.trim()) d.labels[k] = v.slice(0, 120);
  return d;
}
function syncTypes(list) {
  for (const k of [...CTYPES.keys()]) delete TYPES[k]; CTYPES.clear();
  for (const t of list || []) { CTYPES.set('ct_' + t.id, t); TYPES['ct_' + t.id] = t.name; }
}
for (const k of Object.keys(STYLES)) { const s = STYLES[k], f = s.fn, it = s.inText, om = s.omit;   // estilos de serie: aceptan tipos propios
  s.fn = (p, o) => f(effP(p), o); s.inText = (p, o, loc) => it(effP(p), o, loc); if (om) s.omit = p => om(effP(p)); }
/* ===== Estilos de cita personalizados (Configuración → se guardan en settings.customStyles del JSON) =====
   Plantilla por tipo de documento: texto con {campos}, [grupos opcionales] (solo salen si todos sus campos tienen valor) y modificadores
   {campo:i:q|alternativa}. Un estilo propio se comporta como los de serie: sale en Exportar y en la pestaña Cita. */
const CU_F = [['authors', 'Autores'], ['author1', 'Primer autor'], ['authorsShort', 'Apellidos (cita en el texto)'], ['editors', 'Editores'], ['title', 'Título'], ['year', 'Año (con a/b si hace falta)'],
  ['date', 'Fecha completa de publicación'], ['datey', 'Fecha completa o, si no hay, el año'], ['venue', 'Revista / editorial / sitio'], ['publisher', 'Editorial del libro o actas'], ['place', 'Lugar de edición'], ['edition', 'Edición'], ['volume', 'Volumen'], ['issue', 'Número'],
  ['pages', 'Páginas'], ['loc', 'Página citada (solo cita en el texto)'], ['doi', 'DOI (sin https://doi.org/)'], ['doiurl', 'DOI como enlace'], ['url', 'URL'], ['link', 'Enlace (DOI o URL según el paper)'], ['accessed', 'Fecha de consulta'],
  ['isbn', 'ISBN'], ['issn', 'ISSN'], ['institution', 'Institución'], ['docNumber', 'Número de documento'], ['series', 'Serie o colección'], ['seriesNumber', 'Número en la serie'], ['conferenceName', 'Nombre del congreso'],
  ['conferencePlace', 'Lugar del congreso'], ['conferenceDates', 'Fechas del congreso'], ['subtype', 'Designación'], ['authorRole', 'Función del autor'], ['userHandle', 'Usuario (@)'], ['thesisType', 'Tipo de trabajo'], ['type', 'Tipo de documento']];
const CU_M = {i: 'Cursiva', b: 'Negrita', q: '«Comillas»', qq: '“Comillas inglesas”', par: '(Paréntesis)', br: '[Corchetes]', up: 'MAYÚSCULAS', low: 'minúsculas', cap: 'Primera en mayúscula', nodot: 'Quitar punto final', dot: 'Añadir punto final', title: 'Título (Cada Palabra)', sent: 'Solo la primera en mayúscula', pp: 'Páginas con p./pp.', dash: 'Rango con raya (–)', first: 'Solo la primera página', raw: 'Texto tal cual (edición)'};
const CU_AU = {ap_ini: 'Apellido, N. N.', ap_ini_sp: 'Apellido NN (Vancouver)', ap_nom: 'Apellido, Nombre', nom_ap: 'Nombre Apellido', ini_ap: 'N. N. Apellido', ap: 'Solo el apellido'};
const CU_LAST = {auto: 'Según idioma (y / &)', ' y ': ' y ', ' & ': ' & ', ' and ': ' and ', ', & ': ', & ', ', ': ', (solo coma)', ' / ': ' / ', '; ': '; '};
const CU_DATE = {long: '24 de octubre de 2017', export: 'Como en Exportar', iso: '2017-10-24', dmy: '24-10-2017', my: 'octubre 2017'};
const cuNew = (name = 'Mi estilo') => ({id: uid(), name, order: 'alpha', numbered: false, numFmt: 'br', dis: true, dateFmt: 'long', lang: 'export',
  au: {fmt: 'ap_ini', sep: ', ', last: 'auto', max: 0, show: 1, etAl: 'et al.', upper: false, firstOnly: false},
  tpl: {'*': '[{authors}. ]({year|s.f.}). {title}. [{venue:i}][, {volume}][({issue})][, {pages:pp}]. [{link}]'}, inText: '({authorsShort}, {year|s.f.}[, {loc:pp}])'});
function cuClean(c) {   // lo que viene de un JSON no se fía: forma y límites
  if (!c || typeof c !== 'object') return null;
  const d = cuNew(String(c.name || 'Estilo').slice(0, 60)); d.id = String(c.id || uid()).replace(/[^\w-]/g, '') || uid();
  d.order = c.order === 'list' ? 'list' : 'alpha'; d.numbered = !!c.numbered; d.numFmt = ['dot', 'br', 'par'].includes(c.numFmt) ? c.numFmt : 'br'; d.dis = c.dis !== false; d.lang = ['es', 'en'].includes(c.lang) ? c.lang : 'export'; d.dateFmt = Object.hasOwn(CU_DATE, c.dateFmt) ? c.dateFmt : 'long';
  const a = c.au && typeof c.au === 'object' ? c.au : {};
  d.au = {fmt: Object.hasOwn(CU_AU, a.fmt) ? a.fmt : 'ap_ini', sep: typeof a.sep === 'string' ? a.sep.slice(0, 10) : ', ', last: typeof a.last === 'string' ? a.last.slice(0, 12) : 'auto', max: Math.max(0, Math.min(99, +a.max || 0)),
    show: Math.max(1, Math.min(99, +a.show || 1)), etAl: typeof a.etAl === 'string' ? a.etAl.slice(0, 20) : 'et al.', upper: !!a.upper, firstOnly: !!a.firstOnly};
  for (const k of ['each', 'first']) if (typeof a[k] === 'string' && a[k]) d.au[k] = a[k].slice(0, 80);
  d.tpl = {}; if (c.tpl && typeof c.tpl === 'object') for (const [k, v] of Object.entries(c.tpl)) if ((k === '*' || Object.hasOwn(TYPES, k)) && typeof v === 'string') d.tpl[k] = v.slice(0, 2000);
  d.inText = typeof c.inText === 'string' ? c.inText.slice(0, 500) : ''; return d;
}
function cuParse(s, i = 0, close = false) {   // → [nodos, posición]; \ escapa el carácter siguiente
  const out = []; let txt = ''; const flush = () => { if (txt) { out.push({t: 'x', v: txt}); txt = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { txt += s[i + 1]; i += 2; continue; }
    if (c === '{') { const j = s.indexOf('}', i); if (j > 0) { flush(); const body = s.slice(i + 1, j), bar = body.indexOf('|'), spec = (bar < 0 ? body : body.slice(0, bar)).split(':').map(x => x.includes('=') ? x.replace(/^\s+/, '') : x.trim());   // los valores de opción conservan sus espacios finales
      out.push({t: 'f', k: spec[0], m: spec.slice(1), fb: bar < 0 ? '' : body.slice(bar + 1)}); i = j + 1; continue; } }
    if (c === '[') { flush(); const r = cuParse(s, i + 1, true); out.push({t: 'g', n: r[0]}); i = r[1]; continue; }
    if (c === ']' && close) { flush(); return [out, i + 1]; }
    txt += c; i++;
  }
  flush(); return [out, i];
}
function cuRender(nodes, get) {
  let s = ''; for (const n of nodes) {
    if (n.t === 'x') s += n.v; else if (n.t === 'f') s += get(n);
    else { const r = cuRender(n.n, get), f = nodesFields(n.n); if (!f.some(x => !get(x))) s += r; }   // el grupo sale solo si todos sus campos directos tienen valor
  } return s;
}
const nodesFields = ns => ns.filter(n => n.t === 'f');
const cuMod = (v, m) => ({i: v => '*' + v + '*', b: v => '**' + v + '**', q: v => '«' + v + '»', qq: v => '“' + v + '”', par: v => '(' + v + ')', br: v => '[' + v + ']', up: v => v.toUpperCase(), low: v => v.toLowerCase(),
  cap: v => v.charAt(0).toUpperCase() + v.slice(1), sent: v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(), title: v => v.toLowerCase().replace(/(^|[\s(«“"-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()), first: v => v.split(/\s*[-–—,]\s*/)[0], nodot: v => v.replace(/\.(\*{0,2})$/, '$1'), dot: endDot, dash: v => v.replace(/\s*[-–—]+\s*/g, '–')}[m]?.(v) ?? v);
const cuTidy = s => s.replace(/\s+/g, ' ').replace(/ +([,.;:)\]»”])/g, '$1').replace(/([(\[«“]) +/g, '$1').replace(/([.,;:])(\s*\1)+/g, '$1').trim();
const MESA = {es: ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'], en: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']};
function cuDate(s, fmt, o, pat) {   // pat: patrón propio con YYYY YY MMMM MMM MM M DD D (en mayúsculas); manda sobre fmt
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m || !okDate(s)) return s || ''; const [, y, mo, d] = m, i = +mo - 1, en = o.lang === 'en', lg = en ? 'en' : 'es';
  if (pat) return pat.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, t => ({YYYY: y, YY: y.slice(2), MMMM: MESF[lg][i], MMM: MESA[lg][i], MM: mo, M: +mo, DD: d, D: +d}[t]));
  return fmt === 'export' ? fdate(s, o) : fmt === 'iso' ? s : fmt === 'dmy' ? `${d}-${mo}-${y}` : fmt === 'my' ? `${MESF[lg][i]} ${y}` : en ? `${MESF.en[i]} ${+d}, ${y}` : `${+d} de ${MESF.es[i]} de ${y}`;
}
const cuAuTpl = (t, x) => t.replace(/\{([lLgin])\}/g, (_, c) => ea({l: x.l, L: x.l.toUpperCase(), g: x.g || '', i: x.g ? ini(x.g, 1) : '', n: x.g ? ini(x.g, 0) : ''}[c]));   // personalizado: {l} apellido · {L} APELLIDO · {g} nombre · {i} iniciales con punto · {n} iniciales
function cuAuthors(P, o, a) {
  if (!P.length) return '';
  let list = P, etal = false; if (a.max && P.length > a.max) { list = P.slice(0, a.show); etal = true; }
  const one = (x, k) => { if (x.org || !x.g) return ea(x.l); const t = k === 0 && a.first ? a.first : a.each; if (t) return cuAuTpl(t, x); const l = ea(a.upper ? x.l.toUpperCase() : x.l); let f = a.fmt;
    if (a.firstOnly && k > 0) f = f === 'ap_nom' ? 'nom_ap' : f === 'ap' ? 'ap' : 'ini_ap';
    return f === 'ap_ini' ? `${l}, ${ini(x.g, 1)}` : f === 'ap_ini_sp' ? `${l} ${ini(x.g, 0)}` : f === 'ap_nom' ? `${l}, ${ea(x.g)}` : f === 'nom_ap' ? `${ea(x.g)} ${l}` : f === 'ini_ap' ? `${ini(x.g, 1)} ${l}` : l; };
  const A = list.map(one);
  if (etal) return A.join(a.sep) + (/^[,;]/.test(a.etAl) ? '' : ' ') + ea(a.etAl);
  if (A.length === 1) return A[0];
  const conj = a.last === 'auto' ? (o.lang === 'en' ? ' & ' : yE(list.at(-1).l) + ' ') : a.last;
  return A.slice(0, -1).join(a.sep) + conj + A.at(-1);
}
function cuShort(P, o) {
  const L = P.map(x => ea(x.l)); if (L.length < 3) return L.length === 2 ? L[0] + (o.lang === 'en' ? ' & ' : yE(P[1].l) + ' ') + L[1] : L[0] || '';
  return L[0] + ' et al.';
}
const cuDec = v => v.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
const cuEnc = v => v.replace(/[%:|{}\[\]\\=]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
function cuSplit(m) { const mods = [], op = {}; for (const x of m) { const i = x.indexOf('='); i > 0 ? op[x.slice(0, i)] = cuDec(x.slice(i + 1)) : mods.push(x); } return [mods, op]; }   // {campo:i:fmt=…}: modificadores y opciones propias del campo
const cuAuO = op => { const r = {}; for (const k of ['fmt', 'sep', 'last', 'each', 'first']) if (op[k] != null && op[k] !== '') r[k] = op[k]; if (op.etal != null && op.etal !== '') r.etAl = op.etal;
  for (const k of ['max', 'show']) if (op[k] != null && op[k] !== '') r[k] = +op[k] || 0; if (op.upper) r.upper = op.upper === '1'; if (op.fo) r.firstOnly = op.fo === '1'; if (r.fmt && !r.each && !r.first) r.each = r.first = ''; return r; };   // elegir un formato en el campo anula las plantillas por autor del estilo
function cuValue(k, p, o, cs, op = {}) {
  switch (k) {
    case 'authors': return cuAuthors(pAuthP(p), o, {...cs.au, ...cuAuO(op)});
    case 'author1': return cuAuthors(pAuthP(p).slice(0, 1), o, {...cs.au, ...cuAuO(op), max: 0});
    case 'authorsShort': return cuShort(pAuthP(p), o);
    case 'editors': return cuAuthors(parse(p.editors || []), o, {...cs.au, ...cuAuO(op)});
    case 'title': return ea(p.title || '');
    case 'year': return p.year ? ea(p.year + (o.ys || '')) : '';
    case 'date': return okDate(p.pubDate) ? cuDate(p.pubDate, op.fmt || cs.dateFmt, o, op.pat) : '';
    case 'datey': return okDate(p.pubDate) && fdOk(p) ? cuDate(p.pubDate, op.fmt || cs.dateFmt, o, op.pat) : p.year ? ea(p.year + (o.ys || '')) : '';
    case 'venue': return ea(p.venue || '');
    case 'edition': return op.raw ? ea(p.edition || '') : ea(edLbl(p.edition, o.lang === 'en' ? 'en' : 'es'));
    case 'doi': return p.doi ? ea(normDoi(p.doi)) : '';
    case 'doiurl': return p.doi ? 'https://doi.org/' + normDoi(p.doi) : '';
    case 'url': return p.url || '';
    case 'link': return citeLink(p);
    case 'accessed': return p.accessed && !p.hideAccessed ? cuDate(p.accessed, op.fmt || cs.dateFmt, o, op.pat) : '';
    case 'type': return TYPES[p.type] || '';
    case 'loc': return ea(o.loc || '');
    default: return CU_F.some(f => f[0] === k) && STR_F.includes(k) ? ea(String(p[k] || '')) : '';
  }
}
const cuGet = (n, p, o, cs) => { const [mods, op] = cuSplit(n.m); if (n.k === 'edition' && mods.includes('raw')) op.raw = 1; let v = cuValue(n.k, p, o, cs, op); if (!v) return n.fb ? ea(n.fb) : '';
  if ((n.k === 'pages' || n.k === 'loc') && mods.includes('pp')) v = ea(pgs(n.k === 'pages' ? p.pages : o.loc, 1));
  for (const m of mods) v = cuMod(v, m); return (op.pre ? ea(op.pre) : '') + v + (op.suf ? ea(op.suf) : ''); };   // pre / suf: texto que solo sale si el campo tiene valor
const cuRun = (tpl, p, o, cs) => cuTidy(cuRender(cuParse(tpl || '')[0], n => cuGet(n, p, o, cs)));
const cuLang = (o, c) => c.lang === 'es' || c.lang === 'en' ? {...o, lang: c.lang} : o;
function syncStyles(list, exp) {   // registra los estilos propios junto a los de serie (clave cu_<id>)
  for (const k of Object.keys(STYLES)) if (k.startsWith('cu_')) delete STYLES[k];
  for (const c of list || []) STYLES['cu_' + c.id] = {name: c.name + ' ✎', custom: true, order: c.order, numbered: c.numbered, numFmt: c.numFmt, dis: c.dis,
    fn: (p, o = ex()) => cuRun(c.tpl[p.type] ?? c.tpl['*'] ?? '', p, cuLang(o, c), c) || ea(p.title || ''),
    inText: (p, o = ex(), loc = '') => c.inText ? [{k: 'En el texto', t: cuRun(c.inText, p, {...cuLang(o, c), loc}, c)}] : [],
    note: 'Estilo personalizado: se edita en Configuración → Estilos de cita personalizados.'};
  if (exp && !STYLES[exp.style]) exp.style = 'apa';
}
const isNum = o => !!(o.num || STYLES[o.style]?.numbered);

const numLbl = (i, o) => { const f = !o.numFmt || o.numFmt === 'auto' ? STYLES[o.style]?.numFmt || 'dot' : o.numFmt; return {dot: `${i}. `, br: `[${i}] `, par: `(${i}) `}[f] || `${i}. `; };   // etiqueta de numeración
const abcLetters = n => { let r = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) r = String.fromCharCode(97 + (n - 1) % 26) + r; return r; };   // 0→a … 25→z, 26→aa
function yearSuffixes(L, o) {   // Map id → letra para obras del mismo autor y año (APA: se ordenan por título); solo estilos con dis
  const m = new Map(), g = new Map();
  if (o.disamb === false || !STYLES[o.style]?.dis) return m;
  for (const p of L) { const au = authP(p); if (!au.length) continue;
    const k = au.map(a => `${a.l}|${a.g}`).join(';').toLowerCase() + '|' + (p.year || 's.f.'); (g.get(k) || g.set(k, []).get(k)).push(p); }
  for (const G of g.values()) if (G.length > 1) [...G].sort((a, b) => a.title.localeCompare(b.title, 'es')).forEach((p, i) => m.set(p.id, abcLetters(i)));
  return m;
}

/* ===== Persistencia =====
   Chrome/Edge: File System Access API (elige un archivo una vez y se guarda/autoguarda sobre él).
   Otros navegadores: abrir con selector y guardar como descarga. */
const FSA = 'showSaveFilePicker' in window;
let handle = null;   // archivo elegido por el usuario
const JSON_T = [{description: 'Datos de papers (JSON)', accept: {'application/json': ['.json']}}];
const idb = (mode, fn) => new Promise((res, rej) => {   // IndexedDB: recuerda el último archivo entre sesiones
  const r = indexedDB.open('gestor-papers', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onerror = () => rej(r.error);
  r.onsuccess = () => { const t = r.result.transaction('k', mode), q = fn(t.objectStore('k')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }; });
const rememberHandle = () => idb('readwrite', st => st.put(handle, 'last')).then(() => $('#reopen').hidden = false).catch(() => {});
function validate(d) {
  if (!d || typeof d !== 'object' || !['papers', 'tags', 'sections'].every(k => Array.isArray(d[k])))
    throw Error('faltan las listas "papers", "tags" o "sections"');
  d.papers.forEach((p, i) => { if (!p.id || typeof p.title !== 'string' || !Array.isArray(p.authors)) throw Error(`el paper n.º ${i + 1} no tiene id, título o autores válidos`);
    p.tagIds ??= []; p.notes ??= []; p.cites ??= {}; p.notes.forEach(n => { n.id ??= uid(); n.content ??= ''; }); p.created ??= ''; p.sortKey ??= ''; p.related = Array.isArray(p.related) ? p.related : []; p.history = [];   // el historial es solo de la sesión: no se lee del JSON
    p.reading = Object.hasOwn(READ, p.reading) ? p.reading : 'por_leer'; p.rating = Number.isInteger(p.rating) && p.rating >= 0 && p.rating <= 5 ? p.rating : 0; p.sectionIds ??= [...new Set(p.notes.map(n => n.sectionId).filter(Boolean))]; NEWF(p); });
  const byId = new Map(d.papers.map(p => [p.id, p]));   // relaciones: sin ids rotos ni repetidos y siempre simétricas
  d.papers.forEach(p => { p.related = [...new Set(p.related)].filter(i => i !== p.id && byId.has(i)); p.refTo = [...new Set(Array.isArray(p.refTo) ? p.refTo : [])].filter(i => i !== p.id && byId.has(i)); });
  d.trash = (Array.isArray(d.trash) ? d.trash : []).filter(t => t && t.at && t.paper && t.paper.id && typeof t.paper.title === 'string' && Array.isArray(t.paper.authors) && trashLeft(t) > 0);   // la papelera caduca a los 5 días
  d.papers.forEach(p => p.related.forEach(i => { const q = byId.get(i); if (!q.related.includes(p.id)) q.related.push(p.id); }));
  [...d.tags, ...d.sections].forEach((x, i) => { if (!x.id || typeof x.name !== 'string') throw Error(`etiqueta/sección n.º ${i + 1} sin id o nombre`); });
  d.sections.forEach(s => s.tagIds ??= []);  // compatibilidad con archivos antiguos
  const sIn = d.settings && typeof d.settings === 'object' ? d.settings : {};
  d.settings = {...defSettings(), ...sIn, shortcuts: {...SC_DEF}};
  d.settings.export = {...defSettings().export, ...(sIn.export && typeof sIn.export === 'object' ? sIn.export : {})};
  const xo = d.settings.export; if (!['es', 'en'].includes(xo.lang)) xo.lang = 'es'; if (!['long', 'dmy', 'iso'].includes(xo.dateFmt)) xo.dateFmt = 'long'; xo.vanAll = !!xo.vanAll; xo.ppChap = !!xo.ppChap; xo.disamb = !!xo.disamb; if (!['auto', 'dot', 'br', 'par'].includes(xo.numFmt)) xo.numFmt = 'auto';
  d.settings.fmtOpen = !!d.settings.fmtOpen; d.settings.view = d.settings.view === 'table' ? 'table' : 'cards';
  if (!Array.isArray(d.settings.templates)) d.settings.templates = defSettings().templates;
  d.settings.templates = d.settings.templates.filter(t => t && typeof t.name === 'string' && typeof t.text === 'string').map(t => ({id: t.id || uid(), name: t.name, text: t.text}));
  d.settings.customTypes = [...new Map((Array.isArray(sIn.customTypes) ? sIn.customTypes : []).map(ctClean).filter(Boolean).map(c => [c.id, c])).values()];
  syncTypes(d.settings.customTypes); d.papers.concat(d.trash.map(t => t.paper)).forEach(p => { if (/^ct_/.test(p.type) && !CTYPES.has(p.type)) p.type = 'articulo'; });
  d.settings.customStyles = [...new Map((Array.isArray(sIn.customStyles) ? sIn.customStyles : []).map(cuClean).filter(Boolean).map(c => [c.id, c])).values()];
  syncStyles(d.settings.customStyles, d.settings.export);
  if (sIn.shortcuts && typeof sIn.shortcuts === 'object') for (const k of Object.keys(SC_DEF)) if (typeof sIn.shortcuts[k] === 'string') d.settings.shortcuts[k] = sIn.shortcuts[k];
  return d;
}
const pickFile = (acc = '.json') => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = acc;
  i.onchange = () => i.files[0] ? i.files[0].text().then(text => res({path: i.files[0].name, text})) : res(null); i.click(); });
async function loadText(text, name) {
  try { db = validate(JSON.parse(text)); path = name; dirty = false; F.tags.clear(); F.sec = ''; SEL.clear(); UNDO.length = 0; REDO.length = 0; lastSnap = JSON.stringify(db); fmtPinned = db.settings.fmtOpen; applySettings(); render(); return true; }
  catch (e) { alert('Archivo no válido (se mantienen los datos actuales): ' + e.message); return false; }
}
async function doOpen() {
  if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otro archivo?')) return;
  try {
    if (FSA) { const [h] = await showOpenFilePicker({types: JSON_T});
      if (await loadText(await (await h.getFile()).text(), h.name)) { handle = h; rememberHandle(); } }
    else { const r = await pickFile(); if (r) { handle = null; await loadText(r.text, r.path); } }
  } catch (e) { if (e.name !== 'AbortError') alert('No se pudo abrir el archivo: ' + e.message); }
}
async function reopenLast() {   // Chrome pide confirmar el acceso al archivo en cada sesión
  if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos y abrir el último archivo?')) return;
  try { const h = await idb('readonly', st => st.get('last')); if (!h) return;
    if (await h.requestPermission({mode: 'readwrite'}) !== 'granted') return alert('Sin permiso para acceder al archivo.');
    if (await loadText(await (await h.getFile()).text(), h.name)) handle = h;
  } catch (e) { alert('No se pudo reabrir el archivo: ' + e.message); }
}
async function writeTo(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }   // el archivo solo cambia al cerrar: escritura segura
function download(text, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function save(asNew) {
  const text = dbJSON();
  try {
    if (FSA) { if (!handle || asNew) { handle = await showSaveFilePicker({suggestedName: path || 'papers.json', types: JSON_T}); rememberHandle(); path = handle.name; }
      await writeTo(handle, text); }
    else { path = path || 'papers.json'; download(text, path, 'application/json'); }
    dirty = false; hdr();
  } catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
}
async function setAuto(c) {
  auto = c.checked;
  if (auto && !handle) { await save(true); if (!handle) c.checked = auto = false; }   // la primera vez pide dónde guardar
  else if (auto) markDirty();
}
const UNDO = [], REDO = [], MAXU = 50;
let lastSnap = null, lastRecAt = 0;
function record() {   // antes de cada cambio guarda el estado anterior; los cambios seguidos (<1,5 s) forman un solo paso
  const cur = JSON.stringify(db);
  if (lastSnap === null || cur === lastSnap) { lastSnap = cur; return; }
  if (!(Date.now() - lastRecAt < 1500 && UNDO.length)) { UNDO.push(lastSnap); if (UNDO.length > MAXU) UNDO.shift(); }
  lastRecAt = Date.now(); REDO.length = 0; lastSnap = cur;
}
function touch() { hdr(); clearTimeout(timer); if (auto && handle) timer = setTimeout(() => save(false), 1000); }
function markDirty() { record(); dirty = true; touch(); }
function undo() { if (UNDO.length) { REDO.push(JSON.stringify(db)); restore(UNDO.pop()); } }
function redo() { if (REDO.length) { UNDO.push(JSON.stringify(db)); restore(REDO.pop()); } }
function restore(json) {
  db = JSON.parse(json); lastSnap = json; lastRecAt = 0; syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export);
  for (const id of [...SEL]) if (!db.papers.some(p => p.id === id)) SEL.delete(id);
  dirty = true; applySettings(); render(); if ($('#cfg').open) drawCfg(); touch();
}
window.onbeforeunload = e => dirty ? (e.preventDefault(), '') : undefined;

/* ===== Importar referencias (BibTeX, RIS y DOI vía CrossRef) ===== */
const normDoi = s => String(s || '').trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '').trim().toLowerCase();
const cleanText = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || '').replace(/<[^>]+>/g, ''); return t.value.replace(/\s+/g, ' ').trim(); };
const normTitle = s => cleanText(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ACC = {"'": '\u0301', '`': '\u0300', '"': '\u0308', '^': '\u0302', '~': '\u0303'};
const untex = s => s.replace(/\\(['`"^~])\s*\{?\\?([a-zA-Z])\}?/g, (_, a, c) => (c + ACC[a]).normalize('NFC')).replace(/\\c\s*\{?([cC])\}?/g, (_, c) => (c + '\u0327').normalize('NFC'))
  .replace(/\\ss\b/g, 'ß').replace(/\\&/g, '&').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
const fixAuthor = a => { a = a.trim(); if (a.includes(',')) return a.replace(/\s*,\s*/, ', '); const w = a.split(/\s+/); return w.length > 1 ? `${w.at(-1)}, ${w.slice(0, -1).join(' ')}` : a; };   // → «Apellido, Nombre»
const BIBT = {article: 'articulo', book: 'libro', incollection: 'capitulo', inbook: 'capitulo', inproceedings: 'congreso', conference: 'congreso', proceedings: 'congreso', phdthesis: 'tesis', mastersthesis: 'tesis', techreport: 'informe', report: 'informe', standard: 'norma', patent: 'patente', dataset: 'dataset', software: 'software', legislation: 'legislacion', movie: 'audiovisual', video: 'audiovisual', music: 'audio', audio: 'audio', misc: 'web', online: 'web', electronic: 'web'};
const RIST = {RPRT: 'informe', STAND: 'norma', PAT: 'patente', MAP: 'mapa', DATA: 'dataset', COMP: 'software', DBASE: 'basedatos', VIDEO: 'audiovisual', MPCT: 'audiovisual', ADVS: 'audiovisual', SOUND: 'audio', MUSIC: 'audio', PCOMM: 'personal', SLIDE: 'presentacion', DICT: 'diccionario', ENCYC: 'diccionario', STAT: 'legislacion', BILL: 'legislacion', LEGAL: 'legislacion', NEWS: 'prensa', MGZN: 'prensa', BLOG: 'blog', JOUR: 'articulo', BOOK: 'libro', CHAP: 'capitulo', CONF: 'congreso', CPAPER: 'congreso', THES: 'tesis', ELEC: 'web', WEB: 'web'};
const CRT = {dataset: 'dataset', report: 'informe', 'report-component': 'informe', 'report-series': 'informe', standard: 'norma', 'journal-article': 'articulo', book: 'libro', monograph: 'libro', 'edited-book': 'libro', 'book-chapter': 'capitulo', 'reference-entry': 'capitulo', 'proceedings-article': 'congreso', dissertation: 'tesis'};
const P2_F = ['isbn', 'issn', 'series', 'seriesNumber', 'institution', 'docNumber', 'conferenceName', 'conferencePlace', 'conferenceDates'];
const P3_F = ['subtype', 'authorRole', 'userHandle'];   // F3d–F3e
const IMP_F = ['volume', 'issue', 'pages', 'publisher', 'place', 'edition', 'pubDate', 'thesisType', ...P2_F, 'subtype', 'authorRole', 'userHandle', 'editors', 'authorType', 'accessed'];   // campos que traen los importadores además de los básicos
const MON = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, ene: 1, abr: 4, ago: 8, dic: 12};
const monNum = m => { m = String(m ?? '').trim().toLowerCase(); return /^\d{1,2}$/.test(m) ? (+m >= 1 && +m <= 12 ? +m : 0) : MON[m.slice(0, 3)] || 0; };
const isoDate = (y, m, d) => { y = String(y ?? '').match(/\d{4}/)?.[0]; m = monNum(m); d = +(String(d ?? '').match(/\d{1,2}/)?.[0] || 0);   // solo si hay año, mes y día
  return y && m && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''; };
const normPages = s => String(s ?? '').replace(/\s*(--|–|—)\s*/g, '-').replace(/\s+/g, ' ').trim();
const thesisFrom = (kind, bib) => { const k = String(kind ?? '').toLowerCase();   // texto libre → uno de THESIS
  if (/doctor|ph\.?d|dissert/.test(k)) return 'Tesis doctoral'; if (/grado|bachelor|undergrad|tfg/.test(k)) return 'Trabajo fin de grado';
  if (/m[aá]ster|master|tfm/.test(k)) return 'Trabajo fin de máster'; if (/carrera|pfc/.test(k)) return 'Proyecto fin de carrera';
  return bib === 'phdthesis' ? 'Tesis doctoral' : bib === 'mastersthesis' ? 'Trabajo fin de máster' : ''; };
const refFields = (ty, o) => {   // deja solo los campos que el tipo usa (FLD_T) y rellena el resto con valores vacíos
  const r = {volume: '', issue: '', pages: '', publisher: '', place: '', edition: '', pubDate: '', thesisType: '', ...Object.fromEntries([...P2_F, ...P3_F].map(k => [k, ''])), editors: [], authorType: 'auto', accessed: ''};
  for (const k of IMP_F) if (o[k] != null && o[k] !== '' && (!FLD_T[k] || shows(k, ty))) r[k] = o[k];
  return r; };

function bibBody(t, i) {   // i = posición tras la llave de apertura; devuelve [contenido, posición siguiente]
  let d = 1, j = i;
  for (; j < t.length && d > 0; j++) { if (t[j] === '{') d++; else if (t[j] === '}') d--; }
  return [t.slice(i, j - 1), j];
}
function parseBib(t) {   // recorrido propio: las expresiones regulares fallan con llaves anidadas
  const out = [], re = /@(\w+)\s*\{/g; let m;
  while ((m = re.exec(t))) {
    const [body, next] = bibBody(t, re.lastIndex); re.lastIndex = next;
    const type = m[1].toLowerCase(), f = {}; let k = body.indexOf(',') + 1;
    if (['comment', 'preamble', 'string'].includes(type) || !k) continue;
    while (k < body.length) {
      const nm = /\s*,?\s*([\w-]+)\s*=\s*/y; nm.lastIndex = k; const mm = nm.exec(body); if (!mm) break;
      k = nm.lastIndex; let v;
      if (body[k] === '{') [v, k] = bibBody(body, k + 1);
      else if (body[k] === '"') { let d = 0, j = k + 1; for (; j < body.length; j++) { if (body[j] === '{') d++; else if (body[j] === '}') d--; else if (body[j] === '"' && d === 0) break; } v = body.slice(k + 1, j); k = j + 1; }
      else { const e = body.indexOf(',', k), end = e < 0 ? body.length : e; v = body.slice(k, end).trim(); k = end; }
      f[mm[1].toLowerCase()] = v;
    }
    const g = key => untex(f[key] || ''), pick = (...ks) => ks.map(g).find(Boolean) || '', how = g('howpublished'), sub = g('entrysubtype').toLowerCase(), ty0 = BIBT[type] || 'articulo',
      ty = Object.hasOwn(TYPES, sub) ? sub : ty0 === 'articulo' && /^(newspaper|magazine)$/.test(sub) ? 'prensa' : ty0 === 'web' && (sub === 'blog' || /^blog$/i.test(how.trim())) ? 'blog' : ty0;   // F3b: prensa = @article + entrysubtype newspaper/magazine; blog = @online/@misc + entrysubtype blog
    const names = v => (v || '').split(/\s+and\s+/i).map(a => a.trim()).filter(a => a && !/^others$/i.test(a));
    const nm = a => /^\{.*\}$/.test(a) ? untex(a) : fixAuthor(untex(a)), raw = names(f.author);
    const GV = pick('organization', 'institution', 'publisher', 'journal', 'journaltitle', 'booktitle') || (/https?:|\\url|^(blog|norma|standard)$/i.test(how.trim()) ? '' : how);   // venue de los tipos F3c–F3e
    const V = {prensa: pick('journal', 'journaltitle'), informe: pick('institution', 'publisher', 'organization'), norma: pick('organization', 'institution', 'publisher'), patente: GV, mapa: GV, dataset: GV, software: GV, basedatos: GV, audiovisual: GV, audio: GV, redsocial: GV, ia: GV, diccionario: GV, presentacion: GV, personal: GV, legislacion: GV,
      blog: pick('journal', 'journaltitle', 'booktitle', 'organization', 'publisher') || (/https?:|\\url|^blog$/i.test(how.trim()) ? '' : how), articulo: pick('journal', 'journaltitle'), libro: pick('publisher'), capitulo: pick('booktitle'), congreso: pick('booktitle'), tesis: pick('school', 'institution'),
      web: pick('journal', 'booktitle', 'publisher', 'organization') || (/https?:|\\url/i.test(how) ? '' : how)}[ty];
    const venue = V || pick('journal', 'journaltitle', 'booktitle', 'publisher', 'school', 'institution');
    const dt = g('date'), pub = pick('publisher');
    out.push({title: g('title'), year: (g('year') || dt).match(/\d{4}/)?.[0] || '', venue, doi: normDoi(g('doi')), url: g('url'), type: ty, authors: raw.map(nm),
      ...refFields(ty, {volume: g('volume'), issue: pick('issue', 'number'), pages: normPages(g('pages')), publisher: pub && pub !== venue ? pub : '', place: pick('address', 'location'), edition: g('edition'),
        pubDate: /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : isoDate(g('year'), g('month'), g('day')), thesisType: ty === 'tesis' ? thesisFrom(g('type'), type) : '', editors: names(f.editor).map(nm),
        isbn: g('isbn'), issn: g('issn'), series: g('series'), seriesNumber: g('seriesnumber'), institution: g('institution') !== venue ? g('institution') : '',
        docNumber: g('docnumber') || (ty === 'legislacion' ? '' : g('number')), subtype: g('type'), authorRole: g('authorrole'), userHandle: g('userhandle'), conferenceName: ty === 'congreso' || ty === 'capitulo' ? '' : g('booktitle'), conferencePlace: '', conferenceDates: '',
        authorType: raw.length && raw.every(a => /^\{[^,]*\}$/.test(a)) ? 'entidad' : 'auto', accessed: /^\d{4}-\d{2}-\d{2}$/.test(g('urldate')) ? g('urldate') : ''})});
  }
  return out;
}
function finRis(r) {   // convierte los campos RIS acumulados (r.raw) en una referencia de la app
  const R = r.raw, gk = /gestor:(\w+)/.exec(R.N1 || ''), ty = gk && Object.hasOwn(TYPES, gk[1]) ? gk[1] : r.type, f = (...ks) => ks.map(k => R[k]).find(Boolean) || '';
  const GV = f('PB', 'T2', 'JO');
  const V = {informe: GV, norma: GV, patente: GV, mapa: GV, dataset: GV, software: GV, basedatos: GV, audiovisual: GV, audio: GV, redsocial: GV, ia: GV, presentacion: GV, personal: GV, legislacion: GV, diccionario: f('T2', 'BT', 'PB'), prensa: f('JO', 'JF', 'J2', 'T2'), blog: f('T2', 'JO', 'PB'), articulo: f('JO', 'JF', 'J2', 'T2'), libro: f('PB', 'T2'), capitulo: f('T2', 'BT', 'JO'), congreso: f('T2', 'JO', 'BT'), tesis: f('PB', 'T2'), web: f('T2', 'JO', 'PB')}[ty];
  const venue = V || f('JO', 'JF', 'J2', 'T2', 'PB'), da = (R.DA || '').split('/'), y2 = (R.Y2 || '').split('/');
  const pages = R.SP && R.EP ? (R.SP === R.EP ? R.SP : `${R.SP}-${R.EP}`) : normPages(R.SP || '');
  return {title: f('TI', 'T1'), authors: r.authors, year: f('PY', 'Y1', 'DA').match(/\d{4}/)?.[0] || '', venue, doi: normDoi(R.DO || ''), url: R.UR || '', type: ty,
    ...refFields(ty, {volume: R.VL, issue: R.IS, pages, publisher: R.PB && R.PB !== venue ? R.PB : '', place: R.CY, edition: R.ET, pubDate: isoDate(...da), thesisType: ty === 'tesis' ? thesisFrom(R.M3, '') : '',
      editors: r.editors, accessed: isoDate(...y2),
      isbn: ty === 'articulo' ? '' : R.SN, issn: ty === 'articulo' ? R.SN : '', series: R.T3, seriesNumber: ty === 'articulo' ? '' : R.IS, conferencePlace: R.AD, docNumber: R.M1, subtype: R.M3, authorRole: R.C1, userHandle: R.C2})};
}
function parseRis(t) {
  const out = []; let r = null;
  for (const line of t.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/.exec(line); if (!m) continue;
    const [, k, v] = m;
    if (k === 'TY') { if (r) out.push(finRis(r)); r = {type: RIST[v.trim()] || 'articulo', authors: [], editors: [], raw: {}}; }
    else if (!r) continue;
    else if (k === 'ER') { out.push(finRis(r)); r = null; }
    else if (k === 'AU' || k === 'A1') r.authors.push(fixAuthor(v));
    else if (k === 'A2' || k === 'ED') r.editors.push(fixAuthor(v));
    else if (v.trim()) r.raw[k] ||= v.trim();
  }
  if (r) out.push(finRis(r));
  return out;
}
function fromCrossref(m, doi) {   // mensaje de la API de CrossRef → referencia de la app
  const ty = CRT[m.type] || 'web', nm = a => a.family ? a.family + (a.given ? ', ' + a.given : '') : a.name || '', au = m.author || [], dp = m.issued?.['date-parts']?.[0] || [];
  const venue = cleanText(m['container-title']?.[0] || (ty === 'tesis' && m.institution?.[0]?.name) || m.publisher), pub = cleanText(m.publisher);
  return {title: cleanText(m.title?.[0]), authors: au.map(nm).filter(Boolean), year: String(dp[0] || ''), venue, doi, url: 'https://doi.org/' + doi, type: ty,
    ...refFields(ty, {volume: cleanText(m.volume), issue: cleanText(m.issue), pages: normPages(m.page), publisher: pub !== venue ? pub : '', place: cleanText(m['publisher-location']),
      edition: cleanText(m['edition-number']), pubDate: dp.length === 3 ? isoDate(...dp) : '', isbn: cleanText(m.ISBN?.[0]), issn: cleanText(m.ISSN?.[0]), editors: (m.editor || []).map(nm).filter(Boolean),
      authorType: au.length && au.every(a => !a.family && a.name) ? 'entidad' : 'auto'})};
}
async function fetchDoi(raw) {
  const doi = normDoi(raw); if (!doi) throw Error('Escribe un DOI.');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await fetch('https://api.crossref.org/works/' + encodeURI(doi), {signal: ac.signal});
    if (r.status === 404) throw Error('CrossRef no encuentra ese DOI.');
    if (!r.ok) throw Error('CrossRef respondió con un error (' + r.status + ').');
    return fromCrossref((await r.json()).message, doi);
  } catch (e) { throw Error(e.name === 'AbortError' ? 'CrossRef tardó demasiado en responder.' : e instanceof TypeError ? 'No se pudo conectar con CrossRef (¿sin conexión, o abierta desde file://?).' : e.message); }
  finally { clearTimeout(tm); }
}
function impPrepare(refs) {   // marca duplicados (mismo DOI o mismo título) frente al archivo y dentro del propio lote
  const dois = new Set(db.papers.map(p => normDoi(p.doi)).filter(Boolean)), tits = new Set(db.papers.map(p => normTitle(p.title)).filter(Boolean));
  refs.forEach(r => { const t = normTitle(r.title); r.bad = !r.title;
    r.dup = !r.bad && ((r.doi && dois.has(r.doi)) || (t && tits.has(t))); r.on = !r.bad && !r.dup;
    if (r.doi) dois.add(r.doi); if (t) tits.add(t); });
  return refs;
}
const FLD = [['title', 'Título'], ['authors', 'Autores'], ['year', 'Año'], ['venue', 'Revista / editorial'], ['url', 'URL'], ['type', 'Tipo'], ['volume', 'Volumen'], ['issue', 'Número'], ['pages', 'Páginas'], ['publisher', 'Editorial'], ['place', 'Lugar'], ['edition', 'Edición'], ['editors', 'Editores'], ['pubDate', 'Fecha de publicación'], ['isbn', 'ISBN'], ['issn', 'ISSN']];
let IMP = {mode: '', refs: []};
function openImport(mode) {   // desde el menú del clic derecho en 📂 (o el atajo)
  ctxClose();
  if (mode === 'file') return impFile();
  IMP = {mode, refs: []}; impDraw(); $('#imp').showModal();
}
async function impFile() {
  try {
    let text;
    if (FSA) { const [h] = await showOpenFilePicker({types: [{description: 'Referencias (BibTeX / RIS)', accept: {'text/plain': ['.bib', '.ris', '.txt']}}]}); text = await (await h.getFile()).text(); }
    else { const r = await pickFile('.bib,.ris,.txt'); if (!r) return; text = r.text; }
    impText(text);
  } catch (e) { if (e.name !== 'AbortError') alert('No se pudo leer el archivo: ' + e.message); }
}
function impText(t) {
  t = t.replace(/^\uFEFF/, '');
  const refs = /^\s*TY\s{2}-/m.test(t) ? parseRis(t) : /@\w+\s*\{/.test(t) ? parseBib(t) : [];
  if (!refs.length) return alert('No se reconoce ninguna referencia. Usa un archivo BibTeX (.bib) o RIS (.ris).');
  IMP = {mode: 'prev', refs: impPrepare(refs)}; impDraw(); if (!$('#imp').open) $('#imp').showModal();
}
async function impDoi() {
  $('#iMsg').textContent = 'Buscando…';
  try { IMP = {mode: 'prev', refs: impPrepare([await fetchDoi($('#iDoi').value)])}; impDraw(); } catch (e) { $('#iMsg').textContent = e.message; }
}
function impDraw() {
  const m = IMP.mode, close = `<button onclick="$('#imp').close()">Cancelar</button>`;
  let h = `<h2>${m === 'fill' ? 'Datos de CrossRef' : 'Importar referencias'}</h2>`;
  if (m === 'text') h += `<textarea id="iTxt" style="min-height:220px" placeholder="Pega aquí BibTeX o RIS"></textarea><div class="row" style="margin-top:10px"><button class="pri" onclick="impText($('#iTxt').value)">Analizar</button>${close}</div>`;
  else if (m === 'doi') h += `<div class="row"><input id="iDoi" style="flex:1" placeholder="10.1000/xyz123 o https://doi.org/…" onkeydown="if(event.key==='Enter')impDoi()"><button class="pri" onclick="impDoi()">Buscar</button></div><p id="iMsg" class="empty"></p>${close}`;
  else if (m === 'fill') {
    const j = v => Array.isArray(v) ? v.join('; ') : String(v ?? ''), r = IMP.ref, cur = k => j(D[k]), nw = k => j(r[k]), L = FLD.filter(([k]) => nw(k) && nw(k) !== cur(k) && (!FLD_T[k] || shows(k, r.type)));
    h += (L.length ? '<p>Marca los datos que quieras aplicar (por defecto, solo los campos vacíos):</p>' + L.map(([k, t]) => `<label class="irow"><input type="checkbox" id="f_${k}" ${cur(k) ? '' : 'checked'}><span><b>${t}</b><br><small>Ahora: ${esc(cur(k)) || '—'}</small><br><small>CrossRef: ${esc(nw(k))}</small></span></label>`).join('') : '<p>CrossRef no aporta datos nuevos.</p>')
      + `<div class="row" style="margin-top:12px"><button class="pri" onclick="fillGo()">Aplicar</button>${close}</div>`;
  } else {
    const R = IMP.refs, nd = R.filter(r => r.dup).length;
    h += `<p>${R.length} encontrados${nd ? ` · ${nd} posibles duplicados (desmarcados)` : ''}</p><div class="ilist">${R.map((r, i) => `<label class="irow"><input type="checkbox" ${r.on ? 'checked' : ''} ${r.bad ? 'disabled' : ''} onchange="IMP.refs[${i}].on=this.checked;impCount()"><span><b>${esc(r.title || '(sin título)')}</b>${r.dup ? ' <span class="tag-dup">Duplicado</span>' : ''}${r.bad ? ' <span class="tag-dup">No legible</span>' : ''}<br><small>${esc(r.authors.join('; '))}${r.year ? ' · ' + esc(r.year) : ''}${r.venue ? ' · ' + esc(r.venue) : ''}</small></span></label>`).join('')}</div>
      <div class="grid" style="margin-top:10px"><label>Sección<select id="iSec"><option value="">(ninguna)</option>${db.sections.map(s => `<option value="${s.id}" ${F.sec === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label>Etiqueta<select id="iTag"><option value="">(ninguna)</option>${db.tags.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <label>Estado de lectura<select id="iRd">${Object.entries(READ).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:12px"><button class="pri" id="iGo" onclick="impGo()"></button>${close}</div>`;
  }
  $('#imp').innerHTML = h;
  if (m === 'doi') $('#iDoi').focus(); if (m === 'prev') impCount();
}
const impCount = () => $('#iGo').textContent = 'Importar ' + IMP.refs.filter(r => r.on).length;
function impGo() {
  const L = IMP.refs.filter(r => r.on); if (!L.length) return alert('No hay ninguna referencia marcada.');
  const sec = $('#iSec').value, tag = $('#iTag').value, rd = $('#iRd').value, now = new Date().toISOString();
  L.forEach(r => db.papers.push(NEWF({id: uid(), created: now, title: r.title, alias: '', reading: rd, rating: 0, sectionIds: sec ? [sec] : [], authors: r.authors, year: r.year ? +r.year : '', url: r.url || '', type: r.type,
    venue: r.venue || '', doi: r.doi || '', ...Object.fromEntries(IMP_F.filter(k => r[k] != null).map(k => [k, r[k]])), general: '', tagIds: tag ? [tag] : [], notes: [], cites: {}, related: [], refTo: [], history: [{t: now, s: 'Importado'}]})));
  markDirty(); $('#imp').close(); render(); alert(`Se añadieron ${L.length} papers.`);   // una sola operación: un único Ctrl+Z la deshace
}
async function doiFill() {   // botón «Buscar» junto al DOI en la ventana de editar
  try { IMP = {mode: 'fill', ref: await fetchDoi(D.doi)}; impDraw(); $('#imp').showModal(); } catch (e) { alert(e.message); }
}
function fillGo() {
  const r = IMP.ref;
  for (const [k] of FLD) if ($('#f_' + k)?.checked) D[k] = k === 'year' ? +r.year || '' : r[k];
  if ($('#f_authors')?.checked && r.authorType === 'entidad' && D.authorType === 'auto') D.authorType = 'entidad';
  D.doi = r.doi; $('#imp').close(); drawD();
}
function openMenu(e) { ctxShow(e, `<div class="ctxh">Importar referencias</div><button onclick="openImport('file')">📄 Desde archivo (.bib / .ris)</button><button onclick="openImport('text')">📋 Pegar texto BibTeX / RIS</button><button onclick="openImport('doi')">🔎 Buscar por DOI</button>`); }

/* ===== Atajos de teclado (editables en Configuración; se guardan en settings.shortcuts) ===== */
let recAct = null;   // acción cuyo atajo se está grabando
function comboOf(e) {   // p. ej. «Ctrl+Shift+Z»; null si solo se ha pulsado un modificador
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
  parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join('+');
}
const SC_ACT = {
  open: () => doOpen(), save: () => save(false), newPaper: () => openPaper(), undo, redo, exportCites: () => openEx(), import: () => openImport('file'),
  find: () => { $('#side').classList.remove('min'); $('#sg-search').classList.remove('fold'); $('#q').focus(); }
};
document.addEventListener('keydown', e => {
  if (recAct) return;
  const combo = comboOf(e); if (!combo) return;
  const act = Object.keys(SC_DEF).find(a => db.settings.shortcuts[a] === combo); if (!act) return;
  if (act === 'bold' || act === 'italic') { const ed = e.target.closest?.('.ned'); if (ed) { e.preventDefault(); edCmd(ed.dataset.key, act === 'bold' ? 'bold' : 'italic'); } return; }   // solo dentro de una nota
  const inText = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  // Dentro de campos de texto o con una ventana abierta, solo funciona Guardar; lo demás es el comportamiento nativo (p. ej. Ctrl+Z en una nota)
  if (act !== 'save' && (inText || document.querySelector('dialog[open]'))) return;
  e.preventDefault(); SC_ACT[act]();
});
window.addEventListener('keydown', e => {   // modo grabación: captura la siguiente combinación antes que el resto de atajos
  if (!recAct) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape') { recAct = null; drawCfg(); return; }
  if (['Backspace', 'Delete'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) return setSC(recAct, '');
  const combo = comboOf(e); if (!combo) return;
  const other = Object.keys(SC_DEF).find(a => a !== recAct && db.settings.shortcuts[a] === combo);
  if (other) return alert(`«${combo}» ya está asignado a «${SC_NAMES[other]}». Quítalo de esa acción o elige otra combinación.`);
  setSC(recAct, combo);
}, true);
function setSC(a, combo) { db.settings.shortcuts[a] = combo; recAct = null; markDirty(); drawCfg(); }
function resetSC() { recAct = null; db.settings.shortcuts = {...SC_DEF}; markDirty(); drawCfg(); }

/* ===== Configuración (paleta, nombre de la app, mostrar archivo) ===== */
const PAL = {   // l = modo claro, d = modo oscuro, c = color de muestra; «azul» usa los colores base del CSS
  azul: {n: 'Azul', c: '#2457c5', l: {}, d: {}},
  verde: {n: 'Verde', c: '#1f7a4d', l: {pri: '#1f7a4d', bg: '#f5f9f6', card: '#ffffff', bd: '#cfdcd3', fg: '#1b2a21'}, d: {pri: '#5fcf94', bg: '#141b17', card: '#1c2520', bd: '#34443b', fg: '#e4eee8'}},
  morado: {n: 'Morado', c: '#6b45c2', l: {pri: '#6b45c2', bg: '#f8f6fc', card: '#ffffff', bd: '#d9d3e8', fg: '#241d33'}, d: {pri: '#a78bf0', bg: '#18141f', card: '#211c2b', bd: '#3d3552', fg: '#ebe6f5'}},
  ambar: {n: 'Ámbar', c: '#c25b0a', l: {pri: '#c25b0a', bg: '#fbf8f4', card: '#ffffff', bd: '#e3d7c7', fg: '#2b2218'}, d: {pri: '#f0a45c', bg: '#1a1612', card: '#241e18', bd: '#4a3e31', fg: '#f1e9de'}},
  grafito: {n: 'Grafito', c: '#3d4655', l: {pri: '#3d4655', bg: '#f4f4f5', card: '#ffffff', bd: '#d4d4d8', fg: '#18181b'}, d: {pri: '#a1a9b8', bg: '#121214', card: '#1c1c20', bd: '#3a3a40', fg: '#ececf0'}}
};
const VARS = ['pri', 'bg', 'card', 'bd', 'fg', 'red'];
const LAB = [['pri', 'Acento (botones y selección)'], ['bg', 'Fondo'], ['card', 'Tarjetas y ventanas'], ['bd', 'Bordes'], ['fg', 'Texto'], ['red', 'Eliminar y avisos']];
function applySettings() {
  const c = db.settings, root = document.documentElement.style, dark = matchMedia('(prefers-color-scheme: dark)').matches, v = c.palette === 'custom' && c.custom ? c.custom : (PAL[c.palette] || PAL.azul)[dark ? 'd' : 'l'];
  VARS.forEach(k => v[k] ? root.setProperty('--' + k, v[k]) : root.removeProperty('--' + k));
  $('#appName').textContent = c.appName || 'Papers';   // solo cambia la cabecera; el título «Gestor de papers» no se toca
  hdr();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
function pickCustom() {   // «Personalizada» parte de los colores que se ven ahora
  const c = db.settings;
  if (!c.custom) { const st = getComputedStyle(document.documentElement); c.custom = {};
    VARS.forEach(k => { let v = st.getPropertyValue('--' + k).trim(); if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map(x => x + x).join(''); c.custom[k] = v; }); }
  c.palette = 'custom'; applySettings(); markDirty(); drawCfg();
}
function setCustom(k, v) { db.settings.custom[k] = v; applySettings(); markDirty(); }
function resetPal() { delete db.settings.custom; setCfg('palette', 'azul'); drawCfg(); }
function setInText(v) { db.settings.export.inText = !!v; markDirty(); }   // ajuste opcional (F4): por defecto oculto
function setCfg(k, v) { db.settings[k] = v; applySettings(); markDirty(); }
function openCfg() { drawCfg(); $('#cfg').showModal(); }
function drawCfg() {
  const c = db.settings;
  $('#cfg').innerHTML = `<div class="dh"><h2>Configuración</h2><div class="dbtn"><button onclick="$('#cfg').close()">Cerrar ✕</button></div></div>
    <label>Nombre de la aplicación<input value="${esc(c.appName)}" maxlength="30" oninput="setCfg('appName', this.value)"></label>
    ${cfgSec('pal', 'Paleta de colores', `<div style="margin:6px 0 10px">${Object.entries(PAL).map(([k, p]) => chip({name: p.n, color: p.c}, c.palette === k, `setCfg('palette','${k}');drawCfg()`)).join('')}${chip({name: 'Personalizada', color: c.custom?.pri || '#888888'}, c.palette === 'custom', 'pickCustom()')}</div>${c.palette === 'custom' && c.custom ? `<div class="cpick">${LAB.map(([k, t]) => `<label class="row"><input type="color" value="${c.custom[k]}" oninput="setCustom('${k}', this.value)"> ${t}</label>`).join('')}<button onclick="resetPal()">Restablecer a Azul</button></div>` : ''}`)}
    <label class="row"><input type="checkbox" ${c.showImg !== false ? 'checked' : ''} onchange="setCfg('showImg', this.checked);render()"> Mostrar la imagen del paper en las tarjetas y la tabla</label>
    <label class="row"><input type="checkbox" ${c.showFile ? 'checked' : ''} onchange="setCfg('showFile', this.checked)"> Mostrar el archivo abierto en la cabecera</label>
    <label class="row"><input type="checkbox" ${c.fmtOpen ? 'checked' : ''} onchange="setFmtDefault(this.checked)"> Barra de formato de las notas desplegada por defecto</label>
    <label class="row"><input type="checkbox" ${c.export.inText ? 'checked' : ''} onchange="setInText(this.checked)"> Mostrar la cita en el texto y las notas (Chicago) en la pestaña «Cita» de cada paper</label>
    ${cfgSec('ct', 'Tipos de documento propios', ctUI())}${cfgSec('cu', 'Estilos de cita personalizados', cuUI())}${cfgSec('tpl', 'Plantillas de nota', tplUI())}${cfgSec('sc', 'Atajos de teclado', `<div class="sct"><small>(clic en una combinación para cambiarla; Retroceso la quita)</small>${Object.keys(SC_NAMES).map(a => `<div class="scr"><span>${SC_NAMES[a]}</span><span class="scb"><button class="${recAct === a ? 'rec' : ''}" onclick="recAct='${a}';drawCfg()">${recAct === a ? 'Pulsa una tecla… (Esc cancela)' : esc(c.shortcuts[a]) || 'Sin asignar'}</button>${c.shortcuts[a] ? `<button title="Quitar" onclick="setSC('${a}','')">✕</button>` : ''}</span></div>`).join('')}<button onclick="resetSC()">Restablecer atajos</button></div>`)}
    <small>Estos ajustes se guardan en el mismo archivo JSON.</small>
`;
}
/* ---- Editor de estilos personalizados (Configuración) ---- */
const CU_BASE = (() => {   // estilos de serie como punto de partida: plantillas aproximadas (en español, salvo IEEE) que se ajustan a mano
  const cg = t => ({...t, congreso: t.congreso ?? t.capitulo});   // el congreso se escribe como un capítulo de actas
  const CONS = '[ \\[Consulta: {accessed}\\].]', CONSM = '[ \\[consultado {accessed}\\]]';
  return {
    apa: {name: 'APA 7', order: 'alpha', dis: true, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_ini', last: 'auto'}, inText: '({authorsShort}, {year|s.f.}[, {loc:pp}])',
      tpl: {'*': '{authors} ({year|s.f.}). {title}. {venue:i}[, {volume:i}][({issue})][, {pages}]. {link}',
        libro: '{authors} ({year|s.f.}). {title:i}[ ({edition})]. {venue}. {link}',
        capitulo: '{authors} ({year|s.f.}). {title}. En [{editors:fmt=ini_ap} (Ed.), ]{venue:i}[ ({pages:pp})]. [{publisher}. ]{link}',
        congreso: '{authors} ({year|s.f.}). {title:i} \\[Comunicación en congreso\\]. {venue}[, {place}]. {link}',
        tesis: '{authors} ({year|s.f.}). {title:i} \\[{thesisType}[, {venue}]\\]. {link}',
        web: '{authors} ({datey:pat=D de MMMM, YYYY|s.f.}). {title:i}. {venue}. {link}',
        prensa: '{authors} ({datey:pat=D de MMMM, YYYY|s.f.}). {title}. {venue:i}. {link}'}},
    vancouver: {name: 'Vancouver', order: 'list', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_ini_sp', last: ', ', max: 6, show: 6, etAl: ', et al.'}, inText: '',
      tpl: cg({'*': '{authors}. {title}. {venue} \\[Internet\\]. {year}' + CONSM + '[; {volume}[({issue})][:{pages}]]. [Disponible en: {link}]',
        libro: '{authors}. {title} \\[Internet\\]. [{edition} ][{place}: ]{venue}; {year}' + CONSM + '. [Disponible en: {link}]',
        capitulo: '{authors}. {title}. [En: {editors}, editor. ]{venue} \\[Internet\\]. [{place}: ]{publisher}; {year}' + CONSM + '. [p. {pages}. ][Disponible en: {link}]',
        tesis: '{authors}. {title} \\[{thesisType:low} en Internet\\]. [{place}: ]{venue}; {year}' + CONSM + '. [Disponible en: {link}]',
        web: '{authors}. {title} \\[Internet\\]. [{place}: ]{venue}; {datey}' + CONSM + '. [Disponible en: {link}]',
        prensa: '{authors}. {title}. {venue} \\[Internet\\]. {datey}' + CONSM + '[; {volume}[({issue})][:{pages}]]. [Disponible en: {link}]'})},
    mla: {name: 'MLA', order: 'alpha', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true, max: 2, show: 1, etAl: ', et al.'}, inText: '({authorsShort}[ {loc}])',
      tpl: cg({'*': '{authors}. “{title}”. {venue:i}[, vol. {volume}][, núm. {issue}], {year}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]',
        libro: '{authors}. {title:i}. [{edition}, ]{venue}, {year}[, {link}]. [Consultado el {accessed}.]',
        capitulo: '{authors}. “{title}”. {venue:i}[, editado por {editors:fmt=nom_ap}], {publisher}, {year}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]',
        tesis: '{authors}. {title:i}. [{thesisType}, ]{venue}, {year}[, {link}]. [Consultado el {accessed}.]',
        web: '{authors}. “{title}”. {venue:i}, {datey:pat=D MMM YYYY}[, {link}]. [Consultado el {accessed}.]',
        prensa: '{authors}. “{title}”. {venue:i}[, vol. {volume}][, núm. {issue}], {datey}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]'})},
    ieee: {name: 'IEEE', order: 'list', numbered: true, numFmt: 'br', dis: false, dateFmt: 'long', lang: 'en', au: {fmt: 'ini_ap', last: ', and '}, inText: '',
      tpl: {'*': '{authors}, “{title},” {venue:i}[, vol. {volume}][, no. {issue}][, pp. {pages}][, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        libro: '{authors}, {title:i}[, {edition}]. [{place}: ]{venue}[, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        capitulo: '{authors}, “{title},” in {venue:i}[, {editors:fmt=ini_ap}, Ed]. [{place}: ]{publisher}[, {date:pat=MMMM YYYY}][, pp. {pages}]. \\[Online\\]. Available: {link}',
        congreso: '{authors}, “{title},” in {venue}[, {place}][, {date:pat=MMMM YYYY}][, pp. {pages}]. \\[Online\\]. Available: {link}',
        tesis: '{authors}, “{title},” Ph.D. dissertation, {venue}[, {place}][, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        web: '{authors}. ({datey:pat=YYYY, MMMM D}). {title}. {venue} \\[Online\\]. Available: {link}',
        prensa: '{authors}, “{title},” {venue:i}, {datey:pat=MMMM D, YYYY}[, pp. {pages}]. \\[Online\\]. Available: {link}'}},
    chicago_af: {name: 'Chicago autor-fecha', order: 'alpha', dis: true, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true}, inText: '({authorsShort} {year|s.f.}[, {loc}])',
      tpl: cg({'*': '{authors}. {year|s.f.}. “{title}”. {venue:i}[ {volume}][, n.º {issue}][ ({date:pat=MMMM})][: {pages}]. [{link}.]',
        libro: '{authors}. {year|s.f.}. {title:i}. [{edition}. ][{place}: ]{venue}. [{link}.]',
        capitulo: '{authors}. {year|s.f.}. “{title}”. En {venue:i}[, editado por {editors:fmt=nom_ap}][, {pages}]. [{place}: ]{publisher}. [{link}.]',
        tesis: '{authors}. {year|s.f.}. “{title}”. {thesisType}, {venue}. [{link}.]',
        web: '{authors}. {year|s.f.}. “{title}”. {venue}. [{link}.]',
        prensa: '{authors}. {year|s.f.}. “{title}”. {venue:i}, {date:pat=D de MMMM de YYYY}. [{link}.]'})},
    chicago_nb: {name: 'Chicago notas y bibliografía', order: 'alpha', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true}, inText: '',
      tpl: cg({'*': '{authors}. “{title}”. {venue:i}[ {volume}][, n.º {issue}][ ({datey:pat=MMMM YYYY})][: {pages}]. [{link}.]',
        libro: '{authors}. {title:i}. [{edition}. ][{place}: ]{venue}, {year|s.f.}. [{link}.]',
        capitulo: '{authors}. “{title}”. En {venue:i}[, editado por {editors:fmt=nom_ap}][, {pages}]. [{place}: ]{publisher}, {year|s.f.}. [{link}.]',
        tesis: '{authors}. “{title}”. {thesisType}, {venue}, {year|s.f.}. [{link}.]',
        web: '{authors}. “{title}”. {venue}, {year|s.f.}. [{link}.]',
        prensa: '{authors}. “{title}”. {venue:i}, {date:pat=D de MMMM de YYYY}. [{link}.]'})},
    une_nf: {name: 'UNE-ISO 690 nombre-fecha', order: 'alpha', dis: true, dateFmt: 'dmy', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', first: '{L}, {g}', each: '{g} {L}'}, inText: '',
      tpl: cg({'*': '{authors}, {year|s.f.}. {title}. En línea. {venue:i}[, {volume:b}][({issue})][, pp. {pages}]. Disponible en: {link}.' + CONS,
        libro: '{authors}, {year|s.f.}. {title:i}. En línea. [{edition}. ][{place}: ]{venue}. Disponible en: {link}.' + CONS,
        capitulo: '{authors}, {year|s.f.}. {title}. En línea. En: {editors:fmt=nom_ap:upper=1} (ed.). {venue:i}. [{place}: ]{publisher}[, pp. {pages}]. Disponible en: {link}.' + CONS,
        tesis: '{authors}, {year|s.f.}. {title:i}. En línea. {thesisType}. [{place}: ]{venue}. Disponible en: {link}.' + CONS,
        web: '{authors}, {year|s.f.}. {title}. {venue}. En línea. {date}. Disponible en: {link}.' + CONS,
        prensa: '{authors}, {year|s.f.}. {title}. En línea. {venue:i}. {date}[, pp. {pages}]. Disponible en: {link}.' + CONS})},
    une_num: {name: 'UNE-ISO 690 numérico', order: 'list', numbered: true, numFmt: 'br', dis: false, dateFmt: 'dmy', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', first: '{L}, {g}', each: '{g} {L}'}, inText: '',
      tpl: cg({'*': '{authors}. {title}. En línea. {venue:i}. {year}[, {volume:b}][({issue})][, pp. {pages}]. Disponible en: {link}.' + CONS,
        libro: '{authors}. {title:i}. En línea. [{edition}. ][{place}: ]{venue}, {year}. Disponible en: {link}.' + CONS,
        capitulo: '{authors}. {title}. En línea. En: {editors:fmt=nom_ap:upper=1} (ed.). {venue:i}. [{place}: ]{publisher}, {year}[, pp. {pages}]. Disponible en: {link}.' + CONS,
        tesis: '{authors}. {title:i}. En línea. {thesisType}. [{place}: ]{venue}, {year}. Disponible en: {link}.' + CONS,
        web: '{authors}. {title}. {venue}. En línea. {date}. Disponible en: {link}.' + CONS,
        prensa: '{authors}. {title}. En línea. {venue:i}. {date}[, pp. {pages}]. Disponible en: {link}.' + CONS})}
  };
})();
/* ---- Botón derecho sobre un campo de la plantilla: opciones propias de ese campo ---- */
let CUF = null;   // {s, e}: posición del {campo…} que se edita dentro del textarea
function cuCtx(e) {
  const t = $('#cuT'), a = t.selectionStart, b = t.selectionEnd, m = [...t.value.matchAll(/\{[^{}]*\}/g)].find(x => a === b ? a > x.index && a < x.index + x[0].length : a < x.index + x[0].length && b > x.index); if (!m) return;   // fuera de un campo: menú normal
  CUF = {s: m.index, e: m.index + m[0].length}; cufShow(e);
}
function cuCtxChip(e, k) {   // botón derecho en la lista de campos: lo inserta y abre sus opciones
  const t = $('#cuT'); if (!t) return; t.focus(); const s = t.selectionStart; t.setRangeText(`{${k}}`, s, t.selectionEnd, 'end'); cuTpl(t.value); CUF = {s, e: s + k.length + 2}; cufShow(e);
}
function cufShow(e) {
  const t = $('#cuT'), n = cuParse(t.value.slice(CUF.s, CUF.e))[0][0]; if (!n || n.t !== 'f') return;
  const [mods, op] = cuSplit(n.m), k = n.k, lab = CU_F.find(f => f[0] === k)?.[1] || k, has = m => mods.includes(m);
  const chk = (m, l) => `<label class="row"><input type="checkbox" data-m="${m}" ${has(m) ? 'checked' : ''} onchange="cufApply()"> ${l}</label>`;
  const sel = (key, o, v, attr = 'data-o') => `<select ${attr}="${key}" onchange="cufApply()">${Object.entries(o).map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const txt = (key, v, ph = '') => `<input data-o="${key}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" oninput="cufApply()">`;
  const num = (key, v) => `<input data-o="${key}" type="number" min="0" max="99" value="${esc(v ?? '')}" placeholder="—" oninput="cufApply()">`;
  const fld = (l, c) => `<label>${l}${c}</label>`, TRI = {'': 'Como el estilo', 1: 'Sí', 0: 'No'}, ST = o => ({'': 'Como el estilo', ...o});
  const pick = (list, v) => Object.fromEntries([['', '—'], ...list.map(x => [x, CU_M[x]])]);
  let h = `<div class="cuf2"><div class="ctxh">Campo «${esc(lab)}»</div>`;
  if (CUF_PERSON.includes(k)) h += `<div class="cuh2">Cómo se escribe cada persona</div>${fld('Formato', sel('fmt', ST(CU_AU), op.fmt))}
    ${fld('Personalizado: primer autor', txt('first', op.first, '{L}, {g}'))}${fld('Personalizado: resto de autores', txt('each', op.each, '{g} {L}'))}
    <small>Para el personalizado: <code>{l}</code> apellido · <code>{L}</code> APELLIDO · <code>{g}</code> nombre · <code>{i}</code> iniciales con punto · <code>{n}</code> iniciales sin punto. Si solo rellenas el del resto, el primero usa el mismo.</small>
    ${fld('Entre autores', txt('sep', op.sep, 'como el estilo'))}${fld('Antes del último', sel('last', ST(CU_LAST), op.last))}
    <div class="cugrid2">${fld('Más de N autores', num('max', op.max))}${fld('Mostrar', num('show', op.show))}</div>${fld('Texto de «y otros»', txt('etal', op.etal, 'et al.'))}
    ${fld('Apellidos en mayúsculas', sel('upper', TRI, op.upper))}${fld('Solo el primero invertido', sel('fo', TRI, op.fo))}`;
  if (CUF_DATE.includes(k)) h += `<div class="cuh2">Fecha</div>${fld('Formato', sel('fmt', ST(CU_DATE), op.fmt))}${fld('Patrón propio', txt('pat', op.pat, 'D de MMMM de YYYY'))}
    <small>Letras: <code>YYYY</code> <code>YY</code> año · <code>MMMM</code> mes completo · <code>MMM</code> mes abreviado · <code>MM</code> <code>M</code> mes en número · <code>DD</code> <code>D</code> día. El patrón manda sobre el formato.</small>`;
  if (k === 'pages' || k === 'loc') h += `<div class="cuh2">Páginas</div>${chk('pp', 'Con «p.» / «pp.»')}${chk('dash', 'Raya en el rango (45–67)')}${chk('first', 'Solo la primera página')}`;
  if (k === 'edition') h += `<div class="cuh2">Edición</div>${chk('raw', 'Tal como se escribe (sin «.ª ed.»)')}`;
  h += `<div class="cuh2">Formato del texto</div><div class="row">${chk('i', 'Cursiva')}${chk('b', 'Negrita')}</div>
    ${fld('Mayúsculas', sel('case', pick(['up', 'low', 'cap', 'sent', 'title']), mods.find(m => ['up', 'low', 'cap', 'sent', 'title'].includes(m)), 'data-case'))}
    ${fld('Rodear con', sel('wrap', pick(['q', 'qq', 'par', 'br']), mods.find(m => ['q', 'qq', 'par', 'br'].includes(m)), 'data-wrap'))}
    ${fld('Punto final', sel('dot', pick(['nodot', 'dot']), mods.find(m => ['nodot', 'dot'].includes(m)), 'data-dot'))}
    <div class="cuh2">Solo si el campo tiene valor</div>${fld('Texto antes', txt('pre', op.pre))}${fld('Texto después', txt('suf', op.suf))}${fld('Si está vacío, poner', `<input data-fb value="${esc(n.fb)}" oninput="cufApply()">`)}
    <div class="row" style="margin-top:6px"><button onclick="cufReset()">Quitar todo el formato</button><button onclick="ctxClose()">Cerrar</button></div></div>`;
  ctxShow(e, h);
}
const CUF_PERSON = ['authors', 'author1', 'editors'], CUF_DATE = ['date', 'datey', 'accessed'];
function cufApply() {
  const t = $('#cuT'), box = $('#ctx'); if (!t || !box || !CUF) return;
  const k = /\{([^:|}]*)/.exec(t.value.slice(CUF.s, CUF.e))?.[1] || '', parts = [k], pick = a => box.querySelector(`[${a}]`)?.value;
  const on = m => box.querySelector(`[data-m="${m}"]`)?.checked;
  for (const m of ['pp', 'dash', 'first', 'raw']) if (on(m)) parts.push(m);
  if (pick('data-case')) parts.push(pick('data-case')); if (pick('data-dot')) parts.push(pick('data-dot'));
  for (const m of ['i', 'b']) if (on(m)) parts.push(m);
  if (pick('data-wrap')) parts.push(pick('data-wrap'));
  box.querySelectorAll('[data-o]').forEach(el => { if (el.value !== '') parts.push(el.dataset.o + '=' + cuEnc(el.value)); });
  const fb = box.querySelector('[data-fb]')?.value, text = '{' + parts.join(':') + (fb ? '|' + fb : '') + '}';
  t.setRangeText(text, CUF.s, CUF.e, 'preserve'); CUF.e = CUF.s + text.length; cuTpl(t.value);
}
function cufReset() { const t = $('#cuT'), k = /\{([^:|}]*)/.exec(t.value.slice(CUF.s, CUF.e))?.[1] || ''; t.setRangeText(`{${k}}`, CUF.s, CUF.e, 'preserve'); cuTpl(t.value); ctxClose(); }
function cuFromBase(k) {   // estilo propio a partir de uno de serie: plantillas de partida que se ajustan a mano
  const B = CU_BASE[k]; if (!B) return; const c = cuClean({name: B.name + ' (personalizado)', order: B.order, numbered: B.numbered, numFmt: B.numFmt, dis: B.dis, dateFmt: B.dateFmt, lang: B.lang, au: B.au, tpl: B.tpl, inText: B.inText}); c.id = uid();
  db.settings.customStyles.push(c); CU = {id: c.id, type: '*', prev: 'ej'}; cuTouch(); drawCfg();
}
let CU = {id: '', type: '*', prev: 'ej'};
const cuCur = () => db.settings.customStyles.find(c => c.id === CU.id) || db.settings.customStyles[0] || null;
const cuSample = ty => NEWF({id: 'ej', title: 'Ejemplo de título del documento', authors: ['Pérez, Juan Carlos', 'Gómez Ruiz, Ana', 'Lee, Min-ho'], editors: ['Martín, Luis'], year: 2021, type: ty, venue: 'Revista de Ejemplo', publisher: 'Editorial Ejemplo',
  place: 'Madrid', edition: '2', volume: '12', issue: '3', pages: '45-67', doi: '10.1000/xyz123', url: 'https://example.org/doc', accessed: '2026-01-15', pubDate: '2021-03-09', isbn: '978-3-16-148410-0', issn: '1234-5678', institution: 'Universidad de Ejemplo',
  docNumber: 'ABC-123', series: 'Serie Ejemplo', seriesNumber: '7', conferenceName: 'Congreso de Ejemplo', conferencePlace: 'Sevilla', conferenceDates: '3-5 de mayo de 2021', subtype: 'Informe técnico', authorRole: 'Director', userHandle: 'ejemplo',
  thesisType: 'Tesis doctoral', notes: [], tagIds: [], cites: {}, sectionIds: [], related: [], refTo: [], history: [], general: ''});
function cuPrev() {
  const el = $('#cuPrev'), c = cuCur(), st = c && STYLES['cu_' + c.id]; if (!el || !st) return;
  const o = {...ex(), ys: ''}, real = CU.prev !== 'ej' && db.papers.find(p => p.id === CU.prev), line = (p, lab) => `<div class="culn">${lab ? `<small>${esc(lab)}</small> ` : ''}${citeHtml(st.fn(p, o)) || '<small>(vacío)</small>'}</div>`;
  const p = real || cuSample(CU.type === '*' ? 'articulo' : CU.type), it = st.inText(p, o, '24');
  el.innerHTML = line(p, real ? '' : TYPES[p.type]) + (it.length ? `<div class="culn"><small>En el texto:</small> ${citeHtml(it[0].t)}</div>` : '')
    + (real ? '' : `<details><summary>Ver el ejemplo en todos los tipos</summary>${Object.entries(TYPES).map(([k, v]) => line(cuSample(k), v)).join('')}</details>`);
}
function cuUI() {
  const L = db.settings.customStyles, c = cuCur(); if (c) CU.id = c.id;
  let h = `<small>Crea tu propio estilo: una plantilla por tipo de documento con los campos de los papers. Sale en Exportar y en la pestaña Cita, y se guarda en el JSON. <a onclick="openHelp('estilos')">Ver la ayuda</a></small>
    <div class="row" style="margin:8px 0">${L.length ? `<select onchange="CU.id=this.value;CU.type='*';drawCfg()">${L.map(x => `<option value="${x.id}" ${c.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
      <button onclick="cuAdd()">+ Nuevo estilo</button><select onchange="cuFromBase(this.value);this.value=''" title="Empieza con las plantillas de uno de los estilos de serie y modifícalas"><option value="">+ Nuevo a partir de…</option>${Object.entries(CU_BASE).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('')}</select>${c ? '<button onclick="cuDup()">Duplicar</button><button class="danger" onclick="cuDel()">Eliminar</button>' : ''}</div>`;
  if (!c) return h + '<p class="empty">Aún no hay estilos personalizados.</p>';
  const sel = (k, o, v, f) => `<select onchange="${f}('${k}',this.value)">${Object.entries(o).map(([a, b]) => `<option value="${esc(a)}" ${String(v) === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const au = c.au, tpl = c.tpl[CU.type] ?? c.tpl['*'] ?? '', over = CU.type !== '*' && c.tpl[CU.type] != null;
  h += `<div class="cugrid">
    <label>Nombre<input value="${esc(c.name)}" maxlength="60" oninput="cuSet('name',this.value)"></label>
    <label>Orden de la bibliografía${sel('order', {alpha: 'Alfabético por autor', list: 'Orden de la lista'}, c.order, 'cuSet')}</label>
    <label class="row"><input type="checkbox" ${c.numbered ? 'checked' : ''} onchange="cuSet('numbered',this.checked)"> Numerada</label>
    <label>Formato del número${sel('numFmt', {dot: '1.', br: '[1]', par: '(1)'}, c.numFmt, 'cuSet')}</label>
    <label class="row"><input type="checkbox" ${c.dis ? 'checked' : ''} onchange="cuSet('dis',this.checked)"> Distinguir 2020a / 2020b</label>
    <label>Formato de fechas${sel('dateFmt', CU_DATE, c.dateFmt, 'cuSet')}</label>
    <label>Idioma de conectores y fechas${sel('lang', {export: 'El de Exportar', es: 'Español', en: 'English'}, c.lang, 'cuSet')}</label></div>
    <div class="cuh">Autores y editores</div><div class="cugrid">
    <label>Cada autor${sel('fmt', CU_AU, au.fmt, 'cuAu')}</label><label>Entre autores<input value="${esc(au.sep)}" maxlength="10" oninput="cuAu('sep',this.value)"></label>
    <label>Antes del último${sel('last', CU_LAST, au.last, 'cuAu')}</label><label>Más de N autores (0 = todos)<input type="number" min="0" max="99" value="${au.max}" oninput="cuAu('max',+this.value)"></label>
    <label>Autores que se muestran<input type="number" min="1" max="99" value="${au.show}" oninput="cuAu('show',+this.value)"></label><label>Texto de «y otros»<input value="${esc(au.etAl)}" maxlength="20" oninput="cuAu('etAl',this.value)"></label>
    <label class="row"><input type="checkbox" ${au.upper ? 'checked' : ''} onchange="cuAu('upper',this.checked)"> Apellidos en mayúsculas</label><label class="row"><input type="checkbox" ${au.firstOnly ? 'checked' : ''} onchange="cuAu('firstOnly',this.checked)"> Solo el primero va «Apellido, …»</label></div>
    <div class="cuh">Plantilla</div>
    <label>Tipo de documento<select onchange="CU.type=this.value;drawCfg()"><option value="*" ${CU.type === '*' ? 'selected' : ''}>Por defecto (todos los tipos)</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${CU.type === k ? 'selected' : ''}>${esc(v)}${c.tpl[k] != null ? ' ✎' : ''}</option>`).join('')}</select></label>
    <textarea id="cuT" rows="4" spellcheck="false" oninput="cuTpl(this.value)" oncontextmenu="cuCtx(event)" placeholder="p. ej. [{authors}. ]({year|s.f.}). {title:i}.">${esc(tpl)}</textarea>
    ${CU.type !== '*' ? `<small>${over ? 'Plantilla propia de este tipo.' : 'Este tipo usa la plantilla por defecto; si la editas aquí, se crea una propia.'}</small>${over ? '<button onclick="cuTplClear()">Quitar la de este tipo</button>' : ''}` : ''}
    <div class="cuh">Campos <small>(clic para insertar; clic derecho sobre un campo, aquí o dentro de la plantilla, para darle formato propio)</small></div><div class="cuf">${CU_F.map(([k, l]) => `<button title="{${k}} · clic derecho: insertar con opciones" onclick="cuIns('{${k}}')" oncontextmenu="cuCtxChip(event,'${k}')">${esc(l)}</button>`).join('')}</div>
    <div class="row" style="margin:6px 0"><button onclick="cuGroup()" title="Lo de dentro solo sale si todos sus campos tienen valor">[ ] Grupo opcional</button>
      <select onchange="cuModIns(this.value);this.value=''" title="Se aplica al campo bajo el cursor"><option value="">Formato del campo…</option>${Object.entries(CU_M).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    <details class="cuhelp"><summary>Cómo se escribe</summary><small>El texto va tal cual. <code>{campo}</code> inserta un dato; <code>{campo:i}</code> lo pone en cursiva (se pueden encadenar: <code>{title:i:q}</code>); <code>{year|s.f.}</code> usa «s.f.» si está vacío.
      <code>[ … ]</code> es un grupo opcional: solo sale si todos los campos de dentro tienen valor. <code>\\</code> escapa el siguiente carácter (<code>\\[</code>). Los puntos y espacios repetidos se limpian solos. Con el <b>botón derecho sobre un campo</b> de la plantilla eliges su formato (autores, fechas, páginas, cursiva, texto antes y después…) y se escribe solo. Los corchetes literales, como en <code>\\[Internet\\]</code>, se escapan con barra.</small></details>
    <label>Cita en el texto (opcional)<input value="${esc(c.inText)}" maxlength="500" oninput="cuSet('inText',this.value)" placeholder="({authorsShort}, {year})"></label>
    <div class="cuh">Vista previa</div><label>Con<select onchange="CU.prev=this.value;cuPrev()"><option value="ej" ${CU.prev === 'ej' ? 'selected' : ''}>Un ejemplo</option>${db.papers.map(p => `<option value="${p.id}" ${CU.prev === p.id ? 'selected' : ''}>${esc(shortTxt(p.alias || p.title))}</option>`).join('')}</select></label>
    <div id="cuPrev" class="cuprev"></div>`;
  setTimeout(cuPrev); return h;
}
const cuTouch = () => { markDirty(); syncStyles(db.settings.customStyles, db.settings.export); cuPrev(); };
function cuSet(k, v) { const c = cuCur(); if (!c) return; c[k] = v; cuTouch(); }
function cuAu(k, v) { const c = cuCur(); if (!c) return; c.au[k] = v; cuTouch(); }
function cuTpl(v) { const c = cuCur(); if (!c) return; c.tpl[CU.type] = v; cuTouch(); }
function cuTplClear() { const c = cuCur(); delete c.tpl[CU.type]; cuTouch(); drawCfg(); }
function cuAdd() { const c = cuNew('Mi estilo ' + (db.settings.customStyles.length + 1)); db.settings.customStyles.push(c); CU = {id: c.id, type: '*', prev: 'ej'}; cuTouch(); drawCfg(); }
function cuDup() { const c = cuCur(), d = structuredClone(c); d.id = uid(); d.name += ' (copia)'; db.settings.customStyles.push(d); CU.id = d.id; cuTouch(); drawCfg(); }
function cuDel() {
  const c = cuCur(); if (!c || !confirm(`¿Eliminar el estilo «${c.name}»? Las citas que lo usen en Exportar volverán a APA.`)) return;
  db.settings.customStyles = db.settings.customStyles.filter(x => x.id !== c.id); CU.id = ''; cuTouch(); drawCfg();
}
function cuEdit(f) {   // aplica f(textarea) sobre la plantilla y guarda el resultado
  const t = $('#cuT'); if (!t) return; t.focus(); f(t); cuTpl(t.value);
}
function cuIns(txt) { cuEdit(t => { const s = t.selectionStart; t.setRangeText(txt, s, t.selectionEnd, 'end'); }); }
function cuGroup() { cuEdit(t => { const s = t.selectionStart, e = t.selectionEnd; t.setRangeText('[' + t.value.slice(s, e) + ']', s, e, 'end'); if (s === e) t.setSelectionRange(s + 1, s + 1); }); }
function cuModIns(m) {
  if (!m) return; cuEdit(t => { const v = t.value, s = t.selectionStart, o = v.lastIndexOf('{', s - 1), c = o < 0 ? -1 : v.indexOf('}', o);
    if (o < 0 || c < s - 1 || v.slice(o, s).includes('}')) return alert('Coloca el cursor dentro de un campo, p. ej. {title}.');
    const bar = v.indexOf('|', o), at = bar > 0 && bar < c ? bar : c; t.setRangeText(':' + m, at, at, 'end'); });
}
/* ===== Ayuda: botón ❓ de la cabecera (o F1) ===== */
const HELP_OPEN = new Set(['inicio']);
const helpSec = (id, title, body) => `<details class="cs" id="hp_${id}" ${HELP_OPEN.has(id) ? 'open' : ''} ontoggle="this.open ? HELP_OPEN.add('${id}') : HELP_OPEN.delete('${id}')"><summary>${title}</summary><div class="csb hp">${body}</div></details>`;
const helpTbl = rows => `<table class="hpt">${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('')}</table>`;
function helpHTML() {
  const sc = db.settings.shortcuts, kb = a => `<kbd>${esc(sc[a] || 'sin asignar')}</kbd>`;
  const S = {
    inicio: ['Primeros pasos', `<p>Esta aplicación guarda tus papers, secciones, etiquetas, notas y ajustes en <b>un único archivo JSON</b> que tú eliges. No hay cuenta ni servidor: todo está en tu navegador y en ese archivo.</p>
      <ul><li><b>Abrir 📂</b> (${kb('open')}): carga un archivo JSON. Clic derecho en 📂 para <i>importar</i> referencias (.bib, .ris, texto o DOI).</li>
      <li><b>Guardar 💾</b> (${kb('save')}) y <b>Guardar como</b>: en Chrome y Edge de escritorio escriben directamente en el archivo; en otros navegadores se descarga una copia.</li>
      <li><b>Autoguardado</b> (solo Chrome/Edge): guarda solo, un segundo después de cada cambio. La primera vez pide el archivo.</li>
      <li><b>Reabrir último</b>: aparece tras abrir un archivo y vuelve a cargarlo en la siguiente sesión (el navegador pide permiso).</li>
      <li>En la versión web se abre al principio <code>ejemplo_papers.json</code> para que pruebes; guarda tu trabajo con «Guardar como».</li>
      <li>Deshacer ${kb('undo')} y rehacer ${kb('redo')} funcionan sobre los cambios de la sesión.</li></ul>
      <p>Qué se guarda en el JSON: papers (con su fecha de creación, notas e imagen), secciones, etiquetas, papelera y todos los ajustes (paleta, atajos, plantillas de nota, tipos y estilos de cita propios). <b>No</b> se guarda el historial de cambios del día ni los enlaces a archivos de imagen locales.</p>`],
    lista: ['Lista principal', `<ul><li><b>Tarjetas o tabla</b>: el botón «Tabla / Tarjetas» cambia la vista. La tabla muestra imagen, título, autores, año, revista, lectura, valoración, secciones, etiquetas y notas.</li>
      <li><b>En cada tarjeta</b>: casilla para seleccionar, <i>Editar</i>, las etiquetas del paper, el estado de lectura, las estrellas y la ✕ (a la papelera). Si las etiquetas no caben en la barra, pasan a su propia línea.</li>
      <li><b>Estado de lectura</b>: un clic lo cambia (por leer → leyendo → leído). <b>Estrellas</b>: clic derecho para elegir la valoración.</li>
      <li><b>Etiquetas</b>: clic derecho sobre una etiqueta del paper para quitársela.</li>
      <li><b>Notas</b>: el botón «Notas (n)» las despliega; clic derecho abre el visor de notas del paper. 🔗 muestra sus relaciones.</li>
      <li><b>Agrupar por sección</b>: en «Ordenar». Puedes arrastrar papers entre grupos para cambiarlos de sección.</li></ul>`],
    lateral: ['Barra lateral', `<ul><li>☰ pliega o despliega la barra; con la barra plegada, cada icono la abre en su grupo.</li>
      <li><b>Buscar 🔍</b> (${kb('find')}): por título, autor o año; la casilla amplía a notas y citas editadas.</li>
      <li><b>Ordenar ⇅</b>: varios criterios en cascada (título, autor, año, revista, lectura, valoración, fecha de creación o modificación…), cada uno ascendente o descendente. Aquí también está «Agrupar por sección» y la <b>valoración mínima</b>.</li>
      <li><b>Secciones 📁</b> y <b>Etiquetas 🏷️</b>: filtran la lista. «✎ Gestionar» crea, renombra, recolorea, ordena y borra. Las etiquetas se pueden combinar con «al menos una» o «todas». Clic derecho en una sección abre sus notas.</li>
      <li><b>Lectura 📖</b>: filtra por estado. <b>Selección ☑️</b>: seleccionar visibles/quitar y exportar.</li>
      <li><b>Relaciones 🕸️</b>: gráfico de los papers relacionados o que se citan entre sí. <b>Papelera 🗑️</b>: los papers eliminados se guardan <b>5 días</b> y se pueden restaurar.</li></ul>`],
    paper: ['Editar un paper', `<p>«+ Nuevo paper» o «Editar». Pestañas: <b>Ver todo</b> (todos los bloques, plegables y con una sola variante de cita), <b>Datos</b>, <b>Cita</b>, <b>Notas</b>, <b>Secciones, etiquetas y relacionados</b> e <b>Historial</b>. «Guardar paper» confirma; «Cancelar» o cerrar sin guardar descarta el borrador.</p>
      <h4>Datos</h4><ul><li><b>Imagen</b> (recuadro junto a los títulos): una <i>URL</i>, un <i>archivo local enlazado</i> (solo Chrome/Edge: el JSON guarda el nombre y el enlace queda en ese navegador) o una <i>copia reducida incrustada</i> en el JSON. También puedes <b>pegar con Ctrl+V</b> una imagen copiada (por ejemplo de Google Imágenes).</li>
      <li><b>Título</b> y <b>título personalizado</b> (solo para mostrar; la cita usa el original). <b>Autores</b>: uno por línea, «Apellido, Nombre»; una entidad se escribe sin coma. <b>Clave de orden</b>: para ordenar «de la Torre» por «Torre».</li>
      <li><b>Tipo</b>: decide qué campos aparecen. Incluye tus <i>tipos propios</i> y la opción «➕ Crear un tipo propio…».</li>
      <li><b>DOI → Buscar</b> rellena los datos desde CrossRef (internet). <b>Enlace en la cita</b>: DOI, URL, automático o ninguno. <b>Fecha de consulta</b>: se escribe en la cita salvo que la omitas.</li></ul>
      <h4>Cita</h4><p>Muestra la cita del paper en <b>todos los estilos</b> (los de serie y los tuyos). Puedes <i>editarla a mano</i> (queda marcada «editada a mano»), <i>Regenerar desde los datos</i>, <i>Copiar</i> (texto) o <i>Copiar con formato</i> (cursiva real, para pegar en Word o Docs). Con la opción de Configuración «Mostrar la cita en el texto», aparece también la cita en el texto y las notas de Chicago, con el campo de página.</p>
      <h4>Notas</h4><p>Hay una <b>nota general</b> y <b>notas por sección</b>. El editor muestra el formato al escribir, como WhatsApp: <code>*cursiva*</code>, <code>**negrita**</code>, <code>~~tachado~~</code>, <code>__subrayado__</code>, listas con «- » o «1. ». La barra «Aa» (arriba del cuadro) trae esos botones, plantillas y enlaces 🔗 a otros papers o notas; la chincheta la mantiene desplegada. Se guardan y se copian con los símbolos, y al exportar solo se ve el formato.</p>
      <h4>Secciones, etiquetas y relacionados</h4><p>Marca las secciones y etiquetas del paper. En «Relacionados» enlazas papers entre sí (relación simétrica) o indicas que <i>este paper cita a</i> otro; el otro mostrará «citado por».</p>
      <h4>Historial</h4><p>Lista los cambios hechos <b>hoy</b> en ese paper. Solo vive en memoria: no se guarda en el JSON.</p>`],
    exportar: ['Exportar citas', `<p>«Exportar citas» (${kb('exportCites')}) abre la ventana de exportación de los papers <b>seleccionados</b> (o de los visibles si no hay selección).</p>
      <ul><li><b>Formato</b>: texto, Word (.doc o .docx), BibTeX o RIS. En los dos últimos no hay estilo de cita.</li>
      <li><b>Estilo de cita</b>: APA 7, Vancouver, MLA, IEEE, Chicago (autor-fecha y notas-bibliografía), UNE-ISO 690 (nombre-fecha y numérico) y <b>tus estilos personalizados</b> (marcados con ✎). Algunos estilos avisan de los tipos que la guía no cubre.</li>
      <li><b>Orden</b>: automático (alfabético o por lista según el estilo), lista, alfabético o por año. <b>Numerar</b>, formato del número, idioma de los conectores (es/en), formato de la fecha de consulta, incluir notas, listar todos los autores en Vancouver…</li>
      <li>El texto de la vista previa es editable. <b>Copiar</b> copia texto; <b>Copiar con formato</b> conserva cursiva y sangría francesa para Word o Docs. También puedes guardar el archivo.</li></ul>`],
    importar: ['Importar referencias', `<p>Clic derecho en 📂 (o ${kb('import')}): desde un archivo <code>.bib</code>/<code>.ris</code>, pegando texto BibTeX/RIS o buscando por <b>DOI</b>. Antes de añadir se revisa la lista, y puedes asignar sección, etiqueta y estado de lectura a todas. Dentro de un paper, «Buscar» junto al DOI propone rellenar solo los campos vacíos o los que marques.</p>`],
    config: ['Configuración', `<p>⚙️ en la barra lateral. Todo se guarda en el JSON.</p><ul><li><b>Nombre de la aplicación</b>, <b>paleta de colores</b> (o personalizada) y mostrar el archivo abierto en la cabecera.</li>
      <li><b>Mostrar la imagen</b> del paper en tarjetas y tabla. <b>Barra de formato</b> de las notas desplegada por defecto. <b>Cita en el texto</b> (Chicago) en la pestaña Cita.</li>
      <li><b>Tipos de documento propios</b> y <b>Estilos de cita personalizados</b>: ver las dos secciones siguientes.</li>
      <li><b>Plantillas de nota</b>: textos de partida para las notas; <code>{fecha}</code> y <code>{paper}</code> se sustituyen al insertarlas.</li>
      <li><b>Atajos de teclado</b>: clic en una combinación para cambiarla (Retroceso la quita).</li></ul>`],
    tipos: ['Tipos de documento propios', `<p>Los tipos predefinidos (${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([, v]) => esc(v)).join(', ')}) no cubren todo. Un <b>tipo propio</b> sirve para situaciones no contempladas: una carta, un pódcast local, un documento interno, un apunte de clase…</p>
      <h4>Crear uno</h4><ol><li>Configuración → <b>Tipos de documento propios</b> → «+ Nuevo tipo». O, dentro de un paper, abre el desplegable <b>Tipo</b> y elige «➕ Crear un tipo propio…» (se crea y se asigna al paper).</li>
      <li><b>Nombre</b>: el que verás en el desplegable (aparece en el grupo «Tipos propios»).</li>
      <li><b>Se cita como</b>: el tipo predefinido que usarán los estilos de serie (APA, MLA…) y BibTeX/RIS para dar formato. Elige el más parecido.</li>
      <li><b>Campos del formulario</b>: marca cuáles se muestran (volumen, páginas, editorial, ISBN, institución, congreso, fecha completa, función del autor…). «Usar los campos de…» marca los del tipo elegido. Siempre están título, autores, año, URL, DOI y fecha de consulta.</li>
      <li><b>Etiquetas propias</b>: renombra cualquier campo para este tipo (por ejemplo «Revista / editorial / sitio» → «Canal»).</li></ol>
      <h4>Cómo se cita</h4><ul><li><b>Estilos de serie</b>: tratan el tipo propio como su «Se cita como». Solo ven los campos que ese tipo predefinido usa.</li>
      <li><b>Estilos propios</b>: ven <i>todos</i> los campos y pueden tener una <b>plantilla específica</b> para el tipo (en «Tipo de documento» del editor del estilo, el tipo propio aparece en la lista). Si no la hay, usan la plantilla por defecto.</li>
      <li><b>Eliminar</b> un tipo pasa sus papers al tipo «Se cita como» y quita las plantillas que tuvieran los estilos propios.</li></ul>`],
    estilos: ['Estilos de cita personalizados', `<p>Crea tu propio estilo de cita: una <b>plantilla por tipo de documento</b> con los campos del paper. Sale en Exportar y en la pestaña Cita junto a los de serie. Configuración → <b>Estilos de cita personalizados</b>.</p>
      <h4>Empezar</h4><ul><li><b>+ Nuevo estilo</b>: parte de una plantilla de artículo sencilla. <b>+ Nuevo a partir de…</b>: copia las plantillas de APA 7, Vancouver, MLA, IEEE, Chicago, UNE-ISO 690… (artículo, libro, capítulo, congreso, tesis, web y prensa; el resto usa la plantilla por defecto) para que las modifiques. <b>Duplicar</b> y <b>Eliminar</b> (si estaba en uso en Exportar, vuelve a APA).</li></ul>
      <h4>Opciones del estilo</h4><ul><li><b>Orden</b> de la bibliografía (alfabético o en el de la lista), <b>numerada</b> y formato del número, distinguir 2020a/2020b, formato de fechas y <b>idioma</b> de conectores y fechas.</li>
      <li><b>Autores y editores</b>: formato de cada persona (${Object.values(CU_AU).map(esc).join(' · ')}), separador, texto antes del último, límite «más de N autores» con cuántos se muestran y el texto «et al.», apellidos en mayúsculas y «solo el primero invertido».</li></ul>
      <h4>La plantilla</h4><p>Se escribe una por tipo de documento («Por defecto» vale para los que no tienen la suya). El texto sale tal cual y los datos se insertan así:</p>
      ${helpTbl([['<code>{campo}</code>', 'inserta el dato. Ej.: <code>{title}</code>'], ['<code>{campo:i}</code>', 'aplica un formato; se encadenan: <code>{title:i:q}</code>'], ['<code>{campo|texto}</code>', 'si el campo está vacío, usa «texto». Ej.: <code>{year|s.f.}</code>'],
        ['<code>[ … ]</code>', '<b>grupo opcional</b>: solo sale si todos los campos de dentro tienen valor. Ej.: <code>[, vol. {volume}]</code>'], ['<code>\\</code>', 'escapa el carácter siguiente: <code>\\[Internet\\]</code> escribe corchetes literales']])}
      <p>Los puntos, comas y espacios repetidos se limpian solos. Los asteriscos de los datos se escapan.</p>
      <h4>Campos disponibles</h4>${helpTbl(CU_F.map(([k, l]) => [`<code>{${k}}</code>`, esc(l)]))}
      <h4>Formatos (<code>{campo:formato}</code>)</h4>${helpTbl(Object.entries(CU_M).map(([k, v]) => [`<code>${k}</code>`, esc(v)]))}
      <h4>Opciones propias de cada campo</h4><p><b>Botón derecho sobre un campo</b> de la plantilla (o sobre su botón en la lista de campos) abre un panel con las opciones de ese campo y las escribe por ti como <code>{campo:opción=valor}</code>:</p>
      <ul><li><b>Autores y editores</b>: <code>fmt</code> (formato de cada persona), <code>sep</code>, <code>last</code> (antes del último), <code>max</code> y <code>show</code> (límite y cuántos se muestran), <code>etal</code> (texto «et al.»), <code>upper</code>, <code>fo</code> (solo el primero invertido) y los <b>formatos por autor</b> <code>first</code> y <code>each</code>, donde <code>{l}</code> es el apellido, <code>{L}</code> APELLIDO, <code>{g}</code> el nombre, <code>{i}</code> las iniciales con punto y <code>{n}</code> sin punto. Ej.: <code>first={L}, {g}</code> y <code>each={g} {L}</code> dan «PÉREZ, Juan y Ana GÓMEZ».</li>
      <li><b>Fechas</b> (<code>date</code>, <code>datey</code>, <code>accessed</code>): <code>fmt</code> (largo, ISO, d-m-a, mes año, como en Exportar) o un <code>pat</code> propio con <code>YYYY YY MMMM MMM MM M DD D</code>. Ej.: <code>{date:pat=D de MMMM de YYYY}</code>.</li>
      <li><b>Páginas</b>: <code>pp</code> («p.»/«pp.»), <code>dash</code> (raya) y <code>first</code> (solo la primera). <b>Edición</b>: <code>raw</code>.</li>
      <li><b>Cualquier campo</b>: <code>pre</code> y <code>suf</code> (texto antes y después que solo sale si hay valor) y los formatos de la tabla anterior.</li></ul>
      <h4>Cita en el texto</h4><p>Una plantilla opcional para la cita corta, con <code>{authorsShort}</code>, <code>{year}</code> y <code>{loc}</code> (la página citada). Se ve en la pestaña Cita si activas la cita en el texto en Configuración.</p>
      <h4>Vista previa</h4><p>Se actualiza al escribir. Elige «Un ejemplo» (con la opción «Ver el ejemplo en todos los tipos») o uno de tus papers para comprobar cómo queda.</p>
      <h4>Ejemplo</h4><p><code>[{authors}. ]({year|s.f.}). {title:i}. [{edition}. ][{place}: ]{venue}. [{link}]</code><br>→ «Pérez, J. C. (2021). <i>Título del libro</i>. 2.ª ed. Madrid: Editorial. https://…»</p>`],
    atajos: ['Atajos de teclado', helpTbl(Object.keys(SC_NAMES).map(a => [esc(SC_NAMES[a]), kb(a)]).concat([['Esta ayuda', '<kbd>F1</kbd>'], ['Cerrar menús y ventanas', '<kbd>Esc</kbd>']])) + '<p>Se cambian en Configuración → Atajos de teclado. Dentro de campos de texto solo funciona «Guardar»; negrita y cursiva actúan dentro de una nota.</p>'],
    datos: ['Datos, privacidad y consejos', `<ul><li>Todo se queda en tu navegador y en tu archivo JSON. La aplicación solo sale a internet para <b>buscar un DOI en CrossRef</b> y para mostrar <b>imágenes por URL</b>.</li>
      <li>Funciona sin conexión una vez cargada (se puede instalar como aplicación). Las imágenes por URL y la búsqueda de DOI necesitan internet.</li>
      <li>Haz copias del JSON de vez en cuando: es tu única base de datos. La papelera guarda 5 días; el historial no se guarda.</li>
      <li>Las imágenes <b>enlazadas</b> solo se ven en el navegador donde las elegiste; si vas a llevar el JSON a otro equipo, usa la <b>copia incrustada</b> o una URL.</li>
      <li>Los estilos y tipos propios viajan dentro del JSON, así que se ven igual en cualquier navegador que lo abra.</li></ul>`]
  };
  return `<div class="dh"><h2>Ayuda</h2><div class="dbtn"><button onclick="$('#help').close()">Cerrar ✕</button></div></div>
    <input id="hpq" type="search" placeholder="Buscar en la ayuda…" oninput="helpFilter(this.value)" aria-label="Buscar en la ayuda">
    <div id="hpb">${Object.entries(S).map(([id, [t, b]]) => helpSec(id, t, b)).join('')}</div>`;
}
function helpFilter(q) {
  q = norm(q).trim(); let n = 0;
  document.querySelectorAll('#hpb > details').forEach(d => { const hit = !q || norm(d.textContent).includes(q); d.hidden = !hit; if (hit) n++; if (q && hit) d.open = true; });
  $('#hpEmpty')?.remove(); if (!n) $('#hpb').insertAdjacentHTML('beforeend', '<p class="empty" id="hpEmpty">Nada encontrado.</p>');
}
function openHelp(id) {
  if (id) HELP_OPEN.add(id); $('#help').innerHTML = helpHTML(); if (!$('#help').open) $('#help').showModal();
  if (id) setTimeout(() => document.getElementById('hp_' + id)?.scrollIntoView({block: 'start'}));
}
document.addEventListener('keydown', e => { if (e.key === 'F1') { e.preventDefault(); openHelp(); } });
/* ---- Editor de tipos propios (Configuración) ---- */
let CTS = {id: ''};
const ctCur = () => db.settings.customTypes.find(c => c.id === CTS.id) || db.settings.customTypes[0] || null;
const ctTouch = () => { markDirty(); syncTypes(db.settings.customTypes); };
function ctNew(name = 'Tipo propio') {
  const c = ctClean({name: name + (db.settings.customTypes.length ? ' ' + (db.settings.customTypes.length + 1) : ''), like: 'articulo'}); db.settings.customTypes.push(c); CTS.id = c.id; ctTouch(); return c;
}
function ctUI() {
  const L = db.settings.customTypes, c = ctCur(); if (c) CTS.id = c.id;
  let h = `<small>Crea tipos de documento para lo que los predefinidos no contemplan. Eliges qué campos muestra el formulario y cómo se llaman, y aparecen en el desplegable «Tipo» de cada paper. <a onclick="openHelp('tipos')">Ver la ayuda</a></small>
    <div class="row" style="margin:8px 0">${L.length ? `<select onchange="CTS.id=this.value;drawCfg()">${L.map(x => `<option value="${x.id}" ${c.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
    <button onclick="ctNew();drawCfg()">+ Nuevo tipo</button>${c ? '<button onclick="ctDup()">Duplicar</button><button class="danger" onclick="ctDel()">Eliminar</button>' : ''}</div>`;
  if (!c) return h + '<p class="empty">Aún no hay tipos propios.</p>';
  const inUse = db.papers.filter(p => p.type === 'ct_' + c.id).length;
  h += `<div class="cugrid"><label>Nombre<input value="${esc(c.name)}" maxlength="60" oninput="ctSet('name',this.value)"></label>
    <label>Se cita como (para los estilos de serie)<select onchange="ctSet('like',this.value);drawCfg()">${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([k, v]) => `<option value="${k}" ${c.like === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
    <div class="row" style="margin:6px 0"><small>${inUse ? `${inUse} paper${inUse > 1 ? 's usan' : ' usa'} este tipo.` : 'Ningún paper usa este tipo todavía.'}</small><button onclick="ctReset()" title="Marca los campos que muestra el tipo «${esc(TYPES[c.like])}»">Usar los campos de «${esc(TYPES[c.like])}»</button></div>
    <div class="cuh">Campos del formulario <small>(siempre están título, autores, año, URL, DOI y fecha de consulta)</small></div>
    <div class="ctf"><div class="ctr"><span>Revista / editorial / sitio</span><input value="${esc(c.labels.venue || '')}" placeholder="Etiqueta propia (p. ej. Medio, Canal, Emisora)" oninput="ctLabel('venue',this.value)"></div>
    ${Object.entries(CT_NAMES).map(([k, n]) => `<div class="ctr"><label class="row"><input type="checkbox" ${c.fields.includes(k) ? 'checked' : ''} onchange="ctField('${k}',this.checked)"> ${esc(n)}</label><input value="${esc(c.labels[k] || '')}" placeholder="Etiqueta propia" ${c.fields.includes(k) ? '' : 'disabled'} oninput="ctLabel('${k}',this.value)"></div>`).join('')}</div>
    <small>En un estilo propio puedes usar todos los campos con <code>{campo}</code> y darle a este tipo su plantilla (Configuración → Estilos de cita personalizados → «Tipo de documento»).</small>`;
  return h;
}
function ctSet(k, v) { const c = ctCur(); if (!c) return; c[k] = v; ctTouch(); }
function ctField(k, on) { const c = ctCur(); c.fields = on ? [...new Set([...c.fields, k])] : c.fields.filter(x => x !== k); ctTouch(); drawCfg(); }
function ctLabel(k, v) { const c = ctCur(); if (v.trim()) c.labels[k] = v; else delete c.labels[k]; ctTouch(); }
function ctReset() { const c = ctCur(); c.fields = ctFieldsOf(c.like); ctTouch(); drawCfg(); }
function ctDup() { const c = structuredClone(ctCur()); c.id = uid(); c.name += ' (copia)'; db.settings.customTypes.push(c); CTS.id = c.id; ctTouch(); drawCfg(); }
function ctDel() {
  const c = ctCur(), k = 'ct_' + c.id, n = db.papers.filter(p => p.type === k).length;
  if (!c || !confirm(`¿Eliminar el tipo «${c.name}»?${n ? ` ${n} paper${n > 1 ? 's pasarán' : ' pasará'} a «${TYPES[c.like]}».` : ''}`)) return;
  for (const p of db.papers.concat(db.trash.map(t => t.paper))) if (p.type === k) p.type = c.like;
  for (const s of db.settings.customStyles) delete s.tpl[k];
  db.settings.customTypes = db.settings.customTypes.filter(x => x.id !== c.id); CTS.id = ''; ctTouch(); syncStyles(db.settings.customStyles, db.settings.export); render(); drawCfg();
}
function typeChange(v) {   // desplegable «Tipo» del paper; la última opción crea un tipo propio al vuelo
  if (v === '__new') { const c = ctNew(); D.type = 'ct_' + c.id; CFG_OPEN.add('ct'); drawD(); openCfg(); return; }
  D.type = v; drawD();
}
$('#cfg').addEventListener('close', () => { if ($('#dlg').open) drawD(); });   // al volver del editor de tipos, el formulario se pone al día
const CFG_OPEN = new Set();   // apartados de Configuración desplegados (se conservan al redibujar)
const cfgSec = (id, title, body) => `<details class="cs" ${CFG_OPEN.has(id) ? 'open' : ''} ontoggle="this.open ? CFG_OPEN.add('${id}') : CFG_OPEN.delete('${id}')"><summary>${title}</summary><div class="csb">${body}</div></details>`;

/* ===== Lista principal ===== */
const chip = (t, on, click, drag, ctx) => `<span class="chip ${on ? 'on' : ''}" style="--c:${esc(t.color || '#888888')}" ${click ? `onclick="${click}"` : ''} ${drag ? `draggable="true" data-tag="${t.id}"` : ''} ${ctx ? `oncontextmenu="${ctx}"` : ''}>${esc(t.name)}</span>`;
const tagById = i => db.tags.find(t => t.id === i);
const secChips = id => (db.sections.find(s => s.id === id)?.tagIds || []).map(tagById).filter(Boolean).map(t => chip(t, 1)).join('');
const hdr = () => $('#fname').textContent = db.settings.showFile ? (path ? path.split(/[\\/]/).pop() : '(sin archivo)') + (dirty ? ' • sin guardar' : '') : (dirty ? '• sin guardar' : '');
function sortList(L) {   // ordena por todos los criterios, en cascada; d = 1 ascendente, -1 descendente
  return [...L].sort((a, b) => { for (const {k, d} of F.sorts) { const x = KEY[k](a), y = KEY[k](b);
    if (k === 'rating' && !x !== !y) return x ? -1 : 1;   // sin valorar: siempre al final, en ambos sentidos
    const c = typeof x === 'number' ? x - y : x.localeCompare(y, 'es'); if (c) return c * d; } return 0; });
}
const has = (p, t) => p.tagIds.includes(t);   // las etiquetas son independientes de las secciones
function visible() {
  const q = norm(F.q);
  return sortList(db.papers.filter(p => (!q || norm([p.title, p.alias, p.year, ...p.authors, ...(F.inNotes ? [p.general, ...p.notes.map(n => n.content), ...Object.values(p.cites)] : [])].join(' ')).includes(q))
    && (!F.sec || p.sectionIds.includes(F.sec)) && (!F.read || p.reading === F.read) && p.rating >= F.minRating && (!F.tags.size || [...F.tags][F.mode === 'all' ? 'every' : 'some'](t => has(p, t)))));
}
const tagsOf = p => p.tagIds.map(i => db.tags.find(t => t.id === i)).filter(Boolean).map(t => chip(t, 1, '', 0, `tagMenu(event,'${p.id}','${t.id}')`)).join('');
const EXP = new Set();   // papers con las notas desplegadas en la lista
const notesHTML = (p, hl) => `<div class="nts">${p.notes.filter(n => n.content.trim()).map(n => { const s = db.sections.find(x => x.id === n.sectionId);
  return `<div class="nt${n.id === hl ? ' hl' : ''}">${s ? chip(s, 1) : '<span class="chip on" style="--c:#888888">Sin sección</span>'}<div class="ntx md">${md(n.content)}</div></div>`; }).join('') || '<small>Este paper no tiene notas.</small>'}</div>`;
function toggleNotes(id) { EXP.has(id) ? EXP.delete(id) : EXP.add(id); render(); }
/* ---- Imagen del paper ---- */
const PEND = new Map(), IMG_URL = new Map();   // PEND: archivos elegidos en el borrador aún sin guardar · IMG_URL: URLs de objeto de los archivos enlazados
const imgInner = i => !i ? '🖼️' : i.kind === 'url' ? `<img src="${esc(i.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;imgx&quot; title=&quot;No se pudo cargar la imagen&quot;>⚠</span>'">`
  : i.kind === 'data' ? `<img src="${i.data}" alt="">` : '🖼️';
const pimgHTML = (p, cls, attrs = '') => `<div class="pimg ${cls}" ${p.image?.kind === 'file' ? `data-fpid="${p.id}" title="Imagen enlazada: ${esc(p.image.name)}"` : ''} ${attrs}>${imgInner(p.image)}</div>`;
const thumbHTML = (p, cls) => p.image && db.settings.showImg !== false ? pimgHTML(p, cls) : '';
async function fileImgUrl(pid, ask) {   // archivo local enlazado: el navegador puede pedir permiso de lectura en cada sesión
  const h = PEND.get(pid) || await idb('readonly', st => st.get('img:' + pid)).catch(() => null); if (!h) return null;
  let perm = await h.queryPermission({mode: 'read'}); if (perm !== 'granted' && ask) perm = await h.requestPermission({mode: 'read'});
  if (perm !== 'granted') return null;
  const u = URL.createObjectURL(await h.getFile()); URL.revokeObjectURL(IMG_URL.get(pid)); IMG_URL.set(pid, u); return u;
}
function hydrateImgs(ask, only) {
  document.querySelectorAll('.pimg[data-fpid]').forEach(el => { if (only && el !== only) return;
    fileImgUrl(el.dataset.fpid, ask).then(u => { el.classList.toggle('locked', !u); if (u) el.innerHTML = `<img src="${u}" alt="">`; else el.title = 'Imagen enlazada: pulsa para dar acceso al archivo (o vuelve a elegirla en Datos)'; }).catch(() => el.classList.add('locked')); });
}
document.addEventListener('click', e => { const el = e.target.closest?.('.pimg.locked[data-fpid]:not(.big)'); if (el) { e.stopPropagation(); hydrateImgs(true, el); } }, true);
const FILE_IMG_T = [{description: 'Imágenes', accept: {'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']}}];
function imgBox() { $('#dlg .pimgbox') && ($('#dlg .pimgbox').innerHTML = pimgHTML(D, 'big', `role="button" tabindex="0" onclick="imgOpen()" title="Añadir o cambiar la imagen"`)); hydrateImgs(); }
function imgOpen() {
  const i = D.image;
  $('#img').innerHTML = `<div class="dh"><h2>Imagen del paper</h2><div class="dbtn"><button onclick="$('#img').close()">Cerrar</button></div></div>
    <div class="pimgprev">${pimgHTML(D, 'big')}</div>
    <div class="pastez" tabindex="0">📋 Pega aquí una imagen copiada (Ctrl+V), p. ej. con «Copiar imagen» en Google Imágenes</div>
    <label>URL de la imagen<span class="row" style="flex-wrap:nowrap"><input id="imgUrl" type="url" placeholder="https://…" style="flex:1;min-width:0" value="${i?.kind === 'url' ? esc(i.url) : ''}" onkeydown="if(event.key==='Enter')imgSetUrl()"><button class="pri" onclick="imgSetUrl()">Usar</button></span></label>
    <div class="row" style="margin-top:8px"><button onclick="imgPickLinked()" ${FSA ? '' : 'disabled'} title="${FSA ? 'No se copia: se guarda solo el nombre y el enlace queda en este navegador' : 'Solo disponible en Chrome o Edge de escritorio'}">📎 Archivo local (enlazado)</button>
    <button onclick="imgPickEmbed()" title="Guarda una copia reducida dentro del JSON: viaja con el archivo">📥 Incrustar copia reducida</button><button class="danger" onclick="imgClear()" ${i ? '' : 'disabled'}>Quitar imagen</button></div>
    <small>Enlazada: no ocupa espacio en el JSON, pero solo se ve en el navegador donde la elegiste (puede pedir permiso al abrir). Incrustada: una copia pequeña (máx. 480 px) que se ve en cualquier sitio.</small>`;
  hydrateImgs(); $('#img').showModal();
}
function imgSet(v) { D.image = v; imgBox(); if ($('#img').open) imgOpen(); }
function imgSetUrl() { const u = $('#imgUrl').value.trim(); if (!u) return imgClear(); if (!/^https?:\/\//i.test(u)) return alert('La URL debe empezar por http:// o https://'); PEND.delete(D.id); imgSet({kind: 'url', url: u}); }
function imgClear() { PEND.delete(D.id); imgSet(null); }
async function imgPickLinked() { try { const [h] = await showOpenFilePicker({types: FILE_IMG_T}); PEND.set(D.id, h); imgSet({kind: 'file', name: h.name}); } catch (e) { if (e.name !== 'AbortError') alert('No se pudo elegir el archivo: ' + e.message); } }
async function imgEmbedBlob(f) {   // copia reducida (máx. 480 px, JPEG) para guardarla dentro del JSON
  const b = await createImageBitmap(f), k = Math.min(1, 480 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b.width * k)); c.height = Math.max(1, Math.round(b.height * k)); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  PEND.delete(D.id); imgSet({kind: 'data', data: c.toDataURL('image/jpeg', .82)});
}
function imgPickEmbed() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { const f = i.files[0]; if (f) try { await imgEmbedBlob(f); } catch (e) { alert('No se pudo leer la imagen: ' + e.message); } };
  i.click();
}
function imgFromClipboard(e, inField) {   // imagen copiada (p. ej. «Copiar imagen» en Google Imágenes): archivo, <img> en el HTML o, fuera de un campo, una URL suelta
  const dt = e.clipboardData; if (!dt || !D) return false;
  const file = [...dt.files].find(f => /^image\//.test(f.type));
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(dt.getData('text/html') || ''), txt = (dt.getData('text/plain') || '').trim();
  const u = m ? m[1].replace(/&amp;/g, '&') : !inField && /^https?:\/\/\S+$/i.test(txt) ? txt : '';
  if (!file && !/^(https?:|data:image\/)/i.test(u)) return false;
  e.preventDefault();
  if (file) imgEmbedBlob(file).catch(err => alert('No se pudo leer la imagen: ' + err.message));
  else if (u.startsWith('data:')) fetch(u).then(r => r.blob()).then(imgEmbedBlob).catch(err => alert('No se pudo leer la imagen: ' + err.message));
  else { PEND.delete(D.id); imgSet({kind: 'url', url: u}); }
  return true;
}
document.addEventListener('paste', e => {
  const t = e.target, field = !!t.closest?.('input,textarea,[contenteditable]');
  if (t.closest?.('.ned')) return;
  if (t.closest?.('#img') || ($('#dlg').open && $('#dlg .pimgbox') && !$('#img').open)) imgFromClipboard(e, field);
});
const starsHTML = p => `<span class="stv${p.rating ? '' : ' none'}" oncontextmenu="starMenu(event,'${p.id}')" title="Valoración ${p.rating} de 5 · Clic derecho: cambiar">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span>`;
const rdHTML = p => `<span class="rd"><button class="rst" style="--c:${READ_C[p.reading]}" title="Clic: cambiar el estado de lectura" onclick="cycleRead('${p.id}')">${READ[p.reading]}</button>${starsHTML(p)}</span>`;
function starMenu(e, id) { ctxShow(e, '<div class="ctxh">Valoración</div>' + [5, 4, 3, 2, 1, 0].map(n => `<button onclick="setRating('${id}',${n})">${n ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'Sin valorar'}</button>`).join('')); }
function setRating(id, n) { const p = db.papers.find(x => x.id === id); ctxClose(); if (!p || p.rating === n) return; logChange(p, `Valoración: ${p.rating || '—'} → ${n || '—'}`); p.rating = n; markDirty(); render(); }
const card = (p, from) => `<article class="card" data-id="${p.id}" ${F.group ? `draggable="true" data-from="${from || ''}"` : ''}><div class="ct"><label class="sel"><input type="checkbox" ${SEL.has(p.id) ? 'checked' : ''} onchange="toggleSel('${p.id}')"> Seleccionar</label><button class="sm" onclick="openPaper('${p.id}')">Editar</button>${p.tagIds.length ? `<span class="tl">${tagsOf(p)}</span>` : ''}${rdHTML(p)}<button class="x" title="Eliminar" onclick="delPaper('${p.id}')">✕</button></div><div class="th">${thumbHTML(p, 'sm')}<h3>${esc(p.alias || p.title)}</h3></div>${p.alias ? `<div class="sub">${esc(p.title)}</div>` : ''}
    <div class="au"><span>${esc(p.authors.join('; '))} ${p.year ? '(' + esc(p.year) + ')' : ''}</span></div>
    ${/^https?:/i.test(p.url) ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : ''}
    
    <div class="row"><button class="sm" onclick="toggleNotes('${p.id}')" oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar notas · Clic derecho: abrir el visor de notas">Notas (${p.notes.filter(n => n.content.trim()).length}) ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" onclick="viewRel('${p.id}')" title="Relaciones: relacionados, cita a y citado por">🔗 ${relCount(p)}</button>` : ''}</div>${EXP.has(p.id) ? notesHTML(p) : ''}</article>`;
const TH = [[null, ''], ['title', 'Título'], ['author', 'Autores'], ['year', 'Año'], ['venue', 'Revista / editorial'], ['reading', 'Lectura'], ['rating', '★'], [null, 'Secciones'], [null, 'Etiquetas'], [null, 'Notas'], [null, '']];
function thSort(k) {   // clic en una cabecera: ese criterio pasa a ser el principal; otro clic invierte el sentido
  F.sorts = F.sorts[0]?.k === k ? [{k, d: -F.sorts[0].d}, ...F.sorts.slice(1)] : [{k, d: 1}, ...F.sorts.filter(x => x.k !== k).slice(0, 2)]; render();
}
const rowHTML = (p, from) => `<tr class="rw" data-id="${p.id}" ${F.group ? `draggable="true" data-from="${from || ''}"` : ''}>
  <td><input type="checkbox" aria-label="Seleccionar" ${SEL.has(p.id) ? 'checked' : ''} onchange="toggleSel('${p.id}')"></td>
  <td class="timg">${thumbHTML(p, 'xs')}</td>
  <td class="tt"><a class="tl2" onclick="openPaper('${p.id}')" title="Editar">${esc(p.alias || p.title)}</a></td><td>${esc(p.authors.join('; '))}</td><td>${esc(p.year)}</td><td>${esc(p.venue)}</td>
  <td><button class="rst" style="--c:${READ_C[p.reading]}" title="Clic: cambiar el estado de lectura" onclick="cycleRead('${p.id}')">${READ[p.reading]}</button></td><td>${starsHTML(p)}</td>
  <td>${p.sectionIds.map(id => db.sections.find(s => s.id === id)).filter(Boolean).map(s => chip(s, 1)).join('')}</td><td>${tagsOf(p)}</td>
  <td class="nw"><button class="sm" onclick="toggleNotes('${p.id}')" oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar · Clic derecho: visor de notas">${p.notes.filter(n => n.content.trim()).length} ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" onclick="viewRel('${p.id}')" title="Relaciones">🔗 ${relCount(p)}</button>` : ''}</td>
  <td><button class="x" title="Eliminar" onclick="delPaper('${p.id}')">✕</button></td></tr>${EXP.has(p.id) ? `<tr class="rn"><td></td><td colspan="11">${notesHTML(p)}</td></tr>` : ''}`;
const tableHTML = (L, from) => `<div class="twrap"><table class="tbl"><thead><tr><th></th>${TH.map(([k, t]) => k ? `<th class="sortable" onclick="thSort('${k}')">${t}${F.sorts[0]?.k === k ? (F.sorts[0].d > 0 ? ' ▲' : ' ▼') : ''}</th>` : `<th>${t}</th>`).join('')}</tr></thead><tbody>${L.map(p => rowHTML(p, from)).join('')}</tbody></table></div>`;
const items = (l, from) => db.settings.view === 'table' ? (l.length ? tableHTML(l, from) : '') : l.map(p => card(p, from)).join('');
function listHTML(L) {
  if (!F.group) return items(L, '');
  const G = db.sections.filter(s => !F.sec || s.id === F.sec).map(s => [s, L.filter(p => p.sectionIds.includes(s.id))]);
  if (!F.sec) G.push([{id: '', name: 'Sin sección', color: '#888888'}, L.filter(p => !p.sectionIds.some(i => db.sections.some(s => s.id === i)))]);
  return G.map(([s, l]) => `<section class="gbox" data-sec="${s.id || ''}"><h2 class="grp" style="border-color:${esc(s.color || '#888888')}" ${s.id ? `oncontextmenu="svOpen('${s.id}',event)"` : ''}>${esc(s.name)} <small>(${l.length})</small></h2>${items(l, s.id || '') || '<p class="empty drop">Arrastra papers aquí</p>'}</section>`).join('');
}
function fitTags() {   // las etiquetas van en la barra superior de la tarjeta; si no caben, pasan a su propia línea entre esa barra y el título
  document.querySelectorAll('#list article.card').forEach(c => { const ct = c.querySelector('.ct'), tl = ct.querySelector('.tl') || c.querySelector(':scope > .tl'); if (!tl) return;
    if (tl.parentElement !== ct) ct.insertBefore(tl, ct.querySelector('.rd'));
    if (ct.scrollWidth > ct.clientWidth + 1) ct.after(tl); });
}
let listW = 0; new ResizeObserver(([e]) => { if (Math.abs(e.contentRect.width - listW) > 1) { listW = e.contentRect.width; fitTags(); } }).observe($('#list'));   // también al plegar la barra o cambiar el tamaño
function render() {
  hdr();
  const secH = [{name: 'Todas', color: '#888888'}, ...db.sections].map(x => chip(x, x.id ? F.sec === x.id : !F.sec, `setSecF('${x.id || ''}')`, 0, `svOpen('${x.id || ''}',event)`)).join('');
  const tagC = (db.tags.map(t => chip(t, F.tags.has(t.id), `toggleF('${t.id}')`, 1)).join('') || '<small>Aún no hay etiquetas.</small>');
  const modeSel = `<select class="mode" title="Cómo combinar varias etiquetas" onchange="F.mode=this.value;render()"><option value="any" ${F.mode === 'any' ? 'selected' : ''}>Al menos una etiqueta</option><option value="all" ${F.mode === 'all' ? 'selected' : ''}>Todas las etiquetas</option></select>`;
  $('#secF').innerHTML = $('#secF2').innerHTML = secH;
  $('#tagF').innerHTML = tagC + modeSel; $('#tagF2').innerHTML = tagC;
  const tg = (id, open, label, active) => { const b = $(id); b.textContent = `${label} ${open ? '▾' : '▸'}${!open && active ? ' •' : ''}`; b.classList.toggle('on', open); };   // «•» = hay filtro activo con la lista plegada
  tg('#tbSec', F.tbSec, 'Sección', F.sec); tg('#tbTag', F.tbTag, 'Etiquetas', F.tags.size);
  $('#secF2').hidden = !F.tbSec; $('#tagF2').hidden = !F.tbTag; $('#grpChk').checked = F.group;
  $('#selN').textContent = SEL.size ? `${SEL.size} seleccionados` : 'Ningún paper seleccionado';
  $('#d-search').hidden = !F.q; $('#d-sec').hidden = !F.sec; $('#d-tags').hidden = !F.tags.size; $('#d-sel').hidden = !SEL.size; $('#d-read').hidden = !F.read; $('#d-sort').hidden = !F.minRating; $('#d-tr').hidden = !db.trash.length; $('#trLbl').textContent = 'Papelera' + (db.trash.length ? ` (${db.trash.length})` : ''); $('#tbView').textContent = db.settings.view === 'table' ? '▦ Tarjetas' : '☰ Tabla';
  $('#readF').innerHTML = [['', 'Todos'], ...Object.entries(READ)].map(([k, v]) => chip({name: v, color: k ? READ_C[k] : '#888888'}, F.read === k, `setRead('${k}')`)).join(''); $('#minR').value = F.minRating;   // puntos de filtro activo
  const nextKey = Object.keys(SORTS).find(k => !F.sorts.some(s => s.k === k)) || 'title';
  $('#sortUI').innerHTML = F.sorts.map((s, i) => `<div class="row"><select onchange="F.sorts[${i}].k=this.value;render()">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${s.k === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button title="${s.d > 0 ? 'Ascendente (A→Z, antiguo→reciente)' : 'Descendente (Z→A, reciente→antiguo)'}" onclick="F.sorts[${i}].d*=-1;render()">${s.d > 0 ? '▲' : '▼'}</button>
    ${F.sorts.length > 1 ? `<button onclick="F.sorts.splice(${i},1);render()">✕</button>` : ''}</div>`).join('')
    + `<button onclick="F.sorts.push({k:'${nextKey}',d:1});render()">+ Añadir criterio</button>`;
  const L = visible();
  $('#list').innerHTML = listHTML(L) || '<p class="empty">No hay papers que mostrar. Crea uno con «Nuevo paper» o ajusta los filtros.</p>';
  fitTags(); hydrateImgs();
  $('#count').textContent = `${L.length} de ${db.papers.length} papers · ${SEL.size} seleccionados`;
}
function toggleF(id) { F.tags.has(id) ? F.tags.delete(id) : F.tags.add(id); render(); }
function ctxShow(e, html) {   // menú contextual genérico
  e.preventDefault(); e.stopPropagation(); let m = $('#ctx'); if (!m) { m = document.createElement('div'); m.id = 'ctx'; }
  (document.querySelector('dialog[open]') || document.body).appendChild(m);   // dentro de una ventana abierta, para que se vea por encima
  m.innerHTML = html; m.hidden = false;
  m.style.left = Math.max(0, Math.min(e.clientX, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(0, Math.min(e.clientY, innerHeight - m.offsetHeight - 8)) + 'px';
}
const tick = on => on ? '✓ ' : '\u2003';
function modeMenu(e) { ctxShow(e, '<div class="ctxh">Combinar varias etiquetas</div>' + [['any', 'Al menos una'], ['all', 'Todas']].map(([k, v]) => `<button onclick="F.mode='${k}';ctxClose();render()">${tick(F.mode === k)}${v}</button>`).join('')); }
function groupMenu(e) { ctxShow(e, `<div class="ctxh">Secciones</div><button onclick="F.group=!F.group;ctxClose();render()">${tick(F.group)}Agrupar por sección</button>`); }
function tagMenu(e, pid, tid) { ctxShow(e, `<div class="ctxh">Etiqueta «${esc(db.tags.find(t => t.id === tid)?.name)}»</div><button onclick="delTagFrom('${pid}','${tid}')">🗑 Borrar de este paper</button>`); }
function delTagFrom(pid, tid) { const p = db.papers.find(x => x.id === pid); if (p) { p.tagIds = p.tagIds.filter(x => x !== tid); logChange(p, 'Etiqueta quitada: ' + (db.tags.find(t => t.id === tid)?.name || '?')); } ctxClose(); markDirty(); render(); }
const ctxClose = () => { const m = $('#ctx'); if (m) { m.hidden = true; document.body.appendChild(m); } };
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) ctxClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') ctxClose(); });
document.addEventListener('contextmenu', e => { if (!e.target.closest('[oncontextmenu]')) ctxClose(); });   // clic derecho en otro sitio también cierra
function setSecF(id) { F.sec = id && F.sec === id ? '' : id; render(); }   // '' = Todas; pulsar la sección activa también vuelve a «Todas»
function sbToggle() { $('#side').classList.toggle('min'); }
function sbGroup(g) {   // con la barra plegada, pulsar un icono la despliega en ese grupo
  const a = $('#side'), el = $('#sg-' + g), wasMin = a.classList.contains('min');
  a.classList.remove('min'); wasMin ? el.classList.remove('fold') : el.classList.toggle('fold');
  if (g === 'search' && !el.classList.contains('fold')) $('#q').focus();
}
function cycleRead(id) { const p = db.papers.find(x => x.id === id); if (!p) return; const k = Object.keys(READ); const was = p.reading; p.reading = k[(k.indexOf(p.reading) + 1) % k.length]; logChange(p, `Lectura: ${READ[was]} → ${READ[p.reading]}`); markDirty(); render(); }
function setRead(k) { F.read = k; render(); }
function toggleSel(id) { SEL.has(id) ? SEL.delete(id) : SEL.add(id); render(); }
function selVisible() { visible().forEach(p => SEL.add(p.id)); render(); }
function selNone() { SEL.clear(); render(); }
/* ===== Exportar (texto, BibTeX, RIS, Word) y bibliografía ordenada ===== */
const ex = () => db.settings.export;
const EXF = {txt: ['Texto (.txt)', 'text/plain'], bib: ['BibTeX (.bib)', 'text/plain'], ris: ['RIS (.ris)', 'text/plain'], doc: ['Word (.doc)', 'application/msword'], docx: ['Word (.docx)', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']};
const isTl = f => f === 'txt' || f === 'doc' || f === 'docx';   // formatos de texto con estilo de cita (los demás son BibTeX y RIS)
const EXO = {auto: 'Automático (según el estilo: APA alfabético; Vancouver, lista)', list: 'Orden de la lista', alpha: 'Alfabético', year: 'Por año'};
const secName = id => db.sections.find(s => s.id === id)?.name || 'Sin sección';
const ascii = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PART = /^((de|del|la|las|los|van|von|der|den|di|da|du|le|el)\s+)+/i;   // partículas de los apellidos compuestos
let EXS = 'vis';   // alcance elegido: sel | vis | all
function sortKeyOf(p, particles) {   // clave de orden: la manual del paper o, si no hay, el primer apellido (sin partículas si se pide)
  const k = p.sortKey?.trim(); if (k) return k;
  const a = pAuth(p.authors.slice(0, 1), p.authorType)[0]?.l || (OWN(p) ? noAbbr(p.venue) : '') || p.title;   // una entidad se ordena por su nombre completo
  return particles ? a.replace(PART, '') : a;
}
function exList() {
  const o = ex();
  let L = EXS === 'sel' ? db.papers.filter(p => SEL.has(p.id)) : EXS === 'vis' ? visible() : [...db.papers];
  const ord = o.order === 'auto' ? ((isTl(o.fmt) && STYLES[o.style]?.order === 'alpha') ? 'alpha' : 'list') : o.order;
  const key = p => sortKeyOf(p, o.particles), cmp = (a, b) => key(a).localeCompare(key(b), 'es'), yr = p => +p.year || 0;
  if (ord === 'alpha') L.sort((a, b) => cmp(a, b) || yr(a) - yr(b) || a.title.localeCompare(b.title, 'es'));
  else if (ord === 'year') L.sort((a, b) => yr(a) - yr(b) || cmp(a, b));
  else L = sortList(L);
  EXTYPES = [...new Set(L.map(p => p.type))]; EXOM = 0; if (isTl(o.fmt)) { const om = STYLES[o.style]?.omit; if (om) { const n0 = L.length; L = L.filter(p => !om(p)); EXOM = n0 - L.length; } }   // la guía excluye algunos tipos de la lista de referencias
  return L;
}
let EXOM = 0, EXTYPES = [];   // cuántos papers se omitieron en la última exportación · tipos presentes antes de omitir (para los avisos)
const cite = (p, o, ys) => p.cites[o.style] ?? STYLES[o.style].fn(p, ys ? {...o, ys} : o);
function exText(L, o) {
  const sx = yearSuffixes(L, o);
  const items = L.map((p, i) => { let t = (isNum(o) ? numLbl(i + 1, o) : '') + citeTxt(cite(p, o, sx.get(p.id)));
    if (o.notes) p.notes.filter(n => n.content.trim()).forEach(n => t += `\n   [${secName(n.sectionId)}] ${mdPlain(n.content.trim())}`);
    return t; });
  return (o.title ? o.title + '\n\n' : '') + items.join('\n\n');
}
function exHtml(L, o) {   // sangría francesa de 1,27 cm (36 pt); las notas se exportan con su formato
  const sx = yearSuffixes(L, o);
  const items = L.map((p, i) => {
    const notes = o.notes ? p.notes.filter(n => n.content.trim()).map(n => `<div style="margin:0 0 6pt 36pt;font-size:10pt"><i>[${esc(secName(n.sectionId))}]</i>${md(n.content)}</div>`).join('') : '';
    return `<p style="margin:0 0 ${notes ? 2 : 8}pt 36pt;text-indent:-36pt">${citeHtml((isNum(o) ? numLbl(i + 1, o) : '') + cite(p, o, sx.get(p.id)))}</p>${notes}`;
  });
  return `<div style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.15">${o.title ? `<h2 style="font-size:14pt">${esc(o.title)}</h2>` : ''}${items.join('')}</div>`;
}
// ---- Word real (.docx): paquete OOXML mínimo en un ZIP sin compresión, sin dependencias. Sangría francesa de 1,27 cm, cursiva y negrita reales.
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {   // [[nombre, texto]] → Uint8Array (método 0 = almacenado; nombres UTF-8)
  const enc = new TextEncoder(), u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255], loc = [], cen = []; let off = 0;
  for (const [name, txt] of files) {
    const nb = enc.encode(name), d = enc.encode(txt), crc = crc32(d), common = [...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0)];
    const lh = [0x50, 0x4b, 3, 4, ...u16(20), ...common]; loc.push(new Uint8Array(lh), nb, d);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += lh.length + nb.length + d.length; }
  const cdSize = cen.reduce((a, b) => a + b.length, 0), end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), 0, 0]);
  const all = [...loc, ...cen, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; for (const b of all) { out.set(b, p); p += b.length; } return out;
}
const docxRuns = (s, sz) => {   // *cursiva* y **negrita** (y \* literal) → runs de Word; sz = tamaño en medios puntos (orden del esquema: b, i, sz)
  const out = []; for (const part of String(s ?? '').replace(/\\\*/g, '\u0001').split(/(\*\*.+?\*\*|\*.+?\*)/)) { if (!part) continue;
    const b = /^\*\*.+\*\*$/.test(part), i = !b && /^\*.+\*$/.test(part), t = (b ? part.slice(2, -2) : i ? part.slice(1, -1) : part).replace(/\u0001/g, '*');
    out.push(`<w:r>${b || i || sz ? `<w:rPr>${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`); }
  return out.join(''); };
function exDocx(L, o) {
  const sx = yearSuffixes(L, o), W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', P = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`, H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const body = [o.title ? P(`<w:r><w:t xml:space="preserve">${esc(o.title)}</w:t></w:r>`, '<w:pStyle w:val="Heading1"/>') : ''];
  L.forEach((p, i) => {
    body.push(P(docxRuns((isNum(o) ? numLbl(i + 1, o) : '') + cite(p, o, sx.get(p.id))), '<w:ind w:left="720" w:hanging="720"/>'));   // sangría francesa
    if (o.notes) p.notes.filter(n => n.content.trim()).forEach(n => n.content.trim().split('\n').forEach((ln, j) => body.push(P(docxRuns(j ? '' : `*[${secName(n.sectionId)}]* `, 20) + noteRuns(ln, 20), '<w:spacing w:after="40"/><w:ind w:left="720"/>')))); });
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipStore([
    ['[Content_Types].xml', `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/></Relationships>`],
    ['word/styles.xml', `${H}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`],
    ['word/document.xml', `${H}<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`]]);
}
const wordDoc = (L, o) => `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Bibliografía</title></head><body>${exHtml(L, o)}</body></html>`;
const BIBK = {articulo: 'article', libro: 'book', capitulo: 'incollection', congreso: 'inproceedings', tesis: 'phdthesis', web: 'misc', prensa: 'article', blog: 'online', informe: 'techreport', norma: 'standard', patente: 'patent', dataset: 'dataset', software: 'software', audiovisual: 'video', audio: 'audio', legislacion: 'legislation', mapa: 'misc', basedatos: 'misc', redsocial: 'misc', ia: 'misc', diccionario: 'misc', presentacion: 'misc', personal: 'misc'};
const BIBV = {informe: 'institution', norma: 'organization', patente: 'organization', mapa: 'organization', dataset: 'organization', software: 'organization', basedatos: 'organization', audiovisual: 'organization', audio: 'organization', redsocial: 'organization', ia: 'organization', diccionario: 'organization', presentacion: 'organization', personal: 'organization', legislacion: 'organization', prensa: 'journal', blog: 'journal', articulo: 'journal', capitulo: 'booktitle', congreso: 'booktitle', tesis: 'school', libro: 'publisher'};
const STOPW = new Set(['the', 'and', 'for', 'del', 'los', 'las', 'una', 'con', 'por', 'que']);
const texEsc = s => String(s).replace(/([&%$#_])/g, '\\$1');
const bibName = (p, x) => { x = x.trim(); return p.authorType === 'entidad' || (p.authorType !== 'persona' && isOrg(x)) ? `{${texEsc(x)}}` : texEsc(x); };   // entidades entre llaves
function bibtex(L) {
  L = L.map(effP);
  const used = new Map();
  return L.map(p => {
    const au = p.authorType === 'sin_autor' ? [] : p.authors, ty = p.type;
    const base = (ascii(au.length ? parse(au.slice(0, 1))[0]?.l : 'anon') + (p.year || '') + (p.title.split(/\s+/).map(ascii).find(w => w.length > 3 && !STOPW.has(w)) || '')) || 'ref';
    const n = used.get(base) || 0; used.set(base, n + 1);
    let bk = BIBK[ty] || 'misc'; const tf = [];
    if (ty === 'tesis' && p.thesisType && p.thesisType !== 'Tesis doctoral') { bk = 'mastersthesis'; tf.push(['type', texEsc(p.thesisType)]); }
    const dp = okDate(p.pubDate) ? p.pubDate.split('-') : [], pg = String(p.pages || '').replace(/(\d)\s*[-–—]+\s*(\d)/g, '$1--$2');
    const f = [['author', au.map(a => bibName(p, a)).join(' and ')], ['editor', (p.editors || []).map(a => bibName({}, a)).join(' and ')], ['title', `{${texEsc(p.title)}}`], ['year', p.year], ['month', dp[1] && +dp[1]], ['day', dp[2] && +dp[2]],
      [BIBV[ty] || 'howpublished', texEsc(p.venue || '')], ['publisher', ['capitulo', 'congreso'].includes(ty) ? texEsc(p.publisher || '') : ''], ['address', shows('place', ty) ? texEsc(p.place || '') : ''], ['edition', shows('edition', ty) ? texEsc(p.edition || '') : ''],
      ['volume', ty === 'articulo' ? texEsc(p.volume || '') : ''], ['number', ty === 'articulo' || ty === 'legislacion' ? texEsc(p.issue || '') : ''], ['pages', shows('pages', ty) ? pg : ''], ['entrysubtype', ty === 'prensa' ? 'newspaper' : ty === 'blog' ? 'blog' : BIBK[ty] === 'misc' && ty !== 'web' ? ty : ''], ...tf,
      ...[['subtype', 'type'], ['authorRole', 'authorrole'], ['userHandle', 'userhandle'], ['seriesNumber', 'seriesnumber'], ['isbn', 'isbn'], ['issn', 'issn'], ['series', 'series'], ['institution', 'institution'], ['docNumber', ty === 'legislacion' ? 'docnumber' : 'number']].filter(([k]) => shows(k, ty) && !(k === 'institution' && ty === 'tesis' && !p.institution)).map(([k, b]) => [b, texEsc(p[k] || '')]),
      ['doi', normDoi(p.doi)], ['url', p.url], ['urldate', p.accessed]].filter(([, v]) => v);
    return `@${bk}{${n ? base + String.fromCharCode(96 + n) : base},\n${f.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
  }).join('\n\n');
}
const RISK = {articulo: 'JOUR', libro: 'BOOK', capitulo: 'CHAP', congreso: 'CONF', tesis: 'THES', web: 'ELEC', prensa: 'NEWS', blog: 'BLOG', informe: 'RPRT', norma: 'STAND', patente: 'PAT', mapa: 'MAP', dataset: 'DATA', software: 'COMP', basedatos: 'DBASE', audiovisual: 'VIDEO', audio: 'SOUND', redsocial: 'GEN', ia: 'GEN', diccionario: 'DICT', presentacion: 'SLIDE', personal: 'PCOMM', legislacion: 'STAT'};
const RISV = {libro: 'PB', tesis: 'PB', capitulo: 'T2', congreso: 'T2', web: 'T2', blog: 'T2', diccionario: 'T2', informe: 'PB', norma: 'PB', patente: 'PB', mapa: 'PB', dataset: 'PB', software: 'PB', basedatos: 'PB', audiovisual: 'PB', audio: 'PB', redsocial: 'PB', ia: 'PB', presentacion: 'PB', personal: 'PB', legislacion: 'PB'};   // etiqueta RIS donde va «venue» (por defecto JO)
const ris = L => L.map(effP).map(p => { const ty = p.type, pg = /^(.+?)\s*[-–—]\s*(.+)$/.exec(String(p.pages || '')) || [0, p.pages || ''], dd = d => d.replace(/-/g, '/') + '/';
  return ['TY  - ' + (RISK[ty] || 'GEN'), ...(p.authorType === 'sin_autor' ? [] : p.authors.map(a => 'AU  - ' + a)), ...(p.editors || []).map(e => 'A2  - ' + e), 'TI  - ' + p.title, p.year && 'PY  - ' + p.year, okDate(p.pubDate) && 'DA  - ' + dd(p.pubDate),
    p.venue && `${RISV[ty] || 'JO'}  - ${p.venue}`, ['capitulo', 'congreso'].includes(ty) && p.publisher && 'PB  - ' + p.publisher, ty === 'articulo' && p.volume && 'VL  - ' + p.volume, ty === 'articulo' && p.issue && 'IS  - ' + p.issue,
    shows('pages', ty) && pg[1] && 'SP  - ' + pg[1], shows('pages', ty) && pg[2] && 'EP  - ' + pg[2], shows('place', ty) && p.place && 'CY  - ' + p.place,
    shows('edition', ty) && p.edition && 'ET  - ' + p.edition, shows('subtype', ty) && p.subtype && 'M3  - ' + p.subtype, shows('authorRole', ty) && p.authorRole && 'C1  - ' + p.authorRole, shows('userHandle', ty) && p.userHandle && 'C2  - ' + p.userHandle, shows('docNumber', ty) && p.docNumber && 'M1  - ' + p.docNumber, ty === 'legislacion' && p.issue && 'IS  - ' + p.issue, ['redsocial', 'ia'].includes(ty) && 'N1  - gestor:' + ty, ty === 'tesis' && p.thesisType && 'M3  - ' + p.thesisType, shows('isbn', ty) && p.isbn && 'SN  - ' + p.isbn, shows('issn', ty) && p.issn && 'SN  - ' + p.issn, shows('series', ty) && p.series && 'T3  - ' + p.series, shows('seriesNumber', ty) && p.seriesNumber && 'IS  - ' + p.seriesNumber, shows('conferencePlace', ty) && p.conferencePlace && 'AD  - ' + p.conferencePlace,
    p.doi && 'DO  - ' + normDoi(p.doi), p.url && 'UR  - ' + p.url, p.accessed && 'Y2  - ' + dd(p.accessed), 'ER  - '].filter(Boolean).join('\r\n'); }).join('\r\n\r\n');
function openEx() {   // ventana emergente de exportación; se cierra con un clic fuera
  const o = ex(); if (!STYLES[o.style]) o.style = 'apa'; if (!EXF[o.fmt]) o.fmt = 'txt'; if (!EXO[o.order]) o.order = 'auto';
  EXS = SEL.size ? 'sel' : 'vis';
  $('#ex').innerHTML = `<h2>Exportar</h2><div id="exOpts"></div><textarea id="exText"></textarea>
    <div class="row" style="margin-top:10px"><button class="pri" onclick="exCopy()">Copiar</button><button id="exRich" onclick="exCopyRich()" title="Con sangría francesa, para pegar en Word o Docs">Copiar con formato</button><button onclick="exSave()">Guardar archivo</button><small id="exMsg"></small><button style="margin-left:auto" onclick="$('#ex').close()">Cerrar</button></div>`;
  exUI(); drawEx(); $('#ex').showModal();
}
function exSet(k, v, quiet) {   // las opciones se recuerdan en el JSON (sin crear pasos de deshacer)
  ex()[k] = v; lastSnap = JSON.stringify(db); dirty = true; touch(); if (!quiet) exUI(); drawEx();
}
function exUI() {
  const o = ex(), tl = isTl(o.fmt);
  const sel = (k, opts, cur) => `<select onchange="exSet('${k}',this.value)">${Object.entries(opts).map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const chk = (k, t) => `<label class="row"><input type="checkbox" ${o[k] ? 'checked' : ''} onchange="exSet('${k}',this.checked)"> ${t}</label>`;
  $('#exOpts').innerHTML = `<div class="grid">
    <label>Papers<select onchange="EXS=this.value;drawEx()"><option value="sel" ${EXS === 'sel' ? 'selected' : ''}>Seleccionados (${SEL.size})</option><option value="vis" ${EXS === 'vis' ? 'selected' : ''}>Visibles con los filtros (${visible().length})</option><option value="all" ${EXS === 'all' ? 'selected' : ''}>Todos (${db.papers.length})</option></select></label>
    <label>Formato${sel('fmt', Object.fromEntries(Object.entries(EXF).map(([k, v]) => [k, v[0]])), o.fmt)}</label>
    ${tl ? `<label>Estilo de cita${sel('style', Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.name])), o.style)}</label>` : ''}
    <label>Orden${sel('order', EXO, o.order)}</label>
    ${tl ? `<label>Idioma de los conectores${STYLES[o.style]?.fixedLang ? `<select disabled><option>${STYLES[o.style].fixedLang === 'en' ? 'English (fijo en este estilo)' : 'Español (fijo en este estilo)'}</option></select>` : sel('lang', {es: 'Español (y, En, consultado)', en: 'English (&, In, cited)'}, o.lang)}</label><label>Fecha de consulta${sel('dateFmt', {long: '20 de octubre de 2026', dmy: '20-10-2026', iso: '2026-10-20'}, o.dateFmt)}</label>` : ''}
    ${tl && isNum(o) ? `<label>Formato de la numeración${sel('numFmt', {auto: 'Según el estilo', dot: '1.', br: '[1]', par: '(1)'}, o.numFmt)}</label>` : ''}
    ${tl ? `<label>Título del documento<input value="${esc(o.title)}" placeholder="Referencias" oninput="exSet('title',this.value,1)"></label>` : ''}
    <div class="w exchk">${tl ? (STYLES[o.style]?.numbered ? '' : chk('num', 'Numerar')) + chk('notes', 'Incluir notas') + chk('vanAll', 'Vancouver: listar todos los autores (por defecto, 6 y «et al.»)') + chk('ppChap', 'APA: «pp.» antes de las páginas de un capítulo') + (STYLES[o.style]?.dis ? chk('disamb', 'Distinguir obras del mismo autor y año (2020a, 2020b)') : '') : ''}${chk('particles', 'Ignorar partículas al ordenar (de, del, la, van…)')}</div>
    ${tl ? `<small class="w">${STYLES[o.style]?.note ? esc(STYLES[o.style].note) + '<br>' : ''}${(exList(), EXTYPES).map(t => typeWarn(o.style, t)).filter(Boolean).map(w => '⚠ ' + esc(w) + '<br>').join('')}${esc(BASADO)}</small>` : ''}
    <small class="w">Para un caso concreto («de la Torre» bajo la T o bajo la D), rellena «Clave de orden» en la pestaña Datos del paper: tiene prioridad.</small></div>`;
}
function drawEx() {
  const o = ex(), L = exList();
  $('#exText').value = o.fmt === 'bib' ? bibtex(L) : o.fmt === 'ris' ? ris(L) : exText(L, o);   // la vista previa es editable (salvo en Word)
  $('#exText').readOnly = o.fmt === 'doc' || o.fmt === 'docx'; $('#exRich').hidden = !isTl(o.fmt);
  $('#exMsg').textContent = L.length ? `${L.length} papers${EXOM ? ` (${EXOM} omitidos: este estilo no los incluye en la lista)` : ''}` : 'No hay papers para exportar.';
}
function exCopy() { const t = $('#exText'); t.select(); document.execCommand('copy'); $('#exMsg').textContent = 'Copiado ✓'; }
async function clipHtml(html, text, host) {   // HTML + texto: al pegar en Word o Docs conserva el formato
  try { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); }
  catch { const d = document.createElement('div'); d.contentEditable = true; d.style.cssText = 'position:fixed;left:-9999px;top:0'; d.innerHTML = html; host.appendChild(d);
    const r = document.createRange(); r.selectNodeContents(d); const g = getSelection(); g.removeAllRanges(); g.addRange(r); document.execCommand('copy'); g.removeAllRanges(); d.remove(); }
}
async function clipText(t, host) {
  try { await navigator.clipboard.writeText(t); return; } catch {}
  const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;left:-9999px;top:0'; host.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
}
async function exCopyRich() {   // con sangría francesa, para pegar en Word o Docs
  const L = exList(), o = ex();
  await clipHtml(exHtml(L, o), exText(L, o), $('#ex'));
  $('#exMsg').textContent = 'Copiado con formato ✓';
}
async function exSave() {
  const o = ex(), L = exList(), [lbl, mime] = EXF[o.fmt]; if (!L.length) return alert('No hay nada que exportar.');
  const text = o.fmt === 'doc' ? wordDoc(L, o) : o.fmt === 'docx' ? exDocx(L, o) : $('#exText').value;
  try { if (FSA) { const h = await showSaveFilePicker({suggestedName: 'citas.' + o.fmt, types: [{description: lbl, accept: {[mime]: ['.' + o.fmt]}}]}); await writeTo(h, text); }
    else download(text, 'citas.' + o.fmt, mime); }
  catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
}
for (const id of ['sv', 'lk', 'tr']) {   // estas ventanas se cierran con un clic fuera (sin tocar la de edición que haya debajo)
  $('#' + id).addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));
  $('#' + id).addEventListener('click', e => { if (bdDown && outside(e, e.currentTarget)) { bdDown = false; e.currentTarget.close(); } });
}
$('#rv').addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));
$('#rv').addEventListener('click', e => { if (bdDown && outside(e, e.currentTarget)) { bdDown = false; $('#rv').close(); } });
$('#ex').addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));
$('#ex').addEventListener('click', e => { if (bdDown && outside(e, e.currentTarget)) { bdDown = false; $('#ex').close(); } });
function delPaper(id) {
  const p = db.papers.find(x => x.id === id); if (!p) return;
  if (!confirm(`¿Mover «${p.title}» a la papelera? Podrás restaurarlo durante ${TRASH_DAYS} días.`)) return;
  trashPaper(id); markDirty(); render();
}
/* ===== Edición de paper (trabaja sobre un borrador D) ===== */
function openPaper(id) {
  D = id ? structuredClone(db.papers.find(p => p.id === id)) : {id: uid(), created: new Date().toISOString(), title: '', alias: '', sortKey: '', related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: F.sec ? [F.sec] : [], authors: [], year: '', url: '', type: 'articulo', venue: '', doi: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}}; if (!id) NEWF(D);
  tab = 'all'; drawD(); $('#dlg').showModal();
}
const lbl = (k, def) => CTYPES.has(D.type) ? CTYPES.get(D.type).labels[k] || def : FLBL[k]?.[D.type] ?? def;   // etiqueta del campo según el tipo del borrador
const inp = (k, lbl, type = 'text', cls = '') => `<label class="${cls}">${lbl}<input type="${type}" data-k="${k}" value="${esc(D[k])}" oninput="D.${k}=this.value"></label>`;
const pdWarn = () => okDate(D.pubDate) && D.year && D.pubDate.slice(0, 4) !== String(D.year) ? `⚠ El año de la fecha (${D.pubDate.slice(0, 4)}) no coincide con «Año» (${D.year}): las citas usarán solo el año.` : '';
function pubSync() {   // fecha de publicación → rellena «Año» si está vacío y avisa si no coinciden (sin redibujar el formulario)
  if (okDate(D.pubDate) && !D.year) { D.year = +D.pubDate.slice(0, 4); const y = $('#dlg input[data-k="year"]'); if (y) y.value = D.year; }
  const w = $('#pdWarn'); if (w) w.textContent = pdWarn(); }
function drawD() {
  if (!TYPES[D.type]) D.type = 'articulo';
  const T = {all: 'Ver todo', data: 'Datos', cite: 'Cita', notes: 'Notas', cls: 'Secciones, etiquetas y relacionados', hist: 'Historial'};
  const blk = (id, t, body, always) => tab === 'all' || tab === 'cls' ? `<details class="cs" ${ALL_FOLD.has(id) ? '' : 'open'} ontoggle="this.open ? ALL_FOLD.delete('${id}') : ALL_FOLD.add('${id}')"><summary>${t}</summary><div class="csb">${body}</div></details>`   // en «Ver todo» cada bloque lleva su título y se pliega
    : (always ? `<h2 class="grp">${t}</h2>` : '') + body;
  let h = `<div class="dh"><h2>${esc(D.alias || D.title) || 'Nuevo paper'}</h2><div class="dbtn"><button class="pri" onclick="commit()">Guardar paper</button><button onclick="$('#dlg').close()">Cancelar</button></div></div><div class="tabs">${Object.entries(T).map(([k, v]) => `<button class="${tab === k ? 'on' : ''}" onclick="tab='${k}';drawD()">${v}</button>`).join('')}</div>`;
  if (tab === 'data' || tab === 'all') h += blk('data', 'Datos', `<div class="grid"><div class="w titlerow"><div class="pimgbox">${pimgHTML(D, 'big', `role="button" tabindex="0" onclick="imgOpen()" title="Imagen del paper (opcional): pulsa para poner una URL o un archivo, o pega una imagen copiada con Ctrl+V"`)}</div><div class="titlecol">${inp('title', 'Título *')}${inp('alias', 'Título personalizado (opcional; solo para mostrar, la cita usa el título original)')}</div></div>
    <label class="w">Autores (uno por línea: «Apellido, Nombre»)<textarea oninput="D.authors=this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${esc(D.authors.join('\n'))}</textarea></label>
    ${inp('sortKey', 'Clave de orden en la bibliografía (opcional): p. ej. «Torre» para «de la Torre, Ana»', 'text', 'w')}<label>Año<input type="number" data-k="year" value="${esc(D.year)}" oninput="D.year=this.value;pubSync()"></label><label>Tipo<select onchange="typeChange(this.value)">${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([k, v]) => `<option value="${k}" ${D.type === k ? 'selected' : ''}>${v}</option>`).join('')}${CTYPES.size ? `<optgroup label="Tipos propios">${[...CTYPES].map(([k, t]) => `<option value="${k}" ${D.type === k ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>` : ''}<option value="__new">➕ Crear un tipo propio…</option></select></label>
    ${inp('url', 'URL', 'url', 'w')}${inp('venue', lbl('venue', 'Revista / editorial / sitio'))}<label>DOI (sin https://doi.org/)<span class="row" style="flex-wrap:nowrap"><input style="flex:1;min-width:0" value="${esc(D.doi)}" oninput="D.doi=this.value"><button onclick="doiFill()" title="Rellenar con los datos de CrossRef">Buscar</button></span></label>${inp('accessed', 'Fecha de consulta', 'date')}
    <label>Enlace en la cita (si hay DOI y URL)<select onchange="D.linkMode=this.value">${Object.entries(LINK_MODES).map(([k, v]) => `<option value="${k}" ${D.linkMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" ${D.hideAccessed ? 'checked' : ''} onchange="D.hideAccessed=this.checked"> Omitir «[consultado …]» en la cita (aunque la fecha esté rellena)</label>
    <label>Tipo de autor<select onchange="D.authorType=this.value">${Object.entries(AUTH_T).map(([k, v]) => `<option value="${k}" ${D.authorType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    ${shows('volume', D.type) ? inp('volume', 'Volumen') : ''}${shows('issue', D.type) ? inp('issue', lbl('issue', 'Número')) : ''}${shows('pages', D.type) ? inp('pages', 'Páginas (p. ej. 73-98)') : ''}
    ${shows('edition', D.type) ? inp('edition', lbl('edition', 'Edición (desde la 2.ª; p. ej. «2.ª»)')) : ''}${shows('publisher', D.type) ? inp('publisher', 'Editorial (del libro o actas)') : ''}${shows('place', D.type) ? inp('place', lbl('place', 'Lugar de edición')) : ''}
    ${shows('editors', D.type) ? `<label class="w">Editores del libro (uno por línea: «Apellido, Nombre»)<textarea oninput="D.editors=this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${esc(D.editors.join('\n'))}</textarea></label>` : ''}
    ${[['isbn', 'ISBN'], ['issn', 'ISSN'], ['institution', 'Institución (facultad, departamento…)'], ['docNumber', 'Número de documento'], ['series', 'Serie o colección'], ['seriesNumber', 'Número en la serie'], ['conferenceName', 'Nombre del congreso'], ['conferencePlace', 'Lugar del congreso'], ['conferenceDates', 'Fechas del congreso']].map(([k, l]) => shows(k, D.type) ? inp(k, lbl(k, l)) : '').join('')}
    ${shows('subtype', D.type) ? `<label>Designación (opcional; p. ej. «${esc((FSUB[baseT(D.type)] || [''])[0])}»)<input type="text" data-k="subtype" list="dl_sub" value="${esc(D.subtype)}" oninput="D.subtype=this.value"><datalist id="dl_sub">${(FSUB[baseT(D.type)] || []).map(v => `<option value="${esc(v)}">`).join('')}</datalist></label>` : ''}
    ${shows('authorRole', D.type) ? inp('authorRole', 'Función del autor (p. ej. Director, Presentador)') : ''}${shows('userHandle', D.type) ? inp('userHandle', 'Usuario (sin @)') : ''}
    ${shows('pubDate', D.type) ? `<label>${lbl('pubDate', 'Fecha de publicación completa')}<input type="date" data-k="pubDate" value="${esc(D.pubDate)}" oninput="D.pubDate=this.value;pubSync()"><small id="pdWarn">${pdWarn()}</small></label>` : ''}
    ${shows('thesisType', D.type) ? `<label>Tipo de trabajo<select onchange="D.thesisType=this.value"><option value="">(sin especificar)</option>${THESIS.map(v => `<option ${D.thesisType === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
    <div class="w"><small>Lectura</small><div class="seg">${Object.entries(READ).map(([k, v]) => `<button class="${D.reading === k ? 'on' : ''}" onclick="D.reading='${k}';drawD()">${v}</button>`).join('')}</div></div>
    <div class="w"><small>Valoración</small><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${D.rating >= n ? 'on' : ''}" aria-label="Valorar con ${n} de 5" onclick="D.rating=D.rating===${n}?0:${n};drawD()">★</button>`).join('')}</div></div>
    </div>`);
  if (tab === 'notes' || tab === 'all') h += blk('gen', 'Notas generales', edBox('gen', D.general), true);
  
  if (tab === 'notes' || tab === 'all') h += blk('notes', 'Notas por sección', (db.sections.length ? '' : '<p class="empty">Crea primero una sección con «Gestionar secciones».</p>') +
    D.notes.map((n, i) => `<div class="card"><div class="row"><select onchange="D.notes[${i}].sectionId=this.value;drawD()">${db.sections.map(s => `<option value="${s.id}" ${n.sectionId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <button class="danger" onclick="D.notes.splice(${i},1);drawD()">Quitar</button></div>${edBox(n.id, n.content)}</div>`).join('') +
    (db.sections.length ? `<button onclick="addNote()" oncontextmenu="addNoteMenu(event)" title="Clic derecho: nueva nota con plantilla">+ Añadir nota</button><button onclick="addNoteMenu(event)" title="Nueva nota con plantilla">▾</button>` : ''), true);
  const citeOne = (k, s) => `<h3>${s.name}${D.cites[k] != null ? ' (editada a mano)' : ''}</h3>${typeWarn(k, D.type) ? `<small>⚠ ${esc(typeWarn(k, D.type))}</small>` : ''}
    <textarea id="c_${k}" oninput="D.cites['${k}']=this.value">${esc(D.cites[k] ?? s.fn(D))}</textarea>
    <div class="row"><button onclick="copyC('${k}',0,this)">Copiar</button><button onclick="copyC('${k}',1,this)" title="Con cursiva, para pegar en Word o Docs">Copiar con formato</button><button onclick="delete D.cites['${k}'];drawD()">Regenerar desde los datos</button></div>${ex().inText ? `<div class="itx" id="it_${k}">${itHtml(k)}</div>` : ''}`;
  const fold = tab === 'all' || tab === 'cls';   // «Ver todo» y la pestaña de clasificación comparten diseño: bloques plegables
  if (fold) {
    h += blk('secs', 'Secciones', db.sections.map(s => chip(s, D.sectionIds.includes(s.id), `toggleS('${s.id}')`)).join('') || '<p class="empty">No hay secciones. Créalas con «Gestionar secciones».</p>', true);
  }
  if (tab === 'cite' || tab === 'all') {
    h += blk('cite', 'Cita', `<small>Cursiva: *texto*. Un asterisco literal se escribe \\*. El idioma y el formato de fecha se eligen en «Exportar».</small>${ex().inText ? `<label>Página o parte citada (opcional, para la cita en el texto y las notas)<input id="locIn" value="${esc(CLOC)}" placeholder="p. ej. 87 o 87-90" oninput="CLOC=this.value;drawIT()"></label>` : ''}`
      + (tab === 'all' ? `<label>Estilo<select onchange="CITE_SEL=this.value;drawD()">${Object.entries(STYLES).map(([k, s]) => `<option value="${k}" ${citeSel() === k ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>` + citeOne(citeSel(), STYLES[citeSel()]) : Object.entries(STYLES).map(([k, s]) => citeOne(k, s)).join('')), false);
  }
  if (fold) {
    h += blk('tags', 'Etiquetas', db.tags.map(t => chip(t, D.tagIds.includes(t.id), `toggleT('${t.id}')`)).join('') || '<p class="empty">No hay etiquetas. Créalas con «Gestionar etiquetas».</p>', true);
  }
  if (fold) {
    const chips = (ids, color, del) => ids.map(id => db.papers.find(p => p.id === id)).filter(Boolean).map(p => chip({name: shortTxt(p.alias || p.title) + (del ? ' ✕' : ''), color}, 1, del ? `${del}('${p.id}')` : '')).join('');
    const by = db.papers.filter(q => (q.refTo || []).includes(D.id)).map(q => q.id);
    h += blk('rel', 'Relacionados', `<div><small>Relacionados</small></div><div>${chips(D.related, '#6b45c2', 'relDel') || '<small>Ninguno.</small>'}</div>
      <div style="margin-top:6px"><small>Este paper cita a</small></div><div>${chips(D.refTo, '#0f8b8d', 'refDel') || '<small>Ninguno.</small>'}</div>
      <div style="margin-top:6px"><small>Citado por (otros papers que lo citan)</small></div><div>${chips(by, '#888888') || '<small>Ninguno.</small>'}</div>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap"><select style="width:auto" onchange="RELT=this.value;relSearch()"><option value="rel" ${RELT === 'rel' ? 'selected' : ''}>Relacionar con</option><option value="ref" ${RELT === 'ref' ? 'selected' : ''}>Cita a</option></select><input id="relQ" placeholder="Buscar un paper…" oninput="relSearch()" style="flex:1;min-width:0"></div><div id="relRes"></div>`);
  }
  if (tab === 'hist') h += `<div class="hist">${D.history.filter(e => isToday(e.t)).reverse().map(e => `<div class="he"><small>${new Date(e.t).toLocaleString('es-ES')}</small> ${esc(e.s)}</div>`).join('') || '<small>Sin cambios hoy.</small>'}</div><small>Solo lectura. Solo muestra los cambios de hoy y no se guarda en el archivo. Creado el ${D.created ? new Date(D.created).toLocaleDateString('es-ES') : '—'}.</small>`;
  $('#dlg').innerHTML = h; hydrateImgs();
}
let bdDown = false;   // clic fuera del cuadro de edición = guardar y salir (un paper nuevo en blanco solo se cierra)
const outside = (e, el) => { const r = el.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
$('#dlg').addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));   // evita cerrar al arrastrar una selección de texto hacia fuera
$('#dlg').addEventListener('click', e => { if (!bdDown || !outside(e, e.currentTarget)) return; bdDown = false;
  !D.title.trim() && !db.papers.some(p => p.id === D.id) && !D.authors.length && !D.url && !D.notes.length ? $('#dlg').close() : commit(); });
/* ===== Notas: formato (Markdown limitado) y plantillas ===== */
/* Marcas de las notas: **negrita**, *cursiva*, ~~tachado~~, __subrayado__ (anidables); \* \_ \~ \\ \[ son literales.
   La nota se guarda como texto con marcas; el editor (contenteditable) las muestra ya aplicadas y las vuelve a escribir al guardar. */
const MK = {'**': 'strong', '__': 'u', '~~': 's', '*': 'em'}, MK_ORDER = ['**', '__', '~~', '*'];
function mdParse(s, i = 0, stop = '') {   // → [nodos, posición]; null si falta el cierre de `stop`
  const out = [], st = i; let txt = '';
  const flush = () => { if (txt) { out.push({t: 'x', v: txt}); txt = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && /[*_~\\[]/.test(s[i + 1] || '')) { txt += s[i + 1]; i += 2; continue; }
    if (c === '\u200b') { i++; continue; }
    if (stop && s.startsWith(stop, i) && i > st && !/\s/.test(s[i - 1])) { flush(); return [out, i + stop.length]; }
    if (c === '[') { const m = /^\[\[([pn]):([\w-]+)\]\]/.exec(s.slice(i, i + 80)); if (m) { flush(); out.push({t: 'l', k: m[1], id: m[2]}); i += m[0].length; continue; } }
    let hit = false;
    for (const d of MK_ORDER) {
      const nx = s[i + d.length];
      if (!s.startsWith(d, i) || !nx || /\s/.test(nx) || (d === '*' && nx === '*') || (d !== '~~' && /\w/.test(s[i - 1] || ' '))) continue;
      const r = mdParse(s, i + d.length, d);
      if (r) { flush(); out.push({t: MK[d], c: r[0]}); i = r[1]; hit = true; break; }
    }
    if (hit) continue;
    txt += c; i++;
  }
  if (stop) return null;
  flush(); return [out, i];
}
const mdNodes = t => mdParse(String(t ?? ''))[0];
const nodesHtml = (ns, edit) => ns.map(n => n.t === 'x' ? esc(n.v) : n.t === 'l' ? (h => edit ? h.replace(/^<(a|span) /, '<$1 contenteditable="false" ') : h)(linkHTML(n.k, n.id)) : `<${n.t}>${nodesHtml(n.c, edit)}</${n.t}>`).join('');
const mdInline = (t, edit) => nodesHtml(mdNodes(t), edit);
const nodesPlain = ns => ns.map(n => n.t === 'x' ? n.v : n.t === 'l' ? '[' + (linkInfo(n.k, n.id)?.label || '⚠ enlace roto') + ']' : nodesPlain(n.c)).join('');
const mdPlain = t => String(t ?? '').split('\n').map(l => nodesPlain(mdNodes(l))).join('\n');   // sin marcas (exportar a texto)
const noteRuns = (s, sz) => {   // marcas de nota → runs de Word (orden del esquema: b, i, strike, sz, u)
  const run = (ns, f) => ns.map(n => n.t === 'x' || n.t === 'l' ? (t => `<w:r><w:rPr>${f.b ? '<w:b/>' : ''}${f.i ? '<w:i/>' : ''}${f.s ? '<w:strike/>' : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}${f.u ? '<w:u w:val="single"/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`)(n.t === 'x' ? n.v : nodesPlain([n]))
    : run(n.c, {...f, [{strong: 'b', em: 'i', s: 's', u: 'u'}[n.t]]: 1})).join('');
  return run(mdNodes(s), {});
};
function md(text) {   // se escapa todo el HTML antes de aplicar el formato; la nota se guarda siempre como texto plano
  const out = []; let list = null, para = [];
  const fl = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  const fp = () => { if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; } };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const b = /^\s*[-•]\s+(.*)$/.exec(line), n = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (b || n) { fp(); const tag = b ? 'ul' : 'ol'; if (list && list.tag !== tag) fl(); (list ??= {tag, items: []}).items.push(mdInline((b || n)[1])); }
    else if (!line.trim()) { fl(); fp(); }
    else { fl(); para.push(mdInline(line)); }
  }
  fl(); fp();
  return out.join('');
}
/* ---- Editor de notas (contenteditable): texto con marcas ⇄ DOM ---- */
function mdEdit(text) {   // una línea del texto = un <div> (o un <li>), para que ida y vuelta no cambie nada
  const out = []; let list = null;
  const fl = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const b = /^\s*[-•]\s+(.*)$/.exec(line), n = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (b || n) { const tag = b ? 'ul' : 'ol'; if (list && list.tag !== tag) fl(); (list ??= {tag, items: []}).items.push(mdInline((b || n)[1], 1) || '<br>'); }
    else { fl(); out.push(`<div>${mdInline(line, 1) || '<br>'}</div>`); }
  }
  fl(); return out.join('') || '<div><br></div>';
}
const escMd = t => t.replace(/\u200b/g, '').replace(/\u00a0/g, ' ').replace(/\\(?=[*_~\\[])/g, '\\\\').replace(/\*/g, '\\*').replace(/__/g, '\\_\\_').replace(/~~/g, '\\~\\~').replace(/\[\[/g, '\\[[');
function serInline(el) {
  let o = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) { o += escMd(n.data); continue; }
    if (n.nodeType !== 1) continue;
    const tg = n.tagName;
    if (tg === 'BR') { if (n.nextSibling) o += '\n'; continue; }
    if (n.dataset?.t && n.dataset?.id && /^(A|SPAN)$/.test(tg)) { o += `[[${n.dataset.t}:${n.dataset.id}]]`; continue; }
    const inner = serInline(n), css = n.style || {};
    const mk = /^(STRONG|B)$/.test(tg) || /^(bold|[6-9]00)$/.test(css.fontWeight) ? '**' : /^(EM|I)$/.test(tg) || css.fontStyle === 'italic' ? '*'
      : /^(S|STRIKE|DEL)$/.test(tg) || /line-through/.test(css.textDecoration || css.textDecorationLine) ? '~~' : tg === 'U' || /underline/.test(css.textDecoration || css.textDecorationLine) ? '__' : '';
    if (!mk) { o += inner; continue; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner); o += m[2] ? m[1] + mk + m[2] + mk + m[3] : inner;   // los espacios de los bordes quedan fuera de la marca
  }
  return o;
}
function serEd(root) {   // DOM del editor → texto con marcas
  const out = [], BLK = /^(DIV|P|UL|OL|LI|H[1-6]|BLOCKQUOTE|PRE)$/, lines = el => serInline(el).split('\n');
  const walk = par => {
    let run = []; const flush = () => { if (run.length) { const d = document.createElement('div'); run.forEach(x => d.appendChild(x.cloneNode(true))); out.push(...lines(d)); run = []; } };
    for (const n of par.childNodes) {
      if (n.nodeType === 1 && BLK.test(n.tagName)) { flush();
        if (/^(UL|OL)$/.test(n.tagName)) [...n.children].forEach((li, k) => out.push(...lines(li).map((l, j) => j ? l : (n.tagName === 'UL' ? '- ' : (k + 1) + '. ') + l)));
        else if (n.querySelector('div,ul,ol,p')) walk(n); else out.push(...lines(n)); }
      else run.push(n);
    }
    flush();
  };
  walk(root); while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}
const noteVal = key => key === 'gen' ? D.general : D.notes.find(n => n.id === key)?.content ?? '';
const setNoteVal = (key, v) => { if (key === 'gen') D.general = v; else { const n = D.notes.find(x => x.id === key); if (n) n.content = v; } };
const edEl = key => document.getElementById('ed_' + key);
const ED_RANGE = {};   // última selección de cada editor (para insertar plantillas y enlaces tras abrir un menú o ventana)
document.addEventListener('selectionchange', () => { const s = getSelection(); if (!s.rangeCount) return;
  const el = (s.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode)?.closest?.('.ned'); if (el) ED_RANGE[el.dataset.key] = s.getRangeAt(0).cloneRange(); });
function edFocus(key) {
  const el = edEl(key); if (!el) return null; const r = ED_RANGE[key], s = getSelection();
  if (!(s.rangeCount && el.contains(s.anchorNode))) { el.focus(); if (r && el.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } }
  return el;
}
function edSync(el) { setNoteVal(el.dataset.key, serEd(el)); }
function edCmd(key, cmd) { const el = edFocus(key); if (!el) return; document.execCommand('styleWithCSS', false, false); document.execCommand(cmd); edSync(el); }
function edInsert(key, text, link) { const el = edFocus(key); if (!el) return; document.execCommand('insertHTML', false, link ? mdInline(text, 1) + '\u200b' : mdEdit(text)); edSync(el); }
const MK_RX = {'**': /(^|[^\w\\*])\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*$/, '__': /(^|[^\w\\_])__([^\s_](?:[^_]*?[^\s_])?)__$/, '~~': /(^|[^\\~])~~([^\s~](?:[^~]*?[^\s~])?)~~$/, '*': /(^|[^\w\\*])\*([^\s*](?:[^*]*?[^\s*])?)\*$/};
function edAuto(ch) {   // como en WhatsApp: al cerrar una marca el texto toma el formato; «- » o «1. » al empezar línea crea una lista
  const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return; const nd = s.anchorNode; if (nd.nodeType !== 3 || nd.parentElement.closest('a.nl')) return;
  const off = s.anchorOffset, txt = nd.data.slice(0, off);
  if (ch === ' ') {
    const blk = nd.parentElement.closest('div,li'); if (!blk || blk.tagName === 'LI' || blk.classList.contains('ned')) return;
    const r = document.createRange(); r.setStart(blk, 0); r.setEnd(nd, off); const pre = r.toString().replace(/\u00a0/g, ' ');
    if (/^(?:[-•]|\d+\.) $/.test(pre)) { r.deleteContents(); document.execCommand(/^\d/.test(pre) ? 'insertOrderedList' : 'insertUnorderedList'); }
    return;
  }
  for (const d of MK_ORDER) {
    const m = MK_RX[d].exec(txt); if (!m) continue;
    const start = m.index + m[1].length, r = document.createRange(); r.setStart(nd, start); r.setEnd(nd, off); r.deleteContents();
    const el = document.createElement(MK[d]); el.textContent = m[2]; r.insertNode(el);
    const z = document.createTextNode('\u200b'); el.after(z);
    const c = document.createRange(); c.setStart(z, 1); c.collapse(true); s.removeAllRanges(); s.addRange(c); return;
  }
}
$('#dlg').addEventListener('input', e => { const el = e.target.closest?.('.ned'); if (!el) return;
  if (e.inputType === 'insertText' && e.data && '*_~ '.includes(e.data)) edAuto(e.data); edSync(el); });
$('#dlg').addEventListener('paste', e => { const el = e.target.closest?.('.ned'); if (!el) return; e.preventDefault();
  const t = e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, /\n/.test(t) ? mdEdit(t) : mdInline(t, 1)); edSync(el); });
['copy', 'cut'].forEach(ev => $('#dlg').addEventListener(ev, e => {   // al copiar, el texto lleva las marcas; el HTML, el formato
  const el = e.target.closest?.('.ned'), s = getSelection(); if (!el || !s.rangeCount || s.isCollapsed) return;
  const w = document.createElement('div'); w.appendChild(s.getRangeAt(0).cloneContents());
  e.clipboardData.setData('text/plain', serEd(w)); e.clipboardData.setData('text/html', w.innerHTML); e.preventDefault();
  if (ev === 'cut') { document.execCommand('delete'); edSync(el); } }));
const edBox = (key, text) => `<div class="nbox" data-key="${key}">
  <div class="fmtw ${fmtPinned || FMT_OPEN.has(key) ? 'open' : ''}" data-id="${key}" onmousedown="event.preventDefault()"><button class="fmth" title="Mostrar u ocultar la barra de formato" onclick="toggleFmt('${key}')">Aa</button><div class="fmtc"><div class="fmt">
    <button title="Negrita (${db.settings.shortcuts.bold})" onclick="edCmd('${key}','bold')"><b>N</b></button><button title="Cursiva (${db.settings.shortcuts.italic})" onclick="edCmd('${key}','italic')"><i>K</i></button><button title="Tachado" onclick="edCmd('${key}','strikeThrough')"><s>T</s></button><button title="Subrayado" onclick="edCmd('${key}','underline')"><u>S</u></button>
    <button title="Lista con viñetas" onclick="edCmd('${key}','insertUnorderedList')">•</button><button title="Lista numerada" onclick="edCmd('${key}','insertOrderedList')">1.</button><button onclick="tplMenu(event,'${key}')">Plantilla ▾</button><button title="Insertar enlace a un paper o a una nota" onclick="lkOpen('${key}')">🔗</button>
    <button class="pin ${fmtPinned ? 'on' : ''}" title="Chincheta: mantiene la barra desplegada en todas las notas" onclick="togglePin()">📌</button></div></div></div><div class="ned md" id="ed_${key}" data-key="${key}" contenteditable="true" role="textbox" aria-multiline="true">${mdEdit(text)}</div></div>`;

let fmtPinned = false;   // chincheta: barras desplegadas en TODAS las notas (valor inicial: Configuración)
const FMT_OPEN = new Set();   // notas cuya barra se desplegó una a una, sin chincheta
function paintFmt() {   // cambia solo las clases, sin redibujar la ventana, para que la animación se vea
  document.querySelectorAll('#dlg .fmtw').forEach(el => el.classList.toggle('open', fmtPinned || FMT_OPEN.has(el.dataset.id)));
  document.querySelectorAll('#dlg .pin').forEach(b => b.classList.toggle('on', fmtPinned));
}
function toggleFmt(id) { if (fmtPinned) return; FMT_OPEN.has(id) ? FMT_OPEN.delete(id) : FMT_OPEN.add(id); paintFmt(); }
function togglePin() { fmtPinned = !fmtPinned; paintFmt(); }
function setFmtDefault(v) { setCfg('fmtOpen', v); fmtPinned = v; paintFmt(); }
const ALL_FOLD = new Set();   // bloques plegados en «Ver todo»
let CITE_SEL = '';   // estilo de cita mostrado en «Ver todo»
const citeSel = () => STYLES[CITE_SEL] ? CITE_SEL : STYLES[ex().style] ? ex().style : 'apa';
const tplText = t => t.text.replace(/\{fecha\}/g, new Date().toLocaleDateString('es-ES')).replace(/\{paper\}/g, D?.title || '');
function tplMenu(e, key) {
  ctxShow(e, '<div class="ctxh">Insertar plantilla</div>' + (db.settings.templates.map(t => `<button onclick="tplInsert('${key}','${t.id}')">${esc(t.name)}</button>`).join('') || '<div class="ctxh">No hay plantillas (créalas en Configuración)</div>'));
}
function tplInsert(key, id) { const t = db.settings.templates.find(x => x.id === id); ctxClose(); if (t) edInsert(key, tplText(t)); }
function addNote(tid) { const t = tid && db.settings.templates.find(x => x.id === tid); D.notes.push({id: uid(), sectionId: F.sec || db.sections[0].id, content: t ? tplText(t) : ''}); drawD(); }
function addNoteMenu(e) {
  ctxShow(e, '<div class="ctxh">Nueva nota con plantilla</div>' + (db.settings.templates.map(t => `<button onclick="ctxClose();addNote('${t.id}')">${esc(t.name)}</button>`).join('') || '<div class="ctxh">No hay plantillas (créalas en Configuración)</div>'));
}
const tplUI = () => `<div class="sct"><small>({fecha} y {paper} se sustituyen al insertar)</small>${db.settings.templates.map(t => `<div class="tplr"><div class="row" style="flex-wrap:nowrap"><input style="flex:1;min-width:0" value="${esc(t.name)}" oninput="setTpl('${t.id}','name',this.value)"><button title="Borrar" onclick="delTpl('${t.id}')">✕</button></div><textarea rows="3" oninput="setTpl('${t.id}','text',this.value)">${esc(t.text)}</textarea></div>`).join('')}<div class="row"><button onclick="addTpl()">+ Nueva plantilla</button><button onclick="resetTpl()">Restablecer las de serie</button></div></div>`;
function setTpl(id, k, v) { const t = db.settings.templates.find(x => x.id === id); if (t) { t[k] = v; markDirty(); } }
function addTpl() { db.settings.templates.push({id: uid(), name: 'Nueva plantilla', text: ''}); markDirty(); drawCfg(); }
function delTpl(id) { if (!confirm('¿Borrar esta plantilla?')) return; db.settings.templates = db.settings.templates.filter(x => x.id !== id); markDirty(); drawCfg(); }
function resetTpl() { if (!confirm('Se restablecerán las plantillas de serie y se perderán las que hayas creado o modificado. ¿Continuar?')) return; db.settings.templates = TPL_DEF.map(t => ({...t})); markDirty(); drawCfg(); }

/* ===== Enlaces entre notas ([[p:id]] = paper, [[n:id]] = nota) ===== */
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();   // búsquedas sin distinguir tildes ni mayúsculas
const LINK_RX = /\[\[([pn]):([\w-]+)\]\]/g;
function linkInfo(t, id) {   // destino del enlace; null si ya no existe
  if (t === 'p') { const p = db.papers.find(x => x.id === id); return p && {label: shortTxt(p.alias || p.title), pid: p.id}; }
  for (const p of db.papers) { const n = p.notes.find(x => x.id === id); if (n) return {label: `${secName(n.sectionId)} · ${shortTxt(n.content.replace(/\[\[[^\]]*\]\]|[*]/g, '').trim()).slice(0, 30)}`, pid: p.id}; }
  return null;
}
const linkHTML = (t, id) => { const i = linkInfo(t, id); return i ? `<a class="nl" data-t="${t}" data-id="${id}" data-p="${i.pid}">${esc(i.label)}</a>` : `<span class="nl broken" data-t="${t}" data-id="${id}">⚠ enlace roto</span>`; };
const plainLinks = s => s.replace(LINK_RX, (_, t, id) => '[' + (linkInfo(t, id)?.label || '⚠ enlace roto') + ']');
document.addEventListener('click', e => {
  const a = e.target.closest?.('a.nl[data-id]'); if (!a) return;
  e.preventDefault(); if (a.closest('#dlg')) return;   // en la edición no se navega: así no se pierde el borrador
  ['nv', 'sv', 'rv'].forEach(d => { const el = $('#' + d); if (el.open) el.close(); });
  if (a.dataset.t === 'p') openPaper(a.dataset.id); else showNotes(a.dataset.p, a.dataset.id);
});
function showNotes(id, hl) {   // visor de notas de un paper (clic derecho en «Notas» o enlace a una nota)
  const p = db.papers.find(x => x.id === id); if (!p) return;
  $('#nv').innerHTML = `<h2>${esc(p.alias || p.title)}</h2>${notesHTML(p, hl)}<div class="row" style="margin-top:12px"><button onclick="$('#nv').close()">Cerrar</button></div>`;
  if (!$('#nv').open) $('#nv').showModal();
  $('#nv .hl')?.scrollIntoView({block: 'center'});
}
function viewNotes(e, id) { e.preventDefault(); showNotes(id); }
let LK = {key: '', pid: ''};
function lkOpen(key) { LK = {key, pid: ''}; lkDraw(); $('#lk').showModal(); $('#lkQ')?.focus(); }
function lkDraw() {
  const p = LK.pid && db.papers.find(x => x.id === LK.pid);
  if (!p) { $('#lk').innerHTML = `<h2>Insertar enlace</h2><input id="lkQ" placeholder="Buscar un paper por título, autor o año…" oninput="lkSearch()" style="width:100%"><div id="lkR"></div><div class="row" style="margin-top:12px"><button onclick="$('#lk').close()">Cancelar</button></div>`; lkSearch(); return; }
  $('#lk').innerHTML = `<h2>${esc(shortTxt(p.alias || p.title))}</h2><button class="pri lkr" onclick="lkInsert('[[p:${p.id}]]')">🔗 Enlazar al paper</button><div class="ctxh">…o a una de sus notas:</div>${p.notes.filter(n => n.content.trim()).map(n => `<button class="lkr" onclick="lkInsert('[[n:${n.id}]]')"><b>${esc(secName(n.sectionId))}</b> · ${esc(shortTxt(n.content.replace(LINK_RX, '')).slice(0, 60))}</button>`).join('') || '<small>Este paper no tiene notas.</small>'}<div class="row" style="margin-top:12px"><button onclick="LK.pid='';lkDraw()">← Volver</button><button onclick="$('#lk').close()">Cancelar</button></div>`;
}
function lkSearch() {
  const q = norm($('#lkQ').value), L = db.papers.filter(p => p.id !== D.id && (!q || norm([p.title, p.alias, p.year, ...p.authors].join(' ')).includes(q))).slice(0, 10);
  $('#lkR').innerHTML = L.map(p => `<button class="lkr" onclick="LK.pid='${p.id}';lkDraw()">${esc(shortTxt(p.alias || p.title))} <small>${esc((p.authors[0] || '') + (p.year ? ' · ' + p.year : ''))}</small></button>`).join('') || '<small>Sin resultados.</small>';
}
function lkInsert(code) { $('#lk').close(); edInsert(LK.key, code, true); }
/* ===== Vista de notas por sección ===== */
let SV = {sec: '', q: '', order: 'list'};
function orderBy(L, ord) {
  const key = p => sortKeyOf(p, ex().particles), cmp = (a, b) => key(a).localeCompare(key(b), 'es'), yr = p => +p.year || 0;
  return ord === 'alpha' ? [...L].sort((a, b) => cmp(a, b) || yr(a) - yr(b)) : ord === 'year' ? [...L].sort((a, b) => yr(a) - yr(b) || cmp(a, b)) : sortList(L);
}
function svData() {   // papers con notas (de la sección elegida, o de todas) que cumplen el filtro
  const q = norm(SV.q), rows = [];
  for (const p of orderBy(db.papers, SV.order)) {
    const ns = p.notes.filter(n => n.content.trim() && (!SV.sec || n.sectionId === SV.sec) && (!q || norm([n.content, p.title, p.alias, ...p.authors].join(' ')).includes(q)));
    if (ns.length) rows.push({p, ns});
  }
  return rows;
}
const svTitle = () => 'Notas' + (SV.sec ? ' – ' + secName(SV.sec) : ' por sección');
const svAuth = p => p.authors.join('; ') + (p.year ? ' (' + p.year + ')' : '');
function svOpen(sec, e) { if (e) e.preventDefault(); SV.sec = sec || ''; svDraw(); if (!$('#sv').open) $('#sv').showModal(); }
function svDraw() {
  const opt = (k, v, cur) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v)}</option>`;
  $('#sv').innerHTML = `<h2>${esc(svTitle())}</h2><div class="grid">
    <label>Sección<select onchange="SV.sec=this.value;svDraw()">${opt('', 'Todas', SV.sec)}${db.sections.map(s => opt(s.id, s.name, SV.sec)).join('')}</select></label>
    <label>Orden de los papers<select onchange="SV.order=this.value;svDraw()">${opt('list', 'Como en la lista', SV.order)}${opt('alpha', 'Alfabético', SV.order)}${opt('year', 'Por año', SV.order)}</select></label>
    <label class="w">Filtrar<input id="svQ" value="${esc(SV.q)}" placeholder="Texto en las notas, título o autor" oninput="SV.q=this.value;svBody()"></label></div>
    <div id="svB"></div><div class="row" style="margin-top:12px"><button class="pri" onclick="svCopy()">Copiar (Markdown)</button><button onclick="svCopyRich()">Copiar con formato</button><button onclick="svSave()">Guardar .md</button><small id="svMsg"></small><button style="margin-left:auto" onclick="$('#sv').close()">Cerrar</button></div>`;
  svBody();
}
function svBody() {
  const rows = svData();
  $('#svB').innerHTML = rows.map(({p, ns}) => `<div class="svp"><h3><a class="nl" data-t="p" data-id="${p.id}">${esc(p.alias || p.title)}</a> <small>${esc(svAuth(p))}</small></h3>${ns.map(n => `<div class="nt">${SV.sec ? '' : chip(db.sections.find(s => s.id === n.sectionId) || {name: 'Sin sección', color: '#888888'}, 1)}<div class="ntx md">${md(n.content)}</div></div>`).join('')}</div>`).join('') || '<p class="empty">No hay notas que coincidan.</p>';
  $('#svMsg').textContent = `${rows.length} papers · ${rows.reduce((a, r) => a + r.ns.length, 0)} notas`;
}
const svMarkdown = () => `# ${svTitle()}\n\n` + svData().map(({p, ns}) => `## ${p.alias || p.title}\n*${svAuth(p)}*\n\n` + ns.map(n => (SV.sec ? '' : `**[${secName(n.sectionId)}]** `) + plainLinks(n.content.trim())).join('\n\n')).join('\n\n');
const svHtml = () => `<div style="font-family:'Times New Roman',serif;font-size:12pt"><h1 style="font-size:16pt">${esc(svTitle())}</h1>${svData().map(({p, ns}) => `<h2 style="font-size:13pt;margin-bottom:0">${esc(p.alias || p.title)}</h2><p style="margin-top:0"><i>${esc(svAuth(p))}</i></p>${ns.map(n => `<div>${SV.sec ? '' : `<b>[${esc(secName(n.sectionId))}]</b>`}${md(n.content)}</div>`).join('')}`).join('')}</div>`;
async function copyText(text, host) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-9999px'; (host || document.body).appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
}
async function copyRich(html, text, host) {   // HTML + texto: al pegar en Word o Docs conserva el formato
  try { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); return true; } catch {}
  const d = document.createElement('div'); d.contentEditable = true; d.style.cssText = 'position:fixed;left:-9999px;top:0'; d.innerHTML = html; host.appendChild(d);
  const r = document.createRange(); r.selectNodeContents(d); const g = getSelection(); g.removeAllRanges(); g.addRange(r); const ok = document.execCommand('copy'); g.removeAllRanges(); d.remove(); return ok;
}
async function saveText(text, name, mime, ext, label) {
  try { if (FSA) { const h = await showSaveFilePicker({suggestedName: name, types: [{description: label, accept: {[mime]: ['.' + ext]}}]}); await writeTo(h, text); } else download(text, name, mime); }
  catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
}
async function svCopy() { $('#svMsg').textContent = (await copyText(svMarkdown(), $('#sv'))) ? 'Copiado ✓' : 'No se pudo copiar'; }
async function svCopyRich() { $('#svMsg').textContent = (await copyRich(svHtml(), svMarkdown(), $('#sv'))) ? 'Copiado con formato ✓' : 'No se pudo copiar'; }
const svSave = () => saveText(svMarkdown(), 'notas.md', 'text/markdown', 'md', 'Markdown');

/* ===== Gráfico de relaciones ===== */
let GR = {all: false, vis: false};
function grLayout(n, edges, W, H) {   // disposición de fuerzas determinista: repulsión entre nodos, muelles en las aristas y gravedad al centro
  const P = Array.from({length: n}, (_, i) => ({x: W / 2 + Math.cos(2 * Math.PI * i / Math.max(n, 1)) * W * .35, y: H / 2 + Math.sin(2 * Math.PI * i / Math.max(n, 1)) * H * .35, vx: 0, vy: 0}));
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2), f = 40000 / d2; P[i].vx += dx / d * f; P[i].vy += dy / d * f; P[j].vx -= dx / d * f; P[j].vy -= dy / d * f; }
    for (const [a, b] of edges) { const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.max(Math.hypot(dx, dy), 1), f = (d - 170) * .02; P[a].vx += dx / d * f; P[a].vy += dy / d * f; P[b].vx -= dx / d * f; P[b].vy -= dy / d * f; }
    for (const q of P) { q.vx += (W / 2 - q.x) * .004; q.vy += (H / 2 - q.y) * .004; q.x = Math.min(W - 40, Math.max(40, q.x + q.vx * .5)); q.y = Math.min(H - 30, Math.max(30, q.y + q.vy * .5)); q.vx *= .8; q.vy *= .8; }
  }
  return P;
}
function grData() {   // nodos y aristas del ámbito elegido (todos o solo los visibles con los filtros actuales)
  const base = GR.vis ? visible() : db.papers, ids = new Set(base.map(p => p.id)), E = [];
  for (const p of base) { for (const r of p.related || []) if (ids.has(r) && p.id < r) E.push({a: p.id, b: r, dir: false}); for (const r of p.refTo || []) if (ids.has(r)) E.push({a: p.id, b: r, dir: true}); }
  const linked = new Set(E.flatMap(e => [e.a, e.b])), nodes = base.filter(p => GR.all || linked.has(p.id));
  return {nodes, E};
}
function grOpen() { grDraw(); $('#gr').showModal(); }
function grDraw() {
  const {nodes, E} = grData(), W = 880, H = 560, ix = new Map(nodes.map((p, i) => [p.id, i])), P = grLayout(nodes.length, E.map(e => [ix.get(e.a), ix.get(e.b)]), W, H);
  const lbl = p => esc(shortTxt(p.alias || p.title, 28)) + (p.year ? ' · ' + p.year : '');
  $('#gr').innerHTML = `<h2>Relaciones entre papers</h2>
    <div class="row"><label class="row"><input type="checkbox" ${GR.vis ? 'checked' : ''} onchange="GR.vis=this.checked;grDraw()"> Solo los papers visibles con los filtros actuales</label><label class="row"><input type="checkbox" ${GR.all ? 'checked' : ''} onchange="GR.all=this.checked;grDraw()"> Incluir los que no tienen relaciones</label></div>
    <small id="grInfo">${nodes.length} papers · ${E.length} relaciones · <span style="color:#7c5cc4">━ relacionado</span> · <span style="color:#0f8b8d">➜ cita a</span> · clic en un paper para abrirlo</small>
    ${nodes.length ? `<svg id="grSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de relaciones"><defs><marker id="grAr" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#0f8b8d"/></marker></defs>
      ${E.map(e => { const a = P[ix.get(e.a)], b = P[ix.get(e.b)]; return `<line class="ed" data-a="${e.a}" data-b="${e.b}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${e.dir ? '#0f8b8d' : '#7c5cc4'}" stroke-width="1.6" ${e.dir ? 'marker-end="url(#grAr)"' : ''}/>`; }).join('')}
      ${nodes.map((p, i) => `<g class="nd" data-id="${p.id}" onclick="grGo('${p.id}')" tabindex="0" onkeydown="if(event.key==='Enter')grGo('${p.id}')"><title>${esc(p.title)}</title><circle cx="${P[i].x.toFixed(1)}" cy="${P[i].y.toFixed(1)}" r="8" fill="var(--pri)" stroke="var(--card)" stroke-width="2"/><text x="${(P[i].x + 12).toFixed(1)}" y="${(P[i].y + 4).toFixed(1)}">${lbl(p)}</text></g>`).join('')}</svg>` : '<p class="empty">Todavía no hay relaciones. Añádelas en la pestaña «Relacionados» de cada paper.</p>'}
    <div class="row" style="margin-top:12px"><button style="margin-left:auto" onclick="$('#gr').close()">Cerrar</button></div>`;
}
function grGo(id) { $('#gr').close(); openPaper(id); }

/* ===== Papelera ===== */
function trashPaper(id) {   // el paper sale de la lista pero se guarda en el JSON, con quién lo citaba, hasta que caduque
  const p = db.papers.find(x => x.id === id); if (!p) return;
  const by = db.papers.filter(q => (q.refTo || []).includes(id)).map(q => q.id);
  db.papers = db.papers.filter(x => x.id !== id);
  db.papers.forEach(q => { q.related = (q.related || []).filter(x => x !== id); q.refTo = (q.refTo || []).filter(x => x !== id); });
  db.trash.push({paper: p, at: new Date().toISOString(), by}); SEL.delete(id); EXP.delete(id);
}
function trOpen() { db.trash = db.trash.filter(t => trashLeft(t) > 0); trDraw(); $('#tr').showModal(); }
function trDraw() {
  $('#tr').innerHTML = `<h2>Papelera</h2><p class="empty">Los papers eliminados se borran definitivamente a los ${TRASH_DAYS} días.</p>` + (db.trash.length ? [...db.trash].reverse().map(t => `<div class="irow"><span><b>${esc(t.paper.alias || t.paper.title)}</b><br><small>${esc(svAuth(t.paper))} · quedan ${trashLeft(t)} días</small></span><span class="row" style="margin-left:auto;flex-wrap:nowrap"><button class="sm" onclick="trashRestore('${t.paper.id}')">Restaurar</button><button class="sm" title="Borrar definitivamente" onclick="trashDelete('${t.paper.id}')">✕</button></span></div>`).join('') : '<p class="empty">La papelera está vacía.</p>')
    + `<div class="row" style="margin-top:12px">${db.trash.length ? '<button onclick="trashEmpty()">Vaciar papelera</button>' : ''}<button style="margin-left:auto" onclick="$('#tr').close()">Cerrar</button></div>`;
}
function trashRestore(id) {
  const i = db.trash.findIndex(t => t.paper.id === id); if (i < 0) return;
  const {paper: p, by = []} = db.trash[i]; db.trash.splice(i, 1);
  p.tagIds = (p.tagIds || []).filter(t => db.tags.some(x => x.id === t)); p.sectionIds = (p.sectionIds || []).filter(x => db.sections.some(y => y.id === x));
  p.notes ??= []; p.cites ??= {}; p.history ??= []; NEWF(p); p.related = (p.related || []).filter(r => db.papers.some(x => x.id === r)); p.refTo = (p.refTo || []).filter(r => db.papers.some(x => x.id === r));
  p.related.forEach(r => { const q = db.papers.find(x => x.id === r); if (!q.related.includes(p.id)) q.related.push(p.id); });
  by.forEach(r => { const q = db.papers.find(x => x.id === r); if (q && !(q.refTo ??= []).includes(p.id)) q.refTo.push(p.id); });   // vuelve a estar citado por quien lo citaba
  logChange(p, 'Restaurado desde la papelera'); db.papers.push(p); markDirty(); render(); trDraw();
}
function trashDelete(id) { if (!confirm('¿Borrar definitivamente este paper? No se podrá recuperar.')) return; db.trash = db.trash.filter(t => t.paper.id !== id); markDirty(); render(); trDraw(); }
function trashEmpty() { if (!confirm('¿Vaciar la papelera? Los papers que contiene no se podrán recuperar.')) return; db.trash = []; markDirty(); render(); trDraw(); }
function setView(v) { db.settings.view = v; lastSnap = JSON.stringify(db); dirty = true; touch(); render(); }   // la vista se recuerda en el JSON sin crear pasos de deshacer

/* ===== Historial de cambios y relaciones ===== */
const shortTxt = v => { v = String(v ?? '').replace(/\s+/g, ' ').trim(); return !v ? '—' : v.length > 60 ? v.slice(0, 57) + '…' : v; };
const HMAX = () => 50;   // el historial no se guarda en el JSON: solo vive en memoria durante el día
const dbJSON = () => JSON.stringify(db, (k, v) => k === 'history' ? undefined : v, 2);   // en el JSON solo queda la fecha de creación (created)
const isToday = t => new Date(t).toDateString() === new Date().toDateString();
function logChange(p, ...msgs) {
  const t = new Date().toISOString(); p.history ??= [];
  msgs.filter(Boolean).forEach(s => p.history.push({t, s}));
  if (p.history.length > HMAX()) p.history.splice(0, p.history.length - HMAX());
}
const DIFF_F = {subtype: 'Designación', authorRole: 'Función del autor', userHandle: 'Usuario (@)', title: 'Título', alias: 'Título personalizado', year: 'Año', venue: 'Revista/editorial', doi: 'DOI', url: 'URL', type: 'Tipo', accessed: 'Fecha de consulta', reading: 'Lectura', rating: 'Valoración', sortKey: 'Clave de orden', volume: 'Volumen', issue: 'Número', pages: 'Páginas', edition: 'Edición', publisher: 'Editorial', place: 'Lugar', pubDate: 'Fecha de publicación', thesisType: 'Tipo de trabajo', isbn: 'ISBN', issn: 'ISSN', series: 'Serie', seriesNumber: 'Número en la serie', institution: 'Institución', docNumber: 'Número de documento', conferenceName: 'Congreso', conferencePlace: 'Lugar del congreso', conferenceDates: 'Fechas del congreso', authorType: 'Tipo de autor', linkMode: 'Enlace en la cita'};
function diffPaper(a, b) {   // a = versión guardada, b = borrador; solo guarda «antes → después» en campos cortos
  const out = [], show = (k, v) => shortTxt(k === 'reading' ? READ[v] : k === 'type' ? TYPES[v] : k === 'authorType' ? AUTH_T[v] : k === 'linkMode' ? LINK_MODES[v] : v), same = k => JSON.stringify(a[k]) === JSON.stringify(b[k]);
  for (const [k, n] of Object.entries(DIFF_F)) if (String(a[k] ?? '') !== String(b[k] ?? '')) out.push(`${n}: ${show(k, a[k])} → ${show(k, b[k])}`);
  if (!same('authors')) out.push('Autores modificados');
  if (!same('editors')) out.push('Editores modificados');
  if (!!a.hideAccessed !== !!b.hideAccessed) out.push(`Fecha de consulta en la cita: ${b.hideAccessed ? 'omitida' : 'incluida'}`);
  if ((a.general || '') !== (b.general || '')) out.push('Notas generales modificadas');
  if (JSON.stringify(a.image || null) !== JSON.stringify(b.image || null)) out.push(b.image ? 'Imagen cambiada' : 'Imagen quitada');
  if (!same('notes')) out.push('Notas por sección editadas');
  if (!same('cites')) out.push('Citas editadas a mano');
  const lst = (label, x, y, name) => { const add = y.filter(i => !x.includes(i)).map(name), del = x.filter(i => !y.includes(i)).map(name);
    if (add.length || del.length) out.push(`${label}: ${[...add.map(n => '+' + n), ...del.map(n => '−' + n)].join(', ')}`); };
  lst('Etiquetas', a.tagIds, b.tagIds, i => db.tags.find(t => t.id === i)?.name || '?');
  lst('Secciones', a.sectionIds, b.sectionIds, i => secName(i));
  lst('Relacionados', a.related, b.related, i => shortTxt(db.papers.find(p => p.id === i)?.title));
  lst('Cita a', a.refTo || [], b.refTo || [], i => shortTxt(db.papers.find(p => p.id === i)?.title));
  return out;
}
function syncRelated(before, p) {   // mantiene la relación simétrica: añade o quita este paper en la lista del otro extremo
  const now = new Set(p.related);
  for (const id of new Set([...before, ...now])) { const q = db.papers.find(x => x.id === id); if (!q || q.id === p.id) continue;
    const has = q.related.includes(p.id);
    if (now.has(id) && !has) { q.related.push(p.id); logChange(q, 'Relacionado con: ' + shortTxt(p.title)); }
    if (!now.has(id) && has) { q.related = q.related.filter(x => x !== p.id); logChange(q, 'Relación quitada: ' + shortTxt(p.title)); } }
}
let RELT = 'rel';   // tipo de relación que se está añadiendo: rel (simétrica) o ref (este paper cita a…)
function relSearch() {
  const q = norm($('#relQ').value.trim()); if (!q) { $('#relRes').innerHTML = ''; return; }
  const list = RELT === 'ref' ? D.refTo : D.related;
  const L = db.papers.filter(p => p.id !== D.id && !list.includes(p.id) && norm([p.title, p.alias, p.year, ...p.authors].join(' ')).includes(q)).slice(0, 8);
  $('#relRes').innerHTML = L.map(p => `<button class="relr" onclick="relAdd('${p.id}')">${esc(shortTxt(p.alias || p.title))} <small>${esc((p.authors[0] || '') + (p.year ? ' · ' + p.year : ''))}</small></button>`).join('') || '<small>Sin resultados.</small>';
}
function relAdd(id) { (RELT === 'ref' ? D.refTo : D.related).push(id); drawD(); }
function relDel(id) { D.related = D.related.filter(x => x !== id); drawD(); }
function refDel(id) { D.refTo = D.refTo.filter(x => x !== id); drawD(); }
const relCount = p => p.related.length + (p.refTo || []).length + db.papers.filter(q => (q.refTo || []).includes(p.id)).length;
function viewRel(id) {   // relaciones de un paper: relacionados, cita a y citado por; se cierra con un clic fuera
  const p = db.papers.find(x => x.id === id); if (!p) return;
  const sec = (t, ids) => { const L = ids.map(i => db.papers.find(x => x.id === i)).filter(Boolean);
    return L.length ? `<h3 style="margin:10px 0 2px">${t}</h3>` + L.map(q => `<div class="irow"><span><b>${esc(q.alias || q.title)}</b><br><small>${esc(q.authors.join('; '))}${q.year ? ' · ' + esc(q.year) : ''}</small></span><button class="sm" style="margin-left:auto" onclick="$('#rv').close();openPaper('${q.id}')">Editar</button></div>`).join('') : ''; };
  $('#rv').innerHTML = `<h2>Relaciones de «${esc(shortTxt(p.alias || p.title))}»</h2>${sec('Relacionados', p.related)}${sec('Cita a', p.refTo || [])}${sec('Citado por', db.papers.filter(q => (q.refTo || []).includes(id)).map(q => q.id))}<div class="row" style="margin-top:12px"><button onclick="$('#rv').close()">Cerrar</button></div>`;
  $('#rv').showModal();
}
function movePaper(id, from, to) {   // arrastrar un paper de una sección a otra (a '' = Sin sección)
  if (from === to) return;
  const p = db.papers.find(x => x.id === id); if (!p) return;
  p.sectionIds = p.sectionIds.filter(x => x !== from);
  if (to && !p.sectionIds.includes(to)) p.sectionIds.push(to);
  logChange(p, 'Sección: ' + (from ? secName(from) : 'Sin sección') + ' → ' + (to ? secName(to) : 'Sin sección'));
  if (from && to) p.notes.forEach(n => { if (n.sectionId === from) n.sectionId = to; });   // sus notas se mueven con él
  markDirty(); render();
}
function addTag(id, tid) { const p = db.papers.find(x => x.id === id); if (p && !p.tagIds.includes(tid)) { p.tagIds.push(tid); logChange(p, 'Etiqueta añadida: ' + (db.tags.find(t => t.id === tid)?.name || '?')); markDirty(); } render(); }
const clearOver = () => document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
document.addEventListener('dragstart', e => {
  const t = e.target.closest?.('.chip[data-tag], .card[draggable=true], .rw[draggable=true]'); if (!t) return;
  if (t.dataset.tag) { e.dataTransfer.setData('application/x-tag', t.dataset.tag); e.dataTransfer.effectAllowed = 'copy'; }
  else { e.dataTransfer.setData('application/x-paper', JSON.stringify({id: t.dataset.id, from: t.dataset.from || ''})); e.dataTransfer.effectAllowed = 'move'; t.classList.add('drag'); }
});
document.addEventListener('dragend', () => { clearOver(); document.querySelectorAll('.drag').forEach(x => x.classList.remove('drag')); });
$('#list').addEventListener('dragover', e => {   // etiqueta -> tarjeta; paper -> grupo de sección
  const ty = [...e.dataTransfer.types], tgt = ty.includes('application/x-tag') ? e.target.closest('.card, .rw') : ty.includes('application/x-paper') ? e.target.closest('.gbox') : null;
  if (!tgt) return; e.preventDefault(); clearOver(); tgt.classList.add('over');
});
$('#list').addEventListener('drop', e => {
  const tag = e.dataTransfer.getData('application/x-tag'), pap = e.dataTransfer.getData('application/x-paper'), c = e.target.closest('.card, .rw'), g = e.target.closest('.gbox');
  clearOver();
  if (tag && c) { e.preventDefault(); addTag(c.dataset.id, tag); }
  else if (pap && g) { e.preventDefault(); const d = JSON.parse(pap); movePaper(d.id, d.from, g.dataset.sec); }
});
$('#nv').addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));
$('#nv').addEventListener('click', e => { if (bdDown && outside(e, e.currentTarget)) { bdDown = false; $('#nv').close(); } });
function toggleS(id) { const i = D.sectionIds.indexOf(id); i < 0 ? D.sectionIds.push(id) : D.sectionIds.splice(i, 1); drawD(); }
function toggleT(id) { const i = D.tagIds.indexOf(id); i < 0 ? D.tagIds.push(id) : D.tagIds.splice(i, 1); drawD(); }
let CLOC = '';   // página o parte citada que se usa en la cita en el texto (no se guarda)
const itHtml = k => STYLES[k].inText(D, ex(), CLOC).map((x, i) => `<div class="row" style="align-items:center"><small>${esc(x.k)}:</small> <span>${citeHtml(x.t)}</span><button onclick="copyIT('${k}',${i},0,this)">Copiar</button><button onclick="copyIT('${k}',${i},1,this)" title="Con cursiva, para pegar en Word o Docs">Copiar con formato</button></div>`).join('');
function drawIT() { for (const k of Object.keys(STYLES)) { const e = $('#it_' + k); if (e) e.innerHTML = itHtml(k); } }
async function copyIT(k, i, rich, b) {   // copia la cita en el texto (texto plano o con cursiva real)
  const t = STYLES[k].inText(D, ex(), CLOC)[i].t, host = $('#dlg');
  if (rich) await clipHtml(`<p style="font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(t)}</p>`, citeTxt(t), host); else await clipText(citeTxt(t), host);
  if (b) { const o = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = o, 1400); }
}
async function copyC(k, rich, b) {   // copia la cita sin marcas (texto) o con cursiva real (formato)
  const raw = $('#c_' + k).value, host = $('#dlg');
  if (rich) await clipHtml(`<p style="font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(raw)}</p>`, citeTxt(raw), host); else await clipText(citeTxt(raw), host);
  if (b) { const t = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = t, 1400); }
}
function commit() {
  if (!D.title.trim()) { tab = 'data'; drawD(); return alert('El título es obligatorio.'); }
  if (D.url && !/^https?:\/\//i.test(D.url)) return alert('La URL debe empezar por http:// o https://');
  D.year = D.year ? +D.year : '';
  D.modified = new Date().toISOString();
  const i = db.papers.findIndex(p => p.id === D.id), old = i < 0 ? null : db.papers[i];
  logChange(D, ...(old ? diffPaper(old, D) : ['Creado']));
  if (PEND.has(D.id)) idb('readwrite', st => st.put(PEND.get(D.id), 'img:' + D.id)).catch(() => {});
  syncRelated(old ? old.related : [], D);
  i < 0 ? db.papers.push(D) : db.papers[i] = D;
  markDirty(); $('#dlg').close(); render();
}

/* ===== Gestor de etiquetas y secciones ===== */
function openMg(k) { MG = k; drawMg(); $('#mg').showModal(); }
function drawMg() {
  $('#mg').innerHTML = `<h2>${MG === 'tags' ? 'Etiquetas' : 'Secciones'}</h2>` + db[MG].map(x => `<div class="row" style="margin-bottom:6px">
    <input type="color" value="${x.color || '#888888'}" oninput="upd('${x.id}','color',this.value)"><input value="${esc(x.name)}" oninput="upd('${x.id}','name',this.value)">
    ${MG === 'sections' ? `<input placeholder="Descripción" value="${esc(x.description || '')}" oninput="upd('${x.id}','description',this.value)">` : ''}
    <button title="Subir" onclick="moveM('${x.id}',-1)">↑</button><button title="Bajar" onclick="moveM('${x.id}',1)">↓</button><button class="danger" onclick="delM('${x.id}')">Eliminar</button></div>`).join('') +
    `<div class="row"><button class="pri" onclick="db[MG].push({id:'${uid()}',name:'Nueva',color:'#2457c5',tagIds:[]});markDirty();drawMg()">+ Añadir</button><button onclick="$('#mg').close();render()">Cerrar</button></div>`;
}
function upd(id, k, v) { db[MG].find(x => x.id === id)[k] = v; markDirty(); }
function moveM(id, d) { const a = db[MG], i = a.findIndex(x => x.id === id), j = i + d;
  if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; markDirty(); drawMg(); }
function toggleST(sid, tid) { const s = db.sections.find(x => x.id === sid), i = s.tagIds.indexOf(tid);
  i < 0 ? s.tagIds.push(tid) : s.tagIds.splice(i, 1); markDirty(); drawMg(); }
function delM(id) {
  const x = db[MG].find(y => y.id === id);
  if (!confirm(MG === 'tags' ? `¿Eliminar la etiqueta «${x.name}»? Se quitará de todos los papers y secciones.` : `¿Eliminar la sección «${x.name}»? Se borrarán las notas asociadas a ella.`)) return;
  db[MG] = db[MG].filter(y => y.id !== id);
  if (MG === 'tags') { db.papers.forEach(p => p.tagIds = p.tagIds.filter(t => t !== id)); F.tags.delete(id); db.sections.forEach(s => s.tagIds = s.tagIds.filter(t => t !== id)); }
  else { db.papers.forEach(p => { p.notes = p.notes.filter(n => n.sectionId !== id); p.sectionIds = p.sectionIds.filter(x => x !== id); }); if (F.sec === id) F.sec = ''; }
  markDirty(); drawMg();
}
render();
lastSnap = JSON.stringify(db);
applySettings();
if (FSA) idb('readonly', st => st.get('last')).then(h => $('#reopen').hidden = !h).catch(() => {});
else { $('#auto').disabled = true; $('#auto').parentElement.title = 'El autoguardado solo está disponible en Chrome o Edge de escritorio'; }
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});   // PWA (no aplica en file://)
$('#cfg').addEventListener('close', () => { recAct = null; });
if (location.protocol.startsWith('http')) fetch('ejemplo_papers.json').then(r => r.ok ? r.text() : Promise.reject()).then(t => { if (!dirty && !db.papers.length) loadText(t, 'ejemplo_papers.json'); }).catch(() => {});   // en la web se abre el ejemplo por defecto
document.addEventListener('scroll', e => {   // la cabecera fija de un diálogo se estrecha al bajar (con histéresis para que no parpadee)
  const d = e.target, h = d.tagName === 'DIALOG' && d.querySelector(':scope > .dh'); if (!h) return;
  if (d.scrollTop > 40) h.classList.add('sm'); else if (d.scrollTop < 10) h.classList.remove('sm');
}, true);
