// Preflight: checks every leg of the pipeline and says exactly what is missing.
//
//   node src/doctor.mjs
//
// The storage check actually uploads a file and fetches it back over the public
// URL, because the common failure is a bucket that works for writes but is not
// publicly readable - and Instagram fetches the video over that URL, so a
// private bucket fails only at publish time.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';
import { getFixtures, getStandings } from './sporx-api.mjs';
import { uploadVideo } from './storage.mjs';

const run = promisify(execFile);
const results = [];
const ok = (name, detail) => results.push({ ok: true, name, detail });
const bad = (name, detail) => results.push({ ok: false, name, detail });
const skip = (name, detail) => results.push({ ok: null, name, detail });

// --- tools -----------------------------------------------------------------
try {
  const { stdout } = await run('ffmpeg', ['-version']);
  ok('ffmpeg', stdout.split('\n')[0].slice(0, 48));
} catch { bad('ffmpeg', 'bulunamadı — apt-get install ffmpeg'); }

const chrome = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.existsSync(chrome) ? ok('chromium', chrome) : bad('chromium', 'bulunamadı');

// --- data ------------------------------------------------------------------
try {
  const fx = await getFixtures({ lig: config.data.lig });
  const played = fx.matches.filter((m) => m.finished).length;
  if (!fx.matches.length) bad('veri: fikstür', 'hafta boş döndü — kaynak yapısı değişmiş olabilir');
  else ok('veri: fikstür', `${fx.league} ${fx.week}. hafta · ${fx.matches.length} maç (${played} oynandı)`);
} catch (e) { bad('veri: fikstür', e.message); }

try {
  const t = await getStandings({ lig: config.data.lig });
  const us = t.rows.find((r) => r.isUs);
  if (!t.rows.length) bad('veri: puan durumu', 'tablo boş');
  else if (!us) bad('veri: puan durumu', `${config.team.name} tabloda yok — TEAM_NAME yazımı kaynakla birebir eşleşmeli`);
  else ok('veri: puan durumu', `${t.rows.length} takım · ${us.team} ${us.rank}. sırada, ${us.points} puan`);
} catch (e) { bad('veri: puan durumu', e.message); }

// --- storage ---------------------------------------------------------------
if (!config.storage.live) {
  skip('depolama', 'yapılandırılmadı — S3_* değerleri boş');
} else {
  const probe = path.join(config.outDir, '.doctor-probe.txt');
  fs.mkdirSync(config.outDir, { recursive: true });
  fs.writeFileSync(probe, 'doctor ' + Date.now());
  try {
    const up = await uploadVideo(probe, `doctor/probe-${Date.now()}.txt`);
    const res = await fetch(up.url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) ok('depolama', `yükleme + herkese açık okuma çalışıyor (${up.url.split('/').slice(0, 3).join('/')})`);
    else bad('depolama', `yüklendi ama herkese açık DEĞİL (GET ${res.status}). Instagram videoyu çekemez.`);
  } catch (e) { bad('depolama', e.message); }
  finally { fs.rmSync(probe, { force: true }); }
}

// --- instagram -------------------------------------------------------------
if (!config.instagram.live) {
  skip('instagram', 'yapılandırılmadı — IG_USER_ID / IG_ACCESS_TOKEN boş');
} else {
  try {
    const url = `${config.instagram.graph}/${config.instagram.userId}?`
      + new URLSearchParams({ fields: 'username,account_type', access_token: config.instagram.token });
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) bad('instagram', JSON.stringify(json.error));
    else {
      ok('instagram', `@${json.username}${json.account_type ? ' · ' + json.account_type : ''} · mod: ${config.instagram.mode}`);
      // A publishing-capable token exposes the publishing limit endpoint.
      const limUrl = `${config.instagram.graph}/${config.instagram.userId}/content_publishing_limit?`
        + new URLSearchParams({ access_token: config.instagram.token });
      const lim = await (await fetch(limUrl)).json();
      if (lim.error) bad('instagram: paylaşım izni', 'content_publish izni yok gibi — ' + JSON.stringify(lim.error));
      else ok('instagram: paylaşım izni', `son 24 saatte ${lim.data?.[0]?.quota_usage ?? 0}/100 kullanıldı`);
    }
  } catch (e) { bad('instagram', e.message); }
}

// --- report ----------------------------------------------------------------
console.log('');
for (const r of results) {
  const mark = r.ok === true ? '  ✓' : r.ok === false ? '  ✗' : '  –';
  console.log(`${mark} ${r.name.padEnd(24)} ${r.detail}`);
}
const failed = results.filter((r) => r.ok === false).length;
const skipped = results.filter((r) => r.ok === null).length;
console.log(`\n${results.filter((r) => r.ok).length} tamam · ${failed} hata · ${skipped} eksik yapılandırma`);
console.log(failed
  ? '\nHatalar giderilmeden otomatik paylaşım çalışmaz.'
  : skipped
    ? '\nVideo üretimi hazır. Paylaşım için eksik yapılandırmayı tamamla.'
    : '\nHer şey hazır — paylaşım yapılabilir.');
process.exit(failed ? 1 : 0);
