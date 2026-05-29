/**
 * IntelligenceDashboardPage — the home landing page after login.
 *
 * Auto-selects the first workspace that has a Prism Intelligence link.
 * Falls back to the first workspace if none are linked yet.
 * Renders the full training-gap dashboard: KPI strip, gap analysis, AI recs.
 *
 * "Build with AI" navigates directly to BuildWithAIPage (no modal).
 */

import { useQuery, useMutation, useAction } from 'convex/react';
import { useNavigate, Link } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

const DEFAULT_COMPANY_CODE = 'HBPL';

// ── Types ──────────────────────────────────────────────────────────────────

type GapDoc = {
  _id: Id<'trainingGaps'>;
  dimension: 'region' | 'areaManager';
  dimensionValue: string;
  category: string;
  programName: string;
  avgScore: number;
  benchmark: number;
  gap: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  submissionCount: number;
};

type RecDoc = {
  _id: Id<'courseRecommendations'>;
  title: string;
  rationale: string;
  targetAudience: string;
  keyTopics: string[];
  estimatedLessons: number;
  priority: number;
  status: 'pending' | 'building' | 'built' | 'dismissed';
  moduleId?: Id<'modules'>;
  audienceLevel?: 'national' | 'regional' | 'areaManager';
  gapDimension?: string | null;
  gapDimensionValue?: string | null;
};

type AnalyticsLink = {
  _id: Id<'analyticsLinks'>;
  companyCode?: string;
  piCompanyId: string;
  piCompanyName: string;
  benchmarkScore: number;
  lookbackDays: number;
  lastComputedAt?: number;
};

// ── Severity config ────────────────────────────────────────────────────────

const SEV = {
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
    ring: 'ring-red-500/20',
  },
  high: {
    label: 'High',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
    ring: 'ring-orange-500/20',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/20',
  },
  low: {
    label: 'Low',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/20',
  },
} as const;

// ── Shared helpers ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: keyof typeof SEV }) {
  const cfg = SEV[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function GapBar({ avg, benchmark }: { avg: number; benchmark: number }) {
  const pct = Math.min(100, Math.max(0, avg));
  const bPct = Math.min(100, Math.max(0, benchmark));
  const barColor =
    pct < benchmark - 25
      ? 'bg-red-400'
      : pct < benchmark - 15
        ? 'bg-orange-400'
        : pct < benchmark - 8
          ? 'bg-amber-400'
          : 'bg-emerald-400';
  return (
    <div className="relative h-1.5 w-full rounded-full bg-[var(--border-subtle)]">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-[var(--text-muted)] opacity-50"
        style={{ left: `${bPct}%` }}
        title={`Benchmark: ${benchmark}%`}
      />
    </div>
  );
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const valueColor = accent ?? 'text-[var(--text-primary)]';
  return (
    <div className="widget flex flex-col gap-2 p-5">
      <p className={`font-mono-value text-3xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--text-muted)]">
          {label}
        </p>
        {trend === 'up' && <TrendingUp className="size-3 text-emerald-400 opacity-70" />}
        {trend === 'down' && <TrendingDown className="size-3 text-red-400 opacity-70" />}
      </div>
      {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

// ── Setup wizard ───────────────────────────────────────────────────────────

function SetupWizard({
  workspaceId,
  onLinked,
}: {
  workspaceId: Id<'workspaces'>;
  onLinked: () => void;
}) {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_CODE);
  const [companyName, setCompanyName] = useState('');
  const [benchmark, setBenchmark] = useState(75);
  const [lookback, setLookback] = useState(90);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<{ programCount: number; storeCount: number } | null>(
    null,
  );
  const [linking, setLinking] = useState(false);
  const [err, setErr] = useState('');

  const validateCompany = useAction(api.analytics.validatePICompany);
  const linkCompany = useMutation(api.analytics.linkCompany);

  async function handleValidate() {
    if (!companyId.trim()) return;
    setValidating(true);
    setErr('');
    setValidated(null);
    try {
      const result = await validateCompany({ companyCode: companyId.trim() });
      setValidated(result);
    } catch (e: any) {
      setErr(e.data ?? e.message ?? 'Validation failed — check the company code and PI env vars');
    } finally {
      setValidating(false);
    }
  }

  async function handleConnect() {
    if (!companyId.trim() || !companyName.trim()) return;
    setLinking(true);
    setErr('');
    try {
      await linkCompany({
        workspaceId,
        companyCode: companyId.trim(),
        piCompanyName: companyName.trim(),
        benchmarkScore: benchmark,
        lookbackDays: lookback,
      });
      onLinked();
    } catch (e: any) {
      setErr(e.data ?? e.message ?? 'Failed to connect');
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-lg">
        <div className="prism-icon-tile mx-auto mb-6 size-14 rounded-2xl">
          <BarChart2 className="size-6" />
        </div>
        <h2 className="mb-2 text-center text-2xl font-bold text-[var(--text-primary)]">
          Connect Prism Intelligence
        </h2>
        <p className="mb-8 text-center text-sm text-[var(--text-muted)]">
          Link your Prism Intelligence company to surface audit gaps, identify training priorities,
          and generate targeted courses in one click.
        </p>

        <div className="widget space-y-5 p-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Company code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value.toUpperCase());
                  setValidated(null);
                }}
                placeholder={DEFAULT_COMPANY_CODE}
                className="prism-input flex-1"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={!companyId.trim() || validating}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {validating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {validating ? 'Checking…' : 'Validate'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Use your Prism Intelligence company code. For this workspace, that should be {DEFAULT_COMPANY_CODE}.
            </p>
            {validated && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[rgba(140,67,208,0.25)] bg-[rgba(140,67,208,0.08)] px-3 py-2">
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-xs text-[var(--text-primary)]">
                  Connected — {validated.programCount} programs, {validated.storeCount} stores
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Company display name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Retail Co."
              className="prism-input w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Gap benchmark score:{' '}
              <span className="text-[var(--ember-400)]">{benchmark}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={benchmark}
              onChange={(e) => setBenchmark(Number(e.target.value))}
              className="w-full accent-[var(--ember-400)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>50%</span>
              <span>Scores below this = gap</span>
              <span>95%</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Lookback window
            </label>
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className="prism-input w-full"
            >
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </div>

          {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>}

          <button
            type="button"
            onClick={handleConnect}
            disabled={!companyId.trim() || !companyName.trim() || !validated || linking}
            className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            {linking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BarChart2 className="size-4" />
            )}
            {linking ? 'Connecting…' : 'Connect Prism Intelligence'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────

function SettingsPanel({
  link,
  workspaceId,
  onClose,
}: {
  link: AnalyticsLink;
  workspaceId: Id<'workspaces'>;
  onClose: () => void;
}) {
  const [companyId, setCompanyId] = useState(link.companyCode ?? DEFAULT_COMPANY_CODE);
  const [companyName, setCompanyName] = useState(link.piCompanyName);
  const [benchmark, setBenchmark] = useState(link.benchmarkScore);
  const [lookback, setLookback] = useState(link.lookbackDays);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<{ programCount: number; storeCount: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const validateCompany = useAction(api.analytics.validatePICompany);
  const linkCompany = useMutation(api.analytics.linkCompany);

  const companyChanged = companyId.trim() !== (link.companyCode ?? DEFAULT_COMPANY_CODE);

  async function handleValidate() {
    if (!companyId.trim()) return;
    setValidating(true);
    setErr('');
    setValidated(null);
    try {
      const result = await validateCompany({
        companyCode: companyId.trim(),
        currentPiCompanyId: link.piCompanyId,
      });
      setValidated(result);
    } catch (e: any) {
      setErr(e.data ?? e.message ?? 'Validation failed — check the company code and PI env vars');
    } finally {
      setValidating(false);
    }
  }

  async function handleSave() {
    if (!companyId.trim() || !companyName.trim()) return;
    // If the company ID changed, require a successful validation first.
    if (companyChanged && !validated) {
      setErr('Validate the new company code before saving.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await linkCompany({
        workspaceId,
        companyCode: companyId.trim(),
        piCompanyName: companyName.trim(),
        benchmarkScore: benchmark,
        lookbackDays: lookback,
      });
      onClose();
    } catch (e: any) {
      setErr(e.data ?? e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Intelligence Settings</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{link.companyCode ?? DEFAULT_COMPANY_CODE} · {link.piCompanyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Company code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value.toUpperCase());
                  setValidated(null);
                }}
                placeholder="PI company document ID…"
                className="prism-input flex-1"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={!companyId.trim() || validating}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {validating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {validating ? 'Checking…' : 'Validate'}
              </button>
            </div>
            {validated && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[rgba(140,67,208,0.25)] bg-[rgba(140,67,208,0.08)] px-3 py-2">
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-xs text-[var(--text-primary)]">
                  Valid — {validated.programCount} programs, {validated.storeCount} stores
                </span>
              </div>
            )}
            {companyChanged && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertTriangle className="size-3" />
                Changing the company resets gap data — re-run a compute after saving.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Company display name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Retail Co."
              className="prism-input w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Benchmark:{' '}
              <span className="text-[var(--ember-400)]">{benchmark}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={benchmark}
              onChange={(e) => setBenchmark(Number(e.target.value))}
              className="w-full accent-[var(--ember-400)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Lookback window
            </label>
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className="prism-input w-full"
            >
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </div>
        </div>

        {err && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !companyId.trim() || !companyName.trim() || (companyChanged && !validated)}
            className="prism-action-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gap list ───────────────────────────────────────────────────────────────

function GapList({
  gaps,
  dimension,
}: {
  gaps: GapDoc[];
  dimension: 'region' | 'areaManager';
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const byProgram = useMemo(() => {
    const map = new Map<string, GapDoc[]>();
    for (const g of gaps.filter((g) => g.dimension === dimension)) {
      const list = map.get(g.programName) ?? [];
      list.push(g);
      map.set(g.programName, list);
    }
    return Array.from(map.entries()).sort(
      ([, a], [, b]) => Math.max(...b.map((x) => x.gap)) - Math.max(...a.map((x) => x.gap)),
    );
  }, [gaps, dimension]);

  if (byProgram.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="prism-icon-tile size-10 rounded-xl">
          <BarChart2 className="size-4" />
        </div>
        <p className="text-sm text-[var(--text-muted)]">No gaps for this dimension — all above benchmark.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {byProgram.map(([programName, programGaps]) => {
        const isOpen = !collapsed.has(programName);
        const topSev = programGaps[0]?.severity ?? 'low';
        return (
          <div key={programName} className="widget overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[var(--hover-bg)]"
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(programName)) next.delete(programName);
                  else next.add(programName);
                  return next;
                })
              }
            >
              <span className={`size-2 shrink-0 rounded-full ${SEV[topSev].dot}`} />
              <span className="flex-1 text-sm font-semibold text-[var(--text-primary)]">
                {programName}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{programGaps.length} gaps</span>
              {isOpen ? (
                <ChevronUp className="size-3.5 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="size-3.5 text-[var(--text-muted)]" />
              )}
            </button>

            {isOpen && (
              <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {programGaps.map((gap) => (
                  <div key={gap._id} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={gap.severity} />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {gap.dimensionValue}
                        </span>
                        <ChevronRight className="size-3 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">{gap.category}</span>
                      </div>
                      <div className="mt-2.5">
                        <GapBar avg={gap.avgScore} benchmark={gap.benchmark} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 pl-4">
                      <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                        {gap.avgScore}%
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <TrendingDown className="size-3" />−{gap.gap}%
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        n={gap.submissionCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Grouped recommendations ────────────────────────────────────────────────

function RecGrouped({
  recs,
  workspaceId,
  onDismiss,
}: {
  recs: RecDoc[];
  workspaceId: Id<'workspaces'>;
  onDismiss: (id: Id<'courseRecommendations'>) => void;
}) {
  function effectiveLevel(r: RecDoc): 'national' | 'regional' | 'areaManager' {
    if (r.audienceLevel) return r.audienceLevel;
    if (r.gapDimension === 'areaManager') return 'areaManager';
    if (r.gapDimension === 'region') return 'regional';
    return 'national';
  }

  const national = recs.filter((r) => effectiveLevel(r) === 'national');
  const regional = recs.filter((r) => effectiveLevel(r) === 'regional');
  const areaManager = recs.filter((r) => effectiveLevel(r) === 'areaManager');

  const regionalGroups = new Map<string, RecDoc[]>();
  for (const r of regional) {
    const key = r.gapDimensionValue ?? 'Region';
    const group = regionalGroups.get(key) ?? [];
    group.push(r);
    regionalGroups.set(key, group);
  }

  const amGroups = new Map<string, RecDoc[]>();
  for (const r of areaManager) {
    const key = r.gapDimensionValue ?? 'Area Manager';
    const group = amGroups.get(key) ?? [];
    group.push(r);
    amGroups.set(key, group);
  }

  const sharedProps = { workspaceId, onDismiss };

  return (
    <div className="space-y-6">
      {national.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">🌐</span>
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">National Priorities</h4>
            <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">{national.length}</span>
          </div>
          <div className="space-y-3">
            {national.map((rec) => (<RecCard key={rec._id} rec={rec} {...sharedProps} />))}
          </div>
        </div>
      )}

      {regionalGroups.size > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">📍</span>
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">By Region</h4>
          </div>
          <div className="space-y-4">
            {[...regionalGroups.entries()].map(([region, regionRecs]) => (
              <div key={region}>
                <p className="mb-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{region}</p>
                <div className="space-y-3">{regionRecs.map((rec) => (<RecCard key={rec._id} rec={rec} {...sharedProps} />))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {amGroups.size > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">👤</span>
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">By Area Manager</h4>
          </div>
          <div className="space-y-4">
            {[...amGroups.entries()].map(([am, amRecs]) => (
              <div key={am}>
                <p className="mb-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{am}</p>
                <div className="space-y-3">{amRecs.map((rec) => (<RecCard key={rec._id} rec={rec} {...sharedProps} />))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recommendation card ────────────────────────────────────────────────────

function RecCard({
  rec,
  workspaceId,
  onDismiss,
}: {
  rec: RecDoc;
  workspaceId: Id<'workspaces'>;
  onDismiss: (id: Id<'courseRecommendations'>) => void;
}) {
  const navigate = useNavigate();
  const dismiss = useMutation(api.analytics.dismissRecommendation);

  const priorityColor =
    rec.priority >= 8
      ? SEV.critical.color
      : rec.priority >= 6
        ? SEV.high.color
        : rec.priority >= 4
          ? SEV.medium.color
          : SEV.low.color;

  if (rec.status === 'dismissed') return null;

  const isBuilt = rec.status === 'built' || !!rec.moduleId;

  function handleBuildWithAI() {
    void navigate({
      to: '/w/$workspaceId/build-with-ai',
      params: { workspaceId: workspaceId as string },
      search: { recId: rec._id as string },
    });
  }

  return (
    <div className="widget relative flex flex-col p-5">
      {/* Dismiss */}
      {!isBuilt && (
        <button
          type="button"
          onClick={async () => {
            await dismiss({ recId: rec._id });
            onDismiss(rec._id);
          }}
          className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Header */}
      <div className="mb-3 flex items-start gap-3 pr-6">
        <span className={`mt-0.5 text-xs font-bold tabular-nums ${priorityColor}`}>
          P{rec.priority}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-[var(--text-primary)]">{rec.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{rec.rationale}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
        <span>
          <span className="opacity-60">Audience: </span>
          {rec.targetAudience}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="size-3" />
          {rec.estimatedLessons} {rec.estimatedLessons === 1 ? 'lesson' : 'lessons'}
        </span>
      </div>

      {/* Topics */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {rec.keyTopics.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto">
        {isBuilt ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="size-3.5" />
              Module built
            </div>
            {rec.moduleId && (
              <Link
                to="/w/$workspaceId/m/$moduleId"
                params={{ workspaceId: workspaceId as string, moduleId: rec.moduleId as string }}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--ember-400)] transition hover:opacity-80"
              >
                Open module <ChevronRight className="size-3" />
              </Link>
            )}
          </div>
        ) : rec.status === 'building' ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="size-3.5 animate-spin" /> Generating module…
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBuildWithAI}
              className="prism-action-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
            >
              <Sparkles className="size-3.5" /> Build with AI
            </button>
            <Link
              to="/w/$workspaceId/modules"
              params={{ workspaceId: workspaceId as string }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)]"
            >
              <Layers className="size-3.5" /> Build manually
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Core intelligence content ──────────────────────────────────────────────

function IntelligenceContent({
  workspaceId,
  workspaceName,
}: {
  workspaceId: Id<'workspaces'>;
  workspaceName: string;
}) {
  const link = useQuery(api.analytics.getLink, { workspaceId }) as AnalyticsLink | null | undefined;
  const summary = useQuery(api.analytics.getGapSummary, { workspaceId });
  const gaps = useQuery(api.analytics.listGaps, { workspaceId }) as GapDoc[] | undefined;
  const recs = useQuery(api.analytics.listRecommendations, { workspaceId }) as RecDoc[] | undefined;

  const computeGaps = useAction(api.analytics.computeGaps);
  const generateRecs = useAction(api.analytics.generateRecommendations);

  const [linked, setLinked] = useState(false);
  const [computing, setComputing] = useState(false);
  const [computeErr, setComputeErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState('');
  const [activeTab, setActiveTab] = useState<'region' | 'areaManager'>('region');
  const [showSettings, setShowSettings] = useState(false);
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  const visibleRecs = (recs ?? []).filter((r) => !dismissedRecs.has(r._id));

  // Derived KPIs
  const hasData = (summary?.total ?? 0) > 0;
  const avgScore =
    gaps && gaps.length > 0
      ? Math.round(gaps.reduce((s, g) => s + g.avgScore, 0) / gaps.length)
      : null;
  const avgDelta =
    gaps && gaps.length > 0
      ? (gaps.reduce((s, g) => s + g.avgScore - g.benchmark, 0) / gaps.length).toFixed(1)
      : null;

  async function handleCompute() {
    setComputing(true);
    setComputeErr('');
    try {
      await computeGaps({ workspaceId });
    } catch (e: any) {
      setComputeErr(e.data ?? e.message ?? 'Compute failed');
    } finally {
      setComputing(false);
    }
  }

  if (link === undefined) {
    return (
      <PrismWorkspaceShell
        workspaceId={workspaceId as string}
        workspaceName={workspaceName}
        active="analytics"
        title="Intelligence"
      >
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <Loader2 className="size-4 animate-spin" />
        </div>
      </PrismWorkspaceShell>
    );
  }

  if (!link && !linked) {
    return (
      <PrismWorkspaceShell
        workspaceId={workspaceId as string}
        workspaceName={workspaceName}
        active="analytics"
        title="Training Intelligence"
        overline="Prism Intelligence"
        showPageHeader={false}
      >
        <SetupWizard workspaceId={workspaceId} onLinked={() => setLinked(true)} />
      </PrismWorkspaceShell>
    );
  }

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId as string}
      workspaceName={workspaceName}
      active="analytics"
      overline="Prism Intelligence"
      title="Training Intelligence"
      subtitle={
        link
          ? `${link.companyCode ?? DEFAULT_COMPANY_CODE} · ${link.piCompanyName} · ${link.lookbackDays}-day lookback · benchmark ${link.benchmarkScore}%`
          : 'Loading…'
      }
      showPageHeader={false}
      topbarActions={
        link ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCompute}
              disabled={computing}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {computing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {computing ? 'Computing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-muted)] transition hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)]"
            >
              <Settings2 className="size-3.5" />
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Modals */}
      {showSettings && link && (
        <SettingsPanel link={link} workspaceId={workspaceId} onClose={() => setShowSettings(false)} />
      )}

      {/* Page heading */}
      <div className="mb-6 border-b border-[var(--border-subtle)] pb-6">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--ember-400)]">
          Prism Intelligence
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Training Intelligence
        </h1>
        {link && (
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {link.companyCode ?? DEFAULT_COMPANY_CODE} · {link.piCompanyName} ·{' '}
            <span className="text-[var(--text-secondary)]">{link.lookbackDays}-day lookback</span> ·
            benchmark{' '}
            <span className="text-[var(--text-secondary)]">{link.benchmarkScore}%</span>
            {summary?.computedAt && (
              <> · updated {timeAgo(summary.computedAt)}</>
            )}
          </p>
        )}
      </div>

      {/* Error banners */}
      {computeErr && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <p className="flex-1 text-sm text-red-400">{computeErr}</p>
          <button
            type="button"
            onClick={() => setComputeErr('')}
            className="text-red-400 hover:opacity-70"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {generateErr && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <p className="flex-1 text-sm text-red-400">{generateErr}</p>
          <button
            type="button"
            onClick={() => setGenerateErr('')}
            className="text-red-400 hover:opacity-70"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* No data — first-run CTA */}
      {!hasData ? (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="prism-icon-tile size-16 rounded-2xl">
            <BarChart2 className="size-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No gap data yet</h3>
            <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
              Run your first gap analysis to surface training priorities from{' '}
              <span className="text-[var(--text-secondary)]">
                {(link?.companyCode ?? DEFAULT_COMPANY_CODE)} · {link?.piCompanyName ?? 'Prism Intelligence'}
              </span>{' '}
              audit results.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCompute}
            disabled={computing}
            className="prism-action-primary flex items-center gap-2 rounded-xl px-6 py-3 font-bold disabled:opacity-50"
          >
            {computing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {computing ? 'Computing gaps…' : 'Compute gaps'}
          </button>
          {computing && (
            <p className="text-xs text-[var(--text-muted)]">
              Analysing audit submissions — this may take a moment…
            </p>
          )}
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Avg Score"
              value={avgScore !== null ? `${avgScore}%` : '—'}
              sub={`benchmark ${link?.benchmarkScore ?? '—'}%`}
              accent={
                avgScore !== null && link && avgScore >= link.benchmarkScore
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
              trend={
                avgScore !== null && link
                  ? avgScore >= link.benchmarkScore
                    ? 'up'
                    : 'down'
                  : undefined
              }
            />
            <KpiCard
              label="Avg Gap"
              value={avgDelta !== null ? `${Number(avgDelta) > 0 ? '+' : ''}${avgDelta}pts` : '—'}
              sub="vs benchmark"
              accent={
                avgDelta !== null
                  ? Number(avgDelta) >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : undefined
              }
            />
            <KpiCard
              label="Total Gaps"
              value={summary?.total ?? 0}
              sub={`${summary?.critical ?? 0} critical, ${summary?.high ?? 0} high`}
              accent={
                (summary?.critical ?? 0) > 0
                  ? 'text-red-400'
                  : (summary?.high ?? 0) > 0
                    ? 'text-orange-400'
                    : 'text-[var(--text-primary)]'
              }
            />
            <KpiCard
              label="Recommendations"
              value={visibleRecs.length}
              sub={
                visibleRecs.filter((r) => r.status === 'built').length > 0
                  ? `${visibleRecs.filter((r) => r.status === 'built').length} built`
                  : 'pending build'
              }
              accent="text-[var(--ember-400)]"
            />
          </div>

          {/* Two-column layout */}
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            {/* Left — gap analysis */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Gap Analysis
                </h2>
                {/* Dimension tabs */}
                <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] p-0.5">
                  {(['region', 'areaManager'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        activeTab === tab
                          ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {tab === 'region' ? 'By Region' : 'By Area Manager'}
                    </button>
                  ))}
                </div>
              </div>

              {gaps ? (
                <GapList gaps={gaps} dimension={activeTab} />
              ) : (
                <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
            </section>

            {/* Right — recommendations */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Course Recommendations
                </h2>
                <button
                  type="button"
                  onClick={async () => {
                    setGenerating(true);
                    setGenerateErr('');
                    try {
                      await generateRecs({ workspaceId });
                    } catch (e: any) {
                      setGenerateErr(e.message ?? 'Generation failed');
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--ember-400)]/40 hover:text-[var(--text-primary)] disabled:opacity-50"
                  title="Regenerate recommendations"
                >
                  {generating ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  {generating ? 'Generating…' : 'Regenerate'}
                </button>
              </div>

              {generating && (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-[rgba(140,67,208,0.2)] bg-[rgba(140,67,208,0.06)] px-4 py-3">
                  <Loader2 className="size-3.5 animate-spin text-[var(--ember-400)]" />
                  <p className="text-xs text-[var(--text-muted)]">
                    Generating course recommendations…
                  </p>
                </div>
              )}

              {visibleRecs.length > 0 ? (
                <RecGrouped
                  recs={visibleRecs}
                  workspaceId={workspaceId}
                  onDismiss={(id) => setDismissedRecs((prev) => new Set([...prev, id as string]))}
                />
              ) : !generating ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center">
                  <Sparkles className="size-6 text-[var(--text-muted)]" />
                  <p className="max-w-[200px] text-xs text-[var(--text-muted)]">
                    No recommendations yet. Click regenerate to suggest AI-driven courses.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setGenerating(true);
                      setGenerateErr('');
                      try {
                        await generateRecs({ workspaceId });
                      } catch (e: any) {
                        setGenerateErr(e.message ?? 'Generation failed');
                      } finally {
                        setGenerating(false);
                      }
                    }}
                    disabled={generating}
                    className="prism-action-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    <Sparkles className="size-3.5" /> Suggest courses
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </>
      )}
    </PrismWorkspaceShell>
  );
}

// ── Home wrapper — auto-selects workspace ──────────────────────────────────

export function IntelligenceDashboardPage() {
  const workspaces = useQuery(api.workspaces.listMine);
  const navigate = useNavigate();

  if (workspaces === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <PrismWorkspaceShell active="intelligence" title="Prism Learning" showPageHeader={false}>
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <div className="prism-icon-tile size-16 rounded-2xl">
            <Layers className="size-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Welcome to Prism Learning
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
              Create your first workspace to start building learning modules and connecting Prism
              Intelligence.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              void navigate({ to: '/', search: { createWorkspace: 'true' } as any })
            }
            className="prism-action-primary flex items-center gap-2 rounded-xl px-5 py-3 font-bold"
          >
            <Plus className="size-4" /> Create workspace
          </button>
        </div>
      </PrismWorkspaceShell>
    );
  }

  // Pick the first workspace — could be enhanced to remember last active one
  const ws = workspaces[0];
  if (!ws) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }
  return <IntelligenceContent workspaceId={ws._id} workspaceName={ws.name} />;
}
