// Club-mascot roundtable (lion/chick/pepper/eagle/storm-cloud), not real
// players - lower-risk format since nobody's likeness or name is involved,
// just each club's own fictional mascot bantering over the real standings.
// Same pan-camera pattern as the other landscape posters (player-poster-mascots).
export const CAST = {
  gs: { key: 'gs', name: 'Galatasaray', role: 'Aslan', color: '#F5B324', cx: 180 },
  fb: { key: 'fb', name: 'Fenerbahçe', role: 'Kanarya', color: '#FFED00', cx: 490 },
  gb: { key: 'gb', name: 'Gençlerbirliği', role: 'Lider', color: '#E4032E', cx: 870 },
  bjk: { key: 'bjk', name: 'Beşiktaş', role: 'Kartal', color: '#E6E6E6', cx: 1230 },
  ts: { key: 'ts', name: 'Trabzonspor', role: 'Fırtına', color: '#7A1E2E', cx: 1560 },
};

export const VOICES = {
  gs: 'pNInz6obpgDQGcFmaJgB',  // Adam - dominant, firm
  fb: 'FGY2WhTYpPnrIDTdsKH5',  // Laura - quirky enthusiast (flustered chick)
  gb: 'onwK4e9ZLuTAKqWW03F9',  // Daniel - steady broadcaster (smug leader)
  bjk: 'SOYHLrjzK2X1ezoPC6cr', // Harry - fierce warrior
  ts: 'nPczCjzI2devNBz1zQrb',  // Brian - deep, resonant (brooding storm)
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

export function tableTalkScript() {
  const messages = [
    msg('gb', 'Çocuklar hoş geldiniz. Ben 6 puanla geldim, siz 3-4 puanla. Çayınız soğumasın, liderlik koltuğu da ısınmasın.', 'funny'),
    msg('gs', "Erzurum'da 4-0 attık kardeşim. Averajımız +4. Sen 3 gol atıp nasıl lider oldun?", 'grumpy'),
    msg('gb', "Gol çok atınca değil, maç kazanınca oluyor. Fener'i de Göztepe'yi de yendim. Siz hâlâ \"biz büyüğüz\" diye dolaşıyorsunuz.", 'funny'),
    msg('fb', 'Konya\'yı 4-2 geçtik ya! Greenwood şov yaptı. İlk hafta sizin elinize düşmeseydik...', 'funny'),
    msg('gb', 'Düşmeseydiniz lider siz olurdunuz. Düştünüz. Teşekkürler.', 'laughing'),
    msg('bjk', "Alanya'da 1-0 yenildik diye 12. sıradayız. Bu masa adaletsiz.", 'grumpy'),
    msg('ts', 'En azından ben 4 puandayım, 4. sıradayım. Sen kartal, ben fırtına... o ise Ankara\'dan gelmiş zirveye kurulmuş.', 'funny'),
    msg('gb', '3. hafta daha gelmedi. Ben buradayım, koltuk da duruyor. Siz büyük konuşun, ben puan toplayayım.', 'serious'),
    msg('gs', 'Bu çocuk 2 haftadır şaka yapıyor sandık.', 'grumpy'),
    msg('gb', 'Şaka değil kardeşim. Puan durumu resmi. Çayınızı için, fotoğraf çekilelim. Liderlik hatırası.', 'laughing'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
