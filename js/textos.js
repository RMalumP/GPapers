'use strict';
/* ===== Buscar dentro del texto de los PDF y EPUB (v40) =====
   El texto de cada documento se saca una vez y se guarda en este navegador (IndexedDB «pdftx:<clave>» = {name, pages: [texto de cada página o capítulo]}):
   al abrirlo en el visor, o con «Preparar la búsqueda en los PDF» (Configuración → Datos), que lo hace con las copias que este navegador ya tiene.
   No se sincroniza ni va en el JSON: cada dispositivo lo prepara con sus copias.
   Se busca marcando «Incluir el texto de los PDF y EPUB» o escribiendo «texto:palabra»; la tarjeta dice la página y la abre en el visor, con la palabra buscada. */
const TX = {mem: null, loading: null};   // mem: Map clave → {name, pages, n: páginas normalizadas} (se lee la primera vez que hace falta buscar)
const TX_MAX = 800000;   // letras por documento como mucho (un libro muy largo se corta)
const TX_RANGE = () => IDBKeyRange.bound('pdftx:', 'pdftx:￿');
function txClip(pages) { let left = TX_MAX; return pages.map(s => { s = String(s || '').replace(/\s+/g, ' ').trim(); const r = s.slice(0, Math.max(0, left)); left -= r.length; return r; }); }
async function txPut(key, name, pages) {
  if (!key || !pages?.length) return; pages = txClip(pages); if (!pages.some(Boolean)) return;   // un PDF escaneado sin texto: nada que buscar
  await idb('readwrite', st => st.put({v: 1, name, pages}, 'pdftx:' + key)).catch(() => {});
  if (TX.mem) { TX.mem.set(key, {name, pages, n: pages.map(norm)}); if (txOn()) renderQ(); }
}
async function txLoad() {   // todo el texto guardado, a memoria (una vez)
  if (TX.mem) return TX.mem;
  return TX.loading ??= (async () => {
    const M = new Map();
    try { const [ks, vs] = await Promise.all([idb('readonly', st => st.getAllKeys(TX_RANGE())), idb('readonly', st => st.getAll(TX_RANGE()))]);
      ks.forEach((k, i) => { const r = vs[i]; if (r && r.v === 1 && Array.isArray(r.pages)) M.set(k.slice(6), {name: r.name, pages: r.pages, n: r.pages.map(norm)}); }); } catch (e) {}
    TX.mem = M; TX.loading = null; return M;
  })();
}
const txOn = () => F.inPdf || qParse(F.q).some(t => t.k === 'tx');
function txDocs(p) {   // [{n, pages, n: normalizadas}] de los documentos de un paper con texto guardado (y del mismo archivo)
  if (!TX.mem) { if (!TX.loading) txLoad().then(() => renderQ()); return []; }
  const o = []; for (const n of pdfsOf(p)) { const t = TX.mem.get(pdfKey(p.id, n)), pf = p[pdfF(n)]; if (t && t.name === pf.name) o.push({slot: n, ...t}); } return o;
}
const txHas = (p, v) => txDocs(p).some(d => d.n.some(s => s.includes(v)));
function txHit(p) {   // el primer sitio donde aparece lo buscado en el texto: {slot, pg, snip, q}
  if (!txOn()) return null;
  const T = qParse(F.q).filter(t => !t.neg && (t.k === 'tx' || !t.k && F.inPdf)); if (!T.length) return null;
  for (const d of txDocs(p)) for (const t of T) for (let i = 0; i < d.n.length; i++) { const k = d.n[i].indexOf(t.v); if (k < 0) continue;
    const raw = d.pages[i], a = Math.max(0, k - 50), b = Math.min(raw.length, k + t.v.length + 70);
    return {slot: d.slot, pg: i + 1, ep: isEpub(d.name), q: t.v, snip: (a ? '…' : '') + raw.slice(a, b) + (b < raw.length ? '…' : '')}; }
  return null;
}
function txLine(p) {
  const h = txHit(p); if (!h) return '';
  return `<button class="txhit" data-onclick="txOpen('${p.id}',${h.slot},${h.pg})" title="Abrir ${h.ep ? 'el EPUB en ese capítulo' : 'el PDF en esa página'}, con lo buscado marcado">📄 <b>${h.ep ? 'cap.' : 'p.'} ${h.pg}</b> ${hl(h.snip, [h.q])}</button>`;
}
async function txOpen(id, n, pg) {   // abre el documento en esa página (o capítulo) y busca lo mismo dentro
  const p = db.papers.find(q => q.id === id), pf = p && p[pdfF(n)]; if (!pf) return;
  const h = txHit(p); let file; try { file = await pdfFile(pdfKey(id, n), pf); } catch (e) { return; } if (!file) return;
  const src = {kind: 'paper', id, n}, ep = isEpub(pf.name);
  if (ep) await epOpen(src, file); else if (vwCan()) await vwOpen(src, file); else return pdfNative(file, pg);
  for (let t = 0; t < 80; t++) { if (ep ? EP.open && EP.secs.length : VW.open && VW.pages.length) break; await new Promise(r => setTimeout(r, 100)); }
  const q = h?.q || '';
  if (ep) { epGoLoc({i: pg - 1, f: 0}); if (q) { epFindToggle(true); $('#epQ').value = q; epFind(1); } }
  else { vwGo(pg - 1, true); if (q) { vwFindToggle(true); $('#vwQ').value = q; await vwFind(1); } }
}
/* ---- Sacar el texto ---- */
async function txFromPdfDoc(doc) {   // un PDF ya abierto con PDF.js → texto de cada página
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i), tc = await pg.getTextContent(); pages.push(tc.items.map(x => (x.str || '') + (x.hasEOL ? ' ' : '')).join('')); }
  return pages;
}
async function txFromEpub(file) {   // los capítulos de un EPUB, sin abrir el lector
  const bk = await epBook(file), pages = [];
  for (const s of bk.spine) { const raw = await bk.z.text(s.path) || ''; pages.push(new DOMParser().parseFromString(raw, 'text/html').body?.textContent || ''); }
  return pages;
}
const txKnown = async key => !!(await idb('readonly', st => st.get('pdftx:' + key)).catch(() => null));
function txAfterOpen(src, doc) {   // el visor acaba de abrir un PDF: si su texto no está guardado, se saca cuando el navegador esté libre
  if (src?.kind !== 'paper') return; const key = pdfKey(src.id, src.n), name = vwHolders()[0]?.name; if (!name) return;
  const go = async () => { const r = await idb('readonly', st => st.get('pdftx:' + key)).catch(() => null); if (r?.name === name) return;
    try { await txPut(key, name, await txFromPdfDoc(doc)); } catch (e) {} };   // si se cierra antes y el documento ya no sirve, se hará la próxima vez
  setTimeout(() => typeof requestIdleCallback === 'function' ? requestIdleCallback(() => go(), {timeout: 3000}) : go(), 800);   // después de pintar las primeras páginas
}
function txAfterEpub(src) {   // el lector de EPUB acaba de abrir un libro: sus capítulos ya están en la página
  if (src?.kind !== 'paper') return; const key = pdfKey(src.id, src.n), name = epHolders()[0]?.name; if (!name) return;
  idb('readonly', st => st.get('pdftx:' + key)).catch(() => null).then(r => { if (r?.name !== name && EP.src === src) txPut(key, name, EP.secs.map(s => s.textContent)); });
}
async function txBuild() {   // Configuración → Datos: prepara el texto de todos los documentos que este navegador ya tiene copiados
  const L = []; for (const p of db.papers) for (const n of pdfsOf(p)) L.push({p, n, key: pdfKey(p.id, n), pf: p[pdfF(n)]});
  if (!L.length) return say('Ningún paper tiene PDF o EPUB.');
  const have = new Set((await idb('readonly', st => st.getAllKeys(TX_RANGE())).catch(() => [])).map(k => k.slice(6)));
  const todo = L.filter(x => !have.has(x.key)); let done = 0, miss = 0, bad = 0;
  if (!todo.length) return toast('Ya está preparado el texto de todos los PDF y EPUB.', [], 3500);
  let lib = null;
  for (const x of todo) {
    toast(`Preparando la búsqueda en los documentos… ${done + miss + bad + 1} de ${todo.length}`, [], 60000);
    const file = await pdfKept(x.key, x.pf.name).catch(() => null) || (x.pf.from && await pdfKept(x.pf.from, x.pf.name).catch(() => null)) || PDF_FILES.get(x.key);
    if (!file) { miss++; continue; }
    try {
      if (isEpub(x.pf.name)) await txPut(x.key, x.pf.name, await txFromEpub(file));
      else { lib ||= await vwLib(); const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, enableXfa: false}).promise;
        try { await txPut(x.key, x.pf.name, await txFromPdfDoc(doc)); } finally { doc.destroy(); } }
      done++;
    } catch (e) { bad++; }
  }
  if (TX.mem) TX.mem = null; await txLoad(); if (txOn()) renderQ();
  toast(`Texto preparado: ${done} ${done === 1 ? 'documento' : 'documentos'}.${miss ? ` ${miss} sin copia en este navegador (se prepararán al abrirlos).` : ''}${bad ? ` ${bad} no se pudieron leer.` : ''}`, [], 7000);
  if ($('#cfg').open && typeof drawCfg === 'function') drawCfg();
}

/* ===== Espacio usado en este navegador (v40): Configuración → Datos ===== */
const STO_K = [['pdfb', 'Copias de los PDF y EPUB'], ['pdftx', 'Texto para buscar en los PDF y EPUB'], ['pdft', 'Portadas y miniaturas'], ['bkd', 'Copias de seguridad'], ['bk', 'Copias de seguridad (formato antiguo)'], ['proj', 'Proyectos (copia de trabajo)'], ['imgd', 'Imágenes de los papers']];
const stoFmt = x => x < 1024 ? x + ' B' : x < 1048576 ? Math.round(x / 1024) + ' KB' : x < 1073741824 ? (x / 1048576).toFixed(1) + ' MB' : (x / 1073741824).toFixed(2) + ' GB';
const stoSz = v => v instanceof Blob ? v.size : typeof v === 'string' ? v.length * 2 : v == null ? 0 : (JSON.stringify(v)?.length || 0) * 2;   // aproximado: en memoria, las letras ocupan 2 bytes
const stoRange = pre => IDBKeyRange.bound(pre + ':', pre + ':￿');
let STO = null;
async function stoScan() {
  const by = {}, onDrive = new Set();
  for (const [pre] of STO_K) { const vs = await idb('readonly', st => st.getAll(stoRange(pre))).catch(() => []); by[pre] = {n: vs.length, b: vs.reduce((s, v) => s + stoSz(v), 0)}; }
  (await idb('readonly', st => st.getAllKeys(stoRange('pdfUp'))).catch(() => [])).forEach(k => { const r = k.slice(6), i = r.indexOf(':'); onDrive.add(r.slice(i + 1)); });
  const ks = (await idb('readonly', st => st.getAllKeys(stoRange('pdfb'))).catch(() => [])).filter(k => onDrive.has(k.slice(5)));
  let dr = 0; for (const k of ks) { const b = await idb('readonly', st => st.get(k)).catch(() => null); dr += stoSz(b); }
  let est = null, pers = null; try { est = await navigator.storage?.estimate?.(); pers = await navigator.storage?.persisted?.(); } catch (e) {}
  return STO = {by, drive: {n: ks.length, b: dr, keys: ks}, est, pers};
}
function stoHTML() {
  if (!STO) { stoScan().then(() => { const el = $('#cfgSto'); if (el) el.innerHTML = stoHTML(); }); return '<small>Calculando…</small>'; }
  const {by, drive, est, pers} = STO, act = {
    pdftx: by.pdftx.n ? `<button class="sm" data-onclick="stoFree('pdftx')" title="Se vuelve a preparar al abrir cada documento">Borrar</button>` : `<button class="sm" data-onclick="txBuild()" title="Saca el texto de los documentos que este navegador ya tiene copiados">Preparar</button>`,
    pdft: by.pdft.n ? `<button class="sm" data-onclick="stoFree('pdft')" title="Se vuelven a hacer al abrir cada documento">Borrar</button>` : '',
    pdfb: drive.n ? `<button class="sm" data-onclick="stoFree('drive')" title="Solo las que ya están en tu Google Drive: se vuelven a bajar al abrirlas">Borrar las que están en Drive (${drive.n}, ${stoFmt(drive.b)})</button>` : '',
    bkd: `<button class="sm" data-onclick="$('#cfg').close();bkOpen()">Ver…</button>`};
  const rows = STO_K.filter(([k]) => by[k].n || k === 'pdftx').map(([k, t]) => `<tr><td>${t}</td><td class="num">${by[k].n}</td><td class="num">${stoFmt(by[k].b)}</td><td>${act[k] || ''}</td></tr>`).join('');
  const u = est?.usage, q = est?.quota, pc = u && q ? Math.min(100, u / q * 100) : 0;
  return `${u != null ? `<div class="stob" role="img" aria-label="Usado ${stoFmt(u)} de ${stoFmt(q || 0)}"><i style="width:${Math.max(.5, pc)}%"></i></div><small>Usado en total: <b>${stoFmt(u)}</b>${q ? ` de ${stoFmt(q)} disponibles (${pc < 1 ? '<1' : Math.round(pc)} %)` : ''}.</small>` : ''}
    <table class="stot"><thead><tr><th>Qué</th><th class="num">Cuántos</th><th class="num">Tamaño</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <p class="row"><button class="sm" data-onclick="stoFree('gc')" title="Copias de PDF, portadas e imágenes que ya no usa ningún proyecto ni copia de seguridad">🧹 Limpiar lo que ya no se usa</button><button class="sm" data-onclick="stoRescan()">↻ Volver a calcular</button>${pers === false ? `<button class="sm" data-onclick="stoPersist()" title="Así el navegador no borra los datos de la app cuando le falta espacio">🔒 Pedir que no se borren</button>` : ''}</p>
    <small class="cfgnote">Tamaños aproximados. Solo de este navegador: no cambia nada en el JSON ni en Google Drive.${pers ? ' El navegador no borrará estos datos por falta de espacio.' : ''}</small>`;
}
function stoRescan() { STO = null; drawCfg(); }
function stoToggle(on) { setHas(CFG_OPEN, 'sto', on); const el = $('#cfgSto'); if (on && el) { STO = null; el.innerHTML = stoHTML(); } }
async function stoFree(k) {
  if (k === 'gc') { const n = await pdfGc(); await imgGc(); toast(n ? `Se borraron ${n} ${n === 1 ? 'archivo que no se usaba' : 'archivos que no se usaban'}.` : 'No había nada sin usar.', [], 3500); }
  else if (k === 'drive') { const L = STO?.drive.keys || []; if (!L.length || !await askOk(`¿Borrar de este navegador ${L.length === 1 ? 'la copia de 1 PDF' : `las copias de ${L.length} PDF`} que ya están en tu Google Drive? Se vuelven a bajar al abrirlos (hace falta conexión).`, {ok: 'Borrar', danger: true})) return;
    await idb('readwrite', st => { L.forEach(x => st.delete(x)); return null; }).catch(() => {}); }
  else { if (k === 'pdftx' && !await askOk('¿Borrar el texto preparado para buscar en los PDF y EPUB? Se vuelve a preparar al abrir cada documento.', {ok: 'Borrar', danger: true})) return;
    await idb('readwrite', st => st.delete(stoRange(k))).catch(() => {}); if (k === 'pdftx') { TX.mem = null; if (txOn()) renderQ(); } }
  STO = null; if ($('#cfg').open) drawCfg();
}
async function stoPersist() { let ok = false; try { ok = await navigator.storage.persist(); } catch (e) {} toast(ok ? 'Listo: el navegador no borrará los datos de la app por falta de espacio.' : 'El navegador no lo ha permitido (suele hacerlo al instalar la app o al usarla a menudo).', [], 5000); STO = null; if ($('#cfg').open) drawCfg(); }
