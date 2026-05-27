import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/** List all members of a workspace (must be a member to call). */
export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    // Verify caller is a member
    const myMembership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (!myMembership) throw new Error('Forbidden');

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect();

    const users = await Promise.all(memberships.map((m) => ctx.db.get(m.userId)));

    return memberships.map((m, i) => ({
      _id: m._id,
      userId: m.userId,
      role: m.role,
      email: (users[i] as { email?: string } | null)?.email ?? null,
      name: (users[i] as { name?: string } | null)?.name ?? null,
    }));
  },
});

/** List pending invites for a workspace (owner only). */
export const listPendingInvites = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const ws = await ctx.db.get(workspaceId);
    if (!ws || ws.ownerId !== userId) throw new Error('Forbidden');

    return await ctx.db
      .query('pendingInvites')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.gt(q.field('expiresAt'), Date.now()))
      .collect();
  },
});

/**
 * Create a pending invite.
 * Returns the invite ID — the client builds the invite URL.
 * Email delivery is handled separately (wire Resend in convex/auth.ts env vars).
 */
export const invite = mutation({
  args: { workspaceId: v.id('workspaces'), email: v.string() },
  handler: async (ctx, { workspaceId, email }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    // Verify caller is a workspace member
    const myMembership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (!myMembership) throw new Error('Forbidden');

    const normalizedEmail = email.toLowerCase().trim();

    // Remove stale invite for same workspace+email
    const existing = await ctx.db
      .query('pendingInvites')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .filter((q) => q.eq(q.field('workspaceId'), workspaceId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const inviteId = await ctx.db.insert('pendingInvites', {
      workspaceId,
      email: normalizedEmail,
      invitedBy: userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return inviteId;
  },
});

/** Remove a member from a workspace (owner only; cannot remove self). */
export const remove = mutation({
  args: { workspaceId: v.id('workspaces'), userId: v.id('users') },
  handler: async (ctx, { workspaceId, userId: targetUserId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error('Unauthenticated');

    const ws = await ctx.db.get(workspaceId);
    if (!ws) throw new Error('Not found');
    if (ws.ownerId !== callerId) throw new Error('Only the workspace owner can remove members');
    if (targetUserId === callerId) throw new Error('Cannot remove yourself');

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('userId'), targetUserId))
      .first();

    if (membership) await ctx.db.delete(membership._id);
  },
});

/**
 * Accept any pending invites for the current user's email.
 * Call this once after sign-in.
 */
export const acceptPendingInvites = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    const email = (user as { email?: string } | null)?.email;
    if (!email) return;

    const invites = await ctx.db
      .query('pendingInvites')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .collect();

    for (const invite of invites) {
      await ctx.db.delete(invite._id);

      if (invite.expiresAt < Date.now()) continue;

      const alreadyMember = await ctx.db
        .query('memberships')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', invite.workspaceId))
        .filter((q) => q.eq(q.field('userId'), userId))
        .first();

      if (!alreadyMember) {
        await ctx.db.insert('memberships', {
          workspaceId: invite.workspaceId,
          userId,
          role: 'editor',
        });
      }
    }
  },
});
