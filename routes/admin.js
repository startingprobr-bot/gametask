const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { today, r2 } = require('../util');
const { balance, approve } = require('../lib');

const bool = (v) => (v ? 1 : 0);
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });

// ---------- Filhos ----------
router.get('/kids', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM kids WHERE family_id=? ORDER BY active DESC,sort,id', [req.fid]);
  res.json(rows);
}));
router.post('/kids', wrap(async (req, res) => {
  const { name, avatar = 'fox', color = '#ff4fae' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const [r] = await pool.query('INSERT INTO kids (family_id,name,avatar,color) VALUES (?,?,?,?)', [req.fid, name.trim(), avatar, color]);
  res.json({ id: r.insertId });
}));
router.put('/kids/:id', wrap(async (req, res) => {
  const { name, avatar, color, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  await pool.query('UPDATE kids SET name=?,avatar=?,color=?,active=? WHERE id=? AND family_id=?',
    [name.trim(), avatar, color, bool(active), req.params.id, req.fid]);
  res.json({ ok: true });
}));

// ---------- Tarefas ----------
async function saveTask(req, id) {
  const b = req.body, fid = req.fid;
  const v = [b.title.trim(), b.icon || 'star', b.description || null, b.type === 'one_off' ? 'one_off' : 'daily',
    b.weekdays || '0123456', b.type === 'one_off' ? b.date : null, b.time || null, bool(b.repeat_weekly),
    +b.coins || 0, bool(b.all_kids), bool(b.active ?? 1)];
  if (id) {
    await pool.query('UPDATE tasks SET title=?,icon=?,description=?,type=?,weekdays=?,date=?,time=?,repeat_weekly=?,coins=?,all_kids=?,active=? WHERE id=? AND family_id=?', [...v, id, fid]);
  } else {
    const [r] = await pool.query('INSERT INTO tasks (title,icon,description,type,weekdays,date,time,repeat_weekly,coins,all_kids,active,family_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [...v, fid]);
    id = r.insertId;
  }
  await pool.query('DELETE FROM task_kids WHERE task_id=?', [id]);
  if (!b.all_kids && b.kid_ids?.length) await pool.query('INSERT INTO task_kids (task_id,kid_id) VALUES ?', [b.kid_ids.map(k => [id, +k])]);
  await pool.query('DELETE FROM task_rewards WHERE task_id=?', [id]);
  if (b.reward_ids?.length) await pool.query('INSERT INTO task_rewards (task_id,reward_id) VALUES ?', [b.reward_ids.map(r => [id, +r])]);
  return id;
}
const taskErr = (b) => !b.title?.trim() ? 'Título obrigatório' : (b.type === 'one_off' && !b.date ? 'Informe a data' : null);

// garante que a tarefa editada pertence à família
async function ownsTask(req, id) {
  const [[t]] = await pool.query('SELECT id FROM tasks WHERE id=? AND family_id=?', [id, req.fid]);
  return !!t;
}

router.get('/tasks', wrap(async (req, res) => {
  const [tasks] = await pool.query('SELECT * FROM tasks WHERE family_id=? ORDER BY active DESC,type,time,id', [req.fid]);
  const [tk] = await pool.query('SELECT task_id,kid_id FROM task_kids WHERE task_id IN (SELECT id FROM tasks WHERE family_id=?)', [req.fid]);
  const [tr] = await pool.query('SELECT task_id,reward_id FROM task_rewards WHERE task_id IN (SELECT id FROM tasks WHERE family_id=?)', [req.fid]);
  tasks.forEach(t => {
    t.kid_ids = tk.filter(x => x.task_id === t.id).map(x => x.kid_id);
    t.reward_ids = tr.filter(x => x.task_id === t.id).map(x => x.reward_id);
  });
  res.json(tasks);
}));
router.post('/tasks', wrap(async (req, res) => {
  const e = taskErr(req.body); if (e) return res.status(400).json({ error: e });
  res.json({ id: await saveTask(req, null) });
}));
router.put('/tasks/:id', wrap(async (req, res) => {
  const e = taskErr(req.body); if (e) return res.status(400).json({ error: e });
  if (!await ownsTask(req, +req.params.id)) return res.status(404).json({ error: 'Não encontrada' });
  res.json({ id: await saveTask(req, +req.params.id) });
}));

// ---------- Recompensas ----------
router.get('/rewards', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, (SELECT COUNT(*) FROM task_rewards tr JOIN tasks t ON t.id=tr.task_id WHERE tr.reward_id=r.id AND t.active=1) task_count
     FROM rewards r WHERE r.family_id=? ORDER BY r.active DESC,r.kind,r.id`, [req.fid]);
  res.json(rows);
}));
async function saveReward(req, id) {
  const b = req.body;
  const kind = b.kind === 'goal' ? 'goal' : 'time';
  const mode = kind === 'goal' ? (b.goal_mode === 'coins' ? 'coins' : 'tasks') : null;
  const v = [b.title.trim(), b.icon || 'game', kind, kind === 'time' ? (b.unit || 'min') : (mode === 'coins' ? 'moedas' : 'tarefas'),
    +b.total_value, mode, bool(b.active ?? 1)];
  if (id) await pool.query('UPDATE rewards SET title=?,icon=?,kind=?,unit=?,total_value=?,goal_mode=?,active=? WHERE id=? AND family_id=?', [...v, id, req.fid]);
  else {
    const [r] = await pool.query('INSERT INTO rewards (title,icon,kind,unit,total_value,goal_mode,active,family_id) VALUES (?,?,?,?,?,?,?,?)', [...v, req.fid]);
    id = r.insertId;
  }
  return id;
}
const rewErr = (b) => !b.title?.trim() ? 'Título obrigatório' : !(+b.total_value > 0) ? 'Valor deve ser maior que zero' : null;
router.post('/rewards', wrap(async (req, res) => {
  const e = rewErr(req.body); if (e) return res.status(400).json({ error: e });
  res.json({ id: await saveReward(req, null) });
}));
router.put('/rewards/:id', wrap(async (req, res) => {
  const e = rewErr(req.body); if (e) return res.status(400).json({ error: e });
  res.json({ id: await saveReward(req, +req.params.id) });
}));

// ---------- Aprovações ----------
router.get('/pending', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id,c.day,c.created_at,t.title,t.icon,t.coins,k.name kid,k.avatar FROM completions c
     JOIN tasks t ON t.id=c.task_id JOIN kids k ON k.id=c.kid_id
     WHERE c.family_id=? AND c.status='pending' ORDER BY c.day,c.id`, [req.fid]);
  res.json(rows);
}));
router.post('/approve', wrap(async (req, res) => {
  let n = 0;
  for (const id of req.body.ids || []) if (await approve(req.fid, +id)) n++;
  res.json({ approved: n });
}));
router.post('/reject', wrap(async (req, res) => {
  const ids = (req.body.ids || []).map(Number);
  if (!ids.length) return res.json({ rejected: 0 });
  const [r] = await pool.query("UPDATE completions SET status='rejected',decided_at=NOW() WHERE family_id=? AND status='pending' AND id IN (?)", [req.fid, ids]);
  res.json({ rejected: r.affectedRows });
}));

// ---------- Carteira ----------
router.get('/wallet', wrap(async (req, res) => {
  const [[f]] = await pool.query('SELECT coin_value,auto_approve FROM families WHERE id=?', [req.fid]);
  const [kids] = await pool.query('SELECT id,name,avatar FROM kids WHERE family_id=? AND active=1 ORDER BY sort,id', [req.fid]);
  const day = today();
  const [goals] = await pool.query("SELECT * FROM rewards WHERE family_id=? AND kind='goal' AND active=1", [req.fid]);
  const [timeRewards] = await pool.query("SELECT id,title,icon FROM rewards WHERE family_id=? AND kind='time' AND active=1", [req.fid]);
  for (const k of kids) {
    k.balance = await balance(req.fid, k.id);
    k.value = r2(k.balance * f.coin_value);
    const [[t]] = await pool.query("SELECT COALESCE(SUM(amount),0) a FROM ledger WHERE kid_id=? AND kind='time' AND day=?", [k.id, day]);
    k.time_today = r2(t.a);
    const [gp] = await pool.query("SELECT reward_id,SUM(amount) p FROM ledger WHERE kid_id=? AND kind='goal' GROUP BY reward_id", [k.id]);
    k.goals = goals.map(g => {
      const p = g.goal_mode === 'coins' ? k.balance : (gp.find(x => x.reward_id === g.id)?.p || 0);
      return { id: g.id, title: g.title, icon: g.icon, mode: g.goal_mode, target: g.total_value, progress: r2(p), ready: p >= g.total_value };
    });
  }
  const [payouts] = await pool.query(
    'SELECT p.*,k.name kid FROM payouts p JOIN kids k ON k.id=p.kid_id WHERE p.family_id=? ORDER BY p.id DESC LIMIT 30', [req.fid]);
  res.json({ settings: f, kids, payouts, timeRewards });
}));

async function ownKidId(req) {
  const [[k]] = await pool.query('SELECT id FROM kids WHERE id=? AND family_id=?', [req.body.kid_id, req.fid]);
  return k?.id;
}
router.post('/payout', wrap(async (req, res) => {
  const kid = await ownKidId(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const [[f]] = await pool.query('SELECT coin_value FROM families WHERE id=?', [req.fid]);
  const bal = await balance(req.fid, kid);
  const coins = req.body.coins === undefined || req.body.coins === '' ? bal : r2(+req.body.coins);
  if (!(coins > 0) || coins > bal) return res.status(400).json({ error: 'Quantidade de moedas inválida' });
  const amount = r2(coins * f.coin_value);
  const [p] = await pool.query('INSERT INTO payouts (family_id,kid_id,coins,amount) VALUES (?,?,?,?)', [req.fid, kid, coins, amount]);
  await pool.query("INSERT INTO ledger (family_id,kid_id,kind,amount,day,payout_id,note) VALUES (?,?,'coin',?,?,?,'Pagamento')", [req.fid, kid, -coins, today(), p.insertId]);
  res.json({ coins, amount });
}));
router.post('/adjust', wrap(async (req, res) => {
  const kid = await ownKidId(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const amt = r2(+req.body.amount);
  if (!amt) return res.status(400).json({ error: 'Valor inválido' });
  if (amt < 0 && -amt > await balance(req.fid, kid)) return res.status(400).json({ error: 'Saldo insuficiente' });
  await pool.query("INSERT INTO ledger (family_id,kid_id,kind,amount,day,note) VALUES (?,?,'coin',?,?,?)",
    [req.fid, kid, amt, today(), req.body.note || 'Ajuste manual']);
  res.json({ ok: true });
}));
// Pai desconta tempo de tela já usado hoje
router.post('/use-time', wrap(async (req, res) => {
  const kid = await ownKidId(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const m = r2(+req.body.minutes);
  if (!(m > 0)) return res.status(400).json({ error: 'Minutos inválidos' });
  const [[rw]] = await pool.query("SELECT id FROM rewards WHERE id=? AND family_id=? AND kind='time'", [req.body.reward_id, req.fid]);
  if (!rw) return res.status(404).json({ error: 'Recompensa não encontrada' });
  await pool.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) VALUES (?,?,'time',?,?,?,'Tempo usado')",
    [req.fid, kid, rw.id, -m, today()]);
  res.json({ ok: true });
}));
// Entrega de uma meta alcançada
router.post('/redeem', wrap(async (req, res) => {
  const kid = await ownKidId(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const [[g]] = await pool.query("SELECT * FROM rewards WHERE id=? AND family_id=? AND kind='goal'", [req.body.reward_id, req.fid]);
  if (!g) return res.status(404).json({ error: 'Meta não encontrada' });
  if (g.goal_mode === 'coins') {
    if (await balance(req.fid, kid) < g.total_value) return res.status(400).json({ error: 'Moedas insuficientes' });
    await pool.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) VALUES (?,?,'coin',?,?,?,?)",
      [req.fid, kid, g.id, -g.total_value, today(), 'Meta: ' + g.title]);
  } else {
    const [[p]] = await pool.query("SELECT COALESCE(SUM(amount),0) p FROM ledger WHERE kid_id=? AND kind='goal' AND reward_id=?", [kid, g.id]);
    if (p.p < g.total_value) return res.status(400).json({ error: 'Meta ainda não alcançada' });
    await pool.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) VALUES (?,?,'goal',?,?,?,?)",
      [req.fid, kid, g.id, -g.total_value, today(), 'Meta entregue']);
  }
  res.json({ ok: true });
}));

// ---------- Histórico ----------
router.get('/history', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.day,c.status,t.title,t.icon,k.name kid,k.avatar FROM completions c
     JOIN tasks t ON t.id=c.task_id JOIN kids k ON k.id=c.kid_id
     WHERE c.family_id=? AND c.day>=DATE_SUB(CURDATE(), INTERVAL 31 DAY) AND c.status<>'pending' ORDER BY c.day DESC,c.id DESC LIMIT 300`, [req.fid]);
  const [month] = await pool.query(
    `SELECT k.name,SUM(l.amount) earned FROM ledger l JOIN kids k ON k.id=l.kid_id
     WHERE l.family_id=? AND l.kind='coin' AND l.completion_id IS NOT NULL AND l.day>=DATE_FORMAT(CURDATE(),'%Y-%m-01') GROUP BY k.id`, [req.fid]);
  res.json({ rows, month });
}));

// ---------- Catálogo e assistente do primeiro acesso ----------
const catalog = require('../catalog');
router.get('/catalog', wrap(async (req, res) => {
  const [have] = await pool.query('SELECT title FROM tasks WHERE family_id=? AND active=1', [req.fid]);
  const titles = new Set(have.map(t => t.title.toLowerCase()));
  res.json({ groups: catalog.GROUPS, rewards: catalog.REWARDS, tasks: catalog.TASKS.map(t => ({ ...t, have: titles.has(t.title.toLowerCase()) })) });
}));

// Cria tarefas do catálogo ligadas às recompensas dadas (tempo divide o pote; meta por missões soma +1)
async function addCatalogTasks(fid, keys, rewardIds) {
  const [have] = await pool.query('SELECT title FROM tasks WHERE family_id=? AND active=1', [fid]);
  const titles = new Set(have.map(t => t.title.toLowerCase()));
  let n = 0;
  for (const k of keys) {
    const t = catalog.byKey[k];
    if (!t || titles.has(t.title.toLowerCase())) continue;
    const [r] = await pool.query("INSERT INTO tasks (family_id,title,icon,type,weekdays,coins,all_kids) VALUES (?,?,?,'daily',?,?,1)",
      [fid, t.title, t.icon, t.weekdays || catalog.ALL, t.coins]);
    if (rewardIds.length) await pool.query('INSERT INTO task_rewards (task_id,reward_id) VALUES ?', [rewardIds.map(rw => [r.insertId, rw])]);
    titles.add(t.title.toLowerCase()); n++;
  }
  return n;
}
async function linkableRewards(fid) {
  const [rows] = await pool.query("SELECT id FROM rewards WHERE family_id=? AND active=1 AND (kind='time' OR goal_mode='tasks')", [fid]);
  return rows.map(r => r.id);
}

router.post('/catalog', wrap(async (req, res) => {
  const keys = (req.body.keys || []).map(String);
  if (!keys.length) return res.status(400).json({ error: 'Escolha ao menos uma tarefa' });
  res.json({ created: await addCatalogTasks(req.fid, keys, await linkableRewards(req.fid)) });
}));

router.post('/setup', wrap(async (req, res) => {
  const b = req.body, fid = req.fid;
  const kids = (b.kids || []).filter(k => k.name?.trim()).slice(0, 12);
  const [[cnt]] = await pool.query('SELECT COUNT(*) n FROM kids WHERE family_id=? AND active=1', [fid]);
  if (!kids.length && !cnt.n) return res.status(400).json({ error: 'Cadastre ao menos um filho' });
  for (const [i, k] of kids.entries())
    await pool.query('INSERT INTO kids (family_id,name,avatar,color,sort) VALUES (?,?,?,?,?)', [fid, k.name.trim().slice(0, 60), k.avatar || 'fox', k.color || '#ff4fae', cnt.n + i]);
  for (const sel of b.rewards || []) {
    const rw = catalog.REWARDS.find(x => x.key === sel.key); if (!rw) continue;
    const v = +sel.value > 0 ? +sel.value : rw.value;
    await pool.query('INSERT INTO rewards (family_id,title,icon,kind,unit,total_value,goal_mode) VALUES (?,?,?,?,?,?,?)',
      [fid, rw.title, rw.icon, rw.kind, rw.kind === 'time' ? 'min' : (rw.goal_mode === 'coins' ? 'moedas' : 'tarefas'), v, rw.goal_mode || null]);
  }
  const created = await addCatalogTasks(fid, (b.tasks || []).map(String), await linkableRewards(fid));
  await pool.query('UPDATE families SET onboarded=1 WHERE id=?', [fid]);
  res.json({ kids: kids.length, tasks: created });
}));
router.post('/setup/skip', wrap(async (req, res) => {
  await pool.query('UPDATE families SET onboarded=1 WHERE id=?', [req.fid]);
  res.json({ ok: true });
}));

// ---------- Configurações ----------
router.put('/settings', wrap(async (req, res) => {
  const { coin_value, auto_approve, new_pin } = req.body;
  if (new_pin && !/^\d{4,8}$/.test(String(new_pin))) return res.status(400).json({ error: 'PIN: 4 a 8 números' });
  await pool.query('UPDATE families SET coin_value=?,auto_approve=? WHERE id=?', [Math.max(0, +coin_value || 0), bool(auto_approve), req.fid]);
  if (new_pin) await pool.query('UPDATE families SET parent_pin_hash=? WHERE id=?', [bcrypt.hashSync(String(new_pin), 10), req.fid]);
  res.json({ ok: true });
}));

module.exports = router;
