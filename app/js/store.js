// store.js — everything the blueprint remembers, in one localStorage key.
//
// State shape:
//   earned    array of trophy ids the player has banked
//   counters  map of trophy id -> current count for counted trophies
//   settings  spoilerShield (seal unearned story trophies), hideEarned
//   sessions  the session log: { id, date, type, estMin, actualMin, picks }
//   active    a running session { startedAt, estMin, type, picks } or null
//
// Calibration and pace are derived from the log, never stored, so the
// numbers can never drift away from the sessions that produced them.

export const STORAGE_KEY = 'cyanotype-completion-log-v1';

function blankState() {
  return {
    earned: [],
    counters: {},
    settings: { spoilerShield: true, hideEarned: false },
    sessions: [],
    active: null,
    demoSeeded: false,
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    const merged = { ...blankState(), ...parsed };
    merged.settings = { ...blankState().settings, ...(parsed.settings || {}) };
    if (!Array.isArray(merged.earned)) merged.earned = [];
    if (!Array.isArray(merged.sessions)) merged.sessions = [];
    if (typeof merged.counters !== 'object' || merged.counters === null) merged.counters = {};
    return merged;
  } catch {
    return blankState();
  }
}

export function getState() {
  return state;
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the in-memory state still drives the page.
  }
}

export function replaceState(next) {
  state = { ...blankState(), ...next };
  state.settings = { ...blankState().settings, ...(next.settings || {}) };
  saveState();
}

export function resetState() {
  state = blankState();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}

/* ----- earned + counters ----- */

export function isEarned(id) {
  return state.earned.includes(id);
}

export function setEarned(id, on) {
  const has = state.earned.includes(id);
  if (on && !has) state.earned.push(id);
  if (!on && has) state.earned = state.earned.filter((x) => x !== id);
  saveState();
}

export function counterOf(id) {
  return state.counters[id] || 0;
}

export function setCounter(id, value, target) {
  const v = Math.max(0, Math.min(target, Math.floor(Number(value) || 0)));
  state.counters[id] = v;
  if (target > 0 && v >= target && !isEarned(id)) {
    state.earned.push(id);
  }
  saveState();
  return v;
}

/* ----- sessions, calibration, pace ----- */

export function addSession(entry) {
  const session = {
    id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 999),
    date: entry.date || new Date().toISOString(),
    type: entry.type || 'chill',
    estMin: Math.max(0, Math.round(entry.estMin || 0)),
    actualMin: Math.max(0, Math.round(entry.actualMin || 0)),
    picks: Array.isArray(entry.picks) ? entry.picks.slice() : [],
  };
  state.sessions.push(session);
  saveState();
  return session;
}

export function removeSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  saveState();
}

export function startActive(pkg) {
  state.active = {
    startedAt: Date.now(),
    estMin: pkg.total,
    type: pkg.type,
    picks: pkg.picks.map((p) => p.trophy.id),
  };
  saveState();
  return state.active;
}

export function clearActive() {
  state.active = null;
  saveState();
}

// Personal calibration multiplier: total actual minutes over total
// estimated minutes across the whole log, clamped to 0.5–2.0 so one odd
// session cannot bend every estimate on the sheet.
export function calibration() {
  let est = 0;
  let act = 0;
  for (const s of state.sessions) {
    est += s.estMin;
    act += s.actualMin;
  }
  if (est <= 0 || act <= 0) return 1;
  return Math.min(2, Math.max(0.5, act / est));
}

// Pace in hours per week: actual minutes logged in the trailing 7 days.
export function paceHoursPerWeek(now = new Date()) {
  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  let mins = 0;
  for (const s of state.sessions) {
    const t = new Date(s.date).getTime();
    if (t >= weekAgo && t <= now.getTime()) mins += s.actualMin;
  }
  return mins / 60;
}

export function totalActualMin() {
  return state.sessions.reduce((sum, s) => sum + s.actualMin, 0);
}

/* ----- demo seeding -----
   With ?demo=1 and nothing saved yet, seed a believable mid-run state:
   21 of 55 trophies earned across every kind, partial counters, and one
   session logged yesterday (40 estimated vs 47 actual minutes) so the
   calibration multiplier (~x1.18) and pace are alive on first load. */

export function seedDemo() {
  if (state.demoSeeded) return false;
  if (state.earned.length > 0 || state.sessions.length > 0) return false;
  state.earned = [
    2, 3, 8, 9, 10, 11, 22, // story
    16, 20, 21, 41, 46, // activities
    28, 35, // collectibles
    33, 34, 36, 44, 45, 51, 55, // misc
  ];
  state.counters = { 15: 87, 17: 19, 31: 34, 42: 21, 48: 132, 53: 41250 };
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  state.sessions = [
    {
      id: 'demo-session-1',
      date: yesterday.toISOString(),
      type: 'skill',
      estMin: 40,
      actualMin: 47,
      picks: [36, 45],
    },
  ];
  state.demoSeeded = true;
  saveState();
  return true;
}

/* ----- export / import ----- */

export function exportJSON() {
  return JSON.stringify(
    {
      app: 'leonida-completionist',
      version: 1,
      earned: state.earned,
      counters: state.counters,
      settings: state.settings,
      sessions: state.sessions,
    },
    null,
    2,
  );
}

export function validateImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Expected a JSON object with earned, counters and sessions.' };
  }
  if (!Array.isArray(parsed.earned) || !parsed.earned.every((n) => Number.isInteger(n))) {
    return { ok: false, error: 'The "earned" field must be an array of trophy ids.' };
  }
  if (typeof parsed.counters !== 'object' || parsed.counters === null || Array.isArray(parsed.counters)) {
    return { ok: false, error: 'The "counters" field must be an object of id to count.' };
  }
  if (!Array.isArray(parsed.sessions)) {
    return { ok: false, error: 'The "sessions" field must be an array.' };
  }
  for (const s of parsed.sessions) {
    if (!s || typeof s !== 'object' || typeof s.date !== 'string' || !Number.isFinite(s.estMin) || !Number.isFinite(s.actualMin)) {
      return { ok: false, error: 'A session entry is missing its date, estimate or actual minutes.' };
    }
  }
  return { ok: true, value: parsed };
}
