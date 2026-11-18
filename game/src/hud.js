// hud.js — every piece of DOM chrome: the mission card, the VMPD response
// panel, wanted stars, cash and clock, weapon slots, vitals, the vehicle
// cluster, dialogue with drawn portraits, prompts, toasts and banners.

import { G, repName } from './state.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

// Flat stylised portraits, drawn once on a canvas per character.
function drawPortrait(kind) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const g = c.getContext('2d');
  if (kind === 'mara') {
    g.fillStyle = '#40204a'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#ff3d77'; g.fillRect(0, 76, 96, 20); // top
    g.fillStyle = '#8a5a3b'; g.beginPath(); g.arc(48, 47, 20, 0, 7); g.fill(); // face
    g.fillStyle = '#ff3d77'; g.fillRect(27, 12, 42, 15); g.fillRect(24, 12, 8, 42); g.fillRect(64, 12, 8, 42); // magenta hair
    g.fillStyle = '#0e0e14'; g.fillRect(28, 42, 40, 11); // sunglasses
    g.fillStyle = '#9be7ff'; g.fillRect(31, 44, 13, 3); // glint
    g.fillStyle = '#e84a6f'; g.fillRect(41, 63, 14, 4); // lips
    g.fillStyle = '#ffd94d'; g.fillRect(38, 79, 20, 3); // necklace
  } else {
    g.fillStyle = '#173d4d'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#ff7847'; g.fillRect(0, 76, 96, 20); // shirt
    g.fillStyle = '#c68863'; g.beginPath(); g.arc(48, 47, 20, 0, 7); g.fill(); // face
    g.fillStyle = '#1d1410'; g.beginPath(); g.arc(48, 34, 20, Math.PI, 0); g.fill(); g.fillRect(28, 26, 40, 8); // hair
    g.fillStyle = '#14100e'; g.fillRect(36, 45, 5, 3); g.fillRect(55, 45, 5, 3); // eyes
    g.fillStyle = '#ffffff'; g.fillRect(40, 61, 16, 4); // grin
    g.fillStyle = 'rgba(20,14,10,0.35)'; g.fillRect(36, 56, 24, 12); // stubble
  }
  return c.toDataURL();
}

export function createHud() {
  const portraits = { mara: drawPortrait('mara'), nico: drawPortrait('nico') };
  let bannerTimer = 0, toastTimer = 0, dialogueTimer = 0, blinkClock = 0;

  const hud = {
    portraits,
    show() { $('hud').classList.remove('hidden'); },
    hide() { $('hud').classList.add('hidden'); },

    banner(title, sub) {
      $('banner-title').textContent = title;
      $('banner-sub').textContent = sub || '';
      $('banner').classList.remove('hidden');
      bannerTimer = 3.2;
      sfx.blip();
    },
    toast(text) {
      $('toast').textContent = text;
      $('toast').classList.remove('hidden');
      toastTimer = 3.4;
    },
    damageFlash() {
      $('damage-vignette').style.boxShadow = 'inset 0 0 120px rgba(200,10,30,0.55)';
      setTimeout(() => { $('damage-vignette').style.boxShadow = 'inset 0 0 120px rgba(200,10,30,0)'; }, 130);
    },
    setPrompt(html) {
      if (html) { $('prompt').innerHTML = html; $('prompt').classList.remove('hidden'); }
      else $('prompt').classList.add('hidden');
    },
    dialogue(speaker, role, text, who) {
      $('dlg-portrait').src = portraits[who || 'mara'];
      $('dlg-name').innerHTML = `${speaker} <span id="dlg-role">${role}</span>`;
      $('dlg-text').textContent = text;
      $('dialogue').classList.remove('hidden');
      dialogueTimer = 5.2;
    },
    hideDialogue() { $('dialogue').classList.add('hidden'); dialogueTimer = 0; },
    onEnterCar(car) {
      $('vehicle-cluster').classList.remove('hidden');
      $('vehicle-name').textContent = car.spec.name;
      const stations = ['WAVE 104 · Sunset Synth', 'SOL 101.9 · Bay Classics', 'NEON FM · Night Drive'];
      $('radio-name').textContent = stations[car.id % stations.length];
      $('crosshair').classList.add('hidden');
    },
    onExitCar() {
      $('vehicle-cluster').classList.add('hidden');
    },
    refreshWeapons() {
      $('slot-fists').classList.toggle('active', G.weapon === 'fists');
      $('slot-pistol').classList.toggle('active', G.weapon === 'pistol');
      $('slot-pistol').classList.toggle('locked', !G.hasPistol);
      $('pistol-ammo').textContent = `${G.mag}/${G.reserve}`;
      $('crosshair').classList.toggle('hidden', !(G.mode === 'foot' && G.weapon === 'pistol'));
    },

    // Per-frame refresh of every readout from G.
    update(dt) {
      bannerTimer -= dt; toastTimer -= dt; dialogueTimer -= dt; blinkClock += dt;
      if (bannerTimer <= 0) $('banner').classList.add('hidden');
      if (toastTimer <= 0) $('toast').classList.add('hidden');
      if (dialogueTimer <= 0) $('dialogue').classList.add('hidden');

      // clock + cash + stars
      const hh = Math.floor(G.time), mm = Math.floor((G.time - hh) * 60);
      $('clock-day').textContent = G.dayName;
      $('clock-time').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      $('cash').textContent = '$' + G.cash.toLocaleString('en-US');
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '<span class="off">★</span>';
      $('wanted').innerHTML = stars;
      $('wanted').classList.toggle('blink', !G.seenByPolice && G.wanted > 0 && Math.floor(blinkClock * 2) % 2 === 0);
      const sight = $('sight-badge');
      if (G.wanted === 0) { $('sight-line').style.visibility = 'hidden'; }
      else {
        $('sight-line').style.visibility = 'visible';
        sight.textContent = G.seenByPolice ? 'IN SIGHT' : 'SEARCHING';
        sight.classList.toggle('searching', !G.seenByPolice);
        const near = nearestUnitLabel();
        $('sight-unit').textContent = near ? '· ' + near : '';
      }

      // vitals + rep
      $('hp-fill').style.width = Math.max(0, G.health) + '%';
      $('ar-fill').style.width = Math.max(0, G.armour) + '%';
      $('rep-badge').textContent = 'REP ' + G.repLevel;
      $('rep-name').textContent = repName(G.repLevel);
      $('rep-xp').textContent = `${G.rep} / ${G.repLevel * 500}`;

      // mission card
      const m = G.mission;
      if (m) {
        $('mission-card').style.display = '';
        $('mc-chapter').textContent = m.def.chapter;
        $('mc-title').textContent = m.def.title.toUpperCase();
        $('mc-objective').textContent = m.stage.label;
        $('mc-stage-label').textContent = `STAGE ${m.stageIndex + 1}/${m.def.stages.length}`;
        $('mc-stage-fill').style.width = ((m.stageIndex) / m.def.stages.length * 100) + '%';
        $('mc-next-text').textContent = m.stage.next || '';
        $('mc-timer').textContent = m.timeLeft != null ? formatTimer(m.timeLeft) : '';
      } else {
        $('mission-card').style.display = 'none';
      }

      // police panel
      const units = panelUnits();
      const pp = $('police-panel');
      if (G.wanted === 0 || units.length === 0) pp.style.display = 'none';
      else {
        pp.style.display = '';
        $('pp-code').textContent = 'CODE ' + (G.wanted + 1);
        $('pp-units').innerHTML = units.map((u) =>
          `<li><span class="u-dot${u.heli ? ' heli' : ''}"></span>${u.callsign}` +
          `<span class="u-dist">${Math.round(u.dist)} m</span>` +
          `<span class="u-tactic${u.tactic === 'RAMMING' || u.tactic.includes('SPOTLIGHT') ? ' hot' : ''}">${u.tactic}</span></li>`).join('');
        const roadblock = units.some((u) => u.tactic === 'ROADBLOCK');
        $('pp-note').textContent = roadblock ? '+ roadblock reported ahead — find another way' :
          (G.seenByPolice ? 'Units converge on your position' : 'You broke line of sight — stay hidden');
      }

      // vehicle cluster
      if (G.mode === 'car' && G.driveCar) {
        const car = G.driveCar;
        $('speed-num').textContent = Math.round(Math.abs(car.speed) * 3.6);
        $('cond-fill').style.width = Math.max(0, car.hp) + '%';
        $('cond-fill').style.background = car.hp > 50 ? '#ffd94d' : car.hp > 25 ? '#ff9040' : '#ff4040';
        $('cond-pct').textContent = Math.round(Math.max(0, car.hp)) + '%';
      }
    },
  };

  function nearestUnitLabel() {
    let best = null, bd = Infinity;
    for (const u of G.police) {
      if (u.kind !== 'car') continue;
      const d = Math.hypot(u.car.pos.x - G.player.pos.x, u.car.pos.z - G.player.pos.z);
      if (d < bd) { bd = d; best = u.callsign; }
    }
    if (G.heli?.active) return 'GULL-1';
    return best;
  }

  function panelUnits() {
    const list = [];
    for (const u of G.police) {
      if (u.kind !== 'car') continue;
      list.push({
        callsign: u.callsign, tactic: u.car.dead ? 'DISABLED' : u.tactic, heli: false,
        dist: Math.hypot(u.car.pos.x - G.player.pos.x, u.car.pos.z - G.player.pos.z),
      });
    }
    if (G.heli?.active) {
      list.push({ callsign: 'GULL-1', tactic: G.heli.tactic, heli: true, dist: 52 });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, 5);
  }

  function formatTimer(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  }

  hud.refreshWeapons();
  return hud;
}
