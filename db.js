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
];

// Colunas acrescentadas depois da primeira versão (MySQL 8 não tem ADD COLUMN IF NOT EXISTS)
const COLUMNS = [
  ['families', 'trial_ends', 'DATE NULL'],
  ['families', 'paid_until', 'DATE NULL'],
  ['families', 'plan', "VARCHAR(10) NULL"],          // monthly | annual | free (cortesia)
  ['families', 'onboarded', 'TINYINT NOT NULL DEFAULT 0'],
  ['families', 'last_seen', 'DATE NULL'],
];
const DEFAULTS = { price_monthly: '8.00', price_annual: '47.00', trial_days: '90' };

async function migrate() {
  for (const sql of SCHEMA) await pool.query(sql);
  for (const [t, c, def] of COLUMNS) {
    const [[x]] = await pool.query('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [t, c]);
    if (!x.n) await pool.query(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);
  }
  for (const [k, v] of Object.entries(DEFAULTS)) await pool.query('INSERT IGNORE INTO app_settings (k,v) VALUES (?,?)', [k, v]);
  // famílias antigas: ganham o período de teste a partir do cadastro e não passam pelo assistente
  const days = +(await getSetting('trial_days'));
  await pool.query('UPDATE families SET trial_ends=DATE_ADD(DATE(created_at), INTERVAL ? DAY) WHERE trial_ends IS NULL', [days]);
  await pool.query('UPDATE families f SET onboarded=1 WHERE onboarded=0 AND EXISTS (SELECT 1 FROM tasks t WHERE t.family_id=f.id)');
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
