'use strict';
/* ===== Trabajo pesado fuera de la interfaz (v40): un Web Worker =====
   Normalizar y fusionar en cada vuelta de Google Drive (clonar + validate + JSON: ~300 ms con 2000 papers en un móvil) y leer un BibTeX o RIS grande
   se hacían en el mismo hilo que la interfaz, que se quedaba quieta mientras tanto. Aquí se cargan los mismos archivos de la app (el mismo código,
   sin copias que se desincronicen) con lo mínimo de «document» y «localStorage» para que carguen fuera de una página.
   Si el worker no se puede crear (desde file://) o falla, la app hace lo mismo en el hilo principal (ver wk() en js/drive.js). */
self.window = self;
const NOOP = () => {}, EL = () => ({classList: {contains: () => false, add: NOOP, remove: NOOP, toggle: NOOP}, style: {setProperty: NOOP}, dataset: {}, addEventListener: NOOP, removeEventListener: NOOP, setAttribute: NOOP, appendChild: NOOP, append: NOOP});
self.document = {addEventListener: NOOP, removeEventListener: NOOP, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: EL(), body: EL(), head: EL(), hidden: true, createElement: EL};
const MEM = new Map(); self.localStorage = {getItem: k => MEM.has(k) ? MEM.get(k) : null, setItem: (k, v) => { MEM.set(k, String(v)); }, removeItem: k => { MEM.delete(k); }};
self.matchMedia = () => ({matches: false, addEventListener: NOOP, addListener: NOOP});
importScripts('modelo.js', 'citas.js', 'persistencia.js', 'importar.js', 'drive.js');
self.onmessage = ({data: m}) => {
  try {
    let r;
    if (m.job === 'norm') r = syNormRaw(JSON.parse(m.s));
    else if (m.job === 'merge') r = syNormRaw(syMerge(JSON.parse(m.l), JSON.parse(m.r), m.b));
    else if (m.job === 'parse') r = impParse(m.t);
    else throw Error('trabajo desconocido: ' + m.job);
    postMessage({id: m.id, r});
  } catch (e) { postMessage({id: m.id, err: String(e?.message || e)}); }
};
