// Renders one deterministic Reel to MP4.
//
//   node tools/render-reel.mjs --seed 7 --level 1 --out ../dist/reels/r7.mp4
//
// Frames are stepped by hand (never by rAF) so output is frame-exact and the
// same seed always produces the same clip. PNG frames go straight into ffmpeg
// over a pipe - no temp files.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? def : process.argv[i + 1];
}

const opts = {
  seed: Number(arg('seed', 1)),
  level: Number(arg('level', 0)),
  speed: Number(arg('speed', 1)),
  picture: arg('picture', ''),
  fps: Number(arg('fps', 30)),
  width: Number(arg('width', 1080)),
  height: Number(arg('height', 1920)),
  maxSeconds: Number(arg('maxSeconds', 95)),
  out: path.resolve(arg('out', path.join(root, 'out', `reel-${arg('seed', 1)}.mp4`))),
};

fs.mkdirSync(path.dirname(opts.out), { recursive: true });

const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(opts.fps), '-i', '-',
  // Instagram wants an audio track present; a silent one keeps the file valid
  // until real music is dropped in.
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-shortest',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
  '-c:a', 'aac', '-b:a', '96k',
  '-movflags', '+faststart',
  '-r', String(opts.fps),
  opts.out,
]);
ff.stderr.on('data', (d) => process.stderr.write(d));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({
  viewport: { width: opts.width, height: opts.height },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const qs = new URLSearchParams({
  reel: '1', level: String(opts.level), seed: String(opts.seed), speed: String(opts.speed),
});
if (opts.picture) qs.set('picture', opts.picture);

await page.goto('file://' + path.join(root, 'index.html') + '?' + qs);
await page.waitForFunction(() => !!window.__reel, null, { timeout: 20000 });

const dt = 1 / opts.fps;
const maxFrames = Math.ceil(opts.maxSeconds * opts.fps);
let frames = 0;
const t0 = Date.now();

for (; frames < maxFrames; frames++) {
  const done = await page.evaluate((d) => { window.__reel.step(d); return window.__reel.done; }, dt);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (done) break;
  if (frames % 90 === 0) {
    const s = (Date.now() - t0) / 1000;
    process.stderr.write(`  ${frames} frames (${(frames / opts.fps).toFixed(1)}s clip, ${s.toFixed(0)}s wall)\n`);
  }
}

const info = await page.evaluate(() => window.__reel.info);
await browser.close();

ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));

const size = fs.existsSync(opts.out) ? fs.statSync(opts.out).size : 0;
console.log(JSON.stringify({
  out: opts.out,
  ok: code === 0 && size > 0,
  seconds: +(frames / opts.fps).toFixed(2),
  frames,
  sizeMB: +(size / 1048576).toFixed(2),
  renderWallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
  ...info,
  errors,
}, null, 2));
process.exit(code === 0 && size > 0 ? 0 : 1);
