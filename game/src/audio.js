// audio.js — a tiny WebAudio synth: engine hum while driving, a two-tone siren
// that swells as police close in, and one-shot blips for shots, punches and
// cash. Everything is created lazily on the first user gesture and every call
// is failure-proof: no audio device, no problem.

let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
let sirenFlip = 0;

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    return true;
  } catch {
    return false;
  }
}

function blip(freq, dur, type, gain, slideTo) {
  if (!ensure()) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start(); o.stop(ctx.currentTime + dur);
}

function noiseBurst(dur, gain) {
  if (!ensure()) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g).connect(master);
  src.start();
}

export const sfx = {
  unlock() { ensure(); },
  shot() { noiseBurst(0.12, 0.5); blip(160, 0.08, 'square', 0.2, 60); },
  punch() { noiseBurst(0.05, 0.25); },
  reload() { blip(500, 0.05, 'square', 0.15); setTimeout(() => blip(700, 0.05, 'square', 0.15), 120); },
  cash() { blip(880, 0.09, 'sine', 0.25); setTimeout(() => blip(1320, 0.14, 'sine', 0.25), 80); },
  blip() { blip(660, 0.07, 'sine', 0.18); },
  busted() { blip(220, 0.4, 'sawtooth', 0.25, 110); },
  // Continuous sounds, driven once per frame from main.
  update(G, dt) {
    if (!ctx) return;
    const driving = G.mode === 'car' && G.driveCar;
    engineGain.gain.value += ((driving ? 0.05 + Math.abs(G.driveCar.speed) * 0.0016 : 0) - engineGain.gain.value) * 0.2;
    if (driving) engineOsc.frequency.value = 55 + Math.abs(G.driveCar.speed) * 2.6;
    let sirenLevel = 0;
    if (G.wanted > 0) {
      for (const u of G.police) {
        if (u.kind !== 'car') continue;
        const d = Math.hypot(u.car.pos.x - G.player.pos.x, u.car.pos.z - G.player.pos.z);
        sirenLevel = Math.max(sirenLevel, Math.max(0, 1 - d / 130) * 0.12);
      }
    }
    sirenGain.gain.value += (sirenLevel - sirenGain.gain.value) * 0.1;
    sirenFlip += dt;
    if (sirenFlip > 0.42) { sirenFlip = 0; sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 950; }
  },
};
