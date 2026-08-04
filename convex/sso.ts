import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

/**
 * Runs after a successful prism-sso ConvexCredentials authorize() (see
 * convex/auth.ts) — upserts the employeeProfiles bridge row and, if the
 * token's companySlug matches an analyticsLinks workspace, auto-joins that
 * workspace (role: 'editor', same as accepting an invite — see
 * members.ts::acceptPendingInvites). No match → user lands on the existing
 * workspace picker/creation flow, untouched.
 */
export const linkSsoEmployee = internalMutation({
  args: {
    userId: v.id('users'),
    email: v.string(),
    employeeId: v.string(),
    companyCode: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingProfile = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (!existingProfile) {
      await ctx.db.insert('employeeProfiles', {
        email: args.email,
        employeeId: args.employeeId,
        companyCode: args.companyCode,
        userId: args.userId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existingProfile._id, {
        employeeId: args.employeeId,
        companyCode: args.companyCode,
        userId: args.userId,
        updatedAt: now,
      });
    }

    if (!args.companyCode) return;
    const link = await ctx.db
      .query('analyticsLinks')
      .withIndex('by_companyCode', (q) => q.eq('companyCode', args.companyCode))
      .first();
    if (!link) return;

    const alreadyMember = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', link.workspaceId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();
    if (alreadyMember) return;

    await ctx.db.insert('memberships', {
      workspaceId: link.workspaceId,
      userId: args.userId,
      role: 'editor',
    });
    await ctx.runMutation(internal.notifications.createForUser, {
      userId: args.userId,
      kind: 'workspace_joined',
      title: 'Added to workspace',
      body: `You joined via Prism sign-in.`,
      workspaceId: link.workspaceId,
    });
  },
});
