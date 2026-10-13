// Çevrimdışı açılış güvencesi: js/ altındaki her modül sw.js ASSETS listesinde olmalı.
import fs from 'node:fs';
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const missing = fs.readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js') && !sw.includes('./js/' + f));
if (missing.length) { console.error('FAIL: sw.js önbelleğinde yok:', missing.join(', ')); process.exit(1); }
console.log('sw-assets PASS (' + fs.readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js')).length + ' modül)');
