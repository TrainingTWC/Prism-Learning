import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileInput, Search, X } from 'lucide-react';
import { BLOCK_CATALOG, CATEGORIES, filterCatalog, type CategoryId } from './blockCatalog';
import type { EditorBlockType } from './types';

interface BlockLibraryModalProps {
  /** Footer copy, e.g. `Inserting after "Text" in Lesson 1`. */
  location: string;
  onInsert: (type: EditorBlockType) => void;
  onImportQuestions: () => void;
  onClose: () => void;
}

type Tile =
  | { kind: 'block'; type: EditorBlockType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }
  | { kind: 'import'; label: string; description: string; icon: React.ComponentType<{ className?: string }> };

const GRID_COLS = 3;
const IMPORT_WORDS = ['import', 'quiz', 'question', 'csv'];

export function BlockLibraryModal({ location, onInsert, onImportQuestions, onClose }: BlockLibraryModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const highlightedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const tiles = useMemo<Tile[]>(() => {
    const blocks: Tile[] = filterCatalog(query, category).map((e) => ({
      kind: 'block',
      type: e.type,
      label: e.label,
      description: e.description,
      icon: e.icon,
    }));
    const q = query.trim().toLowerCase();
    const showImport =
      (category === 'all' || category === 'knowledge') &&
      (q === '' || IMPORT_WORDS.some((w) => w.startsWith(q) || q.includes(w)));
    if (showImport) {
      blocks.push({
        kind: 'import',
        label: 'Import questions',
        description: 'Bring in quiz questions from a checklist or CSV',
        icon: FileInput,
      });
    }
    return blocks;
  }, [query, category]);

  const safeHighlight = Math.min(highlight, Math.max(0, tiles.length - 1));

  useEffect(() => {
    highlightedRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [safeHighlight, tiles]);

  function activate(tile: Tile | undefined) {
    if (!tile) return;
    if (tile.kind === 'import') onImportQuestions();
    else onInsert(tile.type);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHighlight(Math.min(tiles.length - 1, safeHighlight + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHighlight(Math.max(0, safeHighlight - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(Math.min(tiles.length - 1, safeHighlight + GRID_COLS));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(Math.max(0, safeHighlight - GRID_COLS));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(tiles[safeHighlight]);
    }
  }

  const selectedTile = tiles[safeHighlight];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Block library"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans"
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 bg-[rgba(23,23,28,0.45)]" onClick={onClose} />
      <div className="relative flex h-[min(640px,90vh)] w-full max-w-[860px] flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Search className="size-5 text-ink-3" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <span className="hidden text-xs text-ink-3 sm:block">
            Tip: type <kbd className="rounded border border-line px-1.5">/</kbd> anywhere in a lesson
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-3 hover:bg-hover hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav aria-label="Categories" className="w-52 shrink-0 overflow-y-auto border-r border-line p-3">
            {[{ id: 'all' as const, label: 'All blocks' }, ...CATEGORIES].map((c) => {
              const count =
                c.id === 'all'
                  ? BLOCK_CATALOG.length
                  : BLOCK_CATALOG.filter((e) => e.category === c.id).length;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategory(c.id);
                    setHighlight(0);
                  }}
                  aria-current={active}
                  className={`mb-0.5 flex h-9 w-full items-center justify-between rounded-lg px-3 text-[13px] ${
                    active ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink-2 hover:bg-hover'
                  }`}
                >
                  {c.label}
                  <span className="text-xs text-ink-3">{count}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {tiles.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-3">No blocks match &ldquo;{query}&rdquo;</p>
            ) : (
              <div className="grid grid-cols-3 gap-3" role="listbox" aria-label="Blocks">
                {tiles.map((tile, i) => {
                  const Icon = tile.icon;
                  const active = i === safeHighlight;
                  return (
                    <button
                      key={tile.kind === 'block' ? tile.type : 'import'}
                      ref={active ? highlightedRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => activate(tile)}
                      className={`flex flex-col items-start gap-2 rounded-[12px] border p-3.5 text-left ${
                        active
                          ? 'border-brand bg-brand-soft'
                          : 'border-line bg-white hover:border-brand-line'
                      } ${tile.kind === 'import' ? 'border-dashed' : ''}`}
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-white text-brand-ink ring-1 ring-line">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-[13px] font-semibold text-ink">{tile.label}</span>
                      <span className="text-xs leading-snug text-ink-3">{tile.description}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="min-w-0 truncate text-xs text-ink-3">{location}</p>
          <button
            type="button"
            disabled={!selectedTile}
            onClick={() => activate(selectedTile)}
            className="h-9 shrink-0 rounded-[10px] bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-40"
          >
            {selectedTile ? (selectedTile.kind === 'import' ? 'Import questions' : `Insert ${selectedTile.label}`) : 'Insert'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
