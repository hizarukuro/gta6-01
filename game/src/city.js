// city.js — builds Vista Marina itself: ground, roads, buildings with lit
// windows, neon signs, palms, beach, the causeway, Cayo Verde, and the sky.
// Also owns the day cycle (sunset into neon night) and the objective beam.
import * as THREE from "three";
import {
  G, SEGMENTS, AVENUES, STREETS, BOULEVARD_X, CAUSEWAY_Z,
  rand, randRange, randInt, pick, clamp, lerp, districtAt,
} from "./state.js";

let scene = null;
let sun = null, hemi = null, skyMat = null, waterMat = null;
let beam = null, beamRing = null;
const dayMats = [];      // materials whose emissive follows darkness
const signMats = [];     // neon sign materials (flicker)
const lampMat = { mat: null };

const SKY = {
  nightTop: new THREE.Color(0x0a0e2c), nightHor: new THREE.Color(0x241239),
  duskTop: new THREE.Color(0x35479e), duskHor: new THREE.Color(0xff9a3c),
  dayTop: new THREE.Color(0x5ea9e6), dayHor: new THREE.Color(0xcfe6f7),
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();

// ---------- canvas texture helpers ----------
function facadeTextures(base, trim) {
  const w = 128, h = 256;
  const day = document.createElement("canvas"); day.width = w; day.height = h;
  const d = day.getContext("2d");
  d.fillStyle = base; d.fillRect(0, 0, w, h);
  d.fillStyle = trim; d.fillRect(0, 0, w, 10); d.fillRect(0, h - 8, w, 8);
  const glow = document.createElement("canvas"); glow.width = w; glow.height = h;
  const g = glow.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  const cols = 6, rows = 13;
  for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < rows; ry++) {
    const x = 8 + cx * 19, y = 16 + ry * 18, lit = rand() < 0.42;
    d.fillStyle = lit ? "#5d6a72" : "#232a33"; d.fillRect(x, y, 12, 11);
    if (lit) { g.fillStyle = pick(["#ffc46b", "#ffe9a8", "#9fd8ff", "#ffb35c"]); g.fillRect(x, y, 12, 11); }
  }
  const map = new THREE.CanvasTexture(day);
  const emissiveMap = new THREE.CanvasTexture(glow);
  return { map, emissiveMap };
}

function signTexture(text, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 512, 96);
  x.font = "900 58px 'Arial Black', Arial, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = color; x.shadowBlur = 26;
  x.fillStyle = color;
  x.fillText(text, 256, 50); x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function leafTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const x = c.getContext("2d");
  const grad = x.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#3f9e4d"); grad.addColorStop(1, "#1e5c2a");
  x.fillStyle = grad;
  x.beginPath(); x.moveTo(32, 0); x.lineTo(58, 110); x.lineTo(32, 128); x.lineTo(6, 110); x.closePath(); x.fill();
  return new THREE.CanvasTexture(c);
}

// ---------- builders ----------
function buildGroundAndRoads() {
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(564, 524),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 })
  );
  base.rotation.x = -Math.PI / 2; base.position.set(19, -0.05, 0);
  base.receiveShadow = true; scene.add(base);

  const sandMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 524),
    new THREE.MeshLambertMaterial({ color: 0xc9a86a })
  );
  sandMesh.rotation.x = -Math.PI / 2; sandMesh.position.set(281, -0.02, 0);
  sandMesh.receiveShadow = true; scene.add(sandMesh);

  const island = new THREE.Mesh(
    new THREE.PlaneGeometry(164, 156),
    new THREE.MeshLambertMaterial({ color: 0x33373d })
  );
  island.rotation.x = -Math.PI / 2; island.position.set(508, -0.04, 10);
  island.receiveShadow = true; scene.add(island);

  waterMat = new THREE.MeshLambertMaterial({ color: 0x14486b });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(300, -0.55, 0);
  scene.add(water);

  const walkMat = new THREE.MeshLambertMaterial({ color: 0x43464d });
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x1e2026 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d3a8 });
  for (const s of SEGMENTS) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const ang = Math.atan2(s.bz - s.az, s.bx - s.ax);
    const cx = (s.ax + s.bx) / 2, cz = (s.az + s.bz) / 2;
    const isCauseway = s.az === CAUSEWAY_Z && s.ax >= BOULEVARD_X;
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(len, isCauseway ? 13 : 16.5), walkMat);
    walk.rotation.x = -Math.PI / 2; walk.rotation.z = -ang;
    walk.position.set(cx, 0.0, cz); walk.receiveShadow = true; scene.add(walk);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(len, isCauseway ? 11 : 13), roadMat);
    road.rotation.x = -Math.PI / 2; road.rotation.z = -ang;
    road.position.set(cx, 0.02, cz); road.receiveShadow = true; scene.add(road);
    if (!isCauseway) {
      const dashes = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.35), lineMat);
      dashes.rotation.x = -Math.PI / 2; dashes.rotation.z = -ang;
      dashes.position.set(cx, 0.035, cz); scene.add(dashes);
    }
  }

  // Causeway deck sides + pillars so the crossing reads as a bridge.
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x555a61 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(208, 1.1, 13.6), deckMat);
  deck.position.set(348, -0.55, CAUSEWAY_Z); scene.add(deck);
  for (let x = 262; x <= 440; x += 30) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 9), deckMat);
    pillar.position.set(x, -3.4, CAUSEWAY_Z); scene.add(pillar);
  }
  const railMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  for (const dz of [-6.6, 6.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(208, 0.7, 0.4), railMat);
    rail.position.set(348, 0.55, CAUSEWAY_Z + dz); scene.add(rail);
  }
}

const SIGN_WORDS = [
  ["MARINA 9", "#ff5e7a"], ["CASINO SOL", "#ffd23c"], ["HOTEL LUMEN", "#7dd8ff"],
  ["CLUB VELA", "#ff9a3c"], ["PALMS", "#7dff9a"], ["BAR OTRA", "#ff7dd8"],
  ["HOTEL BRISA", "#9fd8ff"], ["NEON", "#ff5e7a"],
];
// Ground-floor shops for the buildings that front the boulevard: a lit
// window, a name board and a canvas awning at street level, so the Mile
// reads as a working strip from the road, not a row of blank towers.
const STOREFRONTS = [
  ["CAFÉ OLE", "#ffd23c"], ["TACO MAR", "#ff9a3c"], ["SURF CO", "#7dd8ff"],
  ["PIZZA VELA", "#ff5e7a"], ["DINER LUNA", "#ffe9a8"], ["FARMACIA", "#7dff9a"],
  ["BAIT & TACKLE", "#9fd8ff"], ["GELATO MIA", "#ff7dd8"], ["BAR MAREA", "#ffb35c"],
  ["LIBROS SOL", "#ffd9a8"],
];
const AWNING_TONES = [0xd8546e, 0x2e8f86, 0xe8a13c, 0x3f6db5, 0x8c2f39];
const WALL_TONES = ["#4a4152", "#5a4636", "#39424e", "#52424a", "#414a42", "#5d5340"];

function buildBlocks() {
  const variants = WALL_TONES.map((tone) => {
    const { map, emissiveMap } = facadeTextures(tone, "#2b2733");
    const mat = new THREE.MeshLambertMaterial({
      map, emissive: 0xffc98a, emissiveMap, emissiveIntensity: 0,
    });
    dayMats.push(mat);
    return mat;
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x23242a });
  const boxGeoCache = new Map();
  function boxGeo(w, h, d) {
    const k = w + "x" + h + "x" + d;
    if (!boxGeoCache.has(k)) boxGeoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return boxGeoCache.get(k);
  }
  let signIdx = 0;
  let shopIdx = 0;
  function addBuilding(cx, cz, w, d, h) {
    const mat = variants[Math.floor(rand() * variants.length) % variants.length];
    const m = new THREE.Mesh(boxGeo(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    G.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    // Neon signs on Neon Mile blocks facing the boulevard.
    const district = districtAt(cx, cz);
    if (district === "NEON MILE" && cx > 175 && rand() < 0.75) {
      const [word, color] = SIGN_WORDS[signIdx++ % SIGN_WORDS.length];
      const sm = new THREE.MeshBasicMaterial({
        map: signTexture(word, color), transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      signMats.push(sm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 1.7, 26), 4.6), sm);
      sign.position.set(cx + w / 2 + 0.4, h * randRange(0.55, 0.8), cz);
      sign.rotation.y = Math.PI / 2;
      scene.add(sign);
    }
    // Storefront on the boulevard face of Mile buildings whose east wall
    // stands near the sidewalk: window, name board, awning.
    if (district === "NEON MILE" && cx + w / 2 >= 222) {
      const face = cx + w / 2;
      const [word, color] = STOREFRONTS[shopIdx % STOREFRONTS.length];
      const awnMat = new THREE.MeshLambertMaterial({ color: AWNING_TONES[shopIdx % AWNING_TONES.length] });
      shopIdx++;
      const winMat = new THREE.MeshLambertMaterial({ color: 0x27384a, emissive: 0xffc98a, emissiveIntensity: 0 });
      dayMats.push(winMat);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 12), 2.5), winMat);
      win.position.set(face + 0.12, 1.45, cz);
      win.rotation.y = Math.PI / 2;
      scene.add(win);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.85, 13), 1.7),
        new THREE.MeshBasicMaterial({ map: signTexture(word, color), transparent: true, side: THREE.DoubleSide, depthWrite: false })
      );
      board.position.set(face + 0.25, 3.9, cz);
      board.rotation.y = Math.PI / 2;
      scene.add(board);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, Math.min(w * 0.85, 13)), awnMat);
      awning.position.set(face + 0.8, 3.0, cz);
      awning.rotation.z = -0.3;
      scene.add(awning);
    }
    return m;
  }

  const xBands = [[-256, -220], [-200, -140], [-120, -60], [-40, 20], [40, 100], [120, 180], [198, 234]];
  const zBands = [[-256, -220], [-200, -140], [-120, -60], [-40, 20], [40, 100], [120, 180], [198, 234]];
  for (const [x0, x1] of xBands) for (const [z0, z1] of zBands) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const district = districtAt(cx, cz);
    if (district === "PORTSIDE" && rand() < 0.45) {
      // container stacks instead of a tower
      const contMat = [0xb5502e, 0x2e6db5, 0x3f9e4d, 0x8c8f96].map(
        (c) => new THREE.MeshLambertMaterial({ color: c }));
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) {
        const cm = new THREE.Mesh(boxGeo(11, 2.6, 4.4), contMat[i % contMat.length]);
        cm.position.set(cx + randRange(-9, 9), 1.3 + (i > 2 ? 2.6 : 0), cz + randRange(-9, 9));
        cm.rotation.y = rand() < 0.5 ? 0 : Math.PI / 2;
        cm.castShadow = true; scene.add(cm);
      }
      G.colliders.push({ minX: cx - 13, maxX: cx + 13, minZ: cz - 13, maxZ: cz + 13 });
      continue;
    }
    const lots = rand() < 0.4 ? 1 : 2;
    for (let i = 0; i < lots; i++) {
      const w = randRange(13, 20), d = randRange(13, 20);
      const lx = lots === 1 ? cx : cx + (i === 0 ? -11 : 11) + randRange(-2, 2);
      const lz = lots === 1 ? cz : cz + randRange(-8, 8);
      let h;
      if (district === "NEON MILE") h = randRange(26, 58);
      else if (district === "VISTA CENTRO") h = randRange(15, 38);
      else if (district === "OLD MARINA") h = randRange(9, 20);
      else if (district === "PORTSIDE") h = randRange(6, 11);
      else h = randRange(8, 16);
      addBuilding(lx, lz, w, d, h);
    }
  }
  // Cayo Verde resort blocks.
  for (const [x0, x1] of [[458, 498], [508, 556]]) for (const [z0, z1] of [[-34, -6], [16, 52]]) {
    addBuilding((x0 + x1) / 2, (z0 + z1) / 2, randRange(16, 24), randRange(13, 18), randRange(9, 19));
  }
}

function buildGreeneryAndLights() {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const leafMat = new THREE.MeshLambertMaterial({
    map: leafTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.4,
  });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6.4, 5);
  const leafGeo = new THREE.PlaneGeometry(1.5, 4.6);
  leafGeo.translate(0, 2.2, 0); // pivot at the frond's base so it can droop
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.2; trunk.rotation.z = randRange(-0.06, 0.06);
    trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 6.45;
      leaf.rotation.order = "YXZ";
      leaf.rotation.y = (i / 6) * Math.PI * 2 + randRange(-0.2, 0.2);
      leaf.rotation.x = -1.08;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let z = -225; z <= 225; z += 17) { palm(236.5, z + randRange(-2, 2)); if (rand() < 0.8) palm(254, z + randRange(-3, 3)); }
  for (let i = 0; i < 26; i++) palm(randRange(268, 296), randRange(-240, 240));
  for (let i = 0; i < 10; i++) palm(randRange(440, 580), rand() < 0.5 ? randRange(-58, -46) : randRange(66, 80));

  // Beach umbrellas.
  const umbMats = [0xff5e7a, 0xffd23c, 0x3ca9ff, 0xff9a3c].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5);
  const shadeGeo = new THREE.ConeGeometry(1.9, 0.8, 8);
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, trunkMat); pole.position.y = 1.2; g.add(pole);
    const shade = new THREE.Mesh(shadeGeo, umbMats[i % umbMats.length]); shade.position.y = 2.5; g.add(shade);
    g.position.set(randRange(270, 295), 0, randRange(-235, 235));
    scene.add(g);
  }

  // Street lights along the avenues and the boulevard.
  lampMat.mat = new THREE.MeshBasicMaterial({ color: 0x554a33 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2e33 });
  const poleGeoL = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 5);
  const bulbGeo = new THREE.SphereGeometry(0.32, 6, 5);
  for (const x of [...AVENUES, BOULEVARD_X]) for (let z = -200; z <= 200; z += 40) {
    const pole = new THREE.Mesh(poleGeoL, poleMat);
    pole.position.set(x + 7.6, 2.8, z); scene.add(pole);
    const bulb = new THREE.Mesh(bulbGeo, lampMat.mat);
    bulb.position.set(x + 7.6, 5.7, z); scene.add(bulb);
  }
}

// ---------- public API ----------
export function initCity(s) {
  scene = s;
  hemi = new THREE.HemisphereLight(0xbdd7ff, 0x3a2c22, 0.75);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffd9a8, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  sun.shadow.camera.far = 420;
  scene.add(sun); scene.add(sun.target);

  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x35479e) }, hor: { value: new THREE.Color(0xff9a3c) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.75)), 1.0); }",
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 20, 12), skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(0x51365e, 190, 900);

  buildGroundAndRoads();
  buildBlocks();
  buildGreeneryAndLights();

  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 70, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.visible = false; scene.add(beam);
  beamRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
  );
  beamRing.rotation.x = -Math.PI / 2; beamRing.visible = false; scene.add(beamRing);
}

export function setObjectiveBeam(x, z) {
  if (x === null || x === undefined) { beam.visible = false; beamRing.visible = false; return; }
  beam.visible = true; beamRing.visible = true;
  beam.position.set(x, 35, z);
  beamRing.position.set(x, 0.15, z);
}

// Daylight factor for an hour: 0 night, 1 full day; dusk warmth peaks ~18:30.
function daylight(h) {
  if (h < 5.5 || h >= 20) return 0;
  if (h < 7.5) return (h - 5.5) / 2;
  if (h <= 16.5) return 1;
  if (h < 20) return 1 - (h - 16.5) / 3.5;
  return 0;
}

export function updateCity(dt) {
  const h = (G.clockMin % 1440) / 60;
  const d = daylight(h);
  const dusk = clamp(1 - Math.abs(h - 18.4) / 1.6, 0, 1) * (h > 12 ? 1 : 0.25);
  // Sky: day <-> dusk <-> night blend.
  _c1.copy(SKY.dayTop).lerp(SKY.duskTop, dusk).lerp(SKY.nightTop, 1 - Math.max(d, dusk * 0.85));
  _c2.copy(SKY.dayHor).lerp(SKY.duskHor, dusk).lerp(SKY.nightHor, 1 - Math.max(d, dusk * 0.85));
  skyMat.uniforms.top.value.copy(_c1);
  skyMat.uniforms.hor.value.copy(_c2);
  scene.fog.color.copy(_c2).lerp(new THREE.Color(0x0a0e2c), 0.35);

  const sunAng = ((h - 6) / 12) * Math.PI; // rises 6h, sets 18h
  const elev = Math.sin(clamp(sunAng, 0, Math.PI));
  const px = G.player.x, pz = G.player.z;
  sun.position.set(px + Math.cos(sunAng) * 160, 30 + elev * 150, pz + 60);
  sun.target.position.set(px, 0, pz);
  sun.intensity = 0.3 + d * 1.5;
  // A low sun goes golden: hue warms and saturates as the elevation drops,
  // so late afternoon reads as warm light instead of pale dusk.
  const warm = clamp(1 - elev * 1.5, 0, 1);
  sun.color.setHSL(0.115 - warm * 0.04, 0.38 + warm * 0.3, 0.62);
  hemi.intensity = 0.46 + d * 0.44;

  const dark = 1 - d;
  for (const m of dayMats) m.emissiveIntensity = dark * 1.15;
  lampMat.mat.color.setRGB(0.35 + dark * 1.4, 0.3 + dark * 1.1, 0.2 + dark * 0.45);
  waterMat.color.setHSL(0.56, 0.62, 0.1 + d * 0.12);

  // Neon flicker: one random sign stutters now and then.
  if (signMats.length && rand() < dt * 2.2) {
    const sm = signMats[Math.floor(rand() * signMats.length) % signMats.length];
    sm.opacity = rand() < 0.4 ? 0.35 : 1;
  }
  if (beam.visible) {
    beam.material.opacity = 0.24 + Math.sin(G.simTime * 3.2) * 0.08;
    beamRing.scale.setScalar(1 + Math.sin(G.simTime * 3.2) * 0.08);
  }
}
