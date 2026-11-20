// data.js — loads the trophy sheet and derives everything the views need.
//
// The canonical file (data/trophies.json) carries the official name,
// description and grade for all 55 trophies plus this app's own fields.
// Two things are deliberately NOT in that file, because the official list
// does not state them as fields: whether a trophy is hidden on PSN, and its
// numeric target. Hidden trophies are the story ones (the spoiler shield
// seals those), and the targets below are read straight off the official
// descriptions — 250 stunts, 42 range challenges, 100 locations, and so on.

export const TARGETS = {
  15: 250,   // Complete 250 Stunts
  16: 9,     // each type of activity (9 types)
  17: 42,    // all Shooting Range challenges (42)
  18: 14,    // a drone race at every location (14)
  19: 20,    // Win 20 different races
  25: 8,     // Complete 8 mission strands
  28: 18,    // Meditate at every spot (18)
  30: 3,     // Complete 3 Collectible Card sets
  31: 100,   // WAiNK It at 100 locations
  32: 50,    // Complete 50 Challenges
  34: 3,     // Rob 3 shops back-to-back
  35: 100,   // Discover 100 vehicles
  36: 5,     // 5 enemies in a single Combat Focus
  40: 5,     // Rob 5 Bank Vaults
  42: 52,    // Explore all of Leonida (52 areas)
  43: 9,     // each gang (9 gangs)
  48: 500,   // Choices made (count to 500)
  52: 250000, // $250,000 laundering Marked Bills
  53: 100000, // Spend $100,000 across all shops
  54: 8,     // all garage properties (8)
  55: 10,    // Register 10 vehicles
};

export function targetFor(trophy) {
  return TARGETS[trophy.id] ?? null;
}

// Story trophies are the ones PSN keeps hidden until they pop; the spoiler
// shield seals exactly these while they are unearned.
export function isHiddenStory(trophy) {
  return trophy.kind === 'story';
}

let cache = null;

export async function loadTrophies() {
  if (cache) return cache;
  const res = await fetch('data/trophies.json');
  if (!res.ok) throw new Error('Could not load data/trophies.json');
  const doc = await res.json();
  cache = doc.trophies;
  return cache;
}

export const KINDS = ['story', 'collectibles', 'activities', 'misc'];
export const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
export const EFFORTS = ['chill', 'skill', 'grind'];

export function byTime(list) {
  return [...list].sort((a, b) => a.est_min - b.est_min || a.id - b.id);
}

export function completionStats(trophies, state) {
  const earnedSet = new Set(state.earned);
  const total = trophies.length;
  const earned = trophies.filter((t) => earnedSet.has(t.id)).length;
  const perKind = {};
  for (const k of KINDS) {
    const inKind = trophies.filter((t) => t.kind === k);
    perKind[k] = {
      total: inKind.length,
      earned: inKind.filter((t) => earnedSet.has(t.id)).length,
    };
  }
  const perGrade = {};
  for (const g of GRADES) {
    const inGrade = trophies.filter((t) => t.grade === g);
    perGrade[g] = {
      total: inGrade.length,
      earned: inGrade.filter((t) => earnedSet.has(t.id)).length,
    };
  }
  return {
    total,
    earned,
    pct: total ? Math.round((earned / total) * 100) : 0,
    perKind,
    perGrade,
  };
}

// Burn-down figure: estimated hours still on the sheet.
export function remainingHours(trophies, state) {
  const earnedSet = new Set(state.earned);
  const mins = trophies
    .filter((t) => !earnedSet.has(t.id))
    .reduce((s, t) => s + t.est_min, 0);
  return mins / 60;
}

export function earnedHours(trophies, state) {
  const earnedSet = new Set(state.earned);
  const mins = trophies
    .filter((t) => earnedSet.has(t.id))
    .reduce((s, t) => s + t.est_min, 0);
  return mins / 60;
}

// Projected platinum date: remaining hours spread over the current pace.
// Returns null when there is no pace yet (no logged sessions).
export function projectedDate(trophies, state, paceHrsPerWeek, now = Date.now()) {
  const left = remainingHours(trophies, state);
  if (left <= 0) return new Date(now);
  if (!paceHrsPerWeek || paceHrsPerWeek <= 0) return null;
  const weeks = left / paceHrsPerWeek;
  return new Date(now + weeks * 7 * 86400000);
}

// The session builder's picking rule: unearned trophies of the chosen
// effort type, cheapest estimate first, added while they fit the budget.
// A trophy longer than the whole budget is never picked; if nothing fits
// at all, the single cheapest candidate is offered on its own so the
// player still gets a package.
export function buildPackage(trophies, state, budgetMin, effortType) {
  const earnedSet = new Set(state.earned);
  const candidates = byTime(
    trophies.filter((t) => !earnedSet.has(t.id) && t.effort_type === effortType && t.est_min > 0),
  );
  const picked = [];
  let total = 0;
  for (const t of candidates) {
    if (total + t.est_min <= budgetMin) {
      picked.push(t);
      total += t.est_min;
    }
  }
  if (picked.length === 0 && candidates.length > 0) {
    picked.push(candidates[0]);
    total = candidates[0].est_min;
  }
  return { items: picked, estMin: total, budgetMin, effortType };
}

export function fmtHours(h) {
  return (Math.round(h * 10) / 10).toFixed(1);
}

export function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
