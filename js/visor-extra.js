'use strict';
/* ===== Visor de PDF: doce mejoras (v40.8) =====
   1 · ➕ Añadir a GPapers desde una cita: en la vista previa de «[12]» (o de cualquier enlace a la bibliografía) se lee la referencia; si ya está en la
       biblioteca (mismo DOI o el título dentro de la referencia), «✓ Ya en tu biblioteca» con «Abrir»; si no, «➕ Añadir a GPapers» la busca en CrossRef
       (por DOI si lo trae) y abre la ventana de importar. El paper nuevo queda en Relaciones como citado por el que lees.
   2 · ▥ Columna a columna (📖 Modo de lectura, con página a página): en un PDF a dos columnas, cada toque enseña la columna siguiente ampliada al ancho
       (arriba a la izquierda, abajo a la izquierda, arriba a la derecha…); en una sola columna, el bloque de texto sin márgenes, de arriba abajo.
   3 · Zona → 📷 imagen: la ventanita de una zona (▭) copia el recuadro como imagen, lo guarda como PNG o lo pone como imagen del paper.
   4 · Atrás y adelante: todos los saltos (índice, búsqueda, enlaces, marcadores, ir a página, anotaciones, figuras…) se apuntan; Alt+← / Alt+→,
       los botones laterales del ratón y la píldora «‹ p. 3 · p. 12 ›» abajo a la izquierda.
   5 · Marcas junto a la barra de desplazamiento: subrayados (en su color), marcadores y resultados de la búsqueda; tocar una lleva a su sitio.
   6 · 🖼 Figuras: pestaña del panel con las figuras y tablas del PDF (por sus pies: «Figura 3.», «Table 2:»…) y una miniatura de cada una.
   7 · 🔤 Siglas: al seleccionar una sigla («RNN»), un botón en la barra de la selección dice dónde la definía el propio PDF.
   8 · 📏 Regla de lectura: oscurece todo menos unas líneas; sigue al ratón o se arrastra con el dedo (tecla M).
   9 · 📄 Texto adaptado: el texto de las páginas, en párrafos que se ajustan a la pantalla (sobre todo en el móvil), con su tamaño de letra (tecla T).
  10 · 🔠 Reconocer el texto (OCR): para PDF escaneados, con Tesseract en el propio dispositivo (lib/tesseract, ~13 MB que se bajan la primera vez).
       Luego se puede seleccionar, subrayar y buscar (también desde la lista). Se guarda en este navegador («pdfocr:<clave>»).
  11 · 🃏 Anki: las anotaciones (todas, las del filtro o las elegidas) como archivo para importar en Anki (anverso: el texto; reverso: el comentario y la cita).
  12 · ≠ Diferencias entre el PDF 1 y el PDF 2 (con los dos a la vez): marca las frases que solo están en uno de los dos y deja ir de una a otra.
   Todo se recuerda en este dispositivo: gp-vw-col, gp-vw-map, gp-vw-regla, gp-vw-flow. */
const VX = {gen: -1, lines: new Map(), cols: new Map(), raw: new Map(), figs: null, seg: null, ocr: new Map()};
function vxReset() { if (VX.gen === VW.gen) return; Object.assign(VX, {gen: VW.gen, lines: new Map(), cols: new Map(), raw: new Map(), figs: null, seg: null, ocr: new Map(), acr: null, diff: null}); }
const vxLs = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const vxLsPut = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const vxSleep = () => new Promise(r => setTimeout(r, 0));

/* ---- El texto de una página, en líneas (puntos de la página como se ve, escala 1; origen arriba a la izquierda) ---- */
async function vxLines(p) {
  vxReset(); if (VX.lines.has(p.i)) return VX.lines.get(p.i);
  const ow = VX.ocr.get(p.i); let boxes = [];
  if (ow) { p.proxy ||= await VW.doc.getPage(p.i + 1); vwVp(p); boxes = ow.map(w => { const b = vwBoxes(p, w.q)[0]; return b && {x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h, h: b.h, s: w.t}; }).filter(Boolean); }
  else {
    p.proxy ||= await VW.doc.getPage(p.i + 1); const v = vwVp(p), tc = await p.proxy.getTextContent();
    for (const it of tc.items) {
      if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue; const t = it.transform, h = Math.hypot(t[2], t[3]) || it.height || 10;
      const [a, b, c, d] = v.convertToViewportRectangle([t[4], t[5] - h * .2, t[4] + (it.width || 0), t[5] + h * .85]);
      boxes.push({x0: Math.min(a, c), y0: Math.min(b, d), x1: Math.max(a, c), y1: Math.max(b, d), h: Math.abs(d - b) / 1.05, s: it.str});
    }
  }
  boxes.sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);
  const L = [];
  for (const b of boxes) {   // misma altura (centro a menos de media letra) y cerca a lo ancho: misma línea; un hueco grande la parte (dos columnas)
    const cy = (b.y0 + b.y1) / 2, ln = L.slice(-12).find(l => Math.abs((l.y0 + l.y1) / 2 - cy) < Math.max(2, Math.min(l.h, b.h) * .5) && b.x0 - l.x1 < Math.max(9, b.h * 1.1) && l.x0 - b.x1 < Math.max(9, b.h * 1.1));
    if (ln) { const sp = b.x0 - ln.x1 > b.h * .15 && !/[\s-]$/.test(ln.s) ? ' ' : ''; if (b.x0 >= ln.x1 - 1) ln.s += sp + b.s; else ln.s = b.s + ' ' + ln.s; ln.x0 = Math.min(ln.x0, b.x0); ln.x1 = Math.max(ln.x1, b.x1); ln.y0 = Math.min(ln.y0, b.y0); ln.y1 = Math.max(ln.y1, b.y1); ln.h = Math.max(ln.h, b.h); }
    else L.push({...b});
  }
  L.forEach(l => l.s = l.s.replace(/\s+/g, ' ').trim()); const out = L.filter(l => l.s).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  VX.lines.set(p.i, out); return out;
}
/* Bloques de lectura de una página: [{x0, y0, x1, y1, lines}] en orden (lo de arriba a todo el ancho, columna izquierda, derecha, lo de abajo).
   Columnas: un hueco vertical sin texto entre el 30 % y el 70 % del ancho, con bastante texto a cada lado. */
async function vxCols(p) {
  vxReset(); if (VX.cols.has(p.i)) return VX.cols.get(p.i);
  const L = await vxLines(p), W = p.w, box = ls => ({x0: Math.min(...ls.map(l => l.x0)), y0: Math.min(...ls.map(l => l.y0)), x1: Math.max(...ls.map(l => l.x1)), y1: Math.max(...ls.map(l => l.y1)), lines: ls});
  let out = [];
  if (L.length) {
    const narrow = L.filter(l => l.x1 - l.x0 < W * .55), bins = new Float32Array(Math.ceil(W / 2) + 1);
    for (const l of narrow) for (let x = Math.max(0, Math.floor(l.x0 / 2)); x <= Math.min(bins.length - 1, Math.ceil(l.x1 / 2)); x++) bins[x] += l.y1 - l.y0;
    let best = null;
    for (let x = Math.floor(W * .3 / 2); x <= Math.ceil(W * .7 / 2); x++) if (bins[x] === 0) { const g = x * 2, a = narrow.filter(l => l.x1 <= g), b = narrow.filter(l => l.x0 >= g);
      if (a.length >= 5 && b.length >= 5 && narrow.length >= 12 && (!best || Math.abs(g - W / 2) < Math.abs(best - W / 2))) best = g; }
    if (best != null) {
      const left = L.filter(l => l.x1 <= best + 2), right = L.filter(l => l.x0 >= best - 2), mid = L.filter(l => l.x1 > best + 2 && l.x0 < best - 2);
      const cTop = Math.min(...[...left, ...right].map(l => l.y0)), cBot = Math.max(...[...left, ...right].map(l => l.y1));
      const top = mid.filter(l => l.y1 <= cTop + 4 || l.y0 < cTop), bot = mid.filter(l => !top.includes(l));
      out = [top, left, right, bot].filter(x => x.length).map(box);
    } else out = [box(L)];
  }
  VX.cols.set(p.i, out); return out;
}
async function vxPageStr(i) {   // el texto de una página, tal cual (con mayúsculas), para las siglas y el texto adaptado
  vxReset(); if (VX.raw.has(i)) return VX.raw.get(i); const p = VW.pages[i]; if (!p) return '';
  const s = (await vxLines(p)).map(l => l.s).join('\n'); VX.raw.set(i, s); return s;
}
function vxGoH(i) { if (!VW.pages[i]) return; if (i !== VW.cur) lnPush(); vwGo(i); }   // ir a una página dejando «atrás»
function vxShowH(i, y) { const p = VW.pages[i]; if (!p) return; lnPush(); vwShowAt(p, y); if (VW.flip) vwFlipShow(); }

/* ===== 1 · ➕ Añadir a GPapers desde una cita ===== */
const VX_REFNUM = /^\s*(\[\d{1,4}\]|\d{1,4}\.\s|\(\d{1,4}\)\s)/;
async function vxRefText(p, t) {   // la referencia a la que lleva un enlace: desde el destino hacia abajo, hasta la siguiente referencia
  const B = await vxCols(p); if (!B.length) return '';
  const x = t.x != null ? t.x + 4 : null, blk = B.find(b => (x == null || x >= b.x0 - 6 && x <= b.x1 + 6) && t.y >= b.y0 - 14 && t.y <= b.y1 + 2) || B.find(b => x == null || x >= b.x0 - 6 && x <= b.x1 + 6) || B[0];
  const L = blk.lines, k = L.findIndex(l => l.y1 >= t.y - 1); if (k < 0) return '';
  const first = L[k], out = [first]; let prev = first; const hang = L[k + 1] && L[k + 1].x0 > first.x0 + 4;
  for (let j = k + 1; j < L.length && out.length < 9; j++) {
    const l = L[j]; if (l.y0 - prev.y1 > Math.max(prev.h, l.h) * .9) break;   // un hueco: otra referencia u otro bloque
    if (VX_REFNUM.test(l.s)) break;
    if (hang && Math.abs(l.x0 - first.x0) < 3) break;   // sangría francesa: otra referencia empieza al borde
    if (!hang && /[.]$/.test(prev.s) && /^[A-ZÁÉÍÓÚÑ][\p{L}'’-]+,\s/u.test(l.s) && out.length > 1) break;   // «Apellido, N.» tras un punto
    out.push(l); prev = l;
  }
  return out.map(l => l.s).join('\n').replace(/-\n(?=\p{Ll})/gu, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700);
}
const vxIsRef = s => s.length > 25 && /\b(1[89]|20)\d{2}\b/.test(s);
const vxDoiIn = s => { const m = /\b10\.\d{4,9}\/[^\s"<>]+/.exec(String(s).replace(/doi\.org\/\s+/gi, 'doi.org/')); return m ? normDoi(m[0].replace(/[.,;)\]]+$/, '')) : ''; };
function vxRefHave(s) {   // ¿ya está en la biblioteca? Mismo DOI, o su título está dentro del texto de la referencia
  const d = vxDoiIn(s); if (d) { const p = db.papers.find(q => normDoi(q.doi) === d); if (p) return p; }
  const n = ' ' + normTitle(s) + ' '; return db.papers.find(q => { const t = normTitle(q.title); return t.length >= 15 && n.includes(' ' + t + ' '); }) || null;
}
async function vxRefInfo(t, pp, R) {   // en la vista previa de un enlace: la referencia, con «Abrir» o «➕ Añadir a GPapers»
  const p = VW.pages[t.i]; if (!p) return; let s = ''; try { s = await vxRefText(p, t); } catch (e) { return; }
  if (LN.t !== t || pp.hidden || !vxIsRef(s)) return;
  const have = vxRefHave(s); VX.ref = {s, have: have?.id || null};
  pp.querySelector('.vwpopb')?.insertAdjacentHTML('beforeend', have
    ? `<span class="vxrefok" title="${esc(have.title || '')}">✓ Ya en tu biblioteca</span><button data-onclick="vxRefOpen()" title="Abrir su ficha">📝 Abrir</button>`
    : `<button data-onclick="vxRefAdd()" title="Buscar esta referencia en CrossRef y añadirla a la biblioteca">➕ Añadir a GPapers</button>`);
  if (R) lnPlace(pp, R, $('#vw'));
}
function vxRefOpen() { const id = VX.ref?.have; lnClose(); if (id && db.papers.some(p => p.id === id)) openPaper(id); }
async function vxRefAdd() {
  const r = VX.ref; if (!r?.s) return; lnClose(); const from = VW.src?.kind === 'paper' ? VW.src.id : null, d = vxDoiIn(r.s);
  toast('Buscando la referencia en CrossRef…', [], 8000);
  try {
    const intro = `Desde una cita del PDF: «${r.s.length > 220 ? r.s.slice(0, 220) + '…' : r.s}»`; let one = null;
    if (d) { try { one = await fetchDoi(d); } catch (e) {} }
    IMP = one ? {mode: 'prev', refs: impPrepare([one]), from, intro} : {mode: 'pick', q: r.s.length > 120 ? r.s.slice(0, 120) + '…' : r.s, refs: impPrepare(await searchTitle(r.s.slice(0, 400))), from, intro};
    toast('Elige la referencia y pulsa «Importar».', [], 1500); impDraw(); if (!$('#imp').open) $('#imp').showModal();
  } catch (e) { toast(e.message || 'No se pudo buscar la referencia.', [], 4500); }
}
function vxRefLink(ids) {   // tras importar desde una cita: el paper que se lee «cita a» los nuevos (Relaciones)
  const P = IMP?.from && db.papers.find(p => p.id === IMP.from); if (!P || !ids.length) return 0;
  P.refTo = [...new Set([...(P.refTo || []), ...ids])]; P.modified = new Date().toISOString(); return ids.length;
}

/* ===== 2 · ▥ Columna a columna ===== */
const VX_COL_K = 'gp-vw-col';
const vxColWant = () => !!vxLs(VX_COL_K, false);
async function vxSegs(p) {   // los trozos de la página que se enseñan uno tras otro: {x, y, sc} (punto de arriba a la izquierda y escala)
  const sc = $('#vwScroll'), W = Math.max(100, sc.clientWidth - 2 * VW_GAP), H = Math.max(100, sc.clientHeight - 2 * VW_GAP);
  let B = []; try { B = await vxCols(p); } catch (e) {}
  if (!B.length) B = [{x0: 0, y0: 0, x1: p.w, y1: p.h}];
  const out = [];
  for (const b of B) {
    const bw = Math.max(40, b.x1 - b.x0 + 8), s = Math.max(.25, Math.min(6, W / bw)), hp = H / s, x = b.x0 - 4 - Math.max(0, (W / s - bw) / 2);
    for (let y = b.y0 - 6; ; y += hp * .9) { out.push({x, y: Math.max(0, y), sc: s}); if (y + hp >= b.y1 + 4 || out.length > 300) break; }
  }
  return out;
}
async function vxColGo(i, k) {
  const p = VW.pages[i]; if (!p || !VW.col) return; const gen = VW.gen, segs = await vxSegs(p); if (gen !== VW.gen || !VW.col) return;
  if (k < 0) k = segs.length - 1; k = Math.max(0, Math.min(segs.length - 1, k)); const s = segs[k]; VX.seg = {i, k, n: segs.length};
  if (VW.cur !== i || !p.el.classList.contains('cur')) vwGo(i, true);
  const sc = $('#vwScroll'); VW.fit = false; if (Math.abs(VW.scale - s.sc) > .001) vwScaleSet(s.sc);
  const r = p.el.getBoundingClientRect(), R = sc.getBoundingClientRect();
  sc.scrollLeft += r.left + s.x * VW.scale - R.left - VW_GAP; sc.scrollTop += r.top + s.y * VW.scale - R.top - VW_GAP;
  vxTip(`p. ${i + 1} · ${k + 1} de ${segs.length}`);
}
function vxColStep(d) {   // devuelve true si lo ha hecho el modo columna a columna
  if (!VW.col || !VW.pages.length) return false; const g = VX.seg;
  if (!g || g.i !== VW.cur) { vxColGo(VW.cur, d > 0 ? 0 : -1); return true; }
  const k = g.k + d;
  if (k >= 0 && k < g.n) vxColGo(g.i, k);
  else if (g.i + d >= 0 && g.i + d < VW.pages.length) vxColGo(g.i + d, d > 0 ? 0 : -1);
  else toast(d > 0 ? 'Final del PDF.' : 'Principio del PDF.', [], 1200);
  return true;
}
function vxColSet(on, quiet) {
  on = !!on; vxLsPut(VX_COL_K, on); if (!VW.open) return; VW.col = on; VX.seg = null;
  if (on) {
    if (VW.auto) vwAutoStop(); VW.zLock = false; VW.flip = true; VW.two = false; vwRdSave(); vwRdClass(); vwFlipShow();
    vxColGo(VW.cur, 0); if (!quiet) toast('Columna a columna: toca a la derecha (o →) para ver la siguiente columna; a la izquierda, la anterior.', [], 3200);
  } else { vwFitW(); vwGo(VW.cur, true); }
  $('#vw').classList.toggle('vxcol', on);
}
function vxColOff() { if (VW.col) { VW.col = false; VX.seg = null; vxLsPut(VX_COL_K, false); $('#vw')?.classList.remove('vxcol'); } }
function vxTip(t) { const e = $('#vwPgTip'); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(VX.tipT); VX.tipT = setTimeout(() => e.hidden = true, 1400); }
window.addEventListener('resize', () => { if (VW.open && VW.col && VX.seg) { clearTimeout(VX.rzT); VX.rzT = setTimeout(() => VX.seg && vxColGo(VX.seg.i, VX.seg.k), 200); } });

/* ===== 3 · Zona → imagen ===== */
async function vxAreaCanvas(a, max = 2400) {   // el recuadro de una zona, pintado aparte a buena resolución
  const p = VW.pages[a.p]; if (!p) throw Error('Página no encontrada'); p.proxy ||= await VW.doc.getPage(a.p + 1); vwVp(p);
  const b = vwBoxes(p, a.q)[0]; if (!b) throw Error('Zona vacía'); const s = Math.min(4, max / Math.max(b.w, b.h, 1));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(b.w * s)); cv.height = Math.max(1, Math.round(b.h * s));
  await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vwGV(p, {scale: s, offsetX: -b.x * s, offsetY: -b.y * s})}).promise;
  return cv;
}
const vxBlob = cv => new Promise((ok, ko) => cv.toBlob(b => b ? ok(b) : ko(Error('No se pudo hacer la imagen')), 'image/png'));
const vxAreaOf = () => vwAnns().find(x => x.id === VW.pop && x.k === 'area');
async function vxAreaCopy(id) {
  const a = id ? vwAnns().find(x => x.id === id) : vxAreaOf(); if (!a) return;
  try {
    if (!window.ClipboardItem || !navigator.clipboard?.write) throw Error('no');
    await navigator.clipboard.write([new ClipboardItem({'image/png': vxAreaCanvas(a).then(vxBlob)})]);
    toast('Imagen copiada: pégala en un documento o una presentación.', [], 2500);
  } catch (e) { toast('Este navegador no deja copiar imágenes. Guárdala como PNG.', [{t: '⬇ PNG', fn: () => vxAreaPng(a.id)}], 5000); }
}
async function vxAreaPng(id) {
  const a = id ? vwAnns().find(x => x.id === id) : vxAreaOf(); if (!a) return;
  try { const b = await vxBlob(await vxAreaCanvas(a)), u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u;
    l.download = `${(vwTitle().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() || 'figura')} - p. ${a.p + 1}.png`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  catch (e) { toast('No se pudo hacer la imagen: ' + e.message, [], 3500); }
}
async function vxAreaCover() {   // la zona como imagen del paper (copia reducida dentro del JSON, como «Incrustar» en la ficha)
  const a = vxAreaOf(), P = VW.src?.kind === 'paper' && db.papers.find(p => p.id === VW.src.id); if (!a || !P) return;
  try {
    const cv = await vxAreaCanvas(a, 960), k = Math.min(1, 480 / Math.max(cv.width, cv.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cv.width * k)); c.height = Math.max(1, Math.round(cv.height * k)); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    const img = {kind: 'data', data: c.toDataURL('image/jpeg', .85)}; P.image = img; P.modified = vwNow(); if (D && D.id === P.id && $('#dlg').open) { D.image = structuredClone(img); if (typeof imgBox === 'function') imgBox(); }
    logChange(P, 'Imagen del paper desde el PDF'); markDirty(); RENDER_VW = true; toast('Puesta como imagen del paper.', [{t: 'Deshacer', fn: undo}], 4000);
  } catch (e) { toast('No se pudo hacer la imagen: ' + e.message, [], 3500); }
}
const vxAreaBtns = a => a.k !== 'area' ? '' : `<button data-onclick="vxAreaCopy()" title="Copiar el recuadro como imagen">📷 Copiar imagen</button><button data-onclick="vxAreaPng()" title="Guardar el recuadro como imagen PNG">⬇ PNG</button>${VW.src?.kind === 'paper' ? '<button data-onclick="vxAreaCover()" title="Usar el recuadro como imagen del paper (la de las tarjetas)">🖼 Imagen del paper</button>' : ''}`;

/* ===== 4 · Atrás y adelante ===== */
function lnFwd() {
  const f = LN.fwd.pop(); if (!f) return lnBackShow(); const a = vwAnchor(); if (a) LN.back.push({i: VW.cur, a, sl: $('#vwScroll').scrollLeft});
  if (VW.flip) vwGo(f.i, true); vwAnchorSet(f.a); $('#vwScroll').scrollLeft = f.sl; if (!VW.flip) VW.cur = f.i; vwOnScroll(); lnBackShow();
}
document.addEventListener('mouseup', e => { if (!VW.open || (e.button !== 3 && e.button !== 4) || !e.target.closest?.('#vw')) return; e.preventDefault(); e.button === 3 ? lnBack() : lnFwd(); }, true);   // botones laterales del ratón
document.addEventListener('mousedown', e => { if (VW.open && (e.button === 3 || e.button === 4) && e.target.closest?.('#vw')) e.preventDefault(); }, true);

/* ===== 5 · Marcas junto a la barra de desplazamiento ===== */
const VX_MAP_K = 'gp-vw-map';
const vxMapOn = () => vxLs(VX_MAP_K, true) !== false;
function vxMapSet(on) { vxLsPut(VX_MAP_K, !!on); vxMapDraw(); }
function vxMapEl() {
  let m = $('#vxMap'); if (m || !$('#vw .vwbody')) return m;
  vw$('.vwbody').insertAdjacentHTML('beforeend', '<div id="vxMap" class="vxmap" aria-hidden="true"><div class="vxmapc"></div><div class="vxmapm"></div></div>'); m = $('#vxMap');
  m.addEventListener('click', vxMapClick); new ResizeObserver(vxMapPlace).observe($('#vwScroll')); return m;
}
function vxMapPlace() {
  const m = $('#vxMap'), sc = $('#vwScroll'); if (!m || !sc) return; const sb = sc.offsetWidth - sc.clientWidth;
  Object.assign(m.style, {left: sc.offsetLeft + sc.clientWidth - m.offsetWidth - 1 + 'px', top: sc.offsetTop + 'px', height: sc.clientHeight + 'px'}); m.classList.toggle('sb', sb > 0);
}
function vxMapDraw() {
  const m = vxMapEl(); if (!m) return; const N = VW.pages.length; m.hidden = !vxMapOn() || !N; if (m.hidden) return;
  const f = (i, y) => ((i + Math.max(0, Math.min(1, y))) / N * 100).toFixed(3) + '%', H = [];
  for (const a of vwAnns()) { const p = VW.pages[a.p]; if (!p) continue; H.push(`<i class="vxmk" style="top:${f(a.p, vwTop(a) / (p.h || 1))};--c:${a.c}" data-i="${a.p}" data-y="${vwTop(a).toFixed(1)}"></i>`); }
  for (const i of vwBms()) H.push(`<i class="vxmk bm" style="top:${f(i, 0)}" data-i="${i}" data-y="0"></i>`);
  for (const h of VW.find.hits.slice(0, 2000)) { const p = VW.pages[h.p], b = p && vwHitBoxes(p, h)[0]; H.push(`<i class="vxmk fh" style="top:${f(h.p, b ? b.y / (p.h || 1) : 0)}" data-i="${h.p}" data-y="${b ? b.y.toFixed(1) : 0}"></i>`); }
  m.querySelector('.vxmapm').innerHTML = H.join(''); vxMapPlace(); vxMapCur();
}
function vxMapCur() {
  const m = $('#vxMap'); if (!m || m.hidden || !VW.pages.length) return; const N = VW.pages.length, a = vwAnchor(), sc = $('#vwScroll'), p = VW.pages[VW.cur];
  const top = VW.flip || !a ? VW.cur / N : (a.i + Math.max(0, a.f)) / N, h = VW.flip ? vwSpreadN(vwSpread(VW.cur)) / N : sc.clientHeight / Math.max(1, (p?.el.offsetHeight || 1) + VW_GAP) / N;
  Object.assign(m.querySelector('.vxmapc').style, {top: (top * 100).toFixed(3) + '%', height: Math.max(.6, Math.min(100, h * 100)).toFixed(3) + '%'});
}
function vxMapClick(e) {
  const m = $('#vxMap'), R = m.getBoundingClientRect(), y = e.clientY;
  const mk = [...m.querySelectorAll('.vxmk')].map(k => [k, Math.abs(k.getBoundingClientRect().top + 2 - y)]).filter(x => x[1] < 9).sort((a, b) => a[1] - b[1])[0]?.[0];
  if (mk) return vxShowH(+mk.dataset.i, Math.max(0, +mk.dataset.y - 20));
  const f = Math.max(0, Math.min(.9999, (y - R.top) / R.height)) * VW.pages.length, i = Math.floor(f), p = VW.pages[i]; if (p) vxShowH(i, (f - i) * p.h);
}

/* ===== 6 · 🖼 Figuras y tablas ===== */
const VX_CAP = /^(fig(?:ure|ura)?s?|table|tabla|cuadro|gr[aá]fico)\.?\s*([0-9]+[a-z]?|[IVXL]+)\s*([.:|—–-]|$)/i;
async function vxFigScan(gen, draw) {
  if (VX.figs && !VX.figs.busy) return VX.figs.L; if (VX.figs) { VX.figs.draw = draw; return null; }   // ya está buscando: solo cambia a quién avisa
  const F = VX.figs = {L: [], seen: new Set(), busy: true, n: 0, draw};
  for (let i = F.n; i < VW.pages.length; i++) {
    if (gen !== VW.gen) return null; const p = VW.pages[i]; let L = []; try { L = await vxLines(p); } catch (e) {}
    L.forEach((l, j) => {
      const m = VX_CAP.exec(l.s); if (!m || !m[3] && !/^(TABLE|FIGURE|TABLA|FIGURA)\s/.test(l.s) && m[0].length < l.s.length) return;   // «Figure 1 shows…» no es un pie; «Table 1» sola en su línea sí
      const tab = /^(table|tabla|cuadro)/i.test(m[1]), key = (tab ? 't' : 'f') + m[2].toLowerCase(); if (F.seen.has(key)) return; F.seen.add(key);
      let t = l.s; for (let k = j + 1; k < L.length && t.length < 160 && L[k].y0 - L[k - 1].y1 < l.h * .8 && Math.abs(L[k].x0 - l.x0) < l.h * 6; k++) t += ' ' + L[k].s;
      F.L.push({tab, n: m[2], p: i, y: l.y0, x0: l.x0, x1: l.x1, t: t.replace(/-\s(?=\p{Ll})/gu, '').slice(0, 180)});
    });
    F.n = i + 1; if (i % 8 === 7) { F.draw?.(); await vxSleep(); }
  }
  F.busy = false; F.draw?.(); return F.L;
}
function vxFigRegion(f) {   // qué trozo enseñar: encima del pie (figuras) o debajo del título (tablas)
  const p = VW.pages[f.p], c = vwCropOn(), l = c ? c.l : 0, r = p.w - (c ? c.r : 0), H = p.h * (f.tab ? .3 : .38);
  const y0 = f.tab ? Math.max(0, f.y - 6) : Math.max(c ? c.t : 0, f.y - H), y1 = f.tab ? Math.min(p.h, f.y + H) : Math.min(p.h, f.y + 26);
  return {x: l, y: y0, w: r - l, h: Math.max(30, y1 - y0)};
}
function vxFigDraw(s, head) {
  const gen = VW.gen, list = () => {
    const box = s.querySelector('.vxfigs'); if (!box || VW.tab !== 'fig') return; const F = VX.figs, L = F?.L || [];
    const done = F && !F.busy, prog = !done ? `<p class="empty">Buscando figuras y tablas… ${F ? F.n : 0} de ${VW.pages.length} páginas</p>` : '';
    box.innerHTML = (L.length ? L.map((f, k) => `<button class="vwi vxfig" style="--c:${f.tab ? '#4dabf7' : '#5fd068'}" data-k="${k}" data-onclick="vxFigGo(${k})"><small>${f.tab ? '▦ Tabla' : '🖼 Figura'} ${esc(f.n)} · p. ${f.p + 1}</small><span class="vxfigi"></span><span class="vwit">${esc(f.t)}</span></button>`).join('') : done ? '<p class="empty">No he encontrado pies de figura ni títulos de tabla («Figura 1.», «Table 2:»…) en este PDF.</p>' : '') + prog;
    VX.figIo?.disconnect(); VX.figIo = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { VX.figIo.unobserve(e.target); vxFigThumb(e.target); } }, {root: box, rootMargin: '300px'});
    box.querySelectorAll('.vxfig').forEach(b => VX.figIo.observe(b));
  };
  s.innerHTML = `${head}<div class="vwsl vxfigs"></div>`; list(); vxFigScan(gen, list);
}
async function vxFigThumb(b) {
  const f = VX.figs?.L[+b.dataset.k], p = f && VW.pages[f.p], gen = VW.gen; if (!p) return;
  try {
    p.proxy ||= await VW.doc.getPage(f.p + 1); if (gen !== VW.gen) return; vwVp(p); const g = vxFigRegion(f), W = 280 * Math.min(devicePixelRatio || 1, 2), s = W / g.w;
    const cv = document.createElement('canvas'); cv.width = Math.round(g.w * s); cv.height = Math.round(g.h * s);
    await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vwGV(p, {scale: s, offsetX: -g.x * s, offsetY: -g.y * s}), pageColors: vwPC()}).promise; if (gen !== VW.gen) return;
    b.querySelector('.vxfigi')?.replaceChildren(cv);
  } catch (e) {}
}
function vxFigGo(k) { const f = VX.figs?.L[k]; if (!f) return; const g = vxFigRegion(f); vxShowH(f.p, Math.max(0, g.y - 8)); if (vwMv()) vwSide(false); }

/* ===== 7 · 🔤 Siglas ===== */
const vxAcrOf = t => { t = String(t || '').trim().replace(/^[(«"']+|[)»"'.,;:]+$/g, ''); return /^[A-Za-z][A-Za-z0-9&-]{0,9}$/.test(t) && (t.match(/[A-Z]/g) || []).length >= 2 && t.length <= 10 ? t : ''; };
function vxAcrBtn(r) { const b = $('#vwSel .vxacr'); if (!b) return; const a = r ? vxAcrOf(r.toString()) : ''; b.hidden = !a; if (a) { b.textContent = '🔤'; b.title = `¿Qué significa «${a}»? (dónde la define este PDF)`; } }
function vxSh(sf, lf) {   // Schwartz y Hearst (2003): la forma larga más corta cuyas letras forman la sigla, de derecha a izquierda
  let s = sf.length - 1, l = lf.length - 1; const al = c => /[\p{L}\p{N}]/u.test(c);
  for (; s >= 0; s--) {
    const c = sf[s].toLowerCase(); if (!al(c)) continue;
    while (l >= 0 && (lf[l].toLowerCase() !== c || s === 0 && l > 0 && al(lf[l - 1]))) l--;
    if (l < 0) return null; l--;
  }
  return lf.slice(lf.lastIndexOf(' ', l) + 1);
}
function vxAcrDef(A, pages) {   // [forma larga, página] buscando «forma larga (SIGLA)» y luego «SIGLA (forma larga)»
  const base = A.replace(/s$/, ''), rxA = new RegExp(`\\(\\s*${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\s*[);,]`, 'g');
  for (let i = 0; i < pages.length; i++) {
    const T = pages[i].replace(/-\n(?=\p{Ll})/gu, '').replace(/\s+/g, ' '); let m;
    rxA.lastIndex = 0;
    while ((m = rxA.exec(T))) {
      const pre = T.slice(Math.max(0, m.index - 160), m.index).trim().split(' '), n = Math.min(base.length + 5, base.length * 2), win = pre.slice(-n).join(' ');
      const lf = vxSh(base, win); if (lf && lf.length > base.length + 1 && lf.split(' ').length <= n) return [lf.replace(/^[^\p{L}\p{N}]+/u, ''), i];
    }
    const rxB = new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\s*\\(([^()]{4,120})\\)`, 'g');
    while ((m = rxB.exec(T))) { const lf = vxSh(base, m[1].trim()); if (lf && lf.length > base.length + 1 && lf.length >= m[1].trim().length * .6) return [m[1].trim(), i]; }
  }
  return null;
}
async function vxAcr() {
  const r = vwSelRange(); const A = r && vxAcrOf(r.toString()); if (!A) return; const R = $('#vwSel').getBoundingClientRect();
  getSelection().removeAllRanges(); $('#vwSel').hidden = true;
  const pp = vxPop('vxAcrPop'); pp.innerHTML = `<div class="vwpoph"><span class="vwk">🔤 ${esc(A)}</span><button class="vwib" data-onclick="vxPopClose('vxAcrPop')" aria-label="Cerrar">✕</button></div><p class="empty">Buscando dónde se define…</p>`; pp.hidden = false; lnPlace(pp, R, $('#vw'));
  const gen = VW.gen, pages = []; for (let i = 0; i < VW.pages.length; i++) { pages.push(await vxPageStr(i)); if (gen !== VW.gen) return; if (i % 10 === 9) await vxSleep(); }
  const d = vxAcrDef(A, pages), n = pages.reduce((s, t) => s + (t.match(new RegExp(`\\b${A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length, 0);
  if (pp.hidden) return; VX.acr = {A, d};
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">🔤 ${esc(A)}${n ? ` · sale ${n} ${n === 1 ? 'vez' : 'veces'}` : ''}</span><button class="vwib" data-onclick="vxPopClose('vxAcrPop')" aria-label="Cerrar">✕</button></div>
    ${d ? `<p class="vxacrd"><b>${esc(d[0])}</b></p><small class="vxacrp">Definida en la página ${d[1] + 1}</small><div class="row vwpopb"><button class="pri" data-onclick="vxAcrGo()">➜ Ir allí</button><button data-onclick="vxAcrCopy()">📋 Copiar</button></div>`
      : `<p class="empty">No he encontrado dónde se define en este PDF (ni «… (${esc(A)})» ni «${esc(A)} (…)»).</p><div class="row vwpopb"><button data-onclick="vxAcrFind()">🔍 Buscar «${esc(A)}» en el PDF</button></div>`}`;
  lnPlace(pp, R, $('#vw'));
}
function vxAcrFind(q) { const a = VX.acr; vxPopClose('vxAcrPop'); if (!a) return; if (LN.findQ !== norm(q || a.A)) { lnPush(); LN.findQ = norm(q || a.A); } vwFindToggle(true); $('#vwQ').value = q || a.A; vwFind(1); }
function vxAcrGo() { const a = VX.acr; if (!a?.d) return; vxAcrFind(a.d[0].split(' ').slice(0, 6).join(' ')); }
async function vxAcrCopy() { const a = VX.acr; if (!a?.d) return; await clipText(`${a.A}: ${a.d[0]}`, $('#vw')); toast('Copiado.', [], 1200); }
function vxPop(id) { let pp = $('#' + id); if (pp) return pp; pp = document.createElement('div'); pp.id = id; pp.className = 'vwfloat vwpop lnpop'; pp.hidden = true; $('#vw').append(pp); return pp; }
function vxPopClose(id) { const pp = $('#' + id); if (pp) pp.hidden = true; }
document.addEventListener('pointerdown', e => { const pp = $('#vxAcrPop'); if (pp && !pp.hidden && !pp.contains(e.target) && !e.target.closest?.('#vwSel')) pp.hidden = true; }, true);

/* ===== 8 · 📏 Regla de lectura ===== */
const VX_RL_K = 'gp-vw-regla', VX_RL_N = [2, 3, 5];
const vxRl = () => { const o = vxLs(VX_RL_K, {}) || {}; return {on: !!o.on, n: VX_RL_N.includes(o.n) ? o.n : 3, y: o.y > 0 && o.y < 1 ? o.y : .35}; };
function vxRlSet(o) { vxLsPut(VX_RL_K, {...vxRl(), ...o}); vxRlShow(); }
function vxRlN(n) { vxRlSet({n}); }
function vxRlToggle() { const on = !vxRl().on; vxRlSet({on}); toast(on ? '📏 Regla de lectura: sigue al ratón; con el dedo, arrastra su asa ⇕ (tecla M para quitarla).' : 'Regla de lectura quitada.', [], 2600); }
function vxRlShow() {
  const body = $('#vw .vwbody'); if (!body) return; let r = $('#vxRl'); const o = vxRl();
  if (!o.on || !VW.open) { if (r) r.hidden = true; return; }
  if (!r) {
    body.insertAdjacentHTML('beforeend', '<div id="vxRl" class="vxrl" aria-hidden="true"><i class="vxrlt"></i><i class="vxrlb"></i><button class="vxrlg" title="Arrastra para mover la regla">⇕</button></div>'); r = $('#vxRl');
    const g = r.querySelector('.vxrlg');
    g.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { g.setPointerCapture(e.pointerId); } catch (x) {} VX.rlDrag = e.pointerId; });
    g.addEventListener('pointermove', e => { if (VX.rlDrag === e.pointerId) vxRlAt(e.clientY); });
    const up = e => { if (VX.rlDrag === e.pointerId) { VX.rlDrag = null; vxRlSet({y: VX.rlY}); } }; g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    $('#vwScroll').addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons && vxRl().on) vxRlAt(e.clientY); });
    new ResizeObserver(() => vxRlPlace()).observe($('#vwScroll'));
  }
  r.hidden = false; VX.rlY = o.y; vxRlPlace();
}
function vxRlLineH() { const p = VW.pages[VW.cur], L = p && VX.lines.get(p.i); if (!L?.length) { if (p && VW.doc) vxLines(p).then(() => vxRlPlace()).catch(() => {}); return 14; } const h = L.map(l => l.y1 - l.y0).sort((a, b) => a - b); return Math.max(6, Math.min(30, h[h.length >> 1] * 1.25)); }
function vxRlPlace() {
  const r = $('#vxRl'), sc = $('#vwScroll'); if (!r || r.hidden || !sc) return;
  const band = Math.max(18, vxRlLineH() * VW.scale * vxRl().n), H = sc.clientHeight, y = Math.max(0, Math.min(H - band, VX.rlY * H - band / 2));
  Object.assign(r.style, {left: sc.offsetLeft + 'px', top: sc.offsetTop + 'px', width: sc.clientWidth + 'px', height: H + 'px'});
  r.querySelector('.vxrlt').style.height = y + 'px'; Object.assign(r.querySelector('.vxrlb').style, {top: y + band + 'px'}); Object.assign(r.querySelector('.vxrlg').style, {top: y + band / 2 + 'px'});
}
function vxRlAt(cy) { const sc = $('#vwScroll'), R = sc.getBoundingClientRect(); VX.rlY = Math.max(.02, Math.min(.98, (cy - R.top) / Math.max(1, R.height))); vxRlPlace(); }

/* ===== 9 · 📄 Texto adaptado ===== */
const VX_FL_K = 'gp-vw-flow';
const vxFl = () => { const o = vxLs(VX_FL_K, {}) || {}; return {fz: o.fz >= 13 && o.fz <= 34 ? o.fz : 18, serif: o.serif !== false}; };
async function vxParas(i) {   // los párrafos de una página: [{h: título?, t}]
  const p = VW.pages[i]; if (!p) return []; const B = await vxCols(p); if (!B.length) return null;
  const all = B.flatMap(b => b.lines), hs = all.map(l => l.y1 - l.y0).sort((a, b) => a - b), med = hs[hs.length >> 1] || 10, out = [];
  for (const b of B) {
    let cur = null, prev = null;
    for (const l of b.lines) {
      const lh = l.y1 - l.y0;
      if ((l.y0 < p.h * .07 || l.y1 > p.h * .94) && (l.s.length < 70 && /^\W*\d{1,4}\W*$|^\S{0,40}$/.test(l.s) || /^\d+$/.test(l.s))) continue;   // número de página, cabecera corta
      const big = lh > med * 1.3 && l.s.length < 140, gap = prev ? l.y0 - prev.y1 : 0;
      const brk = !cur || big || cur.h || gap > Math.max(lh, prev.y1 - prev.y0) * .75 || prev.x1 < b.x1 - med * 3 && /[.:!?»”"]$/.test(prev.s) || l.x0 > b.x0 + med * .9 && prev.x0 < b.x0 + med * .5;
      if (brk) { cur = {h: big, t: l.s}; out.push(cur); } else cur.t = /-$/.test(cur.t) && /^\p{Ll}/u.test(l.s) ? cur.t.slice(0, -1) + l.s : cur.t + ' ' + l.s;
      prev = l;
    }
  }
  return out;
}
async function vxFlowOpen() {
  if (!VW.open || !VW.pages.length) return; const body = vw$('.vwbody'); let f = $('#vxFlow');
  if (!f) {
    body.insertAdjacentHTML('beforeend', `<div id="vxFlow" class="vxflow" role="region" aria-label="Texto adaptado"><div class="vxflh"><b>📄 Texto adaptado</b><small id="vxFlPg"></small>
      <button data-onclick="vxFlowFz(-1)" title="Letra más pequeña" aria-label="Letra más pequeña">A−</button><button data-onclick="vxFlowFz(1)" title="Letra más grande" aria-label="Letra más grande">A+</button><button data-onclick="vxFlowSerif()" title="Letra con o sin remate" aria-label="Letra con o sin remate">Aa</button><button class="pri" data-onclick="vxFlowClose()" title="Volver al PDF (Esc)">✕ PDF</button></div>
      <div class="vxfls" id="vxFlS" tabindex="0"><article id="vxFlA"></article></div></div>`); f = $('#vxFlow');
    $('#vxFlS').addEventListener('scroll', () => { clearTimeout(VX.flT); VX.flT = setTimeout(vxFlowPg, 80); }, {passive: true});
  }
  VX.fl = {gen: VW.gen, a: VW.cur, b: VW.cur - 1, busy: false}; f.hidden = false; $('#vw').classList.add('vxfl'); vxFlowStyle();
  const A = $('#vxFlA'); A.innerHTML = VW.cur > 0 ? `<button class="vxflprev" data-onclick="vxFlowPrev()">↑ Página ${VW.cur}</button>` : '';
  VX.flIo?.disconnect(); VX.flIo = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) vxFlowMore(); }, {root: $('#vxFlS'), rootMargin: '900px 0px'});
  A.insertAdjacentHTML('beforeend', '<div class="vxflend"></div>'); VX.flIo.observe(A.querySelector('.vxflend'));
  await vxFlowMore(); $('#vxFlS').scrollTop = 0; $('#vxFlS').focus(); vxFlowPg();
}
async function vxFlowSec(i) {
  const P = await vxParas(i).catch(() => []);
  return `<section class="vxflp" data-i="${i}"><div class="vxflpn">— p. ${i + 1} —</div>${P === null || !P.length ? `<p class="vxflno">Esta página no tiene texto${P === null ? ' (¿es un escaneado? Prueba ⋯ → 🔠 Reconocer el texto)' : ''}.</p>` : P.map(x => x.h ? `<h3>${esc(x.t)}</h3>` : `<p>${esc(x.t)}</p>`).join('')}</section>`;
}
async function vxFlowMore() {
  const F = VX.fl; if (!F || F.busy || F.gen !== VW.gen || $('#vxFlow')?.hidden) return; F.busy = true;
  try {
    const A = $('#vxFlA'), end = A.querySelector('.vxflend');
    for (let k = 0; k < 3 && F.b + 1 < VW.pages.length; k++) { F.b++; end.insertAdjacentHTML('beforebegin', await vxFlowSec(F.b)); if (F.gen !== VW.gen) return; }
    if (F.b + 1 >= VW.pages.length) end.innerHTML = '<p class="vxflno">— Final del PDF —</p>';
  } finally { F.busy = false; }
  const s = $('#vxFlS'); if (s && s.scrollHeight <= s.clientHeight + 200 && F.b + 1 < VW.pages.length) vxFlowMore();
}
async function vxFlowPrev() {
  const F = VX.fl; if (!F || F.a <= 0) return; const s = $('#vxFlS'), A = $('#vxFlA'), h0 = s.scrollHeight; F.a--;
  A.querySelector('.vxflprev').insertAdjacentHTML('afterend', await vxFlowSec(F.a)); if (F.a <= 0) A.querySelector('.vxflprev').remove(); else A.querySelector('.vxflprev').textContent = `↑ Página ${F.a}`;
  s.scrollTop += s.scrollHeight - h0 - s.clientHeight * .6;
}
function vxFlowPg() { const s = $('#vxFlS'); if (!s) return; const top = s.getBoundingClientRect().top + 20; let i = VX.fl?.a ?? 0; for (const x of s.querySelectorAll('.vxflp')) { if (x.getBoundingClientRect().top <= top) i = +x.dataset.i; else break; } VX.flCur = i; $('#vxFlPg').textContent = `p. ${i + 1} de ${VW.pages.length}`; }
function vxFlowClose() { const f = $('#vxFlow'); if (!f || f.hidden) return; f.hidden = true; $('#vw').classList.remove('vxfl'); VX.flIo?.disconnect(); if (VX.flCur != null && VX.flCur !== VW.cur) vwGo(VX.flCur, true); }
const vxFlowShown = () => { const f = $('#vxFlow'); return !!(f && !f.hidden); };
function vxFlowToggle() { vxFlowShown() ? vxFlowClose() : vxFlowOpen(); }
function vxFlowStyle() { const o = vxFl(), a = $('#vxFlA'); if (!a) return; a.style.fontSize = o.fz + 'px'; a.classList.toggle('serif', o.serif); }
function vxFlowFz(d) { const o = vxFl(); vxLsPut(VX_FL_K, {...o, fz: Math.max(13, Math.min(34, o.fz + d * 2))}); vxFlowStyle(); }
function vxFlowSerif() { const o = vxFl(); vxLsPut(VX_FL_K, {...o, serif: !o.serif}); vxFlowStyle(); }

/* ===== 10 · 🔠 Reconocer el texto (OCR), en el dispositivo ===== */
const VX_OCR_LIB = 'lib/tesseract/';
const vxOcrUrl = f => new URL(VX_OCR_LIB + f, document.baseURI).href;
function vxScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(Error('No se pudo cargar ' + src)); document.head.append(s); }); }
async function vxOcrWorker(log) {
  if (VX.ocrW) return VX.ocrW;
  return VX.ocrWP ??= (async () => {
    if (!window.Tesseract) await vxScript(vxOcrUrl('tesseract.min.js'));
    const w = await Tesseract.createWorker(['spa', 'eng'], 1, {workerPath: vxOcrUrl('worker.min.js'), corePath: vxOcrUrl('').replace(/\/$/, ''), langPath: vxOcrUrl('lang'), gzip: true, workerBlobURL: false, cacheMethod: 'none', logger: m => VX.ocrLog?.(m)});
    VX.ocrW = w; return w;
  })().catch(e => { VX.ocrWP = null; throw e; });
}
const vxOcrKey = () => VW.src ? 'pdfocr:' + vwSrcKey(VW.src) : '';
async function vxOcrLoad(gen) {   // al abrir: lo reconocido otra vez (si es el mismo archivo)
  const k = vxOcrKey(); if (!k || !VW.file) return; const r = await idb('readonly', st => st.get(k)).catch(() => null); if (gen !== VW.gen || !r || r.size !== VW.file.size || r.n !== VW.pages.length) return;
  vxReset(); for (const [i, w] of Object.entries(r.pages || {})) { VX.ocr.set(+i, w); const p = VW.pages[+i]; if (p) vxOcrLayer(p); }
}
async function vxOcrSave() {
  const k = vxOcrKey(); if (!k || !VW.file) return; const pages = Object.fromEntries(VX.ocr);
  await idb('readwrite', st => st.put({v: 1, size: VW.file.size, n: VW.pages.length, pages}, k)).catch(() => {});
  if (VW.src.kind === 'paper') {   // también para buscar desde la lista (texto:palabra)
    const key = pdfKey(VW.src.id, VW.src.n), name = vwHolders()[0]?.name; if (!name) return;
    const r = await idb('readonly', st => st.get('pdftx:' + key)).catch(() => null), T = r?.name === name && Array.isArray(r.pages) ? [...r.pages] : [];
    for (let i = 0; i < VW.pages.length; i++) { const w = VX.ocr.get(i); if (w && !String(T[i] || '').trim()) T[i] = w.map(x => x.t).join(' '); else T[i] ??= ''; }
    await txPut(key, name, T);
  }
}
function vxOcrLayer(p) {   // las palabras reconocidas como texto transparente encima de la página (para seleccionar, subrayar y buscar)
  const W = VX.ocr.get(p.i); if (!W || !p.el || !vwVp(p)) return; p.el.querySelector('.vxocr')?.remove();
  const c = document.createElement('canvas').getContext('2d');
  const sp = W.map(w => { const b = vwBoxes(p, w.q)[0]; if (!b) return ''; const h = Math.max(4, b.h); c.font = `${h}px sans-serif`; const mw = c.measureText(w.t).width || 1, k = Math.max(.2, Math.min(5, b.w / mw));
    return `<span style="left:${vwPx(b.x)};top:${vwPx(b.y)};font-size:calc(var(--scale-factor) * ${h.toFixed(2)}px);font-family:sans-serif;transform:scaleX(${k.toFixed(3)})">${esc(w.t)} </span>`; }).join('');
  p.el.querySelector('.vwa').insertAdjacentHTML('beforebegin', `<div class="textLayer vxocr">${sp}</div>`);
}
function vxOcrItems(p) {   // las palabras reconocidas como «trozos de texto» de PDF.js (para buscar y marcar los resultados)
  const W = VX.ocr.get(p.i); if (!W) return null;
  return W.map(w => { const [x1, y1, x2, y2] = w.q, h = (y2 - y1) / 1.05; return {str: w.t, transform: [h, 0, 0, h, x1, y1 + h * .2], width: x2 - x1, hasEOL: !!w.eol}; });
}
async function vxOcrPage(i, wk) {
  const p = VW.pages[i]; p.proxy ||= await VW.doc.getPage(i + 1); const v = vwVp(p), s = Math.min(4, 2200 / Math.max(v.width, v.height) * 1.4);
  const cv = document.createElement('canvas'), vp = vwGV(p, {scale: s}); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  await p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp}).promise;
  const {data} = await wk.recognize(cv, {}, {blocks: true, text: true}); cv.width = cv.height = 0; const out = [];
  for (const b of data.blocks || []) for (const pa of b.paragraphs || []) for (const ln of pa.lines || []) { const ws = (ln.words || []).filter(w => w.text?.trim() && w.confidence > 20);
    ws.forEach((w, j) => { const a = v.convertToPdfPoint(w.bbox.x0 / s, w.bbox.y0 / s), b = v.convertToPdfPoint(w.bbox.x1 / s, w.bbox.y1 / s), r = n => Math.round(n * 10) / 10;
      out.push({t: w.text.trim(), q: [r(Math.min(a[0], b[0])), r(Math.min(a[1], b[1])), r(Math.max(a[0], b[0])), r(Math.max(a[1], b[1]))], ...(j === ws.length - 1 ? {eol: 1} : {})}); }); }
  return out;
}
async function vxOcrRun(which) {   // which: número de página o 'all' (las que no tienen texto)
  if (VX.ocrBusy) return toast('Ya estoy reconociendo el texto.', [], 1800); if (!VW.doc) return;
  const gen = VW.gen; VX.ocrBusy = true; VX.ocrStop = false; let done = 0, skip = 0;
  const bar = m => toast(m, [{t: '✕ Parar', fn: () => { VX.ocrStop = true; }}], 0);
  try {
    VX.ocrLog = m => { if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') bar(`Preparando el reconocimiento (la primera vez descarga unos 9 MB)… ${Math.round((m.progress || 0) * 100)} %`); };
    bar('Preparando el reconocimiento…'); const wk = await vxOcrWorker(); VX.ocrLog = null;
    const L = which === 'all' ? VW.pages.map(p => p.i) : [which];
    for (const i of L) {
      if (gen !== VW.gen || VX.ocrStop) break;
      if (which === 'all') { const p = VW.pages[i]; if (VX.ocr.has(i) || (await vxLines(p)).length) { skip++; continue; } }
      bar(`Reconociendo el texto de la página ${i + 1}${L.length > 1 ? ` (${L.indexOf(i) + 1} de ${L.length})` : ''}…`);
      const w = await vxOcrPage(i, wk); if (gen !== VW.gen) break;
      VX.ocr.set(i, w); VX.lines.delete(i); VX.cols.delete(i); VX.raw.delete(i); VX.figs = null; VW.find.txt.delete(i); vxOcrLayer(VW.pages[i]); done++;
    }
    if (gen === VW.gen && done) await vxOcrSave();
    if (gen !== VW.gen) { const t = $('#toast'); if (t) t.hidden = true; return; }   // visor cerrado o cambiado: solo quita la barra de progreso
    toast(done ? `Texto reconocido en ${done} ${done === 1 ? 'página' : 'páginas'}. Ya se puede seleccionar, subrayar y buscar.` : which === 'all' ? 'Todas las páginas ya tenían texto.' : 'No he reconocido texto en esta página.', [], 4000);
  } catch (e) { console.error(e); toast('No se pudo reconocer el texto: ' + (e.message || e), [], 5000); }
  finally { VX.ocrBusy = false; VX.ocrLog = null; if (!VW.open) { VX.ocrW?.terminate?.(); VX.ocrW = VX.ocrWP = null; } }
}
function vxOcrMenu() {
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwMoreBack()">‹ Volver</button><hr><div class="ctxh">🔠 Reconocer el texto (OCR)</div>
    <button data-onclick="vxOcrRun(${VW.cur})">📄 Esta página (${VW.cur + 1})${VX.ocr.has(VW.cur) ? ' <small class="vwsub">otra vez</small>' : ''}</button><button data-onclick="vxOcrRun('all')">📚 Todas las páginas sin texto</button>
    ${VX.ocr.size ? `<button data-onclick="vxOcrForget()">🗑 Olvidar lo reconocido (${VX.ocr.size} ${VX.ocr.size === 1 ? 'página' : 'páginas'})</button>` : ''}
    <div class="vwhint">Para PDF escaneados (fotos de páginas): saca el texto para poder seleccionarlo, subrayarlo y buscarlo. Se hace en este dispositivo, sin enviar nada; la primera vez descarga unos 9 MB (español e inglés). Se guarda en este navegador.</div>`);
}
async function vxOcrForget() {
  const k = vxOcrKey(); for (const i of VX.ocr.keys()) { VW.pages[i]?.el?.querySelector('.vxocr')?.remove(); VW.find.txt.delete(i); VX.lines.delete(i); VX.cols.delete(i); VX.raw.delete(i); }
  VX.ocr.clear(); VX.figs = null; if (k) await idb('readwrite', st => st.delete(k)).catch(() => {}); toast('Texto reconocido olvidado.', [], 2000);
}

/* ===== 11 · 🃏 Anki ===== */
function vxAnkiTxt(P, L, ep) {
  const one = s => esc(String(s || '').replace(/\t/g, ' ').trim()).replace(/\r?\n/g, '<br>'), tag = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const ttl = P ? shortTxt(P.alias || P.title || '') : vwTitle(), key = tag(P?.key || (P?.authors?.[0] ? String(P.authors[0]).split(',')[0] + (P.year || '') : ''));
  const rows = annSorted(L).filter(a => a.t || a.m).map(a => {
    const ref = P ? annCite(P, a.p + 1, ep) : `(${ep ? 'cap.' : 'p.'} ${a.p + 1})`, front = a.t ? one(a.t) : one(a.m);
    const back = [a.t && a.m ? one(a.m) : '', `<small>${esc(ttl)} ${esc(ref)}</small>`].filter(Boolean).join('<br><br>');
    return [front, back, ['gpapers', key, tag(annColName(a.c))].filter(Boolean).join(' ')].join('\t');
  });
  return rows.length ? `#separator:tab\n#html:true\n#tags column:3\n${rows.join('\n')}\n` : '';
}
function vxAnki() {
  const {L} = vwExpList(), t = vxAnkiTxt(vwPaper(), L, false); if (!t) return toast('No hay subrayados con texto ni comentarios que pasar a Anki.', [], 3000);
  download(t, (vwTitle().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || 'anotaciones') + ' - Anki.txt', 'text/plain');
  toast(`${t.split('\n').length - 4} tarjetas para Anki. En Anki: Archivo → Importar y elige el archivo.`, [], 4500);
}

/* ===== 12 · ≠ Diferencias entre el PDF 1 y el PDF 2 ===== */
const vxNormS = s => norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
async function vxSents(doc, i, v) {   // frases de una página con sus rectángulos (en puntos de la página como se ve, escala 1)
  const pg = await doc.getPage(i + 1), vp = v || pg.getViewport({scale: 1}), tc = await pg.getTextContent(), it = []; let s = '', last = null;
  for (const x of tc.items) { if (typeof x.str !== 'string') continue;
    if (x.str.trim() && x.transform) { const h = Math.hypot(x.transform[2], x.transform[3]) || 10;   // un salto grande o otra letra (título, autores): otro trozo, aunque no acabe en punto
      if (last && (Math.abs(x.transform[5] - last.y) > Math.max(h, last.h) * 1.7 || Math.abs(h - last.h) > last.h * .2)) s += '\n\n'; last = {y: x.transform[5], h}; }
    if (x.str) { it.push({a: s.length, b: s.length + x.str.length, x}); s += x.str; } if (x.hasEOL) s += x.str.endsWith('-') ? '' : ' '; }
  return saySplit(s).map(([a, b]) => { const B = [];
    for (const o of it) { if (o.b <= a || o.a >= b) continue; const [, , c, d, e, f] = o.x.transform, w = o.x.width, h = Math.hypot(c, d) || o.x.height || 10, n = o.b - o.a, f0 = Math.max(0, a - o.a) / n, f1 = Math.min(n, b - o.a) / n;
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle([e + w * f0, f - h * .25, e + w * f1, f + h * .95]); B.push({x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)}); }
    const nn = vxNormS(s.slice(a, b)); return {p: i, t: s.slice(a, b), n: nn, k: nn.replace(/ /g, ''), B, W: vp.width, H: vp.height}; }).filter(x => x.n.split(' ').length >= 3);
}
function vxDiffMark(A, B) {   // las frases de A que no están en B. Se comparan sin espacios ni signos: un corte de línea o un guion no cuentan como cambio, una palabra sí
  const cnt = new Map(); for (const x of B) cnt.set(x.k, (cnt.get(x.k) || 0) + 1);
  return A.filter(x => { const c = cnt.get(x.k) || 0; if (c > 0) { cnt.set(x.k, c - 1); return false; } return true; });
}
async function vxDiff() {
  if (!P2.doc || !VW.doc) return; vxDiffClear(); const g = P2.gen, gen = VW.gen, A = [], B = [], bar = $('#lnP2 .lnp2h');
  const st = t => { let e = $('#vxDf'); if (!e) { bar.insertAdjacentHTML('afterend', '<div id="vxDf" class="vxdf"></div>'); e = $('#vxDf'); } e.innerHTML = t; };
  try {
    const nA = VW.pages.length, nB = P2.doc.numPages;
    for (let i = 0; i < nA; i++) { if (g !== P2.gen || gen !== VW.gen) return; const p = VW.pages[i]; p.proxy ||= await VW.doc.getPage(i + 1); A.push(...await vxSents(VW.doc, i, vwVp(p))); if (i % 5 === 4) { st(`Comparando… PDF ${VW.src.n || 1}: p. ${i + 1} de ${nA}`); await vxSleep(); } }
    for (let i = 0; i < nB; i++) { if (g !== P2.gen) return; B.push(...await vxSents(P2.doc, i)); if (i % 5 === 4) { st(`Comparando… PDF ${P2.n}: p. ${i + 1} de ${nB}`); await vxSleep(); } }
    if (!A.length || !B.length) return st(`<span>Uno de los dos PDF no tiene texto que comparar (¿escaneado?).</span><button data-onclick="vxDiffClear()" aria-label="Cerrar">✕</button>`);
    const dA = vxDiffMark(A, B), dB = vxDiffMark(B, A); VX.diff = {dA, dB, k: -1, g};
    for (const x of dA) { const p = VW.pages[x.p]; if (p?.el) p.el.querySelector('.vwa').insertAdjacentHTML('beforebegin', x.B.map(b => `<i class="vxdif" style="left:${vwPx(b.x)};top:${vwPx(b.y)};width:${vwPx(b.w)};height:${vwPx(b.h)}"></i>`).join('')); }
    for (const x of dB) { const q = P2.pgs[x.p]; if (q?.el) q.el.insertAdjacentHTML('beforeend', x.B.map(b => `<i class="vxdif" style="left:${(b.x / x.W * 100).toFixed(3)}%;top:${(b.y / x.H * 100).toFixed(3)}%;width:${(b.w / x.W * 100).toFixed(3)}%;height:${(b.h / x.H * 100).toFixed(3)}%"></i>`).join('')); }
    st(dA.length || dB.length ? `<b>≠</b><span>${dA.length} ${dA.length === 1 ? 'frase' : 'frases'} solo en el PDF ${VW.src.n || 1} · ${dB.length} solo en el PDF ${P2.n}</span>${dA.length ? '<small class="vxdfk"></small><button data-onclick="vxDiffStep(-1)" title="Diferencia anterior" aria-label="Diferencia anterior">‹</button><button data-onclick="vxDiffStep(1)" title="Diferencia siguiente" aria-label="Diferencia siguiente">›</button>' : ''}<button data-onclick="vxDiffClear()" title="Quitar las marcas" aria-label="Quitar las marcas">✕</button>`
      : `<span>✓ Los dos PDF dicen lo mismo (frase a frase).</span><button data-onclick="vxDiffClear()" aria-label="Cerrar">✕</button>`);
  } catch (e) { st(`<span>No se pudieron comparar: ${esc(e.message || '')}</span><button data-onclick="vxDiffClear()" aria-label="Cerrar">✕</button>`); }
}
function vxDiffStep(d) {   // a la diferencia anterior o siguiente (en el PDF de la izquierda; el de al lado va a su diferencia más cercana)
  const G = VX.diff; if (!G?.dA.length) return; G.k = (G.k + d + G.dA.length) % G.dA.length; const x = G.dA[G.k];
  vxShowH(x.p, Math.max(0, (x.B[0]?.y || 0) - 30));
  const s2 = $('#lnP2s'), m = G.dB.find(y => y.p >= x.p) || G.dB.at(-1), el = m && P2.pgs[m.p]?.el; if (s2 && el) s2.scrollTop = el.offsetTop + (m.B[0]?.y || 0) / m.H * el.offsetHeight - 40;
  const c = $('#vxDf .vxdfk'); if (c) c.textContent = `${G.k + 1} de ${G.dA.length}`;
}
function vxDiffClear() { VX.diff = null; document.querySelectorAll('#vw .vxdif').forEach(e => e.remove()); $('#vxDf')?.remove(); }

/* ---- Al abrir un PDF y en los menús ---- */
function vxOnOpen(gen) {
  vxReset(); VW.col = vxColWant(); $('#vw').classList.toggle('vxcol', !!VW.col); if (VW.col && !VW.flip) { VW.flip = true; VW.two = false; vwRdClass(); vwFlipShow(); }
  vxMapDraw(); vxRlShow(); vxOcrLoad(gen); vxFlowClose();
  if (VW.col) setTimeout(() => { if (gen === VW.gen && VW.col) vxColGo(VW.cur, 0); }, 250);
}
const vxReadBtns = () => `<hr><div class="ctxh">Leer mejor</div>
  ${VW.flip || VW.col ? `<button data-onclick="vxColSet(${VW.col ? 0 : 1})" title="En un PDF a dos columnas, cada toque enseña la columna siguiente ampliada (en una sola columna, el bloque de texto sin márgenes)">${tick(VW.col)}▥ Columna a columna</button>` : `<button data-onclick="vxColSet(1)" title="Página a página, enseñando cada columna ampliada">${tick(false)}▥ Columna a columna</button>`}
  <button data-keep data-onclick="vxRlToggle();vwReadMenu()" title="Oscurece todo menos unas líneas (tecla M)">${tick(vxRl().on)}📏 Regla de lectura <small class="vwsub">M</small></button>
  ${vxRl().on ? `<div class="epmrow">${VX_RL_N.map((n, k) => `<button data-keep class="${vxRl().n === n ? 'on' : ''}" data-onclick="vxRlN(${n});vwReadMenu()">${['Fina', 'Media', 'Ancha'][k]}</button>`).join('')}</div>` : ''}
  <button data-onclick="vxFlowToggle()" title="El texto en párrafos que se ajustan a la pantalla, con su tamaño de letra (tecla T)">${tick(vxFlowShown())}📄 Texto adaptado a la pantalla <small class="vwsub">T</small></button>`;
Object.assign(VW_KEYS, {m: ['Regla de lectura (sí o no)', () => vxRlToggle()], t: ['Texto adaptado a la pantalla (sí o no)', () => vxFlowToggle()]});
VW_TABS.push(['fig', '🖼 Figuras']);
