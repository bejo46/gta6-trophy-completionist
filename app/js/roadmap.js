// roadmap.js — the road to the platinum, drawn as time-band phases.
// Every trophy sits in exactly one phase, decided by its own fields:
// the endgame trophies close the sheet, counted trophies form the
// counters band, and the rest split by estimated minutes. The bands are
// built from the official trophy descriptions — what each trophy asks
// for, and how long it takes — not from any outside route.

import { calibratedMin } from './data.js';
import { isEarned } from './store.js';

const CLOSER_IDS = new Set([7, 14, 1]); // final mission, 100% completion, the platinum itself

const PHASES = [
  {
    title: 'Quick wins',
    sub: 'Under 30 min each — bank these in any spare half hour.',
    test: (t) => !t.count && t.est_min < 30,
  },
  {
    title: 'One-session trophies',
    sub: '30 to 150 min each — one good sitting apiece.',
    test: (t) => !t.count && t.est_min >= 30 && t.est_min <= 150,
  },
  {
    title: 'Counters',
    sub: 'Progress you bank a little at a time, inside other sessions.',
    test: (t) => Boolean(t.count),
  },
  {
    title: 'Long grinds',
    sub: 'Over 150 min each — the chapter-length hauls.',
    test: (t) => !t.count && t.est_min > 150,
  },
  {
    title: 'Platinum closer',
    sub: 'The endgame: the finale, the 100% counter, and the platinum it unlocks.',
    test: (t) => CLOSER_IDS.has(t.id),
  },
];

function phaseOf(t) {
  if (CLOSER_IDS.has(t.id)) return PHASES[4];
  if (t.count) return PHASES[2];
  if (t.est_min < 30) return PHASES[0];
  if (t.est_min <= 150) return PHASES[1];
  return PHASES[3];
}

export function renderRoadmap(root, ctx) {
  const { trophies, mult } = ctx;
  const byPhase = PHASES.map(() => []);
  for (const t of trophies) byPhase[PHASES.indexOf(phaseOf(t))].push(t);
  for (const list of byPhase) list.sort((a, b) => a.est_min - b.est_min || a.id - b.id);

  const sections = PHASES.map((phase, i) => {
    const items = byPhase[i]
      .map((t) => {
        const done = isEarned(t.id);
        return `<li class="${done ? 'done' : ''}">
          <span class="r-check">${done ? '✓' : '○'}</span>
          <span class="r-name">${t.name}</span>
          <span class="tag grade-${t.grade}">${t.grade}</span>
          <span class="r-est">${calibratedMin(t, mult)} min est.</span>
        </li>`;
      })
      .join('');
    return `<section class="phase">
      <div class="phase-head"><h3>Phase ${i + 1} — ${phase.title}</h3><span class="phase-sub">${phase.sub} (${byPhase[i].length} trophies)</span></div>
      <ul class="phase-list">${items}</ul>
    </section>`;
  }).join('');

  root.innerHTML = `
    <p class="roadmap-note">This roadmap is built from the official trophy descriptions: each phase is drawn from what the descriptions themselves ask for — the story chapters and named missions, the collectible sets and their counts, the activities and their totals — ordered by estimated time so the platinum is approached in sittings, not in one haul. Estimates are calibrated (×${mult.toFixed(2)}) and labeled as estimates.</p>
    ${sections}`;
}
