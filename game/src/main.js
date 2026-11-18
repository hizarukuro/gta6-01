// main.js — boots Vista Marina and runs it: renderer, city, traffic,
// pedestrians, police, the player, combat, missions, HUD and minimap, all
// stepped on a fixed 60 Hz simulation with rendering on the display clock.

import * as THREE from 'three';
import { G } from './state.js';
import { buildCity, buildGraph } from './city.js';
import { spawnCar, stepCar } from './vehicles.js';
import { seedTraffic, seedParked, updateTraffic } from './traffic.js';
import { seedPeds, updatePeds } from './pedestrians.js';
import { buildHelicopter, updatePolice } from './police.js';
import { createPlayer, updatePlayerOnFoot, updateCamera, nearestCar, enterCar, exitCar } from './player.js';
import { initCombat, updateCombat, setWeapon, startReload } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createScenes } from './scenes.js';
import { initInput, keys, justPressed, endFrameInput, takeMouse, takeClick, driveInput } from './input.js';
import { saveGame, loadSave, applySave } from './save.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 3200);
camera.position.set(300, 60, 220);
camera.lookAt(345, 0, 0);

const city = buildCity(scene);
const graph = buildGraph();
const spawnCarBound = (model, x, z, heading, color) => spawnCar(scene, model, x, z, heading, color);

const hud = createHud();
const player = createPlayer(scene, hud);
buildHelicopter(scene);
initCombat(scene);
seedTraffic(G, graph, spawnCarBound, 14);
seedParked(G, spawnCarBound);
seedPeds(G, scene, 22);
const minimap = createMinimap(graph);
const missions = createMissions({ hud, city, graph, spawnCar: spawnCarBound, save: () => saveGame() });
const scenes = createScenes({ hud, spawnCar: spawnCarBound });
initInput(canvas);

// ------------------------------------------------------------- start / pause
window.__vm = G; // debugging hook: the whole state, live
const params = new URLSearchParams(location.search);
const sceneName = params.get('scene');
let shotFrames = 0;
window.__shotReady = false;

function startGame(continueSave) {
  if (continueSave) applySave(loadSave());
  document.getElementById('start-screen').classList.add('hidden');
  hud.show();
  hud.refreshWeapons();
  G.started = true;
  G.mode = 'foot';
  sfx.unlock();
  hud.toast(continueSave ? 'Welcome back to Vista Marina.' : 'Mara is waiting. Check the map.');
}

const existingSave = loadSave();
if (existingSave) {
  const btn = document.getElementById('btn-continue');
  btn.classList.remove('hidden');
  document.getElementById('continue-info').textContent =
    `$${(existingSave.cash ?? 0).toLocaleString('en-US')} · ${(existingSave.missionIndex ?? 0)}/7 jobs done`;
  btn.addEventListener('click', () => startGame(true));
}
document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-how').addEventListener('click', () => {
  document.getElementById('howto').classList.toggle('hidden');
});

const pauseScreen = document.getElementById('pause-screen');
function setPaused(on) {
  if (on) {
    G.prevMode = G.mode;
    G.mode = 'pause';
    document.getElementById('pause-stats').textContent =
      `Cash $${G.cash.toLocaleString('en-US')} · Jobs done ${G.stats.missionsDone}/7 · Cars stolen ${G.stats.steals}\nWanted level ${G.wanted} · Rep level ${G.repLevel}`;
    pauseScreen.classList.remove('hidden');
  } else {
    G.mode = G.prevMode === 'pause' ? 'foot' : G.prevMode;
    pauseScreen.classList.add('hidden');
  }
}
document.getElementById('btn-resume').addEventListener('click', () => setPaused(false));
document.getElementById('btn-save').addEventListener('click', () => { saveGame(); hud.toast('Saved.'); });
document.getElementById('btn-quit').addEventListener('click', () => location.reload());

if (sceneName && scenes.stage(sceneName)) {
  G.scene = sceneName;
  document.getElementById('start-screen').classList.add('hidden');
  G.mode = sceneName === 'foot' ? 'foot' : 'car';
}

// ------------------------------------------------------------- simulation
const _carInput = { throttle: 0, steer: 0, brake: false, reverse: false, handbrake: false };

function step(dt) {
  const input = driveInput();
  const camDelta = takeMouse();
  const clicked = takeClick();

  if (justPressed('KeyM') || justPressed('Escape')) {
    if (G.mode === 'pause') setPaused(false);
    else if (G.started && G.mode !== 'menu') setPaused(true);
  }
  if (G.mode === 'pause' || G.mode === 'menu') { endFrameInput(); return; }

  // clock: a full day lasts about half an hour of play
  G.time = (G.time + dt / 75) % 24;

  if (G.mode === 'car' && G.driveCar) {
    const car = G.driveCar;
    _carInput.throttle = input.throttle;
    _carInput.steer = input.steer;
    _carInput.brake = input.brake;
    _carInput.reverse = input.reverse;
    _carInput.handbrake = input.handbrake;
    stepCar(car, _carInput, dt, city.colliders, G.cars);
    G.player.pos.set(car.pos.x, 0, car.pos.z);
    G.stats.topSpeed = Math.max(G.stats.topSpeed, Math.abs(car.speed) * 3.6);
    if (car.hitSpeed > 13) { // a hard crash hurts
      player.hurt((car.hitSpeed - 10) * 0.7, 'crash');
      car.hitSpeed = 0;
    }
    if (justPressed('KeyF') && Math.abs(car.speed) < 2.5) exitCar(G, hud);
  } else if (G.mode === 'foot') {
    updatePlayerOnFoot(G, dt, input, city.colliders, camDelta);
    const near = nearestCar(G, 3.6);
    hud.setPrompt(near ? `<b>F</b> — Take the ${near.spec.name}` : null);
    if (near && justPressed('KeyF')) { enterCar(G, hud, near); hud.setPrompt(null); }
    if (justPressed('Digit1')) setWeapon(G, hud, 'fists');
    if (justPressed('Digit2')) setWeapon(G, hud, 'pistol');
    if (justPressed('KeyR')) startReload(G, hud);
    updateCombat(G, dt, hud, clicked);
  }

  updateTraffic(G, graph, dt, city.colliders);
  updatePeds(G, dt, city.colliders);
  updatePolice(G, graph, dt, city.colliders, spawnCarBound, player);
  missions.update(dt);

  // busted: cornered on foot, or boxed in while stationary
  if (G.wanted > 0 && (G.mode === 'foot' || G.mode === 'car')) {
    let pressure = 0;
    for (const u of G.police) {
      if (u.kind !== 'car' || u.car.dead) continue;
      const d = Math.hypot(u.car.pos.x - G.player.pos.x, u.car.pos.z - G.player.pos.z);
      if (G.mode === 'foot' && d < 3.4) pressure += 1;
      if (G.mode === 'car' && d < 8.5) pressure += 0.5;
    }
    const boxed = G.mode === 'car' && Math.abs(G.driveCar?.speed ?? 9) < 1 && pressure >= 1;
    if ((G.mode === 'foot' && pressure >= 1) || boxed) G.bustedMeter += dt;
    else G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.6);
    if (G.bustedMeter > 2.2) { G.bustedMeter = 0; sfx.busted(); player.bust(); }
  }
  endFrameInput();
}

// ------------------------------------------------------------- frame loop
let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.scene) {
    // staged screenshot: hold the pose, keep the world alive around it
    scenes.pin(dt, now / 1000);
    city.update(dt, G.time);
    scenes.applyCamera(camera);
    hud.update(dt);
    minimap.draw(G);
    renderer.render(scene, camera);
    shotFrames++;
    if (shotFrames > 100) window.__shotReady = true;
    return;
  }
  accumulator += dt;
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  city.update(dt, G.time);
  // keep the shadow frustum on the player
  const f = G.player.pos;
  city.sun.position.x += f.x; city.sun.position.z += f.z;
  city.sun.target.position.set(f.x, 0, f.z);
  if (G.started && G.mode !== 'menu') {
    updateCamera(G, camera, dt);
    hud.update(dt);
    minimap.draw(G);
    sfx.update(G, dt);
  } else {
    // menu backdrop: slow orbit over the boulevard
    const t = now / 1000;
    camera.position.set(345 + Math.sin(t * 0.05) * 60, 26 + Math.sin(t * 0.11) * 6, 120 + Math.cos(t * 0.05) * 60);
    camera.lookAt(345, 4, 0);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
