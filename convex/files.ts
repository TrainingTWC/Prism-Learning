import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/**
 * Returns a short-lived Convex storage upload URL.
 * The client uses this to PUT a file directly, then stores the returned storageId.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolves a storageId to a public URL.
 * Returns null if the storageId doesn't exist.
 */
export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    // storageId may be an Id<"_storage"> — cast via Id type
    return await ctx.storage.getUrl(storageId as Parameters<typeof ctx.storage.getUrl>[0]);
  },
});

/**
 * Delete a file from Convex storage (e.g. when a block is deleted).
 */
export const deleteFile = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');
    await ctx.storage.delete(storageId as Parameters<typeof ctx.storage.delete>[0]);
  },
});
