// hud.js — every piece of DOM the player reads: mission card, VMPD response
// panel (live measured distances), stars, cash, clock, vitals, speedo,
// weapon slots, dialogue with painted portraits, prompts, banners, toasts.
import { G, fmtMoney, repLevel, repTitle, RADIO_STATIONS } from "./state.js";
import { unitReport } from "./police.js";

const el = {};
let dlgT = 0, bannerT = 0, hudT = 0;
const toasts = [];
let lastPrompt = undefined;
const portraits = {};

function portraitCanvas(draw) {
  const c = document.createElement("canvas");
  c.width = 76; c.height = 76;
  draw(c.getContext("2d"));
  return c;
}
function makePortraits() {
  portraits.MARA = portraitCanvas((x) => {
    x.fillStyle = "#2b1b3d"; x.fillRect(0, 0, 76, 76);
    x.fillStyle = "#0f766e"; x.fillRect(14, 48, 48, 28);            // shoulders
    x.fillStyle = "#c68863"; x.fillRect(31, 30, 14, 12);             // neck
    x.fillStyle = "#e8b98d"; x.beginPath(); x.arc(38, 26, 13, 0, 7); x.fill(); // face
    x.fillStyle = "#191410"; x.fillRect(23, 4, 30, 16);              // hair top
    x.fillRect(21, 12, 7, 30); x.fillRect(48, 12, 7, 30);           // hair sides
    x.fillStyle = "#14100c";
    x.fillRect(31, 25, 3, 3); x.fillRect(43, 25, 3, 3);             // eyes
    x.fillStyle = "#a03d4e"; x.fillRect(34, 34, 8, 2.6);            // lips
    x.fillStyle = "#ffd23c"; x.fillRect(35, 52, 6, 8);              // pendant
  });
  portraits.NICO = portraitCanvas((x) => {
    x.fillStyle = "#233044"; x.fillRect(0, 0, 76, 76);
    x.fillStyle = "#0f766e"; x.fillRect(14, 48, 48, 28);
    x.fillStyle = "#c68863"; x.beginPath(); x.arc(38, 27, 13, 0, 7); x.fill();
    x.fillStyle = "#14161c"; x.fillRect(24, 8, 28, 8);              // cap
    x.fillRect(20, 15, 36, 4);                                       // brim
    x.fillStyle = "#14100c";
    x.fillRect(31, 26, 3, 3); x.fillRect(43, 26, 3, 3);
    x.fillRect(33, 36, 10, 2);                                       // mouth
    x.fillStyle = "#6e4423"; x.fillRect(30, 31, 16, 4);             // stubble shade
  });
}

export function initHud() {
  for (const id of ["hud", "mc-chapter", "mc-title", "mc-stage", "mc-objective", "mc-bar-fill", "mc-next",
    "stars", "clock", "cash", "pp-status", "pp-rows", "hp-fill", "ar-fill", "rep-label",
    "speedo", "speed-val", "veh-name", "veh-cond-fill", "veh-cond-label", "radio",
    "weap-fists", "weap-pistol", "ammo-label", "dialogue", "dlg-portrait", "dlg-name", "dlg-text",
    "prompt", "banner", "toasts", "bust-wrap", "bust-fill", "fate", "fate-title", "fate-sub"]) {
    el[id] = document.getElementById(id);
  }
  makePortraits();
  el.stars.innerHTML = Array.from({ length: 5 }, () => "<span>★</span>").join("");
}

export function showDialogue(speaker, text, dur = 4.6) {
  el["dlg-name"].textContent = speaker === "MARA" ? "MARA VOSS" : "NICO FERREIRA";
  el["dlg-text"].textContent = text;
  const ctx = el["dlg-portrait"].getContext("2d");
  ctx.clearRect(0, 0, 76, 76);
  ctx.drawImage(portraits[speaker] || portraits.MARA, 0, 0);
  el.dialogue.classList.remove("hidden");
  dlgT = dur;
}
export function hideDialogue() { el.dialogue.classList.add("hidden"); dlgT = 0; }

export function showBanner(text, dur = 2.4) {
  el.banner.textContent = text;
  el.banner.classList.remove("hidden");
  bannerT = dur;
}

export function toast(text) {
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = text;
  el.toasts.appendChild(d);
  toasts.push({ node: d, t: 3.2 });
}

export function setPrompt(text) {
  if (text === lastPrompt) return;
  lastPrompt = text;
  if (text) { el.prompt.textContent = text; el.prompt.classList.remove("hidden"); }
  else el.prompt.classList.add("hidden");
}

export function showFate(kind, sub) {
  el["fate-title"].textContent = kind === "busted" ? "BUSTED" : "WASTED";
  el["fate-title"].style.color = kind === "busted" ? "#3ca9ff" : "#ff5e7a";
  el["fate-sub"].textContent = sub;
  el.fate.classList.remove("hidden");
}
export function hideFate() { el.fate.classList.add("hidden"); }

const DAYS = ["FRI", "SAT", "SUN", "MON", "TUE", "WED", "THU"];
function clockText() {
  const total = Math.floor(G.clockMin);
  const day = DAYS[Math.floor(total / 1440) % 7];
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return day + " " + hh + ":" + mm;
}

export function updateHud(dt) {
  dlgT -= dt; if (dlgT <= 0 && !el.dialogue.classList.contains("hidden")) hideDialogue();
  bannerT -= dt; if (bannerT <= 0) el.banner.classList.add("hidden");
  for (let i = toasts.length - 1; i >= 0; i--) {
    toasts[i].t -= dt;
    if (toasts[i].t <= 0) { toasts[i].node.remove(); toasts.splice(i, 1); }
  }
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.12;
  const p = G.player;

  const starSpans = el.stars.children;
  for (let i = 0; i < starSpans.length; i++) {
    starSpans[i].className = i < G.wanted ? "on" : "";
    starSpans[i].style.opacity = i < G.wanted && G.seen && Math.sin(G.simTime * 9) > 0 ? "0.45" : "1";
  }
  el.clock.textContent = clockText();
  el.cash.textContent = fmtMoney(p.cash);

  const m = G.mission;
  if (m) {
    el["mc-chapter"].textContent = "CH " + m.chapter;
    el["mc-title"].textContent = m.title;
    el["mc-stage"].textContent = "STAGE " + Math.min(m.stage + 1, m.stages) + "/" + m.stages;
    el["mc-objective"].textContent = m.objective;
    el["mc-bar-fill"].style.width = Math.round((m.stage / Math.max(1, m.stages)) * 100) + "%";
    el["mc-next"].textContent = m.next ? "NEXT · " + m.next : "";
  }

  const report = unitReport();
  const status = el["pp-status"];
  if (G.wanted === 0) { status.textContent = "CLEAR"; status.className = ""; }
  else if (G.seen) { status.textContent = "ENGAGED"; status.className = "hot"; }
  else { status.textContent = "SEARCHING"; status.className = "hot"; }
  if (!report.length) {
    el["pp-rows"].innerHTML = '<div class="pp-none">No units dispatched.</div>';
  } else {
    el["pp-rows"].innerHTML = report.slice(0, 6).map((u) =>
      '<div class="pp-row"><span class="cs">' + u.callsign + '</span><span class="tac">' +
      u.tactic + '</span><span class="dist">' + Math.round(u.dist) + " m</span></div>").join("");
  }

  el["hp-fill"].style.width = Math.max(0, p.health) + "%";
  el["ar-fill"].style.width = Math.max(0, p.armour) + "%";
  el["rep-label"].textContent = "REP " + repLevel() + " · " + repTitle();

  if (p.car) {
    el.speedo.classList.remove("hidden");
    el["speed-val"].textContent = Math.round(Math.abs(p.car.speed) * 3.6);
    el["veh-name"].textContent = p.car.spec.label;
    el["veh-cond-fill"].style.width = Math.max(0, p.car.condition) + "%";
    el["veh-cond-label"].textContent = Math.round(p.car.condition) + "%";
    el.radio.textContent = RADIO_STATIONS[G.radioIdx];
  } else el.speedo.classList.add("hidden");

  el["weap-fists"].className = "weap" + (p.weapon === "fists" ? " active" : "");
  el["weap-pistol"].className = "weap" + (p.weapon === "pistol" ? " active" : "");
  el["ammo-label"].textContent = p.reloadT > 0 ? "···" : p.ammo + " / " + p.reserve;

  if (p.bust > 0.02) {
    el["bust-wrap"].classList.remove("hidden");
    el["bust-fill"].style.width = Math.round(p.bust * 100) + "%";
  } else el["bust-wrap"].classList.add("hidden");
}
