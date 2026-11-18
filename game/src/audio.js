// audio.js — a tiny WebAudio synth: engine hum, a two-tone siren that
// follows the nearest unit, and one-shot blips for shots, punches, cash and
// UI. Everything is guarded — audio must never throw or block the game.
let ctx = null, master = null;
let engineOsc = null, engineOsc2 = null, engineGain = null;
let sirenOsc = null, sirenGain = null;
let sirenLevel = 0;

export function initAudio() {
  try {
    if (ctx) { ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = "square"; engineOsc2.frequency.value = 28;
    engineOsc.connect(lp); engineOsc2.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc = ctx.createOscillator(); sirenOsc.type = "triangle"; sirenOsc.frequency.value = 760;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
  } catch { ctx = null; }
}

export function setEngine(on, norm) {
  if (!ctx || !engineGain) return;
  try {
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + norm * 0.075 : 0, t, 0.09);
    engineOsc.frequency.setTargetAtTime(52 + norm * 165, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(26 + norm * 82, t, 0.08);
  } catch { /* silent */ }
}

export function setSiren(level) { sirenLevel = level; }

export function updateAudio() {
  if (!ctx || !sirenGain) return;
  try {
    const t = ctx.currentTime;
    sirenGain.gain.setTargetAtTime(sirenLevel * 0.055, t, 0.15);
    sirenOsc.frequency.setTargetAtTime(745 + Math.sin(t * 4.6) * 165, t, 0.03);
  } catch { /* silent */ }
}

function blip(f0, f1, dur, type, gain, delay = 0) {
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* silent */ }
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case "shot": blip(160, 40, 0.13, "square", 0.5); blip(900, 120, 0.06, "sawtooth", 0.22); break;
    case "swing": blip(300, 140, 0.06, "sine", 0.12); break;
    case "punch": blip(130, 45, 0.09, "sine", 0.5); break;
    case "clank": blip(620, 300, 0.07, "square", 0.18); break;
    case "click": blip(1200, 900, 0.03, "square", 0.15); break;
    case "reload": blip(500, 300, 0.05, "square", 0.2); blip(700, 420, 0.05, "square", 0.2, 0.09); break;
    case "cash": blip(880, 880, 0.07, "sine", 0.25); blip(1318, 1318, 0.1, "sine", 0.25, 0.07); break;
    case "blip": blip(660, 660, 0.05, "square", 0.12); break;
    case "door": blip(95, 60, 0.1, "sine", 0.4); break;
    case "crash": blip(220, 30, 0.22, "sawtooth", 0.4); break;
    case "mission": blip(523, 523, 0.09, "triangle", 0.25); blip(659, 659, 0.09, "triangle", 0.25, 0.09); blip(784, 784, 0.14, "triangle", 0.25, 0.18); break;
    case "busted": blip(392, 392, 0.12, "triangle", 0.25); blip(311, 311, 0.2, "triangle", 0.25, 0.13); break;
  }
}
