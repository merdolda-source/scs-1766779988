// League-wide (not single-team) WhatsApp fan-group drama: "Süper Lig Taraftar
// Grubu" - six recurring characters, one per major fanbase, arguing over the
// week's real results. Kept separate from drama.mjs (the Galatasaray-only
// format) rather than merged into it: different cast, different voice map,
// different premise (nobody's "our team" here, everybody's rival is someone
// else in the room), and the account is broadening to all Süper Lig fans
// rather than replacing the GS-only format.
export const CAST = {
  emre: { name: 'Emre (GS)', color: '#F5B324' },
  selin: { name: 'Selin (GS)', color: '#FF6B6B' },
  burak: { name: 'Burak (FB)', color: '#4C6FFF' },
  ayse: { name: 'Ayşe (BJK)', color: '#E5E7EB' },
  can: { name: 'Can (TS)', color: '#C2185B' },
  zeynep: { name: 'Zeynep (Amedspor)', color: '#22C55E' },
};

function msg(who, text, time, opts = {}) {
  return { dir: 'in', name: CAST[who].name, color: CAST[who].color, voiceKey: who, text, time, typingBefore: true, ...opts };
}

// Simple forward-ticking clock for a weekly-roundup chat - no kickoff to peg
// to, just a plausible Sunday-night group-chat hour that keeps moving.
function clock(startHour = 21, startMin = 15) {
  let cur = startHour * 60 + startMin;
  return {
    tick(minutes = 1) {
      cur += minutes;
      const h = Math.floor(cur / 60) % 24, m = cur % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
  };
}

// User-approved script (week 1, Süper Lig, real scores). Written and approved
// by the account owner before being wired into a video - see conversation:
// "omce bana yaz sonra soylerim eklersin videoya" -> "yaptir bakalim".
export function weeklyRoundupScript() {
  const c = clock();
  const messages = [
    msg('zeynep', 'Lideriz beyler, 3-0 yaptık 👑', c.tick(0)),
    msg('burak', 'Amed dur biraz, sezon yeni başladı', c.tick(2)),
    msg('ayse', "Sen Gençlerbirliği'ne kaybettin, siktir git konuşma", c.tick(1)),
    msg('burak', 'amk yeni başladık dedim ya daha', c.tick(1)),
    // Laughter stands in for a spoken line here - see tts wiring, skipVoice.
    msg('can', '😂😂😂 1-1\'im ama en azından kaybetmedim yavşak', c.tick(1), { skipVoice: true, holdSeconds: 1.8 }),
    msg('emre', '2-2\'yiz, kimseye laf söyleyecek halim yok zaten', c.tick(1)),
    msg('selin', 'otur Emre, moralin senden kötü', c.tick(1)),
    msg('zeynep', '5 kişi toplam 5 puan ettiniz, ben tek başıma 3', c.tick(1)),
    msg('burak', 'puşt hesabı yapma şimdi de', c.tick(1)),
    msg('ayse', 'kazandım, keyfim yerinde, ağlayın siz', c.tick(1)),
    msg('can', '1. haftadan bu hal Burak, sezon sonu ne olacak', c.tick(1)),
    msg('burak', 'siktir lan Can sen de mi başladın', c.tick(1)),
    msg('zeynep', '2. hafta da lider ben olurum muhtemelen', c.tick(1)),
    msg('ayse', 'o kadar emin olma göt', c.tick(1)),
  ];

  return {
    groupName: 'Süper Lig Taraftar Grubu',
    members: 'Emre, Selin, Burak, Ayşe, Can, Zeynep',
    avatarText: 'SL',
    messages,
  };
}
