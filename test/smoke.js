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

  const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_NAME: 'gametask_test', PORT, DATABASE_URL: '' }, stdio: 'inherit' });
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/api/auth/me'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }

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

    console.log('\nTODOS OS TESTES PASSARAM');
  } finally { srv.kill(); }
})().catch(e => { console.error('\n✘ FALHOU:', e.message); process.exit(1); });
