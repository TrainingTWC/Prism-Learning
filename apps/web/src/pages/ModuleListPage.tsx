import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  Plus,
  ChevronLeft,
  Loader2,
  Layers,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Sparkles,
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/w/$workspaceId"
              params={{ workspaceId }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div>
              <p className="text-xs text-slate-400">{workspace?.name ?? '—'}</p>
              <h1 className="text-lg font-semibold text-slate-800">Modules</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/w/$workspaceId/build-with-ai"
              params={{ workspaceId }}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 transition"
            >
              <Sparkles className="size-4" />
              Build with AI
            </Link>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              New module
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-3">
        {/* New module inline form */}
        {creating && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-white p-4 shadow-sm"
          >
            <Layers className="size-5 shrink-0 text-indigo-400" />
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              placeholder="Module title…"
              className="flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </form>
        )}

        {modules.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
            <Layers className="mb-4 size-10 text-slate-300" />
            <p className="font-medium text-slate-500">No modules yet</p>
            <p className="mt-1 text-sm text-slate-400">Create your first learning module to get started.</p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              New module
            </button>
          </div>
        )}

        {modules.map((mod) => (
          <div
            key={mod._id}
            className="group relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
            onClick={() => openMenuId && setOpenMenuId(null)}
          >
            <Layers className="size-5 shrink-0 text-indigo-400" />

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
                    className="w-full rounded border border-indigo-300 px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </form>
              ) : (
                <Link
                  to="/w/$workspaceId/m/$moduleId"
                  params={{ workspaceId, moduleId: mod._id }}
                  className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  {mod.title}
                </Link>
              )}
              <p className="mt-0.5 text-xs text-slate-400">
                Updated {new Date(mod.updatedAt).toLocaleDateString()} ·{' '}
                <span
                  className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    mod.status === 'published'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
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
                className="rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 transition-opacity"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {openMenuId === mod._id && (
                <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(mod._id);
                      setRenameValue(mod.title);
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="size-3.5" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(mod._id as Id<'modules'>)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="size-3.5" /> Duplicate
                  </button>
                  <hr className="my-1 border-slate-100" />
                  <button
                    type="button"
                    onClick={() => void handleDelete(mod._id as Id<'modules'>)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
