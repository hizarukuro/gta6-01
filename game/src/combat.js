// combat.js — Nico's hands and Mara's pistol. Shooting is hitscan along his
// facing with a tracer and a muzzle flash; punching is short, rude and close.
// Both make noise, and noise is a crime the VMPD can hear: every shot and
// scuffle feeds the wanted heat.

import * as THREE from 'three';
import { G, commitCrime } from './state.js';
import { damageCar } from './vehicles.js';
import { hurtPed, scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';

let tracer = null, flash = null, flashLife = 0;

export function initCombat(scene) {
  tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }),
  );
  scene.add(tracer);
  flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0 }),
  );
  scene.add(flash);
}

export function setWeapon(G, hud, weapon) {
  if (weapon === 'pistol' && !G.hasPistol) { hud.toast('No pistol yet. Mara provides.'); return; }
  G.weapon = weapon;
  const u = G.player.mesh.userData;
  u.gun.visible = weapon === 'pistol';
  u.armR.rotation.x = weapon === 'pistol' ? -1.3 : 0;
  hud.refreshWeapons();
}

export function startReload(G, hud) {
  if (G.weapon !== 'pistol' || G.reloading > 0 || G.mag >= 12 || G.reserve <= 0) return;
  G.reloading = 1.1;
  sfx.reload();
  hud.toast('Reloading…');
}

const _from = new THREE.Vector3(), _to = new THREE.Vector3();

function shoot(G, hud) {
  const p = G.player;
  G.mag -= 1;
  sfx.shot();
  scarePeds(G, p.pos.x, p.pos.z, 30);
  commitCrime(0.45, 'shots fired');
  const dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
  _from.set(p.pos.x + dirX * 0.5, 1.35, p.pos.z + dirZ * 0.5);
  // nearest target along the shot line wins, pedestrian or car
  let bestT = 46, hitPed = null, hitCar = null;
  const test = (x, z, radius, obj, isPed) => {
    const rx = x - p.pos.x, rz = z - p.pos.z;
    const t = rx * dirX + rz * dirZ;
    if (t < 1 || t > bestT) return;
    const px = p.pos.x + dirX * t, pz = p.pos.z + dirZ * t;
    if (Math.hypot(px - x, pz - z) < radius) {
      bestT = t;
      if (isPed) { hitPed = obj; hitCar = null; } else { hitCar = obj; hitPed = null; }
    }
  };
  for (const ped of G.peds) if (ped.state !== 'down') test(ped.pos.x, ped.pos.z, 0.55, ped, true);
  for (const car of G.cars) if (!car.dead) test(car.pos.x, car.pos.z, 2.1, car, false);
  _to.set(p.pos.x + dirX * bestT, 1.3, p.pos.z + dirZ * bestT);
  tracer.geometry.setFromPoints([_from, _to]);
  tracer.material.opacity = 0.95;
  flash.position.copy(_from);
  flash.material.opacity = 0.95;
  flashLife = 0.07;
  if (hitPed) {
    hurtPed(hitPed, 34);
    if (hitPed.state === 'down') commitCrime(0.5, 'assault');
  }
  if (hitCar) {
    damageCar(hitCar, 9, null);
    if (hitCar.driver === 'police') commitCrime(0.6, 'shot at police');
  }
  if (G.mag === 0) hud.toast('Magazine empty — R to reload.');
  hud.refreshWeapons();
}

function punch(G, hud) {
  const p = G.player;
  sfx.punch();
  const u = p.mesh.userData;
  u.armR.rotation.x = -1.9;
  setTimeout(() => { if (G.weapon !== 'pistol') u.armR.rotation.x = 0; }, 130);
  const fx = p.pos.x + Math.sin(p.heading) * 1.4;
  const fz = p.pos.z + Math.cos(p.heading) * 1.4;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.pos.x - fx, ped.pos.z - fz) < 1.3) {
      hurtPed(ped, 13);
      commitCrime(0.3, 'assault');
      scarePeds(G, p.pos.x, p.pos.z, 10);
      return;
    }
  }
  for (const car of G.cars) {
    if (!car.dead && Math.hypot(car.pos.x - fx, car.pos.z - fz) < 2.6) {
      damageCar(car, 4, null);
      commitCrime(0.18, 'vandalism');
      return;
    }
  }
}

// Per-frame while on foot: reload bookkeeping, tracer fade, and the click.
export function updateCombat(G, dt, hud, clicked) {
  if (flashLife > 0) {
    flashLife -= dt;
    if (flashLife <= 0) { tracer.material.opacity = 0; flash.material.opacity = 0; }
  }
  if (G.reloading > 0) {
    G.reloading -= dt;
    if (G.reloading <= 0) {
      const take = Math.min(12 - G.mag, G.reserve);
      G.mag += take;
      G.reserve -= take;
      hud.refreshWeapons();
    }
    return;
  }
  if (!clicked || G.player.attackCd > 0 || G.mode !== 'foot') return;
  if (G.weapon === 'pistol') {
    if (G.mag <= 0) { startReload(G, hud); return; }
    G.player.attackCd = 0.24;
    shoot(G, hud);
  } else {
    G.player.attackCd = 0.38;
    punch(G, hud);
  }
}
