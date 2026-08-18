// Instagram Content Publishing: create a REELS container pointing at a public
// video URL, wait for Instagram to finish ingesting it, then publish.
// Without credentials this reports what it would have done and changes nothing.
import { config } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(pathname, params, method = 'POST') {
  const url = new URL(config.instagram.graph + pathname);
  const body = new URLSearchParams({ ...params, access_token: config.instagram.token });
  const res = method === 'GET'
    ? await fetch(url + '?' + body, { method: 'GET' })
    : await fetch(url, { method, body });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph ${pathname}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

export async function publishReel({ videoUrl, caption, coverUrl = null, dryRun = false }) {
  if (dryRun || !config.instagram.live || !videoUrl) {
    return {
      published: false,
      reason: !config.instagram.live ? 'instagram not configured'
        : !videoUrl ? 'no public video url' : 'dry run',
      wouldPost: { videoUrl, coverUrl, caption },
    };
  }

  const { id: creationId } = await graph(`/${config.instagram.userId}/media`, {
    media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true',
    // Without this Instagram picks its own frame, which is usually mid-animation.
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  });

  // Ingestion is asynchronous; publishing too early fails.
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const s = await graph(`/${creationId}`, { fields: 'status_code,status' }, 'GET');
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR') throw new Error('container error: ' + JSON.stringify(s));
    if (i === 39) throw new Error('container never finished: ' + JSON.stringify(s));
  }

  const { id } = await graph(`/${config.instagram.userId}/media_publish`, { creation_id: creationId });
  return { published: true, mediaId: id, creationId };
}
