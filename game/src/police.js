// police.js — the VMPD: interceptor units that spawn with the wanted level,
// pursuit steering with ramming, static roadblocks from 3 stars, a helicopter
// with a spotlight from 4 stars, and the sight/search model that lets a
// careful driver cool the heat down.

import * as THREE from 'three';
import { G, clearWanted } from './state.js';
import { nearestNode } from './city.js';
import { stepCar, tickPoliceLights } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

const CALLSIGNS = ['MARLIN-11', 'SNAPPER-25', 'TARPON-18', 'HERON-17', 'KESTREL-31', 'IBIS-43', 'BONITO-7'];
const WANTED_UNITS = [0, 2, 3, 4, 5, 6];
const _input = { throttle: 0, steer: 0, brake: false, reverse: false, handbrake: false };

let heliMesh = null, rotor = null, spotCone = null, spotLight = null, spotDisc = null;
let roadblockCooldown = 0;
let tracerPool = [], tracerIdx = 0;

export function buildHelicopter(scene) {
  heliMesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 4.6), new THREE.MeshPhongMaterial({ color: 0x1d2735, shininess: 60 }));
  body.position.y = 0; body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), body.material);
  tail.position.set(0, 0.25, -3.8);
  rotor = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.08, 0.7), new THREE.MeshBasicMaterial({ color: 0x11131a }));
  rotor.position.y = 1.15;
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 3.4), body.material);
  skidL.position.set(-1.1, -1.05, 0);
  const skidR = skidL.clone(); skidR.position.x = 1.1;
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff6cf }));
  lampMesh.position.set(0, -0.95, 1.4);
  heliMesh.add(body, tail, rotor, skidL, skidR, lampMesh);
  heliMesh.visible = false;
  scene.add(heliMesh);
  // spotlight: fake cone + real light + ground disc
  const coneGeo = new THREE.ConeGeometry(8.5, 58, 20, 1, true);
  spotCone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b8, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spotCone.visible = false;
  scene.add(spotCone);
  spotLight = new THREE.SpotLight(0xfff2cf, 0, 130, 0.32, 0.5, 0.6);
  scene.add(spotLight); scene.add(spotLight.target);
  spotDisc = new THREE.Mesh(new THREE.CircleGeometry(10, 20), new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.16, depthWrite: false }));
  spotDisc.rotation.x = -Math.PI / 2;
  spotDisc.visible = false;
  scene.add(spotDisc);
  // tracer pool for police gunfire
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0 }),
    );
    scene.add(line);
    tracerPool.push({ line, life: 0 });
  }
  G.heli = { callsign: 'GULL-1', tactic: 'PURSUIT', active: false };
  return G.heli;
}

// Poses the helicopter for staged screenshots (updatePolice flies it live).
export function poseHelicopter(x, z, tx, tz, dt, height = 52) {
  if (!heliMesh) return;
  heliMesh.visible = true;
  spotCone.visible = true; spotDisc.visible = true;
  heliMesh.position.set(x, height, z);
  heliMesh.rotation.y = Math.atan2(tx - x, tz - z);
  rotor.rotation.y += dt * 28;
  spotCone.position.set((x + tx) / 2, height / 2, (z + tz) / 2);
  spotCone.lookAt(tx, 0, tz);
  spotCone.rotateX(Math.PI / 2);
  spotLight.position.set(x, height, z);
  spotLight.target.position.set(tx, 0, tz);
  spotLight.intensity = 900;
  spotDisc.position.set(tx, 0.15, tz);
}

function spawnUnit(G, graph, spawnCarFn, playerPos) {
  const used = new Set(G.police.filter((u) => u.kind === 'car').map((u) => u.callsign));
  const callsign = CALLSIGNS.find((c) => !used.has(c)) || 'UNIT-' + Math.floor(Math.random() * 90 + 10);
  // spawn at a graph node a good distance away, biased to the player's heading
  let best = null;
  for (let tries = 0; tries < 14; tries++) {
    const nodes = [...graph.nodes.values()];
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    const d = Math.hypot(n.x - playerPos.x, n.z - playerPos.z);
    if (d > 95 && d < 230) { best = n; break; }
    if (!best || Math.abs(d - 150) < Math.abs(Math.hypot(best.x - playerPos.x, best.z - playerPos.z) - 150)) best = n;
  }
  const car = spawnCarFn('interceptor', best.x, best.z, Math.random() * Math.PI * 2);
  car.driver = 'police';
  const unit = { kind: 'car', car, callsign, tactic: 'PURSUIT', state: 'chase', shootCd: Math.random() * 2 };
  car.unit = unit;
  G.cars.push(car);
  G.police.push(unit);
  return unit;
}

function removeUnit(G, unit) {
  const ci = G.cars.indexOf(unit.car);
  if (ci >= 0) G.cars.splice(ci, 1);
  const pi = G.police.indexOf(unit);
  if (pi >= 0) G.police.splice(pi, 1);
  unit.car.mesh.parent?.remove(unit.car.mesh);
  if (unit.car.smoke) unit.car.smoke.parent?.remove(unit.car.smoke);
}

function steerToward(car, tx, tz, dt, aggression) {
  const dx = tx - car.pos.x, dz = tz - car.pos.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  _input.steer = Math.max(-1, Math.min(1, diff * 1.9));
  const dist = Math.hypot(dx, dz);
  _input.throttle = dist > 4 ? 1 : 0.2;
  _input.brake = false;
  _input.reverse = false;
  if (Math.abs(diff) > 2.4 && dist < 14) { _input.reverse = true; _input.throttle = -0.8; }
  // ram: full send when lined up behind the target
  if (aggression && Math.abs(diff) < 0.35 && dist < 30) _input.throttle = 1;
  return dist;
}

export function updatePolice(G, graph, dt, colliders, spawnCarFn, player) {
  const pPos = player.pos;
  const wantCars = WANTED_UNITS[G.wanted] || 0;
  const carUnits = G.police.filter((u) => u.kind === 'car');
  // spawn / despawn to match the wanted level
  if (G.wanted > 0 && carUnits.length < wantCars) spawnUnit(G, graph, spawnCarFn, pPos);
  for (const u of [...carUnits]) {
    const d = Math.hypot(u.car.pos.x - pPos.x, u.car.pos.z - pPos.z);
    if ((G.wanted === 0 && d > 60) || d > 420) removeUnit(G, u);
  }
  if (G.wanted === 0 && G.police.length) {
    for (const u of [...G.police]) if (u.kind === 'car') removeUnit(G, u);
  }

  // ---- sight model
  let seen = false;
  for (const u of G.police) {
    if (u.kind !== 'car' || u.car.dead) continue;
    const d = Math.hypot(u.car.pos.x - pPos.x, u.car.pos.z - pPos.z);
    if (d < 95) seen = true;
  }
  if (G.heli?.active) {
    const d = Math.hypot(heliMesh.position.x - pPos.x, heliMesh.position.z - pPos.z);
    if (d < 120) seen = true;
  }
  G.seenByPolice = seen;
  if (seen) { G.searchTimer = 0; G.lastSeen = { x: pPos.x, z: pPos.z }; }
  else if (G.wanted > 0) {
    G.searchTimer += dt;
    if (G.searchTimer > 7) { // heat cools: lose a star, restart the search clock
      G.wanted -= 1;
      G.heat = 0;
      G.searchTimer = 0;
      if (G.wanted <= 0) clearWanted();
    }
  }

  // ---- helicopter
  const heliOn = G.wanted >= 4;
  if (G.heli) G.heli.active = heliOn;
  if (heliMesh) {
    heliMesh.visible = heliOn;
    spotCone.visible = heliOn; spotDisc.visible = heliOn;
    if (heliOn) {
      const t = performance.now() / 1000;
      const hx = pPos.x + Math.sin(t * 0.35) * 26;
      const hz = pPos.z + Math.cos(t * 0.35) * 26;
      heliMesh.position.set(hx, 52, hz);
      heliMesh.rotation.y = Math.atan2(pPos.x - hx, pPos.z - hz);
      rotor.rotation.y += dt * 28;
      spotCone.position.set((hx + pPos.x) / 2, 26, (hz + pPos.z) / 2);
      spotCone.lookAt(pPos.x, 0, pPos.z);
      spotCone.rotateX(Math.PI / 2);
      spotLight.position.set(hx, 52, hz);
      spotLight.target.position.set(pPos.x, 0, pPos.z);
      spotLight.intensity = 900;
      spotDisc.position.set(pPos.x, 0.15, pPos.z);
      G.heli.tactic = seen ? 'SPOTLIGHT ON YOU' : 'SEARCHING';
    } else {
      spotLight.intensity = 0;
    }
  }

  // ---- roadblocks at 3+ stars
  roadblockCooldown -= dt;
  if (G.wanted >= 3 && roadblockCooldown <= 0 && G.driveCar) {
    const aheadX = pPos.x + Math.sin(G.driveCar.heading) * 105;
    const aheadZ = pPos.z + Math.cos(G.driveCar.heading) * 105;
    const node = nearestNode(graph, aheadX, aheadZ);
    const blockers = G.police.filter((u) => u.kind === 'car' && !u.car.dead).slice(0, 2);
    if (blockers.length && Math.hypot(node.x - pPos.x, node.z - pPos.z) > 60) {
      blockers.forEach((u, i) => {
        u.state = 'roadblock';
        u.tactic = 'ROADBLOCK';
        u.car.pos.set(node.x + (i === 0 ? -3.4 : 3.4), 0, node.z + (i === 0 ? 2 : -2));
        u.car.heading = G.driveCar.heading + Math.PI / 2;
        u.car.speed = 0;
      });
      roadblockCooldown = 26;
    }
  }

  // ---- drive each unit
  const tNow = performance.now() / 1000;
  for (const u of G.police) {
    if (u.kind !== 'car') continue;
    const car = u.car;
    tickPoliceLights(car, tNow + car.id);
    if (car.dead) { u.tactic = 'DISABLED'; continue; }
    const distP = Math.hypot(car.pos.x - pPos.x, car.pos.z - pPos.z);
    if (u.state === 'roadblock') {
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      if (distP < 34) { u.state = 'chase'; u.tactic = 'PURSUIT'; }
      continue;
    }
    const goal = seen || !G.lastSeen ? pPos : G.lastSeen;
    // intercept: aim ahead of a moving target
    const lead = G.driveCar ? Math.min(1.1, distP / 60) : 0.3;
    const tx = goal.x + (G.driveCar ? Math.sin(G.driveCar.heading) * G.driveCar.speed * lead : 0);
    const tz = goal.z + (G.driveCar ? Math.cos(G.driveCar.heading) * G.driveCar.speed * lead : 0);
    steerToward(car, tx, tz, dt, true);
    u.tactic = !seen ? 'SEARCHING' : (distP < 26 ? 'RAMMING' : 'PURSUIT');
    stepCar(car, _input, dt, colliders, G.cars);
    // gunfire at 3+ stars when close and the player is exposed
    u.shootCd -= dt;
    if (G.wanted >= 3 && distP < 34 && distP > 7 && u.shootCd <= 0 && seen) {
      u.shootCd = 1.1 + Math.random() * 1.4;
      fireTracer(car.pos, pPos);
      if (Math.random() < 0.55) player.hurt(G.driveCar ? 2.2 : 4.5, 'shot');
      scarePeds(G, pPos.x, pPos.z, 26);
    }
  }
  for (const tr of tracerPool) {
    if (tr.life > 0) { tr.life -= dt; tr.line.material.opacity = Math.max(0, tr.life * 6); }
  }
}

const _from = new THREE.Vector3(), _to = new THREE.Vector3();
function fireTracer(fromPos, toPos) {
  const tr = tracerPool[tracerIdx++ % tracerPool.length];
  if (!tr) return;
  _from.set(fromPos.x, 1.1, fromPos.z);
  _to.set(toPos.x, 1.1, toPos.z);
  tr.line.geometry.setFromPoints([_from, _to]);
  tr.life = 0.14;
  tr.line.material.opacity = 0.9;
}
