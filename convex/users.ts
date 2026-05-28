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
