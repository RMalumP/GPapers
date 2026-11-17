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
  const auto = VW.open && VW.auto && !VW.autoPaused || typeof EP !== 'undefined' && EP.open && EP.auto && !EP.autoPaused;
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
    <button data-onclick="lnSelWeb('tr')">🌐 Traducir al español</button><button data-onclick="lnSelWeb('sch')">🎓 Buscar en Google Académico</button>
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
  if (!rdOpen() || document.hidden) { LNP.pg = -1; LNP.pos = -1; return; }
  const active = Date.now() - WL.act < 120e3 || VW.open && VW.auto && !VW.autoPaused || typeof EP !== 'undefined' && EP.open && EP.auto && !EP.autoPaused;
  if (VW.open && VW.pages.length) {
    if (LNP.pg !== VW.cur) {
      if (LNP.pg >= 0 && VW.cur === LNP.pg + (VW.two ? vwSpreadN(vwSpread(LNP.pg)) : 1) && LNP.acc >= 8 && LNP.acc <= 900) {   // pasó a la siguiente: lo que tardó en esa
        const per = LNP.acc / (VW.two ? vwSpreadN(vwSpread(LNP.pg)) : 1), old = lnNum('gp-vw-pace', 75, 5, 1800); try { localStorage.setItem('gp-vw-pace', Math.round(old * .8 + per * .2)); } catch (e) {} }
      LNP.pg = VW.cur; LNP.acc = 0;
    } else if (active) LNP.acc += 5;
  } else if (typeof EP !== 'undefined' && EP.open && EP.secs.length) {
    const l = epLoc(), pos = EP.cum[l.i] + l.f * EP.len[l.i];
    if (LNP.pos >= 0 && active) { const d = pos - LNP.pos; if (d > 0 && d < 6000) { LNP.chars += d; LNP.secs += 5; } else if (d <= 0) LNP.secs += 5; }
    LNP.pos = pos;
    if (LNP.secs >= 60) { if (LNP.chars > 150) { const v = LNP.chars / LNP.secs * 60, old = lnNum('gp-ep-pace', 1300, 100, 20000); try { localStorage.setItem('gp-ep-pace', Math.round(old * .8 + Math.min(8000, v) * .2)); } catch (e) {} } LNP.chars = LNP.secs = 0; }
  }
  lnLeftShow();
}
setInterval(lnPaceTick, 5000);

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
