import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      manifest: false,
      injectRegister: null,
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallbackDenylist: [/\.[a-zA-Z0-9]+$/],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});