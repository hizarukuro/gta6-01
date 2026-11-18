// state.js — Vista Marina keeps all of its truth in one object, G, defined
// here together with the fixed facts of the world (road layout, car catalogue,
// radio dial, district map). Systems import G and mutate it in place; nobody
// keeps a shadow copy of anything that matters.

export const WORLD = {
  avenues: [-270, -180, -90, 0, 90, 180, 270], // north-south roads, run along z
  streets: [-270, -180, -90, 0, 90, 180, 270], // east-west roads, run along x
  boulevardX: 345,   // the shore road, along z
  beachX: 368,       // sand begins east of the boulevard
  waterX: 436,       // open water beyond the sand
  island: { cx: 620, cz: -270, xs: [560, 620, 680], zs: [-330, -270, -210] },
  causewayZ: -270,   // the bridge street to Cayo Verde
  roadHalf: 7,       // half a road's width, metres
  lane: 3.4,         // lane offset from a road's centre line
};

export const CAR_MODELS = {
  vela:        { name: 'VELA',        kind: 'sedan',   topSpeed: 34, accel: 13, grip: 0.86 },
  serrano:     { name: 'SERRANO',     kind: 'pickup',  topSpeed: 30, accel: 11, grip: 0.80 },
  cabrillo:    { name: 'CABRILLO GT', kind: 'sports',  topSpeed: 47, accel: 19, grip: 0.92 },
  interceptor: { name: 'INTERCEPTOR', kind: 'police',  topSpeed: 42, accel: 17, grip: 0.90 },
};

export const RADIO_STATIONS = [
  'WAVE 104 · Sunset Synth',
  'SOL 101.9 · Bay Classics',
  'NEON FM · Night Drive',
  'MARINA TALK · All Day',
];

export const DISTRICTS = ['NEON MILE', 'PORTSIDE', 'OLD MARINA', 'CAYO VERDE', 'VISTA CENTRO'];

export function districtAt(x, z) {
  if (x > 480) return 'CAYO VERDE';
  if (x > 368 && Math.abs(z - WORLD.causewayZ) < 26) return 'CAYO CAUSEWAY';
  if (x >= 250) return 'NEON MILE';
  if (x < -90 && z > 90) return 'PORTSIDE';
  if (x < -90 && z < -90) return 'OLD MARINA';
  return 'VISTA CENTRO';
}

// The live state. main.js owns the frame loop; everything else reads/writes G.
export const G = {
  mode: 'menu',       // menu | foot | car | pause | busted | wasted
  prevMode: 'foot',
  started: false,
  time: 17.9,         // hour of day, 0..24
  dayName: 'FRI',
  cash: 250,
  rep: 0,
  repLevel: 1,
  health: 100,
  armour: 0,
  wanted: 0,          // stars, 0..5
  heat: 0,            // fractional build-up toward the next star
  searchTimer: 0,     // seconds since a unit last had eyes on the player
  seenByPolice: false,
  lastSeen: null,     // last position the VMPD confirmed
  bustedMeter: 0,
  weapon: 'fists',    // fists | pistol
  hasPistol: false,
  mag: 12,
  reserve: 132,
  reloading: 0,
  missionIndex: 0,    // next story job to offer, 0..6 (7 = chain finished)
  mission: null,      // live job runtime { def, stageIndex, stage, data }
  storyDone: false,
  player: null,       // filled in by player.js
  driveCar: null,     // the car being driven right now, if any
  cars: [],           // every vehicle that exists
  traffic: [],        // the cars traffic.js is driving
  peds: [],
  police: [],         // ground units; the helicopter lives in heli
  heli: null,         // { callsign, tactic, active }
  crimeLog: [],
  stats: { steals: 0, missionsDone: 0, topSpeed: 0, busts: 0 },
  scene: null,        // ?scene= staging name, or null in real play
  muted: false,
};

const REP_TITLES = ['BAY RUNNER', 'WHEELMAN', 'GHOST DRIVER', 'NEON GHOST', 'MARINA LEGEND'];
export function repName(level) {
  return REP_TITLES[Math.min(REP_TITLES.length - 1, Math.max(0, level - 1))];
}

export function addCash(amount) {
  G.cash = Math.max(0, G.cash + amount);
}

export function addRep(amount) {
  G.rep += amount;
  if (G.repLevel < 5 && G.rep >= G.repLevel * 500) G.repLevel += 1;
}

// Wrongdoing feeds heat; a full point of heat crystallises into a star.
// police.js runs the other half of the loop (searching cools the heat off).
export function commitCrime(points, label) {
  if (G.mode !== 'foot' && G.mode !== 'car') return;
  G.heat += points;
  G.crimeLog.push(label);
  while (G.heat >= 1 && G.wanted < 5) {
    G.heat -= 1;
    G.wanted += 1;
  }
  if (G.wanted >= 5) G.heat = Math.min(G.heat, 0.99);
}

export function clearWanted() {
  G.wanted = 0;
  G.heat = 0;
  G.searchTimer = 0;
  G.lastSeen = null;
}
