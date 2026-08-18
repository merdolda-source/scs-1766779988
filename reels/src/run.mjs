// Orchestrator: plan the day, render what is due, upload, publish, record.
//
//   node src/run.mjs                 # do what is due right now
//   node src/run.mjs --all           # render every item planned for today
//   node src/run.mjs --dry-run       # render but never publish
//
// Safe to run on a schedule: the plan is deterministic per day and the ledger
// stops anything being published twice.
import path from 'node:path';
import { config, describeMode } from './config.mjs';
import { planDay } from './planner.mjs';
import { captionFor } from './captions.mjs';
import { openBrowser, renderScene } from '../engine/render-lib.mjs';
import { uploadVideo } from './storage.mjs';
import { publishReel } from './publisher.mjs';
import { hasPosted, postedRecently, record } from './state.mjs';
import crypto from 'node:crypto';

const flag = (n) => process.argv.includes('--' + n);
const DRY = flag('dry-run');
const ALL = flag('all');

// Each scene gets exactly the shape it renders from - scenes never see raw
// source data.
function sceneDataFor(item, plan) {
  const handle = config.handle;
  const us = config.team.name;
  const markUs = (m) => ({
    ...m,
    home: { ...m.home, isUs: m.home.name === us },
    away: { ...m.away, isUs: m.away.name === us },
  });

  if (item.scene === 'match-result') {
    const m = item.match;
    return {
      competition: `Süper Lig${plan.week ? ' · ' + plan.week + '. Hafta' : ''}`,
      home: m.home, away: m.away,
      form: item.form || [],
      standing: item.standing || null,
      leagueName: item.leagueName || 'Süper Lig',
      handle,
    };
  }
  if (item.scene === 'upcoming') {
    const m = item.match;
    return {
      competition: `Süper Lig${plan.week ? ' · ' + plan.week + '. Hafta' : ''}`,
      home: m.home, away: m.away,
      kickoffText: [m.dateText, m.time].filter(Boolean).join(' · '),
      venue: '', cta: 'Skor tahmininiz?', handle,
    };
  }
  if (item.scene === 'fixtures') {
    return {
      competition: item.fixtures.league,
      title: `${item.fixtures.week}. HAFTA`,
      matches: item.fixtures.matches.map(markUs),
      handle,
    };
  }
  if (item.scene === 'standings') {
    return { competition: 'Süper Lig', standings: item.standings.rows, handle };
  }
  throw new Error('unknown scene ' + item.scene);
}

const now = new Date();
const plan = await planDay(now);

console.log(JSON.stringify({ mode: describeMode(), date: plan.date,
  matchDay: plan.matchDay, quiet: plan.quiet, planned: plan.items.length }, null, 2));

if (plan.quiet) {
  console.log('Sessiz gün — bugün paylaşım yok.');
  process.exit(0);
}

// Fingerprint what the post will actually show, so a card whose content has not
// moved since the last few days is skipped rather than reposted.
const fingerprint = (scene, data) => crypto.createHash('sha1')
  .update(scene + '|' + JSON.stringify(data, (k, v) => (k === 'handle' ? undefined : v)))
  .digest('hex').slice(0, 16);

const due = plan.items.filter((i) => ALL || i.at <= now);
const waiting = plan.items.length - due.length;
if (waiting) console.log(`${waiting} aday henüz zamanı gelmediği için beklemede.`);
console.log(`${due.length} aday, günün kotası ${plan.maxPosts}.`);

const browser = await openBrowser();
const results = [];

try {
  let sent = 0;
  for (const item of due) {
    if (sent >= plan.maxPosts) { results.push({ key: item.key, status: 'kota doldu' }); continue; }
    if (hasPosted(item.key)) { results.push({ key: item.key, status: 'zaten paylaşıldı' }); continue; }

    const data = sceneDataFor(item, plan);
    const fp = fingerprint(item.scene, data);
    if (postedRecently(fp)) {
      results.push({ key: item.key, scene: item.scene, status: 'aynı içerik yakın zamanda gitti' });
      continue;
    }

    const out = path.join(config.outDir, `${plan.date}-${item.key}.mp4`);
    const caption = captionFor(item);

    const r = await renderScene({
      browser,
      sceneDir: path.join(config.root, 'scenes', item.scene),
      data, out,
    });
    if (r.errors.length) throw new Error(`${item.scene} render errors: ${r.errors.join(' | ')}`);

    const up = await uploadVideo(out, `reels/${path.basename(out)}`);
    const cover = r.cover
      ? await uploadVideo(r.cover, `reels/${path.basename(r.cover)}`).catch(() => null)
      : null;
    const pub = await publishReel({
      videoUrl: up.url, coverUrl: cover?.url || null, caption, dryRun: DRY,
    });

    if (pub.published) {
      record({ key: item.key, scene: item.scene, mediaId: pub.mediaId, url: up.url, fingerprint: fp });
      sent++;
    } else if (DRY) sent++;

    results.push({
      key: item.key, scene: item.scene,
      video: `${r.seconds}s · ${r.sizeMB}MB · ${r.wallSeconds}s render`,
      audio: r.audio, cover: Boolean(cover?.url),
      uploaded: up.uploaded, published: pub.published,
      note: pub.reason || null,
      caption: caption.split('\n')[0],
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
