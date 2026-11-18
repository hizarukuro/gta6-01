// missions.js — Mara Voss's seven jobs, CH1 First Wheels to CH7 The Tide Job.
// A job is a short list of stages — go somewhere, steal something, deliver it,
// pick something up, lose the heat, put someone on the sand, ram a convoy —
// walked by one small state machine. The HUD card reads G.mission; finishing
// a job pays out, autosaves, and Mara calls again a few seconds later.

import { G, addCash, addRep, commitCrime } from './state.js';
import { LOCATIONS, nearestNode } from './city.js';
import { setCarColor } from './vehicles.js';
import { sfx } from './audio.js';

const L = LOCATIONS;

// Stage fields: type; label (the objective line); next (the NEXT line);
// x/z/r (a place and its arrival radius); plus type-specific extras the
// setup step fills in (the car to steal, the convoy to stop, and so on).
export const MISSIONS = [
  {
    chapter: 'CH 1', title: 'First Wheels', pay: 400, rep: 60,
    intro: ['MARA VOSS', 'FIXER', 'Nico. Wheels first, talk later. There is a grey Vela idling by the boulevard — take it, bring it to my garage.', 'mara'],
    stages: [
      { type: 'goto', x: L.garage.x, z: L.garage.z, r: 12, label: 'Meet Mara at her garage in Old Marina.', next: 'She is expecting you.' },
      { type: 'steal', model: 'vela', x: 334, z: -40, label: 'Steal the grey Vela on the Neon Mile.', next: 'Then bring it home to Mara.' },
      { type: 'deliver', x: L.garage.x, z: L.garage.z, r: 11, label: "Deliver the Vela to Mara's garage.", next: 'Cash on delivery.' },
    ],
    outro: 'Clean work. The bay is full of cars, and now one of them is ours.',
  },
  {
    chapter: 'CH 2', title: 'Package Run', pay: 650, rep: 80,
    intro: ['MARA VOSS', 'FIXER', 'A package waits at the Portside warehouse. Pick it up on foot, drop it at Club Vela. And Nico — I left you a pistol in the crate. Take it.', 'mara'],
    stages: [
      { type: 'goto', x: L.warehouse.x, z: L.warehouse.z, r: 13, label: 'Go to the Portside warehouse.', next: 'The package is by the freight doors.' },
      { type: 'pickup', x: L.warehouse.x + 14, z: L.warehouse.z + 8, r: 3.4, label: 'Pick up the package (and the pistol).', next: 'Someone may have called it in.' },
      { type: 'deliver', x: L.club.x, z: L.club.z, r: 12, anyVehicle: true, label: 'Drop the package at Club Vela.', next: 'Keep it intact.' },
    ],
    outro: 'The club sends its thanks. You shoot straighter than you park.',
  },
  {
    chapter: 'CH 3', title: 'Heat Check', pay: 800, rep: 100,
    intro: ['MARA VOSS', 'FIXER', 'Before I trust you with real money: steal the Serrano at the port, let the VMPD see you, then lose them. All the way — no stars, no pay.', 'mara'],
    stages: [
      { type: 'steal', model: 'serrano', x: -140, z: 96, label: 'Steal the Serrano pickup in Portside.', next: 'Then make some noise.' },
      { type: 'lose', stars: 2, label: 'Lose the VMPD completely.', next: 'Break line of sight and stay hidden.' },
    ],
    outro: 'Two stars and you walked away clean. All right, wheelman — real jobs now.',
  },
  {
    chapter: 'CH 4', title: 'Causeway Cash', pay: 1200, rep: 140,
    intro: ['MARA VOSS', 'FIXER', 'A case of cash sleeps at my Cayo Verde safehouse. Fetch it, bring it home. The causeway will be watched — it always is.', 'mara'],
    stages: [
      { type: 'goto', x: L.cayoHouse.x, z: L.cayoHouse.z, r: 13, label: 'Cross the causeway to Cayo Verde.', next: 'The safehouse is on the island.' },
      { type: 'pickup', x: L.cayoHouse.x + 8, z: L.cayoHouse.z + 10, r: 3.4, label: 'Take the cash case.', next: 'Expect company on the way back.', alarm: 3 },
      { type: 'deliver', x: L.garage.x, z: L.garage.z, r: 11, anyVehicle: true, label: "Bring the case to Mara's garage.", next: 'Do not stop for the roadblocks.' },
    ],
    outro: 'Counted and clean. The island money spends the same as any other.',
  },
  {
    chapter: 'CH 5', title: 'Neon Debt', pay: 1000, rep: 120,
    intro: ['MARA VOSS', 'FIXER', 'Two lifeguards at the beach hut owe me and laugh about it. Go explain compound interest. Fists are fine — I need them working, not floating.', 'mara'],
    stages: [
      { type: 'goto', x: L.beachHut.x, z: L.beachHut.z, r: 14, label: 'Find the debtors at the lifeguard hut.', next: 'They sunbathe. You educate.' },
      { type: 'fight', count: 2, x: L.beachHut.x, z: L.beachHut.z, label: 'Put both debtors on the sand.', next: 'Fists only — keep it friendly.' },
      { type: 'goto', x: L.club.x, z: L.club.z, r: 12, label: 'Report back at Club Vela.', next: "Mara's cut is waiting." },
    ],
    outro: 'They paid in full, plus a tip for the lesson. The bay respects you now.',
  },
  {
    chapter: 'CH 6', title: 'Convoy Job', pay: 1600, rep: 170,
    intro: ['MARA VOSS', 'FIXER', 'An armoured Serrano is moving money through Vista Centro. Ram it until it stops — three good hits — then take the case from the back.', 'mara'],
    stages: [
      { type: 'ram', model: 'serrano', x: 6, z: -96, label: 'Stop the armoured Serrano: ram it 3 times.', next: 'It drives the grid in Vista Centro.' },
      { type: 'pickupAt', r: 4, label: 'Take the case from the stopped truck.', next: 'Then lose any heat.' },
      { type: 'deliver', x: L.club.x, z: L.club.z, r: 12, anyVehicle: true, label: 'Deliver the case to Club Vela.', next: 'Last job before the big one.' },
    ],
    outro: 'Armour plating, meet Nico. One job left, and it is the one that matters.',
  },
  {
    chapter: 'CH 7', title: 'The Tide Job', pay: 2500, rep: 260,
    intro: ['MARA VOSS', 'FIXER', 'Tonight we take the red Cabrillo GT out of its own showroom. Every badge in the city will come. Bring it to my garage and we are rich and gone.', 'mara'],
    stages: [
      { type: 'goto', x: L.showroom.x, z: L.showroom.z, r: 13, label: 'Go to the Cabrillo showroom.', next: 'The GT is on the floor, keys in.' },
      { type: 'steal', model: 'cabrillo', x: L.showroom.x + 4, z: L.showroom.z + 20, alarm: 4, label: 'Steal the Cabrillo GT. Escape with the cash!', next: 'Lose the cops, then bring it home.' },
      { type: 'deliver', x: L.garage.x, z: L.garage.z, r: 11, label: "Bring the GT home to Mara.", next: 'Do not come near the garage with the helicopter up.' },
    ],
    outro: 'That is the tide turning, Nico. Vista Marina is ours.',
  },
];

export function createMissions(ctx) {
  const { hud, city, spawnCar, graph, save } = ctx;
  let betweenTimer = 4; // a breath between one job's end and Mara's next call

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) { G.storyDone = true; G.mission = null; return; }
    G.mission = { def, stageIndex: 0, stage: null, data: {} };
    hud.dialogue(def.intro[0], def.intro[1], def.intro[2], def.intro[3]);
    setupStage(G.mission, 0);
  }

  function setupStage(m, index) {
    m.stageIndex = index;
    const s = { ...m.def.stages[index] };
    m.stage = s;
    s.target = s.x != null ? { x: s.x, z: s.z } : null;
    if (s.type === 'steal') {
      const car = spawnCar(s.model, s.x, s.z, Math.PI / 2);
      car.driver = null;
      car.missionCar = true;
      if (s.model === 'cabrillo') setCarColor(car, 0xd21f3c); // the showroom GT is red
      G.cars.push(car);
      m.data.stealCar = car;
      s.target = { x: s.x, z: s.z };
    }
    if (s.type === 'fight') {
      m.data.downSet = new Set();
      let marked = 0;
      for (const ped of G.peds) {
        if (marked >= s.count) break;
        if (Math.hypot(ped.pos.x - s.x, ped.pos.z - s.z) < 60) {
          ped.marked = true;
          m.data['ped' + marked] = ped;
          marked++;
        }
      }
      // an empty beach is no excuse: the debtors stroll in from the boulevard
      while (marked < s.count) {
        const ped = G.peds[marked];
        if (ped) {
          ped.pos.set(s.x + 4 + marked * 3, 0, s.z + 6);
          ped.marked = true;
          m.data['ped' + marked] = ped;
        }
        marked++;
      }
    }
    if (s.type === 'ram') {
      const car = spawnCar(s.model, s.x, s.z, 0);
      car.driver = 'traffic';
      car.hp = 260; // armoured: it takes hits, it does not fold
      car.armoured = true;
      car.missionConvoy = true;
      const node = nearestNode(graph, s.x, s.z);
      car.route = { from: node.key, target: node.adj[0] };
      car.cruise = 0.55;
      G.cars.push(car);
      G.traffic.push(car);
      m.data.convoy = car;
      m.data.ramHits = 0;
      s.target = { x: car.pos.x, z: car.pos.z };
    }
    if (s.type === 'lose' && s.stars) {
      while (G.wanted < s.stars) G.wanted += 1;
      G.heat = Math.max(G.heat, 0.4);
    }
    if (s.target) city.setBeam(s.target.x, s.target.z, 0xffd94d);
    else city.hideBeam();
  }

  function completeStage(m) {
    const next = m.stageIndex + 1;
    if (next >= m.def.stages.length) { completeMission(m); return; }
    hud.toast('Objective complete.');
    sfx.blip();
    setupStage(m, next);
  }

  function completeMission(m) {
    addCash(m.def.pay);
    addRep(m.def.rep);
    G.stats.missionsDone += 1;
    G.missionIndex += 1;
    G.mission = null;
    city.hideBeam();
    hud.banner('MISSION COMPLETE', `${m.def.title} · +$${m.def.pay.toLocaleString('en-US')}`);
    hud.dialogue('MARA VOSS', 'FIXER', m.def.outro, 'mara');
    sfx.cash();
    save();
    betweenTimer = 7;
    if (G.missionIndex >= MISSIONS.length) {
      G.storyDone = true;
      setTimeout(() => hud.banner('STORY COMPLETE', 'Vista Marina is yours. Free roam — the city keeps turning.'), 3600);
    }
  }

  const distTo = (x, z) => Math.hypot(G.player.pos.x - x, G.player.pos.z - z);

  return {
    startMission,
    update(dt) {
      if (!G.mission) {
        if (!G.storyDone && G.started && G.mode !== 'menu') {
          betweenTimer -= dt;
          if (betweenTimer <= 0) startMission(G.missionIndex);
        }
        return;
      }
      const m = G.mission, s = m.stage;
      if (!s) return;
      if (s.type === 'ram' && m.data.convoy) s.target = { x: m.data.convoy.pos.x, z: m.data.convoy.pos.z };
      if (s.target) city.setBeam(s.target.x, s.target.z, 0xffd94d);
      switch (s.type) {
        case 'goto':
          if (distTo(s.x, s.z) < s.r) completeStage(m);
          break;
        case 'steal': {
          const car = m.data.stealCar;
          if (car && G.driveCar === car) {
            if (s.alarm) {
              while (G.wanted < s.alarm) G.wanted += 1;
              commitCrime(0.2, 'showroom theft');
            }
            completeStage(m);
          }
          break;
        }
        case 'deliver': {
          const inRightCar = s.anyVehicle ? true : (m.data.stealCar ? G.driveCar === m.data.stealCar : !!G.driveCar);
          if (distTo(s.x, s.z) < s.r && inRightCar) completeStage(m);
          break;
        }
        case 'pickup':
          if (G.mode === 'foot' && distTo(s.x, s.z) < s.r) {
            if (m.def.title === 'Package Run') {
              G.hasPistol = true; G.mag = 12; G.reserve = 60;
              hud.toast("Picked up: package + Mara's pistol (key 2).");
              hud.refreshWeapons();
            } else {
              hud.toast('Case secured.');
            }
            if (s.alarm) {
              while (G.wanted < s.alarm) G.wanted += 1;
              G.heat = Math.max(G.heat, 0.5);
            }
            completeStage(m);
          }
          break;
        case 'pickupAt': {
          const car = m.data.convoy;
          if (car && G.mode === 'foot' && Math.hypot(G.player.pos.x - car.pos.x, G.player.pos.z - car.pos.z) < s.r) {
            hud.toast('Case secured. Now move.');
            completeStage(m);
          }
          break;
        }
        case 'lose':
          if (G.wanted === 0) completeStage(m);
          break;
        case 'fight': {
          let down = 0, total = 0;
          for (let i = 0; i < s.count; i++) {
            const ped = m.data['ped' + i];
            if (!ped) continue;
            total++;
            if (ped.state === 'down') m.data.downSet.add(ped.id);
            if (m.data.downSet.has(ped.id)) down++;
          }
          if (total > 0 && down >= total) {
            for (let i = 0; i < s.count; i++) {
              const ped = m.data['ped' + i];
              if (ped) ped.marked = false;
            }
            completeStage(m);
          }
          break;
        }
        case 'ram': {
          const car = m.data.convoy;
          if (car && car.lastHit === G.driveCar && car.hitSpeed > 7.5) {
            car.lastHit = null;
            m.data.ramHits += 1;
            hud.toast(`Solid hit — ${m.data.ramHits}/3.`);
            if (m.data.ramHits >= 3) {
              car.dead = true; car.speed = 0; car.hp = 0;
              const ti = G.traffic.indexOf(car);
              if (ti >= 0) G.traffic.splice(ti, 1);
              hud.toast('The convoy truck is stopped!');
              completeStage(m);
            }
          }
          break;
        }
      }
    },
  };
}
