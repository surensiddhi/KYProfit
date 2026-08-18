import './style.css';
import { renderDashboard } from './views/dashboard.js';
import { registerServiceWorker } from './lib/pwa.js';

const app = document.getElementById('app');

// M1: single static view. Router arrives in M5 alongside the other screens.
app.innerHTML = `
  <div class="offline-banner" id="offline-banner">You're offline — showing last synced data</div>
  ${renderDashboard()}
  <div class="update-banner" id="update-banner">
    <span>Update available</span>
    <button id="update-btn">Refresh</button>
  </div>
`;

// ── Offline detection ──
function updateOnlineStatus() {
  document.getElementById('offline-banner').classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── PWA install + update lifecycle ──
let applyUpdate = null;

registerServiceWorker({
  onUpdateAvailable: (updateSW) => {
    applyUpdate = updateSW;
    document.getElementById('update-banner').classList.add('show');
  },
});

document.getElementById('update-btn').addEventListener('click', () => {
  // Passing true tells the SW to skip waiting and reload with the new version.
  applyUpdate?.(true);
});
