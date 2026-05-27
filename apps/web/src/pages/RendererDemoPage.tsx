/**
 * Phase 2 renderer demo — not shipped to production, dev/QA only.
 * Shows @prism/renderer rendering identical content under two themes.
 * Zero Convex calls — proves the purity boundary.
 */
import { Module, tokensToCss } from '@prism/renderer';
import type { Block, Theme } from '@prism/renderer';

// ---------------------------------------------------------------------------
// Mock data — no Convex
// ---------------------------------------------------------------------------

const SAMPLE_BLOCKS: Block[] = [
  {
    id: 'b1',
    type: 'rich-text',
    content: `
      <h1>Welcome to Prism Learning</h1>
      <p>This demo shows the renderer consuming identical content rendered under two different workspace themes.</p>
      <h2>What you can build</h2>
      <ul>
        <li>Multi-lesson modules with rich-text, images, video, and quizzes</li>
        <li>Collaborative real-time editing with presence awareness</li>
        <li>One-click SCORM 1.2 export that runs in any LMS</li>
      </ul>
      <p>The <strong>renderer package</strong> is pure — no Convex, no fetch, no auth. It receives blocks and a theme as props and produces pixel-identical HTML in both authoring preview and the SCORM export bundle.</p>
      <h2>Typography scale</h2>
      <p>Body text uses the workspace <em>body font</em>. Headings use the <em>heading font</em>. Both are injected as CSS custom properties so swapping themes requires zero re-render.</p>
    `,
  },
];

const THEME_INDIGO: Theme = {
  primary: '#6366f1',
  accent: '#a5b4fc',
  headingFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  bodyFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
};

const THEME_EMERALD: Theme = {
  primary: '#059669',
  accent: '#6ee7b7',
  headingFont: '"Playfair Display", Georgia, serif',
  bodyFont: 'Lato, ui-sans-serif, system-ui, sans-serif',
};

// ---------------------------------------------------------------------------
// Inline prose styles (scoped to prism-module to avoid polluting app CSS)
// ---------------------------------------------------------------------------

const PROSE_STYLES = `
.prism-module { font-family: var(--prism-font-body); color: #1e293b; padding: 24px 32px; }
.prism-module h1 { font-family: var(--prism-font-heading); font-size: 1.75rem; font-weight: 700; color: var(--prism-primary); margin: 0 0 1rem; line-height: 1.2; }
.prism-module h2 { font-family: var(--prism-font-heading); font-size: 1.25rem; font-weight: 600; color: var(--prism-primary); margin: 1.5rem 0 0.5rem; }
.prism-module p  { margin: 0 0 0.75rem; line-height: 1.65; }
.prism-module ul { margin: 0 0 0.75rem; padding-left: 1.5rem; }
.prism-module li { margin-bottom: 0.35rem; line-height: 1.6; }
.prism-module strong { font-weight: 600; color: var(--prism-primary); }
.prism-module em { font-style: italic; color: var(--prism-accent); filter: brightness(0.7); }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ThemeCard({ theme, label }: { theme: Theme; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Label bar */}
      <div
        style={{
          ...tokensToCss(theme),
          backgroundColor: 'var(--prism-primary)',
          color: '#fff',
          padding: '8px 16px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
          borderRadius: '8px 8px 0 0',
        }}
      >
        {label}
        <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 8 }}>
          {theme.primary} · {theme.headingFont.split(',')[0]}
        </span>
      </div>
      {/* Renderer output */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <Module
          blocks={SAMPLE_BLOCKS}
          theme={theme}
          resolveAsset={(id) => `/mock-asset/${id}`}
        />
      </div>
    </div>
  );
}

export function RendererDemoPage() {
  return (
    <>
      <style>{PROSE_STYLES}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          padding: '32px 24px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ maxWidth: 1200, margin: '0 auto 32px' }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 4px',
            }}
          >
            @prism/renderer — Phase 2 Demo
          </h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Identical content, two workspace themes. Zero Convex calls — purity boundary proven.
          </p>
        </div>

        {/* Two-up theme comparison */}
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <ThemeCard theme={THEME_INDIGO} label="Theme: Indigo / Inter" />
          <ThemeCard theme={THEME_EMERALD} label="Theme: Emerald / Playfair" />
        </div>

        {/* Token table */}
        <div
          style={{
            maxWidth: 1200,
            margin: '32px auto 0',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 600,
              color: '#475569',
              fontSize: 13,
              background: '#f8fafc',
            }}
          >
            CSS Custom Properties emitted by <code>tokensToCss(theme)</code>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Property', 'Indigo theme', 'Emerald theme'].map((h) => (
                  <th
                    key={h}
                    style={{ padding: '8px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['--prism-primary', THEME_INDIGO.primary, THEME_EMERALD.primary],
                  ['--prism-accent', THEME_INDIGO.accent, THEME_EMERALD.accent],
                  ['--prism-font-heading', THEME_INDIGO.headingFont.split(',')[0], THEME_EMERALD.headingFont.split(',')[0]],
                  ['--prism-font-body', THEME_INDIGO.bodyFont.split(',')[0], THEME_EMERALD.bodyFont.split(',')[0]],
                ] as [string, string, string][]
              ).map(([prop, a, b]) => (
                <tr key={prop} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 16px', fontFamily: 'monospace', color: '#7c3aed' }}>
                    {prop}
                  </td>
                  <td style={{ padding: '8px 16px', color: '#334155' }}>{a}</td>
                  <td style={{ padding: '8px 16px', color: '#334155' }}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
