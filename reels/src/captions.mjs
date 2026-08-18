// Captions come from the same data the video does, so text can never contradict
// the graphic. Hashtags stay few - tag stuffing reads as spam.
import { config } from './config.mjs';

const tag = (name) => '#' + name.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

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

  if (item.scene === 'standings') {
    const row = (item.standings?.rows || []).find((r) => r.isUs);
    const pos = row ? `${row.rank}. sırada, ${row.points} puan` : 'güncel tablo';
    return `Süper Lig puan durumu — ${us} ${pos}.`
      + `\n\nSizce sezon sonu nerede bitiriyoruz?`
      + `\n\n${tagsFor({ topic: ['#puandurumu', '#lig'] })}`;
  }

  return tagsFor();
}
