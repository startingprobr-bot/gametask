// Fluxos de WhatsApp: mensagens automáticas para os leads, N dias depois que receberam o material (dia 0).
// Os textos ficam no banco e o dono edita no painel (aba Fluxos). Este arquivo só confere quem está no dia e envia.
const { pool, settings } = require('./db');
const wapp = require('./whatsapp');

// textos aprovados do fluxo do quadro (usados só para criar o primeiro fluxo)
const SEED = [
  [3, `Oi, {nome}! Passando pra saber: o quadro já está colado na parede ou virou papel de desenho? 😄

Me conta com um número:
1️⃣ Está funcionando
2️⃣ Mais ou menos
3️⃣ Ninguém olha pra ele`],
  [7, `{nome}, a real sobre quadro de papel: toda semana é imprimir de novo. Plastificar ajuda… até a caneta manchar e virar um borrão. 😅

E depois de umas semanas a criança cansa, porque o papel não responde nada.

Fiz o GameTask pra isso. A rotina fica no celular ou tablet: a criança vê o dia dela, marca a missão, ganha moedas e vê a meta chegando. O prêmio quem escolhe são vocês: um passeio, um sorvete, a mesada…

E quando ela cumpre tudo, gira a roleta 🎡. A rotina dá segurança, e a roleta traz uma surpresa boa, dentro das regras da casa.

Tem garantia de {garantia} dias: se não servir pra sua casa, o dinheiro volta.

Dá uma olhada: {link}`],
];

// origens de lead que podem ter fluxo (cada isca nova do site entra aqui)
const SOURCES = { quadro: 'Quadro de tarefas' };
const VARS = ['nome', 'criancas', 'codigo', 'link', 'link_quadro', 'garantia'];

const site = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const who = (kids) => kids.length > 1 ? kids.slice(0, -1).join(', ') + ' e ' + kids.at(-1) : kids[0] || 'as crianças';
async function render(body, l) {
  const kids = (() => { try { return JSON.parse(l.kids || '[]'); } catch { return []; } })();
  const v = { nome: String(l.name || '').split(' ')[0], criancas: who(kids), codigo: l.code || '', link: site(),
    link_quadro: site() + '/quadro-de-tarefas-infantil', garantia: String((await settings()).guarantee_days || 0) };
  return body.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
}

// só em horário comercial de Brasília (segunda a sábado, 9h às 20h): mensagem de madrugada queima o chip
function openHours(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return p.weekday !== 'Sun' && +p.hour >= 9 && +p.hour < 20;
}

const GAP = () => +(process.env.WA_FLOW_GAP_MS ?? 8000 + Math.random() * 12000); // pausa entre uma pessoa e outra
let running = false;
async function tick() {
  if (running || !wapp.on() || !(process.env.WA_FLOW_ANYTIME || openHours())) return;
  running = true;
  try {
    // quem está no dia: confirmou pelo WhatsApp há N dias (com até 3 dias de folga; mais atrasado que isso, pula a mensagem),
    // não saiu e ainda não recebeu esta mensagem. Uma mensagem por pessoa por rodada.
    const [due] = await pool.query(`SELECT l.id lead_id, l.name, l.kids, l.code, l.whatsapp, s.id step_id, s.body
      FROM wa_steps s JOIN wa_flows f ON f.id=s.flow_id AND f.active=1
      JOIN leads l ON l.source=f.source AND l.wa_confirmed_at IS NOT NULL AND l.opt_out_at IS NULL AND l.whatsapp IS NOT NULL
      LEFT JOIN wa_sends w ON w.lead_id=l.id AND w.step_id=s.id
      WHERE w.lead_id IS NULL AND l.wa_confirmed_at <= NOW() - INTERVAL s.day DAY AND l.wa_confirmed_at > NOW() - INTERVAL (s.day + 3) DAY
        AND NOT EXISTS (SELECT 1 FROM families fa WHERE l.email IS NOT NULL AND fa.email=l.email)
      ORDER BY l.wa_confirmed_at, s.day LIMIT 30`);
    const seen = new Set();
    for (const d of due) {
      if (seen.has(d.lead_id)) continue;
      seen.add(d.lead_id);
      const [r] = await pool.query('INSERT IGNORE INTO wa_sends (lead_id,step_id) VALUES (?,?)', [d.lead_id, d.step_id]);
      if (!r.affectedRows) continue; // outro processo já mandou
      try { await wapp.sendText(d.whatsapp, await render(d.body, d)); }
      catch (e) { console.error('fluxo WhatsApp', d.lead_id, e.message); await pool.query('DELETE FROM wa_sends WHERE lead_id=? AND step_id=?', [d.lead_id, d.step_id]); }
      await new Promise(res => setTimeout(res, GAP()));
    }
  } finally { running = false; }
}

function start() {
  const run = () => tick().catch(e => console.error('fluxos', e.message));
  setTimeout(run, 20000); setInterval(run, +(process.env.WA_FLOW_EVERY_MS || 5 * 60000));
}

module.exports = { SEED, SOURCES, VARS, render, tick, start, openHours };
