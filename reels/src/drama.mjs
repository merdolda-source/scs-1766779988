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
  return { dir: 'in', name: CAST[who].name, color: CAST[who].color, voiceKey: who, text, time, typingBefore: true, ...opts };
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

// Post-match only, per the brief: no goal-by-goal live commentary. The chat
// opens after the final whistle already knows the score, and scorer names are
// woven into the banter as trivia rather than announced as breaking news.
//
// Earlier drafts picked independent one-liners per character, which read as
// a list of monologues rather than a conversation. This writes hand-authored
// exchanges instead: characters reply to each other, tease, contradict, and
// callback to a running gag (Hakan's implausible customer stories), which is
// what makes a fake chat read as a real one. rng only picks which pre-written
// episode plays, so quality stays high instead of degrading into a random mix.
function burst(who, lines, startTime, tickFn) {
  return lines.map((text, i) => msg(who, text, i === 0 ? startTime : tickFn(0)));
}

function episodesFor(v, { rival, scorers, score }) {
  const s1 = scorers[0] || null;
  const s2 = scorers[1] || null;

  if (v === 'draw') return [
    (c) => [
      msg('ismail', `Bitti. ${score}. Yorumu olan var mı`, c.at(0)),
      msg('necati', 'Yorumum şu: emekliliğimi bu takım yüzünden erken aldım', c.tick(1)),
      msg('burak', 'Necati dede sen emekli değilsin ki, işten kovuldun', c.tick(1)),
      msg('necati', 'Kovulma da bir çeşit emeklilik Burak, terminolojiye takılma', c.tick(1)),
      msg('ayse', `İstatistiksel olarak berabere yenilgiden iyidir, moralinizi bozmayın 📊`, c.tick(2)),
      msg('hakan', `İstatistik mistatistik, ${rival}'a evimizde berabere kalmak ayıp be Ayşe`, c.tick(1)),
      msg('ayse', 'Sen taksi sür Hakan, istatistiğe karışma', c.tick(1)),
      ...burst('burak', ['😭', '😭😭😭'], c.tick(1), (n) => c.tick(n)),
      msg('ismail', s1 ? `Tamam sakin, ${s1} güzel golü de unutmayalım` : 'Tamam sakin, iyi anlar da vardı', c.tick(2)),
      msg('necati', 'Güzeldi de kaçırdığımız pozisyonlar aklımdan çıkmıyor', c.tick(1)),
      msg('hakan', 'Müşterim maç yüzünden taksiden inip yürüyerek gitti, inanmayacaksınız', c.tick(2)),
      msg('burak', 'Hakan sen her maçtan sonra farklı müşteri hikayesi anlatıyorsun, artık inanmıyorum', c.tick(1)),
      msg('hakan', 'Vallahi billahi bu sefer gerçek', c.tick(1)),
      msg('ismail', 'Neyse, toparlanırız. Sıradaki maça bakalım', c.tick(2)),
      msg('necati', 'Toparlanırız da önce kalbim toparlansın', c.tick(1)),
    ],
    (c) => [
      msg('ismail', `${score} bitti arkadaşlar, kimse ölmedi, sakin olalım`, c.at(0)),
      msg('burak', 'Ben öldüm ama', c.tick(1)),
      msg('necati', 'Bizim zamanımızda böyle maçları kazanırdık, VAR falan yoktu, oyun daha temizdi', c.tick(1)),
      msg('ayse', 'VAR yoktu çünkü kamera yoktu Necati amca, temizlikle alakası yok', c.tick(1)),
      msg('necati', 'Sen küçüksün anlamazsın', c.tick(1)),
      msg('hakan', s1 ? `${s1} bugün iyiydi bence, gerisi eksik` : 'Bazı oyuncular bugün iyiydi, gerisi eksik', c.tick(2)),
      msg('burak', 'Hakan her maçtan sonra aynı cümleyi kuruyorsun kanka, kayıtlı mı bu', c.tick(1)),
      msg('hakan', 'Doğru olan doğrudur', c.tick(1)),
      msg('ismail', 'Tamam beyler, bir dahaki maç 3 puan, şimdilik uyuyalım', c.tick(2)),
      msg('necati', 'Uyku da gelmez ki bu moralle', c.tick(1)),
    ],
  ];

  if (v === 'narrow-win') return [
    (c) => [
      msg('necati', `${score} bitti, kalbim durdu resmen, ambulans çağırın`, c.at(0)),
      msg('burak', 'Necati dede sağlık raporu istiyorum artık her maçtan sonra bu tehdidi duyuyorum', c.tick(1)),
      msg('necati', 'Bu sefer ciddiyim Burak, elim titriyor', c.tick(1)),
      msg('ayse', '3 puan 3 puandır, zor da olsa aldık, istatistik memnun 📊', c.tick(2)),
      msg('hakan', 'İstatistik memnunmuş, benim kalbim memnun değil ya', c.tick(1)),
      msg('ismail', s1 ? `${s1} kritik anda sahneye çıktı, adama saygı` : 'Kritik anda gol geldi, adama saygı', c.tick(2)),
      ...burst('burak', ['O golü gördüğümde', 'sandalyeden düştüm', 'gerçekten düştüm'], c.tick(1), (n) => c.tick(1)),
      msg('hakan', 'Ben taksiyi kırmızı ışıkta bıraktım golü kutlarken, ceza yiyeceğim galiba', c.tick(2)),
      msg('ayse', 'Hakan sen her golde bir felaket yaşıyorsun nasıl bir hayatın var', c.tick(1)),
      msg('hakan', 'Taraftarlık böyle bir şey Ayşe, sen anlamazsın', c.tick(1)),
      msg('ismail', 'Kazandık ya, gerisi teferruat. Sıradaki maça bakalım 💪', c.tick(2)),
    ],
  ];

  if (v === 'big-win' || v === 'domination') return [
    (c) => [
      msg('ismail', `${score}! Ne maçtı ama arkadaşlar 🔥`, c.at(0)),
      msg('hakan', 'Durakta korna çalıyorlar şu an, ben de katılıyorum', c.tick(1)),
      msg('necati', 'İşte bizim bildiğimiz Galatasaray buydu, gözüm yaşardı', c.tick(1)),
      msg('burak', 'Necati dede sen her maçtan sonra ağlıyorsun, kazanınca da kaybedince de', c.tick(1)),
      msg('necati', 'Duygusal bir insanım Burak, ayıp mı bu', c.tick(1)),
      msg('ayse', v === 'domination'
        ? `Rakip bir gol bile atamadı, istatistiklere göre bu bir domination 📊`
        : `Fark net, istatistiklere göre hakkımız fazlasıyla vardı`, c.tick(2)),
      msg('hakan', s1 && s2 ? `${s1} ve ${s2} bugün resital çekti valla` : (s1 ? `${s1} bugün resital çekti` : 'Takım bugün resital çekti'), c.tick(2)),
      ...burst('burak', ['Ben videoyu 5 kere izledim', 'daha izleyeceğim', 'hiç doymuyorum'], c.tick(1), (n) => c.tick(1)),
      msg('ismail', 'Bu formla devam edelim, moraller yüksek 🏆', c.tick(2)),
      msg('necati', 'Bu tadı sabaha kadar çıkaracağım, kimse rahatsız etmesin', c.tick(1)),
    ],
  ];

  // loss
  return [
    (c) => [
      msg('ismail', `${score} bitti. Konuşacak fazla bir şey yok ama toplanalım`, c.at(0)),
      msg('necati', 'Bizim zamanımızda... neyse, susayım daha iyi', c.tick(1)),
      msg('burak', 'Necati dede konuş bari, içine atma', c.tick(1)),
      msg('necati', 'Hayır konuşmayacağım, kalbim buna dayanmaz', c.tick(1)),
      msg('ayse', 'İstatistik bugün susuyor, ben de bir şey demiyorum', c.tick(2)),
      msg('hakan', 'Müşterim maçı izlememiş bile, en akıllı o çıktı', c.tick(1)),
      msg('burak', 'Keşke ben de izlemeseydim', c.tick(1)),
      ...burst('necati', ['Hocaya bir söz söylemek istiyorum', 'ama söylemeyeceğim', 'kendime saklıyorum'], c.tick(1), (n) => c.tick(1)),
      msg('ismail', 'Tamam beyler, kafalar yukarı, sıradaki maçta telafi ederiz 💪', c.tick(2)),
      msg('hakan', 'Umarım, taksi durağında yüzüme bakmıyorlar şu an', c.tick(1)),
    ],
  ];
}

export function postMatchScript(match, goals, rng) {
  const us = config.team.name;
  const usHome = match.home.name === us;
  const ourScore = usHome ? match.home.score : match.away.score;
  const theirScore = usHome ? match.away.score : match.home.score;
  const rival = usHome ? match.away.name : match.home.name;
  const v = verdict(ourScore, theirScore);
  const c = clock(match.kickoff, Boolean(match.time));

  const scorers = (goals || [])
    .filter((g) => (g.team === 'home') === usHome)
    .map((g) => g.player)
    .filter(Boolean);
  const score = `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`;

  const episodes = episodesFor(v, { rival, scorers, score });
  const messages = pick(rng, episodes)(c);

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
