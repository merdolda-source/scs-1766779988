// Cascade simulation.
//
// This is not a rigid-body solver. Each domino runs a scripted fall curve and
// hands off to its authored successors partway through, which is what actually
// happens with real dominoes: contact occurs early in the rotation, long before
// the tile is flat. Cost is O(active), and only a handful are ever mid-fall, so
// field size barely affects frame time.
//
// Timing is tuned against real domino runs: ~13 tiles per second at this
// spacing, so a 1500-tile field takes close to two minutes at 1x.

import { STANDING, FALLING, FALLEN } from './level.js';

const HALF_PI = Math.PI / 2;
const FALL_TIME = 0.17;   // seconds for one domino to go from upright to flat
const TRIGGER_U = 0.44;   // fraction of the fall at which the next one is hit
const FIXED_DT = 1 / 120;
const CURVE = 1.7;        // slow tip-over, fast slam

export class Cascade {
  constructor(field) {
    this.field = field;
    this.state = new Uint8Array(field.count);
    this.t = new Float32Array(field.count);
    this.theta = new Float32Array(field.count);
    this.fired = new Uint8Array(field.count);
    this.active = [];
    // Dominoes that finished since the last render. They leave `active` the tick
    // they land, so without this the renderer would never write their final
    // flat-on-the-floor transform and they would stay visually upright.
    this.retired = [];
    this.fallenCount = 0;
    this.elapsed = 0;
    this.acc = 0;
    this.running = false;
    this.dirty = true;
  }

  ignite(index = 0) {
    if (index < this.field.count) this._start(index);
    this.running = true;
  }

  _start(i) {
    if (this.state[i] !== STANDING) return;
    this.state[i] = FALLING;
    this.t[i] = 0;
    this.active.push(i);
  }

  // Returns true while anything is still moving.
  step(dt, speed) {
    if (!this.running) return false;
    this.acc += Math.min(dt, 0.25) * speed;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 600) {
      this._tick(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }
    if (this.active.length === 0) this.running = false;
    return this.running;
  }

  _tick(dt) {
    this.elapsed += dt;
    const { links } = this.field;
    const active = this.active;

    for (let k = active.length - 1; k >= 0; k--) {
      const i = active[k];
      this.t[i] += dt;
      const u = this.t[i] / FALL_TIME;

      if (!this.fired[i] && u >= TRIGGER_U) {
        this.fired[i] = 1;
        const next = links[i];
        for (let n = 0; n < next.length; n++) this._start(next[n]);
      }

      if (u >= 1) {
        this.theta[i] = HALF_PI;
        this.state[i] = FALLEN;
        this.fallenCount++;
        this.retired.push(i);
        active[k] = active[active.length - 1];
        active.pop();
      } else {
        this.theta[i] = HALF_PI * Math.pow(u, CURVE);
      }
    }
    this.dirty = true;
  }

  get progress() {
    return this.field.count ? this.fallenCount / this.field.count : 0;
  }

  // How long a full run of this field would take, for the pre-run estimate.
  static estimateSeconds(count) {
    return count * FALL_TIME * TRIGGER_U + FALL_TIME;
  }
}

export { STANDING, FALLING, FALLEN };
