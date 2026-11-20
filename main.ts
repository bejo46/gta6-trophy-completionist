// Leonida Completionist — The 100% Blueprint: the hand-in program.
//
// What lives beside this file is the entry itself: app/ (a static,
// offline trophy guide + tracker — plain HTML, CSS and ES modules, no
// build step) and screenshots/ (four captures of the running app).
// This program delivers it: it copies app/ and screenshots/ into the
// output directory and writes dossier.json there with buildDossier
// from the vendored make.fun library, byte for byte as the scorer's
// own copy will. vendor/makefun-frontend.ts is the kit's file and is
// left untouched on purpose.
//
// Run it the way the grader does (MAKEFUN_OUTPUT_DIR stands in for
// /output outside the grader's container):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Any failure is loud: a missing folder or a refused dossier exits
// non-zero with the reason on stderr, never a silent empty hand-in.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored so a hand-in the scorer would refuse
// fails here first, with a clearer message.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function die(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function requireDir(name) {
  const dir = join(repoRoot, name);
  if (!existsSync(dir)) die(`missing ${name}/ beside main.ts — nothing to hand in`);
  return dir;
}

function main() {
  const appDir = requireDir('app');
  const shotsDir = requireDir('screenshots');
  if (!existsSync(join(appDir, 'index.html'))) die('app/index.html is missing');
  const shots = readdirSync(shotsDir).filter((f) => !f.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    die(`screenshots/ must hold 3 or 4 captures, found ${shots.length}`);
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(appDir, join(outputDir, 'app'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  console.log(`handed in: app/ + ${shots.length} screenshots -> ${outputDir}`);
  console.log(`dossier.json written (${dossier.length} bytes)`);
}

try {
  main();
} catch (err) {
  die(err instanceof Error ? err.message : String(err));
}
