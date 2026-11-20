// sessionlog.js — the Session Log view: every logged session with its
// estimate beside its actual time, and the calibration those pairs produce.
// The multiplier shown here is the same one the Session Builder uses to
// translate sheet estimates into "at your pace" figures.

import { multiplier, paceHoursPerWeek } from './store.js';
import { fmtHours } from './data.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function renderLog(root, trophies, store) {
  root.textContent = '';
  const state = store.getState();
  const byId = new Map(trophies.map((t) => [t.id, t]));

  const grid = el('div', 'dash-grid');

  const cal = el('div', 'panel builder-panel');
  cal.append(el('p', 'panel-label', 'CALIBRATION — HOW YOUR ESTIMATES ARE CORRECTED'));
  const mult = multiplier();
  const lines = [
    ['Personal estimate multiplier', `×${mult.toFixed(2)}`],
    ['Sessions logged', String(state.log.length)],
    ['Total estimated minutes', String(state.log.reduce((s, e) => s + e.estMin, 0))],
    ['Total actual minutes', String(state.log.reduce((s, e) => s + e.actualMin, 0))],
    ['Pace — estimate', paceHoursPerWeek() > 0 ? `${fmtHours(paceHoursPerWeek())} h/week` : 'no data yet'],
  ];
  for (const [k, v] of lines) {
    const row = el('div', 'stat-line');
    row.append(el('span', '', k), el('b', '', v));
    cal.append(row);
  }
  cal.append(el('p', 'small muted',
    'The multiplier is total actual time divided by total estimated time across the log, ' +
    'clamped between ×0.50 and ×2.00. Every estimate the builder shows "at your pace" is the ' +
    'sheet estimate multiplied by this figure, so the sheet learns how long trophies really take you.'));
  grid.append(cal);

  const side = el('div', 'panel analytics-panel');
  side.append(el('p', 'panel-label', 'HOW A SESSION IS LOGGED'));
  side.append(el('p', 'small',
    'Build a package on the Dashboard, start the session, and play. Stopping the session ' +
    'writes one line here: the package\u2019s estimate next to the minutes the timer actually ' +
    'measured. Mark the package\u2019s trophies earned from the builder or the Trophy Index.'));
  if (store.activeSession()) {
    const a = store.activeSession();
    side.append(el('p', 'small muted', `A session is running now: ${a.label} (estimate ${a.estMin} min). Stop it from the Dashboard.`));
  } else {
    side.append(el('p', 'small muted', 'No session is running. Start one from the Dashboard\u2019s Session Builder.'));
  }
  grid.append(side);

  const logPanel = el('div', 'panel command-panel');
  logPanel.style.display = 'block';
  logPanel.append(el('p', 'panel-label', 'SESSION LOG'));
  if (state.log.length === 0) {
    logPanel.append(el('p', 'muted', 'No sessions logged yet. Your first stopped session will appear here.'));
  } else {
    const table = el('table');
    const thead = el('thead');
    const htr = el('tr');
    for (const h of ['Date', 'Session', 'Package trophies', 'Estimate', 'Actual', 'Variance']) htr.append(el('th', '', h));
    thead.append(htr);
    table.append(thead);
    const tbody = el('tbody');
    const entries = [...state.log].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    for (const e of entries) {
      const tr = el('tr');
      const names = e.trophyIds.map((id) => byId.get(id)?.name ?? `#${id}`).join('; ');
      const variance = e.actualMin - e.estMin;
      tr.append(
        el('td', 'mono', new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })),
        el('td', '', e.label),
        el('td', 'small', names),
        el('td', 'mono', `${e.estMin} min`),
        el('td', 'mono', `${e.actualMin} min`),
        el('td', 'mono', `${variance >= 0 ? '+' : ''}${variance} min`),
      );
      tbody.append(tr);
    }
    table.append(tbody);
    logPanel.append(table);
  }
  grid.append(logPanel);

  root.append(grid);
}
