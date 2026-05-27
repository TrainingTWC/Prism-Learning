import { convexAuth } from '@convex-dev/auth/server';
import Email from '@convex-dev/auth/providers/Email';
import { Resend } from 'resend';

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
      // authorize: undefined → only the token is needed to sign in (true magic link).
      // The token must be high entropy; Convex Auth generates a secure default.
      authorize: undefined,
      sendVerificationRequest: async ({ identifier: email, token }) => {
        const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';
        const magicLink = `${siteUrl}/sign-in?code=${token}`;
        const from =
          process.env.AUTH_EMAIL_FROM ?? 'Prism Learning <noreply@example.com>';

        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        const { error } = await resend.emails.send({
          from,
          to: email,
          subject: 'Sign in to Prism Learning',
          html: `
            <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111">Sign in to Prism Learning</h2>
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
  ],
});
