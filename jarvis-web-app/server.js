// JARVIS — voice-activated morning briefing PWA backend.
// Aggregates weather + markets + news, synthesizes via LLM, serves the PWA.

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBriefing, llmStatus } from "./src/briefing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- API: full briefing ---------------------------------------------------
app.get("/api/briefing", async (req, res) => {
  try {
    res.json(await buildBriefing());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Health check ----------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "jarvis", llm: llmStatus() });
});

// --- Static PWA ------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`\n  JARVIS online → http://localhost:${PORT}\n`);
});
