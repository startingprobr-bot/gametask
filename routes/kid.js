const router = require('express').Router();
const { pool } = require('../db');
const { today, r2, taskOnDay } = require('../util');
const { kidTasks, dayTasks, shares, balance, approve, ordered } = require('../lib');
const crypto = require('crypto');
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
  const [kids] = await pool.query('SELECT id,name,avatar,color,adult FROM kids WHERE family_id=? AND active=1 ORDER BY adult,sort,id', [req.fid]);
  const day = today();
  for (const k of kids) {
    const tasks = await dayTasks(req.fid, k.id, day);
    const [[c]] = await pool.query(`SELECT COUNT(*) n FROM completions WHERE kid_id=? AND day=? AND status<>'rejected'`, [k.id, day]);
    const sh = await shares(req.fid, k.id);
    k.coins = k.adult ? null : r2(await balance(req.fid, k.id) + (await pendingGains(k.id, sh, day)).pendingCoins);
    k.total = tasks.length; k.done = Math.min(c.n, tasks.length);
    const [[m]] = await pool.query('SELECT COUNT(*) n FROM messages WHERE kid_id=? AND read_at IS NULL', [k.id]);
    k.msgs = m.n;
  }
  res.json(kids);
});

async function ownKid(req, res) {
  const [[k]] = await pool.query('SELECT id,name,avatar,color,adult FROM kids WHERE id=? AND family_id=? AND active=1', [req.params.id, req.fid]);
  if (!k) res.status(404).json({ error: 'Jogador não encontrado' });
  return k;
}

// Roleta do dia: libera quando todas as missões de hoje estão feitas; um giro por dia.
// Enquanto os pais não montam a roleta, valem os prêmios de exemplo.
const WHEEL_SAMPLE = [['🤗', 'Abraço do pai'], ['🤗', 'Abraço da mãe'], ['🎮', '20 min de game'], ['🍦', 'Sorvete'], ['🎬', 'Escolher o filme'], ['🌙', 'Dormir mais tarde']]
  .map(([emoji, label]) => ({ emoji, label }));
async function wheelPrizes(fid) {
  const [prizes] = await pool.query('SELECT label,emoji,coins FROM wheel_prizes WHERE family_id=? ORDER BY sort,id', [fid]);
  return prizes.length >= 2 ? prizes : WHEEL_SAMPLE;
}
async function wheelState(fid, kidId, day, list) {
  const prizes = await wheelPrizes(fid);
  const [[s]] = await pool.query('SELECT label,emoji,coins FROM wheel_spins WHERE kid_id=? AND day=?', [kidId, day]);
  const finished = list.length > 0 && list.every(t => t.status === 'approved' || t.status === 'pending');
  return { prizes, spun: s || null, ready: finished && !s };
}
router.post('/kids/:id/spin', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today();
  const tasks = await dayTasks(req.fid, kid.id, day);
  const [comps] = await pool.query('SELECT task_id,status FROM completions WHERE kid_id=? AND day=?', [kid.id, day]);
  const st = Object.fromEntries(comps.map(c => [c.task_id, c.status]));
  const w = await wheelState(req.fid, kid.id, day, tasks.map(t => ({ status: st[t.id] || 'todo' })));
  if (!w) return res.status(400).json({ error: 'A roleta ainda não tem prêmios' });
  if (w.spun) return res.status(400).json({ error: 'Você já girou hoje. Volte amanhã!' });
  if (!w.ready) return res.status(400).json({ error: 'Termine todas as missões de hoje para girar' });
  const index = crypto.randomInt(w.prizes.length), p = w.prizes[index], coins = kid.adult ? 0 : +p.coins || 0;
  const [r] = await pool.query('INSERT IGNORE INTO wheel_spins (family_id,kid_id,day,label,emoji,coins) VALUES (?,?,?,?,?,?)', [req.fid, kid.id, day, p.label, p.emoji, coins]);
  if (!r.affectedRows) return res.status(400).json({ error: 'Você já girou hoje. Volte amanhã!' });
  // moedas da roleta entram direto na conta, sem precisar de tarefa nem aprovação
  if (coins > 0) await pool.query("INSERT INTO ledger (family_id,kid_id,kind,amount,day,note) VALUES (?,?,'coin',?,?,?)", [req.fid, kid.id, coins, day, ('Roleta do dia: ' + p.label).slice(0, 160)]);
  res.json({ index, prize: p, prizes: w.prizes });
});

router.get('/kids/:id/home', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today(), fid = req.fid;
  const tasks = await ordered(kid.id, await dayTasks(fid, kid.id, day));
  const sh = kid.adult ? {} : await shares(fid, kid.id);
  const [comps] = await pool.query('SELECT task_id,status FROM completions WHERE kid_id=? AND day=?', [kid.id, day]);
  const st = Object.fromEntries(comps.map(c => [c.task_id, c.status]));
  const list = tasks.map(t => ({
    id: t.id, title: t.title, icon: t.icon, description: t.description, type: t.type,
    time: t.time, until: t.until || null, late: t.type === 'one_off' && !t.repeat_weekly && t.date < day, coins: kid.adult ? 0 : t.coins, status: st[t.id] || 'todo', rewards: sh[t.id] || [],
  }));

  // Tempo de tela de hoje (não acumula)
  const [rewards] = await pool.query('SELECT * FROM rewards WHERE family_id=? AND active=1 AND (kid_id IS NULL OR kid_id=?)', [fid, kid.id]);
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
  if (kid.adult) rewards.length = 0;
  const time = rewards.filter(r => r.kind === 'time' && relevant.has(r.id)).map(r => ({
    id: r.id, title: r.title, icon: r.icon, unit: r.unit, cap: r.total_value,
    earned: r2(tm[r.id]?.earned || 0), used: r2(tm[r.id]?.used || 0), pending: r2(pTime[r.id] || 0),
  }));
  const goals = rewards.filter(r => r.kind === 'goal' && (r.goal_mode === 'coins' || relevant.has(r.id))).map(r => ({
    id: r.id, title: r.title, icon: r.icon, mode: r.goal_mode, target: r.total_value,
    progress: r2(r.goal_mode === 'coins' ? bal : (gp[r.id] || 0)),
    pending: r2(r.goal_mode === 'coins' ? pendingCoins : (pGoal[r.id] || 0)),
  }));
  const wheel = await wheelState(req.fid, kid.id, day, list);
  const [messages] = await pool.query('SELECT id,from_name,text,created_at FROM messages WHERE kid_id=? AND read_at IS NULL ORDER BY id', [kid.id]);
  const fix = await pendingFix(fid, kid.id);
  res.json({
    kid, day, balance: bal, pending_coins: pendingCoins, tasks: list, time, goals, wheel, messages, fix,
    done: list.filter(t => t.status === 'approved').length,
    pending: list.filter(t => t.status === 'pending').length, total: list.length,
  });
});

router.post('/kids/:id/complete', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today();
  const task = (await dayTasks(req.fid, kid.id, day)).find(t => t.id === +req.body.task_id);
  if (!task) return res.status(400).json({ error: 'Tarefa não disponível hoje' });
  // adulto: fica feito na hora, sem ganhos e sem pedir aprovação
  if (kid.adult) {
    await pool.query("INSERT IGNORE INTO completions (family_id,task_id,kid_id,day,status,decided_at) VALUES (?,?,?,?,'approved',NOW())", [req.fid, task.id, kid.id, day]);
    return res.json({ ok: true });
  }
  const [r] = await pool.query('INSERT IGNORE INTO completions (family_id,task_id,kid_id,day) VALUES (?,?,?,?)', [req.fid, task.id, kid.id, day]);
  if (r.affectedRows) {
    const [[k]] = await pool.query('SELECT auto_approve FROM kids WHERE id=?', [kid.id]);
    if (k.auto_approve) await approve(req.fid, r.insertId);
    else if (access(req.family).plus) push.sendToFamily(req.fid, { title: `${kid.name} concluiu: ${task.title}`, body: 'Toque para conferir e aprovar.', tag: 'approve', url: '/app#/admin' }, 'approvals').catch(() => {});
  }
  res.json({ ok: true });
});

// Recado lido (com resposta rápida opcional, que avisa os pais)
const REPLIES = ['Ok!', 'Já vou!', 'Preciso de ajuda'];
router.post('/kids/:id/messages/:mid', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const reply = REPLIES.includes(req.body.reply) ? req.body.reply : null;
  const [r] = await pool.query('UPDATE messages SET read_at=NOW(),reply=? WHERE id=? AND kid_id=? AND read_at IS NULL', [reply, req.params.mid, kid.id]);
  if (r.affectedRows && reply && access(req.family).plus) {
    const [[m]] = await pool.query('SELECT text FROM messages WHERE id=?', [req.params.mid]);
    push.sendToFamily(req.fid, { title: `${kid.name}: ${reply}`, body: `Resposta ao recado "${m.text.slice(0, 80)}"`, tag: 'reply' + req.params.mid, url: '/app#/admin' }, 'approvals').catch(() => {});
  }
  res.json({ ok: true });
});

// ---------- Roletas de correção ----------
// Os pais escolhem quem e qual roleta; ela gira no aparelho dos pais ou fica esperando na tela do jogador.
async function fixItems(wheelId) {
  const [items] = await pool.query('SELECT label,emoji,coins FROM fix_items WHERE wheel_id=? ORDER BY sort,id', [wheelId]);
  return items;
}
async function pendingFix(fid, kidId) {
  const [rows] = await pool.query('SELECT id,wheel_id,wheel_name FROM fix_spins WHERE family_id=? AND kid_id=? AND spun_at IS NULL ORDER BY id', [fid, kidId]);
  const out = [];
  for (const r of rows) { const prizes = await fixItems(r.wheel_id); if (prizes.length >= 2) out.push({ id: r.id, name: r.wheel_name, prizes }); }
  return out;
}
const fail = (status, error) => Object.assign(new Error(error), { status });
// Sorteia o item; se ele tira moedas, desconta (sem deixar o saldo negativo)
async function spinFix(fid, spinId, kidId) {
  const [[s]] = await pool.query('SELECT * FROM fix_spins WHERE id=? AND family_id=?' + (kidId ? ' AND kid_id=?' : ''), kidId ? [spinId, fid, kidId] : [spinId, fid]);
  if (!s) throw fail(404, 'Roleta não encontrada');
  if (s.spun_at) throw fail(400, 'Essa roleta já foi girada');
  const items = await fixItems(s.wheel_id);
  if (items.length < 2) throw fail(400, 'Essa roleta precisa de pelo menos 2 itens');
  const index = crypto.randomInt(items.length), p = items[index];
  const [[k]] = await pool.query('SELECT adult FROM kids WHERE id=?', [s.kid_id]);
  let coins = k?.adult ? 0 : +p.coins || 0;
  if (coins > 0) coins = Math.min(coins, Math.max(0, Math.floor(await balance(fid, s.kid_id))));
  const [r] = await pool.query('UPDATE fix_spins SET label=?,emoji=?,coins=?,spun_at=NOW() WHERE id=? AND spun_at IS NULL', [p.label, p.emoji, coins, s.id]);
  if (!r.affectedRows) throw fail(400, 'Essa roleta já foi girada');
  if (coins > 0) await pool.query("INSERT INTO ledger (family_id,kid_id,kind,amount,day,note) VALUES (?,?,'coin',?,?,?)", [fid, s.kid_id, -coins, today(), `Correção (${s.wheel_name}): ${p.label}`.slice(0, 160)]);
  return { index, prize: { ...p, coins }, prizes: items };
}
router.post('/kids/:id/fix/:sid/spin', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  try { res.json(await spinFix(req.fid, +req.params.sid, kid.id)); }
  catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro interno' }); }
});

// Desfazer enquanto ainda pendente
router.delete('/kids/:id/complete/:taskId', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  await pool.query(`DELETE FROM completions WHERE kid_id=? AND task_id=? AND day=? AND (status='pending' OR ?) AND family_id=?`,
    [kid.id, req.params.taskId, today(), kid.adult ? 1 : 0, req.fid]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.wheelPrizes = wheelPrizes;
module.exports.spinFix = spinFix;
module.exports.fixItems = fixItems;
