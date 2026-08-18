# Deploying KYProfit (M1) to Cloudflare Pages via GitHub

## 1. Push to GitHub

```bash
cd kyprofit
npm install
git init
git add .
git commit -m "M1: PWA foundation — shell, manifest, service worker"
```

Create a new empty repo on GitHub (e.g. `kyprofit`), then:

```bash
git remote add origin https://github.com/<your-username>/kyprofit.git
git branch -M main
git push -u origin main
```

## 2. Connect to Cloudflare Pages

1. Go to **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**
2. Select your `kyprofit` repo
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**

Cloudflare builds and deploys automatically. Every future `git push` to `main` redeploys — no manual steps.

## 3. Verify

- Open the `*.pages.dev` URL Cloudflare gives you, on your phone
- You should see the KYProfit Dashboard shell with the navy top bar and bottom nav
- Tap your browser's "Add to Home Screen" / install prompt — confirm the KYProfit icon appears
- Turn on airplane mode, reload — the app shell should still load (Service Worker cache)

## 4. Local development (optional, before pushing)

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

---

Once this is live, come back and we'll start **M2 — Auth** (Cloudflare Worker + login flow).
