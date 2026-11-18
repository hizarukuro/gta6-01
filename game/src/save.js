// save.js — the game remembers you in localStorage: cash, reputation, story
// progress, Mara's pistol and the lifetime stats. Saving is a pause-menu
// choice, plus an autosave each time a job is completed.

import { G } from './state.js';

const KEY = 'vista-marina-save-v1';

export function saveGame() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: G.cash, rep: G.rep, repLevel: G.repLevel,
      missionIndex: G.missionIndex, storyDone: G.storyDone,
      hasPistol: G.hasPistol, mag: G.mag, reserve: G.reserve,
      stats: G.stats,
    }));
    return true;
  } catch {
    return false; // private mode and friends — the game goes on unsaved
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(data) {
  if (!data) return;
  G.cash = data.cash ?? G.cash;
  G.rep = data.rep ?? 0;
  G.repLevel = data.repLevel ?? 1;
  G.missionIndex = data.missionIndex ?? 0;
  G.storyDone = !!data.storyDone;
  G.hasPistol = !!data.hasPistol;
  G.mag = data.mag ?? 12;
  G.reserve = data.reserve ?? 60;
  if (data.stats) Object.assign(G.stats, data.stats);
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
