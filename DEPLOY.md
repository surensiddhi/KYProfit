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

## M3: Google Sheets adapter setup

### 1. Update your local project

Pull in these new/changed files:

- `src/worker/googleAuth.js` (new — exchanges service account credentials for a Sheets API access token)
- `src/worker/sheets.js` (new — CRUD adapter for Customers/Invoices/Payments/Settings/Users tabs)
- `src/worker/auth.js` (updated — checks the Users tab for role + active status once configured)
- `src/worker.js` (updated — adds smoke-test routes `/api/customers`, `/api/settings`)
- `wrangler.json` (updated — adds `GOOGLE_SHEET_ID` and `GOOGLE_CLIENT_EMAIL` vars)

### 2. Set up Google Cloud (one-time)

1. Create a Google Cloud project at console.cloud.google.com
2. Enable the **Google Sheets API** for that project
3. Create a **Service Account** (IAM & Admin → Service Accounts) — this is
   the robot identity the Worker uses, not your personal Google login
4. On that service account, go to Keys → Add Key → Create new key → JSON —
   download it and keep it private (don't commit it, don't paste it in chat)

### 3. Create the Sheet

1. Create a new Google Sheet, name it "KYProfit Data"
2. Add these 5 tabs (exact header row per tab — order of columns doesn't
   matter, but the header text must match):

   - **Customers**: `customer_id | name | contact_name | contact_email | contact_phone | customer_type | payment_terms | account_owner | notes | created_at`
   - **Invoices**: `invoice_id | customer_id | revenue | cogs | cost_to_serve | invoice_date | notes | created_at`
   - **Payments**: `payment_id | invoice_id | customer_id | amount | payment_date | notes | created_at`
   - **Settings**: `cost_of_capital_pct | currency | monthly_marketing_spend` — with **one data row** underneath, e.g. `10 | NPR | 0`
   - **Users**: `email | name | role | active` — add yourself as the first
     row, e.g. `you@example.com | Suren | admin | TRUE`

3. Click **Share**, paste the service account's `client_email` (from the
   downloaded JSON), give it **Editor** access, send (ignore the "no Google
   account" warning)

### 4. Wire the credentials into the Worker

Open `wrangler.json` and replace:
- `REPLACE_WITH_YOUR_SHEET_ID` with the Sheet's ID (the long string in its
  URL between `/d/` and `/edit`)
- `REPLACE_WITH_YOUR_SERVICE_ACCOUNT_EMAIL` with the `client_email` from the
  JSON file

Then store the private key as a secret (never commit it):

```bash
npx wrangler secret put GOOGLE_PRIVATE_KEY
```

Open the downloaded JSON, copy the entire `private_key` value (including
the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines) and
paste it in when prompted.

### 5. Commit and push

```bash
git add .
git commit -m "M3: Google Sheets adapter for Customers/Invoices/Payments/Settings/Users"
git push
```

### 6. Verify

Once deployed, log in to the app, then visit these URLs directly in your
browser (while logged in, same browser session):

- `/api/settings` → should return your Settings row as JSON
- `/api/customers` → should return `{"customers":[]}` (empty until you add
  one)

If either returns an error instead, send me the exact error text — it'll
usually point straight at what's misconfigured (wrong Sheet ID, service
account not shared on the Sheet, or a malformed private key).

---

Once the Sheets connection verifies, come back and we'll start **M4 — API
layer** (the full validated endpoint set: invoices, payments, dashboard
rollups) followed by **M5 — Frontend views** (the actual Add Customer, Add
Invoice, Record Payment, Customer Detail, and Settings screens).
