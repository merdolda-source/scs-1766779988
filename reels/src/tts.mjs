// ElevenLabs voice synthesis for the chat-drama format.
//
// Two responsibilities: turn each line into an audio clip (cached, so a re-run
// never re-bills a line it already has), and compute the timeline those clips
// imply - a bubble has to stay on screen exactly as long as its line takes to
// say, which the old text-length heuristic could only approximate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { config } from './config.mjs';

const API = 'https://api.elevenlabs.io/v1';
const CACHE_DIR = path.join(config.root, 'data', 'tts-cache');

// One fixed voice per recurring character, so the cast sounds the same episode
// to episode - picked from ElevenLabs' premade library for a spread of age/tone
// that roughly matches each persona.
export const VOICES = {
  ismail: 'iP95p4xoKVk53GoZ742B', // Chris - warm, down-to-earth
  ayse: 'EXAVITQu4vr4xnSDxMaL',   // Sarah - confident
  necati: 'pqHfZKP75CvOlQylNhV4', // Bill - old, wise
  burak: 'TX3LPaxmHKxFdv7VOQHJ',  // Liam - energetic, young
  hakan: 'CwhRBWXzGAHq8TQ4Fs17',  // Roger - laid-back, casual
};

function key(voiceId, text) {
  return crypto.createHash('sha1').update(voiceId + '|' + text).digest('hex').slice(0, 20);
}

// Emoji in the input confuses ElevenLabs' multilingual model - it sometimes
// tries to vocalize the glyph, sometimes just slurs or drops the word next to
// it. And a line ending on a bare number with no terminal punctuation ("...
// tek başıma 3") reliably gets its last token clipped short, since the model
// has no cue that the sentence is actually over. Neither problem is visible
// in the bubble text (emoji stay there for the reader), only in what gets
// sent to the API.
function cleanForSpeech(text) {
  const stripped = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').trim();
  return /[.!?…]$/.test(stripped) ? stripped : stripped + '.';
}

function probeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

// One line -> {path, duration}. Disk-cached by (voice, text): the same joke
// text never gets billed twice, which matters since the character/episode
// pools repeat across matches.
export async function synthesizeLine(text, voiceId) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${key(voiceId, text)}.mp3`);
  if (fs.existsSync(file)) return { path: file, duration: probeDuration(file) };

  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': config.tts.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return { path: file, duration: probeDuration(file) };
}

// Walks the message list in the same order the scene renders it and stamps
// real arrival/hold times, driven by actual clip length instead of a guess.
// System pills (the final-score card) and the operator's own lines stay
// unvoiced - only cast members speak.
const TYPE_DUR = 0.7;
const PRE_ROLL = 0.15; // bubble appears just before the voice starts, not after
const TAIL = 0.35;     // hold on screen briefly after the line finishes

// The scene always appends this much after the last item for the closing
// handle/branding hold (see chat-drama: lastAt+0.4, then +2.6 for the foot
// fade) - anything driving the mixed audio's target length has to add the
// same amount, or -shortest in the final mux truncates the outro because the
// audio track is a few seconds shorter than the video actually runs.
export const CHAT_OUTRO_TAIL = 3.0;

export async function layoutVoicedTimeline(messages, { startAt = 0.3, voices = VOICES } = {}) {
  let t = startAt;
  const items = [];

  for (const m of messages) {
    if (m.sys) {
      items.push({ ...m, at: t, dur: 0.4 });
      t += 1.0;
      continue;
    }

    if (m.typingBefore) {
      items.push({ typing: true, dir: m.dir, at: t, dur: TYPE_DUR });
      t += TYPE_DUR + 0.15;
    }

    // Emoji-only reaction lines (e.g. "😂😂😂") don't get a voice line - TTS
    // reading out emoji is nonsense. A laughter sfx cue can stand in instead;
    // see the caller for how that gets spliced into the same mix.
    const voiceId = m.skipVoice || m.dir === 'out' ? null : voices[m.voiceKey];
    let dur = Math.max(1.0, m.text.length * 0.045); // fallback if unvoiced
    let audio = null;

    if (voiceId) {
      const clip = await synthesizeLine(cleanForSpeech(m.text), voiceId);
      audio = clip.path;
      dur = clip.duration + TAIL;
    } else if (m.skipVoice) {
      dur = m.holdSeconds || 1.2; // how long the reaction bubble sits up on its own
    }

    items.push({ ...m, at: t - PRE_ROLL, dur, audio, audioAt: t });
    t += dur - PRE_ROLL + 0.25;
  }

  return { items, totalDuration: t + 0.5 };
}

// Short generated sound effects (laughter, tension stings) - same disk-cache
// discipline as voice lines, keyed by prompt text so a repeated cue never
// re-bills or re-renders.
export async function synthesizeSfx(prompt, durationSeconds = 2) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `sfx-${key('sfx', prompt)}.mp3`);
  if (fs.existsSync(file)) return { path: file, duration: probeDuration(file) };

  const res = await fetch(`${API}/sound-generation`, {
    method: 'POST',
    headers: { 'xi-api-key': config.tts.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds }),
  });
  if (!res.ok) throw new Error(`ElevenLabs sfx ${res.status}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return { path: file, duration: probeDuration(file) };
}

// Mixes every voiced clip into one track, each delayed to the moment it should
// start speaking. Kept separate from music.mjs's synthesis path entirely -
// this is real recorded audio being placed on a timeline, not a generated bed.
export async function buildMixedAudio(items, totalDuration, outPath) {
  const voiced = items.filter((it) => it.audio);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (!voiced.length) {
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', String(totalDuration), outPath,
    ]);
    return outPath;
  }

  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const it of voiced) args.push('-i', it.audio);

  // A cue with no `.dir` is a pure background layer (an ambient sting placed
  // under dialogue that's already speaking for itself, not a line's own
  // voice or a skipVoice reaction standing in for one) - turned down so it
  // doesn't compete with the speech on top of it.
  const delays = voiced.map((it, i) => {
    const ms = Math.max(0, Math.round(it.audioAt * 1000));
    const vol = it.dir ? '' : 'volume=0.35,';
    return `[${i}:a]${vol}adelay=${ms}|${ms}[a${i}]`;
  });
  // amix's natural output length is its longest input, which ends when the
  // last line finishes speaking - short of the outro hold the scene adds
  // afterward. `-t` on the output only trims, it never extends a stream that
  // is already shorter, so without explicit padding the mixed track stayed a
  // few seconds short and -shortest in the main mux truncated the video's
  // closing branding to match. apad fills the gap with real silence instead.
  const mix = `${voiced.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voiced.length}:duration=longest:normalize=0,`
    + `apad=whole_dur=${totalDuration}[mixed]`;
  const filter = [...delays, mix].join(';');

  args.push(
    '-filter_complex', filter, '-map', '[mixed]',
    '-t', String(totalDuration), '-ar', '44100', '-ac', '2', outPath,
  );
  execFileSync('ffmpeg', args);
  return outPath;
}
