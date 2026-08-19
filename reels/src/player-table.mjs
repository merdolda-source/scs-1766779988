// "Masa" format: fictional-style caricature banter around a table, built at
// the user's explicit direction and after flagging the personality-rights
// tradeoff of naming real players (see conversation). Kept deliberately
// stylized rather than photorealistic: this pipeline has no image-generation
// step, only flat CSS/SVG shapes rendered by the player-table scene, so a
// "caricature" here is a coloured avatar + name tag, never a traced or
// generated likeness of anyone's actual face.
export const CAST = {
  okan: {
    key: 'okan', name: 'Okan Buruk', role: 'Teknik Direktör', color: '#90A4AE',
    x: 540, y: 720, scale: 0.78, coach: true,
    skin: '#dba876', hair: '#9aa0a6',
    jerseyA: '#1c2430', jerseyB: '#0c1016',
    rect: [150, 760, 710, 1160],
  },
  baris: {
    key: 'baris', name: 'Barış', role: 'Kanat', color: '#66BB6A',
    x: 220, y: 1030, scale: 0.70,
    skin: '#e0ae82', hair: '#3b2415',
    jerseyA: '#F5B324', jerseyB: '#B31226',
    rect: [15, 190, 270, 395],
  },
  torreira: {
    key: 'torreira', name: 'Torreira', role: 'Orta Saha', color: '#FFB74D',
    x: 540, y: 1060, scale: 0.72,
    skin: '#d9a172', hair: '#1a1108',
    jerseyA: '#F5B324', jerseyB: '#B31226',
    rect: [270, 190, 565, 395],
  },
  sane: {
    key: 'sane', name: 'Sané', role: 'Kanat', color: '#4FC3F7',
    x: 860, y: 1030, scale: 0.70,
    skin: '#e7b78c', hair: '#d9c27a',
    jerseyA: '#F5B324', jerseyB: '#B31226',
    rect: [585, 190, 825, 395],
  },
  osimhen: {
    key: 'osimhen', name: 'Osimhen', role: 'Santrafor', color: '#F5B324',
    x: 540, y: 1470, scale: 0.98,
    skin: '#6b4226', hair: '#0d0d0d',
    jerseyA: '#F5B324', jerseyB: '#B31226',
    rect: [220, 395, 635, 730],
  },
};

export const VOICES = {
  okan: 'onwK4e9ZLuTAKqWW03F9',    // Daniel - steady broadcaster, coach authority
  baris: 'bIHbv24MWmeRgasZH58o',   // Will - relaxed young
  torreira: 'N2lVS1w4EtoT3dr4eOWO', // Callum - husky trickster
  sane: 'IKne3meq5aSn9XLyUdCD',    // Charlie - deep, confident, energetic
  osimhen: 'nPczCjzI2devNBz1zQrb', // Brian - deep, resonant, commanding
};

function msg(who, text) {
  const c = CAST[who];
  return { dir: 'in', name: c.name, color: c.color, voiceKey: who, speakerKey: who, text };
}

// User-supplied skit (real, currently-active Galatasaray squad names used as
// comedic table-talk characters, dialogue entirely invented/parody - not a
// claim about anything any of them actually said).
export function tableTalkScript() {
  const messages = [
    msg('okan', 'Beyler, bu hafta ne yaptınız?'),
    msg('torreira', 'Amk ben parça pinçik oldum, Sané ve Barış yüzünden.'),
    msg('osimhen', 'Ben nerdeyim ya... Barış sen nereye pas atıyorsun, uyurgezer misin maçta?'),
    msg('baris', 'Ya tamam abi, bi kere kaçırdım.'),
    msg('osimhen', 'Sané, valla senden korkulur - bi varsın bi yoksun, korkarım bir gün patlarsın.'),
    msg('sane', 'Ben varım işte, gol de attım.'),
    msg('okan', "Hepiniz bundan sonra Osi'ye pas ve orta yapacaksınız. Bu kadar."),
  ];

  return {
    cast: Object.values(CAST),
    messages,
  };
}
