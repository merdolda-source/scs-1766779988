import { View } from './view.js';
import { Cascade } from './sim.js';
import { LEVELS, buildLevel, addBridge, SPACING, STANDING } from './level.js';
import { pickRandomPicture, PICTURES } from './images.js';

const $ = (id) => document.getElementById(id);
const ALBUM_KEY = 'domino.album.v1';

// ---- reel mode -------------------------------------------------------------
// ?reel=1 turns the page into a frame-stepped video source: no HUD, no rAF loop,
// gaps bridged automatically, and a fixed seed so the same URL always renders the
// same clip. tools/render-reel.mjs drives it and pipes frames into ffmpeg.
const params = new URLSearchParams(location.search);
const REEL = params.has('reel');
const REEL_OPTS = {
  level: Number(params.get('level') ?? 0),
  seed: Number(params.get('seed') ?? 1),
  speed: Number(params.get('speed') ?? 1),
  picture: params.get('picture') || null,
  hook: Number(params.get('hook') ?? 0.7),   // seconds before the first tile drops
  hold: Number(params.get('hold') ?? 1.8),   // seconds to sit on the finished picture
};

const ui = {
  levelName: $('levelName'), budget: $('budget'), estimate: $('estimate'),
  progress: $('progress'), progressBar: $('progressBar'),
  startBtn: $('startBtn'), resetBtn: $('resetBtn'),
  speeds: $('speeds'), hint: $('hint'),
  result: $('result'), resultTitle: $('resultTitle'), resultPct: $('resultPct'),
  resultNote: $('resultNote'), nextBtn: $('nextBtn'), retryBtn: $('retryBtn'),
  album: $('album'), albumBtn: $('albumBtn'), albumPanel: $('albumPanel'),
  albumClose: $('albumClose'),
  reelLayer: $('reelLayer'), reelHook: $('reelHook'), reelTitle: $('reelTitle'),
};

const view = new View($('gl'));
const game = {
  levelIndex: 0,
  field: null,
  sim: null,
  remaining: 0,
  phase: 'build',
  speed: 1,
  lastPicture: null,
};

let drag = null;

function loadAlbum() {
  try { return JSON.parse(localStorage.getItem(ALBUM_KEY)) || {}; } catch { return {}; }
}
function saveAlbum(a) {
  try { localStorage.setItem(ALBUM_KEY, JSON.stringify(a)); } catch { /* private mode */ }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startLevel(index, opts = {}) {
  game.levelIndex = index % LEVELS.length;
  const cfg = LEVELS[game.levelIndex];

  let picture;
  if (opts.picture) picture = PICTURES.find((p) => p.id === opts.picture) || PICTURES[0];
  else if (opts.seed !== undefined) {
    picture = PICTURES[Math.floor(mulberry32(opts.seed)() * PICTURES.length)];
  } else picture = pickRandomPicture(game.lastPicture);
  game.lastPicture = picture.id;

  const seed = opts.seed !== undefined ? opts.seed : (Date.now() ^ (index * 7919)) >>> 0;
  game.field = buildLevel({ ...cfg, picture, seed });
  game.remaining = game.field.budget;
  game.phase = 'build';
  game.speed = 1;

  view.setField(game.field, game.field.count + game.field.budget + 8);
  view.bounds = game.field.bounds;
  view.setMarkers(game.field.gapMarkers);
  rebuildSim();

  ui.levelName.textContent = `${game.levelIndex + 1}. ${cfg.name}`;
  ui.result.classList.add('hidden');
  ui.speeds.classList.add('hidden');
  ui.startBtn.classList.remove('hidden');
  ui.resetBtn.classList.remove('hidden');
  ui.hint.classList.remove('hidden');
  updateHud();
}

function rebuildSim() {
  game.sim = new Cascade(game.field);
  view.syncAll(game.field, game.sim);
  updateHud();
}

function updateHud() {
  ui.budget.textContent = game.remaining;
  const secs = Cascade.estimateSeconds(game.field.count);
  ui.estimate.textContent = secs < 60
    ? `~${Math.round(secs)} sn`
    : `~${Math.floor(secs / 60)} dk ${Math.round(secs % 60)} sn`;
  const pct = Math.round(game.sim.progress * 100);
  ui.progress.textContent = `%${pct}`;
  ui.progressBar.style.width = `${pct}%`;
}

// ---- placing bridges -------------------------------------------------------

function ghostPointsFor(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  if (dist < SPACING) return { pts: [], ux: 0, uz: 1, n: 0 };
  const ux = dx / dist, uz = dz / dist;
  const n = Math.min(Math.floor(dist / SPACING), game.remaining);
  const pts = [];
  for (let i = 1; i <= n; i++) pts.push([a.x + ux * SPACING * i, a.z + uz * SPACING * i]);
  return { pts, ux, uz, n };
}

function onPointerDown(e) {
  if (game.phase !== 'build') return;
  const p = view.pick(e.clientX, e.clientY);
  if (!p) return;
  drag = { x: p.x, z: p.z };
  $('gl').setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!drag || game.phase !== 'build') return;
  const p = view.pick(e.clientX, e.clientY);
  if (!p) return;
  const g = ghostPointsFor(drag, { x: p.x, z: p.z });
  view.setGhosts(g.pts, g.ux, g.uz);
  ui.budget.textContent = `${game.remaining - g.n}`;
}

function onPointerUp(e) {
  if (!drag || game.phase !== 'build') return;
  const p = view.pick(e.clientX, e.clientY);
  view.clearGhosts();
  if (p) {
    const used = addBridge(game.field, drag.x, drag.z, p.x, p.z, game.remaining);
    if (used > 0) { game.remaining -= used; rebuildSim(); }
    else flash(ui.budget);
  }
  drag = null;
  updateHud();
}

function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

// ---- run -------------------------------------------------------------------

function startRun() {
  if (game.phase !== 'build') return;
  game.phase = 'run';
  view.clearGhosts();
  view.clearMarkers();
  game.sim.ignite(0);
  ui.startBtn.classList.add('hidden');
  ui.resetBtn.classList.add('hidden');
  ui.hint.classList.add('hidden');
  ui.speeds.classList.remove('hidden');
}

function finishRun() {
  game.phase = 'result';
  ui.speeds.classList.add('hidden');
  const pct = Math.round(game.sim.progress * 100);
  const pic = game.field.picture;

  ui.resultTitle.textContent = pic.name;
  ui.resultPct.textContent = `%${pct}`;
  ui.resultNote.textContent =
    pct >= 97 ? 'Tam açıldı! Koleksiyona eklendi.'
      : pct >= 70 ? 'Neredeyse tamam. Kalan kısım karanlıkta kaldı.'
        : 'Zincir erken koptu — resmin çoğu gizli kaldı.';

  if (pct >= 60) {
    const album = loadAlbum();
    album[pic.id] = Math.max(album[pic.id] || 0, pct);
    saveAlbum(album);
  }
  renderAlbum();
  ui.result.classList.remove('hidden');
}

function renderAlbum() {
  const album = loadAlbum();
  ui.album.innerHTML = '';
  for (const p of PICTURES) {
    const got = album[p.id];
    const cell = document.createElement('div');
    cell.className = 'cell' + (got ? '' : ' locked');
    cell.innerHTML = got ? `<b>${p.name}</b><span>%${got}</span>` : `<b>?</b><span>kilitli</span>`;
    ui.album.appendChild(cell);
  }
}

// ---- bridging helper shared by the test harness and reel mode ---------------

function autoBridge() {
  const f = game.field;
  const ends = [];
  for (let i = 1; i < f.count; i++) {
    if (f.sectionOf[i] !== f.sectionOf[i - 1] && f.sectionOf[i] >= 0) ends.push([i - 1, i]);
  }
  let used = 0, full = 0, shortcut = 0;
  for (const [a, b] of ends) {
    let n = addBridge(game.field, f.px[a], f.pz[a], f.px[b], f.pz[b], game.remaining);
    if (n > 0) full++;
    else {
      let best = -1, bestD = Infinity;
      for (let j = b; j < f.count; j++) {
        const d = Math.hypot(f.px[j] - f.px[a], f.pz[j] - f.pz[a]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best !== -1) {
        n = addBridge(game.field, f.px[a], f.pz[a], f.px[best], f.pz[best], game.remaining);
        if (n > 0) shortcut++;
      }
    }
    game.remaining -= n;
    used += n;
  }
  rebuildSim();
  return { gaps: ends.length, full, shortcut, used, remaining: game.remaining };
}

// ---- reel driver -----------------------------------------------------------

function setupReel() {
  document.body.classList.add('reel');
  startLevel(REEL_OPTS.level, { seed: REEL_OPTS.seed, picture: REEL_OPTS.picture });
  autoBridge();
  view.clearMarkers();
  view.syncAll(game.field, game.sim);

  const pic = game.field.picture;
  ui.reelLayer.classList.remove('hidden');
  ui.reelHook.textContent = 'NE ÇIKACAK?';
  ui.reelHook.style.opacity = '1';
  ui.reelTitle.style.opacity = '0';

  let t = 0;
  let ignited = false;
  let finishedAt = -1;

  window.__reel = {
    get done() { return finishedAt >= 0 && t - finishedAt >= REEL_OPTS.hold; },
    get info() {
      return {
        picture: pic.name, pictureId: pic.id,
        tiles: game.field.count,
        revealed: Math.round(game.sim.progress * 100),
        seconds: +t.toFixed(2),
      };
    },
    step(dt) {
      t += dt;

      if (!ignited && t >= REEL_OPTS.hook) { startRun(); ignited = true; }
      if (ignited && finishedAt < 0) {
        const running = game.sim.step(dt, REEL_OPTS.speed);
        view.syncMoving(game.field, game.sim);
        if (!running) finishedAt = t;
      }

      // Hook fades out once the wave is clearly moving; the title fades in on the
      // reveal, which is the beat the whole clip is built around.
      const hookFade = Math.min(1, Math.max(0, (t - REEL_OPTS.hook - 0.5) / 0.5));
      ui.reelHook.style.opacity = String(1 - hookFade);
      if (finishedAt >= 0) {
        const k = Math.min(1, (t - finishedAt) / 0.45);
        ui.reelTitle.style.opacity = String(k);
        ui.reelTitle.style.transform = `translateY(${(1 - k) * 18}px) scale(${0.94 + k * 0.06})`;
        ui.reelTitle.textContent = pic.name.toLocaleUpperCase('tr');
      }

      view.render();
    },
  };
}

// ---- loop ------------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (game.phase === 'run') {
    const stillRunning = game.sim.step(dt, game.speed);
    view.syncMoving(game.field, game.sim);
    updateHud();
    if (!stillRunning) finishRun();
  }
  view.render();
  requestAnimationFrame(frame);
}

// ---- wiring ----------------------------------------------------------------

const canvas = $('gl');
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', () => { drag = null; view.clearGhosts(); updateHud(); });

ui.startBtn.addEventListener('click', startRun);
ui.resetBtn.addEventListener('click', () => startLevel(game.levelIndex));
ui.nextBtn.addEventListener('click', () => startLevel(game.levelIndex + 1));
ui.retryBtn.addEventListener('click', () => startLevel(game.levelIndex));
ui.albumBtn.addEventListener('click', () => { renderAlbum(); ui.albumPanel.classList.toggle('hidden'); });
ui.albumClose.addEventListener('click', () => ui.albumPanel.classList.add('hidden'));

for (const btn of ui.speeds.querySelectorAll('button')) {
  btn.addEventListener('click', () => {
    game.speed = Number(btn.dataset.speed);
    for (const b of ui.speeds.querySelectorAll('button')) b.classList.toggle('on', b === btn);
  });
}

window.addEventListener('resize', () => view.resize());
view.resize();

if (REEL) {
  setupReel();
} else {
  startLevel(0);
  requestAnimationFrame(frame);
}

// exposed for the headless smoke test
window.__game = game;
window.__startLevel = (i) => startLevel(i);
window.__autoBridge = autoBridge;
window.__fastForward = () => {
  if (game.phase === 'build') startRun();
  let guard = 0;
  while (game.sim.running && guard++ < 20000) game.sim.step(1 / 60, 8);
  view.syncAll(game.field, game.sim);
  view.render();
  return game.sim.progress;
};
