// KYProfit Worker — serves the PWA static assets AND handles /api/* routes.
// One project, one deploy, per our M1 architecture decision.

import { handleLogin, handleLogout, handleMe } from './worker/auth.js';

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

  // More /api/* routes (customers, invoices, payments, settings) arrive in M4.

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
