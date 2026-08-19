# Deploying KYProfit to Cloudflare Pages (classic)

This replaces the earlier "Workers with static assets" approach, which had
Git auto-deploy reliability issues. Classic Pages is simpler and matches
the proven setup already working for other projects (e.g. dcard.pages.dev).

## 1. Update your local project

Replace these files with the versions provided (they've already been
rewritten to remove `vite-plugin-pwa` in favor of a plain, hand-written
service worker):

- `vite.config.js`
- `src/lib/pwa.js`
- `src/main.js`
- `public/serviceworker.js` (new file)

Then reinstall dependencies (vite-plugin-pwa was removed):

```bash
cd kyprofit
npm install
```

## 2. Commit and push

```bash
git add .
git commit -m "Simplify PWA: hand-written service worker, remove vite-plugin-pwa"
git push
```

## 3. Create a classic Pages project (separate from the old Workers one)

1. Go to **dash.cloudflare.com → Workers & Pages**
2. Click **Create application**
3. Look for a **Pages** tab/option near the top of the creation screen
   (separate from "Workers" — if you only see Workers options, look for a
   toggle or a "Pages" link; take a screenshot if unsure and we'll adapt)
4. Choose **Connect to Git**, select your `KYProfit` repo
5. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
6. Click **Save and Deploy**

This is the traditional Pages Git integration — it reliably auto-deploys
on every push to `main`, no extra "Trigger events" configuration needed.

## 4. Verify

- Cloudflare gives you a `*.pages.dev` URL — open it on your phone
- Check `/manifest.json` loads as raw JSON (not the dashboard page)
- Check `/serviceworker.js` loads as raw JS
- Try "Add to Home Screen" — the KYProfit icon should now offer to install
- Turn on airplane mode, reload — the shell should still load

## 5. Clean up (once the new deployment is confirmed working)

- The old `kyprofit` Workers project can be deleted from
  Workers & Pages — it's no longer needed once Pages is live
- No need to touch GitHub or your local folder — same repo, same code,
  just deployed through a different (more reliable) Cloudflare product

## Local development (unchanged)

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

---

Once this is live and installable, come back and we'll start
**M2 — Auth** (Cloudflare Worker + login flow).
