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
const { trialText } = require('./util');

const app = express();
const prod = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieSession({
  name: 'gt', keys: [process.env.SESSION_SECRET || 'dev-secret'],
  maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: prod,
}));

// Limitador simples de tentativas (senha/PIN)
const fails = new Map();
const recent = (k) => (fails.get(k) || []).filter(t => Date.now() - t < 60000);
const blocked = (k) => recent(k).length >= 8;
const fail = (k) => fails.set(k, [...recent(k), Date.now()]);

const PARENT_MIN = 30; // minutos de sessão do modo responsável
const isParent = (s) => !!(s.parentUntil && s.parentUntil > Date.now());
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
  const [r] = await pool.query('INSERT INTO families (name,email,password_hash,parent_pin_hash,trial_ends) VALUES (?,?,?,?,DATE_ADD(CURDATE(), INTERVAL ? DAY))',
    [name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), bcrypt.hashSync(String(pin), 10), trial]);
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
  const access = billing.access(f), parent = isParent(req.session);
  const actor = parent ? members.pub(await members.member(req.session.fid, req.session.actor || await members.principalId(req.session.fid))) : null;
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

// Painel aberto: carrega quem abriu (sessões antigas, sem "actor", contam como o responsável principal)
const needParent = (req, res, next) => {
  if (!isParent(req.session)) return res.status(403).json({ error: 'Área do responsável' });
  (async () => req.session.actor || await members.principalId(req.fid))()
    .then(id => members.member(req.fid, id))
    .then(m => m ? (req.actor = m, next()) : (req.session.parentUntil = 0, res.status(403).json({ error: 'Área do responsável' })), next);
};
const needFull = (req, res, next) => req.actor?.full_access ? next() : res.status(403).json({ error: 'Só um responsável com acesso completo pode fazer isso' });

const needOwner = (req, res, next) => pool.query('SELECT email FROM families WHERE id=?', [req.fid])
  .then(([[f]]) => billing.isOwner(f) ? next() : res.status(403).json({ error: 'Área do dono do sistema' }), next);

app.get('/api/public/pricing', wrap(async (req, res) => res.json(await billing.prices())));
app.use('/api/auth', members.auth);
app.post(['/api/billing/checkout', '/api/billing/pix'], needFamily, needParent, needFull);
app.use('/api/billing', billing.router);
app.use('/api/owner', needFamily, needParent, needFull, needOwner, require('./routes/owner'));
app.use('/api/admin', needFamily, billing.needActive, needParent, members.limitDaily, members.admin, require('./routes/admin'));
app.use('/api', needFamily, billing.needActive, require('./routes/kid'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

// Página de vendas em "/" para quem não está logado; o app fica em "/app" (e em "/" para aparelhos já conectados)
const PUB = path.join(__dirname, 'public');
const brl = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sendApp = (req, res) => res.sendFile(path.join(PUB, 'index.html'));
app.get('/', wrap(async (req, res) => {
  if (req.session?.fid) return sendApp(req, res);
  const p = await billing.prices();
  const html = fs.readFileSync(path.join(PUB, 'landing.html'), 'utf8')
    .replaceAll('{{ANUAL}}', brl(p.annual)).replaceAll('{{MENSAL}}', brl(p.monthly))
    .replaceAll('{{ANUAL_MES}}', brl(Math.floor(p.annual / 12 * 100) / 100))
    .replaceAll('{{PLUS_MES}}', brl(Math.floor(p.plus / 12 * 100) / 100)).replaceAll('{{PLUS}}', brl(p.plus))
    .replaceAll('{{ECONOMIA}}', String(Math.max(0, Math.round((1 - p.annual / (p.monthly * 12)) * 100))))
    .replaceAll('{{TESTE}}', trialText(p.trial_days));
  res.set('cache-control', 'no-cache').type('html').send(html);
}));
app.get('/app', sendApp);
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
