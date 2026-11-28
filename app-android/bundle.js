// Monta app-android/www com os arquivos do app (os mesmos que o servidor lista em /api/web-manifest).
// Uso: node app-android/bundle.js && npx cap copy android (dentro de app-android) e depois compilar.
const fs = require('fs');
const path = require('path');
const { build } = require('../webbundle');

const PUB = path.join(__dirname, '../public'), WWW = path.join(__dirname, 'www');
const b = build(PUB);
fs.rmSync(WWW, { recursive: true, force: true });
for (const f of b.manifest.files) {
  const out = path.join(WWW, f.p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (f.p === 'index.html') fs.writeFileSync(out, b.index); else fs.copyFileSync(path.join(PUB, f.p), out);
}
// o app compara com esta lista para saber o que já tem dentro do APK
fs.writeFileSync(path.join(WWW, 'web-manifest.json'), JSON.stringify(b.manifest));
console.log(`www montado: versão ${b.v}, ${b.manifest.files.length} arquivos`);
