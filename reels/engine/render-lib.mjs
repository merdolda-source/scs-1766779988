// Scene -> MP4. Same contract as the CLI in render.mjs, callable from the
// orchestrator so a batch of posts reuses one browser instead of one per clip.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeTrack, styleForScene } from '../src/music.mjs';

// Chromium lives in different places depending on where this runs: a fixed path
// in the dev sandbox, Playwright's own download directory in CI. An explicit
// CHROME_PATH wins; otherwise fall back to the sandbox path if it exists, and
// finally let Playwright resolve its own install.
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH
  || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);

export async function openBrowser() {
  return chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none'],
  });
}

export async function renderScene({
  browser, sceneDir, data, out, fps = 30, width = 1080, height = 1920, format = 'jpeg',
  // Silent reels get almost no reach. The bed is generated, not licensed, so it
  // can never be claimed against the account. `audio: null` renders silent.
  audio = 'auto',
  // Instagram picks a frame as the cover on its own; giving it one produces a
  // far better grid thumbnail than whatever frame it lands on.
  coverAt = 'auto',
}) {
  const own = !browser;
  const b = browser || await openBrowser();
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const page0 = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  let duration, beats;
  try {
    await page0.addInitScript((d) => { window.__DATA = d; }, data);
    await page0.goto('file://' + path.join(sceneDir, 'index.html'));
    await page0.waitForFunction(() => !!window.__scene, null, { timeout: 20000 });
    duration = await page0.evaluate(() => window.__scene.duration);
    // Scenes may expose message/beat arrival times (e.g. chat bubbles) for
    // audio to sync against; scenes without them just get an empty array.
    beats = await page0.evaluate(() => window.__scene.beats || []);
  } finally {
    await page0.close();
  }

  // The bed follows the scene: goal alerts get the cue with the riser, tables
  // get something that stays out of the way, chat gets near-silence with a pop
  // timed to each bubble instead of a stadium anthem competing with the text.
  const audioPath = audio === 'auto'
    ? makeTrack(duration, path.join(path.dirname(out), '_audio'),
        styleForScene(path.basename(sceneDir)), beats)
    : audio;

  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...(audioPath
      ? ['-i', audioPath]
      : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']),
    '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100',
    '-movflags', '+faststart', '-r', String(fps), out,
  ]);
  const ffErr = [];
  ff.stderr.on('data', (d) => ffErr.push(d.toString()));

  const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.addInitScript((d) => { window.__DATA = d; }, data);
    await page.goto('file://' + path.join(sceneDir, 'index.html'));
    await page.waitForFunction(() => !!window.__scene, null, { timeout: 20000 });

    const total = Math.ceil(duration * fps);
    const t0 = Date.now();

    // A cover taken near the end shows the finished graphic; the opening frames
    // are mid-animation and make a poor thumbnail.
    const coverTime = coverAt === 'auto' ? duration * 0.82 : coverAt;
    const coverFrame = Math.min(total - 1, Math.max(0, Math.round(coverTime * fps)));
    const coverPath = out.replace(/\.mp4$/, '-cover.jpg');

    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.__scene.seek(t), f / fps);
      const buf = await page.screenshot(
        format === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 95 });
      if (f === coverFrame) {
        fs.writeFileSync(coverPath,
          await page.screenshot({ type: 'jpeg', quality: 92 }));
      }
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }

    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg failed: ' + ffErr.join(''));

    // Beat-synced audio (chat pops) is cued to one specific script and gets a
    // fresh random filename each render rather than the deterministic
    // {style}-{seconds}s.wav the other tracks reuse - it is muxed into `out`
    // already, so nothing needs the loose wav sitting in _audio afterward.
    if (beats.length && audioPath && fs.existsSync(audioPath)) {
      fs.rmSync(audioPath, { force: true });
    }

    const size = fs.statSync(out).size;
    return {
      out, cover: fs.existsSync(coverPath) ? coverPath : null,
      audio: audioPath ? path.basename(audioPath) : null,
      audioStyle: audio === 'auto' ? styleForScene(path.basename(sceneDir)) : null,
      seconds: +duration.toFixed(2), frames: total,
      sizeMB: +(size / 1048576).toFixed(2),
      wallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
      errors,
    };
  } finally {
    await page.close();
    if (own) await b.close();
  }
}
