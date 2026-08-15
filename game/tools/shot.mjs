// Headless smoke test: loads the game, bridges the gaps, runs the cascade and
// screenshots each stage. Run: node tools/shot.mjs [levelIndex]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'shots');
const level = Number(process.argv[2] || 0);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForTimeout(1200);
if (level > 0) {
  await page.evaluate((l) => window.__startLevel(l), level);
  await page.waitForTimeout(900);
}

const info = await page.evaluate(() => ({
  level: window.__game.levelIndex,
  count: window.__game.field.count,
  budget: window.__game.field.budget,
  sections: window.__game.field.sectionCount,
  estimate: document.getElementById('estimate').textContent,
}));
await page.screenshot({ path: path.join(out, `L${level}-1-build.png`) });

const bridged = await page.evaluate(() => window.__autoBridge());
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, `L${level}-2-bridged.png`) });

// Run at 4x and grab a frame while the wave is crossing the field.
await page.evaluate(() => {
  document.getElementById('startBtn').click();
  window.__game.speed = 4;
});
const waitMs = Math.max(1200, (info.count * 0.0748 * 1000) / 4 * 0.45);
await page.waitForTimeout(waitMs);
const midPct = await page.evaluate(() => Math.round(window.__game.sim.progress * 100));
await page.screenshot({ path: path.join(out, `L${level}-3-mid.png`) });

await page.waitForFunction(() => window.__game.phase === 'result', null, { timeout: 120000 });
await page.evaluate(() => {
  document.getElementById('result').style.visibility = 'hidden';
  document.getElementById('top').style.opacity = '0.25';
  document.getElementById('bottom').style.opacity = '0';
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, `L${level}-4-reveal.png`) });

const final = await page.evaluate(() => ({
  picture: window.__game.field.picture.name,
  revealed: Math.round(window.__game.sim.progress * 100) + '%',
  total: window.__game.field.count,
}));

console.log(JSON.stringify({ ...info, bridged, midPct: midPct + '%', ...final, errors }, null, 2));
await browser.close();
