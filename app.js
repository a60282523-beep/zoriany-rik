(function () {
'use strict';
var D = window.ZR_DATA;
var KEY = window.ZR_DEMO ? 'zr2027demo' : 'zr2027';
var qs = new URLSearchParams(location.search);
var API = qs.get('api') || window.ZR_API || 'https://hometechua.com.ua/zr-api';
var PTS = { calm: 10, money: 15, conf: 20 };
var BR = { calm: 'Спокій', money: 'Стабільність', conf: 'Впевненість' };
var BOSS_HP = 15;
var MONTHS = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
var STAR = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z';

// ---------- state ----------
function blank() {
  return { v: 1, act: null, setup: null, days: {}, savings: [], joys: [], monthEnds: {}, bosses: {}, medals: {}, settings: { less: false }, final: null, tab: 'today', updated: 0 };
}
var S;
try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { S = blank(); }
if (!window.ZR_DEMO && S.act && !/^ZR-/.test(S.act.code || '')) { S.act = null; }
var syncTimer = null;
function save(noSync) {
  S.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  if (!noSync) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 2500); }
}

// ---------- dates ----------
function todayKey() {
  var o = qs.get('today');
  if (o && /^\d{4}-\d{2}-\d{2}$/.test(o)) { return o; }
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dnum(k) { var p = k.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
function dayIndex() { return S.setup ? Math.max(0, dnum(todayKey()) - dnum(S.setup.start)) : 0; }
function stageOf(di) { return Math.min(11, Math.floor(di / 30)); }
function stageInfo(s) { return D.stages[Math.min(s, D.stages.length - 1)]; }
function monthLabel(s) {
  var p = S.setup.start.split('-');
  var m = (+p[1] - 1 + s) % 12;
  return MONTHS[m];
}

// ---------- score ----------
function dayStars(d) {
  var t = 0;
  (d.done || []).forEach(function (id) { t += PTS[id.split(':')[0]] || 0; });
  if (d.hardDone) { t += 10; }
  if (d.own && d.own.done) { t += 15; }
  return t;
}
function totalStars() {
  var t = 0;
  Object.keys(S.days).forEach(function (k) { t += dayStars(S.days[k]); });
  t += Object.keys(S.monthEnds).length * 50;
  t += Object.keys(S.bosses).length * 50;
  return t;
}
function rankOf(st) { var r = 0; D.ranks.forEach(function (x, i) { if (st >= x.need) { r = i; } }); return r; }
function bossHits(s) {
  var hits = 0;
  Object.keys(S.days).forEach(function (k) {
    var di = dnum(k) - dnum(S.setup.start);
    if (stageOf(di) !== s || di < 0) { return; }
    var d = S.days[k];
    (d.done || []).forEach(function (id) { if (id.indexOf('calm:') === 0) { hits++; } });
    if (d.hardDone) { hits++; }
  });
  return Math.min(BOSS_HP, hits);
}
function countQuests() { var n = 0; Object.keys(S.days).forEach(function (k) { n += (S.days[k].done || []).length; }); return n; }
function savedTotal() { return S.savings.reduce(function (a, x) { return a + x.a; }, 0); }

function checkMedals() {
  var got = [];
  function g(id, cond) { if (cond && !S.medals[id]) { S.medals[id] = todayKey(); got.push(id); } }
  var q = countQuests(), days = Object.keys(S.days).filter(function (k) { return dayStars(S.days[k]) > 0; }).length;
  var st = totalStars(), r = rankOf(st), sv = savedTotal();
  g('first', q >= 1); g('q50', q >= 50); g('q200', q >= 200);
  g('d7', days >= 7); g('d30', days >= 30);
  g('hard', Object.keys(S.days).some(function (k) { return S.days[k].hardDone; }));
  g('boss', Object.keys(S.bosses).length >= 1); g('boss3', Object.keys(S.bosses).length >= 3);
  g('s100', sv >= 100); g('s1000', sv >= 1000); g('s5000', sv >= 5000);
  g('no', Object.keys(S.days).some(function (k) { return (S.days[k].doneText || []).some(function (t) { return t.indexOf('«ні»') >= 0; }); }));
  g('joy10', S.joys.length >= 10);
  g('own', Object.keys(S.days).some(function (k) { return S.days[k].own && S.days[k].own.done; }));
  g('month', Object.keys(S.monthEnds).length >= 1);
  g('r3', r >= 2); g('r5', r >= 4); g('r7', r >= 6);
  return got;
}
function checkBoss() {
  var s = stageOf(dayIndex());
  if (!S.bosses[s] && bossHits(s) >= BOSS_HP) { S.bosses[s] = todayKey(); return s; }
  return -1;
}

// ---------- today's quests ----------
function today() {
  var k = todayKey();
  if (!S.days[k]) { S.days[k] = { energy: 0, done: [], doneText: [] }; }
  return S.days[k];
}
function questsFor(energy) {
  var di = dayIndex(), s = stageOf(di), info = stageInfo(s), dis = di % 30;
  var seed = (dis * 7 + s * 3);
  var list = [];
  function pick(br, off) { var arr = info[br]; var i = (seed + off) % arr.length; list.push({ id: br + ':' + s + ':' + i, br: br, text: arr[i], pts: PTS[br] }); }
  if (energy >= 1) { pick('calm', 0); }
  if (energy === 2) { pick(dis % 2 ? 'money' : 'conf', 1); }
  if (energy >= 3) { pick('money', 1); pick('conf', 2); }
  return list;
}

// ---------- art ----------
function rng(seed) { var x = seed % 2147483647; if (x <= 0) { x += 2147483646; } return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
function drawSky(seed) {
  var r = rng(seed * 97 + 13), W = 390, H = 844, o = [];
  o.push('<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>');
  [['a', '#7B5CFF', .55], ['b', '#FF6FAE', .35], ['c', '#3FA9F5', .35]].forEach(function (n) {
    o.push('<radialGradient id="n' + n[0] + '"><stop offset="0" stop-color="' + n[1] + '" stop-opacity="' + n[2] + '"/><stop offset="1" stop-color="' + n[1] + '" stop-opacity="0"/></radialGradient>');
  });
  o.push('<radialGradient id="sg"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#FFF4D6" stop-opacity=".7"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient></defs>');
  ['a', 'b', 'c'].forEach(function (n) { o.push('<ellipse cx="' + (r() * W) + '" cy="' + (r() * H) + '" rx="' + (180 + r() * 60) + '" ry="' + (130 + r() * 60) + '" fill="url(#n' + n + ')"/>'); });
  var cols = ['#fff', '#fff', '#fff', '#DCD9FF', '#FFE7A3', '#BFE3FF'];
  for (var i = 0; i < 170; i++) { o.push('<circle cx="' + (r() * W).toFixed(1) + '" cy="' + (r() * H).toFixed(1) + '" r="' + [0.5, 0.7, 0.8, 1, 1, 1.2, 1.5][Math.floor(r() * 7)] + '" fill="' + cols[Math.floor(r() * 6)] + '" opacity="' + (0.35 + r() * 0.65).toFixed(2) + '"/>'); }
  for (i = 0; i < 6; i++) { var x = 15 + r() * 360, y = 15 + r() * 814, s = 7 + r() * 6; o.push('<circle cx="' + x + '" cy="' + y + '" r="' + s + '" fill="url(#sg)"/><path d="M' + x + ' ' + (y - s * 1.3) + 'V' + (y + s * 1.3) + 'M' + (x - s * 1.3) + ' ' + y + 'H' + (x + s * 1.3) + '" stroke="#fff" stroke-width=".6" opacity=".7"/>'); }
  o.push('</svg>');
  for (i = 0; i < 14; i++) { var sz = [3, 3, 4, 5][Math.floor(r() * 4)]; o.push('<div class="tw" style="left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;width:' + sz + 'px;height:' + sz + 'px;animation-duration:' + (1.8 + r() * 1.8).toFixed(1) + 's;animation-delay:' + (r() * 3).toFixed(1) + 's"></div>'); }
  document.getElementById('sky').innerHTML = o.join('');
}
function sunArt() {
  var cx = 195, cy = 175, o = ['<svg role="img" aria-label="Сонце з променями" viewBox="0 0 390 350" style="width:100%;max-width:390px;display:block;margin:0 auto"><defs>',
    '<radialGradient id="sc" cx=".4" cy=".38"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".45" stop-color="#FFD66B"/><stop offset="1" stop-color="#F29A2E"/></radialGradient>',
    '<radialGradient id="co"><stop offset="0" stop-color="#FFC94D" stop-opacity=".75"/><stop offset=".45" stop-color="#FF9A3C" stop-opacity=".28"/><stop offset="1" stop-color="#FF7A3C" stop-opacity="0"/></radialGradient>',
    '<linearGradient id="ry"><stop offset="0" stop-color="#FFE7A3" stop-opacity=".95"/><stop offset="1" stop-color="#FFE7A3" stop-opacity="0"/></linearGradient>',
    '<radialGradient id="p1" cx=".35" cy=".35"><stop offset="0" stop-color="#DCD9FF"/><stop offset="1" stop-color="#5149B8"/></radialGradient>',
    '<radialGradient id="p2" cx=".35" cy=".35"><stop offset="0" stop-color="#FFD0C8"/><stop offset="1" stop-color="#D2564A"/></radialGradient></defs>',
    '<circle cx="' + cx + '" cy="' + cy + '" r="170" fill="url(#co)"/><g class="sunrays">'];
  for (var i = 0; i < 24; i++) { var L = i % 2 ? 105 : 150, w = i % 2 ? 5 : 9; o.push('<path transform="translate(' + cx + ' ' + cy + ') rotate(' + (i * 15) + ')" d="M52 ' + (-w / 2) + 'L' + (52 + L) + ' 0L52 ' + (w / 2) + 'Z" fill="url(#ry)" opacity="' + (i % 2 ? .65 : .9) + '"/>'); }
  o.push('</g><ellipse cx="' + cx + '" cy="' + cy + '" rx="150" ry="52" fill="none" stroke="#B9B4FF" opacity=".45" transform="rotate(-14 ' + cx + ' ' + cy + ')"/>');
  o.push('<circle cx="' + cx + '" cy="' + cy + '" r="62" fill="#FFC94D" opacity=".35"/><circle cx="' + cx + '" cy="' + cy + '" r="52" fill="url(#sc)"/>');
  o.push('<circle cx="52" cy="190" r="13" fill="url(#p1)"/><circle cx="330" cy="235" r="10" fill="url(#p2)"/></svg>');
  return o.join('');
}
function moonIcon(t) {
  if (t === 1) { return '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="16" fill="#DCD9FF"/><circle cx="29" cy="17" r="15" fill="#151B45"/></svg>'; }
  if (t === 2) { return '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="16" fill="#3A4170"/><path d="M22 6A16 16 0 0 1 22 38Z" fill="#DCD9FF"/></svg>'; }
  return '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><g stroke="#FFD66B" stroke-width="2.5" stroke-linecap="round"><path d="M22 2v6M22 36v6M2 22h6M36 22h6M7.9 7.9l4.2 4.2M31.9 31.9l4.2 4.2M7.9 36.1l4.2-4.2M31.9 12.1l4.2-4.2"/></g><circle cx="22" cy="22" r="10" fill="#FFD66B"/></svg>';
}
function planetArt(color) {
  return '<svg class="float" width="84" height="72" viewBox="0 0 112 96" aria-hidden="true"><defs><radialGradient id="qp" cx=".35" cy=".3"><stop offset="0" stop-color="#F2F0FF"/><stop offset=".45" stop-color="' + color + '"/><stop offset="1" stop-color="#2E2880"/></radialGradient><radialGradient id="qg"><stop offset="0" stop-color="' + color + '" stop-opacity=".6"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient></defs><circle cx="56" cy="48" r="48" fill="url(#qg)"/><path d="M10 58A48 13-12 0 1 102 38" fill="none" stroke="#FFD66B" stroke-width="3" opacity=".5"/><circle cx="56" cy="48" r="28" fill="url(#qp)"/><path d="M102 38A48 13-12 0 1 10 58" fill="none" stroke="#FFD66B" stroke-width="3"/></svg>';
}
function nebula() {
  return '<svg width="96" height="80" viewBox="0 0 96 80" aria-hidden="true"><defs><radialGradient id="b1"><stop offset="0" stop-color="#7A1F4E" stop-opacity=".95"/><stop offset="1" stop-color="#7A1F4E" stop-opacity="0"/></radialGradient><radialGradient id="b2"><stop offset="0" stop-color="#3B1C6E" stop-opacity=".95"/><stop offset="1" stop-color="#3B1C6E" stop-opacity="0"/></radialGradient><radialGradient id="b3"><stop offset="0" stop-color="#FF6F7A" stop-opacity=".7"/><stop offset="1" stop-color="#FF6F7A" stop-opacity="0"/></radialGradient></defs><ellipse cx="40" cy="42" rx="40" ry="32" fill="url(#b2)"/><ellipse cx="58" cy="36" rx="36" ry="30" fill="url(#b1)"/><ellipse cx="48" cy="40" rx="18" ry="14" fill="url(#b3)"/><path d="M36 37Q41 40 46 37M50 37Q55 40 60 37" fill="none" stroke="#FFD0D4" stroke-width="2.2" stroke-linecap="round"/><path d="M40 49Q48 44 56 49" fill="none" stroke="#FFD0D4" stroke-width="2" stroke-linecap="round"/></svg>';
}
var GAL = (function () {
  var GW = 342, GH = 470, cx = GW / 2, cy = GH / 2, a = 14, b = 0.24, r = rng(7), dots = [];
  var cols = ['#DCD9FF', '#B9B4FF', '#FFB3D9', '#FFE7A3', '#FFFFFF', '#9FD3FF'];
  function gauss() { return (r() + r() + r() - 1.5) * 2; }
  [0, Math.PI].forEach(function (ph) {
    for (var i = 0; i < 480; i++) {
      var t = 0.2 + r() * 3 * Math.PI, rr = a * Math.exp(b * t), sp = 2 + rr * 0.075;
      var x = cx + rr * Math.cos(t + ph) + gauss() * sp, y = cy + 1.25 * rr * Math.sin(t + ph) + gauss() * sp;
      if (x > 0 && x < GW && y > 0 && y < GH) { dots.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + [0.6, 0.8, 1, 1.2, 1.6][Math.floor(r() * 5)] + '" fill="' + cols[Math.floor(r() * 6)] + '" opacity="' + (0.35 + r() * 0.6).toFixed(2) + '"/>'); }
    }
  });
  var r0 = a * Math.exp(b * 1.25 * Math.PI), r1 = a * Math.exp(b * 3.2 * Math.PI), pts = [];
  for (var k = 0; k < 12; k++) { var rr = r0 + (r1 - r0) * k / 11, t = Math.log(rr / a) / b; pts.push([cx + rr * Math.cos(t), cy + 1.25 * rr * Math.sin(t)]); }
  var base = '<defs><radialGradient id="gc"><stop offset="0" stop-color="#FFF7E0"/><stop offset=".2" stop-color="#FFD98A" stop-opacity=".9"/><stop offset=".55" stop-color="#B98CFF" stop-opacity=".35"/><stop offset="1" stop-color="#5A3FD0" stop-opacity="0"/></radialGradient><radialGradient id="gh"><stop offset="0" stop-color="#8F6BFF" stop-opacity=".35"/><stop offset="1" stop-color="#8F6BFF" stop-opacity="0"/></radialGradient></defs><ellipse cx="' + cx + '" cy="' + cy + '" rx="170" ry="230" fill="url(#gh)"/>' + dots.join('') + '<circle cx="' + cx + '" cy="' + cy + '" r="70" fill="url(#gc)"/><path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + '" fill="none" stroke="#FFD66B" stroke-width="1.4" stroke-dasharray="3 5" opacity=".7"/>';
  return { base: base, pts: pts, cx: cx, cy: cy, W: GW, H: GH };
})();

// ---------- ui helpers ----------
var app = document.getElementById('app');
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function star(sz, fill) { return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '" fill="' + (fill || '#FFD66B') + '"/></svg>'; }
function toast(t) { var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600); }
function less() { return S.settings && S.settings.less; }
function flyStar(fromEl, done) {
  var to = document.getElementById('counter');
  if (less() || !fromEl || !to || !fromEl.animate) { done(); return; }
  var a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
  var el = document.createElement('div'); el.className = 'flystar'; el.innerHTML = star(26, '#FFE7A3');
  document.body.appendChild(el);
  var x0 = a.left + a.width / 2 - 13, y0 = a.top + a.height / 2 - 13, x1 = b.left + 10, y1 = b.top + b.height / 2 - 13;
  var mx = (x0 + x1) / 2 + 90, my = Math.min(y0, y1) - 40;
  el.animate([
    { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.6)', opacity: 0 },
    { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.7)', opacity: 1, offset: .5 },
    { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.7)', opacity: .3 }
  ], { duration: 850, easing: 'ease-in-out' }).onfinish = function () {
    el.remove();
    to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450 });
    done();
  };
}
function raysSvg() { var o = '<svg class="rays" viewBox="0 0 300 300" aria-hidden="true">'; for (var a = 0; a < 360; a += 20) { o += '<path transform="rotate(' + a + ' 150 150)" d="M150 150L143 0H157Z" fill="#FFE7A3" opacity=".35"/>'; } return o + '</svg>'; }
function overlay(html) {
  var el = document.createElement('div'); el.className = 'overlay'; el.innerHTML = html;
  document.body.appendChild(el);
  el.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) { el.remove(); render(); } });
}
function celebrate(before, medalsGot, bossWon) {
  var r0 = rankOf(before), r1 = rankOf(totalStars());
  if (r1 > r0) {
    var reward = S.setup.rewards && S.setup.rewards[r1] ? '<p style="font-size:15px">Твоя нагорода: ' + esc(S.setup.rewards[r1]) + '</p>' : '';
    overlay('<div style="position:relative;width:320px;height:200px;display:flex;align-items:center;justify-content:center">' + raysSvg() + '<div style="position:relative;animation:rise .6s ease-out .1s both">' + star(110, '#FFF4D6') + '</div></div><p class="eyebrow" style="color:#FFE7A3">Новий рівень · ' + (r1 + 1) + ' з 7</p><h2 style="font-size:28px;color:#fff">Вітаю!<br>Ти — ' + D.ranks[r1].name + '</h2>' + reward + '<button class="btn" data-close style="max-width:260px">Далі</button>');
    return;
  }
  if (bossWon >= 0) {
    overlay('<div style="position:relative;width:320px;height:200px;display:flex;align-items:center;justify-content:center">' + raysSvg() + '<div style="position:relative;animation:poof 1.4s ease-out forwards">' + nebula() + '</div></div><p class="eyebrow" style="color:#FF9AA2">Бос переможений</p><h2 style="font-size:26px;color:#fff">' + esc(stageInfo(bossWon).boss) + ' — переможено!</h2><p>+50 зірок і нова медаль</p><button class="btn" data-close style="max-width:260px">Далі</button>');
    return;
  }
  if (medalsGot.length) { var m = D.medals.filter(function (x) { return x.id === medalsGot[0]; })[0]; if (m) { toast('Нова медаль: ' + m.name); } }
}
function medalSvg(got) {
  return '<svg width="44" height="52" viewBox="0 0 44 52" aria-hidden="true"><path d="M12 0H20L24 18 16 22Z" fill="' + (got ? '#8F87F5' : '#3A4170') + '"/><path d="M32 0H24L20 18 28 22Z" fill="' + (got ? '#FF8A7A' : '#3A4170') + '"/><circle cx="22" cy="33" r="17" fill="' + (got ? '#FFD66B' : '#1B2150') + '" stroke="' + (got ? '#FFF4D6' : '#4A5285') + '" stroke-width="2.5"/><path d="M22 22L25 29.5 33 30 27 35 29 43 22 38.5 15 43 17 35 11 30 19 29.5Z" fill="' + (got ? '#F29A2E' : '#3A4170') + '"/></svg>';
}

// ---------- screens ----------
function screenActivate() {
  return '<div class="col" style="gap:18px;padding-top:10px">' + sunArt() +
    '<div class="col" style="text-align:center;gap:8px"><h1 style="font-size:30px">Зоряний рік 2027</h1><p class="mut">Введи свій особистий код доступу. Він працює лише на одному телефоні.</p></div>' +
    '<div class="col"><label for="code">Код доступу</label><input id="code" autocomplete="off" autocapitalize="characters" placeholder="Напр. ZR-7K4M-Q2PX" value="' + esc(qs.get('code') || '') + '"></div>' +
    '<button class="btn" data-a="activate">Увійти в гру</button><p id="err" class="small" style="color:#FF9AA2;text-align:center;min-height:20px" role="alert"></p>' +
    '<p class="small dim" style="text-align:center">Потрібен інтернет лише для першого входу. Далі гра працює і без нього.</p></div>';
}
var setupStep = 0, setupDraft = { calm: 5, money: 5, conf: 5, goals: ['', '', ''], rewards: {} };
function screenSetup() {
  var h = '<div class="col" style="gap:18px;padding-top:16px"><p class="eyebrow">Крок ' + (setupStep + 1) + ' з 4</p>';
  if (setupStep === 0) {
    h += '<h1>Привіт! Це твій зоряний рік</h1><p class="mut">Щодня — 1–3 маленькі квести. За кожен — зірки. 12 місяців — 12 зірок у твоїй галактиці. Пропускати можна: тут немає штрафів.</p><p class="mut">Почнемо з короткого налаштування — 3 хвилини.</p><button class="btn" data-a="next">Почати</button>';
  } else if (setupStep === 1) {
    h += '<h1>Де я зараз</h1><p class="mut">Оціни чесно від 1 до 10. Наприкінці року порівняємо.</p>';
    [['calm', 'Спокій'], ['money', 'Гроші'], ['conf', 'Впевненість']].forEach(function (x) { h += '<div class="card col" style="gap:8px"><div class="row" style="justify-content:space-between"><label for="r_' + x[0] + '">' + x[1] + '</label><b id="v_' + x[0] + '" style="color:#FFD66B">' + setupDraft[x[0]] + '</b></div><input class="range" type="range" min="1" max="10" id="r_' + x[0] + '" data-r="' + x[0] + '" value="' + setupDraft[x[0]] + '"></div>'; });
    h += '<button class="btn" data-a="next">Далі</button>';
  } else if (setupStep === 2) {
    h += '<h1>Мої цілі на рік</h1><p class="mut">До трьох. Можна просто: «відкласти 10 000 грн», «більше спати», «знайти нову роботу».</p>';
    [0, 1, 2].forEach(function (i) { h += '<input data-g="' + i + '" aria-label="Ціль ' + (i + 1) + '" placeholder="Ціль ' + (i + 1) + '" value="' + esc(setupDraft.goals[i]) + '">'; });
    h += '<button class="btn" data-a="next">Далі</button>';
  } else {
    h += '<h1>Мої нагороди</h1><p class="mut">Що ти подаруєш собі, коли дійдеш до рівня? Щось приємне саме для тебе.</p>';
    [[2, 'Рівень 3 · Дослідниця'], [4, 'Рівень 5 · Капітанка'], [6, 'Рівень 7 · Зіркова']].forEach(function (x) { h += '<div class="col" style="gap:6px"><label for="w' + x[0] + '">' + x[1] + '</label><input id="w' + x[0] + '" data-w="' + x[0] + '" placeholder="Напр. кава в улюбленому місці" value="' + esc(setupDraft.rewards[x[0]] || '') + '"></div>'; });
    h += '<button class="btn" data-a="finishSetup">Запустити мій рік</button>';
  }
  if (setupStep > 0) { h += '<button class="link" data-a="back">Назад</button>'; }
  return h + '</div>';
}
function header(title, eyebrow) {
  var st = totalStars();
  return '<div class="col" style="gap:8px;padding-right:56px"><p class="eyebrow">' + eyebrow + '</p><h1>' + title + '</h1><div><span class="pill" id="counter">' + star(20) + '<span id="cnum">' + st + '</span></span></div></div>';
}
function screenToday() {
  var d = today(), di = dayIndex(), s = stageOf(di), info = stageInfo(s), h = '';
  if (di >= 360 && !S.final) { return screenFinal(); }
  h += '<div class="row" style="align-items:flex-start;justify-content:space-between">' + header('Квести дня', 'Планета ' + monthLabel(s) + ' · день ' + (di % 30 + 1)) + '</div>';
  h += '<div style="position:absolute;right:62px;top:calc(env(safe-area-inset-top) + 14px);width:84px">' + planetArt(info.color) + '</div>';
  var pendingEnd = -1;
  for (var x = 0; x < s; x++) { if (!S.monthEnds[x]) { pendingEnd = x; break; } }
  if (pendingEnd >= 0) { h += '<button class="card col" data-a="monthEnd" data-s="' + pendingEnd + '" style="text-align:left;border-color:rgba(255,214,107,.6);color:inherit;font:inherit;cursor:pointer;gap:6px"><span class="eyebrow" style="color:#FFD66B">Місяць ' + (pendingEnd + 1) + ' завершено</span><b style="font-size:16px">Підбий підсумок — запали зірку на карті (+50)</b></button>'; }
  if (!d.energy) {
    h += '<div class="col" style="margin-top:6px">' + '<p style="font-family:Unbounded,sans-serif;font-size:16px;text-align:center">Скільки в тебе сил сьогодні?</p><div class="energy">' +
      [[1, 'Ледь жива', '1 легкий квест'], [2, 'Нормально', '2 квести'], [3, 'Повна сил', '3 квести']].map(function (e) { return '<button data-a="energy" data-e="' + e[0] + '">' + moonIcon(e[0]) + '<b>' + e[1] + '</b><span>' + e[2] + '</span></button>'; }).join('') +
      '</div><button class="btn ghost" data-a="hard">Важкий день — лише один крок</button></div>';
  } else if (d.energy === -1) {
    var ht = D.hard[(di + s) % D.hard.length];
    h += '<div class="card col" style="border-color:#8F87F5;gap:10px"><span class="eyebrow">Важкий день</span><p style="font-size:17px;font-weight:600">' + esc(ht) + '.</p>' +
      (d.hardDone ? '<p class="mut">Зараховано. +10 зірок. Ти молодець.</p>' : '<button class="btn" data-a="hardDone">Зроблено</button>') +
      '</div><button class="link" data-a="resetEnergy">Змінити: у мене є сили</button>';
  } else {
    var list = questsFor(d.energy);
    h += '<div class="col" style="gap:10px">';
    list.forEach(function (q) {
      var done = d.done.indexOf(q.id) >= 0, col = q.br === 'calm' ? '#B9B4FF' : (q.br === 'money' ? '#FFD66B' : '#FF8A7A');
      h += '<button class="quest' + (done ? ' done' : '') + '" data-a="quest" data-id="' + q.id + '" data-t="' + esc(q.text) + '" aria-pressed="' + done + '"><span class="qdot" style="color:' + col + '">' + (done ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1230" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : '') + '</span><span class="col" style="gap:4px;flex:1"><span class="qb" style="color:' + col + '">' + BR[q.br] + '</span><span class="qt">' + esc(q.text) + '</span></span><span class="qp">+' + q.pts + '</span></button>';
    });
    if (d.own && d.own.text) {
      h += '<button class="quest' + (d.own.done ? ' done' : '') + '" data-a="ownDone" aria-pressed="' + !!d.own.done + '"><span class="qdot" style="color:#9FE870">' + (d.own.done ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1230" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : '') + '</span><span class="col" style="gap:4px;flex:1"><span class="qb" style="color:#9FE870">Мій квест</span><span class="qt">' + esc(d.own.text) + '</span></span><span class="qp">+15</span></button>';
    } else {
      h += '<div class="row"><input id="own" placeholder="Свій квест під твою ціль" aria-label="Свій квест"><button class="btn" style="width:auto;min-width:64px;font-size:22px" data-a="addOwn" aria-label="Додати свій квест">+</button></div>';
    }
    h += '</div>';
    if (!d.done.length) { h += '<button class="link" data-a="resetEnergy">Змінити рівень сил</button>'; }
  }
  var hits = bossHits(s), dead = !!S.bosses[s];
  h += '<div class="boss" style="margin-top:6px"><div id="bossArt" style="flex-shrink:0;opacity:' + (dead ? .25 : (0.35 + (BOSS_HP - hits) / BOSS_HP * 0.65)).toFixed(2) + '">' + nebula() + '</div><div class="col" style="gap:6px;flex:1"><div class="row" style="justify-content:space-between"><span class="qb" style="color:#FF9AA2">Бос місяця</span><span class="small mut">' + hits + ' / ' + BOSS_HP + '</span></div><b style="font-family:Unbounded,sans-serif;font-size:17px">' + esc(info.boss) + (dead ? ' — переможено' : '') + '</b><div class="bar" style="height:8px"><i style="width:' + ((BOSS_HP - hits) / BOSS_HP * 100) + '%;background:#FF8A7A"></i></div><span class="small mut">Кожен квест «Спокій» — удар по босу</span></div></div>';
  h += '<div class="card col" style="gap:8px"><label for="joy">Банка радості · одна добра річ за сьогодні</label><div class="row"><input id="joy" placeholder="Напр. донька обійняла зранку"><button class="btn" style="width:auto;min-width:64px;font-size:22px" data-a="joy" aria-label="Додати в банку радості">+</button></div></div>';
  return h;
}
var mapSel = null;
function screenMap() {
  var di = dayIndex(), cur = stageOf(di), sel = mapSel == null ? cur : mapSel, g = GAL, o = [];
  o.push('<div class="col" style="gap:10px">' + header('Твоя галактика', 'Рівень ' + (rankOf(totalStars()) + 1) + ' · ' + D.ranks[rankOf(totalStars())].name));
  var st = totalStars(), r = rankOf(st), nx = D.ranks[r + 1];
  if (nx) { o.push('<div class="row"><div class="bar" style="flex:1"><i style="width:' + Math.min(100, Math.round(st / nx.need * 100)) + '%"></i></div><span class="small" style="color:#FFD66B;font-weight:800">' + st + ' / ' + nx.need + '</span></div>'); }
  o.push('<div style="position:relative;width:342px;height:470px;margin:0 auto;max-width:100%"><svg viewBox="0 0 342 470" width="342" height="470" role="img" aria-label="Галактика з 12 зірками-місяцями">' + g.base + '</svg>');
  g.pts.forEach(function (p, i) {
    var done = !!S.monthEnds[i], isCur = i === cur, dx = p[0] - g.cx, dy = p[1] - g.cy, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var dot = done ? '<span style="width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#FFFBEA,#FFD66B 55%,#F29A2E);box-shadow:0 0 18px 6px rgba(255,201,77,.55)"></span>' :
      (isCur ? '<span style="width:24px;height:24px;border-radius:50%;background:radial-gradient(circle,#fff 30%,#B9B4FF);box-shadow:0 0 0 5px rgba(185,180,255,.35),0 0 26px 10px rgba(185,180,255,.6)"></span>' :
      (i < cur ? '<span style="width:18px;height:18px;border-radius:50%;background:#B9B4FF;opacity:.7"></span>' : '<span style="width:16px;height:16px;border-radius:50%;background:#1B2150;border:1.5px dashed #C9CCE0"></span>'));
    o.push('<button data-a="mapSel" data-s="' + i + '" aria-label="' + monthLabel(i) + '" style="position:absolute;left:' + (p[0] - 22) + 'px;top:' + (p[1] - 22) + 'px;width:44px;height:44px;border:none;background:none;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer">' + (i === sel ? '<span style="position:absolute;inset:2px;border-radius:50%;border:2px solid #FFD66B;box-shadow:0 0 14px rgba(255,214,107,.7)"></span>' : '') + dot + '</button>');
    o.push('<span style="position:absolute;left:' + (p[0] + dx / L * 28 - 20) + 'px;top:' + (p[1] + dy / L * 28 - 8) + 'px;width:40px;text-align:center;font-size:12px;font-weight:800;pointer-events:none;color:' + (done ? '#FFE7A3' : (isCur ? '#fff' : '#C9CCE0')) + '">' + monthLabel(i) + '</span>');
  });
  o.push('</div>');
  var inf = stageInfo(sel), txt;
  if (S.monthEnds[sel]) { txt = 'Зірку запалено. Бос: ' + inf.boss + (S.bosses[sel] ? ' — переможено.' : '.'); }
  else if (sel === cur) { txt = 'Ти тут · день ' + (di % 30 + 1) + ' з 30. Тема: ' + inf.theme + '. Бос: ' + inf.boss + ', ' + bossHits(sel) + ' / ' + BOSS_HP + ' ударів.'; }
  else if (sel < cur) { txt = 'Місяць пройдено — підбий підсумок, щоб запалити зірку.'; }
  else { txt = 'Засвітиться, коли пройдеш попередній місяць. Тема: ' + inf.theme + '. Бос: ' + inf.boss + '.'; }
  o.push('<div class="card row" style="border-color:rgba(255,214,107,.35)"><div class="col" style="gap:4px;flex:1"><b style="font-family:Unbounded,sans-serif;color:#FFE7A3">Місяць ' + (sel + 1) + ' · ' + monthLabel(sel) + '</b><span class="small mut">' + txt + '</span></div>' + (sel < cur && !S.monthEnds[sel] ? '<button class="btn" style="width:auto" data-a="monthEnd" data-s="' + sel + '">Підсумок</button>' : '') + '</div></div>');
  return o.join('');
}
function constellation(r) {
  var H = 300, pts = [], o = ['<svg viewBox="0 0 342 300" width="100%" role="img" aria-label="Сузір’я рівнів: ти на рівні ' + (r + 1) + ' з 7"><defs><radialGradient id="rg1"><stop offset="0" stop-color="#FFF4D6"/><stop offset=".35" stop-color="#FFD66B" stop-opacity=".8"/><stop offset="1" stop-color="#FFD66B" stop-opacity="0"/></radialGradient><radialGradient id="rg2"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#B9B4FF" stop-opacity=".9"/><stop offset="1" stop-color="#B9B4FF" stop-opacity="0"/></radialGradient></defs>'];
  for (var i = 0; i < 7; i++) { pts.push([i % 2 ? 196 : 146, H - 24 - i * (H - 48) / 6]); }
  function sp(x, y, s) { var p = []; for (var k = 0; k < 10; k++) { var rr = k % 2 ? s * .42 : s, a = k * Math.PI / 5; p.push((x + rr * Math.sin(a)).toFixed(1) + ' ' + (y - rr * Math.cos(a)).toFixed(1)); } return 'M' + p.join('L') + 'Z'; }
  for (i = 0; i < 6; i++) { o.push('<line x1="' + pts[i][0] + '" y1="' + pts[i][1] + '" x2="' + pts[i + 1][0] + '" y2="' + pts[i + 1][1] + '" stroke="' + (i < r ? '#FFD66B' : '#8C92BC') + '" stroke-width="' + (i < r ? 2 : 1.2) + '"' + (i < r ? '' : ' stroke-dasharray="3 5" opacity=".7"') + '/>'); }
  pts.forEach(function (p, i) {
    var x = p[0], y = p[1], col, sub;
    if (i < r) { o.push('<circle cx="' + x + '" cy="' + y + '" r="22" fill="url(#rg1)"/><path d="' + sp(x, y, 10) + '" fill="#FFE7A3"/>'); col = '#FFE7A3'; sub = 'пройдено'; }
    else if (i === r) { o.push('<circle cx="' + x + '" cy="' + y + '" r="30" fill="url(#rg2)"/><path d="' + sp(x, y, 13) + '" fill="#fff"/>'); col = '#fff'; sub = 'ти тут'; }
    else { o.push('<path d="' + sp(x, y, 8) + '" fill="none" stroke="#B5BAE0" stroke-width="1.3"/>'); col = '#C9CCE0'; sub = D.ranks[i].need + ' зірок'; }
    var left = i % 2 === 0, tx = left ? x - 24 : x + 24;
    o.push('<text x="' + tx + '" y="' + (y - 1) + '" text-anchor="' + (left ? 'end' : 'start') + '" font-family="Manrope, sans-serif" font-size="14" font-weight="700" fill="' + col + '">' + D.ranks[i].name + '</text><text x="' + tx + '" y="' + (y + 15) + '" text-anchor="' + (left ? 'end' : 'start') + '" font-family="Manrope, sans-serif" font-size="12" fill="' + (i === r ? '#FFD66B' : '#A9AEC9') + '">' + sub + '</text>');
  });
  return o.join('') + '</svg>';
}
function screenRewards() {
  var r = rankOf(totalStars()), h = '<div class="col" style="gap:12px">' + header('Твоє сузір’я', '7 рівнів — від Мрійниці до Зіркової') + constellation(r);
  var rw = S.setup.rewards || {};
  [2, 4, 6].forEach(function (i) { if (rw[i]) { h += '<div class="card col" style="gap:4px;border-style:dashed;border-color:' + (r >= i ? '#9FE870' : '#FFD66B') + '"><span class="qb" style="color:' + (r >= i ? '#9FE870' : '#FFD66B') + '">Нагорода · ' + D.ranks[i].name + (r >= i ? ' — отримана' : '') + '</span><b>' + esc(rw[i]) + '</b></div>'; } });
  var got = D.medals.filter(function (m) { return S.medals[m.id]; }).length;
  h += '<b class="mut">Медалі · ' + got + ' з ' + D.medals.length + '</b><div class="medals">' + D.medals.map(function (m) { var g = !!S.medals[m.id]; return '<div class="medal' + (g ? ' got' : '') + '">' + medalSvg(g) + '<span>' + m.name + '</span></div>'; }).join('') + '</div></div>';
  return h;
}
function screenBank() {
  var tot = savedTotal(), h = '<div class="col" style="gap:12px">' + header('Скарбничка', 'Твої накопичення за рік');
  h += '<div class="card col" style="align-items:center;text-align:center;gap:6px;border-color:rgba(255,214,107,.5)"><span class="eyebrow" style="color:#FFD66B">Відкладено</span><b style="font-family:Unbounded,sans-serif;font-size:36px;color:#FFE7A3">' + tot.toLocaleString('uk-UA') + ' грн</b><span class="small mut">Медалі: 100 грн · 1000 грн · 5000 грн</span></div>';
  h += '<div class="card col" style="gap:8px"><label for="amt">Я відклала сьогодні</label><div class="row"><input id="amt" type="number" inputmode="numeric" min="1" placeholder="Сума, грн"><button class="btn" style="width:auto" data-a="save">Додати</button></div></div>';
  if (S.savings.length) { h += '<div class="card"><div class="list">' + S.savings.slice(-8).reverse().map(function (x) { return '<div><span>' + x.d.split('-').reverse().join('.') + '</span><b style="color:#FFD66B">+' + x.a + ' грн</b></div>'; }).join('') + '</div><button class="link" data-a="undoSave">Скасувати останній запис</button></div>'; }
  h += '<div class="card col" style="gap:8px"><b>Банка радості · ' + S.joys.length + '</b>' + (S.joys.length ? S.joys.slice(-6).reverse().map(function (j) { return '<p class="small mut">✦ ' + esc(j.t) + '</p>'; }).join('') : '<p class="small dim">Додавай одну добру річ щодня на екрані «Сьогодні».</p>') + '</div></div>';
  return h;
}
function screenSettings() {
  return '<div class="col" style="gap:14px"><h1>Налаштування</h1>' +
    '<label class="card row" style="justify-content:space-between;cursor:pointer"><span><b style="color:var(--txt)">Менше анімації</b><br><span class="small dim">Економить заряд під час відключень</span></span><input type="checkbox" data-a="less" style="width:26px;height:26px" ' + (less() ? 'checked' : '') + '></label>' +
    '<div class="card col" style="gap:6px"><b>Мій код доступу</b><span class="mut">' + esc(S.act ? S.act.code : '') + '</span><span class="small dim">Прогрес зберігається на телефоні і, коли є інтернет, — копією на сервері. Змінила телефон — напиши нам, перенесемо.</span></div>' +
    '<div class="card col" style="gap:6px"><b>Мої цілі</b>' + (S.setup.goals || []).filter(Boolean).map(function (g) { return '<span class="mut">✦ ' + esc(g) + '</span>'; }).join('') + '</div>' +
    '<button class="btn ghost" data-a="export">Зберегти копію прогресу у файл</button>' +
    '<a class="btn ghost" href="https://instagram.com/nakopych_challenge" target="_blank" rel="noopener">Написати нам в Instagram</a>' +
    '<button class="link" data-a="tab" data-t="today">Назад</button></div>';
}
function screenMonthEnd(s) {
  return '<div class="col" style="gap:14px"><p class="eyebrow">Місяць ' + (s + 1) + ' · ' + monthLabel(s) + '</p><h1>Підсумок місяця</h1><p class="mut">Три коротких відповіді — і зірка на карті засвітиться.</p>' +
    ['Що мені вдалося?', 'Що було важко?', 'Що я беру в наступний місяць?'].map(function (q, i) { return '<div class="col" style="gap:6px"><label for="me' + i + '">' + q + '</label><textarea id="me' + i + '" rows="2"></textarea></div>'; }).join('') +
    '<button class="btn" data-a="saveMonthEnd" data-s="' + s + '">Запалити зірку (+50)</button><button class="link" data-a="tab" data-t="today">Пізніше</button></div>';
}
function screenFinal() {
  var st = S.setup.start_rates || {};
  return '<div class="col" style="gap:14px">' + sunArt() + '<h1>Твій рік пройдено!</h1><p class="mut">На старті ти оцінила: спокій ' + st.calm + ', гроші ' + st.money + ', впевненість ' + st.conf + '. А зараз?</p>' +
    [['calm', 'Спокій'], ['money', 'Гроші'], ['conf', 'Впевненість']].map(function (x) { return '<div class="card col" style="gap:6px"><label for="f_' + x[0] + '">' + x[1] + ' (1–10)</label><input id="f_' + x[0] + '" type="number" min="1" max="10" inputmode="numeric"></div>'; }).join('') +
    '<div class="col" style="gap:6px"><label for="letter">Лист собі</label><textarea id="letter" rows="4" placeholder="Що б ти сказала собі на початку року?"></textarea></div><button class="btn" data-a="saveFinal">Завершити рік</button></div>';
}
function nav() {
  var t = S.tab;
  function b(id, label, icon) { return '<button class="' + (t === id ? 'on' : '') + '" data-a="tab" data-t="' + id + '"' + (t === id ? ' aria-current="page"' : '') + '>' + icon + label + '</button>'; }
  var ic = function (d) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  return '<nav><div class="in">' + b('today', 'Сьогодні', ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>')) + b('map', 'Галактика', ic('<path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M4 12c0-5 4-8 8-8s7 3 7 6-3 5-6 5-4-2-4-3"/>')) + b('bank', 'Скарбничка', ic('<path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>')) + b('rewards', 'Нагороди', ic('<path d="' + STAR + '"/>')) + '</div></nav>';
}
var GEAR = '<button class="gear" data-a="tab" data-t="settings" aria-label="Налаштування"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>';

var monthEndOpen = -1;
function render() {
  document.body.classList.toggle('less', !!less());
  var h;
  if (!S.act) { h = screenActivate(); }
  else if (!S.setup) { h = screenSetup(); }
  else if (monthEndOpen >= 0) { h = screenMonthEnd(monthEndOpen); }
  else {
    if (S.tab === 'map') { h = screenMap(); }
    else if (S.tab === 'rewards') { h = screenRewards(); }
    else if (S.tab === 'bank') { h = screenBank(); }
    else if (S.tab === 'settings') { h = screenSettings(); }
    else { h = screenToday(); }
    if (S.tab !== 'settings') { h = GEAR + h + nav(); }
  }
  app.innerHTML = h;
}

// ---------- actions ----------
function deviceId() {
  var id = localStorage.getItem('zr_dev');
  if (!id) { id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2); localStorage.setItem('zr_dev', id); }
  return id;
}
function post(path, body) {
  return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
}
function sync() {
  if (!S.act || !navigator.onLine || window.ZR_DEMO) { return; }
  var copy = JSON.parse(JSON.stringify(S)); delete copy.act;
  post('/sync', { code: S.act.code, device: S.act.device, state: copy }).catch(function () {});
}
window.addEventListener('online', sync);

var A = {
  activate: function () {
    var code = (document.getElementById('code').value || '').trim().toUpperCase(), err = document.getElementById('err');
    if (code.length < 6) { err.textContent = 'Введи код повністю.'; return; }
    if (!navigator.onLine) { err.textContent = 'Для першого входу потрібен інтернет. Спробуй, коли з’явиться зв’язок.'; return; }
    err.textContent = 'Перевіряю…';
    var dev = deviceId();
    post('/activate', { code: code, device: dev }).then(function (r) {
      if (!r.ok) { err.textContent = r.error === 'used' ? 'Цей код уже активовано на іншому телефоні. Напиши нам — допоможемо.' : 'Код не знайдено. Перевір, чи правильно введено.'; return; }
      if (r.state && r.state.setup) { var keep = S.settings; S = Object.assign(blank(), r.state); S.settings = S.settings || keep; }
      S.act = { code: code, device: dev, at: todayKey() };
      save(true); render();
    }).catch(function () { err.textContent = 'Немає зв’язку з сервером. Спробуй ще раз за хвилину.'; });
  },
  next: function () { setupStep++; render(); },
  back: function () { setupStep = Math.max(0, setupStep - 1); render(); },
  finishSetup: function () {
    S.setup = { start: todayKey(), start_rates: { calm: setupDraft.calm, money: setupDraft.money, conf: setupDraft.conf }, goals: setupDraft.goals.slice(), rewards: setupDraft.rewards };
    S.tab = 'today'; save(); render();
  },
  energy: function (el) { var d = today(); d.energy = +el.getAttribute('data-e'); save(); render(); },
  hard: function () { var d = today(); d.energy = -1; save(); render(); },
  resetEnergy: function () { var d = today(); if (!d.done.length && !d.hardDone) { d.energy = 0; save(); render(); } },
  hardDone: function (el) { act(el, function () { today().hardDone = true; }); },
  quest: function (el) {
    var d = today(), id = el.getAttribute('data-id'), i = d.done.indexOf(id);
    if (i >= 0) { d.done.splice(i, 1); var ti = d.doneText.indexOf(el.getAttribute('data-t')); if (ti >= 0) { d.doneText.splice(ti, 1); } save(); render(); return; }
    act(el.querySelector('.qdot'), function () { d.done.push(id); d.doneText.push(el.getAttribute('data-t')); });
  },
  addOwn: function () { var v = (document.getElementById('own').value || '').trim(); if (!v) { return; } today().own = { text: v, done: false }; save(); render(); },
  ownDone: function (el) { var d = today(); if (d.own.done) { d.own.done = false; save(); render(); return; } act(el.querySelector('.qdot'), function () { d.own.done = true; }); },
  joy: function () { var v = (document.getElementById('joy').value || '').trim(); if (!v) { return; } S.joys.push({ d: todayKey(), t: v }); var got = checkMedals(); save(); render(); toast(got.length ? 'Нова медаль: 10 радощів у банці' : 'Додано в банку радості ✦'); },
  save: function () { var v = parseInt(document.getElementById('amt').value, 10); if (!(v > 0)) { return; } var before = totalStars(); S.savings.push({ d: todayKey(), a: v }); var got = checkMedals(); save(); render(); celebrate(before, got, -1); if (!got.length) { toast('+' + v + ' грн у скарбничці'); } },
  undoSave: function () { S.savings.pop(); save(); render(); },
  tab: function (el) { S.tab = el.getAttribute('data-t'); monthEndOpen = -1; mapSel = null; save(true); render(); window.scrollTo(0, 0); },
  mapSel: function (el) { mapSel = +el.getAttribute('data-s'); render(); },
  monthEnd: function (el) { monthEndOpen = +el.getAttribute('data-s'); render(); window.scrollTo(0, 0); },
  saveMonthEnd: function (el) {
    var s = +el.getAttribute('data-s'), before = totalStars();
    S.monthEnds[s] = { d: todayKey(), a: [0, 1, 2].map(function (i) { return document.getElementById('me' + i).value; }) };
    monthEndOpen = -1; S.tab = 'map'; mapSel = s; var got = checkMedals(); save(); render(); celebrate(before, got, -1);
  },
  saveFinal: function () {
    S.final = { d: todayKey(), calm: +document.getElementById('f_calm').value, money: +document.getElementById('f_money').value, conf: +document.getElementById('f_conf').value, letter: document.getElementById('letter').value };
    save(); render(); toast('Твій зоряний рік завершено ✦');
  },
  less: function (el) { S.settings.less = el.checked; save(true); render(); },
  export: function () {
    var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'zoriany-rik-kopiya-' + todayKey() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }
};
function act(fromEl, mutate) {
  var before = totalStars();
  mutate();
  var bossWon = checkBoss(), got = checkMedals();
  save();
  flyStar(fromEl, function () {
    render();
    if (bossWon >= 0 && !less()) { var b = document.getElementById('bossArt'); if (b) { b.style.animation = 'shake .6s'; } }
    celebrate(before, got, bossWon);
  });
}
app.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]'); if (!el) { return; }
  var f = A[el.getAttribute('data-a')]; if (f && el.type !== 'checkbox') { f(el); }
});
app.addEventListener('change', function (e) { var el = e.target; if (el.getAttribute('data-a') === 'less') { A.less(el); } });
app.addEventListener('input', function (e) {
  var el = e.target;
  if (el.hasAttribute('data-r')) { var k = el.getAttribute('data-r'); setupDraft[k] = +el.value; document.getElementById('v_' + k).textContent = el.value; }
  if (el.hasAttribute('data-g')) { setupDraft.goals[+el.getAttribute('data-g')] = el.value; }
  if (el.hasAttribute('data-w')) { setupDraft.rewards[+el.getAttribute('data-w')] = el.value; }
});
app.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') { return; }
  var id = e.target.id;
  if (id === 'code') { A.activate(); } else if (id === 'own') { A.addOwn(); } else if (id === 'joy') { A.joy(); } else if (id === 'amt') { A.save(); }
});

if (window.ZR_DEMO && !S.act) { S.act = { code: 'ДЕМО', device: 'demo', at: todayKey() }; }
S.tab = 'today';
drawSky(S.setup ? dnum(S.setup.start) % 1000 : 3);
render();
if (!window.ZR_DEMO && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
if (S.act) { sync(); }
})();
