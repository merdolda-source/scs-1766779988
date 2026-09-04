// Fenerbahçe-flavoured sibling of player-table.mjs - same idea (fictional
// banter voiced over a user-supplied illustrated poster), different cast and
// a different poster layout (this one is landscape, so the matching scene
// pans across it rather than holding a static frame - see player-poster-fb).
export const CAST = {
  ismailkartal: {
    key: 'ismailkartal', name: 'İsmail Kartal', role: 'Teknik Direktör', color: '#FFD400',
    cx: 300,
  },
  talisca: {
    key: 'talisca', name: 'Talisca', role: 'Orta Saha', color: '#4FC3F7',
    cx: 530,
  },
  kante: {
    key: 'kante', name: 'Kanté', role: 'Orta Saha', color: '#66BB6A',
    cx: 680,
  },
  irfancan: {
    key: 'irfancan', name: 'İrfan Can Eğribayat', role: 'Kaleci (Gençlerbirliği)', color: '#22C55E',
    cx: 1130,
  },
};

export const VOICES = {
  ismailkartal: 'JBFqnCBsd6RMkjVDRZzb', // George - warm, captivating storyteller
  talisca: 'cjVigY5qzO86Huf0OWal',      // Eric - smooth, trustworthy
  kante: 'SOYHLrjzK2X1ezoPC6cr',        // Harry - fierce warrior (bewildered energy)
  irfancan: 'pNInz6obpgDQGcFmaJgB',     // Adam - dominant, firm (taunting confidence)
};

function msg(who, text) {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text };
}

// User-dictated skit: Fenerbahçe's post-match (1-2 loss) locker-room meeting,
// gatecrashed by İrfan Can Eğribayat - the keeper FB let go, now at
// Gençlerbirliği, the team that just beat them.
export function tableTalkScript() {
  const messages = [
    msg('ismailkartal', 'Evet beyler, başlıyoruz. Nerede kalmıştık?'),
    msg('talisca', 'Penaltı yoksa bende yokum, İsmail hocam.'),
    msg('ismailkartal', 'Atın kendinizi yere, alın hakkınızı!'),
    msg('kante', 'Şaş şaş...'),
    msg('irfancan', "İsmail hocaaa, beni göndermeyecektin, şimdi ne ağlıyorsun? Keşke iki hafta sonra göndermiş olsaydın diyorsun. Hadi, size geçmiş olsun!"),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
