import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Quote } from 'lucide-react';

export type QuotePayload = {
  text: string;
  attribution: string;
};

function parse(content?: string): QuotePayload {
  if (!content) return { text: '', attribution: '' };
  try { return JSON.parse(content) as QuotePayload; } catch { return { text: '', attribution: '' }; }
}

export function QuoteBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<QuotePayload>(() => parse(initialContent));

  const commit = useCallback((next: QuotePayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-indigo-50/60 px-4 py-2.5">
        <Quote className="size-4 text-indigo-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Pull Quote</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Quote text</label>
          <textarea
            value={payload.text}
            onChange={(e) => commit({ ...payload, text: e.target.value })}
            placeholder="Enter the quote text…"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Attribution (optional)</label>
          <input
            type="text"
            value={payload.attribution}
            onChange={(e) => commit({ ...payload, attribution: e.target.value })}
            placeholder="— Name, Title"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {/* Preview */}
        {payload.text && (
          <div className="mt-2 rounded-xl border-l-4 border-indigo-400 bg-slate-50 py-3 pl-4 pr-3">
            <p className="text-sm italic text-slate-600">{payload.text}</p>
            {payload.attribution && <p className="mt-1.5 text-xs font-medium text-slate-400">— {payload.attribution}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
