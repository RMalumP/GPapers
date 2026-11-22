'use strict';
/* ===== Visor de PDF (3 de 4): menú ⋯, notas del paper al lado del PDF, el PDF anotado, el visor en otra pestaña, zoom nítido en el móvil,
   botón «atrás» del móvil y pantalla completa. ===== */
/* ---- Más: descargar, ficha del paper, abrir con el navegador, dónde se guarda ---- */
function vwMore(e) {
  e.stopPropagation(); const r = VW.menuR = e.currentTarget.getBoundingClientRect(), paper = vwPaper(), P = paper && db.papers.find(p => p.id === paper.id), pf = vwHolders()[0];
  vwMenu(r, `<button data-keep data-onclick="vwReadMenu()">📖 Modo de lectura <small class="vwsub">${esc(vwRdSum())} ›</small></button><button data-keep data-onclick="vwBmMenu()">🔖 Marcadores <small class="vwsub">${vwBms().length || 'ninguno'} ›</small></button><button data-keep data-onclick="vwCfgMenu()">⚙ Ajustes del visor <small class="vwsub">›</small></button><hr><button data-onclick="lnInkMode()" title="Dibujar o escribir a mano sobre la página (con el dedo, el lápiz o el ratón)">${tick(VW.mode === 'ink')}✏ Lápiz</button>${p2MenuBtn()}<button data-keep data-onclick="vxOcrMenu()" title="Para PDF escaneados: sacar el texto de las páginas, sin internet">🔠 Reconocer el texto (OCR) <small class="vwsub">${VX.ocr.size ? VX.ocr.size + ' p. ' : ''}›</small></button><hr><button data-onclick="vwOut()">⬇ Descargar el PDF con las anotaciones</button>${vwAnns().length ? '<button data-onclick="vwMd()">⬇ Resumen de subrayados y comentarios (.md)</button>' : ''}
    ${vwCanShare() ? `<button data-onclick="vwOther(false)">📲 Abrir en otra app…</button>${vwAnns().length ? '<button data-onclick="vwOther(true)">📲 Abrir en otra app, con las anotaciones…</button>' : ''}` : ''}
    <button data-onclick="vwNative()">↗ Abrir con el visor del navegador</button>${vwAnns().length && !vwCanShare() ? '<button data-onclick="vwOther(true)">↗ Abrir con el visor del navegador, con las anotaciones</button>' : ''}
    ${P && !$('#dlg').open ? '<button data-onclick="vwFicha()">📝 Ficha del paper</button>' : ''}${VW.src?.kind === 'inbox' ? '<button data-onclick="vwCite()">＋ Crear la cita de este PDF</button>' : ''}
    <hr><button data-onclick="cmdOpen(true)">🔎 Buscar una orden… <small class="vwsub">${esc(db.settings.shortcuts.palette || '')}</small></button>
`);
}
const menuAnchor = sel => { const r = $(sel)?.getBoundingClientRect(); return r && r.width ? {right: r.right, bottom: r.bottom} : {right: innerWidth - 8, bottom: 52}; };   // dónde sale un menú del visor si no hay botón que lo abra
function vwMenu(r, html) {   // menú desplegable dentro del visor (el de la aplicación queda debajo del visor)
  let m = $('#vwMenu'); if (!m) { m = document.createElement('div'); m.id = 'vwMenu'; m.className = 'vwfloat vwmenu'; $('#vw').append(m); m.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && !b.hasAttribute('data-keep')) setTimeout(() => m.hidden = true); }); }   // data-keep: abre un submenú
  r ||= VW.menuR = menuAnchor('#vwMoreB');   // v40.7: abierto desde Ctrl+K (sin pasar por ⋯), debajo de ⋯ y no en la esquina
  m.innerHTML = html; m.hidden = false; const w = m.offsetWidth; m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; m.style.top = (r.bottom + 4) + 'px';
  m.style.maxHeight = `calc(100dvh - ${Math.round(r.bottom + 12)}px)`; m.style.overflow = 'auto';   // los menús largos (⚙ Ajustes) se desplazan
  setTimeout(() => document.addEventListener('pointerdown', ev => { if (!m.contains(ev.target)) m.hidden = true; }, {once: true, capture: true}));
}
/* ---- Notas del paper al lado del PDF: el mismo editor de la ficha (#dlg), metido en el visor como panel.
   Ordenador y tablet: la mitad derecha (el PDF sigue a la izquierda y se puede leer y subrayar). Móvil: pantalla completa, con «📄 Ver el PDF» para ir y volver sin perder lo escrito. */
const vwDocked = () => $('#dlg').open && $('#dlg').classList.contains('vwdock');
function vwNotes() {
  const d = $('#dlg');
  if (vwDocked()) { if (d.classList.contains('vwhide')) { d.classList.remove('vwhide'); return d.querySelector('.ned')?.focus(); } return vwSplitOk() ? vwNotesClose() : vwNotesHide(); }
  const p = vwPaper(); if (!p || d.open) return; if (P2.doc) p2Close(true);
  VW.dlgNext = d.nextSibling; d.classList.add('vwdock'); vw$('.vwbody').insertBefore(d, $('#vwSide'));
  vw$('.vwbody').insertBefore(vwSplitEl(), d); vwSplitSet(vwSplitGet()); $('#vw').classList.add('vwdk'); vwSplitMode();
  if (VW.side && (vwMv() || innerWidth < 1500)) { VW.side = false; vwSideShow(); }   // sin el panel de anotaciones: el PDF necesita su mitad
  vw$('.vwnb').classList.add('on'); openPaper(p.id, true);
}
/* ¿Se parte la pantalla? Sí si el lado corto de la pantalla es de unos 600 px CSS o más (≈ 7″ o más: tablets) y la ventana no es estrecha;
   en un teléfono, no: las notas ocupan la pantalla. Con la pantalla en vertical, el PDF va arriba y las notas abajo. */
const vwSplitOk = () => Math.min(screen.width, screen.height) >= 600 && innerWidth >= 560;
function vwSplitMode() { const v = $('#vw'); if (!v) return; v.classList.toggle('vwsp', vwSplitOk()); v.classList.toggle('vwcol', innerHeight > innerWidth); if (vwSplitOk()) $('#dlg').classList.remove('vwhide'); }
window.addEventListener('resize', () => { if (vwDocked()) vwSplitMode(); });
/* divisor entre el PDF y las notas: se arrastra para repartir el espacio (en horizontal, el ancho; en una tablet en vertical, el alto). Doble clic: mitad y mitad */
const vwSplitGet = () => { try { const v = +localStorage.getItem('gp-vw-split'); return v >= 20 && v <= 80 ? v : 50; } catch (e) { return 50; } };
function vwSplitSet(v, save) { v = Math.round(Math.max(20, Math.min(80, v)) * 10) / 10; $('#vw').style.setProperty('--vwn', v); if (save) try { localStorage.setItem('gp-vw-split', v); } catch (e) {} return v; }
const vwSplitCol = () => getComputedStyle(vw$('.vwbody')).flexDirection === 'column';
function vwSplitEl() {
  let s = $('#vwSplit'); if (s) return s;
  s = document.createElement('div'); s.id = 'vwSplit'; s.className = 'vwsplit'; s.setAttribute('role', 'separator'); s.tabIndex = 0; s.title = 'Arrastra para cambiar el tamaño del PDF y de las notas · Doble clic: mitad y mitad';
  s.addEventListener('pointerdown', e => {
    e.preventDefault(); s.setPointerCapture(e.pointerId); s.classList.add('on'); const col = vwSplitCol(), r = vw$('.vwbody').getBoundingClientRect();
    const mv = ev => vwSplitSet(col ? (r.bottom - ev.clientY) / r.height * 100 : (r.right - ev.clientX) / r.width * 100);
    const up = ev => { s.classList.remove('on'); s.removeEventListener('pointermove', mv); s.removeEventListener('pointerup', up); s.removeEventListener('pointercancel', up); vwSplitSet(+$('#vw').style.getPropertyValue('--vwn') || 50, true); };
    s.addEventListener('pointermove', mv); s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
  });
  s.addEventListener('dblclick', () => vwSplitSet(50, true));
  s.addEventListener('keydown', e => { const k = {ArrowLeft: 2, ArrowUp: 2, ArrowRight: -2, ArrowDown: -2}[e.key]; if (!k) return; e.preventDefault(); vwSplitSet((+$('#vw').style.getPropertyValue('--vwn') || 50) + k, true); });   // con el teclado: más o menos notas
  return s;
}
function vwNotesHide() { $('#dlg').classList.add('vwhide'); }
function vwNotesClose(force) { if (!vwDocked()) return; commit(); if (force && vwDocked()) $('#dlg').close(); }   // se guarda al cerrar (como al pulsar fuera de la ficha); si falta el título, avisa y sigue abierto
function vwUndock() {
  const d = $('#dlg'); if (!d.classList.contains('vwdock')) return;
  d.classList.remove('vwdock', 'vwhide'); document.body.insertBefore(d, VW.dlgNext?.parentNode === document.body ? VW.dlgNext : null); vw$('.vwnb')?.classList.remove('on');
  $('#vwSplit')?.remove(); $('#vw')?.classList.remove('vwdk');
}
$('#dlg').addEventListener('close', vwUndock);
$('#dlg').addEventListener('keydown', e => {   // Esc en las notas del visor: guarda y cierra el panel (el navegador no se lo pasa al visor); con un menú abierto, solo cierra el menú
  if (e.key !== 'Escape' || !vwDocked() || e.defaultPrevented || ($('#ctx') && !$('#ctx').hidden)) return; e.preventDefault(); e.stopPropagation(); vwNotesClose(); });
function vwFicha() { const p = vwPaper(); if (p) openPaper(p.id); }
function vwCite() { const s = VW.src; vwClose(); setTimeout(() => inboxCite(s.id), 50); }
function vwVis() {
  const pf = vwHolders()[0]; if (!pf) return; const on = !pdfVisOf(pf);
  vwHolders().forEach(h => { if (on === !!db.settings.pdfVis) delete h.vis; else h.vis = on ? 'si' : 'no'; }); const P = vwPaper(); if (P) P.modified = vwNow(); markDirty();
  vwSatPush(); if (on) pdfVisAsk(); toast(on ? 'Se guardará una copia con los subrayados en la carpeta «GPapers» de tu Drive.' : 'Este PDF ya no se copiará a tu Drive normal (la copia que ya esté allí no se borra).', [], 4500);
}
function vwMd() {   // resumen en Markdown
  const L = [...vwAnns()].sort((a, b) => a.p - b.p || vwTop(a) - vwTop(b)), name = new Proxy({}, {get: (_, c) => annColName(c)});
  const p = vwPaper(), head = p ? `# ${vwTitle()}\n\n${p.authors?.length ? p.authors.join('; ') + (p.year ? ` (${p.year})` : '') + '\n\n' : ''}` : `# ${vwTitle()}\n\n`;
  const md = head + L.map(a => `- **p. ${a.p + 1}** · ${a.k === 'note' ? 'Nota' : a.k === 'area' ? 'Zona' : a.k === 'ink' ? 'Trazo a mano' : 'Subrayado'} (${name[a.c] || a.c})${a.t ? `\n  > ${a.t.replace(/\n/g, ' ')}` : ''}${a.m ? `\n  ${a.m.replace(/\n/g, '\n  ')}` : ''}`).join('\n') + '\n';
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
    } else if (a.k === 'ink') {   // v39.53: trazos a mano
      const [l, b, r, t] = a.q, wd = LN_INK_W; rect = [l - wd, b - wd, r + wd, t + wd];
      const ap = ctx.register(ctx.stream([`${C.map(f3).join(' ')} RG ${f3(wd)} w 1 J 1 j`, ...a.g.map(s => s.map((v, j) => j % 2 ? `${f3(v)} ${j === 1 ? 'm' : 'l'}` : f3(v)).join(' ') + ' S')].join('\n'), {Type: 'XObject', Subtype: 'Form', BBox: rect}));
      dict = {...base, Subtype: 'Ink', Rect: rect, InkList: a.g, BS: {W: wd, S: N('S')}, Subj: T('Trazo a mano'), AP: {N: ap}, ...(a.m ? {Contents: T(a.m)} : {})};
    } else {
      const q = [], ops = ['/GS0 gs', `${C.map(f3).join(' ')} rg`]; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let k = 0; k + 3 < a.q.length; k += 4) { const [l, b, r, t] = a.q.slice(k, k + 4); q.push(l, t, r, t, l, b, r, b); ops.push(`${f3(l)} ${f3(b)} ${f3(r - l)} ${f3(t - b)} re f`); x1 = Math.min(x1, l); y1 = Math.min(y1, b); x2 = Math.max(x2, r); y2 = Math.max(y2, t); }
      rect = [x1, y1, x2, y2];
      if (a.k === 'hl' && (a.s === 'u' || a.s === 'x')) {   // v39.52: línea debajo o tachado
        const ln = [`${C.map(f3).join(' ')} RG`]; for (let k = 0; k + 3 < a.q.length; k += 4) { const [l, b, r, t] = a.q.slice(k, k + 4), h = t - b, y = a.s === 'u' ? b + h * .08 : b + h * .45; ln.push(`${f3(Math.max(.6, h * .07))} w ${f3(l)} ${f3(y)} m ${f3(r)} ${f3(y)} l S`); }
        const ap = ctx.register(ctx.stream(ln.join('\n'), {Type: 'XObject', Subtype: 'Form', BBox: rect}));
        dict = {...base, Subtype: a.s === 'u' ? 'Underline' : 'StrikeOut', Rect: rect, QuadPoints: q, Subj: T(a.s === 'u' ? 'Subrayado' : 'Tachado'), AP: {N: ap}, ...(a.m ? {Contents: T(a.m)} : {})};
      } else {
      const ap = ctx.register(ctx.stream(ops.join('\n'), {Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: {ExtGState: {GS0: {Type: 'ExtGState', CA: 1, ca: 1, BM: 'Multiply'}}}}));
      dict = {...base, Subtype: 'Highlight', Rect: rect, QuadPoints: q, CA: 1, Subj: T(a.k === 'area' ? 'Zona' : 'Resaltado'), AP: {N: ap}, ...(a.m ? {Contents: T(a.m)} : {})};
      }
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
const vwPart = h => ({ann: h.ann || [], vis: h.vis || '', page: h.page || 0, bm: h.bm || []});
function vwApplyPart(src, x) {   // pone en el PDF (en todos sus sitios) las anotaciones que llegan de la otra pestaña
  const hs = vwHoldersOf(src); if (!hs.length || JSON.stringify(vwPart(hs[0])) === JSON.stringify(x)) return false;
  for (const h of hs) { if (x.ann.length) h.ann = structuredClone(x.ann); else delete h.ann; if (x.vis) h.vis = x.vis; else delete h.vis; if (x.page) h.page = x.page; else delete h.page; if (x.bm?.length) h.bm = [...x.bm]; else delete h.bm; }
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
  if (isEpub(file?.name)) return epOpen(src, file);   // EPUB: su propio lector, siempre dentro de la aplicación (también desde file://)
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
    else if (m.t === 'state' && m.pj === PJ.cur && VW.open) { const it = m.items.find(x => vwSrcEq(x.src, VW.src)); if (it && vwApplyPart(VW.src, it.pf)) { vwDrawAnn(); vwBmDraw(); if (VW.pop && !vwAnns().some(a => a.id === VW.pop)) vwPopClose(); if (VW.side) vwSideDraw(); vwCount(); } }
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
    const vp = vwGV(p, {scale: s}), task = p.dtask = p.proxy.render({canvasContext: cv.getContext('2d', {alpha: false}), viewport: vp, transform: [os, 0, 0, os, -Math.floor(x0) * os, -Math.floor(y0) * os], annotationMode: PDFJS.AnnotationMode.ENABLE_STORAGE, pageColors: vwPC()});
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

/* ===== Pantalla completa (v39.38): sin la barra del título; la de herramientas se puede ocultar (pestaña ▾ para sacarla).
   Doble toque en una zona vacía: colores para subrayar. Pulsación larga o tres toques rápidos: las dos barras durante 3 s (para salir).
   «Atrás» (móvil y tablet) o Esc salen de la pantalla completa. Al cambiar de página, «Página X de N» arriba durante 3 s. */
function vwFs(on) {
  on = !!on; if (!VW.open || VW.fs === on) return; VW.fs = on; const d = $('#vw'); d.classList.toggle('fs', on); d.classList.remove('fsbars', 'tbx'); vwColClose();
  if (on) {
    VW.tbHide = false; d.classList.remove('tbh'); try { history.pushState({vwfs: 1}, ''); VW.fsPushed = true; } catch (e) {}
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); } catch (e) {}
    vwPgTip();
  } else {
    d.classList.remove('tbh'); $('#vwPgTip').hidden = true;
    if (VW.fsPushed) { VW.fsPushed = false; VW.fsSkip = true; history.back(); }
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch (e) {}
  }
  if (VW.fit) setTimeout(() => vwFitW(true), 60);
}
/* v39.44: la barra que se saca con la pestaña ▾ (o con las dos barras de 3 s) flota encima de la página en vez de quitarle sitio:
   así la hoja no se mueve ni cambia de tamaño (con «ajustar», antes se reajustaba a la altura nueva). Al entrar en pantalla completa
   la barra sigue ocupando su sitio, como siempre; desde que se oculta, flota (clase tbx) hasta salir. */
function vwTbHide(h) { const d = $('#vw'); VW.tbHide = h; d.classList.toggle('tbh', h); if (h) d.classList.add('tbx'); }
function vwBars() { const d = $('#vw'); d.classList.add('fsbars'); d.style.setProperty('--vwhh', (vw$('.vwh')?.offsetHeight || 49) + 'px'); clearTimeout(VW.barT); VW.barT = setTimeout(() => d.classList.remove('fsbars'), 3000); }
function vwPgTip() { const t = $('#vwPgTip'); if (!VW.pages.length) return; VW.tipPg = VW.cur; const lf = lnLeftOn() && lnLeftPdf(); t.textContent = `Página ${VW.cur + 1} de ${VW.pages.length}${lf ? ' · ' + lf : ''}`; t.hidden = false; clearTimeout(VW.pgT); VW.pgT = setTimeout(() => t.hidden = true, 3000); }
function vwTaps(x, y) {   // toques seguidos en una zona vacía: 2 → colores, 3 → barras
  const now = Date.now(), L = VW.taps = (VW.taps || []).filter(t => now - t.t < 450 && Math.hypot(t.x - x, t.y - y) < 40); L.push({x, y, t: now});
  clearTimeout(VW.tapT);
  if (L.length >= 3) { VW.taps = []; vwColClose(); return vwBars(); }
  if (L.length === 2) VW.tapT = setTimeout(() => { VW.taps = []; vwColOpen(x, y); }, 300);   // espera por si llega un tercer toque
}
function vwColOpen(x, y) {
  const m = $('#vwCol'), D = $('#vw').getBoundingClientRect(); m.querySelectorAll('.vwc').forEach(b => b.classList.toggle('on', +b.dataset.c === VW.color)); m.hidden = false;
  m.style.left = Math.max(8, Math.min(x - D.left - m.offsetWidth / 2, D.width - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y - D.top - m.offsetHeight - 12, D.height - m.offsetHeight - 8)) + 'px';
  clearTimeout(VW.colT); VW.colT = setTimeout(vwColClose, 5000);
}
function vwColClose() { const m = $('#vwCol'); if (m) m.hidden = true; }
function vwColPick(i) { VW.color = i; vwColorShow(); vwColClose(); toast(`Subrayar en ${VW_COLORS[i][1].toLowerCase()}.`, [], 1200); }
