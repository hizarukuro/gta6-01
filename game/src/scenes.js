// scenes.js — the four staged moments the entry is judged by
// (?scene=chase|foot|roadblock|night). A scene is not a mock-up: it places
// the game's real actors — the player's car, live VMPD units, GULL-1, traffic
// and pedestrians — and lets the HUD read the same state it reads in play, so
// every number on screen (speeds, distances, tactics) is the true one for
// the pose. main.js freezes the simulation in scene mode; pin() holds the
// pose each frame while lights flash, wheels turn and the rotor spins.
//
// The chase staging is built around the camera: MARLIN-11 sits eleven metres
// off the GT's bumper, close enough to fill the frame as a police car, and
// GULL-1 hangs low over the boulevard so the airframe itself — not just its
// spotlight — is in the shot.

import { G } from './state.js';
import { LOCATIONS } from './city.js';
import { poseHelicopter } from './police.js';
import { tickPoliceLights } from './vehicles.js';

export function createScenes(ctx) {
  const { hud, spawnCar } = ctx;
  let active = null;
  let stagedPeds = [];
  let playerCar = null;
  let activeDialogue = null;
  let dlgClock = 0;

  function policeUnit(x, z, heading, callsign, tactic) {
    const car = spawnCar('interceptor', x, z, heading);
    car.driver = 'police';
    const unit = { kind: 'car', car, callsign, tactic, state: 'chase', shootCd: 9 };
    car.unit = unit;
    G.cars.push(car);
    G.police.push(unit);
    return car;
  }

  function trafficCar(model, x, z, heading, color) {
    const car = spawnCar(model, x, z, heading, color);
    car.driver = 'traffic';
    G.cars.push(car);
    return car;
  }

  function missionCard(chapter, title, stageIndex, stages, label, next, target) {
    G.mission = {
      def: { chapter, title, stages: Array.from({ length: stages }) },
      stageIndex,
      stage: { label, next, target },
      data: {},
    };
  }

  // Every unstaged pedestrian waits on a far Portside pavement, so a random
  // seed spawn can never wander through a staged camera.
  function clearPeds() {
    G.peds.forEach((ped, i) => {
      ped.pos.set(-269 + (i % 3) * 2.2, 0, -240 + i * 13);
      ped.mesh.position.copy(ped.pos);
      ped.state = 'walk';
    });
    stagedPeds = [];
  }

  function placePeds(list) {
    list.forEach(([x, z], i) => {
      const ped = G.peds[i];
      if (!ped) return;
      ped.pos.set(x, 0, z);
      ped.mesh.position.copy(ped.pos);
      stagedPeds.push(ped);
    });
  }

  function baseSetup() {
    G.started = true;
    G.hasPistol = true;
    G.mag = 12; G.reserve = 128;
    G.weapon = 'pistol';
    hud.show();
    hud.refreshWeapons();
  }

  function drivingPose(model, x, z, heading, color, speed, hp) {
    playerCar = spawnCar(model, x, z, heading, color);
    playerCar.driver = 'player';
    playerCar.speed = speed;
    playerCar.hp = hp;
    G.cars.push(playerCar);
    G.driveCar = playerCar;
    G.mode = 'car';
    G.player.mesh.visible = false;
    G.player.pos.set(x, 0, z);
    hud.onEnterCar(playerCar);
    return playerCar;
  }

  const scenes = {
    // THE COVER — head-on down the boulevard at golden hour: the red GT at
    // 148 km/h, MARLIN-11 big on its bumper, the rest of the response behind,
    // and GULL-1 low overhead with its spotlight on the car.
    chase() {
      baseSetup();
      G.time = 17.35; G.cash = 18450; G.rep = 1620; G.repLevel = 4;
      G.health = 82; G.armour = 64; G.wanted = 4; G.seenByPolice = true;
      drivingPose('cabrillo', 345, 64, Math.PI, 0xd21f3c, 41, 61);
      policeUnit(339.5, 73.5, Math.PI, 'MARLIN-11', 'RAMMING');   // 11 m back, clear of the GT
      policeUnit(351, 86, Math.PI, 'SNAPPER-25', 'PURSUIT');      // 23 m back
      policeUnit(336.5, 105, Math.PI, 'TARPON-18', 'PURSUIT');    // 42 m back
      trafficCar('vela', 352, 122, Math.PI, 0xe8e8e8);
      trafficCar('serrano', 340.5, -34, 0, 0x3f7a52);
      trafficCar('vela', 341.5, -78, 0, 0x8fa3b8);
      placePeds([[334, 8], [357, 30], [334, 52], [357, 84], [334, 108], [357, -14], [334, 44], [357, 58]]);
      missionCard('CH 7', 'The Tide Job', 2, 3, 'Escape with the cash! Lose the cops.', 'Bring the money home to Mara.', LOCATIONS.garage);
      if (G.heli) { G.heli.active = true; G.heli.tactic = 'SPOTLIGHT ON YOU'; }
      activeDialogue = ['MARA VOSS', 'FIXER', 'Lose that helicopter before you come near my garage! Switch cars, change anything!', 'mara'];
      hud.dialogue(...activeDialogue);
    },

    // On foot on the Neon Mile: Nico, a stealable Vela with its prompt up,
    // HERON-17 rolling in with its lights on, the crowd going about its day.
    foot() {
      baseSetup();
      G.hasPistol = false; G.weapon = 'fists';
      hud.refreshWeapons();
      G.time = 17.7; G.cash = 1250; G.rep = 140; G.repLevel = 1;
      G.health = 100; G.armour = 0; G.wanted = 1; G.seenByPolice = true;
      G.mode = 'foot';
      G.player.pos.set(340.5, 0, 29);
      G.player.heading = -2.2;
      G.player.mesh.position.copy(G.player.pos);
      G.player.mesh.rotation.y = -2.2;
      const vela = spawnCar('vela', 349.5, 25, Math.PI, 0xb9bdc4);
      vela.driver = null;
      G.cars.push(vela);
      trafficCar('serrano', 349, -34, Math.PI, 0xc7a23a);
      trafficCar('vela', 341.5, 92, 0, 0x2e5f8a);
      policeUnit(347, -2, Math.PI, 'HERON-17', 'PURSUIT');
      placePeds([[356, 38], [337, 44], [356, -16], [337, 8], [356, 64], [337, 58], [356, 12]]);
      missionCard('CH 2', 'Package Run', 0, 3, 'Go to the Portside warehouse.', 'The package is by the freight doors.', LOCATIONS.warehouse);
      hud.setPrompt('<b>F</b> — Take the VELA');
    },

    // Dusk on the causeway: two units parked across the road ahead, a third
    // coming up behind to ram, the island skyline beyond the block.
    roadblock() {
      baseSetup();
      G.time = 17.45; G.cash = 6930; G.rep = 880; G.repLevel = 2;
      G.health = 91; G.armour = 25; G.wanted = 3; G.seenByPolice = true;
      drivingPose('serrano', 430, -270, Math.PI / 2, 0xd4692a, 23, 78);
      policeUnit(450, -273.8, 0.15, 'KESTREL-31', 'ROADBLOCK');
      policeUnit(454, -266.2, -0.15, 'IBIS-43', 'ROADBLOCK');
      policeUnit(396, -267.2, Math.PI / 2, 'MARLIN-11', 'RAMMING');
      trafficCar('vela', 528, -266.2, Math.PI / 2, 0xd8d4cc);
      missionCard('CH 4', 'Causeway Cash', 2, 3, "Bring the case to Mara's garage.", 'Do not stop for the roadblocks.', LOCATIONS.garage);
      activeDialogue = ['MARA VOSS', 'FIXER', 'Roadblock on the causeway, Nico — ram through or swim.', 'mara'];
      hud.dialogue(...activeDialogue);
    },

    // Night on the Mile: two units searching with their headlights up the
    // road, lit hotel windows, the city gone blue.
    night() {
      baseSetup();
      G.time = 22.55; G.cash = 3210; G.rep = 1040; G.repLevel = 3;
      G.health = 100; G.armour = 40; G.wanted = 2; G.seenByPolice = false;
      drivingPose('cabrillo', 347, 14, Math.PI, 0x2a5aa8, 11, 88);
      policeUnit(352, -28, 0, 'TARPON-18', 'SEARCHING');
      policeUnit(339, -58, 0.3, 'HERON-17', 'SEARCHING');
      trafficCar('vela', 341, -88, 0, 0x6a4a7a);
      trafficCar('serrano', 352.5, 74, Math.PI, 0x37414f);
      placePeds([[334, 30], [356, -14], [334, -52], [356, 44], [334, -6]]);
      missionCard('CH 5', 'Neon Debt', 1, 3, 'Put both debtors on the sand.', 'Fists only — keep it friendly.', LOCATIONS.beachHut);
      activeDialogue = ['MARA VOSS', 'FIXER', 'They are at the hut, laughing about my money. Go take the smile off.', 'mara'];
      hud.dialogue(...activeDialogue);
    },
  };

  function camBehind(camera, x, z, heading, dist, height, side) {
    camera.position.set(
      x - Math.sin(heading) * dist + Math.cos(heading) * side,
      height,
      z - Math.cos(heading) * dist - Math.sin(heading) * side,
    );
    camera.lookAt(x + Math.sin(heading) * 9, 1.3, z + Math.cos(heading) * 9);
  }

  return {
    stage(name) {
      if (!scenes[name]) return false;
      active = name;
      clearPeds();
      scenes[name]();
      return true;
    },
    // Hold the pose: lights flash, the driven wheels turn, GULL-1 hangs over
    // the chase with its rotor spinning, dialogue stays up, limbs swing.
    pin(dt, t) {
      if (!active) return;
      for (const u of G.police) if (u.kind === 'car') tickPoliceLights(u.car, t + u.car.id);
      if (activeDialogue) {
        dlgClock += dt;
        if (dlgClock > 4.4) { dlgClock = 0; hud.dialogue(...activeDialogue); }
      }
      if (playerCar) {
        const spin = (playerCar.speed * dt) / 0.36;
        for (const w of playerCar.mesh.userData.wheels) w.rotation.x += spin;
      }
      for (const ped of stagedPeds) {
        ped.walkPhase += dt * 3;
        const sw = Math.sin(ped.walkPhase) * 0.4;
        ped.mesh.userData.legL.rotation.x = sw;
        ped.mesh.userData.legR.rotation.x = -sw;
      }
      // GULL-1 low over the beach side of the boulevard, where the sky is
      // open: the airframe hangs in the sunset, spotlight pooled on the GT.
      if (active === 'chase') poseHelicopter(352, 84, 345, 64, dt, 20);
    },
    applyCamera(camera) {
      if (active === 'chase') {
        // head-on and close: the GT fills the centre at eighteen metres,
        // MARLIN-11 looms off its rear quarter, sky left open for GULL-1.
        camera.position.set(350, 3.4, 46);
        camera.lookAt(343.5, 3.2, 76);
      } else if (active === 'foot') {
        camera.position.set(337.5, 2.0, 40);
        camera.lookAt(343.5, 1.5, 20);
      } else if (active === 'roadblock') {
        camBehind(camera, 430, -270, Math.PI / 2, 10.5, 3.0, 5.5);
      } else if (active === 'night') {
        camBehind(camera, 347, 14, Math.PI, 11.5, 3.6, -3.0);
      }
    },
  };
}
