import './style.css';
import { renderDashboard } from './views/dashboard.js';
import { renderLogin, wireLogin } from './views/login.js';
import { registerServiceWorker } from './lib/pwa.js';

const app = document.getElementById('app');

// ── Route guard: check session before showing anything ──
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json(); // { email }
  } catch {
    return null; // network error / offline — treat as not logged in
  }
}

function renderApp(view, session) {
  if (view === 'dashboard') {
    app.innerHTML = `
      <div class="offline-banner" id="offline-banner">You're offline — showing last synced data</div>
      ${renderDashboard({ email: session?.email })}
      <div class="update-banner" id="update-banner">
        <span>Update available</span>
        <button id="update-btn">Refresh</button>
      </div>
    `;
    wireOfflineBanner();
    wireUpdateBanner();
    wireLogoutButton();
  } else {
    app.innerHTML = renderLogin();
    wireLogin({
      onSuccess: () => renderApp('dashboard'),
    });
  }
}

function wireOfflineBanner() {
  function updateOnlineStatus() {
    document.getElementById('offline-banner')?.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

let triggerUpdate = null;

function wireUpdateBanner() {
  document.getElementById('update-btn')?.addEventListener('click', () => {
    triggerUpdate?.();
  });
}

function wireLogoutButton() {
  document.getElementById('avatar-btn')?.addEventListener('click', async () => {
    if (!confirm('Sign out of KYProfit?')) return;
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    renderApp('login');
  });
}

// ── Boot ──
checkSession().then((session) => {
  renderApp(session ? 'dashboard' : 'login', session);
});

// ── PWA install + update lifecycle (independent of auth state) ──
registerServiceWorker({
  onUpdateAvailable: (apply) => {
    triggerUpdate = apply;
    document.getElementById('update-banner')?.classList.add('show');
  },
});
