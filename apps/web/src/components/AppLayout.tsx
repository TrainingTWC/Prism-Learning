import { useConvexAuth } from 'convex/react';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { api } from '~convex/_generated/api';
import { CheckCircle2, X } from 'lucide-react';

export function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const acceptInvites = useMutation(api.members.acceptPendingInvites);
  const [joinedWorkspaces, setJoinedWorkspaces] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/sign-in', replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Accept any pending workspace invites on first auth, show notification if any
  useEffect(() => {
    if (isAuthenticated) {
      void acceptInvites({}).then((joined) => {
        if (joined && joined.length > 0) setJoinedWorkspaces(joined);
      });
    }
  }, [isAuthenticated, acceptInvites]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <Outlet />
      {/* Workspace-joined toast */}
      {joinedWorkspaces.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-2">
          {joinedWorkspaces.map((name) => (
            <div
              key={name}
              className="flex items-start gap-3 rounded-xl border border-[rgba(16,179,125,0.25)] bg-[var(--card-bg)] px-4 py-3 shadow-xl"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--ember-400)]" />
              <p className="flex-1 text-sm text-[var(--text-primary)]">
                You've been added to <span className="font-semibold">{name}</span>
              </p>
              <button
                type="button"
                onClick={() => setJoinedWorkspaces((prev) => prev.filter((n) => n !== name))}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
