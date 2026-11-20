// data.js — loads the trophy table and turns it into the numbers the
// dashboard runs on. The table itself (app/data/trophies.json) carries the
// official names, descriptions and grades plus this guide's own fields:
// kind, missable flag and timing note, est_min, effort_type, repeatable,
// an optional count target, a one-line note, a guide, 3 steps, sources.

export const KINDS = ['story', 'collectibles', 'activities', 'misc'];
export const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
export const EFFORT_TYPES = ['chill', 'skill', 'grind'];

let trophies = [];
let byIdMap = new Map();

export async function loadTrophies() {
  const res = await fetch('data/trophies.json');
  if (!res.ok) throw new Error('Could not load data/trophies.json');
  const doc = await res.json();
  trophies = Array.isArray(doc) ? doc : doc.trophies;
  byIdMap = new Map(trophies.map((t) => [t.id, t]));
  return trophies;
}

export function allTrophies() {
  return trophies;
}

export function trophyById(id) {
  return byIdMap.get(id);
}

export function trophyByName(name) {
  const wanted = String(name || '').trim().toLowerCase();
  return trophies.find((t) => t.name.toLowerCase() === wanted) || null;
}

// A displayed estimate is the raw est_min scaled by the player's personal
// calibration multiplier, rounded to a whole minute, never below 1.
export function calibratedMin(trophy, mult) {
  return Math.max(1, Math.round(trophy.est_min * mult));
}

export function isSealed(trophy, state) {
  return Boolean(
    state.settings.spoilerShield && trophy.kind === 'story' && !state.earned.includes(trophy.id),
  );
}

export function unearnedMissables(state) {
  return trophies.filter((t) => t.missable && !state.earned.includes(t.id));
}

// The headline numbers of the blueprint, all derived in one place so the
// KPI strip, the dial and the analytics panel can never disagree.
export function computeStats(state, mult) {
  const earnedSet = new Set(state.earned);
  const earned = trophies.filter((t) => earnedSet.has(t.id));
  const unearned = trophies.filter((t) => !earnedSet.has(t.id));
  const remainingMin = unearned.reduce((sum, t) => sum + calibratedMin(t, mult), 0);
  const totalMin = trophies.reduce((sum, t) => sum + calibratedMin(t, mult), 0);

  const kinds = {};
  for (const kind of KINDS) {
    const inKind = trophies.filter((t) => t.kind === kind);
    kinds[kind] = {
      total: inKind.length,
      earned: inKind.filter((t) => earnedSet.has(t.id)).length,
    };
  }

  const grades = {};
  for (const grade of GRADES) {
    const inGrade = trophies.filter((t) => t.grade === grade);
    grades[grade] = {
      total: inGrade.length,
      earned: inGrade.filter((t) => earnedSet.has(t.id)).length,
    };
  }

  return {
    total: trophies.length,
    earnedCount: earned.length,
    pct: trophies.length ? (earned.length / trophies.length) * 100 : 0,
    remainingMin,
    remainingHours: remainingMin / 60,
    totalMin,
    kinds,
    grades,
    missablesAtRisk: unearnedMissables(state).length,
  };
}

// Projected platinum date: remaining hours divided by the current pace,
// projected forward from today. Null when there is no pace to project with.
export function projectedPlatinumDate(stats, pace, now = new Date()) {
  if (!pace || pace <= 0 || stats.remainingMin <= 0) return null;
  const weeks = stats.remainingHours / pace;
  const date = new Date(now.getTime() + weeks * 7 * 24 * 3600 * 1000);
  return date;
}

export function formatHours(min) {
  return (min / 60).toFixed(1) + ' h';
}

export function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCount(n) {
  return Number(n).toLocaleString('en-US');
}
