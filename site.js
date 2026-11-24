// Parte pública do site para o Google: robots.txt, sitemap.xml, páginas de conteúdo (iscas) e a captura de leads.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
const mail = require('./mail');

const PUB = path.join(__dirname, 'public');
const router = express.Router();
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });
// endereço oficial (APP_URL em produção); sem ele, o endereço de quem pediu
const site = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const ver = (f) => crypto.createHash('sha1').update(fs.readFileSync(path.join(PUB, f))).digest('hex').slice(0, 10);
const SITE_CSS_V = ver('css/site.css');

// Páginas indexáveis: caminho → arquivo. Entram no sitemap automaticamente.
const PAGES = {
  '/quadro-de-tarefas-infantil': 'quadro.html',
  '/privacidade': 'privacidade.html',
};
const page = (file) => (req, res) => {
  const html = fs.readFileSync(path.join(PUB, file), 'utf8')
    .replaceAll('{{SITE}}', site(req))
    .replaceAll('{{CONTATO}}', process.env.CONTACT_EMAIL || process.env.MAIL_FROM?.match(/[^<\s]+@[^>\s]+/)?.[0] || 'o e-mail que enviou a mensagem para você')
    .replace('/css/site.css"', `/css/site.css?v=${SITE_CSS_V}"`);
  res.set('cache-control', 'no-cache').type('html').send(html);
};
for (const [p, f] of Object.entries(PAGES)) router.get(p, page(f));

router.get('/robots.txt', (req, res) => res.type('text/plain').send(
  `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /painel\nDisallow: /api/\n\nSitemap: ${site(req)}/sitemap.xml\n`));

router.get('/sitemap.xml', (req, res) => {
  const day = (f) => fs.statSync(path.join(PUB, f)).mtime.toISOString().slice(0, 10);
  const urls = [['/', 'landing.html'], ...Object.entries(PAGES)].map(([p, f]) =>
    `  <url><loc>${site(req)}${p === '/' ? '/' : p}</loc><lastmod>${day(f)}</lastmod></url>`);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
});

// ---------- Leads ----------
const hits = new Map();
const tooMany = (ip) => { const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60000); r.push(now); hits.set(ip, r); return r.length > 8; };
const ICONS = new Set(fs.readdirSync(path.join(PUB, 'img/3d')).map(f => f.replace(/\.png$/, '')));
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

router.post('/api/public/leads', wrap(async (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  const b = req.body || {};
  const name = clean(b.name, 80), email = clean(b.email, 160).toLowerCase(), wa = String(b.whatsapp || '').replace(/\D/g, '');
  if (!name) return res.status(400).json({ error: 'Digite o seu nome' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Digite um e-mail válido' });
  if (wa && (wa.length < 10 || wa.length > 13)) return res.status(400).json({ error: 'WhatsApp com DDD, só números (ou deixe em branco)' });
  if (b.consent !== true) return res.status(400).json({ error: 'Marque a caixinha para receber o quadro' });
  const kids = (Array.isArray(b.kids) ? b.kids : []).map(k => clean(k, 30)).filter(Boolean).slice(0, 6);
  const tasks = (Array.isArray(b.tasks) ? b.tasks : []).map(t => ({ t: clean(t?.t, 40), i: ICONS.has(t?.i) ? t.i : 'star' })).filter(t => t.t).slice(0, 12);
  if (!kids.length) return res.status(400).json({ error: 'Escreva o nome de pelo menos uma criança' });
  if (!tasks.length) return res.status(400).json({ error: 'Escolha pelo menos uma tarefa' });
  const source = clean(b.source, 40) || 'quadro';
  const token = crypto.randomBytes(16).toString('hex');
  // o mesmo e-mail baixando de novo atualiza o quadro e mantém o link antigo
  await pool.query(`INSERT INTO leads (name,email,whatsapp,source,kids,tasks,token,consent_at) VALUES (?,?,?,?,?,?,?,NOW())
    ON DUPLICATE KEY UPDATE name=VALUES(name), whatsapp=COALESCE(VALUES(whatsapp),whatsapp), kids=VALUES(kids), tasks=VALUES(tasks),
      downloads=downloads+1, consent_at=NOW(), updated_at=NOW()`,
    [name, email, wa || null, source, JSON.stringify(kids), JSON.stringify(tasks), token]);
  const [[l]] = await pool.query('SELECT token,downloads FROM leads WHERE email=?', [email]);
  if (l.downloads === 1) mail.sendLeadMail(email, name.split(' ')[0], `${site(req)}/quadro-de-tarefas-infantil?q=${l.token}`).catch(e => console.error('e-mail lead', e.message));
  res.json({ ok: true, token: l.token });
}));

// reabre o quadro pelo link do e-mail
router.get('/api/public/leads/:token', wrap(async (req, res) => {
  const [[l]] = await pool.query('SELECT name,kids,tasks FROM leads WHERE token=?', [String(req.params.token).slice(0, 32)]);
  if (!l) return res.status(404).json({ error: 'Quadro não encontrado' });
  res.json({ name: l.name.split(' ')[0], kids: JSON.parse(l.kids || '[]'), tasks: JSON.parse(l.tasks || '[]') });
}));

module.exports = { router, site };
