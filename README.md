# Vista Marina — a "Make GTA 6" entry for make.fun (gta6-01)

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/hizarukuro/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/hizarukuro/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in a neon bay city, built with three.js and plain ES
modules — no build step, no network. You are **Nico Ferreira**, a wheelman
working for fixer **Mara Voss** across five districts of Vista Marina: the
Neon Mile, Portside, Old Marina, Vista Centro and the island of Cayo Verde.

**In the game:** a city you can cross on foot or by car · traffic that drives
the road grid · pedestrians who flee from trouble · stealable cars (Vela
sedan, Serrano pickup, the Cabrillo GT) · a 0–5 star wanted level with VMPD
pursuit, ramming, roadblocks and a spotlight helicopter · fists and pistol
combat · a seven-mission story chain with dialogue · a full HUD with a live
police-response panel (callsigns, real distances, tactics), a circular
minimap and a vehicle cluster · a start screen, pause, and save/continue in
localStorage · a sunset-to-night day cycle over the bay.

**Play it:** `node serve.ts`, then open http://localhost:8080 — WASD to move
and drive, F to enter a car, mouse to look, click to fight or shoot, R to
reload, M to pause.

**Hand it in:** `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` copies
`game/` and `screenshots/` to the output and writes `dossier.json`.

Built with make.fun — referral code c23ct4sn
