// Wires up the Service Worker registration and the "Update available" banner.
// Uses vite-plugin-pwa's virtual module, which handles versioning/precaching for us.
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker({ onUpdateAvailable } = {}) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version has been fetched and is waiting to activate.
      onUpdateAvailable?.(updateSW);
    },
    onOfflineReady() {
      console.log('[KYProfit] App shell cached — ready to work offline.');
    },
    onRegisterError(error) {
      console.error('[KYProfit] Service Worker registration failed:', error);
    },
  });

  return updateSW;
}
