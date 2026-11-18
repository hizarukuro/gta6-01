// player.js — Nico Ferreira on foot: third-person movement and camera, entering
// and stealing cars, taking damage, and the busted / wasted flow that puts him
// back at VMPD Central or Vista General with a lighter wallet.

import * as THREE from 'three';
import { G, commitCrime, clearWanted, addCash } from './state.js';
import { collideCircle, LOCATIONS } from './city.js';
import { scarePeds } from './pedestrians.js';

function buildNicoMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff7847 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 3, 8), shirt);
  torso.position.y = 1.05; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc68863 }));
  head.position.y = 1.78; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 10, 6, 0, Math.PI * 2, 0, 1.4), new THREE.MeshLambertMaterial({ color: 0x1d1410 }));
  hair.position.y = 1.82;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), new THREE.MeshLambertMaterial({ color: 0x22262e }));
  legL.position.set(-0.12, 0.31, 0);
  const legR = legL.clone(); legR.position.x = 0.12;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.55, 0.11), shirt);
  armL.position.set(-0.37, 1.12, 0);
  const armR = armL.clone(); armR.position.x = 0.37;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x14151a }));
  gun.position.set(0, -0.3, 0.18);
  armR.add(gun);
  gun.visible = false;
  g.add(torso, head, hair, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, gun };
  return g;
}

export function createPlayer(scene, hud) {
  const mesh = buildNicoMesh();
  mesh.position.set(352, 0, 104);
  scene.add(mesh);
  const player = {
    mesh, pos: mesh.position,
    heading: 0, walkPhase: 0, speedNow: 0,
    camYaw: Math.PI, camPitch: 0.32,
    attackCd: 0, iframes: 0,
    hurt(amount, cause) {
      if (this.iframes > 0 || G.mode === 'busted' || G.mode === 'wasted') return;
      const absorbed = Math.min(G.armour, amount * 0.6);
      G.armour -= absorbed;
      G.health -= (amount - absorbed);
      hud.damageFlash();
      if (G.health <= 0) this.die(cause);
    },
    die(cause) {
      G.mode = 'wasted';
      G.stats.busts += cause === 'busted' ? 1 : 0;
      hud.banner('WASTED', cause === 'shot' ? 'The bay claims another.' : 'Vista General patches you up — for a price.');
      setTimeout(() => respawn(this, hud, LOCATIONS.hospital, true), 2600);
    },
    bust() {
      if (G.mode === 'busted' || G.mode === 'wasted') return;
      G.mode = 'busted';
      hud.banner('BUSTED', 'The VMPD take you in. Bail is not cheap.');
      setTimeout(() => respawn(this, hud, LOCATIONS.policeHQ, true), 2600);
    },
  };
  G.player = player;
  return player;
}

function respawn(player, hud, at, fine) {
  if (G.driveCar) { G.driveCar.driver = null; G.driveCar = null; }
  player.mesh.visible = true;
  player.pos.set(at.x + 6, 0, at.z + 10);
  player.heading = 0;
  G.health = 100;
  G.armour = 0;
  G.bustedMeter = 0;
  if (fine) addCash(-Math.floor(G.cash * 0.12) - 40);
  clearWanted();
  G.mode = 'foot';
  hud.toast(fine ? 'Released. Your wallet feels lighter.' : 'Back on the street.');
}

// Nearest car the player could get into, or null.
export function nearestCar(G, maxDist) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function enterCar(G, hud, car) {
  const wasTraffic = car.driver === 'traffic';
  if (car.driver === 'police') { hud.toast('Locked. The VMPD thought of that.'); return; }
  car.driver = 'player';
  G.driveCar = car;
  G.player.mesh.visible = false;
  G.mode = 'car';
  if (wasTraffic) {
    commitCrime(0.85, 'carjacking');
    G.stats.steals += 1;
    scarePeds(G, car.pos.x, car.pos.z, 16);
    hud.toast('Carjacked! The owner is calling it in.');
  } else if (car.parkedStolen) {
    commitCrime(0.3, 'grand theft auto');
  } else if (!car.ownedByPlayer) {
    commitCrime(0.5, 'grand theft auto');
    G.stats.steals += 1;
    car.parkedStolen = true;
  }
  hud.onEnterCar(car);
}

export function exitCar(G, hud) {
  const car = G.driveCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  G.driveCar = null;
  const side = { x: car.pos.x + Math.cos(car.heading) * 2.2, z: car.pos.z - Math.sin(car.heading) * 2.2 };
  G.player.pos.set(side.x, 0, side.z);
  G.player.mesh.visible = true;
  G.mode = 'foot';
  hud.onExitCar();
}

// On-foot update: camera-relative WASD, limb swing, building collision, and
// getting run over is as bad as it sounds.
export function updatePlayerOnFoot(G, dt, input, colliders, camDelta) {
  const p = G.player;
  p.iframes = Math.max(0, p.iframes - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.camYaw -= camDelta.dx * 0.0032;
  p.camPitch = THREE.MathUtils.clamp(p.camPitch + camDelta.dy * 0.0026, 0.05, 1.15);
  const speed = input.run ? 6.4 : 3.6;
  let mx = 0, mz = 0;
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  if (input.fwd) { mx += -sin; mz += -cos; }
  if (input.back) { mx += sin; mz += cos; }
  if (input.left) { mx += -cos; mz += sin; }
  if (input.right) { mx += cos; mz += -sin; }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.speedNow = speed;
    p.walkPhase += dt * speed * 2.6;
  } else {
    p.speedNow = 0;
  }
  collideCircle(colliders, p.pos, 0.5);
  p.pos.x = THREE.MathUtils.clamp(p.pos.x, -302, 752);
  p.pos.z = THREE.MathUtils.clamp(p.pos.z, -392, 302);
  const u = p.mesh.userData;
  const sw = Math.sin(p.walkPhase) * (p.speedNow > 0 ? 0.55 : 0);
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  if (G.weapon !== 'pistol') { u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7; }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // traffic does not brake for heroes
  for (const car of G.cars) {
    if (car.driver === 'player' || car.dead) continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < 1.9 && Math.abs(car.speed) > 9) {
      p.iframes = 1.2;
      p.hurt(26, 'run over');
      scarePeds(G, p.pos.x, p.pos.z, 14);
    }
  }
}

// Third-person camera: behind and above, smoothed. In a car it pulls back
// with speed. Returns nothing; writes into camera.
export function updateCamera(G, camera, dt) {
  const p = G.player;
  let target, dist, height;
  if (G.mode === 'car' && G.driveCar) {
    const car = G.driveCar;
    target = car.pos;
    dist = 9.5 + Math.abs(car.speed) * 0.09;
    height = 3.6;
    const back = { x: target.x - Math.sin(car.heading) * dist, z: target.z - Math.cos(car.heading) * dist };
    camera.position.lerp(new THREE.Vector3(back.x, height, back.z), 1 - Math.pow(0.0001, dt));
    camera.lookAt(target.x, 1.4, target.z);
  } else {
    target = p.pos;
    const cx = target.x - Math.sin(p.camYaw) * -7.5 * Math.cos(p.camPitch);
    const cz = target.z - Math.cos(p.camYaw) * -7.5 * Math.cos(p.camPitch);
    const cy = 1.6 + Math.sin(p.camPitch) * 7.5;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.pow(0.0001, dt));
    camera.lookAt(target.x, 1.5, target.z);
  }
}
