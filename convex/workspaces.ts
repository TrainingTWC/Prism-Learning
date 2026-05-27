import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/** List all workspaces the current user is a member of. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const workspaces = await Promise.all(memberships.map((m) => ctx.db.get(m.workspaceId)));

    const results = workspaces.map((ws, i) =>
      ws ? { ...ws, role: memberships[i]!.role } : null,
    );
    return results.filter((ws): ws is NonNullable<typeof ws> => ws !== null);
  },
});

/** Get a single workspace by ID (must be a member). */
export const getById = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (!membership) return null;

    const ws = await ctx.db.get(workspaceId);
    return ws ? { ...ws, role: membership.role } : null;
  },
});

/** Create a workspace and add the creator as owner. */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const wsId = await ctx.db.insert('workspaces', {
      name: name.trim(),
      ownerId: userId,
      createdAt: Date.now(),
    });

    await ctx.db.insert('memberships', {
      workspaceId: wsId,
      userId,
      role: 'owner',
    });

    return wsId;
  },
});

/** Rename a workspace (owner only). */
export const rename = mutation({
  args: { workspaceId: v.id('workspaces'), name: v.string() },
  handler: async (ctx, { workspaceId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const ws = await ctx.db.get(workspaceId);
    if (!ws) throw new Error('Not found');
    if (ws.ownerId !== userId) throw new Error('Only the workspace owner can rename it');

    await ctx.db.patch(workspaceId, { name: name.trim() });
  },
});

/** Save theme for a workspace (any member). */
export const upsertTheme = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    theme: v.object({
      primary: v.string(),
      accent: v.string(),
      headingFont: v.string(),
      bodyFont: v.string(),
    }),
  },
  handler: async (ctx, { workspaceId, theme }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (!membership) throw new Error('Not a member');

    await ctx.db.patch(workspaceId, { theme });
  },
});
