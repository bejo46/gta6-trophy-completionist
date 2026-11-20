// dashboard.js — the core sheet: KPI panels, the Session Builder, and the
// analytics panel, laid out on the blueprint grid. The Session Builder is
// the centerpiece: pick a time budget and a session type and it drafts a
// package of unearned trophies that fits, cheapest estimates first.

import {
  completionStats, remainingHours, earnedHours, projectedDate,
  buildPackage, fmtHours, fmtDate, KINDS, GRADES,
} from './data.js';
import { multiplier, paceHoursPerWeek } from './store.js';

const builder = { budget: 60, effort: 'skill' };
let timerId = null;

export function setBuilder(budget, effort) {
  if ([30, 60, 120].includes(budget)) builder.budget = budget;
  if (['chill', 'skill', 'grind'].includes(effort)) builder.effort = effort;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function kpi(label, value, note, cls = '') {
  const d = el('div', `kpi ${cls}`);
  d.append(el('span', 'kpi-label', label), el('span', 'kpi-value', value), el('span', 'kpi-note', note));
  return d;
}

function dialSVG(pct) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  // Built through innerHTML so no namespace URI string ever appears in
  // this file: the sheet is fully offline and carries no external URLs.
  const host = document.createElement('div');
  host.innerHTML =
    `<svg viewBox="0 0 130 130" width="130" height="130" role="img" aria-label="Completion ${pct} percent">` +
    `<circle cx="65" cy="65" r="${r}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="7"/>` +
    `<circle cx="65" cy="65" r="${r}" fill="none" stroke="#ffffff" stroke-width="7" ` +
    `stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 65 65)"/>` +
    `<text x="65" y="72" text-anchor="middle" fill="#ffffff" font-size="24" ` +
    `font-family="ui-monospace, Menlo, Consolas, monospace">${pct}%</text></svg>`;
  return host.firstChild;
}

export function renderDashboard(root, trophies, store, nav) {
  if (timerId) { clearInterval(timerId); timerId = null; }
  root.textContent = '';
  const state = store.getState();
  const stats = completionStats(trophies, state);
  const mult = multiplier();
  const pace = paceHoursPerWeek();
  const leftH = remainingHours(trophies, state);
  const proj = projectedDate(trophies, state, pace);
  const atRisk = trophies.filter((t) => t.missable && !store.isEarned(t.id)).length;

  const grid = el('div', 'dash-grid');

  // --- KPI strip (the missable count lives here, and only here) ---
  const strip = el('div', 'kpi-strip');
  strip.append(
    kpi('Completion', `${stats.pct}%`, `${stats.earned} of ${stats.total} earned`),
    kpi('Remaining — estimate', `${fmtHours(leftH)} h`, 'sum of unearned estimates'),
    kpi('Pace — estimate', pace > 0 ? `${fmtHours(pace)} h/wk` : '—', pace > 0 ? 'from your session log' : 'no sessions logged yet'),
    kpi('Projected platinum — estimate', proj ? fmtDate(proj) : '—', proj ? 'remaining hours at current pace' : 'log a session to project'),
    kpi('Calibration', `×${mult.toFixed(2)}`, 'actual vs estimate, from log'),
    kpi('Missables', `${atRisk} at risk`, 'unearned with a timing note', 'kpi-risk'),
  );
  grid.append(strip);

  // --- Session Builder (centerpiece) ---
  const bPanel = el('div', 'panel builder-panel');
  bPanel.append(el('p', 'panel-label', 'SESSION BUILDER — DRAFT A PACKAGE TO FIT YOUR TIME'));
  const controls = el('div', 'builder-controls');

  const timeCtl = el('div');
  timeCtl.append(el('span', 'ctl-label', 'Time budget'));
  const segRow = el('div');
  segRow.style.display = 'flex';
  segRow.style.alignItems = 'center';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '30'; slider.max = '120'; slider.step = '30';
  slider.value = String(builder.budget);
  const readout = el('span', 'range-readout', `${builder.budget} MIN`);
  slider.addEventListener('input', () => {
    builder.budget = Number(slider.value);
    readout.textContent = `${builder.budget} MIN`;
    syncSeg();
    drawPackage();
  });
  segRow.append(slider, readout);
  timeCtl.append(segRow);

  const budgetSeg = el('div');
  budgetSeg.append(el('span', 'ctl-label', 'Quick set'));
  const bSeg = el('div', 'seg');
  for (const b of [30, 60, 120]) {
    const btn = el('button', '', `${b} MIN`);
    btn.type = 'button';
    btn.dataset.budget = String(b);
    if (b === builder.budget) btn.classList.add('on');
    btn.addEventListener('click', () => {
      builder.budget = b;
      slider.value = String(b);
      readout.textContent = `${b} MIN`;
      syncSeg();
      drawPackage();
    });
    bSeg.append(btn);
  }
  budgetSeg.append(bSeg);

  const typeCtl = el('div');
  typeCtl.append(el('span', 'ctl-label', 'Session type'));
  const tSeg = el('div', 'seg');
  for (const t of ['chill', 'skill', 'grind']) {
    const btn = el('button', '', t.toUpperCase());
    btn.type = 'button';
    btn.dataset.effort = t;
    if (t === builder.effort) btn.classList.add('on');
    btn.addEventListener('click', () => {
      builder.effort = t;
      syncSeg();
      drawPackage();
    });
    tSeg.append(btn);
  }
  typeCtl.append(tSeg);
  controls.append(timeCtl, budgetSeg, typeCtl);
  bPanel.append(controls);

  const pkgHost = el('div');
  bPanel.append(pkgHost);

  function syncSeg() {
    bSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.budget) === builder.budget));
    tSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.effort === builder.effort));
  }

  function drawPackage() {
    pkgHost.textContent = '';
    const active = store.activeSession();
    if (active) {
      const box = el('div');
      box.append(el('p', 'panel-label', 'SESSION RUNNING'));
      const t = el('p', 'timer-readout', '00:00');
      t.id = 'sess-timer';
      const lbl = el('p', 'muted', `${active.label} — package estimate ${active.estMin} min`);
      const row = el('div', 'btn-row');
      const stop = el('button', 'primary', 'Stop & log session');
      stop.type = 'button';
      stop.addEventListener('click', () => store.stopSession());
      const cancel = el('button', '', 'Discard session');
      cancel.type = 'button';
      cancel.addEventListener('click', () => store.cancelSession());
      row.append(stop, cancel);
      box.append(t, lbl);
      // The package stays visible while the timer runs, with a checkbox
      // per trophy so each one can be ticked off the moment it pops —
      // the log entry then matches what was actually finished.
      const list = el('table');
      const lbody = el('tbody');
      for (const id of active.trophyIds) {
        const t = trophies.find((x) => x.id === id);
        if (!t) continue;
        const tr = el('tr');
        if (store.isEarned(id)) tr.classList.add('done');
        const tdCheck = el('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = store.isEarned(id);
        cb.setAttribute('aria-label', `Mark ${t.name} earned`);
        cb.addEventListener('change', () => store.setEarned(id, cb.checked));
        tdCheck.append(cb);
        tr.append(tdCheck, el('td', '', t.name), el('td', 'mono', `${t.est_min} est`));
        lbody.append(tr);
      }
      list.append(lbody);
      box.append(list, row);
      pkgHost.append(box);
      const tick = () => {
        const s = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        const node = document.getElementById('sess-timer');
        if (node) node.textContent = `${mm}:${ss}`;
      };
      tick();
      timerId = setInterval(tick, 1000);
      return;
    }

    const pkg = buildPackage(trophies, state, builder.budget, builder.effort);
    if (pkg.items.length === 0) {
      pkgHost.append(el('p', 'muted', `No unearned ${builder.effort} trophies remain. The sheet is clear for this type.`));
      return;
    }
    const table = el('table');
    const thead = el('thead');
    const htr = el('tr');
    for (const h of ['#', 'Trophy', 'Grade', 'Est. min', 'At your pace']) htr.append(el('th', '', h));
    thead.append(htr);
    table.append(thead);
    const tbody = el('tbody');
    pkg.items.forEach((t, i) => {
      const tr = el('tr');
      tr.append(
        el('td', 'mono', String(i + 1)),
        el('td', '', t.name),
        el('td', '', t.grade),
        el('td', 'mono', String(t.est_min)),
        el('td', 'mono', String(Math.round(t.est_min * mult))),
      );
      tbody.append(tr);
    });
    table.append(tbody);
    pkgHost.append(table);

    const totals = el('div', 'pkg-total');
    const afterPct = Math.round(((stats.earned + pkg.items.length) / stats.total) * 100);
    totals.innerHTML = '';
    const mk = (label, val) => {
      const s = el('span');
      s.append(document.createTextNode(`${label} `));
      s.append(el('b', '', val));
      return s;
    };
    totals.append(
      mk('PACKAGE ESTIMATE', `${pkg.estMin} MIN`),
      mk('AT YOUR PACE', `${Math.round(pkg.estMin * mult)} MIN`),
      mk('BUDGET', `${builder.budget} MIN`),
      mk('AFTER SESSION', `${afterPct}%`),
    );
    pkgHost.append(totals);

    const row = el('div', 'btn-row');
    const start = el('button', 'primary', 'Start session with this package');
    start.type = 'button';
    start.addEventListener('click', () => {
      store.startSession({
        label: `Package — ${builder.effort} / ${builder.budget} min`,
        trophyIds: pkg.items.map((t) => t.id),
        estMin: pkg.estMin,
      });
    });
    const mark = el('button', '', 'Mark package earned');
    mark.type = 'button';
    mark.addEventListener('click', () => {
      for (const t of pkg.items) store.setEarned(t.id, true);
    });
    row.append(start, mark);
    pkgHost.append(row);
  }

  drawPackage();
  grid.append(bPanel);

  // --- Analytics ---
  const aPanel = el('div', 'panel analytics-panel');
  aPanel.append(el('p', 'panel-label', 'ANALYTICS — BURN-DOWN & PROJECTION (ESTIMATES)'));
  const totalH = leftH + earnedHours(trophies, state);
  const burnPct = totalH > 0 ? Math.round((earnedHours(trophies, state) / totalH) * 100) : 0;
  const track = el('div', 'burn-track');
  const fill = el('div', 'burn-fill');
  fill.style.width = `${burnPct}%`;
  track.append(fill);
  aPanel.append(track);
  aPanel.append(el('p', 'small muted', `${burnPct}% of estimated hours burned down`));
  const lines = [
    ['Remaining work — estimate', `${fmtHours(leftH)} h`],
    ['Hours already cleared — estimate', `${fmtHours(earnedHours(trophies, state))} h`],
    ['Sessions logged', String(state.log.length)],
    ['Logged play time', `${state.log.reduce((s, e) => s + e.actualMin, 0)} min`],
    ['Pace — estimate', pace > 0 ? `${fmtHours(pace)} h/week` : 'no data'],
    ['Calibration multiplier', `×${mult.toFixed(2)}`],
    ['Projected platinum — estimate', proj ? fmtDate(proj) : 'log a session'],
  ];
  for (const [k, v] of lines) {
    const row = el('div', 'stat-line');
    row.append(el('span', '', k), el('b', '', v));
    aPanel.append(row);
  }
  aPanel.append(el('p', 'small muted', 'Estimates are this sheet\u2019s own figures, recalibrated by your session log. They are planning aids, not promises.'));
  grid.append(aPanel);

  // --- Dial + per-kind bars + grade chips ---
  const dPanel = el('div', 'panel dial-panel');
  dPanel.append(el('p', 'panel-label', 'COMPLETION DIAL'));
  const dw = el('div', 'dial-wrap');
  dw.append(dialSVG(stats.pct));
  const legend = el('div', 'dial-legend');
  const lg = el('p');
  lg.append(el('strong', '', `${stats.earned} / ${stats.total}`), document.createTextNode(' trophies earned'));
  const lg2 = el('p');
  lg2.append(el('strong', '', `${stats.total - stats.earned}`), document.createTextNode(' still on the sheet'));
  legend.append(lg, lg2);
  dw.append(legend);
  dPanel.append(dw);
  grid.append(dPanel);

  const barsPanel = el('div', 'panel bars-panel');
  barsPanel.append(el('p', 'panel-label', 'COMPLETION BY KIND + GRADE TALLY'));
  for (const k of KINDS) {
    const { earned: e, total: t } = stats.perKind[k];
    const row = el('div', 'bar-row');
    const tr = el('div', 'bar-track');
    const fl = el('div', 'bar-fill');
    fl.style.width = `${t ? Math.round((e / t) * 100) : 0}%`;
    tr.append(fl);
    row.append(el('span', 'bar-name', k), tr, el('span', 'bar-num', `${e} / ${t}`));
    barsPanel.append(row);
  }
  const chipRow = el('div', 'chip-row');
  for (const g of GRADES) {
    const { earned: e, total: t } = stats.perGrade[g];
    const chip = el('span', 'chip');
    chip.append(document.createTextNode(`${g.toUpperCase()} `), el('strong', '', `${e}/${t}`));
    chipRow.append(chip);
  }
  barsPanel.append(chipRow);
  grid.append(barsPanel);

  // --- Command bar ---
  const cmd = el('div', 'panel command-panel');
  cmd.append(el('span', 'cmd-label', 'Command'));
  const presets = [
    ['Build 30 · chill', 30, 'chill'],
    ['Build 60 · skill', 60, 'skill'],
    ['Build 120 · grind', 120, 'grind'],
  ];
  for (const [label, b, t] of presets) {
    const btn = el('button', '', label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      setBuilder(b, t);
      renderDashboard(root, trophies, store, nav);
    });
    cmd.append(btn);
  }
  const toLog = el('button', '', 'Open session log');
  toLog.type = 'button';
  toLog.addEventListener('click', () => nav('log'));
  const toSave = el('button', '', 'Export save');
  toSave.type = 'button';
  toSave.addEventListener('click', () => nav('save'));
  cmd.append(toLog, toSave);
  grid.append(cmd);

  root.append(grid);
}
