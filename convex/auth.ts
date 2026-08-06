import { convexAuth } from '@convex-dev/auth/server';
import { Email } from '@convex-dev/auth/providers/Email';
import { Password } from '@convex-dev/auth/providers/Password';
import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import { ConvexError } from 'convex/values';
import { Resend } from 'resend';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { internal } from './_generated/api';

// prism-platform signs session JWTs with RS256 and publishes its public key
// here — no shared secret to configure or rotate on this side.
const PRISM_JWKS_URL = 'https://effervescent-gopher-848.convex.site/.well-known/jwks.json';
const prismJwks = createRemoteJWKSet(new URL(PRISM_JWKS_URL));

interface PrismClaims {
  email?: string;
  name?: string;
  empId?: string;
  companySlug?: string;
}

/**
 * Magic-link auth via email.
 *
 * Environment variables required in Convex deployment:
 *   AUTH_SECRET         — random secret (run: openssl rand -base64 32)
 *   AUTH_RESEND_KEY     — Resend API key
 *   AUTH_EMAIL_FROM     — sender address, e.g. "Prism <noreply@yourdomain.com>"
 *   SITE_URL            — production URL, e.g. "https://prism.example.com"
 *                         (defaults to http://localhost:5173 for local dev)
 *
 * Set them with:  npx convex env set KEY value
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Email({
      id: 'email',
      authorize: undefined,
      sendVerificationRequest: async ({ identifier: email, token }) => {
        const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';
        const magicLink = `${siteUrl}/sign-in?code=${token}`;
        const from =
          process.env.AUTH_EMAIL_FROM ?? 'Prism Authoring <noreply@example.com>';

        // Dev mode: if no Resend key, log the magic link to the Convex function
        // logs so you can sign in without an email provider.
        if (!process.env.AUTH_RESEND_KEY) {
          console.log(`[DEV] Magic link for ${email}:\n${magicLink}`);
          return;
        }

        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        const { error } = await resend.emails.send({
          from,
          to: email,
          subject: 'Sign in to Prism Authoring',
          html: `
            <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111">Sign in to Prism Authoring</h2>
              <p style="margin:0 0 24px;color:#555">Click the button below to sign in. This link expires in 1 hour and can only be used once.</p>
              <a href="${magicLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:15px">Sign in</a>
              <p style="margin:24px 0 0;color:#888;font-size:12px">Or paste this URL: ${magicLink}</p>
              <p style="margin:16px 0 0;color:#aaa;font-size:11px">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });

        if (error) {
          throw new Error(`Failed to send sign-in email: ${error.message}`);
        }
      },
    }),

    /**
     * Password / PIN provider.
     * Allows 4+ characters so users can use a short numeric PIN or a full password.
     * On first use, signUp links the password account to the existing magic-link user.
     */
    Password({
      id: 'password',
      validatePasswordRequirements: (password: string) => {
        if (password.length < 4) {
          throw new ConvexError('Password or PIN must be at least 4 characters.');
        }
      },
    }),

    /**
     * SSO via prism-platform. Verifies the RS256 JWT it issued, then finds or
     * creates the matching Convex Auth account — links to an existing
     * Email/Password account by verified email if one exists, otherwise
     * creates a new user. See convex/sso.ts for the employeeProfiles /
     * workspace-membership side effects that run after.
     */
    ConvexCredentials({
      id: 'prism-sso',
      authorize: async (credentials, ctx) => {
        const token = credentials.token;
        if (typeof token !== 'string' || !token) {
          throw new ConvexError('Missing sign-in token.');
        }

        let claims: PrismClaims;
        try {
          const { payload } = await jwtVerify(token, prismJwks, { issuer: 'prism-platform' });
          claims = payload as PrismClaims;
        } catch {
          throw new ConvexError('Invalid or expired sign-in link.');
        }
        if (!claims.email || !claims.empId) {
          throw new ConvexError('Sign-in token is missing required fields.');
        }
        const email = claims.email.trim().toLowerCase();

        // See convex/sso.ts::linkOrCreateSsoUser for why this doesn't use
        // createAccount/retrieveAccount's own shouldLinkViaEmail linking.
        const userId = await ctx.runMutation(internal.sso.linkOrCreateSsoUser, {
          email,
          name: claims.name,
        });

        await ctx.runMutation(internal.sso.linkSsoEmployee, {
          userId,
          email,
          employeeId: claims.empId,
          companyCode: (claims.companySlug ?? '').trim().toUpperCase(),
        });

        return { userId };
      },
    }),
  ],
});
