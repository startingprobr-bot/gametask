// Assinaturas: período de teste, acesso e pagamento pelo Mercado Pago (Checkout Pro: Pix, cartão e boleto).
// Cada pagamento aprovado estende `families.paid_until` em 1 mês (mensal) ou 1 ano (anual).
const router = require('express').Router();
const { pool, settings } = require('./db');
const { today } = require('./util');

const OWNERS = (process.env.OWNER_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const isOwner = (f) => !!f && OWNERS.includes(String(f.email).toLowerCase());
const MP = process.env.MP_API || 'https://api.mercadopago.com';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const members = require('./members');
const mail = require('./mail');
const mpToken = () => process.env.MP_ACCESS_TOKEN || '';
const appUrl = () => (process.env.APP_URL || '').replace(/\/$/, '');

// datas 'YYYY-MM-DD' em UTC puro (sem fuso)
const D = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
function addPeriod(start, plan) {
  const d = D(start);
  if (plan === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return iso(d);
}
const PLANS = ['monthly', 'annual', 'plus'];
const PLAN_TITLE = { monthly: 'mensal', annual: 'anual', plus: 'Plus (anual)' };

// `plus`: recursos do plano Plus (avisos no celular/tablet). O teste grátis inclui tudo.
function access(f) {
  const t = today();
  if (isOwner(f)) return { status: 'owner', active: true, owner: true, plus: true };
  if (f.plan === 'free') return { status: 'free', active: true, plus: true };
  if (f.paid_until && f.paid_until >= t) return { status: 'paid', active: true, plan: f.plan, plus: f.plan === 'plus', until: f.paid_until, days_left: daysBetween(t, f.paid_until) };
  if (f.trial_ends && f.trial_ends >= t) return { status: 'trial', active: true, plus: true, until: f.trial_ends, days_left: daysBetween(t, f.trial_ends) };
  return { status: 'expired', active: false, plus: false, plan: f.plan, until: f.paid_until || f.trial_ends };
}

async function prices() {
  const s = await settings();
  return { monthly: +s.price_monthly, annual: +s.price_annual, plus: +s.price_plus, trial_days: +s.trial_days };
}

// Bloqueia o app quando o teste/assinatura acabou (o próprio cadastro, a assinatura e o logout seguem livres)
const seen = new Map();
async function needActive(req, res, next) {
  try {
    const [[f]] = await pool.query('SELECT id,email,plan,paid_until,trial_ends FROM families WHERE id=?', [req.fid]);
    if (!f) { req.session = null; return res.status(401).json({ error: 'Faça login da família' }); }
    const t = today();
    if (seen.get(f.id) !== t) { seen.set(f.id, t); pool.query('UPDATE families SET last_seen=? WHERE id=?', [t, f.id]).catch(() => {}); }
    req.family = f;
    if (!access(f).active) return res.status(402).json({ error: 'O período de uso terminou. Assine para continuar.', code: 'expired' });
    next();
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
}

async function mp(method, path, body, headers = {}) {
  const r = await fetch(MP + path, {
    method, headers: { authorization: `Bearer ${mpToken()}`, 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || `Mercado Pago ${r.status}`), { mp: d, mpStatus: r.status });
  return d;
}

// Confere um pagamento direto na API do Mercado Pago (nunca confia no corpo do webhook) e aplica se aprovado.
async function syncPayment(mpId) {
  const p = await mp('GET', `/v1/payments/${encodeURIComponent(mpId)}`);
  const rowId = +p.external_reference;
  if (!rowId) return null;
  const c = await pool.getConnection();
  let fresh = false;
  try {
    await c.beginTransaction();
    const [[row]] = await c.query('SELECT * FROM payments WHERE id=? FOR UPDATE', [rowId]);
    if (!row) { await c.rollback(); return null; }
    const amountOk = Math.abs(+p.transaction_amount - +row.amount) < 0.01 && p.currency_id === 'BRL';
    if (row.status === 'approved') { await c.commit(); return row; }
    if (p.status === 'approved' && amountOk) {
      fresh = true;
      const [[f]] = await c.query('SELECT paid_until,trial_ends FROM families WHERE id=? FOR UPDATE', [row.family_id]);
      // o período pago começa depois do que já está garantido (dias grátis ou pagos não se perdem)
      const start = [today(), f.paid_until, f.trial_ends].filter(Boolean).sort().at(-1);
      const end = addPeriod(start, row.plan);
      await c.query('UPDATE families SET paid_until=?, plan=? WHERE id=?', [end, row.plan, row.family_id]);
      await c.query("UPDATE payments SET status='approved', paid_at=NOW(), period_end=?, method=?, mp_payment_id=? WHERE id=?",
        [end, p.payment_method_id || null, String(p.id), row.id]);
    } else {
      await c.query('UPDATE payments SET status=?, method=?, mp_payment_id=? WHERE id=?',
        [amountOk ? p.status : 'invalid', p.payment_method_id || null, String(p.id), row.id]);
    }
    await c.commit();
    if (fresh) finishSignup(row.family_id).catch(e => console.error('e-mail', e.message));
    const [[out]] = await pool.query('SELECT * FROM payments WHERE id=?', [row.id]);
    return out;
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}

// Pagou pela página de vendas e ainda não tem senha: manda o link para finalizar (vale mesmo se o pagamento voltar em outro aparelho)
async function finishSignup(fid) {
  const [[f]] = await pool.query('SELECT name,email,setup_pending FROM families WHERE id=?', [fid]);
  if (f?.setup_pending) await mail.sendFinalizeMail(f.email, f.name, await mail.createResetLink(null, fid, 72, null, 'finalizar'));
}

// Traduz a recusa do Mercado Pago em algo que dê para agir (o texto original vai para o log do servidor)
function mpReason(e) {
  const why = e.mp?.cause?.[0]?.description || e.mp?.message || '';
  if (e.mpStatus === 401 || e.mpStatus === 403) return 'O Mercado Pago não aceitou a chave (MP_ACCESS_TOKEN). Use o Access Token de produção da aplicação Checkout Pro.' + (why ? ' (' + why + ')' : '');
  return 'O Mercado Pago recusou a operação' + (why ? ': ' + why : '') + '. Tente de novo.';
}

const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e.mp || e); res.status(500).json({ error: e.mp ? mpReason(e) : 'Erro interno' }); });
const needSession = (req, res, next) => req.session?.fid ? (req.fid = req.session.fid, next()) : res.status(401).json({ error: 'Faça login da família' });

router.get('/status', needSession, wrap(async (req, res) => {
  const [[f]] = await pool.query('SELECT id,email,plan,paid_until,trial_ends FROM families WHERE id=?', [req.fid]);
  if (!f) return res.status(401).json({ error: 'Faça login da família' });
  const [hist] = await pool.query("SELECT id,plan,amount,status,method,period_end,created_at,paid_at FROM payments WHERE family_id=? AND status<>'pending' ORDER BY id DESC LIMIT 12", [f.id]);
  res.json({ access: access(f), prices: await prices(), enabled: !!mpToken(), payments: hist });
}));

async function startCheckout(req, fid, planIn) {
  const plan = PLANS.includes(planIn) ? planIn : 'annual';
  const pr = await prices();
  const amount = pr[plan];
  const [[f]] = await pool.query('SELECT email,name FROM families WHERE id=?', [fid]);
  const [r] = await pool.query('INSERT INTO payments (family_id,plan,amount) VALUES (?,?,?)', [fid, plan, amount]);
  const base = appUrl() || `${req.protocol}://${req.get('host')}`;
  const https = base.startsWith('https://');
  const back = `${base}/app?pagamento=${r.insertId}`;
  const pref = await mp('POST', '/checkout/preferences', {
    items: [{ id: `gametask-${plan}`, title: `GameTask: plano ${PLAN_TITLE[plan]}`, description: f.name, quantity: 1, currency_id: 'BRL', unit_price: amount }],
    payer: { email: f.email },
    external_reference: String(r.insertId),
    back_urls: { success: back, pending: back, failure: back },
    ...(https ? { auto_return: 'approved', notification_url: `${base}/api/billing/webhook` } : {}),
    statement_descriptor: 'GAMETASK',
  });
  return pref.init_point;
}
const noMp = (res) => res.status(503).json({ error: 'O pagamento on-line ainda não foi ativado. Fale com o suporte.' });

router.post('/checkout', needSession, wrap(async (req, res) => {
  if (!mpToken()) return noMp(res);
  res.json({ url: await startCheckout(req, req.fid, req.body.plan) });
}));

// Pix dentro do app (Checkout Transparente): gera o QR Code e o "copia e cola"; o app consulta até cair (e o webhook também confirma)
async function startPix(req, fid, planIn) {
  const plan = PLANS.includes(planIn) ? planIn : 'annual';
  const amount = (await prices())[plan];
  const [[f]] = await pool.query('SELECT email,name FROM families WHERE id=?', [fid]);
  const [r] = await pool.query('INSERT INTO payments (family_id,plan,amount,method) VALUES (?,?,?,?)', [fid, plan, amount, 'pix']);
  const base = appUrl() || `${req.protocol}://${req.get('host')}`;
  const pay = await mp('POST', '/v1/payments', {
    transaction_amount: amount, description: `GameTask: plano ${PLAN_TITLE[plan]}`, payment_method_id: 'pix',
    payer: { email: f.email, first_name: String(f.name).slice(0, 40) }, external_reference: String(r.insertId),
    ...(base.startsWith('https://') ? { notification_url: `${base}/api/billing/webhook` } : {}),
  }, { 'X-Idempotency-Key': `gt-pix-${r.insertId}-${crypto.randomBytes(4).toString('hex')}` });
  const td = pay.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw Object.assign(new Error('Pix sem QR Code'), { mp: { message: 'O Mercado Pago não devolveu o QR Code do Pix.' }, mpStatus: 502 });
  await pool.query('UPDATE payments SET mp_payment_id=? WHERE id=?', [String(pay.id), r.insertId]);
  return { ref: r.insertId, amount, plan, code: td.qr_code, qr: td.qr_code_base64 || null };
}

router.post('/pix', needSession, wrap(async (req, res) => {
  if (!mpToken()) return noMp(res);
  res.json(await startPix(req, req.fid, req.body.plan));
}));
// O app pergunta a cada poucos segundos se o Pix já caiu
router.get('/pix/:ref', needSession, wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT id,status,mp_payment_id FROM payments WHERE id=? AND family_id=?', [+req.params.ref, req.fid]);
  if (!row) return res.status(404).json({ error: 'Pagamento não encontrado' });
  let status = row.status;
  if (status !== 'approved' && row.mp_payment_id) status = (await syncPayment(row.mp_payment_id).catch(e => (console.error(e.mp || e), row)))?.status || status;
  res.json({ status });
}));

// Carrinho da página de vendas: quem ainda não tem conta paga primeiro e cria a senha e o PIN depois.
// A família nasce "pendente" (senha aleatória) e a sessão deste aparelho fica ligada a ela para finalizar depois de pagar.
// Quem volta a tentar com o mesmo e-mail (QR vencido, trocou de forma de pagar) reaproveita o cadastro ainda sem pagamento.
const tries = new Map();
async function guestFamily(req, res) {
  const hits = (tries.get(req.ip) || []).filter(t => Date.now() - t < 3600e3);
  if (hits.length >= 15) { res.status(429).json({ error: 'Muitas tentativas. Tente de novo em alguns minutos.' }); return null; }
  tries.set(req.ip, [...hits, Date.now()]);
  if (!mpToken()) { noMp(res); return null; }
  const email = String(req.body.email || '').toLowerCase().trim(), name = String(req.body.name || '').trim().slice(0, 80);
  if (!name) { res.status(400).json({ error: 'Escreva o nome da família' }); return null; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ error: 'Digite um e-mail válido' }); return null; }
  const exists = () => res.status(409).json({ error: 'Este e-mail já tem conta. Entre e escolha o plano em "Ver planos".', code: 'exists' });
  const [[old]] = await pool.query('SELECT id,setup_pending FROM families WHERE email=?', [email]);
  let fid, mid;
  if (old) {
    if (!old.setup_pending) { exists(); return null; }
    const [[paid]] = await pool.query("SELECT 1 x FROM payments WHERE family_id=? AND status='approved' LIMIT 1", [old.id]);
    if (paid) { res.status(409).json({ error: 'O pagamento deste e-mail já foi confirmado. Toque em "Esqueci a senha" na tela de entrada para criar o acesso.', code: 'exists' }); return null; }
    await pool.query('UPDATE families SET name=? WHERE id=?', [name, old.id]);
    fid = old.id; mid = await members.principalId(fid);
  } else {
    if (await members.emailTaken(email)) { exists(); return null; }
    const trial = +(await settings()).trial_days;
    const junk = () => bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 4);
    const [f] = await pool.query('INSERT INTO families (name,email,password_hash,parent_pin_hash,trial_ends,setup_pending) VALUES (?,?,?,?,DATE_ADD(CURDATE(), INTERVAL ? DAY),1)', [name, email, junk(), junk(), trial]);
    const [m] = await pool.query("INSERT INTO members (family_id,name,role,full_access,principal,pin_hash) VALUES (?,'Responsável','Responsável',1,1,?)", [f.insertId, junk()]);
    fid = f.insertId; mid = m.insertId;
  }
  req.session = { fid, mid, actor: mid, parentUntil: Date.now() + 30 * 60000 };
  return fid;
}
router.post('/guest-checkout', wrap(async (req, res) => {
  const fid = await guestFamily(req, res); if (!fid) return;
  res.json({ url: await startCheckout(req, fid, req.body.plan) });
}));
router.post('/guest-pix', wrap(async (req, res) => {
  const fid = await guestFamily(req, res); if (!fid) return;
  res.json(await startPix(req, fid, req.body.plan));
}));

// Volta do checkout: confere na hora, sem esperar o webhook
router.get('/return', needSession, wrap(async (req, res) => {
  const mpId = req.query.payment_id;
  if (mpId && mpId !== 'null') await syncPayment(mpId).catch(e => console.error(e.mp || e));
  const [[row]] = await pool.query('SELECT status,plan,period_end FROM payments WHERE id=? AND family_id=?', [req.query.ref, req.fid]);
  res.json({ payment: row || null });
}));

// Notificação do Mercado Pago (pública). O id é reconferido na API com o nosso token.
router.post('/webhook', (req, res) => {
  const type = req.query.type || req.query.topic || req.body?.type;
  const id = req.query['data.id'] || req.body?.data?.id || (type === 'payment' ? req.query.id : null);
  res.sendStatus(200);
  if (type === 'payment' && id && mpToken()) syncPayment(id).catch(e => console.error('webhook', e.mp || e.message));
});

module.exports = { router, access, isOwner, needActive, prices, addPeriod };
