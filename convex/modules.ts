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
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (!membership) return [];

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

/** Set (or clear) the per-module AI image style reference. */
export const setStyleReference = mutation({
  args: { moduleId: v.id('modules'), storageId: v.union(v.string(), v.null()) },
  handler: async (ctx, { moduleId, storageId }) => {
    const mod = await ctx.db.get(moduleId);
    if (!mod || mod.deletedAt) throw new Error('Not found');
    const userId = await requireMember(ctx, mod.workspaceId);
    await ctx.db.patch(moduleId, {
      styleReferenceStorageId: storageId ?? undefined,
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

/** Block type literal — must mirror the schema.ts blocks.type union. */
const blockTypeV = v.union(
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
  v.literal('hotspots'),
  v.literal('gallery'),
  v.literal('compare'),
  v.literal('audio'),
  v.literal('labeledGraphic'),
  v.literal('matching'),
  v.literal('sorting'),
  v.literal('fillBlanks'),
  v.literal('revealCards'),
  v.literal('scenario'),
);

/**
 * Create a new module from a client-side template payload.
 * Performs module + lessons + blocks inserts in a single mutation (atomic).
 */
export const createFromTemplate = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    title: v.string(),
    lessons: v.array(
      v.object({
        title: v.string(),
        blocks: v.array(
          v.object({
            type: blockTypeV,
            content: v.optional(v.string()),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { workspaceId, title, lessons }) => {
    const userId = await requireMember(ctx, workspaceId);
    const now = Date.now();

    const moduleId = await ctx.db.insert('modules', {
      workspaceId,
      title: title.trim() || 'Untitled Module',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastEditedBy: userId,
    });

    for (let li = 0; li < lessons.length; li++) {
      const l = lessons[li]!;
      const lessonId = await ctx.db.insert('lessons', {
        moduleId,
        title: l.title.trim() || `Lesson ${li + 1}`,
        order: (li + 1) * 1000,
        createdAt: now,
      });
      for (let bi = 0; bi < l.blocks.length; bi++) {
        const b = l.blocks[bi]!;
        await ctx.db.insert('blocks', {
          lessonId,
          moduleId,
          type: b.type,
          order: (bi + 1) * 1000,
          content: b.content,
          updatedAt: now,
          lastEditedBy: userId,
        });
      }
    }

    return moduleId;
  },
});
