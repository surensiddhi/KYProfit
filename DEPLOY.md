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

## M4: API layer

### 1. Update your local project

New/changed files:

- `src/worker/calc.js` (new — DSO, aging, carrying cost, profit calculations)
- `src/worker/validation.js` (new — input validation for POST/PATCH bodies)
- `src/worker/api.js` (new — the full route set below)
- `src/worker.js` (updated — wires in the M4 routes, replaces the M3 smoke-test routes)

No new secrets or Sheet changes needed — this milestone is pure application logic on top of the M3 adapter.

### 2. Commit and push

```bash
git add .
git commit -m "M4: full API layer — invoices, payments, dashboard, validation"
git push
```

### 3. Endpoints now live

All require being logged in (session cookie).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create a customer (validates `name`) |
| GET | `/api/customers/:id` | Customer detail + rollup metrics + invoice/payment history |
| POST | `/api/invoices` | Create an invoice (validates customer_id, revenue, invoice_date) |
| PATCH | `/api/invoices/:id` | Edit an invoice |
| POST | `/api/payments` | Record a payment — `invoice_id` optional (blank = advance/credit) |
| PATCH | `/api/payments/:id` | Edit a payment |
| GET | `/api/settings` | Fetch cost of capital %, currency, marketing spend |
| PATCH | `/api/settings` | Update settings |
| GET | `/api/dashboard` | Portfolio KPIs (revenue, gross/net profit, margin %, avg DSO) + aging summary + per-customer rollup |

### 4. Verify

With the browser console (F12 → Console) while logged in, try the full loop:

```js
// 1. Add a customer
const { customer } = await (await fetch('/api/customers', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ name: 'Verify Co', account_owner: 'You' })
})).json();
console.log(customer);

// 2. Add an invoice for that customer
const { invoice } = await (await fetch('/api/invoices', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ customer_id: customer.customer_id, revenue: 10000, cogs: 4000, cost_to_serve: 500, invoice_date: '2026-08-01' })
})).json();
console.log(invoice);

// 3. Record a partial payment
const { payment } = await (await fetch('/api/payments', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ customer_id: customer.customer_id, invoice_id: invoice.invoice_id, amount: 4000, payment_date: '2026-08-10' })
})).json();
console.log(payment);

// 4. Check the dashboard reflects it
console.log(await (await fetch('/api/dashboard')).json());
```

Check that the dashboard response shows the new customer with the right outstanding balance (10000 − 4000 = 6000) and a non-null aging bucket. If anything looks off numerically, flag it — M6 is specifically for stress-testing these formulas against real invoices, but catching an obvious miscalculation now saves rework later.

Once this checks out, remove the test customer/invoice/payment rows from your Sheet, and we'll move to **M5 — Frontend views** (the actual Add Customer, Add Invoice, Record Payment, Customer Detail, and Settings screens, replacing these console/curl tests with real UI).

---

## M5: Frontend views

### 1. Update your local project

New files:
- `src/app.js` (new — the post-login app shell: top bar, bottom nav, FAB action sheet, and view routing)
- `src/lib/api.js` (new — fetch wrapper used by every view)
- `src/lib/format.js` (new — currency/date/percent formatting helpers)
- `src/views/customers.js` (new — Customers tab)
- `src/views/customerDetail.js` (new — Customer Detail screen)
- `src/views/addCustomer.js` (new — Add Customer form)
- `src/views/addInvoice.js` (new — Add Invoice form, with a live Gross Profit preview)
- `src/views/recordPayment.js` (new — Record Payment form, with a live Outstanding Balance preview)
- `src/views/settings.js` (new — Settings form)

Overwrite these existing files:
- `src/main.js` (now boots either the Login screen or the app shell)
- `src/views/dashboard.js` (now renders real data from `/api/dashboard` instead of the M1 placeholder)
- `src/style.css` (adds styles for forms, the customer list, aging cards, the FAB action sheet, etc.)

No new dependencies, no new secrets — this milestone is pure frontend on top of the M4 API.

### 2. What's in the app now

- **Bottom nav**: Dashboard / **+** / Customers
- **+ button**: opens a bottom sheet with Add Customer / Add Invoice / Record Payment
- **Dashboard**: KPI cards, an aging summary, and a tappable customer profitability list — tap any customer to open their detail screen
- **Customer Detail**: KPI strip, aging breakdown, and a combined invoice+payment history feed, plus quick "+ Add Invoice" / "+ Record Payment" buttons scoped to that customer
- **Settings**: reachable via the ⚙ icon next to your avatar on Dashboard/Customers
- The "Send Reminder" button on Customer Detail is visible but disabled for now — that's M7, not built yet

### 3. Commit and push

```bash
git add .
git commit -m "M5: frontend views — Dashboard, Customers, Add Customer/Invoice, Record Payment, Settings"
git push
```

### 4. Verify — the full loop

This is the real end-to-end test, no console scripts needed:

1. Log in — you should land on the Dashboard, showing whatever's already in your Sheet
2. Tap **+** → **Add Customer** → fill in a name → Save — confirm it lands you back on the Customers tab and the new customer appears
3. Tap **+** → **Add Invoice** → pick that customer, enter a revenue amount, watch the Gross Profit preview update live as you type → Save
4. Tap **+** → **Record Payment** → pick the same customer → the invoice you just created should appear in the "Apply to Invoice" dropdown showing its outstanding balance → enter a partial amount, watch the "Outstanding After This Payment" preview update → Save
5. Go to the Dashboard — confirm the customer's numbers reflect the invoice and payment
6. Tap the customer row → Customer Detail → confirm the KPI strip, aging bucket, and history (invoice + payment) all look right
7. Tap the ⚙ icon → change Cost of Capital % → Save → confirm it shows "Settings saved" and the Dashboard's carrying-cost-driven numbers shift accordingly on your next visit

If anything renders blank, shows a raw error, or a button doesn't respond, tell me exactly what you tapped and what happened (or send a screenshot) — that's usually enough for me to spot it immediately.

Once this loop works end-to-end, we'll move to **M6 — Aging + DSO engine**, which is specifically about stress-testing the formulas you just watched work against a handful of real invoices, to make sure the numbers are trustworthy before you rely on them day to day.

---

## M6: Aging + DSO engine — verifying the math

### 1. Add the test script

New file: `scripts/test-calc.mjs` — a standalone regression test for the DSO, aging, carrying cost, and profit formulas in `src/worker/calc.js`. No Sheets connection or deployment needed to run it — it's pure math, checked against hand-calculated expected values.

Run it locally any time with:

```bash
node scripts/test-calc.mjs
```

It covers: aging bucket boundaries (exactly 30/31/45/46/90/91 days), a fully paid invoice, a partially paid invoice, a completely unpaid invoice, an advance/unapplied payment, a customer with multiple invoices (revenue-weighted DSO roll-up), and a zero-revenue edge case. All 27 checks pass as of this milestone.

Nothing to deploy for this step — it doesn't touch the live app, just gives you (and me, later) a fast way to catch a broken formula before it ships.

### 2. The step only you can do — hand-check real invoices

Pick 2-3 real invoices already in your app with different situations (one fully paid, one partial, one unpaid if you have one) and compare what the Customer Detail screen shows against what you'd calculate by hand:

- **Outstanding balance** = revenue minus whatever's been paid toward it
- **Aging bucket** = how many days old the invoice is (today minus invoice date), only for invoices with a balance still owed
- **Net profit** = revenue minus COGS minus cost to serve minus a small "carrying cost" (the cost of your money being tied up while unpaid — roughly revenue × days-outstanding/365 × your Cost of Capital %)

If any of these look off for your real data, tell me the invoice details and what you expected vs. what you saw — that's exactly the kind of check this milestone exists for.

Once you're comfortable the numbers are right, we'll move to **M7 — Reminders** (email + WhatsApp) or **M8 — Offline + auto-update**, whichever you'd rather do next.

---

## M7: Reminders (email + WhatsApp)

### 1. Update your local project

New file:
- `src/worker/reminders.js` (new — sends the reminder email via Resend, builds the WhatsApp click-to-chat link)

Overwrite these existing files:
- `src/worker/api.js` (adds `POST /api/customers/:id/remind`)
- `src/lib/api.js` (adds the `remindCustomer` call)
- `src/views/customerDetail.js` (the "Send Reminder" button is now live instead of disabled)
- `src/app.js` (wires the button to the new route, shows a toast, opens WhatsApp)

**One manual edit** — open your own `wrangler.json` and add this line inside the existing `"vars"` block (don't overwrite the whole file, just add this one line alongside `GOOGLE_SHEET_ID` and `GOOGLE_CLIENT_EMAIL`):

```json
"REMINDER_FROM_EMAIL": "KYProfit <onboarding@resend.dev>"
```

### 2. Sign up for Resend (the email sender)

1. Go to resend.com → sign up (free tier is generous — 3,000 emails/month)
2. Once in the dashboard, go to **API Keys** → Create API Key → copy it
3. You do **not** need to verify your own domain to get started — Resend's shared `onboarding@resend.dev` address works out of the box for testing (that's what `REMINDER_FROM_EMAIL` above uses). When you're ready to send from your own domain later (e.g. `reminders@yourbusiness.com`), verify that domain in Resend's dashboard and update `REMINDER_FROM_EMAIL` to match — no code changes needed.

### 3. Store the API key as a secret

```bash
npx wrangler secret put RESEND_API_KEY
```

Paste the key from step 2 when prompted.

### 4. Commit and push

```bash
git add .
git commit -m "M7: reminders — email via Resend, WhatsApp click-to-chat"
git push
```

### 5. Verify

1. Make sure a test customer in your Sheet has a real `contact_email` you can check, and a `contact_phone` with country code (e.g. `9779800000000` — the WhatsApp link needs the country code with no `+` or spaces to work reliably)
2. Open that customer's Customer Detail screen in the app, tap **📨 Send Reminder**
3. You should see a toast confirming the email sent (or explaining why not, e.g. missing contact info or a Resend config issue), and a WhatsApp tab should open with the message pre-filled — you still tap Send yourself, this doesn't auto-send WhatsApp messages
4. Check the inbox for that `contact_email` — confirm the email arrived with the right outstanding balance and aging breakdown

If a customer has no `contact_email` or no `contact_phone`, that part is simply skipped with a clear reason in the toast — it won't block the other channel.

Once this works, the only things still deferred to Phase 2 are Viber and the official (auto-send) WhatsApp Business API — both noted in the original backlog as out of scope for now.
