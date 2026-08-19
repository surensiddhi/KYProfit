// Registers the hand-written service worker (public/serviceworker.js) and
// wires up the "Update available" banner. Deliberately plain — no build
// plugin magic — so it's easy to read and debug top to bottom.

export function registerServiceWorker({ onUpdateAvailable } = {}) {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceworker.js').then((reg) => {
      // A new SW was found and is installing.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // "installed" + an existing controller means this is an UPDATE,
          // not the first-ever install (which has no controller yet).
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdateAvailable?.(() => {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        });
      });
    }).catch((error) => {
      console.error('[KYProfit] Service Worker registration failed:', error);
    });

    // Once the new SW takes control, reload once to load the fresh assets.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
