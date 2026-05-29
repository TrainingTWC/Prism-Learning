import { useQuery, useMutation, useAction } from 'convex/react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
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
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

// ── Types mirroring Convex doc shapes ─────────────────────────────────────

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
  piCompanyId: string;
  piCompanyName: string;
  benchmarkScore: number;
  lookbackDays: number;
  lastComputedAt?: number;
};

// ── Severity helpers ───────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  low: { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
} as const;

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function GapBar({ avg, benchmark }: { avg: number; benchmark: number }) {
  const pct = Math.min(100, Math.max(0, avg));
  const bPct = Math.min(100, Math.max(0, benchmark));
  const color =
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
        className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
      {/* Benchmark marker */}
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-[var(--text-muted)] opacity-60"
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

// ── Setup wizard ───────────────────────────────────────────────────────────

function SetupWizard({
  workspaceId,
  onLinked,
}: {
  workspaceId: Id<'workspaces'>;
  onLinked: () => void;
}) {
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [benchmark, setBenchmark] = useState(75);
  const [lookback, setLookback] = useState(90);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<{ programCount: number; storeCount: number } | null>(null);
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
      const result = await validateCompany({ piCompanyId: companyId.trim() });
      setValidated(result);
    } catch (e: any) {
      setErr(e.message ?? 'Validation failed — check the company ID and PI env vars');
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
        piCompanyId: companyId.trim(),
        piCompanyName: companyName.trim(),
        benchmarkScore: benchmark,
        lookbackDays: lookback,
      });
      onLinked();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to connect');
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

        <div className="widget p-6 space-y-5">
          {/* PI Company ID */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              PI Company ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setValidated(null); }}
                placeholder="Paste your PI company document ID…"
                className="prism-input flex-1"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={!companyId.trim() || validating}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
              >
                {validating ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {validating ? 'Checking…' : 'Validate'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Find this in your Prism Intelligence admin URL or company settings page.
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

          {/* Company display name */}
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

          {/* Benchmark */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Gap benchmark score: <span className="text-[var(--ember-400)]">{benchmark}%</span>
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
              <span>50%</span><span>Scores below this = gap</span><span>95%</span>
            </div>
          </div>

          {/* Lookback */}
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

          {err && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>
          )}

          <button
            type="button"
            onClick={handleConnect}
            disabled={!companyId.trim() || !companyName.trim() || linking}
            className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            {linking ? <Loader2 className="size-4 animate-spin" /> : <BarChart2 className="size-4" />}
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
  const [companyId, setCompanyId] = useState(link.piCompanyId);
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

  const companyChanged = companyId.trim() !== link.piCompanyId;

  async function handleValidate() {
    if (!companyId.trim()) return;
    setValidating(true);
    setErr('');
    setValidated(null);
    try {
      const result = await validateCompany({ piCompanyId: companyId.trim() });
      setValidated(result);
    } catch (e: any) {
      setErr(e.data ?? e.message ?? 'Validation failed — check the company ID and PI env vars');
    } finally {
      setValidating(false);
    }
  }

  async function handleSave() {
    if (!companyId.trim() || !companyName.trim()) return;
    if (companyChanged && !validated) {
      setErr('Validate the new company ID before saving.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await linkCompany({
        workspaceId,
        piCompanyId: companyId.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold text-[var(--text-primary)]">Intelligence Settings</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              PI Company ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
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
              Benchmark: <span className="text-[var(--ember-400)]">{benchmark}%</span>
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
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">Lookback window</label>
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
            className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !companyId.trim() || !companyName.trim() || (companyChanged && !validated)}
            className="flex-1 prism-action-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Build module dialog ────────────────────────────────────────────────────

function BuildModuleDialog({
  rec,
  workspaceId,
  onClose,
  onBuilt,
}: {
  rec: RecDoc;
  workspaceId: Id<'workspaces'>;
  onClose: () => void;
  onBuilt: (moduleId: string) => void;
}) {
  const [type, setType] = useState<'microLearning' | 'course'>('microLearning');
  const [extra, setExtra] = useState('');
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState('');
  const buildModule = useAction(api.analytics.buildModuleFromRecommendation);

  async function handleBuild() {
    setBuilding(true);
    setErr('');
    try {
      const moduleId = await buildModule({
        recId: rec._id,
        workspaceId,
        moduleType: type,
        extraContext: extra || undefined,
      });
      onBuilt(moduleId as string);
    } catch (e: any) {
      setErr(e.message ?? 'Build failed');
      setBuilding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--ember-400)]" />
            <h3 className="font-bold text-[var(--text-primary)]">Build with AI</h3>
          </div>
          <button type="button" onClick={onClose} disabled={building} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-4 text-sm font-medium text-[var(--text-primary)]">{rec.title}</p>
        <p className="mb-5 text-xs text-[var(--text-muted)]">{rec.rationale}</p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">Module format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['microLearning', 'course'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${type === t ? 'border-[var(--ember-400)] bg-[rgba(140,67,208,0.1)] text-[var(--ember-400)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--ember-400)]/50'}`}
                >
                  <p className="text-xs font-bold">{t === 'microLearning' ? 'Micro-learning' : 'Full Course'}</p>
                  <p className="mt-0.5 text-[10px] opacity-70">
                    {t === 'microLearning' ? '1–3 lessons, 5–10 min' : '3–7 lessons, 20–40 min'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Extra context <span className="font-normal opacity-60">(optional)</span>
            </label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Add any specific guidance, brand voice, or context for the AI…"
              rows={3}
              disabled={building}
              className="prism-input w-full resize-none"
            />
          </div>
        </div>

        {err && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={building}
            className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBuild}
            disabled={building}
            className="prism-action-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
          >
            {building ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Generate Module
              </>
            )}
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
      ([, a], [, b]) =>
        Math.max(...b.map((x) => x.gap)) - Math.max(...a.map((x) => x.gap)),
    );
  }, [gaps, dimension]);

  if (byProgram.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="prism-icon-tile size-10 rounded-xl">
          <BarChart2 className="size-4" />
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          No gaps found for this dimension. All scores are above benchmark.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {byProgram.map(([programName, programGaps]) => {
        const isOpen = !collapsed.has(programName);
        const topSeverity = programGaps[0]?.severity ?? 'low';
        return (
          <div key={programName} className="widget overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[var(--hover-bg)] transition"
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(programName)) next.delete(programName);
                  else next.add(programName);
                  return next;
                })
              }
            >
              <div className={`size-2 rounded-full flex-shrink-0 ${SEVERITY_CONFIG[topSeverity].dot}`} />
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
                        <TrendingDown className="size-3" />
                        −{gap.gap}%
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
  onDismiss: (id: string) => void;
}) {
  // Resolve effective audience level
  function effectiveLevel(r: RecDoc): 'national' | 'regional' | 'areaManager' {
    if (r.audienceLevel) return r.audienceLevel;
    if (r.gapDimension === 'areaManager') return 'areaManager';
    if (r.gapDimension === 'region') return 'regional';
    return 'national';
  }

  const national = recs.filter((r) => effectiveLevel(r) === 'national');
  const regional = recs.filter((r) => effectiveLevel(r) === 'regional');
  const areaManager = recs.filter((r) => effectiveLevel(r) === 'areaManager');

  // Group regional by dimensionValue
  const regionalGroups = new Map<string, RecDoc[]>();
  for (const r of regional) {
    const key = r.gapDimensionValue ?? 'Region';
    const group = regionalGroups.get(key) ?? [];
    group.push(r);
    regionalGroups.set(key, group);
  }

  // Group area manager by dimensionValue
  const amGroups = new Map<string, RecDoc[]>();
  for (const r of areaManager) {
    const key = r.gapDimensionValue ?? 'Area Manager';
    const group = amGroups.get(key) ?? [];
    group.push(r);
    amGroups.set(key, group);
  }

  const sharedProps = { workspaceId, onDismiss };

  return (
    <div className="space-y-8">
      {national.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">🌐</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">National Priorities</h3>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
              {national.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {national.map((rec) => (
              <RecCard key={rec._id} rec={rec} {...sharedProps} />
            ))}
          </div>
        </div>
      )}

      {regionalGroups.size > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">📍</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">By Region</h3>
          </div>
          <div className="space-y-5">
            {[...regionalGroups.entries()].map(([region, regionRecs]) => (
              <div key={region}>
                <p className="mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {region}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {regionRecs.map((rec) => (
                    <RecCard key={rec._id} rec={rec} {...sharedProps} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {amGroups.size > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">👤</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">By Area Manager</h3>
          </div>
          <div className="space-y-5">
            {[...amGroups.entries()].map(([am, amRecs]) => (
              <div key={am}>
                <p className="mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {am}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {amRecs.map((rec) => (
                    <RecCard key={rec._id} rec={rec} {...sharedProps} />
                  ))}
                </div>
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
  const [builtId, setBuiltId] = useState<string | null>(rec.moduleId ?? null);
  const navigate = useNavigate();
  const dismiss = useMutation(api.analytics.dismissRecommendation);

  const priorityColor =
    rec.priority >= 8
      ? SEVERITY_CONFIG.critical.color
      : rec.priority >= 6
        ? SEVERITY_CONFIG.high.color
        : rec.priority >= 4
          ? SEVERITY_CONFIG.medium.color
          : SEVERITY_CONFIG.low.color;

  if (rec.status === 'dismissed') return null;

  function handleBuildWithAI() {
    void navigate({
      to: '/w/$workspaceId/build-with-ai',
      params: { workspaceId: workspaceId as string },
      search: { recId: rec._id as string },
    });
  }

  return (
      <div className="widget p-5 relative">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={async () => {
            await dismiss({ recId: rec._id });
            onDismiss(rec._id);
          }}
          className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>

        <div className="mb-3 flex items-start gap-3 pr-6">
          <div className={`mt-0.5 text-xs font-bold tabular-nums ${priorityColor}`}>
            P{rec.priority}
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)] leading-snug">{rec.title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{rec.rationale}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="mb-4 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="opacity-60">Audience:</span> {rec.targetAudience}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-3" />
            {rec.estimatedLessons} {rec.estimatedLessons === 1 ? 'lesson' : 'lessons'}
          </span>
        </div>

        {/* Key topics */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {rec.keyTopics.map((t) => (
            <span
              key={t}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        {builtId ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="size-3.5" />
              Module built
            </div>
            <Link
              to="/w/$workspaceId/m/$moduleId"
              params={{ workspaceId: workspaceId as string, moduleId: builtId }}
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--ember-400)] hover:opacity-80 transition"
            >
              Open module <ChevronRight className="size-3" />
            </Link>
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
              className="prism-action-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
            >
              <Sparkles className="size-3.5" /> Build with AI
            </button>
            <Link
              to="/w/$workspaceId/modules"
              params={{ workspaceId: workspaceId as string }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)] transition"
            >
              <Layers className="size-3.5" /> Build manually
            </Link>
          </div>
        )}
      </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/analytics' });
  const wsId = workspaceId as Id<'workspaces'>;

  const link = useQuery(api.analytics.getLink, { workspaceId: wsId }) as
    | AnalyticsLink
    | null
    | undefined;
  const summary = useQuery(api.analytics.getGapSummary, { workspaceId: wsId });
  const gaps = useQuery(api.analytics.listGaps, { workspaceId: wsId }) as
    | GapDoc[]
    | undefined;
  const recs = useQuery(api.analytics.listRecommendations, { workspaceId: wsId }) as
    | RecDoc[]
    | undefined;

  const computeGaps = useAction(api.analytics.computeGaps);
  const generateRecs = useAction(api.analytics.generateRecommendations);

  const [linked, setLinked] = useState(false); // trigger re-render after setup
  const [computing, setComputing] = useState(false);
  const [computeErr, setComputeErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState('');
  const [activeTab, setActiveTab] = useState<'region' | 'areaManager'>('region');
  const [showSettings, setShowSettings] = useState(false);
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  const visibleRecs = (recs ?? []).filter((r) => !dismissedRecs.has(r._id));

  // Loading state
  if (link === undefined) {
    return (
      <PrismWorkspaceShell active="analytics" title="Intelligence">
        <div className="flex items-center gap-2 py-20 justify-center text-[var(--text-muted)]">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      </PrismWorkspaceShell>
    );
  }

  // Not linked state
  if (!link && !linked) {
    return (
      <PrismWorkspaceShell
        workspaceId={workspaceId}
        active="analytics"
        title="Intelligence"
        overline="Prism Intelligence"
        subtitle="Surface audit gaps and generate targeted training automatically."
        showPageHeader={false}
      >
        <SetupWizard workspaceId={wsId} onLinked={() => setLinked(true)} />
      </PrismWorkspaceShell>
    );
  }

  // Linked — show dashboard
  const hasData = (summary?.total ?? 0) > 0;

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      active="analytics"
      overline="Prism Intelligence"
      title="Training Intelligence"
      subtitle={
        link
          ? `Connected to ${link.piCompanyName} · ${link.lookbackDays}-day lookback · benchmark ${link.benchmarkScore}%`
          : 'Processing…'
      }
      topbarActions={
        link ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setComputing(true);
                setComputeErr('');
                try {
                  await computeGaps({ workspaceId: wsId });
                } catch (e: any) {
                  setComputeErr(e.data ?? e.message ?? 'Compute failed');
                } finally {
                  setComputing(false);
                }
              }}
              disabled={computing}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)] transition disabled:opacity-50"
            >
              {computing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {computing ? 'Computing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-muted)] hover:border-[var(--ember-400)]/50 hover:text-[var(--text-primary)] transition"
            >
              <Settings2 className="size-3.5" />
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Settings modal */}
      {showSettings && link && (
        <SettingsPanel
          link={link}
          workspaceId={wsId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Error banners */}
      {computeErr && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-red-400" />
          <p className="flex-1 text-sm text-red-400">{computeErr}</p>
          <button type="button" onClick={() => setComputeErr('')} className="text-red-400 hover:opacity-70">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {generateErr && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-red-400" />
          <p className="flex-1 text-sm text-red-400">{generateErr}</p>
          <button type="button" onClick={() => setGenerateErr('')} className="text-red-400 hover:opacity-70">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* No data yet */}
      {!hasData ? (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="prism-icon-tile size-14 rounded-2xl">
            <BarChart2 className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">No gap data yet</h3>
            <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
              Run your first gap analysis to surface training priorities from{' '}
              {link?.piCompanyName ?? 'Prism Intelligence'} audit results.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setComputing(true);
              setComputeErr('');
              try {
                await computeGaps({ workspaceId: wsId });
              } catch (e: any) {
                setComputeErr(e.data ?? e.message ?? 'Compute failed');
              } finally {
                setComputing(false);
              }
            }}
            disabled={computing}
            className="prism-action-primary flex items-center gap-2 rounded-xl px-5 py-3 font-bold disabled:opacity-50"
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
          {/* Last computed */}
          {summary?.computedAt && (
            <p className="mb-5 text-xs text-[var(--text-muted)]">
              Last computed {timeAgo(summary.computedAt)}
            </p>
          )}

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              const count = summary?.[sev] ?? 0;
              return (
                <div
                  key={sev}
                  className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}
                >
                  <p className={`text-3xl font-bold font-mono-value ${cfg.color}`}>{count}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {cfg.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Dimension tabs */}
          <div className="mb-5 flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-1 w-fit">
            {(['region', 'areaManager'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab
                    ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab === 'region' ? 'By Region' : 'By Area Manager'}
              </button>
            ))}
          </div>

          {/* Gap list */}
          {gaps ? (
            <GapList gaps={gaps} dimension={activeTab} />
          ) : (
            <div className="flex items-center gap-2 py-8 text-[var(--text-muted)]">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}

          {/* Recommendations section */}
          <div className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Course Recommendations
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  AI-generated courses targeting critical and high-severity gaps
                </p>
              </div>
              {visibleRecs.length === 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    setGenerating(true);
                    setGenerateErr('');
                    try {
                      await generateRecs({ workspaceId: wsId });
                    } catch (e: any) {
                      setGenerateErr(e.message ?? 'Generation failed');
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="prism-action-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {generating ? 'Generating…' : 'Suggest courses'}
                </button>
              )}
            </div>

            {generating && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-[rgba(140,67,208,0.2)] bg-[rgba(140,67,208,0.06)] px-4 py-3">
                <Loader2 className="size-4 animate-spin text-[var(--ember-400)]" />
                <p className="text-sm text-[var(--text-muted)]">
                  Analysing gaps and generating course recommendations…
                </p>
              </div>
            )}

            {visibleRecs.length > 0 ? (
              <RecGrouped recs={visibleRecs} workspaceId={wsId} onDismiss={(id) => setDismissedRecs((prev) => new Set([...prev, id as string]))} />
            ) : !generating ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center">
                <Sparkles className="size-6 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">
                  No recommendations yet. Click &ldquo;Suggest courses&rdquo; to generate AI recommendations.
                </p>
              </div>
            ) : null}

            {visibleRecs.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    setGenerating(true);
                    setGenerateErr('');
                    try {
                      await generateRecs({ workspaceId: wsId });
                    } catch (e: any) {
                      setGenerateErr(e.message ?? 'Generation failed');
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--ember-400)] transition disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate recommendations
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </PrismWorkspaceShell>
  );
}
