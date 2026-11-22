'use strict';
/* ===== Visor de PDF (2 de 4): anotaciones, selección (también la táctil, que usa el EPUB), herramientas, ventanita, panel lateral, índice y miniaturas,
   modo noche, anotaciones que ya traía el PDF y buscar en el PDF. Va justo después de js/visor.js (comparten las variables globales). ===== */
/* ---- Anotaciones: de la pantalla al PDF y del PDF a la pantalla ---- */
const vwPageOf = el => el?.closest?.('.vwp') ? VW.pages[+el.closest('.vwp').dataset.i] : null;
function vwPageAt(x, y) { for (const p of VW.pages) { const r = vwVisRect(p); if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) return p; } return null; }
function vwToPdf(p, cx, cy) {   // punto de la pantalla → espacio del PDF
  const r = p.el.getBoundingClientRect(), k = p.w / r.width, v = p.vp1 || (p.proxy ? vwGV(p, {scale: 1}) : null);
  return v.convertToPdfPoint((cx - r.left) * k, (cy - r.top) * k);
}
function vwRectToPdf(p, l, t, rr, b) { const a = vwToPdf(p, l, t), c = vwToPdf(p, rr, b); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; }
const vwVp = p => p.vp1 ||= (p.proxy ? vwGV(p, {scale: 1}) : null);   // la geometría de la página (null: aún no se ha pedido a PDF.js)
function vwBoxes(p, q, near) {   // rectángulos del PDF → cajas en puntos de la página como se ve (origen arriba a la izquierda). near: si la página aún no se ha leído, con la de la primera (para ordenar o ir a ella)
  const v = vwVp(p) || (near ? VW.pages[0]?.vp1 : null); if (!v) return [];
  const out = []; for (let k = 0; k + 3 < q.length; k += 4) { const [x1, y1, x2, y2] = v.convertToViewportRectangle([q[k], q[k + 1], q[k + 2], q[k + 3]]); out.push({x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)}); }
  return out;
}
const vwPx = n => `calc(var(--scale-factor) * ${n.toFixed(2)}px)`;
/* Subrayados de cada página (v39.44). Antes, cada página con subrayados cuya geometría no estaba leída se pedía a PDF.js y, al llegar,
   se volvían a pintar TODAS (y la lista del panel), que a su vez volvían a pedir las que faltaban: con muchos subrayados en muchas
   páginas eran miles de repintados y la app se quedaba colgada al abrir. Ahora cada página se pinta sola, y las que aún no se han leído
   esperan a acercarse a la vista (vwObserve) o a pintarse (vwRender); cada una se pide una sola vez. */
const vwAnnOf = i => VW.annBy?.get(i) || [];
function vwDrawAnn() {
  if (!VW.pages.length) return vwCount();
  const by = VW.annBy = new Map(); for (const a of vwAnns()) { if (!by.has(a.p)) by.set(a.p, []); by.get(a.p).push(a); }
  for (const p of VW.pages) vwAnnPage(p);
  vwCount(); if (VW.side) vwSideDraw(); vxMapDraw();
}
function vwAnnPage(p) {
  const L = vwAnnOf(p.i), layer = p.el?.querySelector('.vwa'); if (!layer) return;
  if (!L.length) { p.annWait = false; p.annSig = ''; if (layer.childElementCount) layer.innerHTML = ''; return; }
  if (!vwVp(p)) { p.annWait = true; if (p.vis) vwAnnFetch(p); return; }
  p.annWait = false;
  const sig = JSON.stringify(L.map(a => [a.id, a.k, a.c, a.s || '', a.m || '', a.q, a.g?.length || 0, VW.pop === a.id]));   // v39.45: si no cambió nada en esta página, no se repinta (crear o cambiar uno repinta solo su página)
  if (sig === p.annSig && layer.childElementCount) return; p.annSig = sig;
  layer.innerHTML = L.map(a => { const B = vwBoxes(p, a.q); return a.k === 'note' ? B.slice(0, 1).map(b => `<button class="vwnote" data-a="${a.id}" style="left:${vwPx(b.x)};top:${vwPx(b.y)};--c:${a.c}" title="${esc(a.m || 'Nota')}" aria-label="Nota">🗒</button>`).join('')
    : (a.k === 'ink' ? lnInkSvg(p, a) : '') + B.map(b => `<i class="vwhl${a.k === 'ink' ? ' ink' : a.k === 'area' ? ' area' : a.s === 'u' ? ' u' : a.s === 'x' ? ' x' : ''}${a.m ? ' cm' : ''}${VW.pop === a.id ? ' on' : ''}" data-a="${a.id}" style="left:${vwPx(b.x)};top:${vwPx(b.y)};width:${vwPx(b.w)};height:${vwPx(b.h)};--c:${a.c}"></i>`).join('')
      + (a.m ? (b => b ? `<i class="vwcmk" data-a="${a.id}" style="left:calc(${vwPx(b.x + b.w)} + 2px);top:${vwPx(b.y)};--c:${a.c}" title="${esc(a.m)}">💬</i>` : '')(B.at(-1)) : ''); }).join('');   // 💬: tiene comentario (se toca para verlo)
}
function vwAnnFetch(p) {   // pide a PDF.js la geometría de la página (una sola vez) y pinta solo sus subrayados
  if (p.annGet || !VW.doc) return; const gen = VW.gen;
  p.annGet = (p.proxy ? Promise.resolve(p.proxy) : VW.doc.getPage(p.i + 1)).then(pr => { p.annGet = null; if (gen !== VW.gen) return; p.proxy ||= pr; vwVp(p); if (p.annWait) vwAnnPage(p); }, () => { p.annGet = null; });
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
function vwFromSel(color, comment, style) {
  const r = vwSelRange(); if (!r) return null; const parts = vwRangeAnn(r), t = vwClean(r.toString()).slice(0, 4000); if (!parts.length) return null;
  getSelection().removeAllRanges(); $('#vwSel').hidden = true; const now = vwNow(), ids = [];
  vwMut(l => { for (const x of parts) { const id = ids[parts.indexOf(x)] ||= uid(); l.push({id, k: 'hl', p: x.p, q: x.q, c: VW_COLORS[color][0], ...(style ? {s: style} : {}), ...(t ? {t} : {}), at: now, up: now}); } });
  if (comment) vwPopOpen(ids[0], true); else vwFlash(ids[0]);
  return ids[0];
}
function vwSelShow() {
  const bar = $('#vwSel'), r = VW.mode === 'sel' && !VW.drag && vwSelRange();
  if (!r) { bar.hidden = true; return; }
  const rs = [...r.getClientRects()].filter(c => c.width > 1), last = rs[rs.length - 1] || r.getBoundingClientRect(), first = rs[0] || last, d = $('#vw').getBoundingClientRect();
  vxAcrBtn(r); bar.hidden = false; const bw = bar.offsetWidth, bh = bar.offsetHeight, mv = document.documentElement.classList.contains('mv');
  let x = Math.min(Math.max(8, (mv ? first.left : last.right) - bw / 2), d.width - bw - 8), y = mv ? first.top - bh - 44 : last.bottom + 10;   // en el móvil, encima: debajo salen los tiradores y el menú del sistema
  if (y < 56) y = last.bottom + 40; if (y + bh > d.height - 8) y = Math.max(56, first.top - bh - 10);
  bar.style.left = x + 'px'; bar.style.top = y + 'px';
}
function vwSelColor(i) { VW.color = i; vwColorShow(); vwFromSel(i); }
function vwSelNote() { vwFromSel(VW.color, true); }
async function vwSelCopy() { const r = vwSelRange(); if (!r) return; await clipText(vwClean(r.toString()), $('#vw')); getSelection().removeAllRanges(); $('#vwSel').hidden = true; toast('Texto copiado.', [], 1500); }

/* ===== Selección propia en táctil (v39.45, PDF y EPUB) =====
   En Android, la pulsación larga abría el menú de Chrome (Volver, Descargar, Imprimir, Compartir, QR…) y, sobre el texto, su barra
   Copiar/Compartir/Seleccionar todo, que no se pueden quitar mientras se use la selección del navegador. En táctil el texto no se
   selecciona con el sistema (user-select:none, clase tsel) y la pulsación larga la hace GPapers: selecciona la palabra, al arrastrar sin
   soltar se alarga por palabras, dos tiradores la ajustan, y sale nuestra barra (colores, 💬, 📋). La selección sigue siendo la del
   documento (addRange), así que el resto del código no cambia; solo que el navegador ya no la pinta y la pinta TS (tsDraw). */
const TS = {just: 0, all: []};
const tsWant = () => matchMedia('(pointer: coarse)').matches;
const tsJust = () => Date.now() - TS.just < 700;   // el toque que acaba de seleccionar no cuenta como toque (pasar página, quitar la selección)
const tsStr = () => { const s = getSelection(); return s.rangeCount && !s.isCollapsed ? s.getRangeAt(0).toString() : ''; };   // con user-select:none, getSelection().toString() da ''
const TS_WORD = /[\p{L}\p{N}_'’-]/u;
function tsCaret(st, x, y) {
  let n = null, o = 0;
  if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { n = c.offsetNode; o = c.offset; } }
  else if (document.caretRangeFromPoint) { const c = document.caretRangeFromPoint(x, y); if (c) { n = c.startContainer; o = c.startOffset; } }
  return n && n.nodeType === 3 && n.parentElement?.closest(st.text) && st.root.contains(n) ? {n, o} : null;
}
function tsSnap(c, start) { const t = c.n.data; let o = c.o; if (start) while (o > 0 && TS_WORD.test(t[o - 1])) o--; else while (o < t.length && TS_WORD.test(t[o])) o++; return {n: c.n, o}; }
const tsBefore = (a, b) => a.n === b.n ? a.o < b.o : !!(a.n.compareDocumentPosition(b.n) & Node.DOCUMENT_POSITION_FOLLOWING);
function tsSet(A, B) { if (tsBefore(B, A)) [A, B] = [B, A]; const r = document.createRange(); r.setStart(A.n, A.o); r.setEnd(B.n, B.o); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function tsRange(st) { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null; const r = s.getRangeAt(0), a = r.commonAncestorContainer, el = a.nodeType === 1 ? a : a.parentElement; return el?.closest(st.text) && st.root.contains(el) ? r : null; }
function tsBind(root, sc, text, o = {}) {   // root: el visor (#vw o #ep); sc: lo que se desplaza; text: dónde está el texto
  const st = {root, sc, text, o, lp: null, drag: null, hd: null}; TS.all.push(st);
  root.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable=false]), .vxflow')) e.preventDefault(); });   // ni el menú largo de Chrome ni el del clic derecho dentro del visor
  sc.addEventListener('pointerdown', e => {
    tsCancel(st); if (e.pointerType === 'mouse' || !root.classList.contains('tsel') || !e.isPrimary || !e.target.closest?.(text) || o.can && !o.can()) return;
    const x = e.clientX, y = e.clientY; st.lp = {x, y, id: e.pointerId, t: setTimeout(() => tsStart(st, x, y, e.pointerId), 450)};
  }, true);
  sc.addEventListener('pointermove', e => {
    if (st.lp && st.lp.id === e.pointerId && Math.hypot(e.clientX - st.lp.x, e.clientY - st.lp.y) > 10) tsCancel(st);
    const g = st.drag; if (!g || g.id !== e.pointerId) return; e.stopPropagation();
    const c = tsCaret(st, e.clientX, e.clientY); if (!c) return;
    tsBefore(c, g.a) ? tsSet(tsSnap(c, true), g.b) : tsBefore(g.b, c) ? tsSet(g.a, tsSnap(c, false)) : tsSet(g.a, g.b);
  }, true);
  const up = e => { if (st.lp?.id === e.pointerId) tsCancel(st); if (st.drag?.id === e.pointerId) { st.drag = null; TS.just = Date.now(); e.stopPropagation(); tsDraw(st); o.done?.(); } };
  sc.addEventListener('pointerup', up, true); sc.addEventListener('pointercancel', up, true);
  sc.addEventListener('touchmove', e => { if (st.drag || st.hd) e.preventDefault(); }, {passive: false, capture: true});   // mientras se alarga, la página no se mueve
  sc.addEventListener('scroll', () => tsSoon(st), {passive: true});
  document.addEventListener('selectionchange', () => tsSoon(st));
  return st;
}
function tsCancel(st) { if (st.lp) { clearTimeout(st.lp.t); st.lp = null; } }
function tsStart(st, x, y, id) {
  st.lp = null; const c = tsCaret(st, x, y); if (!c) return;
  const a = tsSnap(c, true), b = tsSnap(c, false); if (a.o === b.o) return;   // un espacio: nada
  st.drag = {a, b, id}; TS.just = Date.now(); st.o.start?.(); tsSet(a, b); navigator.vibrate?.(15);
}
function tsSoon(st) { if (!st.raf) st.raf = requestAnimationFrame(() => { st.raf = 0; tsDraw(st); }); }
function tsDraw(st) {   // pinta la selección (el navegador no la pinta con user-select:none) y coloca los tiradores
  let ov = st.ov; const r = st.root.classList.contains('tsel') && st.root.open !== false && tsRange(st);
  if (!r) { if (ov) ov.hidden = true; st.hds?.forEach(h => h.hidden = true); return; }
  if (!ov) { ov = st.ov = document.createElement('div'); ov.className = 'tsov'; st.root.append(ov);
    st.hds = [0, 1].map(k => { const h = document.createElement('div'); h.className = 'vwhd tsh vwhd' + k; h.dataset.e = k; st.root.append(h);
      h.addEventListener('pointerdown', e => tsHdDown(st, e, k)); h.addEventListener('pointermove', e => tsHdMove(st, e)); h.addEventListener('pointerup', e => tsHdUp(st, e)); h.addEventListener('pointercancel', e => tsHdUp(st, e)); return h; }); }
  const R = st.root.getBoundingClientRect(), S = st.sc.getBoundingClientRect();
  Object.assign(ov.style, {left: S.left - R.left + 'px', top: S.top - R.top + 'px', width: S.width + 'px', height: S.height + 'px'}); ov.hidden = false;
  const rs = [...r.getClientRects()].filter(c => c.width > 1 && c.height > 2 && c.height < S.height * .5);
  ov.innerHTML = rs.map(c => `<i style="left:${c.left - S.left}px;top:${c.top - S.top}px;width:${c.width}px;height:${c.height}px"></i>`).join('');
  if (!rs.length || st.hd) return; const f = rs[0], l = rs.at(-1), vis = c => c.bottom > S.top && c.top < S.bottom;
  Object.assign(st.hds[0].style, {left: f.left - R.left + 'px', top: f.bottom - R.top + 'px'}); Object.assign(st.hds[1].style, {left: l.right - R.left + 'px', top: l.bottom - R.top + 'px'});
  st.hds[0].hidden = !vis(f); st.hds[1].hidden = !vis(l);
}
function tsHdDown(st, e, k) {
  const r = tsRange(st); if (!r) return; e.preventDefault(); e.stopPropagation(); const rs = [...r.getClientRects()].filter(c => c.width > 1); if (!rs.length) return;
  const m = k ? rs.at(-1) : rs[0];
  st.hd = {k, id: e.pointerId, fix: {n: k ? r.startContainer : r.endContainer, o: k ? r.startOffset : r.endOffset}, dx: e.clientX - (k ? m.right : m.left), dy: e.clientY - (m.top + m.height / 2)};
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} e.currentTarget.classList.add('drag');
}
function tsHdMove(st, e) {
  const g = st.hd; if (!g || g.id !== e.pointerId) return; const h = st.hds[g.k], R = st.root.getBoundingClientRect();
  h.style.left = e.clientX - g.dx - R.left + 'px'; h.style.top = e.clientY - g.dy - R.top + 'px';
  const c = tsCaret(st, e.clientX - g.dx, e.clientY - g.dy); if (!c) return; const m = tsSnap(c, tsBefore(c, g.fix));
  if (m.n !== g.fix.n || m.o !== g.fix.o) tsSet(g.fix, m);
}
function tsHdUp(st, e) { const g = st.hd; if (!g || g.id !== e.pointerId) return; st.hd = null; st.hds[g.k].classList.remove('drag'); TS.just = Date.now(); tsDraw(st); st.o.done?.(); }
function tsClear() { getSelection().removeAllRanges(); }

/* ---- Herramientas: seleccionar, subrayar arrastrando, zona y nota ---- */
function vwMode(m) { VW.mode = VW.mode === m && m !== 'sel' ? 'sel' : m; vwModeShow(); getSelection().removeAllRanges(); $('#vwSel').hidden = true; }
function vwModeShow() { document.querySelectorAll('#vw .vwm[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === VW.mode)); $('#vw').dataset.mode = VW.mode; lnInkShow(); }
/* Al cambiar el color de un subrayado (v39.45, ⋯ → 📖 Modo de lectura, PDF y EPUB): «ese y los siguientes» (como siempre: también pasa a ser
   el color para subrayar) o «solo ese» (el color para subrayar no cambia). Se recuerda en el dispositivo (gp-ann-col). */
const ANN_COL_K = 'gp-ann-col';
const annColOnly = () => { try { return localStorage.getItem(ANN_COL_K) === 'one'; } catch (e) { return false; } };
function annColSet(one) { try { localStorage.setItem(ANN_COL_K, one ? 'one' : 'next'); } catch (e) {} toast(one ? 'Cambiar el color de un subrayado ya no cambia el color para subrayar.' : 'Al cambiar el color de un subrayado, también será el color para los siguientes.', [], 2600); }
function vwColor(i) { if (VW.pop) { vwUpd(VW.pop, {c: VW_COLORS[i][0]}); if (annColOnly()) return; } VW.color = i; vwColorShow(); if (VW.mode === 'sel' && vwSelRange()) vwFromSel(i); }
function vwColorShow() { document.querySelectorAll('#vw .vwtb .vwc').forEach(b => b.classList.toggle('on', +b.dataset.c === VW.color)); }
function vwCaret(x, y) {
  let n = null, o = 0;
  if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { n = c.offsetNode; o = c.offset; } }
  else if (document.caretRangeFromPoint) { const c = document.caretRangeFromPoint(x, y); if (c) { n = c.startContainer; o = c.startOffset; } }
  if (!n || n.nodeType !== 3 || !n.parentElement?.closest('.textLayer')) return null;
  return {n, o};
}
function vwCaretAny(x, y) {   // como vwCaret, pero también fuera de la pantalla (caretPositionFromPoint solo ve lo que está a la vista)
  if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight) { const c = vwCaret(x, y); if (c) return c; }
  const inR = (r, m = 1) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m, rg = document.createRange();
  for (const tl of document.querySelectorAll('#vwPages .textLayer')) {
    if (!inR(tl.getBoundingClientRect())) continue;
    const w = document.createTreeWalker(tl, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!n.data.length) continue; rg.selectNodeContents(n); if (!inR(rg.getBoundingClientRect(), 2)) continue;
      for (let o = 0; o < n.data.length; o++) { rg.setStart(n, o); rg.setEnd(n, o + 1); const r = rg.getBoundingClientRect(); if (x < r.left + r.width / 2) return {n, o}; }
      return {n, o: n.data.length};
    }
  }
  return null;
}
const VW_WORD = /[\p{L}\p{N}_'’-]/u;
function vwSnap(c, start) {   // lleva el punto al principio (o al final) de la palabra
  const t = c.n.data; let o = c.o;
  if (start) while (o > 0 && VW_WORD.test(t[o - 1])) o--; else while (o < t.length && VW_WORD.test(t[o])) o++;
  return {n: c.n, o};
}
function vwUndo() { vwSaveComment(); getSelection().removeAllRanges(); undo(); }
/* Tiradores para alargar o acortar un subrayado por delante y por detrás: salen al tocarlo (con su ventanita) */
function vwHandles() {
  const a = VW.pop && vwAnns().find(x => x.id === VW.pop), d = $('#vw'); let hs = d.querySelectorAll('.vwhd:not(.tsh)');   // .tsh: los de la selección nueva (táctil), aparte
  if (VW.ext) return;
  const els = a && a.k === 'hl' ? [...document.querySelectorAll(`#vwPages .vwhl[data-a="${a.id}"]`)] : [];
  if (!els.length) { hs.forEach(h => h.hidden = true); return; }
  if (!hs.length) {
    for (const k of [0, 1]) { const h = document.createElement('div'); h.className = 'vwhd vwhd' + k; h.dataset.e = k; h.title = k ? 'Arrastra para alargar o acortar por detrás' : 'Arrastra para alargar o acortar por delante';
      h.addEventListener('pointerdown', vwHdDown); h.addEventListener('pointermove', vwHdMove); h.addEventListener('pointerup', vwHdUp); h.addEventListener('pointercancel', vwHdUp); d.append(h); }
    hs = d.querySelectorAll('.vwhd:not(.tsh)');
  }
  const D = d.getBoundingClientRect(), f = els[0].getBoundingClientRect(), l = els.at(-1).getBoundingClientRect();
  Object.assign(hs[0].style, {left: f.left - D.left + 'px', top: f.bottom - D.top + 'px', '--c': a.c}); Object.assign(hs[1].style, {left: l.right - D.left + 'px', top: l.bottom - D.top + 'px', '--c': a.c});
  hs.forEach(h => h.hidden = false);
}
function vwHdDown(e) {
  const h = e.currentTarget, a = vwAnns().find(x => x.id === VW.pop); if (!a) return; e.preventDefault(); e.stopPropagation();
  const R = [...document.querySelectorAll(`#vwPages .vwhl[data-a="${a.id}"]`)].map(x => x.getBoundingClientRect()); if (!R.length) return;
  const start = h.dataset.e === '0', o = start ? R.at(-1) : R[0], m = start ? R[0] : R.at(-1);
  const fix = vwCaretAny(start ? o.right - 1 : o.left + 1, o.top + o.height / 2); if (!fix) return;   // el otro extremo puede estar fuera de la pantalla (con zoom, sobre todo con el 🔒 candado, que no deja moverla)
  VW.ext = {id: a.id, start, fix, touch: e.pointerType !== 'mouse', dx: e.clientX - (start ? m.left : m.right), dy: e.clientY - (m.top + m.height / 2), pid: e.pointerId, hx: parseFloat(h.style.left), hy: parseFloat(h.style.top), x: e.clientX, y: e.clientY};
  VW.drag = {kind: 'ext', id: -1}; h.setPointerCapture(e.pointerId); h.classList.add('drag'); $('#vwPop').hidden = true;
}
function vwHdMove(e) {
  const x = VW.ext; if (!x || x.pid !== e.pointerId) return; const h = e.currentTarget;
  h.style.left = x.hx + e.clientX - x.x + 'px'; h.style.top = x.hy + e.clientY - x.y + 'px';
  let c = vwCaret(e.clientX - x.dx, e.clientY - x.dy); if (!c) return;
  const ord = x.fix.n === c.n ? x.fix.o <= c.o : !!(x.fix.n.compareDocumentPosition(c.n) & Node.DOCUMENT_POSITION_FOLLOWING); if (x.touch) c = vwSnap(c, !ord);   // con el dedo, palabras enteras
  const [A, B] = ord ? [x.fix, c] : [c, x.fix];
  const r = document.createRange(); r.setStart(A.n, A.o); r.setEnd(B.n, B.o); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function vwHdUp(e) {
  const x = VW.ext; if (!x || x.pid !== e.pointerId) return; VW.ext = null; VW.drag = null; e.currentTarget.classList.remove('drag');
  const r = e.type !== 'pointercancel' && vwSelRange(), parts = r ? vwRangeAnn(r) : [], t = r ? vwClean(r.toString()).slice(0, 4000) : '';
  getSelection().removeAllRanges(); $('#vwSel').hidden = true;
  if (parts.length) { const now = vwNow(); vwMut(l => { const a = l.find(y => y.id === x.id); if (!a) return; const [p0, ...more] = parts; Object.assign(a, {p: p0.p, q: p0.q, up: now}); if (t) a.t = t;
    for (const pp of more) l.push({id: uid(), k: 'hl', p: pp.p, q: pp.q, c: a.c, ...(t ? {t} : {}), at: now, up: now}); }); }
  vwPopOpen(x.id);
}
function vwDown(e) {
  if (VW.pinch || e.button > 0) return;
  if (e.target.closest('.vwnote')) { VW.tap = {x: e.clientX, y: e.clientY, t: Date.now()}; return; }   // tocar una nota la abre (también con el dedo)
  const p = vwPageOf(e.target); if (!p) { if (VW.flip || VW.auto) VW.tap = {x: e.clientX, y: e.clientY, t: Date.now()}; return; }   // modo de lectura: también los toques fuera de la página
  if (VW.mode === 'hl') { const c = vwCaret(e.clientX, e.clientY), sc = $('#vwScroll');
    if (e.pointerType !== 'mouse' && !e.target.closest('.textLayer span')) { VW.pan = {x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, id: e.pointerId}; e.preventDefault(); try { sc.setPointerCapture(e.pointerId); } catch (er) {} return; }   // con el dedo fuera del texto (márgenes, huecos): mueve la página
    VW.drag = {kind: 'hl', p, a: c, x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse'}; e.preventDefault(); $('#vwScroll').setPointerCapture(e.pointerId); getSelection().removeAllRanges(); }
  else if (VW.mode === 'ink') lnInkDown(e, p);
  else if (VW.mode === 'area') { VW.drag = {kind: 'area', p, x: e.clientX, y: e.clientY, id: e.pointerId}; e.preventDefault(); $('#vwScroll').setPointerCapture(e.pointerId); }
  else VW.tap = {x: e.clientX, y: e.clientY, t: Date.now()};
  if (VW.fs && !e.target.closest('.textLayer span')) { clearTimeout(VW.lpT); const x = e.clientX, y = e.clientY; VW.lpT = setTimeout(() => { if (VW.tap && !VW.drag) { VW.tap = null; vwBars(); } }, 550); }
}
function vwMove(e) {
  if (VW.tap && Math.hypot(e.clientX - VW.tap.x, e.clientY - VW.tap.y) >= 8) clearTimeout(VW.lpT);
  const pn = VW.pan; if (pn && pn.id === e.pointerId) { if (VW.zLock) return; const sc = $('#vwScroll'); sc.scrollLeft = pn.l - (e.clientX - pn.x); sc.scrollTop = pn.t - (e.clientY - pn.y); return; }
  const g = VW.drag; if (!g || g.id !== e.pointerId) return;
  if (g.kind === 'hl') {
    const c = vwCaret(e.clientX, e.clientY); if (!c) return; g.a ||= c; if (!g.a) return;
    const r = document.createRange(), s = getSelection(), ord = g.a.n === c.n ? g.a.o <= c.o : !!(g.a.n.compareDocumentPosition(c.n) & Node.DOCUMENT_POSITION_FOLLOWING);
    let [A, B] = ord ? [g.a, c] : [c, g.a]; if (g.touch) { A = vwSnap(A, true); B = vwSnap(B, false); }   // con el dedo, palabras enteras (luego se afina con los tiradores)
    r.setStart(A.n, A.o); r.setEnd(B.n, B.o); s.removeAllRanges(); s.addRange(r);
  } else if (g.kind === 'ink') lnInkMove(e, g);
  else if (g.kind === 'area') {
    let box = $('#vwBox'); if (!box) { box = document.createElement('div'); box.id = 'vwBox'; document.body.append(box); }
    const d = $('#vw'); if (box.parentElement !== d) d.append(box);
    Object.assign(box.style, {left: Math.min(g.x, e.clientX) + 'px', top: Math.min(g.y, e.clientY) + 'px', width: Math.abs(e.clientX - g.x) + 'px', height: Math.abs(e.clientY - g.y) + 'px', '--c': VW_COLORS[VW.color][0]});
  }
}
function vwUp(e) {
  clearTimeout(VW.lpT);
  const pn = VW.pan; if (pn && pn.id === e.pointerId) { VW.pan = null; const hp = !!VW.pop; if (e.type !== 'pointercancel' && Math.hypot(e.clientX - pn.x, e.clientY - pn.y) < 8 && !vwConcTap() && !vwTapAt(e.clientX, e.clientY) && !vwReadTap(e.clientX, e.clientY, hp)) vwEmptyTap(e.clientX, e.clientY); return; }
  const g = VW.drag; if (e.type === 'pointercancel') { if (g?.kind === 'ink') lnInkUp(g, true); VW.drag = null; VW.tap = null; $('#vwBox')?.remove(); return; }
  if (g && g.id === e.pointerId) {
    VW.drag = null; $('#vwBox')?.remove();
    if (g.kind === 'ink') return lnInkUp(g);
    if (g.kind === 'hl') { if (vwSelRange()) vwFromSel(VW.color); else vwTapAt(e.clientX, e.clientY); return; }
    if (g.kind === 'area') {
      const p = g.p, pr = vwVisRect(p), cl = (v, a, b) => Math.min(b, Math.max(a, v));
      const l = cl(Math.min(g.x, e.clientX), pr.left, pr.right), r = cl(Math.max(g.x, e.clientX), pr.left, pr.right), t = cl(Math.min(g.y, e.clientY), pr.top, pr.bottom), b = cl(Math.max(g.y, e.clientY), pr.top, pr.bottom);
      if (r - l < 6 || b - t < 6) return vwTapAt(e.clientX, e.clientY);
      const id = uid(), now = vwNow(); vwAdd({id, k: 'area', p: p.i, q: vwRectToPdf(p, l, t, r, b), c: VW_COLORS[VW.color][0], at: now, up: now}); vwFlash(id); return;
    }
  }
  const tp = VW.tap; VW.tap = null;
  if (tp && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 8) {
    if (vwConcTap()) return;
    const n = e.target.closest?.('.vwnote'); if (n) return vwPopOpen(n.dataset.a);
    if (VW.mode === 'note') { const p = vwPageAt(e.clientX, e.clientY); if (!p) return; const [x, y] = vwToPdf(p, e.clientX, e.clientY), id = uid(), now = vwNow();
      vwAdd({id, k: 'note', p: p.i, q: [x, y, x, y], c: VW_COLORS[VW.color][0], at: now, up: now}); return vwPopOpen(id, true); }
    if (!vwSelRange()) { const hp = !!VW.pop; if (VW.mode === 'sel' && lnTap(e.clientX, e.clientY) || vwTapAt(e.clientX, e.clientY) || vwReadTap(e.clientX, e.clientY, hp)) return; vwEmptyTap(e.clientX, e.clientY); }
    else if ($('#vw').classList.contains('tsel') && !tsJust()) { tsClear(); $('#vwSel').hidden = true; }   // táctil: tocar fuera quita la selección (el navegador ya no lo hace)
  }
}
function vwTapAt(x, y) {   // tocar un subrayado o una zona abre su ventanita
  const m = document.documentElement.classList.contains('mv') || matchMedia('(pointer: coarse)').matches ? 10 : 2;   // con el dedo, más margen
  const hit = [...document.querySelectorAll('#vw .vwhl, #vw .vwcmk')].reverse().find(el => { const r = el.getBoundingClientRect(); return x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m; });
  if (hit) vwPopOpen(hit.dataset.a); else if (VW.pop) vwPopClose();
  return !!hit;
}

/* ---- Ventanita de una anotación: color, comentario, copiar, a las notas del paper, borrar ---- */
function vwPopOpen(id, focus) {
  vwSaveComment(); const a = vwAnns().find(x => x.id === id); if (!a) return;
  VW.pop = id; const pp = $('#vwPop'), paper = vwPaper(), P = paper && db.papers.find(p => p.id === paper.id);
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">${a.k === 'note' ? '🗒 Nota' : a.k === 'area' ? '▭ Zona' : a.k === 'ink' ? '✏ Trazo a mano' : '🖍 Subrayado'} · p. ${a.p + 1}${annLbl(a.c) ? ' · ' + esc(annLbl(a.c)) : ''}</span><span class="vwcs">${VW_COLORS.map(([c, t], i) => `<button class="vwc${a.c === c ? ' on' : ''}" style="--c:${c}" title="${t}" aria-label="Color ${t}" data-onclick="vwPopColor(${i})"></button>`).join('')}</span><button class="vwib" data-onclick="vwPopClose()" aria-label="Cerrar">✕</button></div>
    ${a.t ? `<blockquote class="vwq">${esc(a.t.length > 400 ? a.t.slice(0, 400) + '…' : a.t)}</blockquote>` : ''}
    <textarea id="vwCm" rows="3" placeholder="${a.k === 'note' ? 'Escribe la nota…' : 'Comentario (opcional)…'}" data-oninput="vwCmIn()">${esc(a.m || '')}</textarea>
    <div class="row vwpopb">${a.k === 'hl' ? lnStyRow(a, 'vwPopStyle') : ''}${vxAreaBtns(a)}${a.t ? '<button data-onclick="vwPopCopy()" title="Copiar el texto subrayado">📋 Copiar</button>' : ''}${P ? '<button data-onclick="vwToNote()" title="Añadir a las notas del paper, con la página, para citarlo">📝 A las notas</button>' : ''}<button class="danger" data-onclick="vwPopDel()">🗑 Borrar</button></div>`;
  pp.hidden = false; vwPopPlace(); document.querySelectorAll('#vw .on[data-a]').forEach(e => e.classList.remove('on')); document.querySelectorAll(`#vw [data-a="${id}"]`).forEach(e => e.classList.add('on'));
  if (focus) setTimeout(() => $('#vwCm')?.focus(), 30);
  vwHandles();
}
function vwPopPlace() {
  const pp = $('#vwPop'), el = document.querySelector(`#vwPages [data-a="${VW.pop}"]`), d = $('#vw').getBoundingClientRect();
  if (document.documentElement.classList.contains('mv')) { pp.style.left = pp.style.top = ''; return; }   // en el móvil es una hoja abajo (movil: CSS)
  const r = el ? el.getBoundingClientRect() : {left: d.width / 2, bottom: 120, top: 120}, w = pp.offsetWidth, h = pp.offsetHeight;
  let x = Math.min(Math.max(8, r.left), d.width - w - 8), y = r.bottom + 8; if (y + h > d.height - 8) y = Math.max(56, r.top - h - 8);
  y = Math.min(Math.max(56, y), Math.max(56, d.height - h - 8));   // siempre dentro de la pantalla, aunque la anotación no se vea
  pp.style.left = x + 'px'; pp.style.top = y + 'px'; vwHandles();
}
function vwPopClose() { vwSaveComment(); VW.pop = null; document.querySelectorAll('#vw .vwhd:not(.tsh)').forEach(h => h.hidden = true); const pp = $('#vwPop'); if (pp) pp.hidden = true; document.querySelectorAll('#vw .on[data-a]').forEach(e => e.classList.remove('on')); }
function vwCmIn() { clearTimeout(VW.cmT); VW.cmT = setTimeout(vwSaveComment, 700); }
function vwSaveComment() {   // el comentario se guarda al dejar de escribir (y al cerrar)
  clearTimeout(VW.cmT); const t = $('#vwCm'); if (!t || !VW.pop) return; const a = vwAnns().find(x => x.id === VW.pop); if (!a) return;
  const v = t.value.slice(0, 20000); if ((a.m || '') === v) return;
  vwUpd(a.id, {m: v}, true); vwMut(l => { const x = l.find(y => y.id === a.id); if (x && !x.m) delete x.m; }, true);
  document.querySelectorAll(`#vw [data-a="${a.id}"]`).forEach(e => { e.classList.toggle('cm', !!v); if (e.classList.contains('vwnote')) e.title = v || 'Nota'; }); if (VW.side) vwSideDraw();
}
function vwPopColor(i) { const id = VW.pop; if (!annColOnly()) { VW.color = i; vwColorShow(); } vwUpd(id, {c: VW_COLORS[i][0]}); vwPopOpen(id); }
async function vwPopDel() {
  const a = vwAnns().find(x => x.id === VW.pop); if (!a) return; $('#vwCm') && ($('#vwCm').value = a.m || '');
  vwPopClose(); vwDel(a.id); toast('Anotación borrada.', [{t: 'Deshacer', fn: () => undo()}], 4000);
}
async function vwPopCopy() { const a = vwAnns().find(x => x.id === VW.pop); if (a?.t) { await clipText(a.t, $('#vw')); toast('Texto copiado.', [], 1500); } }

/* ---- Panel de anotaciones: lista por página, filtros, ir a cada una ---- */
const vwSideOn = () => { try { return localStorage.getItem('gp-vw-side') !== '0'; } catch (e) { return true; } };
function vwSide(on) { VW.side = on ?? !VW.side; try { localStorage.setItem('gp-vw-side', VW.side ? '1' : '0'); } catch (e) {} vwSideShow(); }
function vwSideShow() { const s = $('#vwSide'); s.hidden = !VW.side; $('#vw').classList.toggle('side', VW.side); document.querySelector('#vw .vwsb')?.classList.toggle('on', VW.side && VW.tab === 'ann'); document.querySelector('#vw .vwtc')?.classList.toggle('on', VW.side && (VW.tab === 'toc' || VW.tab === 'th')); if (VW.side) vwSideDraw(); else VW.thIo?.disconnect(); }
const VW_TABS = [['ann', '💬 Anotaciones'], ['toc', '📑 Índice'], ['th', '▦ Páginas']];
function vwPanel(t) { if (VW.side && VW.tab === t) return vwSide(false); VW.tab = t; VW.side ? vwSideShow() : vwSide(true); }
function vwTab(t) { VW.tab = t; vwSideShow(); }
const vwKindOf = a => a.k === 'note' ? 'note' : 'hl';   // las notas 🗒, aparte de los subrayados y zonas
const vwSideList = () => { const f = VW.filt, k = VW.kind; const T = new Map(); return vwAnns().filter(a => (!f || (f === 'cm' ? a.m : a.c === f)) && (!k || vwKindOf(a) === k)).map(a => (T.set(a, vwTop(a)), a)).sort((a, b) => a.p - b.p || T.get(a) - T.get(b)); };   // la altura, una vez por anotación
function vwSideDraw() {
  const s = $('#vwSide'), t = VW.tab || 'ann';
  const tabs = VW.find.hits.length || t === 'find' ? [...VW_TABS, ['find', `🔍 ${VW.find.hits.length || ''}`]] : VW_TABS;   // v39.50: los resultados de la búsqueda, solo si hay
  const head = `<div class="vwst"><div class="vwstt" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${t === k}" class="${t === k ? 'on' : ''}${k === 'find' ? ' lntab' : ''}" data-onclick="vwTab('${k}')">${n}</button>`).join('')}</div><button class="vwib" data-onclick="vwSide(false)" aria-label="Cerrar el panel">✕</button></div>`;
  if (t === 'toc') return vwTocDraw(s, head);
  if (t === 'th') return vwThDraw(s, head);
  if (t === 'find') return lnFindDraw(s, head);
  if (t === 'fig') return vxFigDraw(s, head);   // v40.8
  vwAnnDraw(s, head);
}
function vwAnnDraw(s, head) {
  const all = vwAnns(), f = VW.filt, k = VW.kind || '', L = vwSideList(), nH = all.filter(a => vwKindOf(a) === 'hl').length, nN = all.length - nH;
  const fr = VW.foreign || [], frV = fr.filter(x => !x.dup && !all.some(a => a.src === x.id));
  const pk = VW.pick, n = pk?.size || 0;
  const item = a => `<button class="vwi${VW.pop === a.id || pk?.has(a.id) ? ' on' : ''}" style="--c:${a.c}" data-onclick="vwPick('${a.id}')"${pk ? ` aria-pressed="${pk.has(a.id)}"` : ''}><small>${pk ? (pk.has(a.id) ? '☑ ' : '☐ ') : ''}p. ${a.p + 1} · ${a.k === 'note' ? '🗒 Nota' : a.k === 'area' ? '▭ Zona' : a.k === 'ink' ? '✏ Trazo' : '🖍'}</small>${a.t ? `<span class="vwit">${esc(a.t.length > 220 ? a.t.slice(0, 220) + '…' : a.t)}</span>` : ''}${a.m ? `<span class="vwim">💬 ${esc(a.m.length > 300 ? a.m.slice(0, 300) + '…' : a.m)}</span>` : ''}</button>`;
  const grp = !k && nH && nN ? [['hl', '🖍 Subrayados'], ['note', '🗒 Notas']].map(([g, n]) => { const G = L.filter(a => vwKindOf(a) === g); return G.length ? `<h4 class="vwgh">${n} (${G.length})</h4>${G.map(item).join('')}` : ''; }).join('') : L.map(item).join('');
  s.innerHTML = `${head}<div class="vwsh">${all.length ? `<span class="vwkd" role="group" aria-label="Tipo"><button class="${k ? '' : 'on'}" data-onclick="vwKind('')">Todas ${all.length}</button><button class="${k === 'hl' ? 'on' : ''}" data-onclick="vwKind('hl')" title="Subrayados y zonas">🖍 Subrayados ${nH}</button><button class="${k === 'note' ? 'on' : ''}" data-onclick="vwKind('note')" title="Notas adhesivas">🗒 Notas ${nN}</button></span><button class="vwpk${pk ? ' on' : ''}" data-onclick="vwPickToggle()" title="Elegir varias para borrarlas, copiarlas o llevarlas a las notas">${pk ? '✓ Elegir' : '☐ Elegir'}</button>` : '<b>Anotaciones</b>'}</div>
    ${pk ? `<div class="vwpkb"><button data-onclick="vwPickAll()">${L.length && L.every(a => pk.has(a.id)) ? '☐ Ninguna' : '☑ Todas las de la lista'}</button><button class="danger" data-onclick="vwPickDel()" ${n ? '' : 'disabled'}>🗑 Borrar${n ? ` (${n})` : ''}</button></div>` : ''}
    <div class="vwsf"><button class="${f ? '' : 'on'}" data-onclick="vwFilt('')">Todas</button>${annFiltChips(all, f, 'vwFilt')}<button class="${f === 'cm' ? 'on' : ''}" data-onclick="vwFilt('cm')" title="Solo las que tienen comentario">💬</button></div>
    <div class="vwsl">${L.length ? grp
      : `<p class="empty">${all.length ? 'Ninguna con este filtro.' : 'Aún no hay anotaciones. Selecciona texto y elige un color, o usa 🖍 Subrayar, ▭ Zona o 🗒 Nota.'}</p>`}</div>
    ${frV.length ? `<details class="vwfr"><summary>${frV.length} ${frV.length === 1 ? 'anotación que ya traía' : 'anotaciones que ya traía'} el PDF</summary>${frV.slice(0, 300).map(x => `<button class="vwi" style="--c:${x.c}" data-onclick="vwGoForeign('${x.id}')"><small>p. ${x.p + 1} · ${esc(x.sub)}${x.who ? ' · ' + esc(x.who) : ''}</small>${x.m ? `<span class="vwim">${esc(x.m.slice(0, 300))}</span>` : ''}</button>`).join('')}<button class="pri" data-onclick="vwImport()" title="Pasan a ser tuyas: se pueden cambiar, comentar y sincronizar">Hacerlas editables</button></details>` : ''}
    ${all.length ? `<div class="vwsx vwexp"><small>${n ? `${n} ${n === 1 ? 'elegida' : 'elegidas'}` : f || k ? 'Las del filtro' : 'Todas'}:</small><select data-onchange="vwExpFmt(this.value)" aria-label="Formato" title="Formato al copiar o llevar a las notas">${ANN_FMTS.map(([k, t]) => `<option value="${k}" ${db.settings.annFmt === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button data-onclick="vwExpCopy()" title="Copiar al portapapeles, para pegarlas en otro sitio">📋 Copiar</button><button data-onclick="vwExpNotes()" title="${n || f || k ? 'Añadirlas como nota nueva del paper' : 'Una nota «Anotaciones del PDF» en el paper: si ya existe, se actualiza'}">📝 A las notas</button><button data-onclick="vwExpMd()" title="Descargar como resumen en Markdown">⬇ .md</button><button data-onclick="vxAnki()" title="Tarjetas para Anki: el texto subrayado delante; el comentario y la cita detrás">🃏 Anki</button></div>` : ''}
    <div class="vwsx"><button data-onclick="vwOut()" title="Descargar el PDF con los subrayados y comentarios dentro (se ven en Acrobat, Foxit y otros lectores)">⬇ PDF anotado</button></div>`;
}
const vwTop = a => { const p = VW.pages[a.p], b = p && vwBoxes(p, a.q, true)[0]; return b ? b.y : 0; };
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
function vwGoSide(i) { if (!VW.pages[i]) return; if (i !== VW.cur) lnPush(); vwGo(i); if (vwMv()) vwSide(false); }   // en el móvil el panel tapa la página: se cierra
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
    const W = 110 * Math.min(devicePixelRatio || 1, 2), vp = vwGV(p, {scale: W / vwGV(p, {scale: 1}).width});
    const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, pageColors: vwPC()}).promise; if (gen !== VW.gen) return;
    b.querySelector('.vwtc0')?.replaceWith(cv);
  } catch (e) {}
}
function vwThCur() { const b = document.querySelector('#vwSide .vwth'); if (!b) return; b.querySelector('.vwtp.on')?.classList.remove('on'); b.querySelector(`.vwtp[data-i="${VW.cur}"]`)?.classList.add('on'); }

/* ---- Modo noche: fondo oscuro y letra clara; las imágenes del PDF no se tocan ---- */
const vwNightPref = () => { try { return localStorage.getItem('gp-vw-night') || 'off'; } catch (e) { return 'off'; } };
const vwNightOn = () => { const p = vwNightPref(); return p === 'on' || p === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches; };
const vwPC = () => VW.night ? {background: '#1c1e23', foreground: '#dcdde1'} : VW.theme === 'sepia' ? {background: '#f4ecd8', foreground: '#433422'} : null;   // v39.51: también sepia
function vwNight(v) { try { localStorage.setItem('gp-vw-night', v); } catch (e) {} vwNightApply(); }
function vwNightApply() {
  const th = vwTheme(); if (!VW.open || VW.theme === th) return; VW.theme = th; VW.night = th === 'night'; $('#vw').classList.toggle('night', VW.night); $('#vw').classList.toggle('sepia', th === 'sepia');
  VW.pages.forEach(p => { if (p.cv) { p.rs = 0; VW.queue.add(p.i); } }); vwPump(); if (VW.side && VW.tab === 'th') vwSideDraw(); p2Redraw();
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => vwNightApply()); } catch (e) {}
function vwJump(id) {
  const a = vwAnns().find(x => x.id === id); if (!a) return; const p = VW.pages[a.p]; if (!p) return;
  const b = vwBoxes(p, a.q, true)[0]; lnPush(); vwShowAt(p, b ? b.y : 0);   // v40.8: con «atrás»
  if (document.documentElement.classList.contains('mv')) vwSide(false);
  setTimeout(() => { vwFlash(id); vwPopOpen(id); }, 120);
}

/* ---- Anotaciones que ya traía el PDF (Acrobat, Foxit…): se ven en la página y se listan; «Hacerlas editables» las copia como propias ---- */
const VW_FSUB = {Highlight: '🖍 Resaltado', Underline: '⎁ Subrayado', StrikeOut: '⌿ Tachado', Squiggly: '〰 Ondulado', Text: '🗒 Nota', FreeText: '🅃 Texto', Square: '▭ Rectángulo', Circle: '◯ Elipse', Ink: '✎ Dibujo', Polygon: '⬠ Polígono', Stamp: '🏷 Sello', Caret: '‸ Inserción'};
const vwIdle = fn => window.requestIdleCallback ? requestIdleCallback(() => fn(), {timeout: 1500}) : setTimeout(fn, 300);
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
        out.push({id: a.id, p: p.i, sub: VW_FSUB[a.subtype], k: a.subtype === 'Text' || a.subtype === 'FreeText' ? 'note' : /Highlight|Underline|StrikeOut|Squiggly/.test(a.subtype) ? 'hl' : a.subtype === 'Ink' && a.inkLists?.length ? 'ink' : 'area', ...(a.subtype === 'Ink' && a.inkLists?.length ? {g: a.inkLists.slice(0, 60).map(s => [...s].slice(0, 2000))} : {}),
          q: a.subtype === 'Text' ? [a.rect[0], a.rect[3], a.rect[0], a.rect[3]] : q, c, ...(a.subtype === 'Underline' ? {s: 'u'} : a.subtype === 'StrikeOut' ? {s: 'x'} : {}), m: a.contentsObj?.str || '', who: a.titleObj?.str || ''}); }
    } catch (e) {}
    if (p.i % (VW.lite ? 3 : 10) === (VW.lite ? 2 : 9)) await new Promise(r => vwIdle(r));
  }
  if (gen !== VW.gen) return; VW.foreign = out; vwHideDups(); if (VW.side) vwSideDraw(); vwForeignAsk();
}
const vwSeenK = () => VW.src ? 'gp-vw-fseen:' + vwSrcKey(VW.src) : '';
const vwSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(vwSeenK()) || '[]')); } catch (e) { return new Set(); } };
function vwSeenAdd(ids) { const S = vwSeen(); ids.forEach(i => S.add(String(i))); try { localStorage.setItem(vwSeenK(), JSON.stringify([...S].slice(-500))); } catch (e) {} }
function vwForeignNew() {   // las que hizo otro programa (Acrobat, Foxit…) y aún no se trajeron ni se descartaron; las que escribió GPapers no cuentan
  const mine = vwAnns(), S = vwSeen();
  return (VW.foreign || []).filter(f => !f.dup && f.who !== VW_AUTHOR && !mine.some(a => a.src === f.id) && !S.has(String(f.id)));
}
function vwForeignAsk() {
  const L = vwForeignNew(), n = L.length; if (!n) return; const ids = L.map(f => f.id);
  toast(`${n === 1 ? 'Hay 1 anotación nueva hecha' : `Hay ${n} anotaciones nuevas hechas`} en otro programa (Acrobat, Foxit…): ¿traerla${n === 1 ? '' : 's'}?`, [{t: 'Traer', fn: () => { vwImport(ids); vwSeenAdd(ids); }}, {t: 'Ahora no', fn: () => vwSeenAdd(ids)}], 0);
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
function vwGoForeign(id) { const f = VW.foreign?.find(x => x.id === id), p = f && VW.pages[f.p]; if (!p) return; const b = vwBoxes(p, f.q, true)[0]; lnPush(); vwShowAt(p, b ? b.y : 0); }
function vwNear(hex) {   // el color de la paleta más parecido
  const h = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16)), a = h(hex);
  return VW_COLORS.map(([c]) => c).sort((x, y) => h(x).reduce((s, v, k) => s + (v - a[k]) ** 2, 0) - h(y).reduce((s, v, k) => s + (v - a[k]) ** 2, 0))[0];
}
function vwImport(ids) {   // ids: solo esas (si no, todas las que traía el PDF)
  const mine = vwAnns(), L = (VW.foreign || []).filter(f => !f.dup && !mine.some(a => a.src === f.id) && (!ids || ids.includes(f.id))); if (!L.length) return;
  const now = vwNow(); vwMut(l => { for (const f of L) l.push({id: uid(), k: f.k, p: f.p, q: f.q.map(v => Math.round(v * 100) / 100), c: vwNear(f.c), ...(f.s ? {s: f.s} : {}), ...(f.g ? {g: f.g.map(s => s.map(v => Math.round(v * 10) / 10))} : {}), ...(f.m ? {m: f.m} : {}), src: String(f.id).slice(0, 60), at: now, up: now}); });
  vwHideDups(); toast(`${L.length} ${L.length === 1 ? 'anotación ahora es editable' : 'anotaciones ahora son editables'}.`, [], 3000);
}

/* ---- Buscar en el PDF ---- */
function vwFindToggle(on) { VW.findOpen = on ?? !VW.findOpen; $('#vw').classList.toggle('find', VW.findOpen); if (VW.findOpen) { $('#vwQ').focus(); $('#vwQ').select(); } else { vwFindReset(true); } }
function vwFindReset(clear) { const had = VW.find.hits.length; VW.find.hits = []; VW.find.i = -1; $('#vwQn').textContent = ''; if (had || clear) { lnFindUi(); vxMapDraw(); } document.querySelectorAll('#vw .vwfh').forEach(e => e.remove()); if (clear) { $('#vwQ').value = ''; VW.find.q = ''; } }
async function vwFindKey(e) { if (e.key === 'Enter') { e.preventDefault(); await vwFind(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); vwFindToggle(false); } }
async function vwPageText(p) {   // texto de una página y, para cada letra, el trozo de texto de donde viene
  if (VW.find.txt.has(p.i)) return VW.find.txt.get(p.i);
  p.proxy ||= await VW.doc.getPage(p.i + 1); const tc = await p.proxy.getTextContent(); let items = tc.items.filter(x => typeof x.str === 'string');
  if (!items.some(x => x.str.trim()) && VX.ocr.has(p.i)) { vwVp(p); items = vxOcrItems(p) || []; }   // v40.8: un escaneado con el texto reconocido
  let s = ''; const map = []; for (const it of items) { const n = norm(it.str); for (let k = 0; k < n.length; k++) map.push([it, k / Math.max(1, n.length), (k + 1) / Math.max(1, n.length)]); s += n; if (it.hasEOL) { s += ' '; map.push(null); } }
  const r = {s, map}; VW.find.txt.set(p.i, r); return r;
}
async function vwFind(dir) {
  const q = norm($('#vwQ').value.trim()); if (!q || !VW.doc) return;
  if (q !== VW.find.q) {
    VW.find.q = q; VW.find.hits = []; VW.find.i = -1; $('#vwQn').textContent = 'Buscando…'; const gen = VW.gen;
    for (const p of VW.pages) { if (gen !== VW.gen || VW.find.q !== q) return; const {s, map} = await vwPageText(p); let k = s.indexOf(q);
      while (k >= 0) { VW.find.hits.push({p: p.i, k, n: q.length, map}); k = s.indexOf(q, k + 1); } }
    VW.find.i = -1; document.querySelectorAll('#vw .vwfh').forEach(e => e.remove()); VW.pages.forEach(p => p.tl && vwFindMark(p)); lnFindUi(); vxMapDraw();
  }
  const H = VW.find.hits; if (!H.length) { $('#vwQn').textContent = 'Sin resultados'; return; }
  let j; if (VW.find.i < 0) { j = H.findIndex(h => h.p >= VW.cur); j = dir > 0 ? (j < 0 ? 0 : j) : (j <= 0 ? H.length - 1 : j - 1); }
  else j = (VW.find.i + dir + H.length) % H.length;
  if (LN.findQ !== VW.find.q) { lnPush(); LN.findQ = VW.find.q; }   // v40.8: «atrás» vuelve a donde estabas antes de buscar
  vwFindGo(j); if (VW.side && VW.tab === 'find') lnFindCur();
}
function vwFindGo(j) {   // a un resultado (también desde la lista del panel, v39.50)
  const H = VW.find.hits, h = H[j]; if (!h) return; VW.find.i = j; const p = VW.pages[h.p]; $('#vwQn').textContent = `${j + 1} de ${H.length}`;
  const b = vwHitBoxes(p, h)[0]; vwShowAt(p, b ? b.y : 0);
  document.querySelectorAll('#vw .vwfh.cur').forEach(e => e.classList.remove('cur')); vwFindMark(p); document.querySelectorAll(`#vw .vwfh[data-h="${j}"]`).forEach(e => e.classList.add('cur'));
}
function vwHitBoxes(p, h) {   // cajas aproximadas de un resultado (por trozo de texto, recortadas en proporción a las letras)
  const v = p.vp1 || (p.proxy ? vwGV(p, {scale: 1}) : null); if (!v) return []; const by = new Map();
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
