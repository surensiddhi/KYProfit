import { formatMoney, formatPct, formatDays, formatDate, escapeHtml } from '../lib/format.js';

export function renderCustomerDetail({ customer, rollup, invoices, payments }, currency) {
  const aging = rollup.aging_summary || { '0-30': 0, '31-45': 0, '46-90': 0, '91+': 0 };

  // Combine invoices + payments into one chronological history feed.
  const history = [
    ...invoices.map((i) => ({ type: 'invoice', date: i.invoice_date, ...i })),
    ...payments.map((p) => ({ type: 'payment', date: p.payment_date, ...p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return `
    <div class="card customer-detail-header">
      <div class="customer-detail-name">${escapeHtml(customer.name)}</div>
      <div class="customer-detail-meta">
        ${customer.contact_name ? `${escapeHtml(customer.contact_name)} · ` : ''}
        ${customer.account_owner ? `Owner: ${escapeHtml(customer.account_owner)}` : 'No owner assigned'}
      </div>
      <button class="remind-btn" id="remind-btn">
        📨 Send Reminder
      </button>
    </div>

    <div class="kpi-row">
      <div class="kpi-card accent">
        <div class="kpi-label">Net Profit</div>
        <div class="kpi-value">${formatMoney(rollup.net_profit, currency)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Revenue</div>
        <div class="kpi-value">${formatMoney(rollup.revenue, currency)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-value">${formatMoney(rollup.outstanding_balance, currency)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">DSO</div>
        <div class="kpi-value">${formatDays(rollup.dso)}</div>
      </div>
    </div>

    <div class="section-hdr"><div class="section-title">Aging Breakdown</div></div>
    <div class="card aging-card">
      ${['0-30', '31-45', '46-90', '91+'].map((bucket) => `
        <div class="aging-row aging-${bucket.replace(/[^0-9a-z+]/gi, '')}">
          <span class="aging-bucket-label">${bucket} days</span>
          <span class="aging-bucket-value">${formatMoney(aging[bucket], currency)}</span>
        </div>
      `).join('')}
    </div>

    <div class="section-hdr"><div class="section-title">History</div></div>
    ${history.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="emoji">🧾</div>
          <div class="title">No invoices or payments yet</div>
        </div>
      </div>
    ` : `
      <div class="card history-list">
        ${history.map((h) => h.type === 'invoice' ? `
          <div class="history-row">
            <div class="history-icon invoice-icon">📄</div>
            <div class="history-main">
              <div class="history-title">Invoice${h.invoice_number ? ` #${escapeHtml(h.invoice_number)}` : ''} — ${formatMoney(h.revenue, currency)}</div>
              <div class="history-sub">${formatDate(h.invoice_date)}${h.notes ? ` · ${escapeHtml(h.notes)}` : ''}</div>
            </div>
          </div>
        ` : `
          <div class="history-row">
            <div class="history-icon payment-icon">💰</div>
            <div class="history-main">
              <div class="history-title">Payment${h.receipt_number ? ` #${escapeHtml(h.receipt_number)}` : ''} — ${formatMoney(h.amount, currency)}</div>
              <div class="history-sub">${formatDate(h.payment_date)}${h.invoice_id ? '' : ' · Unapplied / advance'}${h.notes ? ` · ${escapeHtml(h.notes)}` : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <div class="detail-actions">
      <button class="secondary-btn" id="add-invoice-btn">+ Add Invoice</button>
      <button class="secondary-btn" id="record-payment-btn">+ Record Payment</button>
    </div>
  `;
}

export function wireCustomerDetail(container, { onAddInvoice, onRecordPayment, onRemind }) {
  container.querySelector('#add-invoice-btn')?.addEventListener('click', onAddInvoice);
  container.querySelector('#record-payment-btn')?.addEventListener('click', onRecordPayment);
  const remindBtn = container.querySelector('#remind-btn');
  remindBtn?.addEventListener('click', async () => {
    remindBtn.disabled = true;
    remindBtn.textContent = 'Sending…';
    try {
      await onRemind();
    } finally {
      remindBtn.disabled = false;
      remindBtn.textContent = '📨 Send Reminder';
    }
  });
}
