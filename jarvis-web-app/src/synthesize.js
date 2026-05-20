// AI Synthesizer: formats raw aggregated data and asks an LLM to write a
// smooth, analytical ~60-second spoken morning briefing for Mr. Sharma.
// Supports Anthropic OR OpenAI. If neither key is present, a clean
// locally-composed fallback briefing is returned so the app always works.

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
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  lines.push(`Current date/time (IST): ${now}`);

  const w = data.weather;
  if (w?.ok) {
    lines.push(
      `WEATHER (${w.location}): now ${w.current.temperature}°C, ${w.current.conditions}, feels like ${w.current.feelsLike}°C, humidity ${w.current.humidity}%. Today high ${w.forecast.high}°C / low ${w.forecast.low}°C, ${w.forecast.conditions}, precip chance ${w.forecast.precipitationChance}%.`
    );
  } else {
    lines.push(`WEATHER: unavailable.`);
  }

  lines.push("MARKETS:");
  for (const m of data.markets) {
    if (m.ok) {
      const sign = m.change >= 0 ? "+" : "";
      lines.push(
        `  - ${m.label}: ${m.price} (${sign}${m.change}, ${sign}${m.changePercent}%) ${m.direction}`
      );
    } else {
      lines.push(`  - ${m.label}: data unavailable`);
    }
  }

  lines.push("HEADLINES:");
  if (data.news?.length) {
    for (const n of data.news) {
      lines.push(`  - [${n.topic}] ${n.title} (${n.source})`);
    }
  } else {
    lines.push("  - No headlines available.");
  }

  return lines.join("\n");
}

async function callAnthropic(apiKey, model, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.content?.[0]?.text?.trim();
}

// Works for any OpenAI-compatible chat API (OpenAI itself and Groq).
async function callOpenAICompatible(baseUrl, apiKey, model, userContent, label) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${label} ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim();
}

// Google Gemini — free tier, no credit card required.
async function callGemini(apiKey, model, userContent) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: 700, temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
}

// Composed locally when no LLM key is configured. Still a clean, speakable briefing.
function fallbackBriefing(data) {
  const w = data.weather;
  const parts = [];
  parts.push("Good morning, Mr. Sharma. JARVIS online.");

  if (w?.ok) {
    parts.push(
      `In Udaipur it is ${Math.round(w.current.temperature)} degrees and ${w.current.conditions.toLowerCase()}, heading to a high of ${Math.round(w.forecast.high)}.`
    );
  }

  const ok = data.markets.filter((m) => m.ok);
  if (ok.length) {
    const phr = ok.map((m) => {
      const dir = m.direction === "up" ? "up" : "down";
      return `${m.label} ${dir} ${Math.abs(m.changePercent)} percent`;
    });
    parts.push(`On the markets, ${phr.join(", ")}.`);
  }

  if (data.news?.length) {
    parts.push("On the wires:");
    parts.push(data.news.map((n) => n.title).join("; ") + ".");
  }

  parts.push(
    "That is your snapshot. Note: no AI key is configured yet, so this is a direct data readout rather than a full analytical synthesis. Add your API key to unlock the complete briefing."
  );
  return parts.join(" ");
}

export async function synthesize(data) {
  const userContent = `Here is this morning's raw data. Write Mr. Sharma's briefing.\n\n${formatData(data)}`;

  const valid = (v) => v && v.trim() && !v.includes("your_");
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    // Free providers are checked first so a no-cost key "just works".
    if (valid(geminiKey)) {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const text = await callGemini(geminiKey.trim(), model, userContent);
      if (text) return { text, source: `gemini:${model}` };
    }
    if (valid(groqKey)) {
      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const text = await callOpenAICompatible(
        "https://api.groq.com/openai/v1", groqKey.trim(), model, userContent, "Groq"
      );
      if (text) return { text, source: `groq:${model}` };
    }
    if (valid(anthropicKey)) {
      const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
      const text = await callAnthropic(anthropicKey.trim(), model, userContent);
      if (text) return { text, source: `anthropic:${model}` };
    }
    if (valid(openaiKey)) {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const text = await callOpenAICompatible(
        "https://api.openai.com/v1", openaiKey.trim(), model, userContent, "OpenAI"
      );
      if (text) return { text, source: `openai:${model}` };
    }
  } catch (err) {
    return {
      text: fallbackBriefing(data),
      source: "fallback",
      warning: `LLM call failed (${err.message}). Showing data readout instead.`,
    };
  }

  return { text: fallbackBriefing(data), source: "fallback" };
}
