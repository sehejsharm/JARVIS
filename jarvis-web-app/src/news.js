// Industry & macro news via Google News RSS (free, no API key required).
// Each topic is a curated search feed; we take the freshest few from each.

import Parser from "rss-parser";

const parser = new Parser({ timeout: 12000 });

const TOPICS = [
  {
    key: "macro",
    label: "Global Macroeconomics",
    query: "global macroeconomics OR central bank OR inflation OR Federal Reserve",
    take: 2,
  },
  {
    key: "geopolitics",
    label: "Geopolitics",
    query: "geopolitics OR international relations OR global trade tensions",
    take: 1,
  },
  {
    key: "india-legal",
    label: "Indian Legal Updates",
    query: "India legal OR Supreme Court India OR regulation OR SEBI OR RBI policy",
    take: 1,
  },
  {
    key: "clean-energy",
    label: "Clean Energy Technology",
    query: "onshore wind generator OR wind turbine technology OR energy infrastructure OR clean energy grid",
    take: 2,
  },
];

function feedUrl(query) {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

async function fetchTopic(topic) {
  try {
    const feed = await parser.parseURL(feedUrl(topic.query));
    const items = (feed.items ?? []).slice(0, topic.take).map((item) => ({
      title: cleanTitle(item.title),
      source: item.creator || extractSource(item.title) || "News",
      publishedAt: item.isoDate || item.pubDate || null,
      link: item.link || null,
      topic: topic.label,
    }));
    return items;
  } catch (err) {
    return [];
  }
}

// Google News titles are usually "Headline - Source"; split the source out.
function cleanTitle(title = "") {
  const idx = title.lastIndexOf(" - ");
  return idx > 0 ? title.slice(0, idx).trim() : title.trim();
}

function extractSource(title = "") {
  const idx = title.lastIndexOf(" - ");
  return idx > 0 ? title.slice(idx + 3).trim() : "";
}

export async function getNews() {
  const groups = await Promise.all(TOPICS.map(fetchTopic));
  const headlines = groups.flat();
  // Cap at 5 headlines to keep the briefing tight.
  return headlines.slice(0, 5);
}
