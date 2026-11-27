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
    const [[m]] = await pool.query('SELECT COUNT(*) n FROM messages WHERE family_id=? AND (kid_id=? OR kid_id IS NULL) AND read_at IS NULL', [req.fid, k.id]);
    k.msgs = m.n;
  }
  const [runs] = await pool.query('SELECT DISTINCT kid_id FROM time_runs WHERE family_id=?', [req.fid]);
  for (const k of kids) k.timers = runs.some(r => r.kid_id === k.id) ? (await kidTime(req.fid, k)).filter(t => t.run !== null || t.ended) : [];
  const [truns] = await pool.query('SELECT DISTINCT kid_id FROM task_runs WHERE family_id=? AND day=? AND started_at IS NOT NULL', [req.fid, today()]);
  for (const k of kids) {
    k.taskTimers = [];
    if (!truns.some(r => r.kid_id === k.id)) continue;
    const tasks = await dayTasks(req.fid, k.id, today()), tm = await taskTimers(req, k, today(), tasks);
    k.taskTimers = tasks.filter(t => tm[t.id] && (tm[t.id].run !== null || tm[t.id].ended)).map(t => ({ id: t.id, title: t.title, ...tm[t.id] }));
  }
  res.json(kids);
});

async function ownKid(req, res) {
  const [[k]] = await pool.query('SELECT id,name,avatar,color,adult,locked,(pin_hash IS NOT NULL) has_pin FROM kids WHERE id=? AND family_id=? AND active=1', [req.params.id, req.fid]);
  if (k) { k.has_pin = !!k.has_pin; k.locked = !!k.locked; }
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
  const tmr = await taskTimers(req, kid, day, tasks);
  const [comps] = await pool.query('SELECT task_id,status FROM completions WHERE kid_id=? AND day=?', [kid.id, day]);
  const st = Object.fromEntries(comps.map(c => [c.task_id, c.status]));
  const list = tasks.map(t => ({
    id: t.id, title: t.title, icon: t.icon, description: t.description, type: t.type,
    time: t.time, until: t.until || null, late: t.type === 'one_off' && !t.repeat_weekly && t.date < day, coins: kid.adult ? 0 : t.coins, status: st[t.id] || 'todo', rewards: sh[t.id] || [], timer: tmr[t.id] || null,
  }));

  // Tempo de tela de hoje (não acumula)
  const [rewards] = await pool.query('SELECT * FROM rewards WHERE family_id=? AND active=1 AND (kid_id IS NULL OR kid_id=?)', [fid, kid.id]);
  const [gl] = await pool.query(`SELECT reward_id, SUM(amount) p FROM ledger WHERE kid_id=? AND kind='goal' GROUP BY reward_id`, [kid.id]);
  const gp = Object.fromEntries(gl.map(x => [x.reward_id, x.p]));
  const bal = await balance(fid, kid.id);

  // Ganhos ainda não aprovados: a criança já vê, o pai confirma depois
  const { pendingCoins, pTime, pGoal } = await pendingGains(kid.id, sh, day);

  const relevant = new Set(Object.values(sh).flat().map(s => s.reward_id));
  if (kid.adult) rewards.length = 0;
  const time = await timeState(fid, kid, day, rewards.filter(r => r.kind === 'time' && relevant.has(r.id)), pTime);
  const goals = rewards.filter(r => r.kind === 'goal' && (r.goal_mode === 'coins' || relevant.has(r.id))).map(r => ({
    id: r.id, title: r.title, icon: r.icon, mode: r.goal_mode, target: r.total_value,
    progress: r2(r.goal_mode === 'coins' ? bal : (gp[r.id] || 0)),
    pending: r2(r.goal_mode === 'coins' ? pendingCoins : (pGoal[r.id] || 0)),
  }));
  const wheel = await wheelState(req.fid, kid.id, day, list);
  const [messages] = await pool.query('SELECT id,from_name,text,created_at FROM messages WHERE family_id=? AND (kid_id=? OR kid_id IS NULL) AND read_at IS NULL ORDER BY id', [fid, kid.id]);
  const fix = await pendingFix(fid, kid.id);
  res.json({
    kid, day, balance: bal, pending_coins: pendingCoins, tasks: list, time, goals, wheel, messages, fix,
    done: list.filter(t => t.status === 'approved').length,
    pending: list.filter(t => t.status === 'pending').length, total: list.length,
  });
});

// ---------- Cronômetro do tempo de tela ----------
// Um cronômetro por recompensa de tempo. Ao pausar (ou acabar), o tempo corrido vira "Tempo usado" no extrato.
// left = minutos que ainda restam (sem contar o que está correndo); run = segundos corridos desde o play.
async function timeState(fid, kid, day, rewards, pTime) {
  if (kid.adult || !rewards.length) return [];
  await pool.query('DELETE FROM time_runs WHERE kid_id=? AND day<>?', [kid.id, day]); // tempo não passa para o dia seguinte
  const [tl] = await pool.query(
    `SELECT reward_id, SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) earned, -SUM(CASE WHEN amount<0 THEN amount ELSE 0 END) used
     FROM ledger WHERE kid_id=? AND kind='time' AND day=? GROUP BY reward_id`, [kid.id, day]);
  const tm = Object.fromEntries(tl.map(x => [x.reward_id, x]));
  const [runs] = await pool.query('SELECT reward_id, UNIX_TIMESTAMP(started_at) ts, TIMESTAMPDIFF(SECOND, started_at, NOW()) sec FROM time_runs WHERE kid_id=?', [kid.id]);
  const rn = Object.fromEntries(runs.map(x => [x.reward_id, x]));
  const out = [];
  for (const r of rewards) {
    const earned = r2(tm[r.id]?.earned || 0), pending = r2(pTime[r.id] || 0);
    let used = r2(tm[r.id]?.used || 0), run = rn[r.id] ? Math.max(0, +rn[r.id].sec) : null, ended = false;
    const left = Math.max(0, r2(earned + pending - used));
    if (run !== null && run >= left * 60) {
      const ts = rn[r.id].ts;
      used = r2(used + await stopRun(fid, kid.id, r.id, left)); run = null; ended = true;
      push.timeUp(fid, kid, r, ts).catch(e => console.error('aviso de tempo', e.message)); // chega mesmo com o app fechado
    }
    out.push({ id: r.id, title: r.title, icon: r.icon, unit: r.unit, cap: r.total_value, earned, used, pending, donate: !!r.donate && !r.kid_id,
      left: Math.max(0, r2(earned + pending - used)), run, ended });
  }
  return out;
}
// Para o cronômetro e lança o tempo corrido (no máximo o que restava). Devolve os minutos lançados.
async function stopRun(fid, kidId, rid, leftMin) {
  const [[x]] = await pool.query('SELECT UNIX_TIMESTAMP(started_at) ts, TIMESTAMPDIFF(SECOND, started_at, NOW()) sec FROM time_runs WHERE kid_id=? AND reward_id=?', [kidId, rid]);
  if (!x) return 0;
  const [d] = await pool.query('DELETE FROM time_runs WHERE kid_id=? AND reward_id=? AND UNIX_TIMESTAMP(started_at)=?', [kidId, rid, x.ts]);
  if (!d.affectedRows) return 0; // outro aparelho já parou
  const m = r2(Math.min(leftMin, Math.max(0, +x.sec) / 60));
  if (m > 0) await pool.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) VALUES (?,?,'time',?,?,?,'Tempo usado (cronômetro)')", [fid, kidId, rid, -m, today()]);
  return m;
}
async function kidTime(fid, kid) {
  const day = today(), sh = await shares(fid, kid.id);
  const relevant = new Set(Object.values(sh).flat().map(s => s.reward_id));
  const [rewards] = await pool.query("SELECT * FROM rewards WHERE family_id=? AND active=1 AND kind='time' AND (kid_id IS NULL OR kid_id=?)", [fid, kid.id]);
  const { pTime } = await pendingGains(kid.id, sh, day);
  return timeState(fid, kid, day, rewards.filter(r => relevant.has(r.id)), pTime);
}
// PIN da criança (se os pais definiram): 5 erros por minuto e a criança espera
const pinFails = new Map();
async function kidPinOk(req, res, kid) {
  if (!kid.has_pin) return true;
  const now = Date.now(), tries = (pinFails.get(kid.id) || []).filter(t => now - t < 60000);
  if (tries.length >= 5) { res.status(429).json({ error: 'Muitas tentativas. Espere 1 minuto.', code: 'pin' }); return false; }
  const [[row]] = await pool.query('SELECT pin_hash FROM kids WHERE id=?', [kid.id]);
  if (row?.pin_hash && require('bcryptjs').compareSync(String(req.body.pin || ''), row.pin_hash)) { pinFails.delete(kid.id); return true; }
  tries.push(now); pinFails.set(kid.id, tries);
  res.status(403).json({ error: req.body.pin ? 'PIN incorreto' : 'Digite o seu PIN', code: 'pin' });
  return false;
}
router.post('/kids/:id/timer/:rid', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const rid = +req.params.rid, day = today();
  const t = (await kidTime(req.fid, kid)).find(x => x.id === rid);
  if (!t) return res.status(404).json({ error: 'Recompensa não encontrada' });
  if (req.body.action === 'start') {
    if (t.run === null) {
      if (kid.locked) return res.status(403).json({ error: 'Os pais bloquearam o tempo de tela. Peça para eles liberarem.', code: 'locked' });
      if (!(await kidPinOk(req, res, kid))) return;
      if (!(t.left > 0)) return res.status(400).json({ error: 'Acabou o tempo de hoje. Faça mais missões para ganhar mais!' });
      await pool.query('INSERT IGNORE INTO time_runs (family_id,kid_id,reward_id,day) VALUES (?,?,?,?)', [req.fid, kid.id, rid, day]);
    }
  } else if (t.run !== null) {
    await stopRun(req.fid, kid.id, rid, t.left);
  }
  push.nudge(req.fid).catch(() => {}); // os outros aparelhos conferem na hora (bloqueiam ou liberam sem esperar)
  res.json({ time: await kidTime(req.fid, kid) });
});
// Som do fim do tempo escolhido pela família: o app baixa e guarda no aparelho (v muda quando troca)
router.get('/sound/info', async (req, res) => {
  const [[f]] = await pool.query('SELECT end_sound_name name, end_sound_type type, LENGTH(end_sound) size, MD5(end_sound) v FROM families WHERE id=?', [req.fid]);
  res.json({ has: !!f?.size, name: f?.name || null, type: f?.type || null, size: +f?.size || 0, v: f?.v || '' });
});
router.get('/sound/end', async (req, res) => {
  const [[f]] = await pool.query('SELECT end_sound, end_sound_type FROM families WHERE id=?', [req.fid]);
  if (!f?.end_sound) return res.status(404).json({ error: 'Sem som escolhido' });
  res.set({ 'content-type': f.end_sound_type || 'audio/mpeg', 'cache-control': 'private, max-age=0' }).send(f.end_sound);
});
// Situação do tempo de tela desta criança, leve: o app Android confere sozinho, mesmo com o GameTask em segundo plano
router.get('/kids/:id/screen', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const running = kid.locked ? [] : (await kidTime(req.fid, kid)).filter(t => t.run !== null)
    .map(t => ({ reward_id: t.id, secs: Math.max(0, Math.floor(t.left * 60 - t.run)) }));
  res.json({ locked: kid.locked, running });
});

// Doação de minutos entre irmãos (só nos prêmios em que os pais liberaram): quem doa perde, quem recebe ganha.
// Só dá para doar tempo já aprovado e com o cronômetro parado.
router.get('/kids/:id/donate-targets', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const rid = +req.query.reward_id;
  const [sib] = await pool.query('SELECT id,name,avatar,color FROM kids WHERE family_id=? AND active=1 AND adult=0 AND id<>? ORDER BY sort,id', [req.fid, kid.id]);
  const out = [];
  for (const s of sib) { if ((await kidTime(req.fid, { ...s, adult: 0 })).some(x => x.id === rid)) out.push(s); }
  res.json(out);
});
router.post('/kids/:id/donate', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  if (kid.adult) return res.status(400).json({ error: 'Só as crianças doam tempo' });
  const rid = +req.body.reward_id, to = +req.body.to_kid_id, m = Math.floor(+req.body.minutes);
  if (!(m >= 1)) return res.status(400).json({ error: 'Escolha quantos minutos doar' });
  const [[rw]] = await pool.query("SELECT * FROM rewards WHERE id=? AND family_id=? AND kind='time' AND active=1", [rid, req.fid]);
  if (!rw || !rw.donate || rw.kid_id) return res.status(403).json({ error: 'Os pais ainda não liberaram doar este tempo' });
  const [[rk]] = await pool.query('SELECT id,name,avatar FROM kids WHERE id=? AND family_id=? AND active=1 AND adult=0 AND id<>?', [to, req.fid, kid.id]);
  if (!rk) return res.status(404).json({ error: 'Escolha um irmão para receber' });
  if (!(await kidPinOk(req, res, kid))) return;
  const mine = (await kidTime(req.fid, kid)).find(x => x.id === rid);
  if (!mine) return res.status(404).json({ error: 'Recompensa não encontrada' });
  if (mine.run !== null) return res.status(400).json({ error: 'Pause o cronômetro antes de doar' });
  const can = Math.floor(Math.max(0, mine.earned - mine.used));
  if (m > can) return res.status(400).json({ error: can ? `Você pode doar até ${can} min (o tempo que os pais já aprovaram)` : 'Você não tem tempo aprovado para doar' });
  if (!(await kidTime(req.fid, { ...rk, adult: 0 })).some(x => x.id === rid)) return res.status(400).json({ error: `${rk.name} não tem esse tempo` });
  const day = today();
  await pool.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) VALUES (?,?,'time',?,?,?,?),(?,?,'time',?,?,?,?)",
    [req.fid, kid.id, rid, -m, day, `Doou ${m} min para ${rk.name}`, req.fid, rk.id, rid, m, day, `Ganhou ${m} min de ${kid.name}`]);
  if (access(req.family).plus) push.sendToFamily(req.fid, { skip: req.get('x-gt-dev') || '', title: `${kid.name} doou ${m} min para ${rk.name}`, body: rw.title, tag: 'donate' + Date.now() }, 'approvals').catch(() => {});
  res.json({ ok: true, to: rk.name, minutes: m, time: await kidTime(req.fid, kid) });
});

// Marca a missão como feita. Devolve true se acabou de ser marcada.
async function completeTask(req, kid, task, day) {
  // adulto: fica feito na hora, sem ganhos e sem pedir aprovação
  if (kid.adult) {
    const [r] = await pool.query("INSERT IGNORE INTO completions (family_id,task_id,kid_id,day,status,decided_at) VALUES (?,?,?,?,'approved',NOW())", [req.fid, task.id, kid.id, day]);
    return !!r.affectedRows;
  }
  const [r] = await pool.query('INSERT IGNORE INTO completions (family_id,task_id,kid_id,day) VALUES (?,?,?,?)', [req.fid, task.id, kid.id, day]);
  if (r.affectedRows) {
    const [[k]] = await pool.query('SELECT auto_approve FROM kids WHERE id=?', [kid.id]);
    if (k.auto_approve) await approve(req.fid, r.insertId);
    // não avisa o aparelho onde a missão acabou de ser marcada
    else if (access(req.family).plus) push.sendToFamily(req.fid, { skip: req.get('x-gt-dev') || '', title: `${kid.name} concluiu: ${task.title}`, body: 'Toque para conferir e aprovar.', tag: 'approve', url: '/app#/admin' }, 'approvals').catch(() => {});
  }
  return !!r.affectedRows;
}
router.post('/kids/:id/complete', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today();
  const task = (await dayTasks(req.fid, kid.id, day)).find(t => t.id === +req.body.task_id);
  if (!task) return res.status(400).json({ error: 'Tarefa não disponível hoje' });
  await completeTask(req, kid, task, day);
  res.json({ ok: true });
});

// ---------- Missão com cronômetro (ex.: ler 45 min) ----------
// spent = segundos já feitos (sem o trecho correndo). Ao completar o tempo, a missão é marcada como feita.
// Devolve { [taskId]: { minutes, left (min, sem o trecho correndo), run (s correndo ou null), ended } }
async function taskTimers(req, kid, day, tasks) {
  const timed = tasks.filter(t => +t.minutes > 0); if (!timed.length) return {};
  await pool.query('DELETE FROM task_runs WHERE kid_id=? AND day<>?', [kid.id, day]);
  const [rows] = await pool.query('SELECT task_id, spent, started_at IS NOT NULL running, TIMESTAMPDIFF(SECOND, started_at, NOW()) sec FROM task_runs WHERE kid_id=? AND day=?', [kid.id, day]);
  const [cs] = await pool.query('SELECT task_id FROM completions WHERE kid_id=? AND day=?', [kid.id, day]);
  const rn = Object.fromEntries(rows.map(r => [r.task_id, r])), done = new Set(cs.map(c => c.task_id));
  const out = {};
  for (const t of timed) {
    const total = t.minutes * 60, r = rn[t.id];
    let spent = r ? +r.spent : 0, run = r?.running ? Math.max(0, +r.sec) : null, ended = false;
    if (!done.has(t.id) && r && spent + (run || 0) >= total - 3) { // tolerância de 3s entre o relógio do aparelho e o do servidor
      await pool.query('UPDATE task_runs SET spent=?, started_at=NULL WHERE kid_id=? AND task_id=? AND day=?', [total, kid.id, t.id, day]);
      ended = await completeTask(req, kid, t, day); spent = total; run = null;
    }
    if (done.has(t.id)) run = null;
    out[t.id] = { minutes: +t.minutes, left: Math.max(0, total - spent) / 60, run, ended };
  }
  return out;
}
router.post('/kids/:id/task-timer/:tid', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  const day = today(), task = (await dayTasks(req.fid, kid.id, day)).find(t => t.id === +req.params.tid);
  if (!task || !(+task.minutes > 0)) return res.status(404).json({ error: 'Missão não encontrada' });
  const [[c]] = await pool.query('SELECT id FROM completions WHERE kid_id=? AND task_id=? AND day=?', [kid.id, task.id, day]);
  if (c) return res.status(400).json({ error: 'Essa missão já foi feita' });
  if (req.body.action === 'start') {
    await pool.query('INSERT INTO task_runs (family_id,kid_id,task_id,day,spent,started_at) VALUES (?,?,?,?,0,NOW()) ON DUPLICATE KEY UPDATE started_at=COALESCE(started_at,NOW())', [req.fid, kid.id, task.id, day]);
  } else {
    await pool.query('UPDATE task_runs SET spent=LEAST(?, spent+GREATEST(0,TIMESTAMPDIFF(SECOND,started_at,NOW()))), started_at=NULL WHERE kid_id=? AND task_id=? AND day=? AND started_at IS NOT NULL', [task.minutes * 60, kid.id, task.id, day]);
  }
  const timer = (await taskTimers(req, kid, day, [task]))[task.id];
  res.json({ timer });
});



// Recado lido (com resposta rápida opcional, que avisa os pais)
const REPLIES = ['Ok!', 'Já vou!', 'Preciso de ajuda'];
router.post('/kids/:id/messages/:mid', async (req, res) => {
  const kid = await ownKid(req, res); if (!kid) return;
  await answer(req, res, kid.name, kid.id);
});
// App Android: guarda o endereço do celular no Firebase (para recados com o app fechado)
router.post('/fcm', async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!/^[\w:.\-]{20,255}$/.test(token)) return res.status(400).json({ error: 'Token inválido' });
  const label = String(req.body.label || '').trim().slice(0, 60) || null;
  // aparelho novo: tablet começa sem o aviso de missão concluída (é o das crianças); depois os pais ajustam em Ajustes > Sons e alarmes
  await pool.query(`INSERT INTO fcm_tokens (family_id,token,approvals,label) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE family_id=VALUES(family_id), label=COALESCE(NULLIF(label,''), VALUES(label))`,
    [req.fid, token, /tablet/i.test(label || '') ? 0 : 1, label]);
  res.json({ ok: true, server: require('../fcm').on() });
});
// O próprio aparelho muda o nome dele (assistente de primeira vez)
router.put('/device/label', async (req, res) => {
  const label = String(req.body.label || '').trim().slice(0, 60);
  if (!label) return res.status(400).json({ error: 'Escreva um nome' });
  const [r] = await pool.query('UPDATE fcm_tokens SET label=? WHERE token=? AND family_id=?', [label, req.get('x-gt-dev') || '', req.fid]);
  res.json({ ok: !!r.affectedRows });
});
// As escolhas deste aparelho (feitas pelos pais): o app aplica ao abrir
router.get('/device/settings', async (req, res) => {
  const [[d]] = await pool.query('SELECT id,label,mode,alarms,msgs,calls,approvals,t_end,m_end,warn FROM fcm_tokens WHERE token=? AND family_id=?', [req.get('x-gt-dev') || '', req.fid]);
  if (!d) return res.status(404).json({ error: 'Aparelho não registrado' });
  res.json({ ...d, alarms: !!d.alarms, msgs: !!d.msgs, calls: !!d.calls, approvals: !!d.approvals, warn: !!d.warn });
});
// Alarmes dos próximos 7 dias para o app Android (plano anual, como os avisos no celular)
router.get('/alarm-plan', async (req, res) => {
  if (!access(req.family).plus) return res.json({ plus: false, items: [] });
  res.json({ plus: true, items: await push.plan(req.fid) });
});
// Recados não lidos da família inteira: qualquer tela aberta (seleção de jogador ou tela de um filho) mostra e toca
router.get('/messages', async (req, res) => {
  const [rows] = await pool.query(`SELECT m.id,m.from_name,m.text,m.kid_id,m.devices,COALESCE(k.name,m.to_label,'Todos') to_name FROM messages m LEFT JOIN kids k ON k.id=m.kid_id
    WHERE m.family_id=? AND m.read_at IS NULL ORDER BY m.id LIMIT 5`, [req.fid]);
  // quem é este aparelho: o app (token do Firebase) ou o navegador com avisos (endereço da inscrição)
  const [[f]] = req.query.t ? await pool.query('SELECT id,msgs FROM fcm_tokens WHERE token=? AND family_id=?', [String(req.query.t), req.fid]) : [[]];
  const [[p]] = req.query.e ? await pool.query('SELECT id FROM push_subs WHERE endpoint=? AND family_id=?', [String(req.query.e), req.fid]) : [[]];
  const mine = [f && 'f' + f.id, p && 'p' + p.id].filter(Boolean);
  res.json(rows.filter(m => m.devices == null ? !(f && !f.msgs) : m.devices.split(',').some(d => mine.includes(d))).map(({ devices, ...m }) => m));
});
router.post('/messages/:mid', async (req, res) => {
  const [[k]] = req.body.kid_id ? await pool.query('SELECT id,name FROM kids WHERE id=? AND family_id=?', [req.body.kid_id, req.fid]) : [[]];
  await answer(req, res, k?.name || null, null);
});
// Marca como lido (resposta rápida opcional) e avisa os pais de quem respondeu
async function answer(req, res, who, kidId) {
  const reply = REPLIES.includes(req.body.reply) ? req.body.reply : null;
  const [r] = await pool.query(`UPDATE messages SET read_at=NOW(),reply=? WHERE id=? AND family_id=? AND read_at IS NULL${kidId ? ' AND (kid_id=? OR kid_id IS NULL)' : ''}`,
    kidId ? [reply, req.params.mid, req.fid, kidId] : [reply, req.params.mid, req.fid]);
  if (r.affectedRows && reply && access(req.family).plus) {
    const [[m]] = await pool.query('SELECT text,to_label FROM messages WHERE id=?', [req.params.mid]);
    const name = who || (m.to_label && m.to_label !== 'Todos' ? m.to_label : 'Alguém em casa');
    push.sendToFamily(req.fid, { title: `${name}: ${reply}`, body: `Resposta ao recado "${m.text.slice(0, 80)}"`, tag: 'reply' + req.params.mid, url: '/app#/admin' }, 'approvals').catch(() => {});
  }
  res.json({ ok: true });
}

// ---------- Roletas de correção ----------
// Os pais escolhem quem e qual roleta; ela gira no aparelho dos pais ou fica esperando na tela do jogador.
async function fixItems(wheelId) {
  const [items] = await pool.query('SELECT label,emoji,coins FROM fix_items WHERE wheel_id=? ORDER BY sort,id', [wheelId]);
  return items;
}
async function pendingFix(fid, kidId) {
  const [rows] = await pool.query('SELECT id,wheel_id,wheel_name,kind FROM fix_spins WHERE family_id=? AND kid_id=? AND spun_at IS NULL ORDER BY id', [fid, kidId]);
  const out = [];
  for (const r of rows) { const prizes = await fixItems(r.wheel_id); if (prizes.length >= 2) out.push({ id: r.id, name: r.wheel_name, kind: r.kind, prizes }); }
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
  const free = s.kind === 'free'; // roleta extra: as moedas entram na conta; correção: saem (sem deixar negativo)
  if (coins > 0 && !free) coins = Math.min(coins, Math.max(0, Math.floor(await balance(fid, s.kid_id))));
  const [r] = await pool.query('UPDATE fix_spins SET label=?,emoji=?,coins=?,spun_at=NOW() WHERE id=? AND spun_at IS NULL', [p.label, p.emoji, coins, s.id]);
  if (!r.affectedRows) throw fail(400, 'Essa roleta já foi girada');
  if (coins > 0) await pool.query("INSERT INTO ledger (family_id,kid_id,kind,amount,day,note) VALUES (?,?,'coin',?,?,?)", [fid, s.kid_id, free ? coins : -coins, today(), `${free ? 'Roleta extra' : 'Correção'} (${s.wheel_name}): ${p.label}`.slice(0, 160)]);
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
  const [[left]] = await pool.query('SELECT COUNT(*) n FROM completions WHERE kid_id=? AND task_id=? AND day=?', [kid.id, req.params.taskId, today()]);
  if (!left.n) await pool.query('DELETE FROM task_runs WHERE kid_id=? AND task_id=? AND day=?', [kid.id, req.params.taskId, today()]);
  res.json({ ok: true });
});

// ---------- Avisos neste aparelho (assistente que abre sozinho no app instalado) ----------
// O tablet das crianças liga os lembretes sem o PIN dos pais; pedidos de aprovação só pelo painel dos pais.
const kwrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno' }); });
router.get('/push/key', kwrap(async (req, res) => res.json({ key: await push.publicKey(), plus: access(req.family).plus })));
router.post('/push/device', kwrap(async (req, res) => {
  if (!access(req.family).plus) return res.status(403).json({ error: 'Os avisos no celular e no tablet fazem parte do plano anual.', code: 'plus' });
  const s = req.body.sub || {};
  if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return res.status(400).json({ error: 'Inscrição inválida' });
  await pool.query(`INSERT INTO push_subs (family_id,endpoint,p256dh,auth,label,reminders,approvals) VALUES (?,?,?,?,?,1,0)
    ON DUPLICATE KEY UPDATE family_id=VALUES(family_id),p256dh=VALUES(p256dh),auth=VALUES(auth)`,
    [req.fid, s.endpoint, s.keys.p256dh, s.keys.auth, String(req.body.label || 'Aparelho').slice(0, 60)]);
  res.json({ ok: true });
}));
// Teste só para este aparelho, com uma espera para dar tempo de fechar o app
router.post('/push/test', kwrap(async (req, res) => {
  const [[s]] = await pool.query('SELECT * FROM push_subs WHERE family_id=? AND endpoint=?', [req.fid, String(req.body.endpoint || '')]);
  if (!s) return res.status(404).json({ error: 'Os avisos ainda não estão ligados neste aparelho' });
  const wait = Math.max(0, Math.min(20, +req.body.delay || 0)) * 1000;
  setTimeout(() => push.sendToSub(s, { title: 'Teste do GameTask', body: 'Chegou! Os avisos estão funcionando neste aparelho.', tag: 'teste', url: '/app#/' }), wait);
  res.json({ ok: true });
}));

module.exports = router;
module.exports.wheelPrizes = wheelPrizes;
module.exports.kidTime = kidTime;
module.exports.spinFix = spinFix;
module.exports.stopRun = stopRun;
module.exports.fixItems = fixItems;
