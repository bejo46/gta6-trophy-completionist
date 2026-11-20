# Leonida Completionist — The 100% Blueprint

[![make.fun bounty](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/bejo46/gta6-trophy-completionist/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/bejo46/gta6-trophy-completionist/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline, static web app drawn like a cyanotype blueprint: a progress-first
completionist sheet for all **55 Grand Theft Auto VI PlayStation 5 trophies**.
No build step, no network requests, no accounts — open it and plan the road
to the platinum.

## The signature feature: the Session Builder

The dashboard is built around one question — *"I have an hour; what do I
play?"* Set a time budget (30 / 60 / 120 minutes) and a session type
(chill / skill / grind), and the builder drafts a package of unearned
trophies of that effort type that fits the time, cheapest estimates first.

Around it:

- **Analytics panel** — a burn-down of the remaining estimated hours, your
  current pace in hours per week derived from the session log, and a
  projected platinum date (remaining hours ÷ pace). Every figure is
  labelled an estimate.
- **Session log with calibration** — start a session from a built package,
  stop it when you finish playing, and the app logs actual minutes against
  the package's estimate. The ratio becomes your personal estimate
  multiplier (clamped ×0.50–×2.00) and rescales every future "at your pace"
  figure on the sheet.
- **KPI panels** — completion %, remaining hours, pace, projected date,
  calibration, and a single at-risk count for trophies whose official
  descriptions tie them to a one-time story beat or choice.
- **Trophy Index** — all 55 trophies ordered by time cost, with search,
  kind and grade filters, a spoiler shield that seals unearned story
  trophies, per-trophy counters for the counted trophies (reaching a
  target marks the trophy earned), and a detail panel carrying a full
  original guide, three steps, and named sources for every trophy.
- **Roadmap** — the sheet re-sorted into time bands: quick wins,
  one-session trophies, counters, long grinds, and the platinum closer.
- **Save Data** — export / import (file or paste, validated), reset, and a
  demo state, all in one localStorage key (`cyanotype-completion-log-v1`).

## Run it

Serve the `app/` folder with any static file server, for example:

```
node serve.ts            # serves app/ on port 8093
```

then open the root page in a browser. Useful deep links: `?view=index`,
`?view=log`, `?view=roadmap`, `?build=60:skill`, `?open=The Shootist`,
and `?demo=1` for the demonstration state used in the screenshots.

## Data & sources

Trophy names, descriptions and grades are the official list (the official
55 trophies, 2026-11-18) as published by Exophase and PSNProfiles. All
guide text, time estimates, effort classifications and roadmap bands are
this app's own work, written from those official descriptions; per-trophy
detail panels name their advice sources (among PowerPyx, PSNProfiles,
PlayStationTrophies.org, TrueTrophies, GTA Wiki (Fandom) and Push Square)
as text. Where a description does not pin down a place or a step, the guide
says so plainly rather than inventing one. No Rockstar artwork or logos
are used, and the app makes no network requests at runtime.

## Handing it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

copies `app/` and `screenshots/` into `out/` and writes `out/dossier.json`
with the vendored make.fun library.
