// Galatasaray dressing-room bit: the new signing (Batrakov) introducing
// himself before the coach and squad have even confirmed the transfer.
// Landscape poster with the coach drawn on both ends of the frame, so this
// uses a pan (see player-poster-gs2) - Okan Hoca gets two cast entries
// (same voice, same display name, different screen position) rather than
// one, letting the camera correctly find whichever drawn copy of him is
// "speaking" for a given line instead of picking one side for both.
export const CAST = {
  okan_a: { key: 'okan_a', name: 'Okan Buruk', role: 'Teknik Direktör', color: '#F5B324', cx: 300 },
  torreira: { key: 'torreira', name: 'Torreira', role: 'Orta Saha', color: '#FFB74D', cx: 560 },
  osimhen: { key: 'osimhen', name: 'Osimhen', role: 'Santrafor', color: '#F5B324', cx: 780 },
  batrakov: { key: 'batrakov', name: 'Batrakov', role: 'Yeni Transfer', color: '#4FC3F7', cx: 1020 },
  okan_b: { key: 'okan_b', name: 'Okan Buruk', role: 'Teknik Direktör', color: '#F5B324', cx: 1280 },
};

const OKAN_VOICE = 'onwK4e9ZLuTAKqWW03F9'; // Daniel - steady broadcaster
export const VOICES = {
  okan_a: OKAN_VOICE,
  okan_b: OKAN_VOICE,
  torreira: 'N2lVS1w4EtoT3dr4eOWO',  // Callum - husky trickster
  osimhen: 'nPczCjzI2devNBz1zQrb',   // Brian - deep, resonant
  batrakov: 'SAz9YHcvj6GT2YYXdXww',  // River - relaxed, neutral (new-face energy)
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

function group(text) {
  return { dir: 'in', name: '', color: '#ffcf40', voiceKey: null, speakerKey: 'herkes', text, skipVoice: true, holdSeconds: 1.6 };
}

export function tableTalkScript() {
  const messages = [
    msg('okan_a', 'Beyler, yeni 10 numaramız geldi... Kendi transferini kendi açıklayan adam!', 'funny'),
    msg('batrakov', "Privet... \"Büyük ihtimalle\" dedim, şimdi %100 oldum.", 'funny'),
    msg('osimhen', 'Olum sen kendini mi sattın?', 'funny'),
    msg('batrakov', "Evet kardeşim, Lokomotiv'den treni kaçırdım, direkt Aslan'a bindim.", 'funny'),
    group('HAHAHAHA!'),
    msg('torreira', 'Amk yine yeni 10 numara... Paslar benden gidecek.', 'grumpy'),
    msg('batrakov', 'Merak etme, ben kısa boyumla kafayla da vuruyorum, sen sadece koş.', 'funny'),
    group('HAHAHAHA!'),
    msg('okan_b', "Tamam, top Batrakov'a, o da Osi'ye. Haydi bakalım!", 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
