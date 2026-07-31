import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal } from './_generated/api';

/** How long a deleted workspace stays recoverable before the daily purge cron removes it for good. */
export const WORKSPACE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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
      ws && !ws.deletedAt ? { ...ws, role: memberships[i]!.role } : null,
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
    return ws && !ws.deletedAt ? { ...ws, role: membership.role } : null;
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

    const trimmed = name.trim();
    if (!trimmed) throw new Error('Workspace name cannot be empty');

    await ctx.db.patch(workspaceId, { name: trimmed });
  },
});

/**
 * Soft-delete a workspace (owner only). Mirrors modules.softDelete: sets
 * deletedAt and stops here — memberships, modules, lessons, blocks, and the
 * analytics tables are left in place rather than cascade-deleted. Given the
 * blast radius (this can hide months of authored content in one call), the
 * caller must echo the workspace's exact current name back as confirmName;
 * this is enforced server-side, not just as a client-side UI gate, so the
 * check can't be bypassed by calling the mutation directly.
 */
export const remove = mutation({
  args: { workspaceId: v.id('workspaces'), confirmName: v.string() },
  handler: async (ctx, { workspaceId, confirmName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const ws = await ctx.db.get(workspaceId);
    if (!ws || ws.deletedAt) throw new Error('Not found');
    if (ws.ownerId !== userId) throw new Error('Only the workspace owner can delete it');
    if (confirmName !== ws.name) throw new Error('Workspace name did not match');

    await ctx.db.patch(workspaceId, { deletedAt: Date.now() });
  },
});

/**
 * Workspaces the caller owns that are currently soft-deleted — the
 * "Recently deleted" list. Reuses listMine's membership-scan pattern
 * (membership rows survive a soft-delete) rather than a table-wide scan,
 * since a person's own membership count is inherently small.
 */
export const listDeleted = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const owned = memberships.filter((m) => m.role === 'owner');

    const workspaces = await Promise.all(owned.map((m) => ctx.db.get(m.workspaceId)));

    return workspaces
      .filter((ws): ws is NonNullable<typeof ws> => ws != null && ws.deletedAt != null)
      .map((ws) => ({ ...ws, purgesAt: ws.deletedAt! + WORKSPACE_RETENTION_MS }))
      .sort((a, b) => b.deletedAt! - a.deletedAt!);
  },
});

/** Undo a soft-delete within the retention window (owner only). */
export const restore = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const ws = await ctx.db.get(workspaceId);
    if (!ws) throw new Error('Not found');
    if (ws.ownerId !== userId) throw new Error('Only the workspace owner can restore it');
    if (!ws.deletedAt) throw new Error('Workspace is not deleted');

    await ctx.db.patch(workspaceId, { deletedAt: undefined });
  },
});

/**
 * Permanently purge one workspace that has been soft-deleted for longer
 * than WORKSPACE_RETENTION_MS, cascading through everything it owns.
 * Scheduled daily by convex/crons.ts; self-reschedules immediately after
 * a successful purge so a backlog drains same-day instead of one workspace
 * per cron tick, and stops on its own once nothing is left to do.
 *
 * Unlike the interactive `remove` mutation (soft-delete only, on purpose —
 * see its comment), this is the point where data actually goes away, so it
 * cascades for real: memberships, pending invites, modules → lessons →
 * blocks → presence, and the analytics tables. Notifications are left
 * alone — there's no by_workspace index for them (they're only optionally
 * tagged with a workspaceId) and a dangling reference on an old
 * notification is harmless, it just won't resolve a link anymore.
 *
 * Does NOT delete uploaded R2/storage blobs referenced by block content —
 * no code path in this app deletes those on any deletion today (module
 * soft-delete doesn't either), and extracting every storageId out of 15+
 * block-type payloads is a real, separate piece of work. Flagged, not
 * silently scoped in here.
 */
export const purgeExpiredWorkspaces = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - WORKSPACE_RETENTION_MS;
    const [ws] = await ctx.db
      .query('workspaces')
      .withIndex('by_deletedAt', (q) => q.lte('deletedAt', cutoff))
      .take(1);
    if (!ws) return;

    const [memberships, invites, modules, links, profiles, gaps, recs] = await Promise.all([
      ctx.db.query('memberships').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('pendingInvites').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('modules').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('analyticsLinks').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('analysisProfiles').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('trainingGaps').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
      ctx.db.query('courseRecommendations').withIndex('by_workspace', (q) => q.eq('workspaceId', ws._id)).collect(),
    ]);

    for (const mod of modules) {
      const [lessons, blocks, presenceRows] = await Promise.all([
        ctx.db.query('lessons').withIndex('by_module', (q) => q.eq('moduleId', mod._id)).collect(),
        ctx.db.query('blocks').withIndex('by_module', (q) => q.eq('moduleId', mod._id)).collect(),
        ctx.db.query('presence').withIndex('by_module', (q) => q.eq('moduleId', mod._id)).collect(),
      ]);
      await Promise.all([
        ...blocks.map((b) => ctx.db.delete(b._id)),
        ...lessons.map((l) => ctx.db.delete(l._id)),
        ...presenceRows.map((p) => ctx.db.delete(p._id)),
      ]);
      await ctx.db.delete(mod._id);
    }

    await Promise.all([
      ...memberships.map((m) => ctx.db.delete(m._id)),
      ...invites.map((i) => ctx.db.delete(i._id)),
      ...links.map((l) => ctx.db.delete(l._id)),
      ...profiles.map((p) => ctx.db.delete(p._id)),
      ...gaps.map((g) => ctx.db.delete(g._id)),
      ...recs.map((r) => ctx.db.delete(r._id)),
    ]);

    await ctx.db.delete(ws._id);

    await ctx.scheduler.runAfter(0, internal.workspaces.purgeExpiredWorkspaces, {});
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
