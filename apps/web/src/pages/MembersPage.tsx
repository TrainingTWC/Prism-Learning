import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  Loader2,
  UserPlus,
  Trash2,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

export function MembersPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/members' });
  const wsId = workspaceId as Id<'workspaces'>;

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const members = useQuery(api.members.list, { workspaceId: wsId });
  const pendingInvites = useQuery(api.members.listPendingInvites, { workspaceId: wsId });

  const inviteMutation = useMutation(api.members.invite);
  const removeMutation = useMutation(api.members.remove);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = workspace?.role === 'owner';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setInviting(true);
    setInviteError(null);
    setInviteLink(null);

    try {
      const inviteId = await inviteMutation({ workspaceId: wsId, email });
      const link = `${window.location.origin}/sign-in?inviteId=${inviteId}&email=${encodeURIComponent(email)}`;
      setInviteLink(link);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create invite');
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

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (workspace === undefined || members === undefined) {
    return (
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="prism-brand-screen flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <p>Workspace not found.</p>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
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
      <div className="max-w-4xl">
        {/* Invite form — owner only */}
        {isOwner && (
          <section className="widget mb-8 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <UserPlus className="size-4" />
              Invite a member
            </h2>

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
                {inviting && <Loader2 className="size-4 animate-spin" />}
                Invite
              </button>
            </form>

            {inviteError && (
              <p className="mt-3 text-sm text-[var(--semantic-danger)]">{inviteError}</p>
            )}

            {inviteLink && (
              <div className="mt-4 rounded-lg border border-[rgba(16,179,125,0.2)] bg-[rgba(13,140,99,0.08)] p-3.5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ember-400)]">
                  Share this invite link with them:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-[var(--input-bg)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="prism-action-primary flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Active members */}
        <section className="glass mb-6 shadow-sm">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Active members ({members.length})
            </h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {members.map((m) => (
              <li key={m._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {m.name ?? m.email ?? 'Unknown'}
                  </p>
                  {m.name && m.email && (
                    <p className="text-xs text-[var(--text-tertiary)]">{m.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`badge-pill ${
                      m.role === 'owner'
                        ? 'bg-[rgba(13,140,99,0.1)] text-[var(--ember-400)]'
                        : 'bg-white/[0.04] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {m.role}
                  </span>
                  {isOwner && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(m.userId)}
                      disabled={removingId === m.userId}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--semantic-danger)] disabled:opacity-50"
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
            ))}
          </ul>
        </section>

        {/* Pending invites — owner only */}
        {isOwner && pendingInvites && pendingInvites.length > 0 && (
          <section className="glass shadow-sm">
            <div className="border-b border-[var(--border-subtle)] px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Clock className="size-4" />
                Pending invites ({pendingInvites.length})
              </h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {pendingInvites.map((inv) => (
                <li key={inv._id} className="px-5 py-3.5">
                  <p className="text-sm text-[var(--text-secondary)]">{inv.email}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PrismWorkspaceShell>
  );
}
