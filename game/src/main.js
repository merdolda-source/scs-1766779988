import { View } from './view.js';
import { Cascade } from './sim.js';
import { LEVELS, buildLevel, addBridge, SPACING, STANDING } from './level.js';
import { pickRandomPicture, PICTURES } from './images.js';

const $ = (id) => document.getElementById(id);
const ALBUM_KEY = 'domino.album.v1';

const ui = {
  levelName: $('levelName'), budget: $('budget'), estimate: $('estimate'),
  progress: $('progress'), progressBar: $('progressBar'),
  startBtn: $('startBtn'), resetBtn: $('resetBtn'),
  speeds: $('speeds'), hint: $('hint'),
  result: $('result'), resultTitle: $('resultTitle'), resultPct: $('resultPct'),
  resultNote: $('resultNote'), nextBtn: $('nextBtn'), retryBtn: $('retryBtn'),
  album: $('album'), albumBtn: $('albumBtn'), albumPanel: $('albumPanel'),
  albumClose: $('albumClose'),
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

function startLevel(index) {
  game.levelIndex = index % LEVELS.length;
  const cfg = LEVELS[game.levelIndex];
  const picture = pickRandomPicture(game.lastPicture);
  game.lastPicture = picture.id;

  game.field = buildLevel({ ...cfg, picture, seed: (Date.now() ^ (index * 7919)) >>> 0 });
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
    if (used > 0) {
      game.remaining -= used;
      rebuildSim();
    } else {
      flash(ui.budget);
    }
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
    cell.innerHTML = got
      ? `<b>${p.name}</b><span>%${got}</span>`
      : `<b>?</b><span>kilitli</span>`;
    ui.album.appendChild(cell);
  }
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
startLevel(0);
requestAnimationFrame(frame);

// exposed for the headless smoke test
window.__game = game;
window.__startLevel = (i) => startLevel(i);

// Bridges every gap the straightforward way, so a test run can show a full reveal.
window.__autoBridge = () => {
  const f = game.field;
  const ends = [];
  for (let i = 1; i < f.count; i++) {
    if (f.sectionOf[i] !== f.sectionOf[i - 1] && f.sectionOf[i] >= 0) ends.push([i - 1, i]);
  }
  let used = 0, full = 0, shortcut = 0;
  for (const [a, b] of ends) {
    // Preferred play: bridge the gap head-on and keep the whole picture.
    let n = addBridge(game.field, f.px[a], f.pz[a], f.px[b], f.pz[b], game.remaining);
    if (n > 0) full++;
    else {
      // Too expensive: hop sideways to the nearest tile further down the run.
      // Cheap, but everything skipped over stays dark - the core trade-off.
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
};
window.__fastForward = () => {
  if (game.phase === 'build') startRun();
  let guard = 0;
  while (game.sim.running && guard++ < 20000) game.sim.step(1 / 60, 8);
  view.syncAll(game.field, game.sim);
  view.render();
  return game.sim.progress;
};
