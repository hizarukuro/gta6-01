// city.js — Vista Marina itself: the road network and its traffic graph, the
// blocks and towers with their neon, the beach and the water, Cayo Verde and
// the causeway that reaches it, palms, lamps and props. It also owns the sky:
// a gradient dome, the sun's daily arc and the dusk/night colour grading.

import * as THREE from 'three';
import { WORLD } from './state.js';

// Seeded rng — the city must come out identical on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);
const pick = (arr) => arr[(rand() * arr.length) | 0];

export const LOCATIONS = {
  garage:    { x: -228, z: -228, label: "Mara's Garage" },
  warehouse: { x: -228, z: 228,  label: 'Portside Warehouse' },
  club:      { x: 316,  z: 40,   label: 'Club Vela' },
  showroom:  { x: 222,  z: -222, label: 'Cabrillo Showroom' },
  hospital:  { x: 45,   z: 138,  label: 'Vista General' },
  policeHQ:  { x: -45,  z: -45,  label: 'VMPD Central' },
  cayoHouse: { x: 624,  z: -306, label: 'Cayo Verde Safehouse' },
  beachHut:  { x: 398,  z: 66,   label: 'Lifeguard Hut' },
};

// ------------------------------------------------------------ canvas paints
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function facadeTexture(base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 12; y += 16) {
      for (let x = 9; x < w - 12; x += 15) {
        g.fillStyle = rand() < litRatio ? pick(['#ffd98a', '#ffeec2', '#9be7ff']) : '#141a26';
        g.fillRect(x, y, 9, 10);
      }
    }
  });
}

function neonSignTexture(text, color) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = '#0d0d18'; g.fillRect(0, 0, w, h);
    g.font = '900 52px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 8;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.85;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function roadTexture() {
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#26282e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2d2f36'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = '#e8e4da';
    g.fillRect(3, 0, 2, h); g.fillRect(w - 5, 0, 2, h);
    g.fillStyle = '#ffd94d';
    g.fillRect(w / 2 - 2, 6, 4, 44); g.fillRect(w / 2 - 2, 78, 4, 44);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------- traffic graph
// Nodes at every junction; edges along every road. Traffic and police both
// navigate by this graph, and the minimap draws it.
export function buildGraph() {
  const nodes = new Map();
  const addNode = (x, z) => {
    const key = `${x},${z}`;
    if (!nodes.has(key)) nodes.set(key, { x, z, key, adj: [] });
    return nodes.get(key);
  };
  const link = (a, b) => {
    if (!a.adj.includes(b.key)) a.adj.push(b.key);
    if (!b.adj.includes(a.key)) b.adj.push(a.key);
  };
  const { avenues, streets, boulevardX, island } = WORLD;
  const vLines = [...avenues, boulevardX];
  for (const x of vLines) for (const z of streets) addNode(x, z);
  for (const x of vLines) {
    const col = streets.map((z) => nodes.get(`${x},${z}`)).sort((a, b) => a.z - b.z);
    for (let i = 0; i + 1 < col.length; i++) link(col[i], col[i + 1]);
  }
  for (const z of streets) {
    const row = vLines.map((x) => nodes.get(`${x},${z}`)).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < row.length; i++) link(row[i], row[i + 1]);
  }
  // the causeway, boulevard to island shore
  const cw = [345, 430, 505, 560].map((x) => addNode(x, WORLD.causewayZ));
  for (let i = 0; i + 1 < cw.length; i++) link(cw[i], cw[i + 1]);
  // the island's own little grid
  for (const x of island.xs) for (const z of island.zs) addNode(x, z);
  for (const x of island.xs) {
    const col = island.zs.map((z) => nodes.get(`${x},${z}`)).sort((a, b) => a.z - b.z);
    for (let i = 0; i + 1 < col.length; i++) link(col[i], col[i + 1]);
  }
  for (const z of island.zs) {
    const row = island.xs.map((x) => nodes.get(`${x},${z}`)).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < row.length; i++) link(row[i], row[i + 1]);
  }
  return { nodes };
}

export function nearestNode(graph, x, z) {
  let best = null, bd = Infinity;
  for (const n of graph.nodes.values()) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// ------------------------------------------------------------------ the city
const HOTEL_SIGNS = [
  ['HOTEL BRISA', '#ff5d8f'], ['PALMS HOTEL', '#ffb340'], ['HOTEL CORAL', '#ff7847'],
  ['TIDE HOTEL', '#57a8ff'], ['MARINA 9', '#27e0c8'], ['VISTA TOWERS', '#c792ff'],
  ['CLUB VELA', '#ff3d77'], ['BAR LUMEN', '#ffd94d'], ['CAFE SOL', '#ff9ecf'],
  ['HOTEL ONDA', '#7dffcb'], ['PIER 9 DINER', '#ffb340'], ['SOLSTICE', '#ff5d8f'],
];

export function buildCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = []; // axis-aligned boxes: {minX, maxX, minZ, maxZ}
  const { avenues, streets, boulevardX, beachX, waterX, island } = WORLD;

  // sky, sun, ambient
  const hemi = new THREE.HemisphereLight(0xbdd7ff, 0x3a2e28, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 190, bottom: -190, far: 900 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const skyUni = {
    top: { value: new THREE.Color(0x2a4d8f) },
    mid: { value: new THREE.Color(0xff9a5c) },
    bot: { value: new THREE.Color(0x2a1e33) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1600, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: skyUni,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;' +
        'void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  scene.add(sunDisc);
  scene.fog = new THREE.Fog(0xe8a37c, 240, 1250);

  // land, sand, sea
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshLambertMaterial({ color: 0x43464e }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(160, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(waterX - beachX + 30, 700), new THREE.MeshLambertMaterial({ color: 0xc9b183 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((beachX + waterX) / 2 + 8, 0, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const waterTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#175d8a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,220,255,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      const y = rand() * h;
      g.moveTo(rand() * 30, y); g.lineTo(40 + rand() * 60, y + 3); g.stroke();
    }
  });
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(30, 30);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 1500),
    new THREE.MeshPhongMaterial({ color: 0x2a7ab0, map: waterTex, shininess: 90, specular: 0x99ccee }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(waterX + 372, -0.35, 0);
  group.add(water);

  const isle = new THREE.Mesh(new THREE.BoxGeometry(230, 0.5, 230), new THREE.MeshLambertMaterial({ color: 0x3a3d43 }));
  isle.position.set(island.cx, -0.25, island.cz);
  isle.receiveShadow = true;
  group.add(isle);

  // roads — each strip clones the asphalt so its dashes repeat along its length
  const roadTex = roadTexture();
  function roadStrip(x, z, wdt, len, alongZ) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, Math.max(1, Math.round(len / 26)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, len), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    if (!alongZ) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.receiveShadow = true;
    group.add(m);
  }
  for (const x of avenues) roadStrip(x, 0, 14, 554, true);
  roadStrip(boulevardX, 0, 16, 554, true);
  for (const z of streets) roadStrip(31, z, 14, 636, false);
  for (const x of island.xs) roadStrip(x, island.cz, 12, 132, true);
  for (const z of island.zs) roadStrip(island.cx, z, 12, 132, false);
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(240, 0.5, 15), new THREE.MeshLambertMaterial({ color: 0x4a4e57 }));
  causeway.position.set(452, -0.24, WORLD.causewayZ);
  group.add(causeway);
  roadStrip(452, WORLD.causewayZ, 13, 236, false);

  // boulevard sidewalks
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a958c });
  for (const sx of [boulevardX - 11, boulevardX + 11]) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(5, 554), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(sx, 0.03, 0);
    walk.receiveShadow = true;
    group.add(walk);
  }

  // buildings
  function building(x, z, w, d, hgt, facade, signText, signColor, signSide) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), new THREE.MeshLambertMaterial({ map: facade }));
    mesh.position.set(x, hgt / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
    if (signText) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.92, 26), 4.6),
        new THREE.MeshBasicMaterial({ map: neonSignTexture(signText, signColor) }),
      );
      if (signSide === 'west') { sign.position.set(x - w / 2 - 0.15, hgt - 4.5, z); sign.rotation.y = -Math.PI / 2; }
      else if (signSide === 'east') { sign.position.set(x + w / 2 + 0.15, hgt - 4.5, z); sign.rotation.y = Math.PI / 2; }
      else sign.position.set(x, hgt - 4.5, z + d / 2 + 0.15);
      group.add(sign);
    }
    return mesh;
  }

  const facadeCols = ['#4a4258', '#5a4638', '#3c4a5a', '#6a5244', '#54455e', '#715f4a', '#44586a'];
  let signIdx = 0;
  for (let i = 0; i + 1 < avenues.length; i++) {
    for (let j = 0; j + 1 < streets.length; j++) {
      const cx = (avenues[i] + avenues[i + 1]) / 2;
      const cz = (streets[j] + streets[j + 1]) / 2;
      const portside = cx < -90 && cz > 90;
      const oldMarina = cx < -90 && cz < -90;
      const plots = portside || oldMarina ? 1 : 2;
      for (let p = 0; p < plots; p++) {
        const ox = plots === 1 ? 0 : (p === 0 ? -19 : 19);
        const oz = plots === 1 ? 0 : (p === 0 ? -19 : 19);
        const w = portside ? 52 : 24 + rand() * 10;
        const d = portside ? 46 : 24 + rand() * 10;
        const hgt = portside ? 9 + rand() * 4 : oldMarina ? 8 + rand() * 9 : 16 + rand() * 34;
        let sign = null, signColor = '#ffb340';
        if (!portside && !oldMarina && rand() < 0.4) {
          const s = HOTEL_SIGNS[signIdx++ % HOTEL_SIGNS.length];
          sign = s[0]; signColor = s[1];
        }
        building(cx + ox, cz + oz, w, d, hgt, facadeTexture(pick(facadeCols), 0.42), sign, signColor, 'south');
      }
    }
  }
  // the Neon Mile hotel row, tall slabs facing the shore road
  for (let k = 0; k < 6; k++) {
    const s = HOTEL_SIGNS[k % HOTEL_SIGNS.length];
    building(306, -225 + k * 88, 34, 52, 34 + rand() * 26, facadeTexture('#5e4453', 0.55), s[0], s[1], 'east');
  }
  // places the story sends you to
  building(LOCATIONS.garage.x, LOCATIONS.garage.z, 30, 24, 8, facadeTexture('#5a4a3a', 0.2), "MARA'S GARAGE", '#27e0c8', 'south');
  building(LOCATIONS.warehouse.x, LOCATIONS.warehouse.z, 46, 36, 11, facadeTexture('#4c4c44', 0.15), 'PORTSIDE FREIGHT', '#ffb340', 'south');
  building(LOCATIONS.showroom.x, LOCATIONS.showroom.z, 34, 26, 10, facadeTexture('#3d5a74', 0.7), 'CABRILLO', '#57a8ff', 'south');
  building(LOCATIONS.hospital.x, LOCATIONS.hospital.z, 30, 24, 14, facadeTexture('#8a929c', 0.5), 'VISTA GENERAL', '#ffffff', 'south');
  building(LOCATIONS.policeHQ.x, LOCATIONS.policeHQ.z, 30, 24, 13, facadeTexture('#3a4666', 0.4), 'VMPD', '#57a8ff', 'south');
  building(LOCATIONS.cayoHouse.x, LOCATIONS.cayoHouse.z, 22, 18, 8, facadeTexture('#7a6248', 0.5), 'CAYO VERDE', '#7dffcb', 'south');
  for (const vx of [578, 662]) for (const vz of [-318, -222]) {
    building(vx, vz, 16, 14, 7 + rand() * 4, facadeTexture('#6a5a48', 0.5), null, '#fff', 'south');
  }

  // palms along the shore and the median
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.45, 7.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b4f, side: THREE.DoubleSide });
  const frondGeo = new THREE.SphereGeometry(2.9, 9, 6);
  function palm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.75, z);
    trunk.castShadow = true;
    trunk.rotation.z = (rand() - 0.5) * 0.09;
    const crown = new THREE.Mesh(frondGeo, frondMat);
    crown.position.set(x, 7.7, z);
    crown.scale.set(1.25, 0.3, 1.25);
    group.add(trunk, crown);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
  for (let z = -260; z <= 260; z += 24) { palm(boulevardX - 11, z + 6); palm(boulevardX + 12, z + 17); }
  for (let i = 0; i < 14; i++) palm(beachX + 14 + rand() * 40, -280 + rand() * 560);
  for (let z = -260; z <= 260; z += 52) palm(-7, z + 12);

  // streetlights down every avenue
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 6.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const lampGeo = new THREE.SphereGeometry(0.42, 8, 6);
  for (const x of [...avenues, boulevardX]) {
    for (let z = -252; z <= 252; z += 56) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 8.2, 3.2, z);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + 8.2, 6.5, z);
      group.add(pole, lamp);
    }
  }

  // beach umbrellas and the lifeguard hut
  const umbCols = [0xff5d8f, 0xffb340, 0x57a8ff, 0x27e0c8];
  for (let i = 0; i < 9; i++) {
    const ux = beachX + 12 + rand() * 44, uz = -260 + rand() * 520;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), poleMat);
    pole.position.set(ux, 1.3, uz);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.8, 8), new THREE.MeshLambertMaterial({ color: pick(umbCols) }));
    top.position.set(ux, 2.7, uz);
    group.add(pole, top);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 4), new THREE.MeshLambertMaterial({ color: 0xf2f0e8 }));
  hut.position.set(LOCATIONS.beachHut.x, 1.7, LOCATIONS.beachHut.z);
  hut.castShadow = true;
  group.add(hut);
  colliders.push({ minX: LOCATIONS.beachHut.x - 2.9, maxX: LOCATIONS.beachHut.x + 2.9, minZ: LOCATIONS.beachHut.z - 2.4, maxZ: LOCATIONS.beachHut.z + 2.4 });

  // portside freight crates
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  for (let i = 0; i < 22; i++) {
    const cx = -258 + rand() * 130, cz = 108 + rand() * 130;
    const s = 2.2 + rand() * 1.6;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(cx, s / 2, cz);
    crate.castShadow = true;
    group.add(crate);
    colliders.push({ minX: cx - s / 2, maxX: cx + s / 2, minZ: cz - s / 2, maxZ: cz + s / 2 });
  }

  // the mission objective beam — a pillar of gold light missions move around
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 60, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.set(0, 30, -9999);
  group.add(beam);

  const _sunCol = new THREE.Color();
  const _moonCol = new THREE.Color(0x8fb4ff);
  const _nightTop = new THREE.Color().setHSL(0.66, 0.6, 0.03);
  const _nightMid = new THREE.Color().setHSL(0.64, 0.55, 0.045);
  const _fogTint = new THREE.Color(0x1a1426);

  return {
    group, colliders, beam, sun, hemi,
    setBeam(x, z, color) {
      beam.position.set(x, 30, z);
      if (color) beam.material.color.set(color);
    },
    hideBeam() { beam.position.z = -9999; },
    // Advance the day: sun arc, sky colours, fog, lamp warmth.
    update(dt, hour) {
      waterTex.offset.x = (waterTex.offset.x + dt * 0.008) % 1;
      waterTex.offset.y = (waterTex.offset.y + dt * 0.005) % 1;
      const ang = ((hour - 6) / 12) * Math.PI; // 06:00 east horizon → 18:00 west
      const elev = Math.sin(ang);
      const night = THREE.MathUtils.clamp((-elev - 0.08) * 2.0, 0, 1);
      const lightElev = elev < -0.2 ? 0.45 : Math.max(elev, 0.13); // moon stands in at night
      sun.position.set(Math.cos(ang) * 700, lightElev * 620 + 40, -260);
      sunDisc.position.copy(sun.position).multiplyScalar(1.9);
      sunDisc.lookAt(0, 0, 0);
      sunDisc.visible = night < 0.6;
      const day = THREE.MathUtils.clamp(elev * 1.6 + 0.25, 0, 1);
      const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev - 0.16) * 4.2, 0, 1);
      sun.intensity = (0.55 + day * 1.55) * (1 - night) + 0.22 * night;
      sun.color.setHSL(0.09 + day * 0.035, 0.75, 0.62 + day * 0.1).lerp(_moonCol, night);
      hemi.intensity = (0.42 + day * 0.5) * (1 - night * 0.3);
      skyUni.top.value.setHSL(0.62, 0.62, 0.1 + day * 0.32).lerp(_nightTop, night);
      skyUni.mid.value.setHSL(0.06 + day * 0.035, 0.85, 0.28 + dusk * 0.3 + day * 0.12).lerp(_nightMid, night);
      skyUni.bot.value.setHSL(0.75, 0.4, 0.06 + day * 0.05);
      scene.fog.color.copy(skyUni.mid.value).lerp(_fogTint, 0.25);
      lampMat.color.copy(_sunCol.setHSL(0.11, 0.7, 0.35 + (1 - day) * 0.45));
      sun.target.position.set(0, 0, 0);
    },
  };
}

// Push a circle (car, pedestrian) out of every building box it overlaps.
// Mutates pos {x, z}; returns true when a push happened.
export function collideCircle(colliders, pos, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
      return true;
    }
  }
  return false;
}
