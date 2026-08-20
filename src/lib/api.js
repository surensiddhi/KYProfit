// Small fetch wrapper — every call already goes through the session cookie,
// this just standardizes error handling and JSON parsing across views.

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. network-level failure) — fine, handled below
  }

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.details);
  }

  return body;
}

export const api = {
  getDashboard: () => apiFetch('/api/dashboard'),
  getCustomers: () => apiFetch('/api/customers'),
  getCustomer: (id) => apiFetch(`/api/customers/${encodeURIComponent(id)}`),
  createCustomer: (data) => apiFetch('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  createInvoice: (data) => apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => apiFetch(`/api/invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createPayment: (data) => apiFetch('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => apiFetch(`/api/payments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getSettings: () => apiFetch('/api/settings'),
  updateSettings: (data) => apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};
