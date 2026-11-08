'use strict';
/* ===== Importar referencias (BibTeX, RIS y DOI vía CrossRef) ===== */
const normDoi = s => String(s || '').trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '').trim().toLowerCase();
const cleanText = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || '').replace(/<[^>]+>/g, ''); return t.value.replace(/\s+/g, ' ').trim(); };
const normTitle = s => cleanText(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ACC = {"'": '\u0301', '`': '\u0300', '"': '\u0308', '^': '\u0302', '~': '\u0303'};
const untex = s => s.replace(/\\(['`"^~])\s*\{?\\?([a-zA-Z])\}?/g, (_, a, c) => (c + ACC[a]).normalize('NFC')).replace(/\\c\s*\{?([cC])\}?/g, (_, c) => (c + '\u0327').normalize('NFC'))
  .replace(/\\ss\b/g, 'ß').replace(/\\&/g, '&').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
const fixAuthor = a => { a = a.trim(); if (a.includes(',')) return a.replace(/\s*,\s*/, ', '); const w = a.split(/\s+/); return w.length > 1 ? `${w.at(-1)}, ${w.slice(0, -1).join(' ')}` : a; };   // → «Apellido, Nombre»
const BIBT = {article: 'articulo', book: 'libro', incollection: 'capitulo', inbook: 'capitulo', inproceedings: 'congreso', conference: 'congreso', proceedings: 'congreso', phdthesis: 'tesis', mastersthesis: 'tesis', techreport: 'informe', report: 'informe', standard: 'norma', patent: 'patente', dataset: 'dataset', software: 'software', legislation: 'legislacion', jurisdiction: 'jurisprudencia', movie: 'audiovisual', video: 'audiovisual', music: 'audio', audio: 'audio', misc: 'web', online: 'web', electronic: 'web'};
const RIST = {RPRT: 'informe', STAND: 'norma', PAT: 'patente', MAP: 'mapa', DATA: 'dataset', COMP: 'software', DBASE: 'basedatos', VIDEO: 'audiovisual', MPCT: 'audiovisual', ADVS: 'audiovisual', SOUND: 'audio', MUSIC: 'audio', PCOMM: 'personal', SLIDE: 'presentacion', DICT: 'diccionario', ENCYC: 'diccionario', STAT: 'legislacion', BILL: 'legislacion', LEGAL: 'legislacion', CASE: 'jurisprudencia', NEWS: 'prensa', MGZN: 'prensa', BLOG: 'blog', JOUR: 'articulo', BOOK: 'libro', CHAP: 'capitulo', CONF: 'congreso', CPAPER: 'congreso', THES: 'tesis', ELEC: 'web', WEB: 'web'};
const CRT = {dataset: 'dataset', report: 'informe', 'report-component': 'informe', 'report-series': 'informe', standard: 'norma', 'journal-article': 'articulo', book: 'libro', monograph: 'libro', 'edited-book': 'libro', 'book-chapter': 'capitulo', 'reference-entry': 'capitulo', 'proceedings-article': 'congreso', dissertation: 'tesis'};
const P2_F = ['isbn', 'issn', 'series', 'seriesNumber', 'institution', 'docNumber', 'conferenceName', 'conferencePlace', 'conferenceDates'];
const P3_F = ['subtype', 'authorRole', 'userHandle', 'abbr', 'ecli'];   // F3d–F3e · abreviatura y ECLI (Derecho)
const IMP_F = ['volume', 'issue', 'pages', 'publisher', 'place', 'edition', 'pubDate', 'thesisType', ...P2_F, ...P3_F, 'editors', 'authorType', 'accessed'];   // campos que traen los importadores además de los básicos
const MON = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, ene: 1, abr: 4, ago: 8, dic: 12};
const monNum = m => { m = String(m ?? '').trim().toLowerCase(); return /^\d{1,2}$/.test(m) ? (+m >= 1 && +m <= 12 ? +m : 0) : MON[m.slice(0, 3)] || 0; };
const isoDate = (y, m, d) => { y = String(y ?? '').match(/\d{4}/)?.[0]; m = monNum(m); d = +(String(d ?? '').match(/\d{1,2}/)?.[0] || 0);   // solo si hay año, mes y día
  return y && m && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''; };
const normPages = s => String(s ?? '').replace(/\s*(--|–|—)\s*/g, '-').replace(/\s+/g, ' ').trim();
const thesisFrom = (kind, bib) => { const k = String(kind ?? '').toLowerCase();   // texto libre → uno de THESIS
  if (/doctor|ph\.?d|dissert/.test(k)) return 'Tesis doctoral'; if (/grado|bachelor|undergrad|tfg/.test(k)) return 'Trabajo fin de grado';
  if (/m[aá]ster|master|tfm/.test(k)) return 'Trabajo fin de máster'; if (/carrera|pfc/.test(k)) return 'Proyecto fin de carrera';
  return bib === 'phdthesis' ? 'Tesis doctoral' : bib === 'mastersthesis' ? 'Trabajo fin de máster' : ''; };
const refFields = (ty, o) => {   // deja solo los campos que el tipo usa (FLD_T) y rellena el resto con valores vacíos
  const r = {volume: '', issue: '', pages: '', publisher: '', place: '', edition: '', pubDate: '', thesisType: '', ...Object.fromEntries([...P2_F, ...P3_F].map(k => [k, ''])), editors: [], authorType: 'auto', accessed: ''};
  for (const k of IMP_F) if (o[k] != null && o[k] !== '' && (!FLD_T[k] || shows(k, ty))) r[k] = o[k];
  return r; };

function bibBody(t, i) {   // i = posición tras la llave de apertura; devuelve [contenido, posición siguiente]
  let d = 1, j = i;
  for (; j < t.length && d > 0; j++) { if (t[j] === '{') d++; else if (t[j] === '}') d--; }
  return [t.slice(i, j - 1), j];
}
function parseBib(t) {   // recorrido propio: las expresiones regulares fallan con llaves anidadas
  const out = [], re = /@(\w+)\s*\{/g; let m;
  while ((m = re.exec(t))) {
    const [body, next] = bibBody(t, re.lastIndex); re.lastIndex = next;
    const type = m[1].toLowerCase(), f = {}; let k = body.indexOf(',') + 1;
    if (['comment', 'preamble', 'string'].includes(type) || !k) continue;
    while (k < body.length) {
      const nm = /\s*,?\s*([\w-]+)\s*=\s*/y; nm.lastIndex = k; const mm = nm.exec(body); if (!mm) break;
      k = nm.lastIndex; let v;
      if (body[k] === '{') [v, k] = bibBody(body, k + 1);
      else if (body[k] === '"') { let d = 0, j = k + 1; for (; j < body.length; j++) { if (body[j] === '{') d++; else if (body[j] === '}') d--; else if (body[j] === '"' && d === 0) break; } v = body.slice(k + 1, j); k = j + 1; }
      else { const e = body.indexOf(',', k), end = e < 0 ? body.length : e; v = body.slice(k, end).trim(); k = end; }
      f[mm[1].toLowerCase()] = v;
    }
    const g = key => untex(f[key] || ''), pick = (...ks) => ks.map(g).find(Boolean) || '', how = g('howpublished'), sub = g('entrysubtype').toLowerCase(), ty0 = BIBT[type] || 'articulo',
      ty = Object.hasOwn(TYPES, sub) ? sub : ty0 === 'articulo' && /^(newspaper|magazine)$/.test(sub) ? 'prensa' : ty0 === 'web' && (sub === 'blog' || /^blog$/i.test(how.trim())) ? 'blog' : ty0;   // F3b: prensa = @article + entrysubtype newspaper/magazine; blog = @online/@misc + entrysubtype blog
    const names = v => (v || '').split(/\s+and\s+/i).map(a => a.trim()).filter(a => a && !/^others$/i.test(a));
    const nm = a => /^\{.*\}$/.test(a) ? untex(a) : fixAuthor(untex(a)), raw = names(f.author);
    const GV = pick('organization', 'institution', 'publisher', 'journal', 'journaltitle', 'booktitle') || (/https?:|\\url|^(blog|norma|standard)$/i.test(how.trim()) ? '' : how);   // venue de los tipos F3c–F3e
    const V = {prensa: pick('journal', 'journaltitle'), informe: pick('institution', 'publisher', 'organization'), norma: pick('organization', 'institution', 'publisher'), patente: GV, mapa: GV, dataset: GV, software: GV, basedatos: GV, audiovisual: GV, audio: GV, redsocial: GV, ia: GV, diccionario: GV, presentacion: GV, personal: GV, legislacion: GV, jurisprudencia: pick('institution', 'organization'),
      blog: pick('journal', 'journaltitle', 'booktitle', 'organization', 'publisher') || (/https?:|\\url|^blog$/i.test(how.trim()) ? '' : how), articulo: pick('journal', 'journaltitle'), libro: pick('publisher'), capitulo: pick('booktitle'), congreso: pick('booktitle'), tesis: pick('school', 'institution'),
      web: pick('journal', 'booktitle', 'publisher', 'organization') || (/https?:|\\url/i.test(how) ? '' : how)}[ty];
    const venue = V || pick('journal', 'journaltitle', 'booktitle', 'publisher', 'school', 'institution');
    const dt = g('date'), pub = pick('publisher');
    out.push({title: g('title'), year: (g('year') || dt).match(/\d{4}/)?.[0] || '', venue, doi: normDoi(g('doi')), url: g('url'), type: ty, authors: raw.map(nm),
      ...refFields(ty, {volume: g('volume'), issue: pick('issue', 'number'), pages: normPages(g('pages')), publisher: pub && pub !== venue ? pub : '', place: pick('address', 'location'), edition: g('edition'),
        pubDate: /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : isoDate(g('year'), g('month'), g('day')), thesisType: ty === 'tesis' ? thesisFrom(g('type'), type) : '', editors: names(f.editor).map(nm),
        isbn: g('isbn'), issn: g('issn'), series: g('series'), seriesNumber: g('seriesnumber'), institution: g('institution') !== venue ? g('institution') : '',
        docNumber: g('docnumber') || (ty === 'legislacion' ? '' : g('number')), subtype: g('type'), authorRole: g('authorrole'), userHandle: g('userhandle'), abbr: g('shorthand'), ecli: g('ecli'), conferenceName: ty === 'congreso' || ty === 'capitulo' ? '' : g('booktitle'), conferencePlace: '', conferenceDates: '',
        authorType: raw.length && raw.every(a => /^\{[^,]*\}$/.test(a)) ? 'entidad' : 'auto', accessed: /^\d{4}-\d{2}-\d{2}$/.test(g('urldate')) ? g('urldate') : ''})});
  }
  return out;
}
function finRis(r) {   // convierte los campos RIS acumulados (r.raw) en una referencia de la app
  const R = r.raw, gk = /gestor:(\w+)/.exec(R.N1 || ''), ty = gk && Object.hasOwn(TYPES, gk[1]) ? gk[1] : r.type, f = (...ks) => ks.map(k => R[k]).find(Boolean) || '';
  const GV = f('PB', 'T2', 'JO');
  const V = {informe: GV, norma: GV, patente: GV, mapa: GV, dataset: GV, software: GV, basedatos: GV, audiovisual: GV, audio: GV, redsocial: GV, ia: GV, presentacion: GV, personal: GV, legislacion: GV, jurisprudencia: GV, diccionario: f('T2', 'BT', 'PB'), prensa: f('JO', 'JF', 'J2', 'T2'), blog: f('T2', 'JO', 'PB'), articulo: f('JO', 'JF', 'J2', 'T2'), libro: f('PB', 'T2'), capitulo: f('T2', 'BT', 'JO'), congreso: f('T2', 'JO', 'BT'), tesis: f('PB', 'T2'), web: f('T2', 'JO', 'PB')}[ty];
  const venue = V || f('JO', 'JF', 'J2', 'T2', 'PB'), da = (R.DA || '').split('/'), y2 = (R.Y2 || '').split('/');
  const pages = R.SP && R.EP ? (R.SP === R.EP ? R.SP : `${R.SP}-${R.EP}`) : normPages(R.SP || '');
  return {title: f('TI', 'T1'), authors: r.authors, year: f('PY', 'Y1', 'DA').match(/\d{4}/)?.[0] || '', venue, doi: normDoi(R.DO || ''), url: R.UR || '', type: ty,
    ...refFields(ty, {volume: R.VL, issue: R.IS, pages, publisher: ty === 'jurisprudencia' ? R.DB : R.PB && R.PB !== venue ? R.PB : '', place: R.CY, edition: R.ET, pubDate: isoDate(...da), thesisType: ty === 'tesis' ? thesisFrom(R.M3, '') : '',
      editors: r.editors, accessed: isoDate(...y2),
      isbn: ty === 'articulo' ? '' : R.SN, issn: ty === 'articulo' ? R.SN : '', series: R.T3, seriesNumber: ty === 'articulo' ? '' : R.IS, conferencePlace: R.AD, docNumber: R.M1, subtype: R.M3, authorRole: R.C1, userHandle: R.C2, abbr: R.J2, ecli: R.C3})};
}
function parseRis(t) {
  const out = []; let r = null;
  for (const line of t.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/.exec(line); if (!m) continue;
    const [, k, v] = m;
    if (k === 'TY') { if (r) out.push(finRis(r)); r = {type: RIST[v.trim()] || 'articulo', authors: [], editors: [], raw: {}}; }
    else if (!r) continue;
    else if (k === 'ER') { out.push(finRis(r)); r = null; }
    else if (k === 'AU' || k === 'A1') r.authors.push(fixAuthor(v));
    else if (k === 'A2' || k === 'ED') r.editors.push(fixAuthor(v));
    else if (v.trim()) r.raw[k] ||= v.trim();
  }
  if (r) out.push(finRis(r));
  return out;
}
function fromCrossref(m, doi) {   // mensaje de la API de CrossRef → referencia de la app
  const ty = CRT[m.type] || 'web', nm = a => a.family ? a.family + (a.given ? ', ' + a.given : '') : a.name || '', au = m.author || [], dp = m.issued?.['date-parts']?.[0] || [];
  const venue = cleanText(m['container-title']?.[0] || (ty === 'tesis' && m.institution?.[0]?.name) || m.publisher), pub = cleanText(m.publisher);
  return {title: cleanText(m.title?.[0]), authors: au.map(nm).filter(Boolean), year: String(dp[0] || ''), venue, doi, url: 'https://doi.org/' + doi, type: ty,
    ...refFields(ty, {volume: cleanText(m.volume), issue: cleanText(m.issue), pages: normPages(m.page), publisher: pub !== venue ? pub : '', place: cleanText(m['publisher-location']),
      edition: cleanText(m['edition-number']), pubDate: dp.length === 3 ? isoDate(...dp) : '', isbn: cleanText(m.ISBN?.[0]), issn: cleanText(m.ISSN?.[0]), editors: (m.editor || []).map(nm).filter(Boolean),
      authorType: au.length && au.every(a => !a.family && a.name) ? 'entidad' : 'auto'})};
}
async function fetchDoi(raw) {
  const doi = normDoi(raw); if (!doi) throw Error('Escribe un DOI.');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await fetch('https://api.crossref.org/works/' + encodeURI(doi), {signal: ac.signal});
    if (r.status === 404) throw Error('CrossRef no encuentra ese DOI.');
    if (!r.ok) throw Error('CrossRef respondió con un error (' + r.status + ').');
    return fromCrossref((await r.json()).message, doi);
  } catch (e) { throw Error(e.name === 'AbortError' ? 'CrossRef tardó demasiado en responder.' : e instanceof TypeError ? 'No se pudo conectar con CrossRef (¿sin conexión, o abierta desde file://?).' : e.message); }
  finally { clearTimeout(tm); }
}
/* ---- CSL-JSON (Zotero, Pandoc…) ---- */
const CSLR = {'article-journal': 'articulo', article: 'articulo', 'article-magazine': 'articulo', book: 'libro', chapter: 'capitulo', 'paper-conference': 'congreso', thesis: 'tesis', webpage: 'web',
  'article-newspaper': 'prensa', 'post-weblog': 'blog', report: 'informe', standard: 'norma', patent: 'patente', map: 'mapa', dataset: 'dataset', software: 'software', motion_picture: 'audiovisual', broadcast: 'audiovisual',
  song: 'audio', post: 'redsocial', 'entry-dictionary': 'diccionario', 'entry-encyclopedia': 'diccionario', speech: 'presentacion', personal_communication: 'personal', legislation: 'legislacion', bill: 'legislacion', legal_case: 'jurisprudencia'};
const isCsl = t => { try { const j = JSON.parse(t); const a = Array.isArray(j) ? j : j && j.items; return Array.isArray(a) && a.length > 0 && a.every(x => x && typeof x === 'object' && typeof x.type === 'string' && 'title' in x); } catch (e) { return false; } };
const str = v => v == null ? '' : cleanText(Array.isArray(v) ? v[0] : v);
function parseCsl(t) {
  const j = JSON.parse(t), a = Array.isArray(j) ? j : j.items, nm = n => n.literal || [n.family, n.given].filter(Boolean).join(', ') || n.given || '';
  const dt = d => d?.['date-parts']?.[0] || (d?.raw ? String(d.raw).match(/\d+/g)?.map(Number) : null) || [];
  return a.map(x => { const ty = CSLR[x.type] || 'articulo', is = dt(x.issued), ac = dt(x.accessed), ent = (x.author || []).length && x.author.every(n => n.literal);
    const pub = CSL_PUB.has(ty);
    return {title: cleanText(x.title), authors: (x.author || []).map(nm).filter(Boolean), year: is[0] ? String(is[0]) : '', venue: cleanText(pub ? x.publisher || x['container-title'] : x['container-title'] || ''), doi: normDoi(x.DOI), url: x.URL || '', type: ty,
      ...refFields(ty, {volume: str(x.volume), issue: str(x.issue), pages: normPages(x.page), publisher: pub ? '' : cleanText(x.publisher), place: str(x['publisher-place']), edition: str(x.edition), editors: (x.editor || []).map(nm).filter(Boolean),
        pubDate: is.length === 3 ? isoDate(...is) : '', accessed: ac.length === 3 ? isoDate(...ac) : '', isbn: str(x.ISBN), issn: str(x.ISSN), authorType: ent ? 'entidad' : 'auto'}),
      general: cleanText(x.abstract || '')}; });
}
/* ---- Buscar por ISBN (Open Library) o por título (CrossRef) ---- */
const isIsbn = s => { const d = String(s || '').replace(/^isbn[:\s]*/i, '').replace(/[\s-]/g, '').toUpperCase(); return /^(97[89]\d{10}|\d{9}[\dX])$/.test(d) ? d : ''; };
const isDoi = s => /^10\.\d{4,9}\/\S+$/.test(normDoi(s));
async function apiJson(url, who) {   // GET con 10 s de espera y mensajes claros
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
  try { const r = await fetch(url, {signal: ac.signal}); if (!r.ok) throw Error(`${who} respondió con un error (${r.status}).`); return await r.json(); }
  catch (e) { throw Error(e.name === 'AbortError' ? `${who} tardó demasiado en responder.` : e instanceof TypeError ? `No se pudo conectar con ${who} (¿sin conexión, o abierta desde file://?).` : e.message); }
  finally { clearTimeout(tm); }
}
function fromOpenLibrary(b, isbn) {   // libro de la API de Open Library → referencia de la app
  const pub = cleanText(b.publishers?.[0]?.name), pg = b.number_of_pages ? String(b.number_of_pages) : '';
  return {title: cleanText(b.title + (b.subtitle ? ': ' + b.subtitle : '')), authors: (b.authors || []).map(a => fixAuthor(cleanText(a.name))).filter(Boolean), year: (String(b.publish_date || '').match(/\d{4}/) || [''])[0],
    venue: pub, doi: '', url: b.url || '', type: 'libro', ...refFields('libro', {publisher: '', place: cleanText(b.publish_places?.[0]?.name), isbn, pages: pg})};
}
async function fetchIsbn(raw) {
  const i = isIsbn(raw); if (!i) throw Error('Ese ISBN no es válido.');
  const j = await apiJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${i}&format=json&jscmd=data`, 'Open Library'), b = j['ISBN:' + i];
  if (!b) throw Error('Open Library no encuentra ese ISBN.');
  return fromOpenLibrary(b, i);
}
async function searchTitle(q) {   // hasta 6 resultados de CrossRef para elegir
  q = String(q || '').trim(); if (q.length < 4) throw Error('Escribe un DOI, un ISBN o al menos unas palabras del título.');
  const j = await apiJson('https://api.crossref.org/works?rows=6&query.bibliographic=' + encodeURIComponent(q), 'CrossRef');
  const L = (j.message?.items || []).filter(m => m.DOI && m.title?.[0]).map(m => fromCrossref(m, normDoi(m.DOI)));
  if (!L.length) throw Error('CrossRef no encuentra nada con ese título.');
  return L;
}
/* ---- Texto de ScienceDirect (.txt «Export citation → Text») y citas copiadas de Google Scholar (APA, MLA, Chicago, Harvard, Vancouver) ---- */
const isSdTxt = t => /^\s*(Volume|ISSN|ISBN|Pages)\s.+,\s*$/m.test(t) && /\n\s*\(https?:\/\/[^)]+\)\s*$|https?:\/\/doi\.org\/\S+\.\s*$/m.test(t);
const sdAuthors = l => l.replace(/,\s*$/, '').split(/,\s*|\s+and\s+/).map(a => a.trim()).filter(Boolean).map(fixAuthor);
function parseSd(t) {   // un registro por bloque separado por una línea en blanco: autores, título, revista, Volume, Issue, año, páginas o número de artículo, ISSN, DOI, (URL), Abstract, Keywords
  return t.split(/\n\s*\n/).map(b => b.split(/\r?\n/).map(l => l.trim()).filter(Boolean)).filter(L => L.length >= 3 && L.some(l => /^(Volume|ISSN|ISBN|Pages)\s|doi\.org/.test(l))).map(L => {
    const r = {authors: sdAuthors(L[0]), title: L[1].replace(/,\s*$/, ''), year: '', venue: '', doi: '', url: '', type: 'articulo', general: ''}, o = {}, notes = [];
    for (const raw of L.slice(2)) { const l = raw.replace(/[,.]\s*$/, ''); let m;
      if ((m = /^Abstract:\s*(.*)$/i.exec(raw))) notes.push('**Resumen:** ' + m[1]);
      else if ((m = /^Keywords:\s*(.*)$/i.exec(raw))) notes.push('**Palabras clave:** ' + m[1]);
      else if ((m = /^Volume\s+(.+)$/i.exec(l))) o.volume = m[1];
      else if ((m = /^(?:Issue|Number)\s+(.+)$/i.exec(l))) o.issue = m[1];
      else if ((m = /^Pages?\s+(.+)$/i.exec(l))) o.pages = normPages(m[1]);
      else if ((m = /^ISSN\s+(.+)$/i.exec(l))) o.issn = m[1];
      else if ((m = /^ISBN\s+(.+)$/i.exec(l))) o.isbn = m[1];
      else if ((m = /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i.exec(l))) r.doi = normDoi(m[1]);
      else if ((m = /^\((https?:\/\/[^)]+)\)$/.exec(l))) r.url = m[1];
      else if (/^\d{4}$/.test(l) && !r.year) r.year = l;
      else if (/^[A-Za-z]?\d+$/.test(l) && !o.pages) o.pages = l;   // número de artículo (eLocator)
      else if (!r.venue) r.venue = l;
    }
    if (o.isbn && !o.volume) r.type = 'libro';
    if (notes.length) r.general = notes.join('\n\n');
    return {...r, ...refFields(r.type, o)};
  });
}
const expPages = p => { const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(p = normPages(p)); return m && m[2].length < m[1].length ? `${m[1]}-${m[1].slice(0, m[1].length - m[2].length)}${m[2]}` : p; };   // 129-46 → 129-146
const vipp = s => {   // «Revista, 22(1), 129-146» / «Revista 22.1 (2019): 129-146» / «Revista 22, no. 1 (2019)» → partes
  let m = /^(.*?),?\s+(\d+)(?:\(([^)]+)\)|\.(\w+)|,\s*no\.\s*(\w+))?(?:\s*\((\d{4})\))?(?:\s*[,:]\s*(?:pp?\.\s*)?([A-Za-z]?\d+(?:\s*[-–]\s*\d+)?))?\.?$/.exec(s.trim());
  return m && m[1] ? {venue: m[1].replace(/[.,]$/, ''), volume: m[2], issue: m[3] || m[4] || m[5] || '', year: m[6] || '', pages: m[7] ? expPages(m[7]) : ''} : null;
};
const splitTitle = s => { const m = /^(.+?[?!]|.+?)\.\s+(.+)$/.exec(s) || /^(.+?[?!])\s+(.+)$/.exec(s); return m ? [m[1], m[2]] : [s.replace(/\.$/, ''), '']; };
const initAuthors = s => {   // «Iyengar, S., Lelkes, Y., & Westwood, S. J.» / «Wagner, M. and Smith, J.» → pares Apellido, Iniciales
  const p = s.replace(/,?\s*(&|and|y)\s+/g, ', ').replace(/\s*…\s*|\.\.\./g, ', ').split(/,\s*/).map(x => x.trim()).filter(Boolean), out = [];
  for (let i = 0; i < p.length; i++) { if (/^([A-ZÀ-Ý]\.\s*-?)+$/.test(p[i + 1] || '')) { out.push(`${p[i]}, ${p[i + 1].replace(/\.(?=[A-ZÀ-Ý])/g, '. ')}`); i++; } else out.push(fixAuthor(p[i])); }
  return out; };
const fullAuthors = s => {   // MLA y Chicago: «Iyengar, Shanto, Yphtach Lelkes, and Sean J. Westwood» / «Iyengar, Shanto, et al.»
  s = s.replace(/,?\s*et al\.?$/, ''); const [last, first, ...rest] = s.split(/,\s*/); if (first == null) return [fixAuthor(last)];
  return [`${last}, ${first.replace(/^and\s+/, '')}`, ...rest.join(', ').split(/,\s*(?:and\s+)?|\s+and\s+/).map(a => a.replace(/^and\s+/, '').trim()).filter(Boolean).map(fixAuthor)]; };
function parseCite(c) {   // una cita con formato → referencia; null si no se reconoce
  c = c.trim().replace(/\s+/g, ' ').replace(/[“”«»]/g, '"'); let m, r = null;
  const ref = (authors, year, title, rest, book) => { const v = !book && vipp(rest), ty = v ? 'articulo' : 'libro';
    const o = v ? {volume: v.volume, issue: v.issue, pages: v.pages} : {publisher: ''};
    return {authors, year: year || v?.year || (/(\d{4})\.?$/.exec(rest)?.[1] ?? ''), title: title.replace(/[.,]$/, ''), venue: v ? v.venue : rest.replace(/,?\s*\d{4}\.?$/, '').replace(/\.$/, ''), doi: '', url: '', type: ty, ...refFields(ty, o)}; };
  if ((m = /^(.+?)\s\((\d{4})[a-z]?\)\.\s(.+)$/.exec(c))) { const [t, rest] = splitTitle(m[3]); r = ref(initAuthors(m[1]), m[2], t, rest); }   // APA
  else if ((m = /^(.+?)\.\s"(.+?)"\s*(.*)$/.exec(c))) r = ref(fullAuthors(m[1]), '', m[2], m[3]);   // MLA y Chicago (título entre comillas)
  else if ((m = /^(.+?),\s(\d{4})[a-z]?\.\s(.+)$/.exec(c))) { const [t, rest] = splitTitle(m[3]); r = ref(initAuthors(m[1]), m[2], t, rest); }   // Harvard
  else if ((m = /^(.+?)\.\s(.+?)\.\s(.+?)\.\s(\d{4})[^;]*;\s*(\d+)(?:\(([^)]+)\))?(?::\s*([A-Za-z]?\d+(?:-\d+)?))?\.?$/.exec(c)))   // Vancouver
    r = {authors: m[1].split(/,\s*/).map(a => { const x = /^(.+?)\s([A-Z]{1,3})$/.exec(a.trim()); return x ? `${x[1]}, ${[...x[2]].join('. ')}.` : fixAuthor(a); }), year: m[4], title: m[2], venue: m[3], doi: '', url: '', type: 'articulo',
      ...refFields('articulo', {volume: m[5], issue: m[6] || '', pages: m[7] ? expPages(m[7]) : ''})};
  else if ((m = /^(.+?)\.\s(.+?)\.\s(.+?),\s(\d{4})\.?$/.exec(c))) r = ref(fullAuthors(m[1]), m[4], m[2], m[3], true);   // libro en MLA o Chicago: Autor. Título. Editorial, año.
  if (!r || !r.title || !r.authors.length) return null;
  if (r.type === 'libro') r.venue = r.venue.replace(/,?\s*\d{4}$/, '');
  return r;
}
const parseCites = t => t.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(parseCite).filter(Boolean);
/* ---- Títulos casi iguales (una errata, un subtítulo de más): parecido de bigramas (Dice) ≥ 0,9, años a ±1 como mucho.
   Solo se comparan títulos que comparten la primera o la última palabra larga, así con miles de papers sigue siendo rápido. */
const bigr = t => { const s = new Set(); for (let i = 0; i < t.length - 1; i++) s.add(t.slice(i, i + 2)); return s; };
function titleSim(a, b) {   // a y b ya pasados por normTitle
  if (!a || !b) return 0; if (a === b) return 1;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 20 && l.startsWith(s + ' ')) return 0.95;   // el mismo título con subtítulo
  const A = bigr(a), B = bigr(b); let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return 2 * n / (A.size + B.size || 1);
}
const SIM_MIN = 0.9;
const nearKeys = t => { const w = t.split(' ').filter(x => x.length > 3); return t.length < 12 ? [] : [...new Set([w[0], w.at(-1)].filter(Boolean))]; };
const yearsNear = (a, b) => !+a || !+b || Math.abs(+a - +b) <= 1;
const nums = t => (t.match(/\d+/g) || []).join(' ');   // «Parte 1» y «Parte 2» no son el mismo trabajo
const isNear = (t1, y1, t2, y2) => t1 !== t2 && yearsNear(y1, y2) && nums(t1) === nums(t2) && titleSim(t1, t2) >= SIM_MIN;
function nearIndex(L) {   // índice para buscar títulos parecidos: palabra → [{t, y, p}]
  const m = new Map(); L.forEach(p => { const t = normTitle(p.title); nearKeys(t).forEach(k => { if (!m.has(k)) m.set(k, []); m.get(k).push({t, y: p.year, p}); }); }); return m;
}
const nearFind = (idx, t, y) => { for (const k of nearKeys(t)) for (const e of idx.get(k) || []) if (isNear(t, y, e.t, e.y)) return e.p; return null; };
function impPrepare(refs) {   // marca duplicados (mismo DOI o mismo título) frente al archivo y dentro del propio lote
  const dois = new Set(db.papers.map(p => normDoi(p.doi)).filter(Boolean)), tits = new Set(db.papers.map(p => normTitle(p.title)).filter(Boolean));
  const idx = nearIndex(db.papers);
  refs.forEach(r => { const t = normTitle(r.title); r.bad = !r.title;
    r.dup = !r.bad && ((r.doi && dois.has(r.doi)) || (t && tits.has(t)));
    const nr = !r.bad && !r.dup && t ? nearFind(idx, t, r.year) : null; r.near = nr ? nr.title : ''; r.on = !r.bad && !r.dup && !nr;
    if (r.doi) dois.add(r.doi); if (t) { tits.add(t); nearKeys(t).forEach(k => { if (!idx.has(k)) idx.set(k, []); idx.get(k).push({t, y: r.year, p: r}); }); } });
  return refs;
}
const FLD = [['title', 'Título'], ['authors', 'Autores'], ['year', 'Año'], ['venue', 'Revista / editorial'], ['url', 'URL'], ['type', 'Tipo'], ['volume', 'Volumen'], ['issue', 'Número'], ['pages', 'Páginas'], ['publisher', 'Editorial'], ['place', 'Lugar'], ['edition', 'Edición'], ['editors', 'Editores'], ['pubDate', 'Fecha de publicación'], ['isbn', 'ISBN'], ['issn', 'ISSN']];
let IMP = {mode: '', refs: []};
function openImport(mode) {   // desde el menú del clic derecho en 📂 (o el atajo)
  ctxClose();
  if (mode === 'file') return impFile();
  IMP = {mode, refs: []}; impDraw(); $('#imp').showModal();
}
async function impFile() {
  try {
    let text;
    if (FSA) { const [h] = await showOpenFilePicker({types: [{description: 'Referencias (BibTeX, RIS o texto)', accept: {'text/plain': ['.bib', '.ris', '.txt'], 'application/json': ['.json']}}]}); text = await (await h.getFile()).text(); }
    else { const r = await pickFile('.bib,.ris,.txt,.json'); if (!r) return; text = r.text; }
    impText(text);
  } catch (e) { if (e.name !== 'AbortError') say('No se pudo leer el archivo: ' + e.message); }
}
function impText(t) {
  t = t.replace(/^\uFEFF/, '');
  if (/^\s*[[{]/.test(t) && !isCsl(t)) { try { if (Array.isArray(JSON.parse(t).papers)) return say('Este JSON es un proyecto de la aplicación: ábrelo con Archivo ▾ → «Abrir un archivo JSON…».'); } catch (e) {} }
  const refs = isCsl(t) ? parseCsl(t) : /^\s*TY\s{2}-/m.test(t) ? parseRis(t) : /@\w+\s*\{/.test(t) ? parseBib(t) : isSdTxt(t) ? parseSd(t) : parseCites(t);
  if (!refs.length) return say('No se reconoce ninguna referencia. Usa BibTeX (.bib), RIS (.ris), CSL-JSON (.json), el texto (.txt) de ScienceDirect o citas copiadas de Google Scholar, una por línea.');
  IMP = {mode: 'prev', refs: impPrepare(refs)}; impDraw(); if (!$('#imp').open) $('#imp').showModal();
}
async function impDoi() {   // un DOI, un ISBN o un título (este da varios resultados para elegir)
  const v = $('#iDoi').value; $('#iMsg').textContent = 'Buscando…';
  try {
    if (isDoi(v)) IMP = {mode: 'prev', refs: impPrepare([await fetchDoi(v)])};
    else if (isIsbn(v)) IMP = {mode: 'prev', refs: impPrepare([await fetchIsbn(v)])};
    else IMP = {mode: 'pick', q: v, refs: impPrepare(await searchTitle(v))};
    impDraw();
  } catch (e) { $('#iMsg').textContent = e.message; }
}
function impPick(i) { const r = IMP.refs[i]; if (!r) return; r.on = !r.bad; IMP = {mode: 'prev', refs: [r]}; impDraw(); }
function impDraw() {
  const m = IMP.mode, close = `<button data-onclick="$('#imp').close()">Cancelar</button>`;
  let h = `<h2>${m === 'fill' ? 'Datos de CrossRef' : m === 'oa' ? 'Datos de OpenAlex' : 'Importar referencias'}</h2>`;
  if (m === 'oa') { const o = IMP.oa, row = (id, on, t, v) => `<label class="irow"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span><b>${t}</b><br><small>${v}</small></span></label>`;
    const L = [o.abstract && row('oa_abs', !/resumen/i.test(D.general || ''), 'Resumen → a las notas generales', esc(o.abstract.length > 400 ? o.abstract.slice(0, 400) + '…' : o.abstract)),
      o.cites != null && row('oa_cit', false, 'Número de citas → a las notas generales', `Citado ${o.cites} ${o.cites === 1 ? 'vez' : 'veces'} según OpenAlex`),
      o.pdf && row('oa_pdf', !D.url, D.url ? 'PDF en abierto → a las notas generales (ya hay URL)' : 'PDF en abierto → como URL', `<a href="${esc(o.pdf)}" target="_blank" rel="noopener noreferrer">${esc(o.pdf)}</a>`)].filter(Boolean);
    h += (o.byDoi ? '' : `<p class="empty">Encontrado por el título: «${esc(o.title)}»${o.year ? ` (${esc(o.year)})` : ''}. Comprueba que es el mismo trabajo.</p>`)
      + (L.length ? '<p>Marca lo que quieras añadir:</p>' + L.join('') : '<p>OpenAlex no tiene resumen, citas ni PDF en abierto de este trabajo.</p>')
      + `<div class="row" style="margin-top:12px">${L.length ? '<button class="pri" data-onclick="oaGo()">Añadir</button>' : ''}<button data-onclick="$('#imp').close()">Cancelar</button></div>`;
    $('#imp').innerHTML = h; return; }
  if (m === 'text') h += `<textarea id="iTxt" style="min-height:220px" placeholder="Pega aquí BibTeX, RIS, el texto de ScienceDirect o citas de Google Scholar (una por línea, en APA, MLA, Chicago, Harvard o Vancouver)"></textarea><div class="row" style="margin-top:10px"><button class="pri" data-onclick="impText($('#iTxt').value)">Analizar</button>${close}</div>`;
  else if (m === 'pick') h += `<p>Resultados de CrossRef para «${esc(IMP.q)}». Elige el que buscas:</p><div class="ilist">${IMP.refs.map((r, i) => `<div class="irow"><span><b>${esc(r.title)}</b>${r.dup ? ' <span class="tag-dup">Duplicado</span>' : r.near ? ` <span class="tag-dup" title="Parecido a «${esc(r.near)}»">Parecido</span>` : ''}<br><small>${esc(r.authors.slice(0, 3).join('; '))}${r.authors.length > 3 ? ' et al.' : ''}${r.year ? ' (' + esc(r.year) + ')' : ''}${r.venue ? ' · ' + esc(r.venue) : ''}</small></span><button class="sm" style="margin-left:auto" data-onclick="impPick(${i})">Elegir</button></div>`).join('')}</div><div class="row" style="margin-top:10px"><button data-onclick="openImport('doi')">← Buscar otra cosa</button>${close}</div>`;
  else if (m === 'doi') h += `<p class="empty" style="margin-top:0">Escribe un DOI, un ISBN (libros, en Open Library) o el título (CrossRef te propone varios resultados).</p><div class="row"><input id="iDoi" style="flex:1" placeholder="DOI, ISBN o título" aria-label="DOI, ISBN o título" data-onkeydown="onEnter(event,impDoi)"><button class="pri" data-onclick="impDoi()">Buscar</button></div><p id="iMsg" class="empty"></p>${close}`;
  else if (m === 'fill') {
    const j = v => Array.isArray(v) ? v.join('; ') : String(v ?? ''), r = IMP.ref, cur = k => j(D[k]), nw = k => j(r[k]), L = FLD.filter(([k]) => nw(k) && nw(k) !== cur(k) && (!FLD_T[k] || shows(k, r.type)));
    h += (L.length ? '<p>Marca los datos que quieras aplicar (por defecto, solo los campos vacíos):</p>' + L.map(([k, t]) => `<label class="irow"><input type="checkbox" id="f_${k}" ${cur(k) ? '' : 'checked'}><span><b>${t}</b><br><small>Ahora: ${esc(cur(k)) || '—'}</small><br><small>CrossRef: ${esc(nw(k))}</small></span></label>`).join('') : '<p>CrossRef no aporta datos nuevos.</p>')
      + `<div class="row" style="margin-top:12px"><button class="pri" data-onclick="fillGo()">Aplicar</button>${close}</div>`;
  } else {
    const R = IMP.refs, nd = R.filter(r => r.dup || r.near).length;
    h += `<p>${R.length} encontrados${nd ? ` · ${nd} posibles duplicados (desmarcados)` : ''}</p><div class="ilist">${R.map((r, i) => `<label class="irow"><input type="checkbox" ${r.on ? 'checked' : ''} ${r.bad ? 'disabled' : ''} data-onchange="impOn(${i},this.checked)"><span><b>${esc(r.title || '(sin título)')}</b>${r.dup ? ' <span class="tag-dup">Duplicado</span>' : r.near ? ` <span class="tag-dup" title="Parecido a «${esc(r.near)}»">Parecido</span>` : ''}${r.bad ? ' <span class="tag-dup">No legible</span>' : ''}<br><small>${esc(r.authors.join('; '))}${r.year ? ' · ' + esc(r.year) : ''}${r.venue ? ' · ' + esc(r.venue) : ''}</small></span></label>`).join('')}</div>
      <div class="grid" style="margin-top:10px"><label>Sección<select id="iSec"><option value="">(ninguna)</option>${db.sections.map(s => `<option value="${s.id}" ${F.sec === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label>Etiqueta<select id="iTag"><option value="">(ninguna)</option>${db.tags.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <label>Estado de lectura<select id="iRd">${Object.entries(READ).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:12px"><button class="pri" id="iGo" data-onclick="impGo()"></button>${close}</div>`;
  }
  $('#imp').innerHTML = h;
  if (m === 'doi') $('#iDoi').focus(); if (m === 'prev') impCount();
}
const impCount = () => $('#iGo').textContent = 'Importar ' + IMP.refs.filter(r => r.on).length;
function impGo() {
  const L = IMP.refs.filter(r => r.on); if (!L.length) return say('No hay ninguna referencia marcada.');
  const sec = $('#iSec').value, tag = $('#iTag').value, rd = $('#iRd').value, now = new Date().toISOString();
  L.forEach(r => db.papers.push(NEWF({id: uid(), created: now, title: r.title, alias: '', reading: rd, rating: 0, sectionIds: sec ? [sec] : [], authors: r.authors, year: r.year ? +r.year : '', url: r.url || '', type: r.type,
    venue: r.venue || '', doi: r.doi || '', ...Object.fromEntries(IMP_F.filter(k => r[k] != null).map(k => [k, r[k]])), general: r.general || '', tagIds: tag ? [tag] : [], notes: [], cites: {}, related: [], refTo: [], history: [{t: now, s: 'Importado'}]})));
  markDirty(); $('#imp').close(); render(); toast(`Se añadieron ${L.length === 1 ? "1 paper" : L.length + " papers"}.`, [{t: "Deshacer", fn: undo}], 6000);   // una sola operación: un único Ctrl+Z la deshace
}
async function doiFill() {   // botón «Buscar» junto al DOI en la ventana de editar
  try { IMP = {mode: 'fill', ref: await fetchDoi(D.doi)}; impDraw(); $('#imp').showModal(); } catch (e) { say(e.message); }
}
/* ---- Completar con OpenAlex (gratuito, sin clave): resumen, número de citas y PDF en abierto ---- */
const oaAbstract = ix => { if (!ix || typeof ix !== 'object') return ''; const w = []; for (const [t, ps] of Object.entries(ix)) for (const i of ps) w[i] = t; return cleanText(w.filter(Boolean).join(' ')); };
async function fetchOpenAlex(doi, title) {
  const d = normDoi(doi), sel = 'select=id,doi,title,publication_year,cited_by_count,abstract_inverted_index,open_access,best_oa_location';
  let w;
  if (d) { try { w = await apiJson(`https://api.openalex.org/works/doi:${encodeURIComponent(d)}?${sel}`, 'OpenAlex'); } catch (e) { if (!/\(404\)/.test(e.message)) throw e; } }
  if (!w && String(title || '').trim().length > 5) w = (await apiJson(`https://api.openalex.org/works?per-page=1&${sel}&search=${encodeURIComponent(title)}`, 'OpenAlex')).results?.[0];
  if (!w) throw Error(d ? 'OpenAlex no encuentra ese DOI.' : 'OpenAlex no encuentra ese título.');
  const pdf = w.best_oa_location?.pdf_url || w.open_access?.oa_url || '';
  return {title: cleanText(w.title), year: w.publication_year || '', cites: Number.isInteger(w.cited_by_count) ? w.cited_by_count : null, abstract: oaAbstract(w.abstract_inverted_index), pdf: /^https?:/i.test(pdf) ? pdf : '', byDoi: !!d && normDoi(w.doi) === d};
}
async function oaFill() {   // botón «OpenAlex» junto al DOI en la ventana de editar
  try { IMP = {mode: 'oa', oa: await fetchOpenAlex(D.doi, D.title)}; impDraw(); $('#imp').showModal(); } catch (e) { say(e.message); }
}
function oaGo() {
  const o = IMP.oa, add = s => { D.general = D.general ? D.general.replace(/\s+$/, '') + '\n\n' + s : s; };
  if ($('#oa_abs')?.checked) add('**Resumen:** ' + o.abstract);
  if ($('#oa_cit')?.checked) add(`**Citas** (OpenAlex, ${new Date().toISOString().slice(0, 10)}): ${o.cites}`);
  if ($('#oa_pdf')?.checked) { if (!D.url) D.url = o.pdf; else add('**PDF en abierto:** ' + o.pdf); }
  $('#imp').close(); drawD();
}
function fillGo() {
  const r = IMP.ref;
  for (const [k] of FLD) if ($('#f_' + k)?.checked) D[k] = k === 'year' ? +r.year || '' : r[k];
  if ($('#f_authors')?.checked && r.authorType === 'entidad' && D.authorType === 'auto') D.authorType = 'entidad';
  D.doi = r.doi; $('#imp').close(); drawD();
}
function openMenu(e) { ctxShow(e, `<div class="ctxh">Importar referencias</div><button data-onclick="openImport('file')">📄 Desde archivo (.bib, .ris, .txt o CSL-JSON)</button><button data-onclick="openImport('text')">📋 Pegar BibTeX, RIS o citas de Google Scholar</button><button data-onclick="openImport('doi')">🔎 Buscar por DOI, ISBN o título</button><button data-onclick="ctxClose();inboxPick()">🗃️ PDF sin cita (bandeja «PDF por citar»)</button>`); }
/* ---- Compartir con GPapers (Android: «Compartir» desde el navegador o la app de la revista; ver share_target en manifest.json) ----
   Llega como index.html?title=…&text=…&url=…: se busca un DOI (o un ISBN) en lo compartido y, si no hay, el título de la página. */
const DOI_RE = /\b10\.\d{4,9}\/[^\s"<>]+/;
function shareIn() {
  let P; try { P = new URL(location.href).searchParams; } catch (e) { return; }
  const t = P.get('title') || '', x = P.get('text') || '', l = P.get('url') || ''; if (!t && !x && !l) return false;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  let all = [l, x, t].join(' '); try { all = decodeURIComponent(all); } catch (e) {}
  const doi = (all.match(DOI_RE) || [''])[0].replace(/[.,;:)\]}>'"]+$/, '').replace(/\/(full|abstract|pdf|epdf)$/i, '');
  const isbn = [x, t].map(isIsbn).find(Boolean);
  const q = doi || isbn || (t || x.replace(/https?:\/\/\S+/g, '')).trim() || l;
  openImport('doi'); $('#iDoi').value = q; if (q) impDoi();
  return true;
}
/* ---- Soltar archivos en la ventana: .bib, .ris, .txt o CSL-JSON → Importar; un JSON de la aplicación → se abre como proyecto ---- */
const fileDrag = e => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragover', e => { if (!fileDrag(e) || document.querySelector('dialog[open]')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; document.body.classList.add('fdrop'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget || e.relatedTarget === document.documentElement) document.body.classList.remove('fdrop'); });
document.addEventListener('drop', async e => {
  document.body.classList.remove('fdrop');
  if (!fileDrag(e) || document.querySelector('dialog[open]') || TAB.passive) return; e.preventDefault();
  const its = [...e.dataTransfer.items].filter(i => i.kind === 'file'), hps = its.map(i => FSA ? i.getAsFileSystemHandle?.() : null), it = its[0], hp = hps[0], f = e.dataTransfer.files[0]; if (!f) return;   // el enlace al archivo se pide antes de cualquier await
  const name = f.name, ext = (name.match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
  const pdfs = [...e.dataTransfer.files].map((file, i) => ({file, hp: hps[i]})).filter(x => /\.pdf$/i.test(x.file.name) || x.file.type === 'application/pdf');
  if (pdfs.length) return inboxAdd(await Promise.all(pdfs.map(async x => { let h = null; try { h = await x.hp; if (h && h.kind !== 'file') h = null; } catch (err) {} return {file: x.file, h}; })));   // PDF soltados: a la bandeja «PDF por citar»
  if (!['json', 'bib', 'ris', 'txt'].includes(ext)) return toast('Suelta un archivo .bib, .ris, .txt, CSL-JSON o un proyecto .json.', [], 5000);
  let text; try { text = await f.text(); } catch (err) { return say('No se pudo leer el archivo: ' + err.message); }
  if (ext === 'json' && !isCsl(text)) { let h = null; try { h = FSA ? await hp : null; if (h && h.kind !== 'file') h = null; } catch (err) {} return pjOpenFile(text, name, h); }
  impText(text);
});
