// Comprueba que la versión de app.js coincide con la de sw.js y que el service worker guarda todo lo que carga index.html. Uso: node pruebas/prueba_version.js [carpeta]
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || '.', rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
const app = rd('app.js'), sw = rd('sw.js'), html = rd('index.html');
let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('FALLA', name, '\n  got :', JSON.stringify(got), '\n  want:', JSON.stringify(want)); } };
const appV = (app.match(/const APP_V = '([^']+)'/) || [])[1], swV = (sw.match(/const V = 'papers-v([^']+)'/) || [])[1];
eq('APP_V existe', !!appV, true);
eq('APP_V coincide con la versión de sw.js', appV, swV);
const files = JSON.parse((sw.match(/FILES = (\[[^\]]*\])/) || [, '[]'])[1].replace(/'/g, '"'));
const used = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
eq('sw.js guarda en caché todo lo que carga index.html', used.filter(f => !files.includes(f)), []);
eq('los archivos de sw.js existen', files.filter(f => f !== './' && !fs.existsSync(path.join(dir, f))), []);
console.log(`${n - fail}/${n} pruebas correctas`); process.exit(fail ? 1 : 0);
