import { api, ApiError } from '../lib/api.js';
import { escapeHtml, formatMoney, todayIsoDate } from '../lib/format.js';

export function renderAddInvoiceForm(customers, { presetCustomerId, currency } = {}) {
  return `
    <form id="add-invoice-form" class="form-screen">
      <div class="form-error" id="form-error" style="display:none;"></div>

      <div class="field-group">
        <label class="field-label" for="f-customer">Customer *</label>
        <select class="field-input" id="f-customer" name="customer_id" required>
          <option value="">Select a customer</option>
          ${customers.map((c) => `
            <option value="${escapeHtml(c.customer_id)}" ${c.customer_id === presetCustomerId ? 'selected' : ''}>${escapeHtml(c.name)}</option>
          `).join('')}
        </select>
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="f-revenue">Revenue *</label>
          <input class="field-input" id="f-revenue" name="revenue" type="number" step="0.01" min="0" required placeholder="0">
        </div>
        <div class="field-group">
          <label class="field-label" for="f-date">Invoice Date *</label>
          <input class="field-input" id="f-date" name="invoice_date" type="date" required value="${todayIsoDate()}">
        </div>
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="f-cogs">Cost of Goods (COGS)</label>
          <input class="field-input" id="f-cogs" name="cogs" type="number" step="0.01" min="0" placeholder="0">
        </div>
        <div class="field-group">
          <label class="field-label" for="f-cost-to-serve">Cost to Serve</label>
          <input class="field-input" id="f-cost-to-serve" name="cost_to_serve" type="number" step="0.01" min="0" placeholder="0">
        </div>
      </div>

      <div class="preview-card">
        <span class="preview-label">Gross Profit (live)</span>
        <span class="preview-value" id="gross-profit-preview">${formatMoney(0, currency)}</span>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-notes">Notes</label>
        <textarea class="field-input" id="f-notes" name="notes" rows="2" placeholder="Optional"></textarea>
      </div>

      <button type="submit" class="login-btn" id="submit-btn">Save Invoice</button>
    </form>
  `;
}

export function wireAddInvoiceForm(container, { onSuccess, currency }) {
  const form = container.querySelector('#add-invoice-form');
  const errorBox = container.querySelector('#form-error');
  const submitBtn = container.querySelector('#submit-btn');
  const preview = container.querySelector('#gross-profit-preview');
  const revenueInput = container.querySelector('#f-revenue');
  const cogsInput = container.querySelector('#f-cogs');

  function updatePreview() {
    const revenue = parseFloat(revenueInput.value) || 0;
    const cogs = parseFloat(cogsInput.value) || 0;
    const gross = revenue - cogs;
    preview.textContent = formatMoney(gross, currency);
    preview.classList.toggle('negative', gross < 0);
  }
  revenueInput.addEventListener('input', updatePreview);
  cogsInput.addEventListener('input', updatePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const { invoice } = await api.createInvoice(data);
      onSuccess(invoice);
    } catch (err) {
      const message = err instanceof ApiError
        ? [err.message, ...(err.details || [])].join(' — ')
        : 'Something went wrong. Please try again.';
      errorBox.textContent = escapeHtml(message);
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Invoice';
    }
  });
}
