// minimap.js — the circular radar in the corner: a north-up window onto the
// road graph around the player, with the shoreline and Cayo Verde painted in,
// blips for traffic, police, marked pedestrians and the mission target, and
// the district name refreshed under the dial.

import { WORLD, districtAt } from './state.js';

const RANGE = 165; // metres from the player to the rim of the dial

export function createMinimap(graph) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const districtEl = document.getElementById('district');
  // road edges, unpacked once from the graph
  const edges = [];
  for (const n of graph.nodes.values()) {
    for (const k of n.adj) {
      if (n.key < k) edges.push([n, graph.nodes.get(k)]);
    }
  }
  let frame = 0;

  function project(x, z, px, pz, out) {
    const s = (canvas.width / 2) / RANGE;
    out[0] = canvas.width / 2 + (x - px) * s;
    out[1] = canvas.height / 2 + (z - pz) * s;
    return out;
  }
  const _a = [0, 0], _b = [0, 0];

  return {
    draw(G) {
      frame++;
      const p = G.player.pos;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // land, then water and sand up the east edge
      ctx.fillStyle = '#1d3a24';
      ctx.fillRect(0, 0, W, H);
      const [wx] = project(WORLD.waterX, 0, p.x, p.z, _a);
      ctx.fillStyle = '#175d8a';
      ctx.fillRect(wx, 0, W - wx, H);
      const [bx] = project(WORLD.beachX, 0, p.x, p.z, _a);
      ctx.fillStyle = '#e6cf9e';
      ctx.fillRect(bx, 0, Math.max(0, wx - bx), H);
      // Cayo Verde
      const [ix0, iz0] = project(505, -385, p.x, p.z, _a);
      const [ix1, iz1] = project(735, -155, p.x, p.z, _b);
      ctx.fillStyle = '#1d3a24';
      ctx.fillRect(ix0, iz0, ix1 - ix0, iz1 - iz0);
      // roads
      ctx.strokeStyle = 'rgba(230,228,220,0.5)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (const [a, b] of edges) {
        if (Math.abs(a.x - p.x) > RANGE + 90 || Math.abs(a.z - p.z) > RANGE + 90) continue;
        project(a.x, a.z, p.x, p.z, _a);
        project(b.x, b.z, p.x, p.z, _b);
        ctx.moveTo(_a[0], _a[1]);
        ctx.lineTo(_b[0], _b[1]);
      }
      ctx.stroke();
      // traffic: pale squares
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (const car of G.cars) {
        if (car.driver !== 'traffic') continue;
        project(car.pos.x, car.pos.z, p.x, p.z, _a);
        if (_a[0] < 0 || _a[1] < 0 || _a[0] > W || _a[1] > H) continue;
        ctx.fillRect(_a[0] - 1.6, _a[1] - 1.6, 3.2, 3.2);
      }
      // police: flashing red/blue discs
      const flash = Math.floor(frame / 14) % 2 === 0;
      for (const u of G.police) {
        if (u.kind !== 'car') continue;
        project(u.car.pos.x, u.car.pos.z, p.x, p.z, _a);
        if (_a[0] < -6 || _a[1] < -6 || _a[0] > W + 6 || _a[1] > H + 6) continue;
        ctx.fillStyle = flash ? '#ff3040' : '#3a8dff';
        ctx.beginPath();
        ctx.arc(_a[0], _a[1], 4, 0, 7);
        ctx.fill();
      }
      // the mission target, clamped to the rim when it is far away
      const target = G.mission && G.mission.stage ? G.mission.stage.target : null;
      if (target) {
        project(target.x, target.z, p.x, p.z, _a);
        const cx = Math.max(10, Math.min(W - 10, _a[0]));
        const cy = Math.max(10, Math.min(H - 10, _a[1]));
        ctx.fillStyle = '#ffd94d';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5.4, -5.4, 10.8, 10.8);
        ctx.restore();
      }
      // mission-marked pedestrians
      ctx.fillStyle = '#ff9040';
      for (const ped of G.peds) {
        if (!ped.marked || ped.state === 'down') continue;
        project(ped.pos.x, ped.pos.z, p.x, p.z, _a);
        ctx.beginPath();
        ctx.arc(_a[0], _a[1], 3.4, 0, 7);
        ctx.fill();
      }
      // the player arrow, turned to the current heading
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(G.mode === 'car' && G.driveCar ? G.driveCar.heading : G.player.heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.4, 6.4);
      ctx.lineTo(0, 3.4);
      ctx.lineTo(-5.4, 6.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // north tick + district name
      ctx.fillStyle = '#ffd94d';
      ctx.font = '900 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', W / 2, 17);
      districtEl.textContent = districtAt(p.x, p.z);
    },
  };
}
