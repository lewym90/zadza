/* ŻĄDZA – logika gry */
(function () {
'use strict';

var LV = DATA.levels, HOT = DATA.hot, FIN = DATA.fin, PEN = DATA.pen, CATS = DATA.cats;
var BYID = {};
[].concat(LV[1].cards, LV[2].cards, LV[3].cards, LV[4].cards, LV[5].cards, HOT, FIN, PEN).forEach(function (c) { BYID[c.id] = c; });

/* ---------- pomocnicze ---------- */
function $(id) { return document.getElementById(id); }
function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function rnd(n) { return Math.floor(Math.random() * n); }
function pickOne(a) { return a[rnd(a.length)]; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function vib(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
var toastT;
function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200); }

/* ---------- pamięć ---------- */
var mem = {};
var store = {
  get: function (k, d) { try { var v = localStorage.getItem('zadza:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return (k in mem) ? mem[k] : d; } },
  set: function (k, v) { mem[k] = v; try { localStorage.setItem('zadza:' + k, JSON.stringify(v)); } catch (e) {} }
};
var S = {
  ok: store.get('ok', false),
  names: store.get('names', ['', '']),
  prefs: store.get('prefs', null),
  set: store.get('set', { mode: 'esc', level: 1, length: 28, skips: 3 }),
  fav: store.get('fav', []),
  bony: store.get('bony', []),
  game: store.get('game', null),
  hint: store.get('hint', false)
};
function save(k) { store.set(k, S[k]); }
var G = S.game;           // bieżąca gra
var CFG = {};             // tymczasowa konfiguracja
var P = null;             // tymczasowe wybory
var prevScreen = 'home';

/* ---------- ekrany ---------- */
var cur = 'home';
function show(name) {
  if (cur !== name && name !== 'up') prevScreen = cur;
  cur = name;
  qa('.scr').forEach(function (s) { s.classList.toggle('on', s.id === 's-' + name); });
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
  if (name === 'bony') renderBony();
  if (name === 'fav') renderFav();
  if (name === 'game') document.body.setAttribute('data-level', G.lvl);
  else if (name !== 'up') document.body.setAttribute('data-level', name === 'end' ? 4 : 1);
  $('stop-btn').hidden = !(name === 'lic' || name === 'kon');
  if (name === 'game' || name === 'dice' || name === 'lic' || name === 'kon') wake(); else if (name === 'home' || name === 'end') unwake();
}
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('[data-go]') : null;
  if (t) { var g = t.getAttribute('data-go'); show(g === 'back' ? (prevScreen === 'game' && !G ? 'home' : prevScreen) : g); }
  var c = e.target.closest ? e.target.closest('[data-close]') : null;
  if (c) closeSheets();
});

var wl = null;
function wake() { try { if (navigator.wakeLock && !wl) navigator.wakeLock.request('screen').then(function (l) { wl = l; l.addEventListener('release', function () { wl = null; }); }).catch(function () {}); } catch (e) {} }
function unwake() { try { if (wl) { wl.release(); wl = null; } } catch (e) {} }
document.addEventListener('visibilitychange', function () { if (!document.hidden && (cur === 'game' || cur === 'dice' || cur === 'lic' || cur === 'kon')) wake(); });

function openSheet(id) { var s = $(id); s.classList.add('on'); s.setAttribute('aria-hidden', 'false'); }
function closeSheets() { qa('.sheet').forEach(function (s) { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); }); }

/* ---------- ekran główny ---------- */
function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function renderHome() {
  document.body.setAttribute('data-role', 'm');
  $('home-gate').hidden = S.ok;
  $('home-main').hidden = !S.ok;
  var canResume = !!(G && !G.over);
  $('btn-resume').hidden = !canResume;
  $('btn-new').className = canResume ? 'btn black' : 'btn latex';
  $('lnk-bony').textContent = 'Bony' + (S.bony.length ? ' (' + S.bony.length + ')' : '');
  $('lnk-fav').textContent = 'Ulubione' + (S.fav.length ? ' (' + S.fav.length + ')' : '');
  $('install').hidden = !(S.ok && isIOS() && !isStandalone() && !S.hint);
}
$('btn-enter').onclick = function () { S.ok = true; save('ok'); renderHome(); };
$('btn-leave').onclick = function () { $('home-gate').innerHTML = '<p class="tag">Do zobaczenia.</p>'; };
$('install-x').onclick = function () { S.hint = true; save('hint'); $('install').hidden = true; };
$('btn-resume').onclick = function () { show('game'); renderCard(false); };
$('btn-new').onclick = function () {
  if (G && !G.over && !confirm('Zacząć nową grę? Poprzednia przepadnie.')) return;
  openSetup();
};
$('lnk-bony').onclick = function () { show('bony'); };
$('lnk-fav').onclick = function () { show('fav'); };

/* ---------- ustawienia ---------- */
var LVC = ['', '255,170,140', '255,110,60', '255,40,90', '200,10,40', '120,0,30'];
var NOTES = {
  esc: 'Zaczynacie od Lodu. Co kilka kart robi się goręcej, aż do poziomu Zero zasad.',
  level: 'Wybierasz jeden poziom i na nim zaczynacie. W trakcie gry możesz go zmienić.',
  roul: 'Gra losuje poziom startowy. W trakcie gry możesz go zmienić.'
};
function openSetup() {
  CFG = { mode: S.set.mode, level: S.set.level, length: S.set.length, skips: S.set.skips, repref: !S.prefs };
  $('n0').value = (S.names[0] && S.names[0] !== 'On') ? S.names[0] : '';
  $('n1').value = (S.names[1] && S.names[1] !== 'Ona') ? S.names[1] : '';
  buildTiers();
  syncSetup();
  show('setup');
}
function buildTiers() {
  var h = '';
  for (var l = 1; l <= 5; l++) {
    h += '<button class="tier" data-l="' + l + '"><span class="n">' + l + '</span><div><b>' + esc(LV[l].name) + '</b><span>' + esc(LV[l].sub) + '</span></div></button>';
  }
  $('tiers').innerHTML = h;
}
function syncSeg(id, val) { qa('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === String(val)); }); }
function syncSetup() {
  syncSeg('seg-mode', CFG.mode); syncSeg('seg-len', CFG.length); syncSeg('seg-skip', CFG.skips);
  $('note-mode').textContent = NOTES[CFG.mode];
  $('tiers').hidden = CFG.mode !== 'level';
  qa('#tiers .tier').forEach(function (t) { t.classList.toggle('on', +t.getAttribute('data-l') === CFG.level); });
  var chk = $('chk-pref');
  chk.hidden = !S.prefs;
  chk.classList.toggle('on', CFG.repref);
  chk.textContent = CFG.repref ? 'Wybory zostaną ustawione od nowa' : 'Ustawcie wybory od nowa';
}
$('seg-mode').onclick = function (e) { var b = e.target.closest('button'); if (b) { CFG.mode = b.getAttribute('data-v'); syncSetup(); } };
$('seg-len').onclick = function (e) { var b = e.target.closest('button'); if (b) { CFG.length = +b.getAttribute('data-v'); syncSetup(); } };
$('seg-skip').onclick = function (e) { var b = e.target.closest('button'); if (b) { CFG.skips = +b.getAttribute('data-v'); syncSetup(); } };
$('tiers').onclick = function (e) { var b = e.target.closest('.tier'); if (b) { CFG.level = +b.getAttribute('data-l'); syncSetup(); } };
$('chk-pref').onclick = function () { CFG.repref = !CFG.repref; syncSetup(); };
$('btn-setup-go').onclick = function () {
  S.names = [$('n0').value.trim() || 'On', $('n1').value.trim() || 'Ona'];
  save('names');
  S.set = { mode: CFG.mode, level: CFG.level, length: CFG.length, skips: CFG.skips };
  save('set');
  if (!S.prefs || CFG.repref) startPrefs(0); else show('choose');
};
$('go-cards').onclick = function () { syncSetup(); show('cards'); };
$('btn-cards-go').onclick = function () {
  S.set = { mode: CFG.mode, level: CFG.level, length: CFG.length, skips: CFG.skips };
  save('set'); startDraw();
};

/* ---------- wybory tak / może / nie ---------- */
function startPrefs(pi) {
  var saved = (S.prefs && S.prefs[pi]) || {};
  P = { pi: pi, v: {} };
  CATS.forEach(function (c) { P.v[c.k] = saved[c.k] || 'moze'; });
  $('pref-hd').textContent = 'Wybory: ' + S.names[pi];
  $('pref-sub').textContent = 'Odpowiadaj szczerze. Druga osoba nie zobaczy twoich odpowiedzi, a „nie” z którejkolwiek strony wyklucza taką kartę z gry.';
  var h = '';
  CATS.forEach(function (c) {
    h += '<div class="row" data-k="' + c.k + '"><span class="t">' + esc(c.l) + '</span><div class="tri">' +
      '<button data-v="tak">Tak</button><button data-v="moze">Może</button><button data-v="nie">Nie</button></div></div>';
  });
  $('pref-rows').innerHTML = h;
  syncPrefs();
  document.body.setAttribute('data-role', pi === 0 ? 'm' : 'f');
  show('prefs');
}
function syncPrefs() {
  qa('#pref-rows .row').forEach(function (r) {
    var v = P.v[r.getAttribute('data-k')];
    qa('button', r).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
  });
}
$('pref-rows').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  P.v[b.closest('.row').getAttribute('data-k')] = b.getAttribute('data-v'); syncPrefs();
};
$('pref-all-yes').onclick = function () { CATS.forEach(function (c) { P.v[c.k] = 'tak'; }); syncPrefs(); };
$('pref-all-maybe').onclick = function () { CATS.forEach(function (c) { P.v[c.k] = 'moze'; }); syncPrefs(); };
$('btn-pref-done').onclick = function () {
  var cp = S.prefs ? [S.prefs[0] || {}, S.prefs[1] || {}] : [{}, {}];
  cp[P.pi] = P.v; S.prefs = cp; save('prefs');
  if (P.pi === 0) {
    $('hand-name').textContent = S.names[1];
    $('btn-hand-go').textContent = 'Jestem gotowa';
    document.body.setAttribute('data-role', 'f');
    show('hand');
  } else { show('choose'); }
};
$('btn-hand-go').onclick = function () { startPrefs(1); };

/* ---------- losowanie startu ---------- */
var reelBusy = false;
function spin(el, items, finalIdx, ms, done) {
  var i = 0, t0 = Date.now(), delay = 70;
  el.classList.remove('lock');
  (function tick() {
    var el_t = Date.now() - t0;
    if (el_t >= ms) {
      el.textContent = items[finalIdx]; el.classList.add('lock'); vib(30); done && done(); return;
    }
    i = (i + 1) % items.length;
    el.textContent = items[i];
    delay = 70 + (el_t / ms) * (el_t / ms) * 260;
    setTimeout(tick, delay);
  })();
}
function startDraw() {
  var names = S.names;
  var starter = rnd(2);
  var lvl = S.set.mode === 'level' ? S.set.level : (S.set.mode === 'esc' ? 1 : 1 + rnd(5));
  CFG.draw = { starter: starter, lvl: lvl };
  $('btn-draw-go').disabled = true;
  $('btn-draw-go').textContent = 'Zaczynamy';
  $('lvl-wrap').hidden = S.set.mode !== 'roul';
  $('draw-note').textContent = '';
  document.body.setAttribute('data-role', 'm');
  show('draw');
  var rw = $('reel-who'), rl = $('reel-lvl');
  rw.textContent = '…'; rl.textContent = '…';
  var altRole = 0;
  var roleTimer = setInterval(function () { altRole ^= 1; document.body.setAttribute('data-role', altRole ? 'f' : 'm'); }, 170);
  spin(rw, names, starter, 2300, function () {
    clearInterval(roleTimer);
    document.body.setAttribute('data-role', starter === 0 ? 'm' : 'f');
    var finish = function () {
      var line = (starter === 0 ? 'On' : 'Ona') + ' zaczyna. ';
      if (S.set.mode === 'esc') line += 'Poziom startowy: ' + LV[1].name + '.';
      else if (S.set.mode === 'level') line += 'Poziom: ' + LV[lvl].name + '.';
      else line += 'Poziom: ' + LV[lvl].name + '.';
      $('draw-note').textContent = line;
      $('btn-draw-go').disabled = false;
    };
    if (S.set.mode === 'roul') {
      var lnames = [1, 2, 3, 4, 5].map(function (l) { return l + ' ' + LV[l].name; });
      setTimeout(function () { spin(rl, lnames, lvl - 1, 2000, function () { document.body.setAttribute('data-level', lvl); finish(); }); }, 450);
    } else finish();
  });
}
$('btn-draw-go').onclick = function () {
  var d = CFG.draw;
  var length = S.set.length;
  G = {
    mode: S.set.mode, lvl: d.lvl, length: length,
    per: length > 0 ? Math.max(3, Math.floor(length / 5)) : 8,
    starter: d.starter, player: d.starter, turn: 0,
    names: S.names.slice(), skips: [S.set.skips, S.set.skips],
    used: {}, lastHot: -9, cur: null, log: [], cl: [0, 0], ejAt: -99, herO: 0,
    stat: { skips: 0, pens: 0, hot: 0, bony: 0 }, over: false, t0: Date.now()
  };
  S.game = G; save('game');
  show('game');
  startTurn();
};

/* ---------- talia ---------- */
/* spójność: stan ubrań (0 ubrany, 1 bielizna, 2 nago) i odstęp po wytrysku */
var EJ_GAP = 6, LVMIN = [0, 0, 1, 1, 1, 2];
function clInit() {
  if (!G.cl) G.cl = [0, 0];
  if (G.ejAt === undefined) G.ejAt = -99;
  var m = LVMIN[G.lvl] || 0;
  if (G.cl[0] < m) G.cl[0] = m;
  if (G.cl[1] < m) G.cl[1] = m;
}
function roleKey(p) { return p === 0 ? 'm' : 'f'; }
function ejHere(c, p) { return !!c.ej && (c.ej === 'b' || c.ej === roleKey(p)); }
function consistent(c) {
  clInit();
  var p = G.player, r = c.c && c.c[roleKey(p)];
  if (r) {
    if (r.ra && (G.cl[p] < r.ra[0] || G.cl[p] > r.ra[1])) return false;
    if (r.rt && (G.cl[p ^ 1] < r.rt[0] || G.cl[p ^ 1] > r.rt[1])) return false;
  }
  if (ejHere(c, p) && G.turn - G.ejAt < EJ_GAP) return false;
  return true;
}
function applyFx(v, cur) { return v === '+1' ? Math.min(2, cur + 1) : Math.max(cur, v); }
function applyEffects() {
  if (!G.cur) return;
  var c = findCard(G.cur.id); if (!c) return;
  clInit();
  var p = G.player, r = c.c && c.c[roleKey(p)];
  if (r) {
    if (r.ea !== undefined) G.cl[p] = applyFx(r.ea, G.cl[p]);
    if (r.et !== undefined) G.cl[p ^ 1] = applyFx(r.et, G.cl[p ^ 1]);
  }
  if (ejHere(c, p)) G.ejAt = G.turn;
  if (c.o && (c.o === 1 || c.o === 'b' || c.o === roleKey(p))) G.herO = 1;
}
function findCard(id) {
  var i, l, arr;
  for (l = 1; l <= 5; l++) { arr = LV[l].cards; for (i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; }
  var pools = [HOT, FIN, PEN];
  for (l = 0; l < 3; l++) for (i = 0; i < pools[l].length; i++) if (pools[l][i].id === id) return pools[l][i];
  return null;
}
function vetoed(c) {
  if (!c.g || !S.prefs) return false;
  for (var i = 0; i < c.g.length; i++) {
    if ((S.prefs[0] && S.prefs[0][c.g[i]] === 'nie') || (S.prefs[1] && S.prefs[1][c.g[i]] === 'nie')) return true;
  }
  return false;
}
function weight(c) {
  var w = 1;
  if (c.h && G && G.ejAt > -99 && G.turn - G.ejAt <= 3) w *= 4;
  if (c.g && S.prefs) c.g.forEach(function (t) {
    if (S.prefs[0] && S.prefs[0][t] === 'tak') w += 0.6;
    if (S.prefs[1] && S.prefs[1][t] === 'tak') w += 0.6;
  });
  return w;
}
function pickW(pool) {
  var tot = 0, i; for (i = 0; i < pool.length; i++) tot += weight(pool[i]);
  var r = Math.random() * tot;
  for (i = 0; i < pool.length; i++) { r -= weight(pool[i]); if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function drawRegular() {
  var all = LV[G.lvl].cards;
  var pool = all.filter(function (c) { return !G.used[c.id] && !vetoed(c) && consistent(c); });
  if (!pool.length) {
    all.forEach(function (c) { delete G.used[c.id]; });
    pool = all.filter(function (c) { return !vetoed(c) && consistent(c); });
  }
  if (!pool.length) pool = all.filter(function (c) { return consistent(c); });
  if (!pool.length) pool = all;
  return pickW(pool);
}
function drawHot() {
  if (G.turn < 2 || G.turn - G.lastHot < 4 || Math.random() > 0.15) return null;
  var pool = HOT.filter(function (c) { return (c.min || 1) <= G.lvl && !G.used[c.id] && !vetoed(c) && consistent(c); });
  if (!pool.length) return null;
  return pickW(pool);
}
function pickPenalty() {
  var pool = PEN.filter(function (c) { return (c.min || 1) <= G.lvl && !vetoed(c) && consistent(c); });
  if (!pool.length) pool = PEN.filter(function (c) { return !vetoed(c) && consistent(c); });
  if (!pool.length) pool = PEN.filter(function (c) { return !vetoed(c); });
  if (!pool.length) pool = PEN;
  return pickOne(pool);
}
function textFor(c, p) { return c.f ? (p === 0 ? c.m : c.f) : c.m; }

/* ---------- przebieg tury ---------- */
function present(c, kind) {
  G.used[c.id] = 1;
  G.cur = { id: c.id, kind: kind, bon: false };
  G.log.push({ id: c.id, p: G.player, k: kind });
  if (G.log.length > 200) G.log.shift();
  save('game');
  renderCard(true);
}
function startTurn() {
  G.turn++;
  var h = drawHot();
  if (h) { G.lastHot = G.turn; G.stat.hot++; present(h, 'hot'); }
  else present(drawRegular(), 'card');
}
function startFinale() {
  G.turn++;
  var pool = FIN.filter(function (c) { return !vetoed(c) && consistent(c); });
  if (!G.herO) {
    var hp = pool.filter(function (c) { return c.o; });
    if (hp.length) pool = hp;
  }
  if (!pool.length) pool = FIN.filter(function (c) { return !vetoed(c); });
  if (!pool.length) pool = FIN;
  G.over = true;
  present(pickOne(pool), 'fin');
}
function onNext() {
  if (!G) return;
  if (G.cur && G.cur.kind === 'fin') { endGame(); return; }
  stopTimer();
  vib(15);
  applyEffects();
  G.player ^= 1;
  var done = G.turn;
  if (G.length > 0 && done >= G.length) { startFinale(); return; }
  if (G.mode === 'esc' && done % G.per === 0 && G.lvl < 5) { levelUp(G.lvl + 1); return; }
  startTurn();
}
function levelUp(l) {
  G.lvl = l; save('game');
  document.body.setAttribute('data-level', l);
  $('up-num').textContent = l;
  $('up-name').textContent = LV[l].name;
  $('up-sub').textContent = LV[l].sub + '.';
  show('up');
}
$('btn-up-go').onclick = function () { show('game'); startTurn(); };
$('btn-next').onclick = onNext;
$('btn-skip').onclick = function () {
  if (!G || !G.cur || G.cur.kind === 'fin' || G.cur.kind === 'pen') return;
  stopTimer();
  var p = G.player;
  if (G.skips[p] > 0) {
    G.skips[p]--; G.stat.skips++;
    present(drawRegular(), 'card');
  } else {
    G.stat.pens++;
    present(pickPenalty(), 'pen');
  }
};

/* ---------- karta na ekranie ---------- */
var TYPEICON = { hot: 'i-flame', fin: 'i-flame', pen: '', card: '' };
function renderCard(animate) {
  if (!G || !G.cur) return;
  var c = BYID[G.cur.id], p = G.player, kind = G.cur.kind;
  var role = p === 0 ? 'm' : 'f';
  document.body.setAttribute('data-role', role);
  document.body.setAttribute('data-level', G.lvl);
  $('who-r').textContent = p === 0 ? 'on' : 'ona';
  $('wm').textContent = p === 0 ? 'on' : 'ona';
  $('who-nm').textContent = G.names[p];
  var tx = textFor(c, p);
  var face = $('face');
  var tcls = kind === 'hot' ? 't-hot' : kind === 'fin' ? 't-fin' : kind === 'pen' ? 't-pen' : (c.t === 'Bon' ? 't-bon' : '');
  face.className = 'side face ' + tcls;
  $('ctype').innerHTML = (TYPEICON[kind] ? '<svg><use href="#' + TYPEICON[kind] + '"/></svg>' : '') + esc(c.t);
  var ct = $('ctext'); ct.textContent = tx; ct.className = 'ctext' + (tx.length > 190 ? ' long' : '');
  $('lvl-name').textContent = G.lvl + '. ' + LV[G.lvl].name;
  qa('#heat i').forEach(function (i, ix) { i.className = ix < G.lvl ? 'on' + (ix === G.lvl - 1 ? ' cur' : '') : ''; });
  // postęp
  var total = G.length > 0 ? G.length : 0;
  $('prog-txt').textContent = total ? 'Karta ' + Math.min(G.turn, total) + ' z ' + total : 'Karta ' + G.turn;
  $('prog-bar').style.width = total ? Math.min(100, G.turn / total * 100) + '%' : '100%';
  // przyciski
  var left = G.skips[p];
  var canSkip = kind !== 'fin' && kind !== 'pen';
  var sk = $('btn-skip');
  $('btn-skip').parentNode.classList.toggle('solo', !canSkip);
  sk.innerHTML = left > 0 ? (left > 20 ? 'Pomiń' : 'Pomiń <em>' + left + '</em>') : 'Pomiń (kara)';
  $('btn-next').textContent = kind === 'fin' ? 'Koniec' : 'Następna karta';
  $('bony-n').hidden = !S.bony.length; $('bony-n').textContent = S.bony.length;
  buildFoot(c, tx, kind);
  // flip
  var card = $('card');
  if (animate) {
    card.style.transition = 'none'; card.classList.remove('flip');
    void card.offsetWidth;
    card.style.transition = '';
    setTimeout(function () { card.classList.add('flip'); }, 60);
  } else { card.classList.add('flip'); }
}

/* stopka karty: ulubione, timer, bon */
var NUMW = { 'jedną': 1, 'jedna': 1, 'dwie': 2, 'dwa': 2, 'dwóch': 2, 'trzy': 3, 'trzech': 3, 'cztery': 4, 'czterech': 4, 'pięć': 5, 'pięciu': 5, 'sześć': 6, 'dziesięć': 10, 'dziesięciu': 10, 'piętnaście': 15, 'dwadzieścia': 20, 'trzydzieści': 30, 'czterdzieści': 40, 'pięćdziesiąt': 50, 'sześćdziesiąt': 60 };
function secsIn(text) {
  var m = text.match(/(\d+|jedn\w+|dwie|dwa|dwóch|trzy|trzech|cztery|czterech|pięć|pięciu|sześć|dziesięć|dziesięciu|piętnaście|dwadzieścia|trzydzieści|czterdzieści|pięćdziesiąt|sześćdziesiąt)\s+(sekund\w*|minut\w*)/i);
  if (m) {
    var n = /^\d+$/.test(m[1]) ? +m[1] : (NUMW[m[1].toLowerCase()] || 0);
    if (n) return /^s/i.test(m[2]) ? n : n * 60;
  }
  if (/(przez|całą|co najmniej|jedną)\s+(całą\s+)?minutę|minutę/i.test(text)) return 60;
  return 0;
}
var tm = { t: null, left: 0, total: 0, on: false };
function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
function stopTimer() { clearInterval(tm.t); tm.on = false; }
var AC;
function beep() {
  try {
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    AC = AC || new A();
    [0, .26, .52].forEach(function (d, i) {
      var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + d;
      o.frequency.value = i === 2 ? 880 : 660; o.type = 'sine';
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .24);
    });
  } catch (e) {}
}
function buildFoot(c, tx, kind) {
  stopTimer();
  var foot = $('cfoot'), isFav = S.fav.indexOf(c.id) >= 0;
  var h = '<div id="foot-l" style="display:flex;gap:10px;align-items:center"></div>';
  h += '<button class="fav' + (isFav ? ' on' : '') + '" id="btn-fav" aria-label="Ulubione"><svg viewBox="0 0 24 24"><use href="#i-heart"/></svg></button>';
  foot.innerHTML = h;
  $('tmrbar').hidden = true;
  var fl = $('foot-l');
  var secs = kind === 'fin' || kind === 'pen' ? 0 : secsIn(tx);
  if (c.t === 'Bon') {
    var saved = G.cur.bon;
    fl.innerHTML = '<button class="tmr" id="btn-bon"' + (saved ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><use href="#i-ticket"/></svg>' + (saved ? 'Bon zapisany' : 'Zachowaj bon') + '</button>';
    $('btn-bon').onclick = function () {
      if (G.cur.bon) return;
      G.cur.bon = true; G.stat.bony++;
      S.bony.unshift({ id: c.id + '-' + Date.now().toString(36), owner: G.player, name: G.names[G.player], text: tx, date: Date.now(), done: false });
      save('bony'); save('game');
      toast('Bon zapisany');
      renderCard(false);
    };
  } else if (secs) {
    tm.total = secs; tm.left = secs;
    fl.innerHTML = '<button class="tmr" id="btn-tmr"><svg viewBox="0 0 24 24"><use href="#i-clock"/></svg><span id="tmr-t">Start ' + fmt(secs) + '</span></button>';
    $('btn-tmr').onclick = toggleTimer;
  }
  $('btn-fav').onclick = function () {
    var ix = S.fav.indexOf(c.id);
    if (ix >= 0) { S.fav.splice(ix, 1); this.classList.remove('on'); } else { S.fav.push(c.id); this.classList.add('on'); toast('Dodano do ulubionych'); vib(20); }
    save('fav');
  };
}
function toggleTimer() {
  var b = $('btn-tmr'), bar = $('tmrbar'), fill = $('tmrfill');
  if (tm.on) { stopTimer(); b.classList.remove('run'); $('tmr-t').textContent = 'Wznów ' + fmt(tm.left); return; }
  try { var A = window.AudioContext || window.webkitAudioContext; if (A) { AC = AC || new A(); if (AC.resume) AC.resume(); } } catch (e) {}
  if (tm.left <= 0) tm.left = tm.total;
  tm.on = true; b.classList.remove('done'); b.classList.add('run'); bar.hidden = false;
  var tick = function () {
    $('tmr-t').textContent = fmt(tm.left);
    fill.style.transform = 'scaleX(' + (1 - tm.left / tm.total) + ')';
  };
  tick();
  tm.t = setInterval(function () {
    tm.left--;
    if (tm.left <= 0) {
      stopTimer(); tm.left = 0; b.classList.remove('run'); b.classList.add('done');
      $('tmr-t').textContent = 'Czas minął'; fill.style.transform = 'scaleX(1)';
      beep(); vib([200, 100, 200, 100, 400]);
      setTimeout(function () { if ($('tmr-t')) { tm.left = tm.total; $('tmr-t').textContent = 'Jeszcze raz ' + fmt(tm.total); fill.style.transform = 'scaleX(0)'; } }, 2600);
      return;
    }
    tick();
  }, 1000);
}

/* ---------- menu ---------- */
function buildMenu() {
  var h = '';
  for (var l = 1; l <= 5; l++) h += '<button data-l="' + l + '" class="' + (G.lvl === l ? 'on' : '') + '">' + l + '. ' + esc(LV[l].name) + '</button>';
  $('menu-lvls').innerHTML = h;
  $('m-bony-n').textContent = S.bony.length ? S.bony.length + ' zapisane' : '';
  $('m-fav-n').textContent = S.fav.length ? S.fav.length + ' ' + (S.fav.length === 1 ? 'karta' : (S.fav.length % 10 >= 2 && S.fav.length % 10 <= 4 && (S.fav.length % 100 < 12 || S.fav.length % 100 > 14) ? 'karty' : 'kart')) : '';
}
$('btn-menu').onclick = function () { buildMenu(); openSheet('sh-menu'); };
$('menu-lvls').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  var l = +b.getAttribute('data-l');
  closeSheets();
  if (l === G.lvl) return;
  G.mode = G.mode === 'esc' ? 'level' : G.mode;   // ręczna zmiana wyłącza automatyczną eskalację
  G.lvl = l; save('game');
  document.body.setAttribute('data-level', l);
  stopTimer();
  present(drawRegular(), 'card');
  toast('Poziom: ' + LV[l].name);
};
$('m-fin').onclick = function () { closeSheets(); if (G.cur && G.cur.kind === 'fin') return; stopTimer(); startFinale(); };
$('m-bony').onclick = function () { closeSheets(); show('bony'); };
$('m-fav').onclick = function () { closeSheets(); show('fav'); };
$('m-home').onclick = function () { closeSheets(); stopTimer(); show('home'); };
$('m-end').onclick = function () { closeSheets(); if (confirm('Zakończyć grę teraz?')) endGame(); };
$('btn-bony').onclick = function () { show('bony'); };

/* ---------- prawda czy wyzwanie ---------- */
var PC = { lvlSel: 0, skipSel: 3, g: null };
var PDRESS = ['', 'Ubrani', 'W bieliźnie', 'Nago', 'Nago', 'Nago'];
function pcwLvl(g) { return g.fixed ? g.fixed : Math.min(5, 1 + Math.floor(g.turn / 6)); }
function pSync() {
  qa('#pseg-lvl button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === PC.lvlSel); });
  qa('#pseg-skip button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === PC.skipSel); });
  $('pnote-lvl').textContent = PC.lvlSel === 0 ? 'Zaczynacie od Lodu, a co kilka tur robi się goręcej, aż do Zero zasad.' : (PC.lvlSel + '. ' + LV[PC.lvlSel].name + ' - ' + LV[PC.lvlSel].sub);
}
$('go-pcw').onclick = function () {
  var s = store.get('pcw', null); if (s) { PC.lvlSel = s.l; PC.skipSel = s.s; }
  document.body.setAttribute('data-role', 'm');
  show('pcwset'); document.body.setAttribute('data-level', 1); pSync();
};
$('pseg-lvl').onclick = function (e) { var b = e.target.closest('button'); if (b) { PC.lvlSel = +b.getAttribute('data-v'); pSync(); } };
$('pseg-skip').onclick = function (e) { var b = e.target.closest('button'); if (b) { PC.skipSel = +b.getAttribute('data-v'); pSync(); } };
$('btn-pcw-start').onclick = function () {
  store.set('pcw', { l: PC.lvlSel, s: PC.skipSel });
  PC.g = { fixed: PC.lvlSel, skips: [PC.skipSel, PC.skipSel], player: rnd(2), turn: 0, used: {}, cur: null, ejAt: -99, lastLvl: 0 };
  show('pcw'); pcwTurn();
};
function pcwPool(type, p, lvl) {
  var g = PC.g, role = p === 0 ? 'm' : 'f';
  var base = DATA.pcw[type].filter(function (x) {
    return (x.r === 'b' || x.r === role) && !dVeto(x.g) && !(x.ej && g.turn - g.ejAt < 6);
  });
  var key = function (x) { return type + ':' + x.t; };
  var fresh = base.filter(function (x) { return !g.used[key(x)]; });
  var pick = function (arr, lv) { return arr.filter(function (x) { return x.l === lv && (!x.x || lv === lvl); }); };
  var pool = pick(fresh, lvl);
  if (lvl > 1 && Math.random() < 0.3) { var lo = pick(fresh, lvl - 1); if (lo.length) pool = lo; }
  for (var l = lvl - 1; !pool.length && l >= 1; l--) pool = pick(fresh, l);
  if (!pool.length) { base.forEach(function (x) { if (x.l >= Math.max(1, lvl - 1) && x.l <= lvl) delete g.used[key(x)]; }); pool = base.filter(function (x) { return x.l === lvl; }); }
  if (!pool.length) pool = base;
  return pool.length ? pickOne(pool) : null;
}
function pcwTurn() {
  var g = PC.g, p = g.player, lvl = pcwLvl(g);
  stopP();
  document.body.setAttribute('data-role', p === 0 ? 'm' : 'f');
  document.body.setAttribute('data-level', lvl);
  $('pcw-r').textContent = p === 0 ? 'on' : 'ona';
  $('pcw-nm').textContent = S.names[p];
  $('pcw-lvl').textContent = lvl + '. ' + LV[lvl].name;
  $('pcw-dress').textContent = 'Teraz: ' + PDRESS[lvl].toLowerCase() + '.';
  if (lvl !== g.lastLvl) { if (g.lastLvl) toast('Poziom: ' + LV[lvl].name + '. ' + PDRESS[lvl] + '.'); g.lastLvl = lvl; }
  $('pcw-ask').textContent = S.names[p] + ', wybierasz.';
  $('pcw-choose').hidden = false; $('pcw-card').hidden = true;
}
var ptm = null;
function stopP() { clearInterval(ptm); ptm = null; }
function pcwShow(kind, item) {
  var g = PC.g, p = g.player;
  g.cur = { kind: kind, item: item };
  if (kind !== 'k') g.used[kind + ':' + item.t] = 1;
  if (item.ej) g.ejAt = g.turn;
  $('pcw-choose').hidden = true; $('pcw-card').hidden = false;
  $('pcw-kind').textContent = kind === 'p' ? 'Prawda' : kind === 'w' ? 'Wyzwanie' : 'Kara';
  $('pcw-tx').textContent = item.t;
  $('pcw-tm').hidden = !item.s;
  $('pcw-ttxt').textContent = item.s ? fmt(item.s) : ''; $('pcw-fill').style.transform = 'scaleX(1)';
  $('pcw-tstart').textContent = 'Start'; $('pcw-tstart').hidden = false;
  var left = g.skips[p];
  $('pcw-skip').hidden = kind === 'k';
  $('pcw-skip').innerHTML = left > 0 ? 'Pomiń <em>' + left + '</em>' : 'Pomiń (kara)';
  $('pcw-done').textContent = kind === 'p' ? 'Powiedziane' : 'Zrobione';
  vib(25);
}
function pcwPick(kind) {
  var g = PC.g, it = pcwPool(kind, g.player, pcwLvl(g));
  if (!it) { toast('Brak kart'); return; }
  pcwShow(kind, it);
}
$('pcw-t').onclick = function () { pcwPick('p'); };
$('pcw-d').onclick = function () { pcwPick('w'); };
$('pcw-r2').onclick = function () { pcwPick(Math.random() < 0.5 ? 'p' : 'w'); };
$('pcw-tstart').onclick = function () {
  var it = PC.g.cur.item, left = it.s, total = it.s;
  stopP(); $('pcw-tstart').hidden = true;
  var upd = function () { $('pcw-fill').style.transform = 'scaleX(' + (left / total) + ')'; $('pcw-ttxt').textContent = left > 0 ? fmt(left) : 'Koniec czasu'; };
  upd();
  ptm = setInterval(function () { left--; upd(); if (left <= 0) { stopP(); beep(); vib([200, 100, 200]); } }, 1000);
};
function pcwNext() {
  var g = PC.g; stopP();
  g.turn++; g.player = 1 - g.player; pcwTurn();
}
$('pcw-done').onclick = pcwNext;
$('pcw-skip').onclick = function () {
  var g = PC.g, p = g.player;
  if (g.skips[p] > 0) { g.skips[p]--; pcwNext(); return; }
  var lvl = pcwLvl(g);
  var pool = DATA.pcw.k.filter(function (x) { return x.l <= lvl && x.l >= Math.max(2, lvl - 1) && !dVeto(x.g); });
  if (!pool.length) pool = DATA.pcw.k.filter(function (x) { return x.l <= lvl && !dVeto(x.g); });
  if (!pool.length) { pcwNext(); return; }
  pcwShow('k', pickOne(pool));
};
$('pcw-end').onclick = function () { if (confirm('Zakończyć grę?')) { stopP(); PC.g = null; show('choose'); } };

/* ---------- fantazje ---------- */
var FS = { pi: 0, v: [{}, {}] };
function fantStart(pi) {
  FS.pi = pi;
  $('fsel-hd').textContent = 'Fantazje: ' + S.names[pi];
  var h = '';
  DATA.fant.forEach(function (f) {
    h += '<div class="row" data-k="' + f.id + '"><span class="t">' + esc(f.t) + '<small>' + esc(f.z) + '</small></span><div class="tri">' +
      '<button data-v="tak">Tak</button><button data-v="moze">Może</button><button data-v="nie">Nie</button></div></div>';
    if (!FS.v[pi][f.id]) FS.v[pi][f.id] = 'nie';
  });
  $('fsel-rows').innerHTML = h;
  fSyncRows();
  document.body.setAttribute('data-role', pi === 0 ? 'm' : 'f');
  show('fsel'); document.body.setAttribute('data-level', 3);
}
function fSyncRows() {
  qa('#fsel-rows .row').forEach(function (r) {
    var v = FS.v[FS.pi][r.getAttribute('data-k')];
    qa('button', r).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
  });
}
$('fsel-rows').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  FS.v[FS.pi][b.closest('.row').getAttribute('data-k')] = b.getAttribute('data-v'); fSyncRows();
};
$('go-fant').onclick = function () { FS = { pi: 0, v: [{}, {}] }; fantStart(0); };
$('btn-fsel-done').onclick = function () {
  if (FS.pi === 0) {
    $('fhand-name').textContent = S.names[1];
    document.body.setAttribute('data-role', 'f');
    show('fhand');
  } else fReveal();
};
$('btn-fhand-go').onclick = function () { fantStart(1); };
var FR = { seen: [], cur: -1 };
function fTier(f) {
  var a = FS.v[0][f.id], b = FS.v[1][f.id];
  if (a === 'nie' || b === 'nie') return 0;
  if (a === 'tak' && b === 'tak') return 3;
  if (a === 'tak' || b === 'tak') return 2;
  return 1;
}
function fReveal() {
  FR = { seen: [], cur: -1 };
  var all = DATA.fant.filter(function (f) { return fTier(f) > 0; });
  var t3 = all.filter(function (f) { return fTier(f) === 3; }).length;
  var t2 = all.filter(function (f) { return fTier(f) === 2; }).length;
  var t1 = all.length - t3 - t2;
  $('fr-sum').textContent = all.length ? ('Oboje chcecie: ' + t3 + '. Jedno chce, drugie się waha: ' + t2 + '. Oboje „może”: ' + t1 + '.') : 'Nie macie wspólnych fantazji. Wróćcie, zmieńcie odpowiedzi albo zagrajcie w coś innego.';
  $('fr-card').hidden = true;
  $('btn-fdraw').hidden = !all.length;
  var h = '';
  all.sort(function (a, b) { return fTier(b) - fTier(a); }).forEach(function (f) {
    var t = fTier(f);
    h += '<button data-i="' + f.id + '"><span>' + esc(f.t) + '</span><em>' + (t === 3 ? 'oboje tak' : t === 2 ? 'ktoś bardzo chce' : 'może') + '</em></button>';
  });
  $('fr-list').innerHTML = h; $('fr-lab').hidden = !all.length;
  document.body.setAttribute('data-role', 'f');
  show('freveal'); document.body.setAttribute('data-level', 4);
}
function fShow(id) {
  var f = DATA.fant[id]; if (!f) return;
  FR.cur = id;
  $('fr-name').textContent = f.t;
  var fl = ''; for (var i = 0; i < 5; i++) fl += '<i class="' + (i < f.l ? 'on' : '') + '"></i>';
  $('fr-heat').innerHTML = fl;
  $('fr-z').textContent = f.z;
  $('fr-on-l').textContent = S.names[0] + ' (on)'; $('fr-ona-l').textContent = S.names[1] + ' (ona)';
  $('fr-on').textContent = f.on; $('fr-ona').textContent = f.ona;
  $('fr-say').textContent = f.say;
  $('fr-st').innerHTML = f.st.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
  $('fr-fin').textContent = f.fin;
  $('fr-card').hidden = false;
  document.body.setAttribute('data-level', f.l);
  try { $('fr-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
}
$('btn-fdraw').onclick = function () {
  var all = DATA.fant.filter(function (f) { return fTier(f) > 0; });
  var fresh = all.filter(function (f) { return FR.seen.indexOf(f.id) < 0; });
  if (!fresh.length) { FR.seen = []; fresh = all.filter(function (f) { return f.id !== FR.cur; }); if (!fresh.length) fresh = all; }
  var top = Math.max.apply(null, fresh.map(fTier));
  var pool = fresh.filter(function (f) { return fTier(f) === top; });
  var f = pickOne(pool); FR.seen.push(f.id); vib(20); fShow(f.id);
};
$('fr-list').onclick = function (e) { var b = e.target.closest('button'); if (b) fShow(+b.getAttribute('data-i')); };

/* ---------- kamasutra ---------- */
var KM = { cat: '', cur: -1, seen: [] };
function kList() {
  return DATA.kama.filter(function (k) { return !dVeto(k.g) && (!KM.cat || k.c === KM.cat); });
}
function kCats() {
  var cs = [], seen = {};
  DATA.kama.forEach(function (k) { if (!dVeto(k.g) && !seen[k.c]) { seen[k.c] = 1; cs.push(k.c); } });
  var h = '<button data-c="" class="' + (!KM.cat ? 'on' : '') + '">Wszystkie</button>';
  cs.forEach(function (c) { h += '<button data-c="' + esc(c) + '" class="' + (KM.cat === c ? 'on' : '') + '">' + esc(c) + '</button>'; });
  $('k-cats').innerHTML = h;
}
function kShow(id) {
  var k = DATA.kama[id]; if (!k) return;
  KM.cur = id;
  $('k-fig').innerHTML = DATA.kamaSvg[k.p];
  $('k-name').textContent = k.n;
  var fl = ''; for (var i = 0; i < 5; i++) fl += '<i class="' + (i < k.l ? 'on' : '') + '"></i>';
  $('k-heat').innerHTML = fl;
  $('k-d').textContent = k.d; $('k-t').textContent = k.t;
  $('k-card').hidden = false;
  document.body.setAttribute('data-level', k.l);
  qa('#k-list button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-i') === id); });
}
function kBuild() {
  kCats();
  var h = '';
  kList().forEach(function (k) {
    h += '<button data-i="' + k.id + '" class="' + (KM.cur === k.id ? 'on' : '') + '"><span>' + esc(k.n) + '</span><em>' + esc(k.c) + '</em></button>';
  });
  $('k-list').innerHTML = h;
}
function kDraw() {
  var l = kList(); if (!l.length) return;
  var pool = l.filter(function (k) { return KM.seen.indexOf(k.id) < 0 && k.id !== KM.cur; });
  if (!pool.length) { KM.seen = []; pool = l.filter(function (k) { return k.id !== KM.cur; }); if (!pool.length) pool = l; }
  var k = pickOne(pool);
  KM.seen.push(k.id); vib(20);
  kShow(k.id);
  var el = $('k-card'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
}
$('go-kama').onclick = function () {
  KM.cat = ''; KM.cur = -1; KM.seen = [];
  document.body.setAttribute('data-role', 'f');
  $('k-card').hidden = true;
  show('kama'); document.body.setAttribute('data-level', 3);
  kBuild();
};
$('k-cats').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  KM.cat = b.getAttribute('data-c'); KM.cur = -1; $('k-card').hidden = true; kBuild();
};
$('k-list').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  kShow(+b.getAttribute('data-i'));
  try { $('k-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {}
};
$('btn-kdraw').onclick = kDraw;

/* ---------- kostki (osobna gra) ---------- */
var DI = DATA.dice;
var D = { lvl: 0, secs: 60, player: 0, n: 0, rolled: false, t: null };
function diceLvl() { return D.lvl > 0 ? D.lvl : Math.min(5, 1 + Math.floor(D.n / 4)); }
function dVeto(g) {
  if (!g || !S.prefs) return false;
  for (var i = 0; i < g.length; i++)
    if ((S.prefs[0] && S.prefs[0][g[i]] === 'nie') || (S.prefs[1] && S.prefs[1][g[i]] === 'nie')) return true;
  return false;
}
function wpick(list, lvl, minOf) {
  var tot = 0, ws = list.map(function (x) { var w = lvl > 2 ? (minOf(x) >= lvl - 1 ? 8 : (minOf(x) >= lvl - 2 ? 1.5 : 0.4)) : 1; tot += w; return w; });
  var r = Math.random() * tot;
  for (var i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function wayOk(w, part, verb, lvl) {
  if (w.min > lvl || dVeto(w.g)) return false;
  if (part.self && !w.self) return false;
  if (w.ex && new RegExp(w.ex).test(verb.t + ' ' + part.p)) return false;
  if (verb.once && (w.dur || w.req === 'hard' || w.req === 'deep' || w.req === 'throat' || w.req === 'back' || w.req === 'gen' || w.req === 'free+back')) return false;
  var r = w.req;
  if (r === 'eye') return !!part.eye;
  if (r === 'back') return !!part.back;
  if (r === 'gen') return !!part.gen && !part.self;
  if (r === 'hard') return !!verb.h;
  if (r === 'free') return !verb.m;
  if (r === 'deep') return !!verb.d && !part.self;
  if (r === 'throat') return !!part.throat;
  if (r === 'free+eye') return !verb.m && !!part.eye && !part.self;
  if (r === 'free+back') return !verb.m && !!part.back && !part.self;
  return true;
}
function diceRoll(player, lvl) {
  var role = player === 0 ? 'm' : 'f';
  var pairs = [];
  DI[role].parts.forEach(function (p) {
    if (dVeto(p.g)) return;
    p.v.forEach(function (v) {
      if (v.min > lvl || dVeto(v.g)) return;
      if (S.prefs && v.m && p.gen && ((S.prefs[0] && S.prefs[0].oral === 'nie') || (S.prefs[1] && S.prefs[1].oral === 'nie'))) return;
      pairs.push({ p: p, v: v });
    });
  });
  var cut = lvl > 2 ? (Math.random() < 0.12 ? lvl - 2 : lvl - 1) : 1;
  var hi = pairs.filter(function (x) { return x.v.min >= cut; });
  if (hi.length >= 6) pairs = hi;
  var pr = wpick(pairs, lvl, function (x) { return x.v.min; });
  var ways = DI.ways.filter(function (w) { return wayOk(w, pr.p, pr.v, lvl); });
  var w = wpick(ways, lvl, function (x) { return x.min; });
  var way = role === 'f' && w.wf ? w.wf : w.w;
  var noPlaces = S.prefs && ((S.prefs[0] && S.prefs[0].miejsca === 'nie') || (S.prefs[1] && S.prefs[1].miejsca === 'nie'));
  var places = DI.places.filter(function (x) { return !noPlaces || x.home; });
  var place = pickOne(places).w;
  return { verb: pr.v.t, part: pr.p.p, way: way, place: place };
}
function sentence(r) {
  var v = r.verb.charAt(0).toUpperCase() + r.verb.slice(1);
  var w = (/^(dopóki|aż|(nie )?\S+ąc\b)/.test(r.way) || r.part.indexOf(', ') >= 0) ? ', ' + r.way : ' ' + r.way;
  return v + ' ' + r.part + w + ', ' + r.place + '.';
}
function dStop() { clearInterval(D.t); D.t = null; }
var DNOTE = ['Zaczynacie łagodnie, co 4 rzuty robi się goręcej.', 'Lód', 'Iskra', 'Żar', 'Płomień', 'Zero zasad'];
function dSync() {
  qa('#dseg-lvl button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === D.lvl); });
  qa('#dseg-time button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === D.secs); });
  $('dnote-lvl').textContent = D.lvl === 0 ? DNOTE[0] : (D.lvl + '. ' + LV[D.lvl].name + ' - ' + LV[D.lvl].sub);
}
$('go-dice').onclick = function () {
  var s = store.get('dice'); if (s) { D.lvl = s.lvl; D.secs = s.secs; }
  $('dice-setup').hidden = false; $('dice-play').hidden = true; $('dice-back').hidden = false;
  document.body.setAttribute('data-role', 'm');
  show('dice'); document.body.setAttribute('data-level', 1);
  dSync();
};
$('dseg-lvl').onclick = function (e) { var b = e.target.closest('button'); if (b) { D.lvl = +b.getAttribute('data-v'); dSync(); } };
$('dseg-time').onclick = function (e) { var b = e.target.closest('button'); if (b) { D.secs = +b.getAttribute('data-v'); dSync(); } };
function dPlayer() {
  var role = D.player === 0 ? 'm' : 'f';
  document.body.setAttribute('data-role', role);
  document.body.setAttribute('data-level', diceLvl());
  $('dp-r').textContent = D.player === 0 ? 'on' : 'ona';
  $('dp-nm').textContent = S.names[D.player];
  $('dp-info').textContent = (D.lvl === 0 ? diceLvl() + '. ' + LV[diceLvl()].name + ' · ' : '') + 'Rzut ' + (D.n + 1);
}
function dReset() {
  dStop(); D.rolled = false;
  ['d0', 'd1', 'd2', 'd3'].forEach(function (id) { $(id).querySelector('b').textContent = '?'; });
  $('dice-say').textContent = 'Rzuć kostkami.';
  $('dtmr').hidden = true; $('dtmr-txt').textContent = '';
  $('btn-roll').textContent = 'Rzuć kostkami';
  dPlayer();
}
$('btn-dice-start').onclick = function () {
  try { store.set('dice', { lvl: D.lvl, secs: D.secs }); } catch (e) {}
  D.player = rnd(2); D.n = 0;
  $('dice-setup').hidden = true; $('dice-play').hidden = false; $('dice-back').hidden = true;
  dReset();
};
function dTimer() {
  if (!D.secs) return;
  var left = D.secs, total = D.secs;
  $('dtmr').hidden = false;
  var upd = function () { $('dtmr-fill').style.transform = 'scaleX(' + (left / total) + ')'; $('dtmr-txt').textContent = left > 0 ? fmt(left) : 'Czas minął. Zmiana.'; };
  upd();
  D.t = setInterval(function () { left--; upd(); if (left <= 0) { dStop(); beep(); vib([200, 100, 200]); } }, 1000);
}
var rolling = false;
function doRoll() {
  if (rolling) return; rolling = true;
  var lvl = diceLvl(), role = D.player === 0 ? 'm' : 'f';
  var r = diceRoll(D.player, lvl);
  var els = [$('d0'), $('d1'), $('d2'), $('d3')];
  var vals = [r.verb, r.part, r.way, r.place];
  var pools = [
    DI[role].parts.reduce(function (a, p) { return a.concat(p.v.filter(function (v) { return v.min <= lvl; }).map(function (v) { return v.t; })); }, []),
    DI[role].parts.map(function (p) { return p.p; }),
    DI.ways.filter(function (w) { return w.min <= lvl; }).map(function (w) { return w.w; }),
    DI.places.map(function (w) { return w.w; })
  ];
  $('dice-say').textContent = '…';
  els.forEach(function (d, i) {
    d.classList.add('roll');
    var n = 0, stop = 8 + i * 4;
    var iv = setInterval(function () {
      n++; d.querySelector('b').textContent = pickOne(pools[i]);
      if (n >= stop) {
        clearInterval(iv); d.classList.remove('roll'); d.querySelector('b').textContent = vals[i]; vib(15);
        if (i === 3) { rolling = false; $('dice-say').textContent = sentence(r); D.rolled = true; $('btn-roll').textContent = 'Dalej: ' + S.names[1 - D.player]; dTimer(); }
      }
    }, 70);
  });
}
$('btn-roll').onclick = function () {
  if (rolling) return;
  if (!D.rolled) { doRoll(); return; }
  D.player = 1 - D.player; D.n++; dReset();
};
$('dice-end').onclick = function () { dStop(); show('choose'); };

/* ---------- bony i ulubione ---------- */
function dateStr(t) { try { return new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } }
function renderBony() {
  var h = '';
  if (!S.bony.length) h = '<p class="empty">Nie macie jeszcze żadnego bonu.<br>Wpadają w talii jako karty „Bon”.</p>';
  S.bony.forEach(function (b, i) {
    h += '<div class="item' + (b.done ? ' done' : '') + '"><div class="who2 ' + (b.owner === 0 ? 'm' : 'f') + '">' + esc(b.name) + '</div><p class="tx">' + esc(b.text) + '</p>' +
      '<div class="ft"><span>' + esc(dateStr(b.date)) + '</span><div><button class="mini" data-b="done" data-i="' + i + '">' + (b.done ? 'Cofnij' : 'Zrealizowany') + '</button><button class="mini" data-b="del" data-i="' + i + '">Usuń</button></div></div></div>';
  });
  $('bony-list').innerHTML = h;
}
$('bony-list').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  var i = +b.getAttribute('data-i');
  if (b.getAttribute('data-b') === 'done') S.bony[i].done = !S.bony[i].done;
  else if (confirm('Usunąć ten bon?')) S.bony.splice(i, 1);
  save('bony'); renderBony();
};
function favHTML(id) {
  var c = BYID[id]; if (!c) return '';
  var t = c.f ? '<b style="color:var(--ember)">On:</b> ' + esc(c.m) + '<i><b style="color:var(--rose);font-style:normal">Ona:</b> ' + esc(c.f) + '</i>' : esc(c.m);
  return t;
}
function renderFav() {
  var h = '';
  var ids = S.fav.filter(function (id) { return BYID[id]; });
  if (!ids.length) h = '<p class="empty">Nic tu jeszcze nie ma.<br>Dotknij serca na karcie, żeby ją zapisać.</p>';
  ids.forEach(function (id) {
    h += '<div class="item"><p class="favtx">' + favHTML(id) + '</p><div class="ft" style="margin-top:10px"><span>' + esc(BYID[id].t) + '</span><div><button class="mini" data-f="' + id + '">Usuń</button></div></div></div>';
  });
  $('fav-list').innerHTML = h;
}
$('fav-list').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  var ix = S.fav.indexOf(b.getAttribute('data-f')); if (ix >= 0) S.fav.splice(ix, 1);
  save('fav'); renderFav();
};

/* ---------- koniec ---------- */
function endGame() {
  stopTimer();
  var mins = Math.max(1, Math.round((Date.now() - G.t0) / 60000));
  var cards = G.log.filter(function (l) { return l.k !== 'pen'; }).length;
  $('end-stats').innerHTML =
    '<div class="stat"><b>' + (G.length > 0 ? Math.min(G.turn, G.length) : G.turn) + '</b><span>kart</span></div>' +
    '<div class="stat"><b>' + mins + '</b><span>min</span></div>' +
    '<div class="stat"><b>' + (G.stat.skips + G.stat.pens) + '</b><span>pominięć</span></div>' +
    '<div class="stat"><b>' + G.stat.hot + '</b><span>gorących</span></div>' +
    '<div class="stat"><b>' + G.stat.pens + '</b><span>kar</span></div>' +
    '<div class="stat"><b>' + G.stat.bony + '</b><span>bonów</span></div>';
  var seen = {}; G.log.forEach(function (l) { seen[l.id] = 1; });
  var favs = S.fav.filter(function (id) { return seen[id]; });
  var fh = '';
  if (favs.length) {
    fh = '<span class="lab">Do powtórki</span>';
    favs.slice(0, 6).forEach(function (id) { fh += '<div class="item"><p class="favtx">' + favHTML(id) + '</p></div>'; });
  }
  $('end-favs').innerHTML = fh;
  G.over = true; G.ended = true; save('game');
  document.body.setAttribute('data-role', 'f');
  show('end');
}
$('btn-again').onclick = function () { openSetup(); };
$('btn-end-home').onclick = function () { S.game = null; G = null; save('game'); show('home'); };

/* ---------- start ---------- */
if (G && G.ended) { S.game = null; G = null; save('game'); }
show('home');

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (nw) nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Jest nowa wersja. Zamknij i otwórz aplikację ponownie.');
        });
      });
    }).catch(function () {});
  });
}

/* ---------- wspólne: STOP, liczniki ---------- */
var PAUSED = false, ACTG = '';
function setPause(on) { PAUSED = on; $('stop-ov').hidden = !on; }
$('stop-btn').onclick = function () { setPause(true); vib(60); };
$('stop-go').onclick = function () { setPause(false); };
$('stop-quit').onclick = function () { setPause(false); if (ACTG === 'kon') konEnd(); else if (ACTG === 'lic') licEnd(); else show('choose'); };
function gend(title, lines) {
  $('gend-t').textContent = title;
  $('gend-l').innerHTML = lines.map(function (l) { return '<p class="pcw-tx">' + esc(l) + '</p>'; }).join('');
  document.body.setAttribute('data-role', 'm'); show('gend'); document.body.setAttribute('data-level', 4);
}
function segSet(id, val) { qa('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === String(val)); }); }
function segOn(id, fn) { $(id).onclick = function (e) { var b = e.target.closest('button'); if (b) fn(b.getAttribute('data-v')); }; }
function vetoAny(g) { return dVeto(g); }

/* ---------- Licytacja ciała ---------- */
var LI = null, LN = 12, lt = null;
function licStop() { clearInterval(lt); lt = null; }
$('go-licyt').onclick = function () {
  document.body.setAttribute('data-role', 'm'); show('licset'); document.body.setAttribute('data-level', 1);
  segSet('lseg-n', LN);
};
segOn('lseg-n', function (v) { LN = +v; segSet('lseg-n', LN); });
$('btn-lic-start').onclick = function () {
  ACTG = 'lic';
  LI = { n: LN, r: 0, tok: [20, 20], bid: [0, 0], tot: [0, 0], dem: [0, 0], perf: [0, 0], used: {}, pi: 0, trap: false, card: null, lvl: 1, tie: 0 };
  licRound();
};
function licLvl() { return LI.r >= LI.n ? 5 : Math.min(5, 1 + Math.floor((LI.r - 1) * 5 / LI.n)); }
function licRound() {
  LI.r++;
  var fin = LI.r === LI.n, lvl = licLvl(), c = null, pool;
  LI.lvl = lvl;
  if (fin) pool = DATA.lic.f.filter(function (x) { return !vetoAny(x.g); });
  else {
    pool = DATA.lic.c.filter(function (x, i) { return x.l === lvl && !LI.used[i] && !vetoAny(x.g); });
    if (!pool.length) pool = DATA.lic.c.filter(function (x, i) { return x.l >= lvl - 1 && x.l <= lvl && !vetoAny(x.g); });
  }
  if (!pool.length) pool = DATA.lic.c.filter(function (x) { return !vetoAny(x.g); });
  if (!pool.length) pool = DATA.lic.c;
  c = pickOne(pool); if (!fin) LI.used[DATA.lic.c.indexOf(c)] = 1;
  LI.card = c;
  LI.trap = !fin && LI.r >= 3 && /^Ona\s/.test(c.m) && /^On\s/.test(c.f) && Math.random() < 0.3;
  $('lic-lvl').textContent = lvl + '. ' + LV[lvl].name;
  $('lic-rd').textContent = (fin ? 'Finał' : 'Runda ' + LI.r + ' z ' + LI.n);
  $('lic-m').textContent = c.m; $('lic-f').textContent = c.f;
  $('lic-kind').textContent = fin ? 'Nagroda finałowa' : 'Nagroda';
  LI.bid = [0, 0]; LI.pi = 0;
  show('lic'); licBid();
}
function licBid() {
  var pi = LI.pi, role = pi === 0 ? 'm' : 'f';
  document.body.setAttribute('data-role', role); document.body.setAttribute('data-level', LI.lvl);
  $('lic-r').textContent = pi === 0 ? 'on' : 'ona'; $('lic-nm').textContent = S.names[pi];
  $('lic-card').hidden = false; $('lic-bid').hidden = false; $('lic-res').hidden = true;
  $('lic-tok').textContent = 'Twoje żetony: ' + LI.tok[pi];
  $('lic-ask').textContent = 'Ile żetonów dajesz za tę nagrodę? Druga osoba nie może patrzeć.';
  LI.val = 0; $('lic-val').textContent = 0;
}
$('lic-plus').onclick = function () { if (LI.val < LI.tok[LI.pi]) { LI.val++; $('lic-val').textContent = LI.val; vib(8); } };
$('lic-minus').onclick = function () { if (LI.val > 0) { LI.val--; $('lic-val').textContent = LI.val; vib(8); } };
$('lic-ok').onclick = function () {
  LI.bid[LI.pi] = LI.val;
  if (LI.pi === 0) {
    LI.pi = 1; $('lhand-name').textContent = S.names[1];
    document.body.setAttribute('data-role', 'f'); show('lhand'); document.body.setAttribute('data-level', LI.lvl);
  } else licResolve();
};
$('btn-lhand-go').onclick = function () { show('lic'); licBid(); };
function licResolve() {
  var b = LI.bid, c = LI.card, out, sec = c.s || 0;
  LI.tot[0] += b[0]; LI.tot[1] += b[1];
  $('lic-card').hidden = true; $('lic-bid').hidden = true; $('lic-res').hidden = false;
  $('lic-tok').textContent = '';
  document.body.setAttribute('data-role', 'm');
  if (b[0] === b[1]) {
    var tl = DATA.lic.t.filter(function (t) { return t.l === LI.lvl && !vetoAny(t.g); });
    var t = tl.length ? pickOne(tl) : DATA.lic.t[0];
    out = 'Remis, ' + b[0] + ' do ' + b[1] + '. Żetony wracają do was. ' + t.t;
    LI.tie++; sec = 0;
  } else {
    var w = b[0] > b[1] ? 0 : 1, l = 1 - w, bw = b[w];
    LI.tok[w] -= bw; LI.tok[l] += bw;
    document.body.setAttribute('data-role', w === 0 ? 'm' : 'f');
    if (LI.trap) {
      var txt = l === 0 ? c.m : c.f;
      out = 'PUŁAPKA! ' + S.names[w] + ' wygrywa licytację (' + b[w] + ' do ' + b[l] + '), ale karta jest odwrócona. ' + S.names[w] + ' musi to wykonać dla ' + (l === 0 ? 'partnera' : 'partnerki') + ': ' + txt;
      LI.perf[w]++;
    } else {
      out = S.names[w] + ' wygrywa licytację (' + b[w] + ' do ' + b[l] + ') i rozkazuje: ' + (w === 0 ? c.m : c.f);
      LI.dem[w]++; LI.perf[l]++;
    }
    out += '\n\nŻetony: ' + S.names[0] + ' ' + LI.tok[0] + ', ' + S.names[1] + ' ' + LI.tok[1] + '.';
  }
  $('lic-out').style.whiteSpace = 'pre-line';
  $('lic-out').textContent = out;
  licStop(); $('lic-tm').hidden = !sec; LI.sec = sec;
  $('lic-fill').style.transition = 'none'; $('lic-fill').style.transform = 'scaleX(1)';
  $('lic-ttxt').textContent = sec ? fmt(sec) : ''; $('lic-tstart').hidden = !sec;
  $('lic-next').textContent = LI.r >= LI.n ? 'Zobacz wyniki' : 'Zrobione, dalej';
  vib([40, 40, 80]);
}
$('lic-tstart').onclick = function () {
  var left = LI.sec; $('lic-tstart').hidden = true; licStop();
  $('lic-fill').style.transition = 'none'; $('lic-fill').style.transform = 'scaleX(1)';
  void $('lic-fill').offsetWidth; $('lic-fill').style.transition = 'transform 1s linear';
  lt = setInterval(function () {
    if (PAUSED) return;
    left--; $('lic-ttxt').textContent = fmt(Math.max(0, left));
    $('lic-fill').style.transform = 'scaleX(' + Math.max(0, left / LI.sec) + ')';
    if (left <= 0) { licStop(); beep(); vib([200, 100, 200]); }
  }, 1000);
};
$('lic-next').onclick = function () { licStop(); if (LI.r >= LI.n) licEnd(); else licRound(); };
$('lic-end').onclick = function () { if (confirm('Zakończyć grę?')) licEnd(); };
function licEnd() {
  licStop(); var L = LI; if (!L) { show('choose'); return; } LI = null;
  var n = S.names, lines = [];
  lines.push('Żetony na koniec: ' + n[0] + ' ' + L.tok[0] + ', ' + n[1] + ' ' + L.tok[1] + '.');
  lines.push('Wygrane licytacje z rozkazem: ' + n[0] + ' ' + L.dem[0] + ', ' + n[1] + ' ' + L.dem[1] + '.');
  lines.push('Wykonane polecenia: ' + n[0] + ' ' + L.perf[0] + ', ' + n[1] + ' ' + L.perf[1] + '.');
  lines.push('Suma ofert: ' + n[0] + ' ' + L.tot[0] + ', ' + n[1] + ' ' + L.tot[1] + '. ' + (L.tot[0] === L.tot[1] ? 'Pod tym względem remis.' : 'Bardziej chciwa była osoba: ' + n[L.tot[0] > L.tot[1] ? 0 : 1] + '.'));
  if (L.tie) lines.push('Remisów: ' + L.tie + '.');
  gend('Koniec licytacji', lines);
}

/* ---------- Kontrola ---------- */
var KN = null, KC = { who: 'r', sw: 15, lvl: 0 }, kt = null;
$('go-kon').onclick = function () {
  document.body.setAttribute('data-role', 'm'); show('konset'); document.body.setAttribute('data-level', 1);
  segSet('kseg-who', KC.who); segSet('kseg-sw', KC.sw); segSet('kseg-lvl', KC.lvl);
};
segOn('kseg-who', function (v) { KC.who = v; segSet('kseg-who', v); });
segOn('kseg-sw', function (v) { KC.sw = +v; segSet('kseg-sw', v); });
segOn('kseg-lvl', function (v) { KC.lvl = +v; segSet('kseg-lvl', v); });
$('btn-kon-start').onclick = function () {
  ACTG = 'kon';
  KN = { ctl: KC.who === 'r' ? rnd(2) : +KC.who, sw: KC.sw, lv: KC.lvl, act: 0, swc: 0, rounds: 0, base: 0, meter: 3, bans: 3, used: {}, ord: null, left: 0, ban: null,
    st: [{ ok: 0, bad: 0, late: 0, perm: 0, pun: 0 }, { ok: 0, bad: 0, late: 0, perm: 0, pun: 0 }], opts: [] };
  clearInterval(kt); kt = setInterval(kTick, 1000);
  kShowPick();
};
function kLvl() { return KN.lv ? KN.lv : Math.min(5, 1 + Math.floor(KN.rounds / 5)); }
function kTitle(i) { return i === 0 ? 'Pan' : 'Pani'; }
function kHead() {
  var c = KN.ctl, o = 1 - c, lvl = kLvl();
  document.body.setAttribute('data-role', c === 0 ? 'm' : 'f'); document.body.setAttribute('data-level', lvl);
  $('kon-lvl').textContent = lvl + '. ' + LV[lvl].name;
  $('kon-roles').textContent = 'Władca: ' + S.names[c] + ' (' + kTitle(c) + ') · Posłuszny: ' + S.names[o];
  var h = ''; for (var i = 1; i <= 10; i++) h += '<i class="' + (i <= KN.meter ? 'on' : '') + '"></i>';
  $('kon-meter').innerHTML = h;
  kBanTxt();
}
function kBanTxt() {
  var b = KN.ban;
  $('kon-ban').className = 'note' + (b ? ' live' : '');
  $('kon-ban').textContent = b ? 'ZAKAZ: ' + b.t + ' (' + b.left + ' s)' : 'Żetony zakazu Władcy: ' + KN.bans;
}
function kOpts() {
  var key = KN.ctl === 0 ? 'f' : 'm', lvl = kLvl();
  var ok = function (lo) { return DATA.kon.o.filter(function (x, i) { return x.l >= lo && x.l <= lvl && !KN.used[i] && !vetoAny(x.g); }); };
  var pool = ok(lvl);
  if (pool.length < 3) pool = ok(Math.max(1, lvl - 1));
  if (pool.length < 3) pool = ok(1);
  if (pool.length < 1) { KN.used = {}; pool = ok(1); }
  if (!pool.length) pool = DATA.kon.o;
  var out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(rnd(pool.length), 1)[0]);
  return out.map(function (o) { return { o: o, tx: o[key], i: DATA.kon.o.indexOf(o) }; });
}
function kShowPick() {
  if (KN.sw && KN.act >= KN.sw * 60 * (KN.swc + 1)) {
    KN.swc++; KN.ctl = 1 - KN.ctl; KN.meter = 3; KN.base = KN.rounds; KN.bans = 3; KN.ban = null;
    $('kswap-name').textContent = S.names[KN.ctl];
    document.body.setAttribute('data-role', KN.ctl === 0 ? 'm' : 'f'); show('kswap'); return;
  }
  show('kon'); kHead();
  KN.opts = kOpts();
  $('kon-pick').hidden = false; $('kon-ord').hidden = true;
  $('kon-pickask').textContent = S.names[KN.ctl] + ', wybierz rozkaz dla ' + (KN.ctl === 0 ? 'partnerki' : 'partnera') + '.';
  $('kon-opts').innerHTML = KN.opts.map(function (x, i) {
    return '<button data-i="' + i + '">' + esc(x.tx) + '<br><small style="opacity:.65">' + fmt(x.o.s) + '</small></button>';
  }).join('');
}
$('btn-kswap-go').onclick = function () { kShowPick(); };
$('kon-opts').onclick = function (e) { var b = e.target.closest('button'); if (b) kOrder(KN.opts[+b.getAttribute('data-i')], 'Rozkaz'); };
$('kon-rand').onclick = function () { kOrder(pickOne(KN.opts), 'Rozkaz'); };
function kPanel(kind, tx, sec, judge) {
  $('kon-pick').hidden = true; $('kon-ord').hidden = false;
  $('kon-kind').textContent = kind; $('kon-tx').textContent = tx;
  $('kon-judge').hidden = !judge; $('kon-tools').hidden = !judge; $('kon-ok').hidden = judge;
  $('kon-tm').hidden = !sec; KN.sec = sec; KN.left = sec; KN.run = !!sec;
  $('kon-fill').style.transition = 'none'; $('kon-fill').style.transform = 'scaleX(1)';
  void $('kon-fill').offsetWidth; $('kon-fill').style.transition = 'transform 1s linear';
  $('kon-ttxt').textContent = sec ? fmt(sec) : '';
  var bl = $('kon-banlist'); if (bl) bl.remove();
}
function kOrder(x, kind) {
  KN.used[x.i] = 1; KN.cur = x; vib(30);
  kPanel(kind, x.tx, x.o.s, true); kHead();
}
function kTick() {
  if (!KN || PAUSED || cur !== 'kon') return;
  KN.act++;
  if (KN.run && KN.left > 0) {
    KN.left--; $('kon-ttxt').textContent = fmt(KN.left);
    $('kon-fill').style.transform = 'scaleX(' + (KN.left / KN.sec) + ')';
    if (KN.left <= 0) { KN.run = false; beep(); vib([200, 100, 200]); }
  }
  if (KN.ban) { KN.ban.left--; if (KN.ban.left <= 0) { KN.ban = null; vib(80); } kBanTxt(); }
}
function kJudge(kind) {
  var o = 1 - KN.ctl, st = KN.st[o], d = 0;
  if (kind === 'good') { var fast = KN.sec && (KN.sec - KN.left) < KN.sec * 0.6; d = fast ? 2 : 1; st.ok++; }
  else if (kind === 'late') { d = 0; st.late++; }
  else { d = -2; st.bad++; }
  KN.meter = Math.max(0, Math.min(10, KN.meter + d)); KN.rounds++;
  if (KN.meter >= 10 && KN.rounds - KN.base < 7) KN.meter = 9; KN.run = false; KN.ban = null;
  if (KN.meter >= 10) {
    var p = pickOne(DATA.kon.p), key = KN.ctl === 0 ? 'f' : 'm';
    kPanel('Pozwolenie na orgazm', p[key], 0, false); kHead(); KN.after = 'perm'; vib([60, 60, 120]);
  } else if (KN.meter <= 0) {
    var k = pickOne(DATA.kon.k), key2 = KN.ctl === 0 ? 'f' : 'm';
    kPanel('Kara', k[key2], k.s, false); kHead(); KN.after = 'pun'; vib([200, 80, 200]);
  } else kShowPick();
}
$('kon-good').onclick = function () { kJudge('good'); };
$('kon-late').onclick = function () { kJudge('late'); };
$('kon-bad').onclick = function () { kJudge('bad'); };
$('kon-ok').onclick = function () {
  var o = 1 - KN.ctl;
  if (KN.after === 'perm') { KN.st[o].perm++; KN.meter = 3; KN.base = KN.rounds; } else { KN.st[o].pun++; KN.meter = 2; }
  KN.after = ''; kShowPick();
};
$('kon-banb').onclick = function () {
  if (KN.ban) { toast('Zakaz już trwa.'); return; }
  if (KN.bans <= 0) { toast('Brak żetonów zakazu.'); return; }
  var bl = $('kon-banlist'); if (bl) { bl.remove(); return; }
  bl = document.createElement('div'); bl.id = 'kon-banlist'; bl.className = 'stack tight';
  bl.innerHTML = DATA.kon.b.map(function (b, i) { return '<button class="chip" data-b="' + i + '">' + esc(b.t) + ' (' + b.s + ' s)</button>'; }).join('');
  $('kon-ord').appendChild(bl);
  bl.onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var d = DATA.kon.b[+b.getAttribute('data-b')];
    KN.bans--; KN.ban = { t: d.t + ' – ' + d.d, left: d.s }; bl.remove(); kBanTxt(); vib(60);
  };
};
$('kon-end').onclick = function () { if (confirm('Zakończyć grę?')) konEnd(); };
function konEnd() {
  clearInterval(kt); kt = null; var K = KN; if (!K) { show('choose'); return; } KN = null;
  var n = S.names, lines = [];
  lines.push('Czas gry: ' + Math.floor(K.act / 60) + ' min. Wykonanych rozkazów: ' + K.rounds + '.');
  [0, 1].forEach(function (i) {
    var s = K.st[i];
    lines.push(n[i] + ' w roli Posłusznego: dobrze ' + s.ok + ', spóźnione ' + s.late + ', niewykonane ' + s.bad + ', pozwolenia na orgazm ' + s.perm + ', kary ' + s.pun + '.');
  });
  gend('Koniec kontroli', lines);
}

var INTRO = {
  'go-cards': ['Karty', 'Talia zadań, która z każdą kartą robi się gorętsza.', [
    '<b>Jak grać:</b> telefon przechodzi z rąk do rąk. Dociągacie kartę i robicie dokładnie to, co jest na niej napisane, dla osoby, której dotyczy.',
    '<b>Temperatura:</b> przed grą wybieracie, czy temperatura rośnie sama, czy wybieracie poziom, czy losujecie. Ustawiacie też długość gry.',
    '<b>Pominięcia:</b> każde ma limit pominięć. Po jego wyczerpaniu kolejne pominięcie kosztuje karę. Słowo bezpieczeństwa zatrzymuje wszystko.']],
  'go-kama': ['Kamasutra', 'Pozycje z rysunkiem, krótkim opisem i wskazówką.', [
    '<b>Jak grać:</b> losujcie pozycję albo przeglądajcie je według kategorii. Każda ma rysunek i opis, kto i co robi.',
    '<b>Lista:</b> pod losowaniem jest lista wszystkich pozycji, a kategorie pozwalają zawęzić wybór.',
    '<b>Zasada:</b> próbujecie tylko tego, na co oboje macie ochotę. Nie pasuje? Losujcie następną.']],
  'go-pcw': ['Prawda czy Wyzwanie', 'Klasyk w ostrej wersji: wyznanie albo zadanie.', [
    '<b>Jak grać:</b> na zmianę wybieracie Prawdę (szczere wyznanie) albo Wyzwanie (zadanie do wykonania od razu).',
    '<b>Poziomy:</b> pytania i zadania robią się coraz bardziej intymne i brudne.',
    '<b>Pominięcia:</b> po wyczerpaniu limitu pominięć odmowa kończy się karą.']],
  'go-fant': ['Fantazje', 'Tajne wybory, a potem scenariusze tylko z tego, co kręci oboje.', [
    '<b>Krok 1:</b> każde osobno i w tajemnicy zaznacza fantazje, które go kręcą. Drugie nie patrzy.',
    '<b>Krok 2:</b> aplikacja odkrywa tylko te wybrane przez oboje. Nikt nie dowie się o tym, czego drugie nie chciało.',
    '<b>Krok 3:</b> wspólne fantazje zamieniają się w scenariusze, które odgrywacie krok po kroku.']],
  'go-licyt': ['Licytacja ciała', 'Tajne oferty żetonami o prawo do rozkazywania.', [
    '<b>Start:</b> każde dostaje 20 żetonów. W każdej rundzie jest nagroda.',
    '<b>Licytacja:</b> po kolei, w tajemnicy, wpisujecie ofertę na jednym telefonie. Kto da więcej, wygrywa i rozkazuje drugiemu.',
    '<b>Płatność:</b> zwycięzca płaci swoją ofertę, a przegrany dostaje ją jako rekompensatę. Remis oddaje żetony.',
    '<b>Uwaga:</b> czasem nagroda jest pułapką. Na koniec wygrywa ten, kto zebrał więcej żetonów, a finał to karta specjalna.']],
  'go-kon': ['Kontrola', 'Jedno rozkazuje, drugie posłusznie wykonuje.', [
    '<b>Role:</b> Władca wybiera rozkaz spośród trzech propozycji albo losuje. Posłuszny wykonuje go w wyznaczonym czasie.',
    '<b>Ocena:</b> Władca ocenia wykonanie: dobrze, spóźnione albo źle. Szybkie i dobre wykonanie daje najwięcej punktów, złe odejmuje.',
    '<b>Miernik:</b> gdy dojdzie do pełna, Posłuszny zasługuje na pozwolenie na orgazm. Gdy spadnie do zera, czeka go kara.',
    '<b>Zakazy i zmiana:</b> Władca ma 3 zakazy po 30 sekund, a po kilkunastu minutach role się zamieniają. Przycisk STOP zatrzymuje wszystko.']],
  'go-dice': ['Kostki', 'Cztery kostki, jedno zadanie i czas.', [
    '<b>Jak grać:</b> rzucacie czterema kostkami. Z wyników składa się jedno zdanie: kto, co, gdzie i jak długo.',
    '<b>Zadanie:</b> wykonujecie je, dopóki nie skończy się czas na liczniku.',
    '<b>Ustawienia:</b> przed grą wybieracie temperaturę i czas na zadanie.']]
};
Object.keys(INTRO).forEach(function (id) {
  var orig = $(id).onclick, I = INTRO[id];
  $(id).onclick = function () {
    $('intro-t').textContent = I[0]; $('intro-w').textContent = I[1];
    $('intro-l').innerHTML = I[2].map(function (x) { return '<p>' + x + '</p>'; }).join('');
    $('intro-go').onclick = orig; show('intro');
  };
});
})();
