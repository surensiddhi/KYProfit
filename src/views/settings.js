import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';

export function renderSettingsForm(settings) {
  return `
    <form id="settings-form" class="form-screen">
      <div class="form-error" id="form-error" style="display:none;"></div>
      <div class="form-success" id="form-success" style="display:none;">Settings saved.</div>

      <div class="field-group">
        <label class="field-label" for="f-company-name">Company Name *</label>
        <input class="field-input" id="f-company-name" name="company_name" required value="${escapeHtml(settings.company_name ?? '')}" placeholder="e.g. Mercantile">
        <div class="field-hint">Shown in reminder emails — the business your customers know you as.</div>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-cost-of-capital">Cost of Capital (%)</label>
        <input class="field-input" id="f-cost-of-capital" name="cost_of_capital_pct" type="number" step="0.1" min="0" value="${escapeHtml(settings.cost_of_capital_pct ?? 10)}">
        <div class="field-hint">Used to calculate the carrying cost of unpaid revenue.</div>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-currency">Currency</label>
        <select class="field-input" id="f-currency" name="currency">
          <option value="NPR" ${settings.currency === 'NPR' ? 'selected' : ''}>NPR (Rs)</option>
          <option value="INR" ${settings.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
          <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="f-marketing">Monthly Marketing Spend</label>
        <input class="field-input" id="f-marketing" name="monthly_marketing_spend" type="number" step="0.01" min="0" value="${escapeHtml(settings.monthly_marketing_spend ?? 0)}">
        <div class="field-hint">Deducted from portfolio net profit on the Dashboard.</div>
      </div>

      <button type="submit" class="login-btn" id="submit-btn">Save Settings</button>
    </form>
  `;
}

export function wireSettingsForm(container, { onSuccess }) {
  const form = container.querySelector('#settings-form');
  const errorBox = container.querySelector('#form-error');
  const successBox = container.querySelector('#form-success');
  const submitBtn = container.querySelector('#submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    successBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const { settings } = await api.updateSettings(data);
      successBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Settings';
      onSuccess(settings);
    } catch (err) {
      const message = err instanceof ApiError
        ? [err.message, ...(err.details || [])].join(' — ')
        : 'Something went wrong. Please try again.';
      errorBox.textContent = escapeHtml(message);
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Settings';
    }
  });
}
