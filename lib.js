const { pool } = require('./db');
const { r2 } = require('./util');

// Tarefas ativas de um jogador. all_kids: 1 = todos os filhos, 2 = toda a família (adultos também), 0 = só os escolhidos
async function kidTasks(fid, kidId) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tasks t WHERE t.family_id=? AND t.active=1 AND
     (t.all_kids=2 OR (t.all_kids=1 AND (SELECT adult FROM kids WHERE id=?)=0)
      OR EXISTS (SELECT 1 FROM task_kids k WHERE k.task_id=t.id AND k.kid_id=?))`, [fid, kidId, kidId]);
  return rows;
}

// Tarefas do jogador em `day`. A que "passa para o dia seguinte" some depois do dia em que foi feita
// (se o pai rejeitar, ela volta a aparecer).
async function dayTasks(fid, kidId, day) {
  const { taskOnDay } = require('./util');
  const list = (await kidTasks(fid, kidId)).filter(t => taskOnDay(t, day));
  const carry = list.filter(t => t.carry && !t.repeat_weekly && t.type === 'one_off').map(t => t.id);
  if (!carry.length) return list;
  const [done] = await pool.query("SELECT task_id FROM completions WHERE kid_id=? AND task_id IN (?) AND day<? AND status<>'rejected'", [kidId, carry, day]);
  const gone = new Set(done.map(d => d.task_id));
  return list.filter(t => !gone.has(t.id));
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

// Ordem das tarefas de um filho: a dele (se os pais arrumaram só para ele) ou a da família (aba Todas).
// As tarefas ainda sem lugar entram pelo horário.
// Tarefa sem horário recebe `until` = horário da próxima tarefa com horário abaixo dela ("fazer até 9:00").
async function ordered(kidId, tasks) {
  const [rows] = await pool.query('SELECT task_id,pos FROM task_order WHERE kid_id=?', [kidId]);
  const pos = rows.length ? new Map(rows.map(r => [r.task_id, r.pos])) : familyPos(tasks);
  return Object.assign(arrange(tasks, pos), { custom: rows.length > 0 });
}
const familyPos = (tasks) => new Map(tasks.filter(t => t.sort != null).map(t => [t.id, t.sort]));
function arrange(tasks, pos) {
  const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.id - b.id;
  const list = tasks.filter(t => pos.has(t.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
  for (const t of tasks.filter(t => !pos.has(t.id)).sort(byTime)) {
    const i = t.time ? list.findIndex(p => p.time && p.time > t.time) : -1;
    if (i < 0) list.push(t); else list.splice(i, 0, t);
  }
  let next = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].time) next = list[i].time;
    else list[i] = { ...list[i], until: next };
  }
  return list;
}

module.exports = { kidTasks, dayTasks, shares, balance, approve, ordered, arrange, familyPos };
