require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { pool, migrate, ensureDatabase } = require('./db');

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
  const [[ex]] = await pool.query('SELECT id FROM families WHERE email=?', [email.toLowerCase()]);
  if (ex) return res.status(409).json({ error: 'E-mail já cadastrado' });
  const [r] = await pool.query('INSERT INTO families (name,email,password_hash,parent_pin_hash) VALUES (?,?,?,?)',
    [name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), bcrypt.hashSync(String(pin), 10)]);
  req.session = { fid: r.insertId, parentUntil: Date.now() + PARENT_MIN * 60000 };
  res.json({ ok: true });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const k = 'l' + req.ip;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  const [[f]] = await pool.query('SELECT * FROM families WHERE email=?', [(req.body.email || '').toLowerCase()]);
  if (!f || !bcrypt.compareSync(req.body.password || '', f.password_hash)) { fail(k); return res.status(401).json({ error: 'E-mail ou senha incorretos' }); }
  req.session = { fid: f.id };
  res.json({ ok: true });
}));
app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.session?.fid) return res.json({ family: null });
  const [[f]] = await pool.query('SELECT name FROM families WHERE id=?', [req.session.fid]);
  if (!f) { req.session = null; return res.json({ family: null }); }
  res.json({ family: f.name, parent: isParent(req.session) });
}));

const needFamily = (req, res, next) => {
  if (!req.session?.fid) return res.status(401).json({ error: 'Faça login da família' });
  req.fid = req.session.fid; next();
};
app.post('/api/auth/parent', needFamily, wrap(async (req, res) => {
  const k = 'p' + req.fid;
  if (blocked(k)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  const [[f]] = await pool.query('SELECT parent_pin_hash FROM families WHERE id=?', [req.fid]);
  if (!bcrypt.compareSync(String(req.body.pin || ''), f.parent_pin_hash)) { fail(k); return res.status(401).json({ error: 'PIN incorreto' }); }
  req.session.parentUntil = Date.now() + PARENT_MIN * 60000;
  res.json({ ok: true });
}));
app.post('/api/auth/parent/exit', needFamily, (req, res) => { req.session.parentUntil = 0; res.json({ ok: true }); });

const needParent = (req, res, next) => isParent(req.session) ? next() : res.status(403).json({ error: 'Área do responsável' });

app.use('/api/admin', needFamily, needParent, require('./routes/admin'));
app.use('/api', needFamily, require('./routes/kid'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const port = process.env.PORT || 3000;
if (require.main === module) {
  (async () => {
    await ensureDatabase();
    await migrate();
    app.listen(port, '0.0.0.0', () => console.log(`GameTask rodando em http://localhost:${port}`));
  })().catch(e => { console.error('Falha ao iniciar:', e.message); process.exit(1); });
}
module.exports = app;
