// Scene -> MP4. Same contract as the CLI in render.mjs, callable from the
// orchestrator so a batch of posts reuses one browser instead of one per clip.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
}) {
  const own = !browser;
  const b = browser || await openBrowser();
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-r', String(fps), out,
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

    const duration = await page.evaluate(() => window.__scene.duration);
    const total = Math.ceil(duration * fps);
    const t0 = Date.now();

    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.__scene.seek(t), f / fps);
      const buf = await page.screenshot(
        format === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }

    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg failed: ' + ffErr.join(''));

    const size = fs.statSync(out).size;
    return {
      out, seconds: +duration.toFixed(2), frames: total,
      sizeMB: +(size / 1048576).toFixed(2),
      wallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
      errors,
    };
  } finally {
    await page.close();
    if (own) await b.close();
  }
}
