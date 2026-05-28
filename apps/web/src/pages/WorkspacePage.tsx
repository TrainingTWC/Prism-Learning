import { useQuery } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ChevronLeft, Users, Layers, Loader2, Palette } from 'lucide-react';

export function WorkspacePage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId' });
  const wsId = workspaceId as Id<'workspaces'>;
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });

  if (workspace === undefined) {
    return (
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="prism-brand-screen flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <p>Workspace not found or you don&apos;t have access.</p>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
          Back to workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="prism-brand-screen flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link
            to="/"
            className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft className="size-3.5" />
            All workspaces
          </Link>
          <p className="prism-kicker truncate">Prism Studio</p>
          <p className="truncate text-sm font-semibold text-slate-800">{workspace.name}</p>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              workspace.role === 'owner'
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {workspace.role}
          </span>
        </div>

        <nav className="p-2">
          <Link
            to="/w/$workspaceId/modules"
            params={{ workspaceId }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          >
            <Layers className="size-4" /> Modules
          </Link>
          <Link
            to="/w/$workspaceId/members"
            params={{ workspaceId }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          >
            <Users className="size-4" /> Members
          </Link>
          <Link
            to="/w/$workspaceId/theme"
            params={{ workspaceId }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          >
            <Palette className="size-4" /> Theme
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="border-b border-slate-200 bg-white px-6 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{workspace.name}</p>
            <Link
              to="/w/$workspaceId/members"
              params={{ workspaceId }}
              className="text-sm text-indigo-600"
            >
              Members
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center p-10">
          <div className="prism-glass-card max-w-sm rounded-3xl p-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-indigo-50">
              <Layers className="size-7 text-indigo-400" strokeWidth={1.5} />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Ready to build</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Create and manage learning modules for this workspace.
            </p>
            <Link
              to="/w/$workspaceId/modules"
              params={{ workspaceId }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Layers className="size-4" />
              View modules
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
