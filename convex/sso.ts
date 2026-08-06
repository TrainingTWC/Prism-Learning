import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

/**
 * Finds-or-creates the Convex Auth user for an SSO login, replacing
 * @convex-dev/auth's own createAccount/retrieveAccount + shouldLinkViaEmail
 * for this provider. That built-in linking picks *a* user matching the
 * email index, but some accounts here have duplicate `users` rows for the
 * same email (pre-existing data, not caused by SSO) — its pick isn't
 * necessarily the one with real workspace memberships, and it created a
 * second, empty account on the two logins before this fix. This instead
 * prefers, among same-email users, the one already holding the most
 * memberships, so SSO always lands on the account that actually has data.
 */
export const linkOrCreateSsoUser = internalMutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email))
      .collect();

    let userId = candidates[0]?._id;
    if (candidates.length > 1) {
      const withCounts = await Promise.all(
        candidates.map(async (u) => ({
          id: u._id,
          count: (
            await ctx.db
              .query('memberships')
              .withIndex('by_user', (q) => q.eq('userId', u._id))
              .collect()
          ).length,
        })),
      );
      withCounts.sort((a, b) => b.count - a.count);
      userId = withCounts[0]!.id;
    }

    if (!userId) {
      userId = await ctx.db.insert('users', {
        email: args.email,
        name: args.name,
        emailVerificationTime: Date.now(),
      });
    }

    const existingAccount = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) =>
        q.eq('provider', 'prism-sso').eq('providerAccountId', args.email),
      )
      .first();
    if (!existingAccount) {
      await ctx.db.insert('authAccounts', {
        provider: 'prism-sso',
        providerAccountId: args.email,
        userId,
      });
    } else if (existingAccount.userId !== userId) {
      await ctx.db.patch(existingAccount._id, { userId });
    }

    return userId;
  },
});

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
