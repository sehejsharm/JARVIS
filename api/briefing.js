// JARVIS — self-contained morning-briefing API (Vercel serverless function).
// Aggregates weather + markets + news and synthesizes a spoken briefing.
// Zero npm dependencies: uses native fetch and a tiny inline RSS parser.

export const maxDuration = 60;

/* ─────────────────────────  WEATHER (Open-Meteo, free)  ───────────────────────── */
const UDAIPUR = { lat: 24.5854, lon: 73.7125, name: "Udaipur, Rajasthan" };
const WEATHER_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Rain", 65: "Heavy rain", 71: "Slight snow", 73: "Snow",
  75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};
const describe = (c) => WEATHER_CODES[c] ?? "Unknown conditions";

async function getWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${UDAIPUR.lat}&longitude=${UDAIPUR.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FKolkata&forecast_days=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    const c = d.current ?? {}, day = d.daily ?? {};
    return {
      ok: true, location: UDAIPUR.name,
      current: {
        temperature: c.temperature_2m, feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m, windSpeed: c.wind_speed_10m,
        conditions: describe(c.weather_code),
      },
      forecast: {
        high: day.temperature_2m_max?.[0], low: day.temperature_2m_min?.[0],
        precipitationChance: day.precipitation_probability_max?.[0],
        conditions: describe(day.weather_code?.[0]),
      },
    };
  } catch (err) {
    return { ok: false, location: UDAIPUR.name, error: err.message };
  }
}

/* ─────────────────────────  MARKETS (Yahoo Finance, free)  ───────────────────────── */
const SYMBOLS = [
  { symbol: "^NSEI", label: "Nifty 50", group: "index" },
  { symbol: "^BSESN", label: "Sensex", group: "index" },
  { symbol: "EURUSD=X", label: "EUR/USD", group: "fx" },
  { symbol: "GBPUSD=X", label: "GBP/USD", group: "fx" },
  { symbol: "SI=F", label: "Silver (XAG)", group: "commodity" },
];
const round = (n, d) => (typeof n === "number" && !Number.isNaN(n) ? Math.round(n * 10 ** d) / 10 ** d : n);

async function quote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0 (JARVIS Briefing)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const m = data?.chart?.result?.[0]?.meta;
  if (!m) throw new Error("No data");
  const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose;
  if (typeof price !== "number" || typeof prev !== "number") throw new Error("Incomplete");
  const change = price - prev;
  return { price, change, changePercent: prev ? (change / prev) * 100 : 0, currency: m.currency ?? "" };
}

async function getMarkets() {
  return Promise.all(SYMBOLS.map(async (s) => {
    try {
      const q = await quote(s.symbol);
      const dp = s.group === "fx" ? 4 : 2;
      return {
        ok: true, symbol: s.symbol, label: s.label, group: s.group,
        price: round(q.price, dp), change: round(q.change, dp),
        changePercent: round(q.changePercent, 2), currency: q.currency,
        direction: q.change >= 0 ? "up" : "down",
      };
    } catch (err) {
      return { ok: false, symbol: s.symbol, label: s.label, group: s.group, error: err.message };
    }
  }));
}

/* ─────────────────────────  NEWS (Google News RSS, free)  ───────────────────────── */
const TOPICS = [
  { label: "Global Macroeconomics", q: "global macroeconomics OR central bank OR inflation OR Federal Reserve", take: 2 },
  { label: "Geopolitics", q: "geopolitics OR international relations OR global trade tensions", take: 1 },
  { label: "Indian Legal Updates", q: "India legal OR Supreme Court India OR SEBI OR RBI policy", take: 1 },
  { label: "Clean Energy Technology", q: "onshore wind generator OR wind turbine technology OR energy infrastructure OR clean energy grid", take: 2 },
];
const stripCdata = (s = "") => s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

// Minimal RSS item extractor — avoids needing an external parser dependency.
function parseItems(xml, take) {
  const items = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const b of blocks.slice(0, take)) {
    const tMatch = b.match(/<title>([\s\S]*?)<\/title>/i);
    if (!tMatch) continue;
    let title = decode(stripCdata(tMatch[1]));
    let source = "News";
    const sMatch = b.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    if (sMatch) source = decode(stripCdata(sMatch[1]));
    const idx = title.lastIndexOf(" - ");
    if (idx > 0) { if (source === "News") source = title.slice(idx + 3).trim(); title = title.slice(0, idx).trim(); }
    items.push({ title, source });
  }
  return items;
}

async function getNews() {
  const groups = await Promise.all(TOPICS.map(async (t) => {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(t.q)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (JARVIS Briefing)" } });
      if (!res.ok) throw new Error(`News ${res.status}`);
      const xml = await res.text();
      return parseItems(xml, t.take).map((i) => ({ ...i, topic: t.label }));
    } catch { return []; }
  }));
  return groups.flat().slice(0, 5);
}

/* ─────────────────────────  AI SYNTHESIZER  ───────────────────────── */
const SYSTEM_PROMPT = `You are JARVIS, the personal AI chief-of-staff for Mr. Sharma, a CEO focused on clean-energy technology (especially onshore wind generation and energy infrastructure) and algorithmic trading (Indian equities plus EURUSD, GBPUSD and Silver).

Write his morning briefing as a single, smooth, spoken monologue of roughly 60 seconds (about 150-180 words). Requirements:
- Open by addressing him as "Mr. Sharma" with a brief, refined greeting.
- Be highly analytical and confident, never a flat list. Connect the dots: what the market moves and headlines mean for his clean-tech and algo-trading focus.
- Weave in Udaipur weather briefly and naturally.
- Cover the key index/FX/commodity moves with direction and a one-line read.
- Surface the most decision-relevant headlines, emphasising macro, geopolitics, Indian legal/regulatory shifts, and clean-energy / wind / grid advances.
- Tone: composed, precise, faintly British butler-meets-strategist. No emojis, no markdown, no bullet points, no headings. Output ONLY the spoken text.`;

function formatData(data) {
  const lines = [];
  lines.push(`Date/time (IST): ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  const w = data.weather;
  lines.push(w?.ok
    ? `WEATHER (${w.location}): now ${w.current.temperature}C, ${w.current.conditions}, feels ${w.current.feelsLike}C, humidity ${w.current.humidity}%. Today high ${w.forecast.high}C / low ${w.forecast.low}C, ${w.forecast.conditions}, precip ${w.forecast.precipitationChance}%.`
    : "WEATHER: unavailable.");
  lines.push("MARKETS:");
  for (const m of data.markets) lines.push(m.ok ? `  - ${m.label}: ${m.price} (${m.change >= 0 ? "+" : ""}${m.change}, ${m.changePercent}%) ${m.direction}` : `  - ${m.label}: unavailable`);
  lines.push("HEADLINES:");
  if (data.news.length) for (const n of data.news) lines.push(`  - [${n.topic}] ${n.title} (${n.source})`);
  else lines.push("  - none available.");
  return lines.join("\n");
}

async function callGemini(key, model, content) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: content }] }],
      generationConfig: { maxOutputTokens: 700, temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
}

async function callOpenAICompatible(baseUrl, key, model, content, label) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 600, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim();
}

async function callAnthropic(key, model, content) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 600, system: SYSTEM_PROMPT, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.content?.[0]?.text?.trim();
}

function fallbackBriefing(data, keyPresent = false) {
  const w = data.weather, parts = ["Good morning, Mr. Sharma. JARVIS online."];
  if (w?.ok) parts.push(`In ${w.location.split(",")[0]} it is ${Math.round(w.current.temperature)} degrees and ${w.current.conditions.toLowerCase()}, heading to a high of ${Math.round(w.forecast.high)}.`);
  const ok = data.markets.filter((m) => m.ok);
  if (ok.length) parts.push(`On the markets, ${ok.map((m) => `${m.label} ${m.direction} ${Math.abs(m.changePercent)} percent`).join(", ")}.`);
  if (data.news.length) { parts.push("On the wires:"); parts.push(data.news.map((n) => n.title).join("; ") + "."); }
  parts.push(keyPresent
    ? "That is your snapshot. The AI synthesiser is configured but its request was rejected, most likely a rate limit or quota, so this is a direct data readout for now."
    : "That is your snapshot. No AI key is configured yet, so this is a direct data readout. Add a GEMINI_API_KEY or GROQ_API_KEY to unlock the full analytical briefing.");
  return parts.join(" ");
}

async function synthesize(data) {
  const content = `Here is this morning's raw data. Write Mr. Sharma's briefing.\n\n${formatData(data)}`;
  const valid = (v) => v && v.trim() && !v.includes("your_");
  const env = process.env;

  const providers = [];
  if (valid(env.GEMINI_API_KEY)) {
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";
    providers.push({ source: `gemini:${model}`, run: () => callGemini(env.GEMINI_API_KEY.trim(), model, content) });
  }
  if (valid(env.GROQ_API_KEY)) {
    const model = env.GROQ_MODEL || "llama-3.3-70b-versatile";
    providers.push({ source: `groq:${model}`, run: () => callOpenAICompatible("https://api.groq.com/openai/v1", env.GROQ_API_KEY.trim(), model, content, "Groq") });
  }
  if (valid(env.ANTHROPIC_API_KEY)) {
    const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    providers.push({ source: `anthropic:${model}`, run: () => callAnthropic(env.ANTHROPIC_API_KEY.trim(), model, content) });
  }
  if (valid(env.OPENAI_API_KEY)) {
    const model = env.OPENAI_MODEL || "gpt-4o-mini";
    providers.push({ source: `openai:${model}`, run: () => callOpenAICompatible("https://api.openai.com/v1", env.OPENAI_API_KEY.trim(), model, content, "OpenAI") });
  }

  // Try each configured provider in turn; fall through to the next on failure.
  const errors = [];
  for (const p of providers) {
    try {
      const t = await p.run();
      if (t) return { text: t, source: p.source };
    } catch (err) {
      errors.push(`${p.source} → ${err.message}`);
    }
  }

  return {
    text: fallbackBriefing(data, providers.length > 0),
    source: "fallback",
    warning: errors.length ? `All AI providers failed: ${errors.join(" | ")}` : null,
  };
}

/* ─────────────────────────  HANDLER  ───────────────────────── */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    const [weather, markets, news] = await Promise.all([getWeather(), getMarkets(), getNews()]);
    const data = { weather, markets, news };
    const { text, source, warning } = await synthesize(data);
    res.setHeader("cache-control", "no-store");
    res.status(200).json({
      ok: true, briefing: text,
      meta: { synthesizer: source, warning: warning || null, generatedAt: new Date().toISOString(), elapsedMs: Date.now() - started },
      data,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
