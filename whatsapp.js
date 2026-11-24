// WhatsApp pela Evolution API (v2). Fluxo das iscas: quem manda a primeira mensagem é a pessoa, com o código do material;
// o servidor reconhece o código e responde com o PDF. Mensagens sem código (conversas pessoais do número) são ignoradas e não ficam guardadas.
const crypto = require('crypto');
const express = require('express');
const { pool } = require('./db');
const { quadroPdf } = require('./quadro-pdf');

const cfg = () => ({ url: (process.env.EVOLUTION_URL || '').replace(/\/$/, ''), key: process.env.EVOLUTION_KEY || '', inst: process.env.EVOLUTION_INSTANCE || '' });
const on = () => { const c = cfg(); return !!(c.url && c.key && c.inst); };
// segredo do endereço do webhook: derivado da chave (não precisa de outra variável)
const hookSecret = () => crypto.createHash('sha256').update('gt-wa:' + cfg().key).digest('hex').slice(0, 32);

async function evo(method, p, body) {
  const c = cfg();
  const r = await fetch(`${c.url}${p.replace('{i}', encodeURIComponent(c.inst))}`, {
    method, headers: { apikey: c.key, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${JSON.stringify(j?.response?.message || j?.message || j).slice(0, 200)}`);
  return j;
}

// número do chip conectado (para o link wa.me): WHATSAPP_NUMBER ou o dono da instância
let ownNumber = null;
async function number() {
  if (process.env.WHATSAPP_NUMBER) return process.env.WHATSAPP_NUMBER.replace(/\D/g, '');
  if (ownNumber || !on()) return ownNumber;
  try {
    const list = await evo('GET', `/instance/fetchInstances?instanceName={i}`);
    const it = (Array.isArray(list) ? list : [list]).map(x => x.instance || x).find(Boolean);
    ownNumber = String(it?.ownerJid || it?.owner || it?.number || '').split('@')[0].replace(/\D/g, '') || null;
  } catch (e) { console.error('whatsapp número', e.message); }
  return ownNumber;
}

const sendText = (to, text) => evo('POST', '/message/sendText/{i}', { number: to, text });
const sendPdf = (to, buf, fileName, caption) => evo('POST', '/message/sendMedia/{i}',
  { number: to, mediatype: 'document', mimetype: 'application/pdf', fileName, caption, media: buf.toString('base64') });

// código que vai na mensagem pronta: GT-XXXX, sem letras que confundem (0/O, 1/I)
const ABC = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'GT-' + Array.from(crypto.randomBytes(4), b => ABC[b % ABC.length]).join('');

// ---------- webhook: mensagens que chegam no número ----------
const seen = new Map();                 // ids de mensagem já tratados (a Evolution às vezes repete o aviso)
const sent = new Map();                 // envios por código no dia (evita reenvio em série)
const once = (id) => { if (!id) return true; const now = Date.now(); for (const [k, t] of seen) if (now - t > 36e5) seen.delete(k); if (seen.has(id)) return false; seen.set(id, now); return true; };
const textOf = (m = {}) => m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.ephemeralMessage?.message?.extendedTextMessage?.text || '';
// quem mandou: telefone de verdade quando a Evolution informa (contas com @lid trazem o número em remoteJidAlt/senderPn)
function sender(d) {
  const k = d.key || {};
  const jids = [k.remoteJidAlt, k.senderPn, d.senderPn, k.remoteJid].filter(Boolean).map(String);
  const pn = jids.find(j => j.endsWith('@s.whatsapp.net'));
  return { phone: pn ? pn.split('@')[0].replace(/\D/g, '') : null, to: pn ? pn.split('@')[0] : k.remoteJid };
}

// celular brasileiro com ou sem o 9 extra é o mesmo número (o WhatsApp às vezes informa sem o 9)
const br = (n) => String(n || '').replace(/^(55\d\d)9(\d{8})$/, '$1$2');
async function handle(d, host) {
  const k = d?.key || {};
  if (!k.remoteJid || /@g\.us$|@broadcast$|@newsletter$/.test(k.remoteJid)) return;
  // mensagem minha só conta na conversa "eu comigo mesmo" (para o dono testar); nas conversas com outras pessoas, ignora
  if (k.fromMe && (!sender(d).phone || br(sender(d).phone) !== br(await number()))) return;
  const text = textOf(d.message).trim();
  const code = text.toUpperCase().match(/GT-[A-Z0-9]{4}/)?.[0];
  const { phone, to } = sender(d);
  if (!code) {
    // "SAIR" só vale para quem já é lead confirmado por este número; o resto (conversas pessoais) é ignorado
    if (phone && /^(sair|parar|stop|cancelar)$/i.test(text)) {
      const [r] = await pool.query('UPDATE leads SET opt_out_at=NOW() WHERE whatsapp=? AND wa_confirmed_at IS NOT NULL AND opt_out_at IS NULL', [phone]);
      if (r.affectedRows) await sendText(to, 'Pronto, você não vai mais receber mensagens do GameTask por aqui. Se mudar de ideia, é só mandar o código do seu quadro de novo. 💛');
    }
    return;
  }
  const [[l]] = await pool.query('SELECT id,name,kids,tasks FROM leads WHERE code=?', [code]);
  if (!l) return;
  const day = new Date().toISOString().slice(0, 10), n = (sent.get(code + day) || 0) + 1;
  if (n > 5) return;
  sent.set(code + day, n);
  await pool.query('UPDATE leads SET whatsapp=COALESCE(?,whatsapp), wa_confirmed_at=COALESCE(wa_confirmed_at,NOW()), opt_out_at=NULL, updated_at=NOW() WHERE id=?', [phone, l.id]);
  const kids = JSON.parse(l.kids || '[]'), tasks = JSON.parse(l.tasks || '[]');
  const pdf = await quadroPdf({ kids, tasks, host });
  const first = String(l.name).split(' ')[0];
  const who = kids.length > 1 ? kids.slice(0, -1).join(', ') + ' e ' + kids.at(-1) : kids[0] || 'sua casa';
  await sendPdf(to, pdf, 'quadro-de-tarefas.pdf',
    `Oi, ${first}! Aqui está o quadro de tarefas de ${who}. 🎉\n\nImprima toda segunda-feira e cole na altura dos olhos da criança, com uma caneta presa do lado: quem marca é ela.\n\nDaqui uns dias passo aqui pra saber como está indo. Se não quiser receber, é só responder SAIR.`);
}

const router = express.Router();
// A Evolution só tem um webhook por instância. Se outro sistema (ex.: n8n) também precisa das mensagens,
// o endereço dele vai em WA_REPASSAR_URL e o GameTask repassa tudo, do jeito que chegou.
const fwd = () => (process.env.WA_REPASSAR_URL || '').trim();
router.post('/api/public/wa/:secret/:ev?', express.json({ limit: '50mb' }), (req, res) => {
  if (!on() || req.params.secret !== hookSecret()) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ok: true }); // responde logo; o envio do PDF acontece em seguida
  const b = req.body || {};
  if (fwd()) fetch(fwd().replace(/\/$/, '') + (req.params.ev ? '/' + req.params.ev : ''), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(20000) })
    .then(r => { if (!r.ok) console.error('repasse WhatsApp', r.status); }).catch(e => console.error('repasse WhatsApp', e.message));
  if (!/messages[._]upsert/i.test(b.event || '')) return;
  const host = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/^https?:\/\//, '').replace(/\/$/, '');
  for (const d of (Array.isArray(b.data) ? b.data : [b.data])) {
    if (!d || !once(d.key?.id)) continue;
    handle(d, host).catch(e => console.error('whatsapp webhook', e.message));
  }
});

// ---------- painel do dono ----------
const hookUrl = (req) => `${(process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/api/public/wa/${hookSecret()}`;
async function status(req) {
  if (!on()) return { configured: false };
  const out = { configured: true, instance: cfg().inst, number: await number(), hookUrl: hookUrl(req), forward: fwd() };
  try { const s = await evo('GET', '/instance/connectionState/{i}'); out.state = s?.instance?.state || s?.state || 'desconhecido'; }
  catch (e) { out.error = e.message; }
  try { const w = await evo('GET', '/webhook/find/{i}'); out.hook = w ? { url: w.url || '', enabled: !!w.enabled, events: w.events || [] } : null; }
  catch (e) { out.hook = null; }
  out.hookOk = !!(out.hook?.enabled && out.hook.url === out.hookUrl && (!out.hook.events?.length || out.hook.events.some(e => /MESSAGES_UPSERT/i.test(e))));
  return out;
}
// liga o webhook sem derrubar outro sistema: se a instância já avisa outro endereço que não é o repasse, não troca.
// Mantém os eventos e opções que já estavam (o sistema repassado continua recebendo tudo o que recebia).
async function setHook(req) {
  const cur = await evo('GET', '/webhook/find/{i}').catch(() => null);
  const url = hookUrl(req), old = (cur?.url || '').replace(/\/$/, '');
  if (cur?.enabled && old && old !== url && old !== fwd().replace(/\/$/, ''))
    throw new Error(`A instância já manda as mensagens para ${old}. Para não desligar esse sistema, coloque esse endereço na variável WA_REPASSAR_URL do EasyPanel, faça o Deploy e clique de novo.`);
  const events = [...new Set([...(cur?.enabled && cur.events?.length ? cur.events : []), 'MESSAGES_UPSERT'])];
  return evo('POST', '/webhook/set/{i}', { webhook: { enabled: true, url, byEvents: !!cur?.webhookByEvents, base64: !!cur?.webhookBase64, events } });
}

module.exports = { router, on, number, newCode, status, setHook, sendText };
