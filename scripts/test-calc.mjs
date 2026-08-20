// M6 — regression tests for the DSO / aging / carrying cost / profit
// formulas in src/worker/calc.js. Pure functions, no network/Sheets calls
// needed, so this runs instantly and can be re-run any time the formulas
// change to make sure nothing broke.
//
// Run with: node scripts/test-calc.mjs

import {
  invoiceMetrics, agingBucket, outstandingBalance, invoiceWeightedDso,
  customerRollup, customerDso,
} from '../src/worker/calc.js';

const settings = { cost_of_capital_pct: 10, currency: 'NPR', monthly_marketing_spend: 0 };
let passed = 0;
let failed = 0;

function approxEqual(a, b, epsilon = 0.01) {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < epsilon;
}

function check(label, actual, expected) {
  const ok = typeof expected === 'number' ? approxEqual(actual, expected) : actual === expected;
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✘ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function daysAgo(n, from = new Date('2026-08-20')) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date('2026-08-20');

// ── 1. Aging bucket boundaries ──────────────────────────────────────────
console.log('\n1. Aging bucket boundaries (unpaid invoice, age = today - invoice_date)');
{
  const cases = [
    [0, '0-30'], [30, '0-30'], [31, '31-45'],
    [45, '31-45'], [46, '46-90'],
    [90, '46-90'], [91, '91+'], [200, '91+'],
  ];
  for (const [age, expectedBucket] of cases) {
    const invoice = { invoice_id: 'x', customer_id: 'c1', revenue: 1000, invoice_date: daysAgo(age, TODAY) };
    check(`age ${age}d -> bucket ${expectedBucket}`, agingBucket(invoice, [], TODAY), expectedBucket);
  }
}

// ── 2. Fully paid invoice ───────────────────────────────────────────────
console.log('\n2. Fully paid invoice (paid 20 days after invoicing)');
{
  const invoice = { invoice_id: 'i1', customer_id: 'c1', revenue: 10000, cogs: 4000, cost_to_serve: 1000, invoice_date: '2026-07-01' };
  const payments = [{ invoice_id: 'i1', customer_id: 'c1', amount: 10000, payment_date: '2026-07-21' }];
  const m = invoiceMetrics(invoice, payments, settings, TODAY);
  check('outstanding balance = 0', m.outstanding_balance, 0);
  check('aging bucket = null (fully paid excluded)', m.aging_bucket, null);
  check('weighted DSO = 20 days', m.weighted_dso, 20);
  check('gross profit = revenue - cogs = 6000', m.gross_profit, 6000);
  const expectedCarrying = 10000 * (20 / 365) * 0.10;
  check('carrying cost matches formula', m.carrying_cost, expectedCarrying);
  const expectedNet = 6000 - 1000 - expectedCarrying;
  check('net profit matches formula', m.net_profit, expectedNet);
}

// ── 3. Partially paid invoice ───────────────────────────────────────────
console.log('\n3. Partially paid invoice (40% paid, remainder outstanding)');
{
  const invoice = { invoice_id: 'i2', customer_id: 'c1', revenue: 5000, cogs: 2000, cost_to_serve: 500, invoice_date: '2026-06-01' };
  const payments = [{ invoice_id: 'i2', customer_id: 'c1', amount: 2000, payment_date: '2026-06-15' }];
  const m = invoiceMetrics(invoice, payments, settings, TODAY);
  check('outstanding balance = 3000', m.outstanding_balance, 3000);
  check('weighted DSO only counts the collected 2000 (14 days)', m.weighted_dso, 14);
  check('aging bucket reflects full invoice age, not payment date', m.aging_bucket, agingBucket(invoice, payments, TODAY));
}

// ── 4. Unpaid invoice ────────────────────────────────────────────────────
console.log('\n4. Completely unpaid invoice');
{
  const invoice = { invoice_id: 'i3', customer_id: 'c1', revenue: 3000, cogs: 1000, cost_to_serve: 200, invoice_date: '2026-05-01' };
  const m = invoiceMetrics(invoice, [], settings, TODAY);
  const ageInDays = Math.round((TODAY - new Date(invoice.invoice_date)) / (1000 * 60 * 60 * 24));
  check('outstanding balance = full revenue', m.outstanding_balance, 3000);
  check('weighted DSO = null (nothing collected yet)', m.weighted_dso, null);
  check('carrying cost uses invoice age as DSO proxy', m.carrying_cost, 3000 * (ageInDays / 365) * 0.10);
}

// ── 5. Advance / unapplied payment ──────────────────────────────────────
console.log('\n5. Advance payment with no invoice_id (unapplied)');
{
  const invoice = { invoice_id: 'i4', customer_id: 'c1', revenue: 4000, cogs: 1500, cost_to_serve: 300, invoice_date: '2026-08-01' };
  const advance = { invoice_id: '', customer_id: 'c1', amount: 1000, payment_date: '2026-08-05' };
  check('advance does not reduce this invoice\'s outstanding balance', outstandingBalance(invoice, [advance]), 4000);
  check('advance does not contribute to this invoice\'s weighted DSO', invoiceWeightedDso(invoice, [advance]), null);
}

// ── 6. Customer-level revenue-weighted DSO roll-up ──────────────────────
console.log('\n6. Customer roll-up across multiple invoices');
{
  const customer = { customer_id: 'c1', name: 'Test Co', account_owner: 'Suren' };
  const invoices = [
    { invoice_id: 'a', customer_id: 'c1', revenue: 8000, cogs: 3000, cost_to_serve: 500, invoice_date: '2026-07-01' },
    { invoice_id: 'b', customer_id: 'c1', revenue: 2000, cogs: 800, cost_to_serve: 100, invoice_date: '2026-07-15' },
  ];
  const payments = [
    { invoice_id: 'a', customer_id: 'c1', amount: 8000, payment_date: '2026-07-11' }, // 10 days
    { invoice_id: 'b', customer_id: 'c1', amount: 2000, payment_date: '2026-08-04' }, // 20 days
  ];
  const rollup = customerRollup(customer, invoices, payments, settings, TODAY);
  // revenue-weighted: (8000*10 + 2000*20) / (8000+2000) = (80000+40000)/10000 = 12
  check('customer DSO is revenue-weighted across invoices', rollup.dso, 12);
  check('customer revenue sums both invoices', rollup.revenue, 10000);
  check('customer outstanding balance = 0 (both paid in full)', rollup.outstanding_balance, 0);
}

// ── 7. Zero-revenue edge case (shouldn't divide by zero / NaN) ──────────
console.log('\n7. Zero-revenue invoice does not produce NaN');
{
  const invoice = { invoice_id: 'z', customer_id: 'c1', revenue: 0, cogs: 0, cost_to_serve: 0, invoice_date: '2026-08-01' };
  const m = invoiceMetrics(invoice, [], settings, TODAY);
  check('net margin % is 0, not NaN, when revenue is 0', m.net_margin_pct, 0);
  check('outstanding balance is 0, not negative', m.outstanding_balance, 0);
}

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
