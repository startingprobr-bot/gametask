// Teste de ponta a ponta contra um banco descartável (gametask_test). Uso: npm test
require('dotenv').config();
const assert = require('assert');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const http = require('http');

const PORT = 3199, BASE = `http://127.0.0.1:${PORT}`;
let cookie = '';
async function api(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() || [];
  if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function ok(method, url, body) {
  const r = await api(method, url, body);
  assert.ok(r.status < 300, `${method} ${url} -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}
const step = (m) => console.log('✔', m);

(async () => {
  const c = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '' });
  await c.query('DROP DATABASE IF EXISTS gametask_test'); await c.end();

  // Mercado Pago de mentira: cria a preferência e devolve o pagamento 777 como aprovado
  let lastPref = null;
  const cards = {};
  const mpFake = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/checkout/preferences') {
        const j = JSON.parse(b); lastPref = { ref: j.external_reference, amount: j.items[0].unit_price };
        return res.end(JSON.stringify({ init_point: 'https://mp.test/pay/' + j.external_reference }));
      }
      if (req.method === 'POST' && /^\/v1\/payments\/\w+\/refunds$/.test(req.url)) return res.end(JSON.stringify({ id: 1, status: 'approved' }));
      if (req.method === 'POST' && req.url === '/v1/payments') {
        const j = JSON.parse(b);
        if (j.token) { // cartão: 'bad' é recusado
          const id = 900 + Object.keys(cards).length, ok = j.token !== 'bad';
          cards[id] = { id, status: ok ? 'approved' : 'rejected', status_detail: ok ? 'accredited' : 'cc_rejected_insufficient_amount', transaction_amount: j.transaction_amount, currency_id: 'BRL', external_reference: j.external_reference, payment_method_id: j.payment_method_id };
          return res.end(JSON.stringify(cards[id]));
        }
        if (j.payer.email === 'semapi@x.co') { res.statusCode = 401; return res.end(JSON.stringify({ message: 'Unauthorized use of live credentials' })); }
        lastPref = { ref: j.external_reference, amount: j.transaction_amount };
        return res.end(JSON.stringify({ id: 777, status: 'pending', point_of_interaction: { transaction_data: { qr_code: '00020126PIXTESTE', qr_code_base64: 'iVBORw0KGgo=' } } }));
      }
      if (req.url.startsWith('/v1/payments/') && cards[req.url.split('/').pop()]) return res.end(JSON.stringify(cards[req.url.split('/').pop()]));
      if (req.url.startsWith('/v1/payments/') && lastPref)
        return res.end(JSON.stringify({ id: 777, status: 'approved', transaction_amount: lastPref.amount, currency_id: 'BRL', external_reference: lastPref.ref, payment_method_id: 'pix' }));
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => mpFake.listen(3198, '127.0.0.1', r));
  // Evolution API (WhatsApp) de mentira: guarda o que o servidor mandou
  const evoSent = [], n8nGot = []; let evoHook = null;
  const evoFake = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url.startsWith('/n8n')) { n8nGot.push({ url: req.url, body: JSON.parse(b) }); return res.end('{}'); } // o "n8n" que recebe o repasse
      if (req.headers.apikey !== 'evo-key') { res.statusCode = 401; return res.end('{"message":"Unauthorized"}'); }
      const j = b ? JSON.parse(b) : null;
      if (req.url.startsWith('/message/')) { evoSent.push({ kind: req.url.split('/')[2], ...j }); return res.end('{"key":{"id":"x"}}'); }
      if (req.url === '/instance/connectionState/gt') return res.end('{"instance":{"instanceName":"gt","state":"open"}}');
      if (req.url === '/webhook/find/gt') return res.end(JSON.stringify(evoHook));
      if (req.url === '/webhook/set/gt') { evoHook = { url: j.webhook.url, enabled: j.webhook.enabled, events: j.webhook.events }; return res.end(JSON.stringify(evoHook)); }
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => evoFake.listen(3197, '127.0.0.1', r));
  const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_NAME: 'gametask_test', PORT, DATABASE_URL: '', OWNER_EMAILS: 'a@b.co', MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'APP_USR-pub', MP_API: 'http://127.0.0.1:3198', EVOLUTION_URL: 'http://127.0.0.1:3197', EVOLUTION_KEY: 'evo-key', EVOLUTION_INSTANCE: 'gt', WHATSAPP_NUMBER: '5511999990000', WA_REPASSAR_URL: 'http://127.0.0.1:3197/n8n/', WA_FLOW_ANYTIME: '1', WA_FLOW_GAP_MS: '0', WA_FLOW_EVERY_MS: '300', APP_URL: '' }, stdio: 'inherit' });
  try {
    for (let i = 0; i < 360; i++) { try { await fetch(BASE + '/api/auth/me'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
    { // os cenários de teste grátis abaixo precisam do teste ligado (o padrão agora é 0, com garantia)
      const sdb = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
      const [[g]] = await sdb.query("SELECT v FROM app_settings WHERE k='trial_days'"); assert.equal(g.v, '0');
      await sdb.query("UPDATE app_settings SET v='90' WHERE k='trial_days'"); await sdb.end();
    }

    // sem login não acessa nada
    assert.equal((await api('GET', '/api/kids')).status, 401); step('API exige login da família');

    await ok('POST', '/api/auth/register', { name: 'Família Teste', email: 'a@b.co', password: 'secret1', pin: '1234' });
    step('cadastro da família');
    await ok('POST', '/api/auth/parent/exit');
    assert.equal((await api('GET', '/api/admin/tasks')).status, 403); step('admin bloqueado sem PIN');
    assert.equal((await api('POST', '/api/auth/parent', { pin: '0000' })).status, 401);
    await ok('POST', '/api/auth/parent', { pin: '1234' }); step('PIN do responsável libera admin');

    const eva = (await ok('POST', '/api/admin/kids', { name: 'Eva', avatar: '🦄' })).id;
    const ber = (await ok('POST', '/api/admin/kids', { name: 'Bernardo', avatar: '🤖' })).id;
    const game = (await ok('POST', '/api/admin/rewards', { title: 'Videogame', kind: 'time', total_value: 20 })).id;
    const park = (await ok('POST', '/api/admin/rewards', { title: 'Parque', kind: 'goal', goal_mode: 'tasks', total_value: 2 })).id;

    // 10 tarefas vinculadas a 20 min => 2 min cada
    const ids = [];
    for (let i = 0; i < 10; i++)
      ids.push((await ok('POST', '/api/admin/tasks', { title: 'Tarefa ' + i, type: 'daily', coins: i === 0 ? 5 : 0, all_kids: true, reward_ids: i < 2 ? [game, park] : [game] })).id);
    let home = await ok('GET', `/api/kids/${eva}/home`);
    assert.equal(home.tasks.length, 10);
    assert.equal(home.tasks[0].rewards.find(r => r.reward_id === game).value, 2); step('20 min ÷ 10 tarefas = 2 min cada');

    // 20 tarefas => 1 min cada
    for (let i = 10; i < 20; i++) ids.push((await ok('POST', '/api/admin/tasks', { title: 'Tarefa ' + i, type: 'daily', all_kids: true, reward_ids: [game] })).id);
    home = await ok('GET', `/api/kids/${eva}/home`);
    assert.equal(home.tasks[0].rewards.find(r => r.reward_id === game).value, 1); step('20 min ÷ 20 tarefas = 1 min cada');

    // esporádica de outro dia não aparece; com all_kids=false só vai para quem foi escolhido
    await ok('POST', '/api/admin/tasks', { title: 'Jiu-jitsu', type: 'one_off', date: '2000-01-01', time: '18:00', coins: 3, all_kids: true });
    const onlyBer = (await ok('POST', '/api/admin/tasks', { title: 'Só Bernardo', type: 'daily', all_kids: false, kid_ids: [ber] })).id;
    home = await ok('GET', `/api/kids/${eva}/home`);
    assert.equal(home.tasks.length, 20); step('esporádica de outro dia e tarefa de outro filho não aparecem');

    // criança marca -> pendente, sem ganho; pai aprova -> ganho
    await ok('POST', `/api/kids/${eva}/complete`, { task_id: ids[0] });
    await ok('POST', `/api/kids/${eva}/complete`, { task_id: ids[0] }); // duplicado ignorado
    home = await ok('GET', `/api/kids/${eva}/home`);
    assert.equal(home.balance, 0); assert.equal(home.pending, 1); step('conclusão fica pendente (sem ganho)');
    const pend = await ok('GET', '/api/admin/pending');
    assert.equal(pend.length, 1);
    await ok('POST', '/api/admin/approve', { ids: pend.map(p => p.id) });
    home = await ok('GET', `/api/kids/${eva}/home`);
    assert.equal(home.balance, 5);
    assert.equal(home.time[0].earned, 1);
    assert.equal(home.goals.find(g => g.id === park).progress, 1); step('aprovação credita moedas, tempo e meta');

    // Bernardo não enxerga/ganha da tarefa de Eva e vice-versa
    assert.equal((await api('POST', `/api/kids/${eva}/complete`, { task_id: onlyBer })).status, 400); step('tarefa de outro filho é recusada');

    // pagamento
    const w = await ok('GET', '/api/admin/wallet');
    assert.equal(w.kids.find(k => k.id === eva).value, 2.5);
    await ok('POST', '/api/admin/payout', { kid_id: eva, coins: 2 });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).balance, 3);
    assert.equal((await api('POST', '/api/admin/payout', { kid_id: eva, coins: 99 })).status, 400);
    await ok('POST', '/api/admin/payout', { kid_id: eva });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).balance, 0); step('pagamento abate saldo e valida limite');

    // entrega de meta (2 tarefas)
    await ok('POST', `/api/kids/${eva}/complete`, { task_id: ids[1] });
    await ok('POST', '/api/admin/approve', { ids: (await ok('GET', '/api/admin/pending')).map(p => p.id) });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).goals.find(g => g.id === park).progress, 2);
    await ok('POST', '/api/admin/redeem', { kid_id: eva, reward_id: park });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).goals.find(g => g.id === park).progress, 0);
    assert.equal((await api('POST', '/api/admin/redeem', { kid_id: eva, reward_id: park })).status, 400);
    step('meta alcançada é entregue e zera; sem progresso é recusada');

    // uso de tempo
    await ok('POST', '/api/admin/use-time', { kid_id: eva, reward_id: game, minutes: 1 });
    const t = (await ok('GET', `/api/kids/${eva}/home`)).time[0];
    assert.equal(t.used, 1); step('tempo usado descontado');

    // cronômetro: começar, pausar (vira tempo usado), acabar sozinho
    const tdb = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
    const tUrl = `/api/kids/${eva}/timer/${game}`;
    let tt = (await ok('POST', tUrl, { action: 'start' })).time.find(x => x.id === game);
    assert.ok(tt.run >= 0 && tt.run <= 2); assert.ok(tt.left > 0);
    await ok('POST', tUrl, { action: 'start' }); // repetir não duplica
    assert.equal((await ok('GET', '/api/kids')).find(k => k.id === eva).timers.length, 1);
    await tdb.query('UPDATE time_runs SET started_at=DATE_SUB(started_at, INTERVAL 30 SECOND) WHERE kid_id=?', [eva]);
    tt = (await ok('POST', tUrl, { action: 'pause' })).time.find(x => x.id === game);
    assert.equal(tt.run, null); assert.ok(Math.abs(tt.used - 1.5) < 0.05, 'usou ~30s: ' + tt.used);
    await ok('POST', tUrl, { action: 'start' });
    // aparelho com avisos ligados (endereço que não existe: o envio falha, mas fica registrado com o título)
    const ec = require('crypto').createECDH('prime256v1'); ec.generateKeys();
    const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await tdb.query("INSERT INTO push_subs (family_id,endpoint,p256dh,auth) SELECT family_id,'https://127.0.0.1:1/push/teste',?,? FROM kids WHERE id=?", [b64u(ec.getPublicKey()), b64u(require('crypto').randomBytes(16)), eva]);
    await tdb.query('UPDATE time_runs SET started_at=DATE_SUB(started_at, INTERVAL 5 HOUR) WHERE kid_id=?', [eva]);
    tt = (await ok('GET', `/api/kids/${eva}/home`)).time.find(x => x.id === game);
    assert.equal(tt.ended, true); assert.equal(tt.left, 0); assert.equal(tt.run, null);
    // o tempo acabou: o servidor dispara o aviso para os aparelhos (chega mesmo com o app fechado), uma vez só
    let sent = [];
    for (let i = 0; i < 40 && !sent.length; i++) { [sent] = await tdb.query("SELECT title FROM push_sent WHERE title LIKE 'O tempo de % acabou'"); if (!sent.length) await new Promise(r => setTimeout(r, 100)); }
    assert.equal(sent.length, 1, 'aviso de tempo esgotado'); assert.ok(sent[0].title.includes('Eva'));
    await tdb.query("DELETE FROM push_subs WHERE endpoint='https://127.0.0.1:1/push/teste'");
    // assistente de avisos: o tablet liga sem PIN (só lembretes) e pede um teste só para ele
    assert.ok((await ok('GET', '/api/push/key')).key.length > 40);
    const ec2 = require('crypto').createECDH('prime256v1'); ec2.generateKeys();
    const dsub = { endpoint: 'https://127.0.0.1:1/push/tablet', keys: { p256dh: b64u(ec2.getPublicKey()), auth: b64u(require('crypto').randomBytes(16)) } };
    assert.equal((await api('POST', '/api/push/device', { sub: { endpoint: 'http://x' } })).status, 400);
    await ok('POST', '/api/push/device', { sub: dsub, label: 'Tablet' });
    const [[dv]] = await tdb.query("SELECT reminders,approvals,label FROM push_subs WHERE endpoint=?", [dsub.endpoint]);
    assert.deepEqual([dv.reminders, dv.approvals, dv.label], [1, 0, 'Tablet']);
    assert.equal((await api('POST', '/api/push/test', { endpoint: 'https://nao-existe' })).status, 404);
    await ok('POST', '/api/push/test', { endpoint: dsub.endpoint, delay: 0 });
    let tst = [];
    for (let i = 0; i < 40 && !tst.length; i++) { [tst] = await tdb.query("SELECT fail FROM push_sent WHERE title='Teste do GameTask'"); if (!tst.length) await new Promise(r => setTimeout(r, 100)); }
    assert.equal(tst.length, 1);
    await tdb.query("DELETE FROM push_subs WHERE endpoint=?", [dsub.endpoint]);
    assert.equal((await api('POST', tUrl, { action: 'start' })).status, 400);
    assert.equal((await ok('GET', '/api/kids')).find(k => k.id === eva).timers.length, 0);
    await tdb.end();
    step('cronômetro: começa, pausa vira tempo usado, acaba sozinho e não passa do ganho');

    // missão com cronômetro (ex.: ler 45 min): play, pausa, continua; ao completar o tempo, fica feita
    const ler = (await ok('POST', '/api/admin/tasks', { title: 'Ler um livro', type: 'daily', minutes: 45, all_kids: 0, kid_ids: [eva] })).id;
    assert.equal((await ok('GET', '/api/admin/tasks')).find(x => x.id === ler).minutes, 45);
    const lerT = async () => (await ok('GET', `/api/kids/${eva}/home`)).tasks.find(x => x.id === ler);
    let lt = await lerT(); assert.deepEqual([lt.timer.minutes, lt.timer.left, lt.timer.run, lt.status], [45, 45, null, 'todo']);
    const ttUrl = `/api/kids/${eva}/task-timer/${ler}`;
    await ok('POST', ttUrl, { action: 'start' });
    const tdb2 = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
    await tdb2.query('UPDATE task_runs SET started_at=DATE_SUB(started_at, INTERVAL 600 SECOND) WHERE task_id=?', [ler]);
    const paused = (await ok('POST', ttUrl, { action: 'pause' })).timer;
    assert.equal(paused.run, null); assert.ok(Math.abs(paused.left - 35) < 0.1, 'pausou com ~35 min: ' + paused.left);
    await ok('POST', ttUrl, { action: 'start' }); // continua de onde parou
    await tdb2.query('UPDATE task_runs SET started_at=DATE_SUB(started_at, INTERVAL 2100 SECOND) WHERE task_id=?', [ler]);
    lt = await lerT(); assert.equal(lt.timer.ended, true); assert.equal(lt.status, 'pending'); assert.equal(lt.timer.left, 0);
    assert.equal((await api('POST', ttUrl, { action: 'start' })).status, 400); // já feita
    await ok('DELETE', `/api/kids/${eva}/complete/${ler}`); // desfazer: cronômetro volta do zero
    lt = await lerT(); assert.equal(lt.status, 'todo'); assert.equal(lt.timer.left, 45);
    await tdb2.end();
    await ok('DELETE', `/api/admin/tasks/${ler}`);
    step('missão com cronômetro: play, pausa, continua e conclui sozinha ao acabar o tempo');

    // aprovação automática por filho: Bernardo ligado, Eva continua pendente
    await ok('PUT', `/api/admin/kids/${ber}`, { name: 'Bernardo', avatar: 'robot', color: '#4aa8ff', active: true, auto_approve: true });
    await ok('POST', `/api/kids/${ber}/complete`, { task_id: ids[0] });
    await ok('POST', `/api/kids/${eva}/complete`, { task_id: ids[2] });
    assert.equal((await ok('GET', `/api/kids/${ber}/home`)).balance, 5);
    assert.equal((await ok('GET', '/api/admin/pending')).length, 1); step('aprovação automática vale só para o filho marcado');

    // ordem por filho: tarefa sem horário acima de uma de 09:00 ganha "até 09:00"
    const nine = (await ok('POST', '/api/admin/tasks', { title: 'Escola', type: 'daily', time: '09:00', all_kids: true })).id;
    let o = await ok('GET', `/api/admin/kids/${eva}/order`), order = o.ids;
    assert.equal(order.length, 22); assert.equal(o.custom, false); // inclui a de dia marcado (Jiu-jitsu), que só aparece no dia
    order = [ids[5], nine, ...order.filter(x => x !== ids[5] && x !== nine)];
    await ok('PUT', `/api/admin/kids/${eva}/order`, { ids: [...order, onlyBer] }); // tarefa de outro filho é ignorada
    home = await ok('GET', `/api/kids/${eva}/home`);
    assert.deepEqual(home.tasks.slice(0, 2).map(x => x.id), [ids[5], nine]);
    assert.equal(home.tasks[0].until, '09:00'); assert.equal(home.tasks[2].until, null);
    assert.equal((await ok('GET', `/api/kids/${ber}/home`)).tasks[0].id, nine); step('ordem arrastada por filho e prazo "até 9:00"');

    // ordem da família (Todas): vale para todos e desfaz a ordem própria
    const all = (await ok('GET', '/api/admin/tasks')).filter(x => x.active).map(x => x.id);
    await ok('PUT', '/api/admin/tasks/order', { ids: [ids[7], ...all.filter(x => x !== ids[7])] });
    assert.equal((await ok('GET', '/api/admin/tasks'))[0].id, ids[7]);
    assert.equal((await ok('GET', `/api/kids/${ber}/home`)).tasks[0].id, ids[7]);
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).tasks[0].id, ids[7]);
    assert.equal((await ok('GET', `/api/admin/kids/${eva}/order`)).custom, false); step('ordem da família vale para todos os filhos');

    // extrato diário: resumo por dia e por filho, detalhe ao abrir o dia
    const st = await ok('GET', '/api/admin/statement');
    assert.equal(st[0].kids[ber].in, 5);
    const wNow = await ok('GET', '/api/admin/wallet');
    for (const k of wNow.kids) if (st[0].kids[k.id]) assert.equal(st[0].kids[k.id].saldo, k.balance); // saldo do dia de hoje = saldo atual
    const det = await ok('GET', '/api/admin/statement/' + st[0].day);
    assert.ok(det[eva].filter(x => x.task).length >= 1); const pg = det[eva].find(o => o.title === 'Pagamento'); assert.ok(pg && pg.amount < 0 && pg.brl > 0);
    step('extrato diário só de moedas, com saldo do dia e detalhe');

    // responsáveis: convite da mãe (acesso completo) e da babá (só o dia a dia)
    const main = cookie;
    const mae = (await ok('POST', '/api/admin/members/invite', { name: 'Ana', role: 'Mãe', full_access: true })).link.split('/convite/')[1];
    const baba = (await ok('POST', '/api/admin/members/invite', { name: 'Rosa', role: 'Babá', full_access: false })).link.split('/convite/')[1];
    cookie = '';
    assert.equal((await ok('GET', '/api/auth/invite/' + mae)).role, 'Mãe');
    assert.equal((await api('POST', '/api/auth/invite', { token: mae, email: 'a@b.co', password: 'secret1', pin: '5555' })).status, 409); // e-mail da família
    await ok('POST', '/api/auth/invite', { token: mae, email: 'ana@x.co', password: 'secret1', pin: '5555' });
    assert.equal((await api('POST', '/api/auth/invite', { token: mae, email: 'ana2@x.co', password: 'secret1', pin: '5555' })).status, 400); // uso único
    let me2 = await ok('GET', '/api/auth/me');
    assert.equal(me2.actor.name, 'Ana'); assert.equal(me2.actor.full, true); assert.equal(me2.family, 'Família Teste');
    await ok('POST', '/api/auth/parent/exit');
    assert.equal((await api('POST', '/api/auth/parent', { pin: '1234' })).status, 200); // o PIN do pai também abre aqui
    assert.equal((await ok('GET', '/api/auth/me')).actor.principal, true);
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'ana@x.co', password: 'secret1' });
    await ok('POST', '/api/auth/parent', { pin: '5555' });
    assert.equal((await ok('GET', '/api/auth/me')).actor.name, 'Ana'); step('convite: mãe entra com e-mail, senha e PIN próprios');

    cookie = '';
    await ok('POST', '/api/auth/invite', { token: baba, email: 'rosa@x.co', password: 'secret1', pin: '7777' });
    assert.equal((await ok('GET', '/api/auth/me')).actor.full, false);
    await ok('GET', '/api/admin/pending'); await ok('GET', '/api/admin/wallet');
    await ok('POST', '/api/admin/approve', { ids: (await ok('GET', '/api/admin/pending')).map(p => p.id) });
    assert.equal((await api('POST', '/api/admin/payout', { kid_id: eva, coins: 1 })).status, 403);
    assert.equal((await api('POST', '/api/admin/tasks', { title: 'X', type: 'daily', all_kids: true })).status, 403);
    assert.equal((await api('POST', '/api/admin/members/invite', { name: 'Y' })).status, 403);
    assert.equal((await api('POST', '/api/billing/checkout', { plan: 'annual' })).status, 403);
    await ok('PUT', '/api/admin/me/pin', { pin: '7788' }); step('babá: aprova, mas não paga, não mexe em tarefas nem convida');

    // o pai vê os responsáveis e coloca a mãe na rotina (jogador sem moedas)
    cookie = main;
    const ms = (await ok('GET', '/api/admin/members')).members;
    assert.equal(ms.length, 3); assert.ok(ms[0].principal && ms[0].me);
    const anaM = ms.find(m => m.name === 'Ana');
    await ok('PUT', '/api/admin/members/' + anaM.id, { name: 'Ana', role: 'Mãe', full_access: true, plays: true, avatar: 'cat', color: '#ff8a1f' });
    const players = await ok('GET', '/api/kids'), anaKid = players.find(k => k.adult);
    assert.equal(anaKid.name, 'Ana'); assert.equal(anaKid.coins, null);
    const gym = (await ok('POST', '/api/admin/tasks', { title: 'Academia', type: 'daily', all_kids: 0, kid_ids: [anaKid.id] })).id;
    const famT = (await ok('POST', '/api/admin/tasks', { title: 'Oração em família', type: 'daily', all_kids: 2 })).id;
    let adh = await ok('GET', `/api/kids/${anaKid.id}/home`);
    assert.deepEqual(adh.tasks.map(t => t.id).sort(), [gym, famT].sort()); // não recebe as tarefas só das crianças
    assert.ok((await ok('GET', `/api/kids/${eva}/home`)).tasks.some(t => t.id === famT));
    assert.ok(!(await ok('GET', `/api/kids/${eva}/home`)).tasks.some(t => t.id === gym));
    await ok('POST', `/api/kids/${anaKid.id}/complete`, { task_id: gym });
    adh = await ok('GET', `/api/kids/${anaKid.id}/home`);
    assert.equal(adh.tasks.find(t => t.id === gym).status, 'approved'); assert.equal(adh.balance, 0);
    assert.ok(!(await ok('GET', '/api/admin/wallet')).kids.some(k => k.id === anaKid.id)); step('adulto na rotina: missões próprias e da família, sem moedas');

    // roleta do dia: só com 2+ prêmios, só depois de todas as missões, um giro por dia
    assert.equal((await ok('GET', `/api/kids/${anaKid.id}/home`)).wheel.prizes.length, 6); // prêmios de exemplo até os pais montarem
    assert.equal((await ok('GET', '/api/admin/wheel')).sample, true);
    await ok('PUT', '/api/admin/wheel', { prizes: [{ emoji: '🤗', label: 'Abraço do pai' }, { label: 'Abraço da mãe' }, { label: '' }] });
    assert.equal((await ok('GET', '/api/admin/wheel')).prizes.length, 2);
    let wh = (await ok('GET', `/api/kids/${anaKid.id}/home`)).wheel;
    assert.equal(wh.prizes.length, 2); assert.equal(wh.ready, false);
    assert.equal((await api('POST', `/api/kids/${anaKid.id}/spin`, {})).status, 400); // ainda falta uma missão
    await ok('POST', `/api/kids/${anaKid.id}/complete`, { task_id: famT });
    assert.equal((await ok('GET', `/api/kids/${anaKid.id}/home`)).wheel.ready, true);
    const sp = await ok('POST', `/api/kids/${anaKid.id}/spin`, {});
    assert.ok(sp.index >= 0 && sp.index < 2 && sp.prize.label.startsWith('Abraço'));
    wh = (await ok('GET', `/api/kids/${anaKid.id}/home`)).wheel;
    assert.equal(wh.ready, false); assert.equal(wh.spun.label, sp.prize.label);
    assert.equal((await api('POST', `/api/kids/${anaKid.id}/spin`, {})).status, 400);
    assert.equal((await ok('GET', '/api/admin/wheel')).spins[0].kid, 'Ana'); step('roleta: prêmios, libera ao terminar o dia, um giro por dia');

    // prêmio em moedas: cai direto na conta, sem tarefa
    const zeId = (await ok('POST', '/api/admin/kids', { name: 'Zé', auto_approve: 1 })).id;
    await ok('PUT', '/api/admin/wheel', { prizes: [{ emoji: '🪙', label: '', coins: 50 }, { label: 'Moedão', coins: '50' }] });
    assert.deepEqual((await ok('GET', '/api/admin/wheel')).prizes.map(p => p.coins), [50, 50]);
    for (const tk of (await ok('GET', `/api/kids/${zeId}/home`)).tasks) if (tk.status === 'todo') await ok('POST', `/api/kids/${zeId}/complete`, { task_id: tk.id });
    const zh0 = await ok('GET', `/api/kids/${zeId}/home`); assert.equal(zh0.wheel.ready, true);
    const zsp = await ok('POST', `/api/kids/${zeId}/spin`, {});
    assert.equal(zsp.prize.coins, 50);
    const zh = await ok('GET', `/api/kids/${zeId}/home`); assert.equal(zh.balance, zh0.balance + 50); assert.equal(zh.wheel.spun.coins, 50);
    step('roleta: prêmio em moedas cai direto na conta');

    // recompensa só para um filho: os outros não veem nem ganham
    const solo = (await ok('POST', '/api/admin/rewards', { title: 'Meta do Zé', kind: 'goal', goal_mode: 'coins', total_value: 100, kid_id: zeId })).id;
    assert.equal((await ok('GET', '/api/admin/rewards')).find(r => r.id === solo).kid_name, 'Zé');
    assert.ok((await ok('GET', `/api/kids/${zeId}/home`)).goals.some(g => g.id === solo));
    const others = (await ok('GET', '/api/kids')).filter(k => !k.adult && k.id !== zeId);
    for (const o of others) assert.ok(!(await ok('GET', `/api/kids/${o.id}/home`)).goals.some(g => g.id === solo));
    const wl = await ok('GET', '/api/admin/wallet');
    assert.ok(wl.kids.find(k => k.id === zeId).goals.some(g => g.id === solo));
    for (const o of wl.kids.filter(k => k.id !== zeId)) assert.ok(!o.goals.some(g => g.id === solo));
    if (others[0]) assert.equal((await api('POST', '/api/admin/redeem', { kid_id: others[0].id, reward_id: solo })).status, 404);
    await ok('PUT', `/api/admin/rewards/${solo}`, { title: 'Meta do Zé', kind: 'goal', goal_mode: 'coins', total_value: 100, active: 0, kid_id: zeId });
    step('recompensa só para um filho');

    // roletas de correção
    assert.equal((await ok('GET', '/api/admin/fix')).wheels.length, 0);
    await ok('POST', '/api/admin/fix/samples');
    assert.equal((await api('POST', '/api/admin/fix/samples')).status, 400);
    let fx = await ok('GET', '/api/admin/fix'); assert.equal(fx.wheels.length, 3);
    assert.equal((await api('POST', '/api/admin/fix', { name: 'Só um', items: [{ label: 'A' }] })).status, 400);
    const fid1 = (await ok('POST', '/api/admin/fix', { name: 'Teste', items: [{ label: 'Perde tudo', coins: 999 }, { label: '', coins: 999 }] })).id;
    // girar aqui: desconta, mas nunca deixa o saldo negativo
    const ap = await ok('POST', `/api/admin/fix/${fid1}/apply`, { kid_id: zeId });
    assert.equal(ap.prizes.length, 2);
    const fsp = await ok('POST', `/api/admin/fix-spins/${ap.id}/spin`, {});
    assert.equal(fsp.prize.coins, zh.balance);
    assert.equal((await ok('GET', `/api/kids/${zeId}/home`)).balance, 0);
    assert.equal((await api('POST', `/api/admin/fix-spins/${ap.id}/spin`, {})).status, 400); // um giro só
    // na tela dele: fica esperando até ele girar
    const ap2 = await ok('POST', `/api/admin/fix/${fx.wheels[1].id}/apply`, { kid_id: zeId });
    let zf = (await ok('GET', `/api/kids/${zeId}/home`)).fix; assert.equal(zf.length, 1); assert.equal(zf[0].name, 'Implicância');
    const ksp = await ok('POST', `/api/kids/${zeId}/fix/${ap2.id}/spin`, {}); assert.ok(ksp.prize.label);
    assert.equal((await ok('GET', `/api/kids/${zeId}/home`)).fix.length, 0);
    // cancelar uma que ainda não girou; apagar a roleta libera quem estava esperando
    const ap3 = await ok('POST', `/api/admin/fix/${fid1}/apply`, { kid_id: zeId });
    await ok('DELETE', `/api/admin/fix-spins/${ap3.id}`);
    await ok('POST', `/api/admin/fix/${fid1}/apply`, { kid_id: zeId });
    await ok('DELETE', `/api/admin/fix/${fid1}`);
    assert.equal((await ok('GET', `/api/kids/${zeId}/home`)).fix.length, 0);
    fx = await ok('GET', '/api/admin/fix'); assert.equal(fx.wheels.length, 3); assert.ok(fx.spins.some(s => s.spun_at && s.kid === 'Zé'));
    await ok('PUT', `/api/admin/fix/${fx.wheels[2].id}`, { name: 'Gritos', items: [{ label: 'X' }, { label: 'Y', coins: 3 }] });
    assert.equal((await ok('GET', '/api/admin/fix')).wheels[2].name, 'Gritos');
    // roleta extra (livre): moedas entram na conta, não conta como correção
    const frId = (await ok('POST', '/api/admin/fix', { name: 'Bônus', kind: 'free', items: [{ label: 'Ganha 7', coins: 7 }, { label: 'Ganha 7 também', coins: 7 }] })).id;
    fx = await ok('GET', '/api/admin/fix'); assert.equal(fx.wheels.find(w => w.id === frId).kind, 'free'); assert.equal(fx.wheels.filter(w => w.kind === 'fix').length, 3);
    const bal0 = (await ok('GET', `/api/kids/${zeId}/home`)).balance;
    const apF = await ok('POST', `/api/admin/fix/${frId}/apply`, { kid_id: zeId }); assert.equal(apF.kind, 'free');
    assert.equal((await ok('GET', `/api/kids/${zeId}/home`)).fix[0].kind, 'free');
    await ok('POST', `/api/kids/${zeId}/fix/${apF.id}/spin`, {});
    assert.equal((await ok('GET', `/api/kids/${zeId}/home`)).balance, bal0 + 7);
    assert.ok((await ok('POST', `/api/admin/fix/${frId}/free-spin`, {})).prizes.length === 2);
    assert.equal((await api('POST', '/api/admin/draw', { kid_ids: [zeId] })).status, 400);
    await ok('DELETE', `/api/admin/fix/${frId}`);
    await ok('DELETE', `/api/admin/kids/${zeId}`);
    step('roletas de correção: sugestões, girar aqui ou na tela dele, desconta moedas sem negativar');

    // tarefa que passa para o dia seguinte: aparece desde a data até ser feita; quem fez num dia anterior não vê mais
    const ago = (n) => { const d = new Date(Date.now() - n * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d); };
    const fan = (await ok('POST', '/api/admin/tasks', { title: 'Limpar o ventilador', type: 'one_off', date: ago(2), carry: true, all_kids: 1 })).id;
    const fanE = (await ok('GET', `/api/kids/${eva}/home`)).tasks.find(t => t.id === fan);
    assert.ok(fanE && fanE.late);
    const dbc = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
    await dbc.query("INSERT INTO completions (family_id,task_id,kid_id,day,status) SELECT family_id,id,?,?,'approved' FROM tasks WHERE id=?", [ber, ago(1), fan]);
    assert.ok(!(await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === fan));
    await dbc.query("UPDATE completions SET status='rejected' WHERE task_id=? AND kid_id=?", [fan, ber]);
    assert.ok((await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === fan)); // rejeitada volta
    await dbc.end();
    await ok('PUT', '/api/admin/tasks/' + fan, { title: 'Limpar o ventilador', type: 'one_off', date: ago(2), carry: false, all_kids: 1 });
    assert.ok(!(await ok('GET', `/api/kids/${eva}/home`)).tasks.some(t => t.id === fan)); // sem a opção, fica só no dia
    await ok('DELETE', '/api/admin/tasks/' + fan); step('dia marcado que passa para o dia seguinte até ser feito');

    // apagar por arrastar: num filho tira só dele; em "Todas" apaga para todos
    const sw = (await ok('POST', '/api/admin/tasks', { title: 'Arrastar', type: 'daily', all_kids: 1 })).id;
    await ok('DELETE', `/api/admin/kids/${eva}/tasks/${sw}`);
    assert.ok(!(await ok('GET', `/api/kids/${eva}/home`)).tasks.some(t => t.id === sw));
    assert.ok((await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === sw));
    assert.ok(!(await ok('GET', `/api/kids/${anaKid.id}/home`)).tasks.some(t => t.id === sw));
    await ok('DELETE', '/api/admin/tasks/' + sw);
    assert.ok(!(await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === sw));
    assert.ok(!(await ok('GET', '/api/admin/tasks')).some(t => t.id === sw)); step('apagar tarefa: só de um filho ou de todos');

    // recado: aparece para quem foi escolhido, some quando lido, e a resposta fica para os pais
    assert.equal((await api('POST', '/api/admin/messages', { text: 'Venha jantar!', kid_ids: [] })).status, 400);
    await ok('POST', '/api/admin/messages', { text: 'Venha jantar!', kid_ids: [eva] });
    const em = (await ok('GET', `/api/kids/${eva}/home`)).messages;
    assert.equal(em.length, 1); assert.equal(em[0].text, 'Venha jantar!');
    assert.equal((await ok('GET', `/api/kids/${ber}/home`)).messages.length, 0);
    assert.equal((await ok('GET', '/api/kids')).find(k => k.id === eva).msgs, 1);
    await ok('POST', `/api/kids/${eva}/messages/${em[0].id}`, { reply: 'Já vou!' });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).messages.length, 0);
    assert.equal((await ok('GET', '/api/admin/messages'))[0].reply, 'Já vou!');
    assert.ok(Array.isArray((await ok('GET', '/api/admin/push')).log)); step('recado para o filho com resposta rápida');
    // recado para todos: um registro só, aparece em qualquer tela e some de todas quando alguém responde
    const msgN = (await ok('GET', '/api/admin/messages')).length;
    const allIds = (await ok('GET', '/api/kids')).map(k => k.id);
    await ok('POST', '/api/admin/messages', { text: 'Fecha a janela', kid_ids: allIds });
    assert.equal((await ok('GET', '/api/admin/messages')).length, msgN + 1);
    const live = await ok('GET', '/api/messages'); assert.equal(live.length, 1); assert.equal(live[0].to_name, 'Todos');
    assert.equal((await ok('GET', `/api/kids/${ber}/home`)).messages.length, 1);
    await ok('POST', `/api/messages/${live[0].id}`, { reply: 'Ok!', kid_id: ber });
    assert.equal((await ok('GET', '/api/messages')).length, 0); assert.equal((await ok('GET', `/api/kids/${eva}/home`)).messages.length, 0);
    step('recado para todos: uma vez só, em qualquer tela');
    // agenda de alarmes para o app Android: só futuro, em ordem, com id estável
    const plan = await ok('GET', '/api/alarm-plan');
    assert.ok(Array.isArray(plan.items)); assert.ok(plan.items.every((x, i) => x.at > Date.now() && x.id && x.title && (!i || plan.items[i - 1].at <= x.at)));
    if (plan.plus) assert.ok(plan.items.some(x => x.id.startsWith('t'))); // há tarefas com horário (Escola 09:00, Jiu-jitsu)
    step('agenda de alarmes do app Android');
    assert.equal((await api('POST', '/api/fcm', { token: 'curto' })).status, 400);
    const fcmR = await ok('POST', '/api/fcm', { token: 'tokenDeTeste_' + 'x'.repeat(40), approvals: false }); assert.equal(fcmR.server, false);
    await ok('POST', '/api/fcm', { token: 'tokenDeTeste_' + 'x'.repeat(40), approvals: true }); // mesmo celular: atualiza, não duplica
    await ok('POST', '/api/fcm', { token: 'tokenTablet_' + 'y'.repeat(40), label: 'Tablet das crianças', msgs: true, alarms: true });
    await ok('POST', '/api/fcm', { token: 'tokenAna_' + 'z'.repeat(40), label: 'Celular da Ana', msgs: false, alarms: false });
    const devs = await ok('GET', '/api/admin/devices');
    assert.ok(devs.some(d => d.label === 'Tablet das crianças' && d.on)); assert.ok(devs.some(d => d.label === 'Celular da Ana' && !d.on));
    await ok('POST', '/api/admin/messages', { text: 'Só no tablet', kid_ids: allIds, devices: devs.filter(d => d.on).map(d => d.id) });
    step('app Android registra o celular para recados com o app fechado');
    // digital do app Android: a chave do aparelho abre o painel sem PIN
    const bioTok = (await ok('POST', '/api/auth/parent/device')).token;
    await ok('POST', '/api/auth/parent/exit');
    assert.equal((await api('POST', '/api/auth/parent/bio', { token: 'errada' })).status, 401);
    await ok('POST', '/api/auth/parent/bio', { token: bioTok });
    await ok('GET', '/api/admin/pending');
    step('digital do app Android abre o painel');
    // ligação da família: um aparelho liga, o outro vê tocando, atende, trocam sinais e desligam
    const dev = (tok) => async (method, url, body) => {
      const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-gt-dev': tok }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    const tabTok = 'tokenTablet_' + 'y'.repeat(40), anaTok = 'tokenAna_' + 'z'.repeat(40);
    const tab = dev(tabTok), anaPh = dev(anaTok);
    const targets = (await tab('GET', '/api/calls/targets')).data;
    const anaDev = targets.find(t => t.label === 'Celular da Ana'); assert.ok(anaDev && !targets.some(t => t.label === 'Tablet das crianças'));
    assert.equal((await api('POST', '/api/calls', { to: [anaDev.id] })).status, 400); // sem aparelho não liga
    const cid = (await tab('POST', '/api/calls', { to: [anaDev.id], from: 'Eva' })).data.id;
    const inc = (await anaPh('GET', '/api/calls/incoming')).data; assert.equal(inc[0].id, cid); assert.equal(inc[0].from, 'Eva');
    assert.equal((await tab('GET', '/api/calls/incoming')).data.length, 0);
    await tab('POST', `/api/calls/${cid}/signal`, { side: 'caller', kind: 'offer', body: { type: 'offer', sdp: 'x' } });
    assert.equal((await anaPh('POST', `/api/calls/${cid}/accept`)).status, 200);
    assert.equal((await anaPh('POST', `/api/calls/${cid}/accept`)).status, 409); // só um atende
    const sg = (await anaPh('GET', `/api/calls/${cid}/signals?side=callee&after=0`)).data; assert.equal(sg.status, 'accepted'); assert.equal(sg.signals[0].kind, 'offer');
    await anaPh('POST', `/api/calls/${cid}/signal`, { side: 'callee', kind: 'answer', body: { type: 'answer', sdp: 'y' } });
    assert.equal((await tab('GET', `/api/calls/${cid}/signals?side=caller&after=0`)).data.signals[0].kind, 'answer');
    await tab('POST', `/api/calls/${cid}/end`);
    assert.equal((await anaPh('GET', `/api/calls/${cid}`)).data.status, 'ended');
    assert.ok(Array.isArray((await tab('GET', '/api/calls/ice')).data));
    step('ligação da família: chamar, tocar, atender, trocar sinais e desligar');
    // o site precisa poder usar o microfone (ligação) e nada de câmera/localização
    const pp = (await fetch(BASE + '/app')).headers.get('permissions-policy') || '';
    assert.ok(/microphone=\(self\)/.test(pp) && /camera=\(\)/.test(pp), 'Permissions-Policy: ' + pp);
    step('cabeçalho permite o microfone só para o próprio site');
    // PIN da criança no cronômetro e doação de minutos entre irmãos
    const today0 = new Date().toLocaleDateString('sv');
    const kidRow = (await ok('GET', '/api/admin/kids')).find(k => k.id === eva);
    assert.equal(kidRow.pin_hash, undefined); assert.equal(kidRow.has_pin, false);
    const tdbD = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
    await tdbD.query("INSERT INTO ledger (family_id,kid_id,kind,reward_id,amount,day,note) SELECT family_id,id,'time',?,10,?,'teste' FROM kids WHERE id IN (?,?)", [game, today0, eva, ber]);
    await tdbD.end();
    const putKid = (extra) => ok('PUT', `/api/admin/kids/${eva}`, { name: kidRow.name, avatar: kidRow.avatar, color: kidRow.color, active: true, auto_approve: !!kidRow.auto_approve, ...extra });
    assert.equal((await api('PUT', `/api/admin/kids/${eva}`, { name: kidRow.name, avatar: kidRow.avatar, color: kidRow.color, pin: '12' })).status, 400);
    await putKid({ pin: '1234' });
    assert.equal((await ok('GET', '/api/admin/kids')).find(k => k.id === eva).has_pin, true);
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).kid.has_pin, true);
    const pinUrl = `/api/kids/${eva}/timer/${game}`;
    let r403 = await api('POST', pinUrl, { action: 'start' }); assert.equal(r403.status, 403); assert.equal(r403.data.code, 'pin');
    assert.equal((await api('POST', pinUrl, { action: 'start', pin: '9999' })).status, 403);
    await ok('POST', pinUrl, { action: 'start', pin: '1234' });
    await ok('POST', pinUrl, { action: 'pause' }); // pausar não pede PIN
    // doação: só com o prêmio liberado pelos pais
    const donUrl = `/api/kids/${eva}/donate`, don = (o) => api('POST', donUrl, { reward_id: game, to_kid_id: ber, minutes: 2, pin: '1234', ...o });
    assert.equal((await don({})).status, 403); // ainda não liberado
    const gameRw = (await ok('GET', '/api/admin/rewards')).find(r => r.id === game);
    await ok('PUT', `/api/admin/rewards/${game}`, { title: gameRw.title, icon: gameRw.icon, kind: 'time', total_value: gameRw.total_value, active: true, donate: true });
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).time.find(x => x.id === game).donate, true);
    assert.equal((await don({ pin: '0000' })).status, 403);
    assert.equal((await don({ to_kid_id: eva })).status, 404); // não doa para si mesmo
    assert.equal((await don({ minutes: 0 })).status, 400);
    assert.equal((await don({ minutes: 999 })).status, 400); // mais do que tem
    const e0 = (await ok('GET', `/api/kids/${eva}/home`)).time.find(x => x.id === game), b0 = (await ok('GET', `/api/kids/${ber}/home`)).time.find(x => x.id === game);
    const dr = await don({}); assert.equal(dr.status, 200);
    const e1 = (await ok('GET', `/api/kids/${eva}/home`)).time.find(x => x.id === game), b1 = (await ok('GET', `/api/kids/${ber}/home`)).time.find(x => x.id === game);
    assert.equal(+(e0.left - e1.left).toFixed(2), 2); assert.equal(+(b1.left - b0.left).toFixed(2), 2);
    assert.equal((await ok('GET', `/api/kids/${eva}/donate-targets?reward_id=${game}`)).some(k => k.id === ber), true);
    await putKid({ clear_pin: true });
    assert.equal((await ok('GET', '/api/admin/kids')).find(k => k.id === eva).has_pin, false);
    await ok('POST', pinUrl, { action: 'start' }); await ok('POST', pinUrl, { action: 'pause' });
    step('PIN da criança no play e doação de minutos entre irmãos');
    // pais bloqueiam o tempo de tela de uma criança: cronômetro para, play é recusado, o app confere pela situação
    await ok('POST', pinUrl, { action: 'start' });
    assert.equal((await ok('GET', `/api/kids/${eva}/screen`)).running.length, 1);
    assert.equal((await api('POST', `/api/admin/kids/9999/lock`, { locked: true })).status, 404);
    assert.equal((await ok('POST', `/api/admin/kids/${eva}/lock`, { locked: true })).locked, true);
    let sc = (await ok('GET', `/api/kids/${eva}/screen`)); assert.equal(sc.locked, true); assert.equal(sc.running.length, 0);
    assert.equal((await ok('GET', `/api/kids/${eva}/home`)).kid.locked, true);
    const lkR = await api('POST', pinUrl, { action: 'start' }); assert.equal(lkR.status, 403); assert.equal(lkR.data.code, 'locked');
    assert.equal((await ok('GET', `/api/kids/${ber}/screen`)).locked, false); // o irmão não é afetado
    assert.equal((await ok('GET', '/api/admin/kids')).find(k => k.id === eva).locked, 1);
    await ok('POST', `/api/admin/kids/${eva}/lock`, { locked: false });
    await ok('POST', pinUrl, { action: 'start' }); await ok('POST', pinUrl, { action: 'pause' });
    assert.equal((await ok('GET', `/api/kids/${eva}/screen`)).running.length, 0);
    step('bloqueio dos pais: para o cronômetro, recusa o play e libera depois');
    // som do fim do tempo escolhido pela família
    const putSound = (type, buf, name = 'campainha.mp3') => fetch(BASE + '/api/admin/sound', { method: 'POST', headers: { 'content-type': type, cookie, 'x-name': encodeURIComponent(name) }, body: buf });
    assert.equal((await ok('GET', '/api/sound/info')).has, false);
    assert.equal((await putSound('text/plain', Buffer.alloc(500, 1))).status, 400);          // não é áudio
    assert.equal((await putSound('audio/mpeg', Buffer.alloc(900 * 1024, 1))).status, 413);   // grande demais
    const snd = Buffer.from(Array.from({ length: 2000 }, (_, i) => i % 251));
    assert.equal((await putSound('audio/mpeg', snd, 'Campainha do fim.mp3')).status, 200);
    const inf = await ok('GET', '/api/sound/info'); assert.equal(inf.has, true); assert.equal(inf.name, 'Campainha do fim.mp3'); assert.equal(inf.size, 2000); assert.ok(inf.v.length > 10);
    const got = await fetch(BASE + '/api/sound/end', { headers: { cookie } });
    assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'audio/mpeg'); assert.ok(Buffer.from(await got.arrayBuffer()).equals(snd));
    await ok('DELETE', '/api/admin/sound');
    assert.equal((await ok('GET', '/api/sound/info')).has, false);
    assert.equal((await fetch(BASE + '/api/sound/end', { headers: { cookie } })).status, 404);
    step('som do fim do tempo: envia, confere, recusa o que não é áudio e volta ao padrão');

    // apagar filho (some de vez) e tirar adulto do jogo (continua responsável)
    const tmp = (await ok('POST', '/api/admin/kids', { name: 'Temporário', avatar: 'cat', color: '#ff4fae' })).id;
    await ok('DELETE', '/api/admin/kids/' + tmp);
    assert.ok(!(await ok('GET', '/api/admin/kids')).some(k => k.id === tmp));
    assert.equal((await ok('DELETE', '/api/admin/kids/' + anaKid.id)).left, true);
    assert.ok(!(await ok('GET', '/api/kids')).some(k => k.id === anaKid.id));
    assert.ok((await ok('GET', '/api/admin/members')).members.some(m => m.name === 'Ana')); step('apagar filho e tirar adulto do jogo');

    assert.equal((await api('DELETE', '/api/admin/members/' + ms[0].id)).status, 400);
    await ok('DELETE', '/api/admin/members/' + ms.find(m => m.name === 'Rosa').id);
    cookie = '';
    assert.equal((await api('POST', '/api/auth/login', { email: 'rosa@x.co', password: 'secret1' })).status, 401);
    cookie = main; step('responsável removido perde o acesso');
    assert.ok((await ok('POST', '/api/auth/passkey/register/options', {})).challenge); step('digital: opções de cadastro');

    // isolamento entre famílias
    cookie = '';
    await ok('POST', '/api/auth/register', { name: 'Outra', email: 'c@d.co', password: 'secret2', pin: '9999' });
    assert.equal((await ok('GET', '/api/kids')).length, 0);
    assert.equal((await api('GET', `/api/kids/${eva}/home`)).status, 404); step('famílias isoladas');

    // assinatura: família nova começa em teste de 90 dias e passa pelo assistente
    let me = await ok('GET', '/api/auth/me');
    assert.equal(me.access.status, 'trial'); assert.ok(me.access.days_left >= 89); assert.equal(me.onboarded, false);
    step('cadastro começa no teste grátis');
    const cat = await ok('GET', '/api/admin/catalog');
    const keys = cat.tasks.filter(x => x.on).map(x => x.key);
    const su = await ok('POST', '/api/admin/setup', { kids: [{ name: 'Ana', avatar: 'cat' }, { name: '' }], tasks: keys, rewards: [{ key: 'videogame', value: 26 }, { key: 'passeio' }] });
    assert.equal(su.kids, 1); assert.equal(su.tasks, keys.length);
    const ana = (await ok('GET', '/api/kids'))[0];
    const ah = await ok('GET', `/api/kids/${ana.id}/home`);
    assert.equal(ah.time[0].cap, 26);
    assert.equal(ah.tasks.find(x => x.title === 'Arrumar a cama').rewards.find(r => r.kind === 'time').value, Math.round(26 / keys.length * 100) / 100);
    assert.ok((await ok('GET', '/api/auth/me')).onboarded);
    assert.equal((await ok('POST', '/api/admin/catalog', { keys: [keys[0], 'banho'] })).created, 1);
    step('assistente cria filhos, missões e recompensas (catálogo sem duplicar)');

    // teste vencido bloqueia o app, mas não o login nem a tela de planos
    const db = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: 'gametask_test' });
    await db.query("UPDATE families SET trial_ends=DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE email='c@d.co'");
    assert.equal((await api('GET', '/api/kids')).status, 402);
    assert.equal((await api('GET', '/api/admin/kids')).status, 402);
    me = await ok('GET', '/api/auth/me'); assert.equal(me.access.active, false);
    const bs = await ok('GET', '/api/billing/status'); assert.equal(bs.prices.annual, 47); assert.equal(bs.prices.monthly, 8);
    step('teste vencido bloqueia o app (402) e mostra os planos');
    await db.query("UPDATE families SET paid_until=DATE_ADD(CURDATE(), INTERVAL 1 MONTH), plan='monthly' WHERE email='c@d.co'");
    assert.equal((await api('GET', '/api/kids')).status, 200); step('assinatura paga libera de novo');

    // avisos: plano mensal não tem; Plus tem
    assert.equal((await ok('GET', '/api/admin/push')).plus, false);
    assert.equal((await api('POST', '/api/admin/alarms', { title: 'Hora da escola', time: '06:40' })).status, 403);
    await db.query("UPDATE families SET plan='annual' WHERE email='c@d.co'"); // o anual inclui os avisos
    assert.equal((await ok('GET', '/api/admin/push')).plus, true);
    await db.query("UPDATE families SET plan='plus' WHERE email='c@d.co'");
    const pk = await ok('GET', '/api/admin/push'); assert.equal(pk.plus, true); assert.ok(pk.key.length > 40);
    assert.equal((await api('POST', '/api/admin/alarms', { title: 'Hora da escola', time: '25:00' })).status, 400);
    await ok('POST', '/api/admin/alarms', { title: 'Hora da escola', time: '06:40', weekdays: '12345', kid_id: ana.id });
    const al = await ok('GET', '/api/admin/alarms'); assert.equal(al.length, 1); assert.equal(al[0].kid_id, ana.id);
    await ok('PUT', '/api/admin/push-settings', { remind_before: 15 });
    assert.equal((await ok('GET', '/api/admin/push')).remind_before, 15);
    step('plano Plus libera avisos programados; mensal não');

    // painel do dono: só para OWNER_EMAILS (a@b.co no teste)
    assert.equal((await api('GET', '/api/owner/summary')).status, 403);
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    const sum = await ok('GET', '/api/owner/summary');
    assert.equal(sum.counts.total, 1); assert.equal(sum.counts.paid_plus, 1); assert.equal(sum.revenue.mrr, 5.58);
    assert.ok(!('vapid_private' in sum.settings));
    await ok('PUT', '/api/owner/settings', { price_annual: 59.9, price_monthly: 9.9, price_plus: 79.9, trial_days: 60 });
    assert.equal((await ok('GET', '/api/public/pricing')).plus, 79.9);
    assert.equal((await ok('GET', '/api/public/pricing')).annual, 59.9);
    const fam = (await ok('GET', '/api/owner/families')).find(f => f.email === 'c@d.co');
    await ok('POST', '/api/owner/families/' + fam.id, { action: 'free' });
    assert.equal((await ok('GET', '/api/owner/families')).find(f => f.email === 'c@d.co').access.status, 'free');
    step('painel do dono: resumo, preços editáveis e cortesia');

    // esqueci a senha: o dono gera o link (sem SMTP no teste); a senha nova vale e o link é de uso único
    const lk = (await ok('POST', '/api/owner/families/' + fam.id + '/reset-link')).link;
    const tok = lk.split('/redefinir/')[1]; assert.ok(tok && tok.length === 64);
    assert.equal((await ok('GET', '/api/auth/reset/' + tok)).valid, true);
    assert.equal((await ok('POST', '/api/auth/forgot', { email: 'ninguem@x.co' })).ok, true); // não revela se existe
    cookie = '';
    assert.equal((await api('POST', '/api/auth/reset', { token: tok, password: '123' })).status, 400);
    await ok('POST', '/api/auth/reset', { token: tok, password: 'novaSenha9' });
    assert.equal((await ok('GET', '/api/auth/me')).family, 'Outra'); // já entra logado
    assert.equal((await api('POST', '/api/auth/reset', { token: tok, password: 'outra123' })).status, 400);
    cookie = '';
    assert.equal((await api('POST', '/api/auth/login', { email: 'c@d.co', password: 'secret2' })).status, 401);
    await ok('POST', '/api/auth/login', { email: 'c@d.co', password: 'novaSenha9' });
    step('esqueci a senha: link de uso único troca a senha e entra');
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });

    // carrinho da página de vendas: paga primeiro, cria a senha e o PIN depois
    cookie = '';
    assert.equal((await api('POST', '/api/billing/guest-checkout', { plan: 'monthly', name: 'X', email: 'invalido' })).status, 400);
    const gc = await ok('POST', '/api/billing/guest-checkout', { plan: 'monthly', name: 'Família Nova', email: 'novo@x.co' });
    assert.ok(gc.url.startsWith('https://mp.test/pay/'));
    let g = await ok('GET', '/api/auth/me');
    assert.equal(g.pending, true); assert.equal(g.access.status, 'trial');
    const ref = gc.url.split('/').pop();
    assert.equal((await ok('GET', `/api/billing/return?ref=${ref}&payment_id=777`)).payment.status, 'approved');
    g = await ok('GET', '/api/auth/me'); assert.equal(g.access.status, 'paid'); assert.equal(g.pending, true);
    assert.equal((await api('POST', '/api/auth/complete', { password: 'abc', pin: '1234' })).status, 400);
    assert.equal((await api('POST', '/api/auth/complete', { password: 'segredo1', pin: '12' })).status, 400);
    await ok('POST', '/api/auth/complete', { password: 'segredo1', pin: '4321', my_name: 'Marta', family_name: 'Família Marta' });
    g = await ok('GET', '/api/auth/me'); assert.equal(g.pending, false); assert.equal(g.actor.name, 'Marta'); assert.equal(g.access.status, 'paid'); assert.equal(g.family, 'Família Marta');
    assert.equal((await api('POST', '/api/auth/complete', { password: 'segredo1', pin: '4321' })).status, 400); // já finalizado
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'novo@x.co', password: 'segredo1' });
    await ok('POST', '/api/auth/parent', { pin: '4321' });
    cookie = '';
    assert.equal((await api('POST', '/api/billing/guest-checkout', { plan: 'annual', name: 'Y', email: 'novo@x.co' })).status, 409);
    // cadastro de venda abandonado (sem pagamento) não prende o e-mail
    await ok('POST', '/api/billing/guest-checkout', { plan: 'annual', name: 'Abandonou', email: 'velho@x.co' });
    cookie = '';
    await ok('POST', '/api/auth/register', { name: 'Família Velho', email: 'velho@x.co', password: 'secret1', pin: '1111' });
    assert.equal((await ok('GET', '/api/auth/me')).pending, false);
    step('carrinho: paga primeiro, finaliza com senha e PIN, e e-mail abandonado é liberado');

    // Pix dentro do app: QR no carrinho, consulta até cair, e quem volta a tentar reaproveita o cadastro
    cookie = '';
    await ok('POST', '/api/billing/guest-checkout', { plan: 'monthly', email: 'soemail@x.co' }); // só e-mail basta
    cookie = '';
    // cartão dentro do app
    assert.equal((await ok('GET', '/api/public/pricing')).card, 'APP_USR-pub');
    const card = { payment_method_id: 'visa', installments: 1, payer: { email: 'cartao@x.co', identification: { type: 'CPF', number: '12345678909' } } };
    const cr = await ok('POST', '/api/billing/guest-card', { plan: 'monthly', email: 'cartao@x.co', token: 'bad', ...card });
    assert.equal(cr.status, 'rejected'); assert.ok(/limite/.test(cr.message));
    assert.equal((await ok('GET', '/api/auth/me')).access.status, 'trial');
    const ca = await ok('POST', '/api/billing/guest-card', { plan: 'monthly', email: 'cartao@x.co', token: 'tk1', amount: 0.01, ...card });
    assert.equal(ca.status, 'approved');
    const gm = await ok('GET', '/api/auth/me'); assert.equal(gm.access.status, 'paid'); assert.equal(gm.pending, true);
    assert.equal((await api('POST', '/api/billing/guest-card', { plan: 'monthly', email: 'cartao@x.co', token: 'tk2', ...card })).status, 409); // já pago
    step('cartão dentro do app: recusado explica o motivo, aprovado libera na hora');
    cookie = '';
    const fb = await ok('POST', '/api/billing/guest-pix', { plan: 'monthly', email: 'semapi@x.co' }); // Pix pela API recusado: vai para a página do MP
    assert.ok(fb.url && fb.url.startsWith('https://mp.test/pay/') && !fb.code);
    cookie = '';
    const px = await ok('POST', '/api/billing/guest-pix', { plan: 'annual', name: 'Família Pix', email: 'pix@x.co' });
    assert.ok(px.code.startsWith('0002') && px.qr && px.ref);
    assert.equal((await ok('GET', '/api/auth/me')).pending, true);
    const px2 = await ok('POST', '/api/billing/guest-pix', { plan: 'monthly', name: 'Família Pix', email: 'pix@x.co' });
    assert.ok(px2.ref !== px.ref);
    assert.equal((await ok('GET', '/api/billing/pix/' + px2.ref)).status, 'approved');
    assert.equal((await ok('GET', '/api/auth/me')).access.status, 'paid');
    assert.equal((await api('GET', '/api/billing/pix/' + px.ref)).status, 200); // o outro Pix da mesma família segue consultável
    assert.equal((await api('POST', '/api/billing/guest-pix', { plan: 'annual', name: 'Outro', email: 'pix@x.co' })).status, 409); // já pago: não reabre
    cookie = '';
    assert.equal((await api('GET', '/api/billing/pix/' + px.ref)).status, 401); // sem sessão não consulta
    step('Pix: QR dentro do app, confirmação por consulta e reaproveita cadastro sem pagamento');
    // cupons de desconto: o dono cria; vale no carrinho; 100% ativa sem Mercado Pago; limite de usos
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    await ok('POST', '/api/owner/coupons', { code: 'teste10', percent: 10 });
    await ok('POST', '/api/owner/coupons', { code: 'GRATIS', percent: 100, max_uses: 1 });
    assert.equal((await api('POST', '/api/owner/coupons', { code: 'TESTE10', percent: 5 })).status, 400); // código repetido
    assert.equal((await api('POST', '/api/owner/coupons', { code: 'X1', percent: 150 })).status, 400);
    const cups = await ok('GET', '/api/owner/coupons');
    assert.deepEqual(cups.map(c => [c.code, c.percent]).sort(), [['GRATIS', 100], ['TESTE10', 10]]);
    cookie = '';
    assert.equal((await api('POST', '/api/billing/coupon', { code: 'NAOEXISTE' })).status, 400);
    assert.deepEqual(await ok('POST', '/api/billing/coupon', { code: ' teste10 ' }), { code: 'TESTE10', percent: 10 });
    const annual = (await ok('GET', '/api/public/pricing')).annual;
    const cpx = await ok('POST', '/api/billing/guest-pix', { plan: 'annual', email: 'cupom@x.co', coupon: 'TESTE10' });
    assert.equal(cpx.amount, Math.round(annual * 90) / 100); // cobra com 10% de desconto
    assert.equal((await ok('GET', `/api/billing/pix/${cpx.ref}`)).status, 'approved');
    // garantia: a primeira compra paga pode ser devolvida no prazo, sem motivo, e o acesso pago sai
    const gs = await ok('GET', '/api/billing/status');
    assert.equal(gs.guarantee.ref, cpx.ref); assert.equal(gs.access.status, 'paid');
    assert.equal((await ok('POST', '/api/billing/refund', {})).amount, cpx.amount);
    const gs2 = await ok('GET', '/api/billing/status');
    assert.equal(gs2.guarantee, null); assert.notEqual(gs2.access.status, 'paid'); assert.equal(gs2.payments[0].status, 'refunded');
    assert.equal((await api('POST', '/api/billing/refund', {})).status, 400); // não devolve duas vezes
    assert.equal((await api('POST', '/api/billing/guest-pix', { plan: 'annual', email: 'cupom2@x.co', coupon: 'GRATIS' })).status, 400); // 100% não gera Pix
    cookie = '';
    const fr = await ok('POST', '/api/billing/guest-free', { plan: 'plus', email: 'gratis@x.co', coupon: 'GRATIS' });
    assert.equal(fr.status, 'approved');
    const gme = await ok('GET', '/api/auth/me'); assert.equal(gme.access.status, 'paid'); assert.equal(gme.access.plan, 'plus');
    cookie = '';
    assert.equal((await api('POST', '/api/billing/guest-free', { plan: 'annual', email: 'gratis2@x.co', coupon: 'GRATIS' })).status, 400); // só 1 uso
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    const used = await ok('GET', '/api/owner/coupons');
    assert.deepEqual(used.map(c => [c.code, c.uses]).sort(), [['GRATIS', 1], ['TESTE10', 1]]);
    const pays = await ok('GET', '/api/owner/payments');
    assert.ok(pays.some(p => p.coupon === 'GRATIS' && +p.amount === 0 && p.method === 'cupom' && p.status === 'approved'));
    await ok('PUT', `/api/owner/coupons/${used.find(c => c.code === 'TESTE10').id}`, { active: false });
    cookie = '';
    assert.equal((await api('POST', '/api/billing/coupon', { code: 'TESTE10' })).status, 400); // pausado
    step('cupons: desconto no Pix, 100% ativa direto, limite de usos e pausa');

    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });

    // página de vendas em "/" com os preços do painel; app em "/app"
    const land = await (await fetch(BASE + '/')).text();
    assert.ok(land.includes('59,90') && land.includes('9,90') && !land.includes('{{'));
    assert.ok((await (await fetch(BASE + '/app')).text()).includes('/js/app.js'));
    step('landing com preços dinâmicos e app em /app');

    // área dos pais instalada à parte, com disfarce
    const pnl = await (await fetch(BASE + '/painel?i=notas')).text();
    assert.ok(pnl.includes('<title>Notas</title>') && pnl.includes('/painel/manifest.json?i=notas') && pnl.includes('/icons/d/notas-180.png') && pnl.includes('/js/app.js'));
    const mf = await (await fetch(BASE + '/painel/manifest.json?i=notas')).json();
    assert.deepEqual([mf.id, mf.name, mf.start_url, mf.scope], ['/painel', 'Notas', '/painel?i=notas', '/painel']);
    assert.equal((await fetch(BASE + mf.icons[1].src)).status, 200);
    assert.equal((await (await fetch(BASE + '/painel/manifest.json?i=xx')).json()).name, 'Banco'); // disfarce inválido cai no padrão
    step('área dos pais: página /painel e manifesto com nome e ícone de disfarce');
    const kmf = await (await fetch(BASE + '/manifest.json')).json();
    assert.equal(kmf.scope, '/app'); // app das crianças não "engole" o /painel

    // app dos pais lembrado no aparelho: abre o painel só com o cabeçalho; o resto continua trancado
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    const { token: pdev } = await ok('POST', '/api/auth/parent/device');
    await ok('POST', '/api/auth/parent/exit');
    const withDev = (m, u) => fetch(BASE + u, { method: m, headers: { cookie, 'x-parent-device': pdev } });
    assert.equal((await api('GET', '/api/admin/tasks')).status, 403);
    assert.equal((await withDev('GET', '/api/admin/tasks')).status, 200);
    assert.equal((await (await withDev('GET', '/api/auth/me')).json()).parent, true);
    assert.equal((await (await fetch(BASE + '/api/admin/tasks', { headers: { cookie, 'x-parent-device': 'errado' } })).status), 403);
    assert.equal((await api('POST', '/api/auth/parent/device')).status, 403); // só logo depois do PIN
    await withDev('DELETE', '/api/auth/parent/device');
    assert.equal((await withDev('GET', '/api/admin/tasks')).status, 403);
    step('app dos pais: abre direto no aparelho lembrado, sem destrancar o app das crianças');

    // SEO: robots, sitemap, páginas de conteúdo; o app fica fora do Google
    const robots = await (await fetch(BASE + '/robots.txt')).text();
    assert.ok(robots.includes('Disallow: /app') && robots.includes('Sitemap: ' + BASE + '/sitemap.xml'));
    const smap = await (await fetch(BASE + '/sitemap.xml')).text();
    assert.ok(smap.includes(`<loc>${BASE}/quadro-de-tarefas-infantil</loc>`) && smap.includes(`<loc>${BASE}/</loc>`));
    const qd = await fetch(BASE + '/quadro-de-tarefas-infantil');
    assert.equal(qd.status, 200); assert.ok((await qd.text()).includes(`<link rel="canonical" href="${BASE}/quadro-de-tarefas-infantil">`));
    // guias: no sitemap, canonical certo, um h1, dados estruturados válidos e nenhum marcador sobrando
    for (const g of ['/tarefas-domesticas-por-idade', '/calculadora-de-mesada', '/tempo-de-tela-por-idade']) {
      assert.ok(smap.includes(`<loc>${BASE}${g}</loc>`), 'sitemap ' + g);
      const h = await (await fetch(BASE + g)).text();
      assert.ok(h.includes(`<link rel="canonical" href="${BASE}${g}">`) && !h.includes('{{') && (h.match(/<h1/g) || []).length === 1, g);
      const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.ok(ld['@graph'].some(x => x['@type'] === 'FAQPage') && ld['@graph'].some(x => x['@type'] === 'BreadcrumbList'), 'json-ld ' + g);
    }
    assert.equal((await fetch(BASE + '/app')).headers.get('x-robots-tag'), 'noindex');
    const home0 = await (await fetch(BASE + '/')).text();
    assert.ok(home0.includes('"price":"') && !home0.includes('{{'), 'página de vendas sem marcador sobrando');
    step('SEO: robots.txt, sitemap, canonical, app com noindex');

    // isca do quadro de tarefas: guarda o lead, valida, mesmo e-mail mantém o link
    const pub = (b) => fetch(BASE + '/api/public/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const lead = { name: 'Mãe Teste', email: 'Mae@Teste.com', whatsapp: '(11) 91234-5678', consent: true, kids: ['Eva', 'Ester'], tasks: [{ t: 'Arrumar a cama', i: 'bed' }, { t: 'Inventada', i: '../x' }] };
    assert.equal((await pub({ ...lead, consent: false })).status, 400);
    assert.equal((await pub({ ...lead, email: 'nao-e-email' })).status, 400);
    assert.equal((await pub({ ...lead, kids: [] })).status, 400);
    const l1 = await (await pub(lead)).json(), l2 = await (await pub({ ...lead, kids: ['Bernardo'] })).json();
    assert.ok(/^[a-f0-9]{32}$/.test(l1.token), JSON.stringify(l1)); assert.equal(l1.token, l2.token);
    const back = await (await fetch(BASE + '/api/public/leads/' + l1.token)).json();
    assert.deepEqual(back.kids, ['Bernardo']); assert.equal(back.tasks[1].i, 'star'); // ícone inválido vira estrela
    assert.equal((await fetch(BASE + '/api/public/leads/' + 'f'.repeat(32))).status, 404);
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    const ls = await ok('GET', '/api/owner/leads');
    const lm = ls.find(x => x.email === 'mae@teste.com');
    assert.ok(lm && lm.whatsapp === '11912345678' && lm.downloads === 2 && lm.cliente === false);
    step('isca: lead do quadro de tarefas guardado, validado e listado no painel do dono');

    // WhatsApp: a pessoa manda o código e recebe o PDF; o resto das mensagens do número é ignorado
    assert.ok((await (await fetch(BASE + '/quadro-de-tarefas-infantil')).text()).includes('data-wa="1"'));
    const semEmail = await (await pub({ name: 'Ana Souza', consent: true, kids: ['Eva', 'Ester'], tasks: [{ t: 'Arrumar a cama', i: 'bed' }] })).json();
    assert.ok(/^GT-[A-Z0-9]{4}$/.test(semEmail.code), 'código ' + semEmail.code);
    assert.ok(semEmail.wa.startsWith('https://wa.me/5511999990000?text=') && decodeURIComponent(semEmail.wa).includes(semEmail.code));
    const secret = require('crypto').createHash('sha256').update('gt-wa:evo-key').digest('hex').slice(0, 32);
    const hook = (data, s = secret) => fetch(BASE + '/api/public/wa/' + s, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'messages.upsert', instance: 'gt', data }) });
    const msg = (id, jid, text, extra = {}) => ({ key: { id, remoteJid: jid, fromMe: false, ...extra }, pushName: 'Ana', message: { conversation: text } });
    const waitSent = async (n) => { for (let i = 0; i < 80 && evoSent.length < n; i++) await new Promise(r => setTimeout(r, 100)); };
    assert.equal((await hook(msg('m0', '5511988887777@s.whatsapp.net', 'Oi! ' + semEmail.code), 'errado')).status, 404);
    await hook(msg('m1', '5511944443333@s.whatsapp.net', 'oi amor, chego às 7'));        // conversa pessoal: ignorada
    await hook({ key: { id: 'm2', remoteJid: '5511988887777@s.whatsapp.net', fromMe: true }, message: { conversation: semEmail.code } }); // enviada por mim: ignorada
    await hook(msg('m3', '120363@g.us', semEmail.code));                                   // grupo: ignorado
    await hook(msg('m4', '5511988887777@s.whatsapp.net', 'Oi! Quero meu quadro de tarefas 📋 Código: ' + semEmail.code.toLowerCase()));
    await hook(msg('m4', '5511988887777@s.whatsapp.net', 'repetido ' + semEmail.code));   // mesmo id: não manda duas vezes
    await waitSent(1); await new Promise(r => setTimeout(r, 300));
    assert.equal(evoSent.length, 1, 'só uma mensagem enviada: ' + JSON.stringify(evoSent.map(s => s.number)));
    const pdfMsg = evoSent[0];
    assert.equal(pdfMsg.kind, 'sendMedia'); assert.equal(pdfMsg.number, '5511988887777'); assert.equal(pdfMsg.mediatype, 'document');
    assert.ok(Buffer.from(pdfMsg.media, 'base64').subarray(0, 4).toString() === '%PDF' && pdfMsg.caption.includes('Eva e Ester') && pdfMsg.caption.startsWith('Oi, Ana!'));
    // conta com @lid: o número de verdade vem em remoteJidAlt
    const outro = await (await pub({ name: 'Bia', consent: true, kids: ['Leo'], tasks: [{ t: 'Ler', i: 'openbook' }] })).json();
    await hook(msg('m5', '99887766@lid', outro.code, { remoteJidAlt: '5521977776666@s.whatsapp.net' }));
    await waitSent(2);
    assert.equal(evoSent[1].number, '5521977776666');
    // SAIR: só vale para lead confirmado; conversa pessoal com "sair" não responde
    await hook(msg('m6', '5511944443333@s.whatsapp.net', 'sair'));
    await hook(msg('m7', '5511988887777@s.whatsapp.net', 'SAIR'));
    await waitSent(3); await new Promise(r => setTimeout(r, 300));
    assert.equal(evoSent.length, 3); assert.equal(evoSent[2].kind, 'sendText'); assert.equal(evoSent[2].number, '5511988887777');
    const ls2 = await ok('GET', '/api/owner/leads'), lAna = ls2.find(x => x.code === semEmail.code);
    assert.ok(lAna.whatsapp === '5511988887777' && lAna.wa_confirmed_at && lAna.opt_out_at && lAna.email === null);
    assert.ok(ls2.find(x => x.code === outro.code).wa_confirmed_at);
    // o dono testando na conversa "eu comigo mesmo" (fromMe, número sem o 9): recebe o PDF
    const dono = await (await pub({ name: 'Bruno', consent: true, kids: ['Eva'], tasks: [{ t: 'Ler', i: 'openbook' }] })).json();
    await hook({ key: { id: 'm8', remoteJid: '551199990000@s.whatsapp.net', fromMe: true }, message: { conversation: 'Quero meu quadro. Código: ' + dono.code } });
    await waitSent(4);
    assert.equal(evoSent.length, 4); assert.equal(evoSent[3].kind, 'sendMedia');
    step('WhatsApp: código recebido devolve o PDF; conversas pessoais, grupos e repetições ignorados; SAIR respeitado');

    // repasse: tudo o que chegou (até conversa pessoal) foi também para o n8n, do jeito que veio
    assert.ok(n8nGot.some(x => x.url === '/n8n' && x.body.data?.message?.conversation === 'oi amor, chego às 7'), 'repasse: ' + n8nGot.length);
    await fetch(BASE + '/api/public/wa/' + secret, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"event":"connection.update","data":{"state":"open"}}' });
    await fetch(BASE + '/api/public/wa/' + secret + '/messages-upsert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"event":"messages.upsert","data":{}}' });
    for (let i = 0; i < 30 && !n8nGot.some(x => x.url === '/n8n/messages-upsert'); i++) await new Promise(r => setTimeout(r, 100));
    assert.ok(n8nGot.some(x => x.body.event === 'connection.update') && n8nGot.some(x => x.url === '/n8n/messages-upsert'));

    let ws = await ok('GET', '/api/owner/whatsapp');
    assert.ok(ws.configured && ws.state === 'open' && ws.number === '5511999990000' && !ws.hookOk && ws.forward);
    // a instância já avisa outro sistema que não é o repasse: o botão NÃO troca
    evoHook = { url: 'https://n8n.exemplo/webhook/outro', enabled: true, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] };
    const rh = await api('POST', '/api/owner/whatsapp/webhook');
    assert.equal(rh.status, 502); assert.equal(evoHook.url, 'https://n8n.exemplo/webhook/outro');
    // é o endereço do repasse: troca e mantém os eventos que o outro sistema usava
    evoHook.url = 'http://127.0.0.1:3197/n8n';
    ws = await ok('POST', '/api/owner/whatsapp/webhook');
    assert.ok(ws.hookOk && evoHook.url.endsWith('/api/public/wa/' + secret) && evoHook.events.includes('MESSAGES_UPSERT') && evoHook.events.includes('CONNECTION_UPDATE'));
    step('painel do dono: status da Evolution, ligar o recebimento sem derrubar o n8n e repassar as mensagens');

    // Fluxos: o do quadro nasce pausado com as 2 mensagens aprovadas
    let fls = await ok('GET', '/api/owner/flows');
    const fq = fls.flows[0];
    assert.ok(fls.flows.length === 1 && fq.source === 'quadro' && !fq.active && fq.steps.map(s => s.day).join() === '3,7');
    // pausado: a Bia confirmou há 3 dias e não recebe nada
    await db.query('UPDATE leads SET wa_confirmed_at = NOW() - INTERVAL 3 DAY - INTERVAL 1 HOUR WHERE code=?', [outro.code]);
    const before = evoSent.length;
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(evoSent.length, before, 'fluxo pausado não envia');
    // ativa: sai a mensagem do dia 3 só para ela (o lead da Ana saiu; os outros estão no dia 0)
    await ok('PUT', `/api/owner/flows/${fq.id}`, { ...fq, active: true });
    for (let i = 0; i < 40 && evoSent.length === before; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 1200));
    const fsent = evoSent.slice(before);
    assert.equal(fsent.length, 1, 'fluxo: ' + JSON.stringify(fsent.map(x => x.number)));
    assert.ok(fsent[0].kind === 'sendText' && fsent[0].number === '5521977776666' && fsent[0].text.startsWith('Oi, Bia!'));
    fls = await ok('GET', '/api/owner/flows');
    assert.equal(fls.flows[0].steps[0].sent, 1);
    // editar o texto mantém a mensagem (quem recebeu não recebe de novo); dia 7 usa a garantia
    const f2 = fls.flows[0]; f2.steps[0].body += ' 🙂';
    await ok('PUT', `/api/owner/flows/${f2.id}`, f2);
    fls = await ok('GET', '/api/owner/flows');
    assert.ok(fls.flows[0].steps[0].id === f2.steps[0].id && fls.flows[0].steps[0].sent === 1);
    assert.equal((await api('PUT', `/api/owner/flows/${f2.id}`, { ...f2, steps: [{ day: 0, body: 'x' }] })).status, 400);
    await ok('POST', '/api/owner/flows/test', { body: fls.flows[0].steps[1].body });
    const t7 = evoSent.at(-1);
    assert.ok(t7.number === '5511999990000' && t7.text.startsWith('[TESTE] Ana, a real') && t7.text.includes('garantia de 14 dias') && !/\{\w+\}/.test(t7.text));
    step('fluxos de WhatsApp: pausado não envia, ativo manda no dia certo uma vez, edição não reenvia, teste para o dono');
    await db.end();

    console.log('\nTODOS OS TESTES PASSARAM');
  } finally { srv.kill(); mpFake.close(); evoFake.close(); }
})().catch(e => { console.error('\n✘ FALHOU:', e.message); process.exit(1); });
