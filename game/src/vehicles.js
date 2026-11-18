// vehicles.js — every car in Vista Marina is built here from boxes and
// cylinders (Vela sedan, Serrano pickup, Cabrillo GT, VMPD Interceptor with
// its lightbar), and the arcade physics step they all share is here too:
// throttle and steering in, movement, scrape damage and car-to-car shoves out.
// The player, traffic and police differ only in who writes the inputs.

import * as THREE from 'three';
import { CAR_MODELS } from './state.js';
import { collideCircle } from './city.js';

// Paint materials are shared per colour — a hundred cars, a dozen materials.
const paintMats = new Map();
function paintMat(color) {
  if (!paintMats.has(color)) {
    paintMats.set(color, new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x888888 }));
  }
  return paintMats.get(color);
}
const glassMat = new THREE.MeshPhongMaterial({ color: 0x18222e, shininess: 120, specular: 0xbbddff });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14151a });
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xb9c2cc, shininess: 110 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3040 });

export const TRAFFIC_COLORS = [0xd8d4cc, 0x8fa3b8, 0xb03a2e, 0x2e5f8a, 0x3f7a52, 0xc7a23a, 0x6a4a7a, 0xe8e8e8, 0x37414f, 0xd4692a];

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildCarMesh(model, color) {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const kind = CAR_MODELS[model].kind;
  if (kind === 'sports') {
    box(g, 2.0, 0.42, 4.6, paint, 0, 0.52, 0);              // low wide body
    box(g, 1.7, 0.34, 2.0, glassMat, 0, 0.86, -0.25);       // canopy
    box(g, 2.06, 0.16, 0.5, paint, 0, 0.78, -2.2);          // rear wing
    box(g, 0.16, 0.3, 0.5, paint, -0.8, 0.6, -2.2);
    box(g, 0.16, 0.3, 0.5, paint, 0.8, 0.6, -2.2);
    box(g, 1.9, 0.2, 0.7, paint, 0, 0.4, 2.15);             // nose
  } else if (kind === 'pickup') {
    box(g, 2.1, 0.62, 4.9, paint, 0, 0.72, 0);
    box(g, 1.9, 0.62, 1.7, glassMat, 0, 1.3, 0.75);         // cab
    box(g, 2.0, 0.34, 2.2, paintMat(0x22242a), 0, 0.98, -1.25); // open bed
    box(g, 2.14, 0.24, 0.3, chromeMat, 0, 0.5, 2.5);        // bull bar
  } else if (kind === 'police') {
    box(g, 2.0, 0.55, 4.7, paintMat(0xf0f0ee), 0, 0.66, 0); // white body
    box(g, 1.8, 0.5, 2.2, glassMat, 0, 1.12, -0.15);
    box(g, 2.02, 0.56, 1.5, paintMat(0x14161c), 0, 0.67, 0.1); // black door band
    box(g, 1.5, 0.16, 0.5, paintMat(0x222222), 0, 1.46, -0.15).name = 'lightbar';
    box(g, 0.7, 0.17, 0.52, new THREE.MeshBasicMaterial({ color: 0xff2a3c }), -0.38, 1.46, -0.15).name = 'lampL';
    box(g, 0.7, 0.17, 0.52, new THREE.MeshBasicMaterial({ color: 0x2a7aff }), 0.38, 1.46, -0.15).name = 'lampR';
    box(g, 2.06, 0.3, 0.24, chromeMat, 0, 0.45, 2.42);      // push bar
  } else { // sedan
    box(g, 1.95, 0.52, 4.5, paint, 0, 0.62, 0);
    box(g, 1.7, 0.5, 2.1, glassMat, 0, 1.08, -0.2);
    box(g, 1.96, 0.18, 0.4, paint, 0, 0.5, -2.2);
  }
  // lamps, front and back
  box(g, 0.42, 0.14, 0.06, headMat, -0.62, 0.62, 2.32);
  box(g, 0.42, 0.14, 0.06, headMat, 0.62, 0.62, 2.32);
  box(g, 0.46, 0.13, 0.06, tailMat, -0.6, 0.68, -2.32);
  box(g, 0.46, 0.13, 0.06, tailMat, 0.6, 0.68, -2.32);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
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
    pos: mesh.position, // the mesh position IS the car's position
    heading, speed: 0, steer: 0,
    hp: 100, radius: 1.7,
    driver: null,       // 'player' | 'traffic' | 'police' | null (parked)
    route: null,        // traffic routing { from, target }
    cruise: 0.6,
    unit: null,         // police back-reference
    smoke: null,
    dead: false,
    hitCooldown: 0,
    lastHit: null,
    hitSpeed: 0,
    damagedBy: null,
  };
  mesh.userData.car = car;
  return car;
}

export function setCarColor(car, color) {
  car.mesh.traverse((o) => {
    if (o.material && o.material.shininess === 70) o.material = paintMat(color);
  });
}

// One physics step. input: { throttle, steer, brake, reverse, handbrake }.
// Returns ground speed in km/h. Buildings push out via the collider list;
// cars shove each other apart and remember hard impacts for missions/audio.
export function stepCar(car, input, dt, colliders, allCars) {
  const spec = car.spec;
  const accel = input.throttle > 0 ? spec.accel : spec.accel * 0.55;
  car.speed += input.throttle * accel * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  car.speed = THREE.MathUtils.clamp(car.speed, -spec.topSpeed * 0.4, spec.topSpeed);
  if (Math.abs(car.speed) < 0.04 && input.throttle === 0) car.speed = 0;
  // steering bites harder the faster you go; grip is the model's poise
  const authority = THREE.MathUtils.clamp(Math.abs(car.speed) / 9, 0, 1) * Math.sign(car.speed || 1);
  car.heading -= input.steer * authority * (input.handbrake ? 1.9 : 1.15) * spec.grip * dt * 1.9;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.pos.x = THREE.MathUtils.clamp(car.pos.x, -305, 760);
  car.pos.z = THREE.MathUtils.clamp(car.pos.z, -395, 305);
  if (collideCircle(colliders, car.pos, car.radius)) {
    if (Math.abs(car.speed) > 12) damageCar(car, Math.abs(car.speed) * 0.22, null);
    car.speed *= 0.35;
  }
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
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.smoke) {
    car.smoke.position.set(car.pos.x, car.pos.y + 1.1, car.pos.z);
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
    smoke.position.set(car.pos.x, car.pos.y + 1.1, car.pos.z);
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

// Alternate the lightbar's two lamps; t is seconds, offset per car so the
// fleet does not flash in lockstep.
export function tickPoliceLights(car, t) {
  const l = car.mesh.getObjectByName('lampL');
  const r = car.mesh.getObjectByName('lampR');
  if (!l || !r) return;
  const phase = Math.floor(t * 5) % 2 === 0;
  l.material.color.setHex(phase ? 0xff5060 : 0x571118);
  r.material.color.setHex(phase ? 0x113057 : 0x4d8dff);
}
