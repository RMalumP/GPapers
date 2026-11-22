'use strict';
/* ===== Visor de PDF y EPUB: modo Sencillo o Completo y funciones a elegir (v40.10) =====
   · Sencillo: subrayar, notas, índice, doble página, página a página, desplazamiento automático, pantalla completa, buscar, modo noche,
     candado del tamaño y recorte de márgenes. Completo: todo.
   · Cada modo tiene sus casillas, independientes: quitar algo del Sencillo no lo quita del Completo, y al revés.
   · Se elige en Configuración → Apariencia → «Visor de PDF y EPUB» (las dos columnas) y en ⚙ Ajustes del visor (el modo y las casillas del modo que se usa).
   · Mientras no se elige, el visor sigue al modo de la app (settings.uiMode).
   · Una función apagada pierde sus botones, menús y atajos; si estaba en marcha (recorte, columna a columna, regla…) se para. No se borra nada.
   Se guarda en el JSON: settings.vwMode ('' sigue a la app | 'simple' | 'full') y settings.vwFeat = {s: {id: bool}, f: {id: bool}}
   (solo lo que cambia respecto al modo de serie). Los botones llevan data-vf="id" y una regla de CSS los esconde (vfApply). */
/* El catálogo (VF, VF_GROUPS, VF_BY) y vfNorm están en js/modelo.js: también los usa el hilo aparte (js/trabajo.js) al normalizar el JSON. */
const vfMode = () => { const m = db.settings.vwMode; return m === 'simple' || m === 'full' ? m : db.settings.uiMode === 'simple' ? 'simple' : 'full'; };
const vfK = m => (m || vfMode()) === 'simple' ? 's' : 'f';
function vfOnIn(m, id) { const f = VF_BY[id]; if (!f) return true; const k = vfK(m), o = db.settings.vwFeat?.[k]; return o && typeof o[id] === 'boolean' ? o[id] : k === 'f' || !!f[3]; }
const vfOn = id => vfOnIn(null, id);
const vfH = (id, h) => vfOn(id) ? h : '';   // un trozo de menú, solo si la función está encendida
function vfApply() {   // esconde los botones de lo apagado y para lo que estaba en marcha
  let st = $('#vfCss'); if (!st) { st = document.createElement('style'); st.id = 'vfCss'; document.head.append(st); }
  const off = VF.filter(f => !vfOn(f[0])).map(f => f[0]);
  if (['cite', 'ustyle', 'web', 'say'].every(id => off.includes(id))) off.push('selm');   // el ⋯ de la barra de la selección se quedaría vacío
  st.textContent = off.length ? off.map(id => id === 'selm' ? '.vwselm' : `[data-vf~="${id}"]`).join(',') + '{display:none!important}' : '';
  document.documentElement.dataset.vwmode = vfMode();
  if (typeof VW !== 'undefined' && VW.open) vfStopPdf();
  if (typeof EP !== 'undefined' && EP.open) vfStopEp();
}
function vfStopPdf() {
  try {
    if (!vfOn('area') && VW.mode === 'area' || !vfOn('note') && VW.mode === 'note' || !vfOn('ink') && VW.mode === 'ink') vwMode('sel');
    if (!vfOn('auto') && VW.auto) vwAutoStop();
    if (!vfOn('conc')) vwConcShow();
    if (!vfOn('col') && VW.col) { VW.col = false; VX.seg = null; $('#vw').classList.remove('vxcol'); VW.fit = true; vwFitW(); }
    if (!vfOn('lock') && VW.zLock) vwLockSet(false, true);
    if (!vfOn('flip') && VW.flip) vwRdSet('flip', 0);
    if (!vfOn('two') && VW.two) vwRdSet('two', 0);
    if (!vfOn('crop') && VW.crop) vwRdSet('crop', 0);
    vxRlShow();
    if (!vfOn('flow') && vxFlowShown()) vxFlowClose();
    if (!vfOn('say') && SAY.on && !SAY.ep) sayStop();
    if (!vfOn('fs') && VW.fs) vwFs(false);
    if (!vfOn('p2') && P2.doc) p2Close();
    if (!vfOn('diff') && VX.diff) vxDiffClear();
    if (!vfOn('fwd')) { LN.fwd = []; lnBackShow(); }
    if (VW.side && (!vfOn('toc') && (VW.tab === 'toc' || VW.tab === 'th') || !vfOn('fig') && VW.tab === 'fig' || !vfOn('findL') && VW.tab === 'find')) vwTab('ann');
    else if (VW.side) vwSideDraw();   // las pestañas del panel (Figuras, Índice…) también siguen al modo
    vwRdClass(); vxMapDraw(); lnLeftShow(); vwNightApply();
  } catch (e) { console.warn('vfStopPdf', e); }
}
function vfStopEp() {
  try {
    if (!vfOn('auto') && EP.auto) epAutoStop();
    if (!vfOn('conc') && EP.auto) epAutoShow();
    epSetApply(true);   // epSet ya no da la doble página ni página a página si están apagadas
    if (!vfOn('say') && SAY.on && SAY.ep) sayStop();
    if (!vfOn('fs') && EP.fs) epFs(false);
    if (EP.side && !vfOn('toc') && EP.tab === 'toc') epTab('ann'); else if (EP.side) epSideDraw();
    lnLeftShow();
  } catch (e) { console.warn('vfStopEp', e); }
}
function vfChanged(msg) { markDirty(); vfApply(); if ($('#cfg')?.open) drawCfg(); if (msg) toast(msg, [], 1800); }
function vfModeSet(m) { db.settings.vwMode = m === 'simple' ? 'simple' : 'full'; vfChanged(`Visor ${m === 'simple' ? 'sencillo' : 'completo'}.`); }
function vfSet(m, id, on) {   // m: 'simple' | 'full'
  const k = vfK(m), f = VF_BY[id]; if (!f) return; const o = db.settings.vwFeat ||= {s: {}, f: {}}; o[k] ||= {};
  const def = k === 'f' || !!f[3]; if (!!on === def) delete o[k][id]; else o[k][id] = !!on; vfChanged();
}
function vfReset(m) { const o = db.settings.vwFeat ||= {s: {}, f: {}}; o[vfK(m)] = {}; vfChanged(`Visor ${m === 'simple' ? 'sencillo' : 'completo'}: funciones de serie.`); }
const vfCustom = m => Object.keys(db.settings.vwFeat?.[vfK(m)] || {}).length > 0;
const vfCount = m => VF.filter(f => vfOnIn(m, f[0])).length;

/* ---- Configuración → Apariencia ---- */
function vfCfgHtml() {
  const m = vfMode(), seg = `<div class="seg" role="group" aria-label="Modo del visor"><button class="${m === 'simple' ? 'on' : ''}" aria-pressed="${m === 'simple'}" data-onclick="vfModeSet('simple')">Sencillo</button><button class="${m === 'full' ? 'on' : ''}" aria-pressed="${m === 'full'}" data-onclick="vfModeSet('full')">Completo</button></div>`;
  const sum = `${m === 'simple' ? 'Sencillo' : 'Completo'}: ${vfCount(m)} de ${VF.length} funciones${vfCustom(m) ? ' (a tu gusto)' : ''}.${db.settings.vwMode ? '' : ' Sigue al modo de la app mientras no elijas.'}`;
  const row = f => ci(`<div class="vfrow"><span class="vfn">${esc(f[2])}${f[4] ? `<small>${esc(f[4])}</small>` : ''}</span>${['simple', 'full'].map(mm => `<label class="vfc" title="${mm === 'simple' ? 'Visor sencillo' : 'Visor completo'}"><input type="checkbox" ${vfOnIn(mm, f[0]) ? 'checked' : ''} data-onchange="vfSet('${mm}','${f[0]}',this.checked)" aria-label="${esc(f[2])} en el visor ${mm === 'simple' ? 'sencillo' : 'completo'}"></label>`).join('')}</div>`);
  const body = VF_GROUPS.map(([g, t]) => `<div class="vfg"><div class="vfrow vfhd"><b>${t}</b><small>Sencillo</small><small>Completo</small></div>${VF.filter(f => f[1] === g).map(row).join('')}</div>`).join('');
  return ci(`<div class="dmode cmode">${seg}<small>${sum}${hlp('Subrayar en colores, comentar, copiar, el panel de anotaciones, ↩ Volver, el PDF anotado y recordar dónde ibas están siempre. Apagar una función esconde sus botones, menús y atajos; no borra nada de lo que ya hiciste con ella. Se guarda en el JSON del proyecto y llega a tus otros dispositivos.')}</small></div>`)
    + `<details class="cs vffun" ${CFG_OPEN.has('vf') ? 'open' : ''} data-ontoggle="setHas(CFG_OPEN,'vf',this.open)"><summary>Elegir funciones</summary><div class="csb"><p class="cfgnote2"><small>Cada columna es independiente: lo que quitas del Sencillo sigue en el Completo, y al revés.</small></p>${body}
      ${ci(`<p class="row vfrs"><button data-onclick="vfReset('simple')" ${vfCustom('simple') ? '' : 'disabled'}>↺ Sencillo de serie</button><button data-onclick="vfReset('full')" ${vfCustom('full') ? '' : 'disabled'}>↺ Completo de serie</button></p>`)}</div></details>`;
}

/* ---- ⚙ Ajustes del visor: el modo y las casillas del modo que se usa ---- */
function vfMenuHtml(ep) {
  const m = vfMode(), me = ep ? 'epCfgMenu()' : 'vwCfgMenu()';
  return `<div class="ctxh">Visor</div><div class="epmrow vfseg">${[['simple', 'Sencillo'], ['full', 'Completo']].map(([v, t]) => `<button data-keep class="${m === v ? 'on' : ''}" aria-pressed="${m === v}" data-onclick="vfModeSet('${v}');${me}">${t}</button>`).join('')}</div>
    <button data-keep data-onclick="vfFunMenu(${ep ? 'true' : 'false'})">☑ Elegir funciones <small class="vwsub">${vfCount(m)} de ${VF.length} ›</small></button>`;
}
function vfFunMenu(ep) {
  const m = vfMode(), me = `vfFunMenu(${ep ? 'true' : 'false'})`, menu = ep ? epMenu : vwMenu, R = ep ? EP.menuR : VW.menuR;
  const items = VF_GROUPS.map(([g, t]) => `<div class="ctxh">${t}</div>${VF.filter(f => f[1] === g).map(f => { const on = vfOnIn(m, f[0]); return `<button data-keep role="menuitemcheckbox" aria-checked="${on}" data-onclick="vfSet('${m}','${f[0]}',${on ? 0 : 1});${me}">${tick(on)}${esc(f[2])}</button>`; }).join('')}`).join('<hr>');
  menu(R, `<button data-keep data-onclick="${ep ? 'epCfgMenu()' : 'vwCfgMenu()'}">‹ Volver</button><hr><div class="vwhint">Visor ${m === 'simple' ? 'sencillo' : 'completo'}: lo que quites aquí sigue en el ${m === 'simple' ? 'completo' : 'sencillo'}. Las dos columnas están en Configuración → Apariencia.</div><hr>${items}
    ${vfCustom(m) ? `<hr><button data-keep data-onclick="vfReset('${m}');${me}">↺ Funciones de serie</button>` : ''}`);
}

/* ---- Atajos de una letra (PDF y EPUB): los de una función apagada no hacen nada ni salen en la lista ---- */
const VF_KEY = {r: 'area', n: 'note', i: 'toc', e: 'notes', f: 'fs', d: 'two', p: 'flip', k: 'lock', a: 'auto', c: 'conc', m: 'rl', t: 'flow', b: 'bm', '[': 'bm', ']': 'bm'};
const vfKey = k => !VF_KEY[k] || vfOn(VF_KEY[k]);
