const { pool } = require('./db');
const { r2 } = require('./util');

// Tarefas ativas atribuídas ao filho (all_kids ou vínculo explícito)
async function kidTasks(fid, kidId) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tasks t WHERE t.family_id=? AND t.active=1 AND
     (t.all_kids=1 OR EXISTS (SELECT 1 FROM task_kids k WHERE k.task_id=t.id AND k.kid_id=?))`, [fid, kidId]);
  return rows;
}

// Valor de cada recompensa por tarefa: tempo = total ÷ nº de tarefas vinculadas; meta por tarefas = +1.
// Retorna { taskId: [{reward, value}] }
async function shares(fid, kidId) {
  const tasks = await kidTasks(fid, kidId);
  const ids = tasks.map(t => t.id);
  const out = {};
  if (!ids.length) return out;
  const [links] = await pool.query(
    `SELECT tr.task_id, r.* FROM task_rewards tr JOIN rewards r ON r.id=tr.reward_id
     WHERE r.family_id=? AND r.active=1 AND tr.task_id IN (?)`, [fid, ids]);
  const count = {};
  links.forEach(l => { count[l.id] = (count[l.id] || 0) + 1; });
  for (const l of links) {
    let value = 0;
    if (l.kind === 'time') value = r2(l.total_value / count[l.id]);
    else if (l.goal_mode === 'tasks') value = 1;
    else continue; // meta em moedas não depende de tarefa
    (out[l.task_id] ||= []).push({ reward_id: l.id, title: l.title, icon: l.icon, kind: l.kind, unit: l.unit, value });
  }
  return out;
}

async function balance(fid, kidId) {
  const [[r]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) b FROM ledger WHERE family_id=? AND kid_id=? AND kind='coin'`, [fid, kidId]);
  return r2(r.b);
}

// Aprova uma conclusão pendente e credita ganhos (valores congelados no ledger)
async function approve(fid, completionId) {
  const [[c]] = await pool.query(
    `SELECT c.*, t.coins, t.title FROM completions c JOIN tasks t ON t.id=c.task_id
     WHERE c.id=? AND c.family_id=? AND c.status='pending'`, [completionId, fid]);
  if (!c) return false;
  const sh = (await shares(fid, c.kid_id))[c.task_id] || [];
  const rows = [];
  if (c.coins > 0) rows.push([fid, c.kid_id, 'coin', null, c.coins, c.day, c.id, c.title]);
  for (const s of sh) rows.push([fid, c.kid_id, s.kind === 'time' ? 'time' : 'goal', s.reward_id, s.value, c.day, c.id, c.title]);
  if (rows.length)
    await pool.query('INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,completion_id,note) VALUES ?', [rows]);
  await pool.query(`UPDATE completions SET status='approved', decided_at=NOW() WHERE id=?`, [c.id]);
  return true;
}

module.exports = { kidTasks, shares, balance, approve };
