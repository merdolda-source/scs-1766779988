// Adapter for the project's own PHP endpoints (fikstur.php / puanlig.php).
//
// Those return sporx-derived data in their own shape; everything downstream
// speaks our shape instead, so scenes and the planner never see the source
// format. Swapping data providers later means rewriting only this file.
//
// What this source gives us: fixtures with kickoff time, real date, live/final
// score and status, plus full standings. What it does NOT give us: per-match
// statistics (possession, shots, corners) or goalscorers. Scenes are built to
// degrade when those are absent rather than to assume them.
import { config } from './config.mjs';

const SHORTS = {
  'Galatasaray': 'GS', 'Fenerbahçe': 'FB', 'Beşiktaş': 'BJK', 'Trabzonspor': 'TS',
  'Başakşehir': 'İBFK', 'RAMS Başakşehir': 'İBFK', 'Konyaspor': 'KON',
  'Antalyaspor': 'ANT', 'Alanyaspor': 'ALA', 'Kayserispor': 'KAY',
  'Çaykur Rizespor': 'RİZ', 'Rizespor': 'RİZ', 'Samsunspor': 'SAM',
  'Gaziantep FK': 'GFK', 'Sivasspor': 'SİV', 'Kasımpaşa': 'KSM', 'Göztepe': 'GÖZ',
  'Eyüpspor': 'EYP', 'Bodrum FK': 'BOD', 'Hatayspor': 'HAT', 'Kocaelispor': 'KOC',
  'Gençlerbirliği': 'GB', 'Fatih Karagümrük': 'KRG',
};

const COLORS = {
  'Galatasaray': ['#F5B324', '#B31226'], 'Fenerbahçe': ['#FFED00', '#00295B'],
  'Beşiktaş': ['#E6E6E6', '#111111'], 'Trabzonspor': ['#7A1E2E', '#3EA8E5'],
  'Başakşehir': ['#F26522', '#0B2545'], 'RAMS Başakşehir': ['#F26522', '#0B2545'],
  'Konyaspor': ['#0B6E4F', '#D8D8D8'], 'Antalyaspor': ['#E4032E', '#D8D8D8'],
  'Samsunspor': ['#E4032E', '#1D2B53'], 'Göztepe': ['#E4032E', '#FFD100'],
  'Çaykur Rizespor': ['#0B6E4F', '#3EA8E5'], 'Alanyaspor': ['#E4581C', '#0B6E4F'],
  'Kayserispor': ['#E4032E', '#F5D400'], 'Sivasspor': ['#E4032E', '#D8D8D8'],
  'Gaziantep FK': ['#E4032E', '#111111'], 'Eyüpspor': ['#5E1830', '#F5D400'],
  'Kasımpaşa': ['#0B2545', '#E4032E'], 'Kocaelispor': ['#0B6E4F', '#111111'],
  'Gençlerbirliği': ['#E4032E', '#111111'], 'Hatayspor': ['#7A1E2E', '#F5D400'],
  'Bodrum FK': ['#0B6E4F', '#FFFFFF'], 'Fatih Karagümrük': ['#E4032E', '#111111'],
};

export function shortOf(name) {
  if (SHORTS[name]) return SHORTS[name];
  const words = String(name).replace(/\b(FK|SK|AŞ|A\.Ş\.)\b/g, '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toLocaleUpperCase('tr');
  return words.map((w) => w[0]).join('').slice(0, 4).toLocaleUpperCase('tr');
}

export function colorsOf(name) {
  return COLORS[name] || ['#5A6B8C', '#2B3450'];
}

function side(name, score) {
  const [primary, secondary] = colorsOf(name);
  const s = score === '' || score === null || score === undefined ? null : Number(score);
  return { name, short: shortOf(name), primary, secondary, score: Number.isFinite(s) ? s : null };
}

// "GG.AA" plus "HH:MM" -> a real Date. The source omits the year, so it is
// inferred from today and rolled over when the gap looks like a year boundary.
function toDate(tarih, saat, now = new Date()) {
  if (!tarih || !/^\d{2}\.\d{2}$/.test(tarih)) return null;
  const [dd, mm] = tarih.split('.').map(Number);
  const [hh, mi] = (saat && /^\d{1,2}:\d{2}$/.test(saat) ? saat : '00:00').split(':').map(Number);
  let year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd, hh, mi);
  const gapDays = (candidate - now) / 86400000;
  if (gapDays > 200) year -= 1;
  else if (gapDays < -200) year += 1;
  return new Date(year, mm - 1, dd, hh, mi);
}

function normaliseMatch(m, now) {
  const when = toDate(m.tarih, m.saat, now);
  return {
    home: side(m.takim1, m.skor1),
    away: side(m.takim2, m.skor2),
    time: m.saat || '',
    dateText: m.tarih || '',
    kickoff: when ? when.toISOString() : null,
    status: m.durum || 'baslamadi',
    statusText: m.durumYazisi || '',
    finished: m.durum === 'bitti',
    live: m.durum === 'canli',
    url: m.macUrl || null,
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const body = await res.json();
  if (body.basarili === false) throw new Error(`${url} -> ${body.hata}`);
  return body;
}

// ---- mock: mirrors the exact JSON these endpoints return -------------------

function mockFixtureResponse(now, hafta) {
  const CURRENT = 5;
  const week = hafta || CURRENT;
  const d = (offsetDays) => {
    const x = new Date(now.getTime() + offsetDays * 86400000);
    return String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0');
  };

  // Past weeks come back played, so form can be derived offline exactly as it
  // would be against the live endpoint.
  if (week < CURRENT) {
    const past = [
      { opp: 'Kayserispor', home: true,  a: 2, b: 0 },
      { opp: 'Eyüpspor',    home: false, a: 1, b: 1 },
      { opp: 'Göztepe',     home: true,  a: 3, b: 2 },
      { opp: 'Beşiktaş',    home: false, a: 0, b: 1 },
    ][week - 1] || { opp: 'Konyaspor', home: true, a: 1, b: 0 };
    const us = 'Galatasaray';
    return {
      basarili: true, lig: 'super-lig', ligAdi: 'Süper Lig',
      hafta: week, maxHafta: 36, aktifHafta: CURRENT,
      maclar: [{
        takim1: past.home ? us : past.opp, takim2: past.home ? past.opp : us,
        saat: '20:00', tarih: d(-7 * (CURRENT - week)),
        durum: 'bitti', durumYazisi: 'MS',
        skor1: String(past.home ? past.a : past.b),
        skor2: String(past.home ? past.b : past.a),
        macUrl: 'https://m.sporx.com/maci-canli-' + (200 + week),
        takim1Logo: null, takim2Logo: null,
      }],
    };
  }

  return {
    basarili: true, lig: 'super-lig', ligAdi: 'Süper Lig',
    hafta: CURRENT, maxHafta: 36, aktifHafta: CURRENT,
    maclar: [
      { takim1: 'Galatasaray', takim2: 'Trabzonspor', saat: '20:00', tarih: d(0),
        durum: 'bitti', durumYazisi: 'MS', skor1: '3', skor2: '1',
        macUrl: 'https://m.sporx.com/maci-canli-101', takim1Logo: null, takim2Logo: null },
      { takim1: 'Fenerbahçe', takim2: 'Samsunspor', saat: '17:00', tarih: d(0),
        durum: 'canli', durumYazisi: "67'", skor1: '1', skor2: '1',
        macUrl: 'https://m.sporx.com/maci-canli-102', takim1Logo: null, takim2Logo: null },
      { takim1: 'Beşiktaş', takim2: 'Göztepe', saat: '20:00', tarih: d(1),
        durum: 'baslamadi', durumYazisi: '', skor1: '', skor2: '',
        macUrl: 'https://m.sporx.com/maci-canli-103', takim1Logo: null, takim2Logo: null },
      { takim1: 'Konyaspor', takim2: 'Alanyaspor', saat: '17:00', tarih: d(1),
        durum: 'baslamadi', durumYazisi: '', skor1: '', skor2: '',
        macUrl: 'https://m.sporx.com/maci-canli-104', takim1Logo: null, takim2Logo: null },
      { takim1: 'Kasımpaşa', takim2: 'Galatasaray', saat: '19:00', tarih: d(4),
        durum: 'baslamadi', durumYazisi: '', skor1: '', skor2: '',
        macUrl: 'https://m.sporx.com/maci-canli-105', takim1Logo: null, takim2Logo: null },
    ],
  };
}

function mockStandingsResponse() {
  // Kept consistent with the mock fixtures above: a demo whose table contradicts
  // its own form strip looks like a bug in the renderer.
  const teams = [
    ['Fenerbahçe', 5, 4, 1, 0, 12, 4], ['Galatasaray', 5, 3, 1, 1, 9, 5],
    ['Trabzonspor', 5, 3, 1, 1, 9, 6], ['Beşiktaş', 5, 3, 0, 2, 8, 6],
    ['Samsunspor', 5, 2, 2, 1, 7, 5], ['Göztepe', 5, 2, 1, 2, 6, 6],
    ['Başakşehir', 5, 2, 1, 2, 5, 6], ['Konyaspor', 5, 1, 2, 2, 4, 6],
    ['Alanyaspor', 5, 1, 1, 3, 4, 8], ['Kasımpaşa', 5, 0, 1, 4, 2, 12],
  ];
  return {
    basarili: true, lig: 'super-lig', ligAdi: 'Süper Lig',
    veri: {
      genel: teams.map(([takim, o, g, b, m, a, y], i) => ({
        sira: i + 1, bolge: i < 2 ? 'Şampiyonlar Ligi' : null, logo: null, takim,
        oynanan: o, galibiyet: g, berabere: b, maglubiyet: m,
        attigi: a, yedigi: y, averaj: a - y, puan: g * 3 + b,
      })),
      icSaha: [], disSaha: [],
    },
  };
}

// ---- public ---------------------------------------------------------------

export async function getFixtures({ lig = 'super-lig', hafta = null, now = new Date() } = {}) {
  let body;
  if (!config.data.live) {
    body = mockFixtureResponse(now, hafta);
  } else {
    const u = new URL(config.data.base + '/fikstur.php');
    u.searchParams.set('lig', lig);
    if (hafta) u.searchParams.set('hafta', String(hafta));
    body = await getJson(u);
  }
  return {
    league: body.ligAdi,
    week: body.hafta,
    maxWeek: body.maxHafta,
    matches: (body.maclar || []).map((m) => normaliseMatch(m, now)),
  };
}

export async function getStandings({ lig = 'super-lig' } = {}) {
  let body;
  if (!config.data.live) {
    body = mockStandingsResponse();
  } else {
    const u = new URL(config.data.base + '/puanlig.php');
    u.searchParams.set('lig', lig);
    body = await getJson(u);
  }
  const rows = body.veri?.genel || [];
  return {
    league: body.ligAdi,
    rows: rows.map((r) => ({
      rank: r.sira, team: r.takim, short: shortOf(r.takim), zone: r.bolge,
      played: r.oynanan, won: r.galibiyet, drawn: r.berabere, lost: r.maglubiyet,
      gf: r.attigi, ga: r.yedigi, gd: r.averaj, points: r.puan,
      isUs: r.takim === config.team.name,
      colors: colorsOf(r.takim),
    })),
  };
}

// Matches involving our team, split by what has already happened.
export function ourMatches(fixtures, teamName = config.team.name) {
  return fixtures.matches.filter((m) => m.home.name === teamName || m.away.name === teamName);
}

// Last N completed matches for a team, walked backwards from the current week.
// The source only exposes one week per request, so this costs a handful of
// calls; the PHP layer caches them, and a lookback cap stops a team that is
// missing from several weeks (postponements, byes) from walking the whole season.
export async function getTeamForm({ teamName = config.team.name, fromWeek, count = 5,
  maxLookback = 12, excludeUrl = null, now = new Date() } = {}) {
  const form = [];
  for (let w = fromWeek; w >= 1 && form.length < count && fromWeek - w < maxLookback; w--) {
    let week;
    try {
      week = await getFixtures({ lig: config.data.lig, hafta: w, now });
    } catch { continue; }

    for (const m of week.matches) {
      if (form.length >= count) break;
      if (!m.finished) continue;
      if (excludeUrl && m.url === excludeUrl) continue;
      const isHome = m.home.name === teamName;
      const isAway = m.away.name === teamName;
      if (!isHome && !isAway) continue;

      const ours = isHome ? m.home.score : m.away.score;
      const theirs = isHome ? m.away.score : m.home.score;
      if (ours === null || theirs === null) continue;

      form.push({
        result: ours > theirs ? 'G' : ours < theirs ? 'M' : 'B',
        opponent: isHome ? m.away.name : m.home.name,
        opponentShort: isHome ? m.away.short : m.home.short,
        score: `${ours}-${theirs}`,
        isHome,
        week: week.week,
      });
    }
  }
  return form; // newest first
}
