# Vista Marina — a make.fun gta6-01 entry

[![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/hizarukuro/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/hizarukuro/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Vista Marina** is an original open-world crime game that runs entirely in the
browser. You are **Nico Ferreira**, a wheelman working the neon bay city of
Vista Marina for fixer **Mara Voss**, one job at a time, while the **VMPD**
watches every corner. Nothing here is borrowed from any existing game: the
city, people, cars, story and art are all original.

## The city

Five districts around a bay: the hotel strip of the **Neon Mile**, the docks of
**Portside**, the quiet streets of **Old Marina**, downtown **Vista Centro**,
and **Cayo Verde**, an island reached by a long causeway. Traffic follows the
road graph, pedestrians walk the sidewalks, and the day runs from golden hour
into a neon night.

## What you can do

- Walk, run and look around in third person; steal and drive any car
  (Cabrillo GT, Serrano pickup, Vela sedan, VMPD Interceptor).
- Work a 7-chapter story chain for Mara: pickups, deliveries, thefts,
  fights, a convoy ram and one last tide job.
- Outrun a living wanted system: patrols, pursuit units that ram,
  roadblocks at three stars, a spotlight helicopter at four.
- Fight with fists or a pistol, earn cash and reputation, get busted or
  wasted and pay your way out of the station or the hospital.

## How to play

Open `game/index.html` (or serve the folder with `serve.ts`) in a desktop
browser. No network is needed; three.js is vendored locally.

- **WASD** — move / drive · **Mouse** — look (click the game to lock)
- **F** — enter / exit a car · **Click** — punch / shoot
- **R** — reload · **1 / 2** — fists / pistol · **Esc / P** — pause

Progress (cash, reputation, chapter) is saved in your browser.

## Layout

- `main.ts` — the hand-in program: assembles the dossier for make.fun.
- `game/` — the game itself: `index.html`, `style.css`, and single-job
  modules under `game/src/` (state, city, vehicles, traffic, pedestrians,
  police, player, input, combat, audio, hud, minimap, missions, save,
  scenes, main). The simulation runs on a fixed 60 Hz step, separate from
  rendering, with one central state object.
- `screenshots/` — four captures from the running game.

Built with make.fun — referral code c23ct4sn
