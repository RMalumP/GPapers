'use strict';
/* ===== Visor de PDF con subrayados, notas y comentarios (v39) — 1 de 4: abrir y cerrar, posición, caché, páginas y zoom =====
   (v40: el visor está repartido en js/visor.js, js/visor-anotar.js, js/visor-mas.js y js/visor-modos.js, que se cargan seguidos)
   Se abre dentro de la aplicación (una ventana a pantalla completa) con los botones 📄 de las tarjetas, la tabla, la ficha del paper y la bandeja
   «PDF por citar». PDF.js (lib/pdfjs, de Mozilla) solo se descarga la primera vez que se abre un PDF y queda en la caché del service worker:
   la lista de papers no carga nada más. Solo se pintan las páginas que se ven (y las de al lado) y se liberan las que quedan lejos.
   Las anotaciones van en la biblioteca (campo «ann» del PDF: ver annClean en js/modelo.js), así se guardan, se deshacen y se sincronizan con Drive
   como el resto. El PDF no se toca: «Descargar PDF anotado» (y la copia del Drive normal, Configuración) escriben las anotaciones dentro del archivo
   como anotaciones estándar (resaltado con su color y su comentario, nota adhesiva), que se ven en Acrobat, Foxit y cualquier lector (js/visor.js, vwPdfOut).
   Desde file:// el navegador no deja cargar PDF.js (módulos): se abre el visor del navegador, como antes. */
const VW_COLORS = [['#ffd400', 'Amarillo'], ['#5fd068', 'Verde'], ['#4dabf7', 'Azul'], ['#ff6b6b', 'Rojo'], ['#b197fc', 'Morado']];
/* v40.7: en el móvil, la paleta de la barra de herramientas se pliega en el color elegido (si no, los nombres de los botones no caben y se montan):
   al tocarlo se abren los cinco; al elegir uno, o al tocar fuera, se vuelve a plegar. En el ordenador no cambia nada. */
const vwSwBar = fn => VW_COLORS.map(([c, t], i) => `<button class="vwc" data-c="${i}" style="--c:${c}" title="${t}" aria-label="Color ${t}" data-onclick="vwSw(event,${i},'${fn}')"></button>`).join('');
function vwSw(e, i, fn) {
  const cs = e?.target?.closest?.('.vwcs'), b = e?.target?.closest?.('.vwc');
  if (cs && document.documentElement.classList.contains('mv') && !cs.classList.contains('open') && b?.classList.contains('on')) { cs.classList.add('open'); return; }
  cs?.classList.remove('open'); (fn === 'epColor' ? epColor : vwColor)(i);
}
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.vwtb .vwcs')) document.querySelectorAll('.vwtb .vwcs.open').forEach(x => x.classList.remove('open')); }, true);
const VW_LIB = 'lib/pdfjs/', VW_GAP = 12;
const VW = {open: false, tab: 'ann', kind: '', src: null, file: null, doc: null, pages: [], scale: 1, fit: true, mode: 'sel', color: 0, cur: 0, io: null, queue: new Set(), busy: false,
  sel: null, pop: null, foreign: null, filt: '', pushed: false, gen: 0, find: {q: '', hits: [], i: -1, txt: new Map()}, side: false, dirty: false, startPage: 0};
let PDFJS = null, PDFLIBP = null;
const vwCan = () => !window.VW_NATIVE && /^https?:$/.test(location.protocol);   // desde file:// no se pueden cargar módulos (VW_NATIVE: pruebas del visor del navegador)
const vwUrl = f => new URL(VW_LIB + f, document.baseURI).href;
async function vwLib() {
  if (!PDFJS) { PDFJS = await import(vwUrl('pdf.min.mjs')); PDFJS.GlobalWorkerOptions.workerSrc = vwUrl('pdf.worker.min.mjs'); }
  return PDFJS;
}
const vwPdfLib = () => PDFLIBP ??= window.PDFLib ? Promise.resolve(window.PDFLib) : new Promise((ok, ko) => {   // pdf-lib, solo para escribir el PDF anotado
  const s = document.createElement('script'); s.src = 'lib/pdf-lib.min.js'; s.onload = () => ok(window.PDFLib); s.onerror = () => { PDFLIBP = null; ko(Error('No se pudo cargar pdf-lib')); }; document.head.appendChild(s); });
const vw$ = s => document.querySelector('#vw ' + s);
const vwNow = () => new Date().toISOString();

/* ---- De dónde viene el PDF y dónde se guardan sus anotaciones ----
   src = {kind: 'paper', id, n} | {kind: 'inbox', id}. Con la ficha del paper abierta, también se apuntan en el borrador (si no, al guardarla se perderían). */
function vwHolders() {
  const s = VW.src; if (!s) return [];
  if (s.kind === 'inbox') { const it = (db.inbox || []).find(x => x.id === s.id); return it ? [it] : []; }
  const f = pdfF(s.n), P = db.papers.find(p => p.id === s.id), out = [];
  if (D && D.id === s.id && $('#dlg').open && D[f]) out.push(D[f]);
  if (P && P[f] && !out.includes(P[f])) out.push(P[f]);
  return out;
}
const vwAnns = () => { const h = vwHolders()[0]; return h && Array.isArray(h.ann) ? h.ann : []; };
const vwPaper = () => VW.src?.kind === 'paper' ? (D && D.id === VW.src.id && $('#dlg').open ? D : db.papers.find(p => p.id === VW.src.id)) : null;
function vwTitle() {
  const p = vwPaper(); if (p) return (p.alias || p.title || '').trim() || p[pdfF(VW.src.n)]?.name || 'PDF';
  const it = VW.src && (db.inbox || []).find(x => x.id === VW.src.id); return it ? it.name : 'PDF';
}
function vwMut(fn, quiet) {   // cambia las anotaciones (en todos sus sitios), lo apunta para deshacer y sincronizar, y repinta
  const hs = vwHolders(); if (!hs.length) return;
  for (const h of hs) { if (!Array.isArray(h.ann)) h.ann = []; fn(h.ann); if (VW.src.kind === 'inbox') h.up = vwNow(); }
  const P = VW.src.kind === 'paper' && db.papers.find(p => p.id === VW.src.id); if (P && hs.includes(P[pdfF(VW.src.n)])) P.modified = vwNow();
  annAutoSync(VW.src); VW.dirty = true; markDirty(); if (!quiet) vwDrawAnn(); vwSatPush();
}
const vwAdd = a => vwMut(l => l.push(structuredClone(a)));
const vwUpd = (id, o, quiet) => vwMut(l => { const a = l.find(x => x.id === id); if (a) Object.assign(a, o, {up: vwNow()}); }, quiet);
const vwDel = id => vwMut(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); });

/* ---- Abrir y cerrar ---- */
function vwBuild() {
  if ($('#vw')) return;
  const sw = VW_COLORS.map(([c, t], i) => `<button class="vwc" data-c="${i}" style="--c:${c}" title="${t}" aria-label="Color ${t}" data-onclick="vwColor(${i})"></button>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<dialog id="vw" aria-label="Visor de PDF">
    <div class="vwh"><button class="vwib" data-onclick="vwClose()" title="Volver a la lista (Esc)" aria-label="Volver">←</button><b class="vwt"></b>
      <span class="vwpg"><input id="vwPg" type="number" min="1" aria-label="Página" data-onchange="vwGoN(this.value)" data-onkeydown="onEnter(event,vwGoN,this.value)"><span id="vwPn"></span></span><small id="vwLeft" class="lnleft" hidden></small>
      <span class="vwz"><button class="vwib" data-onclick="vwZoomBy(0.8333)" title="Alejar (Ctrl + −)" aria-label="Alejar">−</button><button id="vwZl" class="vwzl" data-onclick="vwFitW()" title="Ajustar al ancho">100 %</button><button class="vwib" data-onclick="vwZoomBy(1.2)" title="Acercar (Ctrl + +)" aria-label="Acercar">＋</button></span>
      <span class="vwf"><input id="vwQ" type="search" placeholder="Buscar en el PDF" aria-label="Buscar en el PDF" data-onkeydown="vwFindKey(event)" data-oninput="vwFindReset()"><span id="vwQn"></span><button class="vwib vwqL" id="vwQL" hidden data-onclick="vwPanel('find')" title="Ver todos los resultados, con su frase" aria-label="Lista de resultados">☰</button></span>
      <button class="vwib vwfb" data-onclick="vwFindToggle()" title="Buscar (Ctrl+F)" aria-label="Buscar">🔍</button>
      <button class="vwib vwlk" data-onclick="vwLockToggle()" title="Bloquear el tamaño (K)" aria-label="Bloquear el tamaño" aria-pressed="false">🔓</button>
      <button class="vwib" data-onclick="vwFs(true)" title="Pantalla completa" aria-label="Pantalla completa">⛶</button>
      <button class="vwib" id="vwMoreB" data-onclick="vwMore(event)" title="Más: descargar con las anotaciones, ficha del paper…" aria-label="Más">⋯</button></div>
    <div class="vwtb" role="toolbar" aria-label="Herramientas">
      <button class="vwm vwun" data-onclick="vwUndo()" title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><span>↶</span><small>Deshacer</small></button>
      <button class="vwm" data-m="sel" data-onclick="vwMode('sel')" title="Seleccionar texto: al soltar, elige un color para subrayarlo"><span>𝙸</span><small>Seleccionar</small></button>
      <button class="vwm" data-m="hl" data-onclick="vwMode('hl')" title="Subrayar: arrastra sobre el texto (con el dedo, el lápiz o el ratón)"><span>🖍</span><small>Subrayar</small></button>
      <button class="vwm" data-m="area" data-onclick="vwMode('area')" title="Zona: arrastra para marcar un recuadro (PDF escaneados, figuras)"><span>▭</span><small>Zona</small></button>
      <button class="vwm" data-m="note" data-onclick="vwMode('note')" title="Nota: toca la página donde quieras dejarla"><span>🗒</span><small>Nota</small></button>
      <span class="vwcs" role="group" aria-label="Color">${vwSwBar('vwColor')}</span>
      <button class="vwm vwtc" data-onclick="vwPanel('toc')" title="Índice del PDF y miniaturas de las páginas"><span>📑</span><small>Índice</small></button>
      <button class="vwm vwnb" data-onclick="vwNotes()" title="Notas del paper (generales y por sección) al lado del PDF, con todas las opciones del editor"><span>📝</span><small>Notas</small></button>
      <button class="vwm vwfsb" data-onclick="vwTbHide(true)" title="Ocultar esta barra (se vuelve a sacar con la pestaña ▾; su sitio se elige en ⋯ → Modo de lectura)"><span>▴</span><small>Ocultar</small></button>
      <button class="vwm vwfsb" data-onclick="vwFs(false)" title="Salir de pantalla completa (Esc o «atrás»)"><span>⛶</span><small>Salir</small></button>
      <button class="vwm vwsb" data-onclick="vwPanel('ann')" title="Subrayados, notas y comentarios"><span>💬</span><small>Anotaciones</small><b id="vwAn"></b></button></div>
    <div class="vwbody"><div id="vwScroll" tabindex="0" aria-label="Páginas del PDF"><div id="vwPages"></div><p id="vwLoad" class="vwload">Abriendo el PDF…</p></div><aside id="vwSide" hidden></aside></div>
    <div id="vwSel" class="vwfloat" hidden data-onmousedown="event.preventDefault()">${sw.replace(/vwColor/g, 'vwSelColor')}<button class="vwib" data-onclick="vwSelNote()" title="Subrayar y comentar" aria-label="Subrayar y comentar">💬</button><button class="vwib" data-onclick="vwSelCopy()" title="Copiar el texto" aria-label="Copiar">📋</button><button class="vwib vxacr" hidden data-onclick="vxAcr()" aria-label="¿Qué significa esta sigla?">🔤</button><button class="vwib" data-onclick="lnSelMore(false)" title="Más: copiar con la cita, definición, traducir…" aria-label="Más">⋯</button></div>
    <div id="vwPop" class="vwfloat vwpop" hidden></div>
    <button id="vwTbTab" class="vwfloat" data-onclick="vwTbHide(false)" title="Sacar la barra de herramientas" aria-label="Sacar la barra">▾</button>
    <button id="vwLock" class="vwfloat vwlk" data-onclick="vwLockToggle()" title="Bloquear el tamaño (K)" aria-label="Bloquear el tamaño" aria-pressed="false">🔓</button>
    <div id="vwPgTip" class="vwfloat" hidden></div>
    <div id="vwCol" class="vwfloat" hidden>${sw.replace(/vwColor\((\d)\)/g, 'vwColPick($1)')}</div></dialog>`);
  const d = $('#vw'), sc = $('#vwScroll');
  d.addEventListener('cancel', e => { e.preventDefault(); vwEsc(); });
  d.addEventListener('close', () => { if (VW.open) vwClose(); });   // Chrome cierra sin «cancel» si se pulsa Esc dos veces seguidas: se cierra bien igualmente
  d.addEventListener('keydown', vwKey);
  document.addEventListener('keydown', e => { if (VW.open && (e.target === document.body || e.target === document.documentElement)) vwKey(e); });   // si el foco se pierde (un botón que se repinta), los atajos siguen yendo al visor
  sc.addEventListener('scroll', () => { if (!VW.rafS) VW.rafS = requestAnimationFrame(() => { VW.rafS = 0; vwOnScroll(); }); }, {passive: true});
  sc.addEventListener('wheel', vwWheel, {passive: false});
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) sc.addEventListener(t, vwTouch, {passive: false});
  VW.ts = tsBind(d, sc, '.textLayer', {can: () => VW.mode === 'sel' && !VW.pinch, start: () => { VW.tap = null; clearTimeout(VW.lpT); }, done: vwSelShow});
  sc.addEventListener('pointerdown', vwDown); sc.addEventListener('pointermove', vwMove); sc.addEventListener('pointermove', lnHover); sc.addEventListener('pointerup', vwUp); sc.addEventListener('pointercancel', vwUp);
  document.addEventListener('selectionchange', () => { if (VW.open) { clearTimeout(VW.selT); VW.selT = setTimeout(vwSelShow, VW.mode === 'sel' ? 250 : 0); } });
  new ResizeObserver(() => { if (VW.open && VW.fit && VW.pages.length) vwFitW(true); }).observe(sc);
  window.addEventListener('popstate', e => {
    if (VW.fsSkip) { VW.fsSkip = false; return; }
    if (VW.open && VW.fsPushed) { VW.fsPushed = false; return vwFs(false); }   // «atrás» en pantalla completa: sale de ella, no del visor
    if (VW.open && VW.pushed) { VW.pushed = false; vwClose(true); } });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && VW.fs) vwFs(false); });
}
async function vwOpen(src, file) {
  vwBuild(); if (VW.open) await vwClose(false, true);
  const gen = ++VW.gen; Object.assign(VW, {open: true, src, file, doc: null, pages: [], annBy: null, foreign: null, sel: null, dirty: false, find: {q: '', hits: [], i: -1, txt: new Map()}});
  const d = $('#vw'); vw$('.vwt').textContent = vwTitle(); vw$('.vwt').title = vwTitle(); $('#vwPages').innerHTML = ''; $('#vwLoad').hidden = false; $('#vwLoad').textContent = 'Abriendo el PDF…';
  $('#vwQ').value = ''; $('#vwQn').textContent = ''; vwPopClose(); $('#vwSel').hidden = true; if (VW.sideNext) VW.tab = 'ann'; VW.side = VW.sideNext || !document.documentElement.classList.contains('mv') && innerWidth > 1100 && vwSideOn(); VW.sideNext = false; vwSideShow();
  vw$('.vwnb').hidden = src?.kind !== 'paper';
  Object.assign(VW, vwRdGet(), {cropM: null, zLock: false}); vwRdClass(); vwCropShow(); VW.theme = vwTheme(); VW.night = VW.theme === 'night'; d.classList.toggle('night', VW.night); d.classList.toggle('sepia', VW.theme === 'sepia'); lnLblApply(); d.classList.toggle('tsel', tsWant()); VW.lite = vwLiteWant(); d.classList.toggle('lite', VW.lite); VW.toc = null; VW.thIo?.disconnect();
  if (!d.open) d.showModal(); vwModeShow(); vwColorShow(); vwCount(); lnClose(); lnBackClear(); $('#vwQL').hidden = true; wlPoke(); if (P2.doc) p2Close();
  if (!VW.pushed && !VW_TAB) { try { history.pushState({vw: 1}, ''); VW.pushed = true; } catch (e) {} }   // el botón «atrás» del móvil cierra el visor
  try {
    const L = await vwLib(); if (gen !== VW.gen) return;
    const kept = vwKeepTake(src, file);   // reabrir el mismo PDF poco después de cerrarlo: ya está leído
    const doc = kept ? kept.doc : await vwLoadDoc(L, file); if (gen !== VW.gen) { if (!kept) doc.destroy(); else vwKeepPut(kept); return; }
    if (kept) VW.find.txt = kept.txt;
    VW.doc = doc; VW.rot = vwRotMap(); const p1 = await doc.getPage(1), v1 = p1.getViewport({scale: 1, rotation: ((p1.rotate || 0) + vwRot(0)) % 360}), szc = Object.keys(VW.rot).length ? null : vwSzGet(src, file, doc.numPages);
    VW.pages = Array.from({length: doc.numPages}, (_, i) => { const c = szc?.[i]; return {i, w: c ? c[0] : v1.width, h: c ? c[1] : v1.height, vp1: i ? null : v1, proxy: i ? null : p1, el: null, cv: null, rs: 0, tl: null, sized: !i}; });
    VW.szOk = !!szc; txAfterOpen(src, doc);   // el texto, para buscar desde la lista (v40)
    $('#vwLoad').hidden = true; $('#vwPn').textContent = '/ ' + doc.numPages; $('#vwPg').max = doc.numPages;
    $('#vwPages').innerHTML = VW.pages.map(p => `<div class="vwp" data-i="${p.i}"><div class="vwa"></div></div>`).join('');
    VW.pages.forEach(p => { p.el = $('#vwPages').children[p.i]; vwSize(p); });
    VW.cur = 0; vwFlipShow(); VW.fit = true; vwFitW(true);
    const pf = vwHolders()[0], start = Math.min(doc.numPages, Math.max(1, pdfPage(pf?.page) || 1)) - 1; VW.startPage = start;
    if (start) vwGo(start, true); vwPosRestore(start); vwObserve(); vwDrawAnn(); vwBmDraw(); vwOnScroll();
    if (start) toast(`Sigues en la página ${start + 1}, donde lo dejaste.`, [{t: '⏮ Ir al principio', fn: () => vwGo(0)}], 3500);
    if (!VW.szOk) vwSizes(gen); vwIdle(() => vwForeign(gen));   // v39.45: las anotaciones de otros programas, cuando el visor está quieto
    vxOnOpen(gen);   // v40.8: columna a columna, marcas, regla y texto reconocido (OCR)
    if (VW.crop) vwCropCalc(gen);   // v39.52: el recorte, también al volver a abrir (se había quedado dentro del comentario de arriba)
  } catch (e) {
    if (gen !== VW.gen) return; console.error(e);
    $('#vwLoad').innerHTML = `${e.name === 'PasswordException' ? 'El PDF está protegido con contraseña.' : 'No se pudo abrir el PDF' + (e.message ? ': ' + esc(e.message) : '.')} <button data-onclick="vwNative()">Abrir con el visor del navegador</button>`;
  }
}
function vwLoadDoc(L, file) {
  return file.arrayBuffer().then(buf => {
    const task = L.getDocument({data: new Uint8Array(buf), cMapUrl: vwUrl('cmaps/'), cMapPacked: true, standardFontDataUrl: vwUrl('standard_fonts/'), isEvalSupported: false, enableXfa: false});
    task.onPassword = (cb, why) => vwAskPass(why === 2).then(p => p == null ? task.destroy() : cb(p));
    return task.promise;
  });
}
function vwAskPass(wrong) {   // contraseña de un PDF protegido
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'ask';
    d.innerHTML = `<p>${wrong ? 'Contraseña incorrecta. ' : ''}Este PDF está protegido. Escribe su contraseña:</p><input type="password" style="width:100%;margin-bottom:12px" autocomplete="off"><div class="row"><button class="pri">Abrir</button><button>Cancelar</button></div>`;
    const end = v => { d.close(); d.remove(); res(v); }, inp = d.querySelector('input');
    d.querySelector('.pri').onclick = () => end(inp.value); d.querySelectorAll('button')[1].onclick = () => end(null);
    inp.onkeydown = e => { if (e.key === 'Enter') end(inp.value); }; d.addEventListener('cancel', e => { e.preventDefault(); end(null); });
    document.body.appendChild(d); d.showModal(); inp.focus();
  });
}
async function vwClose(fromPop, keepHist) {
  if (!VW.open) return; vwAutoStop(); if (VW.fs) vwFs(false); vwSaveComment(); vwNotesClose(true); vxFlowClose(); VX.ocrStop = true; if (!VX.ocrBusy) { VX.ocrW?.terminate?.(); VX.ocrW = VX.ocrWP = null; } vxPopClose('vxAcrPop');
  const src = VW.src; vwPageSave(true);
  if (!SAY.ep) sayStop(true); p2Close(); VW.open = false; VW.gen++; VW.io?.disconnect(); VW.queue.clear();
  for (const p of VW.pages) { try { p.task?.cancel(); } catch (e) {} p.proxy?.cleanup(); }
  if (VW.doc && src && VW.file) vwKeepPut({key: vwSrcKey(src), size: VW.file.size, doc: VW.doc, txt: VW.find.txt}); else try { VW.doc?.destroy(); } catch (e) {}
  VW.doc = null; VW.pages = []; VW.file = null; $('#vwPages').innerHTML = ''; vwPopClose(); $('#vwSel').hidden = true; lnClose(); lnBackClear(); wlSync(); vxRlShow(); vxMapDraw();
  if (!keepHist) { const d = $('#vw'); if (d.open) d.close(); }
  if (VW.pushed && !fromPop && !keepHist) { VW.pushed = false; history.back(); }
  if (RENDER_VW) { RENDER_VW = false; render(); } else if (src?.kind === 'paper' && db.papers.some(p => p.id === src.id)) renderPaper(src.id);
  if (src?.kind === 'inbox') inboxDraw();
  if ($('#dlg').open && D && src?.kind === 'paper' && D.id === src.id) drawD();
  if (VW_TAB) return vwSatClose();
  if (syAuto()) sySoon(1500);
}
/* ---- Recordar dónde ibas: la página va con el PDF del paper (campo «page», se sincroniza); la posición exacta dentro de la página, en este dispositivo.
   Se guarda al cerrar el visor y también al salir de la aplicación o cambiar de app con el visor abierto (v39.41): antes solo al cerrarlo. */
const VW_POS_K = 'gp-vw-pos';
function vwPageSave(closing) {
  if (!VW.open || !VW.src || !VW.pages.length) return; const page = VW.cur + 1, pf = vwHolders()[0];
  try { const a = vwAnchor(), o = JSON.parse(localStorage.getItem(VW_POS_K) || '{}'), k = vwSrcKey(VW.src); delete o[k];
    if (a && !VW.flip) o[k] = [a.i, Math.round(Math.max(0, Math.min(1, a.f)) * 1000) / 1000]; const ks = Object.keys(o); for (const x of ks.slice(0, Math.max(0, ks.length - 60))) delete o[x];
    localStorage.setItem(VW_POS_K, JSON.stringify(o)); } catch (e) {}
  if (pf && (pdfPage(pf.page) || 1) !== page && (page > 1 || pf.page)) {   // la página donde ibas, para volver a ella
    const hs = vwHolders(); hs.forEach(h => page > 1 ? h.page = page : delete h.page); if (hs.length) { markDirty(); if (!closing) vwSatPush(); }
  }
}
function vwPosRestore(start) {   // vuelve al mismo punto de la página (si la página guardada es la misma)
  if (VW.flip) return; try { const r = JSON.parse(localStorage.getItem(VW_POS_K) || '{}')[vwSrcKey(VW.src)];
    if (Array.isArray(r) && r[0] === start && r[1] > 0) { const p = VW.pages[start]; $('#vwScroll').scrollTop = p.el.offsetTop + r[1] * p.el.offsetHeight; } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.hidden && VW.open) vwPageSave(); });   // antes que la copia de trabajo (app.js), que la guarda
addEventListener('pagehide', () => { if (VW.open) vwPageSave(); });

/* ---- Caché para papers largos (v39.41) ----
   · Tamaños de las páginas, por PDF y en este dispositivo: al volver a abrirlo cada página sale ya con su tamaño (no hay que medirlas todas ni se mueve
     lo que lees). Solo se guardan los cambios de tamaño (tramos), así que ocupa poco aunque el PDF tenga cientos de páginas.
   · El último PDF cerrado se queda leído un rato (3 min; 1 min en el móvil): si lo vuelves a abrir, sale al instante, con la búsqueda ya preparada. */
const VW_SZ_K = 'gp-vw-sz';
function vwSzGet(src, file, n) {
  try { const r = JSON.parse(localStorage.getItem(VW_SZ_K) || '{}')[vwSrcKey(src)]; if (!r || r.n !== n || r.s !== file.size) return null;
    const out = []; for (const [c, w, h] of r.t) for (let j = 0; j < c; j++) out.push([w, h]); return out.length === n ? out : null; } catch (e) { return null; }
}
function vwSzPut() {
  if (!VW.src || !VW.file || !VW.pages.length || Object.keys(VW.rot || {}).length) return; const t = [];   // con páginas giradas no se guardan
  for (const p of VW.pages) { const w = Math.round(p.w * 100) / 100, h = Math.round(p.h * 100) / 100, l = t[t.length - 1]; if (l && l[1] === w && l[2] === h) l[0]++; else t.push([1, w, h]); }
  try { const o = JSON.parse(localStorage.getItem(VW_SZ_K) || '{}'), k = vwSrcKey(VW.src); delete o[k]; if (t.length > 400) return;   // un PDF con tamaños muy variados no se guarda
    o[k] = {n: VW.pages.length, s: VW.file.size, t}; const ks = Object.keys(o); for (const x of ks.slice(0, Math.max(0, ks.length - 40))) delete o[x];
    localStorage.setItem(VW_SZ_K, JSON.stringify(o)); } catch (e) {}
}
const VW_KEEP = {k: null, t: 0};
function vwKeepPut(k) {
  vwKeepDrop(); try { k.doc.cleanup(); } catch (e) {}   // libera lo pintado; el PDF sigue leído
  VW_KEEP.k = k; VW_KEEP.t = setTimeout(vwKeepDrop, vwMaxPx() < 6e6 ? 60e3 : 180e3);
}
function vwKeepDrop() { clearTimeout(VW_KEEP.t); const k = VW_KEEP.k; VW_KEEP.k = null; try { k?.doc.destroy(); } catch (e) {} }
function vwKeepTake(src, file) {
  const k = VW_KEEP.k; if (!k) return null;
  if (k.key !== vwSrcKey(src) || k.size !== file.size) { vwKeepDrop(); return null; }   // otro PDF: el guardado ya no sirve
  clearTimeout(VW_KEEP.t); VW_KEEP.k = null; return k;
}
function vwHoldersOf(src) { const s = VW.src; VW.src = src; try { return vwHolders(); } finally { VW.src = s; } }
let RENDER_VW = false;   // la lista no se repinta debajo del visor: se hace al cerrarlo
function vwDbChanged() {   // la biblioteca cambió (deshacer, Google Drive): se vuelven a pintar las anotaciones
  if (!VW.open) return; RENDER_VW = true; vw$('.vwt').textContent = vwTitle();
  if (!vwHolders().length) { toast('Este PDF ya no está enlazado.', [], 4000); return vwClose(); }
  vwDrawAnn(); vwBmDraw(); if (VW.pop && !vwAnns().some(a => a.id === VW.pop)) vwPopClose(); vwSatPush();
}
async function vwNative() { const f = VW.file; if (f) pdfNative(f, VW.cur + 1); }
const vwCanShare = () => { try { return !!navigator.canShare && navigator.canShare({files: [new File([''], 'a.pdf', {type: 'application/pdf'})]}); } catch (e) { return false; } };
async function vwOther(ann) {   // abrir en otra app: el menú «Compartir» del sistema (Acrobat, Drive, Foxit…); si no hay, el visor del navegador
  const pf = vwHolders()[0]; if (!VW.file) return; let f = VW.file;
  const name = (pf?.name || f.name || 'documento.pdf').replace(/\.pdf$/i, '') + (ann ? ' (anotado)' : '') + '.pdf';
  if (ann) { try { f = new File([await vwPdfOut(VW.file, vwAnns())], name, {type: 'application/pdf'}); } catch (e) { return say(e.message); } }
  else if (f.type !== 'application/pdf' || f.name !== name) f = new File([f], name, {type: 'application/pdf'});
  if (vwCanShare()) {
    try { await navigator.share({files: [f], title: vwTitle()}); return; }
    catch (e) { if (e.name === 'AbortError') return; if (e.name === 'NotAllowedError') return toast('Listo para abrir en otra app.', [{t: '📲 Abrir', fn: () => navigator.share({files: [f], title: vwTitle()}).catch(() => {})}], 8000); }   // tardó demasiado en prepararse: hace falta otro toque
  }
  pdfNative(f, VW.cur + 1);
}
function vwEsc() {
  if (vwConcTap()) return;   // modo concentración: Esc saca las barras
  const m = $('#vwMenu'); if (m && !m.hidden) { m.hidden = true; return $('#vwMoreB').focus(); }   // un menú abierto: Esc lo cierra (no el visor)
  if (lnShown()) return lnClose();
  if (!$('#vxAcrPop')?.hidden && $('#vxAcrPop')) return vxPopClose('vxAcrPop');
  if (vxFlowShown()) return vxFlowClose();   // v40.8: del texto adaptado, al PDF
  if (SAY.on && !SAY.ep) return sayStop();
  if (!$('#vwCol').hidden) return vwColClose();
  if (VW.fs) return vwFs(false);
  if (vwDocked()) return vwNotesClose();
  if (!$('#vwPop').hidden) return vwPopClose();
  if (!$('#vwSel').hidden) { getSelection().removeAllRanges(); $('#vwSel').hidden = true; return; }
  if (VW.findOpen) return vwFindToggle(false);
  vwClose();
}
function vwKey(e) {
  if (e.target.closest?.('dialog') !== $('#vw') && !(VW.open && (e.target === document.body || e.target === document.documentElement))) return;
  const inText = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable, mod = e.ctrlKey || e.metaKey, k = e.key;
  if (mod && (k === 'f' || k === 'F')) { e.preventDefault(); return vwFindToggle(true); }
  if (mod && (k === '+' || k === '=')) { e.preventDefault(); return vwZoomBy(1.2); }
  if (mod && k === '-') { e.preventDefault(); return vwZoomBy(1 / 1.2); }
  if (mod && k === '0') { e.preventDefault(); return vwFitW(); }
  if (inText) return;
  if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); vwSaveComment(); return e.shiftKey ? redo() : undo(); }
  if (mod && (k === 'y')) { e.preventDefault(); return redo(); }
  if (e.altKey && k === 'ArrowLeft' && LN.back.length) { e.preventDefault(); return lnBack(); }   // v39.50: volver después de un enlace
  if (e.altKey && k === 'ArrowRight' && LN.fwd.length) { e.preventDefault(); return lnFwd(); }   // v40.8: y adelante
  if (mod || e.altKey) return;
  if (vxFlowShown() && k !== 't' && k !== 'T') return;   // en el texto adaptado, las teclas mueven el texto (no el PDF de debajo)
  const sc = $('#vwScroll');
  if (k === ' ' && VW.auto) { e.preventDefault(); vwAutoPause(); }   // desplazamiento automático: la barra espaciadora pausa
  else if ((VW.zLock || VW.col) && /^(PageDown|PageUp|ArrowDown|ArrowUp|ArrowRight|ArrowLeft| )$/.test(k)) { e.preventDefault(); vwStep(k === 'PageUp' || k === 'ArrowUp' || k === 'ArrowLeft' || k === ' ' && e.shiftKey ? -1 : 1); }   // candado (v39.46): la hoja no se mueve, las teclas solo pasan de página
  else if (k === 'PageDown' || k === ' ' && !e.shiftKey) { e.preventDefault(); if (VW.flip && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) vwStep(1); else sc.scrollBy(0, sc.clientHeight * .9); }
  else if (k === 'PageUp' || k === ' ' && e.shiftKey) { e.preventDefault(); if (VW.flip && sc.scrollTop <= 0) vwStep(-1); else sc.scrollBy(0, -sc.clientHeight * .9); }
  else if (k === 'ArrowRight' && sc.scrollWidth <= sc.clientWidth) { e.preventDefault(); vwStep(1); }
  else if (k === 'ArrowLeft' && sc.scrollWidth <= sc.clientWidth) { e.preventDefault(); vwStep(-1); }
  else if (k === 'Home') { e.preventDefault(); vxGoH(0); } else if (k === 'End') { e.preventDefault(); vxGoH(VW.pages.length - 1); }
  else if (k === 'Delete' && VW.pop) { e.preventDefault(); vwPopDel(); }
  else if (k === 'b' || k === 'B') { e.preventDefault(); vwBmToggle(); }   // marcador en esta página
  else if (k === ']' || k === '[') { e.preventDefault(); vwBmStep(k === ']' ? 1 : -1); }
  else if ((k === 'ArrowUp' || k === 'ArrowDown') && VW.auto) { e.preventDefault(); vwAutoSpeed(k === 'ArrowUp' ? 1 : -1); }   // desplazamiento automático: ↑ ↓ cambian la velocidad
  else { const f = VW_KEYS[k.length === 1 ? k.toLowerCase() : k]; if (f) { e.preventDefault(); f[1](); } }
}
/* Más atajos del visor (v39.41). ? (o ⋯ → ⌨ Atajos de teclado) muestra todos. */
const VW_KEYS = {
  s: ['Herramienta Seleccionar', () => vwMode('sel')], h: ['Herramienta Subrayar', () => vwMode('hl')], r: ['Herramienta Zona (recuadro)', () => vwMode('area')], n: ['Herramienta Nota', () => vwMode('note')],
  1: ['Color 1 (amarillo)', () => vwColor(0)], 2: ['Color 2', () => vwColor(1)], 3: ['Color 3', () => vwColor(2)], 4: ['Color 4', () => vwColor(3)], 5: ['Color 5', () => vwColor(4)],
  '+': ['Acercar', () => vwZoomBy(1.2)], '-': ['Alejar', () => vwZoomBy(1 / 1.2)], w: ['Ajustar al ancho', () => vwFitW()],
  g: ['Ir a la página… (escribe el número)', () => { const i = $('#vwPg'); i.focus(); i.select(); }],
  i: ['Índice y miniaturas', () => vwPanel('toc')], l: ['Lista de anotaciones', () => vwPanel('ann')], e: ['Notas del paper', () => { if (!vw$('.vwnb').hidden) vwNotes(); }],
  f: ['Pantalla completa (entrar o salir)', () => vwFs(!VW.fs)], d: ['Doble página (sí o no)', () => vwRdSet('two', !VW.two)], p: ['Página a página (sí o no)', () => vwRdSet('flip', !VW.flip)], k: ['Candado del tamaño, en página a página (sí o no)', () => vwLockSet(!VW.zLock)],
  a: ['Desplazamiento automático (empezar o parar)', () => VW.auto ? vwAutoStop() : vwAutoStart()], c: ['Modo concentración (sí o no)', () => vwConcSet(!vwConcOn())],
  '?': ['Esta lista de atajos', () => vwKeysHelp()]
};
function vwKeysHelp() {
  if (!VW.menuR) VW.menuR = $('#vwMoreB').getBoundingClientRect();
  const kb = s => s.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join(' '), row = (k, t) => `<tr><td>${kb(k)}</td><td>${esc(t)}</td></tr>`;
  const fixed = [['Ctrl+F', 'Buscar en el PDF'], ['Ctrl++ Ctrl+−', 'Zoom'], ['Ctrl+0', 'Ajustar al ancho'], ['Ctrl+Z', 'Deshacer'], ['← →', 'Página (o par) anterior y siguiente'], ['RePág AvPág', 'Pantalla anterior y siguiente'], ['Inicio Fin', 'Primera y última página'],
    ['Espacio', 'Bajar una pantalla (con el automático: pausa)'], ['↑ ↓', 'Con el automático: más deprisa o más despacio'], ['B', 'Marcar o quitar el marcador'], ['Alt+← Alt+→', 'Atrás y adelante por los saltos (enlaces, índice, búsqueda, marcadores…)'], ['[ ]', 'Marcador anterior y siguiente'], ['Supr', 'Borrar la anotación abierta'], ['Esc', 'Cerrar (o salir de pantalla completa)']];
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwMoreBack()">‹ Volver</button><hr><div class="ctxh">⌨ Atajos de teclado del visor</div>
    <table class="vwkeys">${fixed.map(([k, t]) => row(k, t)).join('')}${Object.entries(VW_KEYS).map(([k, [t]]) => row(k.toUpperCase(), t)).join('')}</table>
    <div class="vwhint">Las letras funcionan fuera de los campos de texto. El tamaño del texto de la interfaz se cambia en Configuración → Apariencia (y con ${esc(db.settings.shortcuts.uiBig || '—')} / ${esc(db.settings.shortcuts.uiSmall || '—')}).</div>`);
}

/* ---- Páginas: tamaño, zoom y pintado de las que se ven ----
   Todas las medidas van en puntos del PDF multiplicados por --scale-factor (una sola variable en #vwPages): cambiar el zoom solo cambia esa
   variable y vuelve a pintar los lienzos que se ven. La capa de texto de PDF.js usa la misma variable. */
const vwSize = p => { p.el.style.width = `calc(var(--scale-factor) * ${p.w}px)`; p.el.style.height = `calc(var(--scale-factor) * ${p.h}px)`; };
async function vwSizes(gen) {   // el tamaño real de cada página (casi siempre el de la primera), poco a poco y sin mover lo que estás leyendo
  for (const p of VW.pages) {
    if (gen !== VW.gen) return; if (p.sized) continue;
    try { p.proxy ||= await VW.doc.getPage(p.i + 1); } catch (e) { return; } if (gen !== VW.gen) return;
    const v = p.vp1 = vwGV(p, {scale: 1}); p.sized = true;
    if (Math.abs(v.width - p.w) > .5 || Math.abs(v.height - p.h) > .5) { const a = vwAnchor(); p.w = v.width; p.h = v.height; vwSize(p); vwAnchorSet(a); if (VW.fit) vwFitW(true); }
    if (p.i % 20 === 19) await new Promise(r => setTimeout(r, 0));
  }
  if (gen === VW.gen) vwSzPut();   // la próxima vez, sin medir
}
const vwAnchor = () => { const p = VW.pages[VW.cur], sc = $('#vwScroll'); return p && {i: p.i, f: (sc.scrollTop - p.el.offsetTop) / Math.max(1, p.el.offsetHeight)}; };
const vwAnchorSet = a => { if (!a) return; const p = VW.pages[a.i]; $('#vwScroll').scrollTop = p.el.offsetTop + a.f * p.el.offsetHeight; };
function vwScaleSet(s, focus) {   // focus: punto (en la pantalla) que se queda quieto
  s = Math.min(6, Math.max(.25, s)); const sc = $('#vwScroll'), old = VW.scale; if (Math.abs(s - old) < .001) return;
  const r = sc.getBoundingClientRect(), fx = focus ? focus.x - r.left : sc.clientWidth / 2, fy = focus ? focus.y - r.top : 0;
  const cx = (sc.scrollLeft + fx) / old, cy = (sc.scrollTop + fy - VW_GAP * vwRow(VW.cur)) / old;
  VW.scale = s; $('#vwPages').style.setProperty('--scale-factor', s); $('#vwZl').textContent = Math.round(s * 100) + ' %';
  sc.scrollLeft = cx * s - fx; sc.scrollTop = cy * s + VW_GAP * vwRow(VW.cur) - fy;
  for (const p of VW.pages) if (p.det) { try { p.dtask?.cancel(); } catch (e) {} p.det.remove(); p.det = null; }   // el trozo nítido era de la escala anterior
  clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 120);
}
function vwFitW(keep) {
  if (keep !== true && vwLocked()) return;
  const sc = $('#vwScroll'); if (!VW.pages.length) return; const c = vwCropOn(), w = Math.max(...VW.pages.slice(0, 50).map(p => p.w)) - (c ? c.l + c.r : 0);   // con el recorte, sin los márgenes
  let s = (sc.clientWidth - (VW.two ? 3 : 2) * VW_GAP) / (VW.two ? 2 * w : w), a = vwAnchor();   // doble página: dos de ancho
  if (VW.flip) s = Math.min(s, (sc.clientHeight - 2 * VW_GAP) / (Math.max(...VW.pages.slice(0, 50).map(p => p.h)) - (c ? c.t + c.b : 0)));   // página a página: entera a la vista
  s = Math.max(.25, s);
  VW.fit = true; VW.fitS = VW.scale = s; $('#vwPages').style.setProperty('--scale-factor', s); $('#vwZl').textContent = Math.round(s * 100) + ' %';
  if (keep !== true || a) vwAnchorSet(a); clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 120);
}
function vwZoomBy(f, focus) { if (vwLocked()) return; VW.fit = false; vwScaleSet(VW.scale * f, focus); }
function vwWheel(e) { if (!e.ctrlKey && !e.metaKey) { if (VW.zLock) e.preventDefault(); return; }   // candado: la rueda tampoco mueve la hoja
  e.preventDefault(); vwZoomBy(Math.exp(-e.deltaY / 300), {x: e.clientX, y: e.clientY}); }
function vwRerender() { for (const p of VW.pages) if (p.cv && Math.abs(p.rs - VW.scale) > .01) { p.rs = 0; VW.queue.add(p.i); } for (const p of VW.pages) p.tl?.update?.({viewport: vwGV(p, {scale: VW.scale})}); vwPump(); }
function vwObserve() {
  VW.io?.disconnect();
  VW.io = new IntersectionObserver(es => { for (const e of es) { const i = +e.target.dataset.i, p = VW.pages[i]; p.vis = e.isIntersecting; if (e.isIntersecting) { VW.queue.add(i); if (p.annWait) vwAnnFetch(p); } } vwPump(); vwFree(); },
    {root: $('#vwScroll'), rootMargin: '120% 0px'});
  VW.pages.forEach(p => VW.io.observe(p.el));
}
async function vwPump() {   // pinta de una en una, primero la más cercana a la que lees
  if (VW.busy) return; VW.busy = true; const gen = VW.gen;
  try {
    while (VW.queue.size && gen === VW.gen) {
      const i = [...VW.queue].sort((a, b) => Math.abs(a - VW.cur) - Math.abs(b - VW.cur))[0]; VW.queue.delete(i);
      const p = VW.pages[i]; if (!p.vis || p.cv && Math.abs(p.rs - VW.scale) < .01) continue;
      await vwRender(p, gen);
    }
  } finally { VW.busy = false; }
}
const vwMaxPx = () => VW.lite ? 3e6 : document.documentElement.classList.contains('mv') || /iPhone|iPad|Android/.test(navigator.userAgent) ? 5e6 : 16e6;
/* Modo ligero (v39.45): táctil con poca memoria o pocos núcleos (móviles Android de gama baja). Lienzos con menos píxeles (y como mucho
   el doble de la pantalla), menos páginas pintadas en memoria y la capa de texto solo cerca de la que lees. */
const vwLiteWant = () => { const p = vwLitePref(); return p === 'on' || p === 'auto' && tsWant() && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 || !!window.VW_LITE); };   // los móviles cierran la pestaña con lienzos enormes
async function vwRender(p, gen) {
  try {
    p.proxy ||= await VW.doc.getPage(p.i + 1); if (gen !== VW.gen) return; lnLoad(p);   // v39.50: los enlaces de la página
    if (!p.sized) { p.vp1 = vwGV(p, {scale: 1}); p.sized = true; if (Math.abs(p.vp1.width - p.w) > .5 || Math.abs(p.vp1.height - p.h) > .5) { p.w = p.vp1.width; p.h = p.vp1.height; vwSize(p); } }
    if (p.annWait) vwAnnPage(p);
    const s = VW.scale, vp = vwGV(p, {scale: s}), max = vwMaxPx();
    let os = Math.min(devicePixelRatio || 1, VW.lite ? 2 : 3); if (vp.width * vp.height * os * os > max) os = Math.sqrt(max / (vp.width * vp.height));
    const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width * os); cv.height = Math.floor(vp.height * os); cv.className = 'vwcv';
    const L = PDFJS, task = p.task = p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, transform: os !== 1 ? [os, 0, 0, os, 0, 0] : null,
      annotationMode: L.AnnotationMode.ENABLE_STORAGE, pageColors: vwPC()});
    await task.promise; p.task = null; if (gen !== VW.gen) return;
    if (p.cv) p.cv.replaceWith(cv); else p.el.prepend(cv); p.cv = cv; p.rs = s; p.os = os; p.det?.remove(); p.det = null; vwDetailSoon();
    if (!p.tl) {
      const div = document.createElement('div'); div.className = 'textLayer'; p.el.querySelector('.vwa').before(div);
      p.tl = new L.TextLayer({textContentSource: p.proxy.streamTextContent({includeMarkedContent: true, disableNormalization: true}), container: div, viewport: vp});
      await p.tl.render().catch(() => {}); if (gen !== VW.gen) return;
      const end = document.createElement('div'); end.className = 'endOfContent'; div.append(end);
      if (VW.find.q) vwFindMark(p);
    }
    if (VX.ocr.has(p.i) && !p.el.querySelector('.vxocr')) vxOcrLayer(p);
  } catch (e) { if (e?.name !== 'RenderingCancelledException') console.debug('[visor]', e); }
}
function vwFree() {   // libera los lienzos lejanos (memoria del móvil): se vuelven a pintar si vuelves a ellos
  const keep = VW.lite ? 4 : vwMaxPx() < 6e6 ? 6 : 14, on = VW.pages.filter(p => p.cv), far = VW.lite ? 4 : 30;
  if (VW.lite) for (const p of VW.pages) if (p.tl && !p.cv && !p.vis && Math.abs(p.i - VW.cur) > far) { p.tl.cancel?.(); p.el.querySelector('.textLayer:not(.vxocr)')?.remove(); p.tl = null; }   // ligero: tampoco quedan capas de texto lejos
  if (on.length <= keep) return;
  on.sort((a, b) => Math.abs(b.i - VW.cur) - Math.abs(a.i - VW.cur));
  for (const p of on.slice(0, on.length - keep)) { if (p.vis) continue; p.cv.width = p.cv.height = 0; p.cv.remove(); p.cv = null; p.rs = 0; if (p.det) { p.det.width = p.det.height = 0; p.det.remove(); p.det = null; } if (Math.abs(p.i - VW.cur) > far && p.tl) { p.tl.cancel?.(); p.el.querySelector('.textLayer:not(.vxocr)')?.remove(); p.tl = null; } if (Math.abs(p.i - VW.cur) > 8) p.proxy?.cleanup(); }   // lejos: PDF.js suelta también lo que tenía preparado de la página (papers largos)
}
function vwOnScroll() {
  vwDetailSoon();
  const sc = $('#vwScroll'), y = sc.scrollTop + sc.clientHeight / 3; let lo = 0, hi = VW.pages.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (VW.pages[m].el.offsetTop <= y) lo = m; else hi = m - 1; }
  if (VW.flip) lo = VW.cur; else if (VW.two) lo = vwSpread(lo);   // página a página no se cambia al desplazar; en doble página, la primera del par
  if (VW.pages.length && lo !== VW.cur) { VW.cur = lo; vwThCur(); }
  if (VW.fs && VW.pages.length && VW.cur !== VW.tipPg) vwPgTip();
  const inp = $('#vwPg'); if (VW.pages.length && document.activeElement !== inp) inp.value = VW.cur + 1;
  if (!$('#vwSel').hidden) vwSelShow();
  if (VW.pop) { vwPopPlace(); vwHandles(); }
  vxMapCur(); if ($('#vxRl') && !$('#vxRl').hidden) vxRlPlace();
}
function vwGoN(v) { vxGoH(+v - 1); }   // v40.8: con «atrás»
function vwGo(i, instant) {
  if (!VW.pages.length || !Number.isFinite(i)) return; i = Math.max(0, Math.min(VW.pages.length - 1, i | 0));
  if (VW.two) i = vwSpread(i);
  if (VW.flip) { const ch = VW.cur !== i; VW.cur = i; vwFlipShow(); if (!VW.zLock) $('#vwScroll').scrollTo({top: 0, behavior: 'instant'}); if (ch) { vwThCur(); if (VW.fs) vwPgTip(); if (VW.pop) vwPopClose(); } }
  else { VW.cur = i; $('#vwScroll').scrollTo({top: VW.pages[i].el.offsetTop + (vwCropOn()?.t || 0) * VW.scale - VW_GAP / 2, behavior: instant ? 'instant' : 'auto'}); }
  $('#vwPg').value = i + 1;
}
/* Dos dedos: pellizcar para acercar o alejar y arrastrar para moverse (también con «Subrayar» o «Zona», donde un dedo marca).
   Mientras dura solo cambia --scale-factor; al soltar se vuelven a pintar las páginas a la nueva escala. */
function vwTouch(e) {
  const t = e.touches; if (VW.auto) VW.autoHold = t.length > 0;   // con el dedo en la pantalla, el desplazamiento automático espera
  if (e.type === 'touchstart' && t.length === 2 && VW.zPinch) {
    const c = {x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2};
    VW.pinch = {d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), s: VW.scale, c}; VW.drag = null; $('#vwBox')?.remove();
    if (VW.mode !== 'sel') getSelection().removeAllRanges(); return;
  }
  if (!VW.pinch) return;
  if (e.type === 'touchmove' && t.length === 2) {
    e.preventDefault(); const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), c = {x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2};
    const sc = $('#vwScroll'); if (!VW.zLock) { sc.scrollLeft -= c.x - VW.pinch.c.x; sc.scrollTop -= c.y - VW.pinch.c.y; } VW.pinch.c = c;   // candado: con dos dedos tampoco se mueve
    if (VW.zLock) { if (Math.abs(d / VW.pinch.d - 1) > .1 && !VW.pinch.w) { VW.pinch.w = true; vwLocked(); } }
    else if (Math.abs(d / VW.pinch.d - 1) > .02 || VW.pinch.z) { VW.pinch.z = true; VW.fit = false; vwScaleSet(VW.pinch.s * d / VW.pinch.d, c); }
  } else if (e.type !== 'touchmove' && t.length < 2) { VW.pinch = null; clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 60); }
}
