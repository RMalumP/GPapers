'use strict';
/* ===== Visor de PDF (4 de 4): modo de lectura (doble página, página a página, desplazamiento automático), ajustes del visor,
   recorte de márgenes, marcadores y gestos de zoom. ===== */
/* ===== Modo de lectura (v39.39), en ⋯ → «📖 Modo de lectura» (submenú). Se recuerda en este dispositivo.
   · Doble página: las páginas de dos en dos, como un libro abierto (con «portada sola», la 1 va sola y luego 2-3, 4-5…).
   · Página a página: solo se ve la página actual (o el par), entera; un toque en el lado izquierdo o derecho pasa a la anterior o la siguiente
     (también ← →, y RePág/AvPág al llegar al borde). El centro sigue como siempre (subrayados, notas, toques de pantalla completa).
   · Desplazamiento automático: la página baja sola. Barra abajo con pausa, velocidad (🐢 barra 🐇) y ✕. Toques en la página: centro, pausa;
     izquierda, más despacio; derecha, más deprisa. Espera mientras el dedo está en la pantalla. Usa la vista continua. */
const VW_RD_K = 'gp-vw-read', VW_AUTO_K = 'gp-vw-auto';
function vwRdGet() { try { const o = JSON.parse(localStorage.getItem(VW_RD_K) || '{}'); return {two: !!o.two, cover: o.cover !== false, flip: !!o.flip, crop: !!o.crop, zPinch: o.zPinch !== false, zDbl: o.zDbl !== false, one: !!o.one, tbPos: o.tab === 'l' || o.tab === 'r' ? o.tab : 'c'}; } catch (e) { return {two: false, cover: true, flip: false, crop: false, zPinch: true, zDbl: true, one: false, tbPos: 'c'}; } }
function vwRdSave() { try { localStorage.setItem(VW_RD_K, JSON.stringify({two: VW.two, cover: VW.cover, flip: VW.flip, crop: VW.crop, zPinch: VW.zPinch, zDbl: VW.zDbl, one: VW.one, tab: VW.tbPos})); } catch (e) {} }
/* Doble página «de una en una» (v39.43, solo con página a página): al pasar, la de la derecha pasa a la izquierda y entra la siguiente
   (pares 1-2, 2-3, 3-4…; con portada: 1 sola y luego 2-3, 3-4…). Sin ella, de dos en dos como siempre. */
const vwOne = () => !!(VW.two && VW.flip && VW.one);
const vwSpread = i => !VW.two ? i : vwOne() ? (VW.cover && i <= 0 ? 0 : Math.max(VW.cover ? 1 : 0, Math.min(i, VW.pages.length - 2))) : VW.cover ? (i === 0 ? 0 : i - ((i - 1) % 2)) : i - i % 2;   // primera página del par
const vwSpreadN = i => !VW.two || VW.cover && i === 0 ? 1 : vwOne() ? Math.max(1, Math.min(2, VW.pages.length - i)) : 2;   // páginas del par que empieza en i
const vwRow = i => VW.flip ? 0 : !VW.two ? i : VW.cover ? (i + 1) >> 1 : i >> 1;   // filas por encima de la página i (huecos de VW_GAP)
const vwRdSum = () => [VW.two ? 'Doble página' + (vwOne() ? ' de una en una' : '') : 'Una página', VW.flip ? 'con toques' : 'seguido'].join(' · ') + (VW.zLock ? ' · 🔒' : '') + (VW.auto ? ' · automático' : '') + (VW.crop ? ' · sin márgenes' : '');
function vwRdClass() { const d = $('#vw'); if (!d) return; d.classList.toggle('two', !!VW.two); d.classList.toggle('cover', !!(VW.two && VW.cover)); d.classList.toggle('flip', !!VW.flip); d.classList.toggle('tabl', VW.tbPos === 'l'); d.classList.toggle('tabr', VW.tbPos === 'r'); vwLockShow(); }
function vwFlipShow() {   // página a página: solo se ven la actual y su pareja
  const s = vwSpread(VW.cur), n = vwSpreadN(s);
  for (const p of VW.pages) p.el.classList.toggle('cur', !!VW.flip && p.i >= s && p.i < s + n);
}
function vwStep(d) {   // página (o par) siguiente o anterior
  if (!VW.pages.length || vxColStep(d)) return; const s = vwSpread(VW.cur);   // v40.8: columna a columna
  vwGo(d > 0 ? s + (vwOne() ? 1 : vwSpreadN(s)) : vwSpread(Math.max(0, s - 1)));
}
function vwShowAt(p, y) {   // lleva a la vista el punto y (en puntos de la página) de la página p, a un tercio de la altura
  const sc = $('#vwScroll'); if (VW.flip && !p.el.classList.contains('cur')) vwGo(p.i, true);
  sc.scrollTo({top: p.el.offsetTop + y * VW.scale - sc.clientHeight / 3}); if (!VW.flip) VW.cur = vwSpread(p.i);
}
function vwReadTap(x, y, hadPop) {   // toque en una zona vacía de la página: lo usa el modo de lectura (devuelve true) o sigue como siempre
  if (hadPop) return false;   // el toque cerraba una ventanita
  const R = $('#vwScroll').getBoundingClientRect(), f = (x - R.left) / Math.max(1, R.width), z = f < .3 ? -1 : f > .7 ? 1 : 0;
  if (VW.auto) { if (z) vwAutoSpeed(z); else vwAutoPause(); return true; }
  if (VW.flip) { const p = pzAt(x, y, $('#vwScroll')); if (p) { vwStep(p); return true; } }   // v40.3: zonas a elegir (👆 Zonas para pasar)
  return false;
}
function vwRdSet(k, v) {
  if (VW.col && (k === 'flip' && !v || k === 'two' && v)) { vxColOff(); VW.fit = true; }   // v40.8: columna a columna va con página a página y una página
  VW[k] = !!v; const flipOn = k === 'one' && VW.one && VW.two && !VW.flip; if (flipOn) VW.flip = true;   // de una en una: se pasa con toques (página a página)
  vwRdSave(); if ((k === 'flip' || flipOn) && VW.flip && VW.auto) vwAutoStop();
  if (k === 'zPinch' || k === 'zDbl') return toast(VW[k] ? (k === 'zPinch' ? 'Pellizca con dos dedos para acercar o alejar.' : 'Doble toque: acerca donde tocas; otro doble toque vuelve a ajustar.') : 'Gesto desactivado.', [], 2200);
  if (k === 'crop') { if (VW.crop && !VW.cropM && VW.pages.length) return vwCropCalc(VW.gen, true); return vwCropShow(true); }
  const i = VW.cur; vwRdClass(); if (!VW.pages.length) return;
  if (k === 'one' && !flipOn) { vwFlipShow(); vwGo(i, true); return toast(VW.one ? 'Al pasar, la página de la derecha pasa a la izquierda y entra la siguiente.' : 'Al pasar, cambian las dos páginas.', [], 2400); }   // el tamaño no cambia (ni el candado)
  if (VW.zLock) vwLockSet(false, true);   // otra forma de ver las páginas: el tamaño vuelve a ajustarse
  vwFlipShow(); vwFitW(); vwGo(i, true);   // el zoom vuelve a «ajustar»: una página, dos o la página entera
  if (flipOn) toast('Doble página de una en una: toca a la derecha o a la izquierda para pasar (página a página).', [], 2800);
  else if (k === 'flip' && VW.flip) { toast(`Toca la página para pasar (zonas: ${pzName().toLowerCase()}; se cambian en 📖 Modo de lectura → 👆).`, [], 2800); pzShow(false); }
}
function vwReadMenu() {
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwMoreBack()">‹ Volver</button><hr><div class="ctxh">Páginas</div>
    <button data-onclick="vwRdSet('two',0)">${tick(!VW.two)}▯ Una página</button>
    <button data-onclick="vwRdSet('two',1)">${tick(VW.two)}▯▯ Doble página (como un libro)</button>
    ${VW.two ? `<button data-onclick="vwRdSet('cover',${VW.cover ? 0 : 1})">${tick(VW.cover)}La primera página sola (portada)</button>
    <button data-onclick="vwRdSet('one',0)">${tick(!vwOne())}⏩ Pasar de dos en dos</button>
    <button data-onclick="vwRdSet('one',1)" title="La de la derecha pasa a la izquierda y entra la siguiente (con página a página)">${tick(vwOne())}↪ Pasar de una en una</button>` : ''}
    <hr><div class="ctxh">Pasar de página</div>
    <button data-onclick="vwRdSet('flip',0)">${tick(!VW.flip)}↕ Desplazando (todo seguido)</button>
    <button data-onclick="vwRdSet('flip',1)">${tick(VW.flip)}👆 Página a página, con toques</button>
    ${VW.flip ? pzBtn(false) : ''}${VW.flip ? `<button data-onclick="vwLockSet(${VW.zLock ? 0 : 1})" title="No deja cambiar el zoom y, al pasar de página, se queda el mismo tamaño y la misma zona">${tick(VW.zLock)}🔒 Candado del tamaño <small class="vwsub">K</small></button>` : ''}
    <hr><button data-keep data-onclick="vwAutoMenu()">⏬ Desplazamiento automático <small class="vwsub">${VW.auto ? (VW.autoPaused ? 'en pausa' : 'en marcha') : 'parado'}${vwConcOn() ? ' · concentración' : ''} ›</small></button>
    <hr><button data-onclick="vwRdSet('crop',${VW.crop ? 0 : 1})" title="Quita los márgenes en blanco de las páginas para que el texto se vea más grande">${tick(VW.crop)}✂ Recortar los márgenes${VW.cropM?.hand ? ' (a mano)' : ' (automático)'}</button>
    ${VW.crop ? '<button data-keep data-onclick="lnCropMenu()">✂ Ajustar el recorte… <small class="vwsub">›</small></button>' : ''}
    ${vxReadBtns()}
    <hr><button data-keep data-onclick="lnRotate(VW.cur);vwReadMenu()">↻ Girar la página ${VW.cur + 1}${vwRot(VW.cur) ? ` <small class="vwsub">${vwRot(VW.cur)}°</small>` : ''}</button><button data-keep data-onclick="lnRotate('*');vwReadMenu()">↻ Girar todas las páginas</button>${Object.keys(VW.rot || {}).length ? '<button data-keep data-onclick="lnRotate(null);vwReadMenu()">↺ Quitar los giros</button>' : ''}${sayCan() ? '<hr>' + sayMenuBtn(false) : ''}
`);
}
/* ⚙ Ajustes del visor (v39.47, ⋯ → ⚙): lo que se elige una vez y se olvida, fuera de los submenús de lectura. Mismo panel en el PDF y en
   el EPUB (ep: sin lo que solo tiene el PDF). Todo se recuerda en el dispositivo, menos «Abrir los PDF» (Configuración, pdfTab) y la copia en el Drive normal (de cada PDF). */
const VW_LITE_K = 'gp-vw-lite';
const vwLitePref = () => { try { const v = localStorage.getItem(VW_LITE_K); return v === 'on' || v === 'off' ? v : 'auto'; } catch (e) { return 'auto'; } };
function vwLiteSet(v) { try { localStorage.setItem(VW_LITE_K, v); } catch (e) {} if (VW.open) { VW.lite = vwLiteWant(); $('#vw').classList.toggle('lite', VW.lite); } }
function vwSidePref(on) { try { localStorage.setItem('gp-vw-side', on ? '1' : '0'); } catch (e) {} }
function vwCfgHtml(ep) {
  const back = ep ? 'epMoreBack()' : 'vwMoreBack()', me = ep ? 'epCfgMenu()' : 'vwCfgMenu()', b = (on, fn, t, ti) => `<button data-keep data-onclick="${fn};${me}"${ti ? ` title="${ti}"` : ''}>${tick(on)}${t}</button>`;
  const pf = !ep && vwHolders()[0], desk = !vwMv() && !matchMedia('(pointer: coarse)').matches;
  return `<button data-keep data-onclick="${back}">‹ Volver</button><hr><div class="ctxh">⚙ Ajustes del visor</div>
    <div class="ctxh">🖍 Al cambiar el color de un subrayado</div>${b(annColOnly(), 'annColSet(1)', '🎯 Solo cambia ese subrayado')}${b(!annColOnly(), 'annColSet(0)', 'Ese y los siguientes (también el color para subrayar)')}
    ${ep ? '' : `<hr><div class="ctxh">👆 Gestos de zoom</div>${b(VW.zPinch, `vwRdSet('zPinch',${VW.zPinch ? 0 : 1})`, '🤏 Pellizcar con dos dedos')}${b(VW.zDbl, `vwRdSet('zDbl',${VW.zDbl ? 0 : 1})`, '👆 Doble toque: acercar y volver a ajustar', 'En pantalla completa el doble toque sigue sacando los colores')}
    <hr><div class="ctxh">⛶ Pantalla completa: pestaña ▾ de la barra oculta</div>${[['l', '◧ A la izquierda'], ['c', '▣ En el centro'], ['r', '◨ A la derecha']].map(([v, t]) => b(VW.tbPos === v, `vwTabPos('${v}')`, t)).join('')}
    <hr>${b(vxMapOn(), `vxMapSet(${vxMapOn() ? 0 : 1})`, '▮ Marcas junto a la barra de desplazamiento', 'Subrayados, marcadores y resultados de la búsqueda, a lo largo del PDF')}
    <hr><div class="ctxh">🌙 Modo noche y sepia</div>${[['off', '☀ Normal'], ['sepia', '📜 Sepia (más cálido)'], ['on', '🌙 Noche'], ['auto', 'Como el sistema (noche con el modo oscuro)']].map(([v, t]) => b(vwNightPref() === v, `vwNight('${v}')`, t)).join('')}`}
    ${rdCfgHtml(b, ep)}
    <hr><div class="ctxh">Aa Tamaño del texto de la interfaz</div><div class="epmrow">${UI_FZ.map(z => `<button data-keep class="${uiFz() === z ? 'on' : ''}" data-onclick="uiFzSet(${z});${me}">${Math.round(z * 100)} %</button>`).join('')}</div>
    <hr><div class="ctxh">📂 Al abrir</div>${desk ? `${b(db.settings.pdfTab !== 'app', "setCfg('pdfTab','tab')", 'Los PDF, en una pestaña nueva')}${b(db.settings.pdfTab === 'app', "setCfg('pdfTab','app')", 'Los PDF, dentro de la aplicación')}` : ''}${b(vwSideOn(), `vwSidePref(${vwSideOn() ? 0 : 1})`, 'Con el panel de anotaciones abierto (pantallas anchas)')}
    ${pf ? b(pdfVisOf(pf), 'vwVis()', '☁ Guardar este PDF también en mi Drive normal (con los subrayados)') : ''}
    <hr><div class="ctxh">⚡ Rendimiento: modo ligero</div>${[['auto', 'Automático (móviles con poca memoria)'], ['on', 'Siempre'], ['off', 'Nunca']].map(([v, t]) => b(vwLitePref() === v, `vwLiteSet('${v}')`, t, 'Menos resolución y menos páginas en memoria: más fluido en móviles de gama baja')).join('')}
    ${desk ? `<hr><button data-keep data-onclick="${ep ? 'epKeysHelp()' : 'vwKeysHelp()'}">⌨ Atajos de teclado <small class="vwsub">? ›</small></button>` : ''}`;
}
function vwCfgMenu() { vwMenu(VW.menuR, vwCfgHtml(false)); }
function vwTabPos(v) { VW.tbPos = v === 'l' || v === 'r' ? v : 'c'; vwRdSave(); vwRdClass(); }   // v39.43: dónde va la pestaña que saca la barra (en el móvil, abajo)

/* Candado del tamaño (v39.43), en página a página: no deja cambiar el zoom (botones, Ctrl + rueda, pellizco, doble toque, «ajustar»)
   y, al pasar de página, se quedan el tamaño y la zona que veías. Botón 🔓/🔒 en la barra; en pantalla completa, en una esquina y casi transparente.
   Dura mientras el PDF está abierto; salir de página a página (o cambiar a una o dos páginas) lo quita.
   v39.46: con el candado la hoja tampoco se mueve (ni con el dedo, ni con dos dedos, ni con la rueda; las teclas solo pasan de página). */
function vwLockSet(on, quiet) {
  on = !!on; if (on && !VW.flip) return toast('El candado del tamaño es para página a página (⋯ → 📖 Modo de lectura).', [], 2400);
  if (!!VW.zLock === on) return vwLockShow(); VW.zLock = on; if (on) VW.fit = false;   // se queda la escala exacta, también si cambia la ventana
  vwLockShow(); if (!quiet) toast(on ? '🔒 Hoja fija: no cambia el tamaño ni se mueve; solo se pasa de página (y se queda la misma zona).' : '🔓 Tamaño libre: ya puedes acercar y alejar.', [], 2200);
}
function vwLockShow() {
  const d = $('#vw'); if (!d) return; d.classList.toggle('zlock', !!VW.zLock);
  for (const b of d.querySelectorAll('.vwlk')) { b.textContent = VW.zLock ? '🔒' : '🔓'; b.title = (VW.zLock ? 'Tamaño bloqueado: toca para desbloquear' : 'Bloquear el tamaño: no cambia el zoom y, al pasar de página, se queda la misma zona') + ' (K)'; b.setAttribute('aria-pressed', VW.zLock ? 'true' : 'false'); }
}
function vwLockToggle() { vwLockSet(!VW.zLock); }
function vwLocked() { if (!VW.zLock) return false; toast('🔒 La hoja está bloqueada. Toca el candado para moverla o cambiar el tamaño.', [], 1800); return true; }
function vwAutoMenu() {   // submenú del desplazamiento automático (v39.41): empezar o parar, velocidad y modo concentración
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwReadMenu()">‹ Volver</button><hr>
    <button data-onclick="${VW.auto ? 'vwAutoStop()' : 'vwAutoStart()'}">${VW.auto ? '⏹ Parar el desplazamiento automático' : '▶ Empezar el desplazamiento automático'}</button>
    <div class="ctxh">Velocidad: ${vwAutoFmt(VW.auto ? VW.autoLv : vwAutoLv())} de 20</div>
    <button data-keep data-onclick="vwAutoSpeed(-1);vwAutoMenu()">🐢 Más despacio</button><button data-keep data-onclick="vwAutoSpeed(1);vwAutoMenu()">🐇 Más deprisa</button>
    <hr><button data-onclick="vwConcSet(${vwConcOn() ? 0 : 1})" title="Mientras la página baja sola, oculta las barras y los menús; un toque en la página los vuelve a sacar (y pausa)">${tick(vwConcOn())}🧘 Modo concentración</button>
    <div class="vwhint">Oculta las barras y los menús mientras baja. Un toque en la página (o Esc) los saca y pausa; otro toque en el centro sigue y los vuelve a ocultar. Tecla C.</div>`);
}
function vwMoreBack() { vwMore({stopPropagation() {}, currentTarget: {getBoundingClientRect: () => VW.menuR}}); }

/* Desplazamiento automático: velocidad de 1 a 20, en puntos del PDF por segundo (sigue igual al hacer zoom) */
const vwAutoLv = () => { try { const v = +localStorage.getItem(VW_AUTO_K); return v >= 1 && v <= 20 ? Math.round(v * 2) / 2 : 7; } catch (e) { return 7; } };
const vwAutoR = v => Math.max(1, Math.min(20, Math.round(+v * 2) / 2 || 7));   // v39.47: también medios puntos (7, 7,5, 8…)
const vwAutoFmt = v => String(v).replace('.', ',');
const vwAutoPts = l => 2 * Math.pow(1.2, l - 1);
function vwAutoBar() {
  let b = $('#vwAuto'); if (b) return b;
  vw$('.vwbody').insertAdjacentHTML('beforeend', `<div id="vwAuto" class="vwfloat" role="toolbar" aria-label="Desplazamiento automático" hidden>
    <button class="vwib vwap" data-onclick="vwAutoPause()" title="Pausa (barra espaciadora, o toque en el centro de la página)" aria-label="Pausa">⏸</button>
    <button class="vwib" data-onclick="vwAutoSpeed(-1)" title="Más despacio (toque a la izquierda de la página)" aria-label="Más despacio">🐢</button>
    <input id="vwAutoR" type="range" min="1" max="20" step="0.5" aria-label="Velocidad" data-oninput="vwAutoSet(this.value)">
    <button class="vwib" data-onclick="vwAutoSpeed(1)" title="Más deprisa (toque a la derecha de la página)" aria-label="Más deprisa">🐇</button>
    <span id="vwAutoV"></span>
    <button class="vwib vwcb" data-onclick="vwConcSet(!vwConcOn())" title="Modo concentración: oculta las barras mientras baja; un toque las saca (C)" aria-label="Modo concentración">🧘</button>
    <button class="vwib" data-onclick="vwAutoStop()" title="Parar el desplazamiento automático" aria-label="Parar">✕</button></div>`);
  return $('#vwAuto');
}
/* Modo concentración (v39.41, submenú del desplazamiento automático): mientras baja sola, sin barras, menús ni ventanitas (ni el puntero del ratón).
   Un toque en cualquier sitio de la página, Esc o la barra espaciadora pausan y las sacan; seguir (toque en el centro) las vuelve a ocultar.
   Se recuerda en este dispositivo (gp-vw-conc). */
const VW_CONC_K = 'gp-vw-conc';
function vwConcOn() { try { return localStorage.getItem(VW_CONC_K) === '1'; } catch (e) { return false; } }
function vwConcSet(on) {
  try { localStorage.setItem(VW_CONC_K, on ? '1' : '0'); } catch (e) {}
  if (on && !VW.auto) vwAutoStart(); else if (VW.auto) vwAutoShow(); else vwConcShow();
  if (on) toast('Modo concentración: toca la página para sacar las barras.', [], 2600);
}
const vwConcHidden = () => !!(VW.open && VW.auto && !VW.autoPaused && vwConcOn());
function vwConcShow() {
  const d = $('#vw'); if (!d) return; const h = vwConcHidden(), was = d.classList.contains('conc'); d.classList.toggle('conc', h);
  if (h && !was) { const m = $('#vwMenu'); if (m) m.hidden = true; vwPopClose(); vwColClose(); $('#vwSel').hidden = true; $('#vwPgTip').hidden = true; }
}
function vwConcTap() { if (!vwConcHidden()) return false; vwAutoPause(true); return true; }   // con las barras ocultas, un toque solo las saca
function vwAutoShow() {
  vwConcShow(); wlSync(); const b = vwAutoBar(); b.hidden = !VW.auto; if (!VW.auto) return;
  b.querySelector('.vwcb').classList.toggle('on', vwConcOn()); $('#vwAutoR').value = VW.autoLv; $('#vwAutoV').textContent = vwAutoFmt(VW.autoLv); b.classList.toggle('paused', !!VW.autoPaused);
  const p = b.querySelector('.vwap'); p.textContent = VW.autoPaused ? '▶' : '⏸'; p.title = (VW.autoPaused ? 'Seguir' : 'Pausa') + ' (barra espaciadora, o toque en el centro de la página)'; p.ariaLabel = VW.autoPaused ? 'Seguir' : 'Pausa';
}
function vwAutoStart() {
  if (!VW.open) return;
  if (VW.flip) { vxColOff(); VW.flip = false; VW.zLock = false; vwRdSave(); const i = VW.cur; vwRdClass(); vwFlipShow(); vwFitW(); vwGo(i, true); toast('El desplazamiento automático usa la vista seguida.', [], 2200); }
  Object.assign(VW, {auto: true, autoPaused: false, autoHold: false, autoLv: vwAutoLv(), autoY: $('#vwScroll').scrollTop, autoT: 0});
  vwAutoShow(); cancelAnimationFrame(VW.autoRaf); VW.autoRaf = requestAnimationFrame(vwAutoTick);
}
function vwAutoStop() { if (!VW.auto) return; VW.auto = false; cancelAnimationFrame(VW.autoRaf); vwAutoShow(); }
function vwAutoPause(on) {
  if (!VW.auto) return; VW.autoPaused = on ?? !VW.autoPaused;
  if (!VW.autoPaused) { const sc = $('#vwScroll'); VW.autoY = sc.scrollTop; VW.autoT = 0; if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) VW.autoPaused = true; }   // al final no hay nada más
  vwAutoShow();
}
function vwAutoSet(v) { VW.autoLv = vwAutoR(v); try { localStorage.setItem(VW_AUTO_K, VW.autoLv); } catch (e) {} vwAutoShow(); }
function vwAutoSpeed(d) { vwAutoSet((VW.auto ? VW.autoLv : vwAutoLv()) + d / 2); toast(`Velocidad ${vwAutoFmt(VW.autoLv)} de 20`, [], 900); }   // cada paso, medio punto
function vwAutoTick(t) {
  if (!VW.auto || !VW.open) return; VW.autoRaf = requestAnimationFrame(vwAutoTick);
  const dt = VW.autoT ? Math.min(.1, (t - VW.autoT) / 1000) : 0; VW.autoT = t;
  if (VW.autoPaused || VW.autoHold || VW.pinch || VW.drag || VW.pan || !dt) return;
  const sc = $('#vwScroll'); if (Math.abs(sc.scrollTop - VW.autoY) > 3) VW.autoY = sc.scrollTop;   // se movió a mano: sigue desde ahí
  VW.autoY += vwAutoPts(VW.autoLv) * VW.scale * dt; sc.scrollTop = VW.autoY;
  if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) { vwAutoPause(true); toast('Final del PDF.', [], 1500); }
}

/* ===== Recorte de márgenes, marcadores y gestos de zoom (v39.40) =====
   · ✂ Recortar los márgenes (⋯ → 📖 Modo de lectura): se pintan en pequeño unas cuantas páginas repartidas por el PDF y se mide dónde hay tinta;
     el mismo recorte para todas (la página no baila al pasar), tolerando una página distinta (una portada a sangre). La página sigue entera por dentro
     (márgenes negativos + clip-path), así las coordenadas de subrayados, notas y búsqueda no cambian. Se recuerda en el dispositivo (gp-vw-read).
   · 🔖 Marcadores (⋯ → 🔖 Marcadores, tecla B, [ y ]): páginas marcadas, guardadas con el PDF del paper («bm», se sincronizan y se deshacen).
   · Gestos de zoom: pellizcar con dos dedos y doble toque (acerca donde tocas; otro doble toque vuelve a ajustar). Se pueden quitar en el submenú.
     En pantalla completa el doble toque sigue sacando los colores (v39.38). */
const vwCropOn = () => VW.crop && VW.cropM?.any ? VW.cropM : null;
function vwVisRect(p) {   // la parte de la página que se ve (sin los márgenes recortados), en la pantalla
  const r = p.el.getBoundingClientRect(), c = vwCropOn(); if (!c) return r; const k = r.width / p.w;
  return {left: r.left + c.l * k, top: r.top + c.t * k, right: r.right - c.r * k, bottom: r.bottom - c.b * k, width: r.width - (c.l + c.r) * k, height: r.height - (c.t + c.b) * k};
}
function vwCropShow(refit) {
  const d = $('#vw'), P = $('#vwPages'); if (!d || !P) return; const c = vwCropOn(), a = refit && VW.pages.length ? vwAnchor() : null;
  d.classList.toggle('crop', !!c); for (const k of ['t', 'r', 'b', 'l']) c ? P.style.setProperty('--c' + k, c[k].toFixed(1) + 'px') : P.style.removeProperty('--c' + k);
  if (!refit || !VW.pages.length) return;
  if (VW.fit) vwFitW(true);
  if (VW.flip) vwGo(VW.cur, true); else vwAnchorSet(a);
}
function vwInkBox(img) {   // el rectángulo con tinta de una página pintada en pequeño (null: página en blanco)
  const {width: w, height: h, data: D} = img; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0, o = y * w * 4; x < w; x++, o += 4) {
    if (Math.min(D[o], D[o + 1], D[o + 2]) < 215) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : {x0, y0, x1: x1 + 1, y1: y1 + 1};
}
async function vwCropCalc(gen, show) {
  const cs = lnCropSaved(); if (cs) { VW.cropM = {...cs, any: cs.t + cs.b + cs.l + cs.r > .5, hand: true}; if (VW.crop) vwCropShow(true); return; }   // v39.52: el que ajustaste a mano
  const N = VW.pages.length; if (!N || !VW.doc) return; const S = Math.min(N, 9);
  const idx = [...new Set(Array.from({length: S}, (_, k) => Math.round(k * (N - 1) / Math.max(1, S - 1))))], M = {t: [], r: [], b: [], l: []};
  for (const i of idx) {
    const p = VW.pages[i];
    try { p.proxy ||= await VW.doc.getPage(i + 1); } catch (e) { continue; } if (gen !== VW.gen) return;
    const v1 = vwGV(p, {scale: 1}), k = 200 / v1.width, vp = vwGV(p, {scale: k});
    const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); const ctx = cv.getContext('2d', {alpha: false, willReadFrequently: true});
    try { await p.proxy.render({canvasContext: ctx, viewport: vp}).promise; } catch (e) { continue; } if (gen !== VW.gen) return;
    const b = vwInkBox(ctx.getImageData(0, 0, cv.width, cv.height)); cv.width = cv.height = 0; if (!b) continue;
    M.l.push(b.x0 / k); M.t.push(b.y0 / k); M.r.push(v1.width - b.x1 / k); M.b.push(v1.height - b.y1 / k);
  }
  if (gen !== VW.gen) return;
  const p0 = VW.pages[0], pick = L => { if (!L.length) return 0; L.sort((a, b) => a - b); return L[L.length >= 4 ? 1 : 0]; };   // con 4 o más, se tolera una página distinta
  const c = {}; for (const [k, lim] of [['t', p0.h], ['b', p0.h], ['l', p0.w], ['r', p0.w]]) c[k] = Math.max(0, Math.min(lim * .3, pick(M[k]) - 6));   // 6 puntos de aire
  c.any = c.t + c.b + c.l + c.r > 8; VW.cropM = c;
  if (VW.crop) { vwCropShow(true); if (show && !c.any) toast('Este PDF casi no tiene márgenes que recortar.', [], 2500); }
}

/* Marcadores rápidos */
const vwBms = () => vwHolders()[0]?.bm || [];
function vwBmSet(L) {
  const hs = vwHolders(); if (!hs.length) return; L = bmClean(L);
  for (const h of hs) { if (L.length) h.bm = [...L]; else delete h.bm; if (VW.src.kind === 'inbox') h.up = vwNow(); }
  const P = VW.src.kind === 'paper' && db.papers.find(p => p.id === VW.src.id); if (P && hs.includes(P[pdfF(VW.src.n)])) P.modified = vwNow();
  VW.dirty = true; markDirty(); vwBmDraw(); vwSatPush();
}
function vwBmDraw() { const S = new Set(vwBms()); for (const p of VW.pages) p.el?.classList.toggle('bm', S.has(p.i)); vxMapDraw(); }
function vwBmToggle(i = VW.cur) {
  if (!VW.pages[i]) return; const L = vwBms(), on = L.includes(i);
  vwBmSet(on ? L.filter(x => x !== i) : [...L, i]);
  toast(on ? `Marcador quitado de la página ${i + 1}.` : `🔖 Marcador en la página ${i + 1}.`, on ? [{t: 'Deshacer', fn: () => undo()}] : [], 1800);
}
function vwBmStep(d) {   // al marcador siguiente o anterior (desde la página, o el par, que se ve)
  const L = vwBms(); if (!L.length) return toast('Aún no hay marcadores: pon uno con ⋯ → 🔖 Marcadores (o la tecla B).', [], 2500);
  const s = vwSpread(VW.cur), e = s + vwSpreadN(s) - 1, i = d > 0 ? L.find(x => x > e) : L.findLast(x => x < s);
  if (i == null) return toast(d > 0 ? 'No hay más marcadores después de esta página.' : 'No hay más marcadores antes de esta página.', [], 1800);
  vxGoH(i); if (VW.fs) vwPgTip();   // v40.8: con «atrás»
}
function vwBmClear() { const n = vwBms().length; if (!n) return; vwBmSet([]); toast(`${n} ${n === 1 ? 'marcador quitado' : 'marcadores quitados'}.`, [{t: 'Deshacer', fn: () => undo()}], 4000); }
function vwBmMenu() {
  const L = vwBms(), c = VW.cur + 1, on = L.includes(VW.cur);
  vwMenu(VW.menuR, `<button data-keep data-onclick="vwMoreBack()">‹ Volver</button><hr>
    <button data-onclick="vwBmToggle()">${on ? `✕ Quitar el marcador de la página ${c}` : `🔖 Marcar la página ${c}`} <small class="vwsub">B</small></button>
    ${L.length ? `<button data-onclick="vwBmStep(-1)">⤒ Marcador anterior <small class="vwsub">[</small></button><button data-onclick="vwBmStep(1)">⤓ Marcador siguiente <small class="vwsub">]</small></button>
    <hr><div class="ctxh">Marcadores (${L.length})</div><div class="vwbml">${L.map(i => `<button data-onclick="vxGoH(${i})">${i === VW.cur ? '▸ ' : ''}🔖 Página ${i + 1}</button>`).join('')}</div>
    <button data-onclick="vwBmClear()">🗑 Quitar todos</button>` : '<p class="vwbme">Aún no hay marcadores. Marca una página para volver a ella de un toque; se guardan con este PDF.</p>'}`);
}

/* Toques en una zona vacía: en pantalla completa, colores y barras (vwTaps); si no, el doble toque acerca o vuelve a ajustar */
function vwEmptyTap(x, y) {
  if (VW.fs) return vwTaps(x, y);
  if (!VW.zDbl) return; const now = Date.now(), t = VW.dbl;
  if (t && now - t.t < 400 && Math.hypot(t.x - x, t.y - y) < 40) { VW.dbl = null; return vwDblZoom(x, y); }
  VW.dbl = {x, y, t: now};
}
function vwDblZoom(x, y) {
  if (vwLocked()) return;
  if (VW.fit || VW.scale < (VW.fitS || VW.scale) * 1.15) { VW.fit = false; vwScaleSet((VW.fitS || VW.scale) * 2.2, {x, y}); }
  else vwFitW();
}
