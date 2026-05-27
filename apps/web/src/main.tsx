import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { App } from './App';
import './styles.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!convexUrl) {
  document.getElementById('root')!.innerHTML = `
    <div style="font-family:monospace;padding:32px;color:#c00">
      <b>VITE_CONVEX_URL is not set.</b><br><br>
      Run <code>pnpm dev:convex</code> to provision your Convex deployment,<br>
      then copy the URL into <code>.env.local</code> as <code>VITE_CONVEX_URL=...</code><br>
      and restart <code>pnpm dev</code>.
    </div>`;
} else {
  const convex = new ConvexReactClient(convexUrl);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConvexAuthProvider
        client={convex}
        // Keep TanStack Router's history in sync when the magic-link code is consumed
        replaceURL={(url) => window.history.replaceState(null, '', url)}
      >
        <App />
      </ConvexAuthProvider>
    </StrictMode>,
  );
}
