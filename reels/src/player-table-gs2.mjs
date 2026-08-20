// Galatasaray dressing-room bit: the new signing (Batrakov) introducing
// himself before the coach and squad have even confirmed the transfer.
// Landscape poster (see player-poster-gs2), camera pans to whoever's
// speaking. Okan Hoca only appears once in this version of the poster (the
// earlier draft drew him twice) - he just speaks from the same spot for
// both his opening and closing lines.
export const CAST = {
  okan: { key: 'okan', name: 'Okan Buruk', role: 'Teknik Direktör', color: '#F5B324', cx: 260 },
  batrakov: { key: 'batrakov', name: 'Batrakov', role: 'Yeni Transfer', color: '#4FC3F7', cx: 610 },
  osimhen: { key: 'osimhen', name: 'Osimhen', role: 'Santrafor', color: '#F5B324', cx: 900 },
  torreira: { key: 'torreira', name: 'Torreira', role: 'Orta Saha', color: '#FFB74D', cx: 1130 },
};

export const VOICES = {
  okan: 'onwK4e9ZLuTAKqWW03F9',      // Daniel - steady broadcaster
  batrakov: 'SAz9YHcvj6GT2YYXdXww',  // River - relaxed, neutral (new-face energy)
  osimhen: 'nPczCjzI2devNBz1zQrb',   // Brian - deep, resonant
  torreira: 'N2lVS1w4EtoT3dr4eOWO',  // Callum - husky trickster
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
    msg('okan', 'Beyler, yeni 10 numaramız geldi... Kendi transferini kendi açıklayan adam!', 'funny'),
    msg('batrakov', "Privet... \"Büyük ihtimalle\" dedim, şimdi %100 oldum.", 'funny'),
    msg('osimhen', 'Olum sen kendini mi sattın?', 'funny'),
    msg('batrakov', "Evet kardeşim, Lokomotiv'den treni kaçırdım, direkt Aslan'a bindim.", 'funny'),
    group('HAHAHAHA!'),
    msg('torreira', 'Amk yine yeni 10 numara... Paslar benden gidecek.', 'grumpy'),
    msg('batrakov', 'Merak etme, ben kısa boyumla kafayla da vuruyorum, sen sadece koş.', 'funny'),
    group('HAHAHAHA!'),
    msg('okan', "Tamam, top Batrakov'a, o da Osi'ye. Haydi bakalım!", 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
