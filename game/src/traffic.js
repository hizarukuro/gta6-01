// traffic.js — ambient traffic. Cars follow the road graph segment by
// segment (right-hand lane), slow for the car ahead, and turn at segment
// ends. A second set of parked cars dresses the kerbs for the player to steal.
import { G, SEGMENTS, NODES, segPoint, segLength, rand, randRange, pick } from "./state.js";
import { addCar } from "./vehicles.js";

const TRAFFIC_MODELS = ["vela", "vela", "cabrillo", "serrano"];

function placeOnSegment(car, segIdx, t, dirSign) {
  car.seg = segIdx; car.t = t; car.dir = dirSign;
  const p = segPoint(SEGMENTS[segIdx], t, 2.9 * dirSign);
  car.x = p.x; car.z = p.z;
  car.heading = Math.atan2(p.hx * dirSign, p.hz * dirSign);
  car.speed = 0;
}

function chooseNext(car) {
  const seg = SEGMENTS[car.seg];
  const atB = car.dir > 0;
  const nx = atB ? seg.bx : seg.ax, nz = atB ? seg.bz : seg.az;
  const node = NODES.get(nx + "," + nz);
  if (!node) { car.dir *= -1; return; }
  const options = node.segs.filter((i) => i !== car.seg);
  if (!options.length) { car.dir *= -1; car.t = atB ? 1 : 0; return; }
  const next = pick(options);
  const ns = SEGMENTS[next];
  if (ns.ax === nx && ns.az === nz) { car.seg = next; car.t = 0; car.dir = 1; }
  else { car.seg = next; car.t = 1; car.dir = -1; }
}

export function initTraffic() {
  for (let i = 0; i < 20; i++) {
    const segIdx = Math.floor(rand() * 14); // mainland avenues/streets/boulevard
    const car = addCar(pick(TRAFFIC_MODELS), 0, 0, 0, { driver: "traffic" });
    car.cruise = randRange(8, 12.5);
    placeOnSegment(car, segIdx, rand(), rand() < 0.5 ? 1 : -1);
  }
  // Parked cars along kerbs — stealable dressing.
  const parkSpots = [
    [238, -160], [238, -84], [238, 24], [238, 96], [238, 168],
    [183, -123], [103, 37], [-57, 117], [-137, -57], [23, -203],
    [452, 44], [556, -20], [-203, 60], [60, 203],
  ];
  for (const [x, z] of parkSpots) {
    const vertical = Math.abs(x) > 200 || x > 440;
    const car = addCar(pick(TRAFFIC_MODELS), x + randRange(-1, 1), z + randRange(-1, 1),
      vertical ? 0 : Math.PI / 2, { parked: true });
    car.speed = 0;
  }
}

const _ahead = { dx: 0, dz: 0 };
export function updateTraffic(dt) {
  for (const car of G.cars) {
    if (car.driver !== "traffic" || car.dead) continue;
    const seg = SEGMENTS[car.seg];
    const len = segLength(seg);
    // Slow for anything close ahead.
    let target = car.cruise;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      _ahead.dx = other.x - car.x; _ahead.dz = other.z - car.z;
      const d2 = _ahead.dx * _ahead.dx + _ahead.dz * _ahead.dz;
      if (d2 < 110 && _ahead.dx * fx + _ahead.dz * fz > 3.2) { target = Math.min(target, 2.5); break; }
    }
    if (G.player.car === null && Math.hypot(G.player.x - car.x, G.player.z - car.z) < 5) target = 0;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
    car.t += (car.speed * dt * car.dir) / len;
    if (car.t > 1) { car.t = 1; chooseNext(car); }
    else if (car.t < 0) { car.t = 0; chooseNext(car); }
    const p = segPoint(SEGMENTS[car.seg], car.t, 2.9 * car.dir);
    car.x = p.x; car.z = p.z;
    const want = Math.atan2(p.hx * car.dir, p.hz * car.dir);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += dh * Math.min(1, dt * 7);
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.35;
    for (const w of car.wheels) w.rotation.x += spin;
  }
}
