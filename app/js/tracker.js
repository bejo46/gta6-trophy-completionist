// tracker.js — the Trophy Index: the secondary, reference view of the
// blueprint. All 55 trophies ordered by estimated minutes, with filters
// (kind, grade, search, hide-earned), a spoiler shield that seals
// unearned story trophies, and a detail panel carrying the full guide,
// its 3 steps, its named sources and — for counted trophies — the
// counter controls.

import { calibratedMin, isSealed, KINDS, GRADES, formatCount } from './data.js';
import { isEarned, setEarned, counterOf, setCounter, saveState } from './store.js';

const ui = {
  kind: 'all',
  grade: 'all',
  query: '',
  openId: null,
};

export function renderIndex(root, ctx, opts = {}) {
  if (opts.query !== undefined) ui.query = opts.query;
  if (opts.openId !== undefined) ui.openId = opts.openId;
  const { state, mult } = ctx;

  const kindChips = ['all', ...KINDS]
    .map((k) => `<button type="button" data-kind="${k}" aria-pressed="${ui.kind === k}">${k}</button>`)
    .join('');
  const gradeOptions = ['all', ...GRADES]
    .map((g) => `<option value="${g}" ${ui.grade === g ? 'selected' : ''}>${g === 'all' ? 'all grades' : g}</option>`)
    .join('');

  root.innerHTML = `
    <div class="toolbar">
      <span class="chip-set">${kindChips}</span>
      <select data-grade aria-label="Filter by grade">${gradeOptions}</select>
      <input type="search" data-search placeholder="Search trophies…" value="${escapeAttr(ui.query)}" aria-label="Search trophies">
      <span class="spacer"></span>
      <label><input type="checkbox" data-hide-earned ${state.settings.hideEarned ? 'checked' : ''}> Hide earned</label>
      <label><input type="checkbox" data-shield ${state.settings.spoilerShield ? 'checked' : ''}> Spoiler shield</label>
    </div>
    <div class="index-layout">
      <section class="panel">
        <div class="panel-head"><h2>Trophy index</h2><span class="hint" data-count></span></div>
        <div class="panel-body" style="padding:0">
          <table class="trophy-table">
            <thead><tr>
              <th scope="col">Earned</th><th scope="col">Trophy</th><th scope="col">Grade</th>
              <th scope="col">Kind</th><th scope="col">Estimate</th><th scope="col">Effort</th><th scope="col">Progress</th>
            </tr></thead>
            <tbody data-rows></tbody>
          </table>
        </div>
      </section>
      <section class="panel detail" data-detail></section>
    </div>`;

  const rowsEl = root.querySelector('[data-rows]');
  const detailEl = root.querySelector('[data-detail]');
  const countEl = root.querySelector('[data-count]');

  function visibleTrophies() {
    const q = ui.query.trim().toLowerCase();
    return ctx.trophies
      .filter((t) => ui.kind === 'all' || t.kind === ui.kind)
      .filter((t) => ui.grade === 'all' || t.grade === ui.grade)
      .filter((t) => !state.settings.hideEarned || !isEarned(t.id))
      .filter((t) => {
        if (!q) return true;
        if (isSealed(t, state)) return false;
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.note.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.est_min - b.est_min || a.id - b.id);
  }

  function paint() {
    const list = visibleTrophies();
    countEl.textContent = `${list.length} shown · ordered by estimate, shortest first`;
    rowsEl.innerHTML = list.map((t) => rowHTML(t)).join('');
    rowsEl.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => {
        ui.openId = Number(tr.getAttribute('data-id'));
        paint();
      });
    });
    rowsEl.querySelectorAll('[data-earn]').forEach((box) => {
      box.addEventListener('click', (ev) => ev.stopPropagation());
      box.addEventListener('change', () => {
        setEarned(Number(box.getAttribute('data-earn')), box.checked);
        paint();
      });
    });
    paintDetail();
  }

  function rowHTML(t) {
    const sealed = isSealed(t, state);
    const earned = isEarned(t.id);
    const progress = t.count
      ? `${formatCount(counterOf(t.id))}/${formatCount(t.count)}`
      : t.repeatable
        ? '<span class="tag">Repeatable</span>'
        : '—';
    const nameCell = sealed
      ? `<span class="sealed-name">SEALED — STORY TROPHY</span><span class="t-note">Name and description hidden by the spoiler shield until earned.</span>`
      : `<span class="t-name">${t.name}</span><span class="t-note">${t.note}</span>`;
    return `<tr data-id="${t.id}" class="${earned ? 'is-earned' : ''} ${ui.openId === t.id ? 'selected' : ''}">
      <td><input type="checkbox" data-earn="${t.id}" ${earned ? 'checked' : ''} aria-label="Mark ${sealed ? 'sealed trophy' : t.name} as earned"></td>
      <td>${nameCell}</td>
      <td><span class="tag grade-${t.grade}">${t.grade}</span></td>
      <td>${t.kind}</td>
      <td class="t-est">${calibratedMin(t, mult)} min est.</td>
      <td>${t.effort_type}</td>
      <td>${progress}</td>
    </tr>`;
  }

  function paintDetail() {
    const t = ctx.trophies.find((x) => x.id === ui.openId);
    if (!t) {
      detailEl.innerHTML = `<div class="panel-head"><h2>Trophy detail</h2></div>
        <p class="empty-note">Select a trophy in the index to read its full guide, steps and sources.</p>`;
      return;
    }
    const sealed = isSealed(t, state);
    const earned = isEarned(t.id);
    if (sealed) {
      detailEl.innerHTML = `
        <div class="panel-head"><h2>Trophy detail</h2></div>
        <div class="panel-body">
          <div class="d-grade"><span class="tag grade-${t.grade}">${t.grade}</span><span class="tag">${t.kind}</span><span class="tag">${t.effort_type}</span></div>
          <h3 class="sealed-name">SEALED — STORY TROPHY</h3>
          <p>This story trophy is sealed by the spoiler shield: its name, description and guide stay hidden until it is earned. Its grade is shown in the index, and its estimate is ${calibratedMin(t, mult)} min (estimate).</p>
          <label class="earn-line"><input type="checkbox" data-d-earn ${earned ? 'checked' : ''}> Mark as earned (unseals it)</label>
        </div>`;
    } else {
      const counter = t.count
        ? `<h4>Counter</h4>
           <div class="counter-box">
             <button type="button" data-dec aria-label="Decrease counter">−</button>
             <span class="c-value">${formatCount(counterOf(t.id))}</span>
             <span class="c-target">/ ${formatCount(t.count)}${t.step > 1 ? ` · step ${formatCount(t.step)}` : ''}</span>
             <button type="button" data-inc aria-label="Increase counter">+</button>
           </div>
           <p class="t-note">Reaching the target marks the trophy earned automatically.</p>`
        : '';
      const timing = t.missableNote
        ? `<h4>Timing note</h4><p class="d-timing">${t.missableNote}</p>`
        : '';
      detailEl.innerHTML = `
        <div class="panel-head"><h2>Trophy detail</h2><span class="hint">Sheet LC-100-55 · item ${t.id} of 55</span></div>
        <div class="panel-body">
          <div class="d-grade">
            <span class="tag grade-${t.grade}">${t.grade}</span>
            <span class="tag">${t.kind}</span>
            <span class="tag">${t.effort_type}</span>
            ${t.repeatable ? '<span class="tag">Repeatable</span>' : ''}
          </div>
          <h3>${t.name}</h3>
          <p class="d-desc">“${t.description}”</p>
          <p>Estimated time: <b>${calibratedMin(t, mult)} min</b> (estimate, calibrated ×${mult.toFixed(2)})</p>
          ${counter}
          <h4>Guide</h4>
          <p>${t.guide}</p>
          <h4>Steps</h4>
          <ol>${t.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
          ${timing}
          <label class="earn-line"><input type="checkbox" data-d-earn ${earned ? 'checked' : ''}> Mark as earned</label>
          <p class="d-source">Sources: ${t.source}. Official names, descriptions and grades as published by PlayStation.</p>
        </div>`;
    }
    const earnBox = detailEl.querySelector('[data-d-earn]');
    earnBox.addEventListener('change', () => {
      setEarned(t.id, earnBox.checked);
      paint();
    });
    const dec = detailEl.querySelector('[data-dec]');
    const inc = detailEl.querySelector('[data-inc]');
    if (dec && inc && t.count) {
      const step = t.step || 1;
      dec.addEventListener('click', () => {
        setCounter(t.id, counterOf(t.id) - step, t.count);
        paint();
      });
      inc.addEventListener('click', () => {
        setCounter(t.id, counterOf(t.id) + step, t.count);
        paint();
      });
    }
  }

  root.querySelectorAll('[data-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      ui.kind = b.getAttribute('data-kind');
      root.querySelectorAll('[data-kind]').forEach((x) =>
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false'),
      );
      paint();
    });
  });
  root.querySelector('[data-grade]').addEventListener('change', (ev) => {
    ui.grade = ev.target.value;
    paint();
  });
  root.querySelector('[data-search]').addEventListener('input', (ev) => {
    ui.query = ev.target.value;
    paint();
  });
  root.querySelector('[data-hide-earned]').addEventListener('change', (ev) => {
    state.settings.hideEarned = ev.target.checked;
    saveState();
    paint();
  });
  root.querySelector('[data-shield]').addEventListener('change', (ev) => {
    state.settings.spoilerShield = ev.target.checked;
    saveState();
    paint();
  });

  paint();
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
