// Shared briefing builder used by BOTH the local Express server (server.js)
// and the Vercel serverless function (api/briefing.js). Single source of truth.

import { getWeather } from "./weather.js";
import { getMarkets } from "./markets.js";
import { getNews } from "./news.js";
import { synthesize } from "./synthesize.js";

export async function buildBriefing() {
  const started = Date.now();

  // Aggregate all sources in parallel; individual failures degrade gracefully.
  const [weather, markets, news] = await Promise.all([
    getWeather(),
    getMarkets(),
    getNews(),
  ]);

  const data = { weather, markets, news };
  const { text, source, warning } = await synthesize(data);

  return {
    ok: true,
    briefing: text,
    meta: {
      synthesizer: source,
      warning: warning || null,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
    },
    data,
  };
}

export function llmStatus() {
  const has = (k) => Boolean(process.env[k] && !process.env[k].includes("your_"));
  return {
    anthropic: has("ANTHROPIC_API_KEY"),
    openai: has("OPENAI_API_KEY"),
    groq: has("GROQ_API_KEY"),
    gemini: has("GEMINI_API_KEY"),
  };
}
