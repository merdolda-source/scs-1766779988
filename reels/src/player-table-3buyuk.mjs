// Four-way banter: Osimhen (GS), Asensio (FB) and Salah (TS) team up on
// Orkun Kökçü (BJK) over a user-supplied poster (see player-poster-3buyuk).
// Same pan-camera pattern as the other landscape posters; the collective
// "Hahahaha" line has no cast rect, so the camera holds through it instead
// of picking one of the three laughing players to stand in for all of them.
export const CAST = {
  osimhen: { key: 'osimhen', name: 'Osimhen', role: 'Galatasaray', color: '#F5B324', cx: 100 },
  asensio: { key: 'asensio', name: 'Asensio', role: 'Fenerbahçe', color: '#4FC3F7', cx: 360 },
  salah: { key: 'salah', name: 'Salah', role: 'Trabzonspor', color: '#7A1E2E', cx: 620 },
  orkun: { key: 'orkun', name: 'Orkun Kökçü', role: 'Beşiktaş', color: '#E5E7EB', cx: 900 },
};

export const VOICES = {
  osimhen: 'nPczCjzI2devNBz1zQrb', // Brian - deep, resonant
  asensio: 'IKne3meq5aSn9XLyUdCD', // Charlie - deep, confident
  salah: 'N2lVS1w4EtoT3dr4eOWO',   // Callum - husky trickster
  orkun: 'TX3LPaxmHKxFdv7VOQHJ',   // Liam - energetic, young
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

function group(text, holdSeconds = 1.6) {
  return { dir: 'in', name: '', color: '#ffcf40', voiceKey: null, speakerKey: 'ucu', text, skipVoice: true, holdSeconds };
}

export function tableTalkScript() {
  const messages = [
    msg('osimhen', 'Lan geçen hafta 2-2 berabere kaldık, "ne oldu Aslan?" dediniz... Bu hafta 4-0 yedik Erzurum\'a. Siz hâlâ nerdesiniz?', 'funny'),
    msg('asensio', 'Biz de geçen hafta Gençlerbirliği\'ne yenildik, utandık. Bu hafta 4-2 Konya\'yı ezdik. Kartal mı? Hâlâ uçmaya çalışıyor!', 'funny'),
    msg('salah', 'Ben de 1-1\'le başladım, bu hafta 2-1 Başakşehir\'i devirdim. Beşiktaş\'a bak... Alanya\'da 0-1 yemiş, "Kartal mı, güvercin mi?"', 'funny'),
    msg('orkun', 'Susun lan! Geçen hafta tek kazanan bendim, bu hafta tek kaybeden oldum. Sistem değişti herhalde...', 'grumpy'),
    group('Hahahaha! "BJK liderdi" diye övünüyordunuz... Şimdi 3 büyük uçtu, Kartal yere indi!', 3.2),
    msg('osimhen', 'Akşam yemeği benden, ama Beşiktaş\'a da "geçmiş olsun" mesajı atalım!', 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
