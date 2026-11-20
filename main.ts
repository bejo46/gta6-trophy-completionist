// Leonida Completionist — handoff program for the gta6-trophy-guide-01 entry.
//
// The entry itself is the static web app in app/ (plain HTML, CSS and ES
// modules over app/data/trophies.json; no build step, no network). This
// program performs the handoff the scorer expects: it copies app/ and
// screenshots/ into the output directory and writes dossier.json there
// with the vendored make.fun library, whose output the scorer compares
// byte for byte against its own — so vendor/makefun-frontend.ts is never
// modified by this entry.
//
// Run locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.
// Any failure is fatal and loud: a half-written handoff helps no one.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The dossier caps mirror the scorer's gate: at most 4 screenshots of at
// most 256 KiB each, at most 993 files under app/ totalling at most
// 48 MiB, and a 160 KiB ceiling on any single text file's counted bytes.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function handOff() {
  const entryDir = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(outDir, { recursive: true });

  // The app ships exactly as it sits beside this file.
  cpSync(join(entryDir, 'app'), join(outDir, 'app'), { recursive: true });

  // Screenshots are part of the judged surface; copy them if present.
  const shotsDir = join(entryDir, 'screenshots');
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`handed off: app/ + screenshots/ -> ${outDir}, dossier.json written (${dossier.length} bytes)`);
}

try {
  handOff();
} catch (err) {
  console.error(`handoff FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
