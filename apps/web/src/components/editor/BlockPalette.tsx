import { useMemo, useState } from 'react';
import { FileInput, Search } from 'lucide-react';
import { CATEGORIES, filterCatalog } from './blockCatalog';
import type { EditorBlockType } from './types';

interface BlockPaletteProps {
  /** e.g. "Adds after: Text" / "Adds at end of lesson". */
  insertionLabel: string;
  disabled: boolean;
  onInsert: (type: EditorBlockType) => void;
  onImportQuestions: () => void;
}

const IMPORT_WORDS = ['import', 'quiz', 'question', 'csv'];

const TILE_CLASS =
  'flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-[12px] border border-line bg-white p-2.5 text-left hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

export function BlockPalette({ insertionLabel, disabled, onInsert, onImportQuestions }: BlockPaletteProps) {
  const [query, setQuery] = useState('');

  const entries = useMemo(() => filterCatalog(query, 'all'), [query]);
  const q = query.trim().toLowerCase();
  const showImport = q === '' || IMPORT_WORDS.some((w) => w.startsWith(q) || q.includes(w));

  const groups = CATEGORIES.map((c) => ({
    category: c,
    items: entries.filter((e) => e.category === c.id),
    withImport: c.id === 'knowledge' && showImport,
  })).filter((g) => g.items.length > 0 || g.withImport);

  return (
    <aside aria-label="Blocks" className="flex w-[264px] shrink-0 flex-col border-l border-line bg-white">
      <div className="border-b border-line p-4">
        <h2 className="text-sm font-semibold text-ink">Blocks</h2>
        <p className="mt-0.5 truncate text-xs text-ink-3" title={insertionLabel}>
          {insertionLabel}
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="h-9 w-full rounded-[10px] border border-line bg-ground pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">No blocks match &ldquo;{query}&rdquo;</p>
        ) : (
          groups.map(({ category, items, withImport }) => (
            <section key={category.id} className="mb-5" aria-label={category.label}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                {category.label}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {items.map((e) => {
                  const Icon = e.icon;
                  return (
                    <button
                      key={e.type}
                      type="button"
                      disabled={disabled}
                      title={e.description}
                      onClick={() => onInsert(e.type)}
                      className={TILE_CLASS}
                    >
                      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-xs font-semibold text-ink">{e.label}</span>
                    </button>
                  );
                })}
                {withImport && (
                  <button
                    type="button"
                    disabled={disabled}
                    title="Bring in quiz questions from a checklist or CSV"
                    onClick={onImportQuestions}
                    className={`${TILE_CLASS} border-dashed`}
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                      <FileInput className="size-4" />
                    </span>
                    <span className="text-xs font-semibold text-ink">Import questions</span>
                  </button>
                )}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-line px-4 py-3 text-xs text-ink-3">
        <p>
          Press <kbd className="rounded border border-line px-1">/</kbd> to search blocks
        </p>
        <p className="mt-1">
          <kbd className="rounded border border-line px-1">Esc</kbd> to deselect
        </p>
      </div>
    </aside>
  );
}
