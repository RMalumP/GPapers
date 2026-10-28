// Comprueba que no quedan manejadores en línea (on…="…") y que cada data-on…="…" se puede leer con el minilenguaje de js/modelo.js. Uso: node pruebas/prueba_eventos.js [carpeta]
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || '.', rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
const html = rd('index.html'), files = ['index.html', 'privacidad.html', ...[...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])];
const mod = rd('js/modelo.js'), cut = mod.slice(mod.indexOf('const ON_AST'), mod.indexOf('function onEval'));
const onParse = new Function(cut + '; return onParse;')();
let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('FALLA', name, '\n  got :', JSON.stringify(got), '\n  want:', JSON.stringify(want)); } };
function attrs(src) {   // valores de data-on…="…"; cada ${…} de las plantillas se sustituye por algo neutro
  const out = [], rx = /data-on([a-z]+)="/g; let m;
  while ((m = rx.exec(src))) {
    let i = rx.lastIndex, v = '';
    while (i < src.length && src[i] !== '"') {
      if (src[i] === '$' && src[i + 1] === '{') { let d = 0, j = i + 1; do { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } while (d && j < src.length);
        v += src[j] === '(' ? 'fnX' : '0'; i = j; } else v += src[i++];
    }
    out.push({ev: m[1], v: v.replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/&quot;/g, '"')});
  }
  return out;
}
const inline = [], broken = [], evs = new Set(), roots = new Set();
for (const f of files) {
  const src = rd(f);
  for (const m of src.matchAll(/[\s`'"]on([a-z]{3,})="/g)) inline.push(`${f}: on${m[1]}`);
  for (const a of attrs(src)) { evs.add(a.ev); try { const walk = x => { if (x.t === 'ref') { roots.add(x.root); x.ops.forEach(o => o.a && o.a.forEach(walk)); } else if (x.e) walk(x.e); else if (x.a) x.a.forEach(walk); }; onParse(a.v).forEach(walk); } catch (e) { broken.push(`${f}: ${a.v}`); } }
}
eq('no quedan manejadores en línea', inline, []);
eq('todos los data-on se pueden leer', broken, []);
const ON_EV = eval(mod.match(/const ON_EV = (\[[^\]]*\])/)[1]);
eq('cada evento usado está en ON_EV', [...evs].filter(e => !ON_EV.includes(e)), []);
eq('el minilenguaje lee llamadas, textos, listas y negaciones', onParse("a.b('x', \"y\", [1, -2], !c.d(), +this.value);e()").length, 2);
let threw = 0; for (const s of ["alert(1)+1", "a=1", "x => x", "(() => 1)()", "a['b']"]) { try { onParse(s); } catch (e) { threw++; } }
eq('y rechaza todo lo demás (asignaciones, funciones, operadores)', threw, 5);
fs.writeFileSync(path.join(require('os').tmpdir(), 'gpapers-roots.json'), JSON.stringify([...roots].sort()));
console.log(`${n - fail}/${n} pruebas correctas`); process.exit(fail ? 1 : 0);
