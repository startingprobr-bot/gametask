// E-mail (SMTP) e links de redefinição de senha.
// Sem SMTP configurado, o link é escrito no log do servidor e o dono pode gerar o link no painel.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('./db');

const smtpOn = () => !!process.env.SMTP_HOST;
let tx;
const transport = () => tx ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === '1' || +(process.env.SMTP_PORT || 587) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const base = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

async function createResetLink(req, familyId, hours = 1) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM password_resets WHERE family_id=? OR expires_at < NOW()', [familyId]);
  await pool.query('INSERT INTO password_resets (token_hash,family_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL ? HOUR))', [sha(token), familyId, hours]);
  return `${base(req)}/app#/redefinir/${token}`;
}

async function consumeReset(token) {
  const [[r]] = await pool.query('SELECT family_id FROM password_resets WHERE token_hash=? AND expires_at > NOW()', [sha(String(token || ''))]);
  if (!r) return null;
  await pool.query('DELETE FROM password_resets WHERE family_id=?', [r.family_id]);
  return r.family_id;
}
const peekReset = async (token) => !!(await pool.query('SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at > NOW()', [sha(String(token || ''))]))[0].length;

async function sendResetMail(to, name, link) {
  if (!smtpOn()) { console.log(`[senha] SMTP não configurado. Link para ${to}: ${link}`); return false; }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'GameTask <no-reply@startingpro.com.br>';
  await transport().sendMail({
    from, to, subject: 'GameTask: crie uma nova senha',
    text: `Olá, família ${name}!\n\nPara criar uma nova senha, abra o link (vale por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail: nada muda na sua conta.\n\nGameTask`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0d1b4c"><h2 style="margin:0 0 12px">Crie uma nova senha</h2>
      <p>Olá, família <b>${String(name).replace(/[<>&]/g, '')}</b>! Toque no botão para escolher uma nova senha. O link vale por 1 hora.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#3bd15f;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px;border:2px solid #0d1b4c;display:inline-block">Criar nova senha</a></p>
      <p style="color:#3a4a82;font-size:14px">Se não foi você, ignore este e-mail: nada muda na sua conta.</p></div>`,
  });
  return true;
}

module.exports = { createResetLink, consumeReset, peekReset, sendResetMail, smtpOn };
