// main.js — boot and the heartbeat. The simulation runs on a fixed 60 Hz
// accumulator, separate from rendering; rendering draws the latest state
// every animation frame. Menu, pause and the wasted/busted fate flow are
// orchestrated here; every system lives in its own module.
import * as THREE from "three";
import { G, PLACES, fmtMoney, clamp, dist2D } from "./state.js";
import { initCity, updateCity, setObjectiveBeam } from "./city.js";
import { initVehicles, collideCars } from "./vehicles.js";
import { initTraffic, updateTraffic } from "./traffic.js";
import { initPeds, initPedsSpawn, updatePeds } from "./pedestrians.js";
import { initPolice, updatePolice, setWanted, clearPolice } from "./police.js";
import { initPlayer, updatePlayer, respawn, entryCandidate } from "./player.js";
import { initInput, wasPressed, endFrame } from "./input.js";
import { initCombat, updateCombat } from "./combat.js";
import { initHud, updateHud, setPrompt, showFate, hideFate, toast } from "./hud.js";
import { initMinimap, drawMinimap } from "./minimap.js";
import { initMissions, beginStory, updateMissions } from "./missions.js";
import { initAudio, updateAudio, setSiren, sfx } from "./audio.js";
import { hasSave, loadSave, applySave, saveGame } from "./save.js";
import { applyScene } from "./scenes.js";

const STEP = 1 / 60;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3200);
camera.position.set(200, 8, 90);

initCity(scene);
initVehicles(scene);
initPlayer(scene, camera);
initPeds(scene);
initPedsSpawn();
initTraffic();
initPolice(scene);
initCombat(scene, camera);
initHud();
initMinimap();
initMissions();
initInput(canvas, { canLock: () => G.mode === "play" && !G.camLock });

const $ = (id) => document.getElementById(id);
const menuEl = $("menu"), pauseEl = $("pause"), hudEl = $("hud");

const params = new URLSearchParams(window.location.search);
const sceneName = params.get("scene");

function startGame(continued) {
  initAudio();
  menuEl.classList.add("hidden");
  pauseEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  G.mode = "play";
  if (!continued) {
    const p = G.player;
    p.x = PLACES.start.x; p.z = PLACES.start.z; p.heading = Math.PI;
    p.cash = 120; p.rep = 0; p.health = 100; p.armour = 0;
    beginStory(0);
  } else {
    beginStory(G.chapterIdx || 0);
    toast("Welcome back to Vista Marina");
  }
}

$("btn-new").addEventListener("click", () => startGame(false));
$("btn-continue").addEventListener("click", () => {
  const data = loadSave();
  if (data) { applySave(data); G.chapterIdx = data.chapter || 0; startGame(true); }
});
$("btn-resume").addEventListener("click", () => { G.mode = "play"; pauseEl.classList.add("hidden"); });
$("btn-quit").addEventListener("click", () => {
  saveGame();
  G.mode = "menu";
  pauseEl.classList.add("hidden");
  hudEl.classList.add("hidden");
  menuEl.classList.remove("hidden");
});
if (!hasSave()) $("btn-continue").style.opacity = "0.45";
else $("menu-note").textContent = "A saved life in Vista Marina is waiting.";

if (sceneName) {
  applyScene(sceneName);
  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
} else if (params.get("autostart") === "1") {
  startGame(false);
}

// ---------- fate flow ----------
let fateT = 0, fateKind = null;
function beginFate(kind) {
  const p = G.player;
  fateKind = kind; fateT = 2.4;
  G.mode = "fate";
  let fine;
  if (kind === "busted") {
    fine = Math.min(p.cash, 150 + G.wanted * 40);
    G.stats.busted += 1;
    sfx("busted");
    showFate("busted", "The VMPD thanks you for the donation of " + fmtMoney(fine) + ".");
  } else {
    fine = Math.min(p.cash, 120);
    G.stats.wasted += 1;
    showFate("wasted", "Vista General patched you up. Bill: " + fmtMoney(fine) + ".");
  }
  p.cash -= fine;
  setWanted(0);
  clearPolice();
  document.exitPointerLock?.();
}

// ---------- fixed-step simulation ----------
let saveT = 0;
function stepSim(dt) {
  G.simTime += dt;
  if (G.frozen) return; // scene staging: the world holds its pose
  G.clockMin += dt * 0.8; // one game hour every 75 real seconds
  updatePlayer(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateCombat(dt);
  updateMissions(dt);
  collideCars();
  if (G.objective) setObjectiveBeam(G.objective.x, G.objective.z);
  else setObjectiveBeam(null);
  // siren loudness follows the nearest unit
  let nd = 1e9;
  for (const u of G.units) nd = Math.min(nd, dist2D(u.car.x, u.car.z, G.player.x, G.player.z));
  setSiren(G.wanted > 0 ? clamp(1 - nd / 95, 0, 1) : 0);
  saveT += dt;
  if (saveT > 20) { saveT = 0; saveGame(); }
}

function currentPrompt() {
  if (G.frozen) return G.scenePrompt || null;
  if (G.mode !== "play") return null;
  const p = G.player;
  if (p.car) return null;
  const cand = entryCandidate();
  if (cand) return "F — Take the " + cand.spec.label;
  return null;
}

// ---------- frame loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dtReal = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (G.mode === "play") {
    if (wasPressed("Escape") || wasPressed("KeyP")) {
      if (!G.frozen) { G.mode = "pause"; pauseEl.classList.remove("hidden"); document.exitPointerLock?.(); }
    }
    acc += dtReal;
    let steps = 0;
    while (acc >= STEP && steps < 5) { stepSim(STEP); acc -= STEP; steps += 1; }
    if (steps === 5) acc = 0;
    if (G.player.dead) beginFate("wasted");
    else if (G.player.bustedFlag) beginFate("busted");
  } else if (G.mode === "fate") {
    fateT -= dtReal;
    if (fateT <= 0) {
      respawn(fateKind);
      hideFate();
      G.mode = "play";
      saveGame();
    }
  } else if (G.mode === "menu") {
    // slow menu orbit over the Mile
    const t = now / 1000;
    camera.position.set(245 + Math.cos(t * 0.05) * 30, 16 + Math.sin(t * 0.11) * 3, Math.sin(t * 0.05) * 120);
    camera.lookAt(235, 4, 0);
    G.simTime += dtReal;
    G.clockMin += dtReal * 0.8;
  }

  if (G.mode === "play" || G.mode === "fate") setPrompt(currentPrompt());
  updateCity(dtReal);
  updateAudio();
  if (!hudEl.classList.contains("hidden")) { updateHud(dtReal); drawMinimap(); }
  renderer.render(scene, camera);
  endFrame();
}
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hooks for headless verification and capture tooling.
window.__vm = { G, start: (continued) => startGame(!!continued), scene: sceneName, ready: true };
