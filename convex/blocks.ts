import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server';
import type { DataModel, Id } from './_generated/dataModel';

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

async function requireLessonMember(ctx: AnyCtx, lessonId: Id<'lessons'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthenticated');

  const lesson = await ctx.db.get(lessonId);
  if (!lesson) throw new Error('Not found');

  const mod = await ctx.db.get(lesson.moduleId);
  if (!mod) throw new Error('Not found');

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', mod.workspaceId))
    .filter((q) => q.eq(q.field('userId'), userId))
    .first();
  if (!membership) throw new Error('Forbidden');
  return { userId, lesson, module: mod };
}

/** List blocks for a lesson (ordered). */
export const list = query({
  args: { lessonId: v.id('lessons') },
  handler: async (ctx, { lessonId }) => {
    await requireLessonMember(ctx, lessonId);
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_lesson', (q) => q.eq('lessonId', lessonId))
      .collect();
    return blocks.sort((a, b) => a.order - b.order);
  },
});

/** Insert a new block in a lesson after a given position. */
export const add = mutation({
  args: {
    lessonId: v.id('lessons'),
    moduleId: v.id('modules'),
    type: v.union(v.literal('richText')),
    afterOrder: v.optional(v.number()),
  },
  handler: async (ctx, { lessonId, moduleId, type, afterOrder }) => {
    const { userId } = await requireLessonMember(ctx, lessonId);

    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_lesson', (q) => q.eq('lessonId', lessonId))
      .collect();

    // Find insert position
    let order: number;
    if (afterOrder === undefined) {
      const maxOrder = existing.reduce((max, b) => Math.max(max, b.order), 0);
      order = maxOrder + 1000;
    } else {
      const next = existing
        .filter((b) => b.order > afterOrder)
        .sort((a, b) => a.order - b.order)[0];
      order = next ? (afterOrder + next.order) / 2 : afterOrder + 1000;
    }

    const now = Date.now();
    return await ctx.db.insert('blocks', {
      lessonId,
      moduleId,
      type,
      order,
      content: type === 'richText' ? '<p></p>' : undefined,
      updatedAt: now,
      lastEditedBy: userId,
    });
  },
});

/** Update block content (rich text HTML). Per-field LWW — last writer wins. */
export const updateContent = mutation({
  args: { blockId: v.id('blocks'), content: v.string() },
  handler: async (ctx, { blockId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const block = await ctx.db.get(blockId);
    if (!block) throw new Error('Not found');

    await ctx.db.patch(blockId, {
      content,
      updatedAt: Date.now(),
      lastEditedBy: userId,
    });
  },
});

/** Reorder blocks by providing ordered array of block IDs. */
export const reorder = mutation({
  args: { blockIds: v.array(v.id('blocks')) },
  handler: async (ctx, { blockIds }) => {
    if (blockIds.length === 0) return;
    await Promise.all(
      blockIds.map((id, index) =>
        ctx.db.patch(id, { order: (index + 1) * 1000 }),
      ),
    );
  },
});

/** Duplicate a block, inserting it immediately after the source. */
export const duplicate = mutation({
  args: { blockId: v.id('blocks') },
  handler: async (ctx, { blockId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const block = await ctx.db.get(blockId);
    if (!block) throw new Error('Not found');

    const siblings = await ctx.db
      .query('blocks')
      .withIndex('by_lesson', (q) => q.eq('lessonId', block.lessonId))
      .collect();

    const next = siblings
      .filter((b) => b.order > block.order)
      .sort((a, b) => a.order - b.order)[0];

    const order = next
      ? (block.order + next.order) / 2
      : block.order + 1000;

    const now = Date.now();
    return await ctx.db.insert('blocks', {
      lessonId: block.lessonId,
      moduleId: block.moduleId,
      type: block.type,
      order,
      content: block.content,
      updatedAt: now,
      lastEditedBy: userId,
    });
  },
});

/** Delete a block. */
export const remove = mutation({
  args: { blockId: v.id('blocks') },
  handler: async (ctx, { blockId }) => {
    const block = await ctx.db.get(blockId);
    if (!block) throw new Error('Not found');
    await ctx.db.delete(blockId);
  },
});
