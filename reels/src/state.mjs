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

export function record(entry) {
  const s = load();
  s.posts.push({ ...entry, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}
