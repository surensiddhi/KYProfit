// Google Sheets adapter — the Phase 1 data store for KYProfit.
// Every tab's row 1 is a header row; we read/write by column name so the
// exact column order in the Sheet doesn't matter, only the header text.

import { getAccessToken } from './googleAuth.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const TABS = {
  customers: {
    name: 'Customers',
    columns: [
      'customer_id', 'name', 'contact_name', 'contact_email', 'contact_phone',
      'customer_type', 'payment_terms', 'account_owner', 'notes', 'created_at',
    ],
  },
  invoices: {
    name: 'Invoices',
    columns: [
      'invoice_id', 'invoice_number', 'customer_id', 'revenue', 'cogs', 'cost_to_serve',
      'invoice_date', 'notes', 'created_at',
    ],
  },
  payments: {
    name: 'Payments',
    columns: [
      'payment_id', 'receipt_number', 'invoice_id', 'customer_id', 'amount', 'payment_date',
      'notes', 'created_at',
    ],
  },
  settings: {
    name: 'Settings',
    columns: ['company_name', 'cost_of_capital_pct', 'currency', 'monthly_marketing_spend'],
  },
  users: {
    // Roster of who's allowed to log in + their role. Passwords are never
    // stored here — those stay in Cloudflare KV (see src/worker/auth.js).
    name: 'Users',
    columns: ['email', 'name', 'role', 'active'],
  },
};

// ── Low-level Sheets API calls ──────────────────────────────────────────

async function sheetsFetch(env, path, options = {}) {
  const token = await getAccessToken(env);
  const res = await fetch(`${SHEETS_API}/${env.GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function getValues(env, range) {
  const data = await sheetsFetch(env, `/values/${encodeURIComponent(range)}`);
  return data.values || [];
}

async function appendRow(env, tabName, row) {
  await sheetsFetch(
    env,
    `/values/${encodeURIComponent(tabName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) }
  );
}

async function updateRow(env, tabName, rowNumber, row) {
  // rowNumber is 1-indexed and includes the header row (row 1 = headers).
  const range = `${tabName}!A${rowNumber}`;
  await sheetsFetch(
    env,
    `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [row] }) }
  );
}

// ── Row <-> object helpers ──────────────────────────────────────────────

function rowsToObjects(rows, columns) {
  if (rows.length === 0) return [];
  const header = rows[0];
  // Map by the sheet's actual header text so column order in the sheet is
  // flexible, but fall back to the expected column list if headers are
  // missing/blank (e.g. a brand new tab someone half-filled in).
  const colIndex = {};
  columns.forEach((col, i) => {
    const foundAt = header.findIndex((h) => (h || '').trim().toLowerCase() === col.toLowerCase());
    colIndex[col] = foundAt >= 0 ? foundAt : i;
  });

  return rows.slice(1).map((row, i) => {
    const obj = { _row: i + 2 }; // sheet row number, for updates
    columns.forEach((col) => {
      obj[col] = row[colIndex[col]] ?? '';
    });
    return obj;
  });
}

function objectToRow(obj, columns) {
  return columns.map((col) => (obj[col] !== undefined && obj[col] !== null ? obj[col] : ''));
}

function nowIso() {
  return new Date().toISOString();
}

// ── Customers ────────────────────────────────────────────────────────────

export async function listCustomers(env) {
  const rows = await getValues(env, `${TABS.customers.name}!A:Z`);
  return rowsToObjects(rows, TABS.customers.columns).filter((c) => c.customer_id);
}

export async function getCustomerById(env, customerId) {
  const all = await listCustomers(env);
  return all.find((c) => c.customer_id === customerId) || null;
}

export async function createCustomer(env, data) {
  const customer = {
    customer_id: crypto.randomUUID(),
    name: data.name || '',
    contact_name: data.contact_name || '',
    contact_email: data.contact_email || '',
    contact_phone: data.contact_phone || '',
    customer_type: data.customer_type || '',
    payment_terms: data.payment_terms || '',
    account_owner: data.account_owner || '',
    notes: data.notes || '',
    created_at: nowIso(),
  };
  await appendRow(env, TABS.customers.name, objectToRow(customer, TABS.customers.columns));
  return customer;
}

// ── Invoices ─────────────────────────────────────────────────────────────

export async function listInvoices(env) {
  const rows = await getValues(env, `${TABS.invoices.name}!A:Z`);
  return rowsToObjects(rows, TABS.invoices.columns).filter((i) => i.invoice_id);
}

export async function createInvoice(env, data) {
  const invoice = {
    invoice_id: crypto.randomUUID(),
    invoice_number: data.invoice_number || '', // your own reference number, e.g. from other billing software
    customer_id: data.customer_id || '',
    revenue: data.revenue ?? '',
    cogs: data.cogs ?? '',
    cost_to_serve: data.cost_to_serve ?? '',
    invoice_date: data.invoice_date || '',
    notes: data.notes || '',
    created_at: nowIso(),
  };
  await appendRow(env, TABS.invoices.name, objectToRow(invoice, TABS.invoices.columns));
  return invoice;
}

export async function updateInvoice(env, invoiceId, patch) {
  const rows = await getValues(env, `${TABS.invoices.name}!A:Z`);
  const all = rowsToObjects(rows, TABS.invoices.columns);
  const existing = all.find((i) => i.invoice_id === invoiceId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await updateRow(env, TABS.invoices.name, existing._row, objectToRow(updated, TABS.invoices.columns));
  return updated;
}

// ── Payments ─────────────────────────────────────────────────────────────

export async function listPayments(env) {
  const rows = await getValues(env, `${TABS.payments.name}!A:Z`);
  return rowsToObjects(rows, TABS.payments.columns).filter((p) => p.payment_id);
}

export async function createPayment(env, data) {
  const payment = {
    payment_id: crypto.randomUUID(),
    receipt_number: data.receipt_number || '', // your own reference number
    invoice_id: data.invoice_id || '', // blank = unapplied advance/credit
    customer_id: data.customer_id || '',
    amount: data.amount ?? '',
    payment_date: data.payment_date || '',
    notes: data.notes || '',
    created_at: nowIso(),
  };
  await appendRow(env, TABS.payments.name, objectToRow(payment, TABS.payments.columns));
  return payment;
}

export async function updatePayment(env, paymentId, patch) {
  const rows = await getValues(env, `${TABS.payments.name}!A:Z`);
  const all = rowsToObjects(rows, TABS.payments.columns);
  const existing = all.find((p) => p.payment_id === paymentId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await updateRow(env, TABS.payments.name, existing._row, objectToRow(updated, TABS.payments.columns));
  return updated;
}

// ── Settings (single row) ───────────────────────────────────────────────

export async function getSettings(env) {
  const rows = await getValues(env, `${TABS.settings.name}!A:Z`);
  const [settings] = rowsToObjects(rows, TABS.settings.columns);
  return settings || {
    company_name: '',
    cost_of_capital_pct: 10,
    currency: 'NPR',
    monthly_marketing_spend: 0,
  };
}

export async function updateSettings(env, patch) {
  const current = await getSettings(env);
  const updated = { ...current, ...patch };
  const rowNumber = current._row || 2; // row 2 = first data row if none exists yet
  await updateRow(env, TABS.settings.name, rowNumber, objectToRow(updated, TABS.settings.columns));
  return updated;
}

// ── Users (roster + role; passwords live in KV, not here) ─────────────────

export async function getUserByEmail(env, email) {
  const rows = await getValues(env, `${TABS.users.name}!A:Z`);
  const all = rowsToObjects(rows, TABS.users.columns);
  const normalized = (email || '').trim().toLowerCase();
  return all.find((u) => (u.email || '').trim().toLowerCase() === normalized) || null;
}

export async function listUsers(env) {
  const rows = await getValues(env, `${TABS.users.name}!A:Z`);
  return rowsToObjects(rows, TABS.users.columns).filter((u) => u.email);
}
