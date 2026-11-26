// Notificações no celular/tablet (Web Push, plano anual). Saem do servidor: chegam mesmo com o app fechado.
// Agendador: a cada 30 s confere avisos (alarmes) e tarefas com horário de hoje e avisa os aparelhos da família.
const webpush = require('web-push');
const { pool, getSetting } = require('./db');
const { today, dow, taskOnDay } = require('./util');
const { access } = require('./billing');

let ready = false;
async function init() {
  const pub = await getSetting('vapid_public'), priv = await getSetting('vapid_private');
  const contact = process.env.APP_URL || 'https://gametask.startingpro.com.br';
  webpush.setVapidDetails(contact.startsWith('http') ? contact : 'https://gametask.startingpro.com.br', pub, priv);
  ready = true;
}
const publicKey = () => getSetting('vapid_public');

// kind: 'reminders' (lembretes) | 'approvals' (pedido de aprovação para os pais) | 'all'
async function sendToFamily(fid, payload, kind = 'reminders') {
  const fcmOk = await sendFcm(fid, payload, kind);
  if (!ready) return fcmOk;
  const where = kind === 'all' ? '' : ` AND ${kind === 'approvals' ? 'approvals' : 'reminders'}=1`;
  let [subs] = await pool.query(`SELECT * FROM push_subs WHERE family_id=?${where}`, [fid]);
  if (payload.only) subs = subs.filter(s => payload.only.p.includes(s.id));
  const { only, ...visible } = payload;
  const body = JSON.stringify(visible);
  let ok = 0, fail = 0, err = null;
  await Promise.all(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 900, urgency: 'high' })
    .then(() => ok++)
    .catch(e => {
      fail++; err = e.statusCode === 404 || e.statusCode === 410 ? 'aparelho desinscrito (ligue os avisos de novo nele)' : `erro ${e.statusCode || e.message}`.slice(0, 80);
      if (e.statusCode === 404 || e.statusCode === 410) return pool.query('DELETE FROM push_subs WHERE id=?', [s.id]);
      console.error('push', e.statusCode || e.message);
    })));
  // registro para os pais conferirem em Ajustes → Avisos
  await pool.query('INSERT INTO push_sent (family_id,title,ok,fail,err) VALUES (?,?,?,?,?)',
    [fid, String(payload.title || '').slice(0, 120), ok + fcmOk, fail, subs.length || fcmOk ? err : 'nenhum aparelho com avisos ligados']).catch(() => {});
  return ok + fcmOk;
}

// App Android: avisos de horário (a…, t…) o próprio celular já marca como despertador, então não vão de novo.
// Recado e fim do tempo de tela tocam como alarme; o resto vira notificação comum.
const fcm = require('./fcm');
async function sendFcm(fid, payload, kind) {
  const tag = String(payload.tag || '');
  if (!fcm.on() || /^[at]\d/.test(tag)) return 0;
  let [rows] = await pool.query(`SELECT id,token,msgs FROM fcm_tokens WHERE family_id=?${kind === 'approvals' ? ' AND approvals=1' : ''}`, [fid]);
  if (payload.only) rows = rows.filter(r => payload.only.f.includes(r.id));       // recado: só os aparelhos marcados
  else if (tag.startsWith('msg')) rows = rows.filter(r => r.msgs);                 // sem escolha: quem aceita recados
  let ok = 0;
  await Promise.all(rows.map(async (r) => {
    const res = await fcm.send(r.token, { type: payload.alarm ? 'alarm' : 'note', title: payload.title, body: payload.body, tag, icon: payload.icon || '' });
    if (res === 'ok') ok++;
    else if (res === 'gone') await pool.query('DELETE FROM fcm_tokens WHERE id=?', [r.id]).catch(() => {});
  }));
  return ok;
}

// Um aparelho só (o teste do assistente de avisos)
async function sendToSub(s, payload) {
  if (!ready) return false;
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 900, urgency: 'high' });
    await pool.query('INSERT INTO push_sent (family_id,title,ok,fail) VALUES (?,?,1,0)', [s.family_id, String(payload.title).slice(0, 120)]).catch(() => {});
    return true;
  } catch (e) {
    const gone = e.statusCode === 404 || e.statusCode === 410;
    if (gone) await pool.query('DELETE FROM push_subs WHERE id=?', [s.id]).catch(() => {});
    await pool.query('INSERT INTO push_sent (family_id,title,ok,fail,err) VALUES (?,?,0,1,?)', [s.family_id, String(payload.title).slice(0, 120), gone ? 'aparelho desinscrito (ligue os avisos de novo nele)' : `erro ${e.statusCode || e.message}`.slice(0, 80)]).catch(() => {});
    return false;
  }
}

// Só a primeira chamada com a mesma chave envia (evita aviso repetido mesmo se o servidor reiniciar)
async function once(k) {
  const [r] = await pool.query('INSERT IGNORE INTO push_log (k) VALUES (?)', [k]);
  return r.affectedRows === 1;
}

const nowHM = () => new Intl.DateTimeFormat('en-GB', { timeZone: process.env.TZ || 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const toMin = (hm) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);

async function tick() {
  const day = today(), now = toMin(nowHM()), wd = String(dow(day));
  // famílias com aparelhos inscritos
  const [fams] = await pool.query('SELECT DISTINCT f.id,f.email,f.plan,f.paid_until,f.trial_ends,f.remind_before FROM families f JOIN push_subs s ON s.family_id=f.id');
  for (const f of fams) {
    if (!access(f).plus) continue;
    const [kids] = await pool.query('SELECT id,name FROM kids WHERE family_id=? AND active=1', [f.id]);
    const kidName = Object.fromEntries(kids.map(k => [k.id, k.name]));

    // 1) Avisos (alarmes) na hora exata, nos dias marcados. Janela de 3 min para não perder por atraso.
    const [alarms] = await pool.query('SELECT * FROM alarms WHERE family_id=? AND active=1', [f.id]);
    for (const a of alarms) {
      const d = now - toMin(a.time);
      if (!a.weekdays.includes(wd) || d < 0 || d > 3) continue;
      if (!await once(`a${a.id}:${day}`)) continue;
      const who = a.kid_id ? kidName[a.kid_id] : null;
      await sendToFamily(f.id, { title: who ? `${who}, ${a.title.charAt(0).toLowerCase()}${a.title.slice(1)}` : a.title, body: `Aviso das ${a.time}`, tag: `a${a.id}`, alarm: true, url: '/app#/' });
    }

    // 2) Cronômetro do tempo de tela que zerou sem ninguém com o app aberto: conferir encerra e avisa (ver timeUp)
    const [runs] = await pool.query('SELECT DISTINCT kid_id FROM time_runs WHERE family_id=?', [f.id]);
    if (runs.length) {
      const { kidTime } = require('./routes/kid'); // aqui dentro para não criar dependência circular
      for (const r of runs) { const [[k]] = await pool.query('SELECT id,name,avatar,color,adult FROM kids WHERE id=? AND family_id=? AND active=1', [r.kid_id, f.id]); if (k) await kidTime(f.id, k); }
    }

    // 3) Tarefas com horário: avisa `remind_before` minutos antes e de novo na hora, só para quem ainda não fez.
    //    (Tarefa criada em cima da hora perde o aviso antecipado, mas ainda recebe o da hora.)
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE family_id=? AND active=1 AND time IS NOT NULL', [f.id]);
    for (const t of tasks) {
      if (!taskOnDay(t, day)) continue;
      const pre = f.remind_before || 0, at = toMin(t.time);
      const slot = (m) => now - m >= 0 && now - m <= 3;
      const which = slot(at) ? 'now' : pre && slot(at - pre) ? 'pre' : null;
      if (!which || !await once(`t${t.id}:${day}:${which}`)) continue;
      let ids = kids.map(k => k.id);
      if (!t.all_kids) { const [tk] = await pool.query('SELECT kid_id FROM task_kids WHERE task_id=?', [t.id]); ids = tk.map(x => x.kid_id).filter(id => kidName[id]); }
      // tarefa que passa para o dia seguinte: quem já fez num dia anterior não é avisado de novo
      const [done] = await pool.query(`SELECT kid_id FROM completions WHERE task_id=? AND ${t.carry ? 'day<=?' : 'day=?'} AND status<>'rejected'`, [t.id, day]);
      const left = ids.filter(id => !done.some(x => x.kid_id === id)).map(id => kidName[id]);
      if (!left.length) continue;
      const names = left.length === 1 ? left[0] : left.slice(0, -1).join(', ') + ' e ' + left.at(-1);
      const body = which === 'pre' ? `Missão daqui a ${pre} min (${t.time}). Valendo moedas!` : `Hora da missão (${t.time})! Valendo moedas!`;
      await sendToFamily(f.id, { title: `${names}: ${t.title}`, body, tag: `t${t.id}`, alarm: true, url: '/app#/' });
    }
  }
  // limpeza do registro de envios antigos
  if (Math.random() < 0.01) {
    pool.query('DELETE FROM push_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)').catch(() => {});
    pool.query('DELETE FROM push_sent WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)').catch(() => {});
    pool.query('DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)').catch(() => {});
  }
}

// O tempo de tela de um filho acabou: avisa os aparelhos da família uma vez por rodada do cronômetro
async function timeUp(fid, kid, reward, ts) {
  if (!ready) return;
  const [[f]] = await pool.query('SELECT id,email,plan,paid_until,trial_ends FROM families WHERE id=?', [fid]);
  if (!f || !access(f).plus) return;
  if (!await once(`tu${kid.id}:${reward.id}:${ts}`)) return;
  await sendToFamily(fid, { icon: kid.avatar || '', title: `O tempo de ${reward.title} de ${kid.name} acabou`, body: 'Hora de desligar.', tag: `tu${kid.id}`, alarm: true, url: '/app#/' });
}

function start() {
  init().then(() => {
    const run = () => tick().catch(e => console.error('avisos', e.message));
    run(); setInterval(run, 30000);
  }).catch(e => console.error('push init', e.message));
}

// Agenda dos próximos dias para o app Android marcar como despertador no próprio celular
// (toca na hora mesmo sem internet e no silencioso). Mesmas regras dos avisos acima.
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const at = (ymd, hm, minus = 0) => new Date(`${ymd}T${hm.slice(0, 5)}:00-03:00`).getTime() - minus * 60000; // Brasília, sem horário de verão
async function plan(fid, days = 7) {
  const [[f]] = await pool.query('SELECT id,remind_before FROM families WHERE id=?', [fid]);
  const [kids] = await pool.query('SELECT id,name,avatar FROM kids WHERE family_id=? AND active=1', [fid]);
  const kidName = Object.fromEntries(kids.map(k => [k.id, k.name])), kidIcon = Object.fromEntries(kids.map(k => [k.id, k.avatar || '']));
  const [alarms] = await pool.query('SELECT * FROM alarms WHERE family_id=? AND active=1', [fid]);
  const [tasks] = await pool.query('SELECT * FROM tasks WHERE family_id=? AND active=1 AND time IS NOT NULL', [fid]);
  const [tk] = tasks.length ? await pool.query('SELECT task_id,kid_id FROM task_kids WHERE task_id IN (?)', [tasks.map(t => t.id)]) : [[]];
  const d0 = today(), [done] = await pool.query("SELECT task_id,kid_id FROM completions WHERE family_id=? AND day=? AND status<>'rejected'", [fid, d0]);
  const pre = f?.remind_before || 0, out = [], now = Date.now();
  for (let i = 0; i < days; i++) {
    const day = addDays(d0, i), wd = String(dow(day));
    for (const a of alarms) {
      if (!a.weekdays.includes(wd)) continue;
      const who = a.kid_id ? kidName[a.kid_id] : null;
      out.push({ id: `a${a.id}-${day}`, at: at(day, a.time), title: who ? `${who}, ${a.title.charAt(0).toLowerCase()}${a.title.slice(1)}` : a.title, body: `Aviso das ${a.time.slice(0, 5)}`, icon: a.kid_id ? kidIcon[a.kid_id] || '' : '' });
    }
    for (const t of tasks) {
      if (!taskOnDay(t, day)) continue;
      let ids = t.all_kids ? kids.map(k => k.id) : tk.filter(x => x.task_id === t.id).map(x => x.kid_id).filter(id => kidName[id]);
      if (i === 0) ids = ids.filter(id => !done.some(x => x.task_id === t.id && x.kid_id === id)); // hoje: só quem ainda não fez
      if (!ids.length) continue;
      const left = ids.map(id => kidName[id]), names = left.length === 1 ? left[0] : left.slice(0, -1).join(', ') + ' e ' + left.at(-1);
      const icon = ids.length === 1 ? kidIcon[ids[0]] || '' : '';
      out.push({ id: `t${t.id}-${day}`, at: at(day, t.time), title: `${names}: ${t.title}`, body: `Hora da missão (${t.time.slice(0, 5)})!`, icon });
      if (pre) out.push({ id: `t${t.id}-${day}-pre`, at: at(day, t.time, pre), title: `${names}: ${t.title}`, body: `Missão daqui a ${pre} min (${t.time.slice(0, 5)}).`, icon });
    }
  }
  return out.filter(x => x.at > now).sort((a, b) => a.at - b.at).slice(0, 200);
}

module.exports = { start, init, tick, sendToFamily, sendToSub, publicKey, timeUp, plan };
