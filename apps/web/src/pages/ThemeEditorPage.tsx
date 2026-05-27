import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';

// ── Default theme ──────────────────────────────────────────────────────────

const DEFAULT_THEME = {
  primary: '#4f46e5',
  accent: '#10b981',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

const PRESET_PALETTES = [
  { name: 'Indigo & Emerald', primary: '#4f46e5', accent: '#10b981' },
  { name: 'Blue & Amber',     primary: '#2563eb', accent: '#f59e0b' },
  { name: 'Rose & Violet',    primary: '#e11d48', accent: '#7c3aed' },
  { name: 'Teal & Orange',    primary: '#0d9488', accent: '#ea580c' },
  { name: 'Slate & Cyan',     primary: '#475569', accent: '#0891b2' },
  { name: 'Custom',           primary: '',        accent: '' },
];

const FONT_OPTIONS = ['Inter', 'Roboto', 'Georgia', 'Playfair Display', 'Merriweather'];

// ── Component ──────────────────────────────────────────────────────────────

export function ThemeEditorPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/theme' });
  const wsId = workspaceId as Id<'workspaces'>;

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const upsertTheme = useMutation(api.workspaces.upsertTheme);

  const [primary, setPrimary] = useState(DEFAULT_THEME.primary);
  const [accent, setAccent] = useState(DEFAULT_THEME.accent);
  const [headingFont, setHeadingFont] = useState(DEFAULT_THEME.headingFont);
  const [bodyFont, setBodyFont] = useState(DEFAULT_THEME.bodyFont);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hydrate from DB once loaded
  useEffect(() => {
    if (!workspace?.theme) return;
    setPrimary(workspace.theme.primary);
    setAccent(workspace.theme.accent);
    setHeadingFont(workspace.theme.headingFont);
    setBodyFont(workspace.theme.bodyFont);
  }, [workspace?.theme]);

  if (workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertTheme({ workspaceId: wsId, theme: { primary, accent, headingFont, bodyFont } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const currentPreset =
    PRESET_PALETTES.findIndex((p) => p.primary === primary && p.accent === accent);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link
            to="/w/$workspaceId"
            params={{ workspaceId }}
            className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft className="size-3.5" />
            {workspace?.name ?? 'Workspace'}
          </Link>
          <p className="text-sm font-semibold text-slate-800">Theme</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Workspace Theme</h1>
              <p className="text-sm text-slate-500">
                Controls colors and fonts across all modules in this workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : null}
              {saved ? 'Saved!' : 'Save theme'}
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl space-y-8 p-8">
          {/* Palette presets */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Color palette</h2>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    if (p.primary) {
                      setPrimary(p.primary);
                      setAccent(p.accent);
                    }
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                    i === currentPreset
                      ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.primary ? (
                    <>
                      <span
                        className="size-5 shrink-0 rounded-full"
                        style={{ background: p.primary }}
                      />
                      <span
                        className="size-5 shrink-0 rounded-full"
                        style={{ background: p.accent }}
                      />
                    </>
                  ) : (
                    <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-slate-300" />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* Custom colors */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Custom colors</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Primary</span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="color"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="flex-1 font-mono text-sm text-slate-700 outline-none"
                    maxLength={7}
                    spellCheck={false}
                  />
                </div>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Accent</span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="flex-1 font-mono text-sm text-slate-700 outline-none"
                    maxLength={7}
                    spellCheck={false}
                  />
                </div>
              </label>
            </div>
          </section>

          {/* Fonts */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Typography</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Heading font</span>
                <select
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Body font</span>
                <select
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Live preview */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Preview</h2>
            <div
              className="overflow-hidden rounded-xl border border-slate-200 bg-white p-8"
              style={
                {
                  '--prism-primary': primary,
                  '--prism-accent': accent,
                  '--prism-font-heading': headingFont,
                  '--prism-font-body': bodyFont,
                } as React.CSSProperties
              }
            >
              <h3
                className="mb-3 text-2xl font-bold"
                style={{ color: primary, fontFamily: headingFont }}
              >
                Heading text
              </h3>
              <p className="mb-4 text-slate-600 leading-relaxed" style={{ fontFamily: bodyFont }}>
                Body text uses the body font. This paragraph shows how your learning content
                will look with the selected typography and colors.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: primary }}
                >
                  Primary button
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: accent }}
                >
                  Accent button
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
