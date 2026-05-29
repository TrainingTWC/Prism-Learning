import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

const DEFAULT_COMPANY_CODE = 'HBPL';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase();
}

function normalizeCompanyCode(value: string) {
  return value.trim().toUpperCase();
}

/** Returns the current signed-in user's name and email. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const email = (user as { email?: string }).email ?? null;
    const employeeProfile = email
      ? await ctx.db
          .query('employeeProfiles')
          .withIndex('by_email', (q) => q.eq('email', normalizeEmail(email)))
          .first()
      : null;
    return {
      name: (user as { name?: string }).name ?? null,
      email,
      employeeId: employeeProfile?.employeeId ?? null,
      companyCode: employeeProfile?.companyCode ?? DEFAULT_COMPANY_CODE,
    };
  },
});

export const validateEmployeeLogin = mutation({
  args: {
    email: v.string(),
    employeeId: v.string(),
    companyCode: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const employeeId = normalizeEmployeeId(args.employeeId);
    const companyCode = normalizeCompanyCode(args.companyCode);

    if (!email) {
      return { ok: false, status: 'invalid' as const, message: 'Enter your email address.' };
    }
    if (!employeeId) {
      return { ok: false, status: 'invalid' as const, message: 'Enter your EMPID.' };
    }
    if (!companyCode) {
      return { ok: false, status: 'invalid' as const, message: 'Enter your company code.' };
    }
    if (companyCode !== DEFAULT_COMPANY_CODE) {
      return {
        ok: false,
        status: 'invalid' as const,
        message: `Company code must be ${DEFAULT_COMPANY_CODE}.`,
      };
    }

    const existing = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!existing) {
      return {
        ok: true,
        status: 'bootstrap' as const,
        companyCode,
      };
    }

    if (existing.employeeId !== employeeId || existing.companyCode !== companyCode) {
      return {
        ok: false,
        status: 'mismatch' as const,
        message: 'EMPID or company code does not match this account.',
      };
    }

    return {
      ok: true,
      status: 'match' as const,
      companyCode,
    };
  },
});

export const bootstrapEmployeeProfile = mutation({
  args: {
    employeeId: v.string(),
    companyCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const user = await ctx.db.get(userId);
    const email = normalizeEmail((user as { email?: string } | null)?.email ?? '');
    const employeeId = normalizeEmployeeId(args.employeeId);
    const companyCode = normalizeCompanyCode(args.companyCode);

    if (!email) throw new Error('This account does not have an email address.');
    if (!employeeId) throw new Error('EMPID is required.');
    if (companyCode !== DEFAULT_COMPANY_CODE) {
      throw new Error(`Company code must be ${DEFAULT_COMPANY_CODE}.`);
    }

    const existing = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    const now = Date.now();
    if (!existing) {
      await ctx.db.insert('employeeProfiles', {
        email,
        employeeId,
        companyCode,
        userId,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    if (existing.employeeId !== employeeId || existing.companyCode !== companyCode) {
      throw new Error('EMPID or company code does not match this account.');
    }

    await ctx.db.patch(existing._id, {
      userId,
      updatedAt: now,
    });
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
