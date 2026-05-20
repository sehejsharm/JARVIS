// Markets via Yahoo Finance public quote endpoint (free, no API key required).
// Covers Indian indices (Nifty 50, Sensex), algo-traded FX pairs and Silver.

const SYMBOLS = [
  { symbol: "^NSEI", label: "Nifty 50", group: "index" },
  { symbol: "^BSESN", label: "Sensex", group: "index" },
  { symbol: "EURUSD=X", label: "EUR/USD", group: "fx" },
  { symbol: "GBPUSD=X", label: "GBP/USD", group: "fx" },
  { symbol: "SI=F", label: "Silver (XAG)", group: "commodity" },
];

// Yahoo occasionally rate-limits the v7 endpoint; v8 chart is a reliable fallback.
async function fetchChartQuote(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=2d`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0 (JARVIS Briefing)" },
  });
  if (!res.ok) throw new Error(`Yahoo chart responded ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No chart data");
  const meta = result.meta ?? {};
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  if (typeof price !== "number" || typeof prevClose !== "number") {
    throw new Error("Incomplete quote");
  }
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  return {
    price,
    previousClose: prevClose,
    change,
    changePercent,
    currency: meta.currency ?? "",
  };
}

export async function getMarkets() {
  const results = await Promise.all(
    SYMBOLS.map(async (s) => {
      try {
        const q = await fetchChartQuote(s.symbol);
        return {
          symbol: s.symbol,
          label: s.label,
          group: s.group,
          price: round(q.price, s.group === "fx" ? 4 : 2),
          change: round(q.change, s.group === "fx" ? 4 : 2),
          changePercent: round(q.changePercent, 2),
          currency: q.currency,
          direction: q.change >= 0 ? "up" : "down",
          ok: true,
        };
      } catch (err) {
        return { symbol: s.symbol, label: s.label, group: s.group, ok: false, error: err.message };
      }
    })
  );
  return results;
}

function round(n, decimals) {
  if (typeof n !== "number" || Number.isNaN(n)) return n;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
