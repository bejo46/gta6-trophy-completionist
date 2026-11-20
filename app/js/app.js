// app.js — boot and tab routing for the Leonida Completionist sheet.
//
// Deep links used by the screenshots and by shared links:
//   ?view=dashboard|index|log|roadmap|save   — open on a view
//   ?build=60:skill                          — dashboard builder preset
//   ?open=<trophy name>                      — index with that detail open
//   ?demo=1                                  — seed the demo state (store.js)

import * as store from './store.js';
import { loadTrophies, completionStats } from './data.js';
import { renderDashboard, setBuilder } from './dashboard.js';
import { renderIndex, openByName } from './tracker.js';
import { renderLog } from './sessionlog.js';
import { renderRoadmap } from './roadmap.js';

const VIEWS = ['dashboard', 'index', 'log', 'roadmap', 'save'];
let trophies = [];
let currentView = 'dashboard';

function show(view) {
  if (!VIEWS.includes(view)) view = 'dashboard';
  currentView = view;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== view;
  }
  render();
}

function render() {
  const stats = completionStats(trophies, store.getState());
  document.getElementById('hdr-pct').textContent = `${stats.pct} %`;
  document.getElementById('hdr-earned').textContent = `${stats.earned} / ${stats.total}`;
  if (currentView === 'dashboard') {
    renderDashboard(document.getElementById('view-dashboard'), trophies, store, show);
  } else if (currentView === 'index') {
    renderIndex(
      document.getElementById('index-controls'),
      document.getElementById('index-list'),
      document.getElementById('detail-panel'),
      trophies,
      store,
    );
  } else if (currentView === 'log') {
    renderLog(document.getElementById('view-log'), trophies, store);
  } else if (currentView === 'roadmap') {
    renderRoadmap(document.getElementById('view-roadmap'), trophies, store);
  } else if (currentView === 'save') {
    renderSave();
  }
}

function renderSave() {
  document.getElementById('export-box').value = store.exportJSON();
  document.getElementById('set-spoilers').checked = store.getState().settings.spoilers;
}

function wireSave() {
  document.getElementById('btn-refresh-export').addEventListener('click', renderSave);
  document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leonida-completionist-save.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  const msg = document.getElementById('import-msg');
  document.getElementById('btn-import-text').addEventListener('click', () => {
    try {
      store.importJSON(document.getElementById('import-box').value);
      msg.textContent = 'Import complete. Progress, counters and the session log were restored.';
    } catch (err) {
      msg.textContent = `Import failed: ${err.message}`;
    }
  });
  document.getElementById('import-file').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      store.importJSON(await file.text());
      msg.textContent = 'Import complete. Progress, counters and the session log were restored.';
    } catch (err) {
      msg.textContent = `Import failed: ${err.message}`;
    }
    ev.target.value = '';
  });
  document.getElementById('set-spoilers').addEventListener('change', (ev) => {
    store.setSpoilers(ev.target.checked);
  });
  document.getElementById('btn-demo').addEventListener('click', () => store.loadDemo());
  document.getElementById('btn-reset').addEventListener('click', () => store.resetAll());
}

async function boot() {
  store.load();
  trophies = await loadTrophies();

  const params = new URLSearchParams(location.search);
  const build = params.get('build');
  if (build) {
    const [mins, effort] = build.split(':');
    setBuilder(Number(mins), effort);
  }
  const open = params.get('open');
  if (open) openByName(trophies, open);

  document.getElementById('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-view]');
    if (btn) show(btn.dataset.view);
  });
  wireSave();
  store.onChange(render);
  show(params.get('view') ?? (open ? 'index' : 'dashboard'));
}

boot().catch((err) => {
  document.querySelector('main').textContent = `The sheet failed to load: ${err.message}`;
});
