'use strict';
/* ===== Más cómodo para leer (v39.50, PDF y EPUB) =====
   · Enlaces del PDF: tocar «[12]», «Fig. 3» o «Sección 2» salta a su sitio (antes no hacían nada: el visor no leía los enlaces del PDF).
     Por defecto sale antes una vista previa del destino (la referencia de la bibliografía, la figura…) sin moverse de donde lees, con
     «➜ Ir allí». Los enlaces a internet piden confirmación. ⚙ Ajustes del visor → 🔗: vista previa o ir directamente.
     En el EPUB, lo mismo con sus enlaces internos (las llamadas a nota ya tenían su ventanita).
   · «↩ Volver»: después de saltar (enlace, índice, lista de resultados) sale un botón para volver a donde estabas (también Alt + ←).
     Solo se ve mientras hay adonde volver, así que no ocupa sitio.
   · Pantalla encendida (Wake Lock): mientras lees, la pantalla no se apaga sola; se apaga tras 5 minutos sin tocar nada. Con el
     desplazamiento automático en marcha, nunca. ⚙ Ajustes del visor → 🔆 (mientras lees, solo con el automático o como el sistema).
   · Lista de resultados de la búsqueda: el botón ☰ junto a «3 de 27» abre en el panel cada resultado con su página (o capítulo) y la
     frase donde aparece, para ir directamente al que interesa.
   Preferencias en este dispositivo: gp-vw-link ('prev' | 'go') y gp-vw-wake ('read' | 'auto' | 'off'). */
const LN_K = 'gp-vw-link', WL_K = 'gp-vw-wake', WL_IDLE = 5 * 60e3;
const LN = {back: [], ep: [], t: null, findQ: null};
const lnPref = () => { try { return localStorage.getItem(LN_K) === 'go' ? 'go' : 'prev'; } catch (e) { return 'prev'; } };
function lnSet(v) { try { localStorage.setItem(LN_K, v === 'go' ? 'go' : 'prev'); } catch (e) {} }
const wlPref = () => { try { const v = localStorage.getItem(WL_K); return v === 'auto' || v === 'off' ? v : 'read'; } catch (e) { return 'read'; } };
function wlSetPref(v) { try { localStorage.setItem(WL_K, v); } catch (e) {} wlSync(); }
function rdCfgHtml(b, ep) {   // lo de esta parte en ⚙ Ajustes del visor (PDF y EPUB)
  const lp = lnPref(), wp = wlPref();
  return `<hr><button data-keep data-onclick="annLblMenu(${ep ? 'true' : 'false'})">🏷 Significado de los colores <small class="vwsub">${Object.keys(annLbls()).length || 'sin nombres'} ›</small></button>
    ${b(lnLeftOn(), `lnLeftSet(${lnLeftOn() ? 0 : 1})`, '⏱ Ver el tiempo que falta para terminar (≈, a tu ritmo)')}
    <hr><div class="ctxh">🔗 Al tocar un enlace o una cita</div>${b(lp === 'prev', "lnSet('prev')", '👁 Ver antes una vista previa', 'La referencia, la figura o la nota salen en una ventanita sin moverte de donde lees')}${b(lp === 'go', "lnSet('go')", '➜ Ir directamente (con ↩ Volver)')}
    ${'wakeLock' in navigator ? `<hr><div class="ctxh">🔆 Pantalla encendida</div>${[['read', 'Mientras lees (se apaga tras 5 min sin tocar)'], ['auto', 'Solo mientras la página baja sola (⏬)'], ['off', 'Como el sistema']].map(([v, t]) => b(wp === v, `wlSetPref('${v}')`, t)).join('')}` : ''}`;
}

/* ---- Pantalla encendida ---- */
const WL = {lock: null, act: 0, t: 0, busy: false};
const rdOpen = () => VW.open || typeof EP !== 'undefined' && EP.open;
function wlWant() {
  if (document.hidden || !('wakeLock' in navigator) || !rdOpen()) return false; const p = wlPref(); if (p === 'off') return false;
  const auto = SAY.on && !SAY.paused || VW.open && VW.auto && !VW.autoPaused || typeof EP !== 'undefined' && EP.open && EP.auto && !EP.autoPaused;
  return auto || p === 'read' && Date.now() - WL.act < WL_IDLE;
}
async function wlSync() {
  clearTimeout(WL.t); const want = wlWant();
  if (want && wlPref() === 'read') WL.t = setTimeout(wlSync, Math.max(1000, WL.act + WL_IDLE - Date.now() + 50));   // a los 5 min sin tocar, se suelta
  if (want && !WL.lock && !WL.busy) {
    WL.busy = true;
    try { const l = await navigator.wakeLock.request('screen'); WL.lock = l; l.addEventListener('release', () => { if (WL.lock === l) WL.lock = null; }); } catch (e) {}
    WL.busy = false; if (!wlWant() && WL.lock) wlSync();
  } else if (!want && WL.lock) { const l = WL.lock; WL.lock = null; l.release().catch(() => {}); }
}
function wlPoke() { const n = Date.now(), quick = n - WL.act < 1000 && WL.lock; WL.act = n; if (!quick) wlSync(); }
for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(t, () => { if (rdOpen()) wlPoke(); }, {capture: true, passive: true});
document.addEventListener('visibilitychange', () => { if (!document.hidden && rdOpen()) WL.act = Date.now(); wlSync(); });   // el sistema suelta el bloqueo al cambiar de app

/* ---- Enlaces del PDF ---- */
function lnLoad(p) {   // los enlaces de una página (una sola vez; PDF.js guarda sus anotaciones)
  if (p.links || p.lnGet || !p.proxy) return; const gen = VW.gen;
  p.lnGet = p.proxy.getAnnotations({intent: 'display'}).then(L => { if (gen !== VW.gen) return;
    p.links = L.filter(a => a.subtype === 'Link' && a.rect && (a.dest || a.url)).map(a => ({r: a.rect, dest: a.dest || null, url: a.url || null})); }, () => { p.links = []; }).finally(() => { p.lnGet = null; });
}
function lnAt(x, y) {   // el enlace que hay en un punto de la pantalla
  const p = vwPageAt(x, y); if (!p) return null; if (!p.links) { lnLoad(p); return null; } if (!p.links.length) return null;
  const [px, py] = vwToPdf(p, x, y), m = (tsWant() ? 6 : 1.5) / Math.max(.3, VW.scale);   // con el dedo, más margen
  const l = p.links.find(l => px >= l.r[0] - m && px <= l.r[2] + m && py >= l.r[1] - m && py <= l.r[3] + m);
  return l ? {p, l} : null;
}
async function lnDest(d) {   // destino de un enlace → {i: página, x, y: punto en puntos de la página como se ve}
  const doc = VW.doc; if (!doc) return null;
  try { if (typeof d === 'string') d = await doc.getDestination(d); } catch (e) { return null; }
  if (!Array.isArray(d)) return null; const r = d[0]; let i = null;
  try { i = r && typeof r === 'object' ? await doc.getPageIndex(r) : Number.isInteger(r) ? r : null; } catch (e) {}
  const p = i == null ? null : VW.pages[i]; if (!p) return null;
  try { p.proxy ||= await doc.getPage(i + 1); } catch (e) { return null; } const v = vwVp(p), k = d[1]?.name;
  let X = null, Y = null; if (k === 'XYZ') { X = d[2]; Y = d[3]; } else if (k === 'FitH' || k === 'FitBH') Y = d[2]; else if (k === 'FitR') { X = d[2]; Y = d[5]; } else if (k === 'FitV' || k === 'FitBV') X = d[2];
  const num = n => typeof n === 'number' && Number.isFinite(n), [vx, vy] = v.convertToViewportPoint(num(X) ? X : 0, num(Y) ? Y : v.viewBox[3]);
  return {i, x: num(X) ? Math.max(0, Math.min(p.w, vx)) : null, y: num(Y) ? Math.max(0, Math.min(p.h, vy)) : 0};
}
function lnTap(x, y) {   // un toque en la página: si cae en un enlace, lo usa (devuelve true)
  if (lnShown()) { lnClose(); if (!lnAt(x, y)) return true; }   // el toque cierra la vista previa
  const h = lnAt(x, y); if (!h) return false; lnOpen(h); return true;
}
async function lnOpen({p, l}) {
  if (VW.auto && !VW.autoPaused) vwAutoPause(true);
  const R = lnRect(p, l.r);
  if (l.url) return lnUrlPop(l.url, R, 'vw');
  const t = await lnDest(l.dest); if (!t) return toast('Este enlace no lleva a ninguna página de este PDF.', [], 2000);
  if (lnPref() === 'go') return lnGo(t);
  lnPrev(t, R);
}
function lnRect(p, r) { const a = vwBoxes(p, r)[0], b = p.el.getBoundingClientRect(), k = b.width / p.w; return a ? {left: b.left + a.x * k, top: b.top + a.y * k, right: b.left + (a.x + a.w) * k, bottom: b.top + (a.y + a.h) * k, width: a.w * k, height: a.h * k} : b; }
function lnPop(id) {   // la ventanita de la vista previa (una para el PDF y otra para el EPUB)
  let pp = $('#' + id); if (pp) return pp;
  pp = document.createElement('div'); pp.id = id; pp.className = 'vwfloat vwpop lnpop'; pp.hidden = true; $(id === 'vwLk' ? '#vw' : '#ep').append(pp); return pp;
}
const lnShown = () => { const a = $('#vwLk'), b = $('#epLk'); return !!(a && !a.hidden || b && !b.hidden); };
function lnClose() { LN.t = null; for (const id of ['vwLk', 'epLk']) { const pp = $('#' + id); if (pp && !pp.hidden) { pp.hidden = true; pp.innerHTML = ''; } } }
function lnPlace(pp, r, root) {
  if (vwMv()) { pp.style.left = pp.style.top = ''; return; }   // en el móvil, hoja desde abajo (como la de las anotaciones)
  const d = root.getBoundingClientRect(), w = pp.offsetWidth, h = pp.offsetHeight;
  pp.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2 - d.left, d.width - w - 8)) + 'px';
  const below = r.bottom - d.top + 8; pp.style.top = (below + h < d.height - 8 ? below : Math.max(56, r.top - d.top - h - 8)) + 'px';
}
function lnUrlPop(url, R, k) {
  const pp = lnPop(k === 'vw' ? 'vwLk' : 'epLk'); LN.url = url;
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">🌐 Enlace a internet</span><button class="vwib" data-onclick="lnClose()" aria-label="Cerrar">✕</button></div>
    <p class="lnurl">${esc(url)}</p><div class="row vwpopb"><button class="pri" data-onclick="lnUrlGo()">↗ Abrir en una pestaña nueva</button><button data-onclick="lnUrlCopy()">📋 Copiar</button></div>`;
  pp.hidden = false; lnPlace(pp, R, $(k === 'vw' ? '#vw' : '#ep'));
}
function lnUrlGo() { const u = LN.url; lnClose(); if (/^(https?|mailto):/i.test(u || '')) window.open(u, '_blank', 'noopener'); }
async function lnUrlCopy() { const u = LN.url; lnClose(); if (u) { await clipText(u, $(VW.open ? '#vw' : '#ep')); toast('Enlace copiado.', [], 1500); } }
async function lnPrev(t, R) {   // la vista previa del destino: el trozo de la página donde lleva, pintado aparte (no se mueve lo que lees)
  const pp = lnPop('vwLk'), p = VW.pages[t.i], gen = VW.gen; LN.t = t;
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">🔗 Página ${t.i + 1}</span><button class="vwib" data-onclick="lnClose()" aria-label="Cerrar">✕</button></div>
    <div class="lncv"><p class="empty">Cargando…</p></div><div class="row vwpopb"><button class="pri" data-onclick="lnGoPrev()">➜ Ir a la página ${t.i + 1}</button></div>`;
  pp.hidden = false; lnPlace(pp, R, $('#vw'));
  try {
    const box = pp.querySelector('.lncv'), W = Math.max(200, box.clientWidth), c = await lnCol(p, t);
    const s = Math.min(2, W / c.w), dpr = Math.min(devicePixelRatio || 1, 2), vp = vwGV(p, {scale: s * dpr, offsetX: -c.x * s * dpr, offsetY: -c.y * s * dpr});
    const cv = document.createElement('canvas'); cv.width = Math.ceil(c.w * s * dpr); cv.height = Math.ceil(c.h * s * dpr); cv.style.width = Math.round(c.w * s) + 'px';
    await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, pageColors: vwPC()}).promise;
    if (gen !== VW.gen || LN.t !== t) return; box.replaceChildren(cv); lnPlace(pp, R, $('#vw'));
  } catch (e) { if (LN.t === t) pp.querySelector('.lncv').innerHTML = '<p class="empty">No se pudo pintar la vista previa.</p>'; }
}
async function lnCol(p, t) {   // qué trozo enseñar: desde el destino hacia abajo y, en un PDF a dos columnas, solo su columna (si no, la letra sale diminuta)
  const v = vwVp(p), c = vwCropOn(), L = c ? c.l : 0, Rr = p.w - (c ? c.r : 0), y0 = Math.max(0, t.y - 6);
  let x0 = L, x1 = Rr;
  if (t.x != null && t.x > L + 8) {
    try {
      const tc = await p.proxy.getTextContent(); let right = 0;
      for (const it of tc.items) { if (!it.str?.trim() || !it.transform) continue; const [x, y] = v.convertToViewportPoint(it.transform[4], it.transform[5]);
        if (y < t.y - 2 || y > t.y + 140 || x < t.x - 6 || x > t.x + 40) continue; right = Math.max(right, x + (it.width || 0)); }
      if (right > t.x + 40) { x0 = Math.max(0, t.x - 8); x1 = Math.min(p.w, right + 8); }
    } catch (e) {}
  }
  return {x: x0, y: y0, w: Math.max(40, x1 - x0), h: Math.min(Math.max(60, p.h - y0), 170)};
}
function lnGoPrev() { const t = LN.t; lnClose(); if (t) lnGo(t); }
function lnPush() { const a = vwAnchor(); if (!a) return; LN.back.push({i: VW.cur, a, sl: $('#vwScroll').scrollLeft}); if (LN.back.length > 30) LN.back.shift(); lnBackShow(); }
function lnGo(t) {   // a un punto de una página, con «↩ Volver»
  const p = VW.pages[t.i]; if (!p) return; lnPush(); const sc = $('#vwScroll');
  if (VW.flip && !p.el.classList.contains('cur')) vwGo(t.i, true);
  if (!(VW.flip && VW.zLock)) sc.scrollTo({top: p.el.offsetTop + Math.max(0, t.y - 10) * VW.scale - 12});
  if (!VW.flip) VW.cur = vwSpread(t.i);
  const m = document.createElement('i'); m.className = 'lnfl'; m.style.top = vwPx(Math.max(0, t.y - 2)); p.el.append(m); setTimeout(() => m.remove(), 1900);   // dónde has caído
}
function lnBack() {
  const b = LN.back.pop(); if (!b) return lnBackShow(); if (VW.flip) vwGo(b.i, true);
  vwAnchorSet(b.a); $('#vwScroll').scrollLeft = b.sl; if (!VW.flip) VW.cur = b.i; vwOnScroll(); lnBackShow();
}
function lnBackClear() { LN.back = []; LN.findQ = null; lnBackShow(); }
function lnBackShow() {
  const body = $('#vw .vwbody'); if (!body) return; let b = $('#vwBack');
  if (!LN.back.length) { if (b) b.hidden = true; return; }
  if (!b) { body.insertAdjacentHTML('beforeend', `<div id="vwBack" class="vwfloat lnback"><button data-onclick="lnBack()" title="Volver a donde estabas (Alt + ←)"></button><button class="vwib" data-onclick="lnBackClear()" title="Quitar" aria-label="Quitar">✕</button></div>`); b = $('#vwBack'); }
  b.firstElementChild.textContent = `↩ Volver a la p. ${LN.back.at(-1).i + 1}`; b.hidden = false;
}
function lnHover(e) {   // con el ratón, la mano sobre los enlaces
  if (e.pointerType !== 'mouse' || e.buttons || VW.mode !== 'sel') return; const n = Date.now(); if (n - (LN.hv || 0) < 80) return; LN.hv = n;
  $('#vwScroll').classList.toggle('lnk', !!lnAt(e.clientX, e.clientY));
}

/* ---- Enlaces del EPUB: vista previa y «↩ Volver» ---- */
function lnEpLink(a) {   // devuelve true si lo ha llevado
  const [i, f] = a.dataset.go.split('#'), n = +i, el = f && document.getElementById('ep' + n + '-' + f);
  if (a.classList.contains('epnr') && epNotePop(a, n, f)) return true;   // llamada a nota: como siempre
  if (lnPref() === 'prev' && el && lnEpPrev(a, n, f, el)) return true;
  lnEpGo(n, f); return true;
}
function lnEpPrev(a, i, f, el) {
  const box = el.closest('li, p, figure, table, h1, h2, h3, h4, h5, h6, aside, blockquote, dd, div') || el; if (box === EP.secs[i]) return false;
  const im = box.querySelector('img'), t = epTxt(box); if (!t && !im) return false;
  const pp = lnPop('epLk'); LN.ept = {i, f};
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">🔗 ${esc(shortTxt(epChTitle(i) || 'Capítulo ' + (i + 1)).slice(0, 60))}</span><button class="vwib" data-onclick="lnClose()" aria-label="Cerrar">✕</button></div>
    ${im?.src ? `<img class="lnim" src="${esc(im.src)}" alt="">` : ''}${t ? `<p class="epnote">${esc(t.length > 900 ? t.slice(0, 900) + '…' : t)}</p>` : ''}<div class="row vwpopb"><button class="pri" data-onclick="lnEpGoPrev()">➜ Ir allí</button></div>`;
  pp.hidden = false; lnPlace(pp, a.getBoundingClientRect(), $('#ep')); return true;
}
function lnEpGoPrev() { const t = LN.ept; lnClose(); if (t) lnEpGo(t.i, t.f); }
function lnEpGo(i, f) { LN.ep.push(epLoc()); if (LN.ep.length > 30) LN.ep.shift(); epGoTo(i, f); lnEpBackShow(); }
function lnEpBack() { const l = LN.ep.pop(); if (l) epGoLoc(l); lnEpBackShow(); }
function lnEpBackClear() { LN.ep = []; lnEpBackShow(); }
function lnEpBackShow() {
  const body = $('#ep .vwbody'); if (!body) return; let b = $('#epBack');
  if (!LN.ep.length) { if (b) b.hidden = true; return; }
  if (!b) { body.insertAdjacentHTML('beforeend', `<div id="epBack" class="vwfloat lnback"><button data-onclick="lnEpBack()" title="Volver a donde estabas (Alt + ←)">↩ Volver</button><button class="vwib" data-onclick="lnEpBackClear()" title="Quitar" aria-label="Quitar">✕</button></div>`); b = $('#epBack'); }
  b.hidden = false;
}

/* ---- Lista de resultados de la búsqueda (panel, pestaña 🔍) ---- */
function lnSnipPdf(h) {   // la frase de un resultado del PDF: unas letras antes y después, con lo buscado en negrita
  const M = h.map, ch = m => { if (!m) return ' '; const s = m[0].str || '', k = Math.min(s.length - 1, Math.floor(m[1] * s.length + 1e-6)); return s[k] ?? ''; };
  const part = (a, b) => M.slice(Math.max(0, a), Math.max(0, b)).map(ch).join('').replace(/\s+/g, ' ');
  return [part(h.k - 45, h.k), part(h.k, h.k + h.n), part(h.k + h.n, h.k + h.n + 55)];
}
function lnSnipHtml([a, m, b]) { a = a.replace(/^\S*\s/, ''); b = b.replace(/\s\S*$/, ''); return `…${esc(a)}<b>${esc(m)}</b>${esc(b)}…`; }
const LN_MAX = 400;
function lnSee(el) {   // lleva a la vista un elemento de la lista (sin scrollIntoView, que movería también el visor)
  const box = el?.closest('.vwsl'); if (!box) return; const t = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  if (t < box.scrollTop || t + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = t - box.clientHeight / 3;
}
function lnFindDraw(s, head) {   // PDF
  const H = VW.find.hits, q = $('#vwQ')?.value.trim();
  s.innerHTML = `${head}<div class="vwsh"><b>${H.length ? `${H.length} ${H.length === 1 ? 'resultado' : 'resultados'} de «${esc(q)}»` : 'Resultados'}</b></div>
    <div class="vwsl lnres">${H.length ? H.slice(0, LN_MAX).map((h, j) => `<button class="vwi${j === VW.find.i ? ' on' : ''}" style="--c:var(--pri)" data-onclick="lnFindPick(${j})"><small>p. ${h.p + 1}</small><span class="vwit">${lnSnipHtml(lnSnipPdf(h))}</span></button>`).join('')
      + (H.length > LN_MAX ? `<p class="empty">Y ${H.length - LN_MAX} más: usa ↑ ↓ junto a la búsqueda.</p>` : '') : `<p class="empty">Escribe en 🔍 Buscar y pulsa Intro.</p>`}</div>`;
  lnSee(s.querySelector('.lnres .vwi.on'));
}
function lnFindPick(j) {
  if (LN.findQ !== VW.find.q) { lnPush(); LN.findQ = VW.find.q; }   // un solo «↩ Volver» por búsqueda: vuelve a donde estabas antes de buscar
  vwFindGo(j); if (vwMv()) vwSide(false); else lnFindCur();
}
function lnFindCur() { const L = document.querySelectorAll('#vwSide .lnres .vwi'); L.forEach((b, k) => b.classList.toggle('on', k === VW.find.i)); lnSee(L[VW.find.i]); }
function lnFindUi() {   // PDF: el botón ☰ junto a «3 de 27», y el panel si está en la pestaña de resultados
  const b = $('#vwQL'); if (b) b.hidden = !VW.find.hits.length;
  if (VW.side && VW.tab === 'find') vwSideDraw();
}
function lnEpFindDraw(s, head) {   // EPUB
  const H = EP.find.hits, q = $('#epQ')?.value.trim(); EP.txt ||= EP.secs.map(x => x.textContent);
  const snip = h => { const T = EP.txt[h.i] || ''; return lnSnipHtml([T.slice(Math.max(0, h.a - 45), h.a), T.slice(h.a, h.b), T.slice(h.b, h.b + 55)].map(x => x.replace(/\s+/g, ' '))); };
  s.innerHTML = `${head}<div class="vwsh"><b>${H.length ? `${H.length}${H.length >= 2000 ? '+' : ''} ${H.length === 1 ? 'resultado' : 'resultados'} de «${esc(q)}»` : 'Resultados'}</b></div>
    <div class="vwsl lnres">${H.length ? H.slice(0, LN_MAX).map((h, j) => `<button class="vwi${j === EP.find.i ? ' on' : ''}" style="--c:var(--pri)" data-onclick="lnEpFindPick(${j})"><small>cap. ${h.i + 1}${epChTitle(h.i) ? ' · ' + esc(shortTxt(epChTitle(h.i)).slice(0, 50)) : ''}</small><span class="vwit">${snip(h)}</span></button>`).join('')
      + (H.length > LN_MAX ? `<p class="empty">Y ${H.length - LN_MAX} más: usa Intro en la búsqueda.</p>` : '') : `<p class="empty">Escribe en 🔍 Buscar y pulsa Intro.</p>`}</div>`;
  lnSee(s.querySelector('.lnres .vwi.on'));
}
function lnEpFindPick(j) {
  const H = EP.find.hits; if (!H[j]) return; if (LN.epFindQ !== EP.find.q) { LN.ep.push(epLoc()); LN.epFindQ = EP.find.q; lnEpBackShow(); }
  EP.find.i = j; $('#epQn').textContent = `${j + 1} de ${H.length}${H.length >= 2000 ? '+' : ''}`; epFindMark();
  if (vwMv()) epSideClose(); else document.querySelectorAll('#epSide .lnres .vwi').forEach((b, k) => b.classList.toggle('on', k === j));
}
function lnEpFindUi() { const b = $('#epQL'); if (b) b.hidden = !EP.find.hits.length; if (EP.side && EP.tab === 'find') epSideDraw(); }

/* ===== Colores con significado, más opciones con la selección, sepia y tiempo que falta (v39.51, PDF y EPUB) =====
   · Significado de los colores (⚙ Ajustes del visor → 🏷): un nombre para cada color («Idea clave», «Crítica»…). Va en los ajustes comunes
     (db.settings.annLbl = {'#ffd400': 'Idea clave', …}: se sincroniza) y sale en los colores, en los filtros del panel, en la ventanita de cada
     anotación y al copiar o llevar las anotaciones a las notas, que se agrupan por significado.
   · ⋯ en la barra de la selección: ❝ Copiar con la cita («…» (Pérez, 2024, p. 3)), 📖 definición (RAE o Cambridge), 🌐 traducir y 🎓 Google
     Académico. Lo de fuera se abre en una pestaña nueva y solo se envía el texto elegido, y solo al pulsarlo.
   · Sepia también en el PDF (⚙ → 🌙 Modo noche y sepia; gp-vw-night = 'off' | 'sepia' | 'on' | 'auto').
   · Tiempo que falta: «≈ 12 min», calculado con tu ritmo de lectura en este dispositivo (gp-vw-pace: segundos por página del PDF;
     gp-ep-pace: letras por minuto del EPUB). Se ve junto al número de páginas (pantallas anchas), en el aviso de página de la pantalla
     completa y junto al capítulo del EPUB. ⚙ → ⏱ para quitarlo (gp-vw-left). */
const annLbls = () => db.settings.annLbl && typeof db.settings.annLbl === 'object' ? db.settings.annLbl : {};
const annLbl = c => annLbls()[c] || '';
const annColName = c => annLbl(c) || VW_COLORS.find(x => x[0] === c)?.[1] || c;
function annLblSet(c, v) {
  if (!VW_COLORS.some(x => x[0] === c)) return; v = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40); const o = {...annLbls()};
  if (v) o[c] = v; else delete o[c]; if (Object.keys(o).length) db.settings.annLbl = o; else delete db.settings.annLbl; markDirty(); lnLblApply();
  if (VW.open && VW.side) vwSideDraw(); if (typeof EP !== 'undefined' && EP.open && EP.side) epSideDraw();
}
function lnLblApply() {   // los nombres en los títulos de los botones de color
  document.querySelectorAll('#vw .vwc[data-c], #ep .vwc[data-c]').forEach(b => { const [c, t] = VW_COLORS[+b.dataset.c] || []; if (!c) return; const l = annLbl(c); b.title = l ? `${t} · ${l}` : t; b.ariaLabel = 'Color ' + (l || t); });
}
function annLblMenu(ep) {
  const back = ep ? 'epCfgMenu()' : 'vwCfgMenu()', L = annLbls();
  (ep ? epMenu : vwMenu)(ep ? EP.menuR : VW.menuR, `<button data-keep data-onclick="${back}">‹ Volver</button><hr><div class="ctxh">🏷 Significado de cada color</div>
    ${VW_COLORS.map(([c, t]) => `<label class="lnlbr"><i style="--c:${c}"></i><input type="text" maxlength="40" placeholder="${t}" value="${esc(L[c] || '')}" data-onchange="annLblSet('${c}',this.value)" aria-label="Significado del ${t.toLowerCase()}"></label>`).join('')}
    <div class="vwhint">Por ejemplo: amarillo, idea clave; rojo, crítica. Sale en los colores, en los filtros y al llevar las anotaciones a las notas (agrupadas). Se guarda con tus ajustes y llega a tus otros dispositivos.</div>`);
}
function annFiltChips(all, f, fn) {   // los colores del filtro del panel (con su nombre, si lo tienen)
  return VW_COLORS.filter(([c]) => all.some(a => a.c === c)).map(([c, t]) => { const l = annLbl(c);
    return l ? `<button class="lnchip${f === c ? ' on' : ''}" style="--c:${c}" title="Solo ${esc(l)}" data-onclick="${fn}('${c}')"><i></i>${esc(l)}</button>`
      : `<button class="vwc${f === c ? ' on' : ''}" style="--c:${c}" title="Solo ${t.toLowerCase()}" data-onclick="${fn}('${c}')"></button>`; }).join('');
}

/* ---- ⋯ en la barra de la selección ---- */
function lnSelText(ep) { const r = ep ? epSelRange() : vwSelRange(); return r ? r.toString().replace(/\s+/g, ' ').replace(/(\w)- (\w)/g, '$1$2').trim() : ''; }
function lnSelMore(ep) {
  const r = ep ? epSelRange() : vwSelRange(); if (!r) return; const t = lnSelText(ep), bar = $(ep ? '#epSel' : '#vwSel').getBoundingClientRect();
  let pg = 0; if (ep) { const s = r.startContainer.parentElement?.closest('section.epc'); pg = s ? +s.dataset.i : epLoc().i; } else { const L = vwRangeAnn(r); pg = L.length ? L[0].p : VW.cur; }
  LN.sel = {t: t.slice(0, 4000), pg, ep}; const w = t.split(/\s+/).filter(Boolean).length, one = w > 0 && w <= 3;
  const m = ep ? epMenu : vwMenu; if (ep) EP.menuR = bar; else VW.menuR = bar;
  m(bar, `<button data-onclick="lnSelCite()" title="«…» (autor, año, página): para pegarlo en un trabajo">❝ Copiar con la cita</button>
    <button data-onmousedown="event.preventDefault()" data-onclick="lnSelStyle('u')" title="Con el color elegido, una línea debajo en vez de resaltar">U̲ Subrayar con una línea</button><button data-onmousedown="event.preventDefault()" data-onclick="lnSelStyle('x')">S̶ Tachar</button>
    ${one ? `<button data-onclick="lnSelWeb('rae')">📖 Definición (RAE)</button><button data-onclick="lnSelWeb('cam')">📖 Definition (Cambridge)</button>` : ''}
    ${sayCan() ? `<button data-onclick="saySel(${!!ep})">🔊 Leer en voz alta desde aquí</button>` : ''}<button data-onclick="lnSelWeb('tr')">🌐 Traducir al español</button><button data-onclick="lnSelWeb('sch')">🎓 Buscar en Google Académico</button>
    <div class="vwhint">Lo de fuera se abre en una pestaña nueva y envía solo el texto elegido.</div>`);
}
async function lnSelCite() {
  const s = LN.sel; if (!s?.t) return; const P = s.ep ? epPaperOf() : vwPaper(), ref = P ? annCite(P, s.pg + 1, s.ep) : `(${s.ep ? 'cap.' : 'p.'} ${s.pg + 1})`;
  await clipText(`«${s.t}» ${ref}`, $(s.ep ? '#ep' : '#vw')); getSelection().removeAllRanges(); $(s.ep ? '#epSel' : '#vwSel').hidden = true; toast('Copiado con la cita.', [], 1600);
}
const LN_WEB = {rae: t => 'https://dle.rae.es/' + encodeURIComponent(t.toLowerCase()), cam: t => 'https://dictionary.cambridge.org/dictionary/english/' + encodeURIComponent(t.toLowerCase()),
  tr: t => 'https://translate.google.com/?sl=auto&tl=es&op=translate&text=' + encodeURIComponent(t.slice(0, 1500)), sch: t => 'https://scholar.google.com/scholar?q=' + encodeURIComponent(t.slice(0, 300))};
function lnSelWeb(k) { const s = LN.sel, f = LN_WEB[k]; if (!s?.t || !f) return; window.open(f(s.t.replace(/[«»"“”]/g, '').trim()), '_blank', 'noopener'); }

/* ---- Sepia en el PDF ---- */
const vwTheme = () => { const p = vwNightPref(); return p === 'sepia' ? 'sepia' : vwNightOn() ? 'night' : ''; };

/* ---- Tiempo que falta ---- */
const LN_LEFT_K = 'gp-vw-left';
const lnLeftOn = () => { try { return localStorage.getItem(LN_LEFT_K) !== '0'; } catch (e) { return true; } };
function lnLeftSet(on) { try { localStorage.setItem(LN_LEFT_K, on ? '1' : '0'); } catch (e) {} lnLeftShow(); }
const lnNum = (k, d, lo, hi) => { try { const v = +localStorage.getItem(k); return v >= lo && v <= hi ? v : d; } catch (e) { return d; } };
const lnFmtMin = m => { m = Math.max(1, Math.round(m)); return m < 60 ? `≈ ${m} min` : `≈ ${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
function lnLeftPdf() { if (!VW.pages.length) return ''; const n = VW.pages.length - VW.cur - (VW.two ? vwSpreadN(vwSpread(VW.cur)) : 1); return n <= 0 ? '' : lnFmtMin(n * lnNum('gp-vw-pace', 75, 5, 1800) / 60); }
function lnLeftEp() { if (!EP.secs.length) return ''; const l = epLoc(), pos = EP.cum[l.i] + l.f * EP.len[l.i], rest = EP.total - pos; return rest < 200 ? '' : lnFmtMin(rest / lnNum('gp-ep-pace', 1300, 100, 20000)); }
function lnLeftShow() {
  const on = lnLeftOn(), a = $('#vwLeft'), b = $('#epLeft');
  if (a) { const t = on && VW.open ? lnLeftPdf() : ''; a.textContent = t; a.hidden = !t; a.title = t ? `Lo que te falta para terminar, a tu ritmo de lectura (${t.replace('≈ ', '')})` : ''; }
  if (b) { const t = on && typeof EP !== 'undefined' && EP.open ? lnLeftEp() : ''; b.textContent = t ? ' · ' + t : ''; b.title = t ? 'Lo que te falta para terminar, a tu ritmo de lectura' : ''; }
}
const LNP = {pg: -1, t: 0, acc: 0, chars: 0, secs: 0, pos: -1};
function lnPaceTick() {   // cada 5 s: cuánto tiempo pasas en cada página (o cuántas letras avanzas en el EPUB), solo leyendo (activo hace poco o con el automático)
  if (!rdOpen() || document.hidden) { LNP.pg = -1; LNP.pos = -1; rlFlush(); return; }
  const active = Date.now() - WL.act < 120e3 || VW.open && VW.auto && !VW.autoPaused || typeof EP !== 'undefined' && EP.open && EP.auto && !EP.autoPaused;
  if (active) rlTick();
  if (VW.open && VW.pages.length) {
    if (LNP.pg !== VW.cur) {
      if (LNP.pg >= 0 && VW.cur === LNP.pg + (VW.two ? vwSpreadN(vwSpread(LNP.pg)) : 1)) RL.p += VW.cur - LNP.pg;   // estadísticas: páginas leídas (pasar a la siguiente, no saltar)
      if (LNP.pg >= 0 && VW.cur === LNP.pg + (VW.two ? vwSpreadN(vwSpread(LNP.pg)) : 1) && LNP.acc >= 8 && LNP.acc <= 900) {   // pasó a la siguiente: lo que tardó en esa
        const per = LNP.acc / (VW.two ? vwSpreadN(vwSpread(LNP.pg)) : 1), old = lnNum('gp-vw-pace', 75, 5, 1800); try { localStorage.setItem('gp-vw-pace', Math.round(old * .8 + per * .2)); } catch (e) {} }
      LNP.pg = VW.cur; LNP.acc = 0;
    } else if (active) LNP.acc += 5;
  } else if (typeof EP !== 'undefined' && EP.open && EP.secs.length) {
    const l = epLoc(), pos = EP.cum[l.i] + l.f * EP.len[l.i];
    if (LNP.pos >= 0 && active) { const d = pos - LNP.pos; if (d > 0 && d < 6000) { LNP.chars += d; LNP.secs += 5; RL.p += d / RL_CH; } else if (d <= 0) LNP.secs += 5; }
    LNP.pos = pos;
    if (LNP.secs >= 60) { if (LNP.chars > 150) { const v = LNP.chars / LNP.secs * 60, old = lnNum('gp-ep-pace', 1300, 100, 20000); try { localStorage.setItem('gp-ep-pace', Math.round(old * .8 + Math.min(8000, v) * .2)); } catch (e) {} } LNP.chars = LNP.secs = 0; }
  }
  lnLeftShow();
}
setInterval(lnPaceTick, 5000);
/* ---- Estadísticas de lectura (v40, F10): tiempo leyendo, páginas y papers de cada día, en el proyecto (db.readLog: día → dispositivo → {s, p, d})
   para que se sumen los de todos tus dispositivos con Google Drive. Solo cuenta mientras lees de verdad (la misma regla que el ritmo de lectura).
   Se guarda cada 5 minutos, al cerrar el visor y al salir, sin crear pasos de deshacer. En el EPUB, una página son ~2000 letras. */
const RL = {s: 0, p: 0, ids: new Set(), at: Date.now()}, RL_CH = 2000;
const rlDay = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
function rlTick() {
  RL.s += 5; const src = VW.open ? VW.src : typeof EP !== 'undefined' && EP.open ? EP.src : null;
  if (src?.kind === 'paper' && src.id != null) RL.ids.add(String(src.id));
  if (Date.now() - RL.at > 300e3) rlFlush();
}
function rlFlush() {
  const pg = Math.floor(RL.p); RL.at = Date.now();
  if (TAB.passive || RL.s < 5 && !pg) return;
  const L = db.readLog ||= {}, e = (L[rlDay()] ||= {})[syDev()] ||= {s: 0, p: 0};
  e.s = Math.min(86400, e.s + RL.s); e.p = Math.min(5000, e.p + pg); if (RL.ids.size) e.d = [...new Set([...(e.d || []), ...RL.ids])].slice(0, 50);
  RL.s = 0; RL.p -= pg; RL.ids.clear();
  const ks = Object.keys(L).sort(); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(k => delete L[k]);
  foldSnap(); dirty = true; touch(); if (typeof rlDraw0 === 'function') rlDraw0();
}
addEventListener('pagehide', () => { try { rlFlush(); } catch (e) {} });

/* ===== Subrayado con línea y tachado, recorte a mano y girar páginas (v39.52) =====
   · Estilo de un subrayado (campo «s» de la anotación: 'u' línea debajo, 'x' tachado; sin él, resaltado como siempre). Se cambia en la
     ventanita de cada subrayado (🖍 U̲ S̶) o se elige al crear desde ⋯ de la barra de la selección. En el PDF anotado salen como
     Underline y StrikeOut (Acrobat, Foxit), y los que traía el PDF se traen con su estilo. También en el EPUB.
   · ✂ Ajustar el recorte (⋯ → 📖 Modo de lectura, con el recorte puesto): cuatro barras (arriba, abajo, izquierda, derecha) para
     corregir el automático. Se guarda por PDF en este dispositivo (gp-vw-crop); «↺ Automático» lo quita.
   · ↻ Girar (⋯ → 📖 Modo de lectura): esta página o todas, de 90 en 90 grados (tablas apaisadas, escaneos de lado). Se guarda por PDF
     en este dispositivo (gp-vw-rot); los subrayados siguen en su sitio (van en coordenadas del PDF). */
const LN_STY = {u: 'U̲ Línea debajo', x: 'S̶ Tachado'};
function vwPopStyle(s) { const id = VW.pop; if (!id) return; vwMut(l => { const a = l.find(x => x.id === id); if (!a) return; if (s) a.s = s; else delete a.s; a.up = vwNow(); }); vwPopOpen(id); }
function epPopStyle(s) { const id = EP.pop; if (!id) return; epMut(l => { const a = l.find(x => x.id === id); if (!a) return; if (s) a.s = s; else delete a.s; a.up = vwNow(); }); epPopOpen(id); }
const lnStyRow = (a, fn) => `<span class="lnsty" role="group" aria-label="Estilo">${[['', '🖍', 'Resaltado'], ['u', 'U̲', 'Línea debajo'], ['x', 'S̶', 'Tachado']].map(([s, i, t]) => `<button class="${(a.s || '') === s ? 'on' : ''}" title="${t}" aria-label="${t}" data-onclick="${fn}('${s}')">${i}</button>`).join('')}</span>`;
function lnSelStyle(s) { const x = LN.sel; if (!x) return; if (x.ep) epFromSel(EP.color, false, s); else vwFromSel(VW.color, false, s); }

/* ---- Recorte a mano ---- */
const LN_CROP_K = 'gp-vw-crop', LN_ROT_K = 'gp-vw-rot';
const lnStore = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
function lnStorePut(k, key, v) { try { const o = lnStore(k); delete o[key]; if (v) o[key] = v; const ks = Object.keys(o); for (const x of ks.slice(0, Math.max(0, ks.length - 60))) delete o[x]; localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
function lnCropSaved() { const c = VW.src && lnStore(LN_CROP_K)[vwSrcKey(VW.src)]; return c && ['t', 'r', 'b', 'l'].every(k => Number.isFinite(c[k]) && c[k] >= 0) ? c : null; }
function lnCropMenu() {
  if (!VW.crop) return; const c = VW.cropM || {t: 0, r: 0, b: 0, l: 0}, p0 = VW.pages[0]; if (!p0) return;
  const row = (k, t, max) => `<label class="lncrop"><span>${t}</span><input type="range" min="0" max="${Math.round(max)}" step="1" value="${Math.round(c[k] || 0)}" data-oninput="lnCropSet('${k}',this.value)" aria-label="${t}"></label>`;
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwReadMenu()">‹ Volver</button><hr><div class="ctxh">✂ Ajustar el recorte de este PDF</div>
    ${row('t', 'Arriba', p0.h * .4)}${row('b', 'Abajo', p0.h * .4)}${row('l', 'Izquierda', p0.w * .4)}${row('r', 'Derecha', p0.w * .4)}
    <button data-keep data-onclick="lnCropAuto()">↺ Volver al recorte automático</button><div class="vwhint">Se guarda para este PDF en este dispositivo.</div>`);
}
function lnCropSet(k, v) {
  const c = {...(VW.cropM || {t: 0, r: 0, b: 0, l: 0})}; c[k] = Math.max(0, +v || 0); c.any = c.t + c.b + c.l + c.r > 0.5; c.hand = true; VW.cropM = c;
  lnStorePut(LN_CROP_K, vwSrcKey(VW.src), {t: c.t, r: c.r, b: c.b, l: c.l}); clearTimeout(LN.cropT); LN.cropT = setTimeout(() => vwCropShow(true), 60);
}
function lnCropAuto() { lnStorePut(LN_CROP_K, vwSrcKey(VW.src), null); VW.cropM = null; vwCropCalc(VW.gen, true).then(() => { if (!$('#vwMenu').hidden) lnCropMenu(); }); }

/* ---- Girar páginas ---- */
const vwRotMap = () => (VW.src && lnStore(LN_ROT_K)[vwSrcKey(VW.src)]) || {};
const vwRot = i => (((VW.rot?.['*'] || 0) + (VW.rot?.[i] || 0)) % 360 + 360) % 360;
const vwGV = (p, o) => p.proxy.getViewport({...o, rotation: ((p.proxy.rotate || 0) + vwRot(p.i)) % 360});   // la página como se ve, con su giro
function lnRotate(which) {   // which: número de página, '*' (todas) o null (quitar los giros)
  const R = {...(VW.rot || {})}; if (which == null) for (const k in R) delete R[k]; else { R[which] = ((R[which] || 0) + 90) % 360; if (!R[which]) delete R[which]; }
  VW.rot = R; lnStorePut(LN_ROT_K, vwSrcKey(VW.src), Object.keys(R).length ? R : null); lnRotApply();
}
function lnRotApply() {   // vuelve a medir y pintar las páginas con su giro (los subrayados y la búsqueda se recolocan solos)
  if (!VW.pages.length) return; const i0 = VW.cur;
  for (const p of VW.pages) {
    if (!p.proxy) { if (vwRot(p.i)) VW.doc.getPage(p.i + 1).then(pr => { p.proxy ||= pr; lnRotPage(p); }); continue; }
    lnRotPage(p);
  }
  if (VW.fit) vwFitW(true); vwGo(i0, true); vwPump();
}
function lnRotPage(p) {
  const v = vwGV(p, {scale: 1}); if (p.vp1 && p.vp1.rotation === v.rotation) return;
  p.vp1 = v; p.sized = true; p.w = v.width; p.h = v.height; vwSize(p); p.annSig = '';
  if (p.task) try { p.task.cancel(); } catch (e) {}
  if (p.cv) { p.cv.width = p.cv.height = 0; p.cv.remove(); p.cv = null; } p.rs = 0; p.det?.remove(); p.det = null;
  if (p.tl) { p.tl.cancel?.(); p.el.querySelector('.textLayer')?.remove(); p.tl = null; }
  vwAnnPage(p); if (VW.find.q) vwFindMark(p); if (p.vis) VW.queue.add(p.i);
}

/* ===== Leer en voz alta, lápiz a mano y los dos PDF a la vez (v39.53) =====
   · 🔊 Leer en voz alta (⋯ → 📖 Modo de lectura, o ⋯ de la barra de la selección: «desde aquí»), PDF y EPUB, con la voz del sistema
     (speechSynthesis: nada sale a internet). Marca la frase que lee, pasa sola de página o de capítulo y la sigue en la pantalla. Una
     barrita abajo (⏮ ⏸ ⏭, velocidad, ✕) mientras lee; Esc o cerrar el visor la paran. Velocidad en el dispositivo (gp-vw-say).
   · ✏ Lápiz (⋯ del PDF): trazos a mano sobre la página (anotación «ink»: g = trazos en coordenadas del PDF). Los trazos seguidos
     (menos de 2 s entre uno y otro, en la misma página) van juntos en una anotación, que se toca para cambiar el color, comentar o borrar.
     En el PDF anotado sale como Ink (Acrobat, Foxit), y los dibujos que traía el PDF se traen. Una píldora «✏ Lápiz · ✕» dice que está puesto.
   · ⧉ Los dos PDF a la vez (⋯, si el paper tiene PDF 1 y PDF 2): el otro, a la derecha (o debajo con la tablet en vertical; en el móvil,
     encima y se cierra con ✕), solo para leer, con su zoom. El divisor es el de las notas. */

/* ---- 🔊 Leer en voz alta ---- */
const SAY_K = 'gp-vw-say', SAY_RATES = [.8, 1, 1.2, 1.4, 1.7, 2];
const SAY = {on: false, ep: false, list: [], k: 0, at: 0, paused: false, gen: 0, lang: 'es-ES'};
const sayCan = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
function sayRate() { try { const r = +JSON.parse(localStorage.getItem(SAY_K) || '{}').r; return SAY_RATES.includes(r) ? r : 1; } catch (e) { return 1; } }
function sayRateStep() { const r = SAY_RATES[(SAY_RATES.indexOf(sayRate()) + 1) % SAY_RATES.length]; try { localStorage.setItem(SAY_K, JSON.stringify({r})); } catch (e) {} if (SAY.on && !SAY.paused) sayAgain(); sayBar(); }
function sayLang(t) { const s = ' ' + String(t).toLowerCase().slice(0, 4000) + ' ', c = rx => (s.match(rx) || []).length; return c(/ (the|of|and|to|is|that|for|with|are|this) /g) > c(/ (el|la|los|las|de|que|y|en|por|con|para|una|del|se) /g) ? 'en-US' : 'es-ES'; }
function sayVoice(lang) { const V = speechSynthesis.getVoices?.() || [], l = lang.slice(0, 2); return V.find(v => v.lang === lang && v.localService) || V.find(v => v.lang === lang) || V.find(v => v.lang?.slice(0, 2) === l) || null; }
function saySplit(s, base = 0, out = []) {   // frases [inicio, fin) de un texto; las muy largas, en trozos (en las comas)
  const one = (x, y) => { while (x < y && /\s/.test(s[x])) x++; while (y > x && /\s/.test(s[y - 1])) y--; if (y > x && /[\p{L}\p{N}]/u.test(s.slice(x, y))) out.push([base + x, base + y]); };
  const add = (x, y) => { while (y - x > 280) { let c = s.lastIndexOf(', ', x + 250); if (c <= x + 60) c = s.lastIndexOf(' ', x + 250); if (c <= x) c = x + 250; one(x, c + 1); x = c + 1; } one(x, y); };
  const rx = /[.!?…]+[»"”’')\]]*\s+|\n\s*\n/g; let a = 0, m;
  while ((m = rx.exec(s))) { const e = m.index + m[0].length; add(a, e); a = e; }
  add(a, s.length); return out;
}
const sayWords = t => String(t || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
async function sayPdfPage(i) {   // las frases de una página del PDF, con sus rectángulos (para marcarlas)
  const p = VW.pages[i]; if (!p || !VW.doc) return []; p.proxy ||= await VW.doc.getPage(i + 1); vwVp(p);
  const tc = await p.proxy.getTextContent(), it = []; let s = '';
  for (const x of tc.items) { if (typeof x.str !== 'string') continue; if (x.str) { it.push({a: s.length, b: s.length + x.str.length, x}); s += x.str; } if (x.hasEOL) s += x.str.endsWith('-') ? '' : ' '; }
  SAY.lang = sayLang(s);
  return saySplit(s).map(([a, b]) => {
    const q = [];
    for (const o of it) { if (o.b <= a || o.a >= b) continue; const [, , c, d, e, f] = o.x.transform, w = o.x.width, h = Math.hypot(c, d) || o.x.height || 10, n = o.b - o.a, f0 = Math.max(0, a - o.a) / n, f1 = Math.min(n, b - o.a) / n;
      q.push(e + w * f0, f - h * .25, e + w * f1, f + h * .95); }
    return {p: i, a, b, t: vwClean(s.slice(a, b)), q};
  }).filter(c => c.t);
}
const EP_BLK = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dt,dd,pre,figcaption,caption,div,section';
function sayEpChap(i) {   // las frases de un capítulo del EPUB (cada párrafo aparte), en posiciones del texto del capítulo (las de los subrayados)
  const sec = EP.secs[i]; if (!sec) return []; const segs = []; let cur = null, all = '';
  for (const [n, o] of epTexts(sec)) { const bl = n.parentElement?.closest(EP_BLK); if (!cur || cur.bl !== bl) segs.push(cur = {bl, a: o, s: ''}); cur.s += n.data; all += n.data; }
  SAY.lang = sayLang(all); const out = [];
  for (const g of segs) saySplit(g.s, g.a, out);
  return out.map(([a, b]) => ({p: i, a, b, t: all.slice(a, b).replace(/\s+/g, ' ').trim()})).filter(c => c.t);
}
async function sayLoad(i, dir) {   // la siguiente página (o capítulo) con texto, en la dirección dir; null si no hay más
  const N = SAY.ep ? EP.secs.length : VW.pages.length, g = SAY.gen;
  for (let k = i, tries = 0; k >= 0 && k < N && tries < 40; k += dir, tries++) {
    const L = SAY.ep ? sayEpChap(k) : await sayPdfPage(k); if (g !== SAY.gen || !SAY.on) return null;
    if (L.length) return L;
  }
  return null;
}
async function sayStart(ep, from) {   // from: {p, t: texto donde empezar} (si no, lo que se ve)
  if (!sayCan()) return toast('Este navegador no puede leer en voz alta.', [], 3000);
  sayStop(true); Object.assign(SAY, {on: true, ep: !!ep, paused: false, k: 0}); const g = ++SAY.gen;
  let i = from ? from.p : ep ? epLoc().i : VW.cur, L = await sayLoad(i, 1); if (g !== SAY.gen) return;
  if (!L) { sayStop(); return toast(ep ? 'No hay texto que leer.' : 'Esta parte del PDF no tiene texto que leer (¿es un escaneado?).', [], 4000); }
  let k = 0;
  if (L[0].p === i) {
    k = from?.t ? sayFind(L, sayWords(from.t)) : sayVisible(L);
  }
  SAY.list = L; SAY.k = k; sayBar(); saySpeak();
}
function sayFind(L, rx) {   // la frase donde está un trozo de texto
  if (!rx) return 0; const R = new RegExp(rx, 'i'), j = L.findIndex(c => R.test(c.t)); if (j >= 0) return j;
  for (let k = 0; k < L.length - 1; k++) if (R.test(L[k].t + ' ' + L[k + 1].t)) return k;
  return 0;
}
function sayVisible(L) {   // la primera frase que se ve en la pantalla
  if (SAY.ep) { const sc = $('#epScroll').getBoundingClientRect(), sec = EP.secs[L[0].p]; for (let k = 0; k < L.length; k++) { const r = sayEpRange(sec, L[k].a, L[k].b)?.getBoundingClientRect(); if (r && r.bottom > sc.top + 4 && r.left >= sc.left - 4 && r.top < sc.bottom) return k; } return 0; }
  const p = VW.pages[L[0].p], sc = $('#vwScroll').getBoundingClientRect(); if (!p?.el || VW.flip) return 0; const r = p.el.getBoundingClientRect(), k1 = r.height / (p.h || r.height);
  const j = L.findIndex(c => { const b = vwBoxes(p, c.q)[0]; return b && r.top + b.y * k1 >= sc.top - 2; }); return Math.max(0, j);
}
function sayEpRange(sec, a, b) {
  let r = null; for (const [n, o] of epTexts(sec)) { const e = o + n.length; if (!r && a < e) { r = document.createRange(); r.setStart(n, a - o); } if (r && b <= e) { r.setEnd(n, b - o); return r; } }
  return r;
}
function saySpeak() {
  const c = SAY.list[SAY.k]; if (!SAY.on) return; if (!c) return sayMore(1);
  const g = ++SAY.gen; SAY.paused = false; sayMark(c); sayBar();
  const u = new SpeechSynthesisUtterance(c.t), v = sayVoice(SAY.lang); u.lang = SAY.lang; u.rate = sayRate(); if (v) u.voice = v;
  u.onend = () => { if (g !== SAY.gen || !SAY.on || SAY.paused) return; SAY.k++; saySpeak(); };
  u.onerror = e => { if (g !== SAY.gen || /interrupted|canceled/.test(e.error)) return; sayStop(); toast('No se pudo leer en voz alta' + (e.error ? ` (${e.error})` : '') + '.', [], 4000); };
  SAY.u = u; try { speechSynthesis.cancel(); } catch (e) {} speechSynthesis.speak(u); wlSync();
}
async function sayMore(dir) {   // se acabó la página (o el capítulo): la siguiente, o la anterior
  const c0 = SAY.list[0]; if (!c0) return sayStop(); const g = ++SAY.gen, L = await sayLoad(c0.p + dir, dir); if (g !== SAY.gen || !SAY.on) return;
  if (!L) { sayStop(); if (dir > 0) toast(SAY.ep ? 'Fin del libro.' : 'Fin del PDF.', [], 2500); return; }
  SAY.list = L; SAY.k = dir > 0 ? 0 : L.length - 1; saySpeak();
}
function sayStep(d) { if (!SAY.on) return; SAY.k += d; if (SAY.k < 0) return sayMore(-1); if (SAY.k >= SAY.list.length) return sayMore(1); saySpeak(); }
function sayAgain() { saySpeak(); }
function sayToggle() {
  if (!SAY.on) return; if (SAY.paused) return saySpeak();   // seguir: la frase en la que paró, desde el principio (pausar en Android corta la voz)
  SAY.paused = true; SAY.gen++; try { speechSynthesis.cancel(); } catch (e) {} sayBar(); wlSync();
}
function sayStop(quiet) {
  const was = SAY.on; SAY.on = false; SAY.paused = false; SAY.gen++; SAY.list = []; if (was || !quiet) try { speechSynthesis.cancel(); } catch (e) {}
  sayUnmark(); document.querySelectorAll('.lnsayb').forEach(b => b.remove()); if (was) wlSync();
}
function sayUnmark() { document.querySelectorAll('#vw .lnsay').forEach(e => e.remove()); if (typeof EP !== 'undefined') for (const s of EP.secs || []) if (s.querySelector('mark.lnsay')) epUnwrap(s, 'lnsay'); }
function sayMark(c) {   // marca la frase que se lee y la lleva a la vista
  sayUnmark();
  if (SAY.ep) {
    const sec = EP.secs[c.p]; if (!sec) return; epWrap(sec, c.a, c.b, () => { const m = document.createElement('mark'); m.className = 'lnsay'; return m; });
    const m = sec.querySelector('mark.lnsay'); if (!m) return; const sc = $('#epScroll').getBoundingClientRect(), r = m.getBoundingClientRect();
    if (r.top < sc.top + 30 || r.bottom > sc.bottom - 90 || r.left < sc.left || r.right > sc.right) epShow(m); return;
  }
  const p = VW.pages[c.p]; if (!p?.el) return;
  if (VW.flip ? !(VW.cur === c.p || VW.two && VW.cur + 1 === c.p) : false) vwGo(c.p, true);
  const B = vwBoxes(p, c.q); if (!B.length) return; const lay = p.el.querySelector('.vwa'); if (!lay) return;
  lay.insertAdjacentHTML('beforebegin', B.map(b => `<i class="lnsay" style="left:${vwPx(b.x)};top:${vwPx(b.y)};width:${vwPx(b.w)};height:${vwPx(b.h)}"></i>`).join(''));
  const el = p.el.querySelector('.lnsay'), sc = $('#vwScroll'), s = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.top < s.top + 30 || r.bottom > s.bottom - 90) sc.scrollTop += r.top - s.top - s.height * .3;
}
function sayBar() {
  const host = $(SAY.ep ? '#ep' : '#vw'); if (!host || !SAY.on) return; let b = host.querySelector('.lnsayb');
  if (!b) { b = document.createElement('div'); b.className = 'vwfloat lnsayb'; b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', 'Lectura en voz alta'); host.append(b); }
  const c = SAY.list[SAY.k], r = sayRate();
  b.innerHTML = `<span class="lnsayi" aria-hidden="true">🔊</span><small>${c ? (SAY.ep ? 'cap. ' : 'p. ') + (c.p + 1) : ''}</small><button data-onclick="sayStep(-1)" title="La frase anterior" aria-label="La frase anterior">⏮</button><button class="lnsayp" data-onclick="sayToggle()" title="${SAY.paused ? 'Seguir' : 'Pausa'}" aria-label="${SAY.paused ? 'Seguir' : 'Pausa'}">${SAY.paused ? '▶' : '⏸'}</button><button data-onclick="sayStep(1)" title="La frase siguiente" aria-label="La frase siguiente">⏭</button><button class="lnsayr" data-onclick="sayRateStep()" title="Velocidad">${String(r).replace('.', ',')}×</button><button data-onclick="sayStop()" title="Parar" aria-label="Parar">✕</button>`;
}
function saySel(ep) { const s = LN.sel; if (!s) return; getSelection().removeAllRanges(); $(ep ? '#epSel' : '#vwSel').hidden = true; sayStart(ep, {p: s.pg, t: s.t}); }
const sayMenuBtn = ep => sayCan() ? `<button data-onclick="${SAY.on && SAY.ep === !!ep ? 'sayStop()' : `sayStart(${!!ep})`}">${SAY.on && SAY.ep === !!ep ? '⏹ Dejar de leer en voz alta' : '🔊 Leer en voz alta desde aquí'}</button>` : '';

/* ---- ✏ Lápiz ---- */
const LN_INK_W = 1.8;   // grosor del trazo, en puntos del PDF
function lnInkMode() { vwMode('ink'); }
function lnInkShow() {
  const v = $('#vw'); if (!v) return; let b = $('#lnInk'); const on = VW.mode === 'ink';
  if (!on) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'lnInk'; b.className = 'vwfloat lninkb'; vw$('.vwbody').append(b); }
  b.innerHTML = `<span>✏ Lápiz</span><i class="lninkc" style="--c:${VW_COLORS[VW.color][0]}"></i><small>dibuja con el dedo, el lápiz o el ratón</small><button data-onclick="vwMode('sel')" title="Dejar el lápiz" aria-label="Dejar el lápiz">✕</button>`;
}
function lnInkDown(e, p) {
  const r = p.el.getBoundingClientRect(), k = p.w / r.width, pt = [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('class', 'lnink lnlive'); sv.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`); sv.style.setProperty('--c', VW_COLORS[VW.color][0]);
  sv.innerHTML = `<path stroke-width="${LN_INK_W}" d="M${pt[0].toFixed(1)} ${pt[1].toFixed(1)}"/>`; p.el.append(sv);
  VW.drag = {kind: 'ink', p, id: e.pointerId, v: [pt], q: [vwToPdf(p, e.clientX, e.clientY)], sv, r, k};
  e.preventDefault(); try { $('#vwScroll').setPointerCapture(e.pointerId); } catch (er) {}
}
function lnInkMove(e, g) {
  const evs = e.getCoalescedEvents?.() || [e];
  for (const ev of evs) { const pt = [(ev.clientX - g.r.left) * g.k, (ev.clientY - g.r.top) * g.k], l = g.v.at(-1); if (Math.hypot(pt[0] - l[0], pt[1] - l[1]) < .8) continue; g.v.push(pt); g.q.push(vwToPdf(g.p, ev.clientX, ev.clientY)); }
  g.sv.firstChild.setAttribute('d', g.v.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''));
}
function lnInkUp(g, cancel) {
  g.sv.remove(); if (cancel) return; const pts = g.q.length > 1 ? g.q : [g.q[0], [g.q[0][0] + .6, g.q[0][1] + .6]];
  const st = pts.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]).slice(0, 2000), now = vwNow(), c = VW_COLORS[VW.color][0], L = VW.inkLast;
  const box = s => { const xs = s.filter((_, j) => !(j % 2)), ys = s.filter((_, j) => j % 2); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  if (L && L.p === g.p.i && L.c === c && Date.now() - L.t < 2000 && vwAnns().some(a => a.id === L.id && (a.g?.length || 0) < 60)) {
    vwMut(l => { const a = l.find(x => x.id === L.id); if (!a) return; a.g = [...a.g, st]; a.q = box(a.g.flat()); a.up = now; });
  } else { const id = uid(); vwAdd({id, k: 'ink', p: g.p.i, q: box(st), g: [st], c, at: now, up: now}); VW.inkLast = {id, p: g.p.i, c}; }
  VW.inkLast.t = Date.now();
}
function lnInkSvg(p, a) {   // los trazos de una anotación «ink», en el espacio de la página como se ve (escala 1)
  const v = vwVp(p); if (!v || !a.g) return '';
  const d = a.g.map(s => { let o = ''; for (let j = 0; j + 1 < s.length; j += 2) { const [x, y] = v.convertToViewportPoint(s[j], s[j + 1]); o += `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; } return o; }).join('');
  return `<svg class="lnink${VW.pop === a.id ? ' on' : ''}" data-a="${a.id}" viewBox="0 0 ${p.w.toFixed(1)} ${p.h.toFixed(1)}" preserveAspectRatio="none" style="--c:${a.c}" aria-hidden="true"><path stroke-width="${LN_INK_W}" d="${d}"/></svg>`;
}

/* ---- ⧉ Los dos PDF a la vez ---- */
const P2 = {doc: null, gen: 0, z: 1, n: 0, io: null};
function p2Other() {   // el otro PDF del paper (1 o 2), si lo tiene y es un PDF; 0 si no
  const s = VW.src; if (s?.kind !== 'paper') return 0; const P = (D && D.id === s.id ? D : null) || db.papers.find(x => x.id === s.id), n = s.n === 2 ? 1 : 2, pf = P?.[pdfF(n)];
  return pf && !isEpub(pf.name) ? n : 0;
}
const p2MenuBtn = () => { const n = p2Other(); return n ? `<button data-onclick="${P2.doc ? 'p2Close()' : 'p2Open()'}">⧉ ${P2.doc ? `Cerrar el PDF ${P2.n} de al lado` : `Ver el PDF ${n} al lado`}</button>` : ''; };
async function p2Open() {
  const n = p2Other(); if (!n) return; const id = VW.src.id, P = (D && D.id === id ? D : null) || db.papers.find(x => x.id === id), pf = P[pdfF(n)];
  if (vwDocked()) { vwNotesClose(true); if (vwDocked()) return; }   // las notas y el otro PDF van en el mismo sitio
  p2Close(true); const g = P2.gen; let file; try { file = await pdfFile(pdfKey(id, n), pf); } catch (e) { if (e.name !== 'AbortError') toast('No se pudo abrir el PDF: ' + e.message, [], 4000); return; }
  if (!file || g !== P2.gen || !VW.open) return;
  let doc; try { doc = await vwLoadDoc(await vwLib(), file); } catch (e) { return toast('No se pudo abrir el PDF: ' + e.message, [], 4000); }
  if (g !== P2.gen || !VW.open) { doc.destroy(); return; }
  Object.assign(P2, {doc, n, z: 1, name: pf.name, pgs: []});
  const pane = document.createElement('div'); pane.id = 'lnP2'; pane.className = 'lnp2'; pane.setAttribute('role', 'region'); pane.setAttribute('aria-label', 'PDF ' + n);
  pane.innerHTML = `<div class="lnp2h"><b>📄 PDF ${n}</b><span class="lnp2n" title="${esc(pf.name)}">${esc(pf.name)}</span><small id="lnP2pg"></small><button data-onclick="p2Zoom(-1)" title="Alejar" aria-label="Alejar">−</button><button data-onclick="p2Zoom(1)" title="Acercar" aria-label="Acercar">＋</button><button data-onclick="p2Close()" title="Cerrar el PDF ${n}" aria-label="Cerrar">✕</button></div><div class="lnp2s" id="lnP2s"></div>`;
  const body = vw$('.vwbody'); body.insertBefore(pane, $('#vwSide')); body.insertBefore(vwSplitEl(), pane); vwSplitSet(vwSplitGet()); $('#vw').classList.add('lnp2on'); vwSplitMode();
  if (VW.side && (vwMv() || innerWidth < 1500)) { VW.side = false; vwSideShow(); }   // como con las notas: sin el panel de anotaciones, cada PDF tiene su mitad
  const p1 = await doc.getPage(1); if (g !== P2.gen) return; const v1 = p1.getViewport({scale: 1}), s = $('#lnP2s');
  P2.ar = v1.width / v1.height; P2.pgs = Array.from({length: doc.numPages}, (_, i) => { const d = document.createElement('div'); d.className = 'lnp2p'; d.dataset.i = i; d.style.aspectRatio = `${v1.width} / ${v1.height}`; s.append(d); return {i, el: d, rs: 0, proxy: i ? null : p1}; });
  P2.io = new IntersectionObserver(es => { for (const e of es) { const p = P2.pgs[+e.target.dataset.i]; p.vis = e.isIntersecting; if (p.vis) p2Render(p); } }, {root: s, rootMargin: '600px 0px'});
  P2.pgs.forEach(p => P2.io.observe(p.el)); s.addEventListener('scroll', p2Pg, {passive: true}); p2Zoom(0); p2Pg();
  setTimeout(() => { if (VW.open && VW.fit) vwFitW(true); }, 60);   // el PDF de la izquierda, al nuevo ancho
}
async function p2Render(p) {
  if (!P2.doc || p.busy) return; const s = $('#lnP2s'); if (!s) return; const W = p.el.clientWidth, dpr = Math.min(2.5, devicePixelRatio || 1), want = Math.round(W * dpr);
  if (!W || p.rs === want && !p.dirty) return; p.busy = true; const g = P2.gen;
  try {
    p.proxy ||= await P2.doc.getPage(p.i + 1); if (g !== P2.gen) return; const v1 = p.proxy.getViewport({scale: 1}); p.el.style.aspectRatio = `${v1.width} / ${v1.height}`;
    const vp = p.proxy.getViewport({scale: want / v1.width}), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, pageColors: vwPC()}).promise; if (g !== P2.gen) return;
    p.el.querySelector('canvas')?.remove(); p.el.append(cv); p.rs = want; p.dirty = false;
  } catch (e) {} finally { p.busy = false; }
  if (p.vis && P2.doc && p.el.clientWidth && Math.round(p.el.clientWidth * Math.min(2.5, devicePixelRatio || 1)) !== p.rs) p2Render(p);   // cambió el zoom mientras se pintaba
}
function p2Zoom(d) {
  if (!P2.doc) return; const s = $('#lnP2s'), f = s.scrollTop / Math.max(1, s.scrollHeight); P2.z = Math.max(.5, Math.min(4, Math.round((P2.z + d * .25) * 100) / 100));
  s.style.setProperty('--z', P2.z); s.scrollTop = f * s.scrollHeight; clearTimeout(P2.zt); P2.zt = setTimeout(() => P2.pgs.forEach(p => { if (p.vis) p2Render(p); }), 120);
}
function p2Pg() { const s = $('#lnP2s'), o = $('#lnP2pg'); if (!s || !o || !P2.pgs.length) return; const y = s.getBoundingClientRect().top + 8; let i = 0; for (const p of P2.pgs) { if (p.el.getBoundingClientRect().bottom > y) { i = p.i; break; } } o.textContent = `p. ${i + 1}/${P2.pgs.length}`; }
function p2Redraw() { for (const p of P2.pgs || []) { p.dirty = true; if (p.vis) p2Render(p); } }   // otro tema (noche, sepia)
function p2Close(keep) {
  P2.gen++; P2.io?.disconnect(); P2.io = null; try { P2.doc?.destroy(); } catch (e) {} P2.doc = null; P2.pgs = [];
  const pane = $('#lnP2'); if (!pane) return; pane.remove(); if (!vwDocked() && !keep) $('#vwSplit')?.remove(); $('#vw')?.classList.remove('lnp2on');
  if (!keep) setTimeout(() => { if (VW.open && VW.fit) vwFitW(true); }, 60);
}
window.addEventListener('resize', () => { if (P2.doc) { vwSplitMode(); clearTimeout(P2.rt); P2.rt = setTimeout(() => P2.pgs.forEach(p => { if (p.vis) p2Render(p); }), 200); } });
/* ===== Buscar órdenes dentro del visor y del lector de EPUB (v40): Ctrl+K =====
   Las órdenes salen de los propios menús (⋯ y sus submenús, que se recorren sin mostrarlos) y de los botones visibles de la barra:
   así cualquier opción nueva de un menú aparece sola en la paleta. */
function rdCmds() {
  const ep = !VW.open && typeof EP !== 'undefined' && EP.open, menuFn = ep ? 'epMenu' : 'vwMenu', S = ep ? EP : VW, keepR = S.menuR, orig = window[menuFn], out = [], seen = new Set();
  const fake = {stopPropagation() {}, currentTarget: {getBoundingClientRect: () => ({left: 0, top: 0, right: innerWidth - 8, bottom: 52, width: 0, height: 0})}};
  const label = el => { const c = el.cloneNode(true); c.querySelectorAll('small').forEach(s => s.remove()); return (el.getAttribute('aria-label') || c.textContent || el.title || '').replace(/\s+/g, ' ').replace(/\s*›\s*$/, '').trim(); };
  const queue = [[ep ? () => epMore(fake) : () => vwMore(fake), []]]; let html = '';
  window[menuFn] = (r, h) => { html = h; };
  try {
    while (queue.length) {
      const [fn, path] = queue.shift(); html = ''; try { fn(); } catch (e) { continue; }
      const box = document.createElement('div'); box.innerHTML = html; let head = '';
      for (const el of box.querySelectorAll('.ctxh, button[data-onclick]')) {
        if (el.classList.contains('ctxh')) { head = el.textContent.replace(/\s+/g, ' ').trim(); continue; }
        const on = el.getAttribute('data-onclick'), t = label(el);
        if (!t || el.disabled || /Back\(\)$|^cmdOpen/.test(on) || /\bevent\b|\bthis\b/.test(on)) continue;
        if (/^\w+Menu\(\)$/.test(on)) { const f = window[on.slice(0, -2)]; if (!seen.has(on) && path.length < 2 && typeof f === 'function') { seen.add(on); queue.push([() => f(), [...path, t]]); } continue; }
        out.push({t: [...path, head, t].filter(Boolean).join(' › '), on});
      }
    }
  } finally { window[menuFn] = orig; S.menuR = keepR; }
  for (const b of (ep ? $('#ep') : $('#vw')).querySelectorAll('button[data-onclick]')) {   // la barra de arriba (lo que se ve)
    if (b.closest('.vwmenu, #vwPages, #epDoc') || !b.offsetParent) continue; const on = b.getAttribute('data-onclick'), t = label(b);
    if (t && !/\bevent\b|\bthis\b|^cmdOpen/.test(on) && !out.some(o => o.on === on)) out.push({t, on});
  }
  return out;
}
function rdCmdRun(on) {   // ejecuta una orden como si se pulsara su botón (el mismo minilenguaje data-on…)
  const host = VW.open ? $('#vw') : $('#ep'), b = document.createElement('button'); b.hidden = true; b.setAttribute('data-onclick', on); host.append(b); b.click(); b.remove();
}
