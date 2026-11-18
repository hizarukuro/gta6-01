// police.js — the VMPD. Wanted stars drive everything: patrol strength,
// pursuit steering with intercept and ramming, roadblocks at three stars,
// a spotlight helicopter at four, gunfire, the sight/search/decay model,
// and the busted meter. Panel distances are measured live from real unit
// positions — nothing here is cosmetic.
import * as THREE from "three";
import {
  G, NODES, SEGMENTS, clamp, angNorm, rand, randRange, dist2D,
} from "./state.js";
import { addCar, removeCar, stepCar, damageCar } from "./vehicles.js";
import { hurtPlayer } from "./player.js";

let scene = null;
const CALLSIGNS = ["MARLIN-11", "SNAPPER-25", "TARPON-18", "HERON-17", "KESTREL-31", "IBIS-43", "COBIA-07", "BARRACUDA-52"];
let csIdx = 0;
let spawnT = 0, decayT = 0, blockT = 0, blockActive = false;
const tracers = [];

export function initPolice(s) { scene = s; }

export function setWanted(n) {
  G.wanted = clamp(Math.round(n), 0, 5);
  G.heat = 0; G.searchT = 0; decayT = 0;
}
export function raiseHeat(frac) {
  if (G.frozen) return;
  G.heat += frac;
  while (G.heat >= 1 && G.wanted < 5) { G.heat -= 1; G.wanted += 1; }
  if (G.wanted >= 5) G.heat = Math.min(G.heat, 0.99);
}

// ---------- spawning ----------
function spawnPointNear(minD, maxD) {
  const px = G.player.x, pz = G.player.z;
  const found = [];
  for (const node of NODES.values()) {
    const d = dist2D(node.x, node.z, px, pz);
    if (d >= minD && d <= maxD) found.push(node);
  }
  if (!found.length) return { x: 245, z: pz + 60 };
  return found[Math.floor(rand() * found.length) % found.length];
}

export function spawnUnitAt(x, z, heading, callsign, role) {
  const car = addCar("interceptor", x, z, heading, { driver: "police", color: 0xf4f6f8 });
  const unit = { car, callsign: callsign || CALLSIGNS[csIdx++ % CALLSIGNS.length], role: role || "pursuit", tactic: "PURSUIT", shotT: randRange(0.4, 1.2), revT: 0 };
  G.units.push(unit);
  return unit;
}
function spawnUnit(role) {
  const p = spawnPointNear(52, 92);
  return spawnUnitAt(p.x, p.z, randRange(0, Math.PI * 2), null, role);
}

// When the player steals a unit's car, the unit simply ceases to exist.
export function detachUnit(car) {
  const i = G.units.findIndex((u) => u.car === car);
  if (i >= 0) { if (G.units[i].role === "block") blockActive = false; G.units.splice(i, 1); }
}

export function clearPolice() {
  for (const u of G.units) removeCar(u.car);
  G.units.length = 0;
  if (G.heli) { scene.remove(G.heli.group); G.heli = null; }
  blockActive = false;
}

// ---------- helicopter ----------
function buildHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d2126 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 5.4), bodyMat);
  body.castShadow = true; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.4, 5.0),
    new THREE.MeshBasicMaterial({ color: 0xff8c1a }));
  stripe.position.y = -0.2; g.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat);
  tail.position.set(0, 0.25, -4.6); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.8), bodyMat);
  fin.position.set(0, 0.8, -6.6); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.06, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x0c0c0e }));
  rotor.position.y = 1.15; g.add(rotor);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff6cf }));
  lamp.position.set(0, -0.95, 1.6); g.add(lamp);
  for (const sx of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), bodyMat);
    skid.position.set(sx, -1.25, 0); g.add(skid);
  }
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 7.5, 1, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffeeb8, transparent: true, opacity: 0.21, side: THREE.DoubleSide, depthWrite: false })
  );
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xffeeb8, transparent: true, opacity: 0.42, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  scene.add(g); scene.add(cone); scene.add(pool);
  const light = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.5);
  scene.add(light); scene.add(light.target);
  return { group: g, rotor, cone, pool, light, x: 0, z: 0, y: 26, angle: 0, leave: false };
}

export function heliPos() { return G.heli ? { x: G.heli.x, z: G.heli.z } : null; }

// Scene staging: place the helicopter at a fixed pose with its spotlight
// pool on (tx, tz). Used only by scenes.js while the world is frozen.
export function stageHeli(x, y, z, tx, tz) {
  if (!G.heli) G.heli = buildHeli();
  const heli = G.heli;
  heli.x = x; heli.z = z; heli.y = y;
  heli.group.position.set(x, y, z);
  heli.group.rotation.y = Math.atan2(tx - x, tz - z);
  const gy = 0.2;
  heli.pool.position.set(tx, gy + 0.06, tz);
  const len = Math.hypot(x - tx, y - gy, z - tz);
  heli.cone.position.set((x + tx) / 2, (y + gy) / 2, (z + tz) / 2);
  heli.cone.scale.set(1, len, 1);
  const dir = new THREE.Vector3(tx - x, gy - y, tz - z).normalize();
  heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  heli.light.position.set(x, y, z);
  heli.light.target.position.set(tx, 0, tz);
}

// ---------- tracers ----------
function fireTracer(x1, y1, z1, x2, y2, z2) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, life: 0.07 });
}

// ---------- report for the HUD panel ----------
export function unitReport() {
  const out = [];
  for (const u of G.units) {
    out.push({
      callsign: u.callsign, tactic: u.tactic,
      dist: dist2D(u.car.x, u.car.z, G.player.x, G.player.z),
    });
  }
  if (G.heli) {
    out.push({
      callsign: "GULL-1",
      tactic: G.seen ? "SPOTLIGHT ON YOU" : "SEARCHING",
      dist: dist2D(G.heli.x, G.heli.z, G.player.x, G.player.z),
    });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

// ---------- main update ----------
const TARGET_UNITS = [0, 1, 2, 3, 4, 5];

export function updatePolice(dt) {
  const px = G.player.x, pz = G.player.z;
  const pCar = G.player.car;

  // Scene staging: hold every staged unit still, keep the lightbars alive.
  if (G.frozen) {
    for (const u of G.units) {
      if (u.car.lightMats) {
        const ph = Math.floor(G.simTime * 6 + u.car.x) % 2 === 0;
        u.car.lightMats.red.color.setHex(ph ? 0xff2233 : 0x551016);
        u.car.lightMats.blue.color.setHex(ph ? 0x112a55 : 0x2266ff);
      }
    }
    return;
  }

  // --- sight / search / decay ---
  let seen = false;
  for (const u of G.units) if (dist2D(u.car.x, u.car.z, px, pz) < 58) { seen = true; break; }
  if (!seen && G.heli && dist2D(G.heli.x, G.heli.z, px, pz) < 95) seen = true;
  G.seen = seen;
  if (seen) { G.searchT = 0; G.lastSeenX = px; G.lastSeenZ = pz; decayT = 0; }
  else if (G.wanted > 0) {
    G.searchT += dt; decayT += dt;
    if (decayT > 7) { decayT = 0; setWanted(G.wanted - 1); if (G.wanted === 0) G.player.bust = 0; }
  }

  // --- strength management ---
  const wantGround = TARGET_UNITS[G.wanted];
  const ground = G.units.filter((u) => u.role !== "heli");
  spawnT -= dt;
  if (ground.length < wantGround && spawnT <= 0 && G.wanted > 0) { spawnUnit("pursuit"); spawnT = 1.4; }
  if (ground.length > wantGround) {
    // shed the farthest pursuit unit when heat drops
    let far = null, fd = -1;
    for (const u of ground) { const d = dist2D(u.car.x, u.car.z, px, pz); if (u.role === "pursuit" && d > fd) { fd = d; far = u; } }
    if (far && fd > 60) { removeCar(far.car); G.units.splice(G.units.indexOf(far), 1); }
  }
  // despawn runaways
  for (let i = G.units.length - 1; i >= 0; i--) {
    const u = G.units[i];
    if (dist2D(u.car.x, u.car.z, px, pz) > 240) { removeCar(u.car); G.units.splice(i, 1); if (u.role === "block") blockActive = false; }
  }

  // --- roadblocks at 3+ stars ---
  blockT -= dt;
  if (G.wanted >= 3 && !blockActive && blockT <= 0 && pCar) {
    placeRoadblock();
  }

  // --- pursuit driving ---
  const pvx = pCar ? Math.sin(pCar.heading) * pCar.speed : 0;
  const pvz = pCar ? Math.cos(pCar.heading) * pCar.speed : 0;
  for (const u of G.units) {
    const car = u.car;
    // lightbar strobe
    if (car.lightMats) {
      const ph = Math.floor(G.simTime * 6 + car.x) % 2 === 0;
      car.lightMats.red.color.setHex(ph ? 0xff2233 : 0x551016);
      car.lightMats.blue.color.setHex(ph ? 0x112a55 : 0x2266ff);
    }
    if (u.role === "block") {
      car.speed = 0;
      u.tactic = "ROADBLOCK";
      const d = dist2D(car.x, car.z, px, pz);
      if (d < 13 || blockT <= -30) { u.role = "pursuit"; blockActive = false; blockT = 16; }
      continue;
    }
    const tx = (seen ? px : G.lastSeenX) + pvx * 0.55;
    const tz = (seen ? pz : G.lastSeenZ) + pvz * 0.55;
    const dx = tx - car.x, dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const diff = angNorm(want - car.heading);
    let steer = clamp(diff * 1.9, -1, 1);
    let throttle = 1;
    if (dist < 7) throttle = 0.35;
    if (Math.abs(diff) > 2.2 && dist < 12) { throttle = -0.8; steer = -steer; u.revT = 0.5; }
    if (u.revT > 0) { u.revT -= dt; throttle = -0.8; }
    // Ramming: close and roughly aligned with the player's car.
    u.tactic = "PURSUIT";
    if (pCar && dist < 17 && Math.abs(diff) < 0.7) u.tactic = "RAMMING";
    if (!pCar && dist < 9) u.tactic = "CONTAIN";
    if (!seen) u.tactic = "SEARCHING";
    stepCar(car, throttle, steer, dt);

    // --- gunfire at 3+ stars ---
    if (G.wanted >= 3 && seen && dist < 44) {
      u.shotT -= dt;
      if (u.shotT <= 0) {
        u.shotT = randRange(0.5, 1.15);
        const spread = randRange(-2.2, 2.2);
        fireTracer(car.x, 1.2, car.z, px + spread, 1.1, pz + randRange(-2.2, 2.2));
        if (dist < 31 && rand() < 0.62) {
          if (pCar) damageCar(pCar, randRange(1, 3));
          else hurtPlayer(randRange(2, 5));
        }
      }
    }
  }

  // --- helicopter ---
  if (G.wanted >= 4 && !G.heli) {
    G.heli = buildHeli();
    G.heli.x = px + 40; G.heli.z = pz - 40;
  }
  if (G.heli) {
    const heli = G.heli;
    if (G.wanted < 3) heli.leave = true;
    heli.angle += dt * 0.32;
    const tx = seen ? px : G.lastSeenX, tz = seen ? pz : G.lastSeenZ;
    const orbit = heli.leave ? 320 : 25;
    const hx = tx + Math.cos(heli.angle) * orbit;
    const hz = tz + Math.sin(heli.angle) * orbit;
    heli.x += (hx - heli.x) * Math.min(1, dt * (heli.leave ? 0.7 : 1.8));
    heli.z += (hz - heli.z) * Math.min(1, dt * (heli.leave ? 0.7 : 1.8));
    heli.y = heli.leave ? heli.y + dt * 6 : 24 + Math.sin(G.simTime * 0.8) * 1.2;
    heli.group.position.set(heli.x, heli.y, heli.z);
    heli.group.rotation.y = Math.atan2(tx - heli.x, tz - heli.z);
    heli.rotor.rotation.y += dt * 28;
    // spotlight cone + pool onto the target point
    const gy = 0.2;
    heli.pool.position.set(tx, gy + 0.06, tz);
    const midX = (heli.x + tx) / 2, midZ = (heli.z + tz) / 2;
    const len = Math.hypot(heli.x - tx, heli.y - gy, heli.z - tz);
    heli.cone.position.set(midX, (heli.y + gy) / 2, midZ);
    heli.cone.scale.set(1, len, 1);
    const dir = new THREE.Vector3(tx - heli.x, gy - heli.y, tz - heli.z).normalize();
    heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    heli.light.position.set(heli.x, heli.y, heli.z);
    heli.light.target.position.set(tx, 0, tz);
    if (heli.leave && dist2D(heli.x, heli.z, px, pz) > 300) {
      scene.remove(heli.group); scene.remove(heli.cone); scene.remove(heli.pool);
      scene.remove(heli.light); scene.remove(heli.light.target);
      G.heli = null;
    }
  }

  // --- busted meter ---
  const p = G.player;
  if (G.wanted > 0 && !p.dead && G.mode === "play") {
    let near = 1e9;
    for (const u of G.units) near = Math.min(near, dist2D(u.car.x, u.car.z, px, pz));
    const slow = pCar ? Math.abs(pCar.speed) < 1.2 : true;
    if (near < 7.5 && slow && seen) {
      p.bust += dt / (pCar ? 3.6 : 2.4);
      if (p.bust >= 1) { p.bust = 0; p.bustedFlag = true; }
    } else {
      p.bust = Math.max(0, p.bust - dt * 0.7);
    }
  } else p.bust = Math.max(0, p.bust - dt * 0.7);

  // --- tracers fade ---
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
}

function placeRoadblock() {
  const pCar = G.player.car;
  if (!pCar) return;
  // Aim 52 m ahead of the player's car along its heading, snapped to the
  // nearest road segment so the block sits across a real lane.
  const ax = G.player.x + Math.sin(pCar.heading) * 52;
  const az = G.player.z + Math.cos(pCar.heading) * 52;
  let best = null, bd = 1e9;
  for (const s of SEGMENTS) {
    const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
    const d = Math.hypot(mx - ax, mz - az);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best) return;
  // Point on the segment nearest the aim point.
  const dx = best.bx - best.ax, dz = best.bz - best.az;
  const L2 = dx * dx + dz * dz || 1;
  let t = ((ax - best.ax) * dx + (az - best.az) * dz) / L2;
  t = clamp(t, 0.06, 0.94);
  const cx = best.ax + dx * t, cz = best.az + dz * t;
  const roadAng = Math.atan2(dx, dz); // heading along the road
  const perp = roadAng + Math.PI / 2;
  const ox = Math.sin(perp), oz = Math.cos(perp);
  spawnUnitAt(cx + ox * 3.1, cz + oz * 3.1, perp, null, "block");
  spawnUnitAt(cx - ox * 3.1, cz - oz * 3.1, perp + Math.PI, null, "block");
  blockActive = true;
  blockT = 20;
}
