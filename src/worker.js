// KYProfit Worker — serves the PWA static assets AND handles /api/* routes.
// One project, one deploy, per our M1 architecture decision.

import { handleLogin, handleLogout, handleMe, verifySession } from './worker/auth.js';
import { listCustomers, createCustomer, getSettings } from './worker/sheets.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx, url);
    }

    // Everything else: serve the built PWA from the static assets bundle.
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, ctx, url) {
  const { pathname } = url;

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    return handleLogout();
  }

  if (pathname === '/api/auth/me' && request.method === 'GET') {
    return handleMe(request, env);
  }

  // M3 smoke-test routes for the Sheets adapter — the full validated API
  // surface (invoices, payments, PATCH routes, dashboard rollups) arrives
  // in M4. These exist now so the Google Sheets connection can be verified
  // end-to-end before we build the real screens on top of it.

  if (pathname === '/api/customers' && request.method === 'GET') {
    const session = await verifySession(request, env);
    if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
    try {
      const customers = await listCustomers(env);
      return jsonResponse({ customers });
    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  if (pathname === '/api/customers' && request.method === 'POST') {
    const session = await verifySession(request, env);
    if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
    try {
      const body = await request.json();
      const customer = await createCustomer(env, body);
      return jsonResponse({ customer }, 201);
    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  if (pathname === '/api/settings' && request.method === 'GET') {
    const session = await verifySession(request, env);
    if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
    try {
      const settings = await getSettings(env);
      return jsonResponse({ settings });
    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
