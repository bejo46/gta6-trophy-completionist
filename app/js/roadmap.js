// roadmap.js — the Roadmap view: the whole sheet re-sorted into time
// bands. Every trophy appears in exactly one band, decided in this order:
// the platinum closer first, then counted trophies, then quick wins, then
// one-session trophies, then the long grinds. Within a band, trophies are
// ordered by estimated time, cheapest first.

import { byTime, targetFor } from './data.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function bandFor(t) {
  if (t.id === 1 || t.id === 14) return 'closer';
  if (targetFor(t) !== null) return 'counters';
  if (t.est_min < 30) return 'quick';
  if (t.est_min <= 120) return 'session';
  return 'grind';
}

const BANDS = [
  ['quick', 'QUICK WINS', 'under 30 min each — clear these whenever you have a spare moment'],
  ['session', 'ONE-SESSION TROPHIES', '30 to 120 min each — one sitting, one trophy'],
  ['counters', 'COUNTERS', 'a numeric target from the official description — chip away in the background'],
  ['grind', 'LONG GRINDS', 'over 120 min each — schedule these deliberately'],
  ['closer', 'PLATINUM CLOSER', 'the 100% completion sweep and the platinum it unlocks'],
];

export function renderRoadmap(root, trophies, store) {
  root.textContent = '';
  const panel = el('div', 'panel');
  panel.append(el('p', 'panel-label', 'ROADMAP — TIME BANDS'));
  panel.append(el('p', 'muted',
    'This roadmap and its bands are built from the official trophy descriptions: ' +
    'each trophy is placed by the time its description implies, and ordered inside its band by estimated minutes.'));

  for (const [key, title, blurb] of BANDS) {
    const members = byTime(trophies.filter((t) => bandFor(t) === key));
    if (members.length === 0) continue;
    const earnedCount = members.filter((t) => store.isEarned(t.id)).length;

    const band = el('div', 'band');
    const head = el('div', 'band-head');
    head.append(el('span', '', `${title} — ${blurb}`), el('span', '', `${earnedCount} / ${members.length}`));
    band.append(head);

    const body = el('div', 'band-body');
    for (const t of members) {
      const done = store.isEarned(t.id);
      const item = el('div', `band-item${done ? ' done' : ''}`);
      const left = el('span', '', `${done ? '■' : '□'} ${t.name}`);
      const right = el('span', 'st', `${t.grade} · ${t.est_min === 0 ? 'auto' : `${t.est_min} min est`} · ${done ? 'EARNED' : 'OPEN'}`);
      item.append(left, right);
      body.append(item);
    }
    band.append(body);
    panel.append(band);
  }

  root.append(panel);
}
