// dashboard.js — the core page of the blueprint: a progress-first
// completionist dashboard. KPI strip up top, the session builder as the
// signature tool, then the dial, per-kind bars, grade tally and the
// analytics panel (burn-down, pace, projected platinum date).
//
// Every time figure here is an estimate: raw est_min values from the
// trophy table, scaled by the player's calibration multiplier.

import { calibratedMin, projectedPlatinumDate, formatHours, formatDate } from './data.js';
import { burndownSVG, categoryBarSVG, categoryLoad, categoryOf, optimizerGroups } from './telemetry.js';
import { startActive } from './store.js';
import { stopActiveSession } from './sessionlog.js';

// Build a session package: unearned trophies whose effort_type matches
// the chosen type, filled shortest calibrated estimate first until the
// time budget is full. A trophy that does not fit is skipped, never
// split — a session package is a set of whole trophies.
export function buildPackage(trophies, state, mult, minutes, type) {
  const earned = new Set(state.earned);
  const pool = trophies
    .filter((t) => !earned.has(t.id) && t.effort_type === type)
    .map((t) => ({ trophy: t, min: calibratedMin(t, mult) }))
    .sort((a, b) => a.min - b.min || a.trophy.id - b.trophy.id);
  const picks = [];
  let total = 0;
  for (const pick of pool) {
    if (total + pick.min <= minutes) {
      picks.push(pick);
      total += pick.min;
    }
  }
  // queued: unearned trophies of this type left beyond the budget, so
  // the player can see whether a longer session would reach more.
  return { picks, total, budget: minutes, type, queued: pool.length - picks.length };
}

function dialSVG(pct) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return `<svg class="dial" width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Completion ${pct.toFixed(1)} percent">
    <circle class="dial-track" cx="66" cy="66" r="${r}" fill="none" stroke-width="7"></circle>
    <circle class="dial-arc" cx="66" cy="66" r="${r}" fill="none" stroke-width="7"
      stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 66 66)"></circle>
    <text x="66" y="63" text-anchor="middle" font-size="24" font-weight="700">${pct.toFixed(1)}%</text>
    <text x="66" y="84" text-anchor="middle" font-size="10" letter-spacing="2">COMPLETE</text>
  </svg>`;
}

function sparklineSVG(sessions) {
  if (!sessions.length) return '<p class="burn-caption">No sessions logged yet — the burn-down wakes up with your first one.</p>';
  const ordered = sessions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  let acc = 0;
  const points = ordered.map((s, i) => {
    acc += s.actualMin;
    return [i, acc];
  });
  const maxY = Math.max(...points.map((p) => p[1]), 1);
  const w = 250;
  const h = 54;
  const coords = points
    .map(([i, v]) => `${(points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 8) + 4).toFixed(1)},${(h - 6 - (v / maxY) * (h - 16)).toFixed(1)}`)
    .join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cumulative minutes played per session">
    <line class="axis" x1="0" y1="${h - 5}" x2="${w}" y2="${h - 5}"></line>
    <polyline points="${coords}"></polyline>
    <text x="4" y="10">cumulative actual minutes: ${acc}</text>
  </svg>`;
}

export function renderDashboard(root, ctx, preset) {
  const { state, trophies, mult, stats, pace } = ctx;
  const projected = projectedPlatinumDate(stats, pace);
  let minutes = preset && preset.minutes ? preset.minutes : 60;
  let type = preset && preset.type ? preset.type : 'skill';

  const kindBars = Object.entries(stats.kinds)
    .map(([kind, v]) => {
      const pct = v.total ? (v.earned / v.total) * 100 : 0;
      return `<div class="kind-bar">
        <span class="kb-name">${kind}</span>
        <span class="kb-track"><span class="kb-fill" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="kb-num">${v.earned}/${v.total}</span>
      </div>`;
    })
    .join('');

  const tally = Object.entries(stats.grades)
    .map(([grade, v]) => `<span class="tally-chip">${grade} <b>${v.earned}/${v.total}</b></span>`)
    .join('');

  const active = state.active;

  root.innerHTML = `
    <section class="kpi-strip" aria-label="Key figures">
      <div class="kpi"><span class="k-label">Completion</span><span class="k-value">${stats.pct.toFixed(1)}%</span><span class="k-sub">${stats.earnedCount} of ${stats.total} trophies</span></div>
      <div class="kpi"><span class="k-label">Remaining (estimate)</span><span class="k-value">${formatHours(stats.remainingMin)}</span><span class="k-sub">calibrated ×${mult.toFixed(2)}</span></div>
      <div class="kpi"><span class="k-label">Pace (estimate)</span><span class="k-value">${pace.toFixed(1)} h/wk</span><span class="k-sub">trailing 7 days, from the log</span></div>
      <div class="kpi"><span class="k-label">Platinum (estimate)</span><span class="k-value">${projected ? formatDate(projected) : '—'}</span><span class="k-sub">${projected ? 'projected at current pace' : 'log a session to project'}</span></div>
      <div class="kpi"><span class="k-label">Calibration</span><span class="k-value">×${mult.toFixed(2)}</span><span class="k-sub">actual ÷ estimate, all sessions</span></div>
      <div class="kpi amber"><span class="k-label">Missables</span><span class="k-value">${stats.missablesAtRisk} at risk</span><span class="k-sub">unearned missable trophies</span></div>
    </section>

    <div class="dash-grid">
      <div>
        <section class="panel" id="session-builder">
          <div class="panel-head"><h2>Session builder</h2><span class="hint">Tell it the time you have and the mood you are in — it drafts the package.</span></div>
          <div class="panel-body">
            <div class="builder-controls">
              <div class="builder-row">
                <span class="row-label">Time</span>
                <input type="range" min="15" max="240" step="15" value="${minutes}" data-time aria-label="Session length in minutes">
                <span class="time-readout" data-time-readout>${minutes} min</span>
                <span class="quick-set">
                  <button type="button" data-quick="30">30</button>
                  <button type="button" data-quick="60">60</button>
                  <button type="button" data-quick="120">120</button>
                </span>
              </div>
              <div class="builder-row">
                <span class="row-label">Session type</span>
                <span class="type-set">
                  <button type="button" data-type="chill">chill</button>
                  <button type="button" data-type="skill">skill</button>
                  <button type="button" data-type="grind">grind</button>
                </span>
                <span class="hint">chill = passive / exploration · skill = performance · grind = repetitive counters</span>
              </div>
            </div>
            <div class="package" data-package></div>
          </div>
        </section>
      </div>

      <div>
        <section class="panel">
          <div class="panel-head"><h2>Progress</h2><span class="hint">The whole list at a glance.</span></div>
          <div class="panel-body">
            <div class="dial-wrap">
              ${dialSVG(stats.pct)}
              <div class="dial-side">
                <div class="kind-bars">${kindBars}</div>
                <div class="grade-tally">${tally}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Analytics</h2><span class="hint">Burn-down, pace and the projected platinum date.</span></div>
          <div class="panel-body">
            <div class="burn-track"><div class="burn-fill" style="width:${stats.totalMin ? (((stats.totalMin - stats.remainingMin) / stats.totalMin) * 100).toFixed(1) : 0}%"></div></div>
            <p class="burn-caption">burn-down: ${formatHours(stats.totalMin - stats.remainingMin)} of ${formatHours(stats.totalMin)} estimated hours banked · ${formatHours(stats.remainingMin)} remaining (estimate)</p>
            ${sparklineSVG(state.sessions)}
            <div class="analytics-grid" style="margin-top:10px">
              <div><span class="a-label">Remaining (estimate)</span><br><span class="a-value">${formatHours(stats.remainingMin)}</span></div>
              <div><span class="a-label">Pace (estimate)</span><br><span class="a-value">${pace.toFixed(1)} h/wk</span></div>
              <div><span class="a-label">Projected platinum (estimate)</span><br><span class="a-value">${projected ? formatDate(projected) : '—'}</span></div>
              <div><span class="a-label">Calibration</span><br><span class="a-value">×${mult.toFixed(2)}</span></div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Telemetry &amp; routing</h2><span class="hint">The sheet as an instrument: burn-down, category load, one-trip routing.</span></div>
          <div class="panel-body">
            ${burndownSVG(stats, mult)}
            <p class="burn-caption">telemetry: ${formatHours(stats.remainingMin)} left on the sheet (estimate). Clear shortest stops first — the bar moves fastest early.</p>
            ${categoryBarSVG(categoryLoad(trophies, state, mult))}
            <p class="burn-caption">Select a category to filter the routing queue.</p>
            <div data-optimizer></div>
          </div>
        </section>
      </div>
    </div>`;

  const timeInput = root.querySelector('[data-time]');
  const timeReadout = root.querySelector('[data-time-readout]');
  const packageEl = root.querySelector('[data-package]');

  function paintTypeButtons() {
    root.querySelectorAll('[data-type]').forEach((b) => {
      b.setAttribute('aria-pressed', b.getAttribute('data-type') === type ? 'true' : 'false');
      b.classList.toggle('on', b.getAttribute('data-type') === type);
    });
  }

  function paintPackage() {
    const pkg = buildPackage(trophies, state, mult, minutes, type);
    if (pkg.picks.length === 0) {
      packageEl.innerHTML = `<p class="package-empty">No unearned ${type} trophies fit in ${minutes} min at your calibrated pace. Try more time, or another type.</p>`;
      return;
    }
    const items = pkg.picks
      .map(
        (p) => `<li>
          <span class="p-name">${p.trophy.name}</span>
          <span class="p-meta">${p.trophy.grade} · ${p.trophy.kind}</span>
          <span class="p-est">${p.min} min est.</span>
        </li>`,
      )
      .join('');
    packageEl.innerHTML = `
      <ul class="package-list">${items}</ul>
      <div class="package-total">
        <span>Package total: ${pkg.total} min of ${pkg.budget} min (estimate)${pkg.queued > 0 ? ` · ${pkg.queued} more ${type} trophies queued beyond this budget` : ''}</span>
        <button type="button" data-start ${active ? 'disabled' : ''}>${active ? 'Session already running' : 'Start session'}</button>
      </div>`;
    const startBtn = packageEl.querySelector('[data-start]');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        startActive(pkg);
        ctx.refresh();
      });
    }
  }

  timeInput.addEventListener('input', () => {
    minutes = Number(timeInput.value);
    timeReadout.textContent = `${minutes} min`;
    paintPackage();
  });
  root.querySelectorAll('[data-quick]').forEach((b) => {
    b.addEventListener('click', () => {
      minutes = Number(b.getAttribute('data-quick'));
      timeInput.value = String(minutes);
      timeReadout.textContent = `${minutes} min`;
      paintPackage();
    });
  });
  root.querySelectorAll('[data-type]').forEach((b) => {
    b.addEventListener('click', () => {
      type = b.getAttribute('data-type');
      paintTypeButtons();
      paintPackage();
    });
  });

  // --- telemetry & routing: One-Trip Optimizer ---
  // Category segments in the load bar filter this queue. The filter is a
  // closure variable: repainting touches only the optimizer container,
  // never the rest of the dashboard.
  let catFilter = null;
  const optimizerEl = root.querySelector('[data-optimizer]');

  function paintOptimizer() {
    const groups = optimizerGroups(trophies, state, mult);
    const html = groups
      .map((g) => {
        const stops = catFilter ? g.stops.filter((s) => categoryOf(s.trophy) === catFilter) : g.stops;
        if (stops.length === 0) return '';
        const shownMin = stops.reduce((sum, s) => sum + s.min, 0);
        const lines = stops
          .map((s) => {
            const chips = s.stacks
              .map((st) => `<span class="stack-chip" title="${st.note}">1 run: ${st.label}</span>`)
              .join(' ');
            return `<li><span class="trip-name">${s.trophy.name} — Est. ${s.min} min</span>${chips ? `<span class="trip-chips">${chips}</span>` : ''}</li>`;
          })
          .join('');
        return `<div class="trip-group">
          <div class="trip-head"><span class="trip-cluster">${g.cluster}</span><span class="trip-meta">${stops.length} stops · ${(shownMin / 60).toFixed(1)} h est.</span></div>
          <ul class="trip-list">${lines}</ul>
        </div>`;
      })
      .join('');
    optimizerEl.innerHTML =
      (catFilter ? `<p class="burn-caption">routing filtered: ${catFilter} — select the segment again to clear.</p>` : '') +
      (html || '<p class="package-empty">No unearned trophies in this category. Clear the filter or pick another segment.</p>');
  }

  root.querySelectorAll('.stack-bar [data-cat]').forEach((seg) => {
    const toggle = () => {
      const cat = seg.getAttribute('data-cat');
      catFilter = catFilter === cat ? null : cat;
      root.querySelectorAll('.stack-bar [data-cat]').forEach((s) => s.classList.toggle('seg-on', s.getAttribute('data-cat') === catFilter));
      paintOptimizer();
    };
    seg.addEventListener('click', toggle);
    seg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  paintOptimizer();

  paintTypeButtons();
  paintPackage();
}

// Re-exported so the dashboard's module graph owns the stop action too.
export { stopActiveSession };
