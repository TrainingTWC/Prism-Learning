import { Module } from '@prism/renderer';
import type { Block, Theme } from '@prism/renderer';
import { Sparkles } from 'lucide-react';

const sampleTheme: Theme = {
  primary: '#6366f1',
  accent: '#ec4899',
  headingFont: 'ui-sans-serif, system-ui, sans-serif',
  bodyFont: 'ui-sans-serif, system-ui, sans-serif',
};

const sampleBlocks: Block[] = [
  {
    id: 'b1',
    type: 'rich-text',
    content: '<h1>Welcome to Prism Learning</h1><p>Scaffold is live. Renderer is wired up.</p>',
  },
];

export function App() {
  const convexConfigured = Boolean(import.meta.env.VITE_CONVEX_URL);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <Sparkles className="size-7 text-indigo-500" />
        <h1 className="text-2xl font-semibold tracking-tight">Prism Learning</h1>
      </header>

      <section className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium">Scaffold status</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
          <li>Vite + React 19 + TS — running</li>
          <li>Tailwind v4 — loaded</li>
          <li>
            <code className="rounded bg-slate-200 px-1">@prism/renderer</code> — imported below
          </li>
          <li>
            Convex client —{' '}
            <span className={convexConfigured ? 'text-emerald-600' : 'text-amber-600'}>
              {convexConfigured ? 'connected' : 'not configured (set VITE_CONVEX_URL)'}
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 text-sm font-medium text-slate-500">Renderer demo</h2>
        <Module blocks={sampleBlocks} theme={sampleTheme} resolveAsset={(id) => `/assets/${id}`} />
      </section>
    </div>
  );
}
