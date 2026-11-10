'use strict';
try { const t = localStorage.getItem('gp-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch (e) {}   // tema elegido a mano (ver setTheme en js/config.js): antes de pintar, sin parpadeo
/* ===== Interfaz para móviles =====
   Solo se activa en pantallas táctiles estrechas (o un móvil en horizontal): pone la clase «mv» en <html> y todo lo de movil.css va detrás de ella.
   En el ordenador (ratón o ventana ancha) no cambia nada: no se crea ningún elemento y no se toca ninguna función.
   No duplica lógica: reutiliza los botones y funciones de siempre y solo los coloca de otra forma (panel lateral, barra inferior, menú ⋯). */
const MV_Q = matchMedia('(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 500px)');
const mvOn = () => MV_Q.matches;
document.documentElement.classList.toggle('mv', mvOn());   // antes de pintar: sin parpadeo del diseño de escritorio
// pantallas táctiles de cualquier tamaño (p. ej. tablet en horizontal): Sección ▾ y Etiquetas ▾ abren su menú y sus filas van debajo, como en el móvil
const TB_Q = matchMedia('(pointer: coarse)'), tbOn = () => mvOn() || TB_Q.matches;
document.documentElement.classList.toggle('tb', tbOn());
TB_Q.addEventListener('change', () => document.documentElement.classList.toggle('tb', tbOn()));

let MV_BUILT = false;
const mv$ = s => document.querySelector(s);
function mvDrawer(open) {   // la barra lateral, como panel que entra desde la izquierda
  const on = open ?? !document.documentElement.classList.contains('mv-dr');
  if (on) mvMore(false);
  document.documentElement.classList.toggle('mv-dr', on);
  mv$('#side')?.setAttribute('aria-hidden', String(!on)); mv$('#mvMenuBtn')?.setAttribute('aria-expanded', String(on));
  if (on) mvCount();
}
function mvMore(open) {   // menú ⋯ de la cabecera (Google Drive, Guardar, Importar, Exportar y Archivo)
  const on = open ?? !document.documentElement.classList.contains('mv-mo');
  if (on) mvDrawer(false);
  document.documentElement.classList.toggle('mv-mo', on); mv$('#mvMoreBtn')?.setAttribute('aria-expanded', String(on));
}
function mvClose() { mvDrawer(false); mvMore(false); }
function mvFilters() {   // botón «Filtros»: abre el panel con el grupo de filtros desplegado
  mvDrawer(true); const g = mv$('#sg-filt'); if (g) g.classList.remove('fold'); mv$('#side').classList.remove('min');
  g?.scrollIntoView({block: 'start'});
}
function mvCount() { const c = mv$('#count'), b = mv$('#mvSeeBtn'); if (!c || !b) return; const t = 'Ver resultados · ' + c.textContent.split('·')[0].trim(); if (b.textContent !== t) b.textContent = t; }
function mvDots() {   // punto en el botón de filtros del buscador si hay algún filtro activo (el mismo aviso que ya da la barra)
  const on = !!mv$('#d-filt:not([hidden])') || !!mv$('#d-adv:not([hidden])') || !mv$('#actF')?.hidden;
  document.querySelectorAll('.mvfd').forEach(d => { if (d.hidden === on) d.hidden = !on; });   // solo si cambia: si no, los observadores se llamarían sin fin
}
function mvImport() {   // 📥 de la barra inferior: el mismo menú «Importar referencias» de la cabecera, encima de la barra
  mvClose(); const b = mv$('#mvNav [data-mv=imp]').getBoundingClientRect();
  openMenu({preventDefault() {}, stopPropagation() {}, clientX: b.right, clientY: 0});
  const m = mv$('#ctx'); m.style.top = Math.max(8, mv$('#mvNav').getBoundingClientRect().top - m.offsetHeight - 6) + 'px';
}
function mvInbox() {   // 🗃️ de la barra inferior: con la bandeja como botón la muestra u oculta; si no, la despliega y la enseña
  mvClose(); if (db.settings.inboxBtn) return ibToggle();
  if (ibFold()) ibFoldSet(false); setTimeout(() => mv$('#inbox')?.scrollIntoView({block: 'nearest', behavior: 'smooth'}), 30);
}
/* Sección ▾ y Etiquetas ▾ de la fila de la lista: en el móvil abren un menú con mostrarlas debajo, agrupar (o cómo combinar) y la lista para elegir.
   El menú se queda abierto al elegir etiquetas (se pueden marcar varias) y se cierra al elegir una sección (solo hay una a la vez). */
function mvFMenu(k) {
  const b = mv$(k === 'sec' ? '#tbSec' : '#tbTag').getBoundingClientRect(), m0 = mv$('#ctx'), keep = m0 && !m0.hidden && m0.dataset.mvf === k ? m0.scrollTop : -1;
  const cnt = new Map(); let none = 0;
  db.papers.forEach(p => { let n = 0; (k === 'sec' ? p.sectionIds : p.tagIds).forEach(i => { if ((k === 'sec' ? secById : tagById)(i)) { n = 1; cnt.set(i, (cnt.get(i) || 0) + 1); } }); none += !n; });
  const sw = c => `<span class="mvsw" style="background:${esc(c || '#888888')}"></span>`, num = n => `<span class="mvn">${n}</span>`, N = db.papers.length;
  const it = (on, label, fn, n, c, ex) => `<button${ex ? ' class="ex"' : ''} data-onclick="${fn}">${tick(on)}${c ? sw(c) : ''}<span>${label}</span>${n != null ? num(n) : ''}</button>`;
  let h;
  if (k === 'sec') {
    h = '<div class="ctxh">Secciones</div>' + it(F.tbSec, 'Mostrarlas debajo', "mvFAct('sec','show')") + it(F.group, 'Agrupar por sección', "mvFAct('sec','group')") + (F.group ? it(false, '▸ Plegar todas', 'gFoldAll(1)') + it(false, '▾ Desplegar todas', 'gFoldAll(0)') : '')
      + '<hr>' + it(!F.secs.size && !F.noSec, 'Todas', "mvFAct('sec','pick','')", N, '#888888')
      + db.sections.map(x => it(F.secs.has(x.id), esc(x.name), `mvFAct('sec','pick','${x.id}')`, cnt.get(x.id) || 0, x.color)).join('')
      + (db.sections.length ? it(F.noSec, 'Sin sección', "mvFAct('sec','none')", none, '#888888') : '<div class="ctxh">Aún no hay secciones.</div>')
      + `<hr><button data-onclick="ctxClose();openMg('sections')">✎ Gestionar secciones</button>`;
  } else {
    h = '<div class="ctxh">Etiquetas</div>' + it(F.tbTag, 'Mostrarlas debajo', "mvFAct('tag','show')")
      + '<hr><div class="ctxh">Si eliges varias, mostrar los papers con…</div>' + [['any', 'Al menos una'], ['all', 'Todas']].map(([v, l]) => it(F.mode === v, l, `mvFAct('tag','mode','${v}')`)).join('')
      + '<hr>' + (db.tags.length ? it(!F.tags.size && !F.exTags.size && !F.noTag, 'Todas', "mvFAct('tag','all')", N, '#888888')
        + db.tags.map(t => it(F.tags.has(t.id), esc(t.name), `mvFAct('tag','pick','${t.id}')`, cnt.get(t.id) || 0, t.color, F.exTags.has(t.id))).join('')
        + it(F.noTag, 'Sin etiquetas', "mvFAct('tag','none')", none, '#888888') : '<div class="ctxh">Aún no hay etiquetas.</div>')
      + `<hr><button data-onclick="ctxClose();openMg('tags')">✎ Gestionar etiquetas</button>`;
  }
  ctxShow({preventDefault() {}, stopPropagation() {}, clientX: b.left, clientY: b.bottom + 4}, h);
  const m = mv$('#ctx'); m.classList.add('mvfm'); m.dataset.mvf = k;
  m.style.top = Math.max(8, Math.min(b.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
  if (keep >= 0) m.scrollTop = keep;
}
function mvFAct(k, a, v) {   // una opción del menú; al elegir una sección se cierra, lo demás se vuelve a pintar abierto
  if (k === 'sec') { if (a === 'show') F.tbSec = !F.tbSec; else if (a === 'group') F.group = !F.group; else if (a === 'pick') setSecF(v); else if (a === 'none') noSecF(); }
  else { if (a === 'show') F.tbTag = !F.tbTag; else if (a === 'mode') F.mode = v; else if (a === 'all') tagsAll(); else if (a === 'pick') toggleF(v); else if (a === 'none') noTagF(); }
  if (a === 'show' || a === 'group' || a === 'mode') render();
  if (k === 'sec' && (a === 'none' || a === 'pick' && !v)) return ctxClose();   // elegir secciones deja el menú abierto para marcar varias
  const st = mv$('#ctx')?.scrollTop || 0;   // después del clic: si no, el aviso de «clic fuera del menú» (el botón pulsado ya no existe) lo cerraría
  setTimeout(() => { mvFMenu(k); mv$('#ctx').scrollTop = st; });
}
function mvSearchDock() { const q = mv$('#q'), box = mv$('#mvSearch'); if (mvOn() && q && box && q.parentElement !== box) box.prepend(q); }

function mvBuild() {
  if (MV_BUILT) return; MV_BUILT = true;
  const hdr = mv$('header'), side = mv$('#side'), main = mv$('main');
  // Cabecera: ☰ al principio y ⋯ al final; los botones de la cabecera pasan al menú ⋯
  hdr.insertAdjacentHTML('afterbegin', '<button id="mvMenuBtn" class="mvib" aria-label="Menú" aria-expanded="false" aria-controls="side">☰</button>');
  hdr.insertAdjacentHTML('beforeend', '<button id="mvMoreBtn" class="mvib" aria-label="Más acciones" aria-expanded="false">⋯</button>');
  hdr.querySelector('.row').id = 'mvHdrRow';
  // Panel lateral: cabecera con cerrar y botón fijo para volver a la lista
  side.insertAdjacentHTML('afterbegin', '<div class="mvdh"><b>Menú</b><button class="mvib" data-mv="close" aria-label="Cerrar menú">✕</button></div>');
  side.insertAdjacentHTML('beforeend', '<div class="mvdf"><button class="pri" id="mvSeeBtn" data-mv="close">Ver resultados</button></div>');
  document.body.insertAdjacentHTML('beforeend', '<div id="mvShade" data-mv="close" hidden></div>');
  // Buscador fijo encima de la lista, con acceso a los filtros
  main.insertAdjacentHTML('afterbegin', '<div id="mvTop"><div id="mvSearch"><button class="mvib" data-mv="filt" aria-label="Filtros">🎚️<span class="dot mvfd" hidden></span></button></div></div>');
  // Barra inferior
  document.body.insertAdjacentHTML('beforeend', `<nav id="mvNav" aria-label="Navegación principal">
    <div class="mvns"><button data-mv="top"><span class="ic">📚</span><span>Papers</span></button>
    <button id="mvIb" data-mv="ib" aria-label="PDF por citar" aria-pressed="false" hidden><span class="ic">🗃️<b></b></span><span>PDF</span></button>
    <button data-mv="cfg" aria-label="Configuración"><span class="ic">⚙️</span><span class="mvl"></span></button></div>
    <button class="mvnew" data-mv="new" aria-label="Nuevo paper"><span class="ic">＋</span><span>Nuevo</span></button>
    <div class="mvns"><button data-mv="exp"><span class="ic">📤</span><span>Exportar</span></button>
    <button data-mv="imp" aria-label="Importar"><span class="ic">📥</span><span>Importar</span></button>
    <button data-mv="more"><span class="ic">⋯</span><span>Más</span></button></div></nav>`);
  mvSearchDock();

  const act = {dx: () => { const d = [...document.querySelectorAll('dialog[open]')].pop(); if (d && d.dispatchEvent(new Event('cancel', {cancelable: true}))) d.close(); }, close: mvClose, filt: mvFilters, cfg: () => { mvClose(); openCfg(); }, more: () => mvMore(), new: () => { mvClose(); openPaper(); }, exp: () => { mvClose(); openEx(); }, imp: mvImport, ib: mvInbox, top: () => { mvClose(); scrollTo({top: 0, behavior: 'smooth'}); }};
  document.addEventListener('click', e => {
    if (!mvOn()) return;
    const b = e.target.closest('[data-mv]'); if (b) { act[b.dataset.mv]?.(); return; }
    if (e.target.closest('#mvMenuBtn')) return mvDrawer();
    if (e.target.closest('#mvMoreBtn')) { e.stopPropagation(); return mvMore(); }
    // en el menú ⋯, cualquier acción lo cierra (salvo la casilla de autoguardado)
    if (e.target.closest('#mvHdrRow button') && !e.target.closest('#fmBtn')) setTimeout(() => mvMore(false));
    // en el panel lateral, lo que abre una ventana cierra el panel
    if (e.target.closest('#side')) setTimeout(() => { if (mv$('dialog[open]')) mvDrawer(false); mvCount(); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && mvOn()) mvClose(); });
  // tocar la miniatura de un paper la amplía en una ventana emergente; un toque en cualquier sitio la cierra
  const zoomClose = () => { document.getElementById('mvZoom')?.remove(); };
  document.addEventListener('click', e => {
    if (!mvOn()) return;
    if (e.target.closest('#mvZoom')) { e.stopPropagation(); return zoomClose(); }
    const im = e.target.closest('#list .pimg')?.querySelector('img'); if (!im?.src) return;
    e.stopPropagation(); e.preventDefault(); zoomClose();
    const z = document.createElement('div'); z.id = 'mvZoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Imagen del paper (toca para cerrar)');
    const big = document.createElement('img'); big.src = im.src; big.alt = ''; z.append(big); document.body.append(z);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zoomClose(); });
  // la búsqueda se queda arriba aunque la barra se pliegue o despliegue (este observador va después del de lista.js)
  new MutationObserver(mvSearchDock).observe(side, {attributes: true, attributeFilter: ['class']});
  new MutationObserver(() => { mvDots(); mvCount(); }).observe(main, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});
  new MutationObserver(mvDots).observe(side, {subtree: true, attributes: true, attributeFilter: ['hidden']});
  mvDots();
  // ventanas sin cabecera propia (Exportar, Importar…): un ✕ arriba, porque a pantalla completa no hay «fuera» donde pulsar
  const dx = d => { if (!mvOn() || !d.open || d.querySelector(':scope > .dh, :scope > .mvdx')) return;
    d.insertAdjacentHTML('afterbegin', '<button class="mvdx" data-mv="dx" aria-label="Cerrar">✕</button>'); };
  document.querySelectorAll('dialog').forEach(d => new MutationObserver(() => dx(d)).observe(d, {childList: true, attributes: true, attributeFilter: ['open']}));
  // pulsación larga = clic derecho (en iPhone no existe; en Android ya lo hace el navegador y no se repite)
  let lp = 0, lpEv = null, lpDone = false;
  document.addEventListener('touchstart', e => {
    lpDone = false; if (!mvOn() || e.touches.length !== 1) return; const t = e.target.closest('[data-oncontextmenu]'); if (!t) return;
    const {clientX, clientY} = e.touches[0]; clearTimeout(lp);
    lp = setTimeout(() => { lpDone = true; lpEv = t.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX, clientY})); navigator.vibrate?.(15); }, 550);
  }, {passive: true});
  ['touchmove', 'touchend', 'touchcancel'].forEach(k => document.addEventListener(k, () => clearTimeout(lp), {passive: true}));
  document.addEventListener('contextmenu', e => { if (e.isTrusted) clearTimeout(lp); if (e.isTrusted && lpDone && mvOn()) e.preventDefault(); }, true);
  document.addEventListener('click', e => { if (lpDone && mvOn()) { lpDone = false; e.preventDefault(); e.stopPropagation(); } }, true);   // el toque que abrió el menú no hace además clic
}
function mvApply() {
  const on = mvOn(); document.documentElement.classList.toggle('mv', on);
  if (on) mvBuild(); else { mvClose(); if (MV_BUILT && typeof sbSearchDock === 'function') sbSearchDock(); }   // al salir, la búsqueda vuelve a su sitio de siempre
  try { if (db.settings.view === 'table') render(); } catch (e) {}   // la tabla se pinta distinta en el móvil (fichas) y en el ordenador
}
// Sección ▾ y Etiquetas ▾: en el móvil y en pantallas táctiles, menú en vez de solo mostrar u ocultar la fila (va antes que los data-onclick de siempre)
document.addEventListener('click', e => {
  if (!tbOn()) return; const b = e.target.closest('#tbSec, #tbTag'); if (!b) return;
  e.stopPropagation(); e.preventDefault(); const k = b.id === 'tbSec' ? 'sec' : 'tag', m = mv$('#ctx');
  if (m && !m.hidden && m.dataset.mvf === k) return ctxClose(); mvFMenu(k);
}, true);
MV_Q.addEventListener('change', mvApply);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mvApply); else mvApply();

/* ---- Móvil: arrastrar un paper con el dedo: a otra sección (agrupado) o a otra posición (orden manual)
   El arrastre del navegador está apagado en el móvil (si no, al desplazar se arrastraría sin querer). Aquí: mantener pulsado la tarjeta o la fila
   ~0,45 s sin mover el dedo, y luego moverlo: sobre otro paper se coloca antes o después de él; sobre el título de una sección, pasa a ella. */
(() => {
  let T = 0, S = null;   // S: {el, id, from, x, y, on, ghost, over, ins}
  const clr = () => { S?.over?.classList.remove('over'); S?.ins?.el.classList.remove('insB', 'insA'); };
  const end = () => { clearTimeout(T); if (!S) return; clr(); S.el.classList.remove('drag'); S.ghost?.remove(); document.documentElement.classList.remove('mvdrag'); S = null; };
  document.addEventListener('touchstart', e => {
    end(); if (!mvOn() || e.touches.length !== 1) return;
    const el = e.target.closest?.('#list .card[data-id], #list tr.rw[data-id]');
    if (!el || e.target.closest('button, a, input, select, textarea, label, .pimg, [contenteditable], [data-oncontextmenu]')) return;
    const t = e.touches[0]; S = {el, id: el.dataset.id, from: el.dataset.from || '', x: t.clientX, y: t.clientY, on: false};
    T = setTimeout(() => {
      if (!S) return; S.on = true; el.classList.add('drag'); document.documentElement.classList.add('mvdrag'); navigator.vibrate?.(20);
      const p = db.papers.find(q => q.id === S.id), g = document.createElement('div'); g.className = 'mvghost'; const k = SEL.has(S.id) ? SEL.size : 1; g.textContent = '📄 ' + (k > 1 ? k + ' papers' : p ? p.alias || p.title : ''); document.body.append(g); S.ghost = g;
      g.style.left = S.x + 'px'; g.style.top = S.y + 'px';
    }, 450);
  }, {passive: true});
  document.addEventListener('touchmove', e => {
    if (!S) return; const t = e.touches[0];
    if (!S.on) { if (Math.hypot(t.clientX - S.x, t.clientY - S.y) > 10) end(); return; }   // se movió antes: es desplazar la lista
    e.preventDefault(); S.ghost.style.left = t.clientX + 'px'; S.ghost.style.top = t.clientY + 'px';
    const u = document.elementFromPoint(t.clientX, t.clientY), c = u?.closest('#list .card[data-id], #list tr.rw[data-id]'), g = u?.closest('#list .gbox');
    clr(); S.over = null; S.ins = null;
    if (c && c !== S.el) { const r = c.getBoundingClientRect(), after = t.clientY > r.top + r.height / 2; c.classList.add(after ? 'insA' : 'insB'); S.ins = {el: c, after}; }
    else if (g && !c) { S.over = g; g.classList.add('over'); }
    const m = 70, h = innerHeight; if (t.clientY < m) scrollBy(0, -12); else if (t.clientY > h - m - 60) scrollBy(0, 12);   // cerca del borde: la lista se desplaza
  }, {passive: false});
  document.addEventListener('touchend', e => {
    if (!S) return; clearTimeout(T); const {on, over, ins, id, from} = S;
    if (!on) return end();
    e.preventDefault(); end();
    if (ins) { const g = ins.el.closest('.gbox'); paperPlace(id, from, g ? g.dataset.sec : null, ins.el.dataset.id, ins.after); }
    else if (over && over.dataset.sec !== from) movePaper(id, from, over.dataset.sec);
  }, {passive: false});
  document.addEventListener('touchcancel', end, {passive: true});
  document.addEventListener('contextmenu', e => { if (S && mvOn()) e.preventDefault(); }, true);   // la pulsación larga no abre el menú del sistema
})();
