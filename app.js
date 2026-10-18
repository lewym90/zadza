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
  if (name === 'game') wake(); else if (name === 'home' || name === 'end') unwake();
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
document.addEventListener('visibilitychange', function () { if (!document.hidden && cur === 'game') wake(); });

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
  if (!S.prefs || CFG.repref) startPrefs(0); else startDraw();
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
  } else { startDraw(); }
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

/* ---------- kostki ---------- */
var DI = DATA.dice;
function diceRoll() {
  var role = G.player === 0 ? 'm' : 'f';
  var lvl = G.lvl;
  var parts = DI[role].parts.filter(function (p) { return p.min <= lvl; }).map(function (p) { return { p: p.p, v: p.v.slice(), min: p.min }; });
  var noOral = S.prefs && ((S.prefs[0] && S.prefs[0].oral === 'nie') || (S.prefs[1] && S.prefs[1].oral === 'nie'));
  var noSpank = S.prefs && ((S.prefs[0] && S.prefs[0].klapsy === 'nie') || (S.prefs[1] && S.prefs[1].klapsy === 'nie'));
  var noPlaces = S.prefs && ((S.prefs[0] && S.prefs[0].miejsca === 'nie') || (S.prefs[1] && S.prefs[1].miejsca === 'nie'));
  parts.forEach(function (p) {
    if (noOral && p.min >= 3) p.v = p.v.filter(function (v) { return !/liż|ssij|język|całuj|ustami/.test(v); });
    if (noSpank) p.v = p.v.filter(function (v) { return v !== 'klep'; });
  });
  parts = parts.filter(function (p) { return p.v.length; });
  var ways = DI.ways.filter(function (w) { return w.min <= lvl; }).map(function (w) { return role === 'f' && w.wf ? w.wf : w.w; });
  var places = DI.places.filter(function (w) { return !noPlaces || w.home; }).map(function (w) { return w.w; });
  var part = pickOne(parts), verb = pickOne(part.v), way = pickOne(ways), place = pickOne(places);
  return { verb: verb, part: part.p, way: way, place: place };
}
function sentence(r) {
  var v = r.verb.charAt(0).toUpperCase() + r.verb.slice(1);
  var w = /^(dopóki|patrząc)/.test(r.way) ? ', ' + r.way : ' ' + r.way;
  return v + ' ' + r.part + w + ', ' + r.place + '.';
}
var rolling = false;
function doRoll() {
  if (rolling) return; rolling = true;
  var r = diceRoll();
  var els = [$('d0'), $('d1'), $('d2'), $('d3')];
  var vals = [r.verb, r.part, r.way, r.place];
  var role = G.player === 0 ? 'm' : 'f';
  var pools = [
    DI[role].parts.reduce(function (a, p) { return a.concat(p.v); }, []),
    DI[role].parts.map(function (p) { return p.p; }),
    DI.ways.map(function (w) { return w.w; }),
    DI.places.map(function (w) { return w.w; })
  ];
  $('dice-say').textContent = '…';
  els.forEach(function (d, i) {
    d.classList.add('roll');
    var n = 0, stop = 8 + i * 4;
    var iv = setInterval(function () {
      n++; d.querySelector('b').textContent = pickOne(pools[i]);
      if (n >= stop) { clearInterval(iv); d.classList.remove('roll'); d.querySelector('b').textContent = vals[i]; vib(15); if (i === 3) { rolling = false; $('dice-say').textContent = sentence(r); } }
    }, 70);
  });
}
$('btn-dice').onclick = function () {
  $('dice-who').textContent = 'Kostki dla: ' + G.names[G.player];
  ['d0', 'd1', 'd2', 'd3'].forEach(function (id) { $(id).querySelector('b').textContent = '?'; });
  $('dice-say').textContent = 'Rzuć kostkami.';
  openSheet('sh-dice');
};
$('btn-roll').onclick = doRoll;

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
})();
