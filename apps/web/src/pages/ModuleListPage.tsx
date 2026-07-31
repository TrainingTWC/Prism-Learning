import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  FolderInput,
  X,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

export function ModuleListPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/modules' });
  const wsId = workspaceId as Id<'workspaces'>;
  const navigate = useNavigate();

  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const modules = useQuery(api.modules.list, { workspaceId: wsId });
  const myWorkspaces = useQuery(api.workspaces.listMine);

  const createModule = useMutation(api.modules.create);
  const renameModule = useMutation(api.modules.rename);
  const duplicateModule = useMutation(api.modules.duplicate);
  const deleteModule = useMutation(api.modules.softDelete);
  const moveModule = useMutation(api.modules.move);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  // Anchored to the clicked button's rect (not CSS-relative positioning)
  // and portaled to document.body — the row is a .widget, and .widget:hover
  // applies a transform, which makes the row a new stacking context. A
  // plain `absolute` dropdown nested inside gets trapped in that context
  // and can render behind later sibling rows despite z-50. Same class of
  // bug as the move-to-workspace dialog fixed in 5326474; same fix.
  const [openMenu, setOpenMenu] = useState<{ id: string; rect: DOMRect } | null>(null);

  // A stale rect looks worse than a closed menu — drop it if the page
  // scrolls or resizes while it's open instead of drifting off the button.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingModuleId, setMovingModuleId] = useState<Id<'modules'> | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

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
    setOpenMenu(null);
    const newId = await duplicateModule({ moduleId });
    void navigate({ to: '/w/$workspaceId/m/$moduleId', params: { workspaceId, moduleId: newId } });
  }

  async function handleDelete(moduleId: Id<'modules'>) {
    setOpenMenu(null);
    await deleteModule({ moduleId });
  }

  async function handleMove(destinationWorkspaceId: Id<'workspaces'>) {
    if (!movingModuleId) return;
    setMoving(true);
    setMoveError(null);
    try {
      await moveModule({ moduleId: movingModuleId, destinationWorkspaceId });
      setMovingModuleId(null);
    } catch (e: unknown) {
      const err = e as { data?: string; message?: string };
      setMoveError(err.data ?? err.message ?? 'Could not move module');
    } finally {
      setMoving(false);
    }
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
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(170,117,221,0.22)] bg-[rgba(170,117,221,0.08)] px-3 py-2 text-sm font-bold text-[var(--ember-400)] transition hover:bg-[rgba(170,117,221,0.12)]"
          >
            <Sparkles className="size-4" />
            Build with AI
          </Link>
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
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Create a blank module or let AI build one for you.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="prism-action-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <Plus className="size-4" />
                New module
              </button>
            </div>
          </div>
        )}

        {modules.map((mod) => (
          <div
            key={mod._id}
            className="widget group relative flex items-center gap-4 px-5 py-4"
            onClick={() => openMenu && setOpenMenu(null)}
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

            {/* Context menu — portaled to document.body (see openMenu comment above) */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  if (openMenu?.id === mod._id) {
                    setOpenMenu(null);
                    return;
                  }
                  setOpenMenu({ id: mod._id, rect: e.currentTarget.getBoundingClientRect() });
                }}
                className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] group-hover:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {openMenu?.id === mod._id && createPortal(
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setOpenMenu(null)} />
                  <div
                    className="glass fixed z-50 w-44 py-1"
                    style={{
                      top: openMenu.rect.bottom + 6,
                      right: window.innerWidth - openMenu.rect.right,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(mod._id);
                        setRenameValue(mod.title);
                        setOpenMenu(null);
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
                    <button
                      type="button"
                      onClick={() => {
                        setMovingModuleId(mod._id as Id<'modules'>);
                        setOpenMenu(null);
                        setMoveError(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <FolderInput className="size-3.5" /> Move to workspace
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
                </>,
                document.body,
              )}
            </div>
          </div>
        ))}
      </div>

      {movingModuleId !== null && createPortal(
        <div className="prism-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-md">
          <div className="my-auto flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--text-primary)]">Move module to workspace</p>
              <button
                type="button"
                onClick={() => {
                  setMovingModuleId(null);
                  setMoveError(null);
                }}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {moveError && (
                <p className="mb-2 rounded-lg bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs font-semibold text-[var(--semantic-danger)]">
                  {moveError}
                </p>
              )}
              {myWorkspaces === undefined ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-indigo-500" />
                </div>
              ) : (
                (() => {
                  const destinations = myWorkspaces.filter((ws) => ws._id !== wsId);
                  if (destinations.length === 0) {
                    return (
                      <p className="px-2 py-4 text-center text-sm text-[var(--text-tertiary)]">
                        You&apos;re not a member of any other workspace yet.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      {destinations.map((ws) => (
                        <button
                          key={ws._id}
                          type="button"
                          disabled={moving}
                          onClick={() => void handleMove(ws._id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ws.name}
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </PrismWorkspaceShell>
  );
}
