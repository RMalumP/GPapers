'use strict';
/* ===== Sincronización con Google Drive =====
   Copia de la biblioteca en la carpeta oculta «appDataFolder» del propio Google Drive de cada persona (permiso drive.appdata:
   la aplicación no ve el resto del Drive y no hay ningún servidor intermedio). Fusión a tres bandas: cada lado se compara con la
   última versión sincronizada («base», en IndexedDB), así las altas, ediciones y borrados de cada dispositivo llegan al otro sin
   añadir marcas al JSON. Si los dos cambian el mismo campo de un paper gana el modificado más tarde (sin fecha, este dispositivo);
   un cambio gana a un borrado.
   En Drive: una copia completa (gpapers-snap.json), un archivo pequeño por cada autoguardado con solo lo que cambió
   (gpapers-d-<hora>-<dispositivo>.json, campo a campo) y cada imagen incrustada aparte, una sola vez (gpapers-img-<huella>).
   Cuando se acumulan cambios, la copia completa se reescribe y se borran los que ya incluye. Lo ya descargado se guarda en
   IndexedDB, así cada vuelta solo pide la lista de archivos y los nuevos. Lo grande se sube por partes (subida reanudable).
   Proyectos: cada uno tiene sus archivos (el primero, «main», los de siempre; los demás, gpapers-p-<id>-…) y un índice común
   (gpapers-projects.json) lleva la lista de proyectos y los ajustes comunes, que se combinan igual. Cada vuelta sincroniza el
   índice y el proyecto abierto; los demás se descargan al abrirlos. */
const SY_CFG = {clientId: '143923429984-45e8m3bmn1315r9ceet2sb19iuq4f9qj.apps.googleusercontent.com',   // ID de cliente OAuth del proyecto «Gestor de papers» (público, no es un secreto); vacío = sin sincronización
  file: 'gpapers-snap.json', legacy: 'gpapers-sync.json', big: 4 * 1024 * 1024, maxDeltas: 25, pdfMax: 100 * 1048576};   // big: a partir de aquí, subida reanudable · maxDeltas: cambios sueltos antes de rehacer la copia completa
const SY_LOCALSET = ['view', 'tblCols'];   // ajustes propios de cada dispositivo: no se sincronizan
const SY_IDX = 'gpapers-projects.json';   // índice: lista de proyectos y ajustes comunes
const syNames = id => id === 'main' ? {snap: SY_CFG.file, legacy: SY_CFG.legacy, d: 'gpapers-d-', img: 'gpapers-img-', pdf: 'gpapers-pdf-', key: ''}   // el primer proyecto conserva los nombres de antes (las versiones anteriores lo siguen viendo)
  : {snap: `gpapers-p-${id}-snap.json`, legacy: null, d: `gpapers-p-${id}-d-`, img: `gpapers-p-${id}-img-`, pdf: `gpapers-p-${id}-pdf-`, key: ':' + id};
const syPjOf = n => /^gpapers-p-([a-z0-9]+)-/.exec(n)?.[1] || (n !== SY_IDX ? 'main' : null);   // proyecto de un archivo de Drive
const syS = v => JSON.stringify(v);
const syNoHist = (k, v) => k === 'history' ? undefined : v, syPlainS = d => JSON.stringify(d, syNoHist);   // syPlainS(d) === syS(syPlain(d)), sin el paso de ida y vuelta
const syPlain = d => JSON.parse(syPlainS(d));   // como en el JSON: sin el historial del día
function syNormRaw(d) {   // pasa por validate() para comparar siempre la misma forma; validate() ajusta los tipos y estilos globales, así que se devuelven a los de db
  try { return syPlainS(validate(structuredClone(d))); } finally { syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export); }
}
/* Normalizar es lo más caro de cada vuelta (clonar + validate + JSON: ~300 ms con 2000 papers en un móvil) y casi siempre se repite con lo mismo
   (la copia local, la de Drive y la fusionada suelen coincidir). SY_NM recuerda el resultado por la huella del JSON de entrada: huella → JSON normalizado.
   Un resultado normalizado se normaliza en sí mismo, así que también se guarda con su propia huella. Se devuelve texto: quien lo use lo lee con JSON.parse (una copia nueva). */
const SY_NM = new Map(), SY_NM_MAX = 6;
function syNormS(d, s = syS(d)) {
  const k = syHash(s); let o = SY_NM.get(k);
  if (o === undefined) { o = syNormRaw(d); SY_NM.set(k, o); SY_NM.set(syHash(o), o); while (SY_NM.size > SY_NM_MAX) SY_NM.delete(SY_NM.keys().next().value); }
  else { SY_NM.delete(k); SY_NM.set(k, o); }   // el más usado, al final (se borran primero los más antiguos)
  return o;
}
const syNorm = d => JSON.parse(syNormS(d));
function syVal(x, y, z, hasB, mine) {   // un valor: si solo cambió un lado gana ese; si cambiaron los dos, «mine» decide (true = este dispositivo)
  if (syS(x) === syS(y)) return x;
  if (hasB && syS(x) === syS(z)) return y;
  if (hasB && syS(y) === syS(z)) return x;
  return mine ? x : y;
}
function syObj(x, y, z, mine, sub = {}) {   // objeto campo a campo; sub[k] fusiona ese campo a su manera
  x ||= {}; y ||= {}; const o = {}, hasB = !!z; z ||= {};
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const v = sub[k] ? sub[k](x[k], y[k], z[k], hasB) : syVal(x[k], y[k], z[k], hasB, mine);
    if (v !== undefined) o[k] = v;
  }
  return o;
}
function syList(x, y, z, pick, key = e => e.id) {   // lista de objetos con id: altas, bajas y cambios de cada lado (z = null: sin base, se unen)
  x ||= []; y ||= []; const m = a => new Map(a.map(e => [key(e), e])), X = m(x), Y = m(y), Z = z ? m(z) : null, o = [], ids = a => a.map(key).join('\n');
  const order = z && ids(x) === ids(z) && ids(y) !== ids(z) ? [...Y.keys(), ...X.keys()] : [...X.keys(), ...Y.keys()];   // si solo el otro lado reordenó, se respeta su orden
  for (const k of new Set(order)) {
    const a = X.get(k), b = Y.get(k), c = Z && Z.get(k);
    if (a && b) o.push(syS(a) === syS(b) ? a : c && syS(a) === syS(c) ? b : c && syS(b) === syS(c) ? a : pick(a, b, c));
    else if (!(c && syS(a || b) === syS(c))) o.push(a || b);   // nuevo en un lado, o borrado en el otro tras cambiarlo aquí: se queda
  }
  return o;
}
const syWhen = p => p.modified || p.created || '';
const syGen = (a, b, c) => syObj(a, b, c, true);
const syTS = (a, b, c) => syObj(a, b, c, true, {rk: (x, y, z, h) => { const r = syObj(x, y, h ? z || {} : null, true); return Object.keys(r).length ? r : undefined; }});   // etiquetas y secciones: los valores de cada clasificación, uno a uno
const syLst = (pick, key) => (x, y, z, h) => syList(x, y, h ? z || [] : null, pick, key);
const syAnn = syLst((a, b, c) => syObj(a, b, c, (a.up || '') >= (b.up || '')));   // subrayados y comentarios: uno a uno; si los dos cambian el mismo, gana el cambiado más tarde
const syPdf = mine => (x, y, z, h) => x && y && typeof x === 'object' && typeof y === 'object' && x.name === y.name ? syObj(x, y, h && z && z.name === x.name ? z : null, mine, {ann: syAnn}) : syVal(x, y, z, h, mine);   // el mismo PDF: campo a campo
function syPaper(a, b, c) { const mine = syWhen(a) >= syWhen(b); return syObj(a, b, c, mine, {notes: syLst((p, q, r) => syObj(p, q, r, mine)), pdf: syPdf(mine), pdf2: syPdf(mine)}); }
const syInbox = (a, b, c) => syObj(a, b, c, (a.up || '') >= (b.up || ''), {ann: syAnn});
function sySettings(x, y, z) {
  const o = syObj(x, y, z, true, {customTypes: syLst(syGen), customStyles: syLst(syGen), templates: syLst(syGen),
    export: (a, b, c, h) => syObj(a, b, h ? c : null, true), shortcuts: (a, b, c, h) => syObj(a, b, h ? c : null, true)});
  for (const k of SY_LOCALSET) if (x && k in x) o[k] = x[k]; else delete o[k];
  return o;
}
function syMerge(L, R, B) {   // L = este dispositivo, R = Google Drive, B = última versión sincronizada (null la primera vez: se unen)
  const o = syObj(L, R, B, true, {sections: syLst(syTS), tags: syLst(syTS), orders: syLst(syGen), papers: syLst(syPaper), trash: syLst(syGen, t => t.paper.id), inbox: syLst(syInbox),
    settings: (x, y, z, h) => sySettings(x || {}, y || {}, h ? z || {} : null)});
  o.papers ||= []; o.trash ||= []; o.inbox ||= []; o.tags ||= []; o.sections ||= [];
  const live = new Map(o.papers.map(p => [p.id, p]));   // en la lista y en la papelera a la vez (un lado lo borró y el otro lo editó): gana lo último
  o.trash = o.trash.filter(t => { const p = live.get(t.paper.id); if (!p) return true; if (t.at > syWhen(p)) { o.papers.splice(o.papers.indexOf(p), 1); return true; } return false; });
  const T = new Set(o.tags.map(t => t.id)), S = new Set(o.sections.map(s => s.id));   // sin referencias a etiquetas o secciones borradas en el otro lado
  o.papers.forEach(p => { p.tagIds = (p.tagIds || []).filter(i => T.has(i)); p.sectionIds = (p.sectionIds || []).filter(i => S.has(i)); p.notes = (p.notes || []).filter(n => !n.sectionId || S.has(n.sectionId)); });
  o.sections.forEach(s => s.tagIds = (s.tagIds || []).filter(i => T.has(i)));
  return o;
}
/* ---- Solo lo que cambió: parches campo a campo ---- */
const SY_KEY = {papers: e => e.id, ann: e => e.id, inbox: e => e.id, tags: e => e.id, sections: e => e.id, orders: e => e.id, notes: e => e.id, customTypes: e => e.id, customStyles: e => e.id, templates: e => e.id, trash: t => t.paper && t.paper.id};   // listas que se comparan elemento a elemento
const syIsObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function syDiff(a, b, f) {   // parche de a → b: {$: valor} sustituye · {o: {campo: parche}} objeto · {l: {id: parche}, ord: [ids]} lista por id · {x: 1} borra
  if (syS(a) === syS(b)) return undefined;
  const key = SY_KEY[f], ok = l => { const ks = l.map(e => e && key(e)); return ks.every(k => typeof k === 'string' && k) && new Set(ks).size === ks.length; };
  if (key && Array.isArray(a) && Array.isArray(b) && ok(a) && ok(b)) {
    const A = new Map(a.map(e => [key(e), e])), B = new Set(b.map(key)), l = {};
    for (const e of b) { const k = key(e), d = A.has(k) ? syDiff(A.get(k), e) : {$: e}; if (d) l[k] = d; }
    for (const k of A.keys()) if (!B.has(k)) l[k] = {x: 1};
    const r = {l}, now = b.map(key); if ([...a.map(key).filter(k => B.has(k)), ...now.filter(k => !A.has(k))].join('\n') !== now.join('\n')) r.ord = now;   // solo si no basta con añadir al final
    return Object.keys(l).length || r.ord ? r : undefined;
  }
  if (syIsObj(a) && syIsObj(b)) {
    const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = !(k in b) ? {x: 1} : syDiff(a[k], b[k], k); if (d) o[k] = d; }
    return Object.keys(o).length ? {o} : undefined;   // solo cambió el orden de los campos
  }
  return {$: b};
}
function syPatch(a, p, f) {   // aplica un parche sin tocar a
  if ('$' in p) return structuredClone(p.$);
  if (p.l) {
    const key = SY_KEY[f], M = new Map((Array.isArray(a) ? a : []).filter(e => e && key(e)).map(e => [key(e), e])), order = [...M.keys()];
    for (const [k, d] of Object.entries(p.l)) {
      if (d.x) M.delete(k);
      else if (M.has(k)) M.set(k, syPatch(M.get(k), d));
      else if ('$' in d) { M.set(k, structuredClone(d.$)); order.push(k); }   // el cambio de algo que otro dispositivo acaba de borrar se descarta
    }
    return [...new Set([...(p.ord || []), ...order])].filter(k => M.has(k)).map(k => M.get(k));
  }
  if (p.o) { const o = syIsObj(a) ? {...a} : {}; for (const [k, d] of Object.entries(p.o)) { if (d.x) delete o[k]; else o[k] = syPatch(o[k], d, k); } return o; }
  return a;
}
/* ---- PDF enlazados: copia opcional en la carpeta oculta (Configuración → «Subir a mi Google Drive los PDF enlazados») ----
   Un archivo por PDF enlazado (gpapers-pdf-<id>, y gpapers-pdf-<id>~2 para el segundo), subido tal cual (subida reanudable). Solo se sube lo que este dispositivo puede leer sin
   preguntar; cualquier dispositivo con la sesión iniciada puede abrir el PDF desde Drive. Los de PDF que ya no están enlazados se borran pasado un día. */
async function syUploadFile(tok, id, name, file) {   // siempre reanudable: el archivo va tal cual, sin pasarlo a texto
  const F = '&fields=id,md5Checksum,modifiedTime,size', r = await syDrive(tok, `/upload/drive/v3/files${id ? '/' + id : ''}?uploadType=resumable${F}`, {method: id ? 'PATCH' : 'POST',
    headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/pdf'}, body: JSON.stringify(id ? {} : {name, parents: ['appDataFolder']})});
  const loc = r.headers.get('Location'); if (!loc) throw Error('reanudable');
  const u = await fetch(loc, {method: 'PUT', headers: {'Content-Type': 'application/pdf'}, body: file, cache: 'no-store'});
  if (!u.ok) { const e = Error('drive ' + u.status); e.estado = u.status; throw e; }
  return u.json();
}
async function pdfLocal(id) {   // id: clave del hueco (pdfKey). El PDF si este dispositivo puede leerlo ahora sin preguntar
  try {
    if (PDF_FILES.has(id)) return PDF_FILES.get(id);
    const h = FSA && (PEND_PDF.get(id) || await idb('readonly', st => st.get('pdf:' + id)).catch(() => null));
    if (h && await h.queryPermission({mode: 'read'}) === 'granted') return await h.getFile();
    return await pdfKept(id);   // la copia guardada en este navegador (móvil, o descargada de Drive)
  } catch (e) { return null; }
}
async function syPdfs(tok, files, m, N, pj = PJ.cur) {
  try {
    const have = new Map(files.filter(f => f.name.startsWith(N.pdf)).map(f => [f.name.slice(N.pdf.length), f])), old = Date.now() - 864e5;
    if (m.settings.pdfDrive) for (const {key} of pdfSlots(m, false)) {
      const file = await pdfLocal(key); if (!file || file.size > SY_CFG.pdfMax) continue;
      if (PJ.cur !== pj) return;   // cambiaste de proyecto: sigue la próxima vez
      const f = have.get(key), k = `pdfUp:${pj}:${key}`, sig = `${file.size}:${file.lastModified}`, rec = await idb('readonly', st => st.get(k)).catch(() => null);
      if (f && (rec === sig || !rec && +f.size === file.size)) { if (rec !== sig) idb('readwrite', st => st.put(sig, k)).catch(() => {}); continue; }   // ya está en Drive
      await syUploadFile(tok, f && f.id, N.pdf + key, file); await idb('readwrite', st => st.put(sig, k)).catch(() => {});
    }
    const used = new Set(pdfSlots(m, true).flatMap(({key, pf}) => pf.from ? [key, pf.from] : [key]));
    for (const [id, f] of have) if (!used.has(id) && Date.parse(f.modifiedTime) < old) await syDel(tok, f.id);   // el paper ya no tiene PDF
  } catch (e) { if (e.estado === 401) throw e; if (!SY.pdfWarned) { SY.pdfWarned = true; toast(e.estado === 403 ? 'No se pudo subir un PDF: puede que tu Google Drive esté lleno.' : 'No se pudo subir un PDF a Google Drive; se reintentará.', [], 6000); } }
}
const pdfSlots = (m, trash) => [...(trash ? syPapersOf(m) : m.papers || []).flatMap(p => pdfsOf(p).map(n => ({key: pdfKey(p.id, n), pf: p[pdfF(n)], p, n}))),
  ...(m.inbox || []).map(it => ({key: inKey(it.id), pf: it, it}))];   // todos los PDF del proyecto: de los papers (y de la papelera) y de la bandeja
async function pdfFromDrive(id, name, quiet) {   // id: clave del hueco (pdfKey). El PDF subido por otro dispositivo (solo con acceso vigente: no se abre ninguna ventana de Google)
  const tok = syOn() && syTokGet(); if (!tok) return null;
  try { const nm = syNames(PJ.cur).pdf + id, f = (await syLs(tok, `name = '${nm}'`)).find(x => x.name === nm); if (!f) return null; if (!quiet) toast('Descargando el PDF de tu Google Drive…', [], 3000);
    return new File([await (await syDrive(tok, `/drive/v3/files/${f.id}?alt=media`)).blob()], name, {type: 'application/pdf'}); } catch (e) { return null; }
}
function setPdfDrive(on) { setCfg('pdfDrive', on); if (on && syAuto()) sySoon(500); }
/* ---- Imágenes incrustadas aparte: en la biblioteca de Drive solo queda su huella ---- */
const syHash = s => {   // huella de 64 bits + longitud (cyrb53 doble): la misma imagen da siempre el mismo nombre de archivo
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + s.length.toString(16);
};
const syPapersOf = d => [...(d.papers || []), ...(d.trash || []).map(t => t && t.paper)].filter(Boolean);
function syWire(d) {   // copia para Drive: {kind: 'data', data} → {kind: 'data', ref: huella}; devuelve también las huellas usadas
  const w = structuredClone(d), refs = new Set();
  for (const p of syPapersOf(w)) if (p.image && p.image.kind === 'data' && p.image.data) { const h = imgHash(p.image.data); SY.img.set(h, p.image.data); p.image = {kind: 'data', ref: h}; refs.add(h); }
  return [w, refs];
}
async function syPool(items, fn, n = 6) {   // fn sobre cada elemento, hasta n a la vez
  let i = 0; const work = async () => { while (i < items.length) { const x = items[i++]; await fn(x); } };
  await Promise.all(Array.from({length: Math.min(n, items.length)}, work));
}
let SY_PDF = Promise.resolve();   // los PDF de cada vuelta, en cola y en segundo plano
function syPdfJob(j) {
  const run = SY_PDF.then(async () => { if (PJ.cur !== j.id || !syOn()) return;
    try { await syPdfs(j.tok, j.files, j.m, j.N, j.id); await syPdfsVis(j.tok, j.m, j.id); } catch (e) { if (e.estado === 401) syTokDel(); } });
  SY_PDF = run.catch(() => {}); return run;
}
async function syUnwire(tok, w, files, N) {   // vuelve a poner las imágenes; solo descarga las que este dispositivo no tiene
  const d = structuredClone(w), P = syPapersOf(d).filter(p => p.image && p.image.kind === 'data' && p.image.ref);
  for (const r of new Set(P.map(p => p.image.ref))) if (!SY.img.has(r) && IMG_POOL.has(r)) SY.img.set(r, IMG_POOL.get(r));   // ya están en este dispositivo: no se descargan
  const miss = [...new Set(P.map(p => p.image.ref))].filter(r => !SY.img.has(r));
  if (miss.length) await idb('readonly', st => { miss.forEach(h => { const q = st.get('imgd:' + h); q.onsuccess = () => { if (typeof q.result === 'string') SY.img.set(h, q.result); }; }); return null; }).catch(() => {});
  await syPool(miss.filter(r => !SY.img.has(r)), async r => { const f = files.find(x => x.name === N.img + r); if (f) try { SY.img.set(r, await (await syDrive(tok, `/drive/v3/files/${f.id}?alt=media`)).text()); } catch (e) {} });
  for (const p of P) { const r = p.image.ref; p.image = SY.img.has(r) ? {kind: 'data', data: SY.img.get(r)} : null; }
  return d;
}

/* ---- Google: acceso y Drive ---- */
const SY = {st: 'idle', busy: false, again: false, wait: false, tm: 0, exp: 0, gest: false, applying: false, img: new Map()};   // img: huella → imagen
const syP = () => { try { return JSON.parse(localStorage.getItem('gp-sync')) || {}; } catch (e) { return {}; } };   // sesión recordada: {on, auto, who, last, dev}
const sySet = o => { try { localStorage.setItem('gp-sync', JSON.stringify({...syP(), ...o})); } catch (e) {} };
const syOn = () => !!syP().on;
const syAvail = () => !!SY_CFG.clientId && /^https?:$/.test(location.protocol);   // Google no admite file://
/* El acceso de Google dura 1 hora y, sin servidor propio, solo se renueva abriendo su ventana, que el navegador bloquea si no la
   provoca un clic o una tecla. Por eso (como en Supuestos C1): el acceso se comparte entre pestañas y al reabrir la aplicación
   (localStorage, hasta que caduca), al caducar se intenta renovar una vez sin ventana y, si no se puede, se renueva con el
   siguiente clic o tecla en cualquier parte. Mientras tanto los cambios esperan en el dispositivo. */
const SY_TOK = 'gp-sync-token', SY_TRY = 'gp-sync-try';   // acceso temporal (1 hora) · cuándo se intentó renovar por última vez (entre pestañas)
const syTokGet = () => { try { const t = JSON.parse(localStorage.getItem(SY_TOK)); if (t && t.t && t.exp > Date.now() && t.c === SY_CFG.clientId) return t.t; } catch (e) {} return null; };   // un acceso de otro ID de cliente no vale (abre otra carpeta oculta)
const syTokPut = (t, s) => { const exp = Date.now() + Math.max(60, (s || 3600) - 60) * 1000; try { localStorage.setItem(SY_TOK, JSON.stringify({t, exp, c: SY_CFG.clientId})); } catch (e) {} syTokWatch(exp); };
const syTokDel = () => { try { localStorage.removeItem(SY_TOK); } catch (e) {} };
const syTried = () => { try { return +localStorage.getItem(SY_TRY) || 0; } catch (e) { return 0; } };
const syTry = () => { try { localStorage.setItem(SY_TRY, String(Date.now())); } catch (e) {} };
function syTokWatch(exp) {   // al caducar el acceso se intenta renovar enseguida, sin esperar al siguiente cambio
  clearTimeout(SY.exp); SY.exp = setTimeout(() => { if (syAuto() && !syTokGet()) syRun(false); }, Math.max(1000, exp - Date.now() + 500));
}
function syGesture() {   // sin acceso: el siguiente clic o tecla (en cualquier parte) permite abrir un instante la ventana de Google y reconectar
  if (SY.gest) return; SY.gest = true;
  syGis().catch(() => {});   // la librería de Google, ya cargada: si no, la ventana se abriría tarde y el navegador la bloquearía
  // el navegador solo deja abrir ventanas desde ciertos eventos: al pulsar con el ratón, pero en una pantalla táctil al levantar el dedo
  // (pointerdown de un toque no cuenta: por eso en el móvil casi nunca funcionaba); un deslizamiento termina en pointercancel y no cuenta
  const EV = ['pointerdown', 'pointerup', 'keydown'];
  const off = () => { SY.gest = false; EV.forEach(t => document.removeEventListener(t, h, true)); };
  const h = e => { if (e.type === 'pointerdown' ? e.pointerType !== 'mouse' : e.type === 'pointerup' && e.pointerType === 'mouse') return;
    if (e.type === 'keydown' && ['Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;   // teclas que no dan permiso para abrir ventanas
    if (!syOn() || SY.consent || !['reconnect', 'error'].includes(SY.st)) return off(); if (SY.busy) return; off(); syRun(false, true); };
  EV.forEach(t => document.addEventListener(t, h, true));
}
const syGis = () => window.google?.accounts?.oauth2 ? Promise.resolve() : new Promise((ok, ko) => {
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = () => ko(Error('red')); document.head.appendChild(s); });
const syScopes = file => 'https://www.googleapis.com/auth/drive.appdata' + (file || syP().fileScope ? ' https://www.googleapis.com/auth/drive.file' : '');   // drive.file solo si se activó la copia en el Drive normal (js/bandeja.js)
function syToken(inter) {   // inter = false: renueva el acceso sin ventana (solo si ya se dio el permiso y sigue abierta la sesión de Google)
  const t = syTokGet(); if (t) return Promise.resolve(t);
  if (SY.tokP) return SY.tokP;   // ya se está pidiendo (p. ej. desde el clic que reconecta): no se abre otra ventana
  const p = SY.tokP = syTokAsk(inter); p.finally(() => { if (SY.tokP === p) SY.tokP = null; }).catch(() => {}); return p;
}
function syTokAsk(inter) {
  return syGis().then(() => new Promise((ok, ko) => {
    const lim = inter ? 0 : setTimeout(() => ko(Error('silencio')), 15000), fin = () => clearTimeout(lim);
    google.accounts.oauth2.initTokenClient({client_id: SY_CFG.clientId, scope: syScopes(), ...(syP().who ? {hint: syP().who} : {}),   // con varias cuentas de Google abiertas, sin la pista no sabe cuál usar y pide elegir
      callback: r => { fin(); if (r && r.access_token) { syTokPut(r.access_token, +r.expires_in); ok(r.access_token); } else ko(Error(r && r.error || 'denegado')); },
      error_callback: e => { fin(); ko(Error(e && e.type || 'cerrada')); }}).requestAccessToken({prompt: inter ? '' : 'none'});
  }));
}
async function syDrive(tok, ruta, o = {}) {
  const r = await fetch('https://www.googleapis.com' + ruta, {...o, cache: 'no-store', headers: {Authorization: 'Bearer ' + tok, ...o.headers}});
  if (!r.ok) { const e = Error('drive ' + r.status); e.estado = r.status; throw e; }
  return r;
}
async function syLs(tok, q = "name contains 'gpapers-'") {   // archivos de esta aplicación en la carpeta oculta (que comparte con otras webs del mismo proyecto de Google); q: solo esos
  const out = []; let pt = '';
  do {
    const j = await (await syDrive(tok, '/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,size,md5Checksum,modifiedTime)&q=' + encodeURIComponent(q) + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''))).json();
    out.push(...(j.files || []).filter(f => f.name.startsWith('gpapers-'))); pt = j.nextPageToken;
  } while (pt);
  return out;
}
const syLsFor = (tok, N) => syLs(tok, [SY_IDX, N.snap, N.legacy].filter(Boolean).map(n => `name = '${n}'`).concat([N.d, N.img, N.pdf].map(n => `name contains '${n}'`)).join(' or '))   // solo lo de este proyecto (y el índice): menos que listar
  .then(L => L.filter(f => f.name === SY_IDX || f.name === N.snap || f.name === N.legacy || [N.d, N.img, N.pdf].some(x => f.name.startsWith(x))));
const syGcDue = () => { try { return Date.now() - (+localStorage.getItem('gp-sy-gc') || 0) > 864e5; } catch (e) { return true; } };   // la limpieza de proyectos borrados, una vez al día
const syGcDone = () => { try { localStorage.setItem('gp-sy-gc', String(Date.now())); } catch (e) {} };
const syVer = f => f.md5Checksum || `${f.modifiedTime}:${f.size}`;
const syGet = async (tok, id) => (await syDrive(tok, `/drive/v3/files/${id}?alt=media`)).json();
const syDel = (tok, id) => syDrive(tok, '/drive/v3/files/' + id, {method: 'DELETE'}).catch(() => {});
async function syUpload(tok, id, name, body, type) {   // id: sustituye ese archivo; sin id, lo crea. Devuelve {id, md5Checksum, modifiedTime, size}
  const F = '&fields=id,md5Checksum,modifiedTime,size', meta = JSON.stringify(id ? {} : {name, parents: ['appDataFolder']});
  if (new Blob([body]).size > SY_CFG.big) {   // grande: subida reanudable, sin el límite de 5 MB de las otras (se pide la dirección de subida y se envía ahí)
    const r = await syDrive(tok, `/upload/drive/v3/files${id ? '/' + id : ''}?uploadType=resumable${F}`, {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type}, body: meta});
    const loc = r.headers.get('Location'); if (!loc) throw Error('reanudable');
    const u = await fetch(loc, {method: 'PUT', headers: {'Content-Type': type}, body, cache: 'no-store'});
    if (!u.ok) { const e = Error('drive ' + u.status); e.estado = u.status; throw e; }
    return u.json();
  }
  if (id) return (await syDrive(tok, `/upload/drive/v3/files/${id}?uploadType=media${F}`, {method: 'PATCH', headers: {'Content-Type': type}, body})).json();
  const b = 'gpapers' + Date.now();
  return (await syDrive(tok, `/upload/drive/v3/files?uploadType=multipart${F}`, {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b},
    body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n${body}\r\n--${b}--`})).json();
}
const syCache = async N => { const c = await idb('readonly', st => st.get('syncCache' + N.key)).catch(() => null); return c && c.v === 2 ? c : {v: 2, snap: null, deltas: {}}; };   // lo ya descargado de Drive (de cada proyecto)
const syCacheSet = (N, c) => idb('readwrite', st => st.put(c, 'syncCache' + N.key)).catch(() => {});
const syForget = async () => { const ks = await idb('readonly', st => st.getAllKeys()).catch(() => []);   // al cerrar sesión: bases y copias descargadas de todos los proyectos
  await idb('readwrite', st => { ks.filter(k => typeof k === 'string' && k.startsWith('sync')).forEach(k => st.delete(k)); return st.count(); }).catch(() => {}); };
const syEmpty = () => ({version: 1, sections: [], tags: [], papers: [], trash: [], settings: {}});
const syOk = j => j && j.app === 'gpapers';
async function syRemote(tok, files, N) {   // el proyecto en Drive (con huellas en lugar de imágenes): copia completa + los cambios posteriores, por orden
  const c = await syCache(N), sf = files.find(f => f.name === N.snap), lf = !sf && N.legacy && files.find(f => f.name === N.legacy) || null;
  let w = null, inc = [];
  if (sf) {
    if (!c.snap || c.snap.ver !== syVer(sf)) { const j = await syGet(tok, sf.id); if (!syOk(j) || !j.db) throw Error('formato'); c.snap = {ver: syVer(sf), inc: j.inc || [], db: j.db}; }
    w = structuredClone(c.snap.db); inc = c.snap.inc;
  } else {
    c.snap = null;
    if (lf) { const j = await syGet(tok, lf.id); if (!syOk(j) || !j.db) throw Error('formato'); w = syWire(j.db)[0]; }   // copia de un solo archivo (versión anterior)
  }
  const all = files.filter(f => f.name.startsWith(N.d)).sort((a, b) => a.name < b.name ? -1 : 1), ds = all.filter(f => !inc.includes(f.name));
  for (const k of Object.keys(c.deltas)) if (!all.some(f => f.name === k)) delete c.deltas[k];
  await syPool(ds.filter(f => !c.deltas[f.name]), async f => { const j = await syGet(tok, f.id); if (syOk(j) && j.patch) c.deltas[f.name] = j.patch; });   // se descargan a la vez (hasta 6)
  for (const f of ds) if (c.deltas[f.name]) w = syPatch(w || syEmpty(), c.deltas[f.name]);   // y se aplican en orden
  await syCacheSet(N, c);
  return {w, c, sf, lf, all, files, n: ds.length, N};
}
async function syCompact(tok, R, mw, refs) {   // reescribe la copia completa y borra lo que ya incluye: los cambios sueltos, la copia antigua y las imágenes que nadie usa
  const inc = R.all.map(f => f.name), f = await syUpload(tok, R.sf && R.sf.id, R.N.snap, JSON.stringify({app: 'gpapers', v: 2, at: new Date().toISOString(), inc, db: mw}), 'application/json');
  R.c.snap = {ver: syVer(f), inc, db: mw}; R.c.deltas = {}; await syCacheSet(R.N, R.c);
  const old = Date.now() - 864e5;   // una imagen que otro dispositivo acaba de subir aún no está en esta copia: solo se borran las de más de un día
  for (const x of [...R.all, ...(R.lf ? [R.lf] : []), ...R.files.filter(x => x.name.startsWith(R.N.img) && !refs.has(x.name.slice(R.N.img.length)) && Date.parse(x.modifiedTime) < old)]) await syDel(tok, x.id);
}
const syDev = () => { let d = syP().dev; if (!d) { d = Math.random().toString(36).slice(2, 8); sySet({dev: d}); } return d; };
const syWho = async tok => { try { return (await (await syDrive(tok, '/drive/v3/about?fields=user(emailAddress)')).json()).user?.emailAddress || ''; } catch (e) { return ''; } };
const syBase = N => idb('readonly', st => st.get('syncBase' + N.key)).catch(() => null);
const syBaseSet = (N, d) => idb('readwrite', st => d ? st.put(d, 'syncBase' + N.key) : st.delete('syncBase' + N.key)).catch(() => {});
/* ---- Índice: proyectos y ajustes comunes ---- */
const syShared = s => { const o = structuredClone(s || {}); SY_LOCALSET.forEach(k => delete o[k]); return o; };
const syOwn = s => Object.fromEntries(SY_LOCALSET.filter(k => s && k in s).map(k => [k, s[k]]));
const pjEntry = p => ({id: p.id, name: p.name, created: p.created || ''});
const syIdxLocal = s => ({projects: PJ.list.map(pjEntry), settings: syShared(s)});
function syIdxMerge(L, R, B) {   // sin base (primera vez en este dispositivo) manda Drive en nombres y ajustes; las listas se unen
  const pick = (a, b, c) => c ? syObj(a, b, c, true) : syObj(b, a, null, true);
  return {projects: syList(L.projects, R.projects || [], B ? B.projects : null, pick),
    settings: syShared(B ? sySettings(L.settings, R.settings || {}, B.settings || {}) : sySettings(R.settings || {}, L.settings, null))};
}
async function syIdxGet(tok, files) {
  const f = files.find(x => x.name === SY_IDX); if (!f) return {f: null, w: null};
  const c = await idb('readonly', st => st.get('syncIdx')).catch(() => null); if (c && c.ver === syVer(f)) return {f, w: c.w};
  const j = await syGet(tok, f.id); if (!syOk(j) || !j.idx || !Array.isArray(j.idx.projects)) throw Error('formato');
  const w = {projects: j.idx.projects.filter(p => p && typeof p.id === 'string' && /^[a-z0-9]+$/.test(p.id) && typeof p.name === 'string'), settings: j.idx.settings || {}};
  await idb('readwrite', st => st.put({ver: syVer(f), w}, 'syncIdx')).catch(() => {}); return {f, w};
}
async function syIdxPut(tok, f, w) {
  const r = await syUpload(tok, f && f.id, SY_IDX, JSON.stringify({app: 'gpapers', v: 2, at: new Date().toISOString(), idx: w}), 'application/json');
  await idb('readwrite', st => st.put({ver: syVer(r), w}, 'syncIdx')).catch(() => {});
}
function syIdxApply(M) {   // la lista que llega de Drive: proyectos nuevos de otros dispositivos (☁, se descargan al abrirlos), nombres y bajas
  const old = new Map(PJ.list.map(p => [p.id, p])), ids = new Set(M.projects.map(p => p.id));
  for (const p of PJ.list) if (!ids.has(p.id) && p.id !== PJ.cur) pjDrop(p.id);
  PJ.list = M.projects.map(e => old.has(e.id) ? Object.assign(old.get(e.id), {name: e.name, created: e.created}) : {...e, remote: true});
  if (!ids.has(PJ.cur) && old.has(PJ.cur)) PJ.list.push(old.get(PJ.cur));
  pjSave(); pjShow();
}
async function syGc(tok, files, idx) {   // archivos de proyectos borrados: los borrados aquí, enseguida; los que no están en el índice, pasado un día (por si acaban de crearse)
  const ids = idx && new Set(idx.projects.map(p => p.id)), old = Date.now() - 864e5;
  await syPool(files.filter(f => { const k = syPjOf(f.name); return k && (PJ.gone.includes(k) && !PJ.list.some(p => p.id === k) || ids && k !== 'main' && !ids.has(k) && Date.parse(f.modifiedTime) < old); }), f => syDel(tok, f.id));
  if (PJ.gone.length) { PJ.gone = []; pjSave(); }
}

/* ---- Una vuelta de sincronización ---- */
const syBlocked = () => [...document.querySelectorAll('dialog[open]')].some(d => !['help', 'pv', 'sy', 'cr', 'vw'].includes(d.id));   // ventanas que editan datos: no se les cambia nada debajo
const syTrivial = () => !db.papers.length && !db.trash.length || path === 'ejemplo_papers.json' && !dirty;   // aquí solo está el ejemplo: manda Drive sin preguntar
async function syOnce(inter) {
  const id = PJ.cur, N = syNames(id); await SY_BG.get(id);   // si se estaba subiendo en segundo plano, se espera
  const tok = await syToken(inter), full = syGcDue() || PJ.gone.length > 0, files = full ? await syLs(tok) : await syLsFor(tok, N);
  const [I, iB, R] = await Promise.all([syIdxGet(tok, files), idb('readonly', st => st.get('syncIdxBase')).catch(() => null), syRemote(tok, files, N)]);   // a la vez: menos esperas
  const rw = R.w ? await syUnwire(tok, R.w, files, N) : null;
  const snap = syPlainS(db), plain = JSON.parse(snap), curS = syNormS(plain, snap);
  const iM = I.w ? syIdxMerge(syIdxLocal(plain.settings), I.w, iB) : syIdxLocal(plain.settings);
  for (const p of PJ.list) if ((p.id === id ? dirty : p.dirty) && !iM.projects.some(e => e.id === p.id)) iM.projects.push(pjEntry(p));   // borrado en otro dispositivo, pero aquí tiene cambios sin guardar: se queda
  if (!iM.projects.some(e => e.id === id)) {   // el proyecto abierto se borró en otro dispositivo: se pasa a otro
    if (iM.projects.length) { syIdxApply(iM); return {gone: id}; }
    iM.projects.push(pjEntry(pjCur()));
  }
  const localS = syNormS({...plain, settings: {...iM.settings, ...syOwn(plain.settings)}}), local = JSON.parse(localS);   // con los ajustes comunes que llegan del índice
  let mS = localS, replace = false;
  if (rw) {
    const remoteS = syNormS(rw), remote = JSON.parse(remoteS), base = await syBase(N);
    if (base) mS = syNormS(syMerge(local, remote, base));
    else if (localS === remoteS || syTrivial()) { mS = remoteS; replace = syTrivial(); }
    else { const c = await syAsk(local, remote); if (!c) return {cancel: true};
      mS = c === 'merge' ? syNormS(syMerge(local, remote, null)) : c === 'drive' ? remoteS : localS; replace = c === 'drive'; }
  }
  if (syPlainS(db) !== snap || PJ.cur !== id) { SY.again = true; return {again: true}; }   // cambiaste algo mientras tanto: otra vuelta enseguida
  const m = mS === localS ? local : JSON.parse(mS), news = mS !== curS;
  if (news && syBlocked()) { SY.wait = true; return {wait: true}; }   // se termina al cerrar la ventana
  syIdxApply(iM);
  if (news) syApply(m, replace);
  const iF = syIdxLocal(m.settings);   // primero el índice: un proyecto nuevo nunca queda en Drive sin estar en la lista
  if (!I.w || syS(iF) !== syS(I.w)) await syIdxPut(tok, I.f, iF);
  await idb('readwrite', st => st.put(iF, 'syncIdxBase')).catch(() => {});
  const [mw, refs] = syWire(m), have = new Set(files.filter(f => f.name.startsWith(N.img)).map(f => f.name.slice(N.img.length)));
  for (const h of refs) if (!have.has(h)) await syUpload(tok, null, N.img + h, SY.img.get(h), 'text/plain');   // cada imagen se sube una sola vez
  if (!R.sf || R.n >= SY_CFG.maxDeltas) await syCompact(tok, R, mw, refs);   // primera vez, copia de la versión anterior o muchos cambios sueltos: copia completa
  else { const p = syDiff(R.w, mw); if (p) {   // autoguardado: se sube solo lo que cambió
    const name = `${N.d}${String(Date.now()).padStart(14, '0')}-${syDev()}.json`;
    await syUpload(tok, null, name, JSON.stringify({app: 'gpapers', v: 2, at: new Date().toISOString(), patch: p}), 'application/json');
    R.c.deltas[name] = p; await syCacheSet(N, R.c); } }
  if (full) { await syGc(tok, files, I.w ? iF : null); syGcDone(); }
  await syBaseSet(N, m); sySet({last: Date.now()});
  if (syPlainS(db) === mS) { dirty = false; hdr(); sessionSoon(); }   // ya está guardado en Drive
  return {news, first: !R.w, pdf: {tok, files, m, N, id}};   // los PDF se suben después, sin hacer esperar (p. ej. al cambiar de proyecto)
}
/* ---- Proyectos que no están abiertos: sus cambios se suben en segundo plano (al cambiar de proyecto no se espera) ---- */
const SY_BG = new Map();   // proyecto → subida en curso
function syStoredSoon(id) { if (!syAuto() || SY_BG.has(id)) return SY_BG.get(id); const run = syStored(id).catch(() => {}).finally(() => SY_BG.delete(id)); SY_BG.set(id, run); return run; }
async function syStored(id) {
  const p = PJ.list.find(x => x.id === id); if (!p || p.remote || PJ.cur === id || TAB.passive) return;
  const rec = await idb('readonly', st => st.get('proj:' + id)).catch(() => null); if (!rec) return;
  const N = syNames(id), base = await syBase(N); if (!base) return;   // sin la última versión común: lo resuelve la vuelta normal al abrirlo (puede preguntar)
  const d = await projData(rec).catch(() => null); if (!d || PJ.cur === id) return;
  const localS = syNormS(JSON.parse(JSON.stringify(d, syNoHist))); if (localS === JSON.stringify(base)) return;   // nada que subir
  const tok = await syToken(false), files = await syLsFor(tok, N), R = await syRemote(tok, files, N), rw = R.w ? await syUnwire(tok, R.w, files, N) : null;
  if (PJ.cur === id) return;
  const local = JSON.parse(localS), m = rw ? JSON.parse(syNormS(syMerge(local, JSON.parse(syNormS(rw)), base))) : local;
  const [mw, refs] = syWire(m), have = new Set(files.filter(f => f.name.startsWith(N.img)).map(f => f.name.slice(N.img.length)));
  await syPool([...refs].filter(h => !have.has(h)), h => syUpload(tok, null, N.img + h, SY.img.get(h), 'text/plain'));
  if (!R.sf || R.n >= SY_CFG.maxDeltas) await syCompact(tok, R, mw, refs);
  else { const pt = syDiff(R.w, mw); if (pt) { const name = `${N.d}${String(Date.now()).padStart(14, '0')}-${syDev()}.json`;
    await syUpload(tok, null, name, JSON.stringify({app: 'gpapers', v: 2, at: new Date().toISOString(), patch: pt}), 'application/json'); R.c.deltas[name] = pt; await syCacheSet(N, R.c); } }
  await syBaseSet(N, m);
  if (PJ.cur === id) return;   // lo volviste a abrir mientras tanto: la vuelta normal lo termina
  const now = await idb('readonly', st => st.get('proj:' + id)).catch(() => null); if (!now || now.at !== rec.at) return;   // cambió mientras tanto (otra pestaña)
  const [json, add] = projWire(m);
  await idb('readwrite', st => projPut(st, 'proj:' + id, {...rec, dirty: false, at: new Date().toISOString(), json}, add)).then(() => projSaved(add)).catch(() => {});
  Object.assign(p, {n: m.papers.length, dirty: false}); pjSave();
}
async function syStoredAll() {   // al arrancar: los otros proyectos con cambios que no llegaron a Drive
  for (const p of [...PJ.list]) if (p.id !== PJ.cur && !p.remote && !TAB.passive) await syStoredSoon(p.id);   // sin cambios no se toca la red
}
async function syRun(inter, gesture) {   // gesture: viene de un clic o una tecla (el navegador deja abrir la ventana de Google)
  if (TAB.passive) return null;   // el proyecto se usa en otra pestaña
  if (!inter && !syOn()) return null;
  if (SY.busy) { SY.again = true; return null; }
  if (!inter && !syTokGet()) {   // sin acceso: renovarlo sin ventana se intenta una sola vez (no a cada cambio ni desde cada pestaña); luego, con el siguiente clic
    // sin un clic o una tecla el navegador bloquea siempre la ventana de Google (en el ordenador, al abrir la app, fallaba siempre y acababa en «Conectar»):
    // no se intenta; se espera al siguiente clic o tecla en cualquier parte, que reconecta solo. consent: hace falta «Conectar»
    if (SY.consent || !gesture) { SY.st = 'reconnect'; if (!SY.consent) { syGesture(); syWarn(); } syIcon(); return null; }
    syTry();
  }
  clearTimeout(SY.tm); SY.tm = 0; SY.busy = true; SY.wait = false; SY.st = 'busy'; syIcon(); const t0 = Date.now();
  if (gesture && !syTokGet()) syToken(false).catch(() => {});   // la ventana de Google se pide ya, dentro del clic; si se esperara a lo demás, el navegador la bloquearía
  try {
    let r; try { r = await syOnce(inter); } catch (e) { if (e.estado !== 401) throw e; syTokDel(); r = await syOnce(inter); }   // el acceso había caducado
    SY.st = SY.wait ? 'wait' : 'idle'; syToastOff(); if (r && r.gone) setTimeout(() => pjGone(r.gone));
    SY.ms = Date.now() - t0; if (r && r.pdf) { const job = syPdfJob(r.pdf); if (inter || gesture) await job; }   // a mano se espera a los PDF; en automático, no
    return r;
  } catch (e) {
    SY.st = /silencio|interaction|login|consent|popup|cerrada|denegado|access_denied|immediate/i.test(e.message) ? 'reconnect' : 'error'; SY.err = e;
    if (inter) throw e;
    if (SY.st === 'reconnect' && gesture) { SY.consent = true; toast('Google necesita que vuelvas a dar permiso a la aplicación. Tus datos siguen aquí.', [{t: 'Conectar', fn: syConnect}], 0, 'sy'); }   // ni con un clic se pudo sin su ventana de permiso
    else {
      if (SY.st === 'reconnect' || SY.st === 'error') syGesture();
      if (SY.st === 'reconnect') syWarn();
    }
    return null;
  } finally { SY.busy = false; syIcon(); if (SY.again) { SY.again = false; sySoon(1500); } }
}
function syWarn() { if (!SY.warned) { SY.warned = true; toast('Google corta el acceso cada hora: se reconectará con tu próximo clic. No pierdes nada.', [], 6000, 'sy'); } }
const syToastOff = () => { const t = $('#toast'); if (t && t.dataset.tag === 'sy') t.hidden = true; };   // ya hay acceso: fuera el aviso de reconectar
const sySoon = (ms = 3000) => { clearTimeout(SY.tm); SY.tm = setTimeout(() => { SY.tm = 0; syRun(false); }, ms); };
const syAuto = () => syOn() && syP().auto !== false;
function syApply(m, replace) {   // pone en la app lo que llega de Drive (se puede deshacer)
  if (replace) bkTake('Antes de reemplazar por Google Drive');
  const hist = new Map(db.papers.map(p => [p.id, p.history]));
  SY.applying = true;
  try {
    db = validate(structuredClone(m)); db.papers.forEach(p => p.history = hist.get(p.id) || []);
    if (replace) { path = null; handle = null; if (pjCur().name === 'Ejemplo') { pjCur().name = 'Mi biblioteca'; pjShow(); } }   // se sustituyó por la de Drive: el archivo abierto no se toca
    for (const id of [...SEL]) if (!db.papers.some(p => p.id === id)) SEL.delete(id);
    record(); dirty = true; applySettings(); render(); hdr(); sessionSoon();
    if (auto && handle) { clearTimeout(timer); timer = setTimeout(() => save(false), 1000); }   // autoguardado del archivo: también recibe los cambios
  } finally { SY.applying = false; }
}
function syLoaded() { syBaseSet(syNames(PJ.cur), null); if (syAuto()) sySoon(500); }   // otro archivo abierto en el proyecto: la próxima vuelta pregunta cómo combinarlo con Drive

/* ---- Icono, menú y ventanas ---- */
const SY_TXT = {off: 'Conectar con Google Drive', busy: 'Sincronizando…', ok: 'Sincronizado', pend: 'Cambios pendientes de sincronizar', wait: 'Cierra la ventana abierta para terminar de sincronizar',
  reconnect: 'Sincronización cortada: se reconecta con tu próximo clic', error: 'No se pudo sincronizar (se reintentará)', manual: 'Autoguardado desactivado: sincroniza a mano'};
const syAgo = ts => { const m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return 'ahora mismo'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`; const d = Math.round(h / 24); return `hace ${d} ${d === 1 ? 'día' : 'días'}`; };
const syState = () => !syOn() ? 'off' : ['busy', 'wait', 'reconnect', 'error'].includes(SY.st) ? SY.st : dirty ? (syAuto() ? 'pend' : 'manual') : 'ok';
function syIcon() {
  fnameDraw(); const b = $('#syncBtn'); if (!b) return; b.hidden = !syAvail();
  const st = syState(), p = syP(); b.dataset.st = st;
  const l = b.querySelector('.syl'), lt = st === 'off' ? SY_TXT.off : 'Google Drive · ' + SY_TXT[st]; if (l && l.textContent !== lt) l.textContent = lt;   // en el móvil se ve en el menú ⋯: dice si ya hay sesión
  b.title = st === 'off' ? SY_TXT.off : `Google Drive: ${SY_TXT[st]}${p.last ? ' · última vez ' + syAgo(p.last) : ''} (clic: opciones)`; b.setAttribute('aria-label', b.title);
}
function syClick(e) {
  e.stopPropagation(); if (!syOn()) return syIntro();
  const p = syP(), st = syState(), r = e.currentTarget.getBoundingClientRect();
  // en el móvil el botón vive en el menú ⋯: se cierra ese menú y el de Drive sale bajo la cabecera, a la derecha (donde estaba el ⋯)
  const mv = typeof mvOn === 'function' && mvOn(); if (mv) mvMore(false);
  const at = mv ? {clientX: innerWidth, clientY: document.querySelector('header').getBoundingClientRect().bottom + 4} : {clientX: r.left, clientY: r.bottom + 4};
  ctxShow({preventDefault() {}, stopPropagation() {}, ...at}, `<div class="ctxh">Google Drive${p.who ? ' · ' + esc(p.who) : ''}<br>${esc(SY_TXT[st])}${p.last ? ' · ' + syAgo(p.last) : ''}${SY.ms ? `<br><small>Última vuelta: ${(SY.ms / 1000).toLocaleString('es', {maximumFractionDigits: 1})} s</small>` : ''}</div>`
    + (st === 'reconnect' ? '<button data-onclick="ctxClose();syConnect()">🔑 Volver a conectar</button>' : '')
    + `<button data-onclick="ctxClose();syNow()">🔄 Sincronizar ahora</button><button data-onclick="ctxClose();syAutoSet(!syAuto())">${tick(syAuto())}Autoguardado en Drive</button>`
    + '<button data-onclick="ctxClose();syIntro()">❔ ¿Cómo funciona?</button><button data-onclick="ctxClose();syLogout()">🚪 Cerrar sesión</button><button class="danger" data-onclick="ctxClose();syWipe()">🗑 Borrar mis datos de Google Drive</button>');
}
async function syNow() {
  const r = await syRun(false, true);
  if (SY.st === 'reconnect') toast('Hay que volver a conectar con Google.', [{t: 'Conectar', fn: syConnect}], 8000, 'sy');
  else if (SY.st === 'error') toast(syErr(SY.err));
  else if (r && r.wait) toast('Cierra la ventana abierta para terminar de sincronizar.', [], 4000);
  else if (r && !r.cancel) toast(r.news ? 'Sincronizado: han llegado cambios de Google Drive.' : 'Sincronizado con Google Drive.', [], 3000);
}
function syAutoSet(on) { sySet({auto: on}); $('#auto').checked = on || auto; syIcon(); if (on) sySoon(300); }
function syDlg(title, body, btns) {   // btns: [[texto, acción (sin acción: cerrar), principal]]
  const d = $('#sy');
  d.innerHTML = `<div class="dh"><h2>${title}</h2></div><div class="sytx">${body}</div><div class="row sybt">${btns.map((b, i) => `<button data-i="${i}"${b[2] ? ' class="pri"' : ''}>${esc(b[0])}</button>`).join('')}</div>`;
  d.onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; const f = btns[+b.dataset.i][1]; f ? f() : d.close(); };
  if (!d.open) d.showModal(); d.scrollTop = 0;   // el foco va al primer botón (abajo): se empieza a leer por arriba
}
function syIntro() {
  if (!syOn()) syGis().catch(() => {});   // se carga ya, para que la ventana de Google se abra al pulsar «Continuar»
  syDlg('Sincronizar con Google Drive', `<p>Guarda tu biblioteca (papers, notas, secciones, etiquetas, papelera y ajustes) en tu Google Drive para tenerla igual en el ordenador, la tablet y el móvil.</p>
    <h4>¿Qué va a pasar?</h4><ul><li>Se guarda una copia en una <b>carpeta privada y oculta de tu propio Google Drive</b>. No aparece entre tus archivos y la aplicación no puede ver ni tocar nada más de tu Drive.</li>
    <li><b>Nadie más puede verla</b>: ni quien mantiene la aplicación ni otras personas. No hay ningún servidor intermedio.</li>
    <li>Se guardan <b>todos tus proyectos</b>, y cambias entre ellos con ▾ en cualquier dispositivo.</li>
    <li>Es <b>gratis</b> y no hay que instalar nada. Necesitas una cuenta de Google (la de Gmail).</li></ul>
    <h4>Pasos</h4><ol><li>Pulsa <b>«Continuar»</b>: se abrirá una ventana de Google.</li>
    <li>Elige tu cuenta y pulsa <b>«Permitir»</b> o «Continuar» cuando pida acceso a «sus propios datos de configuración en Google Drive»: es la carpeta oculta de esta aplicación.</li>
    <li>Si ya tenías una biblioteca en Drive de otro dispositivo, eliges si <b>combinarla</b> con la de aquí o quedarte con una de las dos.</li>
    <li>Listo: el icono 🔄 lleva un punto verde. Desde entonces <b>cada cambio se guarda solo en tu Drive</b> (autoguardado activado) y los cambios de tus otros dispositivos llegan al abrir la aplicación o volver a ella.</li>
    <li>En otro dispositivo: abre esta misma página, pulsa 🔄 y entra <b>con la misma cuenta de Google</b>.</li></ol>
    <h4>Por si acaso</h4><ul><li>Si no se abre la ventana de Google, permite las ventanas emergentes para esta página y vuelve a intentarlo.</li>
    <li>Los cambios de los dispositivos se <b>combinan</b> paper a paper y campo a campo; si cambias el mismo campo en dos sitios, gana el cambio más reciente. Un paper editado en un sitio no se pierde aunque lo borres en otro.</li>
    <li>Tu archivo JSON sigue funcionando igual: si tienes activo su autoguardado (Chrome/Edge), también se escribe en él.</li>
    <li>Pulsa el icono 🔄 para sincronizar al momento, desactivar el autoguardado o <b>cerrar la sesión</b>. Más detalles en la «Política de privacidad» (al final de la barra lateral).</li></ul>`,
    syOn() ? [['Cerrar', null, true]] : [['Continuar', syConnect, true], ['Cancelar']]);
}
const syCount = x => { const n = (k, a, b) => `${x[k].length} ${x[k].length === 1 ? a : b}`; return `${n('papers', 'paper', 'papers')}, ${n('sections', 'sección', 'secciones')} y ${n('tags', 'etiqueta', 'etiquetas')}`; };
const syAsk = (l, r) => new Promise(res => {   // primera vez con datos en los dos lados: cómo juntarlos
  let done = false; const fin = v => { if (!done) { done = true; res(v); } }, pick = v => () => { fin(v); $('#sy').close(); };
  syDlg('Ya tienes una biblioteca en Google Drive', `<p>En Google Drive: <b>${syCount(r)}</b>.<br>En este dispositivo: <b>${syCount(l)}</b>.</p>
    <ul><li><b>Combinar las dos</b>: junta los papers, secciones y etiquetas de ambas; si un mismo paper está en las dos, se queda con lo más reciente. No se borra nada.</li>
    <li><b>Usar la de Google Drive</b>: este dispositivo pasa a tener la de Drive (el archivo JSON que tengas abierto no se toca).</li>
    <li><b>Usar la de este dispositivo</b>: la copia de Drive se sustituye por la de aquí.</li></ul>`,
    [['Combinar las dos', pick('merge'), true], ['Usar la de Google Drive', pick('drive')], ['Usar la de este dispositivo', pick('local')], ['Cancelar', pick(null)]]);
  $('#sy').addEventListener('close', () => fin(null), {once: true});
});
function syErr(e) {
  const m = String(e && e.message || e);
  if (/red|Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No hay conexión con Google. Comprueba tu internet y vuelve a intentarlo.';
  if (/popup_failed_to_open|bloque/i.test(m)) return 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta página y vuelve a intentarlo.';
  if (/popup_closed|cerrada|access_denied|denegado|silencio/i.test(m)) return 'No se completó el permiso de Google. No ha pasado nada: puedes volver a intentarlo cuando quieras.';
  if (/formato/.test(m)) return 'El archivo de sincronización de Google Drive no es de esta aplicación.';
  if (e && e.estado === 403) return 'Google ha rechazado el acceso a la carpeta oculta (puede que falte activar Google Drive API en el proyecto).';
  if (/reanudable/.test(m)) return 'Google no ha dado la dirección para subir la copia grande. Vuelve a intentarlo en unos minutos.';
  return 'No se ha podido sincronizar. Vuelve a intentarlo en unos minutos. (Detalle: ' + m.slice(0, 80) + ')';
}
async function syConnect() {
  syDlg('Conectando con Google…', '<p>Sigue las indicaciones de la ventana de Google que se ha abierto. Si no aparece, permite las ventanas emergentes para esta página.</p>', [['Cerrar']]);
  try {
    const r = await syRun(true);
    if (!r || r.cancel) { if ($('#sy').open) $('#sy').close(); syIcon(); return; }
    sySet({on: true, auto: true, cid: SY_CFG.clientId}); SY.consent = false; $('#auto').disabled = false; $('#auto').checked = true; SY.st = 'idle'; syIcon();
    syWho(syTokGet()).then(w => { if (w) { sySet({who: w}); syIcon(); } });
    if (r.again || r.wait) sySoon(1000);
    syDlg('✔ Sincronizado', `<p>${r.first ? 'Se ha creado tu copia en Google Drive. ' : r.news ? 'Este dispositivo ya tiene tu biblioteca de Google Drive. ' : 'Este dispositivo ya estaba al día. '}
      La sesión queda iniciada: desde ahora cada cambio se guarda solo en tu Drive (<b>autoguardado activado</b>) hasta que cierres la sesión desde el icono 🔄.</p>`, [['Aceptar', null, true]]);
  } catch (e) { syDlg('No se ha podido sincronizar', `<p>${esc(syErr(e))}</p>`, [['Cerrar']]); }
}
async function syLogout(quiet) {
  if (!quiet && !await askOk('¿Cerrar la sesión de Google Drive en este dispositivo?\nTus datos se quedan aquí y en tu Drive; los demás dispositivos siguen sincronizando.')) return;
  if (!quiet && syAuto() && dirty && !SY.busy) await syRun(false);   // sube lo último antes de salir
  clearTimeout(SY.tm); clearTimeout(SY.exp); try { localStorage.removeItem('gp-sync'); } catch (e) {} syTokDel(); await syForget(); SY.st = 'idle';
  PJ.list = PJ.list.filter(p => !p.remote); pjSave(); pjShow();   // los proyectos que solo están en Drive dejan de verse aquí (siguen en tu Drive)
  $('#auto').checked = auto; if (!FSA) $('#auto').disabled = true; syIcon(); if ($('#pv').open) openPriv(); if ($('#cfg').open) drawCfg();
  if (!quiet) toast('Sesión de Google Drive cerrada. Tus datos siguen en este dispositivo y en tu Drive.', [], 5000);
}
async function syWipe() {
  const only = PJ.list.filter(p => p.remote).map(p => '«' + p.name + '»');
  if (!await askOk(`Se borrará de Google Drive la copia de todos tus proyectos y se cerrará la sesión. Los datos de este dispositivo no se tocan.${only.length ? '\nOJO: ' + only.join(', ') + (only.length === 1 ? ' solo está' : ' solo están') + ' en Google Drive y se perderá' + (only.length === 1 ? '.' : 'n.') : ''}\nSi otro dispositivo sigue conectado, volverá a crearla: cierra allí la sesión antes. ¿Continuar?`)) return;
  try { const tok = await syToken(true); for (const f of await syLs(tok)) await syDrive(tok, '/drive/v3/files/' + f.id, {method: 'DELETE'});
    await syLogout(true); toast('Copia de Google Drive borrada y sesión cerrada.', [], 5000); }
  catch (e) { toast(syErr(e)); }
}
document.addEventListener('visibilitychange', () => { if (!syAuto()) return;
  if (document.hidden) { if (SY.tm || dirty) syRun(false); } else if (Date.now() - (syP().last || 0) > 6e4) syRun(false); });   // al salir se sube lo pendiente; al volver se traen los cambios
setInterval(() => { if (syAuto() && !document.hidden && syTokGet()) syRun(false); }, 5 * 60 * 1000);   // trae los cambios de los otros dispositivos
document.addEventListener('close', e => { if (SY.wait && e.target.tagName === 'DIALOG') sySoon(300); }, true);
