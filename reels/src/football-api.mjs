// API-Football client, normalised into our own shapes so no scene or planner
// ever depends on the provider's schema. Without a key it serves mock fixtures
// generated relative to "now", so the whole pipeline runs end to end offline.
import { config } from './config.mjs';

const SHORTS = {
  'Galatasaray': 'GS', 'Fenerbahce': 'FB', 'Fenerbahçe': 'FB', 'Besiktas': 'BJK',
  'Beşiktaş': 'BJK', 'Trabzonspor': 'TS', 'Basaksehir': 'İBFK', 'Başakşehir': 'İBFK',
  'Adana Demirspor': 'ADS', 'Konyaspor': 'KON', 'Antalyaspor': 'ANT',
  'Alanyaspor': 'ALA', 'Kayserispor': 'KAY', 'Rizespor': 'RİZ', 'Samsunspor': 'SAM',
  'Gaziantep FK': 'GFK', 'Sivasspor': 'SİV', 'Kasimpasa': 'KSM', 'Göztepe': 'GÖZ',
  'Eyupspor': 'EYP', 'Bodrumspor': 'BOD', 'Hatayspor': 'HAT',
};

const COLORS = {
  'Galatasaray': ['#F5B324', '#B31226'], 'Fenerbahçe': ['#FFED00', '#00295B'],
  'Beşiktaş': ['#E6E6E6', '#111111'], 'Trabzonspor': ['#7A1E2E', '#3EA8E5'],
  'Başakşehir': ['#F26522', '#0B2545'], 'Konyaspor': ['#0B6E4F', '#EFEFEF'],
  'Antalyaspor': ['#E4032E', '#FFFFFF'], 'Samsunspor': ['#E4032E', '#1D2B53'],
  'Göztepe': ['#E4032E', '#FFD100'], 'Rizespor': ['#0B6E4F', '#3EA8E5'],
};

export function shortOf(name) {
  if (SHORTS[name]) return SHORTS[name];
  const words = name.replace(/\b(FK|SK|AŞ|A\.Ş\.)\b/g, '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toLocaleUpperCase('tr');
  return words.map((w) => w[0]).join('').slice(0, 4).toLocaleUpperCase('tr');
}

export function colorsOf(name, fallback = ['#5A6B8C', '#2B3450']) {
  return COLORS[name] || fallback;
}

async function call(pathname, params) {
  const url = new URL(config.football.host + pathname);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { 'x-apisports-key': config.football.key } });
  if (!res.ok) throw new Error(`API-Football ${pathname} -> ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length) {
    throw new Error(`API-Football ${pathname} -> ${JSON.stringify(body.errors)}`);
  }
  return body.response;
}

function team(side, raw, score) {
  const name = raw.name;
  const [primary, secondary] = colorsOf(name);
  return { id: raw.id, name, short: shortOf(name), primary, secondary, score, side };
}

const STAT_MAP = [
  ['Ball Possession', 'Topla oynama', '%'],
  ['Total Shots', 'Toplam şut', ''],
  ['Shots on Goal', 'İsabetli şut', ''],
  ['Corner Kicks', 'Korner', ''],
  ['Fouls', 'Faul', ''],
];

function normaliseFixture(f) {
  const out = {
    id: f.fixture.id,
    kickoff: f.fixture.date,
    status: f.fixture.status.short,
    finished: ['FT', 'AET', 'PEN'].includes(f.fixture.status.short),
    live: ['1H', '2H', 'HT', 'ET', 'P'].includes(f.fixture.status.short),
    venue: f.fixture.venue?.name || '',
    league: { name: f.league.name, round: f.league.round },
    home: team('home', f.teams.home, f.goals.home),
    away: team('away', f.teams.away, f.goals.away),
    stats: null,
    goals: null,
  };

  if (Array.isArray(f.statistics) && f.statistics.length === 2) {
    const pick = (side, key) => {
      const row = f.statistics[side].statistics.find((s) => s.type === key);
      const v = row?.value;
      return typeof v === 'string' ? Number(v.replace('%', '')) || 0 : (v || 0);
    };
    out.stats = STAT_MAP.map(([key, label, unit]) => ({
      label, unit, home: pick(0, key), away: pick(1, key),
    }));
  }

  if (Array.isArray(f.events)) {
    out.goals = f.events
      .filter((e) => e.type === 'Goal')
      .map((e) => ({
        team: e.team.id === f.teams.home.id ? 'home' : 'away',
        player: (e.player?.name || '').split(' ').slice(-1)[0] || 'Gol',
        minute: e.time.elapsed + (e.time.extra || 0),
      }));
  }
  return out;
}

// ---- mock -----------------------------------------------------------------

const MOCK_OPPONENTS = ['Trabzonspor', 'Beşiktaş', 'Samsunspor', 'Göztepe', 'Konyaspor'];

function mockFixtures(now) {
  const us = config.team.name;
  const day = 86400000;
  // One match earlier today (finished), one in three days (upcoming).
  const finishedAt = new Date(now.getTime() - 3 * 3600000);
  const nextAt = new Date(now.getTime() + 3 * day);

  const mk = (id, date, opponent, homeIsUs, hs, as, done) => ({
    fixture: {
      id, date: date.toISOString(),
      status: { short: done ? 'FT' : 'NS' },
      venue: { name: homeIsUs ? 'RAMS Park' : 'Deplasman' },
    },
    league: { name: 'Süper Lig', round: 'Regular Season - 5' },
    teams: {
      home: { id: homeIsUs ? config.team.id : 900 + id, name: homeIsUs ? us : opponent },
      away: { id: homeIsUs ? 900 + id : config.team.id, name: homeIsUs ? opponent : us },
    },
    goals: { home: done ? hs : null, away: done ? as : null },
    statistics: done ? [
      { statistics: [{ type: 'Ball Possession', value: '58%' }, { type: 'Total Shots', value: 17 },
        { type: 'Shots on Goal', value: 8 }, { type: 'Corner Kicks', value: 7 }, { type: 'Fouls', value: 11 }] },
      { statistics: [{ type: 'Ball Possession', value: '42%' }, { type: 'Total Shots', value: 9 },
        { type: 'Shots on Goal', value: 3 }, { type: 'Corner Kicks', value: 4 }, { type: 'Fouls', value: 16 }] },
    ] : [],
    events: done ? [
      { type: 'Goal', team: { id: config.team.id }, player: { name: 'M. Icardi' }, time: { elapsed: 12 } },
      { type: 'Goal', team: { id: 900 + id }, player: { name: 'P. Onuachu' }, time: { elapsed: 34 } },
      { type: 'Goal', team: { id: config.team.id }, player: { name: 'V. Osimhen' }, time: { elapsed: 61 } },
      { type: 'Goal', team: { id: config.team.id }, player: { name: 'Barış Yılmaz' }, time: { elapsed: 88 } },
    ] : [],
  });

  return [
    mk(1001, finishedAt, MOCK_OPPONENTS[0], true, 3, 1, true),
    mk(1002, nextAt, MOCK_OPPONENTS[1], false, 0, 0, false),
  ].map(normaliseFixture);
}

function mockStandings() {
  const names = [config.team.name, 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Samsunspor',
    'Başakşehir', 'Göztepe', 'Konyaspor', 'Rizespor', 'Antalyaspor'];
  return names.map((name, i) => {
    const played = 5, won = 5 - i > 0 ? 5 - Math.floor(i / 2) : 1;
    const lost = Math.min(played - won, i);
    const drawn = played - won - lost;
    return {
      rank: i + 1, team: name, short: shortOf(name), played, won, drawn, lost,
      gf: 14 - i, ga: 3 + i, gd: 14 - i - (3 + i),
      points: won * 3 + drawn,
      isUs: name === config.team.name,
    };
  });
}

// ---- public ---------------------------------------------------------------

export async function getTeamFixtures({ from, to, now = new Date() }) {
  if (!config.football.live) return mockFixtures(now);
  const res = await call('/fixtures', {
    team: config.team.id, season: config.league.season,
    from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
  });
  return res.map(normaliseFixture);
}

// Stats and events only come back when asked for a single fixture.
export async function getFixtureDetail(id) {
  if (!config.football.live) {
    return mockFixtures(new Date()).find((f) => f.id === id) || null;
  }
  const [base] = await call('/fixtures', { id });
  if (!base) return null;
  const [stats, events] = await Promise.all([
    call('/fixtures/statistics', { fixture: id }).catch(() => []),
    call('/fixtures/events', { fixture: id }).catch(() => []),
  ]);
  return normaliseFixture({ ...base, statistics: stats, events });
}

export async function getStandings() {
  if (!config.football.live) return mockStandings();
  const res = await call('/standings', { league: config.league.id, season: config.league.season });
  const rows = res?.[0]?.league?.standings?.[0] || [];
  return rows.map((r) => ({
    rank: r.rank, team: r.team.name, short: shortOf(r.team.name),
    played: r.all.played, won: r.all.win, drawn: r.all.draw, lost: r.all.lose,
    gf: r.all.goals.for, ga: r.all.goals.against, gd: r.goalsDiff, points: r.points,
    isUs: r.team.id === config.team.id,
  }));
}
