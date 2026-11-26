// Firebase Cloud Messaging (HTTP v1), sem biblioteca: assina o JWT da conta de serviço e envia mensagens só de dados.
// A chave fica na variável FCM_SERVICE_ACCOUNT (o JSON da conta de serviço, numa linha só, ou em base64).
const crypto = require('crypto');

let acct = null, token = null, tokenExp = 0;
function account() {
  if (acct !== null) return acct;
  const raw = (process.env.FCM_SERVICE_ACCOUNT || '').trim();
  if (!raw) return (acct = false);
  try { acct = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); }
  catch { console.error('FCM_SERVICE_ACCOUNT inválido (cole o JSON inteiro numa linha só)'); acct = false; }
  if (acct && (!acct.client_email || !acct.private_key || !acct.project_id)) { console.error('FCM_SERVICE_ACCOUNT sem client_email/private_key/project_id'); acct = false; }
  return acct;
}
const on = () => !!account();

const b64u = (x) => Buffer.from(x).toString('base64url');
async function accessToken() {
  if (token && Date.now() < tokenExp) return token;
  const a = account(), now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(a.private_key.replace(/\\n/g, '\n'), 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }) });
  const d = await r.json();
  if (!r.ok) throw new Error('FCM login: ' + (d.error_description || d.error || r.status));
  token = d.access_token; tokenExp = Date.now() + (d.expires_in - 120) * 1000;
  return token;
}

// Envia para um aparelho. Retorna 'ok', 'gone' (token não existe mais) ou 'fail'.
async function send(deviceToken, data) {
  if (!on()) return 'fail';
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${account().project_id}/messages:send`, {
      method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token: deviceToken, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])), android: { priority: 'HIGH', ttl: '900s' } } }),
    });
    if (r.ok) return 'ok';
    const e = await r.json().catch(() => ({}));
    const code = e.error?.details?.find(x => x.errorCode)?.errorCode || e.error?.status;
    if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') return 'gone';
    console.error('fcm', r.status, code || '');
    return 'fail';
  } catch (e) { console.error('fcm', e.message); return 'fail'; }
}

module.exports = { on, send };
