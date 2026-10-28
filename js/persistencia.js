'use strict';
/* ===== Persistencia =====
   Chrome/Edge: File System Access API (elige un archivo una vez y se guarda/autoguarda sobre él).
   Otros navegadores: abrir con selector y guardar como descarga. */
const FSA = 'showSaveFilePicker' in window;
let handle = null;   // archivo elegido por el usuario
const JSON_T = [{description: 'Datos de papers (JSON)', accept: {'application/json': ['.json']}}];
const idb = (mode, fn) => new Promise((res, rej) => {   // IndexedDB: recuerda el último archivo entre sesiones
  const r = indexedDB.open('gestor-papers', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onerror = () => rej(r.error);
  r.onsuccess = () => { const t = r.result.transaction('k', mode), q = fn(t.objectStore('k')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }; });
const rememberHandle = () => idb('readwrite', st => { st.put(handle, 'h:' + PJ.cur); return st.put(handle, 'last'); }).catch(() => {});   // el archivo de cada proyecto
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
  const xo = d.settings.export; if (!['es', 'en'].includes(xo.lang)) xo.lang = 'es'; if (!['long', 'dmy', 'iso'].includes(xo.dateFmt)) xo.dateFmt = 'long'; xo.vanAll = !!xo.vanAll; xo.ppChap = !!xo.ppChap; xo.disamb = !!xo.disamb; xo.abbrList = xo.abbrList !== false; if (!['auto', 'dot', 'br', 'par'].includes(xo.numFmt)) xo.numFmt = 'auto';
  d.settings.showProgress = !!d.settings.showProgress; d.settings.citeOnlyMain = !!d.settings.citeOnlyMain; if (typeof d.settings.mainStyle !== 'string') d.settings.mainStyle = 'apa'; d.settings.pdfDrive = !!d.settings.pdfDrive; d.settings.fmtOpen = !!d.settings.fmtOpen; d.settings.view = d.settings.view === 'table' ? 'table' : 'cards';
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
async function loadText(text, name, quiet) {
  try { db = validate(JSON.parse(text)); path = name; dirty = false; F.tags.clear(); F.sec = ''; SEL.clear(); UNDO.length = 0; REDO.length = 0; lastSnap = snapDb(); fmtPinned = db.settings.fmtOpen; applySettings(); render(); sessionSoon(); return true; }
  catch (e) { if (!quiet) alert('Archivo no válido (se mantienen los datos actuales): ' + e.message); return false; }
}
async function doOpen() {   // cada archivo JSON se abre como proyecto (ver Proyectos)
  try {
    if (FSA) { const [h] = await showOpenFilePicker({types: JSON_T}); await pjOpenFile(await (await h.getFile()).text(), h.name, h); }
    else { const r = await pickFile(); if (r) await pjOpenFile(r.text, r.path, null); }
  } catch (e) { if (e.name !== 'AbortError') alert('No se pudo abrir el archivo: ' + e.message); }
}
async function pjReload() {   // vuelve a leer el archivo del proyecto (Chrome pide confirmar el acceso en cada sesión)
  ctxClose(); if (!handle) return;
  try { if (await handle.requestPermission({mode: 'readwrite'}) !== 'granted') return alert('Sin permiso para acceder al archivo.');
    await pjOpenFile(await (await handle.getFile()).text(), handle.name, handle);
  } catch (e) { alert('No se pudo leer el archivo: ' + e.message); }
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
  } catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
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
/* Copias para deshacer: las imágenes incrustadas van una sola vez en IMG_POOL y cada copia lleva solo su clave (sin imágenes, la copia es snapDb()) */
const IMG_POOL = new Map(), IMG_KEY = new Map();   // clave → data: URL · data: URL → clave
const snapDb = () => JSON.stringify(db, (k, v) => { if (k !== 'data' || typeof v !== 'string' || !v.startsWith('data:')) return v;
  let c = IMG_KEY.get(v); if (!c) { c = '\u0001img' + IMG_KEY.size; IMG_KEY.set(v, c); IMG_POOL.set(c, v); } return c; });
const unsnap = json => JSON.parse(json, (k, v) => k === 'data' && typeof v === 'string' && v.startsWith('\u0001img') ? IMG_POOL.get(v) ?? v : v);
let lastSnap = null, lastRecAt = 0;
function record() {   // antes de cada cambio guarda el estado anterior; los cambios seguidos (<1,5 s) forman un solo paso
  const cur = snapDb();
  if (lastSnap === null || cur === lastSnap) { lastSnap = cur; return; }
  if (!(Date.now() - lastRecAt < 1500 && UNDO.length)) { UNDO.push(lastSnap); if (UNDO.length > MAXU) UNDO.shift(); }
  lastRecAt = Date.now(); REDO.length = 0; lastSnap = cur;
}
function touch() { hdr(); sessionSoon(); clearTimeout(timer); if (auto && handle) timer = setTimeout(() => save(false), 1000); if (!SY.applying && syAuto()) sySoon(); }   // con Google Drive conectado, el cambio se sube a los 3 s
function markDirty() { record(); dirty = true; touch(); }
function undo() { if (UNDO.length) { REDO.push(snapDb()); restore(UNDO.pop()); } }
function redo() { if (REDO.length) { UNDO.push(snapDb()); restore(REDO.pop()); } }
function restore(json) {
  db = unsnap(json); lastSnap = json; lastRecAt = 0; syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export);
  for (const id of [...SEL]) if (!db.papers.some(p => p.id === id)) SEL.delete(id);
  dirty = true; applySettings(); render(); if ($('#cfg').open) drawCfg(); touch();
}
window.onbeforeunload = e => dirty ? (e.preventDefault(), '') : undefined;
