// Customers tab — a plain list of every customer with quick access to
// "Add Customer" and to each customer's detail screen.

import { escapeHtml } from '../lib/format.js';

export function renderCustomersList(customers) {
  return `
    <div class="section-hdr">
      <div class="section-title">All Customers (${customers.length})</div>
      <button class="link-btn" id="add-customer-link">+ Add</button>
    </div>

    ${customers.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="emoji">👥</div>
          <div class="title">No customers yet</div>
          <div class="sub">Tap "+ Add" above to create your first customer.</div>
        </div>
      </div>
    ` : `
      <div class="card customer-list">
        ${customers.map((c) => `
          <button class="customer-row" data-customer-id="${escapeHtml(c.customer_id)}">
            <div class="customer-row-main">
              <div class="customer-row-name">${escapeHtml(c.name)}</div>
              <div class="customer-row-sub">${escapeHtml(c.customer_type || '')}${c.customer_type && c.account_owner ? ' · ' : ''}${escapeHtml(c.account_owner || '')}</div>
            </div>
          </button>
        `).join('')}
      </div>
    `}
  `;
}

export function wireCustomersList(container, { onSelectCustomer, onAddCustomer }) {
  container.querySelectorAll('[data-customer-id]').forEach((el) => {
    el.addEventListener('click', () => onSelectCustomer(el.dataset.customerId));
  });
  container.querySelector('#add-customer-link')?.addEventListener('click', onAddCustomer);
}
