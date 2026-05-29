import { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { useNavigate } from '@tanstack/react-router';
import { X, Sparkles, Loader2, Layers } from 'lucide-react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { MODULE_TEMPLATES, type ModuleTemplate } from '../lib/moduleTemplates';

const CATEGORIES = ['All', 'Onboarding', 'Compliance', 'Product', 'Safety', 'Microlearning', 'Sales'] as const;
type Category = (typeof CATEGORIES)[number];

export function TemplateGalleryDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: Id<'workspaces'>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const createFromTemplate = useMutation(api.modules.createFromTemplate);

  const [category, setCategory] = useState<Category>('All');
  const [selected, setSelected] = useState<ModuleTemplate | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    if (category === 'All') return MODULE_TEMPLATES;
    return MODULE_TEMPLATES.filter((t) => t.category === category);
  }, [category]);

  async function handleUse(tpl: ModuleTemplate) {
    setImporting(true);
    try {
      const moduleId = await createFromTemplate({
        workspaceId,
        title: tpl.suggestedTitle,
        lessons: tpl.lessons.map((l) => ({
          title: l.title,
          blocks: l.blocks.map((b) => ({ type: b.type as never, content: b.content })),
        })),
      });
      onClose();
      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId: workspaceId as string, moduleId: moduleId as string },
      });
    } catch (err) {
      console.error('Template import failed', err);
      setImporting(false);
    }
  }

  const totalBlocks = (tpl: ModuleTemplate) =>
    tpl.lessons.reduce((sum, l) => sum + l.blocks.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a template"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--ember-400)]">
              <Sparkles className="size-3.5" />
              Start from a template
            </div>
            <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Module templates</h2>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Pick a starting point — edit everything once it’s imported into your workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] px-6 py-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                category === c
                  ? 'bg-[var(--ember-400)] text-black'
                  : 'bg-[var(--card-bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelected(tpl)}
              className={`group flex flex-col overflow-hidden rounded-xl border text-left transition ${
                selected?.id === tpl.id
                  ? 'border-[var(--ember-400)] ring-2 ring-[var(--ember-400)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--ember-400)]'
              }`}
            >
              <div
                className={`flex h-28 items-center justify-center bg-gradient-to-br text-5xl ${tpl.gradient}`}
              >
                <span aria-hidden="true">{tpl.glyph}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <span className="badge-pill bg-[rgba(170,117,221,0.1)] text-[var(--ember-400)]">
                    {tpl.category}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {tpl.lessons.length} lesson{tpl.lessons.length === 1 ? '' : 's'} · {totalBlocks(tpl)} blocks
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{tpl.name}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{tpl.description}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-[var(--text-muted)]">
              No templates in this category yet.
            </div>
          )}
        </div>

        {/* Footer with selection preview */}
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] p-4">
          {selected ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xl ${selected.gradient}`}>
                {selected.glyph}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{selected.name}</p>
                <p className="truncate text-xs text-[var(--text-tertiary)]">
                  Will create “{selected.suggestedTitle}” with {selected.lessons.length} lesson
                  {selected.lessons.length === 1 ? '' : 's'}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Layers className="size-4" />
              Select a template to preview
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || importing}
              onClick={() => selected && void handleUse(selected)}
              className="prism-action-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Use this template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
