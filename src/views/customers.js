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
      <input class="search-input" id="customer-list-search" type="search" placeholder="Search customers…">
      <div class="customer-list" id="customer-list">
        ${customers.map((c) => `
          <div class="customer-list-row" data-customer-id="${escapeHtml(c.customer_id)}" data-customer-name="${escapeHtml(c.name.toLowerCase())}">
            <div class="customer-list-row-main" data-customer-open="${escapeHtml(c.customer_id)}">
              <div class="customer-list-row-name">${escapeHtml(c.name)}</div>
              <div class="customer-list-row-sub">${escapeHtml(c.customer_type || '')}${c.customer_type && c.account_owner ? ' · ' : ''}${escapeHtml(c.account_owner || '')}</div>
              <div class="customer-list-row-contacts">
                ${c.contact_phone ? `<a class="contact-link" href="tel:${escapeHtml(c.contact_phone)}">📞 ${escapeHtml(c.contact_phone)}</a>` : ''}
                ${c.contact_email ? `<a class="contact-link" href="mailto:${escapeHtml(c.contact_email)}">✉️ ${escapeHtml(c.contact_email)}</a>` : ''}
                ${!c.contact_phone && !c.contact_email ? `<span class="contact-link muted">No contact info on file</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

export function wireCustomersList(container, { onSelectCustomer, onAddCustomer }) {
  container.querySelectorAll('[data-customer-open]').forEach((el) => {
    el.addEventListener('click', () => onSelectCustomer(el.dataset.customerOpen));
  });
  // tel:/mailto: links inside the row should just do their own thing, not also open Customer Detail.
  container.querySelectorAll('.contact-link').forEach((el) => {
    el.addEventListener('click', (e) => e.stopPropagation());
  });
  container.querySelector('#add-customer-link')?.addEventListener('click', onAddCustomer);

  const searchInput = container.querySelector('#customer-list-search');
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    container.querySelectorAll('#customer-list [data-customer-name]').forEach((row) => {
      row.style.display = row.dataset.customerName.includes(query) ? '' : 'none';
    });
  });
}
