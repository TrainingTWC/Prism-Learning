import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Minus } from 'lucide-react';

type DividerStyle = 'line' | 'space' | 'dots';

export type DividerPayload = {
  style: DividerStyle;
  label: string;
};

const STYLE_OPTIONS: { value: DividerStyle; label: string; preview: React.ReactNode }[] = [
  {
    value: 'line',
    label: 'Line',
    preview: <div className="w-full border-t border-slate-300" />,
  },
  {
    value: 'dots',
    label: 'Dots',
    preview: (
      <div className="flex items-center justify-center gap-1.5">
        <span className="block size-1.5 rounded-full bg-slate-300" />
        <span className="block size-1.5 rounded-full bg-slate-300" />
        <span className="block size-1.5 rounded-full bg-slate-300" />
      </div>
    ),
  },
  {
    value: 'space',
    label: 'Space',
    preview: <div className="w-full text-center text-xs text-slate-300 italic">— empty space —</div>,
  },
];

function parse(content?: string): DividerPayload {
  if (!content) return { style: 'line', label: '' };
  try { return JSON.parse(content) as DividerPayload; } catch { return { style: 'line', label: '' }; }
}

export function DividerBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<DividerPayload>(() => parse(initialContent));

  const commit = useCallback((next: DividerPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <Minus className="size-4 text-slate-400 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Divider</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Style picker */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Style</label>
          <div className="flex gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => commit({ ...payload, style: opt.value })}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                  payload.style === opt.value
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <div className="mb-2 flex items-center justify-center h-4">{opt.preview}</div>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label (only for 'line' style) */}
        {payload.style === 'line' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Label (optional)</label>
            <input
              type="text"
              value={payload.label}
              onChange={(e) => commit({ ...payload, label: e.target.value })}
              placeholder="e.g. Section 2"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}
