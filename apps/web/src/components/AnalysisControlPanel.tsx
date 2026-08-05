import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  SlidersHorizontal,
  Save,
  Trash2,
  Loader2,
  Star,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

export type Dimension = 'region' | 'areaManager' | 'store';

export type AnalysisConfig = {
  programs: string[];
  fromDate?: number;
  toDate?: number;
  lookbackDays: number;
  benchmarkScore: number;
  thresholds: { critical: number; high: number; medium: number; low: number };
  minSubmissions: number;
  dimensions: Dimension[];
};

/** Mirrors DEFAULT_PROFILE in convex/analytics.ts — the pre-panel behaviour. */
export const DEFAULT_CONFIG: AnalysisConfig = {
  programs: [],
  lookbackDays: 90,
  benchmarkScore: 75,
  thresholds: { critical: 25, high: 15, medium: 8, low: 2 },
  minSubmissions: 2,
  dimensions: ['region', 'areaManager', 'store'],
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  region: 'Region',
  areaManager: 'Area Manager',
  store: 'Store',
};

const DATE_PRESETS = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1y', days: 365 },
];

function toDateInput(ms?: number) {
  if (ms == null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInput(s: string) {
  if (!s) return undefined;
  const t = new Date(`${s}T00:00:00`).getTime();
  return Number.isNaN(t) ? undefined : t;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{hint}</span>}
    </label>
  );
}

const numberInputCls =
  'w-full rounded-lg border border-[var(--border-primary)] bg-transparent px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none';

export function AnalysisControlPanel({
  workspaceId,
  availablePrograms,
  running,
  onRun,
}: {
  workspaceId: Id<'workspaces'>;
  /** Program names discovered from the current gap data */
  availablePrograms: string[];
  running: boolean;
  onRun: (profileId: Id<'analysisProfiles'> | undefined, config: AnalysisConfig) => void;
}) {
  const profiles = useQuery(api.analytics.listProfiles, { workspaceId });
  const saveProfile = useMutation(api.analytics.saveProfile);
  const deleteProfile = useMutation(api.analytics.deleteProfile);

  const [open, setOpen] = useState(true);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  const [activeProfileId, setActiveProfileId] = useState<Id<'analysisProfiles'> | undefined>();
  const [profileName, setProfileName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useDateRange, setUseDateRange] = useState(false);

  // Apply the workspace default profile once, on first load.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !profiles) return;
    const def = profiles.find((p) => p.isDefault) ?? null;
    if (def) applyProfile(def._id);
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, seeded]);

  function applyProfile(id: Id<'analysisProfiles'> | undefined) {
    setActiveProfileId(id);
    setError(null);
    if (!id) {
      setConfig(DEFAULT_CONFIG);
      setProfileName('');
      setMakeDefault(false);
      setUseDateRange(false);
      return;
    }
    const p = profiles?.find((x) => x._id === id);
    if (!p) return;
    setConfig({
      programs: p.programs,
      fromDate: p.fromDate,
      toDate: p.toDate,
      lookbackDays: p.lookbackDays,
      benchmarkScore: p.benchmarkScore,
      thresholds: p.thresholds,
      minSubmissions: p.minSubmissions,
      dimensions: p.dimensions,
    });
    setProfileName(p.name);
    setMakeDefault(Boolean(p.isDefault));
    setUseDateRange(p.fromDate != null);
  }

  function patch(partial: Partial<AnalysisConfig>) {
    setConfig((c) => ({ ...c, ...partial }));
  }

  function toggleProgram(name: string) {
    setConfig((c) => ({
      ...c,
      programs: c.programs.includes(name)
        ? c.programs.filter((p) => p !== name)
        : [...c.programs, name],
    }));
  }

  function toggleDimension(dim: Dimension) {
    setConfig((c) => ({
      ...c,
      dimensions: c.dimensions.includes(dim)
        ? c.dimensions.filter((d) => d !== dim)
        : [...c.dimensions, dim],
    }));
  }

  const validationError = useMemo(() => {
    const { critical, high, medium, low } = config.thresholds;
    if (!(critical > high && high > medium && medium > low))
      return 'Thresholds must decrease: critical > high > medium > low';
    if (low < 0) return 'Thresholds cannot be negative';
    if (config.dimensions.length === 0) return 'Select at least one dimension';
    if (useDateRange && config.fromDate != null && config.toDate != null && config.fromDate > config.toDate)
      return 'Start date must be before end date';
    return null;
  }, [config, useDateRange]);

  async function handleSave() {
    const name = profileName.trim();
    if (!name) {
      setError('Give the profile a name first');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await saveProfile({
        profileId: activeProfileId,
        workspaceId,
        name,
        programs: config.programs,
        fromDate: useDateRange ? config.fromDate : undefined,
        toDate: useDateRange ? config.toDate : undefined,
        lookbackDays: config.lookbackDays,
        benchmarkScore: config.benchmarkScore,
        thresholds: config.thresholds,
        minSubmissions: config.minSubmissions,
        dimensions: config.dimensions,
        isDefault: makeDefault,
      });
      setActiveProfileId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeProfileId) return;
    try {
      await deleteProfile({ profileId: activeProfileId });
      applyProfile(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete profile');
    }
  }

  const effectiveConfig: AnalysisConfig = {
    ...config,
    fromDate: useDateRange ? config.fromDate : undefined,
    toDate: useDateRange ? config.toDate : undefined,
  };

  return (
    <div className="glass mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <SlidersHorizontal className="size-4 shrink-0 text-[var(--ember-400)]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
          Analysis controls
        </span>

        <select
          value={activeProfileId ?? ''}
          onChange={(e) =>
            applyProfile((e.target.value || undefined) as Id<'analysisProfiles'> | undefined)
          }
          className="rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="">Unsaved config</option>
          {(profiles ?? []).map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
              {p.isDefault ? ' ★' : ''}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyProfile(undefined)}
            title="Reset to defaults"
            className="rounded-lg border border-[var(--border-primary)] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-[var(--border-primary)] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
          >
            {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <button
            type="button"
            disabled={running || Boolean(validationError)}
            onClick={() => onRun(activeProfileId, effectiveConfig)}
            className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            {running && <Loader2 className="size-3.5 animate-spin" />}
            Run analysis
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 px-5 py-4">
          {/* Programs */}
          <Field
            label="Programs"
            hint={
              config.programs.length === 0
                ? 'None selected — all programs will be analysed'
                : `${config.programs.length} selected`
            }
          >
            {availablePrograms.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No programs known yet — run an analysis once to discover them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availablePrograms.map((name) => {
                  const on = config.programs.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleProgram(name)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        on
                          ? 'bg-[rgba(140,67,208,0.15)] text-[var(--ember-400)]'
                          : 'border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {/* Time window */}
          <div>
            <div className="mb-1 flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Time window
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <input
                  type="checkbox"
                  checked={useDateRange}
                  onChange={(e) => setUseDateRange(e.target.checked)}
                />
                Use exact dates
              </label>
            </div>

            {useDateRange ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <input
                    type="date"
                    value={toDateInput(config.fromDate)}
                    onChange={(e) => patch({ fromDate: fromDateInput(e.target.value) })}
                    className={numberInputCls}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={toDateInput(config.toDate)}
                    onChange={(e) => patch({ toDate: fromDateInput(e.target.value) })}
                    className={numberInputCls}
                  />
                </Field>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => patch({ lookbackDays: p.days })}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                      config.lookbackDays === p.days
                        ? 'bg-[rgba(140,67,208,0.15)] text-[var(--ember-400)]'
                        : 'border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={config.lookbackDays}
                  onChange={(e) => patch({ lookbackDays: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-24 rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                />
                <span className="text-[11px] text-[var(--text-muted)]">days back</span>
              </div>
            )}
          </div>

          {/* Scoring */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Benchmark %" hint="Score below which a category is a gap">
              <input
                type="number"
                min={0}
                max={100}
                value={config.benchmarkScore}
                onChange={(e) => patch({ benchmarkScore: Number(e.target.value) })}
                className={numberInputCls}
              />
            </Field>
            <Field label="Min submissions" hint="Ignore aggregates thinner than this">
              <input
                type="number"
                min={1}
                value={config.minSubmissions}
                onChange={(e) => patch({ minSubmissions: Math.max(1, Number(e.target.value) || 1) })}
                className={numberInputCls}
              />
            </Field>
            <Field label="Dimensions" hint="What the gaps are grouped by">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((dim) => {
                  const on = config.dimensions.includes(dim);
                  return (
                    <button
                      key={dim}
                      type="button"
                      onClick={() => toggleDimension(dim)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        on
                          ? 'bg-[rgba(140,67,208,0.15)] text-[var(--ember-400)]'
                          : 'border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]'
                      }`}
                    >
                      {DIMENSION_LABELS[dim]}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Severity thresholds */}
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Severity thresholds (gap in percentage points)
            </span>
            <div className="grid gap-3 sm:grid-cols-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((key) => (
                <Field key={key} label={key === 'low' ? 'Low / cutoff' : key}>
                  <input
                    type="number"
                    min={0}
                    value={config.thresholds[key]}
                    onChange={(e) =>
                      patch({
                        thresholds: { ...config.thresholds, [key]: Number(e.target.value) },
                      })
                    }
                    className={numberInputCls}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Gaps smaller than the low value are discarded entirely.
            </p>
          </div>

          {/* Save profile */}
          <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <div className="min-w-[180px] flex-1">
              <Field label="Save as profile">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. North region — quarterly"
                  className={numberInputCls}
                />
              </Field>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-[11px] text-[var(--text-tertiary)]">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
              />
              <Star className="size-3" /> Default
            </label>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="mb-1 flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {activeProfileId ? 'Update' : 'Save'}
            </button>
            {activeProfileId && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="mb-1 rounded-lg border border-[var(--border-primary)] p-1.5 text-[var(--text-tertiary)] hover:text-[var(--semantic-danger)]"
                title="Delete profile"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {(error || validationError) && (
            <p className="text-xs text-[var(--semantic-danger)]">{error ?? validationError}</p>
          )}
        </div>
      )}
    </div>
  );
}
