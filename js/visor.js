'use strict';
/* ===== Visor de PDF con subrayados, notas y comentarios (v39) =====
   Se abre dentro de la aplicación (una ventana a pantalla completa) con los botones 📄 de las tarjetas, la tabla, la ficha del paper y la bandeja
   «PDF por citar». PDF.js (lib/pdfjs, de Mozilla) solo se descarga la primera vez que se abre un PDF y queda en la caché del service worker:
   la lista de papers no carga nada más. Solo se pintan las páginas que se ven (y las de al lado) y se liberan las que quedan lejos.
   Las anotaciones van en la biblioteca (campo «ann» del PDF: ver annClean en js/modelo.js), así se guardan, se deshacen y se sincronizan con Drive
   como el resto. El PDF no se toca: «Descargar PDF anotado» (y la copia del Drive normal, Configuración) escriben las anotaciones dentro del archivo
   como anotaciones estándar (resaltado con su color y su comentario, nota adhesiva), que se ven en Acrobat, Foxit y cualquier lector (js/visor.js, vwPdfOut).
   Desde file:// el navegador no deja cargar PDF.js (módulos): se abre el visor del navegador, como antes. */
const VW_COLORS = [['#ffd400', 'Amarillo'], ['#5fd068', 'Verde'], ['#4dabf7', 'Azul'], ['#ff6b6b', 'Rojo'], ['#b197fc', 'Morado']];
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
      <span class="vwpg"><input id="vwPg" type="number" min="1" aria-label="Página" data-onchange="vwGoN(this.value)" data-onkeydown="onEnter(event,vwGoN,this.value)"><span id="vwPn"></span></span>
      <span class="vwz"><button class="vwib" data-onclick="vwZoomBy(0.8333)" title="Alejar (Ctrl + −)" aria-label="Alejar">−</button><button id="vwZl" class="vwzl" data-onclick="vwFitW()" title="Ajustar al ancho">100 %</button><button class="vwib" data-onclick="vwZoomBy(1.2)" title="Acercar (Ctrl + +)" aria-label="Acercar">＋</button></span>
      <span class="vwf"><input id="vwQ" type="search" placeholder="Buscar en el PDF" aria-label="Buscar en el PDF" data-onkeydown="vwFindKey(event)" data-oninput="vwFindReset()"><span id="vwQn"></span></span>
      <button class="vwib vwfb" data-onclick="vwFindToggle()" title="Buscar (Ctrl+F)" aria-label="Buscar">🔍</button>
      <button class="vwib" id="vwMoreB" data-onclick="vwMore(event)" title="Más: descargar con las anotaciones, ficha del paper…" aria-label="Más">⋯</button></div>
    <div class="vwtb" role="toolbar" aria-label="Herramientas">
      <button class="vwm" data-m="sel" data-onclick="vwMode('sel')" title="Seleccionar texto: al soltar, elige un color para subrayarlo"><span>𝙸</span><small>Seleccionar</small></button>
      <button class="vwm" data-m="hl" data-onclick="vwMode('hl')" title="Subrayar: arrastra sobre el texto (con el dedo, el lápiz o el ratón)"><span>🖍</span><small>Subrayar</small></button>
      <button class="vwm" data-m="area" data-onclick="vwMode('area')" title="Zona: arrastra para marcar un recuadro (PDF escaneados, figuras)"><span>▭</span><small>Zona</small></button>
      <button class="vwm" data-m="note" data-onclick="vwMode('note')" title="Nota: toca la página donde quieras dejarla"><span>🗒</span><small>Nota</small></button>
      <span class="vwcs" role="group" aria-label="Color">${sw}</span>
      <button class="vwm vwtc" data-onclick="vwPanel('toc')" title="Índice del PDF y miniaturas de las páginas"><span>📑</span><small>Índice</small></button>
      <button class="vwm vwsb" data-onclick="vwPanel('ann')" title="Subrayados, notas y comentarios"><span>💬</span><small>Anotaciones</small><b id="vwAn"></b></button></div>
    <div class="vwbody"><div id="vwScroll" tabindex="-1"><div id="vwPages"></div><p id="vwLoad" class="vwload">Abriendo el PDF…</p></div><aside id="vwSide" hidden></aside></div>
    <div id="vwSel" class="vwfloat" hidden>${sw.replace(/vwColor/g, 'vwSelColor')}<button class="vwib" data-onclick="vwSelNote()" title="Subrayar y comentar" aria-label="Subrayar y comentar">💬</button><button class="vwib" data-onclick="vwSelCopy()" title="Copiar el texto" aria-label="Copiar">📋</button></div>
    <div id="vwPop" class="vwfloat vwpop" hidden></div></dialog>`);
  const d = $('#vw'), sc = $('#vwScroll');
  d.addEventListener('cancel', e => { e.preventDefault(); vwEsc(); });
  d.addEventListener('close', () => { if (VW.open) vwClose(); });   // Chrome cierra sin «cancel» si se pulsa Esc dos veces seguidas: se cierra bien igualmente
  d.addEventListener('keydown', vwKey);
  document.addEventListener('keydown', e => { if (VW.open && (e.target === document.body || e.target === document.documentElement)) vwKey(e); });   // si el foco se pierde (un botón que se repinta), los atajos siguen yendo al visor
  sc.addEventListener('scroll', () => { if (!VW.rafS) VW.rafS = requestAnimationFrame(() => { VW.rafS = 0; vwOnScroll(); }); }, {passive: true});
  sc.addEventListener('wheel', vwWheel, {passive: false});
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) sc.addEventListener(t, vwTouch, {passive: false});
  sc.addEventListener('pointerdown', vwDown); sc.addEventListener('pointermove', vwMove); sc.addEventListener('pointerup', vwUp); sc.addEventListener('pointercancel', vwUp);
  document.addEventListener('selectionchange', () => { if (VW.open) { clearTimeout(VW.selT); VW.selT = setTimeout(vwSelShow, VW.mode === 'sel' ? 250 : 0); } });
  new ResizeObserver(() => { if (VW.open && VW.fit && VW.pages.length) vwFitW(true); }).observe(sc);
  window.addEventListener('popstate', () => { if (VW.open && VW.pushed) { VW.pushed = false; vwClose(true); } });
}
async function vwOpen(src, file) {
  vwBuild(); if (VW.open) await vwClose(false, true);
  const gen = ++VW.gen; Object.assign(VW, {open: true, src, file, doc: null, pages: [], foreign: null, sel: null, dirty: false, find: {q: '', hits: [], i: -1, txt: new Map()}});
  const d = $('#vw'); vw$('.vwt').textContent = vwTitle(); vw$('.vwt').title = vwTitle(); $('#vwPages').innerHTML = ''; $('#vwLoad').hidden = false; $('#vwLoad').textContent = 'Abriendo el PDF…';
  $('#vwQ').value = ''; $('#vwQn').textContent = ''; vwPopClose(); $('#vwSel').hidden = true; if (VW.sideNext) VW.tab = 'ann'; VW.side = VW.sideNext || !document.documentElement.classList.contains('mv') && innerWidth > 1100 && vwSideOn(); VW.sideNext = false; vwSideShow();
  VW.night = vwNightOn(); d.classList.toggle('night', VW.night); VW.toc = null; VW.thIo?.disconnect();
  if (!d.open) d.showModal(); vwModeShow(); vwColorShow(); vwCount();
  if (!VW.pushed && !VW_TAB) { try { history.pushState({vw: 1}, ''); VW.pushed = true; } catch (e) {} }   // el botón «atrás» del móvil cierra el visor
  try {
    const L = await vwLib(); if (gen !== VW.gen) return;
    const task = L.getDocument({data: new Uint8Array(await file.arrayBuffer()), cMapUrl: vwUrl('cmaps/'), cMapPacked: true, standardFontDataUrl: vwUrl('standard_fonts/'), isEvalSupported: false, enableXfa: false});
    task.onPassword = (cb, why) => vwAskPass(why === 2).then(p => p == null ? task.destroy() : cb(p));
    const doc = await task.promise; if (gen !== VW.gen) { doc.destroy(); return; }
    VW.doc = doc; const p1 = await doc.getPage(1), v1 = p1.getViewport({scale: 1});
    VW.pages = Array.from({length: doc.numPages}, (_, i) => ({i, w: v1.width, h: v1.height, vp1: i ? null : v1, proxy: i ? null : p1, el: null, cv: null, rs: 0, tl: null, sized: !i}));
    $('#vwLoad').hidden = true; $('#vwPn').textContent = '/ ' + doc.numPages; $('#vwPg').max = doc.numPages;
    $('#vwPages').innerHTML = VW.pages.map(p => `<div class="vwp" data-i="${p.i}"><div class="vwa"></div></div>`).join('');
    VW.pages.forEach(p => { p.el = $('#vwPages').children[p.i]; vwSize(p); });
    VW.fit = true; vwFitW(true);
    const pf = vwHolders()[0], start = Math.min(doc.numPages, Math.max(1, pdfPage(pf?.page) || 1)) - 1; VW.startPage = start;
    if (start) vwGo(start, true); vwObserve(); vwDrawAnn(); vwOnScroll();
    vwSizes(gen); vwForeign(gen);
  } catch (e) {
    if (gen !== VW.gen) return; console.error(e);
    $('#vwLoad').innerHTML = `${e.name === 'PasswordException' ? 'El PDF está protegido con contraseña.' : 'No se pudo abrir el PDF' + (e.message ? ': ' + esc(e.message) : '.')} <button data-onclick="vwNative()">Abrir con el visor del navegador</button>`;
  }
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
  if (!VW.open) return; vwSaveComment();
  const src = VW.src, page = VW.cur + 1, pf = vwHolders()[0];
  VW.open = false; VW.gen++; VW.io?.disconnect(); VW.queue.clear();
  for (const p of VW.pages) { try { p.task?.cancel(); } catch (e) {} p.proxy?.cleanup(); }
  try { VW.doc?.destroy(); } catch (e) {}
  VW.doc = null; VW.pages = []; VW.file = null; $('#vwPages').innerHTML = ''; vwPopClose(); $('#vwSel').hidden = true;
  if (!keepHist) { const d = $('#vw'); if (d.open) d.close(); }
  if (VW.pushed && !fromPop && !keepHist) { VW.pushed = false; history.back(); }
  if (pf && src && (pdfPage(pf.page) || 1) !== page && (page > 1 || pf.page)) {   // la página donde ibas, para volver a ella
    const hs = vwHoldersOf(src); hs.forEach(h => page > 1 ? h.page = page : delete h.page); if (hs.length) markDirty();
  }
  if (RENDER_VW) { RENDER_VW = false; render(); } else if (src?.kind === 'paper' && db.papers.some(p => p.id === src.id)) renderPaper(src.id);
  if (src?.kind === 'inbox') inboxDraw();
  if ($('#dlg').open && D && src?.kind === 'paper' && D.id === src.id) drawD();
  if (VW_TAB) return vwSatClose();
  if (syAuto()) sySoon(1500);
}
function vwHoldersOf(src) { const s = VW.src; VW.src = src; try { return vwHolders(); } finally { VW.src = s; } }
let RENDER_VW = false;   // la lista no se repinta debajo del visor: se hace al cerrarlo
function vwDbChanged() {   // la biblioteca cambió (deshacer, Google Drive): se vuelven a pintar las anotaciones
  if (!VW.open) return; RENDER_VW = true; vw$('.vwt').textContent = vwTitle();
  if (!vwHolders().length) { toast('Este PDF ya no está enlazado.', [], 4000); return vwClose(); }
  vwDrawAnn(); if (VW.pop && !vwAnns().some(a => a.id === VW.pop)) vwPopClose(); vwSatPush();
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
  if (mod || e.altKey) return;
  const sc = $('#vwScroll');
  if (k === 'PageDown' || k === ' ' && !e.shiftKey) { e.preventDefault(); sc.scrollBy(0, sc.clientHeight * .9); }
  else if (k === 'PageUp' || k === ' ' && e.shiftKey) { e.preventDefault(); sc.scrollBy(0, -sc.clientHeight * .9); }
  else if (k === 'ArrowRight' && sc.scrollWidth <= sc.clientWidth) { e.preventDefault(); vwGo(VW.cur + 1); }
  else if (k === 'ArrowLeft' && sc.scrollWidth <= sc.clientWidth) { e.preventDefault(); vwGo(VW.cur - 1); }
  else if (k === 'Home') { e.preventDefault(); vwGo(0); } else if (k === 'End') { e.preventDefault(); vwGo(VW.pages.length - 1); }
  else if (k === 'Delete' && VW.pop) { e.preventDefault(); vwPopDel(); }
}

/* ---- Páginas: tamaño, zoom y pintado de las que se ven ----
   Todas las medidas van en puntos del PDF multiplicados por --scale-factor (una sola variable en #vwPages): cambiar el zoom solo cambia esa
   variable y vuelve a pintar los lienzos que se ven. La capa de texto de PDF.js usa la misma variable. */
const vwSize = p => { p.el.style.width = `calc(var(--scale-factor) * ${p.w}px)`; p.el.style.height = `calc(var(--scale-factor) * ${p.h}px)`; };
async function vwSizes(gen) {   // el tamaño real de cada página (casi siempre el de la primera), poco a poco y sin mover lo que estás leyendo
  for (const p of VW.pages) {
    if (gen !== VW.gen) return; if (p.sized) continue;
    try { p.proxy ||= await VW.doc.getPage(p.i + 1); } catch (e) { return; } if (gen !== VW.gen) return;
    const v = p.vp1 = p.proxy.getViewport({scale: 1}); p.sized = true;
    if (Math.abs(v.width - p.w) > .5 || Math.abs(v.height - p.h) > .5) { const a = vwAnchor(); p.w = v.width; p.h = v.height; vwSize(p); vwAnchorSet(a); if (VW.fit) vwFitW(true); }
    if (p.i % 20 === 19) await new Promise(r => setTimeout(r, 0));
  }
}
const vwAnchor = () => { const p = VW.pages[VW.cur], sc = $('#vwScroll'); return p && {i: p.i, f: (sc.scrollTop - p.el.offsetTop) / Math.max(1, p.el.offsetHeight)}; };
const vwAnchorSet = a => { if (!a) return; const p = VW.pages[a.i]; $('#vwScroll').scrollTop = p.el.offsetTop + a.f * p.el.offsetHeight; };
function vwScaleSet(s, focus) {   // focus: punto (en la pantalla) que se queda quieto
  s = Math.min(6, Math.max(.25, s)); const sc = $('#vwScroll'), old = VW.scale; if (Math.abs(s - old) < .001) return;
  const r = sc.getBoundingClientRect(), fx = focus ? focus.x - r.left : sc.clientWidth / 2, fy = focus ? focus.y - r.top : 0;
  const cx = (sc.scrollLeft + fx) / old, cy = (sc.scrollTop + fy - VW_GAP * VW.cur) / old;
  VW.scale = s; $('#vwPages').style.setProperty('--scale-factor', s); $('#vwZl').textContent = Math.round(s * 100) + ' %';
  sc.scrollLeft = cx * s - fx; sc.scrollTop = cy * s + VW_GAP * VW.cur - fy;
  for (const p of VW.pages) if (p.det) { try { p.dtask?.cancel(); } catch (e) {} p.det.remove(); p.det = null; }   // el trozo nítido era de la escala anterior
  clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 120);
}
function vwFitW(keep) {
  const sc = $('#vwScroll'); if (!VW.pages.length) return; const w = Math.max(...VW.pages.slice(0, 50).map(p => p.w));
  const s = Math.max(.25, (sc.clientWidth - 2 * VW_GAP) / w), a = vwAnchor();
  VW.fit = true; VW.scale = s; $('#vwPages').style.setProperty('--scale-factor', s); $('#vwZl').textContent = Math.round(s * 100) + ' %';
  if (keep !== true || a) vwAnchorSet(a); clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 120);
}
function vwZoomBy(f, focus) { VW.fit = false; vwScaleSet(VW.scale * f, focus); }
function vwWheel(e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); vwZoomBy(Math.exp(-e.deltaY / 300), {x: e.clientX, y: e.clientY}); }
function vwRerender() { for (const p of VW.pages) if (p.cv && Math.abs(p.rs - VW.scale) > .01) { p.rs = 0; VW.queue.add(p.i); } for (const p of VW.pages) p.tl?.update?.({viewport: p.proxy.getViewport({scale: VW.scale})}); vwPump(); }
function vwObserve() {
  VW.io?.disconnect();
  VW.io = new IntersectionObserver(es => { for (const e of es) { const i = +e.target.dataset.i, p = VW.pages[i]; p.vis = e.isIntersecting; if (e.isIntersecting) VW.queue.add(i); } vwPump(); vwFree(); },
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
const vwMaxPx = () => document.documentElement.classList.contains('mv') || /iPhone|iPad|Android/.test(navigator.userAgent) ? 5e6 : 16e6;   // los móviles cierran la pestaña con lienzos enormes
async function vwRender(p, gen) {
  try {
    p.proxy ||= await VW.doc.getPage(p.i + 1); if (gen !== VW.gen) return;
    if (!p.sized) { p.vp1 = p.proxy.getViewport({scale: 1}); p.sized = true; if (Math.abs(p.vp1.width - p.w) > .5 || Math.abs(p.vp1.height - p.h) > .5) { p.w = p.vp1.width; p.h = p.vp1.height; vwSize(p); } }
    const s = VW.scale, vp = p.proxy.getViewport({scale: s}), max = vwMaxPx();
    let os = Math.min(devicePixelRatio || 1, 3); if (vp.width * vp.height * os * os > max) os = Math.sqrt(max / (vp.width * vp.height));
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
  } catch (e) { if (e?.name !== 'RenderingCancelledException') console.debug('[visor]', e); }
}
function vwFree() {   // libera los lienzos lejanos (memoria del móvil): se vuelven a pintar si vuelves a ellos
  const keep = vwMaxPx() < 6e6 ? 6 : 14, on = VW.pages.filter(p => p.cv);
  if (on.length <= keep) return;
  on.sort((a, b) => Math.abs(b.i - VW.cur) - Math.abs(a.i - VW.cur));
  for (const p of on.slice(0, on.length - keep)) { if (p.vis) continue; p.cv.width = p.cv.height = 0; p.cv.remove(); p.cv = null; p.rs = 0; if (p.det) { p.det.width = p.det.height = 0; p.det.remove(); p.det = null; } if (Math.abs(p.i - VW.cur) > 30 && p.tl) { p.tl.cancel?.(); p.el.querySelector('.textLayer')?.remove(); p.tl = null; } }
}
function vwOnScroll() {
  vwDetailSoon();
  const sc = $('#vwScroll'), y = sc.scrollTop + sc.clientHeight / 3; let lo = 0, hi = VW.pages.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (VW.pages[m].el.offsetTop <= y) lo = m; else hi = m - 1; }
  if (VW.pages.length && lo !== VW.cur) { VW.cur = lo; vwThCur(); }
  const inp = $('#vwPg'); if (VW.pages.length && document.activeElement !== inp) inp.value = VW.cur + 1;
  if (!$('#vwSel').hidden) vwSelShow();
  if (VW.pop) vwPopPlace();
}
function vwGoN(v) { vwGo(+v - 1); }
function vwGo(i, instant) {
  if (!VW.pages.length || !Number.isFinite(i)) return; i = Math.max(0, Math.min(VW.pages.length - 1, i | 0));
  VW.cur = i; $('#vwScroll').scrollTo({top: VW.pages[i].el.offsetTop - VW_GAP / 2, behavior: instant ? 'instant' : 'auto'}); $('#vwPg').value = i + 1;
}
/* Dos dedos: pellizcar para acercar o alejar y arrastrar para moverse (también con «Subrayar» o «Zona», donde un dedo marca).
   Mientras dura solo cambia --scale-factor; al soltar se vuelven a pintar las páginas a la nueva escala. */
function vwTouch(e) {
  const t = e.touches;
  if (e.type === 'touchstart' && t.length === 2) {
    const c = {x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2};
    VW.pinch = {d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), s: VW.scale, c}; VW.drag = null; $('#vwBox')?.remove();
    if (VW.mode !== 'sel') getSelection().removeAllRanges(); return;
  }
  if (!VW.pinch) return;
  if (e.type === 'touchmove' && t.length === 2) {
    e.preventDefault(); const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), c = {x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2};
    const sc = $('#vwScroll'); sc.scrollLeft -= c.x - VW.pinch.c.x; sc.scrollTop -= c.y - VW.pinch.c.y; VW.pinch.c = c;
    if (Math.abs(d / VW.pinch.d - 1) > .02 || VW.pinch.z) { VW.pinch.z = true; VW.fit = false; vwScaleSet(VW.pinch.s * d / VW.pinch.d, c); }
  } else if (e.type !== 'touchmove' && t.length < 2) { VW.pinch = null; clearTimeout(VW.zt); VW.zt = setTimeout(vwRerender, 60); }
}

/* ---- Anotaciones: de la pantalla al PDF y del PDF a la pantalla ---- */
const vwPageOf = el => el?.closest?.('.vwp') ? VW.pages[+el.closest('.vwp').dataset.i] : null;
function vwPageAt(x, y) { for (const p of VW.pages) { const r = p.el.getBoundingClientRect(); if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) return p; } return null; }
function vwToPdf(p, cx, cy) {   // punto de la pantalla → espacio del PDF
  const r = p.el.getBoundingClientRect(), k = p.w / r.width, v = p.vp1 || p.proxy?.getViewport({scale: 1});
  return v.convertToPdfPoint((cx - r.left) * k, (cy - r.top) * k);
}
function vwRectToPdf(p, l, t, rr, b) { const a = vwToPdf(p, l, t), c = vwToPdf(p, rr, b); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; }
function vwBoxes(p, q) {   // rectángulos del PDF → cajas en puntos de la página como se ve (origen arriba a la izquierda)
  const v = p.vp1 || p.proxy?.getViewport({scale: 1}); if (!v) return [];
  const out = []; for (let k = 0; k + 3 < q.length; k += 4) { const [x1, y1, x2, y2] = v.convertToViewportRectangle([q[k], q[k + 1], q[k + 2], q[k + 3]]); out.push({x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)}); }
  return out;
}
const vwPx = n => `calc(var(--scale-factor) * ${n.toFixed(2)}px)`;
function vwDrawAnn() {
  if (!VW.pages.length) return vwCount();
  const by = new Map(); for (const a of vwAnns()) { if (!by.has(a.p)) by.set(a.p, []); by.get(a.p).push(a); }
  for (const p of VW.pages) {
    const L = by.get(p.i) || [], layer = p.el.querySelector('.vwa'); if (!L.length && !layer.childElementCount) continue;
    if (!p.vp1 && L.length) { (p.proxy ? Promise.resolve(p.proxy) : VW.doc.getPage(p.i + 1)).then(pr => { p.proxy = pr; p.vp1 = pr.getViewport({scale: 1}); vwDrawAnn(); }); continue; }
    layer.innerHTML = L.map(a => a.k === 'note' ? vwBoxes(p, a.q).slice(0, 1).map(b => `<button class="vwnote" data-a="${a.id}" style="left:${vwPx(b.x)};top:${vwPx(b.y)};--c:${a.c}" title="${esc(a.m || 'Nota')}" aria-label="Nota">🗒</button>`).join('')
      : vwBoxes(p, a.q).map(b => `<i class="vwhl${a.k === 'area' ? ' area' : ''}${a.m ? ' cm' : ''}${VW.pop === a.id ? ' on' : ''}" data-a="${a.id}" style="left:${vwPx(b.x)};top:${vwPx(b.y)};width:${vwPx(b.w)};height:${vwPx(b.h)};--c:${a.c}"></i>`).join('')
        + (a.m ? (b => b ? `<i class="vwcmk" data-a="${a.id}" style="left:calc(${vwPx(b.x + b.w)} + 2px);top:${vwPx(b.y)};--c:${a.c}" title="${esc(a.m)}">💬</i>` : '')(vwBoxes(p, a.q).at(-1)) : '')).join('');   // 💬: tiene comentario (se toca para verlo)
  }
  vwCount(); if (VW.side) vwSideDraw();
}
function vwCount() { const n = vwAnns().length, b = $('#vwAn'); if (b) b.textContent = n ? n : ''; }
function vwFlash(id) { document.querySelectorAll(`#vw [data-a="${id}"]`).forEach(e => { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }); }

/* ---- Selección de texto → subrayado ---- */
function vwSelRange() {
  const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null;
  const r = s.getRangeAt(0), anc = r.commonAncestorContainer, el = anc.nodeType === 1 ? anc : anc.parentElement;
  return el && el.closest('#vwPages') ? r : null;
}
function vwRangeAnn(r) {   // los rectángulos de la selección, por página y juntando los trozos de cada línea
  const per = new Map();
  for (const c of r.getClientRects()) {
    if (c.width < 1 || c.height < 2) continue;
    const p = vwPageAt(c.left + c.width / 2, c.top + c.height / 2); if (!p) continue;
    const pr = p.el.getBoundingClientRect(); if (c.width > pr.width * .98 && c.height > pr.height * .5) continue;   // el bloque entero (endOfContent)
    if (!per.has(p.i)) per.set(p.i, []); per.get(p.i).push({l: c.left, t: c.top, r: c.right, b: c.bottom});
  }
  const out = [];
  for (const [i, L] of per) {
    L.sort((a, b) => a.t - b.t || a.l - b.l); const lines = [];
    for (const c of L) {
      const ln = lines.find(x => Math.min(x.b, c.b) - Math.max(x.t, c.t) > Math.min(x.b - x.t, c.b - c.t) * .5 && c.l - x.r < (c.b - c.t) * 2.5 && x.l - c.r < (c.b - c.t) * 2.5);
      if (ln) { ln.l = Math.min(ln.l, c.l); ln.r = Math.max(ln.r, c.r); ln.t = Math.min(ln.t, c.t); ln.b = Math.max(ln.b, c.b); } else lines.push({...c});
    }
    const p = VW.pages[i]; out.push({p: i, q: lines.flatMap(x => vwRectToPdf(p, x.l, x.t, x.r, x.b))});
  }
  return out;
}
const vwClean = t => String(t || '').replace(/\s+/g, ' ').replace(/(\w)- (\w)/g, '$1$2').trim();
function vwFromSel(color, comment) {
  const r = vwSelRange(); if (!r) return null; const parts = vwRangeAnn(r), t = vwClean(r.toString()).slice(0, 4000); if (!parts.length) return null;
  getSelection().removeAllRanges(); $('#vwSel').hidden = true; const now = vwNow(), ids = [];
  vwMut(l => { for (const x of parts) { const id = ids[parts.indexOf(x)] ||= uid(); l.push({id, k: 'hl', p: x.p, q: x.q, c: VW_COLORS[color][0], ...(t ? {t} : {}), at: now, up: now}); } });
  if (comment) vwPopOpen(ids[0], true); else vwFlash(ids[0]);
  return ids[0];
}
function vwSelShow() {
  const bar = $('#vwSel'), r = VW.mode === 'sel' && !VW.drag && vwSelRange();
  if (!r) { bar.hidden = true; return; }
  const rs = [...r.getClientRects()].filter(c => c.width > 1), last = rs[rs.length - 1] || r.getBoundingClientRect(), first = rs[0] || last, d = $('#vw').getBoundingClientRect();
  bar.hidden = false; const bw = bar.offsetWidth, bh = bar.offsetHeight, mv = document.documentElement.classList.contains('mv');
  let x = Math.min(Math.max(8, (mv ? first.left : last.right) - bw / 2), d.width - bw - 8), y = mv ? first.top - bh - 44 : last.bottom + 10;   // en el móvil, encima: debajo salen los tiradores y el menú del sistema
  if (y < 56) y = last.bottom + 40; if (y + bh > d.height - 8) y = Math.max(56, first.top - bh - 10);
  bar.style.left = x + 'px'; bar.style.top = y + 'px';
}
function vwSelColor(i) { VW.color = i; vwColorShow(); vwFromSel(i); }
function vwSelNote() { vwFromSel(VW.color, true); }
async function vwSelCopy() { const r = vwSelRange(); if (!r) return; await clipText(vwClean(r.toString()), $('#vw')); getSelection().removeAllRanges(); $('#vwSel').hidden = true; toast('Texto copiado.', [], 1500); }

/* ---- Herramientas: seleccionar, subrayar arrastrando, zona y nota ---- */
function vwMode(m) { VW.mode = VW.mode === m && m !== 'sel' ? 'sel' : m; vwModeShow(); getSelection().removeAllRanges(); $('#vwSel').hidden = true; }
function vwModeShow() { document.querySelectorAll('#vw .vwm[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === VW.mode)); $('#vw').dataset.mode = VW.mode; }
function vwColor(i) { VW.color = i; vwColorShow(); if (VW.pop) vwUpd(VW.pop, {c: VW_COLORS[i][0]}); if (VW.mode === 'sel' && vwSelRange()) vwFromSel(i); }
function vwColorShow() { document.querySelectorAll('#vw .vwtb .vwc').forEach(b => b.classList.toggle('on', +b.dataset.c === VW.color)); }
function vwCaret(x, y) {
  let n = null, o = 0;
  if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { n = c.offsetNode; o = c.offset; } }
  else if (document.caretRangeFromPoint) { const c = document.caretRangeFromPoint(x, y); if (c) { n = c.startContainer; o = c.startOffset; } }
  if (!n || n.nodeType !== 3 || !n.parentElement?.closest('.textLayer')) return null;
  return {n, o};
}
function vwDown(e) {
  if (VW.pinch || e.button > 0) return;
  if (e.target.closest('.vwnote')) { VW.tap = {x: e.clientX, y: e.clientY, t: Date.now()}; return; }   // tocar una nota la abre (también con el dedo)
  const p = vwPageOf(e.target); if (!p) return;
  if (VW.mode === 'hl') { const c = vwCaret(e.clientX, e.clientY); VW.drag = {kind: 'hl', p, a: c, x: e.clientX, y: e.clientY, id: e.pointerId}; e.preventDefault(); $('#vwScroll').setPointerCapture(e.pointerId); getSelection().removeAllRanges(); }
  else if (VW.mode === 'area') { VW.drag = {kind: 'area', p, x: e.clientX, y: e.clientY, id: e.pointerId}; e.preventDefault(); $('#vwScroll').setPointerCapture(e.pointerId); }
  else VW.tap = {x: e.clientX, y: e.clientY, t: Date.now()};
}
function vwMove(e) {
  const g = VW.drag; if (!g || g.id !== e.pointerId) return;
  if (g.kind === 'hl') {
    const c = vwCaret(e.clientX, e.clientY); if (!c) return; g.a ||= c; if (!g.a) return;
    const r = document.createRange(), s = getSelection(), ord = g.a.n === c.n ? g.a.o <= c.o : !!(g.a.n.compareDocumentPosition(c.n) & Node.DOCUMENT_POSITION_FOLLOWING);
    const [A, B] = ord ? [g.a, c] : [c, g.a]; r.setStart(A.n, A.o); r.setEnd(B.n, B.o); s.removeAllRanges(); s.addRange(r);
  } else if (g.kind === 'area') {
    let box = $('#vwBox'); if (!box) { box = document.createElement('div'); box.id = 'vwBox'; document.body.append(box); }
    const d = $('#vw'); if (box.parentElement !== d) d.append(box);
    Object.assign(box.style, {left: Math.min(g.x, e.clientX) + 'px', top: Math.min(g.y, e.clientY) + 'px', width: Math.abs(e.clientX - g.x) + 'px', height: Math.abs(e.clientY - g.y) + 'px', '--c': VW_COLORS[VW.color][0]});
  }
}
function vwUp(e) {
  const g = VW.drag; if (e.type === 'pointercancel') { VW.drag = null; VW.tap = null; $('#vwBox')?.remove(); return; }
  if (g && g.id === e.pointerId) {
    VW.drag = null; $('#vwBox')?.remove();
    if (g.kind === 'hl') { if (vwSelRange()) vwFromSel(VW.color); else vwTapAt(e.clientX, e.clientY); return; }
    if (g.kind === 'area') {
      const p = g.p, pr = p.el.getBoundingClientRect(), cl = (v, a, b) => Math.min(b, Math.max(a, v));
      const l = cl(Math.min(g.x, e.clientX), pr.left, pr.right), r = cl(Math.max(g.x, e.clientX), pr.left, pr.right), t = cl(Math.min(g.y, e.clientY), pr.top, pr.bottom), b = cl(Math.max(g.y, e.clientY), pr.top, pr.bottom);
      if (r - l < 6 || b - t < 6) return vwTapAt(e.clientX, e.clientY);
      const id = uid(), now = vwNow(); vwAdd({id, k: 'area', p: p.i, q: vwRectToPdf(p, l, t, r, b), c: VW_COLORS[VW.color][0], at: now, up: now}); vwFlash(id); return;
    }
  }
  const tp = VW.tap; VW.tap = null;
  if (tp && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 8) {
    const n = e.target.closest?.('.vwnote'); if (n) return vwPopOpen(n.dataset.a);
    if (VW.mode === 'note') { const p = vwPageAt(e.clientX, e.clientY); if (!p) return; const [x, y] = vwToPdf(p, e.clientX, e.clientY), id = uid(), now = vwNow();
      vwAdd({id, k: 'note', p: p.i, q: [x, y, x, y], c: VW_COLORS[VW.color][0], at: now, up: now}); return vwPopOpen(id, true); }
    if (!vwSelRange()) vwTapAt(e.clientX, e.clientY);
  }
}
function vwTapAt(x, y) {   // tocar un subrayado o una zona abre su ventanita
  const m = document.documentElement.classList.contains('mv') || matchMedia('(pointer: coarse)').matches ? 10 : 2;   // con el dedo, más margen
  const hit = [...document.querySelectorAll('#vw .vwhl, #vw .vwcmk')].reverse().find(el => { const r = el.getBoundingClientRect(); return x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m; });
  if (hit) vwPopOpen(hit.dataset.a); else if (VW.pop) vwPopClose();
}

/* ---- Ventanita de una anotación: color, comentario, copiar, a las notas del paper, borrar ---- */
function vwPopOpen(id, focus) {
  vwSaveComment(); const a = vwAnns().find(x => x.id === id); if (!a) return;
  VW.pop = id; const pp = $('#vwPop'), paper = vwPaper(), P = paper && db.papers.find(p => p.id === paper.id);
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">${a.k === 'note' ? '🗒 Nota' : a.k === 'area' ? '▭ Zona' : '🖍 Subrayado'} · p. ${a.p + 1}</span><span class="vwcs">${VW_COLORS.map(([c, t], i) => `<button class="vwc${a.c === c ? ' on' : ''}" style="--c:${c}" title="${t}" aria-label="Color ${t}" data-onclick="vwPopColor(${i})"></button>`).join('')}</span><button class="vwib" data-onclick="vwPopClose()" aria-label="Cerrar">✕</button></div>
    ${a.t ? `<blockquote class="vwq">${esc(a.t.length > 400 ? a.t.slice(0, 400) + '…' : a.t)}</blockquote>` : ''}
    <textarea id="vwCm" rows="3" placeholder="${a.k === 'note' ? 'Escribe la nota…' : 'Comentario (opcional)…'}" data-oninput="vwCmIn()">${esc(a.m || '')}</textarea>
    <div class="row vwpopb">${a.t ? '<button data-onclick="vwPopCopy()" title="Copiar el texto subrayado">📋 Copiar</button>' : ''}${P ? '<button data-onclick="vwToNote()" title="Añadir a las notas del paper, con la página, para citarlo">📝 A las notas</button>' : ''}<button class="danger" data-onclick="vwPopDel()">🗑 Borrar</button></div>`;
  pp.hidden = false; vwPopPlace(); document.querySelectorAll('#vw .on[data-a]').forEach(e => e.classList.remove('on')); document.querySelectorAll(`#vw [data-a="${id}"]`).forEach(e => e.classList.add('on'));
  if (focus) setTimeout(() => $('#vwCm')?.focus(), 30);
}
function vwPopPlace() {
  const pp = $('#vwPop'), el = document.querySelector(`#vwPages [data-a="${VW.pop}"]`), d = $('#vw').getBoundingClientRect();
  if (document.documentElement.classList.contains('mv')) { pp.style.left = pp.style.top = ''; return; }   // en el móvil es una hoja abajo (movil: CSS)
  const r = el ? el.getBoundingClientRect() : {left: d.width / 2, bottom: 120, top: 120}, w = pp.offsetWidth, h = pp.offsetHeight;
  let x = Math.min(Math.max(8, r.left), d.width - w - 8), y = r.bottom + 8; if (y + h > d.height - 8) y = Math.max(56, r.top - h - 8);
  y = Math.min(Math.max(56, y), Math.max(56, d.height - h - 8));   // siempre dentro de la pantalla, aunque la anotación no se vea
  pp.style.left = x + 'px'; pp.style.top = y + 'px';
}
function vwPopClose() { vwSaveComment(); VW.pop = null; const pp = $('#vwPop'); if (pp) pp.hidden = true; document.querySelectorAll('#vw .on[data-a]').forEach(e => e.classList.remove('on')); }
function vwCmIn() { clearTimeout(VW.cmT); VW.cmT = setTimeout(vwSaveComment, 700); }
function vwSaveComment() {   // el comentario se guarda al dejar de escribir (y al cerrar)
  clearTimeout(VW.cmT); const t = $('#vwCm'); if (!t || !VW.pop) return; const a = vwAnns().find(x => x.id === VW.pop); if (!a) return;
  const v = t.value.slice(0, 20000); if ((a.m || '') === v) return;
  vwUpd(a.id, {m: v}, true); vwMut(l => { const x = l.find(y => y.id === a.id); if (x && !x.m) delete x.m; }, true);
  document.querySelectorAll(`#vw [data-a="${a.id}"]`).forEach(e => { e.classList.toggle('cm', !!v); if (e.classList.contains('vwnote')) e.title = v || 'Nota'; }); if (VW.side) vwSideDraw();
}
function vwPopColor(i) { const id = VW.pop; VW.color = i; vwColorShow(); vwUpd(id, {c: VW_COLORS[i][0]}); vwPopOpen(id); }
async function vwPopDel() {
  const a = vwAnns().find(x => x.id === VW.pop); if (!a) return; $('#vwCm') && ($('#vwCm').value = a.m || '');
  VW.pop = null; $('#vwPop').hidden = true; vwDel(a.id); toast('Anotación borrada.', [{t: 'Deshacer', fn: () => undo()}], 4000);
}
async function vwPopCopy() { const a = vwAnns().find(x => x.id === VW.pop); if (a?.t) { await clipText(a.t, $('#vw')); toast('Texto copiado.', [], 1500); } }

/* ---- Panel de anotaciones: lista por página, filtros, ir a cada una ---- */
const vwSideOn = () => { try { return localStorage.getItem('gp-vw-side') !== '0'; } catch (e) { return true; } };
function vwSide(on) { VW.side = on ?? !VW.side; try { localStorage.setItem('gp-vw-side', VW.side ? '1' : '0'); } catch (e) {} vwSideShow(); }
function vwSideShow() { const s = $('#vwSide'); s.hidden = !VW.side; $('#vw').classList.toggle('side', VW.side); document.querySelector('#vw .vwsb')?.classList.toggle('on', VW.side && VW.tab === 'ann'); document.querySelector('#vw .vwtc')?.classList.toggle('on', VW.side && VW.tab !== 'ann'); if (VW.side) vwSideDraw(); else VW.thIo?.disconnect(); }
const VW_TABS = [['ann', '💬 Anotaciones'], ['toc', '📑 Índice'], ['th', '▦ Páginas']];
function vwPanel(t) { if (VW.side && VW.tab === t) return vwSide(false); VW.tab = t; VW.side ? vwSideShow() : vwSide(true); }
function vwTab(t) { VW.tab = t; vwSideShow(); }
const vwKindOf = a => a.k === 'note' ? 'note' : 'hl';   // las notas 🗒, aparte de los subrayados y zonas
const vwSideList = () => { const f = VW.filt, k = VW.kind; return vwAnns().filter(a => (!f || (f === 'cm' ? a.m : a.c === f)) && (!k || vwKindOf(a) === k)).sort((a, b) => a.p - b.p || vwTop(a) - vwTop(b)); };
function vwSideDraw() {
  const s = $('#vwSide'), t = VW.tab || 'ann';
  const head = `<div class="vwst" role="tablist">${VW_TABS.map(([k, n]) => `<button role="tab" aria-selected="${t === k}" class="${t === k ? 'on' : ''}" data-onclick="vwTab('${k}')">${n}</button>`).join('')}<button class="vwib" data-onclick="vwSide(false)" aria-label="Cerrar el panel">✕</button></div>`;
  if (t === 'toc') return vwTocDraw(s, head);
  if (t === 'th') return vwThDraw(s, head);
  vwAnnDraw(s, head);
}
function vwAnnDraw(s, head) {
  const all = vwAnns(), f = VW.filt, k = VW.kind || '', L = vwSideList(), nH = all.filter(a => vwKindOf(a) === 'hl').length, nN = all.length - nH;
  const fr = VW.foreign || [], frV = fr.filter(x => !x.dup && !all.some(a => a.src === x.id));
  const pk = VW.pick, n = pk?.size || 0;
  const item = a => `<button class="vwi${VW.pop === a.id || pk?.has(a.id) ? ' on' : ''}" style="--c:${a.c}" data-onclick="vwPick('${a.id}')"${pk ? ` aria-pressed="${pk.has(a.id)}"` : ''}><small>${pk ? (pk.has(a.id) ? '☑ ' : '☐ ') : ''}p. ${a.p + 1} · ${a.k === 'note' ? '🗒 Nota' : a.k === 'area' ? '▭ Zona' : '🖍'}</small>${a.t ? `<span class="vwit">${esc(a.t.length > 220 ? a.t.slice(0, 220) + '…' : a.t)}</span>` : ''}${a.m ? `<span class="vwim">💬 ${esc(a.m.length > 300 ? a.m.slice(0, 300) + '…' : a.m)}</span>` : ''}</button>`;
  const grp = !k && nH && nN ? [['hl', '🖍 Subrayados'], ['note', '🗒 Notas']].map(([g, n]) => { const G = L.filter(a => vwKindOf(a) === g); return G.length ? `<h4 class="vwgh">${n} (${G.length})</h4>${G.map(item).join('')}` : ''; }).join('') : L.map(item).join('');
  s.innerHTML = `${head}<div class="vwsh">${all.length ? `<span class="vwkd" role="group" aria-label="Tipo"><button class="${k ? '' : 'on'}" data-onclick="vwKind('')">Todas ${all.length}</button><button class="${k === 'hl' ? 'on' : ''}" data-onclick="vwKind('hl')" title="Subrayados y zonas">🖍 Subrayados ${nH}</button><button class="${k === 'note' ? 'on' : ''}" data-onclick="vwKind('note')" title="Notas adhesivas">🗒 Notas ${nN}</button></span><button class="vwpk${pk ? ' on' : ''}" data-onclick="vwPickToggle()" title="Elegir varias para borrarlas, copiarlas o llevarlas a las notas">${pk ? '✓ Elegir' : '☐ Elegir'}</button>` : '<b>Anotaciones</b>'}</div>
    ${pk ? `<div class="vwpkb"><button data-onclick="vwPickAll()">${L.length && L.every(a => pk.has(a.id)) ? '☐ Ninguna' : '☑ Todas las de la lista'}</button><button class="danger" data-onclick="vwPickDel()" ${n ? '' : 'disabled'}>🗑 Borrar${n ? ` (${n})` : ''}</button></div>` : ''}
    <div class="vwsf"><button class="${f ? '' : 'on'}" data-onclick="vwFilt('')">Todas</button>${VW_COLORS.filter(([c]) => all.some(a => a.c === c)).map(([c, t]) => `<button class="vwc${f === c ? ' on' : ''}" style="--c:${c}" title="Solo ${t.toLowerCase()}" data-onclick="vwFilt('${c}')"></button>`).join('')}<button class="${f === 'cm' ? 'on' : ''}" data-onclick="vwFilt('cm')" title="Solo las que tienen comentario">💬</button></div>
    <div class="vwsl">${L.length ? grp
      : `<p class="empty">${all.length ? 'Ninguna con este filtro.' : 'Aún no hay anotaciones. Selecciona texto y elige un color, o usa 🖍 Subrayar, ▭ Zona o 🗒 Nota.'}</p>`}</div>
    ${frV.length ? `<details class="vwfr"><summary>${frV.length} ${frV.length === 1 ? 'anotación que ya traía' : 'anotaciones que ya traía'} el PDF</summary>${frV.slice(0, 300).map(x => `<button class="vwi" style="--c:${x.c}" data-onclick="vwGoForeign('${x.id}')"><small>p. ${x.p + 1} · ${esc(x.sub)}${x.who ? ' · ' + esc(x.who) : ''}</small>${x.m ? `<span class="vwim">${esc(x.m.slice(0, 300))}</span>` : ''}</button>`).join('')}<button class="pri" data-onclick="vwImport()" title="Pasan a ser tuyas: se pueden cambiar, comentar y sincronizar">Hacerlas editables</button></details>` : ''}
    ${all.length ? `<div class="vwsx vwexp"><small>${n ? `${n} ${n === 1 ? 'elegida' : 'elegidas'}` : f || k ? 'Las del filtro' : 'Todas'}:</small><select data-onchange="vwExpFmt(this.value)" aria-label="Formato" title="Formato al copiar o llevar a las notas">${ANN_FMTS.map(([k, t]) => `<option value="${k}" ${db.settings.annFmt === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button data-onclick="vwExpCopy()" title="Copiar al portapapeles, para pegarlas en otro sitio">📋 Copiar</button><button data-onclick="vwExpNotes()" title="${n || f || k ? 'Añadirlas como nota nueva del paper' : 'Una nota «Anotaciones del PDF» en el paper: si ya existe, se actualiza'}">📝 A las notas</button><button data-onclick="vwExpMd()" title="Descargar como resumen en Markdown">⬇ .md</button></div>` : ''}
    <div class="vwsx"><button data-onclick="vwOut()" title="Descargar el PDF con los subrayados y comentarios dentro (se ven en Acrobat, Foxit y otros lectores)">⬇ PDF anotado</button></div>`;
}
const vwTop = a => { const p = VW.pages[a.p], b = p && vwBoxes(p, a.q)[0]; return b ? b.y : 0; };
function vwFilt(f) { VW.filt = f; vwSideDraw(); }
function vwKind(k) { VW.kind = k; vwSideDraw(); }
function vwPickAll() { const L = vwSideList(), pk = VW.pick; if (!pk) return; if (L.length && L.every(a => pk.has(a.id))) L.forEach(a => pk.delete(a.id)); else L.forEach(a => pk.add(a.id)); vwSideDraw(); }
async function vwPickDel() {   // borra de una vez las elegidas (un solo «Deshacer»)
  const ids = new Set(VW.pick || []), n = ids.size; if (!n) return;
  if (!await askOk(`¿Borrar ${n} ${n === 1 ? 'anotación' : 'anotaciones'}?`, {ok: 'Borrar', danger: true})) return;
  VW.pop = null; $('#vwPop').hidden = true; VW.pick = new Set();
  vwMut(l => { for (let i = l.length - 1; i >= 0; i--) if (ids.has(l[i].id)) l.splice(i, 1); });
  toast(`${n} ${n === 1 ? 'anotación borrada' : 'anotaciones borradas'}.`, [{t: 'Deshacer', fn: () => undo()}], 5000);
}

/* ---- Índice del PDF y miniaturas de las páginas ---- */
const vwMv = () => document.documentElement.classList.contains('mv');
function vwGoSide(i) { if (!VW.pages[i]) return; vwGo(i); if (vwMv()) vwSide(false); }   // en el móvil el panel tapa la página: se cierra
async function vwTocGet() {
  const doc = VW.doc; if (!doc) return null; if (VW.toc && VW.toc.doc === doc) return VW.toc.L;
  const ol = await doc.getOutline().catch(() => null);
  const walk = L => Promise.all((L || []).map(async it => { let pg = null;
    try { let d = it.dest; if (typeof d === 'string') d = await doc.getDestination(d); const r = Array.isArray(d) && d[0]; if (r && typeof r === 'object') pg = await doc.getPageIndex(r); else if (Number.isInteger(r)) pg = r; } catch (e) {}
    return {t: String(it.title || '').trim() || '(sin título)', pg, items: await walk(it.items)}; }));
  const L = await walk(ol); VW.toc = {doc, L}; return L;
}
async function vwTocDraw(s, head) {
  s.innerHTML = `${head}<div class="vwsl vwtoc"><p class="empty">${VW.doc ? 'Leyendo el índice…' : 'Abriendo el PDF…'}</p></div>`;
  const L = await vwTocGet(); if (!VW.side || VW.tab !== 'toc' || !s.querySelector('.vwtoc')) return;
  const tree = (L, d) => `<ul>${L.map(x => `<li><button class="vwtl${x.pg == null ? ' no' : ''}" style="--d:${d}" ${x.pg == null ? 'disabled' : `data-onclick="vwGoSide(${x.pg})"`}><span>${esc(x.t)}</span>${x.pg != null ? `<small>${x.pg + 1}</small>` : ''}</button>${x.items.length ? tree(x.items, d + 1) : ''}</li>`).join('')}</ul>`;
  s.querySelector('.vwtoc').innerHTML = L && L.length ? tree(L, 0) : `<p class="empty">Este PDF no trae índice. <button data-onclick="vwTab('th')">▦ Ver las páginas</button></p>`;
}
function vwThDraw(s, head) {
  VW.thIo?.disconnect(); const N = VW.pages.length;
  s.innerHTML = `${head}<div class="vwsl vwth">${N ? VW.pages.map(p => `<button class="vwtp${p.i === VW.cur ? ' on' : ''}" data-i="${p.i}" data-onclick="vwGoSide(${p.i})" aria-label="Página ${p.i + 1}"><span class="vwtc0" style="aspect-ratio:${p.w} / ${p.h}"></span><small>${p.i + 1}</small></button>`).join('') : '<p class="empty">Abriendo el PDF…</p>'}</div>`;
  const box = s.querySelector('.vwth'); if (!N) return;
  VW.thIo = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { VW.thIo.unobserve(e.target); vwThumb(e.target); } }, {root: box, rootMargin: '300px'});
  box.querySelectorAll('.vwtp').forEach(b => VW.thIo.observe(b));
  box.querySelector('.vwtp.on')?.scrollIntoView({block: 'center'});
}
async function vwThumb(b) {   // miniatura de una página (pequeña: poca memoria)
  const i = +b.dataset.i, p = VW.pages[i], gen = VW.gen; if (!p) return;
  try {
    p.proxy ||= await VW.doc.getPage(i + 1); if (gen !== VW.gen) return;
    const W = 110 * Math.min(devicePixelRatio || 1, 2), vp = p.proxy.getViewport({scale: W / p.proxy.getViewport({scale: 1}).width});
    const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, pageColors: vwPC()}).promise; if (gen !== VW.gen) return;
    b.querySelector('.vwtc0')?.replaceWith(cv);
  } catch (e) {}
}
function vwThCur() { const b = document.querySelector('#vwSide .vwth'); if (!b) return; b.querySelector('.vwtp.on')?.classList.remove('on'); b.querySelector(`.vwtp[data-i="${VW.cur}"]`)?.classList.add('on'); }

/* ---- Modo noche: fondo oscuro y letra clara; las imágenes del PDF no se tocan ---- */
const vwNightPref = () => { try { return localStorage.getItem('gp-vw-night') || 'off'; } catch (e) { return 'off'; } };
const vwNightOn = () => { const p = vwNightPref(); return p === 'on' || p === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches; };
const vwPC = () => VW.night ? {background: '#1c1e23', foreground: '#dcdde1'} : null;
function vwNight(v) { try { localStorage.setItem('gp-vw-night', v); } catch (e) {} vwNightApply(); }
function vwNightApply() {
  const on = vwNightOn(); if (!VW.open || VW.night === on) return; VW.night = on; $('#vw').classList.toggle('night', on);
  VW.pages.forEach(p => { if (p.cv) { p.rs = 0; VW.queue.add(p.i); } }); vwPump(); if (VW.side && VW.tab === 'th') vwSideDraw();
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => vwNightApply()); } catch (e) {}
function vwJump(id) {
  const a = vwAnns().find(x => x.id === id); if (!a) return; const p = VW.pages[a.p]; if (!p) return;
  const b = vwBoxes(p, a.q)[0], sc = $('#vwScroll');
  sc.scrollTo({top: p.el.offsetTop + (b ? b.y * VW.scale : 0) - sc.clientHeight / 3}); VW.cur = a.p;
  if (document.documentElement.classList.contains('mv')) vwSide(false);
  setTimeout(() => { vwFlash(id); vwPopOpen(id); }, 120);
}

/* ---- Anotaciones que ya traía el PDF (Acrobat, Foxit…): se ven en la página y se listan; «Hacerlas editables» las copia como propias ---- */
const VW_FSUB = {Highlight: '🖍 Resaltado', Underline: '⎁ Subrayado', StrikeOut: '⌿ Tachado', Squiggly: '〰 Ondulado', Text: '🗒 Nota', FreeText: '🅃 Texto', Square: '▭ Rectángulo', Circle: '◯ Elipse', Ink: '✎ Dibujo', Polygon: '⬠ Polígono', Stamp: '🏷 Sello', Caret: '‸ Inserción'};
async function vwForeign(gen) {
  const out = []; if (VW.pages.length > 1500) return;
  for (const p of VW.pages) {
    if (gen !== VW.gen) return;
    try { p.proxy ||= await VW.doc.getPage(p.i + 1); const L = await p.proxy.getAnnotations({intent: 'display'});
      for (const a of L) { if (!VW_FSUB[a.subtype] || !a.rect || a.inReplyTo) continue;
        const qp = a.quadPoints && a.quadPoints.length >= 8 ? [...a.quadPoints] : null, q = [];
        if (qp) for (let k = 0; k + 7 < qp.length; k += 8) { const xs = [qp[k], qp[k + 2], qp[k + 4], qp[k + 6]], ys = [qp[k + 1], qp[k + 3], qp[k + 5], qp[k + 7]]; q.push(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); }
        else q.push(...a.rect);
        const c = a.color ? '#' + [...a.color].map(v => v.toString(16).padStart(2, '0')).join('') : '#ffd400';
        out.push({id: a.id, p: p.i, sub: VW_FSUB[a.subtype], k: a.subtype === 'Text' || a.subtype === 'FreeText' ? 'note' : /Highlight|Underline|StrikeOut|Squiggly/.test(a.subtype) ? 'hl' : 'area',
          q: a.subtype === 'Text' ? [a.rect[0], a.rect[3], a.rect[0], a.rect[3]] : q, c, m: a.contentsObj?.str || '', who: a.titleObj?.str || ''}); }
    } catch (e) {}
    if (p.i % 10 === 9) await new Promise(r => setTimeout(r, 0));
  }
  if (gen !== VW.gen) return; VW.foreign = out; vwHideDups(); if (VW.side) vwSideDraw();
}
function vwHideDups() {   // las ya importadas, y las que escribió GPapers en un PDF anotado que vuelve a abrirse, no se pintan dos veces
  if (!VW.doc || !VW.foreign) return; const mine = vwAnns(), st = VW.doc.annotationStorage, near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1.5);
  const bbox = q => { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; for (let k = 0; k + 3 < q.length; k += 4) { x1 = Math.min(x1, q[k]); y1 = Math.min(y1, q[k + 1]); x2 = Math.max(x2, q[k + 2]); y2 = Math.max(y2, q[k + 3]); } return [x1, y1, x2, y2]; };
  let ch = false;
  for (const f of VW.foreign) {
    const dup = mine.some(a => a.src === f.id || a.p === f.p && near(bbox(a.q), bbox(f.q)) && (a.m || '') === f.m);
    if (dup !== !!f.dup) { f.dup = dup; st.setValue(f.id, {noView: dup}); ch = true; }
  }
  if (ch) { VW.pages.forEach(p => { if (p.cv) { p.rs = 0; VW.queue.add(p.i); } }); vwPump(); }
}
function vwGoForeign(id) { const f = VW.foreign?.find(x => x.id === id), p = f && VW.pages[f.p]; if (!p) return; const b = vwBoxes(p, f.q)[0], sc = $('#vwScroll'); sc.scrollTo({top: p.el.offsetTop + (b ? b.y * VW.scale : 0) - sc.clientHeight / 3}); }
function vwNear(hex) {   // el color de la paleta más parecido
  const h = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16)), a = h(hex);
  return VW_COLORS.map(([c]) => c).sort((x, y) => h(x).reduce((s, v, k) => s + (v - a[k]) ** 2, 0) - h(y).reduce((s, v, k) => s + (v - a[k]) ** 2, 0))[0];
}
function vwImport() {
  const mine = vwAnns(), L = (VW.foreign || []).filter(f => !f.dup && !mine.some(a => a.src === f.id)); if (!L.length) return;
  const now = vwNow(); vwMut(l => { for (const f of L) l.push({id: uid(), k: f.k, p: f.p, q: f.q.map(v => Math.round(v * 100) / 100), c: vwNear(f.c), ...(f.m ? {m: f.m} : {}), src: String(f.id).slice(0, 60), at: now, up: now}); });
  vwHideDups(); toast(`${L.length} ${L.length === 1 ? 'anotación ahora es editable' : 'anotaciones ahora son editables'}.`, [], 3000);
}

/* ---- Buscar en el PDF ---- */
function vwFindToggle(on) { VW.findOpen = on ?? !VW.findOpen; $('#vw').classList.toggle('find', VW.findOpen); if (VW.findOpen) { $('#vwQ').focus(); $('#vwQ').select(); } else { vwFindReset(true); } }
function vwFindReset(clear) { VW.find.hits = []; VW.find.i = -1; $('#vwQn').textContent = ''; document.querySelectorAll('#vw .vwfh').forEach(e => e.remove()); if (clear) { $('#vwQ').value = ''; VW.find.q = ''; } }
async function vwFindKey(e) { if (e.key === 'Enter') { e.preventDefault(); await vwFind(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); vwFindToggle(false); } }
async function vwPageText(p) {   // texto de una página y, para cada letra, el trozo de texto de donde viene
  if (VW.find.txt.has(p.i)) return VW.find.txt.get(p.i);
  p.proxy ||= await VW.doc.getPage(p.i + 1); const tc = await p.proxy.getTextContent(), items = tc.items.filter(x => typeof x.str === 'string');
  let s = ''; const map = []; for (const it of items) { const n = norm(it.str); for (let k = 0; k < n.length; k++) map.push([it, k / Math.max(1, n.length), (k + 1) / Math.max(1, n.length)]); s += n; if (it.hasEOL) { s += ' '; map.push(null); } }
  const r = {s, map}; VW.find.txt.set(p.i, r); return r;
}
async function vwFind(dir) {
  const q = norm($('#vwQ').value.trim()); if (!q || !VW.doc) return;
  if (q !== VW.find.q) {
    VW.find.q = q; VW.find.hits = []; VW.find.i = -1; $('#vwQn').textContent = 'Buscando…'; const gen = VW.gen;
    for (const p of VW.pages) { if (gen !== VW.gen || VW.find.q !== q) return; const {s, map} = await vwPageText(p); let k = s.indexOf(q);
      while (k >= 0) { VW.find.hits.push({p: p.i, k, n: q.length, map}); k = s.indexOf(q, k + 1); } }
    VW.find.i = -1; document.querySelectorAll('#vw .vwfh').forEach(e => e.remove()); VW.pages.forEach(p => p.tl && vwFindMark(p));
  }
  const H = VW.find.hits; if (!H.length) { $('#vwQn').textContent = 'Sin resultados'; return; }
  if (VW.find.i < 0) { const j = H.findIndex(h => h.p >= VW.cur); VW.find.i = dir > 0 ? (j < 0 ? 0 : j) : (j <= 0 ? H.length - 1 : j - 1); }
  else VW.find.i = (VW.find.i + dir + H.length) % H.length;
  const h = H[VW.find.i], p = VW.pages[h.p]; $('#vwQn').textContent = `${VW.find.i + 1} de ${H.length}`;
  const b = vwHitBoxes(p, h)[0], sc = $('#vwScroll'); sc.scrollTo({top: p.el.offsetTop + (b ? b.y * VW.scale : 0) - sc.clientHeight / 3}); VW.cur = h.p;
  document.querySelectorAll('#vw .vwfh.cur').forEach(e => e.classList.remove('cur')); vwFindMark(p); document.querySelectorAll(`#vw .vwfh[data-h="${VW.find.i}"]`).forEach(e => e.classList.add('cur'));
}
function vwHitBoxes(p, h) {   // cajas aproximadas de un resultado (por trozo de texto, recortadas en proporción a las letras)
  const v = p.vp1 || p.proxy?.getViewport({scale: 1}); if (!v) return []; const by = new Map();
  for (let k = h.k; k < h.k + h.n; k++) { const m = h.map[k]; if (!m) continue; const [it, a, b] = m, o = by.get(it); if (o) o[1] = b; else by.set(it, [a, b]); }
  const out = []; for (const [it, [a, b]] of by) {
    const t = it.transform, fh = Math.hypot(t[2], t[3]) || it.height || 10, x = t[4] + it.width * a, w = it.width * (b - a);
    const [x1, y1, x2, y2] = v.convertToViewportRectangle([x, t[5] - fh * .2, x + w, t[5] + fh * .85]); out.push({x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)});
  }
  return out;
}
function vwFindMark(p) {
  if (!VW.find.q) return; p.el.querySelectorAll('.vwfh').forEach(e => e.remove());
  const html = VW.find.hits.map((h, j) => h.p === p.i ? vwHitBoxes(p, h).map(b => `<i class="vwfh${j === VW.find.i ? ' cur' : ''}" data-h="${j}" style="left:${vwPx(b.x)};top:${vwPx(b.y)};width:${vwPx(b.w)};height:${vwPx(b.h)}"></i>`).join('') : '').join('');
  p.el.querySelector('.vwa').insertAdjacentHTML('beforebegin', html);
}

/* ---- Más: descargar, ficha del paper, abrir con el navegador, dónde se guarda ---- */
function vwMore(e) {
  e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(), paper = vwPaper(), P = paper && db.papers.find(p => p.id === paper.id), pf = vwHolders()[0];
  const vis = pf ? pdfVisOf(pf) : false;
  vwMenu(r, `<button data-onclick="vwOut()">⬇ Descargar el PDF con las anotaciones</button>${vwAnns().length ? '<button data-onclick="vwMd()">⬇ Resumen de subrayados y comentarios (.md)</button>' : ''}
    ${vwCanShare() ? `<button data-onclick="vwOther(false)">📲 Abrir en otra app…</button>${vwAnns().length ? '<button data-onclick="vwOther(true)">📲 Abrir en otra app, con las anotaciones…</button>' : ''}` : ''}
    <button data-onclick="vwNative()">↗ Abrir con el visor del navegador</button>${vwAnns().length && !vwCanShare() ? '<button data-onclick="vwOther(true)">↗ Abrir con el visor del navegador, con las anotaciones</button>' : ''}
    ${P && !$('#dlg').open ? '<button data-onclick="vwFicha()">📝 Ficha del paper</button>' : ''}${VW.src?.kind === 'inbox' ? '<button data-onclick="vwCite()">＋ Crear la cita de este PDF</button>' : ''}
    <hr><div class="ctxh">🌙 Modo noche</div>${[['off', 'No'], ['on', 'Sí'], ['auto', 'Como el sistema (modo oscuro)']].map(([v, t]) => `<button data-onclick="vwNight('${v}')">${tick(vwNightPref() === v)}${t}</button>`).join('')}
    ${pf ? `<hr><button data-onclick="vwVis()">${tick(vis)}Guardar también en mi Drive normal (con los subrayados)</button>` : ''}`);
}
function vwMenu(r, html) {   // menú desplegable dentro del visor (el de la aplicación queda debajo del visor)
  let m = $('#vwMenu'); if (!m) { m = document.createElement('div'); m.id = 'vwMenu'; m.className = 'vwfloat vwmenu'; $('#vw').append(m); m.addEventListener('click', ev => { if (ev.target.closest('button')) setTimeout(() => m.hidden = true); }); }
  m.innerHTML = html; m.hidden = false; const w = m.offsetWidth; m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; m.style.top = (r.bottom + 4) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', ev => { if (!m.contains(ev.target)) m.hidden = true; }, {once: true, capture: true}));
}
function vwFicha() { const p = vwPaper(); if (p) openPaper(p.id); }
function vwCite() { const s = VW.src; vwClose(); setTimeout(() => inboxCite(s.id), 50); }
function vwVis() {
  const pf = vwHolders()[0]; if (!pf) return; const on = !pdfVisOf(pf);
  vwHolders().forEach(h => { if (on === !!db.settings.pdfVis) delete h.vis; else h.vis = on ? 'si' : 'no'; }); const P = vwPaper(); if (P) P.modified = vwNow(); markDirty();
  vwSatPush(); if (on) pdfVisAsk(); toast(on ? 'Se guardará una copia con los subrayados en la carpeta «GPapers» de tu Drive.' : 'Este PDF ya no se copiará a tu Drive normal (la copia que ya esté allí no se borra).', [], 4500);
}
function vwMd() {   // resumen en Markdown
  const L = [...vwAnns()].sort((a, b) => a.p - b.p || vwTop(a) - vwTop(b)), name = VW_COLORS.reduce((o, [c, t]) => (o[c] = t, o), {});
  const p = vwPaper(), head = p ? `# ${vwTitle()}\n\n${p.authors?.length ? p.authors.join('; ') + (p.year ? ` (${p.year})` : '') + '\n\n' : ''}` : `# ${vwTitle()}\n\n`;
  const md = head + L.map(a => `- **p. ${a.p + 1}** · ${a.k === 'note' ? 'Nota' : a.k === 'area' ? 'Zona' : 'Subrayado'} (${name[a.c] || a.c})${a.t ? `\n  > ${a.t.replace(/\n/g, ' ')}` : ''}${a.m ? `\n  ${a.m.replace(/\n/g, '\n  ')}` : ''}`).join('\n') + '\n';
  download(md, (vwTitle().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || 'anotaciones') + ' - anotaciones.md', 'text/markdown');
}
async function vwOut() {   // el PDF con las anotaciones dentro, para Acrobat, Foxit o enviarlo
  const pf = vwHolders()[0]; if (!VW.file || !pf) return; toast('Preparando el PDF con las anotaciones…', [], 2500);
  try { const bytes = await vwPdfOut(VW.file, vwAnns()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    a.download = pf.name.replace(/\.pdf$/i, '') + ' (anotado).pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  catch (e) { say(e.message); }
}

/* ---- El PDF anotado: las anotaciones como anotaciones estándar del PDF ----
   Subrayados y zonas: Highlight con QuadPoints (una por línea), su color y su aspecto dibujado (/AP, en modo multiplicar: el texto se sigue leyendo),
   el comentario en /Contents y una ventana /Popup, como las que hace Acrobat. Notas: Text (nota adhesiva) con su icono.
   Cada una lleva /NM «gpapers-<id>»: al volver a escribirlo se cambian solo las de GPapers y se respetan las que ya traía el PDF. */
const VW_AUTHOR = 'GPapers';
async function vwPdfOut(file, anns) {
  const L = await vwPdfLib(), {PDFDocument, PDFName, PDFHexString, PDFString, PDFArray} = L;
  let doc; try { doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), {updateMetadata: false}); }
  catch (e) { throw Error(/encrypt/i.test(e.message) ? 'Este PDF está protegido (cifrado) y no se le pueden añadir las anotaciones. Siguen guardadas en GPapers.' : 'No se pudo preparar el PDF: ' + e.message); }
  const ctx = doc.context, pages = doc.getPages(), N = n => PDFName.of(n), T = s => PDFHexString.fromText(String(s));
  const pdfDate = iso => { const d = iso ? new Date(iso) : new Date(), z = n => String(n).padStart(2, '0'); return PDFString.of(`D:${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`); };
  const nm = d => { const v = d?.get?.(N('NM')); try { return v ? v.decodeText() : ''; } catch (e) { return ''; } };
  for (const pg of pages) {   // fuera las que escribió GPapers la vez anterior (y sus ventanas)
    const arr = pg.node.lookup(N('Annots')); if (!(arr instanceof PDFArray)) continue;
    for (let k = arr.size() - 1; k >= 0; k--) { const d = ctx.lookup(arr.get(k)); if (/^gpapers-/.test(nm(d)) || /^gpapers-/.test(nm(ctx.lookup(d?.get?.(N('Parent')))))) arr.remove(k); }
  }
  const f3 = n => String(Math.round(n * 1000) / 1000), rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
  for (const a of anns) {
    const pg = pages[a.p]; if (!pg) continue; const C = rgb(a.c), base = {Type: 'Annot', NM: T('gpapers-' + a.id), T: T(VW_AUTHOR), M: pdfDate(a.up), CreationDate: pdfDate(a.at), C, F: 4};
    let dict, rect;
    if (a.k === 'note') {
      const [x, y] = a.q; rect = [x, y - 20, x + 20, y];
      const ap = ctx.register(ctx.stream(`${C.map(f3).join(' ')} rg 0.35 0.3 0.1 RG 0.8 w 1 1 18 18 re B 1 w 4.5 14 m 15.5 14 l 4.5 10 m 15.5 10 l 4.5 6 m 12 6 l S`, {Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 20, 20]}));
      dict = {...base, Subtype: 'Text', Rect: rect, Name: 'Comment', Open: false, F: 28, Subj: T('Nota'), Contents: T(a.m || ''), AP: {N: ap}};
    } else {
      const q = [], ops = ['/GS0 gs', `${C.map(f3).join(' ')} rg`]; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let k = 0; k + 3 < a.q.length; k += 4) { const [l, b, r, t] = a.q.slice(k, k + 4); q.push(l, t, r, t, l, b, r, b); ops.push(`${f3(l)} ${f3(b)} ${f3(r - l)} ${f3(t - b)} re f`); x1 = Math.min(x1, l); y1 = Math.min(y1, b); x2 = Math.max(x2, r); y2 = Math.max(y2, t); }
      rect = [x1, y1, x2, y2];
      const ap = ctx.register(ctx.stream(ops.join('\n'), {Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: {ExtGState: {GS0: {Type: 'ExtGState', CA: 1, ca: 1, BM: 'Multiply'}}}}));
      dict = {...base, Subtype: 'Highlight', Rect: rect, QuadPoints: q, CA: 1, Subj: T(a.k === 'area' ? 'Zona' : 'Resaltado'), AP: {N: ap}, ...(a.m ? {Contents: T(a.m)} : {})};
    }
    const ref = ctx.register(ctx.obj(dict)); pg.node.addAnnot(ref);
    if (a.m) {   // ventana del comentario (cerrada), como en Acrobat y Foxit
      const pw = pg.getWidth(), [rx, , , ry] = rect, pr = [Math.min(rx + 24, pw - 10), ry - 120, Math.min(rx + 224, pw), ry];
      const pop = ctx.register(ctx.obj({Type: 'Annot', Subtype: 'Popup', Rect: pr, Parent: ref, Open: false, F: 28, NM: T('gpapers-' + a.id + '-p')}));
      ctx.lookup(ref).set(N('Popup'), pop); pg.node.addAnnot(pop);
    }
  }
  return doc.save({useObjectStreams: false});
}

/* ===== El visor en otra pestaña (ordenador) =====
   📄 abre el visor en una pestaña nueva (index.html?vw=…) para seguir usando la aplicación en la otra. Esa pestaña es un «satélite»:
   no guarda ni sincroniza; cada cambio de las anotaciones se lo manda a la pestaña principal (canal «gpapers-vw»), que lo guarda como
   siempre, y la principal le manda lo que cambie por su lado (deshacer, Google Drive). Si no hay pestaña principal, o se cierra,
   el satélite pasa a guardar él mismo (con lo último que guardó la principal). Configuración → Datos: «en pestaña nueva» o «dentro». */
const VW_TAB = (() => { try { const q = new URLSearchParams(location.search).get('vw'); if (!q) return null; const o = JSON.parse(q);
  return o && typeof o.pj === 'string' && typeof o.id === 'string' && (o.kind === 'paper' || o.kind === 'inbox') ? {pj: o.pj, kind: o.kind, id: o.id, n: o.n === 2 ? 2 : 1, side: !!o.side} : null; } catch (e) { return null; } })();
if (VW_TAB) { TAB.sat = true; TAB.passive = true; }
const VWB = {bc: 'BroadcastChannel' in window ? new BroadcastChannel('gpapers-vw') : null, id: uid(), sats: new Map(), files: new Map(), wait: new Map(), tm: 0};
const vwBc = m => { try { VWB.bc?.postMessage({from: VWB.id, ...m}); } catch (e) {} };
const vwSrcKey = s => s.kind === 'inbox' ? inKey(s.id) : pdfKey(s.id, s.n);
const vwSrcEq = (a, b) => a && b && a.kind === b.kind && a.id === b.id && (a.n || 1) === (b.n || 1);
const vwPart = h => ({ann: h.ann || [], vis: h.vis || '', page: h.page || 0});
function vwApplyPart(src, x) {   // pone en el PDF (en todos sus sitios) las anotaciones que llegan de la otra pestaña
  const hs = vwHoldersOf(src); if (!hs.length || JSON.stringify(vwPart(hs[0])) === JSON.stringify(x)) return false;
  for (const h of hs) { if (x.ann.length) h.ann = structuredClone(x.ann); else delete h.ann; if (x.vis) h.vis = x.vis; else delete h.vis; if (x.page) h.page = x.page; else delete h.page; }
  if (src.kind === 'inbox') hs[0].up = vwNow(); else { const P = db.papers.find(p => p.id === src.id); if (P) P.modified = vwNow(); }
  return true;
}
const vwTabWant = () => vwCan() && !VW_TAB && !document.documentElement.classList.contains('mv') && !matchMedia('(pointer: coarse)').matches && db.settings.pdfTab !== 'app';
async function vwTabOpen(src, file) {   // desde la pestaña principal
  const k = vwSrcKey(src); VWB.files.delete(k); VWB.files.set(k, file); while (VWB.files.size > 6) VWB.files.delete(VWB.files.keys().next().value);
  await sessionNow(); const url = 'index.html?vw=' + encodeURIComponent(JSON.stringify({pj: PJ.cur, ...src, ...(VW.sideNext ? {side: 1} : {})})); VW.sideNext = false;
  if (!window.open(url, '_blank')) toast('El navegador no dejó abrir la pestaña nueva.', [{t: 'Abrir pestaña', fn: () => window.open(url, '_blank')}, {t: 'Abrir aquí', fn: () => vwOpen(src, file)}], 0);
}
function vwOpenAny(src, file, ev, page) {   // 📄: pestaña nueva o dentro de la aplicación (Ctrl + clic: lo contrario de lo elegido)
  if (!vwCan()) return pdfNative(file, page);
  if (src.kind === 'paper') { const P = db.papers.find(p => p.id === src.id), pf = P && P[pdfF(src.n)], d = D && D.id === src.id && $('#dlg').open && D[pdfF(src.n)]; if (!pf || d && d.name !== pf.name) return vwOpen(src, file); }   // aún sin guardar en la ficha: aquí
  const alt = !!(ev && (ev.ctrlKey || ev.metaKey)), canTab = vwCan() && !VW_TAB && !document.documentElement.classList.contains('mv');
  if (canTab && vwTabWant() !== alt) return vwTabOpen(src, file);
  vwOpen(src, file);
}
function vwSatPush() { if (!TAB.sat || !VW.src) return; const h = vwHolders()[0]; if (h) vwBc({t: 'pf', pj: PJ.cur, src: VW.src, pf: vwPart(h)}); }
function vwSatNotify() {   // pestaña principal: cuenta a los satélites lo que cambió en sus PDF
  if (!VWB.sats.size || TAB.passive) return; clearTimeout(VWB.tm);
  VWB.tm = setTimeout(() => { const items = [...VWB.sats.values()].map(src => { const h = vwHoldersOf(src)[0]; return h ? {src, pf: vwPart(h)} : null; }).filter(Boolean); if (items.length) vwBc({t: 'state', pj: PJ.cur, items}); }, 250);
}
async function vwSatOwn(reload) {   // el satélite pasa a guardar él mismo (no hay pestaña principal con este proyecto)
  if (!TAB.sat) return; const src = VW.src || (VW_TAB && {kind: VW_TAB.kind, id: VW_TAB.id, n: VW_TAB.n}), h = src && vwHoldersOf(src)[0], keep = h ? vwPart(h) : null;
  if (reload) { try { const r = await idb('readonly', st => st.get('proj:' + PJ.cur)), d = await projData(r); if (d) await loadText(d, r && typeof r.path === 'string' ? r.path : null, true); } catch (e) {} }
  TAB.sat = false; TAB.passive = false; TAB.wasSat = true;
  if (keep && vwApplyPart(src, keep)) markDirty(); if (VW.open) vwDrawAnn();
  tabHello(); syIcon(); if (syAuto()) sySoon(500);
}
function vwSatYield() {   // vuelve a abrirse la pestaña principal: el satélite le deja el proyecto
  TAB.passive = true; TAB.sat = true; clearTimeout(timer); clearTimeout(tSes); clearTimeout(SY.tm); SY.tm = 0;
  if (VW.src) setTimeout(() => { vwBc({t: 'hello', pj: PJ.cur, src: VW.src}); vwSatPush(); }, 300);
}
async function vwSatBoot() {   // arranque de la pestaña del visor
  const src = {kind: VW_TAB.kind, id: VW_TAB.id, n: VW_TAB.n}, msg = t => { $('#list') && ($('#list').innerHTML = `<p class="empty" style="padding:24px">${esc(t)}</p>`); toast(t, [], 0); };
  if (PJ.cur !== VW_TAB.pj) { TAB.sat = false; TAB.passive = false; tabHello(); return msg('Este proyecto no está en este navegador: ábrelo desde la pestaña principal.'); }
  const main = await new Promise(ok => { VWB.ack = ok; vwBc({t: 'hello', pj: PJ.cur, src}); setTimeout(() => ok(false), 1200); }); VWB.ack = null;
  if (!main) await vwSatOwn(false);
  const pf = vwHoldersOf(src)[0]; if (!pf) return msg('Este PDF ya no está enlazado.');
  document.title = '📄 ' + (src.kind === 'inbox' ? pf.name : (db.papers.find(p => p.id === src.id)?.title || pf.name));
  let file = main ? await new Promise(ok => { VWB.wait.set('f', ok); vwBc({t: 'need', pj: PJ.cur, src}); setTimeout(() => ok(null), 4000); }) : null; VWB.wait.delete('f');
  if (!file) file = await pdfFile(vwSrcKey(src), pf, false).catch(() => null);
  if (!file) return toast(`Elige el archivo «${pf.name}» para abrirlo.`, [{t: 'Elegir el PDF…', fn: async () => { const f = await pdfFile(vwSrcKey(src), pf).catch(() => null); if (f) vwOpen(src, f); }}], 0);
  VW.sideNext = VW_TAB.side; vwOpen(src, file);
}
function vwSatClose() {   // al cerrar el visor de la pestaña aparte: se cierra la pestaña
  vwSatPush(); vwBc({t: 'gone'});
  const end = () => { try { window.close(); } catch (e) {} setTimeout(() => { if (!window.closed) location.replace('index.html'); }, 400); };
  if (!TAB.passive) sessionNow().finally(end); else end();
}
if (VWB.bc) VWB.bc.onmessage = async ({data: m}) => {
  if (!m || m.from === VWB.id || !BOOTED) return;
  if (TAB.sat) {   // pestaña del visor
    if (m.to && m.to !== VWB.id) return;
    if (m.t === 'ack' && m.pj === PJ.cur) VWB.ack?.(true);
    else if (m.t === 'file' && m.file) VWB.wait.get('f')?.(m.file);
    else if (m.t === 'state' && m.pj === PJ.cur && VW.open) { const it = m.items.find(x => vwSrcEq(x.src, VW.src)); if (it && vwApplyPart(VW.src, it.pf)) { vwDrawAnn(); if (VW.pop && !vwAnns().some(a => a.id === VW.pop)) vwPopClose(); if (VW.side) vwSideDraw(); vwCount(); } }
    else if (m.t === 'bye' && m.pj === PJ.cur) setTimeout(() => vwSatOwn(true), 800);   // la principal se cerró o cambió de proyecto
    return;
  }
  if (TAB.passive || m.pj !== PJ.cur) return;   // pestaña principal (la que guarda este proyecto)
  if (m.t === 'hello') { VWB.sats.set(m.from, m.src); vwBc({t: 'ack', to: m.from, pj: PJ.cur}); }
  else if (m.t === 'need') { const k = vwSrcKey(m.src), h = vwHoldersOf(m.src)[0]; let f = VWB.files.get(k) || null; if (!f && h) f = await pdfFile(k, h, false).catch(() => null); if (f) vwBc({t: 'file', to: m.from, file: f}); }
  else if (m.t === 'pf') { VWB.sats.set(m.from, m.src); if (vwApplyPart(m.src, m.pf)) { annAutoSync(m.src); markDirty(); if (VW.open && vwSrcEq(VW.src, m.src)) vwDrawAnn(); else render(); if ($('#dlg').open && D && m.src.kind === 'paper' && D.id === m.src.id) drawD(); } }
  else if (m.t === 'note') { const P = db.papers.find(p => p.id === m.pid); if (P && m.note && !P.notes.some(n => n.id === m.note.id)) { P.notes.push(m.note); P.modified = vwNow(); logChange(P, m.what || 'Nota desde el PDF'); markDirty(); render(); if ($('#dlg').open && D && D.id === P.id) { D.notes.push(structuredClone(m.note)); drawD(); } } }
  else if (m.t === 'annnote') { const P = db.papers.find(p => p.id === m.src.id), pf = P && P[pdfF(m.src.n)]; if (pf && annNoteSet(P, m.src.n || 1, pf.ann || [], m.fmt)) { P.modified = vwNow(); logChange(P, 'Nota «Anotaciones del PDF»'); markDirty(); render(); } }
  else if (m.t === 'gone') VWB.sats.delete(m.from);
};
addEventListener('pagehide', () => { if (!TAB.passive && !VW_TAB && VWB.sats.size) vwBc({t: 'bye', pj: PJ.cur}); });

/* ---- Zoom nítido en el móvil: con mucho zoom la página entera no cabe en memoria a máxima resolución (vwMaxPx), así que
   además se pinta a resolución completa solo el trozo que se ve, encima de la página, al parar de mover o acercar ---- */
function vwDetailSoon() { clearTimeout(VW.dt); VW.dt = setTimeout(vwDetail, 180); }
async function vwDetail() {
  if (!VW.open || VW.pinch) return; const sc = $('#vwScroll'), R = sc.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 3), gen = VW.gen, s = VW.scale;
  for (const p of VW.pages) {
    const ok = p.cv && p.os && p.os < dpr * .95 && Math.abs(p.rs - s) < .01 && p.vis;
    if (!ok) { if (p.det && !p.vis) { p.det.remove(); p.det = null; } continue; }
    const r = p.el.getBoundingClientRect(), x0 = Math.max(R.left, r.left) - r.left, y0 = Math.max(R.top, r.top) - r.top, x1 = Math.min(R.right, r.right) - r.left, y1 = Math.min(R.bottom, r.bottom) - r.top;
    if (x1 - x0 < 8 || y1 - y0 < 8) continue;
    const k = [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1), s].join(); if (p.det && p.det.dataset.k === k) continue;
    const w = Math.ceil(x1) - Math.floor(x0), h = Math.ceil(y1) - Math.floor(y0); let os = dpr; if (w * h * os * os > vwMaxPx()) os = Math.sqrt(vwMaxPx() / (w * h)); if (os <= p.os * 1.05) continue;
    try { p.dtask?.cancel(); } catch (e) {}
    const cv = document.createElement('canvas'); cv.width = Math.floor(w * os); cv.height = Math.floor(h * os); cv.className = 'vwdet'; cv.dataset.k = k;
    cv.style.cssText = `left:${Math.floor(x0)}px;top:${Math.floor(y0)}px;width:${w}px;height:${h}px`;
    const vp = p.proxy.getViewport({scale: s}), task = p.dtask = p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, transform: [os, 0, 0, os, -Math.floor(x0) * os, -Math.floor(y0) * os], annotationMode: PDFJS.AnnotationMode.ENABLE_STORAGE, pageColors: vwPC()});
    try { await task.promise; } catch (e) { continue; } p.dtask = null;
    if (gen !== VW.gen || Math.abs(VW.scale - s) > .001 || !p.cv) return;
    p.det?.remove(); p.cv.after(cv); p.det = cv;
  }
}

/* ===== Botón «atrás» del móvil: cierra la ventana o el menú abiertos, no la aplicación =====
   Al abrir una ventana (ficha, Configuración, Exportar…) o el menú lateral se deja una entrada «guarda» en el historial; «atrás» la gasta
   y cierra lo de encima (como su ✕). El visor de PDF tiene su propia entrada (vwOpen). */
const BK = {on: false};
const bkWant = () => !VW_TAB && (document.documentElement.classList.contains('mv') || matchMedia('(pointer: coarse)').matches);
const bkTop = () => [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'vw').pop();
const bkMenus = () => /\bmv-(dr|mo)\b/.test(document.documentElement.className);
function bkGuard() { if (!bkWant() || BK.on) return; try { history.pushState({gpG: 1}, ''); BK.on = true; } catch (e) {} }
(() => { const sm = HTMLDialogElement.prototype.showModal; HTMLDialogElement.prototype.showModal = function () { sm.call(this); if (this.id !== 'vw') bkGuard(); }; })();
new MutationObserver(() => { if (bkMenus()) bkGuard(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
addEventListener('popstate', e => {
  if (VW.open && VW.pushed) return;   // lo cierra el visor
  if (e.state && e.state.gpG) { BK.on = true; return; }   // se cerró algo de encima: seguimos en la guarda
  if (!BK.on) return; BK.on = false;
  const d = bkTop();
  if (d) { if (d.dispatchEvent(new Event('cancel', {cancelable: true}))) d.close(); }
  else if (bkMenus()) mvClose();
  setTimeout(() => { if (bkTop() || bkMenus()) bkGuard(); }, 0);   // queda otra ventana abierta (o la ficha pidió confirmar): otra guarda
});
