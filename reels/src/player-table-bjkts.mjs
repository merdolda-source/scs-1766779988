// Beşiktaş vs Trabzonspor derby trash talk, over a user-supplied poster
// (see player-poster-bjkts). Camera pans to whoever's speaking; a 0.5s
// broadcast-style score flash opens the clip before the banter starts.
export const CAST = {
  orkun: { key: 'orkun', name: 'Orkun Kökçü', role: 'BJK Orta Saha', color: '#E5E7EB', cx: 180 },
  murillo: { key: 'murillo', name: 'Amir Murillo', role: 'BJK Defans', color: '#E5E7EB', cx: 450 },
  salah: { key: 'salah', name: 'Mohamed Salah', role: 'TS Forvet', color: '#7FB0FF', cx: 730 },
  onuachu: { key: 'onuachu', name: 'Paul Onuachu', role: 'TS Santrafor', color: '#7FB0FF', cx: 1000 },
};

export const VOICES = {
  orkun: 'TX3LPaxmHKxFdv7VOQHJ',   // Liam - energetic, young
  murillo: 'SOYHLrjzK2X1ezoPC6cr', // Harry - fierce warrior
  salah: 'IKne3meq5aSn9XLyUdCD',   // Charlie - deep, confident
  onuachu: 'N2lVS1w4EtoT3dr4eOWO', // Callum - husky trickster
};

function msg(who, text, mood = 'normal') {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text, mood };
}

export function tableTalkScript() {
  const messages = [
    msg('orkun', 'Lan Salah, 6. dakikada işi bitirdik, sen hâlâ dolaşıyordun! 3-0.', 'laughing'),
    msg('murillo', '12. dakikada ben attım, siz kafayla yenildiniz!', 'funny'),
    msg('salah', 'Sus Orkun, rakibiniz minibüstü, bizimki gerçek takım!', 'grumpy'),
    msg('onuachu', 'Rövanşta 2-0 yaparız, siz de ağlarsınız!', 'funny'),
  ];

  return {
    cast: Object.values(CAST),
    // No score flash: BJK and TS aren't playing each other today (both are
    // in separate Europa League play-offs), so a "BJK-TS 3-0" open would
    // read as a real result rather than the fictional derby banter it is.
    messages,
  };
}
