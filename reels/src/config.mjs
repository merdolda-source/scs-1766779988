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

  // Our own PHP endpoints (fikstur.php / puanlig.php). Without a base URL the
  // adapter serves mock responses in the identical shape, so the pipeline runs
  // end to end offline.
  data: {
    base: (env.DATA_BASE_URL || '').replace(/\/$/, ''),
    lig: env.DATA_LIG || 'super-lig',
    // Default is reading sporx directly; a base URL routes through the
    // project's own PHP endpoints instead.
    get usePhp() { return Boolean(env.DATA_BASE_URL); },
  },

  // Meta offers two routes to the same publishing endpoints and they sit on
  // different hosts:
  //   instagram - "Instagram API with Instagram Login", no Facebook Page needed
  //   facebook  - "Instagram API with Facebook Login", Page required
  instagram: {
    mode: (env.IG_MODE || 'instagram').toLowerCase(),
    userId: env.IG_USER_ID || '',
    token: env.IG_ACCESS_TOKEN || '',
    appId: env.IG_APP_ID || '',
    appSecret: env.IG_APP_SECRET || '',
    version: env.IG_API_VERSION || 'v21.0',
    get host() {
      return this.mode === 'facebook' ? 'https://graph.facebook.com' : 'https://graph.instagram.com';
    },
    get graph() { return `${this.host}/${this.version}`; },
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

  // Free fallback host. In Actions GITHUB_TOKEN and GITHUB_REPOSITORY are
  // present automatically; the repo must be public for the URLs to be reachable.
  releases: {
    token: env.GITHUB_TOKEN || env.GH_TOKEN || '',
    repo: env.GITHUB_REPOSITORY || '',
    tag: env.RELEASE_TAG || 'reels',
    get live() { return Boolean((env.GITHUB_TOKEN || env.GH_TOKEN) && env.GITHUB_REPOSITORY); },
  },

  // Final fallback: commit the file and serve it over raw. Needs only git push
  // rights, which every runner here has, but the repo must be public.
  gitHost: {
    repo: env.GIT_HOST_REPO || env.GITHUB_REPOSITORY || '',
    branch: env.GIT_HOST_BRANCH || 'main',
    dir: env.GIT_HOST_DIR || 'public',
    keepDays: Number(env.GIT_HOST_KEEP_DAYS || 21),
    get live() { return Boolean(env.GIT_HOST_REPO || env.GITHUB_REPOSITORY); },
  },

  tts: {
    apiKey: env.ELEVENLABS_API_KEY || '',
    get live() { return Boolean(env.ELEVENLABS_API_KEY); },
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
    data: config.data.usePhp ? 'php endpoint' : 'sporx (doğrudan)',
    instagram: config.instagram.live ? 'live' : 'dry-run',
    storage: config.storage.live ? 's3'
      : config.releases.live ? 'github-release'
      : config.gitHost.live ? 'git-raw' : 'local',
  };
}
