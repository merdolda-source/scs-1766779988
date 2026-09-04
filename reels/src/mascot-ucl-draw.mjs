// GS lion vs FB chick mascot banter over the real 2026-27 Champions League
// league-phase draw (both groups as posted by the account owner). Reuses the
// mascot poster/scene (player-poster-mascots) - same art, new topic, only
// the two clubs actually in the draw get a speaking turn.
export const CAST = {
  gs: { key: 'gs', name: 'Galatasaray', role: 'Aslan', color: '#F5B324', cx: 180 },
  fb: { key: 'fb', name: 'Fenerbahçe', role: 'Kanarya', color: '#FFED00', cx: 490 },
};

export const VOICES = {
  gs: 'pNInz6obpgDQGcFmaJgB', // Adam - dominant, firm
  fb: 'FGY2WhTYpPnrIDTdsKH5', // Laura - quirky enthusiast
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

export function tableTalkScript() {
  const messages = [
    msg('gs', "Kura çekildi Kanarya. Bizim grupta Barcelona var, PSG var, Feyenoord var... Bu gerçek Şampiyonlar Ligi!", 'funny'),
    msg('fb', "Bizde de Liverpool var, Roma var, Atlético Madrid var, unutma. 18 yıl sonra geldik, boş gelmedik!", 'funny'),
    msg('gs', 'Stuttgart, AEK Athens, Sporting CP, Lille de bizde. Kolay lokma yok ama Aslan her sahada kükrer.', 'laughing'),
    msg('fb', "Villarreal, Shakhtar, Sparta Praha, LASK de bizim. Fırtına her yerde eser, kanarya deme bana artık!", 'funny'),
    msg('gs', "İkimiz de Aston Villa'yla oynuyoruz ha, ilginç... Kim daha çok puan alır bakalım.", 'funny'),
    msg('fb', 'Onu sahada göreceğiz Aslanım. Şimdilik ikimiz de Avrupa\'dayız, bu bile başarı.', 'serious'),
    msg('gs', 'Doğru diyorsun. Bu sezon Türk futbolu adına güzel bir sezon olacak.', 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
