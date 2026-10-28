'use strict';
/* ===== Lista principal ===== */
const chip = (t, on, click, drag, ctx, n) => `<span class="chip ${on === 'ex' ? 'ex' : on ? 'on' : ''}" style="--c:${esc(t.color || '#888888')}" ${click ? `data-onclick="${click}"` : ''} ${drag ? `draggable="true" data-tag="${t.id}"` : ''} ${ctx ? `data-oncontextmenu="${ctx}"` : ''}>${esc(t.name)}${n != null ? ` <small class="cn">${n}</small>` : ''}</span>`;   // on = 'ex': etiqueta excluida · n: cuántos papers
const BYID = new WeakMap();   // índice por id de una lista (etiquetas, secciones); dura hasta acabar la tarea en curso, así nunca queda desfasado
const byId = arr => { let m = BYID.get(arr); if (!m || m.n !== arr.length) { m = new Map(arr.map(x => [x.id, x])); m.n = arr.length; BYID.set(arr, m); queueMicrotask(() => BYID.delete(arr)); } return m; };
const tagById = i => byId(db.tags).get(i), secById = i => byId(db.sections).get(i);
const secChips = id => (secById(id)?.tagIds || []).map(tagById).filter(Boolean).map(t => chip(t, 1)).join('');
const hdr = () => syIcon();   // syIcon también redibuja el estado de guardado
function fnameDraw() {   // un único indicador de guardado, junto al nombre del proyecto
  const el = $('#fname'), f = path ? path.split(/[\\/]/).pop() : '', on = syOn(), s = on ? syState() : '';
  const T = !on ? (dirty ? ['pend', 'Sin guardar'] : path ? ['ok', 'Guardado'] : ['', '(sin archivo)'])
    : {busy: ['busy', 'Sincronizando…'], wait: ['pend', 'Cierra la ventana abierta para sincronizar'], reconnect: ['err', 'Sin conexión con Drive: se reconecta con tu próximo clic'], error: ['err', 'No se pudo sincronizar (se reintenta)'],
       pend: ['pend', 'Sin guardar…'], manual: ['pend', 'Sin guardar (autoguardado en Drive desactivado)'], ok: ['ok', 'Guardado en Google Drive']}[s] || ['', ''];
  el.dataset.st = T[0]; el.textContent = T[1] + (db.settings.showFile && f && T[1] !== '(sin archivo)' ? ' · ' + f : '');
}
const COLL = new Intl.Collator('es');   // igual que localeCompare(…, 'es'), pero sin crear el comparador en cada llamada
function sortList(L) {   // ordena por todos los criterios, en cascada; d = 1 ascendente, -1 descendente
  const S = F.sorts, K = L.map(p => ({p, k: S.map(s => KEY[s.k](p))}));   // cada clave se calcula una vez por paper, no en cada comparación
  return K.sort((a, b) => { for (let i = 0; i < S.length; i++) { const {k, d} = S[i], x = a.k[i], y = b.k[i];
    if (k === 'rating' && !x !== !y) return x ? -1 : 1;   // sin valorar: siempre al final, en ambos sentidos
    const c = typeof x === 'number' ? x - y : COLL.compare(x, y); if (c) return c * d; } return 0; }).map(e => e.p);
}
const has = (p, t) => p.tagIds.includes(t);   // las etiquetas son independientes de las secciones
const SEARCH = new WeakMap();   // texto de búsqueda ya normalizado de cada paper: solo se recalcula si cambia
function searchTxt(p) {
  const raw = [p.title, p.alias, p.year, ...p.authors, ...(F.inNotes ? [p.general, ...p.notes.map(n => n.content), ...Object.values(p.cites)] : [])].join(' ');
  let c = SEARCH.get(p); if (!c || c.raw !== raw) SEARCH.set(p, c = {raw, n: norm(raw)}); return c.n;
}
function visible() {
  const q = norm(F.q);
  return sortList(db.papers.filter(p => (!q || searchTxt(p).includes(q))
    && (!F.sec || p.sectionIds.includes(F.sec)) && (!F.read || p.reading === F.read) && p.rating >= F.minRating && (!F.tags.size || [...F.tags][F.mode === 'all' ? 'every' : 'some'](t => has(p, t)))
    && (!F.noSec || !p.sectionIds.some(secById)) && (!F.noTag || !p.tagIds.some(tagById)) && (!F.exTags.size || ![...F.exTags].some(t => has(p, t)))
    && (!F.yFrom || +p.year >= F.yFrom) && (!F.yTo || (+p.year > 0 && +p.year <= F.yTo))));
}
/* ---- Filtros: resumen de lo aplicado, contadores y estado ---- */
const fYears = () => F.yFrom && F.yTo ? `${F.yFrom}–${F.yTo}` : F.yFrom ? `desde ${F.yFrom}` : `hasta ${F.yTo}`;
function actList() {   // filtros aplicados, cada uno con su forma de quitarlo
  const A = [];
  if (F.q) A.push(['🔍 «' + F.q + '»', "fClr('q')"]);
  if (F.sec && secById(F.sec)) A.push(['📁 ' + secById(F.sec).name, "fClr('sec')"]);
  if (F.noSec) A.push(['📁 Sin sección', "fClr('noSec')"]);
  F.tags.forEach(t => tagById(t) && A.push(['🏷️ ' + tagById(t).name, `fClr('tag','${t}')`]));
  F.exTags.forEach(t => tagById(t) && A.push(['🚫 ' + tagById(t).name, `fClr('ex','${t}')`]));
  if (F.noTag) A.push(['🏷️ Sin etiquetas', "fClr('noTag')"]);
  if (F.read) A.push(['📖 ' + READ[F.read], "fClr('read')"]);
  if (F.minRating) A.push(['★ ≥ ' + F.minRating, "fClr('min')"]);
  if (F.yFrom || F.yTo) A.push(['📅 ' + fYears(), "fClr('years')"]);
  return A;
}
function fClr(k, id) {
  if (k === 'q') { F.q = ''; $('#q').value = ''; } else if (k === 'sec') F.sec = ''; else if (k === 'tag') F.tags.delete(id); else if (k === 'ex') F.exTags.delete(id);
  else if (k === 'read') F.read = ''; else if (k === 'min') F.minRating = 0; else if (k === 'years') F.yFrom = F.yTo = 0; else F[k] = false;
  render();
}
function fClrAll() { F.q = ''; $('#q').value = ''; F.sec = ''; F.tags.clear(); F.exTags.clear(); F.noSec = F.noTag = false; F.read = ''; F.minRating = 0; F.yFrom = F.yTo = 0; render(); }
function actDraw() {
  const A = actList(), el = $('#actF'); el.hidden = !A.length;
  el.innerHTML = A.length ? `<small>Filtros:</small>${A.map(([t, c]) => `<button class="af" data-onclick="${c}" title="Quitar este filtro">${esc(t)} <b>✕</b></button>`).join('')}<button class="afx" data-onclick="fClrAll()">Limpiar todo</button>` : '';
  $('#d-filt').hidden = !A.some(([, c]) => c !== "fClr('q')");
}
const fExtra = () => ({exTags: [...F.exTags], noTag: F.noTag, noSec: F.noSec, yFrom: F.yFrom, yTo: F.yTo});   // lo que guardan el estado de la interfaz y los filtros guardados
function fExtraLoad(f) {   // lo guardado se valida: una etiqueta borrada o un año raro se ignoran
  const yr = v => Number.isInteger(v) && v > 0 && v < 10000 ? v : 0;
  F.exTags = new Set((Array.isArray(f.exTags) ? f.exTags : []).filter(id => typeof id === 'string' && db.tags.some(t => t.id === id)));
  F.noTag = !!f.noTag; F.noSec = !!f.noSec; F.yFrom = yr(f.yFrom); F.yTo = yr(f.yTo);
}
function setYears() { const v = id => { const n = Math.trunc(+$(id).value); return n > 0 && n < 10000 ? n : 0; }; const a = v('#yFrom'), b = v('#yTo'); if (a === F.yFrom && b === F.yTo) return; F.yFrom = a; F.yTo = b; render(); }   // sin cambios no repinta (el clic que quitó el foco sigue funcionando)
let TQ = '';   // texto para buscar entre las etiquetas de la barra
function tagQSet(v) { TQ = v; tagQDraw(); }
function tagQDraw() {
  const q = norm(TQ), inp = $('#tagQ'); inp.hidden = db.tags.length < 6; if (inp.hidden) TQ = '';
  document.querySelectorAll('#tagF .chip[data-tag]').forEach(c => { c.hidden = !!TQ && !norm(tagById(c.dataset.tag)?.name || '').includes(q); });
}
function tagFMenu(e, id) {   // clic derecho en una etiqueta de los filtros: incluirla, excluirla o quitarla
  const st = F.tags.has(id) ? 'in' : F.exTags.has(id) ? 'ex' : '';
  ctxShow(e, `<div class="ctxh">Etiqueta «${esc(tagById(id)?.name)}»</div>` + [['in', 'Solo papers con esta etiqueta'], ['ex', 'Ocultar papers con esta etiqueta'], ['', 'Sin filtrar por ella']]
    .map(([k, v]) => `<button data-onclick="ctxClose();tagFSet('${id}','${k}')">${tick(st === k)}${v}</button>`).join(''));
}
function tagFSet(id, k) { F.tags.delete(id); F.exTags.delete(id); if (k === 'in') { F.tags.add(id); F.noTag = false; } else if (k === 'ex') F.exTags.add(id); render(); }
function filtDraw() {   // chips de Secciones, Etiquetas y Lectura, con cuántos papers tiene cada uno
  const cS = new Map(), cT = new Map(), cR = {por_leer: 0, leyendo: 0, leido: 0}; let nS = 0, nT = 0;
  db.papers.forEach(p => { let s = 0, t = 0; p.sectionIds.forEach(i => { if (secById(i)) { s = 1; cS.set(i, (cS.get(i) || 0) + 1); } }); p.tagIds.forEach(i => { if (tagById(i)) { t = 1; cT.set(i, (cT.get(i) || 0) + 1); } });
    nS += !s; nT += !t; cR[p.reading in cR ? p.reading : 'por_leer']++; });
  const N = db.papers.length;
  const secC = side => [{name: 'Todas', color: '#888888'}, ...db.sections].map(x => (x.id ? `<span class="cw" data-sec="${x.id}">` : '') + chip(x, x.id ? F.sec === x.id : !F.sec && !F.noSec, `setSecF('${x.id || ''}')`, 0, `svOpen('${x.id || ''}',event)`, side ? x.id ? cS.get(x.id) || 0 : N : null) + (x.id ? '</span>' : '')).join('')   // data-sec: soltar un paper aquí le pone la sección
    + (side && db.sections.length ? chip({name: 'Sin sección', color: '#888888'}, F.noSec, 'noSecF()', 0, '', nS) : '');
  const tagC = side => db.tags.length ? chip({name: 'Todas', color: '#888888'}, !F.tags.size && !F.exTags.size && !F.noTag, 'tagsAll()', 0, '', side ? N : null)
    + db.tags.map(t => chip(t, F.exTags.has(t.id) ? 'ex' : F.tags.has(t.id), `toggleF('${t.id}')`, 1, `tagFMenu(event,'${t.id}')`, side ? cT.get(t.id) || 0 : null)).join('')
    + (side ? chip({name: 'Sin etiquetas', color: '#888888'}, F.noTag, 'noTagF()', 0, '', nT) : '') : '<small>Aún no hay etiquetas.</small>';   // en la fila de arriba, sin contadores ni «Sin …», para que quepa
  const modeSel = `<select class="mode" title="Cómo combinar varias etiquetas" data-onchange="put(F,'mode',this.value,render)"><option value="any" ${F.mode === 'any' ? 'selected' : ''}>Al menos una etiqueta</option><option value="all" ${F.mode === 'all' ? 'selected' : ''}>Todas las etiquetas</option></select>`;
  $('#secF').innerHTML = secC(1); $('#secF2').innerHTML = secC(0);
  $('#tagF').innerHTML = tagC(1) + modeSel; $('#tagF2').innerHTML = tagC(0); tagQDraw();
  $('#readF').innerHTML = [['', 'Todos'], ...Object.entries(READ)].map(([k, v]) => chip({name: v, color: k ? READ_C[k] : '#888888'}, F.read === k, `setRead('${k}')`, 0, '', k ? cR[k] : N)).join('');
  const rp = $('#readP'); rp.hidden = !N; rp.innerHTML = N ? ['leido', 'leyendo'].map(k => `<i style="width:${cR[k] / N * 100}%;background:${READ_C[k]}"></i>`).join('') : '';
  rp.title = `Progreso de lectura: ${cR.leido} leídos, ${cR.leyendo} leyendo y ${cR.por_leer} por leer, de ${N}`;
  $('#minR').value = F.minRating; $('#yFrom').value = F.yFrom || ''; $('#yTo').value = F.yTo || '';
  actDraw(); favDraw(); recDraw();
}
const tagsOf = p => p.tagIds.map(tagById).filter(Boolean).map(t => chip(t, 1, '', 0, `tagMenu(event,'${p.id}','${t.id}')`)).join('');
const EXP = new Set();   // papers con las notas desplegadas en la lista
const notesHTML = (p, hl) => `<div class="nts">${p.notes.filter(n => n.content.trim()).map(n => { const s = secById(n.sectionId);
  return `<div class="nt${n.id === hl ? ' hl' : ''}">${s ? chip(s, 1) : '<span class="chip on" style="--c:#888888">Sin sección</span>'}<div class="ntx md">${md(n.content)}</div></div>`; }).join('') || '<small>Este paper no tiene notas.</small>'}</div>`;
function toggleNotes(id) { EXP.has(id) ? EXP.delete(id) : EXP.add(id); renderPaper(id); }
/* ---- Imagen del paper ---- */
const PEND = new Map(), IMG_URL = new Map();   // PEND: archivos elegidos en el borrador aún sin guardar · IMG_URL: URLs de objeto de los archivos enlazados
const imgInner = i => !i ? '🖼️' : i.kind === 'url' ? `<img src="${esc(i.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerror="imgErr(this)">`
  : i.kind === 'data' ? `<img src="${i.data}" alt="">` : '🖼️';
const pimgHTML = (p, cls, attrs = '') => `<div class="pimg ${cls}" ${p.image?.kind === 'file' ? `data-fpid="${p.id}" title="Imagen enlazada: ${esc(p.image.name)}"` : ''} ${attrs}>${imgInner(p.image)}</div>`;
const thumbHTML = (p, cls) => p.image && db.settings.showImg !== false ? pimgHTML(p, cls) : '';
async function fileImgUrl(pid, ask) {   // archivo local enlazado: el navegador puede pedir permiso de lectura en cada sesión
  const h = PEND.get(pid) || await idb('readonly', st => st.get('img:' + pid)).catch(() => null); if (!h) return null;
  let perm = await h.queryPermission({mode: 'read'}); if (perm !== 'granted' && ask) perm = await h.requestPermission({mode: 'read'});
  if (perm !== 'granted') return null;
  const u = URL.createObjectURL(await h.getFile()); URL.revokeObjectURL(IMG_URL.get(pid)); IMG_URL.set(pid, u); return u;
}
function hydrateImgs(ask, only) {
  document.querySelectorAll('.pimg[data-fpid]').forEach(el => { if (only && el !== only) return;
    fileImgUrl(el.dataset.fpid, ask).then(u => { el.classList.toggle('locked', !u); if (u) el.innerHTML = `<img src="${u}" alt="">`; else el.title = 'Imagen enlazada: pulsa para dar acceso al archivo (o vuelve a elegirla en Datos)'; }).catch(() => el.classList.add('locked')); });
}
document.addEventListener('click', e => { const el = e.target.closest?.('.pimg.locked[data-fpid]:not(.big)'); if (el) { e.stopPropagation(); hydrateImgs(true, el); } }, true);
const FILE_IMG_T = [{description: 'Imágenes', accept: {'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']}}];
function imgBox() { $('#dlg .pimgbox') && ($('#dlg .pimgbox').innerHTML = pimgHTML(D, 'big', `role="button" tabindex="0" data-onclick="imgOpen()" title="Añadir o cambiar la imagen"`)); hydrateImgs(); }
function imgOpen() {
  const i = D.image;
  $('#img').innerHTML = `<div class="dh"><h2>Imagen del paper</h2><div class="dbtn"><button data-onclick="$('#img').close()">Cerrar</button></div></div>
    <div class="pimgprev">${pimgHTML(D, 'big')}</div>
    <div class="pastez" tabindex="0">📋 Pega aquí una imagen copiada (Ctrl+V), p. ej. con «Copiar imagen» en Google Imágenes</div>
    <label>URL de la imagen<span class="row" style="flex-wrap:nowrap"><input id="imgUrl" type="url" placeholder="https://…" style="flex:1;min-width:0" value="${i?.kind === 'url' ? esc(i.url) : ''}" data-onkeydown="onEnter(event,imgSetUrl)"><button class="pri" data-onclick="imgSetUrl()">Usar</button></span></label>
    <div class="row" style="margin-top:8px"><button data-onclick="imgPickLinked()" ${FSA ? '' : 'disabled'} title="${FSA ? 'No se copia: se guarda solo el nombre y el enlace queda en este navegador' : 'Solo disponible en Chrome o Edge de escritorio'}">📎 Archivo local (enlazado)</button>
    <button data-onclick="imgPickEmbed()" title="Guarda una copia reducida dentro del JSON: viaja con el archivo">📥 Incrustar copia reducida</button><button class="danger" data-onclick="imgClear()" ${i ? '' : 'disabled'}>Quitar imagen</button></div>
    <small>Enlazada: no ocupa espacio en el JSON, pero solo se ve en el navegador donde la elegiste (puede pedir permiso al abrir). Incrustada: una copia pequeña (máx. 480 px) que se ve en cualquier sitio.</small>`;
  hydrateImgs(); $('#img').showModal();
}
function imgSet(v) { D.image = v; imgBox(); if ($('#img').open) imgOpen(); }
function imgSetUrl() { const u = $('#imgUrl').value.trim(); if (!u) return imgClear(); if (!/^https?:\/\//i.test(u)) return alert('La URL debe empezar por http:// o https://'); PEND.delete(D.id); imgSet({kind: 'url', url: u}); }
function imgClear() { PEND.delete(D.id); imgSet(null); }
async function imgPickLinked() { try { const [h] = await showOpenFilePicker({types: FILE_IMG_T}); PEND.set(D.id, h); imgSet({kind: 'file', name: h.name}); } catch (e) { if (e.name !== 'AbortError') alert('No se pudo elegir el archivo: ' + e.message); } }
async function imgEmbedBlob(f) {   // copia reducida (máx. 480 px, JPEG) para guardarla dentro del JSON
  const b = await createImageBitmap(f), k = Math.min(1, 480 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b.width * k)); c.height = Math.max(1, Math.round(b.height * k)); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  PEND.delete(D.id); imgSet({kind: 'data', data: c.toDataURL('image/jpeg', .82)});
}
function imgPickEmbed() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { const f = i.files[0]; if (f) try { await imgEmbedBlob(f); } catch (e) { alert('No se pudo leer la imagen: ' + e.message); } };
  i.click();
}
function imgFromClipboard(e, inField) {   // imagen copiada (p. ej. «Copiar imagen» en Google Imágenes): archivo, <img> en el HTML o, fuera de un campo, una URL suelta
  const dt = e.clipboardData; if (!dt || !D) return false;
  const file = [...dt.files].find(f => /^image\//.test(f.type));
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(dt.getData('text/html') || ''), txt = (dt.getData('text/plain') || '').trim();
  const u = m ? m[1].replace(/&amp;/g, '&') : !inField && /^https?:\/\/\S+$/i.test(txt) ? txt : '';
  if (!file && !/^(https?:|data:image\/)/i.test(u)) return false;
  e.preventDefault();
  if (file) imgEmbedBlob(file).catch(err => alert('No se pudo leer la imagen: ' + err.message));
  else if (u.startsWith('data:')) fetch(u).then(r => r.blob()).then(imgEmbedBlob).catch(err => alert('No se pudo leer la imagen: ' + err.message));
  else { PEND.delete(D.id); imgSet({kind: 'url', url: u}); }
  return true;
}
document.addEventListener('paste', e => {
  const t = e.target, field = !!t.closest?.('input,textarea,[contenteditable]');
  if (t.closest?.('.ned')) return;
  if (t.closest?.('#img') || ($('#dlg').open && $('#dlg .pimgbox') && !$('#img').open)) imgFromClipboard(e, field);
});
const starsHTML = p => `<span class="stv${p.rating ? '' : ' none'}" data-oncontextmenu="starMenu(event,'${p.id}')" title="Valoración ${p.rating} de 5 · Clic derecho: cambiar">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span>`;
const rdHTML = p => `<span class="rd"><button class="rst" style="--c:${READ_C[p.reading]}" title="Clic: cambiar el estado de lectura" data-onclick="cycleRead('${p.id}')">${READ[p.reading]}</button>${starsHTML(p)}</span>`;
function starMenu(e, id) { ctxShow(e, '<div class="ctxh">Valoración</div>' + [5, 4, 3, 2, 1, 0].map(n => `<button data-onclick="setRating('${id}',${n})">${n ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'Sin valorar'}</button>`).join('')); }
function setRating(id, n) { const p = db.papers.find(x => x.id === id); ctxClose(); if (!p || p.rating === n) return; logChange(p, `Valoración: ${p.rating || '—'} → ${n || '—'}`); p.rating = n; markDirty(); renderPaper(id); }
const card = (p, from) => `<article class="card" data-id="${p.id}" draggable="true" ${F.group ? `data-from="${from || ''}"` : ''}><div class="ct"><label class="sel"><input type="checkbox" ${SEL.has(p.id) ? 'checked' : ''} data-onchange="toggleSel('${p.id}')"> Seleccionar</label><button class="sm" data-onclick="openPaper('${p.id}')">Editar</button><button class="sm cpb" data-onclick="copyCardCite('${p.id}',this)" title="Copiar la cita (estilo elegido en Exportar), con cursiva al pegar en Word">📋</button>${p.pdf ? `<button class="sm" data-onclick="pdfOpen('${p.id}')" title="Abrir el PDF enlazado: ${esc(p.pdf.name)}">📄 PDF</button>` : ''}${p.tagIds.length ? `<span class="tl">${tagsOf(p)}</span>` : ''}${rdHTML(p)}<button class="x" title="Eliminar" data-onclick="delPaper('${p.id}')">✕</button></div><div class="th">${thumbHTML(p, 'sm')}<h3>${esc(p.alias || p.title)}</h3></div>${p.alias ? `<div class="sub">${esc(p.title)}</div>` : ''}
    <div class="au"><span>${esc(p.authors.join('; '))} ${p.year ? '(' + esc(p.year) + ')' : ''}</span></div>
    ${/^https?:/i.test(p.url) ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : ''}
    
    <div class="row"><button class="sm" data-onclick="toggleNotes('${p.id}')" data-oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar notas · Clic derecho: abrir el visor de notas">Notas (${p.notes.filter(n => n.content.trim()).length}) ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" data-onclick="viewRel('${p.id}')" title="Relaciones: relacionados, cita a y citado por">🔗 ${relCount(p)}</button>` : ''}</div>${EXP.has(p.id) ? notesHTML(p) : ''}</article>`;
const TH = [[null, ''], ['title', 'Título'], ['author', 'Autores'], ['year', 'Año'], ['venue', 'Revista / editorial'], ['reading', 'Lectura'], ['rating', '★'], [null, 'Secciones'], [null, 'Etiquetas'], [null, 'Notas'], [null, '']];
function thSort(k) {   // clic en una cabecera: ese criterio pasa a ser el principal; otro clic invierte el sentido
  F.sorts = F.sorts[0]?.k === k ? [{k, d: -F.sorts[0].d}, ...F.sorts.slice(1)] : [{k, d: 1}, ...F.sorts.filter(x => x.k !== k).slice(0, 2)]; render();
}
const rowHTML = (p, from) => `<tr class="rw" data-id="${p.id}" draggable="true" ${F.group ? `data-from="${from || ''}"` : ''}>
  <td><input type="checkbox" aria-label="Seleccionar" ${SEL.has(p.id) ? 'checked' : ''} data-onchange="toggleSel('${p.id}')"></td>
  <td class="timg">${thumbHTML(p, 'xs')}</td>
  <td class="tt"><a class="tl2" data-onclick="openPaper('${p.id}')" title="Editar">${esc(p.alias || p.title)}</a></td><td>${esc(p.authors.join('; '))}</td><td>${esc(p.year)}</td><td>${esc(p.venue)}</td>
  <td><button class="rst" style="--c:${READ_C[p.reading]}" title="Clic: cambiar el estado de lectura" data-onclick="cycleRead('${p.id}')">${READ[p.reading]}</button></td><td>${starsHTML(p)}</td>
  <td>${p.sectionIds.map(secById).filter(Boolean).map(s => chip(s, 1)).join('')}</td><td>${tagsOf(p)}</td>
  <td class="nw"><button class="sm cpb" data-onclick="copyCardCite('${p.id}',this)" title="Copiar la cita (estilo elegido en Exportar), con cursiva al pegar en Word">📋</button>${p.pdf ? `<button class="sm" data-onclick="pdfOpen('${p.id}')" title="Abrir el PDF enlazado: ${esc(p.pdf.name)}">📄</button>` : ''}<button class="sm" data-onclick="toggleNotes('${p.id}')" data-oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar · Clic derecho: visor de notas">${p.notes.filter(n => n.content.trim()).length} ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" data-onclick="viewRel('${p.id}')" title="Relaciones">🔗 ${relCount(p)}</button>` : ''}</td>
  <td><button class="x" title="Eliminar" data-onclick="delPaper('${p.id}')">✕</button></td></tr>${EXP.has(p.id) ? `<tr class="rn"><td></td><td colspan="11">${notesHTML(p)}</td></tr>` : ''}`;
const tableHTML = (L, from) => `<div class="twrap"><table class="tbl"><thead><tr><th></th>${TH.map(([k, t]) => k ? `<th class="sortable" data-onclick="thSort('${k}')">${t}${F.sorts[0]?.k === k ? (F.sorts[0].d > 0 ? ' ▲' : ' ▼') : ''}</th>` : `<th>${t}</th>`).join('')}</tr></thead><tbody>${L.map(p => rowHTML(p, from)).join('')}</tbody></table></div>`;
const items = (l, from) => db.settings.view === 'table' ? (l.length ? tableHTML(l, from) : '') : l.map(p => card(p, from)).join('');
function listHTML(L) {
  if (!F.group) return items(L, '');
  const G = F.noSec ? [] : db.sections.filter(s => !F.sec || s.id === F.sec).map(s => [s, L.filter(p => p.sectionIds.includes(s.id))]);
  if (!F.sec) G.push([{id: '', name: 'Sin sección', color: '#888888'}, L.filter(p => !p.sectionIds.some(secById))]);
  return G.map(([s, l]) => `<section class="gbox" data-sec="${s.id || ''}"><h2 class="grp" style="border-color:${esc(s.color || '#888888')}" ${s.id ? `data-oncontextmenu="svOpen('${s.id}',event)"` : ''}>${esc(s.name)} <small>(${l.length})</small></h2>${items(l, s.id || '') || '<p class="empty drop">Arrastra papers aquí</p>'}</section>`).join('');
}
function fitTags(only) {   // las etiquetas van en la barra superior de la tarjeta; si no caben, pasan a su propia línea entre esa barra y el título
  (only ? [only] : document.querySelectorAll('#list article.card')).forEach(c => { const ct = c.querySelector('.ct'), tl = ct.querySelector('.tl') || c.querySelector(':scope > .tl'); if (!tl) return;
    if (tl.parentElement !== ct) ct.insertBefore(tl, ct.querySelector('.rd'));
    if (ct.scrollWidth > ct.clientWidth + 1) ct.after(tl); });
}
let listW = 0; new ResizeObserver(([e]) => { if (Math.abs(e.contentRect.width - listW) > 1) { listW = e.contentRect.width; fitTags(); } }).observe($('#list'));   // también al plegar la barra o cambiar el tamaño
function render() {
  hdr();
  filtDraw();
  const tg = (id, open, label, active) => { const b = $(id); b.textContent = `${label} ${open ? '▾' : '▸'}${!open && active ? ' •' : ''}`; b.classList.toggle('on', open); };   // «•» = hay filtro activo con la lista plegada
  tg('#tbSec', F.tbSec, 'Sección', F.sec || F.noSec); tg('#tbTag', F.tbTag, 'Etiquetas', F.tags.size || F.exTags.size || F.noTag);
  $('#secF2').hidden = !F.tbSec; $('#tagF2').hidden = !F.tbTag; $('#grpChk').checked = F.group;
  selDraw(0);
  $('#d-search').hidden = !F.q; $('#d-tr').hidden = !db.trash.length; $('#trLbl').textContent = 'Papelera' + (db.trash.length ? ` (${db.trash.length})` : ''); $('#tbView').textContent = db.settings.view === 'table' ? '▦ Tarjetas' : '☰ Tabla';
  const nextKey = Object.keys(SORTS).find(k => !F.sorts.some(s => s.k === k)) || 'title';
  $('#sortUI').innerHTML = F.sorts.map((s, i) => `<div class="row"><select data-onchange="sortSet(${i},this.value)">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${s.k === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button title="${s.d > 0 ? 'Ascendente (A→Z, antiguo→reciente)' : 'Descendente (Z→A, reciente→antiguo)'}" data-onclick="sortFlip(${i})">${s.d > 0 ? '▲' : '▼'}</button>
    ${F.sorts.length > 1 ? `<button data-onclick="sortDel(${i})">✕</button>` : ''}</div>`).join('')
    + `<button data-onclick="sortAdd('${nextKey}')">+ Añadir criterio</button>`;
  const L = visible(), part = !F.group && L.length > LIST.step;   // sin agrupar, las listas largas se pintan por partes
  LIST.L = L; LIST.shown = part ? LIST.step : L.length;
  $('#list').innerHTML = (listHTML(part ? L.slice(0, LIST.step) : L) + (part ? moreHTML() : '')) || '<p class="empty">No hay papers que mostrar. Crea uno con «Nuevo paper» o ajusta los filtros.</p>';
  fitTags(); hydrateImgs(); moreWatch(); uiSoon();
  LIST.n = L.length; countDraw(); progDraw();
}
const LIST = {L: [], n: 0, shown: 0, step: 150};   // lo que se ve en la lista y cuántos papers lleva pintados
const moreHTML = () => `<p class="more"><button data-onclick="listMore()">Mostrar ${Math.min(LIST.step, LIST.L.length - LIST.shown)} más (quedan ${LIST.L.length - LIST.shown})</button></p>`;
function listMore() {   // añade la siguiente parte sin repintar lo que ya está
  const m = $('#list > .more'); if (!m) return; const add = LIST.L.slice(LIST.shown, LIST.shown += LIST.step);
  const tb = $('#list tbody'); if (tb) tb.insertAdjacentHTML('beforeend', add.map(p => rowHTML(p, '')).join('')); else m.insertAdjacentHTML('beforebegin', add.map(p => card(p, '')).join(''));
  m.remove(); if (LIST.shown < LIST.L.length) $('#list').insertAdjacentHTML('beforeend', moreHTML());
  fitTags(); hydrateImgs(); moreWatch();
}
const MORE_IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) listMore(); }, {rootMargin: '600px'}) : null;
const moreWatch = () => { if (!MORE_IO) return; MORE_IO.disconnect(); const m = $('#list > .more'); if (m) MORE_IO.observe(m); };   // al acercarte al final, se añade sola
const countDraw = () => { $('#count').textContent = `${LIST.n} de ${db.papers.length} · ${SEL.size} sel.`; };
function selDraw(count = 1) {   // barra de selección (solo sale con papers marcados) y contador
  const sg = $('#sg-sel'), hadSel = !sg.hidden; sg.hidden = !SEL.size; if (SEL.size && !hadSel) sg.classList.remove('fold');
  $('#selT').textContent = `Selección (${SEL.size})`; if (count) countDraw();
}
function renderPaper(id) {   // repinta solo la tarjeta o fila de un paper; si el cambio puede moverlo o sacarlo de la lista, todo
  const p = db.papers.find(x => x.id === id), el = $(`#list [data-id="${id}"]`);
  if (!p || !el || F.minRating || F.read || F.exTags.size || F.noTag || F.noSec || F.yFrom || F.yTo || F.sorts.some(s => ['rating', 'reading', 'modified'].includes(s.k))) return render();
  const tr = el.tagName === 'TR', t = document.createElement(tr ? 'tbody' : 'div'); t.innerHTML = (tr ? rowHTML : card)(p, el.dataset.from);
  if (tr && el.nextElementSibling?.classList.contains('rn')) el.nextElementSibling.remove();   // la fila de notas desplegadas va justo detrás
  const nodes = [...t.children]; el.replaceWith(...nodes); hdr(); filtDraw();   // los contadores de los filtros pueden cambiar
  if (!tr) fitTags(nodes[0]); nodes.forEach(n => n.querySelectorAll('.pimg[data-fpid]').forEach(e => hydrateImgs(false, e)));
}
let tQ = 0;   // la búsqueda espera a que dejes de escribir (Enter la aplica al momento)
function qSet(v, now) { F.q = v; clearTimeout(tQ); if (now) render(); else tQ = setTimeout(render, 150); }
function toggleF(id) { if (F.exTags.delete(id)) return render(); F.tags.has(id) ? F.tags.delete(id) : F.tags.add(id); F.noTag = false; render(); }   // pulsar una excluida solo quita la exclusión
function tagsAll() { F.tags.clear(); F.exTags.clear(); F.noTag = false; render(); }
function noTagF() { F.noTag = !F.noTag; if (F.noTag) F.tags.clear(); render(); }
function ctxShow(e, html) {   // menú contextual genérico
  e.preventDefault(); e.stopPropagation(); let m = $('#ctx'); if (!m) { m = document.createElement('div'); m.id = 'ctx'; }
  (document.querySelector('dialog[open]') || document.body).appendChild(m);   // dentro de una ventana abierta, para que se vea por encima
  m.innerHTML = html; m.hidden = false;
  m.style.left = Math.max(0, Math.min(e.clientX, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(0, Math.min(e.clientY, innerHeight - m.offsetHeight - 8)) + 'px';
}
const tick = on => on ? '✓ ' : '\u2003';
function modeMenu(e) { ctxShow(e, '<div class="ctxh">Combinar varias etiquetas</div>' + [['any', 'Al menos una'], ['all', 'Todas']].map(([k, v]) => `<button data-onclick="ctxClose();put(F,'mode','${k}',render)">${tick(F.mode === k)}${v}</button>`).join('')); }
function groupMenu(e) { ctxShow(e, `<div class="ctxh">Secciones</div><button data-onclick="ctxClose();put(F,'group',!F.group,render)">${tick(F.group)}Agrupar por sección</button>`); }
function tagMenu(e, pid, tid) { ctxShow(e, `<div class="ctxh">Etiqueta «${esc(db.tags.find(t => t.id === tid)?.name)}»</div><button data-onclick="delTagFrom('${pid}','${tid}')">🗑 Borrar de este paper</button>`); }
function delTagFrom(pid, tid) { const p = db.papers.find(x => x.id === pid); if (p) { p.tagIds = p.tagIds.filter(x => x !== tid); logChange(p, 'Etiqueta quitada: ' + (db.tags.find(t => t.id === tid)?.name || '?')); } ctxClose(); markDirty(); F.tags.size ? render() : renderPaper(pid); }
const ctxClose = () => { const m = $('#ctx'); if (m) { m.hidden = true; document.body.appendChild(m); } };
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) ctxClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { ctxClose(); fmClose(); } });
const fmClose = () => { $('#fmenu').hidden = true; $('#fmBtn').setAttribute('aria-expanded', 'false'); };   // menú «Archivo» de la cabecera
function fmToggle(e) { e.stopPropagation(); const m = $('#fmenu'), open = m.hidden; ctxClose(); m.hidden = !open; $('#fmBtn').setAttribute('aria-expanded', String(open)); }
document.addEventListener('click', e => { if (!e.target.closest('.fm')) fmClose(); });
document.addEventListener('contextmenu', e => { if (!e.target.closest('[data-oncontextmenu]')) ctxClose(); });   // clic derecho en otro sitio también cierra
function setSecF(id) { F.sec = id && F.sec === id ? '' : id; F.noSec = false; render(); }   // '' = Todas; pulsar la sección activa también vuelve a «Todas»
function sbToggle() { $('#side').classList.toggle('min'); uiSoon(); }
function sbAllMenu(e) { ctxShow(e, '<div class="ctxh">Grupos de la barra</div><button data-onclick="ctxClose();sbAll(0)">Desplegar todos</button><button data-onclick="ctxClose();sbAll(1)">Plegar todos</button>'); }
function sbWidth(w) { const a = $('#side'); if (w) a.style.setProperty('--sbw', Math.max(200, Math.min(480, Math.round(w))) + 'px'); else a.style.removeProperty('--sbw'); }
function sbWidthReset() { sbWidth(0); uiSoon(); }
const sbW = () => parseInt($('#side').style.getPropertyValue('--sbw')) || 0;   // 0 = ancho por defecto
function sbGripDown(e) {   // arrastrar el borde derecho de la barra cambia su ancho; doble clic lo devuelve al de siempre
  if (e.button !== 0 || $('#side').classList.contains('min')) return; e.preventDefault();
  const a = $('#side'), x0 = e.clientX, w0 = a.getBoundingClientRect().width; a.classList.add('rs');
  const mv = ev => sbWidth(w0 + ev.clientX - x0), up = () => { a.classList.remove('rs'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); uiSoon(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function sbAll(fold) { $('#side').classList.remove('min'); document.querySelectorAll('#side .sg').forEach(e => e.classList.toggle('fold', !!fold)); uiSoon(); }
function sbSearchDock() {   // con la barra plegada, la búsqueda pasa a la fila de «Nuevo paper» (el resto se pliega); al desplegarla, vuelve a su sitio
  const q = $('#q'), min = $('#side').classList.contains('min'), had = document.activeElement === q;
  if (min) $('main > .row .pri').after(q); else $('#sg-search .sgh').appendChild(q);
  if (had) q.focus();
}
new MutationObserver(sbSearchDock).observe($('#side'), {attributes: true, attributeFilter: ['class']});   // sirve para todo lo que pliega o despliega la barra
function sbMore() {   // «Información» (Ayuda, Privacidad y Créditos): plegada por defecto; con la barra plegada, la despliega abierta
  const a = $('#side'), el = $('#sg-more'), wasMin = a.classList.contains('min');
  a.classList.remove('min'); wasMin ? el.classList.remove('fold') : el.classList.toggle('fold');
  el.querySelector('.shm').setAttribute('aria-expanded', !el.classList.contains('fold')); uiSoon();
}
function sbGroup(g) {   // con la barra plegada, pulsar un icono la despliega en ese grupo
  const a = $('#side'), el = $('#sg-' + g), wasMin = a.classList.contains('min');
  a.classList.remove('min'); wasMin ? el.classList.remove('fold') : el.classList.toggle('fold');
  if (g === 'search' && !el.classList.contains('fold')) $('#q').focus(); uiSoon();
}
function cycleRead(id) { const p = db.papers.find(x => x.id === id); if (!p) return; const k = Object.keys(READ); const was = p.reading; p.reading = k[(k.indexOf(p.reading) + 1) % k.length]; logChange(p, `Lectura: ${READ[was]} → ${READ[p.reading]}`); markDirty(); renderPaper(id); }
function setRead(k) { F.read = k; render(); }
function noSecF() { F.noSec = !F.noSec; F.sec = ''; render(); }
function toggleSel(id) { SEL.has(id) ? SEL.delete(id) : SEL.add(id);   // solo cambian la casilla, la barra de selección y el contador
  const c = $(`#list [data-id="${id}"] input[type=checkbox]`); if (c) c.checked = SEL.has(id); selDraw(); }
function selVisible() { visible().forEach(p => SEL.add(p.id)); render(); }
function selNone() { SEL.clear(); render(); }
/* ===== Exportar (texto, BibTeX, RIS, Word) y bibliografía ordenada ===== */
const ex = () => db.settings.export;
const EXF = {txt: ['Texto (.txt)', 'text/plain'], bib: ['BibTeX (.bib)', 'text/plain'], ris: ['RIS (.ris)', 'text/plain'], doc: ['Word (.doc)', 'application/msword'], docx: ['Word (.docx)', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']};
const isTl = f => f === 'txt' || f === 'doc' || f === 'docx';   // formatos de texto con estilo de cita (los demás son BibTeX y RIS)
const EXO = {auto: 'Automático (según el estilo: APA alfabético; Vancouver, lista)', list: 'Orden de la lista', alpha: 'Alfabético', year: 'Por año'};
const secName = id => secById(id)?.name || 'Sin sección';
const ascii = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PART = /^((de|del|la|las|los|van|von|der|den|di|da|du|le|el)\s+)+/i;   // partículas de los apellidos compuestos
let EXS = 'vis';   // alcance elegido: sel | vis | all
function sortKeyOf(p, particles) {   // clave de orden: la manual del paper o, si no hay, el primer apellido (sin partículas si se pide)
  const k = p.sortKey?.trim(); if (k) return k;
  const a = pAuth(p.authors.slice(0, 1), p.authorType)[0]?.l || (OWN(p) ? noAbbr(p.venue) : '') || p.title;   // una entidad se ordena por su nombre completo
  return particles ? a.replace(PART, '') : a;
}
function exList() {
  const o = ex();
  let L = EXS === 'sel' ? db.papers.filter(p => SEL.has(p.id)) : EXS === 'vis' ? visible() : [...db.papers];
  const ord = o.order === 'auto' ? ((isTl(o.fmt) && STYLES[o.style]?.order === 'alpha') ? 'alpha' : 'list') : o.order;
  const key = p => sortKeyOf(p, o.particles), cmp = (a, b) => COLL.compare(key(a), key(b)), yr = p => +p.year || 0;
  if (ord === 'alpha') L.sort((a, b) => cmp(a, b) || yr(a) - yr(b) || COLL.compare(a.title, b.title));
  else if (ord === 'year') L.sort((a, b) => yr(a) - yr(b) || cmp(a, b));
  else L = sortList(L);
  EXTYPES = [...new Set(L.map(p => p.type))]; EXOM = 0; if (isTl(o.fmt)) { const om = STYLES[o.style]?.omit; if (om) { const n0 = L.length; L = L.filter(p => !om(p)); EXOM = n0 - L.length; } }   // la guía excluye algunos tipos de la lista de referencias
  return L;
}
let EXOM = 0, EXTYPES = [];   // cuántos papers se omitieron en la última exportación · tipos presentes antes de omitir (para los avisos)
const cite = (p, o, ys) => p.cites[o.style] ?? STYLES[o.style].fn(p, ys ? {...o, ys} : o);
const exSecs = (L, o) => isTl(o.fmt) && STYLES[o.style]?.sections ? STYLES[o.style].sections(L, o) : [{h: o.title, L}];   // bloques con título: uno solo, salvo en los estilos con anexos (Derecho)
function exText(L, o) {
  return exSecs(L, o).map(S => { if (S.lines) return S.h + '\n\n' + S.lines.join('\n');
    const sx = yearSuffixes(S.L, o);
    const items = S.L.map((p, i) => { let t = (isNum(o) ? numLbl(i + 1, o) : '') + citeTxt(cite(p, o, sx.get(p.id)));
      if (o.notes) p.notes.filter(n => n.content.trim()).forEach(n => t += `\n   [${secName(n.sectionId)}] ${mdPlain(n.content.trim())}`);
      return t; });
    return (S.h ? S.h + '\n\n' : '') + items.join('\n\n'); }).join('\n\n\n');
}
function exHtml(L, o) {   // sangría francesa de 1,27 cm (36 pt); las notas se exportan con su formato
  const body = exSecs(L, o).map(S => { const h = S.h ? `<h2 style="font-size:14pt">${esc(S.h)}</h2>` : '';
    if (S.lines) return h + S.lines.map(l => `<p style="margin:0 0 4pt">${citeHtml(l)}</p>`).join('');
    const sx = yearSuffixes(S.L, o);
    return h + S.L.map((p, i) => {
      const notes = o.notes ? p.notes.filter(n => n.content.trim()).map(n => `<div style="margin:0 0 6pt 36pt;font-size:10pt"><i>[${esc(secName(n.sectionId))}]</i>${md(n.content)}</div>`).join('') : '';
      return `<p style="margin:0 0 ${notes ? 2 : 8}pt 36pt;text-indent:-36pt">${citeHtml((isNum(o) ? numLbl(i + 1, o) : '') + cite(p, o, sx.get(p.id)))}</p>${notes}`;
    }).join(''); });
  return `<div style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.15">${body.join('')}</div>`;
}
// ---- Word real (.docx): paquete OOXML mínimo en un ZIP sin compresión, sin dependencias. Sangría francesa de 1,27 cm, cursiva y negrita reales.
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {   // [[nombre, texto]] → Uint8Array (método 0 = almacenado; nombres UTF-8)
  const enc = new TextEncoder(), u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255], loc = [], cen = []; let off = 0;
  for (const [name, txt] of files) {
    const nb = enc.encode(name), d = enc.encode(txt), crc = crc32(d), common = [...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0)];
    const lh = [0x50, 0x4b, 3, 4, ...u16(20), ...common]; loc.push(new Uint8Array(lh), nb, d);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += lh.length + nb.length + d.length; }
  const cdSize = cen.reduce((a, b) => a + b.length, 0), end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), 0, 0]);
  const all = [...loc, ...cen, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; for (const b of all) { out.set(b, p); p += b.length; } return out;
}
const docxRuns = (s, sz) => {   // *cursiva* y **negrita** (y \* literal) → runs de Word; sz = tamaño en medios puntos (orden del esquema: b, i, sz)
  const out = []; for (const part of String(s ?? '').replace(/\\\*/g, '\u0001').split(/(\*\*.+?\*\*|\*.+?\*)/)) { if (!part) continue;
    const b = /^\*\*.+\*\*$/.test(part), i = !b && /^\*.+\*$/.test(part), t = (b ? part.slice(2, -2) : i ? part.slice(1, -1) : part).replace(/\u0001/g, '*');
    out.push(`<w:r>${b || i || sz ? `<w:rPr>${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`); }
  return out.join(''); };
function exDocx(L, o) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', P = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`, H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const body = [];
  for (const S of exSecs(L, o)) {
    if (S.h) body.push(P(`<w:r><w:t xml:space="preserve">${esc(S.h)}</w:t></w:r>`, '<w:pStyle w:val="Heading1"/>'));
    if (S.lines) { S.lines.forEach(l => body.push(P(docxRuns(l), '<w:spacing w:after="40"/>'))); continue; }
    const sx = yearSuffixes(S.L, o);
    S.L.forEach((p, i) => {
      body.push(P(docxRuns((isNum(o) ? numLbl(i + 1, o) : '') + cite(p, o, sx.get(p.id))), '<w:ind w:left="720" w:hanging="720"/>'));   // sangría francesa
      if (o.notes) p.notes.filter(n => n.content.trim()).forEach(n => n.content.trim().split('\n').forEach((ln, j) => body.push(P(docxRuns(j ? '' : `*[${secName(n.sectionId)}]* `, 20) + noteRuns(ln, 20), '<w:spacing w:after="40"/><w:ind w:left="720"/>')))); }); }
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipStore([
    ['[Content_Types].xml', `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/></Relationships>`],
    ['word/styles.xml', `${H}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`],
    ['word/document.xml', `${H}<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`]]);
}
const wordDoc = (L, o) => `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Bibliografía</title></head><body>${exHtml(L, o)}</body></html>`;
const BIBK = {articulo: 'article', libro: 'book', capitulo: 'incollection', congreso: 'inproceedings', tesis: 'phdthesis', web: 'misc', prensa: 'article', blog: 'online', informe: 'techreport', norma: 'standard', patente: 'patent', dataset: 'dataset', software: 'software', audiovisual: 'video', audio: 'audio', legislacion: 'legislation', jurisprudencia: 'jurisdiction', mapa: 'misc', basedatos: 'misc', redsocial: 'misc', ia: 'misc', diccionario: 'misc', presentacion: 'misc', personal: 'misc'};
const BIBV = {informe: 'institution', norma: 'organization', patente: 'organization', mapa: 'organization', dataset: 'organization', software: 'organization', basedatos: 'organization', audiovisual: 'organization', audio: 'organization', redsocial: 'organization', ia: 'organization', diccionario: 'organization', presentacion: 'organization', personal: 'organization', legislacion: 'organization', jurisprudencia: 'institution', prensa: 'journal', blog: 'journal', articulo: 'journal', capitulo: 'booktitle', congreso: 'booktitle', tesis: 'school', libro: 'publisher'};
const STOPW = new Set(['the', 'and', 'for', 'del', 'los', 'las', 'una', 'con', 'por', 'que']);
const texEsc = s => String(s).replace(/([&%$#_])/g, '\\$1');
const bibName = (p, x) => { x = x.trim(); return p.authorType === 'entidad' || (p.authorType !== 'persona' && isOrg(x)) ? `{${texEsc(x)}}` : texEsc(x); };   // entidades entre llaves
function bibtex(L) {
  L = L.map(effP);
  const used = new Map();
  return L.map(p => {
    const au = p.authorType === 'sin_autor' ? [] : p.authors, ty = p.type;
    const base = (ascii(au.length ? parse(au.slice(0, 1))[0]?.l : 'anon') + (p.year || '') + (p.title.split(/\s+/).map(ascii).find(w => w.length > 3 && !STOPW.has(w)) || '')) || 'ref';
    const n = used.get(base) || 0; used.set(base, n + 1);
    let bk = BIBK[ty] || 'misc'; const tf = [];
    if (ty === 'tesis' && p.thesisType && p.thesisType !== 'Tesis doctoral') { bk = 'mastersthesis'; tf.push(['type', texEsc(p.thesisType)]); }
    const dp = okDate(p.pubDate) ? p.pubDate.split('-') : [], pg = String(p.pages || '').replace(/(\d)\s*[-–—]+\s*(\d)/g, '$1--$2');
    const f = [['author', au.map(a => bibName(p, a)).join(' and ')], ['editor', (p.editors || []).map(a => bibName({}, a)).join(' and ')], ['title', `{${texEsc(p.title)}}`], ['year', p.year], ['month', dp[1] && +dp[1]], ['day', dp[2] && +dp[2]],
      [BIBV[ty] || 'howpublished', texEsc(p.venue || '')], ['publisher', ['capitulo', 'congreso', 'jurisprudencia'].includes(ty) ? texEsc(p.publisher || '') : ''], ['address', shows('place', ty) ? texEsc(p.place || '') : ''], ['edition', shows('edition', ty) ? texEsc(p.edition || '') : ''],
      ['volume', ty === 'articulo' ? texEsc(p.volume || '') : ''], ['number', ty === 'articulo' || ty === 'legislacion' ? texEsc(p.issue || '') : ''], ['pages', shows('pages', ty) ? pg : ''], ['entrysubtype', ty === 'prensa' ? 'newspaper' : ty === 'blog' ? 'blog' : BIBK[ty] === 'misc' && ty !== 'web' ? ty : ''], ...tf,
      ...[['subtype', 'type'], ['authorRole', 'authorrole'], ['userHandle', 'userhandle'], ['seriesNumber', 'seriesnumber'], ['isbn', 'isbn'], ['issn', 'issn'], ['series', 'series'], ['institution', 'institution'], ['docNumber', ty === 'legislacion' ? 'docnumber' : 'number'], ['abbr', 'shorthand'], ['ecli', 'ecli']].filter(([k]) => shows(k, ty) && !(k === 'institution' && ty === 'tesis' && !p.institution)).map(([k, b]) => [b, texEsc(p[k] || '')]),
      ['doi', normDoi(p.doi)], ['url', p.url], ['urldate', p.accessed]].filter(([, v]) => v);
    return `@${bk}{${n ? base + String.fromCharCode(96 + n) : base},\n${f.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
  }).join('\n\n');
}
const RISK = {articulo: 'JOUR', libro: 'BOOK', capitulo: 'CHAP', congreso: 'CONF', tesis: 'THES', web: 'ELEC', prensa: 'NEWS', blog: 'BLOG', informe: 'RPRT', norma: 'STAND', patente: 'PAT', mapa: 'MAP', dataset: 'DATA', software: 'COMP', basedatos: 'DBASE', audiovisual: 'VIDEO', audio: 'SOUND', redsocial: 'GEN', ia: 'GEN', diccionario: 'DICT', presentacion: 'SLIDE', personal: 'PCOMM', legislacion: 'STAT', jurisprudencia: 'CASE'};
const RISV = {libro: 'PB', tesis: 'PB', capitulo: 'T2', congreso: 'T2', web: 'T2', blog: 'T2', diccionario: 'T2', informe: 'PB', norma: 'PB', patente: 'PB', mapa: 'PB', dataset: 'PB', software: 'PB', basedatos: 'PB', audiovisual: 'PB', audio: 'PB', redsocial: 'PB', ia: 'PB', presentacion: 'PB', personal: 'PB', legislacion: 'PB', jurisprudencia: 'PB'};   // etiqueta RIS donde va «venue» (por defecto JO)
const ris = L => L.map(effP).map(p => { const ty = p.type, pg = /^(.+?)\s*[-–—]\s*(.+)$/.exec(String(p.pages || '')) || [0, p.pages || ''], dd = d => d.replace(/-/g, '/') + '/';
  return ['TY  - ' + (RISK[ty] || 'GEN'), ...(p.authorType === 'sin_autor' ? [] : p.authors.map(a => 'AU  - ' + a)), ...(p.editors || []).map(e => 'A2  - ' + e), 'TI  - ' + p.title, p.year && 'PY  - ' + p.year, okDate(p.pubDate) && 'DA  - ' + dd(p.pubDate),
    p.venue && `${RISV[ty] || 'JO'}  - ${p.venue}`, ['capitulo', 'congreso'].includes(ty) && p.publisher && 'PB  - ' + p.publisher, ty === 'jurisprudencia' && p.publisher && 'DB  - ' + p.publisher, ty === 'articulo' && p.volume && 'VL  - ' + p.volume, ty === 'articulo' && p.issue && 'IS  - ' + p.issue,
    shows('pages', ty) && pg[1] && 'SP  - ' + pg[1], shows('pages', ty) && pg[2] && 'EP  - ' + pg[2], shows('place', ty) && p.place && 'CY  - ' + p.place,
    shows('edition', ty) && p.edition && 'ET  - ' + p.edition, shows('subtype', ty) && p.subtype && 'M3  - ' + p.subtype, shows('authorRole', ty) && p.authorRole && 'C1  - ' + p.authorRole, shows('userHandle', ty) && p.userHandle && 'C2  - ' + p.userHandle, shows('docNumber', ty) && p.docNumber && 'M1  - ' + p.docNumber, shows('abbr', ty) && p.abbr && 'J2  - ' + p.abbr, shows('ecli', ty) && p.ecli && 'C3  - ' + p.ecli, ty === 'legislacion' && p.issue && 'IS  - ' + p.issue, ['redsocial', 'ia'].includes(ty) && 'N1  - gestor:' + ty, ty === 'tesis' && p.thesisType && 'M3  - ' + p.thesisType, shows('isbn', ty) && p.isbn && 'SN  - ' + p.isbn, shows('issn', ty) && p.issn && 'SN  - ' + p.issn, shows('series', ty) && p.series && 'T3  - ' + p.series, shows('seriesNumber', ty) && p.seriesNumber && 'IS  - ' + p.seriesNumber, shows('conferencePlace', ty) && p.conferencePlace && 'AD  - ' + p.conferencePlace,
    p.doi && 'DO  - ' + normDoi(p.doi), p.url && 'UR  - ' + p.url, p.accessed && 'Y2  - ' + dd(p.accessed), 'ER  - '].filter(Boolean).join('\r\n'); }).join('\r\n\r\n');
function openEx() {   // ventana emergente de exportación; se cierra con un clic fuera
  const o = ex(); if (!STYLES[o.style]) o.style = 'apa'; if (!EXF[o.fmt]) o.fmt = 'txt'; if (!EXO[o.order]) o.order = 'auto';
  EXS = SEL.size ? 'sel' : 'vis';
  $('#ex').innerHTML = `<h2>Exportar</h2><div id="exOpts"></div><textarea id="exText"></textarea>
    <div class="row" style="margin-top:10px"><button class="pri" data-onclick="exCopy()">Copiar</button><button id="exRich" data-onclick="exCopyRich()" title="Con sangría francesa, para pegar en Word o Docs">Copiar con formato</button><button data-onclick="exSave()">Guardar archivo</button><small id="exMsg"></small><button style="margin-left:auto" data-onclick="$('#ex').close()">Cerrar</button></div>`;
  exUI(); drawEx(); $('#ex').showModal();
}
function exSet(k, v, quiet) {   // las opciones se recuerdan en el JSON (sin crear pasos de deshacer)
  ex()[k] = v; lastSnap = snapDb(); dirty = true; touch(); if (!quiet) exUI(); drawEx();
}
function exUI() {
  const o = ex(), tl = isTl(o.fmt);
  const sel = (k, opts, cur) => `<select data-onchange="exSet('${k}',this.value)">${Object.entries(opts).map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const chk = (k, t) => `<label class="row"><input type="checkbox" ${o[k] ? 'checked' : ''} data-onchange="exSet('${k}',this.checked)"> ${t}</label>`;
  $('#exOpts').innerHTML = `<div class="grid">
    <label>Papers<select data-onchange="exsSet(this.value)"><option value="sel" ${EXS === 'sel' ? 'selected' : ''}>Seleccionados (${SEL.size})</option><option value="vis" ${EXS === 'vis' ? 'selected' : ''}>Visibles con los filtros (${visible().length})</option><option value="all" ${EXS === 'all' ? 'selected' : ''}>Todos (${db.papers.length})</option></select></label>
    <label>Formato${sel('fmt', Object.fromEntries(Object.entries(EXF).map(([k, v]) => [k, v[0]])), o.fmt)}</label>
    ${tl ? `<label>Estilo de cita<select data-onchange="exSet('style',this.value)">${styOpts(o.style)}</select></label>` : ''}
    <label>Orden${sel('order', EXO, o.order)}</label>
    ${tl ? `<label>Idioma de los conectores${STYLES[o.style]?.fixedLang ? `<select disabled><option>${STYLES[o.style].fixedLang === 'en' ? 'English (fijo en este estilo)' : 'Español (fijo en este estilo)'}</option></select>` : sel('lang', {es: 'Español (y, En, consultado)', en: 'English (&, In, cited)'}, o.lang)}</label><label>Fecha de consulta${sel('dateFmt', {long: '20 de octubre de 2026', dmy: '20-10-2026', iso: '2026-10-20'}, o.dateFmt)}</label>` : ''}
    ${tl && isNum(o) ? `<label>Formato de la numeración${sel('numFmt', {auto: 'Según el estilo', dot: '1.', br: '[1]', par: '(1)'}, o.numFmt)}</label>` : ''}
    ${tl ? `<label>Título del documento<input value="${esc(o.title)}" placeholder="Referencias" data-oninput="exSet('title',this.value,1)"></label>` : ''}
    <div class="w exchk">${tl ? (STYLES[o.style]?.numbered ? '' : chk('num', 'Numerar')) + chk('notes', 'Incluir notas') + chk('vanAll', 'Vancouver: listar todos los autores (por defecto, 6 y «et al.»)') + chk('ppChap', 'APA: «pp.» antes de las páginas de un capítulo') + (STYLES[o.style]?.dis ? chk('disamb', 'Distinguir obras del mismo autor y año (2020a, 2020b)') : '') + (STYLES[o.style]?.sections ? chk('abbrList', 'Lista de abreviaturas al principio (legislación y jurisprudencia)') : '') : ''}${chk('particles', 'Ignorar partículas al ordenar (de, del, la, van…)')}</div>
    ${tl ? `<small class="w">${STYLES[o.style]?.note ? esc(STYLES[o.style].note) + '<br>' : ''}${(exList(), EXTYPES).map(t => typeWarn(o.style, t)).filter(Boolean).map(w => '⚠ ' + esc(w) + '<br>').join('')}${esc(BASADO)}</small>` : ''}
    <small class="w">Para un caso concreto («de la Torre» bajo la T o bajo la D), rellena «Clave de orden» en la pestaña Datos del paper: tiene prioridad.</small></div>`;
}
function drawEx() {
  const o = ex(), L = exList();
  $('#exText').value = o.fmt === 'bib' ? bibtex(L) : o.fmt === 'ris' ? ris(L) : exText(L, o);   // la vista previa es editable (salvo en Word)
  $('#exText').readOnly = o.fmt === 'doc' || o.fmt === 'docx'; $('#exRich').hidden = !isTl(o.fmt);
  $('#exMsg').textContent = L.length ? `${L.length} papers${EXOM ? ` (${EXOM} omitidos: este estilo no los incluye en la lista)` : ''}` : 'No hay papers para exportar.';
}
function exCopy() { const t = $('#exText'); t.select(); document.execCommand('copy'); $('#exMsg').textContent = 'Copiado ✓'; }
async function clipHtml(html, text, host) {   // HTML + texto: al pegar en Word o Docs conserva el formato
  try { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); }
  catch { const d = document.createElement('div'); d.contentEditable = true; d.style.cssText = 'position:fixed;left:-9999px;top:0'; d.innerHTML = html; host.appendChild(d);
    const r = document.createRange(); r.selectNodeContents(d); const g = getSelection(); g.removeAllRanges(); g.addRange(r); document.execCommand('copy'); g.removeAllRanges(); d.remove(); }
}
async function clipText(t, host) {
  try { await navigator.clipboard.writeText(t); return; } catch {}
  const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;left:-9999px;top:0'; host.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
}
async function exCopyRich() {   // con sangría francesa, para pegar en Word o Docs
  const L = exList(), o = ex();
  await clipHtml(exHtml(L, o), exText(L, o), $('#ex'));
  $('#exMsg').textContent = 'Copiado con formato ✓';
}
async function exSave() {
  const o = ex(), L = exList(), [lbl, mime] = EXF[o.fmt]; if (!L.length) return alert('No hay nada que exportar.');
  const text = o.fmt === 'doc' ? wordDoc(L, o) : o.fmt === 'docx' ? exDocx(L, o) : $('#exText').value;
  try { if (FSA) { const h = await showSaveFilePicker({suggestedName: 'citas.' + o.fmt, types: [{description: lbl, accept: {[mime]: ['.' + o.fmt]}}]}); await writeTo(h, text); }
    else download(text, 'citas.' + o.fmt, mime); }
  catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
}
document.querySelectorAll('dialog:not(#dlg)').forEach(d => {   // todas las ventanas se cierran con un clic fuera (sin tocar la de edición que haya debajo); la de editar paper guarda al salir, más abajo
  d.addEventListener('mousedown', e => bdDown = outside(e, d));
  d.addEventListener('click', e => { if (bdDown && outside(e, d)) { bdDown = false; d.close(); } });
});
function delPaper(id) {
  const p = db.papers.find(x => x.id === id); if (!p) return;
  if (!confirm(`¿Mover «${p.title}» a la papelera? Podrás restaurarlo durante ${TRASH_DAYS} días.`)) return;
  trashPaper(id); markDirty(); render();
}
