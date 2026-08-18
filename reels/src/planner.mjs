// Decides what goes out today.
//
// Brief: two posts on an ordinary day, three or four when there is a match, and
// some days nothing at all. Match content is the priority and evergreen content
// only fills whatever slots are left over.
//
// The plan is a pure function of the date and the fixture list - the same day
// always plans the same way - so re-running the job is safe and produces no
// duplicates when combined with the ledger.
import { config } from './config.mjs';
import { getTeamFixtures, getFixtureDetail, getStandings } from './football-api.mjs';

const HOUR = 3600000, DAY = 86400000;

function seedFor(date) {
  const s = date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

function sameDay(a, b) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function atLocalSlot(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function planDay(now = new Date()) {
  const fixtures = await getTeamFixtures({
    from: new Date(now.getTime() - 2 * DAY),
    to: new Date(now.getTime() + 8 * DAY),
    now,
  });

  const todays = fixtures.filter((f) => sameDay(new Date(f.kickoff), now));
  const isMatchDay = todays.length > 0;
  const maxPosts = isMatchDay ? config.cadence.matchDayMax : config.cadence.normalPerDay;

  // Quiet days only happen when there is nothing going on.
  if (!isMatchDay && seedFor(now) < config.cadence.quietDayChance) {
    return { date: now.toISOString().slice(0, 10), matchDay: false, quiet: true, items: [] };
  }

  const items = [];

  // 1. Finished matches -> the result reel, shortly after full time.
  for (const f of todays.filter((x) => x.finished)) {
    const end = new Date(new Date(f.kickoff).getTime() + 2 * HOUR);
    items.push({
      key: `result-${f.id}`,
      scene: 'match-result',
      priority: 1,
      at: new Date(Math.max(end.getTime(), now.getTime())),
      fixtureId: f.id,
    });
  }

  // 2. Matches still to come today -> a build-up reel a few hours before kickoff.
  for (const f of todays.filter((x) => !x.finished && !x.live)) {
    items.push({
      key: `preview-${f.id}`,
      scene: 'upcoming',
      priority: 1,
      at: new Date(new Date(f.kickoff).getTime() - 4 * HOUR),
      fixtureId: f.id,
    });
  }

  // 3. Next match on a non-match day, once it is close enough to matter.
  if (!isMatchDay) {
    const next = fixtures
      .filter((f) => !f.finished && new Date(f.kickoff) > now)
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
    if (next && new Date(next.kickoff) - now < 3 * DAY) {
      items.push({
        key: `countdown-${next.id}-${now.toISOString().slice(0, 10)}`,
        scene: 'upcoming',
        priority: 2,
        at: atLocalSlot(now, config.cadence.slots[0]),
        fixtureId: next.id,
      });
    }
  }

  // 4. Evergreen filler.
  items.push({
    key: `standings-${now.toISOString().slice(0, 10)}`,
    scene: 'standings',
    priority: 3,
    at: atLocalSlot(now, config.cadence.slots[config.cadence.slots.length - 1]),
  });

  // Highest priority first, then chronological; trim to the day's allowance.
  items.sort((a, b) => a.priority - b.priority || a.at - b.at);
  const chosen = items.slice(0, maxPosts).sort((a, b) => a.at - b.at);

  // Attach the data each scene needs.
  for (const item of chosen) {
    if (item.fixtureId) item.fixture = await getFixtureDetail(item.fixtureId);
    if (item.scene === 'standings') item.standings = await getStandings();
  }

  return {
    date: now.toISOString().slice(0, 10),
    matchDay: isMatchDay,
    quiet: false,
    items: chosen.filter((i) => !i.fixtureId || i.fixture),
  };
}
