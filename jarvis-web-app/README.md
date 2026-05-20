# JARVIS — Voice-Activated Morning Briefing PWA

A dark, Iron-Man-style installable web app that aggregates live weather,
markets, and news, has an AI write a 60-second analytical briefing for
Mr. Sharma, and reads it aloud in a deep English voice.

---

## 1. Get a FREE AI key (no credit card)

The app runs without a key (it reads a plain data summary), but the full
analytical spoken briefing needs an AI. Use the free **Google Gemini** key:

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with any Google account.
3. Click **Create API key** → **Create API key in new project**.
4. Copy the key (it starts with `AIza...`). Keep it handy for step 3 below.

(Alternative free option: **Groq** at https://console.groq.com/keys.)

---

## 2. Deploy to Vercel (free, always-on — no computer needed)

This makes JARVIS reachable from your phone 24/7.

**A. Push the code to GitHub** (this `jarvis-web-app` folder).

**B. Import it on Vercel:**
1. Go to **https://vercel.com** and sign in with GitHub (free Hobby plan).
2. Click **Add New… → Project**, then **Import** your repository.
3. **Important:** set **Root Directory** to `jarvis-web-app`.
4. Framework Preset: leave as **Other**. Click **Deploy**.

**C. Add your AI key as an Environment Variable (this replaces the `.env`):**
1. Open your project on Vercel → **Settings → Environment Variables**.
2. Add:  Name = `GEMINI_API_KEY`  ·  Value = *(your `AIza...` key)*
3. (Optional) Name = `GEMINI_MODEL`  ·  Value = `gemini-2.0-flash`
4. Click **Save**, then go to **Deployments → ⋯ → Redeploy** so the key
   takes effect.

> On Vercel you do **NOT** edit the `.env` file — the dashboard variable is
> the cloud equivalent. The `.env` file is only for running on your own
> computer.

**D. Open it on your iPhone:**
1. Vercel gives you a link like `https://jarvis-xxxx.vercel.app`.
2. Open that link in **Safari** on your iPhone.
3. Tap **Share → Add to Home Screen**. JARVIS now launches fullscreen like a
   native app. Tap the glowing core to hear your briefing.

---

## Run locally instead (optional)

```bash
npm install
npm start          # → http://localhost:3000
```
For local use, put your key in the `.env` file (`GEMINI_API_KEY=AIza...`).
To reach your phone without deploying: `npx ngrok http 3000` and open the
`https://…` link in Safari.

---

## Live data sources (all free, no key)

- **Weather:** Open-Meteo (Udaipur, Rajasthan)
- **Markets:** Yahoo Finance — Nifty 50, Sensex, EUR/USD, GBP/USD, Silver
- **News:** Google News RSS — macro, geopolitics, Indian legal, clean energy

## AI provider order

The first valid key found is used: **Gemini → Groq → Anthropic → OpenAI**.
With no key, JARVIS speaks a plain live-data readout.
