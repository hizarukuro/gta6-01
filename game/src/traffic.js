// traffic.js — the civilian flow: cars that pick a neighbouring junction on
// the road graph, hold the right-hand lane between junctions, ease off when
// the car ahead is close, and keep Vista Marina feeling inhabited. Parked
// cars are seeded here too — they are tomorrow's stolen cars.

import { WORLD } from './state.js';
import { stepCar } from './vehicles.js';

const rand = (a, b) => a + Math.random() * (b - a);

function pickNext(graph, node, avoidKey) {
  const opts = node.adj.filter((k) => k !== avoidKey);
  const list = opts.length ? opts : node.adj;
  return list[(Math.random() * list.length) | 0];
}

export function seedTraffic(G, graph, spawnFn, count) {
  const nodes = [...graph.nodes.values()];
  for (let i = 0; i < count; i++) {
    const n = nodes[(Math.random() * nodes.length) | 0];
    if (n.x > 300 && n.x < 480) continue; // keep the causeway clear-ish
    const model = ['vela', 'vela', 'serrano', 'cabrillo'][(Math.random() * 4) | 0];
    const car = spawnFn(model, n.x + rand(-2, 2), n.z + rand(-2, 2), rand(0, Math.PI * 2));
    car.driver = 'traffic';
    car.route = { from: n.key, target: pickNext(graph, n, null) };
    car.cruise = rand(0.45, 0.75);
    G.cars.push(car);
    G.traffic.push(car);
  }
}

// A point t of the way from junction A to junction B, shifted into the
// right-hand lane for that direction of travel.
function lanePoint(graph, fromKey, toKey, t, out) {
  const a = graph.nodes.get(fromKey), b = graph.nodes.get(toKey);
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  out.x = a.x + dx * t + uz * WORLD.lane;
  out.z = a.z + dz * t - ux * WORLD.lane;
  out.heading = Math.atan2(ux, uz);
  return out;
}

const _lane = { x: 0, z: 0, heading: 0 };
const _input = { throttle: 0, steer: 0, brake: false, reverse: false, handbrake: false };

export function updateTraffic(G, graph, dt, colliders) {
  for (const car of G.traffic) {
    if (car.dead || car.driver !== 'traffic' || !car.route || !car.route.target) continue;
    const fromNode = graph.nodes.get(car.route.from);
    const targetNode = graph.nodes.get(car.route.target);
    if (!fromNode || !targetNode) continue;
    if (Math.hypot(car.pos.x - targetNode.x, car.pos.z - targetNode.z) < 9) {
      car.route = { from: car.route.target, target: pickNext(graph, targetNode, car.route.from) };
      continue;
    }
    const segLen = Math.hypot(targetNode.x - fromNode.x, targetNode.z - fromNode.z) || 1;
    const along = ((car.pos.x - fromNode.x) * (targetNode.x - fromNode.x) +
                   (car.pos.z - fromNode.z) * (targetNode.z - fromNode.z)) / segLen;
    const t = Math.min(1, Math.max(0, along / segLen));
    lanePoint(graph, car.route.from, car.route.target, Math.min(1, t + 14 / segLen), _lane);
    const want = Math.atan2(_lane.x - car.pos.x, _lane.z - car.pos.z);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    _input.steer = Math.max(-1, Math.min(1, diff * 1.6));
    // mind the car ahead: same heading cone, close, in our lane width
    let throttle = car.cruise;
    let brake = false;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.pos.x - car.pos.x, oz = other.pos.z - car.pos.z;
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.4) { throttle = 0; brake = ahead < 6; break; }
    }
    _input.throttle = throttle;
    _input.brake = brake;
    stepCar(car, _input, dt, colliders, G.cars);
  }
}

// Kerbside cars with the keys of opportunity in them.
export function seedParked(G, spawnFn) {
  const spots = [
    ['vela', 96, -84, 0.2], ['serrano', -84, 96, 1.7], ['vela', 186, 84, -0.4],
    ['cabrillo', 262, -160, 1.55], ['vela', -176, -96, 0], ['serrano', 6, 186, 3.1],
    ['vela', 570, -262, 1.55], ['serrano', -262, -6, 1.6], ['vela', 84, -186, 0.1],
    ['cabrillo', 334, 120, -1.55], ['serrano', -96, -262, 0], ['vela', 176, -276, 1.55],
  ];
  for (const [model, x, z, h] of spots) {
    const car = spawnFn(model, x, z, h);
    car.driver = null;
    G.cars.push(car);
  }
}
