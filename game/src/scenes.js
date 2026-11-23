// scenes.js — ?scene=chase|foot|roadblock|night staging for the dossier
// screenshots. Everything is posed with real geometry in the real world:
// panel distances are measured live from these positions by hud.js, the
// speedo reads the hero car's actual speed field, and the spotlight pool
// sits where the helicopter's cone lands. Nothing is faked in the DOM.
import { G } from "./state.js";
import { addCar, syncCarMesh, damageCar } from "./vehicles.js";
import { addPed, clearPedsNear } from "./pedestrians.js";
import { spawnUnitAt, setWanted, clearPolice, stageHeli } from "./police.js";
import { setCamPose, setMeshVisible, syncPlayerMesh } from "./player.js";
import { showDialogue } from "./hud.js";

function base(clockMin, cash, rep) {
  clearPolice();
  G.mode = "play";
  G.frozen = true;
  G.camLock = true;
  G.clockMin = clockMin;
  const p = G.player;
  p.cash = cash; p.rep = rep; p.health = 100; p.armour = 40;
  p.weapon = "pistol"; p.ammo = 7; p.reserve = 41;
  G.seen = true;
}

function putPlayerIn(car) {
  const p = G.player;
  p.car = car; car.driver = "player"; car.parked = false;
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  setMeshVisible(false);
}

function putPlayerOnFoot(x, z, heading) {
  const p = G.player;
  p.car = null; p.x = x; p.z = z; p.heading = heading;
  setMeshVisible(true);
  syncPlayerMesh();
}

function card(chapter, title, objective, stage, stages, next) {
  G.mission = { chapter, title, objective, stage, stages, next };
}

function crowd(points) {
  for (const [x, z] of points) {
    const ped = addPed(x, z);
    ped.group.position.set(x, 0, z);
  }
}

const SCENES = {
  // COVER: bright late-afternoon boulevard chase. The swarm is staged to
  // be SEEN, not just listed: one unit tight behind the hero, one on each
  // front quarter at 6–7 m, the helicopter low on the upper-left with its
  // pool on the hero's roof, and a smouldering wreck on the right shoulder
  // as the event in the frame. The camera sits close, low and offset to
  // the right so the hero fills the foreground and the units around it
  // read at thumbnail size.
  chase() {
    base(16 * 60 + 38, 18450, 1250);
    const hero = addCar("cabrillo", 242, 74, 0, { color: 0xd8232a });
    hero.speed = 41; // 148 km/h on the speedo
    hero.condition = 84; // the chase has already cost the GT some paint
    putPlayerIn(hero);
    const m11 = spawnUnitAt(239.3, 77.6, 0, "MARLIN-11", "pursuit"); m11.tactic = "RAMMING";
    const s25 = spawnUnitAt(241.8, 64.8, 0, "SNAPPER-25", "pursuit"); s25.tactic = "PURSUIT";
    const t18 = spawnUnitAt(246.6, 69.0, 0, "TARPON-18", "pursuit"); t18.tactic = "PURSUIT";
    const c07 = spawnUnitAt(241.5, 61, 0, "COBIA-07", "pursuit"); c07.tactic = "PURSUIT";
    const w33 = spawnUnitAt(249.6, 65.5, Math.PI, "WAHOO-33", "pursuit"); w33.tactic = "PURSUIT";
    stageHeli(233.5, 8.2, 65, hero.x, hero.z);
    setWanted(4);
    const wreck = addCar("serrano", 248.5, 56.5, -0.45, { parked: true, color: 0x5d6670 });
    damageCar(wreck, 93); // written off and smoking on the shoulder
    const extra1 = addCar("vela", 248.5, 28, Math.PI, { driver: "traffic" }); extra1.speed = 9;
    const extra2 = addCar("cabrillo", 236.8, 40, 0, { driver: "traffic", color: 0x2e5d43 }); extra2.speed = 10;
    addCar("serrano", 236.5, 14, 0, { parked: true, color: 0x5d6670 });
    clearPedsNear(242, 74, 95);
    crowd([[236, 66], [253.5, 88], [236, 96], [253.5, 58], [236, 118], [253.5, 122], [236, 40], [253.5, 30], [236, 80], [253.5, 104], [236, 24], [253.5, 72], [236, 56], [253.5, 44], [253.5, 80], [236.5, 70], [253.5, 66]]);
    card(7, "The Tide Job", "Run the case to Cayo Verde. Do not stop.", 3, 4, "Final stage");
    G.objective = { x: 500, z: 10 };
    showDialogue("MARA", "Lose that helicopter, Nico — the case stays dry or we don't get paid.", 60);
    setCamPose(245.5, 1.2, 78.6, 241.0, 1.05, 69.0);
    for (const c of G.cars) syncCarMesh(c, 0);
  },

  // On foot on the beach-side sidewalk: the blue Vela waits at the kerb,
  // HERON-17 rolls in along the boulevard, and the Mile's storefronts
  // line the far side of the street behind him.
  foot() {
    base(16 * 60 + 52, 1970, 260);
    putPlayerOnFoot(252.5, 47, 0.45);
    addCar("vela", 249.3, 40.5, Math.PI, { parked: true, color: 0x3a6fd8 });
    const h17 = spawnUnitAt(246.5, 33, Math.PI, "HERON-17", "pursuit"); h17.tactic = "PURSUIT";
    const s25 = spawnUnitAt(240.5, 30, Math.PI, "SNAPPER-25", "pursuit"); s25.tactic = "PURSUIT";
    setWanted(2);
    const traffic = addCar("vela", 248.8, 84, Math.PI, { driver: "traffic", color: 0xb8bcc4 });
    traffic.speed = 9;
    const traffic2 = addCar("serrano", 237.5, -6, 0, { driver: "traffic", color: 0x2e5d43 });
    traffic2.speed = 9;
    addCar("serrano", 253.8, 68, Math.PI, { parked: true, color: 0xe06a1b });
    clearPedsNear(252.5, 47, 85);
    crowd([[236.5, 30], [253.5, 52], [236.5, 62], [253.5, 20], [236.5, 8], [253.5, 74], [236.5, 44], [253.5, 38], [236.5, 84], [253.5, 60], [236.5, 20], [253.5, 86]]);
    card(2, "Harbour Run", "Pick up the package at the Portside docks.", 0, 3, "Drop the case at Hotel Lumen");
    G.objective = { x: -160, z: 150 };
    G.scenePrompt = "F — Take the VELA";
    showDialogue("MARA", "Portside, south docks. A man with a grey case is waiting. Don't keep him.", 60);
    setCamPose(255.5, 1.6, 52.5, 252.3, 1.1, 46.2);
    for (const c of G.cars) syncCarMesh(c, 0);
  },

  // Bright afternoon on the causeway: three units across the road ahead,
  // two more on the tail, the hero large in the foreground.
  roadblock() {
    base(16 * 60 + 47, 9650, 800);
    const hero = addCar("serrano", 330, 12.9, Math.PI / 2, { color: 0xe06a1b });
    hero.speed = 12;
    hero.condition = 91;
    putPlayerIn(hero);
    const k31 = spawnUnitAt(347, 6.2, Math.PI, "KESTREL-31", "block"); k31.tactic = "ROADBLOCK";
    const i43 = spawnUnitAt(347, 15.8, 0, "IBIS-43", "block"); i43.tactic = "ROADBLOCK";
    const e52 = spawnUnitAt(351, 11, -Math.PI / 2, "EGRET-52", "block"); e52.tactic = "ROADBLOCK";
    const m11 = spawnUnitAt(306, 13.2, Math.PI / 2, "MARLIN-11", "pursuit"); m11.tactic = "RAMMING";
    const t18 = spawnUnitAt(288, 9.5, Math.PI / 2, "TARPON-18", "pursuit"); t18.tactic = "PURSUIT";
    setWanted(3);
    addCar("vela", 262, 7.1, Math.PI / 2, { driver: "traffic", color: 0xb8bcc4 });
    addCar("cabrillo", 314, 8.2, Math.PI / 2, { driver: "traffic", color: 0x274bdb });
    card(4, "Causeway Blues", "Take the causeway to Cayo Verde.", 1, 3, "Return to Mara's garage");
    G.objective = { x: 520, z: 30 };
    showDialogue("MARA", "Roadblock ahead. Ram through it or swim, wheelman.", 60);
    setCamPose(318, 2.0, 13.5, 344, 1, 11.5);
    for (const c of G.cars) syncCarMesh(c, 0);
  },

  // Night on the Mile: two units searching, every window lit.
  night() {
    base(21 * 60 + 47, 12400, 1010);
    const hero = addCar("cabrillo", 250, -30, Math.PI, { color: 0x274bdb });
    hero.speed = 0;
    putPlayerIn(hero);
    const t18 = spawnUnitAt(243, -8, Math.PI, "TARPON-18", "pursuit"); t18.tactic = "SEARCHING";
    const h17 = spawnUnitAt(236, 40, Math.PI, "HERON-17", "pursuit"); h17.tactic = "SEARCHING";
    const m11 = spawnUnitAt(247, -18, Math.PI, "MARLIN-11", "pursuit"); m11.tactic = "SEARCHING";
    setWanted(2);
    G.seen = false;
    addCar("vela", 237, -64, 0, { parked: true, color: 0x7a1f2b });
    addCar("serrano", 237, -16, 0, { parked: true, color: 0x5d6670 });
    addCar("cabrillo", 253.5, 8, Math.PI, { parked: true, color: 0xe06a1b });
    const traffic = addCar("vela", 247.5, 66, Math.PI, { driver: "traffic", color: 0x2e5d43 });
    traffic.speed = 8;
    clearPedsNear(250, -30, 85);
    crowd([[236, -44], [253.5, -12], [236, 6], [253.5, -58], [236, -84], [236, -20], [253.5, -34], [236, 24], [253.5, -70]]);
    card(5, "Night Market", "Deal with the crew muscling the market.", 1, 4, "Collect the stall money");
    G.objective = { x: 186, z: -66 };
    showDialogue("MARA", "Three of Braga's boys are taxing my stalls. Retire them.", 60);
    setCamPose(256.5, 3.0, -47, 249, 1.2, -29);
    for (const c of G.cars) syncCarMesh(c, 0);
  },
};

export function applyScene(name) {
  const fn = SCENES[name];
  if (fn) fn();
}
