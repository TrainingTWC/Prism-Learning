import { useState, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { ArrowUpDown, Plus, Trash2, GripVertical } from 'lucide-react';

type Item = { id: string; text: string };
type Payload = { prompt: string; items: Item[] };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function uid() { return Math.random().toString(36).slice(2, 9); }

export function SortingBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [prompt, setPrompt] = useState(initial?.prompt ?? 'Arrange in the correct order');
  const [items, setItems] = useState<Item[]>(initial?.items ?? [
    { id: uid(), text: '' },
    { id: uid(), text: '' },
  ]);

  useEffect(() => {
    onSave(JSON.stringify({ prompt, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, items]);

  function move(i: number, dir: -1 | 1) {
    setItems((it) => {
      const j = i + dir;
      if (j < 0 || j >= it.length) return it;
      const next = [...it];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <ArrowUpDown className="size-4 text-teal-400" /> Sort the Order
        </div>
        <span className="text-xs text-[var(--text-muted)]">array order = correct answer</span>
      </div>
      <div className="p-4 space-y-3">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt / question" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base font-semibold text-[var(--text-primary)] outline-none focus:border-teal-400" />
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-500 text-xs font-bold text-white">{i + 1}</span>
              <input value={it.text} onChange={(e) => setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x))} placeholder="Step" className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-teal-400" />
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-0.5 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] disabled:opacity-30">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-md p-0.5 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] disabled:opacity-30">▼</button>
              </div>
              <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItems((xs) => [...xs, { id: uid(), text: '' }])} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] py-3 text-sm font-semibold text-[var(--text-muted)] hover:border-teal-400 hover:text-teal-400">
          <Plus className="size-4" /> Add step
        </button>
      </div>
    </div>
  );
}
