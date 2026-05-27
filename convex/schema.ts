import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

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

  pendingInvites: defineTable({
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.id('users'),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_email', ['email']),
});
