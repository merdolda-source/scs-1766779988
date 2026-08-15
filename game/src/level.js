// Builds the domino field: a serpentine run covering the picture area, cut into
// sections by gaps that the player has to bridge from a limited budget.
//
// Toppling uses an explicit link graph rather than proximity detection. Authored
// links can never mis-fire, so a run is fully deterministic - which matters when
// the payoff is a picture that has to come out right every time.

import { makeSampler } from './images.js';

// Geometry is tuned so that one domino's footprint lands on screen as a square
// "pixel" under the fixed camera angle: rows sit ROW_GAP apart in Z, which the
// 62-degree view compresses to ~0.41, matching the 0.40 spacing along a row.
// That is what lets the fallen field read as a picture instead of a smear.
export const SPACING = 0.40;   // gap between consecutive dominoes along a run
export const ROW_GAP = 0.46;   // distance between serpentine rows
export const DOM_W = 0.44;
export const DOM_H = 1.00;
export const DOM_D = 0.17;
export const FIELD_RATIO = 1.13; // depth/width that fills a square on screen

export const STANDING = 0, FALLING = 1, FALLEN = 2;

function buildCenterline(bounds) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const turnR = ROW_GAP / 2;
  const rowMinX = minX + turnR;
  const rowMaxX = maxX - turnR;
  const rows = Math.max(2, Math.floor((maxZ - minZ) / ROW_GAP) + 1);
  const pts = [];

  for (let r = 0; r < rows; r++) {
    const dir = r % 2 === 0 ? 1 : -1;
    const z = minZ + r * ROW_GAP;
    const xFrom = dir > 0 ? rowMinX : rowMaxX;
    const xTo = dir > 0 ? rowMaxX : rowMinX;
    const steps = Math.floor(Math.abs(xTo - xFrom) / SPACING);
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: xFrom + dir * i * SPACING, z, dx: dir, dz: 0 });
    }

    if (r === rows - 1) break;

    // Half-circle U-turn that bulges outside the row span, so the arc never
    // sits close enough to the neighbouring row to look wrong.
    const sgn = dir;
    const cx = xTo, cz = z + turnR;
    const arcSteps = Math.max(3, Math.round((Math.PI * turnR) / SPACING));
    for (let i = 1; i < arcSteps; i++) {
      const a = (i / arcSteps) * Math.PI;
      pts.push({
        x: cx + sgn * turnR * Math.sin(a),
        z: cz - turnR * Math.cos(a),
        dx: sgn * Math.cos(a),
        dz: Math.sin(a),
      });
    }
  }
  return pts;
}

export function buildLevel(cfg) {
  const { bounds, picture, gapCount, gapLength, budgetRatio, seed } = cfg;
  const rng = mulberry32(seed);
  const centerline = buildCenterline(bounds);

  // Carve gaps out of the run. Cuts are spread evenly with a little jitter and
  // kept away from the very start and end.
  const usable = centerline.length;
  const cuts = [];
  for (let g = 0; g < gapCount; g++) {
    const base = Math.floor((usable * (g + 1)) / (gapCount + 1));
    const jitter = Math.floor((rng() - 0.5) * usable * 0.06);
    cuts.push(Math.min(usable - gapLength - 4, Math.max(6, base + jitter)));
  }
  cuts.sort((a, b) => a - b);

  const removed = new Uint8Array(usable);
  const gapMarkers = [];
  for (const c of cuts) {
    for (let i = c; i < c + gapLength && i < usable; i++) {
      removed[i] = 1;
      gapMarkers.push([centerline[i].x, centerline[i].z]);
    }
  }

  const px = [], pz = [], fx = [], fz = [], links = [], sectionOf = [];
  let section = 0;
  let prevIndex = -1;

  for (let i = 0; i < usable; i++) {
    if (removed[i]) {
      if (prevIndex !== -1) { section++; prevIndex = -1; }
      continue;
    }
    const p = centerline[i];
    const len = Math.hypot(p.dx, p.dz) || 1;
    const idx = px.length;
    px.push(p.x); pz.push(p.z);
    fx.push(p.dx / len); fz.push(p.dz / len);
    links.push([]);
    sectionOf.push(section);
    if (prevIndex !== -1) links[prevIndex].push(idx);
    prevIndex = idx;
  }

  const count = px.length;
  const sampler = makeSampler(picture);
  const colors = new Float32Array(count * 3);
  const tmp = [0, 0, 0];
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  for (let i = 0; i < count; i++) {
    sampler((px[i] - bounds.minX) / w, (pz[i] - bounds.minZ) / d, tmp);
    colors[i * 3] = tmp[0];
    colors[i * 3 + 1] = tmp[1];
    colors[i * 3 + 2] = tmp[2];
  }

  // Budget deliberately falls short of bridging every gap the long way, so the
  // player has to shortcut across rows somewhere and give up part of the image.
  const fullCost = gapCount * (gapLength + 1);
  const budget = Math.max(6, Math.round(fullCost * budgetRatio));

  return {
    count,
    px: Float32Array.from(px),
    pz: Float32Array.from(pz),
    fx: Float32Array.from(fx),
    fz: Float32Array.from(fz),
    links,
    sectionOf: Int32Array.from(sectionOf),
    colors,
    gapMarkers,
    bounds,
    picture,
    budget,
    sectionCount: section + 1,
    placedFrom: count, // everything at or beyond this index was placed by the player
  };
}

// Adds a player-drawn bridge. Returns the number of dominoes used, or 0 if the
// line is not a legal placement.
export function addBridge(field, ax, az, bx, bz, remaining) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  if (dist < SPACING * 0.9) return 0;

  const src = nearestDomino(field, ax, az, SPACING * 2.4);
  if (src === -1) return 0;

  const ux = dx / dist, uz = dz / dist;
  const n = Math.floor(dist / SPACING);
  if (n < 1 || n > remaining) return 0;

  // Refuse lines that run along existing dominoes rather than across open floor.
  // The final tile is expected to land next to the target it hands off to, so it
  // is excluded - otherwise short hops between adjacent rows, which are the whole
  // point of the shortcut play, would always be rejected.
  let blocked = 0;
  for (let i = 1; i < n; i++) {
    const x = ax + ux * SPACING * i, z = az + uz * SPACING * i;
    if (nearestDomino(field, x, z, SPACING * 0.55) !== -1) blocked++;
  }
  if (n > 2 && blocked > (n - 1) * 0.6) return 0;

  const startIdx = field.count;
  const newPx = [], newPz = [], newFx = [], newFz = [];
  for (let i = 1; i <= n; i++) {
    newPx.push(ax + ux * SPACING * i);
    newPz.push(az + uz * SPACING * i);
    newFx.push(ux);
    newFz.push(uz);
  }

  growField(field, newPx, newPz, newFx, newFz);

  field.links[src].push(startIdx);
  for (let i = 0; i < n - 1; i++) field.links[startIdx + i].push(startIdx + i + 1);

  // Hand off to whatever standing domino the line ends next to.
  const last = startIdx + n - 1;
  const tgt = nearestDomino(field, bx, bz, SPACING * 2.4, last);
  if (tgt !== -1 && tgt !== src) field.links[last].push(tgt);

  return n;
}

function growField(field, ax, az, afx, afz) {
  const add = ax.length;
  const total = field.count + add;
  const px = new Float32Array(total), pz = new Float32Array(total);
  const fx = new Float32Array(total), fz = new Float32Array(total);
  const colors = new Float32Array(total * 3);
  const sectionOf = new Int32Array(total);
  px.set(field.px); pz.set(field.pz); fx.set(field.fx); fz.set(field.fz);
  colors.set(field.colors); sectionOf.set(field.sectionOf);

  const { bounds } = field;
  const w = bounds.maxX - bounds.minX, d = bounds.maxZ - bounds.minZ;
  const sampler = field._sampler || (field._sampler = makeSampler(field.picture));
  const tmp = [0, 0, 0];

  for (let i = 0; i < add; i++) {
    const j = field.count + i;
    px[j] = ax[i]; pz[j] = az[i]; fx[j] = afx[i]; fz[j] = afz[i];
    sampler((ax[i] - bounds.minX) / w, (az[i] - bounds.minZ) / d, tmp);
    colors[j * 3] = tmp[0]; colors[j * 3 + 1] = tmp[1]; colors[j * 3 + 2] = tmp[2];
    sectionOf[j] = -1;
    field.links.push([]);
  }

  field.px = px; field.pz = pz; field.fx = fx; field.fz = fz;
  field.colors = colors; field.sectionOf = sectionOf;
  field.count = total;
}

export function nearestDomino(field, x, z, maxDist, skip = -1) {
  let best = -1, bestD = maxDist * maxDist;
  for (let i = 0; i < field.count; i++) {
    if (i === skip) continue;
    const dx = field.px[i] - x, dz = field.pz[i] - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) { bestD = d2; best = i; }
  }
  return best;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function squareBounds(width) {
  const d = (width * FIELD_RATIO) / 2;
  return { minX: -width / 2, maxX: width / 2, minZ: -d, maxZ: d };
}

export const LEVELS = [
  { name: 'Isınma',     bounds: squareBounds(7.6),  gapCount: 3, gapLength: 4, budgetRatio: 0.85 },
  { name: 'Mozaik',     bounds: squareBounds(10.6), gapCount: 5, gapLength: 5, budgetRatio: 0.74 },
  { name: 'Büyük Alan', bounds: squareBounds(13.6), gapCount: 7, gapLength: 6, budgetRatio: 0.66 },
];
