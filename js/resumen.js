/* ---- Resumen de anotaciones (Exportar → «🖍 Resumen de anotaciones…») ----
   Para los papers del alcance de Exportar (seleccionados, los visibles con los filtros o todos), en su orden: la cita completa
   en el estilo elegido y debajo sus subrayados, zonas y notas, por página y de arriba abajo. Se descarga en Word (.docx), PDF o Markdown. */
const SUM_KIND = a => a.k === 'note' ? 'Nota' : a.k === 'area' ? 'Zona' : a.k === 'ink' ? 'Trazo a mano' : 'Subrayado';
function sumData() {
  const o = ex(), L = exList();
  return L.map(p => ({p, cite: cite(p, o), pdfs: PDF_N.map(n => p[pdfF(n)]).filter(pf => pf && Array.isArray(pf.ann) && pf.ann.length).map(pf => ({name: pf.name || 'PDF', ep: isEpub(pf.name), L: annSorted(pf.ann)}))}))
    .filter(x => x.pdfs.length);
}
const sumOne = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
const sumFile = ext => `Resumen de anotaciones ${new Date().toISOString().slice(0, 10)}.${ext}`;
function sumOpen() {
  let d = $('#sum'); if (!d) { d = document.createElement('dialog'); d.id = 'sum'; document.body.append(d); }
  sumDraw(); if (!d.open) d.showModal();
}
function sumDraw() {
  const d = $('#sum'), o = ex(), D = sumData(), n = D.reduce((s, x) => s + x.pdfs.reduce((t, f) => t + f.L.length, 0), 0), all = exList().length;
  d.innerHTML = `<div class="dh"><h2>🖍 Resumen de anotaciones</h2><div class="dbtn"><button data-onclick="$('#sum').close()">Cerrar ✕</button></div></div>
    <p>La cita completa de cada paper (${esc(STYLES[o.style]?.name || o.style)}, el estilo de Exportar) y debajo sus subrayados, comentarios y notas, por página.</p>
    <label>Papers <select data-onchange="exsSet(this.value); sumDraw()"><option value="sel" ${EXS === 'sel' ? 'selected' : ''} ${SEL.size ? '' : 'disabled'}>Seleccionados (${SEL.size})</option><option value="vis" ${EXS === 'vis' ? 'selected' : ''}>Visibles con los filtros (${visible().length})</option><option value="all" ${EXS === 'all' ? 'selected' : ''}>Todos (${db.papers.length})</option></select></label>
    <p class="sumn">${D.length ? `<b>${D.length}</b> ${D.length === 1 ? 'paper' : 'papers'} con anotaciones (${n} en total)${all > D.length ? `; los otros ${all - D.length} no tienen y no salen` : ''}.` : 'Ninguno de estos papers tiene anotaciones en sus PDF.'}</p>
    <div class="row"><button class="pri" data-onclick="sumSave('docx')" ${D.length ? '' : 'disabled'}>⬇ Word (.docx)</button><button data-onclick="sumSave('pdf')" ${D.length ? '' : 'disabled'}>⬇ PDF</button><button data-onclick="sumSave('md')" ${D.length ? '' : 'disabled'}>⬇ Markdown (.md)</button></div>`;
}
async function sumSave(fmt) {
  const D = sumData(); if (!D.length) return;
  try {
    if (fmt === 'md') download(sumMd(D), sumFile('md'), 'text/markdown');
    else if (fmt === 'docx') download(sumDocx(D), sumFile('docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    else { toast('Preparando el PDF…', [], 2000); download(await sumPdf(D), sumFile('pdf'), 'application/pdf'); }
  } catch (e) { say('No se pudo crear el resumen: ' + e.message); }
}
function sumMd(D) {
  const out = [`# Resumen de anotaciones`, '', `_${D.length} ${D.length === 1 ? 'paper' : 'papers'} · ${new Date().toLocaleDateString('es-ES')}_`];
  for (const x of D) {
    out.push('', `## ${x.cite}`);
    for (const f of x.pdfs) {
      if (x.pdfs.length > 1) out.push('', `### ${f.name}`);
      out.push('');
      for (const a of f.L) out.push(`- **${annPg(a, f.ep)}** · ${SUM_KIND(a)}${a.t ? `: «${sumOne(a.t)}»` : ''}${a.m ? `\n  ${a.k === 'note' ? '' : '*Comentario:* '}${a.m.trim().replace(/\n/g, '\n  ')}` : ''}`);
    }
  }
  return out.join('\n') + '\n';
}
function sumDocx(D) {
  const P = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`, R = (t, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`;
  const body = [P(R('Resumen de anotaciones'), '<w:pStyle w:val="Heading1"/>'), P(R(`${D.length} ${D.length === 1 ? 'paper' : 'papers'} · ${new Date().toLocaleDateString('es-ES')}`, '<w:i/><w:sz w:val="20"/>'), '<w:spacing w:after="240"/>')];
  for (const x of D) {
    body.push(P(docxRuns(x.cite), '<w:keepNext/><w:spacing w:before="280" w:after="100"/><w:ind w:left="720" w:hanging="720"/>'));
    for (const f of x.pdfs) {
      if (x.pdfs.length > 1) body.push(P(R(f.name, '<w:b/><w:sz w:val="20"/>'), '<w:keepNext/><w:spacing w:before="80" w:after="40"/><w:ind w:left="360"/>'));
      for (const a of f.L) {
        const col = /^#[0-9a-f]{6}$/i.test(a.c) ? a.c.slice(1) : 'FFD400';
        body.push(P(R('■ ', `<w:color w:val="${col}"/><w:sz w:val="20"/>`) + R(`${annPg(a, f.ep)}  `, '<w:b/><w:sz w:val="22"/>') + (a.t ? R(`«${sumOne(a.t)}»`, '<w:sz w:val="22"/>') : R(SUM_KIND(a), '<w:i/><w:sz w:val="22"/>')), '<w:spacing w:after="40"/><w:ind w:left="360"/>'));
        if (a.m) a.m.trim().split('\n').forEach(l => body.push(P(R(l, '<w:i/><w:sz w:val="21"/>'), '<w:spacing w:after="40"/><w:ind w:left="720"/>')));
      }
    }
  }
  return docxPack(body.join(''));
}
async function sumPdf(D) {   // PDF con pdf-lib y las letras estándar (Times): lo que no se pueda escribir con ellas sale como «?»
  const {PDFDocument, StandardFonts, rgb} = await vwPdfLib(), doc = await PDFDocument.create();
  const F = {r: await doc.embedFont(StandardFonts.TimesRoman), b: await doc.embedFont(StandardFonts.TimesRomanBold), i: await doc.embedFont(StandardFonts.TimesRomanItalic)};
  const OK = new Set(F.r.getCharacterSet()), clean = s => [...String(s)].map(ch => OK.has(ch.codePointAt(0)) ? ch : /\s/.test(ch) ? ' ' : '?').join('');
  const W = 595.28, H = 841.89, M = 64; let pg = null, y = 0;
  const newPage = () => { pg = doc.addPage([W, H]); y = H - M; };
  const runs = (s, f = 'r') => String(s).replace(/\\\*/g, '\u0001').split(/(\*\*.+?\*\*|\*.+?\*)/).filter(Boolean).map(part => { const b = /^\*\*.+\*\*$/.test(part), i = !b && /^\*.+\*$/.test(part); return {t: (b ? part.slice(2, -2) : i ? part.slice(1, -1) : part).replace(/\u0001/g, '*'), f: b ? 'b' : i ? 'i' : f}; });
  const para = (R, {size = 11, left = 0, hang = 0, before = 0, after = 4, mark = null} = {}) => {   // R: [{t, f}]; hang: la primera línea empieza más a la izquierda
    const words = []; for (const r of R) for (const w of clean(r.t).split(/(\s+)/)) if (w) words.push({w: /^\s+$/.test(w) ? ' ' : w, f: F[r.f]});
    const lines = []; let line = [], x = 0;
    for (const wd of words) {
      const max = W - 2 * M - left + (lines.length ? 0 : hang), wl = wd.f.widthOfTextAtSize(wd.w, size);
      if (wd.w === ' ' && !line.length) continue;
      if (x + wl > max && line.length && wd.w !== ' ') { lines.push(line); line = []; x = 0; }
      if (wd.w === ' ' && !line.length) continue;
      line.push({...wd, x}); x += wl;
    }
    if (line.length) lines.push(line);
    if (!pg || y - before - size * 1.25 < M) newPage(); else y -= before;
    lines.forEach((L, k) => {
      if (y - size * 1.25 < M) newPage();
      y -= size * 1.25; const x0 = M + left - (k ? 0 : hang);
      if (!k && mark) pg.drawRectangle({x: x0 - 12, y: y + 1, width: 7, height: 7, color: mark});
      while (L.length && L[L.length - 1].w === ' ') L.pop();
      for (let j = 0; j < L.length;) { let k = j, t = ''; while (k < L.length && L[k].f === L[j].f) t += L[k++].w;   // cada trozo con la misma letra, de una vez (al copiar del PDF sale el texto seguido)
        pg.drawText(t, {x: x0 + L[j].x, y, size, font: L[j].f, color: rgb(.1, .1, .1)}); j = k; }
    });
    y -= after;
  };
  const hex = c => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || ''); return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(1, .83, 0); };
  newPage();
  para([{t: 'Resumen de anotaciones', f: 'b'}], {size: 18, after: 2});
  para([{t: `${D.length} ${D.length === 1 ? 'paper' : 'papers'} · ${new Date().toLocaleDateString('es-ES')}`, f: 'i'}], {size: 10, after: 10});
  for (const x of D) {
    para(runs(x.cite), {size: 12, left: 36, hang: 36, before: 14, after: 5});
    for (const f of x.pdfs) {
      if (x.pdfs.length > 1) para([{t: f.name, f: 'b'}], {size: 10, left: 18, before: 4, after: 2});
      for (const a of f.L) {
        para([{t: `${annPg(a, f.ep)}  `, f: 'b'}, a.t ? {t: `«${sumOne(a.t)}»`, f: 'r'} : {t: SUM_KIND(a), f: 'i'}], {size: 11, left: 36, after: a.m ? 1 : 4, mark: hex(a.c)});
        if (a.m) para([{t: sumOne(a.m), f: 'i'}], {size: 10.5, left: 54, after: 4});
      }
    }
  }
  doc.setTitle('Resumen de anotaciones'); doc.setCreator('GPapers');
  return await doc.save();
}
/* ---- Repaso de subrayados (v40, F7): cada día unos pocos subrayados al azar, para no olvidar lo leído ----
   Salen primero los que hace más que no ves y, entre ellos, los de colores con significado (⚙ del visor → 🏷). «Ya lo sé» lo aparta 30 días.
   Lo visto se recuerda en este dispositivo (gp-rev:<proyecto>: {s: {id: día}, k: {id: día}}). «Ir a la página» abre el PDF o EPUB en ese subrayado. */
const REV_N = 5, revDay = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
const revK = () => 'gp-rev:' + PJ.cur;
const revSt = () => { try { const o = JSON.parse(localStorage.getItem(revK()) || '{}'); return {s: o.s && typeof o.s === 'object' ? o.s : {}, k: o.k && typeof o.k === 'object' ? o.k : {}}; } catch (e) { return {s: {}, k: {}}; } };
const revPut = st => { try { localStorage.setItem(revK(), JSON.stringify(st)); } catch (e) {} };
function revAll() {   // todos los subrayados con texto: [{p, n, a, ep}]
  const L = []; for (const p of db.papers) for (const n of pdfsOf(p)) { const pf = p[pdfF(n)], ep = isEpub(pf.name); for (const a of pf.ann || []) if (a.k === 'hl' && String(a.t || '').trim().length > 2) L.push({p, n, a, ep}); }
  return L;
}
const revHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function revToday() {   // los de hoy: siempre los mismos durante el día
  const st = revSt(), d = revDay(), L = revAll().filter(x => !(st.k[x.a.id] > d - 30)), lbl = annLbls();
  return L.map(x => ({x, w: [st.s[x.a.id] ?? -1, lbl[x.a.c] ? 0 : 1, revHash(x.a.id + ':' + d)]})).sort((A, B) => A.w[0] - B.w[0] || A.w[1] - B.w[1] || A.w[2] - B.w[2]).slice(0, REV_N).map(y => y.x);
}
let REV = {L: [], i: 0};
function revDraw0() {   // la entrada de la barra lateral: solo con subrayados
  const g = $('#sg-rev'); if (!g) return; const n = revAll().length; g.hidden = !n; if (!n) return;
  const st = revSt(), d = revDay(), left = revToday().filter(x => st.s[x.a.id] !== d).length;
  $('#revN').textContent = left ? `(${left})` : '✓'; $('#revN').title = left ? `${left} por repasar hoy` : 'Repaso de hoy hecho';
}
function revOpen() {
  REV = {L: revToday(), i: 0}; if (!REV.L.length) return toast(revAll().length ? 'Ya conoces todos tus subrayados: vuelven dentro de un tiempo.' : 'Aún no hay subrayados con texto en los PDF o EPUB de este proyecto.', [], 4000);
  let d = $('#rev'); if (!d) { d = document.createElement('dialog'); d.id = 'rev'; document.body.append(d); }
  revDraw(); if (!d.open) d.showModal();
}
function revDraw() {
  const d = $('#rev'), x = REV.L[REV.i]; if (!d || !x) return; const {p, a, ep} = x, lb = annLbl(a.c), st = revSt(); st.s[a.id] = revDay(); revPut(st);
  d.innerHTML = `<div class="dh"><h2>🧠 Repaso de subrayados</h2><div class="dbtn"><button data-onclick="$('#rev').close();revDraw0()">Cerrar ✕</button></div></div>
    <p class="revc"><small>${REV.i + 1} de ${REV.L.length} de hoy</small></p>
    <blockquote class="revq" style="--c:${esc(a.c || '#ffd400')}">${esc(sumOne(a.t))}</blockquote>
    ${a.m ? `<p class="revm"><b>Tu comentario:</b> ${esc(a.m.trim())}</p>` : ''}
    <p class="revs">${lb ? `<span class="chip on" style="--c:${esc(a.c)}">${esc(lb)}</span> ` : ''}<b>${esc(shortTxt(p.alias || p.title))}</b> · ${esc(shortTxt(p.authors.slice(0, 2).map(s => s.split(',')[0]).join(', ')))}${p.year ? ' ' + esc(p.year) : ''} · ${annPg(a, ep)}</p>
    <div class="row"><button data-onclick="revGo()">📖 Ir al subrayado</button><button data-onclick="revKnow()" title="No volverá a salir en 30 días">✓ Ya lo sé</button>
      <span style="flex:1"></span>${REV.i > 0 ? '<button data-onclick="revStep(-1)">‹ Anterior</button>' : ''}${REV.i < REV.L.length - 1 ? '<button class="pri" data-onclick="revStep(1)">Siguiente ›</button>' : '<button class="pri" data-onclick="$(\'#rev\').close();revDraw0()">Terminar</button>'}</div>`;
}
function revStep(k) { REV.i = Math.max(0, Math.min(REV.L.length - 1, REV.i + k)); revDraw(); }
function revKnow() { const x = REV.L[REV.i]; if (!x) return; const st = revSt(); st.k[x.a.id] = revDay(); revPut(st); toast('No saldrá en 30 días.', [], 1500); if (REV.i < REV.L.length - 1) revStep(1); else { $('#rev').close(); revDraw0(); } }
async function revGo() {   // abre el documento dentro de la aplicación y salta al subrayado
  const x = REV.L[REV.i]; if (!x) return; $('#rev').close(); await docAt(x.p.id, x.n, x.a.id);
}
async function docAt(id, n, annId) {   // abrir el PDF o EPUB de un paper en una anotación (dentro de la aplicación)
  const p = db.papers.find(q => q.id === id), pf = p && p[pdfF(n)]; if (!pf) return;
  let file; try { file = await pdfFile(pdfKey(id, n), pf); } catch (e) { return; } if (!file) return;
  const src = {kind: 'paper', id, n}, ep = isEpub(pf.name);
  if (ep) await epOpen(src, file); else if (vwCan()) await vwOpen(src, file); else return pdfNative(file, (pf.ann.find(a => a.id === annId)?.p || 0) + 1);
  for (let t = 0; t < 60; t++) {   // espera a que el documento esté listo (hasta 6 s)
    if (ep ? EP.open && EP.secs.length : VW.open && VW.pages.length) break; await new Promise(r => setTimeout(r, 100)); }
  if (ep) { const a = epAnns().find(q => q.id === annId); if (a) { epGoLoc({i: a.p, f: 0}); setTimeout(() => epPopOpen(annId), 300); } } else vwJump(annId);
}
/* ---- Exportar a Obsidian, Logseq o Notion (v40, F8): un .md por paper (metadatos en YAML, clave de cita, notas y subrayados por página) en un ZIP ---- */
const obsName = p => (((p.authors[0] || '').split(',')[0].trim() + ' ' + (p.year || '')).trim() + ' - ' + (p.alias || p.title)).replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'paper';
const yq = v => JSON.stringify(String(v ?? ''));   // cadena YAML segura (JSON es YAML)
function obsMd(p, o) {
  const tags = p.tagIds.map(tagById).filter(Boolean).map(t => t.name), secs = p.sectionIds.map(secById).filter(Boolean).map(s => s.name);
  const y = ['---', `title: ${yq(p.title)}`, p.alias && `alias: ${yq(p.alias)}`, `authors: [${p.authors.map(yq).join(', ')}]`, p.year && `year: ${+p.year || yq(p.year)}`, p.venue && `venue: ${yq(p.venue)}`,
    p.doi && `doi: ${yq(normDoi(p.doi))}`, p.url && `url: ${yq(p.url)}`, `citekey: ${yq(p.key || keyNew(p))}`, `type: ${yq(TYPES[p.type] || p.type)}`, `reading: ${yq(READ[p.reading] || p.reading)}`, p.rating && `rating: ${p.rating}`,
    tags.length && `tags: [${tags.map(t => yq(t.replace(/\s+/g, '-'))).join(', ')}]`, secs.length && `sections: [${secs.map(yq).join(', ')}]`, p.retracted && 'retracted: true', '---'].filter(Boolean);
  const out = [...y, '', `# ${p.alias || p.title}`, '', `> ${cite(p, o).replace(/\n/g, ' ')}`];
  if (String(p.general || '').trim()) out.push('', '## Notas', '', plainLinks(p.general.trim()));
  for (const n of p.notes) if (String(n.content || '').trim()) out.push('', `### ${noteLabel(n)}`, '', plainLinks(n.content.trim()));
  for (const k of pdfsOf(p)) { const pf = p[pdfF(k)], ep = isEpub(pf.name), L = annSorted(pf.ann || []); if (!L.length) continue;
    out.push('', `## Anotaciones${pdfsOf(p).length > 1 ? ' · ' + pf.name : ''}`, '');
    for (const a of L) out.push(`- **${annPg(a, ep)}**${annLbl(a.c) ? ` · ${annLbl(a.c)}` : ''} · ${SUM_KIND(a)}${a.t ? `: «${sumOne(a.t)}»` : ''}${a.m ? `\n  ${a.k === 'note' ? '' : '*Comentario:* '}${a.m.trim().replace(/\n/g, '\n  ')}` : ''}`); }
  return out.join('\n') + '\n';
}
function obsZip(L) {
  const o = ex(), used = new Map();
  return zipStore(L.map(p => { const b = obsName(p), n = used.get(b) || 0; used.set(b, n + 1); return [`${b}${n ? ` (${n + 1})` : ''}.md`, obsMd(p, o)]; }));
}
function obsSave() {
  const L = exList(); if (!L.length) return say('No hay papers que exportar.');
  download(obsZip(L), `GPapers ${pjCur().name} ${new Date().toISOString().slice(0, 10)} (Markdown).zip`.replace(/[\\/:*?"<>|]+/g, ' '), 'application/zip');
  toast(`${L.length === 1 ? '1 paper exportado' : L.length + ' papers exportados'}: un .md por paper, listo para Obsidian, Logseq o Notion.`, [], 5000);
}

/* ---- Estadísticas de lectura (v40, F10): lo que guarda lectura.js en db.readLog, sumando todos los dispositivos ---- */
const rlFmt = s => { const m = Math.round(s / 60); return m < 1 ? (s > 0 ? '<1 min' : '0 min') : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
function rlAgg() {   // día → {s, p, d: Set}, con lo que aún no se ha guardado de esta sesión
  const A = new Map(), add = (day, s, p, ids) => { const e = A.get(day) || A.set(day, {s: 0, p: 0, d: new Set()}).get(day); e.s += s; e.p += p; ids.forEach(i => e.d.add(String(i))); };
  for (const [day, devs] of Object.entries(db.readLog || {})) for (const e of Object.values(devs)) add(day, e.s || 0, e.p || 0, e.d || []);
  if (typeof RL !== 'undefined' && (RL.s || RL.p >= 1)) add(rlDay(), RL.s, Math.floor(RL.p), [...RL.ids]);
  return A;
}
const rlBack = n => { const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() - n); return t; };
function rlSum(A, n) { const o = {s: 0, p: 0, d: new Set(), days: 0}; for (let i = 0; i < n; i++) { const e = A.get(rlDay(rlBack(i))); if (!e) continue; o.s += e.s; o.p += e.p; e.d.forEach(x => o.d.add(x)); if (e.s >= 60) o.days++; } return o; }
function rlStreak(A) {   // días seguidos con al menos un minuto de lectura, hasta hoy (o hasta ayer, si hoy aún no has leído)
  const ok = i => (A.get(rlDay(rlBack(i)))?.s || 0) >= 60; let i = ok(0) ? 0 : 1, n = 0; while (ok(i)) { n++; i++; } return n;
}
function rlDraw0() {   // la entrada de la barra lateral: solo si hay algo guardado
  const g = $('#sg-rl'); if (!g) return; const has = !!db.readLog && Object.keys(db.readLog).length > 0; g.hidden = !has; if (!has) return;
  const t = rlSum(rlAgg(), 1); $('#rlN').textContent = t.s >= 60 ? `(${rlFmt(t.s)} hoy)` : '';
}
function rlOpen() {
  let d = $('#rl'); if (!d) { d = document.createElement('dialog'); d.id = 'rl'; document.body.append(d); }
  rlDraw(); if (!d.open) d.showModal();
}
function rlDraw() {
  const d = $('#rl'); if (!d) return; const A = rlAgg(), T = rlSum(A, 1), W = rlSum(A, 7), M = rlSum(A, 30), streak = rlStreak(A);
  const tile = (lbl, o, extra = '') => `<div class="rlt"><small>${lbl}</small><b>${rlFmt(o.s)}</b><span>${o.p} pág. · ${o.d.size} ${o.d.size === 1 ? 'paper' : 'papers'}${extra}</span></div>`;
  const days = [...Array(30)].map((_, i) => { const t = rlBack(29 - i), e = A.get(rlDay(t)); return {t, s: e?.s || 0, p: e?.p || 0, n: e?.d.size || 0}; });
  const max = Math.max(600, ...days.map(x => x.s)), fd = t => t.toLocaleDateString('es', {day: 'numeric', month: 'short'});
  const bars = days.map(x => { const tip = `${fd(x.t)}: ${x.s ? `${rlFmt(x.s)} · ${x.p} pág.` : 'sin lectura'}`;
    return `<div class="rlb" title="${esc(tip)}" aria-label="${esc(tip)}" role="img"><i style="height:${x.s ? Math.max(3, Math.round(x.s / max * 100)) : 0}%"></i></div>`; }).join('');
  const cnt = new Map(); for (let i = 0; i < 30; i++) A.get(rlDay(rlBack(i)))?.d.forEach(id => cnt.set(id, (cnt.get(id) || 0) + 1));
  const top = [...cnt].map(([id, n]) => [db.papers.find(p => String(p.id) === id), n]).filter(x => x[0]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const empty = !A.size;
  d.innerHTML = `<div class="dh"><h2>📊 Estadísticas de lectura</h2><div class="dbtn"><button data-onclick="$('#rl').close()">Cerrar ✕</button></div></div>
    ${empty ? '<p class="hint">Aún no hay lectura guardada. Cuenta el tiempo que lees PDF y EPUB en el visor de la app (de todos tus dispositivos, si usas Google Drive).</p>' : `
    <div class="rlts">${tile('Hoy', T)}${tile('Últimos 7 días', W)}${tile('Últimos 30 días', M)}<div class="rlt"><small>Racha</small><b>${streak} ${streak === 1 ? 'día' : 'días'}</b><span>seguidos leyendo (≥ 1 min)</span></div></div>
    <h3 class="rlh">Minutos de lectura al día · últimos 30 días</h3>
    <div class="rlc" role="group" aria-label="Minutos de lectura de cada día de los últimos 30">${bars}</div>
    <div class="rlx"><span>${esc(fd(days[0].t))}</span><span>máx. ${rlFmt(Math.max(...days.map(x => x.s)))}</span><span>hoy</span></div>
    ${top.length ? `<h3 class="rlh">Lo que más has leído (30 días)</h3><ol class="rlp">${top.map(([p, n]) => `<li><button class="lnk" data-onclick="$('#rl').close();openPaper('${p.id}')">${esc(shortTxt(p.alias || p.title))}</button> <small>${n} ${n === 1 ? 'día' : 'días'}</small></li>`).join('')}</ol>` : ''}
    <p class="hint">Solo cuenta el tiempo que lees de verdad en el visor (con actividad en los últimos 2 minutos o con el avance automático). En el EPUB, una página son unas 2000 letras.</p>`}`;
}
