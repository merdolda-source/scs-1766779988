// Europa League play-off eve: Beşiktaş and Trabzonspor's dressing rooms
// sharing one poster/table, per the user-supplied art. Same fictional-banter
// pattern as the other player-table variants; this one also has two
// "everyone at once" beats (a group laugh, a closing chant) that intentionally
// have no matching CAST rect, so the scene naturally shows the full poster
// (no spotlight) for those lines instead of pinning them to one face.
export const CAST = {
  italiano: {
    key: 'italiano', name: 'Vincenzo Italiano', role: 'BJK Teknik Direktör', color: '#E5E7EB',
    rect: [5, 40, 210, 300],
  },
  fatihtekke: {
    key: 'fatihtekke', name: 'Fatih Tekke', role: 'TS Teknik Direktör', color: '#7FB0FF',
    rect: [545, 250, 784, 500],
  },
  vlahovic: {
    key: 'vlahovic', name: 'Vlahović', role: 'Santrafor', color: '#E5E7EB',
    rect: [0, 380, 200, 600],
  },
  trossard: {
    key: 'trossard', name: 'Trossard', role: 'Kanat', color: '#E5E7EB',
    rect: [0, 540, 300, 900],
  },
  salah: {
    key: 'salah', name: 'Salah', role: 'Kanat', color: '#7FB0FF',
    rect: [370, 400, 660, 720],
  },
  onuachu: {
    key: 'onuachu', name: 'Onuachu', role: 'Santrafor', color: '#7FB0FF',
    rect: [500, 540, 784, 900],
  },
};

export const VOICES = {
  italiano: 'onwK4e9ZLuTAKqWW03F9',   // Daniel - steady broadcaster
  fatihtekke: 'pqHfZKP75CvOlQylNhV4', // Bill - wise, mature
  vlahovic: 'nPczCjzI2devNBz1zQrb',   // Brian - deep, resonant
  trossard: 'TX3LPaxmHKxFdv7VOQHJ',   // Liam - energetic, young
  salah: 'IKne3meq5aSn9XLyUdCD',      // Charlie - deep, confident
  onuachu: 'N2lVS1w4EtoT3dr4eOWO',    // Callum - husky trickster
};

function msg(who, text) {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text };
}

// "Herkes" and "Hep birlikte" are collective beats, not one character - no
// CAST entry has these keys, so the scene shows the full poster (no
// spotlight box) for them instead of forcing them onto one face.
function group(text, opts = {}) {
  return { dir: 'in', name: '', color: '#ffcf40', voiceKey: null, speakerKey: 'herkes', text, ...opts };
}

export function tableTalkScript() {
  const messages = [
    msg('italiano', "Beyler, önce başarılar dileyelim. Avrupa Ligi'nde yolumuz açık olsun."),
    msg('fatihtekke', 'Amin hocam, inşallah ikimiz de turu geçeriz. Karadeniz ile İstanbul el ele!'),
    msg('vlahovic', 'Teşekkürler hoca. Umarım golümü atarım.'),
    msg('trossard', 'Ben de asist patlatırım inşallah.'),
    msg('salah', "Biz de hazırız, Onuachu ile beraber hücumu yakarız."),
    msg('onuachu', 'Aynen, uzun boyum işe yarasın.'),
    msg('trossard', 'Hocam bir şey soracağım... Maçımız hangi kanalda?'),
    msg('vlahovic', "A Spor'da diyorlar."),
    msg('salah', "Bizimki ATV'deymiş."),
    msg('onuachu', 'ATV... A Spor...'),
    msg('fatihtekke', "Avrupa Ligi'nde miyiz yoksa Ziraat Türkiye Kupası'nda mıyız anlamadık!"),
    msg('italiano', "Doğru ya, bu kanallar olunca insan \"Kaynak maçı mı bu?\" diye düşünüyor."),
    // Collective laugh - voiced as a crowd sfx, not a single reader.
    { ...group('HAHAHAHA!'), skipVoice: true, holdSeconds: 1.6 },
    msg('salah', "Kaynak'ta olsak en azından reklam arası bol olurdu."),
    msg('trossard', 'Biz de "penaltı var mı yok mu" tartışırdık canlı yayında!'),
    msg('vlahovic', 'Neyse, Avrupa Ligi diyeceğiz, kanalına bakmayacağız... Bol şans herkese!'),
    // Closing chant - also a collective beat, crowd-cheer sfx under the text.
    { ...group('Haydi BJK! Haydi TS! Avrupa bizi bekliyor!', { speakerKey: 'hepbirlikte' }), skipVoice: true, holdSeconds: 2.2 },
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
