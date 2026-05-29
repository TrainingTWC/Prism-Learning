import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { FontPicker } from '../components/FontPicker';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

// -- Types --

interface FullTheme {
  primary: string;
  accent: string;
  correct: string;
  incorrect: string;
  headingTextColor: string;
  bodyTextColor: string;
  headingFont: string;
  bodyFont: string;
  headingSize: string;
  headingWeight: string;
  bodySize: string;
  lineHeight: string;
  borderRadius: string;
  buttonStyle: string;
}

const DEFAULTS: FullTheme = {
  primary: '#4f46e5',
  accent: '#aa75dd',
  correct: '#16a34a',
  incorrect: '#dc2626',
  headingTextColor: '#1e293b',
  bodyTextColor: '#64748b',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  headingSize: 'lg',
  headingWeight: '700',
  bodySize: 'md',
  lineHeight: 'relaxed',
  borderRadius: 'md',
  buttonStyle: 'filled',
};

const PRESET_PALETTES = [
  { name: 'Indigo & Orchid', primary: '#4f46e5', accent: '#aa75dd' },
  { name: 'Blue & Amber',     primary: '#2563eb', accent: '#f59e0b' },
  { name: 'Rose & Violet',    primary: '#e11d48', accent: '#7c3aed' },
  { name: 'Teal & Orange',    primary: '#0d9488', accent: '#ea580c' },
  { name: 'Slate & Cyan',     primary: '#475569', accent: '#0891b2' },
  { name: 'Midnight & Gold',  primary: '#1e1b4b', accent: '#ca8a04' },
];

const headingSizeMap: Record<string, string> = { sm: '1.25rem', md: '1.5rem', lg: '1.875rem', xl: '2.25rem' };
const bodySizeMap: Record<string, string>    = { sm: '0.875rem', md: '1rem', lg: '1.125rem' };
const lineHeightMap: Record<string, string>  = { tight: '1.25', normal: '1.5', relaxed: '1.625', loose: '2' };
const radiusMap: Record<string, string>      = { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' };

function previewVars(t: FullTheme): React.CSSProperties {
  return {
    ['--prism-primary' as string]:        t.primary,
    ['--prism-accent' as string]:         t.accent,
    ['--prism-correct' as string]:        t.correct,
    ['--prism-incorrect' as string]:      t.incorrect,
    ['--prism-heading-color' as string]:  t.headingTextColor,
    ['--prism-body-color' as string]:     t.bodyTextColor,
    ['--prism-font-heading' as string]:   t.headingFont,
    ['--prism-font-body' as string]:      t.bodyFont,
    ['--prism-heading-size' as string]:   headingSizeMap[t.headingSize] ?? '1.875rem',
    ['--prism-heading-weight' as string]: t.headingWeight,
    ['--prism-body-size' as string]:      bodySizeMap[t.bodySize] ?? '1rem',
    ['--prism-line-height' as string]:    lineHeightMap[t.lineHeight] ?? '1.625',
    ['--prism-radius' as string]:         radiusMap[t.borderRadius] ?? '0.5rem',
  } as React.CSSProperties;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0 outline-none" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-sm text-slate-700 outline-none" maxLength={7} spellCheck={false} />
      </div>
    </label>
  );
}

function SegmentedControl<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {options.map((opt) => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={"flex-1 py-2 text-xs font-medium transition " + (value === opt.value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LivePreview({ t }: { t: FullTheme }) {
  const [tfAnswer, setTfAnswer] = useState<boolean | null>(null);
  const [mcqSel, setMcqSel] = useState<string | null>(null);
  const radius = radiusMap[t.borderRadius] ?? '0.5rem';
  const correctColor = t.correct;
  const incorrectColor = t.incorrect;

  const btnStyle = (color: string): React.CSSProperties => {
    if (t.buttonStyle === 'filled') return { background: color, color: '#fff', borderRadius: radius, padding: '8px 16px', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
    if (t.buttonStyle === 'outline') return { background: 'transparent', color, border: "2px solid " + color, borderRadius: radius, padding: '6px 14px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
    return { background: "color-mix(in srgb, " + color + " 12%, white)", color, borderRadius: radius, padding: '8px 16px', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
  };

  return (
    <div className="space-y-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-8" style={previewVars(t)}>
      <div className="space-y-2">
        <h1 style={{ fontFamily: t.headingFont, fontSize: headingSizeMap[t.headingSize] ?? '1.875rem', fontWeight: t.headingWeight, color: t.headingTextColor, lineHeight: lineHeightMap[t.lineHeight] ?? '1.25', margin: 0 }}>
          H1 — Module Title
        </h1>
        <h2 style={{ fontFamily: t.headingFont, fontSize: "calc(" + (headingSizeMap[t.headingSize] ?? '1.875rem') + " * 0.78)", fontWeight: t.headingWeight, color: t.headingTextColor, opacity: 0.85, margin: 0 }}>
          H2 — Section Heading
        </h2>
        <h3 style={{ fontFamily: t.headingFont, fontSize: "calc(" + (headingSizeMap[t.headingSize] ?? '1.875rem') + " * 0.62)", fontWeight: Math.max(400, Number(t.headingWeight) - 100).toString(), color: t.headingTextColor, opacity: 0.7, margin: 0 }}>
          H3 — Subheading
        </h3>
        <p style={{ fontFamily: t.bodyFont, fontSize: bodySizeMap[t.bodySize] ?? '1rem', color: t.bodyTextColor, lineHeight: lineHeightMap[t.lineHeight] ?? '1.625', margin: 0 }}>
          Body — Lorem ipsum dolor sit amet, consectetur adipiscing elit. This paragraph demonstrates body typography with the selected font and size settings.
        </p>
      </div>
      <div className="h-px bg-slate-100" />
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Buttons</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" style={btnStyle(t.primary)}>Primary action</button>
          <button type="button" style={btnStyle(t.accent)}>Accent action</button>
        </div>
      </div>
      <div className="h-px bg-slate-100" />
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">True / False feedback</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5" style={{ borderRadius: radius }}>
          <p className="mb-4 text-sm font-semibold" style={{ fontFamily: t.headingFont, color: t.headingTextColor }}>The sun is a star.</p>
          <div className="flex gap-3">
            {[true, false].map((val) => {
              const label = val ? 'True' : 'False';
              const isChosen = tfAnswer === val;
              const isRight = val === true;
              let s: React.CSSProperties = { flex: 1, borderRadius: radius, padding: '10px', fontSize: '0.875rem', fontWeight: 600, border: '2px solid', cursor: 'pointer' };
              if (tfAnswer === null) s = { ...s, borderColor: '#e2e8f0', background: '#fff', color: '#475569' };
              else if (isChosen) s = { ...s, borderColor: isRight ? correctColor : incorrectColor, background: "color-mix(in srgb, " + (isRight ? correctColor : incorrectColor) + " 10%, white)", color: "color-mix(in srgb, " + (isRight ? correctColor : incorrectColor) + " 70%, #0f172a)" };
              else s = { ...s, borderColor: '#e2e8f0', background: '#fff', color: '#94a3b8', opacity: 0.6 };
              return <button key={label} type="button" style={s} onClick={() => setTfAnswer(tfAnswer === null ? val : null)}>{label}</button>;
            })}
          </div>
          {tfAnswer !== null && (
            <p className="mt-3 text-sm font-medium" style={{ color: tfAnswer === true ? correctColor : incorrectColor }}>
              {tfAnswer === true ? '\u2713 Correct! The sun is indeed a star.' : '\u2717 Not quite \u2014 try again!'}
            </p>
          )}
        </div>
      </div>
      <div className="h-px bg-slate-100" />
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Multiple choice feedback</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5" style={{ borderRadius: radius }}>
          <p className="mb-3 text-sm font-semibold" style={{ fontFamily: t.headingFont, color: t.headingTextColor }}>Which planet is closest to the sun?</p>
          <div className="space-y-2">
            {[{ id: 'a', text: 'Mercury', correct: true }, { id: 'b', text: 'Venus', correct: false }].map((opt) => {
              const isChosen = mcqSel === opt.id;
              let s: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.625rem 0.75rem', borderRadius: radius, fontSize: '0.875rem', border: '2px solid', cursor: 'pointer' };
              if (mcqSel === null) s = { ...s, borderColor: '#e2e8f0', background: '#fff', color: '#374151' };
              else if (isChosen && opt.correct) s = { ...s, borderColor: correctColor, background: "color-mix(in srgb, " + correctColor + " 10%, white)", color: "color-mix(in srgb, " + correctColor + " 70%, #0f172a)" };
              else if (isChosen) s = { ...s, borderColor: incorrectColor, background: "color-mix(in srgb, " + incorrectColor + " 10%, white)", color: "color-mix(in srgb, " + incorrectColor + " 70%, #0f172a)" };
              else s = { ...s, borderColor: '#e2e8f0', background: '#fff', color: '#94a3b8', opacity: 0.6 };
              return (
                <button key={opt.id} type="button" style={s} onClick={() => setMcqSel(mcqSel === null ? opt.id : null)}>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold">
                    {isChosen && mcqSel !== null ? (opt.correct ? '\u2713' : '\u2717') : ''}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
          {mcqSel !== null && (
            <p className="mt-3 text-sm font-medium" style={{ color: mcqSel === 'a' ? correctColor : incorrectColor }}>
              {mcqSel === 'a' ? '\u2713 Correct! Mercury is the closest.' : '\u2717 Not quite \u2014 Venus is second.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThemeEditorPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/theme' });
  const wsId = workspaceId as Id<'workspaces'>;

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const upsertTheme = useMutation(api.workspaces.upsertTheme);

  const [theme, setTheme] = useState<FullTheme>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!workspace?.theme) return;
    const t = workspace.theme;
    setTheme({
      primary:          t.primary          ?? DEFAULTS.primary,
      accent:           t.accent           ?? DEFAULTS.accent,
      correct:          t.correct          ?? DEFAULTS.correct,
      incorrect:        t.incorrect        ?? DEFAULTS.incorrect,
      headingTextColor: t.headingTextColor ?? DEFAULTS.headingTextColor,
      bodyTextColor:    t.bodyTextColor    ?? DEFAULTS.bodyTextColor,
      headingFont:      t.headingFont      ?? DEFAULTS.headingFont,
      bodyFont:         t.bodyFont         ?? DEFAULTS.bodyFont,
      headingSize:      t.headingSize      ?? DEFAULTS.headingSize,
      headingWeight:    t.headingWeight    ?? DEFAULTS.headingWeight,
      bodySize:         t.bodySize         ?? DEFAULTS.bodySize,
      lineHeight:       t.lineHeight       ?? DEFAULTS.lineHeight,
      borderRadius:     t.borderRadius     ?? DEFAULTS.borderRadius,
      buttonStyle:      t.buttonStyle      ?? DEFAULTS.buttonStyle,
    });
  }, [workspace?.theme]);

  const set = <K extends keyof FullTheme>(key: K, value: FullTheme[K]) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  if (workspace === undefined) {
    return (
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertTheme({ workspaceId: wsId, theme });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = PRESET_PALETTES.findIndex(
    (p) => p.primary === theme.primary && p.accent === theme.accent,
  );

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? 'Workspace'}
      workspaceRole={workspace?.role}
      active="theme"
      overline="Visual system"
      title="Workspace Theme"
      subtitle="Colors, fonts, shape, and learner presentation controls for all modules in this workspace."
      actions={(
        <>
          <button type="button" onClick={() => setTheme(DEFAULTS)} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm font-bold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]">
            <RotateCcw className="size-3.5" />Reset
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? 'Saved!' : 'Save theme'}
          </button>
        </>
      )}
    >
        <div className="mx-auto w-full max-w-4xl space-y-10">

          <section id="color-palette">
            <SectionHeader title="Color palette" description="Quick-start with a curated scheme, or customize individual colors below." />
            <div className="grid grid-cols-3 gap-3">
              {PRESET_PALETTES.map((p, i) => (
                <button key={p.name} type="button" onClick={() => { set('primary', p.primary); set('accent', p.accent); }}
                  className={"flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition " + (i === currentPreset ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
                  <span className="size-4 shrink-0 rounded-full" style={{ background: p.primary }} />
                  <span className="size-4 shrink-0 rounded-full" style={{ background: p.accent }} />
                  <span className="truncate text-xs">{p.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section id="brand-colors">
            <SectionHeader title="Brand colors" description="Primary drives headings, links, and primary CTAs. Accent is used for highlights and secondary actions." />
            <div className="grid grid-cols-2 gap-4">
              <ColorSwatch label="Primary" value={theme.primary} onChange={(v) => set('primary', v)} />
              <ColorSwatch label="Accent" value={theme.accent} onChange={(v) => set('accent', v)} />
            </div>
          </section>

          <section id="feedback-colors">
            <SectionHeader title="Feedback colors" description="Applied to correct and incorrect answer states in MCQ and True/False interactions." />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: theme.correct }}>{'\u2713'}</span>
                  <span className="text-xs font-medium text-slate-600">Correct answer</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-indigo-400">
                  <input type="color" value={theme.correct} onChange={(e) => set('correct', e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0 outline-none" />
                  <input type="text" value={theme.correct} onChange={(e) => set('correct', e.target.value)} className="flex-1 font-mono text-sm text-slate-700 outline-none" maxLength={7} spellCheck={false} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: theme.incorrect }}>{'\u2717'}</span>
                  <span className="text-xs font-medium text-slate-600">Incorrect answer</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-indigo-400">
                  <input type="color" value={theme.incorrect} onChange={(e) => set('incorrect', e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0 outline-none" />
                  <input type="text" value={theme.incorrect} onChange={(e) => set('incorrect', e.target.value)} className="flex-1 font-mono text-sm text-slate-700 outline-none" maxLength={7} spellCheck={false} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {(['correct','incorrect'] as const).map((k) => {
                const color = k === 'correct' ? theme.correct : theme.incorrect;
                return (
                  <div key={k} className="flex flex-1 items-center gap-2 rounded-lg p-3 text-sm font-medium"
                    style={{ background: "color-mix(in srgb, " + color + " 10%, white)", border: "1.5px solid " + color, color: "color-mix(in srgb, " + color + " 70%, #0f172a)" }}>
                    <span style={{ color }}>{k === 'correct' ? '\u2713' : '\u2717'}</span>
                    {k === 'correct' ? 'Correct' : 'Incorrect'} option state
                  </div>
                );
              })}
            </div>
          </section>

          <section id="content-colors">
            <SectionHeader title="Content colors" description="Text colors used for headings and body copy inside lesson content." />
            <div className="grid grid-cols-2 gap-4">
              <ColorSwatch label="Heading text" value={theme.headingTextColor} onChange={(v) => set('headingTextColor', v)} />
              <ColorSwatch label="Body text" value={theme.bodyTextColor} onChange={(v) => set('bodyTextColor', v)} />
            </div>
          </section>

          <section id="typography">
            <SectionHeader title="Typography" description="Choose fonts for headings and body text. Click 'Load system fonts' to browse fonts installed on this computer." />
            <div className="grid grid-cols-2 gap-4">
              <FontPicker label="Heading font" value={theme.headingFont} onChange={(v) => set('headingFont', v)} />
              <FontPicker label="Body font" value={theme.bodyFont} onChange={(v) => set('bodyFont', v)} />
            </div>
          </section>

          <section id="type-scale">
            <SectionHeader title="Type scale" description="Controls relative size, weight, and spacing of text throughout modules." />
            <div className="grid grid-cols-2 gap-4">
              <SegmentedControl label="Heading size" value={theme.headingSize} onChange={(v) => set('headingSize', v)}
                options={[{ value: 'sm', label: 'S' },{ value: 'md', label: 'M' },{ value: 'lg', label: 'L' },{ value: 'xl', label: 'XL' }]} />
              <SegmentedControl label="Heading weight" value={theme.headingWeight} onChange={(v) => set('headingWeight', v)}
                options={[{ value: '400', label: 'Regular' },{ value: '600', label: 'Semi' },{ value: '700', label: 'Bold' },{ value: '800', label: 'Extra' }]} />
              <SegmentedControl label="Body size" value={theme.bodySize} onChange={(v) => set('bodySize', v)}
                options={[{ value: 'sm', label: 'Small' },{ value: 'md', label: 'Base' },{ value: 'lg', label: 'Large' }]} />
              <SegmentedControl label="Line height" value={theme.lineHeight} onChange={(v) => set('lineHeight', v)}
                options={[{ value: 'tight', label: 'Tight' },{ value: 'normal', label: 'Normal' },{ value: 'relaxed', label: 'Relaxed' },{ value: 'loose', label: 'Loose' }]} />
            </div>
          </section>

          <section id="shape-buttons">
            <SectionHeader title="Shape & buttons" description="Controls corner radius and the visual style of all interactive buttons across modules." />
            <div className="grid grid-cols-2 gap-4">
              <SegmentedControl label="Corner radius" value={theme.borderRadius} onChange={(v) => set('borderRadius', v)}
                options={[{ value: 'none', label: 'None' },{ value: 'sm', label: 'SM' },{ value: 'md', label: 'MD' },{ value: 'lg', label: 'LG' },{ value: 'xl', label: 'XL' },{ value: 'full', label: 'Pill' }]} />
              <SegmentedControl label="Button style" value={theme.buttonStyle} onChange={(v) => set('buttonStyle', v)}
                options={[{ value: 'filled', label: 'Filled' },{ value: 'outline', label: 'Outline' },{ value: 'soft', label: 'Soft' }]} />
            </div>
          </section>

          <section id="preview">
            <SectionHeader title="Preview" description="Live preview of your theme across typography hierarchy, buttons, and quiz interactions." />
            <LivePreview t={theme} />
          </section>

        </div>
    </PrismWorkspaceShell>
  );
}