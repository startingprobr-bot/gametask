// Arquivos do app que ficam DENTRO do celular (app Android): o app abre sem esperar a internet.
// O servidor publica a lista com a "impressão digital" de cada arquivo em /api/web-manifest; depois de um
// Deploy o app compara, baixa só o que mudou e passa a usar a versão nova sem reinstalar.
// O mesmo código monta a pasta www do APK (app-android/bundle.js), então os dois lados sempre batem.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
// pastas e páginas que o app usa (a página de vendas, os APKs e o service worker ficam só no site)
const DIRS = ['js', 'css', 'fonts', 'icons', 'img'];
const PAGES = ['ajuda.html', 'privacidade.html', 'manifest.json'];

function walk(root, rel, out) {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(root, r, out); else out.push(r);
  }
}

function build(PUB) {
  // versão = a mesma conta que o servidor usa para furar o cache (app.js, game.css, sw.js e index.html)
  const v = sha(['js/app.js', 'css/game.css', 'sw.js', 'index.html'].map(f => fs.readFileSync(path.join(PUB, f))).join('')).slice(0, 10);
  const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8')
    .replace('/js/app.js"', `/js/app.js?v=${v}"`).replace('/css/game.css"', `/css/game.css?v=${v}"`);
  const list = [];
  for (const d of DIRS) if (fs.existsSync(path.join(PUB, d))) walk(PUB, d, list);
  for (const p of PAGES) if (fs.existsSync(path.join(PUB, p))) list.push(p);
  const files = list.filter(p => !p.startsWith('css/landing')).sort().map(p => ({ p, h: sha(fs.readFileSync(path.join(PUB, p))).slice(0, 16) }));
  files.unshift({ p: 'index.html', h: sha(index).slice(0, 16), u: '/app' }); // a página do app já com a versão carimbada
  return { v, index, manifest: { v, files } };
}

module.exports = { build };
