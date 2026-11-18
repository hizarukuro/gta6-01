// traffic.js — civilian cars that drive the road graph: pick a neighbouring
// node, follow the lane on the correct side, slow for the car ahead, and panic
// (briefly) when a crime happens next to them.

import { WORLD } from './state.js';
import { nearestNode } from './city.js';
import { stepCar } from './vehicles.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function seedTraffic(G, graph, spawnFn, count) {
  const nodes = [...graph.nodes.values()];
  for (let i = 0; i < count; i++) {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    if (Math.abs(n.x) > 300 && n.x < 480) continue; // not on the causeway
    const model = ['vela', 'vela', 'serrano', 'cabrillo'][Math.floor(Math.random() * 4)];
    const car = spawnFn(model, n.x + rand(-2, 2), n.z + rand(-2, 2), rand(0, Math.PI * 2));
    car.driver = 'traffic';
    car.route = { from: n.key, target: pickNext(graph, n, null) };
    car.cruise = rand(0.45, 0.75);
    G.cars.push(car);
    G.traffic.push(car);
  }
}

function pickNext(graph, node, avoidKey) {
  const opts = node.adj.filter((k) => k !== avoidKey);
  const list = opts.length ? opts : node.adj;
  return list[Math.floor(Math.random() * list.length)];
}

// Lane point: from node A toward node B, offset to the right-hand lane.
function lanePoint(graph, fromKey, toKey, t, out) {
  const a = graph.nodes.get(fromKey), b = graph.nodes.get(toKey);
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  // right of travel direction (x,z): right = (uz, -ux) in screen-plane terms
  out.x = a.x + dx * t + uz * WORLD.lane;
  out.z = a.z + dz * t - ux * WORLD.lane;
  out.heading = Math.atan2(ux, uz);
  return out;
}

const _lane = { x: 0, z: 0, heading: 0 };
const _input = { throttle: 0, steer: 0, brake: false, reverse: false, handbrake: false };

export function updateTraffic(G, graph, dt, colliders) {
  for (const car of G.traffic) {
    if (car.dead || car.driver !== 'traffic') continue;
    const route = car.route;
    const targetNode = graph.nodes.get(route.target);
    // where on the current segment are we?
    const fromNode = graph.nodes.get(route.from);
    const segLen = Math.hypot(targetNode.x - fromNode.x, targetNode.z - fromNode.z) || 1;
    const along = ((car.pos.x - fromNode.x) * (targetNode.x - fromNode.x) +
                   (car.pos.z - fromNode.z) * (targetNode.z - fromNode.z)) / segLen;
    const t = Math.min(1, Math.max(0, along / segLen));
    lanePoint(graph, route.from, route.target, Math.min(1, t + 14 / segLen), _lane);
    const dx = _lane.x - car.pos.x, dz = _lane.z - car.pos.z;
    const distToTarget = Math.hypot(car.pos.x - targetNode.x, car.pos.z - targetNode.z);
    if (distToTarget < 9) {
      const next = pickNext(graph, targetNode, route.from);
      car.route = { from: route.target, target: next };
      continue;
    }
    // steer toward the lane point
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    _input.steer = Math.max(-1, Math.min(1, diff * 1.6));
    // slow for a car ahead
    let throttle = car.cruise;
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.pos.x - car.pos.x, oz = other.pos.z - car.pos.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 11 && side < 2.4) { throttle = 0; _input.brake = ahead < 6; break; }
    }
    _input.throttle = throttle;
    if (!_input.brake) _input.brake = false;
    stepCar(car, _input, dt, colliders, G.cars);
    _input.brake = false;
  }
}

// Parked cars the player can steal, scattered at the kerb.
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
