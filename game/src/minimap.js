// minimap.js — the circular radar: a north-up slice of the road graph around
// the player with the beach and island, blips for the mission target, police
// and traffic, and the district name under the dial (set in hud.js's DOM).

import { WORLD, districtAt } from './state.js';

const RANGE = 165; // metres from centre to rim

export function createMinimap(graph) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const districtEl = document.getElementById('district');
  const edges = [];
  for (const n of graph.nodes.values()) {
    for (const k of n.adj) {
      if (n.key < k) edges.push([n, graph.nodes.get(k)]);
    }
  }
  let frame = 0;

  function project(x, z, px, pz) {
    const s = (canvas.width / 2) / RANGE;
    return [canvas.width / 2 + (x - px) * s, canvas.height / 2 + (z - pz) * s];
  }

  return {
    draw(G) {
      frame++;
      const p = G.player.pos;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // land and water
      ctx.fillStyle = '#1d3a24';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#175d8a';
      const [wx] = project(WORLD.waterX, 0, p.x, p.z);
      ctx.fillRect(wx, 0, W - wx, H);
      ctx.fillStyle = '#e6cf9e';
      const [bx] = project(WORLD.beachX, 0, p.x, p.z);
      ctx.fillRect(bx, 0, Math.max(0, wx - bx), H);
      // island land
      const [ix0, iz0] = project(505, -385, p.x, p.z);
      const [ix1, iz1] = project(735, -155, p.x, p.z);
      ctx.fillStyle = '#1d3a24';
      ctx.fillRect(ix0, iz0, ix1 - ix0, iz1 - iz0);
      // roads
      ctx.strokeStyle = 'rgba(230,228,220,0.5)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (const [a, b] of edges) {
        if (Math.abs(a.x - p.x) > RANGE + 90 || Math.abs(a.z - p.z) > RANGE + 90) continue;
        const [ax, ay] = project(a.x, a.z, p.x, p.z);
        const [cx, cy] = project(b.x, b.z, p.x, p.z);
        ctx.moveTo(ax, ay); ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      // traffic blips
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (const car of G.cars) {
        if (car.driver !== 'traffic') continue;
        const [x, y] = project(car.pos.x, car.pos.z, p.x, p.z);
        if (x < 0 || y < 0 || x > W || y > H) continue;
        ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
      }
      // police blips (flashing)
      const flash = Math.floor(frame / 14) % 2 === 0;
      for (const u of G.police) {
        if (u.kind !== 'car') continue;
        const [x, y] = project(u.car.pos.x, u.car.pos.z, p.x, p.z);
        if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
        ctx.fillStyle = flash ? '#ff3040' : '#3a8dff';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      }
      // mission target
      const target = G.mission?.stage?.target;
      if (target) {
        const [x, y] = project(target.x, target.z, p.x, p.z);
        const cx = Math.max(10, Math.min(W - 10, x)), cy = Math.max(10, Math.min(H - 10, y));
        ctx.fillStyle = '#ffd94d';
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5.4, -5.4, 10.8, 10.8);
        ctx.restore();
      }
      // marked peds (mission fights)
      ctx.fillStyle = '#ff9040';
      for (const ped of G.peds) {
        if (!ped.marked || ped.state === 'down') continue;
        const [x, y] = project(ped.pos.x, ped.pos.z, p.x, p.z);
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
      }
      // player arrow
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(G.mode === 'car' && G.driveCar ? G.driveCar.heading : G.player.heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5.4, 6.4); ctx.lineTo(0, 3.4); ctx.lineTo(-5.4, 6.4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // north tick
      ctx.fillStyle = '#ffd94d';
      ctx.font = '900 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', W / 2, 17);
      districtEl.textContent = districtAt(p.x, p.z);
    },
  };
}
