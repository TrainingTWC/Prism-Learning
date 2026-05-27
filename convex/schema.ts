import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Skeleton schema. Phase 1 fleshes out auth/workspaces;
// Phase 3 adds modules/lessons/blocks; Phase 4 adds assets.
export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id('users'),
    createdAt: v.number(),
  }),

  memberships: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('editor')),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_user', ['userId']),

  // `users` is provided by @convex-dev/auth; declared here only for typing reference.
  // Real users table comes from auth tables — do not duplicate.
});
