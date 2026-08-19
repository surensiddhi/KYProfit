// M2: real Login view, wired to POST /api/auth/login.

export function renderLogin() {
  return `
    <div class="login-hero">
      <div class="app-logo">KY</div>
      <div class="app-name">KYProfit</div>
      <div class="app-tagline">Know Your Profit</div>
    </div>

    <div class="login-body">
      <div class="login-heading">Welcome back</div>
      <div class="login-sub">Sign in to your account</div>

      <form id="login-form" novalidate>
        <div class="field-group">
          <div class="field-label">Email</div>
          <input class="field-input" type="email" id="login-email" name="email" autocomplete="username" required />
        </div>

        <div class="field-group">
          <div class="field-label">Password</div>
          <input class="field-input" type="password" id="login-password" name="password" autocomplete="current-password" required />
        </div>

        <p class="login-error" id="login-error" role="alert" hidden></p>

        <button type="submit" class="login-btn" id="login-submit">Sign In</button>
      </form>
    </div>
  `;
}

export function wireLogin({ onSuccess } = {}) {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Sign in failed. Please try again.';
        errorEl.hidden = false;
        return;
      }

      onSuccess?.(data);
    } catch (err) {
      errorEl.textContent = 'Network error — check your connection and try again.';
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}
