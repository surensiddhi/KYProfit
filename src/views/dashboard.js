// M5 — real Dashboard: KPI cards, aging summary, customer profitability table.
// Data comes from GET /api/dashboard (see src/worker/api.js + calc.js).

import { formatMoney, formatPct, formatDays, escapeHtml } from '../lib/format.js';

export function renderDashboard(dashboard, currency) {
  const d = dashboard || {};
  const customers = d.customers || [];
  const aging = d.aging_summary || { '0-30': 0, '31-45': 0, '46-90': 0, '91+': 0 };

  return `
    <div class="kpi-row">
      <div class="kpi-card accent">
        <div class="kpi-label">Net Profit</div>
        <div class="kpi-value">${formatMoney(d.net_profit, currency)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Revenue</div>
        <div class="kpi-value">${formatMoney(d.revenue, currency)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Margin</div>
        <div class="kpi-value">${formatPct(d.net_margin_pct)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg DSO</div>
        <div class="kpi-value">${formatDays(d.avg_dso)}</div>
      </div>
    </div>

    <div class="section-hdr">
      <div class="section-title">Profit Breakdown</div>
    </div>
    <div class="card aging-card">
      <div class="aging-row"><span class="aging-bucket-label">Revenue</span><span class="aging-bucket-value">${formatMoney(d.revenue, currency)}</span></div>
      <div class="aging-row"><span class="aging-bucket-label">Gross Profit</span><span class="aging-bucket-value">${formatMoney(d.gross_profit, currency)}</span></div>
      <div class="aging-row"><span class="aging-bucket-label">Carrying Cost <span class="hint-icon" title="The cost of your money being tied up while invoices go unpaid across your whole portfolio.">ⓘ</span></span><span class="aging-bucket-value negative">− ${formatMoney(d.carrying_cost, currency)}</span></div>
      <div class="aging-row"><span class="aging-bucket-label">Marketing Spend</span><span class="aging-bucket-value negative">− ${formatMoney(d.marketing_spend, currency)}</span></div>
      <div class="aging-row"><span class="aging-bucket-label"><strong>Net Profit</strong></span><span class="aging-bucket-value">${formatMoney(d.net_profit, currency)}</span></div>
    </div>

    <div class="section-hdr">
      <div class="section-title">Aging Summary</div>
    </div>
    <div class="card aging-card">
      ${['0-30', '31-45', '46-90', '91+'].map((bucket) => `
        <div class="aging-row aging-${bucket.replace(/[^0-9a-z+]/gi, '')}">
          <span class="aging-bucket-label">${bucket} days</span>
          <span class="aging-bucket-value">${formatMoney(aging[bucket], currency)}</span>
        </div>
      `).join('')}
    </div>

    <div class="section-hdr">
      <div class="section-title">Customer Profitability</div>
    </div>

    ${customers.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="emoji">📊</div>
          <div class="title">No customers yet</div>
          <div class="sub">Tap the + button below to add your first customer.</div>
        </div>
      </div>
    ` : `
      <input class="search-input" id="customer-profitability-search" type="search" placeholder="Search customers…">
      <div class="customer-list" id="customer-profitability-list">
        ${customers.map((c) => `
          <button class="customer-row" data-customer-id="${escapeHtml(c.customer_id)}" data-customer-name="${escapeHtml(c.name.toLowerCase())}">
            <div class="customer-row-main">
              <div class="customer-row-name">${escapeHtml(c.name)}</div>
              <div class="customer-row-sub">${escapeHtml(c.account_owner || 'No owner assigned')}</div>
            </div>
            <div class="customer-row-metrics">
              <div class="customer-row-profit ${c.net_profit < 0 ? 'negative' : ''}">${formatMoney(c.net_profit, currency)}</div>
              <div class="customer-row-sub">${formatPct(c.net_margin_pct)} margin</div>
            </div>
          </button>
        `).join('')}
      </div>
    `}
  `;
}

export function wireDashboard(container, { onSelectCustomer }) {
  container.querySelectorAll('[data-customer-id]').forEach((el) => {
    el.addEventListener('click', () => onSelectCustomer(el.dataset.customerId));
  });

  const searchInput = container.querySelector('#customer-profitability-search');
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    container.querySelectorAll('#customer-profitability-list [data-customer-name]').forEach((row) => {
      row.style.display = row.dataset.customerName.includes(query) ? '' : 'none';
    });
  });
}
