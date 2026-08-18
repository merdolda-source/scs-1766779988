// Tiny append-only ledger so a re-run never publishes the same post twice.
// Keyed by a stable id derived from the plan item, not by timestamp.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const FILE = path.join(config.root, 'data', 'posted.json');

export function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { posts: [] }; }
}

export function hasPosted(key) {
  return load().posts.some((p) => p.key === key);
}

// Between matchweeks the next-match card and the fixture list barely change, so
// keying only on the item id would send a near-identical post out every day.
// This compares what the post actually contains, over a rolling window.
export function postedRecently(fingerprint, days = 6) {
  if (!fingerprint) return false;
  const since = Date.now() - days * 86400000;
  return load().posts.some((p) =>
    p.fingerprint === fingerprint && new Date(p.at).getTime() >= since);
}

export function record(entry) {
  const s = load();
  s.posts.push({ ...entry, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}
