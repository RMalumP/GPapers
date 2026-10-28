'use strict';
/* ===== Citas (extensible: añade una entrada a STYLES) =====
   Cada fn(p, o) devuelve la cita con marcas: *cursiva* y **negrita** (igual que las notas); un asterisco literal
   se escribe \*. txt y vista previa quitan las marcas (citeTxt); Word y «Copiar con formato» las convierten (citeHtml).
   `o` son las opciones de exportación (settings.export): lang, dateFmt, vanAll… */
const parse = a => a.map(x => { x = x.trim(); const i = x.indexOf(',');
  return i < 0 ? {l: x.split(' ').pop(), g: x.split(' ').slice(0, -1).join(' ')} : {l: x.slice(0, i).trim(), g: x.slice(i + 1).trim()}; });
// iniciales: con punto «N. G.» (guion: «S.-Y.»); sin punto «NG» (Vancouver). Acepta nombres ya abreviados («J.C.»)
const ini = (g, dot) => g.replace(/(\p{Lu})\.(?=\p{L})/gu, '$1. ').split(/\s+/).filter(Boolean)
  .map(w => w.split('-').filter(x => /\p{L}/u.test(x)).map(x => x[0].toUpperCase() + (dot ? '.' : '')).join(dot ? '-' : '')).filter(Boolean).join(dot ? ' ' : '');
const ea = s => String(s ?? '').replace(/\*/g, '\\*');   // escapa los asteriscos de los datos
const it = s => s ? '*' + s + '*' : '';
const endDot = s => !s || /[.?!…]\*?$/.test(s) ? s : s + '.';
const citeTxt = s => String(s ?? '').replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\u0001/g, '*');
const citeHtml = s => esc(s).replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\u0001/g, '*');
// Autor entidad (provisional hasta tener el campo authorType): sin coma y con una palabra típica de organización, o siglas en mayúsculas
const ORG_RX = /(?<!\p{L})(organi[sz]aci[oó]n|organi[sz]ation|asociaci[oó]n|association|academia|academy|instituto|institute|instituci[oó]n|universidad|university|ministerio|ministry|sociedad|society|agencia|agency|fundaci[oó]n|foundation|comisi[oó]n|commission|comit[eé]|committee|consejo|council|departamento|department|centro|center|centre|servicio|ayuntamiento|federaci[oó]n|federation|corporaci[oó]n|corporation|laboratorio|laboratory|hospital|naciones|nations|gobierno|government|banco|world|national|nacional|inc|ltd|llc|gmbh)(?!\p{L})/iu;
const isOrg = s => !s.includes(',') && (ORG_RX.test(s) || /^[\p{Lu}0-9&.\-]{2,}$/u.test(s));
const pAuth = (a, t = 'auto') => t === 'sin_autor' ? [] : a.map(x => { x = x.trim();   // t = authorType del paper
  return t === 'entidad' || (t !== 'persona' && isOrg(x)) ? {l: x, g: '', org: true} : parse([x])[0]; });
const pAuthP = p => pAuth(p.authors, p.authorType);
// enlace de la cita según p.linkMode (por defecto automático: DOI y, si no hay, URL)
const citeLink = p => { const m = p.linkMode || 'auto', d = p.doi ? 'https://doi.org/' + normDoi(p.doi) : '', u = p.url || '';
  return m === 'none' ? '' : m === 'doi' ? d : m === 'url' ? u : d || u; };
const MES = {es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']};
function fdate(s, o) {   // fecha de consulta (aaaa-mm-dd) según la opción dateFmt
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return s || '';
  const [, y, mo, d] = m, i = +mo - 1; if (i < 0 || i > 11 || o.dateFmt === 'iso') return s;
  if (o.dateFmt === 'dmy') return `${d}-${mo}-${y}`;
  return o.lang === 'en' ? `${y} ${MES.en[i]} ${+d}` : `${+d} de ${MES.es[i]} de ${y}`;
}
const L10 = {   // conectores y etiquetas según la opción lang
  es: {and: 'y', in: 'En', cons: 'consultado', avail: 'Disponible en', sd: 's.f.', conf: 'Comunicación en congreso', thesis: 'Tesis', thesisNet: 'Tesis en Internet', eds: ['editor', 'editores']},
  en: {and: '&', in: 'In', cons: 'cited', avail: 'Available from', sd: 'n.d.', conf: 'Paper presentation', thesis: 'Thesis', thesisNet: 'Thesis on the Internet', eds: ['editor', 'editors']}};
const MESF = {es: MES.es, en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']};
const okDate = s => /^(\d{4})-(\d{2})-(\d{2})$/.test(s || '') && +s.slice(5, 7) >= 1 && +s.slice(5, 7) <= 12;
const NEWS = p => p.type === 'prensa' || p.type === 'blog';   // F3b: tipos con fecha completa (día, mes, año)
const fdOk = p => okDate(p.pubDate) && (!p.year || p.pubDate.slice(0, 4) === String(p.year));   // fecha completa utilizable: si el año no coincide con «year», manda el año
const apaDate = (s, o) => { const [y, m, d] = s.split('-'), mo = MESF[o.lang === 'en' ? 'en' : 'es'][+m - 1], Y = y + (o.ys || '');   // (24 de octubre, 2017) · (2017, October 24)
  return o.lang === 'en' ? `${Y}, ${mo} ${+d}` : `${+d} de ${mo}, ${Y}`; };
const edLbl = (e, lang) => { e = String(e ?? '').trim(); if (!e) return '';   // edición: «2» → «2.ª ed.» / «2nd ed.»; texto libre → se añade «ed.»
  if (/^\d+$/.test(e)) { const n = +e; return n < 2 ? '' : lang === 'en' ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : {1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'} ed.` : `${n}.ª ed.`; }
  return /\bed\.?$/i.test(e) ? e : e + ' ed.'; };
const pgs = (s, pp) => { s = String(s ?? '').trim(); return !s ? '' : pp ? (/^\d+$|^[A-Za-z]?\d+$/.test(s) ? 'p. ' : 'pp. ') + s : s; };   // páginas con o sin «p.»/«pp.»
const yE = l => /^(i|hi(?!e))/i.test(String(l).normalize('NFD').replace(/[̀-ͯ]/g, '')) ? ' e' : ' y';   // conjunción española: «e» ante i-/hi- (no hie-)
const yD = a => yE(a.org || !a.g ? a.l : a.g);   // autor en orden directo («Nombre Apellido»): la palabra que sigue a la conjunción es el nombre de pila
const apaJoin = (A, P, o) => {   // lista de autores/editores APA: «A», «A y B», «A, B y C» (en inglés «, &»)
  if (A.length < 2) return A[0] || '';
  const c = o.lang === 'en' ? ', &' : yE(P.at(-1).l);   // «e» ante i-/hi-
  return A.slice(0, -1).join(', ') + c + ' ' + A.at(-1); };
const hasFull = g => g.split(/\s+/).some(w => !/^(\p{Lu}\.?)(-?\p{Lu}\.?)*$/u.test(w));   // ¿el nombre tiene alguna palabra que no sea inicial?
const apaFn = (p, o, full) => {   // full = variante 2: nombre completo entre corchetes tras las iniciales
    const L = L10[o.lang] || L10.es, P = pAuthP(p);
    const A = P.map(a => a.org ? ea(a.l) : a.g ? `${ea(a.l)}, ${ini(a.g, 1)}${full && hasFull(a.g) ? ` [${ea(a.g)}]` : ''}` : ea(a.l));
    let au = A[0] || '';
    if (A.length > 20) au = A.slice(0, 19).join(', ') + ', . . . ' + A.at(-1);
    else au = apaJoin(A, P, o);
    if (P.at(-1)?.org) au = endDot(au);
    const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = citeLink(p);
    const Y = (p.type === 'web' ? okDate(p.pubDate) : NEWS(p) && fdOk(p)) ? apaDate(p.pubDate, o) : p.year ? p.year + (o.ys || '') : L.sd + (o.ys ? '-' + o.ys : '');   // o.ys = letra de desambiguación (2020a)
    let t = ['libro', 'tesis', 'web', 'congreso'].includes(p.type) ? it(T) : T, rest;   // título en cursiva en obras independientes
    if (p.type === 'libro' && edLbl(p.edition, o.lang)) t += ` (${ea(edLbl(p.edition, o.lang))})`;
    if (p.type === 'congreso') t += ` [${L.conf}]`;
    if (p.type === 'tesis') { const tt = ea(p.thesisType || L.thesis); t += ` [${V ? tt + ', ' + V : tt}]`; }
    if (p.type === 'libro' || p.type === 'web') rest = [endDot(V)];
    else if (p.type === 'capitulo') {   // En I. Apellido (Ed.), *Libro* (pp. x-y). Editorial.
      const E = pAuth(p.editors || []), eds = apaJoin(E.map(e => e.org || !e.g ? ea(e.l) : `${ini(e.g, 1)} ${ea(e.l)}`), E, o), pg = pgs(ea(p.pages), o.ppChap !== false);
      rest = [V ? endDot(`${L.in} ${eds ? `${eds} (${E.length > 1 ? 'Eds.' : 'Ed.'}), ` : ''}${it(V)}${pg ? ` (${pg})` : ''}`) : '', endDot(ea(p.publisher || ''))]; }
    else if (p.type === 'congreso') rest = [endDot([V, ea(p.place || '')].filter(Boolean).join(', '))];
    else if (p.type === 'tesis') rest = [];
    else if (p.type === 'prensa') rest = link ? [endDot(it(V))] : [endDot([V ? it(V) : '', ea(p.pages || '')].filter(Boolean).join(', '))];   // digital: *Periódico*. url · impresa (sin enlace): *Periódico*, B5.
    else if (p.type === 'blog') rest = [endDot(it(V))];   // título del post sin cursiva, blog en cursiva
    else {   // artículo (y tipo desconocido): *Revista*, *vol*(núm), pp-pp
      const vi = [p.volume ? it(ea(p.volume)) : '', p.issue ? `(${ea(p.issue)})` : ''].join('');
      rest = [endDot([V ? it(V) : '', vi, ea(p.pages || '')].filter(Boolean).join(', '))]; }
    return [au ? `${au} (${Y}).` : `${endDot(t)} (${Y}).`, au ? endDot(t) : '', ...rest, p.type === 'prensa' && !link ? '' : link].filter(Boolean).join(' ').trim(); };
const vanFn = (p, o, full) => {   // full = variante 2: «Apellido, Nombre» separados por «;»
    const L = L10[o.lang] || L10.es;
    const nm = a => a.org ? ea(a.l) : full ? `${ea(a.l)}${a.g ? ', ' + ea(a.g) : ''}` : `${ea(a.l)}${a.g ? ' ' + ini(a.g) : ''}`, sp = full ? '; ' : ', ';
    const A = pAuthP(p).map(nm);
    const au = !o.vanAll && A.length > 6 ? A.slice(0, 6).join(sp) + sp + 'et al' : A.join(sp);
    const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = citeLink(p);
    const online = !!link || p.type === 'web' || p.type === 'blog', net = online ? ' [Internet]' : '';
    const yr = (p.type === 'web' ? okDate(p.pubDate) : NEWS(p) && fdOk(p)) ? fdate(p.pubDate, o) : p.year;
    const cons = online && p.accessed && !p.hideAccessed ? `[${L.cons} ${fdate(p.accessed, o)}]` : '';
    const dat = [yr, cons].filter(Boolean).join(' ');   // «2021 [consultado …]»
    const ed = edLbl(p.edition, o.lang), plc = ea(p.place || ''), pb = ea(p.publisher || '');
    const join = (a, b, sep) => a && b ? a + sep + b : a || b;
    const pubOf = pubr => { const lp = join(plc, pubr, ': '); return join(lp, dat, '; '); };   // «Lugar: Editorial; año [consultado …]»
    let b;
    if (p.type === 'libro' || p.type === 'web') b = [endDot(T + net), ed && p.type === 'libro' ? endDot(ea(ed)) : '', endDot(pubOf(V))];
    else if (p.type === 'tesis') { const tt = p.thesisType ? p.thesisType[0].toLowerCase() + p.thesisType.slice(1) : '';
      b = [endDot(`${T} [${tt ? ea(tt) + (online ? ' en Internet' : '') : online ? L.thesisNet : L.thesis}]`), endDot(pubOf(V))]; }
    else if (p.type === 'blog') b = [endDot(T), dat ? endDot(dat) : '', V ? endDot(`${L.in}: ${V}${net}`) : ''];   // contribución: Autor. Título. fecha [consultado …]. En: Blog [Internet].
    else if (p.type === 'capitulo' || p.type === 'congreso') {
      const E = pAuth(p.editors || []).map(nm), w = L.eds[E.length > 1 ? 1 : 0], pg = ea(p.pages || '');
      const cont = V ? endDot(`${L.in}: ${E.length ? E.join(sp) + ', ' + w + '. ' : ''}${V}${net}`) : '';
      b = [endDot(T), cont, endDot(pubOf(pb)), pg ? endDot(`p. ${pg}`) : '']; }
    else {   // artículo: Revista [Internet]. año [consultado …]; vol(núm):pp-pp.
      const vol = p.volume ? ea(p.volume) + (p.issue ? `(${ea(p.issue)})` : '') : p.issue ? `(${ea(p.issue)})` : '', vp = vol + (p.pages ? (vol ? ':' : '') + ea(p.pages) : '');   // sin volumen no hay «:» huérfano (prensa: 2017;B5)
      const sep = cons ? '; ' : ';';
      b = [endDot(T), V ? endDot(V + net) : '', endDot(vp ? (dat ? dat + sep + vp : vp) : dat)]; }
    return [endDot(au), ...b, link && `${L.avail}: ${link}`].filter(Boolean).join(' ').trim(); };

// ---- MLA 8.ª/9.ª (F2a): Autor. Título. Contenedor, colaboradores, versión, número, editorial, fecha, localización.
const MLA_M = {es: ['ene.', 'feb.', 'mar.', 'abr.', 'mayo', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'], en: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']};
const mlaPub = (s, o) => { const [y, m, d] = s.split('-'); return `${+d} ${MLA_M[o.lang === 'en' ? 'en' : 'es'][+m - 1]} ${y}`; };   // 28 Nov. 2003 (meses abreviados; verificar en español)
const mlaLong = (s, o) => o.lang === 'en' ? mlaPub(s, o) : `${+s.slice(8)} de ${MES.es[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;   // prensa y blog: «22 de octubre de 2020» (guía MLA-BLOG) / «22 Oct. 2020»
const mlaAcc = (s, o) => okDate(s) && o.lang === 'en' && (o.dateFmt || 'long') === 'long' ? mlaPub(s, o) : fdate(s, o);   // fecha de consulta: 20 Oct. 2026 / 20 de octubre de 2026
const mlaLink = p => { const l = citeLink(p); return /^https?:\/\/(dx\.)?doi\.org\//i.test(l) ? l : l.replace(/^https?:\/\//i, ''); };   // se quita https:// de las URL, no de los DOI
const mlaFn = (p, o) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase();
  const inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
  let A = pAuthP(p);
  if ((p.type === 'libro' || p.type === 'web') && A.length === 1 && A[0].org && norm(A[0].l) === norm(p.venue)) A = [];   // entidad = editorial/sitio: se empieza por el título
  const au = A.length === 1 ? inv(A[0]) : A.length === 2 ? `${inv(A[0])}${en ? ' and' : yD(A[1])} ${dir(A[1])}` : A.length > 2 ? inv(A[0]) + ', et al.' : '';
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(mlaLink(p));
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`;   // español: punto fuera de las comillas (guía S5); inglés: dentro
  const cont = a => endDot(a.filter(Boolean).join(', '));
  const yr = p.type === 'web' && okDate(p.pubDate) ? mlaPub(p.pubDate, o) : NEWS(p) && fdOk(p) ? mlaLong(p.pubDate, o) : p.year ? String(p.year) : '';
  const acc = link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Consultado el'} ${mlaAcc(p.accessed, o)}.` : '';
  const pg = pgs(ea(p.pages), true), ed = ea(edLbl(p.edition, o.lang));
  let ti, ct;
  if (p.type === 'libro') { ti = endDot(it(T)); ct = cont([ed, V, yr, link]); }
  else if (p.type === 'tesis') { ti = endDot(it(T)); ct = cont([ea(p.thesisType || L.thesis), V, yr, link]); }
  else if (p.type === 'web' || p.type === 'blog') { ti = qt(T); ct = cont([V ? it(V) : '', yr, link]); }
  else if (p.type === 'capitulo' || (p.type === 'congreso' && (p.publisher || p.pages))) {   // actas publicadas = capítulo
    const E = pAuth(p.editors || []).map(dir), eds = E.length > 2 ? E[0] + ' et al.' : E.length === 2 ? `${E[0]}${en ? ' and' : yD(pAuth(p.editors)[1])} ${E[1]}` : E[0] || '';
    ti = qt(T); ct = cont([V ? it(V) : '', eds && `${en ? 'edited by' : 'editado por'} ${eds}`, ea(p.publisher || ''), yr, pg, link]); }
  else if (p.type === 'congreso') { ti = qt(T); ct = cont([V, yr, ea(p.place || ''), link]); }   // conferencia no impresa: evento, fecha, lugar
  else { ti = qt(T); ct = cont([V ? it(V) : '', p.volume ? `vol. ${ea(p.volume)}` : '', p.issue ? `${en ? 'no.' : 'núm.'} ${ea(p.issue)}` : '', yr, pg, link]); }   // artículo
  return [au && endDot(au), ti, ct, acc].filter(Boolean).join(' ').trim();
};

// ---- IEEE (F2b): inglés fijo, numerado. [n] I. Apellido, “Título,” Contenedor, vol., no., pp., Mes Año.
const ieeeThesis = t => { t = String(t ?? '').trim(); return !t ? 'Thesis' : /doctor|ph\.?\s?d/i.test(t) ? 'Ph.D. dissertation' : /m[aá]ster|master|\bm\.?\s?s\b/i.test(t) ? 'M.S. thesis' : /grado|bachelor|\bb\.?\s?s\b|carrera|licenciatura/i.test(t) ? 'B.S. thesis' : t; };
const ieeeFn = (p, o) => {
  const P = pAuthP(p), nm = a => a.org || !a.g ? ea(a.l) : `${ini(a.g, 1)} ${ea(a.l)}`;
  const list = (E, et) => !E.length ? '' : et && E.length > 6 ? nm(E[0]) + ' et al.' : E.length === 1 ? nm(E[0]) : E.length === 2 ? `${nm(E[0])} and ${nm(E[1])}` : E.slice(0, -1).map(nm).join(', ') + ', and ' + nm(E.at(-1));
  const au = list(P, true), lead = au ? au + ', ' : '';
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p)), yr = p.year ? String(p.year) : '';
  const my = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? `${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${p.pubDate.slice(0, 4)}` : yr;   // «June 1997»
  const dl = NEWS(p) && fdOk(p) ? `${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${+p.pubDate.slice(8)}, ${p.pubDate.slice(0, 4)}` : my;   // prensa: «October 24, 2017»
  const pg = pgs(ea(p.pages), true), plc = ea(p.place || ''), join = (a, b, sep) => a && b ? a + sep + b : a || b;
  const fin = x => /[.?!…][”*]*$/.test(x) ? x : x + '.';
  const quoted = rest => rest ? (/[?!]$/.test(T) ? `“${T}” ` : `“${T},” `) + fin(rest) : `“${fin(T)}”`;   // coma dentro de las comillas
  const onl = link ? ` [Online]. Available: ${link}` : '';
  let body;
  if (p.type === 'web' || p.type === 'blog') {   // guía: Autor. (año, Mes día). Título [Online]. Available: url (el sitio va tras el título: verificar; el blog usa la plantilla de Internet)
    const m = (p.type === 'web' ? okDate(p.pubDate) : fdOk(p)) ? `${p.pubDate.slice(0, 4)}, ${MESF.en[+p.pubDate.slice(5, 7) - 1]} ${+p.pubDate.slice(8)}` : yr, dt = m ? `(${m}).` : '', ts = T + (V ? '. ' + V : '');
    body = au ? [fin(au), dt, ts].filter(Boolean).join(' ') : [fin(T), dt, V].filter(Boolean).join(' ');
    return link ? body.replace(/\.$/, '') + onl : fin(body); }
  if (p.type === 'libro') {
    const ed = ea(edLbl(p.edition, 'en')), tail = [join(plc, V, ': '), my].filter(Boolean).join(', ');
    body = `${lead}${ed ? it(T) + ', ' + ed : endDot(it(T))}${tail ? ' ' + fin(tail) : ''}`; }
  else if (p.type === 'tesis') body = lead + quoted([ea(ieeeThesis(p.thesisType)), V, plc, my].filter(Boolean).join(', '));
  else if (p.type === 'capitulo') {
    const E = pAuth(p.editors || []), eds = E.length ? `${list(E, false)}, ${E.length > 1 ? 'Eds.' : 'Ed.'}` : '', tail = [join(plc, ea(p.publisher || ''), ': '), my, pg].filter(Boolean).join(', ');
    body = lead + quoted(V ? `in ${it(V)}${eds ? ', ' + eds + (tail ? ' ' + tail : '') : tail ? ', ' + tail : ''}` : tail); }
  else if (p.type === 'congreso') {
    body = lead + quoted(p.publisher || p.pages ? [V && `in ${V}`, plc, my, pg].filter(Boolean).join(', ') : [V && `presented at ${V}`, plc, my].filter(Boolean).join(', ')); }   // actas publicadas / ponencia no publicada
  else if (p.type === 'prensa') body = lead + quoted([V ? it(V) : '', dl, pg].filter(Boolean).join(', '));   // «T,» *Periódico*, October 24, 2017, p. B5.
  else body = lead + quoted([V ? it(V) : '', p.volume ? `vol. ${ea(p.volume)}` : '', p.issue ? `no. ${ea(p.issue)}` : '', pg, my].filter(Boolean).join(', '));   // artículo
  return fin(body) + onl;
};

// ---- Chicago 17.ª ed. (F2c autor-fecha, F2d notas y bibliografía: af=false): lista de referencias / bibliografía
const chiAcc = (s, o) => okDate(s) && o.lang === 'en' && (o.dateFmt || 'long') === 'long' ? `${MESF.en[+s.slice(5, 7) - 1]} ${+s.slice(8)}, ${s.slice(0, 4)}` : fdate(s, o);   // May 1, 2017 / 1 de mayo de 2017
const chiLong = (s, o) => o.lang === 'en' ? `${MESF.en[+s.slice(5, 7) - 1]} ${+s.slice(8)}, ${s.slice(0, 4)}` : `${+s.slice(8)} de ${MES.es[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;   // fecha larga de publicación (no depende de dateFmt)
const chiFn = (p, o, af) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase();
  const P = pAuthP(p), inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
  const chList = (E, fst) => {   // 1.º invertido (autores) o todos directos (editores); >10 → 7 + et al.; «y»/«e» en español, «, and» en inglés
    const nm = (a, i) => i ? dir(a) : fst(a);
    if (!E.length) return ''; if (E.length > 10) return E.slice(0, 7).map(nm).join(', ') + ', et al.'; if (E.length === 1) return nm(E[0], 0);
    const c = en ? (E.length === 2 && fst === dir ? ' and' : ', and') : yD(E.at(-1));
    return E.slice(0, -1).map(nm).join(', ') + c + ' ' + nm(E.at(-1), E.length - 1); };
  const au = chList(P, inv), T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p));
  const yr = p.year ? String(p.year) : '', Y = yr ? yr + (o.ys || '') : 'n.d.' + (o.ys ? '-' + o.ys : ''), yn = af ? '' : yr;   // yn = año dentro de la entrada (notas-bibl.)
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`, join = (a, b, sep) => a && b ? a + sep + b : a || b;
  const plc = ea(p.place || ''), pb = ea(p.publisher || ''), pg = ea(p.pages || ''), cj = a => endDot(a.filter(Boolean).join(', '));
  const mon = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? MESF[en ? 'en' : 'es'][+p.pubDate.slice(5, 7) - 1] : '';   // solo el mes (guía: «(April)»)
  const acc = !yr && link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Acceso el'} ${chiAcc(p.accessed, o)}.` : '';
  let ti, ct = [];
  const actas = () => {   // capítulo o ponencia publicada en actas: En *Libro*, editado por X, páginas. Lugar: Editorial[, año].
    const E = pAuth(p.editors || []), eds = chList(E, dir);
    if (V) ct.push(endDot(`${L.in} ${it(V)}${eds ? `, ${en ? 'edited by' : 'editado por'} ${eds}` : ''}${pg ? ', ' + pg : ''}`));
    const tail = [join(plc, pb, ': '), yn].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); };
  if (p.type === 'libro') {
    ti = endDot(it(T)); const ed = ea(edLbl(p.edition, o.lang)); if (ed) ct.push(ed);
    const tail = [join(plc, V, ': '), yn].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); }
  else if (p.type === 'tesis') { ti = qt(T); ct.push(cj([ea(p.thesisType || L.thesis), V, yn])); }
  else if (p.type === 'web') { ti = qt(T); ct.push(cj([norm(V) === norm(P.length === 1 ? p.authors[0] : '') ? '' : V, yn])); }
  else if (p.type === 'capitulo') { ti = qt(T); actas(); }
  else if (p.type === 'congreso') { ti = qt(T);
    if (p.publisher || p.pages) actas(); else ct.push(cj([V && `${en ? 'Paper presented at' : 'Comunicación presentada en'} ${V}`, plc, yn])); }
  else if (NEWS(p)) {   // prensa y blog: “T.” *Medio*, 8 de marzo de 2017. url. (páginas: solo en nota, se omiten)
    ti = qt(T); const dl = fdOk(p) ? chiLong(p.pubDate, o) : af ? '' : yr; ct.push(cj([V ? it(V) : '', dl])); }
  else {   // artículo: *Revista* 111, n.º 2 (abril): 165–76
    ti = qt(T); const a1 = [V ? it(V) : '', p.volume ? ea(p.volume) : ''].filter(Boolean).join(' '), iss = p.issue ? `${a1 ? ', ' : ''}${en ? 'no.' : 'n.º'} ${ea(p.issue)}` : '';
    const dt = [mon, yn].filter(Boolean).join(' ');
    ct.push(endDot(`${a1}${iss}${dt ? ` (${dt})` : ''}${pg ? (a1 || iss || dt ? ': ' : '') + pg : ''}`)); }
  const head = af ? (au ? [endDot(au), endDot(Y), ti] : [ti, endDot(Y)]) : [au && endDot(au), ti];
  return [...head, ...ct.filter(Boolean), acc, link && endDot(link)].filter(Boolean).join(' ').trim();
};
// ---- UNE-ISO 690:2024 (F2e). nf = true: nombre-fecha (año tras el creador); nf = false: numérico (año al final). Orden de elementos DERIVADO de los ejemplos de la guía (9.2–9.3): verificar
const uneFn = (p, o, nf) => {
  const L = L10[o.lang] || L10.es, en = o.lang === 'en', norm = x => String(x ?? '').trim().toLowerCase(), UP = x => String(x).toLocaleUpperCase('es');
  const du = x => fdate(x, {...o, dateFmt: o.dateFmt === 'iso' ? 'iso' : 'dmy'});   // UNE escribe dd-mm-aaaa (o ISO); la fecha larga no se usa
  const inv = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(UP(a.l))}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`;   // APELLIDO, Nombre · Nombre APELLIDO
  const list = (E, fst) => {   // 1.º invertido (autores) o todos directos (editores); más de 3 → primero + et al.; «y»/«e» según el nombre de pila que sigue
    const f = (a, i) => i ? dir(a) : fst(a);
    if (!E.length) return ''; if (E.length > 3) return fst === dir ? `${dir(E[0])} et al.` : `${fst(E[0])}, et al.`; if (E.length === 1) return f(E[0], 0);
    return E.slice(0, -1).map(f).join(', ') + (en ? ' and' : yD(E.at(-1))) + ' ' + f(E.at(-1), E.length - 1); };
  const P = pAuthP(p), au = list(P, inv), T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), link = ea(citeLink(p)), plc = ea(p.place || ''), pb = ea(p.publisher || '');
  const yr = p.year ? String(p.year) : '', Y = yr ? yr + (o.ys || '') : `[${L.sd}]` + (o.ys ? '-' + o.ys : ''), yEnd = !nf ? yr : '';   // yEnd = año al final (numérico)
  const join = (a, b, sep) => a && b ? a + sep + b : a || b, on = link ? (en ? 'Online.' : 'En línea.') : '', pg = ea(pgs(p.pages, true));
  const pub = (a, ...r) => endDot([a, ...r].filter(Boolean).join(', '));
  let ti, ct = [];
  if (p.type === 'libro') { ti = endDot(it(T)); const ed = ea(edLbl(p.edition, o.lang)); if (ed) ct.push(ed); ct.push(pub(join(plc, V, ': '), yEnd)); }
  else if (p.type === 'tesis') { ti = endDot(it(T)); ct.push(endDot(ea(p.thesisType || L.thesis)), pub(join(plc, V, ': '), yEnd)); }
  else if (p.type === 'capitulo' || p.type === 'congreso') {   // comunicación = parte de una monografía: En: Editor (ed.). *Obra*. Lugar: Editorial, año, pp. x-y.
    ti = endDot(T); const E = pAuth(p.editors || []), eds = list(E, dir), er = E.length > 1 ? 'eds.' : 'ed.';
    const inb = [eds && `${eds} (${er})`, V && it(V)].filter(Boolean); if (inb.length) ct.push(`${L.in}: ${inb.map(endDot).join(' ')}`);   // En: Editor (ed.). *Obra*.
    ct.push(pub(join(plc, pb, ': '), yEnd, pg)); }
  else if (p.type === 'web') {
    ti = endDot(T); if (V && norm(V) !== norm(P.length === 1 ? p.authors[0] : '')) ct.push(endDot(V));
    ct.push(on); const dt = okDate(p.pubDate) && (!yr || p.pubDate.slice(0, 4) === yr) ? du(p.pubDate) : yEnd; if (dt) ct.push(endDot(dt)); }
  else if (NEWS(p)) {   // periódico: la fecha sustituye a volumen y número; blog: «Entrada de blog.» tras el título (designación de tipo, 9.2)
    ti = endDot(T); if (p.type === 'blog') ct.push(en ? 'Blog post.' : 'Entrada de blog.'); ct.push(on, endDot(V ? it(V) : ''));
    const tail = [fdOk(p) ? du(p.pubDate) : yEnd, p.type === 'prensa' ? pg : ''].filter(Boolean).join(', '); if (tail) ct.push(endDot(tail)); }
  else {   // artículo: *Revista*, **vol**(núm), pp. x-y  (numérico: *Revista*. año, **vol**(núm), pp. x-y)
    ti = endDot(T); const vi = [p.volume ? `**${ea(p.volume)}**` : '', p.issue ? (p.volume ? `(${ea(p.issue)})` : `${en ? 'no.' : 'n.º'} ${ea(p.issue)}`) : ''].join('');
    ct.push(on); if (nf) ct.push(pub([V ? it(V) : '', vi].filter(Boolean).join(', '), pg)); else ct.push(endDot(V ? it(V) : ''), pub(yEnd, vi, pg)); }
  if (p.type !== 'web' && p.type !== 'articulo' && !NEWS(p)) ct.unshift(on);
  const lk = link ? endDot(`${L.avail}: ${link}`) : '', acc = link && p.accessed && !p.hideAccessed ? `[${en ? 'Viewed' : 'Consulta'}: ${du(p.accessed)}].` : '';
  const head = nf ? (au ? [`${au}, ${Y}.`, ti] : [ti, endDot(Y)]) : [au && endDot(au), ti];
  return [...head, ...ct.filter(Boolean), lk, acc].filter(Boolean).join(' ').trim();
};
/* ---- F3c–F3e: tipos nuevos (informe, norma, patente, mapa, dataset, software, basedatos, audiovisual, audio, redsocial, ia, diccionario, presentacion, personal, legislacion).
   Un solo motor xFn(p, o, estilo): reutiliza el formato de autores de cada estilo (XAU) y aplica la plantilla de la guía donde la hay; el resto es genérica y se avisa (XCOVER/typeWarn). ---- */
const XTYPES = new Set(['informe', 'norma', 'patente', 'mapa', 'dataset', 'software', 'basedatos', 'audiovisual', 'audio', 'redsocial', 'ia', 'diccionario', 'presentacion', 'personal', 'legislacion']);
const XDEF = {mapa: ['Mapa', 'Map'], dataset: ['Conjunto de datos', 'Dataset'], software: ['Software', 'Software'], audiovisual: ['Película', 'Film'], audio: ['Audio podcast', 'Audio podcast'], redsocial: ['Publicación', 'Post'],
  ia: ['Modelo de lenguaje de gran tamaño', 'Large language model'], presentacion: ['Presentación de PowerPoint', 'PowerPoint presentation'], personal: ['Comunicación personal', 'Personal communication']};   // designación por defecto [es, en]
const verLbl = (x, en) => !x ? '' : /^(v\d|vers|ver\b|edici|edition|release|ed\.)/i.test(x) ? x : (en ? 'Version ' : 'Versión ') + x;   // «2.1» → «Versión 2.1»; «Edición para empresas» y «v26» se dejan
const noAbbr = s => String(s ?? '').replace(/\s*\([^()]{1,12}\)\s*$/, '').trim();   // «Organismo (ISO)» → «Organismo»
const abbrOf = s => (/\(([^()]{1,12})\)\s*$/.exec(String(s ?? '')) || [])[1] || '';   // siglas entre paréntesis al final
const OWN = p => ['informe', 'norma', 'software', 'ia'].includes(p.type) && p.authorType !== 'sin_autor' && !pAuthP(p).length && String(p.venue ?? '').trim();   // sin autor: el organismo o la empresa ocupa su lugar
const authP = p => OWN(p) ? [{l: noAbbr(p.venue), g: '', org: true}] : pAuthP(p);
const XAU = {   // autores según el estilo (misma lógica que apaFn, vanFn, mlaFn, ieeeFn, chiFn y uneFn)
  apa: (P, o, full) => { const A = P.map(a => a.org ? ea(a.l) : a.g ? `${ea(a.l)}, ${ini(a.g, 1)}${full && hasFull(a.g) ? ` [${ea(a.g)}]` : ''}` : ea(a.l)); return A.length > 20 ? A.slice(0, 19).join(', ') + ', . . . ' + A.at(-1) : apaJoin(A, P, o); },
  van: (P, o, full) => { const nm = a => a.org ? ea(a.l) : full ? `${ea(a.l)}${a.g ? ', ' + ea(a.g) : ''}` : `${ea(a.l)}${a.g ? ' ' + ini(a.g) : ''}`, sp = full ? '; ' : ', ', A = P.map(nm); return !o.vanAll && A.length > 6 ? A.slice(0, 6).join(sp) + sp + 'et al' : A.join(sp); },
  mla: (P, o) => { const en = o.lang === 'en', inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`;
    return P.length === 1 ? inv(P[0]) : P.length === 2 ? `${inv(P[0])}${en ? ' and' : yD(P[1])} ${dir(P[1])}` : P.length > 2 ? inv(P[0]) + ', et al.' : ''; },
  ieee: P => { const nm = a => a.org || !a.g ? ea(a.l) : `${ini(a.g, 1)} ${ea(a.l)}`; return !P.length ? '' : P.length > 6 ? nm(P[0]) + ' et al.' : P.length === 1 ? nm(P[0]) : P.length === 2 ? `${nm(P[0])} and ${nm(P[1])}` : P.slice(0, -1).map(nm).join(', ') + ', and ' + nm(P.at(-1)); },
  chi: (P, o) => { const en = o.lang === 'en', inv = a => a.org || !a.g ? ea(a.l) : `${ea(a.l)}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`, nm = (a, i) => i ? dir(a) : inv(a);
    if (!P.length) return ''; if (P.length > 10) return P.slice(0, 7).map(nm).join(', ') + ', et al.'; if (P.length === 1) return nm(P[0], 0);
    return P.slice(0, -1).map(nm).join(', ') + (en ? ', and' : yD(P.at(-1))) + ' ' + nm(P.at(-1), P.length - 1); },
  une: (P, o) => { const en = o.lang === 'en', UP = x => String(x).toLocaleUpperCase('es'), inv = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(UP(a.l))}, ${ea(a.g)}`, dir = a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`, f = (a, i) => i ? dir(a) : inv(a);
    if (!P.length) return ''; if (P.length > 3) return `${inv(P[0])}, et al.`; if (P.length === 1) return f(P[0], 0);
    return P.slice(0, -1).map(f).join(', ') + (en ? ' and' : yD(P.at(-1))) + ' ' + f(P.at(-1), P.length - 1); }};
const xFn = (p, o, st) => {
  const ty = p.type, en = o.lang === 'en', L = L10[en ? 'en' : 'es'], norm = x => String(x ?? '').trim().toLowerCase();
  const fam = st.replace(/2$/, '').replace(/^chicago_.*/, 'chi').replace(/^une_.*/, 'une'), full = st === 'apa2' || st === 'vancouver2', af = st === 'chicago_af', nf = st === 'une_nf';
  const P = authP(p), ownV = !!OWN(p), sameV = P.length === 1 && P[0].org && norm(noAbbr(p.venue)) === norm(P[0].l), V0 = ea(p.venue || ''), V = ownV || sameV ? '' : V0;
  const T = ea((p.title || '').replace(/\.$/, '')), plc = ea(p.place || ''), ed = ea(p.edition || ''), doc = ea(p.docNumber || ''), ser = ea(p.series || ''), sn = ea(p.seriesNumber || ''), pg = ea(p.pages || ''), iss = ea(p.issue || '');
  const hand = ea(String(p.userHandle || '').replace(/^@/, '')), role = ea(p.authorRole || '');
  const kind = ty === 'audio' ? (/episod/i.test(p.subtype) ? 'ep' : /canci|song/i.test(p.subtype) ? 'song' : 'pod') : ty === 'audiovisual' ? (ser || /episod|cap[ií]tulo|episode/i.test(p.subtype) ? 'ep' : /v[ií]deo/i.test(p.subtype) ? 'vid' : 'film') : '';
  const DK = {ep: ty === 'audio' ? ['Episodio de audio podcast', 'Audio podcast episode'] : ['Capítulo de serie de televisión', 'TV series episode'], vid: ['Video', 'Video']}[kind] || XDEF[ty] || ['', ''];
  const sub = ea(p.subtype || '') || DK[en ? 1 : 0] || '';
  const link = ea(citeLink(p)), yr = p.year ? String(p.year) : '', fd = fdOk(p) ? p.pubDate : '', accOk = link && p.accessed && !p.hideAccessed;
  const join = (a, b, sep) => a && b ? a + sep + b : a || b, serSn = join(ser, sn, ' '), docE = ty === 'norma' && ed && doc ? `${doc} (${ed})` : doc, code = ty === 'informe' ? [serSn, doc].filter(Boolean).join('; ') : docE;   // norma: la edición (completa…) va entre paréntesis tras el código
  const qt = x => en ? `“${endDot(x)}”` : /[?!…]$/.test(x) ? `“${x}”` : `“${x}”.`, patN = `${plc ? plc + ' ' : ''}Patent ${doc}`.trim();
  const noInd = ['ep', 'song'].includes(kind) || ['personal', 'redsocial', 'legislacion', 'diccionario'].includes(ty);   // título sin cursiva

  if (fam === 'apa') {
    const fullD = ['redsocial', 'audio', 'ia'].includes(ty) || kind === 'vid' || kind === 'ep';
    const Y = fullD && fd ? apaDate(fd, o) : yr ? yr + (o.ys || '') : L.sd + (o.ys ? '-' + o.ys : '');
    let au = XAU.apa(P, o, full); if (au && hand) au += ` [@${hand}]`; if (au && role) au += ` (${role})`;
    const hd = au && (hand || role || P.at(-1)?.org) ? endDot(au) : au, head = t => [hd ? `${hd} (${Y}).` : `${endDot(t)} (${Y}).`, hd ? endDot(t) : ''];
    if (ty === 'legislacion') { const dt = fd ? chiLong(fd, o) : yr; return [endDot(T + (doc ? ` (${doc})` : '')), V ? endDot([it(V), dt, iss, pg].filter(Boolean).join(', ')) : '', link].filter(Boolean).join(' ').trim(); }
    if (ty === 'diccionario') {
      const paren = [edLbl(p.edition, o.lang) && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true)].filter(Boolean).join(', '), rd = p.accessed ? (en ? chiLong(p.accessed, o) : apaDate(p.accessed, {...o, ys: ''})) : '';
      const rec = !yr && link && rd ? `${en ? 'Retrieved' : 'Recuperado el'} ${rd}, ${en ? 'from' : 'de'} ${link}` : link;
      return [...head(T), V ? endDot(`${L.in} ${it(V)}${paren ? ` (${paren})` : ''}`) : '', rec].filter(Boolean).join(' ').trim(); }
    let t = noInd ? T : it(T);
    const par = ({informe: code, norma: doc, software: ed, dataset: ed, ia: ed, mapa: ed, patente: doc && patN})[ty] || (kind === 'ep' ? (ty === 'audio' && sn ? `${en ? 'No.' : 'Nº'} ${sn}` : sn) : '');
    if (par) t += ` (${par})`;
    const des = ty === 'dataset' && !p.subtype ? 'Dataset' : ['informe', 'norma', 'basedatos', 'patente'].includes(ty) ? '' : sub; if (des) t += ` [${des}]`;
    const tail = ty === 'audiovisual' && kind === 'ep' ? [ser && `${L.in} ${it(ser)}`, V] : kind === 'ep' ? [it(ser)] : kind === 'song' ? [ser && `${L.in} ${it(ser)}`, V] : ty === 'ia' ? [ser, V] : [V];
    return [...head(t), ...tail.filter(Boolean).map(endDot), link].filter(Boolean).join(' ').trim(); }

  if (fam === 'vancouver') {
    const online = !!link || ty === 'basedatos', yv = fd ? fdate(fd, o) : yr, cons = online && p.accessed && !p.hideAccessed ? `[${L.cons} ${fdate(p.accessed, o)}]` : '', dat = [yv, cons].filter(Boolean).join(' ');
    const bt = ['informe', 'norma', 'basedatos', 'patente', 'legislacion', 'diccionario', 'personal'].includes(ty) ? '' : sub, br = bt ? (online ? `${bt} ${en ? 'on the Internet' : 'en Internet'}` : bt) : online ? 'Internet' : '';
    const ver = ed && ty !== 'norma' ? (['software', 'dataset', 'ia', 'mapa'].includes(ty) ? verLbl(ed, en) : ea(edLbl(p.edition, o.lang))) : '';
    const pubL = ty === 'diccionario' ? join(V ? `${L.in}: ${V}` : '', dat, '. ') : join(join(plc, V, ': '), dat, ty === 'basedatos' ? '. ' : '; ');
    const extra = ty === 'patente' ? (doc && patN) : ['informe', 'norma'].includes(ty) ? code : ty === 'legislacion' ? [doc, iss && `${en ? 'no.' : 'n.º'} ${iss}`, pg && `p. ${pg}`].filter(Boolean).join('; ') : ty === 'diccionario' ? pgs(pg, true) : ['audiovisual', 'audio'].includes(ty) ? [ser, sn].filter(Boolean).join('. ') : '';
    return [endDot(XAU.van(P, o, full)), endDot(T + (br ? ` [${br}]` : '')), ver && endDot(ver), endDot(pubL), extra && endDot(extra), link && `${L.avail}: ${link}`].filter(Boolean).join(' ').trim(); }

  if (fam === 'mla') {
    const dir = a => a.org || !a.g ? ea(a.l) : `${ea(a.g)} ${ea(a.l)}`, cont = a => endDot(a.filter(Boolean).join(', ')), lk = ea(mlaLink(p)), yrS = fd ? mlaLong(fd, o) : yr;
    let au = ownV || sameV ? '' : XAU.mla(P, o), ti, ct;
    const acc = lk && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Consultado el'} ${mlaAcc(p.accessed, o)}.` : '';
    if (ty === 'dataset') return [au && endDot(au), qt(T), endDot(yr), lk ? endDot(lk) : 'Web.'].filter(Boolean).join(' ');   // guía: Autor. “Título.” año. Web.
    if (ty === 'redsocial') { au = hand ? `@${hand}` : au; ti = `“${endDot(T)}”`; ct = cont([V0, yrS, lk]); }   // el punto va dentro de las comillas (guía)
    else if (ty === 'audiovisual' && kind === 'film') { const dn = P.length > 2 ? dir(P[0]) + ' et al.' : P.map(dir).join(en ? ' and ' : ' y '); au = ''; ti = endDot(it(T)); ct = cont([dn && `${en ? 'Directed by' : 'Dirigida por'} ${dn}`, V0, yr, lk]); }
    else if (ty === 'audiovisual' && kind === 'ep') { au = ''; ti = qt(T); ct = cont([ser && it(ser), sn && sn[0].toLowerCase() + sn.slice(1), V0, yrS, lk]); }
    else if (ty === 'audiovisual') { ti = qt(T); ct = cont([V0 ? it(V0) : '', yrS, lk]); }   // vídeo en línea
    else if (ty === 'legislacion') { au = plc; ti = endDot(T); ct = cont([V0 && it(V0), iss && `no. ${iss}`, yr, pg && pgs(pg, true)]); }
    else if (ty === 'ia') { au = ''; if (ser) { ti = qt(T); ct = cont([it(ser), ed, V0, yrS, lk]); } else { ti = ''; ct = cont([it(T), ed, V0, yrS, lk]); } }
    else if (kind === 'ep' || kind === 'song') { ti = qt(T); ct = cont([ser && it(ser), V0, yrS, lk]); }
    else if (ty === 'personal') { ti = qt(T); ct = cont([sub, yrS]); }
    else if (ty === 'diccionario') { ti = qt(T); ct = cont([V0 && it(V0), ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), yr, lk]); }
    else { ti = endDot(it(T)); ct = cont([['mapa', 'software', 'presentacion'].includes(ty) ? sub : '', ty === 'norma' ? '' : ed, code, V0, yrS, lk]); }
    return [au && endDot(au), ti, ct, acc].filter(Boolean).join(' ').trim(); }

  if (fam === 'ieee') {
    const au = XAU.ieee(P), lead = au ? au + ', ' : '', fin = x => /[.?!…][”*]*$/.test(x) ? x : x + '.', quoted = rest => rest ? (/[?!]$/.test(T) ? `“${T}” ` : `“${T},” `) + fin(rest) : `“${fin(T)}”`;
    const dEn = fd ? `${MESF.en[+fd.slice(5, 7) - 1]} ${+fd.slice(8)}, ${fd.slice(0, 4)}` : yr, onl = link ? ` [Online]. Available: ${link}` : '', j2 = a => a.filter(Boolean).join(', ');
    if (ty === 'personal') return `${au ? au + ' ' : ''}(private communication)${yr ? ', ' + yr : ''}.`;   // I. Apellido (private communication), año.
    let body;
    if (ty === 'informe') body = lead + quoted(j2([V, plc, doc ? (/rep|publication|no\./i.test(doc) ? doc : `Tech. Rep. ${doc}`) : serSn, yr]));
    else if (ty === 'patente') body = lead + quoted(j2([patN, dEn]));
    else if (ty === 'dataset') body = lead + `“${fin(T)}” ` + fin(j2([V, yr]));
    else if (ty === 'norma') body = lead + it(T) + ', ' + fin(j2([docE, V, plc, yr]));
    else if (ty === 'legislacion') body = lead + quoted(j2([V, iss && `no. ${iss}`, pg && pgs(pg, true), dEn]));
    else if (['mapa', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || kind === 'film' || kind === 'pod') { const r = j2([sub, ed, V, plc, dEn]); body = lead + it(T) + (r ? ', ' + r : ''); }
    else body = lead + quoted(j2([kind === 'ep' ? ser : '', sub, ty === 'diccionario' ? ea(edLbl(p.edition, 'en')) : ed, V, plc, pg && pgs(pg, true), dEn]));
    return fin(body) + onl; }

  if (fam === 'chi') {
    const abbr = abbrOf(p.venue), au = ty === 'norma' && ownV && abbr && af ? `${ea(abbr)} (${P[0].l})` : XAU.chi(P, o), cj = a => endDot(a.filter(Boolean).join(', '));
    const Y = yr ? yr + (o.ys || '') : 'n.d.' + (o.ys ? '-' + o.ys : ''), yn = af ? '' : yr, dl = fd ? chiLong(fd, o) : yn;
    const acc = !yr && link && p.accessed && !p.hideAccessed ? `${en ? 'Accessed' : 'Acceso el'} ${chiAcc(p.accessed, o)}.` : '';
    let ti, ct = [], A = au;
    if (ty === 'informe') { ti = qt(T); ct.push(cj([serSn, doc, V, plc, fd ? chiLong(fd, o) : yn])); }
    else if (ty === 'norma') { ti = endDot(it(T)); const ap = fd ? (en ? `approved ${chiLong(fd, o)}` : `aprobada el ${chiLong(fd, o)}`) : yn; if (docE) ct.push(endDot(docE)); ct.push(endDot([join(plc, ownV ? ea(abbr) : V, ': '), ap].filter(Boolean).join(', '))); }
    else if (ty === 'patente') { ti = endDot(T); ct.push(endDot([patN, fd && (en ? `granted ${chiLong(fd, o)}` : `concedida el ${chiLong(fd, o)}`)].filter(Boolean).join(', '))); }
    else if (ty === 'mapa') { ti = endDot(it(T) + ` [${(sub || 'mapa').toLowerCase()}]`); if (ed) ct.push(endDot(ed)); if (doc) ct.push(endDot(doc)); if (serSn) ct.push(endDot(ser && sn ? `${ser}; ${sn}` : serSn)); ct.push(endDot([join(plc, V, ': '), dl].filter(Boolean).join(', '))); }
    else if (ty === 'audiovisual' && (kind === 'film' || kind === 'ep')) {
      if (A) A += ', dir.'; if (kind === 'film') { ti = endDot(it(T)); } else { ti = endDot(it(ser || T)); ct.push(endDot([sn, `“${T}”`].filter(Boolean).join(', '))); }
      ct.push(endDot([join(plc, V, ': '), yn].filter(Boolean).join(', '))); if (p.subtype) ct.push(endDot(sub)); }
    else if (ty === 'diccionario') { ti = qt(T); ct.push(cj([`${L.in} ${it(V0)}`, ed && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), dl])); }
    else if (ty === 'legislacion') { ti = endDot(T); ct.push(cj([V0 && it(V0), iss, doc, dl, pg])); }
    else { ti = ['dataset', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || kind === 'pod' || kind === 'vid' ? endDot(it(T)) : qt(T);
      if (sub && !['basedatos', 'personal'].includes(ty)) ct.push(endDot(sub)); if (ed) ct.push(endDot(verLbl(ed, en))); ct.push(cj([join(plc, V, ': '), dl])); }
    const head = af ? (A ? [endDot(A), endDot(Y), ti] : [ti, endDot(Y)]) : [A && endDot(A), ti];
    return [...head, ...ct.filter(Boolean), acc, link && endDot(link)].filter(Boolean).join(' ').trim(); }

  // UNE-ISO 690:2024 (nombre-fecha / numérico)
  const UP = x => String(x).toLocaleUpperCase('es'), du = x => fdate(x, {...o, dateFmt: o.dateFmt === 'iso' ? 'iso' : 'dmy'});
  const Y = yr ? yr + (o.ys || '') : `[${L.sd}]` + (o.ys ? '-' + o.ys : ''), yEnd = !nf ? yr : '', pub = (...r) => endDot(r.filter(Boolean).join(', '));
  const lk = link ? endDot(`${L.avail}: ${link}`) : '', acc = accOk ? `[${en ? 'Viewed' : 'Consulta'}: ${du(p.accessed)}].` : '';
  let au = XAU.une(P, o); if (ty === 'norma' && ownV && abbrOf(p.venue)) au += ` (${ea(abbrOf(p.venue))})`; if (hand) au += ` [${V0 || 'Red'}: @${hand}]`; if (role) au += ` (${role.toLowerCase()})`;
  const head = ti => nf ? (au ? [`${au}, ${Y}.`, ti] : [ti, endDot(Y)]) : [au && endDot(au), ti], ind = ['mapa', 'software', 'basedatos', 'presentacion', 'ia'].includes(ty) || ['film', 'pod', 'vid'].includes(kind);
  if (ty === 'norma') return [endDot(au), endDot(`${doc ? `${doc}${ed ? ` (${ed})` : ''}, ` : ''}${T}`), !doc && yr ? endDot(yr) : '', lk, acc].filter(Boolean).join(' ').trim();
  if (ty === 'informe') { const ss = ser ? ser + (sn ? `, ${en ? 'no.' : 'nº'} ${sn}` : '') : sn ? `${en ? 'no.' : 'nº'} ${sn}` : '';
    return [...head(endDot(it(T))), pub(join(plc, V, ': '), yEnd), ss && endDot(ss), doc && endDot(doc), lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'patente') { const inv = P.map(a => a.org || !a.g ? ea(UP(a.l)) : `${ea(a.g)} ${ea(UP(a.l))}`), il = inv.length > 1 ? inv.slice(0, -1).join(', ') + (en ? ' and ' : yD(P.at(-1)) + ' ') + inv.at(-1) : inv[0] || '';
    const tit = V0 ? ea(UP(V0)) + (plc ? ` (${plc})` : '') : XAU.une(P, o);
    return [endDot(tit), endDot(T), V0 && il && endDot(`${en ? 'Inventors' : 'Inventores'}: ${il}`), doc && endDot(`${plc ? plc + ' ' : ''}${en ? 'patent' : 'patente'} ${doc}`), fd && `Conc.: ${du(fd)}.`, lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'redsocial') return [endDot(au), endDot(T), sub && endDot(sub), (fd || yr) && endDot(fd || yr), link && endDot(`${L.avail}: ${join(V0, link, ', ')}`), acc].filter(Boolean).join(' ').trim();   // fecha ISO (guía)
  if (ty === 'personal') return [endDot(au), (fd ? du(fd) : yr) && endDot(fd ? du(fd) : yr), `[${T}].`, `[${(sub || '').toLowerCase()}].`].filter(Boolean).join(' ').trim();
  if (ty === 'legislacion') { const a2 = plc ? ea(UP(plc)) : au; return [endDot(a2), endDot(T), pub(V0 && it(V0), iss && `${en ? 'no.' : 'nº'} ${iss}`, fd ? du(fd) : yr, pg && pgs(pg, true)), doc && endDot(doc), lk, acc].filter(Boolean).join(' ').trim(); }
  if (ty === 'dataset') return [...head(endDot(T)), sub && endDot(sub), ed && endDot(verLbl(ed, en)), pub(V, plc, yEnd), lk, acc].filter(Boolean).join(' ').trim();
  if (ty === 'diccionario') return [...head(endDot(T)), V0 && pub(`${L.in}: ${it(V0)}`, ed && ea(edLbl(p.edition, o.lang)), pg && pgs(pg, true), yEnd), lk, acc].filter(Boolean).join(' ').trim();
  const dsg = ty === 'software' && !p.subtype ? (en ? 'Software' : 'Programa') : sub;
  return [...head(endDot(ind ? it(T) : T)), dsg && !['basedatos', 'diccionario'].includes(ty) && endDot(dsg), ed && endDot(['software', 'ia', 'mapa'].includes(ty) ? verLbl(ed, en) : ea(edLbl(p.edition, o.lang))), kind === 'ep' && ser && endDot(`${L.in}: ${it(ser)}`), pub(join(plc, V, ': '), yEnd), code && ty !== 'informe' && endDot(code), lk, acc].filter(Boolean).join(' ').trim();
};
const withX = (fn, st) => (p, o = ex()) => p.type === 'jurisprudencia' ? jurRef(p, o) : XTYPES.has(p.type) ? xFn(p, o, st) : fn(p, o);
// estilos donde la guía trae plantilla propia para cada tipo nuevo (en los demás se usa la genérica y se avisa)
const XCOVER = {informe: ['apa', 'apa2', 'chicago_nb', 'ieee', 'une_nf', 'une_num'], norma: ['apa', 'apa2', 'chicago_af', 'chicago_nb', 'une_nf', 'une_num'], patente: ['chicago_af', 'chicago_nb', 'ieee', 'une_nf', 'une_num'], mapa: ['chicago_af', 'chicago_nb', 'une_nf', 'une_num'],
  dataset: ['apa', 'apa2', 'mla', 'ieee', 'une_nf', 'une_num'], software: ['apa', 'apa2', 'une_nf', 'une_num'], basedatos: ['vancouver', 'vancouver2'], audiovisual: ['apa', 'apa2', 'chicago_af', 'chicago_nb', 'mla', 'une_nf', 'une_num'], audio: ['apa', 'apa2'],
  redsocial: ['apa', 'apa2', 'mla', 'une_nf', 'une_num'], ia: ['apa', 'apa2', 'mla'], diccionario: ['apa', 'apa2'], presentacion: ['apa', 'apa2'], personal: ['ieee', 'une_nf', 'une_num'], legislacion: ['apa', 'apa2', 'mla', 'une_nf', 'une_num']};
const XNOTE = {   // avisos concretos adicionales (estilo → tipo)
  apa: {personal: 'APA no incluye las comunicaciones personales en la lista de referencias (solo en el texto): se omiten al exportar.', legislacion: 'APA no cubre la legislación: es la adaptación española de la guía. Verificar.'},
  chicago_af: {informe: 'La forma autor-fecha del informe es una extrapolación de la guía. Verificar.', personal: 'Chicago no incluye las comunicaciones personales en la bibliografía: se omiten al exportar.', ia: 'Chicago no cita la IA en la bibliografía salvo que haya un enlace público: se omite si no lo hay.', patente: 'El ejemplo de patente de la guía está truncado (sin fecha de solicitud). Verificar.', legislacion: 'Chicago 17.ª ed. no cubre la legislación. Verificar.'},
  chicago_nb: {personal: 'Chicago no incluye las comunicaciones personales en la bibliografía: se omiten al exportar.', redsocial: 'Chicago omite las redes sociales de la bibliografía (basta citarlas en el texto o en nota): se omiten al exportar.', ia: 'Chicago no cita la IA en la bibliografía salvo que haya un enlace público: se omite si no lo hay.', patente: 'El ejemplo de patente de la guía está truncado (sin fecha de solicitud). Verificar.', legislacion: 'Chicago 17.ª ed. no cubre la legislación. Verificar.'},
  mla: {legislacion: 'MLA no cubre documentos jurídicos: es una adaptación. Verificar.'}, une_nf: {legislacion: 'UNE solo trae un ejemplo de legislación. Verificar.'}, une_num: {legislacion: 'UNE solo trae un ejemplo de legislación. Verificar.'}};
XNOTE.apa2 = XNOTE.apa;
const xWarn = (st, ty) => { const s = STYLES[st]; if (!s) return ''; return [XCOVER[ty]?.includes(st) ? '' : `${s.name}: la guía no trae plantilla de ${TYPES[ty].toLowerCase()}; se usa una genérica. Verificar.`, XNOTE[st]?.[ty]].filter(Boolean).join(' '); };
/* ---- Derecho y jurisprudencia: un solo estilo que une las guías de la UAM (Facultad de Derecho), la UMA (BUMA), la UC3M y la UCM.
   Legislación y jurisprudencia van en anexos ordenados de la más antigua a la más reciente (nunca en la bibliografía) y se citan en el texto con
   abreviaturas; la doctrina (libros, artículos…) se cita con las plantillas de APA 7, como recomiendan la UAM y la UCM.
   Anexo de legislación (UMA): [Ámbito.] Título [Internet]. Boletín, fecha, núm. N, pp. · Anexo de jurisprudencia: [Ámbito.] Tribunal (Sala). [Caso X (asunto).] Sentencia núm. N, de fecha[, ECLI].
   La plantilla de jurisprudencia vale también en los demás estilos: las guías dicen que se aplica sea cual sea el estilo elegido. ---- */
const LAW_T = new Set(['legislacion', 'jurisprudencia']);
const fechaEs = s => okDate(s) ? `${+s.slice(8)} de ${MES.es[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}` : '';   // 29 de marzo de 2017 (el Derecho se cita en español)
const RANKS = [['Ley Orgánica', 'LO'], ['Real Decreto-ley', 'RDL'], ['Real Decreto Legislativo', 'RDLeg'], ['Real Decreto', 'RD'], ['Decreto-ley', 'DL'], ['Decreto Legislativo', 'DLeg'], ['Decreto', 'D.'], ['Ley', 'Ley'], ['Orden', 'O.'],
  ['Reglamento', 'R'], ['Directiva', 'Dir.'], ['Decisión', 'Dec.'], ['Recomendación', 'Rec.'], ['Dictamen', 'Dict.'], ['Resolución', 'Res.'], ['Circular', 'Circ.'], ['Instrucción', 'Instr.']];   // rango → abreviatura en el texto (de la más larga a la más corta)
const EU_R = new Set(['R', 'Dir.', 'Dec.', 'Rec.', 'Dict.']);   // normas de la UE: la cita corta lleva el año de la fecha (Dir. 2015/2376 del Consejo, de 8 de diciembre de 2015)
const unacc = s => String(s ?? '').normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '');   // mismas posiciones que el texto en NFC
const LAW_ORG = '(?:del?|de la)\\s+(?:Parlamento Europeo y del Consejo|Consejo Europeo|Consejo|Comision|Banco Central Europeo)';
const LAW_RX = new RegExp(`^(${RANKS.map(([n]) => unacc(n).replace(/[-\s]/g, '[-\\s]')).join('|')})(?![a-z])(?:\\s*\\(([^)]{1,20})\\))?(?:\\s+(${LAW_ORG}))?(?:\\s+(?:n\\.?\\s*[º°o]\\.?\\s*)?((?:[A-Z]{2,5}\\/)?\\d+\\/\\d{2,4}(?:\\/[A-Z]+(?:\\s*,\\s*Euratom)?)?))?(?:\\s+(${LAW_ORG}))?,?(?:\\s+de\\s+(\\d{1,2}\\s+de\\s+[a-z]+)(?:\\s+de\\s+(\\d{4}))?)?`, 'id');
function lawParse(p) {   // «Ley 40/2015, de 2 de octubre, de …» → {ab: 'Ley', par, num: '40/2015', org, d: '2 de octubre', y: '2015'}; null si el título no empieza por un rango conocido
  const t = String(p.title ?? '').normalize('NFC').trim(), m = LAW_RX.exec(unacc(t)); if (!m) return null;
  const g = i => m.indices[i] ? t.slice(...m.indices[i]).replace(/\s+/g, ' ') : '';
  const ab = RANKS.find(([n]) => unacc(n).toLowerCase().replace(/[-\s]/g, ' ') === unacc(g(1)).toLowerCase().replace(/[-\s]/g, ' '))[1];
  const x = {ab, par: g(2), org: g(3) || g(5), num: g(4), d: g(6), y: g(7)}; return x.num || x.d ? x : null; }
const numYear = s => (String(s ?? '').match(/\b(1[89]\d\d|20\d\d)\b/) || [])[1] || '';   // año dentro del número (40/2015, 2015/2376, PRA/157/2017)
const lawShort = p => { const x = lawParse(p); if (!x) return '';   // cita corta: RDL 18/2020, de 12 de mayo · Res. de 6 de junio de 2016 · R (UE) 658/2017 del Consejo, de 6 de abril de 2017
  const y = x.y || numYear(x.num) || p.year, full = EU_R.has(x.ab) || !x.num;   // solo el reglamento conserva «(UE)» (UAM, UMA)
  return ea(`${x.ab}${x.par && x.ab === 'R' ? ` (${x.par})` : ''}${x.num ? ' ' + x.num : ''}${x.org ? ' ' + x.org : ''}${x.d ? `${x.num || x.org ? ',' : ''} de ${x.d}${full && y ? ' de ' + y : ''}` : ''}`); };
const RANK_N = Object.fromEntries(RANKS.map(([n, a]) => [a, n]));
const legName = p => { const t = ea(String(p.title ?? '').trim().replace(/\.$/, '')), m = /^(.+?), (?:hecho|firmado|adoptado|celebrado) en .+? el (\d{1,2} de \S+ de \d{4})/i.exec(t); return m ? `${m[1]}, ${m[2]}` : t; };   // tratado: «Tratado de …, 5 de febrero de 2008»
function lawKey(p) {   // fecha para el orden cronológico de los anexos (aaaa-mm-dd; sin fecha, al final)
  if (p.type === 'legislacion') { const x = lawParse(p), m = x && /^(\d{1,2}) de (\S+)$/.exec(x.d), mo = m ? MES.es.indexOf(unacc(m[2]).toLowerCase().replace('setiembre', 'septiembre')) + 1 : 0, y = x && (x.y || numYear(x.num) || p.year);
    if (mo && y) return `${y}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return okDate(p.pubDate) ? p.pubDate : p.year ? `${p.year}-00-00` : '9999'; }
const COURTS = [[/constitucional|^TC$/i, 'TC', 'del Tribunal Constitucional'], [/supremo|^TS$/i, 'TS', 'del Tribunal Supremo'], [/audiencia nacional|^AN$/i, 'AN', 'de la Audiencia Nacional'],
  [/superior de justicia|^TSJ\b/i, 'TSJ', 'del Tribunal Superior de Justicia'], [/audiencia provincial|^AP\b/i, 'AP', 'de la Audiencia Provincial'], [/derechos humanos|^TEDH$/i, 'TEDH', 'del Tribunal Europeo de Derechos Humanos'],
  [/tribunal general|^TGUE$/i, 'TGUE', 'del Tribunal General de la Unión Europea'], [/justicia de la uni[oó]n europea|^TJUE$/i, 'TJUE', 'del Tribunal de Justicia de la Unión Europea'], [/justicia de las comunidades europeas|^TJCE$/i, 'TJCE', 'del Tribunal de Justicia de las Comunidades Europeas']];
const RES_K = {S: 'Sentencia', A: 'Auto', D: 'Declaración', P: 'Providencia'};
const resK = p => { const s = unacc(p.subtype).trim().toLowerCase(); return !s || s.startsWith('sentencia') ? 'S' : s.startsWith('auto') ? 'A' : s.startsWith('declaracion') ? 'D' : s.startsWith('providencia') ? 'P' : ''; };
const court = p => { const v = String(p.venue ?? '').trim(), c = COURTS.find(([rx]) => rx.test(v)); if (!c) return null;
  const reg = ['TSJ', 'AP'].includes(c[1]) ? (/(?:superior de justicia|audiencia provincial|TSJ|AP)\s+(?:de\s+(?:la\s+|las\s+|los\s+)?|del\s+)?(.+)$/i.exec(v) || [])[1] || '' : '';
  return {ab: c[1], of: c[2], reg: reg.replace(/[.,]$/, '')}; };   // STSJ Madrid · ATSJ País Vasco
const jurAbbr = p => { if (String(p.abbr ?? '').trim()) return ea(p.abbr.trim()); const c = court(p), k = resK(p); return c && k ? ea(k + c.ab + (c.reg ? ' ' + c.reg : '')) : ''; };
const jurLoc = (p, loc) => { loc = String(loc ?? '').trim(); if (!loc) return ''; if (!/^\d/.test(loc)) return ', ' + ea(loc); const c = court(p)?.ab;   // número solo → FJ (TC, TS, AN), FD (TSJ, AP), ap. (tribunales europeos)
  return `, ${['TSJ', 'AP'].includes(c) ? 'FD' : ['TEDH', 'TGUE', 'TJUE', 'TJCE'].includes(c) ? 'ap.' : 'FJ'} ${ea(loc)}`; };
const jurIsId = (p, T) => !T || /^[SADP](TC|TS|AN|TSJ|AP|TEDH|TGUE|TJUE|TJCE)\b/.test(T) || (jurAbbr(p) && T.startsWith(jurAbbr(p))) || unacc(T).toLowerCase() === unacc(p.venue).toLowerCase();   // el título es la identificación, no el nombre del caso
const accEs = (p, o, on) => on && p.accessed && !p.hideAccessed ? `[consultado ${fdate(p.accessed, {...o, lang: 'es'})}]` : '';
function legRef(p, o) {   // anexo de legislación (UMA, con los elementos de la UAM)
  const T = ea(String(p.title ?? '').trim().replace(/\.$/, '')), V = ea(p.venue || ''), iss = ea(String(p.issue ?? '').trim()), pg = ea(p.pages || ''), link = ea(citeLink(p));
  const ser = /^[A-Z]{1,2}\s*\d/.test(iss), d = fechaEs(p.pubDate) || (p.year ? String(p.year) : '');   // DOUE: la serie va pegada al diario (Diario Oficial de la Unión Europea L 94)
  const pub = V ? [V + (ser ? ' ' + iss : ''), d, iss && !ser && `núm. ${iss}`, pg && pgs(pg, true)].filter(Boolean).join(', ') : '';
  return [p.place && endDot(ea(p.place.trim())), endDot(T + (link ? ' [Internet]' : '')), pub && endDot(pub), p.docNumber && endDot(ea(p.docNumber.trim())), accEs(p, o, link) && endDot(accEs(p, o, link)), link && `Disponible en: ${link}`].filter(Boolean).join(' ').trim(); }
function jurRef(p, o) {   // anexo de jurisprudencia: [Ámbito.] Tribunal (Sala, Sección). [Caso X (asunto).] Sentencia núm. N, de fecha[, asunto][, ECLI] [Internet]. [Versión electrónica. Base de datos de X] [consultado …]. Disponible en: url
  const V = ea(String(p.venue ?? '').trim()), sala = ea(String(p.series ?? '').trim()), num = ea(String(p.docNumber ?? '').trim()), as = ea(String(p.seriesNumber ?? '').trim()), ecli = ea(String(p.ecli ?? '').trim()), db = ea(String(p.publisher ?? '').trim()), link = ea(citeLink(p));
  const T = ea(String(p.title ?? '').trim().replace(/\.$/, '')), cs = jurIsId(p, T) ? '' : (/^(caso|asunto|case)\b/i.test(T) ? T : 'Caso ' + T) + (as ? ` (${as})` : '');
  const d = fechaEs(p.pubDate) || (p.year && !num.includes(String(p.year)) ? String(p.year) : '');
  const res = [ea(String(p.subtype ?? '').trim() || 'Sentencia'), num && `núm. ${num}`].filter(Boolean).join(' ') + (d ? `${num ? ',' : ''} de ${d}` : '') + (as && !cs ? `, ${as}` : '') + (ecli ? `, ${ecli}` : '');
  const tail = [db && `[Versión electrónica. Base de datos de ${db}]`, accEs(p, o, link || db)].filter(Boolean).join(' ');
  return [p.place && endDot(ea(p.place.trim())), V && endDot(V + (sala ? ` (${sala})` : '')), cs && endDot(cs), endDot(res + (link && !db ? ' [Internet]' : '')), tail && endDot(tail), link && `Disponible en: ${link}`].filter(Boolean).join(' ').trim(); }
function lawInText(p, o, loc) {   // cita en el texto: (art. 22.1 CE) · (RDL 18/2020, de 12 de mayo) · (STS 1229/2017 de 29 de marzo, FJ 3) · (STEDH de 21 de febrero de 2017)
  const l = String(loc ?? '').trim();
  if (p.type === 'jurisprudencia') {
    const num = ea(String(p.docNumber ?? '').trim()), d = fechaEs(p.pubDate), sd = num && d ? d.replace(/ de \d{4}$/, '') : d, lc = jurLoc(p, l);   // con número, la fecha sin el año
    const pre = jurAbbr(p) || [ea(String(p.subtype ?? '').trim() || 'Sentencia'), court(p) ? court(p).of : ea(p.venue ? 'de ' + p.venue : '')].filter(Boolean).join(' ');
    const out = [{k: 'Cita en el texto', t: `(${pre}${num ? ' ' + num : ''}${sd ? ' de ' + sd : !num && p.year ? ' de ' + p.year : ''}${lc})`}];
    if (num && sd) out.push({k: 'Abreviada (sin fecha)', t: `(${pre} ${num}${lc})`}); return out; }
  const ab = ea(String(p.abbr ?? '').trim()), sh = ab || lawShort(p) || legName(p), lc = !l ? '' : /^\d/.test(l) ? `art. ${ea(l)} ` : ea(l) + ' ';
  const out = [{k: 'Cita en el texto', t: `(${lc}${sh})`}]; if (ab) out.push({k: 'Primera mención', t: `${legName(p)} (${ab})`}); return out; }
function lawAbbrs(L) {   // lista de abreviaturas utilizadas: las de la legislación (CE, LOPJ…), los rangos abreviados (RDL, LO…) y los tribunales (STS, ATC…)
  const m = new Map(), add = (k, v) => { if (k && v && k !== v && !m.has(k)) m.set(k, v); };
  for (const p of L) {
    if (p.type === 'legislacion') { const ab = String(p.abbr ?? '').trim(), x = lawParse(p); if (ab) add(ea(ab), legName(p)); else if (x) add(x.ab, RANK_N[x.ab]); }
    else if (p.type === 'jurisprudencia') { const c = court(p), k = resK(p), ab = String(p.abbr ?? '').trim();
      if (ab) add(ea(ab), `${ea(String(p.subtype ?? '').trim() || 'Sentencia')} ${c ? c.of : ea(p.venue ? 'de ' + p.venue : '')}`.trim()); else if (c && k) add(k + c.ab, `${RES_K[k]} ${c.of}`); } }
  return [...m].sort((a, b) => a[0].localeCompare(b[0], 'es')); }
function lawSecs(L, o) {   // bloques de la exportación: lista de abreviaturas, bibliografía (doctrina) y anexos de legislación y de jurisprudencia (cronológicos)
  const ty = p => baseT(p.type), key = p => lawKey(effP(p)), chrono = A => [...A].sort((a, b) => key(a).localeCompare(key(b)) || String(a.title).localeCompare(String(b.title), 'es'));
  const doc = L.filter(p => !LAW_T.has(ty(p))), leg = chrono(L.filter(p => ty(p) === 'legislacion')), jur = chrono(L.filter(p => ty(p) === 'jurisprudencia')), ab = o.abbrList === false ? [] : lawAbbrs([...leg, ...jur].map(effP));
  return [ab.length && {h: 'Lista de abreviaturas', lines: ab.map(([k, v]) => `${k}: ${v}`)}, doc.length && {h: o.title || 'Bibliografía', L: doc}, leg.length && {h: 'Anexo de legislación', L: leg}, jur.length && {h: 'Anexo de jurisprudencia', L: jur}].filter(Boolean); }
const apaX = (p, o) => XTYPES.has(p.type) ? xFn(p, o, 'apa') : apaFn(p, o, false);   // doctrina del estilo de Derecho: APA 7 (variante 1)
const STYLES = {   // order: 'alpha' = bibliografía alfabética; 'list' = en el orden de la lista · dis: true = estilo autor-año que distingue 2020a/2020b · numFmt: numeración propia ('br' = [1]; por defecto 'dot' = 1.)
  apa: {name: 'APA 7 · Variante 1', order: 'alpha', dis: true, omit: p => p.type === 'personal', fn: withX((p, o) => apaFn(p, o, false), 'apa')},
  apa2: {name: 'APA 7 · Variante 2 (nombre completo)', order: 'alpha', dis: true, omit: p => p.type === 'personal', fn: withX((p, o) => apaFn(p, o, true), 'apa2')},
  vancouver: {name: 'Vancouver · Variante 1 (iniciales)', order: 'list', fn: withX((p, o) => vanFn(p, o, false), 'vancouver')},
  vancouver2: {name: 'Vancouver · Variante 2 (nombre completo)', order: 'list', fn: withX((p, o) => vanFn(p, o, true), 'vancouver2')},
  mla: {name: 'MLA', order: 'alpha', fn: withX((p, o) => mlaFn(p, o), 'mla'), note: 'MLA 8.ª/9.ª. Sin autor, o con entidad igual a la editorial, empieza por el título. En español el punto va fuera de las comillas; en inglés, dentro. Meses abreviados en fechas completas (solo web): verificar.'},
  ieee: {name: 'IEEE', order: 'list', numbered: true, numFmt: 'br', fixedLang: 'en', fn: withX((p, o) => ieeeFn(p, o), 'ieee'), note: 'IEEE: siempre en inglés y numerado [1]. El número sigue el orden de la lista (la cita [n] en el texto no existe hasta la fase F4). Sin fecha de consulta. Verificar: más de 6 autores (primero + et al.), tesis de grado, nombre del sitio en páginas web y mes completo.'},
  chicago_af: {name: 'Chicago · Autor-fecha', order: 'alpha', dis: true, omit: p => p.type === 'personal' || (p.type === 'ia' && !citeLink(p)), fn: withX((p, o) => chiFn(p, o, true), 'chicago_af'), note: 'Chicago 17.ª ed., lista de referencias autor-fecha (la cita «(Autor año, pág)» en el texto llega en la fase F4). Más de 10 autores: 7 + et al. Sin año: n.d. y fecha de acceso. El mes del artículo sale solo si rellenas «Fecha de publicación» (se usa solo el mes). En español el punto va fuera de las comillas; en inglés, dentro. Verificar: congreso inédito, tesis y nombre del sitio web (la guía tiene puntuación inconsistente).'},
  chicago_nb: {name: 'Chicago · Notas y bibliografía', order: 'alpha', omit: p => p.type === 'personal' || p.type === 'redsocial' || (p.type === 'ia' && !citeLink(p)), fn: withX((p, o) => chiFn(p, o, false), 'chicago_nb'), note: 'Chicago 17.ª ed., solo la bibliografía del sistema notas y bibliografía: año tras la editorial (Lugar: Editorial, Año). Las notas a pie (completas y abreviadas, ibid.) llegan en la fase F4; Chicago prefiere notas abreviadas. Más de 10 autores: 7 + et al. Sin año no se escribe n.d. y se añade la fecha de acceso. El mes del artículo sale solo si rellenas «Fecha de publicación» (las estaciones, p. ej. Spring 2017, no existen en la app). En español el punto va fuera de las comillas; en inglés, dentro. El congreso inédito lleva solo el año (la app no guarda las fechas del congreso). Verificar: congreso inédito, tesis y nombre del sitio web (la guía tiene puntuación inconsistente).'},
  une_nf: {name: 'UNE-ISO 690 · Nombre-fecha', order: 'alpha', dis: true, fn: withX((p, o) => uneFn(p, o, true), 'une_nf'), note: 'UNE-ISO 690:2024, lista de referencias nombre-fecha: APELLIDO, Nombre, año. Título… Los apellidos van en mayúsculas y las entidades enteras en mayúsculas; el 2.º y siguientes autores en orden directo (PARKER, T. J. y W. A. HASWELL). Más de 3 autores: primero + et al. Sin año: [s.f.]. Fecha de consulta en dd-mm-aaaa (ISO aaaa-mm-dd si lo eliges; la fecha larga no se usa). TODO este estilo es «verificar»: el orden de los elementos está deducido de los ejemplos de la guía, porque las tablas oficiales de metadatos no se incluyeron. No hay ISBN/ISSN (fase F3) ni cita en el texto (fase F4). Capítulos y comunicaciones: páginas tras el año.'},
  une_num: {name: 'UNE-ISO 690 · Numérico', order: 'list', numbered: true, numFmt: 'br', fn: withX((p, o) => uneFn(p, o, false), 'une_num'), note: 'UNE-ISO 690:2024, lista numérica: el año va al final (tras la editorial) y la lista se numera siempre; el formato [1] / 1. / (1) se elige abajo. La app no conoce las citas del texto (fase F4): el número sigue el orden de la lista que fijes a mano, no el de primera cita. Más de 3 autores: primero + et al. Fecha de consulta en dd-mm-aaaa (ISO si lo eliges). TODO este estilo es «verificar»: el orden de los elementos está deducido de los ejemplos de la guía (las tablas oficiales no se incluyeron). No hay ISBN/ISSN (fase F3).'},
  derecho: {name: 'Derecho y jurisprudencia', group: 'law', order: 'alpha', dis: true, omit: p => p.type === 'personal', sections: lawSecs, fn: (p, o = ex()) => p.type === 'legislacion' ? legRef(p, o) : p.type === 'jurisprudencia' ? jurRef(p, o) : apaX(p, o),
    note: 'Derecho y jurisprudencia (guías de la UAM, la UMA, la UC3M y la UCM): la legislación y la jurisprudencia no van en la bibliografía, sino en un Anexo de legislación y otro de jurisprudencia, de la más antigua a la más reciente; al principio, la lista de abreviaturas utilizadas. La doctrina (libros, artículos, capítulos, webs…) se cita en APA 7. En la cita en el texto se usa la abreviatura (CE, LOPJ) o el rango, número y fecha (RDL 18/2020, de 12 de mayo), y en la jurisprudencia el tribunal abreviado (STS, ATC, STSJ Madrid, STEDH) con el número y la fecha. La legislación y la jurisprudencia se escriben siempre en español.'}
};
/* ---- F4: cita en el texto y notas (opcional; oculta salvo que se active settings.export.inText). Reglas: guía 4.4 (APA), 5.3 (Chicago), 6.4 (MLA), 7.6 (IEEE), 8.4 (Vancouver), 9.4 (UNE). IEEE y Vancouver: convención NO incluida en la guía → «verificar». ---- */
const IND_T = new Set(['libro', 'tesis', 'congreso', 'web', 'informe', 'norma', 'dataset', 'software', 'mapa', 'basedatos', 'audiovisual', 'audio', 'presentacion', 'ia']);   // título en cursiva (obra independiente); el resto, entre comillas
const shortT = (t, n = 4) => { const w = String(t ?? '').split(/[:.?!–—]/)[0].trim().split(/\s+/).filter(Boolean); return w.slice(0, n).join(' '); };   // título acortado: primeras palabras antes de «:»
const locLbl = (loc, bare) => {   // página o parte citada: «87» → «p. 87», «87-90» → «pp. 87-90»; bare = sin etiqueta (MLA, Chicago)
  loc = String(loc ?? '').trim(); if (!loc) return ''; const num = loc.replace(/^(pp?\.|págs?\.|pages?)\s*/i, '');
  if (bare) return num; if (/^(párr|cap|sec|fig|tabla|vol|art|ch)/i.test(loc)) return loc; return (/^[A-Za-z]?\d+$/.test(num) ? 'p. ' : 'pp. ') + num; };
const inTextFn = (p, o, st, loc) => {   // devuelve [{k: etiqueta, t: texto con *cursiva*}]; loc = página o parte citada (opcional)
  if (p.type === 'jurisprudencia' || (st === 'derecho' && p.type === 'legislacion')) return lawInText(p, o, loc);   // Derecho: abreviaturas; la doctrina, como APA
  if (st === 'derecho') st = 'apa';
  const en = o.lang === 'en', L = L10[en ? 'en' : 'es'], P = authP(p), n = P.length, yr = p.year ? String(p.year) : '', Y = (yr || L.sd) + (o.ys || ''), tl = String(loc ?? '').trim();
  const nm = a => ea(noAbbr(a.l)), ab = a => a.org ? abbrOf(a.l) || (n === 1 && OWN(p) ? abbrOf(p.venue) : '') : '';
  const title = ea(shortT(p.title, /^(apa|mla)/.test(st) ? 5 : 4)), tt = IND_T.has(p.type) ? it(title) : `“${title}”`;   // APA: primeras palabras (la guía muestra 5)
  const and2 = (a, b, amp) => `${a}${en ? (amp ? ' &' : ' and') : yE(b)} ${b}`;   // «A y B» / «A e Isabel» / «A & B»
  const fam = st.replace(/2$/, '').replace(/^chicago_af$/, 'chiaf').replace(/^chicago_nb$/, 'chinb').replace(/^une_nf$/, 'unenf').replace(/^une_num$/, 'unenum');
  if (fam === 'apa') {
    const lc = locLbl(tl), ph = lc ? `, ${lc}` : '';
    if (p.type === 'personal') { const a = P[0], who = a ? (a.g ? `${ini(a.g, 1)} ${nm(a)}` : nm(a)) : '', d = okDate(p.pubDate) ? chiLong(p.pubDate, o) : yr, pc = en ? 'personal communication' : 'comunicación personal';
      return [{k: 'Entre paréntesis', t: `(${who}, ${pc}, ${d})`}, {k: 'Narrativa', t: `${who} (${pc[0].toUpperCase() + pc.slice(1)}, ${d})`}]; }
    const names = amp => !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1]), amp) : `${nm(P[0])} et al.`;
    if (!n) return [{k: 'Entre paréntesis', t: `(${tt}, ${Y}${ph})`}, {k: 'Narrativa', t: `${tt} (${Y}${ph})`}];
    if (n === 1 && ab(P[0])) return [{k: 'Primera cita', t: `(${nm(P[0])} [${ab(P[0])}], ${Y}${ph})`}, {k: 'Siguientes', t: `(${ab(P[0])}, ${Y}${ph})`}, {k: 'Narrativa (primera / siguientes)', t: `${nm(P[0])} [${ab(P[0])}] (${Y}${ph}) / ${ab(P[0])} (${Y}${ph})`}];
    return [{k: 'Entre paréntesis', t: `(${names(true)}, ${Y}${ph})`}, {k: 'Narrativa', t: `${names(false)} (${Y}${ph})`}]; }
  if (fam === 'chiaf') {
    const lc = tl ? `, ${locLbl(tl, true)}` : '', names = !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1])) : n === 3 ? `${nm(P[0])}, ${and2(nm(P[1]), nm(P[2]))}` : `${nm(P[0])} ${en ? 'et al.' : 'y otros'}`;
    if (p.type === 'ia' && !pAuthP(p).length) { const d = okDate(p.pubDate) ? chiLong(p.pubDate, o) : yr; return [{k: 'Entre paréntesis', t: `(${ea(p.series || p.title)}, ${d})`}]; }   // guía: (ChatGPT, 7 de marzo de 2023)
    return [{k: 'Entre paréntesis', t: `(${n ? names : tt} ${Y}${lc})`}, {k: 'Narrativa', t: `${n ? names : tt} (${Y}${lc})`}]; }
  if (fam === 'chinb') return [{k: 'Nota completa (primera vez)', t: chiNote(p, o, tl)}, {k: 'Nota abreviada (siguientes; la 17.ª ed. la prefiere a ibid.)', t: chiNote(p, o, tl, true)}, {k: 'Ibid. (mismo recurso, nota consecutiva)', t: tl ? `Ibid., ${locLbl(tl, true)}.` : 'Ibid.'}];
  if (fam === 'mla') {   // sin coma entre autor y página
    const lc = tl ? ' ' + locLbl(tl, true) : '', names = !n ? '' : n === 1 ? (ab(P[0]) || nm(P[0])) : n === 2 ? and2(nm(P[0]), nm(P[1])) : `${nm(P[0])} et al.`;
    const out = [{k: 'Autor + página', t: `(${n ? names : tt}${lc})`}]; if (tl) out.push({k: 'Autor mencionado en el texto', t: `(${locLbl(tl, true)})`}); return out; }
  if (fam === 'ieee') return [{k: 'Número de la lista (convención, verificar)', t: tl ? `[n, ${locLbl(tl)}]` : '[n]'}, {k: 'Varios / rango', t: '[1], [3] · [2]–[5]'}];
  if (fam === 'vancouver') { const lc = tl ? ' ' + locLbl(tl) : ''; return [{k: 'Entre paréntesis (convención, verificar)', t: `(n${lc})`}, {k: 'Entre corchetes', t: `[n${lc}]`}, {k: 'Superíndice', t: 'ⁿ'}]; }
  if (fam === 'unenum') { const lc = tl ? ' ' + locLbl(tl) : ''; return [{k: 'Numérico (por orden de primera cita)', t: `(n${lc})`}, {k: 'Entre corchetes', t: `[n${lc}]`}, {k: 'Superíndice', t: 'ⁿ'}]; }
  const lc = tl ? `, ${locLbl(tl)}` : '', names = !n ? '' : n === 1 ? nm(P[0]) : n === 2 ? and2(nm(P[0]), nm(P[1])) : `${nm(P[0])} et al.`;   // UNE nombre-fecha: (Crane 1988) · Stieg (1981b, p. 556)
  return [{k: 'Entre paréntesis', t: `(${n ? names : tt} ${Y}${lc})`}, {k: 'Creador en el texto', t: `${n ? names : tt} (${Y}${lc})`}];
};
const chiNote = (p, o, loc, short) => {   // notas de Chicago (notas y bibliografía): completa o abreviada
  const en = o.lang === 'en', L = L10[en ? 'en' : 'es'], P = authP(p), n = P.length, ty = p.type, join = (a, b, sep) => a && b ? a + sep + b : a || b, ind = IND_T.has(ty);
  const dir = a => a.org || !a.g ? ea(noAbbr(a.l)) : `${ea(a.g)} ${ea(a.l)}`, sr = a => ea(noAbbr(a.l)), f = short ? sr : dir;
  const au = !n ? '' : n === 1 ? f(P[0]) : n === 2 ? `${f(P[0])}${en ? ' and' : yD(P[1])} ${f(P[1])}` : n === 3 ? `${f(P[0])}, ${f(P[1])}${en ? ', and' : yD(P[2])} ${f(P[2])}` : `${f(P[0])} et al.`;   // 4 o más: primero + et al.
  const lc = locLbl(loc, true);
  if (short) { const st = ea(shortT(p.title));   // Apellido, *título breve*, páginas. · Apellido, “Título breve,” páginas.
    if (ind) return endDot([au, it(st), lc].filter(Boolean).join(', '));
    return lc ? `${au ? au + ', ' : ''}“${st},” ${lc}.` : `${au ? au + ', ' : ''}“${st}.”`; }
  const T = ea((p.title || '').replace(/\.$/, '')), V = ea(p.venue || ''), plc = ea(p.place || ''), pb = ea(p.publisher || ''), yr = p.year ? String(p.year) : '', ed = ea(edLbl(p.edition, o.lang));
  const link = ea(citeLink(p)), dt = fdOk(p) ? chiLong(p.pubDate, o) : yr, lead = au ? au + ', ' : '';
  let r;
  if (ty === 'ia' && !pAuthP(p).length) r = `${en ? 'Text generated by' : 'Texto generado por'} ${ea(p.series || p.title)}, ${V}, ${dt}${link ? ', ' + link : ''}`;   // guía: Texto generado por ChatGPT, OpenAI, 7 de marzo de 2023, url.
  else if (ty === 'libro') r = `${lead}${it(T)}${ed ? ', ' + ed : ''} (${[join(plc, V, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}`;
  else if (ty === 'articulo') r = `${lead}“${T},” ${it(V)}${p.volume ? ' ' + ea(p.volume) : ''}${p.issue ? `, ${en ? 'no.' : 'n.º'} ${ea(p.issue)}` : ''} (${yr})${lc ? ': ' + lc : p.pages ? ': ' + ea(p.pages) : ''}${link ? ', ' + link : ''}`;
  else if (ty === 'capitulo' || (ty === 'congreso' && (p.publisher || p.pages))) { const E = pAuth(p.editors || []).map(dir), eds = E.length > 2 ? E[0] + ' et al.' : E.length === 2 ? `${E[0]}${en ? ' and' : yD(pAuth(p.editors)[1])} ${E[1]}` : E[0] || '';
    r = `${lead}“${T},” ${en ? 'in' : 'en'} ${it(V)}${eds ? `, ed. ${eds}` : ''} (${[join(plc, pb, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : p.pages ? ', ' + ea(p.pages) : ''}`; }
  else if (ty === 'tesis') r = `${lead}“${T}” (${[ea(p.thesisType || L.thesis), V, yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}`;
  else if (['prensa', 'blog', 'web', 'redsocial'].includes(ty)) r = `${lead}“${T},” ${V ? (ty === 'web' ? V : it(V)) + ', ' : ''}${dt}${link ? ', ' + link : ''}`;
  else r = `${lead}${ind ? it(T) : `“${T},”`} (${[ea(p.series || ''), ea(p.docNumber || ''), join(plc, OWN(p) ? '' : V, ': '), yr].filter(Boolean).join(', ')})${lc ? ', ' + lc : ''}${link ? ', ' + link : ''}`;
  return endDot(r.replace(/ \(\)/g, '').replace(/ ,/g, ','));
};
for (const k of Object.keys(STYLES)) STYLES[k].inText = (p, o = ex(), loc = '') => inTextFn(p, o, k, loc);
// avisos por estilo y tipo (F3b): la guía no trae plantilla propia → se usa una adaptada y se marca «verificar»
const TYPE_WARN = {
  prensa: {vancouver: 'Vancouver no tiene plantilla de prensa en la guía: se usa la de artículo con la fecha completa. Verificar.', vancouver2: 'Vancouver no tiene plantilla de prensa en la guía: se usa la de artículo con la fecha completa. Verificar.',
    mla: 'MLA: la guía no trae plantilla de prensa; se adapta la de artículo de revista (fecha completa y página). Verificar.', ieee: 'IEEE: la guía no trae plantilla de prensa; se adapta la de artículo (fecha completa y luego la página). Verificar.',
    une_nf: 'UNE-ISO 690: la guía no cubre la prensa impresa; en línea sigue el ejemplo de periódico (la fecha sustituye a volumen y número). Verificar.', une_num: 'UNE-ISO 690: la guía no cubre la prensa impresa; en línea sigue el ejemplo de periódico (la fecha sustituye a volumen y número). Verificar.'},
  blog: {vancouver: 'Vancouver: solo se cita la contribución (autor, título, fecha) y «En: blog [Internet]»; lugar y editorial del blog no se guardan. Verificar.', vancouver2: 'Vancouver: solo se cita la contribución (autor, título, fecha) y «En: blog [Internet]»; lugar y editorial del blog no se guardan. Verificar.',
    ieee: 'IEEE: la guía no trae plantilla de blog; se usa la de Internet. Verificar.', une_nf: 'UNE-ISO 690: la guía no trae plantilla de blog; se usa la de sitio web con «Entrada de blog.» tras el título. Verificar.', une_num: 'UNE-ISO 690: la guía no trae plantilla de blog; se usa la de sitio web con «Entrada de blog.» tras el título. Verificar.'}};
const typeWarn = (style, type) => { const t = baseT(type); if (STYLES[style]?.custom) return '';
  if (style === 'derecho') return LAW_T.has(t) ? '' : typeWarn('apa', type);   // la doctrina se cita en APA: sus mismos avisos
  if (t === 'jurisprudencia') return `${STYLES[style]?.name}: ningún estilo general trae plantilla de jurisprudencia; se usa la del estilo Derecho y jurisprudencia (las guías la recomiendan sea cual sea el estilo).`;
  return TYPE_WARN[t]?.[style] || (XTYPES.has(t) ? xWarn(style, t) : ''); };
// estilo con numeración propia (IEEE, UNE numérico…): numbered: true · idioma fijo: fixedLang: 'en' · aviso en Exportar: note
const BASADO = 'Basado en: Chicago 17.ª ed., MLA 8.ª/9.ª, APA 7.ª, UNE-ISO 690:2024, IEEE (guía fuente), Vancouver (variante con nombre completo); Derecho y jurisprudencia: guías de la UAM, la UMA, la UC3M y la UCM.';
/* ===== Tipos de documento propios (Configuración → settings.customTypes del JSON) =====
   Un tipo propio (clave ct_<id>) decide qué campos enseña el formulario y cómo se llaman; los estilos de serie lo tratan como
   el tipo predefinido en «Se cita como» y los estilos propios pueden tener plantilla específica para él. */
const CT_NAMES = {volume: 'Volumen', issue: 'Número', pages: 'Páginas', publisher: 'Editorial (del libro o actas)', place: 'Lugar de edición', edition: 'Edición', editors: 'Editores del libro', pubDate: 'Fecha de publicación completa', thesisType: 'Tipo de trabajo',
  isbn: 'ISBN', issn: 'ISSN', institution: 'Institución', series: 'Serie o colección', seriesNumber: 'Número en la serie', docNumber: 'Número de documento', conferenceName: 'Nombre del congreso', conferencePlace: 'Lugar del congreso', conferenceDates: 'Fechas del congreso',
  subtype: 'Designación', authorRole: 'Función del autor', userHandle: 'Usuario (@)', abbr: 'Abreviatura', ecli: 'ECLI'};
const CTYPES = new Map();   // clave ct_<id> → {id, name, like, fields, labels}
const baseT = t => CTYPES.get(t)?.like || t;
const effP = p => CTYPES.has(p.type) ? {...p, type: CTYPES.get(p.type).like} : p;   // los estilos de serie ven el tipo predefinido equivalente
const ctFieldsOf = like => Object.keys(CT_NAMES).filter(k => FLD_T[k].includes(like));
function ctClean(c) {
  if (!c || typeof c !== 'object') return null; const like = Object.hasOwn(TYPES, c.like) && !c.like.startsWith('ct_') ? c.like : 'articulo';
  const d = {id: String(c.id || uid()).replace(/[^\w-]/g, '') || uid(), name: String(c.name || 'Tipo propio').slice(0, 60), like, fields: Array.isArray(c.fields) ? [...new Set(c.fields.filter(k => Object.hasOwn(CT_NAMES, k)))] : ctFieldsOf(like), labels: {}};
  if (c.labels && typeof c.labels === 'object') for (const [k, v] of Object.entries(c.labels)) if ((k === 'venue' || Object.hasOwn(CT_NAMES, k)) && typeof v === 'string' && v.trim()) d.labels[k] = v.slice(0, 120);
  return d;
}
function syncTypes(list) {
  for (const k of [...CTYPES.keys()]) delete TYPES[k]; CTYPES.clear();
  for (const t of list || []) { CTYPES.set('ct_' + t.id, t); TYPES['ct_' + t.id] = t.name; }
}
for (const k of Object.keys(STYLES)) { const s = STYLES[k], f = s.fn, it = s.inText, om = s.omit;   // estilos de serie: aceptan tipos propios
  s.fn = (p, o) => f(effP(p), o); s.inText = (p, o, loc) => it(effP(p), o, loc); if (om) s.omit = p => om(effP(p)); }
/* ===== Estilos de cita personalizados (Configuración → se guardan en settings.customStyles del JSON) =====
   Plantilla por tipo de documento: texto con {campos}, [grupos opcionales] (solo salen si todos sus campos tienen valor) y modificadores
   {campo:i:q|alternativa}. Un estilo propio se comporta como los de serie: sale en Exportar y en la pestaña Cita. */
const CU_F = [['authors', 'Autores'], ['author1', 'Primer autor'], ['authorsShort', 'Apellidos (cita en el texto)'], ['editors', 'Editores'], ['title', 'Título'], ['year', 'Año (con a/b si hace falta)'],
  ['date', 'Fecha completa de publicación'], ['datey', 'Fecha completa o, si no hay, el año'], ['venue', 'Revista / editorial / sitio'], ['publisher', 'Editorial del libro o actas'], ['place', 'Lugar de edición'], ['edition', 'Edición'], ['volume', 'Volumen'], ['issue', 'Número'],
  ['pages', 'Páginas'], ['loc', 'Página citada (solo cita en el texto)'], ['doi', 'DOI (sin https://doi.org/)'], ['doiurl', 'DOI como enlace'], ['url', 'URL'], ['link', 'Enlace (DOI o URL según el paper)'], ['accessed', 'Fecha de consulta'],
  ['isbn', 'ISBN'], ['issn', 'ISSN'], ['institution', 'Institución'], ['docNumber', 'Número de documento'], ['series', 'Serie o colección'], ['seriesNumber', 'Número en la serie'], ['conferenceName', 'Nombre del congreso'],
  ['conferencePlace', 'Lugar del congreso'], ['conferenceDates', 'Fechas del congreso'], ['subtype', 'Designación'], ['authorRole', 'Función del autor'], ['userHandle', 'Usuario (@)'], ['abbr', 'Abreviatura (Derecho)'], ['ecli', 'ECLI'], ['thesisType', 'Tipo de trabajo'], ['type', 'Tipo de documento']];
const CU_M = {i: 'Cursiva', b: 'Negrita', q: '«Comillas»', qq: '“Comillas inglesas”', par: '(Paréntesis)', br: '[Corchetes]', up: 'MAYÚSCULAS', low: 'minúsculas', cap: 'Primera en mayúscula', nodot: 'Quitar punto final', dot: 'Añadir punto final', title: 'Título (Cada Palabra)', sent: 'Solo la primera en mayúscula', pp: 'Páginas con p./pp.', dash: 'Rango con raya (–)', first: 'Solo la primera página', raw: 'Texto tal cual (edición)'};
const CU_AU = {ap_ini: 'Apellido, N. N.', ap_ini_sp: 'Apellido NN (Vancouver)', ap_nom: 'Apellido, Nombre', nom_ap: 'Nombre Apellido', ini_ap: 'N. N. Apellido', ap: 'Solo el apellido'};
const CU_LAST = {auto: 'Según idioma (y / &)', ' y ': ' y ', ' & ': ' & ', ' and ': ' and ', ', & ': ', & ', ', ': ', (solo coma)', ' / ': ' / ', '; ': '; '};
const CU_DATE = {long: '24 de octubre de 2017', export: 'Como en Exportar', iso: '2017-10-24', dmy: '24-10-2017', my: 'octubre 2017'};
const cuNew = (name = 'Mi estilo') => ({id: uid(), name, order: 'alpha', numbered: false, numFmt: 'br', dis: true, dateFmt: 'long', lang: 'export',
  au: {fmt: 'ap_ini', sep: ', ', last: 'auto', max: 0, show: 1, etAl: 'et al.', upper: false, firstOnly: false},
  tpl: {'*': '[{authors}. ]({year|s.f.}). {title}. [{venue:i}][, {volume}][({issue})][, {pages:pp}]. [{link}]'}, inText: '({authorsShort}, {year|s.f.}[, {loc:pp}])'});
function cuClean(c) {   // lo que viene de un JSON no se fía: forma y límites
  if (!c || typeof c !== 'object') return null;
  const d = cuNew(String(c.name || 'Estilo').slice(0, 60)); d.id = String(c.id || uid()).replace(/[^\w-]/g, '') || uid();
  d.order = c.order === 'list' ? 'list' : 'alpha'; d.numbered = !!c.numbered; d.numFmt = ['dot', 'br', 'par'].includes(c.numFmt) ? c.numFmt : 'br'; d.dis = c.dis !== false; d.lang = ['es', 'en'].includes(c.lang) ? c.lang : 'export'; d.dateFmt = Object.hasOwn(CU_DATE, c.dateFmt) ? c.dateFmt : 'long';
  const a = c.au && typeof c.au === 'object' ? c.au : {};
  d.au = {fmt: Object.hasOwn(CU_AU, a.fmt) ? a.fmt : 'ap_ini', sep: typeof a.sep === 'string' ? a.sep.slice(0, 10) : ', ', last: typeof a.last === 'string' ? a.last.slice(0, 12) : 'auto', max: Math.max(0, Math.min(99, +a.max || 0)),
    show: Math.max(1, Math.min(99, +a.show || 1)), etAl: typeof a.etAl === 'string' ? a.etAl.slice(0, 20) : 'et al.', upper: !!a.upper, firstOnly: !!a.firstOnly};
  for (const k of ['each', 'first']) if (typeof a[k] === 'string' && a[k]) d.au[k] = a[k].slice(0, 80);
  d.tpl = {}; if (c.tpl && typeof c.tpl === 'object') for (const [k, v] of Object.entries(c.tpl)) if ((k === '*' || Object.hasOwn(TYPES, k)) && typeof v === 'string') d.tpl[k] = v.slice(0, 2000);
  d.inText = typeof c.inText === 'string' ? c.inText.slice(0, 500) : ''; return d;
}
function cuParse(s, i = 0, close = false) {   // → [nodos, posición]; \ escapa el carácter siguiente
  const out = []; let txt = ''; const flush = () => { if (txt) { out.push({t: 'x', v: txt}); txt = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { txt += s[i + 1]; i += 2; continue; }
    if (c === '{') { const j = s.indexOf('}', i); if (j > 0) { flush(); const body = s.slice(i + 1, j), bar = body.indexOf('|'), spec = (bar < 0 ? body : body.slice(0, bar)).split(':').map(x => x.includes('=') ? x.replace(/^\s+/, '') : x.trim());   // los valores de opción conservan sus espacios finales
      out.push({t: 'f', k: spec[0], m: spec.slice(1), fb: bar < 0 ? '' : body.slice(bar + 1)}); i = j + 1; continue; } }
    if (c === '[') { flush(); const r = cuParse(s, i + 1, true); out.push({t: 'g', n: r[0]}); i = r[1]; continue; }
    if (c === ']' && close) { flush(); return [out, i + 1]; }
    txt += c; i++;
  }
  flush(); return [out, i];
}
function cuRender(nodes, get) {
  let s = ''; for (const n of nodes) {
    if (n.t === 'x') s += n.v; else if (n.t === 'f') s += get(n);
    else { const r = cuRender(n.n, get), f = nodesFields(n.n); if (!f.some(x => !get(x))) s += r; }   // el grupo sale solo si todos sus campos directos tienen valor
  } return s;
}
const nodesFields = ns => ns.filter(n => n.t === 'f');
const cuMod = (v, m) => ({i: v => '*' + v + '*', b: v => '**' + v + '**', q: v => '«' + v + '»', qq: v => '“' + v + '”', par: v => '(' + v + ')', br: v => '[' + v + ']', up: v => v.toUpperCase(), low: v => v.toLowerCase(),
  cap: v => v.charAt(0).toUpperCase() + v.slice(1), sent: v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(), title: v => v.toLowerCase().replace(/(^|[\s(«“"-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()), first: v => v.split(/\s*[-–—,]\s*/)[0], nodot: v => v.replace(/\.(\*{0,2})$/, '$1'), dot: endDot, dash: v => v.replace(/\s*[-–—]+\s*/g, '–')}[m]?.(v) ?? v);
const cuTidy = s => s.replace(/\s+/g, ' ').replace(/ +([,.;:)\]»”])/g, '$1').replace(/([(\[«“]) +/g, '$1').replace(/([.,;:])(\s*\1)+/g, '$1').trim();
const MESA = {es: ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'], en: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']};
function cuDate(s, fmt, o, pat) {   // pat: patrón propio con YYYY YY MMMM MMM MM M DD D (en mayúsculas); manda sobre fmt
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m || !okDate(s)) return s || ''; const [, y, mo, d] = m, i = +mo - 1, en = o.lang === 'en', lg = en ? 'en' : 'es';
  if (pat) return pat.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, t => ({YYYY: y, YY: y.slice(2), MMMM: MESF[lg][i], MMM: MESA[lg][i], MM: mo, M: +mo, DD: d, D: +d}[t]));
  return fmt === 'export' ? fdate(s, o) : fmt === 'iso' ? s : fmt === 'dmy' ? `${d}-${mo}-${y}` : fmt === 'my' ? `${MESF[lg][i]} ${y}` : en ? `${MESF.en[i]} ${+d}, ${y}` : `${+d} de ${MESF.es[i]} de ${y}`;
}
const cuAuTpl = (t, x) => t.replace(/\{([lLgin])\}/g, (_, c) => ea({l: x.l, L: x.l.toUpperCase(), g: x.g || '', i: x.g ? ini(x.g, 1) : '', n: x.g ? ini(x.g, 0) : ''}[c]));   // personalizado: {l} apellido · {L} APELLIDO · {g} nombre · {i} iniciales con punto · {n} iniciales
function cuAuthors(P, o, a) {
  if (!P.length) return '';
  let list = P, etal = false; if (a.max && P.length > a.max) { list = P.slice(0, a.show); etal = true; }
  const one = (x, k) => { if (x.org || !x.g) return ea(x.l); const t = k === 0 && a.first ? a.first : a.each; if (t) return cuAuTpl(t, x); const l = ea(a.upper ? x.l.toUpperCase() : x.l); let f = a.fmt;
    if (a.firstOnly && k > 0) f = f === 'ap_nom' ? 'nom_ap' : f === 'ap' ? 'ap' : 'ini_ap';
    return f === 'ap_ini' ? `${l}, ${ini(x.g, 1)}` : f === 'ap_ini_sp' ? `${l} ${ini(x.g, 0)}` : f === 'ap_nom' ? `${l}, ${ea(x.g)}` : f === 'nom_ap' ? `${ea(x.g)} ${l}` : f === 'ini_ap' ? `${ini(x.g, 1)} ${l}` : l; };
  const A = list.map(one);
  if (etal) return A.join(a.sep) + (/^[,;]/.test(a.etAl) ? '' : ' ') + ea(a.etAl);
  if (A.length === 1) return A[0];
  const conj = a.last === 'auto' ? (o.lang === 'en' ? ' & ' : yE(list.at(-1).l) + ' ') : a.last;
  return A.slice(0, -1).join(a.sep) + conj + A.at(-1);
}
function cuShort(P, o) {
  const L = P.map(x => ea(x.l)); if (L.length < 3) return L.length === 2 ? L[0] + (o.lang === 'en' ? ' & ' : yE(P[1].l) + ' ') + L[1] : L[0] || '';
  return L[0] + ' et al.';
}
const cuDec = v => v.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
const cuEnc = v => v.replace(/[%:|{}\[\]\\=]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
function cuSplit(m) { const mods = [], op = {}; for (const x of m) { const i = x.indexOf('='); i > 0 ? op[x.slice(0, i)] = cuDec(x.slice(i + 1)) : mods.push(x); } return [mods, op]; }   // {campo:i:fmt=…}: modificadores y opciones propias del campo
const cuAuO = op => { const r = {}; for (const k of ['fmt', 'sep', 'last', 'each', 'first']) if (op[k] != null && op[k] !== '') r[k] = op[k]; if (op.etal != null && op.etal !== '') r.etAl = op.etal;
  for (const k of ['max', 'show']) if (op[k] != null && op[k] !== '') r[k] = +op[k] || 0; if (op.upper) r.upper = op.upper === '1'; if (op.fo) r.firstOnly = op.fo === '1'; if (r.fmt && !r.each && !r.first) r.each = r.first = ''; return r; };   // elegir un formato en el campo anula las plantillas por autor del estilo
function cuValue(k, p, o, cs, op = {}) {
  switch (k) {
    case 'authors': return cuAuthors(pAuthP(p), o, {...cs.au, ...cuAuO(op)});
    case 'author1': return cuAuthors(pAuthP(p).slice(0, 1), o, {...cs.au, ...cuAuO(op), max: 0});
    case 'authorsShort': return cuShort(pAuthP(p), o);
    case 'editors': return cuAuthors(parse(p.editors || []), o, {...cs.au, ...cuAuO(op)});
    case 'title': return ea(p.title || '');
    case 'year': return p.year ? ea(p.year + (o.ys || '')) : '';
    case 'date': return okDate(p.pubDate) ? cuDate(p.pubDate, op.fmt || cs.dateFmt, o, op.pat) : '';
    case 'datey': return okDate(p.pubDate) && fdOk(p) ? cuDate(p.pubDate, op.fmt || cs.dateFmt, o, op.pat) : p.year ? ea(p.year + (o.ys || '')) : '';
    case 'venue': return ea(p.venue || '');
    case 'edition': return op.raw ? ea(p.edition || '') : ea(edLbl(p.edition, o.lang === 'en' ? 'en' : 'es'));
    case 'doi': return p.doi ? ea(normDoi(p.doi)) : '';
    case 'doiurl': return p.doi ? 'https://doi.org/' + normDoi(p.doi) : '';
    case 'url': return p.url || '';
    case 'link': return citeLink(p);
    case 'accessed': return p.accessed && !p.hideAccessed ? cuDate(p.accessed, op.fmt || cs.dateFmt, o, op.pat) : '';
    case 'type': return TYPES[p.type] || '';
    case 'loc': return ea(o.loc || '');
    default: return CU_F.some(f => f[0] === k) && STR_F.includes(k) ? ea(String(p[k] || '')) : '';
  }
}
const cuGet = (n, p, o, cs) => { const [mods, op] = cuSplit(n.m); if (n.k === 'edition' && mods.includes('raw')) op.raw = 1; let v = cuValue(n.k, p, o, cs, op); if (!v) return n.fb ? ea(n.fb) : '';
  if ((n.k === 'pages' || n.k === 'loc') && mods.includes('pp')) v = ea(pgs(n.k === 'pages' ? p.pages : o.loc, 1));
  for (const m of mods) v = cuMod(v, m); return (op.pre ? ea(op.pre) : '') + v + (op.suf ? ea(op.suf) : ''); };   // pre / suf: texto que solo sale si el campo tiene valor
const cuRun = (tpl, p, o, cs) => cuTidy(cuRender(cuParse(tpl || '')[0], n => cuGet(n, p, o, cs)));
const cuLang = (o, c) => c.lang === 'es' || c.lang === 'en' ? {...o, lang: c.lang} : o;
function syncStyles(list, exp) {   // registra los estilos propios junto a los de serie (clave cu_<id>)
  for (const k of Object.keys(STYLES)) if (k.startsWith('cu_')) delete STYLES[k];
  for (const c of list || []) STYLES['cu_' + c.id] = {name: c.name + ' ✎', custom: true, order: c.order, numbered: c.numbered, numFmt: c.numFmt, dis: c.dis,
    fn: (p, o = ex()) => cuRun(c.tpl[p.type] ?? c.tpl['*'] ?? '', p, cuLang(o, c), c) || ea(p.title || ''),
    inText: (p, o = ex(), loc = '') => c.inText ? [{k: 'En el texto', t: cuRun(c.inText, p, {...cuLang(o, c), loc}, c)}] : [],
    note: 'Estilo personalizado: se edita en Configuración → Estilos de cita personalizados.'};
  if (exp && !STYLES[exp.style]) exp.style = 'apa';
}
const STY_G = [['', 'Estilos generales'], ['law', 'Derecho y jurisprudencia'], ['custom', 'Estilos propios']];   // secciones del selector de estilos
const styGroup = s => s.custom ? 'custom' : s.group || '';
const styOpts = cur => STY_G.map(([g, t]) => { const E = Object.entries(STYLES).filter(([, s]) => styGroup(s) === g);
  return E.length ? `<optgroup label="${t}">${E.map(([k, s]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : ''; }).join('');
const isNum = o => !!(o.num || STYLES[o.style]?.numbered);

const numLbl = (i, o) => { const f = !o.numFmt || o.numFmt === 'auto' ? STYLES[o.style]?.numFmt || 'dot' : o.numFmt; return {dot: `${i}. `, br: `[${i}] `, par: `(${i}) `}[f] || `${i}. `; };   // etiqueta de numeración
const abcLetters = n => { let r = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) r = String.fromCharCode(97 + (n - 1) % 26) + r; return r; };   // 0→a … 25→z, 26→aa
function yearSuffixes(L, o) {   // Map id → letra para obras del mismo autor y año (APA: se ordenan por título); solo estilos con dis
  const m = new Map(), g = new Map();
  if (o.disamb === false || !STYLES[o.style]?.dis) return m;
  for (const p of L) { const au = authP(p); if (!au.length) continue;
    const k = au.map(a => `${a.l}|${a.g}`).join(';').toLowerCase() + '|' + (p.year || 's.f.'); (g.get(k) || g.set(k, []).get(k)).push(p); }
  for (const G of g.values()) if (G.length > 1) [...G].sort((a, b) => a.title.localeCompare(b.title, 'es')).forEach((p, i) => m.set(p.id, abcLetters(i)));
  return m;
}
