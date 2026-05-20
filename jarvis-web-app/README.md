# JARVIS — Voice-Activated Morning Briefing PWA

A dark, Iron-Man-style installable web app that aggregates live weather,
markets, and news, has an AI write a 60-second analytical briefing for
Mr. Sharma, and reads it aloud in a deep English voice.

## Quick start

```bash
npm install      # install dependencies (already done)
npm run icons    # regenerate app icons (already done)
npm start        # launch the server
```

Then open **http://localhost:3000** and tap **INITIALIZE**.

## Add your AI key (optional but recommended)

The app works without a key (it reads a plain data summary). To unlock the
full analytical briefing, open the **`.env`** file and replace ONE placeholder:

```
ANTHROPIC_API_KEY=sk-ant-...      # from console.anthropic.com
# or
OPENAI_API_KEY=sk-...             # from platform.openai.com/api-keys
```

Save the file and restart with `npm start`.

## Put it on your iPhone

1. Run the server, then in another terminal expose it:
   `npx ngrok http 3000`  (or `npm i -g vercel && vercel`)
2. Open the public `https://…` link in **Safari** on your iPhone.
3. Tap **Share → Add to Home Screen**. JARVIS now opens fullscreen like a
   native app.

## Live data sources (all free, no key)

- **Weather:** Open-Meteo (Udaipur, Rajasthan)
- **Markets:** Yahoo Finance — Nifty 50, Sensex, EUR/USD, GBP/USD, Silver
- **News:** Google News RSS — macro, geopolitics, Indian legal, clean energy
