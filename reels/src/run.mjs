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
import { colorsOf } from './football-api.mjs';
import { openBrowser, renderScene } from '../engine/render-lib.mjs';
import { uploadVideo } from './storage.mjs';
import { publishReel } from './publisher.mjs';
import { hasPosted, record } from './state.mjs';

const flag = (n) => process.argv.includes('--' + n);
const DRY = flag('dry-run');
const ALL = flag('all');

function trDateTime(iso) {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: config.timezone,
  }).format(new Date(iso));
}

// Each scene gets exactly the shape it renders from - scenes never see raw API data.
function sceneDataFor(item) {
  const handle = config.handle;
  if (item.scene === 'match-result') {
    const f = item.fixture;
    return {
      competition: `${f.league.name}${f.league.round ? ' · ' + f.league.round.replace('Regular Season - ', '') + '. Hafta' : ''}`,
      venue: f.venue,
      home: f.home, away: f.away,
      stats: f.stats || [], goals: f.goals || [], handle,
    };
  }
  if (item.scene === 'upcoming') {
    const f = item.fixture;
    return {
      competition: f.league.name,
      home: f.home, away: f.away,
      kickoffText: trDateTime(f.kickoff),
      venue: f.venue, cta: 'Skor tahmininiz?', handle,
    };
  }
  if (item.scene === 'standings') {
    return {
      competition: 'Süper Lig',
      standings: item.standings.map((r) => ({ ...r, colors: colorsOf(r.team) })),
      handle,
    };
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

const due = plan.items.filter((i) => ALL || i.at <= now);
const skipped = plan.items.length - due.length;
if (skipped) console.log(`${skipped} gönderi henüz zamanı gelmediği için bekliyor.`);

const browser = await openBrowser();
const results = [];

try {
  for (const item of due) {
    if (hasPosted(item.key)) { results.push({ key: item.key, status: 'zaten paylaşıldı' }); continue; }

    const out = path.join(config.outDir, `${plan.date}-${item.key}.mp4`);
    const data = sceneDataFor(item);
    const caption = captionFor(item);

    const r = await renderScene({
      browser,
      sceneDir: path.join(config.root, 'scenes', item.scene),
      data, out,
    });
    if (r.errors.length) throw new Error(`${item.scene} render errors: ${r.errors.join(' | ')}`);

    const key = `reels/${path.basename(out)}`;
    const up = await uploadVideo(out, key);
    const pub = await publishReel({ videoUrl: up.url, caption, dryRun: DRY });

    if (pub.published) record({ key: item.key, scene: item.scene, mediaId: pub.mediaId, url: up.url });

    results.push({
      key: item.key, scene: item.scene,
      video: `${r.seconds}s · ${r.sizeMB}MB · ${r.wallSeconds}s render`,
      uploaded: up.uploaded, published: pub.published,
      note: pub.reason || null,
      caption: caption.split('\n')[0],
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
