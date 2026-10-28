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
const SY_LOCALSET = ['view'];   // ajustes propios de cada dispositivo: no se sincronizan
const SY_IDX = 'gpapers-projects.json';   // índice: lista de proyectos y ajustes comunes
const syNames = id => id === 'main' ? {snap: SY_CFG.file, legacy: SY_CFG.legacy, d: 'gpapers-d-', img: 'gpapers-img-', pdf: 'gpapers-pdf-', key: ''}   // el primer proyecto conserva los nombres de antes (las versiones anteriores lo siguen viendo)
  : {snap: `gpapers-p-${id}-snap.json`, legacy: null, d: `gpapers-p-${id}-d-`, img: `gpapers-p-${id}-img-`, pdf: `gpapers-p-${id}-pdf-`, key: ':' + id};
const syPjOf = n => /^gpapers-p-([a-z0-9]+)-/.exec(n)?.[1] || (n !== SY_IDX ? 'main' : null);   // proyecto de un archivo de Drive
const syS = v => JSON.stringify(v);
const syNoHist = (k, v) => k === 'history' ? undefined : v, syPlainS = d => JSON.stringify(d, syNoHist);   // syPlainS(d) === syS(syPlain(d)), sin el paso de ida y vuelta
const syPlain = d => JSON.parse(syPlainS(d));   // como en el JSON: sin el historial del día
function syNorm(d) {   // pasa por validate() para comparar siempre la misma forma; validate() ajusta los tipos y estilos globales, así que se devuelven a los de db
  try { return syPlain(validate(structuredClone(d))); } finally { syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export); }
}
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
const syLst = (pick, key) => (x, y, z, h) => syList(x, y, h ? z || [] : null, pick, key);
function syPaper(a, b, c) { const mine = syWhen(a) >= syWhen(b); return syObj(a, b, c, mine, {notes: syLst((p, q, r) => syObj(p, q, r, mine))}); }
function sySettings(x, y, z) {
  const o = syObj(x, y, z, true, {customTypes: syLst(syGen), customStyles: syLst(syGen), templates: syLst(syGen),
    export: (a, b, c, h) => syObj(a, b, h ? c : null, true), shortcuts: (a, b, c, h) => syObj(a, b, h ? c : null, true)});
  for (const k of SY_LOCALSET) if (x && k in x) o[k] = x[k]; else delete o[k];
  return o;
}
function syMerge(L, R, B) {   // L = este dispositivo, R = Google Drive, B = última versión sincronizada (null la primera vez: se unen)
  const o = syObj(L, R, B, true, {sections: syLst(syGen), tags: syLst(syGen), papers: syLst(syPaper), trash: syLst(syGen, t => t.paper.id),
    settings: (x, y, z, h) => sySettings(x || {}, y || {}, h ? z || {} : null)});
  o.papers ||= []; o.trash ||= []; o.tags ||= []; o.sections ||= [];
  const live = new Map(o.papers.map(p => [p.id, p]));   // en la lista y en la papelera a la vez (un lado lo borró y el otro lo editó): gana lo último
  o.trash = o.trash.filter(t => { const p = live.get(t.paper.id); if (!p) return true; if (t.at > syWhen(p)) { o.papers.splice(o.papers.indexOf(p), 1); return true; } return false; });
  const T = new Set(o.tags.map(t => t.id)), S = new Set(o.sections.map(s => s.id));   // sin referencias a etiquetas o secciones borradas en el otro lado
  o.papers.forEach(p => { p.tagIds = (p.tagIds || []).filter(i => T.has(i)); p.sectionIds = (p.sectionIds || []).filter(i => S.has(i)); p.notes = (p.notes || []).filter(n => !n.sectionId || S.has(n.sectionId)); });
  o.sections.forEach(s => s.tagIds = (s.tagIds || []).filter(i => T.has(i)));
  return o;
}
/* ---- Solo lo que cambió: parches campo a campo ---- */
const SY_KEY = {papers: e => e.id, tags: e => e.id, sections: e => e.id, notes: e => e.id, customTypes: e => e.id, customStyles: e => e.id, templates: e => e.id, trash: t => t.paper && t.paper.id};   // listas que se comparan elemento a elemento
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
   Un archivo por paper (gpapers-pdf-<id>), subido tal cual (subida reanudable). Solo se sube lo que este dispositivo puede leer sin
   preguntar; cualquier dispositivo con la sesión iniciada puede abrir el PDF desde Drive. Los de papers que ya no tienen PDF se borran pasado un día. */
async function syUploadFile(tok, id, name, file) {   // siempre reanudable: el archivo va tal cual, sin pasarlo a texto
  const F = '&fields=id,md5Checksum,modifiedTime,size', r = await syDrive(tok, `/upload/drive/v3/files${id ? '/' + id : ''}?uploadType=resumable${F}`, {method: id ? 'PATCH' : 'POST',
    headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/pdf'}, body: JSON.stringify(id ? {} : {name, parents: ['appDataFolder']})});
  const loc = r.headers.get('Location'); if (!loc) throw Error('reanudable');
  const u = await fetch(loc, {method: 'PUT', headers: {'Content-Type': 'application/pdf'}, body: file, cache: 'no-store'});
  if (!u.ok) { const e = Error('drive ' + u.status); e.estado = u.status; throw e; }
  return u.json();
}
async function pdfLocal(id) {   // el PDF de este paper si este dispositivo puede leerlo ahora sin preguntar
  try {
    if (!FSA) return PDF_FILES.get(id) || null;
    const h = PEND_PDF.get(id) || await idb('readonly', st => st.get('pdf:' + id)).catch(() => null);
    return h && await h.queryPermission({mode: 'read'}) === 'granted' ? await h.getFile() : null;
  } catch (e) { return null; }
}
async function syPdfs(tok, files, m, N) {
  try {
    const have = new Map(files.filter(f => f.name.startsWith(N.pdf)).map(f => [f.name.slice(N.pdf.length), f])), old = Date.now() - 864e5;
    if (m.settings.pdfDrive) for (const p of m.papers) {
      if (!p.pdf) continue; const file = await pdfLocal(p.id); if (!file || file.size > SY_CFG.pdfMax) continue;
      const f = have.get(p.id), k = `pdfUp:${PJ.cur}:${p.id}`, sig = `${file.size}:${file.lastModified}`, rec = await idb('readonly', st => st.get(k)).catch(() => null);
      if (f && (rec === sig || !rec && +f.size === file.size)) { if (rec !== sig) idb('readwrite', st => st.put(sig, k)).catch(() => {}); continue; }   // ya está en Drive
      await syUploadFile(tok, f && f.id, N.pdf + p.id, file); await idb('readwrite', st => st.put(sig, k)).catch(() => {});
    }
    const used = new Set(syPapersOf(m).filter(p => p.pdf).map(p => p.id));
    for (const [id, f] of have) if (!used.has(id) && Date.parse(f.modifiedTime) < old) await syDel(tok, f.id);   // el paper ya no tiene PDF
  } catch (e) { if (e.estado === 401) throw e; if (!SY.pdfWarned) { SY.pdfWarned = true; toast(e.estado === 403 ? 'No se pudo subir un PDF: puede que tu Google Drive esté lleno.' : 'No se pudo subir un PDF a Google Drive; se reintentará.', [], 6000); } }
}
async function pdfFromDrive(id, name) {   // el PDF subido por otro dispositivo (solo con acceso vigente: no se abre ninguna ventana de Google)
  const tok = syOn() && syTokGet(); if (!tok) return null;
  try { const f = (await syLs(tok)).find(x => x.name === syNames(PJ.cur).pdf + id); if (!f) return null; toast('Descargando el PDF de tu Google Drive…', [], 3000);
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
  for (const p of syPapersOf(w)) if (p.image && p.image.kind === 'data' && p.image.data) { const h = syHash(p.image.data); SY.img.set(h, p.image.data); p.image = {kind: 'data', ref: h}; refs.add(h); }
  return [w, refs];
}
async function syUnwire(tok, w, files, N) {   // vuelve a poner las imágenes; solo descarga las que este dispositivo no tiene
  const d = structuredClone(w);
  for (const p of syPapersOf(d)) {
    const r = p.image && p.image.kind === 'data' && p.image.ref; if (!r) continue;
    if (!SY.img.has(r)) { const f = files.find(x => x.name === N.img + r); if (f) try { SY.img.set(r, await (await syDrive(tok, `/drive/v3/files/${f.id}?alt=media`)).text()); } catch (e) {} }
    p.image = SY.img.has(r) ? {kind: 'data', data: SY.img.get(r)} : null;
  }
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
  const off = () => { SY.gest = false; ['pointerdown', 'keydown'].forEach(t => document.removeEventListener(t, h, true)); };
  const h = () => { if (!syOn() || SY.consent || !['reconnect', 'error'].includes(SY.st)) return off(); if (SY.busy || Date.now() - syTried() < 15000) return; off(); syRun(false, true); };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, h, true));
}
const syGis = () => window.google?.accounts?.oauth2 ? Promise.resolve() : new Promise((ok, ko) => {
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = () => ko(Error('red')); document.head.appendChild(s); });
function syToken(inter) {   // inter = false: renueva el acceso sin ventana (solo si ya se dio el permiso y sigue abierta la sesión de Google)
  const t = syTokGet(); if (t) return Promise.resolve(t);
  return syGis().then(() => new Promise((ok, ko) => {
    const lim = inter ? 0 : setTimeout(() => ko(Error('silencio')), 15000), fin = () => clearTimeout(lim);
    google.accounts.oauth2.initTokenClient({client_id: SY_CFG.clientId, scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: r => { fin(); if (r && r.access_token) { syTokPut(r.access_token, +r.expires_in); ok(r.access_token); } else ko(Error(r && r.error || 'denegado')); },
      error_callback: e => { fin(); ko(Error(e && e.type || 'cerrada')); }}).requestAccessToken({prompt: inter ? '' : 'none'});
  }));
}
async function syDrive(tok, ruta, o = {}) {
  const r = await fetch('https://www.googleapis.com' + ruta, {...o, cache: 'no-store', headers: {Authorization: 'Bearer ' + tok, ...o.headers}});
  if (!r.ok) { const e = Error('drive ' + r.status); e.estado = r.status; throw e; }
  return r;
}
async function syLs(tok) {   // archivos de esta aplicación en la carpeta oculta (que comparte con otras webs del mismo proyecto de Google)
  const out = []; let pt = '';
  do {
    const j = await (await syDrive(tok, '/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,size,md5Checksum,modifiedTime)&q=' + encodeURIComponent("name contains 'gpapers-'") + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''))).json();
    out.push(...(j.files || []).filter(f => f.name.startsWith('gpapers-'))); pt = j.nextPageToken;
  } while (pt);
  return out;
}
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
  for (const f of ds) {
    if (!c.deltas[f.name]) { const j = await syGet(tok, f.id); if (!syOk(j) || !j.patch) continue; c.deltas[f.name] = j.patch; }
    w = syPatch(w || syEmpty(), c.deltas[f.name]);
  }
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
  for (const f of files) { const k = syPjOf(f.name); if (!k) continue;
    if (PJ.gone.includes(k) && !PJ.list.some(p => p.id === k) || ids && k !== 'main' && !ids.has(k) && Date.parse(f.modifiedTime) < old) await syDel(tok, f.id); }
  if (PJ.gone.length) { PJ.gone = []; pjSave(); }
}

/* ---- Una vuelta de sincronización ---- */
const syBlocked = () => [...document.querySelectorAll('dialog[open]')].some(d => !['help', 'pv', 'sy', 'cr'].includes(d.id));   // ventanas que editan datos: no se les cambia nada debajo
const syTrivial = () => !db.papers.length && !db.trash.length || path === 'ejemplo_papers.json' && !dirty;   // aquí solo está el ejemplo: manda Drive sin preguntar
async function syOnce(inter) {
  const tok = await syToken(inter), files = await syLs(tok), id = PJ.cur, N = syNames(id);
  const I = await syIdxGet(tok, files), iB = await idb('readonly', st => st.get('syncIdxBase')).catch(() => null);
  const R = await syRemote(tok, files, N), rw = R.w ? await syUnwire(tok, R.w, files, N) : null;
  const snap = syPlainS(db), plain = JSON.parse(snap), cur = syNorm(plain);
  const iM = I.w ? syIdxMerge(syIdxLocal(plain.settings), I.w, iB) : syIdxLocal(plain.settings);
  for (const p of PJ.list) if ((p.id === id ? dirty : p.dirty) && !iM.projects.some(e => e.id === p.id)) iM.projects.push(pjEntry(p));   // borrado en otro dispositivo, pero aquí tiene cambios sin guardar: se queda
  if (!iM.projects.some(e => e.id === id)) {   // el proyecto abierto se borró en otro dispositivo: se pasa a otro
    if (iM.projects.length) { syIdxApply(iM); return {gone: id}; }
    iM.projects.push(pjEntry(pjCur()));
  }
  const local = syNorm({...plain, settings: {...iM.settings, ...syOwn(plain.settings)}});   // con los ajustes comunes que llegan del índice
  let m = local, replace = false;
  if (rw) {
    const remote = syNorm(rw), base = await syBase(N);
    if (base) m = syNorm(syMerge(local, remote, base));
    else if (syS(local) === syS(remote) || syTrivial()) { m = remote; replace = syTrivial(); }
    else { const c = await syAsk(local, remote); if (!c) return {cancel: true};
      m = c === 'merge' ? syNorm(syMerge(local, remote, null)) : c === 'drive' ? remote : local; replace = c === 'drive'; }
  }
  if (syPlainS(db) !== snap || PJ.cur !== id) { SY.again = true; return {again: true}; }   // cambiaste algo mientras tanto: otra vuelta enseguida
  const mS = syS(m), news = mS !== syS(cur);
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
  await syGc(tok, files, I.w ? iF : null);
  await syBaseSet(N, m); sySet({last: Date.now()});
  await syPdfs(tok, files, m, N);
  if (syPlainS(db) === mS) { dirty = false; hdr(); sessionSoon(); }   // ya está guardado en Drive
  return {news, first: !R.w};
}
async function syRun(inter, gesture) {   // gesture: viene de un clic o una tecla (el navegador deja abrir la ventana de Google)
  if (!inter && !syOn()) return null;
  if (SY.busy) { SY.again = true; return null; }
  if (!inter && !syTokGet()) {   // sin acceso: renovarlo sin ventana se intenta una sola vez (no a cada cambio ni desde cada pestaña); luego, con el siguiente clic
    if (SY.consent || !gesture && (SY.st === 'reconnect' || Date.now() - syTried() < 6e4)) { SY.st = 'reconnect'; if (!SY.consent) syGesture(); syIcon(); return null; }   // consent: hace falta «Conectar»
    syTry();
  }
  clearTimeout(SY.tm); SY.tm = 0; SY.busy = true; SY.wait = false; SY.st = 'busy'; syIcon();
  try {
    let r; try { r = await syOnce(inter); } catch (e) { if (e.estado !== 401) throw e; syTokDel(); r = await syOnce(inter); }   // el acceso había caducado
    SY.st = SY.wait ? 'wait' : 'idle'; if (r && r.gone) setTimeout(() => pjGone(r.gone)); return r;
  } catch (e) {
    SY.st = /silencio|interaction|login|consent|popup|cerrada|denegado|access_denied|immediate/i.test(e.message) ? 'reconnect' : 'error'; SY.err = e;
    if (inter) throw e;
    if (SY.st === 'reconnect' && gesture) { SY.consent = true; toast('Google necesita que vuelvas a dar permiso a la aplicación. Tus datos siguen aquí.', [{t: 'Conectar', fn: syConnect}], 0); }   // ni con un clic se pudo sin su ventana de permiso
    else {
      if (SY.st === 'reconnect' || SY.st === 'error') syGesture();
      if (SY.st === 'reconnect' && !SY.warned) { SY.warned = true; toast('Google corta el acceso cada hora: se reconectará con tu próximo clic. No pierdes nada.', [], 6000); }
    }
    return null;
  } finally { SY.busy = false; syIcon(); if (SY.again) { SY.again = false; sySoon(1500); } }
}
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
  b.title = st === 'off' ? SY_TXT.off : `Google Drive: ${SY_TXT[st]}${p.last ? ' · última vez ' + syAgo(p.last) : ''} (clic: opciones)`; b.setAttribute('aria-label', b.title);
}
function syClick(e) {
  e.stopPropagation(); if (!syOn()) return syIntro();
  const p = syP(), st = syState(), r = e.currentTarget.getBoundingClientRect();
  ctxShow({preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4}, `<div class="ctxh">Google Drive${p.who ? ' · ' + esc(p.who) : ''}<br>${esc(SY_TXT[st])}${p.last ? ' · ' + syAgo(p.last) : ''}</div>`
    + (st === 'reconnect' ? '<button data-onclick="ctxClose();syConnect()">🔑 Volver a conectar</button>' : '')
    + `<button data-onclick="ctxClose();syNow()">🔄 Sincronizar ahora</button><button data-onclick="ctxClose();syAutoSet(!syAuto())">${tick(syAuto())}Autoguardado en Drive</button>`
    + '<button data-onclick="ctxClose();syIntro()">❔ ¿Cómo funciona?</button><button data-onclick="ctxClose();syLogout()">🚪 Cerrar sesión</button><button class="danger" data-onclick="ctxClose();syWipe()">🗑 Borrar mis datos de Google Drive</button>');
}
async function syNow() {
  const r = await syRun(false, true);
  if (SY.st === 'reconnect') toast('Hay que volver a conectar con Google.', [{t: 'Conectar', fn: syConnect}]);
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
  if (!quiet && !confirm('¿Cerrar la sesión de Google Drive en este dispositivo?\nTus datos se quedan aquí y en tu Drive; los demás dispositivos siguen sincronizando.')) return;
  if (!quiet && syAuto() && dirty && !SY.busy) await syRun(false);   // sube lo último antes de salir
  clearTimeout(SY.tm); clearTimeout(SY.exp); try { localStorage.removeItem('gp-sync'); } catch (e) {} syTokDel(); await syForget(); SY.st = 'idle';
  PJ.list = PJ.list.filter(p => !p.remote); pjSave(); pjShow();   // los proyectos que solo están en Drive dejan de verse aquí (siguen en tu Drive)
  $('#auto').checked = auto; if (!FSA) $('#auto').disabled = true; syIcon(); if ($('#pv').open) openPriv();
  if (!quiet) toast('Sesión de Google Drive cerrada. Tus datos siguen en este dispositivo y en tu Drive.', [], 5000);
}
async function syWipe() {
  const only = PJ.list.filter(p => p.remote).map(p => '«' + p.name + '»');
  if (!confirm(`Se borrará de Google Drive la copia de todos tus proyectos y se cerrará la sesión. Los datos de este dispositivo no se tocan.${only.length ? '\nOJO: ' + only.join(', ') + (only.length === 1 ? ' solo está' : ' solo están') + ' en Google Drive y se perderá' + (only.length === 1 ? '.' : 'n.') : ''}\nSi otro dispositivo sigue conectado, volverá a crearla: cierra allí la sesión antes. ¿Continuar?`)) return;
  try { const tok = await syToken(true); for (const f of await syLs(tok)) await syDrive(tok, '/drive/v3/files/' + f.id, {method: 'DELETE'});
    await syLogout(true); toast('Copia de Google Drive borrada y sesión cerrada.', [], 5000); }
  catch (e) { toast(syErr(e)); }
}
document.addEventListener('visibilitychange', () => { if (!syAuto()) return;
  if (document.hidden) { if (SY.tm || dirty) syRun(false); } else if (Date.now() - (syP().last || 0) > 6e4) syRun(false); });   // al salir se sube lo pendiente; al volver se traen los cambios
setInterval(() => { if (syAuto() && !document.hidden && syTokGet()) syRun(false); }, 5 * 60 * 1000);   // trae los cambios de los otros dispositivos
document.addEventListener('close', e => { if (SY.wait && e.target.tagName === 'DIALOG') sySoon(300); }, true);
