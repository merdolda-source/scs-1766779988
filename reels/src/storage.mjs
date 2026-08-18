// Instagram fetches the video from a URL, so the file has to be publicly
// reachable before publishing. This signs a plain S3 PUT (SigV4) which works
// against Cloudflare R2, AWS S3 and anything else S3-compatible - no SDK.
//
// Untested end to end: it needs real credentials to exercise. Without them the
// pipeline keeps the file locally and reports that publishing would be skipped.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from './config.mjs';

// Two backends. S3 is the durable one. GitHub Releases is the free fallback:
// on a public repo, release assets have public download URLs and, unlike files
// committed to the tree, they do not grow the git history - which matters when
// this uploads several videos a day forever.

const hmac = (key, str) => crypto.createHmac('sha256', key).update(str).digest();
const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export async function uploadVideo(localPath, key) {
  if (!config.storage.live) {
    if (config.releases.live) {
      try { return await uploadToRelease(localPath, key); }
      catch (err) {
        // Release upload needs REST access. A runner with only git credentials
        // gets 403 here, so fall through to committing the file instead.
        if (config.gitHost.live) return commitToRepo(localPath, key);
        throw err;
      }
    }
    if (config.gitHost.live) return commitToRepo(localPath, key);
    return { uploaded: false, url: null, reason: 'storage not configured', localPath };
  }

  const body = fs.readFileSync(localPath);
  const { endpoint, bucket, region, accessKey, secretKey, publicBase } = config.storage;
  const host = new URL(endpoint).host;
  const canonicalUri = '/' + bucket + '/' + key.split('/').map(encodeURIComponent).join('/');

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);

  const headers = {
    host,
    'content-type': 'video/mp4',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  let k = hmac('AWS4' + secretKey, dateStamp);
  k = hmac(k, region); k = hmac(k, 's3'); k = hmac(k, 'aws4_request');
  const signature = crypto.createHmac('sha256', k).update(stringToSign).digest('hex');

  const res = await fetch(endpoint.replace(/\/$/, '') + canonicalUri, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, `
        + `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${await res.text()}`);

  const base = publicBase || `${endpoint.replace(/\/$/, '')}/${bucket}`;
  return { uploaded: true, url: `${base}/${key}`, bytes: body.length };
}


// ---- GitHub Releases backend ----------------------------------------------

async function gh(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.releases.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function ensureRelease(repo, tag) {
  const found = await gh(`https://api.github.com/repos/${repo}/releases/tags/${tag}`);
  if (found.ok) return found.body;

  const made = await gh(`https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: 'Yayınlanan reels',
      body: 'Instagram bu videoları herkese açık bir URL üzerinden çekiyor. '
        + 'Depo geçmişini şişirmemek için dosyalar burada tutuluyor.',
    }),
  });
  if (!made.ok) throw new Error(`release oluşturulamadı: ${made.status} ${JSON.stringify(made.body)}`);
  return made.body;
}

async function uploadToRelease(localPath, key) {
  const { repo, tag, token } = config.releases;
  const release = await ensureRelease(repo, tag);
  const name = key.replace(/[^a-zA-Z0-9._-]/g, '-');

  // Asset names are unique per release, so replace any leftover from a rerun.
  const existing = (release.assets || []).find((a) => a.name === name);
  if (existing) {
    await gh(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, { method: 'DELETE' });
  }

  const body = fs.readFileSync(localPath);
  const res = await fetch(
    `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'video/mp4',
        'Content-Length': String(body.length),
      },
      body,
    });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`asset yüklenemedi: ${res.status} ${JSON.stringify(json)}`);

  return { uploaded: true, url: json.browser_download_url, bytes: body.length, backend: 'github-release' };
}


// ---- git backend -----------------------------------------------------------
//
// Last resort, for runners that can push but cannot reach the REST API. The
// repository must be public for raw URLs to be fetchable. It grows the history,
// so old files are pruned on the way past.

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function pruneOld(dir, keepDays) {
  const cutoff = Date.now() - keepDays * 86400000;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try { if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true }); } catch { /* ignore */ }
  }
}

async function commitToRepo(localPath, key) {
  const { repo, branch, dir, keepDays } = config.gitHost;
  const root = path.resolve(config.root, '..');
  const target = path.join(root, dir);
  fs.mkdirSync(target, { recursive: true });

  const name = key.replace(/[^a-zA-Z0-9._-]/g, '-');
  fs.copyFileSync(localPath, path.join(target, name));
  pruneOld(target, keepDays);

  git(['config', 'user.name', 'reels-bot'], root);
  git(['config', 'user.email', 'reels-bot@users.noreply.github.com'], root);
  git(['add', '-A', dir], root);
  try { git(['commit', '-m', `chore: medya ${name} [skip ci]`], root); }
  catch { /* nothing staged */ }

  // Another run may have pushed since; rebase rather than fail.
  try { git(['pull', '--rebase', '--autostash', 'origin', branch], root); } catch { /* ignore */ }
  git(['push', 'origin', `HEAD:${branch}`], root);

  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${dir}/${name}`;
  return { uploaded: true, url, bytes: fs.statSync(localPath).size, backend: 'git-raw' };
}
