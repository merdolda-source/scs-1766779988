// Reads m.sporx.com directly, so the pipeline needs no PHP layer deployed and
// no paid data provider. This is a faithful port of the project's existing
// fikstur.php / puanlig.php logic, with the same three-stage assembly:
//
//   1. the league page carries the internal league id + week list
//   2. the site's own AJAX endpoint returns one week of fixtures (teams, time)
//   3. that week has no dates or scores, so each team's fixture page fills in
//      the real date and final score, and today's matches are overlaid from the
//      live-scores feed
//
// Scrapers break when the source is redesigned - the PHP files carry comments
// about exactly that having happened. Selectors are kept in one block below so
// a redesign is a small, obvious edit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'data', 'cache');
const HOST = 'https://m.sporx.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const LIGLER = {
  'super-lig': { ad: 'Süper Lig', fikstur: 'turkiye-super-lig-fikstur', puan: 'turkiye-super-lig-puan-durumu' },
  '1-lig': { ad: '1. Lig', fikstur: 'turkiye-1-lig-fikstur', puan: 'turkiye-1-lig-puan-durumu' },
  'premier-lig': { ad: 'Premier Lig', fikstur: 'ingiltere-premier-lig-fikstur', puan: 'ingiltere-premier-lig-puan-durumu' },
  'la-liga': { ad: 'La Liga', fikstur: 'ispanya-la-liga-fikstur', puan: 'ispanya-la-liga-puan-durumu' },
  'bundesliga': { ad: 'Bundesliga', fikstur: 'almanya-bundesliga-fikstur', puan: 'almanya-bundesliga-puan-durumu' },
  'serie-a': { ad: 'Serie A', fikstur: 'italya-serie-a-fikstur', puan: 'italya-serie-a-puan-durumu' },
  'ligue-1': { ad: 'Ligue 1', fikstur: 'fransa-ligue-1-fikstur', puan: 'fransa-ligue-1-puan-durumu' },
  'sampiyonlar-ligi': { ad: 'Şampiyonlar Ligi', fikstur: 'sampiyonlar-ligi-fikstur', puan: 'sampiyonlar-ligi-puan-durumu' },
};

const AYLAR = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6,
  temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10,
  kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

// ---- fetch + cache ---------------------------------------------------------

// Pages are served as windows-1254; decoding them as UTF-8 mangles every
// Turkish character, so validity is tested before falling back.
function decodeBody(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1254').decode(buf);
  }
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9', ...extraHeaders },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return decodeBody(await res.arrayBuffer());
}

// Stale cache is preferred over failing: a redesigned or briefly unreachable
// source should degrade to yesterday's data, not crash the day's posting.
async function cached(key, ttlMs, produce) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, key.replace(/[^a-z0-9_-]/gi, '_') + '.json');
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < ttlMs) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  try {
    const value = await produce();
    fs.writeFileSync(file, JSON.stringify(value));
    return value;
  } catch (err) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    throw err;
  }
}

// ---- selectors (all source-shape knowledge lives here) ---------------------

const SEL = {
  ligId: /const\s+\$lig\s*=\s*'(\d+)'/,
  sportId: /const\s+\$sportId\s*=\s*'(\d+)'/,
  weekAll: /data-week="(\d+)"/g,
  weekActive: /class="week-item active"\s*\r?\n?\s*data-week="(\d+)"/,
  row: /<tr class="fixture-row">(.*?)<\/tr>/gs,
  teamName: /<span class="fixture-team-name">([^<]*)<\/span>/g,
  teamLink: /<a href="([^"]*)" title="[^"]*" class="fixture-team-link">/g,
  time: /<span class="fixture-match-time">([^<]*)<\/span>/,
  detail: /href="([^"]*)"\s*class="fixture-detail-overlay"/,
  tr: /<tr\b[^>]*>(.*?)<\/tr>/gs,
  dateHead: /<strong>\s*(\d{1,2})\s+([^\s<]+)\s+(\d{4})\s*<\/strong>/u,
  matchId: /maci-canli-(\d+)/,
  score: /<span class="fixture-score">\s*([^<]*?)\s*<\/span>/,
  standBody: /id="genel"[^>]*>(.*?)<\/tbody>/s,
  td: /<td[^>]*>(.*?)<\/td>/gs,
  anchor: /href=["']([^"']*)["'][^>]*>(.*?)<\/a>/s,
  liveJson: /var\s+jsonData\s*=\s*(\[.*\])\s*;\s*var\s+dataUpdate/s,
};

const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// ---- league identity -------------------------------------------------------

export async function getIdentity(ligKey = 'super-lig') {
  const lig = LIGLER[ligKey];
  if (!lig) throw new Error('bilinmeyen lig: ' + ligKey);

  return cached(`kimlik_${ligKey}`, 6 * 3600e3, async () => {
    const html = await fetchText(`${HOST}/${lig.fikstur}`);
    const ligId = html.match(SEL.ligId)?.[1];
    const sportId = html.match(SEL.sportId)?.[1];
    if (!ligId || !sportId) throw new Error('lig kimliği okunamadı: ' + ligKey);

    const weeks = [...html.matchAll(SEL.weekAll)].map((m) => Number(m[1]));
    return {
      ligId, sportId, ad: lig.ad,
      maxWeek: weeks.length ? Math.max(...weeks) : 38,
      activeWeek: Number(html.match(SEL.weekActive)?.[1] || 1),
    };
  });
}

// ---- one week of fixtures --------------------------------------------------

function parseWeekRows(bodyHtml) {
  const out = [];
  for (const m of bodyHtml.matchAll(SEL.row)) {
    const row = m[1];
    const names = [...row.matchAll(SEL.teamName)].map((x) => strip(x[1]));
    if (names.length < 2) continue;
    const links = [...row.matchAll(SEL.teamLink)].map((x) => x[1]);
    const url = row.match(SEL.detail)?.[1] || null;
    out.push({
      takim1: names[0], takim2: names[1],
      saat: strip(row.match(SEL.time)?.[1] || ''),
      macUrl: url,
      macId: url?.match(SEL.matchId)?.[1] || null,
      takimSluglari: links.slice(0, 2),
      tarih: null, isoDate: null, durum: 'baslamadi', durumYazisi: '',
      skor1: '', skor2: '',
    });
  }
  return out;
}

async function fetchWeek(ligKey, week) {
  const id = await getIdentity(ligKey);
  return cached(`hafta_${ligKey}_${week}`, 5 * 60e3, async () => {
    const url = `${HOST}/istatistik/_ajax/statsFixture.php?`
      + new URLSearchParams({ lig: id.ligId, stage: '', week: String(week), seasonId: '', sportId: id.sportId });
    const json = JSON.parse(await fetchText(url, { 'X-Requested-With': 'XMLHttpRequest' }));
    return parseWeekRows(json?.html?.body || '');
  });
}

// ---- team pages: real dates and final scores -------------------------------

function parseTeamPage(html) {
  const byId = {};
  let current = null;
  for (const m of html.matchAll(SEL.tr)) {
    const row = m[1];
    const dh = row.match(SEL.dateHead);
    if (dh) {
      const ay = AYLAR[dh[2].toLocaleLowerCase('tr')];
      if (ay) {
        current = {
          gunAy: String(dh[1]).padStart(2, '0') + '.' + String(ay).padStart(2, '0'),
          iso: `${dh[3]}-${String(ay).padStart(2, '0')}-${String(dh[1]).padStart(2, '0')}`,
        };
      }
      continue;
    }
    const idm = row.match(SEL.matchId);
    if (!idm) continue;
    const raw = row.match(SEL.score)?.[1]?.trim() || '';
    byId[idm[1]] = {
      tarih: current?.gunAy || null,
      isoDate: current?.iso || null,
      skor: /^\d+\s*-\s*\d+$/.test(raw) ? raw : null,
    };
  }
  return byId;
}

async function enrichDates(matches) {
  const slugs = [...new Set(matches.flatMap((m) => m.takimSluglari).filter(Boolean))];
  const pages = {};
  // Bounded concurrency: a week needs ~9 team pages and hammering them all at
  // once is both rude and more likely to be throttled.
  for (let i = 0; i < slugs.length; i += 4) {
    const batch = slugs.slice(i, i + 4);
    const got = await Promise.all(batch.map((slug) =>
      cached(`takim_${slug}`, 30 * 60e3, async () => parseTeamPage(await fetchText(HOST + slug)))
        .catch(() => ({}))));
    batch.forEach((slug, k) => { pages[slug] = got[k]; });
  }

  for (const m of matches) {
    for (const slug of m.takimSluglari) {
      const hit = m.macId && pages[slug]?.[m.macId];
      if (!hit) continue;
      m.tarih = hit.tarih; m.isoDate = hit.isoDate;
      if (hit.skor) {
        const [a, b] = hit.skor.split('-').map((s) => s.trim());
        m.durum = 'bitti'; m.durumYazisi = 'MS'; m.skor1 = a; m.skor2 = b;
      }
      break;
    }
  }
  return matches;
}

// ---- live overlay ----------------------------------------------------------

const foldTr = (s) => String(s).trim()
  .replace(/[İIı]/g, 'i').replace(/[Şş]/g, 's').replace(/[Çç]/g, 'c')
  .replace(/[Ğğ]/g, 'g').replace(/[Üü]/g, 'u').replace(/[Öö]/g, 'o')
  .toLowerCase().replace(/\s+/g, ' ');
const pairKey = (a, b) => `${foldTr(a)}|${foldTr(b)}`;

async function liveMap() {
  return cached('canli', 25e3, async () => {
    const html = await fetchText(`${HOST}/canliskorlar/`);
    const raw = html.match(SEL.liveJson)?.[1];
    if (!raw) return {};
    const out = {};
    for (const t of JSON.parse(raw)) {
      for (const m of t.matches || []) {
        const finished = m.matchIsFinished === 'Y';
        const started = m.matchIsStarted === 'Y';
        out[pairKey(m.team1, m.team2)] = {
          date: m.date || null,
          durum: finished ? 'bitti' : started ? 'canli' : 'baslamadi',
          durumYazisi: m.statusText || '',
          skor1: m.score1 ?? '', skor2: m.score2 ?? '',
        };
      }
    }
    return out;
  }).catch(() => ({}));
}

async function enrichLive(matches) {
  const live = await liveMap();
  for (const m of matches) {
    const hit = live[pairKey(m.takim1, m.takim2)];
    if (!hit) continue;
    m.durum = hit.durum;
    m.durumYazisi = hit.durumYazisi;
    if (hit.skor1 !== '' || hit.skor2 !== '') { m.skor1 = hit.skor1; m.skor2 = hit.skor2; }
    if (hit.date) {
      const d = hit.date.slice(0, 10);
      m.isoDate = d;
      m.tarih = d.slice(8, 10) + '.' + d.slice(5, 7);
      if (!m.saat && hit.date.length >= 16) m.saat = hit.date.slice(11, 16);
    }
  }
  return matches;
}

// ---- public ---------------------------------------------------------------

export async function getWeek(ligKey = 'super-lig', week = null) {
  const id = await getIdentity(ligKey);
  const w = week || id.activeWeek;
  const rows = await fetchWeek(ligKey, w);
  // Cached week rows carry no dates/scores; enrichment runs outside that cache
  // so a live score is never five minutes stale.
  const matches = await enrichLive(await enrichDates(rows.map((r) => ({ ...r }))));
  return { ligAdi: id.ad, hafta: w, maxHafta: id.maxWeek, aktifHafta: id.activeWeek, maclar: matches };
}

export async function getStandings(ligKey = 'super-lig') {
  const lig = LIGLER[ligKey];
  if (!lig) throw new Error('bilinmeyen lig: ' + ligKey);

  return cached(`puan_${ligKey}`, 10 * 60e3, async () => {
    const html = await fetchText(`${HOST}/${lig.puan}`);
    const body = html.match(SEL.standBody)?.[1] || '';
    const rows = [];
    for (const m of body.matchAll(SEL.tr)) {
      const tds = [...m[1].matchAll(SEL.td)].map((x) => x[1]);
      if (tds.length < 13) continue;                       // header / spacer rows
      const n = (i) => Number(strip(tds[i])) || 0;
      const takim = strip(tds[3].match(SEL.anchor)?.[2] || tds[3]);
      if (!takim) continue;
      rows.push({
        sira: n(1), takim, bolge: strip(tds[12]) || null,
        oynanan: n(4), galibiyet: n(5), berabere: n(6), maglubiyet: n(7),
        attigi: n(8), yedigi: n(9), averaj: n(10), puan: n(11),
      });
    }
    if (!rows.length) throw new Error('puan durumu boş: ' + ligKey);
    return { ligAdi: lig.ad, genel: rows };
  });
}
