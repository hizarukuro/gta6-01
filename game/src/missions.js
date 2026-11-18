// missions.js — Mara Voss's seven-chapter story chain. A small stage
// machine (goto / steal / deliver / pickup / lose / fight / ram) drives
// objectives, dialogue, payouts and reputation. All text is original.
import { G, PLACES, dist2D } from "./state.js";
import { addCar } from "./vehicles.js";
import { addPed } from "./pedestrians.js";
import { setWanted, raiseHeat } from "./police.js";
import { showDialogue, showBanner, toast } from "./hud.js";
import { sfx } from "./audio.js";
import { saveGame } from "./save.js";

const G_SPOT = PLACES.garage;

const CHAPTERS = [
  {
    title: "First Wheels", payout: 450, rep: 120,
    intro: ["MARA", "Nico. It's Mara. Come to my garage in Old Marina — quiet streets, easy money, no stories."],
    stages: [
      { type: "goto", x: G_SPOT.x, z: G_SPOT.z, r: 8, text: "Meet Mara at her garage in Old Marina." },
      { type: "steal", text: "Take the blue Vela parked on the Mile.",
        spawnCar: { model: "vela", x: 200, z: 37, heading: Math.PI / 2, color: 0x3a6fd8 },
        say: ["MARA", "There's a blue Vela sleeping by the Mile with your name on it. Wake it up — gently."] },
      { type: "deliver", x: G_SPOT.x, z: G_SPOT.z, r: 9, text: "Deliver the Vela to Mara's garage.",
        say: ["NICO", "One Vela, slightly borrowed. Coming in."] },
    ],
  },
  {
    title: "Harbour Run", payout: 700, rep: 140,
    intro: ["MARA", "Portside, south docks. A man with a grey case is waiting. Don't keep him."],
    stages: [
      { type: "pickup", x: -160, z: 150, r: 8, text: "Pick up the package at the Portside docks." },
      { type: "deliver", x: 215, z: -120, r: 8, text: "Drop the case at Hotel Lumen's service door.",
        heat: 1.2, say: ["MARA", "If the VMPD sniffs around the drop, lose them first."] },
      { type: "lose", text: "Lose the VMPD.", want: 2 },
    ],
  },
  {
    title: "Paper Trail", payout: 850, rep: 150,
    intro: ["MARA", "A courier downtown has papers that belong to me. Go and be polite about it."],
    stages: [
      { type: "goto", x: 60, z: 60, r: 7, text: "Meet the courier in Vista Centro." },
      { type: "steal", text: "Take the Serrano with the documents.",
        spawnCar: { model: "serrano", x: 66, z: 118, heading: 0, color: 0x5d6670 },
        say: ["MARA", "Grey Serrano, plates ending 44. The documents are in the back. All of them."] },
      { type: "deliver", x: -30, z: -160, r: 8, text: "Deliver the Serrano to the Old Marina drop." },
    ],
  },
  {
    title: "Causeway Blues", payout: 1100, rep: 170,
    intro: ["MARA", "A passenger in Centro needs the island, fast and unrecorded. You're the ferry."],
    stages: [
      { type: "pickup", x: -100, z: -20, r: 8, text: "Pick up the passenger in Vista Centro." },
      { type: "deliver", x: 520, z: 30, r: 9, text: "Take the causeway to Cayo Verde.", heat: 1.5,
        say: ["MARA", "The VMPD loves that causeway. Smile for the cameras."] },
      { type: "goto", x: G_SPOT.x, z: G_SPOT.z, r: 8, text: "Return to Mara's garage." },
    ],
  },
  {
    title: "Night Market", payout: 1300, rep: 180,
    intro: ["MARA", "Braga's boys are taxing my night market. I want my stalls back."],
    stages: [
      { type: "goto", x: 180, z: -60, r: 8, text: "Head to the night market on the Mile." },
      { type: "fight", x: 186, z: -66, text: "Deal with the crew muscling the market.",
        thugs: [[186, -66], [178, -58], [192, -54]],
        say: ["MARA", "Three of them. Retire them, Nico — permanently would be tidiest."] },
      { type: "pickup", x: 170, z: -40, r: 7, foot: true, text: "Collect the stall money." },
      { type: "deliver", x: -140, z: 130, r: 8, text: "Bring the money to Portside." },
    ],
  },
  {
    title: "Hot Metal", payout: 1600, rep: 200,
    intro: ["MARA", "A Cabrillo GT is sitting at the Sol's valet stand, and its owner owes me a car."],
    stages: [
      { type: "steal", text: "Take the Cabrillo GT from the valet stand.",
        spawnCar: { model: "cabrillo", x: 232, z: 150, heading: Math.PI, color: 0xd8232a },
        say: ["MARA", "Red GT, keys in it, driver at the bar. The department will notice. That's the fun part."] },
      { type: "lose", text: "Lose the VMPD — the whole department.", want: 4 },
      { type: "deliver", x: G_SPOT.x, z: G_SPOT.z, r: 9, text: "Deliver the GT to Mara's garage." },
    ],
  },
  {
    title: "The Tide Job", payout: 2500, rep: 260,
    intro: ["MARA", "Last one, Nico. The tide job. Crew, convoy, case, island. Then we're ghosts."],
    stages: [
      { type: "pickup", x: -180, z: 170, r: 8, text: "Pick up the crew at Portside." },
      { type: "ram", x: -20, z: -108, text: "Ram the armoured Serrano until it gives up the case.",
        spawnCar: { model: "serrano", x: -20, z: -108, heading: Math.PI / 2, color: 0x24382b },
        say: ["MARA", "That Serrano is a vault on wheels. Hit it until it stops being one."] },
      { type: "pickup", x: -20, z: -108, r: 6, foot: true, followCar: true, text: "Grab the case from the Serrano." },
      { type: "deliver", x: 500, z: 10, r: 9, text: "Run the case to Cayo Verde. Do not stop.", want: 4,
        say: ["MARA", "Tide's turning, Nico. Bring it home."] },
    ],
  },
];

let cur = null;      // { def, idx } runtime chapter
let waitT = 0;       // pickup dwell timer
let ramHits = 0;

export function initMissions() {
  G.chapterIdx = 0;
  G.betweenT = 0;
}

export function beginStory(fromChapter = 0) {
  startChapter(Math.min(fromChapter, CHAPTERS.length - 1));
}

function startChapter(i) {
  G.chapterIdx = i;
  const def = CHAPTERS[i];
  cur = { def, idx: -1 };
  showDialogue(def.intro[0], def.intro[1], 6);
  nextStage();
}

function nextStage() {
  cur.idx += 1;
  waitT = 0; ramHits = 0;
  const def = cur.def;
  if (cur.idx >= def.stages.length) { finishChapter(); return; }
  const st = def.stages[cur.idx];
  st.carRef = null; st.thugRefs = null;
  if (st.spawnCar) {
    const sc = st.spawnCar;
    st.carRef = addCar(sc.model, sc.x, sc.z, sc.heading, { parked: true, color: sc.color });
    if (st.type === "ram") {
      st.carRef.condition = 100;
      st.carRef.onBump = (other, rel) => { if (other === G.player.car && rel > 3.5) ramHits += 1; };
    }
  }
  if (st.thugs) st.thugRefs = st.thugs.map(([x, z]) => addPed(x, z, { hostile: true, color: 0x3a3f47 }));
  if (st.want) setWanted(Math.max(st.want, G.wanted));
  if (st.heat) raiseHeat(st.heat);
  if (st.say) showDialogue(st.say[0], st.say[1], 5.5);
  publishCard();
}

function publishCard() {
  const st = cur.def.stages[cur.idx];
  const following = cur.def.stages[cur.idx + 1];
  G.mission = {
    chapter: G.chapterIdx + 1,
    title: cur.def.title,
    objective: st ? st.text : "",
    stage: cur.idx,
    stages: cur.def.stages.length,
    next: following ? following.text : "Final stage",
  };
}

function finishChapter() {
  const def = cur.def;
  const p = G.player;
  p.cash += def.payout;
  p.rep += def.rep;
  G.stats.earned += def.payout;
  sfx("cash"); sfx("mission");
  showBanner("CHAPTER COMPLETE");
  toast("+" + def.payout.toLocaleString("en-US") + " · " + def.title);
  saveGame();
  const done = G.chapterIdx >= CHAPTERS.length - 1;
  cur = null;
  if (done) {
    G.mission = { chapter: "—", title: "Vista Marina", objective: "The city is yours. Mara's number still works if you want trouble.", stage: 1, stages: 1, next: "" };
    G.objective = null;
    showDialogue("MARA", "We're rich, we're infamous, and the tide took the evidence. Drinks on me.", 7);
  } else {
    G.betweenT = 4;
    G.mission = { chapter: G.chapterIdx + 1, title: def.title, objective: "Waiting on Mara's call…", stage: def.stages.length, stages: def.stages.length, next: "" };
    G.objective = null;
  }
}

function stageTarget(st) {
  if (!st) return null;
  if (st.followCar && st.carRef) return { x: st.carRef.x, z: st.carRef.z };
  if ((st.type === "steal" || st.type === "ram") && st.carRef) return { x: st.carRef.x, z: st.carRef.z };
  if (st.type === "fight" && st.thugRefs) {
    const alive = st.thugRefs.find((t) => t.state !== "down");
    if (alive) return { x: alive.x, z: alive.z };
  }
  if (st.x !== undefined) return { x: st.x, z: st.z };
  return null;
}

function stageDone(st) {
  const p = G.player;
  switch (st.type) {
    case "goto": return dist2D(p.x, p.z, st.x, st.z) < (st.r || 7);
    case "steal": return st.carRef && p.car === st.carRef;
    case "deliver": {
      if (st.carRef && p.car !== st.carRef) return false;
      if (!p.car) return false;
      return dist2D(p.x, p.z, st.x, st.z) < (st.r || 8);
    }
    case "pickup": {
      const near = dist2D(p.x, p.z, st.x, st.z) < (st.r || 8) && (st.foot ? !p.car : !!p.car);
      return near; // dwell handled by caller through waitT
    }
    case "lose": return G.wanted === 0;
    case "fight": return st.thugRefs && st.thugRefs.every((t) => t.state === "down");
    case "ram": return ramHits >= 3 || (st.carRef && st.carRef.condition < 45);
    default: return false;
  }
}

export function updateMissions(dt) {
  if (G.betweenT > 0) {
    G.betweenT -= dt;
    if (G.betweenT <= 0 && !cur) startChapter(G.chapterIdx + 1);
    return;
  }
  if (!cur) { return; }
  const st = cur.def.stages[cur.idx];
  if (!st) return;
  if (st.followCar) {
    // the case pickup hugs the rammed Serrano wherever it ended up
    const prev = CHAPTERS[G.chapterIdx].stages[cur.idx - 1];
    if (prev && prev.carRef) { st.carRef = prev.carRef; st.x = prev.carRef.x; st.z = prev.carRef.z; }
  }
  G.objective = stageTarget(st);
  if (st.type === "pickup") {
    const p = G.player;
    const near = dist2D(p.x, p.z, st.x, st.z) < (st.r || 8) && (st.foot ? !p.car : !!p.car);
    if (near) {
      waitT += dt;
      if (waitT > 2.2) { sfx("blip"); nextStage(); }
    } else waitT = 0;
    return;
  }
  if (stageDone(st)) { sfx("blip"); nextStage(); }
}
