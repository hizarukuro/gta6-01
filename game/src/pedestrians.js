// pedestrians.js — the people of Vista Marina. They stroll the sidewalks
// along the road graph, scatter when danger comes close, and a hostile few
// (mission muscle) will come at the player with their fists.
import * as THREE from "three";
import { G, SEGMENTS, NODES, segPoint, segLength, rand, randRange, pick, collideWorld, isLand } from "./state.js";
import { hurtPlayer } from "./player.js";

let scene = null;
const SKIN = [0xe8b98d, 0xc68863, 0x8d5524, 0xf1c27d, 0x6e4423];
const CLOTH = [0xd8546e, 0x3ca9ff, 0xffd23c, 0x7dff9a, 0xf2f2f2, 0xff9a3c, 0x9a6bff, 0x2e5d43];

export function initPeds(s) { scene = s; }

function buildMesh(ped) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: ped.color });
  const skin = new THREE.MeshLambertMaterial({ color: pick(SKIN) });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x23242c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.66, 0.24), cloth);
  torso.position.y = 1.06; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7), skin);
  head.position.y = 1.58; g.add(head);
  ped.legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.74, 0.17), legMat);
  ped.legL.position.set(-0.12, 0.37, 0); g.add(ped.legL);
  ped.legR = ped.legL.clone(); ped.legR.position.x = 0.12; g.add(ped.legR);
  ped.armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.6, 0.13), cloth);
  ped.armL.position.set(-0.3, 1.05, 0); g.add(ped.armL);
  ped.armR = ped.armL.clone(); ped.armR.position.x = 0.3; g.add(ped.armR);
  return g;
}

export function addPed(x, z, opts = {}) {
  const ped = {
    x, z, heading: randRange(0, Math.PI * 2), speed: 0,
    state: opts.hostile ? "fight" : "walk",
    hostile: !!opts.hostile,
    hp: opts.hostile ? 55 : 30,
    color: opts.color !== undefined ? opts.color : pick(CLOTH),
    seg: -1, t: 0, dir: 1, lane: 8.8, phase: randRange(0, 6),
    hitT: 0, downT: 0, group: null, legL: null, legR: null, armL: null, armR: null,
  };
  ped.group = buildMesh(ped);
  ped.group.position.set(x, 0, z);
  scene.add(ped.group);
  G.peds.push(ped);
  return ped;
}

function placeWalk(ped, segIdx, t, dir) {
  ped.seg = segIdx; ped.t = t; ped.dir = dir;
  ped.lane = (rand() < 0.5 ? 8.8 : -8.8);
  const p = segPoint(SEGMENTS[segIdx], t, ped.lane);
  ped.x = p.x; ped.z = p.z;
}

export function initPedsSpawn() {
  for (let i = 0; i < 36; i++) {
    const ped = addPed(0, 0);
    placeWalk(ped, Math.floor(rand() * 14), rand(), rand() < 0.5 ? 1 : -1);
    ped.group.position.set(ped.x, 0, ped.z);
  }
}

export function clearPedsNear(x, z, r) {
  for (const ped of G.peds) {
    if (ped.hostile) continue;
    if (Math.hypot(ped.x - x, ped.z - z) < r) {
      placeWalk(ped, Math.floor(rand() * 14), rand(), 1);
      if (Math.hypot(ped.x - x, ped.z - z) < r) { ped.x = -180; ped.z = 180; ped.seg = 0; ped.t = 0.5; }
      ped.group.position.set(ped.x, 0, ped.z);
    }
  }
}

export function hurtPed(ped, dmg) {
  if (ped.state === "down") return;
  ped.hp -= dmg;
  if (ped.hp <= 0) {
    ped.state = "down"; ped.downT = 0;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.25;
  } else if (!ped.hostile) {
    ped.state = "flee"; ped.fleeT = randRange(1.6, 3);
  }
}

function nextSeg(ped) {
  const seg = SEGMENTS[ped.seg];
  const atB = ped.dir > 0;
  const nx = atB ? seg.bx : seg.ax, nz = atB ? seg.bz : seg.az;
  const node = NODES.get(nx + "," + nz);
  if (!node || !node.segs.length) { ped.dir *= -1; return; }
  const options = node.segs.filter((i) => i !== ped.seg);
  const next = options.length ? pick(options) : ped.seg;
  const ns = SEGMENTS[next];
  if (ns.ax === nx && ns.az === nz) { ped.seg = next; ped.t = 0; ped.dir = 1; }
  else { ped.seg = next; ped.t = 1; ped.dir = -1; }
  ped.lane = (rand() < 0.5 ? 8.8 : -8.8);
}

export function updatePeds(dt) {
  const px = G.player.x, pz = G.player.z;
  for (const ped of G.peds) {
    if (ped.state === "down") { ped.downT += dt; continue; }
    ped.hitT = Math.max(0, ped.hitT - dt);
    let moving = 0;
    if (ped.state === "fight") {
      const d = Math.hypot(px - ped.x, pz - ped.z);
      if (G.player.car || G.player.dead) { /* muscle only fights a man on foot */ }
      else if (d > 1.5) {
        const want = Math.atan2(px - ped.x, pz - ped.z);
        ped.heading = want;
        ped.x += Math.sin(want) * 2.5 * dt;
        ped.z += Math.cos(want) * 2.5 * dt;
        moving = 2.5;
      } else if (ped.hitT <= 0) {
        ped.hitT = 0.95;
        hurtPlayer(6);
        ped.armR.rotation.x = -2.2;
      }
    } else if (ped.state === "flee") {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.x - px, ped.z - pz);
      ped.heading = away;
      ped.x += Math.sin(away) * 3.4 * dt;
      ped.z += Math.cos(away) * 3.4 * dt;
      moving = 3.4;
      if (ped.fleeT <= 0) {
        ped.state = "walk";
        // rejoin the nearest segment at its closest point (good enough: snap t by axis)
        let best = 0, bd = 1e9;
        SEGMENTS.forEach((s, i) => { const dd = Math.hypot((s.ax + s.bx) / 2 - ped.x, (s.az + s.bz) / 2 - ped.z); if (dd < bd) { bd = dd; best = i; } });
        ped.seg = best; ped.t = 0.5; ped.dir = 1;
      }
    } else {
      // walk the sidewalks; scatter if a fast car or a chase comes close
      const threat = (G.player.car && Math.abs(G.player.car.speed) > 14 && Math.hypot(px - ped.x, pz - ped.z) < 9)
        || (G.wanted >= 2 && Math.hypot(px - ped.x, pz - ped.z) < 8);
      if (threat) { ped.state = "flee"; ped.fleeT = randRange(1.2, 2.4); }
      else {
        const seg = SEGMENTS[ped.seg];
        const len = segLength(seg) || 1;
        const spd = 1.35;
        ped.t += (spd * dt * ped.dir) / len;
        if (ped.t > 1) { ped.t = 1; nextSeg(ped); }
        else if (ped.t < 0) { ped.t = 0; nextSeg(ped); }
        const p = segPoint(SEGMENTS[ped.seg], ped.t, ped.lane);
        ped.x = p.x; ped.z = p.z;
        ped.heading = Math.atan2(p.hx * ped.dir, p.hz * ped.dir);
        moving = spd;
      }
    }
    if (ped.state !== "walk" || true) {
      if (!isLand(ped.x, ped.z)) { ped.x -= Math.sin(ped.heading) * 2 * dt; ped.z -= Math.cos(ped.heading) * 2 * dt; }
      const res = collideWorld(ped.x, ped.z, 0.4);
      ped.x = res.x; ped.z = res.z;
    }
    ped.phase += dt * (moving > 0 ? moving * 3.4 : 0);
    const sw = Math.sin(ped.phase) * (moving > 0 ? 0.5 : 0);
    ped.legL.rotation.x = sw; ped.legR.rotation.x = -sw;
    ped.armL.rotation.x = -sw * 0.7;
    if (ped.hitT < 0.6) ped.armR.rotation.x = sw * 0.7;
    ped.group.position.set(ped.x, 0, ped.z);
    ped.group.rotation.y = ped.heading;
  }
}
