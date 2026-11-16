// Painel do dono do sistema: assinaturas, faturamento, famílias e preços.
const router = require('express').Router();
const { pool, settings } = require('../db');
const { today } = require('../util');
const { access, isOwner } = require('../billing');

const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });
const r2 = (n) => Math.round((+n || 0) * 100) / 100;

router.get('/summary', wrap(async (req, res) => {
  const all = await settings();
  const s = { price_monthly: all.price_monthly, price_annual: all.price_annual, price_plus: all.price_plus, trial_days: all.trial_days };
  const [fams] = await pool.query('SELECT id,email,plan,paid_until,trial_ends,created_at,last_seen FROM families');
  const t = today();
  const in7 = new Date(Date.parse(t + 'T00:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  const c = { total: 0, trial: 0, paid_monthly: 0, paid_annual: 0, paid_plus: 0, free: 0, expired: 0, new30: 0, active7: 0, expiring7: 0 };
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), d7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  for (const f of fams) {
    if (isOwner(f)) continue;
    c.total++;
    const a = access(f);
    if (a.status === 'trial') c.trial++;
    else if (a.status === 'paid') c['paid_' + (['annual', 'plus'].includes(f.plan) ? f.plan : 'monthly')]++;
    else if (a.status === 'free') c.free++;
    else c.expired++;
    if (String(f.created_at).slice(0, 10) >= d30) c.new30++;
    if (f.last_seen && f.last_seen >= d7) c.active7++;
    if ((a.status === 'trial' || a.status === 'paid') && a.until <= in7) c.expiring7++;
  }
  const [[rev]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) total,
      COALESCE(SUM(CASE WHEN paid_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN amount END),0) month,
      COALESCE(SUM(CASE WHEN paid_at>=DATE_SUB(CURDATE(), INTERVAL 365 DAY) THEN amount END),0) year,
      COUNT(*) n FROM payments WHERE status='approved'`);
  const [months] = await pool.query(
    `SELECT DATE_FORMAT(paid_at,'%Y-%m') m, SUM(amount) total, COUNT(*) n,
      SUM(plan='annual') annual, SUM(plan='monthly') monthly, SUM(plan='plus') plus
     FROM payments WHERE status='approved' AND paid_at>=DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 11 MONTH)
     GROUP BY m ORDER BY m DESC`);
  // Receita recorrente mensal estimada: mensais × preço + anuais × preço/12
  const mrr = c.paid_monthly * +s.price_monthly + c.paid_annual * +s.price_annual / 12 + c.paid_plus * +s.price_plus / 12;
  const [[conv]] = await pool.query(`SELECT COUNT(DISTINCT family_id) n FROM payments WHERE status='approved'`);
  const pastTrial = fams.filter(f => !isOwner(f) && f.trial_ends && f.trial_ends < t).length;
  res.json({
    counts: c, settings: s,
    revenue: { total: r2(rev.total), month: r2(rev.month), year: r2(rev.year), payments: rev.n, mrr: r2(mrr), arr: r2(mrr * 12) },
    conversion: pastTrial ? Math.round(conv.n / pastTrial * 100) : null, months,
  });
}));

router.get('/families', wrap(async (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const [rows] = await pool.query(
    `SELECT f.id,f.name,f.email,f.plan,f.paid_until,f.trial_ends,f.created_at,f.last_seen,f.onboarded,
      (SELECT COUNT(*) FROM kids k WHERE k.family_id=f.id AND k.active=1 AND k.adult=0) kids,
      (SELECT COUNT(*) FROM members m WHERE m.family_id=f.id AND m.active=1) adults,
      (SELECT COUNT(*) FROM tasks t WHERE t.family_id=f.id AND t.active=1) tasks,
      (SELECT COUNT(*) FROM completions c WHERE c.family_id=f.id AND c.day>=DATE_SUB(CURDATE(), INTERVAL 7 DAY)) done7,
      (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.family_id=f.id AND p.status='approved') paid_total
     FROM families f WHERE f.name LIKE ? OR f.email LIKE ? ORDER BY f.id DESC LIMIT 500`, [q, q]);
  rows.forEach(f => { f.access = access(f); delete f.access.owner; f.owner = isOwner(f); });
  res.json(rows);
}));

router.get('/payments', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, f.name family, f.email FROM payments p JOIN families f ON f.id=p.family_id
     WHERE p.status<>'pending' OR p.created_at>=DATE_SUB(NOW(), INTERVAL 2 DAY) ORDER BY p.id DESC LIMIT 300`);
  res.json(rows);
}));

// Ajuste manual de uma família: estender teste, liberar período pago ou cortesia
router.post('/families/:id', wrap(async (req, res) => {
  const { action, date, plan } = req.body;
  const id = +req.params.id;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(date || '');
  if (action === 'trial' && ok) await pool.query('UPDATE families SET trial_ends=? WHERE id=?', [date, id]);
  else if (action === 'paid' && ok) await pool.query('UPDATE families SET paid_until=?, plan=? WHERE id=?', [date, ['monthly', 'plus'].includes(plan) ? plan : 'annual', id]);
  else if (action === 'free') await pool.query("UPDATE families SET plan='free' WHERE id=?", [id]);
  else if (action === 'block') await pool.query("UPDATE families SET plan=NULL, paid_until=NULL, trial_ends=DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id=?", [id]);
  else return res.status(400).json({ error: 'Ação ou data inválida' });
  res.json({ ok: true });
}));

// Link de nova senha para o dono repassar (útil enquanto o e-mail não está configurado ou se o e-mail não chega)
router.post('/families/:id/reset-link', wrap(async (req, res) => {
  const [[f]] = await pool.query('SELECT id FROM families WHERE id=?', [+req.params.id]);
  if (!f) return res.status(404).json({ error: 'Família não encontrada' });
  res.json({ link: await require('../mail').createResetLink(req, f.id, 24) });
}));

router.put('/settings', wrap(async (req, res) => {
  const m = r2(req.body.price_monthly), a = r2(req.body.price_annual), p = r2(req.body.price_plus ?? 67), d = Math.round(+req.body.trial_days);
  if (!(m > 0) || !(a > 0) || !(p > 0) || !(d >= 0 && d <= 3650)) return res.status(400).json({ error: 'Preços maiores que zero e dias de teste entre 0 e 3650' });
  for (const [k, v] of [['price_monthly', m.toFixed(2)], ['price_annual', a.toFixed(2)], ['price_plus', p.toFixed(2)], ['trial_days', String(d)]])
    await pool.query('INSERT INTO app_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [k, v]);
  res.json({ ok: true });
}));

module.exports = router;
