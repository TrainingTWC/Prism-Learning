import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Cloudflare Pages SPA fallback safety net.
 *
 * `public/_redirects` (`/* /index.html 200`) is the primary SPA-fallback
 * mechanism, but if the Pages project ever fails to apply it (stale deploy,
 * dashboard misconfiguration, etc.) any deep-linked route — including the
 * invite/magic-link email URLs (`/sign-in?code=...`, `/sign-in?inviteId=...`)
 * — returns a real edge 404 instead of the app shell. Cloudflare Pages also
 * natively serves a static `404.html` from the output root as a fallback,
 * independent of `_redirects` parsing. Mirroring the built `index.html` to
 * `404.html` after every build means deep links still work even if
 * `_redirects` isn't honored for some reason.
 */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(outDir, 'index.html');
      const notFoundPath = path.join(outDir, '404.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback404()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src'),
      '~convex': path.resolve(__dirname, '../../convex'),
    },
  },
  server: {
    port: 5173,
  },
});
