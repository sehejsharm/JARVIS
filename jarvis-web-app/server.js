// JARVIS — voice-activated morning briefing PWA backend.
// Aggregates weather + markets + news, synthesizes via LLM, serves the PWA.

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getWeather } from "./src/weather.js";
import { getMarkets } from "./src/markets.js";
import { getNews } from "./src/news.js";
import { synthesize } from "./src/synthesize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- API: full briefing ---------------------------------------------------
app.get("/api/briefing", async (req, res) => {
  const started = Date.now();
  try {
    // Aggregate all sources in parallel; individual failures degrade gracefully.
    const [weather, markets, news] = await Promise.all([
      getWeather(),
      getMarkets(),
      getNews(),
    ]);

    const raw = { weather, markets, news };
    const { text, source, warning } = await synthesize(raw);

    res.json({
      ok: true,
      briefing: text,
      meta: {
        synthesizer: source,
        warning: warning || null,
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
      },
      data: raw,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Health check ----------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "jarvis",
    llm: {
      anthropic: Boolean(
        process.env.ANTHROPIC_API_KEY &&
          !process.env.ANTHROPIC_API_KEY.includes("your_")
      ),
      openai: Boolean(
        process.env.OPENAI_API_KEY &&
          !process.env.OPENAI_API_KEY.includes("your_")
      ),
    },
  });
});

// --- Static PWA ------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`\n  JARVIS online → http://localhost:${PORT}\n`);
});
