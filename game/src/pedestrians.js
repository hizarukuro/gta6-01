// pedestrians.js — the people of the Neon Mile: capsule figures with swinging
// arms and legs who stroll the boulevard sidewalks and avenue pavements,
// scatter when violence or a fast car comes close, and go down when hurt
// (they get back up again, furious, a few seconds later).

import * as THREE from 'three';
import { WORLD } from './state.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xff5d8f, 0xffb340, 0x57a8ff, 0x27e0c8, 0xf2f0e8, 0xc792ff, 0xff7847, 0x7dffcb, 0xd8d4cc, 0x37414f];
const SKIN = [0xf2c49b, 0xc68863, 0x8a5a3b, 0x6e4530, 0xffdbb8];
const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3040 });

function buildPedMesh(shirt, skin) {
  const g = new THREE.Group();
  const top = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 3, 8), top);
  torso.position.y = 1.05; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinMat);
  head.position.y = 1.78; head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), legMat);
  legL.position.set(-0.12, 0.31, 0);
  const legR = legL.clone(); legR.position.x = 0.12;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.55, 0.11), top);
  armL.position.set(-0.36, 1.12, 0);
  const armR = armL.clone(); armR.position.x = 0.36;
  g.add(torso, head, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, head };
  return g;
}

let pedSeq = 0;
export function seedPeds(G, scene, count) {
  const { avenues, boulevardX } = WORLD;
  for (let i = 0; i < count; i++) {
    const onBlvd = i % 3 !== 0; // two thirds of the crowd walks the shore
    const x = onBlvd ? boulevardX - 11 + (i % 2) * 22 : avenues[i % avenues.length] + (i % 2 ? 8.6 : -8.6);
    const z = -260 + Math.random() * 520;
    const mesh = buildPedMesh(SHIRTS[i % SHIRTS.length], SKIN[i % SKIN.length]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      id: ++pedSeq, mesh, pos: mesh.position,
      heading: Math.random() * Math.PI * 2,
      walkPhase: Math.random() * 6,
      target: { x: x + (Math.random() - 0.5) * 60, z: z + (Math.random() - 0.5) * 160 },
      state: 'walk', // walk | flee | down
      panic: 0, hp: 30, downTimer: 0, marked: false,
      fleeFrom: null,
    };
    mesh.userData.ped = ped;
    G.peds.push(ped);
  }
}

function newTarget(ped) {
  const { avenues, boulevardX } = WORLD;
  if (Math.random() < 0.6) {
    ped.target.x = Math.random() < 0.5 ? boulevardX - 11 : boulevardX + 11;
  } else {
    ped.target.x = avenues[(Math.random() * avenues.length) | 0] + (Math.random() < 0.5 ? 8.6 : -8.6);
  }
  ped.target.z = -270 + Math.random() * 540;
}

export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
      ped.state = 'flee';
      ped.panic = 3 + Math.random() * 2;
      ped.fleeFrom = { x, z };
    }
  }
}

export function hurtPed(ped, amount) {
  ped.hp -= amount;
  if (ped.hp <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.downTimer = 14;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
  } else if (ped.state !== 'down') {
    ped.state = 'flee';
    ped.panic = 4;
    ped.fleeFrom = { x: ped.pos.x + 1, z: ped.pos.z };
  }
}

export function updatePeds(G, dt, colliders) {
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee'; ped.panic = 5; ped.hp = 30;
        ped.mesh.rotation.x = 0; ped.mesh.position.y = 0;
        ped.fleeFrom = { x: ped.pos.x - 4, z: ped.pos.z };
      }
      continue;
    }
    let tx, tz, speed;
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const fx = ped.pos.x - (ped.fleeFrom ? ped.fleeFrom.x : ped.pos.x);
      const fz = ped.pos.z - (ped.fleeFrom ? ped.fleeFrom.z : ped.pos.z);
      const fl = Math.hypot(fx, fz) || 1;
      tx = ped.pos.x + (fx / fl) * 30;
      tz = ped.pos.z + (fz / fl) * 30;
      speed = 4.6;
      if (ped.panic <= 0) { ped.state = 'walk'; newTarget(ped); }
    } else {
      tx = ped.target.x; tz = ped.target.z; speed = 1.5;
      if (Math.hypot(tx - ped.pos.x, tz - ped.pos.z) < 2.5) newTarget(ped);
    }
    const want = Math.atan2(tx - ped.pos.x, tz - ped.pos.z);
    let diff = want - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    collideCircle(colliders, ped.pos, 0.45);
    ped.pos.x = THREE.MathUtils.clamp(ped.pos.x, -300, 740);
    ped.pos.z = THREE.MathUtils.clamp(ped.pos.z, -390, 300);
    ped.walkPhase += dt * speed * 3.4;
    const sw = Math.sin(ped.walkPhase) * 0.5;
    const u = ped.mesh.userData;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
    ped.mesh.rotation.y = ped.heading;
    // nobody strolls in front of a speeding car twice
    if (G.driveCar && Math.abs(G.driveCar.speed) > 16 && ped.state === 'walk') {
      if (Math.hypot(ped.pos.x - G.driveCar.pos.x, ped.pos.z - G.driveCar.pos.z) < 6) {
        ped.state = 'flee'; ped.panic = 2;
        ped.fleeFrom = { x: G.driveCar.pos.x, z: G.driveCar.pos.z };
      }
    }
  }
}
