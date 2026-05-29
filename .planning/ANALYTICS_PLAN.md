# Analytics Intelligence Layer — Architecture Plan

> **Feature:** Connect Prism Intelligence audit data → analyze training gaps by brand/region/area manager → AI-powered course recommendations → one-click AI module generation.

---

## 1. What We're Building

```
Prism Intelligence (audit scores)
        │
        ▼
[PI Data Bridge]          ← Convex action (same-deployment query OR HTTP fetch)
        │
        ▼
[Gap Analyzer]            ← Convex action: avg scores by brand/region/area, benchmark comparison
        │
        ▼
[trainingGaps table]      ← Persisted, queryable gap records with severity & priority
        │
        ▼
[AI Recommender]          ← OpenAI GPT-4o: generate course recommendation cards from gaps
        │
        ▼
[courseRecommendations]   ← Stored recommendation records per workspace
        │
        ▼
[AI Module Builder]       ← Existing ai.ts pipeline, enriched with gap + brand context
        │
        ▼
[modules table]           ← Standard Prism Learning module, ready to edit & export
```

The author experience:
1. Opens the **Analytics** section of their workspace
2. Sees a live gap dashboard (critical/high/medium issues by brand, region, area manager)
3. Clicks **"Suggest courses"** → AI analyzes top gaps and generates recommended course titles with rationale
4. Clicks **"Build with AI"** on a recommendation → AI generates complete module outline + block content
5. Module lands in their workspace, ready to edit, theme, and export

---

## 2. Critical Open Questions

> **These must be answered before implementation begins.** Document answers in this file.

### Q1: Same or separate Convex deployment?

| Option | Description | Bridge strategy |
|--------|-------------|-----------------|
| **A — Same deployment** | Both PI and PL share one `CONVEX_URL` | Direct `ctx.db.query()` on PI tables |
| **B — Separate deployments** | Different Convex projects/URLs | HTTP action calling PI's exposed endpoint |

**Recommendation:** If at all possible, run on the same deployment. It's zero latency, no auth complexity, and no rate limits.

**Answer needed from user:** _Which deployment setup is in use?_

### Q2: Prism Intelligence schema

The gap analyzer needs to read audit records. Need the exact table name(s) and field names from PI.

**Minimum viable mapping (what PL needs to read):**

| PL needs | PI table field |
|----------|---------------|
| Brand name | ? |
| Region name | ? |
| Area manager name | ? |
| Store / location name | ? |
| Audit category name | ? |
| Score (0–100) | ? |
| Audit date | ? |
| Pass/fail status | ? |

**Answer needed from user:** _Share the PI `schema.ts` or describe the tables/fields._

### Q3: Benchmark scores

Gap analysis compares actual scores against a benchmark threshold. Common defaults:
- Critical: score < 60
- High: 60–70
- Medium: 70–80
- Low: 80–90

**Question:** Are there per-category benchmarks in PI, or should PL use a single configurable threshold?

### Q4: Scope of AI module generation

| Level | What AI does |
|-------|-------------|
| **Recommendations only** | AI suggests titles, rationale, target audience |
| **Outline** | AI adds lesson structure (titles, block types) |
| **Full content** | AI generates complete block content (richText HTML, MCQ JSON, T/F JSON) — like existing `generateFromTopic` |

**Recommendation:** Full content (level 3), consistent with what `convex/ai.ts` already does.

---

## 3. Architecture Decisions (Made Autonomously)

### 3A. Deployment Bridge

Design a **bridge abstraction** that works for both same and separate deployments:

```typescript
// convex/analytics/bridge.ts
// If same deployment: reads PI tables directly
// If different deployment: calls PI HTTP endpoint
// Configured via PRISM_INTELLIGENCE_MODE env var ("local" | "remote")
// If "remote": PRISM_INTELLIGENCE_URL + PRISM_INTELLIGENCE_API_KEY env vars
```

Ship **local mode first** (same deployment). Remote mode is an extension point.

### 3B. AI Provider

**OpenAI GPT-4o** — already used in `convex/ai.ts` via `OPENAI_API_KEY`. The recommendations + module generation both call the same provider.

### 3C. Gap Analysis Granularity

Analyze at 3 dimensions simultaneously:
- **Brand level** — all audits for brand B (aggregate)
- **Region level** — all audits for brand B, region R
- **Area manager level** — all audits under area manager A

The UI lets the user pivot between these views.

### 3D. Caching / Freshness

- **Audit data** is synced on-demand (user clicks "Refresh") OR on a scheduled basis (Convex cron every 24h)
- **Gap analysis** is recomputed after each sync
- **Recommendations** are stored and only regenerated when the user requests it
- This avoids hammering the PI database or OpenAI on every page load

### 3E. Recommendation lifecycle

```
pending → building → built
              ↘
           dismissed
```

Once `built`, a `moduleId` is stored on the recommendation so the user can jump directly to the generated module.

---

## 4. New Convex Schema

```typescript
// convex/schema.ts additions

// ── Analytics ──────────────────────────────────────────────────────────────

analyticsConnections: defineTable({
  workspaceId: v.id('workspaces'),
  mode: v.union(v.literal('local'), v.literal('remote')),
  // Remote mode only
  remoteUrl: v.optional(v.string()),
  // Field mapping: what PI calls each concept
  fieldMap: v.object({
    brand: v.string(),       // e.g. "brand" or "brandName"
    region: v.string(),      // e.g. "region"
    areaManager: v.string(), // e.g. "areaManager" or "am_name"
    store: v.string(),       // e.g. "storeName" or "outlet"
    category: v.string(),    // e.g. "category" or "sectionName"
    score: v.string(),       // e.g. "score" or "percentage"
    auditDate: v.string(),   // e.g. "auditDate" or "visitDate"
  }),
  benchmarkScore: v.number(), // default 75 — scores below this are gaps
  lastSyncAt: v.optional(v.number()),
  createdAt: v.number(),
}).index('by_workspace', ['workspaceId']),

auditSnapshots: defineTable({
  connectionId: v.id('analyticsConnections'),
  workspaceId: v.id('workspaces'),
  brand: v.string(),
  region: v.string(),
  areaManager: v.string(),
  category: v.string(),
  avgScore: v.number(),
  minScore: v.number(),
  maxScore: v.number(),
  auditCount: v.number(),
  periodStart: v.number(),
  periodEnd: v.number(),
  syncedAt: v.number(),
})
  .index('by_workspace', ['workspaceId'])
  .index('by_connection', ['connectionId']),

trainingGaps: defineTable({
  workspaceId: v.id('workspaces'),
  brand: v.string(),
  region: v.optional(v.string()),
  areaManager: v.optional(v.string()),
  dimension: v.union(
    v.literal('brand'),
    v.literal('region'),
    v.literal('areaManager'),
  ),
  category: v.string(),
  avgScore: v.number(),
  benchmark: v.number(),
  gap: v.number(),           // benchmark - avgScore (positive = below benchmark)
  severity: v.union(
    v.literal('critical'),   // gap > 20
    v.literal('high'),       // gap 15-20
    v.literal('medium'),     // gap 10-15
    v.literal('low'),        // gap 5-10
  ),
  affectedAudits: v.number(),
  computedAt: v.number(),
})
  .index('by_workspace', ['workspaceId'])
  .index('by_workspace_severity', ['workspaceId', 'severity']),

courseRecommendations: defineTable({
  workspaceId: v.id('workspaces'),
  gapId: v.id('trainingGaps'),
  title: v.string(),
  rationale: v.string(),       // why this course addresses the gap
  targetAudience: v.string(),  // e.g. "Area managers in Mumbai region"
  keyTopics: v.array(v.string()),
  estimatedLessons: v.number(),
  priority: v.number(),        // 1–10
  status: v.union(
    v.literal('pending'),
    v.literal('building'),
    v.literal('built'),
    v.literal('dismissed'),
  ),
  moduleId: v.optional(v.id('modules')),
  generatedByAI: v.boolean(),
  createdAt: v.number(),
})
  .index('by_workspace', ['workspaceId'])
  .index('by_workspace_status', ['workspaceId', 'status']),
```

---

## 5. New Convex Functions

### 5A. `convex/analytics.ts` — queries & mutations

```
analyticsConnections.get(workspaceId)     query  → connection config or null
analyticsConnections.upsert(...)          mutation → save connection settings
auditData.sync(workspaceId)               action  → fetch PI data → write auditSnapshots
gaps.compute(workspaceId)                 action  → read snapshots → write trainingGaps
gaps.list(workspaceId, opts)              query   → gaps filtered by dimension/severity
recommendations.generate(workspaceId)    action  → call GPT-4o → write courseRecommendations
recommendations.list(workspaceId)         query   → pending/active recommendations
recommendations.dismiss(recId)            mutation
recommendations.buildWithAI(recId)        action  → enrich gap context → call existing ai.ts pipeline
```

### 5B. Key Prompt: Gap → Recommendation

```
SYSTEM:
You are an expert L&D strategist. Given audit performance gaps for a retail/hospitality brand,
generate prioritized course recommendations that directly address the training deficiencies.

For each gap, produce a JSON object:
{
  "title": "Course title (action-oriented, specific)",
  "rationale": "2-3 sentences on how this course closes the gap",
  "targetAudience": "Who specifically needs this (role + region/brand)",
  "keyTopics": ["topic 1", "topic 2", "topic 3"],
  "estimatedLessons": 3,
  "priority": 8
}

CONTEXT INJECTED:
- Brand: {brand}
- Region: {region}
- Category: {category}
- Average score: {avgScore}%
- Benchmark: {benchmark}%
- Gap: {gap} points below benchmark
- Number of audits affected: {count}
- Severity: {severity}
```

### 5C. Key Prompt: Recommendation → Full Module

The existing `buildSystemPrompt()` in `ai.ts` is reused, but with an **analytics prefix** injected into the user message:

```
[Analytics Context]
This course addresses a training gap identified from {count} audits across {brand}.
Category: {category} is scoring {avgScore}% against a {benchmark}% benchmark.
Target audience: {targetAudience}.
Focus the content on practical, field-applicable skills that directly improve {category} scores.

[Module Objective]
{recommendation.title}
```

---

## 6. New UI — Analytics Section

### Routes

```
/w/:workspaceId/analytics              → Analytics landing / gap dashboard
/w/:workspaceId/analytics/settings     → PI connection configuration
```

### Pages

#### `/analytics` — Gap Dashboard

```
┌─────────────────────────────────────────────────────┐
│  Analytics                          [Refresh] [Settings]
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Critical │  │  High    │  │  Medium  │           │
│  │    4     │  │    7     │  │   12     │           │
│  └──────────┘  └──────────┘  └──────────┘          │
├─────────────────────────────────────────────────────┤
│  View by: [Brand ▼]  [Region ▼]  [Area Manager ▼]  │
├─────────────────────────────────────────────────────┤
│  Brand: Taj Hotels                                   │
│  ■ Customer Service Standards    48%  ━━━ -27pts    │
│  ■ Food Safety Compliance        61%  ━━━ -14pts    │
│  ■ Check-in Experience           65%  ━━━ -10pts    │
│                                                     │
│  Brand: ITC Fortune                                  │
│  ■ Housekeeping Standards        55%  ━━━ -20pts    │
│  ...                                                 │
├─────────────────────────────────────────────────────┤
│               [Suggest courses →]                    │
└─────────────────────────────────────────────────────┘
```

#### `/analytics` → Recommendations Panel (drawer or tab)

```
┌─────────────────────────────────────────────────────┐
│  Recommended Courses                     [Generate more]
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐│
│  │ 🔴 CRITICAL                                      ││
│  │ "Mastering Customer Service Standards"           ││
│  │ Addresses 27pt gap in Customer Service for Taj  ││
│  │ Target: Floor managers, Taj Hotels               ││
│  │ 3 lessons · 4 key topics                        ││
│  │                                                  ││
│  │           [Build manually]  [Build with AI →]   ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

#### AI Build Dialog

```
┌──────────────────────────────────────┐
│  Build "Mastering Customer Service"  │
│  with AI                             │
├──────────────────────────────────────┤
│  Type:  ○ Micro (5-10 min)           │
│         ● Course (20-40 min)         │
│                                      │
│  Extra context (optional):           │
│  ┌────────────────────────────────┐  │
│  │ Any specific focus or hotel    │  │
│  │ standards to emphasize...      │  │
│  └────────────────────────────────┘  │
│                                      │
│            [Cancel]  [Generate →]    │
└──────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase A: Data Bridge + Gap Analysis
**Goal:** PI data is flowing into PL, gaps are computed and visible.

Tasks:
1. Add new tables to `convex/schema.ts`
2. Create `convex/analytics.ts` (bridge, sync action, gap computation, queries)
3. Add Analytics nav item in workspace sidebar
4. Build gap dashboard page (no recommendations yet — just the gap visualization)
5. Build settings page (field mapping, benchmark threshold, mode selection)

### Phase B: AI Recommendations
**Goal:** AI recommends courses to build, user can browse and action them.

Tasks:
1. `recommendations.generate` action (OpenAI call with gap context)
2. Recommendation cards UI with priority/severity colors
3. "Suggest courses" flow from gap dashboard
4. Dismiss / snooze recommendations

### Phase C: AI Module Builder from Recommendation
**Goal:** "Build with AI" generates a complete module pre-populated with gap context.

Tasks:
1. Enrich the `buildSystemPrompt` / user message with analytics context
2. New `buildFromRecommendation` action that calls the existing AI pipeline
3. Build dialog (type selector, extra context field)
4. Auto-navigate to generated module after completion
5. Mark recommendation as `built`, link `moduleId`

---

## 8. Security Considerations

- PI data access must be **workspace-scoped** — no leakage between workspaces
- If remote mode: `PRISM_INTELLIGENCE_API_KEY` stored as Convex environment variable, never client-exposed
- Field mapping config stored server-side (analyticsConnections), not in client bundle
- Gap and recommendation queries enforce workspace membership via `checkMembership`
- OpenAI calls stay in Convex actions (server-side) — API key never reaches the browser

---

## 9. Answer Tracker

| Question | Status | Answer |
|----------|--------|--------|
| Same or separate Convex deployment? | ❓ Open | |
| PI table name(s) | ❓ Open | |
| PI field: brand | ❓ Open | |
| PI field: region | ❓ Open | |
| PI field: area manager | ❓ Open | |
| PI field: category | ❓ Open | |
| PI field: score | ❓ Open | |
| PI field: audit date | ❓ Open | |
| Per-category benchmarks or single threshold? | ❓ Open | |

> Fill this table before Phase A implementation begins. The field mapping can also be configured in-app via the Settings page (so it doesn't block Phase A skeleton work).

---

## 10. What Can Start Now (Before Answers)

Even without the PI schema, we can build the full UI shell and Convex functions:
- Schema additions (fieldMap is string→string so it's schema-agnostic)
- Settings page (configures the field mapping at runtime)
- Gap dashboard page (shell, connects once data flows)
- Recommendation cards UI
- AI build dialog

The **bridge connection** needs the field mapping (answered at runtime in the settings page), so the only blocker is confirming **same vs. separate deployment** — which determines whether the bridge uses `ctx.db.query()` on PI tables or an HTTP fetch.
