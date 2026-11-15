// Teste de ponta a ponta contra um banco descartável (gametask_test). Uso: npm test
require('dotenv').config();
const assert = require('assert');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

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

  const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_NAME: 'gametask_test', PORT, DATABASE_URL: '', OWNER_EMAILS: 'a@b.co', MP_ACCESS_TOKEN: '' }, stdio: 'inherit' });
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

    // painel do dono: só para OWNER_EMAILS (a@b.co no teste)
    assert.equal((await api('GET', '/api/owner/summary')).status, 403);
    cookie = '';
    await ok('POST', '/api/auth/login', { email: 'a@b.co', password: 'secret1' });
    await ok('POST', '/api/auth/parent', { pin: '1234' });
    const sum = await ok('GET', '/api/owner/summary');
    assert.equal(sum.counts.total, 1); assert.equal(sum.counts.paid_monthly, 1); assert.equal(sum.revenue.mrr, 8);
    await ok('PUT', '/api/owner/settings', { price_annual: 59.9, price_monthly: 9.9, trial_days: 60 });
    assert.equal((await ok('GET', '/api/public/pricing')).annual, 59.9);
    const fam = (await ok('GET', '/api/owner/families')).find(f => f.email === 'c@d.co');
    await ok('POST', '/api/owner/families/' + fam.id, { action: 'free' });
    assert.equal((await ok('GET', '/api/owner/families')).find(f => f.email === 'c@d.co').access.status, 'free');
    step('painel do dono: resumo, preços editáveis e cortesia');

    // página de vendas em "/" com os preços do painel; app em "/app"
    const land = await (await fetch(BASE + '/')).text();
    assert.ok(land.includes('59,90') && land.includes('9,90') && !land.includes('{{'));
    assert.ok((await (await fetch(BASE + '/app')).text()).includes('/js/app.js'));
    step('landing com preços dinâmicos e app em /app');
    await db.end();

    console.log('\nTODOS OS TESTES PASSARAM');
  } finally { srv.kill(); }
})().catch(e => { console.error('\n✘ FALHOU:', e.message); process.exit(1); });
