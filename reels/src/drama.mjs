// Fictional WhatsApp fan-group drama, built from real match data.
//
// Five recurring characters carry the running joke across episodes - continuity
// is what makes a bit read as a series rather than a one-off. All fictional: no
// real pundits, no real fans, no claims about real players beyond what the match
// data itself says (score, scorer, minute).
//
// Joke pools are picked with a seed derived from the match id, so the same
// match always renders the same script (reproducible) while different matches
// land on different combinations (not repetitive).
import { config } from './config.mjs';

const CAST = {
  ismail: { name: 'Kaptan İsmail', color: '#4FC3F7' },
  ayse: { name: 'Aslan Ayşe', color: '#FFB74D' },
  necati: { name: 'Emekli Necati', color: '#EF5350' },
  burak: { name: 'Öğrenci Burak', color: '#66BB6A' },
  hakan: { name: 'Taksici Hakan', color: '#BA68C8' },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(rng, arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function msg(who, text, time, opts = {}) {
  return { dir: 'in', name: CAST[who].name, color: CAST[who].color, text, time, typingBefore: true, ...opts };
}
function me(text, time) { return { dir: 'out', text, time, typingBefore: true }; }
function sys(text) { return { sys: true, text }; }

// A believable chat clock: goal chatter lands near the real match minute, the
// full-time card lands after the match actually ends, and the reaction
// messages that follow each tick forward - never the same minute repeated.
//
// The source does not always carry a kickoff time (older fixtures drop it),
// which left the clock reading midnight - "goal at 00:53" is more confusing
// than no timestamp at all. When the time-of-day looks missing, the date is
// kept and the hour defaults to 20:00, Süper Lig's usual slot; nobody is
// fact-checking a fictional chat's clock against the real kickoff minute, the
// only real requirement is that it reads as plausible and keeps moving forward.
function clock(kickoffIso, hasTimeOfDay = true) {
  const raw = kickoffIso ? new Date(kickoffIso) : new Date();
  const base = hasTimeOfDay ? raw : new Date(raw.setHours(20, 0, 0, 0));
  let cursor = 0;
  return {
    at(minutesFromKickoff) {
      cursor = Math.max(cursor, minutesFromKickoff);
      const d = new Date(base.getTime() + cursor * 60000);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    tick(minutes = 1) {
      cursor += minutes;
      const d = new Date(base.getTime() + cursor * 60000);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
  };
}

// ---- pre-match --------------------------------------------------------------

export function preMatchScript(match, rng) {
  const rival = match.home.name;
  const dayText = match.dateText ? `${match.dateText} ${match.time}` : match.time;
  const c = clock(); // "now", 2 days out - real wall-clock chat, just ticking forward

  const messages = [
    msg('ismail', `Arkadaşlar ${rival} maçına 2 gün kaldı, moralleri toplayalım 💪`, c.at(0)),
    pick(rng, [
      msg('necati', 'Bizim zamanımızda bu maçlar 2 dakikada biterdi, şimdi 90 dakika stres', c.tick(2)),
      msg('necati', '90 dakika kalp krizi garanti, tansiyon ilacını şimdiden aldım', c.tick(2)),
    ]),
    pick(rng, [
      msg('ayse', `İstatistiklere göre iyi durumdayız, ama bu maçlarda istatistik bir şey ifade etmiyor 📊`, c.tick(3)),
      msg('ayse', `Analiz yaptım, form iyi ama ${rival} deplasmanda inatçı`, c.tick(3)),
    ]),
    pick(rng, [
      msg('hakan', 'Bir müşterim antrenmanı izlemiş, kadro gayet iyi görünüyormuş diyor', c.tick(4)),
      msg('hakan', 'İçeriden bilgi: hoca sürpriz bir 11 çıkarabilirmiş, garanti değil ama', c.tick(4)),
    ]),
    pick(rng, [
      msg('burak', 'İşten izin aldım, maç günü hastayım resmi olarak 🤒', c.tick(2)),
      msg('burak', 'Patrona "dişçi randevum var" dedim, dişçi maçı izliyor aslında', c.tick(2)),
    ]),
    pick(rng, [
      me('Ben de eşe söyledim, o gün başka planımız olmuyor kesin', c.tick(1)),
      me('Bilet aldım, artık geri dönüş yok 😅', c.tick(1)),
    ]),
    sys(`📅 ${dayText}`),
    msg('ismail', 'Herkes yerinde olsun, grup halinde takip ediyoruz. Skor tahmini yapalım mı?', c.tick(2)),
  ];

  return {
    groupName: `${config.team.name} Taraftar Grubu`,
    members: 'Kaptan İsmail, Aslan Ayşe, Emekli Necati +12',
    avatarText: config.team.short,
    messages,
  };
}

// ---- post-match ---------------------------------------------------------

function verdict(ourScore, theirScore) {
  if (ourScore > theirScore) return theirScore === 0 ? 'domination' : (ourScore - theirScore >= 2 ? 'big-win' : 'narrow-win');
  if (ourScore < theirScore) return 'loss';
  return 'draw';
}

// Every entry takes (rival, time) so the caller controls when on the chat
// clock the line lands - these fire only after full time is known.
const REACTIONS = {
  'domination': [
    (r, t) => msg('ismail', `${r} yedirmedik bile! Bugün her şey yerli yerinde 🔥`, t),
    (r, t) => msg('burak', 'Rakip sahaya niye çıktı ki bugün anlamadım', t),
  ],
  'big-win': [
    (r, t) => msg('ismail', 'Ne maçtı ama! Bu takım işini biliyor 💛❤️', t),
    (r, t) => msg('hakan', 'Taksi durağında kornalar çalıyor şu an, herkes mutlu', t),
  ],
  'narrow-win': [
    (r, t) => msg('necati', 'Kalp krizinden döndüm ama kazandık, önemli olan bu', t),
    (r, t) => msg('ayse', 'Zor kazandık ama 3 puan 3 puandır, istatistik böyle söylüyor', t),
  ],
  'draw': [
    (r, t) => msg('necati', 'Bizim zamanımızda bu maçı kazanırdık, hocaya söyleyin', t),
    (r, t) => msg('burak', '1 puan da puandır diyorum kendime ama içimden bir ses inanmıyor', t),
  ],
  'loss': [
    (r, t) => msg('necati', 'Bizim zamanımızda... neyse, konuşmayayım daha iyi', t),
    (r, t) => msg('ayse', 'İstatistik bugün susuyor, yorum yapmayacağım', t),
  ],
};

const CLOSERS = {
  'domination': [(t) => msg('ismail', 'Bir sonraki maça kadar bu tadı çıkaralım 🏆', t)],
  'big-win': [(t) => msg('hakan', 'Bu formla devam edelim, müşterilerim de umutlu', t)],
  'narrow-win': [(t) => msg('ismail', 'Kazandık ya, gerisi teferruat. Sıradaki maça bakalım', t)],
  'draw': [(t) => msg('ismail', 'Toparlanırız, sıradaki maç fırsat', t)],
  'loss': [(t) => msg('ismail', 'Kafalar yukarıda, sıradaki maçta telafi ederiz 💪', t)],
};

export function postMatchScript(match, goals, rng) {
  const us = config.team.name;
  const usHome = match.home.name === us;
  const ourScore = usHome ? match.home.score : match.away.score;
  const theirScore = usHome ? match.away.score : match.home.score;
  const rival = usHome ? match.away.name : match.home.name;
  const v = verdict(ourScore, theirScore);
  const c = clock(match.kickoff, Boolean(match.time));

  // Chronological, not result-first: the group reacts to each goal as the match
  // clock reaches it, and only finds out the final whistle after the last one -
  // the same order the real conversation would have happened in. Revealing the
  // final score first and then narrating goals backward reads as broken logic.
  const allGoals = goals || [];
  const shown = allGoals.length <= 4
    ? allGoals
    : [...allGoals.slice(0, 3), allGoals[allGoals.length - 1]];

  const goalNotes = shown.map((g) => {
    const scoredByUs = (g.team === 'home') === usHome;
    const at = c.at(g.minute || 0);
    if (!scoredByUs) {
      return pick(rng, [
        msg('necati', `${g.minuteText} golü yedik, savunma bir toparlansın`, at),
        msg('burak', `${g.minuteText} dk gol yedik, kalp krizi geçirdim resmen`, at),
      ]);
    }
    return pick(rng, [
      msg('ismail', `${g.minuteText} ${g.player} GOOOL! Ne güzel attı 🔥`, at),
      msg('ayse', `${g.minuteText} ${g.player}'den gol geldi, istatistiklere yansıdı bile`, at),
      msg('hakan', `${g.minuteText} ${g.player} golü attı, durakta bağırışlar duyuldu`, at),
    ]);
  });

  // Full time lands after the last goal's minute, then reactions tick forward
  // in real time - the group is still typing a minute or two after the whistle.
  const finalAt = c.at(93);
  const messages = [
    ...goalNotes,
    sys(`⚽️ MS: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`),
    ...pickN(rng, REACTIONS[v], 1).map((f) => f(rival, c.tick(1))),
    pick(rng, [
      msg('hakan', 'Yorumlara skor tahmini yazan var mıydı, tutan çıktı mı bakalım', c.tick(2)),
      msg('burak', 'Maçtan sonraki en iyi anı: notifications kapatmama rağmen herkesin mesajı', c.tick(2)),
    ]),
    ...CLOSERS[v].map((f) => f(c.tick(2))),
  ];

  return {
    groupName: `${us} Taraftar Grubu`,
    members: 'Kaptan İsmail, Aslan Ayşe, Emekli Necati +12',
    avatarText: config.team.short,
    messages,
  };
}

export function scriptFor(kind, match, extra = {}) {
  const seedKey = `${kind}-${match.url || match.home.name + match.away.name + match.dateText}`;
  const rng = mulberry32(seedFrom(seedKey));
  return kind === 'pre' ? preMatchScript(match, rng) : postMatchScript(match, extra.goals, rng);
}
