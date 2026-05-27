import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { MemberDoc, PendingInviteDoc } from '~convex/_generated/api';
import {
  ChevronLeft,
  Loader2,
  UserPlus,
  Trash2,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

export function MembersPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/members' });

  const workspace = useQuery(api.workspaces.getById, { workspaceId });
  const members = useQuery(api.members.list, { workspaceId });
  const pendingInvites = useQuery(api.members.listPendingInvites, { workspaceId });

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
      const inviteId = await inviteMutation({ workspaceId, email });
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
      await removeMutation({ workspaceId, userId });
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <p>Workspace not found.</p>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
          Back to workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <Link
              to="/w/$workspaceId"
              params={{ workspaceId }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              <ChevronLeft className="size-3.5" />
              {workspace.name}
            </Link>
            <h1 className="mt-0.5 text-lg font-semibold">Members</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Invite form — owner only */}
        {isOwner && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700">
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
                className="block flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {inviting && <Loader2 className="size-4 animate-spin" />}
                Invite
              </button>
            </form>

            {inviteError && (
              <p className="mt-3 text-sm text-red-600">{inviteError}</p>
            )}

            {inviteLink && (
              <div className="mt-4 rounded-lg bg-indigo-50 p-3.5">
                <p className="mb-2 text-xs font-medium text-indigo-700">
                  Share this invite link with them:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-white px-2.5 py-1.5 text-xs text-slate-700">
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
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
        <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-medium text-slate-700">
              Active members ({members.length})
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {members.map((m: MemberDoc) => (
              <li key={m._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {m.name ?? m.email ?? 'Unknown'}
                  </p>
                  {m.name && m.email && (
                    <p className="text-xs text-slate-500">{m.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.role === 'owner'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.role}
                  </span>
                  {isOwner && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(m.userId)}
                      disabled={removingId === m.userId}
                      className="rounded p-1 text-slate-400 hover:text-red-500 disabled:opacity-50"
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
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Clock className="size-4" />
                Pending invites ({pendingInvites.length})
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {pendingInvites.map((inv: PendingInviteDoc) => (
                <li key={inv._id} className="px-5 py-3.5">
                  <p className="text-sm text-slate-700">{inv.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
