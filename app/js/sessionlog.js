// sessionlog.js — the session log view, the running-session strip, and
// the timer that turns a started package into a logged session.
//
// Starting a session stores { startedAt, estMin, type, picks } in the
// store; stopping it measures the real elapsed minutes and appends a log
// entry. That log is what calibration (total actual / total estimate)
// and pace (hours per week) are derived from in store.js.

import {
  addSession,
  clearActive,
  removeSession,
  calibration,
  paceHoursPerWeek,
  totalActualMin,
} from './store.js';
import { trophyById, formatDate } from './data.js';

let timers = [];

export function haltTimers() {
  for (const t of timers) clearInterval(t);
  timers = [];
}

export function elapsedText(startedAt, now = Date.now()) {
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Stop the running session and write it to the log with its real
// elapsed minutes (minimum 1, so a stopped session always counts).
export function stopActiveSession(state) {
  const active = state.active;
  if (!active) return null;
  const actualMin = Math.max(1, Math.round((Date.now() - active.startedAt) / 60000));
  const entry = addSession({
    date: new Date().toISOString(),
    type: active.type,
    estMin: active.estMin,
    actualMin,
    picks: active.picks,
  });
  clearActive();
  return entry;
}

// The strip under the command bar, visible on every view while a
// session runs: elapsed clock plus the stop button.
export function renderActiveStrip(el, ctx) {
  const active = ctx.state.active;
  if (!active) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  const names = active.picks
    .map((id) => trophyById(id))
    .filter(Boolean)
    .map((t) => t.name)
    .join(' · ');
  el.innerHTML = `
    <span class="pulse">SESSION RUNNING</span>
    <span>${active.type} · package estimate ${active.estMin} min</span>
    <span>elapsed <b data-elapsed>${elapsedText(active.startedAt)}</b></span>
    <span>${names}</span>
    <button type="button" data-stop>Stop &amp; log session</button>`;
  const clock = el.querySelector('[data-elapsed]');
  const tick = setInterval(() => {
    if (clock && document.body.contains(clock)) clock.textContent = elapsedText(active.startedAt);
  }, 1000);
  timers.push(tick);
  el.querySelector('[data-stop]').addEventListener('click', () => {
    stopActiveSession(ctx.state);
    ctx.refresh();
  });
}

/* ----- the log view ----- */

export function renderLogView(root, ctx) {
  const { state } = ctx;
  const mult = calibration();
  const pace = paceHoursPerWeek();
  const totalEst = state.sessions.reduce((s, x) => s + x.estMin, 0);
  const totalAct = totalActualMin();

  const rows = state.sessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((s) => {
      const names = (s.picks || [])
        .map((id) => trophyById(id))
        .filter(Boolean)
        .map((t) => t.name)
        .join(' · ');
      const ratio = s.estMin > 0 ? (s.actualMin / s.estMin).toFixed(2) : '—';
      return `<tr>
        <td>${formatDate(new Date(s.date))}</td>
        <td>${s.type}</td>
        <td>${names || '—'}</td>
        <td>${s.estMin} min</td>
        <td>${s.actualMin} min</td>
        <td>×${ratio}</td>
        <td><button type="button" data-del="${s.id}">Delete</button></td>
      </tr>`;
    })
    .join('');

  root.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Calibration</h2><span class="hint">Derived from the log below — it scales every estimate on this sheet.</span></div>
      <div class="panel-body">
        <div class="analytics-grid">
          <div><span class="a-label">Calibration multiplier</span><br><span class="a-value">×${mult.toFixed(2)}</span></div>
          <div><span class="a-label">Pace (trailing 7 days)</span><br><span class="a-value">${pace.toFixed(1)} h/wk</span></div>
          <div><span class="a-label">Sessions logged</span><br><span class="a-value">${state.sessions.length}</span></div>
          <div><span class="a-label">Time played (actual)</span><br><span class="a-value">${(totalAct / 60).toFixed(1)} h</span></div>
          <div><span class="a-label">Estimated vs actual</span><br><span class="a-value">${totalEst} / ${totalAct} min</span></div>
          <div><span class="a-label">How it works</span><br><span style="font-size:13px">Multiplier = total actual ÷ total estimate, clamped ×0.50–×2.00. Estimates are always labeled “estimate”.</span></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Log a past session</h2><span class="hint">Forgot to run the timer? Add it by hand — it still calibrates you.</span></div>
      <div class="panel-body">
        <form class="manual-log" data-manual>
          <label>Type
            <select name="type">
              <option value="chill">chill</option>
              <option value="skill">skill</option>
              <option value="grind">grind</option>
            </select>
          </label>
          <label>Package estimate (min)<input name="est" type="number" min="1" max="2000" required value="60"></label>
          <label>Actual minutes<input name="actual" type="number" min="1" max="2000" required value="60"></label>
          <button type="submit">Add to log</button>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Session log</h2><span class="hint">${state.sessions.length} session(s) on record.</span></div>
      <div class="panel-body">
        ${state.sessions.length === 0
          ? '<p class="empty-note">No sessions logged yet. Build a package on the dashboard and start one, or add a past session above.</p>'
          : `<table class="log-table">
              <thead><tr><th>Date</th><th>Type</th><th>Package</th><th>Estimate</th><th>Actual</th><th>Ratio</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`}
      </div>
    </section>`;

  const form = root.querySelector('[data-manual]');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    addSession({
      date: new Date().toISOString(),
      type: String(fd.get('type') || 'chill'),
      estMin: Number(fd.get('est')),
      actualMin: Number(fd.get('actual')),
      picks: [],
    });
    ctx.refresh();
  });

  root.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeSession(btn.getAttribute('data-del'));
      ctx.refresh();
    });
  });
}
