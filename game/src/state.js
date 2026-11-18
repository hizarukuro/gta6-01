// state.js — the one central state object for Vista Marina, plus the static
// world data every other module shares: road graph, car models, districts.
// No three.js here; this module is pure data and small math helpers.

// ---------- deterministic random ----------
let _seed = 1877;
export function rand() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(a, b) { return a + rand() * (b - a); }
export function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

// ---------- math helpers ----------
export const TAU = Math.PI * 2;
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function angNorm(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
export function angLerp(a, b, t) { return a + angNorm(b - a) * t; }
export function fmtMoney(n) { return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

// ---------- road network ----------
// Avenues run north-south (fixed x), streets east-west (fixed z). The coastal
// boulevard is the easternmost avenue; a causeway leaves it at z = 10 and
// crosses the bay to Cayo Verde.
export const AVENUES = [-210, -130, -50, 30, 110, 190];
export const BOULEVARD_X = 245;
export const STREETS = [-210, -130, -50, 30, 110, 190];
export const CAUSEWAY_Z = 10;

export const SEGMENTS = [];
function addSeg(ax, az, bx, bz) { SEGMENTS.push({ ax, az, bx, bz }); return SEGMENTS.length - 1; }
for (const x of AVENUES) addSeg(x, -210, x, 210);
addSeg(BOULEVARD_X, -210, BOULEVARD_X, 210);
for (const z of STREETS) addSeg(-210, z, BOULEVARD_X, z);
addSeg(BOULEVARD_X, CAUSEWAY_Z, 450, CAUSEWAY_Z);          // the causeway
addSeg(450, -40, 450, CAUSEWAY_Z);                          // island west, south half
addSeg(450, CAUSEWAY_Z, 450, 60);                           // island west, north half
addSeg(450, 60, 565, 60);                                   // island north
addSeg(565, -40, 565, 60);                                  // island east
addSeg(450, -40, 565, -40);                                 // island south

// Node map: segment endpoints are the intersections traffic may turn at.
export const NODES = new Map();
function nodeKey(x, z) { return x + "," + z; }
SEGMENTS.forEach((s, i) => {
  for (const [x, z] of [[s.ax, s.az], [s.bx, s.bz]]) {
    const k = nodeKey(x, z);
    if (!NODES.has(k)) NODES.set(k, { x, z, segs: [] });
    NODES.get(k).segs.push(i);
  }
});
export function nodeAt(x, z) { return NODES.get(nodeKey(x, z)); }

// Position along a segment; lane = signed offset to the right of travel.
const _sp = { x: 0, z: 0, hx: 0, hz: 0 };
export function segPoint(seg, t, lane) {
  const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const hx = dx / len, hz = dz / len;
  _sp.x = seg.ax + dx * t + (-hz) * lane;
  _sp.z = seg.az + dz * t + hx * lane;
  _sp.hx = hx; _sp.hz = hz;
  return _sp;
}
export function segLength(seg) { return Math.hypot(seg.bx - seg.ax, seg.bz - seg.az); }

// ---------- land / water ----------
export function isLand(x, z) {
  if (x >= -262 && x <= 300 && z >= -262 && z <= 262) return true;      // mainland + beach
  if (x > 245 && x < 455 && Math.abs(z - CAUSEWAY_Z) <= 11) return true; // causeway deck
  if (x >= 428 && x <= 588 && z >= -66 && z <= 86) return true;          // Cayo Verde
  return false;
}

// ---------- districts ----------
export function districtAt(x, z) {
  if (x > 262 && x <= 400 && Math.abs(z - CAUSEWAY_Z) <= 16) return "CAYO CAUSEWAY";
  if (x > 400) return "CAYO VERDE";
  if (x >= 155) return "NEON MILE";
  if (z >= 95 && x < -30) return "PORTSIDE";
  if (z <= -95 && x >= 30) return "OLD MARINA";
  return "VISTA CENTRO";
}

// ---------- car models ----------
export const MODELS = {
  vela:        { label: "VELA",        top: 37, accel: 10.5, len: 4.4, wid: 1.9, colors: [0x3a6fd8, 0xb8bcc4, 0x27313d, 0x7a1f2b, 0x2e5d43] },
  cabrillo:    { label: "CABRILLO GT", top: 51, accel: 16.5, len: 4.3, wid: 1.95, colors: [0xd8232a, 0xf2f2f2, 0x14161c, 0xff8c1a, 0x274bdb] },
  serrano:     { label: "SERRANO",     top: 39, accel: 11.5, len: 5.1, wid: 2.05, colors: [0xe06a1b, 0x5d6670, 0x24382b, 0x8c2f39] },
  interceptor: { label: "INTERCEPTOR", top: 49, accel: 15.5, len: 4.7, wid: 1.95, colors: [0xf4f6f8] },
};
export const RADIO_STATIONS = ["RADIO · OFF", "SOL FM 98.1", "NEON WAVE 104.7", "BAY TALK 88.3", "MARINA 9 CLASSICS"];

// ---------- fixed places ----------
export const PLACES = {
  garage:   { x: 122, z: -138, label: "Mara's garage" },   // Old Marina
  hospital: { x: 8, z: -38, label: "Vista General" },
  station:  { x: -38, z: 42, label: "VMPD Centro" },
  start:    { x: 214, z: 62, heading: -Math.PI / 2 },      // on foot, Neon Mile
};

// ---------- the central state ----------
export const G = {
  mode: "menu",            // menu | play | pause | fate
  simTime: 0,
  clockMin: 17 * 60 + 5,   // Friday, 17:05
  dayName: "FRI",
  camLock: false,          // scene staging pins the camera
  frozen: false,           // scene staging freezes ambient systems

  player: {
    x: PLACES.start.x, z: PLACES.start.z, y: 0, heading: Math.PI,
    car: null,             // car object while driving
    health: 100, armour: 0,
    cash: 120, rep: 0,
    weapon: "fists", ammo: 8, reserve: 48, reloadT: 0,
    bust: 0,               // busted meter 0..1
    dead: false,
  },
  wanted: 0,               // stars 0..5
  heat: 0,                 // 0..1 progress toward the next star
  seen: false,             // a unit currently has eyes on the player
  searchT: 0,              // time since last seen while wanted
  lastSeenX: 0, lastSeenZ: 0,

  cars: [],                // every car in the world
  peds: [],                // every pedestrian
  units: [],               // police units: {car, callsign, tactic, role}
  heli: null,              // {group, x, z, angle} once spawned
  colliders: [],           // building AABBs {minX, maxX, minZ, maxZ}
  mission: null,           // {chapter, title, objective, stage, stages, next}
  objective: null,         // {x, z} current marker or null
  radioIdx: 1,
  stats: { earned: 0, busted: 0, wasted: 0 },
};

export function repLevel() { return Math.floor(G.player.rep / 300) + 1; }
export function repTitle() {
  const l = repLevel();
  return ["UNKNOWN", "RUNNER", "WHEELMAN", "FIXER'S HAND", "GHOST OF THE MILE", "MARINA LEGEND"][Math.min(l, 5)] || "MARINA LEGEND";
}

// Circle vs building AABBs: push (x,z) out along the shallowest axis.
// Water is handled by movers testing isLand() before they step.
const _cw = { x: 0, z: 0 };
export function collideWorld(x, z, r) {
  for (let i = 0; i < G.colliders.length; i++) {
    const c = G.colliders[i];
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) {
      const dxl = x - (c.minX - r), dxr = (c.maxX + r) - x;
      const dzl = z - (c.minZ - r), dzr = (c.maxZ + r) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.minX - r; else if (m === dxr) x = c.maxX + r;
      else if (m === dzl) z = c.minZ - r; else z = c.maxZ + r;
    }
  }
  _cw.x = x; _cw.z = z;
  return _cw;
}
