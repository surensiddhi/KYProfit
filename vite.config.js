import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      // We ship our own manifest.json in /public (already linked in index.html),
      // so let the plugin inject the SW registration but not regenerate the manifest.
      manifest: false,
      injectRegister: null, // we register manually in src/lib/pwa.js
      registerType: 'prompt', // don't force-reload; let the user confirm via our banner
      workbox: {
        // App shell + static assets: cache-first, always available offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // API calls get their own strategy — stale-while-revalidate — wired in M8
        // once real endpoints exist. Left out of globPatterns intentionally.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // we control activation via the update banner, not auto
      },
      devOptions: {
        enabled: true, // SW active in dev too, so we can test offline early
      },
    }),
  ],
});
