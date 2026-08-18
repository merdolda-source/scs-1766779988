// Original music, synthesised from scratch.
//
// Instagram's API cannot attach tracks from Instagram's own audio library - only
// audio baked into the file gets published. Baking in a commercial track invites
// a copyright claim, so the track is generated here instead: it is ours, so it
// can never be claimed against the account.
//
// 128 BPM, A minor, four-chord loop. Kick, hat, sub bass, arpeggio and a soft
// pad, mixed and soft-clipped, written straight out as a WAV.
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// A minor: Am - F - C - G
const CHORDS = [
  { root: 110.00, tones: [220.00, 261.63, 329.63] }, // Am
  { root: 87.31, tones: [174.61, 220.00, 261.63] },  // F
  { root: 130.81, tones: [261.63, 329.63, 392.00] }, // C
  { root: 98.00, tones: [196.00, 246.94, 293.66] },  // G
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const env = (t, attack, decay) =>
  t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay);

// Cheap deterministic noise so a given track always renders identically.
function noiseGen(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

function render(seconds) {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  const noise = noiseGen();
  let hatState = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bar = Math.floor(t / BAR);
    const chord = CHORDS[bar % CHORDS.length];
    const inBar = t - bar * BAR;
    const beat = inBar / BEAT;

    let s = 0;

    // Kick on 1 and 3, plus a pickup before the bar turns over.
    for (const hit of [0, 2, 3.5]) {
      const dt = (beat - hit) * BEAT;
      if (dt >= 0 && dt < 0.5) {
        const f = 45 + 95 * Math.exp(-dt / 0.028);
        s += Math.sin(2 * Math.PI * f * dt) * env(dt, 0.002, 0.10) * 0.95;
      }
    }

    // Hats on eighths, a touch quieter off the beat.
    const eighth = beat * 2;
    const dtH = (eighth - Math.floor(eighth)) * (BEAT / 2);
    hatState = 0.85 * hatState + 0.15 * noise();
    const bright = noise() - hatState;              // crude high-pass
    s += bright * env(dtH, 0.001, 0.018) * (Math.floor(eighth) % 2 ? 0.16 : 0.24);

    // Sub bass: root, re-triggered each half bar.
    const dtB = (beat % 2) * BEAT;
    const bassEnv = env(dtB, 0.006, 0.55);
    s += Math.sin(2 * Math.PI * chord.root * t) * bassEnv * 0.45;
    s += Math.sin(4 * Math.PI * chord.root * t) * bassEnv * 0.10;

    // Sixteenth arpeggio through the chord tones.
    const step = Math.floor(beat * 4);
    const dtA = (beat * 4 - step) * (BEAT / 4);
    const tone = chord.tones[step % chord.tones.length] * (step % 8 >= 4 ? 2 : 1);
    const tri = Math.asin(Math.sin(2 * Math.PI * tone * t)) * (2 / Math.PI);
    s += tri * env(dtA, 0.004, 0.075) * 0.20;

    // Pad, quiet, just to glue it together.
    for (const f of chord.tones) s += Math.sin(2 * Math.PI * f * t) * 0.035;

    // Soft clip keeps peaks in check without a hard limiter's crunch.
    out[i] = Math.tanh(s * 0.8);
  }

  // Short fades so the file never starts or ends on a click.
  const fade = Math.floor(0.05 * SR);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[n - 1 - i] *= i / fade;
  }
  return out;
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(1, 22);          // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2);
  }
  return buf;
}

// Writes a track at least `seconds` long and returns its path. Cached per
// length, since re-synthesising the same bed for every clip is pure waste.
export function makeTrack(seconds, dir) {
  const secs = Math.ceil(seconds) + 1;
  const file = path.join(dir, `bed-${secs}s.wav`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, toWav(render(secs)));
  return file;
}
