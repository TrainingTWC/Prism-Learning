import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Loader2, Eye, EyeOff, KeyRound, Hash } from 'lucide-react';
import { api } from '~convex/_generated/api';

interface Props {
  email: string;
  open: boolean;
  onClose: () => void;
}

type Mode = 'pin' | 'password';
// Flow: 'set' = first time, 'reset-request' = request code, 'reset-verify' = enter code + new password
type Flow = 'set' | 'reset-request' | 'reset-verify';

export function SetPasswordModal({ email, open, onClose }: Props) {
  const { signIn } = useAuthActions();
  const alreadyHasPassword = useQuery(api.users.hasPassword);

  const [mode, setMode] = useState<Mode>('password');
  const [flow, setFlow] = useState<Flow>('set');
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  function resetState() {
    setValue('');
    setConfirm('');
    setCode('');
    setNewValue('');
    setNewConfirm('');
    setError(null);
    setSuccess(null);
    setFlow('set');
  }

  function handleClose() {
    resetState();
    onClose();
  }

  const minLen = mode === 'pin' ? 4 : 8;
  const label = mode === 'pin' ? 'PIN' : 'password';

  /** Validate the value + confirm match and meet minimum length */
  function validate(v: string, c: string): string | null {
    if (v.length < minLen) return `${label.charAt(0).toUpperCase() + label.slice(1)} must be at least ${minLen} characters.`;
    if (mode === 'pin' && !/^\d+$/.test(v)) return 'PIN must contain only digits.';
    if (v !== c) return `${label.charAt(0).toUpperCase() + label.slice(1)}s do not match.`;
    return null;
  }

  /** First-time set: signUp links password account to existing user by email */
  async function handleSet(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(value, confirm);
    if (err) { setError(err); return; }

    setSubmitting(true);
    setError(null);
    try {
      await signIn('password', { email, password: value, flow: 'signUp' });
      setSuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} set! You can now use it to sign in next time.`);
      setValue('');
      setConfirm('');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to set password.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Step 1 of change: request reset code via email */
  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn('password', { email, flow: 'reset' });
      setFlow('reset-verify');
      setSuccess(`A verification code was sent to ${email}.`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to send reset code.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Step 2 of change: verify code + set new password */
  async function handleResetVerify(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(newValue, newConfirm);
    if (err) { setError(err); return; }
    if (!code.trim()) { setError('Enter the code from your email.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await signIn('password', { email, code: code.trim(), newPassword: newValue, flow: 'reset-verification' });
      setSuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} changed successfully.`);
      resetState();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = alreadyHasPassword === undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="widget w-full max-w-sm p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="prism-icon-tile flex size-9 items-center justify-center rounded-lg">
            <KeyRound className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {isLoading ? 'Loading…' : alreadyHasPassword ? 'Change password / PIN' : 'Set password / PIN'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">{email}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
          <>
            {/* Mode toggle (only shown on first-time set) */}
            {!alreadyHasPassword && flow === 'set' && (
              <div className="mb-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('password'); setValue(''); setConfirm(''); setError(null); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === 'password'
                      ? 'border-[var(--ember-500)] bg-[var(--ember-500)]/10 text-[var(--ember-400)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <KeyRound className="size-3.5" /> Password
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('pin'); setValue(''); setConfirm(''); setError(null); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === 'pin'
                      ? 'border-[var(--ember-500)] bg-[var(--ember-500)]/10 text-[var(--ember-400)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Hash className="size-3.5" /> PIN
                </button>
              </div>
            )}

            {success && (
              <p className="mb-4 rounded-lg bg-[rgba(34,197,94,0.08)] px-3.5 py-2.5 text-sm text-[var(--semantic-success)]">
                {success}
              </p>
            )}

            {/* === FLOW: SET (first time) === */}
            {!alreadyHasPassword && flow === 'set' && (
              <form onSubmit={(e) => void handleSet(e)} noValidate>
                <PasswordField
                  id="set-value"
                  label={mode === 'pin' ? 'Enter PIN (4+ digits)' : `Enter ${label} (${minLen}+ characters)`}
                  value={value}
                  show={showValue}
                  onToggle={() => setShowValue((v) => !v)}
                  onChange={setValue}
                  inputMode={mode === 'pin' ? 'numeric' : 'text'}
                  pattern={mode === 'pin' ? '[0-9]*' : undefined}
                />
                <PasswordField
                  id="set-confirm"
                  label={`Confirm ${label}`}
                  value={confirm}
                  show={showValue}
                  onToggle={() => setShowValue((v) => !v)}
                  onChange={setConfirm}
                  inputMode={mode === 'pin' ? 'numeric' : 'text'}
                  pattern={mode === 'pin' ? '[0-9]*' : undefined}
                />
                {error && <ErrorBox msg={error} />}
                <SubmitButton loading={submitting} label={`Set ${label}`} />
              </form>
            )}

            {/* === FLOW: RESET REQUEST (change step 1) === */}
            {alreadyHasPassword && flow === 'set' && (
              <form onSubmit={(e) => void handleResetRequest(e)} noValidate>
                <p className="mb-4 text-sm text-[var(--text-tertiary)]">
                  We'll send a verification code to{' '}
                  <span className="font-medium text-[var(--text-primary)]">{email}</span> to confirm
                  it's you, then you can set a new password or PIN.
                </p>
                {error && <ErrorBox msg={error} />}
                <SubmitButton loading={submitting} label="Send verification code" />
              </form>
            )}

            {/* === FLOW: RESET VERIFY (change step 2) === */}
            {flow === 'reset-verify' && (
              <form onSubmit={(e) => void handleResetVerify(e)} noValidate>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Code from email
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="8-digit code"
                  className="mb-4 block w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
                />
                {/* Mode toggle for new password/pin */}
                <div className="mb-4 flex gap-2">
                  <button type="button" onClick={() => setMode('password')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${mode === 'password' ? 'border-[var(--ember-500)] bg-[var(--ember-500)]/10 text-[var(--ember-400)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                    <KeyRound className="size-3.5" /> Password
                  </button>
                  <button type="button" onClick={() => setMode('pin')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${mode === 'pin' ? 'border-[var(--ember-500)] bg-[var(--ember-500)]/10 text-[var(--ember-400)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                    <Hash className="size-3.5" /> PIN
                  </button>
                </div>
                <PasswordField
                  id="new-value"
                  label={mode === 'pin' ? 'New PIN (4+ digits)' : `New ${label} (${minLen}+ characters)`}
                  value={newValue}
                  show={showValue}
                  onToggle={() => setShowValue((v) => !v)}
                  onChange={setNewValue}
                  inputMode={mode === 'pin' ? 'numeric' : 'text'}
                  pattern={mode === 'pin' ? '[0-9]*' : undefined}
                />
                <PasswordField
                  id="new-confirm"
                  label={`Confirm new ${label}`}
                  value={newConfirm}
                  show={showValue}
                  onToggle={() => setShowValue((v) => !v)}
                  onChange={setNewConfirm}
                  inputMode={mode === 'pin' ? 'numeric' : 'text'}
                  pattern={mode === 'pin' ? '[0-9]*' : undefined}
                />
                {error && <ErrorBox msg={error} />}
                <SubmitButton loading={submitting} label={`Change ${label}`} />
                <button
                  type="button"
                  onClick={() => { setFlow('set'); setCode(''); setError(null); setSuccess(null); }}
                  className="mt-2 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  ← Back
                </button>
              </form>
            )}
          </>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---- small helpers ----

function PasswordField({
  id, label, value, show, onToggle, onChange, inputMode, pattern,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          inputMode={inputMode}
          pattern={pattern}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <p className="mb-4 rounded-lg bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--semantic-danger)]">
      {msg}
    </p>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {loading ? 'Please wait…' : label}
    </button>
  );
}
