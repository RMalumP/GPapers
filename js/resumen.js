/* ---- Resumen de anotaciones (Exportar → «🖍 Resumen de anotaciones…») ----
   Para los papers del alcance de Exportar (seleccionados, los visibles con los filtros o todos), en su orden: la cita completa
   en el estilo elegido y debajo sus subrayados, zonas y notas, por página y de arriba abajo. Se descarga en Word (.docx), PDF o Markdown. */
const SUM_KIND = a => a.k === 'note' ? 'Nota' : a.k === 'area' ? 'Zona' : 'Subrayado';
function sumData() {
  const o = ex(), L = exList();
  return L.map(p => ({p, cite: cite(p, o), pdfs: PDF_N.map(n => p[pdfF(n)]).filter(pf => pf && Array.isArray(pf.ann) && pf.ann.length).map(pf => ({name: pf.name || 'PDF', L: annSorted(pf.ann)}))}))
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
      for (const a of f.L) out.push(`- **p. ${a.p + 1}** · ${SUM_KIND(a)}${a.t ? `: «${sumOne(a.t)}»` : ''}${a.m ? `\n  ${a.k === 'note' ? '' : '*Comentario:* '}${a.m.trim().replace(/\n/g, '\n  ')}` : ''}`);
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
        body.push(P(R('■ ', `<w:color w:val="${col}"/><w:sz w:val="20"/>`) + R(`p. ${a.p + 1}  `, '<w:b/><w:sz w:val="22"/>') + (a.t ? R(`«${sumOne(a.t)}»`, '<w:sz w:val="22"/>') : R(SUM_KIND(a), '<w:i/><w:sz w:val="22"/>')), '<w:spacing w:after="40"/><w:ind w:left="360"/>'));
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
        para([{t: `p. ${a.p + 1}  `, f: 'b'}, a.t ? {t: `«${sumOne(a.t)}»`, f: 'r'} : {t: SUM_KIND(a), f: 'i'}], {size: 11, left: 36, after: a.m ? 1 : 4, mark: hex(a.c)});
        if (a.m) para([{t: sumOne(a.m), f: 'i'}], {size: 10.5, left: 54, after: 4});
      }
    }
  }
  doc.setTitle('Resumen de anotaciones'); doc.setCreator('GPapers');
  return await doc.save();
}
