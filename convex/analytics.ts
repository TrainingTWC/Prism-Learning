/**
 * Analytics layer — bridges Prism Intelligence (PI) audit data to Prism Authoring (PA).
 *
 * PI and PA are SEPARATE Convex deployments on the same team. PI tables are NOT
 * accessible via ctx.db from PA. All PI data is fetched via Convex's HTTP API:
 *   POST {PI_CONVEX_URL}/api/query  { path, args: { apiToken, ...rest } }
 *
 * Required env vars in the PA Convex dashboard:
 *   PI_CONVEX_URL  — PI deployment URL, e.g. https://abc123.convex.cloud
 *   PI_API_TOKEN   — static token accepted by PI's validateRequest() guard
 */
import { v, ConvexError } from 'convex/values';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal, api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

// ── PI response shapes ────────────────────────────────────────────────────
// Minimal interfaces for data returned by PI's public Convex HTTP queries.

type PISubmission = {
  _id: string;
  storeId: string;
  programId: string;
  percentage?: number | null;
  sectionScores?: unknown;
  status: string;
  submittedAt?: number | null;
};

/** Returned by PI's stores:list — regionName is hydrated from the region join */
type PIStore = {
  _id: string;
  storeName: string;
  regionId?: string | null;
  regionName?: string | null;
  amName?: string | null;
  city?: string | null;
  isActive?: boolean;
};

type PIProgram = {
  _id: string;
  name: string;
  sections?: Array<{
    id: string;
    title: string;
    maxScore?: number;
  }>;
};

const DEFAULT_PI_COMPANY_CODE = 'HBPL';

function normalizeCompanyCode(value: string) {
  return value.trim().toUpperCase();
}

function resolvePICompanyId(companyCode: string, currentPiCompanyId?: string) {
  const normalizedCompanyCode = normalizeCompanyCode(companyCode);
  const configuredCompanyCode = normalizeCompanyCode(
    process.env.PI_COMPANY_CODE ?? DEFAULT_PI_COMPANY_CODE,
  );
  const configuredCompanyId = (process.env.PI_COMPANY_ID ?? '').trim();

  if (normalizedCompanyCode === configuredCompanyCode) {
    if (configuredCompanyId) return configuredCompanyId;
    if (currentPiCompanyId?.trim()) return currentPiCompanyId.trim();
    throw new ConvexError(
      `PI_COMPANY_ID must be set in Convex env vars before company code ${normalizedCompanyCode} can be resolved.`,
    );
  }

  return companyCode.trim();
}

// ── Auth helper ────────────────────────────────────────────────────────────

async function requireMember(ctx: any, workspaceId: Id<'workspaces'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Not authenticated');
  const member = await ctx.db
    .query('memberships')
    .withIndex('by_workspace', (q: any) => q.eq('workspaceId', workspaceId))
    .filter((q: any) => q.eq(q.field('userId'), userId))
    .first();
  if (!member) throw new ConvexError('Not a workspace member');
  return userId;
}

// ── PI HTTP bridge ────────────────────────────────────────────────────────

/**
 * Call a public query on the Prism Intelligence (PI) Convex deployment via
 * the HTTP API. Automatically injects apiToken from PI_API_TOKEN env var.
 */
async function callPIQuery(
  piUrl: string,
  piToken: string,
  path: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const url = `${piUrl}/api/query`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args: { apiToken: piToken, ...args } }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ConvexError(`PI fetch failed (${url}): ${msg}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ConvexError(`PI HTTP ${res.status} for ${path}: ${text.slice(0, 300)}`);
  let json: { value?: unknown; errorMessage?: string; status?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new ConvexError(`PI non-JSON response for ${path}: ${text.slice(0, 300)}`);
  }
  if (json.errorMessage) throw new ConvexError(`PI error on ${path}: ${json.errorMessage}`);
  return json.value;
}

/**
 * Validate that a given company code is reachable with the configured env
 * vars. Returns program and store counts on success; throws on failure.
 */
export const validatePICompany = action({
  args: {
    companyCode: v.string(),
    currentPiCompanyId: v.optional(v.string()),
  },
  handler: async (ctx, { companyCode, currentPiCompanyId }): Promise<{ programCount: number; storeCount: number; piCompanyId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const piUrl = (process.env.PI_CONVEX_URL ?? '').replace(/\/+$/, '');
    const piToken = process.env.PI_API_TOKEN;
    if (!piUrl || !piToken)
      throw new ConvexError(
        'PI_CONVEX_URL and PI_API_TOKEN must be set as environment variables in the Convex dashboard',
      );

    const piCompanyId = resolvePICompanyId(companyCode, currentPiCompanyId);

    let data: unknown;
    try {
      data = await callPIQuery(piUrl, piToken, 'analytics:filterOptions', {
        companyId: piCompanyId,
      });
    } catch (e: unknown) {
      if (e instanceof ConvexError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new ConvexError(`Cannot reach PI at ${piUrl}: ${msg}`);
    }
    const d = data as Record<string, unknown[]> | null;

    return {
      programCount: Array.isArray(d?.programs) ? d!.programs.length : 0,
      storeCount: Array.isArray(d?.stores) ? d!.stores.length : 0,
      piCompanyId,
    };
  },
});

// ── Workspace ↔ PI company link ────────────────────────────────────────────

export const linkCompany = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    companyCode: v.string(),
    piCompanyId: v.string(),
    piCompanyName: v.string(),
    benchmarkScore: v.number(),
    lookbackDays: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const existing = await ctx.db
      .query('analyticsLinks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .first();
    const piCompanyId = args.piCompanyId.trim();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        companyCode: normalizeCompanyCode(args.companyCode),
        piCompanyId,
        piCompanyName: args.piCompanyName,
        benchmarkScore: args.benchmarkScore,
        lookbackDays: args.lookbackDays,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert('analyticsLinks', {
      workspaceId: args.workspaceId,
      companyCode: normalizeCompanyCode(args.companyCode),
      piCompanyId,
      piCompanyName: args.piCompanyName,
      benchmarkScore: args.benchmarkScore,
      lookbackDays: args.lookbackDays,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getLink = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query('analyticsLinks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .first();
  },
});

export const updateLinkSettings = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    benchmarkScore: v.number(),
    lookbackDays: v.number(),
  },
  handler: async (ctx, { workspaceId, benchmarkScore, lookbackDays }) => {
    await requireMember(ctx, workspaceId);
    const link = await ctx.db
      .query('analyticsLinks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .first();
    if (!link) throw new ConvexError('No analytics link found');
    await ctx.db.patch(link._id, { benchmarkScore, lookbackDays, updatedAt: Date.now() });
  },
});

// ── Gap queries ────────────────────────────────────────────────────────────

export const listGaps = query({
  args: {
    workspaceId: v.id('workspaces'),
    dimension: v.optional(v.union(v.literal('region'), v.literal('areaManager'), v.literal('store'))),
  },
  handler: async (ctx, { workspaceId, dimension }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    let results = await ctx.db
      .query('trainingGaps')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    if (dimension) results = results.filter((g) => g.dimension === dimension);
    return results.sort((a, b) => b.gap - a.gap);
  },
});

export const getGapSummary = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const gaps = await ctx.db
      .query('trainingGaps')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: gaps.length };
    for (const g of gaps) counts[g.severity]++;
    return { ...counts, computedAt: gaps[0]?.computedAt };
  },
});

// ── Gap computation ────────────────────────────────────────────────────────

export const computeGaps = action({
  args: {
    workspaceId: v.id('workspaces'),
    /** Run under a saved analysis profile. Omitted = legacy link defaults. */
    profileId: v.optional(v.id('analysisProfiles')),
  },
  // Explicit annotations: these runQuery calls target functions declared in
  // this same module, so TS cannot infer the types without a cycle (TS7022).
  handler: async (
    ctx,
    { workspaceId, profileId },
  ): Promise<{
    gapCount: number;
    submissionCount: number;
    appliedProfileId: Id<'analysisProfiles'> | null;
    programsAnalysed: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const link: Doc<'analyticsLinks'> | null = await ctx.runQuery(
      internal.analytics.getLinkInternal,
      { workspaceId },
    );
    if (!link) throw new ConvexError('No PI company linked — connect Prism Intelligence first');

    // Resolve the effective config: profile when given, else the link's own
    // benchmark/lookback with the original hardcoded thresholds.
    const profile: Doc<'analysisProfiles'> | null = profileId
      ? await ctx.runQuery(internal.analytics.getProfileInternal, { profileId })
      : null;
    if (profileId && !profile) throw new ConvexError('Analysis profile not found');

    const cfg = {
      programs: profile?.programs ?? DEFAULT_PROFILE.programs,
      fromDate: profile?.fromDate,
      toDate: profile?.toDate,
      lookbackDays: profile?.lookbackDays ?? link.lookbackDays,
      benchmarkScore: profile?.benchmarkScore ?? link.benchmarkScore,
      thresholds: profile?.thresholds ?? DEFAULT_PROFILE.thresholds,
      minSubmissions: profile?.minSubmissions ?? DEFAULT_PROFILE.minSubmissions,
      dimensions: profile?.dimensions ?? DEFAULT_PROFILE.dimensions,
    };
    const programFilter = new Set(cfg.programs);

    const piUrl = (process.env.PI_CONVEX_URL ?? '').replace(/\/+$/, '');
    const piToken = process.env.PI_API_TOKEN;
    if (!piUrl || !piToken)
      throw new ConvexError(
        'PI_CONVEX_URL and PI_API_TOKEN must be set as environment variables in the Convex dashboard',
      );

    // Explicit from/to window when the profile pins dates, otherwise the
    // rolling lookback window.
    const since = cfg.fromDate ?? Date.now() - cfg.lookbackDays * 24 * 60 * 60 * 1000;
    const until = cfg.toDate ?? Number.POSITIVE_INFINITY;

    // Fetch stores (with regionName joined), programs, and submissions from PI via HTTP
    let rawStores: unknown, rawPrograms: unknown, rawSubmissions: unknown;
    try {
      [rawStores, rawPrograms, rawSubmissions] = await Promise.all([
        callPIQuery(piUrl, piToken, 'stores:list', {
          companyId: link.piCompanyId,
          active: true,
        }),
        callPIQuery(piUrl, piToken, 'programs:list', {
          companyId: link.piCompanyId,
        }),
        callPIQuery(piUrl, piToken, 'submissions:list', {
          companyId: link.piCompanyId,
          limit: 3000,
        }),
      ]);
    } catch (e: unknown) {
      if (e instanceof ConvexError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new ConvexError(`Failed to fetch data from PI (URL: ${piUrl}): ${msg}`);
    }

    const storeMap = new Map(
      (Array.isArray(rawStores) ? (rawStores as PIStore[]) : []).map((s) => [s._id, s]),
    );
    const programMap = new Map(
      (Array.isArray(rawPrograms) ? (rawPrograms as PIProgram[]) : []).map((p) => [p._id, p]),
    );

    // Exclude drafts; require a percentage score; limit to the analysis window
    const submissions = (Array.isArray(rawSubmissions) ? (rawSubmissions as PISubmission[]) : []).filter(
      (s) =>
        s.status !== 'draft' &&
        s.percentage != null &&
        (s.submittedAt == null || (s.submittedAt >= since && s.submittedAt <= until)),
    );

    type AggEntry = {
      sum: number;
      count: number;
      programName: string;
      category: string;
      dimension: string;
      dimensionValue: string;
    };
    const agg = new Map<string, AggEntry>();

    function add(dim: string, val: string, progName: string, cat: string, score: number) {
      const k = `${dim}::${val}::${progName}::${cat}`;
      const e = agg.get(k) ?? {
        sum: 0,
        count: 0,
        programName: progName,
        category: cat,
        dimension: dim,
        dimensionValue: val,
      };
      e.sum += score;
      e.count++;
      agg.set(k, e);
    }

    function extractSectionPct(sd: unknown, maxScore?: number): number | null {
      if (sd == null) return null;
      if (typeof sd === 'number') return sd;
      if (typeof sd === 'object') {
        const o = sd as Record<string, unknown>;
        const s = (o['score'] ?? o['rawScore'] ?? o['total']) as number | undefined;
        const m = (o['maxScore'] ?? o['max'] ?? maxScore) as number | undefined;
        if (s != null && m != null && m > 0) return (s / m) * 100;
        if (o['percentage'] != null) return o['percentage'] as number;
      }
      return null;
    }

    let processed = 0;
    for (const sub of submissions) {
      if (!sub.submittedAt || sub.percentage == null) continue;
      if (sub.status === 'draft') continue;

      const store = storeMap.get(sub.storeId);
      if (!store) continue;
      const program = programMap.get(sub.programId);
      if (!program) continue;
      // Empty program list means "all programs" (default behaviour)
      if (programFilter.size > 0 && !programFilter.has(program.name)) continue;

      // stores:list from PI hydrates regionName via a region join
      const regionName = store.regionName?.trim() || store.city?.trim() || 'Unknown Region';
      const amName = store.amName?.trim() || 'Unassigned';
      const storeName = store.storeName?.trim() || store._id;
      const dims = (
        [
          ['region', regionName],
          ['areaManager', amName],
          ['store', storeName],
        ] as const
      ).filter(([dim]) => cfg.dimensions.includes(dim));

      for (const [dim, val] of dims) add(dim, val, program.name, 'Overall', sub.percentage);

      if (sub.sectionScores && typeof sub.sectionScores === 'object') {
        const ss = sub.sectionScores as Record<string, unknown>;
        for (const section of program.sections ?? []) {
          const pct = extractSectionPct(ss[section.id], section.maxScore);
          if (pct == null) continue;
          for (const [dim, val] of dims) add(dim, val, program.name, section.title, pct);
        }
      }
      processed++;
    }

    const benchmark = cfg.benchmarkScore;
    type GapRecord = {
      workspaceId: Id<'workspaces'>;
      piCompanyId: string;
      dimension: 'region' | 'areaManager' | 'store';
      dimensionValue: string;
      category: string;
      programName: string;
      avgScore: number;
      benchmark: number;
      gap: number;
      severity: 'critical' | 'high' | 'medium' | 'low';
      submissionCount: number;
      computedAt: number;
    };

    const gaps: GapRecord[] = [];
    for (const [, e] of agg) {
      if (e.count < cfg.minSubmissions) continue;
      const avg = Math.round((e.sum / e.count) * 10) / 10;
      const gap = Math.round((benchmark - avg) * 10) / 10;
      if (gap < cfg.thresholds.low) continue;
      const severity: GapRecord['severity'] =
        gap > cfg.thresholds.critical
          ? 'critical'
          : gap > cfg.thresholds.high
            ? 'high'
            : gap > cfg.thresholds.medium
              ? 'medium'
              : 'low';
      gaps.push({
        workspaceId,
        piCompanyId: link.piCompanyId,
        dimension: e.dimension as 'region' | 'areaManager' | 'store',
        dimensionValue: e.dimensionValue,
        category: e.category,
        programName: e.programName,
        avgScore: avg,
        benchmark,
        gap,
        severity,
        submissionCount: e.count,
        computedAt: Date.now(),
      });
    }

    gaps.sort((a, b) => b.gap - a.gap);
    const topGaps = gaps.slice(0, 200);

    await ctx.runMutation(internal.analytics.storeGaps, { workspaceId, gaps: topGaps });
    if (profileId) {
      await ctx.runMutation(internal.analytics.markProfileRun, { profileId });
    }
    return {
      gapCount: topGaps.length,
      submissionCount: processed,
      /** Echoed so the dashboard can show exactly what the run used */
      appliedProfileId: profileId ?? null,
      programsAnalysed: cfg.programs.length === 0 ? 'all' : cfg.programs.join(', '),
    };
  },
});

// ── Analysis profiles ────────────────────────────────────────────────────

const thresholdsValidator = v.object({
  critical: v.number(),
  high: v.number(),
  medium: v.number(),
  low: v.number(),
});

const dimensionsValidator = v.array(
  v.union(v.literal('region'), v.literal('areaManager'), v.literal('store')),
);

/** Defaults reproduce the pre-profile hardcoded behaviour exactly. */
export const DEFAULT_PROFILE = {
  programs: [] as string[],
  lookbackDays: 90,
  benchmarkScore: 75,
  thresholds: { critical: 25, high: 15, medium: 8, low: 2 },
  minSubmissions: 2,
  dimensions: ['region', 'areaManager', 'store'] as Array<'region' | 'areaManager' | 'store'>,
};

export const listProfiles = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query('analysisProfiles')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
  },
});

export const saveProfile = mutation({
  args: {
    /** Omit to create; provide to update in place */
    profileId: v.optional(v.id('analysisProfiles')),
    workspaceId: v.id('workspaces'),
    name: v.string(),
    programs: v.array(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    lookbackDays: v.number(),
    benchmarkScore: v.number(),
    thresholds: thresholdsValidator,
    minSubmissions: v.number(),
    dimensions: dimensionsValidator,
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const name = args.name.trim();
    if (!name) throw new ConvexError('Profile name cannot be empty');
    if (args.dimensions.length === 0)
      throw new ConvexError('Select at least one dimension to analyse');

    const { critical, high, medium, low } = args.thresholds;
    if (!(critical > high && high > medium && medium > low))
      throw new ConvexError('Thresholds must decrease: critical > high > medium > low');
    if (low < 0) throw new ConvexError('Thresholds cannot be negative');
    if (args.fromDate != null && args.toDate != null && args.fromDate > args.toDate)
      throw new ConvexError('Start date must be before end date');

    // Only one default per workspace
    if (args.isDefault) {
      const existing = await ctx.db
        .query('analysisProfiles')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
        .collect();
      for (const p of existing) {
        if (p.isDefault && p._id !== args.profileId) {
          await ctx.db.patch(p._id, { isDefault: false });
        }
      }
    }

    const fields = {
      workspaceId: args.workspaceId,
      name,
      programs: args.programs,
      fromDate: args.fromDate,
      toDate: args.toDate,
      lookbackDays: args.lookbackDays,
      benchmarkScore: args.benchmarkScore,
      thresholds: args.thresholds,
      minSubmissions: args.minSubmissions,
      dimensions: args.dimensions,
      isDefault: args.isDefault,
      updatedAt: Date.now(),
    };

    if (args.profileId) {
      const existing = await ctx.db.get(args.profileId);
      if (!existing || existing.workspaceId !== args.workspaceId)
        throw new ConvexError('Profile not found');
      await ctx.db.patch(args.profileId, fields);
      return args.profileId;
    }

    return ctx.db.insert('analysisProfiles', { ...fields, createdAt: Date.now() });
  },
});

export const deleteProfile = mutation({
  args: { profileId: v.id('analysisProfiles') },
  handler: async (ctx, { profileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');
    await ctx.db.delete(profileId);
  },
});

export const getProfileInternal = internalQuery({
  args: { profileId: v.id('analysisProfiles') },
  handler: async (ctx, { profileId }) => ctx.db.get(profileId),
});

export const markProfileRun = internalMutation({
  args: { profileId: v.id('analysisProfiles') },
  handler: async (ctx, { profileId }) => {
    await ctx.db.patch(profileId, { lastRunAt: Date.now() });
  },
});

/**
 * Titles of everything already authored in this workspace, used to make the
 * recommendation AI aware of existing coverage (dedupe + extend).
 */
export const getModuleInventoryInternal = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const modules = (
      await ctx.db
        .query('modules')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
        .collect()
    ).filter((m) => m.deletedAt == null); // soft-deleted modules aren't coverage

    return Promise.all(
      modules.map(async (m) => {
        const lessons = await ctx.db
          .query('lessons')
          .withIndex('by_module', (q) => q.eq('moduleId', m._id))
          .collect();
        return {
          moduleId: m._id,
          title: m.title,
          lessonTitles: lessons.map((l) => l.title).filter(Boolean),
        };
      }),
    );
  },
});

// ── Internal helpers ─────────────────────────────────────────────────────

export const getLinkInternal = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) =>
    ctx.db
      .query('analyticsLinks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .first(),
});

export const storeGaps = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    gaps: v.array(
      v.object({
        workspaceId: v.id('workspaces'),
        piCompanyId: v.string(),
        dimension: v.union(v.literal('region'), v.literal('areaManager'), v.literal('store')),
        dimensionValue: v.string(),
        category: v.string(),
        programName: v.string(),
        avgScore: v.number(),
        benchmark: v.number(),
        gap: v.number(),
        severity: v.union(
          v.literal('critical'),
          v.literal('high'),
          v.literal('medium'),
          v.literal('low'),
        ),
        submissionCount: v.number(),
        computedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { workspaceId, gaps }) => {
    // Delete old gaps and recommendations (they reference old gap IDs)
    const [oldGaps, oldRecs] = await Promise.all([
      ctx.db.query('trainingGaps').withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId)).collect(),
      ctx.db.query('courseRecommendations').withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId)).collect(),
    ]);
    await Promise.all([
      ...oldGaps.map((g) => ctx.db.delete(g._id)),
      ...oldRecs.filter((r) => r.status !== 'built').map((r) => ctx.db.delete(r._id)),
    ]);
    for (const gap of gaps) await ctx.db.insert('trainingGaps', gap);
    const link = await ctx.db
      .query('analyticsLinks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .first();
    if (link) await ctx.db.patch(link._id, { lastComputedAt: Date.now() });
  },
});

// ── Course recommendations ─────────────────────────────────────────────────

export const generateRecommendations = action({
  args: {
    workspaceId: v.id('workspaces'),
    filterRegion: v.optional(v.string()),
    filterAreaManager: v.optional(v.string()),
    filterProgram: v.optional(v.string()),
    filterStore: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, filterRegion, filterAreaManager, filterProgram, filterStore }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const link = await ctx.runQuery(internal.analytics.getLinkInternal, { workspaceId });
    if (!link) throw new ConvexError('No PI company linked');

    const allGaps = await ctx.runQuery(api.analytics.listGaps, { workspaceId });

    // Apply dimension-based filters first, then pick worst severity available
    let filtered = allGaps as any[];
    if (filterRegion) {
      filtered = filtered.filter((g) => g.dimension !== 'region' || g.dimensionValue === filterRegion);
    }
    if (filterAreaManager) {
      filtered = filtered.filter((g) => g.dimension !== 'areaManager' || g.dimensionValue === filterAreaManager);
    }
    if (filterStore) {
      filtered = filtered.filter((g) => g.dimension !== 'store' || g.dimensionValue === filterStore);
    }
    if (filterProgram) {
      filtered = filtered.filter((g) => g.programName === filterProgram);
    }

    // Try critical+high first, fall back to including medium
    let topGaps = filtered.filter((g) => g.severity === 'critical' || g.severity === 'high');
    if (topGaps.length === 0) {
      topGaps = filtered.filter((g) => g.severity === 'critical' || g.severity === 'high' || g.severity === 'medium');
    }
    if (topGaps.length === 0) {
      throw new ConvexError('No gap data found for the selected filters — try broadening your filter selection');
    }

    topGaps = topGaps.slice(0, 15);

    // Build context for scope description
    const scopeParts: string[] = [];
    if (filterRegion) scopeParts.push(`Region: ${filterRegion}`);
    if (filterAreaManager) scopeParts.push(`Area Manager: ${filterAreaManager}`);
    if (filterStore) scopeParts.push(`Store: ${filterStore}`);
    if (filterProgram) scopeParts.push(`Program: ${filterProgram}`);
    const scopeLabel = scopeParts.length > 0 ? scopeParts.join(', ') : 'all areas (national)';
    const isFiltered = scopeParts.length > 0;

    const dimLabel = (dim: string) =>
      dim === 'region' ? 'Region' : dim === 'areaManager' ? 'Area Manager' : 'Store';

    const gapText = topGaps
      .map(
        (g, i) =>
          `${i}. ${g.programName} — "${g.category}" — ${dimLabel(g.dimension)}: ${g.dimensionValue} — Avg: ${g.avgScore}% vs benchmark ${g.benchmark}% (gap: ${g.gap}%, ${g.severity})`,
      )
      .join('\n');

    // Existing coverage — what this workspace has already authored. Without
    // this the AI re-proposes courses that already exist.
    const inventory: Array<{
      moduleId: Id<'modules'>;
      title: string;
      lessonTitles: string[];
    }> = await ctx.runQuery(internal.analytics.getModuleInventoryInternal, { workspaceId });
    const inventoryText = inventory.length
      ? inventory
          .map(
            (m, i) =>
              `${i}. "${m.title}"${m.lessonTitles.length ? ` — lessons: ${m.lessonTitles.slice(0, 12).join('; ')}` : ' — (no lessons yet)'}`,
          )
          .join('\n')
      : '(none — this workspace has no modules yet)';

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ConvexError('AI not configured — set GROQ_API_KEY in the Convex dashboard');
    const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

    const systemPrompt = `You are an expert learning & development strategist. Given training gap data from retail audit scores, you generate targeted course recommendations.

Return a JSON object: {"recommendations": [...]}

Each recommendation:
{
  "title": "concise course title",
  "rationale": "1-2 sentence explanation of why this course closes the gap",
  "targetAudience": "specific audience e.g. 'Store teams in North region' or 'All area managers'",
  "keyTopics": ["topic 1", "topic 2", "topic 3"],
  "estimatedLessons": 3,
  "priority": 8,
  "gapIndex": 0,
  "level": "national",
  "kind": "new",
  "existingModuleIndex": null,
  "coverageNote": "short note on what already covers this, if anything"
}

Existing coverage:
You are given a numbered list of modules this team has ALREADY authored. Use it:
- Do NOT propose a course that duplicates an existing module.
- If an existing module already addresses the gap but needs more depth or a
  new angle, set "kind": "extend" and "existingModuleIndex" to that module's
  0-based index, and describe the additions in rationale/keyTopics.
- Only set "kind": "new" (with "existingModuleIndex": null) when nothing in
  the list meaningfully covers the gap.
- "coverageNote": one short sentence on what already exists for this gap, or
  "no existing coverage".

Rules:
- Return 4–10 recommendations total
- If the scope is national (no filters), include 2–3 national-level recommendations (level: "national") for cross-cutting issues, then regional and area-manager levels.
- If the scope is filtered (specific region/AM/store/program), generate recommendations focused on that specific scope. Still use level to indicate the best rollout audience: "national" if applicable, "regional", "areaManager", or "store" for targeted ones.
- priority 1–10 (10 = most urgent)
- estimatedLessons 1–6 (micro = 1–3, full course = 3–6)
- keyTopics: 3–5 practical skill topics
- gapIndex: 0-based index linking to the most representative gap in the input list
- Group related gaps into one course where sensible
- Focus on practical, observable skill improvements`;

    const userPrompt = `Company: ${link.piCompanyName}
Benchmark: ${link.benchmarkScore}%
${isFiltered ? `Scope filter: ${scopeLabel}` : ''}

Modules already authored in this workspace (index 0-based):
${inventoryText}

Training gaps (sorted by severity, index 0-based):
${gapText}

Generate targeted course recommendations to close these gaps${isFiltered ? ` for the specified scope (${scopeLabel})` : ''}.`;

    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ConvexError(`AI request failed: ${msg}`);
    }

    if (!res.ok) throw new ConvexError(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ConvexError('AI returned a non-JSON response');
    }
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new ConvexError('Empty AI response');

    let recs: any[];
    try {
      const parsed = JSON.parse(raw) as any;
      recs = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? parsed.courses ?? []);
    } catch {
      throw new ConvexError('AI returned malformed JSON');
    }

    try {
      await ctx.runMutation(internal.analytics.storeRecommendations, {
        workspaceId,
        topGaps,
        recs,
        inventory,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ConvexError(`Failed to save recommendations: ${msg}`);
    }
    return { count: recs.length };
  },
});

export const storeRecommendations = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    topGaps: v.any(),
    recs: v.any(),
    /** Same list shown to the AI — maps existingModuleIndex back to a real id */
    inventory: v.optional(v.any()),
  },
  handler: async (ctx, { workspaceId, topGaps, recs, inventory }) => {
    // Clear old pending/dismissed recs
    const existing = await ctx.db
      .query('courseRecommendations')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    await Promise.all(
      existing.filter((r) => r.status !== 'built').map((r) => ctx.db.delete(r._id)),
    );
    const now = Date.now();
    for (const rec of (recs as any[]).slice(0, 10)) {
      const gap = topGaps[rec.gapIndex ?? 0] as any;
      if (!gap?._id) continue;
      await ctx.db.insert('courseRecommendations', {
        workspaceId,
        gapId: gap._id as Id<'trainingGaps'>,
        title: String(rec.title ?? '').slice(0, 200),
        rationale: String(rec.rationale ?? '').slice(0, 500),
        targetAudience: String(rec.targetAudience ?? '').slice(0, 200),
        keyTopics: Array.isArray(rec.keyTopics) ? (rec.keyTopics as unknown[]).map(String).slice(0, 5) : [],
        estimatedLessons: Math.max(1, Math.min(6, Number(rec.estimatedLessons ?? 3))),
        priority: Math.max(1, Math.min(10, Number(rec.priority ?? 5))),
        audienceLevel:
          rec.level === 'national'
            ? 'national'
            : rec.level === 'areaManager'
              ? 'areaManager'
              : rec.level === 'store'
                ? 'store'
                : 'regional',
        status: 'pending',
        ...resolveCoverage(rec, inventory),
        createdAt: now,
      });
    }
  },
});

/**
 * Map the AI's `existingModuleIndex` back to a real module id. The index is
 * only trusted when it lands on a real inventory row — a hallucinated index
 * degrades to a plain "new" recommendation rather than a broken link.
 */
function resolveCoverage(
  rec: { kind?: unknown; existingModuleIndex?: unknown; coverageNote?: unknown },
  inventory: unknown,
): { kind?: 'new' | 'extend'; extendsModuleId?: Id<'modules'>; coverageNote?: string } {
  const list = Array.isArray(inventory)
    ? (inventory as Array<{ moduleId: Id<'modules'> }>)
    : [];
  const idx = Number(rec.existingModuleIndex);
  const target =
    rec.kind === 'extend' && Number.isInteger(idx) && idx >= 0 && idx < list.length
      ? list[idx]
      : null;

  const note =
    typeof rec.coverageNote === 'string' && rec.coverageNote.trim()
      ? rec.coverageNote.trim().slice(0, 300)
      : undefined;

  return target
    ? { kind: 'extend', extendsModuleId: target.moduleId, coverageNote: note }
    : { kind: 'new', coverageNote: note };
}

export const listRecommendations = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const recs = await ctx.db
      .query('courseRecommendations')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    const active = recs
      .filter((r) => r.status !== 'dismissed')
      .sort((a, b) => b.priority - a.priority);
    // Join with gap to get dimension value and program name for grouping
    return await Promise.all(
      active.map(async (rec) => {
        const gap = await ctx.db.get(rec.gapId).catch(() => null);
        return {
          ...rec,
          gapDimension: gap?.dimension ?? null,
          gapDimensionValue: gap?.dimensionValue ?? null,
          gapProgramName: gap?.programName ?? null,
        };
      }),
    );
  },
});

export const getRecommendation = query({
  args: { recId: v.id('courseRecommendations') },
  handler: async (ctx, { recId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(recId);
  },
});

export const dismissRecommendation = mutation({
  args: { recId: v.id('courseRecommendations') },
  handler: async (ctx, { recId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');
    await ctx.db.patch(recId, { status: 'dismissed' });
  },
});

// ── Build module from recommendation ──────────────────────────────────────

export const getRecInternal = internalQuery({
  args: { recId: v.id('courseRecommendations') },
  handler: async (ctx, { recId }) => {
    const rec = await ctx.db.get(recId);
    if (!rec) return null;
    const gap = await ctx.db.get(rec.gapId).catch(() => null);
    return { rec, gap };
  },
});

export const setRecStatus = internalMutation({
  args: {
    recId: v.id('courseRecommendations'),
    status: v.union(
      v.literal('pending'),
      v.literal('building'),
      v.literal('built'),
      v.literal('dismissed'),
    ),
  },
  handler: async (ctx, { recId, status }) => ctx.db.patch(recId, { status }),
});

export const setRecBuilt = internalMutation({
  args: {
    recId: v.id('courseRecommendations'),
    moduleId: v.id('modules'),
  },
  handler: async (ctx, { recId, moduleId }) =>
    ctx.db.patch(recId, { status: 'built', moduleId }),
});

export const buildModuleFromRecommendation: ReturnType<typeof action> = action({
  args: {
    recId: v.id('courseRecommendations'),
    workspaceId: v.id('workspaces'),
    moduleType: v.union(v.literal('microLearning'), v.literal('course')),
    extraContext: v.optional(v.string()),
  },
  handler: async (ctx, { recId, workspaceId, moduleType, extraContext }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const result = await ctx.runQuery(internal.analytics.getRecInternal, { recId });
    if (!result) throw new ConvexError('Recommendation not found');
    const { rec, gap } = result as { rec: any; gap: any };

    const gapContext = (gap as any)
      ? `\n\nAudit gap context: ${(gap as any).programName} program — "${(gap as any).category}" category — ${(gap as any).dimension === 'region' ? 'Region' : 'Area Manager'}: ${(gap as any).dimensionValue} — Average score: ${(gap as any).avgScore}% vs benchmark ${(gap as any).benchmark}% (gap: ${(gap as any).gap}%, severity: ${(gap as any).severity})`
      : '';

    await ctx.runMutation(internal.analytics.setRecStatus, { recId, status: 'building' });

    try {
      const moduleId: string = await ctx.runAction(api.ai.generateModule, {
        workspaceId,
        name: (rec as any).title as string,
        type: moduleType,
        objective: `${(rec as any).rationale as string}${gapContext}`,
        description: `Target audience: ${(rec as any).targetAudience as string}. Key topics to cover: ${((rec as any).keyTopics as string[]).join(', ')}.${extraContext ? `\n\nAdditional context from author: ${extraContext}` : ''}`,
        sourceText: undefined,
      });

      await ctx.runMutation(internal.analytics.setRecBuilt, {
        recId,
        moduleId: moduleId as Id<'modules'>,
      });

      await ctx.runMutation(internal.notifications.createForUser, {
        userId,
        kind: 'ai_module_built',
        title: 'AI module ready',
        body: `"${(rec as any).title as string}" has been created and is ready to edit.`,
        workspaceId,
        moduleId: moduleId as Id<'modules'>,
      });

      return moduleId;
    } catch (err) {
      await ctx.runMutation(internal.analytics.setRecStatus, { recId, status: 'pending' });
      throw err;
    }
  },
});
