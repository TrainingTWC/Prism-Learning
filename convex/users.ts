import { query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/** Returns the current signed-in user's name and email. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      name: (user as { name?: string }).name ?? null,
      email: (user as { email?: string }).email ?? null,
    };
  },
});

/**
 * Returns true if the authenticated user has a password/PIN registered.
 * Used by account settings to show "Set password" vs "Change password".
 */
export const hasPassword = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) =>
        q.eq('userId', userId).eq('provider', 'password'),
      )
      .first();
    return account !== null;
  },
});
