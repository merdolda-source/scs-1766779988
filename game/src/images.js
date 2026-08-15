// Procedural pictures. Each one is drawn to a small offscreen canvas and then
// sampled per-domino, so the fallen field paints the image in as the wave passes.
// Kept bold and low-detail on purpose: the effective resolution of the field is
// only ~60x26 "pixels".

const BG = '#101425';

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function heart(ctx, s) {
  ctx.fillStyle = '#1b1030';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  ctx.fillStyle = '#ff2e63';
  ctx.beginPath();
  const cx = s / 2, cy = s * 0.56, k = s * 0.30;
  ctx.moveTo(cx, cy + k * 0.95);
  ctx.bezierCurveTo(cx - k * 2.0, cy - k * 0.55, cx - k * 0.75, cy - k * 1.6, cx, cy - k * 0.55);
  ctx.bezierCurveTo(cx + k * 0.75, cy - k * 1.6, cx + k * 2.0, cy - k * 0.55, cx, cy + k * 0.95);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  disc(ctx, cx - k * 0.6, cy - k * 0.45, k * 0.28, '#ffd6e4');
  ctx.globalAlpha = 1;
}

function smiley(ctx, s) {
  ctx.fillStyle = '#161a2e';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  disc(ctx, s / 2, s / 2, s * 0.36, '#ffcc29');
  disc(ctx, s * 0.385, s * 0.42, s * 0.052, '#20160a');
  disc(ctx, s * 0.615, s * 0.42, s * 0.052, '#20160a');
  ctx.strokeStyle = '#20160a';
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.53, s * 0.19, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
}

function watermelon(ctx, s) {
  ctx.fillStyle = '#0f1c1a';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  const cx = s / 2, cy = s * 0.78, r = s * 0.46;
  ctx.fillStyle = '#2f9e44';
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f8f9fa';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#ff4d5e';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#1f1010';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 1) / 10 * Math.PI;
    const rr = r * (i % 2 ? 0.40 : 0.60);
    disc(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.021, '#1f1010');
  }
}

function cat(ctx, s) {
  ctx.fillStyle = '#181430';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  ctx.fillStyle = '#8f6ef0';
  ctx.beginPath();
  ctx.moveTo(s * 0.28, s * 0.40); ctx.lineTo(s * 0.34, s * 0.16); ctx.lineTo(s * 0.47, s * 0.31); ctx.closePath();
  ctx.moveTo(s * 0.72, s * 0.40); ctx.lineTo(s * 0.66, s * 0.16); ctx.lineTo(s * 0.53, s * 0.31); ctx.closePath();
  ctx.fill();
  disc(ctx, s / 2, s * 0.56, s * 0.30, '#8f6ef0');
  disc(ctx, s * 0.40, s * 0.52, s * 0.045, '#141024');
  disc(ctx, s * 0.60, s * 0.52, s * 0.045, '#141024');
  disc(ctx, s * 0.50, s * 0.635, s * 0.032, '#ff8fb1');
  ctx.strokeStyle = '#141024';
  ctx.lineWidth = s * 0.016;
  for (const sgn of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.5 + sgn * s * 0.07, s * 0.635 + k * s * 0.03);
      ctx.lineTo(s * 0.5 + sgn * s * 0.26, s * 0.635 + k * s * 0.06);
      ctx.stroke();
    }
  }
}

function star(ctx, s) {
  ctx.fillStyle = '#0d1430';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  const cx = s / 2, cy = s * 0.52;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? s * 0.36 : s * 0.155;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.5;
  disc(ctx, cx, cy - s * 0.05, s * 0.10, '#fff4c2');
  ctx.globalAlpha = 1;
}

function rocket(ctx, s) {
  ctx.fillStyle = '#0b1026';
  ctx.fillRect(-s, -s, s * 3, s * 3);
  ctx.fillStyle = '#e9edf5';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.13);
  ctx.bezierCurveTo(s * 0.70, s * 0.34, s * 0.68, s * 0.56, s * 0.62, s * 0.70);
  ctx.lineTo(s * 0.38, s * 0.70);
  ctx.bezierCurveTo(s * 0.32, s * 0.56, s * 0.30, s * 0.34, s * 0.5, s * 0.13);
  ctx.fill();
  ctx.fillStyle = '#ff5d3a';
  ctx.beginPath();
  ctx.moveTo(s * 0.38, s * 0.60); ctx.lineTo(s * 0.24, s * 0.76); ctx.lineTo(s * 0.38, s * 0.72); ctx.closePath();
  ctx.moveTo(s * 0.62, s * 0.60); ctx.lineTo(s * 0.76, s * 0.76); ctx.lineTo(s * 0.62, s * 0.72); ctx.closePath();
  ctx.fill();
  disc(ctx, s * 0.5, s * 0.40, s * 0.075, '#38bdf8');
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(s * 0.42, s * 0.70); ctx.lineTo(s * 0.5, s * 0.93); ctx.lineTo(s * 0.58, s * 0.70); ctx.closePath();
  ctx.fill();
}

export const PICTURES = [
  { id: 'heart', name: 'Kalp', draw: heart },
  { id: 'smiley', name: 'Gülen Yüz', draw: smiley },
  { id: 'watermelon', name: 'Karpuz', draw: watermelon },
  { id: 'cat', name: 'Kedi', draw: cat },
  { id: 'star', name: 'Yıldız', draw: star },
  { id: 'rocket', name: 'Roket', draw: rocket },
];

// Rasterise a picture once and hand back a sampler in normalised [0..1] coords.
export function makeSampler(picture, size = 160) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  // The field is only ~26 tiles across, so push the subject out towards the
  // edges - a small motif in the middle of a big dark frame does not read.
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(1.12, 1.12);
  ctx.translate(-size / 2, -size / 2);
  picture.draw(ctx, size);
  ctx.restore();
  const data = ctx.getImageData(0, 0, size, size).data;

  return function sample(u, v, out) {
    const x = Math.min(size - 1, Math.max(0, Math.round(u * (size - 1))));
    const y = Math.min(size - 1, Math.max(0, Math.round(v * (size - 1))));
    const o = (y * size + x) * 4;
    out[0] = data[o] / 255;
    out[1] = data[o + 1] / 255;
    out[2] = data[o + 2] / 255;
    return out;
  };
}

export function pickRandomPicture(exclude) {
  const pool = PICTURES.filter((p) => p.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
