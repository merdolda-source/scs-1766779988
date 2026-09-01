// Fatih Tekke (human caricature) tries to resign after the Amed loss;
// "Yönetim" - the club's own fish mascot, standing in for the board - won't
// let him, insisting on firing him instead. Over a user-supplied poster
// (see player-poster-istifa). Two voices picked to fit each figure: the
// fish reads as a gravelly, deadpan authority; Tekke as flustered and pleading.
export const CAST = {
  yonetim: { key: 'yonetim', name: 'Yönetim', role: 'Trabzonspor', color: '#7A1E2E', cx: 300 },
  tekke: { key: 'tekke', name: 'Fatih Tekke', role: 'Teknik Direktör', color: '#E5E7EB', cx: 1300 },
};

export const VOICES = {
  yonetim: 'pqHfZKP75CvOlQylNhV4', // Bill - wise, mature, deadpan authority
  tekke: 'bIHbv24MWmeRgasZH58o',   // Will - relaxed, but reads flustered under mood
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

export function tableTalkScript() {
  const messages = [
    msg('tekke', 'Sayın başkan, ben istifa ediyorum.', 'serious'),
    msg('yonetim', 'Hayır, sen istifa edemezsin. Ben seni kovuyorum.', 'grumpy'),
    msg('tekke', 'Ama... en azından haysiyetimle gideyim!', 'funny'),
    msg('yonetim', 'Haysiyetin de bizim, imza attın, sözleşme bizim.', 'grumpy'),
    msg('tekke', 'Peki hocam... yani başkanım, ne olacak şimdi?', 'funny'),
    msg('yonetim', 'Yeni hoca gelene kadar otur, hamsi de seyretsin.', 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
