// player.js — Nico Ferreira himself: the on-foot body, third-person camera,
// walking and driving, stealing cars, taking damage, and coming back from
// the hospital or the station. Fate flow (overlays, timers) lives in main.js;
// this module only moves the man and reports state.
import * as THREE from "three";
import {
  G, PLACES, clamp, angNorm, angLerp, collideWorld, isLand, dist2D, RADIO_STATIONS,
} from "./state.js";
import { stepCar } from "./vehicles.js";
import { keys, wasPressed, consumeMouse } from "./input.js";
import { raiseHeat, detachUnit } from "./police.js";
import { setEngine, sfx } from "./audio.js";

let scene = null, camera = null, mesh = null;
let camYaw = Math.PI, camPitch = 0.32;
const camPos = new THREE.Vector3(200, 8, 90);
let parts = null;

export function initPlayer(s, cam) {
  scene = s; camera = cam;
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0f766e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68863 });
  const denim = new THREE.MeshLambertMaterial({ color: 0x2b3444 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.26), jacket);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 9, 8), skin);
  head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.09, 9),
    new THREE.MeshLambertMaterial({ color: 0x14161c }));
  cap.position.y = 1.76; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.18), denim);
  legL.position.set(-0.13, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.14), jacket);
  armL.position.set(-0.32, 1.06, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.32; g.add(armR);
  parts = { legL, legR, armL, armR };
  mesh = g;
  mesh.position.set(G.player.x, 0, G.player.z);
  scene.add(mesh);
  camera.position.copy(camPos);
}

export function entryCandidate() {
  if (G.player.car) return null;
  let best = null, bd = 3.8;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist2D(car.x, car.z, G.player.x, G.player.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  p.car = car;
  car.driver = "player";
  car.parked = false;
  detachUnit(car);
  mesh.visible = false;
  if (car.model === "interceptor") raiseHeat(0.8);
  else raiseHeat(0.55);
  sfx("door");
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  if (Math.abs(car.speed) < 2) { car.parked = true; car.speed = 0; }
  p.car = null;
  const side = car.heading + Math.PI / 2;
  p.x = car.x + Math.sin(side) * 2.2;
  p.z = car.z + Math.cos(side) * 2.2;
  const res = collideWorld(p.x, p.z, 0.45);
  p.x = res.x; p.z = res.z;
  p.heading = car.heading;
  mesh.visible = true;
  setEngine(false, 0);
  sfx("door");
}

export function hurtPlayer(dmg) {
  const p = G.player;
  if (p.dead || G.mode !== "play") return;
  let rest = dmg;
  if (p.armour > 0) {
    const soaked = Math.min(p.armour, dmg * 0.6);
    p.armour -= soaked; rest = dmg - soaked;
  }
  p.health -= rest;
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}

export function respawn(kind) {
  const p = G.player;
  if (p.car) { p.car.driver = null; p.car.parked = true; p.car = null; }
  const spot = kind === "busted" ? PLACES.station : PLACES.hospital;
  p.x = spot.x; p.z = spot.z;
  p.health = kind === "busted" ? Math.max(45, p.health) : 100;
  p.armour = 0; p.bust = 0; p.dead = false; p.bustedFlag = false;
  mesh.visible = true;
  camYaw = Math.PI;
  setEngine(false, 0);
}

export function setCamPose(x, y, z, lx, ly, lz) {
  camera.position.set(x, y, z);
  camera.lookAt(lx, ly, lz);
}

export function setMeshVisible(v) { if (mesh) mesh.visible = v; }
export function syncPlayerMesh() {
  if (!mesh) return;
  mesh.position.set(G.player.x, 0, G.player.z);
  mesh.rotation.y = G.player.heading;
}

let walkPhase = 0;
export function updatePlayer(dt) {
  const p = G.player;
  const m = consumeMouse();
  if (!G.camLock && G.mode === "play") {
    camYaw -= m.dx * 0.0026;
    camPitch = clamp(camPitch + m.dy * 0.0022, -0.12, 1.05);
  }

  if (p.car) {
    // ----- driving -----
    const car = p.car;
    let throttle = 0, steer = 0;
    if (keys.KeyW || keys.ArrowUp) throttle = 1;
    if (keys.KeyS || keys.ArrowDown) throttle = -1;
    if (keys.KeyA || keys.ArrowLeft) steer = 1;
    if (keys.KeyD || keys.ArrowRight) steer = -1;
    if (keys.Space) { car.speed -= car.speed * 3.2 * dt; throttle = 0; }
    stepCar(car, throttle, steer, dt);
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    setEngine(true, Math.abs(car.speed) / car.spec.top);
    if (wasPressed("KeyF")) exitCar();
    if (wasPressed("KeyC")) { G.radioIdx = (G.radioIdx + 1) % RADIO_STATIONS.length; sfx("blip"); }
    // chase camera
    if (!G.camLock) {
      const back = 9.6, up = 3.6;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const tx = car.x - fx * back, tz = car.z - fz * back;
      camPos.x += (tx - camPos.x) * Math.min(1, dt * 5);
      camPos.z += (tz - camPos.z) * Math.min(1, dt * 5);
      camPos.y += (up - camPos.y) * Math.min(1, dt * 5);
      camera.position.copy(camPos);
      camera.lookAt(car.x + fx * 7, 1.4, car.z + fz * 7);
    }
    return;
  }

  // ----- on foot -----
  setEngine(false, 0);
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;
  if (keys.KeyS || keys.ArrowDown) iz += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  const moving = (ix !== 0 || iz !== 0) && G.mode === "play" && !p.dead;
  if (moving) {
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    // forward = (sin, cos); right = (-cos, sin); W sets iz = -1.
    let mx = (-iz * sin - ix * cos), mz = (-iz * cos + ix * sin);
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const spd = keys.ShiftLeft || keys.ShiftRight ? 7.4 : 4.6;
    let nx = p.x + mx * spd * dt;
    let nz = p.z + mz * spd * dt;
    if (!isLand(nx, nz)) {
      if (isLand(nx, p.z)) nz = p.z;
      else if (isLand(p.x, nz)) nx = p.x;
      else { nx = p.x; nz = p.z; }
    }
    const res = collideWorld(nx, nz, 0.45);
    p.x = res.x; p.z = res.z;
    p.heading = angLerp(p.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
    walkPhase += dt * spd * 1.9;
  }
  const sw = moving ? Math.sin(walkPhase) * 0.55 : 0;
  parts.legL.rotation.x = sw; parts.legR.rotation.x = -sw;
  parts.armL.rotation.x = -sw * 0.75; parts.armR.rotation.x = sw * 0.75;
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.heading;

  if (G.mode === "play" && wasPressed("KeyF")) {
    const cand = entryCandidate();
    if (cand) enterCar(cand);
  }

  // orbit camera
  if (!G.camLock) {
    const dist = 6.8;
    const cx = p.x - Math.sin(camYaw) * Math.cos(camPitch) * dist;
    const cz = p.z - Math.cos(camYaw) * Math.cos(camPitch) * dist;
    const cy = 1.7 + Math.sin(camPitch) * dist;
    camPos.x += (cx - camPos.x) * Math.min(1, dt * 9);
    camPos.z += (cz - camPos.z) * Math.min(1, dt * 9);
    camPos.y += (cy - camPos.y) * Math.min(1, dt * 9);
    camera.position.copy(camPos);
    camera.lookAt(p.x, 1.55, p.z);
  }
}
