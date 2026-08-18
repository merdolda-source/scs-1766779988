// Instagram fetches the video from a URL, so the file has to be publicly
// reachable before publishing. This signs a plain S3 PUT (SigV4) which works
// against Cloudflare R2, AWS S3 and anything else S3-compatible - no SDK.
//
// Untested end to end: it needs real credentials to exercise. Without them the
// pipeline keeps the file locally and reports that publishing would be skipped.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const hmac = (key, str) => crypto.createHmac('sha256', key).update(str).digest();
const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export async function uploadVideo(localPath, key) {
  if (!config.storage.live) {
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
