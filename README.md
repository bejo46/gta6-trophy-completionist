# Leonida Completionist — The 100% Blueprint

[![make.fun bounty](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/bejo46/gta6-trophy-completionist/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/bejo46/gta6-trophy-completionist/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline completionist dashboard, guide and tracker for all 55 Grand Theft Auto VI PlayStation 5 trophies, drawn like a technical sheet: solid Prussian blue, thin white linework, a drafting title block, and not a pixel of borrowed artwork. It runs from static files with the network off and makes no requests at run time.

## What it does

- **Progress-first dashboard** — completion %, remaining hours (estimate), pace in hours/week (estimate), a projected platinum date (estimate), your personal calibration multiplier, and a single amber chip counting unearned missable trophies at risk.
- **Session builder** — give it a time budget (slider or 30/60/120 quick-set) and a session type (chill / skill / grind); it drafts a package of unearned trophies that fit, shortest estimate first, and starts a timed session from it.
- **Session log + calibration** — stopped sessions are logged with package estimate vs actual minutes. The app derives a calibration multiplier (total actual ÷ total estimate, clamped ×0.50–×2.00) that scales every displayed estimate, plus a pace (hours/week) that drives the burn-down and the projected platinum date.
- **Trophy index** — all 55 trophies ordered by estimate, with kind/grade/search filters, hide-earned, counters with −/+ controls (reaching a target auto-marks the trophy earned), and a spoiler shield that seals unearned story trophies. Each trophy opens a detail panel with its full guide in our own words, 3 steps, a plain-text timing note where timing matters, and its named sources.
- **Roadmap** — the road to the platinum in time-band phases (quick wins, one-session trophies, counters, long grinds, platinum closer), built from the official trophy descriptions.
- **Save data** — export progress as JSON (download or copy), import it back with validation, reset, and a demo mode that seeds a mid-run save.

## How to run

```sh
node serve.ts            # serves app/ at http://localhost:8080
# or open app/index.html through any static file server
```

Hand the entry in (copies `app/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Useful deep links: `?demo=1` seeds a demo save on an empty browser, `?view=dashboard|index|planner|log|roadmap|save` picks a sheet, `?build=60:skill` drafts a session package, `?open=<trophy name>` opens a trophy's guide.

## Sources

Trophy names, descriptions and grades are the official PlayStation list, as listed by Exophase and PSNProfiles. Every guide is written for this entry in its own words; each trophy's detail panel names the guide sources its advice draws on (among them the PowerPyx, PSNProfiles, PlayStationTrophies.org, TrueTrophies, GTA Wiki (Fandom) and Push Square trophy guides). Estimates are planning figures derived from the official descriptions' counts and scopes — labeled "estimate" everywhere they appear.
