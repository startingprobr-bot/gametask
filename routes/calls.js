// Ligação da família (voz, WebRTC): só entre aparelhos da mesma família que têm o app Android.
// O servidor só apresenta os dois lados (oferta, resposta e caminhos de rede); a voz vai direto entre os aparelhos
// e só passa pelo servidor de retransmissão (TURN) quando a ligação direta não consegue.
const express = require('express');
const { pool } = require('../db');
const fcm = require('../fcm');

const router = express.Router();
const RING_S = 45; // tempo tocando antes de "não atendeu"

// este aparelho (token do Firebase que o app manda no cabeçalho x-gt-dev)
async function me(req) {
  const t = req.get('x-gt-dev') || '';
  if (!t) return null;
  const [[d]] = await pool.query('SELECT id,label,calls FROM fcm_tokens WHERE token=? AND family_id=?', [t, req.fid]);
  return d || null;
}
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { console.error('ligação', e.message); res.status(500).json({ error: 'Erro interno' }); });

// Servidores para achar o caminho entre os aparelhos: STUN (grátis) e, se configurado, TURN (retransmissão)
router.get('/calls/ice', (req, res) => {
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) ice.push({ urls: process.env.TURN_URL.split(',').map(s => s.trim()), username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
  res.json(ice);
});

// Para quem dá para ligar: os outros aparelhos da família com o app
router.get('/calls/targets', wrap(async (req, res) => {
  const mine = await me(req);
  const [rows] = await pool.query('SELECT id,label,calls FROM fcm_tokens WHERE family_id=? ORDER BY id', [req.fid]);
  res.json(rows.filter(r => !mine || r.id !== mine.id).map(r => ({ id: r.id, label: r.label || 'Aparelho', calls: !!r.calls })));
}));

// Começar a ligação: avisa os aparelhos escolhidos (tocam como ligação, mesmo com o app fechado)
router.post('/calls', wrap(async (req, res) => {
  const mine = await me(req);
  if (!mine) return res.status(400).json({ error: 'A ligação funciona no app Android do GameTask' });
  const want = (Array.isArray(req.body.to) ? req.body.to : []).map(Number).filter(Boolean);
  const [targets] = want.length ? await pool.query('SELECT id,token FROM fcm_tokens WHERE family_id=? AND id IN (?) AND id<>?', [req.fid, want, mine.id]) : [[]];
  if (!targets.length) return res.status(400).json({ error: 'Escolha para quem ligar' });
  const from = String(req.body.from || mine.label || 'GameTask').trim().slice(0, 60);
  const [r] = await pool.query('INSERT INTO calls (family_id,from_dev,from_label,to_ids) VALUES (?,?,?,?)', [req.fid, mine.id, from, targets.map(t => t.id).join(',')]);
  await Promise.all(targets.map(t => fcm.send(t.token, { type: 'call', call: r.insertId, title: `Ligação de ${from}`, body: 'Toque em Atender', tag: 'call' + r.insertId, icon: String(req.body.icon || '') })));
  res.json({ id: r.insertId });
}));

// Ligações tocando para este aparelho (o app aberto confere a cada poucos segundos)
router.get('/calls/incoming', wrap(async (req, res) => {
  const mine = await me(req);
  if (!mine) return res.json([]);
  const [rows] = await pool.query(`SELECT id,from_label,to_ids FROM calls WHERE family_id=? AND status='ringing' AND created_at > DATE_SUB(NOW(), INTERVAL ${RING_S} SECOND) ORDER BY id DESC LIMIT 3`, [req.fid]);
  res.json(rows.filter(c => c.to_ids.split(',').includes(String(mine.id))).map(c => ({ id: c.id, from: c.from_label })));
}));

async function own(req) {
  const [[c]] = await pool.query('SELECT * FROM calls WHERE id=? AND family_id=?', [req.params.id, req.fid]);
  if (c && c.status === 'ringing' && Date.now() - new Date(c.created_at).getTime() > RING_S * 1000) {
    await pool.query("UPDATE calls SET status='missed',ended_at=NOW() WHERE id=? AND status='ringing'", [c.id]); c.status = 'missed';
  }
  return c;
}
router.get('/calls/:id', wrap(async (req, res) => {
  const c = await own(req); if (!c) return res.status(404).json({ error: 'Ligação não encontrada' });
  res.json({ id: c.id, status: c.status, from: c.from_label });
}));
router.post('/calls/:id/accept', wrap(async (req, res) => {
  const c = await own(req); if (!c) return res.status(404).json({ error: 'Ligação não encontrada' });
  const mine = await me(req);
  const [r] = await pool.query("UPDATE calls SET status='accepted',answered_by=?,answered_at=NOW() WHERE id=? AND status='ringing'", [mine?.id || null, c.id]);
  if (!r.affectedRows) return res.status(409).json({ error: c.status === 'accepted' ? 'Outro aparelho já atendeu' : 'A ligação já terminou' });
  res.json({ ok: true, from: c.from_label });
}));
router.post('/calls/:id/end', wrap(async (req, res) => {
  const c = await own(req); if (!c) return res.status(404).json({ error: 'Ligação não encontrada' });
  const st = req.body.reason === 'declined' && c.status === 'ringing' ? 'declined' : 'ended';
  await pool.query("UPDATE calls SET status=?,ended_at=NOW() WHERE id=? AND status IN ('ringing','accepted')", [st, c.id]);
  res.json({ ok: true });
}));
// Troca de oferta, resposta e caminhos de rede entre os dois lados
router.post('/calls/:id/signal', express.json({ limit: '200kb' }), wrap(async (req, res) => {
  const c = await own(req); if (!c) return res.status(404).json({ error: 'Ligação não encontrada' });
  const side = req.body.side === 'callee' ? 'callee' : 'caller', kind = ['offer', 'answer', 'ice'].includes(req.body.kind) ? req.body.kind : null;
  if (!kind) return res.status(400).json({ error: 'Sinal inválido' });
  await pool.query('INSERT INTO call_signals (call_id,side,kind,body) VALUES (?,?,?,?)', [c.id, side, kind, JSON.stringify(req.body.body ?? null).slice(0, 150000)]);
  res.json({ ok: true });
}));
router.get('/calls/:id/signals', wrap(async (req, res) => {
  const c = await own(req); if (!c) return res.status(404).json({ error: 'Ligação não encontrada' });
  const other = req.query.side === 'callee' ? 'caller' : 'callee';
  const [rows] = await pool.query('SELECT id,kind,body FROM call_signals WHERE call_id=? AND side=? AND id>? ORDER BY id', [c.id, other, +req.query.after || 0]);
  res.json({ status: c.status, signals: rows.map(r => ({ id: r.id, kind: r.kind, body: JSON.parse(r.body) })) });
}));

module.exports = router;
