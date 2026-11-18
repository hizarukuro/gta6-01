// state.js — the one central state object for Vista Marina, plus world constants.
// Every system reads and writes G; nothing keeps a private copy of game truth.

export const WORLD = {
  avenues: [-270, -180, -90, 0, 90, 180, 270], // vertical roads (run along z)
  streets: [-270, -180, -90, 0, 90, 180, 270], // horizontal roads (run along x)
  boulevardX: 345,                              // shore road, runs along z
  beachX: 368,                                  // sand starts east of the boulevard
  waterX: 436,                                  // open water east of the beach
  island: { cx: 620, cz: -270, xs: [560, 620, 680], zs: [-330, -270, -210] },
  causewayZ: -270,
  roadHalf: 7,                                  // half the road width in metres
  lane: 3.4,                                    // driving lane offset from centre line
};

export const CAR_MODELS = {
  vela:      { name: 'VELA',        kind: 'sedan',   topSpeed: 34, accel: 13, grip: 0.86, price: 0 },
  serrano:   { name: 'SERRANO',     kind: 'pickup',  topSpeed: 30, accel: 11, grip: 0.8,  price: 0 },
  cabrillo:  { name: 'CABRILLO GT', kind: 'sports',  topSpeed: 47, accel: 19, grip: 0.92, price: 0 },
  interceptor: { name: 'INTERCEPTOR', kind: 'police', topSpeed: 42, accel: 17, grip: 0.9, price: 0 },
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

// The live game state. main.js owns the loop; systems mutate G in place.
export const G = {
  mode: 'menu', // menu | foot | car | pause | busted | wasted
  prevMode: 'foot',
  started: false,
  time: 17.9, // hour of day, 0..24
  dayName: 'FRI',
  cash: 250,
  rep: 0,
  repLevel: 1,
  health: 100,
  armour: 0,
  wanted: 0,          // 0..5 stars
  heat: 0,            // fractional crime heat toward the next star
  searchTimer: 0,     // seconds since police last saw the player
  seenByPolice: false,
  bustedMeter: 0,
  weapon: 'fists',    // fists | pistol
  hasPistol: false,
  mag: 12,
  reserve: 132,
  reloading: 0,
  missionIndex: 0,    // next mission to run (0..6), 7 = story complete
  mission: null,      // live mission runtime { def, stageIndex, stage, data }
  storyDone: false,
  player: null,       // set by player.js: { pos, heading, speed, mesh, inCar }
  driveCar: null,     // the car the player is driving, if any
  cars: [],           // every vehicle in the world (traffic, parked, police, mission)
  traffic: [],        // the subset of cars driven by traffic AI
  peds: [],
  police: [],         // police units (subset of cars + the helicopter)
  heli: null,
  crimeLog: [],
  stats: { steals: 0, missionsDone: 0, topSpeed: 0, busts: 0 },
  scene: null,        // debug scene name from ?scene=, or null
  muted: false,
};

export function repName(level) {
  return ['BAY RUNNER', 'WHEELMAN', 'GHOST DRIVER', 'NEON GHOST', 'MARINA LEGEND'][Math.min(4, level - 1)];
}

export function addCash(amount) {
  G.cash = Math.max(0, G.cash + amount);
}

export function addRep(amount) {
  G.rep += amount;
  const need = G.repLevel * 500;
  if (G.rep >= need && G.repLevel < 5) G.repLevel += 1;
}

// Crime raises heat; heat crystallises into stars. Losing sight of the police
// drains heat again (police.js drives the search side of this).
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
}
