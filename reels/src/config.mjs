// All secrets come from the environment; nothing is ever written to the repo.
// Missing credentials are not fatal - the pipeline drops into dry-run so the
// whole chain can be exercised before any account is connected.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env reader so there is no dependency just to load a file.
function loadDotEnv() {
  const f = path.join(root, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const env = process.env;

export const config = {
  root,
  outDir: path.join(root, 'out'),

  team: {
    id: Number(env.TEAM_ID || 645),          // 645 = Galatasaray in API-Football
    name: env.TEAM_NAME || 'Galatasaray',
    short: env.TEAM_SHORT || 'GS',
    primary: env.TEAM_PRIMARY || '#F5B324',
    secondary: env.TEAM_SECONDARY || '#B31226',
  },
  league: { id: Number(env.LEAGUE_ID || 203), season: Number(env.SEASON || 2026) },

  football: {
    key: env.API_FOOTBALL_KEY || '',
    host: 'https://v3.football.api-sports.io',
    get live() { return Boolean(env.API_FOOTBALL_KEY); },
  },

  instagram: {
    userId: env.IG_USER_ID || '',
    token: env.IG_ACCESS_TOKEN || '',
    graph: 'https://graph.facebook.com/v21.0',
    get live() { return Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN); },
  },

  storage: {
    endpoint: env.S3_ENDPOINT || '',
    bucket: env.S3_BUCKET || '',
    region: env.S3_REGION || 'auto',
    accessKey: env.S3_ACCESS_KEY || '',
    secretKey: env.S3_SECRET_KEY || '',
    publicBase: (env.S3_PUBLIC_BASE || '').replace(/\/$/, ''),
    get live() { return Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY); },
  },

  handle: env.IG_HANDLE || '@hesap',
  timezone: env.TZ_NAME || 'Europe/Istanbul',

  // Posting rhythm, exactly as briefed: two a day normally, more when there is a
  // match on, and nothing at all on days with nothing worth saying.
  cadence: {
    normalPerDay: Number(env.POSTS_PER_DAY || 2),
    matchDayMax: Number(env.POSTS_MATCH_DAY || 4),
    quietDayChance: Number(env.QUIET_DAY_CHANCE || 0.15),
    slots: (env.POST_SLOTS || '11:00,19:30').split(',').map((s) => s.trim()),
  },
};

export function describeMode() {
  return {
    football: config.football.live ? 'live' : 'mock',
    instagram: config.instagram.live ? 'live' : 'dry-run',
    storage: config.storage.live ? 'live' : 'local',
  };
}
