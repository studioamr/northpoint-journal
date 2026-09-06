// copia la web de la app (index.html, css, js, data) a desktop-win/web para empaquetarla
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), dest = path.join(__dirname, 'web');
fs.rmSync(dest, {recursive: true, force: true}); fs.mkdirSync(dest, {recursive: true});
for(const f of ['index.html']) fs.copyFileSync(path.join(raiz, f), path.join(dest, f));
for(const d of ['css', 'js', 'data']) if(fs.existsSync(path.join(raiz, d))) fs.cpSync(path.join(raiz, d), path.join(dest, d), {recursive: true});
console.log('web copiada');
