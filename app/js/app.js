// app.js — boot and routing for the Leonida Completionist blueprint.
//
// Deep links:
//   ?view=dashboard|index|planner|log|roadmap|save   choose the sheet
//   ?build=60:skill     open the dashboard with a drafted session package
//   ?open=<trophy name> open the index with that trophy's detail showing
//   ?demo=1             seed a mid-run demo state when nothing is saved
//
// planner is the session builder's alias: it opens the dashboard at the
// builder panel.

import {
  getState,
  seedDemo,
  calibration,
  paceHoursPerWeek,
  exportJSON,
  validateImport,
  replaceState,
  resetState,
} from './store.js';
import { loadTrophies, allTrophies, computeStats, trophyByName } from './data.js';
import { renderDashboard } from './dashboard.js';
import { renderIndex } from './tracker.js';
import { renderLogView, renderActiveStrip, haltTimers } from './sessionlog.js';
import { renderRoadmap } from './roadmap.js';

const params = new URLSearchParams(location.search);
const viewEl = document.getElementById('view');
const stripEl = document.getElementById('active-strip');

let currentView = 'dashboard';
let dashboardPreset = null;
let indexOpts = {};

function makeCtx() {
  const state = getState();
  const mult = calibration();
  return {
    state,
    trophies: allTrophies(),
    mult,
    stats: computeStats(state, mult),
    pace: paceHoursPerWeek(),
    refresh,
    navigate,
  };
}

function navigate(view, opts = {}) {
  if (view === 'index') indexOpts = { ...indexOpts, ...opts };
  route(view);
}

function refresh() {
  route(currentView);
}

function route(view) {
  haltTimers();
  currentView = view;
  const ctx = makeCtx();
  renderActiveStrip(stripEl, ctx);
  document.querySelectorAll('.view-nav button').forEach((b) => {
    const on = b.getAttribute('data-view') === view || (view === 'dashboard' && b.getAttribute('data-view') === 'dashboard');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('on', on);
  });
  if (view === 'index') {
    renderIndex(viewEl, ctx, indexOpts);
  } else if (view === 'log') {
    renderLogView(viewEl, ctx);
  } else if (view === 'roadmap') {
    renderRoadmap(viewEl, ctx);
  } else if (view === 'save') {
    renderSave(viewEl, ctx);
  } else {
    currentView = 'dashboard';
    renderDashboard(viewEl, ctx, dashboardPreset);
    if (view === 'planner') {
      const builder = document.getElementById('session-builder');
      if (builder) builder.scrollIntoView({ block: 'start' });
    }
  }
}

/* ----- Save Data view ----- */

function renderSave(root, ctx) {
  root.innerHTML = `
    <div class="save-grid">
      <section class="panel">
        <div class="panel-head"><h2>Export progress</h2><span class="hint">Your earned trophies, counters, settings and session log as JSON.</span></div>
        <div class="panel-body">
          <textarea data-export readonly>${exportJSON()}</textarea>
          <div class="save-actions">
            <button type="button" data-download>Download JSON file</button>
            <button type="button" data-copy>Copy to clipboard</button>
          </div>
          <p class="save-msg" data-export-msg></p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Import progress</h2><span class="hint">Paste an export, or pick the file. It is validated before anything changes.</span></div>
        <div class="panel-body">
          <textarea data-import placeholder="Paste a progress export here…"></textarea>
          <div class="save-actions">
            <input type="file" data-file accept=".json,application/json" aria-label="Choose a progress file">
            <button type="button" data-do-import>Import</button>
          </div>
          <p class="save-msg" data-import-msg></p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Demo &amp; reset</h2><span class="hint">Try the sheet with a mid-run save, or wipe it clean.</span></div>
        <div class="panel-body">
          <div class="save-actions">
            <button type="button" data-demo>Load demo progress</button>
            <button type="button" data-reset>Reset everything</button>
          </div>
          <p class="save-msg" data-demo-msg></p>
        </div>
      </section>
    </div>`;

  const exportMsg = root.querySelector('[data-export-msg]');
  const importMsg = root.querySelector('[data-import-msg]');
  const demoMsg = root.querySelector('[data-demo-msg]');
  const importBox = root.querySelector('[data-import]');

  root.querySelector('[data-download]').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leonida-completionist-progress.json';
    a.click();
    URL.revokeObjectURL(url);
    exportMsg.textContent = 'Downloaded leonida-completionist-progress.json';
  });
  root.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportJSON());
      exportMsg.textContent = 'Copied to the clipboard.';
    } catch {
      exportMsg.textContent = 'Clipboard blocked — select the text and copy it by hand.';
    }
  });
  root.querySelector('[data-file]').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) importBox.value = await file.text();
  });
  root.querySelector('[data-do-import]').addEventListener('click', () => {
    const result = validateImport(importBox.value);
    if (!result.ok) {
      importMsg.textContent = 'Import refused: ' + result.error;
      return;
    }
    replaceState({
      earned: result.value.earned,
      counters: result.value.counters,
      settings: result.value.settings || {},
      sessions: result.value.sessions,
      active: null,
      demoSeeded: Boolean(result.value.demoSeeded),
    });
    importMsg.textContent = 'Imported. The whole sheet now runs on that progress.';
    ctx.refresh();
  });
  root.querySelector('[data-demo]').addEventListener('click', () => {
    const seeded = seedDemo();
    demoMsg.textContent = seeded
      ? 'Demo loaded: 21 of 55 earned, one session logged yesterday (40 estimated vs 47 actual).'
      : 'Demo only seeds an empty sheet — reset first if you want it.';
    if (seeded) ctx.refresh();
  });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (window.confirm('Wipe all progress, counters and the session log from this browser?')) {
      resetState();
      ctx.refresh();
    }
  });
}

/* ----- boot ----- */

async function boot() {
  if (params.get('demo') === '1') seedDemo();
  await loadTrophies();

  const build = params.get('build');
  if (build) {
    const [mins, type] = build.split(':');
    const minutes = Number(mins);
    if (Number.isFinite(minutes) && minutes > 0 && ['chill', 'skill', 'grind'].includes(type)) {
      dashboardPreset = { minutes, type };
    }
  }

  const open = params.get('open');
  let initial = params.get('view') || 'dashboard';
  if (open) {
    const t = trophyByName(open);
    if (t) {
      indexOpts = { openId: t.id };
      initial = 'index';
    }
  }

  document.querySelectorAll('.view-nav button').forEach((b) => {
    b.addEventListener('click', () => route(b.getAttribute('data-view')));
  });
  document.getElementById('command-search').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = document.getElementById('command-q').value;
    indexOpts = { query: q, openId: undefined };
    route('index');
  });

  route(initial);
}

boot().catch((err) => {
  viewEl.innerHTML = `<p class="empty-note">The blueprint failed to load: ${err.message}</p>`;
});
