// Turns whatever Meta hands you in the browser into the two values the
// publisher actually needs (IG_USER_ID, IG_ACCESS_TOKEN), and prints them as
// .env lines. Also refreshes a long-lived token before it expires.
//
//   node src/ig-setup.mjs --token <short-lived-token>
//   node src/ig-setup.mjs --refresh
//
// Short-lived tokens last about an hour, long-lived ones 60 days. This exchanges
// the first for the second so the job does not die mid-week.
import { config } from './config.mjs';

const arg = (n, d = '') => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : (process.argv[i + 1] || '');
};
const has = (n) => process.argv.includes('--' + n);

// Tokens are secrets: show only enough to tell two apart.
const mask = (t) => (t ? `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} karakter)` : '(yok)');

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(JSON.stringify(json.error || json));
  return json;
}

async function viaInstagramLogin(shortToken) {
  if (!config.instagram.appSecret) {
    throw new Error('IG_APP_SECRET gerekli (Meta uygulamanın App Secret değeri).');
  }
  const long = await get(`${config.instagram.host}/access_token?`
    + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: config.instagram.appSecret,
      access_token: shortToken,
    }));

  const me = await get(`${config.instagram.graph}/me?`
    + new URLSearchParams({ fields: 'id,username,account_type', access_token: long.access_token }));

  return {
    mode: 'instagram',
    userId: me.id,
    username: me.username,
    accountType: me.account_type,
    token: long.access_token,
    expiresInDays: Math.round((long.expires_in || 0) / 86400),
  };
}

async function viaFacebookLogin(shortToken) {
  if (!config.instagram.appId || !config.instagram.appSecret) {
    throw new Error('IG_APP_ID ve IG_APP_SECRET gerekli.');
  }
  const long = await get(`https://graph.facebook.com/${config.instagram.version}/oauth/access_token?`
    + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.instagram.appId,
      client_secret: config.instagram.appSecret,
      fb_exchange_token: shortToken,
    }));

  const pages = await get(`https://graph.facebook.com/${config.instagram.version}/me/accounts?`
    + new URLSearchParams({ access_token: long.access_token }));

  for (const page of pages.data || []) {
    const linked = await get(`https://graph.facebook.com/${config.instagram.version}/${page.id}?`
      + new URLSearchParams({ fields: 'instagram_business_account{id,username}', access_token: long.access_token }));
    const ig = linked.instagram_business_account;
    if (ig) {
      return {
        mode: 'facebook',
        userId: ig.id,
        username: ig.username,
        pageName: page.name,
        // Page tokens derived from a long-lived user token do not expire.
        token: page.access_token || long.access_token,
        expiresInDays: long.expires_in ? Math.round(long.expires_in / 86400) : null,
      };
    }
  }
  throw new Error('Hiçbir Facebook Sayfasına bağlı Instagram Business hesabı bulunamadı.');
}

async function refresh() {
  if (config.instagram.mode !== 'instagram') {
    console.log('Facebook Login modunda sayfa token\'ı süresizdir; yenileme gerekmez.');
    return;
  }
  const r = await get(`${config.instagram.host}/refresh_access_token?`
    + new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: config.instagram.token }));
  console.log('Yenilendi. Yeni token:', mask(r.access_token));
  console.log(`Geçerlilik: ~${Math.round((r.expires_in || 0) / 86400)} gün\n`);
  console.log('.env dosyasındaki satırı güncelle:\n');
  console.log(`IG_ACCESS_TOKEN=${r.access_token}`);
}

if (has('refresh')) {
  await refresh();
} else {
  const short = arg('token');
  if (!short) {
    console.error('Kullanım: node src/ig-setup.mjs --token <kısa-ömürlü-token>');
    console.error('          node src/ig-setup.mjs --refresh');
    process.exit(1);
  }
  const mode = arg('mode', config.instagram.mode);
  const r = mode === 'facebook' ? await viaFacebookLogin(short) : await viaInstagramLogin(short);

  console.log('\n✓ Bağlantı kuruldu\n');
  console.log('  Hesap      :', r.username, r.accountType ? `(${r.accountType})` : '');
  if (r.pageName) console.log('  Sayfa      :', r.pageName);
  console.log('  IG User ID :', r.userId);
  console.log('  Token      :', mask(r.token));
  if (r.expiresInDays) console.log('  Geçerlilik : ~' + r.expiresInDays + ' gün');
  console.log('\n.env dosyasına şunları yaz:\n');
  console.log(`IG_MODE=${r.mode}`);
  console.log(`IG_USER_ID=${r.userId}`);
  console.log(`IG_ACCESS_TOKEN=${r.token}`);
}
