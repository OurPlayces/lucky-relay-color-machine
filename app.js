const els = {
  setup: document.querySelector("#setup"),
  stage: document.querySelector("#stage"),
  scriptText: document.querySelector("#scriptText"),
  speed: document.querySelector("#speed"),
  speedLabel: document.querySelector("#speedLabel"),
  randomSpeed: document.querySelector("#randomSpeed"),
  speechOn: document.querySelector("#speechOn"),
  startMedia: document.querySelector("#startMedia"),
  begin: document.querySelector("#begin"),
  supportNote: document.querySelector("#supportNote"),
  webcam: document.querySelector("#webcam"),
  scroller: document.querySelector("#scroller"),
  liveSpeed: document.querySelector("#liveSpeed"),
  pause: document.querySelector("#pause"),
  handoff: document.querySelector("#handoff"),
  panic: document.querySelector("#panic"),
  finish: document.querySelector("#finish"),
  readerLabel: document.querySelector("#readerLabel"),
  downloadPhone: document.querySelector("#downloadPhone"),
  downloadLaptop: document.querySelector("#downloadLaptop"),
  colorCanvas: document.querySelector("#colorCanvas"),
  visionCanvas: document.querySelector("#visionCanvas"),
  faceOverlay: document.querySelector("#faceOverlay"),
  recordCanvas: document.querySelector("#recordCanvas"),
  laptopRecordCanvas: document.querySelector("#laptopRecordCanvas"),
  mouthMeter: document.querySelector("#mouthMeter"),
  motionMeter: document.querySelector("#motionMeter"),
  energyMeter: document.querySelector("#energyMeter"),
  faceStatus: document.querySelector("#faceStatus"),
  scoreLine: document.querySelector("#scoreLine"),
};

const sampleText = `Given the existence as uttered forth in the public works of Puncher and Wattmann of a personal God quaquaquaqua with white beard quaquaquaqua outside time without extension who from the heights of divine apathia divine athambia divine aphasia loves us dearly with some exceptions for reasons unknown but time will tell.`;
const DEFAULT_SPEED = 220;

// =========================================================================
// READERS roster — performance order. Profiles load dynamically from
// analysis/song_profiles/<profileKey>.json. profileKey === null means the
// reader has no song; DEFAULT_PROFILE_KNOBS is used. "Next reader" walks
// through this list in order, wrapping after the last.
// =========================================================================
const DEFAULT_PROFILE_KNOBS = {
  base_palette: {
    primary: { hue: 200, sat: 50, light: 50 },
    accent:  { hue: 30,  sat: 70, light: 60 },
  },
  palette_drift_range: 35,
  brightness_curve: "linear",
  pulse_rate_hz: 1.0,
  motion_smear_decay: 0.90,
  panic_palette:    { hue: 0,   sat: 90, light: 50 },
  missed_word_scar: { hue: 200, sat: 40, light: 14 },
  bridge_palette:   null,
  bridge_trigger:   null,
};

const READERS = [
  { reader: "wayne",       profileKey: "wayne",       song_title: "Happiness Is Here and Now",                    artist: "Plum Village" },
  { reader: "chris",       profileKey: "chris",       song_title: "NDP 2024 Theme – Not Alone",                   artist: "NDPeeps" },
  { reader: "hannah",      profileKey: "hannah",      song_title: "A Thousand Years",                             artist: "John Michael Howell, JVKE & ZVC" },
  { reader: "caleb",       profileKey: "caleb",       song_title: "Red Wine Supernova",                           artist: "Chappell Roan" },
  { reader: "shashvat",    profileKey: "shashvat",    song_title: "Banjo",                                        artist: "Rascal Flatts" },
  { reader: "zsmj",        profileKey: "zsmj",        song_title: "當想你成為習慣",                                 artist: "KeyKey" },
  { reader: "joy",         profileKey: "joy",         song_title: "A Walk to Remember",                           artist: "Vulfpeck" },
  { reader: "ebb",         profileKey: "ebb",         song_title: "願你愛自己，像我愛你一樣",                          artist: "Crispy 脆樂團" },
  { reader: "abigail",     profileKey: "abigail",     song_title: "한도초과 (HANDO-CHOGUA)",                          artist: "DAESUNG" },
  { reader: "khizer",      profileKey: "khizer",      song_title: "If He",                                        artist: "Mkgee" },
  { reader: "naomi",       profileKey: "naomi",       song_title: "Bad Man",                                      artist: "Fightmaster" },
  { reader: "serene",      profileKey: "serene",      song_title: "I Lived",                                      artist: "OneRepublic" },
  { reader: "mitchell",    profileKey: "mitchell",    song_title: "Queen of the Night aria",                      artist: "Mozart / Diana Damrau" },
  { reader: "sowmya",      profileKey: null,          song_title: null,                                           artist: null },
  { reader: "lee tom",     profileKey: "lee_tom",     song_title: "Piano Concerto No. 3 in D Minor, Op. 30: I",   artist: "Rachmaninoff" },
  { reader: "bonnie",      profileKey: "bonnie",      song_title: "Latch",                                        artist: "Disclosure ft. Sam Smith" },
  { reader: "wan qin",     profileKey: "wan_qin",     song_title: "HAPPEN (헤픈 우연)",                             artist: "Heize" },
  { reader: "amelia",      profileKey: null,          song_title: null,                                           artist: null },
  { reader: "kester",      profileKey: "kester",      song_title: "Hush",                                         artist: "NeoC" },
  { reader: "drew",        profileKey: "drew",        song_title: "Everything You Do",                            artist: "The Happy Fits" },
  { reader: "theo",        profileKey: "theo",        song_title: "Dracula (JENNIE Remix)",                       artist: "Tame Impala × JENNIE" },
  { reader: "wil",         profileKey: null,          song_title: null,                                           artist: null },
  { reader: "enokii",      profileKey: "enokii",      song_title: "Tonight",                                      artist: "SPICA" },
  { reader: "carlos",      profileKey: null,          song_title: null,                                           artist: null },
  { reader: "clotho, nep", profileKey: "clotho_nep",  song_title: "How Music Works (instrumental)",               artist: "Marcin" },
  { reader: "damien",      profileKey: "damien",      song_title: "I Should've Known",                            artist: "INOHA" },
  { reader: "gena",        profileKey: "gena",        song_title: "Bōkyō",                                        artist: "Hako Yamasaki" },
  { reader: "sid",         profileKey: "sid",         song_title: "How Much I Love You, Baby",                    artist: "Satellite Lovers" },
];

// Embedded profile knobs (baked from analysis/song_profiles/*.json by
// /tmp/bake_profiles.py). Inlined so the page works opened directly via
// file:// — fetch() is blocked under that origin. Re-bake whenever a song
// profile changes.
const EMBEDDED_PROFILE_KNOBS = {
  wayne: {
    base_palette: {
      primary: { hue: 49, sat: 45, light: 47 },
      accent:  { hue: 354, sat: 70, light: 59 },
    },
    palette_drift_range: 48.0,
    brightness_curve: "linear",
    pulse_rate_hz: 1.657,
    motion_smear_decay: 0.935,
    panic_palette:    { hue: 355, sat: 80, light: 54 },
    missed_word_scar: { hue: 49, sat: 35, light: 14 },
    bridge_palette:   null,
    bridge_trigger:   null,
  },
  chris: {
    base_palette: {
      primary: { hue: 324, sat: 58, light: 52 },
      accent:  { hue: 328, sat: 83, light: 64 },
    },
    palette_drift_range: 52.8,
    brightness_curve: "linear",
    pulse_rate_hz: 1.657,
    motion_smear_decay: 0.93,
    panic_palette:    { hue: 333, sat: 88, light: 59 },
    missed_word_scar: { hue: 324, sat: 48, light: 14 },
    bridge_palette:   { hue: 264, sat: 38, light: 62 },
    bridge_trigger:   "sustained-quiet",
  },
  hannah: {
    base_palette: {
      primary: { hue: 306, sat: 54, light: 52 },
      accent:  { hue: 323, sat: 79, light: 64 },
    },
    palette_drift_range: 50.6,
    brightness_curve: "linear",
    pulse_rate_hz: 1.872,
    motion_smear_decay: 0.928,
    panic_palette:    { hue: 329, sat: 84, light: 59 },
    missed_word_scar: { hue: 306, sat: 44, light: 14 },
    bridge_palette:   { hue: 206, sat: 39, light: 47 },
    bridge_trigger:   "sustained-quiet",
  },
  caleb: {
    base_palette: {
      primary: { hue: 333, sat: 60, light: 54 },
      accent:  { hue: 331, sat: 85, light: 66 },
    },
    palette_drift_range: 50.7,
    brightness_curve: "linear",
    pulse_rate_hz: 2.05,
    motion_smear_decay: 0.925,
    panic_palette:    { hue: 335, sat: 90, light: 61 },
    missed_word_scar: { hue: 333, sat: 50, light: 14 },
    bridge_palette:   { hue: 293, sat: 45, light: 54 },
    bridge_trigger:   "sustained-quiet",
  },
  shashvat: {
    base_palette: {
      primary: { hue: 49, sat: 46, light: 48 },
      accent:  { hue: 354, sat: 71, light: 60 },
    },
    palette_drift_range: 50.8,
    brightness_curve: "linear",
    pulse_rate_hz: 1.723,
    motion_smear_decay: 0.929,
    panic_palette:    { hue: 355, sat: 80, light: 55 },
    missed_word_scar: { hue: 49, sat: 36, light: 14 },
    bridge_palette:   { hue: 309, sat: 31, light: 43 },
    bridge_trigger:   "sustained-quiet",
  },
  zsmj: {
    base_palette: {
      primary: { hue: 90, sat: 64, light: 52 },
      accent:  { hue: 6, sat: 89, light: 64 },
    },
    palette_drift_range: 49.5,
    brightness_curve: "linear",
    pulse_rate_hz: 1.267,
    motion_smear_decay: 0.894,
    panic_palette:    { hue: 5, sat: 94, light: 59 },
    missed_word_scar: { hue: 90, sat: 54, light: 14 },
    bridge_palette:   { hue: 45, sat: 49, light: 57 },
    bridge_trigger:   "sustained-quiet",
  },
  joy: {
    base_palette: {
      primary: { hue: 287, sat: 71, light: 49 },
      accent:  { hue: 317, sat: 95, light: 61 },
    },
    palette_drift_range: 52.5,
    brightness_curve: "explosive",
    pulse_rate_hz: 1.197,
    motion_smear_decay: 0.871,
    panic_palette:    { hue: 323, sat: 99, light: 56 },
    missed_word_scar: { hue: 287, sat: 61, light: 14 },
    bridge_palette:   { hue: 187, sat: 56, light: 44 },
    bridge_trigger:   "sustained-quiet",
  },
  ebb: {
    base_palette: {
      primary: { hue: 68, sat: 57, light: 52 },
      accent:  { hue: 359, sat: 82, light: 64 },
    },
    palette_drift_range: 46.3,
    brightness_curve: "linear",
    pulse_rate_hz: 1.435,
    motion_smear_decay: 0.935,
    panic_palette:    { hue: 359, sat: 87, light: 59 },
    missed_word_scar: { hue: 68, sat: 47, light: 14 },
    bridge_palette:   { hue: 328, sat: 42, light: 47 },
    bridge_trigger:   "sustained-quiet",
  },
  abigail: {
    base_palette: {
      primary: { hue: 60, sat: 61, light: 51 },
      accent:  { hue: 357, sat: 86, light: 63 },
    },
    palette_drift_range: 50.9,
    brightness_curve: "linear",
    pulse_rate_hz: 1.197,
    motion_smear_decay: 0.895,
    panic_palette:    { hue: 357, sat: 91, light: 58 },
    missed_word_scar: { hue: 60, sat: 51, light: 14 },
    bridge_palette:   { hue: 15, sat: 46, light: 56 },
    bridge_trigger:   "sustained-quiet",
  },
  khizer: {
    base_palette: {
      primary: { hue: 0, sat: 56, light: 52 },
      accent:  { hue: 339, sat: 81, light: 64 },
    },
    palette_drift_range: 49.4,
    brightness_curve: "linear",
    pulse_rate_hz: 1.485,
    motion_smear_decay: 0.934,
    panic_palette:    { hue: 342, sat: 86, light: 59 },
    missed_word_scar: { hue: 0, sat: 46, light: 14 },
    bridge_palette:   { hue: 320, sat: 41, light: 52 },
    bridge_trigger:   "sustained-quiet",
  },
  naomi: {
    base_palette: {
      primary: { hue: 32, sat: 45, light: 47 },
      accent:  { hue: 349, sat: 70, light: 59 },
    },
    palette_drift_range: 48.0,
    brightness_curve: "linear",
    pulse_rate_hz: 1.435,
    motion_smear_decay: 0.933,
    panic_palette:    { hue: 351, sat: 80, light: 54 },
    missed_word_scar: { hue: 32, sat: 35, light: 14 },
    bridge_palette:   { hue: 352, sat: 30, light: 47 },
    bridge_trigger:   "sustained-quiet",
  },
  serene: {
    base_palette: {
      primary: { hue: 314, sat: 71, light: 48 },
      accent:  { hue: 325, sat: 95, light: 60 },
    },
    palette_drift_range: 51.2,
    brightness_curve: "linear",
    pulse_rate_hz: 1.958,
    motion_smear_decay: 0.877,
    panic_palette:    { hue: 330, sat: 99, light: 55 },
    missed_word_scar: { hue: 314, sat: 61, light: 14 },
    bridge_palette:   { hue: 274, sat: 56, light: 48 },
    bridge_trigger:   "sustained-quiet",
  },
  mitchell: {
    base_palette: {
      primary: { hue: 150, sat: 63, light: 51 },
      accent:  { hue: 24, sat: 88, light: 63 },
    },
    palette_drift_range: 50.6,
    brightness_curve: "linear",
    pulse_rate_hz: 2.267,
    motion_smear_decay: 0.897,
    panic_palette:    { hue: 20, sat: 93, light: 58 },
    missed_word_scar: { hue: 150, sat: 53, light: 14 },
    bridge_palette:   { hue: 110, sat: 48, light: 51 },
    bridge_trigger:   "sustained-quiet",
  },
  lee_tom: {
    base_palette: {
      primary: { hue: 60, sat: 59, light: 49 },
      accent:  { hue: 357, sat: 84, light: 61 },
    },
    palette_drift_range: 48.4,
    brightness_curve: "linear",
    pulse_rate_hz: 1.197,
    motion_smear_decay: 0.901,
    panic_palette:    { hue: 357, sat: 89, light: 56 },
    missed_word_scar: { hue: 60, sat: 49, light: 14 },
    bridge_palette:   { hue: 320, sat: 44, light: 44 },
    bridge_trigger:   "sustained-quiet",
  },
  bonnie: {
    base_palette: {
      primary: { hue: 81, sat: 55, light: 53 },
      accent:  { hue: 3, sat: 80, light: 65 },
    },
    palette_drift_range: 50.7,
    brightness_curve: "linear",
    pulse_rate_hz: 2.05,
    motion_smear_decay: 0.926,
    panic_palette:    { hue: 3, sat: 85, light: 60 },
    missed_word_scar: { hue: 81, sat: 45, light: 14 },
    bridge_palette:   { hue: 41, sat: 40, light: 53 },
    bridge_trigger:   "sustained-quiet",
  },
  wan_qin: {
    base_palette: {
      primary: { hue: 333, sat: 55, light: 52 },
      accent:  { hue: 331, sat: 80, light: 64 },
    },
    palette_drift_range: 50.4,
    brightness_curve: "linear",
    pulse_rate_hz: 1.872,
    motion_smear_decay: 0.929,
    panic_palette:    { hue: 335, sat: 85, light: 59 },
    missed_word_scar: { hue: 333, sat: 45, light: 14 },
    bridge_palette:   { hue: 288, sat: 40, light: 57 },
    bridge_trigger:   "sustained-quiet",
  },
  kester: {
    base_palette: {
      primary: { hue: 27, sat: 57, light: 51 },
      accent:  { hue: 347, sat: 82, light: 63 },
    },
    palette_drift_range: 46.7,
    brightness_curve: "linear",
    pulse_rate_hz: 1.538,
    motion_smear_decay: 0.935,
    panic_palette:    { hue: 349, sat: 87, light: 58 },
    missed_word_scar: { hue: 27, sat: 47, light: 14 },
    bridge_palette:   { hue: 342, sat: 42, light: 56 },
    bridge_trigger:   "sustained-quiet",
  },
  drew: {
    base_palette: {
      primary: { hue: 68, sat: 60, light: 55 },
      accent:  { hue: 359, sat: 85, light: 67 },
    },
    palette_drift_range: 43.3,
    brightness_curve: "explosive",
    pulse_rate_hz: 1.267,
    motion_smear_decay: 0.92,
    panic_palette:    { hue: 359, sat: 90, light: 62 },
    missed_word_scar: { hue: 68, sat: 50, light: 14 },
    bridge_palette:   { hue: 23, sat: 45, light: 60 },
    bridge_trigger:   "sustained-quiet",
  },
  theo: {
    base_palette: {
      primary: { hue: 54, sat: 59, light: 53 },
      accent:  { hue: 355, sat: 84, light: 65 },
    },
    palette_drift_range: 49.7,
    brightness_curve: "linear",
    pulse_rate_hz: 1.958,
    motion_smear_decay: 0.927,
    panic_palette:    { hue: 356, sat: 89, light: 60 },
    missed_word_scar: { hue: 54, sat: 49, light: 14 },
    bridge_palette:   { hue: 314, sat: 44, light: 48 },
    bridge_trigger:   "sustained-quiet",
  },
  enokii: {
    base_palette: {
      primary: { hue: 81, sat: 59, light: 54 },
      accent:  { hue: 3, sat: 84, light: 66 },
    },
    palette_drift_range: 52.1,
    brightness_curve: "linear",
    pulse_rate_hz: 2.153,
    motion_smear_decay: 0.923,
    panic_palette:    { hue: 3, sat: 89, light: 61 },
    missed_word_scar: { hue: 81, sat: 49, light: 14 },
    bridge_palette:   { hue: 41, sat: 44, light: 54 },
    bridge_trigger:   "sustained-quiet",
  },
  clotho_nep: {
    base_palette: {
      primary: { hue: 82, sat: 43, light: 48 },
      accent:  { hue: 4, sat: 70, light: 60 },
    },
    palette_drift_range: 55.8,
    brightness_curve: "explosive",
    pulse_rate_hz: 2.153,
    motion_smear_decay: 0.922,
    panic_palette:    { hue: 3, sat: 80, light: 55 },
    missed_word_scar: { hue: 82, sat: 33, light: 14 },
    bridge_palette:   { hue: 22, sat: 25, light: 58 },
    bridge_trigger:   "sustained-quiet",
  },
  damien: {
    base_palette: {
      primary: { hue: 35, sat: 71, light: 48 },
      accent:  { hue: 350, sat: 95, light: 60 },
    },
    palette_drift_range: 46.4,
    brightness_curve: "linear",
    pulse_rate_hz: 1.872,
    motion_smear_decay: 0.88,
    panic_palette:    { hue: 352, sat: 99, light: 55 },
    missed_word_scar: { hue: 35, sat: 61, light: 14 },
    bridge_palette:   null,
    bridge_trigger:   null,
  },
  gena: {
    base_palette: {
      primary: { hue: 131, sat: 44, light: 49 },
      accent:  { hue: 18, sat: 70, light: 61 },
    },
    palette_drift_range: 47.7,
    brightness_curve: "explosive",
    pulse_rate_hz: 1.346,
    motion_smear_decay: 0.921,
    panic_palette:    { hue: 15, sat: 80, light: 56 },
    missed_word_scar: { hue: 131, sat: 34, light: 14 },
    bridge_palette:   { hue: 31, sat: 29, light: 44 },
    bridge_trigger:   "sustained-quiet",
  },
  sid: {
    base_palette: {
      primary: { hue: 27, sat: 54, light: 52 },
      accent:  { hue: 347, sat: 79, light: 64 },
    },
    palette_drift_range: 50.8,
    brightness_curve: "linear",
    pulse_rate_hz: 2.05,
    motion_smear_decay: 0.926,
    panic_palette:    { hue: 349, sat: 84, light: 59 },
    missed_word_scar: { hue: 27, sat: 44, light: 14 },
    bridge_palette:   { hue: 287, sat: 39, light: 47 },
    bridge_trigger:   "sustained-quiet",
  },
};

console.log(`[colour-relay] profiles embedded: ${Object.keys(EMBEDDED_PROFILE_KNOBS).length}`);

// =========================================================================
// Profile helpers
// =========================================================================
function currentProfile() {
  const r = READERS[state.readerIdx];
  const knobs = (r.profileKey && EMBEDDED_PROFILE_KNOBS[r.profileKey]) || DEFAULT_PROFILE_KNOBS;
  return { reader: r.reader, song_title: r.song_title, artist: r.artist, knobs };
}

function blendHsl(a, b, w) {
  const diff = ((b.hue - a.hue + 540) % 360) - 180;
  return {
    hue: (a.hue + diff * w + 360) % 360,
    sat: a.sat + (b.sat - a.sat) * w,
    light: a.light + (b.light - a.light) * w,
  };
}

function applyBrightnessCurve(volume, curve) {
  if (curve === "soft") return Math.pow(volume, 1.6);
  if (curve === "explosive") return Math.pow(volume, 0.6);
  return volume; // linear
}

// Pick the palette the visuals should be approaching this frame.
// Order: panic > bridge (sustained quiet) > primary→accent blend (peaks).
function pickTargetPalette(profile, dt) {
  const k = profile.knobs;

  // Bridge: sustained-quiet detector
  const isQuiet = state.signals.volume < 0.07 && state.signals.energy < 0.18;
  if (isQuiet) state.quietTime += dt;
  else state.quietTime = Math.max(0, state.quietTime - dt * 2);

  if (state.signals.panic > 0.4) return k.panic_palette;
  if (k.bridge_palette && state.quietTime > 2.5) return k.bridge_palette;

  const peak = Math.max(state.signals.volume * 1.4, state.signals.pitchFlux);
  const accentWeight = peak > 0.45 ? Math.min(1, (peak - 0.45) * 2.0) : 0;
  if (accentWeight === 0) return k.base_palette.primary;
  return blendHsl(k.base_palette.primary, k.base_palette.accent, accentWeight);
}

const state = {
  words: [],
  wordEls: [],
  offset: 0,
  speed: DEFAULT_SPEED,
  randomSpeed: false,
  randomUntil: 0,
  currentWord: 0,
  spokenWords: [],
  missedWords: new Set(),
  reader: 1,
  readerIdx: 0,
  quietTime: 0,
  running: false,
  paused: false,
  mediaStream: null,
  audioContext: null,
  analyser: null,
  audioData: null,
  recorders: [],
  recordings: {},
  recordingFormat: null,
  exportStamp: "",
  recognition: null,
  faceDetector: null,
  faceBoxes: [],
  faceDetectionDue: 0,
  faceDetectionBusy: false,
  faceMode: "none",
  emotionLabel: "waiting",
  signals: {
    volume: 0,
    pitchFlux: 0,
    motion: 0,
    mouth: 0,
    missed: 0,
    panic: 0,
    handoff: 0,
    faces: 0,
    energy: 0,
  },
  palette: {
    hue: 304,
    sat: 92,
    light: 54,
  },
  lastTime: 0,
  lastFrame: null,
  lastSpectrum: null,
  handoffFlash: 0,
};

const colorCtx = els.colorCanvas.getContext("2d", { willReadFrequently: true });
const visionCtx = els.visionCanvas.getContext("2d", { willReadFrequently: true });
const faceOverlayCtx = els.faceOverlay.getContext("2d");
const recordCtx = els.recordCanvas.getContext("2d");
const laptopRecordCtx = els.laptopRecordCanvas.getContext("2d");

els.scriptText.value = sampleText;
setSpeed(DEFAULT_SPEED);
els.speed.addEventListener("input", () => {
  setSpeed(Number(els.speed.value));
});
els.liveSpeed.addEventListener("input", () => {
  setSpeed(Number(els.liveSpeed.value));
});
els.randomSpeed.addEventListener("change", () => {
  state.randomSpeed = els.randomSpeed.checked;
});

els.startMedia.addEventListener("click", startMedia);
els.begin.addEventListener("click", beginPerformance);
els.pause.addEventListener("click", togglePause);
els.handoff.addEventListener("click", markHandoff);
els.panic.addEventListener("click", () => triggerRandomSpeed(2600));
els.finish.addEventListener("click", finishPerformance);

// Spacebar = Next reader, but only while the relay is running and not when
// the focused element is an input/textarea (so typing the monologue doesn't fire).
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  if (!state.running) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  e.preventDefault();
  markHandoff();
});

showSupportNotes();

async function startMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 540, facingMode: "user" },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    state.mediaStream = stream;
    els.webcam.srcObject = stream;
    setupAudio(stream);
    setupFaceDetection();
    els.begin.disabled = false;
    els.startMedia.textContent = "camera + mic are on";
  } catch (error) {
    els.supportNote.textContent = `Could not start media: ${error.message}`;
  }
}

function setupAudio(stream) {
  state.audioContext = new AudioContext();
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 2048;
  state.audioData = new Uint8Array(state.analyser.frequencyBinCount);
  source.connect(state.analyser);
}

function setupFaceDetection() {
  if ("FaceDetector" in window) {
    try {
      state.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
      state.faceMode = "native";
      els.faceStatus.textContent = "faces: detector ready";
      return;
    } catch {
      state.faceDetector = null;
    }
  }
  state.faceMode = "motion";
  els.faceStatus.textContent = "faces: motion box fallback";
}

function beginPerformance() {
  const text = els.scriptText.value.trim() || sampleText;
  state.words = tokenize(text);
  state.spokenWords = [];
  state.missedWords.clear();
  state.offset = 0;
  state.currentWord = 0;
  state.running = true;
  state.paused = false;
  state.recorders = [];
  state.recordings = {};
  state.exportStamp = new Date().toISOString().replace(/[:.]/g, "-");
  state.faceBoxes = [];
  state.faceDetectionDue = 0;
  state.faceDetectionBusy = false;
  state.emotionLabel = "waiting";
  state.lastTime = performance.now();
  state.speed = Number(els.speed.value) || DEFAULT_SPEED;
  state.readerIdx = 0;
  state.reader = 1;
  state.quietTime = 0;
  const initial = currentProfile().knobs.base_palette.primary;
  state.palette.hue = initial.hue;
  state.palette.sat = initial.sat;
  state.palette.light = initial.light;
  els.readerLabel.textContent = currentProfile().reader;

  els.scroller.innerHTML = state.words
    .map((word, index) => `<span class="word" data-index="${index}">${escapeHtml(word.raw)}</span>`)
    .join(" ");
  state.wordEls = [...els.scroller.querySelectorAll(".word")];
  els.setup.classList.add("hidden");
  els.stage.classList.remove("hidden");
  els.downloadPhone.classList.add("hidden");
  els.downloadLaptop.classList.add("hidden");

  resizeColorCanvas();
  startSpeech();
  startRecording();
  requestAnimationFrame(tick);
}

function tokenize(text) {
  return text
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((raw) => ({ raw, clean: cleanWord(raw) }));
}

function cleanWord(word) {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function tick(now) {
  if (!state.running) return;
  const dt = Math.min(0.08, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;

  readSignals();
  if (!state.paused) {
    maybeRandomSpeed(now);
    const speed = activeSpeed(now);
    state.offset += speed * dt;
    els.scroller.style.transform = `translate(${-state.offset}px, -50%)`;
    updateCurrentWord();
  }

  updateMissedWords();
  drawColor(now, dt);
  drawRecordFrames();
  requestAnimationFrame(tick);
}

function readSignals() {
  readAudioSignals();
  readVideoSignals();
  maybeDetectFaces();
  updateEnergySignal();
  state.signals.missed = Math.min(1, state.missedWords.size / Math.max(5, state.currentWord + 1));
  state.signals.panic *= 0.94;
  state.signals.handoff *= 0.9;
}

function readAudioSignals() {
  if (!state.analyser || !state.audioData) return;
  state.analyser.getByteFrequencyData(state.audioData);
  let total = 0;
  let weighted = 0;
  let energyBins = 0;

  for (let i = 2; i < state.audioData.length; i += 1) {
    const value = state.audioData[i] / 255;
    total += value;
    weighted += value * i;
    if (value > 0.08) energyBins += 1;
  }

  const volume = clamp(total / state.audioData.length * 3.8, 0, 1);
  const centroid = weighted / Math.max(1, total) / state.audioData.length;
  let flux = 0;
  if (state.lastSpectrum) {
    for (let i = 0; i < state.audioData.length; i += 10) {
      flux += Math.abs(state.audioData[i] - state.lastSpectrum[i]) / 255;
    }
    flux = clamp(flux / (state.audioData.length / 10), 0, 1);
  }
  state.lastSpectrum = new Uint8Array(state.audioData);
  state.signals.volume = smooth(state.signals.volume, volume, 0.22);
  state.signals.pitchFlux = smooth(state.signals.pitchFlux, clamp(centroid * 1.9 + flux, 0, 1), 0.18);
  state.signals.mouth = smooth(state.signals.mouth, clamp(volume * 0.72 + energyBins / state.audioData.length, 0, 1), 0.2);
}

function readVideoSignals() {
  const video = els.webcam;
  if (!video.videoWidth) return;

  const w = els.visionCanvas.width;
  const h = els.visionCanvas.height;
  visionCtx.save();
  visionCtx.scale(-1, 1);
  visionCtx.drawImage(video, -w, 0, w, h);
  visionCtx.restore();
  const frame = visionCtx.getImageData(0, 0, w, h).data;

  let diff = 0;
  let lowerLight = 0;
  let centerLight = 0;
  let count = 0;

  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      const i = (y * w + x) * 4;
      const light = (frame[i] + frame[i + 1] + frame[i + 2]) / 765;
      if (state.lastFrame) diff += Math.abs(light - state.lastFrame[(y * w + x) * 4]);
      if (x > w * 0.32 && x < w * 0.68 && y > h * 0.52 && y < h * 0.82) lowerLight += light;
      if (x > w * 0.28 && x < w * 0.72 && y > h * 0.18 && y < h * 0.82) centerLight += light;
      count += 1;
    }
  }

  const sampled = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i += 4) {
    sampled[i] = (frame[i] + frame[i + 1] + frame[i + 2]) / 765;
  }
  state.lastFrame = sampled;

  const motion = clamp((diff / Math.max(1, count)) * 10, 0, 1);
  const mouthMotion = clamp(state.signals.mouth * 0.65 + Math.abs(lowerLight - centerLight) * 0.45, 0, 1);
  state.signals.motion = smooth(state.signals.motion, motion, 0.24);
  state.signals.mouth = smooth(state.signals.mouth, mouthMotion, 0.12);
  els.motionMeter.value = state.signals.motion;
  els.mouthMeter.value = state.signals.mouth;
}

function maybeDetectFaces() {
  const now = performance.now();
  if (!els.webcam.videoWidth || now < state.faceDetectionDue || state.faceDetectionBusy) {
    drawFaceOverlay();
    return;
  }

  state.faceDetectionDue = now + 180;
  if (!state.faceDetector) {
    updateFallbackFaceBox();
    drawFaceOverlay();
    return;
  }

  state.faceDetectionBusy = true;
  state.faceDetector.detect(els.webcam)
    .then((faces) => {
      state.faceBoxes = faces.map((face) => ({
        x: face.boundingBox.x,
        y: face.boundingBox.y,
        width: face.boundingBox.width,
        height: face.boundingBox.height,
      }));
      state.signals.faces = Math.min(1, state.faceBoxes.length / 3);
      updateFaceStatus();
    })
    .catch(() => {
      state.faceDetector = null;
      state.faceMode = "motion";
      updateFallbackFaceBox();
    })
    .finally(() => {
      state.faceDetectionBusy = false;
      drawFaceOverlay();
    });
}

function updateFallbackFaceBox() {
  if (state.signals.motion < 0.02 && state.signals.volume < 0.03) {
    state.faceBoxes = [];
  } else {
    const w = els.webcam.videoWidth || 960;
    const h = els.webcam.videoHeight || 540;
    state.faceBoxes = [{
      x: w * 0.28,
      y: h * 0.12,
      width: w * 0.44,
      height: h * 0.68,
    }];
  }
  state.signals.faces = Math.min(1, state.faceBoxes.length / 3);
  updateFaceStatus();
}

function updateFaceStatus() {
  const count = state.faceBoxes.length;
  const label = count === 1 ? "face" : "faces";
  const mode = state.faceMode === "native" ? "detected" : "estimated";
  els.faceStatus.textContent = `${label}: ${count} ${mode} / reader ${currentProfile().reader} / mood ${state.emotionLabel}`;
}

function drawFaceOverlay() {
  const canvas = els.faceOverlay;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
  faceOverlayCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (!els.webcam.videoWidth || !state.faceBoxes.length) return;

  const scaleX = canvas.width / els.webcam.videoWidth;
  const scaleY = canvas.height / els.webcam.videoHeight;
  faceOverlayCtx.lineWidth = Math.max(3, 3 * devicePixelRatio);
  faceOverlayCtx.strokeStyle = "#dfff00";
  faceOverlayCtx.fillStyle = "rgba(223, 255, 0, 0.16)";
  faceOverlayCtx.font = `${14 * devicePixelRatio}px Courier New`;

  state.faceBoxes.forEach((box, index) => {
    const x = canvas.width - (box.x + box.width) * scaleX;
    const y = box.y * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;
    faceOverlayCtx.fillRect(x, y, width, height);
    faceOverlayCtx.strokeRect(x, y, width, height);
    faceOverlayCtx.fillStyle = "#dfff00";
    faceOverlayCtx.fillText(`${currentProfile().reader}.${index + 1}`, x + 8, Math.max(22, y + 22));
    faceOverlayCtx.fillStyle = "rgba(223, 255, 0, 0.16)";
  });
}

function updateEnergySignal() {
  const { volume, pitchFlux, motion, mouth, panic, faces } = state.signals;
  const energy = clamp(volume * 0.36 + pitchFlux * 0.16 + motion * 0.2 + mouth * 0.16 + panic * 0.08 + faces * 0.04, 0, 1);
  state.signals.energy = smooth(state.signals.energy, energy, 0.18);
  state.emotionLabel = describeEnergy(state.signals.energy, motion, pitchFlux, panic);
  els.energyMeter.value = state.signals.energy;
  updateFaceStatus();
}

function describeEnergy(energy, motion, pitchFlux, panic) {
  if (panic > 0.45) return "machine panic";
  if (energy > 0.78) return "overloaded";
  if (energy > 0.55 && motion > 0.22) return "agitated";
  if (energy > 0.48 && pitchFlux > 0.38) return "bright";
  if (energy > 0.34) return "present";
  return "quiet";
}

function updateCurrentWord() {
  const centerX = window.innerWidth * 0.34;
  let nearest = state.currentWord;
  let nearestDistance = Infinity;

  for (let i = state.currentWord; i < Math.min(state.wordEls.length, state.currentWord + 28); i += 1) {
    const rect = state.wordEls[i].getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - centerX);
    if (distance < nearestDistance) {
      nearest = i;
      nearestDistance = distance;
    }
  }

  if (nearest !== state.currentWord) {
    state.wordEls[state.currentWord]?.classList.remove("current");
    state.currentWord = nearest;
    state.wordEls[state.currentWord]?.classList.add("current");
  }
}

function updateMissedWords() {
  if (!els.speechOn.checked || !state.words.length) return;
  const lag = 5;
  const recentSpeech = new Set(state.spokenWords.slice(-38));
  for (let i = 0; i < Math.max(0, state.currentWord - lag); i += 1) {
    const word = state.words[i];
    if (word.clean.length < 3) continue;
    if (!recentSpeech.has(word.clean) && !state.missedWords.has(i)) {
      state.missedWords.add(i);
      state.wordEls[i]?.classList.add("missed");
    }
  }
}

function maybeRandomSpeed(now) {
  if (!state.randomSpeed) return;
  if (now > state.randomUntil && Math.random() < 0.012) {
    triggerRandomSpeed(900 + Math.random() * 2800);
  }
}

function triggerRandomSpeed(duration) {
  state.randomUntil = performance.now() + duration;
  state.signals.panic = 1;
}

function activeSpeed(now) {
  if (now < state.randomUntil) {
    const wobble = 0.8 + Math.random() * 3.4;
    return clamp(state.speed * wobble, 80, 980);
  }
  return state.speed;
}

function markHandoff() {
  state.readerIdx = (state.readerIdx + 1) % READERS.length;
  state.reader = state.readerIdx + 1;
  state.quietTime = 0;
  state.signals.handoff = 1;
  state.handoffFlash = 1;
  els.readerLabel.textContent = currentProfile().reader;
}

function togglePause() {
  state.paused = !state.paused;
  els.pause.textContent = state.paused ? "Resume" : "Pause";
}

function drawColor(now, dt) {
  const { volume, pitchFlux, motion, mouth, missed, panic, handoff, energy, faces } = state.signals;
  const w = els.colorCanvas.width;
  const h = els.colorCanvas.height;
  const profile = currentProfile();
  const k = profile.knobs;

  // Pick the palette this frame should be approaching (panic > bridge > primary→accent blend).
  const target = pickTargetPalette(profile, dt);

  // Hue: pull toward target + signal-driven drift, scaled by drift_range.
  const driftScale = k.palette_drift_range / 35;
  const hueShift = pitchFlux * 60 + motion * 24 + panic * 150 + handoff * 200 + energy * 18;
  const hueDiff = ((target.hue - state.palette.hue + 540) % 360) - 180;
  state.palette.hue = (state.palette.hue + hueDiff * dt * 1.5 + hueShift * dt * driftScale * 0.8 + 360) % 360;

  // Sat/light: target sets baseline, signals modulate on top, brightness curve shapes voice→light.
  const lightDrive = applyBrightnessCurve(volume, k.brightness_curve);
  state.palette.sat = clamp(target.sat + volume * 22 + energy * 8, 15, 100);
  state.palette.light = clamp(target.light + lightDrive * 22 + energy * 10 + panic * 14, 15, 80);

  // Per-frame overdraw — motion_smear_decay controls persistence (lower decay = snappier).
  const overdrawAlpha = (1 - k.motion_smear_decay) + volume * 0.05 + energy * 0.03;
  colorCtx.fillStyle = `hsla(${state.palette.hue}, ${state.palette.sat}%, ${state.palette.light}%, ${overdrawAlpha})`;
  colorCtx.fillRect(0, 0, w, h);

  const pulses = 2 + Math.round(mouth * 8 + panic * 10 + faces * 3);
  for (let i = 0; i < pulses; i += 1) {
    const x = (Math.sin(now * 0.0012 + i * 17 + motion * 9) * 0.5 + 0.5) * w;
    const y = (Math.cos(now * 0.0016 + i * 11 + pitchFlux * 8) * 0.5 + 0.5) * h;
    const r = 20 + mouth * 120 + volume * 70 + energy * 90 + Math.random() * 30;
    colorCtx.fillStyle = `hsla(${(state.palette.hue + i * 33 + missed * 180) % 360}, 100%, ${46 + volume * 24}%, ${0.12 + volume * 0.28})`;
    colorCtx.beginPath();
    colorCtx.arc(x, y, r, 0, Math.PI * 2);
    colorCtx.fill();
  }

  // Smears now reference the accent palette family (was hard-coded +120 rotation).
  const accent = k.base_palette.accent;
  const smearCount = Math.round(2 + motion * 24 + energy * 8);
  for (let i = 0; i < smearCount; i += 1) {
    colorCtx.fillStyle = `hsla(${(accent.hue + i * 5) % 360}, ${accent.sat}%, ${accent.light}%, ${0.04 + motion * 0.12})`;
    const y = Math.random() * h;
    colorCtx.fillRect(Math.random() * w - w * 0.2, y, w * (0.12 + motion * 0.8), 4 + motion * 42);
  }

  if (missed > 0) {
    const scar = k.missed_word_scar;
    colorCtx.fillStyle = `hsla(${scar.hue}, ${scar.sat}%, ${scar.light}%, ${0.18 + missed * 0.40})`;
    for (let i = 0; i < 1 + missed * 9; i += 1) {
      colorCtx.fillRect(Math.random() * w, Math.random() * h, 8 + missed * 80, 2 + missed * 18);
    }
  }

  if (state.handoffFlash > 0.01) {
    colorCtx.fillStyle = `rgba(255, 255, 255, ${state.handoffFlash})`;
    colorCtx.fillRect(0, 0, w, h);
    colorCtx.fillStyle = "#000";
    colorCtx.font = "48px Arial";
    colorCtx.fillText(currentProfile().reader, 30, 70);
    state.handoffFlash *= 0.86;
  }

  els.scoreLine.textContent =
    `reader=${currentProfile().reader} faces=${state.faceBoxes.length} mood=${state.emotionLabel} volume=${volume.toFixed(2)} pitch=${pitchFlux.toFixed(2)} motion=${motion.toFixed(2)} energy=${energy.toFixed(2)} missed=${state.missedWords.size} quiet=${state.quietTime.toFixed(1)}`;
}

function resizeColorCanvas() {
  const rect = els.colorCanvas.getBoundingClientRect();
  els.colorCanvas.width = Math.max(600, Math.floor(rect.width * devicePixelRatio));
  els.colorCanvas.height = Math.max(380, Math.floor(rect.height * devicePixelRatio));
  colorCtx.fillStyle = "#fff";
  colorCtx.fillRect(0, 0, els.colorCanvas.width, els.colorCanvas.height);
}

function startRecording() {
  const format = preferredVideoFormat();
  state.recordingFormat = format;
  state.recordings = {
    phone: {
      canvas: els.recordCanvas,
      ctx: recordCtx,
      chunks: [],
      link: els.downloadPhone,
      label: "phone",
    },
    laptop: {
      canvas: els.laptopRecordCanvas,
      ctx: laptopRecordCtx,
      chunks: [],
      link: els.downloadLaptop,
      label: "laptop",
    },
  };

  state.recorders = Object.values(state.recordings).map((recording) => {
    const stream = recording.canvas.captureStream(30);
    if (state.mediaStream) {
      state.mediaStream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }
    const recorder = format.mimeType
      ? new MediaRecorder(stream, { mimeType: format.mimeType })
      : new MediaRecorder(stream);
    recording.recorder = recorder;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) recording.chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => exportRecording(recording));
    recorder.start(1000);
    return recorder;
  });
}

function drawRecordFrames() {
  drawPhoneRecordFrame();
  drawLaptopRecordFrame();
}

function drawPhoneRecordFrame() {
  const ctx = recordCtx;
  const w = els.recordCanvas.width;
  const h = els.recordCanvas.height;
  ctx.fillStyle = "#f7f5e9";
  ctx.fillRect(0, 0, w, h);

  const textH = 430;
  const faceH = 520;
  const colorY = textH + faceH;
  const colorH = h - colorY;

  drawRecordedTeleprompter(ctx, 0, 0, w, textH, {
    fontSize: 58,
    lineHeight: 70,
    maxLines: 4,
    before: 4,
    after: 22,
  });

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, textH, w, faceH);
  ctx.strokeRect(0, textH, w, faceH);
  if (els.webcam.videoWidth) {
    const videoW = 720;
    const videoH = 405;
    const videoX = (w - videoW) / 2;
    const videoY = textH + 72;
    drawMirroredVideo(ctx, videoX, videoY, videoW, videoH);
    drawRecordedFaceBoxes(ctx, videoX, videoY, videoW, videoH);
  }
  ctx.fillStyle = "#111";
  ctx.font = "40px Arial";
  ctx.fillText(`face / reader ${currentProfile().reader}`, 34, textH + 50);
  ctx.font = "28px Courier New";
  ctx.fillText(`mood ${state.emotionLabel}   faces ${state.faceBoxes.length}   energy ${state.signals.energy.toFixed(2)}`, 34, textH + faceH - 28);

  ctx.drawImage(els.colorCanvas, 0, colorY, w, colorH);
  ctx.strokeRect(0, colorY, w, colorH);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillRect(28, h - 70, w - 56, 42);
  ctx.fillStyle = "#111";
  ctx.font = "24px Courier New";
  ctx.fillText(els.scoreLine.textContent.slice(0, 86), 42, h - 40);
}

function drawLaptopRecordFrame() {
  const ctx = laptopRecordCtx;
  const w = els.laptopRecordCanvas.width;
  const h = els.laptopRecordCanvas.height;
  const textH = 220;
  const bottomY = textH;
  const bottomH = h - textH;
  const faceW = 430;
  const colorW = w - faceW;

  ctx.fillStyle = "#f7f5e9";
  ctx.fillRect(0, 0, w, h);
  drawRecordedTeleprompter(ctx, 0, 0, w, textH, {
    fontSize: 44,
    lineHeight: 54,
    maxLines: 3,
    before: 5,
    after: 20,
  });

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, bottomY, faceW, bottomH);
  ctx.strokeRect(0, bottomY, faceW, bottomH);
  if (els.webcam.videoWidth) {
    const videoW = 380;
    const videoH = 214;
    const videoX = 25;
    const videoY = bottomY + 62;
    drawMirroredVideo(ctx, videoX, videoY, videoW, videoH);
    drawRecordedFaceBoxes(ctx, videoX, videoY, videoW, videoH);
  }
  ctx.fillStyle = "#111";
  ctx.font = "26px Arial";
  ctx.fillText(`face / reader ${currentProfile().reader}`, 24, bottomY + 40);
  ctx.font = "18px Courier New";
  ctx.fillText(`mood ${state.emotionLabel}`, 24, h - 60);
  ctx.fillText(`faces ${state.faceBoxes.length}   energy ${state.signals.energy.toFixed(2)}`, 24, h - 34);

  ctx.drawImage(els.colorCanvas, faceW, bottomY, colorW, bottomH);
  ctx.strokeRect(faceW, bottomY, colorW, bottomH);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillRect(faceW + 18, h - 46, colorW - 36, 28);
  ctx.fillStyle = "#111";
  ctx.font = "16px Courier New";
  ctx.fillText(els.scoreLine.textContent.slice(0, 92), faceW + 30, h - 27);
}

function drawRecordedTeleprompter(ctx, x, y, width, height, options) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(x, y, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.font = `${options.fontSize}px Courier New`;
  drawWrappedWordTokens(ctx, visibleWordTokens(options.before, options.after), x + 38, y + options.lineHeight + 25, width - 76, options.lineHeight, options.maxLines);
  ctx.restore();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
}

function visibleWordTokens(before, after) {
  const start = Math.max(0, state.currentWord - before);
  return state.words.slice(start, state.currentWord + after).map((word, index) => {
    const absolute = start + index;
    return {
      text: state.missedWords.has(absolute) ? `[${word.raw}]` : word.raw,
      current: absolute === state.currentWord,
      missed: state.missedWords.has(absolute),
    };
  });
}

function drawWrappedWordTokens(ctx, tokens, x, y, maxWidth, lineHeight, maxLines) {
  const spaceWidth = ctx.measureText(" ").width;
  let cursorX = x;
  let cursorY = y;
  let line = 0;

  tokens.forEach((token) => {
    const metrics = ctx.measureText(token.text);
    const tokenWidth = metrics.width;
    if (cursorX > x && cursorX + tokenWidth > x + maxWidth) {
      line += 1;
      if (line >= maxLines) return;
      cursorX = x;
      cursorY += lineHeight;
    }
    if (line >= maxLines) return;
    if (token.current || token.missed) {
      ctx.fillStyle = token.current ? "#dfff00" : "#ff3b9d";
      ctx.fillRect(cursorX - 4, cursorY - lineHeight + 10, tokenWidth + 8, lineHeight - 8);
    }
    ctx.fillStyle = token.current ? "#111" : token.missed ? "#111" : "#fff";
    ctx.fillText(token.text, cursorX, cursorY);
    cursorX += tokenWidth + spaceWidth;
  });
}

function drawMirroredVideo(ctx, videoX, videoY, videoW, videoH) {
  ctx.save();
  ctx.translate(videoX + videoW, videoY);
  ctx.scale(-1, 1);
  ctx.drawImage(els.webcam, 0, 0, videoW, videoH);
  ctx.restore();
  ctx.strokeRect(videoX, videoY, videoW, videoH);
}

function drawRecordedFaceBoxes(ctx, videoX, videoY, videoW, videoH) {
  if (!state.faceBoxes.length || !els.webcam.videoWidth) return;
  const scaleX = videoW / els.webcam.videoWidth;
  const scaleY = videoH / els.webcam.videoHeight;
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#dfff00";
  ctx.fillStyle = "rgba(223, 255, 0, 0.18)";
  ctx.font = "24px Courier New";
  state.faceBoxes.forEach((box, index) => {
    const x = videoX + videoW - (box.x + box.width) * scaleX;
    const y = videoY + box.y * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#dfff00";
    ctx.fillText(`${currentProfile().reader}.${index + 1}`, x + 10, Math.max(videoY + 28, y + 28));
    ctx.fillStyle = "rgba(223, 255, 0, 0.18)";
  });
  ctx.restore();
}

function finishPerformance() {
  state.running = false;
  stopSpeech();
  state.recorders.forEach((recorder) => {
    if (recorder.state !== "inactive") recorder.stop();
  });
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  els.finish.disabled = true;
}

function exportRecording(recording) {
  const type = recording.recorder?.mimeType || state.recordingFormat?.mimeType || "video/webm";
  const blob = new Blob(recording.chunks, { type });
  const url = URL.createObjectURL(blob);
  const ext = state.recordingFormat?.extension || (type.includes("mp4") ? "mp4" : "webm");
  recording.link.href = url;
  recording.link.download = `lucky-relay-${recording.label}-${state.exportStamp}.${ext}`;
  recording.link.textContent = `download ${ext.toUpperCase()} ${recording.label} video`;
  recording.link.classList.remove("hidden");
  els.finish.disabled = false;
}

function startSpeech() {
  stopSpeech();
  if (!els.speechOn.checked) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.addEventListener("result", (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      transcript.split(/\s+/).map(cleanWord).filter(Boolean).forEach((word) => {
        state.spokenWords.push(word);
      });
      state.spokenWords = state.spokenWords.slice(-220);
    }
  });
  recognition.addEventListener("end", () => {
    if (state.running && !state.paused) {
      try {
        recognition.start();
      } catch {
        /* Browser is already starting recognition. */
      }
    }
  });
  state.recognition = recognition;
  try {
    recognition.start();
  } catch {
    /* Speech recognition can be fussy about rapid starts. */
  }
}

function stopSpeech() {
  if (!state.recognition) return;
  state.recognition.onend = null;
  try {
    state.recognition.stop();
  } catch {
    /* Already stopped. */
  }
  state.recognition = null;
}

function preferredVideoFormat() {
  const formats = [
    { mimeType: "video/mp4;codecs=h264,aac", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  return formats.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) || { mimeType: "", extension: "webm" };
}

function setSpeed(value) {
  const min = Number(els.speed.min);
  const max = Number(els.speed.max);
  const next = clamp(Number(value) || DEFAULT_SPEED, min, max);
  state.speed = next;
  els.speed.value = next;
  els.liveSpeed.value = next;
  els.speedLabel.textContent = `${next} px/s`;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) return;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

function showSupportNotes() {
  const notes = [];
  if (!("mediaDevices" in navigator)) notes.push("No webcam API found.");
  if (!("MediaRecorder" in window)) {
    notes.push("No browser video recorder found.");
  } else {
    const format = preferredVideoFormat();
    notes.push(`Export target: ${format.extension.toUpperCase()} portrait video.`);
    if (format.extension !== "mp4") notes.push("For iPhone-friendlier MP4, try Safari if this browser gives WebM.");
  }
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    notes.push("Omitted-word catching needs Chrome/Safari speech recognition; the rest still works.");
  }
  els.supportNote.textContent = notes.join(" ");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smooth(previous, next, amount) {
  return previous + (next - previous) * amount;
}

window.addEventListener("resize", resizeColorCanvas);
