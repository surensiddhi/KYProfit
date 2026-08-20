// Pure calculation functions — profitability, DSO, aging, carrying cost.
// Formulas match Phase 1 Backlog section 3 exactly. No I/O in this file;
// everything here takes plain data in and returns plain numbers/objects out,
// so it's easy to unit test in M6 without touching the Sheets adapter.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toNumber(v, fallback = 0) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

// Payments applied to a specific invoice (excludes unlinked advances).
function paymentsForInvoice(payments, invoiceId) {
  return payments.filter((p) => p.invoice_id === invoiceId);
}

export function outstandingBalance(invoice, payments) {
  const revenue = toNumber(invoice.revenue);
  const applied = paymentsForInvoice(payments, invoice.invoice_id)
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
  return Math.max(0, revenue - applied);
}

// Weighted DSO for one invoice — only counts amounts actually collected.
// Returns null when nothing has been collected yet (undefined, not zero).
export function invoiceWeightedDso(invoice, payments) {
  const applied = paymentsForInvoice(payments, invoice.invoice_id);
  let weightedDaysSum = 0;
  let collectedSum = 0;
  for (const p of applied) {
    const amount = toNumber(p.amount);
    const days = daysBetween(invoice.invoice_date, p.payment_date);
    weightedDaysSum += amount * days;
    collectedSum += amount;
  }
  if (collectedSum <= 0) return null;
  return weightedDaysSum / collectedSum;
}

export function agingBucket(invoice, payments, today = new Date()) {
  const balance = outstandingBalance(invoice, payments);
  if (balance <= 0) return null; // fully paid invoices are excluded from aging
  const age = daysBetween(invoice.invoice_date, today);
  if (age <= 30) return '0-30';
  if (age <= 45) return '31-45';
  if (age <= 90) return '46-90';
  return '91+';
}

export function invoiceMetrics(invoice, payments, settings, today = new Date()) {
  const revenue = toNumber(invoice.revenue);
  const cogs = toNumber(invoice.cogs);
  const costToServe = toNumber(invoice.cost_to_serve);
  const costOfCapitalPct = toNumber(settings.cost_of_capital_pct, 10) / 100;

  const balance = outstandingBalance(invoice, payments);
  const weightedDso = invoiceWeightedDso(invoice, payments);
  // Money not yet collected is still tying up capital — use the invoice's
  // current age as the DSO proxy for the still-outstanding portion. This is
  // a provisional assumption pending the M6 cross-check against real
  // invoices; flagged here deliberately rather than hidden.
  const dsoForCarryingCost = weightedDso ?? daysBetween(invoice.invoice_date, today);

  const grossProfit = revenue - cogs;
  const carryingCost = revenue * (dsoForCarryingCost / 365) * costOfCapitalPct;
  const netProfit = grossProfit - costToServe - carryingCost;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    invoice_id: invoice.invoice_id,
    customer_id: invoice.customer_id,
    revenue,
    outstanding_balance: balance,
    weighted_dso: weightedDso,
    aging_bucket: agingBucket(invoice, payments, today),
    gross_profit: grossProfit,
    carrying_cost: carryingCost,
    net_profit: netProfit,
    net_margin_pct: netMarginPct,
  };
}

// Revenue-weighted average DSO across a customer's invoices — only invoices
// with at least one payment collected contribute (per the locked formula).
export function customerDso(invoiceMetricsList) {
  let weightedSum = 0;
  let revenueSum = 0;
  for (const m of invoiceMetricsList) {
    if (m.weighted_dso == null) continue;
    weightedSum += m.revenue * m.weighted_dso;
    revenueSum += m.revenue;
  }
  return revenueSum > 0 ? weightedSum / revenueSum : null;
}

export function customerRollup(customer, invoices, payments, settings, today = new Date()) {
  const customerInvoices = invoices.filter((i) => i.customer_id === customer.customer_id);
  const metrics = customerInvoices.map((inv) => invoiceMetrics(inv, payments, settings, today));

  const revenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const grossProfit = metrics.reduce((s, m) => s + m.gross_profit, 0);
  const netProfit = metrics.reduce((s, m) => s + m.net_profit, 0);
  const outstanding = metrics.reduce((s, m) => s + m.outstanding_balance, 0);
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const agingSummary = { '0-30': 0, '31-45': 0, '46-90': 0, '91+': 0 };
  for (const m of metrics) {
    if (m.aging_bucket) agingSummary[m.aging_bucket] += m.outstanding_balance;
  }

  return {
    customer_id: customer.customer_id,
    name: customer.name,
    account_owner: customer.account_owner,
    revenue,
    gross_profit: grossProfit,
    net_profit: netProfit,
    net_margin_pct: netMarginPct,
    outstanding_balance: outstanding,
    dso: customerDso(metrics),
    aging_summary: agingSummary,
    invoice_metrics: metrics,
  };
}

export function portfolioRollup(customers, invoices, payments, settings, today = new Date()) {
  const rollups = customers.map((c) => customerRollup(c, invoices, payments, settings, today));

  const revenue = rollups.reduce((s, r) => s + r.revenue, 0);
  const grossProfit = rollups.reduce((s, r) => s + r.gross_profit, 0);
  const netProfitBeforeMarketing = rollups.reduce((s, r) => s + r.net_profit, 0);
  const marketingSpend = toNumber(settings.monthly_marketing_spend);
  const netProfit = netProfitBeforeMarketing - marketingSpend;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const allInvoiceMetrics = rollups.flatMap((r) => r.invoice_metrics);
  const avgDso = customerDso(allInvoiceMetrics);

  const agingSummary = { '0-30': 0, '31-45': 0, '46-90': 0, '91+': 0 };
  for (const r of rollups) {
    for (const bucket of Object.keys(agingSummary)) {
      agingSummary[bucket] += r.aging_summary[bucket];
    }
  }

  return {
    revenue,
    gross_profit: grossProfit,
    net_profit: netProfit,
    net_margin_pct: netMarginPct,
    avg_dso: avgDso,
    aging_summary: agingSummary,
    customers: rollups.map(({ invoice_metrics, ...rest }) => rest), // trim per-invoice detail for the list view
  };
}
