// Ndombele (GS) vs Lukaku (Fenerbahçe) - two-hander weight-banter skit over
// a user-supplied poster (see player-poster-gslukaku). Same pan-camera
// pattern as the other landscape posters; a collective "İkisi: Hahahaha!"
// closer has no cast rect, so the camera just holds on whoever spoke last.
export const CAST = {
  ndombele: { key: 'ndombele', name: 'Ndombele', role: 'Galatasaray', color: '#F5B324', cx: 380 },
  lukaku: { key: 'lukaku', name: 'Lukaku', role: 'Fenerbahçe', color: '#4FC3F7', cx: 780 },
};

export const VOICES = {
  ndombele: 'N2lVS1w4EtoT3dr4eOWO', // Callum - husky trickster
  lukaku: 'nPczCjzI2devNBz1zQrb',   // Brian - deep, resonant
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

function group(text) {
  return { dir: 'in', name: '', color: '#ffcf40', voiceKey: null, speakerKey: 'ikisi', text, skipVoice: true, holdSeconds: 1.5 };
}

export function tableTalkScript() {
  const messages = [
    msg('ndombele', 'Lan Lukaku, sen mi daha kilolusun?', 'funny'),
    msg('lukaku', "Ben 94'üm, sen 80... Ama ikimiz de aynı kategorideyiz.", 'funny'),
    msg('ndombele', "Galatasaray'da şampiyon oldum, sen Napoli'de sakat gezdin!", 'funny'),
    msg('lukaku', "Ben Fener'e geldim, gol yağdıracağım. Sen hâlâ dans mı ediyorsun?", 'grumpy'),
    msg('ndombele', 'Hadi 1v1 yapalım, göbekler çarpışsın!', 'laughing'),
    msg('lukaku', 'Tamam, kim önce nefes kesilirse akşam yemeği o ısmarlasın!', 'laughing'),
    group('Hahahaha!'),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
