// JARVIS frontend — fetches the briefing, displays it, and speaks it aloud
// using the browser's native Web Speech API.

const core = document.getElementById("core");
const coreLabel = document.getElementById("coreLabel");
const coreSub = document.getElementById("coreSub");
const eq = document.getElementById("eq");
const statusEl = document.getElementById("status");
const briefingPanel = document.getElementById("briefingPanel");
const briefingText = document.getElementById("briefingText");
const metaLine = document.getElementById("metaLine");
const tiles = document.getElementById("tiles");
const weatherTile = document.getElementById("weatherTile");
const marketTile = document.getElementById("marketTile");
const newsTile = document.getElementById("newsTile");
const replayBtn = document.getElementById("replayBtn");
const stopBtn = document.getElementById("stopBtn");

let lastBriefing = "";
let busy = false;
let voicesReady = false;

// --- Voice selection ------------------------------------------------------
// Prefer a deep, professional English (UK/US male) voice when available.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const prefs = [
    "Daniel",            // UK male (Apple)
    "Google UK English Male",
    "Microsoft Ryan",
    "Microsoft Guy",
    "Arthur",
    "Oliver",
    "Google US English",
    "Microsoft David",
    "Alex",
  ];
  for (const name of prefs) {
    const v = voices.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
    if (v) return v;
  }
  // Fall back to any en-GB, then any English voice.
  return (
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

// Voices load asynchronously in most browsers.
function warmVoices() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) { voicesReady = true; return resolve(); }
    window.speechSynthesis.onvoiceschanged = () => {
      voicesReady = true;
      resolve();
    };
    // Safety timeout — proceed even if the event never fires.
    setTimeout(resolve, 1500);
  });
}

function setStatus(text) { statusEl.textContent = text; }

function setSpeakingUI(on) {
  if (on) {
    core.classList.remove("breathe");
    core.classList.add("speaking");
    eq.classList.remove("hidden");
    coreLabel.textContent = "SPEAKING";
    coreSub.textContent = "briefing live";
  } else {
    core.classList.remove("speaking");
    core.classList.add("breathe");
    eq.classList.add("hidden");
    coreLabel.textContent = "RE-RUN";
    coreSub.textContent = "tap to refresh";
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("Voice not supported on this browser");
    return;
  }
  window.speechSynthesis.cancel();

  // Break into sentences so long briefings stay reliable on mobile Safari.
  const chunks = text.match(/[^.!?]+[.!?]*/g) || [text];
  const voice = pickVoice();

  setSpeakingUI(true);
  setStatus("Briefing in progress");

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk.trim());
    if (voice) u.voice = voice;
    u.lang = voice?.lang || "en-GB";
    u.rate = 0.98;
    u.pitch = 0.9;   // slightly deeper
    u.volume = 1;
    if (i === chunks.length - 1) {
      u.onend = () => { setSpeakingUI(false); setStatus("Briefing complete"); };
    }
    window.speechSynthesis.speak(u);
  });
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
  setSpeakingUI(false);
  setStatus("Stopped");
}

// --- Rendering ------------------------------------------------------------
function renderTiles(data) {
  const w = data.weather;
  if (w?.ok) {
    weatherTile.innerHTML = `
      <div class="text-[10px] tracking-widest text-cyan-400/70 uppercase mb-1">Udaipur</div>
      <div class="text-2xl font-semibold text-cyan-100">${Math.round(w.current.temperature)}°<span class="text-sm text-cyan-400/70">C</span></div>
      <div class="text-xs text-cyan-300/80 mt-1">${w.current.conditions}</div>
      <div class="text-[11px] text-cyan-500/70 mt-1">H ${Math.round(w.forecast.high)}° · L ${Math.round(w.forecast.low)}° · Rain ${w.forecast.precipitationChance ?? 0}%</div>`;
  } else {
    weatherTile.innerHTML = `<div class="text-xs text-cyan-500/60">Weather unavailable</div>`;
  }

  const ms = (data.markets || []).filter((m) => m.ok);
  marketTile.innerHTML =
    `<div class="text-[10px] tracking-widest text-cyan-400/70 uppercase mb-2">Markets</div>` +
    (ms.length
      ? ms
          .map((m) => {
            const up = m.direction === "up";
            const color = up ? "text-emerald-400" : "text-rose-400";
            const arrow = up ? "▲" : "▼";
            return `<div class="flex justify-between items-baseline text-xs mb-1">
              <span class="text-cyan-200/90">${m.label}</span>
              <span class="${color}">${arrow} ${Math.abs(m.changePercent)}%</span>
            </div>`;
          })
          .join("")
      : `<div class="text-xs text-cyan-500/60">Markets unavailable</div>`);

  const news = data.news || [];
  newsTile.innerHTML =
    `<div class="text-[10px] tracking-widest text-cyan-400/70 uppercase mb-2">Headlines</div>` +
    (news.length
      ? news
          .map(
            (n) => `<div class="text-xs text-cyan-100/85 mb-2 leading-snug">
              <span class="text-cyan-500/70">[${n.topic}]</span> ${n.title}
            </div>`
          )
          .join("")
      : `<div class="text-xs text-cyan-500/60">No headlines available</div>`);

  tiles.classList.remove("hidden");
}

// --- Main flow ------------------------------------------------------------
async function initialize() {
  if (busy) return;
  busy = true;

  // Unlock audio on this user gesture (iOS requirement).
  try {
    const warm = new SpeechSynthesisUtterance(" ");
    warm.volume = 0;
    window.speechSynthesis.speak(warm);
  } catch (_) {}

  await warmVoices();

  core.classList.remove("breathe");
  coreLabel.textContent = "SYNCING";
  coreSub.textContent = "fetching data";
  setStatus("Aggregating live data…");
  briefingPanel.classList.remove("hidden");
  briefingText.textContent = "Compiling your briefing…";
  metaLine.textContent = "";

  try {
    const res = await fetch("/api/briefing", { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Briefing failed");

    lastBriefing = json.briefing;
    briefingText.textContent = lastBriefing;
    renderTiles(json.data);

    const m = json.meta || {};
    const bits = [`Source: ${m.synthesizer || "n/a"}`];
    if (m.generatedAt) bits.push(new Date(m.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
    metaLine.textContent = bits.join("  ·  ");
    if (m.warning) {
      metaLine.textContent += `  ·  ${m.warning}`;
    }

    speak(lastBriefing);
  } catch (err) {
    setStatus("Error");
    briefingText.textContent = `Unable to compile briefing: ${err.message}`;
    core.classList.add("breathe");
    coreLabel.textContent = "RETRY";
    coreSub.textContent = "tap again";
  } finally {
    busy = false;
  }
}

core.addEventListener("click", initialize);
core.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") initialize(); });
replayBtn.addEventListener("click", () => lastBriefing && speak(lastBriefing));
stopBtn.addEventListener("click", stopSpeaking);

// Warm voices early so the first tap is snappy.
warmVoices();

// Register service worker for installability / offline shell.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
