import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { App } from './App';
import './styles.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

// Convex client is optional until the user runs `npx convex dev` and populates VITE_CONVEX_URL.
// We render the app either way so `pnpm dev` works out of the box.
const root = createRoot(document.getElementById('root')!);

if (convexUrl) {
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
