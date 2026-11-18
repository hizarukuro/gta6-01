// scenes.js — staged moments for the entry screenshots (?scene=chase|foot|
// roadblock|night). Each scene places the real actors — player car, VMPD
// units, the helicopter, pedestrians — and fills the HUD from the same state
// the game itself uses, so a screenshot is the game, posed. main.js freezes
// the simulation in scene mode and calls pin() each frame to hold the pose.

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

  // Parks every unstaged pedestrian on a far Portside sidewalk so a random
  // seed spawn can never photobomb a staged camera.
  function clearPeds() {
    G.peds.forEach((ped, i) => {
      ped.pos.set(-269 + (i % 3) * 2.2, 0, -240 + i * 17);
      ped.mesh.position.copy(ped.pos);
      ped.state = 'walk';
    });
  }

  function placePeds(list) {
    stagedPeds = [];
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

  const scenes = {
    chase() {
      baseSetup();
      G.time = 17.35; G.cash = 18450; G.rep = 1620; G.repLevel = 4;
      G.health = 82; G.armour = 64; G.wanted = 4; G.seenByPolice = true;
      playerCar = spawnCar('cabrillo', 345, 62, Math.PI, 0xd21f3c);
      playerCar.driver = 'player'; playerCar.speed = 41; playerCar.hp = 61;
      G.cars.push(playerCar);
      G.driveCar = playerCar;
      G.mode = 'car';
      G.player.mesh.visible = false;
      G.player.pos.set(345, 0, 62);
      policeUnit(341.5, 81, Math.PI, 'MARLIN-11', 'RAMMING');
      policeUnit(350.5, 93, Math.PI, 'SNAPPER-25', 'PURSUIT');
      policeUnit(337, 112, Math.PI, 'TARPON-18', 'PURSUIT');
      trafficCar('vela', 352, 112, Math.PI, 0xe8e8e8);
      trafficCar('serrano', 341, -64, 0, 0x3f7a52);
      placePeds([[334, 20], [357, 44], [334, 96], [357, -8]]);
      missionCard('CH 7', 'The Tide Job', 2, 3, 'Escape with the cash! Lose the cops.', 'Bring the money home to Mara.', LOCATIONS.garage);
      if (G.heli) { G.heli.active = true; G.heli.tactic = 'SPOTLIGHT ON YOU'; }
      hud.onEnterCar(playerCar);
      activeDialogue = ['MARA VOSS', 'FIXER', 'Lose that helicopter before you come near my garage! Switch cars, change anything!', 'mara'];
      hud.dialogue(...activeDialogue);
    },

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
      placePeds([[356, 38], [337, 44], [356, -16], [337, 8], [356, 64]]);
      missionCard('CH 2', 'Package Run', 0, 3, 'Go to the Portside warehouse.', 'The package is by the freight doors.', LOCATIONS.warehouse);
      hud.setPrompt('<b>F</b> — Take the VELA');
    },

    roadblock() {
      baseSetup();
      G.time = 17.45; G.cash = 6930; G.rep = 880; G.repLevel = 2;
      G.health = 91; G.armour = 25; G.wanted = 3; G.seenByPolice = true;
      playerCar = spawnCar('serrano', 430, -270, Math.PI / 2, 0xd4692a);
      playerCar.driver = 'player'; playerCar.speed = 23; playerCar.hp = 78;
      G.cars.push(playerCar);
      G.driveCar = playerCar;
      G.mode = 'car';
      G.player.mesh.visible = false;
      G.player.pos.set(430, 0, -270);
      policeUnit(480, -273.6, 0.15, 'KESTREL-31', 'ROADBLOCK');
      policeUnit(480, -266.4, -0.15, 'IBIS-43', 'ROADBLOCK');
      policeUnit(384, -266.8, Math.PI / 2, 'MARLIN-11', 'RAMMING');
      missionCard('CH 4', 'Causeway Cash', 2, 3, 'Bring the case to Mara\'s garage.', 'Do not stop for the roadblocks.', LOCATIONS.garage);
      hud.onEnterCar(playerCar);
      activeDialogue = ['MARA VOSS', 'FIXER', 'Roadblock on the causeway, Nico — ram through or swim.', 'mara'];
      hud.dialogue(...activeDialogue);
    },

    night() {
      baseSetup();
      G.time = 22.55; G.cash = 3210; G.rep = 1040; G.repLevel = 3;
      G.health = 100; G.armour = 40; G.wanted = 2; G.seenByPolice = false;
      playerCar = spawnCar('cabrillo', 347, 14, Math.PI, 0x2a5aa8);
      playerCar.driver = 'player'; playerCar.speed = 11; playerCar.hp = 88;
      G.cars.push(playerCar);
      G.driveCar = playerCar;
      G.mode = 'car';
      G.player.mesh.visible = false;
      G.player.pos.set(347, 0, 14);
      policeUnit(352, -28, 0, 'TARPON-18', 'SEARCHING');
      policeUnit(339, -58, 0.3, 'HERON-17', 'SEARCHING');
      trafficCar('vela', 341, -88, 0, 0x6a4a7a);
      placePeds([[334, 30], [356, -14], [334, -52]]);
      missionCard('CH 5', 'Neon Debt', 1, 3, 'Put both debtors on the sand.', 'Fists only — keep it friendly.', LOCATIONS.beachHut);
      hud.onEnterCar(playerCar);
      activeDialogue = ['MARA VOSS', 'FIXER', 'They are at the hut, laughing about my money. Go take the smile off.', 'mara'];
      hud.dialogue(...activeDialogue);
    },
  };

  function camBehind(camera, x, z, heading, dist, height, side) {
    const bx = x - Math.sin(heading) * dist + Math.cos(heading) * side;
    const bz = z - Math.cos(heading) * dist - Math.sin(heading) * side;
    camera.position.set(bx, height, bz);
    camera.lookAt(x + Math.sin(heading) * 9, 1.3, z + Math.cos(heading) * 9);
  }

  return {
    stage(name) {
      if (!scenes[name]) return false;
      active = name;
      scenes[name]();
      return true;
    },
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
      if (active === 'chase') poseHelicopter(354, 96, 345, 62, dt, 35);
      if (active === 'foot') {
        for (const ped of stagedPeds) {
          ped.walkPhase += dt * 3;
          const sw = Math.sin(ped.walkPhase) * 0.4;
          ped.mesh.userData.legL.rotation.x = sw;
          ped.mesh.userData.legR.rotation.x = -sw;
        }
      }
    },
    applyCamera(camera) {
      if (active === 'chase') {
        // head-on: the GT races at the camera, the whole response behind it
        camera.position.set(350.5, 4.6, 40);
        camera.lookAt(343, 1.4, 74);
      }
      else if (active === 'foot') { camera.position.set(337.5, 2.0, 40); camera.lookAt(343.5, 1.5, 20); }
      else if (active === 'roadblock') camBehind(camera, 430, -270, Math.PI / 2, 12.5, 3.6, 4.5);
      else if (active === 'night') camBehind(camera, 347, 14, Math.PI, 11.5, 3.6, -3.0);
    },
  };
}
