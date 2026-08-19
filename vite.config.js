import { defineConfig } from 'vite';

// PWA (manifest + service worker) is handled by hand: manifest.json and
// serviceworker.js both live in /public and are linked/registered manually
// (see index.html and src/lib/pwa.js). No build plugin involved — keeps
// the caching behavior simple and easy to debug.
export default defineConfig({});
