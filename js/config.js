'use strict';
/* ===== Atajos de teclado (editables en Configuración; se guardan en settings.shortcuts) ===== */
let recAct = null;   // acción cuyo atajo se está grabando
function comboOf(e) {   // p. ej. «Ctrl+Shift+Z»; null si solo se ha pulsado un modificador
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
  parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join('+');
}
const SC_ACT = {
  open: () => doOpen(), save: () => save(false), newPaper: () => openPaper(), undo, redo, exportCites: () => openEx(), import: () => openImport('file'), side: () => sbToggle(),
  find: () => { if (!$('#side').classList.contains('min')) $('#sg-search').classList.remove('fold'); $('#q').focus(); }   // con la barra plegada, la búsqueda ya está en la fila de «Nuevo paper»
};
document.addEventListener('keydown', e => {
  if (recAct) return;
  const combo = comboOf(e); if (!combo) return;
  const act = Object.keys(SC_DEF).find(a => db.settings.shortcuts[a] === combo); if (!act) return;
  if (act === 'bold' || act === 'italic') { const ed = e.target.closest?.('.ned'), ce = e.target.closest?.('.ced'); if (ed || ce) { e.preventDefault(); ed ? edCmd(ed.dataset.key, act) : citeCmd(act); } return; }   // solo dentro de una nota o de una cita
  const inText = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  // Dentro de campos de texto o con una ventana abierta, solo funciona Guardar; lo demás es el comportamiento nativo (p. ej. Ctrl+Z en una nota)
  if (act !== 'save' && (inText || document.querySelector('dialog[open]'))) return;
  e.preventDefault(); SC_ACT[act]();
});
window.addEventListener('keydown', e => {   // modo grabación: captura la siguiente combinación antes que el resto de atajos
  if (!recAct) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape') { recAct = null; drawCfg(); return; }
  if (['Backspace', 'Delete'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) return setSC(recAct, '');
  const combo = comboOf(e); if (!combo) return;
  const other = Object.keys(SC_DEF).find(a => a !== recAct && db.settings.shortcuts[a] === combo);
  if (other) return alert(`«${combo}» ya está asignado a «${SC_NAMES[other]}». Quítalo de esa acción o elige otra combinación.`);
  setSC(recAct, combo);
}, true);
function setSC(a, combo) { db.settings.shortcuts[a] = combo; recAct = null; markDirty(); drawCfg(); }
function resetSC() { recAct = null; db.settings.shortcuts = {...SC_DEF}; markDirty(); drawCfg(); }

/* ===== Configuración (paleta, nombre de la app, mostrar archivo) ===== */
const PAL = {   // l = modo claro, d = modo oscuro, c = color de muestra; «azul» usa los colores base del CSS
  azul: {n: 'Azul', c: '#2457c5', l: {}, d: {}},
  verde: {n: 'Verde', c: '#1f7a4d', l: {pri: '#1f7a4d', bg: '#f5f9f6', card: '#ffffff', bd: '#cfdcd3', fg: '#1b2a21'}, d: {pri: '#5fcf94', bg: '#141b17', card: '#1c2520', bd: '#34443b', fg: '#e4eee8'}},
  morado: {n: 'Morado', c: '#6b45c2', l: {pri: '#6b45c2', bg: '#f8f6fc', card: '#ffffff', bd: '#d9d3e8', fg: '#241d33'}, d: {pri: '#a78bf0', bg: '#18141f', card: '#211c2b', bd: '#3d3552', fg: '#ebe6f5'}},
  ambar: {n: 'Ámbar', c: '#c25b0a', l: {pri: '#c25b0a', bg: '#fbf8f4', card: '#ffffff', bd: '#e3d7c7', fg: '#2b2218'}, d: {pri: '#f0a45c', bg: '#1a1612', card: '#241e18', bd: '#4a3e31', fg: '#f1e9de'}},
  grafito: {n: 'Grafito', c: '#3d4655', l: {pri: '#3d4655', bg: '#f4f4f5', card: '#ffffff', bd: '#d4d4d8', fg: '#18181b'}, d: {pri: '#a1a9b8', bg: '#121214', card: '#1c1c20', bd: '#3a3a40', fg: '#ececf0'}}
};
const VARS = ['pri', 'bg', 'card', 'bd', 'fg', 'red'];
const LAB = [['pri', 'Acento (botones y selección)'], ['bg', 'Fondo'], ['card', 'Tarjetas y ventanas'], ['bd', 'Bordes'], ['fg', 'Texto'], ['red', 'Eliminar y avisos']];
function applySettings() {
  const c = db.settings, root = document.documentElement.style, dark = matchMedia('(prefers-color-scheme: dark)').matches, v = c.palette === 'custom' && c.custom ? c.custom : (PAL[c.palette] || PAL.azul)[dark ? 'd' : 'l'];
  VARS.forEach(k => v[k] ? root.setProperty('--' + k, v[k]) : root.removeProperty('--' + k));
  $('#appName').textContent = c.appName || 'Papers';   // solo cambia la cabecera; el título «Gestor de papers» no se toca
  hdr(); progDraw();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
function pickCustom() {   // «Personalizada» parte de los colores que se ven ahora
  const c = db.settings;
  if (!c.custom) { const st = getComputedStyle(document.documentElement); c.custom = {};
    VARS.forEach(k => { let v = st.getPropertyValue('--' + k).trim(); if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map(x => x + x).join(''); c.custom[k] = v; }); }
  c.palette = 'custom'; applySettings(); markDirty(); drawCfg();
}
function setCustom(k, v) { db.settings.custom[k] = v; applySettings(); markDirty(); }
function resetPal() { delete db.settings.custom; setCfg('palette', 'azul'); drawCfg(); }
function setInText(v) { db.settings.export.inText = !!v; markDirty(); }   // ajuste opcional (F4): por defecto oculto
function setMainStyle(v) { db.settings.mainStyle = v; ex().style = v; CITE_SEL = ''; markDirty(); uiSoon(); }   // también pasa a ser el estilo de Exportar
function setCfg(k, v) { db.settings[k] = v; applySettings(); markDirty(); }
let CFG_TAB = 'ap';   // pestaña abierta de Configuración
const CFG_TABS = [['ap', 'Apariencia'], ['no', 'Notas y citas'], ['sc', 'Atajos'], ['da', 'Datos y Drive']];
function cfgTab(t) { CFG_TAB = t; if (t === 'sc') CFG_OPEN.add('sc'); drawCfg(); }
function openCfg(tab) { if (tab) CFG_TAB = tab; drawCfg(); $('#cfg').showModal(); }
function drawCfg() {
  const c = db.settings, on = syOn(), p = syP();
  const T = {
    ap: `<label>Nombre de la aplicación<input value="${esc(c.appName)}" maxlength="30" data-oninput="setCfg('appName', this.value)"></label>
    ${cfgSec('pal', 'Paleta de colores', `<div style="margin:6px 0 10px">${Object.entries(PAL).map(([k, p]) => chip({name: p.n, color: p.c}, c.palette === k, `setCfg('palette','${k}');drawCfg()`)).join('')}${chip({name: 'Personalizada', color: c.custom?.pri || '#888888'}, c.palette === 'custom', 'pickCustom()')}</div>${c.palette === 'custom' && c.custom ? `<div class="cpick">${LAB.map(([k, t]) => `<label class="row"><input type="color" value="${c.custom[k]}" data-oninput="setCustom('${k}', this.value)"> ${t}</label>`).join('')}<button data-onclick="resetPal()">Restablecer a Azul</button></div>` : ''}`)}
    <label class="row"><input type="checkbox" ${c.showImg !== false ? 'checked' : ''} data-onchange="setCfg('showImg', this.checked);render()"> Mostrar la imagen del paper en las tarjetas y la tabla</label>
    <label class="row"><input type="checkbox" ${c.showFile ? 'checked' : ''} data-onchange="setCfg('showFile', this.checked)"> Mostrar el archivo abierto en la cabecera</label>
    <label class="row"><input type="checkbox" ${c.showProgress ? 'checked' : ''} data-onchange="setCfg('showProgress', this.checked)"> Mostrar el progreso de lectura (papers leídos) junto al nombre del proyecto</label>`,
    no: `<label>Estilo de cita principal<select data-onchange="setMainStyle(this.value)">${styOpts(mainSty())}</select></label>
    <label class="row" style="flex-wrap:nowrap"><input type="checkbox" ${c.citeOnlyMain ? 'checked' : ''} data-onchange="setCfg('citeOnlyMain', this.checked)"> En la pestaña «Cita» de cada paper, mostrar solo el estilo principal (si no, salen todos con el principal primero)</label>
    <p class="cfgnote2"><small>El estilo principal pasa a ser también el de «Exportar» al elegirlo aquí, y decide qué campos salen en la vista simplificada de «Datos».</small></p>
    <label class="row"><input type="checkbox" ${c.fmtOpen ? 'checked' : ''} data-onchange="setFmtDefault(this.checked)"> Barra de formato de las notas desplegada por defecto</label>
    <label class="row"><input type="checkbox" ${c.export.inText ? 'checked' : ''} data-onchange="setInText(this.checked)"> Mostrar la cita en el texto y las notas (Chicago) en la pestaña «Cita» de cada paper</label>
    ${cfgSec('ct', 'Tipos de documento propios', ctUI())}${cfgSec('cu', 'Estilos de cita personalizados', cuUI())}${cfgSec('tpl', 'Plantillas de nota', tplUI())}`,
    sc: `${cfgSec('sc', 'Atajos de teclado', `<div class="sct"><small>(clic en una combinación para cambiarla; Retroceso la quita)</small>${Object.keys(SC_NAMES).map(a => `<div class="scr"><span>${SC_NAMES[a]}</span><span class="scb"><button class="${recAct === a ? 'rec' : ''}" data-onclick="recActSet('${a}')">${recAct === a ? 'Pulsa una tecla… (Esc cancela)' : esc(c.shortcuts[a]) || 'Sin asignar'}</button>${c.shortcuts[a] ? `<button title="Quitar" data-onclick="setSC('${a}','')">✕</button>` : ''}</span></div>`).join('')}<button data-onclick="resetSC()">Restablecer atajos</button></div>`)}`,
    da: `<p class="cfgnote2">${on ? `Google Drive: <b>sesión iniciada</b>${p.who ? ' como ' + esc(p.who) : ''}. El resto de opciones de Drive (sincronizar ahora, autoguardado, cerrar sesión, borrar mis datos) están en el botón 🔄 de la cabecera.` : 'Google Drive: <b>sin conectar</b>. Pulsa el botón 🔄 de la cabecera para sincronizar tus proyectos con tu Google Drive.'}</p>
    <label class="row"><input type="checkbox" ${c.pdfDrive ? 'checked' : ''} data-onchange="setPdfDrive(this.checked)"> Subir a mi Google Drive los PDF enlazados</label>
    <small class="cfgnote">${syOn() ? 'Cada PDF enlazado se copia solo a la carpeta privada y oculta de tu Google Drive (la misma de la sincronización) y se puede abrir desde otros dispositivos. Nadie más lo ve. Máx. 100 MB por PDF.' : 'Necesita la sesión de Google Drive iniciada (botón 🔄 de la cabecera).'}</small>
    <small>Estos ajustes son comunes a todos los proyectos y se guardan también en el JSON de cada uno.</small>`};
  $('#cfg').innerHTML = `<div class="dh"><h2>Configuración</h2><div class="dbtn"><button data-onclick="$('#cfg').close()">Cerrar ✕</button></div></div>
    <div class="ctabs" role="tablist">${CFG_TABS.map(([k, t]) => `<button role="tab" aria-selected="${CFG_TAB === k}" class="${CFG_TAB === k ? 'on' : ''}" data-onclick="cfgTab('${k}')">${t}</button>`).join('')}</div>
    ${T[CFG_TAB]}`;
}
/* ---- Editor de estilos personalizados (Configuración) ---- */
const CU_BASE = (() => {   // estilos de serie como punto de partida: plantillas aproximadas (en español, salvo IEEE) que se ajustan a mano
  const cg = t => ({...t, congreso: t.congreso ?? t.capitulo});   // el congreso se escribe como un capítulo de actas
  const CONS = '[ \\[Consulta: {accessed}\\].]', CONSM = '[ \\[consultado {accessed}\\]]';
  return {
    apa: {name: 'APA 7', order: 'alpha', dis: true, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_ini', last: 'auto'}, inText: '({authorsShort}, {year|s.f.}[, {loc:pp}])',
      tpl: {'*': '{authors} ({year|s.f.}). {title}. {venue:i}[, {volume:i}][({issue})][, {pages}]. {link}',
        libro: '{authors} ({year|s.f.}). {title:i}[ ({edition})]. {venue}. {link}',
        capitulo: '{authors} ({year|s.f.}). {title}. En [{editors:fmt=ini_ap} (Ed.), ]{venue:i}[ ({pages:pp})]. [{publisher}. ]{link}',
        congreso: '{authors} ({year|s.f.}). {title:i} \\[Comunicación en congreso\\]. {venue}[, {place}]. {link}',
        tesis: '{authors} ({year|s.f.}). {title:i} \\[{thesisType}[, {venue}]\\]. {link}',
        web: '{authors} ({datey:pat=D de MMMM, YYYY|s.f.}). {title:i}. {venue}. {link}',
        prensa: '{authors} ({datey:pat=D de MMMM, YYYY|s.f.}). {title}. {venue:i}. {link}'}},
    vancouver: {name: 'Vancouver', order: 'list', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_ini_sp', last: ', ', max: 6, show: 6, etAl: ', et al.'}, inText: '',
      tpl: cg({'*': '{authors}. {title}. {venue} \\[Internet\\]. {year}' + CONSM + '[; {volume}[({issue})][:{pages}]]. [Disponible en: {link}]',
        libro: '{authors}. {title} \\[Internet\\]. [{edition} ][{place}: ]{venue}; {year}' + CONSM + '. [Disponible en: {link}]',
        capitulo: '{authors}. {title}. [En: {editors}, editor. ]{venue} \\[Internet\\]. [{place}: ]{publisher}; {year}' + CONSM + '. [p. {pages}. ][Disponible en: {link}]',
        tesis: '{authors}. {title} \\[{thesisType:low} en Internet\\]. [{place}: ]{venue}; {year}' + CONSM + '. [Disponible en: {link}]',
        web: '{authors}. {title} \\[Internet\\]. [{place}: ]{venue}; {datey}' + CONSM + '. [Disponible en: {link}]',
        prensa: '{authors}. {title}. {venue} \\[Internet\\]. {datey}' + CONSM + '[; {volume}[({issue})][:{pages}]]. [Disponible en: {link}]'})},
    mla: {name: 'MLA', order: 'alpha', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true, max: 2, show: 1, etAl: ', et al.'}, inText: '({authorsShort}[ {loc}])',
      tpl: cg({'*': '{authors}. “{title}”. {venue:i}[, vol. {volume}][, núm. {issue}], {year}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]',
        libro: '{authors}. {title:i}. [{edition}, ]{venue}, {year}[, {link}]. [Consultado el {accessed}.]',
        capitulo: '{authors}. “{title}”. {venue:i}[, editado por {editors:fmt=nom_ap}], {publisher}, {year}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]',
        tesis: '{authors}. {title:i}. [{thesisType}, ]{venue}, {year}[, {link}]. [Consultado el {accessed}.]',
        web: '{authors}. “{title}”. {venue:i}, {datey:pat=D MMM YYYY}[, {link}]. [Consultado el {accessed}.]',
        prensa: '{authors}. “{title}”. {venue:i}[, vol. {volume}][, núm. {issue}], {datey}[, {pages:pp}][, {link}]. [Consultado el {accessed}.]'})},
    ieee: {name: 'IEEE', order: 'list', numbered: true, numFmt: 'br', dis: false, dateFmt: 'long', lang: 'en', au: {fmt: 'ini_ap', last: ', and '}, inText: '',
      tpl: {'*': '{authors}, “{title},” {venue:i}[, vol. {volume}][, no. {issue}][, pp. {pages}][, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        libro: '{authors}, {title:i}[, {edition}]. [{place}: ]{venue}[, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        capitulo: '{authors}, “{title},” in {venue:i}[, {editors:fmt=ini_ap}, Ed]. [{place}: ]{publisher}[, {date:pat=MMMM YYYY}][, pp. {pages}]. \\[Online\\]. Available: {link}',
        congreso: '{authors}, “{title},” in {venue}[, {place}][, {date:pat=MMMM YYYY}][, pp. {pages}]. \\[Online\\]. Available: {link}',
        tesis: '{authors}, “{title},” Ph.D. dissertation, {venue}[, {place}][, {date:pat=MMMM YYYY}]. \\[Online\\]. Available: {link}',
        web: '{authors}. ({datey:pat=YYYY, MMMM D}). {title}. {venue} \\[Online\\]. Available: {link}',
        prensa: '{authors}, “{title},” {venue:i}, {datey:pat=MMMM D, YYYY}[, pp. {pages}]. \\[Online\\]. Available: {link}'}},
    chicago_af: {name: 'Chicago autor-fecha', order: 'alpha', dis: true, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true}, inText: '({authorsShort} {year|s.f.}[, {loc}])',
      tpl: cg({'*': '{authors}. {year|s.f.}. “{title}”. {venue:i}[ {volume}][, n.º {issue}][ ({date:pat=MMMM})][: {pages}]. [{link}.]',
        libro: '{authors}. {year|s.f.}. {title:i}. [{edition}. ][{place}: ]{venue}. [{link}.]',
        capitulo: '{authors}. {year|s.f.}. “{title}”. En {venue:i}[, editado por {editors:fmt=nom_ap}][, {pages}]. [{place}: ]{publisher}. [{link}.]',
        tesis: '{authors}. {year|s.f.}. “{title}”. {thesisType}, {venue}. [{link}.]',
        web: '{authors}. {year|s.f.}. “{title}”. {venue}. [{link}.]',
        prensa: '{authors}. {year|s.f.}. “{title}”. {venue:i}, {date:pat=D de MMMM de YYYY}. [{link}.]'})},
    chicago_nb: {name: 'Chicago notas y bibliografía', order: 'alpha', dis: false, dateFmt: 'long', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', firstOnly: true}, inText: '',
      tpl: cg({'*': '{authors}. “{title}”. {venue:i}[ {volume}][, n.º {issue}][ ({datey:pat=MMMM YYYY})][: {pages}]. [{link}.]',
        libro: '{authors}. {title:i}. [{edition}. ][{place}: ]{venue}, {year|s.f.}. [{link}.]',
        capitulo: '{authors}. “{title}”. En {venue:i}[, editado por {editors:fmt=nom_ap}][, {pages}]. [{place}: ]{publisher}, {year|s.f.}. [{link}.]',
        tesis: '{authors}. “{title}”. {thesisType}, {venue}, {year|s.f.}. [{link}.]',
        web: '{authors}. “{title}”. {venue}, {year|s.f.}. [{link}.]',
        prensa: '{authors}. “{title}”. {venue:i}, {date:pat=D de MMMM de YYYY}. [{link}.]'})},
    une_nf: {name: 'UNE-ISO 690 nombre-fecha', order: 'alpha', dis: true, dateFmt: 'dmy', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', first: '{L}, {g}', each: '{g} {L}'}, inText: '',
      tpl: cg({'*': '{authors}, {year|s.f.}. {title}. En línea. {venue:i}[, {volume:b}][({issue})][, pp. {pages}]. Disponible en: {link}.' + CONS,
        libro: '{authors}, {year|s.f.}. {title:i}. En línea. [{edition}. ][{place}: ]{venue}. Disponible en: {link}.' + CONS,
        capitulo: '{authors}, {year|s.f.}. {title}. En línea. En: {editors:fmt=nom_ap:upper=1} (ed.). {venue:i}. [{place}: ]{publisher}[, pp. {pages}]. Disponible en: {link}.' + CONS,
        tesis: '{authors}, {year|s.f.}. {title:i}. En línea. {thesisType}. [{place}: ]{venue}. Disponible en: {link}.' + CONS,
        web: '{authors}, {year|s.f.}. {title}. {venue}. En línea. {date}. Disponible en: {link}.' + CONS,
        prensa: '{authors}, {year|s.f.}. {title}. En línea. {venue:i}. {date}[, pp. {pages}]. Disponible en: {link}.' + CONS})},
    une_num: {name: 'UNE-ISO 690 numérico', order: 'list', numbered: true, numFmt: 'br', dis: false, dateFmt: 'dmy', lang: 'es', au: {fmt: 'ap_nom', last: 'auto', first: '{L}, {g}', each: '{g} {L}'}, inText: '',
      tpl: cg({'*': '{authors}. {title}. En línea. {venue:i}. {year}[, {volume:b}][({issue})][, pp. {pages}]. Disponible en: {link}.' + CONS,
        libro: '{authors}. {title:i}. En línea. [{edition}. ][{place}: ]{venue}, {year}. Disponible en: {link}.' + CONS,
        capitulo: '{authors}. {title}. En línea. En: {editors:fmt=nom_ap:upper=1} (ed.). {venue:i}. [{place}: ]{publisher}, {year}[, pp. {pages}]. Disponible en: {link}.' + CONS,
        tesis: '{authors}. {title:i}. En línea. {thesisType}. [{place}: ]{venue}, {year}. Disponible en: {link}.' + CONS,
        web: '{authors}. {title}. {venue}. En línea. {date}. Disponible en: {link}.' + CONS,
        prensa: '{authors}. {title}. En línea. {venue:i}. {date}[, pp. {pages}]. Disponible en: {link}.' + CONS})}
  };
})();
CU_BASE.derecho = {...CU_BASE.apa, name: 'Derecho y jurisprudencia', group: 'law', tpl: {...CU_BASE.apa.tpl,   // doctrina en APA; legislación y jurisprudencia como en los anexos
  legislacion: '[{place}. ]{title}. [{venue}][, {date:pat=D de MMMM de YYYY}][, núm. {issue}][, {pages:pp}]. [\\[consultado {accessed}\\]. ][Disponible en: {url}]',
  jurisprudencia: '[{place}. ]{venue}[ ({series})]. [Caso {title}[ ({seriesNumber})]. ]{subtype|Sentencia}[ núm. {docNumber}][, de {date:pat=D de MMMM de YYYY}][, {ecli}]. [\\[Versión electrónica. Base de datos de {publisher}\\] ][\\[consultado {accessed}\\]. ][Disponible en: {url}]'}};
/* ---- Botón derecho sobre un campo de la plantilla: opciones propias de ese campo ---- */
let CUF = null;   // {s, e}: posición del {campo…} que se edita dentro del textarea
function cuCtx(e) {
  const t = $('#cuT'), a = t.selectionStart, b = t.selectionEnd, m = [...t.value.matchAll(/\{[^{}]*\}/g)].find(x => a === b ? a > x.index && a < x.index + x[0].length : a < x.index + x[0].length && b > x.index); if (!m) return;   // fuera de un campo: menú normal
  CUF = {s: m.index, e: m.index + m[0].length}; cufShow(e);
}
function cuCtxChip(e, k) {   // botón derecho en la lista de campos: lo inserta y abre sus opciones
  const t = $('#cuT'); if (!t) return; t.focus(); const s = t.selectionStart; t.setRangeText(`{${k}}`, s, t.selectionEnd, 'end'); cuTpl(t.value); CUF = {s, e: s + k.length + 2}; cufShow(e);
}
function cufShow(e) {
  const t = $('#cuT'), n = cuParse(t.value.slice(CUF.s, CUF.e))[0][0]; if (!n || n.t !== 'f') return;
  const [mods, op] = cuSplit(n.m), k = n.k, lab = CU_F.find(f => f[0] === k)?.[1] || k, has = m => mods.includes(m);
  const chk = (m, l) => `<label class="row"><input type="checkbox" data-m="${m}" ${has(m) ? 'checked' : ''} data-onchange="cufApply()"> ${l}</label>`;
  const sel = (key, o, v, attr = 'data-o') => `<select ${attr}="${key}" data-onchange="cufApply()">${Object.entries(o).map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const txt = (key, v, ph = '') => `<input data-o="${key}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" data-oninput="cufApply()">`;
  const num = (key, v) => `<input data-o="${key}" type="number" min="0" max="99" value="${esc(v ?? '')}" placeholder="—" data-oninput="cufApply()">`;
  const fld = (l, c) => `<label>${l}${c}</label>`, TRI = {'': 'Como el estilo', 1: 'Sí', 0: 'No'}, ST = o => ({'': 'Como el estilo', ...o});
  const pick = (list, v) => Object.fromEntries([['', '—'], ...list.map(x => [x, CU_M[x]])]);
  let h = `<div class="cuf2"><div class="ctxh">Campo «${esc(lab)}»</div>`;
  if (CUF_PERSON.includes(k)) h += `<div class="cuh2">Cómo se escribe cada persona</div>${fld('Formato', sel('fmt', ST(CU_AU), op.fmt))}
    ${fld('Personalizado: primer autor', txt('first', op.first, '{L}, {g}'))}${fld('Personalizado: resto de autores', txt('each', op.each, '{g} {L}'))}
    <small>Para el personalizado: <code>{l}</code> apellido · <code>{L}</code> APELLIDO · <code>{g}</code> nombre · <code>{i}</code> iniciales con punto · <code>{n}</code> iniciales sin punto. Si solo rellenas el del resto, el primero usa el mismo.</small>
    ${fld('Entre autores', txt('sep', op.sep, 'como el estilo'))}${fld('Antes del último', sel('last', ST(CU_LAST), op.last))}
    <div class="cugrid2">${fld('Más de N autores', num('max', op.max))}${fld('Mostrar', num('show', op.show))}</div>${fld('Texto de «y otros»', txt('etal', op.etal, 'et al.'))}
    ${fld('Apellidos en mayúsculas', sel('upper', TRI, op.upper))}${fld('Solo el primero invertido', sel('fo', TRI, op.fo))}`;
  if (CUF_DATE.includes(k)) h += `<div class="cuh2">Fecha</div>${fld('Formato', sel('fmt', ST(CU_DATE), op.fmt))}${fld('Patrón propio', txt('pat', op.pat, 'D de MMMM de YYYY'))}
    <small>Letras: <code>YYYY</code> <code>YY</code> año · <code>MMMM</code> mes completo · <code>MMM</code> mes abreviado · <code>MM</code> <code>M</code> mes en número · <code>DD</code> <code>D</code> día. El patrón manda sobre el formato.</small>`;
  if (k === 'pages' || k === 'loc') h += `<div class="cuh2">Páginas</div>${chk('pp', 'Con «p.» / «pp.»')}${chk('dash', 'Raya en el rango (45–67)')}${chk('first', 'Solo la primera página')}`;
  if (k === 'edition') h += `<div class="cuh2">Edición</div>${chk('raw', 'Tal como se escribe (sin «.ª ed.»)')}`;
  h += `<div class="cuh2">Formato del texto</div><div class="row">${chk('i', 'Cursiva')}${chk('b', 'Negrita')}</div>
    ${fld('Mayúsculas', sel('case', pick(['up', 'low', 'cap', 'sent', 'title']), mods.find(m => ['up', 'low', 'cap', 'sent', 'title'].includes(m)), 'data-case'))}
    ${fld('Rodear con', sel('wrap', pick(['q', 'qq', 'par', 'br']), mods.find(m => ['q', 'qq', 'par', 'br'].includes(m)), 'data-wrap'))}
    ${fld('Punto final', sel('dot', pick(['nodot', 'dot']), mods.find(m => ['nodot', 'dot'].includes(m)), 'data-dot'))}
    <div class="cuh2">Solo si el campo tiene valor</div>${fld('Texto antes', txt('pre', op.pre))}${fld('Texto después', txt('suf', op.suf))}${fld('Si está vacío, poner', `<input data-fb value="${esc(n.fb)}" data-oninput="cufApply()">`)}
    <div class="row" style="margin-top:6px"><button data-onclick="cufReset()">Quitar todo el formato</button><button data-onclick="ctxClose()">Cerrar</button></div></div>`;
  ctxShow(e, h);
}
const CUF_PERSON = ['authors', 'author1', 'editors'], CUF_DATE = ['date', 'datey', 'accessed'];
function cufApply() {
  const t = $('#cuT'), box = $('#ctx'); if (!t || !box || !CUF) return;
  const k = /\{([^:|}]*)/.exec(t.value.slice(CUF.s, CUF.e))?.[1] || '', parts = [k], pick = a => box.querySelector(`[${a}]`)?.value;
  const on = m => box.querySelector(`[data-m="${m}"]`)?.checked;
  for (const m of ['pp', 'dash', 'first', 'raw']) if (on(m)) parts.push(m);
  if (pick('data-case')) parts.push(pick('data-case')); if (pick('data-dot')) parts.push(pick('data-dot'));
  for (const m of ['i', 'b']) if (on(m)) parts.push(m);
  if (pick('data-wrap')) parts.push(pick('data-wrap'));
  box.querySelectorAll('[data-o]').forEach(el => { if (el.value !== '') parts.push(el.dataset.o + '=' + cuEnc(el.value)); });
  const fb = box.querySelector('[data-fb]')?.value, text = '{' + parts.join(':') + (fb ? '|' + fb : '') + '}';
  t.setRangeText(text, CUF.s, CUF.e, 'preserve'); CUF.e = CUF.s + text.length; cuTpl(t.value);
}
function cufReset() { const t = $('#cuT'), k = /\{([^:|}]*)/.exec(t.value.slice(CUF.s, CUF.e))?.[1] || ''; t.setRangeText(`{${k}}`, CUF.s, CUF.e, 'preserve'); cuTpl(t.value); ctxClose(); }
function cuFromBase(k) {   // estilo propio a partir de uno de serie: plantillas de partida que se ajustan a mano
  const B = CU_BASE[k]; if (!B) return; const c = cuClean({name: B.name + ' (personalizado)', order: B.order, numbered: B.numbered, numFmt: B.numFmt, dis: B.dis, dateFmt: B.dateFmt, lang: B.lang, au: B.au, tpl: B.tpl, inText: B.inText}); c.id = uid();
  db.settings.customStyles.push(c); CU = {id: c.id, type: '*', prev: 'ej'}; cuTouch(); drawCfg();
}
let CU = {id: '', type: '*', prev: 'ej'};
const cuCur = () => db.settings.customStyles.find(c => c.id === CU.id) || db.settings.customStyles[0] || null;
const cuSample = ty => NEWF({id: 'ej', title: 'Ejemplo de título del documento', authors: ['Pérez, Juan Carlos', 'Gómez Ruiz, Ana', 'Lee, Min-ho'], editors: ['Martín, Luis'], year: 2021, type: ty, venue: 'Revista de Ejemplo', publisher: 'Editorial Ejemplo',
  place: 'Madrid', edition: '2', volume: '12', issue: '3', pages: '45-67', doi: '10.1000/xyz123', url: 'https://example.org/doc', accessed: '2026-01-15', pubDate: '2021-03-09', isbn: '978-3-16-148410-0', issn: '1234-5678', institution: 'Universidad de Ejemplo',
  docNumber: 'ABC-123', series: 'Serie Ejemplo', seriesNumber: '7', conferenceName: 'Congreso de Ejemplo', conferencePlace: 'Sevilla', conferenceDates: '3-5 de mayo de 2021', subtype: 'Informe técnico', authorRole: 'Director', userHandle: 'ejemplo', abbr: 'EJ', ecli: 'ECLI:ES:TS:2021:123',
  thesisType: 'Tesis doctoral', notes: [], tagIds: [], cites: {}, sectionIds: [], related: [], refTo: [], history: [], general: ''});
function cuPrev() {
  const el = $('#cuPrev'), c = cuCur(), st = c && STYLES['cu_' + c.id]; if (!el || !st) return;
  const o = {...ex(), ys: ''}, real = CU.prev !== 'ej' && db.papers.find(p => p.id === CU.prev), line = (p, lab) => `<div class="culn">${lab ? `<small>${esc(lab)}</small> ` : ''}${citeHtml(st.fn(p, o)) || '<small>(vacío)</small>'}</div>`;
  const p = real || cuSample(CU.type === '*' ? 'articulo' : CU.type), it = st.inText(p, o, '24');
  el.innerHTML = line(p, real ? '' : TYPES[p.type]) + (it.length ? `<div class="culn"><small>En el texto:</small> ${citeHtml(it[0].t)}</div>` : '')
    + (real ? '' : `<details><summary>Ver el ejemplo en todos los tipos</summary>${Object.entries(TYPES).map(([k, v]) => line(cuSample(k), v)).join('')}</details>`);
}
function cuUI() {
  const L = db.settings.customStyles, c = cuCur(); if (c) CU.id = c.id;
  let h = `<small>Crea tu propio estilo: una plantilla por tipo de documento con los campos de los papers. Sale en Exportar y en la pestaña Cita, y se guarda en el JSON. <a data-onclick="openHelp('estilos')">Ver la ayuda</a></small>
    <div class="row" style="margin:8px 0">${L.length ? `<select data-onchange="cuPick(this.value)">${L.map(x => `<option value="${x.id}" ${c.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
      <button data-onclick="cuAdd()">+ Nuevo estilo</button><select data-onchange="cuFromBase(this.value);put(this,'value','')" title="Empieza con las plantillas de uno de los estilos de serie y modifícalas"><option value="">+ Nuevo a partir de…</option>${STY_G.slice(0, 2).map(([g, t]) => `<optgroup label="${t}">${Object.entries(CU_BASE).filter(([, b]) => (b.group || '') === g).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('')}</optgroup>`).join('')}</select>${c ? '<button data-onclick="cuDup()">Duplicar</button><button class="danger" data-onclick="cuDel()">Eliminar</button>' : ''}</div>`;
  if (!c) return h + '<p class="empty">Aún no hay estilos personalizados.</p>';
  const sel = (k, o, v, f) => `<select data-onchange="${f}('${k}',this.value)">${Object.entries(o).map(([a, b]) => `<option value="${esc(a)}" ${String(v) === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const au = c.au, tpl = c.tpl[CU.type] ?? c.tpl['*'] ?? '', over = CU.type !== '*' && c.tpl[CU.type] != null;
  h += `<div class="cugrid">
    <label>Nombre<input value="${esc(c.name)}" maxlength="60" data-oninput="cuSet('name',this.value)"></label>
    <label>Orden de la bibliografía${sel('order', {alpha: 'Alfabético por autor', list: 'Orden de la lista'}, c.order, 'cuSet')}</label>
    <label class="row"><input type="checkbox" ${c.numbered ? 'checked' : ''} data-onchange="cuSet('numbered',this.checked)"> Numerada</label>
    <label>Formato del número${sel('numFmt', {dot: '1.', br: '[1]', par: '(1)'}, c.numFmt, 'cuSet')}</label>
    <label class="row"><input type="checkbox" ${c.dis ? 'checked' : ''} data-onchange="cuSet('dis',this.checked)"> Distinguir 2020a / 2020b</label>
    <label>Formato de fechas${sel('dateFmt', CU_DATE, c.dateFmt, 'cuSet')}</label>
    <label>Idioma de conectores y fechas${sel('lang', {export: 'El de Exportar', es: 'Español', en: 'English'}, c.lang, 'cuSet')}</label></div>
    <div class="cuh">Autores y editores</div><div class="cugrid">
    <label>Cada autor${sel('fmt', CU_AU, au.fmt, 'cuAu')}</label><label>Entre autores<input value="${esc(au.sep)}" maxlength="10" data-oninput="cuAu('sep',this.value)"></label>
    <label>Antes del último${sel('last', CU_LAST, au.last, 'cuAu')}</label><label>Más de N autores (0 = todos)<input type="number" min="0" max="99" value="${au.max}" data-oninput="cuAu('max',+this.value)"></label>
    <label>Autores que se muestran<input type="number" min="1" max="99" value="${au.show}" data-oninput="cuAu('show',+this.value)"></label><label>Texto de «y otros»<input value="${esc(au.etAl)}" maxlength="20" data-oninput="cuAu('etAl',this.value)"></label>
    <label class="row"><input type="checkbox" ${au.upper ? 'checked' : ''} data-onchange="cuAu('upper',this.checked)"> Apellidos en mayúsculas</label><label class="row"><input type="checkbox" ${au.firstOnly ? 'checked' : ''} data-onchange="cuAu('firstOnly',this.checked)"> Solo el primero va «Apellido, …»</label></div>
    <div class="cuh">Plantilla</div>
    <label>Tipo de documento<select data-onchange="put(CU,'type',this.value,drawCfg)"><option value="*" ${CU.type === '*' ? 'selected' : ''}>Por defecto (todos los tipos)</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${CU.type === k ? 'selected' : ''}>${esc(v)}${c.tpl[k] != null ? ' ✎' : ''}</option>`).join('')}</select></label>
    <textarea id="cuT" rows="4" spellcheck="false" data-oninput="cuTpl(this.value)" data-oncontextmenu="cuCtx(event)" placeholder="p. ej. [{authors}. ]({year|s.f.}). {title:i}.">${esc(tpl)}</textarea>
    ${CU.type !== '*' ? `<small>${over ? 'Plantilla propia de este tipo.' : 'Este tipo usa la plantilla por defecto; si la editas aquí, se crea una propia.'}</small>${over ? '<button data-onclick="cuTplClear()">Quitar la de este tipo</button>' : ''}` : ''}
    <div class="cuh">Campos <small>(clic para insertar; clic derecho sobre un campo, aquí o dentro de la plantilla, para darle formato propio)</small></div><div class="cuf">${CU_F.map(([k, l]) => `<button title="{${k}} · clic derecho: insertar con opciones" data-onclick="cuIns('{${k}}')" data-oncontextmenu="cuCtxChip(event,'${k}')">${esc(l)}</button>`).join('')}</div>
    <div class="row" style="margin:6px 0"><button data-onclick="cuGroup()" title="Lo de dentro solo sale si todos sus campos tienen valor">[ ] Grupo opcional</button>
      <select data-onchange="cuModIns(this.value);put(this,'value','')" title="Se aplica al campo bajo el cursor"><option value="">Formato del campo…</option>${Object.entries(CU_M).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    <details class="cuhelp"><summary>Cómo se escribe</summary><small>El texto va tal cual. <code>{campo}</code> inserta un dato; <code>{campo:i}</code> lo pone en cursiva (se pueden encadenar: <code>{title:i:q}</code>); <code>{year|s.f.}</code> usa «s.f.» si está vacío.
      <code>[ … ]</code> es un grupo opcional: solo sale si todos los campos de dentro tienen valor. <code>\\</code> escapa el siguiente carácter (<code>\\[</code>). Los puntos y espacios repetidos se limpian solos. Con el <b>botón derecho sobre un campo</b> de la plantilla eliges su formato (autores, fechas, páginas, cursiva, texto antes y después…) y se escribe solo. Los corchetes literales, como en <code>\\[Internet\\]</code>, se escapan con barra.</small></details>
    <label>Cita en el texto (opcional)<input value="${esc(c.inText)}" maxlength="500" data-oninput="cuSet('inText',this.value)" placeholder="({authorsShort}, {year})"></label>
    <div class="cuh">Vista previa</div><label>Con<select data-onchange="put(CU,'prev',this.value,cuPrev)"><option value="ej" ${CU.prev === 'ej' ? 'selected' : ''}>Un ejemplo</option>${db.papers.map(p => `<option value="${p.id}" ${CU.prev === p.id ? 'selected' : ''}>${esc(shortTxt(p.alias || p.title))}</option>`).join('')}</select></label>
    <div id="cuPrev" class="cuprev"></div>`;
  setTimeout(cuPrev); return h;
}
const cuTouch = () => { markDirty(); syncStyles(db.settings.customStyles, db.settings.export); cuPrev(); };
function cuSet(k, v) { const c = cuCur(); if (!c) return; c[k] = v; cuTouch(); }
function cuAu(k, v) { const c = cuCur(); if (!c) return; c.au[k] = v; cuTouch(); }
function cuTpl(v) { const c = cuCur(); if (!c) return; c.tpl[CU.type] = v; cuTouch(); }
function cuTplClear() { const c = cuCur(); delete c.tpl[CU.type]; cuTouch(); drawCfg(); }
function cuAdd() { const c = cuNew('Mi estilo ' + (db.settings.customStyles.length + 1)); db.settings.customStyles.push(c); CU = {id: c.id, type: '*', prev: 'ej'}; cuTouch(); drawCfg(); }
function cuDup() { const c = cuCur(), d = structuredClone(c); d.id = uid(); d.name += ' (copia)'; db.settings.customStyles.push(d); CU.id = d.id; cuTouch(); drawCfg(); }
function cuDel() {
  const c = cuCur(); if (!c || !confirm(`¿Eliminar el estilo «${c.name}»? Las citas que lo usen en Exportar volverán a APA.`)) return;
  db.settings.customStyles = db.settings.customStyles.filter(x => x.id !== c.id); CU.id = ''; cuTouch(); drawCfg();
}
function cuEdit(f) {   // aplica f(textarea) sobre la plantilla y guarda el resultado
  const t = $('#cuT'); if (!t) return; t.focus(); f(t); cuTpl(t.value);
}
function cuIns(txt) { cuEdit(t => { const s = t.selectionStart; t.setRangeText(txt, s, t.selectionEnd, 'end'); }); }
function cuGroup() { cuEdit(t => { const s = t.selectionStart, e = t.selectionEnd; t.setRangeText('[' + t.value.slice(s, e) + ']', s, e, 'end'); if (s === e) t.setSelectionRange(s + 1, s + 1); }); }
function cuModIns(m) {
  if (!m) return; cuEdit(t => { const v = t.value, s = t.selectionStart, o = v.lastIndexOf('{', s - 1), c = o < 0 ? -1 : v.indexOf('}', o);
    if (o < 0 || c < s - 1 || v.slice(o, s).includes('}')) return alert('Coloca el cursor dentro de un campo, p. ej. {title}.');
    const bar = v.indexOf('|', o), at = bar > 0 && bar < c ? bar : c; t.setRangeText(':' + m, at, at, 'end'); });
}
/* ===== Ayuda: botón ❓ de la cabecera (o F1) ===== */
const HELP_OPEN = new Set(['inicio']);
let HP_ALL = false;   // ayuda completa desplegada (por defecto solo «Empezar aquí»)
const helpSec = (id, title, body, rest) => `<details class="cs${rest ? ' hprest' : ''}" id="hp_${id}" ${rest && !HP_ALL ? 'hidden' : ''} ${HELP_OPEN.has(id) ? 'open' : ''} data-ontoggle="setHas(HELP_OPEN,'${id}',this.open)"><summary>${title}</summary><div class="csb hp">${body}</div></details>`;
const helpTbl = rows => `<table class="hpt">${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('')}</table>`;
function helpHTML() {
  const sc = db.settings.shortcuts, kb = a => `<kbd>${esc(sc[a] || 'sin asignar')}</kbd>`;
  const S = {
    inicio: ['Empezar aquí', `<ul><li><b>Proyectos</b>: cada proyecto es una biblioteca con su propio archivo JSON. Su nombre está arriba, junto al de la aplicación; con <b>▾</b> cambias de proyecto o creas uno.</li>
      <li><b>Guardar 💾</b> (${kb('save')}) guarda el proyecto en su archivo. En <b>«Archivo ▾»</b> tienes Abrir, Guardar como, Importar referencias y el Autoguardado.</li>
      <li><b>Google Drive 🔄</b>: guarda todos tus proyectos en tu propio Drive y los mantiene iguales en todos tus dispositivos.</li>
      <li><b>+ Nuevo paper</b> añade el primero; los filtros y el orden están en la barra lateral, y «Exportar citas» arriba.</li>
      <li>Sin cuenta ni servidor: todo está en tu navegador y en tus archivos. Al empezar se abre un ejemplo para probar. Esta ayuda: <kbd>F1</kbd>; todo lo demás, en «Ver toda la ayuda».</li></ul>`],
    archivos: ['Archivos, guardado y autoguardado', `<ul><li><b>Archivo ▾ → Abrir</b> (${kb('open')}): abre un archivo JSON como proyecto. También ahí: <b>Guardar como</b>, <b>Importar referencias</b> (.bib, .ris, texto o DOI; ${kb('import')}) y el <b>Autoguardado</b>.</li>
      <li><b>Guardar 💾</b> (${kb('save')}) y <b>Guardar como</b> guardan el proyecto abierto en su archivo, con el nombre del proyecto: en Chrome y Edge de escritorio escriben directamente en el archivo; en otros navegadores se descarga una copia.</li>
      <li><b>Autoguardado</b> (solo Chrome/Edge): guarda solo, un segundo después de cada cambio. La primera vez pide el archivo. Con Google Drive conectado funciona en cualquier navegador y guarda en tu Drive.</li>
      <li><b>Estado de guardado</b> (junto al nombre del proyecto): «Guardado», «Sin guardar» o, con Drive conectado, «Guardado en Google Drive», «Sincronizando…» o «Sin guardar…».</li>
      <li><b>Volver a leer el archivo</b>: ▾ del proyecto → «↻ Volver a leer…» (el navegador pide permiso en cada sesión).</li>
      <li>Deshacer ${kb('undo')} y rehacer ${kb('redo')} funcionan sobre los cambios de la sesión.</li></ul>
      <p>Qué se guarda en el JSON: papers (con su fecha de creación, notas e imagen), secciones, etiquetas, papelera y todos los ajustes (paleta, atajos, plantillas de nota, tipos y estilos de cita propios). <b>No</b> se guarda el historial de cambios del día ni los enlaces a archivos de imagen o PDF locales.</p>`],
    proyectos: ['Proyectos', `<p>Un <b>proyecto</b> es una biblioteca aparte: sus papers, notas, secciones, etiquetas, relaciones y papelera. Al abrir un proyecto solo ves sus papers. Lo demás es <b>común a todos</b>: el nombre de la aplicación, los colores, los atajos, los tipos y estilos propios, las plantillas de nota y las opciones de exportación.</p>
      <ul><li><b>Nombre</b>: arriba, al lado del nombre de la aplicación. Haz clic, escribe y pulsa Intro. Su archivo JSON se llama igual (<code>Tesis</code> → <code>Tesis.json</code>); en Chrome y Edge el archivo se renombra, y si no se puede, el siguiente «Guardar» crea el del nombre nuevo.</li>
      <li><b>Cambiar de proyecto</b>: botón <b>▾</b> → elige uno. Es inmediato: el navegador guarda la copia de trabajo de cada proyecto, también los cambios sin guardar, y al volver está como lo dejaste.</li>
      <li><b>Nuevo proyecto</b>: ▾ → «Nuevo proyecto»; empieza vacío y puedes escribir su nombre.</li>
      <li><b>Abrir 📂 un JSON</b>: si ese archivo ya es uno de tus proyectos, se abre ese proyecto; si no, se crea uno nuevo con el nombre del archivo.</li>
      <li><b>Guardar 💾</b> guarda solo el proyecto abierto en su archivo; <b>Guardar como</b> propone <code>&lt;nombre del proyecto&gt;.json</code>. El autoguardado escribe en el archivo de cada proyecto.</li>
      <li><b>Borrar</b>: ▾ → «Borrar este proyecto»; desaparece de la aplicación (y de tu Google Drive si está conectado). Tu archivo JSON no se toca.</li>
      <li><b>Con Google Drive</b> se guardan todos los proyectos y en tus otros dispositivos aparecen en la lista ▾ (☁ = aún no descargado: se descarga al abrirlo). Al cambiar de proyecto, primero se sube lo pendiente.</li></ul>`],
    extras: ['Copias, duplicados, PDF y filtros guardados', `<ul><li><b>Copias de seguridad</b>: ▾ junto al nombre del proyecto → «Copias de seguridad…». Se guarda una al abrir la aplicación cada día (las últimas 10) y otra antes de restaurar o de sustituirlo todo por lo de Drive; también puedes crear una a mano, descargarla o borrarla. «Restaurar» sustituye los papers, notas, secciones, etiquetas y papelera de ese proyecto (los ajustes no cambian) y se puede deshacer. Solo viven en este navegador y se borran con el proyecto.</li>
      <li><b>Buscar duplicados</b>: ▾ junto al nombre del proyecto. Agrupa papers con el mismo DOI o título; «Quedarme con este» conserva ese paper, le añade lo que falte de los otros (campos vacíos, etiquetas, secciones, notas, relaciones y enlaces de las notas) y manda los demás a la papelera. «No son duplicados» los descarta hasta cerrar la aplicación.</li>
      <li><b>Mover o copiar a otro proyecto</b>: marca papers con «Seleccionar» y pulsa «Mover o copiar a otro proyecto…» (grupo Selección, que aparece al marcar papers). Se llevan las notas, etiquetas y secciones (se buscan por nombre y, si no existen en el destino, se crean) y las relaciones entre los papers elegidos. Se ve al abrir el otro proyecto.</li>
      <li><b>PDF enlazado</b>: en «Datos» de cada paper, «Enlazar un PDF…» (y, si quieres, la página donde abrirlo). Solo se guarda el <b>nombre</b> en el JSON; el archivo no se sube a ningún sitio, salvo que actives en Configuración <b>«Subir a mi Google Drive los PDF enlazados»</b> (con la sesión de Drive iniciada): entonces cada PDF se copia solo a la carpeta privada y oculta de tu Drive (máx. 100 MB cada uno) y se abre desde cualquier dispositivo con tu sesión; se borra de allí si quitas el enlace. Se abre con «📄 PDF» en la tarjeta o la tabla. En otro dispositivo, o si lo moviste, te pide elegirlo de nuevo. Sin acceso a archivos (no Chrome ni Edge de escritorio), hay que elegirlo cada vez.</li>
      <li><b>Copiar cita 📋</b>: en cada tarjeta y fila copia la cita en el estilo elegido en Exportar, con cursiva al pegar en Word o Docs.</li>
      <li><b>Vistas ⭐</b> (filtros guardados): en la barra lateral, «＋ Guardar la vista actual» guarda la búsqueda, el orden y los filtros con un nombre; un clic la aplica. Son de cada proyecto y de este navegador.</li>
      <li><b>Progreso</b> (opcional: Configuración → Apariencia): junto al nombre del proyecto, una barra con los papers leídos y leyendo (el detalle, al pasar el ratón).</li></ul>`],
    lista: ['Lista principal', `<ul><li><b>Tarjetas o tabla</b>: el botón «Tabla / Tarjetas» cambia la vista. La tabla muestra imagen, título, autores, año, revista, lectura, valoración, secciones, etiquetas y notas.</li>
      <li><b>En cada tarjeta</b>: casilla para seleccionar, <i>Editar</i>, las etiquetas del paper, el estado de lectura, las estrellas y la ✕ (a la papelera). Si las etiquetas no caben en la barra, pasan a su propia línea.</li>
      <li><b>Estado de lectura</b>: un clic lo cambia (por leer → leyendo → leído). <b>Estrellas</b>: clic derecho para elegir la valoración.</li>
      <li><b>Etiquetas</b>: clic derecho sobre una etiqueta del paper para quitársela.</li>
      <li><b>Notas</b>: el botón «Notas (n)» las despliega; clic derecho abre el visor de notas del paper. 🔗 muestra sus relaciones.</li>
      <li><b>Agrupar por sección</b>: en «Ordenar» (o clic derecho en «Sección» sobre la lista). Puedes arrastrar papers entre grupos para cambiarlos de sección.</li></ul>`],
    lateral: ['Barra lateral', `<ul><li>☰ (${kb('side')}) pliega o despliega la barra; arrastra su borde derecho para cambiar el ancho (doble clic lo restablece). Con la barra plegada, la búsqueda pasa a la fila de «Nuevo paper» y cada icono abre la barra en su grupo. Clic derecho en ☰: plegar o desplegar todos los grupos.</li>
      <li><b>Buscar 🔍</b> (${kb('find')}): por título, autor o año; la casilla amplía a notas y citas editadas.</li>
      <li><b>Filtros 🎚️</b>: Secciones, Etiquetas, Lectura, Valoración mínima y Años. Cada chip dice cuántos papers tiene; «Sin sección» y «Sin etiquetas» muestran los que falta clasificar. Clic derecho en una etiqueta para <b>ocultar</b> sus papers (sale tachada). Con 6 etiquetas o más aparece un buscador de etiquetas. Bajo Lectura, el progreso del proyecto. «✎ Gestionar» crea, renombra, recolorea, ordena y borra secciones y etiquetas. Clic derecho en una sección abre sus notas. Arrastra un paper (o los seleccionados) a una sección o etiqueta para añadírsela.</li>
      <li><b>Filtros aplicados</b>: sobre la lista se ven todos, cada uno con su ✕ para quitarlo, y «Limpiar todo».</li>
      <li><b>Ordenar ⇅</b> (plegado al empezar): varios criterios en cascada (título, autor, año, revista, lectura, valoración, fecha de creación o modificación…), cada uno ascendente o descendente, y «Agrupar por sección».</li>
      <li><b>Vistas ⭐</b>: «＋ Guardar la vista actual» guarda la búsqueda, el orden y los filtros con un nombre; un clic la aplica y la que coincide con lo que ves sale marcada. Son de cada proyecto y de este navegador.</li>
      <li><b>Recientes 🕘</b>: los 5 últimos papers que abriste en este proyecto.</li>
      <li><b>Selección ☑️</b>: «☑ Visibles» (sobre la lista) marca los papers que se ven; con papers marcados aparece el grupo <b>Selección</b> con Exportar citas, Mover o copiar a otro proyecto y Quitar selección.</li>
      <li><b>Relaciones 🕸️</b>: gráfico de los papers relacionados o que se citan entre sí. <b>Papelera 🗑️</b>: los papers eliminados se guardan <b>5 días</b> y se pueden restaurar.</li>
      <li><b>Información ℹ️</b> (plegada): Ayuda, <b>Añadir app</b> (solo si no está instalada) y Créditos.</li></ul>`],
    paper: ['Editar un paper', `<p>«+ Nuevo paper» o «Editar». Pestañas: <b>Ver todo</b> (todos los bloques, plegables y con una sola variante de cita), <b>Datos</b>, <b>Cita</b>, <b>Notas</b>, <b>Secciones, etiquetas y relacionados</b> e <b>Historial</b>. «Guardar paper» confirma; «Cancelar» o cerrar sin guardar descarta el borrador.</p>
      <h4>Datos</h4><p>Por defecto se ve una <b>versión simplificada</b>: título, autores, año, tipo, lectura y valoración, más los campos que usa tu <b>estilo de cita principal</b> para ese tipo (Configuración → Notas y citas) y los que ya tienen datos. «<b>Mostrar todos los campos</b>» despliega el resto bajo «Otros campos» (título personalizado, clave de orden, PDF, enlace en la cita, tipo de autor…); la app recuerda tu elección.</p><ul><li><b>Imagen</b> (recuadro junto a los títulos): una <i>URL</i>, un <i>archivo local enlazado</i> (solo Chrome/Edge: el JSON guarda el nombre y el enlace queda en ese navegador) o una <i>copia reducida incrustada</i> en el JSON. También puedes <b>pegar con Ctrl+V</b> una imagen copiada (por ejemplo de Google Imágenes).</li>
      <li><b>Título</b> y <b>título personalizado</b> (solo para mostrar; la cita usa el original). <b>Autores</b>: uno por línea, «Apellido, Nombre»; una entidad se escribe sin coma. <b>Clave de orden</b>: para ordenar «de la Torre» por «Torre».</li>
      <li><b>Tipo</b>: decide qué campos aparecen. Incluye tus <i>tipos propios</i> y la opción «➕ Crear un tipo propio…».</li>
      <li><b>DOI → Buscar</b> rellena los datos desde CrossRef (internet). <b>Enlace en la cita</b>: DOI, URL, automático o ninguno. <b>Fecha de consulta</b>: se escribe en la cita salvo que la omitas.</li></ul>
      <h4>Cita</h4><p>Muestra la cita del paper en <b>todos los estilos</b> (los de serie y los tuyos), con tu <b>estilo principal</b> primero; si en Configuración marcas «mostrar solo el estilo principal», sale solo ese y el botón «Ver todos los estilos». La cita se edita <b>con su formato</b>: la cursiva se ve como cursiva, sin asteriscos. Arriba, la barra de <b>formato</b>: <i>Cursiva</i> y <i>Negrita</i> sobre lo seleccionado (también con el atajo de cursiva), e <i>Idioma</i> y <i>Fecha de consulta</i> (cómo se escribe «[consultado el …]» en las páginas web), los mismos ajustes que en Exportar. Puedes <i>editarla a mano</i> (queda marcada «editada a mano»), <i>Regenerar desde los datos</i>, <i>Copiar</i> (texto) o <i>Copiar con formato</i> (cursiva real, para pegar en Word o Docs). Con la opción de Configuración «Mostrar la cita en el texto», aparece también la cita en el texto y las notas de Chicago, con el campo de página.</p>
      <h4>Notas</h4><p>Hay una <b>nota general</b> y <b>notas por sección</b>. El editor muestra el formato al escribir, como WhatsApp: <code>*cursiva*</code>, <code>**negrita**</code>, <code>~~tachado~~</code>, <code>__subrayado__</code>, listas con «- » o «1. ». La barra «Aa» (arriba del cuadro) trae esos botones, plantillas y enlaces 🔗 a otros papers o notas; la chincheta la mantiene desplegada. Se guardan y se copian con los símbolos, y al exportar solo se ve el formato.</p>
      <h4>Secciones, etiquetas y relacionados</h4><p>Marca las secciones y etiquetas del paper. En «Relacionados» enlazas papers entre sí (relación simétrica) o indicas que <i>este paper cita a</i> otro; el otro mostrará «citado por».</p>
      <h4>Historial</h4><p>Lista los cambios hechos <b>hoy</b> en ese paper. Solo vive en memoria: no se guarda en el JSON.</p>`],
    exportar: ['Exportar citas', `<p>«Exportar citas» (${kb('exportCites')}) abre la ventana de exportación de los papers <b>seleccionados</b> (o de los visibles si no hay selección).</p>
      <ul><li><b>Formato</b>: texto, Word (.doc o .docx), BibTeX o RIS. En los dos últimos no hay estilo de cita.</li>
      <li><b>Estilo de cita</b>, en tres secciones: <b>Estilos generales</b> (APA 7, Vancouver, MLA, IEEE, Chicago autor-fecha y notas-bibliografía, UNE-ISO 690 nombre-fecha y numérico), <b>Derecho y jurisprudencia</b> (ver su apartado de la ayuda) y <b>Estilos propios</b> (tus estilos personalizados, marcados con ✎). Algunos estilos avisan de los tipos que la guía no cubre.</li>
      <li><b>Orden</b>: automático (alfabético o por lista según el estilo), lista, alfabético o por año. <b>Numerar</b>, formato del número, idioma de los conectores (es/en), formato de la fecha de consulta, incluir notas, listar todos los autores en Vancouver…</li>
      <li>El texto de la vista previa es editable. <b>Copiar</b> copia texto; <b>Copiar con formato</b> conserva cursiva y sangría francesa para Word o Docs. También puedes guardar el archivo.</li></ul>`],
    derecho: ['Derecho y jurisprudencia', `<p>Un estilo para trabajos de Derecho (TFG, TFM, tesis) que une las guías de la <b>UAM</b> (Facultad de Derecho), la <b>UMA</b>, la <b>UC3M</b> y la <b>UCM</b>. Está en la sección «Derecho y jurisprudencia» del selector de estilos (Exportar y pestaña Cita).</p>
      <h4>Qué hace al exportar</h4><ol><li><b>Lista de abreviaturas</b> utilizadas (CE, LOPJ, RDL, STS…), al principio. Se puede desactivar.</li>
      <li><b>Bibliografía</b>: la doctrina (libros, artículos, capítulos, webs…), en orden alfabético y con las plantillas de <b>APA 7</b>, como recomiendan la UAM y la UCM.</li>
      <li><b>Anexo de legislación</b> y <b>Anexo de jurisprudencia</b>, de la norma o resolución más antigua a la más reciente. La legislación y la jurisprudencia nunca van en la bibliografía.</li></ol>
      <h4>Legislación</h4><p>Tipo «Legislación». Escribe en <b>Título</b> el título completo y exacto (<i>Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público</i>); de él se sacan el rango, el número y la fecha para la cita corta y para el orden del anexo. Rellena también el ámbito (España, Extremadura, Unión Europea…), el boletín (en el DOUE el número lleva la serie: <i>L 94</i>), la fecha de publicación, las páginas y, si la tiene, la <b>abreviatura</b> (CE, LOPJ, LRJSP).</p>
      ${helpTbl([['Anexo', 'España. Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público. Boletín Oficial del Estado, 2 de octubre de 2015, núm. 236, pp. 89411 a 89530.'], ['En el texto', '(art. 19 LRJSP) · sin abreviatura: (RDL 18/2020, de 12 de mayo) · UE: (Dir. 2015/2376 del Consejo, de 8 de diciembre de 2015)']])}
      <h4>Jurisprudencia</h4><p>Tipo «Jurisprudencia». Campos: tribunal, sala y sección, tipo de resolución (sentencia, auto, declaración), número, fecha, caso o partes (en Título; si no hay, pon la identificación, como «STS 1229/2017»), asunto y ECLI (tribunales europeos), base de datos y abreviatura propia (si no, se deduce: STS, STC, ATC, SAN, STSJ Madrid, SAP Sevilla, STEDH, STJUE).</p>
      ${helpTbl([['Anexo', 'España. Tribunal Supremo (Sala de lo Penal, Sección 1.ª). Sentencia núm. 1229/2017, de 29 de marzo de 2017.'], ['Caso europeo', 'Tribunal de Justicia de la Unión Europea. Caso Schempp (C-403/03). Sentencia de 12 de julio de 2005, EU:C:2005:446.'], ['En el texto', '(STS 1229/2017 de 29 de marzo, FJ 3) · abreviada: (STS 1229/2017) · (STSJ Madrid de 14 de junio de 2002, FD 2) · (STEDH de 21 de febrero de 2017, ap. 45)']])}
      <p>En la <b>cita en el texto</b> (si la activas en Configuración), «Página o parte citada» es el artículo en la legislación (<i>22.1</i> → art. 22.1 CE) y el fundamento o apartado en la jurisprudencia (<i>3</i> → FJ 3 en el TC, el TS y la AN; FD 3 en los TSJ y las audiencias provinciales; ap. 3 en los tribunales europeos). Puedes escribirlo tal cual (<i>Preámbulo</i>, <i>DA 2.ª</i>).</p>
      <p>Los <b>demás estilos</b> citan la jurisprudencia con esta misma plantilla, porque las guías dicen que se aplica sea cual sea el estilo, y lo avisan. La legislación sigue en ellos como hasta ahora.</p>`],
    importar: ['Importar referencias', `<p>Botón <b>📥 Importar</b> de la cabecera, a la izquierda de «Exportar citas» (también en <b>Archivo ▾</b> o con ${kb('import')}): desde un archivo <code>.bib</code>, <code>.ris</code> o <code>.txt</code>, pegando texto o buscando por <b>DOI</b>.</p><ul><li><b>Texto de ScienceDirect</b> («Export citation → Export citation to text»): autores, título, revista, volumen, número, páginas o número de artículo, ISSN, DOI y URL; el resumen y las palabras clave van a las notas generales.</li><li><b>Citas de Google Scholar</b> (botón «Citar»): pega una o varias, una por línea, en APA, MLA, Chicago, Harvard o Vancouver; se detectan autores, año, título, revista o editorial, volumen, número y páginas. Revisa la lista: MLA abrevia con «et al.» y Scholar escribe la revista en minúsculas. El BibTeX de Scholar también vale.</li></ul><p> Antes de añadir se revisa la lista, y puedes asignar sección, etiqueta y estado de lectura a todas. Dentro de un paper, «Buscar» junto al DOI propone rellenar solo los campos vacíos o los que marques.</p>`],
    config: ['Configuración', `<p>⚙️ en la barra lateral, con cuatro pestañas: <b>Apariencia</b>, <b>Notas y citas</b>, <b>Atajos</b> y <b>Datos y Drive</b>. Es común a todos los proyectos y se guarda también en cada JSON.</p><ul><li><b>Nombre de la aplicación</b>, <b>paleta de colores</b> (o personalizada), mostrar el archivo abierto en la cabecera y, si quieres, el <b>progreso de lectura</b> (papers leídos) junto al nombre del proyecto (desactivado por defecto).</li>
      <li><b>Estilo de cita principal</b> (Notas y citas; APA 7 por defecto): sale primero en la pestaña Cita (o solo él, si lo marcas), pasa a ser el estilo de Exportar al elegirlo y decide los campos de la vista simplificada de Datos.</li>
      <li><b>Mostrar la imagen</b> del paper en tarjetas y tabla (Apariencia). <b>Barra de formato</b> de las notas desplegada por defecto. <b>Cita en el texto</b> (Chicago) en la pestaña Cita.</li>
      <li><b>Tipos de documento propios</b> y <b>Estilos de cita personalizados</b>: ver las dos secciones siguientes.</li>
      <li><b>Plantillas de nota</b>: textos de partida para las notas; <code>{fecha}</code> y <code>{paper}</code> se sustituyen al insertarlas.</li>
      <li><b>Atajos de teclado</b>: clic en una combinación para cambiarla (Retroceso la quita).</li></ul>`],
    tipos: ['Tipos de documento propios', `<p>Los tipos predefinidos (${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([, v]) => esc(v)).join(', ')}) no cubren todo. Un <b>tipo propio</b> sirve para situaciones no contempladas: una carta, un pódcast local, un documento interno, un apunte de clase…</p>
      <h4>Crear uno</h4><ol><li>Configuración → <b>Tipos de documento propios</b> → «+ Nuevo tipo». O, dentro de un paper, abre el desplegable <b>Tipo</b> y elige «➕ Crear un tipo propio…» (se crea y se asigna al paper).</li>
      <li><b>Nombre</b>: el que verás en el desplegable (aparece en el grupo «Tipos propios»).</li>
      <li><b>Se cita como</b>: el tipo predefinido que usarán los estilos de serie (APA, MLA…) y BibTeX/RIS para dar formato. Elige el más parecido.</li>
      <li><b>Campos del formulario</b>: marca cuáles se muestran (volumen, páginas, editorial, ISBN, institución, congreso, fecha completa, función del autor…). «Usar los campos de…» marca los del tipo elegido. Siempre están título, autores, año, URL, DOI y fecha de consulta.</li>
      <li><b>Etiquetas propias</b>: renombra cualquier campo para este tipo (por ejemplo «Revista / editorial / sitio» → «Canal»).</li></ol>
      <h4>Cómo se cita</h4><ul><li><b>Estilos de serie</b>: tratan el tipo propio como su «Se cita como». Solo ven los campos que ese tipo predefinido usa.</li>
      <li><b>Estilos propios</b>: ven <i>todos</i> los campos y pueden tener una <b>plantilla específica</b> para el tipo (en «Tipo de documento» del editor del estilo, el tipo propio aparece en la lista). Si no la hay, usan la plantilla por defecto.</li>
      <li><b>Eliminar</b> un tipo pasa sus papers al tipo «Se cita como» y quita las plantillas que tuvieran los estilos propios.</li></ul>`],
    estilos: ['Estilos de cita personalizados', `<p>Crea tu propio estilo de cita: una <b>plantilla por tipo de documento</b> con los campos del paper. Sale en Exportar y en la pestaña Cita junto a los de serie. Configuración → <b>Estilos de cita personalizados</b>.</p>
      <h4>Empezar</h4><ul><li><b>+ Nuevo estilo</b>: parte de una plantilla de artículo sencilla. <b>+ Nuevo a partir de…</b>: copia las plantillas de APA 7, Vancouver, MLA, IEEE, Chicago, UNE-ISO 690… (artículo, libro, capítulo, congreso, tesis, web y prensa; el resto usa la plantilla por defecto) para que las modifiques. <b>Duplicar</b> y <b>Eliminar</b> (si estaba en uso en Exportar, vuelve a APA).</li></ul>
      <h4>Opciones del estilo</h4><ul><li><b>Orden</b> de la bibliografía (alfabético o en el de la lista), <b>numerada</b> y formato del número, distinguir 2020a/2020b, formato de fechas y <b>idioma</b> de conectores y fechas.</li>
      <li><b>Autores y editores</b>: formato de cada persona (${Object.values(CU_AU).map(esc).join(' · ')}), separador, texto antes del último, límite «más de N autores» con cuántos se muestran y el texto «et al.», apellidos en mayúsculas y «solo el primero invertido».</li></ul>
      <h4>La plantilla</h4><p>Se escribe una por tipo de documento («Por defecto» vale para los que no tienen la suya). El texto sale tal cual y los datos se insertan así:</p>
      ${helpTbl([['<code>{campo}</code>', 'inserta el dato. Ej.: <code>{title}</code>'], ['<code>{campo:i}</code>', 'aplica un formato; se encadenan: <code>{title:i:q}</code>'], ['<code>{campo|texto}</code>', 'si el campo está vacío, usa «texto». Ej.: <code>{year|s.f.}</code>'],
        ['<code>[ … ]</code>', '<b>grupo opcional</b>: solo sale si todos los campos de dentro tienen valor. Ej.: <code>[, vol. {volume}]</code>'], ['<code>\\</code>', 'escapa el carácter siguiente: <code>\\[Internet\\]</code> escribe corchetes literales']])}
      <p>Los puntos, comas y espacios repetidos se limpian solos. Los asteriscos de los datos se escapan.</p>
      <h4>Campos disponibles</h4>${helpTbl(CU_F.map(([k, l]) => [`<code>{${k}}</code>`, esc(l)]))}
      <h4>Formatos (<code>{campo:formato}</code>)</h4>${helpTbl(Object.entries(CU_M).map(([k, v]) => [`<code>${k}</code>`, esc(v)]))}
      <h4>Opciones propias de cada campo</h4><p><b>Botón derecho sobre un campo</b> de la plantilla (o sobre su botón en la lista de campos) abre un panel con las opciones de ese campo y las escribe por ti como <code>{campo:opción=valor}</code>:</p>
      <ul><li><b>Autores y editores</b>: <code>fmt</code> (formato de cada persona), <code>sep</code>, <code>last</code> (antes del último), <code>max</code> y <code>show</code> (límite y cuántos se muestran), <code>etal</code> (texto «et al.»), <code>upper</code>, <code>fo</code> (solo el primero invertido) y los <b>formatos por autor</b> <code>first</code> y <code>each</code>, donde <code>{l}</code> es el apellido, <code>{L}</code> APELLIDO, <code>{g}</code> el nombre, <code>{i}</code> las iniciales con punto y <code>{n}</code> sin punto. Ej.: <code>first={L}, {g}</code> y <code>each={g} {L}</code> dan «PÉREZ, Juan y Ana GÓMEZ».</li>
      <li><b>Fechas</b> (<code>date</code>, <code>datey</code>, <code>accessed</code>): <code>fmt</code> (largo, ISO, d-m-a, mes año, como en Exportar) o un <code>pat</code> propio con <code>YYYY YY MMMM MMM MM M DD D</code>. Ej.: <code>{date:pat=D de MMMM de YYYY}</code>.</li>
      <li><b>Páginas</b>: <code>pp</code> («p.»/«pp.»), <code>dash</code> (raya) y <code>first</code> (solo la primera). <b>Edición</b>: <code>raw</code>.</li>
      <li><b>Cualquier campo</b>: <code>pre</code> y <code>suf</code> (texto antes y después que solo sale si hay valor) y los formatos de la tabla anterior.</li></ul>
      <h4>Cita en el texto</h4><p>Una plantilla opcional para la cita corta, con <code>{authorsShort}</code>, <code>{year}</code> y <code>{loc}</code> (la página citada). Se ve en la pestaña Cita si activas la cita en el texto en Configuración.</p>
      <h4>Vista previa</h4><p>Se actualiza al escribir. Elige «Un ejemplo» (con la opción «Ver el ejemplo en todos los tipos») o uno de tus papers para comprobar cómo queda.</p>
      <h4>Ejemplo</h4><p><code>[{authors}. ]({year|s.f.}). {title:i}. [{edition}. ][{place}: ]{venue}. [{link}]</code><br>→ «Pérez, J. C. (2021). <i>Título del libro</i>. 2.ª ed. Madrid: Editorial. https://…»</p>`],
    pwa: ['Aplicación instalada (PWA), sesión y actualizaciones', `<p>Puedes instalar la aplicación desde el navegador (icono de instalar en la barra de direcciones o «Instalar aplicación» en el menú). Funciona sin conexión.</p>
      <ul><li><b>Datos de la aplicación</b>: además de tu JSON, la aplicación guarda en el almacenamiento del navegador una <b>copia de la sesión</b> de cada proyecto (tus datos tal como los tienes ahora, aunque no hayas guardado) y el <b>estado de la interfaz</b> (filtros, orden, barra lateral plegada, bloques abiertos). Al volver a abrirla sigues donde lo dejaste; si había cambios sin guardar, un aviso te lo recuerda.</li>
      <li><b>Tu archivo JSON sigue siendo el original</b>: la copia de sesión no lo sustituye. Guarda (${kb('save')}) para escribir en el archivo; si la aplicación recuerda el archivo, te pedirá permiso para escribir en él.</li>
      <li><b>Instalar</b>: en «Información», bajo Configuración, el botón <b>Añadir app</b> la instala en este dispositivo (en los navegadores que no lo permiten, explica cómo). Solo aparece si la aplicación aún no está instalada.</li>
      <li><b>Actualizaciones</b>: la aplicación busca versiones nuevas sola (al abrirla, al volver a ella y cada media hora). Cuando hay una, aparece un aviso «Hay una versión nueva» con el botón <b>Recargar ahora</b>; antes de recargar guarda la copia de sesión. <b>No hace falta borrar los datos de la aplicación</b>: se guardan aparte de lo que se actualiza.</li>
      <li>Versión instalada: <b>v${APP_V}</b>. <button data-onclick="checkUpdate()">Buscar actualizaciones</button> <button class="danger" data-onclick="forgetAppData()" title="Borra de este navegador las copias de trabajo de los proyectos; no toca tus archivos JSON ni Google Drive">Olvidar la copia de sesión</button></li>
      <li>El navegador puede borrar los datos de los sitios si se queda sin espacio; la aplicación pide almacenamiento persistente para evitarlo, pero tu <b>JSON</b> sigue siendo la copia que debes conservar.</li></ul>`],
    sync: ['Sincronización con Google Drive', `<p>El icono <b>🔄</b> de la barra de arriba, a la izquierda de 💾 (sin conectar pone «Conectar con Google Drive»), guarda <b>todos tus proyectos</b> (papers, notas, secciones, etiquetas, papelera y ajustes) en una <b>carpeta oculta de tu propio Google Drive</b>, para tenerlos igual en el ordenador, la tablet y el móvil.</p>
      <ul><li><b>Conectar</b>: pulsa 🔄 → «Continuar», elige tu cuenta de Google y da permiso. Si en Drive ya había una biblioteca de otro dispositivo, eliges si combinarlas o quedarte con una.</li>
      <li><b>Autoguardado activado</b>: con la sesión iniciada, cada cambio se sube solo a los pocos segundos (solo lo que cambió, no la biblioteca entera), y al abrir la aplicación o volver a ella se traen los cambios de los otros dispositivos. La casilla «Autoguardado» lo activa o desactiva (sin ella, sincroniza a mano).</li>
      <li><b>El punto del icono</b>: verde, sincronizado; azul y girando, sincronizando; amarillo, cambios pendientes o hay que volver a conectar; rojo, error (se reintenta).</li>
      <li><b>Con la sesión iniciada, clic en 🔄</b>: sincronizar ahora, activar o desactivar el autoguardado, ver cómo funciona, <b>cerrar sesión</b> y <b>borrar mis datos de Google Drive</b> (borra la copia de Drive y cierra la sesión; lo de este dispositivo no se toca).</li>
      <li><b>Cómo se combinan</b>: paper a paper y campo a campo. Si cambias el mismo campo en dos dispositivos gana el cambio más reciente; un paper editado en uno no se pierde aunque lo borres en otro. Los cambios que llegan de Drive se pueden deshacer (${kb('undo')}).</li>
      <li><b>Cada hora Google corta el acceso</b> por seguridad (sin un servidor propio no se puede renovar sin abrir su ventana). La aplicación intenta renovarlo sola; si el navegador no lo deja, el punto se pone amarillo y se reconecta con tu <b>siguiente clic o tecla</b> (puede verse un instante la ventana de Google). No pierdes nada: los cambios esperan en el dispositivo y se suben al reconectar. El acceso se comparte entre pestañas y vale al reabrir la aplicación mientras no caduque.</li>
      <li><b>Qué se guarda en Drive</b>: una copia completa, un archivo pequeño con lo que cambió en cada autoguardado y cada imagen incrustada aparte, una sola vez aunque la uses en varios papers. Cuando se acumulan cambios, la copia completa se pone al día y se borran los sueltos; las imágenes que ya no usa nadie se borran pasado un día. Cada dispositivo solo descarga lo que aún no tiene.</li>
      <li><b>Sin límite de tamaño práctico</b>: lo que pasa de 4 MB se sube por partes (subida reanudable de Google Drive), sin configurar nada.</li>
      <li><b>Proyectos</b>: se sincroniza el proyecto abierto, la lista de proyectos (con sus nombres) y los ajustes comunes. Los proyectos creados en otro dispositivo salen en ▾ con ☁ y se descargan al abrirlos; renombrar o borrar un proyecto llega a los demás dispositivos.</li>
      <li>La vista (tarjetas o tabla) es de cada dispositivo y no se sincroniza. Tus archivos JSON siguen funcionando igual.</li></ul>`],
    atajos: ['Atajos de teclado', helpTbl(Object.keys(SC_NAMES).map(a => [esc(SC_NAMES[a]), kb(a)]).concat([['Esta ayuda', '<kbd>F1</kbd>'], ['Cerrar menús y ventanas', '<kbd>Esc</kbd>']])) + '<p>Se cambian en Configuración → Atajos de teclado. Dentro de campos de texto solo funciona «Guardar»; negrita y cursiva actúan dentro de una nota.</p>'],
    datos: ['Datos, privacidad y consejos', `<ul><li>Todo se queda en tu navegador y en tu archivo JSON. La aplicación solo sale a internet para <b>buscar un DOI en CrossRef</b>, para mostrar <b>imágenes por URL</b> y, si la activas, para la <b>sincronización con Google Drive</b>. Detalles en la <a href="privacidad.html" data-onclick="event.preventDefault();openPriv()">Política de privacidad</a> (enlace al final de la barra lateral).</li>
      <li>Funciona sin conexión una vez cargada (se puede instalar como aplicación). Las imágenes por URL y la búsqueda de DOI necesitan internet.</li>
      <li>Haz copias del JSON de vez en cuando: es tu única base de datos. La papelera guarda 5 días; el historial no se guarda.</li>
      <li>Las imágenes <b>enlazadas</b> solo se ven en el navegador donde las elegiste; si vas a llevar el JSON a otro equipo, usa la <b>copia incrustada</b> o una URL.</li>
      <li>Los estilos y tipos propios viajan dentro del JSON, así que se ven igual en cualquier navegador que lo abra.</li></ul>`]
  };
  return `<div class="dh"><h2>Ayuda</h2><div class="dbtn"><button data-onclick="$('#help').close()">Cerrar ✕</button></div></div>
    <input id="hpq" type="search" placeholder="Buscar en la ayuda…" data-oninput="helpFilter(this.value)" aria-label="Buscar en la ayuda">
    <div id="hpb">${Object.entries(S).map(([id, [t, b]]) => helpSec(id, t, b, id !== 'inicio')).join('')}<button id="hpMore" class="hpmore" data-onclick="hpMore()">${HP_ALL ? 'Ocultar el resto de la ayuda ▴' : `Ver toda la ayuda (${Object.keys(S).length - 1} temas) ▾`}</button></div>`;
}
function helpFilter(q) {
  q = norm(q).trim(); let n = 0; $('#hpMore').hidden = !!q;   // al buscar se busca en toda la ayuda
  document.querySelectorAll('#hpb > details').forEach(d => { const hit = !q || norm(d.textContent).includes(q); d.hidden = !hit || (!q && d.classList.contains('hprest') && !HP_ALL); if (hit) n++; if (q && hit) d.open = true; });
  $('#hpEmpty')?.remove(); if (!n) $('#hpb').insertAdjacentHTML('beforeend', '<p class="empty" id="hpEmpty">Nada encontrado.</p>');
}
function hpMore() { HP_ALL = !HP_ALL; $('#help').innerHTML = helpHTML(); }
function openHelp(id) {
  if (id) { HELP_OPEN.add(id); if (id !== 'inicio') HP_ALL = true; } $('#help').innerHTML = helpHTML(); if (!$('#help').open) $('#help').showModal();
  if (id) setTimeout(() => document.getElementById('hp_' + id)?.scrollIntoView({block: 'start'}));
}
document.addEventListener('keydown', e => { if (e.key === 'F1') { e.preventDefault(); openHelp(); } });
/* ---- Editor de tipos propios (Configuración) ---- */
let CTS = {id: ''};
const ctCur = () => db.settings.customTypes.find(c => c.id === CTS.id) || db.settings.customTypes[0] || null;
const ctTouch = () => { markDirty(); syncTypes(db.settings.customTypes); };
function ctNew(name = 'Tipo propio') {
  const c = ctClean({name: name + (db.settings.customTypes.length ? ' ' + (db.settings.customTypes.length + 1) : ''), like: 'articulo'}); db.settings.customTypes.push(c); CTS.id = c.id; ctTouch(); return c;
}
function ctUI() {
  const L = db.settings.customTypes, c = ctCur(); if (c) CTS.id = c.id;
  let h = `<small>Crea tipos de documento para lo que los predefinidos no contemplan. Eliges qué campos muestra el formulario y cómo se llaman, y aparecen en el desplegable «Tipo» de cada paper. <a data-onclick="openHelp('tipos')">Ver la ayuda</a></small>
    <div class="row" style="margin:8px 0">${L.length ? `<select data-onchange="put(CTS,'id',this.value,drawCfg)">${L.map(x => `<option value="${x.id}" ${c.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
    <button data-onclick="ctNew();drawCfg()">+ Nuevo tipo</button>${c ? '<button data-onclick="ctDup()">Duplicar</button><button class="danger" data-onclick="ctDel()">Eliminar</button>' : ''}</div>`;
  if (!c) return h + '<p class="empty">Aún no hay tipos propios.</p>';
  const inUse = db.papers.filter(p => p.type === 'ct_' + c.id).length;
  h += `<div class="cugrid"><label>Nombre<input value="${esc(c.name)}" maxlength="60" data-oninput="ctSet('name',this.value)"></label>
    <label>Se cita como (para los estilos de serie)<select data-onchange="ctSet('like',this.value);drawCfg()">${Object.entries(TYPES).filter(([k]) => !CTYPES.has(k)).map(([k, v]) => `<option value="${k}" ${c.like === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
    <div class="row" style="margin:6px 0"><small>${inUse ? `${inUse} paper${inUse > 1 ? 's usan' : ' usa'} este tipo.` : 'Ningún paper usa este tipo todavía.'}</small><button data-onclick="ctReset()" title="Marca los campos que muestra el tipo «${esc(TYPES[c.like])}»">Usar los campos de «${esc(TYPES[c.like])}»</button></div>
    <div class="cuh">Campos del formulario <small>(siempre están título, autores, año, URL, DOI y fecha de consulta)</small></div>
    <div class="ctf"><div class="ctr"><span>Revista / editorial / sitio</span><input value="${esc(c.labels.venue || '')}" placeholder="Etiqueta propia (p. ej. Medio, Canal, Emisora)" data-oninput="ctLabel('venue',this.value)"></div>
    ${Object.entries(CT_NAMES).map(([k, n]) => `<div class="ctr"><label class="row"><input type="checkbox" ${c.fields.includes(k) ? 'checked' : ''} data-onchange="ctField('${k}',this.checked)"> ${esc(n)}</label><input value="${esc(c.labels[k] || '')}" placeholder="Etiqueta propia" ${c.fields.includes(k) ? '' : 'disabled'} data-oninput="ctLabel('${k}',this.value)"></div>`).join('')}</div>
    <small>En un estilo propio puedes usar todos los campos con <code>{campo}</code> y darle a este tipo su plantilla (Configuración → Estilos de cita personalizados → «Tipo de documento»).</small>`;
  return h;
}
function ctSet(k, v) { const c = ctCur(); if (!c) return; c[k] = v; ctTouch(); }
function ctField(k, on) { const c = ctCur(); c.fields = on ? [...new Set([...c.fields, k])] : c.fields.filter(x => x !== k); ctTouch(); drawCfg(); }
function ctLabel(k, v) { const c = ctCur(); if (v.trim()) c.labels[k] = v; else delete c.labels[k]; ctTouch(); }
function ctReset() { const c = ctCur(); c.fields = ctFieldsOf(c.like); ctTouch(); drawCfg(); }
function ctDup() { const c = structuredClone(ctCur()); c.id = uid(); c.name += ' (copia)'; db.settings.customTypes.push(c); CTS.id = c.id; ctTouch(); drawCfg(); }
function ctDel() {
  const c = ctCur(), k = 'ct_' + c.id, n = db.papers.filter(p => p.type === k).length;
  if (!c || !confirm(`¿Eliminar el tipo «${c.name}»?${n ? ` ${n} paper${n > 1 ? 's pasarán' : ' pasará'} a «${TYPES[c.like]}».` : ''}`)) return;
  for (const p of db.papers.concat(db.trash.map(t => t.paper))) if (p.type === k) p.type = c.like;
  for (const s of db.settings.customStyles) delete s.tpl[k];
  db.settings.customTypes = db.settings.customTypes.filter(x => x.id !== c.id); CTS.id = ''; ctTouch(); syncStyles(db.settings.customStyles, db.settings.export); render(); drawCfg();
}
function typeChange(v) {   // desplegable «Tipo» del paper; la última opción crea un tipo propio al vuelo
  if (v === '__new') { const c = ctNew(); D.type = 'ct_' + c.id; CFG_OPEN.add('ct'); drawD(); openCfg('no'); return; }
  D.type = v; drawD();
}
$('#cfg').addEventListener('close', () => { if ($('#dlg').open) drawD(); });   // al volver del editor de tipos, el formulario se pone al día
const CFG_OPEN = new Set();   // apartados de Configuración desplegados (se conservan al redibujar)
const cfgSec = (id, title, body) => `<details class="cs" ${CFG_OPEN.has(id) ? 'open' : ''} data-ontoggle="setHas(CFG_OPEN,'${id}',this.open)"><summary>${title}</summary><div class="csb">${body}</div></details>`;
