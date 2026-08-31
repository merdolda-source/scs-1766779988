// Trabzonspor (hamsi/anchovy mascot) getting roasted by the other four club
// mascots after a home loss, over a user-supplied poster (see
// player-poster-hamsi). Same pan-camera pattern as the other landscape
// posters.
export const CAST = {
  amed: { key: 'amed', name: 'Amedspor', role: 'Papağan', color: '#2FA84F', cx: 110 },
  gs: { key: 'gs', name: 'Galatasaray', role: 'Aslan', color: '#F5B324', cx: 360 },
  ts: { key: 'ts', name: 'Trabzonspor', role: 'Hamsi', color: '#7A1E2E', cx: 600 },
  bjk: { key: 'bjk', name: 'Beşiktaş', role: 'Kartal', color: '#E6E6E6', cx: 800 },
  fb: { key: 'fb', name: 'Fenerbahçe', role: 'Kanarya', color: '#FFED00', cx: 1030 },
};

export const VOICES = {
  amed: 'FGY2WhTYpPnrIDTdsKH5', // Laura - quirky enthusiast
  gs: 'pNInz6obpgDQGcFmaJgB',   // Adam - dominant, firm
  ts: 'nPczCjzI2devNBz1zQrb',   // Brian - deep, resonant (sad fish)
  bjk: 'SOYHLrjzK2X1ezoPC6cr',  // Harry - fierce warrior
  fb: 'onwK4e9ZLuTAKqWW03F9',   // Daniel - steady broadcaster
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

export function tableTalkScript() {
  const messages = [
    msg('amed', "Karadeniz fırtınası mı? Bizde rüzgar bile esmedi. Hamsiyi evinde kızarttık, üstüne de limon sıktık. Afiyet olsun Trabzon, bir dahaki sefere tuzunu da getir.", 'laughing'),
    msg('gs', 'Aslan olarak söylüyorum, bu hamsi biraz fazla tuzluymuş. Evde yenilmek ayrı, evde "fırtına" deyip esmemek ayrı. Kartal geldi, fırtınayı durdurdu.', 'funny'),
    msg('bjk', 'Kara kartal konuşuyor: bir kartal daha çıktı, senin fırtınan durdu. Hamsi hem evinde hem de sahada battı. Bordo-mavi renkler bu akşam yeşil-kırmızıya boyandı.', 'funny'),
    msg('fb', 'Kanarya olarak cik cik demiyorum artık, gak gak diyorum. Trabzonspor evinde yenildi, üstüne bir de "Karadeniz fırtınası" diye hava attı. Fırtına değil, esintiymiş meğer.', 'laughing'),
    msg('ts', 'Tamam tamam anladık, hepiniz birleştiniz. Evde yenildik, fırtına durdu, hamsi kızardı. Bir dahaki sefere tuzsuz ve susuz geliriz. Şimdi susun da yemeğimizi yiyelim.', 'grumpy'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
