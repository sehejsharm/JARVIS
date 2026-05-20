# JARVIS — Morning Briefing PWA (simple deploy build)

This version is built to deploy on Vercel with **no fuss**: one backend file,
zero dependencies. The only folder that matters is **`api/`** — keep it intact.

## Folder layout (must stay exactly like this)
```
index.html
app.js
manifest.json
service-worker.js
package.json
icons/        ← the 3 app-icon images
api/
  briefing.js ← the backend (MUST be inside the api folder)
```

## Step 1 — Get a FREE AI key (no credit card)
1. Go to **https://aistudio.google.com/apikey**
2. Sign in with Google → **Create API key**.
3. Copy the key (starts with `AIza...`).

## Step 2 — Put these files on GitHub (keeping folders!)
The earlier attempt failed because the folders were flattened. To keep them:
1. In your repo click **Add file → Upload files**.
2. From your computer, **drag the `api` folder and the `icons` folder**
   (the actual folders, not the files inside them) into the upload box,
   then drag the loose files (`index.html`, `app.js`, `manifest.json`,
   `service-worker.js`, `package.json`).
3. Before committing, check the file list shows **`api/briefing.js`**
   (with the slash). If it just says `briefing.js`, the folder was lost —
   remove it and drag the `api` folder again.
4. Commit.

## Step 3 — Deploy on Vercel
1. **vercel.com → Add New → Project → Import** your repo.
2. Application Preset: **Other**.  Root Directory: **`./`**.  (No other changes.)
3. Open **Settings → Environment Variables** and add:
   - Key: `GEMINI_API_KEY`   Value: *(your `AIza...` key)*
4. Click **Deploy** (or **Deployments → Redeploy** if it deployed already).

## Step 4 — Add to your iPhone
1. Open the `https://….vercel.app` link in **Safari**.
2. **Share → Add to Home Screen**. Tap the glowing core to hear your briefing.

---
Works even with no key (it speaks a plain data readout). Data sources are all
free: Open-Meteo (weather), Yahoo Finance (Nifty/Sensex/EURUSD/GBPUSD/Silver),
Google News RSS (macro, geopolitics, Indian legal, clean energy).
