/**
 * Analytics layer — bridges Prism Intelligence (PI) audit data to Prism Learning (PL).
 *
 * PI and PL are SEPARATE Convex deployments on the same team. PI tables are NOT
 * accessible via ctx.db from PL. All PI data is fetched via Convex's HTTP API:
 *   POST {PI_CONVEX_URL}/api/query  { path, args: { apiToken, ...rest } }
 *
 * Required env vars in the PL Convex dashboard:
 *   PI_CONVEX_URL  — PI deployment URL, e.g. https://abc123.convex.cloud
 *   PI_API_TOKEN   — static token accepted by PI's validateRequest() guard
 */
import { v, ConvexError } from 'convex/values';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal, api } from './_generated/api';
import type { Id } from './_generated/dataModel';

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

// ── Auth helper ────────────────────────────────────────────────────────────

async function requireMember(ctx: any, workspaceId: Id<'workspaces'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Not authenticated');
  const member = await ctx.db
    .query('memberships')
    .withIndex('by_workspace', (q: any) => q.eq('workspaceId', workspaceId))
    .filter((q: any) => q.eq(q.field('userId'), userId))
    .first();
  if (!member) throw new Error('Not a workspace member');
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
 * Validate that a given PI company ID is reachable with the configured env
 * vars. Returns program and store counts on success; throws on failure.
 */
export const validatePICompany = action({
  args: { piCompanyId: v.string() },
  handler: async (ctx, { piCompanyId }): Promise<{ programCount: number; storeCount: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const piUrl = (process.env.PI_CONVEX_URL ?? '').replace(/\/+$/, '');
    const piToken = process.env.PI_API_TOKEN;
    if (!piUrl || !piToken)
      throw new Error(
        'PI_CONVEX_URL and PI_API_TOKEN must be set as environment variables in the Convex dashboard',
      );

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
    };
  },
});

// ── Workspace ↔ PI company link ────────────────────────────────────────────

export const linkCompany = mutation({
  args: {
    workspaceId: v.id('workspaces'),
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
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        piCompanyId: args.piCompanyId,
        piCompanyName: args.piCompanyName,
        benchmarkScore: args.benchmarkScore,
        lookbackDays: args.lookbackDays,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert('analyticsLinks', {
      workspaceId: args.workspaceId,
      piCompanyId: args.piCompanyId,
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
    if (!link) throw new Error('No analytics link found');
    await ctx.db.patch(link._id, { benchmarkScore, lookbackDays, updatedAt: Date.now() });
  },
});

// ── Gap queries ────────────────────────────────────────────────────────────

export const listGaps = query({
  args: {
    workspaceId: v.id('workspaces'),
    dimension: v.optional(v.union(v.literal('region'), v.literal('areaManager'))),
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
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not authenticated');

    const link = await ctx.runQuery(internal.analytics.getLinkInternal, { workspaceId });
    if (!link) throw new ConvexError('No PI company linked — connect Prism Intelligence first');

    const piUrl = (process.env.PI_CONVEX_URL ?? '').replace(/\/+$/, '');
    const piToken = process.env.PI_API_TOKEN;
    if (!piUrl || !piToken)
      throw new ConvexError(
        'PI_CONVEX_URL and PI_API_TOKEN must be set as environment variables in the Convex dashboard',
      );

    const since = Date.now() - link.lookbackDays * 24 * 60 * 60 * 1000;

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

    // Exclude drafts; require a percentage score; limit to the lookback window
    const submissions = (Array.isArray(rawSubmissions) ? (rawSubmissions as PISubmission[]) : []).filter(
      (s) =>
        s.status !== 'draft' &&
        s.percentage != null &&
        (s.submittedAt == null || s.submittedAt >= since),
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

      // stores:list from PI hydrates regionName via a region join
      const regionName = store.regionName?.trim() || store.city?.trim() || 'Unknown Region';
      const amName = store.amName?.trim() || 'Unassigned';
      const dims = [
        ['region', regionName],
        ['areaManager', amName],
      ] as const;

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

    const benchmark = link.benchmarkScore;
    type GapRecord = {
      workspaceId: Id<'workspaces'>;
      piCompanyId: string;
      dimension: 'region' | 'areaManager';
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
      if (e.count < 2) continue;
      const avg = Math.round((e.sum / e.count) * 10) / 10;
      const gap = Math.round((benchmark - avg) * 10) / 10;
      if (gap < 2) continue;
      const severity: GapRecord['severity'] =
        gap > 25 ? 'critical' : gap > 15 ? 'high' : gap > 8 ? 'medium' : 'low';
      gaps.push({
        workspaceId,
        piCompanyId: link.piCompanyId,
        dimension: e.dimension as 'region' | 'areaManager',
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
    return { gapCount: topGaps.length, submissionCount: processed };
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
        dimension: v.union(v.literal('region'), v.literal('areaManager')),
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
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const link = await ctx.runQuery(internal.analytics.getLinkInternal, { workspaceId });
    if (!link) throw new Error('No PI company linked');

    const allGaps = await ctx.runQuery(api.analytics.listGaps, { workspaceId });
    const topGaps = (allGaps as any[])
      .filter((g) => g.severity === 'critical' || g.severity === 'high')
      .slice(0, 12);
    if (topGaps.length === 0) throw new Error('No critical or high gaps found to address');

    const gapText = topGaps
      .map(
        (g, i) =>
          `${i}. ${g.programName} — "${g.category}" — ${g.dimension === 'region' ? 'Region' : 'Area Manager'}: ${g.dimensionValue} — Avg: ${g.avgScore}% vs benchmark ${g.benchmark}% (gap: ${g.gap}%, ${g.severity})`,
      )
      .join('\n');

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('AI not configured — set GROQ_API_KEY in the Convex dashboard');
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
  "gapIndex": 0
}

Rules:
- Return 5–8 recommendations targeting the highest-impact gaps
- priority 1–10 (10 = most urgent)
- estimatedLessons 1–6 (micro = 1–3, full course = 3–6)
- keyTopics: 3–5 practical skill topics
- gapIndex: 0-based index linking to the input gap list
- Group related gaps into one course where sensible
- Focus on practical, observable skill improvements`;

    const userPrompt = `Company: ${link.piCompanyName}
Benchmark: ${link.benchmarkScore}%

Training gaps (sorted by severity, index 0-based):
${gapText}

Generate targeted course recommendations to close these gaps.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');

    let recs: any[];
    try {
      const parsed = JSON.parse(raw) as any;
      recs = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? parsed.courses ?? []);
    } catch {
      throw new Error('AI returned malformed JSON');
    }

    await ctx.runMutation(internal.analytics.storeRecommendations, {
      workspaceId,
      topGaps,
      recs,
    });
    return { count: recs.length };
  },
});

export const storeRecommendations = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    topGaps: v.any(),
    recs: v.any(),
  },
  handler: async (ctx, { workspaceId, topGaps, recs }) => {
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
        status: 'pending',
        createdAt: now,
      });
    }
  },
});

export const listRecommendations = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const recs = await ctx.db
      .query('courseRecommendations')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();
    return recs
      .filter((r) => r.status !== 'dismissed')
      .sort((a, b) => b.priority - a.priority);
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
    if (!userId) throw new Error('Not authenticated');
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
    if (!userId) throw new Error('Not authenticated');

    const result = await ctx.runQuery(internal.analytics.getRecInternal, { recId });
    if (!result) throw new Error('Recommendation not found');
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
      return moduleId;
    } catch (err) {
      await ctx.runMutation(internal.analytics.setRecStatus, { recId, status: 'pending' });
      throw err;
    }
  },
});
