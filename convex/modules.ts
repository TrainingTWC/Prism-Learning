import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server';
import type { DataModel } from './_generated/dataModel';
import type { Id } from './_generated/dataModel';

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

/** Verify caller is a member of the workspace. Returns userId or throws. */
async function requireMember(ctx: AnyCtx, workspaceId: Id<'workspaces'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthenticated');

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .filter((q) => q.eq(q.field('userId'), userId))
    .first();
  if (!membership) throw new Error('Forbidden');
  return userId;
}

/** List non-deleted modules for a workspace, newest-updated first. */
export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    await requireMember(ctx, workspaceId);

    const modules = await ctx.db
      .query('modules')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();

    return modules
      .filter((m) => !m.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Get a single module (must be a member). */
export const getById = query({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) return null;
    await requireMember(ctx, mod.workspaceId);
    return mod;
  },
});

/** Aggregate query: module + all its lessons (ordered) + all blocks (ordered).
 *  Used by the editor to subscribe to the whole module in one round-trip.
 */
export const getWithContent = query({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) return null;
    await requireMember(ctx, mod.workspaceId);

    const lessons = await ctx.db
      .query('lessons')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();
    lessons.sort((a, b) => a.order - b.order);

    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();
    blocks.sort((a, b) => a.order - b.order);

    return { module: mod, lessons, blocks };
  },
});

/** Create a new draft module in a workspace. */
export const create = mutation({
  args: { workspaceId: v.id('workspaces'), title: v.string() },
  handler: async (ctx, { workspaceId, title }) => {
    const userId = await requireMember(ctx, workspaceId);
    const now = Date.now();
    return await ctx.db.insert('modules', {
      workspaceId,
      title: title.trim() || 'Untitled Module',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastEditedBy: userId,
    });
  },
});

/** Rename a module. */
export const rename = mutation({
  args: { moduleId: v.id('modules'), title: v.string() },
  handler: async (ctx, { moduleId, title }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) throw new Error('Not found');
    const userId = await requireMember(ctx, mod.workspaceId);
    await ctx.db.patch(moduleId, {
      title: title.trim() || 'Untitled Module',
      updatedAt: Date.now(),
      lastEditedBy: userId,
    });
  },
});

/** Duplicate a module (deep copy lessons + blocks). */
export const duplicate = mutation({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) throw new Error('Not found');
    const userId = await requireMember(ctx, mod.workspaceId);

    const now = Date.now();
    const newModId = await ctx.db.insert('modules', {
      workspaceId: mod.workspaceId,
      title: `${mod.title} (copy)`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastEditedBy: userId,
    });

    const lessons = await ctx.db
      .query('lessons')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();

    for (const lesson of lessons) {
      const newLessonId = await ctx.db.insert('lessons', {
        moduleId: newModId,
        title: lesson.title,
        order: lesson.order,
        createdAt: now,
      });

      const blocks = await ctx.db
        .query('blocks')
        .withIndex('by_lesson', (q) => q.eq('lessonId', lesson._id))
        .collect();

      for (const block of blocks) {
        await ctx.db.insert('blocks', {
          lessonId: newLessonId,
          moduleId: newModId,
          type: block.type,
          order: block.order,
          content: block.content,
          updatedAt: now,
          lastEditedBy: userId,
        });
      }
    }

    return newModId;
  },
});

/** Soft-delete a module (sets deletedAt). */
export const softDelete = mutation({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) throw new Error('Not found');
    await requireMember(ctx, mod.workspaceId);
    await ctx.db.patch(moduleId, { deletedAt: Date.now() });
  },
});
