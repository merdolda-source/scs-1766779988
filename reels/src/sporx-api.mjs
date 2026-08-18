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
import * as scrape from './sporx-scrape.mjs';

const SHORTS = {
  'Galatasaray': 'GS', 'Fenerbahçe': 'FB', 'Beşiktaş': 'BJK', 'Trabzonspor': 'TS',
  'Başakşehir': 'İBFK', 'RAMS Başakşehir': 'İBFK', 'Konyaspor': 'KON',
  'Antalyaspor': 'ANT', 'Alanyaspor': 'ALA', 'Kayserispor': 'KAY',
  'Çaykur Rizespor': 'RİZ', 'Rizespor': 'RİZ', 'Samsunspor': 'SAM',
  'Gaziantep FK': 'GFK', 'Sivasspor': 'SİV', 'Kasımpaşa': 'KSM', 'Göztepe': 'GÖZ',
  'Eyüpspor': 'EYP', 'Bodrum FK': 'BOD', 'Hatayspor': 'HAT', 'Kocaelispor': 'KOC',
  'Gençlerbirliği': 'GB', 'Fatih Karagümrük': 'KRG',
  'Amed Sportif': 'AMD', 'Arca Çorum': 'ÇRM', 'Erzurumspor': 'ERZ',
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
  'Amed Sportif': ['#2FA84F', '#D42027'], 'Arca Çorum': ['#C8102E', '#111111'],
  'Erzurumspor': ['#0B4EA2', '#D8D8D8'], 'Samsunspor': ['#E4032E', '#1D2B53'],
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
  // The scraper supplies a real ISO date read off the team page; the PHP
  // endpoint only gives GG.AA, so the year is inferred there.
  const when = m.isoDate
    ? new Date(`${m.isoDate}T${/^\d{1,2}:\d{2}$/.test(m.saat || '') ? m.saat : '00:00'}:00`)
    : toDate(m.tarih, m.saat, now);
  return {
    home: side(m.takim1, m.skor1),
    away: side(m.takim2, m.skor2),
    time: m.saat || '',
    dateText: m.tarih || '',
    kickoff: when && !Number.isNaN(+when) ? when.toISOString() : null,
    status: m.durum || 'baslamadi',
    statusText: m.durumYazisi || '',
    finished: m.durum === 'bitti',
    live: m.durum === 'canli',
    url: m.macUrl || null,
  };
}

function phpUrl(file, params) {
  const u = new URL(config.data.base + '/' + file);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const body = await res.json();
  if (body.basarili === false) throw new Error(`${url} -> ${body.hata}`);
  return body;
}

// ---- public ---------------------------------------------------------------

export async function getFixtures({ lig = 'super-lig', hafta = null, now = new Date() } = {}) {
  const body = config.data.usePhp
    ? await getJson(phpUrl('fikstur.php', { lig, ...(hafta ? { hafta } : {}) }))
    : await scrape.getWeek(lig, hafta);
  return {
    league: body.ligAdi,
    week: body.hafta,
    maxWeek: body.maxHafta,
    activeWeek: body.aktifHafta,
    matches: (body.maclar || []).map((m) => normaliseMatch(m, now)),
  };
}

export async function getStandings({ lig = 'super-lig' } = {}) {
  const body = config.data.usePhp
    ? await getJson(phpUrl('puanlig.php', { lig }))
    : await scrape.getStandings(lig);
  const rows = config.data.usePhp ? (body.veri?.genel || []) : (body.genel || []);
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
