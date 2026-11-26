/* GameTask – front-end (vanilla JS, sem build) */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('pt-BR');
const brl = (n) => (+n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dmy = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const app = $('#app');
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Ícones 3D (Fluent Emoji, MIT) ----------
const AVATARS = ['unicorn', 'fox', 'robot', 'dragon', 'lion', 'panda', 'frog', 'tiger', 'dog', 'cat', 'owl', 'penguin', 'octopus', 'alien', 'koala', 'butterfly', 'dolphin'];
const TASK_ICONS = ['star', 'bed', 'tooth', 'toothbrush', 'shower', 'shirt', 'bowl', 'plate', 'sandwich', 'apple', 'spaghetti', 'broom', 'basket', 'bucket', 'trash', 'socks', 'house', 'books', 'openbook', 'pray', 'pencil', 'backpack', 'plant', 'paw', 'teddy', 'karate', 'swim', 'goggles', 'basketball', 'music', 'church', 'soap', 'sun', 'moon',
  'sponge', 'bathtub', 'toilet', 'paper', 'lotion', 'wastebasket', 'recycle', 'jeans', 'dress', 'coat', 'cap', 'glasses', 'door', 'window', 'couch', 'bulb',
  'cooking', 'milk', 'cup', 'bread', 'egg', 'banana', 'carrot', 'broccoli', 'water', 'baby', 'pill', 'bandage', 'alarm', 'bell', 'sleep',
  'notebook', 'memo', 'crayon', 'palette', 'scissors', 'ruler', 'abacus', 'globe', 'microscope', 'laptop', 'nophone',
  'bike', 'skate', 'shoe', 'tennis', 'pingpong', 'volleyball', 'soccer', 'guitar', 'piano', 'violin', 'drum', 'headphone', 'camera',
  'seedling', 'flower', 'tree', 'fish', 'bone', 'dog', 'cat', 'package', 'cart', 'bag', 'car', 'wrench', 'hammer', 'toolbox', 'money',
  'heart', 'hug', 'puzzle', 'dice', 'kite', 'balloon', 'candle', 'umbrella', 'tent', 'beach'];
const REWARD_ICONS = ['game', 'tv', 'phone', 'movie', 'ferris', 'coaster', 'icecream', 'pizza', 'soccer', 'gift', 'trophy', 'crown', 'bike', 'balloon', 'kite', 'dice', 'puzzle', 'camera', 'headphone', 'beach', 'tent', 'money', 'heart', 'hug', 'cup', 'bag', 'car'];
const COLORS = ['#ff4fae', '#ff8a1f', '#3bd15f', '#8b5bff', '#19c3c9', '#ff4d5e', '#f5b800'];
const KNOWN = new Set([...AVATARS, ...TASK_ICONS, ...REWARD_ICONS, 'coin', 'clock', 'stopwatch', 'lock', 'check', 'glow', 'party', 'fire', 'hourglass', 'gem', 'moneybag', 'chart', 'gear', 'people', 'clipboard', 'calendar', 'sparkles', 'key', 'cross', 'chest', 'rocket', 'shield', 'card', 'laptop']);
const LEGACY = { '🦊': 'fox', '🐱': 'cat', '🐶': 'dog', '🦄': 'unicorn', '🐉': 'dragon', '🤖': 'robot', '👾': 'alien', '🐼': 'panda', '🦁': 'lion', '🐸': 'frog', '🧚': 'butterfly', '⭐': 'star', '🛏️': 'bed', '🦷': 'tooth', '🍽️': 'plate', '🧹': 'broom', '📚': 'books', '🐕': 'paw', '🧺': 'basket', '🗑️': 'trash', '🥋': 'karate', '🏊': 'swim', '⛪': 'church', '🎒': 'backpack', '🚿': 'shower', '🪥': 'toothbrush', '🌱': 'plant', '🎮': 'game', '📺': 'tv', '📱': 'phone', '🎡': 'ferris', '🍦': 'icecream', '🎬': 'movie', '🏆': 'trophy', '🍕': 'pizza', '⚽': 'soccer', '🧸': 'teddy' };
const slug = (v, fb = 'star') => KNOWN.has(v) ? v : (LEGACY[v] || fb);
const im = (v, cls = '', fb) => `<img src="/img/3d/${slug(v, fb)}.png" alt="" class="${cls}" decoding="async">`;
const SVG = {
  mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 001 1h2l7 4V5L6 9H4a1 1 0 00-1 1z" fill="currentColor" fill-opacity=".15"/><path d="M16.5 8.5a5 5 0 010 7"/><path d="M19.5 6a8.5 8.5 0 010 12"/><path d="M7 15l1.2 4.5"/></svg>',
  finger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11v3a8 8 0 01-1.3 4.4"/><path d="M8.6 13a14 14 0 01-.7 4.5"/><path d="M15.5 12.5c0 2.5-.3 4.8-1 7"/><path d="M5.4 8.6A7.5 7.5 0 0119.5 12c0 2 0 4-.4 6"/><path d="M4.5 13.5c.3-1 .5-2 .5-3"/><path d="M8.5 9.6A4 4 0 0112 8a4 4 0 014 4"/><path d="M7.8 4.8A10 10 0 0121 9.5"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.9"/><circle cx="15" cy="6" r="1.9"/><circle cx="9" cy="12" r="1.9"/><circle cx="15" cy="12" r="1.9"/><circle cx="9" cy="18" r="1.9"/><circle cx="15" cy="18" r="1.9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
};

// ---------- API ----------
async function api(method, url, body) {
  const pdev = PAINEL && store.get('gt-pdev');
  let r;
  try { r = await fetch('/api' + url, { method, headers: { 'content-type': 'application/json', ...(pdev ? { 'x-parent-device': pdev } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Sem conexão com o GameTask. Confira a internet e tente de novo.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/auth/')) { location.hash = '#/login'; throw new Error(d.error || 'Sessão expirada'); }
  if (r.status === 402) { if (location.hash !== '#/assinar') location.hash = '#/assinar'; throw Object.assign(new Error(d.error), { silent: true }); }
  if (!r.ok) throw Object.assign(new Error(d.error || 'Algo deu errado. Tente de novo.'), { code: d.code, status: r.status });
  return d;
}
function toast(msg, bad) {
  const d = document.createElement('div'); d.textContent = msg; if (bad) d.className = 'bad';
  $('#toast').append(d); setTimeout(() => d.remove(), 2800);
}
// erro de programa (em inglês) vira uma frase simples; o detalhe fica no console
const plainErr = (e) => e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError ? (console.error(e), 'Algo deu errado. Toque de novo.') : e.message;
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (!e.silent) { toast(plainErr(e), true); sfx.bad(); } } };

// ---------- Som ----------
let actx; let muted = store.get('gt-mute') === '1';
function tone(notes, type = 'triangle', vol = .09, force) {
  if (muted && !force) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    let t = actx.currentTime;
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .02); t += d * .7;
    }
  } catch {}
}
const sfx = {
  tap: () => tone([[660, .06]], 'sine', .06),
  done: () => tone([[523, .1], [784, .1], [1047, .22]]),
  coin: () => tone([[1318, .06], [1975, .18]], 'square', .04),
  win: () => tone([[523, .14], [659, .14], [784, .14], [1047, .14], [1318, .4]]),
  bad: () => tone([[220, .18], [180, .25]], 'sawtooth', .04),
  ring: () => tone([[988, .12], [784, .12], [988, .12], [784, .12], [1175, .3]], 'triangle', .09),
  fix: () => tone([[392, .2], [330, .2], [262, .45]], 'triangle', .09),
};
function soundBtn() {
  return `<button class="btn ghost round" id="snd" aria-label="${muted ? 'Ligar som' : 'Desligar som'}">${muted ? SVG.off : SVG.on}</button>`;
}
function wireSound() {
  const b = $('#snd'); if (!b) return;
  b.onclick = () => { muted = !muted; store.set('gt-mute', muted ? '1' : '0'); b.innerHTML = muted ? SVG.off : SVG.on; b.setAttribute('aria-label', muted ? 'Ligar som' : 'Desligar som'); sfx.tap(); };
}

// ---------- Voz: lê em voz alta para quem ainda não sabe ler ----------
let ptVoice;
const pickVoice = () => { const v = speechSynthesis.getVoices(); ptVoice = v.find(x => /pt[-_]BR/i.test(x.lang)) || v.find(x => /^pt/i.test(x.lang)) || null; };
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
// fala sem o navegador ter voz (no app Android usa a voz do próprio Android)
const nativeVoice = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.GtAlarm;
const hush = () => { try { window.speechSynthesis?.cancel(); } catch {} try { nativeVoice()?.stopSpeak(); } catch {} };
function say(text) {
  if (text && nativeVoice()) { nativeVoice().speak({ text }).catch(() => {}); return; }
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = .92; u.pitch = 1.1; if (ptVoice) u.voice = ptVoice;
    speechSynthesis.speak(u);
  } catch {}
}

// ---------- Cronômetro do tempo de tela ----------
// clocks: cronômetros ligados de qualquer jogador. Quando um zera, para no servidor e o alarme toca até alguém desligar.
const clocks = new Map(), rang = new Map();
let refreshView = null, wakeLock = null;
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const running = (t) => t.run !== null && t.run !== undefined;
function syncClocks(kid, list, kind = '') {
  if (typeof syncAlarmsSoon === 'function') syncAlarmsSoon();
  for (const [k, c] of clocks) if (c.kid === kid.id && c.kind === kind) clocks.delete(k);
  for (const x of list || []) {
    if (x.ended) alarm(kid, x, kind);
    if (running(x)) clocks.set(`${kid.id}:${kind}${x.id}`, { kid: kid.id, name: kid.name, id: x.id, kind, title: x.title, ends: Date.now() + (x.left * 60 - x.run) * 1000,
      url: kind ? `/kids/${kid.id}/task-timer/${x.id}` : `/kids/${kid.id}/timer/${x.id}` });
  }
}
const clockLeft = (kidId, x, kind = '') => { const c = clocks.get(`${kidId}:${kind}${x.id}`); return c ? (c.ends - Date.now()) / 1000 : x.left * 60; };
const taskClocks = (tasks) => tasks.filter(x => x.timer).map(x => ({ id: x.id, title: x.title, ...x.timer }));
setInterval(() => {
  for (const [k, c] of clocks) {
    const s = (c.ends - Date.now()) / 1000;
    $$(`[data-clock="${k}"]`).forEach(e => { e.textContent = mmss(s); });
    if (s > 0) continue;
    clocks.delete(k);
    api('POST', c.url, { action: 'pause' }).catch(() => {}).finally(() => refreshView?.());
    alarm({ id: c.kid, name: c.name }, c, c.kind);
  }
  // tela acesa enquanto algum cronômetro corre (senão o tablet dorme e o alarme não toca)
  if (clocks.size && !wakeLock && document.visibilityState === 'visible' && navigator.wakeLock) { wakeLock = 'wait'; navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.onrelease = () => { wakeLock = null; }; }).catch(() => { wakeLock = null; }); }
  if (!clocks.size && wakeLock && wakeLock !== 'wait') { wakeLock.release().catch(() => {}); wakeLock = null; }
}, 250);
function alarm(kid, x, kind = '') {
  const key = `${kid.id}:${kind}${x.id}`;
  if (Date.now() - (rang.get(key) || 0) < 120000) return;
  rang.set(key, Date.now());
  const text = `O tempo de ${x.title} de ${kid.name} acabou!`;
  const bg = document.createElement('div'); bg.className = 'alarm-bg' + (kind ? ' good' : ''); bg.setAttribute('role', 'alertdialog'); bg.setAttribute('aria-label', text);
  bg.innerHTML = `<div class="alarm-card">${im('alarm', 'alarm-ic')}<h2 class="d stroke">${kind ? 'Missão cumprida!' : 'Acabou o tempo!'}</h2><p>${esc(text)}</p><button class="btn big" id="alarmOff">Desligar</button></div>`;
  document.body.append(bg);
  const ring = () => { tone([[880, .28], [660, .28], [880, .28], [660, .28], [880, .28], [660, .45]], 'square', .3, true); navigator.vibrate?.([400, 200, 400, 200, 400]); setTimeout(() => bg.isConnected && say(text), 1500); };
  ring(); const iv = setInterval(ring, 6000);
  const off = $('#alarmOff', bg); off.focus();
  off.onclick = () => { clearInterval(iv); hush(); bg.remove(); };
}

// ---------- Efeitos ----------
function sparks(x, y, colors = ['#ffd21f', '#ff4fae', '#3bd15f', '#4aa8ff', '#fff']) {
  if (reduced) return;
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('i'); s.className = 'spark';
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = colors[i % colors.length];
    document.body.append(s);
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    s.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 40}px)) scale(.4) rotate(${Math.random() * 540}deg)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => s.remove();
  }
}
// moedas voam de um ponto até o contador
function flyTo(from, target, icon, n = 5) {
  const t = target?.getBoundingClientRect(); if (!t) return Promise.resolve();
  if (reduced) return Promise.resolve();
  const tx = t.left + 10, ty = t.top + t.height / 2;
  return Promise.all(Array.from({ length: n }, (_, i) => new Promise(res => {
    const c = document.createElement('img'); c.src = `/img/3d/${icon}.png`; c.className = 'fx'; c.alt = '';
    c.style.left = from.x - 22 + 'px'; c.style.top = from.y - 22 + 'px'; document.body.append(c);
    const dx = tx - from.x, dy = ty - from.y, lift = -80 - Math.random() * 60, spread = (i - n / 2) * 18;
    c.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 0 },
      { transform: `translate(${spread}px,${lift}px) scale(1.15)`, opacity: 1, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: 1 }],
      { duration: 900, delay: i * 70, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'both' }).onfinish = () => { c.remove(); sfx.coin(); res(); };
  })));
}
function countUp(el, from, to) {
  if (!el || from === to) { if (el) el.textContent = num(to); return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = num(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  el.closest('.pill')?.classList.remove('bump'); void el.offsetWidth; el.closest('.pill')?.classList.add('bump');
}
// ---------- Roletas (do dia e de correção) ----------
const WHEEL_COLS = { bonus: ['#ff4fae', '#ffd21f', '#3bd15f', '#4aa8ff', '#8b5bff', '#ff8a1f'], fix: ['#ff8a1f', '#6a3cf0', '#2bb5a8', '#ff4d5e', '#4aa8ff', '#f2b705'] };
function wheelSvg(prizes, kind = 'bonus') {
  const n = prizes.length, cols = WHEEL_COLS[kind];
  const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return [(150 + r * Math.cos(t)).toFixed(2), (150 + r * Math.sin(t)).toFixed(2)]; };
  const fs = n > 8 ? 12 : 15;
  return `<svg viewBox="0 0 300 300" aria-hidden="true">${prizes.map((p, i) => {
    const a0 = i * 360 / n, a1 = (i + 1) * 360 / n, [x0, y0] = pt(a0, 150), [x1, y1] = pt(a1, 150);
    const col = cols[i === n - 1 && i % cols.length === 0 && n > 1 ? 2 : i % cols.length];
    const lab = p.label.length > 18 ? p.label.slice(0, 17) + '…' : p.label, size = Math.max(9, Math.min(fs, (p.emoji ? 98 : 124) / (lab.length * .56)));
    return `<path d="M150 150 L${x0} ${y0} A150 150 0 0 1 ${x1} ${y1} Z" fill="${col}" stroke="#0d1b4c" stroke-width="3"/>
      <g transform="rotate(${(a0 + a1) / 2 - 90} 150 150)"><text x="${p.emoji ? 262 : 290}" y="150" text-anchor="end" dominant-baseline="central" font-size="${size.toFixed(1)}" fill="#fff" stroke="#0d1b4c" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">${esc(lab)}</text>
      ${p.emoji ? `<text x="292" y="150" text-anchor="end" dominant-baseline="central" font-size="${fs + 7}">${esc(p.emoji)}</text>` : ''}</g>`;
  }).join('')}</svg>`;
}
// Chuva de moedas com o tilintar sem parar: para prêmio grande (ex.: 50 moedas)
function coinRain(n) {
  const dur = reduced ? 900 : Math.min(6000, 2600 + n * 40);
  const ding = setInterval(() => sfx.coin(), 95); setTimeout(() => clearInterval(ding), dur);
  navigator.vibrate?.([60, 60, 60, 60, 60]);
  if (reduced) return;
  const total = Math.min(70, Math.max(16, Math.round(n * 1.2)));
  for (let k = 0; k < total; k++) setTimeout(() => {
    const c = document.createElement('img'); c.src = '/img/3d/coin.png'; c.className = 'fx rain'; c.alt = '';
    const size = 34 + Math.random() * 26; c.style.width = c.style.height = size + 'px';
    c.style.left = Math.random() * (innerWidth - size) + 'px'; c.style.top = -size - 10 + 'px'; document.body.append(c);
    const drift = (Math.random() - .5) * 140, rot = (Math.random() - .5) * 900;
    c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${drift}px,${innerHeight + size + 40}px) rotate(${rot}deg)` }],
      { duration: 1300 + Math.random() * 1100, easing: 'cubic-bezier(.45,0,.85,.6)', fill: 'both' }).onfinish = () => c.remove();
  }, k * (dur - 1200) / total);
}
// Roleta do dia (bonificação) de um jogador
const bonusWheel = (kidId, w) => ({ kind: 'bonus', prizes: w.prizes, spin: () => api('POST', `/kids/${kidId}/spin`, {}) });
// Roleta de correção: f = { name, prizes }
// Roleta extra (livre): bônus, sorteio ou diversão. o.sub e o.won podem trocar os textos
const freeWheel = (f, spin, sub, won) => ({ kind: 'free', prizes: f.prizes, spin, title: f.name, sub: sub || 'Gire a roleta e veja o que cai!', won });
const fixWheel = (f, spin, who) => ({ kind: 'fix', prizes: f.prizes, spin, title: f.name, sub: who ? `Vez de ${who} girar a roleta da correção.` : 'Gire a roleta e cumpra o que cair.' });
// Abre a roleta. o = { kind:'bonus'|'fix', prizes, spin() -> {index,prize,prizes}, done, celebrate, title, sub }
function openWheel(o) {
  const fix = o.kind === 'fix', free = o.kind === 'free';
  const bg = document.createElement('div'); bg.className = 'sheet-bg wheel-bg' + (fix ? ' fix' : '');
  const bulbs = Array.from({ length: 16 }, (_, i) => `<i class="bulb" style="--a:${i * 22.5}deg"></i>`).join('');
  const title = free ? esc(o.title || 'Roleta extra') : fix ? esc(o.title || 'Correção') : o.celebrate ? 'Dia completo!' : 'Roleta do dia';
  const sub = free ? esc(o.sub || '') : fix ? esc(o.sub || '') : o.celebrate ? 'Você fez todas as missões. Gire a roleta e ganhe uma surpresa!' : 'Toque em girar e descubra a sua surpresa!';
  bg.innerHTML = `<div class="wheel-rays" aria-hidden="true"></div><div class="wheel-card" role="dialog" aria-label="${fix ? 'Roleta da correção' : free ? 'Roleta extra' : 'Roleta do dia'}">
    ${fix ? `<p class="wheel-tag">${im('shield')}Roleta da correção</p>` : free ? `<p class="wheel-tag">${im('party')}Roleta extra</p>` : ''}<h2 class="d stroke">${title}</h2><p class="wheel-sub">${sub}</p>
    <div class="wheel">${bulbs}<i class="pin"></i><div class="disc">${wheelSvg(o.prizes, fix ? 'fix' : 'bonus')}</div><b class="hub"></b></div>
    <div class="wheel-res" aria-live="polite"></div><button class="btn ${fix ? '' : 'green'} big" id="spin">Girar!</button></div>`;
  document.body.append(bg);
  const btn = $('#spin', bg), disc = $('.disc', bg), res = $('.wheel-res', bg), wheel = $('.wheel', bg);
  const close = () => { bg.remove(); o.done?.(); };
  if (o.celebrate) { sfx.win(); setTimeout(() => { const b = wheel.getBoundingClientRect(); sparks(b.left + b.width / 2, b.top + 20); }, 700); }
  if (fix) sfx.fix();
  btn.focus();
  btn.onclick = async () => {
    btn.disabled = true; sfx.tap(); wheel.classList.add('go');
    let r; try { r = await o.spin(); } catch (e) { toast(e.message, true); sfx.bad(); return close(); }
    const n = r.prizes.length, seg = 360 / n, c = (r.index + .5) * seg;
    // gira bastante e vai freando devagar; o "tic" da setinha também desacelera
    const ms = reduced ? 50 : fix ? 7000 : 9500, final = 360 * (fix ? 9 : 12) - c + (Math.random() - .5) * seg * .6, t0 = performance.now();
    let ticks = 0; const tick = () => { const p = (performance.now() - t0) / ms; if (reduced || p >= .97) return; sfx.tap(); ticks = setTimeout(tick, 90 + 520 * p * p); };
    tick();
    disc.style.transition = `transform ${ms}ms cubic-bezier(.15,.55,.1,1)`; void disc.offsetWidth; disc.style.transform = `rotate(${final}deg)`;
    setTimeout(() => {
      clearTimeout(ticks); wheel.classList.replace('go', 'won');
      const p = r.prize, coins = +p.coins || 0;
      if (fix) {
        sfx.fix();
        res.innerHTML = `<div>Sua correção é<b>${esc(p.emoji || '')} ${esc(p.label)}</b>${coins ? `<span class="coin-lost">${im('coin')}−${num(coins)} moedas</span>` : ''}</div>`;
        say(`Sua correção é: ${p.label}${coins ? `. Você perde ${coins} moedas` : ''}`);
        btn.textContent = 'Combinado'; btn.disabled = false; btn.onclick = close; btn.focus();
        return;
      }
      sfx.win();
      res.innerHTML = `<div>${esc(o.won || 'Você ganhou')}<b>${esc(p.emoji || '')} ${esc(p.label)}</b>${coins ? `<span class="coin-won">${im('coin')}+${num(coins)} moedas na sua conta!</span>` : ''}</div>`;
      const b = disc.getBoundingClientRect();
      [0, 350, 700].forEach((t, i) => setTimeout(() => sparks(b.left + b.width * [.5, .2, .8][i], b.top + b.height * [.1, .4, .4][i]), t));
      if (coins) setTimeout(() => coinRain(coins), 500);
      setTimeout(() => say(`${o.won || 'Você ganhou'} ${p.label}!`), coins ? 300 : 900);
      btn.textContent = 'Oba!'; btn.disabled = false; btn.onclick = close; btn.focus();
    }, ms + 150);
  };
}

// Recado dos pais: aparece por cima da tela do jogador, toca e pede uma resposta rápida
function showMessage(kidId, m, done) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg msg-bg urgent';
  const to = m.to_name && m.to_name !== 'Todos' ? ` para <b>${esc(m.to_name)}</b>` : m.to_name ? ' para <b>todos</b>' : '';
  bg.innerHTML = `<div class="msg-card" role="alertdialog" aria-label="Recado de ${esc(m.from_name)}">
    <div class="msg-ic">${SVG.mega}</div><p class="msg-from">Recado de <b>${esc(m.from_name)}</b>${to}</p>
    <p class="msg-text">${esc(m.text)}</p>
    <button type="button" class="btn ghost sm say-msg">${SVG.on}Ouvir de novo</button>
    <div class="msg-replies">${['Ok!', 'Já vou!', 'Preciso de ajuda'].map((r, i) => `<button class="btn ${i ? 'ghost' : 'green'}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>`;
  document.body.append(bg);
  // som alto mesmo com o jogo no mudo, até alguém responder
  const ring = () => { tone([[1175, .14], [880, .14], [1175, .14], [880, .14], [1175, .14], [880, .3]], 'square', .28, true); navigator.vibrate?.([500, 150, 500, 150, 500]); };
  ring(); const again = setInterval(ring, 2600);
  const read = () => say(`Recado de ${m.from_name}: ${m.text}`);
  setTimeout(read, 1600);
  bg.querySelector('.say-msg').onclick = read;
  $$('[data-r]', bg).forEach(b => b.onclick = guard(async () => {
    clearInterval(again); hush(); $$('[data-r]', bg).forEach(x => { x.disabled = true; });
    try { await api('POST', `/messages/${m.id}`, { reply: b.dataset.r, kid_id: kidId }); }
    finally { sfx.done(); bg.remove(); done?.(); }
  }));
}
// Procura recados novos a cada 10 s em qualquer tela das crianças (seleção de jogador ou tela de um filho)
let msgOpen = false, fcmTok = null, pushEndpoint = null;
async function checkMessages() {
  if (msgOpen || PAINEL || !ME.family || !ME.access?.active || document.visibilityState !== 'visible') return;
  const [, a, b] = location.hash.split('/');
  if (a && a !== 'kid') return;
  try {
    const q = new URLSearchParams();
    if (NATIVE && !fcmTok) { try { fcmTok = (await GtAlarm.fcmToken()).token; } catch {} }
    if (fcmTok) q.set('t', fcmTok);
    if (!NATIVE && pushEndpoint === null) { pushEndpoint = ''; try { pushEndpoint = (await mySub())?.endpoint || ''; } catch {} }
    if (pushEndpoint) q.set('e', pushEndpoint);
    const list = await api('GET', '/messages?' + q);
    if (!list.length || msgOpen) return;
    msgOpen = true;
    showMessage(a === 'kid' ? +b || null : null, list[0], () => { msgOpen = false; refreshView?.(); setTimeout(checkMessages, 400); });
  } catch {}
}
setInterval(checkMessages, 10000);

// ---------- App Android: alarme de despertador no próprio celular ----------
// O site manda a agenda dos próximos 7 dias (avisos, missões com horário e cronômetros ligados aqui);
// o app marca cada um como despertador, que toca mesmo no silencioso e sem internet.
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const GtAlarm = NATIVE ? window.Capacitor?.Plugins?.GtAlarm : null;
let alarmSig = '', alarmWait = 0;
// nome deste aparelho (ele escolhe em Ajustes); sem nome, "Tablet" ou "Celular" pelo tamanho da tela
const devLabel = () => store.get('gt-dev-label') || (Math.min(screen.width, screen.height) >= 600 ? 'Tablet' : 'Celular');
// registra o celular no Firebase uma vez por abertura (e quando muda alguma opção dele)
let fcmDone = '';
async function registerFcm() {
  if (!GtAlarm?.fcmToken || !ME.family) return null;
  const approvals = store.get('gt-fcm-appr') !== '0', msgs = store.get('gt-dev-msgs') !== '0', alarms = store.get('gt-dev-alarms') !== '0', label = devLabel();
  try { const { token } = await GtAlarm.fcmToken(); fcmTok = token; const k = [token, approvals, msgs, alarms, label].join('|'); if (k === fcmDone) return true; const r = await api('POST', '/fcm', { token, approvals, msgs, alarms, label }); fcmDone = k; return r.server; }
  catch { return null; }
}
async function syncNativeAlarms() {
  if (!GtAlarm || !ME.family || !ME.access?.active) return;
  registerFcm();
  try {
    const { items } = store.get('gt-dev-alarms') === '0' ? { items: [] } : await api('GET', '/alarm-plan');
    for (const [k, c] of clocks) items.push({ id: 'c' + k, at: Math.round(c.ends), title: c.kind ? `${c.name}: missão cumprida!` : `${c.name}: acabou o tempo`, body: c.title });
    const sig = JSON.stringify(items.map(x => [x.id, x.at, x.title]));
    if (sig === alarmSig) return;
    await GtAlarm.sync({ items }); alarmSig = sig;
  } catch {}
}
const syncAlarmsSoon = () => { clearTimeout(alarmWait); alarmWait = setTimeout(syncNativeAlarms, 1500); };
if (GtAlarm) { setInterval(syncNativeAlarms, 5 * 60000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncNativeAlarms(); }); }

// Ajustes > Alarme deste celular: o que falta liberar e um botão de teste
async function nativeAlarmBox(box) {
  const st = await GtAlarm.check();
  const ok = st.notifications && st.exact && st.fullScreen && st.battery;
  const row = (good, text, btn) => `<div class="nat-row ${good ? 'ok' : ''}">${im(good ? 'check' : 'cross')}<span class="grow">${text}</span>${good ? '' : btn}</div>`;
  box.dataset.sum = ok ? `Pronto · ${st.scheduled} alarme(s) marcado(s)` : 'Falta liberar no celular';
  box.innerHTML = `${box.classList.contains('acc-body') ? '' : '<div class="box-h"><h2 class="d">Alarme deste celular</h2></div>'}
    <p class="lead">Os avisos e as missões com horário tocam como despertador, mesmo no silencioso e sem internet.</p>
    ${row(st.notifications, 'Mostrar avisos', '<button class="btn sm" data-nat="notif">Permitir</button>')}
    ${row(st.exact, 'Tocar na hora exata', '<button class="btn sm" data-nat="exact">Liberar</button>')}
    ${row(st.fullScreen, 'Abrir por cima da tela bloqueada', '<button class="btn sm" data-nat="fullScreen">Liberar</button>')}
    ${row(st.battery, 'Funcionar com o app fechado (bateria sem restrição)', '<button class="btn sm" data-nat="battery">Liberar</button>')}
    ${st.xiaomi ? `<div class="nat-row">${im('phone')}<span class="grow"><b>Xiaomi:</b> ligue o GameTask em <b>Início automático</b>, senão o alarme só toca com o app aberto.</span><button class="btn sm" data-nat="autostart">Abrir</button></div>` : ''}
    <div class="field nat-name"><label for="natName">Nome deste aparelho</label><input id="natName" maxlength="40" value="${esc(devLabel())}" placeholder="Tablet das crianças"><p class="hint">Aparece na hora de escolher onde o recado toca.</p></div>
    <label class="check"><input type="checkbox" id="natAlarms" ${store.get('gt-dev-alarms') !== '0' ? 'checked' : ''}>Tocar os alarmes de horário (avisos e missões)</label>
    <label class="check"><input type="checkbox" id="natMsgs" ${store.get('gt-dev-msgs') !== '0' ? 'checked' : ''}>Tocar os recados como alarme</label>
    <label class="check"><input type="checkbox" id="natAppr" ${store.get('gt-fcm-appr') !== '0' ? 'checked' : ''}>Avisar aqui quando uma criança concluir uma missão</label>
    <p class="hint">Em reunião? Desligue os alarmes e os recados aqui e use o app normalmente.</p>
    <div class="actions"><button class="btn green sm" id="natTest">Testar alarme (toca em 10 s)</button><button class="btn ghost sm" id="natWiz">Passo a passo</button></div>
    <p class="hint">${st.scheduled} alarme(s) marcado(s) para os próximos 7 dias. O som sai no volume de alarme do celular.</p>`;
  $$('[data-nat]', box).forEach(b => b.onclick = guard(async () => {
    if (b.dataset.nat === 'notif') await GtAlarm.askNotifications(); else await GtAlarm.openSettings({ what: b.dataset.nat });
    setTimeout(() => nativeAlarmBox(box).catch(() => {}), 800);
  }));
  $('#natAppr', box).onchange = (e) => { store.set('gt-fcm-appr', e.target.checked ? '1' : '0'); registerFcm(); };
  $('#natMsgs', box).onchange = (e) => { store.set('gt-dev-msgs', e.target.checked ? '1' : '0'); registerFcm(); toast(e.target.checked ? 'Recados vão tocar aqui' : 'Recados não tocam mais aqui'); };
  $('#natAlarms', box).onchange = (e) => { store.set('gt-dev-alarms', e.target.checked ? '1' : '0'); alarmSig = ''; registerFcm(); syncNativeAlarms(); toast(e.target.checked ? 'Alarmes de horário ligados aqui' : 'Alarmes de horário desligados aqui'); };
  $('#natName', box).onchange = (e) => { store.set('gt-dev-label', e.target.value.trim().slice(0, 40)); registerFcm(); toast('Nome salvo'); };
  $('#natWiz', box).onclick = () => nativeWizard(true);
  $('#natTest', box).onclick = guard(async () => { await GtAlarm.test({ seconds: 10 }); toast('O alarme toca em 10 segundos. Pode bloquear a tela.'); });
  addEventListener('focus', () => nativeAlarmBox(box).catch(() => {}), { once: true });
}

// Assistente "Preparar este aparelho": abre sozinho no app Android enquanto faltar alguma permissão do alarme.
// Um passo de cada vez: nome do aparelho, avisos, hora exata, tela bloqueada, bateria (e início automático na Xiaomi).
let wizOpen = false;
async function nativeWizard(force) {
  if (!GtAlarm || $('.wiz-bg') || !ME.family || !ME.access?.active || $('.sheet-bg,.msg-bg,.burst,.loader')) return;
  let st; try { st = await GtAlarm.check(); } catch { return; }
  const missing = () => !st.notifications || !st.exact || !st.fullScreen || !st.battery;
  const later = +(store.get('gt-natwiz-later') || 0);
  if (!force && (!missing() || Date.now() < later)) return;
  wizOpen = true;
  const steps = [
    ['notifications', 'Mostrar avisos', 'Para o alarme e os recados aparecerem na tela.', 'notif', 'Permitir'],
    ['exact', 'Tocar na hora exata', 'Sem isso, o Android atrasa o alarme.', 'exact', 'Liberar'],
    ['fullScreen', 'Abrir por cima da tela bloqueada', 'O alarme acende a tela mesmo bloqueada.', 'fullScreen', 'Liberar'],
    ['battery', 'Funcionar com o app fechado', 'Escolha "Permitir" para a bateria não desligar o GameTask.', 'battery', 'Liberar'],
  ];
  const bg = document.createElement('div'); bg.className = 'sheet-bg wiz-bg';
  document.body.append(bg);
  const close = () => { wizOpen = false; bg.remove(); removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); registerFcm(); syncNativeAlarms(); };
  const paint = () => {
    const next = steps.find(x => !st[x[0]]);
    const done = steps.filter(x => st[x[0]]).length;
    bg.innerHTML = `<div class="wiz-card" role="dialog" aria-label="Preparar este aparelho">
      ${im('clock', 'wiz-ic')}<h2 class="d">Preparar este aparelho</h2>
      <p class="wiz-sub">Para os alarmes e os recados tocarem aqui, mesmo com o app fechado e no silencioso.</p>
      <div class="field"><label for="wzName">Nome deste aparelho</label><input id="wzName" maxlength="40" value="${esc(devLabel())}" placeholder="Tablet das crianças"></div>
      <div class="wiz-bar"><i style="width:${done / steps.length * 100}%"></i></div>
      <ol class="wiz-steps">${steps.map(([k, t, h, what, btn]) => `<li class="${st[k] ? 'ok' : next && next[0] === k ? 'now' : ''}">
        <span class="wiz-n">${st[k] ? '✓' : steps.findIndex(x => x[0] === k) + 1}</span><span class="grow"><b>${t}</b>${!st[k] && next && next[0] === k ? `<small>${h}</small>` : ''}</span>
        ${!st[k] && next && next[0] === k ? `<button class="btn green sm" data-wz="${what}">${btn}</button>` : ''}</li>`).join('')}
      ${st.xiaomi ? `<li class="${store.get('gt-wz-auto') ? 'ok' : ''}"><span class="wiz-n">${store.get('gt-wz-auto') ? '✓' : '5'}</span><span class="grow"><b>Xiaomi: Início automático</b><small>Ligue o GameTask na lista.</small></span><button class="btn sm" data-wz="autostart">Abrir</button></li>` : ''}</ol>
      ${missing() ? '' : `<div class="wiz-done">${im('party')}<b>Tudo pronto!</b></div><button class="btn sm" id="wzTest">Testar alarme (toca em 10 s)</button>`}
      <div class="actions">${missing() ? '<button class="btn ghost" id="wzLater">Agora não</button>' : '<button class="btn green big" id="wzOk">Concluir</button>'}</div></div>`;
    $('#wzName', bg).onchange = (e) => { store.set('gt-dev-label', e.target.value.trim().slice(0, 40)); };
    $$('[data-wz]', bg).forEach(b => b.onclick = guard(async () => {
      sfx.tap();
      if (b.dataset.wz === 'notif') { await GtAlarm.askNotifications(); await refresh(); }
      else { if (b.dataset.wz === 'autostart') store.set('gt-wz-auto', '1'); await GtAlarm.openSettings({ what: b.dataset.wz }); }
    }));
    const t = $('#wzTest', bg); if (t) t.onclick = guard(async () => { await GtAlarm.test({ seconds: 10 }); toast('O alarme toca em 10 segundos. Pode bloquear a tela.'); });
    const l = $('#wzLater', bg); if (l) l.onclick = () => { store.set('gt-natwiz-later', String(Date.now() + 24 * 3600e3)); close(); };
    const o = $('#wzOk', bg); if (o) o.onclick = () => { sfx.win(); store.set('gt-dev-label', $('#wzName', bg).value.trim().slice(0, 40) || devLabel()); close(); toast('Aparelho pronto para os alarmes'); };
  };
  // ao voltar das telas do Android, confere de novo
  const refresh = async () => { if (document.visibilityState !== 'visible' || !bg.isConnected) return; try { st = await GtAlarm.check(); } catch {} paint(); };
  addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
  paint();
}

addEventListener('hashchange', () => setTimeout(checkMessages, 800));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkMessages(); });

function burst(icon, title, text, btn = 'Continuar', onClose) {
  sfx.win();
  const d = document.createElement('div'); d.className = 'burst'; d.setAttribute('role', 'dialog');
  d.innerHTML = `<div class="rays"></div>${im(icon)}<h1 class="d stroke">${esc(title)}</h1><p>${esc(text)}</p><button class="btn green">${esc(btn)}</button>`;
  document.body.append(d);
  const r = d.querySelector('img').getBoundingClientRect(); setTimeout(() => sparks(r.left + r.width / 2, r.top + r.height / 2), 350);
  d.querySelector('button').onclick = () => { d.remove(); onClose?.(); }; d.querySelector('button').focus();
}

// Sem zoom de pinça (o iPhone/iPad ignora o user-scalable=no; assim ele também não amplia)
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));

// ---------- App dos pais ----------
// Instalado à parte a partir de /painel, com nome e ícone de disfarce: abre direto no painel (digital ou PIN).
const PAINEL = location.pathname.startsWith('/painel');
const DISGUISES = [['banco', 'Banco'], ['notas', 'Notas'], ['agenda', 'Agenda'], ['clima', 'Clima'], ['ajustes', 'Ajustes']];
async function rememberPainel() {
  if (!PAINEL) return;
  try { const r = await api('POST', '/auth/parent/device'); store.set('gt-pdev', r.token); await api('POST', '/auth/parent/exit'); } catch {}
}
const myDisguise = () => { const k = new URLSearchParams(location.search).get('i'); return DISGUISES.find(d => d[0] === k) || DISGUISES[0]; };

// ---------- Roteador ----------
let timer, ME = {};
async function route() {
  clearInterval(timer); refreshView = null;
  $$('.sheet-bg,.burst').forEach(e => e.remove());
  const paid = await paymentReturn();
  const me = ME = await api('GET', '/auth/me');
  const [, a, b] = location.hash.split('/');
  if (['annual', 'monthly', 'plus'].includes(b) &&['criar', 'login', 'comprar'].includes(a)) store.set('gt-plan', b); // veio de "Assinar" na página de vendas
  if (a === 'redefinir' && b) return viewReset(b);
  if (a === 'convite' && b) return viewInvite(b);
  if (a === 'finalizar' && b) return viewFinalize(b);
  if (!me.family) return a === 'comprar' ? viewBuy(b, location.hash.split('/')[3]) : viewLogin(a === 'criar' ? 'register' : 'login');
  if (me.pending) { await viewFinalize(); return paid?.(); } // comprou pela página de vendas: falta criar senha e PIN
  if (a === 'criar' || a === 'login' || a === 'comprar') { location.hash = store.get('gt-plan') ? '#/assinar' : '#/'; return; }
  if (a === 'assinar' || !me.access.active) return viewPaywall(me);
  if (a === 'dono') return !me.parent ? viewPin() : me.owner ? viewOwner() : (location.hash = '#/');
  if (PAINEL && !me.parent && store.get('gt-pdev')) store.set('gt-pdev', ''); // lembrança apagada no servidor: pede o PIN de novo
  if (NATIVE) setTimeout(() => nativeWizard().catch(() => {}), 1500);
  if (PAINEL && a !== 'dono') { if (me.parent) setTimeout(() => maybePushWizard().catch(() => {}), 1500); return !me.parent ? viewPin() : me.onboarded ? viewAdmin() : viewSetup(); }
  if (a === 'kid' && b) return viewKid(+b);
  if (a === 'admin' || a === 'setup') return !me.parent ? viewPin() : me.onboarded ? viewAdmin() : viewSetup();
  await viewPlayers(me);
  checkMessages(); syncAlarmsSoon(); setTimeout(() => nativeWizard().catch(() => {}), 1200);
  paid?.();
  setTimeout(() => maybePushWizard().catch(() => {}), 1500);
}

// Volta do Mercado Pago: /app?pagamento=<id>&payment_id=<mp>&status=...
async function paymentReturn() {
  const q = new URLSearchParams(location.search), ref = q.get('pagamento');
  if (!ref) return null;
  history.replaceState(null, '', '/app' + location.hash);
  try {
    const r = await api('GET', `/billing/return?ref=${encodeURIComponent(ref)}&payment_id=${encodeURIComponent(q.get('payment_id') || '')}`);
    const st = r.payment?.status;
    if (st === 'approved') return () => burst('trophy', 'Assinatura ativa!', `Obrigado! Seu acesso está garantido até ${dmy(r.payment.period_end)}.`, 'Bora jogar');
    if (st === 'pending' || st === 'in_process') toast('Pagamento em análise. Assim que o Mercado Pago confirmar, o acesso é liberado.');
    else toast('O pagamento não foi concluído. Você pode tentar de novo.', true);
  } catch {}
  return null;
}
window.addEventListener('hashchange', guard(route));
guard(route)();
// ---------- Atualização automática ----------
// O app instalado fica aberto em segundo plano e não recarrega sozinho. Ao voltar para ele (e a cada 10 min),
// pergunta a versão ao servidor; se mudou depois de um deploy, recarrega (sem atrapalhar um formulário aberto).
const APP_V = new URL(document.currentScript?.src || location.href).searchParams.get('v');
let swReg = null, lastCheck = 0;
async function checkUpdate() {
  if (!APP_V || Date.now() - lastCheck < 30000) return;
  lastCheck = Date.now();
  try {
    const { v } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (!v || v === APP_V) return;
    swReg?.update().catch(() => {});
    const go = () => { if ($('.sheet-bg,.burst,.alarm-bg')) return setTimeout(go, 5000); location.reload(); };
    go();
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
addEventListener('focus', checkUpdate);
setInterval(checkUpdate, 10 * 60000);

// ---------- Convite para instalar ----------
// Android/Chrome: botão que abre o pedido de instalação. iPhone: explica o "Adicionar à Tela de Início".
let installEv = null;
const inApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const onIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e; setTimeout(installBanner, 2500); });
addEventListener('appinstalled', () => { $('.install')?.remove(); toast('GameTask instalado!'); });
function installBanner() {
  if (inApp() || $('.install')) return;
  const snKey = PAINEL ? 'gt-install-later-p' : 'gt-install-later';
  const snooze = +(store.get(snKey) || 0);
  if (Date.now() < snooze) return;
  if (!installEv && !onIOS) return;
  if ($('.sheet-bg,.burst')) return setTimeout(installBanner, 8000);
  const d = document.createElement('div'); d.className = 'install'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Instalar o GameTask');
  d.innerHTML = `<img src="${PAINEL ? `/icons/d/${myDisguise()[0]}-192.png` : '/icons/icon-192.png'}" alt="" class="install-ic"><div class="grow"><b>${PAINEL ? `Instale a área dos pais (aparece como "${myDisguise()[1]}")` : 'Instale o GameTask'}</b>
    <span>${installEv ? 'Abre como um app, em tela cheia, direto da tela inicial.' : 'Toque em <b>Compartilhar</b> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg> e depois em <b>Adicionar à Tela de Início</b>.'}</span></div>
    ${installEv ? '<button class="btn green sm" data-in>Instalar</button>' : ''}<button class="install-x" data-later aria-label="Agora não">✕</button>`;
  document.body.append(d);
  $('[data-later]', d).onclick = () => { store.set(snKey, String(Date.now() + 5 * 864e5)); d.remove(); };
  const b = $('[data-in]', d);
  if (b) b.onclick = async () => { d.remove(); installEv.prompt(); const r = await installEv.userChoice.catch(() => null); installEv = null; if (r?.outcome !== 'accepted') store.set(snKey, String(Date.now() + 5 * 864e5)); };
}
if (onIOS) setTimeout(installBanner, 3000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(r => { swReg = r; }).catch(() => {});
  // clique numa notificação com o app já aberto: vai para a tela do aviso
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'go') return;
    const h = new URL(e.data.url, location.origin).hash;
    if (h && h !== location.hash) location.hash = h; else route().catch(() => {});
  });
}

// ---------- Login / cadastro ----------
function viewLogin(mode = 'login') {
  const reg = mode === 'register';
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im('game')}<h1 class="d stroke">GameTask</h1></div>
    <form class="card" id="f" novalidate>
      <h2 class="d">${reg ? 'Criar a família' : 'Entrar na família'}</h2>
      ${reg ? '<div class="field"><label for="n">Nome da família</label><input id="n" name="name" placeholder="Família Silva" autocomplete="organization" required></div><div class="field"><label for="mn">Seu nome</label><input id="mn" name="my_name" placeholder="Bruno" autocomplete="given-name"></div>' : ''}
      <div class="field"><label for="e">E-mail</label><input id="e" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="p">Senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required><button type="button" class="eye" aria-label="Mostrar senha" aria-pressed="false">${SVG.eye}</button></div>${reg ? '<p class="hint">Mínimo de 6 caracteres.</p>' : ''}</div>
      ${reg ? `<div class="field"><label for="pin">PIN dos pais</label><div class="pw"><input id="pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required><button type="button" class="eye" aria-label="Mostrar PIN" aria-pressed="false">${SVG.eye}</button></div><p class="hint">4 a 8 números. Ele protege o painel dos pais neste e em outros aparelhos.</p></div>` : ''}
      <div class="err" id="err" role="alert"></div>
      <div class="actions"><button class="btn green">${reg ? 'Criar e entrar' : 'Entrar'}</button></div>
      ${reg ? '' : '<button type="button" class="link forgot" id="forgot">Esqueci a senha</button>'}
      ${reg ? '' : '<p class="hint" style="margin-top:14px;text-align:center">Entre uma vez em cada aparelho. Ele fica conectado e já abre nos seus filhos.</p>'}
    </form>
    <button class="switch" id="sw">${reg ? 'Já tenho uma conta' : 'Primeira vez? Criar família'}</button>
    ${reg ? '<p class="trial-note">Tem garantia: se não gostar, devolvemos o seu dinheiro.</p>' : ''}
    <a class="switch home-link" href="/">Conhecer o GameTask</a>
  </div></div>`;
  $('#sw').onclick = () => viewLogin(reg ? 'login' : 'register');
  const fg = $('#forgot'); if (fg) fg.onclick = () => viewForgot($('#e').value);
  $$('.eye').forEach(b => b.onclick = () => {
    const i = b.previousElementSibling, show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.innerHTML = show ? SVG.eyeOff : SVG.eye; b.setAttribute('aria-pressed', show);
    b.setAttribute('aria-label', (show ? 'Esconder ' : 'Mostrar ') + (i.name === 'pin' ? 'PIN' : 'senha')); i.focus();
  });
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try { await api('POST', reg ? '/auth/register' : '/auth/login', Object.fromEntries(new FormData(e.target))); location.hash = reg ? '#/setup' : store.get('gt-plan') ? '#/assinar' : '#/'; await route(); }
    catch (er) { $('#err').textContent = er.message; e.target.classList.remove('shake'); void e.target.offsetWidth; e.target.classList.add('shake'); sfx.bad(); }
    finally { btn.disabled = false; }
  };
}

// ---------- Seleção de herói ----------
// Carregamento ao trocar de aba: a barra só aparece se demorar
async function withLoader(fn) {
  let ov = null, pct = 8, tick = 0;
  const show = setTimeout(() => {
    ov = document.createElement('div'); ov.className = 'loader soft'; ov.setAttribute('role', 'progressbar'); ov.setAttribute('aria-label', 'Carregando');
    ov.innerHTML = `<img src="/img/3d/game.png" alt=""><div class="lbar"><i style="width:${pct}%"></i></div><span>Carregando…</span>`;
    document.body.append(ov);
    tick = setInterval(() => { pct = Math.min(90, pct + (90 - pct) * .18); ov.querySelector('.lbar i').style.width = pct + '%'; }, 120);
  }, 160);
  try { return await fn(); }
  finally {
    clearTimeout(show); clearInterval(tick);
    if (ov) { ov.querySelector('.lbar i').style.width = '100%'; setTimeout(() => { ov.classList.add('out'); setTimeout(() => ov.remove(), 300); }, 150); }
  }
}

// Tela de carregamento com barra, como em jogo: espera as imagens da próxima tela antes de mostrar.
// Só aparece se demorar (na primeira vez num aparelho novo); depois as imagens já estão guardadas.
const imgOk = new Set(), iconUrl = (v, fb) => `/img/3d/${slug(v, fb)}.png`;
async function preload(srcs) {
  const need = [...new Set(srcs)].filter(x => x && !imgOk.has(x));
  if (!need.length) return;
  let n = 0, ov = null;
  const show = setTimeout(() => {
    ov = document.createElement('div'); ov.className = 'loader'; ov.setAttribute('role', 'progressbar'); ov.setAttribute('aria-label', 'Carregando');
    ov.innerHTML = `<img src="/img/3d/game.png" alt=""><b class="d stroke">GameTask</b><div class="lbar"><i></i></div><span>Carregando…</span>`;
    document.body.append(ov);
  }, 180);
  const step = () => { n++; if (ov) ov.querySelector('.lbar i').style.width = Math.round(n / need.length * 100) + '%'; };
  const one = (src) => new Promise(r => {
    const i = new Image();
    i.onload = () => { imgOk.add(src); (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => { step(); r(); }); };
    i.onerror = () => { step(); r(); };
    i.src = src;
  });
  await Promise.race([Promise.all(need.map(one)), new Promise(r => setTimeout(r, 8000))]);
  clearTimeout(show);
  if (ov) { ov.querySelector('.lbar i').style.width = '100%'; await new Promise(r => setTimeout(r, 220)); ov.classList.add('out'); setTimeout(() => ov.remove(), 320); }
}

async function viewPlayers(me = ME) {
  const kids = await api('GET', '/kids');
  await preload([...kids.map(k => iconUrl(k.avatar, 'fox')), iconUrl('coin'), iconUrl('check'), iconUrl('lock'), iconUrl('bell')]);
  kids.forEach(k => { syncClocks(k, k.timers); syncClocks(k, k.taskTimers, 't'); });
  if (!kids.length && !me.onboarded) { location.hash = '#/setup'; return; }
  app.innerHTML = `<div class="lobby"><div class="rays"></div>
    <div style="position:absolute;right:16px;top:14px;z-index:5">${soundBtn()}</div>
    <div class="wrap">
      <div class="select-title"><h1 class="d stroke">GameTask</h1><p>${kids.length ? 'Quem vai jogar agora?' : 'Nenhum jogador ainda'}</p></div>
      ${kids.length ? `<div class="roster">${kids.map(k => `<button class="hero" data-id="${k.id}" style="--c:${esc(k.color)}" aria-label="Jogar como ${esc(k.name)}">
        ${k.msgs ? `<span class="msg-badge" aria-label="Recado novo">${im('bell')}</span>` : ''}${im(k.avatar, 'art', 'fox')}<div class="plate"><div class="d stroke-sm">${esc(k.name)}</div><small>${k.adult ? '' : `${im('coin')}<b class="num">${num(k.coins)}</b><i class="dot"></i>`}${im('check')}<b class="num">${k.done}/${k.total}</b></small><div class="mini"><i style="width:${k.total ? k.done / k.total * 100 : 0}%"></i></div></div></button>`).join('')}</div>`
      : `<div class="empty">${im('people')}<p class="d">Peça para um adulto cadastrar os jogadores.</p></div>`}
      <div class="parent-door"><button class="btn ghost sm" id="adm">${im('lock')} Painel dos pais</button></div>
    </div></div>`;
  wireSound();
  $$('.hero').forEach(h => h.onclick = () => {
    sfx.done(); const r = h.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 3);
    h.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 260 });
    setTimeout(() => { location.hash = '#/kid/' + h.dataset.id; }, reduced ? 0 : 240);
  });
  $('#adm').onclick = () => { sfx.tap(); location.hash = '#/admin'; };
}

// ---------- Lobby da criança ----------
// A criança vê o ganho na hora (moedas, minutos, meta). O pai confere depois; se rejeitar, o ganho sai.
async function viewKid(id) {
  let first = true, showDone = false, latest = null, iv = 0;
  const doneLike = (s) => s === 'approved' || s === 'pending';
  const here = () => { const [, a, b] = location.hash.split('/'); return a === 'kid' && +b === id; };
  const load = async () => {
    const d = await api('GET', `/kids/${id}/home`);
    syncClocks(d.kid, d.time); syncClocks(d.kid, taskClocks(d.tasks), 't');
    if (!here()) { clearInterval(iv); return d; }
    latest = d; $('.timer-bg')?.paint?.();
    if ($('.sheet-bg,.burst')) return d;
    if (first) await preload([iconUrl(d.kid.avatar, 'fox'), ...d.tasks.map(t => iconUrl(t.icon)), ...d.time.map(t => iconUrl(t.icon, 'game')),
      ...d.goals.map(g => iconUrl(g.icon, 'trophy')), iconUrl('coin'), iconUrl('stopwatch'), iconUrl('check')]);
    render(d); first = false; return d;
  };
  refreshView = () => { if (here()) load().catch(() => {}); };

  const openTimer = (tid) => {
    const key = `${id}:${tid}`;
    const bg = document.createElement('div'); bg.className = 'sheet-bg timer-bg';
    const close = () => { bg.remove(); load().catch(() => {}); };
    bg.paint = () => {
      const x = latest.time.find(y => y.id === tid); if (!x) return close();
      const run = clocks.has(key), s = run ? clockLeft(id, x) : x.left * 60;
      bg.innerHTML = `<div class="timer-card" role="dialog" aria-label="Cronômetro de ${esc(x.title)}">
        <button type="button" class="btn ghost round timer-x" data-x aria-label="Fechar">${SVG.back}</button>
        ${im(x.icon, 'timer-ic', 'game')}<h2 class="d stroke">${esc(x.title)}</h2>
        <div class="timer-face ${run ? 'on' : ''}"><b class="num" ${run ? `data-clock="${key}"` : ''}>${mmss(s)}</b><span>${run ? 'Valendo!' : s > 0 ? 'Pausado' : 'Sem tempo'}</span></div>
        <p class="timer-hint">${s > 0 ? 'Fez mais missões? O tempo novo soma aqui.' : 'Faça mais missões para ganhar tempo.'}</p>
        <button type="button" class="btn big ${run ? '' : 'green'}" data-go ${!run && s <= 0 ? 'disabled' : ''}>${run ? SVG.pause + 'Pausar' : SVG.play + 'Começar'}</button></div>`;
      $('[data-x]', bg).onclick = close;
      $('[data-go]', bg).onclick = guard(async () => {
        sfx.tap();
        const r = await api('POST', `/kids/${id}/timer/${tid}`, { action: run ? 'pause' : 'start' });
        latest.time = r.time; syncClocks(latest.kid, r.time); bg.paint();
      });
    };
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.paint(); document.body.append(bg); $('[data-go]', bg)?.focus();
  };

  const render = (d) => {
    const coins = d.balance + d.pending_coins;
    const todo = d.tasks.filter(t => !doneLike(t.status)), finished = d.tasks.filter(t => doneLike(t.status));
    const done = d.total - todo.length;
    const order = (t) => doneLike(t.status) ? 0 : 1;
    const segs = [...d.tasks].sort((a, b) => order(a) - order(b))
      .map(t => `<i class="seg ${doneLike(t.status) ? 'on' : ''}"></i>`).join('') || '<i class="seg"></i>';
    const canWin = todo.reduce((a, t) => a + (+t.coins || 0), 0);
    const goalRoad = (g) => {
      const p = g.progress + g.pending, pct = Math.min(100, g.target ? p / g.target * 100 : 0), ready = p >= g.target;
      const nodes = [25, 50, 75].map(n => `<i class="node ${pct >= n ? 'on' : ''}" style="left:${n}%"></i>`).join('');
      return `<div class="road"><div class="road-head">${im(g.icon, '', 'trophy')}<b class="stroke-sm">${esc(g.title)}</b><span class="num">${ready ? 'Conquistado!' : `${num(p)} de ${num(g.target)} ${g.mode === 'coins' ? 'moedas' : 'missões'}`}</span></div>
        <div class="track"><div class="rail"></div><div class="fill" style="width:${pct}%"></div>${nodes}<img src="/img/3d/${slug(d.kid.avatar, 'fox')}.png" alt="" class="me" style="left:${pct}%">${im(g.icon, 'prize' + (ready ? ' ready' : ''), 'trophy')}</div></div>`;
    };
    const timeMeter = (t) => {
      const run = running(t), key = `${d.kid.id}:${t.id}`;
      return `<button type="button" class="meter ${run ? 'running' : ''}" data-timer="${t.id}" aria-label="Cronômetro de ${esc(t.title)}">${im(t.icon, '', 'game')}<div class="lbl"><b>${esc(t.title)}</b><span class="num">${run ? `<i class="live"></i><span data-clock="${key}">${mmss(clockLeft(d.kid.id, t))}</span>` : `${Number.isInteger(t.left) ? num(t.left) : mmss(t.left * 60)} de ${num(t.cap)} ${esc(t.unit)}`}</span></div>
        <div class="bar"><i style="width:${t.cap ? Math.min(100, t.left / t.cap * 100) : 0}%"></i></div></button>`;
    };
    const mission = (t, i) => {
      const chips = [
        t.late && !doneLike(t.status) ? `<span class="chip late">Ficou de ontem</span>` : '',
        t.time ? `<span class="chip hour">${esc(t.time)}</span>` : '',
        t.timer ? `<span class="chip time">${im('stopwatch')}${Math.round(t.timer.minutes)}min</span>` : '',
        t.coins > 0 ? `<span class="chip">${im('coin')}${num(t.coins)}</span>` : '',
        ...t.rewards.map(r => r.kind === 'time' ? `<span class="chip time">${im(r.icon, '', 'game')}${Math.max(1, Math.round(r.value))}${esc(r.unit)}</span>` : `<span class="chip goal">${im(r.icon, '', 'trophy')}1</span>`),
      ].join('');
      const tm = t.timer, trun = tm && running(tm), tkey = `${d.kid.id}:t${t.id}`;
      const act = t.status === 'todo' && tm ? `<button class="btn ${trun ? '' : 'green'} go tgo ${trun ? 'on' : ''}" data-tt="${t.id}" aria-label="${trun ? 'Pausar' : 'Começar'} o cronômetro">${trun ? SVG.pause : SVG.play}<span>${trun ? 'Pausar' : tm.left * 60 < tm.minutes * 60 - 1 ? 'Continuar' : 'Começar'}</span><b class="num" ${trun ? `data-clock="${tkey}"` : ''}>${mmss(trun ? clockLeft(d.kid.id, { id: t.id, ...tm }, 't') : tm.left * 60)}</b></button>`
        : t.status === 'todo' ? `<button class="btn green go" data-do="${t.id}">Concluí!</button>`
        : doneLike(t.status) ? `<span class="status ok">${im('check')}Feito!</span>${t.status === 'pending' || d.kid.adult ? `<button class="link" data-undo="${t.id}">Desfazer</button>` : ''}`
        : `<span class="status no">${im('cross')}Refazer</span>`;
      return `<article class="mission ${doneLike(t.status) ? 'done' : t.status === 'rejected' ? 'rejected' : ''}" data-m="${t.id}" style="animation-delay:${i * 45}ms">
        <div class="info"><span class="tile" data-tile="${t.id}">${im(t.icon)}</span><div class="ttl" data-say="${t.id}" role="button" tabindex="0" aria-label="${esc(t.title)}. Toque para ouvir"><span class="tt">${esc(t.title)}</span></div>${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}<div class="chips">${chips}</div></div>
        <div class="act">${act}</div></article>`;
    };
    const head = todo.length ? (todo.length === 1 ? 'Falta 1!' : `Faltam ${todo.length}!`) : d.total ? 'Tudo feito!' : 'Dia livre!';
    const sub = todo.length && canWin > 0 ? `${im('coin')}<span>Ainda dá para ganhar <b>+${num(canWin)}</b> moedas hoje</span>`
      : todo.length ? `${im('sparkles')}<span>Bora completar as missões!</span>`
      : d.total ? `${im('party')}<span>Mandou muito bem hoje!</span>` : `${im('party')}<span>Nenhuma missão hoje. Aproveite!</span>`;
    app.innerHTML = `<div class="lobby">
      <div class="topbar"><div class="topbar-in"><button class="btn ghost round" id="back" aria-label="Trocar jogador">${SVG.back}</button>
        <span class="who-av" style="--c:${esc(d.kid.color)}">${im(d.kid.avatar, '', 'fox')}</span><span class="who d stroke-sm">${esc(d.kid.name)}</span>
        <div class="pills">${d.kid.adult ? '' : `<div class="pill" id="coinPill" title="Moedas">${im('coin')}<b id="coinNum">${num(coins)}</b></div>`}</div>
        ${soundBtn()}</div></div>
      <div class="wrap ${first ? 'intro' : ''}"><div class="hud">
        <section class="stage" style="--c:${esc(d.kid.color)}"><div class="avatar">${im(d.kid.avatar, '', 'fox')}</div>
          <div><h1 class="d stroke">${head}</h1><p class="cheer">${sub}</p></div>
          <div class="xp"><div class="xp-head"><span>Missões de hoje</span><span class="num">${done} de ${d.total}</span></div><div class="segs">${segs}</div></div>
        </section>
        ${d.time.length || d.goals.length ? `<section class="panel">${d.time.map(timeMeter).join('')}${d.time.length && d.goals.length ? '<div class="gap"></div>' : ''}${d.goals.map(goalRoad).join('')}</section>` : ''}</div>
        ${!d.wheel ? '' : d.wheel.ready ? `<button type="button" class="wheel-cta" id="wheelGo"><i class="wi"></i><span><b>Roleta liberada!</b><span>Gire e ganhe uma surpresa</span></span></button>`
          : d.wheel.spun ? `<div class="wheel-won">${im('gift')}<span>Prêmio de hoje: <b>${esc(d.wheel.spun.emoji || '')} ${esc(d.wheel.spun.label)}</b></span></div>` : ''}
        <div class="section-h"><h2 class="d stroke-sm">Missões</h2></div>
        ${!d.tasks.length ? `<div class="empty">${im('party')}<p class="d stroke-sm">Nenhuma missão hoje. Aproveite!</p></div>`
          : todo.length ? `<div class="missions">${todo.map(mission).join('')}</div>` : `<div class="all-done">${im('trophy')}<b class="d stroke-sm">Todas as missões feitas!</b></div>`}
        ${finished.length ? `<details class="done-list" ${showDone ? 'open' : ''}><summary>${im('check')}<span>Feitas</span><b class="num">${finished.length}</b><i class="chev" aria-hidden="true"></i></summary>
          <div class="missions">${finished.map(mission).join('')}</div></details>` : ''}
      </div></div>`;
    wireSound();
    $('.done-list')?.addEventListener('toggle', (e) => { showDone = e.target.open; sfx.tap(); });
    $('#back').onclick = () => { sfx.tap(); location.hash = '#/'; };
    const spinIt = (w, celebrate) => openWheel({ ...bonusWheel(id, w), celebrate, done: () => load().catch(() => {}) });
    if (d.messages?.length) checkMessages();
    else if (d.fix?.length && !$('.sheet-bg,.burst')) openWheel({ ...(d.fix[0].kind === 'free' ? freeWheel : fixWheel)(d.fix[0], () => api('POST', `/kids/${id}/fix/${d.fix[0].id}/spin`, {})), done: () => load().catch(() => {}) });
    if ($('#wheelGo')) $('#wheelGo').onclick = () => { sfx.tap(); spinIt(d.wheel); };
    $$('[data-do]').forEach(b => b.onclick = guard(async () => {
      b.disabled = true;
      const r = b.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2); sfx.done();
      const t = d.tasks.find(x => x.id === +b.dataset.do), last = todo.length === 1;
      const art = b.closest('.mission'), tile = $(`[data-tile="${t.id}"]`)?.getBoundingClientRect();
      await api('POST', `/kids/${id}/complete`, { task_id: t.id });
      // a missão sai da lista e vai para "Feitas"
      if (!reduced && art) await art.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(48px) scale(.94)' }], { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished;
      const nd = await load();
      $('.done-list summary')?.classList.add('bump');
      const newCoins = nd.balance + nd.pending_coins;
      if (!d.kid.adult) $('#coinNum').textContent = num(coins);
      if (tile && !d.kid.adult) flyTo({ x: tile.left + tile.width / 2, y: tile.top + tile.height / 2 }, $('#coinPill'), t.coins > 0 ? 'coin' : 'glow', t.coins > 0 ? Math.min(8, 3 + Math.round(t.coins)) : 3);
      if (!d.kid.adult) setTimeout(() => countUp($('#coinNum'), coins, newCoins), reduced ? 0 : 950);
      if (last && (nd.wheel?.ready || !store.get(`gt-all-${id}-${d.day}`))) { store.set(`gt-all-${id}-${d.day}`, '1'); setTimeout(() => nd.wheel?.ready ? spinIt(nd.wheel, true) : burst('trophy', 'Dia completo!', `${d.kid.name}, você fez todas as missões de hoje!`, 'Oba!'), 1500); }
    }));
    $$('[data-timer]').forEach(b => b.onclick = () => { sfx.tap(); openTimer(+b.dataset.timer); });
    $$('[data-tt]').forEach(b => b.onclick = guard(async () => {
      b.disabled = true; sfx.tap();
      const tid = +b.dataset.tt, on = clocks.has(`${id}:t${tid}`);
      await api('POST', `/kids/${id}/task-timer/${tid}`, { action: on ? 'pause' : 'start' });
      await load();
    }));
    $$('[data-undo]').forEach(b => b.onclick = guard(async () => { sfx.tap(); await api('DELETE', `/kids/${id}/complete/${b.dataset.undo}`); await load(); }));
    // ouvir a missão: botão do alto-falante, o nome ou o ícone
    const speak = (tid) => {
      const t = d.tasks.find(x => x.id === +tid); if (!t) return;
      const art = $(`[data-m="${t.id}"]`); art?.classList.remove('talk'); void art?.offsetWidth; art?.classList.add('talk');
      say(t.title);
    };
    $$('[data-say],[data-tile]').forEach(el => el.onclick = (e) => { e.stopPropagation(); speak(el.dataset.say || el.dataset.tile); });
  };
  await load();
  if (!here()) return;
  iv = timer = setInterval(() => load().catch(() => {}), 20000);
}

// ---------- Folha (formulário) ----------
function sheet(title, body, onSave, { saveLabel = 'Salvar', danger } = {}) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<form class="sheet" role="dialog" aria-label="${esc(title)}" novalidate><h2 class="d">${esc(title)}</h2>${body}
    <div class="err" role="alert"></div><div class="actions"><button class="btn ${danger ? 'red' : 'green'}">${esc(saveLabel)}</button><button type="button" class="btn ghost" data-x>Cancelar</button></div></form>`;
  document.body.append(bg);
  const f = bg.querySelector('form'), close = () => bg.remove();
  bg.querySelector('[data-x]').onclick = close;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  f.onsubmit = async (e) => {
    e.preventDefault(); const b = f.querySelector('.actions .btn'); b.disabled = true;
    try { await onSave(f); close(); } catch (er) { f.querySelector('.err').textContent = er.message; sfx.bad(); } finally { b.disabled = false; }
  };
  setTimeout(() => f.querySelector('input:not([type=hidden]),select')?.focus(), 50);
  return bg;
}
const picker = (name, list, cur, hidden) => `<div class="picker" data-pick ${hidden ? 'hidden' : ''}>${list.map(e => `<button type="button" class="${e === cur ? 'on' : ''}" data-v="${e}" aria-label="${e}"><img src="/img/3d/${slug(e)}.png" alt="" loading="lazy" decoding="async"></button>`).join('')}</div><input type="hidden" name="${name}" value="${esc(cur)}">`;
const swatches = (name, cur) => `<div class="swatches" data-pick>${COLORS.map(c => `<button type="button" class="${c === cur ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div><input type="hidden" name="${name}" value="${esc(cur)}">`;
// Nome com o ícone do lado: tocar no ícone abre a grade; escolher fecha
const iconName = (id, label, input, list, cur) => `<div class="field ifield"><label for="${id}">${label}</label>
  <div class="name-row"><button type="button" class="icon-btn" data-ipick aria-expanded="false" aria-label="Trocar o ícone">${im(cur)}</button>${input}</div>
  <p class="hint ipick-hint" hidden>Toque no ícone que combina:</p>${picker('icon', list, cur, true)}</div>`;
const seg = (name, opts, cur) => `<div class="seg-ctl">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
document.addEventListener('click', (e) => {
  const ip = e.target.closest('[data-ipick]');
  if (ip) { const f = ip.closest('.ifield'), g = $('[data-pick]', f), open = g.hidden; g.hidden = !open; $('.ipick-hint', f).hidden = !open; ip.setAttribute('aria-expanded', open); sfx.tap(); return; }
  const b = e.target.closest('[data-pick] button'); if (!b) return;
  const fld = b.closest('.ifield');
  if (fld) { $('[data-ipick]', fld).innerHTML = im(b.dataset.v); b.parentElement.hidden = true; $('.ipick-hint', fld).hidden = true; $('[data-ipick]', fld).setAttribute('aria-expanded', 'false'); }
  const w = b.parentElement; $$('button', w).forEach(x => x.classList.remove('on')); b.classList.add('on');
  w.nextElementSibling.value = b.dataset.v; sfx.tap();
});

// ---------- Digital / rosto (WebAuthn) ----------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pkIds = () => { try { return JSON.parse(store.get('gt-pk') || '[]'); } catch { return []; } };
const pkSave = (ids) => store.set('gt-pk', JSON.stringify([...new Set(ids)]));
const pkCan = async () => { try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } };
async function pkAdd() {
  const o = await api('POST', '/auth/passkey/register/options', {});
  const c = await navigator.credentials.create({ publicKey: { ...o, challenge: b64key(o.challenge), user: { ...o.user, id: b64key(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(x => ({ ...x, id: b64key(x.id) })) } });
  const r = c.response;
  const res = await api('POST', '/auth/passkey/register', { label: guessLabel(), credential: { id: c.id, rawId: b64u(c.rawId), type: c.type,
    authenticatorAttachment: c.authenticatorAttachment, clientExtensionResults: c.getClientExtensionResults(),
    response: { clientDataJSON: b64u(r.clientDataJSON), attestationObject: b64u(r.attestationObject), transports: r.getTransports?.() || [] } } });
  pkSave([...pkIds(), res.id]);
}
async function pkUse() {
  let o;
  try { o = await api('POST', '/auth/passkey/login/options', { ids: pkIds() }); }
  catch (e) { if (e.code === 'none') store.set('gt-pk', '[]'); throw e; }
  const c = await navigator.credentials.get({ publicKey: { ...o, challenge: b64key(o.challenge), allowCredentials: o.allowCredentials.map(x => ({ ...x, id: b64key(x.id) })) } });
  const r = c.response;
  try {
    return await api('POST', '/auth/passkey/login', { credential: { id: c.id, rawId: b64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment,
      clientExtensionResults: c.getClientExtensionResults(), response: { clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData),
        signature: b64u(r.signature), userHandle: r.userHandle ? b64u(r.userHandle) : undefined } } });
  } catch (e) { if (e.code === 'unknown') pkSave(pkIds().filter(x => x !== c.id)); throw e; }
}
const pkErr = (e) => e.name === 'NotAllowedError' ? 'Leitura cancelada.' : e.name === 'InvalidStateError' ? 'Esta digital já está cadastrada neste aparelho.' : e.message;

// ---------- Convite de responsável ----------
async function viewInvite(token) {
  let inv;
  try { inv = await api('GET', '/auth/invite/' + token); }
  catch (e) {
    app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth"><div class="logo">${im('key')}<h1 class="d stroke" style="font-size:40px">Convite</h1></div>
      <div class="card sent">${im('hourglass')}<h2 class="d">Convite vencido</h2><p>${esc(e.message)}</p><div class="actions"><a class="btn green" href="#/login">Entrar</a></div></div></div></div>`;
    return;
  }
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im('people')}<h1 class="d stroke" style="font-size:40px">Convite</h1></div>
    <form class="card" id="f" novalidate><h2 class="d">${esc(inv.family)}</h2>
      <p class="lead" style="margin-top:6px;color:var(--ink-soft)">Você foi convidado(a) como <b>${esc(inv.role)}</b>. ${inv.full ? 'Terá acesso completo ao painel dos pais.' : 'Poderá aprovar tarefas, marcar o tempo de tela usado e ver a carteira.'}</p>
      <div class="field"><label for="n">Seu nome</label><input id="n" name="name" value="${esc(inv.name)}" autocomplete="given-name" required></div>
      <div class="field"><label for="e">Seu e-mail</label><input id="e" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="p">Crie uma senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="new-password" required><button type="button" class="eye" aria-label="Mostrar senha" aria-pressed="false">${SVG.eye}</button></div><p class="hint">Mínimo de 6 caracteres. Use para entrar no seu celular.</p></div>
      <div class="field"><label for="pin">Seu PIN</label><div class="pw"><input id="pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required><button type="button" class="eye" aria-label="Mostrar PIN" aria-pressed="false">${SVG.eye}</button></div><p class="hint">4 a 8 números. Abre o painel dos pais em qualquer aparelho da família.</p></div>
      <div class="err" id="err" role="alert"></div>
      <div class="actions"><button class="btn green">Entrar na família</button></div></form></div></div>`;
  $$('.eye').forEach(b => b.onclick = () => {
    const i = b.previousElementSibling, show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.innerHTML = show ? SVG.eyeOff : SVG.eye; b.setAttribute('aria-pressed', show);
  });
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try { await api('POST', '/auth/invite', { token, ...Object.fromEntries(new FormData(e.target)) }); sfx.win(); location.hash = '#/admin'; await route(); }
    catch (er) { $('#err').textContent = er.message; sfx.bad(); }
    finally { btn.disabled = false; }
  };
}

// ---------- PIN dos pais ----------
function viewPin() {
  let pin = '';
  const finger = pkIds().length && window.PublicKeyCredential;
  app.innerHTML = `<div class="lobby"><div class="auth">
    <div class="logo">${im('lock')}<h1 class="d stroke" style="font-size:44px">Painel dos pais</h1></div>
    <div class="card" id="card">${finger ? `<button class="btn green finger" id="fp">${SVG.finger}Entrar com a digital</button><p class="or">ou digite seu PIN</p>` : '<h2 class="d" style="text-align:center">Digite seu PIN</h2>'}${PAINEL ? '<p class="hint" style="text-align:center">Só desta vez: depois este app abre direto.</p>' : ''}
      <div class="pin-dots" id="dots" aria-hidden="true">${'<i></i>'.repeat(4)}</div>
      <div class="err" id="err" role="alert" style="text-align:center"></div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="btn ghost" data-k="${n}">${n}</button>`).join('')}
        <button class="btn ghost" data-k="del" aria-label="Apagar">${SVG.del}</button><button class="btn ghost" data-k="0">0</button><button class="btn green" data-k="ok">OK</button></div>
    </div>
    ${PAINEL ? '' : '<div class="actions"><button class="btn ghost sm" id="back">Voltar ao jogo</button></div>'}</div></div>`;
  const dots = () => { const n = Math.max(4, pin.length); $('#dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
  const submit = async () => {
    if (pin.length < 4) return;
    try { await api('POST', '/auth/parent', { pin }); await rememberPainel(); sfx.done(); document.removeEventListener('keydown', kb); await route(); }
    catch (er) { pin = ''; dots(); $('#err').textContent = er.message; const c = $('#card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); sfx.bad(); }
  };
  const press = (k) => { if (k === 'del') pin = pin.slice(0, -1); else if (k === 'ok') return submit(); else if (pin.length < 8) pin += k; $('#err').textContent = ''; sfx.tap(); dots(); };
  const kb = (e) => { if (!$('#dots')) return document.removeEventListener('keydown', kb); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); };
  document.addEventListener('keydown', kb);
  $$('[data-k]').forEach(b => b.onclick = () => press(b.dataset.k));
  const bk = $('#back'); if (bk) bk.onclick = () => { document.removeEventListener('keydown', kb); location.hash = '#/'; };
  // Com digital ativada neste aparelho, o pedido do dedo já abre sozinho; o PIN fica como segunda opção.
  // (Se o navegador exigir um toque antes, a tentativa automática falha em silêncio e o botão continua ali.)
  const fp = $('#fp');
  const useFp = async (auto) => {
    if (!fp || fp.disabled) return;
    fp.disabled = true;
    try { await pkUse(); await rememberPainel(); sfx.done(); document.removeEventListener('keydown', kb); await route(); }
    catch (er) { if (!auto) { $('#err').textContent = pkErr(er); sfx.bad(); } }
    finally { fp.disabled = false; }
  };
  if (fp) { fp.onclick = () => useFp(false); setTimeout(() => useFp(true), 0); }
}

// ---------- Painel dos pais ----------
let tab = 'pending';
const TABS = [['pending', 'check', 'Aprovar'], ['kids', 'people', 'Filhos'], ['tasks', 'clipboard', 'Tarefas'], ['rewards', 'gift', 'Prêmios'], ['wheels', 'party', 'Roletas'], ['wallet', 'moneybag', 'Carteira'], ['settings', 'gear', 'Ajustes']];
const full = () => !!ME.actor?.full;
const DAILY_TABS = ['pending', 'wallet', 'settings']; // quem só tem o dia a dia (ex.: babá)
let adminShown = null; // aba que está na tela: ao salvar, a mesma aba se redesenha e volta para onde estava
async function viewAdmin() {
  const keepY = adminShown === tab && $('.admin') ? scrollY : 0;
  const pendingN = (await api('GET', '/admin/pending')).length;
  const ac = ME.access || {};
  const tabs = TABS.filter(([k]) => full() || DAILY_TABS.includes(k));
  if (!tabs.some(([k]) => k === tab)) tab = 'pending';
  const plan = !full() ? '' : ac.status === 'trial' ? `<a class="plan-chip ${ac.days_left <= 10 ? 'warn' : ''}" href="#/assinar">${im('hourglass')}Grátis: ${ac.days_left} ${ac.days_left === 1 ? 'dia' : 'dias'}</a>`
    : ac.status === 'paid' && ac.days_left <= 10 ? `<a class="plan-chip warn" href="#/assinar">${im('hourglass')}Renovar em ${ac.days_left} d</a>` : '';
  const offerFp = !pkIds().length && !store.get('gt-pk-skip') && await pkCan();
  app.innerHTML = `<div class="admin"><header class="admin-top"><div class="row1"><h1 class="d stroke-sm">Painel dos pais</h1>
      ${ME.actor ? `<span class="who-chip">Olá, ${esc(ME.actor.name)}</span>` : ''}
      ${plan}<a class="btn ghost sm help-link" href="/ajuda" target="_blank" rel="noopener">Ajuda</a>${ME.owner ? `<a class="btn sm" href="#/dono">${im('chart')}Dono</a>` : ''}
      ${PAINEL ? '' : '<button class="btn ghost sm" id="exit">Voltar ao jogo</button>'}</div>
    ${offerFp ? `<div class="fp-offer">${SVG.finger}<span><b>Abrir o painel com a digital neste aparelho?</b> Mais rápido que digitar o PIN.</span><button class="btn green sm" id="fpOn">Ativar</button><button class="btn ghost sm" id="fpNo">Agora não</button></div>` : ''}
    <nav class="tabs" aria-label="Seções">${tabs.map(([k, ic, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" ${k === tab ? 'aria-current="page"' : ''}>${im(ic)}${l}${k === 'pending' && pendingN ? `<span class="cnt">${pendingN}</span>` : ''}</button>`).join('')}</nav></header>
    <main class="admin-body" id="pane"></main></div>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; sfx.tap(); withLoader(viewAdmin).catch(e => toast(e.message, true)); });
  $('.tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  if ($('#exit')) $('#exit').onclick = guard(async () => { await api('POST', '/auth/parent/exit'); location.hash = '#/'; await route(); });
  const fpOn = $('#fpOn'); if (fpOn) {
    fpOn.onclick = async () => { try { await pkAdd(); sfx.win(); toast('Digital ativada neste aparelho'); $('.fp-offer').remove(); } catch (e) { toast(pkErr(e), true); } };
    $('#fpNo').onclick = () => { store.set('gt-pk-skip', '1'); $('.fp-offer').remove(); };
  }
  const fns = { pending: adminPending, kids: adminKids, tasks: adminTasks, rewards: adminRewards, wheels: adminWheels, wallet: adminWallet, settings: adminSettings };
  await (fns[tab] || (tab = 'pending', adminPending))($('#pane'), viewAdmin);
  adminShown = tab;
  if (keepY) scrollTo(0, keepY);
}
const zero = (icon, text) => `<div class="zero">${im(icon)}<span>${text}</span></div>`;

// Recado para os jogadores: aparece na tela deles na hora e toca nos aparelhos com avisos ligados. Não fica histórico.
function messageSheet(on, pre = []) {
  const quick = ['Hora do banho!', 'Venha jantar!', 'Hora de dormir', 'Vem aqui um minutinho', 'Desliga a TV, por favor'];
  const bg = sheet(pre.length === 1 ? `Recado para ${on.find(k => k.id === pre[0])?.name || ''}` : 'Mandar recado', `<div class="field"><span class="lab">Para quem</span><div class="kid-pick">${on.map(k => `<label class="kp-check"><input type="checkbox" name="to" value="${k.id}" ${!pre.length || pre.includes(k.id) ? 'checked' : ''}><span style="--c:${esc(k.color)}">${im(k.avatar, '', 'fox')}${esc(k.name)}</span></label>`).join('')}</div></div>
    <div class="field"><label for="mt">Recado</label><textarea id="mt" name="text" rows="3" maxlength="300" placeholder="Venha jantar!" required></textarea>
    <div class="quick">${quick.map(q => `<button type="button" class="chip-btn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <p class="hint">Aparece na hora na tela das crianças que estiver aberta. A resposta chega como aviso para você.</p></div>
    <div class="field" data-devs hidden><span class="lab">Tocar como alarme em</span><div class="dev-pick"></div></div>`,
    async (f) => {
      const devBox = $('[data-devs]', f), devices = devBox.hidden ? undefined : $$('[name=dev]:checked', f).map(x => x.value);
      const r = await api('POST', '/admin/messages', { text: f.text.value, kid_ids: $$('[name=to]:checked', f).map(x => +x.value), devices });
      toast(r.sent ? `Recado enviado e tocou em ${r.sent} aparelho(s)` : 'Recado enviado. Aparece na tela do jogador.');
    }, { saveLabel: 'Enviar' });
  $$('[data-q]', bg).forEach(b => b.onclick = () => { bg.querySelector('#mt').value = b.dataset.q; sfx.tap(); });
  api('GET', '/admin/devices').then(list => {
    if (!list.length) return;
    const box = $('[data-devs]', bg);
    $('.dev-pick', box).innerHTML = list.map(d => `<label class="check"><input type="checkbox" name="dev" value="${esc(d.id)}" ${d.on ? 'checked' : ''}>${im('phone')}${esc(d.label)}</label>`).join('');
    box.hidden = false;
  }).catch(() => {});
}

async function adminPending(pane, refresh) {
  const rows = await api('GET', '/admin/pending');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Esperando aprovação</h2>${rows.length > 1 ? `<button class="btn green sm" id="all">Aprovar todas (${rows.length})</button>` : ''}</div>
    ${rows.length ? `<div class="list">${rows.map(r => `<div class="item"><div class="ic">${im(r.icon)}</div><div class="grow"><div class="t">${esc(r.title)}</div>
      <div class="s">${esc(r.kid)} · ${dmy(r.day)}${r.coins > 0 ? ` · ${num(r.coins)} moedas` : ''}</div></div>
      <div class="btns"><button class="btn green sm" data-ok="${r.id}">Aprovar</button><button class="btn ghost sm" data-no="${r.id}">Rejeitar</button></div></div>`).join('')}</div>`
    : zero('party', 'Nada para aprovar agora.')}</section>`;
  const act = (url, ids, msg) => guard(async () => { await api('POST', url, { ids }); sfx.done(); toast(msg); refresh(); });
  $$('[data-ok]').forEach(b => b.onclick = act('/admin/approve', [+b.dataset.ok], 'Aprovada'));
  $$('[data-no]').forEach(b => b.onclick = act('/admin/reject', [+b.dataset.no], 'Rejeitada'));
  const all = $('#all'); if (all) all.onclick = act('/admin/approve', rows.map(r => r.id), 'Todas aprovadas');
}

async function adminKids(pane, refresh) {
  const all = await api('GET', '/admin/kids'), kids = all.filter(k => !k.adult), adults = all.filter(k => k.adult);
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Filhos</h2><div class="btns">${kids.filter(k => k.active).length > 1 ? `<button class="btn ghost sm" id="msgAll">${SVG.mega}Recado para todos</button>` : ''}<button class="btn green sm" id="new">Adicionar filho</button></div></div>
    ${kids.length ? `<div class="kid-rows">${kids.map(k => `<div class="kid-row ${k.active ? '' : 'off'}"><div class="kid-id"><span class="kid-av" style="background:${esc(k.color)}33">${im(k.avatar, '', 'fox')}</span><b>${esc(k.name)}</b>${k.active ? '' : '<small>inativo</small>'}</div>
      <div class="kid-act">${k.active ? `<button class="btn sm" data-msg="${k.id}">${SVG.mega}Recado</button>` : ''}<button class="btn ghost sm" data-e="${k.id}">${im('pencil')}Editar</button></div></div>`).join('')}</div>` : zero('people', 'Adicione o primeiro jogador.')}</section>
    ${adults.length ? `<section class="box"><div class="box-h"><h2 class="d">Adultos no jogo</h2></div>
      <p class="lead">Pai, mãe ou outro responsável que faz a rotina junto, sem moedas. Quem sai do jogo continua com o acesso ao painel.</p>
      <div class="list">${adults.map(k => `<div class="item ${k.active ? '' : 'off'}"><div class="ic" style="background:${esc(k.color)}33">${im(k.avatar, '', 'fox')}</div>
      <div class="grow"><div class="t">${esc(k.name)}</div><div class="s">${k.active ? 'Jogando' : 'Fora do jogo'}</div></div>
      <div class="btns">${k.active ? `<button class="btn ghost sm" data-out="${k.id}">Tirar do jogo</button>` : `<button class="btn ghost sm" data-in="${k.id}">Voltar ao jogo</button>`}</div></div>`).join('')}</div></section>` : ''}`;
  const form = (k = { name: '', avatar: AVATARS[0], color: COLORS[0], active: 1, auto_approve: 0 }) => `
    <div class="field"><label for="kn">Nome</label><input id="kn" name="name" value="${esc(k.name)}" required></div>
    <div class="field"><span class="lab">Personagem</span>${picker('avatar', AVATARS, slug(k.avatar, 'fox'))}</div>
    <div class="field"><span class="lab">Cor do card</span>${swatches('color', k.color)}</div>
    <label class="check"><input type="checkbox" name="auto" ${k.auto_approve ? 'checked' : ''}>Aprovar as tarefas automaticamente</label>
    <p class="hint">Os ganhos entram assim que ${k.name ? esc(k.name) : 'a criança'} marca a tarefa, sem passar pela aba Aprovar.</p>
    <label class="check"><input type="checkbox" name="active" ${k.active ? 'checked' : ''}>Ativo na tela de jogadores</label>
    ${k.id ? `<button type="button" class="btn red sm" data-del style="margin-top:14px">Apagar ${esc(k.name)}</button>` : ''}`;
  const read = (f) => ({ name: f.name.value, avatar: f.avatar.value, color: f.color.value, active: f.active.checked, auto_approve: f.auto.checked });
  const onK = all.filter(k => k.active);
  $$('[data-msg]').forEach(b => b.onclick = () => messageSheet(onK, [+b.dataset.msg]));
  const ma = $('#msgAll'); if (ma) ma.onclick = () => messageSheet(onK);
  $('#new').onclick = () => sheet('Novo filho', form(), async (f) => { await api('POST', '/admin/kids', read(f)); toast('Jogador adicionado'); refresh(); }, { saveLabel: 'Adicionar' });
  $$('[data-e]').forEach(b => b.onclick = () => {
    const k = kids.find(x => x.id == b.dataset.e);
    const ed = sheet('Editar ' + k.name, form(k), async (f) => { await api('PUT', '/admin/kids/' + k.id, read(f)); refresh(); });
    $('[data-del]', ed).onclick = () => { ed.remove(); sheet(`Apagar ${k.name}?`, `<p class="lead" style="margin-top:6px">Some tudo de ${esc(k.name)}: moedas, histórico e prêmios. Não dá para desfazer.</p>
      <p class="hint">Se quiser só esconder por um tempo, desmarque "Ativo na tela de jogadores".</p>`,
      async () => { await api('DELETE', '/admin/kids/' + k.id); toast(`${k.name} foi apagado`); refresh(); }, { saveLabel: 'Apagar para sempre', danger: true }); };
  });
  $$('[data-out]').forEach(b => b.onclick = guard(async () => { await api('DELETE', '/admin/kids/' + b.dataset.out); toast('Saiu do jogo'); refresh(); }));
  $$('[data-in]').forEach(b => b.onclick = guard(async () => { const k = adults.find(x => x.id == b.dataset.in); await api('PUT', '/admin/kids/' + k.id, { ...k, active: true }); toast('De volta ao jogo'); refresh(); }));
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], DAYN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// Arrastar para ordenar (dedo ou mouse pela alça; setas do teclado na alça também movem)
function sortable(list, onDrop) {
  const ids = () => $$('.item', list).map(x => +x.dataset.id);
  list.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.grip'); if (!grip || e.button > 0) return;
    e.preventDefault();
    const item = grip.closest('.item'), before = ids().join();
    const off = e.clientY - item.getBoundingClientRect().top;
    item.classList.add('dragging');
    const move = (ev) => {
      const y = ev.clientY;
      const next = $$('.item', list).filter(x => x !== item).find(s => { const b = s.getBoundingClientRect(); return y < b.top + b.height / 2; }) || null;
      if (next !== item.nextElementSibling) { list.insertBefore(item, next); sfx.tap(); }
      item.style.transform = 'none';
      item.style.transform = `translateY(${y - off - item.getBoundingClientRect().top}px)`;
      if (y < 70) scrollBy(0, -12); else if (y > innerHeight - 70) scrollBy(0, 12);
    };
    let done = false;
    const up = () => {
      if (done) return; done = true;
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      item.classList.remove('dragging'); item.style.transform = '';
      if (ids().join() !== before) onDrop(ids());
    };
    // escuta na janela (sem prender o dedo na alça): ao reordenar, o navegador soltaria a alça e o arrasto acabaria após um passo
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  list.addEventListener('keydown', (e) => {
    const grip = e.target.closest('.grip'); if (!grip || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const item = grip.closest('.item'), sib = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling?.nextElementSibling;
    if (e.key === 'ArrowUp' && !sib) return;
    if (e.key === 'ArrowDown' && !item.nextElementSibling) return;
    list.insertBefore(item, sib); onDrop(ids());
    setTimeout(() => $(`.item[data-id="${item.dataset.id}"] .grip`, list)?.focus(), 0);
  });
}

// Arrastar a linha para o lado: solta depois de ~90px e chama onSwipe(id). Rolar para cima/baixo continua normal.
function swipeable(list, onSwipe) {
  list.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.item[data-id]');
    if (!item || e.target.closest('.grip,button,a,input') || e.button > 0) return;
    const x0 = e.clientX, y0 = e.clientY; let on = false, dx = 0;
    const end = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', cancel);
      const go = on && Math.abs(dx) > 90;
      item.classList.remove('swiping', 'will-del'); item.style.transform = '';
      if (go) onSwipe(+item.dataset.id);
    };
    const cancel = () => { dx = 0; end(); };
    const move = (ev) => {
      dx = ev.clientX - x0; const dy = ev.clientY - y0;
      if (!on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return cancel(); if (Math.abs(dx) < 10) return; on = true; item.classList.add('swiping'); }
      item.style.transform = `translateX(${dx}px)`; item.classList.toggle('will-del', Math.abs(dx) > 90);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', cancel);
  });
}

let taskKid = null; // filho escolhido na aba Tarefas ('all' = todas as tarefas)
async function adminTasks(pane, refresh) {
  const [tasks, kids, rewards] = await Promise.all([api('GET', '/admin/tasks'), api('GET', '/admin/kids'), api('GET', '/admin/rewards')]);
  const kidsOn = kids.filter(k => k.active);
  if (taskKid !== 'all' && !kidsOn.some(k => k.id === taskKid)) taskKid = kidsOn[0]?.id ?? 'all';
  const kid = kidsOn.find(k => k.id === taskKid);
  const ko = kid ? await api('GET', `/admin/kids/${kid.id}/order`) : null;
  let order = ko ? ko.ids : tasks.filter(t => t.active).map(t => t.id);
  const off = kid ? [] : tasks.filter(t => !t.active);
  const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
  const when = (t) => t.carry ? `Até fazer (desde ${dmy(t.date)})` : t.type === 'daily' ? (t.weekdays.length === 7 ? 'Todo dia' : [...t.weekdays].map(d => DAYN[d]).join(', '))
    : `${dmy(t.date)}${t.repeat_weekly ? `, toda ${DAYN[new Date(t.date + 'T12:00:00').getDay()]}` : ''}`;
  const who = (t) => t.all_kids === 2 ? 'Toda a família' : t.all_kids ? 'Todos os filhos' : t.kid_ids.map(id => kids.find(k => k.id === id)?.name).filter(Boolean).join(', ') || 'Ninguém';
  // linha curta: quando (com o horário, se tiver) e moedas; na visão da família, para quem é (se não for de todos)
  const line = (t) => [esc(when(t)) + (t.time ? ' · <b class="tm">' + esc(t.time) + '</b>' : ''), t.coins > 0 ? `${num(t.coins)} moedas` : '', !kid && t.all_kids !== 1 ? esc(who(t)) : ''].filter(Boolean).join(' · ');
  const pen = (t) => `<button class="btn ghost sm icon-only" data-e="${t.id}" aria-label="Editar ${esc(t.title)}" title="Editar">${im('pencil')}</button>`;
  const plain = (t) => `<div class="item off"><div class="ic">${im(t.icon)}</div><div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="s">${line(t)}</div></div><div class="btns">${pen(t)}</div></div>`;
  const rows = () => order.map(id => { const t = byId[id]; return `<div class="item" data-id="${t.id}">
      <button type="button" class="grip" aria-label="Mover ${esc(t.title)}. Use as setas para subir ou descer">${SVG.grip}</button>
      <div class="ic">${im(t.icon)}</div><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${line(t)}</div></div>
      <div class="btns">${pen(t)}</div></div>`; }).join('');
  const lead = !order.length ? '' : `Arraste <span class="grip-ic">${SVG.grip}</span> para mudar a ordem. Deslize para o lado para ${kid ? `tirar só de ${esc(kid.name)}` : 'apagar'}.${kid && ko.custom ? ` <button type="button" class="link" id="fam">Voltar para a ordem da família</button>` : ''}`;
  const catN = (await api('GET', '/admin/catalog')).tasks.filter(t => !t.have).length;
  pane.innerHTML = `<section class="box tasks-box"><div class="box-h"><h2 class="d">Tarefas</h2><div class="btns">${catN ? `<button class="btn ghost sm" id="cat">${im('sparkles')}Prontas (${catN})</button>` : ''}<button class="btn green sm" id="new">Nova tarefa</button></div></div>
    <div class="kid-pick slim" role="group" aria-label="Ver tarefas de"><button type="button" class="kp" data-kid="all" aria-pressed="${taskKid === 'all'}">${im('people')}Família</button>${kidsOn.map(k => `<button type="button" class="kp" data-kid="${k.id}" aria-pressed="${k.id === taskKid}" style="--c:${esc(k.color)}">${im(k.avatar, '', 'fox')}${esc(k.name)}</button>`).join('')}</div>
    ${lead ? `<p class="hint tasks-hint">${lead}</p>` : ''}
    ${order.length ? `<div class="list" id="tl">${rows()}</div>` : zero('clipboard', kid ? `${esc(kid.name)} ainda não tem tarefas ativas.` : 'Crie a primeira tarefa da casa.')}
    ${off.length ? `<h3 class="sub-h">Inativas</h3><div class="list">${off.map(plain).join('')}</div>` : ''}</section>`;
  $$('[data-kid]').forEach(b => b.onclick = () => { taskKid = b.dataset.kid === 'all' ? 'all' : +b.dataset.kid; sfx.tap(); adminTasks(pane, refresh).catch(e => toast(e.message, true)); });
  const fam = $('#fam'); if (fam) fam.onclick = guard(async () => { await api('DELETE', `/admin/kids/${kid.id}/order`); toast(`${kid.name} segue a ordem da família`); adminTasks(pane, refresh); });
  if ($('#tl')) sortable($('#tl'), guard(async (ids) => {
    order = ids;
    if (kid) { await api('PUT', `/admin/kids/${kid.id}/order`, { ids }); if (!ko.custom) adminTasks(pane, refresh); }
    else await api('PUT', '/admin/tasks/order', { ids });
  }));
  if ($('#tl')) swipeable($('#tl'), (id) => {
    const t = byId[id]; sfx.tap();
    if (kid) sheet(`Tirar de ${kid.name}?`, `<p class="lead" style="margin-top:6px"><b>${esc(t.title)}</b> deixa de aparecer só para ${esc(kid.name)}. Os outros continuam com ela.</p>`,
      async () => { await api('DELETE', `/admin/kids/${kid.id}/tasks/${id}`); toast(`Tirada de ${kid.name}`); refresh(); }, { saveLabel: 'Tirar', danger: true });
    else sheet('Apagar a tarefa?', `<p class="lead" style="margin-top:6px"><b>${esc(t.title)}</b> sai da lista de todos os filhos.</p>`,
      async () => { const r = await api('DELETE', `/admin/tasks/${id}`); toast(r.archived ? 'Tarefa desativada (já tinha histórico)' : 'Tarefa apagada'); refresh(); }, { saveLabel: 'Apagar', danger: true });
  });
  const blank = () => ({ title: '', icon: 'star', description: '', type: 'daily', weekdays: '0123456', date: '', time: '', repeat_weekly: 0, carry: 0, coins: 0, minutes: 0, all_kids: 1, kid_ids: [], reward_ids: [], active: 1 });
  const form = (t = blank()) => `
    ${iconName('tt', 'Nome da tarefa', `<input id="tt" name="title" value="${esc(t.title)}" placeholder="Arrumar a cama" required>`, TASK_ICONS, slug(t.icon))}
    <div class="field"><label for="td">Detalhe (opcional)</label><input id="td" name="description" value="${esc(t.description)}" placeholder="Antes do café"></div>
    <div class="field"><span class="lab">Quando</span>${seg('type', [['daily', 'Repete'], ['one_off', 'Dia marcado'], ['carry', 'Até fazer']], t.carry ? 'carry' : t.type)}
      <p class="hint" data-show="carry">Fica na lista todo dia até ser feita, como limpar o ventilador. Depois de feita, some.</p></div>
    <div class="field" data-show="daily"><span class="lab">Dias da semana</span><div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" name="wd" value="${i}" ${t.weekdays.includes(i) ? 'checked' : ''}><span title="${DAYN[i]}">${d}</span></label>`).join('')}</div></div>
    <div data-show="one_off carry"><div class="field"><label for="tdt" data-dl>Data</label><input id="tdt" type="date" name="date" value="${esc(t.date || ymd(new Date()))}"></div>
      <label class="check" data-show="one_off"><input type="checkbox" name="repeat_weekly" ${t.repeat_weekly ? 'checked' : ''}>Repetir toda semana neste dia</label></div>
    <div class="frow3">
      <div class="field"><label for="th">Horário</label><input id="th" type="time" name="time" value="${esc(t.time || '')}"></div>
      <div class="field"><label for="tmin">Cronômetro</label><input id="tmin" type="number" min="0" max="600" step="1" name="minutes" value="${+t.minutes || ''}" placeholder="min" inputmode="numeric"></div>
      <div class="field"><label for="tc">Moedas</label><input id="tc" type="number" step="0.5" min="0" name="coins" value="${t.coins}" inputmode="decimal"></div>
    </div>
    <p class="hint">Horário e cronômetro são opcionais. Cronômetro em minutos (ex.: ler 45). 0 moedas = não vale moeda.</p>
    <div class="field"><span class="lab">Quem faz</span>${seg('all_kids', [['1', 'Os filhos'], ...(kidsOn.some(k => k.adult) ? [['2', 'Toda a família']] : []), ['0', 'Escolher']], String(t.all_kids === 2 && !kidsOn.some(k => k.adult) ? 1 : t.all_kids))}
      <p class="hint" data-hint></p>
      <div data-kids class="checks">${kidsOn.map(k => `<label class="check"><input type="checkbox" name="kid" value="${k.id}" ${t.kid_ids.includes(k.id) ? 'checked' : ''}>${im(k.avatar, '', 'fox')}${esc(k.name)}${k.adult ? ' <span class="muted">adulto</span>' : ''}</label>`).join('')}</div></div>
    <div class="field"><span class="lab">Recompensas que esta tarefa alimenta</span><div class="checks">
      ${rewards.filter(r => r.active && !(r.kind === 'goal' && r.goal_mode === 'coins')).map(r => { const linked = t.reward_ids.includes(r.id); return `<label class="check"><input type="checkbox" name="rw" value="${r.id}" data-t="${r.total_value}" data-n="${r.task_count}" data-linked="${linked ? 1 : 0}" data-k="${r.kind}" data-u="${esc(r.unit)}" ${linked ? 'checked' : ''}>${im(r.icon, '', 'game')}${esc(r.title)}<span class="muted" data-pv></span></label>`; }).join('') || '<p class="hint">Crie recompensas na aba Recompensas.</p>'}</div></div>
    <label class="check"><input type="checkbox" name="active" ${t.active ? 'checked' : ''}>Tarefa ativa</label>`;
  const read = (f) => ({
    title: f.title.value, icon: f.icon.value, description: f.description.value, type: f.type.value === 'carry' ? 'one_off' : f.type.value,
    weekdays: $$('[name=wd]:checked', f).map(x => x.value).join('') || '0123456', date: f.date.value, time: f.time.value,
    repeat_weekly: f.type.value === 'one_off' && f.repeat_weekly.checked, carry: f.type.value === 'carry', coins: f.coins.value, minutes: f.minutes.value, all_kids: +f.all_kids.value,
    kid_ids: $$('[name=kid]:checked', f).map(x => +x.value), reward_ids: $$('[name=rw]:checked', f).map(x => +x.value), active: f.active.checked,
  });
  const wire = (bg) => {
    const f = bg.querySelector('form');
    const upd = () => {
      $$('[data-show]', f).forEach(d => d.hidden = !d.dataset.show.split(' ').includes(f.type.value));
      $('[data-dl]', f).textContent = f.type.value === 'carry' ? 'Aparece a partir de' : 'Data';
      $('[data-kids]', f).hidden = f.all_kids.value !== '0';
      $('[data-hint]', f).textContent = f.all_kids.value === '1' ? 'Todos os filhos, inclusive os que entrarem depois.' : f.all_kids.value === '2' ? 'Filhos e adultos que participam da rotina. Adultos não ganham moedas.' : '';
      $$('[name=rw]', f).forEach(c => {
        const n = +c.dataset.n + (c.checked && c.dataset.linked === '0' ? 1 : 0) - (!c.checked && c.dataset.linked === '1' ? 1 : 0);
        c.parentElement.querySelector('[data-pv]').textContent = !c.checked ? '' : c.dataset.k === 'time' ? `${num(c.dataset.t / n)} ${c.dataset.u} cada (${n} tarefas)` : '+1 na meta';
      });
    };
    f.addEventListener('change', upd); upd();
  };
  $('#new').onclick = () => wire(sheet('Nova tarefa', form(kid ? { ...blank(), all_kids: 0, kid_ids: [kid.id] } : undefined), async (f) => { await api('POST', '/admin/tasks', read(f)); toast('Tarefa criada'); refresh(); }, { saveLabel: 'Criar tarefa' }));
  if ($('#cat')) $('#cat').onclick = guard(async () => {
    const c = await api('GET', '/admin/catalog'), free = c.tasks.filter(t => !t.have);
    if (!free.length) return toast('Todas as tarefas do catálogo já estão na sua lista.');
    sheet('Tarefas prontas', `<p class="lead" style="margin-top:6px">Marque as que quer adicionar. Elas valem para todos os filhos e entram nas recompensas ativas (o tempo de tela se redivide).</p>
      ${catalogGrid(c.groups, free, new Set())}`,
      async (f) => { const keys = $$('[name=ck]:checked', f).map(x => x.value); const r = await api('POST', '/admin/catalog', { keys }); toast(`${r.created} tarefa(s) adicionada(s)`); refresh(); }, { saveLabel: 'Adicionar' });
  });
  $$('[data-e]').forEach(b => b.onclick = () => { const t = tasks.find(x => x.id == b.dataset.e); wire(sheet('Editar tarefa', form(t), async (f) => { await api('PUT', '/admin/tasks/' + t.id, read(f)); refresh(); })); });
}

// Editor de itens de roleta (usado pela roleta do dia e pelas de correção): emoji, nome e moedas
const WHEEL_EMOJIS = ['🤗','😘','🎮','📺','🎬','🍦','🍫','🍕','🍔','🍿','🎂','🧁','🎁','🎈','🎉','⭐','🏆','🎯','🎲','🧩','🎨','📚','⚽','🚲','🏊','🛝','🎡','🎢','🐶','🐱','🦄','🚗','✈️','🌙','🛏️','🛁','🧸','🎵','💰','🪙','❤️','👏','🎤','🏖️',
  '⏰','📵','🧹','🧺','🍽️','🙏','🤝','💌','🤫','🗣️','🧘','🚫','🪑','📝','🧽','🌱'];
const prizeRow = (p = {}, coinHint) => `<div class="prow"><button type="button" class="btn ghost sm pe" aria-label="Escolher ícone" data-v="${esc(p.emoji || '')}">${esc(p.emoji || '') || '🎁'}</button>
  <input class="pl" aria-label="Nome" maxlength="40" value="${esc(p.label || '')}" placeholder="${coinHint === 'lose' ? 'Sem tela por 20 min' : 'Abraço do pai'}">
  <label class="pcoin" title="${coinHint === 'lose' ? 'Moedas que perde' : 'Moedas que ganha'}">${im('coin')}<input class="pc" type="number" min="0" max="1000" step="1" inputmode="numeric" value="${+p.coins || ''}" placeholder="0" aria-label="${coinHint === 'lose' ? 'Moedas que perde' : 'Moedas que ganha'}"></label>
  <button type="button" class="btn ghost sm px" aria-label="Tirar este item">✕</button></div>`;
function prizeEditor(list, coinHint) {
  return `<div id="prows">${list.map(p => prizeRow(p, coinHint)).join('')}</div>
    <button type="button" class="btn ghost sm" id="padd">Adicionar item</button>
    <div class="emo-pick" id="emo" hidden><p class="hint">Toque no ícone:</p><div class="emo-grid">${WHEEL_EMOJIS.map(e => `<button type="button" class="emo" data-e="${e}">${e}</button>`).join('')}</div></div>`;
}
function wirePrizeEditor(bg, coinHint) {
  $('#padd', bg).onclick = () => { if ($$('.prow', bg).length >= 12) return toast('No máximo 12 itens', true); $('#prows', bg).insertAdjacentHTML('beforeend', prizeRow({}, coinHint)); $$('.pl', bg).at(-1).focus(); };
  let cur = null; const emo = $('#emo', bg);
  bg.addEventListener('click', (e) => {
    const x = e.target.closest('.px'); if (x) { if (cur && x.parentElement.contains(cur)) { cur = null; emo.hidden = true; } x.parentElement.remove(); return; }
    const pe = e.target.closest('.pe'); if (pe) { cur = pe; $$('.pe', bg).forEach(b => b.classList.toggle('sel', b === pe)); emo.hidden = false; emo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const em = e.target.closest('.emo'); if (em && cur) { cur.dataset.v = em.dataset.e; cur.textContent = em.dataset.e; cur.classList.remove('sel'); cur = null; emo.hidden = true; sfx.tap(); }
  });
}
// lê as linhas; item só com moedas vira "50 moedas"
const readPrizes = (f, coinHint) => $$('.prow', f).map(r => {
  const coins = Math.max(0, Math.round(+$('.pc', r).value || 0)), label = $('.pl', r).value.trim();
  return { emoji: $('.pe', r).dataset.v || (coins && !label ? '💰' : ''), label: label || (coins ? (coinHint === 'lose' ? `Perde ${coins} moedas` : `${coins} moedas`) : ''), coins };
}).filter(p => p.label);
const coinTag = (p, lose) => +p.coins ? ` <small class="ptag">${lose ? '−' : '+'}${num(p.coins)} 🪙</small>` : '';

// Aba Roletas: as três juntas (do dia, de correção e extra)
async function adminWheels(pane) {
  pane.innerHTML = `<section class="box" id="wDay"></section><section class="box" id="wFix"></section><section class="box" id="wFree"></section>`;
  const fail = (e) => toast(e.message, true);
  adminWheel($('#wDay')).catch(fail); adminFix($('#wFix'), 'fix').catch(fail); adminFix($('#wFree'), 'free').catch(fail);
}

// Miniatura de roleta (só as fatias coloridas), para as listas
function wheelThumb(n, kind = 'bonus') {
  const cols = WHEEL_COLS[kind] || WHEEL_COLS.bonus; n = Math.max(2, n);
  const pt = (a) => { const t = (a - 90) * Math.PI / 180; return `${(50 + 50 * Math.cos(t)).toFixed(2)} ${(50 + 50 * Math.sin(t)).toFixed(2)}`; };
  return `<svg class="wthumb" viewBox="0 0 100 100" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<path d="M50 50 L${pt(i * 360 / n)} A50 50 0 0 1 ${pt((i + 1) * 360 / n)} Z" fill="${cols[i === n - 1 && i % cols.length === 0 ? 2 : i % cols.length]}" stroke="#0d1b4c" stroke-width="2"/>`).join('')}<circle cx="50" cy="50" r="9" fill="#fff" stroke="#0d1b4c" stroke-width="3"/></svg>`;
}
const histBox = (title, rows) => rows ? `<details class="hist"><summary>${title}</summary><div class="list">${rows}</div></details>` : '';

// Roleta do dia: o pai escolhe o que pode cair; quem termina todas as missões gira uma vez por dia
async function adminWheel(box) {
  const { prizes, spins, sample: isSample } = await api('GET', '/admin/wheel');
  box.innerHTML = `<div class="box-h"><h2 class="d">Roleta do dia</h2><button class="btn green sm" id="wedit">${isSample ? 'Montar roleta' : 'Editar prêmios'}</button></div>
    <p class="lead">Quando um filho termina todas as missões do dia, ganha um giro.</p>
    <div class="item wsum"><div class="ic">${wheelThumb(prizes.length)}</div><div class="grow"><div class="t">${prizes.length} prêmios</div>
      <div class="s">${isSample ? 'Prêmios de exemplo. Toque em Montar roleta para escolher os seus.' : 'Todos com a mesma chance de cair.'}</div></div></div>
    ${histBox(`Ver últimos giros (${spins.length})`, spins.map(s => `<div class="item"><div class="grow"><div class="t">${esc(s.kid)} ganhou ${esc(s.emoji || '')} ${esc(s.label)}${coinTag(s)}</div><div class="s">${dayName(s.day)}</div></div></div>`).join(''))}`;
  const sample = [['🤗', 'Abraço do pai'], ['🤗', 'Abraço da mãe'], ['🎮', '20 min de game'], ['🍦', 'Sorvete'], ['🎬', 'Escolher o filme'], ['💰', '50 moedas', 50]].map(([emoji, label, coins = 0]) => ({ emoji, label, coins }));
  $('#wedit').onclick = () => {
    const bg = sheet('Prêmios da roleta', `<p class="lead" style="margin-top:6px">Até 12 prêmios, todos com a mesma chance. No campo da moedinha coloque moedas para o prêmio cair direto na conta (ex.: 50). Deixe vazio se não valer moedas.</p>
      ${prizeEditor(isSample ? sample : prizes)}`,
      async (f) => {
        const list = readPrizes(f);
        if (list.length === 1) throw new Error('Coloque pelo menos 2 prêmios');
        await api('PUT', '/admin/wheel', { prizes: list }); toast('Roleta salva'); adminWheel(box);
      });
    wirePrizeEditor(bg);
  };
}

// Roletas de correção: para implicância, desobediência, gritaria… Os pais escolhem quem gira.
async function adminFix(box, kind = 'fix') {
  const free = kind === 'free';
  const [{ wheels: all, spins: allSpins }, kids] = await Promise.all([api('GET', '/admin/fix'), api('GET', '/admin/kids')]);
  const wheels = all.filter(w => (w.kind || 'fix') === kind), spins = allSpins.filter(s => (s.kind || 'fix') === kind);
  const on = kids.filter(k => k.active);
  const when = (t) => new Date(t.replace(' ', 'T') + (t.endsWith('Z') ? '' : 'Z')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `<div class="box-h"><h2 class="d">${free ? 'Roletas extras' : 'Roletas de correção'}</h2>${wheels.length ? `<button class="btn ghost sm" id="fixNew">Nova roleta</button>` : ''}</div>
    <p class="lead">${free ? 'Para dar um bônus, fazer um sorteio ou só brincar. Não depende das missões: você escolhe quem gira e o que cai. As moedinhas dos itens entram na conta de quem girar.' : 'Para os momentos de confusão: implicância com o irmão, desobediência, gritaria. Escolha quem e qual roleta; gira aqui no seu aparelho ou na tela dele.'}</p>
    ${free && on.length > 1 ? `<div class="draw-row"><button class="btn green sm" id="drawBtn">${im('people')}Sortear entre os filhos</button></div>` : ''}
    ${wheels.length ? `<div class="list">${wheels.map(w => `<div class="item"><div class="ic">${wheelThumb(w.items.length, free ? 'bonus' : 'fix')}</div><div class="grow"><div class="t">${esc(w.name)}</div>
      <div class="s">${w.items.length} itens</div></div>
      <div class="btns"><button class="btn sm" data-use="${w.id}">Usar</button><button class="btn ghost sm" data-fe="${w.id}">Editar</button></div></div>`).join('')}</div>`
    : free ? `<div class="fix-empty">${zero('party', 'Nenhuma roleta extra ainda.')}<div class="actions"><button class="btn green" id="fixNew">Criar uma roleta extra</button></div>
      <p class="hint">Exemplos: "Bônus do fim de semana", "Quem escolhe o filme", "Sorteio do doce".</p></div>`
    : `<div class="fix-empty">${zero('shield', 'Nenhuma roleta de correção ainda.')}<div class="actions"><button class="btn green" id="fixSample">Começar com sugestões</button><button class="btn ghost" id="fixNew">Criar do zero</button></div>
      <p class="hint">As sugestões trazem Desobediência, Implicância e Gritaria. Você pode mudar tudo depois.</p></div>`}
    ${histBox(`${free ? 'Ver últimos giros' : 'Ver últimas correções'} (${spins.length})`, spins.map(s => `<div class="item"><div class="grow"><div class="t">${esc(s.kid)} · ${esc(s.wheel_name)}</div>
      <div class="s">${when(s.created_at)} · ${s.spun_at ? `<b>${esc(s.emoji || '')} ${esc(s.label)}</b>${s.coins ? ` (${free ? '+' : '−'}${num(s.coins)} moedas)` : ''}` : 'esperando girar na tela dele'}</div></div>
      ${s.spun_at ? '' : `<div class="btns"><button class="btn ghost sm" data-fx="${s.id}">Cancelar</button></div>`}</div>`).join(''))}`;
  const reload = () => adminFix(box, kind).catch(e => toast(e.message, true));
  const edit = (w) => {
    const bg = sheet(w ? 'Editar roleta' : free ? 'Nova roleta extra' : 'Nova roleta de correção', `<div class="field"><label for="fxn">Nome da roleta</label><input id="fxn" name="name" maxlength="40" value="${esc(w?.name || '')}" placeholder="Implicância" required></div>
      <p class="lead" style="margin-top:4px">${free ? 'O que pode cair (até 12, todos com a mesma chance). No campo da moedinha coloque quantas moedas a criança ganha, se quiser.' : 'O que pode cair (até 12, todos com a mesma chance). No campo da moedinha coloque quantas moedas a criança perde, se quiser.'}</p>
      ${prizeEditor(w ? w.items : [{}, {}, {}], free ? '' : 'lose')}
      ${w ? '<button type="button" class="btn ghost sm danger-link" id="fxDel">Apagar esta roleta</button>' : ''}`,
      async (f) => {
        const body = { name: f.name.value, items: readPrizes(f, free ? '' : 'lose'), kind };
        if (body.items.length < 2) throw new Error('Coloque pelo menos 2 itens');
        if (w) await api('PUT', '/admin/fix/' + w.id, body); else await api('POST', '/admin/fix', body);
        toast('Roleta salva'); reload();
      });
    wirePrizeEditor(bg, free ? '' : 'lose');
    const del = $('#fxDel', bg);
    if (del) del.onclick = () => sheet(`Apagar "${w.name}"?`, '<p class="lead" style="margin-top:6px">O histórico das correções já feitas continua.</p>',
      async () => { await api('DELETE', '/admin/fix/' + w.id); bg.remove(); toast('Roleta apagada'); reload(); }, { saveLabel: 'Apagar', danger: true });
  };
  $$('#fixNew', box).forEach(b => b.onclick = () => edit(null));
  const smp = $('#fixSample', box); if (smp) smp.onclick = guard(async () => { await api('POST', '/admin/fix/samples'); sfx.done(); toast('Roletas criadas'); reload(); });
  const dr = $('#drawBtn', box); if (dr) dr.onclick = () => sheet('Sortear entre os filhos', `<div class="field"><span class="lab">Quem entra no sorteio?</span><div class="kid-pick">${on.map(k => `<label class="kp-check"><input type="checkbox" name="to" value="${k.id}" checked><span style="--c:${esc(k.color)}">${im(k.avatar, '', 'fox')}${esc(k.name)}</span></label>`).join('')}</div></div>`,
    async (f) => {
      const ids = $$('[name=to]:checked', f).map(x => +x.value);
      if (ids.length < 2) throw new Error('Escolha pelo menos 2 jogadores');
      const first = await api('POST', '/admin/draw', { kid_ids: ids }); let used = false;
      setTimeout(() => openWheel({ ...freeWheel({ name: 'Sorteio', prizes: first.prizes }, async () => { if (used) return api('POST', '/admin/draw', { kid_ids: ids }); used = true; return first; }, 'Quem será o sorteado?', 'Sorteado:'), done: reload }), 50);
    }, { saveLabel: 'Sortear' });
  $$('[data-fe]', box).forEach(b => b.onclick = () => edit(wheels.find(w => w.id === +b.dataset.fe)));
  $$('[data-fx]', box).forEach(b => b.onclick = guard(async () => { await api('DELETE', '/admin/fix-spins/' + b.dataset.fx); toast('Correção cancelada'); reload(); }));
  $$('[data-use]', box).forEach(b => b.onclick = () => {
    const w = wheels.find(x => x.id === +b.dataset.use);
    if (!on.length) return toast('Cadastre um jogador primeiro', true);
    const bg = sheet(`Roleta: ${w.name}`, `<div class="field"><span class="lab">Quem vai girar?</span><div class="kid-pick">${free ? `<label class="kp-check"><input type="radio" name="kid" value="0"><span style="--c:#8892b0">${im('party')}Só por diversão</span></label>` : ''}${on.map((k, i) => `<label class="kp-check"><input type="radio" name="kid" value="${k.id}" ${on.length === 1 && !i ? 'checked' : ''}><span style="--c:${esc(k.color)}">${im(k.avatar, '', 'fox')}${esc(k.name)}</span></label>`).join('')}</div></div>
      <div class="field"><span class="lab">Onde girar</span>${seg('where', [['here', 'Aqui, agora'], ['kid', 'Na tela dele']], 'here')}</div>`,
      async (f) => {
        if (free && f.kid.value === '0') { // ninguém ganha nada: só gira aqui na tela
          setTimeout(() => openWheel({ ...freeWheel({ name: w.name, prizes: w.items }, () => api('POST', `/admin/fix/${w.id}/free-spin`, {}), 'Só por diversão: ninguém ganha moedas.', 'Saiu:'), done: reload }), 50);
          return;
        }
        const kid = on.find(k => k.id === +(f.kid.value || 0));
        if (!kid) throw new Error('Escolha quem vai girar');
        const r = await api('POST', `/admin/fix/${w.id}/apply`, { kid_id: kid.id });
        if (f.where.value === 'kid') { toast(`Pronto: a roleta aparece na tela de ${kid.name}`); reload(); return; }
        setTimeout(() => openWheel({ ...(free ? freeWheel(r, () => api('POST', `/admin/fix-spins/${r.id}/spin`, {}), `Vez de ${kid.name} girar!`) : fixWheel(r, () => api('POST', `/admin/fix-spins/${r.id}/spin`, {}), kid.name)), done: reload }), 50);
      }, { saveLabel: 'Continuar' });
    bg.querySelector('.kid-pick').addEventListener('change', () => sfx.tap());
  });
}

async function adminRewards(pane, refresh) {
  const [rewards, allKids, allTasks, wal] = await Promise.all([api('GET', '/admin/rewards'), api('GET', '/admin/kids'), api('GET', '/admin/tasks'), api('GET', '/admin/wallet')]);
  // progresso de cada filho nas metas, e quem pode usar o tempo de tela
  const prog = (r) => wal.kids.map(k => ({ k, g: k.goals.find(g => g.id === r.id) })).filter(x => x.g);
  const myTasks = allTasks.filter(t => t.active);
  const kidsOnly = allKids.filter(k => k.active && !k.adult);
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Prêmios e metas</h2><button class="btn green sm" id="new">Nova recompensa</button></div>
    <p class="lead">Tempo de tela: o total do dia é dividido igualmente entre as tarefas ligadas a ele (20 min com 10 tarefas = 2 min cada). Metas contam missões ou moedas até serem alcançadas.</p>
    ${rewards.length ? `<div class="list">${rewards.map(r => `<div class="item ${r.active ? '' : 'off'}"><div class="ic">${im(r.icon, '', 'game')}</div><div class="grow"><div class="t">${esc(r.title)}</div>
      <div class="s">${r.kind === 'time' ? `${num(r.total_value)} ${esc(r.unit)} por dia · ${r.task_count} tarefa(s)${r.task_count ? ` · ${num(r.total_value / r.task_count)} ${esc(r.unit)} cada` : ''}` : `Meta: ${num(r.total_value)} ${r.goal_mode === 'coins' ? 'moedas' : 'missões'}`}${r.kid_id ? ` · <b>só para ${esc(r.kid_name || '?')}</b>` : ''}</div>
      ${r.kind === 'goal' && r.active ? `<div class="gprog">${prog(r).map(({ k, g }) => `<div class="gp"><span class="gn">${esc(k.name)}</span><span class="bar"><i style="width:${Math.min(100, g.progress / g.target * 100).toFixed(1)}%"></i></span><span class="num">${num(g.progress)}/${num(g.target)}</span>${g.ready && full() ? `<button class="btn green sm" data-redeem="${k.id}:${r.id}">Entregar</button>` : ''}</div>`).join('')}</div>` : ''}</div>
      <div class="btns">${r.kind === 'time' && r.active && wal.kids.length ? `<button class="btn ghost sm" data-use="${r.id}">${im('stopwatch')}Tempo usado</button>` : ''}<button class="btn ghost sm" data-e="${r.id}">Editar</button></div></div>`).join('')}</div>` : zero('gift', 'Crie tempo de videogame, YouTube ou uma meta como ir ao parque.')}</section>`;
  const form = (r = { title: '', icon: 'game', kind: 'time', unit: 'min', total_value: 20, goal_mode: 'tasks', active: 1 }) => `
    ${iconName('rn', 'Nome', `<input id="rn" name="title" value="${esc(r.title)}" placeholder="Videogame, YouTube, Parque de diversão" required>`, REWARD_ICONS, slug(r.icon, 'game'))}
    <div class="field"><span class="lab">Tipo</span>${seg('kind', [['time', 'Tempo por dia'], ['goal', 'Meta']], r.kind)}</div>
    <div class="field" data-show="goal"><span class="lab">A meta conta</span>${seg('goal_mode', [['tasks', 'Missões feitas'], ['coins', 'Moedas']], r.goal_mode || 'tasks')}</div>
    <div class="field"><label for="rv" data-lbl>Minutos por dia</label><input id="rv" type="number" step="any" min="1" name="total_value" value="${r.total_value}" inputmode="decimal" required></div>
    ${kidsOnly.length > 1 || r.kid_id ? `<div class="field"><label for="rk">Para quem</label><select id="rk" name="kid_id"><option value="">Todos os filhos</option>${kidsOnly.map(k => `<option value="${k.id}" ${k.id === r.kid_id ? 'selected' : ''}>Só ${esc(k.name)}</option>`).join('')}</select>
      <p class="hint">Só aquele filho vê e ganha esta recompensa, mesmo que as tarefas sejam de todos.</p></div>` : ''}
    ${myTasks.length ? `<div class="field" data-tasks><span class="lab">Missões que contam <button type="button" class="btn ghost sm" data-all>Marcar todas</button> <button type="button" class="btn ghost sm" data-none>Tirar todas</button></span>
      <div class="rw-tasks">${myTasks.map(t => `<label class="check"><input type="checkbox" name="tk" value="${t.id}" ${!r.id || t.reward_ids.includes(r.id) ? 'checked' : ''}>${esc(t.title)}</label>`).join('')}</div>
      <p class="hint">Tempo: o total do dia é dividido entre as missões marcadas. Meta: cada missão feita soma +1. Missões novas você liga na própria missão.</p></div>` : ''}
    <label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}>Ativa</label>`;
  const read = (f) => ({ task_ids: myTasks.length ? $$('[name=tk]:checked', f).map(x => +x.value) : undefined, title: f.title.value, icon: f.icon.value, kind: f.kind.value, goal_mode: f.goal_mode.value, total_value: f.total_value.value, active: f.active.checked, kid_id: f.kid_id ? +f.kid_id.value || null : null });
  const wire = (bg) => { const f = bg.querySelector('form'); const tk = $('[data-tasks]', f); if (tk) { $('[data-all]', tk).onclick = () => $$('[name=tk]', tk).forEach(x => { x.checked = true; }); $('[data-none]', tk).onclick = () => $$('[name=tk]', tk).forEach(x => { x.checked = false; }); }
    const u = () => { $('[data-show]', f).hidden = f.kind.value !== 'goal'; if (tk) tk.hidden = f.kind.value === 'goal' && f.goal_mode.value === 'coins'; $('[data-lbl]', f).textContent = f.kind.value === 'goal' ? (f.goal_mode.value === 'coins' ? 'Quantas moedas custa' : 'Quantas missões para alcançar') : 'Minutos por dia'; }; f.addEventListener('change', u); u(); };
  $('#new').onclick = () => wire(sheet('Nova recompensa', form(), async (f) => { await api('POST', '/admin/rewards', read(f)); toast('Recompensa criada'); refresh(); }, { saveLabel: 'Criar' }));
  $$('[data-use]').forEach(b => b.onclick = () => { const r = rewards.find(x => x.id == b.dataset.use); sheet(`Tempo usado: ${r.title}`, `<div class="field"><label for="uk">Quem usou</label><select id="uk" name="kid">${wal.kids.map(k => `<option value="${k.id}">${esc(k.name)}</option>`).join('')}</select></div><div class="field"><label for="um">Minutos usados hoje</label><input id="um" name="m" type="number" step="any" min="1" required inputmode="numeric"></div>`,
    async (f) => { await api('POST', '/admin/use-time', { kid_id: +f.kid.value, reward_id: r.id, minutes: f.m.value }); toast('Tempo descontado'); refresh(); }, { saveLabel: 'Descontar' }); });
  $$('[data-redeem]').forEach(b => b.onclick = () => { const [k, g] = b.dataset.redeem.split(':'); sheet('Entregar meta', '<p class="lead" style="margin-top:6px">Confirme que o prêmio foi entregue. O progresso da meta volta a zero (metas em moedas descontam as moedas).</p>',
    async () => { await api('POST', '/admin/redeem', { kid_id: +k, reward_id: +g }); sfx.win(); toast('Meta entregue'); refresh(); }, { saveLabel: 'Confirmar entrega' }); });
  $$('[data-e]').forEach(b => b.onclick = () => { const r = rewards.find(x => x.id == b.dataset.e); wire(sheet('Editar recompensa', form(r), async (f) => { await api('PUT', '/admin/rewards/' + r.id, read(f)); refresh(); })); });
}

const ymd = (d) => d.toLocaleDateString('sv');
const dayName = (s) => {
  const now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (s === ymd(now)) return 'Hoje';
  if (s === ymd(y)) return 'Ontem';
  return `${DAYN[new Date(s + 'T12:00:00').getDay()]}, ${dmy(s).slice(0, 5)}`;
};
// Extrato de um filho por vez, como extrato de banco: dia, valor que entrou ou saiu e saldo no fim do dia
async function walletStatement(box, kids) {
  const days = await api('GET', '/admin/statement');
  const list = kids.filter(k => days.some(d => d.kids[k.id]));
  let cur = +(store.get('gt-stmt-kid') || 0); if (!list.some(k => k.id === cur)) cur = list[0]?.id;
  const cache = {};
  const sign = (v) => `${v < 0 ? '−' : '+'}${num(Math.abs(v))}`;
  const draw = () => {
    const mine = days.filter(d => d.kids[cur]), month = ymd(new Date()).slice(0, 7);
    const m = mine.filter(d => d.day.startsWith(month));
    const mi = m.reduce((a, d) => a + d.kids[cur].in, 0), mo = m.reduce((a, d) => a + d.kids[cur].out, 0);
    box.innerHTML = `<div class="box-h"><h2 class="d">Extrato</h2><span class="s muted">últimos 90 dias, em moedas</span></div>
      ${list.length > 1 ? `<div class="stmt-kids" role="tablist">${list.map(k => `<button type="button" role="tab" aria-selected="${k.id === cur}" class="${k.id === cur ? 'on' : ''}" data-k="${k.id}">${im(k.avatar, '', 'fox')}${esc(k.name)}</button>`).join('')}</div>` : ''}
      ${mine.length ? `<div class="stmt-month"><span>Neste mês</span><span>Entrou <b class="pos num">+${num(mi)}</b></span><span>Saiu <b class="neg num">−${num(mo)}</b></span></div>
      <div class="stmt-head"><span>Dia</span><span>Valor</span><span>Saldo</span></div>
      <div class="stmt">${mine.map(d => { const v = d.kids[cur]; return `<details class="sday" data-day="${d.day}"><summary><span class="dl">${dayName(d.day)}</span><i class="dots"></i><span class="amt num ${v.net < 0 ? 'neg' : 'pos'}">${sign(v.net)}</span><span class="bal num">${num(v.saldo)}</span></summary><ul class="dd"><li>Carregando…</li></ul></details>`; }).join('')}</div>`
      : zero('chart', 'As moedas que entram e saem aparecem aqui, dia a dia.')}`;
    $$('[data-k]', box).forEach(b => b.onclick = () => { cur = +b.dataset.k; store.set('gt-stmt-kid', String(cur)); sfx.tap(); draw(); });
    $$('.sday', box).forEach(el => el.addEventListener('toggle', guard(async () => {
      if (!el.open) return;
      const det = cache[el.dataset.day] ||= await api('GET', '/admin/statement/' + el.dataset.day);
      el.querySelector('.dd').innerHTML = (det[cur] || []).map(x => `<li><span class="grow">${esc(x.title)}${x.brl != null ? ` <small>(${brl(x.brl)})</small>` : ''}</span><i class="dots"></i><span class="amt num ${x.amount < 0 ? 'neg' : 'pos'}">${sign(x.amount)}</span></li>`).join('') || '<li>Nada neste dia.</li>';
    })));
  };
  draw();
}

async function adminWallet(pane, refresh) {
  const w = await api('GET', '/admin/wallet');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Carteira</h2><span class="rate">1 moeda = ${brl(w.settings.coin_value)}</span></div>
    ${w.kids.length ? `<div class="accts">${w.kids.map(k => `<div class="acct"><div class="acct-who">${im(k.avatar, '', 'fox')}<b>${esc(k.name)}</b></div>
      <div class="acct-bal"><span class="num">${im('coin')}${num(k.balance)}</span><small class="num">${brl(k.value)}</small></div>
      ${full() ? `<div class="acct-act"><button class="btn sm" data-pay="${k.id}" ${k.balance > 0 ? '' : 'disabled'}>Pagar</button><button class="btn ghost sm" data-adj="${k.id}">Ajustar</button></div>` : ''}</div>`).join('')}</div>` : zero('people', 'Cadastre os filhos primeiro.')}</section>
    <section class="box" id="stmt"></section>`;
  const kid = (id) => w.kids.find(k => k.id == id);
  $$('[data-pay]').forEach(b => b.onclick = () => { const k = kid(b.dataset.pay); sheet(`Pagar ${k.name}`, `<p class="lead" style="margin-top:6px">Saldo: <b>${num(k.balance)} moedas</b> (${brl(k.value)}). As moedas pagas saem do saldo e aparecem no extrato.</p><div class="field"><label for="pc">Quantas moedas pagar</label><input id="pc" name="coins" type="number" step="any" min="0.01" max="${k.balance}" value="${k.balance}" inputmode="decimal"></div>`,
    async (f) => { const r = await api('POST', '/admin/payout', { kid_id: k.id, coins: f.coins.value }); sfx.win(); toast(`Pagamento de ${brl(r.amount)} registrado`); refresh(); }, { saveLabel: 'Confirmar pagamento' }); });
  $$('[data-adj]').forEach(b => b.onclick = () => { const k = kid(b.dataset.adj); sheet(`Bônus ou desconto para ${k.name}`, `<div class="field"><label for="aa">Moedas</label><input id="aa" name="amount" type="number" step="any" required inputmode="decimal"><p class="hint">Positivo dá bônus, negativo desconta.</p></div><div class="field"><label for="an">Motivo</label><input id="an" name="note" placeholder="Ajudou a lavar o carro"></div>`,
    async (f) => { await api('POST', '/admin/adjust', { kid_id: k.id, amount: f.amount.value, note: f.note.value }); toast('Saldo ajustado'); refresh(); }); });
  await walletStatement($('#stmt'), w.kids);
}

async function adminSettings(pane, refresh) {
  const [w, mb, canFp] = await Promise.all([full() ? api('GET', '/admin/wallet') : null, api('GET', '/admin/members'), pkCan()]);
  const meM = mb.members.find(m => m.me) || {};
  const access = (m) => m.full_access ? 'Acesso completo' : 'Dia a dia';
  pane.innerHTML = `${full() ? `<form class="box" id="f" novalidate data-sum="1 moeda = ${brl(w.settings.coin_value)}"><div class="box-h"><h2 class="d">Moedas</h2></div>
      <div class="field"><label for="cv">Valor de 1 moeda em reais</label><input id="cv" name="coin_value" type="number" step="0.01" min="0" value="${w.settings.coin_value}" inputmode="decimal"></div>
      <p class="hint">A aprovação automática é escolhida em cada filho, na aba Filhos.</p>
      <div class="err" role="alert"></div><div class="actions"><button class="btn green">Salvar ajustes</button></div></form>` : ''}
    <section class="box" data-sum="PIN${canFp ? ' e digital' : ''} · ${esc(meM.name || '')}"><div class="box-h"><h2 class="d">Meu acesso</h2></div>
      <form id="pinf" class="inline-form" novalidate><div class="field"><label for="np">Meu PIN</label><input id="np" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" placeholder="Novo PIN"></div>
        <button class="btn sm">Trocar PIN</button></form>
      <div class="fp-row">${SVG.finger}${!canFp ? '<span>Este aparelho não tem leitor de digital ou de rosto disponível para o navegador.</span>'
        : pkIds().length ? '<span><b>Digital ativada neste aparelho.</b> O painel abre sem o PIN.</span><button class="btn ghost sm" id="fpOff">Desativar</button>'
        : '<span>Abra o painel com a digital ou o rosto neste aparelho.</span><button class="btn green sm" id="fpAdd">Ativar</button>'}</div></section>
    ${full() ? `<section class="box" data-sum="${mb.members.length} ${mb.members.length === 1 ? 'pessoa' : 'pessoas'}${mb.invites.length ? ' · convite aguardando' : ''}"><div class="box-h"><h2 class="d">Responsáveis</h2><button class="btn green sm" id="inv">${im('people')}Convidar</button></div>
      <p class="lead">Pai, mãe, babá ou avós: cada um entra no próprio celular com e-mail, senha e PIN, e pode usar a digital.</p>
      <div class="list">${mb.members.map(m => `<div class="item"><div class="ic">${im(m.plays ? m.avatar : 'people', '', 'fox')}</div>
        <div class="grow"><div class="t">${esc(m.name)}${m.me ? ' <span class="tag ok">você</span>' : ''}</div>
        <div class="s">${esc(m.role)} · ${access(m)}${m.plays ? ' · na rotina' : ''}${m.passkeys ? ' · digital' : ''}${m.email ? ' · ' + esc(m.email) : ''}</div></div>
        <div class="btns"><button class="btn ghost sm" data-m="${m.id}">Editar</button></div></div>`).join('')}</div>
      ${mb.invites.length ? `<p class="hint">${mb.invites.length === 1 ? '1 convite aguardando' : mb.invites.length + ' convites aguardando'} (${mb.invites.map(i => esc(i.name)).join(', ')}). <button type="button" class="link" id="invX">Cancelar convites</button></p>` : ''}</section>` : ''}
    <section class="box" data-sum="Painel como outro app, com disfarce"><div class="box-h"><h2 class="d">Área dos pais separada</h2></div>
      <p class="lead">Instale o painel como outro app no seu celular. Ele abre direto aqui, com a digital ou o PIN, sem passar pelo jogo. Escolha um disfarce para a criança não reconhecer:</p>
      <div class="disg" role="radiogroup" aria-label="Disfarce do app">${DISGUISES.map(([k, n], i) => `<label><input type="radio" name="dg" value="${k}" ${i === 0 ? 'checked' : ''}><img src="/icons/d/${k}-192.png" alt=""><span>${n}</span></label>`).join('')}</div>
      <div class="actions"><button class="btn green sm" id="sepGo">Instalar neste aparelho</button><button class="btn ghost sm" id="sepCopy">Copiar link</button></div>
      <p class="hint">Abre uma página no navegador. No Android, toque em <b>Instalar</b>. No iPhone, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Para outro celular, copie o link e abra lá.</p></section>
    ${NATIVE && GtAlarm ? '<section class="box" id="natBox" data-sum="Alarme no silencioso"><div class="box-h"><h2 class="d">Alarme deste celular</h2></div></section>' : ''}
    <div id="alarms"></div>
    ${full() ? `<section class="box" data-sum="${ME.access?.status === 'paid' ? 'Ativa' : ME.access?.status === 'trial' ? 'Período grátis' : 'Ver planos'}"><div class="box-h"><h2 class="d">Assinatura</h2><a class="btn sm" href="#/assinar">${ME.access?.status === 'paid' ? 'Renovar' : 'Ver planos'}</a></div><p class="lead">${planText(ME.access)}</p><div id="guar"></div></section>` : ''}
    <section class="box" data-sum="Desconectar ou voltar a pedir o PIN"><div class="box-h"><h2 class="d">Este aparelho</h2></div><p class="lead">${PAINEL && store.get('gt-pdev') ? 'Este app abre o painel direto, sem PIN. ' : ''}Desconectar faz o aparelho pedir o e-mail e a senha de novo.</p><div class="actions">${PAINEL && store.get('gt-pdev') ? '<button class="btn ghost sm" id="forget">Voltar a pedir o PIN</button>' : ''}<button class="btn red sm" id="out">Desconectar</button></div></section>`;
  const fg = $('#forget', pane); if (fg) fg.onclick = guard(async () => { await api('DELETE', '/auth/parent/device'); store.set('gt-pdev', ''); toast('Pronto: o app vai pedir o PIN ao abrir'); await route(); });
  const dgUrl = () => `${location.origin}/painel?i=${$('[name=dg]:checked', pane).value}`;
  $$('[name=dg]', pane).forEach(r => r.onchange = () => sfx.tap());
  $('#sepGo', pane).onclick = () => { sfx.tap(); if (!window.open(dgUrl(), '_blank')) location.href = dgUrl(); };
  $('#sepCopy', pane).onclick = async () => { try { await navigator.clipboard.writeText(dgUrl()); toast('Link copiado'); } catch { toast(dgUrl()); } };
  const f = $('#f'); if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', '/admin/settings', { coin_value: f.coin_value.value }); toast('Ajustes salvos'); f.querySelector('.err').textContent = ''; }
    catch (er) { f.querySelector('.err').textContent = er.message; sfx.bad(); }
  };
  $('#pinf').onsubmit = guard(async (e) => { e.preventDefault(); await api('PUT', '/admin/me/pin', { pin: e.target.pin.value }); e.target.pin.value = ''; toast('PIN trocado'); });
  const fa = $('#fpAdd'); if (fa) fa.onclick = async () => { try { await pkAdd(); sfx.win(); toast('Digital ativada neste aparelho'); refresh(); } catch (e) { toast(pkErr(e), true); } };
  const fo = $('#fpOff'); if (fo) fo.onclick = guard(async () => {
    const mine = (await api('GET', '/admin/me/passkeys')).map(k => k.id);
    for (const id of pkIds().filter(x => mine.includes(x))) await api('DELETE', '/admin/me/passkeys/' + encodeURIComponent(id));
    pkSave([]); store.set('gt-pk-skip', '1'); toast('Digital desativada neste aparelho'); refresh();
  });
  // convidar e editar responsáveis
  const roleSel = (cur) => `<select id="mr" name="role">${mb.roles.map(r => `<option ${r === cur ? 'selected' : ''}>${r}</option>`).join('')}</select>`;
  const accSeg = (cur) => seg('full_access', [['1', 'Acesso completo'], ['0', 'Só o dia a dia']], cur ? '1' : '0') + '<p class="hint">Dia a dia: aprovar tarefas, marcar tempo de tela usado e ver a carteira. Não paga moedas nem muda tarefas, recompensas ou assinatura.</p>';
  const inv = $('#inv'); if (inv) inv.onclick = () => sheet('Convidar responsável', `
      <div class="field"><label for="mn">Nome</label><input id="mn" name="name" placeholder="Ana" maxlength="60" required></div>
      <div class="field"><label for="mr">Quem é</label>${roleSel('Mãe')}</div>
      <div class="field"><span class="lab">O que pode fazer</span>${accSeg(true)}</div>`,
    async (fm) => {
      const r = await api('POST', '/admin/members/invite', { name: fm.name.value, role: fm.role.value, full_access: fm.full_access.value === '1' });
      const name = fm.name.value; await refresh(); shareInvite(name, r);
    }, { saveLabel: 'Criar convite' });
  const ix = $('#invX'); if (ix) ix.onclick = guard(async () => { await api('DELETE', '/admin/members/invites'); toast('Convites cancelados'); refresh(); });
  $$('[data-m]').forEach(b => b.onclick = () => {
    const m = mb.members.find(x => x.id == b.dataset.m);
    const bg = sheet('Editar ' + m.name, `
      <div class="field"><label for="mn">Nome</label><input id="mn" name="name" value="${esc(m.name)}" maxlength="60" required></div>
      <div class="field"><label for="mr">Quem é</label>${roleSel(m.role)}</div>
      ${m.principal ? '<p class="hint">Responsável principal: sempre com acesso completo.</p>' : `<div class="field"><span class="lab">O que pode fazer</span>${accSeg(m.full_access)}</div>`}
      <label class="check"><input type="checkbox" name="plays" ${m.plays ? 'checked' : ''}>Participa da rotina (aparece entre os jogadores, sem moedas)</label>
      <div data-play><div class="field"><span class="lab">Personagem</span>${picker('avatar', AVATARS, slug(m.avatar, 'fox'))}</div>
        <div class="field"><span class="lab">Cor do card</span>${swatches('color', m.color || COLORS[1])}</div></div>
      ${!m.principal && !m.me ? '<button type="button" class="btn red sm" id="rmM" style="margin-top:16px">Remover acesso</button>' : ''}`,
      async (fm) => {
        await api('PUT', '/admin/members/' + m.id, { name: fm.name.value, role: fm.role.value, full_access: fm.full_access ? fm.full_access.value === '1' : true,
          plays: fm.plays.checked, avatar: fm.avatar.value, color: fm.color.value });
        toast('Responsável atualizado'); refresh();
      });
    const fm = bg.querySelector('form'), sync = () => { $('[data-play]', fm).hidden = !fm.plays.checked; };
    fm.plays.addEventListener('change', sync); sync();
    const rm = bg.querySelector('#rmM'); if (rm) rm.onclick = () => {
      bg.remove();
      sheet(`Remover ${m.name}?`, '<p class="lead" style="margin-top:6px">A pessoa não consegue mais entrar nem abrir o painel. As tarefas e o histórico ficam.</p>',
        async () => { await api('DELETE', '/admin/members/' + m.id); toast('Acesso removido'); refresh(); }, { saveLabel: 'Remover', danger: true });
    };
  });
  $('#out').onclick = () => sheet('Desconectar este aparelho?', '<p class="lead" style="margin-top:6px">Este aparelho vai pedir o e-mail e a senha de novo.</p>',
    async () => { await api('POST', '/auth/logout'); location.hash = '#/login'; await route(); }, { saveLabel: 'Desconectar', danger: true });
  if ($('#guar', pane) && ME.access?.status === 'paid') api('GET', '/billing/status').then(s => guaranteeBox($('#guar', pane), s.guarantee)).catch(() => {});
  await adminAlarms($('#alarms'), refresh);
  if ($('#natBox', pane)) await nativeAlarmBox($('#natBox', pane)).catch(() => {});
  accordion(pane);
}

// Sanfona: cada bloco vira uma linha (ícone, título e resumo) que abre ao tocar. Lembra o que estava aberto.
const ACC_IC = { 'Alarme deste celular': 'clock', 'Moedas': 'coin', 'Meu acesso': 'lock', 'Responsáveis': 'people', 'Área dos pais separada': 'phone', 'Avisos neste aparelho': 'bell', 'Avisos programados': 'clock', 'Últimos avisos enviados': 'check', 'Assinatura': 'moneybag', 'Este aparelho': 'gear' };
function accordion(pane) {
  const open = new Set((store.get('gt-acc') || '').split('|').filter(Boolean));
  $$(':scope > .box, :scope > #alarms > .box', pane).forEach(el => {
    const h = $('.box-h h2', el); if (!h) return;
    const title = h.textContent.trim(), d = document.createElement('details'), sum = document.createElement('summary');
    d.className = 'box acc';
    sum.innerHTML = `${im(ACC_IC[title] || 'gear', 'acc-ic')}<span class="acc-tx"><b>${esc(title)}</b>${el.dataset.sum ? `<small>${esc(el.dataset.sum)}</small>` : ''}</span>`;
    h.remove();
    const bh = $('.box-h', el); if (bh && !bh.textContent.trim() && !bh.children.length) bh.remove();
    el.classList.remove('box'); el.classList.add('acc-body');
    el.before(d); d.append(sum, el);
    d.open = open.has(title);
    d.addEventListener('toggle', () => { if (d.open) { open.add(title); sfx.tap(); } else open.delete(title); store.set('gt-acc', [...open].join('|')); });
  });
}

// Link do convite: compartilhar (WhatsApp etc.) ou copiar
function shareInvite(name, r) {
  const text = `${name}, este é o seu convite para o GameTask da nossa família: ${r.link}`;
  const bg = sheet('Convite criado', `<p class="lead" style="margin-top:6px">Envie o link para ${esc(name)}. Ele vale por ${r.days} dias e só pode ser usado uma vez.</p>
    <div class="field"><input id="lk" value="${esc(r.link)}" readonly aria-label="Link do convite"></div>
    <div class="share-row">${navigator.share ? '<button type="button" class="btn green" id="sh">Compartilhar</button>' : ''}
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a>
      <button type="button" class="btn ghost" id="cp">Copiar link</button></div>`, async () => {}, { saveLabel: 'Pronto' });
  bg.querySelector('[data-x]').remove(); // só "Pronto"
  const sh = bg.querySelector('#sh'); if (sh) sh.onclick = () => navigator.share({ title: 'Convite GameTask', text }).catch(() => {});
  bg.querySelector('#cp').onclick = async () => { const i = bg.querySelector('#lk'); i.select(); try { await navigator.clipboard.writeText(r.link); } catch { document.execCommand('copy'); } toast('Link copiado'); };
}

// ---------- Assinatura ----------
const PLAN_N = { monthly: 'mensal', annual: 'anual', plus: 'Plus' };
function planText(a = {}) {
  if (a.status === 'owner') return 'Conta do dono do sistema: acesso liberado.';
  if (a.status === 'free') return 'Acesso de cortesia liberado.';
  if (a.status === 'trial') return `Período grátis até <b>${dmy(a.until)}</b> (${a.days_left} ${a.days_left === 1 ? 'dia' : 'dias'}). Depois disso, o app pede uma assinatura.`;
  if (a.status === 'paid') return `Plano ${PLAN_N[a.plan] || ''} ativo até <b>${dmy(a.until)}</b>.`;
  return 'O período de uso terminou.';
}
const money = (n) => (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Garantia: no prazo, mostra até quando vale e o botão de devolver o dinheiro (sem perguntar o motivo)
function guaranteeBox(el, g) {
  if (!el || !g) return;
  el.innerHTML = `<div class="guar">${im('shield')}<p>Você está na garantia até <b>${dmy(g.until)}</b>. Se o GameTask não servir para a sua casa, devolvemos <b>${brl(g.amount)}</b>, sem perguntas.</p><button type="button" class="link" data-refund>Quero meu dinheiro de volta</button></div>`;
  $('[data-refund]', el).onclick = () => {
    if (!ME.parent) return viewPin();
    sheet('Devolver o seu dinheiro?', `<p class="lead" style="margin-top:6px">Devolvemos <b>${brl(g.amount)}</b> pelo Mercado Pago, na mesma forma de pagamento. No Pix volta na hora; no cartão, aparece na fatura conforme o banco.</p><p class="lead">O plano pago termina agora. As missões e moedas ficam guardadas caso queira voltar.</p>`,
      async () => { await api('POST', '/billing/refund', {}); toast('Pronto: o estorno foi pedido ao Mercado Pago'); await route(); }, { saveLabel: 'Devolver meu dinheiro', danger: true });
  };
}
async function viewPaywall() {
  const s = await api('GET', '/billing/status'), a = s.access, p = s.prices;
  const perMonth = Math.floor(p.annual / 12 * 100) / 100, save = Math.max(0, Math.round((1 - p.annual / (p.monthly * 12)) * 100));
  const head = a.active ? 'Planos do GameTask' : a.plan ? 'Sua assinatura venceu' : a.until ? 'O período grátis terminou' : 'Escolha o seu plano';
  const sub = a.active ? planText(a) : a.plan || a.until ? 'As missões e as moedas das crianças estão guardadas. Assine para continuar de onde pararam.'
    : p.guarantee_days ? `Se não gostar em até ${p.guarantee_days} dias, devolvemos o seu dinheiro. Sem perguntas.` : 'Assine para começar.';
  const freeCard = a.status === 'trial';
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="wrap paywall">
    <div class="pw-head">${im(a.active ? 'rocket' : 'lock')}<h1 class="d stroke">${head}</h1><p>${sub}</p></div>
    <div class="plans">
      ${freeCard ? `<article class="plan free current"><span class="ribbon blue">Você está aqui</span>
        <h2 class="d">Grátis</h2><div class="price"><small>R$</small><b class="d num">0</b><small>por ${trialText(p.trial_days)}</small></div>
        <p class="bill">${a.status === 'trial' ? `Faltam <b>${a.days_left} ${a.days_left === 1 ? 'dia' : 'dias'}</b>, até ${dmy(a.until)}` : 'Para conhecer, sem cartão'}</p>
        <ul><li>${im('check')}Tudo liberado</li><li>${im('check')}Depois, escolha um plano</li></ul>
        <button class="btn ghost" id="keepFree">Continuar no grátis</button></article>` : ''}
      <article class="plan best"><span class="ribbon">Melhor preço${save ? ` · economize ${save}%` : ''}</span>
        <h2 class="d">Anual</h2><div class="price"><small>R$</small><b class="d num">${money(perMonth)}</b><small>/mês</small></div>
        <p class="bill">Pagamento único de <b>${brl(p.annual)}</b> por ano</p>
        <ul><li>${im('check')}Filhos ilimitados</li><li>${im('check')}Todos os aparelhos da família</li><li>${im('check')}Pix, cartão ou boleto</li></ul>
        <button class="btn green" data-plan="annual">Assinar anual</button></article>
      <article class="plan"><h2 class="d">Mensal</h2><div class="price"><small>R$</small><b class="d num">${money(p.monthly)}</b><small>/mês</small></div>
        <p class="bill">Pago a cada mês, sem fidelidade</p>
        <ul><li>${im('check')}Filhos ilimitados</li><li>${im('check')}Sem fidelidade: renove quando quiser</li></ul>
        <button class="btn ghost" data-plan="monthly">Assinar mensal</button></article>
    </div>
    <div class="cup pw-cup" id="cup"></div>
    <p class="pw-note">${im('shield')}Pagamento seguro pelo Mercado Pago.${a.status === 'trial' ? ' Assinando agora, o plano começa quando os dias grátis acabarem: você não perde nenhum.' : ' O acesso é liberado assim que o pagamento é confirmado.'}${p.guarantee_days ? ` Garantia de ${p.guarantee_days} dias: se não gostar, devolvemos o dinheiro.` : ''}</p>
    <div id="guar"></div>
    <div class="pw-actions">${a.active ? '<button class="btn ghost sm" id="back">Voltar</button>' : ''}<button class="switch" id="out">Desconectar este aparelho</button></div>
  </div></div>`;
  let cup = null;
  couponBox($('#cup'), (c) => { cup = c; }, null);
  guaranteeBox($('#guar'), s.guarantee);
  const paidOk = async () => { await route(); burst('trophy', 'Assinatura ativa!', 'Obrigado! Seu acesso está garantido.', 'Bora jogar'); };
  $$('[data-plan]').forEach(b => b.onclick = guard(async () => {
    if (!ME.parent) return viewPin(); // só um responsável assina (volta para os planos depois do PIN)
    const plan = b.dataset.plan, total = offPrice(s.prices[plan], cup);
    if (cup && !(total > 0)) {
      const fr = sheet('Ativar com o cupom?', `<p class="lead" style="margin-top:6px">Cupom <b>${esc(cup.code)}</b>: o plano sai de graça.</p>`,
        async () => { await api('POST', '/billing/free', { plan, coupon: cup.code }); await paidOk(); }, { saveLabel: 'Ativar grátis' });
      return fr;
    }
    if (!s.enabled) throw new Error('O pagamento on-line ainda está sendo ativado. Tente mais tarde.');
    const ch = sheet('Como você quer pagar?', `${cup ? `<p class="lead cup-sum">Cupom <b>${esc(cup.code)}</b>: de <s>${brl(s.prices[plan])}</s> por <b>${brl(total)}</b></p>` : ''}<div class="pay-opts"><button type="button" class="btn green" data-via="pix">Pix, rápido e aqui mesmo</button>${s.card ? '<button type="button" class="btn" data-via="card">Cartão de crédito</button><button type="button" class="switch" data-via="mp">Boleto ou outras formas</button>' : '<button type="button" class="btn ghost" data-via="mp">Cartão ou boleto</button>'}</div>`, async () => {});
    ch.querySelector('.actions').remove();
    ch.querySelector('[data-via=pix]').onclick = guard(async () => {
      const r = await api('POST', '/billing/pix', { plan, coupon: cup?.code }); ch.remove();
      if (r.url) { location.href = r.url; return; }
      showPix(r, async () => { await route(); burst('trophy', 'Assinatura ativa!', 'Obrigado! Seu acesso está garantido.', 'Bora jogar'); });
    });
    ch.querySelector('[data-via=mp]').onclick = guard(async () => { const r = await api('POST', '/billing/checkout', { plan, coupon: cup?.code }); location.href = r.url; });
    const cb = ch.querySelector('[data-via=card]');
    if (cb) cb.onclick = () => { ch.remove(); showCard({ key: s.card, amount: total, email: s.email, pay: (d) => api('POST', '/billing/card', { plan, coupon: cup?.code, ...d }),
      onPaid: async () => { await route(); burst('trophy', 'Assinatura ativa!', 'Obrigado! Seu acesso está garantido.', 'Bora jogar'); } }); };
  }));
  const back = $('#back'); if (back) back.onclick = () => { location.hash = ME.parent ? '#/admin' : '#/'; };
  const keep = $('#keepFree'); if (keep) keep.onclick = () => { sfx.tap(); location.hash = '#/'; };
  const want = store.get('gt-plan'); if (want) { $(`[data-plan="${want}"]`)?.closest('.plan').classList.add('pick'); setTimeout(() => store.set('gt-plan', ''), 1500); }
  $('#out').onclick = () => sheet('Desconectar este aparelho?', '<p class="lead" style="margin-top:6px">Será preciso entrar com o e-mail e a senha da família de novo.</p>',
    async () => { await api('POST', '/auth/logout'); location.href = PAINEL ? location.pathname + location.search : '/app'; }, { saveLabel: 'Desconectar', danger: true });
}

// ---------- Catálogo de tarefas ----------
const catalogGrid = (groups, tasks, on) => groups.map(g => {
  const list = tasks.filter(t => t.group === g.key); if (!list.length) return '';
  return `<div class="cat-group"><h3>${im(g.icon)}${esc(g.title)}</h3><div class="opts">${list.map(t => `<label class="opt"><input type="checkbox" name="ck" value="${t.key}" ${on.has(t.key) ? 'checked' : ''}>
    <span class="opt-in">${im(t.icon)}<span class="opt-t">${esc(t.title)}</span><span class="opt-c">${im('coin')}${num(t.coins)}</span></span></label>`).join('')}</div></div>`;
}).join('');

// ---------- Assistente do primeiro acesso ----------
async function viewSetup() {
  const c = await api('GET', '/admin/catalog');
  const st = { step: 0, kids: [{ name: '', avatar: AVATARS[0], color: COLORS[0] }], tasks: new Set(c.tasks.filter(t => t.on).map(t => t.key)),
    rewards: Object.fromEntries(c.rewards.map(r => [r.key, { on: !!r.on, value: r.value }])) };
  const STEPS = ['Jogadores', 'Missões', 'Prêmios'];
  const save = () => {
    $$('[data-kid]').forEach(row => { st.kids[+row.dataset.kid].name = $('input', row).value; });
    if (st.step === 1) st.tasks = new Set($$('[name=ck]:checked').map(x => x.value));
    if (st.step === 2) c.rewards.forEach(r => { st.rewards[r.key] = { on: $(`[name=rw-${r.key}]`).checked, value: +$(`[name=rv-${r.key}]`).value || r.value }; });
  };
  const render = () => {
    const body = st.step === 0 ? `<h2 class="d">Quem vai jogar?</h2><p class="lead">Toque no personagem ou na bolinha de cor para trocar. Dá para adicionar mais filhos a qualquer hora.</p>
        <div class="kid-rows">${st.kids.map((k, i) => `<div class="kid-row" data-kid="${i}" style="--c:${k.color}">
          <button type="button" class="kid-av" data-av="${i}" aria-label="Trocar personagem">${im(k.avatar)}</button>
          <input value="${esc(k.name)}" placeholder="Nome do ${i ? 'próximo ' : ''}filho" aria-label="Nome" maxlength="60">
          <button type="button" class="kid-col" data-col="${i}" aria-label="Trocar cor"></button>
          ${st.kids.length > 1 ? `<button type="button" class="kid-del" data-del="${i}" aria-label="Remover">${SVG.del}</button>` : ''}</div>`).join('')}</div>
        <button type="button" class="btn ghost sm" id="addKid">+ Adicionar filho</button>`
      : st.step === 1 ? `<h2 class="d">Escolha as missões do dia</h2><p class="lead">Já deixamos marcadas as mais comuns. Depois você muda tudo: moedas, dias da semana e quem faz cada uma.</p>
        ${catalogGrid(c.groups, c.tasks, st.tasks)}`
      : `<h2 class="d">O que dá para ganhar?</h2><p class="lead">Além das moedas, que você paga em dinheiro, cada missão rende um pedaço do tempo de tela e avança nas metas.</p>
        <div class="rw-list">${c.rewards.map(r => { const v = st.rewards[r.key]; return `<label class="rw"><input type="checkbox" name="rw-${r.key}" ${v.on ? 'checked' : ''}>${im(r.icon)}
          <span class="rw-t"><b>${esc(r.title)}</b><small data-rhint="${r.key}"></small></span>
          <span class="rw-v"><input type="number" name="rv-${r.key}" value="${v.value}" min="1" inputmode="numeric" aria-label="Valor de ${esc(r.title)}"><em>${r.kind === 'time' ? 'min/dia' : r.goal_mode === 'coins' ? 'moedas' : 'missões'}</em></span></label>`; }).join('')}</div>`;
    app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="wrap setup">
      <div class="setup-top"><h1 class="d stroke">Vamos montar o jogo</h1>
        <ol class="steps">${STEPS.map((s, i) => `<li class="${i < st.step ? 'done' : i === st.step ? 'on' : ''}"><i>${i + 1}</i>${s}</li>`).join('')}</ol></div>
      <form class="card wiz" id="wz" novalidate>${body}<div class="err" role="alert"></div>
        <div class="wiz-foot">${st.step ? '<button type="button" class="btn ghost" id="prev">Voltar</button>' : '<button type="button" class="link" id="skip">Prefiro montar do zero</button>'}
          <span class="wiz-count" id="cnt"></span>
          <button class="btn green" id="next">${st.step === 2 ? 'Começar a jogar!' : 'Continuar'}</button></div></form></div></div>`;
    const f = $('#wz');
    const hints = () => {
      if (st.step === 1) $('#cnt').textContent = `${$$('[name=ck]:checked').length} missões`;
      if (st.step === 2) c.rewards.forEach(r => {
        const v = +$(`[name=rv-${r.key}]`).value || 0, h = $(`[data-rhint="${r.key}"]`), n = Math.max(1, st.tasks.size);
        h.textContent = r.kind === 'time' ? `${num(Math.round(v / n * 10) / 10)} min por missão (${st.tasks.size} missões)` : r.goal_mode === 'coins' ? 'Troca as moedas por este prêmio' : '+1 a cada missão feita';
      });
    };
    f.addEventListener('input', hints); f.addEventListener('change', hints); hints();
    $$('[data-av]').forEach(b => b.onclick = () => { save(); const k = st.kids[+b.dataset.av]; k.avatar = AVATARS[(AVATARS.indexOf(k.avatar) + 1) % AVATARS.length]; sfx.tap(); render(); $(`[data-av="${b.dataset.av}"]`).focus(); });
    $$('[data-col]').forEach(b => b.onclick = () => { save(); const k = st.kids[+b.dataset.col]; k.color = COLORS[(COLORS.indexOf(k.color) + 1) % COLORS.length]; sfx.tap(); render(); $(`[data-col="${b.dataset.col}"]`).focus(); });
    $$('[data-del]').forEach(b => b.onclick = () => { save(); st.kids.splice(+b.dataset.del, 1); render(); });
    const add = $('#addKid'); if (add) add.onclick = () => { save(); const i = st.kids.length; st.kids.push({ name: '', avatar: AVATARS[(i * 3) % AVATARS.length], color: COLORS[i % COLORS.length] }); render(); $$('.kid-row input').at(-1).focus(); };
    const prev = $('#prev'); if (prev) prev.onclick = () => { save(); st.step--; sfx.tap(); render(); scrollTo(0, 0); };
    const skip = $('#skip'); if (skip) skip.onclick = guard(async () => { await api('POST', '/admin/setup/skip'); location.hash = '#/admin'; await route(); });
    f.onsubmit = async (e) => {
      e.preventDefault(); save();
      const err = (m) => { f.querySelector('.err').textContent = m; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); sfx.bad(); };
      if (st.step === 0 && !st.kids.some(k => k.name.trim())) return err('Digite o nome de pelo menos um filho.');
      if (st.step === 1 && !st.tasks.size) return err('Escolha pelo menos uma missão.');
      if (st.step < 2) { st.step++; sfx.tap(); render(); scrollTo(0, 0); return; }
      $('#next').disabled = true;
      try {
        await api('POST', '/admin/setup', { kids: st.kids.filter(k => k.name.trim()), tasks: [...st.tasks],
          rewards: Object.entries(st.rewards).filter(([, v]) => v.on).map(([key, v]) => ({ key, value: v.value })) });
      } catch (er) { $('#next').disabled = false; return err(er.message); }
      await api('POST', '/auth/parent/exit').catch(() => {});
      if (store.get('gt-plan')) { location.hash = '#/assinar'; await route(); toast('Tudo pronto! Agora é só concluir a assinatura.'); return; }
      location.hash = '#/'; await route();
      burst('party', 'Tudo pronto!', 'As missões já estão no jogo. Agora é com as crianças!', 'Ver jogadores');
    };
  };
  render();
}

// ---------- Painel do dono do sistema ----------
let otab = 'overview';
const OTABS = [['overview', 'chart', 'Visão geral'], ['families', 'people', 'Famílias'], ['payments', 'moneybag', 'Pagamentos'], ['leads', 'memo', 'Leads'], ['flows', 'calendar', 'Fluxos'], ['coupons', 'gift', 'Cupons'], ['prices', 'gear', 'Preços']];
const STATUS = { trial: ['Teste', 'wait'], paid: ['Pago', 'ok'], free: ['Cortesia', 'ok'], expired: ['Vencido', 'no'], owner: ['Dono', 'ok'] };
const PAY = { approved: ['Aprovado', 'ok'], pending: ['Aguardando', 'wait'], in_process: ['Em análise', 'wait'], rejected: ['Recusado', 'no'], cancelled: ['Cancelado', 'no'], refunded: ['Estornado', 'no'], charged_back: ['Contestado', 'no'], invalid: ['Valor divergente', 'no'] };
const tag = (m, k) => { const [l, c] = m[k] || [k, 'wait']; return `<span class="tag ${c}">${esc(l)}</span>`; };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
async function viewOwner() {
  app.innerHTML = `<div class="admin owner"><header class="admin-top"><div class="row1"><h1 class="d stroke-sm">Painel do dono</h1>
      <a class="btn ghost sm" href="#/admin">Painel dos pais</a></div>
    <nav class="tabs" aria-label="Seções">${OTABS.map(([k, ic, l]) => `<button class="tab ${k === otab ? 'on' : ''}" data-tab="${k}" ${k === otab ? 'aria-current="page"' : ''}>${im(ic)}${l}</button>`).join('')}</nav></header>
    <main class="admin-body" id="pane"></main></div>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { otab = b.dataset.tab; sfx.tap(); viewOwner().catch(e => toast(e.message, true)); });
  await ({ overview: ownerOverview, families: ownerFamilies, payments: ownerPayments, leads: ownerLeads, flows: ownerFlows, coupons: ownerCoupons, prices: ownerPrices })[otab]($('#pane'));
}
async function ownerOverview(pane) {
  const s = await api('GET', '/owner/summary'), c = s.counts, r = s.revenue;
  const tile = (icon, label, value, note = '', hi = '') => `<div class="stat ${hi}"><div class="stat-h">${im(icon)}<span>${label}</span></div><b class="d num">${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
  const max = Math.max(1, ...s.months.map(m => +m.total));
  pane.innerHTML = `<div class="stats">
      ${tile('moneybag', 'Faturamento do mês', brl(r.month), `${r.payments} pagamento(s) aprovados no total`, 'gold')}
      ${tile('chart', 'Receita recorrente por mês', brl(r.mrr), `${brl(r.arr)} por ano no ritmo atual`)}
      ${tile('trophy', 'Assinantes pagos', c.paid_monthly + c.paid_annual + c.paid_plus, `${c.paid_plus} Plus · ${c.paid_annual} anuais · ${c.paid_monthly} mensais`, 'green')}
      ${tile('hourglass', 'Em teste grátis', c.trial, `${c.expiring7} vencem nos próximos 7 dias`)}
      ${tile('lock', 'Vencidos', c.expired, s.conversion === null ? 'Nenhum teste encerrado ainda' : `Conversão do teste: ${s.conversion}%`)}
      ${tile('people', 'Famílias', c.total, `${c.new30} novas em 30 dias · ${c.active7} usaram na semana`)}
      ${tile('coin', 'Últimos 12 meses', brl(r.year), `Desde o início: ${brl(r.total)}`)}
      ${tile('gift', 'Cortesias', c.free, `Preço: ${brl(s.settings.price_annual)}/ano · ${brl(s.settings.price_monthly)}/mês`)}
    </div>
    <section class="box"><div class="box-h"><h2 class="d">Faturamento por mês</h2></div>
      ${s.months.length ? `<table><thead><tr><th>Mês</th><th>Plus</th><th>Anuais</th><th>Mensais</th><th>Total</th><th class="bar-col" aria-hidden="true"></th></tr></thead><tbody>${s.months.map(m => { const [y, mo] = m.m.split('-');
        return `<tr><td>${MES[+mo - 1]}/${y.slice(2)}</td><td>${m.plus}</td><td>${m.annual}</td><td>${m.monthly}</td><td>${brl(m.total)}</td><td class="bar-col" aria-hidden="true"><i class="hbar" style="width:${+m.total / max * 100}%"></i></td></tr>`; }).join('')}</tbody></table>`
      : zero('chart', 'Nenhum pagamento aprovado ainda.')}</section>`;
}
async function ownerFamilies(pane, q = '') {
  const rows = await api('GET', '/owner/families?q=' + encodeURIComponent(q));
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Famílias (${rows.length})</h2><input id="q" type="search" placeholder="Buscar nome ou e-mail" value="${esc(q)}" class="search" aria-label="Buscar família"></div>
    ${rows.length ? `<div class="list">${rows.map(f => `<div class="item fam"><div class="grow"><div class="t">${esc(f.name)} ${tag(STATUS, f.owner ? 'owner' : f.access.status)}${f.plan && f.access.status === 'paid' ? ` <span class="s">${PLAN_N[f.plan]}</span>` : ''}</div>
      <div class="s">${esc(f.email)} · desde ${dmy(f.created_at)}${f.access.until ? ` · ${f.access.status === 'trial' ? 'teste' : 'acesso'} até ${dmy(f.access.until)}` : ''}</div>
      <div class="s">${f.kids} filho(s) · ${f.tasks} tarefas · ${f.done7} missões na semana · pagou ${brl(f.paid_total)}${f.last_seen ? ` · visto em ${dmy(f.last_seen)}` : ''}${f.onboarded ? '' : ' · ainda não configurou'}</div></div>
      <div class="btns"><button class="btn ghost sm" data-m="${f.id}">Gerenciar</button></div></div>`).join('')}</div>` : zero('people', 'Nenhuma família encontrada.')}</section>`;
  let t; $('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => ownerFamilies(pane, e.target.value).then(() => { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 350); };
  // sugere +30 dias a partir do vencimento atual (ou de hoje, se já venceu)
  const plus = (days, from) => { const t = new Date().toISOString().slice(0, 10), d = new Date(((from && from > t) ? from : t) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  $$('[data-m]').forEach(b => b.onclick = () => {
    const f = rows.find(x => x.id == b.dataset.m);
    const bg = sheet(f.name, `<p class="lead" style="margin-top:6px">${esc(f.email)}<br>${planText(f.access)}</p>
      <div class="field"><span class="lab">O que fazer</span>${seg('action', [['trial', 'Estender teste'], ['paid', 'Liberar pago'], ['free', 'Cortesia'], ['block', 'Bloquear']], 'trial')}</div>
      <div class="field" data-d><label for="od">Até quando</label><input id="od" type="date" name="date" value="${plus(30, f.access.until)}"></div>
      <div class="field"><button type="button" class="btn ghost sm" id="rl">Gerar link de nova senha</button><p class="hint" id="rlo"></p></div>
      <div class="field" data-p><span class="lab">Plano</span>${seg('plan', [['plus', 'Plus'], ['annual', 'Anual'], ['monthly', 'Mensal']], 'annual')}</div>`,
      async (fm) => { await api('POST', '/owner/families/' + f.id, { action: fm.action.value, date: fm.date.value, plan: fm.plan.value }); toast('Família atualizada'); ownerFamilies(pane, $('#q')?.value || ''); },
      { saveLabel: 'Aplicar' });
    const fm = bg.querySelector('form'), u = () => { $('[data-d]', fm).hidden = !['trial', 'paid'].includes(fm.action.value); $('[data-p]', fm).hidden = fm.action.value !== 'paid'; };
    fm.addEventListener('change', u); u();
    fm.querySelector('#rl').onclick = guard(async () => {
      const r = await api('POST', `/owner/families/${f.id}/reset-link`);
      fm.querySelector('#rlo').innerHTML = `Vale por 24 horas. Envie para a família:<input readonly value="${esc(r.link)}" onfocus="this.select()">`;
    });
  });
}
async function ownerPayments(pane) {
  const rows = await api('GET', '/owner/payments');
  const METHOD = { pix: 'Pix', bolbradesco: 'Boleto', pec: 'Lotérica', account_money: 'Saldo MP', cupom: 'Cupom 100%' };
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Pagamentos</h2></div>
    ${rows.length ? `<div class="scroll-x"><table><thead><tr><th>Data</th><th>Família</th><th>Plano</th><th>Valor</th><th>Forma</th><th>Situação</th><th>Acesso até</th></tr></thead><tbody>${rows.map(p => `<tr>
      <td>${dmy(p.paid_at || p.created_at)}</td><td>${esc(p.family)}<div class="s">${esc(p.email)}</div></td><td>${PLAN_N[p.plan]}</td><td>${brl(p.amount)}${p.coupon ? `<div class="s">cupom ${esc(p.coupon)}</div>` : ''}</td>
      <td>${esc(METHOD[p.method] || (p.method ? 'Cartão ' + p.method : '—'))}</td><td>${tag(PAY, p.status)}</td><td>${p.period_end ? dmy(p.period_end) : '—'}</td></tr>`).join('')}</tbody></table></div>`
    : zero('moneybag', 'Nenhum pagamento ainda.')}</section>`;
}
async function ownerLeads(pane) {
  const [rows, wa] = await Promise.all([api('GET', '/owner/leads'), api('GET', '/owner/whatsapp').catch(e => ({ configured: true, error: e.message }))]);
  const SRC = { quadro: 'Quadro de tarefas' };
  const fone = (w) => w ? w.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '';
  const zap = (w) => `https://wa.me/${w.length <= 11 ? '55' + w : w}`;
  const sit = (l) => l.cliente ? '<span class="tag ok">Cliente</span>' : l.opt_out_at ? '<span class="tag no">Saiu</span>'
    : l.wa_confirmed_at ? '<span class="tag ok">WhatsApp confirmado</span>' : l.email ? '<span class="tag wait">Só e-mail</span>' : '<span class="tag wait">Não enviou no WhatsApp</span>';
  const conf = rows.filter(l => l.wa_confirmed_at).length, cli = rows.filter(l => l.cliente).length;
  const ST = { open: ['Conectado', 'ok'], connecting: ['Conectando', 'wait'], close: ['Desconectado', 'no'] };
  const waBox = !wa.configured
    ? `<p class="hint">Para mandar o quadro pelo WhatsApp, coloque no servidor (EasyPanel) as variáveis <b>EVOLUTION_URL</b>, <b>EVOLUTION_KEY</b> e <b>EVOLUTION_INSTANCE</b>. Sem elas, a pessoa imprime direto na página.</p>`
    : `<p>Instância <b>${esc(wa.instance || '')}</b> ${tag(ST, wa.state || 'close')}${wa.number ? ` · número ${esc(fone(wa.number))}` : ''}</p>
      ${wa.error ? `<p class="err">${esc(wa.error)}</p>` : ''}
      <p class="hint">${wa.hookOk ? 'Recebimento das mensagens ligado: quem mandar o código recebe o PDF na hora.'
        : `Recebimento das mensagens <b>desligado</b>.${wa.hook?.url ? ` Hoje a instância avisa outro endereço: <b>${esc(wa.hook.url)}</b>. Para os dois funcionarem, coloque esse endereço na variável WA_REPASSAR_URL do EasyPanel antes de ligar.` : ''}`}</p>
      ${wa.forward ? `<p class="hint">Repassando todas as mensagens também para <b>${esc(wa.forward)}</b>.</p>` : ''}
      ${wa.hookOk ? '' : '<button class="btn sm" id="hook">Ligar recebimento das mensagens</button>'}
      <details class="hint" style="margin-top:8px"><summary>Configurar à mão na Evolution</summary><p>Webhook com o evento MESSAGES_UPSERT para:</p><input readonly value="${esc(wa.hookUrl || '')}" onfocus="this.select()"></details>`;
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">WhatsApp</h2></div>${waBox}</section>
    <section class="box"><div class="box-h"><h2 class="d">Leads (${rows.length})</h2>${rows.length ? '<button class="btn ghost sm" id="csv">Baixar planilha</button>' : ''}</div>
    <p class="lead" style="margin:0 0 12px">Quem montou um quadro no site.${rows.length ? ` ${conf} confirmaram pelo WhatsApp · ${cli} já viraram clientes.` : ''}</p>
    ${rows.length ? `<div class="scroll-x"><table><thead><tr><th>Data</th><th>Nome</th><th>Contato</th><th>Crianças</th><th>Origem</th><th>Situação</th></tr></thead><tbody>${rows.map(l => `<tr>
      <td>${dmy(l.created_at)}</td><td>${esc(l.name)}<div class="s">${esc(l.code || '')}${l.downloads > 1 ? ` · montou ${l.downloads} vezes` : ''}</div></td>
      <td>${l.whatsapp ? `<a href="${zap(l.whatsapp)}" target="_blank" rel="noopener">${fone(l.whatsapp)}</a>` : ''}${l.email ? `<div class="s"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></div>` : ''}</td>
      <td>${esc(l.kids.join(', '))}</td><td>${esc(SRC[l.source] || l.source)}</td><td>${sit(l)}</td></tr>`).join('')}</tbody></table></div>`
    : zero('memo', 'Ninguém montou o quadro de tarefas ainda. A página fica em /quadro-de-tarefas-infantil.')}</section>`;
  const h = $('#hook'); if (h) h.onclick = guard(async () => { await api('POST', '/owner/whatsapp/webhook'); toast('Recebimento ligado'); await ownerLeads(pane); });
  const b = $('#csv'); if (b) b.onclick = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Data', 'Nome', 'WhatsApp', 'E-mail', 'Crianças', 'Origem', 'Código', 'WhatsApp confirmado', 'Saiu', 'Cliente'].map(q).join(';'),
      ...rows.map(l => [dmy(l.created_at), l.name, l.whatsapp, l.email, l.kids.join(', '), SRC[l.source] || l.source, l.code, l.wa_confirmed_at ? 'sim' : 'não', l.opt_out_at ? 'sim' : 'não', l.cliente ? 'sim' : 'não'].map(q).join(';'))];
    const u = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const x = Object.assign(document.createElement('a'), { href: u, download: `leads-gametask-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
}
async function ownerFlows(pane) {
  const d = await api('GET', '/owner/flows');
  const opts = (sel) => Object.entries(d.sources).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const stepHtml = (s, n) => `<div class="fstep" data-sid="${s.id || ''}">
      <div class="fstep-h"><div class="field fday"><label for="fd${n}">Dia</label><input id="fd${n}" class="sday" type="number" min="1" max="365" step="1" value="${s.day}" inputmode="numeric"></div>
        <span class="s">${s.id ? `Enviada para ${s.sent || 0} pessoa${s.sent === 1 ? '' : 's'}` : 'Mensagem nova'}</span>
        <div class="btns"><button type="button" class="btn ghost sm" data-test>Mandar teste pra mim</button><button type="button" class="btn ghost sm" data-rm>Tirar</button></div></div>
      <textarea class="sbody" rows="${Math.max(6, String(s.body).split('\n').length + 4)}" maxlength="4000" aria-label="Texto da mensagem do dia ${s.day}">${esc(s.body)}</textarea></div>`;
  let n = 0;
  const box = (f) => `<form class="box flow" data-fid="${f.id}" novalidate>
      <div class="box-h"><h2 class="d">${esc(f.name)}</h2>${f.active ? '<span class="tag ok">Ativo</span>' : '<span class="tag wait">Pausado</span>'}</div>
      <p class="lead" style="margin:0 0 12px">${f.people} pessoa${f.people === 1 ? '' : 's'} confirmaram pelo WhatsApp nesta origem.</p>
      <div class="grid2"><div class="field"><label>Nome do fluxo</label><input name="name" maxlength="80" value="${esc(f.name)}"></div>
        <div class="field"><label>Para quem veio de</label><select name="source">${opts(f.source)}</select></div></div>
      <label class="check"><input type="checkbox" name="active" ${f.active ? 'checked' : ''}>Fluxo ativo (as mensagens saem sozinhas)</label>
      <div class="fstep zero-day"><b>Dia 0</b> · a pessoa manda o código e recebe o material (PDF) na hora.</div>
      <div class="fsteps">${f.steps.map(s => stepHtml(s, n++)).join('')}</div>
      <button type="button" class="btn ghost sm" data-add>+ Mensagem</button>
      <div class="err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost sm" data-del>Apagar fluxo</button><button class="btn green">Salvar fluxo</button></div></form>`;
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Fluxos de WhatsApp</h2><button class="btn sm" id="fnew">Novo fluxo</button></div>
      <p class="lead" style="margin:0">Mensagens que saem sozinhas, contando os dias a partir do dia em que a pessoa recebeu o material.
        Só saem de segunda a sábado, das 9h às 20h (horário de Brasília), uma pessoa por vez. Quem respondeu SAIR não recebe.</p>
      <p class="hint">No texto, use ${d.vars.map(v => `<b>{${v}}</b>`).join(' ')}: viram o nome, as crianças, o código, o link do GameTask, o link do quadro e os dias de garantia. No WhatsApp, *assim* fica em negrito.
        Mudar o texto de uma mensagem não reenvia para quem já recebeu.</p></section>
    ${d.flows.map(box).join('') || zero('calendar', 'Nenhum fluxo ainda.')}`;
  const read = (fm) => ({ name: fm.name.value, source: fm.source.value, active: fm.active.checked,
    steps: $$('.fstep[data-sid]', fm).map(x => ({ id: +x.dataset.sid || null, day: +$('.sday', x).value, body: $('.sbody', x).value })) });
  $$('form.flow', pane).forEach(fm => {
    const id = +fm.dataset.fid;
    fm.onclick = guard(async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const st = b.closest('.fstep');
      if (b.hasAttribute('data-add')) {
        const last = $$('.sday', fm).map(x => +x.value).reduce((a, c) => Math.max(a, c), 0);
        $('.fsteps', fm).insertAdjacentHTML('beforeend', stepHtml({ day: last + 3, body: '' }, n++));
        $$('.sbody', fm).at(-1).focus();
      } else if (b.hasAttribute('data-rm')) st.remove();
      else if (b.hasAttribute('data-test')) { const r = await api('POST', '/owner/flows/test', { body: $('.sbody', st).value }); toast('Teste enviado para o seu WhatsApp'); }
      else if (b.hasAttribute('data-del')) sheet(`Apagar o fluxo ${esc(fm.name.value)}?`, '<p class="lead" style="margin-top:6px">As mensagens programadas deixam de sair. O que já foi enviado continua no WhatsApp das pessoas.</p>',
        async () => { await api('DELETE', `/owner/flows/${id}`); await ownerFlows(pane); }, { saveLabel: 'Apagar', danger: true });
    });
    fm.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('PUT', `/owner/flows/${id}`, read(fm)); sfx.win(); toast('Fluxo salvo'); await ownerFlows(pane); }
      catch (er) { $('.err', fm).textContent = er.message; sfx.bad(); }
    };
  });
  $('#fnew').onclick = guard(async () => { await api('POST', '/owner/flows', { name: 'Novo fluxo', source: Object.keys(d.sources)[0] }); await ownerFlows(pane); pane.querySelector('form.flow:last-of-type input[name=name]')?.select(); });
}
async function ownerCoupons(pane) {
  const rows = await api('GET', '/owner/coupons');
  const link = (c) => `${location.origin}/app#/comprar/annual/${c.code}`;
  const used = (c) => c.max_uses ? `usado ${c.uses} de ${c.max_uses}` : `usado ${c.uses} ${c.uses === 1 ? 'vez' : 'vezes'}`;
  pane.innerHTML = `<form class="box" id="cf" novalidate><div class="box-h"><h2 class="d">Novo cupom</h2></div>
      <div class="cup-new">
        <div class="field"><label for="cc">Código</label><input id="cc" name="code" placeholder="NATAL25" autocapitalize="characters" maxlength="30" required></div>
        <div class="field"><label for="cp">Desconto (%)</label><input id="cp" name="percent" type="number" min="1" max="100" step="1" placeholder="10" inputmode="numeric" required></div>
        <div class="field"><label for="cm">Limite de usos</label><input id="cm" name="max_uses" type="number" min="1" step="1" placeholder="Sem limite" inputmode="numeric"></div>
        <div class="field"><label for="ce">Vale até</label><input id="ce" name="expires" type="date"></div>
      </div>
      <p class="hint">100% libera o plano de graça, sem passar pelo Mercado Pago. Cada família usa o mesmo cupom só uma vez.</p>
      <div class="err" role="alert"></div><div class="actions"><button class="btn green">Criar cupom</button></div></form>
    <section class="box"><div class="box-h"><h2 class="d">Cupons (${rows.length})</h2></div>
      ${rows.length ? `<div class="list">${rows.map(c => `<div class="item ${c.active ? '' : 'off'}"><div class="ic">${im('gift')}</div><div class="grow">
        <div class="t"><span class="cup-code">${esc(c.code)}</span> <b>${c.percent}%</b>${c.active ? '' : ' <span class="tag">pausado</span>'}</div>
        <div class="s">${used(c)}${c.expires ? ` · vale até ${dmy(c.expires)}` : ''}</div></div>
        <div class="btns"><button class="btn ghost sm" data-link="${c.id}">Copiar link</button><button class="btn ghost sm" data-tog="${c.id}">${c.active ? 'Pausar' : 'Ativar'}</button><button class="btn ghost sm" data-del="${c.id}">Apagar</button></div></div>`).join('')}</div>`
      : zero('gift', 'Nenhum cupom ainda. Crie o primeiro acima.')}</section>`;
  $('#cf').onsubmit = guard(async (e) => {
    e.preventDefault(); const fm = e.target;
    try { const r = await api('POST', '/owner/coupons', Object.fromEntries(new FormData(fm))); sfx.win(); toast(`Cupom ${r.code} criado`); await ownerCoupons(pane); }
    catch (er) { $('.err', fm).textContent = er.message; sfx.bad(); }
  });
  const byId = (id) => rows.find(c => c.id === +id);
  $$('[data-link]', pane).forEach(b => b.onclick = async () => { const u = link(byId(b.dataset.link)); try { await navigator.clipboard.writeText(u); toast('Link do carrinho com o cupom copiado'); } catch { toast(u); } });
  $$('[data-tog]', pane).forEach(b => b.onclick = guard(async () => { const c = byId(b.dataset.tog); await api('PUT', `/owner/coupons/${c.id}`, { active: !c.active }); await ownerCoupons(pane); }));
  $$('[data-del]', pane).forEach(b => b.onclick = () => { const c = byId(b.dataset.del);
    sheet(`Apagar o cupom ${c.code}?`, '<p class="lead" style="margin-top:6px">Quem já usou continua com o plano. O código deixa de funcionar.</p>',
      async () => { await api('DELETE', `/owner/coupons/${c.id}`); await ownerCoupons(pane); }, { saveLabel: 'Apagar', danger: true }); });
}
async function ownerPrices(pane) {
  const s = (await api('GET', '/owner/summary')).settings;
  pane.innerHTML = `<form class="box" id="f" novalidate><div class="box-h"><h2 class="d">Preços e garantia</h2></div>
    <p class="lead">Valem para novas cobranças e para a página de vendas. Quem já pagou mantém o período comprado.</p>
    <div class="grid2"><div class="field"><label for="pa">Plano anual (R$ por ano)</label><input id="pa" name="price_annual" type="number" step="0.01" min="1" value="${s.price_annual}" inputmode="decimal"><p class="hint" id="pah"></p></div>
    <div class="field"><label for="pm">Plano mensal (R$ por mês)</label><input id="pm" name="price_monthly" type="number" step="0.01" min="1" value="${s.price_monthly}" inputmode="decimal"></div>
    <div class="field"><label for="pp">Plano Plus (R$ por ano)</label><input id="pp" name="price_plus" type="number" step="0.01" min="1" value="${s.price_plus}" inputmode="decimal"><p class="hint">Anual com avisos no celular e no tablet.</p></div></div>
    <div class="grid2"><div class="field"><label for="gd">Dias de garantia</label><input id="gd" name="guarantee_days" type="number" min="0" max="90" step="1" value="${s.guarantee_days ?? 14}" inputmode="numeric"><p class="hint">Na primeira compra, a família pode pedir o dinheiro de volta dentro deste prazo, sem dizer o motivo. O estorno sai na hora pelo Mercado Pago. 0 = sem garantia.</p></div>
    <div class="field"><label for="td">Dias de teste grátis</label><input id="td" name="trial_days" type="number" min="0" step="1" value="${s.trial_days}" inputmode="numeric"><p class="hint">0 = sem teste (quem chega paga e tem a garantia). Não muda o prazo de quem já se cadastrou.</p></div></div>
    <div class="err" role="alert"></div><div class="actions"><button class="btn green">Salvar preços</button></div></form>`;
  const f = $('#f'), h = () => { const a = +f.price_annual.value, m = +f.price_monthly.value; $('#pah').textContent = a && m ? `Sai por ${brl(Math.floor(a / 12 * 100) / 100)} por mês, ${Math.max(0, Math.round((1 - a / (m * 12)) * 100))}% mais barato que o mensal.` : ''; };
  f.oninput = h; h();
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', '/owner/settings', { price_annual: f.price_annual.value, price_monthly: f.price_monthly.value, price_plus: f.price_plus.value, trial_days: f.trial_days.value, guarantee_days: f.guarantee_days.value }); toast('Preços salvos'); f.querySelector('.err').textContent = ''; }
    catch (er) { f.querySelector('.err').textContent = er.message; sfx.bad(); }
  };
}

// ---------- Avisos no celular/tablet (plano anual) ----------
const b64key = (s) => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const guessLabel = () => /iPad|Tablet/i.test(navigator.userAgent) || (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)) || (isIOS && navigator.maxTouchPoints > 1 && !/iPhone/.test(navigator.userAgent)) ? 'Tablet' : /Mobi|iPhone|Android/i.test(navigator.userAgent) ? 'Celular' : 'Computador';
async function mySub() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration(); return reg ? reg.pushManager.getSubscription() : null;
}
async function adminAlarms(pane, refresh) {
  const [p, alarms, kids] = await Promise.all([api('GET', '/admin/push'), api('GET', '/admin/alarms'), api('GET', '/admin/kids')]);
  const kidsOn = kids.filter(k => k.active), kidOf = (id) => kids.find(k => k.id === id);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const sub = supported ? await mySub() : null, mine = sub && p.devices.find(d => d.endpoint === sub.endpoint);
  const when = (w) => w.length === 7 ? 'todo dia' : w === '12345' ? 'seg a sex' : [...w].map(d => DAYN[d]).join(', ');

  const device = !p.plus ? `<div class="upsell">${im('phone')}<div><b>Avisos no celular e no tablet fazem parte do plano anual.</b><p>Lembrete antes de cada tarefa com horário, alarmes como "hora de ir para a escola" e aviso para você aprovar as missões.</p></div><a class="btn sm" href="#/assinar">Ver planos</a></div>`
    : !supported ? (isIOS && !standalone ? `<div class="notice">${im('phone')}<p>No iPhone e no iPad, os avisos só funcionam com o GameTask instalado: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra pelo ícone e volte aqui.</p></div>`
      : `<div class="notice">${im('cross')}<p>Este navegador não recebe avisos. Use o Chrome no Android ou no computador, ou o GameTask instalado no iPhone/iPad.</p></div>`)
    : Notification.permission === 'denied' ? `<div class="notice">${im('lock')}<p>Os avisos foram bloqueados neste aparelho. Libere em <b>Configurações do site → Notificações</b> do navegador e volte aqui.</p></div>`
    : mine ? `<div class="dev-on">${im('check')}<div class="grow"><b>Avisos ligados neste aparelho</b><span>${esc(mine.label)} · ${[mine.reminders && 'lembretes', mine.approvals && 'aprovações'].filter(Boolean).join(' e ') || 'nenhum tipo marcado'}</span></div>
        <div class="btns"><button class="btn green sm" id="test">Enviar teste</button><button class="btn ghost sm" data-dev="${mine.id}">Ajustar</button></div></div>`
    : `<p class="lead">Ligue os avisos no tablet das crianças e no celular de quem aprova as missões.</p>
       <div class="grid2"><div class="field"><label for="dl">Nome deste aparelho</label><input id="dl" value="${guessLabel()}" maxlength="60"></div></div>
       <label class="check"><input type="checkbox" id="dr" checked>Lembretes das crianças (tarefas com horário e avisos)</label>
       <label class="check"><input type="checkbox" id="da" ${guessLabel() === 'Celular' ? 'checked' : ''}>Pedidos de aprovação (quando uma criança conclui uma missão)</label>
       <div class="actions"><button class="btn green" id="on">${im('phone')}Ligar avisos neste aparelho</button></div>`;

  // no app Android quem avisa é o alarme do próprio celular (bloco "Alarme deste celular"); os avisos do navegador não valem lá
  pane.innerHTML = `${NATIVE ? '' : `<section class="box" data-sum="${!p.plus ? 'No plano anual' : mine ? 'Ligados' : 'Desligados'}"><div class="box-h"><h2 class="d">Avisos neste aparelho</h2></div>${device}</section>`}
    <section class="box" data-sum="${alarms.length ? `${alarms.length} ${alarms.length === 1 ? 'aviso' : 'avisos'}` : 'Nenhum ainda'}"><div class="box-h"><h2 class="d">Avisos programados</h2>${p.plus && full() ? '<button class="btn green sm" id="new">Novo aviso</button>' : ''}</div>
      <p class="lead">Alarmes que tocam nos aparelhos da família, como "Hora de ir para a escola" de segunda a sexta.</p>
      ${alarms.length ? `<div class="list">${alarms.map(a => `<div class="item ${a.active ? '' : 'off'}"><div class="ic">${im('clock')}</div><div class="grow"><div class="t">${esc(a.title)}</div>
        <div class="s"><b class="num">${esc(a.time)}</b> · ${when(a.weekdays)} · ${a.kid_id ? esc(kidOf(a.kid_id)?.name || '?') : 'toda a família'}</div></div>
        ${full() ? `<div class="btns"><button class="btn ghost sm" data-e="${a.id}">Editar</button></div>` : ''}</div>`).join('')}</div>` : zero('clock', 'Nenhum aviso programado ainda.')}
      <div class="field lead-time"><label for="rb">Tarefas com horário avisam</label><select id="rb" ${p.plus && full() ? '' : 'disabled'}>${[[0, 'na hora certa'], [5, '5 minutos antes'], [10, '10 minutos antes'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes']].map(([v, l]) => `<option value="${v}" ${+p.remind_before === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <p class="hint">Vale para as tarefas que têm horário (natação 18h, por exemplo) e só avisa quem ainda não fez.</p></div></section>
    ${p.plus ? `<section class="box" data-sum="Para conferir se um aviso saiu"><div class="box-h"><h2 class="d">Últimos avisos enviados</h2></div>
      <p class="lead">Se um aviso não tocou, veja aqui se ele saiu e em quantos aparelhos chegou.</p>
      ${p.log?.length ? `<div class="list">${p.log.map(l => `<div class="item"><div class="ic">${im(l.fail || !l.ok ? 'cross' : 'check')}</div><div class="grow"><div class="t">${esc(l.title)}</div>
        <div class="s">${new Date(l.created_at.replace(' ', 'T') + (l.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · chegou em ${l.ok} aparelho(s)${l.fail ? ` · falhou em ${l.fail}` : ''}${l.err ? ` · ${esc(l.err)}` : ''}</div></div></div>`).join('')}</div>`
        : zero('clock', 'Nenhum aviso enviado ainda.')}</section>` : ''}
    ${p.devices.length ? `<section class="box"><div class="box-h"><h2 class="d">Aparelhos com avisos</h2></div><div class="list">${p.devices.map(d => `<div class="item"><div class="ic">${im(/celular/i.test(d.label) ? 'phone' : /computador/i.test(d.label) ? 'laptop' : 'tv')}</div>
      <div class="grow"><div class="t">${esc(d.label)}${mine && mine.id === d.id ? ' <span class="tag ok">este</span>' : ''}</div><div class="s">${[d.reminders && 'Lembretes', d.approvals && 'Aprovações'].filter(Boolean).join(' · ') || 'Nada marcado'} · desde ${dmy(d.created_at)}</div></div>
      <div class="btns"><button class="btn ghost sm" data-dev="${d.id}">Ajustar</button></div></div>`).join('')}</div></section>` : ''}`;

  const on = $('#on'); if (on) on.onclick = guard(async () => {
    on.disabled = true;
    try {
      if (await Notification.requestPermission() !== 'granted') throw new Error('Sem permissão, o aparelho não consegue receber os avisos.');
      const reg = await navigator.serviceWorker.ready;
      const key = b64key(p.key), subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      let s = await reg.pushManager.getSubscription();
      if (!s) {
        try { s = await subscribe(); }
        catch (e) { // inscrição antiga travada ou serviço do Google instável: limpa e tenta de novo
          await new Promise(r => setTimeout(r, 800));
          try { s = await subscribe(); }
          catch (e2) { throw new Error(/push service|abort/i.test(e2.message) || e2.name === 'AbortError'
            ? 'O aparelho não conseguiu falar com o serviço de avisos do Google. Confira se o celular está com internet e com o Google Play Services ativo, tire a economia de bateria do navegador e tente de novo. Em Brave ou navegadores sem Google, use o Chrome.' : e2.message); }
        }
      }
      await api('POST', '/admin/push', { sub: s.toJSON(), label: $('#dl').value, reminders: $('#dr').checked, approvals: $('#da').checked });
      sfx.done(); toast('Avisos ligados!'); await api('POST', '/admin/push/test'); refresh();
    } finally { on.disabled = false; }
  });
  const test = $('#test'); if (test) test.onclick = guard(async () => { const r = await api('POST', '/admin/push/test'); toast(r.sent ? `Aviso enviado para ${r.sent} aparelho(s)` : 'Nenhum aparelho recebeu', !r.sent); });
  $$('[data-dev]').forEach(b => b.onclick = () => {
    const d = p.devices.find(x => x.id == b.dataset.dev);
    const bg = sheet('Ajustar aparelho', `<div class="field"><label for="el">Nome</label><input id="el" name="label" value="${esc(d.label)}" maxlength="60"></div>
      <label class="check"><input type="checkbox" name="reminders" ${d.reminders ? 'checked' : ''}>Lembretes das crianças</label>
      <label class="check"><input type="checkbox" name="approvals" ${d.approvals ? 'checked' : ''}>Pedidos de aprovação</label>
      <button type="button" class="btn red sm" id="rm" style="margin-top:16px">Desligar avisos deste aparelho</button>`,
      async (f) => { await api('PUT', '/admin/push/' + d.id, { label: f.label.value, reminders: f.reminders.checked, approvals: f.approvals.checked }); toast('Aparelho atualizado'); refresh(); });
    bg.querySelector('#rm').onclick = guard(async () => {
      await api('DELETE', '/admin/push/' + d.id);
      if (mine && mine.id === d.id) await sub.unsubscribe().catch(() => {});
      bg.remove(); toast('Avisos desligados'); refresh();
    });
  });
  $('#rb').onchange = guard(async (e) => { await api('PUT', '/admin/push-settings', { remind_before: e.target.value }); toast('Antecedência salva'); });
  const form = (a = { title: '', kid_id: null, time: '07:00', weekdays: '12345', active: 1 }) => `
    <div class="field"><label for="at">Aviso</label><input id="at" name="title" value="${esc(a.title)}" placeholder="Hora de ir para a escola" maxlength="120" required></div>
    <div class="field"><label for="ak">Para quem</label><select id="ak" name="kid"><option value="">Toda a família</option>${kidsOn.map(k => `<option value="${k.id}" ${a.kid_id === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
      <p class="hint">Com um filho escolhido, o aviso sai assim: "Bernardo, hora de ir para a escola".</p></div>
    <div class="field"><label for="ah">Horário</label><input id="ah" type="time" name="time" value="${esc(a.time)}" required></div>
    <div class="field"><span class="lab">Dias da semana</span><div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" name="wd" value="${i}" ${a.weekdays.includes(i) ? 'checked' : ''}><span title="${DAYN[i]}">${d}</span></label>`).join('')}</div></div>
    <label class="check"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}>Aviso ligado</label>`;
  const read = (f) => ({ title: f.title.value, kid_id: f.kid.value || null, time: f.time.value, weekdays: $$('[name=wd]:checked', f).map(x => x.value).join(''), active: f.active.checked });
  const nb = $('#new'); if (nb) nb.onclick = () => sheet('Novo aviso', form(), async (f) => { await api('POST', '/admin/alarms', read(f)); toast('Aviso criado'); refresh(); }, { saveLabel: 'Criar aviso' });
  $$('[data-e]').forEach(b => b.onclick = () => {
    const a = alarms.find(x => x.id == b.dataset.e);
    const bg = sheet('Editar aviso', form(a) + '<button type="button" class="btn red sm" id="del" style="margin-top:16px">Apagar aviso</button>',
      async (f) => { await api('PUT', '/admin/alarms/' + a.id, read(f)); refresh(); });
    bg.querySelector('#del').onclick = guard(async () => { await api('DELETE', '/admin/alarms/' + a.id); bg.remove(); toast('Aviso apagado'); refresh(); });
  });
}

// ---------- Assistente de avisos: abre sozinho no app instalado e guia em poucos toques ----------
// O site não consegue abrir as telas de bateria do Android; o que dá: a janelinha "Permitir", um teste com o app fechado
// e, se não chegar, o passo a passo da marca do aparelho.
const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let wizShown = false;
async function maybePushWizard() {
  if (NATIVE || wizShown || !ME?.family || !ME.access?.plus || !pushOk() || !(standalone || PAINEL) || $('.sheet-bg')) return;
  const st = store.get('gt-pushwiz') || '';
  if (st === 'done' || (st.startsWith('later:') && Date.now() < +st.slice(6))) return;
  const sub = await mySub().catch(() => null);
  if (sub && st !== 'testing') return;
  wizShown = true;
  pushWizard(st === 'testing' && sub ? 'ask' : Notification.permission === 'denied' ? 'blocked' : 'start');
}
const FIX = {
  xiaomi: ['Segure o dedo no ícone do <b>GameTask</b> e toque em <b>Informações do app</b>.', 'Em <b>Notificações</b>, ligue tudo, inclusive <b>Tela de bloqueio</b> e <b>Notificações flutuantes</b>.',
    'Agora segure o ícone do <b>Chrome</b> → <b>Informações do app</b> → <b>Início automático</b>: ligue.', 'Ainda no Chrome, em <b>Economia de bateria</b>, escolha <b>Sem restrições</b>.',
    'Na tela de apps recentes, segure o Chrome e toque no <b>cadeado</b>.'],
  samsung: ['Segure o ícone do <b>GameTask</b> → <b>Informações do app</b> → <b>Notificações</b>: permita.', 'Segure o ícone do <b>Chrome</b> → <b>Informações do app</b> → <b>Bateria</b>: escolha <b>Sem restrição</b>.',
    'Em Configurações → <b>Bateria</b> → <b>Limites de uso em segundo plano</b>, tire o Chrome dos “apps em suspensão”.'],
  android: ['Segure o ícone do <b>GameTask</b> → <b>Informações do app</b> → <b>Notificações</b>: permita.', 'Segure o ícone do <b>Chrome</b> → <b>Informações do app</b> → <b>Bateria</b>: escolha <b>Sem restrições</b> (ou “Não otimizar”).'],
  ios: ['Abra os <b>Ajustes</b> → <b>Notificações</b> → <b>GameTask</b> e ligue <b>Permitir Notificações</b>.', 'Confira se o modo <b>Foco</b> (Não Perturbe) está desligado.', 'Abra sempre pelo ícone do GameTask na Tela de Início, não pelo Safari.'],
};
const BRANDS = [['xiaomi', 'Xiaomi, Redmi ou Poco'], ['samsung', 'Samsung'], ['android', 'Motorola ou outro Android'], ['ios', 'iPhone ou iPad']];
async function pushSubscribe() {
  const { key } = await api('GET', '/push/key');
  const reg = await navigator.serviceWorker.ready, opts = { userVisibleOnly: true, applicationServerKey: b64key(key) };
  let s = await reg.pushManager.getSubscription();
  if (!s) { try { s = await reg.pushManager.subscribe(opts); } catch { await new Promise(r => setTimeout(r, 800)); s = await reg.pushManager.subscribe(opts); } }
  if (PAINEL && ME.parent) await api('POST', '/admin/push', { sub: s.toJSON(), label: guessLabel(), reminders: true, approvals: true });
  else await api('POST', '/push/device', { sub: s.toJSON(), label: guessLabel() });
  return s;
}
function pushWizard(step = 'start') {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = '<div class="sheet wiz" role="dialog" aria-label="Ligar os avisos"></div>'; document.body.append(bg);
  const box = bg.firstChild, close = () => bg.remove();
  const later = () => { store.set('gt-pushwiz', 'later:' + (Date.now() + 3 * 864e5)); close(); };
  const done = () => { store.set('gt-pushwiz', 'done'); close(); sfx.win(); toast('Avisos funcionando neste aparelho!'); };
  const steps = (list) => `<ol class="wiz-steps">${list.map(s => `<li><span>${s}</span></li>`).join('')}</ol>`;
  const show = (s) => {
    const [name, arg] = s.split(':');
    const V = {
      start: `${im('bell')}<h2 class="d">Ligue os avisos deste aparelho</h2>
        <p>Assim o GameTask avisa “hora da escola” e “o tempo de videogame acabou”, mesmo com o app fechado.</p>
        <p class="wiz-tip">Vai abrir uma janelinha. É só tocar em <b>Permitir</b>.</p>
        <div class="err" role="alert"></div>
        <button class="btn green big" data-go="allow">Ligar os avisos</button><button class="link" data-go="later">Agora não</button>`,
      test: `${im('phone')}<h2 class="d">Agora, o teste</h2>
        <p>Toque no botão e <b>saia do GameTask</b> (volte para a tela inicial). Em 10 segundos chega um aviso.</p>
        <div class="err" role="alert"></div>
        <button class="btn green big" data-go="send">Enviar o teste</button><button class="link" data-go="later">Testar depois</button>`,
      wait: `${im('hourglass')}<h2 class="d">Pode sair do app agora</h2>
        <p>O aviso de teste chega em 10 segundos. Quando voltar, me conte se ele apareceu.</p>
        <button class="btn green big" data-go="yes">Chegou!</button><button class="btn ghost" data-go="no">Não chegou</button>`,
      ask: `${im('bell')}<h2 class="d">O aviso de teste chegou?</h2>
        <button class="btn green big" data-go="yes">Chegou!</button><button class="btn ghost" data-go="no">Não chegou</button><button class="link" data-go="test">Enviar de novo</button>`,
      brand: `${im('phone')}<h2 class="d">Qual é o aparelho?</h2><p>Alguns celulares desligam os avisos para economizar bateria. Vou te mostrar onde liberar.</p>
        <div class="wiz-brands">${BRANDS.map(([k, l]) => `<button class="btn ghost" data-go="fix:${k}">${l}</button>`).join('')}</div>`,
      fix: `${im('wrench')}<h2 class="d">Só mais estes ajustes</h2>${steps(FIX[arg] || FIX.android)}
        <button class="btn green big" data-go="test">Já fiz, testar de novo</button><button class="link" data-go="later">Fazer depois</button>`,
      blocked: `${im('lock')}<h2 class="d">Os avisos ficaram bloqueados</h2>${steps(isIOS ? FIX.ios.slice(0, 1) : [FIX.android[0]])}
        <button class="btn green big" data-go="start">Já liberei</button><button class="link" data-go="later">Fazer depois</button>`,
    };
    box.innerHTML = V[name];
    $$('[data-go]', box).forEach(b => b.onclick = async () => {
      const go = b.dataset.go, err = $('.err', box);
      if (go === 'later') return later();
      if (go === 'yes') return done();
      if (go === 'no') return show('brand');
      if (go === 'allow') {
        b.disabled = true;
        try {
          const p = await Notification.requestPermission();
          if (p !== 'granted') return show('blocked');
          await pushSubscribe(); sfx.done(); show('test');
        } catch (e) { err.textContent = e.message || 'Não deu certo. Tente de novo.'; b.disabled = false; }
        return;
      }
      if (go === 'send') {
        b.disabled = true;
        try { const s = (await mySub()) || await pushSubscribe(); await api('POST', '/push/test', { endpoint: s.endpoint, delay: 10 }); store.set('gt-pushwiz', 'testing'); show('wait'); }
        catch (e) { err.textContent = e.message; b.disabled = false; }
        return;
      }
      show(go);
    });
  };
  show(step);
}

// ---------- Cartão dentro do app (formulário oficial do Mercado Pago: os dados do cartão não passam pelo nosso servidor) ----------
let mpSdk;
const loadMp = () => mpSdk || (mpSdk = new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2';
  s.onload = ok; s.onerror = () => { mpSdk = null; s.remove(); no(new Error('Não foi possível abrir o pagamento com cartão. Confira a internet e tente de novo.')); };
  document.head.append(s);
}));
// o = { key, amount, email, pay(formData) -> {ref,status,message}, onPaid }
async function showCard(o) {
  const bg = sheet('Pague com cartão', `<div class="card-brick" id="cardBrick"><p class="pix-wait"><i class="spin"></i><span>Abrindo o pagamento seguro…</span></p></div>
    <p class="pw-note">${im('shield')}Os dados do cartão vão direto para o Mercado Pago.</p>`, async () => {});
  bg.querySelector('.actions .btn').remove();
  const err = (t) => { bg.querySelector('.err').textContent = t || ''; };
  let ctl, wait;
  const close = () => { clearTimeout(wait); try { ctl?.unmount?.(); } catch {} bg.remove(); };
  bg.querySelector('[data-x]').onclick = close;
  const paid = () => { close(); sfx.win(); o.onPaid(); };
  // em análise: consulta até cair (mesma rota do Pix)
  const poll = (ref) => { wait = setTimeout(async () => {
    if (!document.body.contains(bg)) return;
    const st = (await api('GET', '/billing/pix/' + ref).catch(() => ({}))).status;
    if (st === 'approved') return paid();
    if (['rejected', 'cancelled', 'invalid'].includes(st)) return err('O pagamento não foi aprovado. Tente outro cartão ou o Pix.');
    poll(ref);
  }, 5000); };
  try {
    await loadMp();
    const mp = new window.MercadoPago(o.key, { locale: 'pt-BR' });
    $('#cardBrick', bg).innerHTML = '';
    ctl = await mp.bricks().create('cardPayment', 'cardBrick', {
      initialization: { amount: o.amount, payer: { email: o.email } },
      customization: { paymentMethods: { maxInstallments: 12 }, visual: { style: { theme: 'default', customVariables: { baseColor: '#2bb24c', borderRadiusLarge: '16px' } } } },
      callbacks: {
        onReady: () => {},
        onError: (e) => { console.error(e); if (e?.type === 'critical') err('O formulário do cartão falhou. Feche e tente de novo, ou use o Pix.'); },
        onSubmit: async (d) => {
          err('');
          try {
            const r = await o.pay(d);
            if (r.status === 'approved') return paid();
            err(r.message);
            if (['in_process', 'pending'].includes(r.status)) poll(r.ref); else sfx.bad();
          } catch (e) { err(e.message); sfx.bad(); }
        },
      },
    });
  } catch (e) { err(e.message); $('#cardBrick', bg).innerHTML = ''; }
}

// ---------- Pix dentro do app ----------
// r = { ref, amount, plan, code, qr }. Consulta a cada 4 s até o pagamento cair; onPaid roda uma vez.
function showPix(r, onPaid) {
  const bg = sheet('Pague com Pix', `
    <p class="lead" style="margin-top:6px">Abra o app do seu banco, escolha <b>Pix</b> e leia o QR Code ou use o código copia e cola.</p>
    <div class="pix">${r.qr ? `<img class="pix-qr" src="data:image/png;base64,${r.qr}" alt="QR Code do Pix">` : ''}
      <div class="pix-amount"><span>Valor</span><b class="d num">${brl(r.amount)}</b></div></div>
    <div class="field"><label for="pc">Pix copia e cola</label><input id="pc" value="${esc(r.code)}" readonly></div>
    <div class="share-row"><button type="button" class="btn green" id="pcp">Copiar código</button></div>
    <p class="pix-wait" id="pw"><i class="spin"></i><span>Aguardando o pagamento… assim que cair, esta tela avança sozinha.</span></p>`,
    async () => { if (!await check()) throw new Error('Ainda não recebemos o pagamento. Pode levar alguns segundos depois de pagar.'); }, { saveLabel: 'Já paguei' });
  let done = false, timer;
  const stop = () => { done = true; clearTimeout(timer); };
  const check = async () => {
    if (done) return true;
    const st = (await api('GET', '/billing/pix/' + r.ref)).status;
    if (st === 'approved') { stop(); sfx.win(); bg.remove(); onPaid(); return true; }
    if (['rejected', 'cancelled', 'invalid'].includes(st)) { stop(); $('#pw span', bg).textContent = 'O Mercado Pago não confirmou este Pix. Feche e gere outro.'; }
    return false;
  };
  const tick = () => { if (done || !document.body.contains(bg)) return stop(); check().catch(() => {}).finally(() => { if (!done) timer = setTimeout(tick, 4000); }); };
  timer = setTimeout(tick, 4000);
  bg.querySelector('#pcp').onclick = async () => { const i = bg.querySelector('#pc'); i.select(); try { await navigator.clipboard.writeText(r.code); } catch { document.execCommand('copy'); } toast('Código copiado'); };
}

// ---------- Carrinho (vindo da página de vendas): paga primeiro, cria a senha depois ----------
const trialText = (d) => { d = Math.round(+d) || 0; return d >= 30 && d % 30 === 0 ? (d === 30 ? '1 mês' : `${d / 30} meses`) : `${d} ${d === 1 ? 'dia' : 'dias'}`; };
const CART = {
  annual: { t: 'Anual', note: 'por ano', perks: ['Filhos ilimitados', 'Todos os aparelhos da família', 'Pix, cartão ou boleto'] },
  monthly: { t: 'Mensal', note: 'por mês', perks: ['Filhos ilimitados', 'Todos os aparelhos da família', 'Sem fidelidade'] },
};
// Cupom de desconto: "Tem um cupom?" abre o campo; aplicado, chama onChange({ code, percent }) ou onChange(null)
const offPrice = (v, c) => c ? Math.round(v * (100 - c.percent)) / 100 : v;
function couponBox(box, onChange, initial) {
  let cur = null;
  const paint = () => {
    box.innerHTML = cur ? `<div class="cup-ok">${im('gift')}<span>Cupom <b>${esc(cur.code)}</b>: ${cur.percent}% de desconto</span><button type="button" class="link" data-x>Remover</button></div>`
      : `<button type="button" class="link cup-open" data-open>Tem um cupom de desconto?</button>
        <div class="cup-form" hidden><input name="cupom" placeholder="CÓDIGO" autocapitalize="characters" autocomplete="off" aria-label="Código do cupom" maxlength="30"><button type="button" class="btn sm" data-go>Aplicar</button></div><p class="err cup-err" role="alert"></p>`;
    const x = $('[data-x]', box); if (x) x.onclick = () => { cur = null; paint(); onChange(null); sfx.tap(); };
    const o = $('[data-open]', box); if (o) o.onclick = () => { o.hidden = true; $('.cup-form', box).hidden = false; $('input', box).focus(); };
    const go = $('[data-go]', box), inp = $('input', box);
    if (go) {
      const apply = async (code) => {
        go.disabled = true; $('.cup-err', box).textContent = '';
        try { cur = await api('POST', '/billing/coupon', { code }); paint(); onChange(cur); sfx.win(); }
        catch (e) { if (!$('.cup-form', box)) paint(); $('[data-open]', box).hidden = true; $('.cup-form', box).hidden = false; $('.cup-err', box).textContent = e.message; sfx.bad(); }
        finally { const g = $('[data-go]', box); if (g) g.disabled = false; }
      };
      go.onclick = () => apply(inp.value);
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(inp.value); } };
      if (initial) { inp.value = initial; initial = null; apply(inp.value); }
    }
  };
  paint();
}

async function viewBuy(planIn, codeIn) {
  const p = await api('GET', '/public/pricing');
  let plan = CART[planIn] ? planIn : 'annual', cup = null;
  const draw = () => {
    const c = CART[plan], total = offPrice(p[plan], cup), free = cup && !(total > 0);
    $('#cart').innerHTML = `<div class="cart-top">${im(plan === 'plus' ? 'rocket' : 'trophy')}<div><b class="d">Plano ${c.t}</b><span>${c.perks.join(' · ')}</span></div></div>
      <div class="cart-total"><span>Total hoje</span>${cup ? `<s class="num">${brl(p[plan])}</s>` : ''}<b class="d num">${free ? 'Grátis' : brl(total)}</b><small>${c.note}</small></div>
      ${p.trial_days > 0 ? `<p class="cart-note">${im('hourglass')}<span>Você paga hoje e o plano <b>só começa quando o teste grátis acabar (${trialText(p.trial_days)})</b>. Nenhum dia se perde.</span></p>`
        : p.guarantee_days ? `<p class="cart-note">${im('shield')}<span><b>Garantia de ${p.guarantee_days} dias.</b> Se não gostar, devolvemos o seu dinheiro, sem perguntas.</span></p>` : ''}`;
    $('#payBtns').innerHTML = free ? '<button class="btn green big" name="via" value="free">Ativar grátis</button>'
      : `<button class="btn green big" name="via" value="pix">Pagar com Pix</button>${p.card ? '<button class="btn" name="via" value="card">Pagar com cartão</button><button class="switch" name="via" value="mp">Boleto ou outras formas</button>' : '<button class="btn ghost" name="via" value="mp">Cartão ou boleto</button>'}`;
  };
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth cartwrap">
    <div class="logo">${im('game')}<h1 class="d stroke" style="font-size:40px">Seu carrinho</h1></div>
    <form class="card" id="f" novalidate>
      <div class="field"><span class="lab">Plano</span>${seg('plan', [['annual', 'Anual'], ['monthly', 'Mensal']], plan)}</div>
      <div id="cart" class="cart"></div>
      <div class="field"><label for="e">Seu e-mail</label><input id="e" name="email" type="email" inputmode="email" autocomplete="email" required><p class="hint">Só isso por agora. Nome, senha e PIN você cria logo depois do pagamento.</p></div>
      <div class="err" id="err" role="alert"></div>
      <div class="cup" id="cup"></div>
      <div class="actions pay-actions" id="payBtns"></div>
      <p class="pw-note" style="margin-top:12px">${im('shield')}Pagamento seguro pelo Mercado Pago.</p>
    </form>
    <button class="switch" id="free">Prefiro testar de graça primeiro</button>
    <a class="switch home-link" href="#/login">Já tenho conta</a>
  </div></div>`;
  draw();
  couponBox($('#cup'), (c) => { cup = c; draw(); }, codeIn);
  $('#f').addEventListener('change', (e) => { if (e.target.name === 'plan') { plan = e.target.value; draw(); sfx.tap(); } });
  $('#free').onclick = () => { location.hash = '#/criar'; };
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const via = e.submitter?.value || 'pix', btns = $$('.actions .btn', e.target), label = e.submitter?.textContent;
    btns.forEach(b => { b.disabled = true; }); if (e.submitter) e.submitter.textContent = via === 'pix' ? 'Gerando o Pix…' : via === 'free' ? 'Ativando…' : 'Abrindo o Mercado Pago…';
    const body = { plan, email: e.target.email.value, coupon: cup?.code };
    if (via === 'card') {
      btns.forEach(b => { b.disabled = false; }); e.submitter.textContent = label;
      if (!/^\S+@\S+\.\S+$/.test(body.email.trim())) { $('#err').textContent = 'Digite um e-mail válido'; e.target.email.focus(); sfx.bad(); return; }
      $('#err').textContent = '';
      return showCard({ key: p.card, amount: offPrice(p[plan], cup), email: body.email.trim(), pay: (d) => api('POST', '/billing/guest-card', { ...body, ...d }),
        onPaid: async () => { await route(); burst('trophy', 'Pagamento confirmado!', 'Falta só dar um nome à família e criar a senha e o PIN dos pais.', 'Continuar'); } });
    }
    try {
      $('#err').textContent = '';
      if (via === 'mp') { const r = await api('POST', '/billing/guest-checkout', body); location.href = r.url; return; }
      if (via === 'free') { await api('POST', '/billing/guest-free', body); await route(); burst('trophy', 'Plano ativado!', 'Falta só dar um nome à família e criar a senha e o PIN dos pais.', 'Continuar'); return; }
      const r = await api('POST', '/billing/guest-pix', body);
      if (r.url) { location.href = r.url; return; }
      showPix(r, async () => { await route(); burst('trophy', 'Pagamento confirmado!', 'Falta só dar um nome à família e criar a senha e o PIN dos pais.', 'Continuar'); });
    } catch (er) {
      $('#err').innerHTML = esc(er.message) + (er.code === 'exists' ? ' <a href="#/login">Entrar</a>' : '');
      e.target.classList.remove('shake'); void e.target.offsetWidth; e.target.classList.add('shake'); sfx.bad();
    } finally { if (e.submitter && document.body.contains(e.submitter)) { btns.forEach(b => { b.disabled = false; }); e.submitter.textContent = label; } }
  };
}

// Depois do pagamento: senha e PIN (vale pela sessão deste aparelho ou pelo link do e-mail)
async function viewFinalize(token) {
  const ok = token ? (await api('GET', '/auth/reset/' + encodeURIComponent(token)).catch(() => ({}))).valid : !!ME.pending;
  const paid = ME.access?.status === 'paid';
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im(ok ? 'trophy' : 'lock')}<h1 class="d stroke" style="font-size:40px">${ok ? (paid || token ? 'Pagamento confirmado!' : 'Quase lá!') : 'Link vencido'}</h1></div>
    ${ok ? `<form class="card" id="f" novalidate><h2 class="d">Crie seu acesso</h2>
      <p class="lead" style="margin-top:6px;color:var(--ink-soft)">Falta só a senha para entrar e o PIN que protege o painel dos pais.</p>
      <div class="field"><label for="fn">Nome da família</label><input id="fn" name="family_name" placeholder="Família Silva" autocomplete="organization"></div>
      <div class="field"><label for="mn">Seu nome</label><input id="mn" name="my_name" placeholder="Bruno" autocomplete="given-name"></div>
      <div class="field"><label for="p">Senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="new-password" required><button type="button" class="eye" aria-label="Mostrar senha" aria-pressed="false">${SVG.eye}</button></div><p class="hint">Mínimo de 6 caracteres. Você entra com o e-mail da compra e esta senha.</p></div>
      <div class="field"><label for="pin">PIN dos pais</label><div class="pw"><input id="pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required><button type="button" class="eye" aria-label="Mostrar PIN" aria-pressed="false">${SVG.eye}</button></div><p class="hint">4 a 8 números. Protege o painel dos pais.</p></div>
      <div class="err" id="err" role="alert"></div><div class="actions"><button class="btn green">Começar a usar</button></div></form>`
    : `<div class="card"><div class="sent">${im('cross')}<h2 class="d">Não foi possível continuar</h2><p>Este link já foi usado ou venceu. Se você já pagou, toque em "Esqueci a senha" e use o e-mail da compra.</p></div><div class="actions"><a class="btn green" href="#/login">Ir para a entrada</a></div></div>`}
  </div></div>`;
  if (!ok) return;
  $$('.eye').forEach(b => b.onclick = () => { const i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? SVG.eyeOff : SVG.eye; b.setAttribute('aria-pressed', show); i.focus(); });
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try { await api('POST', '/auth/complete', { token, ...Object.fromEntries(new FormData(e.target)) }); sfx.win(); location.hash = '#/setup'; await route(); }
    catch (er) { $('#err').textContent = er.message; btn.disabled = false; sfx.bad(); }
  };
}

// ---------- Esqueci a senha ----------
function viewForgot(email = '') {
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im('key')}<h1 class="d stroke" style="font-size:44px">Nova senha</h1></div>
    <form class="card" id="f" novalidate><h2 class="d">Esqueceu a senha?</h2>
      <p class="lead" style="margin-top:6px;color:var(--ink-soft)">Digite o e-mail da família. Enviamos um link para criar uma senha nova.</p>
      <div class="field"><label for="e">E-mail</label><input id="e" name="email" type="email" autocomplete="username" value="${esc(email)}" required></div>
      <div class="err" id="err" role="alert"></div>
      <div class="actions"><button class="btn green">Enviar o link</button></div></form>
    <button class="switch" id="sw">Voltar para entrar</button></div></div>`;
  $('#sw').onclick = () => viewLogin();
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try {
      await api('POST', '/auth/forgot', { email: e.target.email.value });
      $('#f').innerHTML = `<div class="sent">${im('check')}<h2 class="d">Confira seu e-mail</h2><p>Se este e-mail tem uma conta, o link chega em instantes. Olhe também o spam. Ele vale por 1 hora.</p></div>`;
    } catch (er) { $('#err').textContent = er.message; btn.disabled = false; sfx.bad(); }
  };
}
async function viewReset(token) {
  const ok = (await api('GET', '/auth/reset/' + encodeURIComponent(token)).catch(() => ({}))).valid;
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im(ok ? 'key' : 'lock')}<h1 class="d stroke" style="font-size:44px">Nova senha</h1></div>
    ${ok ? `<form class="card" id="f" novalidate><h2 class="d">Crie a nova senha</h2>
      <div class="field"><label for="p">Nova senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="new-password" required><button type="button" class="eye" aria-label="Mostrar senha" aria-pressed="false">${SVG.eye}</button></div><p class="hint">Mínimo de 6 caracteres.</p></div>
      <div class="err" id="err" role="alert"></div><div class="actions"><button class="btn green">Salvar e entrar</button></div></form>`
    : `<div class="card"><div class="sent">${im('cross')}<h2 class="d">Link vencido</h2><p>Este link já foi usado ou passou de 1 hora. Peça um novo.</p></div><div class="actions"><button class="btn green" id="again">Pedir novo link</button></div></div>`}
    </div></div>`;
  const again = $('#again'); if (again) again.onclick = () => { location.hash = '#/login'; viewForgot(); };
  if (!ok) return;
  $('.eye').onclick = (e) => { const b = e.currentTarget, i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? SVG.eyeOff : SVG.eye; b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Esconder senha' : 'Mostrar senha'); i.focus(); };
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try { await api('POST', '/auth/reset', { token, password: e.target.password.value }); sfx.done(); location.hash = '#/'; await route(); toast('Senha alterada. Você já está dentro!'); }
    catch (er) { $('#err').textContent = er.message; btn.disabled = false; sfx.bad(); }
  };
}
