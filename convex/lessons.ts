import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server';
import type { DataModel, Id } from './_generated/dataModel';

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

async function requireModuleMember(ctx: AnyCtx, moduleId: Id<'modules'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthenticated');

  const mod = await ctx.db.get(moduleId);
  if (!mod || mod.deletedAt) throw new Error('Not found');

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', mod.workspaceId))
    .filter((q) => q.eq(q.field('userId'), userId))
    .first();
  if (!membership) throw new Error('Forbidden');
  return userId;
}

/** List lessons for a module (ordered). */
export const list = query({
  args: { moduleId: v.id('modules') },
  handler: async (ctx, { moduleId }) => {
    await requireModuleMember(ctx, moduleId);
    const lessons = await ctx.db
      .query('lessons')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();
    return lessons.sort((a, b) => a.order - b.order);
  },
});

/** Add a lesson at the end of a module. */
export const add = mutation({
  args: { moduleId: v.id('modules'), title: v.optional(v.string()) },
  handler: async (ctx, { moduleId, title }) => {
    await requireModuleMember(ctx, moduleId);

    const existing = await ctx.db
      .query('lessons')
      .withIndex('by_module', (q) => q.eq('moduleId', moduleId))
      .collect();

    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order), 0);

    return await ctx.db.insert('lessons', {
      moduleId,
      title: title?.trim() || 'New Lesson',
      order: maxOrder + 1000,
      createdAt: Date.now(),
    });
  },
});

/** Rename a lesson. */
export const rename = mutation({
  args: { lessonId: v.id('lessons'), title: v.string() },
  handler: async (ctx, { lessonId, title }) => {
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error('Not found');
    await requireModuleMember(ctx, lesson.moduleId);
    await ctx.db.patch(lessonId, { title: title.trim() || 'Untitled Lesson' });
  },
});

/** Reorder lessons by providing ordered array of lesson IDs. */
export const reorder = mutation({
  args: { lessonIds: v.array(v.id('lessons')) },
  handler: async (ctx, { lessonIds }) => {
    if (lessonIds.length === 0) return;
    const first = await ctx.db.get(lessonIds[0]!);
    if (!first) throw new Error('Not found');
    await requireModuleMember(ctx, first.moduleId);

    // Verify all lessons belong to the same module (prevents cross-module injection)
    const all = await Promise.all(lessonIds.map((id) => ctx.db.get(id)));
    if (all.some((l) => !l || l.moduleId !== first.moduleId)) {
      throw new Error('Forbidden');
    }

    await Promise.all(
      lessonIds.map((id, index) =>
        ctx.db.patch(id, { order: (index + 1) * 1000 }),
      ),
    );
  },
});

/** Delete a lesson and all its blocks. */
export const remove = mutation({
  args: { lessonId: v.id('lessons') },
  handler: async (ctx, { lessonId }) => {
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error('Not found');
    await requireModuleMember(ctx, lesson.moduleId);

    // Delete all blocks in this lesson
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_lesson', (q) => q.eq('lessonId', lessonId))
      .collect();
    await Promise.all(blocks.map((b) => ctx.db.delete(b._id)));

    await ctx.db.delete(lessonId);
  },
});
