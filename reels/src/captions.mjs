// Captions come from the same data the video does, so text can never contradict
// the graphic. Hashtags stay few - tag stuffing reads as spam.
import { config } from './config.mjs';

const BASE_TAGS = ['#süperlig', '#futbol'];
const tag = (name) => '#' + name.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

export function captionFor(item) {
  const us = config.team.name;
  const tags = [...BASE_TAGS, tag(us)];

  if (item.scene === 'match-result') {
    const m = item.match;
    const usHome = m.home.name === us;
    const ourScore = usHome ? m.home.score : m.away.score;
    const theirScore = usHome ? m.away.score : m.home.score;
    const rival = usHome ? m.away.name : m.home.name;
    const verdict = ourScore > theirScore ? 'Kazandık 💛❤️'
      : ourScore < theirScore ? 'Kaybettik.' : 'Berabere kaldık.';
    return `${verdict}\n${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`
      + `\n\nMaçı nasıl değerlendiriyorsunuz?`
      + `\n\n${tags.join(' ')} ${tag(rival)}`;
  }

  if (item.scene === 'upcoming') {
    const m = item.match;
    const rival = m.home.name === us ? m.away.name : m.home.name;
    return `${m.home.name} - ${m.away.name}`
      + `\n${m.dateText}${m.time ? ' · ' + m.time : ''}`
      + `\n\nSkor tahmininiz? Yorumlara yazın 👇`
      + `\n\n${tags.join(' ')} ${tag(rival)}`;
  }

  if (item.scene === 'fixtures') {
    return `${item.fixtures.league} ${item.fixtures.week}. hafta programı 📅`
      + `\n\nBu hafta en çok hangi maçı merak ediyorsunuz?`
      + `\n\n${tags.join(' ')} #fikstür`;
  }

  if (item.scene === 'standings') {
    const row = (item.standings?.rows || []).find((r) => r.isUs);
    const pos = row ? `${row.rank}. sırada, ${row.points} puan` : 'güncel tablo';
    return `Süper Lig puan durumu — ${us} ${pos}.`
      + `\n\nSizce sezon sonu nerede bitiriyoruz?`
      + `\n\n${tags.join(' ')} #puandurumu`;
  }

  return tags.join(' ');
}
