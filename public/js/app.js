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
const TASK_ICONS = ['star', 'bed', 'tooth', 'toothbrush', 'shower', 'shirt', 'bowl', 'plate', 'sandwich', 'apple', 'spaghetti', 'broom', 'basket', 'bucket', 'trash', 'socks', 'house', 'books', 'openbook', 'pray', 'pencil', 'backpack', 'plant', 'paw', 'teddy', 'karate', 'swim', 'goggles', 'basketball', 'music', 'church', 'soap', 'sun', 'moon'];
const REWARD_ICONS = ['game', 'tv', 'phone', 'movie', 'ferris', 'coaster', 'icecream', 'pizza', 'soccer', 'gift', 'trophy', 'crown'];
const COLORS = ['#ff4fae', '#ff8a1f', '#3bd15f', '#8b5bff', '#19c3c9', '#ff4d5e', '#f5b800'];
const KNOWN = new Set([...AVATARS, ...TASK_ICONS, ...REWARD_ICONS, 'coin', 'clock', 'stopwatch', 'lock', 'check', 'glow', 'party', 'fire', 'hourglass', 'gem', 'moneybag', 'chart', 'gear', 'people', 'clipboard', 'calendar', 'sparkles', 'key', 'cross', 'chest', 'rocket', 'shield', 'card', 'laptop']);
const LEGACY = { '🦊': 'fox', '🐱': 'cat', '🐶': 'dog', '🦄': 'unicorn', '🐉': 'dragon', '🤖': 'robot', '👾': 'alien', '🐼': 'panda', '🦁': 'lion', '🐸': 'frog', '🧚': 'butterfly', '⭐': 'star', '🛏️': 'bed', '🦷': 'tooth', '🍽️': 'plate', '🧹': 'broom', '📚': 'books', '🐕': 'paw', '🧺': 'basket', '🗑️': 'trash', '🥋': 'karate', '🏊': 'swim', '⛪': 'church', '🎒': 'backpack', '🚿': 'shower', '🪥': 'toothbrush', '🌱': 'plant', '🎮': 'game', '📺': 'tv', '📱': 'phone', '🎡': 'ferris', '🍦': 'icecream', '🎬': 'movie', '🏆': 'trophy', '🍕': 'pizza', '⚽': 'soccer', '🧸': 'teddy' };
const slug = (v, fb = 'star') => KNOWN.has(v) ? v : (LEGACY[v] || fb);
const im = (v, cls = '', fb) => `<img src="/img/3d/${slug(v, fb)}.png" alt="" class="${cls}" decoding="async">`;
const SVG = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
};

// ---------- API ----------
async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/auth/')) { location.hash = '#/login'; throw new Error(d.error || 'Sessão expirada'); }
  if (r.status === 402) { if (location.hash !== '#/assinar') location.hash = '#/assinar'; throw Object.assign(new Error(d.error), { silent: true }); }
  if (!r.ok) throw new Error(d.error || 'Algo deu errado. Tente de novo.');
  return d;
}
function toast(msg, bad) {
  const d = document.createElement('div'); d.textContent = msg; if (bad) d.className = 'bad';
  $('#toast').append(d); setTimeout(() => d.remove(), 2800);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (!e.silent) { toast(e.message, true); sfx.bad(); } } };

// ---------- Som ----------
let actx; let muted = store.get('gt-mute') === '1';
function tone(notes, type = 'triangle', vol = .09) {
  if (muted) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
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
};
function soundBtn() {
  return `<button class="btn ghost round" id="snd" aria-label="${muted ? 'Ligar som' : 'Desligar som'}">${muted ? SVG.off : SVG.on}</button>`;
}
function wireSound() {
  const b = $('#snd'); if (!b) return;
  b.onclick = () => { muted = !muted; store.set('gt-mute', muted ? '1' : '0'); b.innerHTML = muted ? SVG.off : SVG.on; b.setAttribute('aria-label', muted ? 'Ligar som' : 'Desligar som'); sfx.tap(); };
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
function burst(icon, title, text, btn = 'Continuar') {
  sfx.win();
  const d = document.createElement('div'); d.className = 'burst'; d.setAttribute('role', 'dialog');
  d.innerHTML = `<div class="rays"></div>${im(icon)}<h1 class="d stroke">${esc(title)}</h1><p>${esc(text)}</p><button class="btn green">${esc(btn)}</button>`;
  document.body.append(d);
  const r = d.querySelector('img').getBoundingClientRect(); setTimeout(() => sparks(r.left + r.width / 2, r.top + r.height / 2), 350);
  d.querySelector('button').onclick = () => d.remove(); d.querySelector('button').focus();
}

// ---------- Roteador ----------
let timer, ME = {};
async function route() {
  clearInterval(timer);
  $$('.sheet-bg,.burst').forEach(e => e.remove());
  const paid = await paymentReturn();
  const me = ME = await api('GET', '/auth/me');
  const [, a, b] = location.hash.split('/');
  if (!me.family) return viewLogin(a === 'criar' ? 'register' : 'login');
  if (a === 'assinar' || !me.access.active) return viewPaywall(me);
  if (a === 'dono') return !me.parent ? viewPin() : me.owner ? viewOwner() : (location.hash = '#/');
  if (a === 'kid' && b) return viewKid(+b);
  if (a === 'admin' || a === 'setup') return !me.parent ? viewPin() : me.onboarded ? viewAdmin() : viewSetup();
  await viewPlayers(me);
  paid?.();
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
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ---------- Login / cadastro ----------
function viewLogin(mode = 'login') {
  const reg = mode === 'register';
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="auth">
    <div class="logo">${im('game')}<h1 class="d stroke">GameTask</h1></div>
    <form class="card" id="f" novalidate>
      <h2 class="d">${reg ? 'Criar a família' : 'Entrar na família'}</h2>
      ${reg ? '<div class="field"><label for="n">Nome da família</label><input id="n" name="name" placeholder="Família Silva" autocomplete="organization" required></div>' : ''}
      <div class="field"><label for="e">E-mail</label><input id="e" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="p">Senha</label><input id="p" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required>${reg ? '<p class="hint">Mínimo de 6 caracteres.</p>' : ''}</div>
      ${reg ? '<div class="field"><label for="pin">PIN dos pais</label><input id="pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required><p class="hint">4 a 8 números. Ele protege o painel dos pais neste e em outros aparelhos.</p></div>' : ''}
      <div class="err" id="err" role="alert"></div>
      <div class="actions"><button class="btn green">${reg ? 'Criar e entrar' : 'Entrar'}</button></div>
      ${reg ? '' : '<p class="hint" style="margin-top:14px;text-align:center">Entre uma vez em cada aparelho. Ele fica conectado e já abre nos seus filhos.</p>'}
    </form>
    <button class="switch" id="sw">${reg ? 'Já tenho uma conta' : 'Primeira vez? Criar família'}</button>
    ${reg ? '<p class="trial-note">Comece pelo período grátis. Não pedimos cartão de crédito.</p>' : ''}
    <a class="switch home-link" href="/">Conhecer o GameTask</a>
  </div></div>`;
  $('#sw').onclick = () => viewLogin(reg ? 'login' : 'register');
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn'); btn.disabled = true;
    try { await api('POST', reg ? '/auth/register' : '/auth/login', Object.fromEntries(new FormData(e.target))); location.hash = reg ? '#/setup' : '#/'; await route(); }
    catch (er) { $('#err').textContent = er.message; e.target.classList.remove('shake'); void e.target.offsetWidth; e.target.classList.add('shake'); sfx.bad(); }
    finally { btn.disabled = false; }
  };
}

// ---------- Seleção de herói ----------
async function viewPlayers(me = ME) {
  const kids = await api('GET', '/kids');
  if (!kids.length && !me.onboarded) { location.hash = '#/setup'; return; }
  app.innerHTML = `<div class="lobby"><div class="rays"></div>
    <div style="position:absolute;right:16px;top:14px;z-index:5">${soundBtn()}</div>
    <div class="wrap">
      <div class="select-title"><h1 class="d stroke">GameTask</h1><p>${kids.length ? 'Quem vai jogar agora?' : 'Nenhum jogador ainda'}</p></div>
      ${kids.length ? `<div class="roster">${kids.map(k => `<button class="hero" data-id="${k.id}" style="--c:${esc(k.color)}" aria-label="Jogar como ${esc(k.name)}">
        ${im(k.avatar, 'art', 'fox')}<div class="plate"><div class="d stroke-sm">${esc(k.name)}</div><small>${im('coin')}<b class="num">${num(k.coins)}</b><i class="dot"></i>${im('check')}<b class="num">${k.done}/${k.total}</b></small><div class="mini"><i style="width:${k.total ? k.done / k.total * 100 : 0}%"></i></div></div></button>`).join('')}</div>`
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
  let first = true;
  const doneLike = (s) => s === 'approved' || s === 'pending';
  const load = async () => {
    const d = await api('GET', `/kids/${id}/home`);
    if ($('.sheet-bg,.burst')) return d;
    render(d); first = false; return d;
  };

  const render = (d) => {
    const coins = d.balance + d.pending_coins;
    const todo = d.tasks.filter(t => !doneLike(t.status));
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
      const left = Math.max(0, t.earned + t.pending - t.used);
      return `<div class="meter">${im(t.icon, '', 'game')}<div class="lbl"><b>${esc(t.title)}</b><span class="num">${num(left)} de ${num(t.cap)} ${esc(t.unit)}</span></div>
        <div class="bar"><i style="width:${t.cap ? Math.min(100, left / t.cap * 100) : 0}%"></i></div></div>`;
    };
    const mission = (t, i) => {
      const chips = [
        t.time ? `<span class="chip hour">${esc(t.time)}</span>` : '',
        t.coins > 0 ? `<span class="chip">${im('coin')}+${num(t.coins)}</span>` : '',
        ...t.rewards.map(r => r.kind === 'time' ? `<span class="chip time">${im(r.icon, '', 'game')}+${num(r.value)} ${esc(r.unit)}</span>` : `<span class="chip goal">${im(r.icon, '', 'trophy')}+1</span>`),
      ].join('');
      const act = t.status === 'todo' ? `<button class="btn green go" data-do="${t.id}">Concluí!</button>`
        : doneLike(t.status) ? `<span class="status ok">${im('check')}Feito!</span>${t.status === 'pending' ? `<button class="link" data-undo="${t.id}">Desfazer</button>` : ''}`
        : `<span class="status no">${im('cross')}Refazer</span>`;
      return `<article class="mission ${doneLike(t.status) ? 'done' : t.status === 'rejected' ? 'rejected' : ''}" data-m="${t.id}" style="animation-delay:${i * 45}ms">
        <div class="tile" data-tile="${t.id}">${im(t.icon)}</div>
        <div class="info"><div class="ttl">${esc(t.title)}</div>${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}<div class="chips">${chips}</div></div>
        <div class="act">${act}</div></article>`;
    };
    const head = todo.length ? (todo.length === 1 ? 'Falta 1!' : `Faltam ${todo.length}!`) : d.total ? 'Tudo feito!' : 'Dia livre!';
    const sub = todo.length && canWin > 0 ? `${im('coin')}<span>Ainda dá para ganhar <b>+${num(canWin)}</b> moedas hoje</span>`
      : todo.length ? `${im('sparkles')}<span>Bora completar as missões!</span>`
      : d.total ? `${im('party')}<span>Mandou muito bem hoje!</span>` : `${im('party')}<span>Nenhuma missão hoje. Aproveite!</span>`;
    app.innerHTML = `<div class="lobby">
      <div class="topbar"><div class="topbar-in"><button class="btn ghost round" id="back" aria-label="Trocar jogador">${SVG.back}</button>
        <span class="who d stroke-sm">${esc(d.kid.name)}</span>
        <div class="pills"><div class="pill" id="coinPill" title="Moedas">${im('coin')}<b id="coinNum">${num(coins)}</b></div></div>
        ${soundBtn()}</div></div>
      <div class="wrap ${first ? 'intro' : ''}"><div class="hud">
        <section class="stage" style="--c:${esc(d.kid.color)}"><div class="avatar">${im(d.kid.avatar, '', 'fox')}</div>
          <div><h1 class="d stroke">${head}</h1><p class="cheer">${sub}</p></div>
          <div class="xp"><div class="xp-head"><span>Missões de hoje</span><span class="num">${done} de ${d.total}</span></div><div class="segs">${segs}</div></div>
        </section>
        ${d.time.length || d.goals.length ? `<section class="panel">${d.time.map(timeMeter).join('')}${d.time.length && d.goals.length ? '<div class="gap"></div>' : ''}${d.goals.map(goalRoad).join('')}</section>` : ''}</div>
        <div class="section-h"><h2 class="d stroke-sm">Missões</h2></div>
        ${d.tasks.length ? `<div class="missions">${d.tasks.map(mission).join('')}</div>` : `<div class="empty">${im('party')}<p class="d stroke-sm">Nenhuma missão hoje. Aproveite!</p></div>`}
      </div></div>`;
    wireSound();
    $('#back').onclick = () => { sfx.tap(); location.hash = '#/'; };
    $$('[data-do]').forEach(b => b.onclick = guard(async () => {
      b.disabled = true;
      const r = b.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2); sfx.done();
      const t = d.tasks.find(x => x.id === +b.dataset.do), last = todo.length === 1;
      await api('POST', `/kids/${id}/complete`, { task_id: t.id });
      const nd = await load();
      $(`[data-m="${t.id}"]`)?.classList.add('pop');
      const tile = $(`[data-tile="${t.id}"]`)?.getBoundingClientRect();
      const newCoins = nd.balance + nd.pending_coins;
      $('#coinNum').textContent = num(coins);
      if (tile) flyTo({ x: tile.left + tile.width / 2, y: tile.top + tile.height / 2 }, $('#coinPill'), t.coins > 0 ? 'coin' : 'glow', t.coins > 0 ? Math.min(8, 3 + Math.round(t.coins)) : 3);
      setTimeout(() => countUp($('#coinNum'), coins, newCoins), reduced ? 0 : 950);
      if (last && !store.get(`gt-all-${id}-${d.day}`)) { store.set(`gt-all-${id}-${d.day}`, '1'); setTimeout(() => burst('trophy', 'Dia completo!', `${d.kid.name}, você fez todas as missões de hoje!`, 'Oba!'), 1500); }
    }));
    $$('[data-undo]').forEach(b => b.onclick = guard(async () => { sfx.tap(); await api('DELETE', `/kids/${id}/complete/${b.dataset.undo}`); await load(); }));
  };
  await load();
  timer = setInterval(() => load().catch(() => {}), 20000);
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
const picker = (name, list, cur) => `<div class="picker" data-pick>${list.map(e => `<button type="button" class="${e === cur ? 'on' : ''}" data-v="${e}" aria-label="${e}">${im(e)}</button>`).join('')}</div><input type="hidden" name="${name}" value="${esc(cur)}">`;
const swatches = (name, cur) => `<div class="swatches" data-pick>${COLORS.map(c => `<button type="button" class="${c === cur ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div><input type="hidden" name="${name}" value="${esc(cur)}">`;
const seg = (name, opts, cur) => `<div class="seg-ctl">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick] button'); if (!b) return;
  const w = b.parentElement; $$('button', w).forEach(x => x.classList.remove('on')); b.classList.add('on');
  w.nextElementSibling.value = b.dataset.v; sfx.tap();
});

// ---------- PIN dos pais ----------
function viewPin() {
  let pin = '';
  app.innerHTML = `<div class="lobby"><div class="auth">
    <div class="logo">${im('lock')}<h1 class="d stroke" style="font-size:44px">Painel dos pais</h1></div>
    <div class="card" id="card"><h2 class="d" style="text-align:center">Digite o PIN</h2>
      <div class="pin-dots" id="dots" aria-hidden="true">${'<i></i>'.repeat(4)}</div>
      <div class="err" id="err" role="alert" style="text-align:center"></div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="btn ghost" data-k="${n}">${n}</button>`).join('')}
        <button class="btn ghost" data-k="del" aria-label="Apagar">${SVG.del}</button><button class="btn ghost" data-k="0">0</button><button class="btn green" data-k="ok">OK</button></div>
    </div>
    <div class="actions"><button class="btn ghost sm" id="back">Voltar ao jogo</button></div></div></div>`;
  const dots = () => { const n = Math.max(4, pin.length); $('#dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
  const submit = async () => {
    if (pin.length < 4) return;
    try { await api('POST', '/auth/parent', { pin }); sfx.done(); document.removeEventListener('keydown', kb); await route(); }
    catch (er) { pin = ''; dots(); $('#err').textContent = er.message; const c = $('#card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); sfx.bad(); }
  };
  const press = (k) => { if (k === 'del') pin = pin.slice(0, -1); else if (k === 'ok') return submit(); else if (pin.length < 8) pin += k; $('#err').textContent = ''; sfx.tap(); dots(); };
  const kb = (e) => { if (!$('#dots')) return document.removeEventListener('keydown', kb); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); };
  document.addEventListener('keydown', kb);
  $$('[data-k]').forEach(b => b.onclick = () => press(b.dataset.k));
  $('#back').onclick = () => { document.removeEventListener('keydown', kb); location.hash = '#/'; };
}

// ---------- Painel dos pais ----------
let tab = 'pending';
const TABS = [['pending', 'check', 'Aprovar'], ['kids', 'people', 'Filhos'], ['tasks', 'clipboard', 'Tarefas'], ['rewards', 'gift', 'Recompensas'], ['wallet', 'moneybag', 'Carteira'], ['history', 'chart', 'Histórico'], ['settings', 'gear', 'Ajustes']];
async function viewAdmin() {
  const pendingN = (await api('GET', '/admin/pending')).length;
  const ac = ME.access || {};
  const plan = ac.status === 'trial' ? `<a class="plan-chip ${ac.days_left <= 10 ? 'warn' : ''}" href="#/assinar">${im('hourglass')}Grátis: ${ac.days_left} ${ac.days_left === 1 ? 'dia' : 'dias'}</a>`
    : ac.status === 'paid' && ac.days_left <= 10 ? `<a class="plan-chip warn" href="#/assinar">${im('hourglass')}Renovar em ${ac.days_left} d</a>` : '';
  app.innerHTML = `<div class="admin"><header class="admin-top"><div class="row1"><h1 class="d stroke-sm">Painel dos pais</h1>
      ${plan}${ME.owner ? `<a class="btn sm" href="#/dono">${im('chart')}Dono</a>` : ''}
      <button class="btn ghost sm" id="exit">Voltar ao jogo</button></div>
    <nav class="tabs" aria-label="Seções">${TABS.map(([k, ic, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" ${k === tab ? 'aria-current="page"' : ''}>${im(ic)}${l}${k === 'pending' && pendingN ? `<span class="cnt">${pendingN}</span>` : ''}</button>`).join('')}</nav></header>
    <main class="admin-body" id="pane"></main></div>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; sfx.tap(); viewAdmin().catch(e => toast(e.message, true)); });
  $('.tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#exit').onclick = guard(async () => { await api('POST', '/auth/parent/exit'); location.hash = '#/'; await route(); });
  const fns = { pending: adminPending, kids: adminKids, tasks: adminTasks, rewards: adminRewards, wallet: adminWallet, history: adminHistory, settings: adminSettings };
  await fns[tab]($('#pane'), viewAdmin);
}
const zero = (icon, text) => `<div class="zero">${im(icon)}<span>${text}</span></div>`;

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
  const kids = await api('GET', '/admin/kids');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Filhos</h2><button class="btn green sm" id="new">Adicionar filho</button></div>
    ${kids.length ? `<div class="list">${kids.map(k => `<div class="item ${k.active ? '' : 'off'}"><div class="ic" style="background:${esc(k.color)}33">${im(k.avatar, '', 'fox')}</div>
      <div class="grow"><div class="t">${esc(k.name)}</div><div class="s">${k.active ? 'Aparece na tela de jogadores' : 'Inativo'}</div></div>
      <div class="btns"><button class="btn ghost sm" data-e="${k.id}">Editar</button></div></div>`).join('')}</div>` : zero('people', 'Adicione o primeiro jogador.')}</section>`;
  const form = (k = { name: '', avatar: AVATARS[0], color: COLORS[0], active: 1 }) => `
    <div class="field"><label for="kn">Nome</label><input id="kn" name="name" value="${esc(k.name)}" required></div>
    <div class="field"><span class="lab">Personagem</span>${picker('avatar', AVATARS, slug(k.avatar, 'fox'))}</div>
    <div class="field"><span class="lab">Cor do card</span>${swatches('color', k.color)}</div>
    <label class="check"><input type="checkbox" name="active" ${k.active ? 'checked' : ''}>Ativo na tela de jogadores</label>`;
  const read = (f) => ({ name: f.name.value, avatar: f.avatar.value, color: f.color.value, active: f.active.checked });
  $('#new').onclick = () => sheet('Novo filho', form(), async (f) => { await api('POST', '/admin/kids', read(f)); toast('Jogador adicionado'); refresh(); }, { saveLabel: 'Adicionar' });
  $$('[data-e]').forEach(b => b.onclick = () => { const k = kids.find(x => x.id == b.dataset.e); sheet('Editar ' + k.name, form(k), async (f) => { await api('PUT', '/admin/kids/' + k.id, read(f)); refresh(); }); });
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], DAYN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
async function adminTasks(pane, refresh) {
  const [tasks, kids, rewards] = await Promise.all([api('GET', '/admin/tasks'), api('GET', '/admin/kids'), api('GET', '/admin/rewards')]);
  const kidsOn = kids.filter(k => k.active);
  const when = (t) => t.type === 'daily' ? (t.weekdays.length === 7 ? 'Todo dia' : [...t.weekdays].map(d => DAYN[d]).join(', '))
    : `${dmy(t.date)}${t.repeat_weekly ? `, toda ${DAYN[new Date(t.date + 'T12:00:00').getDay()]}` : ''}`;
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Tarefas</h2><div class="btns"><button class="btn ghost sm" id="cat">${im('sparkles')}Do catálogo</button><button class="btn green sm" id="new">Nova tarefa</button></div></div>
    ${tasks.length ? `<div class="list">${tasks.map(t => `<div class="item ${t.active ? '' : 'off'}"><div class="ic">${im(t.icon)}</div><div class="grow"><div class="t">${esc(t.title)}</div>
      <div class="s">${esc(when(t))}${t.time ? ' às ' + esc(t.time) : ''}${t.coins > 0 ? ` · ${num(t.coins)} moedas` : ''}${t.reward_ids.length ? ' · ' + t.reward_ids.map(r => esc(rewards.find(x => x.id === r)?.title || '?')).join(', ') : ''}</div></div>
      <div class="btns"><button class="btn ghost sm" data-e="${t.id}">Editar</button></div></div>`).join('')}</div>` : zero('clipboard', 'Crie a primeira tarefa da casa.')}</section>`;
  const form = (t = { title: '', icon: 'star', description: '', type: 'daily', weekdays: '0123456', date: '', time: '', repeat_weekly: 0, coins: 0, all_kids: 1, kid_ids: [], reward_ids: [], active: 1 }) => `
    <div class="field"><label for="tt">Nome da tarefa</label><input id="tt" name="title" value="${esc(t.title)}" placeholder="Arrumar a cama" required></div>
    <div class="field"><span class="lab">Ícone</span>${picker('icon', TASK_ICONS, slug(t.icon))}</div>
    <div class="field"><label for="td">Detalhe (opcional)</label><input id="td" name="description" value="${esc(t.description)}" placeholder="Antes do café"></div>
    <div class="field"><span class="lab">Quando</span>${seg('type', [['daily', 'Repete'], ['one_off', 'Dia marcado']], t.type)}</div>
    <div class="field" data-show="daily"><span class="lab">Dias da semana</span><div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" name="wd" value="${i}" ${t.weekdays.includes(i) ? 'checked' : ''}><span title="${DAYN[i]}">${d}</span></label>`).join('')}</div></div>
    <div data-show="one_off"><div class="field"><label for="tdt">Data</label><input id="tdt" type="date" name="date" value="${esc(t.date || '')}"></div>
      <label class="check"><input type="checkbox" name="repeat_weekly" ${t.repeat_weekly ? 'checked' : ''}>Repetir toda semana neste dia</label></div>
    <div class="field"><label for="th">Horário (opcional)</label><input id="th" type="time" name="time" value="${esc(t.time || '')}"></div>
    <div class="field"><label for="tc">Moedas por conclusão</label><input id="tc" type="number" step="0.5" min="0" name="coins" value="${t.coins}" inputmode="decimal"><p class="hint">0 = não vale moeda.</p></div>
    <div class="field"><span class="lab">Quem faz</span><label class="check"><input type="checkbox" name="all_kids" ${t.all_kids ? 'checked' : ''}>Todos os filhos, inclusive os novos</label>
      <div data-kids>${kidsOn.map(k => `<label class="check"><input type="checkbox" name="kid" value="${k.id}" ${t.kid_ids.includes(k.id) ? 'checked' : ''}>${im(k.avatar, '', 'fox')}${esc(k.name)}</label>`).join('')}</div></div>
    <div class="field"><span class="lab">Recompensas que esta tarefa alimenta</span>
      ${rewards.filter(r => r.active).map(r => { const linked = t.reward_ids.includes(r.id); return `<label class="check"><input type="checkbox" name="rw" value="${r.id}" data-t="${r.total_value}" data-n="${r.task_count}" data-linked="${linked ? 1 : 0}" data-k="${r.kind}" data-u="${esc(r.unit)}" ${linked ? 'checked' : ''}>${im(r.icon, '', 'game')}${esc(r.title)}<span class="muted" data-pv></span></label>`; }).join('') || '<p class="hint">Crie recompensas na aba Recompensas.</p>'}</div>
    <label class="check"><input type="checkbox" name="active" ${t.active ? 'checked' : ''}>Tarefa ativa</label>`;
  const read = (f) => ({
    title: f.title.value, icon: f.icon.value, description: f.description.value, type: f.type.value,
    weekdays: $$('[name=wd]:checked', f).map(x => x.value).join('') || '0123456', date: f.date.value, time: f.time.value,
    repeat_weekly: f.repeat_weekly.checked, coins: f.coins.value, all_kids: f.all_kids.checked,
    kid_ids: $$('[name=kid]:checked', f).map(x => +x.value), reward_ids: $$('[name=rw]:checked', f).map(x => +x.value), active: f.active.checked,
  });
  const wire = (bg) => {
    const f = bg.querySelector('form');
    const upd = () => {
      $$('[data-show]', f).forEach(d => d.hidden = d.dataset.show !== f.type.value);
      $('[data-kids]', f).hidden = f.all_kids.checked;
      $$('[name=rw]', f).forEach(c => {
        const n = +c.dataset.n + (c.checked && c.dataset.linked === '0' ? 1 : 0) - (!c.checked && c.dataset.linked === '1' ? 1 : 0);
        c.parentElement.querySelector('[data-pv]').textContent = !c.checked ? '' : c.dataset.k === 'time' ? `${num(c.dataset.t / n)} ${c.dataset.u} cada (${n} tarefas)` : '+1 na meta';
      });
    };
    f.addEventListener('change', upd); upd();
  };
  $('#new').onclick = () => wire(sheet('Nova tarefa', form(), async (f) => { await api('POST', '/admin/tasks', read(f)); toast('Tarefa criada'); refresh(); }, { saveLabel: 'Criar tarefa' }));
  $('#cat').onclick = guard(async () => {
    const c = await api('GET', '/admin/catalog'), free = c.tasks.filter(t => !t.have);
    if (!free.length) return toast('Todas as tarefas do catálogo já estão na sua lista.');
    sheet('Tarefas prontas', `<p class="lead" style="margin-top:6px">Marque as que quer adicionar. Elas valem para todos os filhos e entram nas recompensas ativas (o tempo de tela se redivide).</p>
      ${catalogGrid(c.groups, free, new Set())}`,
      async (f) => { const keys = $$('[name=ck]:checked', f).map(x => x.value); const r = await api('POST', '/admin/catalog', { keys }); toast(`${r.created} tarefa(s) adicionada(s)`); refresh(); }, { saveLabel: 'Adicionar' });
  });
  $$('[data-e]').forEach(b => b.onclick = () => { const t = tasks.find(x => x.id == b.dataset.e); wire(sheet('Editar tarefa', form(t), async (f) => { await api('PUT', '/admin/tasks/' + t.id, read(f)); refresh(); })); });
}

async function adminRewards(pane, refresh) {
  const rewards = await api('GET', '/admin/rewards');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Recompensas e metas</h2><button class="btn green sm" id="new">Nova recompensa</button></div>
    <p class="lead">Tempo de tela: o total do dia é dividido igualmente entre as tarefas ligadas a ele (20 min com 10 tarefas = 2 min cada). Metas contam missões ou moedas até serem alcançadas.</p>
    ${rewards.length ? `<div class="list">${rewards.map(r => `<div class="item ${r.active ? '' : 'off'}"><div class="ic">${im(r.icon, '', 'game')}</div><div class="grow"><div class="t">${esc(r.title)}</div>
      <div class="s">${r.kind === 'time' ? `${num(r.total_value)} ${esc(r.unit)} por dia · ${r.task_count} tarefa(s)${r.task_count ? ` · ${num(r.total_value / r.task_count)} ${esc(r.unit)} cada` : ''}` : `Meta: ${num(r.total_value)} ${r.goal_mode === 'coins' ? 'moedas' : 'missões'}`}</div></div>
      <div class="btns"><button class="btn ghost sm" data-e="${r.id}">Editar</button></div></div>`).join('')}</div>` : zero('gift', 'Crie tempo de videogame, YouTube ou uma meta como ir ao parque.')}</section>`;
  const form = (r = { title: '', icon: 'game', kind: 'time', unit: 'min', total_value: 20, goal_mode: 'tasks', active: 1 }) => `
    <div class="field"><label for="rn">Nome</label><input id="rn" name="title" value="${esc(r.title)}" placeholder="Videogame, YouTube, Parque de diversão" required></div>
    <div class="field"><span class="lab">Ícone</span>${picker('icon', REWARD_ICONS, slug(r.icon, 'game'))}</div>
    <div class="field"><span class="lab">Tipo</span>${seg('kind', [['time', 'Tempo por dia'], ['goal', 'Meta']], r.kind)}</div>
    <div class="field" data-show="goal"><span class="lab">A meta conta</span>${seg('goal_mode', [['tasks', 'Missões feitas'], ['coins', 'Moedas']], r.goal_mode || 'tasks')}</div>
    <div class="field"><label for="rv" data-lbl>Minutos por dia</label><input id="rv" type="number" step="any" min="1" name="total_value" value="${r.total_value}" inputmode="decimal" required></div>
    <label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}>Ativa</label>`;
  const read = (f) => ({ title: f.title.value, icon: f.icon.value, kind: f.kind.value, goal_mode: f.goal_mode.value, total_value: f.total_value.value, active: f.active.checked });
  const wire = (bg) => { const f = bg.querySelector('form'); const u = () => { $('[data-show]', f).hidden = f.kind.value !== 'goal'; $('[data-lbl]', f).textContent = f.kind.value === 'goal' ? (f.goal_mode.value === 'coins' ? 'Quantas moedas custa' : 'Quantas missões para alcançar') : 'Minutos por dia'; }; f.addEventListener('change', u); u(); };
  $('#new').onclick = () => wire(sheet('Nova recompensa', form(), async (f) => { await api('POST', '/admin/rewards', read(f)); toast('Recompensa criada'); refresh(); }, { saveLabel: 'Criar' }));
  $$('[data-e]').forEach(b => b.onclick = () => { const r = rewards.find(x => x.id == b.dataset.e); wire(sheet('Editar recompensa', form(r), async (f) => { await api('PUT', '/admin/rewards/' + r.id, read(f)); refresh(); })); });
}

async function adminWallet(pane, refresh) {
  const w = await api('GET', '/admin/wallet');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Carteira</h2><span class="s" style="font-weight:800;color:var(--ink-soft)">1 moeda = ${brl(w.settings.coin_value)}</span></div>
    ${w.kids.map(k => `<div class="wallet-kid">${im(k.avatar, '', 'fox')}<div class="t" style="font-weight:900;font-size:18px">${esc(k.name)}</div>
      <div class="money"><span class="d num">${num(k.balance)} moedas</span><span class="s" style="font-weight:800;color:var(--ink-soft)">${brl(k.value)} · tempo hoje ${num(k.time_today)} min</span></div>
      ${k.goals.length ? `<div class="goals">${k.goals.map(g => `<div class="g">${im(g.icon, '', 'trophy')}${esc(g.title)}: ${num(g.progress)}/${num(g.target)} ${g.mode === 'coins' ? 'moedas' : 'missões'} ${g.ready ? `<button class="btn green sm" data-redeem="${k.id}:${g.id}">Entregar meta</button>` : ''}</div>`).join('')}</div>` : ''}
      <div class="btns"><button class="btn sm" data-pay="${k.id}" ${k.balance > 0 ? '' : 'disabled'}>${im('moneybag')}Pagar moedas</button>
        <button class="btn ghost sm" data-adj="${k.id}">Bônus ou desconto</button>${w.timeRewards.length ? `<button class="btn ghost sm" data-use="${k.id}">${im('stopwatch')}Tempo usado</button>` : ''}</div></div>`).join('') || zero('people', 'Cadastre os filhos primeiro.')}</section>
    <section class="box"><div class="box-h"><h2 class="d">Pagamentos</h2></div>${w.payouts.length ? `<table><thead><tr><th>Data</th><th>Filho</th><th>Moedas</th><th>Valor</th></tr></thead><tbody>${w.payouts.map(p => `<tr><td>${dmy(p.created_at)}</td><td>${esc(p.kid)}</td><td>${num(p.coins)}</td><td>${brl(p.amount)}</td></tr>`).join('')}</tbody></table>` : zero('moneybag', 'Nenhum pagamento ainda.')}</section>`;
  const kid = (id) => w.kids.find(k => k.id == id);
  $$('[data-pay]').forEach(b => b.onclick = () => { const k = kid(b.dataset.pay); sheet(`Pagar ${k.name}`, `<p class="lead" style="margin-top:6px">Saldo: <b>${num(k.balance)} moedas</b> (${brl(k.value)}). As moedas pagas saem do saldo.</p><div class="field"><label for="pc">Quantas moedas pagar</label><input id="pc" name="coins" type="number" step="any" min="0.01" max="${k.balance}" value="${k.balance}" inputmode="decimal"></div>`,
    async (f) => { const r = await api('POST', '/admin/payout', { kid_id: k.id, coins: f.coins.value }); sfx.win(); toast(`Pagamento de ${brl(r.amount)} registrado`); refresh(); }, { saveLabel: 'Confirmar pagamento' }); });
  $$('[data-adj]').forEach(b => b.onclick = () => { const k = kid(b.dataset.adj); sheet(`Moedas de ${k.name}`, `<div class="field"><label for="aa">Quantidade</label><input id="aa" name="amount" type="number" step="any" required inputmode="decimal"><p class="hint">Positivo dá bônus, negativo desconta.</p></div><div class="field"><label for="an">Motivo</label><input id="an" name="note" placeholder="Ajudou a lavar o carro"></div>`,
    async (f) => { await api('POST', '/admin/adjust', { kid_id: k.id, amount: f.amount.value, note: f.note.value }); toast('Saldo ajustado'); refresh(); }); });
  $$('[data-use]').forEach(b => b.onclick = () => { const k = kid(b.dataset.use); sheet(`Tempo usado por ${k.name}`, `<div class="field"><label for="ur">Recompensa</label><select id="ur" name="rw">${w.timeRewards.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}</select></div><div class="field"><label for="um">Minutos usados</label><input id="um" name="m" type="number" step="any" min="1" required inputmode="numeric"></div>`,
    async (f) => { await api('POST', '/admin/use-time', { kid_id: k.id, reward_id: f.rw.value, minutes: f.m.value }); toast('Tempo descontado'); refresh(); }, { saveLabel: 'Descontar' }); });
  $$('[data-redeem]').forEach(b => b.onclick = () => { const [k, g] = b.dataset.redeem.split(':'); sheet('Entregar meta', '<p class="lead" style="margin-top:6px">Confirme que a recompensa foi entregue. O progresso da meta volta a zero (metas em moedas descontam as moedas).</p>',
    async () => { await api('POST', '/admin/redeem', { kid_id: +k, reward_id: +g }); sfx.win(); toast('Meta entregue'); refresh(); }, { saveLabel: 'Confirmar entrega' }); });
}

async function adminHistory(pane) {
  const h = await api('GET', '/admin/history');
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Moedas ganhas neste mês</h2></div>${h.month.length ? `<div class="list">${h.month.map(m => `<div class="item"><div class="ic">${im('coin')}</div><div class="grow t">${esc(m.name)}</div><span class="d num" style="font-size:24px">${num(m.earned)}</span></div>`).join('')}</div>` : zero('chart', 'Sem moedas aprovadas neste mês.')}</section>
    <section class="box"><div class="box-h"><h2 class="d">Últimos 30 dias</h2></div>${h.rows.length ? `<table><thead><tr><th>Dia</th><th>Filho</th><th>Tarefa</th><th>Resultado</th></tr></thead><tbody>${h.rows.map(r => `<tr><td>${dmy(r.day).slice(0, 5)}</td><td>${esc(r.kid)}</td><td>${im(r.icon)}${esc(r.title)}</td><td><span class="tag ${r.status === 'approved' ? 'ok' : 'no'}">${r.status === 'approved' ? 'Aprovada' : 'Rejeitada'}</span></td></tr>`).join('')}</tbody></table>` : zero('calendar', 'Nenhuma tarefa decidida ainda.')}</section>`;
}

async function adminSettings(pane) {
  const w = await api('GET', '/admin/wallet');
  pane.innerHTML = `<form class="box" id="f" novalidate><div class="box-h"><h2 class="d">Ajustes</h2></div>
    <div class="field"><label for="cv">Valor de 1 moeda em reais</label><input id="cv" name="coin_value" type="number" step="0.01" min="0" value="${w.settings.coin_value}" inputmode="decimal"></div>
    <label class="check"><input type="checkbox" name="auto" ${w.settings.auto_approve ? 'checked' : ''}>Aprovar tarefas automaticamente, sem conferência</label>
    <div class="field"><label for="np">Novo PIN dos pais</label><input id="np" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"><p class="hint">Deixe vazio para manter o atual.</p></div>
    <div class="err" role="alert"></div><div class="actions"><button class="btn green">Salvar ajustes</button></div></form>
    <section class="box"><div class="box-h"><h2 class="d">Assinatura</h2><a class="btn sm" href="#/assinar">${ME.access?.status === 'paid' ? 'Renovar' : 'Ver planos'}</a></div><p class="lead">${planText(ME.access)}</p></section>
    <section class="box"><div class="box-h"><h2 class="d">Este aparelho</h2></div><p class="lead">Desconectar faz o aparelho pedir o e-mail e a senha da família de novo.</p><button class="btn red sm" id="out">Desconectar a família</button></section>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api('PUT', '/admin/settings', { coin_value: f.coin_value.value, auto_approve: f.auto.checked, new_pin: f.pin.value }); toast('Ajustes salvos'); f.pin.value = ''; f.querySelector('.err').textContent = ''; }
    catch (er) { f.querySelector('.err').textContent = er.message; sfx.bad(); }
  };
  $('#out').onclick = () => sheet('Desconectar a família?', '<p class="lead" style="margin-top:6px">As crianças não conseguirão usar este aparelho até alguém entrar de novo.</p>',
    async () => { await api('POST', '/auth/logout'); location.hash = '#/login'; await route(); }, { saveLabel: 'Desconectar', danger: true });
}

// ---------- Assinatura ----------
const PLAN_N = { monthly: 'mensal', annual: 'anual' };
function planText(a = {}) {
  if (a.status === 'owner') return 'Conta do dono do sistema: acesso liberado.';
  if (a.status === 'free') return 'Acesso de cortesia liberado.';
  if (a.status === 'trial') return `Período grátis até <b>${dmy(a.until)}</b> (${a.days_left} ${a.days_left === 1 ? 'dia' : 'dias'}). Depois disso, o app pede uma assinatura.`;
  if (a.status === 'paid') return `Plano ${PLAN_N[a.plan] || ''} ativo até <b>${dmy(a.until)}</b>.`;
  return 'O período de uso terminou.';
}
const money = (n) => (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function viewPaywall() {
  const s = await api('GET', '/billing/status'), a = s.access, p = s.prices;
  const perMonth = Math.floor(p.annual / 12 * 100) / 100, save = Math.max(0, Math.round((1 - p.annual / (p.monthly * 12)) * 100));
  const head = a.active ? 'Planos do GameTask' : a.plan ? 'Sua assinatura venceu' : 'O período grátis terminou';
  const sub = a.active ? planText(a) : 'As missões e as moedas das crianças estão guardadas. Assine para continuar de onde pararam.';
  app.innerHTML = `<div class="lobby"><div class="rays"></div><div class="wrap paywall">
    <div class="pw-head">${im(a.active ? 'rocket' : 'lock')}<h1 class="d stroke">${head}</h1><p>${sub}</p></div>
    <div class="plans">
      <article class="plan best"><span class="ribbon">Mais escolhido${save ? ` · economize ${save}%` : ''}</span>
        <h2 class="d">Anual</h2><div class="price"><small>R$</small><b class="d num">${money(perMonth)}</b><small>/mês</small></div>
        <p class="bill">Pagamento único de <b>${brl(p.annual)}</b> por ano</p>
        <ul><li>${im('check')}Filhos ilimitados</li><li>${im('check')}Todos os aparelhos da família</li><li>${im('check')}Pix, cartão ou boleto</li></ul>
        <button class="btn green" data-plan="annual">Assinar anual</button></article>
      <article class="plan"><h2 class="d">Mensal</h2><div class="price"><small>R$</small><b class="d num">${money(p.monthly)}</b><small>/mês</small></div>
        <p class="bill">Pago a cada mês, sem fidelidade</p>
        <ul><li>${im('check')}Tudo do plano anual</li><li>${im('check')}Renove quando quiser</li></ul>
        <button class="btn ghost" data-plan="monthly">Assinar mensal</button></article>
    </div>
    <p class="pw-note">${im('shield')}Pagamento seguro pelo Mercado Pago. O acesso é liberado assim que o pagamento é confirmado.</p>
    <div class="pw-actions">${a.active ? '<button class="btn ghost sm" id="back">Voltar</button>' : ''}<button class="switch" id="out">Desconectar este aparelho</button></div>
  </div></div>`;
  $$('[data-plan]').forEach(b => b.onclick = guard(async () => {
    if (!s.enabled) throw new Error('O pagamento on-line ainda está sendo ativado. Tente mais tarde.');
    const label = b.textContent; b.disabled = true; b.textContent = 'Abrindo o Mercado Pago…';
    try { const r = await api('POST', '/billing/checkout', { plan: b.dataset.plan }); location.href = r.url; }
    catch (e) { b.disabled = false; b.textContent = label; throw e; }
  }));
  const back = $('#back'); if (back) back.onclick = () => { location.hash = ME.parent ? '#/admin' : '#/'; };
  $('#out').onclick = () => sheet('Desconectar este aparelho?', '<p class="lead" style="margin-top:6px">Será preciso entrar com o e-mail e a senha da família de novo.</p>',
    async () => { await api('POST', '/auth/logout'); location.href = '/'; }, { saveLabel: 'Desconectar', danger: true });
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
      location.hash = '#/'; await route();
      burst('party', 'Tudo pronto!', 'As missões já estão no jogo. Agora é com as crianças!', 'Ver jogadores');
    };
  };
  render();
}

// ---------- Painel do dono do sistema ----------
let otab = 'overview';
const OTABS = [['overview', 'chart', 'Visão geral'], ['families', 'people', 'Famílias'], ['payments', 'moneybag', 'Pagamentos'], ['prices', 'gear', 'Preços']];
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
  await ({ overview: ownerOverview, families: ownerFamilies, payments: ownerPayments, prices: ownerPrices })[otab]($('#pane'));
}
async function ownerOverview(pane) {
  const s = await api('GET', '/owner/summary'), c = s.counts, r = s.revenue;
  const tile = (icon, label, value, note = '', hi = '') => `<div class="stat ${hi}"><div class="stat-h">${im(icon)}<span>${label}</span></div><b class="d num">${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
  const max = Math.max(1, ...s.months.map(m => +m.total));
  pane.innerHTML = `<div class="stats">
      ${tile('moneybag', 'Faturamento do mês', brl(r.month), `${r.payments} pagamento(s) aprovados no total`, 'gold')}
      ${tile('chart', 'Receita recorrente por mês', brl(r.mrr), `${brl(r.arr)} por ano no ritmo atual`)}
      ${tile('trophy', 'Assinantes pagos', c.paid_monthly + c.paid_annual, `${c.paid_annual} anuais · ${c.paid_monthly} mensais`, 'green')}
      ${tile('hourglass', 'Em teste grátis', c.trial, `${c.expiring7} vencem nos próximos 7 dias`)}
      ${tile('lock', 'Vencidos', c.expired, s.conversion === null ? 'Nenhum teste encerrado ainda' : `Conversão do teste: ${s.conversion}%`)}
      ${tile('people', 'Famílias', c.total, `${c.new30} novas em 30 dias · ${c.active7} usaram na semana`)}
      ${tile('coin', 'Últimos 12 meses', brl(r.year), `Desde o início: ${brl(r.total)}`)}
      ${tile('gift', 'Cortesias', c.free, `Preço: ${brl(s.settings.price_annual)}/ano · ${brl(s.settings.price_monthly)}/mês`)}
    </div>
    <section class="box"><div class="box-h"><h2 class="d">Faturamento por mês</h2></div>
      ${s.months.length ? `<table><thead><tr><th>Mês</th><th>Anuais</th><th>Mensais</th><th>Total</th><th class="bar-col" aria-hidden="true"></th></tr></thead><tbody>${s.months.map(m => { const [y, mo] = m.m.split('-');
        return `<tr><td>${MES[+mo - 1]}/${y.slice(2)}</td><td>${m.annual}</td><td>${m.monthly}</td><td>${brl(m.total)}</td><td class="bar-col" aria-hidden="true"><i class="hbar" style="width:${+m.total / max * 100}%"></i></td></tr>`; }).join('')}</tbody></table>`
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
      <div class="field" data-p><span class="lab">Plano</span>${seg('plan', [['annual', 'Anual'], ['monthly', 'Mensal']], 'annual')}</div>`,
      async (fm) => { await api('POST', '/owner/families/' + f.id, { action: fm.action.value, date: fm.date.value, plan: fm.plan.value }); toast('Família atualizada'); ownerFamilies(pane, $('#q')?.value || ''); },
      { saveLabel: 'Aplicar' });
    const fm = bg.querySelector('form'), u = () => { $('[data-d]', fm).hidden = !['trial', 'paid'].includes(fm.action.value); $('[data-p]', fm).hidden = fm.action.value !== 'paid'; };
    fm.addEventListener('change', u); u();
  });
}
async function ownerPayments(pane) {
  const rows = await api('GET', '/owner/payments');
  const METHOD = { pix: 'Pix', bolbradesco: 'Boleto', pec: 'Lotérica', account_money: 'Saldo MP' };
  pane.innerHTML = `<section class="box"><div class="box-h"><h2 class="d">Pagamentos</h2></div>
    ${rows.length ? `<div class="scroll-x"><table><thead><tr><th>Data</th><th>Família</th><th>Plano</th><th>Valor</th><th>Forma</th><th>Situação</th><th>Acesso até</th></tr></thead><tbody>${rows.map(p => `<tr>
      <td>${dmy(p.paid_at || p.created_at)}</td><td>${esc(p.family)}<div class="s">${esc(p.email)}</div></td><td>${PLAN_N[p.plan]}</td><td>${brl(p.amount)}</td>
      <td>${esc(METHOD[p.method] || (p.method ? 'Cartão ' + p.method : '—'))}</td><td>${tag(PAY, p.status)}</td><td>${p.period_end ? dmy(p.period_end) : '—'}</td></tr>`).join('')}</tbody></table></div>`
    : zero('moneybag', 'Nenhum pagamento ainda.')}</section>`;
}
async function ownerPrices(pane) {
  const s = (await api('GET', '/owner/summary')).settings;
  pane.innerHTML = `<form class="box" id="f" novalidate><div class="box-h"><h2 class="d">Preços e teste grátis</h2></div>
    <p class="lead">Valem para novas cobranças e para a página de vendas. Quem já pagou mantém o período comprado.</p>
    <div class="grid2"><div class="field"><label for="pa">Plano anual (R$ por ano)</label><input id="pa" name="price_annual" type="number" step="0.01" min="1" value="${s.price_annual}" inputmode="decimal"><p class="hint" id="pah"></p></div>
    <div class="field"><label for="pm">Plano mensal (R$ por mês)</label><input id="pm" name="price_monthly" type="number" step="0.01" min="1" value="${s.price_monthly}" inputmode="decimal"></div></div>
    <div class="field"><label for="td">Dias de teste grátis para novas famílias</label><input id="td" name="trial_days" type="number" min="0" step="1" value="${s.trial_days}" inputmode="numeric"><p class="hint">90 dias = 3 meses. Não muda o prazo de quem já se cadastrou.</p></div>
    <div class="err" role="alert"></div><div class="actions"><button class="btn green">Salvar preços</button></div></form>`;
  const f = $('#f'), h = () => { const a = +f.price_annual.value, m = +f.price_monthly.value; $('#pah').textContent = a && m ? `Sai por ${brl(Math.floor(a / 12 * 100) / 100)} por mês, ${Math.max(0, Math.round((1 - a / (m * 12)) * 100))}% mais barato que o mensal.` : ''; };
  f.oninput = h; h();
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', '/owner/settings', { price_annual: f.price_annual.value, price_monthly: f.price_monthly.value, trial_days: f.trial_days.value }); toast('Preços salvos'); f.querySelector('.err').textContent = ''; }
    catch (er) { f.querySelector('.err').textContent = er.message; sfx.bad(); }
  };
}
