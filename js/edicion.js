'use strict';
/* ===== Edición de paper (trabaja sobre un borrador D) ===== */
function openPaper(id) {
  D = id ? structuredClone(db.papers.find(p => p.id === id)) : {id: uid(), created: new Date().toISOString(), title: '', alias: '', sortKey: '', related: [], refTo: [], history: [], reading: 'por_leer', rating: 0, sectionIds: F.sec ? [F.sec] : [], authors: [], year: '', url: '', type: 'articulo', venue: '', doi: '', accessed: '', general: '', tagIds: [], notes: [], cites: {}}; if (!id) NEWF(D);
  tab = 'all'; CITE_ALL = false; drawD(); $('#dlg').showModal();
}
const lbl = (k, def) => CTYPES.has(D.type) ? CTYPES.get(D.type).labels[k] || def : FLBL[k]?.[D.type] ?? def;   // etiqueta del campo según el tipo del borrador
const inp = (k, lbl, type = 'text', cls = '') => `<label class="${cls}">${lbl}<input type="${type}" data-k="${k}" value="${esc(D[k])}" data-oninput="put(D,'${k}',this.value)"></label>`;
const pdWarn = () => okDate(D.pubDate) && D.year && D.pubDate.slice(0, 4) !== String(D.year) ? `⚠ El año de la fecha (${D.pubDate.slice(0, 4)}) no coincide con «Año» (${D.year}): las citas usarán solo el año.` : '';
function pubSync() {   // fecha de publicación → rellena «Año» si está vacío y avisa si no coinciden (sin redibujar el formulario)
  if (okDate(D.pubDate) && !D.year) { D.year = +D.pubDate.slice(0, 4); const y = $('#dlg input[data-k="year"]'); if (y) y.value = D.year; }
  const w = $('#pdWarn'); if (w) w.textContent = pdWarn(); }
function drawD() {
  if (!TYPES[D.type]) D.type = 'articulo';
  const T = {all: 'Ver todo', data: 'Datos', cite: 'Cita', notes: 'Notas', cls: 'Secciones, etiquetas y relacionados', hist: 'Historial'};
  const blk = (id, t, body, always) => tab === 'all' || tab === 'cls' ? `<details class="cs" ${ALL_FOLD.has(id) ? '' : 'open'} data-ontoggle="setHas(ALL_FOLD,'${id}',!this.open)"><summary>${t}</summary><div class="csb">${body}</div></details>`   // en «Ver todo» cada bloque lleva su título y se pliega
    : (always ? `<h2 class="grp">${t}</h2>` : '') + body;
  let h = `<div class="dh"><h2>${esc(D.alias || D.title) || 'Nuevo paper'}</h2><div class="dbtn"><button class="pri" data-onclick="commit()">Guardar paper</button><button data-onclick="$('#dlg').close()">Cancelar</button></div></div><div class="tabs">${Object.entries(T).map(([k, v]) => `<button class="${tab === k ? 'on' : ''}" data-onclick="tabSet('${k}')">${v}</button>`).join('')}</div>`;
  if (tab === 'data' || tab === 'all') {   // vista simplificada (por defecto): lo básico + los campos que usa el estilo principal + los que ya tienen datos
    const R = relFields(D), top = [], rest = [], has = k => Array.isArray(D[k]) ? D[k].length > 0 : D[k] != null && D[k] !== '';
    const put = (on, html) => html && (on ? top : rest).push(html), rel = k => put(R.has(k) || has(k), ALWAYS_F.includes(k) || shows(k, D.type) ? fh(k) : '');
    const fh = k => ({url: inp('url', 'URL', 'url', 'w'), venue: inp('venue', lbl('venue', 'Revista / editorial / sitio')), accessed: inp('accessed', 'Fecha de consulta', 'date'),
      doi: `<label>DOI (sin https://doi.org/)<span class="row" style="flex-wrap:nowrap"><input style="flex:1;min-width:0" value="${esc(D.doi)}" data-oninput="put(D,'doi',this.value)"><button data-onclick="doiFill()" title="Rellenar con los datos de CrossRef">Buscar</button></span></label>`,
      volume: inp('volume', 'Volumen'), issue: inp('issue', lbl('issue', 'Número')), pages: inp('pages', 'Páginas (p. ej. 73-98)'), edition: inp('edition', lbl('edition', 'Edición (desde la 2.ª; p. ej. «2.ª»)')),
      publisher: inp('publisher', lbl('publisher', 'Editorial (del libro o actas)')), place: inp('place', lbl('place', 'Lugar de edición')),
      editors: `<label class="w">Editores del libro (uno por línea: «Apellido, Nombre»)<textarea data-oninput="put(D,'editors',lines(this.value))">${esc(D.editors.join('\n'))}</textarea></label>`,
      subtype: `<label>${esc(lbl('subtype', `Designación (opcional; p. ej. «${(FSUB[baseT(D.type)] || [''])[0]}»)`))}<input type="text" data-k="subtype" list="dl_sub" value="${esc(D.subtype)}" data-oninput="put(D,'subtype',this.value)"><datalist id="dl_sub">${(FSUB[baseT(D.type)] || []).map(v => `<option value="${esc(v)}">`).join('')}</datalist></label>`,
      authorRole: inp('authorRole', 'Función del autor (p. ej. Director, Presentador)'), userHandle: inp('userHandle', 'Usuario (sin @)'),
      pubDate: `<label>${lbl('pubDate', 'Fecha de publicación completa')}<input type="date" data-k="pubDate" value="${esc(D.pubDate)}" data-oninput="put(D,'pubDate',this.value,pubSync)"><small id="pdWarn">${pdWarn()}</small></label>`,
      thesisType: `<label>Tipo de trabajo<select data-onchange="put(D,'thesisType',this.value)"><option value="">(sin especificar)</option>${THESIS.map(v => `<option ${D.thesisType === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`,
      ...Object.fromEntries([['isbn', 'ISBN'], ['issn', 'ISSN'], ['institution', 'Institución (facultad, departamento…)'], ['docNumber', 'Número de documento'], ['series', 'Serie o colección'], ['seriesNumber', 'Número en la serie'], ['conferenceName', 'Nombre del congreso'], ['conferencePlace', 'Lugar del congreso'], ['conferenceDates', 'Fechas del congreso'], ['abbr', 'Abreviatura'], ['ecli', 'ECLI (p. ej. ECLI:ES:TS:2017:1229 o EU:C:2005:446)']].map(([k, l]) => [k, inp(k, lbl(k, l))]))})[k];
    put(has('sortKey'), inp('sortKey', 'Clave de orden en la bibliografía (opcional): p. ej. «Torre» para «de la Torre, Ana»', 'text', 'w'));
    rel('url');
    put(!!D.pdf, `<div class="w pdfrow"><span>📄 PDF: ${D.pdf ? `<b>${esc(D.pdf.name)}</b>` : '<i>ninguno</i>'}</span><button data-onclick="pdfPick()">${D.pdf ? 'Cambiar…' : 'Enlazar un PDF…'}</button>${D.pdf ? `<button data-onclick="pdfOpen('${D.id}')">Abrir</button><label>Página <input type="number" min="1" style="width:5em" value="${D.pdf.page || ''}" data-oninput="pdfSetPage(this.value)" placeholder="1"></label><button class="x" data-onclick="pdfClear()" title="Quitar el enlace al PDF">✕</button>` : ''}<small>${db.settings.pdfDrive ? 'El PDF se copia a tu Google Drive privado (Configuración).' : 'El archivo no se sube a ningún sitio: solo se recuerda su nombre.'}</small></div>`);
    ['venue', 'doi', 'accessed'].forEach(rel);
    put((D.linkMode || 'auto') !== 'auto', `<label>Enlace en la cita (si hay DOI y URL)<select data-onchange="put(D,'linkMode',this.value)">${Object.entries(LINK_MODES).map(([k, v]) => `<option value="${k}" ${D.linkMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`);
    put(!!D.hideAccessed, `<label class="chk"><input type="checkbox" ${D.hideAccessed ? 'checked' : ''} data-onchange="put(D,'hideAccessed',this.checked)"> Omitir «[consultado …]» en la cita (aunque la fecha esté rellena)</label>`);
    put((D.authorType || 'auto') !== 'auto', `<label>Tipo de autor<select data-onchange="put(D,'authorType',this.value)">${Object.entries(AUTH_T).map(([k, v]) => `<option value="${k}" ${D.authorType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`);
    ['volume', 'issue', 'pages', 'edition', 'publisher', 'place', 'editors', 'isbn', 'issn', 'institution', 'docNumber', 'series', 'seriesNumber', 'conferenceName', 'conferencePlace', 'conferenceDates', 'abbr', 'ecli', 'subtype', 'authorRole', 'userHandle', 'pubDate', 'thesisType'].forEach(rel);
    const more = rest.length ? `<div class="w dmore"><button data-onclick="dataAllSet(!DATA_ALL)" aria-expanded="${DATA_ALL}">${DATA_ALL ? 'Ver solo los campos principales ▴' : `Mostrar todos los campos (${rest.length} más) ▾`}</button><small>Campos principales según tu estilo de cita principal, <b>${esc(STYLES[mainSty()].name)}</b> (se cambia en Configuración → Notas y citas). Los campos con datos siempre se ven.</small></div>` : '';
    h += blk('data', 'Datos', `<div class="grid"><div class="w titlerow"><div class="pimgbox">${pimgHTML(D, 'big', `role="button" tabindex="0" data-onclick="imgOpen()" title="Imagen del paper (opcional): pulsa para poner una URL o un archivo, o pega una imagen copiada con Ctrl+V"`)}</div><div class="titlecol">${inp('title', lbl('title', 'Título *'))}${DATA_ALL || has('alias') ? inp('alias', 'Título personalizado (opcional; solo para mostrar, la cita usa el título original)') : ''}</div></div>
    <label class="w">Autores (uno por línea: «Apellido, Nombre»)<textarea data-oninput="put(D,'authors',lines(this.value))">${esc(D.authors.join('\n'))}</textarea></label>
    <label>Año<input type="number" data-k="year" value="${esc(D.year)}" data-oninput="put(D,'year',this.value,pubSync)"></label><label>Tipo<select data-onchange="typeChange(this.value)">${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([k, v]) => `<option value="${k}" ${D.type === k ? 'selected' : ''}>${v}</option>`).join('')}${CTYPES.size ? `<optgroup label="Tipos propios">${[...CTYPES].map(([k, t]) => `<option value="${k}" ${D.type === k ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>` : ''}<option value="__new">➕ Crear un tipo propio…</option></select></label>
    ${top.join('')}${DATA_ALL && rest.length ? `<div class="w dsep"><span>Otros campos</span><button data-onclick="dataAllSet(false)" title="Ocultar los campos que no usa tu estilo principal">Ocultar ▴</button></div>${rest.join('')}` : ''}${more}
    <div class="w"><small>Lectura</small><div class="seg">${Object.entries(READ).map(([k, v]) => `<button class="${D.reading === k ? 'on' : ''}" data-onclick="put(D,'reading','${k}',drawD)">${v}</button>`).join('')}</div></div>
    <div class="w"><small>Valoración</small><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${D.rating >= n ? 'on' : ''}" aria-label="Valorar con ${n} de 5" data-onclick="dRate(${n})">★</button>`).join('')}</div></div>
    </div>`);
  }
  if (tab === 'notes' || tab === 'all') h += blk('gen', 'Notas generales', edBox('gen', D.general), true);
  
  if (tab === 'notes' || tab === 'all') h += blk('notes', 'Notas por sección', (db.sections.length ? '' : '<p class="empty">Crea primero una sección con «Gestionar secciones».</p>') +
    D.notes.map((n, i) => `<div class="card"><div class="row"><select data-onchange="noteSec(${i},this.value)">${db.sections.map(s => `<option value="${s.id}" ${n.sectionId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <button class="danger" data-onclick="noteDel(${i})">Quitar</button></div>${edBox(n.id, n.content)}</div>`).join('') +
    (db.sections.length ? `<button data-onclick="addNote()" data-oncontextmenu="addNoteMenu(event)" title="Clic derecho: nueva nota con plantilla">+ Añadir nota</button><button data-onclick="addNoteMenu(event)" title="Nueva nota con plantilla">▾</button>` : ''), true);
  const citeOne = (k, s) => `<h3>${s.name}${D.cites[k] != null ? ' (editada a mano)' : ''}</h3>${typeWarn(k, D.type) ? `<small>⚠ ${esc(typeWarn(k, D.type))}</small>` : ''}
    <div class="ced" id="c_${k}" data-k="${k}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Cita ${esc(s.name)}" data-oninput="put(D.cites,'${k}',ceVal(this))">${ceHtml(D.cites[k] ?? s.fn(D))}</div>
    <div class="row"><button data-onclick="copyC('${k}',0,this)">Copiar</button><button data-onclick="copyC('${k}',1,this)" title="Con cursiva, para pegar en Word o Docs">Copiar con formato</button><button data-onclick="citeDel('${k}')">Regenerar desde los datos</button></div>${ex().inText ? `<div class="itx" id="it_${k}">${itHtml(k)}</div>` : ''}`;
  const fold = tab === 'all' || tab === 'cls';   // «Ver todo» y la pestaña de clasificación comparten diseño: bloques plegables
  if (fold) {
    h += blk('secs', 'Secciones', db.sections.map(s => chip(s, D.sectionIds.includes(s.id), `toggleS('${s.id}')`)).join('') || '<p class="empty">No hay secciones. Créalas con «Gestionar secciones».</p>', true);
  }
  if (tab === 'cite' || tab === 'all') {
    const M = mainSty(), only = db.settings.citeOnlyMain && !CITE_ALL;
    h += blk('cite', 'Cita', citeBar() + (ex().inText ? `<label>Página o parte citada (opcional, para la cita en el texto y las notas)<input id="locIn" value="${esc(CLOC)}" placeholder="${LAW_T.has(baseT(D.type)) ? 'p. ej. 22.1 (artículo) o 3 (FJ, FD o apartado)' : 'p. ej. 87 o 87-90'}" data-oninput="clocSet(this.value)"></label>` : '')
      + (tab === 'all' ? `<label>Estilo<select data-onchange="citeSelSet(this.value)">${styOpts(citeSel())}</select></label>` + citeOne(citeSel(), STYLES[citeSel()])
        : `<h2 class="grp">Estilo principal</h2>` + citeOne(M, STYLES[M]) + (only ? `<p><button data-onclick="citeAllOn()">Ver todos los estilos</button> <small>Configuración → Notas y citas: «mostrar solo el estilo principal».</small></p>`
          : STY_G.map(([g, t]) => { const E = Object.entries(STYLES).filter(([k, s]) => k !== M && styGroup(s) === g), id = g || 'gen';   // el resto, en secciones plegables (cerradas salvo que las abras)
            return E.length ? `<details class="cs cgrp" data-g="${id}" ${CITE_OPEN.has(id) ? 'open' : ''} data-ontoggle="setHas(CITE_OPEN,'${id}',this.open)"><summary>${t} <small>(${E.length})</small></summary><div class="csb">${E.map(([k, s]) => citeOne(k, s)).join('')}</div></details>` : ''; }).join(''))), false);
  }
  if (fold) {
    h += blk('tags', 'Etiquetas', db.tags.map(t => chip(t, D.tagIds.includes(t.id), `toggleT('${t.id}')`)).join('') || '<p class="empty">No hay etiquetas. Créalas con «Gestionar etiquetas».</p>', true);
  }
  if (fold) {
    const chips = (ids, color, del) => ids.map(id => db.papers.find(p => p.id === id)).filter(Boolean).map(p => chip({name: shortTxt(p.alias || p.title) + (del ? ' ✕' : ''), color}, 1, del ? `${del}('${p.id}')` : '')).join('');
    const by = db.papers.filter(q => (q.refTo || []).includes(D.id)).map(q => q.id);
    h += blk('rel', 'Relacionados', `<div><small>Relacionados</small></div><div>${chips(D.related, '#6b45c2', 'relDel') || '<small>Ninguno.</small>'}</div>
      <div style="margin-top:6px"><small>Este paper cita a</small></div><div>${chips(D.refTo, '#0f8b8d', 'refDel') || '<small>Ninguno.</small>'}</div>
      <div style="margin-top:6px"><small>Citado por (otros papers que lo citan)</small></div><div>${chips(by, '#888888') || '<small>Ninguno.</small>'}</div>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap"><select style="width:auto" data-onchange="reltSet(this.value)"><option value="rel" ${RELT === 'rel' ? 'selected' : ''}>Relacionar con</option><option value="ref" ${RELT === 'ref' ? 'selected' : ''}>Cita a</option></select><input id="relQ" placeholder="Buscar un paper…" data-oninput="relSearch()" style="flex:1;min-width:0"></div><div id="relRes"></div>`);
  }
  if (tab === 'hist') h += `<div class="hist">${D.history.filter(e => isToday(e.t)).reverse().map(e => `<div class="he"><small>${new Date(e.t).toLocaleString('es-ES')}</small> ${esc(e.s)}</div>`).join('') || '<small>Sin cambios hoy.</small>'}</div><small>Solo lectura. Solo muestra los cambios de hoy y no se guarda en el archivo. Creado el ${D.created ? new Date(D.created).toLocaleDateString('es-ES') : '—'}.</small>`;
  $('#dlg').innerHTML = h; hydrateImgs();
}
let bdDown = false;   // clic fuera del cuadro de edición = guardar y salir (un paper nuevo en blanco solo se cierra)
const outside = (e, el) => { if (e.target !== el) return false; const r = el.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };   // en el fondo, no en un menú (#ctx) que asome por fuera
$('#dlg').addEventListener('mousedown', e => bdDown = outside(e, e.currentTarget));   // evita cerrar al arrastrar una selección de texto hacia fuera
$('#dlg').addEventListener('click', e => { if (!bdDown || !outside(e, e.currentTarget)) return; bdDown = false;
  !D.title.trim() && !db.papers.some(p => p.id === D.id) && !D.authors.length && !D.url && !D.notes.length ? $('#dlg').close() : commit(); });
/* ===== Notas: formato (Markdown limitado) y plantillas ===== */
/* Marcas de las notas: **negrita**, *cursiva*, ~~tachado~~, __subrayado__ (anidables); \* \_ \~ \\ \[ son literales.
   La nota se guarda como texto con marcas; el editor (contenteditable) las muestra ya aplicadas y las vuelve a escribir al guardar. */
const MK = {'**': 'strong', '__': 'u', '~~': 's', '*': 'em'}, MK_ORDER = ['**', '__', '~~', '*'];
function mdParse(s, i = 0, stop = '') {   // → [nodos, posición]; null si falta el cierre de `stop`
  const out = [], st = i; let txt = '';
  const flush = () => { if (txt) { out.push({t: 'x', v: txt}); txt = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && /[*_~\\[]/.test(s[i + 1] || '')) { txt += s[i + 1]; i += 2; continue; }
    if (c === '\u200b') { i++; continue; }
    if (stop && s.startsWith(stop, i) && i > st && !/\s/.test(s[i - 1])) { flush(); return [out, i + stop.length]; }
    if (c === '[') { const m = /^\[\[([pn]):([\w-]+)\]\]/.exec(s.slice(i, i + 80)); if (m) { flush(); out.push({t: 'l', k: m[1], id: m[2]}); i += m[0].length; continue; } }
    let hit = false;
    for (const d of MK_ORDER) {
      const nx = s[i + d.length];
      if (!s.startsWith(d, i) || !nx || /\s/.test(nx) || (d === '*' && nx === '*') || (d !== '~~' && /\w/.test(s[i - 1] || ' '))) continue;
      const r = mdParse(s, i + d.length, d);
      if (r) { flush(); out.push({t: MK[d], c: r[0]}); i = r[1]; hit = true; break; }
    }
    if (hit) continue;
    txt += c; i++;
  }
  if (stop) return null;
  flush(); return [out, i];
}
const mdNodes = t => mdParse(String(t ?? ''))[0];
const nodesHtml = (ns, edit) => ns.map(n => n.t === 'x' ? esc(n.v) : n.t === 'l' ? (h => edit ? h.replace(/^<(a|span) /, '<$1 contenteditable="false" ') : h)(linkHTML(n.k, n.id)) : `<${n.t}>${nodesHtml(n.c, edit)}</${n.t}>`).join('');
const mdInline = (t, edit) => nodesHtml(mdNodes(t), edit);
const nodesPlain = ns => ns.map(n => n.t === 'x' ? n.v : n.t === 'l' ? '[' + (linkInfo(n.k, n.id)?.label || '⚠ enlace roto') + ']' : nodesPlain(n.c)).join('');
const mdPlain = t => String(t ?? '').split('\n').map(l => nodesPlain(mdNodes(l))).join('\n');   // sin marcas (exportar a texto)
const noteRuns = (s, sz) => {   // marcas de nota → runs de Word (orden del esquema: b, i, strike, sz, u)
  const run = (ns, f) => ns.map(n => n.t === 'x' || n.t === 'l' ? (t => `<w:r><w:rPr>${f.b ? '<w:b/>' : ''}${f.i ? '<w:i/>' : ''}${f.s ? '<w:strike/>' : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}${f.u ? '<w:u w:val="single"/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`)(n.t === 'x' ? n.v : nodesPlain([n]))
    : run(n.c, {...f, [{strong: 'b', em: 'i', s: 's', u: 'u'}[n.t]]: 1})).join('');
  return run(mdNodes(s), {});
};
function md(text) {   // se escapa todo el HTML antes de aplicar el formato; la nota se guarda siempre como texto plano
  const out = []; let list = null, para = [];
  const fl = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  const fp = () => { if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; } };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const b = /^\s*[-•]\s+(.*)$/.exec(line), n = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (b || n) { fp(); const tag = b ? 'ul' : 'ol'; if (list && list.tag !== tag) fl(); (list ??= {tag, items: []}).items.push(mdInline((b || n)[1])); }
    else if (!line.trim()) { fl(); fp(); }
    else { fl(); para.push(mdInline(line)); }
  }
  fl(); fp();
  return out.join('');
}
/* ---- Editor de notas (contenteditable): texto con marcas ⇄ DOM ---- */
function mdEdit(text) {   // una línea del texto = un <div> (o un <li>), para que ida y vuelta no cambie nada
  const out = []; let list = null;
  const fl = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const b = /^\s*[-•]\s+(.*)$/.exec(line), n = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (b || n) { const tag = b ? 'ul' : 'ol'; if (list && list.tag !== tag) fl(); (list ??= {tag, items: []}).items.push(mdInline((b || n)[1], 1) || '<br>'); }
    else { fl(); out.push(`<div>${mdInline(line, 1) || '<br>'}</div>`); }
  }
  fl(); return out.join('') || '<div><br></div>';
}
const escMd = t => t.replace(/\u200b/g, '').replace(/\u00a0/g, ' ').replace(/\\(?=[*_~\\[])/g, '\\\\').replace(/\*/g, '\\*').replace(/__/g, '\\_\\_').replace(/~~/g, '\\~\\~').replace(/\[\[/g, '\\[[');
function serInline(el) {
  let o = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) { o += escMd(n.data); continue; }
    if (n.nodeType !== 1) continue;
    const tg = n.tagName;
    if (tg === 'BR') { if (n.nextSibling) o += '\n'; continue; }
    if (n.dataset?.t && n.dataset?.id && /^(A|SPAN)$/.test(tg)) { o += `[[${n.dataset.t}:${n.dataset.id}]]`; continue; }
    const inner = serInline(n), css = n.style || {};
    const mk = /^(STRONG|B)$/.test(tg) || /^(bold|[6-9]00)$/.test(css.fontWeight) ? '**' : /^(EM|I)$/.test(tg) || css.fontStyle === 'italic' ? '*'
      : /^(S|STRIKE|DEL)$/.test(tg) || /line-through/.test(css.textDecoration || css.textDecorationLine) ? '~~' : tg === 'U' || /underline/.test(css.textDecoration || css.textDecorationLine) ? '__' : '';
    if (!mk) { o += inner; continue; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner); o += m[2] ? m[1] + mk + m[2] + mk + m[3] : inner;   // los espacios de los bordes quedan fuera de la marca
  }
  return o;
}
function serEd(root) {   // DOM del editor → texto con marcas
  const out = [], BLK = /^(DIV|P|UL|OL|LI|H[1-6]|BLOCKQUOTE|PRE)$/, lines = el => serInline(el).split('\n');
  const walk = par => {
    let run = []; const flush = () => { if (run.length) { const d = document.createElement('div'); run.forEach(x => d.appendChild(x.cloneNode(true))); out.push(...lines(d)); run = []; } };
    for (const n of par.childNodes) {
      if (n.nodeType === 1 && BLK.test(n.tagName)) { flush();
        if (/^(UL|OL)$/.test(n.tagName)) [...n.children].forEach((li, k) => out.push(...lines(li).map((l, j) => j ? l : (n.tagName === 'UL' ? '- ' : (k + 1) + '. ') + l)));
        else if (n.querySelector('div,ul,ol,p')) walk(n); else out.push(...lines(n)); }
      else run.push(n);
    }
    flush();
  };
  walk(root); while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}
const noteVal = key => key === 'gen' ? D.general : D.notes.find(n => n.id === key)?.content ?? '';
const setNoteVal = (key, v) => { if (key === 'gen') D.general = v; else { const n = D.notes.find(x => x.id === key); if (n) n.content = v; } };
const edEl = key => document.getElementById('ed_' + key);
const ED_RANGE = {};   // última selección de cada editor (para insertar plantillas y enlaces tras abrir un menú o ventana)
document.addEventListener('selectionchange', () => { const s = getSelection(); if (!s.rangeCount) return;
  const el = (s.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode)?.closest?.('.ned'); if (el) ED_RANGE[el.dataset.key] = s.getRangeAt(0).cloneRange(); });
function edFocus(key) {
  const el = edEl(key); if (!el) return null; const r = ED_RANGE[key], s = getSelection();
  if (!(s.rangeCount && el.contains(s.anchorNode))) { el.focus(); if (r && el.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } }
  return el;
}
function edSync(el) { setNoteVal(el.dataset.key, serEd(el)); }
function edCmd(key, cmd) { const el = edFocus(key); if (!el) return; document.execCommand('styleWithCSS', false, false); document.execCommand(cmd); edSync(el); }
function edInsert(key, text, link) { const el = edFocus(key); if (!el) return; document.execCommand('insertHTML', false, link ? mdInline(text, 1) + '\u200b' : mdEdit(text)); edSync(el); }
const MK_RX = {'**': /(^|[^\w\\*])\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*$/, '__': /(^|[^\w\\_])__([^\s_](?:[^_]*?[^\s_])?)__$/, '~~': /(^|[^\\~])~~([^\s~](?:[^~]*?[^\s~])?)~~$/, '*': /(^|[^\w\\*])\*([^\s*](?:[^*]*?[^\s*])?)\*$/};
function edAuto(ch) {   // como en WhatsApp: al cerrar una marca el texto toma el formato; «- » o «1. » al empezar línea crea una lista
  const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return; const nd = s.anchorNode; if (nd.nodeType !== 3 || nd.parentElement.closest('a.nl')) return;
  const off = s.anchorOffset, txt = nd.data.slice(0, off);
  if (ch === ' ') {
    const blk = nd.parentElement.closest('div,li'); if (!blk || blk.tagName === 'LI' || blk.classList.contains('ned')) return;
    const r = document.createRange(); r.setStart(blk, 0); r.setEnd(nd, off); const pre = r.toString().replace(/\u00a0/g, ' ');
    if (/^(?:[-•]|\d+\.) $/.test(pre)) { r.deleteContents(); document.execCommand(/^\d/.test(pre) ? 'insertOrderedList' : 'insertUnorderedList'); }
    return;
  }
  for (const d of MK_ORDER) {
    const m = MK_RX[d].exec(txt); if (!m) continue;
    const start = m.index + m[1].length, r = document.createRange(); r.setStart(nd, start); r.setEnd(nd, off); r.deleteContents();
    const el = document.createElement(MK[d]); el.textContent = m[2]; r.insertNode(el);
    const z = document.createTextNode('\u200b'); el.after(z);
    const c = document.createRange(); c.setStart(z, 1); c.collapse(true); s.removeAllRanges(); s.addRange(c); return;
  }
}
$('#dlg').addEventListener('input', e => { const el = e.target.closest?.('.ned'); if (!el) return;
  if (e.inputType === 'insertText' && e.data && '*_~ '.includes(e.data)) edAuto(e.data); edSync(el); });
$('#dlg').addEventListener('paste', e => { const el = e.target.closest?.('.ned'); if (!el) return; e.preventDefault();
  const t = e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, /\n/.test(t) ? mdEdit(t) : mdInline(t, 1)); edSync(el); });
['copy', 'cut'].forEach(ev => $('#dlg').addEventListener(ev, e => {   // al copiar, el texto lleva las marcas; el HTML, el formato
  const el = e.target.closest?.('.ned'), s = getSelection(); if (!el || !s.rangeCount || s.isCollapsed) return;
  const w = document.createElement('div'); w.appendChild(s.getRangeAt(0).cloneContents());
  e.clipboardData.setData('text/plain', serEd(w)); e.clipboardData.setData('text/html', w.innerHTML); e.preventDefault();
  if (ev === 'cut') { document.execCommand('delete'); edSync(el); } }));
const edBox = (key, text) => `<div class="nbox" data-key="${key}">
  <div class="fmtw ${fmtPinned || FMT_OPEN.has(key) ? 'open' : ''}" data-id="${key}" data-onmousedown="event.preventDefault()"><button class="fmth" title="Mostrar u ocultar la barra de formato" data-onclick="toggleFmt('${key}')">Aa</button><div class="fmtc"><div class="fmt">
    <button title="Negrita (${db.settings.shortcuts.bold})" data-onclick="edCmd('${key}','bold')"><b>N</b></button><button title="Cursiva (${db.settings.shortcuts.italic})" data-onclick="edCmd('${key}','italic')"><i>K</i></button><button title="Tachado" data-onclick="edCmd('${key}','strikeThrough')"><s>T</s></button><button title="Subrayado" data-onclick="edCmd('${key}','underline')"><u>S</u></button>
    <button title="Lista con viñetas" data-onclick="edCmd('${key}','insertUnorderedList')">•</button><button title="Lista numerada" data-onclick="edCmd('${key}','insertOrderedList')">1.</button><button data-onclick="tplMenu(event,'${key}')">Plantilla ▾</button><button title="Insertar enlace a un paper o a una nota" data-onclick="lkOpen('${key}')">🔗</button>
    <button class="pin ${fmtPinned ? 'on' : ''}" title="Chincheta: mantiene la barra desplegada en todas las notas" data-onclick="togglePin()">📌</button></div></div></div><div class="ned md" id="ed_${key}" data-key="${key}" contenteditable="true" role="textbox" aria-multiline="true">${mdEdit(text)}</div></div>`;

let fmtPinned = false;   // chincheta: barras desplegadas en TODAS las notas (valor inicial: Configuración)
const FMT_OPEN = new Set();   // notas cuya barra se desplegó una a una, sin chincheta
function paintFmt() {   // cambia solo las clases, sin redibujar la ventana, para que la animación se vea
  document.querySelectorAll('#dlg .fmtw').forEach(el => el.classList.toggle('open', fmtPinned || FMT_OPEN.has(el.dataset.id)));
  document.querySelectorAll('#dlg .pin').forEach(b => b.classList.toggle('on', fmtPinned));
}
function toggleFmt(id) { if (fmtPinned) return; FMT_OPEN.has(id) ? FMT_OPEN.delete(id) : FMT_OPEN.add(id); paintFmt(); }
function togglePin() { fmtPinned = !fmtPinned; paintFmt(); }
function setFmtDefault(v) { setCfg('fmtOpen', v); fmtPinned = v; paintFmt(); }
const ALL_FOLD = new Set();   // bloques plegados en «Ver todo»
let CITE_SEL = '';   // estilo de cita mostrado en «Ver todo»
const mainSty = () => STYLES[db.settings.mainStyle] ? db.settings.mainStyle : 'apa';   // estilo de cita principal (Configuración); si se borró un estilo propio, APA
const citeSel = () => STYLES[CITE_SEL] ? CITE_SEL : mainSty();
const ALWAYS_F = ['url', 'venue', 'doi', 'accessed'];   // campos de «Datos» que salen en todos los tipos (los demás, según shows)
const PROBE_V = {url: 'https://ejemplo.org/a', doi: '10.1234/abc', accessed: '2024-05-06', pubDate: '2020-03-04', editors: ['Gómez, Luis'], thesisType: THESIS[0], pages: '11-22', volume: '7', issue: '3', edition: '2.ª', place: 'Madrid', conferenceDates: '1-3 de junio'};
function relFields(p, st = mainSty()) {   // campos que el estilo usa para el tipo de p: se prueba la cita vaciando cada uno en un paper completo y rellenándolo en uno mínimo
  const S = STYLES[st], F = [...ALWAYS_F, ...STR_F, 'editors'].filter(k => ALWAYS_F.includes(k) || shows(k, p.type));
  const val = k => PROBE_V[k] ?? 'Zq' + k, nil = k => k === 'editors' ? [] : '';
  const cite = x => { try { return (S.fn(x, ex()) || '') + JSON.stringify(S.inText?.(x, ex(), '') || []); } catch { return ''; } };   // también la cita en el texto (abreviaturas)
  const min = {...p, cites: {}, linkMode: 'auto', hideAccessed: false, authorType: 'auto', title: 'Título de prueba', authors: ['Pérez, Ana'], year: 2020, ...Object.fromEntries(F.map(k => [k, nil(k)]))};
  const full = {...min, ...Object.fromEntries(F.map(k => [k, val(k)]))}, c0 = cite(min), c1 = cite(full);
  const R = new Set(F.filter(k => cite({...full, [k]: nil(k)}) !== c1 || cite({...min, [k]: val(k)}) !== c0));
  return R.size ? R : new Set(F);   // si el estilo no da cita para este tipo, se ve todo
}
const CITE_OPEN = new Set();   // secciones de estilos abiertas en la pestaña Cita
let CITE_ALL = false, DATA_ALL = false;   // «Ver todos los estilos» puntual (con «solo el principal») y Datos desplegado (se recuerda en la sesión)
let CITE_TA = '';   // última cita con el foco: la barra de formato de la pestaña Cita actúa sobre ella
/* Cada cita se edita ya con su formato (cursiva y negrita reales) y se guarda con las marcas de siempre: *cursiva*, **negrita**, \* literal. */
const ceHtml = t => citeHtml(t).replace(/\n/g, '<br>');
function ceVal(el) {   // DOM del cuadro de cita → texto con marcas
  const run = (n, f) => [...n.childNodes].map(c => { if (c.nodeType === 3) return c.data.replace(/\u00a0/g, ' ').replace(/\*/g, '\\*'); if (c.nodeType !== 1) return '';
    if (c.tagName === 'BR') return c.nextSibling ? '\n' : ''; const st = c.style || {}, blk = /^(DIV|P)$/.test(c.tagName) && c.previousSibling ? '\n' : '';
    const b = /^(B|STRONG)$/.test(c.tagName) || /^(bold|[6-9]00)$/.test(st.fontWeight), i = /^(I|EM)$/.test(c.tagName) || st.fontStyle === 'italic';
    const nf = {b: f.b || b, i: f.i || i}, inner = run(c, nf), mk = (b && !f.b ? '**' : '') + (i && !f.i ? '*' : ''), m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    return blk + (mk && m[2] ? m[1] + mk + m[2] + [...mk].reverse().join('') + m[3] : inner); }).join('');   // los espacios de los bordes quedan fuera de la marca
  return run(el, {});
}
const citeRaw = k => { const e = document.getElementById('c_' + k); return e ? ceVal(e) : D.cites[k] ?? STYLES[k].fn(D); };
const citeBar = () => { const o = ex(), sel = (k, opts, tt) => `<select title="${tt}" data-onchange="citeOpt('${k}',this.value)">${Object.entries(opts).map(([v, t]) => `<option value="${v}" ${v === o[k] ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<div class="cbar" data-onmousedown="noBtnFocus(event)"><div class="cbg"><span class="cbt">Formato</span><button data-onclick="citeCmd('italic')" title="Cursiva en lo seleccionado de la cita (${esc(db.settings.shortcuts.italic)})"><i>K</i> Cursiva</button><button data-onclick="citeCmd('bold')" title="Negrita en lo seleccionado de la cita"><b>N</b> Negrita</button></div>
    <div class="cbg"><span class="cbt">Idioma</span>${sel('lang', {es: 'Español (y, En, consultado)', en: 'English (&, In, cited)'}, 'Idioma de los conectores de la cita')}<span class="cbt">Fecha de consulta</span>${sel('dateFmt', {long: '20 de octubre de 2026', dmy: '20-10-2026', iso: '2026-10-20'}, 'Cómo se escribe la fecha de consulta (el «[consultado el …]» de las páginas web)')}</div>
    </div>`; };
document.addEventListener('focusin', e => { if (e.target.classList?.contains('ced')) CITE_TA = e.target.id; });
document.addEventListener('paste', e => { const el = e.target.closest?.('.ced'); if (!el) return;   // se pega como texto, sin el formato de otra página
  e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ')); });
function citeCmd(cmd) {   // Cursiva o negrita en la cita con el foco (o en la primera)
  const el = document.getElementById(CITE_TA) || $('#dlg .ced'); if (!el) return;
  if (!el.contains(getSelection().anchorNode)) el.focus();
  document.execCommand('styleWithCSS', false, false); document.execCommand(cmd); el.dispatchEvent(new Event('input'));
}
function citeOpt(k, v) { ex()[k] = v; lastSnap = snapDb(); dirty = true; touch(); drawD(); }   // mismo ajuste que en Exportar (sin pasos de deshacer)
const tplText = t => t.text.replace(/\{fecha\}/g, new Date().toLocaleDateString('es-ES')).replace(/\{paper\}/g, D?.title || '');
function tplMenu(e, key) {
  ctxShow(e, '<div class="ctxh">Insertar plantilla</div>' + (db.settings.templates.map(t => `<button data-onclick="tplInsert('${key}','${t.id}')">${esc(t.name)}</button>`).join('') || '<div class="ctxh">No hay plantillas (créalas en Configuración)</div>'));
}
function tplInsert(key, id) { const t = db.settings.templates.find(x => x.id === id); ctxClose(); if (t) edInsert(key, tplText(t)); }
function addNote(tid) { const t = tid && db.settings.templates.find(x => x.id === tid); D.notes.push({id: uid(), sectionId: F.sec || db.sections[0].id, content: t ? tplText(t) : ''}); drawD(); }
function addNoteMenu(e) {
  ctxShow(e, '<div class="ctxh">Nueva nota con plantilla</div>' + (db.settings.templates.map(t => `<button data-onclick="ctxClose();addNote('${t.id}')">${esc(t.name)}</button>`).join('') || '<div class="ctxh">No hay plantillas (créalas en Configuración)</div>'));
}
const tplUI = () => `<div class="sct"><small>({fecha} y {paper} se sustituyen al insertar)</small>${db.settings.templates.map(t => `<div class="tplr"><div class="row" style="flex-wrap:nowrap"><input style="flex:1;min-width:0" value="${esc(t.name)}" data-oninput="setTpl('${t.id}','name',this.value)"><button title="Borrar" data-onclick="delTpl('${t.id}')">✕</button></div><textarea rows="3" data-oninput="setTpl('${t.id}','text',this.value)">${esc(t.text)}</textarea></div>`).join('')}<div class="row"><button data-onclick="addTpl()">+ Nueva plantilla</button><button data-onclick="resetTpl()">Restablecer las de serie</button></div></div>`;
function setTpl(id, k, v) { const t = db.settings.templates.find(x => x.id === id); if (t) { t[k] = v; markDirty(); } }
function addTpl() { db.settings.templates.push({id: uid(), name: 'Nueva plantilla', text: ''}); markDirty(); drawCfg(); }
function delTpl(id) { if (!confirm('¿Borrar esta plantilla?')) return; db.settings.templates = db.settings.templates.filter(x => x.id !== id); markDirty(); drawCfg(); }
function resetTpl() { if (!confirm('Se restablecerán las plantillas de serie y se perderán las que hayas creado o modificado. ¿Continuar?')) return; db.settings.templates = TPL_DEF.map(t => ({...t})); markDirty(); drawCfg(); }

/* ===== Enlaces entre notas ([[p:id]] = paper, [[n:id]] = nota) ===== */
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();   // búsquedas sin distinguir tildes ni mayúsculas
const LINK_RX = /\[\[([pn]):([\w-]+)\]\]/g;
function linkInfo(t, id) {   // destino del enlace; null si ya no existe
  if (t === 'p') { const p = db.papers.find(x => x.id === id); return p && {label: shortTxt(p.alias || p.title), pid: p.id}; }
  for (const p of db.papers) { const n = p.notes.find(x => x.id === id); if (n) return {label: `${secName(n.sectionId)} · ${shortTxt(n.content.replace(/\[\[[^\]]*\]\]|[*]/g, '').trim()).slice(0, 30)}`, pid: p.id}; }
  return null;
}
const linkHTML = (t, id) => { const i = linkInfo(t, id); return i ? `<a class="nl" data-t="${t}" data-id="${id}" data-p="${i.pid}">${esc(i.label)}</a>` : `<span class="nl broken" data-t="${t}" data-id="${id}">⚠ enlace roto</span>`; };
const plainLinks = s => s.replace(LINK_RX, (_, t, id) => '[' + (linkInfo(t, id)?.label || '⚠ enlace roto') + ']');
document.addEventListener('click', e => {
  const a = e.target.closest?.('a.nl[data-id]'); if (!a) return;
  e.preventDefault(); if (a.closest('#dlg')) return;   // en la edición no se navega: así no se pierde el borrador
  ['nv', 'sv', 'rv'].forEach(d => { const el = $('#' + d); if (el.open) el.close(); });
  if (a.dataset.t === 'p') openPaper(a.dataset.id); else showNotes(a.dataset.p, a.dataset.id);
});
function showNotes(id, hl) {   // visor de notas de un paper (clic derecho en «Notas» o enlace a una nota)
  const p = db.papers.find(x => x.id === id); if (!p) return;
  $('#nv').innerHTML = `<h2>${esc(p.alias || p.title)}</h2>${notesHTML(p, hl)}<div class="row" style="margin-top:12px"><button data-onclick="$('#nv').close()">Cerrar</button></div>`;
  if (!$('#nv').open) $('#nv').showModal();
  $('#nv .hl')?.scrollIntoView({block: 'center'});
}
function viewNotes(e, id) { e.preventDefault(); showNotes(id); }
let LK = {key: '', pid: ''};
function lkOpen(key) { LK = {key, pid: ''}; lkDraw(); $('#lk').showModal(); $('#lkQ')?.focus(); }
function lkDraw() {
  const p = LK.pid && db.papers.find(x => x.id === LK.pid);
  if (!p) { $('#lk').innerHTML = `<h2>Insertar enlace</h2><input id="lkQ" placeholder="Buscar un paper por título, autor o año…" data-oninput="lkSearch()" style="width:100%"><div id="lkR"></div><div class="row" style="margin-top:12px"><button data-onclick="$('#lk').close()">Cancelar</button></div>`; lkSearch(); return; }
  $('#lk').innerHTML = `<h2>${esc(shortTxt(p.alias || p.title))}</h2><button class="pri lkr" data-onclick="lkInsert('[[p:${p.id}]]')">🔗 Enlazar al paper</button><div class="ctxh">…o a una de sus notas:</div>${p.notes.filter(n => n.content.trim()).map(n => `<button class="lkr" data-onclick="lkInsert('[[n:${n.id}]]')"><b>${esc(secName(n.sectionId))}</b> · ${esc(shortTxt(n.content.replace(LINK_RX, '')).slice(0, 60))}</button>`).join('') || '<small>Este paper no tiene notas.</small>'}<div class="row" style="margin-top:12px"><button data-onclick="put(LK,'pid','',lkDraw)">← Volver</button><button data-onclick="$('#lk').close()">Cancelar</button></div>`;
}
function lkSearch() {
  const q = norm($('#lkQ').value), L = db.papers.filter(p => p.id !== D.id && (!q || norm([p.title, p.alias, p.year, ...p.authors].join(' ')).includes(q))).slice(0, 10);
  $('#lkR').innerHTML = L.map(p => `<button class="lkr" data-onclick="put(LK,'pid','${p.id}',lkDraw)">${esc(shortTxt(p.alias || p.title))} <small>${esc((p.authors[0] || '') + (p.year ? ' · ' + p.year : ''))}</small></button>`).join('') || '<small>Sin resultados.</small>';
}
function lkInsert(code) { $('#lk').close(); edInsert(LK.key, code, true); }
/* ===== Vista de notas por sección ===== */
let SV = {sec: '', q: '', order: 'list'};
function orderBy(L, ord) {
  const key = p => sortKeyOf(p, ex().particles), cmp = (a, b) => COLL.compare(key(a), key(b)), yr = p => +p.year || 0;
  return ord === 'alpha' ? [...L].sort((a, b) => cmp(a, b) || yr(a) - yr(b)) : ord === 'year' ? [...L].sort((a, b) => yr(a) - yr(b) || cmp(a, b)) : sortList(L);
}
function svData() {   // papers con notas (de la sección elegida, o de todas) que cumplen el filtro
  const q = norm(SV.q), rows = [];
  for (const p of orderBy(db.papers, SV.order)) {
    const ns = p.notes.filter(n => n.content.trim() && (!SV.sec || n.sectionId === SV.sec) && (!q || norm([n.content, p.title, p.alias, ...p.authors].join(' ')).includes(q)));
    if (ns.length) rows.push({p, ns});
  }
  return rows;
}
const svTitle = () => 'Notas' + (SV.sec ? ' – ' + secName(SV.sec) : ' por sección');
const svAuth = p => p.authors.join('; ') + (p.year ? ' (' + p.year + ')' : '');
function svOpen(sec, e) { if (e) e.preventDefault(); SV.sec = sec || ''; svDraw(); if (!$('#sv').open) $('#sv').showModal(); }
function svDraw() {
  const opt = (k, v, cur) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v)}</option>`;
  $('#sv').innerHTML = `<h2>${esc(svTitle())}</h2><div class="grid">
    <label>Sección<select data-onchange="put(SV,'sec',this.value,svDraw)">${opt('', 'Todas', SV.sec)}${db.sections.map(s => opt(s.id, s.name, SV.sec)).join('')}</select></label>
    <label>Orden de los papers<select data-onchange="put(SV,'order',this.value,svDraw)">${opt('list', 'Como en la lista', SV.order)}${opt('alpha', 'Alfabético', SV.order)}${opt('year', 'Por año', SV.order)}</select></label>
    <label class="w">Filtrar<input id="svQ" value="${esc(SV.q)}" placeholder="Texto en las notas, título o autor" data-oninput="put(SV,'q',this.value,svBody)"></label></div>
    <div id="svB"></div><div class="row" style="margin-top:12px"><button class="pri" data-onclick="svCopy()">Copiar (Markdown)</button><button data-onclick="svCopyRich()">Copiar con formato</button><button data-onclick="svSave()">Guardar .md</button><small id="svMsg"></small><button style="margin-left:auto" data-onclick="$('#sv').close()">Cerrar</button></div>`;
  svBody();
}
function svBody() {
  const rows = svData();
  $('#svB').innerHTML = rows.map(({p, ns}) => `<div class="svp"><h3><a class="nl" data-t="p" data-id="${p.id}">${esc(p.alias || p.title)}</a> <small>${esc(svAuth(p))}</small></h3>${ns.map(n => `<div class="nt">${SV.sec ? '' : chip(db.sections.find(s => s.id === n.sectionId) || {name: 'Sin sección', color: '#888888'}, 1)}<div class="ntx md">${md(n.content)}</div></div>`).join('')}</div>`).join('') || '<p class="empty">No hay notas que coincidan.</p>';
  $('#svMsg').textContent = `${rows.length} papers · ${rows.reduce((a, r) => a + r.ns.length, 0)} notas`;
}
const svMarkdown = () => `# ${svTitle()}\n\n` + svData().map(({p, ns}) => `## ${p.alias || p.title}\n*${svAuth(p)}*\n\n` + ns.map(n => (SV.sec ? '' : `**[${secName(n.sectionId)}]** `) + plainLinks(n.content.trim())).join('\n\n')).join('\n\n');
const svHtml = () => `<div style="font-family:'Times New Roman',serif;font-size:12pt"><h1 style="font-size:16pt">${esc(svTitle())}</h1>${svData().map(({p, ns}) => `<h2 style="font-size:13pt;margin-bottom:0">${esc(p.alias || p.title)}</h2><p style="margin-top:0"><i>${esc(svAuth(p))}</i></p>${ns.map(n => `<div>${SV.sec ? '' : `<b>[${esc(secName(n.sectionId))}]</b>`}${md(n.content)}</div>`).join('')}`).join('')}</div>`;
async function copyText(text, host) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-9999px'; (host || document.body).appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
}
async function copyRich(html, text, host) {   // HTML + texto: al pegar en Word o Docs conserva el formato
  try { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); return true; } catch {}
  const d = document.createElement('div'); d.contentEditable = true; d.style.cssText = 'position:fixed;left:-9999px;top:0'; d.innerHTML = html; host.appendChild(d);
  const r = document.createRange(); r.selectNodeContents(d); const g = getSelection(); g.removeAllRanges(); g.addRange(r); const ok = document.execCommand('copy'); g.removeAllRanges(); d.remove(); return ok;
}
async function saveText(text, name, mime, ext, label) {
  try { if (FSA) { const h = await showSaveFilePicker({suggestedName: name, types: [{description: label, accept: {[mime]: ['.' + ext]}}]}); await writeTo(h, text); } else download(text, name, mime); }
  catch (e) { if (e.name !== 'AbortError') alert('Error al guardar: ' + e.message); }
}
async function svCopy() { $('#svMsg').textContent = (await copyText(svMarkdown(), $('#sv'))) ? 'Copiado ✓' : 'No se pudo copiar'; }
async function svCopyRich() { $('#svMsg').textContent = (await copyRich(svHtml(), svMarkdown(), $('#sv'))) ? 'Copiado con formato ✓' : 'No se pudo copiar'; }
const svSave = () => saveText(svMarkdown(), 'notas.md', 'text/markdown', 'md', 'Markdown');

/* ===== Gráfico de relaciones ===== */
let GR = {all: false, vis: false, help: false};   // help: explicación desplegada con relaciones (la primera vez que se abre y con el botón ❓)
function grLayout(n, edges, W, H) {   // disposición de fuerzas determinista: repulsión entre nodos, muelles en las aristas y gravedad al centro
  const P = Array.from({length: n}, (_, i) => ({x: W / 2 + Math.cos(2 * Math.PI * i / Math.max(n, 1)) * W * .35, y: H / 2 + Math.sin(2 * Math.PI * i / Math.max(n, 1)) * H * .35, vx: 0, vy: 0}));
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2), f = 40000 / d2; P[i].vx += dx / d * f; P[i].vy += dy / d * f; P[j].vx -= dx / d * f; P[j].vy -= dy / d * f; }
    for (const [a, b] of edges) { const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.max(Math.hypot(dx, dy), 1), f = (d - 170) * .02; P[a].vx += dx / d * f; P[a].vy += dy / d * f; P[b].vx -= dx / d * f; P[b].vy -= dy / d * f; }
    for (const q of P) { q.vx += (W / 2 - q.x) * .004; q.vy += (H / 2 - q.y) * .004; q.x = Math.min(W - 40, Math.max(40, q.x + q.vx * .5)); q.y = Math.min(H - 30, Math.max(30, q.y + q.vy * .5)); q.vx *= .8; q.vy *= .8; }
  }
  return P;
}
function grData() {   // nodos y aristas del ámbito elegido (todos o solo los visibles con los filtros actuales)
  const base = GR.vis ? visible() : db.papers, ids = new Set(base.map(p => p.id)), E = [];
  for (const p of base) { for (const r of p.related || []) if (ids.has(r) && p.id < r) E.push({a: p.id, b: r, dir: false}); for (const r of p.refTo || []) if (ids.has(r)) E.push({a: p.id, b: r, dir: true}); }
  const linked = new Set(E.flatMap(e => [e.a, e.b])), nodes = base.filter(p => GR.all || linked.has(p.id));
  return {nodes, E};
}
function grOpen() {
  let seen = false; try { seen = !!localStorage.getItem('gp-gr-seen'); localStorage.setItem('gp-gr-seen', '1'); } catch (e) {}
  GR.help = !seen; grDraw(); $('#gr').showModal();   // quien lo abre por primera vez ve la explicación; después, el gráfico
}
function grDraw() {
  const {nodes, E} = grData(), W = 880, H = 560, ix = new Map(nodes.map((p, i) => [p.id, i])), P = grLayout(nodes.length, E.map(e => [ix.get(e.a), ix.get(e.b)]), W, H);
  const lbl = p => esc(shortTxt(p.alias || p.title, 28)) + (p.year ? ' · ' + p.year : '');
  $('#gr').innerHTML = `<h2>Relaciones entre papers</h2>
    <div class="row"><label class="row"><input type="checkbox" ${GR.vis ? 'checked' : ''} data-onchange="put(GR,'vis',this.checked,grDraw)"> Solo los papers visibles con los filtros actuales</label><label class="row"><input type="checkbox" ${GR.all ? 'checked' : ''} data-onchange="put(GR,'all',this.checked,grDraw)"> Incluir los que no tienen relaciones</label><button class="sm" style="margin-left:auto" data-onclick="put(GR,'help',!GR.help,grDraw)" aria-expanded="${GR.help}">${GR.help ? 'Ocultar la explicación' : '❓ ¿Para qué sirve?'}</button></div>
    <small id="grInfo">${nodes.length} papers · ${E.length} relaciones · <span style="color:#7c5cc4">━ relacionado</span> · <span style="color:#0f8b8d">➜ cita a</span> · clic en un paper para abrirlo</small>
    ${E.length ? (GR.help ? grHelp(true) : '') : grHelp()}
    ${nodes.length ? `<svg id="grSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de relaciones"><defs><marker id="grAr" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#0f8b8d"/></marker></defs>
      ${E.map(e => { const a = P[ix.get(e.a)], b = P[ix.get(e.b)]; return `<line class="ed" data-a="${e.a}" data-b="${e.b}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${e.dir ? '#0f8b8d' : '#7c5cc4'}" stroke-width="1.6" ${e.dir ? 'marker-end="url(#grAr)"' : ''}/>`; }).join('')}
      ${nodes.map((p, i) => `<g class="nd" data-id="${p.id}" data-onclick="grGo('${p.id}')" tabindex="0" data-onkeydown="onEnter(event,grGo,'${p.id}')"><title>${esc(p.title)}</title><circle cx="${P[i].x.toFixed(1)}" cy="${P[i].y.toFixed(1)}" r="8" fill="var(--pri)" stroke="var(--card)" stroke-width="2"/><text x="${(P[i].x + 12).toFixed(1)}" y="${(P[i].y + 4).toFixed(1)}">${lbl(p)}</text></g>`).join('')}</svg>` : ''}
    <div class="row" style="margin-top:12px"><button style="margin-left:auto" data-onclick="$('#gr').close()">Cerrar</button></div>`;
}
function grGo(id) { $('#gr').close(); openPaper(id); }
function grHelp(on) {   // sin relaciones: qué es esta función y cómo empezar, atenuado porque es un texto provisional; on = pedido con el botón ❓ (con relaciones), sin atenuar
  const any = db.papers.some(p => (p.related || []).length || (p.refTo || []).length);
  if (any && !on) return '<div class="grhelp"><p>Con los filtros actuales no se ve ninguna relación. Desmarca «Solo los papers visibles con los filtros actuales» o cambia los filtros de la barra lateral.</p></div>';
  return `<div class="grhelp${on ? ' on' : ''}"><h3>¿Para qué sirve?</h3>
    <p>Este gráfico dibuja cómo se conectan tus papers: cada punto es un paper y cada línea, una relación entre dos. Así ves de un vistazo qué trabajos van juntos, cuáles sirven de base a otros y qué grupos de lectura se forman en tu bibliografía.</p>
    <h3>Dos tipos de relación</h3>
    <ul><li><b style="color:#7c5cc4">━ Relacionado</b>: tratan el mismo tema o se complementan. Es mutua: aparece en los dos papers.</li>
    <li><b style="color:#0f8b8d">➜ Cita a</b>: un paper cita al otro. Tiene dirección: la flecha va del que cita al citado, y el citado lo muestra en «Citado por».</li></ul>
    <h3>Cómo añadir la primera relación</h3>
    <ol><li>Cierra esta ventana y pulsa <b>Editar</b> en un paper.</li>
    <li>Ve a la pestaña <b>«Secciones, etiquetas y relacionados»</b> y abre el bloque <b>«Relacionados»</b>.</li>
    <li>En el desplegable elige <b>«Relacionar con»</b> o <b>«Cita a»</b>, escribe parte del título del otro paper en «Buscar un paper…» y pulsa sobre él.</li>
    <li>Pulsa <b>«Guardar paper»</b> y vuelve a <b>🕸️ Relaciones</b>: verás los dos papers unidos por una línea.</li></ol>
    <h3>En el gráfico</h3>
    <ul><li>Pulsa un paper para abrirlo y editarlo.</li>
    <li><b>«Solo los papers visibles con los filtros actuales»</b> limita el gráfico a lo que muestran tus filtros (búsqueda, sección, etiquetas, lectura…).</li>
    <li><b>«Incluir los que no tienen relaciones»</b> muestra también los papers sueltos, para ver cuáles faltan por conectar.</li></ul>
    <p class="grtmp">${on ? 'Puedes volver a verlo cuando quieras con «❓ ¿Para qué sirve?».' : 'Este texto desaparece en cuanto añadas la primera relación.'}</p></div>`;
}

/* ===== Papelera ===== */
function trashPaper(id) {   // el paper sale de la lista pero se guarda en el JSON, con quién lo citaba, hasta que caduque
  const p = db.papers.find(x => x.id === id); if (!p) return;
  const by = db.papers.filter(q => (q.refTo || []).includes(id)).map(q => q.id);
  db.papers = db.papers.filter(x => x.id !== id);
  db.papers.forEach(q => { q.related = (q.related || []).filter(x => x !== id); q.refTo = (q.refTo || []).filter(x => x !== id); });
  db.trash.push({paper: p, at: new Date().toISOString(), by}); SEL.delete(id); EXP.delete(id);
}
function trOpen() { db.trash = db.trash.filter(t => trashLeft(t) > 0); trDraw(); $('#tr').showModal(); }
function trDraw() {
  $('#tr').innerHTML = `<h2>Papelera</h2><p class="empty">Los papers eliminados se borran definitivamente a los ${TRASH_DAYS} días.</p>` + (db.trash.length ? [...db.trash].reverse().map(t => `<div class="irow"><span><b>${esc(t.paper.alias || t.paper.title)}</b><br><small>${esc(svAuth(t.paper))} · quedan ${trashLeft(t)} días</small></span><span class="row" style="margin-left:auto;flex-wrap:nowrap"><button class="sm" data-onclick="trashRestore('${t.paper.id}')">Restaurar</button><button class="sm" title="Borrar definitivamente" data-onclick="trashDelete('${t.paper.id}')">✕</button></span></div>`).join('') : '<p class="empty">La papelera está vacía.</p>')
    + `<div class="row" style="margin-top:12px">${db.trash.length ? '<button data-onclick="trashEmpty()">Vaciar papelera</button>' : ''}<button style="margin-left:auto" data-onclick="$('#tr').close()">Cerrar</button></div>`;
}
function trashRestore(id) {
  const i = db.trash.findIndex(t => t.paper.id === id); if (i < 0) return;
  const {paper: p, by = []} = db.trash[i]; db.trash.splice(i, 1);
  p.tagIds = (p.tagIds || []).filter(t => db.tags.some(x => x.id === t)); p.sectionIds = (p.sectionIds || []).filter(x => db.sections.some(y => y.id === x));
  p.notes ??= []; p.cites ??= {}; p.history ??= []; NEWF(p); p.related = (p.related || []).filter(r => db.papers.some(x => x.id === r)); p.refTo = (p.refTo || []).filter(r => db.papers.some(x => x.id === r));
  p.related.forEach(r => { const q = db.papers.find(x => x.id === r); if (!q.related.includes(p.id)) q.related.push(p.id); });
  by.forEach(r => { const q = db.papers.find(x => x.id === r); if (q && !(q.refTo ??= []).includes(p.id)) q.refTo.push(p.id); });   // vuelve a estar citado por quien lo citaba
  logChange(p, 'Restaurado desde la papelera'); db.papers.push(p); markDirty(); render(); trDraw();
}
function trashDelete(id) { if (!confirm('¿Borrar definitivamente este paper? No se podrá recuperar.')) return; db.trash = db.trash.filter(t => t.paper.id !== id); markDirty(); render(); trDraw(); }
function trashEmpty() { if (!confirm('¿Vaciar la papelera? Los papers que contiene no se podrán recuperar.')) return; db.trash = []; markDirty(); render(); trDraw(); }
function setView(v) { db.settings.view = v; lastSnap = snapDb(); dirty = true; touch(); render(); }   // la vista se recuerda en el JSON sin crear pasos de deshacer

/* ===== Historial de cambios y relaciones ===== */
const shortTxt = v => { v = String(v ?? '').replace(/\s+/g, ' ').trim(); return !v ? '—' : v.length > 60 ? v.slice(0, 57) + '…' : v; };
const HMAX = () => 50;   // el historial no se guarda en el JSON: solo vive en memoria durante el día
const dbJSON = () => JSON.stringify(db, (k, v) => k === 'history' ? undefined : v, 2);   // en el JSON solo queda la fecha de creación (created)
const isToday = t => new Date(t).toDateString() === new Date().toDateString();
function logChange(p, ...msgs) {
  const t = new Date().toISOString(); p.history ??= [];
  msgs.filter(Boolean).forEach(s => p.history.push({t, s}));
  if (p.history.length > HMAX()) p.history.splice(0, p.history.length - HMAX());
}
const DIFF_F = {subtype: 'Designación', authorRole: 'Función del autor', userHandle: 'Usuario (@)', title: 'Título', alias: 'Título personalizado', year: 'Año', venue: 'Revista/editorial', doi: 'DOI', url: 'URL', type: 'Tipo', accessed: 'Fecha de consulta', reading: 'Lectura', rating: 'Valoración', sortKey: 'Clave de orden', volume: 'Volumen', issue: 'Número', pages: 'Páginas', edition: 'Edición', publisher: 'Editorial', place: 'Lugar', pubDate: 'Fecha de publicación', thesisType: 'Tipo de trabajo', isbn: 'ISBN', issn: 'ISSN', series: 'Serie', seriesNumber: 'Número en la serie', institution: 'Institución', docNumber: 'Número de documento', conferenceName: 'Congreso', conferencePlace: 'Lugar del congreso', conferenceDates: 'Fechas del congreso', authorType: 'Tipo de autor', linkMode: 'Enlace en la cita'};
function diffPaper(a, b) {   // a = versión guardada, b = borrador; solo guarda «antes → después» en campos cortos
  const out = [], show = (k, v) => shortTxt(k === 'reading' ? READ[v] : k === 'type' ? TYPES[v] : k === 'authorType' ? AUTH_T[v] : k === 'linkMode' ? LINK_MODES[v] : v), same = k => JSON.stringify(a[k]) === JSON.stringify(b[k]);
  for (const [k, n] of Object.entries(DIFF_F)) if (String(a[k] ?? '') !== String(b[k] ?? '')) out.push(`${n}: ${show(k, a[k])} → ${show(k, b[k])}`);
  if (!same('authors')) out.push('Autores modificados');
  if (!same('editors')) out.push('Editores modificados');
  if (!!a.hideAccessed !== !!b.hideAccessed) out.push(`Fecha de consulta en la cita: ${b.hideAccessed ? 'omitida' : 'incluida'}`);
  if ((a.general || '') !== (b.general || '')) out.push('Notas generales modificadas');
  if (JSON.stringify(a.image || null) !== JSON.stringify(b.image || null)) out.push(b.image ? 'Imagen cambiada' : 'Imagen quitada');
  if (!same('notes')) out.push('Notas por sección editadas');
  if (!same('cites')) out.push('Citas editadas a mano');
  const lst = (label, x, y, name) => { const add = y.filter(i => !x.includes(i)).map(name), del = x.filter(i => !y.includes(i)).map(name);
    if (add.length || del.length) out.push(`${label}: ${[...add.map(n => '+' + n), ...del.map(n => '−' + n)].join(', ')}`); };
  lst('Etiquetas', a.tagIds, b.tagIds, i => db.tags.find(t => t.id === i)?.name || '?');
  lst('Secciones', a.sectionIds, b.sectionIds, i => secName(i));
  lst('Relacionados', a.related, b.related, i => shortTxt(db.papers.find(p => p.id === i)?.title));
  lst('Cita a', a.refTo || [], b.refTo || [], i => shortTxt(db.papers.find(p => p.id === i)?.title));
  return out;
}
function syncRelated(before, p) {   // mantiene la relación simétrica: añade o quita este paper en la lista del otro extremo
  const now = new Set(p.related);
  for (const id of new Set([...before, ...now])) { const q = db.papers.find(x => x.id === id); if (!q || q.id === p.id) continue;
    const has = q.related.includes(p.id);
    if (now.has(id) && !has) { q.related.push(p.id); logChange(q, 'Relacionado con: ' + shortTxt(p.title)); }
    if (!now.has(id) && has) { q.related = q.related.filter(x => x !== p.id); logChange(q, 'Relación quitada: ' + shortTxt(p.title)); } }
}
let RELT = 'rel';   // tipo de relación que se está añadiendo: rel (simétrica) o ref (este paper cita a…)
function relSearch() {
  const q = norm($('#relQ').value.trim()); if (!q) { $('#relRes').innerHTML = ''; return; }
  const list = RELT === 'ref' ? D.refTo : D.related;
  const L = db.papers.filter(p => p.id !== D.id && !list.includes(p.id) && norm([p.title, p.alias, p.year, ...p.authors].join(' ')).includes(q)).slice(0, 8);
  $('#relRes').innerHTML = L.map(p => `<button class="relr" data-onclick="relAdd('${p.id}')">${esc(shortTxt(p.alias || p.title))} <small>${esc((p.authors[0] || '') + (p.year ? ' · ' + p.year : ''))}</small></button>`).join('') || '<small>Sin resultados.</small>';
}
function relAdd(id) { (RELT === 'ref' ? D.refTo : D.related).push(id); drawD(); }
function relDel(id) { D.related = D.related.filter(x => x !== id); drawD(); }
function refDel(id) { D.refTo = D.refTo.filter(x => x !== id); drawD(); }
const relCount = p => p.related.length + (p.refTo || []).length + db.papers.filter(q => (q.refTo || []).includes(p.id)).length;
function viewRel(id) {   // relaciones de un paper: relacionados, cita a y citado por; se cierra con un clic fuera
  const p = db.papers.find(x => x.id === id); if (!p) return;
  const sec = (t, ids) => { const L = ids.map(i => db.papers.find(x => x.id === i)).filter(Boolean);
    return L.length ? `<h3 style="margin:10px 0 2px">${t}</h3>` + L.map(q => `<div class="irow"><span><b>${esc(q.alias || q.title)}</b><br><small>${esc(q.authors.join('; '))}${q.year ? ' · ' + esc(q.year) : ''}</small></span><button class="sm" style="margin-left:auto" data-onclick="$('#rv').close();openPaper('${q.id}')">Editar</button></div>`).join('') : ''; };
  $('#rv').innerHTML = `<h2>Relaciones de «${esc(shortTxt(p.alias || p.title))}»</h2>${sec('Relacionados', p.related)}${sec('Cita a', p.refTo || [])}${sec('Citado por', db.papers.filter(q => (q.refTo || []).includes(id)).map(q => q.id))}<div class="row" style="margin-top:12px"><button data-onclick="$('#rv').close()">Cerrar</button></div>`;
  $('#rv').showModal();
}
function movePaper(id, from, to) {   // arrastrar un paper de una sección a otra (a '' = Sin sección)
  if (from === to) return;
  const p = db.papers.find(x => x.id === id); if (!p) return;
  p.sectionIds = p.sectionIds.filter(x => x !== from);
  if (to && !p.sectionIds.includes(to)) p.sectionIds.push(to);
  logChange(p, 'Sección: ' + (from ? secName(from) : 'Sin sección') + ' → ' + (to ? secName(to) : 'Sin sección'));
  if (from && to) p.notes.forEach(n => { if (n.sectionId === from) n.sectionId = to; });   // sus notas se mueven con él
  markDirty(); render();
}
function addTag(id, tid) { const p = db.papers.find(x => x.id === id); if (p && !p.tagIds.includes(tid)) { p.tagIds.push(tid); logChange(p, 'Etiqueta añadida: ' + (db.tags.find(t => t.id === tid)?.name || '?')); markDirty(); } render(); }
const clearOver = () => document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
document.addEventListener('dragstart', e => {
  const t = e.target.closest?.('.chip[data-tag], .card[draggable=true], .rw[draggable=true]'); if (!t) return;
  if (t.dataset.tag) { e.dataTransfer.setData('application/x-tag', t.dataset.tag); e.dataTransfer.effectAllowed = 'copy'; }
  else { e.dataTransfer.setData('application/x-paper', JSON.stringify({id: t.dataset.id, from: t.dataset.from || ''})); e.dataTransfer.effectAllowed = 'move'; t.classList.add('drag'); }
});
document.addEventListener('dragend', () => { clearOver(); document.querySelectorAll('.drag').forEach(x => x.classList.remove('drag')); });
$('#list').addEventListener('dragover', e => {   // etiqueta -> tarjeta; paper -> grupo de sección
  const ty = [...e.dataTransfer.types], tgt = ty.includes('application/x-tag') ? e.target.closest('.card, .rw') : ty.includes('application/x-paper') ? e.target.closest('.gbox') : null;
  if (!tgt) return; e.preventDefault(); clearOver(); tgt.classList.add('over');
});
$('#list').addEventListener('drop', e => {
  const tag = e.dataTransfer.getData('application/x-tag'), pap = e.dataTransfer.getData('application/x-paper'), c = e.target.closest('.card, .rw'), g = e.target.closest('.gbox');
  clearOver();
  if (tag && c) { e.preventDefault(); addTag(c.dataset.id, tag); }
  else if (pap && g) { e.preventDefault(); const d = JSON.parse(pap); movePaper(d.id, d.from, g.dataset.sec); }
});
function toggleS(id) { const i = D.sectionIds.indexOf(id); i < 0 ? D.sectionIds.push(id) : D.sectionIds.splice(i, 1); drawD(); }
function toggleT(id) { const i = D.tagIds.indexOf(id); i < 0 ? D.tagIds.push(id) : D.tagIds.splice(i, 1); drawD(); }
let CLOC = '';   // página o parte citada que se usa en la cita en el texto (no se guarda)
const itHtml = k => STYLES[k].inText(D, ex(), CLOC).map((x, i) => `<div class="row" style="align-items:center"><small>${esc(x.k)}:</small> <span>${citeHtml(x.t)}</span><button data-onclick="copyIT('${k}',${i},0,this)">Copiar</button><button data-onclick="copyIT('${k}',${i},1,this)" title="Con cursiva, para pegar en Word o Docs">Copiar con formato</button></div>`).join('');
function drawIT() { for (const k of Object.keys(STYLES)) { const e = $('#it_' + k); if (e) e.innerHTML = itHtml(k); } }
async function copyIT(k, i, rich, b) {   // copia la cita en el texto (texto plano o con cursiva real)
  const t = STYLES[k].inText(D, ex(), CLOC)[i].t, host = $('#dlg');
  if (rich) await clipHtml(`<p style="font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(t)}</p>`, citeTxt(t), host); else await clipText(citeTxt(t), host);
  if (b) { const o = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = o, 1400); }
}
async function copyC(k, rich, b) {   // copia la cita sin marcas (texto) o con cursiva real (formato)
  const raw = citeRaw(k), host = $('#dlg');
  if (rich) await clipHtml(`<p style="font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(raw)}</p>`, citeTxt(raw), host); else await clipText(citeTxt(raw), host);
  if (b) { const t = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = t, 1400); }
}
function commit() {
  if (!D.title.trim()) { tab = 'data'; drawD(); return alert('El título es obligatorio.'); }
  if (D.url && !/^https?:\/\//i.test(D.url)) return alert('La URL debe empezar por http:// o https://');
  D.year = D.year ? +D.year : '';
  D.modified = new Date().toISOString();
  const i = db.papers.findIndex(p => p.id === D.id), old = i < 0 ? null : db.papers[i];
  logChange(D, ...(old ? diffPaper(old, D) : ['Creado']));
  if (PEND.has(D.id)) idb('readwrite', st => st.put(PEND.get(D.id), 'img:' + D.id)).catch(() => {});
  if (PEND_PDF.has(D.id)) idb('readwrite', st => st.put(PEND_PDF.get(D.id), 'pdf:' + D.id)).catch(() => {});
  if (!D.pdf) idb('readwrite', st => st.delete('pdf:' + D.id)).catch(() => {});
  syncRelated(old ? old.related : [], D);
  i < 0 ? db.papers.push(D) : db.papers[i] = D;
  markDirty(); $('#dlg').close(); render();
}

/* ===== Gestor de etiquetas y secciones ===== */
function openMg(k) { MG = k; drawMg(); $('#mg').showModal(); }
function drawMg() {
  $('#mg').innerHTML = `<h2>${MG === 'tags' ? 'Etiquetas' : 'Secciones'}</h2>` + db[MG].map(x => `<div class="row" style="margin-bottom:6px">
    <input type="color" value="${x.color || '#888888'}" data-oninput="upd('${x.id}','color',this.value)"><input value="${esc(x.name)}" data-oninput="upd('${x.id}','name',this.value)">
    ${MG === 'sections' ? `<input placeholder="Descripción" value="${esc(x.description || '')}" data-oninput="upd('${x.id}','description',this.value)">` : ''}
    <button title="Subir" data-onclick="moveM('${x.id}',-1)">↑</button><button title="Bajar" data-onclick="moveM('${x.id}',1)">↓</button><button class="danger" data-onclick="delM('${x.id}')">Eliminar</button></div>`).join('') +
    `<div class="row"><button class="pri" data-onclick="mgAdd('${uid()}')">+ Añadir</button><button data-onclick="$('#mg').close();render()">Cerrar</button></div>`;
}
function upd(id, k, v) { db[MG].find(x => x.id === id)[k] = v; markDirty(); }
function moveM(id, d) { const a = db[MG], i = a.findIndex(x => x.id === id), j = i + d;
  if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; markDirty(); drawMg(); }
function toggleST(sid, tid) { const s = db.sections.find(x => x.id === sid), i = s.tagIds.indexOf(tid);
  i < 0 ? s.tagIds.push(tid) : s.tagIds.splice(i, 1); markDirty(); drawMg(); }
function delM(id) {
  const x = db[MG].find(y => y.id === id);
  if (!confirm(MG === 'tags' ? `¿Eliminar la etiqueta «${x.name}»? Se quitará de todos los papers y secciones.` : `¿Eliminar la sección «${x.name}»? Se borrarán las notas asociadas a ella.`)) return;
  db[MG] = db[MG].filter(y => y.id !== id);
  if (MG === 'tags') { db.papers.forEach(p => p.tagIds = p.tagIds.filter(t => t !== id)); F.tags.delete(id); db.sections.forEach(s => s.tagIds = s.tagIds.filter(t => t !== id)); }
  else { db.papers.forEach(p => { p.notes = p.notes.filter(n => n.sectionId !== id); p.sectionIds = p.sectionIds.filter(x => x !== id); }); if (F.sec === id) F.sec = ''; }
  markDirty(); drawMg();
}
