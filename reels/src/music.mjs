// Original music, synthesised here.
//
// Instagram's API only publishes audio baked into the file - it cannot attach
// anything from Instagram's own audio library - and a commercial track baked in
// is what earns a copyright strike. This account has already lost one profile,
// so the bed is built from scratch: it cannot be claimed against us.
//
// Three styles, aiming at terrace atmosphere rather than generic library music:
// layered drums, crowd wash, brass stabs, delay for space.
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---- primitives ------------------------------------------------------------

function rng(seed = 987654321) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

// Attack/decay envelope. `hold` keeps it open before the decay starts.
const adsr = (t, a, hold, d) => {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + hold) return 1;
  return Math.exp(-(t - a - hold) / d);
};

// Detuned saw stack - the brass-ish body of the anthem.
function sawStack(t, f, voices = 3, detune = 0.006) {
  let s = 0;
  for (let v = 0; v < voices; v++) {
    const fv = f * (1 + (v - (voices - 1) / 2) * detune);
    const ph = (t * fv) % 1;
    s += 2 * ph - 1;
  }
  return s / voices;
}

const tri = (t, f) => Math.asin(Math.sin(2 * Math.PI * f * t)) * (2 / Math.PI);

// ---- drum voices -----------------------------------------------------------

function kick(dt) {
  if (dt < 0 || dt > 0.6) return 0;
  const f = 48 + 110 * Math.exp(-dt / 0.026);
  const click = Math.exp(-dt / 0.004) * 0.4;
  return (Math.sin(2 * Math.PI * f * dt) + click) * adsr(dt, 0.001, 0.01, 0.13);
}

function snare(dt, n) {
  if (dt < 0 || dt > 0.4) return 0;
  const body = Math.sin(2 * Math.PI * 190 * dt) * 0.5 + Math.sin(2 * Math.PI * 278 * dt) * 0.3;
  return (n() * 0.9 + body) * adsr(dt, 0.001, 0.012, 0.075);
}

function hat(dt, n, open = false) {
  if (dt < 0 || dt > 0.3) return 0;
  return n() * adsr(dt, 0.0008, 0.002, open ? 0.10 : 0.016);
}

// Marching toms give the terrace feel a drum kit alone does not.
function tom(dt, f) {
  if (dt < 0 || dt > 0.5) return 0;
  const fr = f * (1 + 0.5 * Math.exp(-dt / 0.05));
  return Math.sin(2 * Math.PI * fr * dt) * adsr(dt, 0.002, 0.02, 0.14);
}

// ---- styles ----------------------------------------------------------------

// Progressions in A minor. Anthem leans heroic, goal leans triumphant.
const PROG = {
  anthem: [
    { root: 110.00, chord: [220.00, 261.63, 329.63] }, // Am
    { root: 87.31, chord: [174.61, 220.00, 261.63] },  // F
    { root: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { root: 98.00, chord: [196.00, 246.94, 293.66] },  // G
  ],
  goal: [
    { root: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { root: 98.00, chord: [196.00, 246.94, 293.66] },  // G
    { root: 110.00, chord: [220.00, 277.18, 329.63] }, // A
    { root: 116.54, chord: [233.08, 293.66, 349.23] }, // Bb
  ],
  calm: [
    { root: 110.00, chord: [220.00, 261.63, 329.63] },
    { root: 130.81, chord: [261.63, 329.63, 392.00] },
    { root: 87.31, chord: [174.61, 220.00, 261.63] },
    { root: 98.00, chord: [196.00, 246.94, 293.66] },
  ],
};

const STYLE = {
  anthem: { bpm: 104, prog: PROG.anthem, crowd: 0.085, brass: 0.30, toms: true, drive: 0.9 },
  goal: { bpm: 140, prog: PROG.goal, crowd: 0.16, brass: 0.42, toms: true, drive: 1.15 },
  calm: { bpm: 96, prog: PROG.calm, crowd: 0.035, brass: 0.15, toms: false, drive: 0.7 },
  // A stadium anthem under a fake chat read as mismatched - a dialogue format
  // needs near-silence with texture, not a drum-and-brass bed competing with
  // the thing the viewer is trying to read.
  chat: { bpm: 84, prog: PROG.calm, crowd: 0, brass: 0, toms: false, drive: 0.35 },
};

function render(seconds, styleName, beats = []) {
  const st = STYLE[styleName] || STYLE.anthem;
  const isChat = styleName === 'chat';
  const BEAT = 60 / st.bpm;
  const BAR = BEAT * 4;
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);

  const nz = rng(4242);
  const crowdN = rng(31337);
  // Delay line gives the stabs room without a full reverb.
  const delayLen = Math.floor(BEAT * 0.75 * SR);
  const delay = new Float32Array(delayLen);
  let dIdx = 0;

  // Crowd wash: heavily smoothed noise, slowly swelling.
  let lp1 = 0, lp2 = 0, hpState = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bar = Math.floor(t / BAR);
    const step = st.prog[bar % st.prog.length];
    const beat = (t - bar * BAR) / BEAT;

    let dry = 0;
    let wet = 0;

    if (!isChat) {
      // --- drums
      for (const b of [0, 2]) dry += kick((beat - b) * BEAT) * 1.0;
      if (styleName !== 'calm') dry += kick((beat - 3.5) * BEAT) * 0.55;
      for (const b of [1, 3]) dry += snare((beat - b) * BEAT, nz) * 0.42;

      const eighth = Math.floor(beat * 2);
      const dtH = (beat * 2 - eighth) * (BEAT / 2);
      dry += hat(dtH, nz, eighth % 4 === 3) * (eighth % 2 ? 0.10 : 0.15);

      if (st.toms && bar % 4 === 3) {
        const s16f = Math.floor(beat * 4);
        const dtT = (beat * 4 - s16f) * (BEAT / 4);
        if (s16f >= 8) dry += tom(dtT, 140 - (s16f - 8) * 8) * 0.45;
      }

      // --- bass
      const dtB = (beat % 2) * BEAT;
      const be = adsr(dtB, 0.006, 0.10, 0.5);
      dry += Math.sin(2 * Math.PI * step.root * t) * be * 0.50;
      dry += Math.sin(4 * Math.PI * step.root * t) * be * 0.12;

      // --- brass stabs on the offbeats
      const stab = Math.floor(beat * 2);
      const dtS = (beat * 2 - stab) * (BEAT / 2);
      if (stab % 2 === 0 || styleName === 'goal') {
        let br = 0;
        for (const f of step.chord) br += sawStack(t, f);
        br *= adsr(dtS, 0.012, 0.03, 0.16) * st.brass;
        dry += br;
        wet += br * 0.35;
      }
    } else {
      // Just a soft, slow-moving pad - texture under the chat, nothing that
      // competes with the reader's attention or a message pop.
      let pad = 0;
      for (const f of step.chord) pad += Math.sin(2 * Math.PI * f * 0.5 * t);
      dry += (pad / step.chord.length) * 0.10 * (0.7 + 0.3 * Math.sin(t * 0.25));
    }

    // --- arpeggio sparkle (kept faint even in chat mode - a little life, not a lead)
    const s16 = Math.floor(beat * 4);
    const dtA = (beat * 4 - s16) * (BEAT / 4);
    const tone = step.chord[s16 % step.chord.length] * 2;
    dry += tri(t, tone) * adsr(dtA, 0.003, 0.01, 0.06) * (isChat ? 0.045 : 0.13);

    if (!isChat) {
      // --- crowd
      const raw = crowdN();
      lp1 += (raw - lp1) * 0.02;
      lp2 += (lp1 - lp2) * 0.02;
      hpState += (lp2 - hpState) * 0.0008;
      const swell = 0.65 + 0.35 * Math.sin(t * 0.55);
      dry += (lp2 - hpState) * st.crowd * swell * 6;
    }

    // --- delay send
    const d = delay[dIdx];
    dry += d * 0.32;
    delay[dIdx] = wet + d * 0.28;
    dIdx = (dIdx + 1) % delayLen;

    // --- message pop: a short, bright blip at each bubble's arrival time,
    // matching what a real chat app plays on receive. This is what actually
    // ties the audio to the format instead of running underneath it unrelated.
    for (const bt of beats) {
      const bdt = t - bt;
      if (bdt >= 0 && bdt < 0.09) {
        const f = 1450 - bdt * 4200;
        dry += Math.sin(2 * Math.PI * f * bdt) * Math.exp(-bdt / 0.03) * 0.30;
      }
    }

    out[i] = Math.tanh(dry * st.drive * 0.62);
  }

  // Goal cue opens with a riser and an impact so it reads instantly as an alert.
  if (styleName === 'goal') {
    const rise = Math.min(n, Math.floor(1.1 * SR));
    for (let i = 0; i < rise; i++) {
      const u = i / rise;
      const f = 180 + 1500 * u * u;
      const swoosh = (nz() * 0.5 + Math.sin(2 * Math.PI * f * (i / SR))) * u * u * 0.5;
      out[i] = Math.tanh(out[i] * (0.25 + 0.75 * u) + swoosh);
    }
    const imp = Math.floor(1.05 * SR);
    for (let i = 0; i < Math.min(n - imp, Math.floor(0.6 * SR)); i++) {
      const dt = i / SR;
      out[imp + i] = Math.tanh(out[imp + i]
        + Math.sin(2 * Math.PI * (60 + 90 * Math.exp(-dt / 0.03)) * dt) * Math.exp(-dt / 0.22) * 0.9);
    }
  }

  const fade = Math.floor(0.04 * SR);
  for (let i = 0; i < fade; i++) { out[i] *= i / fade; out[n - 1 - i] *= i / fade; }
  return out;
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2);
  }
  return buf;
}

export const STYLES = Object.keys(STYLE);

// Which bed suits which scene. Goals get the alert cue; tables get something
// that does not fight the numbers.
export function styleForScene(scene) {
  if (scene === 'goal') return 'goal';
  if (scene === 'standings' || scene === 'fixtures' || scene === 'predictions') return 'calm';
  if (scene === 'chat-drama') return 'chat';
  return 'anthem';
}

// `beats` are message-arrival times (seconds) for the chat-pop hits. Chat
// tracks are cued to a specific script, so they are not filename-cached the
// way the other styles are - re-synthesising a few seconds of light pad audio
// costs nothing, and caching by content would need hashing the beat list.
export function makeTrack(seconds, dir, style = 'anthem', beats = []) {
  const secs = Math.ceil(seconds) + 1;
  const name = STYLE[style] ? style : 'anthem';
  if (name === 'chat' && beats.length) {
    const file = path.join(dir, `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.wav`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, toWav(render(secs, name, beats)));
    return file;
  }
  const file = path.join(dir, `${name}-${secs}s.wav`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, toWav(render(secs, name)));
  return file;
}
