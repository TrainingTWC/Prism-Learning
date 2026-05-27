import { useState } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import { Plus, Loader2, Sparkles, LogOut, ChevronRight, Users } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';

export function DashboardPage() {
  const workspaces = useQuery(api.workspaces.listMine);
  const createWorkspace = useMutation(api.workspaces.create);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    try {
      const id = await createWorkspace({ name });
      setNewName('');
      setCreating(false);
      void navigate({ to: '/w/$workspaceId', params: { workspaceId: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    void navigate({ to: '/sign-in', replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500" />
            <span className="text-base font-semibold">Prism Learning</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Workspaces</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Select a workspace or create a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            New workspace
          </button>
        </div>

        {/* New workspace form */}
        {creating && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-medium">New workspace name</h2>
            <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Onboarding 2025"
                className="block flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName('');
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {workspaces === undefined && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading workspaces…
          </div>
        )}

        {/* Empty state */}
        {workspaces !== undefined && workspaces.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-indigo-50">
              <Plus className="size-6 text-indigo-500" />
            </div>
            <h2 className="mb-1 text-base font-medium">No workspaces yet</h2>
            <p className="mb-5 text-sm text-slate-500">
              Create your first workspace to start building learning modules.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              Create workspace
            </button>
          </div>
        )}

        {/* Workspace list */}
        {workspaces && workspaces.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws._id}
                to="/w/$workspaceId"
                params={{ workspaceId: ws._id }}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-slate-800">{ws.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        ws.role === 'owner'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ws.role}
                    </span>
                    <Link
                      to="/w/$workspaceId/members"
                      params={{ workspaceId: ws._id }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                    >
                      <Users className="size-3" />
                      Members
                    </Link>
                  </div>
                </div>
                <ChevronRight className="size-5 text-slate-300 transition-colors group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
