import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  Plus,
  Loader2,
  Layers,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';
import { TemplateGalleryDialog } from '../components/TemplateGalleryDialog';
import { LayoutGrid } from 'lucide-react';

export function ModuleListPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/modules' });
  const wsId = workspaceId as Id<'workspaces'>;
  const navigate = useNavigate();

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const modules = useQuery(api.modules.list, { workspaceId: wsId });

  const createModule = useMutation(api.modules.create);
  const renameModule = useMutation(api.modules.rename);
  const duplicateModule = useMutation(api.modules.duplicate);
  const deleteModule = useMutation(api.modules.softDelete);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    setCreating(false);
    setNewTitle('');
    const id = await createModule({ workspaceId: wsId, title: title || 'Untitled Module' });
    void navigate({ to: '/w/$workspaceId/m/$moduleId', params: { workspaceId, moduleId: id } });
  }

  async function handleRename(moduleId: Id<'modules'>) {
    if (!renameValue.trim()) return;
    await renameModule({ moduleId, title: renameValue.trim() });
    setRenamingId(null);
    setRenameValue('');
  }

  async function handleDuplicate(moduleId: Id<'modules'>) {
    setOpenMenuId(null);
    const newId = await duplicateModule({ moduleId });
    void navigate({ to: '/w/$workspaceId/m/$moduleId', params: { workspaceId, moduleId: newId } });
  }

  async function handleDelete(moduleId: Id<'modules'>) {
    setOpenMenuId(null);
    await deleteModule({ moduleId });
  }

  if (workspace === undefined || modules === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? 'Workspace'}
      workspaceRole={workspace?.role}
      active="modules"
      overline="Module Builder"
      title="Learning module registry"
      subtitle="Manage authoring drafts, AI-generated modules, and SCORM-ready learning experiences."
      actions={(
        <>
          <Link
            to="/w/$workspaceId/build-with-ai"
            params={{ workspaceId }}
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(16,179,125,0.22)] bg-[rgba(16,179,125,0.08)] px-3 py-2 text-sm font-bold text-[var(--ember-400)] transition hover:bg-[rgba(16,179,125,0.12)]"
          >
            <Sparkles className="size-4" />
            Build with AI
          </Link>
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-bg-hover)] px-3 py-2 text-sm font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            <LayoutGrid className="size-4" />
            Use template
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="prism-action-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold"
          >
            <Plus className="size-4" />
            New module
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        {/* New module inline form */}
        {creating && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="glass flex items-center gap-2 p-4"
          >
            <Layers className="size-5 shrink-0 text-[var(--ember-400)]" />
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              placeholder="Module title…"
              className="flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              className="prism-action-primary rounded-md px-3 py-1.5 text-xs font-bold"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
            >
              Cancel
            </button>
          </form>
        )}

        {modules.length === 0 && !creating && (
          <div className="glass flex flex-col items-center justify-center border-2 border-dashed py-20 text-center">
            <div className="prism-icon-tile mb-4 size-12 rounded-xl"><Layers className="size-5" /></div>
            <p className="font-bold text-[var(--text-primary)]">No modules yet</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Start from a template or create a blank module.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="prism-action-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <LayoutGrid className="size-4" />
                Browse templates
              </button>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-bg-hover)] px-4 py-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Plus className="size-4" />
                New blank module
              </button>
            </div>
          </div>
        )}

        {modules.map((mod) => (
          <div
            key={mod._id}
            className="widget group relative flex items-center gap-4 px-5 py-4"
            onClick={() => openMenuId && setOpenMenuId(null)}
          >
            <div className="prism-icon-tile size-10 shrink-0 rounded-lg"><Layers className="size-4" /></div>

            <div className="flex-1 min-w-0">
              {renamingId === mod._id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRename(mod._id as Id<'modules'>);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setRenamingId(null)}
                    onBlur={() => void handleRename(mod._id as Id<'modules'>)}
                    className="w-full rounded border px-2 py-0.5 text-sm font-semibold outline-none"
                  />
                </form>
              ) : (
                <Link
                  to="/w/$workspaceId/m/$moduleId"
                  params={{ workspaceId, moduleId: mod._id }}
                  className="block truncate text-sm font-bold text-[var(--text-primary)] hover:text-[var(--ember-400)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {mod.title}
                </Link>
              )}
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Updated {new Date(mod.updatedAt).toLocaleDateString()} ·{' '}
                <span
                  className={`badge-pill ${
                    mod.status === 'published'
                      ? 'bg-[rgba(34,197,94,0.08)] text-[var(--semantic-success)]'
                      : 'bg-[rgba(234,179,8,0.08)] text-[var(--semantic-warning)]'
                  }`}
                >
                  {mod.status}
                </span>
              </p>
            </div>

            {/* Context menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOpenMenuId(openMenuId === mod._id ? null : mod._id)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] group-hover:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {openMenuId === mod._id && (
                <div className="glass absolute right-0 top-8 z-50 w-44 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(mod._id);
                      setRenameValue(mod.title);
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="size-3.5" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(mod._id as Id<'modules'>)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="size-3.5" /> Duplicate
                  </button>
                  <hr className="my-1 border-[var(--border-subtle)]" />
                  <button
                    type="button"
                    onClick={() => void handleDelete(mod._id as Id<'modules'>)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--semantic-danger)] hover:bg-[rgba(239,68,68,0.08)]"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {showTemplates && (
        <TemplateGalleryDialog
          workspaceId={wsId}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </PrismWorkspaceShell>
  );
}
