'use strict';
/* ===== Persistencia =====
   Chrome/Edge: File System Access API (elige un archivo una vez y se guarda/autoguarda sobre él).
   Otros navegadores: abrir con selector y guardar como descarga. */
const FSA = 'showSaveFilePicker' in window;
let handle = null;   // archivo elegido por el usuario
const JSON_T = [{description: 'Datos de papers (JSON)', accept: {'application/json': ['.json']}}];
let IDB_CONN = null;   // una sola conexión a IndexedDB para toda la sesión (abrirla en cada lectura cuesta, sobre todo en el móvil)
const idbOpen = () => IDB_CONN ??= new Promise((res, rej) => {
  const r = indexedDB.open('gestor-papers', 1); r.onupgradeneeded = () => r.result.createObjectStore('k');
  r.onerror = () => { IDB_CONN = null; rej(r.error); };
  r.onsuccess = () => { const c = r.result; c.onversionchange = c.onclose = () => { c.close(); IDB_CONN = null; }; res(c); }; });
const idb = (mode, fn) => idbOpen().then(c => new Promise((res, rej) => {   // IndexedDB: recuerda el último archivo entre sesiones
  let t; try { t = c.transaction('k', mode); } catch (e) { IDB_CONN = null; return rej(e); }   // la conexión se cerró: la siguiente vez se abre otra
  const q = fn(t.objectStore('k')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
/* ---- Copia de trabajo con las imágenes aparte ----
   Las imágenes incrustadas (data:) no van dentro del JSON de la copia de trabajo: cada una se guarda una sola vez en «imgd:<huella>»
   y el JSON lleva {kind: 'data', ref: huella} (marcado con img: 1). Así guardar la sesión tras cada cambio no reescribe todas las imágenes. */
const IMG_H = new Map(), IMG_SAVED = new Set();   // imagen → huella (se calcula una vez) · huellas ya escritas en esta sesión
const imgHash = d => { let h = IMG_H.get(d); if (!h) { h = syHash(d); IMG_H.set(d, h); } return h; };
function projWire(d, snap) {   // JSON compacto de la copia de trabajo y las imágenes que aún no se han escrito; snap: una copia de snapDb() que ya coincide con d
  if (snap && d === db) { const json = snapStr(snap), add = new Map();
    for (const m of json.matchAll(/"ref":"([0-9a-f]+)"/g)) { const h = m[1]; if (!IMG_SAVED.has(h) && IMG_POOL.has(h)) add.set(h, IMG_POOL.get(h)); }
    return [json, add]; }
  const add = new Map(), json = JSON.stringify(d, (k, v) => {
    if (k === 'history') return undefined;
    if (k === 'image' && v && v.kind === 'data' && typeof v.data === 'string') { const h = imgHash(v.data); if (!IMG_SAVED.has(h)) add.set(h, v.data); return {kind: 'data', ref: h}; }
    return v; });
  return [json, add];
}
const projPut = (st, key, rec, add) => { add.forEach((v, h) => st.put(v, 'imgd:' + h)); return st.put({...rec, img: 1}, key); };
const projSaved = add => add.forEach((v, h) => IMG_SAVED.add(h));
async function projData(rec) {   // lee una copia de trabajo (con o sin imágenes aparte) y devuelve el objeto, con sus imágenes
  if (!rec || rec.v !== 1 || typeof rec.json !== 'string') return null;
  if (!rec.img) return JSON.parse(rec.json);
  const refs = [...new Set([...rec.json.matchAll(/"ref":"([0-9a-f]+)"/g)].map(m => m[1]))], imgs = new Map();
  if (refs.length) await idb('readonly', st => { refs.forEach(h => { const q = st.get('imgd:' + h); q.onsuccess = () => { if (typeof q.result === 'string') { imgs.set(h, q.result); IMG_H.set(q.result, h); IMG_SAVED.add(h); } }; }); return null; });
  return JSON.parse(rec.json, (k, v) => k === 'image' && v && v.kind === 'data' && typeof v.ref === 'string' ? (imgs.has(v.ref) ? {kind: 'data', data: imgs.get(v.ref)} : null) : v);
}
async function imgGc() {   // borra las imágenes que ya no usa ninguna copia de trabajo ni de seguridad
  const keys = await idb('readonly', st => st.getAllKeys()).catch(() => []), used = new Set();
  const projs = keys.filter(k => typeof k === 'string' && (k.startsWith('proj:') || k.startsWith('bkd:'))), imgs = keys.filter(k => typeof k === 'string' && k.startsWith('imgd:'));
  if (!imgs.length) return;
  for (const k of projs) { const r = await idb('readonly', st => st.get(k)).catch(() => null); if (r && typeof r.json === 'string') for (const m of r.json.matchAll(/"ref":"([0-9a-f]+)"/g)) used.add(m[1]); }
  syPapersOf(db).forEach(p => { if (p.image?.kind === 'data' && p.image.data) used.add(imgHash(p.image.data)); });   // y las del proyecto abierto, aunque aún no se hayan guardado
  const gone = imgs.filter(k => !used.has(k.slice(5))); if (!gone.length) return;
  gone.forEach(k => IMG_SAVED.delete(k.slice(5)));
  await idb('readwrite', st => { gone.forEach(k => st.delete(k)); return null; }).catch(() => {});
}
const rememberHandle = () => idb('readwrite', st => { st.put(handle, 'h:' + PJ.cur); return st.put(handle, 'last'); }).catch(() => {});   // el archivo de cada proyecto
function validate(d) {
  if (!d || typeof d !== 'object' || !['papers', 'tags', 'sections'].every(k => Array.isArray(d[k])))
    throw Error('faltan las listas "papers", "tags" o "sections"');
  d.papers.forEach((p, i) => { if (!p.id || typeof p.title !== 'string' || !Array.isArray(p.authors)) throw Error(`el paper n.º ${i + 1} no tiene id, título o autores válidos`);
    p.tagIds ??= []; p.notes ??= []; p.cites ??= {}; p.notes.forEach(n => { n.id ??= uid(); n.content ??= ''; }); p.created ??= ''; p.sortKey ??= ''; p.related = Array.isArray(p.related) ? p.related : []; p.history = [];   // el historial es solo de la sesión: no se lee del JSON
    p.reading = Object.hasOwn(READ, p.reading) ? p.reading : 'por_leer'; p.rating = Number.isInteger(p.rating) && p.rating >= 0 && p.rating <= 5 ? p.rating : 0; p.sectionIds ??= [...new Set(p.notes.map(n => n.sectionId).filter(Boolean))]; NEWF(p); });
  const byId = new Map(d.papers.map(p => [p.id, p]));   // relaciones: sin ids rotos ni repetidos y siempre simétricas
  d.papers.forEach(p => { p.related = [...new Set(p.related)].filter(i => i !== p.id && byId.has(i)); p.refTo = [...new Set(Array.isArray(p.refTo) ? p.refTo : [])].filter(i => i !== p.id && byId.has(i)); });
  d.inbox = inboxClean(d.inbox);
  d.trash = (Array.isArray(d.trash) ? d.trash : []).filter(t => t && t.at && t.paper && t.paper.id && typeof t.paper.title === 'string' && Array.isArray(t.paper.authors) && trashLeft(t) > 0);   // la papelera caduca a los 5 días
  d.papers.forEach(p => p.related.forEach(i => { const q = byId.get(i); if (!q.related.includes(p.id)) q.related.push(p.id); }));
  [...d.tags, ...d.sections].forEach((x, i) => { if (!x.id || typeof x.name !== 'string') throw Error(`etiqueta/sección n.º ${i + 1} sin id o nombre`); });
  d.sections.forEach(s => s.tagIds ??= []);  // compatibilidad con archivos antiguos
  d.orders = (Array.isArray(d.orders) ? d.orders : []).filter(o => o && typeof o.id === 'string' && o.id && typeof o.name === 'string' && ['tags', 'sections'].includes(o.of))
    .map(o => ({id: o.id, name: o.name, of: o.of, fmt: Object.hasOwn(ORD_FMT, o.fmt) ? o.fmt : 'num'}));   // clasificaciones para ordenar
  [...d.tags, ...d.sections].forEach(x => { if (x.rk == null) return; x.rk = x.rk && typeof x.rk === 'object' && !Array.isArray(x.rk) ? Object.fromEntries(Object.entries(x.rk).filter(([, v]) => typeof v === 'string' && v)) : {}; if (!Object.keys(x.rk).length) delete x.rk; });
  const sIn = d.settings && typeof d.settings === 'object' ? d.settings : {};
  d.settings = {...defSettings(), ...sIn, shortcuts: {...SC_DEF}};
  d.settings.export = {...defSettings().export, ...(sIn.export && typeof sIn.export === 'object' ? sIn.export : {})};
  const xo = d.settings.export; if (!['es', 'en'].includes(xo.lang)) xo.lang = 'es'; if (!['long', 'dmy', 'iso'].includes(xo.dateFmt)) xo.dateFmt = 'long'; xo.vanAll = !!xo.vanAll; xo.ppChap = !!xo.ppChap; xo.disamb = !!xo.disamb; xo.abbrList = xo.abbrList !== false; if (!['auto', 'dot', 'br', 'par'].includes(xo.numFmt)) xo.numFmt = 'auto';
  d.settings.showProgress = !!d.settings.showProgress; d.settings.citeOnlyMain = !!d.settings.citeOnlyMain; d.settings.aliasInMore = !!d.settings.aliasInMore; if (typeof d.settings.mainStyle !== 'string') d.settings.mainStyle = 'apa'; d.settings.pdfDrive = !!d.settings.pdfDrive; d.settings.pdfVis = !!d.settings.pdfVis; d.settings.showInbox = d.settings.showInbox !== false; d.settings.pdfTab = d.settings.pdfTab === 'app' ? 'app' : 'tab'; d.settings.annAuto = !!d.settings.annAuto; d.settings.annFmt = ['md', 'cite'].includes(d.settings.annFmt) ? d.settings.annFmt : 'txt'; d.settings.inboxPos = d.settings.inboxPos === 'top' ? 'top' : 'bottom'; d.settings.inboxBtn = !!d.settings.inboxBtn; d.settings.fmtOpen = !!d.settings.fmtOpen; d.settings.view = d.settings.view === 'table' ? 'table' : 'cards';
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
async function loadText(text, name, quiet) {   // text: el JSON, o el objeto ya leído
  try { db = validate(typeof text === 'string' ? JSON.parse(text) : text); path = name; dirty = false; F.tags.clear(); F.exTags.clear(); F.sec = ''; SEL.clear(); UNDO.length = 0; REDO.length = 0; lastSnap = snapDb(); fmtPinned = db.settings.fmtOpen; applySettings(); render(); sessionSoon(); return true; }
  catch (e) { if (!quiet) say('Archivo no válido (se mantienen los datos actuales): ' + e.message); return false; }
}
async function doOpen() {   // cada archivo JSON se abre como proyecto (ver Proyectos)
  try {
    if (FSA) { const [h] = await showOpenFilePicker({types: JSON_T}); await pjOpenFile(await (await h.getFile()).text(), h.name, h); }
    else { const r = await pickFile(); if (r) await pjOpenFile(r.text, r.path, null); }
  } catch (e) { if (e.name !== 'AbortError') say('No se pudo abrir el archivo: ' + e.message); }
}
async function pjReload() {   // vuelve a leer el archivo del proyecto (Chrome pide confirmar el acceso en cada sesión)
  ctxClose(); if (!handle) return;
  try { if (await handle.requestPermission({mode: 'readwrite'}) !== 'granted') return say('Sin permiso para acceder al archivo.');
    await pjOpenFile(await (await handle.getFile()).text(), handle.name, handle);
  } catch (e) { say('No se pudo leer el archivo: ' + e.message); }
}
async function writeTo(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }   // el archivo solo cambia al cerrar: escritura segura
function download(text, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function save(asNew) {
  const text = dbJSON();
  try {
    if (FSA && handle && !asNew && handle.queryPermission && await handle.queryPermission({mode: 'readwrite'}) !== 'granted' && await handle.requestPermission({mode: 'readwrite'}) !== 'granted') handle = null;   // enlace recuperado de la sesión anterior: pide permiso o elige archivo
    if (FSA) { if (!handle || asNew) { handle = await showSaveFilePicker({suggestedName: pjFile(pjCur().name), types: JSON_T}); rememberHandle(); path = handle.name; }   // el archivo se llama como el proyecto
      await writeTo(handle, text); }
    else { path = pjFile(pjCur().name); download(text, path, 'application/json'); }
    dirty = false; hdr(); sessionSoon();
  } catch (e) { if (e.name !== 'AbortError') say('Error al guardar: ' + e.message); }
}
async function setAuto(c) {
  if (syOn()) {   // con Google Drive conectado la casilla manda sobre los dos: Drive y, si hay archivo con permiso, también el archivo
    if (c.checked && handle) { try { auto = await handle.requestPermission({mode: 'readwrite'}) === 'granted'; } catch (e) { auto = false; } } else auto = false;
    return syAutoSet(c.checked);
  }
  auto = c.checked;
  if (auto && !handle) { await save(true); if (!handle) c.checked = auto = false; }   // la primera vez pide dónde guardar
  else if (auto) markDirty();
}
const UNDO = [], REDO = [], MAXU = 50;
/* Copias del proyecto por papers (para deshacer y para la copia de trabajo)
   snapDb() devuelve {head, parts}: head es el proyecto sin los papers y parts, el JSON de cada paper; sin el historial del día y con las imágenes
   incrustadas como {kind: 'data', ref: huella} (cada imagen, una sola vez en IMG_POOL). Un paper que no cambió desde la copia anterior reutiliza
   la MISMA cadena, así las 50 copias de deshacer comparten la memoria de todo lo que no cambió (antes eran 50 copias enteras).
   snapStr(copia) da el JSON entero, que es justo el formato de la copia de trabajo (projData lo lee igual). */
const IMG_POOL = new Map();   // huella → imagen (data:)
const snapRep = (k, v) => { if (k === 'history') return undefined; if (k === 'image' && v && v.kind === 'data' && typeof v.data === 'string') { const h = imgHash(v.data); IMG_POOL.set(h, v.data); return {kind: 'data', ref: h}; } return v; };
let SNAP_P = new Map();   // id → cadena del paper en la última copia
const SNAP_MARK = '"papers":"\\u0002P"';
function snapDb() {
  const P = new Map(), parts = db.papers.map(p => { let s = JSON.stringify(p, snapRep); const o = SNAP_P.get(p.id); if (o === s) s = o; P.set(p.id, s); return s; });
  SNAP_P = P; return {head: JSON.stringify({...db, papers: '\u0002P'}, snapRep), parts};
}
const snapEq = (a, b) => a === b || !!a && !!b && typeof a === 'object' && typeof b === 'object' && a.head === b.head && a.parts.length === b.parts.length && a.parts.every((s, i) => s === b.parts[i]);
const snapStr = s => typeof s === 'string' ? s : s.head.replace(SNAP_MARK, () => '"papers":[' + s.parts.join(',') + ']');
function unsnap(s) {   // copia → proyecto, con sus imágenes (y el historial del día de cada paper, que no va en las copias)
  const hist = new Map(db.papers.map(p => [p.id, p.history]));
  const d = JSON.parse(snapStr(s), (k, v) => k === 'image' && v && v.kind === 'data' && typeof v.ref === 'string' ? (IMG_POOL.has(v.ref) ? {kind: 'data', data: IMG_POOL.get(v.ref)} : null) : v);
  d.papers.forEach(p => { p.history = p.history || hist.get(p.id) || []; });
  return d;
}
let lastSnap = null, lastRecAt = 0;
function record() {   // antes de cada cambio guarda el estado anterior; los cambios seguidos (<1,5 s) forman un solo paso
  const cur = snapDb();
  if (lastSnap === null || snapEq(cur, lastSnap)) { lastSnap = cur; return; }
  if (!(Date.now() - lastRecAt < 1500 && UNDO.length)) { UNDO.push(lastSnap); if (UNDO.length > MAXU) UNDO.shift(); }
  lastRecAt = Date.now(); REDO.length = 0; lastSnap = cur;
}
function touch() { SNAP_SES = null; if (TAB.passive) return; hdr(); sessionSoon(); clearTimeout(timer); if (auto && handle) timer = setTimeout(() => save(false), 1000); if (!SY.applying && syAuto()) sySoon(); }   // con Google Drive conectado, el cambio se sube a los 3 s
function markDirty() { record(); dirty = true; touch(); SNAP_SES = lastSnap; }   // la copia de trabajo de dentro de 0,7 s puede usar esta misma copia
let SNAP_SES = null;   // copia ya hecha que coincide con el proyecto (la invalida cualquier touch() que no venga de markDirty)
function undo() { if (UNDO.length) { REDO.push(snapDb()); restore(UNDO.pop()); } }
function redo() { if (REDO.length) { UNDO.push(snapDb()); restore(REDO.pop()); } }
function restore(json) {
  db = unsnap(json); lastSnap = json; lastRecAt = 0; syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export);
  for (const id of [...SEL]) if (!db.papers.some(p => p.id === id)) SEL.delete(id);
  dirty = true; applySettings(); render(); if ($('#cfg').open) drawCfg(); touch();
}
window.onbeforeunload = e => dirty ? (e.preventDefault(), '') : undefined;
