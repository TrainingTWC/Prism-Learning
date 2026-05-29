import { useQuery } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { BookOpen, ChevronRight, Layers, Loader2, Palette, Plus, Sparkles, Users } from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

export function WorkspacePage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId' });
  const wsId = workspaceId as Id<'workspaces'>;
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const modules = useQuery(api.modules.list, { workspaceId: wsId });

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
      {/* ── Quick-nav cards ─────────────────────────────────────────────── */}
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

      {/* ── Modules + Style preview ─────────────────────────────────────── */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">

        {/* Recent modules */}
        <div className="widget overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-[var(--ember-400)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Modules</h2>
              {modules !== undefined && (
                <span className="rounded-full bg-[rgba(140,67,208,0.12)] px-2 py-0.5 text-[10px] font-bold text-[var(--ember-400)]">
                  {modules.length}
                </span>
              )}
            </div>
            <Link
              to="/w/$workspaceId/modules"
              params={{ workspaceId }}
              className="flex items-center gap-1 text-xs font-bold text-[var(--ember-400)] transition hover:opacity-70"
            >
              All modules <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {modules === undefined && (
            <div className="flex items-center gap-2 px-5 py-6 text-xs text-[var(--text-muted)]">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          )}

          {modules !== undefined && modules.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
              <div className="prism-icon-tile size-10 rounded-xl">
                <Layers className="size-4" />
              </div>
              <p className="text-xs text-[var(--text-muted)]">No modules yet.</p>
              <Link
                to="/w/$workspaceId/modules"
                params={{ workspaceId }}
                className="prism-action-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
              >
                <Plus className="size-3.5" /> New module
              </Link>
            </div>
          )}

          {modules !== undefined && modules.length > 0 && (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {modules.slice(0, 6).map((mod) => (
                <li key={mod._id}>
                  <Link
                    to="/w/$workspaceId/m/$moduleId"
                    params={{ workspaceId, moduleId: mod._id }}
                    className="group flex items-center justify-between px-5 py-3.5 transition hover:bg-[var(--card-bg-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--ember-400)]">
                        {mod.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        {new Date(mod.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          mod.status === 'published'
                            ? 'bg-[rgba(140,67,208,0.12)] text-[var(--ember-400)]'
                            : 'bg-[var(--input-bg)] text-[var(--text-muted)]'
                        }`}
                      >
                        {mod.status}
                      </span>
                      <ChevronRight className="size-3.5 text-[var(--text-muted)] transition group-hover:text-[var(--ember-400)]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {modules !== undefined && modules.length > 6 && (
            <div className="border-t border-[var(--border-subtle)] px-5 py-3">
              <Link
                to="/w/$workspaceId/modules"
                params={{ workspaceId }}
                className="text-xs font-bold text-[var(--ember-400)] transition hover:opacity-70"
              >
                +{modules.length - 6} more →
              </Link>
            </div>
          )}
        </div>

        {/* Brand style preview */}
        <div className="widget overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-[var(--ember-400)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Brand style</h2>
            </div>
            <Link
              to="/w/$workspaceId/theme"
              params={{ workspaceId }}
              className="flex items-center gap-1 text-xs font-bold text-[var(--ember-400)] transition hover:opacity-70"
            >
              Edit <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="p-5 space-y-5">
            {workspace.theme ? (
              <>
                {/* Color swatches */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Colors</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div
                        className="mb-1.5 h-10 w-full rounded-lg border border-black/10"
                        style={{ backgroundColor: workspace.theme.primary }}
                      />
                      <p className="text-[10px] text-[var(--text-muted)]">Primary</p>
                      <p className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">{workspace.theme.primary}</p>
                    </div>
                    <div className="flex-1">
                      <div
                        className="mb-1.5 h-10 w-full rounded-lg border border-black/10"
                        style={{ backgroundColor: workspace.theme.accent }}
                      />
                      <p className="text-[10px] text-[var(--text-muted)]">Accent</p>
                      <p className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">{workspace.theme.accent}</p>
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Typography</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between rounded-lg bg-[var(--input-bg)] px-3 py-2">
                      <span className="text-[10px] text-[var(--text-muted)]">Heading</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]" style={{ fontFamily: workspace.theme.headingFont }}>
                        {workspace.theme.headingFont}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[var(--input-bg)] px-3 py-2">
                      <span className="text-[10px] text-[var(--text-muted)]">Body</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]" style={{ fontFamily: workspace.theme.bodyFont }}>
                        {workspace.theme.bodyFont}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mini button preview */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Preview</p>
                  <div
                    className="flex items-center justify-center rounded-lg px-4 py-2 text-xs font-bold text-white"
                    style={{
                      backgroundColor: workspace.theme.primary,
                      borderRadius: workspace.theme.borderRadius === 'sharp' ? '4px' : workspace.theme.borderRadius === 'pill' ? '999px' : '8px',
                    }}
                  >
                    Sample button
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">No brand theme set yet.</p>
                <Link
                  to="/w/$workspaceId/theme"
                  params={{ workspaceId }}
                  className="text-xs font-bold text-[var(--ember-400)] transition hover:opacity-70"
                >
                  Set up brand theme →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PrismWorkspaceShell>
  );
}
