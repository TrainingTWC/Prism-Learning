import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

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

  // ── Phase 3: authoring data model ──────────────────────────────────────

  modules: defineTable({
    workspaceId: v.id('workspaces'),
    title: v.string(),
    status: v.union(v.literal('draft'), v.literal('published')),
    /** Soft-delete: present means deleted */
    deletedAt: v.optional(v.number()),
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
});
