import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { QUICK_PICKS } from './blockCatalog';
import type { EditorBlockType } from './types';

interface BlockInserterProps {
  onPick: (type: EditorBlockType) => void;
  onOpenLibrary: () => void;
}

/** Quick-pick chips + "All blocks /" opener. */
export function QuickPicks({ onPick, onOpenLibrary }: BlockInserterProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-[12px] border border-line bg-white p-1.5 shadow-[0_4px_12px_rgba(23,23,28,0.08)]">
      {QUICK_PICKS.map((q) => (
        <button
          key={q.type}
          type="button"
          onClick={() => onPick(q.type)}
          className="h-8 rounded-lg px-3 text-[13px] text-ink hover:bg-brand-soft hover:text-brand-ink"
        >
          {q.label}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-line" />
      <button
        type="button"
        onClick={onOpenLibrary}
        className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-brand-ink hover:bg-brand-soft"
      >
        All blocks
        <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-3">/</kbd>
      </button>
    </div>
  );
}

/** 16px hover zone between blocks: brand line + centred "+" revealing quick picks. */
export function BlockInserter({ onPick, onOpenLibrary }: BlockInserterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="group relative z-10 flex h-4 items-center justify-center"
      data-inserter
    >
      <div
        className={`absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 rounded bg-brand transition-opacity ${
          open ? 'opacity-60' : 'opacity-0 group-hover:opacity-50'
        }`}
      />
      {open ? (
        <div className="relative z-20">
          <QuickPicks
            onPick={(t) => {
              setOpen(false);
              onPick(t);
            }}
            onOpenLibrary={() => {
              setOpen(false);
              onOpenLibrary();
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label="Insert block here"
          title="Insert block here"
          onClick={() => setOpen(true)}
          className="relative flex size-6 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
