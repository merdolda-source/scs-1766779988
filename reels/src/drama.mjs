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

function msg(who, text, opts = {}) {
  return { dir: 'in', name: CAST[who].name, color: CAST[who].color, text, time: now(), typingBefore: true, ...opts };
}
function me(text) { return { dir: 'out', text, time: now(), typingBefore: true }; }
function sys(text) { return { sys: true, text }; }

// ---- pre-match --------------------------------------------------------------

export function preMatchScript(match, rng) {
  const rival = match.home.name;
  const dayText = match.dateText ? `${match.dateText} ${match.time}` : match.time;

  const openers = [
    msg('ismail', `Arkadaşlar ${rival} maçına 2 gün kaldı, moralleri toplayalım 💪`),
    msg('hakan', `${rival} maçı yaklaştı, taksi durağında konuşulan tek şey bu`),
  ];

  const nervous = [
    msg('necati', 'Bizim zamanımızda bu maçlar 2 dakikada biterdi, şimdi 90 dakika stres'),
    msg('necati', '90 dakika kalp krizi garanti, tansiyon ilacını şimdiden aldım'),
  ];

  const stat = [
    msg('ayse', `İstatistiklere göre iyi durumdayız, ama bu maçlarda istatistik bir şey ifade etmiyor 📊`),
    msg('ayse', `Analiz yaptım, form iyi ama ${rival} deplasmanda inatçı`),
  ];

  const rumor = [
    msg('hakan', 'Bir müşterim antrenmanı izlemiş, kadro gayet iyi görünüyormuş diyor'),
    msg('hakan', 'İçeriden bilgi: hoca sürpriz bir 11 çıkarabilirmiş, garanti değil ama'),
  ];

  const meme = [
    msg('burak', 'İşten izin aldım, maç günü hastayım resmi olarak 🤒'),
    msg('burak', 'Patrona "dişçi randevum var" dedim, dişçi maçı izliyor aslında'),
  ];

  const meLine = [
    me('Ben de eşe söyledim, o gün başka planımız olmuyor kesin'),
    me('Bilet aldım, artık geri dönüş yok 😅'),
  ];

  const closer = [
    sys(`📅 ${dayText}`),
    msg('ismail', 'Herkes yerinde olsun, grup halinde takip ediyoruz. Skor tahmini yapalım mı?'),
  ];

  const messages = [
    ...openers.slice(0, 1),
    pick(rng, nervous),
    pick(rng, stat),
    pick(rng, rumor),
    pick(rng, meme),
    pick(rng, meLine),
    ...closer,
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

const REACTIONS = {
  'domination': [
    (r) => msg('ismail', `${r} yedirmedik bile! Bugün her şey yerli yerinde 🔥`),
    (r) => msg('burak', 'Rakip sahaya niye çıktı ki bugün anlamadım'),
  ],
  'big-win': [
    () => msg('ismail', 'Ne maçtı ama! Bu takım işini biliyor 💛❤️'),
    () => msg('hakan', 'Taksi durağında kornalar çalıyor şu an, herkes mutlu'),
  ],
  'narrow-win': [
    () => msg('necati', 'Kalp krizinden döndüm ama kazandık, önemli olan bu'),
    () => msg('ayse', 'Zor kazandık ama 3 puan 3 puandır, istatistik böyle söylüyor'),
  ],
  'draw': [
    () => msg('necati', 'Bizim zamanımızda bu maçı kazanırdık, hocaya söyleyin'),
    () => msg('burak', '1 puan da puandır diyorum kendime ama içimden bir ses inanmıyor'),
  ],
  'loss': [
    () => msg('necati', 'Bizim zamanımızda... neyse, konuşmayayım daha iyi'),
    () => msg('ayse', 'İstatistik bugün susuyor, yorum yapmayacağım'),
  ],
};

const CLOSERS = {
  'domination': [msg('ismail', 'Bir sonraki maça kadar bu tadı çıkaralım 🏆')],
  'big-win': [msg('hakan', 'Bu formla devam edelim, müşterilerim de umutlu')],
  'narrow-win': [msg('ismail', 'Kazandık ya, gerisi teferruat. Sıradaki maça bakalım')],
  'draw': [msg('ismail', 'Toparlanırız, sıradaki maç fırsat')],
  'loss': [msg('ismail', 'Kafalar yukarıda, sıradaki maçta telafi ederiz 💪')],
};

export function postMatchScript(match, goals, rng) {
  const us = config.team.name;
  const usHome = match.home.name === us;
  const ourScore = usHome ? match.home.score : match.away.score;
  const theirScore = usHome ? match.away.score : match.home.score;
  const rival = usHome ? match.away.name : match.home.name;
  const v = verdict(ourScore, theirScore);

  const scoreLine = sys(`⚽️ MS: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`);

  // Show at most 4, but never drop the last goal - it is usually the most
  // dramatic (an equaliser, a winner, a late collapse) and cutting it loses the
  // whole point of the post for a close match.
  const allGoals = goals || [];
  const shown = allGoals.length <= 4
    ? allGoals
    : [...allGoals.slice(0, 3), allGoals[allGoals.length - 1]];
  const goalNotes = shown.map((g) => {
    const scoredByUs = (g.team === 'home') === usHome;
    if (!scoredByUs) {
      return pick(rng, [
        msg('necati', `${g.minuteText} golü yedik, savunma bir toparlansın`),
        msg('burak', `${g.minuteText} dk gol yedik, kalp krizi geçirdim resmen`),
      ]);
    }
    return pick(rng, [
      msg('ismail', `${g.minuteText} ${g.player} GOOOL! Ne güzel attı 🔥`),
      msg('ayse', `${g.minuteText} ${g.player}'den gol geldi, istatistiklere yansıdı bile`),
      msg('hakan', `${g.minuteText} ${g.player} golü attı, durakta bağırışlar duyuldu`),
    ]);
  });

  const messages = [
    scoreLine,
    ...pickN(rng, REACTIONS[v], 1).map((f) => f(rival)),
    ...goalNotes,
    pick(rng, [
      msg('hakan', 'Yorumlara skor tahmini yazan var mıydı, tutan çıktı mı bakalım'),
      msg('burak', 'Maçtan sonraki en iyi anı: notifications kapatmama rağmen herkesin mesajı'),
    ]),
    ...CLOSERS[v],
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
