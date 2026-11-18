// combat.js — fists and the pistol. Melee is a short arc in front of Nico;
// the pistol is a hitscan along the camera's aim with tracers, a muzzle
// flash, ammo and reload. Shots and violence feed the wanted system.
import * as THREE from "three";
import { G, clamp, dist2D } from "./state.js";
import { consumeAttack, wasPressed } from "./input.js";
import { hurtPed } from "./pedestrians.js";
import { damageCar } from "./vehicles.js";
import { raiseHeat } from "./police.js";
import { sfx } from "./audio.js";

let scene = null, camera = null;
let cool = 0, flash = null;
const tracers = [];
const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _to = new THREE.Vector3();

export function initCombat(s, cam) {
  scene = s; camera = cam;
  flash = new THREE.PointLight(0xffc46b, 0, 13);
  scene.add(flash);
}

function tracer(x1, y1, z1, x2, y2, z2, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  scene.add(line);
  tracers.push({ line, life: 0.06 });
}

function startReload() {
  const p = G.player;
  if (p.reloadT > 0 || p.ammo >= 8 || p.reserve <= 0) return;
  p.reloadT = 1.1;
  sfx("reload");
}

export function updateCombat(dt) {
  const p = G.player;
  cool = Math.max(0, cool - dt);
  if (flash) flash.intensity = Math.max(0, flash.intensity - dt * 60);
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  if (G.mode !== "play" || p.dead) return;

  if (wasPressed("Digit1")) { p.weapon = "fists"; sfx("blip"); }
  if (wasPressed("Digit2")) { p.weapon = "pistol"; sfx("blip"); }
  if (wasPressed("KeyR")) startReload();
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const take = Math.min(8 - p.ammo, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
    return;
  }
  if (!consumeAttack() || cool > 0 || p.car) return;

  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  if (p.weapon === "fists") {
    cool = 0.38;
    sfx("swing");
    let hit = false;
    for (const ped of G.peds) {
      if (ped.state === "down") continue;
      const d = dist2D(ped.x, ped.z, p.x, p.z);
      if (d < 2.0) {
        const dot = ((ped.x - p.x) * fx + (ped.z - p.z) * fz) / (d || 1);
        if (dot > 0.25) { hurtPed(ped, 13); hit = true; }
      }
    }
    for (const car of G.cars) {
      if (dist2D(car.x, car.z, p.x, p.z) < car.spec.len * 0.5 + 1.2) { damageCar(car, 1.5); hit = true; }
    }
    if (hit) { sfx("punch"); raiseHeat(0.3); }
    return;
  }

  // pistol
  if (p.ammo <= 0) { sfx("click"); startReload(); cool = 0.3; return; }
  cool = 0.24;
  p.ammo -= 1;
  sfx("shot");
  raiseHeat(0.34);
  camera.getWorldDirection(_dir);
  _origin.set(p.x, 1.45, p.z);
  const muzzle = { x: p.x + _dir.x * 0.5, z: p.z + _dir.z * 0.5 };
  let bestT = 65, hitPoint = null, hitPed = null, hitCar = null;
  for (const ped of G.peds) {
    if (ped.state === "down") continue;
    _to.set(ped.x - _origin.x, 1.15 - _origin.y, ped.z - _origin.z);
    const t = _to.dot(_dir);
    if (t < 0 || t > bestT) continue;
    const perp = Math.sqrt(Math.max(0, _to.lengthSq() - t * t));
    if (perp < 0.85) { bestT = t; hitPed = ped; hitCar = null; }
  }
  for (const car of G.cars) {
    if (car.dead || car === p.car) continue;
    _to.set(car.x - _origin.x, 0.8 - _origin.y, car.z - _origin.z);
    const t = _to.dot(_dir);
    if (t < 0 || t > bestT) continue;
    const perp = Math.sqrt(Math.max(0, _to.lengthSq() - t * t));
    if (perp < car.spec.len * 0.42) { bestT = t; hitCar = car; hitPed = null; }
  }
  hitPoint = {
    x: _origin.x + _dir.x * bestT, y: _origin.y + _dir.y * bestT, z: _origin.z + _dir.z * bestT,
  };
  tracer(muzzle.x, 1.42, muzzle.z, hitPoint.x, hitPoint.y, hitPoint.z, 0xffe2a8);
  flash.position.set(hitPoint.x, hitPoint.y + 0.4, hitPoint.z);
  flash.intensity = 2.6;
  if (hitPed) { hurtPed(hitPed, 34); if (hitPed.state === "down") raiseHeat(0.5); }
  if (hitCar) { damageCar(hitCar, 6); sfx("clank"); }
  if (p.ammo === 0) startReload();
}
