// store.js — all persistence for the Leonida Completionist sheet.
//
// One localStorage key holds everything: earned trophy ids, per-trophy
// counters, the spoiler setting, the session log, and (while one runs) the
// active session timer. The calibration multiplier is never stored — it is
// always derived from the log so the log stays the single source of truth.

export const STORAGE_KEY = 'cyanotype-completion-log-v1';

const DEMO_EARNED = [2, 3, 8, 9, 10, 11, 16, 20, 21, 28, 29, 33, 36, 37, 39, 41, 44, 45, 46, 50, 51];
const DEMO_COUNTERS = { 15: 96, 17: 17, 31: 23, 35: 41 };

function blankState() {
  return {
    earned: [],
    counters: {},
    settings: { spoilers: true },
    log: [],
    active: null,
  };
}

// The demonstration state used by the screenshots: 21 of 55 earned, a few
// counters partway, and one logged session from yesterday that ran long —
// 47 actual minutes against a 40 minute estimate — so the calibration
// multiplier and the pace figure are visibly alive on first load.
export function demoState() {
  const s = blankState();
  s.earned = [...DEMO_EARNED];
  s.counters = { ...DEMO_COUNTERS };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  s.log = [{
    date: yesterday.toISOString(),
    label: 'Story opener + arcade cabinet',
    trophyIds: [2, 21],
    estMin: 40,
    actualMin: 47,
  }];
  return s;
}

function isValidState(v) {
  if (!v || typeof v !== 'object') return false;
  if (!Array.isArray(v.earned) || !v.earned.every((n) => Number.isInteger(n))) return false;
  if (!v.counters || typeof v.counters !== 'object' || Array.isArray(v.counters)) return false;
  if (!Object.values(v.counters).every((n) => Number.isFinite(n) && n >= 0)) return false;
  if (!v.settings || typeof v.settings.spoilers !== 'boolean') return false;
  if (!Array.isArray(v.log)) return false;
  for (const e of v.log) {
    if (!e || typeof e.date !== 'string' || !Number.isFinite(e.estMin) || !Number.isFinite(e.actualMin)) return false;
    if (!Array.isArray(e.trophyIds)) return false;
  }
  if (v.active !== null) {
    if (!v.active || !Number.isFinite(v.active.startedAt) || !Array.isArray(v.active.trophyIds)) return false;
  }
  return true;
}

let state = blankState();
const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  save();
  for (const fn of listeners) fn(state);
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the in-memory state still works this session.
  }
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        state = parsed;
        return state;
      }
    } catch {
      // Corrupt save: fall through to a fresh state rather than crashing.
    }
  }
  // Nothing saved yet: the demo link seeds the demonstration state.
  if (new URLSearchParams(location.search).get('demo') === '1') {
    state = demoState();
    save();
    return state;
  }
  state = blankState();
  return state;
}

export function getState() {
  return state;
}

export function isEarned(id) {
  return state.earned.includes(id);
}

export function setEarned(id, on) {
  const has = state.earned.includes(id);
  if (on && !has) state.earned.push(id);
  if (!on && has) state.earned = state.earned.filter((x) => x !== id);
  if (on !== has) emit();
}

export function toggleEarned(id) {
  setEarned(id, !isEarned(id));
}

export function getCounter(id) {
  return state.counters[id] ?? 0;
}

export function setCounter(id, n) {
  state.counters[id] = Math.max(0, Math.floor(n));
  emit();
}

export function setSpoilers(on) {
  state.settings.spoilers = Boolean(on);
  emit();
}

// --- session log & calibration -------------------------------------------

// Personal estimate multiplier: total actual minutes / total estimated
// minutes across the log, clamped to [0.5, 2.0]. With no log it is 1.
export function multiplier() {
  let est = 0;
  let act = 0;
  for (const e of state.log) {
    est += e.estMin;
    act += e.actualMin;
  }
  if (est <= 0 || act <= 0) return 1;
  return Math.min(2, Math.max(0.5, act / est));
}

// Pace in hours per week, derived from the log: total actual play time
// divided by the span it covers (first entry to now), with the span
// floored at one day so a single fresh session still yields a figure.
export function paceHoursPerWeek(now = Date.now()) {
  if (state.log.length === 0) return 0;
  const totalMin = state.log.reduce((s, e) => s + e.actualMin, 0);
  const first = Math.min(...state.log.map((e) => Date.parse(e.date)));
  const spanDays = Math.max(1, (now - first) / 86400000);
  return (totalMin / 60 / spanDays) * 7;
}

export function startSession(pkg) {
  state.active = {
    startedAt: Date.now(),
    label: pkg.label,
    trophyIds: [...pkg.trophyIds],
    estMin: pkg.estMin,
  };
  emit();
}

export function activeSession() {
  return state.active;
}

export function stopSession() {
  if (!state.active) return null;
  const actualMin = Math.max(1, Math.round((Date.now() - state.active.startedAt) / 60000));
  const entry = {
    date: new Date().toISOString(),
    label: state.active.label,
    trophyIds: [...state.active.trophyIds],
    estMin: state.active.estMin,
    actualMin,
  };
  state.log.push(entry);
  state.active = null;
  emit();
  return entry;
}

export function cancelSession() {
  state.active = null;
  emit();
}

// --- export / import / reset ----------------------------------------------

export function exportJSON() {
  return JSON.stringify({ app: 'leonida-completionist', version: 1, state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const candidate = parsed && parsed.state ? parsed.state : parsed;
  if (!isValidState(candidate)) throw new Error('Not a valid Leonida Completionist save.');
  state = candidate;
  emit();
  return state;
}

export function resetAll() {
  state = blankState();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to remove if storage is blocked.
  }
  save();
  for (const fn of listeners) fn(state);
}

export function loadDemo() {
  state = demoState();
  emit();
}
