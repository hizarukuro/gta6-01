// save.js — localStorage persistence for cash, reputation, story progress
// and vitals. One key, plain JSON, every access guarded.
import { G } from "./state.js";

const KEY = "vista-marina-save-v4";

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveGame() {
  try {
    const p = G.player;
    localStorage.setItem(KEY, JSON.stringify({
      cash: p.cash, rep: p.rep, chapter: G.chapterIdx || 0,
      health: p.health, armour: p.armour, ammo: p.ammo, reserve: p.reserve,
      stats: G.stats, clockMin: G.clockMin,
    }));
  } catch { /* storage unavailable — play on without it */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function applySave(data) {
  if (!data) return;
  const p = G.player;
  p.cash = data.cash ?? p.cash;
  p.rep = data.rep ?? 0;
  p.health = data.health ?? 100;
  p.armour = data.armour ?? 0;
  p.ammo = data.ammo ?? 8;
  p.reserve = data.reserve ?? 48;
  G.stats = data.stats || G.stats;
  if (data.clockMin) G.clockMin = data.clockMin;
}
