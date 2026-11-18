// Vista Marina — hand-in program for make.fun's "Make GTA 6" bounty (gta6-01).
//
// The game is not built, bundled or transpiled: it is the plain static tree
// under game/ (ES modules, three.js vendored beside them, no network), which
// a desktop browser opens as-is. This program's whole job is the hand-in —
// copy game/ and screenshots/ into the output directory and write the
// dossier the judge reads, using the kit's own buildDossier so the numbers
// here are the numbers the sealed gate will compute.
//
//   Play it:   node serve.ts            → http://localhost:8080
//   Hand in:   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the gate's own, so an oversized entry fails here, at home,
// instead of failing quietly on the site.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
