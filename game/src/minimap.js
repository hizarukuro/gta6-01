// minimap.js — the circular radar: roads, water and land under a north-up
// view centred on the player, with blips for the objective, police, traffic
// and pedestrians, and the district name underneath.
import { G, SEGMENTS, districtAt } from "./state.js";
import { heliPos } from "./police.js";

let ctx = null, districtEl = null, lastDistrict = "";
const RANGE = 105; // metres shown from centre to edge

export function initMinimap() {
  ctx = document.getElementById("minimap").getContext("2d");
  districtEl = document.getElementById("district");
}

function toMap(x, z, px, pz, scale) {
  return [95 + (x - px) * scale, 95 + (z - pz) * scale];
}

export function drawMinimap() {
  if (!ctx) return;
  const px = G.player.x, pz = G.player.z;
  const scale = 95 / RANGE;
  ctx.save();
  ctx.clearRect(0, 0, 190, 190);
  ctx.beginPath(); ctx.arc(95, 95, 93, 0, Math.PI * 2); ctx.clip();
  // water, then land masses
  ctx.fillStyle = "#14486b"; ctx.fillRect(0, 0, 190, 190);
  ctx.fillStyle = "#2e3138";
  let a = toMap(-262, -262, px, pz, scale), b = toMap(300, 262, px, pz, scale);
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  a = toMap(428, -66, px, pz, scale); b = toMap(588, 86, px, pz, scale);
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  a = toMap(245, -1, px, pz, scale); b = toMap(455, 21, px, pz, scale);
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  // beach tint
  ctx.fillStyle = "#8a744a";
  a = toMap(262, -262, px, pz, scale); b = toMap(300, 262, px, pz, scale);
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  // roads
  ctx.strokeStyle = "#6a6e78"; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const s of SEGMENTS) {
    const p1 = toMap(s.ax, s.az, px, pz, scale), p2 = toMap(s.bx, s.bz, px, pz, scale);
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
  }
  ctx.stroke();
  // pedestrians: faint dots
  ctx.fillStyle = "rgba(240,240,240,0.5)";
  for (const ped of G.peds) {
    if (ped.state === "down") continue;
    const d = Math.hypot(ped.x - px, ped.z - pz);
    if (d > RANGE) continue;
    const q = toMap(ped.x, ped.z, px, pz, scale);
    ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2);
  }
  // traffic: grey dots
  ctx.fillStyle = "#b9bec9";
  for (const car of G.cars) {
    if (car.driver === "police" || car === G.player.car) continue;
    const d = Math.hypot(car.x - px, car.z - pz);
    if (d > RANGE) continue;
    const q = toMap(car.x, car.z, px, pz, scale);
    ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, Math.PI * 2); ctx.fill();
  }
  // police: flashing red/blue
  for (const u of G.units) {
    const d = Math.hypot(u.car.x - px, u.car.z - pz);
    if (d > RANGE) continue;
    const q = toMap(u.car.x, u.car.z, px, pz, scale);
    ctx.fillStyle = Math.floor(G.simTime * 5 + u.car.x) % 2 === 0 ? "#ff3b47" : "#3c8bff";
    ctx.beginPath(); ctx.arc(q[0], q[1], 3.4, 0, Math.PI * 2); ctx.fill();
  }
  const hp = heliPos();
  if (hp && Math.hypot(hp.x - px, hp.z - pz) <= RANGE) {
    const q = toMap(hp.x, hp.z, px, pz, scale);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, Math.PI * 2); ctx.fill();
  }
  // objective: gold diamond
  if (G.objective) {
    const q = toMap(G.objective.x, G.objective.z, px, pz, scale);
    const cx = Math.max(8, Math.min(182, q[0])), cy = Math.max(8, Math.min(182, q[1]));
    ctx.fillStyle = "#ffd23c";
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4.4, -4.4, 8.8, 8.8); ctx.restore();
  }
  // player arrow
  ctx.save();
  ctx.translate(95, 95);
  ctx.rotate(Math.PI - G.player.heading);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.6, 5.5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.6, 5.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();

  const dName = districtAt(px, pz);
  if (dName !== lastDistrict) { lastDistrict = dName; districtEl.textContent = dName; }
}
