'use strict';
/* ===== Lista principal ===== */
const chip = (t, on, click, drag, ctx, n) => `<span class="chip ${on === 'ex' ? 'ex' : on ? 'on' : ''}" style="--c:${esc(t.color || '#888888')}" ${click ? `data-onclick="${click}"` : ''} ${drag ? `draggable="true" data-tag="${t.id}"` : ''} ${ctx ? `data-oncontextmenu="${ctx}"` : ''}>${esc(t.name)}${n != null ? ` <small class="cn">${n}</small>` : ''}</span>`;   // on = 'ex': etiqueta excluida · n: cuántos papers
const BYID = new WeakMap();   // índice por id de una lista (etiquetas, secciones); dura hasta acabar la tarea en curso, así nunca queda desfasado
const byId = arr => { let m = BYID.get(arr); if (!m || m.n !== arr.length) { m = new Map(arr.map(x => [x.id, x])); m.n = arr.length; BYID.set(arr, m); queueMicrotask(() => BYID.delete(arr)); } return m; };
const tagById = i => byId(db.tags).get(i), secById = i => byId(db.sections).get(i);
const secsSel = () => db.sections.filter(s => F.secs.has(s.id)).map(s => s.id);   // secciones elegidas en los filtros, en el orden de la lista
const sec1 = () => secsSel()[0] || '';
const secsLoad = f => new Set((Array.isArray(f.secs) ? f.secs : [f.sec]).filter(id => typeof id === 'string' && db.sections.some(s => s.id === id)));   // filtros guardados: varias secciones (o una, de versiones anteriores)
const secChips = id => (secById(id)?.tagIds || []).map(tagById).filter(Boolean).map(t => chip(t, 1)).join('');
const hdr = () => { syIcon(); fitBars(); };   // syIcon también redibuja el estado de guardado
// En escritorio, la cabecera y la fila de «Nuevo paper» ocupan siempre una línea: si no caben, se acortan los textos de
// algunos botones (clase «cmp»); lo que aún sobre se comprime (título con «…», búsqueda más corta). Si las secciones o etiquetas de la fila
// no caben enteras, pasan debajo en varias líneas (clase «wrapc»), como en el móvil, en vez de quedar tapadas
let FIT_RO = null;
function fitBars() {
  const h = $('header'), t = $('#appName'), r = $('main > .row'); if (!h || !r) return;
  if (document.documentElement.classList.contains('mv')) { h.classList.remove('cmp'); r.classList.remove('cmp'); return; }
  if (!FIT_RO && window.ResizeObserver) { FIT_RO = new ResizeObserver(() => fitBars()); FIT_RO.observe(h); FIT_RO.observe(r); }
  const over = e => e.scrollWidth > e.clientWidth + 1;
  h.classList.remove('cmp'); if (over(h) || over(t)) h.classList.add('cmp');
  const C = [...r.querySelectorAll('.chips')].filter(c => !c.hidden && c.querySelector('.chip'));   // filas de secciones o etiquetas con algo dentro
  r.classList.remove('cmp', 'wrapc'); if (C.some(over)) r.classList.add('wrapc');
  if (over(r) || r.querySelector('#q')?.clientWidth < 140) r.classList.add('cmp');
  if (over(r) && C.length) r.classList.add('wrapc');   // ni acortando los botones cabe: las secciones y etiquetas, debajo
}
for (const c of ['#secF2', '#tagF2']) document.querySelector(c)?.addEventListener('wheel', e => {   // la rueda desplaza en horizontal las etiquetas de la fila
  const el = e.currentTarget; if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  el.scrollLeft += e.deltaY; e.preventDefault();
}, {passive: false});
function fnameDraw() {   // un único indicador de guardado, junto al nombre del proyecto
  const el = $('#fname'), f = path ? path.split(/[\\/]/).pop() : '', on = syOn(), s = on ? syState() : '';
  const T = !on ? (dirty ? ['pend', 'Sin guardar'] : path ? ['ok', 'Guardado'] : ['', '(sin archivo)'])
    : {busy: ['busy', 'Sincronizando…'], wait: ['pend', 'Cierra la ventana abierta para sincronizar'], reconnect: ['err', 'Sin conexión con Drive: se reconecta con tu próximo clic'], error: ['err', 'No se pudo sincronizar (se reintenta)'],
       pend: ['pend', 'Sin guardar…'], manual: ['pend', 'Sin guardar (autoguardado en Drive desactivado)'], ok: ['ok', 'Guardado en Google Drive']}[s] || ['', ''];
  el.dataset.st = T[0]; el.textContent = T[1] + (db.settings.showFile && f && T[1] !== '(sin archivo)' ? ' · ' + f : '');
}
const COLL = new Intl.Collator('es');   // igual que localeCompare(…, 'es'), pero sin crear el comparador en cada llamada
function ordKey(id) {   // clave de un paper según una clasificación: el valor más bajo entre sus etiquetas o secciones (null si ninguna tiene)
  const o = (db.orders || []).find(x => x.id === id); if (!o) return () => null;
  const m = new Map(db[o.of].map(x => [x.id, ordVal(o, x.rk?.[id])])), lt = (a, b) => typeof a === 'number' ? a < b : COLL.compare(a, b) < 0;
  return p => { let best = null; for (const i of o.of === 'tags' ? p.tagIds : p.sectionIds) { const v = m.get(i); if (v != null && (best == null || lt(v, best))) best = v; } return best; };
}
const sortFn = k => k === 'manual' ? manIdx(MAN_ALL) : KEY[k] || (k.startsWith('o:') ? ordKey(k.slice(2)) : () => '');
/* ---- Orden manual: arrastrando, cada paper se coloca donde quieras dentro de su sección (o de la lista, sin agrupar).
   db.manual = {clave: [ids en orden]}; clave = id de la sección, '_' = Sin sección, '*' = toda la lista sin agrupar. Los que no estén, al final. */
const MAN_ALL = '*';
function manIdx(key) { const m = new Map((db.manual?.[key] || []).map((id, i) => [id, i])); return p => m.has(p.id) ? m.get(p.id) : null; }
function manSort(l, key) { const f = manIdx(key), d = F.sorts[0]?.d || 1; return l.map((p, i) => ({p, i, k: f(p)})).sort((a, b) => (a.k == null) - (b.k == null) || (a.k == null ? a.i - b.i : (a.k - b.k) * d)).map(e => e.p); }
function sortOpts() {   // criterios de Ordenar: los de siempre y las clasificaciones del proyecto
  return {...SORTS, ...Object.fromEntries((db.orders || []).map(o => ['o:' + o.id, `${o.of === 'tags' ? '🏷️' : '📁'} ${o.name}`]))};
}
function sortList(L) {   // ordena por todos los criterios, en cascada; d = 1 ascendente, -1 descendente
  // «Etiquetas» o «Secciones»: primero sus clasificaciones (la de más arriba manda; las de debajo desempatan) y al final el orden de su lista
  const S = F.sorts.flatMap(s => s.k === 'tags' || s.k === 'sections' ? [...ordOf(s.k).map(o => ({k: 'o:' + o.id, d: s.d})), s] : [s]), fs = S.map(s => sortFn(s.k)), K = L.map(p => ({p, k: fs.map(f => f(p))}));   // cada clave se calcula una vez por paper, no en cada comparación
  return K.sort((a, b) => { for (let i = 0; i < S.length; i++) { const {k, d} = S[i], x = a.k[i], y = b.k[i];
    if (k === 'rating' && !x !== !y) return x ? -1 : 1;   // sin valorar: siempre al final, en ambos sentidos
    if ((x == null) !== (y == null)) return x == null ? 1 : -1; if (x == null) continue;   // sin valor en la clasificación: al final, en ambos sentidos
    const c = typeof x === 'number' ? x - y : COLL.compare(x, y); if (c) return c * d; } return 0; }).map(e => e.p);
}
const has = (p, t) => p.tagIds.includes(t);   // las etiquetas son independientes de las secciones
/* ---- Búsqueda rápida: cada palabra por separado y en cualquier orden ----
   «garcia 2020» encuentra «García, Ana (2020)». También: "frase exacta", -palabra (excluir), autor:…, año:2020 o año:2010-2020,
   revista:…, doi:…, #etiqueta (o etiqueta:…) y seccion:…. Sin prefijo se busca en título, alias, año, autores, revista, DOI, etiquetas y secciones
   (y en notas y citas con «Incluir notas»). */
const SEARCH = new WeakMap();   // texto de búsqueda ya normalizado de cada paper: solo se recalcula si cambia
function searchTxt(p) {
  const raw = [p.title, p.alias, p.year, ...p.authors, p.venue, p.doi, ...p.tagIds.map(i => tagById(i)?.name), ...p.sectionIds.map(i => secById(i)?.name),
    ...(F.inNotes ? [p.general, ...p.notes.map(n => n.content), ...Object.values(p.cites), ...pdfsOf(p).flatMap(n => (p[pdfF(n)].ann || []).flatMap(a => [a.t, a.m]))] : [])].join(' ');   // con «Incluir notas», también los subrayados y comentarios de sus PDF
  let c = SEARCH.get(p); if (!c || c.raw !== raw) SEARCH.set(p, c = {raw, n: norm(raw)}); return c.n;
}
const QP = {autor: 'au', autores: 'au', author: 'au', au: 'au', ano: 'yr', year: 'yr', revista: 've', venue: 've', editorial: 've', doi: 'doi', etiqueta: 'tag', tag: 'tag', seccion: 'sec', section: 'sec'};
let QC = {raw: null, T: []};
function qParse(raw) {   // el texto de la caja → [{k: '' | 'au' | 'yr' | 've' | 'doi' | 'tag' | 'sec', v (normalizado), neg, a, b (años)}]
  if (QC.raw === raw) return QC.T;
  const T = [], re = /(-?)(?:([\p{L}]+):)?(?:"([^"]*)"?|(\S+))/gu; let m;
  while ((m = re.exec(raw || ''))) {
    const [, neg, pre, ph, w] = m; let v = ph ?? w ?? '', k = '';
    if (pre) { k = QP[norm(pre)] || ''; if (!k) v = pre + ':' + v; }   // «http://…» o un prefijo desconocido: se busca tal cual
    if (!k && !ph && v.length > 1 && v[0] === '#') { k = 'tag'; v = v.slice(1); }
    v = norm(v).trim(); if (!v) continue;
    const t = {k, v, neg: !!neg};
    if (k === 'yr') { const y = /^(\d{1,4})?\s*(?:[-–]\s*(\d{1,4})?)?$/.exec(v); if (!y || !y[1] && !y[2]) { t.k = ''; } else { t.a = +y[1] || 0; t.b = /[-–]/.test(v) ? +y[2] || 9999 : t.a; } }
    T.push(t);
  }
  return (QC = {raw, T}).T;
}
function qTest(p, T) {
  for (const t of T) {
    const v = t.v, k = t.k;
    const ok = !k ? searchTxt(p).includes(v) : k === 'au' ? norm(p.authors.join('; ')).includes(v) : k === 'yr' ? +p.year > 0 && +p.year >= t.a && +p.year <= t.b
      : k === 've' ? norm(p.venue).includes(v) : k === 'doi' ? norm(p.doi).includes(v)
      : k === 'tag' ? p.tagIds.some(i => norm(tagById(i)?.name).includes(v)) : p.sectionIds.some(i => norm(secById(i)?.name).includes(v));
    if (ok === t.neg) return false;
  }
  return true;
}
/* Resaltado: las palabras buscadas se marcan en el título y los autores de tarjetas y tabla, sin distinguir tildes ni mayúsculas */
let HL = {t: [], a: []};
const hlSet = T => { const f = T.filter(t => !t.neg && !t.k).map(t => t.v); HL = {t: f, a: [...f, ...T.filter(t => !t.neg && t.k === 'au').map(t => t.v)]}; };
function hl(s, terms) {
  s = String(s ?? ''); if (!terms.length || !s) return esc(s);
  let n = ''; const map = [];
  for (let i = 0; i < s.length; i++) { const c = norm(s[i]); for (let j = 0; j < c.length; j++) { n += c[j]; map.push(i); } }
  const on = new Uint8Array(s.length);
  for (const t of terms) for (let i = n.indexOf(t); i >= 0; i = n.indexOf(t, i + t.length)) for (let j = i; j < i + t.length; j++) on[map[j]] = 1;
  let o = '', open = 0;
  for (let i = 0; i < s.length; i++) { if (on[i] !== open) { o += on[i] ? '<mark>' : '</mark>'; open = on[i]; } o += esc(s[i]); }
  return o + (open ? '</mark>' : '');
}
function visible() {
  const T = qParse(F.q); hlSet(T);
  return sortList(db.papers.filter(p => (!T.length || qTest(p, T))
    && (!F.secs.size || p.sectionIds.some(s => F.secs.has(s))) && (!F.read || p.reading === F.read) && p.rating >= F.minRating && (!F.tags.size || [...F.tags][F.mode === 'all' ? 'every' : 'some'](t => has(p, t)))
    && (!F.noSec || !p.sectionIds.some(secById)) && (!F.noTag || !p.tagIds.some(tagById)) && (!F.exTags.size || ![...F.exTags].some(t => has(p, t)))
    && (!F.yFrom || +p.year >= F.yFrom) && (!F.yTo || (+p.year > 0 && +p.year <= F.yTo)) && advTest(p)));
}
/* ---- Búsqueda avanzada: condiciones campo · condición · valor, que se cumplan todas o alguna ---- */
const ADV_F = {any: 'Cualquier campo', title: 'Título', authors: 'Autores', year: 'Año', venue: 'Revista/editorial', doi: 'DOI', notes: 'Notas'};
const ADV_OP = {has: 'contiene', not: 'no contiene', eq: 'es', starts: 'empieza por', ge: 'desde (≥)', le: 'hasta (≤)', empty: 'está vacío', full: 'no está vacío'};
const advOps = f => f === 'year' ? ['eq', 'ge', 'le', 'empty', 'full'] : ['has', 'not', 'eq', 'starts', 'empty', 'full'];
const advVal = (p, f) => f === 'title' ? [p.title, p.alias].join(' ') : f === 'authors' ? p.authors.join('; ') : f === 'year' ? String(p.year ?? '') : f === 'venue' ? p.venue || '' : f === 'doi' ? p.doi || ''
  : f === 'notes' ? [p.general, ...p.notes.map(n => n.content)].join(' ') : ['title', 'authors', 'year', 'venue', 'doi', 'notes'].map(k => advVal(p, k)).join(' ');
const advRules = () => F.adv.rules.filter(r => r.op === 'empty' || r.op === 'full' || String(r.v).trim());   // una condición sin valor no cuenta
function advTest(p) {
  const R = advRules(); if (!R.length) return true;
  const ok = r => { const raw = advVal(p, r.f).trim(), x = norm(raw), v = norm(String(r.v).trim());
    if (r.op === 'empty') return !raw; if (r.op === 'full') return !!raw;
    if (r.f === 'year') { const y = +p.year, n = +r.v; return !!y && (r.op === 'ge' ? y >= n : r.op === 'le' ? y <= n : y === n); }
    return r.op === 'has' ? x.includes(v) : r.op === 'not' ? !x.includes(v) : r.op === 'eq' ? x === v : x.startsWith(v); };
  return F.adv.mode === 'any' ? R.some(ok) : R.every(ok);
}
function advDraw() {
  const el = $('#advUI'); if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // no se rehace mientras escribes
  const opt = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  el.innerHTML = `<div class="advm">Que se cumplan <select aria-label="Combinar condiciones" data-onchange="advMode(this.value)">${opt({all: 'todas', any: 'alguna'}, F.adv.mode)}</select> las condiciones</div>`
    + F.adv.rules.map((r, i) => `<div class="advr"><select aria-label="Campo" data-onchange="advSet(${i},'f',this.value)">${opt(ADV_F, r.f)}</select><select aria-label="Condición" data-onchange="advSet(${i},'op',this.value)">${opt(Object.fromEntries(advOps(r.f).map(k => [k, ADV_OP[k]])), r.op)}</select>`
      + (r.op === 'empty' || r.op === 'full' ? '<span></span>' : `<input aria-label="Valor" ${r.f === 'year' ? 'type="number"' : ''} value="${esc(r.v)}" placeholder="Valor" data-onchange="advSet(${i},'v',this.value)" data-onkeydown="onEnter(event,advEnter,this)">`)
      + `<button class="x" data-onclick="advDel(${i})" title="Quitar esta condición" aria-label="Quitar esta condición">✕</button></div>`).join('')
    + `<div class="row"><button data-onclick="advAdd()">＋ Añadir condición</button>${F.adv.rules.length ? '<button data-onclick="fClr(\'adv\')">Quitar todas</button>' : ''}</div>`;
  $('#d-adv').hidden = !advRules().length;
}
function advAdd() { F.adv.rules.push({f: 'any', op: 'has', v: ''}); advDraw(); const i = [...document.querySelectorAll('#advUI .advr input')].pop(); if (i) i.focus(); }
function advSet(i, k, v) { const r = F.adv.rules[i]; if (!r) return; r[k] = v; if (k === 'f' && !advOps(v).includes(r.op)) r.op = advOps(v)[0]; document.activeElement?.blur?.(); render(); }
function advEnter(inp) { inp.blur(); }   // Enter aplica la condición (el cambio llega por onchange)
function advDel(i) { F.adv.rules.splice(i, 1); render(); }
function advMode(v) { F.adv.mode = v === 'any' ? 'any' : 'all'; render(); }
/* ---- Filtros: resumen de lo aplicado, contadores y estado ---- */
const fYears = () => F.yFrom && F.yTo ? `${F.yFrom}–${F.yTo}` : F.yFrom ? `desde ${F.yFrom}` : `hasta ${F.yTo}`;
function actList() {   // filtros aplicados, cada uno con su forma de quitarlo
  const A = [];
  if (F.q) A.push(['🔍 «' + F.q + '»', "fClr('q')"]);
  secsSel().forEach(s => A.push(['📁 ' + secById(s).name, `fClr('sec','${s}')`]));
  if (F.noSec) A.push(['📁 Sin sección', "fClr('noSec')"]);
  F.tags.forEach(t => tagById(t) && A.push(['🏷️ ' + tagById(t).name, `fClr('tag','${t}')`]));
  F.exTags.forEach(t => tagById(t) && A.push(['🚫 ' + tagById(t).name, `fClr('ex','${t}')`]));
  if (F.noTag) A.push(['🏷️ Sin etiquetas', "fClr('noTag')"]);
  if (F.read) A.push(['📖 ' + READ[F.read], "fClr('read')"]);
  if (F.minRating) A.push(['★ ≥ ' + F.minRating, "fClr('min')"]);
  if (F.yFrom || F.yTo) A.push(['📅 ' + fYears(), "fClr('years')"]);
  const nA = advRules().length; if (nA) A.push(['🔎 Búsqueda avanzada (' + nA + (nA === 1 ? ' condición)' : ' condiciones)'), "fClr('adv')"]);
  return A;
}
function fClr(k, id) {
  if (k === 'q') { F.q = ''; $('#q').value = ''; } else if (k === 'sec') id ? F.secs.delete(id) : F.secs.clear(); else if (k === 'tag') F.tags.delete(id); else if (k === 'ex') F.exTags.delete(id);
  else if (k === 'read') F.read = ''; else if (k === 'min') F.minRating = 0; else if (k === 'years') F.yFrom = F.yTo = 0; else if (k === 'adv') F.adv.rules = []; else F[k] = false;
  render();
}
function fClrAll() { F.q = ''; $('#q').value = ''; F.secs.clear(); F.tags.clear(); F.exTags.clear(); F.noSec = F.noTag = false; F.read = ''; F.minRating = 0; F.yFrom = F.yTo = 0; F.adv.rules = []; render(); }
function actDraw() {
  const A = actList(), el = $('#actF'); el.hidden = !A.length;
  const cn = $('#count'), row = $('main>.row');   // en el móvil, con filtros, la cuenta va a la derecha de su fila en vez de ocupar una línea propia
  if (cn.parentElement !== row) row.append(cn);
  el.innerHTML = A.length ? `<small>Filtros:</small>${A.map(([t, c]) => `<button class="af" data-onclick="${c}" title="Quitar este filtro">${esc(t)} <b>✕</b></button>`).join('')}<button class="afx" data-onclick="fClrAll()">Limpiar todo</button>` : '';
  if (A.length && document.documentElement.classList.contains('mv')) el.append(cn);

  $('#d-filt').hidden = !A.some(([, c]) => c !== "fClr('q')" && c !== "fClr('adv')");
}
const fExtra = () => ({exTags: [...F.exTags], noTag: F.noTag, noSec: F.noSec, yFrom: F.yFrom, yTo: F.yTo, adv: {mode: F.adv.mode, rules: F.adv.rules.map(r => ({...r}))}});   // lo que guardan el estado de la interfaz y los filtros guardados
function fExtraLoad(f) {   // lo guardado se valida: una etiqueta borrada o un año raro se ignoran
  const yr = v => Number.isInteger(v) && v > 0 && v < 10000 ? v : 0;
  F.exTags = new Set((Array.isArray(f.exTags) ? f.exTags : []).filter(id => typeof id === 'string' && db.tags.some(t => t.id === id)));
  F.noTag = !!f.noTag; F.noSec = !!f.noSec; F.yFrom = yr(f.yFrom); F.yTo = yr(f.yTo);
  const a = f.adv && typeof f.adv === 'object' ? f.adv : {};
  F.adv = {mode: a.mode === 'any' ? 'any' : 'all', rules: (Array.isArray(a.rules) ? a.rules : []).filter(r => r && Object.hasOwn(ADV_F, r.f) && advOps(r.f).includes(r.op)).slice(0, 20).map(r => ({f: r.f, op: r.op, v: String(r.v ?? '').slice(0, 200)}))};
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
  const secC = side => [{name: 'Todas', color: '#888888'}, ...db.sections].map(x => (x.id ? `<span class="cw" data-sec="${x.id}">` : '') + chip(x, x.id ? F.secs.has(x.id) : !F.secs.size && !F.noSec, `setSecF('${x.id || ''}')`, 0, `svOpen('${x.id || ''}',event)`, side ? x.id ? cS.get(x.id) || 0 : N : null) + (x.id ? '</span>' : '')).join('')   // data-sec: soltar un paper aquí le pone la sección
    + (side && db.sections.length ? chip({name: 'Sin sección', color: '#888888'}, F.noSec, 'noSecF()', 0, '', nS) : '');
  const tagC = side => db.tags.length ? chip({name: 'Todas', color: '#888888'}, !F.tags.size && !F.exTags.size && !F.noTag, 'tagsAll()', 0, '', side ? N : null)
    + db.tags.map(t => chip(t, F.exTags.has(t.id) ? 'ex' : F.tags.has(t.id), `toggleF('${t.id}')`, 1, `tagFMenu(event,'${t.id}')`, side ? cT.get(t.id) || 0 : null)).join('')
    + (side ? chip({name: 'Sin etiquetas', color: '#888888'}, F.noTag, 'noTagF()', 0, '', nT) : '') : '<small>Aún no hay etiquetas.</small>';   // en la fila de arriba, sin contadores ni «Sin …», para que quepa
  $('#secF').innerHTML = secC(1); $('#secF2').innerHTML = secC(0);
  $('#tagF').innerHTML = tagC(1); $('#modeB').textContent = (F.mode === 'all' ? 'Todas' : 'Alguna') + ' ▾'; mgFit(); $('#tagF2').innerHTML = tagC(0); tagQDraw();
  $('#readF').innerHTML = [['', 'Todos'], ...Object.entries(READ)].map(([k, v]) => chip({name: v, color: k ? READ_C[k] : '#888888'}, F.read === k, `setRead('${k}')`, 0, '', k ? cR[k] : N)).join('');
  const rp = $('#readP'); rp.hidden = !N; rp.innerHTML = N ? ['leido', 'leyendo'].map(k => `<i style="width:${cR[k] / N * 100}%;background:${READ_C[k]}"></i>`).join('') : '';
  rp.title = `Progreso de lectura: ${cR.leido} leídos, ${cR.leyendo} leyendo y ${cR.por_leer} por leer, de ${N}`;
  $('#minR').textContent = (F.minRating ? '★ ≥ ' + F.minRating : 'Cualquiera') + ' ▾'; $('#minR').classList.toggle('on', !!F.minRating); $('#yFrom').value = F.yFrom || ''; $('#yTo').value = F.yTo || '';
  actDraw(); favDraw(); recDraw();
}
const tagsOf = p => p.tagIds.map(tagById).filter(Boolean).map(t => chip(t, 1, '', 0, `tagMenu(event,'${p.id}','${t.id}')`)).join('');
const EXP = new Set();   // papers con las notas desplegadas en la lista
const GEN_N = {name: 'Nota general', color: '#555555'};
const pNotes = p => [...(p.general?.trim() ? [{id: 'gen', gen: 1, content: p.general}] : []), ...p.notes.filter(n => n.content.trim())];   // la nota general va primero
const noteLabel = n => n.gen ? GEN_N.name : secName(n.sectionId);
const notesHTML = (p, hl) => `<div class="nts">${pNotes(p).map(n => { const s = n.gen ? GEN_N : secById(n.sectionId);
  return `<div class="nt${n.id === hl ? ' hl' : ''}">${s ? chip(s, 1) : '<span class="chip on" style="--c:#888888">Sin sección</span>'}<div class="ntx md">${md(n.content)}</div></div>`; }).join('') || '<small>Este paper no tiene notas.</small>'}</div>`;
function toggleNotes(id) { EXP.has(id) ? EXP.delete(id) : EXP.add(id); renderPaper(id); }
/* ---- Imagen del paper ---- */
const PEND = new Map(), IMG_URL = new Map();   // PEND: archivos elegidos en el borrador aún sin guardar · IMG_URL: URLs de objeto de los archivos enlazados
const imgInner = i => !i ? '🖼️' : i.kind === 'url' ? `<img src="${esc(i.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerror="imgErr(this)">`
  : i.kind === 'data' ? `<img src="${imgBlob(i.data)}" alt="">` : '🖼️';
const IMG_BLOB = new Map();   // imagen incrustada → URL blob: (la lista no copia cientos de KB de base64 en su HTML a cada pintado)
function imgBlob(d) {
  let u = IMG_BLOB.get(d); if (u) return u;
  try { const c = d.indexOf(','), bin = atob(d.slice(c + 1)), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
    u = URL.createObjectURL(new Blob([a], {type: d.slice(5, d.indexOf(';'))})); } catch (e) { return d; }
  if (IMG_BLOB.size >= 400) { const [k, v] = IMG_BLOB.entries().next().value; URL.revokeObjectURL(v); IMG_BLOB.delete(k); }   // las más antiguas se sueltan
  IMG_BLOB.set(d, u); return u;
}
const pimgHTML = (p, cls, attrs = '') => `<div class="pimg ${cls}" ${p.image?.kind === 'file' ? `data-fpid="${p.id}" title="Imagen enlazada: ${esc(p.image.name)}"` : ''} ${attrs}>${imgInner(p.image)}</div>`;
const thumbHTML = (p, cls) => db.settings.showImg === false ? '' : p.image ? pimgHTML(p, cls) : pdfsOf(p).length ? (d => d ? `<div class="pimg ${cls} pcov" title="Portada del PDF: ${esc(covOf(p).pf.name)}"><img src="${d}" alt=""></div>` : `<div class="pimg ${cls} pcov" data-cov="${p.id}" title="Portada del PDF (sale cuando el PDF se puede leer; si no, al abrirlo una vez)">📄</div>`)(covCached(p)) : '';   // sin imagen: la portada del primer PDF
async function fileImgUrl(pid, ask) {   // archivo local enlazado: el navegador puede pedir permiso de lectura en cada sesión
  const h = PEND.get(pid) || await idb('readonly', st => st.get('img:' + pid)).catch(() => null); if (!h) return null;
  let perm = await h.queryPermission({mode: 'read'}); if (perm !== 'granted' && ask) perm = await h.requestPermission({mode: 'read'});
  if (perm !== 'granted') return null;
  const u = URL.createObjectURL(await h.getFile()); URL.revokeObjectURL(IMG_URL.get(pid)); IMG_URL.set(pid, u); return u;
}
function hydrateImgs(ask, only) {
  if (!only) covHydrate();
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
function imgSetUrl() { const u = $('#imgUrl').value.trim(); if (!u) return imgClear(); if (!/^https?:\/\//i.test(u)) return say('La URL debe empezar por http:// o https://'); PEND.delete(D.id); imgSet({kind: 'url', url: u}); }
function imgClear() { PEND.delete(D.id); imgSet(null); }
async function imgPickLinked() { try { const [h] = await showOpenFilePicker({types: FILE_IMG_T}); PEND.set(D.id, h); imgSet({kind: 'file', name: h.name}); } catch (e) { if (e.name !== 'AbortError') say('No se pudo elegir el archivo: ' + e.message); } }
async function imgEmbedBlob(f) {   // copia reducida (máx. 480 px, JPEG) para guardarla dentro del JSON
  const b = await createImageBitmap(f), k = Math.min(1, 480 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b.width * k)); c.height = Math.max(1, Math.round(b.height * k)); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  PEND.delete(D.id); imgSet({kind: 'data', data: c.toDataURL('image/jpeg', .82)});
}
function imgPickEmbed() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { const f = i.files[0]; if (f) try { await imgEmbedBlob(f); } catch (e) { say('No se pudo leer la imagen: ' + e.message); } };
  i.click();
}
function imgFromClipboard(e, inField) {   // imagen copiada (p. ej. «Copiar imagen» en Google Imágenes): archivo, <img> en el HTML o, fuera de un campo, una URL suelta
  const dt = e.clipboardData; if (!dt || !D) return false;
  const file = [...dt.files].find(f => /^image\//.test(f.type));
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(dt.getData('text/html') || ''), txt = (dt.getData('text/plain') || '').trim();
  const u = m ? m[1].replace(/&amp;/g, '&') : !inField && /^https?:\/\/\S+$/i.test(txt) ? txt : '';
  if (!file && !/^(https?:|data:image\/)/i.test(u)) return false;
  e.preventDefault();
  if (file) imgEmbedBlob(file).catch(err => say('No se pudo leer la imagen: ' + err.message));
  else if (u.startsWith('data:')) fetch(u).then(r => r.blob()).then(imgEmbedBlob).catch(err => say('No se pudo leer la imagen: ' + err.message));
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
const card = (p, from) => `<article class="card" data-id="${p.id}" draggable="true" ${F.group ? `data-from="${from || ''}"` : ''}><div class="ct"><label class="sel"><input type="checkbox" ${SEL.has(p.id) ? 'checked' : ''} data-onchange="toggleSel('${p.id}')"> Seleccionar</label><button class="sm" data-onclick="openPaper('${p.id}')">Editar</button><button class="sm cpb" data-onclick="copyCardCite('${p.id}',this)" title="Copiar la cita (estilo elegido en Exportar), con cursiva al pegar en Word">📋</button>${pdfBtns(p, true)}${p.tagIds.length ? `<span class="tl">${tagsOf(p)}</span>` : ''}${rdHTML(p)}<button class="x" title="Eliminar" data-onclick="delPaper('${p.id}')">✕</button></div><div class="th">${thumbHTML(p, 'sm')}<h3>${hl(p.alias || p.title, HL.t)}</h3></div>${p.alias ? `<div class="sub">${hl(p.title, HL.t)}</div>` : ''}
    <div class="au"><span>${hl(p.authors.join('; '), HL.a)} ${p.year ? '(' + esc(p.year) + ')' : ''}</span></div>
    ${/^https?:/i.test(p.url) ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : ''}
    
    <div class="row"><button class="sm" data-onclick="toggleNotes('${p.id}')" data-oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar notas · Clic derecho: abrir el visor de notas">Notas (${pNotes(p).length}) ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" data-onclick="viewRel('${p.id}')" title="Relaciones: relacionados, cita a y citado por">🔗 ${relCount(p)}</button>` : ''}</div>${EXP.has(p.id) ? notesHTML(p) : ''}</article>`;
/* ---- Columnas de la tabla: se pueden mover (arrastrando la cabecera o con su clic derecho) y ocultar.
   La casilla, la miniatura y ✕ son fijas; el título siempre se ve. Se guardan en db.settings.tblCols, propio de cada dispositivo (no se sincroniza). */
const COLS = {title: 'Título', author: 'Autores', year: 'Año', venue: 'Revista / editorial', reading: 'Lectura', rating: '★', sections: 'Secciones', tags: 'Etiquetas', notes: 'Notas'};
const COL_SORT = {title: 1, author: 1, year: 1, venue: 1, reading: 1, rating: 1, sections: 1, tags: 1};
const COL_PX = {author: 120, year: 50, venue: 100, reading: 86, rating: 100, sections: 80, tags: 90, notes: 132};   // lo que deja de ocupar la tabla al ocultarla
const COL_NAME = {rating: 'Valoración (★)'};
function tblCols() {   // orden de las columnas visibles y conjunto de las ocultas
  const c = db.settings.tblCols || {}, ks = Object.keys(COLS), o = (Array.isArray(c.order) ? c.order : []).filter((k, i, a) => COLS[k] && a.indexOf(k) === i);
  ks.forEach(k => { if (!o.includes(k)) o.splice(ks.indexOf(k) <= o.length ? ks.indexOf(k) : o.length, 0, k); });   // las que falten, en su sitio de siempre
  const hid = new Set((Array.isArray(c.hidden) ? c.hidden : []).filter(k => COLS[k] && k !== 'title'));
  return {order: o, hidden: hid, vis: o.filter(k => !hid.has(k))};
}
function setTblCols(order, hidden) {   // como la vista: se recuerda en el JSON sin crear pasos de deshacer
  const def = Object.keys(COLS), o = order.join() === def.join() ? undefined : order, h = [...hidden];
  db.settings.tblCols = o || h.length ? {...(o ? {order: o} : {}), ...(h.length ? {hidden: h} : {})} : undefined;
  if (!db.settings.tblCols) delete db.settings.tblCols;
  lastSnap = snapDb(); dirty = true; touch(); render();
}
const tdSecs = p => p.sectionIds.map(secById).filter(Boolean);
const CELL = {
  title: p => `<td class="c-title tt"><a class="tl2" data-onclick="openPaper('${p.id}')" title="${esc(p.alias || p.title)} · Clic: editar">${hl(p.alias || p.title, HL.t)}</a></td>`,
  author: p => `<td class="c-author" title="${esc(p.authors.join('; '))}">${hl(p.authors.join('; '), HL.a)}</td>`,
  year: p => `<td class="c-year">${esc(p.year)}</td>`,
  venue: p => `<td class="c-venue" title="${esc(p.venue)}">${esc(p.venue)}</td>`,
  reading: p => `<td class="c-reading"><button class="rst" style="--c:${READ_C[p.reading]}" title="Clic: cambiar el estado de lectura" data-onclick="cycleRead('${p.id}')">${READ[p.reading]}</button></td>`,
  rating: p => `<td class="c-rating">${starsHTML(p)}</td>`,
  sections: p => `<td class="c-sections" title="${esc(tdSecs(p).map(s => s.name).join(', '))}">${tdSecs(p).map(s => chip(s, 1)).join('')}</td>`,
  tags: p => `<td class="c-tags" data-onclick="tagPick(event,'${p.id}')" title="${esc([p.tagIds.map(tagById).filter(Boolean).map(t => t.name).join(', '), 'Clic: poner o quitar etiquetas'].filter(Boolean).join(' · '))}">${tagsOf(p)}</td>`,
  notes: p => `<td class="c-notes nw"><button class="sm cpb" data-onclick="copyCardCite('${p.id}',this)" title="Copiar la cita (estilo elegido en Exportar), con cursiva al pegar en Word">📋</button>${pdfBtns(p)}<button class="sm" data-onclick="toggleNotes('${p.id}')" data-oncontextmenu="viewNotes(event,'${p.id}')" title="Clic: desplegar · Clic derecho: visor de notas">${pNotes(p).length} ${EXP.has(p.id) ? '▾' : '▸'}</button>${relCount(p) ? `<button class="sm" data-onclick="viewRel('${p.id}')" title="Relaciones">🔗 ${relCount(p)}</button>` : ''}</td>`};
function thSort(k) {   // clic en una cabecera: ese criterio pasa a ser el principal; otro clic invierte el sentido
  F.sorts = F.sorts[0]?.k === k ? [{k, d: -F.sorts[0].d}, ...F.sorts.slice(1)] : [{k, d: 1}, ...F.sorts.filter(x => x.k !== k).slice(0, 2)]; render();
}
function thSortD(k, d) { ctxClose(); F.sorts = [{k, d}, ...F.sorts.filter(x => x.k !== k).slice(0, 2)]; render(); }   // desde el menú: el sentido elegido
const MV_META = {author: p => hl(p.authors.join('; '), HL.a), year: p => esc(p.year), venue: p => esc(p.venue)};
const rowMv = (p, from, C) => {   // móvil: la fila es una ficha de dos líneas (rejilla en movil.css): título; autores · año · revista y el resto de columnas visibles, en su orden
  const meta = C.filter(k => MV_META[k]).map(k => MV_META[k](p)).filter(Boolean), rest = C.filter(k => !MV_META[k] && k !== 'title').map(k => CELL[k](p).replace(/^<td/, '<div').replace(/<\/td>$/, '</div>'));
  return `<tr class="rw" data-id="${p.id}" draggable="true" ${F.group ? `data-from="${from || ''}"` : ''}><td class="c-sel"><input type="checkbox" aria-label="Seleccionar" ${SEL.has(p.id) ? 'checked' : ''} data-onchange="toggleSel('${p.id}')"></td><td class="c-img timg">${thumbHTML(p, 'xs')}</td>${CELL.title(p)}<td class="c-del"><button class="x" title="Eliminar" data-onclick="delPaper('${p.id}')">✕</button></td>${meta.length || rest.length ? `<td class="mvx">${meta.length ? `<div class="mvm">${meta.join('<i>·</i>')}</div>` : ''}${rest.join('')}</td>` : ''}</tr>${EXP.has(p.id) ? `<tr class="rn"><td></td><td>${notesHTML(p)}</td></tr>` : ''}`;
};
const rowHTML = (p, from, C = tblCols().vis) => document.documentElement.classList.contains('mv') ? rowMv(p, from, C) : `<tr class="rw" data-id="${p.id}" draggable="true" ${F.group ? `data-from="${from || ''}"` : ''}>
  <td class="c-sel"><input type="checkbox" aria-label="Seleccionar" ${SEL.has(p.id) ? 'checked' : ''} data-onchange="toggleSel('${p.id}')"></td>
  <td class="c-img timg">${thumbHTML(p, 'xs')}</td>${C.map(k => CELL[k](p)).join('')}
  <td class="c-del"><button class="x" title="Eliminar" data-onclick="delPaper('${p.id}')">✕</button></td></tr>${EXP.has(p.id) ? `<tr class="rn"><td></td><td colspan="${C.length + 2}">${notesHTML(p)}</td></tr>` : ''}`;
const thHTML = k => `<th class="c-${k}${COL_SORT[k] ? ' sortable' : ''}" draggable="true" data-col="${k}"${COL_SORT[k] ? ` data-onclick="thSort('${k}')"` : ''} data-oncontextmenu="colMenu(event,'${k}')" title="${COL_SORT[k] ? 'Clic: ordenar (otro clic invierte el sentido) · ' : ''}Arrastrar: mover la columna · Clic derecho: ordenar, mover u ocultar columnas">${COLS[k]}${F.sorts[0]?.k === k ? (F.sorts[0].d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
const tableHTML = (L, from) => { const {vis, hidden} = tblCols(), w = 980 - [...hidden].reduce((s, k) => s + (COL_PX[k] || 0), 0);
  return `<div class="twrap"><table class="tbl${db.settings.showImg !== false && db.papers.some(p => p.image || pdfsOf(p).length) ? '' : ' noimg'}"${hidden.size ? ` style="min-width:${Math.max(420, w)}px"` : ''}><thead><tr><th class="c-sel" data-oncontextmenu="colMenu(event,'')"></th><th class="c-img" data-oncontextmenu="colMenu(event,'')"></th>${vis.map(thHTML).join('')}<th class="c-del" data-oncontextmenu="colMenu(event,'')"></th></tr></thead><tbody>${L.map(p => rowHTML(p, from, vis)).join('')}</tbody></table></div>`; };
/* menú de columnas: clic derecho en la cabecera (ordenador) o el botón «Columnas» (también en el móvil, sin pulsaciones largas) */
let COLM = null;   // dónde se abrió, para volver a pintarlo abierto tras cada cambio
function colMenu(e, k) {
  COLM = {x: e.clientX, y: e.clientY, k};
  const {order, hidden} = tblCols(), i = order.indexOf(k), mv = document.documentElement.classList.contains('mv');
  let h = '';
  if (k) {
    h += `<div class="ctxh">Columna «${COL_NAME[k] || COLS[k]}»</div>`;
    if (COL_SORT[k]) h += `<button data-onclick="thSortD('${k}',1)">▲ Ordenar de menor a mayor</button><button data-onclick="thSortD('${k}',-1)">▼ Ordenar de mayor a menor</button>`;
    h += `<button data-onclick="colAct('move','${k}',-1)"${i > 0 ? '' : ' disabled'}>◀ Mover a la izquierda</button><button data-onclick="colAct('move','${k}',1)"${i < order.length - 1 ? '' : ' disabled'}>▶ Mover a la derecha</button>`;
    if (k !== 'title') h += `<button data-onclick="colAct('hide','${k}')">🚫 Ocultar esta columna</button>`;
    h += '<hr>';
  }
  h += `<div class="ctxh">Columnas que se ven${mv ? '' : ' (↑↓ o arrastrando la cabecera: moverla)'}</div>` + order.map((c, j) => `<div class="colr"><button class="colck" data-col="${c}" data-onclick="colAct('toggle','${c}')"${c === 'title' ? ' disabled title="El título siempre se ve"' : ''}>${tick(!hidden.has(c))}${COL_NAME[c] || COLS[c]}</button><button class="colmv" data-onclick="colAct('move','${c}',-1)" title="Mover antes (a la izquierda)" aria-label="Mover antes"${j ? '' : ' disabled'}>↑</button><button class="colmv" data-onclick="colAct('move','${c}',1)" title="Mover después (a la derecha)" aria-label="Mover después"${j < order.length - 1 ? '' : ' disabled'}>↓</button></div>`).join('')
    + `<hr><button data-onclick="colAct('reset')">↺ Restablecer las columnas</button>`;
  ctxShow(e, h); $('#ctx').classList.add('colm');
}
function colBtn() { const r = $('#tbCols').getBoundingClientRect(); setTimeout(() => colMenu({preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4}, '')); }   // tras el clic: si no, el aviso de «clic fuera del menú» lo cerraría
function colAct(a, k, d) {
  const {order, hidden} = tblCols();
  if (a === 'move') { const i = order.indexOf(k), j = i + d; if (j < 0 || j >= order.length) return; order.splice(i, 1); order.splice(j, 0, k); }
  else if (a === 'hide') hidden.add(k);
  else if (a === 'toggle') { if (k === 'title') return; hidden.has(k) ? hidden.delete(k) : hidden.add(k); }
  else if (a === 'reset') { setTblCols(Object.keys(COLS), []); return ctxClose(); }
  setTblCols(order, hidden);
  if (a === 'hide') return ctxClose();
  const st = $('#ctx')?.scrollTop || 0, M = COLM;   // vuelve a abrir el menú tras el clic (el botón pulsado ya no existe)
  setTimeout(() => { colMenu({preventDefault() {}, stopPropagation() {}, clientX: M.x, clientY: M.y}, M.k); $('#ctx').scrollTop = st; });
}
function colMove(k, to, after) {   // arrastrar una cabecera sobre otra
  const {order, hidden} = tblCols(); if (k === to || !order.includes(k) || !order.includes(to)) return;
  order.splice(order.indexOf(k), 1); order.splice(order.indexOf(to) + (after ? 1 : 0), 0, k); setTblCols(order, hidden);
}
const items = (l, from) => db.settings.view === 'table' ? (l.length ? tableHTML(l, from) : '') : l.map(p => card(p, from)).join('');
function groupsOf(L) {   // [sección, sus papers] en el orden en que se ven (con el orden manual de cada sección, si es el criterio principal)
  const G = F.noSec ? [] : db.sections.filter(s => !F.secs.size || F.secs.has(s.id)).map(s => [s, L.filter(p => p.sectionIds.includes(s.id))]);
  if (!F.secs.size) G.push([{id: '', name: 'Sin sección', color: '#888888'}, L.filter(p => !p.sectionIds.some(secById))]);
  return F.sorts[0]?.k === 'manual' ? G.map(([s, l]) => [s, manSort(l, s.id || '_')]) : G;
}
const FOLD = new Set((() => { try { return JSON.parse(localStorage.getItem('gp-fold') || '[]'); } catch (e) { return []; } })());   // secciones plegadas en la vista agrupada (de cada dispositivo)
function gFold(k) { FOLD.has(k) ? FOLD.delete(k) : FOLD.add(k); try { localStorage.setItem('gp-fold', JSON.stringify([...FOLD])); } catch (e) {} render(); }
function gFoldAll(on) { ctxClose(); FOLD.clear(); if (on) groupsOf(visible()).forEach(([s]) => FOLD.add(s.id || '_')); try { localStorage.setItem('gp-fold', JSON.stringify([...FOLD])); } catch (e) {} render(); }
function listHTML(L) {
  if (!F.group) return items(L, '');
  return groupsOf(L).map(([s, l]) => { const k = s.id || '_', fo = FOLD.has(k);
    return `<section class="gbox${fo ? ' fold' : ''}" data-sec="${s.id || ''}"><h2 class="grp" style="border-color:${esc(s.color || '#888888')}" data-onclick="gFold('${k}')" title="Clic: plegar o desplegar${s.id ? ' · Clic derecho: notas de la sección' : ''}" ${s.id ? `data-oncontextmenu="svOpen('${s.id}',event)"` : ''}><span class="gcar">${fo ? '▸' : '▾'}</span>${esc(s.name)} <small>(${l.length})</small></h2>${fo ? '' : items(l, s.id || '') || '<p class="empty drop">Arrastra papers aquí</p>'}</section>`; }).join('');
}
function paperPlace(id, from, to, ref, after) {   // coloca un paper (arrastrado) antes o después de otro; to: sección de destino ('' = Sin sección) o null sin agrupar
  const grouped = F.group && to != null, mv = dragIds(id);   // si el paper está seleccionado, se colocan todos los seleccionados juntos
  if (grouped && to !== from) { movePaper(id, from, to); if (!db.papers.some(p => p.id === id && (to ? p.sectionIds.includes(to) : !p.sectionIds.some(secById)))) return; }
  if (ref !== id && mv.length > 1 && mv.includes(ref)) return;   // soltado sobre otro de los que se arrastran: el orden no cambia
  const shown = () => { const L = visible(); return grouped ? groupsOf(L).map(([s, l]) => [s.id || '_', l.map(p => p.id)]) : [[MAN_ALL, L.map(p => p.id)]]; };
  db.manual = db.manual && typeof db.manual === 'object' ? db.manual : {};
  if (F.sorts[0]?.k !== 'manual' || F.sorts[0].d < 0) {   // al empezar a colocar a mano: cada lista parte del orden que se ve ahora
    for (const [k, ids] of shown()) db.manual[k] = [...ids, ...(db.manual[k] || []).filter(i => !ids.includes(i))];
    F.sorts = [{k: 'manual', d: 1}, ...F.sorts.filter(x => x.k !== 'manual').slice(0, 2)];
  }
  const key = grouped ? to || '_' : MAN_ALL, cur = shown().find(([k]) => k === key)?.[1] || [];
  const blk = cur.filter(i => i !== id && mv.includes(i)); blk.splice(Math.max(0, cur.filter(i => i === id || blk.includes(i)).indexOf(id)), 0, id);   // el bloque, en el orden en que se ven
  const ids = [...cur, ...(db.manual[key] || []).filter(i => !cur.includes(i))].filter(i => !blk.includes(i));
  const at = ref && ref !== id && ids.includes(ref) ? ids.indexOf(ref) + (after ? 1 : 0) : ids.length; ids.splice(at, 0, ...blk);
  db.manual[key] = ids; markDirty(); render();
}
/* posiciones guardadas: el orden de cada sección (y de la lista sin agrupar) con un nombre, para volver a él */
function posSnap() { const L = visible(), o = {...(db.manual || {})}; groupsOf(L).forEach(([s, l]) => o[s.id || '_'] = l.map(p => p.id)); o[MAN_ALL] = (F.group ? sortList(L) : L).map(p => p.id); return o; }
function posMenu(e) {
  const P = db.posSaves || [];
  ctxShow(e, `<div class="ctxh">📌 Posiciones guardadas</div><div class="posn"><input id="posName" maxlength="40" placeholder="Nombre (p. ej. Para el capítulo 2)" aria-label="Nombre" data-onkeydown="posKey(event)"><button class="pri" data-onclick="posSave()">Guardar</button></div><small class="posh">Guarda cómo están colocados ahora los papers (en cada sección) para volver a ese orden.</small>`
    + (P.length ? '<hr>' + P.map(x => `<div class="colr"><button class="colck" data-onclick="posLoad('${x.id}')" title="Volver a este orden">📌 ${esc(x.name)}</button><button class="colmv" data-onclick="posDel('${x.id}')" title="Borrar" aria-label="Borrar">✕</button></div>`).join('') : ''));
  $('#ctx').classList.add('posm');
}
function posKey(e) { if (e.key === 'Enter') { e.preventDefault(); posSave(); } }
function posSave() { const n = $('#posName').value.trim(); if (!n) return $('#posName').focus(); db.posSaves ||= []; db.posSaves.push({id: uid(), name: n, manual: posSnap()}); ctxClose(); markDirty(); toast(`Posiciones guardadas: «${n}».`, [], 2500); }
function posLoad(id) { const x = (db.posSaves || []).find(y => y.id === id); ctxClose(); if (!x) return; db.manual = structuredClone(x.manual); F.sorts = [{k: 'manual', d: 1}, ...F.sorts.filter(y => y.k !== 'manual').slice(0, 2)]; markDirty(); render(); toast(`Orden «${x.name}».`, [], 2000); }
function posDel(id) { const M = {x: +($('#ctx').style.left || '0').replace('px', ''), y: +($('#ctx').style.top || '0').replace('px', '')}; db.posSaves = (db.posSaves || []).filter(y => y.id !== id); markDirty(); setTimeout(() => posMenu({preventDefault() {}, stopPropagation() {}, clientX: M.x, clientY: M.y})); }
function fitTags(only) {   // las etiquetas van en la barra superior de la tarjeta; si no caben, pasan a su propia línea entre esa barra y el título
  (only ? [only] : document.querySelectorAll('#list article.card')).forEach(c => { const ct = c.querySelector('.ct'), tl = ct.querySelector('.tl') || c.querySelector(':scope > .tl'); if (!tl) return;
    if (tl.parentElement !== ct) ct.insertBefore(tl, ct.querySelector('.rd'));
    if (ct.scrollWidth > ct.clientWidth + 1) ct.after(tl); });
}
let listW = 0; new ResizeObserver(([e]) => { if (Math.abs(e.contentRect.width - listW) > 1) { listW = e.contentRect.width; fitTags(); } }).observe($('#list'));   // también al plegar la barra o cambiar el tamaño
let RENDER_HOLD = false, RENDER_HELD = false;   // al arrancar se pinta una sola vez, al final (ver bootApp en app.js)
function render() {
  if (RENDER_HOLD) { RENDER_HELD = true; return; }
  vwSatNotify();
  if (VW.open) return vwDbChanged();   // con el visor abierto, la lista se repinta al cerrarlo
  hdr();
  filtDraw();
  const tg = (id, open, label, active) => { const b = $(id); b.textContent = `${label} ${open ? '▾' : '▸'}${!open && active ? ' •' : ''}`; b.classList.toggle('on', open); };   // «•» = hay filtro activo con la lista plegada
  tg('#tbSec', F.tbSec, 'Sección', F.secs.size || F.noSec); tg('#tbTag', F.tbTag, 'Etiquetas', F.tags.size || F.exTags.size || F.noTag);
  $('#secF2').hidden = !F.tbSec; $('#tagF2').hidden = !F.tbTag; $('#grpChk').checked = F.group;
  selDraw(0);
  $('#d-search').hidden = !F.q && !advRules().length; advDraw(); $('#d-tr').hidden = !db.trash.length; $('#trLbl').textContent = 'Papelera' + (db.trash.length ? ` (${db.trash.length})` : ''); $('#tbView').innerHTML = db.settings.view === 'table' ? '▦<span class="bl"> Tarjetas</span>' : '☰<span class="bl"> Tabla</span>'; $('#tbCols').hidden = db.settings.view !== 'table';
  F.sorts = F.sorts.filter(s => Object.hasOwn(sortOpts(), s.k)); if (!F.sorts.length) F.sorts = [{k: 'title', d: 1}];   // una clasificación borrada deja de ordenar
  const nextKey = Object.keys(SORTS).find(k => !F.sorts.some(s => s.k === k)) || 'title';
  $('#sortUI').innerHTML = F.sorts.map((s, i) => `<div class="row"><select data-onchange="sortSet(${i},this.value)">${Object.entries(sortOpts()).map(([k, v]) => `<option value="${k}" ${s.k === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button title="${s.d > 0 ? 'Ascendente (A→Z, antiguo→reciente)' : 'Descendente (Z→A, reciente→antiguo)'}" data-onclick="sortFlip(${i})">${s.d > 0 ? '▲' : '▼'}</button>
    ${F.sorts.length > 1 ? `<button data-onclick="sortDel(${i})">✕</button>` : ''}</div>`).join('')
    + `<button data-onclick="sortAdd('${nextKey}')">+ Añadir criterio</button>`;
  const L = visible(), part = !F.group && L.length > LIST.step;   // sin agrupar, las listas largas se pintan por partes
  LIST.L = L; LIST.shown = part ? LIST.step : L.length;
  $('#list').innerHTML = (listHTML(part ? L.slice(0, LIST.step) : L) + (part ? moreHTML() : '')) || '<p class="empty">No hay papers que mostrar. Crea uno con «Nuevo paper» o ajusta los filtros.</p>';
  fitTags(); hydrateImgs(); moreWatch(); uiSoon(); kMark();
  LIST.n = L.length; countDraw(); progDraw(); inboxDraw(); fitBars();   // con los chips y la cuenta ya puestos: ¿caben en la fila?
}
const LIST = {L: [], n: 0, shown: 0, get step() { return document.documentElement.classList.contains('mv') ? 40 : 150; }};   // lo que se ve en la lista y cuántos papers lleva pintados (en el móvil caben pocas tarjetas: se pintan de 40 en 40)
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
  if (!p || !el || F.minRating || F.read || advRules().length || F.exTags.size || F.noTag || F.noSec || F.yFrom || F.yTo || F.sorts.some(s => ['rating', 'reading', 'modified'].includes(s.k))) return render();
  const tr = el.tagName === 'TR', t = document.createElement(tr ? 'tbody' : 'div'); t.innerHTML = (tr ? rowHTML : card)(p, el.dataset.from);
  if (tr && el.nextElementSibling?.classList.contains('rn')) el.nextElementSibling.remove();   // la fila de notas desplegadas va justo detrás
  const nodes = [...t.children]; el.replaceWith(...nodes); hdr(); filtDraw();   // los contadores de los filtros pueden cambiar
  if (!tr) fitTags(nodes[0]); nodes.forEach(n => { n.querySelectorAll('.pimg[data-fpid]').forEach(e => hydrateImgs(false, e)); covHydrate(n); });
}
let tQ = 0;   // la búsqueda espera a que dejes de escribir (Enter la aplica al momento)
function qSet(v, now) { F.q = v; clearTimeout(tQ); if (now) render(); else tQ = setTimeout(render, 150); }
function toggleF(id) { if (F.exTags.delete(id)) return render(); F.tags.has(id) ? F.tags.delete(id) : F.tags.add(id); F.noTag = false; render(); }   // pulsar una excluida solo quita la exclusión
function tagsAll() { F.tags.clear(); F.exTags.clear(); F.noTag = false; render(); }
function noTagF() { F.noTag = !F.noTag; if (F.noTag) F.tags.clear(); render(); }
function ctxShow(e, html) {   // menú contextual genérico
  e.preventDefault(); e.stopPropagation(); let m = $('#ctx'); if (!m) { m = document.createElement('div'); m.id = 'ctx'; }
  (document.querySelector('dialog[open]') || document.body).appendChild(m);   // dentro de una ventana abierta, para que se vea por encima
  m.className = ''; m.removeAttribute('data-mvf'); m.innerHTML = html; m.hidden = false;
  m.style.left = Math.max(0, Math.min(e.clientX, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(0, Math.min(e.clientY, innerHeight - m.offsetHeight - 8)) + 'px';
}
const tick = on => on ? '✓ ' : '\u2003';
function modeMenu(e) { ctxShow(e, '<div class="ctxh">Combinar varias etiquetas</div>' + [['any', 'Al menos una'], ['all', 'Todas']].map(([k, v]) => `<button data-onclick="ctxClose();put(F,'mode','${k}',render)">${tick(F.mode === k)}${v}</button>`).join('')); }
function groupMenu(e) { ctxShow(e, `<div class="ctxh">Secciones</div><button data-onclick="ctxClose();put(F,'group',!F.group,render)">${tick(F.group)}Agrupar por sección</button>${F.group ? '<button data-onclick="gFoldAll(1)">▸ Plegar todas</button><button data-onclick="gFoldAll(0)">▾ Desplegar todas</button>' : ''}`); }
function tagMenu(e, pid, tid) { ctxShow(e, `<div class="ctxh">Etiqueta «${esc(db.tags.find(t => t.id === tid)?.name)}»</div><button data-onclick="delTagFrom('${pid}','${tid}')">🗑 Borrar de este paper</button>`); }
/* Tabla en el ordenador: clic en la celda de etiquetas = menú para ponerlas o quitarlas con un clic (se queda abierto para marcar varias) */
let TPK = '';   // paper del menú de etiquetas abierto
function tagPick(e, pid) {
  if (mvOn() || e.button || e.target.closest?.('button, a, input')) return;
  TPK = pid; ctxShow(e, tagPickHTML()); $('#ctx').classList.add('tpk'); $('#tpkQ')?.focus();
}
function tagPickHTML() {
  const p = db.papers.find(x => x.id === TPK); if (!p) return '';
  return `<div class="ctxh">Etiquetas de «${esc(shortTxt(p.alias || p.title))}»</div>` + (db.tags.length > 8 ? `<input id="tpkQ" type="search" placeholder="Buscar etiqueta" aria-label="Buscar etiqueta" data-oninput="tagPickQ(this.value)">` : '')
    + `<div class="tpkc">${db.tags.map(t => chip(t, p.tagIds.includes(t.id), `tagPickT('${t.id}')`)).join('') || '<small>Aún no hay etiquetas.</small>'}</div>`
    + `<button class="tpkm" data-onclick="ctxClose();openMg('tags')">✎ Gestionar etiquetas</button>`;
}
function tagPickQ(v) { const q = norm(v); document.querySelectorAll('#ctx .tpkc .chip').forEach(c => { c.hidden = !!q && !norm(c.textContent).includes(q); }); }
function tagPickT(tid) {
  const p = db.papers.find(x => x.id === TPK), t = tagById(tid); if (!p || !t) return;
  const i = p.tagIds.indexOf(tid); i < 0 ? p.tagIds.push(tid) : p.tagIds.splice(i, 1); logChange(p, `Etiqueta ${i < 0 ? 'añadida' : 'quitada'}: ${t.name}`); markDirty();
  F.tags.size ? render() : renderPaper(p.id);
  const c = document.querySelector(`#ctx.tpk .tpkc .chip[data-onclick="tagPickT('${tid}')"]`); if (c) c.classList.toggle('on', i < 0);   // el menú sigue abierto (y la búsqueda, como estaba)
}
function delTagFrom(pid, tid) { const p = db.papers.find(x => x.id === pid); if (p) { p.tagIds = p.tagIds.filter(x => x !== tid); logChange(p, 'Etiqueta quitada: ' + (db.tags.find(t => t.id === tid)?.name || '?')); } ctxClose(); markDirty(); F.tags.size ? render() : renderPaper(pid); }
const ctxClose = () => { const m = $('#ctx'); if (m) { m.hidden = true; document.body.appendChild(m); } };
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) ctxClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { ctxClose(); fmClose(); } });
const fmClose = () => { $('#fmenu').hidden = true; $('#fmBtn').setAttribute('aria-expanded', 'false'); };   // menú «Archivo» de la cabecera
function fmToggle(e) { e.stopPropagation(); const m = $('#fmenu'), open = m.hidden; ctxClose(); m.hidden = !open; $('#fmBtn').setAttribute('aria-expanded', String(open)); }
document.addEventListener('click', e => { if (!e.target.closest('.fm')) fmClose(); });
document.addEventListener('contextmenu', e => { if (!e.target.closest('[data-oncontextmenu]')) ctxClose(); });   // clic derecho en otro sitio también cierra
function setSecF(id) { if (!id) F.secs.clear(); else if (!F.secs.delete(id)) F.secs.add(id); F.noSec = false; render(); }   // '' = Todas; como las etiquetas, cada sección se añade o se quita (se ven los papers de cualquiera de ellas)
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
function mgFit() {   // «✎ Gestionar» entero si cabe junto al título; si no, solo «✎»
  document.querySelectorAll('#sg-filt .fh2 .mgb').forEach(b => { const l = b.querySelector('.mgl'), t = b.parentElement.querySelector('.fhb b'); if (!l || !t) return;
    l.hidden = false; if (t.scrollWidth > t.clientWidth + 1) l.hidden = true; });
}
new ResizeObserver(() => mgFit()).observe($('#side'));   // al cambiar el ancho de la barra o abrir Filtros
function fsToggle(k, fold) {   // plegar un apartado de Filtros (Secciones, Etiquetas, Lectura)
  const el = $('#fs-' + k); if (!el) return; el.classList.toggle('fold', fold ?? !el.classList.contains('fold'));
  el.querySelector('.fhb').setAttribute('aria-expanded', !el.classList.contains('fold')); uiSoon();
}
function minRMenu(e) { ctxShow(e, '<div class="ctxh">Valoración mínima</div>' + [0, 1, 2, 3, 4, 5].map(n => `<button data-onclick="ctxClose();put(F,'minRating',${n},render)">${tick(F.minRating === n)}${n ? 'Al menos ' + '★'.repeat(n) : 'Cualquiera'}</button>`).join('')); }
function sbGroup(g) {   // con la barra plegada, pulsar un icono la despliega en ese grupo
  const a = $('#side'), el = $('#sg-' + g), wasMin = a.classList.contains('min');
  a.classList.remove('min'); wasMin ? el.classList.remove('fold') : el.classList.toggle('fold');
  if (g === 'search' && !el.classList.contains('fold')) { fsToggle('sort', false); $('#q').focus(); }   // al abrir Buscar, Ordenar sale desplegado
  uiSoon();
}
function cycleRead(id) { const p = db.papers.find(x => x.id === id); if (!p) return; const k = Object.keys(READ); const was = p.reading; p.reading = k[(k.indexOf(p.reading) + 1) % k.length]; logChange(p, `Lectura: ${READ[was]} → ${READ[p.reading]}`); markDirty(); renderPaper(id); }
function setRead(k) { F.read = k; render(); }
function svOpenF() { svOpen(F.secs.size === 1 ? sec1() : ''); }   // «📄 Notas» de Filtros: las de la sección elegida (con varias o ninguna, todas)
function noSecF() { F.noSec = !F.noSec; F.secs.clear(); render(); }
function toggleSel(id) { SEL.has(id) ? SEL.delete(id) : SEL.add(id);   // solo cambian la casilla, la barra de selección y el contador
  const c = $(`#list [data-id="${id}"] input[type=checkbox]`); if (c) c.checked = SEL.has(id); selDraw(); }
function selVisible() { visible().forEach(p => SEL.add(p.id)); render(); }
function selNone() { SEL.clear(); render(); }
function selAllP() { db.papers.forEach(p => SEL.add(p.id)); render(); }
/* Menú de ☑ (clic derecho, o mantener pulsado en el móvil): elegir y, con algo elegido, todo lo del grupo «Selección» de la barra lateral
   en un solo panel compacto. Lectura, valoración, etiquetas y secciones se aplican al momento y el panel se queda abierto. */
function selMenu(e) { ctxShow(e, selMenuHTML()); $('#ctx').classList.add('selm'); }
function selMenuHTML() {
  const v = visible().length, n = db.papers.length, k = SEL.size, S = selPapers(), b = (on, t, ti, c) => `<button${c ? ` class="${c}"` : ''} data-onclick="${on}"${ti ? ` title="${ti}"` : ''}>${t}</button>`;
  let h = `<div class="ctxh">☑ Selección${k ? ` · <b>${k}</b> ${k === 1 ? 'elegido' : 'elegidos'}` : ''}</div><div class="smr">${b('selVisible();selRedraw()', `☑ Los que se ven (${v})`, 'Seleccionar los papers que se ven')}${b('selAllP();selRedraw()', `☑ Todo el proyecto (${n})`, 'Seleccionar todos los papers del proyecto')}</div>`;
  if (!k) return h;
  const all = f => S.length && S.every(f), cls = (L, f) => L.length ? L.map(x => { const m = S.filter(p => p[f].includes(x.id)).length;
    return chip(x, m === S.length ? 1 : 0, `selCls('${f}','${x.id}')`).replace('class="chip', `class="chip${m && m < S.length ? ' part' : ''}`); }).join('') : '<small>Ninguna todavía.</small>';
  h += `<div class="sml">📖 Lectura</div><div class="seg smr">${Object.entries(READ).map(([r, t]) => b(`bulkRead('${r}',1)`, t, '', all(p => p.reading === r) ? 'on' : '')).join('')}</div>`
    + `<div class="sml">⭐ Valoración</div><div class="stars smr">${[1, 2, 3, 4, 5].map(i => b(`bulkRate(${i},1)`, '★', `Valorar con ${i} de 5`, all(p => p.rating >= i) ? 'on' : '')).join('')}${b('bulkRate(0,1)', '✕', 'Sin valorar', 'smx')}</div>`
    + `<div class="sml">🏷️ Etiqueta <small>clic: poner a todos o quitar</small></div><div class="smc">${cls(db.tags, 'tagIds')}</div>`
    + `<div class="sml">📁 Sección</div><div class="smc">${cls(db.sections, 'sectionIds')}</div>`
    + `<div class="smr sma">${b('ctxClose();openEx()', '📤 Exportar citas', 'Exportar las citas de los seleccionados', 'pri')}${b('ctxClose();psOpen()', '↪ A otro proyecto…', 'Mover o copiar a otro proyecto')}</div>`
    + `<div class="smr sma">${b('ctxClose();bulkTrash()', `🗑 Papelera (${k})`, 'Enviar a la papelera', 'danger')}${b('selNone();selRedraw()', '☐ Quitar selección')}</div>`;
  return h;
}
function selRedraw() { setTimeout(selDrawNow); }   // después del clic: el botón pulsado desaparece al repintar y el aviso de «clic fuera del menú» lo cerraría
function selDrawNow() {   // repinta el panel abierto sin moverlo de sitio (salvo para que quepa en la pantalla)
  const m = $('#ctx'); if (!m || m.hidden || !m.classList.contains('selm')) return; const st = m.scrollTop; m.innerHTML = selMenuHTML(); m.scrollTop = st;
  m.style.left = Math.max(0, Math.min(m.offsetLeft, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(0, Math.min(m.offsetTop, innerHeight - m.offsetHeight - 8)) + 'px';
}
function selCls(f, id) { const S = selPapers(), add = !S.every(p => p[f].includes(id)); f === 'tagIds' ? bulkTag(id, add, 1) : bulkSec(id, add, 1); }   // si no la tienen todos, se pone a todos; si ya la tienen, se quita

/* ---- Acciones en lote sobre la selección: lectura, valoración, etiquetas, secciones y papelera (un solo Ctrl+Z las deshace) ---- */
const selPapers = () => db.papers.filter(p => SEL.has(p.id));
const nPap = n => n === 1 ? '1 paper' : n + ' papers';
function bulkDo(fn, msg, keep) {   // keep: desde el panel de ☑, que se queda abierto
  if (!keep) ctxClose(); let n = 0; selPapers().forEach(p => { if (fn(p)) { n++; p.modified = new Date().toISOString(); } });
  if (n) { markDirty(); render(); }
  toast(n ? msg(n) : 'No había nada que cambiar.', n ? [{t: 'Deshacer', fn: undo}] : [], 5000); if (keep) selRedraw();
}
function bulkMenu(e, k) {
  const b = (on, t) => `<button data-onclick="${on}">${t}</button>`, S = selPapers();
  let h = '';
  if (k === 'read') h = '<div class="ctxh">Estado de lectura</div>' + Object.entries(READ).map(([v, t]) => b(`bulkRead('${v}')`, t)).join('');
  else if (k === 'rate') h = '<div class="ctxh">Valoración</div>' + [5, 4, 3, 2, 1, 0].map(n => b(`bulkRate(${n})`, n ? '★'.repeat(n) : 'Sin valorar')).join('');
  else {
    const L = k === 'tag' ? db.tags : db.sections, f = k === 'tag' ? 'tagIds' : 'sectionIds', fn = k === 'tag' ? 'bulkTag' : 'bulkSec', on = L.filter(x => S.some(p => p[f].includes(x.id)));
    if (!L.length) h = `<div class="ctxh">No hay ${k === 'tag' ? 'etiquetas' : 'secciones'}</div>`;
    else h = `<div class="ctxh">Añadir ${k === 'tag' ? 'etiqueta' : 'sección'}</div>` + L.map(x => b(`${fn}('${x.id}',1)`, '＋ ' + esc(x.name))).join('')
      + (on.length ? `<div class="ctxh">Quitar</div>` + on.map(x => b(`${fn}('${x.id}',0)`, '− ' + esc(x.name))).join('') : '');
  }
  ctxShow(e, h);
}
function bulkRead(v, keep) { bulkDo(p => { if (p.reading === v) return false; logChange(p, `Lectura: ${READ[p.reading]} → ${READ[v]}`); p.reading = v; return true; }, n => `${nPap(n)}: «${READ[v]}».`, keep); }
function bulkRate(v, keep) { bulkDo(p => { if (p.rating === v) return false; logChange(p, `Valoración: ${p.rating || '—'} → ${v || '—'}`); p.rating = v; return true; }, n => `Valoración cambiada en ${nPap(n)}.`, keep); }
function bulkList(f, id, add, name, what, keep) {
  bulkDo(p => { const i = p[f].indexOf(id); if (add ? i >= 0 : i < 0) return false; add ? p[f].push(id) : p[f].splice(i, 1); logChange(p, `${what} ${add ? 'añadida' : 'quitada'}: ${name}`); return true; },
    n => `«${name}» ${add ? 'añadida a' : 'quitada de'} ${nPap(n)}.`, keep);
}
function bulkTag(id, add, keep) { bulkList('tagIds', id, add, tagById(id)?.name || '?', 'Etiqueta', keep); }
function bulkSec(id, add, keep) { bulkList('sectionIds', id, add, secById(id)?.name || '?', 'Sección', keep); }
function bulkTrash() {
  ctxClose(); const ids = [...SEL].filter(id => db.papers.some(p => p.id === id)); if (!ids.length) return;
  ids.forEach(trashPaper); SEL.clear(); markDirty(); render();
  toast(`${nPap(ids.length)} a la papelera (se guardan ${TRASH_DAYS} días).`, [{t: 'Deshacer', fn: undo}], 6000);
}
/* ===== Exportar (texto, BibTeX, RIS, Word) y bibliografía ordenada ===== */
const ex = () => db.settings.export;
const EXF = {txt: ['Texto (.txt)', 'text/plain'], bib: ['BibTeX (.bib)', 'text/plain'], ris: ['RIS (.ris)', 'text/plain'], csl: ['CSL-JSON (.json: Zotero, Pandoc…)', 'application/json'], doc: ['Word (.doc)', 'application/msword'], docx: ['Word (.docx)', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']};
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
      if (o.notes) pNotes(p).forEach(n => t += `\n   [${noteLabel(n)}] ${mdPlain(n.content.trim())}`);
      return t; });
    return (S.h ? S.h + '\n\n' : '') + items.join('\n\n'); }).join('\n\n\n');
}
function exHtml(L, o) {   // sangría francesa de 1,27 cm (36 pt); las notas se exportan con su formato
  const body = exSecs(L, o).map(S => { const h = S.h ? `<h2 style="font-size:14pt">${esc(S.h)}</h2>` : '';
    if (S.lines) return h + S.lines.map(l => `<p style="margin:0 0 4pt">${citeHtml(l)}</p>`).join('');
    const sx = yearSuffixes(S.L, o);
    return h + S.L.map((p, i) => {
      const notes = o.notes ? pNotes(p).map(n => `<div style="margin:0 0 6pt 36pt;font-size:10pt"><i>[${esc(noteLabel(n))}]</i>${md(n.content)}</div>`).join('') : '';
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
      if (o.notes) pNotes(p).forEach(n => n.content.trim().split('\n').forEach((ln, j) => body.push(P(docxRuns(j ? '' : `*[${noteLabel(n)}]* `, 20) + noteRuns(ln, 20), '<w:spacing w:after="40"/><w:ind w:left="720"/>')))); }); }
  return docxPack(body.join(''));
}
function docxPack(bodyXml) {   // paquete .docx mínimo con el cuerpo dado (Times 12, A4, estilo Heading1)
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipStore([
    ['[Content_Types].xml', `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/></Relationships>`],
    ['word/styles.xml', `${H}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`],
    ['word/document.xml', `${H}<w:document ${W}><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`]]);
}
const wordDoc = (L, o) => `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Bibliografía</title></head><body>${exHtml(L, o)}</body></html>`;
const BIBK = {articulo: 'article', libro: 'book', capitulo: 'incollection', congreso: 'inproceedings', tesis: 'phdthesis', web: 'misc', prensa: 'article', blog: 'online', informe: 'techreport', norma: 'standard', patente: 'patent', dataset: 'dataset', software: 'software', audiovisual: 'video', audio: 'audio', legislacion: 'legislation', jurisprudencia: 'jurisdiction', mapa: 'misc', basedatos: 'misc', redsocial: 'misc', ia: 'misc', diccionario: 'misc', presentacion: 'misc', personal: 'misc'};
const BIBV = {informe: 'institution', norma: 'organization', patente: 'organization', mapa: 'organization', dataset: 'organization', software: 'organization', basedatos: 'organization', audiovisual: 'organization', audio: 'organization', redsocial: 'organization', ia: 'organization', diccionario: 'organization', presentacion: 'organization', personal: 'organization', legislacion: 'organization', jurisprudencia: 'institution', prensa: 'journal', blog: 'journal', articulo: 'journal', capitulo: 'booktitle', congreso: 'booktitle', tesis: 'school', libro: 'publisher'};
const STOPW = new Set(['the', 'and', 'for', 'del', 'los', 'las', 'una', 'con', 'por', 'que']);
const texEsc = s => String(s).replace(/([&%$#_])/g, '\\$1');
const bibName = (p, x) => { x = x.trim(); return p.authorType === 'entidad' || (p.authorType !== 'persona' && isOrg(x)) ? `{${texEsc(x)}}` : texEsc(x); };   // entidades entre llaves
/* ---- CSL-JSON (el formato de Zotero, Mendeley, Pandoc y citeproc) ---- */
const CSLT = {articulo: 'article-journal', libro: 'book', capitulo: 'chapter', congreso: 'paper-conference', tesis: 'thesis', web: 'webpage', prensa: 'article-newspaper', blog: 'post-weblog', informe: 'report',
  norma: 'standard', patente: 'patent', mapa: 'map', dataset: 'dataset', software: 'software', basedatos: 'dataset', audiovisual: 'motion_picture', audio: 'song', redsocial: 'post', ia: 'software',
  diccionario: 'entry-dictionary', presentacion: 'speech', personal: 'personal_communication', legislacion: 'legislation', jurisprudencia: 'legal_case'};
const CSL_PUB = new Set(['libro', 'tesis', 'informe', 'norma', 'patente', 'mapa', 'software', 'ia', 'presentacion']);   // en estos, «Revista / editorial» es la editorial o institución
const cslName = (p, a) => p.authorType === 'entidad' || !String(a).includes(',') ? {literal: a} : {family: a.split(',')[0].trim(), given: a.split(',').slice(1).join(',').trim()};
const cslDate = (y, d) => okDate(d) ? {'date-parts': [d.split('-').map(Number)]} : +y ? {'date-parts': [[+y]]} : undefined;
function cslItem(p) {
  p = effP(p); const ty = p.type, o = {id: p.id, type: CSLT[ty] || 'document', title: p.title};
  const au = p.authorType === 'sin_autor' ? [] : p.authors; if (au.length) o.author = au.map(a => cslName(p, a));
  if (p.editors?.length) o.editor = p.editors.map(a => cslName({}, a));
  const is = cslDate(p.year, p.pubDate); if (is) o.issued = is; if (okDate(p.accessed)) o.accessed = cslDate(0, p.accessed);
  if (p.venue) o[CSL_PUB.has(ty) ? 'publisher' : 'container-title'] = p.venue;
  if (p.publisher && !o.publisher) o.publisher = p.publisher;
  const f = {place: 'publisher-place', volume: 'volume', issue: 'issue', pages: 'page', edition: 'edition', isbn: 'ISBN', issn: 'ISSN', thesisType: 'genre', docNumber: 'number', ecli: 'authority', shorthand: 'title-short'};
  for (const [k, c] of Object.entries(f)) if (p[k]) o[c] = String(p[k]);
  if (p.doi) o.DOI = p.doi; if (/^https?:/i.test(p.url || '')) o.URL = p.url;
  return o;
}
const cslJSON = L => JSON.stringify(L.map(cslItem), null, 2);
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
    <div class="row" style="margin-top:10px"><button class="pri" data-onclick="exCopy()">Copiar</button><button id="exRich" data-onclick="exCopyRich()" title="Con sangría francesa, para pegar en Word o Docs">Copiar con formato</button><button data-onclick="exSave()">Guardar archivo</button><button data-onclick="sumOpen()" title="Cita completa de cada paper y debajo sus subrayados, comentarios y notas del PDF (Word, PDF o Markdown)">🖍 Resumen de anotaciones…</button><small id="exMsg"></small><button style="margin-left:auto" data-onclick="$('#ex').close()">Cerrar</button></div>`;
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
  $('#exText').value = o.fmt === 'bib' ? bibtex(L) : o.fmt === 'ris' ? ris(L) : o.fmt === 'csl' ? cslJSON(L) : exText(L, o);   // la vista previa es editable (salvo en Word)
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
  const o = ex(), L = exList(), [lbl, mime] = EXF[o.fmt]; if (!L.length) return say('No hay nada que exportar.');
  const text = o.fmt === 'doc' ? wordDoc(L, o) : o.fmt === 'docx' ? exDocx(L, o) : $('#exText').value;
  const ext = o.fmt === 'csl' ? 'json' : o.fmt;
  try { if (FSA) { const h = await showSaveFilePicker({suggestedName: 'citas.' + ext, types: [{description: lbl, accept: {[mime]: ['.' + ext]}}]}); await writeTo(h, text); }
    else download(text, 'citas.' + ext, mime); }
  catch (e) { if (e.name !== 'AbortError') say('Error al guardar: ' + e.message); }
}
document.querySelectorAll('dialog:not(#dlg)').forEach(d => {   // todas las ventanas se cierran con un clic fuera (sin tocar la de edición que haya debajo); la de editar paper guarda al salir, más abajo
  d.addEventListener('mousedown', e => bdDown = outside(e, d));
  d.addEventListener('click', e => { if (bdDown && outside(e, d)) { bdDown = false; d.close(); } });
});
function delPaper(id) {
  const p = db.papers.find(x => x.id === id); if (!p) return;
  lastRecAt = 0; trashPaper(id); SEL.delete(id); markDirty(); render();   // sin preguntar: se puede deshacer desde el aviso o la papelera
  toast(`«${shortTxt(p.alias || p.title)}» a la papelera (se guarda ${TRASH_DAYS} días).`, [{t: 'Deshacer', fn: undo}], 6000);
}
/* ---- Teclado en la lista: ↑/↓ (o j/k) para moverse, Intro para abrir, Espacio para seleccionar, Supr para la papelera, Esc para soltar ---- */
let KCUR = '';   // paper con el cursor del teclado
const kItems = () => [...document.querySelectorAll('#list [data-id]')].filter(e => e.matches('.card, tr.rw'));
function kMark(scroll) {
  document.querySelectorAll('#list .kcur').forEach(e => e.classList.remove('kcur'));
  const el = KCUR && $(`#list [data-id="${KCUR}"]`); if (!el) return;
  el.classList.add('kcur'); if (scroll) el.scrollIntoView({block: 'nearest'});
}
function kMove(d) {
  let L = kItems(); if (!L.length) return;
  let i = L.findIndex(e => e.dataset.id === KCUR);
  if (d > 0 && i === L.length - 1 && $('#list > .more')) { listMore(); L = kItems(); }   // al llegar al final se añade la siguiente parte
  i = i < 0 ? (d > 0 ? 0 : L.length - 1) : Math.max(0, Math.min(L.length - 1, i + d));
  KCUR = L[i].dataset.id; kMark(true);
}
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || TAB.passive) return;
  const t = e.target; if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) && !(t.type === 'checkbox' && t.closest('#list')) || t.isContentEditable) return;
  const k = e.key, has = KCUR && db.papers.some(p => p.id === KCUR);
  if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); kMove(1); }
  else if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); kMove(-1); }
  else if (!has) return;
  else if (k === 'Enter' || k === 'o') { e.preventDefault(); openPaper(KCUR); }
  else if (k === ' ' || k === 'x') { e.preventDefault(); toggleSel(KCUR); const c = $(`#list [data-id="${KCUR}"] input[type=checkbox]`); if (c) c.checked = SEL.has(KCUR); }
  else if (k === 'Delete') { e.preventDefault(); const L = kItems(), i = L.findIndex(x => x.dataset.id === KCUR), nx = L[i + 1] || L[i - 1]; const id = KCUR; delPaper(id); if (!db.papers.some(p => p.id === id)) { KCUR = nx ? nx.dataset.id : ''; kMark(true); } }
  else if (k === 'Escape') { KCUR = ''; kMark(); }
});
/* ---- Paleta de órdenes (Ctrl+K): busca acciones y papers por nombre ---- */
const CMDS = () => [
  ['＋ Nuevo paper', () => openPaper()], ['📥 Importar: buscar por DOI, ISBN o título', () => openImport('doi')], ['📄 Importar desde archivo', () => openImport('file')], ['📋 Importar: pegar BibTeX, RIS o citas', () => openImport('text')], ['🗃️ PDF sin cita a la bandeja «PDF por citar»', () => inboxPick()],
  ['📤 Exportar citas', () => openEx()], ['💾 Guardar', () => save(false)], ['💾 Guardar como…', () => save(true)], ['📂 Abrir un archivo JSON', () => doOpen()],
  ['⚙️ Configuración', () => openCfg()], ['❓ Ayuda', () => openHelp()], ['🗑️ Papelera', () => trOpen()], ['🕸️ Relaciones', () => grOpen()], ['🧬 Buscar duplicados', () => dpOpen()], ['🛟 Copias de seguridad', () => bkOpen()],
  [db.settings.view === 'table' ? '▦ Ver como tarjetas' : '☰ Ver como tabla', () => viewToggle()], ['☰ Plegar o desplegar la barra lateral', () => sbToggle()], ['☑ Seleccionar los visibles', () => selVisible()],
  ['✕ Quitar la selección', () => selNone()], ['🧹 Limpiar todos los filtros', () => fClrAll()], ['🔄 Sincronizar con Google Drive', () => syOn() ? syNow() : syConnect()], ['🔍 Buscar en la lista', () => SC_ACT.find()]];
let CMD = {q: '', i: 0, L: []};
function cmdOpen() { CMD = {q: '', i: 0, L: []}; const d = $('#cmdk');
  d.innerHTML = `<input id="cmdQ" type="search" placeholder="Escribe una acción o el título de un paper…" aria-label="Buscar acción o paper" autocomplete="off" data-oninput="cmdSet(this.value)" data-onkeydown="cmdKey(event)"><div id="cmdL" role="listbox"></div><small class="cmdh">↑/↓ para elegir · Intro para ejecutar · Esc para cerrar</small>`;
  cmdDraw(); d.showModal(); $('#cmdQ').focus(); }
function cmdSet(v) { CMD.q = v; CMD.i = 0; cmdDraw(); }
function cmdDraw() {
  const q = norm(CMD.q).trim(), w = q.split(/\s+/).filter(Boolean), ok = s => w.every(x => norm(s).includes(x));
  const A = CMDS().filter(([t]) => ok(t)).map(([t, fn]) => ({t, fn}));
  const P = w.length ? db.papers.filter(p => ok([p.alias, p.title, ...p.authors, p.year].join(' '))).slice(0, 8).map(p => ({t: '📄 ' + (p.alias || p.title) + (p.year ? ` (${p.year})` : ''), fn: () => openPaper(p.id)})) : [];
  CMD.L = [...A, ...P]; CMD.i = Math.min(CMD.i, Math.max(0, CMD.L.length - 1));
  $('#cmdL').innerHTML = CMD.L.length ? CMD.L.map((c, i) => `<button role="option" class="${i === CMD.i ? 'on' : ''}" aria-selected="${i === CMD.i}" data-onclick="cmdRun(${i})">${esc(c.t)}</button>`).join('') : '<p class="empty">Nada coincide.</p>';
  $('#cmdL .on')?.scrollIntoView({block: 'nearest'});
}
function cmdKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); CMD.i = (CMD.i + (e.key === 'ArrowDown' ? 1 : -1) + CMD.L.length) % (CMD.L.length || 1); cmdDraw(); }
  else if (e.key === 'Enter') { e.preventDefault(); cmdRun(CMD.i); }
}
function cmdRun(i) { const c = CMD.L[i]; if (!c) return; $('#cmdk').close(); c.fn(); }
/* arrastrar una cabecera de la tabla a otra posición (ordenador) */
document.addEventListener('dragstart', e => { const th = e.target.closest?.('.tbl th[data-col]'); if (!th) return; e.dataTransfer.setData('application/x-col', th.dataset.col); e.dataTransfer.effectAllowed = 'move'; th.classList.add('drag'); });
const colDropT = e => [...e.dataTransfer.types].includes('application/x-col') && e.target.closest?.('.tbl th[data-col]');
const colAfter = (e, th) => { const r = th.getBoundingClientRect(); return e.clientX > r.left + r.width / 2; };
document.addEventListener('dragover', e => { const th = colDropT(e); if (!th) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.colL,.colR').forEach(x => x.classList.remove('colL', 'colR')); th.classList.add(colAfter(e, th) ? 'colR' : 'colL'); });
document.addEventListener('drop', e => { const th = colDropT(e); document.querySelectorAll('.colL,.colR').forEach(x => x.classList.remove('colL', 'colR')); if (!th) return; e.preventDefault(); colMove(e.dataTransfer.getData('application/x-col'), th.dataset.col, colAfter(e, th)); });
document.addEventListener('dragend', () => document.querySelectorAll('.colL,.colR').forEach(x => x.classList.remove('colL', 'colR')));
