'use strict';
const APP_VERSION = '1.0.0';
const SAVE_KEY = 'puffkins-save-v1';

/* ---------- data ---------- */
const SPECIES = {
  boba:  { name: 'Boba Puff',  food: '🍃', states: ['base', 'sleep', 'eat', 'chew', 'sad', 'dirty', 'sick'] },
  bunny: { name: 'Bunny Puff', food: '🥕', states: ['base', 'drowsy', 'sleep', 'eat', 'chew', 'sad', 'verysad', 'dirty', 'sick'] },
  snow:  { name: 'Snow Puff',  food: '🫐', states: ['base', 'sleep', 'eat', 'chew', 'sad', 'dirty', 'sick'] },
};
const ORDER = ['boba', 'bunny', 'snow'];
// mouth position as fraction of puff image (x, y)
const MOUTH = { boba: [0.72, 0.64], bunny: [0.42, 0.65], snow: [0.71, 0.67] };
const img = (sp, st) => `assets/puffs/${sp}-${st}.webp`;
const has = (sp, st) => SPECIES[sp].states.includes(st);

const T = {
  hr: {
    feed: 'Hrana', play: 'Igra', bath: 'Kupanje', sleep: 'Spavaj', wake: 'Probudi', medicine: 'Lijek',
    rubHint: 'Trljaj Puffa prstom! 🫧', done: 'Gotovo', playGame: 'Igraj', adoptTitle: 'Odaberi svog Puffa',
    nameLabel: 'Kako će se zvati?', adoptBtn: 'Udomi!', back: 'Natrag', settings: 'Postavke', language: 'Jezik',
    adoptNew: 'Udomi novog Puffa', rename: 'Promijeni ime', reset: 'Počni ispočetka', resetConfirm: 'Sigurno? Dodirni opet',
    full: 'Sit sam! 😋', yum: 'Njam njam!', cleanDone: 'Čist i mekan! ✨', sleeping: 'Pssst… spava 😴',
    cured: 'Bolje mi je! 💖', notTired: 'Nisam umoran! ☀️', tooTired: 'Preumoran sam… 😴', sickPlay: 'Bolestan sam… 🤒',
    allAdopted: 'Već imaš sve Puffove!', woke: 'Dobro jutro! ☀️', renamePrompt: 'Novo ime:', alreadyClean: 'Već sam čist! ✨',
    newFriend: 'Dobrodošao, {n}! 💕',
  },
  en: {
    feed: 'Food', play: 'Play', bath: 'Bath', sleep: 'Sleep', wake: 'Wake up', medicine: 'Medicine',
    rubHint: 'Rub the Puff with your finger! 🫧', done: 'Done', playGame: 'Play', adoptTitle: 'Choose your Puff',
    nameLabel: 'What will you call it?', adoptBtn: 'Adopt!', back: 'Back', settings: 'Settings', language: 'Language',
    adoptNew: 'Adopt a new Puff', rename: 'Rename', reset: 'Start over', resetConfirm: 'Sure? Tap again',
    full: "I'm full! 😋", yum: 'Yum yum!', cleanDone: 'Clean and fluffy! ✨', sleeping: 'Shhh… sleeping 😴',
    cured: 'I feel better! 💖', notTired: "I'm not tired! ☀️", tooTired: 'Too tired… 😴', sickPlay: "I'm sick… 🤒",
    allAdopted: 'You already have all the Puffs!', woke: 'Good morning! ☀️', renamePrompt: 'New name:', alreadyClean: "I'm already clean! ✨",
    newFriend: 'Welcome, {n}! 💕',
  },
};

/* ---------- state ---------- */
let S = load();
function fresh() { return { lang: 'hr', current: 0, t: Date.now(), puffs: [] }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && Array.isArray(s.puffs)) return s; } catch (e) {}
  return fresh();
}
function save() { S.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
const tr = k => (T[S.lang] || T.hr)[k] || k;
const clamp = v => Math.max(0, Math.min(100, v));
const cur = () => S.puffs[S.current];

/* ---------- simulation (rates per hour) ---------- */
function stepPuff(p, h) {
  const s = p.stats;
  if (p.asleep) {
    s.energy = clamp(s.energy + 25 * h);
    s.food = clamp(s.food - 3 * h);
    s.clean = clamp(s.clean - 1 * h);
  } else {
    s.energy = clamp(s.energy - 5 * h);
    s.food = clamp(s.food - 7 * h);
    s.fun = clamp(s.fun - 6 * h);
    s.clean = clamp(s.clean - 4 * h);
  }
  const bad = s.food < 15 || s.clean < 15;
  s.health = clamp(s.health + (bad ? -8 : 3) * h);
  if (!p.sick && s.health < 35) p.sick = true;
  if (p.asleep && s.energy >= 100) { p.asleep = false; p.justWoke = true; }
}
function simulate(ms) {
  let h = Math.min(ms, 48 * 3600e3) / 3600e3;
  while (h > 0) { const d = Math.min(h, 1 / 60); S.puffs.forEach(p => stepPuff(p, d)); h -= d; }
}

/* ---------- dom ---------- */
const $ = id => document.getElementById(id);
const els = {
  game: $('game'), stage: $('stage'), room: $('room'), puffWrap: $('puffWrap'), puff: $('puff'),
  puffImg: $('puffImg'), puffDirty: $('puffDirty'), bubble: $('bubble'), bubbleIcon: $('bubbleIcon'),
  fx: $('fx'), name: $('puffName'), dots: $('dots'), actions: $('actions'), bathBar: $('bathBar'), toast: $('toast'),
};
const preloaded = {};
function preload(sp) {
  if (preloaded[sp]) return; preloaded[sp] = true;
  SPECIES[sp].states.forEach(st => { const i = new Image(); i.src = img(sp, st); });
  const r = new Image(); r.src = `assets/rooms/${sp}.webp`;
}

let anim = null;        // override state during animations
let busy = false;
let bathMode = false;

function displayState(p) {
  if (anim) return anim;
  const s = p.stats;
  if (p.asleep) return 'sleep';
  if (p.sick) return 'sick';
  if (s.food < 15 || s.fun < 15) return has(p.species, 'verysad') ? 'verysad' : 'sad';
  if (s.food < 25 || s.fun < 25) return 'sad';
  if (s.clean < 35) return 'dirty';
  if (s.energy < 20 && has(p.species, 'drowsy')) return 'drowsy';
  return 'base';
}

function setPuffImg(src) { if (!els.puffImg.src.endsWith(src)) els.puffImg.src = src; }

function render() {
  const p = cur(); if (!p) return;
  const sp = p.species;
  // room + name
  const roomSrc = `assets/rooms/${sp}.webp`;
  if (!els.room.src.endsWith(roomSrc)) els.room.src = roomSrc;
  els.name.textContent = p.name;
  $('foodIcon').textContent = SPECIES[sp].food;
  document.body.classList.toggle('asleep', !!p.asleep);
  // image
  if (bathMode) {
    setPuffImg(img(sp, 'base'));
    els.puffDirty.src.endsWith(img(sp, 'dirty')) || (els.puffDirty.src = img(sp, 'dirty'));
    els.puffDirty.style.opacity = Math.max(0, Math.min(1, (80 - p.stats.clean) / 50));
  } else {
    setPuffImg(img(sp, displayState(p)));
    els.puffDirty.style.opacity = 0;
  }
  // bars
  document.querySelectorAll('.bar').forEach(b => {
    const v = p.stats[b.dataset.stat];
    b.querySelector('.fill').style.width = v + '%';
    b.classList.toggle('low', v < 20);
  });
  // bubble
  let need = null;
  if (!p.asleep && !anim && !bathMode) {
    const s = p.stats;
    const cands = [];
    if (p.sick) cands.push(['💊', -1]);
    if (s.food < 45) cands.push([SPECIES[sp].food, s.food]);
    if (s.energy < 25) cands.push(['🌙', s.energy]);
    if (s.clean < 35) cands.push(['🛁', s.clean]);
    if (s.fun < 40) cands.push(['🧸', s.fun]);
    cands.sort((a, b) => a[1] - b[1]);
    need = cands[0] && cands[0][0];
  }
  els.bubble.hidden = !need;
  if (need) els.bubbleIcon.textContent = need;
  // shiver when very hungry
  const shiver = !p.asleep && !anim && !bathMode && p.stats.food < 15;
  if (!els.puff.classList.contains('hop') && !els.puff.classList.contains('wiggle') && !els.puff.classList.contains('squish'))
    els.puff.classList.toggle('shiver', shiver);
  // buttons
  document.querySelector('.act.med').hidden = !p.sick;
  $('sleepIcon').textContent = p.asleep ? '☀️' : '🌙';
  $('sleepLabel').textContent = p.asleep ? tr('wake') : tr('sleep');
  document.querySelectorAll('.act').forEach(b => {
    const a = b.dataset.act;
    b.disabled = busy || (p.asleep && a !== 'sleep');
  });
  els.actions.hidden = bathMode;
  els.bathBar.hidden = !bathMode;
  // nav
  $('prevBtn').disabled = S.puffs.length < 2;
  $('nextBtn').disabled = S.puffs.length < 2;
  $('prevBtn').style.visibility = $('nextBtn').style.visibility = S.puffs.length < 2 ? 'hidden' : 'visible';
  els.dots.innerHTML = S.puffs.length < 2 ? '' : S.puffs.map((_, i) => `<i class="${i === S.current ? 'on' : ''}"></i>`).join('');
}

/* ---------- fx ---------- */
function puffRect() { return els.puff.getBoundingClientRect(); }
function stagePoint(x, y) { const r = els.fx.getBoundingClientRect(); return [x - r.left, y - r.top]; }
function particle(char, x, y, cls = 'rise', dx = 0) {
  const d = document.createElement('div');
  d.className = 'p ' + cls; d.textContent = char;
  const [sx, sy] = stagePoint(x, y);
  d.style.left = sx + 'px'; d.style.top = sy + 'px'; d.style.setProperty('--dx', dx + 'px');
  els.fx.appendChild(d);
  setTimeout(() => d.remove(), 2700);
  return d;
}
function burst(chars, n = 5) {
  const r = puffRect();
  for (let i = 0; i < n; i++) setTimeout(() => {
    particle(chars[i % chars.length], r.left + r.width * (0.3 + Math.random() * 0.5), r.top + r.height * (0.25 + Math.random() * 0.3), 'rise', (Math.random() - 0.5) * 80);
  }, i * 110);
}
function bubbleAt(x, y) {
  const d = document.createElement('div');
  const size = 14 + Math.random() * 26;
  d.className = 'bub';
  const [sx, sy] = stagePoint(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
  Object.assign(d.style, { left: sx + 'px', top: sy + 'px', width: size + 'px', height: size + 'px' });
  els.fx.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
function playClass(cls, ms) {
  els.puff.classList.remove('hop', 'wiggle', 'squish', 'shiver');
  void els.puff.offsetWidth;
  els.puff.classList.add(cls);
  setTimeout(() => els.puff.classList.remove(cls), ms);
}
let toastTimer;
function toast(msg) {
  els.toast.textContent = msg; els.toast.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('on'), 1800);
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const wait = ms => new Promise(r => setTimeout(r, ms));

let zzzTimer = null;
function updateZzz() {
  const p = cur();
  if (p && p.asleep && !zzzTimer) {
    zzzTimer = setInterval(() => {
      const p = cur(); if (!p || !p.asleep) return;
      const r = puffRect();
      particle(['z', 'Z', 'z'][Math.floor(Math.random() * 3)], r.left + r.width * (MOUTH[p.species][0] + 0.08), r.top + r.height * 0.35, 'zzz');
    }, 900);
  } else if ((!p || !p.asleep) && zzzTimer) { clearInterval(zzzTimer); zzzTimer = null; }
}

/* ---------- actions ---------- */
async function feed() {
  const p = cur();
  if (p.stats.food >= 95) { toast(tr('full')); playClass('wiggle', 500); return; }
  busy = true; render();
  const r = puffRect();
  const [mx, my] = MOUTH[p.species];
  const f = particle(SPECIES[p.species].food, r.left + r.width * mx, r.top - r.height * 0.3, 'food');
  f.style.fontSize = 'min(12vw,56px)';
  f.style.transform = 'translate(-50%,-50%)';
  await wait(60);
  f.style.transform = `translate(-50%,calc(-50% + ${r.height * (0.3 + my)}px)) scale(.5)`;
  await wait(650); f.style.opacity = 0;
  for (let i = 0; i < 3; i++) {
    anim = 'eat'; render(); await wait(380);
    anim = 'chew'; render(); playClass('squish', 300); await wait(380);
  }
  p.stats.food = clamp(p.stats.food + 30); p.stats.fun = clamp(p.stats.fun + 3);
  anim = null; busy = false; buzz(20);
  toast(tr('yum')); burst(['💛', '✨'], 3); save(); render();
}
async function play() {
  const p = cur();
  if (p.sick) { toast(tr('sickPlay')); playClass('wiggle', 500); return; }
  if (p.stats.energy < 10) { toast(tr('tooTired')); return; }
  busy = true; anim = 'chew'; render();
  for (let i = 0; i < 3; i++) { playClass('hop', 550); burst(['💖', '⭐', '✨'], 2); buzz(15); await wait(600); }
  p.stats.fun = clamp(p.stats.fun + 25);
  p.stats.energy = clamp(p.stats.energy - 8);
  p.stats.food = clamp(p.stats.food - 4);
  p.stats.clean = clamp(p.stats.clean - 6);
  anim = null; busy = false; save(); render();
}
function bath() {
  const p = cur();
  if (p.stats.clean >= 97) { toast(tr('alreadyClean')); return; }
  bathMode = true; render(); toast(tr('rubHint'));
}
function endBath() { bathMode = false; save(); render(); }
function toggleSleep() {
  const p = cur();
  if (!p.asleep && p.stats.energy > 90) { toast(tr('notTired')); return; }
  p.asleep = !p.asleep;
  if (!p.asleep) toast(tr('woke'));
  save(); render(); updateZzz();
}
async function medicine() {
  const p = cur();
  busy = true; render();
  const r = puffRect();
  const [mx, my] = MOUTH[p.species];
  const f = particle('💊', r.left + r.width * mx, r.top - r.height * 0.3, 'food');
  f.style.transform = 'translate(-50%,-50%)';
  await wait(60);
  f.style.transform = `translate(-50%,calc(-50% + ${r.height * (0.3 + my)}px)) scale(.5)`;
  await wait(650); f.remove();
  p.stats.health = clamp(p.stats.health + 70);
  if (p.stats.health >= 50) p.sick = false;
  busy = false; save(); render();
  playClass('hop', 550); burst(['💖', '✨'], 5); toast(tr('cured'));
}

let lastPet = 0;
function pet(e) {
  const p = cur(); if (!p || busy || bathMode) return;
  const now = Date.now(); if (now - lastPet < 450) return; lastPet = now;
  if (p.asleep) { const r = puffRect(); particle('z', r.left + r.width * 0.7, r.top + r.height * 0.3, 'zzz'); return; }
  playClass('squish', 300);
  particle(p.sick ? '🩹' : '💗', e.clientX, e.clientY, 'rise', (Math.random() - 0.5) * 40);
  p.stats.fun = clamp(p.stats.fun + 2); buzz(8); render();
}

/* bath rubbing */
let lastRub = 0;
function rub(e) {
  if (!bathMode) return;
  const r = puffRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  const now = Date.now(); if (now - lastRub < 45) return; lastRub = now;
  bubbleAt(e.clientX, e.clientY);
  const p = cur();
  p.stats.clean = clamp(p.stats.clean + 1.3);
  render();
  if (p.stats.clean >= 100) {
    bathMode = false; burst(['✨', '🫧', '💖'], 6); toast(tr('cleanDone')); playClass('hop', 550); buzz(30);
    save(); render();
  }
}

/* ---------- navigation ---------- */
function go(delta) {
  if (S.puffs.length < 2 || busy) return;
  bathMode = false; anim = null;
  S.current = (S.current + delta + S.puffs.length) % S.puffs.length;
  preload(cur().species);
  els.puffWrap.style.opacity = 0; els.room.style.opacity = 0;
  setTimeout(() => { render(); if (zzzTimer) { clearInterval(zzzTimer); zzzTimer = null; } updateZzz(); els.puffWrap.style.opacity = 1; els.room.style.opacity = 1; }, 220);
  save();
}

/* ---------- screens ---------- */
function show(id) {
  ['start', 'adopt', 'menu'].forEach(s => $(s).hidden = s !== id);
  els.game.hidden = id === 'start' || id === 'adopt';
}
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = tr(e.dataset.t));
  document.querySelectorAll('.langBtn').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
  render();
}
let adoptSel = null;
function openAdopt() {
  adoptSel = null;
  const owned = S.puffs.map(p => p.species);
  $('adoptChoices').innerHTML = ORDER.map(sp => `<button class="choice" data-sp="${sp}" ${owned.includes(sp) ? 'disabled' : ''}><img src="${img(sp, 'base')}" alt=""><span>${SPECIES[sp].name}</span></button>`).join('');
  $('nameStep').hidden = true;
  $('adoptCancel').hidden = S.puffs.length === 0;
  show('adopt');
}
$('adoptChoices').addEventListener('click', e => {
  const b = e.target.closest('.choice'); if (!b || b.disabled) return;
  adoptSel = b.dataset.sp;
  document.querySelectorAll('.choice').forEach(c => c.classList.toggle('sel', c === b));
  $('nameStep').hidden = false;
  $('nameInput').value = SPECIES[adoptSel].name;
});
$('adoptOk').addEventListener('click', () => {
  if (!adoptSel) return;
  const name = $('nameInput').value.trim() || SPECIES[adoptSel].name;
  S.puffs.push({ species: adoptSel, name, asleep: false, sick: false, born: Date.now(),
    stats: { food: 70, fun: 70, energy: 85, clean: 90, health: 100 } });
  S.current = S.puffs.length - 1;
  preload(adoptSel); save();
  show(null); render(); updateZzz();
  setTimeout(() => { playClass('hop', 550); burst(['💖', '✨', '⭐'], 6); toast(tr('newFriend').replace('{n}', name)); }, 300);
});
$('adoptCancel').addEventListener('click', () => show(null));
$('playBtn').addEventListener('click', () => { if (!S.puffs.length) openAdopt(); else { show(null); render(); updateZzz(); } });
document.querySelectorAll('.langBtn').forEach(b => b.addEventListener('click', () => { S.lang = b.dataset.lang; save(); applyLang(); }));
$('menuBtn').addEventListener('click', () => {
  $('newPuffBtn').disabled = S.puffs.length >= ORDER.length;
  resetArm = false; $('resetBtn').classList.remove('confirm'); $('resetBtn').textContent = tr('reset');
  show('menu');
});
$('menuClose').addEventListener('click', () => show(null));
$('newPuffBtn').addEventListener('click', () => { if (S.puffs.length >= ORDER.length) toast(tr('allAdopted')); else openAdopt(); });
$('renameBtn').addEventListener('click', () => {
  const p = cur(); if (!p) return;
  const n = prompt(tr('renamePrompt'), p.name);
  if (n && n.trim()) { p.name = n.trim().slice(0, 16); save(); render(); }
});
let resetArm = false;
$('resetBtn').addEventListener('click', () => {
  if (!resetArm) { resetArm = true; $('resetBtn').classList.add('confirm'); $('resetBtn').textContent = tr('resetConfirm'); return; }
  const lang = S.lang; S = fresh(); S.lang = lang; save(); applyLang(); openAdopt();
});

/* ---------- input ---------- */
const ACTIONS = { feed, play, bath, sleep: toggleSleep, medicine };
els.actions.addEventListener('click', e => {
  const b = e.target.closest('.act'); if (!b || b.disabled) return;
  ACTIONS[b.dataset.act]();
});
$('bathDone').addEventListener('click', endBath);
$('prevBtn').addEventListener('click', () => go(-1));
$('nextBtn').addEventListener('click', () => go(1));

let down = null;
els.game.addEventListener('pointerdown', e => {
  if (e.target.closest('button, header, nav, #bathBar')) return;
  down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
  rub(e);
});
els.game.addEventListener('pointermove', e => {
  if (!down) return;
  if (Math.abs(e.clientX - down.x) > 10 || Math.abs(e.clientY - down.y) > 10) down.moved = true;
  rub(e);
});
els.game.addEventListener('pointerup', e => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!bathMode && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  else if (!down.moved) {
    const r = puffRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) pet(e);
  }
  down = null;
});
els.game.addEventListener('pointercancel', () => down = null);

/* ---------- loop ---------- */
function tick() {
  const now = Date.now();
  simulate(now - S.t); S.t = now;
  const p = cur();
  if (p && p.justWoke) { p.justWoke = false; if (!els.game.hidden) toast(tr('woke')); updateZzz(); }
  S.puffs.forEach(q => delete q.justWoke);
  render();
}
setInterval(tick, 1000);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(); else { tick(); swCheck(); }
});

/* ---------- boot ---------- */
$('ver').textContent = 'v' + APP_VERSION;
$('startPuffs').innerHTML = ORDER.map(sp => `<img src="${img(sp, 'base')}" alt="${SPECIES[sp].name}">`).join('');
simulate(Date.now() - S.t); S.t = Date.now();
S.puffs.forEach(q => delete q.justWoke);
if (S.puffs.length) { if (S.current >= S.puffs.length) S.current = 0; preload(cur().species); }
applyLang();
show('start');

/* ---------- service worker (auto update) ---------- */
let swReg = null;
function swCheck() { if (swReg) swReg.update().catch(() => {}); }
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true; save(); location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; swCheck(); }).catch(() => {});
}
