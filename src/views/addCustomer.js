import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';

export function renderAddCustomerForm() {
  return `
    <form id="add-customer-form" class="form-screen">
      <div class="form-error" id="form-error" style="display:none;"></div>

      <div class="field-group">
        <label class="field-label" for="f-name">Customer Name *</label>
        <input class="field-input" id="f-name" name="name" required placeholder="e.g. Himalayan Traders">
      </div>

      <div class="field-group">
        <label class="field-label" for="f-contact-name">Contact Person</label>
        <input class="field-input" id="f-contact-name" name="contact_name" placeholder="Optional">
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="f-contact-email">Email</label>
          <input class="field-input" id="f-contact-email" name="contact_email" type="email" placeholder="Optional">
        </div>
        <div class="field-group">
          <label class="field-label" for="f-contact-phone">Phone</label>
          <input class="field-input" id="f-contact-phone" name="contact_phone" placeholder="For WhatsApp">
        </div>
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="f-type">Type</label>
          <select class="field-input" id="f-type" name="customer_type">
            <option value="">Select</option>
            <option>Retail</option>
            <option>Wholesale</option>
            <option>Services</option>
            <option>Other</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="f-terms">Payment Terms</label>
          <input class="field-input" id="f-terms" name="payment_terms" placeholder="e.g. Net 30">
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-owner">Account Owner</label>
        <input class="field-input" id="f-owner" name="account_owner" placeholder="Who follows up on payment?">
      </div>

      <div class="field-group">
        <label class="field-label" for="f-notes">Notes</label>
        <textarea class="field-input" id="f-notes" name="notes" rows="3" placeholder="Optional"></textarea>
      </div>

      <button type="submit" class="login-btn" id="submit-btn">Save Customer</button>
    </form>
  `;
}

export function wireAddCustomerForm(container, { onSuccess }) {
  const form = container.querySelector('#add-customer-form');
  const errorBox = container.querySelector('#form-error');
  const submitBtn = container.querySelector('#submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const { customer } = await api.createCustomer(data);
      onSuccess(customer);
    } catch (err) {
      const message = err instanceof ApiError
        ? [err.message, ...(err.details || [])].join(' — ')
        : 'Something went wrong. Please try again.';
      errorBox.textContent = escapeHtml(message);
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Customer';
    }
  });
}
