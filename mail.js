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
const base = (req) => (process.env.APP_URL || (req ? `${req.protocol}://${req.get('host')}` : 'https://gametask.startingpro.com.br')).replace(/\/$/, '');

// memberId: senha de um responsável convidado (sem ele, a senha é a da conta principal da família)
async function createResetLink(req, familyId, hours = 1, memberId = null, path = 'redefinir') {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM password_resets WHERE (family_id=? AND member_id <=> ?) OR expires_at < NOW()', [familyId, memberId]);
  await pool.query('INSERT INTO password_resets (token_hash,family_id,member_id,expires_at) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL ? HOUR))', [sha(token), familyId, memberId, hours]);
  return `${base(req)}/app#/${path}/${token}`;
}

async function consumeReset(token) {
  const [[r]] = await pool.query('SELECT family_id,member_id FROM password_resets WHERE token_hash=? AND expires_at > NOW()', [sha(String(token || ''))]);
  if (!r) return null;
  await pool.query('DELETE FROM password_resets WHERE family_id=? AND member_id <=> ?', [r.family_id, r.member_id]);
  return r;
}
const peekReset = async (token) => !!(await pool.query('SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at > NOW()', [sha(String(token || ''))]))[0].length;

// Modelo de e-mail do GameTask: tabelas e estilos inline (funciona no Gmail, Outlook e no celular).
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = "'Trebuchet MS','Segoe UI',Helvetica,Arial,sans-serif";
function layout({ origin, preheader = '', title, paragraphs = [], button, note = '', fallbackLink }) {
  const img = (n) => `${origin}/img/3d/${n}.png`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#eaf2ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eaf2ff;">${esc(preheader)}&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf2ff;"><tr><td align="center" style="padding:24px 12px;">
 <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
  <tr><td align="center" bgcolor="#2a6cf0" style="background:#2a6cf0;background-image:linear-gradient(180deg,#4aa8ff 0%,#2a6cf0 60%,#1d3fb8 100%);border:2px solid #0d1b4c;border-bottom:0;border-radius:24px 24px 0 0;padding:28px 20px 22px;">
   <img src="${img('game')}" width="84" height="84" alt="" style="display:block;border:0;margin:0 auto 6px;">
   <div style="font-family:${FONT};font-size:34px;font-weight:900;letter-spacing:.5px;color:#ffffff;text-shadow:0 2px 0 #0d1b4c,2px 0 0 #0d1b4c,-2px 0 0 #0d1b4c,0 -2px 0 #0d1b4c;">GameTask</div>
  </td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;border:2px solid #0d1b4c;border-top:0;border-radius:0 0 24px 24px;box-shadow:0 5px 0 #0d1b4c;padding:30px 28px 26px;font-family:${FONT};color:#0d1b4c;">
   <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:900;color:#0d1b4c;">${esc(title)}</h1>
   ${paragraphs.map(p => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#2c3a6e;">${p}</p>`).join('')}
   ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td align="center" bgcolor="#3bd15f" style="background:#3bd15f;background-image:linear-gradient(180deg,#8cf28a,#3bd15f 50%,#1f9a3d);border:2px solid #0d1b4c;border-radius:16px;box-shadow:0 4px 0 #0d1b4c;">
     <a href="${esc(button.url)}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:19px;font-weight:900;color:#ffffff;text-decoration:none;text-shadow:0 2px 0 #145c28;">${esc(button.label)}</a></td></tr></table>` : ''}
   ${note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td style="background:#eaf2ff;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.5;color:#3a4a82;">${note}</td></tr></table>` : ''}
   ${fallbackLink ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#6b78a8;">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${esc(fallbackLink)}" style="color:#2a6cf0;word-break:break-all;">${esc(fallbackLink)}</a></p>` : ''}
  </td></tr>
  <tr><td align="center" style="padding:22px 12px 6px;font-family:${FONT};font-size:13px;line-height:1.5;color:#6b78a8;">
   <img src="${img('trophy')}" width="28" height="28" alt="" style="vertical-align:middle;border:0;"> As tarefas da casa viram um jogo.<br>
   <a href="${origin}" style="color:#2a6cf0;font-weight:bold;text-decoration:none;">gametask.startingpro.com.br</a>
  </td></tr>
 </table>
</td></tr></table></body></html>`;
}

function resetMail(name, link, origin) {
  const first = esc(name);
  return {
    subject: 'GameTask: crie uma nova senha',
    html: layout({ origin, preheader: 'Use o botão para escolher uma nova senha. O link vale por 1 hora.', title: 'Crie uma nova senha',
      paragraphs: [`Olá, família <b style="color:#0d1b4c;">${first}</b>! Recebemos um pedido para trocar a senha da sua conta. Toque no botão para escolher uma nova.`],
      button: { label: 'Criar nova senha', url: link }, fallbackLink: link,
      note: '<b>O link vale por 1 hora</b> e só funciona uma vez. Se não foi você, ignore este e-mail: nada muda na sua conta.' }),
    text: `Olá, família ${name}!

Para criar uma nova senha, abra o link (vale por 1 hora e só funciona uma vez):
${link}

Se não foi você, ignore este e-mail: nada muda na sua conta.

GameTask`,
  };
}

function finalizeMail(name, link, origin) {
  return {
    subject: 'GameTask: pagamento confirmado, falta criar sua senha',
    html: layout({ origin, preheader: 'Seu pagamento foi confirmado. Crie a senha e o PIN para começar.', title: 'Pagamento confirmado!',
      paragraphs: [`Olá, família <b style="color:#0d1b4c;">${esc(name)}</b>! Obrigado por assinar o GameTask. Falta só um passo: criar a sua senha e o PIN dos pais.`],
      button: { label: 'Finalizar meu cadastro', url: link }, fallbackLink: link,
      note: '<b>O link vale por 3 dias</b> e só funciona uma vez. Se ele vencer, toque em "Esqueci a senha" na tela de entrada e use este e-mail.' }),
    text: `Olá, família ${name}!\n\nPagamento confirmado. Para criar a senha e o PIN dos pais, abra o link (vale por 3 dias):\n${link}\n\nGameTask`,
  };
}
async function sendFinalizeMail(to, name, link) {
  if (!smtpOn()) { console.log(`[cadastro] SMTP não configurado. Link para ${to}: ${link}`); return false; }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'GameTask <no-reply@startingpro.com.br>';
  const origin = (process.env.APP_URL || new URL(link).origin).replace(/\/$/, '');
  const m = finalizeMail(name, link, origin);
  await transport().sendMail({ from, to, subject: m.subject, text: m.text, html: m.html });
  return true;
}

async function sendResetMail(to, name, link) {
  if (!smtpOn()) { console.log(`[senha] SMTP não configurado. Link para ${to}: ${link}`); return false; }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'GameTask <no-reply@startingpro.com.br>';
  const origin = (process.env.APP_URL || new URL(link).origin).replace(/\/$/, '');
  const m = resetMail(name, link, origin);
  await transport().sendMail({ from, to, subject: m.subject, text: m.text, html: m.html });
  return true;
}

module.exports = { createResetLink, consumeReset, peekReset, sendResetMail, sendFinalizeMail, smtpOn, layout, resetMail };
