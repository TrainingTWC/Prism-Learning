import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/** Upsert the current user's presence in a module. */
export const ping = mutation({
  args: {
    moduleId: v.id('modules'),
    activeLessonId: v.optional(v.id('lessons')),
  },
  handler: async (ctx, { moduleId, activeLessonId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Get display name from user record
    const user = await ctx.db.get(userId);
    const displayName =
      (user as { name?: string; email?: string } | null)?.name ??
      (user as { name?: string; email?: string } | null)?.email?.split('@')[0] ??
      'Someone';

    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user_module', (q) =>
        q.eq('userId', userId).eq('moduleId', moduleId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        displayName,
        activeLessonId,
      });
    } else {
      await ctx.db.insert('presence', {
        userId,
        moduleId,
        lastSeen: Date.now(),
        displayName,
        activeLessonId,
      });
    }
  },
});

/** List active presence for a module (last seen within 30s). */
export const list = query({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    const cutoff = Date.now() - 30_000;
    const all = await ctx.db
      .query('presence')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();

    return all.filter((p) => p.lastSeen > cutoff);
  },
});

/** Remove stale presence rows (older than 60s). Called on ping. */
export const reapStale = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60_000;
    const stale = await ctx.db
      .query('presence')
      .filter((q) => q.lt(q.field('lastSeen'), cutoff))
      .collect();
    await Promise.all(stale.map((p) => ctx.db.delete(p._id)));
  },
});
