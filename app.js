'use strict';
/* ===== Eventos: lo que usan los data-on… del HTML (ver «Eventos de la interfaz» en js/modelo.js) =====
   ON_VARS da acceso a las variables y funciones flecha (const/let no están en window); las funciones normales se encuentran solas. */
const ON_VARS = {
  get $() { return $; }, get F() { return F; }, get D() { return D; }, get DATA_ALL() { return DATA_ALL; }, get GR() { return GR; }, get LK() { return LK; }, get SV() { return SV; },
  get CU() { return CU; }, get CTS() { return CTS; }, get DP_IGN() { return DP_IGN; }, get ALL_FOLD() { return ALL_FOLD; }, get CITE_OPEN() { return CITE_OPEN; },
  get HELP_OPEN() { return HELP_OPEN; }, get CFG_OPEN() { return CFG_OPEN; }, get ctxClose() { return ctxClose; }, get fmClose() { return fmClose; }, get svSave() { return svSave; }, get syAuto() { return syAuto; },
};
function put(o, k, v, then) { o[k] = v; if (then) then(); }   // asigna y, si se pide, redibuja: put(F,'mode',this.value,render)
function setHas(S, id, on) { on ? S.add(id) : S.delete(id); uiSoon(); }   // bloques plegables que se recuerdan
function onEnter(e, fn, ...a) { if (e.key === 'Enter') fn(...a); }
function lines(v) { return v.split('\n').map(s => s.trim()).filter(Boolean); }
function noBtnFocus(e) { if (e.target.tagName === 'BUTTON') e.preventDefault(); }   // los botones de la barra de formato no quitan el foco al texto
function imgErr(el) { el.outerHTML = '<span class="imgx" title="No se pudo cargar la imagen">⚠</span>'; }
function viewToggle() { setView(db.settings.view === 'table' ? 'cards' : 'table'); }
function pjSize(el) { el.size = Math.max(6, el.value.length + 1); }
function pjKey(e, el) { if (e.key === 'Enter') el.blur(); else if (e.key === 'Escape') { el.value = pjCur().name; el.blur(); } }
function sortSet(i, k) { F.sorts[i].k = k; render(); }
function sortFlip(i) { F.sorts[i].d *= -1; render(); }
function sortDel(i) { F.sorts.splice(i, 1); render(); }
function sortAdd(k) { F.sorts.push({k, d: 1}); render(); }
function exsSet(v) { EXS = v; drawEx(); }
function tabSet(k) { tab = k; drawD(); }
function dataAllSet(v) { DATA_ALL = v; uiSoon(); drawD(); }
function dRate(n) { D.rating = D.rating === n ? 0 : n; drawD(); }
function noteSec(i, v) { D.notes[i].sectionId = v; drawD(); }
function noteDel(i) { D.notes.splice(i, 1); drawD(); }
function citeDel(k) { delete D.cites[k]; drawD(); }
function clocSet(v) { CLOC = v; drawIT(); }
function citeSelSet(v) { CITE_SEL = v; drawD(); }
function citeAllOn() { CITE_ALL = true; drawD(); }
function reltSet(v) { RELT = v; relSearch(); }
function recActSet(a) { recAct = a; drawCfg(); }
function cuPick(id) { CU.id = id; CU.type = '*'; drawCfg(); }
function impOn(i, on) { IMP.refs[i].on = on; impCount(); }
function mgAdd(id) { db[MG].push({id, name: 'Nueva', color: '#2457c5', tagIds: []}); markDirty(); drawMg(); }

/* ===== Datos de la aplicación (PWA): copia de la sesión y estado de la interfaz, en IndexedDB =====
   Aparte del JSON, la app guarda (1) una copia de trabajo, para reabrir justo donde lo dejaste aunque no hayas guardado, y
   (2) el estado de la interfaz (filtros, orden, barra lateral, bloques plegados). Viven fuera de la caché de la aplicación,
   así que las actualizaciones no los tocan y no hace falta borrar datos para recibir una versión nueva. */
const APP_V = '36.1';   // debe coincidir con la versión de sw.js
let BOOTED = false, RELOADING = false, SWREG = null, tSes = 0, tUi = 0, lastUi = '';
const sessionNow = () => { clearTimeout(tSes); if (!BOOTED) return Promise.resolve();   // copia de trabajo del proyecto abierto (y la lista de proyectos)
  const p = pjCur(); if (p) { Object.assign(p, {n: db.papers.length, file: path, dirty}); delete p.remote; }
  return idb('readwrite', st => { st.put({v: 1, cur: PJ.cur, list: PJ.list, gone: PJ.gone}, 'projects'); return st.put({v: 1, path, dirty, at: new Date().toISOString(), json: dbJSON()}, 'proj:' + PJ.cur); }).catch(() => {}); };
const sessionSoon = () => { clearTimeout(tSes); tSes = setTimeout(sessionNow, 700); };
const uiState = () => ({v: 1, F: {sorts: F.sorts, group: F.group, sec: F.sec, tags: [...F.tags], read: F.read, minRating: F.minRating, inNotes: F.inNotes, mode: F.mode, tbSec: F.tbSec, tbTag: F.tbTag, ...fExtra()},
  side: {min: $('#side').classList.contains('min'), w: sbW(), fold: [...document.querySelectorAll('#side .sg.fold')].map(e => e.id), more: !$('#sg-more').classList.contains('fold'), ff: [...document.querySelectorAll('#sg-filt .fs.fold')].map(e => e.id)}, cite: CITE_SEL, dataAll: DATA_ALL, citeOpen: [...CITE_OPEN], allFold: [...ALL_FOLD], cfg: [...CFG_OPEN], help: [...HELP_OPEN]});
const uiNow = () => { clearTimeout(tUi); if (!BOOTED) return Promise.resolve(); const s = JSON.stringify(uiState()); if (s === lastUi) return Promise.resolve(); lastUi = s; return idb('readwrite', st => st.put(JSON.parse(s), 'ui')).catch(() => {}); };
const uiSoon = () => { clearTimeout(tUi); tUi = setTimeout(uiNow, 500); };
function applyUI(u) {   // lo guardado nunca se fía: cada dato se valida contra el estado actual (un paper o etiqueta borrados no rompen nada)
  if (!u || u.v !== 1) return; const f = u.F || {}, strs = a => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.length < 40).slice(0, 40);
  const so = (Array.isArray(f.sorts) ? f.sorts : []).filter(x => x && Object.hasOwn(SORTS, x.k) && (x.d === 1 || x.d === -1)).slice(0, 3); if (so.length) F.sorts = so.map(x => ({k: x.k, d: x.d}));
  F.group = !!f.group; F.sec = db.sections.some(s => s.id === f.sec) ? f.sec : ''; F.tags = new Set(strs(f.tags).filter(id => db.tags.some(t => t.id === id)));
  F.read = Object.hasOwn(READ, f.read) ? f.read : ''; F.minRating = Number.isInteger(f.minRating) && f.minRating >= 0 && f.minRating <= 5 ? f.minRating : 0; F.inNotes = !!f.inNotes; F.mode = f.mode === 'all' ? 'all' : 'any'; F.tbSec = !!f.tbSec; F.tbTag = f.tbTag !== false; fExtraLoad(f);
  const sd = u.side || {}; $('#side').classList.toggle('min', !!sd.min); sbWidth(Number.isFinite(sd.w) ? sd.w : 0); document.querySelectorAll('#side .sg').forEach(e => e.classList.toggle('fold', strs(sd.fold).includes(e.id)));
  $('#sg-more').classList.toggle('fold', sd.more !== true); ['sec', 'tag', 'read'].forEach(k => fsToggle(k, strs(sd.ff).includes('fs-' + k))); $('#sg-more .shm').setAttribute('aria-expanded', sd.more === true);
  CITE_SEL = typeof u.cite === 'string' && STYLES[u.cite] ? u.cite : ''; DATA_ALL = u.dataAll === true; strs(u.citeOpen).filter(g => STY_G.some(([x]) => (x || 'gen') === g)).forEach(g => CITE_OPEN.add(g)); strs(u.allFold).forEach(x => ALL_FOLD.add(x)); strs(u.cfg).forEach(x => CFG_OPEN.add(x)); strs(u.help).forEach(x => HELP_OPEN.add(x));
  $('#grpChk').checked = F.group; render();
}
function toast(msg, acts = [], ms = 8000) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${acts.map((a, i) => `<button data-i="${i}">${esc(a.t)}</button>`).join('')}<button data-x aria-label="Cerrar">✕</button>`; t.hidden = false; clearTimeout(t.tm);
  t.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x != null) t.hidden = true; else acts[+b.dataset.i].fn(); };
  if (ms) t.tm = setTimeout(() => t.hidden = true, ms);
}
async function forgetAppData() {
  const n = PJ.list.filter(p => !p.remote).length;
  if (!confirm(`Se borrarán de este navegador ${n === 1 ? 'el proyecto' : `los ${n} proyectos`} (copias de trabajo) y el estado de la interfaz. Tus archivos JSON y tu Google Drive no se tocan: guarda antes lo que no tengas guardado. ¿Continuar?`)) return;
  BOOTED = false; clearTimeout(tSes); clearTimeout(tUi);
  const ks = await idb('readonly', st => st.getAllKeys()).catch(() => []);
  await idb('readwrite', st => { ks.filter(k => typeof k === 'string' && /^(session|ui|projects|proj:|h:|bk:|fav:|rec:|sync)/.test(k)).forEach(k => st.delete(k)); return st.count(); }).catch(() => {});
  toast('Datos de este navegador borrados. La próxima vez la aplicación arrancará limpia.');   // en esta pestaña ya no se guarda nada más
}
const reloadApp = async () => { RELOADING = true; await sessionNow(); await uiNow(); location.reload(); };
function checkUpdate() {
  if (!SWREG) return toast('Las actualizaciones solo funcionan con la aplicación instalada o abierta desde la web (no desde un archivo local).');
  SWREG.update().then(() => toast('Buscando versión nueva… si la hay, aparecerá un aviso para recargar.', [], 4000)).catch(() => toast('No se pudo comprobar (¿sin conexión?).'));
}
async function bootApp() {
  navigator.storage?.persist?.().catch(() => {});   // pide que el navegador no borre estos datos por falta de espacio
  let ses = null, ui = null, pj = null, old = false; try { pj = await idb('readonly', st => st.get('projects')); ui = await idb('readonly', st => st.get('ui')); } catch (e) {}
  const okId = x => x && typeof x.id === 'string' && /^[a-z0-9]+$/.test(x.id) && typeof x.name === 'string';
  if (pj && pj.v === 1 && Array.isArray(pj.list) && pj.list.some(okId)) {   // proyectos guardados: se abre el último
    PJ.list = pj.list.filter(okId); PJ.cur = PJ.list.some(p => p.id === pj.cur && !p.remote) ? pj.cur : (PJ.list.find(p => !p.remote) || PJ.list[0]).id; PJ.gone = Array.isArray(pj.gone) ? pj.gone.filter(x => typeof x === 'string') : [];
    try { ses = await idb('readonly', st => st.get('proj:' + PJ.cur)); } catch (e) {}
  } else { try { ses = await idb('readonly', st => st.get('session')); old = !!ses; } catch (e) {} }   // versión anterior (una sola biblioteca): pasa a ser el primer proyecto
  let restored = false;
  if (ses && ses.v === 1 && typeof ses.json === 'string' && await loadText(ses.json, typeof ses.path === 'string' ? ses.path : null, true)) {
    restored = true; dirty = !!ses.dirty; if (old) PJ.list[0].name = pjNameFor(path); hdr();
    try { const h = FSA && (await idb('readonly', st => st.get('h:' + PJ.cur)) || old && await idb('readonly', st => st.get('last'))); if (h && ses.path && h.name === ses.path) handle = h; } catch (e) {}
    toast(dirty ? `Sesión recuperada con cambios sin guardar${ses.path ? ' de «' + ses.path + '»' : ''}. Guarda para no perderlos.` : `Sesión recuperada${ses.path ? ': «' + ses.path + '»' : ''}.`, [], 6000);
  } else {
    syBaseSet(syNames(PJ.cur), null);   // no hay copia de trabajo: lo que se abra ahora no es lo último sincronizado
    if (!pj && location.protocol.startsWith('http')) try { const r = await fetch('ejemplo_papers.json'); if (r.ok && !dirty && !db.papers.length) await loadText(await r.text(), 'ejemplo_papers.json', true); } catch (e) {}   // la primera vez se abre el ejemplo
    if (!pj) PJ.list[0].name = pjNameFor(path);
  }
  pjShow(); instShow(); applyUI(ui); BOOTED = true; lastUi = JSON.stringify(uiState()); if (restored) uiNow();
  if (pj && !restored) pjSave(); else await sessionNow();
  if (old) { if (handle) rememberHandle(); idb('readwrite', st => st.delete('session')).catch(() => {}); }
  bkDaily(); favLoad();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { sessionNow(); uiNow(); } });
addEventListener('pagehide', () => { sessionNow(); uiNow(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {   // PWA (no aplica en file://); se comprueba si hay versión nueva al volver a la aplicación y cada media hora
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(reg => { SWREG = reg; setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); }); }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !RELOADING) toast('Hay una versión nueva de la aplicación.', [{t: 'Recargar ahora', fn: reloadApp}], 0); });
}
bootApp().then(() => { syIcon(); try { const t = JSON.parse(localStorage.getItem(SY_TOK)); if (t && t.exp > Date.now()) syTokWatch(t.exp); } catch (e) {}
  if (syOn() && syP().cid !== SY_CFG.clientId) {   // la sesión era de otro proyecto de Google (otra carpeta oculta): hay que dar permiso al nuevo una vez
    SY.st = 'reconnect'; SY.consent = true; syIcon(); toast('La sincronización con Google Drive ha cambiado de proyecto: pulsa «Conectar» y da permiso una vez. Tus datos siguen aquí.', [{t: 'Conectar', fn: syConnect}], 0);
  } else if (syAuto()) syRun(false); });   // con la sesión de Google Drive recordada, se trae lo último al abrir
render();
lastSnap = snapDb();
applySettings();
if (!FSA && !syOn()) { $('#auto').disabled = true; $('#auto').parentElement.title = 'El autoguardado del archivo solo está disponible en Chrome o Edge de escritorio (en cualquier navegador, con Google Drive 🔄)'; }
if (syOn()) $('#auto').checked = syAuto();
$('#cfg').addEventListener('close', () => { recAct = null; });
document.addEventListener('scroll', e => {   // la cabecera fija de un diálogo se estrecha al bajar (con histéresis para que no parpadee)
  const d = e.target, h = d.tagName === 'DIALOG' && d.querySelector(':scope > .dh'); if (!h) return;
  if (d.scrollTop > 40) h.classList.add('sm'); else if (d.scrollTop < 10) h.classList.remove('sm');
}, true);
