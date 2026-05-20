// Vercel serverless function → served at /api/briefing
import { buildBriefing } from "../src/briefing.js";

export default async function handler(req, res) {
  try {
    res.setHeader("cache-control", "no-store");
    const payload = await buildBriefing();
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
