// Responsáveis da família: convite por link, PIN de cada um, digital/rosto (WebAuthn) e permissões.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const wa = require('@simplewebauthn/server');
const { pool } = require('./db');

const PARENT_MIN = 30; // minutos do painel dos pais aberto
const INVITE_DAYS = 7;
const sha = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });
const bool = (v) => (v ? 1 : 0);
const ROLES = ['Pai', 'Mãe', 'Babá', 'Avó', 'Avô', 'Tia', 'Tio', 'Responsável'];
const role = (r) => ROLES.includes(r) ? r : 'Responsável';
const cleanName = (n) => String(n || '').trim().slice(0, 60);

const principalId = async (fid) => (await pool.query('SELECT id FROM members WHERE family_id=? AND principal=1', [fid]))[0][0]?.id || null;
async function member(fid, id) {
  if (!id) return null;
  const [[m]] = await pool.query('SELECT * FROM members WHERE id=? AND family_id=? AND active=1', [id, fid]);
  return m || null;
}
// E-mail já usado por uma família ou por um responsável convidado?
async function emailTaken(email) {
  const [[a]] = await pool.query('SELECT 1 x FROM families WHERE email=?', [email]);
  const [[b]] = await pool.query('SELECT 1 x FROM members WHERE email=?', [email]);
  return !!(a || b);
}
// Cadastro iniciado na página de vendas e abandonado (sem pagamento): libera o e-mail para quem quiser usá-lo de verdade.
async function dropStale(email) {
  const [[f]] = await pool.query('SELECT id FROM families WHERE email=? AND setup_pending=1', [email]);
  if (!f) return;
  const [[p]] = await pool.query("SELECT 1 x FROM payments WHERE family_id=? AND status='approved' LIMIT 1", [f.id]);
  if (p) return;
  // Pix gerado há menos de 24h ainda pode ser pago: não apaga o cadastro
  const [[open]] = await pool.query("SELECT 1 x FROM payments WHERE family_id=? AND status='pending' AND mp_payment_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 1", [f.id]);
  if (open) return;
  for (const t of ['members', 'payments', 'kids', 'tasks', 'rewards', 'password_resets']) await pool.query(`DELETE FROM ${t} WHERE family_id=?`, [f.id]);
  await pool.query('DELETE FROM families WHERE id=?', [f.id]);
}
const openParent = (req, m) => { req.session.parentUntil = Date.now() + PARENT_MIN * 60000; req.session.actor = m.id; };
const pub = (m) => m && { id: m.id, name: m.name, role: m.role, full: !!m.full_access, principal: !!m.principal };

// ---------- Rotas públicas / da sessão da família (montadas em /api/auth) ----------
const auth = express.Router();

auth.get('/invite/:token', wrap(async (req, res) => {
  const [[i]] = await pool.query(`SELECT i.name,i.role,i.full_access,f.name family FROM invites i JOIN families f ON f.id=i.family_id
    WHERE i.token_hash=? AND i.expires_at>NOW()`, [sha(req.params.token)]);
  if (!i) return res.status(404).json({ error: 'Este convite venceu ou já foi usado. Peça um novo.' });
  res.json({ name: i.name, role: i.role, full: !!i.full_access, family: i.family });
}));
auth.post('/invite', wrap(async (req, res) => {
  const { token, password, pin } = req.body;
  const email = String(req.body.email || '').toLowerCase().trim();
  const name = cleanName(req.body.name);
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Digite um e-mail válido' });
  if ((password || '').length < 6) return res.status(400).json({ error: 'Senha com ao menos 6 caracteres' });
  if (!/^\d{4,8}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN: 4 a 8 números' });
  const [[i]] = await pool.query('SELECT * FROM invites WHERE token_hash=? AND expires_at>NOW()', [sha(token)]);
  if (!i) return res.status(400).json({ error: 'Este convite venceu ou já foi usado. Peça um novo.' });
  if (await emailTaken(email)) return res.status(409).json({ error: 'Este e-mail já tem conta no GameTask. Use outro.' });
  const [r] = await pool.query('INSERT INTO members (family_id,name,role,full_access,email,password_hash,pin_hash) VALUES (?,?,?,?,?,?,?)',
    [i.family_id, name || i.name, i.role, i.full_access, email, bcrypt.hashSync(password, 10), bcrypt.hashSync(String(pin), 10)]);
  await pool.query('DELETE FROM invites WHERE token_hash=?', [i.token_hash]);
  req.session = { fid: i.family_id, mid: r.insertId, parentUntil: Date.now() + PARENT_MIN * 60000, actor: r.insertId };
  res.json({ ok: true });
}));

// Finaliza o cadastro de quem comprou pela página de vendas: senha, PIN e nome. Vale pela sessão ou pelo link do e-mail.
auth.post('/complete', wrap(async (req, res) => {
  const { token, password, pin } = req.body;
  if ((password || '').length < 6) return res.status(400).json({ error: 'Senha com ao menos 6 caracteres' });
  if (!/^\d{4,8}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN: 4 a 8 números' });
  let fid = req.session?.fid;
  if (token) {
    const [[r]] = await pool.query('SELECT family_id FROM password_resets WHERE token_hash=? AND member_id IS NULL AND expires_at>NOW()', [sha(token)]);
    if (!r) return res.status(400).json({ error: 'Este link venceu ou já foi usado. Use "Esqueci a senha" na tela de entrada.' });
    fid = r.family_id;
  }
  const [[f]] = fid ? await pool.query('SELECT id,setup_pending FROM families WHERE id=?', [fid]) : [[]];
  if (!f || !f.setup_pending) return res.status(400).json({ error: 'Este cadastro já foi finalizado. Entre com seu e-mail e senha.' });
  await pool.query('UPDATE families SET password_hash=?, parent_pin_hash=?, setup_pending=0 WHERE id=?', [bcrypt.hashSync(password, 10), bcrypt.hashSync(String(pin), 10), f.id]);
  const mid = await principalId(f.id);
  await pool.query("UPDATE members SET pin_hash=?, name=COALESCE(NULLIF(?,''),name) WHERE id=?", [bcrypt.hashSync(String(pin), 10), cleanName(req.body.my_name), mid]);
  const fam = String(req.body.family_name || '').trim().slice(0, 80);
  if (fam) await pool.query('UPDATE families SET name=? WHERE id=?', [fam, f.id]);
  await pool.query('DELETE FROM password_resets WHERE family_id=?', [f.id]);
  req.session = { fid: f.id, mid, actor: mid, parentUntil: Date.now() + PARENT_MIN * 60000 };
  res.json({ ok: true });
}));

// Digital/rosto: abrir o painel dos pais sem digitar o PIN
const rp = (req) => {
  const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return { origin, id: new URL(origin).hostname };
};
const needFam = (req, res, next) => req.session?.fid ? next() : res.status(401).json({ error: 'Faça login da família' });
const isOpen = (s) => !!(s?.parentUntil && s.parentUntil > Date.now());

auth.post('/passkey/register/options', needFam, wrap(async (req, res) => {
  if (!isOpen(req.session)) return res.status(403).json({ error: 'Abra o painel dos pais primeiro' });
  const m = await member(req.session.fid, req.session.actor || await principalId(req.session.fid));
  if (!m) return res.status(403).json({ error: 'Responsável não encontrado' });
  const [mine] = await pool.query('SELECT id,transports FROM passkeys WHERE member_id=?', [m.id]);
  const o = await wa.generateRegistrationOptions({
    rpName: 'GameTask', rpID: rp(req).id, userName: m.email || `${m.name} (${m.role})`, userDisplayName: m.name,
    userID: new TextEncoder().encode('m' + m.id), attestationType: 'none',
    excludeCredentials: mine.map(p => ({ id: p.id, transports: p.transports ? p.transports.split(',') : undefined })),
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
  });
  req.session.wa = o.challenge; req.session.waFor = m.id;
  res.json(o);
}));
auth.post('/passkey/register', needFam, wrap(async (req, res) => {
  const mid = req.session.waFor, challenge = req.session.wa;
  req.session.wa = null;
  if (!isOpen(req.session) || !challenge || !mid) return res.status(400).json({ error: 'Tente de novo' });
  const { origin, id } = rp(req);
  let v;
  try { v = await wa.verifyRegistrationResponse({ response: req.body.credential, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: id, requireUserVerification: true }); }
  catch (e) { return res.status(400).json({ error: 'Não foi possível confirmar a digital: ' + e.message }); }
  if (!v.verified) return res.status(400).json({ error: 'Não foi possível confirmar a digital' });
  const c = v.registrationInfo.credential;
  await pool.query('INSERT INTO passkeys (id,member_id,family_id,public_key,counter,transports,label) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE member_id=VALUES(member_id)',
    [c.id, mid, req.session.fid, Buffer.from(c.publicKey).toString('base64url'), c.counter || 0, (c.transports || []).join(',') || null, String(req.body.label || 'Aparelho').slice(0, 60)]);
  res.json({ ok: true, id: c.id });
}));
auth.post('/passkey/login/options', needFam, wrap(async (req, res) => {
  const ids = (req.body.ids || []).map(String).slice(0, 20);
  const [keys] = await pool.query('SELECT id,transports FROM passkeys WHERE family_id=?', [req.session.fid]);
  const allow = keys.filter(k => !ids.length || ids.includes(k.id));
  if (!allow.length) return res.status(404).json({ error: 'Nenhuma digital cadastrada neste aparelho', code: 'none' });
  const o = await wa.generateAuthenticationOptions({ rpID: rp(req).id, userVerification: 'required',
    allowCredentials: allow.map(k => ({ id: k.id, transports: k.transports ? k.transports.split(',') : undefined })) });
  req.session.wa = o.challenge;
  res.json(o);
}));
auth.post('/passkey/login', needFam, wrap(async (req, res) => {
  const challenge = req.session.wa; req.session.wa = null;
  const cred = req.body.credential || {};
  const [[k]] = await pool.query('SELECT * FROM passkeys WHERE id=? AND family_id=?', [String(cred.id || ''), req.session.fid]);
  if (!challenge || !k) return res.status(400).json({ error: 'Digital não reconhecida. Use o PIN.', code: 'unknown' });
  const m = await member(req.session.fid, k.member_id);
  if (!m) return res.status(403).json({ error: 'Este responsável não tem mais acesso' });
  const { origin, id } = rp(req);
  let v;
  try {
    v = await wa.verifyAuthenticationResponse({ response: cred, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: id, requireUserVerification: true,
      credential: { id: k.id, publicKey: Buffer.from(k.public_key, 'base64url'), counter: Number(k.counter), transports: k.transports ? k.transports.split(',') : undefined } });
  } catch (e) { return res.status(400).json({ error: 'Digital não confirmada. Use o PIN.' }); }
  if (!v.verified) return res.status(400).json({ error: 'Digital não confirmada. Use o PIN.' });
  await pool.query('UPDATE passkeys SET counter=? WHERE id=?', [v.authenticationInfo.newCounter, k.id]);
  openParent(req, m);
  res.json({ ok: true, name: m.name });
}));

// ---------- Gestão dos responsáveis (montada em /api/admin, painel aberto) ----------
const admin = express.Router();
const needFull = (req, res, next) => req.actor?.full_access ? next() : res.status(403).json({ error: 'Só um responsável com acesso completo pode fazer isso' });

admin.get('/members', wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT m.id,m.name,m.role,m.full_access,m.principal,m.email,m.kid_id,
      k.avatar,k.color,k.active plays,(SELECT COUNT(*) FROM passkeys p WHERE p.member_id=m.id) passkeys
    FROM members m LEFT JOIN kids k ON k.id=m.kid_id WHERE m.family_id=? AND m.active=1 ORDER BY m.principal DESC,m.id`, [req.fid]);
  const [[f]] = await pool.query('SELECT email FROM families WHERE id=?', [req.fid]);
  rows.forEach(r => { if (r.principal) r.email = f.email; r.me = r.id === req.actor.id; r.plays = !!r.plays; });
  const [inv] = await pool.query('SELECT name,role,full_access,expires_at FROM invites WHERE family_id=? AND expires_at>NOW() ORDER BY expires_at DESC', [req.fid]);
  res.json({ members: rows, invites: inv, roles: ROLES });
}));
admin.post('/members/invite', needFull, wrap(async (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Escreva o nome de quem vai entrar' });
  const token = crypto.randomBytes(24).toString('base64url');
  await pool.query('DELETE FROM invites WHERE expires_at<NOW()');
  await pool.query('INSERT INTO invites (token_hash,family_id,name,role,full_access,expires_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(), INTERVAL ? DAY))',
    [sha(token), req.fid, name, role(req.body.role), bool(req.body.full_access), INVITE_DAYS]);
  const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.json({ link: `${base}/app#/convite/${token}`, days: INVITE_DAYS });
}));
admin.delete('/members/invites', needFull, wrap(async (req, res) => {
  await pool.query('DELETE FROM invites WHERE family_id=?', [req.fid]);
  res.json({ ok: true });
}));
// Editar: nome, papel, acesso e se participa da rotina (vira jogador sem moedas)
admin.put('/members/:id', wrap(async (req, res) => {
  const m = await member(req.fid, +req.params.id);
  if (!m) return res.status(404).json({ error: 'Responsável não encontrado' });
  const self = m.id === req.actor.id;
  if (!req.actor.full_access && !self) return res.status(403).json({ error: 'Só um responsável com acesso completo pode fazer isso' });
  const b = req.body, name = cleanName(b.name) || m.name;
  const full = m.principal ? 1 : req.actor.full_access ? bool(b.full_access) : m.full_access;
  await pool.query('UPDATE members SET name=?,role=?,full_access=? WHERE id=?', [name, role(b.role), full, m.id]);
  if (b.plays !== undefined) {
    const avatar = String(b.avatar || 'fox').slice(0, 16), color = String(b.color || '#4aa8ff').slice(0, 9);
    if (m.kid_id) await pool.query('UPDATE kids SET name=?,avatar=?,color=?,active=? WHERE id=? AND family_id=?', [name, avatar, color, bool(b.plays), m.kid_id, req.fid]);
    else if (b.plays) {
      const [k] = await pool.query('INSERT INTO kids (family_id,name,avatar,color,adult,sort) VALUES (?,?,?,?,1,1000)', [req.fid, name, avatar, color]);
      await pool.query('UPDATE members SET kid_id=? WHERE id=?', [k.insertId, m.id]);
    }
  } else if (m.kid_id) await pool.query('UPDATE kids SET name=? WHERE id=?', [name, m.kid_id]);
  res.json({ ok: true });
}));
admin.delete('/members/:id', needFull, wrap(async (req, res) => {
  const m = await member(req.fid, +req.params.id);
  if (!m) return res.status(404).json({ error: 'Responsável não encontrado' });
  if (m.principal) return res.status(400).json({ error: 'O responsável principal não pode ser removido' });
  await pool.query('UPDATE members SET active=0,email=NULL,password_hash=NULL WHERE id=?', [m.id]);
  await pool.query('DELETE FROM passkeys WHERE member_id=?', [m.id]);
  if (m.kid_id) await pool.query('UPDATE kids SET active=0 WHERE id=?', [m.kid_id]);
  res.json({ ok: true });
}));
// PIN de quem está com o painel aberto
admin.put('/me/pin', wrap(async (req, res) => {
  const pin = String(req.body.pin || '');
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN: 4 a 8 números' });
  await pool.query('UPDATE members SET pin_hash=? WHERE id=?', [bcrypt.hashSync(pin, 10), req.actor.id]);
  res.json({ ok: true });
}));
admin.get('/me/passkeys', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id,label,created_at FROM passkeys WHERE member_id=? ORDER BY created_at', [req.actor.id]);
  res.json(rows);
}));
admin.delete('/me/passkeys/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM passkeys WHERE id=? AND member_id=?', [req.params.id, req.actor.id]);
  res.json({ ok: true });
}));

// Quem só tem o dia a dia: ler tudo e as ações do dia
const DAILY = [
  ['POST', /^\/(approve|reject|use-time|push|push\/test|messages)$/], ['PUT', /^\/(push\/\d+|me\/pin|members\/\d+)$/],
  ['DELETE', /^\/(push\/\d+|me\/passkeys\/.+)$/],
];
const limitDaily = (req, res, next) => {
  if (req.actor.full_access || req.method === 'GET' || DAILY.some(([m, r]) => m === req.method && r.test(req.path))) return next();
  res.status(403).json({ error: 'Só um responsável com acesso completo pode fazer isso', code: 'daily' });
};

module.exports = { auth, admin, limitDaily, member, principalId, emailTaken, dropStale, openParent, pub, PARENT_MIN };
