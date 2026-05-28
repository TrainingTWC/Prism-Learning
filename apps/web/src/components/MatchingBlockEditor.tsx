import { useState, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { GitMerge, Plus, Trash2 } from 'lucide-react';

type Pair = { id: string; term: string; definition: string };
type Payload = { pairs: Pair[] };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function uid() { return Math.random().toString(36).slice(2, 9); }

export function MatchingBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [pairs, setPairs] = useState<Pair[]>(initial?.pairs ?? [
    { id: uid(), term: '', definition: '' },
    { id: uid(), term: '', definition: '' },
  ]);

  useEffect(() => {
    onSave(JSON.stringify({ pairs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs]);

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <GitMerge className="size-4 text-fuchsia-400" /> Matching
        </div>
        <span className="text-xs text-[var(--text-muted)]">{pairs.length} pair{pairs.length === 1 ? '' : 's'}</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="rounded-lg bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-300">Definitions will be shuffled for the learner — they drag each definition to its matching term.</p>
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[28px_1fr_24px_1fr_28px] items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-2">
              <span className="text-center text-xs font-bold text-fuchsia-400">{i + 1}</span>
              <input value={p.term} onChange={(e) => setPairs((ps) => ps.map((x) => x.id === p.id ? { ...x, term: e.target.value } : x))} placeholder="Term" className="rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-fuchsia-400" />
              <span className="text-center text-lg text-[var(--text-muted)]">↔</span>
              <input value={p.definition} onChange={(e) => setPairs((ps) => ps.map((x) => x.id === p.id ? { ...x, definition: e.target.value } : x))} placeholder="Definition" className="rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-fuchsia-400" />
              <button type="button" onClick={() => setPairs((ps) => ps.filter((x) => x.id !== p.id))} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPairs((ps) => [...ps, { id: uid(), term: '', definition: '' }])} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] py-3 text-sm font-semibold text-[var(--text-muted)] hover:border-fuchsia-400 hover:text-fuchsia-400">
          <Plus className="size-4" /> Add pair
        </button>
      </div>
    </div>
  );
}
