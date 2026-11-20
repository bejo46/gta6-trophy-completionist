// tracker.js — the Trophy Index: a secondary, reference view of all 55
// trophies ordered by time cost. Rows stay terse (name, estimate, effort
// type, repeatable marker, one short note); the full guide lives in the
// detail panel, with its three steps and its named sources.

import { byTime, targetFor, isHiddenStory, KINDS, GRADES } from './data.js';

const filters = {
  query: '',
  kind: 'all', // all | story | collectibles | activities | misc | missable
  grade: 'all',
  hideEarned: false,
};
let selectedId = null;

export function openByName(trophies, name) {
  const t = trophies.find((x) => x.name === name);
  if (t) selectedId = t.id;
  return Boolean(t);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function sealed(t, store) {
  return store.getState().settings.spoilers && isHiddenStory(t) && !store.isEarned(t.id);
}

export function renderIndex(controlsRoot, listRoot, detailRoot, trophies, store) {
  renderControls(controlsRoot, listRoot, detailRoot, trophies, store);
  renderList(listRoot, detailRoot, trophies, store);
  renderDetail(detailRoot, trophies, store);
}

function renderControls(root, listRoot, detailRoot, trophies, store) {
  root.textContent = '';
  const bar = el('div', 'controls-bar');

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'SEARCH TROPHIES';
  search.value = filters.query;
  search.setAttribute('aria-label', 'Search trophies');
  search.addEventListener('input', () => {
    filters.query = search.value;
    renderList(listRoot, detailRoot, trophies, store);
  });
  bar.append(search);

  const seg = el('div', 'seg');
  const kindOpts = [['all', 'All'], ...KINDS.map((k) => [k, k]), ['missable', 'Missable only']];
  for (const [val, label] of kindOpts) {
    const b = el('button', '', label.toUpperCase());
    b.type = 'button';
    if (filters.kind === val) b.classList.add('on');
    b.addEventListener('click', () => {
      filters.kind = val;
      renderControls(root, listRoot, detailRoot, trophies, store);
      renderList(listRoot, detailRoot, trophies, store);
    });
    seg.append(b);
  }
  bar.append(seg);

  const gradeSel = document.createElement('select');
  gradeSel.setAttribute('aria-label', 'Filter by grade');
  for (const g of ['all', ...GRADES]) {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g === 'all' ? 'ALL GRADES' : g.toUpperCase();
    if (filters.grade === g) o.selected = true;
    gradeSel.append(o);
  }
  gradeSel.addEventListener('change', () => {
    filters.grade = gradeSel.value;
    renderList(listRoot, detailRoot, trophies, store);
  });
  bar.append(gradeSel);

  const hideLbl = el('label', 'checkline');
  const hideCb = document.createElement('input');
  hideCb.type = 'checkbox';
  hideCb.checked = filters.hideEarned;
  hideCb.addEventListener('change', () => {
    filters.hideEarned = hideCb.checked;
    renderList(listRoot, detailRoot, trophies, store);
  });
  hideLbl.append(hideCb, document.createTextNode('Hide earned'));
  bar.append(hideLbl);

  const spLbl = el('label', 'checkline');
  const spCb = document.createElement('input');
  spCb.type = 'checkbox';
  spCb.checked = store.getState().settings.spoilers;
  spCb.addEventListener('change', () => store.setSpoilers(spCb.checked));
  spLbl.append(spCb, document.createTextNode('Spoiler shield'));
  bar.append(spLbl);

  root.append(bar);
}

function visibleTrophies(trophies, store) {
  const q = filters.query.trim().toLowerCase();
  return byTime(trophies).filter((t) => {
    if (filters.hideEarned && store.isEarned(t.id)) return false;
    if (filters.kind === 'missable' && !t.missable) return false;
    if (filters.kind !== 'all' && filters.kind !== 'missable' && t.kind !== filters.kind) return false;
    if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
    if (q) {
      if (sealed(t, store)) return 'hidden story trophy'.includes(q);
      return t.name.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
    }
    return true;
  });
}

function renderList(root, detailRoot, trophies, store) {
  root.textContent = '';
  const rows = visibleTrophies(trophies, store);
  const table = el('table');
  const thead = el('thead');
  const htr = el('tr');
  for (const h of ['', 'Trophy — ordered by time cost', 'Grade', 'Est. min', 'Effort', '']) htr.append(el('th', '', h));
  thead.append(htr);
  table.append(thead);
  const tbody = el('tbody');
  if (rows.length === 0) {
    const tr = el('tr');
    const td = el('td', 'muted', 'No trophies match the current filters.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
  }
  for (const t of rows) {
    const isSealed = sealed(t, store);
    const tr = el('tr', 'trow');
    if (store.isEarned(t.id)) tr.classList.add('done');
    if (t.id === selectedId) tr.classList.add('sel');

    const tdCheck = el('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = store.isEarned(t.id);
    cb.setAttribute('aria-label', `Mark ${t.name} earned`);
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => store.setEarned(t.id, cb.checked));
    tdCheck.append(cb);
    tr.append(tdCheck);

    const tdName = el('td');
    tdName.append(el('span', 'tname', isSealed ? 'Hidden story trophy' : t.name));
    tdName.append(el('span', 'tnote', isSealed ? 'Sealed by the spoiler shield until earned.' : t.note));
    tr.append(tdName);

    tr.append(el('td', '', t.grade));
    tr.append(el('td', 'mono', t.est_min === 0 ? '—' : `${t.est_min} est`));
    tr.append(el('td', '', t.effort_type));
    const tdRep = el('td');
    if (t.repeatable) tdRep.append(el('span', 'tag', 'REPEATABLE'));
    tr.append(tdRep);

    tr.addEventListener('click', () => {
      selectedId = t.id;
      renderList(root, detailRoot, trophies, store);
      renderDetail(detailRoot, trophies, store);
    });
    tbody.append(tr);
  }
  table.append(tbody);
  root.append(table);
}

function renderDetail(root, trophies, store) {
  const t = trophies.find((x) => x.id === selectedId);
  root.textContent = '';
  if (!t) {
    root.append(el('p', 'panel-label', 'DETAIL — NO TROPHY SELECTED'));
    root.append(el('p', 'muted', 'Select a trophy from the index to read its full guide, its three steps, and the sources it is drawn from.'));
    return;
  }
  const isSealed = sealed(t, store);
  root.append(el('p', 'panel-label', `DETAIL — TROPHY ${String(t.id).padStart(2, '0')} / 55`));
  root.append(el('h2', '', isSealed ? 'Hidden story trophy' : t.name));
  root.append(el('p', 'official', isSealed ? 'Description sealed by the spoiler shield until this trophy is earned.' : `\u201C${t.description}\u201D`));

  const meta = el('div', 'meta-grid');
  const cells = [
    ['Grade', t.grade],
    ['Kind', t.kind],
    ['Estimate', t.est_min === 0 ? 'automatic' : `${t.est_min} min`],
    ['Effort type', t.effort_type],
    ['Repeatable', t.repeatable ? 'yes' : 'no'],
    ['Status', store.isEarned(t.id) ? 'EARNED' : 'UNEARNED'],
  ];
  for (const [k, v] of cells) {
    const d = el('div');
    d.append(el('span', 'k', k), document.createTextNode(v));
    meta.append(d);
  }
  root.append(meta);

  if (!isSealed) {
    root.append(el('h3', '', 'Guide'));
    root.append(el('p', '', t.guide));
    root.append(el('h3', '', 'Steps'));
    const ol = el('ol');
    for (const s of t.steps) ol.append(el('li', '', s));
    root.append(ol);
    root.append(el('p', 'source-line', t.source));
    if (t.missable && t.missableNote) {
      root.append(el('p', 'timing-note', t.missableNote));
    }
  } else {
    root.append(el('p', 'muted', 'Guide and steps are sealed with the description. Turn the spoiler shield off in the index controls or in Save Data to read them.'));
  }

  const target = targetFor(t);
  if (target !== null) {
    root.append(el('h3', '', 'Counter'));
    const ctl = el('div', 'counter-ctl');
    const minus = el('button', '', '−');
    minus.type = 'button';
    const num = el('span', 'counter-num', `${store.getCounter(t.id)} / ${target.toLocaleString('en-US')}`);
    const plus = el('button', '', '+');
    plus.type = 'button';
    minus.addEventListener('click', () => store.setCounter(t.id, store.getCounter(t.id) - 1));
    plus.addEventListener('click', () => {
      const next = store.getCounter(t.id) + 1;
      store.setCounter(t.id, next);
      if (next >= target) store.setEarned(t.id, true);
    });
    ctl.append(minus, num, plus);
    root.append(ctl);
    root.append(el('p', 'small muted', 'Reaching the target marks the trophy earned automatically.'));
  }

  const row = el('div', 'btn-row');
  const toggle = el('button', store.isEarned(t.id) ? '' : 'primary', store.isEarned(t.id) ? 'Mark unearned' : 'Mark earned');
  toggle.type = 'button';
  toggle.addEventListener('click', () => store.toggleEarned(t.id));
  row.append(toggle);
  root.append(row);
}
