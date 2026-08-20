// M4 — the full validated API surface. Every route (except auth) requires
// a valid session. Handlers stay thin: validate → call the Sheets adapter →
// shape the response. Aggregation math lives in calc.js.

import { jsonResponse } from '../worker.js';
import { verifySession } from './auth.js';
import {
  listCustomers, createCustomer, getCustomerById,
  listInvoices, createInvoice, updateInvoice,
  listPayments, createPayment, updatePayment,
  getSettings, updateSettings,
} from './sheets.js';
import { validateCustomer, validateInvoice, validatePayment, validateSettings } from './validation.js';
import { portfolioRollup, customerRollup } from './calc.js';
import { sendReminderEmail, buildWhatsAppLink } from './reminders.js';

async function requireSession(request, env) {
  const session = await verifySession(request, env);
  if (!session) return null;
  return session;
}

function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return jsonResponse({ error: String(err?.message || err) }, 500);
    }
  };
}

// Returns a Response if it handled the route, or null if pathname/method
// didn't match anything here (so the caller can fall through to 404).
export async function handleApiRoutes(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  // ── Customers ──────────────────────────────────────────────────────────

  if (pathname === '/api/customers' && method === 'GET') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const customers = await listCustomers(env);
      return jsonResponse({ customers });
    })();
  }

  if (pathname === '/api/customers' && method === 'POST') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const errors = validateCustomer(body);
      if (errors.length) return jsonResponse({ error: 'Validation failed', details: errors }, 400);
      const customer = await createCustomer(env, body);
      return jsonResponse({ customer }, 201);
    })();
  }

  const customerDetailMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (customerDetailMatch && method === 'GET') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const customerId = customerDetailMatch[1];
      const customer = await getCustomerById(env, customerId);
      if (!customer) return jsonResponse({ error: 'Customer not found' }, 404);
      const [invoices, payments, settings] = await Promise.all([
        listInvoices(env), listPayments(env), getSettings(env),
      ]);
      const rollup = customerRollup(customer, invoices, payments, settings);
      const customerInvoices = invoices.filter((i) => i.customer_id === customerId);
      const customerPayments = payments.filter((p) => p.customer_id === customerId);
      return jsonResponse({ customer, rollup, invoices: customerInvoices, payments: customerPayments });
    })();
  }

  // ── Reminders ──────────────────────────────────────────────────────────

  const remindMatch = pathname.match(/^\/api\/customers\/([^/]+)\/remind$/);
  if (remindMatch && method === 'POST') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const customerId = remindMatch[1];
      const customer = await getCustomerById(env, customerId);
      if (!customer) return jsonResponse({ error: 'Customer not found' }, 404);

      const [invoices, payments, settings] = await Promise.all([
        listInvoices(env), listPayments(env), getSettings(env),
      ]);
      const rollup = customerRollup(customer, invoices, payments, settings);

      const [emailResult, whatsappLink] = await Promise.all([
        sendReminderEmail(env, { customer, rollup, settings }),
        Promise.resolve(buildWhatsAppLink({ customer, rollup, settings })),
      ]);

      return jsonResponse({ email: emailResult, whatsapp_link: whatsappLink });
    })();
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  if (pathname === '/api/invoices' && method === 'POST') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const errors = validateInvoice(body);
      if (errors.length) return jsonResponse({ error: 'Validation failed', details: errors }, 400);
      const customer = await getCustomerById(env, body.customer_id);
      if (!customer) return jsonResponse({ error: 'customer_id does not match any customer' }, 400);
      const invoice = await createInvoice(env, body);
      return jsonResponse({ invoice }, 201);
    })();
  }

  const invoiceDetailMatch = pathname.match(/^\/api\/invoices\/([^/]+)$/);
  if (invoiceDetailMatch && method === 'PATCH') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const updated = await updateInvoice(env, invoiceDetailMatch[1], body);
      if (!updated) return jsonResponse({ error: 'Invoice not found' }, 404);
      return jsonResponse({ invoice: updated });
    })();
  }

  // ── Payments ───────────────────────────────────────────────────────────

  if (pathname === '/api/payments' && method === 'POST') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const errors = validatePayment(body);
      if (errors.length) return jsonResponse({ error: 'Validation failed', details: errors }, 400);
      const customer = await getCustomerById(env, body.customer_id);
      if (!customer) return jsonResponse({ error: 'customer_id does not match any customer' }, 400);
      // invoice_id is optional (blank = unapplied advance/credit) but if given, must exist.
      if (body.invoice_id) {
        const invoices = await listInvoices(env);
        const invoiceExists = invoices.some((i) => i.invoice_id === body.invoice_id);
        if (!invoiceExists) return jsonResponse({ error: 'invoice_id does not match any invoice' }, 400);
      }
      const payment = await createPayment(env, body);
      return jsonResponse({ payment }, 201);
    })();
  }

  const paymentDetailMatch = pathname.match(/^\/api\/payments\/([^/]+)$/);
  if (paymentDetailMatch && method === 'PATCH') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const updated = await updatePayment(env, paymentDetailMatch[1], body);
      if (!updated) return jsonResponse({ error: 'Payment not found' }, 404);
      return jsonResponse({ payment: updated });
    })();
  }

  // ── Settings ───────────────────────────────────────────────────────────

  if (pathname === '/api/settings' && method === 'GET') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const settings = await getSettings(env);
      return jsonResponse({ settings });
    })();
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const body = await request.json().catch(() => ({}));
      const errors = validateSettings(body);
      if (errors.length) return jsonResponse({ error: 'Validation failed', details: errors }, 400);
      const settings = await updateSettings(env, body);
      return jsonResponse({ settings });
    })();
  }

  // ── Dashboard ──────────────────────────────────────────────────────────

  if (pathname === '/api/dashboard' && method === 'GET') {
    return withErrorHandling(async () => {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
      const [customers, invoices, payments, settings] = await Promise.all([
        listCustomers(env), listInvoices(env), listPayments(env), getSettings(env),
      ]);
      const dashboard = portfolioRollup(customers, invoices, payments, settings);
      return jsonResponse({ dashboard });
    })();
  }

  return null; // no match — caller falls through to its own 404
}
