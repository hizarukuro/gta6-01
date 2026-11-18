// vehicles.js — builds every car in Vista Marina (four models) and steps the
// shared arcade physics: throttle, steering, building/water collision and
// car-to-car bumps. Traffic, police, missions and the player all drive cars
// through this one path.
import * as THREE from "three";
import { G, MODELS, collideWorld, isLand, clamp } from "./state.js";

let scene = null;
const glassMat = new THREE.MeshLambertMaterial({ color: 0x141c26 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ac });

export function initVehicles(s) { scene = s; }

function buildMesh(car) {
  const spec = car.spec;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: car.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.62, spec.len), bodyMat);
  body.position.y = 0.58; body.castShadow = true; g.add(body);

  if (car.model === "serrano") {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.92, 0.62, spec.len * 0.34), glassMat);
    cab.position.set(0, 1.18, spec.len * 0.22); cab.castShadow = true; g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.94, 0.34, spec.len * 0.5), bodyMat);
    bed.position.set(0, 0.98, -spec.len * 0.22); g.add(bed);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.84, 0.55, spec.len * 0.46), glassMat);
    cab.position.set(0, 1.12, -spec.len * 0.04); cab.castShadow = true; g.add(cab);
    if (car.model === "cabrillo") {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.9, 0.09, 0.5), bodyMat);
      wing.position.set(0, 1.02, -spec.len * 0.46); g.add(wing);
    }
  }
  if (car.model === "interceptor") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.wid + 0.04, 0.3, spec.len * 0.52),
      new THREE.MeshLambertMaterial({ color: 0x14161c }));
    stripe.position.y = 0.62; g.add(stripe);
    const bar = new THREE.Group();
    const baseBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.34), tyreMat);
    bar.add(baseBar);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    const bluMat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.3), redMat);
    red.position.x = -0.3; bar.add(red);
    const blu = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.3), bluMat);
    blu.position.x = 0.3; bar.add(blu);
    bar.position.set(0, 1.5, -spec.len * 0.04);
    g.add(bar);
    car.lightMats = { red: redMat, blue: bluMat };
  }
  // Headlights and tail lights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    h.position.set(sx * spec.wid * 0.32, 0.66, spec.len / 2 + 0.02); g.add(h);
  }
  car.brakeMat = new THREE.MeshBasicMaterial({ color: 0x661118 });
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.06), car.brakeMat);
    t.position.set(sx * spec.wid * 0.32, 0.7, -spec.len / 2 - 0.02); g.add(t);
  }
  // Wheels: front pair sits in steer pivots.
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 10);
  car.wheels = []; car.steerPivots = [];
  const wz = spec.len * 0.31;
  for (const [sx, sz, front] of [[-1, wz, 1], [1, wz, 1], [-1, -wz, 0], [1, -wz, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (spec.wid / 2 - 0.05), 0.35, sz);
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    pivot.add(wheel); g.add(pivot);
    car.wheels.push(wheel);
    if (front) car.steerPivots.push(pivot);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), chromeMat);
  hub.position.y = 0.35; // keeps the group origin honest for very small LOD tools
  g.add(hub); hub.visible = false;
  return g;
}

export function addCar(modelKey, x, z, heading, opts = {}) {
  const spec = MODELS[modelKey];
  const car = {
    model: modelKey, spec,
    color: opts.color !== undefined ? opts.color : spec.colors[Math.floor(Math.random() * spec.colors.length)],
    x, z, heading, speed: 0, steer: 0,
    condition: 100, wrecked: false,
    driver: opts.driver || null,       // 'traffic' | 'police' | 'player' | null
    parked: !!opts.parked,
    seg: -1, t: 0, dir: 1, cruise: 10, // traffic graph state
    wheels: [], steerPivots: [], lightMats: null, brakeMat: null,
    braking: false, dead: false, missionTag: null,
    group: null,
  };
  car.group = buildMesh(car);
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
  scene.add(car.group);
  G.cars.push(car);
  return car;
}

export function removeCar(car) {
  car.dead = true;
  scene.remove(car.group);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

export function damageCar(car, amt) {
  car.condition = clamp(car.condition - amt, 0, 100);
  if (car.condition <= 12) car.wrecked = true;
}

// One physics step. throttle -1..1, steer -1..1 (left positive).
export function stepCar(car, throttle, steer, dt) {
  const spec = car.spec;
  const top = car.wrecked ? 9 : spec.top;
  car.braking = throttle < -0.05 && car.speed > 1;
  if (throttle > 0) {
    car.speed += spec.accel * throttle * dt * (1 - Math.max(car.speed, 0) / (top * 1.12));
  } else if (throttle < 0) {
    if (car.speed > 0.6) car.speed -= 24 * -throttle * dt;
    else car.speed = Math.max(car.speed + 7 * throttle * dt, -8);
  } else {
    car.speed -= car.speed * 0.5 * dt;
    if (Math.abs(car.speed) < 0.04) car.speed = 0;
  }
  car.speed = clamp(car.speed, -8, top);
  car.steer = steer;
  if (Math.abs(car.speed) > 0.2) {
    const s = Math.abs(car.speed);
    const rate = 1.6 * clamp(car.speed / 9, -1, 1) / (1 + Math.max(0, s - 9) * 0.03);
    car.heading += steer * rate * dt;
  }
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  if (!isLand(nx, nz)) {
    if (isLand(nx, car.z)) nz = car.z;
    else if (isLand(car.x, nz)) nx = car.x;
    else { nx = car.x; nz = car.z; car.speed *= -0.2; }
  }
  const before = Math.abs(car.speed);
  const res = collideWorld(nx, nz, spec.len * 0.3);
  if (res.x !== nx || res.z !== nz) {
    if (before > 9) damageCar(car, (before - 8) * 0.7);
    car.speed *= 0.5;
  }
  car.x = res.x; car.z = res.z;
  syncCarMesh(car, dt);
}

export function syncCarMesh(car, dt) {
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = (car.speed * (dt || 0)) / 0.35;
  for (const w of car.wheels) w.rotation.x += spin;
  for (const p of car.steerPivots) p.rotation.y = car.steer * 0.42;
  if (car.brakeMat) car.brakeMat.color.setHex(car.braking ? 0xff2a35 : 0x661118);
}

// Bump resolution between every pair of nearby cars.
export function collideCars() {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i]; if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j]; if (b.dead) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const minD = (a.spec.len + b.spec.len) * 0.36;
      const d2 = dx * dx + dz * dz;
      if (d2 > minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      const ux = dx / d, uz = dz / d;
      a.x -= ux * push; a.z -= uz * push;
      b.x += ux * push; b.z += uz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 5) { damageCar(a, rel * 0.35); damageCar(b, rel * 0.35); if (a.onBump) a.onBump(b, rel); if (b.onBump) b.onBump(a, rel); }
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg; b.speed = avg;
      syncCarMesh(a, 0); syncCarMesh(b, 0);
    }
  }
}
