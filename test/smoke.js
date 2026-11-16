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
  const mpFake = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/checkout/preferences') {
        const j = JSON.parse(b); lastPref = { ref: j.external_reference, amount: j.items[0].unit_price };
        return res.end(JSON.stringify({ init_point: 'https://mp.test/pay/' + j.external_reference }));
      }
      if (req.method === 'POST' && req.url === '/v1/payments') {
        const j = JSON.parse(b); lastPref = { ref: j.external_reference, amount: j.transaction_amount };
        return res.end(JSON.stringify({ id: 777, status: 'pending', point_of_interaction: { transaction_data: { qr_code: '00020126PIXTESTE', qr_code_base64: 'iVBORw0KGgo=' } } }));
      }
      if (req.url.startsWith('/v1/payments/') && lastPref)
        return res.end(JSON.stringify({ id: 777, status: 'approved', transaction_amount: lastPref.amount, currency_id: 'BRL', external_reference: lastPref.ref, payment_method_id: 'pix' }));
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => mpFake.listen(3198, '127.0.0.1', r));
  const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_NAME: 'gametask_test', PORT, DATABASE_URL: '', OWNER_EMAILS: 'a@b.co', MP_ACCESS_TOKEN: 'tok', MP_API: 'http://127.0.0.1:3198' }, stdio: 'inherit' });
  try {
    for (let i = 0; i < 120; i++) { try { await fetch(BASE + '/api/auth/me'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }

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
    assert.equal(st[0].kids[ber].coins, 5); assert.equal(st[0].kids[eva].tasks, 2);
    const det = await ok('GET', '/api/admin/statement/' + st[0].day);
    assert.equal(det[eva].tasks.length, 2); assert.ok(det[eva].other.some(o => o.note === 'Pagamento')); step('extrato diário com detalhe do dia');

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

    // apagar por arrastar: num filho tira só dele; em "Todas" apaga para todos
    const sw = (await ok('POST', '/api/admin/tasks', { title: 'Arrastar', type: 'daily', all_kids: 1 })).id;
    await ok('DELETE', `/api/admin/kids/${eva}/tasks/${sw}`);
    assert.ok(!(await ok('GET', `/api/kids/${eva}/home`)).tasks.some(t => t.id === sw));
    assert.ok((await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === sw));
    assert.ok(!(await ok('GET', `/api/kids/${anaKid.id}/home`)).tasks.some(t => t.id === sw));
    await ok('DELETE', '/api/admin/tasks/' + sw);
    assert.ok(!(await ok('GET', `/api/kids/${ber}/home`)).tasks.some(t => t.id === sw));
    assert.ok(!(await ok('GET', '/api/admin/tasks')).some(t => t.id === sw)); step('apagar tarefa: só de um filho ou de todos');

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
    await ok('POST', '/api/auth/complete', { password: 'segredo1', pin: '4321', my_name: 'Marta' });
    g = await ok('GET', '/api/auth/me'); assert.equal(g.pending, false); assert.equal(g.actor.name, 'Marta'); assert.equal(g.access.status, 'paid');
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
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });

    // página de vendas em "/" com os preços do painel; app em "/app"
    const land = await (await fetch(BASE + '/')).text();
    assert.ok(land.includes('59,90') && land.includes('9,90') && !land.includes('{{'));
    assert.ok((await (await fetch(BASE + '/app')).text()).includes('/js/app.js'));
    step('landing com preços dinâmicos e app em /app');
    await db.end();

    console.log('\nTODOS OS TESTES PASSARAM');
  } finally { srv.kill(); mpFake.close(); }
})().catch(e => { console.error('\n✘ FALHOU:', e.message); process.exit(1); });
