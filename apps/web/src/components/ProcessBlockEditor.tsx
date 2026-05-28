import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { ListOrdered, Plus, Trash2 } from 'lucide-react';

export type ProcessStep = {
  id: string;
  title: string;
  body: string;
};

export type ProcessPayload = {
  steps: ProcessStep[];
};

function uid() { return Math.random().toString(36).slice(2, 7); }

function parse(content?: string): ProcessPayload {
  if (!content) return { steps: [{ id: uid(), title: '', body: '' }, { id: uid(), title: '', body: '' }] };
  try { return JSON.parse(content) as ProcessPayload; } catch {
    return { steps: [{ id: uid(), title: '', body: '' }, { id: uid(), title: '', body: '' }] };
  }
}

export function ProcessBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<ProcessPayload>(() => parse(initialContent));

  const commit = useCallback((next: ProcessPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  function update(id: string, field: 'title' | 'body', value: string) {
    commit({ steps: payload.steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }

  function addStep() {
    if (payload.steps.length >= 10) return;
    commit({ steps: [...payload.steps, { id: uid(), title: '', body: '' }] });
  }

  function removeStep(id: string) {
    if (payload.steps.length <= 1) return;
    commit({ steps: payload.steps.filter((s) => s.id !== id) });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-orange-50/60 px-4 py-2.5">
        <ListOrdered className="size-4 text-orange-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">Process</span>
        <span className="ml-auto text-[11px] text-slate-400">{payload.steps.length}/10 steps</span>
      </div>

      <div className="p-4 space-y-3">
        {payload.steps.map((step, idx) => (
          <div key={step.id} className="flex gap-3 group">
            {/* Step number indicator */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="flex size-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {idx + 1}
              </div>
              {idx < payload.steps.length - 1 && (
                <div className="w-0.5 flex-1 min-h-4 bg-slate-200" />
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-1.5">
              <input
                type="text"
                value={step.title}
                onChange={(e) => update(step.id, 'title', e.target.value)}
                placeholder={`Step ${idx + 1} title`}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <textarea
                value={step.body}
                onChange={(e) => update(step.id, 'body', e.target.value)}
                placeholder="Step description (optional)…"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeStep(step.id)}
              disabled={payload.steps.length <= 1}
              className="self-start mt-1 shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-30 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          disabled={payload.steps.length >= 10}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 pt-1"
        >
          <Plus className="size-3.5" /> Add step
        </button>
      </div>
    </div>
  );
}
