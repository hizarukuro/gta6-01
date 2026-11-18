// Vista Marina — make.fun hand-in program for gta6-01.
// Copies the static game and its screenshots into the output directory and
// asks the kit's dossier builder to describe the entry.
import { cpSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

cpSync(join(here, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(here, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const built = buildDossier(outDir, caps);
if (typeof built === "string") {
  writeFileSync(join(outDir, "dossier.json"), built);
} else if (built instanceof Uint8Array) {
  writeFileSync(join(outDir, "dossier.json"), built);
} else if (built !== undefined && built !== null) {
  writeFileSync(join(outDir, "dossier.json"), JSON.stringify(built));
}
