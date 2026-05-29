import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useConvexAuth, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '~convex/_generated/api';
import { Loader2, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import {
  DEFAULT_COMPANY_CODE,
  PENDING_EMPLOYEE_LOGIN_STORAGE_KEY,
  normalizeCompanyCode,
  normalizeEmployeeId,
} from '../lib/employeeLogin';

type Step = 'form' | 'sent' | 'completing';

export function SignInPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const validateEmployeeLogin = useMutation(api.users.validateEmployeeLogin);
  const navigate = useNavigate();

  // TanStack Router search params
  const search = useSearch({ strict: false }) as Record<string, string>;
  const redirectTo = search.redirectTo ?? '/';

  // Detect magic-link ?code= param — ConvexAuthProvider auto-handles it
  const hasCode = typeof window !== 'undefined' && window.location.search.includes('code=');

  const [step, setStep] = useState<Step>(hasCode ? 'completing' : 'form');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [companyCode, setCompanyCode] = useState(DEFAULT_COMPANY_CODE);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
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

  /** Sign in with password / PIN */
  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !employeeId.trim() || !companyCode.trim() || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      const validation = await validateEmployeeLogin({
        email: email.trim(),
        employeeId: normalizeEmployeeId(employeeId),
        companyCode: normalizeCompanyCode(companyCode),
      });
      if (!validation.ok) {
        setError(validation.message ?? 'Employee login validation failed.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          PENDING_EMPLOYEE_LOGIN_STORAGE_KEY,
          JSON.stringify({
            employeeId: normalizeEmployeeId(employeeId),
            companyCode: validation.companyCode,
          }),
        );
      }

      await signIn('password', {
        email: email.trim(),
        password,
        flow: 'signIn',
        employeeId: normalizeEmployeeId(employeeId),
        companyCode: normalizeCompanyCode(companyCode),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      // If they don't have a password set, prompt them to use magic link
      const isNotFound =
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('no account');
      setError(
        isNotFound
          ? 'No password found for this account. Send a magic link to sign in.'
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Send a magic-link email */
  async function handleMagicLink() {
    if (!email.trim() || !employeeId.trim() || !companyCode.trim()) {
      setError('Enter your email, EMPID, and company code first.');
      return;
    }
    setSendingLink(true);
    setError(null);

    try {
      const validation = await validateEmployeeLogin({
        email: email.trim(),
        employeeId: normalizeEmployeeId(employeeId),
        companyCode: normalizeCompanyCode(companyCode),
      });
      if (!validation.ok) {
        setError(validation.message ?? 'Employee login validation failed.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          PENDING_EMPLOYEE_LOGIN_STORAGE_KEY,
          JSON.stringify({
            employeeId: normalizeEmployeeId(employeeId),
            companyCode: validation.companyCode,
          }),
        );
      }

      await signIn('email', {
        email: email.trim(),
        employeeId: normalizeEmployeeId(employeeId),
        companyCode: normalizeCompanyCode(companyCode),
      });
      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="prism-brand-screen flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeInUp">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src="/prism-logo.png" className="mx-auto mb-5 size-14" alt="Prism Learning" />
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
              We sent a sign-in link to{' '}
              <span className="font-medium text-[var(--text-primary)]">{email}</span>.
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
              Sign in with your email, EMPID, company code, and password / PIN, or use a magic link.
            </p>

            <form onSubmit={(e) => void handlePasswordSignIn(e)} noValidate>
              {/* Email */}
              <label
                htmlFor="email"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"
              >
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

              <label
                htmlFor="employeeId"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"
              >
                EMPID
              </label>
              <input
                id="employeeId"
                type="text"
                autoComplete="username"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="e.g. EMP1024"
                className="mb-4 block w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
              />

              <label
                htmlFor="companyCode"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"
              >
                Company code
              </label>
              <input
                id="companyCode"
                type="text"
                required
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                placeholder={DEFAULT_COMPANY_CODE}
                className="mb-4 block w-full rounded-lg border px-3.5 py-2.5 text-sm uppercase outline-none"
              />

              {/* Password / PIN */}
              <label
                htmlFor="password"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"
              >
                Password or PIN
              </label>
              <div className="relative mb-4">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password or PIN"
                  className="block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {error && (
                <p className="mb-4 rounded-lg bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--semantic-danger)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim() || !employeeId.trim() || !companyCode.trim() || !password}
                className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            {/* Magic link fallback */}
            <button
              type="button"
              disabled={sendingLink}
              onClick={() => void handleMagicLink()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingLink ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {sendingLink ? 'Sending link…' : 'Send magic link instead'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
