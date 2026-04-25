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
  download: document.querySelector("#download"),
  colorCanvas: document.querySelector("#colorCanvas"),
  visionCanvas: document.querySelector("#visionCanvas"),
  faceOverlay: document.querySelector("#faceOverlay"),
  recordCanvas: document.querySelector("#recordCanvas"),
  mouthMeter: document.querySelector("#mouthMeter"),
  motionMeter: document.querySelector("#motionMeter"),
  energyMeter: document.querySelector("#energyMeter"),
  faceStatus: document.querySelector("#faceStatus"),
  scoreLine: document.querySelector("#scoreLine"),
};

const sampleText = `Given the existence as uttered forth in the public works of Puncher and Wattmann of a personal God quaquaquaqua with white beard quaquaquaqua outside time without extension who from the heights of divine apathia divine athambia divine aphasia loves us dearly with some exceptions for reasons unknown but time will tell.`;
const DEFAULT_SPEED = 220;

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
  running: false,
  paused: false,
  mediaStream: null,
  audioContext: null,
  analyser: null,
  audioData: null,
  mediaRecorder: null,
  recordedChunks: [],
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
  state.recordedChunks = [];
  state.faceBoxes = [];
  state.faceDetectionDue = 0;
  state.faceDetectionBusy = false;
  state.emotionLabel = "waiting";
  state.lastTime = performance.now();
  state.speed = Number(els.speed.value) || DEFAULT_SPEED;

  els.scroller.innerHTML = state.words
    .map((word, index) => `<span class="word" data-index="${index}">${escapeHtml(word.raw)}</span>`)
    .join(" ");
  state.wordEls = [...els.scroller.querySelectorAll(".word")];
  els.setup.classList.add("hidden");
  els.stage.classList.remove("hidden");
  els.download.classList.add("hidden");

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
  drawRecordFrame();
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
  els.faceStatus.textContent = `${label}: ${count} ${mode} / reader ${state.reader} / mood ${state.emotionLabel}`;
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
    faceOverlayCtx.fillText(`reader ${state.reader}.${index + 1}`, x + 8, Math.max(22, y + 22));
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
  state.reader += 1;
  state.signals.handoff = 1;
  state.handoffFlash = 1;
  state.palette.hue = (state.palette.hue + 81 + Math.random() * 72) % 360;
  els.readerLabel.textContent = `reader ${state.reader}`;
}

function togglePause() {
  state.paused = !state.paused;
  els.pause.textContent = state.paused ? "Resume" : "Pause";
}

function drawColor(now, dt) {
  const { volume, pitchFlux, motion, mouth, missed, panic, handoff, energy, faces } = state.signals;
  const w = els.colorCanvas.width;
  const h = els.colorCanvas.height;
  const hueShift = pitchFlux * 60 + motion * 24 + panic * 150 + handoff * 200 + energy * 18;
  state.palette.hue = (state.palette.hue + hueShift * dt * 2.3) % 360;
  state.palette.sat = 68 + volume * 24 + energy * 10;
  state.palette.light = 38 + volume * 28 + energy * 14 + panic * 16;

  colorCtx.fillStyle = `hsla(${state.palette.hue}, ${state.palette.sat}%, ${state.palette.light}%, ${0.04 + volume * 0.06 + energy * 0.04})`;
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

  const smearCount = Math.round(2 + motion * 24 + energy * 8);
  for (let i = 0; i < smearCount; i += 1) {
    colorCtx.fillStyle = `hsla(${(state.palette.hue + 120 + i * 5) % 360}, 95%, 55%, ${0.04 + motion * 0.12})`;
    const y = Math.random() * h;
    colorCtx.fillRect(Math.random() * w - w * 0.2, y, w * (0.12 + motion * 0.8), 4 + motion * 42);
  }

  if (missed > 0) {
    colorCtx.fillStyle = `rgba(0, 0, 0, ${0.08 + missed * 0.32})`;
    for (let i = 0; i < 1 + missed * 9; i += 1) {
      colorCtx.fillRect(Math.random() * w, Math.random() * h, 8 + missed * 80, 2 + missed * 18);
    }
  }

  if (state.handoffFlash > 0.01) {
    colorCtx.fillStyle = `rgba(255, 255, 255, ${state.handoffFlash})`;
    colorCtx.fillRect(0, 0, w, h);
    colorCtx.fillStyle = "#000";
    colorCtx.font = "48px Arial";
    colorCtx.fillText(`reader ${state.reader}`, 30, 70);
    state.handoffFlash *= 0.86;
  }

  els.scoreLine.textContent =
    `reader=${state.reader} faces=${state.faceBoxes.length} mood=${state.emotionLabel} volume=${volume.toFixed(2)} pitch=${pitchFlux.toFixed(2)} motion=${motion.toFixed(2)} energy=${energy.toFixed(2)} missed=${state.missedWords.size}`;
}

function resizeColorCanvas() {
  const rect = els.colorCanvas.getBoundingClientRect();
  els.colorCanvas.width = Math.max(600, Math.floor(rect.width * devicePixelRatio));
  els.colorCanvas.height = Math.max(380, Math.floor(rect.height * devicePixelRatio));
  colorCtx.fillStyle = "#fff";
  colorCtx.fillRect(0, 0, els.colorCanvas.width, els.colorCanvas.height);
}

function startRecording() {
  const stream = els.recordCanvas.captureStream(30);
  if (state.mediaStream) {
    state.mediaStream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }
  const format = preferredVideoFormat();
  state.recordingFormat = format;
  state.mediaRecorder = format.mimeType
    ? new MediaRecorder(stream, { mimeType: format.mimeType })
    : new MediaRecorder(stream);
  state.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) state.recordedChunks.push(event.data);
  });
  state.mediaRecorder.addEventListener("stop", exportRecording);
  state.mediaRecorder.start(1000);
}

function drawRecordFrame() {
  const w = els.recordCanvas.width;
  const h = els.recordCanvas.height;
  recordCtx.fillStyle = "#f7f5e9";
  recordCtx.fillRect(0, 0, w, h);

  const textH = 430;
  const faceH = 520;
  const colorY = textH + faceH;
  const colorH = h - colorY;

  recordCtx.fillStyle = "#050505";
  recordCtx.fillRect(0, 0, w, textH);
  recordCtx.save();
  recordCtx.beginPath();
  recordCtx.rect(0, 0, w, textH);
  recordCtx.clip();
  recordCtx.font = "58px Courier New";
  recordCtx.fillStyle = "#fff";
  const visibleText = state.words.slice(Math.max(0, state.currentWord - 4), state.currentWord + 22).map((word, idx) => {
    const absolute = Math.max(0, state.currentWord - 4) + idx;
    return state.missedWords.has(absolute) ? `[${word.raw}]` : word.raw;
  }).join(" ");
  wrapText(recordCtx, visibleText, 38, 95, w - 76, 70, 4);
  recordCtx.restore();

  recordCtx.strokeStyle = "#111";
  recordCtx.lineWidth = 4;
  recordCtx.strokeRect(0, 0, w, textH);

  recordCtx.fillStyle = "#fff";
  recordCtx.fillRect(0, textH, w, faceH);
  recordCtx.strokeRect(0, textH, w, faceH);
  if (els.webcam.videoWidth) {
    const videoW = 720;
    const videoH = 405;
    const videoX = (w - videoW) / 2;
    const videoY = textH + 72;
    recordCtx.save();
    recordCtx.translate(videoX + videoW, videoY);
    recordCtx.scale(-1, 1);
    recordCtx.drawImage(els.webcam, 0, 0, videoW, videoH);
    recordCtx.restore();
    recordCtx.strokeRect(videoX, videoY, videoW, videoH);
    drawRecordedFaceBoxes(videoX, videoY, videoW, videoH);
  }
  recordCtx.fillStyle = "#111";
  recordCtx.font = "40px Arial";
  recordCtx.fillText(`face / reader ${state.reader}`, 34, textH + 50);
  recordCtx.font = "28px Courier New";
  recordCtx.fillText(`mood ${state.emotionLabel}   faces ${state.faceBoxes.length}   energy ${state.signals.energy.toFixed(2)}`, 34, textH + faceH - 28);

  recordCtx.drawImage(els.colorCanvas, 0, colorY, w, colorH);
  recordCtx.strokeRect(0, colorY, w, colorH);
  recordCtx.fillStyle = "rgba(255,255,255,0.76)";
  recordCtx.fillRect(28, h - 70, w - 56, 42);
  recordCtx.fillStyle = "#111";
  recordCtx.font = "24px Courier New";
  recordCtx.fillText(els.scoreLine.textContent.slice(0, 86), 42, h - 40);
}

function drawRecordedFaceBoxes(videoX, videoY, videoW, videoH) {
  if (!state.faceBoxes.length || !els.webcam.videoWidth) return;
  const scaleX = videoW / els.webcam.videoWidth;
  const scaleY = videoH / els.webcam.videoHeight;
  recordCtx.save();
  recordCtx.lineWidth = 5;
  recordCtx.strokeStyle = "#dfff00";
  recordCtx.fillStyle = "rgba(223, 255, 0, 0.18)";
  recordCtx.font = "24px Courier New";
  state.faceBoxes.forEach((box, index) => {
    const x = videoX + videoW - (box.x + box.width) * scaleX;
    const y = videoY + box.y * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;
    recordCtx.fillRect(x, y, width, height);
    recordCtx.strokeRect(x, y, width, height);
    recordCtx.fillStyle = "#dfff00";
    recordCtx.fillText(`reader ${state.reader}.${index + 1}`, x + 10, Math.max(videoY + 28, y + 28));
    recordCtx.fillStyle = "rgba(223, 255, 0, 0.18)";
  });
  recordCtx.restore();
}

function finishPerformance() {
  state.running = false;
  stopSpeech();
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  els.finish.disabled = true;
}

function exportRecording() {
  const type = state.mediaRecorder?.mimeType || state.recordingFormat?.mimeType || "video/webm";
  const blob = new Blob(state.recordedChunks, { type });
  const url = URL.createObjectURL(blob);
  els.download.href = url;
  const ext = state.recordingFormat?.extension || (type.includes("mp4") ? "mp4" : "webm");
  els.download.download = `lucky-relay-phone-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
  els.download.textContent = `download ${ext.toUpperCase()} phone video`;
  els.download.classList.remove("hidden");
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
