// telemetry.js — the sheet read as an instrument. Round 2 adds a pure-SVG
// telemetry layer over the same trophy table: a burn-down bar, a category
// load bar, and a One-Trip Optimizer that routes unearned trophies by
// Leonida cluster and shared mechanics. No network, no dependencies —
// every figure is derived from est_min scaled by the calibration
// multiplier, exactly like the rest of the dashboard.

import { calibratedMin } from './data.js';

// --- categories -----------------------------------------------------------
// Telemetry categories collapse the table's kind + effort_type into the
// five loads a completionist actually plans around.

export const CATEGORIES = ['Story', 'Collectibles', 'Stunts & Challenges', 'Grind', 'Online / Misc'];

export function categoryOf(trophy) {
  if (trophy.kind === 'story') return 'Story';
  if (trophy.kind === 'collectibles') return 'Collectibles';
  if (trophy.kind === 'activities') return 'Stunts & Challenges';
  if (trophy.kind === 'misc' && trophy.effort_type === 'grind') return 'Grind';
  return 'Online / Misc';
}

// Remaining calibrated minutes per telemetry category (unearned only).
export function categoryLoad(trophies, state, mult) {
  const earned = new Set(state.earned);
  const rows = CATEGORIES.map((cat) => ({ cat, min: 0, count: 0 }));
  const byCat = new Map(rows.map((r) => [r.cat, r]));
  for (const t of trophies) {
    if (earned.has(t.id) || t.id === 1) continue;
    const row = byCat.get(categoryOf(t));
    row.min += calibratedMin(t, mult);
    row.count += 1;
  }
  return rows;
}

// --- location clusters ------------------------------------------------------
// One-Trip Optimizer clusters, assigned from each trophy's name and
// description: where the work physically happens in Leonida. Id 1 (the
// platinum) is excluded — it has no location, it just pops.

export const CLUSTERS = ['Vice City', 'Grassrivers', 'Port Gellhorn', 'Leonida-wide'];

export const CLUSTER_OF = {
  2: 'Grassrivers',
  3: 'Leonida-wide',
  4: 'Leonida-wide',
  5: 'Vice City',
  6: 'Leonida-wide',
  7: 'Leonida-wide',
  8: 'Vice City',
  9: 'Port Gellhorn',
  10: 'Vice City',
  11: 'Vice City',
  12: 'Vice City',
  13: 'Port Gellhorn',
  14: 'Leonida-wide',
  15: 'Leonida-wide',
  16: 'Leonida-wide',
  17: 'Vice City',
  18: 'Leonida-wide',
  19: 'Leonida-wide',
  20: 'Grassrivers',
  21: 'Vice City',
  22: 'Grassrivers',
  23: 'Port Gellhorn',
  24: 'Grassrivers',
  25: 'Leonida-wide',
  26: 'Port Gellhorn',
  27: 'Vice City',
  28: 'Leonida-wide',
  29: 'Grassrivers',
  30: 'Leonida-wide',
  31: 'Leonida-wide',
  32: 'Leonida-wide',
  33: 'Vice City',
  34: 'Vice City',
  35: 'Leonida-wide',
  36: 'Vice City',
  37: 'Vice City',
  38: 'Port Gellhorn',
  39: 'Vice City',
  40: 'Vice City',
  41: 'Vice City',
  42: 'Leonida-wide',
  43: 'Leonida-wide',
  44: 'Vice City',
  45: 'Vice City',
  46: 'Vice City',
  47: 'Vice City',
  48: 'Leonida-wide',
  49: 'Leonida-wide',
  50: 'Grassrivers',
  51: 'Vice City',
  52: 'Port Gellhorn',
  53: 'Vice City',
  54: 'Leonida-wide',
  55: 'Vice City',
};

export function clusterOf(trophy) {
  return CLUSTER_OF[trophy.id] || 'Leonida-wide';
}

// --- stack groups -----------------------------------------------------------
// Trophies that share a mechanic, a place, or one heat run — clear them
// together instead of paying the travel twice.

export const STACKS = [
  { label: 'VCIA airfield', ids: [12, 37], note: 'can be combined in 1 run — takedown first, unscheduled departure on the way out' },
  { label: 'partner heat run', ids: [33, 34], note: 'can be combined in 1 run — build the stars once, rob the three shops inside the same heat' },
  { label: 'robbery circuit', ids: [39, 40, 41], note: 'can be combined in 1 run — jewelry quiet, vault loud, truck on the escape route' },
  { label: 'money loop', ids: [52, 53, 54], note: 'can be combined in 1 run — launder the bills, spend the clean money, buy the garages it funds' },
  { label: 'vehicle registry sweep', ids: [35, 55], note: 'can be combined in 1 run — register every new model in the app the moment you discover it' },
  { label: 'tackle box', ids: [2, 20], note: 'can be combined in 1 run — same water, same tackle: opening cast, then Cal’s challenge' },
];

const STACK_BY_ID = new Map();
for (const stack of STACKS) {
  for (const id of stack.ids) {
    if (!STACK_BY_ID.has(id)) STACK_BY_ID.set(id, []);
    STACK_BY_ID.get(id).push(stack);
  }
}

export function stacksFor(trophy) {
  return STACK_BY_ID.get(trophy.id) || [];
}

// --- One-Trip Optimizer -------------------------------------------------------
// Unearned trophies (platinum excluded) grouped by cluster. Each group
// reports its stop count and total calibrated minutes; stops are sorted
// shortest estimate first so a trip clears quick wins before long poles.

export function optimizerGroups(trophies, state, mult) {
  const earned = new Set(state.earned);
  const groups = CLUSTERS.map((cluster) => ({ cluster, count: 0, totalMin: 0, stops: [] }));
  const byCluster = new Map(groups.map((g) => [g.cluster, g]));
  for (const t of trophies) {
    if (earned.has(t.id) || t.id === 1) continue;
    const group = byCluster.get(clusterOf(t));
    const min = calibratedMin(t, mult);
    group.stops.push({ trophy: t, min, stacks: stacksFor(t) });
    group.count += 1;
    group.totalMin += min;
  }
  for (const g of groups) g.stops.sort((a, b) => a.min - b.min || a.trophy.id - b.trophy.id);
  return groups.filter((g) => g.count > 0);
}

// --- SVG: burn-down -----------------------------------------------------------
// Horizontal burndown: banked vs remaining estimated hours on one ruled
// bar, tick marks every quarter, mono readout of what is left.

export function burndownSVG(stats, mult) {
  const total = Math.max(1, stats.totalMin);
  const banked = total - stats.remainingMin;
  const w = 320;
  const h = 64;
  const x0 = 8;
  const x1 = w - 8;
  const bw = x1 - x0;
  const bankedW = (banked / total) * bw;
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const x = (x0 + f * bw).toFixed(1);
      return `<line x1="${x}" y1="26" x2="${x}" y2="34" stroke="#ffffff" stroke-width="1"></line><text x="${x}" y="46" text-anchor="middle" font-size="8">${Math.round(f * 100)}%</text>`;
    })
    .join('');
  const remH = (stats.remainingMin / 60).toFixed(1);
  const bankedH = (banked / 60).toFixed(1);
  return `<svg class="telemetry-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Burn-down: ${bankedH} hours banked, ${remH} hours remaining (estimate)">
    <rect x="${x0}" y="12" width="${bw}" height="12" fill="none" stroke="#ffffff" stroke-width="1"></rect>
    <rect x="${x0}" y="12" width="${bankedW.toFixed(1)}" height="12" fill="#ffffff"></rect>
    ${ticks}
    <text x="${x0}" y="60" font-size="10">BANKED ${bankedH} h · REMAINING ${remH} h · CAL ×${mult.toFixed(2)}</text>
  </svg>`;
}

// --- SVG: category load ---------------------------------------------------------
// One stacked horizontal bar: each segment is a telemetry category sized
// by its remaining estimated minutes. Segments are clickable filter keys
// for the routing queue below.

const SEGMENT_INK = ['#ffffff', '#c9dcea', '#8fb0c7', '#f2a007', '#5b84a3'];

export function categoryBarSVG(rows) {
  const total = Math.max(1, rows.reduce((s, r) => s + r.min, 0));
  const w = 320;
  const h = 86;
  const x0 = 8;
  const bw = w - 16;
  let x = x0;
  const segments = rows
    .map((r, i) => {
      const segW = (r.min / total) * bw;
      const sx = x;
      x += segW;
      if (segW < 2) return '';
      const hours = (r.min / 60).toFixed(1);
      const label = segW >= 52 ? `<text x="${(sx + 4).toFixed(1)}" y="30" font-size="8.5" fill="${i === 4 ? '#ffffff' : '#003153'}">${r.cat} · ${hours} h</text>` : '';
      return `<g data-cat="${r.cat}" tabindex="0" role="button" aria-label="Filter routing to ${r.cat}, ${hours} hours remaining"><rect x="${sx.toFixed(1)}" y="10" width="${segW.toFixed(1)}" height="16" fill="${SEGMENT_INK[i % SEGMENT_INK.length]}" stroke="#003153" stroke-width="1"></rect>${label}<title>${r.cat} — ${hours} h remaining (estimate), ${r.count} trophies</title></g>`;
    })
    .join('');
  const legend = rows
    .map((r, i) => `<text x="${x0}" y="${44 + i * 9}" font-size="8.5">${r.cat.toUpperCase()} — ${(r.min / 60).toFixed(1)} H · ${r.count} OPEN</text>`)
    .join('');
  return `<svg class="telemetry-svg stack-bar" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Remaining load by telemetry category">${segments}${legend}</svg>`;
}
