'use strict';
/* ===== Lector de EPUB (v39.42) =====
   Los EPUB se enlazan y se guardan igual que los PDF: los mismos huecos del paper («pdf» y «pdf2»), la bandeja, la copia en este navegador y en
   Google Drive. El campo se sigue llamando «pdf»; el formato lo dice la extensión del nombre (isEpub, js/modelo.js).
   Se abren en este lector, sin librerías: un EPUB es un ZIP (se descomprime con DecompressionStream), META-INF/container.xml dice dónde está el OPF
   (metadatos, manifiesto y orden de lectura) y el índice sale de nav.xhtml (EPUB 3) o de toc.ncx (EPUB 2).
   Cada capítulo se copia limpio: solo etiquetas de texto, tablas, listas, enlaces e imágenes, con elementos nuevos (nada del libro llega tal cual a la
   página): sin scripts, estilos del libro, formularios, iframes ni atributos data-… El texto se adapta a la pantalla con la tipografía que elijas, así
   que no hay páginas fijas: no hay zoom, recorte de márgenes, zonas ni notas sueltas, y la «página» de un EPUB es el capítulo.
   Lo del visor de PDF que se adapta:
   · Subrayados con color y comentario, en el mismo campo «ann»: p = capítulo y q = [inicio, −inicio, fin, −inicio] (posición en el texto del
     capítulo; los negativos hacen que el orden «de arriba abajo» de las anotaciones del PDF sirva igual). Se copian, van a las notas y al resumen.
   · Modo seguido o página a página (columnas: toques a los lados, deslizar, ← →) y doble página; desplazamiento automático y modo concentración.
   · Marcadores («bm»: capítulo × 100 + % del capítulo), dónde ibas («page» = capítulo, se sincroniza; el punto exacto, en el dispositivo: gp-ep-pos),
     índice, buscar, temas claro, sepia y noche, pantalla completa y notas del paper.
   Ajustes del lector en este dispositivo: gp-ep-set (letra, tamaño, interlineado, ancho, justificar, tema y modo). */
const EP = {open: false, src: null, file: null, bk: null, gen: 0, secs: [], len: [], cum: [], fold: [], paged: false, pop: null, find: {q: '', hits: [], i: -1}, side: false, tab: 'ann', starts: null, urls: [], color: 0};
const EP_SET_K = 'gp-ep-set', EP_POS_K = 'gp-ep-pos', EP_MAX = 64 * 1048576;
const ep$ = s => document.querySelector('#ep ' + s);

/* ---- ZIP: el directorio central dice dónde está cada archivo; se descomprime solo lo que se pide ---- */
async function epZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), td = new TextDecoder();
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw Error('el archivo no es un EPUB válido');
  const ents = new Map(); let o = dv.getUint32(e + 16, true);
  for (let k = dv.getUint16(e + 10, true); k > 0 && o + 46 <= buf.length && dv.getUint32(o, true) === 0x02014b50; k--) {
    const nl = dv.getUint16(o + 28, true); ents.set(td.decode(buf.subarray(o + 46, o + 46 + nl)), {m: dv.getUint16(o + 10, true), cs: dv.getUint32(o + 20, true), lo: dv.getUint32(o + 42, true)});
    o += 46 + nl + dv.getUint16(o + 30, true) + dv.getUint16(o + 32, true);
  }
  const bytes = async name => {
    const z = ents.get(name); if (!z || z.lo + 30 > buf.length) return null;
    const s = z.lo + 30 + dv.getUint16(z.lo + 26, true) + dv.getUint16(z.lo + 28, true), d = buf.subarray(s, s + z.cs);
    if (z.m === 0) return d; if (z.m !== 8) throw Error('el EPUB usa una compresión no admitida');
    const rd = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
    for (;;) { const {done, value} = await rd.read(); if (done) break; n += value.length; if (n > EP_MAX) { rd.cancel().catch(() => {}); throw Error('un archivo del EPUB es demasiado grande'); } parts.push(value); }
    const out = new Uint8Array(n); let p = 0; for (const x of parts) { out.set(x, p); p += x.length; } return out;
  };
  return {has: n => ents.has(n), bytes, text: async n => { const b = await bytes(n); return b ? td.decode(b) : null; }};
}
function epPath(dir, href) {   // ruta dentro del ZIP de un enlace relativo (sin #fragmento); null si es de fuera
  let h = String(href || '').split('#')[0]; try { h = decodeURIComponent(h); } catch (e) {}
  if (/^[a-z][\w+.-]*:/i.test(h)) return null;
  const out = []; for (const s of ((h.startsWith('/') ? '' : dir) + h).split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}
const epDir = p => p.replace(/[^/]*$/, '');
const epXml = s => { const d = new DOMParser().parseFromString(s || '', 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; };
const epTags = (d, t) => d ? [...d.getElementsByTagNameNS('*', t)] : [];
const epTxt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const epAttr = (el, n) => el ? [...el.attributes].find(a => a.localName === n)?.value || '' : '';
const epName = s => { s = s.trim(); if (!s || s.includes(',')) return s; const w = s.split(/\s+/); return w.length < 2 ? s : `${w.pop()}, ${w.join(' ')}`; };   // «Nombre Apellido» → «Apellido, Nombre»
const epMime = p => ({jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif'})[(String(p).match(/\.(\w+)$/) || [])[1]?.toLowerCase()] || 'application/octet-stream';

/* ---- El libro: metadatos, orden de lectura (spine), portada e índice ---- */
async function epBook(file) {
  if (typeof DecompressionStream !== 'function') throw Error('este navegador no puede abrir EPUB (actualízalo)');
  const z = await epZip(file), opfP = epTags(epXml(await z.text('META-INF/container.xml')), 'rootfile')[0]?.getAttribute('full-path');
  if (!opfP) throw Error('falta META-INF/container.xml');
  const opf = epXml(await z.text(opfP)); if (!opf) throw Error('no se pudo leer el índice del EPUB (OPF)');
  const base = epDir(opfP), man = new Map();
  for (const it of epTags(opf, 'item')) man.set(it.getAttribute('id'), {id: it.getAttribute('id') || '', path: epPath(base, it.getAttribute('href')), type: it.getAttribute('media-type') || '', props: it.getAttribute('properties') || ''});
  const spEl = epTags(opf, 'spine')[0], spine = epTags(opf, 'itemref').map(r => man.get(r.getAttribute('idref'))).filter(x => x && x.path && /html|xml/.test(x.type) && z.has(x.path)).slice(0, 2000);
  if (!spine.length) throw Error('el EPUB no tiene capítulos');
  const md = epTags(opf, 'metadata')[0], dc = t => epTags(md, t), metas = dc('meta');
  const refine = (el, prop) => { const id = el.getAttribute('id'); return id ? epTxt(metas.find(m => m.getAttribute('refines') === '#' + id && m.getAttribute('property') === prop)) : ''; };
  const authors = dc('creator').filter(c => { const r = epAttr(c, 'role') || refine(c, 'role'); return !r || r === 'aut'; })
    .map(c => { const fa = epAttr(c, 'file-as') || refine(c, 'file-as'); return fa.includes(',') ? fa.trim() : epName(epTxt(c)); }).filter(Boolean).slice(0, 50);
  const ids = dc('identifier').map(epTxt), isbn = ids.map(x => x.replace(/^urn:isbn:/i, '').replace(/[\s-]/g, '')).find(x => /^(97[89]\d{10}|\d{9}[\dX])$/i.test(x)) || '';
  const doi = (ids.join(' ').match(/\b10\.\d{4,9}\/[^\s"<>]+/) || [''])[0].replace(/[.,;:)\]}>'"]+$/, '').toLowerCase();
  const meta = {title: epTxt(dc('title')[0]).slice(0, 400), authors, year: (epTxt(dc('date')[0]).match(/\b(1[5-9]|20)\d{2}\b/) || [''])[0], publisher: epTxt(dc('publisher')[0]).slice(0, 300),
    lang: epTxt(dc('language')[0]).slice(0, 20), isbn, doi, desc: epTxt(new DOMParser().parseFromString(epTxt(dc('description')[0]), 'text/html').body).slice(0, 4000)};
  const all = [...man.values()], cm = metas.find(m => m.getAttribute('name') === 'cover')?.getAttribute('content');
  const cover = (all.find(x => /\bcover-image\b/.test(x.props)) || man.get(cm) || all.find(x => /^image\//.test(x.type) && /cover/i.test(x.id + x.path)))?.path || '';
  // índice: nav.xhtml (EPUB 3) o toc.ncx (EPUB 2)
  let raw = [];
  const nav = all.find(x => /\bnav\b/.test(x.props));
  if (nav) { const s = await z.text(nav.path) || '', d = epXml(s) || new DOMParser().parseFromString(s, 'text/html'), navs = epTags(d, 'nav'), n = navs.find(x => /\btoc\b/.test(epAttr(x, 'type'))) || navs[0];
    const kids = (el, t) => [...(el?.children || [])].filter(x => x.localName === t);
    const walk = (ol, lv) => { for (const li of kids(ol, 'li')) { const a = kids(li, 'a')[0] || kids(li, 'span')[0]; if (a) raw.push({t: epTxt(a), href: a.getAttribute('href') || '', lv, dir: epDir(nav.path)}); walk(kids(li, 'ol')[0], lv + 1); } };
    walk(n && n.getElementsByTagNameNS('*', 'ol')[0], 0); }
  if (!raw.length) { const ncx = man.get(spEl?.getAttribute('toc')) || all.find(x => /ncx/.test(x.type)), d = ncx && epXml(await z.text(ncx.path));
    const walk = (el, lv) => { for (const np of [...(el?.children || [])].filter(x => x.localName === 'navPoint')) { raw.push({t: epTxt(epTags(np, 'text')[0]), href: epTags(np, 'content')[0]?.getAttribute('src') || '', lv, dir: epDir(ncx.path)}); walk(np, lv + 1); } };
    walk(epTags(d, 'navMap')[0], 0); }
  const idx = new Map(spine.map((s, i) => [s.path, i]));
  const toc = raw.filter(x => x.t && x.href).slice(0, 3000).map(x => { let f = x.href.split('#')[1] || ''; try { f = decodeURIComponent(f); } catch (e) {} return {t: x.t.slice(0, 300), lv: Math.min(x.lv, 6), i: idx.get(epPath(x.dir, x.href)) ?? -1, frag: f}; }).filter(x => x.i >= 0);
  return {z, meta, spine, toc, cover, idx};
}
async function epThumb(bk) {   // la portada en pequeño (180 px de ancho, JPEG), como la miniatura de un PDF
  const b = bk.cover && await bk.z.bytes(bk.cover).catch(() => null); if (!b) return '';
  const url = URL.createObjectURL(new Blob([b], {type: epMime(bk.cover)}));
  try { const im = new Image(); im.src = url; await im.decode(); const cv = document.createElement('canvas'); cv.width = 180; cv.height = Math.max(1, Math.round(im.naturalHeight * 180 / Math.max(1, im.naturalWidth)));
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', .72); }
  catch (e) { return ''; } finally { URL.revokeObjectURL(url); }
}
async function epMeta(file) {   // metadatos y portada (bandeja, completar la ficha); null si no se puede leer
  try { const bk = await epBook(file); return {...bk.meta, thumb: await epThumb(bk)}; } catch (e) { console.debug('[epub]', e); return null; }
}

/* ---- Limpieza de cada capítulo: se crean elementos nuevos, con solo lo permitido ---- */
const EP_KEEP = new Set('a abbr article aside b bdi bdo blockquote br caption cite code col colgroup dd del dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr i img ins kbd li main mark nav ol p pre q rp rt ruby s samp section small span strong sub sup table tbody td tfoot th thead time tr u ul var wbr'.split(' '));
const EP_AS = {center: 'div', font: 'span', big: 'span', tt: 'code', body: 'div', strike: 's', acronym: 'abbr', listing: 'pre', xmp: 'pre', blink: 'span', label: 'span', address: 'div', dir: 'ul', menu: 'ul', picture: 'span', details: 'div', summary: 'p'};
const EP_SKIP = new Set('script style link meta title head iframe frame frameset object embed applet form input button select option textarea audio video source track canvas template noscript base param map area dialog math'.split(' '));
function epClean(node, ctx, out) {
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.data)); continue; }
    if (n.nodeType !== 1) continue;
    let t = n.localName.toLowerCase();
    if (t === 'svg') { const h = epAttr(epTags(n, 'image')[0], 'href'); if (h) out.appendChild(epImg(h, ctx, '')); continue; }   // portadas en SVG: la imagen
    if (EP_SKIP.has(t)) continue;
    t = EP_AS[t] || t;
    if (!EP_KEEP.has(t)) { epClean(n, ctx, out); continue; }   // etiqueta desconocida: solo su contenido
    if (t === 'img') { const s = n.getAttribute('src') || epAttr(n, 'href'); if (s) out.appendChild(epImg(s, ctx, n.getAttribute('alt'))); continue; }
    const el = document.createElement(t), id = n.getAttribute('id');
    if (id && /^[^\s"'<>]{1,120}$/.test(id)) el.id = 'ep' + ctx.i + '-' + id;
    for (const k of ['title', 'colspan', 'rowspan']) { const v = n.getAttribute(k); if (v && v.length < 300) el.setAttribute(k, v); }
    const dir = n.getAttribute('dir'), lang = n.getAttribute('lang') || n.getAttribute('xml:lang');
    if (dir === 'rtl' || dir === 'ltr') el.dir = dir; if (lang && /^[\w-]{1,20}$/.test(lang)) el.lang = lang;
    const st = n.getAttribute('style') || '', al = (st.match(/text-align\s*:\s*(left|right|center|justify)/i) || [])[1];   // del estilo del libro, solo alineación, cursiva y negrita
    if (al) el.style.textAlign = al.toLowerCase(); if (/font-style\s*:\s*italic/i.test(st)) el.style.fontStyle = 'italic'; if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) el.style.fontWeight = 'bold';
    if (/^(center|centered|centrado)$/i.test(n.getAttribute('class') || '') || n.getAttribute('align') === 'center') el.style.textAlign = 'center';
    const ty = epAttr(n, 'type'); if (/\bnoteref\b/.test(ty)) el.className = 'epnr';
    if (t === 'a') epLink(el, n.getAttribute('href') || epAttr(n, 'href'), ctx);
    out.appendChild(el); epClean(n, ctx, el);
  }
}
function epLink(el, h, ctx) {   // de fuera: pestaña nueva; dentro del libro: salta al capítulo (data-go = «capítulo#fragmento»)
  h = String(h || '').trim(); if (!h) return;
  if (/^(https?|mailto):/i.test(h)) { el.href = h; el.target = '_blank'; el.rel = 'noopener noreferrer'; return; }
  if (/^[a-z][\w+.-]*:/i.test(h)) return;
  const [p, f = ''] = h.split('#'), i = p ? ctx.idx.get(epPath(ctx.dir, p)) : ctx.i; if (i == null) return;
  let fr = f; try { fr = decodeURIComponent(f); } catch (e) {}
  el.href = '#'; el.dataset.go = i + '#' + fr.slice(0, 120);
}
function epImg(src, ctx, alt) { const im = document.createElement('img'), p = epPath(ctx.dir, src); if (p) im.dataset.src = p; im.alt = String(alt || '').slice(0, 300); im.decoding = 'async'; return im; }
async function epImgs(gen) {   // las imágenes, de una en una; mientras no hayas movido nada, se vuelve al punto donde ibas cuando cambia el alto
  const L = [...$('#epDoc').querySelectorAll('img[data-src]')], cache = new Map(), t0 = performance.now();
  for (const im of L) {
    if (gen !== EP.gen) return; const p = im.dataset.src; im.removeAttribute('data-src');
    let url = cache.get(p); if (url === undefined) { const b = await EP.bk.z.bytes(p).catch(() => null); if (gen !== EP.gen) return; url = b ? URL.createObjectURL(new Blob([b], {type: epMime(p)})) : ''; if (url) EP.urls.push(url); cache.set(p, url); }
    if (!url) continue; im.src = url; try { await im.decode(); } catch (e) {}
    if (gen !== EP.gen) return; EP.starts = null; if (!EP.moved && EP.anchor && performance.now() - t0 < 20000) epGoLoc(EP.anchor, true);
  }
}

/* ---- Abrir y cerrar ---- */
function epBuild() {
  if ($('#ep')) return;
  const sw = fn => VW_COLORS.map(([c, t], i) => `<button class="vwc" data-c="${i}" style="--c:${c}" title="${t}" aria-label="Color ${t}" data-onclick="${fn}(${i})"></button>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<dialog id="ep" aria-label="Lector de EPUB">
    <div class="vwh"><button class="vwib" data-onclick="epClose()" title="Volver a la lista (Esc)" aria-label="Volver">←</button><b class="vwt"></b>
      <span id="epWhere" class="epw"></span><span id="epLeft" class="epw lnleft"></span>
      <span class="vwf"><input id="epQ" type="search" placeholder="Buscar en el libro" aria-label="Buscar en el libro" data-onkeydown="epFindKey(event)" data-oninput="epFindReset()"><span id="epQn"></span><button class="vwib vwqL" id="epQL" hidden data-onclick="epPanel('find')" title="Ver todos los resultados, con su frase" aria-label="Lista de resultados">☰</button></span>
      <button class="vwib vwfb" data-onclick="epFindToggle()" title="Buscar (Ctrl+F)" aria-label="Buscar">🔍</button>
      <button class="vwib epaa" id="epAaB" data-onclick="epTypoMenu(event)" title="Texto: tamaño, letra, interlineado, ancho y colores" aria-label="Texto">Aa</button>
      <button class="vwib" data-onclick="epFs(true)" title="Pantalla completa (F)" aria-label="Pantalla completa">⛶</button>
      <button class="vwib" id="epMoreB" data-onclick="epMore(event)" title="Más: modo de lectura, marcadores, descargar…" aria-label="Más">⋯</button></div>
    <div class="vwtb" role="toolbar" aria-label="Herramientas">
      <button class="vwm vwun" data-onclick="epUndo()" title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><span>↶</span><small>Deshacer</small></button>
      <span class="vwcs" role="group" aria-label="Color al subrayar" title="Selecciona texto y elige un color para subrayarlo">${sw('epColor')}</span>
      <button class="vwm" data-onclick="epFontBy(-1)" title="Letra más pequeña (−)" aria-label="Letra más pequeña"><span>A−</span></button><button class="vwm" data-onclick="epFontBy(1)" title="Letra más grande (+)" aria-label="Letra más grande"><span>A+</span></button>
      <button class="vwm" id="epBmB" data-onclick="epBmToggle()" title="Marcar o quitar este punto (B)"><span>🔖</span><small>Marcador</small></button>
      <button class="vwm eptc" data-onclick="epPanel('toc')" title="Índice del libro (I)"><span>📑</span><small>Índice</small></button>
      <button class="vwm epnb" data-onclick="epNotes()" title="Notas del paper (E)"><span>📝</span><small>Notas</small></button>
      <button class="vwm vwsb" data-onclick="epPanel('ann')" title="Subrayados y comentarios (L)"><span>💬</span><small>Anotaciones</small><b id="epAn"></b></button></div>
    <div class="vwbody"><div id="epScroll" tabindex="0" aria-label="Texto del libro"><div id="epDoc"></div></div><p id="epLoad" class="vwload">Abriendo el EPUB…</p><aside id="epSide" hidden></aside>
      <button id="epFsX" class="vwfloat vwib" data-onclick="epFs(false)" title="Salir de pantalla completa (Esc)" aria-label="Salir de pantalla completa">✕</button></div>
    <div class="epfoot"><input id="epBar" type="range" min="0" max="1000" value="0" aria-label="Posición en el libro" data-oninput="epBarTip(this.value)" data-onchange="epBarGo(this.value)"><span id="epPct"></span></div>
    <div id="epSel" class="vwfloat" hidden data-onmousedown="event.preventDefault()">${sw('epSelColor')}<button class="vwib" data-onclick="epSelNote()" title="Subrayar y comentar" aria-label="Subrayar y comentar">💬</button><button class="vwib" data-onclick="epSelCopy()" title="Copiar el texto" aria-label="Copiar">📋</button><button class="vwib" data-onclick="lnSelMore(true)" title="Más: copiar con la cita, definición, traducir…" aria-label="Más">⋯</button></div>
    <div id="epPop" class="vwfloat vwpop" hidden></div></dialog>`);
  const d = $('#ep'), sc = $('#epScroll');
  d.addEventListener('cancel', e => { e.preventDefault(); epEsc(); });
  d.addEventListener('close', () => { if (EP.open) epClose(); });
  d.addEventListener('keydown', epKey);
  sc.addEventListener('scroll', () => { if (!EP.raf) EP.raf = requestAnimationFrame(() => { EP.raf = 0; epOnScroll(); }); }, {passive: true});
  for (const t of ['wheel', 'touchstart', 'pointerdown']) sc.addEventListener(t, () => { EP.moved = true; }, {passive: true});
  sc.addEventListener('touchstart', e => { const t = e.touches[0]; EP.tx = e.touches.length === 1 ? {x: t.clientX, y: t.clientY, t: Date.now()} : null; if (EP.auto) EP.autoHold = true; }, {passive: true});
  sc.addEventListener('touchend', e => { EP.autoHold = false; if (EP.auto) EP.autoY = sc.scrollTop; const s = EP.tx; EP.tx = null; if (!s || !EP.paged || tsStr() || tsJust()) return; const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 800) { EP.swiped = Date.now(); epStep(dx < 0 ? 1 : -1); } }, {passive: true});
  EP.ts = tsBind(d, sc, '#epDoc', {done: () => epSelShow()});
  sc.addEventListener('click', epClick);   // también en los márgenes (página a página: tocar a los lados)
  document.addEventListener('selectionchange', () => { if (EP.open) { clearTimeout(EP.selT); EP.selT = setTimeout(epSelShow, 250); } });
  new ResizeObserver(() => { if (!EP.open || !EP.secs.length) return; const a = EP.anchor || epLoc(); epLayout(); epGoLoc(a, true); }).observe(sc);
}
function epTitle() {
  const s = EP.src, p = s?.kind === 'paper' ? (D && D.id === s.id && $('#dlg').open ? D : db.papers.find(x => x.id === s.id)) : null;
  if (p) return (p.alias || p.title || '').trim() || p[pdfF(s.n)]?.name || 'EPUB';
  return (db.inbox || []).find(x => x.id === s?.id)?.name || EP.bk?.meta.title || 'EPUB';
}
const epHolders = () => EP.src ? vwHoldersOf(EP.src) : [];
const epAnns = () => { const h = epHolders()[0]; return h && Array.isArray(h.ann) ? h.ann : []; };
async function epOpen(src, file) {
  epBuild(); if (EP.open) epClose(true); if (VW.open) await vwClose();
  const gen = ++EP.gen, d = $('#ep');
  Object.assign(EP, {open: true, src, file, bk: null, secs: [], len: [], cum: [], fold: [], pop: null, find: {q: '', hits: [], i: -1}, starts: null, urls: [], moved: false, anchor: null, auto: false});
  ep$('.vwt').textContent = ep$('.vwt').title = epTitle(); $('#epDoc').innerHTML = ''; $('#epLoad').hidden = false; $('#epLoad').textContent = 'Abriendo el EPUB…'; $('#epWhere').textContent = '';
  $('#epQ').value = ''; $('#epQn').textContent = ''; d.classList.remove('find', 'fs', 'conc'); epPopClose(); $('#epSel').hidden = true; ep$('.epnb').hidden = src?.kind !== 'paper';
  EP.side = !!VW.sideNext || !vwMv() && innerWidth > 1100 && vwSideOn() && epAnns().length > 0; if (VW.sideNext) EP.tab = 'ann'; VW.sideNext = false;
  epSetApply(); epColorShow(); epCount(); lnLblApply(); d.classList.toggle('tsel', tsWant()); if (!d.open) d.showModal(); epSideShow();
  EP.txt = null; LN.ep = []; LN.epFindQ = null; lnClose(); lnEpBackShow(); $('#epQL').hidden = true; wlPoke();
  try {
    const bk = await epBook(file); if (gen !== EP.gen) return; EP.bk = bk;
    if (ep$('.vwt').textContent === 'EPUB' && bk.meta.title) ep$('.vwt').textContent = bk.meta.title;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < bk.spine.length; i++) {
      const s = bk.spine[i], raw = await bk.z.text(s.path) || ''; if (gen !== EP.gen) return;
      let x = new DOMParser().parseFromString(raw, /xhtml|xml/.test(s.type) ? 'application/xhtml+xml' : 'text/html');
      if (x.getElementsByTagName('parsererror').length) x = new DOMParser().parseFromString(raw, 'text/html');
      const sec = document.createElement('section'); sec.className = 'epc'; sec.dataset.i = i;
      epClean(x.body || epTags(x, 'body')[0] || x.documentElement, {i, dir: epDir(s.path), idx: bk.idx}, sec); sec.normalize(); frag.appendChild(sec); EP.secs.push(sec);
    }
    $('#epDoc').appendChild(frag); $('#epLoad').hidden = true;
    EP.len = EP.secs.map(s => s.textContent.length); let c = 0; EP.cum = EP.len.map(n => (c += n) - n); EP.total = Math.max(1, c);
    epLayout(); epDrawAnn(); epSideShow(); txAfterEpub(src);
    const pf = epHolders()[0], ch = Math.min(EP.secs.length, Math.max(1, pdfPage(pf?.page) || 1)) - 1;
    let loc = {i: ch, f: 0}; try { const r = JSON.parse(localStorage.getItem(EP_POS_K) || '{}')[vwSrcKey(src)]; if (Array.isArray(r) && r[0] === ch && r[1] >= 0 && r[1] < 1) loc.f = r[1]; } catch (e) {}
    epGoLoc(loc, true); epOnScroll(); epImgs(gen); $('#epScroll').focus({preventScroll: true});
    if (ch || loc.f > .01) toast(`Sigues donde lo dejaste${ch ? ` (capítulo ${ch + 1})` : ''}.`, [{t: '⏮ Ir al principio', fn: () => epGoLoc({i: 0, f: 0})}], 3500);
  } catch (e) {
    if (gen !== EP.gen) return; console.error(e);
    $('#epLoad').innerHTML = `No se pudo abrir el EPUB${e.message ? ': ' + esc(e.message) : ''}. <button data-onclick="epDownload()">⬇ Descargar el archivo</button>`;
  }
}
function epClose(keep) {
  if (!EP.open) return; epAutoStop(); if (SAY.ep) sayStop(true); if (EP.fs) epFs(false); epSaveComment(); epPosSave(true);
  const src = EP.src; EP.open = false; EP.gen++;
  EP.urls.forEach(u => URL.revokeObjectURL(u)); Object.assign(EP, {urls: [], secs: [], bk: null, file: null, starts: null});
  $('#epDoc').innerHTML = ''; epPopClose(); $('#epSel').hidden = true; const m = $('#epMenu'); if (m) m.hidden = true; lnClose(); LN.ep = []; lnEpBackShow(); EP.txt = null; wlSync();
  if (!keep) { const d = $('#ep'); if (d.open) d.close(); }
  if (src?.kind === 'paper' && db.papers.some(p => p.id === src.id)) renderPaper(src.id);
  if (src?.kind === 'inbox') inboxDraw();
  if ($('#dlg').open && D && src?.kind === 'paper' && D.id === src.id) drawD();
  if (syAuto()) sySoon(1500);
}
function epDbChanged() { if (!EP.open || !EP.secs.length) return; epDrawAnn(); epBmShow(); if (EP.side) epSideDraw(); if (EP.pop && !epAnns().some(a => a.id === EP.pop)) epPopClose(); }
function epDownload() { const f = EP.file; if (!f) return; const a = document.createElement('a'), u = URL.createObjectURL(f); a.href = u; a.download = f.name || 'libro.epub'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
async function epShare() { const f = EP.file; if (!f) return; try { await navigator.share({files: [new File([f], f.name || 'libro.epub', {type: 'application/epub+zip'})], title: epTitle()}); } catch (e) { if (e.name !== 'AbortError') epDownload(); } }
const epCanShare = () => { try { return !!navigator.canShare && navigator.canShare({files: [new File([''], 'a.epub', {type: 'application/epub+zip'})]}); } catch (e) { return false; } };

/* ---- Dónde ibas: «page» = capítulo (va con el EPUB del paper y se sincroniza); el punto exacto, en este dispositivo ---- */
function epPosSave(closing) {
  if (!EP.open || !EP.secs.length) return; const loc = epLoc(), k = vwSrcKey(EP.src);
  try { const o = JSON.parse(localStorage.getItem(EP_POS_K) || '{}'); delete o[k]; o[k] = [loc.i, Math.round(loc.f * 1000) / 1000]; const ks = Object.keys(o); for (const x of ks.slice(0, Math.max(0, ks.length - 200))) delete o[x];
    localStorage.setItem(EP_POS_K, JSON.stringify(o)); } catch (e) {}
  const pg = loc.i + 1, hs = epHolders(); if (hs.length && (pdfPage(hs[0].page) || 1) !== pg) { hs.forEach(h => pg > 1 ? h.page = pg : delete h.page); markDirty(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && EP.open) epPosSave(); });
addEventListener('pagehide', () => { if (EP.open) epPosSave(); });

/* ---- Ajustes del texto (en este dispositivo) ---- */
const EP_W = {s: 30, m: 38, l: 50}, EP_FF = {serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'};
function epSet() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(EP_SET_K) || '{}') || {}; } catch (e) {}
  const np = vwNightPref(), fs = Math.round(+o.fs);
  return {fs: fs >= 12 && fs <= 36 ? fs : 19, lh: [1.35, 1.6, 1.9].includes(o.lh) ? o.lh : 1.6, w: EP_W[o.w] ? o.w : 'm', font: o.font === 'sans' ? 'sans' : 'serif', just: !!o.just,
    th: ['light', 'sepia', 'night', 'auto'].includes(o.th) ? o.th : np === 'on' ? 'night' : np === 'auto' ? 'auto' : 'light', mode: o.mode === 'page' ? 'page' : 'scroll', two: !!o.two, one: !!o.one};
}
function epSetPut(k, v) { const o = epSet(); o[k] = v; try { localStorage.setItem(EP_SET_K, JSON.stringify(o)); } catch (e) {} epSetApply(true); }
function epSetApply(keep) {
  const s = epSet(), d = $('#ep'); if (!d) return; const loc = keep && EP.secs.length ? epLoc() : null;
  d.style.setProperty('--ep-fs', s.fs + 'px'); d.style.setProperty('--ep-lh', s.lh); d.style.setProperty('--ep-w', EP_W[s.w] + 'em'); d.style.setProperty('--ep-ff', EP_FF[s.font]);
  d.dataset.th = s.th === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'light') : s.th; d.classList.toggle('epjust', s.just);
  EP.paged = s.mode === 'page' && !EP.auto; EP.two = s.two; d.classList.toggle('eppaged', EP.paged);
  if (EP.secs.length) { epLayout(); if (loc) epGoLoc(loc, true); epOnScroll(); }
}
function epFontBy(d) { const s = epSet(); epSetPut('fs', Math.max(12, Math.min(36, s.fs + d))); toast(`Letra: ${Math.round(epSet().fs / 19 * 100)} %`, [], 900); }
function epTypoMenu(e) {
  e?.stopPropagation?.(); if (e?.currentTarget) EP.menuR = e.currentTarget.getBoundingClientRect(); const s = epSet(), o = (k, v, t) => `<button data-keep data-onclick="epSetPut('${k}',${typeof v === 'string' ? `'${v}'` : v});epTypoMenu()">${tick(s[k] === v)}${t}</button>`;
  epMenu(EP.menuR, `<div class="ctxh">Tamaño de la letra: ${Math.round(s.fs / 19 * 100)} %</div><div class="epmrow"><button data-keep data-onclick="epFontBy(-1);epTypoMenu()" aria-label="Más pequeña">A−</button><button data-keep data-onclick="epSetPut('fs',19);epTypoMenu()">100 %</button><button data-keep data-onclick="epFontBy(1);epTypoMenu()" aria-label="Más grande">A+</button></div>
    <div class="ctxh">Letra</div>${o('font', 'serif', 'Con remate (Georgia)')}${o('font', 'sans', 'Sin remate')}
    <div class="ctxh">Interlineado</div><div class="epmrow">${[[1.35, 'Junto'], [1.6, 'Normal'], [1.9, 'Amplio']].map(([v, t]) => `<button data-keep class="${s.lh === v ? 'on' : ''}" data-onclick="epSetPut('lh',${v});epTypoMenu()">${t}</button>`).join('')}</div>
    <div class="ctxh">Ancho de la línea</div><div class="epmrow">${[['s', 'Estrecho'], ['m', 'Normal'], ['l', 'Ancho']].map(([v, t]) => `<button data-keep class="${s.w === v ? 'on' : ''}" data-onclick="epSetPut('w','${v}');epTypoMenu()">${t}</button>`).join('')}</div>
    <button data-keep data-onclick="epSetPut('just',${!s.just});epTypoMenu()">${tick(s.just)}Justificar el texto</button>
    <div class="ctxh">Colores</div><div class="epmrow epth">${[['light', 'Claro'], ['sepia', 'Sepia'], ['night', 'Noche'], ['auto', 'Sistema']].map(([v, t]) => `<button data-keep class="ep-${v}${s.th === v ? ' on' : ''}" data-onclick="epSetPut('th','${v}');epTypoMenu()">${t}</button>`).join('')}</div>`);
}

/* ---- Seguido o página a página: columnas del ancho de la pantalla (doble página: dos por pantalla) ---- */
function epLayout() {
  const sc = $('#epScroll'), doc = $('#epDoc'); EP.starts = null; if (!sc || !doc) return;
  if (!EP.paged) { doc.style.cssText = ''; return; }
  const W = sc.clientWidth, H = sc.clientHeight, s = epSet(), N = EP.two && W >= 760 ? 2 : 1, max = EP_W[s.w] * s.fs;
  let G = Math.max(vwMv() ? 32 : 48, Math.round((W - N * max) / N)); G += G % 2;   // el hueco entre columnas son los dos márgenes
  doc.style.cssText = `width:${W - G}px;margin-left:${G / 2}px;height:${H}px;column-count:${N};column-gap:${G}px;--ep-ch:${Math.max(120, H - 72)}px`;
  EP.pw = W; EP.cols = N;
}
function epStarts() {   // dónde empieza cada capítulo (en el sentido del desplazamiento)
  if (!EP.paged) return EP.secs.map(s => s.offsetTop);
  if (EP.starts) return EP.starts; const sc = $('#epScroll'), x0 = sc.getBoundingClientRect().left - sc.scrollLeft, W = EP.pw || sc.clientWidth;
  return EP.starts = EP.secs.map(s => { const r = s.getClientRects()[0]; return r ? Math.floor((r.left - x0 + 1) / W) * W : 0; });   // la página donde empieza (cada capítulo, en una nueva)
}
const epPos = () => { const sc = $('#epScroll'); return EP.paged ? sc.scrollLeft : sc.scrollTop; };
function epEnd(st, i) { const sc = $('#epScroll'); return EP.paged ? st[i + 1] ?? sc.scrollWidth : EP.secs[i].offsetTop + EP.secs[i].offsetHeight; }
function epLoc() {   // {i: capítulo, f: fracción del capítulo} del punto que estás leyendo
  if (!EP.secs.length) return {i: 0, f: 0}; const st = epStarts(), x = epPos() + 2; let i = 0;
  for (let k = 0; k < st.length; k++) if (st[k] <= x) i = k; else break;
  return {i, f: Math.max(0, Math.min(.999, (x - 2 - st[i]) / Math.max(1, epEnd(st, i) - st[i])))};
}
function epLocPx(l) { const st = epStarts(), i = Math.max(0, Math.min(EP.secs.length - 1, l.i)); return st[i] + l.f * (epEnd(st, i) - st[i]); }
function epGoLoc(l, keepAnchor) {
  if (!EP.secs.length || !l) return; const sc = $('#epScroll'), v = epLocPx(l);
  if (EP.paged) sc.scrollLeft = Math.floor((v + 1) / EP.pw) * EP.pw; else sc.scrollTop = v;
  EP.anchor = {i: l.i, f: l.f}; if (!keepAnchor) EP.moved = true; epOnScroll(true);
}
function epStep(d) {   // página a página: la siguiente o la anterior (en el modo seguido, una pantalla)
  const sc = $('#epScroll'); EP.moved = true;
  if (!EP.paged) return sc.scrollBy({top: d * sc.clientHeight * .9});
  const P = EP.pw || sc.clientWidth, W = EP.cols === 2 && epSet().one ? P / 2 : P;   // doble página de una en una (v39.43): avanza una columna
  const n = Math.round(sc.scrollLeft / W) + d, max = Math.max(0, Math.ceil((sc.scrollWidth - P) / W - .02));
  sc.scrollLeft = Math.max(0, Math.min(max, n)) * W; epOnScroll();
}
function epOnScroll(prog) {
  if (!EP.open || !EP.secs.length) return; const l = epLoc(); if (!prog) EP.anchor = l;
  const pct = Math.min(100, (EP.cum[l.i] + l.f * EP.len[l.i]) / EP.total * 100), N = EP.secs.length, t = epChTitle(l.i);
  $('#epWhere').textContent = `${vwMv() ? '' : 'Cap. '}${l.i + 1}/${N} · ${Math.round(pct)} %`; $('#epWhere').title = t ? `Capítulo ${l.i + 1}: ${t}` : `Capítulo ${l.i + 1} de ${N}`;
  if (document.activeElement !== $('#epBar')) $('#epBar').value = Math.round(pct * 10); $('#epPct').textContent = t ? t : '';
  epBmShow(); epTocCur();
}
function epChTitle(i) { const L = EP.bk?.toc || [], x = L.find(y => y.i === i); if (x) return x.t; let t = ''; for (const y of L) if (y.i < i) t = y.t; return t; }   // el título del capítulo (o el del anterior que lo tenga)
function epPctLoc(v) { const want = Math.max(0, Math.min(1, v / 1000)) * EP.total; let i = 0; for (let k = 0; k < EP.cum.length; k++) if (EP.cum[k] <= want && EP.len[k]) i = k; return {i, f: Math.max(0, Math.min(.999, (want - EP.cum[i]) / Math.max(1, EP.len[i])))}; }
function epBarTip(v) { const l = epPctLoc(+v); $('#epPct').textContent = `${Math.round(v / 10)} % · ${epChTitle(l.i) || 'capítulo ' + (l.i + 1)}`; }
function epBarGo(v) { epGoLoc(epPctLoc(+v)); $('#epBar').blur(); }
function epGoTo(i, frag) {   // a un capítulo (y a un punto con id dentro de él)
  if (!EP.secs[i]) return; const el = frag && document.getElementById('ep' + i + '-' + frag);
  if (!el) return epGoLoc({i, f: 0});
  const sc = $('#epScroll'), r = el.getBoundingClientRect(), r0 = sc.getBoundingClientRect(); EP.moved = true;
  if (EP.paged) { const x = r.left - r0.left + sc.scrollLeft; sc.scrollLeft = Math.floor((x + 1) / EP.pw) * EP.pw; } else sc.scrollTop += r.top - r0.top - 24;
  epOnScroll();
}
function epShow(el) {   // lleva a la vista un elemento (un subrayado, un resultado de la búsqueda)
  if (!el) return; const sc = $('#epScroll'), r = el.getBoundingClientRect(), r0 = sc.getBoundingClientRect(); EP.moved = true;
  if (EP.paged) { const x = r.left - r0.left + sc.scrollLeft; sc.scrollLeft = Math.floor((x + 1) / EP.pw) * EP.pw; }
  else if (r.top < r0.top + 40 || r.bottom > r0.bottom - 40) sc.scrollTop += r.top - r0.top - sc.clientHeight / 3;
  epOnScroll();
}

/* ---- Toques y enlaces ---- */
function epClick(e) {
  const a = e.target.closest('a');
  if (a && a.dataset.go) { e.preventDefault(); lnClose(); return lnEpLink(a); }   // v39.50: vista previa y «↩ Volver»
  if (lnShown()) return lnClose();
  if (a && a.target === '_blank') return;
  if (tsJust()) return;   // el toque que acaba de seleccionar (táctil)
  if (tsStr() && $('#ep').classList.contains('tsel')) { tsClear(); $('#epSel').hidden = true; return; }   // táctil: tocar quita la selección (el navegador ya no lo hace)
  const m = e.target.closest('mark.eph'); if (m && !tsStr()) return epPopOpen(m.dataset.a);
  if (tsStr() || EP.swiped && Date.now() - EP.swiped < 400) return;
  if (EP.auto) { if (epConcTap()) return; const x = e.clientX / innerWidth; return x < .3 ? epAutoSpeed(-1) : x > .7 ? epAutoSpeed(1) : epAutoPause(); }
  if (!$('#epPop').hidden) return epPopClose();
  if (EP.paged) { const r = $('#epScroll').getBoundingClientRect(), x = (e.clientX - r.left) / r.width; if (x < .3) epStep(-1); else if (x > .7) epStep(1); }
}
function epNotePop(a, i, f) {   // las llamadas a nota: el texto de la nota en una ventanita, sin saltar
  const el = f && document.getElementById('ep' + i + '-' + f), box = el && (el.closest('li, aside, p, div, section') || el), t = box && box !== EP.secs[i] && epTxt(box);
  if (!t || t.length > 1500) return false;
  const pp = $('#epPop'); EP.pop = null; pp.innerHTML = `<div class="vwpoph"><span class="vwk">Nota</span><button class="vwib" data-onclick="epPopClose()" aria-label="Cerrar">✕</button></div><p class="epnote">${esc(t)}</p><div class="row vwpopb"><button data-onclick="lnEpGo(${i},'${esc(f).replace(/'/g, '')}');epPopClose()">Ir a la nota</button></div>`;
  pp.hidden = false; epPlace(pp, a.getBoundingClientRect()); return true;
}
function epPlace(el, r) {   // una ventanita flotante junto a un rectángulo de la pantalla
  const b = $('#ep').getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, b.width - w - 8)) + 'px';
  el.style.top = (r.bottom + h + 12 < b.height ? r.bottom + 8 : Math.max(8, r.top - h - 8)) + 'px';
}

/* ---- Subrayados: posiciones en el texto de cada capítulo ---- */
function epTexts(sec) { const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), L = []; let n, o = 0; while ((n = w.nextNode())) { L.push([n, o]); o += n.length; } return L; }
function epOff(sec, node, off) { const r = document.createRange(); r.setStart(sec, 0); r.setEnd(node, off); return r.toString().length; }
const EP_NOWRAP = /^(TABLE|TBODY|THEAD|TFOOT|TR|COLGROUP|UL|OL|DL)$/;
function epWrap(sec, a, b, mk) {   // envuelve el texto [a, b) del capítulo en marcas (sin cambiar el texto: las posiciones siguen valiendo)
  for (const [n, o] of epTexts(sec)) {
    const len = n.length, s = Math.max(a, o), e = Math.min(b, o + len); if (s >= e || EP_NOWRAP.test(n.parentNode.nodeName) || !n.data.slice(s - o, e - o).trim()) continue;
    let t = n; if (s > o) t = t.splitText(s - o); if (e < o + len) t.splitText(e - s);
    const m = mk(); t.parentNode.insertBefore(m, t); m.appendChild(t);
  }
}
function epUnwrap(sec, cls) { const L = sec.querySelectorAll('mark.' + cls); if (!L.length) return; L.forEach(m => m.replaceWith(...m.childNodes)); sec.normalize(); }
const epAQ = a => [Math.round(a.q[0]), Math.round(a.q[2])];   // [inicio, fin] de un subrayado del EPUB
function epDrawAnn() {
  const by = new Map(); for (const a of epAnns()) { if (a.k !== 'hl' || !EP.secs[a.p]) continue; (by.get(a.p) || by.set(a.p, []).get(a.p)).push(a); }
  EP.secs.forEach((sec, i) => { const L = by.get(i); if (!L && !sec.querySelector('mark.eph')) return; const keepF = sec.querySelector('mark.epfh'); if (keepF) epUnwrap(sec, 'epfh'); epUnwrap(sec, 'eph');
    for (const a of L || []) { const [s, e] = epAQ(a); epWrap(sec, s, e, () => { const m = document.createElement('mark'); m.className = 'eph' + (a.m ? ' cm' : '') + (a.s === 'u' ? ' u' : a.s === 'x' ? ' x' : ''); m.dataset.a = a.id; m.style.setProperty('--c', a.c); if (a.m) m.title = a.m.slice(0, 300); return m; }); }
    if (keepF) epFindMark(); });
  epCount(); if (EP.side && EP.tab === 'ann') epSideDraw();
}
function epCount() { const n = epAnns().length, b = $('#epAn'); if (b) b.textContent = n || ''; }
function epMut(fn, quiet) {   // cambia las anotaciones (en todos sus sitios), lo apunta para deshacer y sincronizar, y repinta
  const hs = epHolders(); if (!hs.length) return;
  for (const h of hs) { if (!Array.isArray(h.ann)) h.ann = []; fn(h.ann); if (EP.src.kind === 'inbox') h.up = vwNow(); }
  const P = EP.src.kind === 'paper' && db.papers.find(p => p.id === EP.src.id); if (P && hs.includes(P[pdfF(EP.src.n)])) P.modified = vwNow();
  annAutoSync(EP.src); markDirty(); if (!quiet) epDrawAnn();
}
function epSelRange() { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null; const r = s.getRangeAt(0); return $('#epDoc')?.contains(r.commonAncestorContainer) ? r : null; }
function epSelShow() {
  const r = epSelRange(), b = $('#epSel'); if (!b) return; if (!r || !r.toString().trim()) { b.hidden = true; return; }
  if (EP.auto && !EP.autoPaused) epAutoPause(true);
  b.hidden = false; const rs = r.getClientRects(), last = rs[rs.length - 1] || r.getBoundingClientRect(); epPlace(b, last);
}
function epFromSel(ci, comment, style) {   // subraya la selección (si cruza capítulos, un subrayado por capítulo)
  const r = epSelRange(); if (!r) return; const secOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest('section.epc');
  const s0 = secOf(r.startContainer), s1 = secOf(r.endContainer); if (!s0 || !s1) return;
  const i0 = +s0.dataset.i, i1 = +s1.dataset.i, now = vwNow(), add = [];
  for (let i = i0; i <= i1; i++) {
    const sec = EP.secs[i], a = i === i0 ? epOff(sec, r.startContainer, r.startOffset) : 0, b = i === i1 ? epOff(sec, r.endContainer, r.endOffset) : EP.len[i]; if (b <= a) continue;
    let t = ''; for (const [n, o] of epTexts(sec)) { const s = Math.max(a, o), e = Math.min(b, o + n.length); if (s < e) t += n.data.slice(s - o, e - o); }
    t = t.replace(/\s+/g, ' ').trim(); if (!t) continue;
    add.push({id: uid(), k: 'hl', p: i, q: [a, -a, b, -a], c: VW_COLORS[ci][0], ...(style ? {s: style} : {}), t: t.slice(0, 4000), at: now, up: now});
  }
  getSelection().removeAllRanges(); $('#epSel').hidden = true; if (!add.length) return;
  epMut(l => l.push(...add)); if (comment) setTimeout(() => epPopOpen(add[add.length - 1].id, true), 30);
}
function epColor(i) { if (EP.pop) { epUpd(EP.pop, {c: VW_COLORS[i][0]}); if (annColOnly()) return; EP.color = i; epColorShow(); return; } EP.color = i; epColorShow(); if (epSelRange()) epFromSel(i); }
function epColorShow() { document.querySelectorAll('#ep .vwtb .vwc').forEach(b => b.classList.toggle('on', +b.dataset.c === EP.color)); }
function epSelColor(i) { EP.color = i; epColorShow(); epFromSel(i); }
function epSelNote() { epFromSel(EP.color, true); }
async function epSelCopy() { const r = epSelRange(); if (!r) return; await clipText(r.toString().replace(/\s+/g, ' ').trim(), $('#ep')); getSelection().removeAllRanges(); $('#epSel').hidden = true; toast('Texto copiado.', [], 1500); }
const epUpd = (id, o, quiet) => epMut(l => { const a = l.find(x => x.id === id); if (a) Object.assign(a, o, {up: vwNow()}); }, quiet);
function epUndo() { epSaveComment(); getSelection().removeAllRanges(); undo(); }
function epPopOpen(id, focus) {
  const a = epAnns().find(x => x.id === id), pp = $('#epPop'); if (!a || !pp) return; epSaveComment(); EP.pop = id;
  pp.innerHTML = `<div class="vwpoph"><span class="vwk">🖍 Subrayado · cap. ${a.p + 1}${annLbl(a.c) ? ' · ' + esc(annLbl(a.c)) : ''}</span><span class="vwcs">${VW_COLORS.map(([c, t], i) => `<button class="vwc${a.c === c ? ' on' : ''}" style="--c:${c}" title="${t}" aria-label="${t}" data-onclick="epPopColor(${i})"></button>`).join('')}</span><button class="vwib" data-onclick="epPopClose()" aria-label="Cerrar">✕</button></div>
    ${a.t ? `<blockquote class="vwq">${esc(a.t)}</blockquote>` : ''}<textarea id="epCm" placeholder="Comentario…" data-oninput="epCmIn()">${esc(a.m || '')}</textarea>
    <div class="row vwpopb">${lnStyRow(a, 'epPopStyle')}<button data-onclick="epPopCopy()">📋 Copiar</button>${EP.src?.kind === 'paper' ? '<button data-onclick="epToNote()" title="Añade el texto y el comentario a las notas del paper">📝 A las notas</button>' : ''}<button class="danger" data-onclick="epPopDel()">🗑 Borrar</button></div>`;
  pp.hidden = false; const m = $('#epDoc').querySelector(`mark[data-a="${id}"]`); if (m) { epShow(m); epPlace(pp, m.getBoundingClientRect()); } else { pp.style.left = '50%'; pp.style.top = '30%'; }
  document.querySelectorAll('#ep mark.eph.on').forEach(x => x.classList.remove('on')); document.querySelectorAll(`#ep mark[data-a="${id}"]`).forEach(x => x.classList.add('on'));
  if (focus) $('#epCm').focus({preventScroll: true}); if (EP.side && EP.tab === 'ann') epSideDraw();
}
function epPopClose() { epSaveComment(); EP.pop = null; const pp = $('#epPop'); if (pp) pp.hidden = true; document.querySelectorAll('#ep mark.eph.on').forEach(x => x.classList.remove('on')); }
function epCmIn() { clearTimeout(EP.cmT); EP.cmT = setTimeout(epSaveComment, 700); }
function epSaveComment() {
  clearTimeout(EP.cmT); const ta = $('#epCm'); if (!ta || !EP.pop || $('#epPop').hidden) return; const a = epAnns().find(x => x.id === EP.pop), v = ta.value.trim();
  if (!a || (a.m || '') === v) return;
  epMut(l => { const x = l.find(y => y.id === a.id); if (x) { if (v) x.m = v; else delete x.m; x.up = vwNow(); } }, true); epDrawAnn();
}
function epPopColor(i) { const id = EP.pop; if (!annColOnly()) { EP.color = i; epColorShow(); } epUpd(id, {c: VW_COLORS[i][0]}); epPopOpen(id); }
async function epPopDel() { const id = EP.pop; if (!id) return; EP.pop = null; $('#epPop').hidden = true; epMut(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); }); toast('Subrayado borrado.', [{t: 'Deshacer', fn: () => undo()}], 4000); }
async function epPopCopy() { const a = epAnns().find(x => x.id === EP.pop); if (a?.t) { await clipText(a.t, $('#ep')); toast('Texto copiado.', [], 1500); } }
function epToNote() {
  epSaveComment(); const a = epAnns().find(x => x.id === EP.pop), s = EP.src, p = s?.kind === 'paper' ? (D && D.id === s.id && $('#dlg').open ? D : db.papers.find(x => x.id === s.id)) : null; if (!a || !p) return;
  const note = {id: uid(), sectionId: p.sectionIds?.[0] || '', content: [a.t ? `«${a.t}» (cap. ${a.p + 1})` : `(cap. ${a.p + 1})`, a.m].filter(Boolean).join('\n\n')};
  if (p === D) { D.notes.push(note); drawD(); return toast('Añadido a las notas del paper (se guarda al guardar la ficha).', [], 3000); }
  p.notes.push(note); p.modified = vwNow(); logChange(p, `Nota desde el EPUB (cap. ${a.p + 1})`); markDirty(); toast('Añadido a las notas del paper.', [{t: 'Deshacer', fn: undo}], 3000);
}

/* ---- Panel: anotaciones e índice ---- */
function epPanel(t) { if (EP.side && EP.tab === t) { EP.side = false; return epSideShow(); } EP.tab = t; EP.side = true; try { localStorage.setItem('gp-vw-side', '1'); } catch (e) {} epSideShow(); }
function epTab(t) { EP.tab = t; epSideShow(); }
function epSideClose() { EP.side = false; try { localStorage.setItem('gp-vw-side', '0'); } catch (e) {} epSideShow(); }
function epSideShow() {
  const s = $('#epSide'); if (!s) return; s.hidden = !EP.side; $('#ep').classList.toggle('side', EP.side);
  ep$('.vwsb')?.classList.toggle('on', EP.side && EP.tab === 'ann'); ep$('.eptc')?.classList.toggle('on', EP.side && EP.tab === 'toc'); if (EP.side) epSideDraw();
  if (EP.paged && EP.secs.length) requestAnimationFrame(() => { const a = EP.anchor; epLayout(); if (a) epGoLoc(a, true); });
}
function epSideDraw() {
  const s = $('#epSide'), t = EP.tab;
  const tabs = [['ann', '💬 Anotaciones'], ['toc', '📑 Índice'], ...(EP.find.hits.length || t === 'find' ? [['find', `🔍 ${EP.find.hits.length || ''}`]] : [])];   // v39.50: resultados de la búsqueda
  const head = `<div class="vwst"><div class="vwstt" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${t === k}" class="${t === k ? 'on' : ''}${k === 'find' ? ' lntab' : ''}" data-onclick="epTab('${k}')">${n}</button>`).join('')}</div><button class="vwib" data-onclick="epSideClose()" aria-label="Cerrar el panel">✕</button></div>`;
  if (t === 'find') return lnEpFindDraw(s, head);
  if (t === 'toc') {
    const L = EP.bk?.toc || [], cur = epLoc().i;
    s.innerHTML = `${head}<div class="vwsl vwtoc"><ul>${L.length ? L.map((x, k) => `<li><button class="vwtl${x.i === cur ? ' on' : ''}" data-k="${k}" style="--d:${x.lv}" data-onclick="epTocGo(${k})"><span>${esc(x.t)}</span></button></li>`).join('')
      : EP.secs.map((_, i) => `<li><button class="vwtl${i === cur ? ' on' : ''}" style="--d:0" data-onclick="epGoSide(${i})"><span>Capítulo ${i + 1}</span></button></li>`).join('')}</ul></div>`;
    return s.querySelector('.vwtl.on')?.scrollIntoView({block: 'center'});
  }
  const all = annSorted(epAnns()), f = EP.filt || '', L = all.filter(a => !f || (f === 'cm' ? a.m : a.c === f));
  s.innerHTML = `${head}<div class="vwsh"><b>${all.length ? `${all.length} ${all.length === 1 ? 'subrayado' : 'subrayados'}` : 'Anotaciones'}</b></div>
    ${all.length ? `<div class="vwsf"><button class="${f ? '' : 'on'}" data-onclick="epFilt('')">Todas</button>${annFiltChips(all, f, 'epFilt')}<button class="${f === 'cm' ? 'on' : ''}" data-onclick="epFilt('cm')" title="Solo las que tienen comentario">💬</button></div>` : ''}
    <div class="vwsl">${L.length ? L.map(a => `<button class="vwi${EP.pop === a.id ? ' on' : ''}" style="--c:${a.c}" data-onclick="epPick('${a.id}')"><small>cap. ${a.p + 1}${epChTitle(a.p) ? ' · ' + esc(shortTxt(epChTitle(a.p)).slice(0, 60)) : ''}</small>${a.t ? `<span class="vwit">${esc(a.t.length > 220 ? a.t.slice(0, 220) + '…' : a.t)}</span>` : ''}${a.m ? `<span class="vwim">💬 ${esc(a.m.length > 300 ? a.m.slice(0, 300) + '…' : a.m)}</span>` : ''}</button>`).join('')
      : `<p class="empty">${all.length ? 'Ninguna con este filtro.' : 'Aún no hay subrayados. Selecciona texto y elige un color.'}</p>`}</div>
    ${all.length ? `<div class="vwsx vwexp"><small>${f ? 'Las del filtro' : 'Todas'}:</small><button data-onclick="epExpCopy()" title="Copiar al portapapeles">📋 Copiar</button>${EP.src?.kind === 'paper' ? `<button data-onclick="epExpNotes()" title="${f ? 'Añadirlas como nota nueva del paper' : 'Una nota «Anotaciones del EPUB» en el paper: si ya existe, se actualiza'}">📝 A las notas</button>` : ''}<button data-onclick="epExpMd()" title="Descargar como resumen en Markdown">⬇ .md</button></div>` : ''}`;
}
function epFilt(f) { EP.filt = f; epSideDraw(); }
function epPick(id) { if (vwMv()) epSideClose(); epPopOpen(id); }
function epTocGo(k) { const x = EP.bk?.toc[k]; if (!x) return; if (vwMv()) epSideClose(); lnEpGo(x.i, x.frag); }
function epGoSide(i) { if (vwMv()) epSideClose(); epGoLoc({i, f: 0}); }
function epTocCur() { const s = $('#epSide'); if (!EP.side || EP.tab !== 'toc' || !s) return; const cur = epLoc().i, L = EP.bk?.toc || [];
  s.querySelectorAll('.vwtl').forEach((b, k) => b.classList.toggle('on', L.length ? L[k]?.i === cur : k === cur)); }
const epExpList = () => { const f = EP.filt || ''; return epAnns().filter(a => !f || (f === 'cm' ? a.m : a.c === f)); };
const epPaperOf = () => EP.src?.kind === 'paper' ? db.papers.find(p => p.id === EP.src.id) : null;
async function epExpCopy() { const L = epExpList(); if (!L.length) return; await annCopy(annText(epPaperOf(), L, undefined, true)); toast(`${L.length} ${L.length === 1 ? 'anotación copiada' : 'anotaciones copiadas'}.`, [], 2000); }
function epExpNotes() {
  const P = epPaperOf(), L = epExpList(); if (!P || !L.length) return;
  if (!EP.filt) { if (annNoteSet(P, EP.src.n || 1, epAnns())) { P.modified = vwNow(); logChange(P, 'Anotaciones del EPUB a las notas'); markDirty(); } return toast('Nota «Anotaciones del EPUB» al día en el paper.', [{t: 'Deshacer', fn: undo}], 4000); }
  P.notes.push({id: uid(), sectionId: P.sectionIds?.[0] || db.sections[0]?.id || '', content: annText(P, L, undefined, true)}); P.modified = vwNow(); logChange(P, 'Anotaciones del EPUB a las notas'); markDirty();
  toast('Añadidas como nota nueva del paper.', [{t: 'Deshacer', fn: undo}], 4000);
}
function epExpMd() { const L = epExpList(); if (!L.length) return; const P = epPaperOf(), head = `# ${epTitle()}\n\n${P?.authors?.length ? P.authors.join('; ') + (P.year ? ` (${P.year})` : '') + '\n\n' : ''}`;
  download(head + annText(P, L, 'md', true) + '\n', (epTitle().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || 'anotaciones') + ' - anotaciones.md', 'text/markdown'); }

/* ---- Buscar en el libro (sin distinguir mayúsculas ni tildes) ---- */
const epFold = s => s.split('').map(c => (c.normalize('NFD')[0] || c).toLowerCase()[0] || c).join('');
function epFindToggle(on) { EP.findOpen = on ?? !EP.findOpen; $('#ep').classList.toggle('find', EP.findOpen); if (EP.findOpen) { $('#epQ').focus(); $('#epQ').select(); } else { epFindReset(true); $('#epScroll').focus({preventScroll: true}); } }
function epFindReset(clear) { const had = EP.find.hits.length; EP.find = {q: '', hits: [], i: -1}; $('#epQn').textContent = ''; if (had || clear) lnEpFindUi(); EP.secs.forEach(s => epUnwrap(s, 'epfh')); if (clear) $('#epQ').value = ''; }
function epFindKey(e) { if (e.key === 'Enter') { e.preventDefault(); epFind(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); epFindToggle(false); } }
function epFind(dir) {
  const q = epFold($('#epQ').value.trim()); if (!q) return;
  if (EP.find.q !== q) {
    epFindReset(); EP.find.q = q; if (!EP.fold.length) EP.fold = EP.secs.map(s => epFold(s.textContent));
    for (let i = 0; i < EP.fold.length && EP.find.hits.length < 2000; i++) { let k = -1; while ((k = EP.fold[i].indexOf(q, k + 1)) >= 0 && EP.find.hits.length < 2000) EP.find.hits.push({i, a: k, b: k + q.length}); }
    const here = epLoc(), hp = EP.cum[here.i] + here.f * EP.len[here.i]; EP.find.i = EP.find.hits.findIndex(h => EP.cum[h.i] + h.a >= hp) - (dir > 0 ? 1 : 0); if (EP.find.i < -1) EP.find.i = -1; lnEpFindUi();
  }
  const H = EP.find.hits; if (!H.length) { $('#epQn').textContent = 'Sin resultados'; return; }
  EP.find.i = (EP.find.i + dir + H.length) % H.length; $('#epQn').textContent = `${EP.find.i + 1} de ${H.length}${H.length >= 2000 ? '+' : ''}`; epFindMark();
}
function epFindMark() {
  const h = EP.find.hits[EP.find.i]; EP.secs.forEach(s => epUnwrap(s, 'epfh')); if (!h) return;
  epWrap(EP.secs[h.i], h.a, h.b, () => { const m = document.createElement('mark'); m.className = 'epfh'; return m; });
  epShow(EP.secs[h.i].querySelector('mark.epfh'));
}

/* ---- Marcadores: capítulo × 100 + % del capítulo (se guardan con el EPUB del paper: «bm») ---- */
const epBms = () => epHolders()[0]?.bm || [];
const epBmLoc = v => ({i: Math.floor(v / 100), f: (v % 100) / 100});
function epBmHere() {   // los marcadores que se ven ahora en la pantalla
  if (!EP.secs.length) return []; const sc = $('#epScroll'), x = epPos(), w = EP.paged ? EP.pw || sc.clientWidth : sc.clientHeight;
  return epBms().filter(v => { const l = epBmLoc(v); if (!EP.secs[l.i]) return false; const p = epLocPx(l); return p >= x - epBmTol(l.i) && p < x + w - 2; });
}
function epBmTol(i) { const st = epStarts(); return (epEnd(st, i) - st[i]) / 100 + 2; }   // el marcador guarda el % entero: hasta un 1 % del capítulo antes de donde se puso
function epBmShow() { const b = $('#epBmB'); if (b) b.classList.toggle('on', epBmHere().length > 0); }
function epBmSet(L) {
  const hs = epHolders(); if (!hs.length) return; L = bmClean(L);
  for (const h of hs) { if (L.length) h.bm = [...L]; else delete h.bm; if (EP.src.kind === 'inbox') h.up = vwNow(); }
  const P = EP.src.kind === 'paper' && db.papers.find(p => p.id === EP.src.id); if (P && hs.includes(P[pdfF(EP.src.n)])) P.modified = vwNow();
  markDirty(); epBmShow();
}
function epBmToggle() {
  if (!EP.secs.length) return; const here = epBmHere();
  if (here.length) { epBmSet(epBms().filter(v => !here.includes(v))); return toast('Marcador quitado.', [{t: 'Deshacer', fn: () => undo()}], 2500); }
  const l = epLoc(); if (l.i > 999) return toast('No se pueden poner marcadores después del capítulo 1000.', [], 3000);
  epBmSet([...epBms(), l.i * 100 + Math.min(99, Math.floor(l.f * 100))]); toast(`Marcador en el capítulo ${l.i + 1}.`, [{t: 'Deshacer', fn: () => undo()}], 2500);
}
function epBmStep(d) {
  const x = epPos(), L = epBms().map(v => ({v, p: epLocPx(epBmLoc(v))})).filter(o => EP.secs[epBmLoc(o.v).i]), w = EP.paged ? EP.pw : $('#epScroll').clientHeight;
  const t = d > 0 ? L.find(o => o.p >= x + w - 2) : [...L].reverse().find(o => o.p < x - epBmTol(epBmLoc(o.v).i)); if (!t) return toast(d > 0 ? 'No hay más marcadores después.' : 'No hay marcadores antes.', [], 1500);
  epGoLoc(epBmLoc(t.v));
}
function epBmGo(v) { epGoLoc(epBmLoc(v)); }
function epBmClear() { const n = epBms().length; if (!n) return; epBmSet([]); toast(`${n} ${n === 1 ? 'marcador quitado' : 'marcadores quitados'}.`, [{t: 'Deshacer', fn: () => undo()}], 4000); }
function epBmMenu() {
  const L = epBms();
  epMenu(EP.menuR, `<button data-keep data-onclick="epMoreBack()">‹ Volver</button><hr><button data-onclick="epBmToggle()">${epBmHere().length ? '🔖 Quitar el marcador de aquí' : '🔖 Marcar este punto'} <small class="vwsub">B</small></button>
    <button data-onclick="epBmStep(-1)" ${L.length ? '' : 'disabled'}>⬆ Marcador anterior <small class="vwsub">[</small></button><button data-onclick="epBmStep(1)" ${L.length ? '' : 'disabled'}>⬇ Marcador siguiente <small class="vwsub">]</small></button>
    ${L.length ? `<hr><div class="ctxh">${L.length} ${L.length === 1 ? 'marcador' : 'marcadores'}</div><div class="vwbml">${L.map(v => { const l = epBmLoc(v); return `<button data-onclick="epBmGo(${v})">🔖 Cap. ${l.i + 1}${epChTitle(l.i) ? ' · ' + esc(shortTxt(epChTitle(l.i)).slice(0, 50)) : ''} <small class="vwsub">${Math.round(l.f * 100)} %</small></button>`; }).join('')}</div><hr><button class="danger" data-onclick="epBmClear()">Quitar todos</button>` : '<div class="vwhint">Aún no hay marcadores.</div>'}`);
}

/* ---- Desplazamiento automático (modo seguido) y modo concentración: los mismos ajustes que el visor de PDF ---- */
function epAutoBar() {
  let b = $('#epAuto'); if (b) return b;
  ep$('.vwbody').insertAdjacentHTML('beforeend', `<div id="epAuto" class="vwfloat" role="toolbar" aria-label="Desplazamiento automático" hidden>
    <button class="vwib vwap" data-onclick="epAutoPause()" title="Pausa (barra espaciadora, o toque en el centro)" aria-label="Pausa">⏸</button>
    <button class="vwib" data-onclick="epAutoSpeed(-1)" title="Más despacio (toque a la izquierda)" aria-label="Más despacio">🐢</button>
    <input id="epAutoR" type="range" min="1" max="20" step="0.5" aria-label="Velocidad" data-oninput="epAutoSet(this.value)">
    <button class="vwib" data-onclick="epAutoSpeed(1)" title="Más deprisa (toque a la derecha)" aria-label="Más deprisa">🐇</button><span id="epAutoV"></span>
    <button class="vwib vwcb" data-onclick="epConcSet(!vwConcOn())" title="Modo concentración: oculta las barras mientras baja; un toque las saca (C)" aria-label="Modo concentración">🧘</button>
    <button class="vwib" data-onclick="epAutoStop()" title="Parar el desplazamiento automático" aria-label="Parar">✕</button></div>`);
  return $('#epAuto');
}
const epConcHidden = () => !!(EP.open && EP.auto && !EP.autoPaused && vwConcOn());
function epConcShow() { const d = $('#ep'); if (!d) return; const h = epConcHidden(); d.classList.toggle('conc', h); if (h) { const m = $('#epMenu'); if (m) m.hidden = true; epPopClose(); $('#epSel').hidden = true; } }
function epConcTap() { if (!epConcHidden()) return false; epAutoPause(true); return true; }
function epConcSet(on) { try { localStorage.setItem(VW_CONC_K, on ? '1' : '0'); } catch (e) {} if (on && !EP.auto) epAutoStart(); else epAutoShow(); if (on) toast('Modo concentración: toca la página para sacar las barras.', [], 2600); }
function epAutoShow() {
  epConcShow(); wlSync(); const b = epAutoBar(); b.hidden = !EP.auto; if (!EP.auto) return;
  b.querySelector('.vwcb').classList.toggle('on', vwConcOn()); $('#epAutoR').value = EP.autoLv; $('#epAutoV').textContent = vwAutoFmt(EP.autoLv); b.classList.toggle('paused', !!EP.autoPaused);
  const p = b.querySelector('.vwap'); p.textContent = EP.autoPaused ? '▶' : '⏸'; p.ariaLabel = EP.autoPaused ? 'Seguir' : 'Pausa';
}
function epAutoStart() {
  if (!EP.open || !EP.secs.length) return; const was = EP.paged;
  Object.assign(EP, {auto: true, autoPaused: false, autoHold: false, autoLv: vwAutoLv(), autoT: 0});
  if (was) { epSetApply(true); toast('El desplazamiento automático usa el modo seguido.', [], 2200); }
  EP.autoY = $('#epScroll').scrollTop; epAutoShow(); cancelAnimationFrame(EP.autoRaf); EP.autoRaf = requestAnimationFrame(epAutoTick);
}
function epAutoStop() { if (!EP.auto) return; EP.auto = false; cancelAnimationFrame(EP.autoRaf); epAutoShow(); if (epSet().mode === 'page') epSetApply(true); }
function epAutoPause(on) {
  if (!EP.auto) return; EP.autoPaused = on ?? !EP.autoPaused;
  if (!EP.autoPaused) { const sc = $('#epScroll'); EP.autoY = sc.scrollTop; EP.autoT = 0; if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) EP.autoPaused = true; }
  epAutoShow();
}
function epAutoSet(v) { EP.autoLv = vwAutoR(v); try { localStorage.setItem(VW_AUTO_K, EP.autoLv); } catch (e) {} epAutoShow(); }
function epAutoSpeed(d) { epAutoSet((EP.auto ? EP.autoLv : vwAutoLv()) + d / 2); toast(`Velocidad ${vwAutoFmt(EP.autoLv)} de 20`, [], 900); }
function epAutoTick(t) {   // la velocidad va en líneas: con letra más grande, más píxeles por segundo
  if (!EP.auto || !EP.open) return; EP.autoRaf = requestAnimationFrame(epAutoTick);
  const dt = EP.autoT ? Math.min(.1, (t - EP.autoT) / 1000) : 0; EP.autoT = t; if (EP.autoPaused || EP.autoHold || !dt) return;
  const sc = $('#epScroll'); if (Math.abs(sc.scrollTop - EP.autoY) > 3) EP.autoY = sc.scrollTop;
  EP.autoY += vwAutoPts(EP.autoLv) * 1.6 * epSet().fs / 19 * dt; sc.scrollTop = EP.autoY;
  if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) { epAutoPause(true); toast('Final del libro.', [], 1500); }
}

/* ---- Menús, pantalla completa, teclado ---- */
function epMenu(r, html) {
  let m = $('#epMenu'); if (!m) { m = document.createElement('div'); m.id = 'epMenu'; m.className = 'vwfloat vwmenu'; $('#ep').append(m); m.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && !b.hasAttribute('data-keep')) setTimeout(() => m.hidden = true); }); }
  m.innerHTML = html; m.hidden = false; const w = m.offsetWidth; r ||= {right: innerWidth - 8, bottom: 52}; m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; m.style.top = (r.bottom + 4) + 'px';
  m.style.maxHeight = `calc(100dvh - ${Math.round(r.bottom + 12)}px)`; m.style.overflow = 'auto';
  setTimeout(() => document.addEventListener('pointerdown', ev => { if (!m.contains(ev.target)) m.hidden = true; }, {once: true, capture: true}));
}
function epMore(e) {
  e?.stopPropagation?.(); if (e?.currentTarget) EP.menuR = e.currentTarget.getBoundingClientRect(); const s = epSet(), P = epPaperOf();
  const mode = (EP.auto ? 'Automático' : s.mode === 'page' ? (s.two ? 'Doble página' : 'Página a página') : 'Seguido');
  epMenu(EP.menuR, `<button data-keep data-onclick="epReadMenu()">📖 Modo de lectura <small class="vwsub">${mode} ›</small></button><button data-keep data-onclick="epTypoMenu()">Aa Texto y colores <small class="vwsub">›</small></button><button data-keep data-onclick="epBmMenu()">🔖 Marcadores <small class="vwsub">${epBms().length || 'ninguno'} ›</small></button><button data-keep data-onclick="epCfgMenu()">⚙ Ajustes del visor <small class="vwsub">›</small></button>
    <hr>${epCanShare() ? '<button data-onclick="epShare()">📲 Abrir en otra app…</button>' : ''}<button data-onclick="epDownload()">⬇ Descargar el EPUB</button>
    ${P && !$('#dlg').open ? '<button data-onclick="epFicha()">📝 Ficha del paper</button>' : ''}${EP.src?.kind === 'inbox' ? '<button data-onclick="epCite()">＋ Crear la cita de este EPUB</button>' : ''}
    <hr><button data-onclick="cmdOpen(true)">🔎 Buscar una orden… <small class="vwsub">${esc(db.settings.shortcuts.palette || '')}</small></button>
    ${EP.bk ? `<hr><div class="vwhint">${esc(EP.bk.meta.title || '')}${EP.bk.meta.authors.length ? ' · ' + esc(EP.bk.meta.authors.slice(0, 3).join('; ')) : ''}${EP.bk.meta.year ? ' · ' + esc(EP.bk.meta.year) : ''} · ${EP.secs.length} ${EP.secs.length === 1 ? 'capítulo' : 'capítulos'}</div>` : ''}`);
}
function epMoreBack() { epMore(); }
function epCfgMenu() { epMenu(EP.menuR, vwCfgHtml(true)); }
function epReadMenu() {
  const s = epSet(), o = (on, fn, t, k) => `<button data-onclick="${fn}">${tick(on)}${t}${k ? ` <small class="vwsub">${k}</small>` : ''}</button>`;
  epMenu(EP.menuR, `<button data-keep data-onclick="epMoreBack()">‹ Volver</button><hr>
    ${o(!EP.auto && s.mode === 'scroll', "epMode('scroll')", '↕ Seguido (desplazar)', '')}${o(!EP.auto && s.mode === 'page' && !s.two, "epMode('page')", '📄 Página a página, con toques a los lados', 'P')}${o(!EP.auto && s.mode === 'page' && s.two, "epMode('two')", '📖 Doble página', 'D')}
    ${!EP.auto && s.mode === 'page' && s.two ? `${o(!s.one, "epSetPut('one',false)", '⏩ Pasar de dos en dos', '')}${o(s.one, "epSetPut('one',true)", '↪ Pasar de una en una (la derecha pasa a la izquierda)', '')}` : ''}
    <div class="vwhint">Página a página: toca a la izquierda o a la derecha (o desliza, o ← →) para pasar. La doble página necesita una pantalla ancha.</div><hr>
    <button data-onclick="${EP.auto ? 'epAutoStop()' : 'epAutoStart()'}">${EP.auto ? '⏹ Parar el desplazamiento automático' : '⏬ Desplazamiento automático'} <small class="vwsub">A</small></button>
    <button data-onclick="epConcSet(${vwConcOn() ? 0 : 1})">${tick(vwConcOn())}🧘 Modo concentración <small class="vwsub">C</small></button>${sayCan() ? '<hr>' + sayMenuBtn(true) : ''}`);
}
function epMode(m) { if (EP.auto) epAutoStop(); const o = epSet(); o.mode = m === 'scroll' ? 'scroll' : 'page'; o.two = m === 'two'; try { localStorage.setItem(EP_SET_K, JSON.stringify(o)); } catch (e) {} epSetApply(true); }
function epFicha() { const p = epPaperOf(); if (p) openPaper(p.id); }
function epNotes() { const p = epPaperOf(); if (!p) return; epSaveComment(); openPaper(p.id); tab = 'notes'; drawD(); }
function epCite() { const s = EP.src; epClose(); setTimeout(() => inboxCite(s.id), 50); }
function epFs(on) {
  on = !!on; if (!EP.open || !!EP.fs === on) return; EP.fs = on; $('#ep').classList.toggle('fs', on);
  try { if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch (e) {}
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && EP.fs) epFs(false); });
function epEsc() {
  if (epConcTap()) return;
  const m = $('#epMenu'); if (m && !m.hidden) { m.hidden = true; return; }
  if (lnShown()) return lnClose();
  if (SAY.on && SAY.ep) return sayStop();
  if (!$('#epPop').hidden) return epPopClose();
  if (!$('#epSel').hidden) { getSelection().removeAllRanges(); $('#epSel').hidden = true; return; }
  if (EP.findOpen) return epFindToggle(false);
  if (EP.fs) return epFs(false);
  if (EP.side && vwMv()) return epSideClose();
  epClose();
}
const EP_KEYS = {
  ArrowRight: ['Página siguiente (página a página)', () => EP.paged ? epStep(1) : false], ArrowLeft: ['Página anterior', () => EP.paged ? epStep(-1) : false],
  PageDown: ['Pantalla siguiente', () => epStep(1)], PageUp: ['Pantalla anterior', () => epStep(-1)],
  ' ': ['Pausa del automático, o pantalla siguiente', () => EP.auto ? epAutoPause() : epStep(1)],
  '+': ['Letra más grande', () => epFontBy(1)], '-': ['Letra más pequeña', () => epFontBy(-1)],
  b: ['Marcar o quitar este punto', () => epBmToggle()], '[': ['Marcador anterior', () => epBmStep(-1)], ']': ['Marcador siguiente', () => epBmStep(1)],
  i: ['Índice', () => epPanel('toc')], l: ['Anotaciones', () => epPanel('ann')], e: ['Notas del paper', () => epNotes()], f: ['Pantalla completa', () => epFs(!EP.fs)],
  p: ['Página a página o seguido', () => epMode(epSet().mode === 'page' && !epSet().two ? 'scroll' : 'page')], d: ['Doble página', () => epMode(epSet().two && epSet().mode === 'page' ? 'page' : 'two')],
  a: ['Desplazamiento automático', () => EP.auto ? epAutoStop() : epAutoStart()], c: ['Modo concentración', () => epConcSet(!vwConcOn())],
  ArrowUp: ['Más deprisa (automático)', () => EP.auto ? epAutoSpeed(1) : false], ArrowDown: ['Más despacio (automático)', () => EP.auto ? epAutoSpeed(-1) : false],
  '?': ['Esta lista de atajos', () => epKeysHelp()]
};
function epKey(e) {
  if (!EP.open) return; const inText = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable, mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); return epFindToggle(true); }
  if (mod && e.key.toLowerCase() === 'z' && !inText) { e.preventDefault(); return epUndo(); }
  if (e.altKey && e.key === 'ArrowLeft' && LN.ep.length && !inText) { e.preventDefault(); return lnEpBack(); }
  if (inText || mod || e.altKey) return;
  const k = EP_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
  if (k[1]() !== false) e.preventDefault();
}
document.addEventListener('keydown', e => { if (EP.open && (e.target === document.body || e.target === document.documentElement)) epKey(e); });
function epKeysHelp() {
  const nm = {ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', PageDown: 'AvPág', PageUp: 'RePág', ' ': 'Espacio'};
  epMenu(EP.menuR, `<button data-keep data-onclick="epMoreBack()">‹ Volver</button><hr><table class="vwkeys">${[...Object.entries(EP_KEYS).map(([k, [t]]) => [`<kbd>${esc(nm[k] || k.toUpperCase())}</kbd>`, t]), ['<kbd>Ctrl</kbd>+<kbd>F</kbd>', 'Buscar'], ['<kbd>Ctrl</kbd>+<kbd>Z</kbd>', 'Deshacer'], ['<kbd>Esc</kbd>', 'Cerrar']].map(([k, t]) => `<tr><td>${k}</td><td>${esc(t)}</td></tr>`).join('')}</table>`);
}
