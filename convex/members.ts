import { v } from 'convex/values';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internal } from './_generated/api';
import { Resend } from 'resend';

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
    // Non-owners just get an empty list — no crash
    if (!ws || ws.ownerId !== userId) return [];

    return await ctx.db
      .query('pendingInvites')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.gt(q.field('expiresAt'), Date.now()))
      .collect();
  },
});

/**
 * Internal mutation: write a pendingInvite row and return its ID.
 * Called from the `invite` action (which cannot itself write to the DB directly).
 */
export const _createInviteRecord = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.id('users'),
  },
  handler: async (ctx, { workspaceId, email, invitedBy }) => {
    // Remove stale invite for same workspace+email
    const existing = await ctx.db
      .query('pendingInvites')
      .withIndex('by_email', (q) => q.eq('email', email))
      .filter((q) => q.eq(q.field('workspaceId'), workspaceId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const inviteId = await ctx.db.insert('pendingInvites', {
      workspaceId,
      email,
      invitedBy,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Also return workspace name for the email
    const ws = await ctx.db.get(workspaceId);
    const inviter = await ctx.db.get(invitedBy);
    return {
      inviteId,
      workspaceName: ws?.name ?? 'a workspace',
      inviterName: (inviter as { name?: string; email?: string } | null)?.name
        ?? (inviter as { name?: string; email?: string } | null)?.email
        ?? 'Someone',
    };
  },
});

/**
 * Create a pending invite AND send an invitation email.
 * Converted from mutation → action so it can call Resend.
 */
export const invite = action({
  args: { workspaceId: v.id('workspaces'), email: v.string() },
  handler: async (ctx, { workspaceId, email }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    // Only the workspace owner may invite members (action fetches data via runQuery)
    const ws = (await ctx.runQuery(internal.members._getWorkspaceForAuth, { workspaceId })) as { ownerId: string; name: string } | null;
    if (!ws) throw new Error('Not found');
    if (ws.ownerId !== userId) throw new Error('Only the workspace owner can invite members');

    const normalizedEmail = email.toLowerCase().trim();

    const { inviteId, workspaceName, inviterName } = (await ctx.runMutation(
      internal.members._createInviteRecord,
      { workspaceId, email: normalizedEmail, invitedBy: userId },
    )) as { inviteId: string; workspaceName: string; inviterName: string };

    // Send invite email
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';
    const inviteLink = `${siteUrl}/sign-in?inviteId=${inviteId}&email=${encodeURIComponent(normalizedEmail)}`;
    const from = process.env.AUTH_EMAIL_FROM ?? 'Prism Learning <noreply@example.com>';

    if (!process.env.AUTH_RESEND_KEY) {
      console.log(`[DEV] Invite link for ${normalizedEmail}:\n${inviteLink}`);
    } else {
      const resend = new Resend(process.env.AUTH_RESEND_KEY);
      const { error } = await resend.emails.send({
        from,
        to: normalizedEmail,
        subject: `${inviterName} invited you to ${workspaceName} on Prism Learning`,
        html: `
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111">You've been invited to collaborate</h2>
            <p style="margin:0 0 8px;color:#555">
              <strong>${inviterName}</strong> has invited you to join
              <strong>${workspaceName}</strong> on Prism Learning.
            </p>
            <p style="margin:0 0 24px;color:#555">
              Click the button below to accept the invitation and sign in.
              This invite expires in 7 days.
            </p>
            <a href="${inviteLink}" style="display:inline-block;background:#0d8c63;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px">
              Accept invitation
            </a>
            <p style="margin:24px 0 0;color:#888;font-size:12px">Or paste this URL: ${inviteLink}</p>
            <p style="margin:16px 0 0;color:#aaa;font-size:11px">If you weren't expecting this invite, you can safely ignore this email.</p>
          </div>
        `,
      });
      if (error) {
        console.error('Failed to send invite email:', error.message);
        // Don't throw — the invite record was created, log and continue
      }
    }

    return inviteId as string;
  },
});

/** Internal query used by the invite action to check workspace ownership. */
export const _getWorkspaceForAuth = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db.get(workspaceId);
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
 * Call this once after sign-in. Returns the names of any newly-joined workspaces.
 */
export const acceptPendingInvites = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    const email = (user as { email?: string } | null)?.email;
    if (!email) return [];

    const invites = await ctx.db
      .query('pendingInvites')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .collect();

    const joined: string[] = [];

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
        const ws = await ctx.db.get(invite.workspaceId);
        if (ws) joined.push(ws.name);
      }
    }

    return joined;
  },
});

/** Revoke (delete) a pending invite — owner only. */
export const revokeInvite = mutation({
  args: { inviteId: v.id('pendingInvites') },
  handler: async (ctx, { inviteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const invite = await ctx.db.get(inviteId);
    if (!invite) throw new Error('Not found');

    const ws = await ctx.db.get(invite.workspaceId);
    if (!ws || ws.ownerId !== userId) throw new Error('Forbidden');

    await ctx.db.delete(inviteId);
  },
});
