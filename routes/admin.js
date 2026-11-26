const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { today, r2 } = require('../util');
const { balance, approve, kidTasks, ordered, arrange, familyPos } = require('../lib');

const bool = (v) => (v ? 1 : 0);
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });

// ---------- Filhos ----------
router.get('/kids', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM kids WHERE family_id=? ORDER BY active DESC,adult,sort,id', [req.fid]);
  res.json(rows.map(({ pin_hash, ...k }) => ({ ...k, has_pin: !!pin_hash })));
}));
router.post('/kids', wrap(async (req, res) => {
  const { name, avatar = 'fox', color = '#ff4fae', auto_approve } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const [r] = await pool.query('INSERT INTO kids (family_id,name,avatar,color,auto_approve) VALUES (?,?,?,?,?)', [req.fid, name.trim(), avatar, color, bool(auto_approve)]);
  res.json({ id: r.insertId });
}));
// Bloquear (ou liberar) o tempo de tela de uma criança agora: para os cronômetros e os jogos bloqueiam até liberar
router.post('/kids/:id/lock', wrap(async (req, res) => {
  const [[k]] = await pool.query('SELECT id,name,avatar,color,adult FROM kids WHERE id=? AND family_id=? AND adult=0', [req.params.id, req.fid]);
  if (!k) return res.status(404).json({ error: 'Filho não encontrado' });
  const locked = bool(req.body.locked);
  await pool.query('UPDATE kids SET locked=? WHERE id=?', [locked, k.id]);
  if (locked) {
    const { kidTime, stopRun } = require('./kid');
    for (const t of await kidTime(req.fid, k)) if (t.run !== null) await stopRun(req.fid, k.id, t.id, t.left);
  }
  require('../push').nudge(req.fid).catch(() => {});
  res.json({ ok: true, locked: !!locked });
}));
router.put('/kids/:id', wrap(async (req, res) => {
  const { name, avatar, color, active, auto_approve } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  await pool.query('UPDATE kids SET name=?,avatar=?,color=?,active=?,auto_approve=? WHERE id=? AND family_id=?',
    [name.trim(), avatar, color, bool(active), bool(auto_approve), req.params.id, req.fid]);
  // PIN da criança: 4 números (vazio = não muda; clear_pin = tira)
  const pin = String(req.body.pin || '').trim();
  if (req.body.clear_pin) await pool.query('UPDATE kids SET pin_hash=NULL WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  else if (pin) {
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'O PIN da criança tem 4 números' });
    await pool.query('UPDATE kids SET pin_hash=? WHERE id=? AND family_id=?', [bcrypt.hashSync(pin, 8), req.params.id, req.fid]);
  }
  res.json({ ok: true });
}));

// Apagar um jogador. Filho: some com tudo dele (histórico, moedas, giros). Adulto: só sai do jogo
// (o responsável continua com o acesso dele e pode voltar a jogar em Ajustes → Responsáveis).
router.delete('/kids/:id', wrap(async (req, res) => {
  const [[k]] = await pool.query('SELECT id,adult FROM kids WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  if (!k) return res.status(404).json({ error: 'Jogador não encontrado' });
  if (k.adult) { await pool.query('UPDATE kids SET active=0 WHERE id=?', [k.id]); return res.json({ ok: true, left: true }); }
  const [own] = await pool.query('SELECT id FROM rewards WHERE kid_id=? AND family_id=?', [k.id, req.fid]);
    if (own.length) { await pool.query('DELETE FROM task_rewards WHERE reward_id IN (?)', [own.map(r => r.id)]); await pool.query('DELETE FROM rewards WHERE id IN (?)', [own.map(r => r.id)]); }
    for (const t of ['completions', 'ledger', 'payouts', 'task_kids', 'task_order', 'wheel_spins', 'fix_spins', 'alarms']) await pool.query(`DELETE FROM ${t} WHERE kid_id=?`, [k.id]);
  await pool.query('DELETE FROM kids WHERE id=? AND family_id=?', [k.id, req.fid]);
  res.json({ ok: true });
}));

// Ordem das tarefas de um filho (ids na ordem em que aparecem para ele)
async function famKid(req) {
  const [[k]] = await pool.query('SELECT id FROM kids WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  return k?.id;
}
router.get('/kids/:id/order', wrap(async (req, res) => {
  const kid = await famKid(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const list = await ordered(kid, await kidTasks(req.fid, kid));
  res.json({ ids: list.map(t => t.id), custom: list.custom });
}));
// Volta o filho para a ordem da família
router.delete('/kids/:id/order', wrap(async (req, res) => {
  const kid = await famKid(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  await pool.query('DELETE FROM task_order WHERE kid_id=?', [kid]);
  res.json({ ok: true });
}));
router.put('/kids/:id/order', wrap(async (req, res) => {
  const kid = await famKid(req); if (!kid) return res.status(404).json({ error: 'Filho não encontrado' });
  const mine = new Set((await kidTasks(req.fid, kid)).map(t => t.id));
  const ids = [...new Set((req.body.ids || []).map(Number))].filter(id => mine.has(id));
  await pool.query('DELETE FROM task_order WHERE kid_id=?', [kid]);
  if (ids.length) await pool.query('INSERT INTO task_order (kid_id,task_id,pos) VALUES ?', [ids.map((id, i) => [kid, id, i])]);
  res.json({ ok: true });
}));

// ---------- Tarefas ----------
async function saveTask(req, id) {
  const b = req.body, fid = req.fid;
  const v = [b.title.trim(), b.icon || 'star', b.description || null, b.type === 'one_off' ? 'one_off' : 'daily',
    b.weekdays || '0123456', b.type === 'one_off' ? b.date : null, b.time || null, bool(b.repeat_weekly),
    +b.coins || 0, Math.max(0, Math.min(2, +b.all_kids || 0)), bool(b.active ?? 1), bool(b.type === 'one_off' && !b.repeat_weekly && b.carry), Math.max(0, Math.min(600, Math.round(+b.minutes || 0)))];
  if (id) {
    await pool.query('UPDATE tasks SET title=?,icon=?,description=?,type=?,weekdays=?,date=?,time=?,repeat_weekly=?,coins=?,all_kids=?,active=?,carry=?,minutes=? WHERE id=? AND family_id=?', [...v, id, fid]);
  } else {
    const [r] = await pool.query('INSERT INTO tasks (title,icon,description,type,weekdays,date,time,repeat_weekly,coins,all_kids,active,carry,minutes,family_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [...v, fid]);
    id = r.insertId;
  }
  await pool.query('DELETE FROM task_kids WHERE task_id=?', [id]);
  if (!(+b.all_kids) && b.kid_ids?.length) await pool.query('INSERT INTO task_kids (task_id,kid_id) VALUES ?', [b.kid_ids.map(k => [id, +k])]);
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
  // ativas na ordem da família, inativas no fim
  const on = tasks.filter(t => t.active);
  res.json([...arrange(on, familyPos(on)), ...tasks.filter(t => !t.active)]);
}));
// Ordem da família (aba Todas). Vale para todos os filhos: quem tinha ordem própria volta a seguir esta.
router.put('/tasks/order', wrap(async (req, res) => {
  const [mine] = await pool.query('SELECT id FROM tasks WHERE family_id=?', [req.fid]);
  const own = new Set(mine.map(t => t.id));
  const ids = [...new Set((req.body.ids || []).map(Number))].filter(id => own.has(id));
  await pool.query('UPDATE tasks SET sort=NULL WHERE family_id=?', [req.fid]);
  for (const [i, id] of ids.entries()) await pool.query('UPDATE tasks SET sort=? WHERE id=?', [i, id]);
  await pool.query('DELETE FROM task_order WHERE kid_id IN (SELECT id FROM kids WHERE family_id=?)', [req.fid]);
  res.json({ ok: true });
}));
// Apagar uma tarefa para a família toda. Com histórico, só fica inativa (o extrato continua certo).
router.delete('/tasks/:id', wrap(async (req, res) => {
  const id = +req.params.id;
  if (!await ownsTask(req, id)) return res.status(404).json({ error: 'Não encontrada' });
  const [[c]] = await pool.query('SELECT COUNT(*) n FROM completions WHERE task_id=?', [id]);
  if (c.n) { await pool.query('UPDATE tasks SET active=0 WHERE id=?', [id]); return res.json({ ok: true, archived: true }); }
  for (const t of ['task_kids', 'task_rewards', 'task_order']) await pool.query(`DELETE FROM ${t} WHERE task_id=?`, [id]);
  await pool.query('DELETE FROM tasks WHERE id=? AND family_id=?', [id, req.fid]);
  res.json({ ok: true });
}));
// Tirar a tarefa só de um filho: as outras pessoas continuam com ela
router.delete('/kids/:kid/tasks/:id', wrap(async (req, res) => {
  const kid = await famKid({ ...req, params: { id: req.params.kid } }), id = +req.params.id;
  if (!kid || !await ownsTask(req, id)) return res.status(404).json({ error: 'Não encontrada' });
  const [[t]] = await pool.query('SELECT all_kids FROM tasks WHERE id=?', [id]);
  if (t.all_kids) { // "todos" vira uma lista escolhida, sem este filho
    const [who] = await pool.query('SELECT id FROM kids WHERE family_id=? AND active=1' + (t.all_kids === 1 ? ' AND adult=0' : ''), [req.fid]);
    await pool.query('UPDATE tasks SET all_kids=0 WHERE id=?', [id]);
    await pool.query('DELETE FROM task_kids WHERE task_id=?', [id]);
    const rest = who.map(k => k.id).filter(k => k !== kid);
    if (rest.length) await pool.query('INSERT INTO task_kids (task_id,kid_id) VALUES ?', [rest.map(k => [id, k])]);
  } else await pool.query('DELETE FROM task_kids WHERE task_id=? AND kid_id=?', [id, kid]);
  await pool.query('DELETE FROM task_order WHERE kid_id=? AND task_id=?', [kid, id]);
  res.json({ ok: true });
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

// ---------- Roleta do dia ----------
router.get('/wheel', wrap(async (req, res) => {
  const [mine] = await pool.query('SELECT id FROM wheel_prizes WHERE family_id=?', [req.fid]);
  const prizes = await require('./kid').wheelPrizes(req.fid);
  const [spins] = await pool.query(
    `SELECT s.label,s.emoji,s.coins,DATE_FORMAT(s.day,'%Y-%m-%d') day,k.name kid FROM wheel_spins s JOIN kids k ON k.id=s.kid_id
     WHERE s.family_id=? ORDER BY s.id DESC LIMIT 10`, [req.fid]);
  res.json({ prizes, spins, sample: mine.length < 2 });
}));
router.put('/wheel', wrap(async (req, res) => {
  const list = cleanItems(req.body.prizes);
  await pool.query('DELETE FROM wheel_prizes WHERE family_id=?', [req.fid]);
  if (list.length) await pool.query('INSERT INTO wheel_prizes (family_id,label,emoji,coins,sort) VALUES ?', [list.map((p, i) => [req.fid, p.label, p.emoji, p.coins, i])]);
  res.json({ ok: true });
}));

// itens de roleta vindos do formulário: nome, emoji e moedas (0 a 1000)
function cleanItems(arr) {
  return (Array.isArray(arr) ? arr : []).map(p => {
    const coins = Math.max(0, Math.min(1000, Math.round(+p.coins || 0)));
    return { label: String(p.label || '').trim().slice(0, 40) || (coins ? `${coins} moedas` : ''), emoji: String(p.emoji || '').trim().slice(0, 8) || (coins ? '💰' : null), coins };
  }).filter(p => p.label).slice(0, 12);
}

// ---------- Roletas de correção ----------
const FIX_SAMPLES = [
  ['Desobediência', [['⏰', '10 min pensando'], ['📵', 'Sem tela por 30 min'], ['🧹', 'Ajudar a arrumar a casa'], ['🛏️', 'Dormir 15 min mais cedo'], ['🙏', 'Pedir desculpas'], ['💰', 'Perde 10 moedas', 10]]],
  ['Implicância', [['🤝', 'Pedir desculpas e abraçar'], ['🎁', 'Fazer algo legal pro irmão'], ['🧹', 'Fazer uma tarefa do irmão'], ['💌', 'Desenhar um cartão pro irmão'], ['📵', 'Sem tela por 20 min'], ['💰', 'Perde 5 moedas', 5]]],
  ['Gritaria', [['🤫', '5 min em silêncio'], ['🗣️', 'Repetir falando baixinho'], ['🧘', 'Respirar fundo 10 vezes'], ['🙏', 'Pedir desculpas'], ['📵', 'Sem tela por 15 min']]],
];
async function saveFixItems(fid, wheelId, items) {
  await pool.query('DELETE FROM fix_items WHERE wheel_id=? AND family_id=?', [wheelId, fid]);
  if (items.length) await pool.query('INSERT INTO fix_items (family_id,wheel_id,label,emoji,coins,sort) VALUES ?', [items.map((p, i) => [fid, wheelId, p.label, p.emoji, p.coins, i])]);
}
const ownFix = async (req) => (await pool.query('SELECT id,name,kind FROM fix_wheels WHERE id=? AND family_id=?', [req.params.id, req.fid]))[0][0];
function fixBody(req, res) {
  const name = String(req.body.name || '').trim().slice(0, 40), items = cleanItems(req.body.items);
  if (!name) { res.status(400).json({ error: 'Dê um nome para a roleta' }); return null; }
  if (items.length < 2) { res.status(400).json({ error: 'Coloque pelo menos 2 itens' }); return null; }
  return { name, items, kind: req.body.kind === 'free' ? 'free' : 'fix' };
}
router.get('/fix', wrap(async (req, res) => {
  const [wheels] = await pool.query('SELECT id,name,kind FROM fix_wheels WHERE family_id=? ORDER BY sort,id', [req.fid]);
  const { fixItems } = require('./kid');
  for (const w of wheels) w.items = await fixItems(w.id);
  const [spins] = await pool.query(
    `SELECT s.id,s.kind,s.wheel_name,s.label,s.emoji,s.coins,s.created_at,s.spun_at,k.name kid FROM fix_spins s JOIN kids k ON k.id=s.kid_id
     WHERE s.family_id=? ORDER BY s.id DESC LIMIT 10`, [req.fid]);
  res.json({ wheels, spins });
}));
router.post('/fix/samples', wrap(async (req, res) => {
  const [[n]] = await pool.query("SELECT COUNT(*) n FROM fix_wheels WHERE family_id=? AND kind='fix'", [req.fid]);
  if (n.n) return res.status(400).json({ error: 'Você já tem roletas de correção' });
  for (const [i, [name, items]] of FIX_SAMPLES.entries()) {
    const [r] = await pool.query('INSERT INTO fix_wheels (family_id,name,sort) VALUES (?,?,?)', [req.fid, name, i]);
    await saveFixItems(req.fid, r.insertId, items.map(([emoji, label, coins = 0]) => ({ emoji, label, coins })));
  }
  res.json({ ok: true });
}));
router.post('/fix', wrap(async (req, res) => {
  const b = fixBody(req, res); if (!b) return;
  const [[n]] = await pool.query('SELECT COUNT(*) n FROM fix_wheels WHERE family_id=?', [req.fid]);
  if (n.n >= 12) return res.status(400).json({ error: 'No máximo 12 roletas' });
  const [r] = await pool.query('INSERT INTO fix_wheels (family_id,name,sort,kind) VALUES (?,?,?,?)', [req.fid, b.name, n.n, b.kind]);
  await saveFixItems(req.fid, r.insertId, b.items);
  res.json({ id: r.insertId });
}));
router.put('/fix/:id', wrap(async (req, res) => {
  const w = await ownFix(req); if (!w) return res.status(404).json({ error: 'Roleta não encontrada' });
  const b = fixBody(req, res); if (!b) return;
  await pool.query('UPDATE fix_wheels SET name=? WHERE id=?', [b.name, w.id]);
  await saveFixItems(req.fid, w.id, b.items);
  res.json({ ok: true });
}));
router.delete('/fix/:id', wrap(async (req, res) => {
  const w = await ownFix(req); if (!w) return res.status(404).json({ error: 'Roleta não encontrada' });
  await pool.query('DELETE FROM fix_items WHERE wheel_id=?', [w.id]);
  await pool.query('DELETE FROM fix_spins WHERE wheel_id=? AND spun_at IS NULL', [w.id]); // quem estava esperando para girar não fica preso
  await pool.query('DELETE FROM fix_wheels WHERE id=?', [w.id]);
  res.json({ ok: true });
}));
// Usar a roleta com um jogador: cria o giro; os pais giram na hora (fix-spins/:id/spin) ou ele gira na tela dele
router.post('/fix/:id/apply', wrap(async (req, res) => {
  const w = await ownFix(req); if (!w) return res.status(404).json({ error: 'Roleta não encontrada' });
  const [[k]] = await pool.query('SELECT id FROM kids WHERE id=? AND family_id=? AND active=1', [req.body.kid_id, req.fid]);
  if (!k) return res.status(404).json({ error: 'Escolha quem vai girar' });
  const { fixItems } = require('./kid');
  const items = await fixItems(w.id);
  if (items.length < 2) return res.status(400).json({ error: 'Essa roleta precisa de pelo menos 2 itens' });
  const [r] = await pool.query('INSERT INTO fix_spins (family_id,kid_id,wheel_id,wheel_name,kind) VALUES (?,?,?,?,?)', [req.fid, k.id, w.id, w.name, w.kind]);
  res.json({ id: r.insertId, name: w.name, kind: w.kind, prizes: items });
}));
router.post('/fix-spins/:id/spin', wrap(async (req, res) => {
  try { res.json(await require('./kid').spinFix(req.fid, +req.params.id)); }
  catch (e) { if (!e.status) throw e; res.status(e.status).json({ error: e.message }); }
}));
// Roleta extra só por diversão: gira sem ninguém ganhar nem perder nada
router.post('/fix/:id/free-spin', wrap(async (req, res) => {
  const w = await ownFix(req); if (!w) return res.status(404).json({ error: 'Roleta não encontrada' });
  const prizes = await require('./kid').fixItems(w.id);
  if (prizes.length < 2) return res.status(400).json({ error: 'Essa roleta precisa de pelo menos 2 itens' });
  const index = require('crypto').randomInt(prizes.length);
  res.json({ index, prize: { ...prizes[index], coins: 0 }, prizes: prizes.map(p => ({ ...p, coins: 0 })) });
}));
// Sorteio entre os filhos escolhidos (o nome de cada um vira uma fatia)
router.post('/draw', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.kid_ids) ? req.body.kid_ids : []).map(Number).filter(Boolean);
  const [kids] = ids.length ? await pool.query('SELECT name FROM kids WHERE family_id=? AND active=1 AND id IN (?) ORDER BY id', [req.fid, ids]) : [[]];
  if (kids.length < 2) return res.status(400).json({ error: 'Escolha pelo menos 2 jogadores' });
  const prizes = kids.map(k => ({ label: k.name, emoji: null, coins: 0 }));
  res.json({ index: require('crypto').randomInt(prizes.length), prizes });
}));
// Desistir de uma correção que ainda não foi girada
router.delete('/fix-spins/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM fix_spins WHERE id=? AND family_id=? AND spun_at IS NULL', [req.params.id, req.fid]);
  res.json({ ok: true });
}));

// ---------- Recompensas ----------
router.get('/rewards', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, k.name kid_name, (SELECT COUNT(*) FROM task_rewards tr JOIN tasks t ON t.id=tr.task_id WHERE tr.reward_id=r.id AND t.active=1) task_count
     FROM rewards r LEFT JOIN kids k ON k.id=r.kid_id WHERE r.family_id=? ORDER BY r.active DESC,r.kind,r.id`, [req.fid]);
  res.json(rows);
}));
async function saveReward(req, id) {
  const b = req.body;
  const kind = b.kind === 'goal' ? 'goal' : 'time';
  const mode = kind === 'goal' ? (b.goal_mode === 'coins' ? 'coins' : 'tasks') : null;
  const v = [b.title.trim(), b.icon || 'game', kind, kind === 'time' ? (b.unit || 'min') : (mode === 'coins' ? 'moedas' : 'tarefas'),
    +b.total_value, mode, bool(b.active ?? 1)];
  const donate = kind === 'time' && bool(b.donate) ? 1 : 0;
  // só um filho (ou todos): o filho precisa ser desta família
  const [[k]] = b.kid_id ? await pool.query('SELECT id FROM kids WHERE id=? AND family_id=?', [b.kid_id, req.fid]) : [[]];
  v.push(k?.id || null);
  if (id) await pool.query('UPDATE rewards SET title=?,icon=?,kind=?,unit=?,total_value=?,goal_mode=?,active=?,kid_id=?,donate=? WHERE id=? AND family_id=?', [...v, donate, id, req.fid]);
  else {
    const [r] = await pool.query('INSERT INTO rewards (title,icon,kind,unit,total_value,goal_mode,active,kid_id,donate,family_id) VALUES (?,?,?,?,?,?,?,?,?,?)', [...v, donate, req.fid]);
    id = r.insertId;
  }
  // Missões que contam para esta recompensa (só as desta família). Meta de moedas não usa missões.
  if (Array.isArray(b.task_ids) && mode !== 'coins') {
    const ids = b.task_ids.map(Number).filter(Boolean);
    const [own] = ids.length ? await pool.query('SELECT id FROM tasks WHERE family_id=? AND id IN (?)', [req.fid, ids]) : [[]];
    await pool.query('DELETE FROM task_rewards WHERE reward_id=? AND task_id IN (SELECT id FROM tasks WHERE family_id=?)', [id, req.fid]);
    if (own.length) await pool.query('INSERT INTO task_rewards (task_id,reward_id) VALUES ?', [own.map(t => [t.id, id])]);
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
  const [[f]] = await pool.query('SELECT coin_value FROM families WHERE id=?', [req.fid]);
  const [kids] = await pool.query('SELECT id,name,avatar FROM kids WHERE family_id=? AND active=1 AND adult=0 ORDER BY sort,id', [req.fid]);
  const day = today();
  const [goals] = await pool.query("SELECT * FROM rewards WHERE family_id=? AND kind='goal' AND active=1", [req.fid]);
  const [timeRewards] = await pool.query("SELECT id,title,icon FROM rewards WHERE family_id=? AND kind='time' AND active=1", [req.fid]);
  for (const k of kids) {
    k.balance = await balance(req.fid, k.id);
    k.value = r2(k.balance * f.coin_value);
    const [[t]] = await pool.query("SELECT COALESCE(SUM(amount),0) a FROM ledger WHERE kid_id=? AND kind='time' AND day=?", [k.id, day]);
    k.time_today = r2(t.a);
    const [gp] = await pool.query("SELECT reward_id,SUM(amount) p FROM ledger WHERE kid_id=? AND kind='goal' GROUP BY reward_id", [k.id]);
    k.goals = goals.filter(g => !g.kid_id || g.kid_id === k.id).map(g => {
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
  if (!g || (g.kid_id && g.kid_id !== kid)) return res.status(404).json({ error: 'Meta não encontrada' });
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

// ---------- Extrato (dentro da Carteira): só moedas, como extrato de banco ----------
// Por dia e por filho: quanto entrou, quanto saiu e o saldo no fim do dia (últimos 90 dias).
router.get('/statement', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT day, kid_id,
       SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) cin, SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END) cout
     FROM ledger WHERE family_id=? AND kind='coin' AND day>=DATE_SUB(CURDATE(), INTERVAL 90 DAY)
     GROUP BY day, kid_id ORDER BY day DESC`, [req.fid]);
  const run = {}; // saldo de cada filho, voltando no tempo a partir do saldo de hoje
  const days = [];
  for (const r of rows) {
    if (!(r.kid_id in run)) run[r.kid_id] = await balance(req.fid, r.kid_id);
    let d = days[days.length - 1];
    if (d?.day !== r.day) days.push(d = { day: r.day, kids: {} });
    const cin = r2(r.cin), cout = r2(r.cout);
    d.kids[r.kid_id] = { in: cin, out: cout, net: r2(cin - cout), saldo: r2(run[r.kid_id]) };
    run[r.kid_id] -= cin - cout;
  }
  res.json(days);
}));
// Lançamentos de moedas de um dia (missões, bônus, roletas, pagamentos), por filho
router.get('/statement/:day', wrap(async (req, res) => {
  const day = String(req.params.day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Data inválida' });
  const [led] = await pool.query(
    `SELECT l.kid_id,l.amount,l.note,t.title,t.icon,p.amount brl FROM ledger l
       LEFT JOIN completions c ON c.id=l.completion_id LEFT JOIN tasks t ON t.id=c.task_id LEFT JOIN payouts p ON p.id=l.payout_id
     WHERE l.family_id=? AND l.day=? AND l.kind='coin' AND l.amount<>0 ORDER BY l.id`, [req.fid, day]);
  const out = {};
  for (const l of led) (out[l.kid_id] ||= []).push({ title: l.title || l.note || 'Ajuste', icon: l.icon || (l.brl != null ? 'moneybag' : null), amount: r2(l.amount), brl: l.brl != null ? r2(l.brl) : null, task: !!l.title });
  res.json(out);
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

// ---------- Avisos no celular/tablet (plano Plus) ----------
const push = require('../push');
const { access } = require('../billing');
const needPlus = (req, res, next) => access(req.family).plus ? next() : res.status(403).json({ error: 'Os avisos no celular e no tablet fazem parte do plano anual.', code: 'plus' });
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/push', wrap(async (req, res) => {
  const [subs] = await pool.query('SELECT id,label,reminders,approvals,created_at,endpoint FROM push_subs WHERE family_id=? ORDER BY id', [req.fid]);
  const [[f]] = await pool.query('SELECT remind_before FROM families WHERE id=?', [req.fid]);
  const [log] = await pool.query('SELECT title,ok,fail,err,created_at FROM push_sent WHERE family_id=? ORDER BY id DESC LIMIT 12', [req.fid]);
  res.json({ key: await push.publicKey(), plus: access(req.family).plus, remind_before: f.remind_before, devices: subs, log });
}));

// ---------- Recados para os jogadores ----------
// Aparece na tela do jogador na hora (e toca nos aparelhos com avisos ligados, no plano Plus).
router.get('/messages', wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT m.id,m.text,m.from_name,m.reply,m.created_at,m.read_at,COALESCE(k.name,m.to_label) kid,k.avatar FROM messages m LEFT JOIN kids k ON k.id=m.kid_id
    WHERE m.family_id=? ORDER BY m.id DESC LIMIT 15`, [req.fid]);
  res.json(rows);
}));
// Aparelhos onde o recado pode tocar: celulares com o app (f…) e aparelhos com avisos do navegador (p…)
router.get('/devices', wrap(async (req, res) => {
  const me = req.get('x-gt-dev') || '';
  const [f] = await pool.query('SELECT id,label,msgs,token FROM fcm_tokens WHERE family_id=? ORDER BY id', [req.fid]);
  const [p] = await pool.query('SELECT id,label,endpoint FROM push_subs WHERE family_id=? ORDER BY id', [req.fid]);
  res.json([...f.map(x => ({ id: 'f' + x.id, label: x.label || 'Aparelho com o app', on: !!x.msgs, me: !!me && x.token === me })),
    ...p.map(x => ({ id: 'p' + x.id, label: x.label || 'Navegador', on: true, me: !!me && x.endpoint === me }))]);
}));
router.post('/messages', wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Escreva o recado' });
  const [kids] = await pool.query('SELECT id,name,avatar FROM kids WHERE family_id=? AND active=1', [req.fid]);
  const want = new Set((req.body.kid_ids || []).map(Number));
  const to = kids.filter(k => want.has(k.id));
  if (!to.length) return res.status(400).json({ error: 'Escolha para quem vai o recado' });
  const from = String(req.actor?.name || 'Pais').slice(0, 60);
  // um recado só, mesmo para vários: aparece uma vez em qualquer tela aberta e some quando alguém responde
  const names = to.length === kids.length && kids.length > 1 ? 'Todos' : to.map(k => k.name).join(', ').slice(0, 120);
  const devs = Array.isArray(req.body.devices) ? req.body.devices.filter(d => /^[fp]\d+$/.test(d)).join(',').slice(0, 500) : null;
  await pool.query('INSERT INTO messages (family_id,kid_id,to_label,from_name,text,devices) VALUES (?,?,?,?,?,?)', [req.fid, to.length === 1 ? to[0].id : null, names, from, text, devs]);
  let sent = 0;
  if (access(req.family).plus) {
    // aparelhos escolhidos (se a lista veio); sem lista, vale o padrão de cada aparelho
    const only = Array.isArray(req.body.devices) ? { f: req.body.devices.filter(d => /^f\d+$/.test(d)).map(d => +d.slice(1)), p: req.body.devices.filter(d => /^p\d+$/.test(d)).map(d => +d.slice(1)) } : null;
    sent = await push.sendToFamily(req.fid, { only, title: `Recado de ${from} para ${names}`, body: text, tag: 'msg' + Date.now(), alarm: true, icon: to.length === 1 ? to[0].avatar || '' : '', url: to.length === 1 ? `/app#/kid/${to[0].id}` : '/app#/' }, 'all');
  }
  res.json({ ok: true, sent });
}));
router.post('/push', needPlus, wrap(async (req, res) => {
  const s = req.body.sub || {};
  if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return res.status(400).json({ error: 'Inscrição inválida' });
  await pool.query(`INSERT INTO push_subs (family_id,endpoint,p256dh,auth,label,reminders,approvals) VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE family_id=VALUES(family_id),p256dh=VALUES(p256dh),auth=VALUES(auth),label=VALUES(label),reminders=VALUES(reminders),approvals=VALUES(approvals)`,
    [req.fid, s.endpoint, s.keys.p256dh, s.keys.auth, String(req.body.label || 'Aparelho').slice(0, 60), bool(req.body.reminders ?? 1), bool(req.body.approvals)]);
  res.json({ ok: true });
}));
router.put('/push/:id', wrap(async (req, res) => {
  await pool.query('UPDATE push_subs SET label=?,reminders=?,approvals=? WHERE id=? AND family_id=?',
    [String(req.body.label || 'Aparelho').slice(0, 60), bool(req.body.reminders), bool(req.body.approvals), req.params.id, req.fid]);
  res.json({ ok: true });
}));
router.delete('/push/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM push_subs WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  res.json({ ok: true });
}));
router.post('/push/test', needPlus, wrap(async (req, res) => {
  const n = await push.sendToFamily(req.fid, { title: 'GameTask: aviso de teste', body: 'Os avisos estão funcionando neste aparelho!', tag: 'test', url: '/app#/' }, 'all');
  res.json({ sent: n });
}));
router.put('/push-settings', wrap(async (req, res) => {
  const m = Math.max(0, Math.min(120, Math.round(+req.body.remind_before || 0)));
  await pool.query('UPDATE families SET remind_before=? WHERE id=?', [m, req.fid]);
  res.json({ ok: true });
}));

router.get('/alarms', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM alarms WHERE family_id=? ORDER BY active DESC,time', [req.fid]);
  res.json(rows);
}));
async function saveAlarm(req, id) {
  const b = req.body;
  if (!b.title?.trim()) throw Object.assign(new Error('Escreva o aviso'), { code: 400 });
  if (!HM.test(b.time || '')) throw Object.assign(new Error('Informe o horário'), { code: 400 });
  let kid = b.kid_id ? +b.kid_id : null;
  if (kid) { const [[k]] = await pool.query('SELECT id FROM kids WHERE id=? AND family_id=?', [kid, req.fid]); kid = k?.id || null; }
  const v = [b.title.trim().slice(0, 120), kid, b.time, (b.weekdays || '0123456').replace(/[^0-6]/g, '') || '0123456', bool(b.active ?? 1)];
  if (id) await pool.query('UPDATE alarms SET title=?,kid_id=?,time=?,weekdays=?,active=? WHERE id=? AND family_id=?', [...v, id, req.fid]);
  else await pool.query('INSERT INTO alarms (title,kid_id,time,weekdays,active,family_id) VALUES (?,?,?,?,?,?)', [...v, req.fid]);
}
const alarmRoute = (fn) => wrap(async (req, res) => { try { await fn(req, res); } catch (e) { if (e.code === 400) return res.status(400).json({ error: e.message }); throw e; } });
router.post('/alarms', needPlus, alarmRoute(async (req, res) => { await saveAlarm(req, null); res.json({ ok: true }); }));
router.put('/alarms/:id', needPlus, alarmRoute(async (req, res) => { await saveAlarm(req, +req.params.id); res.json({ ok: true }); }));
router.delete('/alarms/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM alarms WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  res.json({ ok: true });
}));

// ---------- Configurações ----------
router.put('/settings', wrap(async (req, res) => {
  const { coin_value, new_pin } = req.body;
  if (new_pin && !/^\d{4,8}$/.test(String(new_pin))) return res.status(400).json({ error: 'PIN: 4 a 8 números' });
  await pool.query('UPDATE families SET coin_value=? WHERE id=?', [Math.max(0, +coin_value || 0), req.fid]);
  if (new_pin) await pool.query('UPDATE members SET pin_hash=? WHERE id=?', [bcrypt.hashSync(String(new_pin), 10), req.actor.id]); // PIN de quem abriu o painel
  res.json({ ok: true });
}));

module.exports = router;
