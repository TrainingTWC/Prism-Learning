import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from 'convex/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import {
  Plus,
  Loader2,
  ChevronRight,
  Users,
  Brain,
  Layers,
  Palette,
  Pencil,
  Check,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';
import type { Id } from '~convex/_generated/dataModel';

export function DashboardPage() {
  const workspaces = useQuery(api.workspaces.listMine);
  const createWorkspace = useMutation(api.workspaces.create);
  const renameWorkspace = useMutation(api.workspaces.rename);
  const deleteWorkspace = useMutation(api.workspaces.remove);
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline rename (owner only — the backend enforces it too)
  const [renamingId, setRenamingId] = useState<Id<'workspaces'> | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function startRename(id: Id<'workspaces'>, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
    setRenameError(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
    setRenameError(null);
  }

  async function handleRename(e: React.FormEvent, id: Id<'workspaces'>) {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name) return;

    setRenameSaving(true);
    setRenameError(null);
    try {
      await renameWorkspace({ workspaceId: id, name });
      cancelRename();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename workspace');
    } finally {
      setRenameSaving(false);
    }
  }

  // Delete (owner only — the backend enforces it too, and independently
  // re-verifies the typed confirmation name so the check can't be skipped
  // by calling the mutation directly).
  const [deletingWs, setDeletingWs] = useState<{ id: Id<'workspaces'>; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startDelete(id: Id<'workspaces'>, name: string) {
    setDeletingWs({ id, name });
    setDeleteConfirmText('');
    setDeleteError(null);
  }

  function cancelDelete() {
    setDeletingWs(null);
    setDeleteConfirmText('');
    setDeleteError(null);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingWs || deleteConfirmText !== deletingWs.name) return;

    setDeleteSaving(true);
    setDeleteError(null);
    try {
      await deleteWorkspace({ workspaceId: deletingWs.id, confirmName: deleteConfirmText });
      cancelDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete workspace');
      setDeleteSaving(false);
    }
  }

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

  const firstWorkspace = workspaces?.[0];

  function handleFeatureCard(kind: 'workspaces' | 'build' | 'theme') {
    if (kind === 'workspaces') {
      document.getElementById('workspace-registry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!firstWorkspace) {
      setCreating(true);
      document.getElementById('workspace-registry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    void navigate({
      to: kind === 'build' ? '/w/$workspaceId/build-with-ai' : '/w/$workspaceId/theme',
      params: { workspaceId: firstWorkspace._id },
    });
  }

  return (
    <PrismWorkspaceShell
      active="home"
      overline="AI-native SCORM authoring"
      title="Prism Authoring"
      subtitle="Build mobile-first learning modules, generate structured course content from documents, and export SCORM packages from one operational authoring system."
      showPageHeader={false}
    >
        <section className="animate-fadeInUp pt-10 lg:pt-16">
          <p className="mb-5 text-overline">AI-native SCORM authoring</p>
          <h2 className="text-[clamp(3rem,8vw,5.5rem)] font-extrabold uppercase leading-none tracking-tight text-[var(--obsidian-50)]">
            Prism <span className="text-gradient-ember">Authoring</span>
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--text-tertiary)]">
            Build mobile-first learning modules, generate structured course content from documents,
            and export SCORM packages from one operational authoring system.
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { kind: 'workspaces' as const, icon: Layers, title: 'Workspaces', description: 'Organize authoring systems by team, client, or learning program.' },
            { kind: 'build' as const, icon: Brain, title: 'AI Builder', description: 'Turn briefs, PDFs, DOCX files, images, and video into complete modules.' },
            { kind: 'theme' as const, icon: Palette, title: 'Brand System', description: 'Control colour, type, shape, and learner-facing presentation.' },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <button key={card.title} type="button" onClick={() => handleFeatureCard(card.kind)} className={`glass glass-interactive animate-fadeInUp stagger-${index + 2} p-6 text-left`}>
                <div className="prism-icon-tile mb-5 size-12 rounded-xl">
                  <Icon className="size-5" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">{card.title}</h2>
                <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">{card.description}</p>
                <div className="mt-5 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ember-400)]">
                  Open <ChevronRight className="size-3.5" />
                </div>
              </button>
            );
          })}
        </section>

        <section id="workspace-registry" className="mt-12 flex scroll-mt-24 flex-col justify-between gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-overline mb-2">Workspace registry</p>
            <h2 className="text-[32px] font-extrabold tracking-tight text-[var(--obsidian-100)]">Authoring environments</h2>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">Launch and manage your collaborative learning production spaces.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          >
            <Plus className="size-4" />
            New workspace
          </button>
        </section>

        {/* New workspace form */}
        {creating && (
          <div className="glass mt-6 p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">New workspace name</h2>
            <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Onboarding 2025"
                className="block flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50"
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
                className="rounded-lg border border-[var(--border-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
              >
                Cancel
              </button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-[var(--semantic-danger)]">{error}</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {workspaces === undefined && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Loader2 className="size-4 animate-spin" />
            Loading workspaces…
          </div>
        )}

        {/* Empty state */}
        {workspaces !== undefined && workspaces.length === 0 && !creating && (
          <div className="glass mt-6 border-dashed p-12 text-center">
            <div className="prism-icon-tile mx-auto mb-4 size-12 rounded-xl">
              <Plus className="size-6" />
            </div>
            <h2 className="mb-1 text-base font-bold text-[var(--text-primary)]">No workspaces yet</h2>
            <p className="mb-5 text-sm text-[var(--text-tertiary)]">
              Create your first workspace to start building learning modules.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="prism-action-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
            >
              <Plus className="size-4" />
              Create workspace
            </button>
          </div>
        )}

        {/* Workspace list */}
        {workspaces && workspaces.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const roleBadge = (
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`badge-pill ${
                      ws.role === 'owner'
                        ? 'bg-[rgba(140,67,208,0.1)] text-[var(--ember-400)]'
                        : 'bg-white/[0.04] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {ws.role}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Users className="size-3" />
                    Members
                  </span>
                </div>
              );

              // Rename mode — a plain card (not a Link) so typing and the
              // action buttons don't navigate into the workspace.
              if (renamingId === ws._id) {
                return (
                  <div key={ws._id} className="widget p-5">
                    <form onSubmit={(e) => void handleRename(e, ws._id)}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelRename();
                          }}
                          aria-label="Workspace name"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--border-primary)] bg-transparent px-2.5 py-1.5 text-sm font-bold text-[var(--text-primary)] outline-none"
                        />
                        <button
                          type="submit"
                          disabled={renameSaving || !renameValue.trim()}
                          title="Save name"
                          className="prism-action-primary flex shrink-0 items-center rounded-lg p-1.5 disabled:opacity-50"
                        >
                          {renameSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          title="Cancel"
                          className="shrink-0 rounded-lg border border-[var(--border-primary)] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </form>
                    {roleBadge}
                    {renameError && (
                      <p className="mt-2 text-xs text-[var(--semantic-danger)]">{renameError}</p>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={ws._id}
                  to="/w/$workspaceId"
                  params={{ workspaceId: ws._id }}
                  className="widget group flex items-center justify-between p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--text-primary)]">{ws.name}</p>
                    {roleBadge}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ws.role === 'owner' && (
                      <button
                        type="button"
                        title="Rename workspace"
                        aria-label={`Rename ${ws.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startRename(ws._id, ws.name);
                        }}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--card-bg-hover)] hover:text-[var(--ember-400)] focus:opacity-100 group-hover:opacity-100"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                    {ws.role === 'owner' && (
                      <button
                        type="button"
                        title="Delete workspace"
                        aria-label={`Delete ${ws.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startDelete(ws._id, ws.name);
                        }}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--semantic-danger)] focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <ChevronRight className="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--ember-400)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Delete workspace confirmation — portaled to document.body so it
            renders as a true full-viewport overlay regardless of any
            ancestor's stacking context (see e700013 / 5326474). */}
        {deletingWs && createPortal(
          <div className="prism-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-md">
            <div className="my-auto w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-5 shadow-2xl">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-[var(--semantic-danger)]">
                  <AlertTriangle className="size-4.5" />
                </div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Delete workspace</h2>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-tertiary)]">
                This removes <strong className="text-[var(--text-secondary)]">{deletingWs.name}</strong> and
                every member's access to it. Its modules stay stored but become unreachable from the app —
                this isn't a quick undo.
              </p>
              <form onSubmit={(e) => void handleDelete(e)} className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-tertiary)]">
                  Type <span className="font-mono text-[var(--text-secondary)]">{deletingWs.name}</span> to
                  confirm
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && cancelDelete()}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                />
                {deleteError && (
                  <p className="mt-2 text-xs text-[var(--semantic-danger)]">{deleteError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelDelete}
                    className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteSaving || deleteConfirmText !== deletingWs.name}
                    className="flex items-center gap-2 rounded-lg bg-[var(--semantic-danger)] px-3.5 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {deleteSaving && <Loader2 className="size-4 animate-spin" />}
                    Delete workspace
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </PrismWorkspaceShell>
  );
}
