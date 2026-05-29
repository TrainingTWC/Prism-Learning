import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  Loader2,
  UserPlus,
  Trash2,
  Clock,
  Mail,
  Check,
  X,
  RefreshCw,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

function getInitials(str: string) {
  const parts = str.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
    : str.slice(0, 2).toUpperCase();
}

export function MembersPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/members' });
  const wsId = workspaceId as Id<'workspaces'>;

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const members = useQuery(api.members.list, { workspaceId: wsId });
  const pendingInvites = useQuery(api.members.listPendingInvites, { workspaceId: wsId });

  const inviteAction = useAction(api.members.invite);
  const removeMutation = useMutation(api.members.remove);
  const revokeMutation = useMutation(api.members.revokeInvite);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isOwner = workspace?.role === 'owner';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setInviting(true);
    setInviteError(null);
    setInvitedEmail(null);

    try {
      await inviteAction({ workspaceId: wsId, email });
      setInvitedEmail(email);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try {
      await removeMutation({ workspaceId: wsId, userId: userId as Id<'users'> });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevoke(inviteId: string) {
    setRevokingId(inviteId);
    try {
      await revokeMutation({ inviteId: inviteId as Id<'pendingInvites'> });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleResend(email: string) {
    setInviting(true);
    setInviteError(null);
    try {
      await inviteAction({ workspaceId: wsId, email });
      setInvitedEmail(email);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setInviting(false);
    }
  }

  if (workspace === undefined || members === undefined) {
    return (
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--ember-400)]" />
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="prism-brand-screen flex min-h-screen flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
        <p>Workspace not found.</p>
        <Link to="/" className="text-sm text-[var(--ember-400)] hover:underline">
          Back to workspaces
        </Link>
      </div>
    );
  }

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      workspaceRole={workspace.role}
      active="members"
      overline="Access control"
      title="Members"
      subtitle="Invite collaborators, review active members, and manage pending access for this workspace."
    >
      <div className="max-w-3xl space-y-6">

        {/* Invite form — owner only */}
        {isOwner && (
          <section className="widget p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <UserPlus className="size-4 text-[var(--ember-400)]" />
              Invite a collaborator
            </h2>
            <p className="mb-5 text-xs text-[var(--text-muted)]">
              They'll receive an email invite. Once they sign in, they'll be added as an editor.
            </p>

            <form onSubmit={(e) => void handleInvite(e)} className="flex gap-3">
              <input
                type="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="block flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {inviting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </form>

            {inviteError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--semantic-danger)]">
                <X className="size-4 shrink-0" />
                {inviteError}
              </div>
            )}

            {invitedEmail && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[rgba(170,117,221,0.2)] bg-[rgba(140,67,208,0.08)] px-3.5 py-2.5 text-sm text-[var(--ember-400)]">
                <Check className="size-4 shrink-0" />
                Invite sent to <span className="font-semibold">{invitedEmail}</span>. They'll receive an email with a sign-in link.
              </div>
            )}
          </section>
        )}

        {/* Active members */}
        <section className="widget overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Users className="size-4 text-[var(--ember-400)]" />
              Active members
              <span className="ml-1 rounded-full bg-[var(--card-bg-hover)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                {members.length}
              </span>
            </h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {members.map((m) => {
              const label = m.name ?? m.email ?? 'Unknown';
              return (
                <li key={m._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(140,67,208,0.12)] text-xs font-bold text-[var(--ember-400)]">
                      {getInitials(label)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                      {m.name && m.email && (
                        <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`badge-pill ${
                        m.role === 'owner'
                          ? 'bg-[rgba(140,67,208,0.1)] text-[var(--ember-400)]'
                          : 'bg-white/[0.04] text-[var(--text-tertiary)]'
                      }`}
                    >
                      {m.role === 'owner' ? (
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="size-3" /> owner
                        </span>
                      ) : m.role}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => void handleRemove(m.userId)}
                        disabled={removingId === m.userId}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)] disabled:opacity-50"
                        title="Remove member"
                      >
                        {removingId === m.userId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Pending invites — owner only */}
        {isOwner && pendingInvites && pendingInvites.length > 0 && (
          <section className="widget overflow-hidden">
            <div className="flex items-center border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Clock className="size-4 text-[var(--text-muted)]" />
                Pending invites
                <span className="ml-1 rounded-full bg-[var(--card-bg-hover)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                  {pendingInvites.length}
                </span>
              </h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {pendingInvites.map((inv) => (
                <li key={inv._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]">
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">{inv.email}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Invite expires {new Date(inv.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResend(inv.email)}
                      disabled={inviting}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:opacity-50"
                      title="Resend invite email"
                    >
                      {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                      Resend
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(inv._id)}
                      disabled={revokingId === inv._id}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)] disabled:opacity-50"
                      title="Revoke invite"
                    >
                      {revokingId === inv._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PrismWorkspaceShell>
  );
}
