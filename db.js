require('dotenv').config();
const mysql = require('mysql2/promise');

const base = { waitForConnections: true, connectionLimit: 10, dateStrings: true, decimalNumbers: true, timezone: 'Z' };
const pool = process.env.DATABASE_URL
  ? mysql.createPool({ uri: process.env.DATABASE_URL, ...base })
  : mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'gametask', ...base,
    });

const SCHEMA = [
`CREATE TABLE IF NOT EXISTS families (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL, parent_pin_hash VARCHAR(100) NOT NULL,
  coin_value DECIMAL(10,2) NOT NULL DEFAULT 0.50, auto_approve TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS kids (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, name VARCHAR(60) NOT NULL,
  avatar VARCHAR(16) NOT NULL DEFAULT 'fox', color VARCHAR(9) NOT NULL DEFAULT '#ff4fae',
  active TINYINT NOT NULL DEFAULT 1, sort INT NOT NULL DEFAULT 0, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, title VARCHAR(120) NOT NULL,
  icon VARCHAR(16) NOT NULL DEFAULT 'star', description VARCHAR(255) NULL,
  type ENUM('daily','one_off') NOT NULL DEFAULT 'daily', weekdays VARCHAR(14) NOT NULL DEFAULT '0123456',
  date DATE NULL, time CHAR(5) NULL, repeat_weekly TINYINT NOT NULL DEFAULT 0,
  coins DECIMAL(10,2) NOT NULL DEFAULT 0, all_kids TINYINT NOT NULL DEFAULT 1,
  active TINYINT NOT NULL DEFAULT 1, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS task_kids (task_id INT NOT NULL, kid_id INT NOT NULL, PRIMARY KEY(task_id, kid_id))`,
`CREATE TABLE IF NOT EXISTS rewards (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, title VARCHAR(120) NOT NULL,
  icon VARCHAR(16) NOT NULL DEFAULT 'game', kind ENUM('time','goal') NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'min', total_value DECIMAL(10,2) NOT NULL,
  goal_mode ENUM('tasks','coins') NULL, active TINYINT NOT NULL DEFAULT 1, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS task_rewards (task_id INT NOT NULL, reward_id INT NOT NULL, PRIMARY KEY(task_id, reward_id))`,
`CREATE TABLE IF NOT EXISTS completions (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, task_id INT NOT NULL, kid_id INT NOT NULL,
  day DATE NOT NULL, status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, decided_at TIMESTAMP NULL,
  UNIQUE KEY u (task_id, kid_id, day), INDEX(family_id, status))`,
`CREATE TABLE IF NOT EXISTS payouts (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, kid_id INT NOT NULL,
  coins DECIMAL(10,2) NOT NULL, amount DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS ledger (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, kid_id INT NOT NULL,
  kind ENUM('coin','time','goal') NOT NULL, reward_id INT NULL, amount DECIMAL(10,2) NOT NULL,
  day DATE NOT NULL, completion_id INT NULL, payout_id INT NULL, note VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(kid_id, kind, day), INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS app_settings (k VARCHAR(40) PRIMARY KEY, v VARCHAR(255) NOT NULL)`,
`CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, plan ENUM('monthly','annual') NOT NULL,
  amount DECIMAL(10,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', method VARCHAR(40) NULL,
  mp_payment_id VARCHAR(40) NULL, period_end DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, paid_at TIMESTAMP NULL, INDEX(family_id), INDEX(status))`,
`CREATE TABLE IF NOT EXISTS push_subs (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, endpoint VARCHAR(600) NOT NULL, p256dh VARCHAR(200) NOT NULL, auth VARCHAR(100) NOT NULL,
  label VARCHAR(60) NULL, reminders TINYINT NOT NULL DEFAULT 1, approvals TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY u (endpoint(255)), INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS alarms (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, title VARCHAR(120) NOT NULL, kid_id INT NULL,
  time CHAR(5) NOT NULL, weekdays VARCHAR(14) NOT NULL DEFAULT '0123456', active TINYINT NOT NULL DEFAULT 1, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) PRIMARY KEY, family_id INT NOT NULL, expires_at DATETIME NOT NULL, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS push_log (k VARCHAR(100) PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
// Responsáveis da família (pai, mãe, babá...). O principal é quem criou a conta (e-mail e senha ficam em families).
// full_access=0: só o dia a dia (aprovar, tempo usado, extrato). kid_id: perfil de jogador do adulto, se participa da rotina.
`CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, name VARCHAR(60) NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'Responsável',
  full_access TINYINT NOT NULL DEFAULT 1, principal TINYINT NOT NULL DEFAULT 0,
  email VARCHAR(160) NULL UNIQUE, password_hash VARCHAR(100) NULL, pin_hash VARCHAR(100) NOT NULL,
  kid_id INT NULL, active TINYINT NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS invites (
  token_hash CHAR(64) PRIMARY KEY, family_id INT NOT NULL, name VARCHAR(60) NOT NULL, role VARCHAR(30) NOT NULL,
  full_access TINYINT NOT NULL DEFAULT 1, expires_at DATETIME NOT NULL, INDEX(family_id))`,
// Digital/rosto (WebAuthn) para abrir o painel dos pais
`CREATE TABLE IF NOT EXISTS passkeys (
  id VARCHAR(255) PRIMARY KEY, member_id INT NOT NULL, family_id INT NOT NULL, public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0, transports VARCHAR(100) NULL, label VARCHAR(60) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(member_id), INDEX(family_id))`,
// Ordem das tarefas escolhida pelos pais, por filho (arrastar para ordenar)
`CREATE TABLE IF NOT EXISTS task_order (kid_id INT NOT NULL, task_id INT NOT NULL, pos INT NOT NULL, PRIMARY KEY(kid_id, task_id))`,
// Recados dos pais para cada jogador (uma linha por jogador; a criança marca como lido e pode responder rápido)
`CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, kid_id INT NOT NULL, from_name VARCHAR(60) NOT NULL, text VARCHAR(300) NOT NULL,
  reply VARCHAR(60) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, read_at TIMESTAMP NULL, INDEX(kid_id, read_at), INDEX(family_id))`,
// Registro dos avisos enviados (para os pais verem se chegou nos aparelhos)
`CREATE TABLE IF NOT EXISTS push_sent (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, title VARCHAR(120) NOT NULL, ok INT NOT NULL DEFAULT 0, fail INT NOT NULL DEFAULT 0,
  err VARCHAR(80) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(family_id))`,
// Roleta do dia: prêmios que os pais escolhem e o que cada jogador tirou (um giro por dia)
`CREATE TABLE IF NOT EXISTS wheel_prizes (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, label VARCHAR(60) NOT NULL, emoji VARCHAR(16) NULL, sort INT NOT NULL DEFAULT 0, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS wheel_spins (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, kid_id INT NOT NULL, day DATE NOT NULL, label VARCHAR(60) NOT NULL, emoji VARCHAR(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY one_a_day (kid_id, day), INDEX(family_id))`,
// Roletas de correção: os pais montam várias (implicância, desobediência…); cada uso fica registrado
`CREATE TABLE IF NOT EXISTS fix_wheels (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, name VARCHAR(40) NOT NULL, sort INT NOT NULL DEFAULT 0, INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS fix_items (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, wheel_id INT NOT NULL, label VARCHAR(60) NOT NULL, emoji VARCHAR(16) NULL,
  coins INT NOT NULL DEFAULT 0, sort INT NOT NULL DEFAULT 0, INDEX(wheel_id))`,
`CREATE TABLE IF NOT EXISTS fix_spins (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, kid_id INT NOT NULL, wheel_id INT NOT NULL, wheel_name VARCHAR(40) NOT NULL,
  label VARCHAR(60) NULL, emoji VARCHAR(16) NULL, coins INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, spun_at TIMESTAMP NULL,
  INDEX(kid_id), INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS time_runs (
  family_id INT NOT NULL, kid_id INT NOT NULL, reward_id INT NOT NULL, day DATE NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  PRIMARY KEY (kid_id, reward_id), INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(30) NOT NULL, percent INT NOT NULL, max_uses INT NULL, uses INT NOT NULL DEFAULT 0,
  expires DATE NULL, active TINYINT NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY u (code))`,
`CREATE TABLE IF NOT EXISTS parent_devices (
  id INT AUTO_INCREMENT PRIMARY KEY, family_id INT NOT NULL, member_id INT NOT NULL, token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY u (token_hash), INDEX(family_id))`,
`CREATE TABLE IF NOT EXISTS task_runs (
  family_id INT NOT NULL, kid_id INT NOT NULL, task_id INT NOT NULL, day DATE NOT NULL,
  spent INT NOT NULL DEFAULT 0, started_at TIMESTAMP NULL, PRIMARY KEY (kid_id, task_id, day), INDEX(family_id))`,
// Leads das iscas do site (ex.: quadro de tarefas para imprimir). kids/tasks guardam o quadro montado (JSON) para refazer pelo link do e-mail.
`CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(160) NULL, whatsapp VARCHAR(20) NULL,
  source VARCHAR(40) NOT NULL, kids TEXT NULL, tasks TEXT NULL, token CHAR(32) NOT NULL, downloads INT NOT NULL DEFAULT 1,
  consent_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL,
  UNIQUE KEY u (email), UNIQUE KEY t (token))`,
// Fluxos de WhatsApp para os leads: mensagens que saem N dias depois que a pessoa recebeu o material (dia 0).
`CREATE TABLE IF NOT EXISTS wa_flows (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, source VARCHAR(40) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS wa_steps (
  id INT AUTO_INCREMENT PRIMARY KEY, flow_id INT NOT NULL, day INT NOT NULL, body TEXT NOT NULL, INDEX(flow_id))`,
// o que já saiu para cada lead (nunca manda a mesma mensagem duas vezes)
`CREATE TABLE IF NOT EXISTS wa_sends (
  lead_id INT NOT NULL, step_id INT NOT NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (lead_id, step_id), INDEX(step_id))`,
];

// Colunas acrescentadas depois da primeira versão (MySQL 8 não tem ADD COLUMN IF NOT EXISTS)
const COLUMNS = [
  ['families', 'trial_ends', 'DATE NULL'],
  ['families', 'paid_until', 'DATE NULL'],
  ['families', 'plan', "VARCHAR(10) NULL"],          // monthly | annual | free (cortesia)
  ['families', 'onboarded', 'TINYINT NOT NULL DEFAULT 0'],
  ['families', 'last_seen', 'DATE NULL'],
  ['families', 'remind_before', 'INT NOT NULL DEFAULT 10'], // minutos de antecedência do aviso das tarefas com horário
  ['kids', 'auto_approve', 'TINYINT NOT NULL DEFAULT 0'],
  ['tasks', 'sort', 'INT NULL'],                           // ordem da família (aba Tarefas → Todas)
  ['families', 'setup_pending', 'TINYINT NOT NULL DEFAULT 0'], // comprou pela página de vendas e ainda não criou senha e PIN
  ['tasks', 'carry', 'TINYINT NOT NULL DEFAULT 0'],        // dia marcado: se não fizer, passa para o dia seguinte
  ['kids', 'adult', 'TINYINT NOT NULL DEFAULT 0'],         // perfil de jogador de um adulto (sem moedas)
  ['password_resets', 'member_id', 'INT NULL'],
  ['wheel_prizes', 'coins', 'INT NOT NULL DEFAULT 0'],          // prêmio da roleta que já cai como moedas na conta
  ['wheel_spins', 'coins', 'INT NOT NULL DEFAULT 0'],
  ['rewards', 'kid_id', 'INT NULL'],
  ['tasks', 'minutes', 'INT NOT NULL DEFAULT 0'],
  ['payments', 'coupon', 'VARCHAR(30) NULL'],
  ['leads', 'code', 'VARCHAR(12) NULL'],                 // código da mensagem pronta do WhatsApp (GT-XXXX)
  ['leads', 'wa_confirmed_at', 'TIMESTAMP NULL'],        // a pessoa mandou o código pelo WhatsApp (número confirmado)
  ['leads', 'opt_out_at', 'TIMESTAMP NULL'],             // respondeu SAIR              // cupom de desconto usado neste pagamento           // tarefa com cronômetro (ex.: ler 45 min); 0 = sem                        // recompensa só de um filho (NULL = todos)            // redefinição de senha de um responsável convidado   // aprovação automática passou da família para cada filho
];
// Sem teste grátis: quem assina tem garantia de devolução do dinheiro (dias configurados no painel do dono)
const DEFAULTS = { price_monthly: '8.00', price_annual: '47.00', price_plus: '67.00', trial_days: '0', guarantee_days: '14' };

async function migrate() {
  for (const sql of SCHEMA) await pool.query(sql);
  for (const [t, c, def] of COLUMNS) {
    const [[x]] = await pool.query('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [t, c]);
    if (x.n) continue;
    await pool.query(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);
    // quem tinha a aprovação automática ligada para a família continua igual, agora em cada filho
    if (t === 'kids' && c === 'auto_approve') await pool.query('UPDATE kids k JOIN families f ON f.id=k.family_id SET k.auto_approve=f.auto_approve');
  }
  // troca do teste grátis pela garantia: na primeira subida com a garantia, o teste das NOVAS famílias vai a zero
  // (quem já está no teste continua até o fim do prazo)
  const [[hadTrial]] = await pool.query("SELECT 1 x FROM app_settings WHERE k='trial_days'");
  const [[hadG]] = await pool.query("SELECT 1 x FROM app_settings WHERE k='guarantee_days'");
  if (hadTrial && !hadG) await pool.query("UPDATE app_settings SET v='0' WHERE k='trial_days'");
  for (const [k, v] of Object.entries(DEFAULTS)) await pool.query('INSERT IGNORE INTO app_settings (k,v) VALUES (?,?)', [k, v]);
  await pool.query("ALTER TABLE payments MODIFY plan ENUM('monthly','annual','plus') NOT NULL");
  // leads: e-mail virou opcional (a entrega é pelo WhatsApp) e o código é único
  await pool.query('ALTER TABLE leads MODIFY email VARCHAR(160) NULL');
  const [[ci]] = await pool.query("SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='leads' AND INDEX_NAME='c'");
  if (!ci.n) await pool.query('ALTER TABLE leads ADD UNIQUE KEY c (code)');
  // primeiro fluxo: o do quadro de tarefas, com os textos aprovados (nasce pausado; o dono ativa no painel)
  const [[fl]] = await pool.query('SELECT COUNT(*) n FROM wa_flows');
  if (!fl.n) {
    const [r] = await pool.query("INSERT INTO wa_flows (name,source,active) VALUES ('Quadro de tarefas','quadro',0)");
    for (const [day, body] of require('./flows').SEED) await pool.query('INSERT INTO wa_steps (flow_id,day,body) VALUES (?,?,?)', [r.insertId, day, body]);
  }
  // Chaves VAPID das notificações: geradas uma vez e guardadas no banco (dispensa configurar variável)
  if (!(await getSetting('vapid_public'))) {
    const keys = require('web-push').generateVAPIDKeys();
    await pool.query('INSERT IGNORE INTO app_settings (k,v) VALUES (?,?),(?,?)', ['vapid_public', keys.publicKey, 'vapid_private', keys.privateKey]);
  }
  // famílias antigas: ganham o período de teste a partir do cadastro e não passam pelo assistente
  const days = +(await getSetting('trial_days'));
  await pool.query('UPDATE families SET trial_ends=DATE_ADD(DATE(created_at), INTERVAL ? DAY) WHERE trial_ends IS NULL', [days]);
  await pool.query('UPDATE families f SET onboarded=1 WHERE onboarded=0 AND EXISTS (SELECT 1 FROM tasks t WHERE t.family_id=f.id)');
  // toda família tem o responsável principal (o PIN dos pais passa a ser o dele)
  await pool.query(`INSERT INTO members (family_id,name,role,full_access,principal,pin_hash)
    SELECT f.id,'Responsável','Responsável',1,1,f.parent_pin_hash FROM families f
    WHERE NOT EXISTS (SELECT 1 FROM members m WHERE m.family_id=f.id AND m.principal=1)`);
}

async function getSetting(k) {
  const [[r]] = await pool.query('SELECT v FROM app_settings WHERE k=?', [k]);
  return r ? r.v : DEFAULTS[k];
}
async function settings() {
  const [rows] = await pool.query('SELECT k,v FROM app_settings');
  return { ...DEFAULTS, ...Object.fromEntries(rows.map(r => [r.k, r.v])) };
}

// Cria o banco local se não existir (apenas quando usando DB_* e não DATABASE_URL)
async function ensureDatabase() {
  if (process.env.DATABASE_URL) return;
  const name = process.env.DB_NAME || 'gametask';
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '',
  });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
}

module.exports = { pool, migrate, ensureDatabase, getSetting, settings };
