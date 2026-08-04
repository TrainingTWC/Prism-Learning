import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Loader2 } from 'lucide-react';

// Landed here from prism-platform's /login?redirect_uri=<this>&app=authoring
// with the session token in the URL fragment (never sent to any server as
// part of the URL — only over the authenticated signIn() call below).
export function SsoCallbackPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (!token) {
      setError('No sign-in token was provided.');
      return;
    }
    // Clear the fragment immediately so the token doesn't linger in history.
    window.history.replaceState(null, '', window.location.pathname);

    signIn('prism-sso', { token })
      .then(() => void navigate({ to: '/', replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Sign in failed.');
      });
  }, [signIn, navigate]);

  return (
    <div className="prism-brand-screen flex min-h-screen items-center justify-center px-4">
      <div className="widget w-full max-w-md p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="mb-4 text-sm text-[var(--semantic-danger)]">{error}</p>
            <a href="/sign-in" className="text-sm font-semibold text-[var(--ember-400)] hover:underline">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-[var(--ember-400)]" />
            <p className="text-[var(--text-tertiary)]">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
