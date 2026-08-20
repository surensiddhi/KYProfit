import './style.css';
import { renderLogin, wireLogin } from './views/login.js';
import { registerServiceWorker } from './lib/pwa.js';
import { mountApp } from './app.js';

const app = document.getElementById('app');

app.innerHTML = `
  <div class="offline-banner" id="offline-banner">You're offline — showing last synced data</div>
  <div id="view-root"></div>
  <div class="update-banner" id="update-banner">
    <span>Update available</span>
    <button id="update-btn">Refresh</button>
  </div>
`;

const viewRoot = document.getElementById('view-root');
let pendingUpdateApply = null;

function wireOfflineBanner() {
  function update() {
    document.getElementById('offline-banner')?.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

document.getElementById('update-btn')?.addEventListener('click', () => pendingUpdateApply?.());

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json(); // { email, role, name }
  } catch {
    return null; // network error / offline — treat as not logged in
  }
}

let teardownApp = null;

function showLogin() {
  teardownApp?.(); // stop the previous mount's popstate listener before wiping its DOM
  teardownApp = null;
  viewRoot.innerHTML = renderLogin();
  wireLogin({
    onSuccess: (session) => showApp(session),
  });
}

function showApp(session) {
  teardownApp = mountApp(viewRoot, {
    email: session?.email,
    onLogout: () => showLogin(),
  });
}

// ── Boot ──
wireOfflineBanner();
checkSession().then((session) => {
  if (session) showApp(session);
  else showLogin();
});

// ── PWA install + update lifecycle (independent of auth state) ──
registerServiceWorker({
  onUpdateAvailable: (apply) => {
    pendingUpdateApply = apply;
    document.getElementById('update-banner')?.classList.add('show');
  },
});
