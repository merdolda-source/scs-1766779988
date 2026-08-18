// Captions are written from the same data the video is, so they never contradict
// the graphic. Hashtags stay short and generic - tag stuffing reads as spam.
import { config } from './config.mjs';

const BASE_TAGS = ['#süperlig', '#futbol'];

function teamTag(name) {
  return '#' + name.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');
}

function tr(dt) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: config.timezone,
  }).format(dt);
}

export function captionFor(item) {
  const us = config.team.name;
  const tags = [...BASE_TAGS, teamTag(us)];

  if (item.scene === 'match-result') {
    const f = item.fixture;
    const usHome = f.home.name === us;
    const ourScore = usHome ? f.home.score : f.away.score;
    const theirScore = usHome ? f.away.score : f.home.score;
    const rival = usHome ? f.away.name : f.home.name;
    const verdict = ourScore > theirScore ? 'Kazandık' : ourScore < theirScore ? 'Kaybettik' : 'Berabere';
    const scorers = (f.goals || []).filter((g) => (g.team === 'home') === usHome)
      .map((g) => `${g.player} ${g.minute}'`).join(' · ');
    return [
      `${verdict}. ${f.home.name} ${f.home.score}-${f.away.score} ${f.away.name}`,
      scorers ? `\nGoller: ${scorers}` : '',
      `\n${f.league.name} · ${rival} karşısında maçın rakamları 👆`,
      `\n\n${tags.join(' ')} ${teamTag(rival)}`,
    ].join('');
  }

  if (item.scene === 'upcoming') {
    const f = item.fixture;
    const usHome = f.home.name === us;
    const rival = usHome ? f.away.name : f.home.name;
    return [
      `${f.home.name} - ${f.away.name}`,
      `\n${tr(new Date(f.kickoff))}${f.venue ? ' · ' + f.venue : ''}`,
      `\n\nSkor tahmininiz? Yorumlara yazın 👇`,
      `\n\n${tags.join(' ')} ${teamTag(rival)}`,
    ].join('');
  }

  if (item.scene === 'standings') {
    const row = (item.standings || []).find((r) => r.isUs);
    const pos = row ? `${row.rank}. sırada, ${row.points} puan` : 'güncel tablo';
    return [
      `Süper Lig puan durumu — ${us} ${pos}.`,
      `\n\nSizce sezon sonu nerede bitiriyoruz?`,
      `\n\n${tags.join(' ')} #puandurumu`,
    ].join('');
  }

  return tags.join(' ');
}
