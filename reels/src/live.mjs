// Live match watcher: posts our team's goals as they happen, then the full-time
// card when the match ends.
//
//   node src/live.mjs             # watch if our team is playing now or soon
//   node src/live.mjs --once      # single pass: post any goal not yet posted
//   node src/live.mjs --dry-run   # render, never publish
//   node src/live.mjs --all-goals # include the opponent's goals too
//
// --once exists for schedulers that cannot fire more often than hourly. It
// catches up rather than watching, so a goal goes out within the hour instead
// of within the minute.
//
// This runs as one long job rather than a cron tick: a goal is only worth
// posting for a few minutes, and cron granularity cannot deliver that. It exits
// immediately when there is nothing to watch, so calling it often costs nothing.
import path from 'node:path';
import { config } from './config.mjs';
import { getFixtures, getStandings, getTeamForm, ourMatches } from './sporx-api.mjs';
import { getGoals } from './sporx-scrape.mjs';
import { openBrowser, renderScene } from '../engine/render-lib.mjs';
import { uploadVideo } from './storage.mjs';
import { publishReel } from './publisher.mjs';
import { captionFor } from './captions.mjs';
import { hasPosted, record } from './state.mjs';

const flag = (n) => process.argv.includes('--' + n);
const DRY = flag('dry-run');
// Only our goals go out by default: an account celebrating the opponent scoring
// reads badly, and the full-time card covers their goals anyway.
const ALL_GOALS = flag('all-goals') || process.env.LIVE_ALL_GOALS === '1';
const ONCE = flag('once');

const POLL_MS = Number(process.env.LIVE_POLL_SECONDS || 60) * 1000;
const MAX_MS = Number(process.env.LIVE_MAX_MINUTES || 165) * 60000;
const LEAD_MS = Number(process.env.LIVE_LEAD_MINUTES || 20) * 60000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = (m) => m.url?.match(/(\d+)$/)?.[1] || `${m.home.name}-${m.away.name}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function publishScene({ browser, scene, data, key, caption }) {
  const out = path.join(config.outDir, `${key}.mp4`);
  const r = await renderScene({
    browser, sceneDir: path.join(config.root, 'scenes', scene), data, out,
  });
  if (r.errors.length) throw new Error(`${scene}: ${r.errors.join(' | ')}`);

  const up = await uploadVideo(out, `reels/${path.basename(out)}`);
  const cover = r.cover
    ? await uploadVideo(r.cover, `reels/${path.basename(r.cover)}`).catch(() => null)
    : null;
  const pub = await publishReel({
    videoUrl: up.url, coverUrl: cover?.url || null, caption, dryRun: DRY,
  });
  if (pub.published) record({ key, scene, mediaId: pub.mediaId, url: up.url });
  return { seconds: r.seconds, audio: r.audioStyle, published: pub.published, note: pub.reason || null };
}

const tag = (n) => '#' + n.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

function goalCaption(m, g, competition) {
  const us = config.team.name;
  const scorerTeam = g.team === 'home' ? m.home.name : m.away.name;
  const ours = scorerTeam === us;
  return `${ours ? '⚽️ GOOOOL!' : '⚽️ Gol'} ${g.player} ${g.minuteText}`
    + `\n${m.home.name} ${g.homeScore} - ${g.awayScore} ${m.away.name}`
    + `\n${competition}`
    + `\n\n#süperlig #futbol #gol #canlıskor ${tag(us)} `
    + `${tag(m.home.name)} ${tag(m.away.name)}`;
}

async function watch(match, week) {
  const id = idOf(match);
  const competition = `Süper Lig${week ? ' · ' + week + '. Hafta' : ''}`;
  const us = config.team.name;
  const browser = await openBrowser();
  const started = Date.now();
  let posted = 0;

  log(`izleniyor: ${match.home.name} - ${match.away.name} (${id})`);
  try {
    do {
      let goals = [];
      try {
        goals = await getGoals(match.url, { ttlMs: 0 });
      } catch (e) { log('olaylar çekilemedi:', e.message); }

      for (const g of goals) {
        const scorerTeam = g.team === 'home' ? match.home.name : match.away.name;
        if (!ALL_GOALS && scorerTeam !== us) continue;

        const key = `gol-${id}-${g.key}`;
        if (hasPosted(key)) continue;

        log(`GOL ${g.minuteText} ${g.player} (${scorerTeam}) -> ${g.homeScore}-${g.awayScore}`);
        try {
          const res = await publishScene({
            browser, scene: 'goal', key,
            caption: goalCaption(match, g, competition),
            data: {
              competition, minuteText: g.minuteText, player: g.player, team: g.team,
              home: { ...match.home, score: g.homeScore },
              away: { ...match.away, score: g.awayScore },
              handle: config.handle,
            },
          });
          posted++;
          log('  ->', JSON.stringify(res));
        } catch (e) { log('  paylaşılamadı:', e.message); }
      }

      // Re-read the fixture so the loop notices full time.
      let current = match;
      try {
        const fx = await getFixtures({ lig: config.data.lig });
        current = ourMatches(fx).find((m) => idOf(m) === id) || match;
      } catch { /* keep the previous snapshot */ }

      if (current.finished) {
        log('maç bitti — sonuç kartı');
        const key = `sonuc-${id}`;
        if (!hasPosted(key)) {
          try {
            const [table, form] = await Promise.all([
              getStandings({ lig: config.data.lig }),
              getTeamForm({ fromWeek: week, count: 5, excludeUrl: current.url }),
            ]);
            const res = await publishScene({
              browser, scene: 'match-result', key,
              caption: captionFor({ scene: 'match-result', match: current }),
              data: {
                competition, home: current.home, away: current.away, form,
                standing: table.rows.find((r) => r.isUs) || null,
                leagueName: table.league, handle: config.handle,
              },
            });
            posted++;
            log('  ->', JSON.stringify(res));
          } catch (e) { log('  sonuç paylaşılamadı:', e.message); }
        }
        break;
      }

      if (ONCE) break;
      await sleep(POLL_MS);
    } while (Date.now() - started < MAX_MS);
  } finally {
    await browser.close();
  }
  return { match: `${match.home.name} - ${match.away.name}`, posted };
}

// ---- entry -----------------------------------------------------------------

const now = new Date();
const fixtures = await getFixtures({ lig: config.data.lig, now });
const target = ourMatches(fixtures).find((m) => {
  if (m.live) return true;
  // A catch-up pass must also look at a match that finished since the last run,
  // otherwise late goals and the full-time card are missed entirely.
  if (m.finished) {
    if (!ONCE || !m.kickoff) return false;
    return Date.now() - new Date(m.kickoff).getTime() < 6 * 3600000;
  }
  if (!m.kickoff) return false;
  const delta = new Date(m.kickoff) - now;
  return delta > 0 && delta <= LEAD_MS;
});

if (!target) {
  console.log(JSON.stringify({ watching: false, reason: 'izlenecek maç yok' }));
  process.exit(0);
}

if (!ONCE && !target.live && target.kickoff) {
  const wait = new Date(target.kickoff) - Date.now();
  if (wait > 0) {
    log(`başlamaya ${Math.round(wait / 60000)} dk — bekleniyor`);
    await sleep(wait);
  }
}

console.log(JSON.stringify(await watch(target, fixtures.week), null, 2));
