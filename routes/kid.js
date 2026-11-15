const router = require('express').Router();
const { pool } = require('../db');
const { today, r2, taskOnDay } = require('../util');
const { kidTasks, shares, balance, approve, ordered } = require('../lib');
const { access } = require('../billing');
const push = require('../push');

async function pendingGains(kidId, sh, day) {
  const [pend] = await pool.query(
    `SELECT c.task_id, c.day, t.coins FROM completions c JOIN tasks t ON t.id=c.task_id WHERE c.kid_id=? AND c.status='pending'`, [kidId]);
  const pTime = {}, pGoal = {};
  for (const p of pend) for (const s of sh[p.task_id] || []) {
    if (s.kind === 'time') { if (p.day === day) pTime[s.reward_id] = (pTime[s.reward_id] || 0) + s.value; }
    else pGoal[s.reward_id] = (pGoal[s.reward_id] || 0) + s.value;
  }
  return { pendingCoins: r2(pend.reduce((a, p) => a + (+p.coins || 0), 0)), pTime, pGoal };
}

// Lista de jogadores com o resumo do dia para o card de seleção
router.get('/kids', async (req, res) => {
  const [kids] = await pool.query('SELECT id,name,avatar,color FROM kids WHERE family_id=? AND active=1 ORDER BY sort,id', [req.fid]);
  const day = today();
  for (const k of kids) {
    const tasks = (await kidTasks(req.fid, k.id)).filter(t => taskOnDay(t, day));
    const [[c]] = await pool.query(`SELECT COUNT(*) n FROM completions WHERE kid_id=? AND day=? AND status<>'rejected'`, [k.id, day]);
    const sh = await shares(req.fid, k.id);
    k.coins = r2(await balance(req.fid, k.id) + (await pendingGains(k.id, sh, day)).pendingCoins);
    k.total = tasks.length; k.done = Math.min(c.n, tasks.length);
  }
  res.json(kids);
});

async function ownKid(req, res) {
  const [[k]] = await pool.query('SELECT id,name,avatar,color FROM kids WHERE id=? AND family_id=? AND active=1', [req.params.id, req.fid]);
  if (!k) res.status(404).json({ error: 'Jogador não encontrado' });
  return k;
}

router.get('/kids/:id/home', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today(), fid = req.fid;
  const tasks = await ordered(kid.id, (await kidTasks(fid, kid.id)).filter(t => taskOnDay(t, day)));
  const sh = await shares(fid, kid.id);
  const [comps] = await pool.query('SELECT task_id,status FROM completions WHERE kid_id=? AND day=?', [kid.id, day]);
  const st = Object.fromEntries(comps.map(c => [c.task_id, c.status]));
  const list = tasks.map(t => ({
    id: t.id, title: t.title, icon: t.icon, description: t.description, type: t.type,
    time: t.time, until: t.until || null, coins: t.coins, status: st[t.id] || 'todo', rewards: sh[t.id] || [],
  }));

  // Tempo de tela de hoje (não acumula)
  const [rewards] = await pool.query('SELECT * FROM rewards WHERE family_id=? AND active=1', [fid]);
  const [tl] = await pool.query(
    `SELECT reward_id, SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) earned, -SUM(CASE WHEN amount<0 THEN amount ELSE 0 END) used
     FROM ledger WHERE kid_id=? AND kind='time' AND day=? GROUP BY reward_id`, [kid.id, day]);
  const tm = Object.fromEntries(tl.map(x => [x.reward_id, x]));
  const [gl] = await pool.query(`SELECT reward_id, SUM(amount) p FROM ledger WHERE kid_id=? AND kind='goal' GROUP BY reward_id`, [kid.id]);
  const gp = Object.fromEntries(gl.map(x => [x.reward_id, x.p]));
  const bal = await balance(fid, kid.id);

  // Ganhos ainda não aprovados: a criança já vê, o pai confirma depois
  const { pendingCoins, pTime, pGoal } = await pendingGains(kid.id, sh, day);

  const relevant = new Set(Object.values(sh).flat().map(s => s.reward_id));
  const time = rewards.filter(r => r.kind === 'time' && relevant.has(r.id)).map(r => ({
    id: r.id, title: r.title, icon: r.icon, unit: r.unit, cap: r.total_value,
    earned: r2(tm[r.id]?.earned || 0), used: r2(tm[r.id]?.used || 0), pending: r2(pTime[r.id] || 0),
  }));
  const goals = rewards.filter(r => r.kind === 'goal' && (r.goal_mode === 'coins' || relevant.has(r.id))).map(r => ({
    id: r.id, title: r.title, icon: r.icon, mode: r.goal_mode, target: r.total_value,
    progress: r2(r.goal_mode === 'coins' ? bal : (gp[r.id] || 0)),
    pending: r2(r.goal_mode === 'coins' ? pendingCoins : (pGoal[r.id] || 0)),
  }));
  res.json({
    kid, day, balance: bal, pending_coins: pendingCoins, tasks: list, time, goals,
    done: list.filter(t => t.status === 'approved').length,
    pending: list.filter(t => t.status === 'pending').length, total: list.length,
  });
});

router.post('/kids/:id/complete', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today();
  const task = (await kidTasks(req.fid, kid.id)).find(t => t.id === +req.body.task_id);
  if (!task || !taskOnDay(task, day)) return res.status(400).json({ error: 'Tarefa não disponível hoje' });
  const [r] = await pool.query('INSERT IGNORE INTO completions (family_id,task_id,kid_id,day) VALUES (?,?,?,?)', [req.fid, task.id, kid.id, day]);
  if (r.affectedRows) {
    const [[k]] = await pool.query('SELECT auto_approve FROM kids WHERE id=?', [kid.id]);
    if (k.auto_approve) await approve(req.fid, r.insertId);
    else if (access(req.family).plus) push.sendToFamily(req.fid, { title: `${kid.name} concluiu: ${task.title}`, body: 'Toque para conferir e aprovar.', tag: 'approve', url: '/app#/admin' }, 'approvals').catch(() => {});
  }
  res.json({ ok: true });
});

// Desfazer enquanto ainda pendente
router.delete('/kids/:id/complete/:taskId', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  await pool.query(`DELETE FROM completions WHERE kid_id=? AND task_id=? AND day=? AND status='pending' AND family_id=?`,
    [kid.id, req.params.taskId, today(), req.fid]);
  res.json({ ok: true });
});

module.exports = router;
