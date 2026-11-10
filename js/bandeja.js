'use strict';
/* ===== Bandeja «PDF por citar» y copia de los PDF en el Drive normal (v39) =====
   La bandeja guarda PDF que aún no tienen cita (db.inbox, ver inboxClean en js/modelo.js): se abren en el mismo visor, con subrayados y comentarios,
   y salen de uno en uno encima de la lista para crear su cita (por el DOI de la primera página) o asignarlos a un paper que ya existe.
   El archivo vive como el de cualquier PDF enlazado, con la clave «in-<id>»: copia en este navegador («pdfb:»), miniatura («pdft:») y, si se
   activa, copia en la carpeta oculta de Drive (gpapers-pdf-in-<id>).
   Drive normal: con «Guardar también en mi Drive normal» (Configuración, o en cada PDF), cada PDF se copia ya anotado a la carpeta «GPapers»
   del Drive de la persona, para abrirlo desde Drive, Acrobat o Foxit. Usa el permiso drive.file (no sensible: la app solo ve los archivos que
   ella crea), que se pide la primera vez que se activa. La copia del Drive normal es solo de salida: GPapers nunca la lee ni la borra. */
const inKey = id => 'in-' + id;
const pdfVisOf = pf => !!pf && (pf.vis === 'si' || pf.vis !== 'no' && !!db.settings.pdfVis);
const IB = {i: 0};
const ibFold = () => { try { return localStorage.getItem('gp-ib-fold') === '1'; } catch (e) { return false; } };
function ibFoldSet(v) { try { localStorage.setItem('gp-ib-fold', v ? '1' : '0'); } catch (e) {} inboxDraw(); }
async function inboxDraw() {
  const box = $('#inbox'); if (!box) return; const L = db.inbox || [], s = db.settings, list = $('#list'), btn = $('#ibBtn');
  if (list && (s.inboxPos === 'top' ? box.nextElementSibling !== list : list.nextElementSibling !== box)) s.inboxPos === 'top' ? list.before(box) : list.after(box);   // abajo (por defecto) o arriba de la lista
  const off = !L.length || s.showInbox === false;
  if (btn) { btn.hidden = off || !s.inboxBtn; btn.querySelector('b').textContent = L.length; btn.setAttribute('aria-expanded', String(!!IB.shown)); btn.classList.toggle('on', !!IB.shown); }
  const mb = $('#mvIb'); if (mb) { mb.hidden = off; mb.querySelector('b').textContent = L.length; const on = s.inboxBtn ? !!IB.shown : !ibFold(); mb.setAttribute('aria-pressed', String(on)); mb.classList.toggle('on', on); }   // móvil: 🗃️ en la barra inferior siempre que haya PDF por citar
  box.hidden = off || s.inboxBtn && !IB.shown; if (box.hidden) { box.innerHTML = ''; return; }
  IB.i = Math.max(0, Math.min(IB.i, L.length - 1)); const it = L[IB.i], a = annN(it), fold = ibFold(), dup = ibDup(it);
  box.innerHTML = `<div class="ibh"><button class="ibf" data-onclick="ibFoldSet(${!fold})" aria-expanded="${!fold}" title="Plegar o desplegar"><span class="car">${fold ? '▸' : '▾'}</span><b>🗃️ PDF por citar</b><span class="ibn">${L.length}</span></button>
    ${fold ? '' : `<span class="ibnav"><button data-onclick="inboxGo(-1)" aria-label="Anterior" ${L.length < 2 ? 'disabled' : ''}>‹</button><span>${IB.i + 1} de ${L.length}</span><button data-onclick="inboxGo(1)" aria-label="Siguiente" ${L.length < 2 ? 'disabled' : ''}>›</button></span>`}
    ${!fold && L.filter(x => x.doi && !ibDup(x)).length > 1 ? `<button class="sm ibadd" data-onclick="inboxCiteAll()" title="Crea a la vez la cita de cada PDF con DOI (con los datos de CrossRef); los que fallen se quedan en la bandeja">＋ Crear todas las citas</button>` : ''}
    <button class="sm ibadd" data-onclick="inboxPick()" title="Añadir PDF a la bandeja (también puedes soltarlos en la ventana)">＋ PDF</button></div>
    ${fold ? '' : `<div class="ibc" data-id="${it.id}"><button class="ibt" data-onclick="inboxOpen('${it.id}',event)" title="Abrir en el visor"><span class="ibi">📄</span></button>
      <div class="ibd"><b class="ibname" title="${esc(it.name)}">${esc(it.name)}</b>
        ${it.guess ? `<small title="Título que se ha leído del PDF">${esc(it.guess)}</small>` : ''}${it.doi ? `<small>DOI: ${esc(it.doi)}</small>` : '<small class="ibno">Sin DOI en la primera página: la cita se crea con el título y la completas tú.</small>'}
        ${dup ? `<div class="ibdup">⚠ Ya tienes este paper: <b>${esc(shortTxt(dup.alias || dup.title) || '(sin título)')}</b>${dup.pdf && dup.pdf2 ? ' (ya tiene dos PDF)' : ` <button class="sm" data-onclick="ibpGo('${it.id}','${dup.id}')" title="El PDF (y sus anotaciones) pasa a ese paper">🔗 Enlazar a ese paper</button>`}</div>` : ''}
        ${a ? `<button class="ibann" data-onclick="inboxOpenSide('${it.id}',event)" title="Abrir el PDF con la lista de subrayados y comentarios">🖍 ${a} ${a === 1 ? 'anotación' : 'anotaciones'} · ver</button>` : ''}
        <div class="row ibb"><button class="pri" data-onclick="inboxCite('${it.id}')" title="${it.doi ? 'Crea la cita con los datos de CrossRef y abre su ficha para revisarla' : 'Crea la cita con el título y abre su ficha para completarla'}">＋ Crear cita</button>
          <button data-onclick="inboxAssign('${it.id}')" title="La cita ya existe: el PDF pasa a ese paper">🔗 Asignar a un paper</button>
          <button data-onclick="inboxOpen('${it.id}',event)">📖 Abrir</button>${L.length > 1 ? `<button data-onclick="inboxGo(1)" title="Dejarlo para luego y ver el siguiente">Después ›</button>` : ''}
          <button class="x" data-onclick="inboxDel('${it.id}')" title="Quitar de la bandeja">✕</button></div></div></div>`}`;
  if (!fold) { const th = await idb('readonly', st => st.get('pdft:' + inKey(it.id))).catch(() => null), b = box.querySelector(`.ibc[data-id="${it.id}"] .ibt`);
    if (b && typeof th === 'string' && th.startsWith('data:image/')) b.innerHTML = `<img src="${th}" alt="">`; }
}
function inboxGo(d) { const n = (db.inbox || []).length; if (!n) return; IB.i = (IB.i + d + n) % n; inboxDraw(); }
async function inboxPick() {
  try {
    if (FSA) { const hs = await showOpenFilePicker({types: PDF_T, multiple: true}); return inboxAdd(await Promise.all(hs.map(async h => ({file: await h.getFile(), h})))); }
    const fs = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.pdf,application/pdf'; i.multiple = true; i.onchange = () => res([...i.files]); i.oncancel = () => res([]); i.click(); });
    if (fs.length) inboxAdd(fs.map(file => ({file})));
  } catch (e) { if (e.name !== 'AbortError') say('No se pudo elegir el archivo: ' + e.message); }
}
async function inboxAdd(L) {   // L: [{file, h?}]
  L = L.filter(x => x.file && (/\.pdf$/i.test(x.file.name) || x.file.type === 'application/pdf')); if (!L.length) return;
  const now = new Date().toISOString(), add = [];
  for (const {file, h} of L) {
    const it = {id: uid(), name: file.name.slice(0, 260), at: now, up: now}, key = inKey(it.id);
    PDF_FILES.set(key, file); pdfKeep(key, file); if (h) idb('readwrite', st => st.put(h, 'pdf:' + key)).catch(() => {});
    add.push(it);
  }
  db.inbox = [...(db.inbox || []), ...add]; markDirty(); IB.i = db.inbox.length - add.length; inboxDraw();
  toast(`${add.length === 1 ? '1 PDF' : add.length + ' PDF'} en la bandeja «PDF por citar».`, [{t: 'Deshacer', fn: undo}], 5000);
  if (db.settings.showInbox === false) toast('La sección «PDF por citar» está oculta: actívala en Configuración → Datos y Drive.', [], 5000);
  if (vwCan()) for (const it of add) await inboxScan(it.id, PDF_FILES.get(inKey(it.id)));
}
async function pdfPage1(doc) {   // miniatura de la primera página (180 px de ancho, JPEG)
  const pg = await doc.getPage(1), v = pg.getViewport({scale: 1}), s = 180 / v.width, vp = pg.getViewport({scale: s}), cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); await pg.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp}).promise;
  return cv.toDataURL('image/jpeg', .72);
}
/* ---- Portada del PDF como imagen del paper: un paper sin imagen y con PDF muestra en la lista la primera página de su primer PDF,
   como la bandeja. La miniatura se guarda en este navegador («pdft:<clave>», con el nombre del PDF) y se saca sin pedir nada: del archivo
   enlazado si ya hay permiso o de la copia del navegador. Si no se puede leer todavía, se saca la primera vez que abres ese PDF. */
const COV = new Map();   // <clave>|<nombre> → miniatura ('' = no se pudo leer el archivo sin pedir permiso)
let COV_Q = Promise.resolve();   // se sacan de una en una, sin frenar la lista
const covOf = p => { const n = pdfsOf(p)[0], pf = n && p[pdfF(n)]; return pf ? {n, pf, key: pdfKey(p.id, n)} : null; };
const covCached = p => { const c = covOf(p); return c && COV.get(c.key + '|' + c.pf.name) || ''; };   // ya sacada en esta sesión: se pinta directamente, sin parpadeo
const covForget = key => { for (const k of COV.keys()) if (k.startsWith(key + '|')) COV.delete(k); return idb('readwrite', st => st.delete('pdft:' + key)).catch(() => {}); };
async function covStored(key, name) { const t = await idb('readonly', st => st.get('pdft:' + key)).catch(() => null); return typeof t === 'string' ? t : t && t.n === name ? t.d : ''; }   // texto: la de la bandeja
async function covQuiet(key, pf) {   // el archivo, solo si se puede leer sin preguntar nada
  let file = PDF_FILES.get(key);
  if (!file && FSA) { const h = await idb('readonly', st => st.get('pdf:' + key)).catch(() => null); try { if (h && await h.queryPermission({mode: 'read'}) === 'granted') file = await h.getFile(); } catch (e) {} }
  return file || await pdfKept(key, pf.name) || (pf.from ? await pdfKept(pf.from, pf.name) : null);
}
async function covMake(key, pf, file) {
  if (!vwCan() || !file) return ''; let doc;
  try { const L = await vwLib(); doc = await L.getDocument({data: new Uint8Array(await file.arrayBuffer()), cMapUrl: vwUrl('cmaps/'), cMapPacked: true, standardFontDataUrl: vwUrl('standard_fonts/'), isEvalSupported: false}).promise;
    const d = await pdfPage1(doc); await idb('readwrite', st => st.put({n: pf.name, d}, 'pdft:' + key)).catch(() => {}); return d; }
  catch (e) { return ''; } finally { doc?.destroy(); }
}
function covGet(p) {
  const c = covOf(p); if (!c) return Promise.resolve(''); const ck = c.key + '|' + c.pf.name;
  if (COV.has(ck)) return Promise.resolve(COV.get(ck));
  const pr = COV_Q = COV_Q.then(async () => { if (COV.has(ck)) return COV.get(ck); const d = await covStored(c.key, c.pf.name) || await covMake(c.key, c.pf, await covQuiet(c.key, c.pf)); COV.set(ck, d); return d; });
  return pr;
}
function covHydrate(root) {   // pone la portada en los huecos de imagen de los papers sin imagen y con PDF
  (root || document).querySelectorAll('.pimg[data-cov]').forEach(el => { const p = db.papers.find(x => x.id === el.dataset.cov); if (!p) return;
    covGet(p).then(d => { if (d && el.isConnected) { el.innerHTML = `<img src="${d}" alt="">`; el.title = 'Portada del PDF: ' + covOf(p)?.pf.name; } }); });
}
async function covFromOpen(id, n, file) {   // al abrir un PDF: si el paper aún no tenía portada, se saca ahora
  const p = db.papers.find(x => x.id === id), c = p && !p.image && covOf(p); if (!c || c.n !== n) return;
  const ck = c.key + '|' + c.pf.name; if (COV.get(ck)) return;
  const d = await covStored(c.key, c.pf.name) || await covMake(c.key, c.pf, file); if (!d) return; COV.set(ck, d); covHydrate();
}
/* Lee la primera página: miniatura, DOI y título probable (metadatos del PDF o la línea de letra más grande). Solo con http(s): PDF.js no se carga desde file://. */
async function inboxScan(id, file) {
  let doc; try {
    const L = await vwLib(); doc = await L.getDocument({data: new Uint8Array(await file.arrayBuffer()), cMapUrl: vwUrl('cmaps/'), cMapPacked: true, standardFontDataUrl: vwUrl('standard_fonts/'), isEvalSupported: false}).promise;
    const th = await pdfPage1(doc); await idb('readwrite', st => st.put(th, 'pdft:' + inKey(id))).catch(() => {});
    let txt = '', big = {h: 0, s: ''}; for (let i = 1; i <= Math.min(2, doc.numPages); i++) { const tc = await (await doc.getPage(i)).getTextContent();
      for (const t of tc.items) { if (typeof t.str !== 'string') continue; txt += t.str + (t.hasEOL ? '\n' : ' '); const h = Math.hypot(t.transform[2], t.transform[3]); if (i === 1 && t.str.trim().length > 3 && h > big.h + .5) big = {h, s: t.str.trim()}; else if (i === 1 && Math.abs(h - big.h) < .5 && big.s.length < 200) big.s += ' ' + t.str.trim(); } }
    const doi = (txt.replace(/\s*\n\s*/g, ' ').match(DOI_RE) || [''])[0].replace(/[.,;:)\]}>'"]+$/, '').toLowerCase();
    const meta = await doc.getMetadata().catch(() => null), mt = String(meta?.info?.Title || '').trim();
    const guess = (mt.length > 8 && !/^(microsoft word|untitled|doi|\S+\.(docx?|pdf|tex))/i.test(mt) ? mt : big.s).replace(/\s+/g, ' ').trim().slice(0, 400);
    const it = (db.inbox || []).find(x => x.id === id); if (!it) return;
    if ((doi && it.doi !== doi) || (guess && it.guess !== guess)) { if (doi) it.doi = doi; if (guess) it.guess = guess; it.up = new Date().toISOString(); markDirty(); }
    inboxDraw();
  } catch (e) { console.debug('[bandeja]', e); } finally { try { doc?.destroy(); } catch (e) {} }
}
async function inboxOpen(id, ev) {
  const it = (db.inbox || []).find(x => x.id === id); if (!it) return;
  try { const file = await pdfFile(inKey(id), it); if (!file) return; vwOpenAny({kind: 'inbox', id}, file, ev, it.page); }
  catch (e) { if (e.name !== 'AbortError') say('No se pudo abrir el PDF: ' + e.message); }
}
function inboxOpenSide(id, ev) { VW.sideNext = true; return inboxOpen(id, ev); }   // con el panel de anotaciones abierto
function ibToggle() { IB.shown = !IB.shown; inboxDraw(); if (IB.shown) setTimeout(() => $('#inbox')?.scrollIntoView({block: 'nearest', behavior: 'smooth'}), 30); }
async function inboxDel(id) {
  const it = (db.inbox || []).find(x => x.id === id); if (!it) return;
  if (annN(it) && !await askOk(`«${it.name}» tiene ${annN(it)} ${annN(it) === 1 ? 'anotación' : 'anotaciones'}. ¿Quitarlo de la bandeja?`, {ok: 'Quitar', danger: true})) return;
  db.inbox = db.inbox.filter(x => x !== it); markDirty(); inboxDraw(); toast(`«${shortTxt(it.name)}» quitado de la bandeja.`, [{t: 'Deshacer', fn: undo}], 5000);
}
async function ibMove(it, pid, n) {   // el archivo de la bandeja pasa al hueco de un paper: se copian el enlace y la miniatura; la copia del navegador se queda con la clave de la bandeja
  // (pdfFile la encuentra por «from»). Nada se borra aquí: así «Deshacer» devuelve el PDF a la bandeja con su archivo; lo que sobre lo quita pdfGc
  const from = inKey(it.id), to = pdfKey(pid, n);
  if (PDF_FILES.has(from)) PDF_FILES.set(to, PDF_FILES.get(from));
  await idb('readwrite', st => { for (const pre of ['pdf:', 'pdft:']) { const q = st.get(pre + from); q.onsuccess = () => { if (q.result != null) st.put(q.result, pre + to); }; } return null; }).catch(() => {});
  return {name: it.name, ...(it.page ? {page: it.page} : {}), ...(it.ann?.length ? {ann: structuredClone(it.ann)} : {}), ...(it.vis ? {vis: it.vis} : {}), ...(it.vid ? {vid: it.vid} : {}), from};   // from: la copia de Drive sigue con el nombre de la bandeja
}
const ibDup = it => { const d = it && normDoi(it.doi); return d ? db.papers.find(p => normDoi(p.doi) === d) || null : null; };   // ese DOI ya es un paper de la biblioteca
async function inboxCite(id) {
  const it = (db.inbox || []).find(x => x.id === id); if (!it) return;
  const dup = ibDup(it);
  if (dup && !await askOk(`Ya tienes este paper: «${shortTxt(dup.alias || dup.title)}». ¿Crear otra cita igualmente? (Con «🔗 Enlazar a ese paper» el PDF pasa al que ya tienes.)`, {ok: 'Crear otra'})) return;
  let r = null;
  if (it.doi) { toast('Buscando los datos del DOI en CrossRef…', [], 2500); try { r = await fetchDoi(it.doi); } catch (e) { toast(e.message + ' Se crea con el título.', [], 5000); } }
  r ||= {title: it.guess || it.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), authors: [], year: '', type: 'articulo', doi: it.doi || '', url: it.doi ? 'https://doi.org/' + it.doi : ''};
  const p = await ibMake(it, r); render();
  toast(`Cita creada${r.authors?.length ? '' : ': complétala en su ficha'}.`, [{t: 'Deshacer', fn: undo}], 6000); openPaper(p.id);
}
async function inboxCiteAll() {   // todas las de la bandeja con DOI, a la vez; las que ya tienes o que CrossRef no encuentra se quedan
  const L = (db.inbox || []).filter(x => x.doi), dup = L.filter(ibDup), todo = L.filter(x => !ibDup(x)); if (!todo.length) return;
  toast(`Buscando ${todo.length} DOI en CrossRef…`, [], 0); const bad = [];
  const got = []; await syPool(todo, async it => { try { got.push([it, await fetchDoi(it.doi)]); } catch (e) { bad.push(it); } }, 4);
  for (const [it, r] of todo.map(it => got.find(g => g[0] === it)).filter(Boolean)) await ibMake(it, r, true);
  if (got.length) markDirty(); render(); inboxDraw();
  const why = [bad.length ? `${bad.length} sin datos en CrossRef (${bad.map(x => shortTxt(x.name)).join(', ')})` : '', dup.length ? `${dup.length} ya ${dup.length === 1 ? 'estaba' : 'estaban'} en la biblioteca` : '', (db.inbox || []).some(x => !x.doi) ? 'los que no tienen DOI' : ''].filter(Boolean);
  toast(`${got.length} ${got.length === 1 ? 'cita creada' : 'citas creadas'}.${why.length ? ' Siguen en la bandeja: ' + why.join('; ') + '.' : ''}`, got.length ? [{t: 'Deshacer', fn: undo}] : [], why.length ? 0 : 6000);
}
async function ibMake(it, r, batch) {   // crea el paper de un PDF de la bandeja (sin abrir su ficha); batch: el deshacer va al final, una vez
  const now = new Date().toISOString(), pid = uid();
  const p = NEWF({id: pid, created: now, title: r.title || it.name, alias: '', reading: 'por_leer', rating: 0, sectionIds: secsSel(), authors: r.authors || [], year: r.year ? +r.year : '', url: r.url || '', type: r.type || 'articulo',
    venue: r.venue || '', doi: r.doi || '', ...Object.fromEntries(IMP_F.filter(k => r[k] != null).map(k => [k, r[k]])), general: '', tagIds: [], notes: [], cites: {}, related: [], refTo: [], history: [{t: now, s: 'Creado desde la bandeja «PDF por citar»'}]});
  p.pdf = await ibMove(it, pid, 1);
  db.inbox = db.inbox.filter(x => x !== it); db.papers.push(p); if (!batch) markDirty(); return p;
}
function inboxAssign(id) {
  const it = (db.inbox || []).find(x => x.id === id); if (!it) return;
  let d = $('#ibp'); if (!d) { d = document.createElement('dialog'); d.id = 'ibp'; document.body.append(d); }
  d.innerHTML = `<div class="dh"><h2>Asignar «${esc(shortTxt(it.name))}» a un paper</h2><div class="dbtn"><button data-onclick="$('#ibp').close()">Cerrar ✕</button></div></div>
    <input id="ibpQ" type="search" placeholder="Busca por título, autor o año…" style="width:100%" data-oninput="ibpList('${id}',this.value)"><div id="ibpL" class="ibpl"></div>`;
  d.showModal(); ibpList(id, ''); $('#ibpQ').focus();
}
function ibpList(id, q) {
  const n = norm(q || '').split(/\s+/).filter(Boolean), L = db.papers.filter(p => !(p.pdf && p.pdf2)).map(p => ({p, s: norm([p.title, p.alias, p.year, ...p.authors].join(' '))}))
    .filter(x => !q || n.every(w => x.s.includes(w))).slice(0, 60);
  $('#ibpL').innerHTML = L.length ? L.map(({p}) => `<button data-onclick="ibpGo('${id}','${p.id}')"><b>${esc(shortTxt(p.alias || p.title) || '(sin título)')}</b><small>${esc(p.authors.slice(0, 3).join('; '))}${p.year ? ' (' + esc(p.year) + ')' : ''}${p.pdf ? ' · ya tiene un PDF: será el PDF 2' : ''}</small></button>`).join('')
    : '<p class="empty">Ningún paper coincide (o todos tienen ya dos PDF).</p>';
}
async function ibpGo(id, pid) {
  const it = (db.inbox || []).find(x => x.id === id), p = db.papers.find(x => x.id === pid); if (!it || !p) return; const n = p.pdf ? 2 : 1;
  p[pdfF(n)] = await ibMove(it, pid, n); p.modified = new Date().toISOString(); logChange(p, `PDF${n === 2 ? ' 2' : ''} desde la bandeja: ${it.name}`);
  db.inbox = db.inbox.filter(x => x !== it); markDirty(); $('#ibp').close(); render(); toast(`PDF asignado a «${shortTxt(p.alias || p.title)}».`, [{t: 'Deshacer', fn: undo}], 5000);
}

/* ---- Copia en el Drive normal (carpeta «GPapers») ---- */
const SY_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
function pdfVisAsk() {   // al activar la copia en el Drive normal: el permiso de Google, si aún no se ha dado
  if (!syAvail()) return;
  if (!syOn()) return toast('Para copiar los PDF a tu Drive normal, conecta antes Google Drive (botón 🔄 de la cabecera).', [], 6000);
  if (syP().fileScope) { if (syAuto()) sySoon(800); return; }
  toast('Google te pedirá permiso para crear la carpeta «GPapers» en tu Drive (la app solo verá lo que ella crea).', [{t: 'Dar permiso', fn: syGrantFile}], 0, 'vis');
}
function syGrantFile() {
  return syGis().then(() => new Promise((ok, ko) => google.accounts.oauth2.initTokenClient({client_id: SY_CFG.clientId, scope: syScopes(true), include_granted_scopes: true,
    callback: r => { if (r && r.access_token && String(r.scope || '').includes('drive.file')) { sySet({fileScope: true}); syTokPut(r.access_token, +r.expires_in); toast('Permiso concedido: los PDF se copiarán a la carpeta «GPapers» de tu Drive.', [], 4000); if (syAuto()) sySoon(500); ok(); }
      else { toast('Sin ese permiso los PDF se quedan solo en la carpeta oculta.', [], 5000); ko(Error('denegado')); } },
    error_callback: e => ko(Error(e && e.type || 'cerrada'))}).requestAccessToken({prompt: 'consent'}))).catch(() => {});
}
async function syVisFolder(tok) {
  let id = null; try { id = localStorage.getItem('gp-vis-folder'); } catch (e) {}
  if (id) { try { const j = await (await syDrive(tok, `/drive/v3/files/${id}?fields=id,trashed`)).json(); if (j.id && !j.trashed) return id; } catch (e) { if (e.estado === 401) throw e; } }
  const q = "name='GPapers' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const j = await (await syDrive(tok, '/drive/v3/files?pageSize=10&fields=files(id,name)&q=' + encodeURIComponent(q))).json();
  id = j.files?.[0]?.id || (await (await syDrive(tok, '/drive/v3/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json; charset=UTF-8'}, body: JSON.stringify({name: 'GPapers', mimeType: 'application/vnd.google-apps.folder'})})).json()).id;
  try { localStorage.setItem('gp-vis-folder', id); } catch (e) {} return id;
}
async function syVisUp(tok, id, folder, name, bytes) {
  const r = await syDrive(tok, `/upload/drive/v3/files${id ? '/' + id : ''}?uploadType=resumable&fields=id`, {method: id ? 'PATCH' : 'POST',
    headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/pdf'}, body: JSON.stringify(id ? {name} : {name, parents: [folder], mimeType: 'application/pdf'})});
  const loc = r.headers.get('Location'); if (!loc) throw Error('reanudable');
  const u = await fetch(loc, {method: 'PUT', headers: {'Content-Type': 'application/pdf'}, body: bytes, cache: 'no-store'});
  if (!u.ok) { const e = Error('drive ' + u.status); e.estado = u.status; throw e; }
  return u.json();
}
const visName = s => { if (s.it) return s.it.name; const p = s.p, a = (p.authors[0] || '').split(',')[0].trim();
  return `${[a, p.year].filter(Boolean).join(' ')}${a || p.year ? ' - ' : ''}${p.alias || p.title}`.replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) + (s.n === 2 ? ' (2)' : '') + '.pdf'; };
let VIS_RUN = null; const VIS_IDS = new Map();   // una sola subida a la vez; el id de lo ya creado en esta sesión (para no duplicar si la ficha aún no lo tiene)
function syPdfsVis(tok, m, pj = PJ.cur) { const run = (VIS_RUN || Promise.resolve()).then(() => syPdfsVis1(tok, m, pj)); VIS_RUN = run.catch(() => {}); return run; }
async function syPdfsVis1(tok, m, pj) {   // cada PDF con «también en mi Drive normal», ya anotado, si cambió desde la última vez (y no está abierto en el visor)
  if (!syP().fileScope || !vwCan()) return; const L = pdfSlots(m, false).filter(s => pdfVisOf(s.pf)); if (!L.length) return;
  const openKey = VW.open && VW.src ? (VW.src.kind === 'inbox' ? inKey(VW.src.id) : pdfKey(VW.src.id, VW.src.n)) : '';
  let folder = null;
  for (const s of L) {
    if (PJ.cur !== pj) return; if (s.key === openKey) continue;
    try {
      const file = await pdfLocal(s.key) || (s.pf.from && await pdfLocal(s.pf.from)) || await pdfFromDrive(s.key, s.pf.name, true); if (!file || file.size > SY_CFG.pdfMax) continue;
      const name = visName(s), sig = syHash(JSON.stringify(s.pf.ann || []) + '|' + file.size + '|' + name), k = `pdfVis:${pj}:${s.key}`, rec = await idb('readonly', st => st.get(k)).catch(() => null);
      const vid = s.pf.vid || VIS_IDS.get(pj + ':' + s.key); if (rec === sig && vid) continue;
      let bytes; try { bytes = await vwPdfOut(file, s.pf.ann || []); } catch (e) { bytes = new Uint8Array(await file.arrayBuffer()); }   // cifrado: se sube tal cual
      folder ||= await syVisFolder(tok);
      let r; try { r = await syVisUp(tok, vid, folder, name, bytes); } catch (e) { if (vid && e.estado === 404) r = await syVisUp(tok, null, folder, name, bytes); else throw e; }   // la borraste de Drive: se crea otra
      if (r.id) VIS_IDS.set(pj + ':' + s.key, r.id); await idb('readwrite', st => st.put(sig, k)).catch(() => {});
      if (r.id && r.id !== s.pf.vid) { const live = PJ.cur === pj && pdfSlots(db, false).find(x => x.key === s.key); if (live && live.pf.vid !== r.id) { live.pf.vid = r.id; if (live.it) live.it.up = new Date().toISOString(); else live.p.modified = new Date().toISOString(); markDirty(); } }
    } catch (e) { if (e.estado === 401) throw e; if (e.estado === 403 && !SY.visWarned) { SY.visWarned = true; toast('No se pudo copiar un PDF a tu Drive normal: falta el permiso o el Drive está lleno.', [{t: 'Dar permiso', fn: syGrantFile}], 8000); } console.debug('[visible]', e); }
  }
}
function setPdfVis(on) { setCfg('pdfVis', on); if (on) pdfVisAsk(); }
function setShowInbox(on) { setCfg('showInbox', on); inboxDraw(); }

/* ---- Del visor a las notas del paper ---- */
function vwToNote() {
  vwSaveComment(); const a = vwAnns().find(x => x.id === VW.pop), p = vwPaper(); if (!a || !p) return;
  const content = [a.t ? `«${a.t}» (p. ${a.p + 1})` : `(p. ${a.p + 1})`, a.m].filter(Boolean).join('\n\n');
  const note = {id: uid(), sectionId: p.sectionIds?.[0] || '', content};
  if (TAB.sat) { p.notes.push(note); vwBc({t: 'note', pj: PJ.cur, pid: p.id, note, what: 'Nota desde el PDF (p. ' + (a.p + 1) + ')'}); return toast('Añadido a las notas del paper.', [], 3000); }   // pestaña aparte: lo guarda la principal
  if (p === D) { D.notes.push(note); drawD(); toast('Añadido a las notas del paper (se guarda al guardar la ficha).', [], 3000); return; }
  p.notes.push(note); p.modified = new Date().toISOString(); logChange(p, 'Nota desde el PDF (p. ' + (a.p + 1) + ')'); markDirty(); toast('Añadido a las notas del paper.', [{t: 'Deshacer', fn: undo}], 3000);
}

/* ---- Sacar los subrayados y comentarios: al portapapeles, a las notas del paper o en Markdown ----
   Formatos: texto («cita» (p. 3) y el comentario), Markdown, o con la cita en el texto («cita» (Pérez, 2024, p. 3)).
   «A las notas» con todas las anotaciones escribe una sola nota «Anotaciones del PDF» por PDF (id fijo: se actualiza, no se repite);
   con un filtro o una selección, añade una nota nueva. Con «Mantener al día» (Configuración) esa nota se rehace sola en cada cambio. */
const ANN_FMTS = [['txt', 'Texto'], ['md', 'Markdown'], ['cite', 'Con cita (autor, año, p.)']];
const annY = a => Math.max(...a.q.filter((_, i) => i % 2));
const annSorted = L => [...L].sort((a, b) => a.p - b.p || annY(b) - annY(a));   // por página y de arriba abajo
const annNoteId = (p, n) => `annpdf${n === 2 ? 2 : 1}${p.id}`;
function annCite(p, page) {
  const a = (p.authors || []).map(x => String(x).split(',')[0].trim()).filter(Boolean);
  const who = !a.length ? shortTxt(p.alias || p.title || '').slice(0, 40) : a.length === 1 ? a[0] : a.length === 2 ? `${a[0]} y ${a[1]}` : `${a[0]} et al.`;
  return `(${who}, ${p.year || 's. f.'}, p. ${page})`;
}
function annText(p, L, fmt = db.settings.annFmt) {
  const name = VW_COLORS.reduce((o, [c, t]) => (o[c] = t, o), {}), one = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
  L = annSorted(L);
  if (fmt === 'md') return L.map(a => `- **p. ${a.p + 1}** · ${a.k === 'note' ? 'Nota' : a.k === 'area' ? 'Zona' : 'Subrayado'} (${name[a.c] || a.c})${a.t ? `\n  > ${one(a.t)}` : ''}${a.m ? `\n  ${a.m.trim().replace(/\n/g, '\n  ')}` : ''}`).join('\n');
  return L.map(a => { const ref = fmt === 'cite' && p ? annCite(p, a.p + 1) : `(p. ${a.p + 1})`;
    return (a.t ? `«${one(a.t)}» ${ref}` : ref) + (a.m ? '\n' + a.m.trim() : ''); }).join('\n\n');
}
async function annCopy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; (document.querySelector('dialog[open]') || document.body).append(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
}
function annNoteSet(P, n, L, fmt) {   // la nota «Anotaciones del PDF» de ese PDF (en el paper y, si su ficha está abierta, en el borrador)
  const id = annNoteId(P, n), pf = P[pdfF(n)], head = `Anotaciones del PDF${pf?.name ? ' «' + pf.name + '»' : ''}`;
  const content = L.length ? head + '\n\n' + annText(P, L, fmt) : '';
  let changed = false;
  for (const p of new Set([P, D && D.id === P.id && $('#dlg').open ? D : null].filter(Boolean))) {
    const i = p.notes.findIndex(x => x.id === id);
    if (!content) { if (i >= 0) { p.notes.splice(i, 1); changed = true; } continue; }
    if (i >= 0) { if (p.notes[i].content !== content) { p.notes[i].content = content; changed = true; } }
    else { p.notes.push({id, sectionId: p.sectionIds?.[0] || db.sections[0]?.id || '', content}); changed = true; }
  }
  return changed;
}
function annAutoSync(src) {   // «Mantener al día»: tras cada cambio de las anotaciones de un paper
  if (!db.settings.annAuto || !src || src.kind !== 'paper' || TAB.sat) return false;
  const P = db.papers.find(p => p.id === src.id), pf = P && P[pdfF(src.n)]; if (!pf) return false;
  return annNoteSet(P, src.n || 1, pf.ann || []);
}
/* en el visor */
function vwExpList() { const all = vwAnns(); if (VW.pick?.size) return {L: all.filter(a => VW.pick.has(a.id)), part: true}; const f = VW.filt; return {L: f ? all.filter(a => f === 'cm' ? a.m : a.c === f) : all, part: !!f}; }
async function vwExpCopy() { const {L} = vwExpList(); if (!L.length) return; await annCopy(annText(vwPaper(), L)); toast(`${L.length} ${L.length === 1 ? 'anotación copiada' : 'anotaciones copiadas'} al portapapeles.`, [], 2500); }
function vwExpNotes() {
  const {L, part} = vwExpList(), P = vwPaper(); if (!L.length) return;
  if (!P || VW.src.kind !== 'paper') return toast('Este PDF aún no tiene cita: créala primero (⋯ → Crear la cita) para tener sus notas.', [], 4500);
  if (part) {   // una parte: nota nueva
    const note = {id: uid(), sectionId: P.sectionIds?.[0] || db.sections[0]?.id || '', content: annText(P, L)};
    if (TAB.sat) { P.notes.push(note); vwBc({t: 'note', pj: PJ.cur, pid: P.id, note, what: 'Anotaciones del PDF a las notas'}); }
    else if (P === D) { D.notes.push(note); drawD(); }
    else { P.notes.push(note); P.modified = vwNow(); logChange(P, 'Anotaciones del PDF a las notas'); markDirty(); }
    return toast(`${L.length} ${L.length === 1 ? 'anotación añadida' : 'anotaciones añadidas'} a las notas del paper.`, TAB.sat ? [] : [{t: 'Deshacer', fn: undo}], 3500);
  }
  if (TAB.sat) { const Pd = db.papers.find(p => p.id === VW.src.id); if (Pd) annNoteSet(Pd, VW.src.n, L); vwBc({t: 'annnote', pj: PJ.cur, src: VW.src, fmt: db.settings.annFmt}); return toast('Nota «Anotaciones del PDF» al día.', [], 3000); }
  const Pd = db.papers.find(p => p.id === VW.src.id); if (Pd && annNoteSet(Pd, VW.src.n, L)) { Pd.modified = vwNow(); logChange(Pd, 'Nota «Anotaciones del PDF»'); markDirty(); if (P === D) drawD(); }
  toast('Nota «Anotaciones del PDF» al día en el paper (se actualiza, no se repite).', [{t: 'Deshacer', fn: undo}], 3500);
}
function vwExpMd() { const {L} = vwExpList(); if (!L.length) return; const P = vwPaper(), head = `# ${vwTitle()}\n\n${P?.authors?.length ? P.authors.join('; ') + (P.year ? ` (${P.year})` : '') + '\n\n' : ''}`;
  download(head + annText(P, L, 'md') + '\n', (vwTitle().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || 'anotaciones') + ' - anotaciones.md', 'text/markdown'); }
function vwExpFmt(v) { setCfg('annFmt', v); }
function vwPickToggle() { VW.pick = VW.pick ? null : new Set(); vwSideDraw(); }
function vwPick(id) { if (!VW.pick) return vwJump(id); VW.pick.has(id) ? VW.pick.delete(id) : VW.pick.add(id); vwSideDraw(); }
/* en la ficha del paper, sin abrir el PDF */
function annFromDraft(n) {
  const pf = D && D[pdfF(n)]; if (!pf || !annN(pf)) return;
  if (annNoteSet(D, n, pf.ann)) { drawD(); toast('Nota «Anotaciones del PDF» añadida (se guarda al guardar la ficha).', [], 3500); } else toast('La nota «Anotaciones del PDF» ya estaba al día.', [], 2500);
}
