import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  ArrowRight,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Search,
  Sparkles,
  FolderInput,
  X,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

type Filter = 'all' | 'draft' | 'published';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

function CoverTile({ title, coverUrl, className = '' }: { title: string; coverUrl: string | null; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#7B35C1] ${className}`}>
      {coverUrl ? (
        <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-end bg-gradient-to-br from-[#8C43D0] to-[#5E2A8E] p-3.5">
          <span className="line-clamp-2 text-[15px] font-bold leading-snug text-white">{title}</span>
        </div>
      )}
    </div>
  );
}

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
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  // Anchored to the clicked button's rect and portaled to document.body so the
  // dropdown can never be trapped behind a sibling card's stacking context.
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

  const counts = useMemo(() => {
    const list = modules ?? [];
    return {
      all: list.length,
      draft: list.filter((m) => m.status !== 'published').length,
      published: list.filter((m) => m.status === 'published').length,
    };
  }, [modules]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (modules ?? []).filter((m) => {
      if (filter === 'draft' && m.status === 'published') return false;
      if (filter === 'published' && m.status !== 'published') return false;
      return !q || m.title.toLowerCase().includes(q);
    });
  }, [modules, filter, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    setCreating(false);
    setNewTitle('');
    const id = await createModule({ workspaceId: wsId, title: title || 'Untitled Module' });
    void navigate({ to: '/w/$workspaceId/m/$moduleId/outline', params: { workspaceId, moduleId: id } });
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
    void navigate({ to: '/w/$workspaceId/m/$moduleId/outline', params: { workspaceId, moduleId: newId } });
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
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  const latest = modules[0];
  const openMenuModule = openMenu ? modules.find((m) => m._id === openMenu.id) : undefined;

  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? 'Workspace'}
      workspaceRole={workspace?.role}
      active="modules"
      title="Modules"
      showPageHeader={false}
    >
      <div className="mx-auto flex max-w-[1120px] flex-col gap-7">
        {/* Header */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 basis-80">
            <h1 className="m-0 text-[30px] font-bold tracking-[-0.02em] text-ink">Modules</h1>
            <p className="mt-1.5 text-[15px] text-ink-2">
              {modules.length} {modules.length === 1 ? 'module' : 'modules'}
            </p>
          </div>
          <Link
            to="/w/$workspaceId/build-with-ai"
            params={{ workspaceId }}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-hover hover:text-ink"
          >
            <Sparkles className="size-4 text-brand" />
            Build with AI
          </Link>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink"
          >
            <Plus className="size-4" />
            New module
          </button>
        </div>

        {creating && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex items-center gap-2 rounded-[18px] border border-line bg-white p-4"
          >
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              placeholder="Module title…"
              className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink-3"
            />
            <button type="submit" className="h-9 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink">
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="h-9 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-hover"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Continue editing */}
        {latest && (
          <Link
            to="/w/$workspaceId/m/$moduleId"
            params={{ workspaceId, moduleId: latest._id }}
            search={{}}
            className="flex flex-wrap items-center gap-6 rounded-[18px] border border-line bg-white p-5 text-ink transition hover:text-ink hover:shadow-[0_2px_4px_rgba(23,23,28,0.06),0_12px_28px_rgba(23,23,28,0.08)]"
          >
            <CoverTile title={latest.title} coverUrl={latest.coverUrl} className="h-28 w-[200px] shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-brand">Pick up where you left off</span>
              <span className="truncate text-xl font-bold">{latest.title}</span>
              <span className="text-sm text-ink-2">Edited {relativeTime(latest.updatedAt)}</span>
            </div>
            <span className="flex h-10 items-center gap-2 rounded-[10px] bg-brand-soft px-4 text-sm font-semibold text-brand-ink">
              Continue editing
              <ArrowRight className="size-4" />
            </span>
          </Link>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-[10px] bg-[#EDEDF1] p-[3px]">
            {(
              [
                ['all', 'All'],
                ['draft', 'Drafts'],
                ['published', 'Published'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`h-8 rounded-lg px-3 text-[13px] ${
                  filter === id ? 'bg-white font-semibold text-ink shadow-sm' : 'text-ink-2'
                }`}
              >
                {label} <span className="font-normal text-ink-3">{counts[id]}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="flex h-[38px] min-w-60 items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-ink-3">
            <Search className="size-4" />
            <span className="sr-only">Search modules</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules"
              className="flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </label>
        </div>

        {/* Grid */}
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[268px] flex-col items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[#D4D4DC] bg-transparent text-sm text-ink-2 transition hover:bg-white"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-white text-brand">
              <Plus className="size-5" />
            </span>
            <span className="font-semibold text-ink">Blank module</span>
          </button>

          {shown.map((mod) => {
            const published = mod.status === 'published';
            return (
              <div
                key={mod._id}
                className="group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-white transition hover:shadow-[0_2px_4px_rgba(23,23,28,0.06),0_12px_28px_rgba(23,23,28,0.08)]"
              >
                <Link
                  to="/w/$workspaceId/m/$moduleId/outline"
                  params={{ workspaceId, moduleId: mod._id }}
                  className="block text-ink hover:text-ink"
                  aria-label={`Open ${mod.title}`}
                >
                  <div className="relative">
                    <CoverTile title={mod.title} coverUrl={mod.coverUrl} className="h-[132px]" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                      <span
                        className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${
                          published ? 'bg-[#EAF6EF] text-[#1A7F4B]' : 'bg-[#FDF1E4] text-[#9A4A0B]'
                        }`}
                      >
                        {published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <span className="absolute bottom-2.5 right-3 rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white">
                      {mod.lessonCount} {mod.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </div>
                </Link>
                <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 pt-3.5">
                  {renamingId === mod._id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleRename(mod._id as Id<'modules'>);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setRenamingId(null)}
                        onBlur={() => void handleRename(mod._id as Id<'modules'>)}
                        className="w-full rounded-lg border border-brand bg-white px-2 py-1 text-sm font-semibold outline-none"
                      />
                    </form>
                  ) : (
                    <Link
                      to="/w/$workspaceId/m/$moduleId/outline"
                      params={{ workspaceId, moduleId: mod._id }}
                      className="text-[15px] font-semibold leading-snug text-ink hover:text-brand-ink"
                    >
                      {mod.title}
                    </Link>
                  )}
                  <span className="mt-auto text-xs text-ink-3">Edited {relativeTime(mod.updatedAt)}</span>
                </div>

                {/* Context menu — portaled to document.body (see openMenu comment above) */}
                <button
                  type="button"
                  aria-label={`Actions for ${mod.title}`}
                  onClick={(e) => {
                    if (openMenu?.id === mod._id) {
                      setOpenMenu(null);
                      return;
                    }
                    setOpenMenu({ id: mod._id, rect: e.currentTarget.getBoundingClientRect() });
                  }}
                  className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-lg bg-white/90 text-ink-2 opacity-0 shadow-sm transition hover:bg-white hover:text-ink focus:opacity-100 group-hover:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            );
          })}
        </div>

        {shown.length === 0 && modules.length > 0 && (
          <p className="py-6 text-center text-sm text-ink-3">No modules match your filters.</p>
        )}
      </div>

      {openMenu && openMenuModule && createPortal(
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed z-50 w-44 rounded-xl border border-line bg-white py-1 shadow-xl"
            style={{
              top: openMenu.rect.bottom + 6,
              right: window.innerWidth - openMenu.rect.right,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setRenamingId(openMenuModule._id);
                setRenameValue(openMenuModule.title);
                setOpenMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink"
            >
              <Pencil className="size-3.5" /> Rename
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicate(openMenuModule._id as Id<'modules'>)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink"
            >
              <Copy className="size-3.5" /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setMovingModuleId(openMenuModule._id as Id<'modules'>);
                setOpenMenu(null);
                setMoveError(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink"
            >
              <FolderInput className="size-3.5" /> Move to workspace
            </button>
            <hr className="my-1 border-line" />
            <button
              type="button"
              onClick={() => void handleDelete(openMenuModule._id as Id<'modules'>)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </>,
        document.body,
      )}

      {movingModuleId !== null && createPortal(
        <div className="prism-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-md">
          <div className="my-auto flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-bold text-ink">Move module to workspace</p>
              <button
                type="button"
                onClick={() => {
                  setMovingModuleId(null);
                  setMoveError(null);
                }}
                className="rounded-lg p-1 text-ink-3 hover:bg-hover hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {moveError && (
                <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {moveError}
                </p>
              )}
              {myWorkspaces === undefined ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-brand" />
                </div>
              ) : (
                (() => {
                  const destinations = myWorkspaces.filter((ws) => ws._id !== wsId);
                  if (destinations.length === 0) {
                    return (
                      <p className="px-2 py-4 text-center text-sm text-ink-3">
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
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-2 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
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
