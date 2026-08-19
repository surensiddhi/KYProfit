# Deploying & configuring KYProfit

Current setup: a single Cloudflare Worker (`kyprofit`) serves both the PWA
static assets and the `/api/*` backend routes, connected to GitHub for
auto-deploy on every push to `main`.

## One-time setup already done

- GitHub repo `surensiddhi/KYProfit` connected to the Cloudflare Worker's
  Git integration (Settings → Build)
- Cloudflare's GitHub App was granted access to the `KYProfit` repo
  specifically (this was the root cause of earlier "nothing changed"
  deploys — fixed via github.com/settings/installations)
- `workers.dev` subdomain enabled (Domains tab)

## M2: Auth setup (do this once)

### 1. Update your local project

Pull in these new/changed files:

- `wrangler.json` (now includes `main`, `assets` binding, `kv_namespaces`)
- `src/worker.js` (new — main Worker entry point)
- `src/worker/auth.js` (new — login/logout/session logic)
- `src/views/login.js` (new — real Login screen)
- `src/views/dashboard.js` (updated — dynamic avatar, logout button)
- `src/main.js` (updated — route guard, session check)
- `src/style.css` (updated — login styles)
- `scripts/hash-password.js` (new — local password hashing tool)
- `.gitignore` (updated — ignores `.dev.vars`)
- `package.json` / `package-lock.json` (added `bcryptjs`, `jose`)

Then install the new dependencies:

```bash
cd kyprofit
npm install
```

### 2. Create the KV namespace (stores your hashed password)

```bash
npx wrangler kv namespace create AUTH_KV
```

This prints an `id`. Open `wrangler.json` and replace
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with that real id.

### 3. Set the JWT signing secret

This is a random secret used to sign login sessions — never commit it.

```bash
npx wrangler secret put JWT_SECRET
```

When prompted, paste any long random string (e.g. generate one with
`openssl rand -base64 32`, or just mash the keyboard for 40+ characters).

### 4. Choose your login email and password, hash it locally

Pick whatever email/password you want to log in with — this never gets
typed into a chat or committed to git, only used locally.

```bash
node scripts/hash-password.js "your-chosen-password"
```

Copy the printed hash.

### 5. Store your admin account in KV (remote, production)

```bash
npx wrangler kv key put --binding=AUTH_KV --remote "admin:your-email@example.com" "PASTE_THE_HASH_HERE"
```

Use the same email (lowercase) you'll type into the Login screen.

### 6. Commit and push

```bash
git add .
git commit -m "M2: add auth — login/logout, JWT sessions, KV-backed password"
git push
```

Cloudflare auto-deploys within a minute or two (Deployments tab → new
entry tagged `main`).

### 7. Verify

- Visit your site — you should now see the **Login screen**, not the
  dashboard directly
- Log in with the email/password from step 4/5
- You should land on the Dashboard, with your email's first letter shown
  as the avatar
- Tap the avatar → confirm → should sign you out, back to Login
- Refresh the page while logged in — should stay on Dashboard (session
  persists via cookie)

## Local development

```bash
npm install
npm run dev       # frontend dev server with hot reload (no backend)
npm run build     # production build → dist/

# To test the full backend (auth, KV, etc.) locally:
echo "JWT_SECRET=local-dev-secret" > .dev.vars
npx wrangler dev --local
# then seed a local test account:
node scripts/hash-password.js "test123"
npx wrangler kv key put --binding=AUTH_KV --local "admin:test@example.com" "PASTE_HASH"
```

`.dev.vars` is gitignored — never gets committed.

---

Once login works end-to-end, come back and we'll start **M3 — Google
Sheets adapter** (the actual data layer for customers/invoices/payments).
