// Captions come from the same data the video does, so text can never contradict
// the graphic. Hashtags stay few - tag stuffing reads as spam.
import { config } from './config.mjs';

const tag = (name) => '#' + name.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

function rng(seedText) {
  let h = 2166136261;
  for (let i = 0; i < String(seedText).length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => ((h = Math.imul(h ^ (h >>> 15), 1 | h)) >>> 0) / 4294967296;
}
function pick(rngFn, arr) { return arr[Math.floor(rngFn() * arr.length)]; }

// Instagram rewards a handful of relevant tags and treats a wall of them as
// spam, so this stays around a dozen: broad reach tags, the league, the teams
// involved, and whatever the post is actually about.
const REACH = ['#süperlig', '#futbol', '#trendyolsüperlig', '#türkiyefutbol'];
const NICKNAMES = {
  'Galatasaray': ['#gs', '#cimbom'],
  'Fenerbahçe': ['#fb', '#fenerbahçe'],
  'Beşiktaş': ['#bjk', '#kartal'],
  'Trabzonspor': ['#ts', '#bordomavi'],
};

function tagsFor({ teams = [], topic = [] } = {}) {
  const us = config.team.name;
  const out = [...REACH, tag(us), ...(NICKNAMES[us] || [])];
  for (const t of teams) {
    if (t === us) continue;
    out.push(tag(t), ...(NICKNAMES[t] || []));
  }
  out.push(...topic);
  return [...new Set(out)].slice(0, 13).join(' ');
}

export function captionFor(item) {
  const us = config.team.name;

  if (item.scene === 'match-result') {
    const m = item.match;
    const usHome = m.home.name === us;
    const ourScore = usHome ? m.home.score : m.away.score;
    const theirScore = usHome ? m.away.score : m.home.score;
    const verdict = ourScore > theirScore ? 'Kazandık 💛❤️'
      : ourScore < theirScore ? 'Kaybettik.' : 'Berabere kaldık.';
    return `${verdict}\n${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`
      + `\n\nMaçı nasıl değerlendiriyorsunuz?`
      + `\n\n${tagsFor({ teams: [m.home.name, m.away.name], topic: ['#maçsonu', '#skor'] })}`;
  }

  if (item.scene === 'upcoming') {
    const m = item.match;
    return `${m.home.name} - ${m.away.name}`
      + `\n${m.dateText}${m.time ? ' · ' + m.time : ''}`
      + `\n\nSkor tahmininiz? Yorumlara yazın 👇`
      + `\n\n${tagsFor({ teams: [m.home.name, m.away.name], topic: ['#maçönü', '#tahmin'] })}`;
  }

  if (item.scene === 'fixtures') {
    const teams = (item.fixtures.matches || []).flatMap((m) => [m.home.name, m.away.name]);
    return `${item.fixtures.league} ${item.fixtures.week}. hafta programı 📅`
      + `\n\nBu hafta en çok hangi maçı merak ediyorsunuz?`
      + `\n\n${tagsFor({ teams, topic: ['#fikstür', '#maçprogramı'] })}`;
  }

  if (item.scene === 'chat-drama') {
    const m = item.match;
    const usHome = m.home.name === us;
    const ourScore = usHome ? m.home.score : m.away.score;
    const theirScore = usHome ? m.away.score : m.home.score;
    const rival = usHome ? m.away.name : m.home.name;
    const verdictWord = ourScore > theirScore ? 'kazandık'
      : ourScore < theirScore ? 'kaybettik' : 'berabere kaldık';
    // The hook has to promise the bit, not the score - the score is already in
    // every other post today, the reason to open THIS one is the reaction.
    const hooks = [
      `Taraftar grubumuzda ${m.home.score}-${m.away.score} sonrası ortalık nasıl karıştı 😂👇`,
      `Maç bitti, grup sustu... yalan söyledim hiç susmadı 😭`,
      `${rival} maçı sonrası grup sohbeti tam bir kaos oldu`,
    ];
    return `${pick(rng(item.key), hooks)}`
      + `\n\n${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}, ${verdictWord}.`
      + `\nSizin grubunuzda da böyle mi oluyor? 👇`
      + `\n\n${tagsFor({ teams: [m.home.name, m.away.name], topic: ['#taraftar', '#komedi', '#grup', '#whatsapp'] })}`;
  }

  if (item.scene === 'standings') {
    const row = (item.standings?.rows || []).find((r) => r.isUs);
    if (!row) {
      return `Süper Lig güncel puan durumu 📊`
        + `\n\n${tagsFor({ topic: ['#puandurumu', '#lig'] })}`;
    }
    // A flat statement of the table gets scrolled past; the position relative to
    // expectation is what people argue about, and arguing is what leaves comments.
    const lead = row.rank <= 3
      ? `${us} ${row.rank}. sırada. 🔥`
      : `${us} tabloda ${row.rank}. sırada, ${row.points} puan.`;
    const prompt = row.rank <= 3
      ? 'Bu tempo sezon sonuna kadar sürer mi?'
      : 'Sizce erken mi konuşuyoruz, yoksa bir sıkıntı mı var?';
    return `${lead}`
      + `\n${row.played} maç · ${row.won}G ${row.drawn}B ${row.lost}M · ${row.gf}-${row.ga}`
      + `\n\n${prompt} 👇`
      + `\n\n${tagsFor({ topic: ['#puandurumu', '#lig', '#süperlig2026'] })}`;
  }

  return tagsFor();
}
