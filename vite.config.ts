import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * The site is served from https://fidian.github.io/attendance-tracker/, so
 * everything is addressed relative to that folder rather than the domain
 * root. A fork under another repository name changes this one line; the web
 * app manifest is written with relative paths and needs no edit.
 */
const BASE = '/attendance-tracker/';

/**
 * There is no service worker and nothing is precached, on purpose. An entry
 * that cannot reach the database is not recorded anywhere, so the app
 * refuses to take entries while it is offline rather than holding them. The
 * web app manifest in `site/public` is what makes it installable.
 */

// https://vitejs.dev/config/
export default defineConfig({
    base: BASE,
    build: {
        emptyOutDir: true,
        outDir: '../dist',
        rollupOptions: {
            input: {
                index: resolve(import.meta.dirname, 'site/index.html'),
                404: resolve(import.meta.dirname, 'site/404.html'),
            },
        },
        target: 'es2020',
        // Vite 8 minifies with Oxc; `esbuild` here is deprecated and now
        // wants esbuild installed separately. No property mangling: it is not
        // a requirement, and measured against this app it was not even a win
        // -- the gzipped bundle came out 1.5 kB smaller without it.
        minify: 'oxc',
    },
    clearScreen: false,
    root: 'site',
    server: {
        allowedHosts: true,
        host: true,
        port: 1976,
        strictPort: true,
    },
});
