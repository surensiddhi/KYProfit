import { api, ApiError } from '../lib/api.js';
import { escapeHtml, formatMoney, todayIsoDate } from '../lib/format.js';

export function renderRecordPaymentForm(customers, { presetCustomerId, currency } = {}) {
  return `
    <form id="record-payment-form" class="form-screen">
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

      <div class="field-group">
        <label class="field-label" for="f-invoice">Apply to Invoice</label>
        <select class="field-input" id="f-invoice" name="invoice_id" disabled>
          <option value="">Select customer first</option>
        </select>
        <div class="field-hint">Leave as "Unapplied / advance" if this is a credit not yet tied to an invoice.</div>
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="f-amount">Amount *</label>
          <input class="field-input" id="f-amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0">
        </div>
        <div class="field-group">
          <label class="field-label" for="f-date">Payment Date *</label>
          <input class="field-input" id="f-date" name="payment_date" type="date" required value="${todayIsoDate()}">
        </div>
      </div>

      <div class="preview-card" id="balance-preview" style="display:none;">
        <span class="preview-label">Outstanding After This Payment</span>
        <span class="preview-value" id="balance-preview-value">—</span>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-notes">Notes</label>
        <textarea class="field-input" id="f-notes" name="notes" rows="2" placeholder="Optional"></textarea>
      </div>

      <button type="submit" class="login-btn" id="submit-btn">Record Payment</button>
    </form>
  `;
}

export function wireRecordPaymentForm(container, { onSuccess, currency }) {
  const form = container.querySelector('#record-payment-form');
  const errorBox = container.querySelector('#form-error');
  const submitBtn = container.querySelector('#submit-btn');
  const customerSelect = container.querySelector('#f-customer');
  const invoiceSelect = container.querySelector('#f-invoice');
  const amountInput = container.querySelector('#f-amount');
  const balancePreview = container.querySelector('#balance-preview');
  const balancePreviewValue = container.querySelector('#balance-preview-value');

  let openInvoices = []; // invoices with outstanding balance > 0, for the selected customer

  async function loadInvoicesForCustomer(customerId) {
    invoiceSelect.disabled = true;
    invoiceSelect.innerHTML = '<option value="">Loading…</option>';
    balancePreview.style.display = 'none';
    if (!customerId) {
      invoiceSelect.innerHTML = '<option value="">Select customer first</option>';
      return;
    }
    try {
      const { rollup } = await api.getCustomer(customerId);
      openInvoices = (rollup.invoice_metrics || []).filter((m) => m.outstanding_balance > 0);
      invoiceSelect.innerHTML = [
        '<option value="">Unapplied / advance</option>',
        ...openInvoices.map((m) => `<option value="${escapeHtml(m.invoice_id)}" data-balance="${m.outstanding_balance}">${escapeHtml(m.invoice_id.slice(0, 8))} — outstanding ${formatMoney(m.outstanding_balance, currency)}</option>`),
      ].join('');
      invoiceSelect.disabled = false;
    } catch {
      invoiceSelect.innerHTML = '<option value="">Could not load invoices — you can still record an unapplied payment</option>';
      invoiceSelect.disabled = false;
    }
  }

  function updateBalancePreview() {
    const selectedOption = invoiceSelect.selectedOptions[0];
    const balance = selectedOption ? parseFloat(selectedOption.dataset.balance) : null;
    if (balance === null || isNaN(balance)) {
      balancePreview.style.display = 'none';
      return;
    }
    const amount = parseFloat(amountInput.value) || 0;
    const remaining = balance - amount;
    balancePreviewValue.textContent = formatMoney(remaining, currency);
    balancePreviewValue.classList.toggle('negative', remaining < 0);
    balancePreview.style.display = 'flex';
  }

  customerSelect.addEventListener('change', () => loadInvoicesForCustomer(customerSelect.value));
  invoiceSelect.addEventListener('change', updateBalancePreview);
  amountInput.addEventListener('input', updateBalancePreview);

  if (customerSelect.value) loadInvoicesForCustomer(customerSelect.value);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const { payment } = await api.createPayment(data);
      onSuccess(payment);
    } catch (err) {
      const message = err instanceof ApiError
        ? [err.message, ...(err.details || [])].join(' — ')
        : 'Something went wrong. Please try again.';
      errorBox.textContent = escapeHtml(message);
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record Payment';
    }
  });
}
