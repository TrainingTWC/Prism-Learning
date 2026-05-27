import { useConvexAuth } from 'convex/react';
import { useEffect } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { api } from '~convex/_generated/api';

export function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const acceptInvites = useMutation(api.members.acceptPendingInvites);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/sign-in', replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Accept any pending workspace invites on first auth
  useEffect(() => {
    if (isAuthenticated) {
      void acceptInvites({});
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

  return <Outlet />;
}
