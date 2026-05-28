import { useState, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Layers, Plus, Trash2 } from 'lucide-react';

type Card = { id: string; front: string; back: string };
type Payload = { columns: 2 | 3 | 4; cards: Card[] };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function uid() { return Math.random().toString(36).slice(2, 9); }

export function RevealCardsBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [columns, setColumns] = useState<2 | 3 | 4>(initial?.columns ?? 3);
  const [cards, setCards] = useState<Card[]>(initial?.cards ?? [
    { id: uid(), front: 'Term', back: 'Definition' },
  ]);

  useEffect(() => {
    onSave(JSON.stringify({ columns, cards }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, cards]);

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Layers className="size-4 text-indigo-400" /> Reveal Cards
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-0.5">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setColumns(n as 2 | 3 | 4)} className={`rounded-md px-2 py-1 text-xs font-bold ${columns === n ? 'bg-indigo-500 text-white' : 'text-[var(--text-muted)]'}`}>
              {n} col
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          {cards.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400">Card {i + 1}</span>
                <button type="button" onClick={() => setCards((cs) => cs.filter((x) => x.id !== c.id))} className="rounded-md p-1 text-red-400 hover:bg-red-500/10"><Trash2 className="size-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={c.front} onChange={(e) => setCards((cs) => cs.map((x) => x.id === c.id ? { ...x, front: e.target.value } : x))} placeholder="Front (shown first)" className="rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400" />
                <input value={c.back} onChange={(e) => setCards((cs) => cs.map((x) => x.id === c.id ? { ...x, back: e.target.value } : x))} placeholder="Back (revealed)" className="rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400" />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setCards((cs) => [...cs, { id: uid(), front: '', back: '' }])} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] py-3 text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-400 hover:text-indigo-400">
          <Plus className="size-4" /> Add card
        </button>
      </div>
    </div>
  );
}
