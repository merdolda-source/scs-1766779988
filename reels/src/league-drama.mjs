// League-wide (not single-team) WhatsApp fan-group drama: "Süper Lig Taraftar
// Grubu" - six recurring characters, one per major fanbase, arguing over the
// week's real results. Kept separate from drama.mjs (the Galatasaray-only
// format) rather than merged into it: different cast, different voice map,
// different premise (nobody's "our team" here, everybody's rival is someone
// else in the room), and the account is broadening to all Süper Lig fans
// rather than replacing the GS-only format.
export const CAST = {
  emre: { name: 'AslanEmre (GS)', color: '#F5B324' },
  selin: { name: 'CimbomSelin (GS)', color: '#FF6B6B' },
  burak: { name: 'KanaryaBurak (FB)', color: '#4C6FFF' },
  ayse: { name: 'KartalAyşe (BJK)', color: '#E5E7EB' },
  can: { name: 'BordoCan (TS)', color: '#C2185B' },
  zeynep: { name: 'AmedZeynep', color: '#22C55E' },
};

// A separate voice map from the GS-only cast's - six distinct premade voices,
// picked for a spread of tone that fits each character's role in the banter
// (Emre's resigned pride, Zeynep's smug enthusiasm, etc).
export const VOICES = {
  emre: 'pNInz6obpgDQGcFmaJgB',   // Adam - dominant, firm
  selin: 'cgSgspJ2msm6clMCkdW9',  // Jessica - playful, bright
  burak: 'N2lVS1w4EtoT3dr4eOWO',  // Callum - husky trickster
  ayse: 'XrExE9yKIg1WjnnlVkGX',   // Matilda - knowledgeable, sharp
  can: 'IKne3meq5aSn9XLyUdCD',    // Charlie - deep, confident, energetic
  zeynep: 'FGY2WhTYpPnrIDTdsKH5', // Laura - quirky enthusiast
};

function msg(who, text, time, opts = {}) {
  return { dir: 'in', name: CAST[who].name, color: CAST[who].color, voiceKey: who, text, time, typingBefore: true, ...opts };
}

// Simple forward-ticking clock for a weekly-roundup chat - no kickoff to peg
// to, just a plausible Sunday-night group-chat hour that keeps moving.
function clock(startHour = 21, startMin = 15) {
  let cur = startHour * 60 + startMin;
  return {
    tick(minutes = 1) {
      cur += minutes;
      const h = Math.floor(cur / 60) % 24, m = cur % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
  };
}

// Week 2 roundup - user-supplied script, real Süper Lig week-2 scores. Handed
// over already finished (not a draft this time), so it goes straight to
// render rather than through another review round.
export function weeklyRoundupScript() {
  const c = clock();
  const messages = [
    msg('emre', "Hafta bitti… Biz Çorum'la 2-2. Bir puan aldık bari ama sinir bozucu 😅", c.tick(0)),
    msg('selin', 'En azından yenilmedik. Osimhen kurtardı yine.', c.tick(1)),
    msg('burak', "Siz 2-2 kalırken biz Gençlerbirliği'ne 2-1 yenildik amk 😂 Ankara'da bozulduk.", c.tick(1)),
    msg('ayse', "Biz Eyüpspor'u 1-0 yendik, 3 puan cebimizde. Siz büyükler batırırken biz sessizce başladık 😎", c.tick(1)),
    msg('can', "Kasımpaşa'yla 1-1… Beraberlik de puan. Ama Fener'in kaybetmesi epey güldürdü.", c.tick(1)),
    msg('zeynep', "Biz Erzurumspor'u 3-0 ezdik, lideriz ha! Averajla zirvedeyiz 💪 Siz birbirinizi yerken biz keyif yapıyoruz.", c.tick(1)),
    msg('emre', 'AmedZeynep sus lan, Amed lider oldu bir haftada. Klasik sürpriz.', c.tick(1)),
    msg('selin', "Fener'in kaybetmesi iyi oldu en azından. Beşiktaş da puan aldı, Trabzon berabere… Herkes darmadağın.", c.tick(1)),
    msg('burak', "Susun GS'liler, siz de puan kaybettiniz. Rize Konya'yı yendi, Başakşehir 2-0 kazandı, Samsun-Göztepe 3-3… Hafta deli gibi geçti.", c.tick(1)),
    msg('ayse', 'Doğru, herkes birbirini yedi. Biz rahatız şimdilik.', c.tick(1)),
    // Background laughter gets layered under this line rather than replacing
    // it - see the render driver's canItem/laughSfx wiring.
    msg('can', 'Amed lider, Fener sıfır puan… Bu sezon eğlenceli olacak 😂', c.tick(1)),
    msg('zeynep', 'Aynen, lider olarak selam gönderiyorum. İyi haftalar büyükler 😄', c.tick(1)),
  ];

  return {
    groupName: 'Süper Lig Taraftar Grubu',
    members: 'AslanEmre, CimbomSelin, KanaryaBurak, KartalAyşe, BordoCan, AmedZeynep',
    avatarText: 'SL',
    messages,
  };
}
