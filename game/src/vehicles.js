// vehicles.js — builds every car mesh (Vela sedan, Serrano pickup, Cabrillo GT,
// VMPD Interceptor) from boxes and cylinders, and steps the arcade car physics
// shared by the player, traffic and police.

import * as THREE from 'three';
import { CAR_MODELS } from './state.js';
import { collideCircle } from './city.js';

const bodyMats = new Map();
function bodyMat(color) {
  if (!bodyMats.has(color)) {
    bodyMats.set(color, new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x888888 }));
  }
  return bodyMats.get(color);
}
const glassMat = new THREE.MeshPhongMaterial({ color: 0x18222e, shininess: 120, specular: 0xbbddff });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14151a });
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xb9c2cc, shininess: 110 });

const TRAFFIC_COLORS = [0xd8d4cc, 0x8fa3b8, 0xb03a2e, 0x2e5f8a, 0x3f7a52, 0xc7a23a, 0x6a4a7a, 0xe8e8e8, 0x37414f, 0xd4692a];

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildCarMesh(model, color) {
  const g = new THREE.Group();
  const mat = bodyMat(color);
  const spec = CAR_MODELS[model];
  if (spec.kind === 'sports') {
    box(2.0, 0.42, 4.6, mat, 0, 0.52, 0, g);                    // low body
    box(1.7, 0.34, 2.0, glassMat, 0, 0.86, -0.25, g);           // canopy
    box(2.06, 0.16, 0.5, mat, 0, 0.78, -2.2, g);                // rear wing
    box(0.16, 0.3, 0.5, mat, -0.8, 0.6, -2.2, g);
    box(0.16, 0.3, 0.5, mat, 0.8, 0.6, -2.2, g);
    box(1.9, 0.2, 0.7, mat, 0, 0.4, 2.15, g);                   // nose
  } else if (spec.kind === 'pickup') {
    box(2.1, 0.62, 4.9, mat, 0, 0.72, 0, g);
    box(1.9, 0.62, 1.7, glassMat, 0, 1.3, 0.75, g);             // cab
    box(2.0, 0.34, 2.2, bodyMat(0x22242a), 0, 0.98, -1.25, g);  // bed
    box(2.14, 0.24, 0.3, chromeMat, 0, 0.5, 2.5, g);            // bull bar
  } else if (spec.kind === 'police') {
    box(2.0, 0.55, 4.7, bodyMat(0xf0f0ee), 0, 0.66, 0, g);
    box(1.8, 0.5, 2.2, glassMat, 0, 1.12, -0.15, g);
    box(2.02, 0.56, 1.5, bodyMat(0x14161c), 0, 0.67, 0.1, g);   // black doors band
    const lightbar = box(1.5, 0.16, 0.5, bodyMat(0x222222), 0, 1.46, -0.15, g);
    lightbar.name = 'lightbar';
    const lb = box(0.7, 0.17, 0.52, new THREE.MeshBasicMaterial({ color: 0xff2a3c }), -0.38, 1.46, -0.15, g);
    const lr = box(0.7, 0.17, 0.52, new THREE.MeshBasicMaterial({ color: 0x2a7aff }), 0.38, 1.46, -0.15, g);
    lb.name = 'lampL'; lr.name = 'lampR';
    box(2.06, 0.3, 0.24, chromeMat, 0, 0.45, 2.42, g);          // push bar
  } else { // sedan
    box(1.95, 0.52, 4.5, mat, 0, 0.62, 0, g);
    box(1.7, 0.5, 2.1, glassMat, 0, 1.08, -0.2, g);
    box(1.96, 0.18, 0.4, mat, 0, 0.5, -2.2, g);
  }
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff3040 });
  box(0.42, 0.14, 0.06, hl, -0.62, 0.62, 2.32, g);
  box(0.42, 0.14, 0.06, hl, 0.62, 0.62, 2.32, g);
  box(0.46, 0.13, 0.06, tl, -0.6, 0.68, -2.32, g);
  box(0.46, 0.13, 0.06, tl, 0.6, 0.68, -2.32, g);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

let carSeq = 0;
export function spawnCar(scene, model, x, z, heading, color) {
  const spec = CAR_MODELS[model];
  const paint = color ?? (model === 'interceptor' ? 0xf0f0ee : TRAFFIC_COLORS[carSeq % TRAFFIC_COLORS.length]);
  const mesh = buildCarMesh(model, paint);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    id: ++carSeq,
    model, spec, mesh,
    pos: mesh.position,
    heading, speed: 0, steer: 0,
    hp: 100, radius: 1.7,
    driver: null,       // 'player' | 'traffic' | 'police' | null (parked)
    route: null,        // traffic: { node, target }
    unit: null,         // police: unit record
    smoke: null,
    dead: false,
    hitCooldown: 0,
  };
  mesh.userData.car = car;
  return car;
}

export function setCarColor(car, color) {
  car.mesh.children.forEach((c) => {
    if (c.material && c.material.shininess === 70) c.material = bodyMat(color);
  });
}

// Arcade step: throttle/brake/steer inputs in [-1, 1]. Mutates the car and
// returns the speed in km/h. Collisions: buildings push out, cars push apart.
export function stepCar(car, input, dt, colliders, allCars) {
  const spec = car.spec;
  const accel = input.throttle > 0 ? spec.accel : spec.accel * 0.55;
  car.speed += input.throttle * accel * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  // rolling drag + top speed
  car.speed -= car.speed * 0.55 * dt;
  const top = input.reverse ? -spec.topSpeed * 0.4 : spec.topSpeed;
  car.speed = THREE.MathUtils.clamp(car.speed, -spec.topSpeed * 0.4, Math.max(top, 0));
  if (Math.abs(car.speed) < 0.04 && input.throttle === 0) car.speed = 0;
  // steering scales with speed, grip keeps the tail in line
  const steerAuthority = THREE.MathUtils.clamp(Math.abs(car.speed) / 9, 0, 1) * Math.sign(car.speed || 1);
  car.heading -= input.steer * steerAuthority * (input.handbrake ? 1.9 : 1.15) * spec.grip * dt * 1.9;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  // world bounds: keep cars on the map (water pushes back east)
  car.pos.x = THREE.MathUtils.clamp(car.pos.x, -305, 760);
  car.pos.z = THREE.MathUtils.clamp(car.pos.z, -395, 305);
  const before = { x: car.pos.x, z: car.pos.z };
  if (collideCircle(colliders, car.pos, car.radius)) {
    // scrape damage when hitting a building at speed
    if (Math.abs(car.speed) > 12) damageCar(car, Math.abs(car.speed) * 0.22, null);
    car.speed *= 0.35;
  }
  void before;
  // car vs car: soft push apart + impact bookkeeping
  car.hitCooldown = Math.max(0, car.hitCooldown - dt);
  for (const other of allCars) {
    if (other === car || other.dead) continue;
    const dx = car.pos.x - other.pos.x, dz = car.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    const min = car.radius + other.radius + 0.7;
    if (d2 < min * min && d2 > 0.001) {
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      car.pos.x += (dx / d) * push; car.pos.z += (dz / d) * push;
      other.pos.x -= (dx / d) * push; other.pos.z -= (dz / d) * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 7 && car.hitCooldown === 0) {
        car.hitCooldown = 0.4;
        damageCar(car, rel * 0.5, other);
        damageCar(other, rel * 0.5, car);
        car.lastHit = other; other.lastHit = car;
        car.hitSpeed = rel; other.hitSpeed = rel;
        car.speed *= 0.55; other.speed *= 0.7;
      }
    }
  }
  // write transform + wheel spin
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.smoke) {
    car.smoke.position.copy(car.pos).y += 1.1;
    car.smoke.material.opacity = car.hp < 30 ? 0.55 : 0.3;
  }
  return Math.abs(car.speed) * 3.6;
}

export function damageCar(car, amount, by) {
  if (car.dead) return;
  car.hp -= amount;
  if (by) car.damagedBy = by;
  if (car.hp < 55 && !car.smoke) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.3 }),
    );
    smoke.position.copy(car.pos).y += 1.1;
    car.mesh.parent.add(smoke);
    car.smoke = smoke;
  }
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    car.speed = 0;
    if (car.smoke) car.smoke.material.color.set(0x0a0a0a);
    car.mesh.rotation.z = 0.06;
  }
}

// Flash the police lightbar lamps alternately; called once per frame.
export function tickPoliceLights(car, t) {
  const l = car.mesh.getObjectByName('lampL');
  const r = car.mesh.getObjectByName('lampR');
  if (!l || !r) return;
  const phase = Math.floor(t * 5) % 2 === 0;
  l.material.color.setHex(phase ? 0xff5060 : 0x571118);
  r.material.color.setHex(phase ? 0x113057 : 0x4d8dff);
}
