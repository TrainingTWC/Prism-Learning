import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Sparkles, Loader2, Mail, ArrowLeft } from 'lucide-react';

type Step = 'form' | 'sent' | 'completing';

export function SignInPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  // TanStack Router search params
  const search = useSearch({ strict: false }) as Record<string, string>;
  const redirectTo = search.redirectTo ?? '/';

  // Detect magic-link ?code= param — ConvexAuthProvider auto-handles it
  const hasCode = typeof window !== 'undefined' && window.location.search.includes('code=');

  const [step, setStep] = useState<Step>(hasCode ? 'completing' : 'form');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: redirectTo as '/', replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  // Already loading (could be code completion)
  if (isLoading && hasCode) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-600">Signing you in…</span>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await signIn('email', { email: email.trim() });
      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <Sparkles className="size-6 text-indigo-500" />
          <span className="text-xl font-semibold tracking-tight">Prism Learning</span>
        </div>

        {step === 'completing' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-indigo-500" />
            <p className="text-slate-600">Completing sign in…</p>
          </div>
        ) : step === 'sent' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50">
                <Mail className="size-6 text-indigo-500" />
              </div>
            </div>
            <h1 className="mb-2 text-center text-xl font-semibold">Check your email</h1>
            <p className="mb-6 text-center text-sm leading-relaxed text-slate-500">
              We sent a sign-in link to <span className="font-medium text-slate-700">{email}</span>.
              Click the link to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
              }}
              className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="size-4" />
              Use a different email
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
            <p className="mb-6 text-sm text-slate-500">
              Enter your email to receive a magic sign-in link.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mb-4 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />

              {error && (
                <p className="mb-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
