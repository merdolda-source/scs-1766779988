// Generic scene renderer.
//
//   node engine/render.mjs --scene scenes/match-result --data data/sample-match.json \
//                          --out ../dist/reels/mac-sonu.mp4
//
// A scene is a self-contained HTML page that reads window.__DATA and exposes
//   window.__scene = { duration, seek(t) }
// seek() must set every animated property from absolute time alone - no CSS
// transitions, no rAF - so a frame is reproducible from t and nothing else.
// Frames are piped straight into ffmpeg; no temp files.
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
  scene: path.resolve(root, arg('scene', 'scenes/match-result')),
  data: path.resolve(root, arg('data', 'data/sample-match.json')),
  out: path.resolve(arg('out', path.join(root, 'out', 'scene.mp4'))),
  fps: Number(arg('fps', 30)),
  // JPEG frames encode far faster than PNG and the difference is invisible
  // after H.264; PNG stays available for anything needing exact pixels.
  format: arg('format', 'jpeg'),
  width: Number(arg('width', 1080)),
  height: Number(arg('height', 1920)),
};

const data = JSON.parse(fs.readFileSync(opts.data, 'utf8'));
fs.mkdirSync(path.dirname(opts.out), { recursive: true });

const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(opts.fps), '-i', '-',
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
  '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-r', String(opts.fps),
  opts.out,
]);
ff.stderr.on('data', (d) => process.stderr.write(d));

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width: opts.width, height: opts.height },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.addInitScript((d) => { window.__DATA = d; }, data);
await page.goto('file://' + path.join(opts.scene, 'index.html'));
await page.waitForFunction(() => !!window.__scene, null, { timeout: 20000 });

const scene = await page.evaluate(() => ({
  duration: window.__scene.duration, meta: window.__scene.meta || null,
}));

const total = Math.ceil(scene.duration * opts.fps);
const t0 = Date.now();

for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.__scene.seek(t), f / opts.fps);
  const buf = await page.screenshot(
    opts.format === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 120 === 0) {
    process.stderr.write(`  ${f}/${total} frames (${((Date.now() - t0) / 1000).toFixed(0)}s wall)\n`);
  }
}

await browser.close();
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));

const size = fs.existsSync(opts.out) ? fs.statSync(opts.out).size : 0;
console.log(JSON.stringify({
  out: opts.out,
  ok: code === 0 && size > 0 && errors.length === 0,
  seconds: +scene.duration.toFixed(2),
  frames: total,
  sizeMB: +(size / 1048576).toFixed(2),
  renderWallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
  meta: scene.meta,
  errors,
}, null, 2));
process.exit(code === 0 && size > 0 ? 0 : 1);
