require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { pool, migrate, ensureDatabase, getSetting } = require('./db');
const billing = require('./billing');
const mail = require('./mail');
const members = require('./members');
const site = require('./site');

const app = express();
const prod = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieSession({
  name: 'gt', keys: [process.env.SESSION_SECRET || 'dev-secret'],
  maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: prod,
}));
// App dos pais lembrado neste aparelho: o cabeçalho abre o painel só nos pedidos que vêm dele.
// O app das crianças no mesmo celular não manda o cabeçalho, então continua trancado.
const sha = (t) => require('crypto').createHash('sha256').update(String(t)).digest('hex');
app.use('/api', (req, res, next) => {
  const t = req.get('x-parent-device');
  if (!t || !req.session?.fid) return next();
  pool.query('SELECT d.member_id FROM parent_devices d JOIN members m ON m.id=d.member_id AND m.active=1 WHERE d.token_hash=? AND d.family_id=?', [sha(t), req.session.fid])
    .then(([[d]]) => { if (d) req.deviceActor = d.member_id; next(); }, next);
});

// Limitador simples de tentativas (senha/PIN)
const fails = new Map();
const recent = (k) => (fails.get(k) || []).filter(t => Date.now() - t < 60000);
const blocked = (k) => recent(k).length >= 8;
const fail = (k) => fails.set(k, [...recent(k), Date.now()]);

const PARENT_MIN = 30; // minutos de sessão do modo responsável
const isParent = (s) => !!(s.parentUntil && s.parentUntil > Date.now());
const parentReq = (req) => !!req.deviceActor || isParent(req.session);
const actorId = async (req) => req.deviceActor || req.session.actor || await members.principalId(req.session.fid);
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });

// ---- Auth da família ----
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, pin } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Nome e e-mail válidos são obrigatórios' });
  if ((password || '').length < 6) return res.status(400).json({ error: 'Senha com ao menos 6 caracteres' });
  if (!/^\d{4,8}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN do responsável: 4 a 8 números' });
  await members.dropStale(email.toLowerCase());
  if (await members.emailTaken(email.toLowerCase())) return res.status(409).json({ error: 'E-mail já cadastrado' });
  const trial = +(await getSetting('trial_days'));
  const [r] = await pool.query('INSERT INTO families (name,email,password_hash,parent_pin_hash,trial_ends) VALUES (?,?,?,?,DATE_ADD(CURDATE(), INTERVAL ? DAY))', // sem teste: vence ontem
    [name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), bcrypt.hashSync(String(pin), 10), trial > 0 ? trial : -1]);
  const [m] = await pool.query("INSERT INTO members (family_id,name,role,full_access,principal,pin_hash) VALUES (?,?,'Responsável',1,1,?)",
    [r.insertId, String(req.body.my_name || 'Responsável').trim().slice(0, 60) || 'Responsável', bcrypt.hashSync(String(pin), 10)]);
  req.session = { fid: r.insertId, mid: m.insertId, actor: m.insertId, parentUntil: Date.now() + PARENT_MIN * 60000 };
  res.json({ ok: true });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const k = 'l' + req.ip;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  const email = (req.body.email || '').toLowerCase().trim(), pw = req.body.password || '';
  const [[f]] = await pool.query('SELECT id,password_hash FROM families WHERE email=?', [email]);
  if (f && bcrypt.compareSync(pw, f.password_hash)) { req.session = { fid: f.id, mid: await members.principalId(f.id) }; return res.json({ ok: true }); }
  const [[m]] = await pool.query('SELECT id,family_id,password_hash FROM members WHERE email=? AND active=1', [email]);
  if (!m || !bcrypt.compareSync(pw, m.password_hash || '')) { fail(k); return res.status(401).json({ error: 'E-mail ou senha incorretos' }); }
  req.session = { fid: m.family_id, mid: m.id };
  res.json({ ok: true });
}));
// Esqueci a senha: resposta sempre igual (não revela se o e-mail existe)
app.post('/api/auth/forgot', wrap(async (req, res) => {
  const k = 'f' + req.ip;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  fail(k);
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Digite um e-mail válido' });
  const [[f]] = await pool.query('SELECT id,name,setup_pending FROM families WHERE email=?', [email]);
  const [[m]] = f ? [[]] : await pool.query('SELECT m.id,m.family_id,f.name FROM members m JOIN families f ON f.id=m.family_id WHERE m.email=? AND m.active=1', [email]);
  if (f?.setup_pending) mail.sendFinalizeMail(email, f.name, await mail.createResetLink(req, f.id, 72, null, 'finalizar')).catch(e => console.error('e-mail', e.message));
  else if (f) mail.sendResetMail(email, f.name, await mail.createResetLink(req, f.id)).catch(e => console.error('e-mail', e.message));
  else if (m) mail.sendResetMail(email, m.name, await mail.createResetLink(req, m.family_id, 1, m.id)).catch(e => console.error('e-mail', e.message));
  res.json({ ok: true });
}));
app.get('/api/auth/reset/:token', wrap(async (req, res) => res.json({ valid: await mail.peekReset(req.params.token) })));
app.post('/api/auth/reset', wrap(async (req, res) => {
  const k = 'r' + req.ip;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  if ((req.body.password || '').length < 6) return res.status(400).json({ error: 'Senha com ao menos 6 caracteres' });
  const r = await mail.consumeReset(req.body.token);
  if (!r) { fail(k); return res.status(400).json({ error: 'Este link venceu ou já foi usado. Peça um novo.' }); }
  const hash = bcrypt.hashSync(req.body.password, 10);
  if (r.member_id) await pool.query('UPDATE members SET password_hash=? WHERE id=? AND family_id=?', [hash, r.member_id, r.family_id]);
  else await pool.query('UPDATE families SET password_hash=? WHERE id=?', [hash, r.family_id]);
  req.session = { fid: r.family_id, mid: r.member_id || await members.principalId(r.family_id) };
  res.json({ ok: true });
}));
app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.session?.fid) return res.json({ family: null });
  const [[f]] = await pool.query('SELECT name,email,plan,paid_until,trial_ends,onboarded,setup_pending FROM families WHERE id=?', [req.session.fid]);
  if (!f) { req.session = null; return res.json({ family: null }); }
  const access = billing.access(f), parent = parentReq(req);
  const actor = parent ? members.pub(await members.member(req.session.fid, await actorId(req))) : null;
  const me = members.pub(await members.member(req.session.fid, req.session.mid));
  res.json({ family: f.name, pending: !!f.setup_pending, parent: parent && !!actor, actor, me, access, owner: !!access.owner && !!actor?.full, onboarded: !!f.onboarded });
}));

const needFamily = (req, res, next) => {
  if (!req.session?.fid) return res.status(401).json({ error: 'Faça login da família' });
  req.fid = req.session.fid; next();
};
app.post('/api/auth/parent', needFamily, wrap(async (req, res) => {
  const k = 'p' + req.fid;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  const pin = String(req.body.pin || '');
  const [ms] = await pool.query('SELECT * FROM members WHERE family_id=? AND active=1 ORDER BY (id=?) DESC, principal DESC', [req.fid, req.session.mid || 0]);
  const m = ms.find(x => bcrypt.compareSync(pin, x.pin_hash));
  if (!m) { fail(k); return res.status(401).json({ error: 'PIN incorreto' }); }
  members.openParent(req, m);
  res.json({ ok: true, name: m.name });
}));
app.post('/api/auth/parent/exit', needFamily, (req, res) => { req.session.parentUntil = 0; res.json({ ok: true }); });
// Lembrar o app dos pais neste aparelho (logo depois do PIN ou da digital): abre direto nas próximas vezes
app.post('/api/auth/parent/device', needFamily, wrap(async (req, res) => {
  if (!isParent(req.session)) return res.status(403).json({ error: 'Digite o PIN primeiro' });
  const mid = req.session.actor || await members.principalId(req.fid);
  const token = require('crypto').randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO parent_devices (family_id,member_id,token_hash) VALUES (?,?,?)', [req.fid, mid, sha(token)]);
  res.json({ token });
}));
app.delete('/api/auth/parent/device', needFamily, wrap(async (req, res) => {
  await pool.query('DELETE FROM parent_devices WHERE token_hash=? AND family_id=?', [sha(req.get('x-parent-device') || ''), req.fid]);
  res.json({ ok: true });
}));

// Painel aberto: carrega quem abriu (sessões antigas, sem "actor", contam como o responsável principal)
const needParent = (req, res, next) => {
  if (!parentReq(req)) return res.status(403).json({ error: 'Área do responsável' });
  actorId(req)
    .then(id => members.member(req.fid, id))
    .then(m => m ? (req.actor = m, next()) : (req.session.parentUntil = 0, res.status(403).json({ error: 'Área do responsável' })), next);
};
const needFull = (req, res, next) => req.actor?.full_access ? next() : res.status(403).json({ error: 'Só um responsável com acesso completo pode fazer isso' });

const needOwner = (req, res, next) => pool.query('SELECT email FROM families WHERE id=?', [req.fid])
  .then(([[f]]) => billing.isOwner(f) ? next() : res.status(403).json({ error: 'Área do dono do sistema' }), next);

app.get('/api/version', (req, res) => res.set('cache-control', 'no-store').json({ v: VERSION }));
app.use(site.router); // robots.txt, sitemap.xml, páginas de conteúdo e leads
app.use(require('./whatsapp').router); // mensagens que chegam no WhatsApp (Evolution) com o código das iscas
app.get('/api/public/pricing', wrap(async (req, res) => res.json({ ...await billing.prices(), card: billing.cardKey() })));
app.use('/api/auth', members.auth);
app.post(['/api/billing/checkout', '/api/billing/pix', '/api/billing/card', '/api/billing/free', '/api/billing/refund'], needFamily, needParent, needFull);
app.use('/api/billing', billing.router);
app.use('/api/owner', needFamily, needParent, needFull, needOwner, require('./routes/owner'));
app.use('/api/admin', needFamily, billing.needActive, needParent, members.limitDaily, members.admin, require('./routes/admin'));
app.use('/api', needFamily, billing.needActive, require('./routes/kid'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

// Página de vendas em "/" para quem não está logado; o app fica em "/app" (e em "/" para aparelhos já conectados)
const PUB = path.join(__dirname, 'public');
const brl = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Versão do app = impressão digital dos arquivos do front. Vai na URL do JS/CSS (fura cache) e o app
// aberto no celular compara com /api/version para se atualizar sozinho depois de um deploy.
const VERSION = require('crypto').createHash('sha1')
  .update(['js/app.js', 'css/game.css', 'sw.js', 'index.html'].map(f => fs.readFileSync(path.join(PUB, f))).join('')).digest('hex').slice(0, 10);
// a página de vendas também precisa furar o cache do CSS, senão o navegador mistura HTML novo com CSS velho
const LANDING_CSS_V = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(PUB, 'css/landing.css'))).digest('hex').slice(0, 10);
const INDEX = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8')
  .replace('/js/app.js"', `/js/app.js?v=${VERSION}"`).replace('/css/game.css"', `/css/game.css?v=${VERSION}"`);
// o app (e o painel disfarçado) não entra no Google: só a página de vendas e as páginas de conteúdo
const sendApp = (req, res) => res.set({ 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' }).type('html').send(INDEX);
app.get('/', wrap(async (req, res) => {
  if (req.session?.fid) return sendApp(req, res);
  const p = await billing.prices();
  const html = fs.readFileSync(path.join(PUB, 'landing.html'), 'utf8')
    .replaceAll('{{ANUAL}}', brl(p.annual)).replaceAll('{{MENSAL}}', brl(p.monthly))
    .replaceAll('{{ANUAL_MES}}', brl(Math.floor(p.annual / 12 * 100) / 100))
    .replaceAll('{{PLUS_MES}}', brl(Math.floor(p.plus / 12 * 100) / 100)).replaceAll('{{PLUS}}', brl(p.plus))
    .replaceAll('{{ECONOMIA}}', String(Math.max(0, Math.round((1 - p.annual / (p.monthly * 12)) * 100))))
    .replaceAll('{{GARANTIA}}', String(p.guarantee_days)).replaceAll('{{SITE}}', site.site(req))
    .replaceAll('{{ANUAL_NUM}}', (+p.annual).toFixed(2)).replaceAll('{{MENSAL_NUM}}', (+p.monthly).toFixed(2))
    .replace('/css/landing.css"', `/css/landing.css?v=${LANDING_CSS_V}"`);
  res.set('cache-control', 'no-cache').type('html').send(html);
}));
app.get('/app', sendApp);
// Área dos pais instalada à parte, com nome e ícone de disfarce (para a criança não reconhecer)
const DISGUISES = { banco: ['Banco', '#0e7a4f'], notas: ['Notas', '#f7c948'], agenda: ['Agenda', '#eef2f8'], clima: ['Clima', '#3a8ee6'], ajustes: ['Ajustes', '#6b7280'] };
const disguise = (q) => (DISGUISES[q] ? q : 'banco');
app.get('/painel', (req, res) => {
  const k = disguise(req.query.i), [name, color] = DISGUISES[k];
  const html = INDEX.replace('<title>GameTask</title>', `<title>${name}</title><meta name="apple-mobile-web-app-title" content="${name}">`)
    .replace('href="/manifest.json"', `href="/painel/manifest.json?i=${k}"`)
    .replace('href="/icons/icon-192.png"', `href="/icons/d/${k}-180.png"`)
    .replace('<meta name="theme-color" content="#2a6cf0">', `<meta name="theme-color" content="${color}">`);
  res.set({ 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' }).type('html').send(html);
});
app.get('/painel/manifest.json', (req, res) => {
  const k = disguise(req.query.i), [name, color] = DISGUISES[k];
  res.type('application/manifest+json').json({
    id: '/painel', name, short_name: name, start_url: `/painel?i=${k}`, scope: '/painel', display: 'standalone', orientation: 'any',
    background_color: color, theme_color: color,
    icons: [{ src: `/icons/d/${k}-192.png`, sizes: '192x192', type: 'image/png' }, { src: `/icons/d/${k}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  });
});
app.use(express.static(PUB, { index: false }));
app.get('*', sendApp);

const port = process.env.PORT || 3000;
if (require.main === module) {
  (async () => {
    await ensureDatabase();
    await migrate();
    require('./push').start();
    app.listen(port, '0.0.0.0', () => console.log(`GameTask rodando em http://localhost:${port}`));
  })().catch(e => { console.error('Falha ao iniciar:', e.message); process.exit(1); });
}
module.exports = app;
