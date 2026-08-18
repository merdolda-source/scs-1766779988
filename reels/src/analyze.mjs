// Reads the account's own insights and reports what is actually happening.
//
//   node src/analyze.mjs
//
// Reach without interaction is the number that matters here: Instagram gives a
// new account a test audience, and what that audience does decides whether it
// gets another. Impressions with a zero engagement rate mean the content is
// being shown and ignored - a content problem, not a hashtag or timing one.
import { config } from './config.mjs';

const G = config.instagram.graph;
const T = config.instagram.token;

async function get(pathname, params) {
  const url = new URL(G + pathname);
  for (const [k, v] of Object.entries({ ...params, access_token: T })) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

if (!config.instagram.live) {
  console.error('IG_USER_ID ve IG_ACCESS_TOKEN gerekli.');
  process.exit(1);
}

const me = await get('/me', {
  fields: 'username,name,biography,followers_count,follows_count,media_count',
});

const media = (await get('/me/media', {
  fields: 'id,caption,media_product_type,timestamp,permalink',
  limit: 30,
})).data || [];

const rows = [];
for (const m of media) {
  let v = {};
  try {
    const ins = await get(`/${m.id}/insights`, { metric: 'reach,views,likes,comments,shares,saved' });
    v = Object.fromEntries(ins.data.map((x) => [x.name, x.values[0].value]));
  } catch { /* insights unavailable for this item */ }
  const eng = (v.likes || 0) + (v.comments || 0) + (v.shares || 0) + (v.saved || 0);
  rows.push({
    date: m.timestamp.slice(0, 16).replace('T', ' '),
    type: m.media_product_type,
    reach: v.reach || 0,
    views: v.views || 0,
    eng,
    rate: v.reach ? (eng / v.reach) * 100 : 0,
    head: (m.caption || '(metin yok)').split('\n')[0].slice(0, 38),
    permalink: m.permalink,
  });
}

const reach = rows.reduce((a, r) => a + r.reach, 0);
const eng = rows.reduce((a, r) => a + r.eng, 0);

console.log(`\n@${me.username} · ${me.name}`);
console.log(`${me.followers_count} takipçi · ${me.media_count} gönderi\n`);
const L = (v, n) => String(v).padEnd(n);
const R = (v, n) => String(v).padStart(n);

console.log(L('tarih', 18) + L('tip', 8) + R('erişim', 7) + R('izlen', 7)
  + R('etkil', 6) + R('oran', 7) + '  başlık');
for (const r of rows) {
  console.log(L(r.date, 18) + L(r.type, 8) + R(r.reach, 7) + R(r.views, 7)
    + R(r.eng, 6) + R('%' + r.rate.toFixed(1), 7) + '  ' + r.head);
}

const rate = reach ? (eng / reach) * 100 : 0;
console.log(`\nTOPLAM  erişim ${reach} · etkileşim ${eng} · oran %${rate.toFixed(2)}`);

// Thresholds are rough but the distinction they draw is the useful one: is the
// content failing to reach people, or reaching them and leaving them cold?
if (reach === 0) console.log('\nTeşhis: hiç dağıtım yok. Hesap yeni ya da kısıtlı olabilir.');
else if (rate < 0.5) {
  console.log('\nTeşhis: dağıtım var, etkileşim yok — içerik sorunu.');
  console.log('  Instagram içeriği gösteriyor ama izleyen tepki vermiyor,');
  console.log('  bu yüzden daha ileri taşımıyor. Etiket veya saat değişikliği bunu çözmez.');
  console.log('  Bakılacak yer: ilk 1 saniye, kaydetmeye/yoruma değer bir sebep var mı.');
} else if (rate < 2) console.log('\nTeşhis: zayıf ama sıfır değil. Kanca ve çağrı güçlendirilmeli.');
else console.log('\nTeşhis: etkileşim sağlıklı. Sıklığı artırmak mantıklı.');
