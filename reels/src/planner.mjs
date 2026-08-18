// Decides what goes out today, from what our own endpoints can actually supply.
//
// Cadence per the brief: two posts on an ordinary day, up to four when our team
// plays, and some days nothing at all. Our team's own match always outranks
// league-wide filler.
//
// The plan is a pure function of the date and the fixture list, so re-running
// plans identically; with the ledger keyed per item, a repeat run cannot
// double-post.
import { config } from './config.mjs';
import { getFixtures, getStandings, getTeamForm, ourMatches } from './sporx-api.mjs';

const HOUR = 3600000;

function seedFor(date) {
  const s = date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const dayKey = (d) => new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(d);

function atLocalSlot(now, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

// A stable id per match, so the ledger recognises it across runs.
function matchKey(m) {
  if (m.url) {
    const id = m.url.match(/(\d+)$/);
    if (id) return id[1];
  }
  return `${m.home.name}-${m.away.name}-${m.dateText}`.replace(/\s+/g, '');
}

export async function planDay(now = new Date()) {
  const fixtures = await getFixtures({ lig: config.data.lig, now });
  const today = dayKey(now);

  const ours = ourMatches(fixtures);
  const oursToday = ours.filter((m) => m.kickoff && dayKey(new Date(m.kickoff)) === today);
  const isMatchDay = oursToday.length > 0;
  const maxPosts = isMatchDay ? config.cadence.matchDayMax : config.cadence.normalPerDay;

  if (!isMatchDay && seedFor(now) < config.cadence.quietDayChance) {
    return { date: today, matchDay: false, quiet: true, items: [] };
  }

  const items = [];

  for (const m of oursToday) {
    if (m.finished) {
      items.push({ key: `sonuc-${matchKey(m)}`, scene: 'match-result', priority: 1,
        at: new Date(now), match: m });
    } else if (!m.live) {
      const kickoff = new Date(m.kickoff);
      items.push({ key: `onces-${matchKey(m)}`, scene: 'upcoming', priority: 1,
        at: new Date(kickoff.getTime() - 4 * HOUR), match: m });
    }
    // Live matches are deliberately skipped: a mid-match card is stale the
    // moment it publishes. Final score covers it.
  }

  // Next match on a quiet day, once it is close enough to be interesting.
  if (!isMatchDay) {
    let upcoming = ours.filter((m) => !m.finished && m.kickoff && new Date(m.kickoff) > now);
    // Once the current week is played out the next fixture lives in the following
    // week, so look ahead rather than silently dropping the preview post.
    if (!upcoming.length && fixtures.week < (fixtures.maxWeek || fixtures.week)) {
      try {
        const nextWeek = await getFixtures({ lig: config.data.lig, hafta: fixtures.week + 1, now });
        upcoming = ourMatches(nextWeek)
          .filter((m) => !m.finished && m.kickoff && new Date(m.kickoff) > now);
      } catch { /* keep going without a preview */ }
    }
    const next = upcoming.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
    if (next) {
      items.push({ key: `onces-${matchKey(next)}-${today}`, scene: 'upcoming', priority: 2,
        at: atLocalSlot(now, config.cadence.slots[0]), match: next });
    }
  }

  // League-wide filler. The fixture post looks forward: a list of matches that
  // have already been played is a result table, and the standings post already
  // covers that ground.
  let fixtureWeek = fixtures;
  if (fixtures.week < (fixtures.maxWeek || fixtures.week)) {
    try {
      const next = await getFixtures({ lig: config.data.lig, hafta: fixtures.week + 1, now });
      if (next.matches.length) fixtureWeek = next;
    } catch { /* fall back to the current week */ }
  }
  items.push({ key: `fikstur-${today}`, scene: 'fixtures', priority: 3,
    at: atLocalSlot(now, config.cadence.slots[0]), fixtures: fixtureWeek });
  items.push({ key: `puan-${today}`, scene: 'standings', priority: 4,
    at: atLocalSlot(now, config.cadence.slots[config.cadence.slots.length - 1]) });

  // Every candidate is returned, not just the first few: the runner drops
  // anything that would repeat recent content and needs spares to fall through to.
  items.sort((a, b) => a.priority - b.priority || a.at - b.at);
  const chosen = items;

  for (const item of chosen) {
    if (item.scene === 'standings') item.standings = await getStandings({ lig: config.data.lig });

    // A result post carries no match statistics from this source, so it is
    // given league context instead: the run of form leading into it and where
    // the team now sits in the table.
    if (item.scene === 'match-result') {
      const [table, form] = await Promise.all([
        getStandings({ lig: config.data.lig }),
        getTeamForm({ fromWeek: fixtures.week, count: 5, excludeUrl: item.match.url, now }),
      ]);
      item.standing = table.rows.find((r) => r.isUs) || null;
      item.leagueName = table.league;
      item.form = form;
    }
  }

  return {
    date: today, matchDay: isMatchDay, quiet: false, week: fixtures.week,
    maxPosts, items: chosen,
  };
}
