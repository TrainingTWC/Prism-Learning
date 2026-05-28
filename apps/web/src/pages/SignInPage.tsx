import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

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
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--ember-400)]" />
        <span className="ml-3 text-[var(--text-tertiary)]">Signing you in…</span>
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
    <div className="prism-brand-screen flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeInUp">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src="/prism-logo.svg" className="mx-auto mb-5 size-14" alt="Prism Learning" />
          <p className="text-overline mb-2">AI-native SCORM authoring</p>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight text-[var(--obsidian-50)]">
            Prism <span className="text-gradient-ember">Learning</span>
          </h1>
        </div>

        {step === 'completing' ? (
          <div className="glass p-8 text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-[var(--ember-400)]" />
            <p className="text-[var(--text-tertiary)]">Completing sign in…</p>
          </div>
        ) : step === 'sent' ? (
          <div className="widget p-8 shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="prism-icon-tile flex size-12 items-center justify-center rounded-full">
                <Mail className="size-6" />
              </div>
            </div>
            <h1 className="mb-2 text-center text-xl font-bold text-[var(--text-primary)]">Check your email</h1>
            <p className="mb-6 text-center text-sm leading-relaxed text-[var(--text-tertiary)]">
              We sent a sign-in link to <span className="font-medium text-[var(--text-primary)]">{email}</span>.
              Click the link to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
              }}
              className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="size-4" />
              Use a different email
            </button>
          </div>
        ) : (
          <div className="widget p-8 shadow-sm">
            <h1 className="mb-1 text-xl font-bold text-[var(--text-primary)]">Sign in</h1>
            <p className="mb-6 text-sm text-[var(--text-tertiary)]">
              Enter your email to receive a magic sign-in link.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              <label htmlFor="email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
                className="mb-4 block w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
              />

              {error && (
                <p className="mb-4 rounded-lg bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--semantic-danger)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
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
