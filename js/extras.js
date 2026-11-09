'use strict';
/* ===== Instalar la aplicación (PWA) =====
   «Añadir app» (Información, en la barra lateral) solo se ve si la aplicación se abre desde la web y aún no está instalada.
   Chrome y Edge ofrecen la instalación con un evento (beforeinstallprompt); en los demás navegadores se explica cómo hacerlo. */
let INST = null, INSTALLED = false;   // instalación ofrecida por el navegador · instalada en esta sesión
const isInstalled = () => ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].some(m => matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true;
const instShow = () => { const b = $('#instBtn'); if (b) b.hidden = !location.protocol.startsWith('http') || INSTALLED || isInstalled(); };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; instShow(); });
addEventListener('appinstalled', () => { INST = null; INSTALLED = true; instShow(); toast('Aplicación instalada: ábrela desde tu escritorio o tu pantalla de inicio.', [], 6000); });
['standalone', 'window-controls-overlay'].forEach(m => matchMedia(`(display-mode: ${m})`).addEventListener('change', instShow));
async function appInstall() {
  if (INST) { const e = INST; INST = null; try { await e.prompt(); await e.userChoice; } catch (x) {} return instShow(); }   // el navegador pide confirmar
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), li = t => `<li>${t}</li>`;
  syDlg('Añadir la aplicación', `<p>Instalada, la aplicación se abre en su propia ventana, desde tu escritorio o tu pantalla de inicio, y funciona sin conexión.</p>
    <ul>${(ios ? [li('<b>iPhone o iPad (Safari)</b>: botón Compartir → «Añadir a pantalla de inicio».')] : []).join('')}
    ${li('<b>Chrome o Edge (ordenador)</b>: el icono de instalar de la barra de direcciones, o el menú ⋮ → «Guardar y compartir» → «Instalar…» (Edge: ⋯ → «Aplicaciones» → «Instalar este sitio como aplicación»).')}
    ${li('<b>Chrome en Android</b>: menú ⋮ → «Instalar aplicación» o «Añadir a la pantalla de inicio».')}
    ${ios ? '' : li('<b>Safari en iPhone o iPad</b>: botón Compartir → «Añadir a pantalla de inicio». <b>Safari en Mac</b>: Archivo → «Añadir al Dock».')}
    ${li('<b>Firefox</b> en ordenador no permite instalarla; en Android, menú ⋮ → «Instalar».')}</ul>
    <p>Si ya la tienes instalada, ábrela desde su icono y este botón no aparecerá.</p>`, [['Entendido', null, true]]);
}

/* ===== Privacidad ===== */
function privHTML() {
  const on = syOn(), p = syP();
  return `<div class="dh"><h2>Privacidad</h2><div class="dbtn"><button data-onclick="$('#pv').close()">Cerrar ✕</button></div></div><div class="sytx">
    <h4>Qué datos se tratan y dónde</h4><p>Tus proyectos (papers, notas, secciones, etiquetas y papelera) y tus ajustes se guardan <b>en tu navegador</b> (copia de trabajo de cada proyecto en el almacenamiento de la aplicación) y en los <b>archivos JSON</b> que tú eliges. No se envían a ningún servidor de quien mantiene la aplicación: no hay cuentas, ni analíticas, ni publicidad, ni cookies de seguimiento.</p>
    <h4>Cuándo sale algo a internet</h4><ul><li><b>Buscar por DOI, ISBN o título</b>: se envía el DOI o el título a CrossRef (api.crossref.org), o el ISBN a Open Library (openlibrary.org), para traer los datos.</li><li><b>Completar con OpenAlex</b> (botón en Datos): se envía el DOI o el título a OpenAlex (api.openalex.org) para traer el resumen, las citas y el enlace al PDF en abierto.</li>
    <li><b>Imágenes por URL</b>: tu navegador las descarga de la web donde están.</li>
    <li><b>Sincronización con Google Drive</b>, solo si la activas (abajo).</li></ul>
    <h4>Sincronización con Google Drive (opcional)</h4><p>Si pulsas 🔄 y das permiso, la aplicación guarda una copia de tus proyectos (archivos <code>gpapers-…</code>: la lista de proyectos con los ajustes, cada proyecto, los cambios de cada autoguardado y las imágenes incrustadas) en una <b>carpeta privada y oculta de tu propio Google Drive</b>. Usa el permiso <code>drive.appdata</code>, que solo deja ver, crear y borrar esa carpeta concreta: la aplicación <b>no puede leer ni modificar ningún otro archivo de tu Drive</b>.</p>
    <ul><li>La conexión va directamente de tu navegador a Google. Quien mantiene la aplicación no tiene acceso a tu cuenta ni a tus datos; no se usan para publicidad, ni se venden ni se comparten con terceros.</li>
    <li>El acceso que da Google (token) se guarda en este navegador, caduca en una hora y se borra al cerrar sesión.</li>
    <li>En este dispositivo se recuerda que la sesión está iniciada, el correo de la cuenta (para mostrarlo), la fecha de la última sincronización, la última versión sincronizada (para combinar bien los cambios) y lo ya descargado de Drive (para no volver a descargarlo).</li></ul>
    <h4>Cómo retirar el permiso o borrar los datos</h4><ul><li><b>Cerrar sesión</b> (menú del icono 🔄): deja de sincronizar en este dispositivo y olvida lo anterior. Tus datos siguen aquí y en tu Drive.</li>
    <li><b>Borrar la copia de Google Drive</b>: menú del icono 🔄 → «Borrar mis datos de Google Drive», o el botón de abajo (con la sesión iniciada).</li>
    <li><b>Quitar el permiso a la aplicación</b> en todos tus dispositivos: <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</li>
    <li><b>Datos de este navegador</b>: Ayuda → «Aplicación instalada» → «Olvidar la copia de sesión», o borra los datos del sitio desde el navegador. Tus archivos JSON solo los borras tú.</li>
    <li><b>Copias de seguridad y filtros guardados</b> se guardan solo en este navegador (nunca en Google Drive). Los <b>PDF enlazados</b> no se leen ni se envían a ningún sitio, salvo que actives en Configuración «Subir a mi Google Drive los PDF enlazados»: entonces cada PDF se copia a la carpeta privada y oculta de tu Google Drive (mismo permiso <code>drive.appdata</code>), solo para que puedas abrirlo desde tus otros dispositivos. Se borra de allí si quitas el enlace, y con «Borrar mis datos de Google Drive». <b>Visor de PDF:</b> los PDF se abren y se anotan dentro de este navegador; los subrayados y comentarios se guardan en tu biblioteca (y viajan con ella a tu carpeta oculta si sincronizas). <b>Copia en tu Drive normal (opcional):</b> si activas «Guardar también los PDF en mi Drive normal», Google te pide además el permiso <code>drive.file</code>, que solo deja ver y cambiar los archivos que crea la propia aplicación: una carpeta «GPapers» con una copia de cada PDF con sus anotaciones. La aplicación sigue sin poder leer ningún otro archivo de tu Drive, y esa carpeta es tuya: no se borra al quitar el enlace ni con «Borrar mis datos de Google Drive».</li></ul>
    ${syAvail() ? `<p class="sypv">${on ? `Google Drive: <b>sesión iniciada</b>${p.who ? ' como ' + esc(p.who) : ''}${p.last ? ' · última sincronización ' + syAgo(p.last) : ''}.</p><p class="row"><button data-onclick="syLogout()">🚪 Cerrar sesión</button><button class="danger" data-onclick="syWipe()">🗑 Borrar mi copia de Google Drive</button>` : 'Google Drive: <b>sin conectar</b>. <button data-onclick="$(\'#pv\').close();syIntro()">🔄 Sincronizar…</button>'}</p>` : ''}
    <h4>Contacto</h4><p>Dudas sobre esta política: <a href="mailto:r.malumbresp@gmail.com">r.malumbresp@gmail.com</a> o <a href="mailto:rmalum01@ucm.es">rmalum01@ucm.es</a>. Versión para enlazar: <a href="privacidad.html" target="_blank" rel="noopener">privacidad.html</a>.</p></div>`;
}
function openPriv() { $('#pv').innerHTML = privHTML(); if (!$('#pv').open) $('#pv').showModal(); }

/* ===== Créditos ===== */
function openCred() {
  $('#cr').innerHTML = `<div class="dh"><h2>Créditos</h2><div class="dbtn"><button data-onclick="$('#cr').close()">Cerrar ✕</button></div></div>
    <dl class="cred"><dt>Dirección:</dt><dd>R.M.P.</dd><dt>Desarrollo:</dt><dd>Vibe Coding con Claude</dd>
    <dt>Derechos:</dt><dd><a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener">Licencia CC BY-SA</a></dd><dt>Versión:</dt><dd>v${APP_V}</dd></dl>
    <p class="empty" style="font-size:12px">Visor de PDF: <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener">PDF.js</a> (Apache 2.0) y <a href="https://pdf-lib.js.org/" target="_blank" rel="noopener">pdf-lib</a> (MIT).</p>`;
  if (!$('#cr').open) $('#cr').showModal();
}

/* ===== Buscar duplicados y fusionar =====
   Dos papers son posibles duplicados si comparten DOI o título (sin tildes ni signos). Al fusionar, el elegido conserva sus datos,
   completa los campos vacíos con los del otro, une etiquetas, secciones, notas y relaciones (también en las notas que enlazan
   con él) y el otro va a la papelera, por si acaso. */
const DP_IGN = new Set();   // grupos marcados «no son duplicados» (hasta cerrar la aplicación)
function dpGroups() {
  const P = db.papers, par = P.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i])), u = (a, b) => { par[f(a)] = f(b); }, byD = new Map(), byT = new Map();
  P.forEach((p, i) => { const d = normDoi(p.doi), t = normTitle(p.title); if (d) byD.has(d) ? u(i, byD.get(d)) : byD.set(d, i); if (t) byT.has(t) ? u(i, byT.get(t)) : byT.set(t, i); });
  const T = P.map(p => normTitle(p.title)), K = new Map();   // títulos casi iguales (ver titleSim en js/importar.js)
  T.forEach((t, i) => nearKeys(t).forEach(k => { if (!K.has(k)) K.set(k, []); K.get(k).push(i); }));
  K.forEach(L => { for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const i = L[a], j = L[b]; if (f(i) !== f(j) && isNear(T[i], P[i].year, T[j], P[j].year)) u(i, j); } });
  const g = new Map(); P.forEach((p, i) => { const r = f(i); if (!g.has(r)) g.set(r, []); g.get(r).push(p); });
  return [...g.values()].filter(a => a.length > 1 && !DP_IGN.has(a.map(p => p.id).sort().join()));
}
const dpEmpty = v => v == null || v === '' || v === false || v === 'auto' || (Array.isArray(v) && !v.length);
const dpScore = p => Object.entries(p).filter(([k, v]) => !['id', 'history', 'created', 'modified', 'notes'].includes(k) && !dpEmpty(v)).length + 3 * p.notes.length;
function dpMerge(keepId, ids) {
  const k = db.papers.find(p => p.id === keepId), gone = ids.filter(i => i !== keepId).map(i => db.papers.find(p => p.id === i)).filter(Boolean); if (!k) return;
  const SKIP = new Set(['id', 'history', 'created', 'modified', 'notes', 'tagIds', 'sectionIds', 'related', 'refTo', 'cites', 'general', 'rating', 'reading']), G = new Set(gone.map(q => q.id)), uniq = a => [...new Set(a)];
  for (const q of gone) {
    for (const key of Object.keys(q)) if (!SKIP.has(key) && dpEmpty(k[key]) && !dpEmpty(q[key])) k[key] = structuredClone(q[key]);
    k.tagIds = uniq([...k.tagIds, ...q.tagIds]); k.sectionIds = uniq([...(k.sectionIds || []), ...(q.sectionIds || [])]); k.notes.push(...q.notes.map(n => ({...n})));
    for (const [s, v] of Object.entries(q.cites || {})) if (!(s in k.cites)) k.cites[s] = v;
    if (q.general && q.general.trim() && q.general.trim() !== (k.general || '').trim()) k.general = (k.general ? k.general + '\n\n' : '') + q.general;
    k.rating = Math.max(k.rating || 0, q.rating || 0); if ((READ_N[q.reading] || 0) > (READ_N[k.reading] || 0)) k.reading = q.reading;
    if (q.created && (!k.created || q.created < k.created)) k.created = q.created;
    k.related = uniq([...k.related, ...q.related]); k.refTo = uniq([...(k.refTo || []), ...(q.refTo || [])]);
  }
  const map = a => uniq((a || []).map(x => G.has(x) ? k.id : x));
  for (const p of db.papers) {
    p.related = map(p.related).filter(x => x !== p.id && !G.has(x)); p.refTo = map(p.refTo).filter(x => x !== p.id && !G.has(x));
    const fix = t => gone.reduce((s, q) => s.split(`[[p:${q.id}]]`).join(`[[p:${k.id}]]`), String(t ?? '')); p.general = fix(p.general); p.notes.forEach(n => n.content = fix(n.content));
  }
  k.related.forEach(r => { const q = db.papers.find(x => x.id === r); if (q && !q.related.includes(k.id)) q.related.push(k.id); });
  logChange(k, 'Fusionado con: ' + gone.map(q => '«' + shortTxt(q.title) + '»').join(', ')); k.modified = new Date().toISOString();
  gone.forEach(q => trashPaper(q.id)); markDirty(); render();
}
function dpOpen() { dpDraw(); if (!$('#dp').open) $('#dp').showModal(); }
function dpDraw() {
  const G = dpGroups();
  $('#dp').innerHTML = `<div class="dh"><h2>Posibles duplicados</h2><div class="dbtn"><button data-onclick="$('#dp').close()">Cerrar ✕</button></div></div>
    <p class="empty">Papers con el mismo DOI, el mismo título o un título casi igual (una errata, un subtítulo de más). «Quedarme con este» lo conserva, le añade lo que falte de los otros (campos vacíos, etiquetas, secciones, notas, relaciones) y manda los demás a la papelera.</p>
    ${G.length ? G.map((g, gi) => `<div class="dpg"><div class="dpt">${g.length} papers · ${g.some((p, i) => g.some((q, j) => i < j && normDoi(p.doi) && normDoi(p.doi) === normDoi(q.doi))) ? 'mismo DOI' : g.some((p, i) => g.some((q, j) => i < j && normTitle(p.title) === normTitle(q.title))) ? 'mismo título' : 'título parecido'}</div>
      ${g.map(p => `<div class="irow"><span><b>${esc(p.alias || p.title)}</b><br><small>${esc(svAuth(p))}${p.venue ? ' · ' + esc(p.venue) : ''}${p.doi ? ' · ' + esc(p.doi) : ''}<br>${p.notes.length} notas · ${p.tagIds.length} etiquetas · ${p.related.length} relaciones</small></span><button class="sm" style="margin-left:auto" data-onclick="dpMerge('${p.id}', ${esc(JSON.stringify(g.map(x => x.id)).replace(/"/g, '&quot;'))});dpDraw()">Quedarme con este</button></div>`).join('')}
      <div class="row"><button class="sm" data-onclick="DP_IGN.add('${g.map(p => p.id).sort().join()}');dpDraw()">No son duplicados</button></div></div>`).join('') : '<p class="empty">No hay papers duplicados.</p>'}`;
}

/* ===== Extras: copiar cita, filtros guardados y progreso del proyecto ===== */
async function copyCardCite(id, b) {   // la cita del paper en el estilo elegido en Exportar, con cursiva real al pegar en Word o Docs
  const p = db.papers.find(x => x.id === id); if (!p) return; const raw = cite(p, ex());
  await clipHtml(`<p style="font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(raw)}</p>`, citeTxt(raw), document.body);
  if (b) { const t = b.textContent; b.textContent = '✓'; setTimeout(() => b.textContent = t, 1200); }
}
let FAV = [];   // filtros guardados de este proyecto (solo en este navegador): [{name, q, sorts, group, sec, tags, read, minRating, inNotes, mode, exTags, noTag, noSec, yFrom, yTo}]
const favLoad = async () => { const arr = k => idb('readonly', st => st.get(k + PJ.cur)).then(a => Array.isArray(a) ? a : []).catch(() => []);   // también los recientes del proyecto
  FAV = await arr('fav:'); REC = (await arr('rec:')).filter(x => typeof x === 'string'); favDraw(); recDraw(); };
const favPut = () => idb('readwrite', st => st.put(FAV, 'fav:' + PJ.cur)).catch(() => {});
const favNow = () => ({q: F.q, sorts: F.sorts.map(s => ({...s})), group: F.group, sec: F.sec, tags: [...F.tags], read: F.read, minRating: F.minRating, inNotes: F.inNotes, mode: F.mode, ...fExtra()});
const favKey = f => JSON.stringify(['q', 'sorts', 'group', 'sec', 'tags', 'read', 'minRating', 'inNotes', 'mode', 'exTags', 'noTag', 'noSec', 'yFrom', 'yTo', 'adv'].map(k => f[k] ?? null));
function favDraw() {   // «Vistas»: un clic aplica la vista; la que coincide con los filtros actuales sale marcada
  const el = $('#favL'); if (!el) return; const now = favKey(favNow());
  el.innerHTML = FAV.map((f, i) => `<div class="fav${favKey(f) === now ? ' on' : ''}"><button class="fva" data-onclick="favApply(${i})" title="Aplicar esta vista">${esc(f.name)}</button><button class="x" data-onclick="favDel(${i})" title="Borrar esta vista" aria-label="Borrar la vista ${esc(f.name)}">✕</button></div>`).join('')
    || ($('#favN').hidden ? '<small>Aún no hay vistas.</small>' : '');
}
function favNew() {   // «＋ Guardar vista»: pide el nombre en la propia barra, con una explicación
  $('#side').classList.remove('min'); $('#sg-fav').classList.remove('fold'); $('#favN').hidden = false; favDraw(); const i = $('#favName'); i.value = ''; i.focus(); uiSoon();
}
function favCancel() { $('#favN').hidden = true; favDraw(); }
function favSaveForm() { const n = $('#favName').value.trim(); if (!n) return $('#favName').focus(); favSave(n); favCancel(); }
function favKeyDown(e) { if (e.key === 'Enter') { e.preventDefault(); favSaveForm(); } else if (e.key === 'Escape') { e.stopPropagation(); favCancel(); } }
function favSave(nm) {
  const name = String(nm || '').trim().slice(0, 40); if (!name) return;
  const f = {name, ...favNow()}, i = FAV.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) FAV[i] = f; else FAV.push(f); favPut(); favDraw();
}
function favApply(v) {
  const f = FAV[+v]; if (!f) return;
  F.q = typeof f.q === 'string' ? f.q : ''; $('#q').value = F.q; F.group = !!f.group; F.sec = db.sections.some(s => s.id === f.sec) ? f.sec : '';   // lo que ya no existe se ignora
  F.tags = new Set((f.tags || []).filter(id => db.tags.some(t => t.id === id))); F.read = Object.hasOwn(READ, f.read) ? f.read : ''; F.minRating = Number.isInteger(f.minRating) && f.minRating >= 0 && f.minRating <= 5 ? f.minRating : 0;
  F.inNotes = !!f.inNotes; F.mode = f.mode === 'all' ? 'all' : 'any'; fExtraLoad(f); const so = (f.sorts || []).filter(x => x && Object.hasOwn(sortOpts(), x.k) && (x.d === 1 || x.d === -1)).slice(0, 3); if (so.length) F.sorts = so.map(x => ({k: x.k, d: x.d}));
  document.querySelector('#sg-search .sb input[type=checkbox]').checked = F.inNotes; render();
}
async function favDel(i) { if (!FAV[i] || !await askOk(`¿Borrar la vista «${FAV[i].name}»?`)) return; FAV.splice(i, 1); favPut(); favDraw(); }
let REC = [];   // papers abiertos hace poco en este proyecto (solo en este navegador), el último primero
const recPut = () => idb('readwrite', st => st.put(REC, 'rec:' + PJ.cur)).catch(() => {});
function recPush(id) { REC = [id, ...REC.filter(x => x !== id)].slice(0, 20); recPut(); recDraw(); }
function recDraw() {
  const L = REC.map(id => db.papers.find(p => p.id === id)).filter(Boolean).slice(0, 5), g = $('#sg-rec'); if (!g) return; g.hidden = !L.length;
  $('#recL').innerHTML = L.map(p => `<button class="rec" data-onclick="openPaper('${p.id}')" title="${esc(p.title)}">${esc(shortTxt(p.alias || p.title) || '(sin título)')}</button>`).join('');
}
function progDraw() {   // barra de progreso de lectura del proyecto, en la cabecera
  const el = $('#pjProg'), n = db.papers.length; el.hidden = !n || !db.settings.showProgress; if (el.hidden) return;
  const c = {leido: 0, leyendo: 0, por_leer: 0}; db.papers.forEach(p => c[p.reading in c ? p.reading : 'por_leer']++);
  el.querySelector('.pjb').innerHTML = ['leido', 'leyendo'].map(k => `<i style="width:${c[k] / n * 100}%;background:${READ_C[k]}"></i>`).join('');
  el.querySelector('small').textContent = `${c.leido}/${n} leídos`; el.title = `${READ.leido}: ${c.leido} · ${READ.leyendo}: ${c.leyendo} · ${READ.por_leer}: ${c.por_leer} (de ${n} papers)`;
}

/* ===== PDF enlazados (hasta dos por paper: «pdf» y «pdf2», p. ej. el artículo y su material suplementario) =====
   Como la imagen enlazada: en el JSON solo va el nombre (y la página donde abrir, si se indica) y el enlace al archivo vive en este
   navegador (IndexedDB). En otro dispositivo, o si el archivo se movió, al abrirlo se pide elegirlo de nuevo.
   En navegadores sin acceso a archivos hay que elegir el PDF cada vez que se abre.
   Cada hueco tiene su clave (pdfKey): la del primero es el id del paper, como siempre; la del segundo, <id>~2. Con ella se nombran el enlace
   en IndexedDB («pdf:<clave>») y la copia en Google Drive («gpapers-pdf-<clave>»). */
const PDF_T = [{description: 'PDF', accept: {'application/pdf': ['.pdf']}}], PEND_PDF = new Map(), PDF_FILES = new Map();   // PEND_PDF: elegidos en el borrador · PDF_FILES: archivos de esta sesión (sin acceso a archivos); ambos por clave
const PDF_N = [1, 2], pdfF = n => n === 2 ? 'pdf2' : 'pdf', pdfKey = (id, n) => n === 2 ? id + '~2' : id;
const pdfPage = v => { v = parseInt(v, 10); return Number.isInteger(v) && v > 0 && v < 100000 ? v : 0; };
const pdfsOf = p => PDF_N.filter(n => p[pdfF(n)]);   // huecos con PDF de un paper
async function pdfChoose(key) {   // elige el archivo de un hueco (guardándolo en el borrador o en el paper); devuelve el File
  if (FSA) { const [h] = await showOpenFilePicker({types: PDF_T}); PEND_PDF.set(key, h); return {file: await h.getFile(), h}; }
  const file = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.pdf,application/pdf'; i.onchange = () => res(i.files[0] || null); i.oncancel = () => res(null); i.click(); });
  if (!file) throw Object.assign(Error('cancelado'), {name: 'AbortError'}); PDF_FILES.set(key, file); pdfKeep(key, file); return {file};
}
/* Sin acceso a archivos (móvil, Safari, Firefox) el navegador no puede volver a leer un PDF elegido: se guarda una copia en este navegador
   («pdfb:<clave>», hasta 100 MB), igual que la que se descarga de Google Drive, para no tener que elegirlo ni descargarlo cada vez. */
const PDF_KEEP = 100 * 1048576;
const pdfKeep = (key, file) => { if (file && file.size <= PDF_KEEP) idb('readwrite', st => st.put(new Blob([file], {type: 'application/pdf'}), 'pdfb:' + key)).catch(() => {}); };
const pdfKept = async (key, name) => { const b = await idb('readonly', st => st.get('pdfb:' + key)).catch(() => null); return b instanceof Blob ? new File([b], name || 'documento.pdf', {type: 'application/pdf'}) : null; };
const pdfForget = key => idb('readwrite', st => { st.delete('pdf:' + key); st.delete('pdfb:' + key); return st.delete('pdft:' + key); }).catch(() => {});
async function pdfPick(n = 1) {
  const f = pdfF(n);
  try { const {file} = await pdfChoose(pdfKey(D.id, n)); const o = D[f]; D[f] = o && o.name === file.name ? {...o} : {name: file.name, ...(pdfPage(o?.page) ? {page: o.page} : {}), ...(o?.vis ? {vis: o.vis} : {})}; drawD(); }   // el mismo archivo (movido): se quedan sus anotaciones
  catch (e) { if (e.name !== 'AbortError') say('No se pudo elegir el archivo: ' + e.message); }
}
async function pdfClear(n = 1) {
  const k = pdfKey(D.id, n), o = D[pdfF(n)];
  if (o?.ann?.length && !await askOk(`Este PDF tiene ${o.ann.length} ${o.ann.length === 1 ? 'anotación' : 'anotaciones'} (subrayados, notas y comentarios). Si quitas el enlace, se pierden.`, {ok: 'Quitar el PDF', danger: true})) return;
  PEND_PDF.delete(k); PDF_FILES.delete(k); D[pdfF(n)] = null; drawD();
}
function pdfSetPage(v, n = 1) { const p = D[pdfF(n)]; if (p) { const x = pdfPage(v); x ? p.page = x : delete p.page; } }
function pdfSetVis(v, n = 1) { const p = D[pdfF(n)]; if (!p) return; PDF_VIS.has(v) ? p.vis = v : delete p.vis; if (v === 'si') pdfVisAsk(); }
async function pdfFile(key, pf, ask = true) {   // el archivo de un PDF enlazado: de esta sesión, del enlace guardado, de la copia del navegador, de Google Drive o, si no, se pide
  let file = PDF_FILES.get(key);
  if (!file && FSA) {
    const h = PEND_PDF.get(key) || await idb('readonly', st => st.get('pdf:' + key)).catch(() => null);
    if (h) try { if (await h.queryPermission({mode: 'read'}) === 'granted' || await h.requestPermission({mode: 'read'}) === 'granted') file = await h.getFile(); else { toast('Sin permiso para leer el PDF.'); return null; } } catch (e) { toast(`No se encuentra «${pf.name}»: elígelo de nuevo.`, [], 4000); }
  }
  if (!file) file = await pdfKept(key, pf.name) || (pf.from && await pdfKept(pf.from, pf.name));
  if (!file) { file = await pdfFromDrive(key, pf.name) || (pf.from && await pdfFromDrive(pf.from, pf.name)); if (file) pdfKeep(key, file); }   // subido por otro dispositivo (o desde la bandeja)
  if (!file && ask) {   // archivo movido o sin copia en Drive: se vuelve a enlazar
    const r = await pdfChoose(key); file = r.file; if (r.h) idb('readwrite', st => st.put(r.h, 'pdf:' + key)).catch(() => {});
    if (file.name !== pf.name) toast(`Has elegido «${file.name}», distinto de «${pf.name}».`, [], 4000);
  }
  return file;
}
function pdfNative(file, page) {   // el visor del navegador, en otra pestaña (desde file:// o si se pide)
  const url = URL.createObjectURL(file.type === 'application/pdf' ? file : new Blob([file], {type: 'application/pdf'})) + (pdfPage(page) ? '#page=' + pdfPage(page) : '');
  window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url.split('#')[0]), 120000);
}
async function pdfOpen(id, n = 1, ev) {
  const p = D && D.id === id && $('#dlg').open ? D : db.papers.find(x => x.id === id), pf = p && p[pdfF(n)], key = pdfKey(id, n); if (!pf) return;   // con el editor abierto, el borrador
  try {
    const file = await pdfFile(key, pf); if (!file) return;
    vwOpenAny({kind: 'paper', id, n}, file, ev, pf.page);
  } catch (e) { if (e.name !== 'AbortError') say('No se pudo abrir el PDF: ' + e.message); }
}
const annN = pf => pf?.ann?.length || 0;
const pdfBtns = (p, full) => pdfsOf(p).map(n => { const pf = p[pdfF(n)], a = annN(pf);
  return `<button class="sm" data-onclick="pdfOpen('${p.id}',${n},event)" title="Abrir el PDF: ${esc(pf.name)}${a ? ` · ${a} ${a === 1 ? 'anotación' : 'anotaciones'} (subrayados y notas)` : ''}">📄${full ? ' PDF' : ''}${n === 2 ? ' 2' : ''}${a ? `<span class="annc">${a}</span>` : ''}</button>`; }).join('');   // botones de la tarjeta (full) y de la tabla, con cuántas anotaciones tiene

/* ===== Mover o copiar papers a otro proyecto =====
   Los papers seleccionados (con sus notas, etiquetas, secciones y las relaciones entre ellos) pasan a la copia de trabajo del otro
   proyecto. Las etiquetas y secciones se buscan por nombre y, si no existen allí, se crean. Se ve al abrir ese proyecto. */
function psOpen() {
  const ids = [...SEL].filter(id => db.papers.some(p => p.id === id)), T = PJ.list.filter(p => p.id !== PJ.cur && !p.remote), R = PJ.list.filter(p => p.id !== PJ.cur && p.remote);
  if (!ids.length) return toast('Selecciona antes los papers que quieres mover o copiar (casilla «Seleccionar» de cada uno).', [], 4000);
  if (!T.length && R.length) return toast(`Tus otros proyectos solo están en Google Drive: abre una vez el de destino en este dispositivo (▾ junto al nombre) y vuelve a intentarlo.`, [], 6000);
  if (!T.length) return toast('Necesitas otro proyecto en este dispositivo: crea uno con ▾ junto al nombre del proyecto.', [], 4500);
  $('#ps').innerHTML = `<div class="dh"><h2>Mover o copiar ${ids.length} ${ids.length === 1 ? 'paper' : 'papers'}</h2><div class="dbtn"><button data-onclick="$('#ps').close()">Cerrar ✕</button></div></div>
    <p class="empty">Desde «${esc(pjCur().name)}» a otro proyecto. Se llevan las notas, etiquetas y secciones (se crean en el destino si no existen) y las relaciones entre los papers elegidos.</p>
    <label class="row"><input type="radio" name="psm" value="copy" checked> Copiar (se quedan también aquí)</label><label class="row"><input type="radio" name="psm" value="move"> Mover (dejan de estar aquí)</label>
    <h4>Proyecto de destino</h4>${T.map(p => `<button class="pji2" data-onclick="psGo('${p.id}')">${esc(p.name)} <small>${p.n || 0} papers</small></button>`).join('')}${R.length ? `<p class="empty"><small>${R.map(p => '«' + esc(p.name) + '»').join(', ')}: solo ${R.length === 1 ? 'está' : 'están'} en Google Drive; ábrelo una vez en este dispositivo para poder copiar a él.</small></p>` : ''}
    <p class="empty"><small>Los PDF enlazados viajan con su paper, con sus subrayados y comentarios.</small></p>`;
  $('#ps').showModal();
}
async function psGo(tid) {
  const mode = document.querySelector('#ps input[name=psm]:checked')?.value || 'copy', ids = [...SEL].filter(id => db.papers.some(p => p.id === id)), tp = PJ.list.find(p => p.id === tid);
  const rec = await idb('readonly', st => st.get('proj:' + tid)).catch(() => null); let d; try { d = await projData(rec); if (!d) throw 0; } catch (e) { return say('No se pudo leer el proyecto de destino.'); }
  const src = ids.map(id => structuredClone(db.papers.find(p => p.id === id))), srcTags = new Map(db.tags.map(t => [t.id, t])), srcSecs = new Map(db.sections.map(s => [s.id, s]));
  const low = s => String(s).trim().toLowerCase(), tagMap = new Map(), secMap = new Map(), have = new Set(d.papers.map(p => p.id).concat(d.trash.map(t => t.paper.id)));
  const mapTag = id => { const t = srcTags.get(id); if (!t) return null; if (!tagMap.has(id)) { let x = d.tags.find(y => low(y.name) === low(t.name)); if (!x) { x = {...t, id: have.has(t.id) || d.tags.some(y => y.id === t.id) ? uid() : t.id}; d.tags.push(x); } tagMap.set(id, x.id); } return tagMap.get(id); };
  const mapSec = id => { const s = srcSecs.get(id); if (!s) return null; if (!secMap.has(id)) { let x = d.sections.find(y => low(y.name) === low(s.name)); if (!x) { x = {...s, id: d.sections.some(y => y.id === s.id) ? uid() : s.id, tagIds: (s.tagIds || []).map(mapTag).filter(Boolean)}; d.sections.push(x); } secMap.set(id, x.id); } return secMap.get(id); };
  const idMap = new Map(src.map(p => [p.id, mode === 'move' && !have.has(p.id) ? p.id : (have.has(p.id) ? uid() : p.id)])), uq = a => [...new Set(a)];
  for (const p of src) {
    const old = p.id; p.id = idMap.get(old); p.history = [];
    p.tagIds = uq(p.tagIds.map(mapTag).filter(Boolean)); p.sectionIds = uq((p.sectionIds || []).map(mapSec).filter(Boolean));
    p.notes.forEach(n => { n.sectionId = n.sectionId ? mapSec(n.sectionId) || '' : ''; });
    p.related = uq(p.related.filter(x => idMap.has(x)).map(x => idMap.get(x))); p.refTo = uq((p.refTo || []).filter(x => idMap.has(x)).map(x => idMap.get(x)));
    const fix = t => [...idMap].reduce((s, [a, b]) => a === b ? s : s.split(`[[p:${a}]]`).join(`[[p:${b}]]`), String(t ?? '')); p.general = fix(p.general); p.notes.forEach(n => n.content = fix(n.content));
    for (const n of PDF_N) { const pf = p[pdfF(n)]; if (!pf) continue; const ok = pdfKey(old, n), nk = pdfKey(p.id, n);   // el PDF, también en el otro proyecto
      if (nk !== ok) delete pf.vid;   // copia: su propia copia en el Drive normal
      const f = await pdfLocal(ok) || await pdfFromDrive(ok, pf.name, true); if (!f) continue;
      const h = FSA && await idb('readonly', st => st.get('pdf:' + ok)).catch(() => null);
      if (nk !== ok) { PDF_FILES.set(nk, f); if (h) await idb('readwrite', st => st.put(h, 'pdf:' + nk)).catch(() => {}); }
      if (!h && !await pdfKept(nk)) pdfKeep(nk, f); }   // copia en el navegador: el otro proyecto la sube a su carpeta de Drive
    d.papers.push(p);
  }
  await bkTake('Antes de ' + (mode === 'move' ? 'mover' : 'copiar') + ' papers a «' + tp.name + '»', true);
  const [json, add] = projWire(d);
  await idb('readwrite', st => projPut(st, 'proj:' + tid, {...rec, dirty: true, at: new Date().toISOString(), json}, add)).then(() => projSaved(add)).catch(() => {});
  Object.assign(tp, {n: d.papers.length, dirty: true});
  if (mode === 'move') { const S = new Set(ids); db.papers = db.papers.filter(p => !S.has(p.id)); db.papers.forEach(q => { q.related = q.related.filter(x => !S.has(x)); q.refTo = (q.refTo || []).filter(x => !S.has(x)); }); SEL.clear(); markDirty(); render(); } else { SEL.clear(); render(); }
  pjSave(); $('#ps').close();
  toast(`${ids.length} ${ids.length === 1 ? 'paper' : 'papers'} ${mode === 'move' ? 'movido' + (ids.length === 1 ? '' : 's') : 'copiado' + (ids.length === 1 ? '' : 's')} a «${tp.name}».`, [{t: 'Abrir ese proyecto', fn: () => pjOpen(tid)}], 8000);
}

/* ===== Copias de seguridad de cada proyecto =====
   Una copia al abrir cada día (y antes de restaurar o de sustituirlo todo por lo de Drive) en IndexedDB: las últimas 10 (4 si son muy grandes).
   «bk:<id>» es solo el índice (fecha, motivo, papers, tamaño y huella), así abrir la app no lee las copias enteras; cada copia va en
   «bkd:<id>:<k>», en el mismo formato compacto que la copia de trabajo (las imágenes incrustadas, una sola vez, en «imgd:<huella>»).
   Las copias de versiones anteriores (con el JSON dentro del índice) se pasan a este formato la próxima vez que se guarda una.
   Solo viven en este navegador; la papelera y Drive no las sustituyen. */
const BK_MAX = 10;
const bkList = (id = PJ.cur) => idb('readonly', st => st.get('bk:' + id)).then(L => Array.isArray(L) ? L : []).catch(() => []);
const bkKey = (id, k) => `bkd:${id}:${k}`;
const bkRange = id => IDBKeyRange.bound(`bkd:${id}:`, `bkd:${id}:\uffff`);
async function bkJSON(c, id = PJ.cur) {   // el JSON completo de una copia, con sus imágenes (como el archivo que se guarda)
  if (typeof c.json === 'string') return c.json;   // copia antigua
  const d = await projData(await idb('readonly', st => st.get(bkKey(id, c.k))).catch(() => null));
  if (!d) throw Error('no se encuentra la copia');
  return JSON.stringify(d, null, 2);
}
async function bkPutList(id, L, add) {   // escribe el índice (sin JSON dentro) y lo que haga falta: copias nuevas, antiguas por convertir y borrados
  const keep = new Set(L.map(c => c.k).filter(Boolean)), old = L.filter(c => typeof c.json === 'string');
  old.forEach(c => { c.k = c.k || uid(); c.h = c.h || ''; keep.add(c.k); });
  const ks = await idb('readonly', st => st.getAllKeys(bkRange(id))).catch(() => []);
  await idb('readwrite', st => {
    (add || []).forEach(([k, rec, imgs]) => projPut(st, bkKey(id, k), rec, imgs));
    old.forEach(c => st.put({v: 1, json: c.json}, bkKey(id, c.k)));
    ks.filter(k => !keep.has(k.slice(`bkd:${id}:`.length))).forEach(k => st.delete(k));
    return st.put(L.map(({json, ...c}) => c), 'bk:' + id);
  }).then(() => (add || []).forEach(([, , imgs]) => projSaved(imgs))).catch(() => {});
}
async function bkTake(why, force, id = PJ.cur) {   // la copia se hace del estado que hay al llamar (antes de cualquier await)
  if (!BOOTED || id !== PJ.cur) return; const n = db.papers.length, any = n + db.trash.length + db.sections.length + db.tags.length;
  if (!any && !force) return;
  const [json, imgs] = projWire(db), h = syHash(json), size = dbJSON().length;
  const L = await bkList(id); if (!force && L.length && L[0].h === h) return;   // sin cambios desde la última
  const k = uid(); L.unshift({at: new Date().toISOString(), why, n, size, h, k}); L.length = Math.min(L.length, size > 3e6 ? 4 : BK_MAX);
  await bkPutList(id, L, [[k, {v: 1, json}, imgs]]);
}
const bkDaily = async () => { const L = await bkList(); if (!L.length || Date.now() - Date.parse(L[0].at) > 864e5) await bkTake('Automática'); };
const bkFmt = c => new Date(c.at).toLocaleString('es', {dateStyle: 'medium', timeStyle: 'short'});
async function bkOpen() {
  ctxClose(); const L = await bkList(), kb = x => x < 1024 ? x + ' B' : x < 1048576 ? Math.round(x / 1024) + ' KB' : (x / 1048576).toFixed(1) + ' MB';
  $('#bk').innerHTML = `<div class="dh"><h2>Copias de seguridad · ${esc(pjCur().name)}</h2><div class="dbtn"><button data-onclick="$('#bk').close()">Cerrar ✕</button></div></div>
    <p class="empty">Se guarda una copia al abrir la aplicación cada día (las últimas ${BK_MAX}) y antes de restaurar o de sustituirlo todo por lo de Drive. Solo están en este navegador y se borran con el proyecto. Restaurar sustituye papers, notas, secciones, etiquetas y papelera de este proyecto (los ajustes no cambian) y se puede deshacer.</p>
    ${L.length ? L.map((c, i) => `<div class="irow"><span><b>${esc(bkFmt(c))}</b><br><small>${esc(c.why)} · ${c.n} papers · ${kb(c.size)}</small></span><span class="row" style="margin-left:auto;flex-wrap:nowrap"><button class="sm" data-onclick="bkRestore(${i})">Restaurar</button><button class="sm" data-onclick="bkDownload(${i})" title="Descargar esta copia como JSON">⬇</button><button class="sm x" data-onclick="bkDelete(${i})" title="Borrar esta copia">✕</button></span></div>`).join('') : '<p class="empty">Todavía no hay copias.</p>'}
    <div class="row" style="margin-top:12px"><button class="pri" data-onclick="bkNow()">Crear copia ahora</button></div>`;
  if (!$('#bk').open) $('#bk').showModal();
}
async function bkNow() { await bkTake('Manual', true); bkOpen(); }
async function bkDownload(i) { const c = (await bkList())[i]; if (c) download(await bkJSON(c), `${pjCur().name} · copia ${c.at.slice(0, 10)}.json`, 'application/json'); }
async function bkDelete(i) { const L = await bkList(); L.splice(i, 1); await bkPutList(PJ.cur, L); bkOpen(); }
async function bkRestore(i) {
  const c = (await bkList())[i]; if (!c) return;
  if (!await askOk(`¿Restaurar la copia del ${bkFmt(c)} (${c.n} papers)?\nSe sustituye lo que hay ahora en «${pjCur().name}»; antes se guarda una copia del estado actual y puedes deshacerlo (${db.settings.shortcuts.undo}).`)) return;
  let d; try { d = JSON.parse(await bkJSON(c)); d.settings = structuredClone(db.settings); d = validate(d); } catch (e) { return say('La copia no es válida: ' + e.message); } finally { syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export); }
  await bkTake('Antes de restaurar', true);
  const hist = new Map(db.papers.map(p => [p.id, p.history])); db = d; db.papers.forEach(p => p.history = hist.get(p.id) || []);
  for (const id of [...SEL]) if (!db.papers.some(p => p.id === id)) SEL.delete(id);
  lastRecAt = 0; record(); markDirty(); applySettings(); render(); bkOpen(); toast('Copia restaurada. Lo anterior sigue en las copias y se puede deshacer.', [], 5000);
}

/* ===== Proyectos =====
   Cada proyecto es una biblioteca aparte (papers, notas, secciones, etiquetas y papelera) con su propio archivo JSON, que se llama
   como el proyecto. Los ajustes (nombre de la aplicación, colores, atajos, tipos y estilos propios, plantillas, exportación) son
   comunes: viajan en db.settings y se quedan al cambiar de proyecto (también se guardan en cada JSON, para que el archivo sirva
   solo). En IndexedDB: «projects» (lista y proyecto abierto), «proj:<id>» (copia de trabajo de cada uno, con las imágenes incrustadas aparte en «imgd:<huella>») y «h:<id>» (su archivo).
   El primero es «main»: en Google Drive conserva los nombres de archivo de antes. */
const PJ = {cur: 'main', list: [{id: 'main', name: 'Mi biblioteca', created: ''}], gone: []};   // gone: borrados aquí cuyos archivos de Drive aún hay que borrar
const pjCur = () => PJ.list.find(p => p.id === PJ.cur);
const pjFile = n => (String(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'papers') + '.json';   // nombre de su archivo JSON
const pjNameFor = f => { const b = String(f || '').split(/[\\/]/).pop().replace(/\.json$/i, '').trim(); return !b ? 'Mi biblioteca' : b === 'ejemplo_papers' ? 'Ejemplo' : b.slice(0, 60); };
const pjUnique = (n, skip) => { let o = n, i = 2; while (PJ.list.some(p => p.id !== skip && p.name.toLowerCase() === o.toLowerCase())) o = `${n} (${i++})`; return o; };
const pjSave = () => BOOTED && !TAB.sat ? idb('readwrite', st => st.put({v: 1, cur: PJ.cur, list: PJ.list, gone: PJ.gone}, 'projects')).catch(() => {}) : Promise.resolve();
const pjDrop = id => { const N = syNames(id); return idb('readwrite', st => { ['proj:' + id, 'h:' + id, 'bk:' + id, 'fav:' + id, 'rec:' + id, 'syncBase' + N.key, 'syncCache' + N.key].forEach(k => st.delete(k)); st.delete(bkRange(id)); return st.count(); }).catch(() => {}); };
function pjShow() {
  const p = pjCur(), i = $('#pjName'); if (!p || !i) return;
  if (document.activeElement !== i) i.value = p.name; i.size = Math.max(6, i.value.length + 1); document.title = p.name + ' · Gestor de papers';
}
const pjIdle = () => new Promise(ok => { const t = () => SY.busy ? setTimeout(t, 100) : ok(); t(); });   // espera a que termine la sincronización en curso
async function pjLeave() {   // antes de cambiar de proyecto: lo pendiente se guarda en su archivo (con autoguardado), se sube a Drive y queda su copia de trabajo
  clearTimeout(timer); if (auto && handle && dirty) await save(false);
  await pjIdle(); PJ.left = syAuto() && (dirty || SY.tm) ? PJ.cur : null;   // no se espera a Drive: se sube en segundo plano al abrir el otro
  clearTimeout(SY.tm); SY.tm = 0; await sessionNow();
  if (VWB.sats.size) { vwBc({t: 'bye', pj: PJ.cur}); VWB.sats.clear(); }   // el visor de otra pestaña pasa a guardar él mismo
}
async function pjLoad(id, text, file, h) {   // abre un proyecto: su copia de trabajo (o el texto de un archivo) con los ajustes comunes
  const r = text == null ? await idb('readonly', st => st.get('proj:' + id)).catch(() => null) : null;
  let d = null; try { d = text != null ? JSON.parse(text) : await projData(r); } catch (e) {}
  if (!d || typeof d !== 'object') d = {version: 1, sections: [], tags: [], papers: [], trash: []};
  if (text == null || !d.settings) d.settings = structuredClone(db.settings);
  PJ.cur = id; pjShow();
  if (PJ.left && PJ.left !== id) { const l = PJ.left; setTimeout(() => syStoredSoon(l), 50); } PJ.left = null;
  if (!await loadText(JSON.stringify(d), text != null ? file : r && typeof r.path === 'string' ? r.path : null, true))
    await loadText(JSON.stringify({version: 1, sections: [], tags: [], papers: [], trash: [], settings: db.settings}), null, true);
  handle = h || null; if (text == null) { dirty = !!(r && r.dirty); try { if (FSA) handle = await idb('readonly', st => st.get('h:' + id)) || null; } catch (e) {} }
  if (auto) { try { auto = !!handle && await handle.requestPermission({mode: 'readwrite'}) === 'granted'; } catch (e) { auto = false; } }   // el autoguardado sigue en el archivo de este proyecto
  if (!syOn()) $('#auto').checked = auto;
  if (h) rememberHandle(); hdr(); await sessionNow();
  if (text != null) syLoaded(); else if (syAuto()) sySoon(300);
  bkDaily(); favLoad(); tabHello();
}
async function pjOpen(id) {   // cambiar de proyecto (menú ▾ de la cabecera)
  ctxClose(); const p = PJ.list.find(x => x.id === id); if (!p || id === PJ.cur) return;
  if (p.remote && !syOn()) return toast('Este proyecto está en Google Drive: conecta 🔄 para abrirlo.');
  await pjLeave(); await SY_BG.get(id); await pjLoad(id);   // si aún se estaba subiendo, se espera a que acabe
  toast(`Proyecto «${p.name}»${p.remote ? ': descargando de Google Drive…' : ''}`, [], 2500);
}
async function pjNew() {
  ctxClose(); await pjLeave();
  const id = uid(); PJ.list.push({id, name: pjUnique('Proyecto nuevo'), created: new Date().toISOString()});
  await pjLoad(id); pjEdit();
}
function pjEdit() { const i = $('#pjName'); i.focus(); i.select(); }
async function pjOpenFile(text, name, h) {   // un archivo JSON se abre como proyecto: el suyo si ya lo es; si no, uno nuevo con el nombre del archivo
  try { validate(JSON.parse(text)); } catch (e) { say('Archivo no válido (se mantienen los datos actuales): ' + e.message); return false; }
  finally { syncTypes(db.settings.customTypes); syncStyles(db.settings.customStyles, db.settings.export); }   // validate() cambia los tipos y estilos globales
  const d = JSON.parse(text), ex = PJ.list.length === 1 && path === 'ejemplo_papers.json' && !dirty;   // solo está el ejemplo sin tocar: el archivo ocupa su lugar, con sus ajustes
  let id = ex ? PJ.cur : null;
  if (!id) for (const p of PJ.list) {
    if (h) { const k = await idb('readonly', st => st.get('h:' + p.id)).catch(() => null); if (k && await k.isSameEntry(h).catch(() => false)) { id = p.id; break; } }
    else if (p.id === PJ.cur ? path === name : p.file === name) { id = p.id; break; }
  }
  const p = PJ.list.find(x => x.id === id);
  if (p && !ex && (p.id === PJ.cur ? dirty : p.dirty) && !await askOk(`El proyecto «${p.name}» tiene cambios sin guardar. ¿Descartarlos y cargar el archivo?`)) return false;
  if (!ex) {   // ajustes comunes; del archivo solo se añaden los tipos, estilos y plantillas que no estén (los pueden usar sus papers)
    const o = structuredClone(db.settings);
    for (const k of ['customTypes', 'customStyles', 'templates']) { const have = new Set(o[k].map(x => x.id)); for (const x of Array.isArray(d.settings?.[k]) ? d.settings[k] : []) if (x && x.id && !have.has(x.id)) o[k].push(x); }
    d.settings = o;
  }
  if (id !== PJ.cur) await pjLeave();
  if (!id) { id = uid(); PJ.list.push({id, name: pjUnique(pjNameFor(name)), created: new Date().toISOString()}); }
  else if (ex) pjCur().name = pjUnique(pjNameFor(name), id);
  await pjLoad(id, JSON.stringify(d), name, h);
  return true;
}
async function pjRename(v) {   // el nombre se escribe en la cabecera; el archivo JSON pasa a llamarse igual
  const p = pjCur(), n = v.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!n || n === p.name) return pjShow();
  p.name = pjUnique(n, p.id); pjShow(); pjSave(); sessionSoon(); if (syAuto()) sySoon();
  if (!path || path === pjFile(p.name)) return;
  if (!FSA) { path = pjFile(p.name); return hdr(); }   // sin acceso directo a archivos, la próxima descarga ya sale con el nombre nuevo
  if (handle && handle.move) try { if (await handle.requestPermission({mode: 'readwrite'}) === 'granted') { await handle.move(pjFile(p.name)); path = handle.name; rememberHandle(); hdr(); sessionSoon(); return; } } catch (e) {}
  if (handle) { toast(`El archivo «${path}» se queda como estaba: al guardar se creará «${pjFile(p.name)}».`, [], 6000); handle = null; idb('readwrite', st => st.delete('h:' + p.id)).catch(() => {}); }
  path = null; hdr(); sessionSoon();
}
async function pjDel() {
  ctxClose(); const p = pjCur();
  if (PJ.list.length < 2) return say('Es el único proyecto: crea otro antes de borrar este.');
  if (!await askOk(`¿Borrar el proyecto «${p.name}» de este navegador${syOn() ? ' y de tu Google Drive' : ''}?\nSus papers, notas, secciones y etiquetas desaparecen de la aplicación.${path ? `\nTu archivo «${path}» no se toca.` : '\nNo tiene archivo JSON: si quieres conservarlo, antes pulsa «Guardar como».'}`)) return;
  clearTimeout(timer); await pjIdle(); clearTimeout(SY.tm); SY.tm = 0;
  const id = p.id; PJ.list = PJ.list.filter(x => x.id !== id); PJ.gone.push(id);
  await pjLoad(PJ.list[0].id); await pjDrop(id); pjSave(); if (syAuto()) sySoon(300);
  toast(`Proyecto «${p.name}» borrado.`, [], 4000);
}
async function pjGone(id) {   // otro dispositivo borró el proyecto abierto
  const p = PJ.list.find(x => x.id === id); if (!p || PJ.cur !== id) return;
  PJ.list = PJ.list.filter(x => x.id !== id); await pjLoad(PJ.list[0].id); await pjDrop(id); pjSave();
  toast(`El proyecto «${p.name}» se borró en otro dispositivo. Ahora estás en «${pjCur().name}».`, [], 8000);
}
function pjMenu(e) {
  e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(), L = [...PJ.list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  ctxShow({preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4}, '<div class="ctxh">Proyectos</div>'
    + L.map(p => `<button class="pji" data-onclick="pjOpen('${p.id}')">${tick(p.id === PJ.cur)}${esc(p.name)} <small>${p.remote ? '☁ en Google Drive' : (p.id === PJ.cur ? db.papers.length : p.n || 0) + ' papers'}</small></button>`).join('')
    + '<hr><button data-onclick="pjNew()">＋ Nuevo proyecto</button><button data-onclick="ctxClose();doOpen()">📂 Abrir un JSON como proyecto…</button><button data-onclick="ctxClose();pjEdit()">✏️ Cambiar el nombre</button>' + (handle ? `<button data-onclick="pjReload()" title="Vuelve a leer «${esc(path || '')}» del disco (descarta lo que no hayas guardado)">↻ Volver a leer «${esc(path || '')}»</button>` : '') + (() => { const n = [...SEL].filter(id => db.papers.some(p => p.id === id)).length; return `<button data-onclick="ctxClose();psOpen()" title="${n ? 'Copiar o mover los papers seleccionados a otro de tus proyectos' : 'Primero marca papers con su casilla «Seleccionar»'}">📦 Copiar o mover ${n ? n + ' seleccionado' + (n === 1 ? '' : 's') : 'los seleccionados'} a otro proyecto…</button>`; })() + '<button data-onclick="ctxClose();dpOpen()">🔍 Buscar duplicados…</button><button data-onclick="bkOpen()">🕘 Copias de seguridad…</button><button class="danger" data-onclick="pjDel()">🗑 Borrar este proyecto…</button>');
}
/* ===== Varias pestañas =====
   Dos pestañas con el mismo proyecto escribirían la misma copia de trabajo y el mismo archivo, y ganaría la última sin avisar.
   Cada pestaña dice qué proyecto abre (BroadcastChannel «gpapers»); si otra ya lo tiene, esta queda en pausa (sin guardar ni sincronizar)
   con un aviso y «Usar en esta pestaña»: la otra guarda lo pendiente, se pone en pausa y esta recarga con lo último. */
const TAB = {id: uid(), at: 0, passive: false, bc: 'BroadcastChannel' in window ? new BroadcastChannel('gpapers') : null, wait: null};
const tabSend = (t, x = {}) => { try { TAB.bc?.postMessage({t, from: TAB.id, proj: PJ.cur, ...x}); } catch (e) {} };
const tabHello = () => { if (!TAB.passive) { TAB.at = Date.now(); tabSend('hi', {at: TAB.at}); } };   // at: cuándo abrió el proyecto (si dos lo abren a la vez, se queda el primero)
function tabPause(by) {   // esta pestaña deja de escribir: el proyecto se usa en otra
  TAB.passive = true; clearTimeout(timer); clearTimeout(tSes); clearTimeout(SY.tm); SY.tm = 0;
  let o = $('#tabLock'); if (!o) { o = document.createElement('div'); o.id = 'tabLock'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-modal', 'true'); document.body.appendChild(o); }
  o.innerHTML = `<div class="tlb"><h2>Proyecto abierto en otra pestaña</h2><p>«${esc(pjCur()?.name || '')}» ${by ? 'se está usando' : 'ya está abierto'} en otra pestaña de este navegador. Para no pisar los cambios de una con los de la otra, esta pestaña queda en pausa: no guarda ni sincroniza.</p>`
    + `<div class="row"><button class="pri" data-onclick="tabTake()">Usar en esta pestaña</button></div><small>La otra pestaña guardará lo pendiente y quedará en pausa. También puedes cerrar esta.</small></div>`;
  o.hidden = false; o.querySelector('button').focus();
}
function tabTake() {   // pide el proyecto a la otra pestaña y recarga con lo que ella haya guardado (si no contesta, se recarga igual)
  const go = () => { clearTimeout(TAB.wait); RELOADING = true; location.reload(); };
  TAB.wait = setTimeout(go, 2000); TAB.go = go; tabSend('take');
}
if (TAB.bc) TAB.bc.onmessage = async ({data: m}) => {
  if (!m || m.from === TAB.id || !BOOTED) return;
  if (m.t === 'given' && m.to === TAB.id) return TAB.go?.();
  if (m.proj !== PJ.cur) return;
  if (m.t === 'hi' && TAB.wasSat && !TAB.passive) { await sessionNow(); return vwSatYield(); }   // vuelve la pestaña principal: el visor aparte le deja el proyecto
  if (m.t === 'hi' && !TAB.passive) { if (TAB.at < m.at || TAB.at === m.at && TAB.id < m.from) tabSend('here', {to: m.from}); else tabPause(false); }
  else if (m.t === 'here' && m.to === TAB.id && !TAB.passive) tabPause(false);
  else if (m.t === 'take' && !TAB.passive) {
    try { clearTimeout(timer); if (auto && handle && dirty) await save(false); await sessionNow(); uiNow(); } catch (e) {}
    tabPause(true); tabSend('given', {to: m.from});
  }
};
document.addEventListener('keydown', e => { if (TAB.passive && !TAB.sat && !e.target.closest?.('#tabLock')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // en pausa, los atajos no cambian nada
