import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  employeeProfiles: defineTable({
    email: v.string(),
    employeeId: v.string(),
    companyCode: v.string(),
    userId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_user', ['userId']),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id('users'),
    createdAt: v.number(),
    /** Phase 6 theming — optional so existing rows stay valid */
    theme: v.optional(v.object({
      primary: v.string(),
      accent: v.string(),
      headingFont: v.string(),
      bodyFont: v.string(),
      correct: v.optional(v.string()),
      incorrect: v.optional(v.string()),
      headingTextColor: v.optional(v.string()),
      bodyTextColor: v.optional(v.string()),
      headingSize: v.optional(v.string()),
      headingWeight: v.optional(v.string()),
      bodySize: v.optional(v.string()),
      lineHeight: v.optional(v.string()),
      borderRadius: v.optional(v.string()),
      buttonStyle: v.optional(v.string()),
    })),
  }),

  memberships: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('editor')),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_user', ['userId']),

  pendingInvites: defineTable({
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.id('users'),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_email', ['email']),

  notifications: defineTable({
    userId: v.id('users'),
    kind: v.union(
      v.literal('workspace_invite_sent'),
      v.literal('workspace_joined'),
      v.literal('ai_module_built'),
    ),
    title: v.string(),
    body: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    moduleId: v.optional(v.id('modules')),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_createdAt', ['userId', 'createdAt']),

  // ── Phase 3: authoring data model ──────────────────────────────────────

  modules: defineTable({
    workspaceId: v.id('workspaces'),
    title: v.string(),
    status: v.union(v.literal('draft'), v.literal('published')),
    /** Soft-delete: present means deleted */
    deletedAt: v.optional(v.number()),
    /** Convex storage id of the per-module AI image style reference, if set */
    styleReferenceStorageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastEditedBy: v.id('users'),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_updated', ['workspaceId', 'updatedAt']),

  lessons: defineTable({
    moduleId: v.id('modules'),
    title: v.string(),
    /** Float order for gapless reorder without renumbering siblings */
    order: v.number(),
    createdAt: v.number(),
  }).index('by_module', ['moduleId']),

  blocks: defineTable({
    lessonId: v.id('lessons'),
    /** Denormalized for single-subscription aggregate query */
    moduleId: v.id('modules'),
    type: v.union(
      v.literal('richText'),
      v.literal('image'),
      v.literal('video'),
      v.literal('lottie'),
      v.literal('mcq'),
      v.literal('trueFalse'),
      v.literal('accordion'),
      v.literal('quote'),
      v.literal('callout'),
      v.literal('divider'),
      v.literal('flashcard'),
      v.literal('process'),
      v.literal('tabs'),
      v.literal('button'),
      v.literal('customHtml'),
      // Media
      v.literal('hotspots'),
      v.literal('gallery'),
      v.literal('compare'),
      v.literal('audio'),
      // Interactive
      v.literal('labeledGraphic'),
      v.literal('matching'),
      v.literal('sorting'),
      v.literal('fillBlanks'),
      v.literal('revealCards'),
      // Scenario
      v.literal('scenario'),
    ),
    order: v.number(),
    /**
     * Serialized block payload (JSON string for media blocks, HTML for richText):
     *  richText  → HTML string
     *  image     → { storageId, altText, caption }
     *  video     → { src: string, srcType: 'embed'|'storage', caption }
     *  lottie    → { storageId, loop: boolean, autoplay: boolean }
     */
    content: v.optional(v.string()),
    updatedAt: v.number(),
    lastEditedBy: v.optional(v.id('users')),
  })
    .index('by_lesson', ['lessonId'])
    .index('by_module', ['moduleId']),

  /** Ephemeral — upserted on every keystroke, TTL-reaped */
  presence: defineTable({
    userId: v.id('users'),
    moduleId: v.id('modules'),
    lastSeen: v.number(),
    displayName: v.string(),
    /** Which lesson the cursor is in */
    activeLessonId: v.optional(v.id('lessons')),
  })
    .index('by_module', ['moduleId'])
    .index('by_user_module', ['userId', 'moduleId']),

  // ── Analytics layer ─────────────────────────────────────────────────────

  /** Links a PA workspace to a Prism Intelligence company */
  analyticsLinks: defineTable({
    workspaceId: v.id('workspaces'),
    companyCode: v.optional(v.string()),
    /** PI company _id stored as string (cross-deployment reference) */
    piCompanyId: v.string(),
    piCompanyName: v.string(),
    /** Score below which a category is considered a gap (default 75) */
    benchmarkScore: v.number(),
    /** How far back to pull submissions in days (default 90) */
    lookbackDays: v.number(),
    lastComputedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workspace', ['workspaceId']),

  /** Materialized gap analysis results — recomputed on demand */
  trainingGaps: defineTable({
    workspaceId: v.id('workspaces'),
    piCompanyId: v.string(),
    /** Geographic or management dimension */
    dimension: v.union(v.literal('region'), v.literal('areaManager'), v.literal('store')),
    /** Region name, area manager name, or store name */
    dimensionValue: v.string(),
    /** Program section title, or "Overall" for the overall program score */
    category: v.string(),
    programName: v.string(),
    avgScore: v.number(),
    benchmark: v.number(),
    /** benchmark - avgScore (positive = below benchmark) */
    gap: v.number(),
    severity: v.union(
      v.literal('critical'), // gap > 25
      v.literal('high'),     // gap 15–25
      v.literal('medium'),   // gap 8–15
      v.literal('low'),      // gap 2–8
    ),
    submissionCount: v.number(),
    computedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_severity', ['workspaceId', 'severity'])
    .index('by_workspace_dimension', ['workspaceId', 'dimension']),

  /** AI-generated course recommendations derived from training gaps */
  courseRecommendations: defineTable({
    workspaceId: v.id('workspaces'),
    gapId: v.id('trainingGaps'),
    title: v.string(),
    rationale: v.string(),
    targetAudience: v.string(),
    keyTopics: v.array(v.string()),
    estimatedLessons: v.number(),
    /** 1–10, higher = more urgent */
    priority: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('building'),
      v.literal('built'),
      v.literal('dismissed'),
    ),
    moduleId: v.optional(v.id('modules')),
    /** Audience scope returned by the AI: national, regional, area-manager, or store level */
    audienceLevel: v.optional(
      v.union(v.literal('national'), v.literal('regional'), v.literal('areaManager'), v.literal('store')),
    ),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_status', ['workspaceId', 'status']),
});
