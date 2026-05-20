// Vercel serverless function → served at /api/health
import { llmStatus } from "../src/briefing.js";

export default function handler(req, res) {
  res.status(200).json({ ok: true, service: "jarvis", llm: llmStatus() });
}
