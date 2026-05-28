import { useQuery } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Layers, Loader2, Palette, Sparkles, Users } from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

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
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      workspaceRole={workspace.role}
      active="overview"
      overline="Workspace intelligence"
      title="Operational learning studio"
      subtitle="Coordinate modules, AI generation, brand controls, and team access from one production dashboard."
      actions={(
        <Link to="/w/$workspaceId/build-with-ai" params={{ workspaceId }} className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold">
          <Sparkles className="size-4" />
          Build with AI
        </Link>
      )}
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Link to="/w/$workspaceId/modules" params={{ workspaceId }} className="widget p-6">
          <div className="prism-icon-tile mb-5 size-12 rounded-xl"><Layers className="size-5" /></div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Module Builder</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--obsidian-50)] font-mono-value">Author</h2>
          <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">Create, revise, preview, and export mobile-first SCORM learning modules.</p>
        </Link>
        <Link to="/w/$workspaceId/theme" params={{ workspaceId }} className="widget p-6">
          <div className="prism-icon-tile mb-5 size-12 rounded-xl"><Palette className="size-5" /></div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Brand System</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--obsidian-50)] font-mono-value">Style</h2>
          <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">Tune colors, typography, radii, and learner presentation across exports.</p>
        </Link>
        <Link to="/w/$workspaceId/members" params={{ workspaceId }} className="widget p-6">
          <div className="prism-icon-tile mb-5 size-12 rounded-xl"><Users className="size-5" /></div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Access Control</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--obsidian-50)] font-mono-value">Team</h2>
          <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">Invite collaborators and control authoring access for this workspace.</p>
        </Link>
      </div>
    </PrismWorkspaceShell>
  );
}
